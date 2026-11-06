// Kingdom Arena: the Ruins of Aldermere. A small fantasy town in ruins with two team bases (south and north) and three
// ways to the centre plaza: the left rampart (high walkway), the middle street (houses with balconies either side) and
// the right garden (through a chapel you can walk into, with a loggia to shoot from). Stairs, ramps, raised platforms,
// low walls for cover, an ancient glowing tree in the middle. Side spawn rooms (east and west) for 3- and 4-team games.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { addBox, addSurface, addCircle } from './world.js';
import { AR, COLORS } from './arenamap.js';

const Y = 3; // ground level
const S = (c, r = 0.9, m = 0, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: r, metalness: m }, o));
let M = null, root = null;
const geoBuckets = new Map(); // material -> geometries, merged at the end into one mesh each
function put(geo, mat, x, y, z, ry = 0, rx = 0, sh = true) { const m4 = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
  let g = geo.index ? geo.toNonIndexed() : geo.clone(); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  g.applyMatrix4(m4); const k = mat.uuid + (sh ? 's' : ''); if (!geoBuckets.has(k)) geoBuckets.set(k, { mat, sh, list: [] }); geoBuckets.get(k).list.push(g); }
const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d);

// ---- the level kit ----
// a solid block you cannot walk through, whose top you can stand on
function block(x, z, w, d, y0, h, mat = M.stone, top = M.moss, walk = true) {
  put(BOX(w, h, d), mat, x, y0 + h / 2, z); if (top) put(BOX(w + 0.08, 0.12, d + 0.08), top, x, y0 + h + 0.06, z, 0, 0, false);
  addBox(x, z, w / 2, d / 2, 0, 'map', y0, y0 + h); if (walk) addSurface(x, z, w / 2, d / 2, 0, y0 + h); }
