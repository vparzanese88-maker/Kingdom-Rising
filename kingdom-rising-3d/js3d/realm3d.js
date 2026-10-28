// Kingdom Rising 3D — the kingdom's buildings (js/realm.js, KR.Realm). Each building has its own plot in town
// (W.cityData[f].plots, laid out in js/world.js): an empty plot is staked out with ropes and a sign; while a
// building goes up, scaffolding rises around half-built walls and builders hammer away; a finished building stands
// in its level's form (the sawmill and the stone cutter grow bigger and grander at levels 2 and 3, with a worker
// for each level). The arborist and the miner who walk out to gather carry their axe or pick, and a bundle of logs
// or a sack of stone on the way home (workerPose, called from actors.js).
import { THREE, K3, TILE, TS } from './core.js';
import { geo } from './geo.js';
import { MB } from './mb.js';
import { makeHumanoid, animateHumanoid } from './chars.js';
import { weaponMesh } from './weapons.js';

const KR = window.KR, W = KR.W, D = KR.D;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const NAMES = { sawmill: 'Sawmill', cutter: 'Stone Cutter', barracks: 'Barracks', range: 'Archery Range', stable: 'Stable', workshop: 'Siege Workshop' };
const realmState = (f) => { try { const R = KR.Realm; return R && typeof R.state === 'function' ? R.state(f) : null; } catch (e) { return null; } };
const levelOf = (f, id) => (W.realmLevel ? W.realmLevel(f, id) : 0);
// how far along a building is (0..1), or null when nothing is being built on the plot
function progressOf(f, id) {
  const st = realmState(f); const list = st && st.construction; if (!list || !list.length) return null;
  const c = list.find((q) => q.id === id || q.plot === id); if (!c) return null;
  let p = c.p != null ? c.p : c.progress != null ? c.progress : c.dur ? c.t / c.dur : 0;
  if (c.start != null && c.end != null) { const now = KR.G && KR.G.now != null ? KR.G.now : Date.now(); p = (now - c.start) / Math.max(1, c.end - c.start); }
  return Math.max(0, Math.min(1, p || 0));
}
const banner = (f) => ((D.FACTIONS[f] || {}).banner || '#7a1e1e');
const trimOf = (f) => ((D.FACTIONS[f] || {}).trim || '#e0c060');

