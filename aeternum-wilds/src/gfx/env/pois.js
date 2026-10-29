// Aeternum Wilds — the landmarks: the Great Wreck heeled over on the beach, the Hag's hut on its stilts in the
// mire, the Warden's ring of broken pillars round a burning red crystal, the Lost encampment, crumbling ruins in
// the ash, and the small camps of the island's enemies.
import * as THREE from 'three';
import { ENV, U, rng, shade } from './shared.js';
import { MB } from './mb.js';
import { mats } from './mats.js';
import { addFlame, addLightPool, addFireLight } from './fire.js';
import { scatterMesh } from './veg.js';
import { flagMesh } from './town.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const POIS = { crystal: null, crystalY: 0, runes: null };

function quadUV(mb, key, a, b, c, d, u0, v0, u1, v1, color) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z]), 3));
  const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a)).normalize();
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([n.x, n.y, n.z, n.x, n.y, n.z, n.x, n.y, n.z, n.x, n.y, n.z]), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([u0, v0, u1, v0, u1, v1, u0, v1]), 2)); g.setIndex([0, 1, 2, 0, 2, 3]);
  mb.add(key, g, new THREE.Matrix4(), color, 'local');
}
function place(dst, src, m) { for (const p of src.parts.values()) if (p.n) { const g = MB.geo(p); dst.add(p.key, g, m, null, 'local'); g.dispose(); } }

