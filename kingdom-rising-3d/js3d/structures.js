// Kingdom Rising 3D — buildings (houses, shops, inns, the king's castle keep, boss lairs), city walls with
// towers and gatehouses, and masonry walls in sewers and crypts. Everything is built from the same
// tile footprints the 2D game uses, so walls stand exactly where you collide with them.
import { THREE, K3, TILE, TS, PX } from './core.js';
import { geo, T } from './geo.js';
import { MB, PRIM } from './mb.js';
import { mats } from './mats.js';
import { craftFront } from './crafthouses.js';

const KR = window.KR, D = KR.D, W = KR.W;
const Tl = TILE;

const STYLE = {
  crown: { plinth: '#9e978a', wall: '#ece3cf', beam: '#9a6a44', roofMat: 'rooftile', roof: '#c06a50', trim: '#f0c75e', shutter: '#28457a', frame: true, stone: false, curve: false, pitch: 0.72, inner: '#e8dcc4' },
  sylvan: { plinth: '#cfc6ad', wall: '#e4dcc2', beam: '#a8804c', roofMat: 'shingle', roof: '#8fd08a', trim: '#e7d48a', shutter: '#2e6a3c', frame: true, stone: false, curve: true, pitch: 0.8, inner: '#ebe2c8' },
  iron: { plinth: '#7a756c', wall: '#a8a298', beam: '#4a443c', roofMat: 'slate', roof: '#a0aab8', trim: '#c98b3a', shutter: '#7a3e1c', frame: false, stone: true, curve: false, pitch: 0.62, inner: '#d8d0c0' },
  chamber: { plinth: '#4a4440', wall: '#6a625c', beam: '#2e2a26', roofMat: 'darkstone', roof: '#6a625c', trim: '#8a2a2a', shutter: '#3a1a1a', frame: false, stone: true, curve: false, pitch: 0, inner: '#5a524c' },
};
const HEIGHT = { house: 3.6, hall: 8.2, inn: 5.4, outpost: 4.6, bank: 5, chamber: 4.8, barracks: 4.6, guild: 5, heroes: 5.4, exchange: 5.4, smithy: 4.2, forge: 4.6, tailor: 4.2, store: 4.2, armorer: 4.4, weaponsmith: 4.4, scribe: 4.6, fletcher: 4.4, jeweler: 4.2, gemcutter: 4.2, bowyer: 4.4, armory: 4.8 };
const SIGN = { inn: '🍺', outpost: '🍺', bank: '💰', smithy: '⚒', forge: '⚒', tailor: '🧵', guild: '📜', store: '🛍', armorer: '🛡', weaponsmith: '⚔', scribe: '📖', fletcher: '🏹', armory: '🛡', exchange: '💎', heroes: '🏆', hall: '👑', chamber: '💀', barracks: '⚔', jeweler: '💍', gemcutter: '💎', bowyer: '🏹' };
const CHIMNEY = new Set(['house', 'inn', 'smithy', 'forge', 'outpost', 'barracks', 'tailor']);

export const structs = { doors: [], signs: [], roofs: [], flags: [], chimneys: [], windows: [], torches: [], fires: [] };
K3.structs = structs;

// ---------- small geometry helpers ----------
const V = (x, y, z) => new THREE.Vector3(x, y, z);
// a flat quad with explicit uv (p0..p3 counter-clockwise seen from the front)
function quad(mb, key, p0, p1, p2, p3, uvs, color, up) {
  if (up !== undefined) { const nn = new THREE.Vector3().subVectors(p1, p0).cross(new THREE.Vector3().subVectors(p3, p0)); if ((nn.y > 0) !== up) { [p1, p3] = [p3, p1]; uvs = [uvs[0], uvs[1], uvs[6], uvs[7], uvs[4], uvs[5], uvs[2], uvs[3]]; } }
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array([p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z]);
  const n = new THREE.Vector3().subVectors(p1, p0).cross(new THREE.Vector3().subVectors(p3, p0)).normalize();
  const nor = new Float32Array([n.x, n.y, n.z, n.x, n.y, n.z, n.x, n.y, n.z, n.x, n.y, n.z]);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2)); g.setIndex([0, 1, 2, 0, 2, 3]);
  mb.add(key, g, new THREE.Matrix4(), color, 'local');
}
// extrude a 2D outline (x right, y up) through depth along +z, then place with matrix
function prism(mb, key, pts, depth, m, color) {
  const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false });
  mb.add(key, g, m, color);
  g.dispose();
}
const mT = (x, y, z, ry = 0) => new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);

// ---------- walls with openings ----------
// a straight wall: along axis 'x' or 'z' from a0 to a1, occupying [c0, c1] across; outer face at cOut (c0 or c1)
function wallRun(mb, o) {
  const { axis, a0, a1, c0, c1, outerAtC0, y0, y1, open, outKey, inKey, outCol, inCol, outT } = o;
  const ops = [...(open || [])].sort((a, b) => a.u0 - b.u0);
  const segs = []; let u = a0;
  for (const op of ops) { if (op.u0 > u) segs.push({ u0: u, u1: op.u0, v0: y0, v1: y1 }); segs.push({ u0: op.u0, u1: op.u1, v0: y0, v1: op.v0 }); segs.push({ u0: op.u0, u1: op.u1, v0: op.v1, v1: y1 }); u = op.u1; }
  if (u < a1) segs.push({ u0: u, u1: a1, v0: y0, v1: y1 });
  const cOut0 = outerAtC0 ? c0 : c1 - outT, cOut1 = outerAtC0 ? c0 + outT : c1;
  const cIn0 = outerAtC0 ? c0 + outT : c0, cIn1 = outerAtC0 ? c1 : c1 - outT;
  for (const s of segs) {
    if (s.v1 - s.v0 < 0.01 || s.u1 - s.u0 < 0.01) continue;
    const um = (s.u0 + s.u1) / 2, ul = s.u1 - s.u0, vm = (s.v0 + s.v1) / 2, vl = s.v1 - s.v0;
    for (const [k, cc0, cc1, col] of [[outKey, cOut0, cOut1, outCol], [inKey, cIn0, cIn1, inCol]]) {
      if (cc1 - cc0 < 0.01) continue; const cm = (cc0 + cc1) / 2, cl = cc1 - cc0;
      if (axis === 'x') mb.box(k, um, vm, cm, ul, vl, cl, col); else mb.box(k, cm, vm, um, cl, vl, ul, col);
    }
  }
}