// ---------- small pieces ----------
// a timber frame shed: posts, eaves, a pitched roof of boards (w across x, d deep along z, wall height h)
function shed(mb, w, d, h, o = {}) {
  const post = o.post || '#5a3e24', roofCol = o.roof || '#6a4a2e', rise = o.rise != null ? o.rise : Math.min(w, d) * 0.32;
  const nx = Math.max(2, Math.round(w / 2.2)), nz = Math.max(2, Math.round(d / 2.2));
  for (let i = 0; i <= nx; i++) for (const sz of [-1, 1]) mb.boxB('timber', -w / 2 + (w * i) / nx, 0, sz * d / 2, 0.24, h, 0.24, post);
  for (let j = 1; j < nz; j++) for (const sx of [-1, 1]) mb.boxB('timber', sx * w / 2, 0, -d / 2 + (d * j) / nz, 0.24, h, 0.24, post);
  for (const sz of [-1, 1]) mb.box('timber', 0, h, sz * d / 2, w + 0.3, 0.22, 0.22, post);
  for (const sx of [-1, 1]) mb.box('timber', sx * w / 2, h, 0, 0.22, 0.22, d + 0.3, post);
  // roof: ridge along x, two slopes of boards (or tiles)
  const slope = Math.hypot(d / 2 + 0.4, rise), ang = Math.atan2(rise, d / 2 + 0.4);
  for (const sz of [-1, 1]) mb.box(o.roofKey || 'shingle', 0, h + rise / 2 + 0.06, sz * (d / 4 + 0.2), w + 0.7, 0.1, slope, roofCol, 0, sz * ang, 0);
  mb.box('timber', 0, h + rise + 0.1, 0, w + 0.8, 0.2, 0.2, post);
  for (let i = 0; i <= nx; i++) { const x = -w / 2 + (w * i) / nx; mb.beam('timber', V(x, h, -d / 2), V(x, h + rise, 0), 0.14, 0.14, post); mb.beam('timber', V(x, h, d / 2), V(x, h + rise, 0), 0.14, 0.14, post); }
  if (o.walls) { // plank walls on the back and the sides (the front, toward the street, stays open)
    mb.boxB('planks', 0, 0, -d / 2, w, h, 0.12, o.wallCol || '#6e5034');
    for (const sx of [-1, 1]) mb.boxB('planks', sx * w / 2, 0, 0, 0.12, h, d, o.wallCol || '#6e5034');
  }
}
function logPile(mb, x, z, n, len, ry = 0) {
  const c = Math.cos(ry), s = Math.sin(ry); let k = 0;
  for (let row = 0; k < n; row++) for (let i = 0; i < n - row * 2 && k < n; i++, k++) {
    const o = (i - (n - row * 2 - 1) / 2) * 0.42; const r = 0.19 + ((i * 7 + row * 3) % 5) * 0.012;
    mb.cyl('bark', x + c * o, 0.2 + row * 0.36, z - s * o, r, len, '#6a4a30', 8, null, ry, 0, Math.PI / 2);
    mb.cyl('planks', x + c * o + s * len / 2, 0.2 + row * 0.36, z - s * o + c * len / 2, r * 0.92, 0.03, '#c8a070', 8, null, ry, 0, Math.PI / 2);
  }
}
function plankStack(mb, x, z, w, d, h, ry = 0) { for (let i = 0; i < Math.round(h / 0.12); i++) mb.boxB('planks', x, i * 0.12, z, w, 0.1, d, i % 2 ? '#c09060' : '#b08050', ry + (i % 3 - 1) * 0.02); mb.boxB('timber', x, 0, z, w + 0.1, 0.08, 0.16, '#4e3520', ry); }
function blockStack(mb, x, z, n, col = '#b8b0a0') { let k = 0; for (let row = 0; k < n; row++) for (let i = 0; i < 3 - row && k < n; i++, k++) mb.boxB('stone', x + (i - (2 - row) / 2) * 0.82, row * 0.55, z, 0.78, 0.52, 0.62, K3.shade(col, ((i + row) % 3 - 1) * 0.05)); }
function boulder(mb, x, z, s) { mb.sph('rock', x, s * 0.35, z, s, s * 0.75, s * 0.9, '#8a8478', (x * 7 + z) % 3, 8); }
function bannerPole(mb, out, f, x, z, h) { mb.cylB('timber', x, 0, z, 0.08, h, '#4e3520', 8); mb.sph('gold', x, h + 0.05, z, 0.16, 0.16, 0.16, '#d8b040', 0, 8); out.flags.push({ x, y: h - 0.2, z, f }); }
// a wheel in the x-y plane (axis along z): rim of segments, spokes, a hub
function wheel(mb, x, y, z, r, col, spokes = 8, ry = 0, w = 0.3) {
  const c = Math.cos(ry), s = Math.sin(ry); const P = (lx, ly, lz) => V(x + c * lx + s * lz, y + ly, z - s * lx + c * lz);
  const n = 20; for (let i = 0; i < n; i++) { const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU; mb.beam('timber', P(Math.cos(a0) * r, Math.sin(a0) * r, 0), P(Math.cos(a1) * r, Math.sin(a1) * r, 0), w * 0.6, w, col); }
  for (let i = 0; i < spokes; i++) { const a = (i / spokes) * TAU; mb.beam('timber', P(0, 0, 0), P(Math.cos(a) * r, Math.sin(a) * r, 0), 0.12, 0.12, col); }
  mb.cyl('metalv', x, y, z, 0.18, w + 0.2, '#3a3a40', 8, null, ry, Math.PI / 2, 0);
}
function sawPit(mb, x, z) {
  mb.boxB('dark', x, -0.02, z, 1.0, 0.04, 3.2); // the pit
  for (const sz of [-1, 1]) { mb.boxB('timber', x - 0.6, 0, z + sz * 1.3, 0.2, 0.9, 0.2, '#4e3520'); mb.boxB('timber', x + 0.6, 0, z + sz * 1.3, 0.2, 0.9, 0.2, '#4e3520'); mb.box('timber', x, 0.92, z + sz * 1.3, 1.4, 0.18, 0.2, '#4e3520'); }
  mb.cyl('bark', x, 1.25, z, 0.32, 3.6, '#6a4a30', 10, null, 0, Math.PI / 2, 0);
  mb.box('metalv', x, 1.25, z + 0.3, 0.02, 1.9, 0.18, '#9aa0a6'); // the long saw standing upright in the cut
  for (const sy of [-1, 1]) mb.box('haft', x, 1.25 + sy * 1.0, z + 0.3, 0.06, 0.06, 0.5, '#6a4a2a', 0, Math.PI / 2, 0);
}
function crane(mb, x, z, h, ry, col = '#5a3e24') {
  const c = Math.cos(ry), s = Math.sin(ry); const P = (lx, ly, lz) => V(x + c * lx + s * lz, ly, z - s * lx + c * lz);
  mb.beam('timber', P(-0.6, 0, 0), P(0, h, 0), 0.22, 0.22, col); mb.beam('timber', P(0.6, 0, 0), P(0, h, 0), 0.22, 0.22, col);
  mb.beam('timber', P(0, 0, -0.6), P(0, h, 0), 0.22, 0.22, col);
  mb.beam('timber', P(0, h, 0), P(0, h - 0.6, 3.0), 0.2, 0.2, col); // the jib
  mb.rod('cloth2', P(0, h - 0.6, 3.0), P(0, 1.3, 3.0), 0.025, '#c8b890');
  wheel(mb, x + c * 0 - s * 1.1, 1.3, z + s * 0 + c * -1.1 + 0, 1.2, col, 8, ry + Math.PI / 2, 0.5); // the treadwheel
}
function signTex(text) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96; const g = cv.getContext('2d');
  g.fillStyle = '#8a6a44'; g.fillRect(0, 0, 256, 96); g.strokeStyle = '#4a3420'; g.lineWidth = 8; g.strokeRect(4, 4, 248, 88);
  for (let i = 0; i < 6; i++) { g.strokeStyle = 'rgba(60,40,20,0.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(8, 18 + i * 13); g.lineTo(248, 20 + i * 13); g.stroke(); }
  g.fillStyle = '#24160c'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'bold 22px Georgia, serif'; g.fillText('Plot for the', 128, 30); g.font = 'bold 30px Georgia, serif'; g.fillText(text, 128, 64);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// ---------- the buildings (local frame: centred on the footprint, front toward +z, ground at y = 0) ----------
function sawmill(mb, out, f, lv, w, d) {
  if (lv <= 1) {
    shed(mb, w * 0.62, d * 0.9, 2.8, { roof: '#6a4a2e' });
    sawPit(mb, 0, 0); out.work.push({ x: 0.95, z: -0.2, k: 'saw', ry: -Math.PI / 2 });
    logPile(mb, w * 0.38, -d * 0.2, 6, 3.2, Math.PI / 2); plankStack(mb, -w * 0.38, d * 0.15, 2.4, 1.0, 0.7, Math.PI / 2);
    mb.boxB('timber', -w * 0.38, 0, -d * 0.3, 0.9, 0.5, 0.9, '#5a3e24'); mb.cyl('bark', -w * 0.38, 0.85, -d * 0.3, 0.28, 0.7, '#6a4a30', 10); // chopping block
    return 2.8;
  }
  if (lv === 2) {
    shed(mb, w * 0.7, d * 0.92, 3.4, { walls: true, roof: '#5e4228' });
    sawPit(mb, -w * 0.12, 0.1); out.work.push({ x: -w * 0.12 + 0.95, z: 0, k: 'saw', ry: -Math.PI / 2 });
    out.work.push({ x: w * 0.24, z: d * 0.3, k: 'chop', ry: Math.PI });
    mb.boxB('timber', w * 0.24, 0, d * 0.42, 0.9, 0.5, 0.9, '#5a3e24'); mb.cyl('bark', w * 0.24, 0.85, d * 0.42, 0.28, 0.7, '#6a4a30', 10);
    crane(mb, w * 0.44, -d * 0.1, 4.6, -Math.PI / 2);
    logPile(mb, -w * 0.44, -d * 0.25, 9, 3.6, Math.PI / 2); plankStack(mb, -w * 0.44, d * 0.32, 2.6, 1.1, 1.1, Math.PI / 2);
    return 3.4;
  }
  // level 3: a grand two-storey mill, stone below and timber above, a great wheel turning the saws, a lumber yard
  const bw = w * 0.62, bd = d * 0.8;
  mb.boxB('stone', -w * 0.12, 0, -d * 0.04, bw, 3.0, bd, '#a8a090');
  mb.boxB('plaster', -w * 0.12, 3.0, -d * 0.04, bw - 0.1, 2.6, bd - 0.1, '#e4dcc8');
  for (let i = 0; i <= 4; i++) { const x = -w * 0.12 - bw / 2 + (bw * i) / 4; mb.boxB('timber', x, 3.0, -d * 0.04 + bd / 2 + 0.02, 0.2, 2.6, 0.08, '#4e3520'); }
  mb.box('timber', -w * 0.12, 4.3, -d * 0.04 + bd / 2 + 0.03, bw, 0.18, 0.08, '#4e3520');
  for (const x of [-0.25, 0.25]) mb.box('window', -w * 0.12 + x * bw, 4.4, -d * 0.04 + bd / 2 + 0.06, 0.7, 0.9, 0.06);
  mb.box('dark', -w * 0.12, 1.3, -d * 0.04 + bd / 2 + 0.01, 2.2, 2.6, 0.06); // the big doors open
  for (const sx of [-1, 1]) mb.box('planks', -w * 0.12 + sx * 1.6, 1.3, -d * 0.04 + bd / 2 + 0.6, 1.0, 2.6, 0.1, '#6e5034', sx * 0.9);
  const rise = 2.0, sl = Math.hypot(bd / 2 + 0.4, rise), ang = Math.atan2(rise, bd / 2 + 0.4);
  for (const sz of [-1, 1]) mb.box('rooftile', -w * 0.12, 5.6 + rise / 2 + 0.05, -d * 0.04 + sz * (bd / 4 + 0.2), bw + 0.6, 0.12, sl, '#8a4a34', 0, sz * ang, 0);
  for (const sx of [-1, 1]) mb.boxB('plaster', -w * 0.12 + sx * bw / 2, 5.6, -d * 0.04, 0.12, rise, bd * 0.5, '#e4dcc8'); // gable ends
  // the great wheel on the right side with its race, and the stack of the saw engine
  wheel(mb, -w * 0.12 + bw / 2 + 0.5, 2.6, -d * 0.04, 2.3, '#5a3e24', 12, Math.PI / 2, 0.6);
  mb.boxB('stone', -w * 0.12 + bw / 2 + 0.5, 0, -d * 0.04 - 2.6, 0.9, 1.0, 0.9, '#9a9284');
  mb.box('water', -w * 0.12 + bw / 2 + 0.5, 0.05, -d * 0.04, 0.9, 0.08, bd);
  out.wheel = { x: -w * 0.12 + bw / 2 + 0.5, y: 2.6, z: -d * 0.04, r: 2.3, ry: Math.PI / 2 };
  logPile(mb, w * 0.38, -d * 0.3, 10, 3.8, Math.PI / 2); plankStack(mb, w * 0.38, d * 0.25, 2.8, 1.2, 1.4, Math.PI / 2); plankStack(mb, -w * 0.42, d * 0.4, 2.8, 1.2, 1.0, 0);
  out.work.push({ x: -w * 0.12 - 1.4, z: d * 0.45, k: 'chop', ry: 0 }); out.work.push({ x: w * 0.25, z: d * 0.42, k: 'chop', ry: Math.PI });
  out.work.push({ k: 'carry', a: [w * 0.38, d * 0.05], b: [-w * 0.12, -d * 0.04 + bd / 2 + 0.8], load: 'planks' });
  bannerPole(mb, out, f, -w * 0.12 - bw / 2 - 0.5, -d * 0.04 + bd / 2, 6.0); bannerPole(mb, out, f, -w * 0.12 + bw / 2 + 1.6, -d * 0.04 + bd / 2, 6.0);
  return 7.6;
}
function cutter(mb, out, f, lv, w, d) {
  if (lv <= 1) {
    // an open stone yard: a low dry-stone wall, a lean-to work shed, blocks, rough boulders and a banker stone
    for (const sx of [-1, 1]) mb.boxB('stone', sx * w / 2, 0, 0, 0.5, 0.8, d, '#a8a090');
    mb.boxB('stone', 0, 0, -d / 2, w, 0.8, 0.5, '#a8a090');
    shed(mb, w * 0.45, d * 0.45, 2.5, { roof: '#6a5a4a', rise: 0.6 }); mb.boxB('stone', -w * 0.0, 0, 0, 1.2, 0.8, 0.8, '#bab2a2');
    out.work.push({ x: 0, z: 0.75, k: 'mine', ry: Math.PI, tool: 'hammer' });
    blockStack(mb, w * 0.32, d * 0.25, 5); boulder(mb, -w * 0.32, -d * 0.2, 1.2); boulder(mb, -w * 0.25, d * 0.25, 0.9);
    return 2.5;
  }
  if (lv === 2) {
    // a covered workshop with stone walls and a crane lifting a block
    mb.boxB('stone', 0, 0, -d * 0.3, w * 0.7, 3.2, 0.5, '#aaa292');
    for (const sx of [-1, 1]) mb.boxB('stone', sx * w * 0.35, 0, -d * 0.05, 0.5, 3.2, d * 0.55, '#aaa292');
    shed(mb, w * 0.72, d * 0.62, 3.2, { roof: '#7a5a44', post: '#4e3520' });
    for (const x of [-0.6, 0.6]) { mb.boxB('stone', x, 0, 0.1, 1.2, 0.8, 0.8, '#bab2a2'); }
    out.work.push({ x: -0.6, z: 0.85, k: 'mine', ry: Math.PI, tool: 'hammer' }); out.work.push({ x: 0.6, z: 0.85, k: 'mine', ry: Math.PI, tool: 'pick' });
    crane(mb, w * 0.4, d * 0.32, 4.4, Math.PI); mb.boxB('stone', w * 0.4, 1.0, d * 0.32 - 3.0 * 1, 0.8, 0.6, 0.8, '#c0b8a8');
    blockStack(mb, -w * 0.35, d * 0.35, 6); blockStack(mb, w * 0.1, d * 0.42, 3, '#c8c0b0'); boulder(mb, -w * 0.4, -d * 0.42, 1.0);
    return 3.2;
  }
  // level 3: a grand masonry hall with carved pillars, a slate roof, an arched door, a statue being carved in the yard
  const bw = w * 0.66, bd = d * 0.62, z0 = -d * 0.16;
  mb.boxB('stone', 0, 0, z0, bw, 5.2, bd, '#cfc6b2');
  mb.boxB('stone', 0, 0, z0, bw + 0.3, 0.5, bd + 0.3, '#a89e8c');
  mb.box('stone', 0, 5.3, z0, bw + 0.4, 0.3, bd + 0.4, '#a89e8c');
  const n = 5; for (let i = 0; i < n; i++) { const x = -bw / 2 + 0.3 + (i * (bw - 0.6)) / (n - 1); if (i === 2) continue; mb.cylB('marble', x, 0.5, z0 + bd / 2 + 0.35, 0.28, 4.4, '#e6e0d2', 12); mb.boxB('marble', x, 4.9, z0 + bd / 2 + 0.35, 0.8, 0.3, 0.8, '#d8d0c0'); mb.boxB('marble', x, 0.3, z0 + bd / 2 + 0.35, 0.8, 0.25, 0.8, '#d8d0c0'); }
  mb.box('stone', 0, 5.0, z0 + bd / 2 + 0.35, bw, 0.35, 0.9, '#bfb6a2'); // architrave over the pillars
  for (let k = 0; k <= 10; k++) { const a = Math.PI * k / 10; mb.box('stone', Math.cos(a) * 1.1, 2.4 + Math.sin(a) * 1.0, z0 + bd / 2 + 0.03, 0.34, 0.34, 0.2, '#a89e8c', 0, 0, a); }
  mb.box('dark', 0, 1.4, z0 + bd / 2 + 0.01, 2.0, 2.8, 0.06);
  const rise = 2.2, sl = Math.hypot(bd / 2 + 0.6, rise), ang = Math.atan2(rise, bd / 2 + 0.6);
  for (const sz of [-1, 1]) mb.box('slate', 0, 5.45 + rise / 2, z0 + sz * (bd / 4 + 0.3), bw + 0.7, 0.14, sl, '#5a6068', 0, sz * ang, 0);
  for (const sx of [-1, 1]) mb.boxB('stone', sx * bw / 2, 5.45, z0, 0.2, rise, bd * 0.6, '#cfc6b2');
  // the cut-stone yard in front: blocks, a column drum, a statue roughed out on a plinth
  blockStack(mb, -w * 0.38, d * 0.36, 6, '#d0c8b8'); blockStack(mb, w * 0.38, d * 0.36, 5, '#d0c8b8');
  mb.cyl('marble', w * 0.2, 0.3, d * 0.42, 0.5, 0.6, '#e6e0d2', 12);
  mb.boxB('stone', -w * 0.08, 0, d * 0.4, 1.0, 0.6, 1.0, '#bab2a2'); mb.boxB('marble', -w * 0.08, 0.6, d * 0.4, 0.6, 1.4, 0.5, '#e6e0d2'); mb.sph('marble', -w * 0.08, 2.2, d * 0.4, 0.42, 0.5, 0.42, '#e6e0d2');
  out.work.push({ x: -w * 0.08 + 0.95, z: d * 0.4, k: 'mine', ry: -Math.PI / 2, tool: 'hammer' }); out.work.push({ x: w * 0.2, z: d * 0.42 - 0.9, k: 'mine', ry: 0, tool: 'pick' });
  out.work.push({ k: 'carry', a: [w * 0.38, d * 0.3], b: [0, z0 + bd / 2 + 1.0], load: 'stone' });
  bannerPole(mb, out, f, -bw / 2 - 0.6, z0 + bd / 2 + 0.4, 6.4); bannerPole(mb, out, f, bw / 2 + 0.6, z0 + bd / 2 + 0.4, 6.4);
  return 7.7;
}
function range(mb, out, f, lv, w, d) {
  // a covered shooting stand at one end, a fenced lane, straw targets on stands at the far end
  shed(mb, w * 0.3, d * 0.8, 2.6, { roof: '#6a4a2e' });
  mb.boxB('timber', 0, 0, d * 0.3, w * 0.28, 1.0, 0.16, '#5a3e24'); // the shooting rail
  for (let x = -w / 2; x <= w / 2 + 0.01; x += w / 6) for (const sz of [-1, 1]) mb.boxB('timber', x, 0, sz * d / 2, 0.14, 1.0, 0.14, '#5a3e24');
  for (const sz of [-1, 1]) for (const y of [0.45, 0.85]) mb.box('timber', 0, y, sz * d / 2, w, 0.08, 0.08, '#6a4a2e');
  for (let i = 0; i < 3; i++) {
    const tx = w * 0.42, tz = -d * 0.3 + i * d * 0.3;
    for (const s of [-1, 1]) mb.beam('timber', V(tx + 0.3, 0, tz + s * 0.45), V(tx, 1.7, tz), 0.1, 0.1, '#5a3e24');
    mb.cyl('cloth2', tx, 1.3, tz, 0.7, 0.3, '#d8c890', 16, null, Math.PI / 2, 0, Math.PI / 2);
    for (const [r, c] of [[0.52, '#f0ece0'], [0.36, '#b83a2a'], [0.2, '#f0ece0'], [0.08, '#d8b040']]) mb.cyl('paint', tx - 0.16, 1.3, tz, r, 0.02, c, 16, null, Math.PI / 2, 0, Math.PI / 2);
    for (let a = 0; a < 2; a++) mb.rod('haft', V(tx - 0.16, 1.25 + a * 0.15, tz + a * 0.1 - 0.05), V(tx - 0.9, 1.3 + a * 0.12, tz + a * 0.12), 0.012, '#8a6a4a');
  }
  mb.boxB('timber', -w * 0.2, 0, -d * 0.35, 1.2, 1.4, 0.3, '#5a3e24'); // a bow rack
  for (let i = 0; i < 4; i++) mb.box('haft', -w * 0.2 - 0.45 + i * 0.3, 1.0, -d * 0.35 + 0.18, 0.04, 1.3, 0.04, '#8a5a2a', 0, 0, 0.1);
  mb.cylB('timber', -w * 0.2 + 1.0, 0, -d * 0.35, 0.3, 0.8, '#6a4a2e', 10); // a quiver barrel
  out.work.push({ x: -w * 0.08, z: d * 0.05, k: 'aim', ry: -Math.PI / 2 });
  bannerPole(mb, out, f, -w * 0.45, d * 0.45, 4.6);
  return 3;
}
function stable(mb, out, f, lv, w, d) {
  const bw = w * 0.9, bd = d * 0.7, z0 = -d * 0.12;
  shed(mb, bw, bd, 2.8, { walls: true, roof: '#8a7240', roofKey: 'shingle', wallCol: '#6e5034' });
  const stalls = Math.max(3, Math.floor(bw / 1.8));
  for (let i = 1; i < stalls; i++) mb.boxB('planks', -bw / 2 + (bw * i) / stalls, 0, z0 - 0.1, 0.1, 1.5, bd * 0.7, '#6a4e32');
  for (let i = 0; i < stalls; i++) {
    const x = -bw / 2 + (bw * (i + 0.5)) / stalls;
    mb.boxB('timber', x, 0, z0 + bd / 2 - 0.2, bw / stalls - 0.3, 0.12, 0.12, '#4e3520'); // stall bar
    mb.boxB('planks', x, 0, z0 - bd * 0.35, bw / stalls - 0.4, 0.5, 0.4, '#5a4026'); // manger
    mb.boxB('cloth2', x, 0.5, z0 - bd * 0.35, bw / stalls - 0.5, 0.15, 0.35, '#c8b060');
    if (i % 2 === 0 || lv > 1) horse(mb, x, z0 + 0.1, ['#6a4028', '#3a2a1e', '#a88458', '#eae4d8'][i % 4], Math.PI);
  }
  for (const [x, z] of [[bw * 0.38, d * 0.4], [bw * 0.25, d * 0.42]]) mb.boxB('cloth2', x, 0, z, 1.0, 0.6, 0.6, '#d0b868'); // hay bales
  mb.boxB('timber', -bw * 0.3, 0, d * 0.4, 1.8, 0.45, 0.5, '#5a3e24'); mb.box('water', -bw * 0.3, 0.42, d * 0.4, 1.6, 0.04, 0.36);
  out.work.push({ x: -bw * 0.1, z: d * 0.38, k: 'mine', ry: 0, tool: 'pitchfork' });
  return 2.8;
}
function horse(mb, x, z, col, ry) {
  const c = Math.cos(ry), s = Math.sin(ry); const P = (lx, ly, lz) => [x + c * lx + s * lz, ly, z - s * lx + c * lz];
  const [bx, by, bz] = P(0, 1.25, 0); mb.sph('leather', bx, by, bz, 0.62, 0.62, 1.5, col, ry, 12);
  for (const [lx, lz] of [[-0.2, 0.5], [0.2, 0.5], [-0.2, -0.5], [0.2, -0.5]]) { const [px, , pz] = P(lx, 0, lz); mb.cylB('leather', px, 0, pz, 0.08, 1.1, K3.shade(col, -0.1), 8); }
  const [nx, ny, nz] = P(0, 1.65, 0.75); mb.beam('leather', V(bx + (nx - bx) * 0.2, 1.45, bz + (nz - bz) * 0.2), V(nx, ny + 0.2, nz), 0.3, 0.4, col);
  const [hx, hy, hz] = P(0, 1.85, 1.05); mb.box('leather', hx, hy, hz, 0.24, 0.26, 0.62, col, ry, 0.5);
  const [mx, my, mz] = P(0, 1.85, 0.6); mb.box('fur', mx, my, mz, 0.08, 0.5, 0.5, '#2a1e16', ry, 0.6);
  const [tx, ty, tz] = P(0, 1.2, -0.8); mb.beam('fur', V(tx, ty + 0.1, tz), V(tx, ty - 0.6, tz - 0.25), 0.12, 0.12, '#2a1e16');
}
function workshop(mb, out, f, lv, w, d) {
  shed(mb, w * 0.85, d * 0.8, 4.4, { walls: true, roof: '#5e4228', rise: 1.6 });
  // a half-built catapult: the base frame, the uprights, the arm lying beside it, and spare timbers
  const cx = -w * 0.08, cz = 0;
  for (const sx of [-1, 1]) mb.box('timber', cx + sx * 0.7, 0.3, cz, 0.24, 0.24, 3.4, '#6a4a2e');
  for (const z of [-1.4, 0, 1.4]) mb.box('timber', cx, 0.3, cz + z, 1.6, 0.22, 0.22, '#6a4a2e');
  for (const sx of [-1, 1]) { mb.beam('timber', V(cx + sx * 0.7, 0.4, cz - 0.6), V(cx + sx * 0.7, 2.2, cz), 0.2, 0.2, '#6a4a2e'); mb.beam('timber', V(cx + sx * 0.7, 0.4, cz + 0.6), V(cx + sx * 0.7, 2.2, cz), 0.2, 0.2, '#6a4a2e'); }
  mb.box('timber', cx, 2.2, cz, 1.6, 0.22, 0.22, '#6a4a2e');
  mb.box('timber', cx + 1.6, 0.18, cz + 0.3, 0.22, 0.22, 3.6, '#7a5a38', 0.2);
  for (const sx of [-1, 1]) wheel(mb, cx + sx * 0.95, 0.5, cz - 1.0, 0.48, '#4e3520', 6, Math.PI / 2, 0.16);
  wheel(mb, w * 0.3, 0.6, -d * 0.25, 0.6, '#4e3520', 6, 0.3, 0.18); // a spare wheel leaning
  logPile(mb, w * 0.3, d * 0.2, 6, 3.0, Math.PI / 2);
  mb.boxB('timber', -w * 0.36, 0, -d * 0.2, 1.6, 0.8, 0.8, '#5a3e24'); // workbench
  out.work.push({ x: cx + 1.05, z: cz + 0.3, k: 'mine', ry: -Math.PI / 2, tool: 'hammer' }); out.work.push({ x: -w * 0.36, z: -d * 0.2 + 0.85, k: 'chop', ry: Math.PI, tool: 'axe' });
  bannerPole(mb, out, f, w * 0.44, d * 0.42, 5.4);
  return 5.6;
}
const BUILD = { sawmill, cutter, range, stable, workshop };

// staked-out ground with ropes and a sign at the front
function emptyPlot(mb, out, p, w, d) {
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { mb.cylB('timber', sx * w / 2, 0, sz * d / 2, 0.06, 0.8, '#6a4a2e', 6); mb.cone('timber', sx * w / 2, 0.8, sz * d / 2, 0.06, 0.12, '#6a4a2e', 6); }
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (let i = 0; i < 4; i++) { const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % 4]; mb.rod('cloth2', V(ax * w / 2, 0.62, az * d / 2), V(bx * w / 2, 0.62, bz * d / 2), 0.018, '#d8c890'); }
  for (let i = 0; i < 3; i++) mb.box('cloth2', (i - 1) * w / 3, 0.55, d / 2, 0.12, 0.16, 0.02, banner(out.f)); // pennants on the front rope
  mb.cylB('timber', -w / 2 + 0.9, 0, d / 2 + 0.3, 0.07, 1.6, '#5a3e24', 6); mb.cylB('timber', -w / 2 + 2.3, 0, d / 2 + 0.3, 0.07, 1.6, '#5a3e24', 6);
  out.sign = { x: -w / 2 + 1.6, y: 1.25, z: d / 2 + 0.36, w: 1.6, h: 0.6, text: NAMES[p.id] || p.id };
  // a few marker pegs and a pile of surveyor's stakes
  for (let i = 0; i < 4; i++) mb.cylB('timber', (i - 1.5) * 0.12 + w * 0.3, 0, -d * 0.3, 0.03, 0.4 + i * 0.05, '#7a5a38', 5);
}
// scaffolding round a rising frame; k = 0..1 of the way built
function construction(mb, out, p, w, d, k, h0) {
  const H = Math.max(1.2, h0 * k), fw = w * 0.82, fd = d * 0.76;
  // the foundations and the walls going up course by course (stone), with a timber frame above
  mb.boxB('stone', 0, 0, 0, fw + 0.3, 0.4, fd + 0.3, '#a29a8a');
  const wallH = Math.min(H, 2.4) * Math.min(1, k * 1.6);
  if (wallH > 0.1) { mb.boxB('stone', 0, 0.4, -fd / 2, fw, wallH, 0.4, '#b4ac9c'); for (const sx of [-1, 1]) mb.boxB('stone', sx * fw / 2, 0.4, 0, 0.4, wallH * 0.85, fd, '#b4ac9c'); mb.boxB('stone', -fw * 0.3, 0.4, fd / 2, fw * 0.3, wallH * 0.7, 0.4, '#b4ac9c'); }
  if (k > 0.45) { const fh = 0.4 + 2.4 + (h0 - 2.8) * Math.min(1, (k - 0.45) / 0.45); for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) mb.boxB('timber', sx * fw / 2, 0.4, sz * fd / 2, 0.24, fh, 0.24, '#7a5a38'); if (k > 0.7) for (const sz of [-1, 1]) mb.box('timber', 0, fh + 0.4, sz * fd / 2, fw, 0.22, 0.22, '#7a5a38'); }
  // scaffolding poles all round, lashed ledgers every 1.5 m, plank decks
  const sw = fw + 1.4, sd = fd + 1.4; const lev = Math.max(1, Math.ceil(H / 1.5));
  const poles = []; for (let x = -sw / 2; x <= sw / 2 + 0.01; x += sw / Math.max(2, Math.round(sw / 2))) poles.push([x, -sd / 2], [x, sd / 2]);
  for (let z = -sd / 2 + sd / Math.max(2, Math.round(sd / 2)); z < sd / 2 - 0.01; z += sd / Math.max(2, Math.round(sd / 2))) poles.push([-sw / 2, z], [sw / 2, z]);
  for (const [x, z] of poles) mb.cylB('timber', x, 0, z, 0.06, H + 0.9, '#9a7a50', 6);
  for (let i = 1; i <= lev; i++) { const y = Math.min(H, i * 1.5);
    for (const sz of [-1, 1]) mb.box('timber', 0, y, sz * sd / 2, sw, 0.07, 0.07, '#9a7a50');
    for (const sx of [-1, 1]) mb.box('timber', sx * sw / 2, y, 0, 0.07, 0.07, sd, '#9a7a50');
    for (const sz of [-1, 1]) mb.box('planks', 0, y + 0.06, sz * (sd / 2 - 0.35), sw - 0.2, 0.05, 0.6, '#b08a5a'); }
  for (let i = 0; i < lev; i++) mb.beam('timber', V(-sw / 2, i * 1.5, sd / 2), V(-sw / 2 + 1.4, Math.min(H, (i + 1) * 1.5), sd / 2), 0.06, 0.06, '#9a7a50'); // ladders/braces
  // materials stacked on the plot
  plankStack(mb, w / 2 - 1.2, d / 2 - 0.5, 2.2, 0.9, 0.5, 0); blockStack(mb, -w / 2 + 1.2, d / 2 - 0.6, 4);
  out.work.push({ x: fw * 0.25, z: fd / 2 + 0.7, k: 'mine', ry: Math.PI, tool: 'hammer' });
  if (H > 1.6) out.work.push({ x: -fw * 0.2, z: -sd / 2 + 0.35, y: Math.min(H, 1.5), k: 'mine', ry: 0, tool: 'hammer' });
  else out.work.push({ k: 'carry', a: [w / 2 - 1.2, d / 2 - 0.5], b: [0, fd / 2 + 0.6], load: 'planks' });
}