// ---------- the Great Wreck ----------
function wreck() {
  const mb = new MB(); const R = rng(77);
  const L = 17, B = 2.7, Dp = 3.0, NS = 14, NK = 9;
  const hw = (t) => B * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(t), t > 0 ? 2.2 : 3.2)), 0.55); // narrower at the bow (+z)
  const dep = (t) => Dp * (0.75 + 0.25 * Math.cos(t * 1.4)) ;
  const sheer = (t) => 0.4 * t * t + (t > 0 ? 0.5 * t * t * t : 0);
  const pt = (t, k, sd) => { const th = (k / NK) * Math.PI / 2; return V(sd * hw(t) * Math.sin(th), -dep(t) * Math.cos(th) + sheer(t), t * L / 2); };
  // planking, with a great hole stove in on the port side
  for (const sd of [-1, 1]) for (let i = 0; i < NS; i++) for (let k = 0; k < NK; k++) {
    const t0 = -1 + 2 * i / NS, t1 = -1 + 2 * (i + 1) / NS;
    if (sd < 0 && i >= 5 && i <= 9 && k >= 3 && k <= 7 && !(k === 7 && i === 5) && !(k === 3 && i === 9)) continue;
    if (sd > 0 && i === 2 && k > 5) continue;
    const a = pt(t0, k, sd), b = pt(t1, k, sd), c = pt(t1, k + 1, sd), d = pt(t0, k + 1, sd);
    const col = shade('#6a4a30', (R() - 0.5) * 0.18 - (k < 3 ? 0.1 : 0));
    const v0 = k * 0.7, v1 = (k + 1) * 0.7, u0 = t0 * 4.2, u1 = t1 * 4.2;
    if (sd > 0) { quadUV(mb, 'planks', a, b, c, d, u0, v0, u1, v1, col); quadUV(mb, 'planks', b, a, d, c, u0, v0, u1, v1, shade(col, -0.35)); }
    else { quadUV(mb, 'planks', b, a, d, c, u0, v0, u1, v1, col); quadUV(mb, 'planks', a, b, c, d, u0, v0, u1, v1, shade(col, -0.35)); }
  }
  // ribs showing through the hole, the keel, the gunwales
  for (let i = 1; i < NS; i += 1) { const t = -1 + 2 * i / NS; for (const sd of [-1, 1]) for (let k = 0; k < NK; k++) mb.rod('timber', pt(t, k, sd).multiplyScalar(0.97), pt(t, k + 1, sd).multiplyScalar(0.97), 0.09, '#4a3220', 6); }
  mb.box('timber', 0, -Dp + 0.05, 0, 0.35, 0.4, L * 0.98, '#3a2a1a');
  for (const sd of [-1, 1]) for (let i = 0; i < NS; i++) { const t0 = -1 + 2 * i / NS, t1 = t0 + 2 / NS; mb.rod('timber', pt(t0, NK, sd), pt(t1, NK, sd), 0.13, '#5a3e26', 6); }
  // what's left of the deck
  for (let i = 0; i < 9; i++) { const z = -L / 2 + 1 + i * 0.9; if (i === 4 || i === 5) continue; const t = z / (L / 2); mb.box('planks', 0, sheer(t) - 0.15, z, hw(t) * 1.9, 0.1, 0.85, shade('#7a5a3a', (R() - 0.5) * 0.2)); }
  // the stern castle
  mb.boxB('planks', 0, sheer(-0.85) - 0.2, -L / 2 + 1.6, B * 1.5, 1.9, 2.6, '#6a4a30');
  mb.box('planks', 0, sheer(-0.85) + 1.75, -L / 2 + 1.6, B * 1.6, 0.12, 2.8, '#7a5a3a');
  for (const sd of [-1, 1]) for (let k = 0; k < 5; k++) mb.boxB('timber', sd * B * 0.78, sheer(-0.85) + 1.8, -L / 2 + 0.5 + k * 0.55, 0.1, 0.6, 0.1, '#4a3220');
  mb.box('window', 0, sheer(-0.85) + 0.8, -L / 2 + 0.28, 1.6, 0.6, 0.06, '#ffffff');
  // the broken mainmast and its rigging, a torn sail
  const mBase = V(0, -0.5, 1.0), mTop = V(0.4, 9.5, 0.6);
  mb.rod('timber', mBase, mTop, 0.24, '#5a4028', 10, 0.18);
  mb.rod('timber', V(-2.6, 6.8, 0.7), V(3.2, 7.1, 0.5), 0.1, '#5a4028', 8);
  for (const sd of [-1, 1]) for (let k = 0; k < 4; k++) mb.rod('cloth', V(sd * hw(0.06 + k * 0.08), sheer(0.1), 0.2 + k * 0.7), mTop.clone().lerp(mBase, 0.08 + k * 0.05), 0.02, '#8a7a5a', 4);
  for (let k = 0; k < 6; k++) { const y0 = 6.6 - k * 0.5; const w = 5.4 - k * 0.25 - R() * 0.8; mb.box('cloth2', 0.3 + (R() - 0.5) * 0.4, y0, 0.55 + k * 0.04, w, 0.5, 0.03, shade('#d8c8a0', -k * 0.04 - R() * 0.06), 0, 0.05 * k, (R() - 0.5) * 0.12); }
  // a broken foremast lying on the sand beside her
  mb.rod('timber', V(4.2, -2.2, 5.5), V(9.5, -2.6, 0.2), 0.2, '#5a4028', 10, 0.15);
  // a figurehead
  mb.sph('timber', 0, sheer(0.98) + 0.2, L / 2 + 0.3, 0.45, 0.7, 0.6, '#8a6a3a');
  mb.rod('timber', V(0, sheer(1) - 0.2, L / 2 - 0.5), V(0, sheer(1) + 1.6, L / 2 + 2.6), 0.13, '#5a4028', 8);
  return mb;
}

