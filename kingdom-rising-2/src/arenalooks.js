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
  monk: { shirt: '#e08a20', pants: '#e08a20', boots: '#5a3a1a', sash: '#a01a1a', bareArms: true, belt: '#a01a1a' },
  rogue: { shirt: '#1e1c24', vest: '#2a2632', pants: '#18161c', boots: '#100e12', hood: '#16141a', mask: '#16141a', belt: '#3a1a2a', bracers: '#2a2632', cloak: '#141218' },
  ranger: { shirt: '#5a3f26', vest: '#6b4a2a', pants: '#3c4a2a', boots: '#4a3220', hood: '#2e5a26', cloak: '#2e5a26', quiver: true, belt: '#3a2a1a', bracers: '#5a3a22' },
  musketeer: { shirt: '#e8e0c8', vest: '#1f2c56', trim: '#c9a14a', pants: '#6a7c9e', boots: '#1a1612', belt: '#1a1612', bracers: '#1f2c56' },
  blunderbuss: { shirt: '#e8e0c8', vest: '#8a1a1a', trim: '#e8e0c8', pants: '#2a2a30', boots: '#1a1612', belt: '#e8e0c8', bracers: '#8a1a1a' },
  beastmaster: { shirt: '#4a3a28', vest: '#6a5034', pants: '#3c3024', boots: '#3a2416', belt: '#2a1a10', bracers: '#6a5034', bareArms: true },
};
export function arenaSpec(cls) { return SPEC[cls] || null; }
// each class's build (see BODY in character.js): brutes, knights, heavies, athletes, lean casters, sturdy priests
const BUILD = { berserker: 'brute', beastmaster: 'brute', warrior: 'knight', paladin: 'knight', darkknight: 'knight', blunderbuss: 'heavy', shaman: 'heavy',
  rogue: 'athlete', ranger: 'athlete', monk: 'athlete', musketeer: 'athlete', bard: 'athlete', wizard: 'lean', necromancer: 'lean', enchanter: 'lean', elementalist: 'lean', cleric: 'sturdy', druid: 'sturdy' };
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
  blunderbuss(ch) { gloves(ch, '#e8e0c8'); belt(ch, '#efe8d8', '#c9a14a', 2); bootCuffs(ch, '#1a1612'); pauldrons(ch, M('#c9a14a', 0.4, 0.8), 0.7); },
  musketeer(ch) { gloves(ch, '#e8e0c8'); belt(ch, '#1a1612', '#c9a14a', 1); bootCuffs(ch, '#1a1612'); const cb = add(ch.hips, boxG(0.1, 0.07, 0.05), M('#1a1612', 0.7), 0.1, 0.08, -0.12); },
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
    { const g = ch.arms.L.grip, hd = new THREE.Group(); hd.position.set(0, 0.02, 0.06); g.add(hd); const sk = M('#5a4a2a', 0.85), st = M('#1a1208', 0.9);
      add(hd, sph(0.085, 12, 10), sk).scale.set(0.9, 1.05, 0.95); add(hd, boxG(0.05, 0.014, 0.012), st, 0, -0.03, 0.08);
      for (let k = 0; k < 4; k++) add(hd, boxG(0.004, 0.025, 0.006), st, -0.018 + k * 0.012, -0.03, 0.085);
      for (const x of [-0.03, 0.03]) { add(hd, sph(0.016, 6, 4), GL('#050505'), x, 0.015, 0.075); add(hd, sph(0.008, 6, 4), GL('#7aff5a'), x, 0.015, 0.085); }
      for (let k = 0; k < 7; k++) { const h = add(hd, cylG(0.004, 0.002, 0.16, 3), st, -0.04 + k * 0.013, 0.1, -0.02); h.rotation.x = 0.3 + (k % 3) * 0.1; } add(hd, cylG(0.004, 0.004, 0.12, 4), st, 0, 0.1, 0); }
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
  monk(ch) { hideHair(ch); const b = M('#5a2a10', 0.5); for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; add(ch.chest, sph(0.022, 8, 6), b, Math.sin(a) * 0.13, ch.R.torsoH - 0.12 - (Math.cos(a) > 0 ? Math.cos(a) * 0.08 : 0), Math.cos(a) * 0.1); }
    const hb = add(ch.headG, new THREE.TorusGeometry(0.125, 0.012, 6, 20), M('#a01a1a'), 0, 0.13, 0); hb.rotation.x = Math.PI / 2; },
  rogue(ch) { const m = M('#2a2632', 0.7); for (const s of [-1, 1]) { const d = add(ch.chest, boxG(0.02, 0.16, 0.03), M('#c8ccd2', 0.3, 0.9), s * 0.12, 0.05, 0.12); d.rotation.z = s * 0.4; } add(ch.headG, boxG(0.16, 0.025, 0.02), GL('#c03060'), 0, 0.105, 0.13).visible = false; },
  ranger(ch) { const lf = M('#3a6a2a', 0.9); shoulderSpikes(ch, M('#6b4a2a'), 0); for (let k = 0; k < 3; k++) { const f = add(ch.headG, coneG(0.015, 0.14, 4), M(k === 1 ? '#a02020' : '#e8e0c0'), 0.1, 0.22, -0.08 + k * 0.02); f.rotation.z = -0.6; f.scale.z = 0.3; } },
  musketeer(ch) { // a Union kepi, brass buttons, a white cross belt
    const kp = new THREE.Group(); kp.position.set(0, 0.17, 0.0); kp.rotation.x = -0.18; ch.headG.add(kp); const blue = M('#1f2c56', 0.85); add(kp, cylG(0.1, 0.125, 0.12, 16), blue, 0, 0.06, -0.01).rotation.x = 0.25; const vz = add(kp, cylG(0.1, 0.1, 0.01, 16, 1, false, -Math.PI / 2, Math.PI), M('#101010', 0.4), 0, 0.0, 0.06); vz.scale.z = 0.7; add(kp, sph(0.012, 6, 4), gold(), 0, 0.08, 0.11);
    const g = gold(); for (let k = 0; k < 6; k++) add(ch.chest, sph(0.011, 6, 4), g, 0.0, ch.R.torsoH - 0.36 + k * 0.045, 0.13); const wb = add(ch.chest, boxG(0.035, 0.55, 0.01), M('#efe8d8'), 0, ch.R.torsoH * 0.45, 0.125); wb.rotation.z = 0.75; add(ch.chest, cylG(0.03, 0.03, 0.01, 12), g, 0, ch.R.torsoH * 0.45, 0.13).rotation.x = Math.PI / 2; },
  blunderbuss(ch) { const bs = add(ch.headG, cylG(0.13, 0.14, 0.36, 14), fur('#151515'), 0, 0.3, -0.01); add(ch.headG, sph(0.13, 14, 8), fur('#151515'), 0, 0.48, -0.01).scale.y = 0.5; add(ch.headG, cylG(0.05, 0.05, 0.01, 12), gold(), 0, 0.2, 0.13).rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) { const b = add(ch.chest, boxG(0.04, 0.6, 0.012), M('#efe8d8'), 0, ch.R.torsoH * 0.45, 0.125); b.rotation.z = s * 0.7; } const k = M('#2a2a2a', 0.6); for (let i = 0; i < 4; i++) add(ch.chest, sph(0.035, 10, 8), k, -0.12 + i * 0.08, 0.02, 0.13); },
  beastmaster(ch) { hideHair(ch); const f = fur('#7a7a80'), wh = fur('#c8c8cc'); const head = add(ch.headG, sph(0.15, 14, 10), f, 0, 0.15, -0.02); head.scale.set(1, 0.85, 1.15);
    const sn = add(ch.headG, boxG(0.09, 0.07, 0.16), f, 0, 0.16, 0.14); add(ch.headG, boxG(0.07, 0.03, 0.12), wh, 0, 0.12, 0.15); add(ch.headG, sph(0.016, 6, 4), GL('#0a0a0a'), 0, 0.18, 0.22);
    for (const s of [-1, 1]) { add(ch.headG, coneG(0.04, 0.1, 4), f, s * 0.08, 0.28, -0.02); add(ch.headG, sph(0.012, 6, 4), GL('#ffd040'), s * 0.04, 0.2, 0.15); for (let k = 0; k < 2; k++) add(ch.headG, coneG(0.01, 0.04, 4), wh, s * 0.03, 0.11, 0.2 - k * 0.04).rotation.x = Math.PI; }
    mantle(ch, '#7a7a80', 0.2); },
};
export function arenaDecor(ch, cls) { try { if (DETAIL[cls]) DETAIL[cls](ch); if (DECOR[cls]) DECOR[cls](ch); } catch (e) { console.warn('arena look', cls, e); } }
// the weapon in the hand: a necromancer's staff wears a little skull with green eyes; casters' orbs take their class colour
export function arenaWeaponDecor(ch, cls) {
  const w = ch.weapons && ch.weapons.main; if (!w || w.userData.arenaDecor) return; w.userData.arenaDecor = true;
  if (cls === 'bard') { // a lute: he clubs people with it, and plays it once he has learnt his songs
    for (const c of [...w.children]) if (c.isMesh || (c.children && c.children.some(k => k.isMesh))) w.remove(c); const L = new THREE.Group(); w.add(L); w.userData.lute = L;
    const wood = M('#a0602a', 0.55), dark = M('#4a2a12', 0.7), str = GL('#e8e0c8');
    add(L, cylG(0.016, 0.02, 0.42, 8), dark, 0, 0.21, 0); const head = add(L, boxG(0.05, 0.1, 0.025), dark, 0, -0.02, -0.01); head.rotation.x = 0.4;
    for (let k = 0; k < 4; k++) add(L, cylG(0.004, 0.004, 0.03, 4), M('#d8b04a', 0.4, 0.8), (k % 2 ? 1 : -1) * 0.03, -0.04 + (k >> 1) * 0.04, -0.01).rotation.z = Math.PI / 2;
    const bowl = add(L, sph(0.13, 16, 12), wood, 0, 0.6, -0.02); bowl.scale.set(1, 1.25, 0.55); add(L, sph(0.03, 10, 8), GL('#1a0a04'), 0, 0.56, 0.05).scale.z = 0.2;
    for (let k = 0; k < 4; k++) add(L, boxG(0.002, 0.62, 0.002), str, -0.012 + k * 0.008, 0.33, 0.03);
    add(L, boxG(0.07, 0.015, 0.02), dark, 0, 0.72, 0.04); return; }
  const tip = w.userData.orb || w.userData.tip; if (!tip) return;
  const col = { necromancer: '#5aff4a', wizard: '#60a0ff', elementalist: '#ff8030', enchanter: '#ff70e0', druid: '#9ad060', cleric: '#fff0a0' }[cls];
  if (cls === 'necromancer') { if (w.userData.orb) w.userData.orb.visible = false; const s = new THREE.Group(); tip.add(s); s.position.y = 0.03; const b = bone(); add(s, sph(0.07, 12, 10), b).scale.set(0.95, 1, 1.05); add(s, boxG(0.08, 0.035, 0.06), b, 0, -0.05, 0.02);
    for (const x of [-0.024, 0.024]) { add(s, sph(0.017, 8, 6), GL('#050505'), x, 0.005, 0.058); add(s, sph(0.008, 6, 4), GL('#6aff5a'), x, 0.005, 0.068); } s.rotation.y = Math.PI / 2; return; }
  if (col && w.userData.orb) w.userData.orb.traverse(o => { if (o.isMesh && o.material) { o.material = o.material.clone(); if (o.material.color) o.material.color.set(col); if (o.material.emissive) o.material.emissive.set(col); } });
}
// a little life every frame: the elementalist's orbs circle, the enchanter's runes turn
export function arenaLookTick(ch, dt) { if (ch && ch.arenaSpin) ch.arenaSpin.rotation.y += dt * 1.6; }