// a wall you can neither climb nor walk through
function wall(x, z, w, d, y0, h, mat = M.stone) { put(BOX(w, h, d), mat, x, y0 + h / 2, z); addBox(x, z, w / 2, d / 2, 0, 'map', y0, y0 + h + 50); }
// stairs (or a ramp) from (x1,z1,y1) to (x2,z2,y2), w wide; solid underneath so nobody walks through the high end
function stairs(x1, z1, y1, x2, z2, y2, w, mat = M.stone2, steps = true) {
  const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz), rot = Math.atan2(dx, dz), cx = (x1 + x2) / 2, cz = (z1 + z2) / 2, lo = Math.min(y1, y2);
  addSurface(cx, cz, w / 2, len / 2, rot, y1, 0, y2);
  const n = steps ? Math.max(3, Math.round(Math.abs(y2 - y1) / 0.25)) : 1;
  if (steps) for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n, yt = y1 + (y2 - y1) * t1, h = Math.max(0.05, yt - lo), seg = len / n; put(BOX(w, h, seg + 0.02), mat, x1 + dx * (t0 + t1) / 2, lo + h / 2, z1 + dz * (t0 + t1) / 2, rot); }
  else { const g = BOX(w, 0.3, len); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const t = (p.getZ(i) / len + 0.5); p.setY(i, p.getY(i) + (y1 + (y2 - y1) * t) - lo); } g.computeVertexNormals(); put(g, mat, cx, lo, cz, rot); }
  for (let i = 1; i < 4; i++) { const t = i / 4, yb = y1 + (y2 - y1) * (y2 > y1 ? t - 0.25 : t), hy = Math.min(y1, y2) + Math.abs(y2 - y1) * (y2 > y1 ? (i - 1) / 4 : (4 - i) / 4); if (hy - lo < 0.9) continue;
    addBox(x1 + dx * (t - 0.125), z1 + dz * (t - 0.125), w / 2, len / 8, rot, 'map', lo, hy); }
  for (const s of [-1, 1]) put(BOX(0.25, 0.5, len), M.stone, cx + Math.cos(rot) * s * (w / 2 + 0.12), (y1 + y2) / 2 + 0.25, cz - Math.sin(rot) * s * (w / 2 + 0.12), rot, -Math.atan2(y2 - y1, len), false); // low side kerbs
}
// a two-storey timber-framed house: doors, windows, an upper floor you reach by outside stairs, a balcony, a tiled roof
function house(x, z, w, d, ry, opts = {}) {
  const g = new THREE.Group(); const H1 = 3.4, H2 = 3.0, t = 0.4, fy = Y + H1, cos = Math.cos(ry), sin = Math.sin(ry);
  const at = (lx, lz) => [x + lx * cos + lz * sin, z - lx * sin + lz * cos];
  const seg = (lx, lz, len, alongX, y0, h, mat, solid = true) => { const [wx, wz] = at(lx, lz); put(BOX(alongX ? len : t, h, alongX ? t : len), mat, wx, y0 + h / 2, wz, ry); if (solid) addBox(wx, wz, (alongX ? len : t) / 2, (alongX ? t : len) / 2, ry, 'map', y0, y0 + h); };
  // ground floor walls: a door in the front (+z) and back (-z) if asked
  const door = 1.8;
  for (const sz of [-1, 1]) { const hasDoor = sz > 0 ? opts.front !== false : !!opts.back; const lz = sz * d / 2;
    if (hasDoor) { const side = (w - door) / 2; seg(-w / 2 + side / 2, lz, side, true, Y, H1, M.plaster); seg(w / 2 - side / 2, lz, side, true, Y, H1, M.plaster); seg(0, lz, door, true, Y + 2.4, H1 - 2.4, M.plaster); }
    else seg(0, lz, w, true, Y, H1, M.plaster); }
  for (const sx of [-1, 1]) seg(sx * w / 2, 0, d, false, Y, H1, M.plaster);
  // timber frame beams on the plaster
  for (const sz of [-1, 1]) { const [bx, bz] = at(0, sz * (d / 2 + 0.22)); put(BOX(w + 0.1, 0.25, 0.08), M.timber, bx, Y + H1 - 0.15, bz, ry, 0, false); put(BOX(w + 0.1, 0.2, 0.08), M.timber, bx, Y + 0.1, bz, ry, 0, false);
    for (const lx of [-w / 2 + 0.1, w / 2 - 0.1, -w / 4, w / 4]) { const [px, pz] = at(lx, sz * (d / 2 + 0.22)); put(BOX(0.2, H1, 0.08), M.timber, px, Y + H1 / 2, pz, ry, 0, false); } }
  // the upper floor slab: walk on top of it, walk under it
  { const [cx, cz] = at(0, 0); put(BOX(w + 0.2, 0.3, d + 0.2), M.timber, cx, fy + 0.15, cz, ry); addSurface(cx, cz, w / 2, d / 2, ry, fy + 0.3); addBox(cx, cz, w / 2 + 0.1, d / 2 + 0.1, ry, 'map', fy, fy + 0.3); }
  // upstairs: a loggia: low parapets with windows to shoot from, corner posts, a tiled roof above
  for (const sz of [-1, 1]) seg(0, sz * d / 2, w, true, fy + 0.3, 1.0, M.plaster);
  for (const sx of [-1, 1]) seg(sx * w / 2, 0, d, false, fy + 0.3, 1.0, M.plaster);
  for (const [lx, lz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) { const [px, pz] = at(lx, lz); put(BOX(0.35, H2, 0.35), M.timber, px, fy + 0.3 + H2 / 2, pz, ry); }
  { const [cx, cz] = at(0, 0); const rg = new THREE.CylinderGeometry(0, Math.hypot(w, d) * 0.62, 1.8, 4, 1); rg.rotateY(Math.PI / 4); rg.scale(w / Math.hypot(w, d) * 1.414, 1, d / Math.hypot(w, d) * 1.414); put(rg, M.roof, cx, fy + 0.3 + H2 + 0.9, cz, ry);
    addBox(cx, cz, w / 2, d / 2, ry, 'map', fy + 0.3 + H2, fy + 0.3 + H2 + 1.8); }
  // a balcony out over the front, and the outside stairs up to it along one side
  if (opts.balcony !== false) { const [bx, bz] = at(0, d / 2 + 1.1); put(BOX(w * 0.7, 0.25, 2.2), M.timber, bx, fy + 0.18, bz, ry); addSurface(bx, bz, w * 0.35, 1.1, ry, fy + 0.3); addBox(bx, bz, w * 0.35, 1.1, ry, 'map', fy, fy + 0.3);
    const [rx, rz] = at(0, d / 2 + 2.15); put(BOX(w * 0.7, 0.9, 0.12), M.timber, rx, fy + 0.75, rz, ry, 0, false); addBox(rx, rz, w * 0.35, 0.08, ry, 'map', fy + 0.3, fy + 1.2);
    for (let k = 0; k < 5; k++) { const [ux, uz] = at(-w * 0.35 + k * w * 0.175, d / 2 + 2.15); put(BOX(0.1, 1.0, 0.1), M.timber, ux, fy + 0.8, uz, ry, 0, false); }
    for (const lx of [-w * 0.3, w * 0.3]) { const [px, pz] = at(lx, d / 2 + 2.0); put(BOX(0.2, H1, 0.2), M.timber, px, Y + H1 / 2, pz, ry); addBox(px, pz, 0.12, 0.12, ry, 'map', Y, fy); } }
  { const sx = opts.stairsSide || 1, [s1x, s1z] = at(sx * (w / 2 + 0.9), -d / 2 + 0.6), [s2x, s2z] = at(sx * (w / 2 + 0.9), d / 2 - 0.4); stairs(s1x, s1z, Y, s2x, s2z, fy + 0.3, 1.4, M.timber); }
  // windows (dark panes in the plaster) and a lantern by the door
  for (const lx of [-w / 3, w / 3]) { const [wx, wz] = at(lx, d / 2 + 0.21); put(BOX(0.7, 0.9, 0.05), M.glass, wx, Y + 1.9, wz, ry, 0, false); }
  { const [lx2, lz2] = at(door / 2 + 0.4, d / 2 + 0.35); lantern(lx2, Y + 2.3, lz2); }
}
function lantern(x, y, z) { put(BOX(0.18, 0.28, 0.18), M.iron, x, y, z, 0, 0, false); put(new THREE.SphereGeometry(0.1, 8, 6), M.lamp, x, y, z, 0, 0, false); }
function crystal(x, y, z, s = 1, mat = M.crystal) { for (let k = 0; k < 4; k++) { const g = new THREE.OctahedronGeometry(0.35 * s * (1 - k * 0.15), 0); g.scale(0.6, 2.2, 0.6); put(g, mat, x + Math.sin(k * 2.3) * 0.35 * s, y + 0.6 * s * (1 - k * 0.1), z + Math.cos(k * 2.3) * 0.35 * s, k, (k - 1.5) * 0.25, false); } }
function tree(x, z, s = 1, glow = false) { const tr = new THREE.CylinderGeometry(0.25 * s, 0.45 * s, 4 * s, 7); put(tr, M.bark, x, Y + 2 * s, z); addCircle(x, z, 0.5 * s);
  for (let k = 0; k < 5; k++) { const a = k * 1.3, c = new THREE.IcosahedronGeometry((1.4 + (k % 2) * 0.4) * s, 1); put(c, glow ? M.leafGlow : M.leaf, x + Math.sin(a) * 1.0 * s, Y + (4.2 + (k % 3) * 0.6) * s, z + Math.cos(a) * 1.0 * s, a, 0, true); } }
function rock(x, z, s = 1) { const g = new THREE.DodecahedronGeometry(s, 0); g.scale(1.2, 0.7, 1); put(g, M.rock, x, Y + 0.3 * s, z, x * 1.7); addCircle(x, z, s * 0.9); }
function banner(x, y, z, ry, team) { const g = new THREE.PlaneGeometry(1.4, 2.6, 1, 4); const m = S(COLORS[team % COLORS.length], 0.85, 0, { side: THREE.DoubleSide }); const b = new THREE.Mesh(g, m); b.position.set(x, y, z); b.rotation.y = ry; root.add(b); AR.banners = AR.banners || []; AR.banners.push({ team, mat: m }); put(BOX(1.7, 0.1, 0.1), M.iron, x, y + 1.35, z, ry, 0, false); }

// ---- the bases: a spawn room behind a portcullis, opening onto a raised courtyard ----
export const RUINS = { rooms: [], lanes: [], bounds: { x: 29, z: 49 } };
function spawnRoom(k, cx, cz, dir, team) { // dir: unit vector out of the room through the gate, along an axis
  const ax = Math.abs(dir[0]) > 0.5, hw = 5, hd = 4, fy = Y + 2, gx = cx + dir[0] * hd, gz = cz + dir[1] * hd; // gate in the room's outer face
  const W2 = ax ? hd : hw, D2 = ax ? hw : hd;
  put(BOX(W2 * 2, 0.2, D2 * 2), M.flag, cx, fy - 0.1, cz); addSurface(cx, cz, W2, D2, 0, fy); addBox(cx, cz, W2, D2, 0, 'map', -50, fy);
  for (const s of [-1, 1]) { if (ax) { wall(cx, cz + s * (hw + 0.3), hd * 2 + 1, 0.6, fy, 4.4, M.stoneD); wall(cx - dir[0] * (hd + 0.3), cz, 0.6, hw * 2, fy, 4.4, M.stoneD); }
    else { wall(cx + s * (hw + 0.3), cz, 0.6, hd * 2 + 1, fy, 4.4, M.stoneD); wall(cx, cz - dir[1] * (hd + 0.3), hw * 2, 0.6, fy, 4.4, M.stoneD); } }
  put(BOX(ax ? hd * 2 + 1 : hw * 2 + 1, 0.5, ax ? hw * 2 + 1 : hd * 2 + 1), M.stoneD, cx, fy + 4.6, cz); addBox(cx, cz, W2 + 0.5, D2 + 0.5, 0, 'map', fy + 4.4, fy + 5);
  // the gate face: posts either side of a 5 m opening, a lintel, and the portcullis
  const px = ax ? 0 : 1, pz = ax ? 1 : 0;
  for (const s of [-1, 1]) wall(gx + px * s * 3.6, gz + pz * s * 3.6, ax ? 0.7 : 2.2, ax ? 2.2 : 0.7, fy, 4.4, M.stone);
  put(BOX(ax ? 0.8 : 9.4, 0.9, ax ? 9.4 : 0.8), M.stone, gx, fy + 4.0, gz);
  const bars = new THREE.Group(); bars.position.set(gx, fy + 3.6, gz); bars.rotation.y = ax ? Math.PI / 2 : 0; root.add(bars);
  for (let i = 0; i < 9; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.6, 6), M.iron); b.position.set(-2.2 + i * 0.55, -1.8, 0); bars.add(b); }
  for (const yy of [-0.6, -1.8, -3.0]) { const b = new THREE.Mesh(BOX(5, 0.1, 0.1), M.iron); b.position.set(0, yy, 0); bars.add(b); }
  AR.gateBars.push(bars);
  for (const [lx, lz] of [[-0.6, -0.6], [0.6, 0.6]]) { const tx = cx + (ax ? lx * hd : lx * hw * 1.3), tz = cz + (ax ? lz * hw * 1.3 : lz * hd); lantern(tx, fy + 2.4, tz); }
  banner(cx - dir[0] * (hd - 0.1), fy + 2.4, cz - dir[1] * (hd - 0.1), ax ? (dir[0] > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir[1] > 0 ? 0 : Math.PI), team);
  RUINS.rooms.push({ k, cx, cz, hw: W2, hd: D2, gx, gz, dir, ax, fy });
  AR.gates[k] = { a: Math.atan2(dir[0], dir[1]) + Math.PI, x: gx + dir[0] * 6, z: gz + dir[1] * 6, y: fy, banner: null, roomBanner: null };
}

