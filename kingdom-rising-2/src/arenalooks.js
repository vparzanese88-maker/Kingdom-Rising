// Kingdom Arena avatars: no gear slots, every class has one look you can tell from across the sand (like picking a
// god in Smite). arenaSpec() is the outfit palette fed to buildHumanoid; arenaDecor() adds each class's signature
// pieces (helmets, hats, hoods, masks, mantles, orbs); arenaWeaponDecor() dresses the weapon (the necromancer's skull staff).
import * as THREE from 'three';
import { armReach } from './character.js';

const M = (c, r = 0.8, m = 0, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: r, metalness: m }, o));
const GL = (c) => new THREE.MeshBasicMaterial({ color: c });
const add = (parent, geo, mat, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
const sph = (r, ws = 14, hs = 10) => new THREE.SphereGeometry(r, ws, hs);
const boxG = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cylG = (rt, rb, h, s = 12) => new THREE.CylinderGeometry(rt, rb, h, s);
const coneG = (r, h, s = 8) => new THREE.ConeGeometry(r, h, s);

const SPEC = {
  necromancer: { shirt: '#18161a', robe: '#121014', trim: '#3c3a40', pants: '#100e12', boots: '#0c0a0c', hood: '#0b0a0d', sash: '#2c2a30', sleeves: true, belt: '#1a1418' },
  wizard: { shirt: '#22327e', robe: '#1e2c74', trim: '#e0b84a', pants: '#1a1a3a', boots: '#3a2a1a', hat: 'pointy', hatCol: '#1e2c74', sash: '#e0b84a', sleeves: true },
  elementalist: { shirt: '#8a2a12', robe: '#173a6e', trim: '#ffb040', pants: '#2a1a12', boots: '#2a1a12', sash: '#ff7a20', sleeves: true },
  enchanter: { shirt: '#7a2a8a', robe: '#5e1f70', trim: '#f0b8ff', pants: '#2a1a3a', boots: '#3a1a3a', shawl: '#e070c8', sash: '#f0b8ff', sleeves: true },
  druid: { shirt: '#5a4a2a', robe: '#3e5226', trim: '#9ad060', pants: '#3a3020', boots: '#4a3220', shawl: '#6a7a34', sash: '#8a6a3a', sleeves: true },
  shaman: { shirt: '#6a4226', vest: '#2a6a7a', trim: '#e0c070', pants: '#3a2a1e', boots: '#4a3220', belt: '#6b4a2a', shawl: '#8a6a44', sash: '#c04020', bracers: '#5a3a22' },
  cleric: { shirt: '#ece6d8', robe: '#f2ece0', trim: '#d8b04a', pants: '#d8d0c0', boots: '#8a6a3a', sash: '#d8b04a', sleeves: true },
  bard: { shirt: '#f0d070', vest: '#a0285a', trim: '#f0d070', pants: '#3a2a5a', boots: '#5a3220', belt: '#3a2010', cloak: '#3a6ab0', bracers: '#a0285a' },
  warrior: { shirt: '#5b5f66', mail: '#9aa0a8', tabard: '#8a1a1a', trim: '#d8b04a', pants: '#3a2f28', boots: '#2b211a', pauldrons: true, belt: '#3a2a1a', bracers: '#9aa0a8' },
  paladin: { shirt: '#c8ccd4', mail: '#e8e4d8', tabard: '#f4f0e4', trim: '#e0b040', pants: '#d0ccc0', boots: '#8a6a30', pauldrons: true, belt: '#8a6a30', bracers: '#e0b040', cloak: '#f0e8d0' },
  darkknight: { shirt: '#1a1a1e', mail: '#24242a', tabard: '#4a0a0e', trim: '#8a1a1a', pants: '#141418', boots: '#0c0c0e', pauldrons: true, belt: '#1a0a0a', bracers: '#24242a', cloak: '#1a0a0e' },
  berserker: { shirt: '#8a5a3a', vest: '#5a3a22', pants: '#3a2a1e', boots: '#3a2416', belt: '#2a1a10', bracers: '#5a3a22', bareArms: true, sash: '#9a2a1a' },
  monk: { shirt: '#d8781c', robe: '#e8901e', pants: '#7a3410', boots: '#4a2a14', sash: '#a01a1a', bareArms: true, belt: '#a01a1a' }, // (a long saffron robe over dark trousers)
  rogue: { shirt: '#1e1c24', vest: '#2a2632', pants: '#18161c', boots: '#100e12', hood: '#16141a', mask: '#16141a', belt: '#3a1a2a', bracers: '#2a2632', cloak: '#141218' },
  ranger: { shirt: '#5a3f26', vest: '#6b4a2a', pants: '#3c4a2a', boots: '#4a3220', hood: '#2e5a26', cloak: '#2e5a26', quiver: true, belt: '#3a2a1a', bracers: '#5a3a22' },
  musketeer: { shirt: '#5a4a2a', vest: '#3a2c1c', trim: '#8a6a3a', pants: '#4a3a22', boots: '#2a1a10', belt: '#2a1a10', bracers: '#3a2c1c' }, // (a goblin sharpshooter's patched leathers)
  blunderbuss: { shirt: '#6a3a1a', vest: '#5a4a3a', trim: '#8a5a2a', pants: '#3a2a1a', boots: '#2a1a10', belt: '#3a2a1a', bracers: '#6a5a4a' }, // (a goblin bruiser in scrap and leather)
  beastmaster: { shirt: '#4a3a28', vest: '#6a5034', pants: '#3c3024', boots: '#3a2416', belt: '#2a1a10', bracers: '#6a5034', bareArms: true },
};
export function arenaSpec(cls) { return SPEC[cls] || null; }
// each class's build (see BODY in character.js): brutes, knights, heavies, athletes, lean casters, sturdy priests
const BUILD = { berserker: 'brute', beastmaster: 'brute', warrior: 'knight', paladin: 'knight', darkknight: 'knight', blunderbuss: 'heavy', shaman: 'heavy',
  rogue: 'athlete', ranger: 'athlete', monk: 'lean', musketeer: 'lean', bard: 'athlete', wizard: 'lean', necromancer: 'lean', enchanter: 'lean', elementalist: 'lean', cleric: 'sturdy', druid: 'sturdy' };
export function arenaBody(cls) { return BUILD[cls] || 'athlete'; }

// ---- signature pieces ----
const bone = () => M('#e6dcc4', 0.6), iron = (c = '#3a3a40') => M(c, 0.4, 0.85), gold = () => M('#d8b04a', 0.35, 0.85), fur = (c) => M(c, 1);
function skullFace(hg) { // a bone skull where the face should be, black sockets, green embers for eyes
  const b = bone(), dk = GL('#050505'), g = add(hg, sph(0.118, 16, 12), b, 0, 0.1, 0.018); g.scale.set(0.98, 1.05, 1.02);
  const jaw = add(hg, boxG(0.15, 0.06, 0.1), b, 0, 0.02, 0.05); jaw.rotation.x = 0.1;
  for (const x of [-0.042, 0.042]) { add(hg, sph(0.03, 10, 8), dk, x, 0.105, 0.105); add(hg, sph(0.019, 8, 6), GL('#8aff5a'), x, 0.105, 0.124); add(hg, sph(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: '#5aff3a', transparent: true, opacity: 0.35, depthWrite: false }), x, 0.105, 0.13); }
  add(hg, coneG(0.016, 0.03, 3), dk, 0, 0.07, 0.122).rotation.x = Math.PI;
  for (let i = 0; i < 6; i++) add(hg, boxG(0.012, 0.018, 0.01), b, -0.032 + i * 0.013, 0.04, 0.1);
}
function hideHair(ch) { ch.headG.traverse(o => { if (o.isMesh && o.material === ch.mats.hair) o.visible = false; }); }
function horns(hg, c = '#e8dcc0', big = 1) { for (const s of [-1, 1]) { const h = new THREE.Group(); h.position.set(s * 0.12, 0.17, 0); h.rotation.z = -s * 1.1; hg.add(h); let y = 0, r = 0.035 * big; for (let k = 0; k < 4; k++) { const seg = add(h, cylG(r * 0.75, r, 0.06 * big, 8), M(c, 0.5), 0, y + 0.03 * big, 0); seg.rotation.z = s * 0.25 * k; y += 0.055 * big; r *= 0.75; h.rotation.z += s * 0.12; } } }
function helm(hg, col, open = false) { const m = iron(col); const h = add(hg, sph(0.142, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), m, 0, 0.1, 0); h.geometry = new THREE.SphereGeometry(0.142, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62);
  if (!open) { const face = add(hg, cylG(0.135, 0.13, 0.13, 16, 1, true), m, 0, 0.05, 0); face.geometry = new THREE.CylinderGeometry(0.135, 0.128, 0.13, 16, 1, true, -Math.PI * 0.85, Math.PI * 1.7); face.material = m.clone(); face.material.side = THREE.DoubleSide; add(hg, boxG(0.16, 0.012, 0.02), GL('#050505'), 0, 0.09, 0.132); add(hg, boxG(0.012, 0.07, 0.02), m, 0, 0.05, 0.135); }
  add(hg, cylG(0.146, 0.146, 0.022, 18), m, 0, 0.11, 0); return m; }