// ---------- one building ----------
function building(mb, b) {
  const st = STYLE[b.style] || STYLE.crown;
  const X0 = b.x * Tl, X1 = (b.x + b.w) * Tl, Z0 = b.y * Tl, Z1 = (b.y + b.h) * Tl;
  const y0 = b._y3 != null ? b._y3 : 0, fy = b._floor3 != null ? b._floor3 : y0 + 0.16;
  const isHall = b.type === 'hall', isLair = b.type === 'chamber';
  const Hw = HEIGHT[b.type] || 4.2;
  const top = y0 + Hw;
  const outT = 0.34;
  const wallKey = st.stone || isHall || isLair ? (isLair ? 'darkstone' : 'stone') : 'plaster';
  const wallCol = st.stone || isHall || isLair ? (isLair ? '#8a8078' : isHall ? (b.style === 'sylvan' ? '#e8e2d4' : '#cdc6b8') : st.wall) : st.wall;
  const inKey = isHall || isLair || b.type === 'bank' ? (isLair ? 'darkstone' : 'stone') : 'plaster';
  const inCol = isHall ? '#c8c0b0' : isLair ? '#6a625a' : st.inner;
  const door = b.door; const dX0 = door.tx * Tl, dX1 = dX0 + Tl;
  const doorH = isHall ? 3.2 : 2.35;
  const sink = y0 - 1.2;
  // windows: every other tile, away from corners and the door
  const winRow = (len, t0, skip) => { const out = []; for (let k = 1; k < len - 1; k++) { if (skip && skip(k)) continue; if ((k + (len > 5 ? 0 : 1)) % 2 === 0 || len <= 4) out.push(k); } return out; };
  const winV0 = fy + (isHall ? 3.6 : 1.05), winV1 = winV0 + (isHall ? 2.6 : 1.05), winW = isHall ? 0.62 : 0.72;
  const upper = Hw >= 4.9 && !isHall; const upV0 = fy + 2.95, upV1 = upV0 + 0.95;
  const openings = { n: [], s: [], w: [], e: [] };
  const addWin = (side, u0, u1) => { openings[side].push({ u0, u1, v0: winV0, v1: winV1, win: true }); if (upper) openings[side].push({ u0, u1, v0: upV0, v1: upV1, win: true }); };
  // north and south walls (along x)
  for (const k of winRow(b.w, 0, (k) => Math.abs(b.x + k - door.tx) <= 1)) { const cx = (b.x + k + 0.5) * Tl; addWin('s', cx - winW / 2, cx + winW / 2); }
  for (const k of winRow(b.w)) { const cx = (b.x + k + 0.5) * Tl; addWin('n', cx - winW / 2, cx + winW / 2); }
  for (const k of winRow(b.h)) { const cz = (b.y + k + 0.5) * Tl; addWin('w', cz - winW / 2, cz + winW / 2); addWin('e', cz - winW / 2, cz + winW / 2); }
  if (isLair) { openings.n = []; openings.w = []; openings.e = []; openings.s = openings.s.filter(() => false); }
  const doorOp = { u0: dX0 + 0.16, u1: dX1 - 0.16, v0: sink, v1: fy + doorH, door: true };
  // merge openings that would overlap the door
  const sOps = [...openings.s.filter((o) => o.u1 < doorOp.u0 - 0.05 || o.u0 > doorOp.u1 + 0.05), doorOp];
  const common = { y0: sink, y1: top, outKey: wallKey, inKey, outCol: wallCol, inCol, outT };
  wallRun(mb, { ...common, axis: 'x', a0: X0, a1: X1, c0: Z0, c1: Z0 + Tl, outerAtC0: true, open: openings.n });
  wallRun(mb, { ...common, axis: 'x', a0: X0, a1: X1, c0: Z1 - Tl, c1: Z1, outerAtC0: false, open: sOps });
  wallRun(mb, { ...common, axis: 'z', a0: Z0 + Tl, a1: Z1 - Tl, c0: X0, c1: X0 + Tl, outerAtC0: true, open: openings.w });
  wallRun(mb, { ...common, axis: 'z', a0: Z0 + Tl, a1: Z1 - Tl, c0: X1 - Tl, c1: X1, outerAtC0: false, open: openings.e });
  // the passage through the doorway gets a floor
  mb.box(b.style === 'crown' || b.style === 'sylvan' ? 'planks' : 'stone', (dX0 + dX1) / 2, fy - 0.08, Z1 - Tl / 2, Tl - 0.3, 0.16, Tl, isHall ? '#b8b0a0' : '#a07a52');
  // stone plinth around the base
  if (!st.stone && !isHall && !isLair) {
    const pH = y0 + 0.85, ph = pH - sink, pm = (pH + sink) / 2;
    mb.box('stone', (X0 + X1) / 2, pm, Z0 - 0.05, X1 - X0 + 0.14, ph, 0.12, st.plinth);
    mb.box('stone', X0 - 0.05, pm, (Z0 + Z1) / 2, 0.12, ph, Z1 - Z0 + 0.14, st.plinth);
    mb.box('stone', X1 + 0.05, pm, (Z0 + Z1) / 2, 0.12, ph, Z1 - Z0 + 0.14, st.plinth);
    mb.box('stone', (X0 + doorOp.u0) / 2, pm, Z1 + 0.05, doorOp.u0 - X0 + 0.07, ph, 0.12, st.plinth);
    mb.box('stone', (doorOp.u1 + X1) / 2, pm, Z1 + 0.05, X1 - doorOp.u1 + 0.07, ph, 0.12, st.plinth);
  }
  // timber framing on the outside
  if (st.frame && !isHall && !isLair) {
    const bk = 'timber', bc = st.beam, bw = 0.15, out = 0.05;
    const baseV = y0 + 0.85;
    const sides = [
      { axis: 'x', a0: X0, a1: X1, c: Z0 - out, ops: openings.n }, { axis: 'x', a0: X0, a1: X1, c: Z1 + out, ops: sOps },
      { axis: 'z', a0: Z0, a1: Z1, c: X0 - out, ops: openings.w }, { axis: 'z', a0: Z0, a1: Z1, c: X1 + out, ops: openings.e },
    ];
    for (const s of sides) {
      const L = s.a1 - s.a0; const n = Math.round(L / Tl);
      const put = (u, v, du, dv, rot) => { if (s.axis === 'x') mb.box(bk, u, v, s.c, du, dv, bw * 0.6, bc, 0, 0, rot || 0); else mb.box(bk, s.c, v, u, bw * 0.6, dv, du, bc, 0, rot ? -rot : 0, 0); };
      for (let k = 0; k <= n; k++) { const u = s.a0 + k * Tl; put(u, (baseV + top) / 2, bw, top - baseV); }
      put((s.a0 + s.a1) / 2, top - bw / 2, L + 0.1, bw);
      put((s.a0 + s.a1) / 2, baseV + bw / 2, L + 0.1, bw);
      if (Hw >= 4.6) put((s.a0 + s.a1) / 2, fy + 2.75, L + 0.1, bw);
      // diagonal braces in panels without windows or the door
      for (let k = 0; k < n; k++) {
        const u0 = s.a0 + k * Tl, u1 = u0 + Tl; if (s.ops.some((o) => o.u1 > u0 && o.u0 < u1)) continue;
        const vTop = Hw >= 4.6 ? fy + 2.75 : top; const dv = vTop - baseV, du = Tl; const ang = Math.atan2(dv, du) * ((k % 2) ? 1 : -1);
        const len = Math.hypot(du, dv);
        if (s.axis === 'x') mb.box(bk, (u0 + u1) / 2, (baseV + vTop) / 2, s.c, len, bw * 0.6, bw * 0.45, bc, 0, 0, ang);
        else mb.box(bk, s.c, (baseV + vTop) / 2, (u0 + u1) / 2, bw * 0.45, bw * 0.6, len, bc, 0, -ang, 0);
      }
    }
  }
  // stone halls and lairs: buttresses and a string course
  if (st.stone || isHall || isLair) {
    const pk = isLair ? 'darkstone' : 'stone', pc = isLair ? '#6a625c' : isHall ? '#b8b0a2' : '#8a857c';
    for (let x = X0; x <= X1 + 0.01; x += Tl * 2) { mb.boxB(pk, x, sink, Z1 + 0.18, 0.6, top - sink - 0.6, 0.36, pc); mb.boxB(pk, x, sink, Z0 - 0.18, 0.6, top - sink - 0.6, 0.36, pc); }
    mb.box(pk, (X0 + X1) / 2, fy + 2.6, Z1 + 0.06, X1 - X0, 0.22, 0.16, pc); mb.box(pk, (X0 + X1) / 2, fy + 2.6, Z0 - 0.06, X1 - X0, 0.22, 0.16, pc);
  }
  // windows: frame, glass, shutters
  const winSides = [['n', 'x', Z0, -1], ['s', 'x', Z1, 1], ['w', 'z', X0, -1], ['e', 'z', X1, 1]];
  for (const [side, axis, c, dir] of winSides) for (const op of (side === 's' ? sOps : openings[side])) {
    if (!op.win) continue;
    const um = (op.u0 + op.u1) / 2, ul = op.u1 - op.u0, vm = (op.v0 + op.v1) / 2, vl = op.v1 - op.v0;
    const glassC = c - dir * 0.3;
    const fk = st.stone || isHall ? 'stone' : 'timber', fc = st.stone || isHall ? '#d8d0c0' : st.beam;
    const P = (u, v, cc, du, dv, dc, key, col) => { if (axis === 'x') mb.box(key, u, v, cc, du, dv, dc, col); else mb.box(key, cc, v, u, dc, dv, du, col); };
    P(um, vm, glassC, ul, vl, 0.05, 'window', '#ffffff');
    P(um, vm, glassC + dir * 0.03, 0.05, vl, 0.06, 'timber', '#3a2a1a'); P(um, vm, glassC + dir * 0.03, ul, 0.05, 0.06, 'timber', '#3a2a1a');
    P(um, op.v0 - 0.05, c + dir * 0.06, ul + 0.2, 0.1, 0.22, fk, fc);
    P(um, op.v1 + 0.06, c + dir * 0.04, ul + 0.24, 0.12, 0.14, fk, fc);
    if (!st.stone && !isHall && !isLair) {
      // open shutters, swung back against the wall
      for (const sd of [-1, 1]) P(um + sd * (ul / 2 + 0.2), vm, c + dir * 0.06, 0.36, vl + 0.06, 0.05, 'planks', st.shutter);
      // a flower box under some ground floor windows
      if (op.v0 < fy + 2 && K3.hash(Math.round(um * 10), Math.round(c * 10), 3) < 0.5) { P(um, op.v0 - 0.18, c + dir * 0.18, ul + 0.1, 0.18, 0.22, 'planks', '#6a4a2a'); for (let k = 0; k < 4; k++) P(um - ul / 2 + 0.12 + k * (ul - 0.2) / 3, op.v0 - 0.02, c + dir * 0.2, 0.12, 0.12, 0.12, 'paint', ['#e84a5a', '#f2d34a', '#ffffff', '#9a7ae0'][k]); }
    }
    structs.windows.push({ x: axis === 'x' ? um : c, y: vm, z: axis === 'x' ? c : um, b });
  }
  // door frame
  {
    const fk = isHall || st.stone || isLair ? (isLair ? 'darkstone' : 'stone') : 'timber', fc = isHall ? '#d8d0c0' : isLair ? '#5a524a' : st.beam;
    mb.box(fk, doorOp.u0 - 0.08, (fy + doorH + sink) / 2, Z1 + 0.04, 0.2, fy + doorH - sink, 0.14, fc);
    mb.box(fk, doorOp.u1 + 0.08, (fy + doorH + sink) / 2, Z1 + 0.04, 0.2, fy + doorH - sink, 0.14, fc);
    mb.box(fk, (doorOp.u0 + doorOp.u1) / 2, fy + doorH + 0.1, Z1 + 0.05, doorOp.u1 - doorOp.u0 + 0.5, 0.24, 0.18, fc);
    if (isHall) { // grand arch over the castle door
      const r = (doorOp.u1 - doorOp.u0) / 2 + 0.25; const cx = (doorOp.u0 + doorOp.u1) / 2;
      for (let k = 0; k <= 8; k++) { const a = Math.PI * k / 8; mb.box('stone', cx + Math.cos(a) * r, fy + doorH + 0.2 + Math.sin(a) * r * 0.7, Z1 + 0.1, 0.34, 0.34, 0.26, '#e0d8c8', 0, 0, a); }
      // stone steps
      mb.box('stone', (dX0 + dX1) / 2, fy - 0.12, Z1 + 0.45, Tl * 2.2, 0.24, 0.7, '#b8b0a0');
      mb.box('stone', (dX0 + dX1) / 2, fy - 0.3, Z1 + 0.95, Tl * 2.6, 0.3, 0.6, '#a8a090');
    }
    // the door leaf itself is a separate, animated object
    const dmb = new MB(); const dw = doorOp.u1 - doorOp.u0, dh = fy + doorH - fy - 0.02;
    const leafCol = door.locked ? '#4a3a30' : isHall ? '#6a4424' : '#7a5530';
    dmb.box('planks', dw / 2, dh / 2, 0, dw, dh, 0.09, leafCol);
    for (const v of [0.35, dh - 0.4]) dmb.box('metalv', dw / 2, v, 0.05, dw - 0.06, 0.08, 0.02, '#2a2a2e');
    dmb.cyl('metalv', dw - 0.16, dh * 0.48, 0.07, 0.045, 0.04, '#c8a040', 8, null, 0, Math.PI / 2);
    if (door.locked) dmb.box('metalv', dw - 0.18, dh * 0.42, 0.06, 0.14, 0.2, 0.04, '#c0a040');
    const leaf = dmb.build(); leaf.position.set(doorOp.u0, fy, Z1 - 0.12); leaf.userData.b = b;
    structs.doors.push({ obj: leaf, door, b });
  }
  // floor, ceiling and beams
  const ix0 = X0 + Tl, ix1 = X1 - Tl, iz0 = Z0 + Tl, iz1 = Z1 - Tl;
  const stoneFloor = ['hall', 'bank', 'chamber', 'heroes', 'exchange'].includes(b.type);
  mb.box(stoneFloor ? 'stone' : 'planks', (ix0 + ix1) / 2, fy - 0.5, (iz0 + iz1) / 2, ix1 - ix0, 1.0, iz1 - iz0, stoneFloor ? (isLair ? '#6a625a' : '#b8b0a2') : '#a8805a');
  const ceil = isHall ? top - 0.5 : b.loft ? top - 0.3 : Math.min(top - 0.25, fy + (upper ? 2.75 : 3.2));
  b._ceil3 = ceil;
  mb.box(isHall || isLair ? 'stone' : 'planks', (ix0 + ix1) / 2, ceil + 0.08, (iz0 + iz1) / 2, ix1 - ix0, 0.16, iz1 - iz0, isHall ? '#a8a090' : '#8a6a4a');
  // an upper floor over the back of the room: planked floor on beams, a railing along its edge, and a staircase
  if (b.loft) {
    const L = b.loft, lf = fy + geo.LOFT_H; const lz0 = L.y0 * Tl, lz1 = (L.y1 + 1) * Tl, lx0 = L.x0 * Tl, lx1 = (L.x1 + 1) * Tl;
    mb.box('planks', (lx0 + lx1) / 2, lf - 0.08, (lz0 + lz1) / 2, lx1 - lx0, 0.16, lz1 - lz0, '#a8805a');
    for (let x = lx0 + Tl / 2; x < lx1; x += Tl) mb.box('timber', x, lf - 0.26, (lz0 + lz1) / 2, 0.18, 0.22, lz1 - lz0, '#5a3e24');
    mb.box('timber', (lx0 + lx1) / 2, lf - 0.3, lz1 - 0.1, lx1 - lx0, 0.3, 0.2, '#5a3e24');
    for (let x = lx0 + Tl * 1.5; x < lx1 - 0.2; x += Tl * 2) mb.boxB('timber', x, fy, lz1 - 0.12, 0.22, geo.LOFT_H - 0.3, 0.22, '#5a3e24');
    const sx0 = L.col * Tl, sx1 = sx0 + Tl; const railA = sx0 - lx0 > 0.1 ? [lx0, sx0] : [sx1, lx1];
    mb.box('timber', (railA[0] + railA[1]) / 2, lf + 0.95, lz1 - 0.06, railA[1] - railA[0], 0.1, 0.1, '#6a4a2a');
    for (let x = railA[0] + 0.15; x < railA[1]; x += 0.42) mb.boxB('timber', x, lf, lz1 - 0.06, 0.06, 0.95, 0.06, '#6a4a2a');
    // the steps, climbing toward the back wall
    for (const [i, s] of W.stairs || []) { if (s.loft !== b) continue; const ty = Math.floor(i / W.W);
      for (let q = 0; q < 4; q++) { const frac = (s.k + (q + 1) / 4) / s.n, h = geo.LOFT_H * frac; const z = (ty + 1 - (q + 0.5) / 4) * Tl;
        mb.boxB('planks', (sx0 + sx1) / 2, fy - 0.05, z, Tl - 0.1, h + 0.05, Tl / 4 + 0.02, '#8a6440'); }
      const inner = L.col === L.x0 ? sx1 - 0.05 : sx0 + 0.05; const zc = (ty + 0.5) * Tl, hc = fy + geo.LOFT_H * (s.k + 0.5) / s.n;
      mb.box('timber', inner, hc + 0.95, zc, 0.08, 0.08, Tl * 1.02, '#6a4a2a', 0, Math.atan2(geo.LOFT_H / s.n, Tl), 0); mb.boxB('timber', inner, fy, zc, 0.08, hc - fy + 0.95, 0.08, '#6a4a2a'); }
  }
  if (!isLair) { const alongX = (ix1 - ix0) < (iz1 - iz0); const n = Math.floor((alongX ? iz1 - iz0 : ix1 - ix0) / Tl); for (let k = 1; k < n + 1; k++) { if (alongX) mb.box('timber', (ix0 + ix1) / 2, ceil - 0.12, iz0 + k * Tl - Tl / 2, ix1 - ix0, 0.24, 0.2, '#4a3220'); else mb.box('timber', ix0 + k * Tl - Tl / 2, ceil - 0.12, (iz0 + iz1) / 2, 0.2, 0.24, iz1 - iz0, '#4a3220'); } }
  // wainscot inside wooden houses
  if (!isHall && !isLair && !st.stone) for (const [x, z, sx, sz] of [[(ix0 + ix1) / 2, iz0 + 0.03, ix1 - ix0, 0.06], [(ix0 + ix1) / 2, iz1 - 0.03, ix1 - ix0, 0.06], [ix0 + 0.03, (iz0 + iz1) / 2, 0.06, iz1 - iz0], [ix1 - 0.03, (iz0 + iz1) / 2, 0.06, iz1 - iz0]]) mb.box('planks', x, fy + 0.5, z, sx, 1.0, sz, '#8a6440');
  // roof
  if (isHall) hallRoof(mb, b, st, X0, X1, Z0, Z1, y0, top);
  else if (isLair) battlements(mb, X0, X1, Z0, Z1, top, 'darkstone', '#6a625c', 0.6);
  else gableRoof(mb, b, st, X0, X1, Z0, Z1, top, wallKey, wallCol);
  // crafting houses show their trade at the street front (crafthouses.js)
  if (!isHall && !isLair) try { craftFront(mb, b, st, X0, X1, Z0, Z1, y0, dX0, dX1, top, structs); } catch (e) { console.warn('craft front failed', b.type, e); }
  // chimney with smoke
  if (CHIMNEY.has(b.type)) {
    const cx = X1 - Tl * 0.9, cz = (Z0 + Z1) / 2 + ((b.w >= b.h) ? Tl * 0.3 : 0);
    const ridge = b._ridge3 || top + 2;
    mb.boxB('stone', cx, top - 1.2, cz, 0.75, ridge - top + 2.1, 0.75, '#8a7a6a');
    mb.box('stone', cx, ridge + 0.95, cz, 0.92, 0.18, 0.92, '#6a5a4a');
    structs.chimneys.push({ x: cx, y: ridge + 1.05, z: cz, b, forge: b.type === 'smithy' || b.type === 'forge' });
  }
  // hanging sign by the door
  if (SIGN[b.type] && !isHall) {
    const sx = dX1 + 0.55, sz = Z1 + 0.15, sy = fy + doorH + 0.4;
    mb.box('metalv', sx, sy + 0.42, sz + 0.3, 0.05, 0.05, 0.75, '#2a2a2a');
    structs.signs.push({ x: sx, y: sy, z: sz + 0.55, b, icon: SIGN[b.type], name: b.name });
  }
  // the castle banners
  if (isHall) for (const bx of [X0 + Tl * 1.5, X1 - Tl * 1.5, (dX0 + dX1) / 2 - Tl * 1.6, (dX0 + dX1) / 2 + Tl * 1.6]) structs.flags.push({ kind: 'hang', x: bx, y: top - 0.6, z: Z1 + 0.32, w: 1.1, h: 3.6, f: b.faction, rot: 0 });
  // remember the roof for the camera
  structs.roofs.push({ x0: X0 - 0.5, x1: X1 + 0.5, z0: Z0 - 0.5, z1: Z1 + 0.5, b, top, ridge: b._ridge3 || top, alongX: b.w >= b.h });
}

