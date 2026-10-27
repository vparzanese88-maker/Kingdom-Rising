// Kingdom Rising 3D — weapons, shields and held items. Each is built with the grip at the origin and
// the blade (or shaft) along +y; actors mount them in a hand.
import { THREE, K3 } from './core.js';
import { MB, PRIM } from './mb.js';

const cache = new Map();
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const FXC = { fire: [3, 1.1, 0.25], frost: [0.8, 1.8, 3], poison: [0.6, 2.6, 0.4], shadow: [0.3, 2.6, 0.9], storm: [1.2, 1.5, 3.2], holy: [3, 2.5, 1.1], nature: [0.9, 2.4, 0.6] };
export const WFX = FXC;

function blade(mb, len, w, tip, col = '#d4d8de') {
  // a double-edged blade with a fuller, tapering to a point
  const s = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(w / 2 * 0.86, len - tip), new THREE.Vector2(0, len), new THREE.Vector2(-w / 2 * 0.86, len - tip)]);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.008, bevelSegments: 1 }); g.translate(0, 0, -0.006);
  mb.add('metal', g, new THREE.Matrix4(), col, 0.5); g.dispose();
  mb.box('metalv', 0, len * 0.45, 0, w * 0.18, len * 0.8, 0.026, '#9aa0a8');
}
function build(kind, opt) {
  const mb = new MB();
  const steel = '#d4d8de', dark = '#3a2a1e', gold = '#c8a040';
  switch (kind) {
    case '1HS': case 'sword': blade(mb, 0.82, 0.07, 0.12, steel);
      for (const sx of [-1, 1]) mb.box('metalv', sx * 0.07, 0.0, 0, 0.15, 0.028, 0.04, '#8a8e96', 0, 0, sx * 0.18); mb.sph('metalv', 0, -0.005, 0, 0.035, 0.035, 0.05, '#8a8e96');
      mb.cyl('leather', 0, -0.1, 0, 0.018, 0.17, dark, 10); for (let k = 0; k < 5; k++) mb.cyl('leather', 0, -0.03 - k * 0.032, 0, 0.0205, 0.008, '#1e140c', 10);
      mb.cyl('metalv', 0, -0.205, 0, 0.042, 0.022, '#9a9ea6', 16, null, 0, Math.PI / 2, 0); break;
    case '2HS': blade(mb, 1.25, 0.09, 0.16, steel); mb.box('gold', 0, -0.01, 0, 0.34, 0.04, 0.06, gold); mb.cyl('leather', 0, -0.18, 0, 0.02, 0.32, dark, 8); mb.sph('gold', 0, -0.36, 0, 0.06, 0.06, 0.06, gold); break;
    case 'axe': case '2HSaxe': { const L = kind === 'axe' ? 0.82 : 1.2; // a bearded war axe: ash haft, iron langets, leather grip
      mb.cyl('haft', 0, L / 2 - 0.15, 0, 0.019, L, '#6a4e34', 10, 0.016);
      for (const sx of [-1, 1]) mb.box('metalv', sx * 0.016, L - 0.4, 0, 0.006, 0.24, 0.02, '#5a5e66');
      mb.cyl('leather', 0, -0.03, 0, 0.022, 0.22, '#3a2416', 10); mb.cyl('metalv', 0, -0.15, 0, 0.024, 0.03, '#6a6e76', 10);
      const s = new THREE.Shape(); s.moveTo(0.02, 0.05); s.quadraticCurveTo(0.1, 0.06, 0.17, 0.13); s.quadraticCurveTo(0.26, 0.02, 0.24, -0.1); s.quadraticCurveTo(0.22, -0.2, 0.16, -0.25); s.quadraticCurveTo(0.12, -0.12, 0.02, -0.06); s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.005, bevelSegments: 2, curveSegments: 10 }); g.translate(0, 0, -0.006);
      mb.add('metal', g, MB.mat(0, L - 0.2, 0), steel, 0.5); g.dispose();
      mb.cyl('metalv', 0, L - 0.2, 0, 0.032, 0.13, '#5a5e66', 12); mb.box('metalv', -0.045, L - 0.2, 0, 0.05, 0.05, 0.03, '#5a5e66'); break; }
    case '1HB': case 'mace': mb.cyl('haft', 0, 0.22, 0, 0.022, 0.6, '#5a3a20', 8); mb.sph('metal', 0, 0.55, 0, 0.13, 0.15, 0.13, '#9a9ea6');
      for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283; mb.box('metal', Math.cos(a) * 0.065, 0.55, Math.sin(a) * 0.065, 0.02, 0.17, 0.06, '#b8bcc4', -a); } break;
    case 'club': { const g = new THREE.CylinderGeometry(0.085, 0.03, 0.75, 10, 3); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const n = K3.hash(Math.round(p.getX(i) * 100), Math.round(p.getY(i) * 100), 3); p.setX(i, p.getX(i) * (0.85 + n * 0.3)); p.setZ(i, p.getZ(i) * (0.85 + n * 0.3)); } g.computeVertexNormals(); mb.add('bark', g, MB.mat(0, 0.3, 0), '#7a5530'); g.dispose(); break; }
    case '2HB': if (opt.staff) {
        mb.cyl('haft', 0, 0.55, 0, 0.022, 1.7, '#6a4a2a', 8);
        for (let k = 0; k < 3; k++) { const a = k / 3 * 6.283; mb.rod('haft', V(0, 1.32, 0), V(Math.cos(a) * 0.07, 1.52, Math.sin(a) * 0.07), 0.012, '#8a6a3a', 5); }
        mb.sph('glow', 0, 1.5, 0, 0.11, 0.11, 0.11, opt.orb || '#8ad0ff');
      } else { mb.cyl('haft', 0, 0.45, 0, 0.025, 1.3, '#5a3a20', 8); mb.box('metal', 0, 1.08, 0, 0.3, 0.16, 0.14, '#8a8e96'); mb.box('metal', 0, 1.08, 0, 0.32, 0.05, 0.15, '#b4b8c0'); }
      break;
    case '1HP': case 'dagger': blade(mb, 0.3, 0.05, 0.08, steel); mb.box('gold', 0, -0.01, 0, 0.12, 0.025, 0.035, gold); mb.cyl('leather', 0, -0.06, 0, 0.015, 0.1, dark, 6); break;
    case 'spear': // an ash spear: tapered shaft, leather grip, iron socket and a leaf blade with a raised midrib, butt spike
      mb.cyl('haft', 0, 0.55, 0, 0.018, 2.1, '#6e5236', 10, 0.015);
      mb.cyl('leather', 0, 0.02, 0, 0.021, 0.3, '#3a2416', 10);
      mb.cyl('metalv', 0, 1.62, 0, 0.022, 0.14, '#5a5e66', 10, 0.016); mb.cyl('metalv', 0, 1.56, 0, 0.026, 0.02, '#6a6e76', 10);
      { const s = new THREE.Shape(); s.moveTo(-0.012, 0); s.quadraticCurveTo(-0.06, 0.08, -0.04, 0.2); s.quadraticCurveTo(-0.02, 0.29, 0, 0.34); s.quadraticCurveTo(0.02, 0.29, 0.04, 0.2); s.quadraticCurveTo(0.06, 0.08, 0.012, 0); s.closePath();
        const g = new THREE.ExtrudeGeometry(s, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 10 }); g.translate(0, 0, -0.003); mb.add('metal', g, MB.mat(0, 1.68, 0), steel, 0.5); g.dispose();
        mb.box('metal', 0, 1.83, 0, 0.012, 0.3, 0.016, '#b8bcc4'); }
      mb.cyl('metalv', 0, -0.52, 0, 0.004, 0.1, '#4a4e56', 8, 0.016);
      break;
    case 'H2H': mb.box('leather', 0, 0.03, 0, 0.09, 0.07, 0.06, '#e8e0d0'); break;
    case 'ARC': { // a recurve bow, string along y
      const pts = []; for (let k = 0; k <= 12; k++) { const t = k / 12 * 2 - 1; pts.push(V(-0.08 * (1 - t * t) + 0.04 * Math.pow(Math.abs(t), 3), t * 0.62, 0)); }
      for (let k = 0; k < 12; k++) mb.rod('haft', pts[k], pts[k + 1], 0.016 - Math.abs(k - 6) * 0.0012, '#6a4a2a', 5);
      mb.rod('paint', pts[0], pts[12], 0.003, '#e8e0d0', 3); mb.cyl('leather', -0.07, 0, 0, 0.022, 0.14, '#3a2a1a', 6); break; }
    case 'THR': blade(mb, 0.18, 0.035, 0.06, steel); mb.cyl('leather', 0, -0.04, 0, 0.012, 0.07, dark, 6); break;
    case 'TOME': { // a proper grimoire: leather boards, page block, ridged spine, brass corners, clasp and a jewel
      const c = opt.tomeCol || '#6a3a8a', W2 = 0.2, H2 = 0.27, P = 0.042, B = 0.011, y = 0.08;
      for (const sz of [-1, 1]) mb.box('leather', 0, y, sz * (P / 2 + B / 2), W2, H2, B, c);
      mb.box('paint', 0.006, y, 0, W2 - 0.012, H2 - 0.012, P, '#eadfc4');
      for (let k = 1; k < 6; k++) mb.box('paint', W2 / 2 - 0.0035, y, -P / 2 + (k * P) / 6, 0.002, H2 - 0.016, 0.0012, '#b8a888'); // the edges of the pages
      mb.cyl('leather', -W2 / 2, y, 0, P / 2 + B, H2, K3.shade(c, -0.25), 10);
      for (const k of [-0.36, -0.12, 0.12, 0.36]) mb.cyl('gold', -W2 / 2, y + k * H2, 0, P / 2 + B + 0.003, 0.01, '#c8a040', 10);
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) mb.box('gold', sx * (W2 / 2 - 0.016), y + sy * (H2 / 2 - 0.016), sz * (P / 2 + B), 0.034, 0.034, 0.004, '#d8b048');
      mb.box('leather', W2 / 2 + 0.002, y, 0, 0.012, 0.04, P + 2 * B + 0.006, K3.shade(c, -0.35)); mb.box('gold', W2 / 2 + 0.008, y, P / 2 + B + 0.002, 0.016, 0.028, 0.004, '#e0c060');
      mb.cyl('gold', 0.01, y + 0.01, P / 2 + B + 0.002, 0.05, 0.004, '#d8b048', 16, null, 0, Math.PI / 2, 0);
      mb.cyl('paint', 0.01, y + 0.01, P / 2 + B + 0.004, 0.038, 0.004, K3.shade(c, -0.15), 16, null, 0, Math.PI / 2, 0);
      mb.sph('glow', 0.01, y + 0.01, P / 2 + B + 0.009, 0.026, 0.026, 0.014, opt.gem || '#ffe08a');
      break; }
    case 'shield': { // heater shield facing +z
      const s = new THREE.Shape(); s.moveTo(-0.3, 0.32); s.lineTo(0.3, 0.32); s.lineTo(0.3, 0.02); s.quadraticCurveTo(0.26, -0.3, 0, -0.42); s.quadraticCurveTo(-0.26, -0.3, -0.3, 0.02); s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.02, bevelSegments: 2 });
      mb.add(opt.wood ? 'planks' : 'paint', g, MB.mat(0, 0, -0.02), opt.shieldCol || '#7a5530', 0.6); g.dispose();
      mb.sph('metalv', 0, 0.02, 0.04, 0.13, 0.13, 0.06, opt.shieldEmb || '#c8a040');
      mb.box('metalv', 0, 0.3, 0.035, 0.6, 0.03, 0.02, '#c8ccd2'); break; }
    case 'quiver': mb.cyl('leather', 0, 0, 0, 0.06, 0.55, '#5a3a20', 8); for (let k = 0; k < 5; k++) mb.cyl('paint', Math.cos(k) * 0.03, 0.33, Math.sin(k) * 0.03, 0.006, 0.2, '#e8e0d0', 4); break;
    case 'pick': mb.cyl('haft', 0, 0.3, 0, 0.022, 0.8, '#5a3a20', 8); mb.box('metalv', 0, 0.68, 0, 0.5, 0.05, 0.05, '#5a5a60', 0, 0, 0.15); break;
    case 'hammer': mb.cyl('haft', 0, 0.22, 0, 0.02, 0.5, '#5a3a20', 8); mb.box('metalv', 0, 0.48, 0, 0.16, 0.08, 0.08, '#3a3a40'); break;
    case 'torch': mb.cyl('haft', 0, 0.2, 0, 0.025, 0.55, '#4a3220', 6); mb.cyl('metalv', 0, 0.47, 0, 0.04, 0.08, '#3a3a3e', 8); break;
    case 'musket': mb.box('haft', 0, 0.35, 0, 0.05, 0.9, 0.07, '#4a2e1a'); mb.cyl('metalv', 0, 0.9, 0.01, 0.014, 0.9, '#2a2a30', 6); break;
    default: return null;
  }
  let grp = mb.build({ castShadow: true });
  grp.traverse((o) => { if (o.isMesh) { o.userData.keepGeo = true; } });
  // blades are built guard-at-origin: shift them so the hand closes round the middle of the grip
  const GRIP = { '1HS': 0.1, sword: 0.1, '2HS': 0.18, '1HP': 0.06, dagger: 0.06, THR: 0.04 }; if (GRIP[kind]) { const o = new THREE.Group(); grp.position.y = GRIP[kind]; o.add(grp); grp = o; }
  return grp;
}
// a weapon model (shared geometry) for a weapon type
export function weaponMesh(kind, opt = {}) {
  if (!kind) return null;
  // the hero's own items are drawn with the same detailed, one-of-a-kind model as their inventory icon
  if (opt.item && K3.itemModel) { try { const m = K3.itemModel(opt.item); if (m && m.group) { m.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.matrixAutoUpdate = true; } }); return m.group; } } catch (e) { console.warn(e); } }
  const key = kind + '|' + (opt.staff ? 's' : '') + (opt.orb || '') + (opt.shieldCol || '') + (opt.shieldEmb || '') + (opt.tomeCol || '') + (opt.wood ? 'w' : '');
  let g = cache.get(key);
  if (g === undefined) { g = build(kind, opt); cache.set(key, g); }
  return g ? g.clone() : null;
}
// how long the business end is (for effects along a blade)
export const BLADE_LEN = { '1HS': 0.82, sword: 0.82, '2HS': 1.25, axe: 0.75, '2HSaxe': 1.15, '1HB': 0.6, mace: 0.6, club: 0.7, '2HB': 1.5, '1HP': 0.3, dagger: 0.3, spear: 1.9, H2H: 0.05, ARC: 0.6, THR: 0.18, TOME: 0.2 };
