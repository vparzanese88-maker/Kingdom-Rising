// Kingdom Battles: towns, walls, towers, troops, workers, AI commanders and the match itself.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G } from './state.js';
import { S } from './audio.js';
import { V } from './vfx.js';
import { heightAt } from './terrain.js';
import { world, addBox, addCircle, collide, hideNode } from './world.js';
import { buildHumanoid, animateHumanoid, equipWeapon, bake, holdTool } from './character.js';
import { RACES, CLASSES, MOBS } from './data.js';
import { Mob, buildQuad, animQuad } from './mobs.js';
import { BATTLE, SETUP, LAYOUT, WALL_R, nearTown } from './battlemap.js';
import { TEAM_COLORS, TEAM_NAMES, DIFFS, TOWN_NAMES, ROSTERS, MERCS, rosterOf, unitDef, unitSpec, TOWN_LEVELS, TOWER_LEVELS, TOWER_REPAIR, ECON, FOREMAN } from './battledata.js';
import { angDiff, rand, clamp, distToLine } from './util.js';
import { fog, updateFog, isVisible, addPing } from './fog.js';
import { MP, send } from './mp.js';
import { job as QJOB } from './battlequests.js';
import { petDef } from './classes2.js';
import { proxyUnitStep, fxQueue, mobList } from './mpsync.js';

export const B = { on: false, towns: [], units: [], structs: [], shots: [], time: 0, over: false, result: null, me: 0, msgs: [] };
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const MATS = new Map();
function mat(c, r = 0.85, m = 0, o = {}) { const k = c + r + m + JSON.stringify(o); if (!MATS.has(k)) MATS.set(k, new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: r, metalness: m }, o))); return MATS.get(k); }
function add(g, geo, m, x, y, z, rx = 0, ry = 0, rz = 0) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = o.receiveShadow = true; g.add(o); return o; }
const box = (g, w, h, d, m, x, y, z, ry = 0) => add(g, new THREE.BoxGeometry(w, h, d), m, x, y, z, 0, ry);
const cyl = (g, rt, rb, h, m, x, y, z, seg = 8) => add(g, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);
const cone = (g, r, h, m, x, y, z, seg = 8, ry = 0) => add(g, new THREE.ConeGeometry(r, h, seg), m, x, y, z, 0, ry);
const ball = (g, r, m, x, y, z, det = 0) => add(g, new THREE.IcosahedronGeometry(r, det), m, x, y, z);

// merge a group of meshes into one mesh per material (far fewer draw calls)
function mergeGroup(g) {
  g.updateMatrixWorld(true);
  const buckets = new Map();
  g.traverse(o => { if (!o.isMesh) return; let geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k); geo.applyMatrix4(o.matrixWorld); if (!buckets.has(o.material)) buckets.set(o.material, []); buckets.get(o.material).push(geo); });
  const out = new THREE.Group();
  for (const [m, list] of buckets) { const mg = mergeGeometries(list, false); const mesh = new THREE.Mesh(mg, m); mesh.castShadow = mesh.receiveShadow = true; out.add(mesh); }
  return out;
}

// ---------- race styles ----------
const STYLE = {
  human: { stone: '#8a847a', wood: '#7a5a3a', dark: '#4a3020', roof: '#8a3a2a', roof2: '#b8954a', wall2: '#e6dcc4', trim: '#d8b04a' },
  orc: { stone: '#5a5048', wood: '#5a3e26', dark: '#3a2616', roof: '#8a6a44', roof2: '#6a4a2a', wall2: '#7a5a3a', trim: '#b0402a' },
  highelf: { stone: '#ece6d8', wood: '#c8b898', dark: '#a89a7a', roof: '#2a8a9a', roof2: '#3a6aa8', wall2: '#f4f0e6', trim: '#e0b850' },
  woodelf: { stone: '#7a7a5a', wood: '#6a4a2a', dark: '#4a3420', roof: '#3a7a2a', roof2: '#5a8a3a', wall2: '#8a6a40', trim: '#c8d870' },
  dwarf: { stone: '#5e5a56', wood: '#5a4030', dark: '#3a3430', roof: '#4a5058', roof2: '#6a5040', wall2: '#7a7470', trim: '#c89a40' },
};

// ---------- walls ----------
const WALL_SEG = 48;
function wallAngles(t) { const ag = Math.atan2(t.dir[1], t.dir[0]), step = Math.PI * 2 / WALL_SEG, out = []; for (let k = 1; k < WALL_SEG - 1; k++) out.push(ag + (k + 0.5) * step); return { out, step, ag }; }
function buildWalls(t, lvl) {
  const g = new THREE.Group(), st = STYLE[t.race] || STYLE.human, H = TOWN_LEVELS[lvl].wallH, { out, step, ag } = wallAngles(t);
  const L = 2 * WALL_R * Math.sin(step / 2) + 0.15;
  const mStone = mat(st.stone, 0.95), mWood = mat(st.wood), mDark = mat(st.dark), mTrim = mat(st.trim, 0.5, 0.6), mLeaf = mat('#3e7a2e', 0.9), mBone = mat('#e8dfc4', 0.8), mIron = mat('#3a3a3e', 0.5, 0.8);
  for (const a of out) {
    const s = new THREE.Group(); const x = t.x + Math.cos(a) * WALL_R, z = t.z + Math.sin(a) * WALL_R, y = heightAt(x, z);
    s.position.set(x, y, z); s.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a)); g.add(s);
    if (t.race === 'human') {
      const sh = [0.9, 2.4, 3.8, H - 0.6][lvl];
      box(s, L, sh + 0.6, 1.6, mStone, 0, (sh + 0.6) / 2 - 0.6, 0);
      const logH = H - sh; if (logH > 0.3) for (let i = 0; i < 12; i++) { const lx = -L / 2 + (i + 0.5) * L / 12; cyl(s, 0.26, 0.28, logH, mWood, lx, sh + logH / 2, 0, 6); }
      if (lvl >= 2) for (let i = 0; i < 4; i++) box(s, 0.9, 0.7, 1.7, mStone, -L / 2 + (i + 0.5) * L / 4, H + 0.3, 0);
      else for (let i = 0; i < 12; i++) cone(s, 0.27, 0.55, mWood, -L / 2 + (i + 0.5) * L / 12, H + 0.27, 0, 6);
    } else if (t.race === 'orc') {
      for (let i = 0; i < 12; i++) { const lx = -L / 2 + (i + 0.5) * L / 12, hh = H + (i % 3 === 1 ? 0.5 : 0) + (lvl > 0 ? (i % 2) * 0.3 : 0); cyl(s, 0.28, 0.31, hh, mWood, lx, hh / 2 - 0.3, 0, 6); cone(s, 0.29, 1.0 + lvl * 0.15, mDark, lx, hh - 0.3 + 0.5 + lvl * 0.07, 0, 6); }
      if (lvl >= 1) for (const yy of [1.2, H - 1.1]) box(s, L, 0.18, 0.66, mIron, 0, yy, 0);
      if (Math.random() < 0.35) ball(s, 0.26, mBone, (Math.random() - 0.5) * L * 0.6, H + 0.4, -0.35, 0);
      if (lvl >= 2) { box(s, L, 0.6, 1.8, mStone, 0, 0.0, 0); }
    } else if (t.race === 'highelf') {
      box(s, L, H, 1.3, mStone, 0, H / 2 - 0.4, 0);
      box(s, L + 0.05, 0.25, 1.5, mTrim, 0, H - 0.3, 0);
      for (let i = 0; i < 3; i++) box(s, 0.8, 0.8, 1.3, mStone, -L / 2 + (i + 0.5) * L / 3, H + 0.3, 0);
      if (lvl >= 2) box(s, L, 0.25, 1.5, mTrim, 0, H * 0.45, 0);
    } else if (t.race === 'woodelf') {
      box(s, L, H * 0.55, 1.2, mat('#4a7a34', 0.95), 0, H * 0.27, 0);
      for (let i = 0; i < 4; i++) { const lx = -L / 2 + (i + 0.5) * L / 4; cyl(s, 0.22, 0.34, H + 0.6, mWood, lx, (H + 0.6) / 2 - 0.3, 0.2, 6); ball(s, 0.9 + lvl * 0.15, mLeaf, lx, H + 0.6, 0.2, 0); }
      if (lvl >= 2) for (let i = 0; i < 6; i++) cone(s, 0.12, 0.8, mDark, -L / 2 + (i + 0.5) * L / 6, H * 0.6, -0.65, 5);
    } else {
      // dwarf: thick dark stone with square crenels and iron bands
      box(s, L, H, 2.2, mStone, 0, H / 2 - 0.5, 0);
      for (let i = 0; i < 4; i++) box(s, 1.0, 0.9, 2.2, mStone, -L / 2 + (i + 0.5) * L / 4, H + 0.35, 0);
      box(s, L + 0.05, 0.3, 2.3, mIron, 0, H * 0.35, 0); if (lvl >= 2) box(s, L + 0.05, 0.3, 2.3, mTrim, 0, H * 0.7, 0);
    }
  }
  // turrets along the wall from the first upgrade, banners from the second, gold caps on the third
  if (lvl >= 1) out.forEach((a, i) => { if (i % 6 !== 3) return; const x = t.x + Math.cos(a) * WALL_R, z = t.z + Math.sin(a) * WALL_R, s = new THREE.Group(); s.position.set(x, heightAt(x, z), z); g.add(s); const th = H + 2.2 + lvl * 0.6;
    if (t.race === 'orc' || t.race === 'woodelf') { cyl(s, 1.3, 1.5, th, mWood, 0, th / 2 - 0.3, 0, 7); cone(s, 1.8, 1.8 + lvl * 0.3, t.race === 'orc' ? mDark : mLeaf, 0, th + 0.6, 0, 7); }
    else { cyl(s, 1.5, 1.7, th, mStone, 0, th / 2 - 0.3, 0, 10); for (let k = 0; k < 6; k++) { const aa = k / 6 * 6.28; box(s, 0.6, 0.7, 0.6, mStone, Math.cos(aa) * 1.45, th + 0.1, Math.sin(aa) * 1.45); } if (lvl >= 3) cone(s, 1.9, 2.6, mat(st.roof, 0.7), 0, th + 1.6, 0, 10); }
    if (lvl >= 3) cyl(s, 1.75, 1.75, 0.3, mTrim, 0, th * 0.6, 0, 10);
    if (lvl >= 2) { const b = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.6), mat(TEAM_COLORS[t.team], 0.9, 0, { side: THREE.DoubleSide })); b.position.set(-Math.cos(a) * 1.8, th - 1.8, -Math.sin(a) * 1.8); b.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a)) + Math.PI / 2; s.add(b); } });
  if (lvl >= 2) for (const sd of [-1, 1]) { const a = ag + sd * step * 2.3, x = t.x + Math.cos(a) * (WALL_R - 2.5), z = t.z + Math.sin(a) * (WALL_R - 2.5), s = new THREE.Group(); s.position.set(x, heightAt(x, z), z); g.add(s); cyl(s, 0.1, 0.12, 2.6, mat('#3a2a1a'), 0, 1.3, 0, 6); cyl(s, 0.35, 0.2, 0.4, mat('#2a2a2e', 0.5, 0.7), 0, 2.7, 0, 8); ball(s, 0.3, mat('#ff8a20', 0.5, 0, { emissive: '#ff6a10', emissiveIntensity: 2.4 }), 0, 3.0, 0, 1); }
  // gate towers on both sides of the opening
  for (const sd of [-1, 1]) {
    const a = ag + sd * step * 1.0, x = t.x + Math.cos(a) * WALL_R, z = t.z + Math.sin(a) * WALL_R, y = heightAt(x, z), gh = H + 2.5;
    const s = new THREE.Group(); s.position.set(x, y, z); g.add(s);
    if (t.race === 'orc') { for (let i = 0; i < 6; i++) { const aa = i / 6 * 6.28; cyl(s, 0.32, 0.34, gh, mWood, Math.cos(aa) * 1.2, gh / 2 - 0.3, Math.sin(aa) * 1.2, 6); cone(s, 0.33, 1.1, mDark, Math.cos(aa) * 1.2, gh + 0.25, Math.sin(aa) * 1.2, 6); } ball(s, 0.35, mBone, 0, gh + 0.3, 0); }
    else if (t.race === 'highelf') { cyl(s, 1.5, 1.8, gh, mStone, 0, gh / 2 - 0.4, 0, 10); cone(s, 1.9, 3.5, mat(st.roof, 0.6), 0, gh + 1.6, 0, 10); cyl(s, 1.82, 1.82, 0.3, mTrim, 0, gh - 0.4, 0, 10); }
    else if (t.race === 'woodelf') { cyl(s, 0.9, 1.4, gh + 2, mWood, 0, (gh + 2) / 2 - 0.4, 0, 7); ball(s, 2.2, mLeaf, 0, gh + 2, 0, 1); }
    else { box(s, 3.2, gh, 3.2, mStone, 0, gh / 2 - 0.4, 0); for (const [mx, mz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(s, 0.9, 0.9, 0.9, mStone, mx * 1.15, gh + 0.4, mz * 1.15); if (t.race === 'human') cone(s, 2.6, 2.4, mat(st.roof, 0.85), 0, gh + 1.5, 0, 4, Math.PI / 4); }
    addCircle(x, z, 2.0, 'wall');
  }
  // archway over the gate
  { const x = t.gate[0], z = t.gate[1], y = heightAt(x, z), s = new THREE.Group(); s.position.set(x, y, z); s.rotation.y = Math.atan2(-Math.cos(ag), -Math.sin(ag)); g.add(s);
    const gw = 2 * WALL_R * Math.sin(step); box(s, gw, 1.2, 1.6, t.race === 'orc' || t.race === 'woodelf' ? mWood : mStone, 0, H + 1.4, 0);
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.6), mat(TEAM_COLORS[t.team], 0.9, 0, { side: THREE.DoubleSide })); banner.position.set(0, H - 0.2, -0.85); s.add(banner); }
  return g;
}
function wallColliders(t) {
  const { out, step } = wallAngles(t), L = 2 * WALL_R * Math.sin(step / 2) + 0.2;
  for (const a of out) { const x = t.x + Math.cos(a) * WALL_R, z = t.z + Math.sin(a) * WALL_R; addBox(x, z, L / 2, t.race === 'dwarf' ? 1.2 : 0.9, Math.atan2(-Math.cos(a), -Math.sin(a)), 'wall'); }
}

