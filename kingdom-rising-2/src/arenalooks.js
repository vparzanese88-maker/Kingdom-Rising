// Kingdom Arena avatars: no gear slots, every class has one look you can tell from across the sand (like picking a
// god in Smite). arenaSpec() is the outfit palette fed to buildHumanoid; arenaDecor() adds each class's signature
// pieces (helmets, hats, hoods, masks, mantles, orbs); arenaWeaponDecor() dresses the weapon (the necromancer's skull staff).
import * as THREE from 'three';
import { attachHeroModel, tickHeroModel, heroHeight } from './heromodels.js';
import { armReach, classKit, kitize, makeWeapon } from './character.js';

const M = (c, r = 0.8, m = 0, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: r, metalness: m }, o));
const GL = (c) => new THREE.MeshBasicMaterial({ color: c });
const add = (parent, geo, mat, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
const sph = (r, ws = 14, hs = 10) => new THREE.SphereGeometry(r, ws, hs);
const boxG = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cylG = (rt, rb, h, s = 12) => new THREE.CylinderGeometry(rt, rb, h, s);
const coneG = (r, h, s = 8) => new THREE.ConeGeometry(r, h, s);

const SPEC = {
  necromancer: { shirt: '#18161a', robe: '#121014', trim: '#3c3a40', pants: '#100e12', boots: '#0c0a0c', hood: '#0b0a0d', sash: '#2c2a30', sleeves: true, belt: '#1a1418' },
  wizard: { shirt: '#1e5868', robe: '#1a4e5e', trim: '#d8b04a', pants: '#14303a', boots: '#3a2a1a', hat: 'pointy', hatCol: '#1e5a6a', sash: '#d8b04a', sleeves: true, hood: '#1a4e5e' }, // (teal robes and hat, gold embroidery)
  elementalist: { shirt: '#8a2a12', robe: '#173a6e', trim: '#ffb040', pants: '#2a1a12', boots: '#2a1a12', sash: '#ff7a20', sleeves: true },
  enchanter: { shirt: '#7a2a8a', robe: '#5e1f70', trim: '#f0b8ff', pants: '#2a1a3a', boots: '#3a1a3a', shawl: '#e070c8', sash: '#f0b8ff', sleeves: true },
  druid: { shirt: '#5a3e22', robe: '#4a5a24', trim: '#9ad060', pants: '#3a3020', boots: '#4a3220', shawl: '#6a7a34', sash: '#8a6a3a', sleeves: true },
  shaman: { shirt: '#1e1e22', vest: '#7a1e1e', trim: '#e0c070', pants: '#1e1e22', boots: '#4a3220', belt: '#6b4a2a', shawl: '#8a6a44', sash: '#c04020', bracers: '#5a3a22' },
  cleric: { shirt: '#ece6d8', robe: '#f2ece0', trim: '#d8b04a', pants: '#d8d0c0', boots: '#8a6a3a', sash: '#d8b04a', sleeves: true },
  bard: { shirt: '#e6dab4', trim: '#4a7ac8', pants: '#6e5236', boots: '#4a3420', belt: '#3a2414', bracers: '#5a3a22', sleeves: true }, // (a cream collared shirt, brown trousers, tall studded boots)
  warrior: { shirt: '#3a3e44', mail: '#5e636c', tabard: '#2a2e34', trim: '#6e737c', pants: '#2a2a2e', boots: '#1e1e22', pauldrons: true, belt: '#2a2018', bracers: '#5e636c' }, // (dark steel, like the reference)
  paladin: { shirt: '#5a5a60', mail: '#6a6a70', tabard: '#e0b040', trim: '#f0d070', pants: '#4a4a50', boots: '#c8962a', pauldrons: true, belt: '#8a6a30', bracers: '#e0b040' }, // (gold plate over dark chainmail)
  darkknight: { shirt: '#1a1a1e', mail: '#24242a', tabard: '#4a0a0e', trim: '#8a1a1a', pants: '#141418', boots: '#0c0c0e', pauldrons: true, belt: '#1a0a0a', bracers: '#24242a' },
  berserker: { shirt: '#8a5a3a', vest: '#5a3a22', pants: '#3a2a1e', boots: '#3a2416', belt: '#2a1a10', bracers: '#5a3a22', bareArms: true, sash: '#9a2a1a' },
  monk: { shirt: '#d8a888', robe: '#efe6d4', pants: '#5a3418', boots: '#3a2a1a', sash: '#a01a1a', bareArms: true, belt: '#6a4020' }, // (a long saffron robe over dark trousers)
  rogue: { shirt: '#1e1c24', vest: '#2a2632', pants: '#18161c', boots: '#100e12', hood: '#16141a', mask: '#16141a', belt: '#3a1a2a', bracers: '#2a2632', cloak: '#141218' },
  ranger: { shirt: '#5a3f26', vest: '#6b4a2a', pants: '#3c4a2a', boots: '#4a3220', hood: '#2e5a26', cloak: '#2e5a26', quiver: true, belt: '#3a2a1a', bracers: '#5a3a22' },
  musketeer: { shirt: '#5a4a2a', vest: '#3a2c1c', trim: '#8a6a3a', pants: '#4a3a22', boots: '#2a1a10', belt: '#2a1a10', bracers: '#3a2c1c' }, // (a goblin sharpshooter's patched leathers)
  blunderbuss: { shirt: '#6a3a1a', vest: '#5a4a3a', trim: '#8a5a2a', pants: '#3a2a1a', boots: '#2a1a10', belt: '#3a2a1a', bracers: '#6a5a4a' }, // (a goblin bruiser in scrap and leather)
  priest: { shirt: '#f6f0e2', robe: '#f8f2e4', trim: '#e8b84a', pants: '#e8e0cc', boots: '#c8a060', shawl: '#e8b84a', sash: '#e8b84a', sleeves: true, belt: '#c89a40' }, // (white and gold robes of the dawn)
  bombardier: { shirt: '#6a3a22', vest: '#4a3a26', trim: '#c86a2a', pants: '#4a3a24', boots: '#2a1a10', belt: '#2a1a10', bracers: '#5a4a3a' }, // (a goblin sapper's scorched leathers)
  beastmaster: { shirt: '#4a3a28', vest: '#6a5034', pants: '#3c3024', boots: '#3a2416', belt: '#2a1a10', bracers: '#6a5034', bareArms: true },
};
export function arenaSpec(cls) { return SPEC[cls] || null; }
// each class's build (see BODY in character.js): brutes, knights, heavies, athletes, lean casters, sturdy priests
const BUILD = { berserker: 'brute', beastmaster: 'brute', warrior: 'knight', paladin: 'knight', darkknight: 'knight', blunderbuss: 'heavy', shaman: 'heavy',
  rogue: 'athlete', ranger: 'athlete', monk: 'lean', musketeer: 'lean', bard: 'athlete', wizard: 'lean', necromancer: 'lean', enchanter: 'lean', elementalist: 'lean', cleric: 'sturdy', druid: 'sturdy', priest: 'lean', bombardier: 'lean' };
export function arenaBody(cls) { return BUILD[cls] || 'athlete'; }

// ---- signature pieces ----
const bone = () => M('#e6dcc4', 0.6), iron = (c = '#3a3a40') => M(c, 0.4, 0.85), gold = () => M('#d8b04a', 0.35, 0.85), fur = (c) => M(c, 1);
function skullFace(hg) { // a bone skull mask: a heavy brow over deep black sockets, sharp cheekbones, teeth, a black drip down the jaw
  const b = M('#d8ccae', 0.55), bd = M('#9a8e70', 0.7), dk = GL('#050505');
  const g = new THREE.SphereGeometry(0.118, 22, 16), P = g.attributes.position; for (let i = 0; i < P.count; i++) { let x = P.getX(i), y = P.getY(i), z = P.getZ(i); const ny = y / 0.118; x *= 0.92; if (ny < -0.1) { x *= 1 - 0.3 * (-ny - 0.1); z *= 1 - 0.15 * (-ny); } if (z > 0.06 && ny > 0.05 && ny < 0.4) z += 0.008; P.setXYZ(i, x, y * 1.04, z); } g.computeVertexNormals(); add(hg, g, b, 0, 0.11, 0.015);
  add(hg, boxG(0.17, 0.03, 0.05), b, 0, 0.145, 0.088).rotation.x = -0.2; // (the brow ridge)
  for (const x of [-0.042, 0.042]) { const so = add(hg, sph(0.034, 12, 10), dk, x, 0.112, 0.092); so.scale.set(1.05, 0.9, 0.7); add(hg, sph(0.012, 8, 6), GL('#8aff5a'), x, 0.11, 0.112); add(hg, sph(0.026, 8, 6), new THREE.MeshBasicMaterial({ color: '#5aff3a', transparent: true, opacity: 0.25, depthWrite: false }), x, 0.11, 0.118); const ck = add(hg, sph(0.024, 8, 6), b, x * 1.7, 0.075, 0.08); ck.scale.set(1.2, 0.7, 0.8); }
  { const ns = add(hg, coneG(0.018, 0.036, 3), dk, 0, 0.075, 0.118); ns.rotation.x = Math.PI; }
  add(hg, boxG(0.1, 0.03, 0.04), bd, 0, 0.042, 0.095); for (let i = 0; i < 8; i++) { add(hg, boxG(0.01, 0.022, 0.012), b, -0.035 + i * 0.01, 0.048, 0.112); add(hg, boxG(0.01, 0.02, 0.012), b, -0.035 + i * 0.01, 0.024, 0.11); } // (upper and lower teeth)
  const jaw = add(hg, boxG(0.11, 0.035, 0.08), b, 0, 0.005, 0.07); jaw.rotation.x = 0.15; for (const x of [-0.02, 0.012]) add(hg, boxG(0.008, 0.06, 0.006), dk, x, -0.02, 0.112); // (a black drip down the jaw)
}
function hideHair(ch) { ch.headG.traverse(o => { if (o.isMesh && o.material === ch.mats.hair) o.visible = false; }); }
function horns(hg, c = '#e8dcc0', big = 1) { const m = M(c, 0.45); for (const s of [-1, 1]) { const pts = []; for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push(new THREE.Vector3(s * (0.11 + t * 0.2 * big - t * t * 0.06 * big), 0.15 + t * 0.12 * big + t * t * 0.1 * big, -0.02 - t * 0.04 * big + t * t * 0.1 * big)); } // (a horn that sweeps out, up and curls forward, thick at the root, tapering to a point)
    const curve = new THREE.CatmullRomCurve3(pts); for (let k = 0; k < 12; k++) { const t0 = k / 12, t1 = (k + 1) / 12, a = curve.getPoint(t0), b = curve.getPoint(t1), r0 = 0.036 * big * (1 - t0 * 0.92), r1 = 0.036 * big * (1 - t1 * 0.92); const seg = add(hg, cylG(r1, r0, a.distanceTo(b) * 1.08, 10), m, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); if (k % 3 === 1) { const rg = add(hg, new THREE.TorusGeometry(r0 * 1.02, r0 * 0.12, 4, 12), M('#00000022'.slice(0, 7), 0.6), a.x, a.y, a.z); rg.quaternion.copy(seg.quaternion); rg.rotateX(Math.PI / 2); rg.material = m; } } } }
function helm(hg, col, open = false) { const m = iron(col), oy = open ? 0.045 : 0; const h = add(hg, sph(0.142, 16, 12), m, 0, 0.1 + oy, 0); h.geometry = new THREE.SphereGeometry(0.142, 16, 12, 0, Math.PI * 2, 0, Math.PI * (open ? 0.5 : 0.62)); // (an open helm sits above the brows, so the face shows)
  if (!open) { const face = add(hg, cylG(0.135, 0.13, 0.13, 16, 1, true), m, 0, 0.05, 0); face.geometry = new THREE.CylinderGeometry(0.135, 0.128, 0.13, 16, 1, true, -Math.PI * 0.85, Math.PI * 1.7); face.material = m.clone(); face.material.side = THREE.DoubleSide; add(hg, boxG(0.16, 0.012, 0.02), GL('#050505'), 0, 0.09, 0.132); add(hg, boxG(0.012, 0.07, 0.02), m, 0, 0.05, 0.135); }
  add(hg, cylG(0.146, 0.146, 0.022, 18), m, 0, 0.11 + oy, 0); for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; add(hg, sph(0.008, 5, 4), M('#c8a050', 0.35, 0.85), Math.sin(a) * 0.149, 0.11 + oy, Math.cos(a) * 0.149); }
  { const mail = M('#4a4c52', 0.55, 0.75), g2 = new THREE.CylinderGeometry(0.135, 0.165, 0.15, 20, 3, true, open ? Math.PI * 0.32 : 0, open ? Math.PI * 1.36 : Math.PI * 2); const P2 = g2.attributes.position; for (let i = 0; i < P2.count; i++) P2.setX(i, P2.getX(i) + Math.sin(P2.getY(i) * 90) * 0.002); g2.computeVertexNormals(); const av = add(hg, g2, mail, 0, 0.0, -0.008); av.material = mail.clone(); av.material.side = THREE.DoubleSide; } // (a mail neck guard hanging from the helm: covers the neck, sits on the shoulders)
  if (open) for (const s of [-1, 1]) { const ck = add(hg, boxG(0.02, 0.1, 0.07), m, s * 0.13, 0.05, 0.05); ck.rotation.set(0.15, s * -0.35, s * 0.08); } // (cheek guards)
  else { add(hg, boxG(0.016, 0.16, 0.03), m, 0, 0.17, 0.12).rotation.x = 0.5; for (let k = 0; k < 5; k++) add(hg, cylG(0.004, 0.004, 0.02, 4), GL('#050505'), -0.03 + k * 0.015, 0.025, 0.133).rotation.x = Math.PI / 2; } // (a ridge over the crown, breathing holes)
  return m; }
function mantle(ch, c, r = 0.2) { const f = fur(c), R2 = ch.R, th = R2.torsoH - 0.2, T = R2.thick, g = new THREE.Group(); ch.chest.add(g);
  for (const s of [-1, 1]) { const p2 = add(g, sph(0.075 * Math.min(T, 1.2), 12, 8), f, s * R2.sw * 0.66, th + 0.01, -0.01); p2.scale.set(1.3, 0.45, 1.15); for (let k = 0; k < 6; k++) { const tf = add(g, coneG(0.022, 0.09, 4), f, s * (R2.sw * 0.45 + k * 0.035), th - 0.03, 0.04 - (k % 2) * 0.08); tf.rotation.set(Math.PI + (k % 2 ? 0.3 : -0.3), 0, s * 0.3); } }
  const back = add(g, sph(0.085 * Math.min(T, 1.2), 12, 8), f, 0, th + 0.01, -0.085 * T); back.scale.set(2.0, 0.65, 0.7); return g; } // (a pelt over the shoulders and a ruff of fur behind the neck)
function shoulderSpikes(ch, m, n = 3) { for (const s of [-1, 1]) { const g = new THREE.Group(); g.position.set(s * (ch.R.sw + 0.02), ch.R.torsoH - 0.2, 0); ch.chest.add(g); add(g, sph(0.09, 12, 8), m).scale.set(1, 0.7, 1.1); for (let k = 0; k < n; k++) { const sp = add(g, coneG(0.022, 0.12, 6), m, s * 0.03, 0.06, -0.04 + k * 0.04); sp.rotation.z = -s * 0.5; } } }
function backItem(ch, obj, y = 0.05) { obj.position.set(0, ch.R.torsoH * 0.5 + y, -0.17); ch.chest.add(obj); return obj; }

// ---- general kit: plate, leather and cloth pieces that give every body more detail ----
function breastplate(ch, m, trim) { const R = ch.R, th = R.torsoH - 0.2, T = R.thick; const b = add(ch.chest, sph(0.2, 18, 12), m, 0, th * 0.55, 0.035); b.scale.set(R.sw / 0.2 * 1.02, th / 0.2 * 0.62, 0.78 * T); b.geometry = new THREE.SphereGeometry(0.2, 18, 12, -Math.PI * 0.5, Math.PI, 0, Math.PI);
  if (trim) { const r = add(ch.chest, new THREE.TorusGeometry(0.17, 0.012, 6, 20, Math.PI), trim, 0, th * 0.18, 0.08); r.scale.set(R.sw / 0.2, 1, 1); r.rotation.x = Math.PI / 2 + 0.25; r.rotation.z = Math.PI; }
  add(ch.spine, cylG(0.16 * T, 0.15 * T, 0.12, 16), m, 0, 0.0, 0).scale.z = 0.8; }