// ---------- one plot's 3D: built when its state changes ----------
const plots = new Map(); // key -> { grp, sig, workers: [], work: [], f, wheel }
let root = null;
function disposeGrp(g) { g.traverse((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); if (o.material && o.material.map && o.material.userData.own) { o.material.map.dispose(); o.material.dispose(); } }); }
function buildPlot(f, p) {
  const lv = p.id === 'barracks' ? 0 : levelOf(f, p.id); const prog = progressOf(f, p.id);
  const fp = lv && W.plotFootprint ? W.plotFootprint(p, lv) : p;
  const w = (prog != null ? p.w : fp.w) * TILE, d = (prog != null ? p.h : fp.h) * TILE;
  const cxT = (prog != null ? p.x + p.w / 2 : fp.x + fp.w / 2), czT = (prog != null ? p.y + p.h / 2 : fp.y + fp.h / 2);
  const grp = new THREE.Group(); grp.name = 'realm ' + f + ' ' + p.id;
  grp.position.set(cxT * TILE, geo.floorAt(cxT * TS, czT * TS), czT * TILE); grp.rotation.y = p.front === 'n' ? Math.PI : 0;
  const mb = new MB(); const out = { work: [], flags: [], f, sign: null, wheel: null };
  if (prog != null) construction(mb, out, p, w, d, prog, p.id === 'sawmill' || p.id === 'cutter' ? 3.4 : 4.2);
  else if (p.id === 'barracks') { if (!(W.cityData[f] && W.cityData[f].barracksB)) emptyPlot(mb, out, p, w, d); }
  else if (lv && BUILD[p.id]) BUILD[p.id](mb, out, f, lv, w, d);
  else emptyPlot(mb, out, p, w, d);
  if (!mb.isEmpty()) grp.add(mb.build());
  if (out.sign) { const s = out.sign; const m = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), new THREE.MeshStandardMaterial({ map: signTex(s.text), roughness: 0.9 })); m.material.userData.own = true; m.position.set(s.x, s.y, s.z + 0.04); m.castShadow = true; grp.add(m);
    const back = new THREE.Mesh(new THREE.BoxGeometry(s.w + 0.08, s.h + 0.08, 0.06), new THREE.MeshStandardMaterial({ color: 0x4a3420, roughness: 0.9 })); back.position.set(s.x, s.y, s.z); back.material.userData.own = true; grp.add(back); }
  for (const fl of out.flags) { // a little pennant on each pole, in the kingdom's colours
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.5), new THREE.MeshStandardMaterial({ color: new THREE.Color(banner(f)).convertSRGBToLinear(), side: THREE.DoubleSide, roughness: 0.95 }));
    m.material.userData.own = true; m.position.set(fl.x + 0.48, fl.y - 0.75, fl.z); grp.add(m); out.pennants = (out.pennants || []).concat([m]);
  }
  let wheelObj = null;
  if (out.wheel) { // the great wheel turns: build it as its own spinning mesh on top of the static one
    const wm = new MB(); wheel(wm, 0, 0, 0, out.wheel.r * 0.98, '#6a4a2e', 12, 0, 0.5); for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; wm.box('planks', Math.cos(a) * out.wheel.r, Math.sin(a) * out.wheel.r, 0, 0.5, 0.08, 0.7, '#7a5a3a', 0, 0, a); }
    wheelObj = new THREE.Group(); wheelObj.add(wm.build()); const hold = new THREE.Group(); hold.position.set(out.wheel.x, out.wheel.y, out.wheel.z); hold.rotation.y = out.wheel.ry; hold.add(wheelObj); grp.add(hold);
  }
  grp.traverse((o) => { if (o.isMesh) { o.matrixAutoUpdate = true; } });
  return { grp, work: out.work, pennants: out.pennants || [], wheel: wheelObj };
}
function sigOf(f, p) { const prog = progressOf(f, p.id); return [p.x, p.y, p.w, p.h, p.front, p.id === 'barracks' ? (W.cityData[f] && W.cityData[f].barracksB ? 1 : 0) : levelOf(f, p.id), prog == null ? 'x' : Math.round(prog * 10)].join(','); }