function gableRoof(mb, b, st, X0, X1, Z0, Z1, top, wallKey, wallCol) {
  const alongX = b.w >= b.h; const oh = 0.5;
  // work in a local frame where the ridge runs along u, the slope across v
  const U0 = (alongX ? X0 : Z0) - oh, U1 = (alongX ? X1 : Z1) + oh; const V0 = (alongX ? Z0 : X0), V1 = (alongX ? Z1 : X1);
  const half = (V1 - V0) / 2, vc = (V0 + V1) / 2;
  const P = (u, y, v) => (alongX ? V(u, y, v) : V(v, y, u));
  // profile from the eave (s=0) to the ridge (s=1): straight for crown/iron, curved for the elves
  const prof = []; const N = st.curve ? 5 : 1; const rise = half * st.pitch * (st.curve ? 1.2 : 1);
  for (let k = 0; k <= N; k++) { const s = k / N; const yy = st.curve ? rise * (1 - Math.pow(1 - s, 1.7)) : rise * s; prof.push([(half + oh) * (1 - s), yy]); }
  const eaveDrop = st.curve ? -0.25 : -oh * st.pitch;
  prof[0][1] += eaveDrop;
  const ridgeY = top + rise; b._ridge3 = ridgeY;
  const rc = st.roof;
  for (const sd of [-1, 1]) {
    for (let k = 0; k < N; k++) {
      const [d0, y0] = prof[k], [d1, y1] = prof[k + 1];
      const vA = vc + sd * d0, vB = vc + sd * d1; const len = Math.hypot(d0 - d1, y1 - y0);
      const sOff = prof.slice(0, k).reduce((s, p, i) => s + Math.hypot(prof[i][0] - prof[i + 1][0], prof[i + 1][1] - prof[i][1]), 0);
      const uvU0 = U0 / 1.6, uvU1 = U1 / 1.6, uvV0 = sOff / 1.6, uvV1 = (sOff + len) / 1.6;
      const a = P(U0, top + y0, vA), bb = P(U1, top + y0, vA), c = P(U1, top + y1, vB), d = P(U0, top + y1, vB);
      // top surface faces outward/up; flip winding on one side
      quad(mb, st.roofMat, a, bb, c, d, [uvU0, uvV0, uvU1, uvV0, uvU1, uvV1, uvU0, uvV1], rc, true);
      // underside (seen from below the eaves)
      const dn = -0.14;
      const a2 = P(U0, top + y0 + dn, vA), b2 = P(U1, top + y0 + dn, vA), c2 = P(U1, top + y1 + dn, vB), d2 = P(U0, top + y1 + dn, vB);
      quad(mb, 'timber', a2, b2, c2, d2, [0, 0, (U1 - U0) / 1.2, 0, (U1 - U0) / 1.2, len / 1.2, 0, len / 1.2], '#5a3e28', false);
    }
    // fascia board along the eave
    const ev = vc + sd * (half + oh); const ey = top + prof[0][1] - 0.07;
    if (alongX) mb.box('timber', (U0 + U1) / 2, ey, ev, U1 - U0, 0.2, 0.08, st.beam); else mb.box('timber', ev, ey, (U0 + U1) / 2, 0.08, 0.2, U1 - U0, st.beam);
  }
  // ridge cap
  if (alongX) mb.box(st.roofMat, (U0 + U1) / 2, ridgeY + 0.05, vc, U1 - U0, 0.2, 0.32, K3.shade(rc, -0.25)); else mb.box(st.roofMat, vc, ridgeY + 0.05, (U0 + U1) / 2, 0.32, 0.2, U1 - U0, K3.shade(rc, -0.25));
  if (st.curve) for (const u of [U0 + 0.1, U1 - 0.1]) { const p = P(u, ridgeY + 0.15, vc); mb.cone('gold', p.x, p.y, p.z, 0.12, 0.7, st.trim, 8); }
  // gable ends: fill the triangle on top of the end walls
  const poly = [[-half, 0], [half, 0]]; const side = prof.filter(([d]) => d <= half + 1e-3).map(([d, y]) => [d, Math.max(0, y - 0.24 - (st.curve ? 0.12 : 0))]); // kept under the roof's underside so the two never fight (that flickered)
  for (const [d, y] of side) poly.push([d, y]); for (const [d, y] of [...side].reverse()) poly.push([-d, y]);
  const clean = poly.filter((p, i) => i === 0 || Math.abs(p[0] - poly[i - 1][0]) > 1e-3 || Math.abs(p[1] - poly[i - 1][1]) > 1e-3);
  for (const endU of [alongX ? X0 : Z0, alongX ? X1 - Tl : Z1 - Tl]) {
    const m = new THREE.Matrix4();
    if (alongX) m.makeRotationY(Math.PI / 2).setPosition(endU, top, vc); else m.makeTranslation(vc, top, endU);
    prism(mb, st.frame ? 'plaster' : wallKey, clean, Tl, m, st.frame ? st.wall : wallCol);
    if (st.frame) { // timber king post in the gable
      const ep = alongX ? endU + (endU === X0 ? -0.04 : Tl + 0.04) : endU + (endU === Z0 ? -0.04 : Tl + 0.04);
      if (alongX) mb.box('timber', ep, top + rise * 0.45, vc, 0.08, rise * 0.9, 0.16, st.beam); else mb.box('timber', vc, top + rise * 0.45, ep, 0.16, rise * 0.9, 0.08, st.beam);
    }
  }
}