// ---------- the Hag's hut ----------
function hut() {
  const mb = new MB(); const R = rng(13);
  const fy = 2.8;
  for (const [x, z] of [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2], [0, -2.4], [0, 2.4]]) mb.rod('bark', V(x * 1.05, -0.6, z * 1.05), V(x, fy, z), 0.16, '#4a3a2a', 7);
  for (const [a, b] of [[[-2.2, -2.2], [2.2, 2.2]], [[2.2, -2.2], [-2.2, 2.2]]]) mb.rod('bark', V(a[0], 0.3, a[1]), V(b[0], fy - 0.3, b[1]), 0.08, '#3a2e22', 6);
  mb.boxB('planks', 0, fy - 0.15, 0, 5.4, 0.18, 5.4, '#4a3a28');
  // crooked walls of dark boards, a sagging thatch roof gone green with moss
  for (const [x, z, sx, sz, rz] of [[0, -2.3, 4.6, 0.12, 0.04], [0, 2.3, 4.6, 0.12, -0.03], [-2.3, 0, 0.12, 4.6, 0.02], [2.3, 0, 0.12, 4.6, -0.05]]) mb.box('planks', x, fy + 1.5, z, sx, 3.0, sz, '#4a3e30', 0, 0, rz);
  for (const [x, z] of [[-2.3, -2.3], [2.3, -2.3], [-2.3, 2.3], [2.3, 2.3]]) mb.boxB('bark', x, fy, z, 0.2, 3.2, 0.2, '#3a2e22');
  for (const sd of [-1, 1]) mb.box('thatch', 0, fy + 4.1, sd * 1.55, 5.8, 0.4, 3.9, '#7a8a4a', 0, sd * -0.78, sd * 0.06);
  mb.cyl('thatch', 0, fy + 5.55, 0, 0.3, 5.9, '#5a6a3a', 8, null, 0, 0, Math.PI / 2);
  for (const sx of [-1, 1]) { const m = new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(sx * 2.3, fy + 3, 0); const sh = new THREE.Shape([new THREE.Vector2(-2.3, 0), new THREE.Vector2(2.3, 0), new THREE.Vector2(0, 2.4)]); const g = new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: false }); mb.add('planks', g, m, '#3e3428'); g.dispose(); }
  mb.box('glow', 1.2, fy + 1.8, 2.37, 0.9, 0.7, 0.05, '#9cff5a'); mb.box('glow', -2.37, fy + 1.9, -0.6, 0.05, 0.6, 0.7, '#9cff5a');
  for (const sd of [-1, 1]) mb.box('timber', 1.2 + sd * 0.48, fy + 1.8, 2.42, 0.08, 0.84, 0.06, '#2a2018');
  mb.box('planks', -0.9, fy + 1.1, 2.4, 1.0, 2.0, 0.08, '#2e2418');
  // steps down to the mud, a skull over the door, bottles hanging from the eaves
  for (let k = 0; k < 7; k++) mb.box('planks', -0.9, fy - 0.3 - k * 0.42, 2.95 + k * 0.45, 1.1, 0.08, 0.42, '#4a3a28', 0, 0, (R() - 0.5) * 0.1);
  for (const sd of [-1, 1]) mb.rod('timber', V(-0.9 + sd * 0.58, -0.6, 6.2), V(-0.9 + sd * 0.58, fy + 0.8, 2.6), 0.05, '#3a2e22');
  mb.sph('paint', -0.9, fy + 2.4, 2.5, 0.32, 0.36, 0.3, '#e8e0c8'); mb.box('dark', -1.0, fy + 2.45, 2.75, 0.08, 0.08, 0.04); mb.box('dark', -0.8, fy + 2.45, 2.75, 0.08, 0.08, 0.04);
  for (let k = 0; k < 7; k++) { const x = -2.4 + k * 0.8, z = 2.9; mb.box('cloth', x, fy + 2.9, z, 0.01, 0.5, 0.01, '#6a5a3a'); mb.cylB('glow', x, fy + 2.35, z, 0.08, 0.22, ['#7aff4a', '#c060ff', '#40c8a0'][k % 3], 8, 0.04); }
  // a chimney pipe leaking green smoke
  mb.cylB('metalv', 1.6, fy + 3.2, -1.2, 0.2, 3.2, '#3a3a34', 8);
  return mb;
}
function skullPole(mb, x, y, z) {
  mb.rod('bark', V(x, y - 0.3, z), V(x + 0.1, y + 2.4, z), 0.07, '#3a2e22', 6);
  mb.sph('paint', x + 0.1, y + 2.55, z, 0.26, 0.3, 0.26, '#e8e0c8'); mb.box('dark', x + 0.02, y + 2.6, z + 0.22, 0.07, 0.07, 0.04); mb.box('dark', x + 0.18, y + 2.6, z + 0.22, 0.07, 0.07, 0.04);
  mb.rod('bark', V(x - 0.4, y + 1.9, z), V(x + 0.6, y + 2.0, z), 0.04, '#3a2e22', 5);
}