function mantle(ch, c, r = 0.2) { const t = add(ch.chest, new THREE.TorusGeometry(r, 0.07, 8, 16), fur(c), 0, ch.R.torsoH - 0.18, 0); t.rotation.x = Math.PI / 2; t.scale.set(1, 0.75, 1); return t; }
function shoulderSpikes(ch, m, n = 3) { for (const s of [-1, 1]) { const g = new THREE.Group(); g.position.set(s * (ch.R.sw + 0.02), ch.R.torsoH - 0.2, 0); ch.chest.add(g); add(g, sph(0.09, 12, 8), m).scale.set(1, 0.7, 1.1); for (let k = 0; k < n; k++) { const sp = add(g, coneG(0.022, 0.12, 6), m, s * 0.03, 0.06, -0.04 + k * 0.04); sp.rotation.z = -s * 0.5; } } }
function backItem(ch, obj, y = 0.05) { obj.position.set(0, ch.R.torsoH * 0.5 + y, -0.17); ch.chest.add(obj); return obj; }

// ---- general kit: plate, leather and cloth pieces that give every body more detail ----
function breastplate(ch, m, trim) { const R = ch.R, th = R.torsoH - 0.2, T = R.thick; const b = add(ch.chest, sph(0.2, 18, 12), m, 0, th * 0.55, 0.035); b.scale.set(R.sw / 0.2 * 1.02, th / 0.2 * 0.62, 0.78 * T); b.geometry = new THREE.SphereGeometry(0.2, 18, 12, -Math.PI * 0.5, Math.PI, 0, Math.PI);
  if (trim) { const r = add(ch.chest, new THREE.TorusGeometry(0.17, 0.012, 6, 20, Math.PI), trim, 0, th * 0.18, 0.08); r.scale.set(R.sw / 0.2, 1, 1); r.rotation.x = Math.PI / 2 + 0.25; r.rotation.z = Math.PI; }
  add(ch.spine, cylG(0.16 * T, 0.15 * T, 0.12, 16), m, 0, 0.0, 0).scale.z = 0.8; }