function battlements(mb, X0, X1, Z0, Z1, top, key, col, h = 0.8) {
  const mw = 0.55, gap = 0.5, th = 0.45;
  mb.box(key, (X0 + X1) / 2, top + 0.1, (Z0 + Z1) / 2, X1 - X0, 0.2, Z1 - Z0, col);
  const run = (a0, a1, fixed, alongX) => { const L = a1 - a0; const n = Math.max(1, Math.floor(L / (mw + gap))); const s = L / n; for (let k = 0; k < n; k++) { const u = a0 + s * (k + 0.5); if (alongX) mb.box(key, u, top + 0.2 + h / 2, fixed, mw, h, th, col); else mb.box(key, fixed, top + 0.2 + h / 2, u, th, h, mw, col); } };
  run(X0, X1, Z0 + th / 2, true); run(X0, X1, Z1 - th / 2, true); run(Z0 + th, Z1 - th, X0 + th / 2, false); run(Z0 + th, Z1 - th, X1 - th / 2, false);
  mb.box(key, (X0 + X1) / 2, top + 0.2 + 0.25, Z0 + th / 2, X1 - X0, 0.5, th, col); mb.box(key, (X0 + X1) / 2, top + 0.45, Z1 - th / 2, X1 - X0, 0.5, th, col);
  mb.box(key, X0 + th / 2, top + 0.45, (Z0 + Z1) / 2, th, 0.5, Z1 - Z0, col); mb.box(key, X1 - th / 2, top + 0.45, (Z0 + Z1) / 2, th, 0.5, Z1 - Z0, col);
}
function tower(mb, x, z, r, y0, h, st, roofKind, f) {
  const stoneCol = st === STYLE.sylvan ? '#e4ded0' : '#c4bcae';
  mb.cylB('stone', x, y0 - 1, z, r * 1.06, 1.6, '#a8a090', 16);
  mb.cylB('stone', x, y0, z, r, h, stoneCol, 16);
  // corbelled ring and crenels
  mb.cylB('stone', x, y0 + h - 0.1, z, r + 0.28, 0.5, '#b0a898', 16);
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; mb.boxB('stone', x + Math.cos(a) * (r + 0.12), y0 + h + 0.4, z + Math.sin(a) * (r + 0.12), 0.5, 0.75, 0.32, stoneCol, -a + Math.PI / 2); }
  // arrow slits
  for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + 0.4; for (const yy of [0.45, 0.72]) mb.boxB('dark', x + Math.cos(a) * (r - 0.02), y0 + h * yy, z + Math.sin(a) * (r - 0.02), 0.12, 0.8, 0.12, null, -a); }
  if (roofKind === 'cone' || roofKind === 'spire') {
    const rh = roofKind === 'spire' ? r * 4.6 : r * 2.4; const col = st.roof;
    mb.cone(st.roofMat === 'shingle' ? 'shingle' : st.roofMat === 'slate' ? 'slate' : 'rooftile', x, y0 + h + 0.4, z, r + 0.42, rh, col, 16);
    mb.cyl('gold', x, y0 + h + 0.4 + rh + 0.25, z, 0.05, 0.6, st.trim, 6);
    structs.flags.push({ kind: 'pole', x, y: y0 + h + 0.4 + rh + 0.4, z, w: 1.2, h: 0.75, f });
  }
}
function hallRoof(mb, b, st, X0, X1, Z0, Z1, y0, top) {
  // parapet with crenellations, a steep roof behind it, round towers on the corners and a tall keep at the back
  battlements(mb, X0, X1, Z0, Z1, top, 'stone', b.style === 'sylvan' ? '#e4ded0' : '#bdb5a6', 0.9);
  const inset = 0.7; const rst = Object.assign({}, st, { curve: false, pitch: st === STYLE.sylvan ? 0.95 : 0.8 });
  const fakeB = { w: b.w, h: b.h };
  const rmb = { x0: X0 + inset, x1: X1 - inset, z0: Z0 + inset, z1: Z1 - inset };
  gableRoof(mb, fakeB, rst, rmb.x0, rmb.x1, rmb.z0, rmb.z1, top + 0.2, 'stone', '#bdb5a6');
  b._ridge3 = fakeB._ridge3;
  const r = Tl * 0.82, th = 8.2 + 4.8;
  const corners = [[X0 + Tl * 0.5, Z0 + Tl * 0.5], [X1 - Tl * 0.5, Z0 + Tl * 0.5], [X0 + Tl * 0.5, Z1 - Tl * 0.5], [X1 - Tl * 0.5, Z1 - Tl * 0.5]];
  for (const [x, z] of corners) tower(mb, x, z, r, y0, th, st, st === STYLE.sylvan ? 'spire' : 'cone', b.faction);
  // the keep: a square tower over the back wall
  const kx = (X0 + X1) / 2, kz = Z0 + Tl, kw = Tl * 2.6, kh = 19;
  mb.boxB('stone', kx, y0 - 1, kz, kw, kh + 1, kw, b.style === 'sylvan' ? '#e8e2d4' : '#c8c0b2');
  for (let k = 0; k < 3; k++) for (const sx of [-1, 1]) mb.boxB('window', kx + sx * kw * 0.25, y0 + 9 + k * 3, kz + kw / 2 + 0.02, 0.42, 1.2, 0.05, '#ffffff');
  battlements(mb, kx - kw / 2 - 0.25, kx + kw / 2 + 0.25, kz - kw / 2 - 0.25, kz + kw / 2 + 0.25, y0 + kh, 'stone', '#b8b0a2', 1);
  if (st === STYLE.sylvan) { mb.cone('shingle', kx, y0 + kh + 0.3, kz, kw * 0.62, 9, st.roof, 16); mb.cyl('gold', kx, y0 + kh + 9.6, kz, 0.06, 1.2, st.trim, 6); structs.flags.push({ kind: 'pole', x: kx, y: y0 + kh + 10.1, z: kz, w: 2.2, h: 1.3, f: b.faction }); }
  else { mb.cyl('timber', kx, y0 + kh + 3, kz, 0.07, 6, '#4a3220', 6); structs.flags.push({ kind: 'pole', x: kx, y: y0 + kh + 5.6, z: kz, w: 2.6, h: 1.5, f: b.faction }); }
  b._keepTop = y0 + kh + 1;
}