// ---------- the Warden's shrine ----------
function column(mb, x, y, z, h, broken, R) {
  mb.cylB('stone', x, y - 0.4, z, 0.85, 0.7, '#a8a090', 12); mb.cylB('stone', x, y + 0.25, z, 0.72, 0.3, '#b0a898', 12);
  const hh = h - 1.1; mb.cylB('stone', x, y + 0.55, z, 0.56, hh, '#c0b8a8', 12, broken ? 0.5 : 0.48);
  if (!broken) { mb.cylB('stone', x, y + 0.55 + hh, z, 0.62, 0.3, '#b0a898', 12, 0.72); mb.box('stone', x, y + 0.85 + hh + 0.12, z, 1.55, 0.26, 1.55, '#a8a090'); }
  else for (let k = 0; k < 3; k++) mb.box('stone', x + (R() - 0.5) * 0.4, y + 0.55 + hh + 0.05 + k * 0.08, z + (R() - 0.5) * 0.4, 0.5, 0.25, 0.4, '#b0a898', R() * 3, R() * 0.5, R() * 0.5);
}
function shrine(gy) {
  const mb = new MB(); const R = rng(31); const cx = -244, cz = 0;
  const tops = [];
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * 6.28, r = 16; const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; const y = gy(x, z);
    const broken = i % 3 === 0; const h = broken ? 2.6 + R() * 1.2 : 6.4;
    column(mb, x, y, z, h, broken, R); tops.push({ x, z, y: y + h, broken, a });
    if (broken) for (let k = 0; k < 3; k++) { const d = 1.5 + k * 1.2; mb.cyl('stone', x + Math.cos(a + 0.6) * d, y + 0.35, z + Math.sin(a + 0.6) * d, 0.55, 0.9, '#b8b0a0', 12, null, a + 0.3 + k, 0, Math.PI / 2); }
  }
  // lintels across neighbouring standing pillars
  for (let i = 0; i < 10; i++) { const p = tops[i], q = tops[(i + 1) % 10]; if (p.broken || q.broken) continue; mb.beam('stone', V(p.x, p.y + 0.38, p.z), V(q.x, q.y + 0.38, q.z), 0.8, 0.6, '#b0a898'); }
  // the dais and its steps
  const ax = cx - 12, az = cz, ay = gy(ax, az);
  for (let k = 0; k < 3; k++) mb.cylB('stone', ax, ay - 0.6 + k * 0.32, az, 3.4 - k * 0.7, 0.9 - k * 0.0, shade('#a09888', -k * 0.05), 16);
  mb.cylB('stone', ax, ay + 0.6, az, 1.0, 1.0, '#8a8278', 8, 0.8);
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; const x = ax + Math.cos(a) * 2.2, z = az + Math.sin(a) * 2.2; mb.cylB('metalv', x, ay + 0.3, z, 0.28, 0.9, '#2a2626', 8, 0.4); mb.cyl('glow', x, ay + 1.22, z, 0.32, 0.06, '#ff3a1a', 8); addFlame(x, ay + 1.3, z, 0.4, 0xff3018); addLightPool(x, ay + 0.3, z, 4, 0xff3a20); }
  // a paved floor, broken up
  for (let k = 0; k < 70; k++) { const a = R() * 6.28, r = Math.sqrt(R()) * 14; const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; mb.box('stone', x, gy(x, z) - 0.02, z, 0.9 + R() * 0.8, 0.14, 0.7 + R() * 0.7, shade('#8a8478', (R() - 0.5) * 0.2), R() * 3, (R() - 0.5) * 0.08, (R() - 0.5) * 0.08); }
  return { mb, altar: V(ax, ay, az), tops };
}
function runeTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 6;
  g.lineWidth = 4; g.beginPath(); g.arc(128, 128, 118, 0, 6.283); g.stroke();
  g.lineWidth = 2; g.beginPath(); g.arc(128, 128, 94, 0, 6.283); g.stroke();
  g.font = 'bold 22px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; const gl = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃ';
  for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; g.save(); g.translate(128 + Math.cos(a) * 106, 128 + Math.sin(a) * 106); g.rotate(a + Math.PI / 2); g.fillText(gl[k], 0, 0); g.restore(); }
  g.beginPath(); for (let k = 0; k <= 5; k++) { const a = k * 2 * 6.283 / 5 - Math.PI / 2; const x = 128 + Math.cos(a) * 92, y = 128 + Math.sin(a) * 92; k ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- the Lost encampment ----------
function tent(mb, x, y, z, ry, col) {
  const m = new MB(); const L = 2.8, W = 2.4, H = 1.9;
  for (const sd of [-1, 1]) m.box('cloth2', sd * W / 4, H / 2, 0, Math.hypot(W / 2, H), 0.04, L, col, 0, 0, sd * -Math.atan2(H, W / 2));
  m.rod('timber', V(0, 0, -L / 2 - 0.1), V(0, H + 0.15, -L / 2 - 0.1), 0.05); m.rod('timber', V(0, 0, L / 2 + 0.1), V(0, H + 0.15, L / 2 + 0.1), 0.05); m.rod('timber', V(0, H, -L / 2 - 0.2), V(0, H, L / 2 + 0.2), 0.04, '#5a4028');
  m.box('dark', 0, 0.55, -L / 2 + 0.05, 0.9, 1.0, 0.02);
  const mt = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z); place(mb, m, mt);
}

