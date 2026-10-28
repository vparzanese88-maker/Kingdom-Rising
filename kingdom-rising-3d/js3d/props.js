// Kingdom Rising 3D — every decoration in the 2D game as a 3D model: furniture, lamps and torches,
// camp fires, tents, market stalls, fountains, statues, tombs, cave mouths, sewer outflows, boats...
// Trees, rocks, grass and flowers are instanced separately (veg.js).
import { THREE, K3, TILE, TS, PX } from './core.js';
import { geo, T } from './geo.js';
import { MB, PRIM } from './mb.js';
import { buildShip } from './ships.js';
import { outflowPipe, sewerExit } from './sewer3d.js';

const KR = window.KR, D = KR.D, W = KR.W;
const Tl = TILE;
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();

// lathe profiles (radius, height) for round things
const LATHE = {};
function lathe(name, pts, seg = 16) { if (!LATHE[name]) LATHE[name] = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg); return LATHE[name]; }
const barrelG = () => lathe('barrel', [[0, 0], [0.34, 0], [0.4, 0.2], [0.43, 0.45], [0.4, 0.7], [0.34, 0.9], [0, 0.9]]);
const bowlG = () => lathe('bowl', [[0, 0], [0.12, 0], [0.12, 0.35], [0.45, 0.55], [0.5, 0.7], [0.42, 0.72], [0.1, 0.5], [0, 0.5]]);
const columnG = () => lathe('column', [[0, 0], [0.42, 0], [0.42, 0.12], [0.34, 0.22], [0.3, 0.3], [0.27, 3.6], [0.3, 3.75], [0.38, 3.85], [0.42, 3.95], [0, 3.95]], 14);
const basinG = () => lathe('basin', [[2.3, 0], [2.6, 0], [2.65, 0.65], [2.45, 0.7], [2.35, 0.25], [0, 0.25]], 32);
const urnG = () => lathe('urn', [[0, 0], [0.2, 0], [0.28, 0.25], [0.22, 0.55], [0.14, 0.62], [0.18, 0.7], [0, 0.7]], 12);

// a placer: builds pieces in a prop's local space (front faces +z) and drops them into the mesh builder
class Put {
  constructor(mb, x, y, z, ry, out) { this.mb = mb; this.base = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1)); this.out = out; this.x = x; this.y = y; this.z = z; this.ry = ry; }
  m(lx, ly, lz, sx, sy, sz, ry = 0, rx = 0, rz = 0) { _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e); _m.compose(_v.set(lx, ly, lz), _q, _s.set(sx, sy, sz)); return _m2.multiplyMatrices(this.base, _m); }
  g(key, geom, lx, ly, lz, sx, sy, sz, col, ry, rx, rz) { this.mb.add(key, geom, this.m(lx, ly, lz, sx, sy, sz, ry, rx, rz), col); return this; }
  box(key, lx, ly, lz, sx, sy, sz, col, ry, rx, rz) { return this.g(key, PRIM.box, lx, ly, lz, sx, sy, sz, col, ry, rx, rz); }
  boxB(key, lx, ly, lz, sx, sy, sz, col, ry) { return this.g(key, PRIM.box, lx, ly + sy / 2, lz, sx, sy, sz, col, ry); }
  cyl(key, lx, ly, lz, r, h, col, seg = 12, rx = 0, rz = 0) { return this.g(key, seg <= 8 ? PRIM.cyl8 : seg <= 12 ? PRIM.cyl12 : PRIM.cyl16, lx, ly, lz, r * 2, h, r * 2, 0, rx, rz); }
  cylB(key, lx, ly, lz, r, h, col, seg) { return this.cyl(key, lx, ly + h / 2, lz, r, h, col, seg); }
  sph(key, lx, ly, lz, sx, sy, sz, col) { return this.g(key, PRIM.sph12, lx, ly, lz, sx, sy, sz, col); }
  cone(key, lx, ly, lz, r, h, col, seg = 12) { return this.g(key, seg <= 8 ? PRIM.cone8 : PRIM.cone12, lx, ly + h / 2, lz, r * 2, h, r * 2, col); }
  rock(key, lx, ly, lz, sx, sy, sz, col, ry = 0) { return this.g(key, PRIM.ico, lx, ly, lz, sx, sy, sz, col, ry); }
  w(lx, ly, lz) { return _v.set(lx, ly, lz).applyMatrix4(this.base).clone(); }
  flame(lx, ly, lz, w, h, col = [3.2, 1.6, 0.55]) { const p = this.w(lx, ly, lz); this.out.flames.push({ x: p.x, y: p.y, z: p.z, w, h, r: col[0], g: col[1], b: col[2], kind: 0 }); return this; }
  glow(lx, ly, lz, s, col = [2.4, 1.6, 0.7], a = 0.6) { const p = this.w(lx, ly, lz); this.out.flames.push({ x: p.x, y: p.y, z: p.z, w: s, h: s, r: col[0], g: col[1], b: col[2], a, kind: 1 }); return this; }
  smoke(lx, ly, lz, kind = 'fire') { const p = this.w(lx, ly, lz); this.out.smokes.push({ x: p.x, y: p.y, z: p.z, kind }); return this; }
}

// which way furniture faces: away from the wall it stands against
function facing(d) {
  const b = W.buildings.find((bb) => d.tx > bb.x && d.tx < bb.x + bb.w - 1 && d.ty > bb.y && d.ty < bb.y + bb.h - 1);
  if (!b) return { ry: (Math.floor(d.v * 4)) * Math.PI / 2 * 0, b: null };
  const n = d.ty - b.y, s = b.y + b.h - 1 - d.ty, w = d.tx - b.x, e = b.x + b.w - 1 - d.tx;
  const m = Math.min(n, s, w, e);
  // a piece set out in the room with a fixed facing (a bar counter, a bunk) faces that way and is not pushed to a wall
  if (d.face) { const ry = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 }[d.face]; const wall = { s: 'n', n: 's', e: 'w', w: 'e' }[d.face]; return { ry, b, wall, m: (wall === 'n' ? n : wall === 's' ? s : wall === 'w' ? w : e) }; }
  if (m === n) return { ry: 0, b, wall: 'n', m }; if (m === s) return { ry: Math.PI, b, wall: 's', m }; if (m === w) return { ry: Math.PI / 2, b, wall: 'w', m }; return { ry: -Math.PI / 2, b, wall: 'e', m };
}
// how far a piece of furniture is pushed back toward its wall: until its back stands flush with the wall's face
// (a tile's middle is 0.8 m from the wall; BACK is how far each model reaches behind its middle)
const BACK = { painting: 0.05, sconce: 0.06, wallshelf: 0.14, herbs: 0.14, potrack: 0.14, trophy: 0.06, antlers: 0.06, workbench: 0.36, forge: 0.72, loom: 0.27, bed: 1.13, kingbed: 1.26, shelf: 0.31, bookshelf: 0.32, counter: 0.42, keg: 0.33, stove: 0.37, hearth: 0.75, wardrobe: 0.34, dresser: 0.26, tapestry: 0.06, poisonchest: 0.34, desk: 0.36, vault: 0.41, weaponrack: 0.21, clothrack: 0.06, armorstand: 0.26, throne: 1.12, banner: 0.06 };
const wallOff = (f, kind) => (f.b ? Math.max(-0.4, 0.8 - (BACK[kind] != null ? BACK[kind] : 0.38) - 0.04) : 0);

// what lies on a table: a meal, a round of ale and dice, a map under a candle, or a cloth with bread and a fruit bowl
function tableTop(o, d) {
  const k = Math.floor(d.v * 4) % 4, y = 0.815;
  const plate = (x, z) => o.cyl('paint', x, y + 0.01, z, 0.13, 0.02, '#e8e0d0', 12);
  const mug = (x, z, c = '#8a5e34') => { o.cylB('planks', x, y, z, 0.06, 0.15, c, 8); o.box('planks', x + 0.07, y + 0.08, z, 0.03, 0.08, 0.02, c); };
  const candle = (x, z) => { o.cylB('metalv', x, y, z, 0.06, 0.02, '#8a7a5a', 8).cylB('paint', x, y + 0.02, z, 0.025, 0.14, '#f2ead0', 6); o.flame(x, y + 0.2, z, 0.05, 0.1); o.glow(x, y + 0.2, z, 0.5, [2.4, 1.6, 0.7], 0.35); };
  if (k === 0) { plate(-0.35, 0.12); plate(0.35, -0.12); o.sph('paint', -0.35, y + 0.05, 0.12, 0.16, 0.07, 0.12, '#c8803a').sph('paint', 0.35, y + 0.04, -0.12, 0.12, 0.06, 0.1, '#a8642a'); mug(0.05, 0.22); mug(-0.1, -0.24, '#c8c8c8'); o.box('metalv', 0.5, y + 0.01, 0.1, 0.02, 0.01, 0.18, '#c8c8c8'); }
  else if (k === 1) { mug(-0.4, 0.15); mug(-0.2, -0.2); mug(0.3, 0.2, '#7a5028'); mug(0.45, -0.15); for (let i = 0; i < 2; i++) o.box('paint', 0.05 + i * 0.08, y + 0.025, 0.02 + i * 0.05, 0.05, 0.05, 0.05, '#efe8d8', i * 0.6); candle(0, -0.28); }
  else if (k === 2) { o.box('paint', -0.05, y + 0.006, 0, 0.75, 0.01, 0.5, '#d8c89a', 0.12); for (const [x, z] of [[-0.3, 0.1], [0.15, -0.12], [0.25, 0.15]]) o.box('paint', x - 0.05, y + 0.012, z, 0.12, 0.004, 0.03, '#6a4a2a', x * 2);
    o.cylB('paint', 0.42, y, 0.22, 0.04, 0.06, '#2a2a2a', 8).box('paint', 0.42, y + 0.12, 0.2, 0.01, 0.18, 0.01, '#f4f0e8', 0, 0.4, 0); candle(-0.45, -0.25); o.box('paint', -0.42, y + 0.04, 0.24, 0.22, 0.07, 0.3, '#6a1e1e', 0.2); }
  else { o.box('cloth', 0, y + 0.004, 0, 1.25, 0.008, 0.7, '#e8e0cc'); for (const sx of [-1, 1]) o.box('cloth', sx * 0.62, y - 0.12, 0, 0.012, 0.24, 0.7, '#e8e0cc');
    o.g('paint', bowlG(), 0, y + 0.01, 0, 0.55, 0.3, 0.55, '#8a5e34'); for (const [x, z, c] of [[-0.05, 0.03, '#c83a2a'], [0.06, -0.02, '#e0a030'], [0.0, -0.07, '#7aa040'], [0.08, 0.06, '#c83a2a']]) o.sph('paint', x, y + 0.13, z, 0.09, 0.09, 0.09, c);
    o.sph('paint', -0.4, y + 0.05, 0.15, 0.28, 0.12, 0.16, '#c8904a'); o.g('paint', urnG(), 0.4, y, -0.15, 0.5, 0.5, 0.5, '#9a6a4a'); candle(0.42, 0.22); }
}
// the painting atlas: eight cells of 4 x 2 (mats.js 'painting'); a plane per cell, its uv mapped to that cell
const PAINT_G = [];
function paintCell(k) { if (PAINT_G[k]) return PAINT_G[k]; const g = new THREE.PlaneGeometry(1, 1); const uv = g.attributes.uv; const u0 = (k % 4) / 4, v0 = 1 - (Math.floor(k / 4) + 1) / 2;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) / 4, v0 + uv.getY(i) / 2); return (PAINT_G[k] = g); }
const WOOD = '#7a5530', DWOOD = '#4a3220', IRON = '#3a3a3e', GOLD = '#d8a838', STONE = '#9a948a', CLOTHR = '#8a2a2a';
const P = {};
P.lamp = (o, d) => { const tilt = d.broken ? 0.18 : 0; o.box('metalv', 0, 1.55, 0, 0.12, 3.1, 0.12, '#2a2622', 0, tilt, 0).box('metalv', 0, 0.06, 0, 0.42, 0.12, 0.42, '#2a2622').box('metalv', 0.32, 3.0, 0, 0.66, 0.07, 0.07, '#2a2622');
  o.box('metalv', 0.58, 2.72, 0, 0.36, 0.06, 0.36, '#2a2622').box('metalv', 0.58, 2.48, 0, 0.3, 0.42, 0.3, '#3a3430').cone('metalv', 0.58, 2.7, 0, 0.24, 0.22, '#2a2622', 8);
  if (!d.broken) { o.box('glow', 0.58, 2.47, 0, 0.24, 0.34, 0.24, '#ffd890'); o.glow(0.58, 2.47, 0, 1.2, [2.2, 1.5, 0.7], 0.45); } };
