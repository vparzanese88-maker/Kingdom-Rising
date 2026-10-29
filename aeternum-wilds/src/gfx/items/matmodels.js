// Aeternum Wilds — models of crafting materials, food and potions (for inventory icons): logs, ore lumps with
// starmetal crystals or orichalcum nuggets, fibre bundles, herbs, hides, meat, bones, corruption shards, planks,
// ingots, cloth bolts, leather rolls, potions, roasts, stew and a feast.
import * as THREE from 'three';
import { MB, V3, V2, extrude, lathe, tube, shade, hot } from './mb.js';

function rng(seed) { let a = seed | 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// a lumpy rock: an icosphere pushed about by noise
function lump(R, r, detail = 2, squash = 0.8) {
  const g = new THREE.IcosahedronGeometry(r, detail); const p = g.attributes.position; const seeds = [R(), R(), R(), R()].map((v) => v * 10);
  for (let i = 0; i < p.count; i++) { const v = V3(p.getX(i), p.getY(i), p.getZ(i)); const d = v.clone().normalize(); const n = 1 + 0.18 * Math.sin(d.x * 4 + seeds[0]) * Math.cos(d.y * 3 + seeds[1]) + 0.1 * Math.sin(d.z * 7 + seeds[2]); v.multiplyScalar(n); v.y *= squash; p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g;
}
function log(mb, x, y, z, r, L, bark, end, ry = 0) {
  const g = new THREE.CylinderGeometry(r, r * 1.04, L, 14, 3); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); const k = 1 + 0.06 * Math.sin(a * 5 + p.getY(i) * 20); if (Math.abs(p.getY(i)) < L / 2 - 1e-4) { p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } }
  g.computeVertexNormals();
  mb.add('wood', g, MB.mat(x, y, z, 1, 1, 1, 0, ry, Math.PI / 2), bark);
  for (const s of [-1, 1]) { // the cut ends with growth rings
    const ex = x + Math.cos(ry) * s * (L / 2 + 0.002), ez = z - Math.sin(ry) * s * (L / 2 + 0.002);
    mb.cyl('wood', ex, y, ez, r * 0.92, 0.004, end, 16, null, 0, ry, Math.PI / 2);
    for (let k = 1; k <= 3; k++) mb.add('wood', new THREE.TorusGeometry(r * 0.22 * k, 0.0025, 3, 18), MB.mat(ex + Math.cos(ry) * s * 0.002, y, ez - Math.sin(ry) * s * 0.002, 1, 1, 1, 0, ry + Math.PI / 2, 0), shade(end, -0.12));
  }
}
function ingot(mb, x, y, z, c, ry = 0) {
  const g = new THREE.CylinderGeometry(Math.SQRT1_2 * 0.07, Math.SQRT1_2 * 0.095, 0.06, 4, 1); g.rotateY(Math.PI / 4); g.scale(1, 1, 2.4); g.computeVertexNormals();
  const ng = g.toNonIndexed(); ng.computeVertexNormals();
  mb.add('metal', ng, MB.mat(x, y, z, 1, 1, 1, 0, ry, 0), c);
}
function flask(mb, prof, liquid, glass, cork, fill = 0.62) {
  mb.add('glass', lathe(prof, 20), MB.mat(0, 0, 0), glass);
  const top = prof[0][1] + (prof[prof.length - 1][1] - prof[0][1]) * fill;
  const inner = prof.filter(([r, y]) => y <= top).map(([r, y]) => [Math.max(0.001, r * 0.9), y + 0.004]); inner.push([inner[inner.length - 1][0], top], [0.001, top]);
  mb.add('liquid', lathe(inner, 20), MB.mat(0, 0, 0), liquid);
  const neck = prof[prof.length - 1];
  mb.cyl('wood', 0, neck[1] + 0.02, 0, neck[0] * 1.1, 0.05, cork, 12, neck[0] * 1.25);
}