export function buildPOIs(api) {
  const { addCollider, heightAt, POI, scene } = api;
  const gy = (x, z) => heightAt(x, z);
  const W = new MB();
  // the wreck, heeled over and half sunk into the sand
  { const m = wreck(); const x = POI.wreck.x + 10, z = POI.wreck.z + 6, y = gy(x, z);
    const mt = new THREE.Matrix4().compose(V(x, y + 1.6, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.04, 0.6, 0.38, 'YXZ')), V(1, 1, 1)); place(W, m, mt);
    addCollider({ x, z, r: 4.2 }); addCollider({ x: x + Math.sin(0.6) * 6, z: z + Math.cos(0.6) * 6, r: 2.6 }); addCollider({ x: x - Math.sin(0.6) * 6, z: z - Math.cos(0.6) * 6, r: 2.8 });
    const R = rng(8);
    for (let i = 0; i < 6; i++) { const cx = POI.wreck.x - 8 + i * 3.2, cz = POI.wreck.z - 10 + (i % 2) * 4; const s = 0.8 + R() * 0.3, cy = gy(cx, cz) - 0.15;
      if (i % 2) { W.cylB('planks', cx, cy, cz, 0.38 * s, 1.0 * s, '#6a4a2a', 12, 0.34 * s); W.cyl('metalv', cx, cy + 0.15, cz, 0.4 * s, 0.05, '#3a3a3a', 12); W.cyl('metalv', cx, cy + 0.85 * s, cz, 0.4 * s, 0.05, '#3a3a3a', 12); }
      else W.boxB('planks', cx, cy, cz, s, s, s, '#8a6a42', i + R()); }
    for (let k = 0; k < 14; k++) { const a = R() * 6.28, r = 6 + R() * 10; const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; W.box('planks', px, gy(px, pz) + 0.02, pz, 0.25, 0.08, 1.4 + R() * 1.6, '#5a4430', R() * 6, 0, (R() - 0.5) * 0.3); }
    W.cylB('metalv', x - 6, gy(x - 6, z + 3) + 0.1, z + 3, 0.35, 0.9, '#3a3a3e', 10, 0.25); // a lost cannon's barrel
  }
  // the Hag's hut and her yard
  { const h = hut(); const hx = POI.hut.x, hz = POI.hut.z - 8, y = gy(hx, hz);
    place(W, h, new THREE.Matrix4().makeRotationY(0.08).setPosition(hx, y, hz));
    addCollider({ x: hx, z: hz, r: 3.2 });
    addFlame(hx + 1.2, y + 2.8 + 1.8, hz + 2.6, 0.12, 0x9cff5a); addLightPool(hx + 1, y, hz + 4, 6, 0x7aff4a); addFireLight(hx + 1.2, y + 4.6, hz + 3.2, 0x9cff5a, 14, 16, 0.5);
    for (const [px, pz] of [[-6, -232], [6, -232], [-7, -241], [7, -241], [0, -226]]) { skullPole(W, px, gy(px, pz), pz); addFlame(px + 0.1, gy(px, pz) + 2.95, pz, 0.18, 0x7aff3a); }
    // the cauldron
    const cx = -5, cz = -237.5, cy = gy(cx, cz);
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; W.stone('fieldstone', cx + Math.cos(a) * 0.9, cy + 0.1, cz + Math.sin(a) * 0.9, 0.34, 0.24, 0.3, '#6a6a5a', a); }
    W.cylB('metalv', cx, cy + 0.15, cz, 0.7, 0.85, '#1e1e1c', 16, 0.6); W.cyl('glow', cx, cy + 0.98, cz, 0.6, 0.04, '#7aff3a', 16);
    addFlame(cx, cy + 0.15, cz, 0.35, 0x8aff40); addLightPool(cx, cy, cz, 4, 0x7aff3a); addFireLight(cx, cy + 1.2, cz, 0x7aff4a, 12, 10, 0.4);
    addCollider({ x: cx, z: cz, r: 1.0 });
    SMOKE_EXTRA.push({ x: hx + 1.6 * Math.cos(0.08), y: y + 6.4, z: hz - 1.2, green: true }, { x: cx, y: cy + 1.2, z: cz, green: true });
  }
  // the Warden's shrine
  { const s = shrine(gy); place(W, s.mb, new THREE.Matrix4());
    for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28; addCollider({ x: -244 + Math.cos(a) * 16, z: Math.sin(a) * 16, r: 1 }); }
    addCollider({ x: s.altar.x, z: s.altar.z, r: 2.8 });
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.5, 0), new THREE.MeshStandardMaterial({ color: 0xff3a2a, emissive: 0xff1a0a, emissiveIntensity: 2.2, roughness: 0.15, metalness: 0.2, flatShading: true }));
    crystal.scale.set(0.8, 1.35, 0.8); crystal.position.set(s.altar.x, s.altar.y + 3.6, s.altar.z); crystal.castShadow = true; scene.add(crystal);
    POIS.crystal = crystal; POIS.crystalY = s.altar.y + 3.6;
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: runeTex(), color: 0xff3018, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2 }));
    halo.rotation.x = -Math.PI / 2; halo.position.set(s.altar.x, s.altar.y + 0.32, s.altar.z); scene.add(halo); POIS.runes = halo;
    const big = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), halo.material.clone()); big.material.color.setHex(0x7a1408); big.material.opacity = 0.6;
    big.rotation.x = -Math.PI / 2; big.position.set(-244, gy(-244, 0) + 0.2, 0); scene.add(big);
    addFireLight(s.altar.x, s.altar.y + 3.6, s.altar.z, 0xff3020, 40, 30, 0.6); addLightPool(s.altar.x, s.altar.y, s.altar.z, 9, 0xff3020);
  }
  // the Lost encampment
  { const cx = POI.lostcamp.x, cz = POI.lostcamp.z; const R = rng(55);
    for (const [dx, dz, ry] of [[-6, -4, 0.5], [6, -5, -0.6], [-5, 6, 2.4], [7, 5, -2.3]]) { const x = cx + dx, z = cz + dz; tent(W, x, gy(x, z), z, ry, ['#8a7a5a', '#6a5a44', '#9a8a68', '#7a6a50'][Math.floor(R() * 4)]); addCollider({ x, z, r: 1.3 }); }
    const y = gy(cx, cz);
    for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28; W.stone('fieldstone', cx + Math.cos(a) * 0.9, y + 0.1, cz + Math.sin(a) * 0.9, 0.34, 0.24, 0.3, '#7a7468', a); }
    for (let k = 0; k < 4; k++) { const a = k * 1.6; W.rod('bark', V(cx + Math.cos(a) * 0.6, y + 0.05, cz + Math.sin(a) * 0.6), V(cx, y + 0.6, cz), 0.06, '#4a3020'); }
    addFlame(cx, y + 0.25, cz, 0.5, 0xffa040); addLightPool(cx, y, cz, 6, 0xff9a40); addFireLight(cx, y + 1, cz, 0xff9a40, 18, 14, 0.2);
    SMOKE_EXTRA.push({ x: cx, y: y + 1.2, z: cz, fire: true });
    for (let k = 0; k < 18; k++) { const a = -0.9 + k * 0.1, r = 11; const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; W.cylB('bark', x, gy(x, z) - 0.3, z, 0.16, 2.2 + R() * 0.6, '#5a4430', 6); W.cone('bark', x, gy(x, z) + 2.0, z, 0.16, 0.4, '#3a2e20', 6); }
    for (const [dx, dz] of [[2.5, -1.5], [-2.8, 1.2], [3.2, 2.4]]) { const x = cx + dx, z = cz + dz; W.boxB('planks', x, gy(x, z), z, 0.8, 0.8, 0.8, '#7a5a38', dx); }
    const pole = flagMesh(1.4, 1.0, 'lost', 'pole'); const bx = cx - 2, bz = cz - 1.5; W.cylB('timber', bx, gy(bx, bz) - 0.2, bz, 0.07, 5, '#4a3220', 6); pole.position.set(bx, gy(bx, bz) + 4.2, bz); scene.add(pole);
  }
  const g = W.build(); g.name = 'landmarks'; scene.add(g);
}
export const SMOKE_EXTRA = [];