// ---------- buildings inside the walls ----------
const UPV = new THREE.Vector3(0, 1, 0), PRISMS = new Map();
const sub = (g, x = 0, y = 0, z = 0, ry = 0) => { const o = new THREE.Group(); o.position.set(x, y, z); o.rotation.y = ry; g.add(o); return o; };
const GLOW = () => mat('#ffd68a', 0.5, 0, { emissive: '#ff9a30', emissiveIntensity: 1.5 });
const EMBER = () => mat('#ff7a20', 0.6, 0, { emissive: '#ff5000', emissiveIntensity: 2.4 });
const ELFGLOW = () => mat('#e0f4ff', 0.4, 0, { emissive: '#8ad0ff', emissiveIntensity: 1.4 });
const FAEGLOW = () => mat('#eaffb0', 0.4, 0, { emissive: '#c8ff60', emissiveIntensity: 1.8 });
const RUNE = () => mat('#ffd070', 0.4, 0, { emissive: '#ffa020', emissiveIntensity: 2.0 });
const IRON = () => mat('#3a3a3e', 0.5, 0.8), BONE = () => mat('#e8dfc4', 0.8);
const LEAF = ['#3e7a2e', '#4e8a34', '#2f6a2a'];
const shade = (c, k) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();
// triangular prism: base w wide on y=0, apex h high, d deep along z (a gable end / pediment)
function prismGeo(w, h, d) {
  const key = `${w.toFixed(2)},${h.toFixed(2)},${d.toFixed(2)}`; if (PRISMS.has(key)) return PRISMS.get(key);
  const A = [-w / 2, 0], Bq = [w / 2, 0], C = [0, h], v = [], T = (...p) => { for (const q of p) v.push(...q); }, f = (p, zz) => [p[0], p[1], zz];
  T(f(A, d / 2), f(Bq, d / 2), f(C, d / 2)); T(f(Bq, -d / 2), f(A, -d / 2), f(C, -d / 2));
  for (const [p, q] of [[A, Bq], [Bq, C], [C, A]]) { T(f(p, d / 2), f(p, -d / 2), f(q, -d / 2)); T(f(p, d / 2), f(q, -d / 2), f(q, d / 2)); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); geo.computeVertexNormals(); PRISMS.set(key, geo); return geo;
}
// a beam, pole or horn from one point to another
function strut(g, x1, y1, z1, x2, y2, z2, r, m, kind = 'box') {
  const d = V3(x2 - x1, y2 - y1, z2 - z1), L = d.length();
  const geo = kind === 'cyl' ? new THREE.CylinderGeometry(r, r, L, 5) : kind === 'cone' ? new THREE.ConeGeometry(r, L, 6) : new THREE.BoxGeometry(r, L, r);
  const o = add(g, geo, m, (x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2); o.quaternion.setFromUnitVectors(UPV, d.normalize()); return o;
}
// gabled roof: span w across x, ridge along z (length d), rise h; slabs overhang by o, optional tile courses
function gable(g, w, d, h, mRoof, mEnd, x, y, z, ry = 0, o = 0.5, mRidge = mRoof, rows = 0, mRow = null) {
  const r = sub(g, x, y, z, ry), L = Math.hypot(w / 2, h), ang = Math.atan2(h, w / 2), th = 0.18;
  if (mEnd) add(r, prismGeo(w, h, d), mEnd, 0, 0, 0);
  for (const sd of [-1, 1]) {
    const sl = sub(r, sd * w / 4 + sd * Math.cos(ang) * o / 2 + sd * Math.sin(ang) * th / 2, h / 2 - Math.sin(ang) * o / 2 + Math.cos(ang) * th / 2, 0); sl.rotation.z = -sd * ang;
    box(sl, L + o + 0.12, th, d + o * 2, mRoof, -sd * 0.06, 0, 0);
    for (let i = 1; i <= rows; i++) box(sl, 0.1, 0.07, d + o * 2, mRow || mRoof, sd * (-(L + o) / 2 + i * (L + o) / (rows + 1)), th / 2 + 0.03, 0);
  }
  if (mRidge) box(r, 0.32, 0.3, d + o * 2 + 0.12, mRidge, 0, h + 0.1, 0);
  return r;
}
// a window facing +z: frame, lit glass, cross bars, sill, optional shutters and an arched top
function win(f, x, y, z, ww, wh, mFrame, mGlass, mShut, arch = false, cross = true) {
  box(f, ww + 0.16, wh + 0.16, 0.08, mFrame, x, y, z); box(f, ww, wh, 0.1, mGlass, x, y, z + 0.01);
  if (arch) { add(f, new THREE.CylinderGeometry(ww / 2 + 0.08, ww / 2 + 0.08, 0.08, 8, 1, false, Math.PI / 2, Math.PI), mFrame, x, y + wh / 2, z, Math.PI / 2); add(f, new THREE.CylinderGeometry(ww / 2, ww / 2, 0.1, 8, 1, false, Math.PI / 2, Math.PI), mGlass, x, y + wh / 2, z + 0.01, Math.PI / 2); }
  if (cross) { box(f, 0.05, wh, 0.13, mFrame, x, y, z + 0.02); box(f, ww, 0.05, 0.13, mFrame, x, y + wh * 0.1, z + 0.02); }
  box(f, ww + 0.28, 0.08, 0.2, mFrame, x, y - wh / 2 - 0.1, z + 0.06);
  if (mShut) for (const sd of [-1, 1]) box(f, ww * 0.5, wh + 0.06, 0.05, mShut, x + sd * (ww * 0.75 + 0.1), y, z + 0.03);
}
function barrel(g, x, z, s = 1, y = 0) { cyl(g, 0.33 * s, 0.28 * s, 0.85 * s, mat('#7a5232'), x, y + 0.425 * s, z, 8); for (const yy of [0.18, 0.67]) cyl(g, 0.345 * s, 0.33 * s, 0.07 * s, IRON(), x, y + yy * s, z, 8); }
function crate(g, x, z, s = 1, y = 0, ry = 0) { box(g, s, s, s, mat('#9a7448'), x, y + s / 2, z, ry); box(g, s * 1.03, s * 0.14, s * 1.03, mat('#6a4a2a'), x, y + s / 2, z, ry); }
function smokeAt(p) { const L = world.smokes = world.smokes || []; if (!L.some(q => Math.abs(q.x - p.x) < 2 && Math.abs(q.z - p.z) < 2)) L.push(p); }
function lantern(g, x, y, z, m = GLOW()) { box(g, 0.32, 0.42, 0.32, IRON(), x, y, z); box(g, 0.24, 0.3, 0.36, m, x, y, z); box(g, 0.36, 0.3, 0.24, m, x, y, z); cone(g, 0.26, 0.22, IRON(), x, y + 0.32, z, 4, Math.PI / 4); }
function totem(g, x, z, hh, st) {
  const s = sub(g, x, 0, z), cols = [st.wood, st.trim, '#3a2616', '#c8b898']; let y = 0; const n = Math.max(3, Math.round(hh / 1.1));
  for (let i = 0; i < n; i++) { const sz = 0.75 - i * 0.04; box(s, sz, 1.0, sz, mat(cols[i % 4], 0.9), 0, y + 0.5, 0, i * 0.3); box(s, 0.5, 0.14, 0.1, mat('#1a1008'), 0, y + 0.62, sz / 2 + 0.02); for (const sd of [-1, 1]) box(s, 0.12, 0.12, 0.1, EMBER(), sd * 0.16, y + 0.72, sz / 2 + 0.03); y += 1.0; }
  for (const sd of [-1, 1]) strut(s, sd * 0.25, y - 0.2, 0, sd * 0.95, y + 0.9, 0.2, 0.14, BONE(), 'cone');
  return s;
}
// wall details for one face of a building, drawn in local x/y at z = 0 facing +z
function face(f, race, w, H, kind, st, o = {}) {
  let n = Math.max(2, Math.round(w / 1.35)); if (kind === 'door' && n % 2 === 0) n++;
  const dI = kind === 'door' ? (n - 1) / 2 : -1, back = kind === 'back';
  const dwB = kind === 'door' ? Math.max(w / n, (o.dw || 0) + 0.6) : 0, sbw = kind === 'door' ? (w - dwB) / (n - 1) : w / n;
  const bays = []; { let x = -w / 2; for (let i = 0; i < n; i++) { const bw = i === dI ? dwB : sbw; bays.push([x, x + bw, x + bw / 2, bw]); x += bw; } }
  const mDark = mat(st.dark), ww = Math.min(0.85, sbw * 0.55), wh = Math.min(1.3, H * 0.36), wy = H * 0.58;
  const dh = o.dh || Math.min(2.1, H * 0.78), dw = i => o.dw || bays[i][3] * 0.74;
  if (race === 'human' || race === 'hstone') {
    const mSh = mat('#3e5a44', 0.9), mDoor = mat('#5a3a22'), stone = race === 'hstone';
    if (!stone) { for (const yy of [0.1, H - 0.1]) box(f, w + 0.14, 0.2, 0.12, mDark, 0, yy, 0.05); for (let i = 0; i <= n; i++) box(f, 0.2, H, 0.12, mDark, i < n ? bays[i][0] : bays[n - 1][1], H / 2, 0.05); }
    else { const q = mat(shade(st.stone, 1.18), 0.95); for (const sd of [-1, 1]) for (let k = 0; k < Math.floor(H / 0.55); k++) box(f, k % 2 ? 0.5 : 0.8, 0.42, 0.14, q, sd * (w / 2 - (k % 2 ? 0.25 : 0.4)), 0.28 + k * 0.55, 0.04); box(f, w + 0.1, 0.22, 0.2, q, 0, H - 0.11, 0.06); }
    for (let i = 0; i < n; i++) {
      const [x0, x1, xc, bw] = bays[i];
      if (i === dI) { const W2 = dw(i); box(f, W2, dh, 0.14, mDoor, xc, dh / 2, 0.06); for (const k of [0.25, 0.7]) box(f, W2 + 0.04, 0.08, 0.18, IRON(), xc, dh * k, 0.08); box(f, W2 + 0.3, 0.24, 0.2, stone ? mat(shade(st.stone, 1.18)) : mDark, xc, dh + 0.1, 0.07); if (W2 > 1.4) box(f, 0.06, dh, 0.18, mDark, xc, dh / 2, 0.08); else box(f, 0.08, 0.08, 0.1, mat(st.trim, 0.4, 0.8), xc + W2 * 0.3, dh * 0.5, 0.15); }
      else if (!stone && (i === 0 || i === n - 1) && n > 2) { const a = i === 0 ? x0 + 0.1 : x1 - 0.1, b = i === 0 ? x1 : x0; strut(f, a, 0.15, 0.05, b, H - 0.15, 0.05, 0.16, mDark); }
      else { if (!stone) box(f, bw, 0.16, 0.12, mDark, xc, H * 0.32, 0.05); if (!back) win(f, xc, wy, 0.06, ww, wh, mDark, GLOW(), stone ? null : mSh, stone); else if (!stone) strut(f, x0, H * 0.32, 0.05, x1, H - 0.15, 0.05, 0.14, mDark); }
    }
  } else if (race === 'orc') {
    const mLog = mat(st.dark), k = Math.max(3, Math.round(w / 0.62)), dc = dI >= 0 ? bays[dI][2] : 0, DW = dI >= 0 ? dw(dI) : 0;
    for (let i = 0; i <= k; i++) { const x = -w / 2 + i * w / k; if (dI >= 0 && Math.abs(x - dc) < DW / 2 + 0.15) continue; cyl(f, 0.17, 0.2, H + 0.4, mLog, x, (H + 0.4) / 2 - 0.1, 0.12, 5); }
    box(f, w + 0.2, 0.12, 0.08, mat('#2a1a10'), 0, H * 0.72, 0.3); box(f, w + 0.2, 0.3, 0.08, mat(st.trim, 0.85), 0, H * 0.45, 0.28);
    if (dI >= 0) { const tk = Math.max(1, DW / 1.1); box(f, DW, dh, 0.14, mat('#1e120a'), dc, dh / 2, 0.12); box(f, DW * 0.8, dh * 0.6, 0.06, mat(st.roof, 0.95), dc, dh * 0.66, 0.22);
      for (const sd of [-1, 1]) strut(f, dc + sd * (DW / 2 + 0.3), 0.05, 0.45, dc + sd * (DW / 2 - 0.1 * tk), dh + 0.9 * tk, 0.9 * tk, 0.2 * tk, BONE(), 'cone');
      ball(f, 0.3 * tk, BONE(), dc, dh + 0.35 * tk, 0.35, 0); for (const sd of [-1, 1]) box(f, 0.1 * tk, 0.1 * tk, 0.1, mat('#1a1008'), dc + sd * 0.11 * tk, dh + 0.4 * tk, 0.35 + 0.27 * tk); }
    else if (!back) for (let i = 0; i < n; i += 2) { const xc = bays[i][2]; box(f, 0.6, 0.5, 0.1, mat('#1e120a'), xc, wy, 0.3); box(f, 0.44, 0.34, 0.1, EMBER(), xc, wy, 0.32); }
  } else if (race === 'highelf') {
    const mTrim = mat(st.trim, 0.4, 0.75), mPil = mat(st.stone, 0.75);
    box(f, w + 0.1, 0.16, 0.1, mTrim, 0, H - 0.28, 0.06); box(f, w + 0.1, 0.12, 0.1, mTrim, 0, 0.12, 0.06);
    for (let i = 0; i <= n; i++) { const x = i < n ? bays[i][0] : bays[n - 1][1]; box(f, 0.3, H - 0.4, 0.14, mPil, x, H / 2 - 0.15, 0.06); box(f, 0.42, 0.16, 0.2, mTrim, x, H - 0.45, 0.07); }
    for (let i = 0; i < n; i++) { const xc = bays[i][2];
      if (i === dI) { const W2 = dw(i); box(f, W2, dh, 0.14, mat('#3a5a8a', 0.6), xc, dh / 2, 0.06); add(f, new THREE.CylinderGeometry(W2 / 2, W2 / 2, 0.14, 10, 1, false, Math.PI / 2, Math.PI), mat('#3a5a8a', 0.6), xc, dh, 0.06, Math.PI / 2); add(f, new THREE.CylinderGeometry(W2 / 2 + 0.14, W2 / 2 + 0.14, 0.1, 10, 1, false, Math.PI / 2, Math.PI), mTrim, xc, dh, 0.03, Math.PI / 2); }
      else if (!back) win(f, xc, wy - 0.1, 0.06, ww * 0.85, wh * 1.1, mTrim, ELFGLOW(), null, true, false); }
  } else if (race === 'woodelf') {
    const mLive = mat(st.wood), mDk = mat(st.dark);
    for (const sd of [-1, 1]) cyl(f, 0.2, 0.28, H + 0.3, mLive, sd * w / 2, (H + 0.3) / 2, 0.05, 6); box(f, w, 0.18, 0.14, mDk, 0, H - 0.1, 0.06);
    for (let i = 0; i < Math.ceil(w / 1.4); i++) ball(f, 0.38, mat(LEAF[i % 3], 0.9), -w / 2 + 0.5 + i * 1.4, H - 0.05, 0.16, 0);
    for (let i = 0; i < n; i++) { const xc = bays[i][2];
      if (i === dI) { const W2 = dw(i); box(f, W2, dh - W2 / 2, 0.14, mDk, xc, (dh - W2 / 2) / 2, 0.06); add(f, new THREE.CylinderGeometry(W2 / 2, W2 / 2, 0.14, 10, 1, false, Math.PI / 2, Math.PI), mDk, xc, dh - W2 / 2, 0.06, Math.PI / 2); lantern(f, xc + W2 / 2 + 0.35, dh * 0.8, 0.3, FAEGLOW()); }
      else if (!back) { add(f, new THREE.CylinderGeometry(ww * 0.6, ww * 0.6, 0.1, 10), mDk, xc, wy, 0.04, Math.PI / 2); add(f, new THREE.CylinderGeometry(ww * 0.45, ww * 0.45, 0.12, 10), FAEGLOW(), xc, wy, 0.06, Math.PI / 2); } }
  } else {
    const mBut = mat(shade(st.stone, 0.82), 0.95), mIron = IRON();
    for (const sd of [-1, 1]) { box(f, 0.75, H + 0.25, 0.55, mBut, sd * (w / 2 - 0.1), (H + 0.25) / 2, 0.2); box(f, 0.9, 0.3, 0.7, mBut, sd * (w / 2 - 0.1), 0.15, 0.25); }
    box(f, w - 1.4, 0.16, 0.08, mIron, 0, H * 0.84, 0.05);
    for (let i = 0; i < n; i++) { const xc = bays[i][2];
      if (i === dI) { const W2 = Math.max(1.1, dw(i)); box(f, W2 + 0.7, dh + 0.45, 0.3, mBut, xc, (dh + 0.45) / 2, 0.12); box(f, W2, dh, 0.12, mat(st.wood), xc, dh / 2, 0.3); for (const k of [0.28, 0.72]) box(f, W2 + 0.04, 0.12, 0.06, mIron, xc, dh * k, 0.38); box(f, 0.06, dh, 0.06, mIron, xc, dh / 2, 0.38); box(f, W2 + 0.2, 0.22, 0.06, RUNE(), xc, dh + 0.24, 0.3); }
      else if (!back && i % 2 === (dI >= 0 ? dI % 2 ^ 1 : 1)) { box(f, 0.66, wh + 0.3, 0.22, mBut, xc, wy, 0.08); box(f, 0.34, wh, 0.24, mat('#ffb060', 0.5, 0, { emissive: '#ff7a20', emissiveIntensity: 1.6 }), xc, wy, 0.09); box(f, 0.05, wh, 0.3, mIron, xc, wy, 0.1); }
    }
  }
}
// a rectangular building in a race's style: plinth, n storeys of walls with windows (door on +z) and a gabled roof
function block(g, race, W, D, F, n = 1, o = {}) {
  const st = STYLE[race] || STYLE.human, P = o.plinth ?? 0.5, mStone = mat(st.stone, 0.95), mDark = mat(st.dark);
  box(g, W + 0.4, P, D + 0.4, race === 'dwarf' ? mat(shade(st.stone, 0.82), 0.95) : race === 'orc' ? mat('#5a5048', 0.95) : mStone, 0, P / 2, 0);
  let y0 = P, w = W, d = D;
  for (let k = 0; k < n; k++) {
    if (k > 0) { if (race === 'human') { w += 0.35; d += 0.35; } else if (race === 'dwarf') { w -= 0.8; d -= 0.6; } }
    const sb = race === 'human' && k === 0 && o.stoneBase, fr = sb ? 'hstone' : race;
    const wm = race === 'human' ? (sb ? mStone : mat(st.wall2, 0.95)) : race === 'highelf' ? mat(st.wall2, 0.7) : race === 'woodelf' ? mat(st.wall2, 0.9) : race === 'orc' ? mat(st.wood) : mStone;
    box(g, w, F, d, wm, 0, y0 + F / 2, 0);
    if (race === 'human' && k > 0) box(g, w + 0.1, 0.22, d + 0.1, mDark, 0, y0 + 0.05, 0);
    const fo = { dw: o.dw, dh: o.dh };
    const fronts = [[0, d / 2, 0, w, k === 0 && o.door !== false ? 'door' : 'win'], [w / 2, 0, Math.PI / 2, d, 'win'], [0, -d / 2, Math.PI, w, 'back'], [-w / 2, 0, -Math.PI / 2, d, 'win']];
    for (const [fx, fz, fry, fw, kind] of fronts) face(sub(g, fx, y0, fz, fry), fr, fw, F, kind, st, fo);
    if (race === 'highelf' && k < n - 1) box(g, w + 0.3, 0.2, d + 0.3, mat(st.trim, 0.4, 0.75), 0, y0 + F, 0);
    y0 += F;
  }
  const rz = !!o.ridgeZ, span = rz ? w : d, len = rz ? d : w;
  const rise = o.rise ?? (race === 'dwarf' ? 1.1 + span * 0.08 : race === 'highelf' ? span * 0.72 : race === 'orc' ? span * 0.62 : span * 0.55);
  const roofC = o.roofC || st.roof, mRoof = mat(roofC, race === 'dwarf' ? 0.7 : race === 'highelf' ? 0.55 : 0.9, race === 'dwarf' ? 0.25 : 0);
  const endM = race === 'human' ? mat(st.wall2, 0.95) : race === 'orc' ? mat(st.wood) : race === 'highelf' ? mat(st.wall2, 0.7) : race === 'woodelf' ? mat(st.wall2, 0.9) : mStone;
  const ridgeM = o.ridgeM || (race === 'highelf' ? mat(st.trim, 0.4, 0.75) : race === 'dwarf' ? IRON() : race === 'woodelf' ? mat(LEAF[1], 0.9) : mDark);
  gable(g, span, len, rise, mRoof, endM, 0, y0, 0, rz ? 0 : Math.PI / 2, race === 'dwarf' ? 0.4 : race === 'orc' ? 0.75 : 0.55, ridgeM, race === 'orc' ? 2 : 3, mat(shade(roofC, 0.72), 0.9));
  for (const sd of [-1, 1]) {
    const e = sub(g, rz ? 0 : sd * len / 2, y0, rz ? sd * len / 2 : 0, rz ? (sd > 0 ? 0 : Math.PI) : sd * Math.PI / 2);
    if (race === 'human') { if (span > 6) { add(e, new THREE.CylinderGeometry(rise * 0.2 + 0.12, rise * 0.2 + 0.12, 0.1, 12), mDark, 0, rise * 0.38, 0.04, Math.PI / 2); add(e, new THREE.CylinderGeometry(rise * 0.2, rise * 0.2, 0.14, 12), GLOW(), 0, rise * 0.38, 0.05, Math.PI / 2); strut(e, 0, rise * 0.62, 0.05, 0, rise - 0.1, 0.05, 0.2, mDark); }
      else strut(e, 0, 0.05, 0.05, 0, rise - 0.1, 0.05, 0.2, mDark);
      box(e, span * 0.5, 0.18, 0.12, mDark, 0, rise * 0.5, 0.05); for (const s2 of [-1, 1]) strut(e, s2 * span * 0.4, 0.1, 0.05, s2 * span * 0.1, rise * 0.48, 0.05, 0.16, mDark); }
    else if (race === 'orc') { const tl = span * 0.16; for (const s2 of [-1, 1]) strut(e, s2 * tl * 0.9, rise - tl * 0.7, 0.3, -s2 * tl * 0.5, rise + tl * 1.1, 0.7, 0.12 * tl + 0.08, BONE(), 'cone'); ball(e, 0.12 * tl + 0.2, BONE(), 0, rise - 0.2, 0.45, 0); }
    else if (race === 'highelf') { cone(e, 0.16, 1.2, mat(st.trim, 0.4, 0.75), 0, rise + 0.7, 0, 6); add(e, new THREE.CylinderGeometry(rise * 0.16, rise * 0.16, 0.12, 10), ELFGLOW(), 0, rise * 0.36, 0.05, Math.PI / 2); }
    else if (race === 'woodelf') ball(e, 0.55, mat(LEAF[2], 0.9), 0, rise, 0.1, 0);
    else { add(e, new THREE.CylinderGeometry(Math.min(0.5, rise * 0.3), Math.min(0.5, rise * 0.3), 0.12, 8), mat(st.trim, 0.4, 0.75), 0, rise * 0.4, 0.05, Math.PI / 2); }
  }
  return { top: y0, rise, w, d };
}
function house(g, race, x, z, rot, s = 1, lvl = 0) {
  const st = STYLE[race] || STYLE.human, y = heightAt(x, z), h = new THREE.Group(); h.position.set(x, y, z); h.rotation.y = rot; h.scale.setScalar(s); g.add(h);
  const R = Math.random, mStone = mat(st.stone, 0.95), mWood = mat(st.wood), mDark = mat(st.dark), mTrim = mat(st.trim, 0.4, 0.75);
  let chim = null;
  if (race === 'human') {
    const n = lvl >= 2 || (lvl === 1 && R() < 0.5) ? 2 : 1;
    const b = block(h, 'human', 5, 4, 2.4, n, { roofC: [st.roof, st.roof2, '#6e3326'][Math.floor(R() * 3)], stoneBase: lvl >= 3, rise: 2.3, ridgeM: lvl >= 3 ? mTrim : null });
    const cx = 1.5, cz = -0.95, ch = b.rise + 1.3; box(h, 0.7, ch, 0.7, mStone, cx, b.top + ch / 2 - 0.2, cz); box(h, 0.86, 0.16, 0.86, mDark, cx, b.top + ch - 0.2, cz); chim = [cx, b.top + ch, cz];
    if (R() < 0.6) barrel(h, -2.95, 1.7, 0.95); if (R() < 0.5) { crate(h, 2.95, 1.6, 0.65, 0, 0.3); if (R() < 0.5) crate(h, 2.9, 1.6, 0.45, 0.65, 0.9); }
    if (lvl >= 1 && R() < 0.5) for (let i = 0; i < 5; i++) { cyl(h, 0.05, 0.05, 0.9, mWood, 3.4, 0.45, -1.8 + i * 0.9, 4); if (i < 4) for (const yy of [0.35, 0.75]) box(h, 0.05, 0.08, 0.9, mWood, 3.4, yy, -1.35 + i * 0.9); }
  } else if (race === 'orc') {
    const r0 = 2.45, wh = 2.0 + (lvl >= 2 ? 0.5 : 0), mHide = mat(R() < 0.5 ? st.roof : '#a8784a', 0.95);
    cyl(h, r0 + 0.4, r0 + 0.55, 0.45, mat('#5a5048', 0.95), 0, 0.22, 0, 9);
    cyl(h, r0, r0 + 0.1, wh, mWood, 0, wh / 2, 0, 9);
    for (let i = 0; i < 12; i++) { const a = (i + 0.5) / 12 * Math.PI * 2; if (Math.abs(angDiff(a, 0)) < 0.35) continue; cyl(h, 0.16, 0.19, wh + 0.4, mDark, Math.sin(a) * (r0 + 0.06), (wh + 0.4) / 2, Math.cos(a) * (r0 + 0.06), 5); }
    cone(h, r0 + 0.95, 3.0, mHide, 0, wh + 1.3, 0, 9); cyl(h, r0 + 0.62, r0 + 0.82, 0.22, mat(st.trim, 0.85), 0, wh + 0.42, 0, 9);
    cyl(h, 0.55, 0.65, 0.3, mDark, 0, wh + 2.55, 0, 7);
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; strut(h, Math.cos(a) * 1.1, wh + 1.9, Math.sin(a) * 1.1, -Math.cos(a) * 0.35, wh + 3.6, -Math.sin(a) * 0.35, 0.07, mDark, 'cyl'); }
    chim = [0, wh + 3.0, 0];
    box(h, 1.1, 1.7, 0.6, mat('#1e120a'), 0, 0.85, r0 - 0.1); box(h, 0.9, 1.1, 0.06, mHide, 0, 1.15, r0 + 0.24);
    for (const sd of [-1, 1]) strut(h, sd * 0.85, 0.1, r0 + 0.35, sd * 0.4, 2.5, r0 + 1.0, 0.17, BONE(), 'cone');
    ball(h, 0.28, BONE(), 0, 2.05, r0 + 0.3, 0); for (const sd of [-1, 1]) box(h, 0.09, 0.09, 0.08, mat('#1a1008'), sd * 0.1, 2.1, r0 + 0.56);
    if (R() < 0.45 || lvl >= 2) totem(h, r0 + 1.0, 1.2, 3 + lvl * 0.4, st);
    if (R() < 0.5) { for (const sd of [-1, 1]) cyl(h, 0.05, 0.05, 1.8, mDark, -r0 - 0.9, 0.9, sd * 0.8, 4); box(h, 0.06, 0.06, 1.8, mDark, -r0 - 0.9, 1.75, 0); const hd = box(h, 0.05, 1.1, 1.3, mat('#b89a6a', 0.95), -r0 - 0.9, 1.15, 0); hd.rotation.z = 0.05; }
    if (lvl >= 3) for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; strut(h, Math.cos(a) * (r0 + 0.2), wh + 0.7, Math.sin(a) * (r0 + 0.2), Math.cos(a) * (r0 + 1.4), wh + 1.4, Math.sin(a) * (r0 + 1.4), 0.12, IRON(), 'cone'); }
  } else if (race === 'highelf') {
    const th = 4.8 + lvl * 1.1, mW = mat(st.wall2, 0.7), mRoof = mat(R() < 0.5 ? st.roof : st.roof2, 0.55);
    cyl(h, 2.15, 2.35, 0.5, mStone, 0, 0.25, 0, 12);
    cyl(h, 1.7, 1.9, th, mW, 0, th / 2 + 0.5, 0, 12);
    cyl(h, 1.97, 1.97, 0.16, mTrim, 0, 0.6, 0, 12); cyl(h, 2.1, 1.85, 0.45, mW, 0, th + 0.6, 0, 12); cyl(h, 2.12, 2.12, 0.14, mTrim, 0, th + 0.86, 0, 12);
    const rh = 4.4 + lvl * 0.5; cone(h, 2.25, rh, mRoof, 0, th + 0.9 + rh / 2, 0, 12); cyl(h, 0.04, 0.04, 1.4, mTrim, 0, th + 0.9 + rh + 0.4, 0, 4); ball(h, 0.14, mTrim, 0, th + 0.9 + rh + 0.2, 0, 0);
    for (let k = 0; k < (lvl >= 2 ? 3 : 2); k++) for (const a of k % 2 ? [-0.8, 0.8, Math.PI] : [0.55, -0.55, Math.PI * 0.75, -Math.PI * 0.75]) { const ww = sub(h, Math.sin(a) * 1.78, 0, Math.cos(a) * 1.78, a); if (k === 0 && Math.abs(a) < 1) continue; win(ww, 0, 2.0 + k * 1.9, 0, 0.42, 0.85, mTrim, ELFGLOW(), null, true, false); }
    const df = sub(h, 0, 0, 1.78, 0); box(df, 1.0, 1.7, 0.2, mat('#3a5a8a', 0.6), 0, 0.5 + 0.85, 0.04); add(df, new THREE.CylinderGeometry(0.5, 0.5, 0.2, 10, 1, false, Math.PI / 2, Math.PI), mat('#3a5a8a', 0.6), 0, 2.2, 0.04, Math.PI / 2); add(df, new THREE.CylinderGeometry(0.64, 0.64, 0.14, 10, 1, false, Math.PI / 2, Math.PI), mTrim, 0, 2.2, 0.0, Math.PI / 2);
    for (const sd of [-1, 1]) box(h, 1.4, 0.2, 0.5, mStone, 0, 0.35 - (sd > 0 ? 0.2 : 0), 2.1 + (sd > 0 ? 0.45 : 0));
    // annex with its own little spire
    const ah = 2.6 + lvl * 0.4; cyl(h, 1.05, 1.15, ah, mW, 1.9, ah / 2 + 0.3, -1.3, 10); cyl(h, 1.2, 1.2, 0.14, mTrim, 1.9, ah + 0.3, -1.3, 10); cone(h, 1.3, 2.4 + lvl * 0.4, mRoof, 1.9, ah + 0.3 + (2.4 + lvl * 0.4) / 2, -1.3, 10);
    win(sub(h, 1.9 + Math.sin(0.9) * 1.07, 0, -1.3 + Math.cos(0.9) * 1.07, 0.9), 0, ah * 0.55, 0, 0.36, 0.7, mTrim, ELFGLOW(), null, true, false);
    if (lvl >= 2) { cyl(h, 2.35, 2.35, 0.16, mW, 0, 0.5 + th * 0.62, 0, 12); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; cyl(h, 0.04, 0.04, 0.6, mTrim, Math.cos(a) * 2.28, 0.5 + th * 0.62 + 0.38, Math.sin(a) * 2.28, 4); } add(h, new THREE.TorusGeometry(2.28, 0.05, 4, 16), mTrim, 0, 0.5 + th * 0.62 + 0.68, 0, Math.PI / 2); }
    if (R() < 0.6) for (const sd of [-1, 1]) { box(h, 0.7, 0.45, 0.7, mStone, sd * 1.6, 0.22, 2.2); ball(h, 0.42, mat(sd > 0 ? '#5a9a4a' : '#6aa84a', 0.9), sd * 1.6, 0.65, 2.2, 0); ball(h, 0.12, mat('#f0e0f8', 0.8), sd * 1.6 + 0.2, 0.95, 2.3, 0); }
  } else if (race === 'woodelf') {
    const ph = 3.0 + lvl * 0.45, top = lvl >= 2 ? ph + 3.0 : ph, mPl = mat(st.dark), mLive = mWood;
    cyl(h, 0.7, 1.15, top + 3.6, mLive, 0, (top + 3.6) / 2, 0, 8);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + 0.3; strut(h, Math.cos(a) * 0.7, 1.1, Math.sin(a) * 0.7, Math.cos(a) * 2.1, -0.1, Math.sin(a) * 2.1, 0.42, mLive, 'cone'); }
    const plat = (py, pr, podR, ang) => {
      cyl(h, pr, pr, 0.22, mPl, 0, py, 0, 10);
      for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.78; strut(h, Math.cos(a) * 0.6, py - 1.5, Math.sin(a) * 0.6, Math.cos(a) * (pr - 0.3), py - 0.1, Math.sin(a) * (pr - 0.3), 0.12, mPl, 'cyl'); }
      for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; if (Math.abs(angDiff(a, Math.PI / 2)) < 0.3) continue; cyl(h, 0.04, 0.04, 0.7, mLive, Math.cos(a) * (pr - 0.1), py + 0.45, Math.sin(a) * (pr - 0.1), 4); }
      add(h, new THREE.TorusGeometry(pr - 0.1, 0.05, 4, 14), mat(lvl >= 3 ? st.trim : st.dark, 0.6, lvl >= 3 ? 0.6 : 0), 0, py + 0.8, 0, Math.PI / 2);
      const pod = sub(h, 0, py, 0, ang); cyl(pod, podR, podR + 0.1, 1.8, mat(st.wall2, 0.9), 0, 1.0, 0, 9); cone(pod, podR + 0.6, 1.5, mat(st.roof, 0.9), 0, 2.6, 0, 9); ball(pod, 0.35, mat(LEAF[1], 0.9), 0, 3.3, 0, 0);
      box(pod, 0.6, 1.2, 0.12, mPl, 0, 0.7, podR + 0.06); for (const a of [1.2, -1.2, Math.PI]) { const ww = sub(pod, Math.sin(a) * (podR + 0.03), 0, Math.cos(a) * (podR + 0.03), a); add(ww, new THREE.CylinderGeometry(0.24, 0.24, 0.1, 8), FAEGLOW(), 0, 1.15, 0.02, Math.PI / 2); }
      for (const a of [0.9, 2.4, 4.2]) { const lx = Math.cos(a) * (pr - 0.2), lz = Math.sin(a) * (pr - 0.2); cyl(h, 0.015, 0.015, 0.7, IRON(), lx, py - 0.35, lz, 3); ball(h, 0.16, FAEGLOW(), lx, py - 0.8, lz, 1); }
    };
    plat(ph, 2.8, 1.65, 0); if (lvl >= 2) plat(top, 2.0, 1.15, 0.9);
    for (let i = 0; i <= Math.floor(ph / 0.45); i++) box(h, 0.7, 0.06, 0.08, mPl, 0, 0.3 + i * 0.45, 2.85 + i * 0.012);
    for (const sd of [-1, 1]) strut(h, sd * 0.33, 0, 2.86, sd * 0.33, ph + 0.4, 2.9, 0.07, mPl);
    ball(h, 2.6 + lvl * 0.15, mat(LEAF[0], 0.9), 0, top + 4.6, 0, 1); ball(h, 1.9, mat(LEAF[1], 0.9), 1.7, top + 3.8, 0.9, 1); ball(h, 1.7, mat(LEAF[2], 0.9), -1.5, top + 4.0, -1.0, 1);
    if (R() < 0.6) for (let i = 0; i < 3; i++) { const mx = -2.4 + i * 0.35, mz = 1.6 + (i % 2) * 0.4; cyl(h, 0.06, 0.08, 0.3, mat('#e8e0c8'), mx, 0.15, mz, 5); cone(h, 0.22, 0.18, mat(i % 2 ? '#c83a2a' : '#d8a040', 0.7), mx, 0.38, mz, 7); }
  } else {
    const b = block(h, 'dwarf', 5.6, 4.6, 2.4, lvl >= 2 ? 2 : 1, { rise: 1.4, ridgeM: lvl >= 3 ? mTrim : null });
    const cx = -1.7, cz = -1.0, ch = b.rise + 1.4; box(h, 1.0, ch, 1.0, mat(shade(st.stone, 0.82), 0.95), cx, b.top + ch / 2 - 0.2, cz); box(h, 0.7, 0.25, 0.7, EMBER(), cx, b.top + ch - 0.12, cz); box(h, 1.2, 0.18, 1.2, IRON(), cx, b.top + ch - 0.32, cz); chim = [cx, b.top + ch, cz];
    if (R() < 0.6) { barrel(h, 3.15, 1.5, 0.95); barrel(h, 3.15, 0.75, 0.95); if (R() < 0.5) barrel(h, 3.15, 1.1, 0.9, 0.82); }
    if (R() < 0.4) { box(h, 1.1, 0.5, 0.7, IRON(), -3.2, 0.55, 1.2); for (const sd of [-1, 1]) cyl(h, 0.18, 0.18, 0.1, mDark, -3.2 + sd * 0.4, 0.2, 1.57, 8); for (let i = 0; i < 3; i++) ball(h, 0.2, mat('#6a6a70', 0.6, 0.5), -3.4 + i * 0.2, 0.9, 1.2, 0); }
  }
  if (chim && (race !== 'orc' || R() < 0.6)) { h.updateMatrixWorld(true); smokeAt(h.localToWorld(V3(...chim))); }
  addCircle(x, z, 2.9 * s, 'house');
}
// storehouse: where peasants and heroes unload wood and stone
function buildStorehouse(g, t) {
  const [x, z] = t.storeSpot, y = heightAt(x, z), s = new THREE.Group(); s.position.set(x, y, z); s.rotation.y = Math.atan2(-t.perp[0], -t.perp[1]); g.add(s);
  const st = STYLE[t.race] || STYLE.human, race = t.race, wood = mat(st.wood), dark = mat(st.dark), roofC = race === 'woodelf' ? LEAF[0] : st.roof;
  box(s, 7.8, 0.3, 4.6, mat(race === 'dwarf' ? shade(st.stone, 0.82) : st.stone, 0.95), 0, 0.15, 0);
  for (const px of [-3.4, 0, 3.4]) for (const pz of [-1.9, 1.9]) {
    if (race === 'highelf') { cyl(s, 0.2, 0.24, 3.4, mat(st.wall2, 0.7), px, 2.0, pz, 8); box(s, 0.5, 0.18, 0.5, mat(st.trim, 0.4, 0.75), px, 3.6, pz); }
    else if (race === 'dwarf') box(s, 0.5, 3.4, 0.5, mat(st.stone, 0.95), px, 2.0, pz);
    else cyl(s, 0.17, 0.2, 3.4, race === 'woodelf' ? wood : dark, px, 2.0, pz, 6);
    if (pz > 0 && px !== 0) for (const sd of [-1, 1]) if (Math.abs(px + sd * 1.0) < 3.6) strut(s, px, 2.7, pz, px + sd * 0.9, 3.55, pz, 0.12, dark);
  }
  for (const pz of [-1.9, 1.9]) box(s, 7.3, 0.26, 0.26, dark, 0, 3.7, pz);
  for (const px of [-3.4, 0, 3.4]) box(s, 0.2, 0.2, 4.0, dark, px, 3.7, 0);
  gable(s, 4.4, 7.3, 1.6, mat(roofC, race === 'dwarf' ? 0.7 : 0.9, race === 'dwarf' ? 0.25 : 0), null, 0, 3.8, 0, Math.PI / 2, 0.5, race === 'highelf' ? mat(st.trim, 0.4, 0.75) : dark, 3, mat(shade(roofC, 0.72), 0.9));
  box(s, 7.0, 3.3, 0.18, wood, 0, 1.95, -1.95); for (let i = 0; i < 8; i++) box(s, 0.1, 3.3, 0.08, dark, -3.1 + i * 0.885, 1.95, -1.84);
  const mLog = mat('#8a6238'), mEnd = mat('#c89a60', 0.9);
  for (let i = 0; i < 12; i++) { const ly = 0.52 + Math.floor(i / 4) * 0.4, lz = -1.3 + (i % 4) * 0.42 + (Math.floor(i / 4) % 2) * 0.2; if (Math.floor(i / 4) === 2 && i % 4 === 3) continue; add(s, new THREE.CylinderGeometry(0.21, 0.21, 2.6, 7), mLog, -1.8, ly, lz, 0, 0, Math.PI / 2); for (const sd of [-1, 1]) add(s, new THREE.CylinderGeometry(0.17, 0.17, 0.04, 7), mEnd, -1.8 + sd * 1.3, ly, lz, 0, 0, Math.PI / 2); }
  for (let i = 0; i < 7; i++) ball(s, 0.38 + (i % 3) * 0.08, mat('#8a847a', 0.95), 1.4 + (i % 3) * 0.6, 0.6 + (i > 3 ? 0.5 : 0), -1.0 + Math.floor(i / 3) * 0.55, 0);
  for (let i = 0; i < 3; i++) box(s, 0.8, 0.45, 0.55, mat(shade(st.stone, 1.1), 0.95), 2.4 + (i % 2) * 0.3, 0.52 + i * 0.45, 1.3, i * 0.2);
  crate(s, -3.0, 1.2, 0.7, 0.3, 0.2); crate(s, -3.0, 1.2, 0.5, 1.0, 0.7); barrel(s, -2.2, 1.5, 0.9, 0.3);
  for (let i = 0; i < 3; i++) { const sk = ball(s, 0.32, mat('#c8b080', 0.95), 0.4 + i * 0.5, 0.58, 1.4 - (i % 2) * 0.2, 1); sk.scale.set(1, 0.75, 0.85); }
  for (const sd of [-1, 1]) cyl(s, 0.02, 0.02, 0.5, IRON(), sd * 1.1, 3.35, 2.0, 3);
  box(s, 2.6, 0.8, 0.1, mat('#6a4a2a'), 0, 2.85, 2.0); box(s, 2.75, 0.95, 0.06, mat(st.trim, 0.5, 0.6), 0, 2.85, 1.96);
  addBox(x - t.perp[0] * 1.6, z - t.perp[1] * 1.6, 3.6, 0.3, Math.atan2(-t.perp[0], -t.perp[1]), 'house');
}
// the Master Builder's yard: plans table, planks and cut stone
function buildYard(g, t) {
  const [x, z] = t.yardSpot, y = heightAt(x, z), s = new THREE.Group(); s.position.set(x, y, z); s.rotation.y = Math.atan2(t.perp[0], t.perp[1]); g.add(s);
  const st = STYLE[t.race] || STYLE.human;
  box(s, 2.2, 0.12, 1.2, mat('#7a5a3a'), 0, 1.0, 1.2); for (const [px, pz] of [[-1, 0.7], [1, 0.7], [-1, 1.7], [1, 1.7]]) cyl(s, 0.06, 0.06, 1, mat('#4a3020'), px, 0.5, pz, 5);
  box(s, 1.4, 0.02, 0.9, mat('#e8dcb0'), 0, 1.08, 1.2);
  for (let i = 0; i < 6; i++) box(s, 3.2, 0.14, 0.35, mat('#9a7650'), -1.2, 0.08 + i * 0.15, -0.8 + (i % 2) * 0.05);
  for (let i = 0; i < 6; i++) box(s, 0.8, 0.5, 0.6, mat(st.stone, 0.95), 1.4 + (i % 2) * 0.85, 0.25 + Math.floor(i / 4) * 0.5, -1.2 + (Math.floor(i / 2) % 2) * 0.7);
  // sawhorse with a half-cut beam, a hoist, tools and a barrel of nails
  { const mW = mat('#6a4a2a'); for (const sx of [-0.6, 0.6]) for (const sd of [-1, 1]) strut(s, -2.6 + sx, 0, 0.3 + sd * 0.35, -2.6 + sx, 0.8, 0.3, 0.08, mW); box(s, 1.6, 0.08, 0.12, mW, -2.6, 0.8, 0.3); box(s, 2.6, 0.22, 0.22, mat('#9a7650'), -2.4, 0.95, 0.3); box(s, 0.02, 0.4, 0.5, IRON(), -2.0, 1.15, 0.3); }
  { const mW = mat('#5a3a22'); for (const sd of [-1, 1]) strut(s, 2.2 + sd * 0.9, 0, -2.4, 2.2, 3.6, -2.0, 0.12, mW); strut(s, 2.2, 0, -1.0, 2.2, 3.6, -2.0, 0.12, mW); box(s, 0.4, 0.4, 0.4, mW, 2.2, 3.55, -2.0); cyl(s, 0.015, 0.015, 2.2, mat('#c8b080'), 2.2, 2.4, -1.6, 3); box(s, 0.5, 0.35, 0.4, mat(st.stone, 0.95), 2.2, 1.2, -1.6); }
  barrel(s, -0.9, 2.1, 0.8); crate(s, 0.9, 2.2, 0.55, 0, 0.4);
  for (let i = 0; i < 3; i++) strut(s, -1.6 + i * 0.25, 0, 2.3, -1.5 + i * 0.25, 1.4, 2.6, 0.05, mat('#7a5a3a'), 'cyl');
  cyl(s, 0.08, 0.1, 5, mat('#4a3020'), 2.6, 2.5, 1.6, 5); const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), mat(TEAM_COLORS[t.team], 0.9, 0, { side: THREE.DoubleSide })); fl.position.set(3.2, 4.6, 1.6); s.add(fl);
  addCircle(x, z, 2.2, 'house');
}
// what a town gains with each upgrade: plaza, market, smithy, temple, keep, lamps and statues
function townExtras(g, t, lvl) {
  const st = STYLE[t.race] || STYLE.human, ag = Math.atan2(t.dir[1], t.dir[0]);
  const polar = (a, r) => [t.x + Math.cos(ag + a) * r, t.z + Math.sin(ag + a) * r];
  const place = (x, z, rot) => { const s = new THREE.Group(); s.position.set(x, heightAt(x, z), z); s.rotation.y = rot; g.add(s); return s; };
  const face = (x, z) => Math.atan2(t.x - x, t.z - z);
  const race = t.race, mDark = mat(st.dark), mStone = mat(st.stone, 0.95), mWood = mat(st.wood), mTrim = mat(st.trim, 0.4, 0.75), mTeam = mat(TEAM_COLORS[t.team], 0.9, 0, { side: THREE.DoubleSide });
  const smokeOf = (s, x, y, z) => { s.updateMatrixWorld(true); smokeAt(s.localToWorld(V3(x, y, z))); };
  // the village well (a fire pit for orcs, a moonwell for wood elves) from the start
  { const [x, z] = polar(-Math.PI * 0.8, 12.5), s = place(x, z, face(x, z));
    if (race === 'orc') { for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; ball(s, 0.32, mat('#5a5048', 0.95), Math.cos(a) * 1.1, 0.15, Math.sin(a) * 1.1, 0); } ball(s, 0.55, EMBER(), 0, 0.2, 0, 1); for (let i = 0; i < 3; i++) strut(s, Math.cos(i * 2.1) * 0.8, 0, Math.sin(i * 2.1) * 0.8, 0, 0.6, 0, 0.1, mDark, 'cyl');
      for (const sd of [-1, 1]) { strut(s, sd * 1.4, 0, 0, sd * 1.4, 1.5, 0, 0.07, mDark, 'cyl'); } box(s, 2.9, 0.07, 0.07, mDark, 0, 1.45, 0); ball(s, 0.35, mat('#8a4a2a', 0.8), 0, 1.15, 0, 0); smokeOf(s, 0, 1.5, 0); }
    else if (race === 'woodelf') { const ring = mat('#6a7a5a', 0.95); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; box(s, 0.6, 0.45 + (i % 3) * 0.12, 0.45, ring, Math.cos(a) * 1.25, 0.25, Math.sin(a) * 1.25, -a); } cyl(s, 1.1, 1.1, 0.1, mat('#b0f4ff', 0.2, 0, { emissive: '#40c0ff', emissiveIntensity: 1.1 }), 0, 0.3, 0, 12);
      for (const sd of [-1, 1]) strut(s, sd * 1.4, 0, 0, sd * 0.2, 3.0, 0, 0.18, mWood, 'cone'); ball(s, 0.6, mat(LEAF[1], 0.9), 0, 2.9, 0, 0); lantern(s, 0, 2.2, 0, FAEGLOW()); }
    else { const ws = race === 'dwarf' ? mat(shade(st.stone, 0.82), 0.95) : race === 'highelf' ? mat(st.wall2, 0.7) : mStone; cyl(s, 1.0, 1.1, 0.95, ws, 0, 0.47, 0, 12); cyl(s, 1.08, 1.08, 0.12, race === 'highelf' ? mTrim : mat(shade(st.stone, 1.15), 0.95), 0, 0.95, 0, 12); cyl(s, 0.85, 0.85, 0.05, mat('#1e3a4a', 0.2), 0, 0.85, 0, 12);
      for (const sd of [-1, 1]) box(s, 0.16, 2.2, 0.16, race === 'dwarf' ? IRON() : mDark, sd * 0.95, 1.1, 0); add(s, new THREE.CylinderGeometry(0.07, 0.07, 2.0, 5), mDark, 0, 1.75, 0, 0, 0, Math.PI / 2);
      gable(s, 1.6, 2.4, 0.8, mat(race === 'highelf' ? st.roof : st.roof, 0.85), null, 0, 2.15, 0, Math.PI / 2, 0.15, race === 'highelf' ? mTrim : mDark); cyl(s, 0.015, 0.015, 0.8, mat('#c8b080'), 0.3, 1.35, 0, 3); cyl(s, 0.16, 0.13, 0.25, mat('#7a5232'), 0.3, 0.9, 0, 7); barrel(s, 1.5, 0.6, 0.8); }
    addCircle(x, z, 1.3, 'house'); }
  if (lvl >= 1) {
    // stone plaza around the hall
    const pz = place(t.x, t.z, 0); cyl(pz, 13 + lvl * 1.5, 13 + lvl * 1.5, 0.12, mat(lvl >= 2 ? '#a8a294' : '#8a7a62', 0.95), 0, 0.02, 0, 32); cyl(pz, 13.3 + lvl * 1.5, 13.3 + lvl * 1.5, 0.08, mat(lvl >= 2 ? '#8a8476' : '#6e624e', 0.95), 0, 0.0, 0, 32);
    // market stalls either side of the road to the hall: striped awnings, crates, barrels and wares
    for (const sd of [-1, 1]) for (let k = 0; k < 2; k++) { const [x, z] = polar(sd * (0.42 + k * 0.28), 15); const s = place(x, z, face(x, z)), c = ['#c83a2a', '#e0c040', '#3a7ac8', '#3aa04a'][(k + (sd > 0 ? 2 : 0)) % 4];
      for (const [px, pz2] of [[-1.2, -0.8], [1.2, -0.8], [-1.2, 0.8], [1.2, 0.8]]) cyl(s, 0.06, 0.06, pz2 < 0 ? 2.55 : 2.1, mDark, px, pz2 < 0 ? 1.27 : 1.05, pz2, 5);
      const aw = sub(s, 0, 2.32, 0); aw.rotation.x = 0.24; for (let i = 0; i < 5; i++) box(aw, 0.58, 0.06, 2.15, mat(i % 2 ? '#f0e8d8' : c, 0.9), -1.16 + i * 0.58, 0, 0); for (let i = 0; i < 5; i++) { const fl = cone(aw, 0.29, 0.3, mat(i % 2 ? '#f0e8d8' : c, 0.9), -1.16 + i * 0.58, -0.15, 1.1, 3); fl.rotation.x = Math.PI; }
      box(s, 2.4, 0.85, 0.9, mWood, 0, 0.42, 0.3); box(s, 2.5, 0.08, 1.0, mDark, 0, 0.88, 0.3);
      const ware = [['#e04030', '#f0c040', '#80c040', '#c08040'], ['#d8c8a0', '#b89a6a', '#e8dcc0', '#c8b080'], ['#8a8a92', '#a0a0a8', '#7a7a82', '#c89a40'], ['#a04a8a', '#4a7ac8', '#c83a2a', '#e0c040']][(k + (sd > 0 ? 2 : 0)) % 4];
      for (let i = 0; i < 4; i++) { ball(s, 0.15, mat(ware[i], 0.7), -0.85 + i * 0.55, 1.05, 0.15, 0); ball(s, 0.13, mat(ware[(i + 1) % 4], 0.7), -0.6 + i * 0.55, 1.03, 0.5, 0); }
      crate(s, -0.8, -0.5, 0.6, 0, 0.3); barrel(s, 0.7, -0.5, 0.85); if (k) crate(s, -0.8, -0.5, 0.42, 0.6, 0.8);
      addCircle(x, z, 1.3, 'house'); }
    // smithy with a glowing forge under a lean-to, anvil, quench barrel and a smoking chimney
    { const [x, z] = polar(-Math.PI * 0.55, 16); t.houses.push([x, z]); const s = place(x, z, face(x, z));
      const b = block(s, race, 5, 4, 2.6, 1, { door: false, rise: race === 'dwarf' ? 1.3 : 1.9 });
      const lt = sub(s, 0, b.top - 0.15, 2.0); lt.rotation.x = 0.42; box(lt, 5.3, 0.14, 1.9, mat(race === 'woodelf' ? LEAF[0] : st.roof, 0.9), 0, 0, 0.9); for (const sd of [-1, 0.33, 1]) box(s, 0.2, b.top - 0.8, 0.2, mDark, sd * 2.4, (b.top - 0.8) / 2, 3.65);
      box(s, 1.3, 0.85, 1.1, mat(shade(st.stone, 0.8), 0.95), -1.2, 0.42, 2.8); box(s, 1.0, 0.12, 0.8, EMBER(), -1.2, 0.88, 2.8); box(s, 0.5, 1.6, 0.5, mat(shade(st.stone, 0.8), 0.95), -1.2, 1.6, 2.4);
      box(s, 0.3, 0.55, 0.3, IRON(), 0.9, 0.27, 2.9); box(s, 0.8, 0.22, 0.32, IRON(), 0.9, 0.65, 2.9); cone(s, 0.12, 0.35, IRON(), 1.4, 0.65, 2.9, 4); barrel(s, 1.9, 2.5, 0.85); cyl(s, 0.3, 0.3, 0.05, mat('#2a3a4a', 0.2), 1.9, 0.86, 2.5, 8);
      for (let i = 0; i < 3; i++) { const sw = strut(s, -2.4, 0.1, 1.0 - i * 0.5, -2.55, 1.6, 1.0 - i * 0.5, 0.08, IRON()); sw.scale.x = 0.6; } box(s, 0.08, 0.08, 1.6, mDark, -2.55, 1.35, 0.5);
      const ch = b.top + b.rise + 1.6; box(s, 0.95, ch, 0.95, mat(shade(st.stone, 0.85), 0.95), 1.6, ch / 2, -1); box(s, 1.1, 0.2, 1.1, race === 'dwarf' ? IRON() : mDark, 1.6, ch, -1); box(s, 0.6, 0.12, 0.6, EMBER(), 1.6, ch + 0.08, -1);
      addBox(x, z, 2.6, 2.1, face(x, z), 'house'); smokeOf(s, 1.6, ch + 0.4, -1); }
  }
  if (lvl >= 2) {
    // temple behind the hall, in the race's own faith
    const [x, z] = polar(Math.PI, 16.5); t.houses.push([x, z]); const s = place(x, z, face(x, z));
    if (race === 'human') { const b = block(s, 'human', 7, 5, 3.4, 1, { stoneBase: true, rise: 3.0, dw: 1.3, dh: 2.4 }); const tw = sub(s, 0, 0, 2.6);
      box(tw, 2.0, b.top + 3.8, 1.6, mStone, 0, (b.top + 3.8) / 2, 0); box(tw, 2.2, 0.2, 1.8, mat(shade(st.stone, 1.18)), 0, b.top + 3.8, 0); for (const sd of [-1, 1]) box(tw, 0.25, 1.6, 1.7, mStone, sd * 0.88, b.top + 4.7, 0); box(tw, 2.0, 0.25, 1.6, mStone, 0, b.top + 5.6, 0);
      cyl(tw, 0.42, 0.55, 0.7, mTrim, 0, b.top + 4.6, 0, 8); cone(tw, 1.5, 4.5, mat(st.roof, 0.85), 0, b.top + 5.7 + 2.25, 0, 4, Math.PI / 4); cyl(tw, 0.04, 0.04, 1.2, mTrim, 0, b.top + 10.4, 0, 4); box(tw, 0.6, 0.06, 0.06, mTrim, 0, b.top + 10.6, 0);
      win(tw, 0, b.top + 2.2, 0.81, 0.6, 1.1, mat(shade(st.stone, 1.18)), GLOW(), null, true, false); }
    else if (race === 'orc') { block(s, 'orc', 7, 5, 3.0, 1, { door: true, dw: 1.6, dh: 2.4 }); const sk = sub(s, 0, 4.4, 3.2); ball(sk, 1.0, BONE(), 0, 0, 0, 1); for (const sd of [-1, 1]) { box(sk, 0.3, 0.3, 0.2, mat('#1a1008'), sd * 0.35, 0.1, 0.85); strut(sk, sd * 0.8, 0.3, 0, sd * 2.2, 1.8, 0.4, 0.3, BONE(), 'cone'); } box(sk, 0.7, 0.3, 0.6, BONE(), 0, -0.75, 0.5);
      for (const sd of [-1, 1]) { const b2 = sub(s, sd * 2.6, 0, 3.6); cyl(b2, 0.3, 0.4, 1.0, IRON(), 0, 0.5, 0, 7); ball(b2, 0.45, EMBER(), 0, 1.1, 0, 1); } smokeOf(s, 0, 7, 0); }
    else if (race === 'highelf') { cyl(s, 3.4, 3.6, 0.6, mStone, 0, 0.3, 0, 16); cyl(s, 3.45, 3.45, 0.1, mTrim, 0, 0.62, 0, 16);
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; cyl(s, 0.22, 0.26, 3.6, mat(st.wall2, 0.7), Math.cos(a) * 2.9, 2.4, Math.sin(a) * 2.9, 8); box(s, 0.55, 0.2, 0.55, mTrim, Math.cos(a) * 2.9, 4.25, Math.sin(a) * 2.9); }
      cyl(s, 3.3, 3.3, 0.5, mat(st.wall2, 0.7), 0, 4.6, 0, 16); cyl(s, 3.35, 3.35, 0.12, mTrim, 0, 4.85, 0, 16); add(s, new THREE.SphereGeometry(3.0, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(lvl >= 3 ? st.trim : st.roof, 0.5, lvl >= 3 ? 0.6 : 0), 0, 4.85, 0);
      cone(s, 0.2, 1.6, mTrim, 0, 8.6, 0, 6); cyl(s, 0.9, 1.1, 1.0, mat(st.wall2, 0.7), 0, 1.1, 0, 10); add(s, new THREE.OctahedronGeometry(0.7, 0), ELFGLOW(), 0, 2.5, 0); }
    else if (race === 'woodelf') { const mSt = mat('#7a8070', 0.95); for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + 0.2; box(s, 0.8, 2.2 + (i % 2) * 0.6, 0.5, mSt, Math.cos(a) * 3.0, 1.1 + (i % 2) * 0.3, Math.sin(a) * 3.0, -a + Math.PI / 2); box(s, 0.3, 0.6, 0.1, FAEGLOW(), Math.cos(a) * 2.74, 1.6, Math.sin(a) * 2.74, -a + Math.PI / 2); }
      cyl(s, 1.3, 1.3, 0.12, mat('#b0f4ff', 0.2, 0, { emissive: '#40c0ff', emissiveIntensity: 1.1 }), 0, 0.1, 0, 12); cyl(s, 0.9, 1.5, 7, mWood, 0, 3.5, -1.6, 8); for (const [bx, by, bz, r] of [[0, 8.2, -1.6, 3.2], [1.9, 7.2, -0.6, 2.0], [-1.9, 7.4, -1.2, 2.2]]) ball(s, r, mat(LEAF[Math.round(r) % 3], 0.9), bx, by, bz, 1);
      for (const a of [0.6, 2.1, 3.6, 5.0]) { const lx = Math.cos(a) * 2.4, lz = -1.6 + Math.sin(a) * 2.4; cyl(s, 0.015, 0.015, 1.0, IRON(), lx, 5.6, lz, 3); ball(s, 0.2, FAEGLOW(), lx, 5.0, lz, 1); } }
    else { const b = block(s, 'dwarf', 7, 5, 3.4, 1, { rise: 1.6, dw: 1.6, dh: 2.6 }); for (const sd of [-1, 1]) { const b2 = sub(s, sd * 2.4, 0, 3.4); box(b2, 0.7, 1.0, 0.7, mat(shade(st.stone, 0.82), 0.95), 0, 0.5, 0); cyl(b2, 0.45, 0.3, 0.35, IRON(), 0, 1.15, 0, 8); ball(b2, 0.32, EMBER(), 0, 1.4, 0, 1); }
      const an = sub(s, 0, b.top + b.rise + 0.4, 0); box(an, 0.8, 0.6, 0.6, mTrim, 0, 0.3, 0); box(an, 1.8, 0.45, 0.7, mTrim, 0, 0.85, 0); cone(an, 0.3, 0.7, mTrim, 1.2, 0.85, 0, 6).rotation.z = -Math.PI / 2; }
    addBox(x, z, 3.6, 2.8, face(x, z), 'house');
  }
  if (lvl >= 3) {
    // a tall keep tower beside the hall, statues by the road
    const [x, z] = polar(Math.PI * 0.8, 11); const s = place(x, z, face(x, z));
    if (race === 'orc') { for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; strut(s, Math.cos(a) * 2.6, 0, Math.sin(a) * 2.6, Math.cos(a) * 1.9, 17, Math.sin(a) * 1.9, 0.32, mWood, 'cyl'); } for (let k = 0; k < 4; k++) cyl(s, 2.5 - k * 0.15, 2.55 - k * 0.15, 0.3, mDark, 0, 3 + k * 4, 0, 8);
      box(s, 5.2, 0.5, 5.2, mWood, 0, 17, 0); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; cyl(s, 0.16, 0.16, 1.6, mWood, Math.cos(a) * 2.4, 18, Math.sin(a) * 2.4, 5); cone(s, 0.17, 0.7, mDark, Math.cos(a) * 2.4, 19.15, Math.sin(a) * 2.4, 5); } cone(s, 3.4, 3.5, mat(st.roof, 0.95), 0, 21.6, 0, 8); ball(s, 0.6, BONE(), 0, 23.6, 0, 1); for (const sd of [-1, 1]) strut(s, sd * 0.3, 23.6, 0, sd * 1.6, 25.2, 0, 0.25, BONE(), 'cone'); }
    else if (race === 'woodelf') { cyl(s, 1.6, 2.6, 22, mWood, 0, 11, 0, 9); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; strut(s, Math.cos(a) * 1.8, 2, Math.sin(a) * 1.8, Math.cos(a) * 3.6, -0.2, Math.sin(a) * 3.6, 0.7, mWood, 'cone'); }
      for (const [py, pr] of [[9, 3.6], [16, 3.0]]) { cyl(s, pr, pr, 0.3, mDark, 0, py, 0, 12); add(s, new THREE.TorusGeometry(pr - 0.1, 0.06, 4, 16), mTrim, 0, py + 0.8, 0, Math.PI / 2); for (const a of [0.5, 2.6, 4.4]) ball(s, 0.2, FAEGLOW(), Math.cos(a) * (pr - 0.3), py - 0.6, Math.sin(a) * (pr - 0.3), 1); }
      for (const [bx, by, bz, r] of [[0, 24, 0, 5], [3, 21, 1, 3], [-3, 21.5, -1, 3.2], [0.5, 19.5, -3, 2.8]]) ball(s, r, mat(LEAF[Math.round(r) % 3], 0.9), bx, by, bz, 1); }
    else { const tc = race === 'highelf' ? mat(st.wall2, 0.7) : mStone, rad = race === 'dwarf' ? 3.0 : race === 'highelf' ? 2.0 : 2.4, hh = race === 'highelf' ? 22 : race === 'dwarf' ? 15 : 19, seg = race === 'dwarf' ? 8 : 12;
      cyl(s, rad, rad + 0.4, hh, tc, 0, hh / 2, 0, seg); cyl(s, rad + 0.45, rad + 0.45, 0.6, mTrim, 0, hh * 0.55, 0, seg); cyl(s, rad + 0.55, rad + 0.1, 1.0, tc, 0, hh + 0.2, 0, seg);
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; box(s, 0.7, 0.8, 0.5, tc, Math.cos(a) * (rad + 0.3), hh + 1.1, Math.sin(a) * (rad + 0.3), -a); }
      for (let k = 0; k < 3; k++) for (const a of [0, 2.1, 4.2]) { const aa = a + k * 1.05; win(sub(s, Math.sin(aa) * (rad + 0.15 - k * 0.1), 0, Math.cos(aa) * (rad + 0.15 - k * 0.1), aa), 0, 4 + k * hh * 0.28, 0, 0.45, 1.0, race === 'highelf' ? mTrim : mDark, race === 'highelf' ? ELFGLOW() : GLOW(), null, true, false); }
      if (race === 'dwarf') { cyl(s, 1.0, 1.2, 1.0, IRON(), 0, hh + 1.0, 0, 8); ball(s, 0.9, EMBER(), 0, hh + 1.6, 0, 1); smokeOf(s, 0, hh + 2.5, 0); }
      else cone(s, rad + 0.7, race === 'highelf' ? 8 : 5.5, mat(st.roof, 0.6), 0, hh + 1.5 + (race === 'highelf' ? 4 : 2.75), 0, seg); }
    const fh = race === 'orc' ? 25 : race === 'woodelf' ? 28 : race === 'highelf' ? 33 : race === 'dwarf' ? 17.5 : 26.5;
    cyl(s, 0.08, 0.08, 4, mat('#4a3020'), 0, fh - 0.5, 0, 5); const fl = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), mTeam); fl.position.set(1.4, fh + 0.6, 0); s.add(fl);
    addCircle(x, z, 2.9, 'house');
    for (const sd of [-1, 1]) { const [sx, sz] = polar(sd * 0.22, 26); const q = place(sx, sz, face(sx, sz)); box(q, 1.8, 0.4, 1.8, mStone, 0, 0.2, 0); box(q, 1.4, 1.0, 1.4, mStone, 0, 0.9, 0); box(q, 1.6, 0.15, 1.6, mTrim, 0, 1.45, 0);
      const fig = sub(q, 0, 1.5, 0), mG = mat(st.trim, 0.35, 0.85); cyl(fig, 0.32, 0.48, 1.7, mG, 0, 0.85, 0, 8); ball(fig, 0.3, mG, 0, 2.0, 0, 1); cyl(fig, 0.38, 0.3, 0.5, mG, 0, 1.6, 0, 8);
      add(fig, new THREE.CylinderGeometry(0.42, 0.42, 0.08, 10), mG, sd * 0.45, 1.2, 0.25, 0, 0, Math.PI / 2); box(fig, 0.08, 1.5, 0.08, mG, -sd * 0.4, 1.4, 0.3); box(fig, 0.35, 0.06, 0.08, mG, -sd * 0.4, 0.75, 0.3); addCircle(sx, sz, 0.9, 'house'); }
  }
  // lamp posts round the plaza, in the race's style
  if (lvl >= 1) for (let k = 0; k < 4 + lvl * 2; k++) { const a = (k / (4 + lvl * 2)) * Math.PI * 2 + 0.3; if (Math.abs(angDiff(a, 0)) < 0.35) continue; const [x, z] = polar(a, 9.5); const s = place(x, z, face(x, z));
    if (race === 'orc') { cyl(s, 0.09, 0.12, 2.8, mDark, 0, 1.4, 0, 5); cyl(s, 0.28, 0.16, 0.35, IRON(), 0, 2.9, 0, 6); ball(s, 0.26, EMBER(), 0, 3.15, 0, 1); ball(s, 0.2, BONE(), 0, 2.3, 0.12, 0); }
    else if (race === 'highelf') { cyl(s, 0.08, 0.12, 3.0, mat(st.wall2, 0.7), 0, 1.5, 0, 8); cyl(s, 0.2, 0.2, 0.1, mTrim, 0, 3.0, 0, 8); add(s, new THREE.OctahedronGeometry(0.26, 0), ELFGLOW(), 0, 3.35, 0); }
    else if (race === 'woodelf') { strut(s, 0, 0, 0, 0.25, 2.2, 0, 0.1, mWood, 'cyl'); strut(s, 0.25, 2.2, 0, -0.35, 3.0, 0, 0.07, mWood, 'cyl'); ball(s, 0.22, FAEGLOW(), -0.4, 2.75, 0, 1); ball(s, 0.3, mat(LEAF[1], 0.9), -0.35, 3.05, 0, 0); }
    else { cyl(s, 0.07, 0.09, 3, mat('#2a2a2e', 0.5, 0.7), 0, 1.5, 0, 6); box(s, 0.7, 0.06, 0.06, mat('#2a2a2e', 0.5, 0.7), 0.3, 2.95, 0); lantern(s, 0.55, 2.65, 0); } }
}
function buildInner(t, lvl) {
  const g = new THREE.Group(), n = TOWN_LEVELS[lvl].houses;
  // houses on a ring, leaving the road from the gate to the hall clear
  const ag = Math.atan2(t.dir[1], t.dir[0]);
  const at = (along, lat) => [t.x + t.dir[0] * along + t.perp[0] * lat, t.z + t.dir[1] * along + t.perp[1] * lat];
  t.storeSpot = at(21, 12.5); t.store = at(21, 6.5); t.foremanSpot = at(15.5, 8.5); t.builderSpot = at(15.5, -8.5); t.yardSpot = at(21, -12.5);
  t.houses = [t.storeSpot, t.yardSpot];
  buildStorehouse(g, t); buildYard(g, t);
  let placed = 0;
  for (let k = 0; placed < n && k < 40; k++) {
    const ring = k % 2 ? 29 : 22, a = ag + 0.75 + (k * 0.55) % (Math.PI * 2 - 1.5);
    const x = t.x + Math.cos(a) * ring, z = t.z + Math.sin(a) * ring;
    if (Math.abs(angDiff(a, ag)) < 0.55) continue;
    if (t.houses.some(h => Math.hypot(h[0] - x, h[1] - z) < 8)) continue;
    t.houses.push([x, z]);
    house(g, t.race, x, z, Math.atan2(t.x - x, t.z - z), (0.95 + (k % 3) * 0.06) * (1 + lvl * 0.1), lvl); placed++;
  }
  townExtras(g, t, lvl);
  // barracks / training yard
  { const a = ag + Math.PI * 0.55, x = t.x + Math.cos(a) * 16, z = t.z + Math.sin(a) * 16; t.barracks = [x, z]; const st = STYLE[t.race]; const y = heightAt(x, z); const b = new THREE.Group(); b.position.set(x, y, z); b.rotation.y = Math.atan2(t.x - x, t.z - z); g.add(b);
    box(b, 7, 3.2, 5, mat(t.race === 'highelf' ? st.wall2 : st.stone, 0.95), 0, 1.6, 0); const r = cone(b, 5.4, 2.4, mat(st.roof, 0.85), 0, 4.4, 0, 4, Math.PI / 4); r.scale.set(1.3, 1, 0.9);
    for (const xx of [-2.5, 2.5]) { cyl(b, 0.08, 0.08, 4, mat('#4a3020'), xx, 2, -3.4, 5); } const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1), mat(TEAM_COLORS[t.team], 0.9, 0, { side: THREE.DoubleSide })); fl.position.set(-2.5 + 0.7, 3.4, -3.4); b.add(fl);
    addBox(x, z, 3.6, 2.6, Math.atan2(t.x - x, t.z - z), 'house'); }
  return g;
}