function pauldrons(ch, m, size = 1) { for (const sd of ['L', 'R']) { const p = add(ch.arms[sd].sh, sph(0.1 * size, 14, 10), m, 0, 0.01, 0); p.geometry = new THREE.SphereGeometry(0.1 * size, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55); p.scale.set(1.15, 0.9, 1.1);
  const p2 = add(ch.arms[sd].sh, sph(0.085 * size, 12, 8), m, 0, -0.05, 0); p2.geometry = new THREE.SphereGeometry(0.085 * size, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5); p2.scale.set(1.1, 0.7, 1.05); } }
// gloved hands: the hero hand's fingers take the glove's material (nails hidden); a plain hand gets a mitten
function handMeshes(ch, sd) { const h = ch.arms[sd].hand, out = []; for (const o of h.children) if (o.isMesh && (o.material === ch.mats.skin || o.userData.nail)) out.push(o); return out; }
function gloveHand(ch, sd, m, armour) { const hm = handMeshes(ch, sd); if (hm.length < 10) return false;
  for (const o of hm) { if (o.userData.nail) { o.visible = false; continue; } o.material = m; }
  if (armour) { const h = ch.arms[sd].hand, s = sd === 'L' ? 1 : -1; const kp = add(h, boxG(0.016, 0.03, 0.064), m, s * 0.014, -0.07, 0.003); kp.rotation.x = 0; for (let i = 0; i < 4; i++) add(h, sph(0.008, 6, 4), m, s * 0.02, -0.074, 0.022 - i * 0.0145); add(h, boxG(0.012, 0.05, 0.058), m, s * 0.014, -0.035, 0.003); }
  return true; }
function gauntlets(ch, m, cuff = true) { const fa = ch.R.armL * 0.46, T = ch.R.thick; for (const sd of ['L', 'R']) { const el = ch.arms[sd].el; add(el, cylG(0.05 * T, 0.058 * T, fa * 0.5, 12), m, 0, -fa * 0.68, 0); if (cuff) add(el, cylG(0.068 * T, 0.06 * T, 0.05, 12), m, 0, -fa * 0.44, 0); if (!gloveHand(ch, sd, m, m.metalness > 0.5)) add(ch.arms[sd].hand, sph(0.052, 10, 8), m, 0, -0.045, 0.005).scale.set(0.9 * Math.min(1.4, T), 1.2, 0.68 * Math.min(1.4, T)); } }
function gloves(ch, c) { const m = M(c, 0.8); for (const sd of ['L', 'R']) if (!gloveHand(ch, sd, m, false)) add(ch.arms[sd].hand, sph(0.051, 10, 8), m, 0, -0.045, 0.005).scale.set(0.88 * Math.min(1.4, ch.R.thick), 1.22, 0.64 * Math.min(1.4, ch.R.thick)); }
function greaves(ch, m) { const sl = ch.R.legL * 0.47, T = ch.R.thick; for (const sd of ['L', 'R']) { const k = ch.legs[sd].knee; add(k, cylG(0.058 * T, 0.068 * T, sl * 0.62, 12), m, 0, -sl * 0.42, 0.006); add(k, sph(0.055 * T, 10, 8), m, 0, 0, 0.03).scale.set(1, 0.9, 0.8); } }
function bootCuffs(ch, c) { const sl = ch.R.legL * 0.47, T = ch.R.thick, m = M(c, 0.85); for (const sd of ['L', 'R']) add(ch.legs[sd].knee, cylG(0.074 * T, 0.068 * T, 0.07, 12), m, 0, -sl * 0.3, 0); }
function belt(ch, c, buckle = '#c9a14a', pouches = 0) { const T = ch.R.thick, m = M(c, 0.7), b = add(ch.hips, new THREE.TorusGeometry(0.16 * T, 0.022, 6, 22), m, 0, 0.1, 0); b.rotation.x = Math.PI / 2; b.scale.set(1, 0.78, 1);
  add(ch.hips, boxG(0.06, 0.045, 0.02), M(buckle, 0.35, 0.8), 0, 0.1, 0.13 * T);
  for (let i = 0; i < pouches; i++) { const a = 0.9 + i * 0.6; add(ch.hips, boxG(0.06, 0.07, 0.04), M('#5a3a22', 0.85), Math.sin(a) * 0.16 * T, 0.06, Math.cos(a) * 0.12 * T); } }
function robeTrim(ch, c) { const m = M(c, 0.45, 0.6), T = ch.R.thick, L = ch.R.legL; const st = add(ch.hips, boxG(0.05, L - 0.05, 0.01), m, 0, -L / 2 + 0.07, 0.17 * T); st.rotation.x = -0.06;
  const hem = add(ch.hips, new THREE.TorusGeometry(0.245 * T, 0.012, 5, 28), m, 0, -L + 0.06, 0); hem.rotation.x = Math.PI / 2; hem.scale.set(1, 0.8, 1); add(ch.chest, boxG(0.045, (ch.R.torsoH - 0.2) * 0.9, 0.01), m, 0, (ch.R.torsoH - 0.2) * 0.45, 0.14 * T); }