// one half of the map (team 0's south side); the north half is the same turned round (sz = -1 for south, +1 for north)
function half(sz, team) {
  const Z = (z) => z * sz;
  // the base courtyard: a raised stone terrace, 2 m up, the spawn room behind it
  block(0, Z(36), 48, 12, Y - 0.1, 2.1, M.stone, M.flag);
  for (const x of [-22, -12, 12, 22]) { put(new THREE.CylinderGeometry(0.4, 0.5, 4, 10), M.marble, x, Y + 4, Z(41)); addCircle(x, Z(41), 0.5); }
  crystal(-8, Y + 2, Z(40), 0.9, team ? M.crystalR : M.crystal); crystal(8, Y + 2, Z(40), 0.9, team ? M.crystalR : M.crystal);
  banner(-16, Y + 4.5, Z(41.9), sz > 0 ? Math.PI : 0, team); banner(16, Y + 4.5, Z(41.9), sz > 0 ? Math.PI : 0, team);
  // MIDDLE: grand stairs down to the street, two houses either side with balconies over the street, an arch across it
  stairs(0, Z(30), Y + 2, 0, Z(25), Y, 9);
  house(-11, Z(19), 7, 7, sz > 0 ? Math.PI / 2 : -Math.PI / 2, { front: true, back: false, stairsSide: -1 });
  house(11, Z(19), 7, 7, sz > 0 ? -Math.PI / 2 : Math.PI / 2, { front: true, back: false, stairsSide: -1 });
  for (const s of [-1, 1]) wall(s * 6.2, Z(13), 1.2, 1.2, Y, 5.2, M.marble); put(BOX(13.6, 1.2, 1.4), M.marble, 0, Y + 5.6, Z(13)); addBox(0, Z(13), 6.8, 0.7, 0, 'map', Y + 5, Y + 6.2); addSurface(0, Z(13), 6.8, 0.7, 0, Y + 6.2);
  for (const x of [-3.5, 3.5]) { put(BOX(1.6, 1.0, 0.6), M.stone, x, Y + 0.5, Z(22)); addBox(x, Z(22), 0.8, 0.3, 0, 'map', Y, Y + 1.0); } // low walls to duck behind
  // LEFT: up on to the rampart, a high stone walkway with battlements, then down into the plaza
  stairs(-20, Z(31), Y + 2, -20, Z(27), Y + 4.5, 5);
  block(-20, Z(17.5), 6, 19, Y - 0.1, 4.6, M.stone, M.flag);
  for (let k = 0; k < 6; k++) { const zz = Z(9.5 + k * 3.2); put(BOX(0.6, 0.9, 1.2), M.stone, -16.8, Y + 4.95, zz); addBox(-16.8, zz, 0.3, 0.6, 0, 'map', Y + 4.5, Y + 5.4); put(BOX(0.6, 0.9, 1.2), M.stone, -23.2, Y + 4.95, zz); addBox(-23.2, zz, 0.3, 0.6, 0, 'map', Y + 4.5, Y + 5.4); }
  stairs(-20, Z(8), Y + 4.5, -20, Z(2), Y, 5);
  lantern(-17, Y + 6.2, Z(20)); crystal(-21, Y + 4.5, Z(25), 0.6);
  // the lane walls: rows of tall ruined buildings between the lanes (with one alley across at z ±18)
  for (const s of [-1, 1]) { wall(s * 15.5, Z(26), 3, 6, Y, 6.5, M.stoneD); wall(s * 15.5, Z(10.5), 3, 5, Y, 6.5, M.stoneD); put(BOX(3.4, 0.4, 6.4), M.moss, s * 15.5, Y + 6.7, Z(26)); put(BOX(3.4, 0.4, 5.4), M.moss, s * 15.5, Y + 6.7, Z(10.5)); }
  // RIGHT: down into the garden, along a path past rocks and trees, and through the chapel (a loggia above to shoot from)
  stairs(20, Z(31), Y + 2, 20, Z(26), Y, 6);
  house(20, Z(15), 8, 6, sz > 0 ? 0 : Math.PI, { front: true, back: true, balcony: false, stairsSide: 1 });
  tree(25.5, Z(23), 1.0); tree(25, Z(8), 0.9); rock(24, Z(19.5), 1.0); rock(17, Z(23), 0.7); rock(26, Z(13), 0.9);
  crystal(17.5, Y, Z(9), 0.8);
  // side hills of the plaza: raised platforms with ramps, good spots for ranged fighters
  block(-9, Z(5.5), 6, 3, Y - 0.1, 1.6, M.stone, M.moss); stairs(-4.5, Z(5.5), Y, -6, Z(5.5), Y + 1.5, 3, M.stone2, false);
  block(9, Z(5.5), 6, 3, Y - 0.1, 1.6, M.stone, M.moss); stairs(4.5, Z(5.5), Y, 6, Z(5.5), Y + 1.5, 3, M.stone2, false);
  // broken pillars and low walls for cover in the plaza
  for (const [x, z] of [[-14, 7], [14, 7]]) { put(new THREE.CylinderGeometry(0.55, 0.65, 2.6, 12), M.marble, x, Y + 1.3, Z(z)); addCircle(x, Z(z), 0.65); }
  for (const x of [-23, 23]) { put(BOX(2.8, 1.1, 0.6), M.stone, x, Y + 0.55, Z(4)); addBox(x, Z(4), 1.4, 0.3, 0, 'map', Y, Y + 1.1); }
  lantern(-4, Y + 2.5, Z(9)); lantern(4, Y + 2.5, Z(9));
}