function pauldrons(ch, m, size = 1) { for (const sd of ['L', 'R']) { const p = add(ch.arms[sd].sh, sph(0.1 * size, 14, 10), m, 0, 0.01, 0); p.geometry = new THREE.SphereGeometry(0.1 * size, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55); p.scale.set(1.15, 0.9, 1.1);
  const p2 = add(ch.arms[sd].sh, sph(0.085 * size, 12, 8), m, 0, -0.05, 0); p2.geometry = new THREE.SphereGeometry(0.085 * size, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5); p2.scale.set(1.1, 0.7, 1.05); } }
function gauntlets(ch, m, cuff = true) { const fa = ch.R.armL * 0.46, T = ch.R.thick; for (const sd of ['L', 'R']) { const el = ch.arms[sd].el; add(el, cylG(0.05 * T, 0.058 * T, fa * 0.5, 12), m, 0, -fa * 0.68, 0); if (cuff) add(el, cylG(0.068 * T, 0.06 * T, 0.05, 12), m, 0, -fa * 0.44, 0); add(ch.arms[sd].hand, sph(0.052, 10, 8), m, 0, -0.045, 0.005).scale.set(0.9 * Math.min(1.4, T), 1.2, 0.68 * Math.min(1.4, T)); } }
function gloves(ch, c) { const m = M(c, 0.8); for (const sd of ['L', 'R']) add(ch.arms[sd].hand, sph(0.051, 10, 8), m, 0, -0.045, 0.005).scale.set(0.88 * Math.min(1.4, ch.R.thick), 1.22, 0.64 * Math.min(1.4, ch.R.thick)); }
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
  warrior(ch) { const m = steel(); breastplate(ch, m, gold()); pauldrons(ch, m); gauntlets(ch, m); greaves(ch, m); belt(ch, '#3a2416'); },
  paladin(ch) { const m = steel('#dcdcd4'), g = gold(); breastplate(ch, m, g); pauldrons(ch, g, 1.1); gauntlets(ch, m); greaves(ch, m); belt(ch, '#8a6a30', '#f0d070'); },
  darkknight(ch) { const m = steel('#26262c'); breastplate(ch, m, M('#7a1010', 0.5, 0.5)); gauntlets(ch, m); greaves(ch, m); belt(ch, '#1a0a0a', '#7a1010'); },
  berserker(ch) { gauntlets(ch, fur('#5a3a22')); straps(ch, '#3a2416'); belt(ch, '#3a2416', '#9aa0a8', 1); bootCuffs(ch, '#6a4a2a'); },
  blunderbuss(ch) { gloves(ch, '#5a3a1a'); belt(ch, '#3a2a1a', '#8a6a3a', 3); bootCuffs(ch, '#2a1a10'); },
  musketeer(ch) { gloves(ch, '#3a2a1a'); belt(ch, '#2a1a10', '#8a6a3a', 2); bootCuffs(ch, '#2a1a10'); },
  ranger(ch) { gauntlets(ch, M('#5a3a22', 0.85), false); belt(ch, '#3a2a1a', '#9aa0a8', 2); bootCuffs(ch, '#4a3220'); },
  rogue(ch) { gauntlets(ch, M('#2a2632', 0.8), false); belt(ch, '#3a1a2a', '#9aa0a8', 3); bootCuffs(ch, '#100e12'); straps(ch, '#100e12'); },
  monk(ch) { const w = M('#efe8d8', 0.95); for (const sd of ['L', 'R']) { const fa = ch.R.armL * 0.46; add(ch.arms[sd].el, cylG(0.046, 0.05, fa * 0.45, 10), w, 0, -fa * 0.72, 0); } },
  beastmaster(ch) { gauntlets(ch, fur('#7a7a80')); belt(ch, '#2a1a10', '#e6dcc4', 2); bootCuffs(ch, '#7a7a80'); },
  bard(ch) { gloves(ch, '#5a3220'); belt(ch, '#3a2010', '#f0d070', 1); bootCuffs(ch, '#5a3220'); },
  necromancer(ch) { robeTrim(ch, '#4a4a50'); gloves(ch, '#141216'); belt(ch, '#1a1418', '#8a8a90', 1); },
  wizard(ch) { robeTrim(ch, '#e0b84a'); gloves(ch, '#2a2a40'); belt(ch, '#3a2a1a', '#e0b84a', 1); const bk = add(ch.hips, boxG(0.09, 0.12, 0.04), M('#6a1a1a', 0.8), -0.15, 0.0, 0.05); bk.rotation.y = 0.5; },
  elementalist(ch) { robeTrim(ch, '#ffb040'); gloves(ch, '#2a1a12'); belt(ch, '#2a1a12', '#ff7a20', 1); },
  enchanter(ch) { robeTrim(ch, '#f0b8ff'); gloves(ch, '#3a1a3a'); belt(ch, '#3a1a3a', '#f0b8ff', 0); },
  druid(ch) { robeTrim(ch, '#9ad060'); belt(ch, '#5a3a1a', '#9ad060', 2); },
  shaman(ch) { gauntlets(ch, M('#5a3a22', 0.85), false); belt(ch, '#6b4a2a', '#e6dcc4', 2); bootCuffs(ch, '#7a5a3a'); },
  cleric(ch) { robeTrim(ch, '#d8b04a'); gloves(ch, '#f4f0e6'); belt(ch, '#d8b04a', '#f0d070', 0); },
};
const DECOR = {
  necromancer(ch) { // a shrunken head in the left hand (its stitched mouth sprays poison), a belt of skulls, burning green eyes
    { const dg = makeShrunkenHead(); ch.arms.L.grip.add(dg); ch.dangle = dg; ch.headMouthObj = dg.userData.mouth; } // (held by its ponytail, swinging under his fist)
    { for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2, r = 0.19 * ch.R.thick, sk2 = new THREE.Group(); sk2.position.set(Math.sin(a) * r, 0.04, Math.cos(a) * r * 0.85); sk2.rotation.y = a; ch.hips.add(sk2); const b = bone(); add(sk2, sph(0.045, 8, 6), b).scale.set(0.9, 1, 1); for (const x of [-0.015, 0.015]) add(sk2, sph(0.01, 5, 4), GL('#6aff5a'), x, 0.005, 0.04); } }
    skullFace(ch.headG); hideHair(ch); shoulderSpikes(ch, bone(), 2); const b = bone(); for (let k = 0; k < 5; k++) add(ch.chest, sph(0.022, 8, 6), b, -0.08 + k * 0.04, ch.R.torsoH - 0.13, 0.12 - Math.abs(k - 2) * 0.012); },
  wizard(ch) { const hat = ch.outfit && ch.outfit.hat; if (hat) { const g = gold(); for (let k = 0; k < 6; k++) { const a = k * 1.1, y = 0.05 + k * 0.05; add(hat, sph(0.014, 6, 4), g, Math.sin(a) * (0.1 - k * 0.012), y, Math.cos(a) * (0.1 - k * 0.012)); } }
    const bd = add(ch.headG, coneG(0.075, 0.26, 10), M('#e8e8e8', 0.9), 0, -0.07, 0.06); bd.rotation.x = Math.PI + 0.25; },
  elementalist(ch) { const crown = new THREE.Group(); crown.position.set(0, 0.2, 0); ch.headG.add(crown); add(crown, new THREE.TorusGeometry(0.11, 0.012, 6, 18), gold()).rotation.x = Math.PI / 2;
    for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; add(crown, coneG(0.018, 0.08, 6), GL(k % 2 ? '#ffb040' : '#ff6020'), Math.sin(a) * 0.11, 0.04, Math.cos(a) * 0.11); }
    const orbs = new THREE.Group(); orbs.position.set(0, ch.R.torsoH - 0.05, 0); ch.chest.add(orbs); ch.arenaSpin = orbs; for (const [c, a] of [['#ff6020', 0], ['#60c8ff', 2.1], ['#e0e070', 4.2]]) add(orbs, sph(0.05, 10, 8), GL(c), Math.sin(a) * 0.36, 0.05, Math.cos(a) * 0.36); },
  enchanter(ch) { const c = add(ch.headG, new THREE.TorusGeometry(0.128, 0.01, 6, 20), gold(), 0, 0.15, 0); c.rotation.x = Math.PI / 2 - 0.15; add(ch.headG, sph(0.022, 10, 8), GL('#ff70e0'), 0, 0.16, 0.13);
    const r = new THREE.Group(); backItem(ch, r, 0.25); ch.arenaSpin = r; for (const rad of [0.3, 0.22]) add(r, new THREE.TorusGeometry(rad, 0.008, 4, 32), GL('#f0a0ff')); },
  druid(ch) { const w = M('#7a5a36', 0.9); for (const s of [-1, 1]) { const a = new THREE.Group(); a.position.set(s * 0.08, 0.2, -0.02); a.rotation.z = -s * 0.5; ch.headG.add(a); add(a, cylG(0.012, 0.018, 0.22, 6), w, 0, 0.11, 0); for (const [y, t] of [[0.08, 0.7], [0.15, -0.6], [0.2, 0.5]]) { const b = add(a, cylG(0.008, 0.012, 0.1, 5), w, 0, y, 0); b.rotation.z = t; b.position.x = Math.sin(t) * 0.04; } }
    const lf = M('#5a8a2a', 0.9); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, l = add(ch.chest, sph(0.05, 6, 4), lf, Math.sin(a) * 0.2, ch.R.torsoH - 0.16, Math.cos(a) * 0.15); l.scale.set(1, 0.3, 1.6); l.rotation.y = a; } },
  shaman(ch) { const band = add(ch.headG, new THREE.TorusGeometry(0.128, 0.014, 6, 20), M('#8a2a1a'), 0, 0.14, 0); band.rotation.x = Math.PI / 2;
    for (let k = 0; k < 5; k++) { const f = add(ch.headG, coneG(0.02, 0.2, 4), M(k % 2 ? '#f0e8d0' : '#2a2a2a'), (k - 2) * 0.04, 0.27, -0.09); f.scale.z = 0.3; f.rotation.x = -0.5; f.rotation.z = (k - 2) * -0.2; }
    const b = bone(); for (let k = 0; k < 7; k++) add(ch.chest, coneG(0.012, 0.05, 5), b, -0.09 + k * 0.03, ch.R.torsoH - 0.15, 0.13 - Math.abs(k - 3) * 0.01).rotation.x = Math.PI; },
  cleric(ch) { const w = M('#f4f0e6', 0.8), g = gold(); const mit = add(ch.headG, coneG(0.115, 0.3, 4), w, 0, 0.32, 0); mit.scale.z = 0.55; add(ch.headG, boxG(0.02, 0.12, 0.01), g, 0, 0.32, 0.065); add(ch.headG, boxG(0.07, 0.02, 0.01), g, 0, 0.34, 0.065); add(ch.headG, cylG(0.122, 0.122, 0.04, 16), g, 0, 0.18, 0);
    const halo = add(ch.chest, new THREE.TorusGeometry(0.24, 0.012, 6, 30), GL('#fff0a0'), 0, ch.R.torsoH + 0.35, -0.2); },
  bard(ch) { const hat = add(ch.headG, cylG(0.17, 0.16, 0.05, 16), M('#a0285a'), 0, 0.2, -0.01); hat.rotation.x = -0.2; hat.rotation.z = 0.2; const fe = add(hat, coneG(0.022, 0.34, 4), M('#f0f0e0'), 0.1, 0.12, -0.05); fe.rotation.z = -0.9; fe.scale.z = 0.3;
    const lute = new THREE.Group(); backItem(ch, lute); lute.rotation.z = 0.6; const wd = M('#a0602a', 0.6); add(lute, sph(0.13, 14, 10), wd, 0, -0.1, 0).scale.set(1, 1.2, 0.45); add(lute, boxG(0.04, 0.38, 0.03), M('#5a3218'), 0, 0.18, 0); add(lute, sph(0.03, 8, 6), GL('#1a0a04'), 0, -0.08, 0.06); },
  warrior(ch) { const m = helm(ch.headG, '#9aa0a8'); hideHair(ch); const pl = add(ch.headG, coneG(0.04, 0.3, 6), M('#a01818', 0.9), 0, 0.3, -0.04); pl.rotation.x = -0.6; pl.scale.x = 0.5; },
  paladin(ch) { helm(ch.headG, '#e8e4d8', true); hideHair(ch); const w = M('#ffffff', 0.7); for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { const f = add(ch.headG, boxG(0.012, 0.1 - k * 0.02, 0.05), w, s * 0.145, 0.16 + k * 0.03, -0.03 - k * 0.035); f.rotation.x = -0.7; f.rotation.z = s * -0.3; }
    const g = gold(); shoulderSpikes(ch, g, 0); const sun = add(ch.chest, cylG(0.06, 0.06, 0.012, 16), g, 0, ch.R.torsoH - 0.24, 0.135); sun.rotation.x = Math.PI / 2; },
  darkknight(ch) { const m = helm(ch.headG, '#1e1e24'); hideHair(ch); horns(ch.headG, '#1a1a1a', 1.1); ch.headG.traverse(o => { if (o.isMesh && o.material && o.material.color && o.material.color.getHex() === 0x050505) o.material = GL('#ff2a1a'); }); shoulderSpikes(ch, iron('#1e1e24'), 4); },
  berserker(ch) { const m = add(ch.headG, sph(0.14, 16, 12), iron('#6a6a70'), 0, 0.1, 0); m.geometry = new THREE.SphereGeometry(0.14, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55); horns(ch.headG, '#e8dcc0', 1.2); add(ch.headG, boxG(0.02, 0.09, 0.03), iron('#6a6a70'), 0, 0.09, 0.13); mantle(ch, '#6a4a2a', 0.21); },
  monk(ch) { hideHair(ch); { const red = M('#a81c1c', 0.85, 0, { side: THREE.DoubleSide }); ch.monkTails = []; for (const sx of [-1, 1]) { const pv = new THREE.Group(); pv.position.set(sx * 0.07, 0.02, -0.16 * ch.R.thick); ch.hips.add(pv); const tl = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.85, 1, 6), red); tl.position.y = -0.42; pv.add(tl); ch.monkTails.push(pv); } } /* (two long sash tails that stream behind him) */ const b = M('#5a2a10', 0.5); for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; add(ch.chest, sph(0.022, 8, 6), b, Math.sin(a) * 0.13, ch.R.torsoH - 0.12 - (Math.cos(a) > 0 ? Math.cos(a) * 0.08 : 0), Math.cos(a) * 0.1); }
    const hb = add(ch.headG, new THREE.TorusGeometry(0.125, 0.012, 6, 20), M('#a01a1a'), 0, 0.13, 0); hb.rotation.x = Math.PI / 2; },
  rogue(ch) { const m = M('#2a2632', 0.7); for (const s of [-1, 1]) { const d = add(ch.chest, boxG(0.02, 0.16, 0.03), M('#c8ccd2', 0.3, 0.9), s * 0.12, 0.05, 0.12); d.rotation.z = s * 0.4; } add(ch.headG, boxG(0.16, 0.025, 0.02), GL('#c03060'), 0, 0.105, 0.13).visible = false; },
  ranger(ch) { const lf = M('#3a6a2a', 0.9); shoulderSpikes(ch, M('#6b4a2a'), 0); for (let k = 0; k < 3; k++) { const f = add(ch.headG, coneG(0.015, 0.14, 4), M(k === 1 ? '#a02020' : '#e8e0c0'), 0.1, 0.22, -0.08 + k * 0.02); f.rotation.z = -0.6; f.scale.z = 0.3; } },
  musketeer(ch) { // a lanky goblin sharpshooter: long drooping ears, a hooked nose, a brass telescope monocle, a hood, glowing rounds
    hideHair(ch); const hg = ch.headG, skin = ch.mats.skin, dark = M('#2a1e12', 0.85), leather = M('#4a3a26', 0.8), brass = gold();
    for (const sx of [-1, 1]) { const e = new THREE.Group(); e.position.set(sx * 0.13, 0.03, -0.02); e.rotation.set(0.25, sx * 0.3, -sx * 1.25); hg.add(e); const c = add(e, coneG(0.055, 0.42, 8), skin, 0, 0.2, 0); c.scale.z = 0.35; const tip = new THREE.Group(); tip.position.y = 0.36; tip.rotation.x = 0.7; e.add(tip); add(tip, coneG(0.022, 0.12, 6), skin, 0, 0.05, 0); } // (long ears that droop at the tips)
    const nose = add(hg, coneG(0.03, 0.17, 8), skin, 0, -0.02, 0.16); nose.rotation.x = Math.PI / 2 + 0.5; add(hg, sph(0.022, 8, 6), skin, 0, -0.07, 0.2); // (a long hooked nose)
    for (const sx of [-1, 1]) { const ey = add(hg, sph(0.024, 8, 6), GL('#ffd23a'), sx * 0.05, 0.03, 0.125); ey.castShadow = false; }
    const mono = add(hg, cylG(0.034, 0.03, 0.09, 12), brass, 0.05, 0.03, 0.16); mono.rotation.x = Math.PI / 2; add(hg, new THREE.TorusGeometry(0.034, 0.008, 6, 16), brass, 0.05, 0.03, 0.205); add(hg, sph(0.028, 10, 8), GL('#9ae0ff'), 0.05, 0.03, 0.206).scale.z = 0.3; // (a brass telescope monocle)
    const hood = add(hg, sph(0.17, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), leather, 0, 0.04, -0.03); hood.rotation.x = -0.35; hood.scale.set(1.05, 1.1, 1.15); // (a patched hood)
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
  beastmaster(ch) { hideHair(ch); const f = fur('#7a7a80'), wh = fur('#c8c8cc'); const head = add(ch.headG, sph(0.15, 14, 10), f, 0, 0.15, -0.02); head.scale.set(1, 0.85, 1.15);
    const sn = add(ch.headG, boxG(0.09, 0.07, 0.16), f, 0, 0.16, 0.14); add(ch.headG, boxG(0.07, 0.03, 0.12), wh, 0, 0.12, 0.15); add(ch.headG, sph(0.016, 6, 4), GL('#0a0a0a'), 0, 0.18, 0.22);
    for (const s of [-1, 1]) { add(ch.headG, coneG(0.04, 0.1, 4), f, s * 0.08, 0.28, -0.02); add(ch.headG, sph(0.012, 6, 4), GL('#ffd040'), s * 0.04, 0.2, 0.15); for (let k = 0; k < 2; k++) add(ch.headG, coneG(0.01, 0.04, 4), wh, s * 0.03, 0.11, 0.2 - k * 0.04).rotation.x = Math.PI; }
    mantle(ch, '#7a7a80', 0.2); },
};
export function arenaDecor(ch, cls) { try { if (DETAIL[cls]) DETAIL[cls](ch); if (DECOR[cls]) DECOR[cls](ch); } catch (e) { console.warn('arena look', cls, e); } }
// the weapon in the hand: a necromancer's staff wears a little skull with green eyes; casters' orbs take their class colour
export function arenaWeaponDecor(ch, cls) {
  const w = ch.weapons && ch.weapons.main; if (!w || w.userData.arenaDecor) return; w.userData.arenaDecor = true;
  if (cls === 'musketeer' || cls === 'blunderbuss') { goblinGun(w, cls); return; } // (goblin-made guns)
  if (cls === 'beastmaster') { for (const k of ['main', 'off']) { const o = ch.weapons[k]; if (o) for (const c of [...o.children]) o.remove(c); } for (const sd of ['R', 'L']) { const c2 = makeClaws(0.5); c2.rotation.x = Math.PI; c2.position.set(0, -0.06, 0.015); ch.arms[sd].hand.add(c2); } return; } // (wolverine claws out of both fists, in line with the forearm)
  if (cls === 'bard') { // a lute: he clubs people with it, and plays it once he has learnt his songs
    for (const c of [...w.children]) if (c.isMesh || (c.children && c.children.some(k => k.isMesh))) w.remove(c); const L = new THREE.Group(); w.add(L); w.userData.lute = L;
    const wood = M('#a0602a', 0.55), dark = M('#4a2a12', 0.7), str = GL('#e8e0c8');
    add(L, cylG(0.016, 0.02, 0.42, 8), dark, 0, 0.21, 0); const head = add(L, boxG(0.05, 0.1, 0.025), dark, 0, -0.02, -0.01); head.rotation.x = 0.4;
    for (let k = 0; k < 4; k++) add(L, cylG(0.004, 0.004, 0.03, 4), M('#d8b04a', 0.4, 0.8), (k % 2 ? 1 : -1) * 0.03, -0.04 + (k >> 1) * 0.04, -0.01).rotation.z = Math.PI / 2;
    const bowl = add(L, sph(0.13, 16, 12), wood, 0, 0.6, -0.02); bowl.scale.set(1, 1.25, 0.55); add(L, sph(0.03, 10, 8), GL('#1a0a04'), 0, 0.56, 0.05).scale.z = 0.2;
    for (let k = 0; k < 4; k++) add(L, boxG(0.002, 0.62, 0.002), str, -0.012 + k * 0.008, 0.33, 0.03);
    add(L, boxG(0.07, 0.015, 0.02), dark, 0, 0.72, 0.04); return; }
  const tip = w.userData.orb || w.userData.tip; if (!tip && cls !== 'necromancer') return;
  const col = { necromancer: '#5aff4a', wizard: '#60a0ff', elementalist: '#ff8030', enchanter: '#ff70e0', druid: '#9ad060', cleric: '#fff0a0' }[cls];
  if (cls === 'necromancer') { for (const c of [...w.children]) w.remove(c); w.userData.orb = null; w.userData.tip = null; const fl = add(w, sph(0.04, 10, 8), GL('#7aff5a'), 0, 0.02, 0.05); fl.castShadow = false; const fl2 = add(w, sph(0.065, 10, 8), new THREE.MeshBasicMaterial({ color: '#2aff3a', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }), 0, 0.02, 0.05); fl2.castShadow = false; w.userData.flame = fl; return; } /* (no staff any more: poison pours from his bare right hand) */
  if (false) { const s = new THREE.Group(); tip.add(s); s.position.y = 0.03; const b = bone(); add(s, sph(0.07, 12, 10), b).scale.set(0.95, 1, 1.05); add(s, boxG(0.08, 0.035, 0.06), b, 0, -0.05, 0.02);
    for (const x of [-0.024, 0.024]) { add(s, sph(0.017, 8, 6), GL('#050505'), x, 0.005, 0.058); add(s, sph(0.008, 6, 4), GL('#6aff5a'), x, 0.005, 0.068); } s.rotation.y = Math.PI / 2; return; }
  if (col && w.userData.orb) w.userData.orb.traverse(o => { if (o.isMesh && o.material) { o.material = o.material.clone(); if (o.material.color) o.material.color.set(col); if (o.material.emissive) o.material.emissive.set(col); } });
}
// a little life every frame: the elementalist's orbs circle, the enchanter's runes turn
export function arenaLookTick(ch, dt) { if (ch && ch.arenaSpin) ch.arenaSpin.rotation.y += dt * 1.6; if (ch && ch.dangle) swingDangle(ch.dangle, ch.root, dt);
  if (ch && ch.monkTails) { const p = ch.root.position, lp = (ch.tailState = ch.tailState || { lp: p.clone(), k: 0 }).lp, sp = Math.min(1, p.distanceTo(lp) / Math.max(dt, 1e-3) / 7); lp.copy(p); const t = performance.now() / 1000; const TS = ch.tailState; TS.k += (sp - TS.k) * Math.min(1, dt * 5);
    ch.monkTails.forEach((pv, i) => { pv.rotation.x = 0.15 + TS.k * 1.1 + Math.sin(t * 9 + i * 1.7) * (0.08 + TS.k * 0.18); pv.rotation.z = Math.sin(t * 6 + i) * 0.1 * (1 + TS.k); }); } }