P.torch = (o, d) => { o.cyl('timber', 0, 0.85, 0, 0.05, 1.7, '#4a3220', 6).cyl('metalv', 0, 1.72, 0, 0.09, 0.18, IRON, 8).flame(0, 1.8, 0, 0.32, 0.62).glow(0, 1.95, 0, 0.9, [2.2, 1.2, 0.5], 0.35); };
P.campfire = (o, d) => { for (let k = 0; k < 9; k++) { const a = k / 9 * 6.283; o.rock('stone', Math.cos(a) * 0.62, 0.08, Math.sin(a) * 0.62, 0.32, 0.22, 0.28, '#6a6460', a); }
  o.cyl('bark', 0, 0.14, 0, 0.08, 1.1, '#5a3a20', 8, 0, Math.PI / 2 - 0.15).cyl('bark', 0, 0.14, 0, 0.08, 1.1, '#5a3a20', 8, Math.PI / 2 - 0.15, 0).box('glow', 0, 0.06, 0, 0.6, 0.06, 0.6, '#ff6a1a');
  o.flame(0, 0.12, 0, 0.75, 1.1).flame(0.15, 0.1, 0.1, 0.5, 0.8).flame(-0.14, 0.1, -0.08, 0.45, 0.7).glow(0, 0.5, 0, 2.6, [2.4, 1.1, 0.4], 0.4).smoke(0, 1.2, 0, 'camp'); };
P.tent = (o, d) => { const c = d.col || '#7a5a3a'; const L = 2.8, Wd = 2.3, H = 1.9; const a = Math.atan2(H, Wd / 2); const s = Math.hypot(H, Wd / 2);
  for (const sd of [-1, 1]) o.box('cloth2', sd * Wd / 4, H / 2, 0, 0.04, s, L, c, 0, 0, sd * (Math.PI / 2 - a));
  o.box('timber', 0, H, 0, 0.08, 0.08, L + 0.3, DWOOD).cyl('timber', 0, H / 2, L / 2 + 0.1, 0.04, H, DWOOD, 6).cyl('timber', 0, H / 2, -L / 2 - 0.1, 0.04, H, DWOOD, 6);
  o.box('dark', 0, 0.55, L / 2 - 0.02, 0.7, 1.1, 0.03, null); o.box('cloth2', 0, 0.02, 0, Wd - 0.2, 0.04, L - 0.2, K3.shade(c, -0.3)); };
P.crate = (o, d) => { const s = 0.85 + d.v * 0.2; o.boxB('planks', 0, 0, 0, s, s, s, '#9a7344', d.v * 2); for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) o.boxB('timber', x * s / 2, 0, z * s / 2, 0.08, s, 0.08, '#5a3e24'); o.box('timber', 0, s - 0.04, 0, s + 0.02, 0.08, s + 0.02, '#5a3e24'); if (d.v > 0.6) o.boxB('planks', 0.05, s, 0.02, s * 0.6, s * 0.6, s * 0.6, '#a07a4a', 0.4); };
P.barrel = (o, d) => { o.g('planks', barrelG(), 0, 0, 0, 1, 1.05, 1, '#8a5e34'); for (const y of [0.18, 0.72]) o.cyl('metalv', 0, y, 0, 0.415, 0.06, '#3a3a3a', 16); o.cyl('planks', 0, 0.94, 0, 0.36, 0.02, '#6a4a2a', 16); };
P.keg = (o, d) => { o.box('timber', 0, 0.25, 0.25, 0.9, 0.5, 0.08, DWOOD).box('timber', 0, 0.25, -0.25, 0.9, 0.5, 0.08, DWOOD); o.g('planks', barrelG(), -0.45, 0.62, 0, 0.8, 1.0, 0.8, '#8a5e34', 0, 0, -Math.PI / 2); o.cyl('metalv', 0.48, 0.62, 0, 0.04, 0.16, GOLD, 6, 0, Math.PI / 2); };
P.chest = (o, d) => { o.boxB('planks', 0, 0, 0, 1.0, 0.55, 0.62, '#7a5028').g('planks', PRIM.cyl12, 0, 0.55, 0, 1.0, 0.62, 0.62, '#7a5028', 0, 0, Math.PI / 2);
  for (const x of [-0.38, 0.38]) o.boxB('metalv', x, 0, 0, 0.07, 0.86, 0.66, '#c8a040'); o.box('metalv', 0, 0.5, 0.33, 0.14, 0.18, 0.04, GOLD); };
P.tomb = (o, d) => { const tilt = (d.v - 0.5) * 0.25; o.boxB('stone', 0, -0.3, 0, 0.78, 1.25, 0.2, '#8a8680', 0); o.g('stone', PRIM.cyl12, 0, 0.95, 0, 0.78, 0.2, 0.78, '#8a8680', 0, Math.PI / 2, 0);
  o.box('stone', 0, 0.62, 0.11, 0.08, 0.5, 0.02, '#6a6660').box('stone', 0, 0.72, 0.11, 0.34, 0.08, 0.02, '#6a6660'); o.g('paint', PRIM.sph12, 0, -0.05, -0.75, 0.9, 0.35, 1.5, '#4a4030'); };
P.crypt = (o, d) => { o.boxB('stone', 0, -0.3, 0, 3.0, 2.8, 3.0, '#6a6660'); o.boxB('stone', 0, -0.3, 0, 3.3, 0.5, 3.3, '#5a5650');
  const roof = new THREE.Shape([new THREE.Vector2(-1.8, 0), new THREE.Vector2(1.8, 0), new THREE.Vector2(0, 1.2)]); const rg = new THREE.ExtrudeGeometry(roof, { depth: 3.4, bevelEnabled: false }); rg.translate(0, 0, -1.7); o.g('stone', rg, 0, 2.5, 0, 1, 1, 1, '#4a4642'); rg.dispose();
  for (const x of [-1.05, 1.05]) o.cylB('stone', x, 0, 1.6, 0.22, 2.5, '#8a8680', 10); o.box('dark', 0, 0.85, 1.51, 1.0, 1.7, 0.05, null); o.glow(0, 1.2, 1.7, 1.6, [0.6, 2.0, 1.0], 0.3); };
P.fountain = (o, d) => { o.g('stone', basinG(), 0, 0, 0, 1, 1, 1, '#a8a296'); o.cyl('water', 0, 0.5, 0, 2.35, 0.03, null, 16);
  o.cylB('stone', 0, 0, 0, 0.32, 1.9, '#b8b2a6', 12).g('stone', bowlG(), 0, 1.6, 0, 2.1, 1.0, 2.1, '#b8b2a6').cylB('stone', 0, 2.2, 0, 0.12, 0.7, '#c8c2b6', 8).sph('stone', 0, 2.95, 0, 0.32, 0.32, 0.32, '#d8d2c6');
  o.out.emitters.push({ kind: 'fountain', p: o.w(0, 3.05, 0) }); };
P.monument = (o, d) => { o.boxB('marble', 0, -0.2, 0, 4.2, 0.5, 4.2, '#d8d0c0').boxB('marble', 0, 0.3, 0, 3.2, 0.5, 3.2, '#d0c8b8').boxB('marble', 0, 0.8, 0, 1.5, 6.4, 1.5, '#e0d8c8', 0);
  o.cone('gold', 0, 7.2, 0, 1.06, 1.4, GOLD, 4).sph('glow', 0, 5.6, 0.78, 0.4, 0.4, 0.1, '#ffe08a').glow(0, 5.6, 0.9, 2.2, [2.6, 2.0, 0.9], 0.55); };
P.stall = (o, d) => { const c = d.col || '#b84a3a'; for (const [x, z] of [[-1.3, 0.6], [1.3, 0.6], [-1.3, -0.7], [1.3, -0.7]]) o.cylB('timber', x, 0, z, 0.06, 2.4, DWOOD, 6);
  o.boxB('planks', 0, 0, 0.45, 2.7, 0.95, 0.7, '#7a5530'); o.box('planks', 0, 0.98, 0.45, 2.85, 0.07, 0.8, '#8a6440');
  for (let k = 0; k < 8; k++) o.box('cloth2', -1.4 + k * 0.4 + 0.2, 2.35, 0, 0.4, 0.04, 1.85, k % 2 ? c : '#f2ead8', 0, 0.22, 0);
  const goods = ['#e0a040', '#6aa840', '#c83a3a', '#e8d070', '#8a4a8a', '#d86a2a']; for (let k = 0; k < 10; k++) o.sph('paint', -1.1 + (k % 5) * 0.55, 1.08, 0.3 + Math.floor(k / 5) * 0.28, 0.2, 0.18, 0.2, goods[(k + Math.floor(d.v * 6)) % 6]);
  o.boxB('planks', -0.7, 1.02, 0.55, 0.4, 0.18, 0.3, '#a07040').boxB('planks', 0.8, 1.02, 0.4, 0.36, 0.25, 0.36, '#c8a060'); };