function straps(ch, c) { const m = M(c, 0.8), th = ch.R.torsoH - 0.2; for (const s of [-1, 1]) { const b = add(ch.chest, boxG(0.03, th * 1.15, 0.012), m, 0, th * 0.5, 0.135 * ch.R.thick); b.rotation.z = s * 0.55; } }
const steel = (c = '#a8aeb6') => M(c, 0.35, 0.85);
const DETAIL = {
  warrior(ch) { const m = steel('#5e636c'); breastplate(ch, m, steel('#3a3e44')); gauntlets(ch, m); greaves(ch, m); belt(ch, '#3a2416'); },
  paladin(ch) { const m = M('#d8b04a', 0.28, 0.9), g = M('#f6e8b8', 0.3, 0.8); breastplate(ch, m, g); gauntlets(ch, m); greaves(ch, m); belt(ch, '#8a6a30', '#f0d070'); },
  darkknight(ch) { const m = steel('#26262c'); breastplate(ch, m, M('#7a1010', 0.5, 0.5)); gauntlets(ch, m); greaves(ch, m); belt(ch, '#1a0a0a', '#7a1010'); },
  berserker(ch) { gauntlets(ch, fur('#5a3a22')); straps(ch, '#3a2416'); belt(ch, '#3a2416', '#9aa0a8', 1); bootCuffs(ch, '#6a4a2a'); },
  blunderbuss(ch) { gloves(ch, '#5a3a1a'); belt(ch, '#3a2a1a', '#8a6a3a', 3); bootCuffs(ch, '#2a1a10'); },
  musketeer(ch) { gloves(ch, '#3a2a1a'); belt(ch, '#2a1a10', '#8a6a3a', 2); bootCuffs(ch, '#2a1a10'); },
  ranger(ch) { gauntlets(ch, M('#5a3a22', 0.85), false); belt(ch, '#3a2a1a', '#9aa0a8', 2); bootCuffs(ch, '#4a3220'); },
  rogue(ch) { gauntlets(ch, M('#2a2632', 0.8), false); belt(ch, '#3a1a2a', '#9aa0a8', 3); bootCuffs(ch, '#100e12'); straps(ch, '#100e12'); },
  monk(ch) { const red = M('#9a1a1a', 0.9), dk = M('#3a0e0e', 0.9); for (const sd of ['L', 'R']) { const fa = ch.R.armL * 0.46; add(ch.arms[sd].el, cylG(0.05, 0.054, fa * 0.62, 12), red, 0, -fa * 0.62, 0); for (let k = 0; k < 4; k++) add(ch.arms[sd].el, cylG(0.055, 0.055, 0.008, 12), dk, 0, -fa * (0.36 + k * 0.13), 0); } // (red-wrapped forearms)
    ch.mats.shirt.color.copy(ch.mats.skin.color); ch.mats.shirt.roughness = ch.mats.skin.roughness; // (bare chest: the robe only covers one shoulder)
    const wht = M('#efe6d6', 0.85, 0, { side: THREE.DoubleSide }), gld = gold(), th = ch.R.torsoH - 0.2, T = ch.R.thick;
    const dr = add(ch.chest, boxG(0.13, th * 1.35, 0.02), wht, 0.03, th * 0.45, 0.13 * T); dr.rotation.z = -0.55; for (const ex of [-0.065, 0.065]) add(dr, boxG(0.008, th * 1.35, 0.022), gld, ex, 0, 0.003); // (the robe across the chest, over the left shoulder, gold-edged)
    const bk = add(ch.chest, boxG(0.13, th * 1.35, 0.02), wht, 0.03, th * 0.45, -0.12 * T); bk.rotation.z = 0.55;
    const sp2 = add(ch.arms.L.sh, sph(0.085 * T, 12, 8), wht, 0.0, 0.0, 0); sp2.scale.set(1.1, 0.9, 1.1); // (the robe over the left shoulder)
    const bl = add(ch.hips, new THREE.TorusGeometry(0.165 * T, 0.04, 6, 24), M('#6a4020', 0.6), 0, 0.12, 0); bl.rotation.x = Math.PI / 2; bl.scale.set(1, 0.78, 1.4); add(ch.hips, cylG(0.04, 0.04, 0.02, 16), M('#7a2a1a', 0.5, 0.3), 0.06, 0.12, 0.15).rotation.x = Math.PI / 2; add(ch.hips, cylG(0.016, 0.016, 0.024, 10), GL('#e04020'), 0.06, 0.12, 0.162).rotation.x = Math.PI / 2; }, // (a wide leather belt with a round medallion)
  beastmaster(ch) { gauntlets(ch, fur('#7a7a80')); belt(ch, '#2a1a10', '#e6dcc4', 2); bootCuffs(ch, '#7a7a80'); },
  bard(ch) { gloves(ch, '#5a3220'); belt(ch, '#3a2010', '#f0d070', 1); bootCuffs(ch, '#5a3220'); },
  necromancer(ch) { robeTrim(ch, '#4a4a50'); gloves(ch, '#141216'); belt(ch, '#1a1418', '#8a8a90', 1); },
  wizard(ch) { robeTrim(ch, '#e0b84a'); gloves(ch, '#2a2a40'); belt(ch, '#3a2a1a', '#e0b84a', 1); const bk = add(ch.hips, boxG(0.09, 0.12, 0.04), M('#6a1a1a', 0.8), -0.15, 0.0, 0.05); bk.rotation.y = 0.5; },
  elementalist(ch) { robeTrim(ch, '#ffb040'); gloves(ch, '#2a1a12'); belt(ch, '#2a1a12', '#ff7a20', 1); },
  enchanter(ch) { robeTrim(ch, '#f0b8ff'); gloves(ch, '#3a1a3a'); belt(ch, '#3a1a3a', '#f0b8ff', 0); },
  druid(ch) { robeTrim(ch, '#9ad060'); belt(ch, '#5a3a1a', '#9ad060', 2); },
  shaman(ch) { gauntlets(ch, M('#5a3a22', 0.85), false); belt(ch, '#6b4a2a', '#e6dcc4', 2); bootCuffs(ch, '#7a5a3a'); },
  priest(ch) { robeTrim(ch, '#e8b84a'); gloves(ch, '#f4ecd8'); belt(ch, '#c89a40', '#fff0b0', 1); },
  bombardier(ch) { gloves(ch, '#4a3020'); belt(ch, '#2a1a10', '#8a6a3a', 2); bootCuffs(ch, '#3a2a1a'); },
  cleric(ch) { robeTrim(ch, '#d8b04a'); gloves(ch, '#f4f0e6'); belt(ch, '#d8b04a', '#f0d070', 0); },
};
const DECOR = {
  necromancer(ch) { // a shrunken head in the left hand (its stitched mouth sprays poison), a belt of skulls, burning green eyes
    { const dg = makeShrunkenHead(); ch.arms.L.grip.add(dg); ch.dangle = dg; ch.headMouthObj = dg.userData.mouth; } // (held by its ponytail, swinging under his fist)
    { for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2, r = 0.19 * ch.R.thick, sk2 = new THREE.Group(); sk2.position.set(Math.sin(a) * r, 0.04, Math.cos(a) * r * 0.85); sk2.rotation.y = a; ch.hips.add(sk2); const b = bone(); add(sk2, sph(0.045, 8, 6), b).scale.set(0.9, 1, 1); for (const x of [-0.015, 0.015]) add(sk2, sph(0.01, 5, 4), GL('#6aff5a'), x, 0.005, 0.04); } }
    skullFace(ch.headG); hideHair(ch); bigPauldrons(ch, iron('#2a2a30'), 1.15, M('#9a8e70', 0.6), 2); { const sk = new THREE.Group(); sk.position.set(0.06, -0.08, 0.02); ch.arms.L.sh.add(sk); const b2 = M('#d8ccae', 0.55); add(sk, sph(0.04, 10, 8), b2).scale.set(0.9, 1, 1); for (const x of [-0.015, 0.015]) add(sk, sph(0.011, 6, 5), GL('#050505'), x, 0.005, 0.034); add(sk, boxG(0.045, 0.025, 0.03), b2, 0, -0.032, 0.01); } const b = bone(); for (let k = 0; k < 5; k++) add(ch.chest, sph(0.022, 8, 6), b, -0.08 + k * 0.04, ch.R.torsoH - 0.13, 0.12 - Math.abs(k - 2) * 0.012); },
  wizard(ch) { const hat = ch.outfit && ch.outfit.hat; if (hat) { const g = gold(); for (let k = 0; k < 6; k++) { const a = k * 1.1, y = 0.05 + k * 0.05; add(hat, sph(0.014, 6, 4), g, Math.sin(a) * (0.1 - k * 0.012), y, Math.cos(a) * (0.1 - k * 0.012)); } }
    const bm = M('#2a2420', 0.95); const bd = add(ch.headG, coneG(0.085, 0.32, 12), bm, 0, -0.1, 0.07); bd.rotation.x = Math.PI + 0.22; bd.scale.z = 0.6; for (const s of [-1, 1]) add(ch.headG, boxG(0.05, 0.012, 0.016), bm, s * 0.026, 0.052, 0.108).rotation.z = s * -0.3; // (a long dark beard and moustache)
    if (hat) { const band = add(hat, new THREE.TorusGeometry(0.12, 0.014, 6, 24), gold(), 0, 0.02, 0); band.rotation.x = Math.PI / 2; for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; add(hat, sph(0.014, 8, 6), M(k % 2 ? '#3ab8c8' : '#d8b04a', 0.3, 0.6), Math.sin(a) * 0.125, 0.02, Math.cos(a) * 0.125); } } // (a jewelled hat band)
    for (const s of [-1, 1]) { const lp = add(ch.chest, boxG(0.06, ch.R.torsoH * 0.7, 0.012), gold(), s * 0.06, ch.R.torsoH * 0.42, 0.135); lp.rotation.z = s * 0.25; } // (gold-embroidered lapels)
  }, // (his spellbook is his weapon: arenaWeaponDecor puts it in his right hand)
  elementalist(ch) { const crown = new THREE.Group(); crown.position.set(0, 0.2, 0); ch.headG.add(crown); add(crown, new THREE.TorusGeometry(0.11, 0.012, 6, 18), gold()).rotation.x = Math.PI / 2;
    for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; add(crown, coneG(0.018, 0.08, 6), GL(k % 2 ? '#ffb040' : '#ff6020'), Math.sin(a) * 0.11, 0.04, Math.cos(a) * 0.11); }
    const orbs = new THREE.Group(); orbs.position.set(0, ch.R.torsoH - 0.05, 0); ch.chest.add(orbs); ch.arenaSpin = orbs; for (const [c, a] of [['#ff6020', 0], ['#60c8ff', 2.1], ['#e0e070', 4.2]]) add(orbs, sph(0.05, 10, 8), GL(c), Math.sin(a) * 0.36, 0.05, Math.cos(a) * 0.36); },
  enchanter(ch) { const c = add(ch.headG, new THREE.TorusGeometry(0.128, 0.01, 6, 20), gold(), 0, 0.15, 0); c.rotation.x = Math.PI / 2 - 0.15; add(ch.headG, sph(0.022, 10, 8), GL('#ff70e0'), 0, 0.16, 0.13);
    const r = new THREE.Group(); backItem(ch, r, 0.25); ch.arenaSpin = r; for (const rad of [0.3, 0.22]) add(r, new THREE.TorusGeometry(rad, 0.008, 4, 32), GL('#f0a0ff')); },
  druid(ch) { hideHair(ch); const hg = ch.headG, leafs = [M('#5a7a2a', 0.85), M('#7a6a2a', 0.85), M('#4a5a20', 0.85), M('#8a7a3a', 0.85)], twig = M('#5a3a1e', 0.9);
    for (let k = 0; k < 46; k++) { const a = Math.random() * Math.PI * 2, up = 0.2 + Math.random() * 0.9, n = new THREE.Vector3(Math.cos(a) * Math.cos(up * 0.9), Math.sin(up) * 0.9 + 0.1, Math.sin(a) * Math.cos(up * 0.9) - 0.25).normalize(); if (n.z > 0.55 && n.y < 0.5) continue; // (keep the face clear)
      const lf = add(hg, coneG(0.03, 0.15 + Math.random() * 0.1, 4), leafs[k % 4], n.x * 0.12, 0.1 + n.y * 0.12, n.z * 0.12); lf.scale.z = 0.3; lf.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n.clone().add(new THREE.Vector3(0, 0.4, 0)).normalize()); }
    for (let k = 0; k < 8; k++) { const a = 0.6 + k * 0.7, tw = add(hg, cylG(0.004, 0.008, 0.16, 4), twig, Math.cos(a) * 0.1, 0.24, Math.sin(a) * 0.08 - 0.03); tw.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6); } // (wild hair woven with leaves and twigs)
    add(ch.chest, sph(0.02, 8, 6), GL('#6aff8a'), 0, ch.R.torsoH - 0.2, 0.14); // (a green gem at the throat)
    for (const s of [-1, 1]) for (let k = 0; k < 7; k++) { const lf = add(ch.arms[s < 0 ? 'R' : 'L'].sh, coneG(0.04, 0.16, 4), leafs[k % 4], s * (0.02 + k * 0.012), 0.05 - k * 0.012, -0.05 + k * 0.018); lf.scale.z = 0.3; lf.rotation.set(0.3, 0, s * (-1.2 + k * 0.12)); } }, // (leafy shoulder mantles)
  shaman(ch) { const hg = ch.headG, red = M('#8a1a1a', 0.8), turq = M('#3ab8b0', 0.4, 0.3), white = M('#ece4d0', 0.85), black = M('#1a1a1a', 0.85), gold2 = gold();
    const band = add(hg, new THREE.TorusGeometry(0.13, 0.02, 6, 24), red, 0, 0.15, 0); band.rotation.x = Math.PI / 2; for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; add(hg, boxG(0.014, 0.014, 0.008), [gold2, turq, red][k % 3], Math.sin(a) * 0.15, 0.15, Math.cos(a) * 0.15); } add(hg, sph(0.022, 10, 8), turq, 0, 0.15, 0.155).scale.z = 0.5; // (a beaded headband with a turquoise stone)
    add(hg, sph(0.13, 14, 10), red, 0, 0.17, -0.02).scale.set(1, 0.55, 1.05); // (a red cap)
    for (let k = 0; k < 13; k++) { const a = -1.2 + k * 0.2, c2 = k % 4 === 0 ? black : k % 4 === 2 ? white : red, f = add(hg, coneG(0.03, 0.3 + (1 - Math.abs(k - 6) / 6) * 0.14, 4), c2, Math.sin(a) * 0.08, 0.3 + Math.cos(a) * 0.05, -0.08 - Math.cos(a) * 0.02); f.scale.z = 0.25; f.rotation.set(-0.45, 0, -a * 0.5); } // (a crest of red, black and white feathers)
    for (const s of [-1, 1]) { const by = add(hg, sph(0.05, 8, 6), M('#2a6aa0', 0.6), s * 0.034, 0.112, 0.085); by.scale.set(1.2, 0.5, 0.35); for (let k = 0; k < 2; k++) add(hg, boxG(0.04, 0.007, 0.004), red, s * 0.045, 0.07 - k * 0.018, 0.1).rotation.z = s * (0.4 + k * 0.3); } // (blue paint across the eyes, red marks on the cheeks)
    for (const s of [-1, 1]) { for (let k = 0; k < 4; k++) add(hg, sph(0.016 - k * 0.002, 6, 5), M('#6a2a1a', 0.8), s * 0.11, 0.0 - k * 0.04, -0.01).scale.y = 1.4; add(hg, coneG(0.012, 0.06, 4), white, s * 0.115, -0.17, 0.0).rotation.x = Math.PI; } // (braids with feather tips)
    const col = add(ch.chest, new THREE.CylinderGeometry(ch.R.sw * 0.5, ch.R.sw * 1.05, 0.14, 20, 1, true), white, 0, ch.R.torsoH - 0.2, 0); col.material = white.clone(); col.material.side = THREE.DoubleSide; col.scale.z = 0.7; for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; add(ch.chest, boxG(0.04, 0.02, 0.006), turq, Math.sin(a) * ch.R.sw * 1.12, ch.R.torsoH - 0.26, Math.cos(a) * ch.R.sw * 0.8).rotation.set(0, a, k % 2 ? 0.6 : -0.6); } // (a white shawl collar with turquoise zig-zags)
    for (let k = 0; k < 12; k++) add(ch.chest, sph(0.014, 6, 5), [turq, red, white, gold2][k % 4], -0.1 + Math.sin(k / 11 * Math.PI) * 0 + k * 0.018, ch.R.torsoH - 0.32 - Math.sin(k / 11 * Math.PI) * 0.06, 0.13); add(ch.chest, boxG(0.04, 0.05, 0.01), turq, 0, ch.R.torsoH - 0.42, 0.14); // (bead necklaces and a pendant)
    add(ch.hips, boxG(0.06, 0.05, 0.02), turq, 0, 0.1, 0.18).rotation.z = Math.PI / 4; const lp = add(ch.hips, boxG(0.16, ch.R.legL * 0.75, 0.01), white, 0, -ch.R.legL * 0.35, 0.17); for (let k = 0; k < 3; k++) add(lp, boxG(0.12 - k * 0.03, 0.02, 0.004), k % 2 ? red : turq, 0, 0.1 - k * 0.12, 0.007); }, // (a turquoise buckle and a patterned loincloth)
  cleric(ch) { const w = M('#f4f0e6', 0.8), g = gold(); const mit = add(ch.headG, coneG(0.115, 0.3, 4), w, 0, 0.32, 0); mit.scale.z = 0.55; add(ch.headG, boxG(0.02, 0.12, 0.01), g, 0, 0.32, 0.065); add(ch.headG, boxG(0.07, 0.02, 0.01), g, 0, 0.34, 0.065); add(ch.headG, cylG(0.122, 0.122, 0.04, 16), g, 0, 0.18, 0);
    const halo = add(ch.chest, new THREE.TorusGeometry(0.24, 0.012, 6, 30), GL('#fff0a0'), 0, ch.R.torsoH + 0.35, -0.2); },
  bard(ch) { ch.mats.hair.color.set('#b8b4ae'); // (short silver-grey hair)
    for (const sd of ['L', 'R']) { const sx = sd === 'L' ? 1 : -1, th = ch.legs[sd].thigh, kn = ch.legs[sd].knee, tl = ch.R.legL * 0.5, sl = ch.R.legL * 0.47; add(th, boxG(0.012, tl * 0.95, 0.012), M('#c8562a', 0.7), sx * 0.085 * ch.R.thick, -tl * 0.5, 0); add(kn, boxG(0.012, sl * 0.4, 0.012), M('#c8562a', 0.7), sx * 0.07 * ch.R.thick, -sl * 0.2, 0); for (let k = 0; k < 6; k++) add(kn, sph(0.008, 5, 4), gold(), sx * 0.062 * ch.R.thick, -sl * (0.5 + k * 0.07), 0.02); } // (an orange stripe down the trousers, gold studs up the boots)
    for (const s of [-1, 1]) { const cl = add(ch.chest, boxG(0.07, 0.04, 0.01), M('#e6dab4', 0.85), s * 0.05, ch.R.torsoH - 0.2, 0.12); cl.rotation.set(-0.5, 0, s * 0.5); } // (the shirt collar)
    const lute = new THREE.Group(); backItem(ch, lute); lute.rotation.z = 0.6; const wd = M('#e8d2b0', 0.55), dk = M('#8a5a3a', 0.6); add(lute, sph(0.13, 16, 12), wd, 0, -0.1, 0).scale.set(1, 1.2, 0.45); add(lute, sph(0.04, 10, 8), GL('#2a1006'), 0, -0.08, 0.055).scale.z = 0.3; add(lute, boxG(0.04, 0.38, 0.03), wd, 0, 0.18, 0); for (let k = 0; k < 4; k++) { const sc = add(lute, coneG(0.03, 0.09, 5), wd, (k % 2 ? 1 : -1) * 0.03, 0.38 + k * 0.03, 0); sc.rotation.z = (k % 2 ? -1 : 1) * 1.1; } for (let k = 0; k < 4; k++) add(lute, boxG(0.002, 0.48, 0.002), GL('#e8e0c8'), -0.012 + k * 0.008, 0.08, 0.035); }, // (a pale, carved, ornate lute)
  warrior(ch) { const m = helm(ch.headG, '#6e737c'); hideHair(ch); const sp = add(ch.headG, coneG(0.012, 0.16, 6), m, 0, 0.32, 0.0); const hood = add(ch.headG, sph(0.175, 16, 12), M('#22262c', 0.9), 0, 0.05, -0.04); hood.geometry = new THREE.SphereGeometry(0.175, 16, 12, Math.PI * 0.5 + 0.9, Math.PI * 2 - 1.8, 0, Math.PI * 0.7); hood.material.side = THREE.DoubleSide; }, // (a closed great helm with a crest spike, a dark hood behind it)
  paladin(ch) { const m = helm(ch.headG, '#d8b04a'); m.color.set('#d8b04a'); m.metalness = 0.9; m.roughness = 0.28; hideHair(ch); horns(ch.headG, '#e8c060', 0.55); add(ch.headG, coneG(0.014, 0.14, 6), m, 0, 0.32, 0); // (a closed gold helm with small swept horns and a spike)
    const g = gold(); const sun = add(ch.chest, cylG(0.06, 0.06, 0.012, 16), g, 0, ch.R.torsoH - 0.24, 0.135); sun.rotation.x = Math.PI / 2; const ts = add(ch.hips, boxG(0.14, ch.R.legL * 0.62, 0.02), g, 0, -ch.R.legL * 0.24, 0.18 * ch.R.thick); ts.rotation.x = -0.06; add(ts, boxG(0.05, ch.R.legL * 0.5, 0.024), M('#f6e8b8', 0.3, 0.8), 0, 0, 0.002); for (const sd of ['L', 'R']) add(ch.legs[sd].knee, sph(0.07, 12, 10), g, 0, 0, 0.04).scale.set(1, 0.9, 0.85); },  // (a long ornate tasset down the front, gold knee cops)
  darkknight(ch) { const m = helm(ch.headG, '#1e1e24'); hideHair(ch); horns(ch.headG, '#1a1a1a', 1.1); ch.headG.traverse(o => { if (o.isMesh && o.material && o.material.color && o.material.color.getHex() === 0x050505) o.material = GL('#ff2a1a'); }); shoulderSpikes(ch, iron('#1e1e24'), 4); },
  berserker(ch) { const m = add(ch.headG, sph(0.14, 16, 12), iron('#6a6a70'), 0, 0.1, 0); m.geometry = new THREE.SphereGeometry(0.14, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55); horns(ch.headG, '#e8dcc0', 1.2); add(ch.headG, boxG(0.02, 0.09, 0.03), iron('#6a6a70'), 0, 0.09, 0.13); mantle(ch, '#6a4a2a', 0.21); },
  monk(ch) { hideHair(ch); { const red = M('#a81c1c', 0.85, 0, { side: THREE.DoubleSide }); ch.monkTails = []; for (const sx of [-1, 1]) { const pv = new THREE.Group(); pv.position.set(sx * 0.07, 0.02, -0.16 * ch.R.thick); ch.hips.add(pv); const tl = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.85, 1, 6), red); tl.position.y = -0.42; pv.add(tl); ch.monkTails.push(pv); } } /* (two long sash tails that stream behind him) */ const b = M('#5a2a10', 0.5); for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; add(ch.chest, sph(0.022, 8, 6), b, Math.sin(a) * 0.13, ch.R.torsoH - 0.12 - (Math.cos(a) > 0 ? Math.cos(a) * 0.08 : 0), Math.cos(a) * 0.1); }
    const hb = null && add(ch.headG, new THREE.TorusGeometry(0.125, 0.012, 6, 20), M('#a01a1a'), 0, 0.17, 0); },
  rogue(ch) { const m = M('#2a2632', 0.7); for (const s of [-1, 1]) { const d = add(ch.chest, boxG(0.02, 0.16, 0.03), M('#c8ccd2', 0.3, 0.9), s * 0.12, 0.05, 0.12); d.rotation.z = s * 0.4; } add(ch.headG, boxG(0.16, 0.025, 0.02), GL('#c03060'), 0, 0.105, 0.13).visible = false; },
  ranger(ch) { const lf = M('#3a6a2a', 0.9); shoulderSpikes(ch, M('#6b4a2a'), 0); for (let k = 0; k < 3; k++) { const f = add(ch.headG, coneG(0.015, 0.14, 4), M(k === 1 ? '#a02020' : '#e8e0c0'), 0.1, 0.22, -0.08 + k * 0.02); f.rotation.z = -0.6; f.scale.z = 0.3; } },
  musketeer(ch) { // a lanky goblin sharpshooter: long drooping ears, a hooked nose, a brass telescope monocle, a hood, glowing rounds
    hideHair(ch); const hg = ch.headG, skin = ch.mats.skin, dark = M('#2a1e12', 0.85), leather = M('#4a3a26', 0.8), brass = gold();
    for (const sx of [-1, 1]) { const e = new THREE.Group(); e.position.set(sx * 0.13, 0.03, -0.02); e.rotation.set(0.25, sx * 0.3, -sx * 1.25); hg.add(e); const c = add(e, coneG(0.055, 0.42, 8), skin, 0, 0.2, 0); c.scale.z = 0.35; const tip = new THREE.Group(); tip.position.y = 0.36; tip.rotation.x = 0.7; e.add(tip); add(tip, coneG(0.022, 0.12, 6), skin, 0, 0.05, 0); } // (long ears that droop at the tips)
    const nose = add(hg, coneG(0.03, 0.17, 8), skin, 0, -0.02, 0.16); nose.rotation.x = Math.PI / 2 + 0.5; add(hg, sph(0.022, 8, 6), skin, 0, -0.07, 0.2); // (a long hooked nose)
    for (const sx of [-1, 1]) { const ey = add(hg, sph(0.024, 8, 6), GL('#ffd23a'), sx * 0.05, 0.03, 0.125); ey.castShadow = false; }
    const mono = add(hg, cylG(0.034, 0.03, 0.09, 12), brass, 0.05, 0.03, 0.16); mono.rotation.x = Math.PI / 2; add(hg, new THREE.TorusGeometry(0.034, 0.008, 6, 16), brass, 0.05, 0.03, 0.205); add(hg, sph(0.028, 10, 8), GL('#9ae0ff'), 0.05, 0.03, 0.206).scale.z = 0.3; // (a brass telescope monocle)
    const hood = add(hg, sph(0.17), leather, 0, 0.06, -0.03); hood.geometry = new THREE.SphereGeometry(0.17, 16, 12, Math.PI * 0.5 + 0.95, Math.PI * 2 - 1.9, 0, Math.PI * 0.68); hood.material = leather.clone(); hood.material.side = THREE.DoubleSide; hood.scale.set(1.05, 1.08, 1.1); // (a patched hood, open at the front so the face shows)
    add(ch.chest, boxG(0.05, ch.R.torsoH * 1.05, 0.02), dark, 0, ch.R.torsoH * 0.5, 0.135).rotation.z = 0.55; for (let k = 0; k < 6; k++) { const v = add(ch.chest, cylG(0.012, 0.012, 0.05, 6), GL(k % 2 ? '#7aff5a' : '#9ae0ff'), -0.1 + k * 0.04, ch.R.torsoH * 0.32 + k * 0.05, 0.15); v.rotation.z = 0.55; v.castShadow = false; } // (a bandolier of glowing rounds)
    for (const [x, y, c] of [[0.08, 0.3, '#6a5a3a'], [-0.06, 0.15, '#5a6a3a']]) add(ch.chest, boxG(0.07, 0.06, 0.01), M(c, 0.85), x, ch.R.torsoH * y + 0.1, 0.14); }, // (patches)
  blunderbuss(ch) { // a squat goblin bruiser: tusks, a red mohawk, stubby ears, welding goggles, scrap-metal plates, a powder keg on his back
    hideHair(ch); const hg = ch.headG, skin = ch.mats.skin, rust = M('#7a4a2a', 0.6, 0.6), iron2 = M('#5a5a60', 0.45, 0.8), tusk = M('#efe6c8', 0.5);
    for (const sx of [-1, 1]) { const e = add(hg, coneG(0.05, 0.2, 8), skin, sx * 0.15, 0.03, -0.01); e.rotation.z = -sx * 1.4; e.scale.z = 0.4; const t = add(hg, coneG(0.022, 0.09, 6), tusk, sx * 0.05, -0.08, 0.12); t.rotation.x = -0.25; } // (stubby ears, tusks jutting up from the underbite)
    add(hg, boxG(0.16, 0.06, 0.1), skin, 0, -0.08, 0.08); // (the heavy jaw)
    for (let k = 0; k < 5; k++) add(hg, boxG(0.03, 0.08 + (k === 2 ? 0.04 : 0), 0.05), M('#c82a1a', 0.8), 0, 0.17 + (k === 2 ? 0.02 : 0), 0.08 - k * 0.05); // (a red mohawk)
    for (const sx of [-1, 1]) { add(hg, new THREE.TorusGeometry(0.035, 0.012, 6, 14), iron2, sx * 0.055, 0.12, 0.11).rotation.x = -0.6; add(hg, sph(0.03, 10, 8), GL('#3aa8ff'), sx * 0.055, 0.12, 0.112).scale.z = 0.3; } add(hg, new THREE.TorusGeometry(0.15, 0.012, 6, 24), M('#3a2a1a', 0.8), 0, 0.11, 0).rotation.x = Math.PI / 2 - 0.25; // (welding goggles pushed up)
    for (const sx of [-1, 1]) { const ey = add(hg, sph(0.022, 8, 6), GL('#ff9a1a'), sx * 0.05, 0.02, 0.125); ey.castShadow = false; }
    for (const [x, y, rz, w, h] of [[0.06, 0.62, 0.2, 0.16, 0.12], [-0.07, 0.45, -0.15, 0.14, 0.14], [0.04, 0.3, 0.1, 0.18, 0.1]]) { const p = add(ch.chest, boxG(w, h, 0.02), rust, x, ch.R.torsoH * y, 0.14); p.rotation.z = rz; for (const dx of [-1, 1]) add(p, sph(0.01, 5, 4), iron2, dx * w * 0.38, h * 0.3, 0.012); } // (scrap plates riveted on)
    { const pa = add(ch.arms.L.sh, sph(0.13, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), iron2, 0, 0.02, 0); for (let k = 0; k < 3; k++) add(pa, coneG(0.025, 0.14, 6), iron2, -0.04 + k * 0.04, 0.12, 0); } // (one big spiked pauldron)
    { const keg = add(ch.chest, cylG(0.13, 0.13, 0.3, 12), M('#7a4a22', 0.8), 0, ch.R.torsoH * 0.5, -0.24); keg.rotation.z = Math.PI / 2; for (const dx of [-0.1, 0.1]) { const b = add(keg, new THREE.TorusGeometry(0.135, 0.012, 6, 16), iron2, 0, dx, 0); b.rotation.x = Math.PI / 2; } add(keg, cylG(0.008, 0.008, 0.12, 4), M('#e8d8a0'), 0, 0.2, 0); } }, // (a powder keg on his back, fuse and all)
  priest(ch) { // a tall sunburst crown, a golden stole down the front, a sun disc floating behind the shoulders, a long white cape
    const g = gold(), w = M('#fbf6ea', 0.8), hg = ch.headG; add(hg, cylG(0.125, 0.12, 0.05, 20), g, 0, 0.17, 0);
    for (let k = 0; k < 11; k++) { const a = -Math.PI * 0.55 + k / 10 * Math.PI * 1.1, ray = add(hg, coneG(0.016, k === 5 ? 0.3 : 0.16 + (k % 2) * 0.06, 5), g, Math.sin(a) * 0.12, 0.22 + (k === 5 ? 0.1 : 0.04), Math.cos(a) * 0.1); ray.rotation.set(Math.cos(a) * 0.25, 0, -Math.sin(a) * 0.25); }
    add(hg, sph(0.03, 12, 8), GL('#fff4c0'), 0, 0.26, 0.11);
    for (const s of [-1, 1]) { const st = add(ch.chest, boxG(0.06, ch.R.torsoH * 1.2, 0.012), g, s * 0.06, ch.R.torsoH * 0.35, 0.14); st.rotation.z = s * 0.06; for (let k = 0; k < 3; k++) add(st, boxG(0.03, 0.006, 0.004), GL('#fffbe8'), 0, -0.12 + k * 0.1, 0.008); }
    const disc = new THREE.Group(); backItem(ch, disc, 0.3); ch.arenaSpin = disc; add(disc, new THREE.TorusGeometry(0.36, 0.02, 6, 40), GL('#ffe9a0')); add(disc, new THREE.TorusGeometry(0.28, 0.008, 4, 40), GL('#fff6d8'));
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, r = add(disc, boxG(0.012, k % 2 ? 0.1 : 0.16, 0.004), GL('#ffe080'), Math.sin(a) * 0.44, Math.cos(a) * 0.44, 0); r.rotation.z = -a; }
    const cape = add(ch.chest, boxG(ch.R.sw * 2.1, ch.R.torsoH + ch.R.legL * 0.9, 0.012), w, 0, ch.R.torsoH - 0.1 - (ch.R.torsoH + ch.R.legL * 0.9) / 2, -0.15); cape.rotation.x = 0.08; add(cape, boxG(ch.R.sw * 2.1, 0.03, 0.016), g, 0, -(ch.R.torsoH + ch.R.legL * 0.9) / 2 + 0.02, 0); },
  bombardier(ch) { // a wiry goblin sapper: huge flapping ears, a singed topknot, flight goggles, a bandolier of bombs, rocket boots, a smoking pack
    hideHair(ch); const hg = ch.headG, skin = ch.mats.skin, brass = gold(), iron2 = M('#3a3a40', 0.45, 0.8), leather = M('#5a3a22', 0.85);
    for (const sx of [-1, 1]) { const e = new THREE.Group(); e.position.set(sx * 0.13, 0.1, -0.01); e.rotation.set(-0.2, sx * 0.2, -sx * 1.05); hg.add(e); const c = add(e, coneG(0.07, 0.36, 8), skin, 0, 0.17, 0); c.scale.z = 0.3; add(e, coneG(0.045, 0.26, 6), M('#a05a4a', 0.8), 0, 0.15, 0.012).scale.z = 0.15; add(e, new THREE.TorusGeometry(0.015, 0.004, 4, 8), brass, 0, 0.06, 0.02); } // (big wide ears with a brass ring)
    add(hg, coneG(0.026, 0.11, 8), skin, 0, 0.07, 0.15).rotation.x = Math.PI / 2 + 0.25; // (a pointed nose)
    for (const sx of [-1, 1]) { add(hg, cylG(0.04, 0.044, 0.04, 14), iron2, sx * 0.05, 0.12, 0.115).rotation.x = Math.PI / 2; add(hg, sph(0.036, 10, 8), GL('#ff9a3a'), sx * 0.05, 0.12, 0.137).scale.z = 0.3; } add(hg, new THREE.TorusGeometry(0.14, 0.014, 6, 24), leather, 0, 0.12, 0).rotation.x = Math.PI / 2; // (flight goggles down over the eyes)
    for (let k = 0; k < 3; k++) { const t = add(hg, coneG(0.03, 0.14, 6), M('#2a2a2a', 0.9), 0, 0.27 + k * 0.03, -0.04 - k * 0.03); t.rotation.x = -0.6 - k * 0.3; } add(hg, sph(0.02, 6, 5), GL('#ff7a20'), 0, 0.33, -0.12); // (a singed topknot, still smouldering)
    add(hg, boxG(0.08, 0.012, 0.01), GL('#f0e0b0'), 0, 0.04, 0.12); // (a toothy grin)
    add(ch.chest, boxG(0.05, ch.R.torsoH * 1.1, 0.02), leather, 0, ch.R.torsoH * 0.5, 0.14).rotation.z = -0.6;
    for (let k = 0; k < 5; k++) { const b = add(ch.chest, sph(0.042, 10, 8), iron2, 0.1 - k * 0.05, ch.R.torsoH * 0.3 + k * 0.07, 0.16); add(b, sph(0.008, 5, 4), GL('#ffb040'), 0, 0.045, 0); } // (a bandolier of little bombs)
    { const pack = add(ch.chest, boxG(0.26, 0.3, 0.14), leather, 0, ch.R.torsoH * 0.5, -0.2); for (const x of [-0.07, 0.07]) { add(pack, cylG(0.03, 0.035, 0.28, 8), iron2, x, 0.22, -0.02); add(pack, cylG(0.04, 0.03, 0.04, 8), M('#1a1a1a'), x, 0.37, -0.02); } add(pack, sph(0.07, 10, 8), iron2, 0, -0.02, -0.08); } // (a pack of bombs with two smoking stacks)
    for (const sd of ['L', 'R']) { const a = ch.legs[sd].ankle; const r = add(a, cylG(0.035, 0.045, 0.14, 10), iron2, 0, 0.03, -0.08); r.rotation.x = 0.2; add(a, cylG(0.04, 0.03, 0.03, 10), GL('#ff8a2a'), 0, -0.05, -0.095).castShadow = false; } }, // (rocket boots)
  beastmaster(ch) { hideHair(ch); const f = fur('#7a7a80'), wh = fur('#c8c8cc'); const head = add(ch.headG, sph(0.15, 14, 10), f, 0, 0.15, -0.02); head.scale.set(1, 0.85, 1.15);
    const sn = add(ch.headG, boxG(0.09, 0.07, 0.16), f, 0, 0.16, 0.14); add(ch.headG, boxG(0.07, 0.03, 0.12), wh, 0, 0.12, 0.15); add(ch.headG, sph(0.016, 6, 4), GL('#0a0a0a'), 0, 0.18, 0.22);
    for (const s of [-1, 1]) { add(ch.headG, coneG(0.04, 0.1, 4), f, s * 0.08, 0.28, -0.02); add(ch.headG, sph(0.012, 6, 4), GL('#ffd040'), s * 0.04, 0.2, 0.15); for (let k = 0; k < 2; k++) add(ch.headG, coneG(0.01, 0.04, 4), wh, s * 0.03, 0.11, 0.2 - k * 0.04).rotation.x = Math.PI; }
    mantle(ch, '#7a7a80', 0.2); },
};
// ---- silhouettes: the big shapes that tell the classes apart from across the map (capes, great pauldrons, tall headgear) ----
function cape(ch, col, o = {}) { const R = ch.R, w = (o.w || 2.1) * R.sw, len = o.len || (R.torsoH + R.legL * 0.8), pv = new THREE.Group();
  pv.position.set(0, R.torsoH - 0.1, -0.135 * R.thick - 0.015); ch.chest.add(pv);
  const g = new THREE.PlaneGeometry(w, len, 8, 12); g.translate(0, -len / 2, 0); const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), d = -y / len; let nx = x * (1 + 0.35 * d), ny = y; // (flares toward the hem)
    if (o.tatter && d > 0.86) ny += (Math.sin(x * 61) * 0.5 + 0.5) * len * 0.12 * (d - 0.86) / 0.14; // (a ragged hem)
    P.setXYZ(i, nx, ny, -Math.pow(x / (w * 0.5), 2) * 0.07 + Math.sin(d * 9 + x * 5) * 0.008); } g.computeVertexNormals();
  const m = new THREE.Mesh(g, M(col, 0.85, 0, { side: THREE.DoubleSide })); m.castShadow = true; m.userData.keep = true; pv.add(m);
  if (o.trim) { const t = new THREE.Mesh(new THREE.BoxGeometry(w * 1.3, 0.035, 0.012), M(o.trim, 0.4, 0.7)); t.position.set(0, -len + 0.02, 0.004); pv.add(t); }
  if (o.clasp) for (const sx of [-1, 1]) add(ch.chest, sph(0.03, 10, 8), M(o.clasp, 0.35, 0.85), sx * R.sw * 0.7, R.torsoH - 0.08, 0.06);
  pv.rotation.x = 0.1; (ch.capes = ch.capes || []).push(pv); return pv; }