// ---------- structures: town hall and archer towers ----------
let structId = 90000;
class Structure {
  constructor(town, kind, x, z) {
    this.id = structId++; this.isStruct = true; this.kind = kind; this.town = town; this.team = town.team;
    this.pos = V3(x, heightAt(x, z), z); this.yaw = 0; this.level = 0; this.lv = 1;
    this.status = { frozen: 0, stun: 0, slow: 0, bleed: 0, bleedDps: 0, burn: 0, burnDps: 0, knock: V3(0, 0, 0) };
    this.dead = false; this.hostile = town.team !== B.myTeam; this.provoked = false; this.state = 'idle'; this.atkCd = 1;
    this.radius = kind === 'hall' ? 7 : 2.6; this.height = kind === 'hall' ? 12 : 13;
    this.def = { name: '', aggro: 1, boss: false, elite: kind === 'hall', skin: false, loot: null, size: 1, shape: 'struct' };
    this.col = addCircle(x, z, kind === 'hall' ? 6.4 : 2.4, 'struct');
    this.root = new THREE.Group(); G.scene.add(this.root);
    this.setLevel(0, true);
  }
  get name() { return this.kind === 'hall' ? `${this.town.name} Hall` : TOWER_LEVELS[this.level].name; }
  get range() { return this.kind === 'hall' ? 22 : TOWER_LEVELS[this.level].range; }
  dist2(p) { const dx = p.x - this.pos.x, dz = p.z - this.pos.z; return dx * dx + dz * dz; }
  setLevel(l, fresh) {
    this.level = l;
    const max = this.kind === 'hall' ? TOWN_LEVELS[l].hall : TOWER_LEVELS[l].hp;
    const frac = fresh ? 1 : this.hp / this.maxHp; this.maxHp = max; this.hp = Math.round(max * frac);
    this.lv = this.kind === 'hall' ? 5 + l * 5 : 4 + l * 6;
    this.build();
  }
  build() {
    for (const c of [...this.root.children]) this.root.remove(c);
    const t = this.town, st = STYLE[t.race] || STYLE.human, g = new THREE.Group(), l = this.level;
    const mStone = mat(st.stone, 0.95), mWood = mat(st.wood), mRoof = mat(st.roof, 0.8), mTrim = mat(st.trim, 0.5, 0.6), mTeam = mat(TEAM_COLORS[t.team], 0.9, 0, { side: THREE.DoubleSide });
    if (this.kind === 'tower') {
      const H = 10 + l * 1.5;
      if (t.race === 'orc') { for (const [mx, mz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(g, 0.25, 0.3, H, mWood, mx * 1.5, H / 2, mz * 1.5, 6); box(g, 4.2, 0.4, 4.2, mWood, 0, H, 0); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; cyl(g, 0.16, 0.16, 1.6, mWood, Math.cos(a) * 2, H + 0.8, Math.sin(a) * 2, 5); cone(g, 0.17, 0.6, mat(st.dark), Math.cos(a) * 2, H + 1.9, Math.sin(a) * 2, 5); } for (let k = 0; k < 3; k++) box(g, 3.2, 0.15, 0.15, mWood, 0, 2 + k * 3, 1.5, Math.PI / 4); }
      else if (t.race === 'highelf') { cyl(g, 1.6, 2.1, H, mat(st.wall2, 0.8), 0, H / 2, 0, 12); cyl(g, 2.3, 2.3, 0.4, mTrim, 0, H, 0, 12); cone(g, 2.4, 4.5, mRoof, 0, H + 2.6, 0, 12); }
      else if (t.race === 'woodelf') { cyl(g, 0.9, 1.6, H + 2, mWood, 0, (H + 2) / 2, 0, 8); cyl(g, 2.6, 2.6, 0.4, mWood, 0, H, 0, 10); ball(g, 3, mat('#3e7a2e', 0.9), 0, H + 3.2, 0, 1); }
      else if (t.race === 'dwarf') { box(g, 4.2, H, 4.2, mStone, 0, H / 2, 0); for (const [mx, mz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) box(g, 0.9, 0.9, 0.9, mStone, mx * 1.75, H + 0.45, mz * 1.75); box(g, 4.3, 0.35, 4.3, mat('#3a3a3e', 0.5, 0.8), 0, H * 0.5, 0); }
      else { box(g, 3.8, H * 0.55, 3.8, mStone, 0, H * 0.275, 0); box(g, 3.4, H * 0.45, 3.4, mWood, 0, H * 0.775, 0); box(g, 4.4, 0.4, 4.4, mWood, 0, H, 0); cone(g, 3.4, 3, mRoof, 0, H + 2.4, 0, 4, Math.PI / 4); for (const [mx, mz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(g, 0.12, 0.12, 2, mWood, mx * 1.9, H + 1, mz * 1.9, 5); }
      if (l >= 1) cyl(g, 2.5, 2.5, 0.3, mTrim, 0, H * 0.65, 0, 10);
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.2), mTeam); fl.position.set(0, H * 0.55, 2.3); g.add(fl);
      this.height = H + 2; this.topY = H + 1;
    } else {
      // town hall
      const H = 9 + l * 1.6;
      if (t.race === 'orc') { cyl(g, 6, 6.6, H * 0.5, mWood, 0, H * 0.25, 0, 12); cone(g, 7.6, H * 0.7, mat('#a8784a', 0.95), 0, H * 0.5 + H * 0.35, 0, 12); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; const tk = cone(g, 0.35, 3.2, mat('#e8dfc4', 0.8), Math.cos(a) * 6.2, H * 0.55, Math.sin(a) * 6.2, 6); tk.rotation.set(Math.sin(a) * 0.8, 0, -Math.cos(a) * 0.8); } }
      else if (t.race === 'highelf') { cyl(g, 5.5, 6.2, H * 0.6, mat(st.wall2, 0.8), 0, H * 0.3, 0, 14); cyl(g, 3, 3.5, H * 0.8, mat(st.wall2, 0.8), 0, H, 0, 12); cone(g, 3.6, 7, mRoof, 0, H * 1.4 + 3.4, 0, 12); cyl(g, 6.3, 6.3, 0.5, mTrim, 0, H * 0.6, 0, 14); cyl(g, 3.6, 3.6, 0.4, mTrim, 0, H * 1.4, 0, 12); }
      else if (t.race === 'woodelf') { cyl(g, 2.6, 4, H * 1.5, mWood, 0, H * 0.75, 0, 9); for (const [bx2, by, bz, r] of [[0, H * 1.6, 0, 6], [3.5, H * 1.25, 1, 4], [-3.2, H * 1.3, -1.5, 4.2]]) ball(g, r, mat('#3e7a2e', 0.9), bx2, by, bz, 1); cyl(g, 5.8, 5.8, 3, mat('#8a6a40'), 0, 1.5, 0, 12); cone(g, 6.6, 2.6, mRoof, 0, 4.3, 0, 12); }
      else if (t.race === 'dwarf') { box(g, 12, H, 11, mStone, 0, H / 2, 0); for (let i = 0; i < 5; i++) for (const sd of [-1, 1]) box(g, 1.4, 1.2, 1.4, mStone, -5 + i * 2.5, H + 0.6, sd * 5); box(g, 4, H * 1.5, 4, mStone, 0, H * 0.75, 0); box(g, 12.1, 0.5, 11.1, mTrim, 0, H * 0.7, 0); }
      else { box(g, 12, H * 0.5, 10, mStone, 0, H * 0.25, 0); box(g, 11, H * 0.45, 9, mat(st.wall2, 0.95), 0, H * 0.72, 0); const r = cone(g, 9, 4.5, mRoof, 0, H * 0.95 + 2.2, 0, 4, Math.PI / 4); r.scale.set(1.15, 1, 0.95); box(g, 3, H * 1.4, 3, mStone, 4.5, H * 0.7, 3.5); cone(g, 2.6, 3.4, mRoof, 4.5, H * 1.4 + 1.7, 3.5, 4, Math.PI / 4); }
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.6), mTeam); fl.position.set(0, H * 0.6, 6.5); g.add(fl);
      cyl(g, 0.1, 0.1, 6, mat('#4a3020'), 0, H + 3, 0, 5);
      const top = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), mTeam); top.position.set(1.3, H + 5, 0); g.add(top);
      this.height = H + 2; this.topY = H;
    }
    g.position.copy(this.pos); g.rotation.y = this.town.yaw;
    if (this.kind === 'hall') { const k = 1 + l * 0.1; g.scale.setScalar(k); this.col.r = 6.4 * k; this.radius = 7 * k; this.height *= k; this.topY *= k; }
    this.root.add(mergeGroup(g)); this.root.position.set(0, 0, 0);
    // range ring for towers (Smite style: only fights what is inside it)
    if (this.kind === 'tower') {
      if (!this.ring) { this.ring = new THREE.Mesh(new THREE.RingGeometry(0.965, 1, 72).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false })); this.ring.renderOrder = 3; G.scene.add(this.ring); }
      this.ring.scale.setScalar(this.range); this.ring.position.set(this.pos.x, this.pos.y + 0.25, this.pos.z);
    }
  }
  takeHit(dmg, src, opts = {}) {
    if (this.dead || B.over) return 0;
    if (this.town && this.town.qmod && this.town.qmod.hall) dmg *= 1 - this.town.qmod.hall; // town job: tougher walls
    // Smite rule: heroes can only damage a tower from inside its circle
    if (src && (src === G.player || src.hero) && this.kind === 'tower' && Math.hypot(src.pos.x - this.pos.x, src.pos.z - this.pos.z) > this.range + 0.5) { if (src === G.player) V.number(this.pos.clone().setY(this.pos.y + 6), 'Out of range', 'miss'); return 0; }
    if (B.client) { send({ t: 'hit', k: 's', id: B.structs.indexOf(this), dmg: Math.round(dmg), o: {} }); this.hitT = 0.2; return Math.round(dmg); }
    dmg = Math.max(1, Math.round(dmg * (this.kind === 'hall' ? 0.8 : 0.9)));
    this.hp -= dmg; this.hitT = 0.2;
    if (src && (src === G.player || src.hero)) this.lastHeroHit = { src, t: B.time };
    if (Math.random() < 0.4) V.burst(this.town.race === 'orc' || this.town.race === 'woodelf' ? 'wood' : 'stone', this.pos.clone().setY(this.pos.y + 2 + Math.random() * 4), 6, { speed: 3, size: 0.25 });
    if (this.hp <= 0) this.destroy(src);
    return dmg;
  }
  destroy(src) {
    this.dead = true; this.hp = 0; this.col.on = false; if (this.ring) this.ring.visible = false;
    S.explode(this.pos, 1.6, 'fire'); S.rumble(this.pos, 2); V.addShake(0.5);
    for (let i = 0; i < 6; i++) V.burst('dust', this.pos.clone().setY(this.pos.y + i * 1.5), 20, { speed: 5, size: 2, life: 2 });
    let t = 0; const r = this.root; G.timers.push({ update(dt) { t += dt; r.position.y -= dt * 2.2; r.rotation.z = Math.sin(t * 9) * 0.02; if (t > 4) { r.visible = false; return true; } } });
    // rubble
    const rub = new THREE.Group(); for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6 + Math.random() * 0.8, 0), mat(STYLE[this.town.race].stone, 0.95)); m.position.set(this.pos.x + rand(-1, 1) * this.radius, this.pos.y + 0.2, this.pos.z + rand(-1, 1) * this.radius); m.rotation.set(rand(0, 3), rand(0, 3), 0); m.castShadow = true; rub.add(m); } G.scene.add(rub);
    if (!B.client) onStructDown(this, src);
  }
  update(dt) {
    if (this.dead) return;
    this.hitT = Math.max(0, (this.hitT || 0) - dt);
    if (this.ring) { const p = G.player, d = p ? Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z) : 999; this.ring.visible = d < this.range + 30; if (this.ring.visible) { const foe = this.team !== B.myTeam, inside = d < this.range; this.ring.material.color.set(foe ? (inside ? '#ff3020' : '#ff8a60') : '#5aa0ff'); this.ring.material.opacity = inside ? 0.85 : 0.45; } }
    if (B.client) return;
    this.atkCd -= dt; if (this.atkCd > 0) return;
    const tg = this.pickTarget(); if (!tg) return;
    const L = this.kind === 'hall' ? { dmg: 40 + this.level * 15, cd: 1.8 } : TOWER_LEVELS[this.level];
    this.atkCd = L.cd;
    const from = this.pos.clone(); from.y += this.topY || 10;
    shoot(this, tg, from, L.dmg * (tg === G.player || tg.hero ? 1 : 1.2), 'smite');
  }
  pickTarget() {
    // Smite rules: troops in the circle first; a hero only once they step inside (and always if they hit an ally hero in the circle)
    const R = this.range; let best = null, bd = 1e9;
    for (const u of B.units) { if (u.dead || u.team === this.team || u.hero) continue; const d = Math.hypot(u.pos.x - this.pos.x, u.pos.z - this.pos.z); if (d < R && d < bd) { bd = d; best = u; } }
    const heroes = allHeroes().filter(h => h.team !== this.team && !h.dead && Math.hypot(h.pos.x - this.pos.x, h.pos.z - this.pos.z) < R);
    const agg = heroes.find(h => h.aggroT > B.time && h.aggroAt === this.town); if (agg) return agg;
    if (best) return best;
    if (heroes.length) return heroes.sort((a, b) => Math.hypot(a.pos.x - this.pos.x, a.pos.z - this.pos.z) - Math.hypot(b.pos.x - this.pos.x, b.pos.z - this.pos.z))[0];
    return null;
  }
  remove() {}
  animate() {}
  respawn() {}
}