P.statue = (o, d) => { o.boxB('stone', 0, -0.2, 0, 1.3, 0.9, 1.3, '#9a948a').boxB('marble', 0, 0.7, 0, 1.0, 0.2, 1.0, '#c8c0b0');
  const M = 'marble', c = '#d8d2c6'; o.cyl(M, -0.14, 1.45, 0, 0.12, 1.1, c, 8).cyl(M, 0.14, 1.45, 0, 0.12, 1.1, c, 8).g(M, PRIM.cyl12, 0, 2.35, 0, 0.62, 0.95, 0.4, c).sph(M, 0, 3.02, 0, 0.36, 0.42, 0.38, c)
    .cyl(M, -0.4, 2.45, 0, 0.09, 0.8, c, 8, 0, 0.25).cyl(M, 0.42, 2.85, 0.05, 0.09, 0.8, c, 8, 0, -2.6).box(M, 0.62, 3.55, 0.05, 0.07, 1.4, 0.04, c).box(M, 0.6, 2.95, 0.05, 0.36, 0.06, 0.06, c).g(M, PRIM.cone12, 0, 1.75, -0.12, 0.9, 1.6, 0.4, c); };
P.tower = (o, d) => { o.boxB('stone', 0, -0.3, 0, 2.6, 6.5, 2.6, '#6d665e'); for (let k = 0; k < 4; k++) o.boxB('stone', -0.95 + k * 0.63, 6.2, 1.15, 0.4, 0.6, 0.3, '#5a544c'); };
P.scarecrowpost = (o, d) => { o.cylB('timber', 0, 0, 0, 0.05, 2.1, DWOOD, 6).box('timber', 0, 1.65, 0, 1.6, 0.07, 0.07, DWOOD).g('cloth2', PRIM.cyl8, 0, 1.4, 0, 0.55, 0.8, 0.35, '#8a6a3a').sph('cloth2', 0, 2.05, 0, 0.34, 0.36, 0.34, '#d8b878').cone('cloth2', 0, 2.15, 0, 0.42, 0.42, '#4a3a2a', 8); };
P.throne = (o, d) => { o.boxB('stone', 0, 0, 0.1, 2.6, 0.3, 2.4, '#8a2a2a').boxB('stone', 0, 0.3, -0.1, 2.0, 0.25, 1.8, '#9a3a3a');
  o.boxB('gold', 0, 0.55, -0.15, 1.2, 0.5, 1.0, GOLD).boxB('cloth', 0, 1.05, -0.1, 1.0, 0.14, 0.86, '#a01e1e').boxB('gold', 0, 0.55, -0.6, 1.2, 2.6, 0.18, GOLD).boxB('cloth', 0, 1.15, -0.5, 0.9, 1.8, 0.04, '#a01e1e');
  for (const x of [-0.6, 0.6]) o.boxB('gold', x, 1.05, -0.1, 0.12, 0.45, 0.9, GOLD); o.sph('gold', 0, 3.25, -0.6, 0.3, 0.3, 0.15, GOLD).sph('glow', 0, 3.25, -0.5, 0.12, 0.12, 0.06, '#ff4a3a'); };
P.carpet = (o, d) => { const L = (d.len || 4) * Tl; o.box('cloth', 0, 0.015, L / 2 - 0.3, 1.75, 0.03, L, '#7a1a1a'); for (const x of [-0.78, 0.78]) o.box('cloth', x, 0.032, L / 2 - 0.3, 0.1, 0.01, L - 0.1, '#d8a838'); };
P.pillar = (o, d, ctx) => { const h = ctx.ceil ? ctx.ceil - o.y : 3.9; o.g('marble', columnG(), 0, 0, 0, 1, h / 3.95, 1, '#cfc7b6'); };
P.brazier = (o, d) => { for (let k = 0; k < 3; k++) { const a = k / 3 * 6.283; o.cyl('metalv', Math.cos(a) * 0.22, 0.45, Math.sin(a) * 0.22, 0.03, 0.95, IRON, 6, Math.sin(a) * 0.25, -Math.cos(a) * 0.25); }
  o.g('metalv', bowlG(), 0, 0.55, 0, 1.1, 0.6, 1.1, '#4a4440').box('glow', 0, 0.86, 0, 0.5, 0.06, 0.5, '#ff7a2a').flame(0, 0.86, 0, 0.6, 0.9).flame(0.1, 0.86, 0.06, 0.4, 0.65).glow(0, 1.2, 0, 2.2, [2.4, 1.1, 0.4], 0.4); };
P.banner = (o, d, ctx) => { const p = o.w(0, 0, -0.55); ctx.flags.push({ kind: 'hang', x: p.x, y: (ctx.ceil || o.y + 3.2) - 0.2, z: p.z, w: 1.0, h: 2.4, f: ctx.faction || 'crown', rot: o.ry }); };
P.counter = (o, d) => { o.boxB('timber', 0, 0, 0, 1.62, 1.0, 0.7, '#5a3a20').box('planks', 0, 1.04, 0, 1.66, 0.08, 0.82, '#8a6440'); if (d.v > 0.5) o.cylB('metalv', -0.3, 1.08, 0.1, 0.07, 0.18, '#a8a8a8', 8); if (d.v < 0.4) o.cylB('planks', 0.35, 1.08, -0.05, 0.08, 0.2, '#8a5e34', 8); };
P.table = (o, d) => { o.box('planks', 0, 0.78, 0, 1.4, 0.07, 0.85, '#7a5530'); for (const [x, z] of [[0.6, 0.34], [-0.6, 0.34], [0.6, -0.34], [-0.6, -0.34]]) o.boxB('timber', x, 0, z, 0.08, 0.76, 0.08, DWOOD);
  tableTop(o, d);
  for (const x of [-0.95, 0.95]) { o.cylB('planks', x, 0, 0, 0.2, 0.46, '#6a4a2a', 10); } };
P.stove = (o, d) => { o.boxB('metalv', 0, 0, 0, 0.9, 0.85, 0.7, '#2a2624').box('glow', 0, 0.35, 0.36, 0.42, 0.2, 0.02, '#ff7a2a').cylB('metalv', -0.2, 0.85, -0.1, 0.09, 2.4, '#2a2624', 8).cylB('metalv', 0.2, 0.86, 0.05, 0.2, 0.18, '#5a524a', 10).glow(0, 0.4, 0.45, 0.8, [2.2, 1.0, 0.4], 0.35); };
P.hearth = (o, d, ctx) => { const top = ctx.ceil ? ctx.ceil - o.y : 3.2; o.boxB('stone', 0, 0, -0.25, 1.7, 1.45, 0.75, '#7a6a5a').boxB('stone', 0, 1.45, -0.32, 1.85, 0.16, 0.85, '#8a7a6a').boxB('stone', 0, 1.6, -0.4, 1.2, top - 1.6, 0.6, '#7a6a5a');
  o.boxB('dark', 0, 0.05, 0.12, 0.95, 0.95, 0.06, null).box('glow', 0, 0.08, 0.05, 0.8, 0.05, 0.4, '#ff6a1a').flame(0, 0.1, 0.05, 0.6, 0.75).flame(0.18, 0.1, 0.0, 0.4, 0.55).glow(0, 0.4, 0.3, 1.6, [2.4, 1.1, 0.4], 0.4);
  o.cyl('bark', 0, 0.12, 0.05, 0.07, 0.7, '#4a2a18', 6, 0, Math.PI / 2); };
P.vault = (o, d) => { o.boxB('metalv', 0, 0, -0.2, 1.3, 1.6, 0.4, '#5a5a62').cyl('metalv', 0, 0.85, 0.02, 0.4, 0.06, '#8a8a94', 16, Math.PI / 2).box('metalv', 0, 0.85, 0.06, 0.6, 0.06, 0.04, '#c8a040').box('metalv', 0, 0.85, 0.06, 0.06, 0.6, 0.04, '#c8a040'); };
P.forge = (o, d, ctx) => { const top = ctx.ceil ? ctx.ceil - o.y : 3.4; o.boxB('stone', 0, 0, -0.1, 1.5, 0.95, 1.2, '#5a524a').box('glow', 0, 0.97, 0, 1.1, 0.05, 0.8, '#ff6a1a').flame(0, 0.97, 0, 0.7, 0.6, [3.5, 1.2, 0.3]).flame(0.3, 0.97, 0.1, 0.4, 0.45, [3.5, 1.2, 0.3]).glow(0, 1.2, 0, 2.4, [2.6, 0.9, 0.25], 0.45);
  o.g('stone', PRIM.cone8, 0, 2.0, -0.1, 1.7, 1.2, 1.4, '#4a423a').boxB('stone', 0, 2.5, -0.15, 0.6, top - 2.5, 0.6, '#4a423a').box('leather', 0.95, 0.6, 0.2, 0.5, 0.3, 0.6, '#6a4a2a', 0.3); o.smoke(0, 1.6, 0, 'forge'); };
P.anvil = (o, d) => { o.cylB('bark', 0, 0, 0, 0.3, 0.55, '#5a3a20', 10).boxB('metalv', 0, 0.55, 0, 0.28, 0.18, 0.22, '#2e2e34').boxB('metalv', 0, 0.73, 0, 0.62, 0.16, 0.26, '#3a3a40').g('metalv', PRIM.cone8, 0.42, 0.81, 0, 0.16, 0.3, 0.16, '#3a3a40', 0, 0, -Math.PI / 2).cylB('metalv', -0.1, 0.9, 0.05, 0.04, 0.45, '#6a4a2a', 6); };
P.orepile = (o, d) => { const cols = ['#7a6a5a', '#9a5a3a', '#6a6a7a', '#c8a050']; for (let k = 0; k < 9; k++) o.rock('stone', (Math.cos(k * 2.2) * 0.4) * (k / 9), 0.12 + (k % 3) * 0.08, Math.sin(k * 2.2) * 0.3 * (k / 9), 0.36, 0.3, 0.34, cols[k % 4], k); };
P.weaponrack = (o, d) => { o.boxB('timber', 0, 0, 0, 1.4, 0.08, 0.4, DWOOD).boxB('timber', -0.62, 0, -0.15, 0.08, 1.5, 0.08, DWOOD).boxB('timber', 0.62, 0, -0.15, 0.08, 1.5, 0.08, DWOOD).box('timber', 0, 1.3, -0.15, 1.32, 0.08, 0.08, DWOOD);
  for (let k = -1; k <= 1; k++) { o.box('metalv', k * 0.38, 0.85, -0.05, 0.07, 1.3, 0.025, '#c8ccd2', 0, 0.12).box('metalv', k * 0.38, 0.32, -0.04, 0.25, 0.04, 0.05, GOLD, 0, 0.12); } };
