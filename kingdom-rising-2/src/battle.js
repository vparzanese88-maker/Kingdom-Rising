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
function house(g, race, x, z, rot, s = 1, lvl = 0) {
  const st = STYLE[race] || STYLE.human, y = heightAt(x, z), h = new THREE.Group(); h.position.set(x, y, z); h.rotation.y = rot; h.scale.setScalar(s); g.add(h);
  if (lvl >= 2 && (race === 'human' || race === 'dwarf')) { h.position.y += 0; const up = new THREE.Group(); up.position.y = 2.6; h.add(up); box(up, 5.2, 2.4, 4.2, mat(race === 'human' ? st.wall2 : st.stone, 0.95), 0, 1.2, 0); for (const xx of [-2.55, 2.55]) box(up, 0.2, 2.4, 4.25, mat(st.dark), xx, 1.2, 0); h.position.y += 0; h.userData.tall = true; }
  if (race === 'human') { box(h, 5, 3, 4, mat(st.wall2, 0.95), 0, 1.5, 0); for (const xx of [-2.45, 2.45]) box(h, 0.2, 3, 4.05, mat(st.dark), xx, 1.5, 0); const r = cone(h, 4.2, 2.6, mat(Math.random() < 0.5 ? st.roof : st.roof2, 0.9), 0, 4.3, 0, 4, Math.PI / 4); r.scale.set(1.1, 1, 0.85); box(h, 0.6, 1.6, 0.6, mat(st.stone), 1.4, 4.6, 0.8); }
  else if (race === 'orc') { cyl(h, 2.4, 2.7, 2.2, mat(st.wood), 0, 1.1, 0, 9); cone(h, 3.3, 3.2, mat(Math.random() < 0.5 ? st.roof : '#a8784a', 0.95), 0, 3.8, 0, 9); for (let i = 0; i < 4; i++) { const a = i / 4 * 6.28; cone(h, 0.12, 1.1, mat('#e8dfc4', 0.8), Math.cos(a) * 1.6, 5.2, Math.sin(a) * 1.6, 5); } }
  else if (race === 'highelf') { cyl(h, 2.0, 2.2, 5.5, mat(st.wall2, 0.8), 0, 2.75, 0, 10); cyl(h, 2.25, 2.25, 0.25, mat(st.trim, 0.5, 0.6), 0, 5.4, 0, 10); cone(h, 2.5, 4.2, mat(Math.random() < 0.5 ? st.roof : st.roof2, 0.6), 0, 7.6, 0, 10); }
  else if (race === 'woodelf') { cyl(h, 0.8, 1.2, 6, mat(st.wood), 0, 3, 0, 7); ball(h, 3.2, mat('#3e7a2e', 0.9), 0, 6.5, 0, 1); cyl(h, 2.4, 2.4, 2.2, mat('#8a6a40'), 0, 2.4, 0, 9); cone(h, 2.9, 1.8, mat(st.roof, 0.9), 0, 4.4, 0, 9); }
  else { box(h, 5.5, 2.6, 4.5, mat(st.stone, 0.95), 0, 1.3, 0); const r = cone(h, 4.4, 1.8, mat(st.roof, 0.7, 0.3), 0, 3.5, 0, 4, Math.PI / 4); r.scale.set(1.15, 1, 0.95); box(h, 0.8, 2, 0.8, mat(st.stone), 1.6, 4, 1); }
  if (h.userData.tall) for (const c of h.children) if (c.position.y >= 3.4) c.position.y += 2.4;
  addCircle(x, z, 2.9 * s, 'house');
}
// storehouse: where peasants and heroes unload wood and stone
function buildStorehouse(g, t) {
  const [x, z] = t.storeSpot, y = heightAt(x, z), s = new THREE.Group(); s.position.set(x, y, z); s.rotation.y = Math.atan2(-t.perp[0], -t.perp[1]); g.add(s);
  const st = STYLE[t.race] || STYLE.human, wood = mat(st.wood), dark = mat(st.dark), roof = mat(st.roof, 0.85);
  for (const [px, pz] of [[-3.2, -1.8], [3.2, -1.8], [-3.2, 1.8], [3.2, 1.8]]) cyl(s, 0.16, 0.18, 3.6, dark, px, 1.8, pz, 6);
  const r = box(s, 7.4, 0.25, 4.6, roof, 0, 3.75, 0.2); r.rotation.x = -0.18;
  box(s, 7, 2.2, 0.2, wood, 0, 1.1, -1.9);
  for (let i = 0; i < 9; i++) { const c = add(s, new THREE.CylinderGeometry(0.22, 0.22, 2.4, 7), mat('#8a6238'), -1.7, 0.24 + Math.floor(i / 3) * 0.4, -1.1 + (i % 3) * 0.46); c.rotation.set(0, 0, Math.PI / 2); }
  for (let i = 0; i < 7; i++) ball(s, 0.38 + (i % 3) * 0.08, mat('#8a847a', 0.95), 1.4 + (i % 3) * 0.6, 0.3 + (i > 3 ? 0.5 : 0), -1.0 + Math.floor(i / 3) * 0.55, 0);
  const sign = box(s, 2.6, 0.9, 0.1, mat('#6a4a2a'), 0, 3.1, 2.3); sign.rotation.x = 0.1;
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
  cyl(s, 0.08, 0.1, 5, mat('#4a3020'), 2.6, 2.5, 1.6, 5); const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), mat(TEAM_COLORS[t.team], 0.9, 0, { side: THREE.DoubleSide })); fl.position.set(3.2, 4.6, 1.6); s.add(fl);
  addCircle(x, z, 2.2, 'house');
}
// what a town gains with each upgrade: plaza, market, smithy, temple, keep, lamps and statues
function townExtras(g, t, lvl) {
  const st = STYLE[t.race] || STYLE.human, ag = Math.atan2(t.dir[1], t.dir[0]);
  const polar = (a, r) => [t.x + Math.cos(ag + a) * r, t.z + Math.sin(ag + a) * r];
  const place = (x, z, rot) => { const s = new THREE.Group(); s.position.set(x, heightAt(x, z), z); s.rotation.y = rot; g.add(s); return s; };
  const face = (x, z) => Math.atan2(t.x - x, t.z - z);
  if (lvl >= 1) {
    // stone plaza around the hall
    const pz = place(t.x, t.z, 0); cyl(pz, 13 + lvl * 1.5, 13 + lvl * 1.5, 0.12, mat(lvl >= 2 ? '#a8a294' : '#8a7a62', 0.95), 0, 0.02, 0, 32);
    // market stalls either side of the road to the hall
    for (const sd of [-1, 1]) for (let k = 0; k < 2; k++) { const [x, z] = polar(sd * (0.42 + k * 0.28), 15); const s = place(x, z, face(x, z)); for (const [px, pz2] of [[-1.2, -0.8], [1.2, -0.8], [-1.2, 0.8], [1.2, 0.8]]) cyl(s, 0.06, 0.06, 2.2, mat(st.dark), px, 1.1, pz2, 5); box(s, 2.8, 0.1, 2, mat(['#c83a2a', '#e0c040', '#3a7ac8', '#3aa04a'][(k + (sd > 0 ? 2 : 0)) % 4], 0.9), 0, 2.25, 0); box(s, 2.4, 0.8, 0.9, mat(st.wood), 0, 0.4, 0.3); for (let i = 0; i < 4; i++) ball(s, 0.16, mat(['#e04030', '#f0c040', '#80c040', '#c08040'][i]), -0.8 + i * 0.5, 0.95, 0.3, 0); addCircle(x, z, 1.3, 'house'); }
    // smithy with a glowing forge and smoke
    { const [x, z] = polar(-Math.PI * 0.55, 16); t.houses.push([x, z]); const s = place(x, z, face(x, z)); box(s, 5, 2.6, 4, mat(st.stone, 0.95), 0, 1.3, 0); const r = cone(s, 4, 2, mat(st.roof, 0.85), 0, 3.6, 0, 4, Math.PI / 4); r.scale.set(1.1, 1, 0.9); box(s, 0.9, 3.5, 0.9, mat(st.stone), 1.6, 3.5, -1); box(s, 1.2, 0.8, 1, mat('#ff5a10', 0.6, 0, { emissive: '#ff4a00', emissiveIntensity: 1.6 }), -1, 0.7, 2.05); box(s, 0.8, 0.8, 0.5, mat('#3a3a3e', 0.5, 0.8), 1.3, 0.6, 2.4); addBox(x, z, 2.6, 2.1, face(x, z), 'house'); (world.smokes = world.smokes || []).push(V3(x + Math.cos(ag) * 0, heightAt(x, z) + 5.5, z)); }
  }
  if (lvl >= 2) {
    // temple behind the hall
    const [x, z] = polar(Math.PI, 16.5); t.houses.push([x, z]); const s = place(x, z, face(x, z));
    const light = t.race === 'orc' ? '#8a3a2a' : t.race === 'highelf' ? '#f4f0e6' : st.stone;
    box(s, 7, 4, 5, mat(light, 0.9), 0, 2, 0); for (let i = 0; i < 4; i++) cyl(s, 0.3, 0.3, 4, mat(st.wall2, 0.9), -2.6 + i * 1.75, 2, 2.8, 8);
    const r = cone(s, 5.6, 2.6, mat(st.roof, 0.7), 0, 5.3, 0, 4, Math.PI / 4); r.scale.set(1.2, 1, 0.85);
    ball(s, 0.5, mat(st.trim, 0.3, 0.9, { emissive: st.trim, emissiveIntensity: 0.4 }), 0, 7, 0, 1); addBox(x, z, 3.6, 2.8, face(x, z), 'house');
  }
  if (lvl >= 3) {
    // a tall keep tower beside the hall, statues by the road and lamp posts
    const [x, z] = polar(Math.PI * 0.8, 11); const s = place(x, z, 0);
    cyl(s, 2.4, 2.8, 20, mat(st.stone, 0.9), 0, 10, 0, 10); cyl(s, 2.9, 2.9, 0.6, mat(st.trim, 0.4, 0.7), 0, 20, 0, 10); cone(s, 3, 5, mat(st.roof, 0.7), 0, 22.8, 0, 10);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), mat(TEAM_COLORS[t.team], 0.9, 0, { side: THREE.DoubleSide })); fl.position.set(1.4, 26.5, 0); s.add(fl); cyl(s, 0.08, 0.08, 4, mat('#4a3020'), 0, 26, 0, 5);
    addCircle(x, z, 2.9, 'house');
    for (const sd of [-1, 1]) { const [sx, sz] = polar(sd * 0.22, 26); const q = place(sx, sz, face(sx, sz)); box(q, 1.4, 1.2, 1.4, mat(st.stone), 0, 0.6, 0); const fig = new THREE.Group(); fig.position.y = 1.2; q.add(fig); cyl(fig, 0.35, 0.45, 1.8, mat(st.trim, 0.35, 0.85), 0, 0.9, 0, 8); ball(fig, 0.32, mat(st.trim, 0.35, 0.85), 0, 2.1, 0, 1); addCircle(sx, sz, 0.9, 'house'); }
  }
  if (lvl >= 1) for (let k = 0; k < 4 + lvl * 2; k++) { const a = (k / (4 + lvl * 2)) * Math.PI * 2 + 0.3; if (Math.abs(angDiff(a, 0)) < 0.35) continue; const [x, z] = polar(a, 9.5); const s = place(x, z, 0); cyl(s, 0.07, 0.09, 3, mat('#2a2a2e', 0.5, 0.7), 0, 1.5, 0, 6); ball(s, 0.22, mat('#ffd890', 0.4, 0, { emissive: '#ffb050', emissiveIntensity: 2 }), 0, 3.1, 0, 1); }
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
    // Smite rule: heroes can only damage a tower from inside its circle
    if (src && (src === G.player || src.hero) && this.kind === 'tower' && Math.hypot(src.pos.x - this.pos.x, src.pos.z - this.pos.z) > this.range + 0.5) { if (src === G.player) V.number(this.pos.clone().setY(this.pos.y + 6), 'Out of range', 'miss'); return 0; }
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
    onStructDown(this, src);
  }
  update(dt) {
    if (this.dead) return;
    this.hitT = Math.max(0, (this.hitT || 0) - dt);
    if (this.ring) { const p = G.player, d = p ? Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z) : 999; this.ring.visible = d < this.range + 30; if (this.ring.visible) { const foe = this.team !== B.myTeam, inside = d < this.range; this.ring.material.color.set(foe ? (inside ? '#ff3020' : '#ff8a60') : '#5aa0ff'); this.ring.material.opacity = inside ? 0.85 : 0.45; } }
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
function shoot(src, tgt, from, dmg, kind, opts = {}) {
  const m = new THREE.Mesh(SHOT_GEO[kind] || SHOT_GEO.arrow, SHOT_MAT[kind] || SHOT_MAT.arrow); m.position.copy(from); G.scene.add(m);
  B.shots.push({ m, src, tgt, dmg, kind, opts, t: 0, from: from.clone(), arc: kind === 'arrow' || kind === 'bolt' ? 1 : 0 });
  if (kind === 'bullet') { S.explode(from, 0.25, 'fire'); V.burst('smoke', from, 8, { speed: 1.5, size: 0.8, life: 1.2 }); V.light(from, '#ffb050', 4, 0.1); }
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
function hurt(t, dmg, src, opts = {}) {
  if (t.dead || B.over) return;
  if (t === G.player) { t.takeDamage(dmg, src, opts); if (opts.slow) t.debuff && t.debuff('slow', opts.slow); return; }
  if (t.isStruct) return t.takeHit(dmg, src, opts);
  t.takeHit(dmg, src, Object.assign({ fromUnit: true }, opts));
}
function foesNear(team, p, r) { const out = []; for (const u of B.units) if (!u.dead && u.team !== team && Math.hypot(u.pos.x - p.x, u.pos.z - p.z) < r + u.radius) out.push(u); return out; }
export function allHeroes() { const out = []; if (G.player && B.on) { G.player.team = B.myTeam; G.player.hero = true; out.push(G.player); } for (const u of B.units) if (u.hero) out.push(u); return out; }

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
    dmg = Math.max(1, Math.round(dmg * (1 - (this.udef.armor || 0) * 0.6)));
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
    if (this.order === 'follow' && G.player && this.team === B.myTeam) return [G.player.pos.x + Math.sin(this.id) * 4, G.player.pos.z + Math.cos(this.id) * 4];
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
    const spd = this.udef.speed * (st.slow > 0 ? 0.55 : 1);
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
          else if (this.range && d <= this.range) { if (this.atkCd <= 0 && !this.action) { this.atkCd = this.udef.cd * rand(0.9, 1.15); this.startAction(this.udef.wt && this.udef.wt.includes('staff') ? 'cast' : 'shoot', 0.6); const kind = this.udef.proj || 'arrow'; shoot(this, tg, this.handPos(), this.dmg * rand(0.85, 1.15), kind, { splash: this.udef.splash, slow: this.udef.slow }); } }
          else if (!this.range && d <= this.reach) { if (this.atkCd <= 0 && !this.action) { this.atkCd = this.udef.cd * rand(0.9, 1.15); this.startAction(this.udef.kind === 'troll' || this.udef.wt === 'warhammer' ? 'slam' : ['swing1', 'swing2', 'swing3'][Math.floor(Math.random() * 3)], 0.75); this.pending = tg; this.hitAt = 0.5; } }
          else { want = [tg.pos.x, tg.pos.z]; speed = spd; }
        } else { const g = this.goal(); if (Math.hypot(g[0] - this.pos.x, g[1] - this.pos.z) > 1.2) { want = g; speed = spd * (this.order === 'defend' ? 0.8 : 1); } else if (this.order === 'defend') this.faceTo(V3(this.pos.x + this.town.dir[0], 0, this.pos.z + this.town.dir[1]), dt, 3); }
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
    if (this.root.visible) { if (this.udef.quad) animQuad(this.model, dt, { speed: disabled ? 0 : Math.min(speed, realSp * 1.1), action: this.action ? 'attack' : null, actionT: this.actionT }); else animateHumanoid(this.model, dt, { speed: disabled ? 0 : Math.min(speed, realSp * 1.1), action: this.action, actionT: this.actionT, armed: true }); }
  }
  startAction(a, dur) { this.action = a; this.actionT = 0; this.actionDur = dur; }
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
  u.work += dt * (1 + up(t, 'tools') * 0.2);
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
const CLASS_HERO = { warrior: { wt: 'swordshield', range: 0, proj: null }, berserker: { wt: 'greataxe', range: 0 }, ranger: { wt: 'bow', range: 24, proj: 'arrow' }, wizard: { wt: 'firestaff', range: 22, proj: 'fire', splash: 3 } };
function makeAIHero(t) {
  const cls = t.heroCls || AI_CLASS[t.race] || 'warrior', H = CLASS_HERO[cls];
  const def = { id: 'hero', name: 'Hero', role: H.range ? 'ranged' : 'melee', hp: 330, dmg: 24, cd: H.range ? 1.4 : 1.1, speed: 5.4, range: H.range, proj: H.proj, splash: H.splash, wt: H.wt, tier: 2, armor: 0.25, size: 1, pop: 0, cost: { gold: 0 } };
  const app = { cls, outfit: cls, spec: undefined, sex: Math.random() < 0.3 ? 'f' : 'm' };
  const u = new Unit(t, def, t.x, t.z + 0.01, { hero: true, lv: 1, app, order: 'defend' });
  u.model.root.scale.setScalar(1.05);
  u.heroName = (t.heroName || ['Aldric', 'Grommash', 'Faelar', 'Sylvaine', 'Borin'][Math.floor(Math.random() * 5)]); u.heroLv = 1; u.xp = 0; u.cls = cls; u.abilCd = 6;
  heroStats(u); t.hero = u; return u;
}
function heroStats(u) { const L = u.heroLv; const k = u.hp / u.maxHp; u.maxHp = Math.round(330 + L * 95 + u.town.level * 60); u.hp = Math.round(u.maxHp * k); u.dmg = 24 + L * 6.5; u.lv = L; }
export function heroXp(u, n) { if (u.heroLv >= 20) return; u.xp += n; while (u.heroLv < 20 && u.xp >= ECON.xpNeed(u.heroLv)) { u.xp -= ECON.xpNeed(u.heroLv); u.heroLv++; heroStats(u); u.hp = u.maxHp; bank(u.town, 'gold', ECON.levelGold(u.heroLv)); } }
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
export function bank(t, k, n) { if (k === 'gold' && t.isMe && G.save) { t.gf = (t.gf || 0) + n; const w = t.gf >= 0 ? Math.floor(t.gf) : Math.ceil(t.gf); t.gf -= w; G.save.gold = Math.max(0, G.save.gold + w); } else t.bank[k] = Math.max(0, (t.bank[k] || 0) + n); if (t.isMe && k !== 'gold' && n > 0 && G.hooks.resGained) G.hooks.resGained(k, n); }
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
  pay(t, F.costs[r]); (t.up = t.up || {})[id] = r + 1; if (t.isMe) say('steward', `${({ housing: 'new cottages are up: we can take on more peasants', tools: 'the peasants have sharper tools: they work faster now', boots: 'the peasants have new boots: they move faster now', sacks: 'bigger sacks for the peasants: they haul more each trip' })[id]} (rank ${r + 1}).`, 'build'); return null;
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
  pay(t, L.cost); s.building = { t: 0, dur: L.time }; if (t.isMe) say('steward', `we are strengthening our ${s === t.towers[0] ? 'right' : 'left'} tower.`, 'build'); return null;
}
export function repairTower(s) {
  const t = s.town; if (s.dead) return 'Destroyed'; if (s.hp >= s.maxHp) return 'Not damaged';
  if (!canPay(t, TOWER_REPAIR)) return 'Not enough resources';
  pay(t, TOWER_REPAIR); if (t.isMe) say('steward', `masons are patching up our ${s === t.towers[0] ? 'right' : 'left'} tower.`, 'build'); s.hp = Math.min(s.maxHp, s.hp + s.maxHp * 0.25); V.burst('wood', s.pos.clone().setY(s.pos.y + 4), 20, { speed: 3 }); return null;
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
  const tg = B.towns[targetIdx]; if (!tg || tg.dead || tg.team === t.team) return 'No target';
  const army = t.units.filter(u => !u.dead && !u.worker && !u.hero && u.order !== 'attack');
  const n = Math.max(1, Math.round(army.length * frac)); if (!army.length) return 'No troops to send';
  const path = pathTo(t, tg);
  t.lastAttackT = Math.round(B.time);
  for (const u of army.slice(0, n)) { u.order = 'attack'; u.path = path; u.pi = 0; u.targetTown = tg; u.target = null; }
  t.lastAttack = targetIdx;
  if (t.isMe) say('captain', `${n} of our soldiers march ${directionOf(t, tg).toLowerCase()} on ${tg.name}!`, 'war');
  return null;
}
// abilities that touch your army: rally heals and empowers nearby troops, wolves fight for you
export function rallyTroops(p, r) { const t = myTown(); for (const u of t.units) if (!u.dead && !u.worker && Math.hypot(u.pos.x - p.x, u.pos.z - p.z) < r) { u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.3); u.rally = B.time + 10; V.burst('gold', u.pos.clone().setY(u.pos.y + 1.5), 8, { speed: 2, vy: 2 }); } }
export function summonWolves(p, lv, dur) { const t = myTown(); for (let k = 0; k < 2; k++) { const def = { id: 'wolfpet', name: 'Spirit Wolf', role: 'melee', hp: 260 + lv * 45, dmg: 14 + lv * 3.5, cd: 1.0, speed: 7, range: 0, armor: 0.15, size: 1.35, quad: 'wolf', col: '#c8d8f0', pop: 0, cost: { gold: 0 } }; const u = new Unit(t, def, p.x + (k ? 2 : -2), p.z - 2, { order: 'follow' }); u.expire = dur; u.pet = true; t.units.push(u); V.burst('frost', u.pos.clone().setY(u.pos.y + 0.8), 25, { speed: 3 }); } }
export function recall(t) { for (const u of t.units) if (!u.worker && !u.hero) { u.order = 'defend'; u.path = null; u.target = null; } }
export function setFollow(t) { for (const u of t.units) if (!u.worker && !u.hero) { u.order = 'follow'; u.path = null; } }

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
  if (t.isMe) say('steward', `the builders are at work. ${t.name} will be a ${TOWN_LEVELS[t.level + 1].name} within the minute.`, 'build');
}
function updateConstruction(t, dt) {
  const b = t.building; if (!b) return;
  b.t += dt;
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
  if (b.t >= b.dur) finishConstruction(t);
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
  if (t.isMe) { say('steward', `it is done! ${t.name} is now a ${TOWN_LEVELS[t.level].name}. We can field ${popCap(t)} soldiers and ${peasantCap(t)} peasants.`, 'big'); S.levelUp(); }
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
  else if (t.isMe) say('captain', `our ${s === t.towers[0] ? 'right' : 'left'} archer tower has fallen!`, 'bad');
  else if (killer && killer.isMe) say('captain', `an enemy tower at ${t.name} lies in ruins. Well fought!`, 'good');
}
// xp is shared, unsplit, with allied heroes close by
function giveXp(town, src, n, at) {
  for (const h of allHeroes()) { if (h.dead || h.team !== town.team) continue; if (h !== src && Math.hypot(h.pos.x - at.x, h.pos.z - at.z) > 45) continue; if (h === G.player) G.hooks.battleXp && G.hooks.battleXp(n); else heroXp(h, n); }
}
function eliminate(t, by) {
  t.dead = true;
  if (by && by.isMe) say('captain', `${t.name} has fallen! Their kingdom is broken. Glory to you, Commander!`, 'big'); else if (!t.isMe && by) say('scout', `${t.name} has fallen to ${by.name}.`, 'war');
  for (const u of t.units) if (!u.dead) { u.takeHit(u.hp + 1, null, { silent: true }); }
  for (const s of B.structs) if (s.town === t && !s.dead) s.destroy(null);
  G.hooks.banner && G.hooks.banner(`${t.name} has fallen!`, by ? `Destroyed by ${by.name}` : '', 4000);
  checkWin();
}
function checkWin() {
  const alive = B.towns.filter(t => !t.dead); const teams = new Set(alive.map(t => t.team));
  const me = myTown();
  if (me.dead && !B.over) { B.over = true; B.result = 'defeat'; G.hooks.matchOver && G.hooks.matchOver('defeat'); }
  else if (teams.size <= 1 && !B.over) { B.over = true; B.result = 'victory'; G.hooks.matchOver && G.hooks.matchOver('victory'); }
}
export function myTown() { return B.towns[B.me]; }
// reports to the player, who is the Commander
function say(who, text, kind) { G.hooks.cmd && G.hooks.cmd(who, text, kind); }
// scouts and captains warn about threats to the town and its towers
function watchTown(t, dt) {
  t.watchT = (t.watchT || 0) - dt; if (t.watchT > 0) return; t.watchT = 1;
  const foes = B.units.filter(u => !u.dead && u.team !== t.team && !u.worker && Math.hypot(u.pos.x - t.x, u.pos.z - t.z) < WALL_R + 60);
  if (foes.length >= 3 && B.time > (t.warnT || 0)) { t.warnT = B.time + 45; const from = B.towns.find(o => o.team === foes[0].team); say('scout', `the enemy is at our gates! ${foes.length} ${from ? from.name : 'enemy'} soldiers near the walls!`, 'bad'); }
  for (const s of t.towers) { if (s.dead) continue; const k = s.hp / s.maxHp; if (k < 0.5 && !s.warned50) { s.warned50 = true; say('captain', `our ${s === t.towers[0] ? 'right' : 'left'} tower is badly damaged!`, 'bad'); } if (k > 0.8) s.warned50 = false; }
  if (t.hall.hp / t.hall.maxHp < 0.5 && !t.hallWarn) { t.hallWarn = true; say('steward', 'the Town Hall is burning! If it falls, we are lost!', 'bad'); }
  const ours = t.units.filter(u => !u.dead && u.order === 'attack'); if (ours.length) { const tg = ours[0].targetTown; if (tg && ours.some(u => Math.hypot(u.pos.x - tg.x, u.pos.z - tg.z) < WALL_R + 40) && t.siegeSaid !== tg.i + ':' + t.lastAttackT) { t.siegeSaid = tg.i + ':' + t.lastAttackT; say('captain', `our army has reached ${tg.name} and is storming the walls!`, 'war'); } }
}