// ---------- ruins scattered in the ash ----------
function ruinPiece(v) {
  const mb = new MB(); const R = rng(300 + v);
  if (v === 0) { // a broken wall
    for (let k = 0; k < 6; k++) { const L = 3.6 - Math.abs(k - 1.5) * 0.6 - R() * 0.6; mb.box('stone', (R() - 0.5) * 0.3, 0.3 + k * 0.55, 0, L, 0.55, 0.8, shade('#a09888', (R() - 0.5) * 0.15)); }
    for (let k = 0; k < 5; k++) mb.box('stone', 1.5 + R() * 1.5, 0.15, (R() - 0.5) * 2.4, 0.6, 0.35, 0.5, '#9a9284', R() * 3);
  } else if (v === 1) { // a column stump and a fallen drum
    mb.cylB('stone', 0, -0.2, 0, 0.75, 0.5, '#a8a090', 12); mb.cylB('stone', 0, 0.3, 0, 0.5, 2.2 + R(), '#b8b0a0', 12, 0.48);
    mb.cyl('stone', 1.6, 0.45, 0.4, 0.5, 1.4, '#b0a898', 12, null, 0.8, 0, Math.PI / 2); mb.box('stone', -1.2, 0.2, -0.9, 1.0, 0.4, 0.8, '#9a9284', 0.4);
  } else { // an arch's last corner
    mb.boxB('stone', 0, -0.2, 0, 1.1, 4.2, 1.1, '#a49c8c');
    for (let k = 0; k <= 4; k++) { const a = Math.PI / 2 * k / 4; mb.box('stone', 0.55 + (1 - Math.cos(a)) * 1.8, 4.0 + Math.sin(a) * 1.4, 0, 0.6, 0.5, 1.0, '#b0a898', 0, 0, a * 0.9); }
    mb.box('stone', 2.4, 0.2, 0.8, 1.2, 0.4, 0.8, '#9a9284', 0.7);
  }
  return mb.geometry('stone');
}
export function buildRuins(list, api) {
  const { addCollider, heightAt } = api;
  const by = [[], [], []];
  list.forEach(([x, z, s, rot], i) => { const v = i % 3; by[v].push([x, heightAt(x, z) - 0.1, z, s, rot, 0.9 + (i % 5) * 0.04, 0.88 + (i % 3) * 0.04, 0.85]); addCollider({ x, z, r: 1.2 * s }); });
  for (let v = 0; v < 3; v++) scatterMesh(ruinPiece(v), mats.get('stone'), by[v], { far: 240, shadow: true, colors: true });
}