function bigPauldrons(ch, m, size, rim, spikes = 0) { for (const sd of ['L', 'R']) { const sx = sd === 'L' ? 1 : -1, g = new THREE.Group(); g.position.set(sx * 0.02, 0.03, 0); ch.arms[sd].sh.add(g);
    for (let k = 0; k < 3; k++) { const p = add(g, new THREE.SphereGeometry(0.085 * size * (1 - k * 0.1), 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), m, sx * 0.014 * k, -k * 0.036 * size, 0); p.scale.set(1.12, 0.62, 1.08); p.rotation.z = -sx * (0.3 + k * 0.16); p.material = m.clone(); p.material.side = THREE.DoubleSide; } // (three overlapping plates, thin shells, not balls)
    if (rim) { const r = add(g, new THREE.TorusGeometry(0.085 * size, 0.008, 6, 24), rim, 0, 0.0, 0); r.rotation.x = Math.PI / 2; r.scale.set(1.12, 1.08, 1); }
    for (let k = 0; k < spikes; k++) { const sp = add(g, coneG(0.03 * size, 0.2 * size, 6), m, sx * (0.02 + k * 0.02), 0.08 * size, -0.06 + k * 0.05); sp.rotation.z = -sx * (0.5 + k * 0.15); } } }
const SIL = {
  warrior(ch) { bigPauldrons(ch, steel('#6e737c'), 1.2, steel('#4a4e56')); cape(ch, '#22262c', { tatter: true, w: 2.2 }); const m = steel('#5e636c'); const ts = add(ch.hips, boxG(0.12, ch.R.legL * 0.5, 0.02), m, 0, -ch.R.legL * 0.18, 0.18 * ch.R.thick); ts.rotation.x = -0.08; for (const sd of ['L', 'R']) add(ch.legs[sd].knee, sph(0.07, 12, 10), m, 0, 0, 0.04).scale.set(1, 0.9, 0.85); }, // (a tasset plate down the front, big round knee cops)
  paladin(ch) { bigPauldrons(ch, gold(), 1.35, M('#f6e8b8', 0.3, 0.8), 2); cape(ch, '#d8a830', { trim: '#f0d070', clasp: '#f0d070', w: 2.3 }); },
  darkknight(ch) { bigPauldrons(ch, iron('#1e1e24'), 1.38, M('#5a0c0c', 0.5, 0.5), 2); cape(ch, '#140a0c', { tatter: true, w: 2.4, len: ch.R.torsoH + ch.R.legL * 1.0 });
    const skull = (par, x, y, z, s2 = 1, ry = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; g.scale.setScalar(s2); par.add(g); const b = M('#cfc4a4', 0.6); add(g, sph(0.05, 12, 10), b, 0, 0.01, 0).scale.set(0.9, 1, 1); add(g, boxG(0.055, 0.03, 0.04), b, 0, -0.035, 0.012); for (const ex of [-0.019, 0.019]) add(g, sph(0.014, 6, 5), GL('#0a0606'), ex, 0.008, 0.042); add(g, coneG(0.008, 0.016, 3), GL('#0a0606'), 0, -0.012, 0.047).rotation.x = Math.PI; return g; };
    for (const sd of ['L', 'R']) { skull(ch.arms[sd].sh, sd === 'L' ? 0.03 : -0.03, 0.1, 0.0, 1.3); skull(ch.legs[sd].knee, 0, 0.0, 0.07, 0.9); } skull(ch.hips, 0, 0.06, 0.17 * ch.R.thick, 1.2); // (skulls on the pauldrons, the belt and the knees)
    const hood = add(ch.headG, sph(0.175, 16, 12), M('#120c0e', 0.9), 0, 0.06, -0.035); hood.geometry = new THREE.SphereGeometry(0.175, 16, 12, Math.PI * 0.5 + 0.9, Math.PI * 2 - 1.8, 0, Math.PI * 0.72); hood.material.side = THREE.DoubleSide; },
  berserker(ch) { cape(ch, '#5a3a22', { w: 2.4, len: ch.R.torsoH + 0.25, tatter: true }); },
  cleric(ch) { cape(ch, '#f2ece0', { trim: '#d8b04a', clasp: '#d8b04a' }); },
  bard(ch) { cape(ch, '#6a4a2a', { w: 2.1, len: ch.R.torsoH + ch.R.legL * 0.35, trim: '#4a7ac8' }); }, // (a short brown traveller's cape edged in blue)
  necromancer(ch) { const b = bone(), st2 = iron('#7a7a80'), hg = ch.headG;
    add(hg, cylG(0.122, 0.13, 0.05, 18), st2, 0, 0.17, 0); for (let k = 0; k < 9; k++) { const a = -Math.PI * 0.62 + k / 8 * Math.PI * 1.24, hgt = k === 4 ? 0.34 : 0.16 + 0.1 * (1 - Math.abs(k - 4) / 4); const sp = add(hg, coneG(0.016, hgt, 5), k % 2 ? b : st2, Math.sin(a) * 0.125, 0.19 + hgt / 2, Math.cos(a) * 0.12); sp.rotation.set(Math.cos(a) * -0.12, 0, -Math.sin(a) * 0.12); } add(hg, sph(0.02, 8, 6), GL('#6aff5a'), 0, 0.2, 0.13); // (a tall crown of bone and steel spikes)
    const th = ch.R.torsoH - 0.2, T = ch.R.thick; add(ch.chest, boxG(0.03, th * 0.8, 0.02), b, 0, th * 0.5, 0.14 * T); for (let k = 0; k < 4; k++) for (const s of [-1, 1]) { const rib = add(ch.chest, new THREE.TorusGeometry(0.09 * T, 0.011, 5, 12, Math.PI * 0.55), b, s * 0.004, th * (0.25 + k * 0.17), 0.1 * T); rib.rotation.set(0, s > 0 ? -0.2 : Math.PI + 0.2, 0); rib.scale.set(1, 1, 0.6); } // (a ribcage of real bones strapped over the armour)
    cape(ch, '#0e0c10', { tatter: true, w: 2.2, len: ch.R.torsoH + ch.R.legL * 0.95 }); },
  wizard(ch) { const hat = ch.outfit && ch.outfit.hat; if (hat) { hat.scale.multiplyScalar(1.35); hat.rotation.z = -0.12; } },
  druid(ch) { },
  shaman(ch) { },
  enchanter(ch) { for (const sx of [-1, 1]) { const pv = new THREE.Group(); pv.position.set(sx * 0.16, ch.R.torsoH - 0.05, -0.08); ch.chest.add(pv); const r = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 1.0, 1, 8).translate(0, -0.5, 0), M('#e070c8', 0.7, 0, { side: THREE.DoubleSide })); r.userData.keep = true; pv.add(r); pv.rotation.set(0.15, sx * 0.3, 0); (ch.capes = ch.capes || []).push(pv); } },
  rogue(ch) { const hood = add(ch.headG, coneG(0.08, 0.16, 8), M('#16141a', 0.85), 0, 0.2, -0.1); hood.rotation.x = -1.1; },
};
for (const k in SIL) { const f0 = DECOR[k]; DECOR[k] = (ch) => { if (f0) f0(ch); SIL[k](ch); }; }
// capes swing out behind as you move and settle when you stop (until the full cloth springs take over)
function capeTick(ch, dt) { if (!ch.capes) return; const p = ch.root.position, lp = ch._capeP || (ch._capeP = p.clone()); const v = Math.min(9, Math.hypot(p.x - lp.x, p.z - lp.z) / Math.max(dt, 1e-3)); lp.copy(p);
  ch._capeV = (ch._capeV || 0) + (v - (ch._capeV || 0)) * Math.min(1, dt * 4); ch._capeT = (ch._capeT || 0) + dt; const fl = 0.1 + Math.min(1, ch._capeV / 7) * 0.75 + Math.sin(ch._capeT * 2.3) * 0.03 * (1 + ch._capeV * 0.2);
  for (const c of ch.capes) c.rotation.x += (fl - c.rotation.x) * Math.min(1, dt * 6); }