// ---------- projectiles (guided, they always land on their target if it is still there) ----------
const SHOT_GEO = { arrow: new THREE.CylinderGeometry(0.03, 0.03, 0.9, 4).rotateX(Math.PI / 2), bolt: new THREE.CylinderGeometry(0.05, 0.05, 0.6, 4).rotateX(Math.PI / 2), bullet: new THREE.SphereGeometry(0.08, 6, 4), fire: new THREE.SphereGeometry(0.35, 8, 6), arcane: new THREE.SphereGeometry(0.3, 8, 6), frost: new THREE.IcosahedronGeometry(0.3, 0), holy: new THREE.SphereGeometry(0.28, 8, 6), smite: new THREE.CylinderGeometry(0.06, 0.06, 1.6, 5).rotateX(Math.PI / 2) };
const SHOT_MAT = { arrow: new THREE.MeshBasicMaterial({ color: '#c8a070' }), bolt: new THREE.MeshBasicMaterial({ color: '#7a6a5a' }), bullet: new THREE.MeshBasicMaterial({ color: '#ffe8a0' }), fire: new THREE.MeshBasicMaterial({ color: '#ff8a20' }), arcane: new THREE.MeshBasicMaterial({ color: '#c070ff' }), frost: new THREE.MeshBasicMaterial({ color: '#a0e8ff' }), holy: new THREE.MeshBasicMaterial({ color: '#fff0a0' }), smite: new THREE.MeshBasicMaterial({ color: '#ffe080' }) };
const SPEED = { arrow: 34, bolt: 40, bullet: 80, fire: 22, arcane: 24, frost: 24, holy: 24, smite: 46 };
function tgtRef(t) { if (t === G.player) return 'h' + MP.myId; if (t.remote) return 'h' + t.netId; if (t.isStruct) return 's' + B.structs.indexOf(t); if (t.netIdx != null) return 'm' + t.netIdx; return 'u' + t.id; }
export function shootVisual(f) {
  const [kind, x, y, z, ref] = f, c = ref[0], id = +ref.slice(1);
  const tgt = c === 'h' ? (id === MP.myId ? G.player : MP.remotes.get(id)) : c === 's' ? B.structs[id] : c === 'm' ? mobList[id] : B.units.find(u => u.id === id);
  if (!tgt) return; shoot({ team: -1 }, tgt, V3(x, y, z), 0, kind, { visual: true });
}
function shoot(src, tgt, from, dmg, kind, opts = {}) {
  if (MP.host && !opts.visual) fxQueue.push([kind, Math.round(from.x * 10) / 10, Math.round(from.y * 10) / 10, Math.round(from.z * 10) / 10, tgtRef(tgt)]);
  const m = new THREE.Mesh(SHOT_GEO[kind] || SHOT_GEO.arrow, SHOT_MAT[kind] || SHOT_MAT.arrow); m.position.copy(from); G.scene.add(m);
  B.shots.push({ m, src, tgt, dmg, kind, opts, t: 0, from: from.clone(), arc: kind === 'arrow' || kind === 'bolt' ? 1 : 0 });
  if (kind === 'bullet') { S.gunshot(from, 0.9); V.burst('smoke', from, 8, { speed: 1.5, size: 0.8, life: 1.2 }); V.light(from, '#ffb050', 4, 0.1); }
  else if (kind === 'arrow' || kind === 'bolt' || kind === 'smite') S.bowShot(from);
  else S.cast(kind === 'frost' ? 'frost' : kind === 'arcane' || kind === 'holy' ? 'arcane' : 'fire', from, 0.6);
}
function tgtPoint(t) { const p = t.pos.clone(); p.y += t === G.player ? 1.2 : (t.isStruct ? (t.topY || 6) * 0.5 : (t.height || 1.6) * 0.6); return p; }
function updateShots(dt) {
  for (let i = B.shots.length - 1; i >= 0; i--) {
    const s = B.shots[i]; s.t += dt;
    const end = tgtPoint(s.tgt), d = s.m.position.distanceTo(end), sp = SPEED[s.kind] || 30;
    const step = sp * dt;
    if (d <= step + 0.3 || s.t > 4) {
      G.scene.remove(s.m); B.shots.splice(i, 1);
      if (s.opts.visual) { V.burst(s.kind === 'fire' || s.kind === 'smite' ? 'fire' : 'spark', end, 5, { speed: 3 }); continue; }
      if (s.kind === 'holy' && s.opts.heal) { if (!s.tgt.dead) { s.tgt.hp = Math.min(s.tgt.maxHp, s.tgt.hp + s.opts.heal); V.burst('heal', end, 12, { speed: 2, vy: 2 }); } continue; }
      V.burst(s.kind === 'fire' || s.kind === 'smite' ? 'fire' : s.kind === 'frost' ? 'frost' : s.kind === 'arcane' ? 'arcane' : 'spark', end, s.kind === 'smite' ? 14 : 6, { speed: 3 });
      if (s.kind === 'smite') { V.light(end, '#ffe080', 5, 0.15); S.arrowHit(end); }
      if (s.opts.splash) { V.ring(end.clone().setY(end.y - 1), s.opts.splash, s.kind === 'fire' ? '#ff8a30' : '#c070ff', 0.4); for (const u of foesNear(s.src.team, end, s.opts.splash)) hurt(u, s.dmg * 0.6, s.src); }
      if (!s.tgt.dead) hurt(s.tgt, s.dmg, s.src, s.opts.slow ? { slow: s.opts.slow } : {});
      continue;
    }
    const dir = end.clone().sub(s.m.position).normalize();
    s.m.position.addScaledVector(dir, step);
    if (s.arc) { const tot = s.from.distanceTo(end) || 1, k = clamp(1 - d / tot, 0, 1); s.m.position.y += Math.sin(k * Math.PI) * tot * 0.04 * dt * 10 * (1 - k); }
    s.m.lookAt(end);
  }
}