// ---------- AI commander ----------
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
  B.on = true; B.myTeam = SETUP.towns[0].team ?? 0;
  const used = {};
  SETUP.towns.forEach((cfg, i) => {
    const L = LAYOUT.towns[i];
    const race = cfg.race || 'human'; used[race] = (used[race] || 0);
    const t = Object.assign({}, L, { race, ai: i !== 0 && cfg.ai !== false, diff: cfg.diff || 'normal', team: cfg.team ?? i, level: 0, units: [], queue: [], towerSpots: L.towers, bank: Object.assign({}, ECON.start), dead: false, isMe: i === 0, roster: ROSTERS[race] || ROSTERS.human });
    t.name = cfg.name || TOWN_NAMES[race][used[race]++ % 4]; t.color = TEAM_COLORS[t.team]; t.heroCls = cfg.cls;
    B.towns.push(t);
  });
  for (const t of B.towns) {
    t.wallMesh = mergeGroup(buildWalls(t, 0)); scene.add(t.wallMesh); wallColliders(t);
    t.innerMesh = mergeGroup(buildInner(t, 0)); scene.add(t.innerMesh);
    t.hall = new Structure(t, 'hall', t.x, t.z); B.structs.push(t.hall); G.mobs.push(t.hall);
    for (const [x, z] of t.towerSpots) { const s = new Structure(t, 'tower', x, z); B.structs.push(s); G.mobs.push(s); }
    t.towers = B.structs.filter(s => s.town === t && s.kind === 'tower');
    if (t.ai) makeAIHero(t);
    if (t.isMe) { t.auto = true; t.diff = 'normal'; }
  }
  for (const s of B.structs) s.hostile = s.team !== B.myTeam;
}
export function update(dt) {
  if (!B.on) return;
  if (!B.over) B.time += dt;
  for (const t of B.towns) {
    if (t.dead) continue;
    // passive income
    const D = t.ai ? DIFFS[t.diff] || DIFFS.normal : { income: 1.15 };
    bank(t, 'gold', (ECON.passiveGold + ECON.passiveGoldPerLevel * t.level) * D.income * dt);
    if (t.ai && D.income > 1 && B.time > 120) { t.bank.wood += 0.4 * (D.income - 1) * dt * 3; t.bank.stone += 0.3 * (D.income - 1) * dt * 3; }
    // training queue
    const q = t.queue[0];
    if (q) { q.t -= dt; if (q.t <= 0) { t.queue.shift(); const b = t.barracks || t.gateIn; const u = new Unit(t, q.def, b[0] + rand(-2, 2), b[1] + rand(-2, 2)); t.units.push(u); if (t.isMe) { (t.newly = t.newly || {})[u.udef.name] = (t.newly[u.udef.name] || 0) + 1; t.newlyT = 4; } } }
    updateConstruction(t, dt);
    for (const s of t.towers) if (s.building) { s.building.t += dt; if (s.building.t >= s.building.dur) { s.building = null; s.setLevel(s.level + 1); if (t.isMe) say('steward', `our ${s === t.towers[0] ? 'right' : 'left'} tower is now a ${TOWER_LEVELS[s.level].name}.`, 'build'); } }
    if (t.newlyT > 0) { t.newlyT -= dt; if (t.newlyT <= 0 && t.newly) { const parts = Object.entries(t.newly).map(([k, v]) => `${v > 1 ? v + ' ' + k + 's' : (/^[AEIOU]/.test(k) ? 'an ' : 'a ') + k}`); const peas = t.newly[t.roster.worker.name]; say(peas && parts.length === 1 ? 'steward' : 'captain', peas && parts.length === 1 ? `${parts[0]} joined the work crews. (${peasants(t)}/${peasantCap(t)} peasants)` : `${parts.join(', ')} ${parts.length > 1 || parts[0].match(/^\d/) ? 'have' : 'has'} joined the ranks. (${pop(t)}/${popCap(t)} soldiers)`, 'good'); t.newly = null; } }
    if (t.isMe && !B.over) watchTown(t, dt);
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
}
export { TEAM_COLORS, TEAM_NAMES, TOWN_LEVELS, TOWER_LEVELS };