// ---------- the workers at a building ----------
const SKIN = ['#e0b896', '#c8966e', '#a8714a', '#f0caa8'], HAIR = ['#3a2a1a', '#6a4a2a', '#1e1a16', '#8a6a3a', '#a8a29a'];
function workerLook(f, k, job) {
  const F = D.FACTIONS[f] || {};
  return { race: 'human', gender: k % 3 === 2 ? 'f' : 'm', skin: SKIN[k % 4], hair: HAIR[(k * 3) % 5], hairStyle: k % 3, armor: { kind: 'none', col: ['#7a6a4a', '#5a6a7a', '#8a5a3a', '#6a7a5a'][k % 4], trim: F.banner || '#7a1e1e' }, pants: '#4a3a2a', helm: null, hat: job === 'mine' && k % 2 ? 'cap' : null, weapon: null, offhand: null, apron: true };
}
function attach(rig, kind) {
  const m = kind === 'pitchfork' ? weaponMesh('spear', {}) : weaponMesh(kind, {}); if (!m) return null;
  rig.bones.handR.add(m); if (rig.hands) m.position.set(...rig.hands.R.grip); else m.position.set(0, -0.07, 0.01); m.rotation.set(Math.PI / 2, 0, 0); m.position.y -= 0.1; return m;
}
function loadMesh(kind) {
  const mb = new MB();
  if (kind === 'planks' || kind === 'logs') { for (let i = 0; i < 3; i++) mb.cyl(kind === 'logs' ? 'bark' : 'planks', (i - 1) * 0.14, i === 1 ? 0.12 : 0, 0, kind === 'logs' ? 0.08 : 0.06, 1.3, kind === 'logs' ? '#6a4a30' : '#c09060', 6, null, 0, Math.PI / 2, 0); mb.rod('cloth2', V(-0.25, 0.05, 0.3), V(0.25, 0.05, 0.3), 0.015, '#c8b890'); }
  else { mb.sph('cloth2', 0, 0, 0, 0.42, 0.5, 0.36, '#a89060', 0, 8); mb.box('cloth2', 0, 0.26, 0, 0.12, 0.1, 0.12, '#7a6040'); }
  return mb.build({ castShadow: true });
}
function makeWorkers(e, f) {
  e.workers = []; let k = 0;
  for (const wk of e.work) {
    try {
      const rig = makeHumanoid(workerLook(f, k + (f === 'crown' ? 0 : 2), wk.k), 'npc');
      if (rig.setLod) rig.setLod(1);
      const tool = wk.k === 'saw' ? null : wk.k === 'aim' ? 'ARC' : wk.k === 'carry' ? null : wk.tool || (wk.k === 'chop' ? 'axe' : 'pick');
      let held = null; if (tool === 'ARC') { const b = weaponMesh('ARC', {}); if (b) { rig.bones.handL.add(b); if (rig.hands) b.position.set(...rig.hands.L.grip); b.rotation.set(Math.PI / 2, 0, 0); held = b; } } else if (tool) held = attach(rig, tool);
      let load = null; if (wk.k === 'carry') { load = loadMesh(wk.load); rig.bones.chest.add(load); load.position.set(0.18, 0.32, -0.05); load.rotation.set(0, Math.PI / 2, 0.15); }
      rig.mesh.position.set(wk.a ? wk.a[0] : wk.x, wk.y || 0, wk.a ? wk.a[1] : wk.z); rig.mesh.rotation.y = wk.ry || 0;
      e.grp.add(rig.mesh); e.workers.push({ rig, wk, t: Math.random() * 3, leg: 0, held, load });
    } catch (er) { if (!makeWorkers.warned) { makeWorkers.warned = true; console.warn('realm3d worker', er); } }
    k++;
  }
}
function dropWorkers(e) { for (const w of e.workers || []) if (w.rig.mesh.parent) w.rig.mesh.parent.remove(w.rig.mesh); e.workers = null; }
function animWorkers(e, dt) {
  for (const w of e.workers) {
    const wk = w.wk; w.t += dt; let st;
    if (wk.k === 'carry') {
      // walk from the pile to the door with a load on the shoulder, and back
      const [ax, az] = wk.a, [bx, bz] = wk.b; const L = Math.hypot(bx - ax, bz - az) || 1; const sp = 1.1, T = L / sp + 1.2;
      const ph = w.t % (2 * T); const goingOut = ph < T; const q = Math.min(1, Math.max(0, ((goingOut ? ph : ph - T) - 0.6) / (T - 1.2)));
      const u = goingOut ? q : 1 - q; const x = ax + (bx - ax) * u, z = az + (bz - az) * u; const moving = q > 0 && q < 1;
      w.rig.mesh.position.set(x, 0, z); w.rig.mesh.rotation.y = Math.atan2((bx - ax) * (goingOut ? 1 : -1), (bz - az) * (goingOut ? 1 : -1));
      if (w.load) w.load.visible = goingOut;
      st = { move: moving ? 0.45 : 0, dist: moving ? sp * dt : 0, dir: [0, 1], combat: false };
    } else if (wk.k === 'aim') {
      const p = (w.t % 4) / 4; st = { move: 0, dist: 0, combat: true, atk: p > 0.55 && p < 0.8 ? (p - 0.55) / 0.25 : 0, atkKind: 'bow' };
    } else {
      const dur = wk.k === 'saw' ? 0.9 : wk.k === 'chop' ? 1.5 : 1.3; const p = (w.t % (dur + 0.35)) / dur;
      const kk = wk.k === 'saw' ? 'mine' : wk.k; st = { move: 0, dist: 0, combat: false, animK: p < 1 ? kk : null, animP: Math.min(0.999, p) };
      if (wk.k === 'saw') { st.animK = null; st.atk = 0; } // two hands on the saw handle: arms pumping up and down
    }
    try { animateHumanoid(w.rig, st, dt); } catch (er) {}
    if (wk.k === 'saw') { const B = w.rig.bones, s = Math.sin(w.t * 6); B.armR.rotation.x = -1.6 - 0.5 * s; B.armL.rotation.x = -1.6 - 0.5 * s; B.foreR.rotation.x = -0.4; B.foreL.rotation.x = -0.4; B.spine.rotation.x = 0.15 + 0.08 * s; }
  }
}