P.armorstand = (o, d) => { o.cylB('timber', 0, 0, 0, 0.04, 1.55, DWOOD, 6).boxB('timber', 0, 0, 0, 0.5, 0.06, 0.5, DWOOD).g('metal', PRIM.cyl12, 0, 1.25, 0, 0.62, 0.7, 0.4, '#b4b8c0').sph('metal', 0, 1.7, 0, 0.3, 0.32, 0.3, '#a8acb4').sph('metal', -0.34, 1.5, 0, 0.22, 0.18, 0.22, '#a8acb4').sph('metal', 0.34, 1.5, 0, 0.22, 0.18, 0.22, '#a8acb4'); };
// the carpenter's bench: a thick top on stout legs, a wooden vice at one end, planks on the shelf below and a saw hung on the back
P.workbench = (o, d) => { o.box('planks', 0, 0.86, 0, 1.5, 0.1, 0.68, '#9a7448'); for (const [x, z] of [[0.66, 0.26], [-0.66, 0.26], [0.66, -0.26], [-0.66, -0.26]]) o.boxB('timber', x, 0, z, 0.1, 0.82, 0.1, DWOOD);
  o.box('timber', 0, 0.2, 0, 1.36, 0.05, 0.56, DWOOD).box('planks', -0.1, 0.27, 0.02, 1.1, 0.06, 0.2, '#b08a58').box('planks', 0.05, 0.33, -0.1, 1.0, 0.06, 0.18, '#a07a4a');
  o.box('timber', 0.62, 0.78, 0.36, 0.22, 0.22, 0.08, '#6a4a2a').cyl('metalv', 0.62, 0.74, 0.46, 0.025, 0.2, IRON, 6, Math.PI / 2).box('timber', 0.62, 0.74, 0.58, 0.04, 0.04, 0.22, DWOOD, Math.PI / 2);
  o.box('metalv', -0.25, 1.15, -0.33, 0.62, 0.16, 0.01, '#b8bcc4').box('timber', 0.1, 1.16, -0.32, 0.14, 0.12, 0.03, '#6a4a2a');
  o.box('planks', -0.3, 0.92, 0.05, 0.5, 0.03, 0.14, '#c8a070').box('metalv', 0.2, 0.93, 0.1, 0.12, 0.04, 0.04, '#3a3a3e'); };
P.sawhorse = (o, d) => { o.box('timber', 0, 0.72, 0, 1.1, 0.1, 0.12, '#8a6440'); for (const x of [-0.42, 0.42]) for (const z of [-1, 1]) o.box('timber', x, 0.36, z * 0.12, 0.07, 0.78, 0.07, DWOOD, 0, z * 0.3, 0);
  o.box('planks', 0.1, 0.8, 0, 0.9, 0.05, 0.24, '#c8a070', 0.15); };
P.loom = (o, d) => { for (const x of [-0.62, 0.62]) o.boxB('timber', x, 0, 0, 0.08, 1.6, 0.5, WOOD); o.box('timber', 0, 1.55, 0, 1.3, 0.08, 0.08, WOOD).box('timber', 0, 0.55, 0.15, 1.3, 0.08, 0.08, WOOD).box('cloth', 0, 1.05, 0, 1.15, 0.85, 0.02, '#b84a6a'); };
P.clothrack = (o, d) => { o.cylB('timber', -0.62, 0, 0, 0.04, 1.7, DWOOD, 6).cylB('timber', 0.62, 0, 0, 0.04, 1.7, DWOOD, 6).cyl('timber', 0, 1.65, 0, 0.03, 1.3, DWOOD, 6, 0, Math.PI / 2);
  ['#3a6ab8', '#c8a03a', '#6a3a8a', '#3a8a5a'].forEach((c, k) => o.box('cloth', -0.45 + k * 0.3, 1.1, 0, 0.26, 1.0, 0.08, c)); };
P.bookshelf = (o, d) => { o.boxB('planks', 0, 0, -0.1, 1.45, 2.1, 0.42, '#5a3e24'); const R = K3.rng(Math.floor(d.v * 1e6));
  for (let r = 0; r < 4; r++) { o.box('planks', 0, 0.12 + r * 0.5, 0.1, 1.35, 0.04, 0.38, '#4a3220'); let x = -0.62; while (x < 0.6) { const w = 0.05 + R() * 0.06, h = 0.28 + R() * 0.14; o.boxB('leather', x + w / 2, 0.14 + r * 0.5, 0.12, w, h, 0.26, ['#8a2a2a', '#2a4a8a', '#3a6a2a', '#8a6a2a', '#5a2a5a'][Math.floor(R() * 5)], (R() - 0.5) * 0.1); x += w + 0.01; } } };
P.lectern = (o, d) => { o.cylB('timber', 0, 0, 0, 0.06, 1.05, WOOD, 8).boxB('timber', 0, 0, 0, 0.45, 0.06, 0.45, WOOD).box('timber', 0, 1.12, 0, 0.6, 0.06, 0.45, WOOD, 0, 0.35).box('paint', 0, 1.17, 0.01, 0.52, 0.03, 0.36, '#efe3c8', 0, 0.35); };
P.dummy = (o, d) => { o.cylB('timber', 0, 0, 0, 0.05, 1.8, DWOOD, 6).g('cloth2', PRIM.cyl12, 0, 1.25, 0, 0.5, 0.75, 0.42, '#c8a870').sph('cloth2', 0, 1.82, 0, 0.32, 0.34, 0.32, '#c8a870').box('timber', 0, 1.45, 0, 1.0, 0.06, 0.06, DWOOD).cyl('paint', 0, 1.32, 0.215, 0.12, 0.01, '#8a2a2a', 12, Math.PI / 2); };
P.shelf = (o, d) => { o.boxB('planks', 0, 0, -0.1, 1.45, 1.85, 0.4, '#6a4a2a'); for (let r = 0; r < 3; r++) { o.box('planks', 0, 0.3 + r * 0.55, 0.08, 1.35, 0.04, 0.34, '#5a3a20'); for (let k = 0; k < 4; k++) { const c = ['#c84a3a', '#e0c060', '#6a9ac8', '#9a6ac8'][(k + r) % 4]; if ((k + r) % 3) o.g('gloss', urnG(), -0.48 + k * 0.32, 0.32 + r * 0.55, 0.08, 0.6, 0.5, 0.6, c); else o.boxB('cloth', -0.48 + k * 0.32, 0.32 + r * 0.55, 0.08, 0.22, 0.25, 0.2, '#b89a6a'); } } };
P.bed = (o, d) => { o.boxB('timber', 0, 0, -0.1, 1.05, 0.38, 2.0, '#6a4a2a').boxB('timber', 0, 0, -1.08, 1.1, 0.95, 0.08, '#5a3a20').boxB('cloth', 0, 0.38, -0.1, 0.95, 0.14, 1.9, '#e8e0d0').boxB('cloth', 0, 0.45, 0.25, 0.98, 0.12, 1.2, '#4a5aa8').boxB('cloth', 0, 0.52, -0.82, 0.7, 0.12, 0.32, '#f4f0e8'); };
P.post = (o, d) => { o.cylB('bark', 0, -1.5, 0, 0.13, 2.6, '#5a3a20', 8).cyl('timber', 0, 1.12, 0, 0.15, 0.1, '#7a5a30', 8); };
P.totem = (o, d) => { o.cylB('bark', 0, 0, 0, 0.12, 2.2, '#5a3e24', 8).sph('paint', 0, 2.3, 0, 0.42, 0.48, 0.4, d.col || '#8a3a2a').sph('glow', -0.1, 2.35, 0.17, 0.07, 0.07, 0.05, '#ffeb6a').sph('glow', 0.1, 2.35, 0.17, 0.07, 0.07, 0.05, '#ffeb6a');
  o.g('marble', PRIM.cone8, -0.3, 2.65, 0, 0.12, 0.5, 0.12, '#e8dcc0', 0, 0, 0.7).g('marble', PRIM.cone8, 0.3, 2.65, 0, 0.12, 0.5, 0.12, '#e8dcc0', 0, 0, -0.7); };
P.bones = (o, d) => { const r = d.v * 6.283; o.cyl('marble', 0, 0.04, 0, 0.03, 0.5, '#ddd5c0', 6, Math.PI / 2, r).cyl('marble', 0.12, 0.04, 0.1, 0.025, 0.35, '#ddd5c0', 6, Math.PI / 2, r + 1.2); if (d.v > 0.5) o.sph('marble', -0.18, 0.1, 0.05, 0.2, 0.18, 0.22, '#e6dfcc').sph('dark', -0.22, 0.12, 0.15, 0.05, 0.05, 0.03, null).sph('dark', -0.14, 0.12, 0.15, 0.05, 0.05, 0.03, null); };
P.pebbles = (o, d) => { for (let k = 0; k < 4; k++) o.rock('stone', Math.cos(k * 2.1 + d.v * 6) * 0.25, 0.03, Math.sin(k * 1.7 + d.v * 6) * 0.2, 0.14, 0.08, 0.12, '#8a847a', k); };
P.snowtuft = (o, d) => { o.sph('paint', 0, 0, 0, 0.5, 0.2, 0.4, '#f4f8fa').sph('paint', 0.18, 0, 0.1, 0.3, 0.14, 0.3, '#e4ecf0'); };
P.ember = (o, d) => { o.glow(0, 0.1, 0, 0.35, [3.5, 1.3, 0.3], 0.8); };
P.mushroom = (o, d) => { for (let k = 0; k < (d.v > 0.5 ? 3 : 1); k++) { const x = k * 0.12 - 0.1, z = (k % 2) * 0.1; o.cylB('paint', x, 0, z, 0.025, 0.14, '#e8dcc8', 6).g('gloss', PRIM.sph8, x, 0.15, z, 0.16, 0.1, 0.16, d.v < 0.5 ? '#c8402a' : '#b08a5a'); } };
P.stalagmite = (o, d) => { const ice = W.tile(d.tx, d.ty) === T.ICE || geo.dgnId === 'frostfang'; const c = ice ? '#cfe6f2' : '#7a6a5a';
  o.g('stone', PRIM.cone8, 0, 0.9 + d.v * 0.4, 0, 0.7, 1.8 + d.v * 0.8, 0.7, c, d.v * 3).g('stone', PRIM.cone8, 0.35, 0.5, 0.15, 0.4, 1.0, 0.4, c);
  if (geo.dungeon && geo.ceilAt) { const cy = geo.ceilAt(o.x, o.z) - o.y; o.g('stone', PRIM.cone8, 0.1, cy - 0.6, 0.1, 0.5, -1.3, 0.5, c); } };