// ---------- city walls, towers and gatehouses ----------
function cityWalls(mb, f, cd) {
  const { cx, cy, R } = cd; const y0 = cd._y3 != null ? cd._y3 : 0; const st = STYLE[f] || STYLE.crown;
  const H = 7.4, col = f === 'sylvan' ? '#ddd6c4' : '#bbb3a4';
  const isWall = (tx, ty) => W.tile(tx, ty) === T.CWALL;
  // plain wall tiles with a walkway and merlons on the outer edge
  for (let ty = cy - R; ty <= cy + R; ty++) for (let tx = cx - R; tx <= cx + R; tx++) {
    if (!isWall(tx, ty)) continue;
    const x = (tx + 0.5) * Tl, z = (ty + 0.5) * Tl;
    mb.boxB('stone', x, y0 - 1.5, z, Tl, H + 1.5, Tl, col);
    // battered foot
    const dx = tx - cx, dy = ty - cy; const nx = Math.abs(dx) === R ? Math.sign(dx) : 0, nz = Math.abs(dy) === R ? Math.sign(dy) : 0;
    if (nx || nz) {
      mb.box('stone', x + nx * 0.95, y0 + 0.4, z + nz * 0.95, nx ? 0.5 : Tl, 2.2, nz ? 0.5 : Tl, K3.shade(col, -0.08), 0, nz ? -0.25 * nz : 0, nx ? 0.25 * nx : 0);
      // merlon on the outside edge every other tile, a low wall in between
      const ox = x + nx * (Tl / 2 - 0.22), oz = z + nz * (Tl / 2 - 0.22);
      mb.boxB('stone', ox, y0 + H, oz, nx ? 0.44 : Tl, 0.55, nz ? 0.44 : Tl, col);
      if ((tx + ty) % 2 === 0) mb.boxB('stone', ox, y0 + H + 0.55, oz, nx ? 0.44 : Tl * 0.62, 0.7, nz ? 0.44 : Tl * 0.62, col);
      // inner parapet
      const ix = x - nx * (Tl / 2 - 0.15), iz = z - nz * (Tl / 2 - 0.15);
      mb.boxB('stone', ix, y0 + H, iz, nx ? 0.3 : Tl, 0.5, nz ? 0.3 : Tl, K3.shade(col, -0.05));
    }
  }
  // corner towers
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = (cx + sx * R + 0.5) * Tl, z = (cy + sy * R + 0.5) * Tl;
    tower(mb, x, z, 2.6, y0, H + 4.2, st, 'cone', f);
  }
  // gatehouses: a tower on each side of the opening, an arch with a raised portcullis between them
  for (const g of cd.gates || []) {
    const [gx, gy] = g; const north = gy === cy - R; const south = gy === cy + R || north; const sgn = north ? -1 : 1;
    const tw = Tl * 1.6, td = Tl * 2.2, tH = H + 3;
    if (south) {
      const z = (gy + 0.5) * Tl, x0 = (gx - (north ? 2 : 1)) * Tl, x1 = (gx + (north ? 3 : 2)) * Tl;
      for (const xc of [x0 - tw / 2, x1 + tw / 2]) { mb.boxB('stone', xc, y0 - 1.5, z, tw, tH + 1.5, td, K3.shade(col, -0.04)); battlements(mb, xc - tw / 2 - 0.15, xc + tw / 2 + 0.15, z - td / 2 - 0.15, z + td / 2 + 0.15, y0 + tH, 'stone', col, 0.8); structs.torches.push({ x: xc + (xc < x0 ? tw / 2 - 0.3 : -tw / 2 + 0.3), y: y0 + 3.2, z: z + td / 2 + 0.12 }); }
      mb.box('stone', (x0 + x1) / 2, y0 + 5.6 + (tH - 5.6) / 2, z, x1 - x0, tH - 5.6, Tl * 1.6, col);
      for (let k = 0; k <= 10; k++) { const a = Math.PI * k / 10; mb.box('stone', (x0 + x1) / 2 + Math.cos(a) * (x1 - x0) / 2, y0 + 4.4 + Math.sin(a) * 1.2, z + Tl * 0.8, 0.5, 0.5, 0.4, K3.shade(col, -0.1), 0, 0, a); }
      for (let k = 0; k < 9; k++) mb.boxB('metalv', x0 + 0.25 + k * ((x1 - x0 - 0.5) / 8), y0 + 4.8, z, 0.07, 0.9, 0.07, '#2a2a2e');
      mb.box('metalv', (x0 + x1) / 2, y0 + 5.15, z, x1 - x0, 0.08, 0.08, '#2a2a2e');
      battlements(mb, x0, x1, z - Tl * 0.8, z + Tl * 0.8, y0 + tH, 'stone', col, 0.7);
      structs.flags.push({ kind: 'hang', x: (x0 + x1) / 2, y: y0 + tH - 0.4, z: z + sgn * Tl * 0.82, w: 1.6, h: 3.0, f, rot: north ? Math.PI : 0 });
    } else {
      const side = gx > cx ? 1 : -1; const x = (gx + 0.5) * Tl, z0 = (gy - 1) * Tl, z1 = (gy + 2) * Tl;
      for (const zc of [z0 - tw / 2, z1 + tw / 2]) { mb.boxB('stone', x, y0 - 1.5, zc, td, tH + 1.5, tw, K3.shade(col, -0.04)); battlements(mb, x - td / 2 - 0.15, x + td / 2 + 0.15, zc - tw / 2 - 0.15, zc + tw / 2 + 0.15, y0 + tH, 'stone', col, 0.8); structs.torches.push({ x: x + side * (td / 2 + 0.12), y: y0 + 3.2, z: zc + (zc < z0 ? tw / 2 - 0.3 : -tw / 2 + 0.3) }); }
      mb.box('stone', x, y0 + 5.6 + (tH - 5.6) / 2, (z0 + z1) / 2, Tl * 1.6, tH - 5.6, z1 - z0, col);
      for (let k = 0; k <= 10; k++) { const a = Math.PI * k / 10; mb.box('stone', x + side * Tl * 0.8, y0 + 4.4 + Math.sin(a) * 1.2, (z0 + z1) / 2 + Math.cos(a) * (z1 - z0) / 2, 0.4, 0.5, 0.5, K3.shade(col, -0.1), 0, -a, 0); }
      for (let k = 0; k < 9; k++) mb.boxB('metalv', x, y0 + 4.8, z0 + 0.25 + k * ((z1 - z0 - 0.5) / 8), 0.07, 0.9, 0.07, '#2a2a2e');
      battlements(mb, x - Tl * 0.8, x + Tl * 0.8, z0, z1, y0 + tH, 'stone', col, 0.7);
      structs.flags.push({ kind: 'hang', x: x + side * Tl * 0.82, y: y0 + tH - 0.4, z: (z0 + z1) / 2, w: 1.6, h: 3.0, f, rot: side * Math.PI / 2 });
    }
  }
  cd._wallTop3 = y0 + H;
  // stone stairs up the inside of the wall: a solid flight of steps with a low parapet on the open side
  if (W.stairs) for (const [i, s] of W.stairs) {
    if (s.f !== f) continue; const tx = i % W.W, ty = Math.floor(i / W.W);
    for (let q = 0; q < 4; q++) {
      const frac = (s.k + (q + 1) / 4) / s.n, top = y0 + H * frac; const o = (q + 0.5) / 4 - 0.5;
      const x = (tx + 0.5 + (s.dir[0] ? o : 0)) * Tl, z = (ty + 0.5 + (s.dir[1] ? o : 0)) * Tl;
      mb.boxB('stone', x, y0 - 0.5, z, s.dir[0] ? Tl / 4 + 0.02 : Tl, top - y0 + 0.5, s.dir[1] ? Tl / 4 + 0.02 : Tl, K3.shade(col, -0.06 - q * 0.01));
      const px = x - s.wall[0] * (Tl / 2 - 0.12), pz = z - s.wall[1] * (Tl / 2 - 0.12);
      mb.boxB('stone', px, top, pz, s.wall[0] ? 0.24 : (s.dir[0] ? Tl / 4 + 0.02 : 0.24), 0.75, s.wall[1] ? 0.24 : (s.dir[1] ? Tl / 4 + 0.02 : 0.24), K3.shade(col, -0.12));
    }
  }
}