// ---------- props at the enemy camps ----------
export function buildCampProps(camps, api) {
  const { heightAt } = api; const mb = new MB(); const R = rng(66);
  for (const c of camps) {
    if (c.boss || c.radius > 6) continue;
    const x = c.x + 1.5, z = c.z - 1, y = heightAt(x, z);
    if (c.zone === 'ruins') { // a black obelisk with red runes
      mb.boxB('stone', x, y - 0.3, z, 0.8, 2.6, 0.8, '#3a3434', R() * 3); mb.box('glow', x, y + 1.4, z, 0.84, 0.08, 0.84, '#ff3a1a', 0); addLightPool(x, y, z, 3, 0xff3a20);
    } else if (c.zone === 'mire') { // bones and crooked stakes
      for (let k = 0; k < 4; k++) mb.rod('bark', V(x + (R() - 0.5) * 3, y - 0.3, z + (R() - 0.5) * 3), V(x + (R() - 0.5) * 3, y + 1.6 + R(), z + (R() - 0.5) * 3), 0.07, '#3a3024');
      for (let k = 0; k < 6; k++) mb.box('paint', x + (R() - 0.5) * 2, y + 0.04, z + (R() - 0.5) * 2, 0.5, 0.06, 0.08, '#e0d8c0', R() * 3);
    } else { // a fire ring with a pot and a bedroll
      for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28; mb.stone('fieldstone', x + Math.cos(a) * 0.65, y + 0.06, z + Math.sin(a) * 0.65, 0.26, 0.18, 0.24, '#7a7468', a); }
      for (let k = 0; k < 3; k++) { const a = k * 2.1; mb.rod('bark', V(x + Math.cos(a) * 0.4, y, z + Math.sin(a) * 0.4), V(x, y + 0.4, z), 0.05, '#3a2a1a'); }
      addFlame(x, y + 0.15, z, 0.3, 0xffa040); addLightPool(x, y, z, 4, 0xff9a40);
      const bx = x + 2.2, bz = z + 0.8; mb.box('cloth2', bx, heightAt(bx, bz) + 0.06, bz, 0.8, 0.12, 1.9, ['#6a3a2a', '#3a4a5a', '#5a5a3a'][Math.floor(R() * 3)], R() * 3);
    }
  }
  const g = mb.build(); g.name = 'campprops'; ENV.scene.add(g);
}

let spin = 0;
export function updatePOIs(dt, t) {
  if (POIS.crystal) { spin += dt; POIS.crystal.rotation.y = spin * 0.6; POIS.crystal.position.y = POIS.crystalY + Math.sin(t * 1.5) * 0.3; POIS.crystal.material.emissiveIntensity = 1.8 + Math.sin(t * 2.3) * 0.5; }
  if (POIS.runes) { POIS.runes.rotation.z = t * 0.15; POIS.runes.material.opacity = 0.75 + Math.sin(t * 1.7) * 0.2; }
}