P.icecrystal = (o, d) => { const c = '#a8dcff'; o.g('glass', PRIM.cone8, 0, 0.7, 0, 0.4, 1.6, 0.4, c, 0, 0.1).g('glass', PRIM.cone8, 0.25, 0.55, 0.05, 0.28, 1.2, 0.28, c, 1, -0.3, 0.2).g('glass', PRIM.cone8, -0.22, 0.45, -0.1, 0.24, 0.9, 0.24, c, 2, 0.2, -0.3).glow(0, 0.7, 0, 1.6, [0.9, 1.7, 2.6], 0.35); };
P.crystal = (o, d) => { const c = '#b89aff'; o.g('glow', PRIM.cone8, 0, 0.6, 0, 0.3, 1.3, 0.3, '#9a6aff', 0, 0.1).g('glow', PRIM.cone8, 0.22, 0.45, 0.05, 0.22, 0.95, 0.22, '#c09aff', 1, -0.3, 0.25).g('glow', PRIM.cone8, -0.2, 0.4, -0.08, 0.2, 0.8, 0.2, '#8a5aff', 2, 0.25, -0.3).glow(0, 0.7, 0, 1.8, [1.4, 0.8, 2.8], 0.45); };
P.sarcophagus = (o, d) => { o.boxB('stone', 0, 0, 0, 1.0, 0.8, 2.1, '#8a8070').boxB('stone', 0, 0.8, 0, 1.08, 0.2, 2.18, '#a49a88').g('stone', PRIM.sph12, 0, 1.0, 0.1, 0.5, 0.18, 1.5, '#9a9080').box('stone', 0, 1.06, -0.2, 0.12, 0.04, 0.6, '#6a6050'); };
P.cavesign = (o, d, ctx) => { o.cylB('timber', 0, 0, 0, 0.06, 2.1, '#5a3e24', 6); ctx.signs.push({ x: o.x, y: o.y + 1.75, z: o.z, ry: o.ry, name: d.name || '', icon: geo.dungeon ? '🚪' : '⛏', board: true }); };
P.well = (o, d) => { o.g('stone', lathe('well', [[0.85, 0], [1.05, 0], [1.05, 0.85], [0.85, 0.85], [0.85, 0]], 20), 0, 0, 0, 1, 1, 1, '#8a8478').cyl('water', 0, 0.3, 0, 0.84, 0.02, null, 16);
  for (const x of [-0.95, 0.95]) o.cylB('timber', x, 0.6, 0, 0.07, 1.6, '#6a4a2a', 6); o.cyl('timber', 0, 2.0, 0, 0.06, 2.0, '#6a4a2a', 6, 0, Math.PI / 2);
  for (const sd of [-1, 1]) o.box('rooftile', 0, 2.45, sd * 0.45, 2.3, 0.06, 1.1, '#8a3a2a', 0, sd * 0.55, 0); o.cylB('planks', 0.1, 1.2, 0, 0.14, 0.25, '#7a5a3a', 8).box('paint', 0.1, 1.7, 0, 0.01, 0.5, 0.01, '#c8b48a'); };
P.cavemouth = (o, d) => { // an arch of boulders around a black opening; it opens toward -z here
  const c = W.realm === 'tidesong' ? '#7a7066' : '#6a6058';
  for (let k = 0; k <= 9; k++) { const a = Math.PI * k / 9; o.rock('stone', Math.cos(a) * 2.2, Math.sin(a) * 2.6, 0.3, 1.3 + (k % 3) * 0.3, 1.2, 1.6, c, k); }
  o.rock('stone', 0, 3.4, 0.8, 4.2, 1.6, 2.4, K3.shade(c, -0.1)); o.box('dark', 0, 1.2, 0.9, 3.2, 2.8, 0.1, null).box('dark', 0, 0.02, 1.6, 3.0, 0.04, 3.0, null); };
P.exitportal = (o, d, ctx) => { o.out.emitters.push({ kind: 'portal', p: o.w(0, 1.3, 0) }); o.glow(0, 1.3, 0, 3.4, [2.6, 2.2, 1.4], 0.55).glow(0, 1.3, 0, 1.6, [3, 3, 2.4], 0.6); o.g('stone', PRIM.torus, 0, 1.3, 0, 3.2, 3.8, 1.2, '#8a8070'); };
P.sewermouth = outflowPipe; // the brick outflow pipe under a city wall (sewer3d.js)
P.sewerexit = sewerExit; // ...and its daylight, seen from inside the sewer
P.drainpipe = (o, d) => { o.cyl('metalv', 0, 1.4, -0.2, 0.28, 0.7, '#5a5a58', 12, Math.PI / 2).cyl('dark', 0, 1.4, 0.16, 0.2, 0.02, null, 12, Math.PI / 2); o.out.emitters.push({ kind: 'drip', p: o.w(0, 1.3, 0.2) }); };
P.flagpole = (o, d, ctx) => { o.cylB('metalv', 0, 0, 0, 0.09, 11, '#d8d0c0', 8).cylB('stone', 0, 0, 0, 0.35, 0.5, '#8a8478', 8).sph('gold', 0, 11.1, 0, 0.26, 0.26, 0.26, '#e0c050'); ctx.flags.push({ kind: 'pole', x: o.x, y: o.y + 10.6, z: o.z, w: 3.4, h: 2.1, f: d.f }); };
// ---------- homes of the 1300s: seats, rugs, chests and cupboards, stoves, candles, a king's bedchamber ----------
const RUGS = [['#7a1e1e', '#d8b060', '#2a3a6a'], ['#2a4a7a', '#e0c070', '#7a2a2a'], ['#3a5a2a', '#d8c890', '#6a3a1a'], ['#6a3a6a', '#e0b860', '#2a2a4a']];
P.rug = (o, d) => { const [a, b, c] = RUGS[Math.floor(d.v * 4) % 4]; const w = 2.2, l = 1.5;
  o.box('cloth2', 0, 0.015, 0, w, 0.02, l, a).box('cloth2', 0, 0.025, 0, w - 0.25, 0.02, l - 0.25, b).box('cloth2', 0, 0.035, 0, w - 0.45, 0.02, l - 0.45, a);
  for (let k = -2; k <= 2; k++) o.box('cloth2', k * 0.32, 0.045, 0, 0.12, 0.02, 0.12, c).box('cloth2', 0, 0.045, k * 0.2, 0.12, 0.02, 0.06, c);
  for (const sd of [-1, 1]) for (let k = 0; k < 9; k++) o.box('cloth2', (k - 4) * 0.24, 0.012, sd * (l / 2 + 0.05), 0.03, 0.01, 0.1, '#e8dcc0'); };
P.stool = (o, d) => { o.cylB('planks', 0, 0.42, 0, 0.2, 0.06, '#8a6440', 10); for (let k = 0; k < 3; k++) { const a = k * 2.09 + d.v; o.cyl('timber', Math.cos(a) * 0.12, 0.21, Math.sin(a) * 0.12, 0.025, 0.44, '#5a3e24', 6, Math.sin(a) * 0.15, -Math.cos(a) * 0.15); } };
P.bench = (o, d) => { o.box('planks', 0, 0.44, 0, 1.6, 0.06, 0.32, '#8a6440'); for (const x of [-0.65, 0.65]) o.boxB('planks', x, 0, 0, 0.06, 0.42, 0.28, '#6a4a2a'); o.box('timber', 0, 0.2, 0, 1.3, 0.05, 0.05, '#5a3e24'); };
P.chair = (o, d) => { o.box('planks', 0, 0.46, 0, 0.46, 0.05, 0.44, '#7a5530'); for (const [x, z] of [[0.2, 0.18], [-0.2, 0.18], [0.2, -0.18], [-0.2, -0.18]]) o.boxB('timber', x, 0, z, 0.05, 0.45, 0.05, '#5a3e24');
  for (const x of [-0.2, 0.2]) o.boxB('timber', x, 0.46, -0.2, 0.05, 0.6, 0.05, '#5a3e24'); o.box('planks', 0, 0.82, -0.2, 0.42, 0.18, 0.03, '#7a5530'); o.box('planks', 0, 0.62, -0.2, 0.42, 0.06, 0.03, '#7a5530'); };
P.wardrobe = (o, d) => { o.boxB('planks', 0, 0, 0, 1.2, 2.0, 0.6, '#6a4424').box('timber', 0, 2.03, 0, 1.3, 0.08, 0.66, '#4a2e18');
  for (const x of [-0.29, 0.29]) o.box('planks', x, 1.05, 0.31, 0.54, 1.7, 0.03, '#7a5530').box('metalv', x * 0.2, 1.05, 0.34, 0.04, 0.16, 0.03, '#c8a040');
  o.boxB('timber', 0, 0, 0.3, 1.2, 0.12, 0.04, '#4a2e18'); };
P.dresser = (o, d) => { o.boxB('planks', 0, 0, 0, 1.1, 0.95, 0.5, '#7a5028'); for (let k = 0; k < 3; k++) o.box('planks', 0, 0.18 + k * 0.28, 0.26, 1.0, 0.24, 0.02, '#8a6038').box('metalv', 0, 0.18 + k * 0.28, 0.28, 0.12, 0.03, 0.02, '#c8a040');
  o.cylB('paint', 0.3, 0.95, 0, 0.09, 0.26, '#c8b8a0', 10).cylB('paint', 0.3, 0.95, 0, 0.17, 0.06, '#d8d0c0', 12).cylB('metalv', -0.32, 0.95, 0, 0.04, 0.22, '#c8a040', 8).flame(-0.32, 1.24, 0, 0.06, 0.12).glow(-0.32, 1.25, 0, 0.5, [2.4, 1.6, 0.7], 0.3); };
P.tapestry = (o, d) => { const [a, b, c] = RUGS[Math.floor(d.v * 4 + 1) % 4]; o.box('timber', 0, 2.75, 0, 1.7, 0.06, 0.06, '#4a2e18').box('cloth2', 0, 1.9, 0.02, 1.5, 1.7, 0.03, a).box('cloth2', 0, 1.9, 0.04, 1.3, 1.5, 0.02, b);
  o.box('cloth2', 0, 2.05, 0.055, 0.3, 0.6, 0.01, c).box('cloth2', 0, 2.05, 0.06, 0.7, 0.14, 0.01, c).box('cloth2', 0, 1.35, 0.055, 0.9, 0.08, 0.01, c); };