// ---------- the walkers: arborist and miner (entities made by js/realm.js; actors.js calls this every frame) ----------
// e.worker: 'arborist' | 'miner'; e.carry: true on the way home with a load; e.working: chopping / mining now
export function workerPose(av, e, st) {
  const rig = av.rig; if (!rig) return;
  const job = e.worker === 'miner' ? 'miner' : 'arborist';
  if (!av.wTool || av.wJob !== job) {
    if (av.wTool && av.wTool.parent) av.wTool.parent.remove(av.wTool); if (av.wLoad && av.wLoad.parent) av.wLoad.parent.remove(av.wLoad);
    for (const k of ['R', 'L']) { const h = rig.held[k]; if (h) h.visible = false; }
    av.wTool = attach(rig, job === 'miner' ? 'pick' : 'axe'); av.wJob = job;
    av.wLoad = loadMesh(job === 'miner' ? 'stone' : 'logs'); rig.bones.chest.add(av.wLoad); av.wLoad.position.set(0.18, 0.34, -0.06); av.wLoad.rotation.set(0, Math.PI / 2, 0.15);
  }
  const carry = !!e.carry; av.wLoad.visible = carry;
  // the tool rides on the shoulder while carrying, in the hands while working
  if (av.wTool) av.wTool.visible = !carry;
  if (e.working && !carry) { av.wPh = ((av.wPh || 0) + K3.dt / (job === 'miner' ? 1.3 : 1.5)) % 1.25; if (av.wPh < 1) { st.animK = job === 'miner' ? 'mine' : 'chop'; st.animP = Math.min(0.999, av.wPh); } st.combat = false; }
  if (carry) { st.combat = false; st.carryK = 1; }
}