// ---------- damage between sides ----------
// town job bonuses, by town: gather, build, train, income, tower, hall, army
const qm = (t, k) => (t && t.qmod && t.qmod[k]) || 0;
export function questReward(t, id) {
  if (B.client) { send({ t: 'qreward', id }); return; }
  const j = QJOB(id); if (!j || !t) return;
  t.qmod = t.qmod || {}; for (const k in j.mod) t.qmod[k] = (t.qmod[k] || 0) + j.mod[k];
  if (j.bank) for (const k in j.bank) bank(t, k, j.bank[k]);
  if (j.gold) bank(t, 'gold', j.gold);
}
function hurt(t, dmg, src, opts = {}) {
  if (t.dead || B.over) return;
  if (src && src.town && src.town.qmod) dmg *= 1 + (src.isStruct ? (src.kind === 'tower' ? qm(src.town, 'tower') : 0) : qm(src.town, 'army'));
  if (t === G.player) { t.takeDamage(dmg, src, opts); if (opts.slow) t.debuff && t.debuff('slow', opts.slow); return; }
  if (t.remote) { t.takeDamage(dmg, src, opts); return; }
  if (t.isStruct) return t.takeHit(dmg, src, opts);
  t.takeHit(dmg, src, Object.assign({ fromUnit: true }, opts));
}
function foesNear(team, p, r) { const out = []; for (const u of B.units) if (!u.dead && u.team !== team && Math.hypot(u.pos.x - p.x, u.pos.z - p.z) < r + u.radius) out.push(u); return out; }
export function allHeroes() { const out = []; if (G.player && B.on) { G.player.team = B.myTeam; G.player.hero = true; out.push(G.player); } for (const u of B.units) if (u.hero) out.push(u); for (const r of MP.remotes.values()) out.push(r); return out; }