P.candle = (o, d) => { o.cylB('metalv', 0, 0, 0, 0.16, 0.05, '#3a3a3e', 8).cylB('metalv', 0, 0, 0, 0.03, 1.25, '#3a3a3e', 6).cylB('metalv', 0, 1.25, 0, 0.12, 0.04, '#3a3a3e', 8);
  for (const [x, z] of [[0, 0], [0.08, 0.04], [-0.07, 0.05]]) o.cylB('paint', x, 1.29, z, 0.022, 0.16 - x, '#efe6cc', 6).flame(x, 1.47 - x, z, 0.05, 0.1); o.glow(0, 1.5, 0, 1.2, [2.4, 1.6, 0.7], 0.35); };
P.cauldron = (o, d) => { for (let k = 0; k < 3; k++) { const a = k * 2.09; o.cyl('metalv', Math.cos(a) * 0.45, 0.6, Math.sin(a) * 0.45, 0.025, 1.3, '#2a2a2e', 6, Math.sin(a) * 0.35, -Math.cos(a) * 0.35); }
  o.sph('metalv', 0, 0.55, 0, 0.7, 0.55, 0.7, '#2a2a2e').cyl('paint', 0, 0.78, 0, 0.3, 0.02, '#6a8a3a', 12).box('glow', 0, 0.05, 0, 0.4, 0.04, 0.4, '#ff6a1a').flame(0, 0.08, 0, 0.35, 0.5).smoke(0, 1.0, 0, 'camp'); };
P.washtub = (o, d) => { o.cylB('planks', 0, 0, 0, 0.42, 0.42, '#8a6440', 14).cyl('metalv', 0, 0.12, 0, 0.43, 0.04, '#3a3a3a', 14).cyl('metalv', 0, 0.34, 0, 0.43, 0.04, '#3a3a3a', 14).cyl('water', 0, 0.36, 0, 0.38, 0.01, '#6a8aa0', 14); };
P.desk = (o, d) => { o.box('planks', 0, 0.76, 0, 1.3, 0.06, 0.7, '#6a4424'); for (const x of [-0.58, 0.58]) o.boxB('planks', x, 0, 0, 0.08, 0.74, 0.62, '#5a3a20');
  o.box('paint', -0.2, 0.8, 0.05, 0.42, 0.01, 0.3, '#efe6cc').box('paint', -0.15, 0.81, 0.02, 0.3, 0.01, 0.22, '#e8dcc0').cyl('dark', 0.3, 0.83, -0.1, 0.05, 0.08, '#1a1a1e', 8).cyl('paint', 0.33, 0.93, -0.12, 0.006, 0.25, '#f4f0e8', 4, 0.3, 0.2)
  .cylB('metalv', 0.5, 0.79, 0.2, 0.03, 0.04, '#c8a040', 8).cylB('paint', 0.5, 0.83, 0.2, 0.02, 0.12, '#efe6cc', 6).flame(0.5, 0.98, 0.2, 0.05, 0.1).glow(0.5, 1.0, 0.2, 0.8, [2.4, 1.6, 0.7], 0.3); };
P.kingbed = (o, d) => { o.boxB('timber', 0, 0, -0.1, 1.7, 0.5, 2.3, '#4a2e18').boxB('cloth', 0, 0.5, -0.1, 1.6, 0.18, 2.2, '#efe6d6').boxB('cloth', 0, 0.62, 0.35, 1.64, 0.14, 1.3, '#6a1a2a').boxB('cloth', 0, 0.68, -0.95, 1.2, 0.16, 0.4, '#f4f0e8');
  for (const [x, z] of [[0.8, 1.0], [-0.8, 1.0], [0.8, -1.2], [-0.8, -1.2]]) o.cylB('timber', x, 0, z, 0.06, 2.5, '#4a2e18', 8);
  o.box('cloth', 0, 2.5, -0.1, 1.75, 0.06, 2.35, '#5a1a2a'); for (const sd of [-1, 1]) o.box('cloth', sd * 0.86, 1.5, -0.1, 0.03, 1.9, 2.3, '#6a1a2a'); o.box('cloth', 0, 1.5, -1.24, 1.7, 1.9, 0.03, '#6a1a2a').box('gold', 0, 2.45, 1.08, 1.75, 0.12, 0.03, '#d8b050'); };
// a chest bound in black iron with a skull and crossed bones burned into its front
P.poisonchest = (o, d) => { o.boxB('planks', 0, 0, 0, 1.05, 0.6, 0.66, '#3a2a1e').g('planks', PRIM.cyl12, 0, 0.6, 0, 1.05, 0.66, 0.66, '#3a2a1e', 0, 0, Math.PI / 2);
  for (const x of [-0.42, 0, 0.42]) o.box('metalv', x, 0.45, 0, 0.07, 0.95, 0.7, '#1a1a1e'); o.box('metalv', 0, 0.42, 0.34, 0.16, 0.2, 0.03, '#4a4a4e');
  const z = 0.345; o.sph('bone', 0.24, 0.32, z, 0.17, 0.17, 0.04, '#e8e2cc').box('bone', 0.24, 0.22, z, 0.1, 0.06, 0.03, '#e8e2cc').sph('dark', 0.2, 0.33, z + 0.02, 0.045, 0.045, 0.02, '#100808').sph('dark', 0.28, 0.33, z + 0.02, 0.045, 0.045, 0.02, '#100808');
  o.box('bone', 0.24, 0.27, z - 0.005, 0.32, 0.04, 0.02, '#e8e2cc', 0, 0, 0.7).box('bone', 0.24, 0.27, z - 0.005, 0.32, 0.04, 0.02, '#e8e2cc', 0, 0, -0.7);
  o.cylB('paint', -0.25, 0.92, 0.05, 0.05, 0.14, '#3a5a2a', 8).cylB('paint', -0.25, 1.06, 0.05, 0.02, 0.05, '#2a3a1a', 6).box('paint', -0.05, 0.93, -0.05, 0.16, 0.02, 0.12, '#d8d0b8'); };
P.grate = (o, d) => { o.box('dark', 0, 0.01, 0, 1.2, 0.02, 0.8, null); for (let k = -2; k <= 2; k++) o.box('metalv', k * 0.24, 0.03, 0, 0.05, 0.04, 0.8, '#4a4440'); o.box('metalv', 0, 0.03, 0, 1.2, 0.04, 0.06, '#4a4440'); };
// a boat without a stated size (the hub jetties) is a proper clinker rowboat now, never the old stack of boxes
P.boat = (o, d, ctx) => { const wl = geo.waterAt(o.x / PX, o.z / PX); ctx.anim.push({ kind: 'boat', x: o.x, y: isNaN(wl) ? o.y : wl, z: o.z, v: d.v, size: d.size || 'rowboat', ry: d.ry != null ? d.ry : d.v * Math.PI * 2, arrival: !!d.arrival }); };
P.balloon = (o, d, ctx) => { ctx.anim.push({ kind: 'balloon', x: o.x, y: o.y, z: o.z, v: d.v }); };
P.well2 = P.well;
// ---------- the little things on the walls and in the corners that make a room somebody's ----------
// a painting in a moulded frame (gilt in grand rooms, dark oak in homes), at eye height
P.painting = (o, d) => {
  const k = Math.floor(d.v * 8) % 8, tall = k === 2 || k === 7, sc = 0.8 + (d.v * 7 % 1) * 0.35;
  const w = (tall ? 0.62 : 0.95) * sc, h = (tall ? 0.85 : 0.68) * sc, y = 1.75, gilt = d.gilt || d.v > 0.62, fc = gilt ? '#c89a3a' : '#4a2e18', fk = gilt ? 'gold' : 'timber';
  o.box(fk, 0, y + h / 2 + 0.04, 0.03, w + 0.16, 0.09, 0.06, fc).box(fk, 0, y - h / 2 - 0.04, 0.03, w + 0.16, 0.09, 0.06, fc).box(fk, -w / 2 - 0.04, y, 0.03, 0.09, h, 0.06, fc).box(fk, w / 2 + 0.04, y, 0.03, 0.09, h, 0.06, fc);
  o.box('timber', 0, y, 0.005, w, h, 0.01, '#2a1a10');
  o.mb.add('painting', paintCell(k), o.m(0, y, 0.016, w, h, 1), null, 'local');
};
// an iron wall sconce with a burning candle
P.sconce = (o, d) => { o.box('metalv', 0, 1.85, 0.01, 0.1, 0.22, 0.02, '#2a2622').box('metalv', 0, 1.8, 0.09, 0.03, 0.03, 0.16, '#2a2622').cylB('metalv', 0, 1.8, 0.17, 0.06, 0.03, '#3a3430', 8).cylB('paint', 0, 1.83, 0.17, 0.025, 0.12, '#f2ead0', 6);
  o.flame(0, 2.0, 0.17, 0.06, 0.12); o.glow(0, 2.0, 0.17, 0.9, [2.4, 1.6, 0.7], 0.4); };
// a shelf on brackets: jars, a few books, a mug and a candle stub
P.wallshelf = (o, d) => { const R = K3.rng(Math.floor(d.v * 1e6) + 3); o.box('planks', 0, 1.55, 0.13, 1.25, 0.05, 0.26, '#6a4a2a'); for (const x of [-0.45, 0.45]) o.box('timber', x, 1.45, 0.08, 0.05, 0.18, 0.14, DWOOD, 0, 0.5, 0);
  let x = -0.55; while (x < 0.5) { const r = R(); if (r < 0.4) { o.g('gloss', urnG(), x + 0.06, 1.575, 0.13, 0.42, 0.42 + R() * 0.2, 0.42, ['#6a8a5a', '#9a5a3a', '#4a6a9a', '#c8b07a'][Math.floor(R() * 4)]); x += 0.16; }
    else if (r < 0.75) { const n = 2 + Math.floor(R() * 3); for (let i = 0; i < n; i++) o.boxB('cloth', x + i * 0.05, 1.575, 0.13, 0.045, 0.16 + R() * 0.08, 0.17, ['#6a1e1e', '#1e3a6a', '#3a5a2a', '#5a3a1a'][Math.floor(R() * 4)], (i === n - 1 ? 0.25 : 0)); x += n * 0.05 + 0.06; }
    else { o.cylB('planks', x + 0.06, 1.575, 0.13, 0.05, 0.11, '#8a5e34', 8); x += 0.14; } } };