const B = {
  green_wood(mb, R) { log(mb, -0.05, -0.04, 0.03, 0.07, 0.42, '#6e5236', '#e0c088', 0.3); log(mb, 0.06, -0.04, -0.06, 0.065, 0.4, '#6a4e32', '#dcb880', -0.2); log(mb, 0.0, 0.08, 0.0, 0.06, 0.38, '#725638', '#e4c690', 0.1); for (let k = 0; k < 3; k++) mb.add('paint', new THREE.SphereGeometry(0.04, 8, 6), MB.mat(0.08 + k * 0.03, 0.15, 0.02, 1, 0.3, 0.6, 0, 0, 0.4 * k), '#5aa040'); },
  aged_wood(mb, R) { log(mb, -0.05, -0.04, 0.03, 0.075, 0.42, '#4a3624', '#b88c58', 0.3); log(mb, 0.06, -0.04, -0.06, 0.07, 0.4, '#463220', '#b0844e', -0.2); log(mb, 0.0, 0.09, 0.0, 0.065, 0.38, '#4e3a26', '#bc9460', 0.1); },
  wyrdwood(mb, R) { log(mb, -0.05, -0.04, 0.03, 0.075, 0.42, '#3e2a44', '#b890d8', 0.3); log(mb, 0.06, -0.04, -0.06, 0.07, 0.4, '#3a2640', '#ac84d0', -0.2); log(mb, 0.0, 0.09, 0.0, 0.065, 0.38, '#42304a', '#c09ae0', 0.1); for (let k = 0; k < 5; k++) mb.sph('glow', (R() - 0.5) * 0.3, 0.02 + R() * 0.12, 0.08, 0.012, 0.012, 0.012, hot('#d8a8ff', 2), 8); },
  iron_ore(mb, R) { mb.add('rock', lump(R, 0.17), MB.mat(0, 0, 0), '#6a625a'); for (let k = 0; k < 7; k++) { const d = V3(R() - 0.5, R() * 0.6, R() - 0.5).normalize(); mb.add('metal', lump(R, 0.03, 0), MB.mat(d.x * 0.14, d.y * 0.11, d.z * 0.14), k % 2 ? '#8a5a3a' : '#7a7e84'); } },
  starmetal_ore(mb, R) { mb.add('rock', lump(R, 0.16), MB.mat(0, -0.02, 0), '#4a4e5a'); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + R(); const d = V3(Math.cos(a) * 0.5, 0.8, Math.sin(a) * 0.5).normalize(); const g = new THREE.OctahedronGeometry(0.04 + R() * 0.03, 0); g.scale(0.7, 2.2, 0.7); mb.add('gem', g, new THREE.Matrix4().compose(d.clone().multiplyScalar(0.11).add(V3(0, 0.02, 0)), new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), d), V3(1, 1, 1)), '#6ab8ff'); } },
  orichalcum_ore(mb, R) { mb.add('rock', lump(R, 0.165), MB.mat(0, 0, 0), '#6a5444'); for (let k = 0; k < 8; k++) { const d = V3(R() - 0.5, R() * 0.7, R() - 0.5).normalize(); mb.add('metal', lump(R, 0.035 + R() * 0.02, 1), MB.mat(d.x * 0.14, d.y * 0.12, d.z * 0.14), '#f2b448'); } },
  fibers(mb, R) { for (let k = 0; k < 26; k++) { const a = R() * 6.28, r = R() * 0.045; mb.cyl('paint', Math.cos(a) * r, 0, Math.sin(a) * r, 0.006, 0.46, k % 3 ? '#a8a060' : '#8a9a50', 5, null, (R() - 0.5) * 0.12, 0, (R() - 0.5) * 0.12); } for (const y of [-0.08, 0.08]) mb.cyl('cloth', 0, y, 0, 0.056, 0.03, '#7a5a3a', 16); },
  silkweed(mb, R) { for (let k = 0; k < 12; k++) { const a = R() * 6.28, r = R() * 0.04; mb.cyl('paint', Math.cos(a) * r, -0.02, Math.sin(a) * r, 0.006, 0.4, '#8ab070', 5, null, (R() - 0.5) * 0.3, 0, (R() - 0.5) * 0.3); } for (let k = 0; k < 6; k++) mb.sph('cloth', (R() - 0.5) * 0.14, 0.18 + R() * 0.06, (R() - 0.5) * 0.08, 0.06, 0.07, 0.06, '#f2f0e8', 10); mb.cyl('cloth', 0, -0.12, 0, 0.05, 0.03, '#c8b080', 16); },
  herbs(mb, R) { for (let k = 0; k < 7; k++) { const a = -0.6 + k * 0.2; mb.cyl('paint', Math.sin(a) * 0.08, -0.02, 0, 0.005, 0.32, '#5a8a3a', 5, null, 0, 0, -a * 0.6); const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(0.04, 0.05, 0, 0.12); s.quadraticCurveTo(-0.04, 0.05, 0, 0); mb.geo('paint', new THREE.ShapeGeometry(s, 6), Math.sin(a) * 0.16, 0.1, 0.01, 0, 0, -a, 1, k % 2 ? '#6aa848' : '#4e8c36'); } for (let k = 0; k < 4; k++) { const x = (k - 1.5) * 0.06; mb.sph('paint', x, 0.2 + (k % 2) * 0.03, 0.02, 0.035, 0.035, 0.02, '#f4d040', 8); mb.sph('paint', x, 0.2 + (k % 2) * 0.03, 0.03, 0.014, 0.014, 0.01, '#d88a20', 6); } mb.cyl('cloth', 0, -0.12, 0, 0.03, 0.025, '#c8a878', 12); },
  rawhide(mb, R) { hide(mb, '#9a7450', '#d8b898', 1); },
  thick_hide(mb, R) { hide(mb, '#5a4430', '#c8a080', 1.6); },
  raw_meat(mb, R) { mb.add('paint', lump(R, 0.15, 2, 0.45), MB.mat(0, 0, 0, 1.3, 1, 0.9), '#b8343a'); for (let k = 0; k < 5; k++) mb.box('gloss', (R() - 0.5) * 0.2, 0.045, (R() - 0.5) * 0.12, 0.08, 0.006, 0.01, '#f0d8c8', 0, R() * 3, 0); mb.add('gloss', new THREE.TorusGeometry(0.15, 0.018, 6, 24, Math.PI), MB.mat(0, 0.0, 0, 1.28, 1, 0.9, Math.PI / 2, 0, 0), '#f2e2cc'); mb.cyl('bone', 0.2, 0, 0, 0.022, 0.12, '#efe6d0', 10, null, 0, 0, Math.PI / 2); },
  bone(mb, R) { for (const a of [0.5, -0.5]) { mb.cyl('bone', 0, 0, 0, 0.022, 0.36, '#ece2cc', 10, null, 0, 0, a); for (const s of [-1, 1]) for (const o of [-1, 1]) mb.sph('bone', s * Math.sin(-a) * 0.18 * -1 + o * Math.cos(a) * 0.022, s * Math.cos(a) * 0.18 + o * Math.sin(a) * 0.022, 0, 0.05, 0.05, 0.045, '#f2e8d4', 8); } for (let k = 0; k < 3; k++) mb.add('bone', new THREE.TetrahedronGeometry(0.04), MB.mat((R() - 0.5) * 0.2, -0.14, 0.05, 1, 1.4, 1, R(), R(), R()), '#e0d4bc'); },
  shard(mb, R) { const g = new THREE.OctahedronGeometry(0.1, 0); g.scale(0.7, 2.0, 0.6); mb.add('gem', g, MB.mat(0, 0.02, 0, 1, 1, 1, 0, 0.4, 0.15), '#8a1a3a'); for (let k = 0; k < 3; k++) { const g2 = new THREE.OctahedronGeometry(0.05, 0); g2.scale(0.7, 1.8, 0.6); mb.add('gem', g2, MB.mat(-0.08 + k * 0.08, -0.12, 0.03, 1, 1, 1, 0, R(), (k - 1) * 0.6), '#6a1430'); } mb.sph('glow', 0, 0.02, 0, 0.05, 0.12, 0.04, hot('#ff3a5a', 1.8), 8); },
  timber(mb) { planks(mb, '#d0a46a'); },
  lumber(mb) { planks(mb, '#9a6a40'); },
  wyrd_planks(mb) { planks(mb, '#8a64a8'); },
  iron_ingot(mb) { ingots(mb, '#9ea2a8'); },
  starmetal_ingot(mb) { ingots(mb, '#86a8dc'); },
  orichalcum_ingot(mb) { ingots(mb, '#f0b44c'); },
  linen(mb) { bolt(mb, '#e2d6bc', '#a88a5a'); },
  silk(mb) { bolt(mb, '#5a8ad8', '#e8d8a0'); },
  leather(mb) { roll(mb, '#a06a3a'); },
  layered_leather(mb) { roll(mb, '#6a4228', true); },
  potion(mb) { flask(mb, [[0.001, -0.15], [0.07, -0.145], [0.12, -0.08], [0.125, -0.02], [0.09, 0.05], [0.035, 0.08], [0.03, 0.15]], hot('#ff2a3a', 1.1), '#f4f8ff', '#8a6a3a'); mb.add('cloth', new THREE.TorusGeometry(0.034, 0.008, 4, 14), MB.mat(0, 0.1, 0, 1, 1, 1, Math.PI / 2, 0, 0), '#d8c8a0'); },
  big_potion(mb) { flask(mb, [[0.001, -0.18], [0.09, -0.175], [0.1, -0.12], [0.1, 0.04], [0.07, 0.08], [0.032, 0.11], [0.03, 0.18]], hot('#ff1a5a', 1.2), '#f4f8ff', '#5a3a20', 0.7); mb.cyl('metal', 0, -0.03, 0, 0.104, 0.03, '#e2b44a', 20); mb.cyl('metal', 0, 0.12, 0, 0.034, 0.02, '#e2b44a', 12); mb.sph('gem', 0, -0.03, 0.105, 0.03, 0.03, 0.015, '#ffd84a', 8); },
  cooked_meat(mb, R) { mb.add('paint', lump(R, 0.12, 2, 1.0), MB.mat(0.04, 0.0, 0, 1.25, 1, 1), '#8a4a22'); for (let k = 0; k < 4; k++) mb.box('paint', 0.02 + (k - 1.5) * 0.05, 0.03, 0.115, 0.012, 0.15, 0.01, '#5a2a12', 0, 0, 0.5); mb.cyl('bone', -0.15, -0.03, 0, 0.022, 0.16, '#f2e8d4', 10, null, 0, 0, Math.PI / 2 + 0.3); for (const o of [-1, 1]) mb.sph('bone', -0.24, -0.06 + o * 0.022, 0, 0.04, 0.04, 0.04, '#f2e8d4', 8); mb.sph('gloss', 0.06, 0.07, 0.06, 0.06, 0.02, 0.04, '#c87a3a', 8); },
  stew(mb, R) { mb.add('wood', lathe([[0.001, -0.08], [0.1, -0.08], [0.17, -0.02], [0.2, 0.06], [0.19, 0.065], [0.16, 0.0], [0.09, -0.06], [0.001, -0.06]], 24), MB.mat(0, 0, 0), '#8a5a32'); mb.cyl('gloss', 0, 0.04, 0, 0.175, 0.01, '#8a4a1e', 24); for (let k = 0; k < 9; k++) mb.sph('paint', (R() - 0.5) * 0.24, 0.05, (R() - 0.5) * 0.24, 0.035, 0.025, 0.035, ['#e08a2a', '#7a3a1e', '#e8d8a0', '#5a8a3a'][k % 4], 8); mb.cyl('wood', 0.1, 0.12, -0.04, 0.008, 0.26, '#a87a4a', 6, null, 0.3, 0, -0.6); },
  feast(mb, R) { mb.cyl('metal', 0, -0.06, 0, 0.26, 0.02, '#c8a050', 28); mb.add('paint', lump(R, 0.1, 2, 0.8), MB.mat(-0.07, 0.02, 0, 1.4, 1, 1), '#9a5226'); mb.cyl('bone', -0.2, 0.02, 0.02, 0.016, 0.1, '#f2e8d4', 8, null, 0, 0, Math.PI / 2); mb.sph('paint', 0.12, 0.0, 0.08, 0.14, 0.1, 0.1, '#c8904a', 10); for (let k = 0; k < 3; k++) mb.box('paint', 0.12 + (k - 1) * 0.035, 0.045, 0.08, 0.008, 0.01, 0.07, '#8a5a2a', 0, 0.4, 0); for (let k = 0; k < 5; k++) mb.sph('gloss', 0.08 + (R() - 0.5) * 0.12, 0.0, -0.12 + (R() - 0.5) * 0.06, 0.045, 0.045, 0.045, ['#c8282a', '#e8b030', '#6a2a6a'][k % 3], 8); },
  crate(mb) { mb.box('planks', 0, 0, 0, 0.32, 0.26, 0.26, '#a87a48'); for (const y of [-0.08, 0.08]) mb.box('metal', 0, y, 0, 0.33, 0.03, 0.27, '#5a5a60'); mb.box('metal', 0, 0, 0.135, 0.06, 0.07, 0.012, '#e2b44a'); mb.box('dark', 0, 0, 0.142, 0.016, 0.03, 0.004, '#140c06'); },
};
function hide(mb, fur, skin, thick) {
  const g = new THREE.PlaneGeometry(0.5, 0.4, 14, 10); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setX(i, x * (1 - 0.18 * Math.cos(y * 8)) + 0.03 * Math.sin(y * 13)); p.setY(i, y * (1 - 0.12 * Math.cos(x * 6))); p.setZ(i, Math.sin(x * 8) * 0.03 + Math.cos(y * 7) * 0.025); }
  g.computeVertexNormals();
  mb.add('fur', g, MB.mat(0, 0, 0.004 * thick), fur);
  mb.add('leather', g, MB.mat(0, 0, -0.004 * thick, 1, 1, 1, 0, Math.PI, 0), skin);
  if (thick > 1) mb.add('fur', g, MB.mat(0.01, -0.01, 0.012 * thick, 0.96, 0.96, 1), shade(fur, 0.05));
}
function planks(mb, c) { for (let k = 0; k < 3; k++) mb.box('planks', 0, -0.07 + k * 0.065, (k - 1) * 0.02, 0.48, 0.055, 0.13, shade(c, (k - 1) * 0.04), 0, (k - 1) * 0.12, 0); }
function ingots(mb, c) { ingot(mb, -0.07, -0.04, 0, c); ingot(mb, 0.07, -0.04, 0, shade(c, -0.03)); ingot(mb, 0, 0.022, 0, shade(c, 0.03), 0.06); }
function bolt(mb, c, band) { mb.cyl('cloth', 0, 0, 0, 0.1, 0.38, c, 24, null, 0, 0, Math.PI / 2); mb.add('cloth', new THREE.TorusGeometry(0.1, 0.004, 3, 30), MB.mat(0.195, 0, 0, 1, 1, 1, 0, Math.PI / 2, 0), shade(c, -0.15)); mb.cyl('cloth', 0.06, -0.06, 0.09, 0.002, 0.2, c, 4); mb.box('cloth', 0.0, -0.09, 0.07, 0.36, 0.01, 0.06, c, 0.3, 0, 0); for (const x of [-0.11, 0.11]) mb.cyl('cloth', x, 0, 0, 0.103, 0.02, band, 24, null, 0, 0, Math.PI / 2); }
function roll(mb, c, layered) { mb.cyl('leather', 0, 0, 0, 0.09, 0.36, c, 24, null, 0, 0, Math.PI / 2); mb.add('leather', new THREE.TorusGeometry(0.06, 0.004, 3, 24), MB.mat(0.182, 0, 0, 1, 1, 1, 0, Math.PI / 2, 0), shade(c, -0.15)); mb.box('leather', 0.0, -0.08, 0.06, 0.34, 0.008, 0.08, c, 0.4, 0, 0); for (const x of [-0.1, 0.1]) { mb.cyl('leather', x, 0, 0, 0.094, 0.025, '#2a1a10', 24, null, 0, 0, Math.PI / 2); mb.box('metal', x, 0, 0.095, 0.03, 0.03, 0.01, '#b8a070'); } if (layered) mb.cyl('leather', 0, 0, 0, 0.092, 0.2, shade(c, 0.08), 24, null, 0, 0, Math.PI / 2); }

// a model for a material / consumable id (from data.js MATS), or null if unknown
export function buildMatModel(id, ctx = 'icon') {
  const f = B[id]; if (!f) return null;
  const mb = new MB(); f(mb, rng(id.length * 131 + id.charCodeAt(0)));
  return mb.build(ctx, { castShadow: false });
}
export const MAT_MODEL_IDS = Object.keys(B);