export function buildRuins(scene) {
  M = { stone: S('#b8ab92', 0.92), stone2: S('#a89a80', 0.9), stoneD: S('#8a7e6c', 0.95), moss: S('#6a7c48', 1), flag: S('#9c907a', 0.95), marble: S('#e8e2d4', 0.6),
    plaster: S('#e6dcc2', 0.95), timber: S('#5a3a20', 0.85), roof: S('#8a3a26', 0.8), glass: S('#20303a', 0.3, 0.2), iron: S('#2e2e32', 0.45, 0.8),
    lamp: new THREE.MeshBasicMaterial({ color: '#ffd080' }), crystal: S('#7ac8ff', 0.2, 0.1, { emissive: '#3a90ff', emissiveIntensity: 1.6 }), crystalR: S('#ff8a7a', 0.2, 0.1, { emissive: '#ff3a2a', emissiveIntensity: 1.4 }),
    bark: S('#5a4030', 0.95), leaf: S('#4a7a3a', 0.9), leafGlow: S('#7ad0a0', 0.6, 0, { emissive: '#2a9a6a', emissiveIntensity: 0.9 }), rock: S('#8a8478', 0.95, 0, { flatShading: true }) };
  root = new THREE.Group(); scene.add(root); geoBuckets.clear(); RUINS.rooms.length = 0; AR.gates.length = 0; AR.gateBars.length = 0; AR.R = 60; AR.map = 'ruins';
  // the ground: worn flagstones in the streets and plaza, grass at the edges
  { const tex = groundTexture(); const g = new THREE.Mesh(new THREE.PlaneGeometry(64, 104, 1, 1), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 })); g.rotation.x = -Math.PI / 2; g.position.y = Y + 0.02; g.receiveShadow = true; root.add(g); }
  // the outer walls: cliffs and tall ruined facades all round
  for (const s of [-1, 1]) { for (const zs of [-1, 1]) wall(s * 30.5, zs * 27.25, 3, 48.5, Y - 1, 12, M.stoneD); wall(s * 30.5, 0, 3, 6, Y + 6, 5, M.stoneD); wall(0, s * 50.5, 64, 3, Y - 1, 12, M.stoneD); } // (an opening each side for the east and west spawn rooms)
  for (let k = -4; k <= 4; k++) for (const s of [-1, 1]) { put(BOX(3.6, 1.2, 3.6), M.moss, s * 30.5, Y + 11.4, k * 11.5); put(new THREE.ConeGeometry(2.4, 6 + (k & 1) * 3, 6), M.rock, s * 33, Y + 12, k * 11.5 + 3); }
  half(-1, 0); half(1, 1);
  // the centre: a sunken ring round an ancient glowing tree (the hill to hold in King of the Hill)
  { const ring = new THREE.Mesh(new THREE.RingGeometry(6.6, 7.2, 64), S('#d8b04a', 0.4, 0.7)); ring.rotation.x = -Math.PI / 2; ring.position.y = Y + 0.05; root.add(ring);
    const hill = new THREE.Mesh(new THREE.RingGeometry(6.6, 7.2, 96), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false })); hill.rotation.x = -Math.PI / 2; hill.position.y = Y + 0.08; root.add(hill); AR.hill = hill;
    put(new THREE.CylinderGeometry(2.0, 2.3, 0.5, 20), M.stone, 0, Y + 0.25, 0); addCircle(0, 0, 1.6); tree(0, 0, 1.5, true); crystal(1.8, Y + 0.5, 0.8, 0.5); crystal(-1.6, Y + 0.5, -1, 0.5); }
  // spawn rooms: south (team 0) and north (team 1); west and east for 3- and 4-team games
  spawnRoom(0, 0, -45.5, [0, 1], 0); spawnRoom(1, 0, 45.5, [0, -1], 1); spawnRoom(2, -34, 0, [1, 0], 2); spawnRoom(3, 34, 0, [-1, 0], 3);
  for (const s of [-1, 1]) { block(s * 28.2, 0, 4.4, 6, Y - 0.1, 2.1, M.stone, M.flag); stairs(s * 26, 0, Y + 2, s * 22.5, 0, Y, 4); }
  // the three lanes, as waypoints from the south base to the north base (the computer fighters walk them)
  RUINS.lanes = [
    [[0, -38], [-12, -34], [-20, -30], [-20, -24], [-20, -12], [-20, -4], [-12, 0], [-20, 4], [-20, 12], [-20, 24], [-20, 30], [-12, 34], [0, 38]],
    [[0, -38], [0, -32], [0, -26], [0, -18], [0, -10], [0, -7.5], [0, 7.5], [0, 10], [0, 18], [0, 26], [0, 32], [0, 38]],
    [[0, -38], [12, -34], [20, -30], [20, -24], [20, -15], [20, -6], [12, 0], [20, 6], [20, 15], [20, 24], [20, 30], [12, 34], [0, 38]]];
  // fuse everything that never moves into one mesh per material
  for (const { mat, sh, list } of geoBuckets.values()) { const geo = mergeGeometries(list, false); if (!geo) continue; const m = new THREE.Mesh(geo, mat); m.castShadow = sh; m.receiveShadow = true; m.matrixAutoUpdate = false; m.updateMatrix(); root.add(m); }
  geoBuckets.clear(); AR.root = root;
  return root;
}
function groundTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 1024; const g = c.getContext('2d');
  g.fillStyle = '#8a8270'; g.fillRect(0, 0, 1024, 1024);
  for (let y = 0; y < 1024; y += 32) for (let x = (y / 32) % 2 * 24; x < 1024; x += 48) { const v = 110 + Math.random() * 40; g.fillStyle = `rgb(${v + 14},${v + 8},${v - 6})`; g.fillRect(x + 1, y + 1, 46, 30); }
  for (let i = 0; i < 60; i++) { const x = Math.random() * 1024, y = Math.random() * 1024, r = 20 + Math.random() * 70, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(90,120,60,0.55)'); gr.addColorStop(1, 'rgba(90,120,60,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 3.2); t.anisotropy = 4; return t;
}
// gates and banners: the portcullis rolls up when the fight starts; banners take their team's colour
export function updateRuins(dt) { const open = AR.gatesOpen ? 1 : 0; for (const b of AR.gateBars) { b.scale.y += ((open ? 0.03 : 1) - b.scale.y) * Math.min(1, dt * 1.6); b.visible = b.scale.y > 0.035; } }