// ---------- troops ----------
const MUSKET_GEO = (() => { const g = new THREE.Group(); const wood = new THREE.MeshStandardMaterial({ color: '#5a3a20', roughness: 0.8 }), iron = new THREE.MeshStandardMaterial({ color: '#3a3a3e', roughness: 0.4, metalness: 0.8 }); const st = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.75, 0.1), wood); st.position.y = -0.1; g.add(st); const br = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.95, 6), iron); br.position.set(0, 0.6, 0.02); g.add(br); return g; })();
const XBOW_GEO = (() => { const g = new THREE.Group(); const wood = new THREE.MeshStandardMaterial({ color: '#4a3020', roughness: 0.8 }); const st = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.65, 0.09), wood); st.position.y = 0.15; g.add(st); const bow = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.025, 4, 10, Math.PI), wood); bow.position.y = 0.42; bow.rotation.set(0, Math.PI / 2, 0); g.add(bow); return g; })();
let unitId = 70000;
export class Unit {
  constructor(town, def, x, z, opts = {}) {
    this.id = unitId++; this.town = town; this.team = town.team; this.udef = def; this.type = 'u_' + def.id; this.hero = !!opts.hero; this.worker = def.role === 'worker';
    const lvlK = 1 + town.level * 0.12;
    this.lv = opts.lv || (3 + town.level * 4 + (def.lvl || 0) * 2);
    this.maxHp = Math.round(def.hp * lvlK); this.hp = this.maxHp; this.dmg = def.dmg * lvlK;
    this.def = { name: def.name, aggro: 1, boss: false, elite: def.pop >= 2, skin: false, loot: null, size: def.size, shape: 'human', cost: def.cost };
    this.pos = V3(x, heightAt(x, z), z); this.yaw = town.yaw; this.dead = false; this.deadT = 0;
    this.status = { frozen: 0, stun: 0, slow: 0, bleed: 0, bleedDps: 0, burn: 0, burnDps: 0, knock: V3(0, 0, 0) };
    this.hostile = this.team !== B.myTeam; this.provoked = false; this.state = 'idle';
    this.order = opts.order || 'defend'; this.path = null; this.pi = 0; this.target = null; this.scanT = Math.random() * 0.4; this.atkCd = rand(0.2, 1);
    this.action = null; this.actionT = 0; this.off = rand(-3.2, 3.2); this.hitFlash = 0;
    const app = { race: town.race, kind: def.kind || 'person', sex: 'm', spec: unitSpec(def.spec, TEAM_COLORS[town.team], town.race), skin: def.skin, hair: '#2a1a10', hairStyle: Math.floor(Math.random() * 3), beard: town.race === 'dwarf' ? 2 : Math.random() < 0.3 ? 1 : 0, build: def.kind === 'troll' ? 0 : rand(0, 0.6) };
    if (opts.app) Object.assign(app, opts.app);
    const ch = def.quad ? buildQuad(def.quad, def.col || '#8a8a90', def.size || 1.2) : buildHumanoid(app);
    if (def.quad) {}
    else if (def.wt === 'musket') { const m = MUSKET_GEO.clone(); ch.arms.R.grip.add(m); ch.weapons.main = m; }
    else if (def.wt === 'crossbow') { const m = XBOW_GEO.clone(); ch.arms.R.grip.add(m); ch.weapons.main = m; }
    else if (def.wt) equipWeapon(ch, def.wt, def.tier ?? 1);
    if (this.worker) holdTool(ch, def.tool || 'hatchet', 1);
    if (!def.quad) bake(ch.root);
    const sc = def.quad ? 1 : (def.size || 1) * (opts.scale || 1); if (!def.quad) ch.root.scale.setScalar(sc);
    this.model = ch; this.root = ch.root; this.radius = def.quad ? ch.radius : 0.42 * sc * (def.kind === 'troll' ? 1.5 : 1); this.height = def.quad ? ch.height : ch.height * sc;
    this.reach = this.radius + (def.kind === 'troll' ? 2.4 : 1.6);
    this.mats = []; const seen = new Map(); this.root.traverse(o => { if (o.isMesh && o.material && o.material.emissive) { let c = seen.get(o.material); if (!c) { c = o.material.clone(); seen.set(o.material, c); this.mats.push(c); } o.material = c; } });
    G.scene.add(this.root); this.root.position.copy(this.pos);
    B.units.push(this); G.mobs.push(this);
  }
  get name() { return this.hero ? this.heroName : this.udef.name; }
  dist2(p) { const dx = p.x - this.pos.x, dz = p.z - this.pos.z; return dx * dx + dz * dz; }
  get range() { return this.udef.range || 0; }
  dist(p) { return Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z); }
  takeHit(dmg, src, opts = {}) {
    if (this.dead || B.over) return 0;
    if (B.client) { send({ t: 'hit', k: 'u', id: this.id, dmg: Math.round(dmg), o: { stun: opts.stun || 0, slow: opts.slow || 0, freeze: opts.freeze || 0, bleed: opts.bleed || 0, burn: opts.burn || 0, big: !!opts.big } }); this.hitFlash = 0.15; return Math.round(dmg); }
    dmg = Math.max(1, Math.round(dmg * (1 - (this.udef.armor || 0) * 0.6) * (this.ward > B.time ? 0.6 : 1)));
    this.hp -= dmg; this.hitFlash = 0.15;
    if (opts.stun) this.status.stun = Math.max(this.status.stun, opts.stun * (this.udef.pop >= 3 ? 0.4 : 1));
    if (opts.freeze) this.status.frozen = Math.max(this.status.frozen, opts.freeze);
    if (opts.slow) this.status.slow = Math.max(this.status.slow, opts.slow);
    if (opts.bleed) { this.status.bleed = 4; this.status.bleedDps = opts.bleed; }
    if (opts.burn) { this.status.burn = 3; this.status.burnDps = opts.burn; }
    if (opts.knock && this.udef.pop < 3) this.status.knock.add(opts.knock.clone().multiplyScalar(this.hero ? 0.5 : 1));
    if (!opts.silent && this.dist(G.player || this) < 50) { S.hit(this.udef.kind === 'troll' ? 'flesh' : 'flesh', this.pos, opts.big ? 1.4 : 0.8); V.burst('blood', this.pos.clone().setY(this.pos.y + this.height * 0.6), 6, { speed: 3, size: 0.1, life: 0.5 }); }
    if (src && src !== this && !src.isStruct && !src.dead && (!this.target || this.target.isStruct || Math.random() < 0.3)) this.target = src;
    // a hero hitting another hero under a tower makes that tower shoot back (Smite rule)
    if (this.hero && src && (src === G.player || src.hero)) { const tw = towerCovering(this.pos, this.team); if (tw) { src.aggroT = B.time + 3; src.aggroAt = tw.town; } }
    if (this.hp <= 0) this.die(src);
    return dmg;
  }
  die(src) {
    this.dead = true; this.hp = 0; this.deadT = 0; this.action = null;
    if (this.dist(G.player || this) < 60) S.yelp('human', this.pos);
    onUnitDown(this, src);
  }
  respawnHero() {
    const t = this.town; this.dead = false; this.hp = this.maxHp; this.pos.set(t.x, heightAt(t.x, t.z), t.z); this.root.visible = true; this.root.rotation.set(0, 0, 0); this.target = null; this.path = null;
    for (const k in this.status) if (typeof this.status[k] === 'number') this.status[k] = 0;
  }
  // what to walk toward when nothing is in reach
  goal() {
    const t = this.town;
    if (this.order === 'attack' && this.path) {
      while (this.pi < this.path.length - 1 && Math.hypot(this.path[this.pi][0] - this.pos.x, this.path[this.pi][1] - this.pos.z) < 5) this.pi++;
      const p = this.path[this.pi], q = this.path[Math.max(0, this.pi - 1)];
      const dx = p[0] - q[0], dz = p[1] - q[1], l = Math.hypot(dx, dz) || 1;
      return [p[0] - dz / l * this.off, p[1] + dx / l * this.off];
    }
    const leader = this.town.leader || (this.town.isMe ? G.player : null);
    if (this.order === 'follow' && leader && !leader.dead) {
      // pets keep their own spot a few steps behind and to the side of you, instead of crowding you
      if (this.pet) { const y = leader.yaw || 0, side = (this.id % 2 ? 1 : -1) * (2.6 + (this.id % 3) * 1.1), back = 3.4 + (this.id % 2) * 1.3; return [leader.pos.x - Math.sin(y) * back - Math.cos(y) * side, leader.pos.z - Math.cos(y) * back + Math.sin(y) * side]; }
      return [leader.pos.x + Math.sin(this.id) * 4, leader.pos.z + Math.cos(this.id) * 4];
    }
    // defend: hold the square just inside the gate
    const k = this.id % 16, row = Math.floor(k / 8), col = k % 8, lat = (col < 4 ? -1 : 1) * (4 + (col % 4) * 2.2);
    return [t.gateIn[0] - t.dir[0] * (3 + row * 2.6) + t.perp[0] * lat, t.gateIn[1] - t.dir[1] * (3 + row * 2.6) + t.perp[1] * lat];
  }
  scan() {
    // nearest enemy that can be reached (melee troops don't chase through walls)
    const aggro = this.range ? this.range + 6 : (this.order === 'attack' ? 16 : 22);
    const myIn = nearTown(this.pos.x, this.pos.z, -12);
    let best = null, bd = aggro;
    const consider = (o, w = 1) => { if (o.dead || o.team === this.team) return; const d = this.dist(o) - (o.radius || 0.5); if (d * w >= bd) return; if (!this.range && !o.isStruct) { const oIn = nearTown(o.pos.x, o.pos.z, -12); if (oIn !== myIn && Math.hypot(o.pos.x - (oIn || myIn).gate[0], o.pos.z - (oIn || myIn).gate[1]) > 14 && this.dist({ pos: V3((oIn || myIn).gate[0], 0, (oIn || myIn).gate[1]) }) > 14) return; } bd = d * w; best = o; };
    for (const u of B.units) consider(u, u.worker ? 1.4 : 1);
    for (const h of allHeroes()) if (h !== this) consider(h, 0.95);
    if (this.order === 'attack' || this.hero) for (const s of B.structs) consider(s, s.kind === 'hall' ? 1.25 : 1.1);
    // defenders also clear anything near the walls
    if (!best && this.order === 'defend') { for (const u of B.units) if (!u.dead && u.team !== this.team && Math.hypot(u.pos.x - this.town.x, u.pos.z - this.town.z) < WALL_R + 30) { const d = this.dist(u); if (d < 70 && (!best || d < this.dist(best))) best = u; } }
    return best;
  }
  update(dt) {
    if (this.proxy) return proxyUnitStep(this, dt);
    const st = this.status;
    if (this.dead) {
      this.deadT += dt;
      if (this.deadT < 1.2) { this.root.rotation.x = -Math.min(1, this.deadT / 0.6) * Math.PI / 2; this.root.position.y = this.pos.y + 0.15; }
      else if (this.deadT > 6 && !this.hero) { this.root.visible = false; this.gone = true; }
      else if (this.hero && this.deadT > 4) this.root.visible = false;
      return;
    }
    for (const k of ['frozen', 'stun', 'slow']) if (st[k] > 0) st[k] -= dt;
    if (st.bleed > 0) { st.bleed -= dt; this.dot = (this.dot || 0) + st.bleedDps * dt; }
    if (st.burn > 0) { st.burn -= dt; this.dot = (this.dot || 0) + st.burnDps * dt; }
    if (this.dot >= 1) { const d = Math.floor(this.dot); this.dot -= d; this.takeHit(d, null, { silent: true }); if (this.dead) return; }
    this.hitFlash = Math.max(0, this.hitFlash - dt); for (const m of this.mats) m.emissive.setScalar(this.hitFlash > 0 ? 0.5 : 0);
    const disabled = st.frozen > 0 || st.stun > 0;
    const px0 = this.pos.x, pz0 = this.pos.z;
    let want = null, speed = 0;
    const spd = this.udef.speed * (st.slow > 0 ? 0.55 : 1) * (this.runUntil > B.time ? 1 + (this.runK || 0) : 1);
    if (!disabled) {
      this.atkCd -= dt;
      if (this.worker) { const r = workerTick(this, dt); want = r.want; speed = r.speed ? spd * r.speed * (1 + up(this.town, 'boots') * 0.15) : 0; }
      else {
        this.scanT -= dt;
        if (this.scanT <= 0) { this.scanT = 0.35 + Math.random() * 0.2; const tg = this.scan(); if (tg && (!this.target || this.target.dead || this.dist(tg) < this.dist(this.target) * 0.7 || this.target.isStruct && !tg.isStruct)) this.target = tg; if (this.target && (this.target.dead || this.dist(this.target) > (this.range || 18) + 30)) this.target = null; }
        if (this.hero) heroTick(this, dt);
        const tg = this.target && !this.target.dead ? this.target : null;
        if (this.udef.role === 'healer') { const hurtAlly = B.units.find(u => !u.dead && u.team === this.team && u !== this && u.hp < u.maxHp * 0.7 && this.dist(u) < this.range); if (hurtAlly && this.atkCd <= 0 && !this.action) { this.startAction('cast', 0.7); this.atkCd = this.udef.cd; this.faceTo(hurtAlly.pos, 1, 1); shoot(this, hurtAlly, this.handPos(), 0, 'holy', { heal: this.udef.heal * (1 + this.town.level * 0.12) }); } }
        if (this.action) { this.actionT += dt / this.actionDur; if (this.actionT >= 1) this.action = null; }
        if (tg) {
          const d = this.dist(tg) - (tg.radius || 0.5);
          this.faceTo(tg.pos, dt, 8);
          if (this.range && d < this.range * 0.3 && !tg.isStruct) { want = [this.pos.x - (tg.pos.x - this.pos.x), this.pos.z - (tg.pos.z - this.pos.z)]; speed = spd * 0.8; }
          else if (this.range && d <= this.range) { if (this.atkCd <= 0 && !this.action) { this.atkCd = this.udef.cd * rand(0.9, 1.15) * (this.haste > B.time ? 0.7 : 1); this.startAction(this.udef.wt && this.udef.wt.includes('staff') ? 'cast' : 'shoot', 0.6); const kind = this.udef.proj || 'arrow'; shoot(this, tg, this.handPos(), this.dmg * rand(0.85, 1.15) * (this.rally > B.time ? 1.25 : 1), kind, { splash: this.udef.splash, slow: this.udef.slow }); } }
          else if (!this.range && d <= this.reach) { if (this.atkCd <= 0 && !this.action) { this.atkCd = this.udef.cd * rand(0.9, 1.15) * (this.haste > B.time ? 0.7 : 1); this.startAction(this.udef.kind === 'troll' || this.udef.wt === 'warhammer' ? 'slam' : ['swing1', 'swing2', 'swing3'][Math.floor(Math.random() * 3)], 0.75); this.pending = tg; this.hitAt = 0.5; } }
          else { want = [tg.pos.x, tg.pos.z]; speed = spd; }
        } else { const g = this.goal(), gd = Math.hypot(g[0] - this.pos.x, g[1] - this.pos.z), arrive = this.pet ? (this.petGo ? 1.0 : 3.0) : 1.2; if (this.pet) this.petGo = gd > arrive; if (gd > arrive) { want = g; speed = spd * (this.order === 'defend' ? 0.8 : 1); } else if (this.order === 'defend') this.faceTo(V3(this.pos.x + this.town.dir[0], 0, this.pos.z + this.town.dir[1]), dt, 3); }
        if (this.pending && this.action && this.actionT >= this.hitAt) { const t = this.pending; this.pending = null; if (!t.dead && this.dist(t) - (t.radius || 0.5) <= this.reach + 0.8) { hurt(t, this.dmg * rand(0.85, 1.15) * (this.rally > B.time ? 1.25 : 1), this); if (this.udef.slam) { V.ring(t.pos, this.udef.slam, '#c8a070', 0.4); V.burst('dust', t.pos.clone(), 14, { speed: 4, size: 1 }); for (const o of foesNear(this.team, t.pos, this.udef.slam)) if (o !== t) hurt(o, this.dmg * 0.5, this); } } }
      }
      // smooth steering: accelerate toward where we want to be, ease in on arrival, keep a little apart from friends
      let dvx = 0, dvz = 0;
      if (want && speed) {
        want = nav(this, want);
        const dx = want[0] - this.pos.x, dz = want[1] - this.pos.z, l = Math.hypot(dx, dz);
        if (l > 0.3) { const s2 = speed * Math.min(1, l / 1.6); dvx = dx / l * s2; dvz = dz / l * s2; }
      }
      dvx += this.sepX || 0; dvz += this.sepZ || 0;
      const acc = Math.min(1, dt * (this.worker ? 7 : 6)); this.vx = (this.vx || 0) + (dvx - (this.vx || 0)) * acc; this.vz = (this.vz || 0) + (dvz - (this.vz || 0)) * acc;
      const vsp = Math.hypot(this.vx, this.vz), cap = Math.max(speed, 1.5); if (vsp > cap) { this.vx *= cap / vsp; this.vz *= cap / vsp; }
      this.pos.x += this.vx * dt; this.pos.z += this.vz * dt;
      if (vsp > 0.6 && (!this.target || this.worker || this.dist(this.target) > (this.range || this.reach) + 1)) this.faceTo(V3(this.pos.x + this.vx, 0, this.pos.z + this.vz), dt, 7);
    }
    else { this.vx = (this.vx || 0) * 0.8; this.vz = (this.vz || 0) * 0.8; }
    if (st.knock.lengthSq() > 0.01) { this.pos.addScaledVector(st.knock, dt); st.knock.multiplyScalar(Math.max(0, 1 - dt * 6)); }
    collide(this.pos, this.radius * 0.8);
    this.pos.y = heightAt(this.pos.x, this.pos.z);
    const realSp = Math.hypot(this.pos.x - px0, this.pos.z - pz0) / Math.max(dt, 1e-4);
    // stuck on a wall or a tree: slide sideways for a moment
    if (speed && want && realSp < speed * 0.25) { this.stuck = (this.stuck || 0) + dt; if (this.stuck > 0.9) { this.stuck = 0; this.stuckN = (this.stuckN || 0) + 1; this.off = -this.off || 2;
        // side-step: alternate left and right of where we were trying to go, a little further each time
        const dx = want[0] - this.pos.x, dz = want[1] - this.pos.z, l = Math.hypot(dx, dz) || 1, sd = this.stuckN % 2 ? 1 : -1, k = Math.min(3, 0.8 + this.stuckN * 0.4);
        this.pos.x += (-dz / l * sd - dx / l * 0.3) * k; this.pos.z += (dx / l * sd - dz / l * 0.3) * k; collide(this.pos, this.radius * 0.8);
        // a worker that can't reach its tree or rock gives up on it
        if (this.worker && this.stuckN > 5 && this.node && !(this.carry >= ECON.carry)) { (this.badNodes = this.badNodes || new Set()).add(this.node); this.node.workers = Math.max(0, (this.node.workers || 1) - 1); this.node = null; this.stuckN = 0; } } }
    else if (realSp > speed * 0.5) { this.stuck = 0; if (realSp > 1) this.stuckN = Math.max(0, (this.stuckN || 0) - dt * 0.5); }
    this.root.position.copy(this.pos); this.root.rotation.y = this.yaw;
    if (this.expire != null) { this.expire -= dt; if (this.expire <= 0 && !this.dead) { V.burst('shadow', this.pos.clone().setY(this.pos.y + 0.8), 25, { speed: 2 }); this.dead = true; this.gone = true; this.root.visible = false; } }
    if (this.pet) { const still = realSp < 0.25 && !this.target && !this.action; this.idleT = still ? (this.idleT || 0) + dt : 0; }
    const it = this.idleT || 0, petIdle = this.pet ? { sniff: it > 0.8 && it < 4.5 && Math.sin(this.id + it * 0.9) > -0.2, sit: it >= 4.5 && it < 16, lie: it >= 16 } : {};
    if (this.root.visible) { if (this.udef.quad) animQuad(this.model, dt, Object.assign({ speed: disabled ? 0 : Math.min(speed, realSp * 1.1), action: this.action ? 'attack' : null, actionT: this.actionT }, petIdle)); else animateHumanoid(this.model, dt, { speed: disabled ? 0 : Math.min(speed, realSp * 1.1), action: this.action, actionT: this.actionT, armed: true }); }
  }
  startAction(a, dur) { this.action = a; this.actionT = 0; this.actionDur = dur; }
  animateProxy(dt, sp) { if (this.udef.quad) animQuad(this.model, dt, { speed: sp, action: this.action ? 'attack' : null, actionT: this.actionT }); else animateHumanoid(this.model, dt, { speed: sp, action: this.action, actionT: this.actionT, armed: true }); }
  sackUpdate() { if (this.worker) setSack(this); }
  faceTo(p, dt, k) { const a = Math.atan2(p.x - this.pos.x, p.z - this.pos.z); this.yaw += angDiff(this.yaw, a) * Math.min(1, dt * k); }
  handPos() { const p = this.pos.clone(); p.y += this.height * 0.75; p.x += Math.sin(this.yaw) * 0.6; p.z += Math.cos(this.yaw) * 0.6; return p; }
  remove() { G.scene.remove(this.root); }
  animate() {}
  respawn() {}
}
function towerCovering(p, team) { for (const s of B.structs) if (!s.dead && s.team === team && s.kind === 'tower' && Math.hypot(p.x - s.pos.x, p.z - s.pos.z) < s.range) return s; return null; }

// ---------- workers: chop, mine and haul back to the town hall ----------
const JOB_NODES = { wood: (n) => n.type.startsWith('tree'), stone: (n) => n.type === 'rock' };
export const up = (t, id) => (t.up && t.up[id]) || 0;
export function peasantCarry(t) { return ECON.carry + up(t, 'sacks') * 5; }
function pickJob(t) {
  const want = t.jobs || { wood: 0.55, stone: 0.45 };
  const have = { wood: 0, stone: 0 }; let n = 0; for (const u of t.units) if (u.worker && !u.dead && u.job) { have[u.job]++; n++; }
  let best = 'wood', gap = -1e9; for (const k in want) { const g = want[k] * (n + 1) - have[k]; if (g > gap) { gap = g; best = k; } }
  return best;
}
// a bundle of logs or a sack of stone on a peasant's back while carrying
function setSack(u) {
  const show = u.carry > 0, kind = u.cjob || u.job;
  if (!u.sack && show) { const g = new THREE.Group(); const logs = new THREE.Group(); for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.62, 6), mat('#8a6238')); c.rotation.z = Math.PI / 2; c.position.set(0, (i === 2 ? 0.12 : 0), (i === 1 ? 0.13 : 0)); logs.add(c); } const sack = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), mat('#a08a60', 0.95)); sack.scale.set(1.1, 1.3, 0.8); for (let i = 0; i < 3; i++) { const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.07, 0), mat('#8a847a', 0.95)); st.position.set((i - 1) * 0.08, 0.24, 0); sack.add(st); } g.add(logs, sack); g.position.set(0, 0.05, -0.24); (u.model.chest || u.model.spine || u.model.root).add(g); u.sack = { g, logs, sack }; }
  if (u.sack) { u.sack.g.visible = show; u.sack.logs.visible = kind === 'wood'; u.sack.sack.visible = kind !== 'wood'; }
}
function workerTick(u, dt) {
  const t = u.town;
  if (!u.job || !JOB_NODES[u.job]) u.job = pickJob(t);
  setSack(u);
  if (u.carry > 0 && (u.carry >= peasantCarry(t) || u.homeNow)) { // haul home to the storehouse
    const [hx, hz] = t.store;
    if (Math.hypot(hx - u.pos.x, hz - u.pos.z) < 2.6) { bank(t, u.cjob || u.job, u.carry); bank(t, 'gold', ECON.deliveryGold); if (t.isMe && G.player && u.dist(G.player) < 40) S.drop && S.drop(); u.carry = 0; u.homeNow = false; setSack(u); if (Math.random() < 0.25) { u.job = pickJob(t); u.node = null; } return { want: null, speed: 0 }; }
    return { want: routeHome(u, [hx, hz]), speed: 1 };
  }
  if (!u.node || !u.node.alive) {
    let best = null, bd = 1e9; const test = JOB_NODES[u.job];
    for (const n of world.nodes) { if (!n.alive || !test(n) || (u.badNodes && u.badNodes.has(n))) continue; const d = Math.hypot(n.x - t.x, n.z - t.z) + Math.hypot(n.x - u.pos.x, n.z - u.pos.z) * 0.5 + (n.workers || 0) * 25; if (d < bd && Math.hypot(n.x - t.x, n.z - t.z) < 240) { bd = d; best = n; } }
    if (u.node) u.node.workers = Math.max(0, (u.node.workers || 1) - 1);
    u.node = best; if (best) best.workers = (best.workers || 0) + 1; u.work = 0;
    if (!best) { u.job = u.job === 'wood' ? 'stone' : 'wood'; return { want: null, speed: 0 }; }
  }
  const n = u.node, d = Math.hypot(n.x - u.pos.x, n.z - u.pos.z);
  if (d > (n.col ? n.col.r : 0.5) + u.radius + 0.9) return { want: routeOut(u, [n.x, n.z]), speed: 1 };
  u.faceTo(V3(n.x, 0, n.z), dt, 6);
  if (!u.action) { u.startAction(u.job === 'wood' ? 'chop' : 'mine', 0.9); if (G.player && u.dist(G.player) < 30) (u.job === 'wood' ? S.chop : S.mine)(u.pos); }
  u.work += dt * (1 + up(t, 'tools') * 0.2) * (1 + qm(t, 'gather'));
  if (u.work >= ECON.gatherTime) {
    u.work = 0; u.carry = peasantCarry(t); u.cjob = u.job;
    n.chops = (n.chops || 0) + 1;
    if (n.chops >= (n.type.startsWith('tree') ? 3 : 5)) { n.alive = false; n.chops = 0; n.respawn = G.time + (n.def.respawn || 80) * 1.5; hideNode(n); if (G.hooks.nodeDone && G.player && u.dist(G.player) < 80) G.hooks.nodeDone(n, u); }
  }
  return { want: null, speed: 0 };
}
// path around town walls: in and out only through the gate, and around the outside of the wall instead of into it
export function nav(u, dest) { const r = nav0(u, dest); return hallAround(u, r); }
// inside a town, walk around the town hall instead of into it
function hallAround(u, p) {
  for (const t of B.towns) {
    if (Math.hypot(u.pos.x - t.x, u.pos.z - t.z) > WALL_R + 2) continue;
    const R = (t.hall && !t.hall.dead ? 7.6 : 0) + u.radius; if (R < 1) return p;
    const r = distToLine(t.x, t.z, [[u.pos.x, u.pos.z], p]);
    if (r.d < R && r.t > 0.01 && r.t < 0.99) { const au = Math.atan2(u.pos.z - t.z, u.pos.x - t.x), a2 = Math.atan2(p[1] - t.z, p[0] - t.x), da = angDiff(au, a2); const a = au + Math.sign(da || 1) * Math.min(Math.abs(da), 0.7); return [t.x + Math.cos(a) * (R + 2.5), t.z + Math.sin(a) * (R + 2.5)]; }
  }
  return p;
}
function nav0(u, dest) {
  let T = null, bd = 1e9; for (const t of B.towns) { const d = Math.hypot(u.pos.x - t.x, u.pos.z - t.z); if (d < bd) { bd = d; T = t; } }
  const D = (x, z) => Math.hypot(x - T.x, z - T.z);
  // also check the town around the destination
  let TD = null; for (const t of B.towns) if (Math.hypot(dest[0] - t.x, dest[1] - t.z) < WALL_R) TD = t;
  if (TD && TD !== T && bd > WALL_R + 30) T = TD;
  if (!T || (bd > WALL_R + 30 && TD !== T)) return dest;
  const ru = D(u.pos.x, u.pos.z), rd = D(dest[0], dest[1]), inU = ru < WALL_R, inD = rd < WALL_R;
  const ag = Math.atan2(T.dir[1], T.dir[0]), au = Math.atan2(u.pos.z - T.z, u.pos.x - T.x);
  const lat = Math.abs((u.pos.x - T.x) * T.perp[0] + (u.pos.z - T.z) * T.perp[1]);
  const along = (u.pos.x - T.x) * T.dir[0] + (u.pos.z - T.z) * T.dir[1];
  const ring = (a) => [T.x + Math.cos(a) * (WALL_R + 8), T.z + Math.sin(a) * (WALL_R + 8)];
  const axis = (a) => [T.x + T.dir[0] * a, T.z + T.dir[1] * a];
  // off to the side of the gate: line up on the gate axis first (inside or outside the wall), then walk straight through
  if (inU && !inD) { if (lat > 2.2) return axis(clamp(along, 13, WALL_R - 7)); return axis(WALL_R + 12); }
  if (!inU && inD) {
    const da = angDiff(au, ag);
    if (Math.abs(da) > 0.3 && ru < WALL_R + 25) return ring(au + Math.sign(da) * Math.min(Math.abs(da), 0.55));
    if (lat > 2.2) return axis(Math.max(along, WALL_R + 7));
    return axis(WALL_R - 12);
  }
  if (!inU && !inD && ru < WALL_R + 25) {
    // straight line would cut through the town: go round
    const r = distToLine(T.x, T.z, [[u.pos.x, u.pos.z], dest]);
    if (r.d < WALL_R + 3 && r.t > 0.02 && r.t < 0.98) { const a2 = Math.atan2(dest[1] - T.z, dest[0] - T.x), da = angDiff(au, a2); return ring(au + Math.sign(da || 1) * Math.min(Math.abs(da), 0.55)); }
  }
  return dest;
}
function routeOut(u, dest) { return dest; }
function routeHome(u, dest) { return dest; }

// ---------- AI heroes ----------
const AI_CLASS = { human: 'warrior', orc: 'berserker', highelf: 'wizard', woodelf: 'ranger', dwarf: 'warrior' };
const CLASS_HERO = { cleric: { wt: 'maceshield', range: 0 }, paladin: { wt: 'swordshield', range: 0 }, darkknight: { wt: 'greatsword', range: 0 }, druid: { wt: 'froststaff', range: 22, proj: 'frost' }, monk: { wt: 'fists', range: 0 }, bard: { wt: 'sword', range: 0 }, rogue: { wt: 'daggers', range: 0 }, necromancer: { wt: 'arcanestaff', range: 22, proj: 'arcane' }, elementalist: { wt: 'firestaff', range: 22, proj: 'fire', splash: 3 }, enchanter: { wt: 'arcanestaff', range: 22, proj: 'arcane' }, beastmaster: { wt: 'handaxes', range: 0 }, shaman: { wt: 'spear', range: 0 }, musketeer: { wt: 'musket', range: 26, proj: 'bullet' }, warrior: { wt: 'swordshield', range: 0, proj: null }, berserker: { wt: 'greataxe', range: 0 }, ranger: { wt: 'bow', range: 24, proj: 'arrow' }, wizard: { wt: 'firestaff', range: 22, proj: 'fire', splash: 3 } };
export function heroUnitDef(cls) { const H = CLASS_HERO[cls] || CLASS_HERO.warrior; return { id: 'hero', name: 'Hero', role: H.range ? 'ranged' : 'melee', hp: 330, dmg: 24, cd: H.range ? 1.4 : 1.1, speed: 5.4, range: H.range, proj: H.proj, splash: H.splash, wt: H.wt, tier: 2, armor: 0.25, size: 1, pop: 0, cost: { gold: 0 } }; }
function makeAIHero(t) {
  const cls = t.heroCls || AI_CLASS[t.race] || 'warrior', H = CLASS_HERO[cls];
  const def = { id: 'hero', name: 'Hero', role: H.range ? 'ranged' : 'melee', hp: 330, dmg: 24, cd: H.range ? 1.4 : 1.1, speed: 5.4, range: H.range, proj: H.proj, splash: H.splash, wt: H.wt, tier: 2, armor: 0.25, size: 1, pop: 0, cost: { gold: 0 } };
  const app = { cls, outfit: cls, spec: undefined, sex: Math.random() < 0.3 ? 'f' : 'm' };
  const u = new Unit(t, def, t.x, t.z + 0.01, { hero: true, lv: 1, app, order: 'defend' });
  u.model.root.scale.setScalar(1.05);
  u.heroName = (t.heroName || ['Aldric', 'Grommash', 'Faelar', 'Sylvaine', 'Borin'][Math.floor(Math.random() * 5)]); u.heroLv = 1; u.xp = 0; u.cls = cls; u.abilCd = 6;
  heroStats(u); t.hero = u; return u;
}
function heroStats(u) { const L = u.heroLv * 2 - 1; const k = u.hp / u.maxHp; u.maxHp = Math.round(330 + L * 95 + u.town.level * 60); u.hp = Math.round(u.maxHp * k); u.dmg = 24 + L * 6.5; u.lv = L; }
export function heroXp(u, n) { if (u.heroLv >= 10) return; u.xp += n; while (u.heroLv < 10 && u.xp >= ECON.xpNeed(u.heroLv)) { u.xp -= ECON.xpNeed(u.heroLv); u.heroLv++; heroStats(u); u.hp = u.maxHp; bank(u.town, 'gold', ECON.levelGold(u.heroLv)); } }
function heroTick(u, dt) {
  const t = u.town;
  u.abilCd -= dt;
  // big swing or blast every few seconds
  if (u.abilCd <= 0 && u.target && !u.target.dead && u.dist(u.target) < (u.range || 4) + 2) {
    u.abilCd = rand(7, 10); const p = u.target.pos.clone(); const r = u.range ? 4 : 4.5;
    V.ring(p, r, u.range ? '#ff8a30' : '#ffd080', 0.5); V.burst(u.range ? 'fire' : 'dust', p.clone().setY(p.y + 0.5), 20, { speed: 5 }); S.explode(p, 0.6, 'fire');
    for (const o of foesNear(u.team, p, r)) hurt(o, u.dmg * 1.8, u);
    if (G.player && G.player.team !== u.team && G.player.pos.distanceTo(p) < r) hurt(G.player, u.dmg * 1.4, u);
  }
  if (!u.target) {
    // decide where to be: defend when attacked, push with the army, otherwise hunt neutral camps for gold and xp
    const threat = B.units.some(o => !o.dead && o.team !== u.team && Math.hypot(o.pos.x - t.x, o.pos.z - t.z) < WALL_R + 40);
    const army = t.units.filter(o => !o.dead && o.order === 'attack');
    if (threat) { u.order = 'defend'; }
    else if (army.length >= 4) { u.order = 'attack'; u.path = army[0].path; u.pi = Math.max(0, (army[0].pi || 0) - 1); }
    else {
      u.order = 'roam';
      const mob = G.mobs.find(m => !m.dead && m.team == null && m.lv <= u.heroLv + 3 && Math.hypot(m.pos.x - t.x, m.pos.z - t.z) < 240 && (!u.hunt || u.hunt === m));
      if (mob) { u.hunt = mob; if (u.dist(mob) < (u.range || 2.5)) { if (u.atkCd <= 0) { u.atkCd = u.udef.cd; u.startAction(u.range ? 'shoot' : 'swing1', 0.6); if (u.range) shoot(u, mob, u.handPos(), u.dmg, u.udef.proj, { splash: u.udef.splash }); else { mob.takeHit(u.dmg, u); } if (mob.dead) { heroXp(u, 6 + mob.lv * 4); bank(t, 'gold', 4 + mob.lv * 2); u.hunt = null; } } u.faceTo(mob.pos, dt, 8); } else { const r = nav(u, [mob.pos.x, mob.pos.z]); const dx = r[0] - u.pos.x, dz = r[1] - u.pos.z, l = Math.hypot(dx, dz) || 1; u.pos.x += dx / l * u.udef.speed * dt; u.pos.z += dz / l * u.udef.speed * dt; u.faceTo(V3(r[0], 0, r[1]), dt, 6); } }
      else u.order = 'defend';
    }
  }
}