// bunches of herbs hung up to dry from a pole
P.herbs = (o, d) => { o.cyl('timber', 0, 2.25, 0.12, 0.025, 1.2, DWOOD, 6, 0, Math.PI / 2); for (let i = 0; i < 6; i++) { const x = -0.5 + i * 0.2, l = 0.3 + ((i * 37) % 5) * 0.04; o.box('cloth', x, 2.2, 0.12, 0.01, 0.1, 0.01, '#c8b890');
  o.g('paint', PRIM.cone8, x, 2.12 - l / 2, 0.12, 0.12, l, 0.12, ['#5a7a3a', '#7a8a4a', '#8a6a3a', '#6a7a5a'][i % 4], 0, Math.PI); } };
// a rail of pots and pans on hooks by the hearth
P.potrack = (o, d) => { o.box('metalv', 0, 2.05, 0.1, 1.1, 0.04, 0.04, '#2a2622'); for (let i = 0; i < 4; i++) { const x = -0.4 + i * 0.27; o.box('metalv', x, 1.95, 0.1, 0.015, 0.18, 0.015, '#2a2622');
  if (i % 2) o.cylB('metalv', x, 1.62, 0.12, 0.13, 0.2, '#5a4a3a', 12).box('metalv', x, 1.8, 0.12, 0.2, 0.02, 0.02, '#3a3430'); else o.cyl('metalv', x, 1.72, 0.12, 0.14, 0.03, '#3a3430', 12, Math.PI / 2, 0).box('metalv', x, 1.86, 0.12, 0.03, 0.2, 0.02, '#3a3430'); } };
// a painted shield over two crossed swords
P.trophy = (o, d) => { const c = d.col || ['#7a1a1a', '#1e3a6a', '#2e5a3a', '#c89a3a'][Math.floor(d.v * 4)];
  for (const s of [-1, 1]) o.box('metalv', 0, 2.0, 0.03, 0.06, 1.1, 0.02, '#c8c8c8', 0, 0, s * 0.7).box('timber', s * 0.3, 1.62, 0.03, 0.05, 0.16, 0.04, DWOOD, 0, 0, s * 0.7);
  o.cyl('paint', 0, 2.0, 0.07, 0.34, 0.06, c, 16, Math.PI / 2, 0); o.cyl('metalv', 0, 2.0, 0.1, 0.09, 0.04, '#d8b040', 12, Math.PI / 2, 0); };
// a stag's antlers on an oak plaque
P.antlers = (o, d) => { o.box('timber', 0, 2.15, 0.02, 0.32, 0.4, 0.04, '#5a3a20'); o.sph('paint', 0, 2.12, 0.1, 0.16, 0.2, 0.2, '#8a6a4a');
  for (const s of [-1, 1]) { o.cyl('paint', s * 0.18, 2.35, 0.12, 0.022, 0.5, '#d8c8a8', 6, 0, -s * 0.8); for (let i = 0; i < 3; i++) o.cyl('paint', s * (0.25 + i * 0.08), 2.42 + i * 0.08, 0.12, 0.015, 0.22, '#d8c8a8', 6, 0, s * 0.2); } };
// a wheel of candles hung on a chain from the ceiling beam
P.chandelier = (o, d, ctx) => { const top = ctx.ceil ? ctx.ceil - o.y : 3.3, y = Math.max(2.35, top - 0.95), r = d.big ? 0.75 : 0.5, n = d.big ? 8 : 6;
  o.cyl('metalv', 0, (y + top) / 2, 0, 0.012, top - y, '#2a2622', 6);
  for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * 6.283, a2 = (i + 1) / (n * 2) * 6.283; const mx = (Math.cos(a) + Math.cos(a2)) / 2 * r, mz = (Math.sin(a) + Math.sin(a2)) / 2 * r; o.box('metalv', mx, y, mz, 0.04, 0.04, 2 * r * Math.sin(Math.PI / (n * 2)) + 0.01, '#2a2622', -(a + a2) / 2); }
  for (let i = 0; i < n; i++) { const a = i / n * 6.283, x = Math.cos(a) * r, z = Math.sin(a) * r; o.cylB('paint', x, y + 0.02, z, 0.025, 0.13, '#f2ead0', 6); o.flame(x, y + 0.2, z, 0.05, 0.1); }
  for (let i = 0; i < 3; i++) { const a = i / 3 * 6.283; o.cyl('metalv', Math.cos(a) * r / 2, y + 0.25, Math.sin(a) * r / 2, 0.008, 0.6, '#2a2622', 4, Math.sin(a) * 0.7, -Math.cos(a) * 0.7); }
  o.glow(0, y + 0.1, 0, d.big ? 1.1 : 0.8, [2.4, 1.6, 0.7], 0.3); };
// a pot plant: a terracotta pot and a mound of leaves
P.plant = (o, d) => { o.g('paint', lathe('pot', [[0, 0], [0.17, 0], [0.22, 0.32], [0.25, 0.36], [0.22, 0.38], [0, 0.36]], 12), 0, 0, 0, 1, 1, 1, '#b8643a');
  const R = K3.rng(Math.floor(d.v * 1e5) + 11); for (let i = 0; i < 9; i++) { const a = R() * 6.283, t = R() * 0.5; o.g('paint', PRIM.cone8, Math.cos(a) * 0.1, 0.55 + t * 0.3, Math.sin(a) * 0.1, 0.12, 0.42 + R() * 0.2, 0.05, i % 3 ? '#3e6a2e' : '#5a8a3a', a, Math.sin(a) * (0.5 + t), Math.cos(a) * (0.5 + t)); } };
// crates stacked in a corner with a sack leaning on them
P.cratepile = (o, d) => { const s = 0.62; o.boxB('planks', -0.12, 0, -0.1, s, s, s, '#8a6440', d.v).boxB('planks', 0.42, 0, 0.05, s * 0.8, s * 0.8, s * 0.8, '#7a5a38', -d.v).boxB('planks', 0.0, s, -0.05, s * 0.75, s * 0.7, s * 0.75, '#9a7448', d.v * 2);
  o.sph('cloth', -0.32, 0.3, 0.32, 0.42, 0.62, 0.38, '#c8b088'); o.box('cloth', -0.32, 0.6, 0.32, 0.1, 0.06, 0.1, '#8a7050'); };
// a broom against the wall by the door
P.broom = (o, d) => { o.cyl('haft', 0, 0.75, 0.1, 0.022, 1.45, '#8a6a40', 6, -0.12, 0); o.g('paint', PRIM.cone8, 0, 0.12, 0.02, 0.26, 0.32, 0.08, '#c8a860', 0, Math.PI - 0.12); };
// ---------- village life (world.js growTown): fences, haystacks, woodpiles, troughs, livestock, houses going up ----------
const vh = (a, b, c) => { const x = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return x - Math.floor(x); };
// a split-rail fence d.len tiles long along local x
P.fence = (o, d) => { const L = (d.len || 3) * 1.6; const n = Math.max(2, Math.round(L / 1.6) + 1);
  for (let i = 0; i < n; i++) { const x = -L / 2 + (L * i) / (n - 1); o.cyl('bark', x, 0.52, 0, 0.075, 1.04, '#6a4a2a', 8, (vh(i, n, 3) - 0.5) * 0.08, 0).sph('timber', x, 1.05, 0, 0.15, 0.08, 0.15, '#5a3e22'); } // round split posts with a weathered cap
  for (const y of [0.42, 0.82]) o.box('timber', 0, y, 0, L, 0.08, 0.07, '#7a5530', 0, 0, (vh(n, y * 10, 5) - 0.5) * 0.03); };
P.haystack = (o) => { o.g('cloth', PRIM.sph12, 0, 0.55, 0, 1.9, 1.3, 1.7, '#c9a548').cone('cloth', 0, 0.95, 0, 0.75, 0.7, '#d4b257', 12).box('timber', 0.5, 0.9, 0.55, 0.05, 1.6, 0.05, '#5a3e22', 0, 0.5, 0.3); };
P.woodpile = (o) => { for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - r; i++) o.cyl('bark', -0.55 + i * 0.36 + r * 0.18, 0.17 + r * 0.31, 0, 0.16, 1.1, i % 2 ? '#6a4a2a' : '#5a3e22', 8, Math.PI / 2, 0);
  o.box('timber', 0.95, 0.35, 0, 0.5, 0.7, 0.05, '#4a3220', 0, 0, 0.25).box('metalv', 0.95, 0.75, 0.05, 0.2, 0.12, 0.04, '#5a5a5e', 0, 0, 0.25); };
P.trough = (o) => { o.box('planks', 0, 0.3, 0, 1.4, 0.45, 0.5, '#5a3e22').box('water', 0, 0.48, 0, 1.25, 0.04, 0.38, '#3a5a5a'); };
// livestock: plain, low-poly beasts with a little variety in coat
const beast = (o, d, s, coat, head, legs, horn) => { const c = d.v < 0.5 ? coat[0] : coat[1];
  o.g('cloth', PRIM.sph12, 0, 0.62 * s, 0, 0.75 * s, 0.6 * s, 1.15 * s, c).g('cloth', PRIM.sph12, 0, 0.78 * s, 0.62 * s, 0.32 * s, 0.32 * s, 0.42 * s, head);
  for (const [x, z] of [[-0.22, -0.35], [0.22, -0.35], [-0.22, 0.35], [0.22, 0.35]]) o.cyl('dark', x * s, 0.18 * s, z * s, 0.06 * s, 0.36 * s, legs, 6);
  o.sph('dark', -0.09 * s, 0.86 * s, 0.82 * s, 0.05 * s, 0.05 * s, 0.05 * s, '#111').sph('dark', 0.09 * s, 0.86 * s, 0.82 * s, 0.05 * s, 0.05 * s, 0.05 * s, '#111');
  if (horn) for (const x of [-0.12, 0.12]) o.cone('bone', x * s, 0.98 * s, 0.55 * s, 0.04 * s, 0.22 * s, '#d8ccb0', 6); };