export function arenaDecor(ch, cls) { ch.style = STYLE[cls] || null; try { if (DETAIL[cls]) DETAIL[cls](ch); if (DECOR[cls]) DECOR[cls](ch); } catch (e) { console.warn('arena look', cls, e); } attachHeroModel(ch, cls); } // (a class with a real 3D model swaps it in once it has loaded)
// the weapon in the hand: a necromancer's staff wears a little skull with green eyes; casters' orbs take their class colour
export function arenaWeaponDecor(ch, cls) {
  const w = ch.weapons && ch.weapons.main; if (!w || w.userData.arenaDecor) return; w.userData.arenaDecor = true; weaponDecor(ch, cls, w); classKit(ch, cls); if (cls === 'necromancer') necroSupport(ch); }
// the necromancer holds his scythe in both hands: a marker low on the shaft (in the scythe holder's frame) that the hero model's left fist goes to
function necroSupport(ch) { const h = ch.arms && ch.arms.R && ch.arms.R.grip && ch.arms.R.grip.children.find(c => c.name === 'kit_necro_scythe'); if (!h) return; const m = new THREE.Object3D(); m.name = 'necro_support'; m.position.set(0, 0.22, 0); m.rotation.set(0, -h.rotation.y, 0); /* (its fingers the same way as the right fist's) */ h.add(m); ch.hmSupport = m; } // (then each class's detailed weapon models replace the code-built ones as they load)
function weaponDecor(ch, cls, w) {
  if (/^(druid|enchanter|priest|necromancer|elementalist)$/.test(cls) && w.name === 'weapon_staff') w.userData.restTilt = 'upF'; // (staff, scepter, scythe and orb carried upright at rest, head up, fingers forward, never leaning out like a lance)
  if (cls === 'warrior') { w.userData.restTilt = [1.05, -0.45]; w.scale.multiplyScalar(1.25); if (ch.weapons.off) ch.weapons.off.scale.multiplyScalar(1.45); return; } // (a knight's long sword and a full heater shield on his big frame, not a boy's)
  if (cls === 'berserker' && w.name === 'weapon_greataxe') w.scale.multiplyScalar(0.78); // (the ram-skull great axe at 0.68 of his height, not 0.87)
  if (cls === 'darkknight' && w.name === 'weapon_greatsword') w.scale.multiplyScalar(0.78); // (his barbed greatsword at 0.7 of his height, not 0.9)
  if (cls === 'rogue' && w.name === 'weapon_dagger' && !ch.weapons.off && ch.arms && ch.arms.L && ch.arms.L.grip) { const off = makeWeapon('dagger', 3, 0); off.rotation.y = Math.PI / 2; ch.arms.L.grip.add(off); ch.weapons.off = off; }
  if (cls === 'rogue') for (const k of ['main', 'off']) if (ch.weapons[k] && ch.weapons[k].name === 'weapon_dagger') ch.weapons[k].userData.restTilt = -0.75; // (her blades stand forward and up out of the top of each fist at rest, pommels at the bottom, not hanging point-down) // (her second dagger, in the left fist: classKit swaps in the detailed one)
  if (false && cls === 'paladin') w.scale.z *= 2.6; // (no model of his own yet: the built greatsword, its blade given some body so it never thins to a line edge-on)
  if (cls === 'ranger' && w.name === 'weapon_bow') { w.rotation.set(0, Math.PI, 0); w.position.set(0, 0, 0); w.scale.multiplyScalar(0.7); } // (the grip runs up through the fist, so the limbs stand up and down out of it with the string toward him, not out along the fingers; a 0.6-height bow)
  if (cls === 'musketeer' || cls === 'blunderbuss') { goblinGun(w, cls); if (cls === 'blunderbuss') w.scale.multiplyScalar(0.7); return; } // (the hand-cannon about half his height once sized to the model, not a bazooka) // (goblin-made guns)
  if (cls === 'beastmaster') { for (const k of ['main', 'off']) { const o = ch.weapons[k]; if (o) for (const c of [...o.children]) o.remove(c); } for (const sd of ['R', 'L']) { const c2 = makeClaws(0.5); c2.name = 'claws'; c2.rotation.x = Math.PI / 2; c2.position.set(0, 0.005, 0.04); /* (pushed up the hand so the claws reach past the knuckles) */ if (sd === 'L') c2.scale.x = -1; c2.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.3)).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), sd === 'L' ? -0.35 : 0.35)); /* (the claws hook inward, toward the palm, and a little down: never raised up off the back of the hand) */ ch.arms[sd].grip.add(c2); kitize(c2, 'beast_claw'); } return; } // (bear-claw gauntlets on both fists, the claws in line with the forearm; held in the grip so they move onto the hero model's hands)
  if (cls === 'bard') { // a lute: he clubs people with it, and plays it once he has learnt his songs
    for (const c of [...w.children]) if (c.isMesh || (c.children && c.children.some(k => k.isMesh))) w.remove(c); const L = new THREE.Group(); w.add(L); w.userData.lute = L;
    const wood = M('#a0602a', 0.55), dark = M('#4a2a12', 0.7), str = GL('#e8e0c8');
    add(L, cylG(0.016, 0.02, 0.42, 8), dark, 0, 0.21, 0); const head = add(L, boxG(0.05, 0.1, 0.025), dark, 0, -0.02, -0.01); head.rotation.x = 0.4;
    for (let k = 0; k < 4; k++) add(L, cylG(0.004, 0.004, 0.03, 4), M('#d8b04a', 0.4, 0.8), (k % 2 ? 1 : -1) * 0.03, -0.04 + (k >> 1) * 0.04, -0.01).rotation.z = Math.PI / 2;
    const bowl = add(L, sph(0.13, 16, 12), wood, 0, 0.6, -0.02); bowl.scale.set(1, 1.25, 0.55); add(L, sph(0.03, 10, 8), GL('#1a0a04'), 0, 0.56, 0.05).scale.z = 0.2;
    for (let k = 0; k < 4; k++) add(L, boxG(0.002, 0.62, 0.002), str, -0.012 + k * 0.008, 0.33, 0.03);
    add(L, boxG(0.07, 0.015, 0.02), dark, 0, 0.72, 0.04); kitize(L, 'bard_lute'); return; } // (the detailed lute takes the code one's place once loaded)
  if (cls === 'wizard') { for (const c of [...w.children]) w.remove(c); w.userData.orb = null; w.position.y = 0; const bk = makeBook(); bk.position.set(0, 0.02, 0.05); bk.rotation.z = Math.PI; bk.scale.setScalar(1.3); /* (turned over on its spine, right way up; 30% bigger) */ w.add(bk); w.userData.tip = bk; kitize(bk, 'wizard_book'); return; } // (no staff: the open spellbook in his right fist, spells pour from its pages)
  if (cls === 'bombardier') { for (const c of [...w.children]) w.remove(c); w.userData.orb = null; w.userData.tip = null; w.position.y = 0; const b = makeBomb(); b.position.set(0, 0.0, 0.0); w.add(b); w.userData.tip = b; kitize(b, 'bomb_grenade'); return; } // (no staff: a lit bomb in his fist; the staff's half-length drop is undone so it sits in the fist, not up the forearm)
  if (cls === 'priest') { for (const c of [...w.children]) if (c.isMesh || (c.children && c.children.some(k => k.isMesh))) w.remove(c); w.userData.orb = null; return; } // (the owner: the priest carries only his censer, hanging from his hand on its chain; no staff or scepter)
  if (cls === 'priest' && w.userData.orb) { const o = w.userData.orb, g = gold(); const ring = add(o, new THREE.TorusGeometry(0.16, 0.014, 6, 32), g); ring.rotation.x = Math.PI / 2; for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, r = add(o, coneG(0.014, k % 2 ? 0.08 : 0.14, 5), g, Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2); r.rotation.set(0, 0, 0); r.rotation.z = -Math.PI / 2; r.rotation.y = -a; } o.traverse(m => { if (m.isMesh && m.material && m.material.emissive) { m.material = m.material.clone(); m.material.color.set('#fff2c0'); m.material.emissive.set('#ffd060'); } }); return; }
  const tip = w.userData.orb || w.userData.tip; if (!tip && cls !== 'necromancer') return;
  const col = { necromancer: '#5aff4a', wizard: '#60a0ff', elementalist: '#ff8030', enchanter: '#ff70e0', druid: '#9ad060', cleric: '#fff0a0' }[cls];
  if (cls === 'necromancer') { for (const c of [...w.children]) w.remove(c); w.userData.orb = null; w.userData.tip = null; const fl = add(w, sph(0.04, 10, 8), GL('#7aff5a'), 0, 0.02, 0.05); fl.castShadow = false; const fl2 = add(w, sph(0.065, 10, 8), new THREE.MeshBasicMaterial({ color: '#2aff3a', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }), 0, 0.02, 0.05); fl2.castShadow = false; fl.visible = fl2.visible = false; /* (no green poison glow in his hand any more: it holds the scythe; the point stays as the spell origin) */ w.userData.flame = fl; return; }
  if (false) { const s = new THREE.Group(); tip.add(s); s.position.y = 0.03; const b = bone(); add(s, sph(0.07, 12, 10), b).scale.set(0.95, 1, 1.05); add(s, boxG(0.08, 0.035, 0.06), b, 0, -0.05, 0.02);
    for (const x of [-0.024, 0.024]) { add(s, sph(0.017, 8, 6), GL('#050505'), x, 0.005, 0.058); add(s, sph(0.008, 6, 4), GL('#6aff5a'), x, 0.005, 0.068); } s.rotation.y = Math.PI / 2; return; }
  if (col && w.userData.orb) w.userData.orb.traverse(o => { if (o.isMesh && o.material) { o.material = o.material.clone(); if (o.material.color) o.material.color.set(col); if (o.material.emissive) o.material.emissive.set(col); } });
}
// an open spellbook: tooled leather covers, a thick block of pages, a little fire licking up out of it
export function makeBook(s = 1) { const g = new THREE.Group(), cov = M('#5a2a16', 0.7), pg = M('#efe2c0', 0.85), gd = gold();
  for (const sx of [-1, 1]) { const c = add(g, boxG(0.11 * s, 0.006 * s, 0.15 * s), cov, sx * 0.056 * s, 0, 0); c.rotation.z = sx * 0.18; const p2 = add(g, boxG(0.1 * s, 0.022 * s, 0.14 * s), pg, sx * 0.052 * s, 0.012 * s, 0); p2.rotation.z = sx * 0.18; add(g, boxG(0.07 * s, 0.002 * s, 0.1 * s), gd, sx * 0.058 * s, -0.004 * s, 0).rotation.z = sx * 0.18; }
  const fl = add(g, coneG(0.03 * s, 0.1 * s, 8), new THREE.MeshBasicMaterial({ color: '#ffb040', transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 0.07 * s, 0); fl.castShadow = false; g.userData.flame = fl; return g; }
// a goblin bomb: an iron shell, brass cap and rivets, and a fizzing fuse
export function makeBomb(s = 1) { const g = new THREE.Group(), iron2 = M('#26262a', 0.45, 0.7), brass = gold(); add(g, sph(0.09 * s, 14, 10), iron2); add(g, cylG(0.03 * s, 0.035 * s, 0.035 * s, 8), brass, 0, 0.09 * s, 0);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(g, sph(0.01 * s, 5, 4), brass, Math.cos(a) * 0.09 * s, 0, Math.sin(a) * 0.09 * s); } add(g, cylG(0.006 * s, 0.006 * s, 0.06 * s, 4), M('#d8c890'), 0.01 * s, 0.13 * s, 0).rotation.z = -0.4;
  const sp = add(g, sph(0.018 * s, 6, 5), GL('#ffd060'), 0.022 * s, 0.16 * s, 0); sp.castShadow = false; g.userData.spark = sp; return g; }
// a little life every frame: the elementalist's orbs circle, the enchanter's runes turn
// what a hero model holds keeps the angle the built body's hand gives it (that body still performs every carry, swing and cast, and its
// weapons were posed for it): left to the model's own wrist, a staff hung head-down at rest and long blades swung out flat as he ran.
// Guns are already laid this way by tickHeroModel; a recorded move (the monk's) drives the hands itself, so it eases off during one.
// the hand items were made for the built body (its hands scale them by ch.scale); the model is a different height, so they grow or shrink by
// the same ratio and keep their size against him: a giant's great axe stays great, the little goblin's bomb stays fist-sized
// the socket sits in the closed fist, where a grip goes (between the palm and the curled fingers), not at the wrist joint the hand bone turns on
function palm(so) { const hb = so.parent; if (so.userData.mid === undefined) { let m = null; hb.traverse(o => { if (!m && o !== hb && o.isBone && /Middle1$|Middle_?01$/i.test(o.name)) m = o; }); if (!m) hb.traverse(o => { if (!m && o !== hb && o.isBone && /Index1$|Index_?01$/i.test(o.name)) m = o; }); so.userData.mid = m; }
  const m = so.userData.mid; if (!m) { const pl = so.userData.palmL === undefined ? (so.userData.palmL = skinPalm(hb)) : so.userData.palmL; if (pl) so.position.copy(pl); return; } m.updateWorldMatrix(true, false); hb.getWorldPosition(_ga); m.getWorldPosition(_gb); _ga.lerp(_gb, 0.85); so.position.copy(hb.worldToLocal(_ga)); }
// a rig with no finger bones (the Meshy heroes): the middle of the hand is the average of the skin the hand bone moves, in its rest pose,
// in the hand bone's own frame (worked out once per model and hand)
function skinPalm(hb) { let sk = null; for (let r = hb, n = 0; r && !sk && n < 40; r = r.parent, n++) { if (r.isBone) continue; r.traverse(o => { if (!sk && o.isSkinnedMesh && o.skeleton && o.skeleton.bones.includes(hb)) sk = o; }); }
  if (!sk) return null; const g = sk.geometry, C = (g.userData.palm = g.userData.palm || {}); if (C[hb.name] !== undefined) return C[hb.name]; const bi = sk.skeleton.bones.indexOf(hb), P = g.attributes.position, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight; if (!P || !SI || !SW) return (C[hb.name] = null);
  const mt = new THREE.Matrix4().multiplyMatrices(sk.skeleton.boneInverses[bi], sk.bindMatrix), v = new THREE.Vector3(), sum = new THREE.Vector3(); let n = 0;
  for (let i = 0; i < P.count; i++) { let best = -1, bw = 0; for (let j = 0; j < 4; j++) { const w = SW.getComponent(i, j); if (w > bw) { bw = w; best = SI.getComponent(i, j); } } if (best !== bi || bw < 0.5) continue; sum.add(v.fromBufferAttribute(P, i).applyMatrix4(mt)); n++; }
  return (C[hb.name] = n > 8 ? sum.multiplyScalar(1 / n) : null); }
export function heldScale(ch) { const cls = ch.app && (ch.app.cls || ch.app.outfit); return ch.height > 0 && cls ? (ch.scale || 1) * heroHeight(cls) / ch.height : 1; }
// at rest and on the run a held weapon has its own carry, laid in a frame: x his right, z his front, y down (a "body" carry ignores the arm;
// a "fore" carry rides the forearm, y running from elbow to hand, so a sword or a strapped-on shield swings with it). Each entry gives the
// weapon's own +y (where it points) and +x (a one-hander's edge, an axe's bit) in that frame. While he attacks it eases over to the angle the
// built hand gives it, since the swings were made with that body.
const CARRY = { sword: ['body', [0, 0.64, 0.77], [0, 0.77, -0.64]], dagger: ['body', [0, 0.64, 0.77], [0, 0.77, -0.64]], mace: ['body', [0, -0.87, 0.5], [0, 0.5, 0.87]], handaxe: ['body', [0, 0.5, 0.87], [0, 0.87, -0.5]],
  staff: ['body', [0, -0.97, 0.24], [1, 0, 0]], spear: ['body', [0, -0.97, 0.24], [1, 0, 0]], greatsword: ['body', [0, -0.42, 0.91], [0, 0.91, 0.42]], greataxe: ['body', [0, -0.42, 0.91], [0, 0.91, 0.42]], warhammer: ['body', [0, -0.42, 0.91], [0, 0.91, 0.42]],
  shield: ['fore', [0, -1, 0], [0, 0, -1]], bow: ['body', [0, -1, 0], [1, 0, 0], true] }; // (the shield stands up the forearm, its face (+z) out to his left; the bow always stands upright, string (+z) toward him, drawn or not)
const _gq = new THREE.Quaternion(), _gp = new THREE.Quaternion(), _gi = new THREE.Quaternion(), _gc = new THREE.Quaternion(), _gm = new THREE.Matrix4(), _gx = new THREE.Vector3(), _gy = new THREE.Vector3(), _gz = new THREE.Vector3(), _ga = new THREE.Vector3(), _gb = new THREE.Vector3(), _gr = new THREE.Vector3();
// what the socket's main item is, if it has a carry: [kind, the item]
function carryOf(ch, sd) { const W = ch.weapons || {}; for (const k of sd === 'R' ? ['main'] : ['off', 'main']) { const w = W[k]; if (!w || !w.name || !w.parent || !ch.hmSockets.includes(w.parent)) continue; const kind = w.name.replace(/^weapon_/, ''); if (CARRY[kind] && (sd === 'L' ? k === 'off' || kind === 'bow' : kind !== 'bow')) return [kind, w]; } return null; }
function carryQ(ch, H, sd, kind, w, out) { const C = CARRY[kind], B = H.bones, nm = sd === 'R' ? 'Right' : 'Left'; ch.root.getWorldQuaternion(_gq); _gr.set(-1, 0, 0).applyQuaternion(_gq); /* (his right: the root faces +z) */
  if (C[0] === 'fore' && B[nm + 'ForeArm'] && B[nm + 'Hand']) { B[nm + 'ForeArm'].getWorldPosition(_ga); B[nm + 'Hand'].getWorldPosition(_gb); _gy.subVectors(_gb, _ga).normalize(); } else _gy.set(0, -1, 0);
  _gx.copy(_gr).addScaledVector(_gy, -_gr.dot(_gy)); if (_gx.lengthSq() < 1e-4) _gx.set(0, 0, 1).applyQuaternion(_gq); _gx.normalize(); _gz.crossVectors(_gx, _gy); // (the frame)
  const f = (v) => new THREE.Vector3().addScaledVector(_gx, v[0]).addScaledVector(_gy, v[1]).addScaledVector(_gz, v[2]).normalize();
  const wy = f(C[1]), wx = f(C[2]); wx.addScaledVector(wy, -wx.dot(wy)).normalize(); const wz = new THREE.Vector3().crossVectors(wx, wy);
  _gm.makeBasis(wx, wy, wz); out.setFromRotationMatrix(_gm); return out.multiply(_gc.copy(w.quaternion).invert()); } // (the socket turns so the item, at its own angle in it, lies so)
function gripFollow(ch) { const H = ch.heroModel; if (!H || H === 'loading' || !ch.hmSockets) return; const k = 1 - Math.min(1, H.mw || 0), atk = Math.min(1, H.ikA || 0);
  const sz = heldScale(ch); ch.root.updateMatrixWorld(true);
  for (const so of ch.hmSockets) { const chd = so.userData.codeHand; if (!chd || !so.parent || !so.userData.gripQ) continue; if (so.userData.s0 == null) so.userData.s0 = so.scale.x; so.scale.setScalar(so.userData.s0 * sz); /* (sized to the model, see heldScale) */ if (so.userData.fist) { so.position.copy(so.userData.fist.p); so.quaternion.copy(so.userData.fist.q); continue; } /* (fixed in the model's fist: puppetArms turns the hand itself) */ chd.updateWorldMatrix(true, false); so.parent.updateWorldMatrix(true, false);
    _gp.copy(chd.getWorldQuaternion(_gp)).multiply(so.userData.gripQ); /* (the built hand's angle, in the world) */ const sd = chd === (ch.arms.R && ch.arms.R.hand) ? 'R' : 'L', c = carryOf(ch, sd);
    if (c && (atk < 0.999 || CARRY[c[0]][3])) { carryQ(ch, H, sd, c[0], c[1], _gq); if (!CARRY[c[0]][3]) _gq.slerp(_gp, atk); _gp.copy(_gq); }
    palm(so);
    so.parent.getWorldQuaternion(_gq).invert(); _gq.multiply(_gp); so.quaternion.copy(k >= 0.999 ? _gq : _gi.identity().slerp(_gq, k)); } }
export function arenaLookTick(ch, dt) { if (ch && ch.heroModel) { tickHeroModel(ch, dt); gripFollow(ch); } if (ch && ch.capes) capeTick(ch, dt); if (ch && ch.arenaSpin) ch.arenaSpin.rotation.y += dt * 1.6; if (ch && ch.dangle) swingDangle(ch.dangle, ch.root, dt);
  if (ch && ch.monkTails) { const p = ch.root.position, lp = (ch.tailState = ch.tailState || { lp: p.clone(), k: 0 }).lp, sp = Math.min(1, p.distanceTo(lp) / Math.max(dt, 1e-3) / 7); lp.copy(p); const t = performance.now() / 1000; const TS = ch.tailState; TS.k += (sp - TS.k) * Math.min(1, dt * 5);
    ch.monkTails.forEach((pv, i) => { pv.rotation.x = 0.15 + TS.k * 1.1 + Math.sin(t * 9 + i * 1.7) * (0.08 + TS.k * 0.18); pv.rotation.z = Math.sin(t * 6 + i) * 0.1 * (1 + TS.k); }); } }
// the shrunken head: a leathery little head with a stitched mouth and green eyes, hung from a long braided ponytail.
// The group's origin is the top of the ponytail (where the fist holds it); the head hangs down -Y, its face toward +Z.
export function makeShrunkenHead() {
  const dg = new THREE.Group(), sk = M('#5a4426', 0.72), skD = M('#3a2a14', 0.85), skL = M('#7a6038', 0.7), st = M('#120c06', 0.9), thread = M('#2a1a0a', 0.95), hair = M('#100c08', 0.95), hairL = M('#2a2016', 0.95), bn = M('#e0d4b4', 0.5);
  // the hair, gathered and knotted in the fist, then a long matted braid down to the scalp
  add(dg, sph(0.024, 10, 8), hair, 0, 0.0, 0).scale.set(1, 1.3, 1); add(dg, new THREE.TorusGeometry(0.02, 0.006, 6, 12), bn, 0, -0.02, 0).rotation.x = Math.PI / 2; // (a bone ring cinching the hair)
  for (let k = 0; k < 6; k++) { const seg = add(dg, cylG(0.013 - k * 0.0009, 0.015 - k * 0.0009, 0.042, 7), k % 2 ? hairL : hair, (k % 2 ? 0.005 : -0.005), -0.04 - k * 0.036, 0); seg.rotation.z = (k % 2 ? 0.3 : -0.3); }
  for (let k = 0; k < 3; k++) add(dg, sph(0.009, 8, 6), M(['#8a2a1a', '#c8a040', '#3a6a5a'][k], 0.5, 0.3), 0.012, -0.07 - k * 0.06, 0.006); // (beads threaded on the braid)
  const hd = new THREE.Group(); hd.position.set(0, -0.31, 0); dg.add(hd);
  // the skull: a shrivelled, lumpy, wrinkled shape (sunken temples and cheeks, a pinched chin)
  const g = new THREE.SphereGeometry(0.085, 28, 22), P = g.attributes.position;
  for (let i = 0; i < P.count; i++) { let x = P.getX(i), y = P.getY(i), z = P.getZ(i); const nx = x / 0.085, ny = y / 0.085, nz = z / 0.085;
    x *= 0.86; y *= 1.08; if (ny < 0) { x *= 1 - 0.22 * ny * ny; z *= 1 - 0.1 * ny * ny; } // (narrow jaw)
    if (nz > 0.3 && Math.abs(ny) < 0.45) { const ch = Math.max(0, 1 - Math.abs(Math.abs(nx) - 0.55) / 0.25) * Math.max(0, 1 - Math.abs(ny + 0.12) / 0.3); x *= 1 - 0.12 * ch; z *= 1 - 0.07 * ch; } // (sunken cheeks)
    if (nz > 0.6 && ny > 0.05 && ny < 0.35) z += 0.006; // (a heavy brow)
    const w = Math.sin(ny * 46 + Math.sin(nx * 9) * 2) * 0.0024 + Math.sin(nx * 31 + nz * 17) * 0.0016; // (deep wrinkles)
    const L = Math.hypot(x, y, z) || 1; P.setXYZ(i, x + x / L * w, y + y / L * w, z + z / L * w); }
  g.computeVertexNormals(); add(hd, g, sk);
  for (const [x, y, z, r] of [[0.03, 0.05, 0.05, 0.022], [-0.045, -0.02, 0.05, 0.018], [0.05, -0.03, -0.03, 0.025], [-0.02, 0.07, -0.04, 0.02]]) add(hd, sph(r, 8, 6), skD, x, y, z).scale.set(1, 0.6, 0.35); // (dark blotches on the leather)
  // sewn-shut eyes: sunken lids, coarse X stitches, green light leaking through the slit
  for (const x of [-0.029, 0.029]) { add(hd, sph(0.019, 10, 8), skD, x, 0.016, 0.066).scale.set(1.1, 0.7, 0.5); const sl = add(hd, boxG(0.026, 0.003, 0.004), GL('#8aff5a'), x, 0.016, 0.077); sl.castShadow = false;
    const gl = add(hd, sph(0.016, 8, 6), new THREE.MeshBasicMaterial({ color: '#4aff2a', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }), x, 0.016, 0.08); gl.castShadow = false;
    for (let k = 0; k < 3; k++) for (const r of [0.6, -0.6]) add(hd, boxG(0.0022, 0.016, 0.0022), thread, x - 0.009 + k * 0.009, 0.016, 0.079).rotation.z = r; }
  // the nose: shrivelled, flattened, with a bone ring through it
  add(hd, coneG(0.012, 0.03, 6), skL, 0, -0.004, 0.083).rotation.x = Math.PI / 2 + 0.3; for (const x of [-0.006, 0.006]) add(hd, sph(0.004, 5, 4), st, x, -0.016, 0.086); add(hd, new THREE.TorusGeometry(0.008, 0.0018, 4, 10), bn, 0, -0.022, 0.086);
  // the mouth: pursed, puckered lips sewn shut with thick thread, the thread ends dangling
  add(hd, sph(0.02, 10, 6), skL, 0, -0.035, 0.074).scale.set(1.25, 0.55, 0.6); add(hd, boxG(0.034, 0.003, 0.005), st, 0, -0.035, 0.085);
  for (let k = 0; k < 6; k++) { const s2 = add(hd, boxG(0.0028, 0.024, 0.003), thread, -0.016 + k * 0.0064, -0.035, 0.087); s2.rotation.z = (k % 2 ? 0.35 : -0.35); }
  for (const x of [-0.019, 0.019]) { const t = add(hd, cylG(0.0016, 0.0012, 0.06, 4), thread, x, -0.065, 0.083); t.rotation.z = x > 0 ? -0.15 : 0.15; }
  // shrivelled ears with a notch, and the matted hair swept up from all round the scalp into the braid
  for (const x of [-1, 1]) { const e = add(hd, sph(0.022, 8, 6), skD, x * 0.073, 0.002, -0.004); e.scale.set(0.38, 1, 0.75); add(hd, sph(0.006, 6, 4), bn, x * 0.08, -0.02, 0.002); }
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, rr = 0.058, h = add(hd, coneG(0.012, 0.13, 4), k % 3 ? hair : hairL, Math.sin(a) * rr * 0.7, 0.08, Math.cos(a) * rr * 0.7 - 0.006); h.rotation.set(Math.cos(a) * -0.55, 0, Math.sin(a) * 0.55); h.scale.z = 0.45; }
  for (let k = 0; k < 6; k++) { const a = 2.4 + k * 0.3, lk = add(hd, coneG(0.006, 0.1 + Math.random() * 0.05, 3), hair, Math.sin(a) * 0.06, -0.02, Math.cos(a) * 0.06); lk.rotation.set(Math.PI + Math.cos(a) * 0.2, 0, Math.sin(a) * 0.25); } // (loose strands hanging at the back)
  // green slime oozing from the sewn mouth
  for (let k = 0; k < 2; k++) { const dr = add(hd, sph(0.006, 6, 5), new THREE.MeshStandardMaterial({ color: '#7aff3a', emissive: '#2a9a10', emissiveIntensity: 0.9, transparent: true, opacity: 0.85, roughness: 0.1 }), -0.006 + k * 0.012, -0.05 - k * 0.012, 0.082); dr.scale.set(1, 1.8 + k, 1); dr.castShadow = false; }
  const mouth = new THREE.Object3D(); mouth.position.set(0, -0.035, 0.1); hd.add(mouth); dg.userData.mouth = mouth; dg.userData.head = hd;
  dg.userData.sw = { ax: 0, az: 0, vx: 0, vz: 0, lp: null };
  return dg;
}
// it hangs straight down whatever the arm does, facing the way you face, and swings as you move
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _v = new THREE.Vector3();
export function swingDangle(dg, faceObj, dt, frameObj) {
  const sw = dg.userData.sw; if (!sw || !dg.parent || dt <= 0) return; dg.parent.updateMatrixWorld(true); dg.getWorldPosition(_p);
  faceObj.getWorldQuaternion(_q2); if (sw.lp) { _v.subVectors(_p, sw.lp).divideScalar(Math.max(dt, 1 / 120)).applyQuaternion(_q3.copy(_q2).invert()); } else _v.set(0, 0, 0); sw.lp = (sw.lp || new THREE.Vector3()).copy(_p);
  const tx = Math.max(-0.9, Math.min(0.9, -_v.z * 0.12)), tz = Math.max(-0.9, Math.min(0.9, _v.x * 0.12));
  sw.vx += (tx - sw.ax) * 70 * dt; sw.vz += (tz - sw.az) * 70 * dt; const damp = Math.exp(-3.5 * dt); sw.vx *= damp; sw.vz *= damp; sw.ax += sw.vx * dt; sw.az += sw.vz * dt;
  _q3.setFromEuler(_e.set(sw.ax, 0, sw.az)); _q2.multiply(_q3);
  sw.lk = (sw.lk || 0) + ((dg.userData.lookAt ? 1 : 0) - (sw.lk || 0)) * Math.min(1, dt * 6); if (dg.userData.lookAt) sw.lastAt = (sw.lastAt || new THREE.Vector3()).copy(dg.userData.lookAt);
  if (sw.lk > 0.01 && sw.lastAt) { const d = sw.lastAt.clone().sub(_p).normalize(); _q3.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d); _q2.slerp(_q3, sw.lk); } // (Soul Rend: the head turns its face to the victim)
  dg.parent.getWorldQuaternion(_q1); dg.quaternion.copy(_q1.invert().multiply(_q2));
}