// ---------- economy ----------
export function bank(t, k, n) {
  if (n > 0 && !B.client) { const e = t.earned || (t.earned = { gold: 0, wood: 0, stone: 0 }); e[k] = (e[k] || 0) + n; }
  if (B.client) { if (k === 'gold' && t.isMe && n) { send({ t: 'gold', n: Math.round(n) }); if (G.save) G.save.gold = Math.max(0, G.save.gold + Math.round(n)); } return; } if (k === 'gold' && t.isMe && G.save) { t.gf = (t.gf || 0) + n; const w = t.gf >= 0 ? Math.floor(t.gf) : Math.ceil(t.gf); t.gf -= w; G.save.gold = Math.max(0, G.save.gold + w); } else t.bank[k] = Math.max(0, (t.bank[k] || 0) + n); if (t.isMe && k !== 'gold' && n > 0 && G.hooks.resGained) G.hooks.resGained(k, n); }
export function res(t, k) { return k === 'gold' && t.isMe && G.save ? G.save.gold : (t.bank[k] || 0); }
export function canPay(t, cost) { for (const k in cost) if (res(t, k) < cost[k]) return false; return true; }
function pay(t, cost) { for (const k in cost) bank(t, k, -cost[k]); }
export function pop(t) { let n = 0; for (const u of t.units) if (!u.dead && !u.hero && !u.worker && !u.pet) n += u.udef.pop || 1; for (const q of t.queue) if (q.def.role !== 'worker') n += q.def.pop || 1; return n; }
export function popCap(t) { return TOWN_LEVELS[t.level].cap; }
export function peasants(t) { return t.units.filter(u => u.worker && !u.dead).length + t.queue.filter(q => q.def.role === 'worker').length; }
export function peasantCap(t) { return TOWN_LEVELS[t.level].peasants + up(t, 'housing') * 2; }
export function buyForeman(t, id) {
  const F = FOREMAN.find(f => f.id === id); if (!F) return 'Unknown upgrade';
  const r = up(t, id); if (r >= F.costs.length) return 'Fully upgraded';
  if (!canPay(t, F.costs[r])) return 'Not enough resources';
  pay(t, F.costs[r]); (t.up = t.up || {})[id] = r + 1; tsay(t, 'steward', `${({ housing: 'new cottages are up: we can take on more peasants', tools: 'the peasants have sharper tools: they work faster now', boots: 'the peasants have new boots: they move faster now', sacks: 'bigger sacks for the peasants: they haul more each trip' })[id]} (rank ${r + 1}).`, 'build'); return null;
}
export function available(t) { return [t.roster.worker, ...rosterOf(t.race)].filter(d => (d.lvl || 0) <= t.level); }

// ---------- orders ----------
export function hire(t, id) {
  const def = unitDef(t.race, id); if (!def || t.dead) return 'Unknown troop';
  if ((def.lvl || 0) > t.level) return `Needs a ${TOWN_LEVELS[def.lvl].name}`;
  if (def.role === 'worker') { if (peasants(t) >= peasantCap(t)) return 'Peasant limit reached: upgrade housing or the town'; }
  else if (pop(t) + (def.pop || 1) > popCap(t)) return 'Army is full: upgrade your town';
  if (!canPay(t, def.cost)) return 'Not enough resources';
  pay(t, def.cost); t.queue.push({ def, t: def.time, total: def.time });
  return null;
}
export function upgradeTown(t) {
  if (t.building) return 'Already building'; const L = TOWN_LEVELS[t.level + 1]; if (!L) return 'Fully upgraded';
  if (!canPay(t, L.cost)) return 'Not enough resources';
  pay(t, L.cost); startConstruction(t, L.time); return null;
}
export function upgradeTower(s) {
  const t = s.town, L = TOWER_LEVELS[s.level + 1]; if (s.dead) return 'Destroyed'; if (!L) return 'Fully upgraded'; if (s.building) return 'Already upgrading';
  if (!canPay(t, L.cost)) return 'Not enough resources';
  pay(t, L.cost); s.building = { t: 0, dur: L.time }; tsay(t, 'steward', `we are strengthening our ${s === t.towers[0] ? 'right' : 'left'} tower.`, 'build'); return null;
}
export function repairTower(s) {
  const t = s.town; if (s.dead) return 'Destroyed'; if (s.hp >= s.maxHp) return 'Not damaged';
  if (!canPay(t, TOWER_REPAIR)) return 'Not enough resources';
  pay(t, TOWER_REPAIR); tsay(t, 'steward', `masons are patching up our ${s === t.towers[0] ? 'right' : 'left'} tower.`, 'build'); s.hp = Math.min(s.maxHp, s.hp + s.maxHp * 0.25); V.burst('wood', s.pos.clone().setY(s.pos.y + 4), 20, { speed: 3 }); return null;
}
// march path from a town to another town's hall
function pathTo(a, b) {
  const pts = [a.gateIn, a.gateOut, a.junction];
  const r = LAYOUT.roads.find(r => (r.a === a.i && r.b === b.i) || (r.a === b.i && r.b === a.i));
  if (r) pts.push(r.pts[1]);
  pts.push(b.junction, b.gateOut, b.gateIn, [b.x + b.dir[0] * 8, b.z + b.dir[1] * 8]);
  return pts;
}
export function directionOf(from, to) {
  // left / straight / right as seen from your gate looking out
  const dx = to.x - from.x, dz = to.z - from.z; const a = angDiff(Math.atan2(from.dir[0], from.dir[1]), Math.atan2(dx, dz));
  return Math.abs(a) < 0.5 ? 'Straight' : a > 0 ? 'Left' : 'Right';
}
export function sendAttack(t, targetIdx, frac = 1) {
  if (B.client) { send({ t: 'order', kind: 'attack', target: targetIdx, frac }); return null; }
  const tg = B.towns[targetIdx]; if (!tg || tg.dead || tg.team === t.team) return 'No target';
  const army = t.units.filter(u => !u.dead && !u.worker && !u.hero && u.order !== 'attack');
  const n = Math.max(1, Math.round(army.length * frac)); if (!army.length) return 'No troops to send';
  const path = pathTo(t, tg);
  t.lastAttackT = Math.round(B.time);
  for (const u of army.slice(0, n)) { u.order = 'attack'; u.path = path; u.pi = 0; u.targetTown = tg; u.target = null; }
  t.lastAttack = targetIdx;
  const horn = { t: 'horn', from: t.i, target: tg.i, n, dir: directionOf(t, tg) };
  if (MP.on) send(horn); if (G.hooks.warHorn) G.hooks.warHorn(horn);
  tsay(t, 'captain', `${n} of our soldiers march ${directionOf(t, tg).toLowerCase()} on ${tg.name}!`, 'war');
  return null;
}
// abilities that touch your army: rally heals and empowers nearby troops, wolves fight for you
// heals and buffs that reach every ally near the caster: troops, allied heroes and other players
export function allyHeal(p, r, pct, team = B.myTeam, caster = G.player) {
  let n = 0;
  if (caster !== G.player && G.player && !G.player.dead && team === B.myTeam && Math.hypot(G.player.pos.x - p.x, G.player.pos.z - p.z) < r) { G.player.heal(G.player.maxHp * pct); G.hooks.toast && G.hooks.toast('An ally healed you', '✚', 'gold'); }
  for (const u of B.units) if (!u.dead && u.team === team && Math.hypot(u.pos.x - p.x, u.pos.z - p.z) < r) { u.hp = Math.min(u.maxHp, u.hp + u.maxHp * pct); n++; V.burst('heal', u.pos.clone().setY(u.pos.y + 1.2), 6, { speed: 2, vy: 2 }); }
  for (const h of allHeroes()) if (h !== G.player && h !== caster && !h.dead && h.team === team && h.remote && Math.hypot(h.pos.x - p.x, h.pos.z - p.z) < r) { G.hooks.netHeal && G.hooks.netHeal(h, pct); n++; }
  return n;
}
export function allyBuff(p, r, kind, dur, team = B.myTeam, caster = G.player) {
  if (caster !== G.player && G.player && team === B.myTeam && Math.hypot(G.player.pos.x - p.x, G.player.pos.z - p.z) < r) { if (kind === 'ward') G.player.buffs.ward = dur; else if (kind === 'rally') G.player.buffs.cry = Math.max(G.player.buffs.cry || 0, dur); else G.player.buffs.focus = Math.max(G.player.buffs.focus || 0, dur); }
  for (const u of B.units) if (!u.dead && u.team === team && Math.hypot(u.pos.x - p.x, u.pos.z - p.z) < r) { u[kind] = B.time + dur; V.burst(kind === 'ward' ? 'frost' : 'gold', u.pos.clone().setY(u.pos.y + 1.5), 6, { speed: 2, vy: 2 }); }
  for (const h of allHeroes()) if (h !== G.player && h !== caster && !h.dead && h.team === team && h.remote && Math.hypot(h.pos.x - p.x, h.pos.z - p.z) < r) G.hooks.netBuff && G.hooks.netBuff(h, kind, dur);
}
export function rallyTroops(p, r) { const t = myTown(); for (const u of t.units) if (!u.dead && !u.worker && Math.hypot(u.pos.x - p.x, u.pos.z - p.z) < r) { u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.3); u.rally = B.time + 10; V.burst('gold', u.pos.clone().setY(u.pos.y + 1.5), 8, { speed: 2, vy: 2 }); } }
// the Shaman's spirit wolf: light bites, but everyone of its side near it runs faster. It, its aura and the speed grow with level
export function spiritWolfDef(lv) { lv = Math.max(1, Math.min(10, lv)); return { id: 'spiritwolf', name: 'Spirit Wolf', lv, role: 'melee', hp: 220 + lv * 45, dmg: 3 + lv * 1.2, cd: 1.3, speed: 7.5, range: 0, armor: 0.2, size: 1.0 + lv * 0.05, quad: 'wolf', col: '#a8f0d8', pop: 0, cost: { gold: 0 }, aura: { r: 8 + lv * 0.9, k: 0.12 + lv * 0.02 } }; }
export function spiritWolf(p, lv, dur, town) { const t = town || myTown(); for (const u of t.units) if (u.udef.id === 'spiritwolf' && !u.dead) { u.dead = true; u.gone = true; u.root.visible = false; } const u = new Unit(t, spiritWolfDef(lv), p.x, p.z, { order: 'follow' }); u.expire = dur; u.pet = true; t.units.push(u); V.burst('heal', u.pos.clone().setY(u.pos.y + 0.8), 30, { speed: 3 }); return u; }
// every few frames: anyone of the wolf's side inside its aura runs faster
function wolfAuras(dt) {
  for (const w of B.units) { if (w.dead || !w.udef.aura) continue; const A = w.udef.aura;
    if ((w.auraFx = (w.auraFx || 0) - dt) <= 0) { w.auraFx = 1.4; V.ring(w.pos, A.r, '#80ffd0', 1.2); }
    const p = G.player; if (p && !p.dead && w.team === B.myTeam && Math.hypot(p.pos.x - w.pos.x, p.pos.z - w.pos.z) < A.r) { p.buffs.wolfRun = 0.35; p.wolfK = A.k; }
    if (!B.client) for (const u of B.units) if (u.team === w.team && !u.dead && u !== w && Math.hypot(u.pos.x - w.pos.x, u.pos.z - w.pos.z) < A.r) { u.runUntil = B.time + 0.35; u.runK = A.k; } }
}
export function summonPet(kind, p, lv, dur, n, big, town) { const t = town || myTown(); for (let k = 0; k < n; k++) { const def = petDef(kind, lv, big); def.petKind = kind; def.petLv = lv; const u = new Unit(t, def, p.x + (k - (n - 1) / 2) * 2.2, p.z - (k % 2), { order: 'follow' }); u.expire = dur; u.pet = true; t.units.push(u); V.burst('shadow', u.pos.clone().setY(u.pos.y + 0.8), 20, { speed: 2 }); } }
export function summonWolves(p, lv, dur, town) { const t = town || myTown(); const n = 2 + Math.round((Math.min(10, lv) - 1) / 9 * 2); for (let k = 0; k < n; k++) { const def = { id: 'wolfpet', name: 'Spirit Wolf', role: 'melee', hp: 260 + lv * 45, dmg: 14 + lv * 3.5, cd: 1.0, speed: 7, range: 0, armor: 0.15, size: 1.35, quad: 'wolf', col: '#c8d8f0', pop: 0, cost: { gold: 0 } }; const u = new Unit(t, def, p.x + (k - (n - 1) / 2) * 2.2, p.z - 2 - (k % 2), { order: 'follow' }); u.expire = dur; u.pet = true; t.units.push(u); V.burst('frost', u.pos.clone().setY(u.pos.y + 0.8), 25, { speed: 3 }); } }
export function recall(t) {
  if (B.client) { send({ t: 'order', kind: 'recall' }); return; } for (const u of t.units) if (!u.worker && !u.hero) { u.order = 'defend'; u.path = null; u.target = null; } }
export function setFollow(t) {
  if (B.client) { send({ t: 'order', kind: 'follow' }); return; } for (const u of t.units) if (!u.worker && !u.hero) { u.order = 'follow'; u.path = null; } }