// ---------- other walls: sewer outflows, crypt and sewer halls ----------
function looseWalls(mb, x0, y0, x1, y1) {
  const dg = geo.dungeon; const H = dg ? geo.ceilH + 0.3 : 3.4;
  const key = dg && geo.dgnId === 'sunken' ? 'stone' : dg ? 'darkstone' : 'stone';
  const col = dg ? (geo.dgnId === 'abyss' ? '#6a4a48' : geo.dgnId === 'sunken' ? '#7a9088' : '#8a8278') : '#7a6e62';
  for (let ty = y0; ty < y1; ty++) for (let tx = x0; tx < x1; tx++) {
    if (!W.inb(tx, ty)) continue; const i = ty * W.W + tx; const t = W.tiles[i];
    const isW = t === T.WALL && geo.bmap[i] < 0; const isRockWall = dg && geo.dtype !== 'cave' && t === T.ROCK;
    if (!isW && !isRockWall) continue;
    // only walls that face an open tile need building in dungeons
    if (dg) { let open = false; for (let dy = -1; dy <= 1 && !open; dy++) for (let dx = -1; dx <= 1; dx++) { const tt = W.tile(tx + dx, ty + dy); if (tt !== T.WALL && tt !== T.ROCK) { open = true; break; } } if (!open) continue; }
    const g = geo.groundT(tx + 0.5, ty + 0.5);
    mb.boxB(key, (tx + 0.5) * Tl, Math.min(g, 0) - 1, (ty + 0.5) * Tl, Tl, H + 1 + (dg ? 0 : g - Math.min(g, 0)), Tl, col);
    if (dg && K3.hash(tx, ty, 5) < 0.12) mb.boxB(key, (tx + 0.5) * Tl, 0, (ty + 0.5) * Tl, Tl + 0.3, 0.5, Tl + 0.3, K3.shade(col, -0.15));
  }
}