// a dark ink outline round every fighter (an inverted shell pushed out along the normals), the way Smite and Marvel
// Rivals draw their heroes: bodies read clearly against the sand, the crowd and each other at any distance
const OUTLINE = new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: { col: { value: new THREE.Color('#140e0a') } },
  vertexShader: 'void main(){ vec3 n = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); float d = -mv.z; mv.xyz += n * clamp(0.006 + d * 0.0016, 0.006, 0.05); gl_Position = projectionMatrix * mv; }',
  fragmentShader: 'uniform vec3 col; void main(){ gl_FragColor = vec4(col, 1.0); }' });
const OUTL = {}; export function outlineMat(col) { if (!col) return OUTLINE; if (!OUTL[col]) { OUTL[col] = OUTLINE.clone(); OUTL[col].uniforms = { col: { value: new THREE.Color(col) } }; } return OUTL[col]; }
export function addOutline(root, col) {
  const list = []; root.traverse(o => { if (o.isMesh && !o.userData.outline && o.material && !Array.isArray(o.material) && o.material.isMeshStandardMaterial && !o.material.transparent && o.material.side !== THREE.DoubleSide && /* (thin cloth: capes, robes) */ o.geometry && o.geometry.attributes.normal) list.push(o); });
  for (const o of list) { const sh = new THREE.Mesh(o.geometry, outlineMat(col)); sh.userData.outline = true; sh.castShadow = false; sh.receiveShadow = false; sh.renderOrder = -1; sh.raycast = () => {}; o.add(sh); }
}