// ---------- construction (town upgrades take a minute with scaffolding, workers and dust) ----------
function startConstruction(t, dur) {
  t.building = { t: 0, dur, crew: [], scaff: new THREE.Group() };
  const sc = t.building.scaff, wood = mat('#8a6a42');
  const { out } = wallAngles(t);
  for (let i = 0; i < out.length; i += 3) { const a = out[i]; const x = t.x + Math.cos(a) * (WALL_R - 2.2), z = t.z + Math.sin(a) * (WALL_R - 2.2), y = heightAt(x, z), H = TOWN_LEVELS[t.level + 1].wallH + 1;
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a)); for (const xx of [-1.6, 1.6]) cyl(g, 0.07, 0.07, H, wood, xx, H / 2, 0, 5); for (let k = 1; k < H; k += 1.5) box(g, 3.6, 0.1, 0.8, wood, 0, k, 0); sc.add(g); }
  { const H = 16; for (const [mx, mz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(sc, 0.09, 0.09, H, wood, t.x + mx * 7.5, heightAt(t.x, t.z) + H / 2, t.z + mz * 7.5, 5); for (let k = 2; k < 16; k += 2.5) for (const mz of [-1, 1]) box(sc, 15, 0.12, 0.9, wood, t.x, heightAt(t.x, t.z) + k, t.z + mz * 7.5); }
  G.scene.add(sc);
  // builders walking between the wall and the hall, hammering
  for (let i = 0; i < 6; i++) { const a = rand(0, 6.28); const w = new Unit(t, t.roster.worker, t.x + Math.cos(a) * 20, t.z + Math.sin(a) * 20); w.builder = true; w.worker = false; w.udef = Object.assign({}, t.roster.worker, { role: 'builder' }); B.units.splice(B.units.indexOf(w), 1); G.mobs.splice(G.mobs.indexOf(w), 1); t.building.crew.push(w); holdTool(w.model, 'hatchet', 2); }
  tsay(t, 'steward', `the builders are at work. ${t.name} will be a ${TOWN_LEVELS[t.level + 1].name} within the minute.`, 'build');
}
function updateConstruction(t, dt) {
  const b = t.building; if (!b) return;
  b.t += dt * (B.client ? 1 : 1 + qm(t, 'build'));
  const near = G.player && Math.hypot(G.player.pos.x - t.x, G.player.pos.z - t.z) < 120;
  for (const w of b.crew) {
    if (!w.spot || w.work > 3) { const a = rand(0, 6.28), r = Math.random() < 0.6 ? WALL_R - 3.5 : 9; w.spot = [t.x + Math.cos(a) * r, t.z + Math.sin(a) * r]; w.work = 0; }
    const d = Math.hypot(w.spot[0] - w.pos.x, w.spot[1] - w.pos.z);
    if (d > 1) { const l = d; w.pos.x += (w.spot[0] - w.pos.x) / l * 3.5 * dt; w.pos.z += (w.spot[1] - w.pos.z) / l * 3.5 * dt; w.faceTo(V3(w.spot[0], 0, w.spot[1]), dt, 6); }
    else { w.work += dt; if (!w.action) { w.startAction('chop', 0.7); if (near && Math.random() < 0.3) S.hit(Math.random() < 0.5 ? 'wood' : 'stone', w.pos, 0.6); } if (Math.random() < dt * 2 && near) V.burst('dust', w.pos.clone().setY(w.pos.y + 1.5), 4, { speed: 1.5, size: 0.8, life: 1 }); }
    if (w.action) { w.actionT += dt / w.actionDur; if (w.actionT >= 1) w.action = null; }
    w.pos.y = heightAt(w.pos.x, w.pos.z); collide(w.pos, 0.35); w.root.position.copy(w.pos); w.root.rotation.y = w.yaw;
    if (near) animateHumanoid(w.model, dt, { speed: d > 1 ? 3.5 : 0, action: w.action, actionT: w.actionT });
  }
  if (near && Math.random() < dt * 3) { const { out } = wallAngles(t); const a = out[Math.floor(Math.random() * out.length)]; V.burst('dust', V3(t.x + Math.cos(a) * WALL_R, heightAt(t.x, t.z) + rand(1, 5), t.z + Math.sin(a) * WALL_R), 8, { speed: 2, size: 1.6, life: 1.6 }); }
  if (near && Math.random() < dt * 0.8) V.burst('smoke', V3(t.x + rand(-6, 6), heightAt(t.x, t.z) + 10, t.z + rand(-6, 6)), 6, { speed: 1, size: 2, life: 2.5 });
  if (b.t >= b.dur && !B.client) finishConstruction(t);
}
// online mirrors: the host says the town reached a level; rebuild it here
export function syncTownLevel(t, lvl) {
  const b = t.building; t.building = null; if (b) { G.scene.remove(b.scaff); for (const w of b.crew) G.scene.remove(w.root); }
  t.level = lvl; rebuildTown(t);
  if (t.isMe) S.levelUp();
}
export function startConstructionVisual(t, dur, at) { startConstruction(t, dur); if (t.building) t.building.t = at || 0; }
function rebuildTown(t) {
  G.scene.remove(t.wallMesh); t.wallMesh = mergeGroup(buildWalls(t, t.level)); G.scene.add(t.wallMesh);
  G.scene.remove(t.innerMesh); t.innerMesh = mergeGroup(buildInner(t, t.level)); G.scene.add(t.innerMesh);
  for (const u of B.units) collide(u.pos, u.radius); if (G.player) collide(G.player.pos, 0.5);
  V.burst('gold', V3(t.x, heightAt(t.x, t.z) + 14, t.z), 120, { speed: 8, vy: 6, life: 2 });
}
// the 60 second countdown in online games: nobody leaves their town before the gates open
function gateLock() {
  if (!MP.on || B.time >= 60 || !G.player || G.player.dead) return;
  const t = myTown(), p = G.player, dx = p.pos.x - t.x, dz = p.pos.z - t.z, d = Math.hypot(dx, dz);
  if (d > WALL_R - 3) { p.pos.x = t.x + dx / d * (WALL_R - 3); p.pos.z = t.z + dz / d * (WALL_R - 3); if (p.vel) { p.vel.x *= 0.2; p.vel.z *= 0.2; } }
}
function finishConstruction(t) {
  const b = t.building; t.building = null;
  G.scene.remove(b.scaff); for (const w of b.crew) G.scene.remove(w.root);
  t.level++;
  G.scene.remove(t.wallMesh); t.wallMesh = mergeGroup(buildWalls(t, t.level)); G.scene.add(t.wallMesh);
  G.scene.remove(t.innerMesh); t.innerMesh = mergeGroup(buildInner(t, t.level)); G.scene.add(t.innerMesh);
  t.hall.setLevel(t.level);
  // nobody ends up inside a new house or wall
  for (const u of B.units) collide(u.pos, u.radius); if (G.player) collide(G.player.pos, 0.5);
  if (t.isMe || t.owner != null) { tsay(t, 'steward', `it is done! ${t.name} is now a ${TOWN_LEVELS[t.level].name}. We can field ${popCap(t)} soldiers and ${peasantCap(t)} peasants.`, 'big'); S.levelUp(); }
  V.burst('gold', V3(t.x, heightAt(t.x, t.z) + 14, t.z), 120, { speed: 8, vy: 6, life: 2 });
}

// ---------- match flow ----------
function onUnitDown(u, src) {
  if (!u.builder && !u.hero) u.town.lost = (u.town.lost || 0) + 1;
  const killer = src && (src.town || (src === G.player ? myTown() : null));
  if (u.hero) { u.respawnT = ECON.respawn(u.heroLv); if (killer && killer.team !== u.team) { bank(killer, 'gold', ECON.heroKillGold(u.heroLv)); giveXp(killer, src, ECON.xpHero(u.heroLv), u.pos); } }
  else if (killer && killer.team !== u.team && !u.builder) { bank(killer, 'gold', ECON.killGold(u)); giveXp(killer, src, ECON.xpUnit(u), u.pos); }
  if (src === G.player && !u.builder) { const g = u.hero ? ECON.heroKillGold(u.heroLv) : ECON.killGold(u); G.hooks.killReward && G.hooks.killReward(g, u); }
}
function onStructDown(s, src) {
  const killer = src && (src.town || (src === G.player ? myTown() : null));
  if (killer && killer.team !== s.team) { bank(killer, 'gold', ECON.structGold[s.kind]); giveXp(killer, src, ECON.xpStruct[s.kind], s.pos); }
  const t = s.town;
  if (s.kind === 'hall') eliminate(t, killer);
  else if (t.isMe || t.owner != null) tsay(t, 'captain', `our ${s === t.towers[0] ? 'right' : 'left'} archer tower has fallen!`, 'bad');
  else if (killer && (killer.isMe || killer.owner != null)) tsay(killer, 'captain', `an enemy tower at ${t.name} lies in ruins. Well fought!`, 'good');
}
// xp is shared, unsplit: every player on the side gets it wherever they are (computer heroes only when close by)
function giveXp(town, src, n, at) {
  // players: one of them earns it (the killer if a player) and the team XP pool copies it to the others
  const players = allHeroes().filter(h => h.team === town.team && (h === G.player || h.remote));
  const earner = players.includes(src) ? src : players.find(h => h === G.player) || players[0];
  for (const h of allHeroes()) { if (h.team !== town.team) continue; const player = h === G.player || h.remote; if (player && h !== earner) continue; if (!player && (h.dead || (h !== src && Math.hypot(h.pos.x - at.x, h.pos.z - at.z) > 45))) continue; if (h === G.player) G.hooks.battleXp && G.hooks.battleXp(n); else if (h.remote) send({ t: 'xp', to: h.netId, n }); else heroXp(h, n); }
}
function eliminate(t, by) {
  t.dead = true;
  if (by && (by.isMe || by.owner != null)) tsay(by, 'captain', `${t.name} has fallen! Their kingdom is broken. Glory to you, Commander!`, 'big'); else if (!t.isMe && by) say('scout', `${t.name} has fallen to ${by.name}.`, 'war');
  for (const u of t.units) if (!u.dead) { u.takeHit(u.hp + 1, null, { silent: true }); }
  for (const s of B.structs) if (s.town === t && !s.dead) s.destroy(null);
  G.hooks.banner && G.hooks.banner(`${t.name} has fallen!`, by ? `Destroyed by ${by.name}` : '', 4000);
  checkWin();
}
function checkWin() {
  const alive = B.towns.filter(t => !t.dead); const teams = new Set(alive.map(t => t.team));
  const me = myTown();
  // online, the battle only ends when one side is left; a fallen player just sees their defeat
  if (MP.on) {
    if (me.dead && !B.shownEnd) { B.shownEnd = true; G.hooks.matchOver && G.hooks.matchOver('defeat'); }
    if (teams.size <= 1 && !B.over) { B.winTeam = alive.length ? alive[0].team : null; B.over = true; B.result = me.team === B.winTeam ? 'victory' : 'defeat'; if (!B.shownEnd) { B.shownEnd = true; G.hooks.matchOver && G.hooks.matchOver(B.result); } }
    return;
  }
  if (me.dead && !B.over) { B.over = true; B.result = 'defeat'; G.hooks.matchOver && G.hooks.matchOver('defeat'); }
  else if (teams.size <= 1 && !B.over) { B.winTeam = alive.length ? alive[0].team : null; B.over = true; B.result = 'victory'; G.hooks.matchOver && G.hooks.matchOver('victory'); }
}
export function myTown() { return B.towns[B.me]; }
// reports to the player, who is the Commander
function say(who, text, kind) { G.hooks.cmd && G.hooks.cmd(who, text, kind); }
// a report for whoever commands that town: here, or sent over the network to its player
// a report to every player in that town (several friends can share one town)
function tsay(t, who, text, kind) { if (B.client) return; if (t.isMe) say(who, text, kind); if (G.hooks.netSay) for (const m of t.members || (t.owner != null ? [t.owner] : [])) if (m !== MP.myId) G.hooks.netSay(m, who, text, kind); }
// scouts and captains warn about threats to the town and its towers
function watchTown(t, dt) {
  t.watchT = (t.watchT || 0) - dt; if (t.watchT > 0) return; t.watchT = 1;
  const foes = B.units.filter(u => !u.dead && u.team !== t.team && !u.worker && Math.hypot(u.pos.x - t.x, u.pos.z - t.z) < WALL_R + 60);
  if (foes.length >= 3 && B.time > (t.warnT || 0)) { t.warnT = B.time + 45; const from = B.towns.find(o => o.team === foes[0].team); tsay(t, 'scout', `the enemy is at our gates! ${foes.length} ${from ? from.name : 'enemy'} soldiers near the walls!`, 'bad'); }
  for (const s of t.towers) { if (s.dead) continue; const k = s.hp / s.maxHp; if (k < 0.5 && !s.warned50) { s.warned50 = true; tsay(t, 'captain', `our ${s === t.towers[0] ? 'right' : 'left'} tower is badly damaged!`, 'bad'); } if (k > 0.8) s.warned50 = false; }
  if (t.hall.hp / t.hall.maxHp < 0.5 && !t.hallWarn) { t.hallWarn = true; tsay(t, 'steward', 'the Town Hall is burning! If it falls, we are lost!', 'bad'); }
  const ours = t.units.filter(u => !u.dead && u.order === 'attack'); if (ours.length) { const tg = ours[0].targetTown; if (tg && ours.some(u => Math.hypot(u.pos.x - tg.x, u.pos.z - tg.z) < WALL_R + 40) && t.siegeSaid !== tg.i + ':' + t.lastAttackT) { t.siegeSaid = tg.i + ':' + t.lastAttackT; tsay(t, 'captain', `our army has reached ${tg.name} and is storming the walls!`, 'war'); } }
}

// ---------- AI commander ----------
// what the steward and captain are planning: used by the War Report
export function townPlan(t) {
  const D = DIFFS[t.diff] || DIFFS.normal, next = TOWN_LEVELS[t.level + 1];
  const army = t.units.filter(u => !u.dead && !u.worker && !u.hero && !u.pet && !u.builder);
  const home = army.filter(u => u.order !== 'attack'), out = army.filter(u => u.order === 'attack');
  const e = t.earned || (t.earned = { gold: 0, wood: 0, stone: 0 }), sn = t.snaps || (t.snaps = []);
  if (!sn.length || B.time - sn[sn.length - 1].t >= 5) { sn.push({ t: B.time, gold: e.gold, wood: e.wood, stone: e.stone }); if (sn.length > 13) sn.shift(); }
  const s0 = sn[0], span = B.time - s0.t, mins = Math.max(10, span) / 60;
  // until a minute of samples exists, use the average since the match began
  const rate = {}; for (const k of ['gold', 'wood', 'stone']) rate[k] = Math.max(0, span < 50 ? e[k] / Math.max(20, B.time) * 60 : (e[k] - s0[k]) / mins);
  let upgrade = null;
  if (t.building && TOWN_LEVELS[t.level + 1]) upgrade = { state: 'building', name: TOWN_LEVELS[t.level + 1].name, secs: Math.max(0, t.building.dur - t.building.t) };
  else if (next) {
    const short = {}; let waitRes = 0;
    for (const k in next.cost) { const s = Math.max(0, next.cost[k] - res(t, k)); if (s > 0) { short[k] = Math.ceil(s); waitRes = Math.max(waitRes, rate[k] > 0.5 ? s / rate[k] * 60 : Infinity); } }
    const gate = Math.max(0, D.upgradeAt * (t.level + 1) * 0.8 - B.time);
    upgrade = { state: 'saving', name: next.name, cost: next.cost, short, secs: Math.max(gate, waitRes), gate };
  }
  const grace = ECON.graceTime * ({ easy: 1.3, normal: 1, hard: 0.85, insane: 0.7 }[t.diff] || 1);
  const need = B.time > 1500 ? Math.min(4, D.wave + t.level * 3 + Math.floor(B.time / 240)) : D.wave + t.level * 3 + Math.floor(B.time / 240);
  const tg = out.length && out[0].targetTown;
  const attack = { out: out.length, target: tg ? tg.name : null, home: home.length, need, graceLeft: Math.max(0, grace - B.time), last: t.lastAttackT };
  const kinds = {}; for (const u of army) kinds[u.udef.name] = (kinds[u.udef.name] || 0) + 1;
  const workers = t.units.filter(u => u.worker && !u.dead);
  return { upgrade, attack, rate, kinds, army: army.length, cap: popCap(t), peasants: workers.length, peasantCap: peasantCap(t),
    wood: workers.filter(u => u.cjob === 'wood' || u.job === 'wood').length, stone: workers.filter(u => u.cjob === 'stone' || u.job === 'stone').length,
    training: t.queue.map(q => ({ name: q.def.name, secs: Math.max(0, q.t), worker: q.def.role === 'worker' })),
    threat: B.units.filter(u => !u.dead && u.team !== t.team && !u.worker && Math.hypot(u.pos.x - t.x, u.pos.z - t.z) < WALL_R + 40).length };
}
function aiThink(t) {
  const D = DIFFS[t.diff] || DIFFS.normal;
  const workers = t.units.filter(u => u.worker && !u.dead).length;
  const army = t.units.filter(u => !u.dead && !u.worker && !u.hero);
  const home = army.filter(u => u.order !== 'attack');
  const wantWorkers = 5 + t.level * 2;
  // spread workers over what we need
  const next = TOWN_LEVELS[t.level + 1];
  t.jobs = next ? { wood: 0.55, stone: 0.45 } : { wood: 0.5, stone: 0.5 };
  if (workers < Math.min(wantWorkers, peasantCap(t)) && canPay(t, t.roster.worker.cost)) { hire(t, 'worker'); return; }
  // foreman upgrades now and then
  if (Math.random() < 0.15) { const F = FOREMAN[Math.floor(Math.random() * FOREMAN.length)]; const r = up(t, F.id); if (r < F.costs.length && r <= t.level && canPay(t, F.costs[r])) { buyForeman(t, F.id); return; } }
  // town upgrade once the time is right
  if (next && !t.building && B.time > D.upgradeAt * (t.level + 1) * 0.8 && canPay(t, next.cost)) { upgradeTown(t); return; }
  // tower upgrades after the first town upgrade
  if (t.level >= 1) for (const s of t.towers) if (!s.dead && !s.building && s.level < t.level && TOWER_LEVELS[s.level + 1] && canPay(t, TOWER_LEVELS[s.level + 1].cost) && Math.random() < 0.3) { upgradeTower(s); return; }
  for (const s of t.towers) if (!s.dead && s.hp < s.maxHp * 0.5 && canPay(t, TOWER_REPAIR) && Math.random() < 0.3) { repairTower(s); return; }
  // keep some gold back for the next upgrade
  const reserve = next ? next.cost.gold * D.reserve : 0;
  if (res(t, 'gold') - reserve > 60 && pop(t) < popCap(t) && t.queue.length < 3) {
    const opts = available(t).filter(d => d.role !== 'worker' && canPay(t, d.cost));
    if (opts.length) {
      const melee = army.filter(u => u.udef.role === 'melee').length, ranged = army.length - melee;
      let pool = opts.filter(d => (melee <= ranged * 1.4 ? d.role === 'melee' : d.role !== 'melee')); if (!pool.length) pool = opts;
      pool.sort((a, b) => (b.lvl || 0) - (a.lvl || 0)); const pick = Math.random() < 0.6 ? pool[0] : pool[Math.floor(Math.random() * pool.length)];
      hire(t, pick.id);
    }
  }
  // attack waves
  const wave = D.wave + t.level * 3 + Math.floor(B.time / 240);
  const grace = ECON.graceTime * ({ easy: 1.3, normal: 1, hard: 0.85, insane: 0.7 }[t.diff] || 1);
  if (B.time > grace && (home.length >= wave || (B.time > 1500 && home.length >= 4))) {
    const foes = B.towns.filter(o => !o.dead && o.team !== t.team);
    if (foes.length) { foes.sort((a, b) => (a.hall.hp / a.hall.maxHp) - (b.hall.hp / b.hall.maxHp) + (Math.random() - 0.5) * 0.4); sendAttack(t, foes[0].i, 0.8); }
  }
  // fall back if the town is in danger
  const danger = B.units.filter(u => !u.dead && u.team !== t.team && Math.hypot(u.pos.x - t.x, u.pos.z - t.z) < WALL_R + 25).length;
  if (danger > home.length + 3) for (const u of army) if (u.order === 'attack' && Math.hypot(u.pos.x - t.x, u.pos.z - t.z) < 220) { u.order = 'defend'; u.path = null; }
}

// ---------- setup ----------
export function initBattle(scene) {
  B.on = true; fog.on = true; G.fog = fog; G.fogVis = isVisible;
  G.allyHeroes = () => allHeroes().filter(h => h !== G.player && !h.dead && h.team === B.myTeam);
  B.client = MP.client; const meIdx = MP.on ? Math.max(0, SETUP.towns.findIndex(c => (c.members || [c.owner]).includes(MP.myId))) : 0; B.me = meIdx; B.myTeam = SETUP.towns[meIdx].team ?? meIdx; G.myTeam = B.myTeam;
  G.remoteHeroes = () => [...MP.remotes.values()];
  const used = {};
  SETUP.towns.forEach((cfg, i) => {
    const L = LAYOUT.towns[i];
    const race = cfg.race || 'human'; used[race] = (used[race] || 0);
    const t = Object.assign({}, L, { race, ai: MP.on ? !!cfg.ai : (i !== 0 && cfg.ai !== false), owner: MP.on && cfg.owner != null && !(cfg.members || [cfg.owner]).includes(MP.myId) ? cfg.owner : null, members: MP.on ? (cfg.members || (cfg.owner != null ? [cfg.owner] : [])).slice() : [], diff: cfg.diff || 'normal', team: cfg.team ?? i, level: 0, units: [], queue: [], towerSpots: L.towers, bank: Object.assign({}, ECON.start), dead: false, isMe: i === meIdx, roster: ROSTERS[race] || ROSTERS.human });
    t.name = cfg.name || TOWN_NAMES[race][used[race]++ % 4]; t.color = TEAM_COLORS[t.team]; t.heroCls = cfg.cls;
    B.towns.push(t);
  });
  for (const t of B.towns) {
    t.wallMesh = mergeGroup(buildWalls(t, 0)); scene.add(t.wallMesh); wallColliders(t);
    t.innerMesh = mergeGroup(buildInner(t, 0)); scene.add(t.innerMesh);
    t.hall = new Structure(t, 'hall', t.x, t.z); B.structs.push(t.hall); G.mobs.push(t.hall);
    for (const [x, z] of t.towerSpots) { const s = new Structure(t, 'tower', x, z); B.structs.push(s); G.mobs.push(s); }
    t.towers = B.structs.filter(s => s.town === t && s.kind === 'tower');
    if (t.ai && !MP.client) makeAIHero(t);
    if (t.isMe || t.owner != null) { t.auto = true; t.diff = 'normal'; }
  }
  for (const s of B.structs) s.hostile = s.team !== B.myTeam;
}
export function update(dt) {
  if (!B.on) return;
  gateLock();
  wolfAuras(dt);
  if (B.client) { for (const t of B.towns) if (!t.dead) updateConstruction(t, dt); for (const s of B.structs) s.update(dt); updateShots(dt); fogAndSentries(dt); return; }
  if (!B.over) B.time += dt;
  for (const t of B.towns) {
    if (t.dead) continue;
    // passive income
    const D = t.ai ? DIFFS[t.diff] || DIFFS.normal : { income: 1.15 };
    bank(t, 'gold', (ECON.passiveGold + ECON.passiveGoldPerLevel * t.level) * D.income * (1 + qm(t, 'income')) * dt);
    if (t.ai && D.income > 1 && B.time > 120) { t.bank.wood += 0.4 * (D.income - 1) * dt * 3; t.bank.stone += 0.3 * (D.income - 1) * dt * 3; }
    // training queue
    const q = t.queue[0];
    if (q) { q.t -= dt * (1 + qm(t, 'train')); if (q.t <= 0) { t.queue.shift(); const b = t.barracks || t.gateIn; const u = new Unit(t, q.def, b[0] + rand(-2, 2), b[1] + rand(-2, 2)); t.units.push(u); if (t.isMe || t.owner != null) { (t.newly = t.newly || {})[u.udef.name] = (t.newly[u.udef.name] || 0) + 1; t.newlyT = 4; } } }
    updateConstruction(t, dt);
    for (const s of t.towers) if (s.building) { s.building.t += dt; if (s.building.t >= s.building.dur) { s.building = null; s.setLevel(s.level + 1); tsay(t, 'steward', `our ${s === t.towers[0] ? 'right' : 'left'} tower is now a ${TOWER_LEVELS[s.level].name}.`, 'build'); } }
    // new recruits are shown by the head count at the bottom right (it glows), not by a report each time
    if (t.newlyT > 0) { t.newlyT -= dt; if (t.newlyT <= 0) t.newly = null; }
    if ((t.isMe || t.owner != null) && !B.over) watchTown(t, dt);
    if ((t.ai || t.auto) && !B.over) { t.thinkT = (t.thinkT || 0) - dt; if (t.thinkT <= 0) { t.thinkT = (DIFFS[t.diff] || DIFFS.normal).think; aiThink(t); } }
    if (t.hero && t.hero.dead) { t.hero.respawnT -= dt; if (t.hero.respawnT <= 0) t.hero.respawnHero(); }
    if (t.hero && !t.hero.dead && !B.over) heroXp(t.hero, ECON.aiPassiveXp * dt * (t.ai ? (DIFFS[t.diff] || DIFFS.normal).income : 1));
    t.units = t.units.filter(u => !u.gone || u.hero);
  }
  for (const s of B.structs) s.update(dt);
  // units update themselves through G.mobs; clear out the long dead
  for (let i = B.units.length - 1; i >= 0; i--) { const u = B.units[i]; if (u.gone && !u.hero) { G.scene.remove(u.root); B.units.splice(i, 1); const j = G.mobs.indexOf(u); if (j >= 0) G.mobs.splice(j, 1); } }
  // keep troops apart: a soft steering push for near neighbours, a hard nudge only if they really overlap
  const L = B.units; for (const u of L) { u.sepX = 0; u.sepZ = 0; }
  for (let i = 0; i < L.length; i++) { const a = L[i]; if (a.dead) continue; for (let j = i + 1; j < L.length; j++) { const b = L[j]; if (b.dead) continue; const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, rr = (a.radius + b.radius) * 1.35; if (Math.abs(dx) > rr || Math.abs(dz) > rr) continue; const d = Math.hypot(dx, dz) || 0.01; if (d >= rr) continue; const k = (rr - d) / rr, fx = dx / d * k * 3.2, fz = dz / d * k * 3.2; a.sepX -= fx; a.sepZ -= fz; b.sepX += fx; b.sepZ += fz; const hard = a.radius + b.radius; if (d < hard * 0.7) { const c = (hard * 0.7 - d) / d * 0.5; a.pos.x -= dx * c; a.pos.z -= dz * c; b.pos.x += dx * c; b.pos.z += dz * c; } } }
  updateShots(dt);
  fogAndSentries(dt);
}
function fogAndSentries(dt) {
  // fog of war: everything on your side sees around itself
  const src = []; const me = myTown();
  if (G.player && !G.player.dead) src.push({ x: G.player.pos.x, z: G.player.pos.z, r: 58 });
  for (const u of B.units) if (!u.dead && u.team === B.myTeam) src.push({ x: u.pos.x, z: u.pos.z, r: u.worker ? 16 : u.hero ? 40 : 26 });
  for (const s of B.structs) if (!s.dead && s.team === B.myTeam) src.push({ x: s.pos.x, z: s.pos.z, r: s.kind === 'hall' ? 62 : 36 });
  updateFog(dt, src);
  // sentry wards raise the alarm for the whole team
  for (const s of fog.sentries) {
    if (s.dead) continue; s.life -= dt; if (s.life <= 0) { s.dead = true; if (s.mesh) G.scene.remove(s.mesh); continue; }
    s.chk = (s.chk || 0) - dt; if (s.chk > 0) continue; s.chk = 1;
    const foes = B.units.filter(u => !u.dead && u.team !== B.myTeam && Math.hypot(u.pos.x - s.x, u.pos.z - s.z) < s.r);
    const mobs = G.mobs.filter(m => m.team == null && !m.dead && m.def.aggro > 0 && Math.hypot(m.pos.x - s.x, m.pos.z - s.z) < s.r);
    const n = foes.length, nm = mobs.length;
    const cdOk = n ? G.time - (s.alarmU || -99) > 15 : G.time - (s.alarmM || -99) > 40;
    if ((n || nm) && cdOk) { if (n) s.alarmU = G.time; else s.alarmM = G.time; addPing(s.x, s.z); const where = sentryWhere(s); const txt = n ? `our sentry ${where} spotted ${n} enemy ${n > 1 ? 'soldiers' : 'soldier'} on the move!` : `our sentry ${where} spotted ${nm} wild ${nm > 1 ? 'beasts' : 'beast'}.`; if (n && G.hooks.teamSay) G.hooks.teamSay('scout', txt, 'bad'); say('scout', n ? `our sentry ${where} spotted ${n} enemy ${n > 1 ? 'soldiers' : 'soldier'} on the move!` : `our sentry ${where} spotted ${nm} wild ${nm > 1 ? 'beasts' : 'beast'}.`, n ? 'bad' : ''); if (s.mesh) s.mesh.userData.flash = 2; }
    if (s.mesh && s.mesh.userData.flash > 0) s.mesh.userData.flash -= 1;
  }
}
function sentryWhere(s) {
  const me = myTown(); const d = Math.hypot(s.x - me.x, s.z - me.z);
  let best = null, bd = 1e9; for (const t of B.towns) { const dd = Math.hypot(s.x - t.x, s.z - t.z); if (dd < bd) { bd = dd; best = t; } }
  return bd < 120 ? (best.isMe ? 'by our walls' : `near ${best.name}`) : d < 250 ? 'on the near road' : 'out in the wilds';
}
// a sentry ward placed by a ranger: watches a wide circle and pings the map when enemies come near
export function placeSentry(x, z, lv) {
  const g = new THREE.Group(); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.2, 6), mat('#5a3a20')); pole.position.y = 1.1; g.add(pole);
  const eye = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), new THREE.MeshStandardMaterial({ color: '#9fe8ff', emissive: '#40c0ff', emissiveIntensity: 1.6 })); eye.position.y = 2.4; g.add(eye);
  for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.6), mat('#3a7a3a', 0.9, 0, { side: THREE.DoubleSide })); f.position.set(0.2 * s, 1.9, 0); f.rotation.y = s; g.add(f); }
  g.position.set(x, heightAt(x, z), z); G.scene.add(g);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#60d0ff', transparent: true, opacity: 0.35, depthWrite: false }));
  const r = 40 + lv * 1.2; ring.scale.setScalar(r); ring.position.set(x, heightAt(x, z) + 0.2, z); G.scene.add(ring);
  const s = { x, z, r, life: 150, mesh: g, ring }; fog.sentries.push(s);
  G.timers.push({ update(dt) { eye.rotation.y += dt * 2; eye.position.y = 2.4 + Math.sin(G.time * 3) * 0.08; ring.material.opacity = s.mesh.userData.flash > 0 ? 0.8 : 0.3; if (s.dead) { G.scene.remove(ring); return true; } } });
  if (fog.sentries.filter(q => !q.dead).length > 4) { const old = fog.sentries.find(q => !q.dead); old.life = 0; }
  say('scout', `a sentry ward stands watch ${sentryWhere(s)}. I will warn you if anything comes near.`, '');
  return s;
}
export { TEAM_COLORS, TEAM_NAMES, TOWN_LEVELS, TOWER_LEVELS };