// ---------- bridges over rivers and docks over the sea ----------
function decks(mb, x0, y0, x1, y1) {
  const isDeck = (tx, ty) => { if (!W.inb(tx, ty)) return false; const c = geo.cls[ty * W.W + tx]; return c === 6 || c === 7; };
  for (let ty = y0; ty < y1; ty++) for (let tx = x0; tx < x1; tx++) {
    if (!isDeck(tx, ty)) continue; const i = ty * W.W + tx; const y = geo.deck[i]; if (isNaN(y)) continue;
    const bridge = geo.cls[i] === 6; const x = (tx + 0.5) * Tl, z = (ty + 0.5) * Tl;
    // which way the planks run: across the direction of travel
    const alongX = isDeck(tx - 1, ty) || isDeck(tx + 1, ty) || W.tile(tx - 1, ty) === T.ROAD || W.tile(tx + 1, ty) === T.ROAD;
    const n = 5; for (let k = 0; k < n; k++) { const o = (k + 0.5) / n * Tl - Tl / 2; const tint = K3.hash(tx * 7 + k, ty, 3) * 0.25; if (alongX) mb.box('planks', x + o, y - 0.06, z, Tl / n - 0.02, 0.1, Tl, K3.shade(bridge ? '#8a6440' : '#7a5a38', -tint)); else mb.box('planks', x, y - 0.06, z + o, Tl, 0.1, Tl / n - 0.02, K3.shade(bridge ? '#8a6440' : '#7a5a38', -tint)); }
    // beams underneath and posts down into the water
    if (alongX) { for (const s2 of [-0.6, 0.6]) mb.box('timber', x, y - 0.22, z + s2, Tl, 0.18, 0.16, '#4a3220'); } else { for (const s2 of [-0.6, 0.6]) mb.box('timber', x + s2, y - 0.22, z, 0.16, 0.18, Tl, '#4a3220'); }
    const bed = geo.groundT(tx + 0.5, ty + 0.5); if ((tx + ty) % 2 === 0) for (const s2 of [-0.65, 0.65]) { const px = alongX ? x : x + s2, pz = alongX ? z + s2 : z; mb.cyl('bark', px, (y + bed) / 2 - 0.3, pz, 0.12, y - bed + 0.6, '#5a3a20', 8); }
    // railings on the open sides of bridges
    if (bridge) for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = tx + dx, ny = ty + dy; if (isDeck(nx, ny) || W.tile(nx, ny) === T.ROAD) continue;
      const t2 = W.tile(nx, ny); if (t2 !== T.WATER && t2 !== T.DEEP) continue;
      const rx = x + dx * (Tl / 2 - 0.08), rz = z + dy * (Tl / 2 - 0.08);
      if (dx) { mb.box('timber', rx, y + 0.85, rz, 0.1, 0.1, Tl, '#6a4a2a'); mb.boxB('timber', rx, y, rz - Tl / 2 + 0.06, 0.12, 0.95, 0.12, '#5a3a20'); }
      else { mb.box('timber', rx, y + 0.85, rz, Tl, 0.1, 0.1, '#6a4a2a'); mb.boxB('timber', rx - Tl / 2 + 0.06, y, rz, 0.12, 0.95, 0.12, '#5a3a20'); }
    }
  }
}