// music notes that rise and swirl round a body (bard songs): they follow whoever they were played on
const NOTE_T = {}; const NOTES = [];
function noteTexture(col, ch) { const k = col + ch; if (NOTE_T[k]) return NOTE_T[k]; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.font = 'bold 50px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = col; g.shadowBlur = 14; g.fillStyle = '#ffffff'; g.fillText(ch, 32, 34); g.shadowBlur = 0; g.fillStyle = col; g.fillText(ch, 32, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return (NOTE_T[k] = t); }
export function playNotes(scene, unit, col = '#ffd860', n = 6) { for (let i = 0; i < n; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: noteTexture(col, ['\u266a', '\u266b', '\u2669'][i % 3]), transparent: true, depthWrite: false })); s.scale.setScalar(0.34 + Math.random() * 0.14); scene.add(s);
  NOTES.push({ s, u: unit, t: -i * 0.12, a: Math.random() * 6.28, r: 0.55 + Math.random() * 0.35, y: 0.9 + Math.random() * 0.6 }); } }
export function notesTick(dt) { for (let i = NOTES.length - 1; i >= 0; i--) { const n = NOTES[i]; n.t += dt; const k = n.t / 1.9; if (k >= 1 || !n.u || !n.u.pos) { n.s.parent && n.s.parent.remove(n.s); n.s.material.dispose(); NOTES.splice(i, 1); continue; }
  const p = n.u.pos; n.s.visible = n.t > 0; n.s.position.set(p.x + Math.cos(n.a + n.t * 2.2) * n.r, p.y + n.y + Math.max(0, n.t) * 0.75, p.z + Math.sin(n.a + n.t * 2.2) * n.r); n.s.material.opacity = Math.min(1, (1 - k) * 2.5) * Math.min(1, Math.max(0, n.t) * 5); } }

// the bard plays: the lute comes across his chest, the left hand on the neck, the right strumming over the bowl
const _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
export function luteToChest(ch, on, t, dt = 0.016) {
  // the bard plays his lute against his chest while a song is on; it blends there and back smoothly (no snapping when he
  // swings it between strums), the strumming hand moves gently, and music notes rise from the strings
  const w = ch.weapons && ch.weapons.main, L = w && w.userData.lute; if (!L) return; const U = w.userData;
  U.calm = on ? Math.max(0, (U.calm || 0) - dt) : 0.7; const want = on && U.calm <= 0; /* (back to playing only once he has stopped swinging for a moment) */ U.pk = Math.max(0, Math.min(1, (U.pk || 0) + (want ? dt * 4 : -dt * 8))); const k = U.pk * U.pk * (3 - 2 * U.pk);
  if (k <= 0.001) { if (U.playing) { L.position.set(0, 0, 0); L.quaternion.identity(); U.playing = false; } return; }
  ch.root.updateMatrixWorld(true); const R = ch.R, th = R.torsoH - 0.2, cm = ch.chest.matrixWorld;
  const top = new THREE.Vector3(0.24, th * 0.95, 0.2).applyMatrix4(cm); // the neck end, up by the left shoulder
  const cq = ch.chest.getWorldQuaternion(new THREE.Quaternion()), Y = new THREE.Vector3(-0.62, -0.72, 0.12).normalize().applyQuaternion(cq), fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(cq);
  const Z = fwd.clone().addScaledVector(Y, -fwd.dot(Y)).normalize(), X = new THREE.Vector3().crossVectors(Y, Z);
  _q.setFromRotationMatrix(_m.makeBasis(X, Y, Z));
  const strum = Math.sin(t * 7) * 0.02; // (a slow, even strum)
  const hl = new THREE.Vector3(), hr = new THREE.Vector3(); ch.arms.L.hand.getWorldPosition(hl); ch.arms.R.hand.getWorldPosition(hr);
  armReach(ch, 'L', hl.lerp(top.clone().addScaledVector(Y, 0.16).addScaledVector(Z, -0.03), k), 6);
  armReach(ch, 'R', hr.lerp(top.clone().addScaledVector(Y, 0.5 + strum).addScaledVector(Z, 0.07).addScaledVector(X, strum * 1.2), k), 6);
  w.updateMatrixWorld(true); const inv = w.matrixWorld.clone().invert(), wq = w.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(_q);
  L.position.copy(top.clone().applyMatrix4(inv)).multiplyScalar(k); L.quaternion.identity().slerp(wq, k); U.playing = true;
  if (want && k > 0.9) { U.noteT = (U.noteT || 0) - dt; if (U.noteT <= 0) { U.noteT = 0.9; U.noteAt = U.noteAt || { pos: ch.root.position }; if (ch.root.parent) playNotes(ch.root.parent, U.noteAt, ['#ffd860', '#ff9ae0', '#9ae0ff'][Math.floor(Math.random() * 3)], 2); } }
}

// the necromancer's ultimate: a demon of the depths, built big from the waist up (it never shows more than that)
export function makeDemon() {
  // a skeletal demon of the depths: horned skull with green fire in its sockets, a cage of ribs round a burning green heart,
  // a spine of thick vertebrae, spiked shoulders and long bony arms ending in clawed hands
  const g = new THREE.Group(), bone = M('#d9cfb4', 0.55), old = M('#a89878', 0.7), dark = M('#1a1612', 0.9), horn = M('#3a2c22', 0.5), eye = GL('#7aff5a'), fire = GL('#3aff5a'), claw = M('#2a2420', 0.35, 0.3);
  // spine and vertebrae
  for (let k = 0; k < 9; k++) { const v = add(g, cylG(0.17, 0.2, 0.22, 10), k % 2 ? old : bone, 0, 0.2 + k * 0.33, -0.35); add(v, boxG(0.12, 0.14, 0.32), bone, 0, 0, -0.2); }
  // ribcage: arcs that curve out and round to a breastbone
  for (let k = 0; k < 6; k++) { const y = 1.15 + k * 0.32, w = 0.95 + Math.sin((k + 1) / 7 * Math.PI) * 0.35;
    for (const sx of [-1, 1]) { const rib = add(g, new THREE.TorusGeometry(w, 0.065, 6, 18, Math.PI * 0.82), k % 2 ? old : bone, 0, y, -0.25); rib.rotation.set(Math.PI / 2 - 0.12, 0, sx > 0 ? -0.15 : Math.PI + 0.15); rib.scale.set(1, 0.85, 1); } }
  add(g, boxG(0.18, 1.7, 0.12), bone, 0, 1.9, 0.62).rotation.x = -0.12; // breastbone
  const heart = add(g, sph(0.42, 14, 10), fire, 0, 1.85, 0.05); heart.castShadow = false; g.userData.heart = heart;
  // shoulders: collarbones, big round joints with spikes
  for (const sx of [-1, 1]) { add(g, cylG(0.09, 0.09, 1.5, 8), bone, sx * 0.75, 3.15, 0).rotation.z = Math.PI / 2; const shj = add(g, sph(0.36, 12, 10), bone, sx * 1.55, 3.15, -0.05);
    for (let k = 0; k < 3; k++) { const sp = add(shj, coneG(0.09, 0.75 - k * 0.12, 6), horn, sx * 0.12, 0.3, -0.18 + k * 0.18); sp.rotation.z = -sx * (0.35 + k * 0.15); } }
  // the skull: cranium, brow, deep sockets with green fire, cheekbones, upper teeth, swept horns
  const head = new THREE.Group(); head.position.set(0, 4.05, 0.05); g.add(head);
  add(head, sph(0.6, 18, 14), bone).scale.set(0.95, 0.92, 1.12);
  add(head, boxG(0.95, 0.16, 0.3), old, 0, 0.2, 0.5).rotation.x = 0.25; // brow ridge
  for (const sx of [-1, 1]) { const so = add(head, sph(0.17, 10, 8), dark, sx * 0.24, 0.04, 0.55); so.scale.set(1, 0.85, 0.5); const e = add(head, sph(0.08, 8, 6), eye, sx * 0.24, 0.04, 0.62); e.castShadow = false;
    add(head, boxG(0.16, 0.12, 0.4), bone, sx * 0.4, -0.16, 0.38).rotation.y = sx * 0.3; // cheekbones
    const h = new THREE.Group(); h.position.set(sx * 0.4, 0.42, -0.1); h.rotation.set(-0.6, 0, -sx * 0.55); head.add(h); let y = 0, r = 0.17;
    for (let k = 0; k < 6; k++) { const sg = add(h, cylG(r * 0.75, r, 0.34, 8), horn, 0, y + 0.17, 0); sg.rotation.x = -0.22 * k; y += 0.3; r *= 0.8; } }
  add(head, coneG(0.09, 0.2, 3), dark, 0, -0.1, 0.66).rotation.x = Math.PI; // nose hole
  add(head, boxG(0.62, 0.14, 0.3), bone, 0, -0.33, 0.45); // upper jaw
  for (let k = 0; k < 8; k++) add(head, coneG(0.04, 0.19, 4), bone, -0.28 + k * 0.08, -0.46, 0.58).rotation.x = Math.PI;
  const jaw = new THREE.Group(); jaw.position.set(0, -0.36, 0.1); head.add(jaw); add(jaw, boxG(0.64, 0.13, 0.62), bone, 0, -0.1, 0.28); for (const sx of [-1, 1]) add(jaw, boxG(0.1, 0.36, 0.14), bone, sx * 0.3, 0.06, -0.02);
  for (let k = 0; k < 8; k++) add(jaw, coneG(0.04, 0.18, 4), bone, -0.28 + k * 0.08, 0.02, 0.55);
  const throat = add(head, sph(0.22, 10, 8), fire, 0, -0.45, 0.25); throat.castShadow = false; // green fire down its throat
  // long bony arms: upper bone, elbow knob, two forearm bones, a clawed hand of long finger bones
  const arms = {};
  for (const sx of [-1, 1]) { const sh = new THREE.Group(); sh.position.set(sx * 1.6, 3.05, 0.05); g.add(sh);
    add(sh, cylG(0.13, 0.11, 1.55, 10), bone, 0, -0.8, 0); add(sh, sph(0.17, 10, 8), old, 0, -1.6, 0);
    const el = new THREE.Group(); el.position.set(0, -1.6, 0); sh.add(el); for (const dx of [-0.08, 0.08]) add(el, cylG(0.07, 0.06, 1.5, 8), dx > 0 ? bone : old, dx, -0.76, 0);
    const hand = new THREE.Group(); hand.position.set(0, -1.55, 0); el.add(hand); add(hand, boxG(0.34, 0.18, 0.3), bone, 0, -0.06, 0);
    for (let k = 0; k < 4; k++) { const f = new THREE.Group(); f.position.set(-0.15 + k * 0.1, -0.12, 0.08); f.rotation.x = 0.5; hand.add(f); add(f, cylG(0.035, 0.03, 0.42, 6), bone, 0, -0.21, 0); const f2 = new THREE.Group(); f2.position.set(0, -0.42, 0); f2.rotation.x = 0.7; f.add(f2); add(f2, cylG(0.03, 0.025, 0.34, 6), bone, 0, -0.17, 0); add(f2, coneG(0.03, 0.2, 5), claw, 0, -0.42, 0).rotation.x = Math.PI; }
    const th = add(hand, cylG(0.035, 0.03, 0.4, 6), bone, sx * 0.2, -0.15, 0.1); th.rotation.z = sx * 0.6;
    const ooze = M('#3aff3a', 0.12, 0.05, { emissive: '#14a020', emissiveIntensity: 0.7 }); /* (green ooze slathered over the hand, hanging in drips) */
    for (let k = 0; k < 9; k++) { const o2 = add(hand, sph(0.07 + (k % 3) * 0.025, 8, 6), ooze, (Math.random() - 0.5) * 0.36, -0.05 - Math.random() * 0.45, (Math.random() - 0.3) * 0.25); o2.scale.set(1, 1.3, 1); }
    for (let k = 0; k < 5; k++) { const d2 = add(hand, sph(0.035, 6, 5), ooze, -0.15 + k * 0.075, -0.55 - (k % 2) * 0.12, 0.12); d2.scale.set(1, 2.6, 1); }
    add(el, sph(0.1, 8, 6), ooze, 0, -1.3, 0.02).scale.set(1, 2, 1);
    arms[sx > 0 ? 'L' : 'R'] = { sh, el, hand }; }
  return { g, jaw, head, arms, heart, throat };
}

// a full ring of green hellfire round the demon's pit, with a cracked, glowing floor inside it
let FLAME_T = null, CRACK_T = null;
function flameTex() { if (FLAME_T) return FLAME_T; const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 92, 2, 32, 80, 54); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.85)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.beginPath(); x.moveTo(32, 2); x.bezierCurveTo(52, 50, 62, 80, 50, 110); x.quadraticCurveTo(32, 128, 14, 110); x.bezierCurveTo(2, 80, 12, 50, 32, 2); x.fill(); FLAME_T = new THREE.CanvasTexture(c); return FLAME_T; }
function crackTex() { if (CRACK_T) return CRACK_T; const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  const gr = x.createRadialGradient(128, 128, 10, 128, 128, 128); gr.addColorStop(0, 'rgba(10,30,10,0.95)'); gr.addColorStop(0.7, 'rgba(15,20,12,0.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = '#6aff6a'; x.shadowColor = '#3aff4a'; x.shadowBlur = 8; x.lineCap = 'round';
  for (let i = 0; i < 14; i++) { let a = i / 14 * Math.PI * 2 + Math.random() * 0.3, r = 8, px = 128, py = 128; x.lineWidth = 3; x.beginPath(); x.moveTo(px, py);
    while (r < 118) { r += 10 + Math.random() * 12; a += (Math.random() - 0.5) * 0.5; px = 128 + Math.cos(a) * r; py = 128 + Math.sin(a) * r; x.lineTo(px, py); } x.stroke(); }
  CRACK_T = new THREE.CanvasTexture(c); return CRACK_T; }
export function makeHellRing(radius = 4.6, n = 40) {
  const g = new THREE.Group(), flames = [], tex = flameTex();
  const floor = new THREE.Mesh(new THREE.CircleGeometry(radius + 0.4, 48), new THREE.MeshBasicMaterial({ map: crackTex(), transparent: true, depthWrite: false, opacity: 0 })); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.05; g.add(floor);
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, fg = new THREE.Group(); fg.position.set(Math.cos(a) * radius, 0, Math.sin(a) * radius); g.add(fg);
    const outer = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: '#22ff44', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    const inner = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: '#d8ffc0', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    fg.add(outer, inner); flames.push({ fg, outer, inner, ph: Math.random() * 10, sp: 7 + Math.random() * 6, a }); }
  // k: 0..1 how fully lit the ring is (lights up in a sweep round the circle); t: time
  g.userData.tick = (k, t) => { floor.material.opacity = Math.min(1, k * 1.2) * 0.95;
    for (const f of flames) { const on = Math.max(0, Math.min(1, k * 1.6 - (f.a / (Math.PI * 2)) * 0.6)); const fl = 0.75 + 0.25 * Math.sin(t * f.sp + f.ph) + 0.15 * Math.sin(t * f.sp * 2.3 + f.ph * 2);
      const h = (1.3 + 1.1 * on) * fl * on; f.outer.scale.set(0.8 * on + 0.01, h + 0.01, 1); f.outer.position.y = h * 0.45; f.inner.scale.set(0.55 * on + 0.01, h * 0.6 + 0.01, 1); f.inner.position.y = h * 0.3;
      f.outer.material.opacity = 0.5 * on; f.inner.material.opacity = 0.42 * on; f.fg.position.x += Math.sin(t * 3 + f.ph) * 0.002; } };
  return g;
}