P.sheep = (o, d) => beast(o, d, 1, ['#ece6d8', '#d8d0c0'], '#2a2622', '#2a2622');
P.goat = (o, d) => beast(o, d, 0.9, ['#d8d0c4', '#8a7a64'], '#a89a84', '#4a4038', true);
P.pig = (o, d) => { beast(o, d, 0.95, ['#e8b0a4', '#c8907e'], '#e8b0a4', '#c8907e'); o.cyl('cloth', 0, 0.74, 0.86, 0.1, 0.06, '#d89888', 10, Math.PI / 2, 0); };
P.cow = (o, d) => { beast(o, d, 1.5, ['#f0ece4', '#6a4a32'], '#f0ece4', '#3a2a22', true); if (d.v < 0.5) for (let i = 0; i < 3; i++) o.g('cloth', PRIM.sph12, (vh(i, 1, d.v * 9) - 0.5) * 0.7, 1.05, (i - 1) * 0.45, 0.4, 0.3, 0.4, '#2a2420'); };
P.chicken = (o, d) => { const c = d.v < 0.5 ? '#f2ece0' : '#a8642e'; o.g('cloth', PRIM.sph12, 0, 0.22, 0, 0.26, 0.24, 0.32, c).g('cloth', PRIM.sph12, 0, 0.38, 0.14, 0.14, 0.15, 0.14, c).cone('gold', 0, 0.38, 0.24, 0.03, 0.07, '#e0a030', 6).box('paint', 0, 0.47, 0.13, 0.03, 0.07, 0.08, '#c8302a').cyl('gold', -0.05, 0.05, 0, 0.015, 0.1, '#e0a030', 6).cyl('gold', 0.05, 0.05, 0, 0.015, 0.1, '#e0a030', 6); };
// a cottage going up: footing, timber frame, part-built walls (d.done of the height) and scaffolding with a ladder
P.houseframe = (o, d) => { const W2 = (d.bw || 5) * 1.6 - 0.4, D2 = (d.bh || 4) * 1.6 - 0.4, H = 3.2, done = d.done || 0.5;
  o.box('stone', 0, 0.15, 0, W2 + 0.2, 0.3, D2 + 0.2, '#8a8478');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) o.box('timber', sx * W2 / 2, H / 2 + 0.3, sz * D2 / 2, 0.24, H, 0.24, '#6a4a2a');
  for (const sx of [-1, 1]) o.box('timber', sx * W2 / 2, 0.3 + H, 0, 0.2, 0.2, D2, '#6a4a2a').box('timber', 0, 0.3 + H * 0.5, sx * D2 / 2, W2, 0.16, 0.16, '#6a4a2a');
  for (const sz of [-1, 1]) o.box('timber', 0, 0.3 + H, sz * D2 / 2, W2, 0.2, 0.2, '#6a4a2a');
  for (let i = 1; i < 4; i++) { const x = -W2 / 2 + (W2 * i) / 4; o.box('timber', x, 0.3 + H * 0.5, -D2 / 2, 0.14, H, 0.14, '#7a5530'); }
  const wh = H * done; for (const sz of [-1, 1]) o.box('planks', 0, 0.3 + wh / 2, sz * D2 / 2, W2 - 0.3, wh, 0.12, '#c8b08a'); o.box('planks', -W2 / 2, 0.3 + wh * 0.4, 0, 0.12, wh * 0.8, D2 - 0.3, '#c8b08a');
  if (done > 0.5) for (let i = 0; i < 5; i++) { const t = -W2 / 2 + (W2 * i) / 4; o.box('timber', t, 0.3 + H + 0.9, 0, 0.12, 0.12, D2 * 0.62, '#6a4a2a', 0, 0.9, 0).box('timber', t, 0.3 + H + 0.9, 0, 0.12, 0.12, D2 * 0.62, '#6a4a2a', 0, -0.9, 0); }
  // scaffolding along the front: poles, two plank decks and a ladder
  const fz = D2 / 2 + 0.7; for (let i = 0; i <= 3; i++) o.box('timber', -W2 / 2 + (W2 * i) / 3, 2.1, fz, 0.1, 4.2, 0.1, '#8a6a40');
  for (const y of [1.6, 3.2]) o.box('planks', 0, y, fz - 0.25, W2, 0.06, 0.6, '#9a7a4a');
  o.box('timber', W2 / 2 + 0.4, 1.7, fz + 0.2, 0.06, 3.4, 0.06, '#8a6a40', 0, 0.12, 0).box('timber', W2 / 2 + 0.8, 1.7, fz + 0.2, 0.06, 3.4, 0.06, '#8a6a40', 0, 0.12, 0);
  for (let r = 0; r < 8; r++) o.box('timber', W2 / 2 + 0.6, 0.3 + r * 0.42, fz + 0.2 - r * 0.05, 0.4, 0.05, 0.05, '#8a6a40');
  o.box('planks', -W2 / 2 - 0.6, 0.12, fz + 0.4, 1.4, 0.24, 0.6, '#c8b08a').box('stone', W2 / 2 - 0.2, 0.25, -D2 / 2 - 0.7, 0.8, 0.5, 0.6, '#9a948a'); };

// trees, rocks and plants go to the instanced vegetation instead
export const VEG_KINDS = new Set(['oak', 'elmwood', 'darkoak', 'birch', 'willow', 'pine', 'snowpine', 'deadtree', 'charred', 'palm', 'cactus', 'bramble', 'boulder', 'orevein', 'flowers', 'fern', 'reeds', 'crop']);
const AGAINST_WALL = new Set(['painting', 'sconce', 'wallshelf', 'herbs', 'potrack', 'trophy', 'antlers', 'workbench', 'wardrobe', 'dresser', 'tapestry', 'kingbed', 'poisonchest', 'desk', 'bookshelf', 'shelf', 'hearth', 'forge', 'stove', 'vault', 'weaponrack', 'loom', 'clothrack', 'bed', 'counter', 'keg', 'banner', 'armorstand', 'throne']);

// build the non-vegetation decorations in a tile rectangle into mb; extra lists collect flames, smoke, emitters, signs, flags, animated props
export function buildProps(mb, list, out) {
  for (const d of list) {
    if (VEG_KINDS.has(d.kind)) continue;
    const fn = P[d.kind]; if (!fn) continue;
    const f = facing(d);
    const nb = !!d.nb || d.flat;
    let px = nb ? d.x : (d.tx + 0.5) * TS + (d.x - (d.tx * TS + 16)) * 0.5, py = nb ? d.y - 8 : (d.ty + 0.5) * TS;
    let x = px * PX, z = py * PX;
    let ry = f.ry;
    if (f.b && AGAINST_WALL.has(d.kind) && f.m === 1) { const o2 = wallOff(f, d.kind); if (f.wall === 'n') z -= o2; else if (f.wall === 's') z += o2; else if (f.wall === 'w') x -= o2; else x += o2; }
    if (!f.b) {
      // outdoors: some things look along the road, tents face their fire, the rest get a random turn
      if (d.kind === 'cavemouth') { const dir = d.dir || 'n'; ry = dir === 'n' ? Math.PI : dir === 's' ? 0 : dir === 'w' ? -Math.PI / 2 : Math.PI / 2; }
      else if (d.kind === 'sewermouth' || d.kind === 'drainpipe' || d.kind === 'sewerexit' || d.kind === 'fence' || d.kind === 'houseframe') ry = d.ry != null ? d.ry : 0;
      else if (['lamp', 'torch', 'stall', 'statue', 'cavesign', 'fountain', 'monument', 'crypt', 'well', 'exitportal', 'grate'].includes(d.kind)) ry = d.kind === 'statue' ? Math.PI * (d.v > 0.5 ? 0 : 0) : d.kind === 'lamp' ? Math.floor(d.v * 4) * Math.PI / 2 : 0;
      else ry = d.v * Math.PI * 2;
    }
    const y = geo.floorAt(px, py) + (d.up && f.b ? geo.LOFT_H : 0); // furniture on an upper floor
    const ctx = { ceil: f.b ? f.b._ceil3 : null, faction: f.b ? f.b.faction || f.b.style : null, flags: out.flags, signs: out.signs, anim: out.anim };
    try { fn(new Put(mb, x, y, z, ry, out), d, ctx); } catch (e) { console.warn('prop', d.kind, e); }
  }
}

// ---------- animated props: boats on the water and the balloon at the eyrie ----------
export function makeAnimProp(a) {
  const mb = new MB();
  const o = new Put(mb, 0, 0, 0, 0, { flames: [], smokes: [], emitters: [] });
  if (a.kind === 'boat' && a.size) { const g = buildShip(a.size, a.v); g.userData.anim = a; g.position.set(a.x, a.y, a.z); g.rotation.y = a.ry || 0; g.traverse((m) => { if (m.isMesh || m.isLineSegments) m.matrixAutoUpdate = false; }); return g; }
  if (a.kind === 'boat') {
    const hull = (z, w, h) => o.box('planks', 0, 0.35 + h / 2 - 0.4, z, w, h, 1.05, '#6a4424');
    hull(-2.6, 0.8, 0.8); hull(-1.6, 1.7, 1.0); hull(-0.5, 2.1, 1.05); hull(0.6, 2.1, 1.05); hull(1.7, 1.8, 1.0); hull(2.6, 1.0, 0.9);
    o.g('planks', PRIM.cone8, 0, 0.45, 3.45, 1.0, 1.2, 0.95, '#6a4424', 0, Math.PI / 2).box('planks', 0, 0.98, 0, 2.0, 0.06, 6.0, '#8a5a30');
    o.cylB('timber', 0, 0.9, 0.3, 0.1, 6.2, '#4a2e18', 8).box('cloth2', 0.08, 4.2, 0.3, 0.03, 3.6, 2.8, '#efe6cc', 0, 0, 0).cyl('timber', 0, 2.3, 0.3, 0.06, 3.0, '#4a2e18', 6, Math.PI / 2);
    o.box('cloth2', 0.6, 6.8, 0.3, 0.9, 0.5, 0.02, '#b84a3a', Math.PI / 2);
    for (const x of [-1.05, 1.05]) o.box('timber', x, 1.05, 0, 0.08, 0.14, 5.8, '#8a5a30');
  } else {
    o.boxB('planks', 0, 0, 0, 1.3, 1.0, 1.3, '#8a5a30').box('planks', 0, 1.0, 0, 1.4, 0.08, 1.4, '#6a4424');
    for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) o.cyl('paint', x * 1.6, 2.6, z * 1.6, 0.02, 3.4, '#5a3a20', 4, z * 0.25, -x * 0.25);
    const cols = ['#c83a3a', '#e8c040']; for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; o.g('cloth2', PRIM.sph12, Math.cos(a) * 0.15, 6.2, Math.sin(a) * 0.15, 5.4, 6.6, 0.9, cols[k % 2], -a); }
    o.sph('cloth2', 0, 6.2, 0, 5.0, 6.4, 5.0, '#c83a3a'); o.flame(0, 2.4, 0, 0.5, 0.8);
  }
  const g = mb.build(); g.userData.anim = a; g.position.set(a.x, a.y, a.z); g.rotation.y = a.kind === 'boat' ? Math.PI / 2 : 0;
  g.traverse((m) => { if (m.isMesh) m.matrixAutoUpdate = false; });
  return g;
}