// ---------- flags and banners (cloth that waves) ----------
const flagMats = {};
function flagMaterial(f) {
  if (flagMats[f]) return flagMats[f];
  const F = D.FACTIONS[f] || { banner: '#5a1a1a', trim: '#e0c060' };
  const tex = K3.canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = F.banner; g.fillRect(0, 0, w, h);
    g.fillStyle = F.trim; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 26, w, 6); g.fillRect(6, 0, 4, h); g.fillRect(w - 10, 0, 4, h);
    // the faction emblem: a crown for Valen, a tree for the elves
    g.save(); g.translate(w / 2, h * 0.42); g.fillStyle = F.trim; g.strokeStyle = F.trim; g.lineWidth = 4;
    if (f === 'sylvan') { g.beginPath(); g.moveTo(0, 46); g.lineTo(0, -10); g.stroke(); for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k - 3) * 0.42; g.beginPath(); g.ellipse(Math.cos(a) * 26, -16 + Math.sin(a) * 26, 12, 6, a, 0, 6.283); g.fill(); } g.beginPath(); g.arc(0, -16, 9, 0, 6.283); g.fill(); }
    else { g.beginPath(); g.moveTo(-34, 22); g.lineTo(-34, -14); g.lineTo(-18, 4); g.lineTo(0, -26); g.lineTo(18, 4); g.lineTo(34, -14); g.lineTo(34, 22); g.closePath(); g.fill(); g.fillStyle = F.banner; for (const x of [-20, 0, 20]) { g.beginPath(); g.arc(x, 12, 4, 0, 6.283); g.fill(); } }
    g.restore();
    // swallow tail
    g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.moveTo(0, h); g.lineTo(w / 2, h - 30); g.lineTo(w, h); g.fill();
  });
  const m = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.95, alphaTest: 0.5 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = K3.shared.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; attribute float aFree;').replace('#include <begin_vertex>', `#include <begin_vertex>
      float ph = uTime * 2.6 + position.x * 2.1 + position.y * 0.7 + modelMatrix[3].x * 0.3;
      transformed.z += sin(ph) * 0.12 * aFree + sin(ph * 2.3) * 0.04 * aFree;
      transformed.x += cos(ph * 0.7) * 0.03 * aFree;`);
  };
  return (flagMats[f] = m);
}
function flagGeom(w, h, kind) {
  // kind 'pole': flag flies sideways from the pole top (attached at x=0); 'hang': banner hangs down (attached at the top)
  const g = new THREE.PlaneGeometry(w, h, 10, 12);
  const pos = g.attributes.position; const free = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    if (kind === 'pole') { pos.setXY(i, x + w / 2, y); free[i] = (x + w / 2) / w; } else { pos.setXY(i, x, y - h / 2); free[i] = Math.pow((h / 2 - y) / h, 1.3) * 0.6; }
  }
  if (kind === 'pole') { // swap uv so the banner art reads sideways along the flag
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) { const u = uv.getX(i), v = uv.getY(i); uv.setXY(i, 1 - v, u); }
  }
  g.setAttribute('aFree', new THREE.BufferAttribute(free, 1));
  g.computeVertexNormals();
  return g;
}

// ---------- signs ----------
function signMesh(s) {
  const tex = K3.canvasTex(256, 160, (g, w, h) => {
    g.fillStyle = '#6a4a2a'; g.fillRect(0, 0, w, h); g.fillStyle = '#8a6440'; g.fillRect(8, 8, w - 16, h - 16);
    g.strokeStyle = '#3a2614'; g.lineWidth = 6; g.strokeRect(4, 4, w - 8, h - 8);
    g.font = '64px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s.icon, w / 2, 62);
    g.fillStyle = '#f4e6c0'; g.font = 'bold 22px Georgia, serif'; let nm = s.name || ''; while (g.measureText(nm).width > w - 30 && nm.length > 4) nm = nm.slice(0, -1); g.fillText(nm, w / 2, 128);
  });
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.05), [new THREE.MeshStandardMaterial({ color: 0x5a3e24 }), new THREE.MeshStandardMaterial({ color: 0x5a3e24 }), new THREE.MeshStandardMaterial({ color: 0x5a3e24 }), new THREE.MeshStandardMaterial({ color: 0x5a3e24 }), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })]);
  m.position.set(s.x, s.y, s.z); m.rotation.y = Math.PI / 2; m.castShadow = true;
  return m;
}

// ---------- build everything for one area (a chunk of tiles) ----------
export function buildStructuresIn(x0, y0, x1, y1, ownsBuilding) {
  const mb = new MB();
  const extra = new THREE.Group();
  for (const b of W.buildings) {
    const cxT = b.x + b.w / 2, cyT = b.y + b.h / 2;
    if (cxT < x0 || cxT >= x1 || cyT < y0 || cyT >= y1) continue;
    const d0 = structs.doors.length, s0 = structs.signs.length, f0 = structs.flags.length;
    try { building(mb, b); } catch (e) { console.warn('building failed', b.type, e); }
    for (let i = d0; i < structs.doors.length; i++) extra.add(structs.doors[i].obj);
    for (let i = s0; i < structs.signs.length; i++) extra.add(signMesh(structs.signs[i]));
  }
  for (const f in W.cityData) {
    const cd = W.cityData[f]; if (!cd || cd.cx == null) continue;
    if (cd.cx < x0 || cd.cx >= x1 || cd.cy < y0 || cd.cy >= y1) continue;
    try { cityWalls(mb, f, cd); } catch (e) { console.warn('walls failed', e); }
  }
  looseWalls(mb, x0, y0, x1, y1);
  decks(mb, x0, y0, x1, y1);
  const grp = mb.build();
  grp.add(extra);
  return grp;
}
export function buildFlags(list, group) {
  for (const fl of list) {
    const g = flagGeom(fl.w, fl.h, fl.kind); const m = new THREE.Mesh(g, flagMaterial(fl.f));
    m.position.set(fl.x, fl.y, fl.z); m.rotation.y = fl.rot || 0; m.castShadow = true;
    if (fl.kind === 'hang') { const pole = new THREE.Mesh(PRIM.cyl8, mats.get('metalv')); pole.scale.set(0.05, fl.w + 0.3, 0.05); pole.rotation.z = Math.PI / 2; pole.position.y = 0.02; m.add(pole); }
    group.add(m);
  }
}
// roofs for the camera: height of a roof surface at x, z (or null)
geo.roofAt = function (x, z) {
  let best = null;
  for (const r of structs.roofs) {
    if (x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1) continue;
    const b = r.b; const X0 = b.x * Tl, X1 = (b.x + b.w) * Tl, Z0 = b.y * Tl, Z1 = (b.y + b.h) * Tl;
    const half = r.alongX ? (Z1 - Z0) / 2 : (X1 - X0) / 2; const d = r.alongX ? Math.abs(z - (Z0 + Z1) / 2) : Math.abs(x - (X0 + X1) / 2);
    const y = r.top + (r.ridge - r.top) * Math.max(0, 1 - d / (half + 0.5)) - 0.1;
    best = best == null ? y : Math.max(best, y);
  }
  return best;
};
geo.structTop = function (x, z) {
  const tx = Math.floor(x / Tl), ty = Math.floor(z / Tl); if (!W.inb(tx, ty)) return 0;
  const i = ty * W.W + tx; const bi = geo.bmap[i];
  if (bi >= 0) { const b = W.buildings[bi]; return (b._y3 || 0) + (HEIGHT[b.type] || 4.2) + 0.3; }
  if (W.tiles[i] === T.CWALL) { for (const f in W.cityData) { const cd = W.cityData[f]; if (cd && cd._wallTop3 && Math.abs(tx - cd.cx) <= cd.R + 1 && Math.abs(ty - cd.cy) <= cd.R + 1) return cd._wallTop3 + 1.2; } }
  return geo.groundT(tx + 0.5, ty + 0.5) + 3.6;
};
geo.ceilAt = function (x, z) { if (!geo.CEIL) return geo.ceilH || 99; const VW = geo.VW; const u = K3.clamp(x / Tl, 0, geo.W - 0.001), v = K3.clamp(z / Tl, 0, geo.H - 0.001); const xi = Math.floor(u), yi = Math.floor(v), fx = u - xi, fy = v - yi; const C = geo.CEIL, i = yi * VW + xi; return C[i] + (C[i + 1] - C[i]) * fx + (C[i + VW] - C[i]) * fy + (C[i] - C[i + 1] - C[i + VW] + C[i + VW + 1]) * fx * fy; };

export function resetStructs() { for (const k in structs) structs[k].length = 0; }
export { HEIGHT, STYLE };