// ---- the paladin's ultimate: a giant sword of light, the judgment glyph on the ground, golden wings ----
let GLYPH_T = null;
function glyphTex() { if (GLYPH_T) return GLYPH_T; const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'), m = 256;
  x.strokeStyle = '#ffe9a0'; x.fillStyle = '#ffe9a0'; x.shadowColor = '#ffc840'; x.shadowBlur = 14; x.lineCap = 'round';
  const ring = (r, w) => { x.lineWidth = w; x.beginPath(); x.arc(m, m, r, 0, Math.PI * 2); x.stroke(); };
  ring(246, 8); ring(226, 3); ring(150, 5); ring(70, 4);
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; x.save(); x.translate(m + Math.cos(a) * 236, m + Math.sin(a) * 236); x.rotate(a + Math.PI / 2); x.font = 'bold 22px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ'[i], 0, 0); x.restore(); }
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; x.lineWidth = i % 2 ? 3 : 6; x.beginPath(); x.moveTo(m + Math.cos(a) * 70, m + Math.sin(a) * 70); x.lineTo(m + Math.cos(a) * 226, m + Math.sin(a) * 226); x.stroke(); }
  x.lineWidth = 10; x.beginPath(); x.moveTo(m, m - 120); x.lineTo(m, m + 120); x.moveTo(m - 80, m - 40); x.lineTo(m + 80, m - 40); x.stroke(); // a cross at the heart
  GLYPH_T = new THREE.CanvasTexture(c); GLYPH_T.colorSpace = THREE.SRGBColorSpace; return GLYPH_T; }
export function makeGlyph(radius) { const m = new THREE.Mesh(new THREE.CircleGeometry(radius, 64), new THREE.MeshBasicMaterial({ map: glyphTex(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, color: '#ffd870' })); m.rotation.x = -Math.PI / 2; return m; }
export function makeLightSword() {
  // blade down -Y from the crossguard; ~12 m long; a white-hot core in a golden glow
  const g = new THREE.Group(), gold = M('#ffd060', 0.25, 0.9, { emissive: '#ffb020', emissiveIntensity: 0.9 }), core = M('#fffbe8', 0.2, 0.2, { emissive: '#fff4c8', emissiveIntensity: 1.4 });
  const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.02, 12, 4, 1), core); blade.scale.set(1, 1, 0.22); blade.rotation.y = Math.PI / 4; blade.position.y = -6; g.add(blade);
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.05, 12.4, 4, 1), new THREE.MeshBasicMaterial({ color: '#ffd060', transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.set(1, 1, 0.35); glow.rotation.y = Math.PI / 4; glow.position.y = -6.1; g.add(glow);
  const guard = add(g, boxG(3.4, 0.38, 0.5), gold, 0, 0.1, 0); for (const sx of [-1, 1]) { add(g, sph(0.32, 12, 10), gold, sx * 1.8, 0.1, 0); add(g, coneG(0.18, 0.6, 8), gold, sx * 1.55, -0.35, 0).rotation.z = sx * 0.5; }
  add(g, cylG(0.17, 0.17, 2.0, 10), M('#6a4a2a', 0.6), 0, 1.25, 0); for (let i = 0; i < 4; i++) add(g, new THREE.TorusGeometry(0.19, 0.035, 6, 14), gold, 0, 0.5 + i * 0.45, 0).rotation.x = Math.PI / 2;
  add(g, sph(0.36, 14, 12), gold, 0, 2.45, 0); const gem = add(g, sph(0.2, 12, 10), GL('#fff8c0'), 0, 0.1, 0.26); gem.castShadow = false;
  const halo = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.06, 8, 40), new THREE.MeshBasicMaterial({ color: '#fff0a0', transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending })); halo.position.y = 1.4; halo.rotation.x = Math.PI / 2; g.add(halo);
  g.userData = { halo, glow };
  return g;
}
export function makeWings() { // golden wings of light: three tiers of long feathers on each side, folded until they bloom
  const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: '#ffd870', transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const sides = [];
  for (const sx of [-1, 1]) { const w = new THREE.Group(); w.position.set(sx * 0.12, 0, 0); g.add(w); sides.push(w);
    for (let i = 0; i < 9; i++) { const len = 0.7 + i * 0.13, f = new THREE.Mesh(new THREE.PlaneGeometry(0.16, len), mat); const a = 0.25 + i * 0.16; f.position.set(sx * (0.15 + i * 0.13), 0.15 + Math.sin(a) * 0.45 - len * 0.35, -0.05); f.rotation.z = sx * (0.35 + i * 0.09); w.add(f); }
    for (let i = 0; i < 6; i++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.45), mat); f.position.set(sx * (0.2 + i * 0.16), 0.32, -0.04); f.rotation.z = sx * 1.2; w.add(f); } }
  g.userData.sides = sides; g.userData.mat = mat; return g;
}

// ---- arrows for the ranger's Rain of Arrows (shared geometry, cheap to make by the hundred) ----
const AR_G = { shaft: new THREE.CylinderGeometry(0.018, 0.018, 0.85, 5), head: new THREE.ConeGeometry(0.045, 0.14, 5), fl: new THREE.PlaneGeometry(0.09, 0.15) }; let AR_M = null;
export function makeArrow() { if (!AR_M) AR_M = { shaft: M('#7a5a3a', 0.7), head: M('#9aa0a8', 0.3, 0.8), fl: new THREE.MeshStandardMaterial({ color: '#d84a2a', roughness: 0.8, side: THREE.DoubleSide }) };
  const g = new THREE.Group(); const s = new THREE.Mesh(AR_G.shaft, AR_M.shaft); g.add(s); const h = new THREE.Mesh(AR_G.head, AR_M.head); h.position.y = -0.49; h.rotation.x = Math.PI; g.add(h);
  for (let i = 0; i < 2; i++) { const f = new THREE.Mesh(AR_G.fl, AR_M.fl); f.position.y = 0.36; f.rotation.y = i * Math.PI / 2; g.add(f); } return g; } // (point down -Y)

// ---- the beastmaster's claws: three long steel blades from the knuckles of each fist (along the grip's +Y) ----
export function makeClaws(len = 0.42) { const g = new THREE.Group(), steel = M('#c8ccd4', 0.22, 0.95), base = M('#3a3a40', 0.5, 0.8);
  add(g, boxG(0.085, 0.05, 0.06), base, 0, 0.02, 0); // (the housing over the knuckles)
  for (let i = 0; i < 3; i++) { const b = add(g, new THREE.CylinderGeometry(0.004, 0.012, len, 4), steel, -0.028 + i * 0.028, 0.045 + len / 2, 0.005); b.scale.set(1, 1, 2.2); b.rotation.x = 0.05; b.rotation.z = (i - 1) * -0.04; }
  return g; }

// ---- goblin guns: cheap rusty steel, mismatched plates, pipes, gears and gadgets bolted on (barrel along +Y) ----
export function goblinGun(w, cls, s = 1) { if (!w || w.userData.goblin) return; w.userData.goblin = true;
  const rust = M('#7a5236', 0.75, 0.45), steel = M('#6a6a66', 0.5, 0.75), brass = M('#b08a3a', 0.4, 0.85), rag = M('#8a7a5a', 0.95), dark = M('#2a2420', 0.8), glow = GL(cls === 'blunderbuss' ? '#ff9a3a' : '#7aff5a');
  if (cls !== 'musketeer') w.traverse(o => { if (o.isMesh && o.material && o.material.metalness > 0.5) { o.material = o.material.clone(); o.material.color.lerp(new THREE.Color('#7a5a40'), 0.55); o.material.roughness = Math.max(o.material.roughness, 0.6); } }); // (rust over the steel)
  const a = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x * s, y * s, z * s); o.rotation.set(rx, ry, rz); o.scale.setScalar(s); o.castShadow = true; w.add(o); return o; };
  const gear = (x, y, z, r, ry = 0) => { const g = a(new THREE.TorusGeometry(r, r * 0.28, 5, 10), steel, x, y, z, 0, ry, 0); for (let i = 0; i < 8; i++) { const t2 = new THREE.Mesh(new THREE.BoxGeometry(r * 0.35, r * 0.35, r * 0.4), steel); const an = i / 8 * Math.PI * 2; t2.position.set(Math.cos(an) * r * 1.25, Math.sin(an) * r * 1.25, 0); g.add(t2); } return g; };
  if (cls !== 'musketeer') for (const [y, z] of [[0.15, 0.03], [0.42, -0.03], [0.6, 0.02]]) a(new THREE.BoxGeometry(0.05, 0.08, 0.012), rust, 0.03, y, z, 0, 0, 0.3); // (mismatched patches)
  if (cls !== 'musketeer') for (let i = 0; i < 6; i++) a(new THREE.SphereGeometry(0.008, 5, 4), brass, 0.028, 0.1 + i * 0.1, 0.02); // (rivets)
  if (cls !== 'musketeer') a(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 8), rag, 0, -0.06, 0); // (rag-wrapped grip)
  if (cls === 'musketeer') { /* (the musketeer carries the detailed musket model: nothing bolted on) */ }
  else { // the bruiser's hand-cannon: a fat flared barrel ringed with spikes, a smokestack, twin feed pipes, a brass gauge, a spring, a chained powder flask
    for (let i = 0; i < 8; i++) { const an = i / 8 * Math.PI * 2; a(new THREE.ConeGeometry(0.009, 0.045, 5), steel, Math.cos(an) * 0.074, 0.835, 0.03 + Math.sin(an) * 0.074, Math.sin(an) * 1.0, 0, -Math.cos(an) * 1.0); } /* (short spikes round the bell's lip) */
    a(new THREE.CylinderGeometry(0.015, 0.02, 0.1, 8), dark, 0.0, 0.25, 0.06); a(new THREE.CylinderGeometry(0.025, 0.015, 0.03, 8), dark, 0, 0.31, 0.06); // (a little smokestack)
    for (const x of [-0.04, 0.04]) a(new THREE.CylinderGeometry(0.009, 0.009, 0.36, 6), brass, x, 0.35, -0.035);
    a(new THREE.CylinderGeometry(0.03, 0.03, 0.014, 12), brass, 0.045, 0.12, 0.0, 0, 0, Math.PI / 2); a(new THREE.SphereGeometry(0.012, 6, 5), glow, 0.054, 0.12, 0);
    const fl = a(new THREE.SphereGeometry(0.035, 10, 8), M('#5a3a1a', 0.8), 0.05, -0.02, -0.04); fl.scale.set(1, 1.3, 0.7); for (let i = 0; i < 3; i++) a(new THREE.TorusGeometry(0.008, 0.002, 4, 8), steel, 0.05, 0.03 + i * 0.012, -0.04, Math.PI / 2 * (i % 2)); }
}

// ---- how each class stands, walks and runs (read by animateHumanoid via ch.style; see styleApply in herodetail.js) ----
// crouch/wide/toe/hunch/chest/head/arms/elbow are offsets (radians, crouch in m); cadence/stride/bob/swing multiply the
// gait; swagger rolls the hips with the stride, rock sways side to side, runLean tips forward at a run.
export const STYLE = {
  warrior: { wide: 0.14, chest: 0.168, arms: 0.21, elbow: 0.13, stride: 1.05, swing: 1.0 }, // proud, square, ready
  paladin: { wide: 0.07, chest: 0.28, head: -0.078, arms: 0.12, cadence: 0.88, bob: 0.45, swing: 0.6, stride: 1.05 }, // upright, stately, a glide
  darkknight: { hunch: 0.232, head: 0.286, wide: 0.196, arms: 0.27, elbow: 0.195, cadence: 0.78, stride: 1.25, bob: 1.2, swing: 0.55, runLean: 0.13 }, // menacing, head low, heavy long strides
  berserker: { hunch: 0.464, head: -0.065, wide: 0.28, toe: 0.24, arms: 0.57, elbow: 0.455, crouch: 0.075, swagger: 1.8, bob: 1.6, swing: 1.5, runLean: 0.195 }, // an ape-like brute
  blunderbuss: { wide: 0.336, toe: 0.384, crouch: 0.075, arms: 0.42, elbow: 0.26, rock: 0.11, cadence: 1.25, stride: 0.72, bob: 0.7, swing: 0.7 }, // a squat waddle
  monk: { tiptoe: 0.15, chest: 0.084, crouch: 0.045, stride: 1.25, cadence: 1.05, bob: 1.1, swing: 0.85, runLean: 0.104, idleSway: 0.03 }, // light on the balls of the feet, flowing
  rogue: { crouch: 0.15, hunch: 0.348, head: -0.052, stride: 1.1, cadence: 1.08, bob: 0.45, swing: 0.45, elbow: 0.325, runLean: 0.156 }, // low and sneaky, smooth
  ranger: { hunch: 0.145, crouch: 0.06, head: -0.052, stride: 1.15, swing: 0.8, runLean: 0.156 }, // alert, leaning in
  musketeer: { hunch: 0.522, head: -0.39, crouch: 0.12, elbow: 0.26, cadence: 1.4, stride: 0.78, bob: 0.8, swing: 0.55, jitter: 0.03 }, // a hunched goblin scuttle
  beastmaster: { hunch: 0.609, head: -0.416, crouch: 0.15, wide: 0.21, arms: 0.48, elbow: 0.585, swagger: 1.0, runLean: 0.364, stride: 1.15, swing: 1.2 }, // a feral prowl
  bard: { chest: 0.14, head: -0.065, swagger: 1.7, bob: 1.7, cadence: 1.05, swing: 1.2, idleSway: 0.05 }, // jaunty, bouncy
  wizard: { hunch: 0.203, head: 0.078, stride: 0.82, swing: 0.45, bob: 0.5, cadence: 0.92 }, // a scholar's stoop
  necromancer: { hunch: 0.319, head: 0.208, arms: 0.15, elbow: 0.39, armFwd: 0.15, bob: 0.12, swing: 0.15, stride: 0.88, cadence: 0.85 }, // a creepy, near-floating glide
  elementalist: { chest: 0.168, arms: 0.36, elbow: 0.325, bob: 1.25, swing: 0.9, cadence: 1.05 }, // energetic, arms out and crackling
  enchanter: { wide: -0.07, chest: 0.14, swagger: 1.5, rock: 0.04, bob: 0.65, swing: 0.6, idleSway: 0.04 }, // graceful, a narrow sway
  cleric: { chest: 0.112, head: -0.052, cadence: 0.84, stride: 0.82, bob: 0.4, swing: 0.4 }, // dignified, slow
  druid: { hunch: 0.116, toe: 0.12, stride: 1.12, bob: 1.15, swing: 1.0, cadence: 0.95 }, // earthy, loping
  shaman: { wide: 0.224, crouch: 0.06, chest: 0.07, arms: 0.24, swagger: 1.3, bob: 1.1, cadence: 0.95 }, // heavy and tribal
  priest: { chest: 0.14, head: -0.039, clasp: 1, cadence: 0.8, stride: 0.8, bob: 0.25, swing: 0.25 }, // serene, hands clasped, a slow glide
  bombardier: { hunch: 0.493, head: -0.364, crouch: 0.105, arms: 0.45, elbow: 0.39, cadence: 1.5, stride: 0.75, bob: 0.9, swing: 1.1, jitter: 0.05 }, // a jittery goblin scurry
};
export function arenaStyle(cls) { return STYLE[cls] || null; }