// the shrunken head: a leathery little head with a stitched mouth and green eyes, hung from a long braided ponytail.
// The group's origin is the top of the ponytail (where the fist holds it); the head hangs down -Y, its face toward +Z.
export function makeShrunkenHead() {
  const dg = new THREE.Group(), sk = M('#5e4c2c', 0.85), skD = M('#3e3018', 0.9), st = M('#1a1208', 0.9), hair = M('#16110c', 0.95);
  add(dg, sph(0.022, 8, 6), hair, 0, 0.0, 0); // the knot in the fist
  for (let k = 0; k < 5; k++) { const seg = add(dg, cylG(0.014 - k * 0.0012, 0.016 - k * 0.0012, 0.045, 6), hair, (k % 2 ? 0.004 : -0.004), -0.025 - k * 0.04, 0); seg.rotation.z = (k % 2 ? 0.25 : -0.25); } // a braid
  const hd = new THREE.Group(); hd.position.set(0, -0.3, 0); dg.add(hd);
  add(hd, sph(0.085, 14, 12), sk).scale.set(0.88, 1.05, 0.95); add(hd, sph(0.06, 10, 8), skD, 0, -0.05, 0.03).scale.set(1, 0.7, 0.9); // shrivelled jaw
  add(hd, boxG(0.05, 0.014, 0.012), st, 0, -0.03, 0.08); for (let k = 0; k < 4; k++) add(hd, boxG(0.004, 0.026, 0.006), st, -0.018 + k * 0.012, -0.03, 0.085); // stitched mouth
  for (const x of [-0.03, 0.03]) { add(hd, sph(0.017, 6, 4), GL('#050505'), x, 0.016, 0.074); const e2 = add(hd, sph(0.009, 6, 4), GL('#7aff5a'), x, 0.016, 0.085); e2.castShadow = false; add(hd, boxG(0.03, 0.004, 0.006), st, x, 0.016, 0.088).rotation.z = 0.6; } // sewn-shut lids over green light
  add(hd, coneG(0.012, 0.03, 4), skD, 0, -0.002, 0.088).rotation.x = Math.PI / 2; // nose
  for (const x of [-1, 1]) add(hd, sph(0.022, 6, 5), skD, x * 0.075, 0, 0).scale.set(0.5, 1, 0.8); // ears
  for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2, h = add(hd, cylG(0.004, 0.0025, 0.12, 3), hair, Math.sin(a) * 0.04, 0.075, Math.cos(a) * 0.04 - 0.01); h.rotation.set(Math.cos(a) * -0.5, 0, Math.sin(a) * 0.5); } // hair gathered up into the ponytail
  const mouth = new THREE.Object3D(); mouth.position.set(0, -0.03, 0.1); hd.add(mouth); dg.userData.mouth = mouth; dg.userData.head = hd;
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
  _q3.setFromEuler(_e.set(sw.ax, 0, sw.az)); _q2.multiply(_q3); dg.parent.getWorldQuaternion(_q1); dg.quaternion.copy(_q1.invert().multiply(_q2));
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
  w.traverse(o => { if (o.isMesh && o.material && o.material.metalness > 0.5) { o.material = o.material.clone(); o.material.color.lerp(new THREE.Color('#7a5a40'), 0.55); o.material.roughness = Math.max(o.material.roughness, 0.6); } }); // (rust over the steel)
  const a = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x * s, y * s, z * s); o.rotation.set(rx, ry, rz); o.scale.setScalar(s); o.castShadow = true; w.add(o); return o; };
  const gear = (x, y, z, r, ry = 0) => { const g = a(new THREE.TorusGeometry(r, r * 0.28, 5, 10), steel, x, y, z, 0, ry, 0); for (let i = 0; i < 8; i++) { const t2 = new THREE.Mesh(new THREE.BoxGeometry(r * 0.35, r * 0.35, r * 0.4), steel); const an = i / 8 * Math.PI * 2; t2.position.set(Math.cos(an) * r * 1.25, Math.sin(an) * r * 1.25, 0); g.add(t2); } return g; };
  for (const [y, z] of [[0.15, 0.03], [0.42, -0.03], [0.6, 0.02]]) a(new THREE.BoxGeometry(0.05, 0.08, 0.012), rust, 0.03, y, z, 0, 0, 0.3); // (mismatched patches)
  for (let i = 0; i < 6; i++) a(new THREE.SphereGeometry(0.008, 5, 4), brass, 0.028, 0.1 + i * 0.1, 0.02); // (rivets)
  a(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 8), rag, 0, -0.06, 0); // (rag-wrapped grip)
  if (cls === 'musketeer') { // a sniper contraption: an oversized scope on wobbly brackets, a gauge, a geared hammer, a glowing fuel canister
    const sc = a(new THREE.CylinderGeometry(0.035, 0.028, 0.42, 12), brass, 0, 0.42, 0.075); a(new THREE.TorusGeometry(0.038, 0.008, 6, 14), steel, 0, 0.64, 0.075, Math.PI / 2); a(new THREE.SphereGeometry(0.032, 10, 8), GL('#9ae0ff'), 0, 0.635, 0.075).scale.y = 0.2;
    for (const y of [0.3, 0.52]) a(new THREE.BoxGeometry(0.012, 0.012, 0.06), steel, 0, y, 0.045);
    gear(0.04, 0.08, 0.0, 0.03, Math.PI / 2); a(new THREE.CylinderGeometry(0.025, 0.025, 0.012, 12), brass, -0.035, 0.2, 0.0, 0, 0, Math.PI / 2); a(new THREE.BoxGeometry(0.002, 0.016, 0.002), dark, -0.042, 0.2, 0.004, 0, 0, 0.6);
    const can = a(new THREE.CylinderGeometry(0.022, 0.022, 0.09, 10), steel, -0.04, 0.05, -0.02); a(new THREE.CylinderGeometry(0.018, 0.018, 0.06, 10), glow, -0.04, 0.05, -0.02).scale.set(1.05, 1, 1.05);
    a(new THREE.TorusGeometry(0.05, 0.005, 4, 12, Math.PI), M('#3a3a30', 0.6, 0.6), -0.02, 0.28, -0.02, 0, Math.PI / 2, 0); } // (a tube from the canister to the breech)
  else { // the bruiser's hand-cannon: a fat flared barrel ringed with spikes, a smokestack, twin feed pipes, a brass gauge, a spring, a chained powder flask
    const bell = a(new THREE.CylinderGeometry(0.075, 0.045, 0.14, 12, 1, true), rust, 0, 0.62, 0); bell.material = bell.material.clone(); bell.material.side = THREE.DoubleSide;
    for (let i = 0; i < 8; i++) { const an = i / 8 * Math.PI * 2; a(new THREE.ConeGeometry(0.012, 0.06, 5), steel, Math.cos(an) * 0.075, 0.66, Math.sin(an) * 0.075, Math.sin(an) * 1.2, 0, -Math.cos(an) * 1.2); }
    a(new THREE.CylinderGeometry(0.015, 0.02, 0.1, 8), dark, 0.0, 0.25, 0.06); a(new THREE.CylinderGeometry(0.025, 0.015, 0.03, 8), dark, 0, 0.31, 0.06); // (a little smokestack)
    for (const x of [-0.04, 0.04]) a(new THREE.CylinderGeometry(0.009, 0.009, 0.36, 6), brass, x, 0.35, -0.035);
    a(new THREE.CylinderGeometry(0.03, 0.03, 0.014, 12), brass, 0.045, 0.12, 0.0, 0, 0, Math.PI / 2); a(new THREE.SphereGeometry(0.012, 6, 5), glow, 0.054, 0.12, 0);
    const spr = a(new THREE.TorusGeometry(0.018, 0.004, 4, 10), steel, -0.04, 0.16, 0.02); for (let i = 1; i < 4; i++) { const c = spr.clone(); c.position.y += i * 0.012 * s; w.add(c); }
    gear(-0.045, 0.06, -0.01, 0.035, Math.PI / 2); const fl = a(new THREE.SphereGeometry(0.035, 10, 8), M('#5a3a1a', 0.8), 0.05, -0.02, -0.04); fl.scale.set(1, 1.3, 0.7); for (let i = 0; i < 3; i++) a(new THREE.TorusGeometry(0.008, 0.002, 4, 8), steel, 0.05, 0.03 + i * 0.012, -0.04, Math.PI / 2 * (i % 2)); }
}