// a dark ink outline round every fighter (an inverted shell pushed out along the normals), the way Smite and Marvel
// Rivals draw their heroes: bodies read clearly against the sand, the crowd and each other at any distance
const OUTLINE = new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: { col: { value: new THREE.Color('#140e0a') } },
  vertexShader: 'void main(){ vec3 n = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); float d = -mv.z; mv.xyz += n * clamp(0.006 + d * 0.0016, 0.006, 0.05); gl_Position = projectionMatrix * mv; }',
  fragmentShader: 'uniform vec3 col; void main(){ gl_FragColor = vec4(col, 1.0); }' });
export function addOutline(root) {
  const list = []; root.traverse(o => { if (o.isMesh && !o.userData.outline && o.material && !Array.isArray(o.material) && o.material.isMeshStandardMaterial && !o.material.transparent && o.material.side !== THREE.DoubleSide && /* (thin cloth: capes, robes) */ o.geometry && o.geometry.attributes.normal) list.push(o); });
  for (const o of list) { const sh = new THREE.Mesh(o.geometry, OUTLINE); sh.userData.outline = true; sh.castShadow = false; sh.receiveShadow = false; sh.renderOrder = -1; sh.raycast = () => {}; o.add(sh); }
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
export function luteToChest(ch, on, t) {
  const w = ch.weapons && ch.weapons.main, L = w && w.userData.lute; if (!L) return;
  if (!on) { if (w.userData.playing) { L.position.set(0, 0, 0); L.quaternion.identity(); w.userData.playing = false; } return; }
  ch.root.updateMatrixWorld(true); const R = ch.R, th = R.torsoH - 0.2, cm = ch.chest.matrixWorld;
  const top = new THREE.Vector3(0.24, th * 0.95, 0.2).applyMatrix4(cm); // the neck end, up by the left shoulder
  const cq = ch.chest.getWorldQuaternion(new THREE.Quaternion()), Y = new THREE.Vector3(-0.62, -0.72, 0.12).normalize().applyQuaternion(cq), fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(cq);
  const Z = fwd.clone().addScaledVector(Y, -fwd.dot(Y)).normalize(), X = new THREE.Vector3().crossVectors(Y, Z);
  _q.setFromRotationMatrix(_m.makeBasis(X, Y, Z));
  armReach(ch, 'L', top.clone().addScaledVector(Y, 0.16).addScaledVector(Z, -0.03), 4);
  armReach(ch, 'R', top.clone().addScaledVector(Y, 0.5 + Math.sin(t * 14) * 0.03).addScaledVector(Z, 0.07).addScaledVector(X, Math.sin(t * 14) * 0.04), 4);
  w.updateMatrixWorld(true); const inv = w.matrixWorld.clone().invert(); L.position.copy(top.clone().applyMatrix4(inv));
  L.quaternion.copy(w.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(_q)); w.userData.playing = true;
}

// the necromancer's ultimate: a demon of the depths, built big from the waist up (it never shows more than that)
export function makeDemon() {
  const g = new THREE.Group(), skin = M('#3a1416', 0.75), dark = M('#1a0808', 0.8), horn = M('#d8ccb0', 0.5), eye = GL('#7aff5a'), claw = M('#e8e0c8', 0.4);
  const torso = add(g, sph(1.1, 18, 14), skin, 0, 1.4, 0); torso.scale.set(1.25, 1.35, 0.85);
  add(g, sph(0.75, 14, 10), skin, 0, 0.3, 0).scale.set(1.3, 0.9, 0.9);
  for (let k = 0; k < 4; k++) add(g, boxG(0.9 - k * 0.08, 0.12, 0.2), dark, 0, 0.8 + k * 0.32, 0.86).rotation.x = -0.1; // ribs of the gut
  for (const sx of [-1, 1]) { const sh = add(g, sph(0.55, 12, 10), skin, sx * 1.35, 2.35, 0); for (let k = 0; k < 3; k++) add(sh, coneG(0.12, 0.6, 6), horn, sx * 0.2, 0.4, -0.2 + k * 0.2).rotation.z = -sx * 0.5; }
  const head = new THREE.Group(); head.position.set(0, 3.1, 0.15); g.add(head);
  add(head, sph(0.62, 16, 12), skin).scale.set(1, 0.95, 1.05);
  for (const sx of [-1, 1]) { const h = new THREE.Group(); h.position.set(sx * 0.45, 0.35, -0.05); h.rotation.z = -sx * 0.7; head.add(h); let y = 0, r = 0.16; for (let k = 0; k < 5; k++) { const sgm = add(h, cylG(r * 0.7, r, 0.32, 8), horn, 0, y + 0.16, 0); sgm.rotation.x = -0.2 * k; y += 0.28; r *= 0.78; h.rotation.z += sx * 0.1; } }
  for (const sx of [-1, 1]) { add(head, sph(0.11, 8, 6), eye, sx * 0.24, 0.12, 0.52); }
  const jaw = new THREE.Group(); jaw.position.set(0, -0.15, 0.2); head.add(jaw); add(jaw, boxG(0.8, 0.2, 0.6), skin, 0, -0.12, 0.2);
  for (let k = 0; k < 6; k++) { add(jaw, coneG(0.05, 0.18, 4), claw, -0.3 + k * 0.12, 0.02, 0.45); add(head, coneG(0.05, 0.18, 4), claw, -0.3 + k * 0.12, -0.2, 0.62).rotation.x = Math.PI; }
  add(head, sph(0.3, 10, 8), GL('#200404'), 0, -0.2, 0.5).scale.set(1.2, 0.5, 0.5);
  const arms = {};
  for (const sx of [-1, 1]) { const sh = new THREE.Group(); sh.position.set(sx * 1.5, 2.3, 0.1); g.add(sh); add(sh, cylG(0.32, 0.26, 1.5, 10), skin, 0, -0.75, 0);
    const el = new THREE.Group(); el.position.set(0, -1.5, 0); sh.add(el); add(el, cylG(0.26, 0.2, 1.4, 10), skin, 0, -0.7, 0);
    const hand = new THREE.Group(); hand.position.set(0, -1.5, 0); el.add(hand); add(hand, sph(0.32, 10, 8), skin).scale.set(1.2, 0.8, 1); for (let k = 0; k < 4; k++) add(hand, coneG(0.06, 0.4, 5), claw, -0.2 + k * 0.13, -0.3, 0.15).rotation.x = Math.PI - 0.4;
    arms[sx > 0 ? 'L' : 'R'] = { sh, el, hand }; }
    return { g, jaw, head, arms };
}