// ---------- the updater: watch the plots and the camera ----------
let acc = 0;
function sync() {
  if (!root) { if (!K3.scene) return; root = new THREE.Group(); root.name = 'realm'; K3.scene.add(root); }
  const seen = new Set();
  if (!W.realm || W.realm === 'main') for (const f of D.FACTION_IDS || Object.keys(W.cityData || {})) {
    const cd = W.cityData && W.cityData[f]; if (!cd || !cd.plots) continue;
    for (const p of cd.plots) {
      const key = f + ':' + p.id; seen.add(key); const sig = sigOf(f, p); let e = plots.get(key);
      if (e && e.sig === sig) continue;
      if (e) { dropWorkers(e); root.remove(e.grp); disposeGrp(e.grp); }
      try { const b = buildPlot(f, p); e = { grp: b.grp, sig, work: b.work, wheel: b.wheel, pennants: b.pennants, f, workers: null }; root.add(e.grp); plots.set(key, e); }
      catch (er) { console.warn('realm3d', er); plots.delete(key); }
    }
  }
  for (const [key, e] of plots) if (!seen.has(key)) { dropWorkers(e); root.remove(e.grp); disposeGrp(e.grp); plots.delete(key); }
}
K3.updaters.push((dt, t) => {
  try {
    acc += dt; if (acc > 0.5 || !root) { acc = 0; sync(); }
    if (!plots.size) return;
    const cam = K3.camera && K3.camera.position;
    for (const e of plots.values()) {
      const d = cam ? Math.hypot(cam.x - e.grp.position.x, cam.z - e.grp.position.z) : 0;
      e.grp.visible = d < 260;
      if (e.wheel && d < 120) e.wheel.rotation.z -= dt * 0.6;
      if (e.pennants) for (const m of e.pennants) m.rotation.y = Math.sin(t * 1.7 + m.position.x) * 0.25;
      // workers are only made (and moved) when you are close enough to see them work
      if (!e.workers && e.work.length && d < 75) makeWorkers(e, e.f);
      else if (e.workers && d > 110) dropWorkers(e);
      if (e.workers) animWorkers(e, dt);
    }
  } catch (er) { if (!K3._realmWarned) { K3._realmWarned = true; console.warn('realm3d', er); } }
});
// rebuild at once when a building is finished or upgraded
try { if (KR.Realm && typeof KR.Realm.on === 'function') KR.Realm.on('built', () => { acc = 1; }); } catch (e) {}
export const _realmTest = { buildPlot, plots, sync, makeWorkers, animWorkers };
