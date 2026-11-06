// Kingdom Arena avatars: no gear slots, every class has one look you can tell from across the sand (like picking a
// god in Smite). arenaSpec() is the outfit palette fed to buildHumanoid; arenaDecor() adds each class's signature
// pieces (helmets, hats, hoods, masks, mantles, orbs); arenaWeaponDecor() dresses the weapon (the necromancer's skull staff).
import * as THREE from 'three';

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

// ---- signature pieces ----
const bone = () => M('#e6dcc4', 0.6), iron = (c = '#3a3a40') => M(c, 0.4, 0.85), gold = () => M('#d8b04a', 0.35, 0.85), fur = (c) => M(c, 1);
function skullFace(hg) { // a bone skull where the face should be, black sockets, green embers for eyes
  const b = bone(), dk = GL('#050505'), g = add(hg, sph(0.118, 16, 12), b, 0, 0.1, 0.018); g.scale.set(0.98, 1.05, 1.02);
  const jaw = add(hg, boxG(0.15, 0.06, 0.1), b, 0, 0.02, 0.05); jaw.rotation.x = 0.1;
  for (const x of [-0.042, 0.042]) { add(hg, sph(0.03, 10, 8), dk, x, 0.105, 0.105); add(hg, sph(0.013, 8, 6), GL('#6aff5a'), x, 0.105, 0.124); }
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

const DECOR = {
  necromancer(ch) { skullFace(ch.headG); hideHair(ch); shoulderSpikes(ch, bone(), 2); const b = bone(); for (let k = 0; k < 5; k++) add(ch.chest, sph(0.022, 8, 6), b, -0.08 + k * 0.04, ch.R.torsoH - 0.13, 0.12 - Math.abs(k - 2) * 0.012); },
  wizard(ch) { const hat = ch.outfit && ch.outfit.hat; if (hat) { const g = gold(); for (let k = 0; k < 6; k++) { const a = k * 1.1, y = 0.05 + k * 0.05; add(hat, sph(0.014, 6, 4), g, Math.sin(a) * (0.1 - k * 0.012), y, Math.cos(a) * (0.1 - k * 0.012)); } }
    const bd = add(ch.headG, coneG(0.075, 0.26, 10), M('#e8e8e8', 0.9), 0, -0.07, 0.06); bd.rotation.x = Math.PI + 0.25; },
  elementalist(ch) { const crown = new THREE.Group(); crown.position.set(0, 0.2, 0); ch.headG.add(crown); add(crown, new THREE.TorusGeometry(0.11, 0.012, 6, 18), gold()).rotation.x = Math.PI / 2;
    for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; add(crown, coneG(0.018, 0.08, 6), GL(k % 2 ? '#ffb040' : '#ff6020'), Math.sin(a) * 0.11, 0.04, Math.cos(a) * 0.11); }
    const orbs = new THREE.Group(); orbs.position.set(0, ch.R.torsoH + 0.25, 0); ch.chest.add(orbs); ch.arenaSpin = orbs; for (const [c, a] of [['#ff6020', 0], ['#60c8ff', 2.1], ['#e0e070', 4.2]]) add(orbs, sph(0.055, 10, 8), GL(c), Math.sin(a) * 0.42, 0.1, Math.cos(a) * 0.42); },
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
export function arenaDecor(ch, cls) { try { if (DECOR[cls]) DECOR[cls](ch); } catch (e) { console.warn('arena look', cls, e); } }
// the weapon in the hand: a necromancer's staff wears a little skull with green eyes; casters' orbs take their class colour
export function arenaWeaponDecor(ch, cls) {
  const w = ch.weapons && ch.weapons.main; if (!w || w.userData.arenaDecor) return; w.userData.arenaDecor = true;
  const tip = w.userData.orb || w.userData.tip; if (!tip) return;
  const col = { necromancer: '#5aff4a', wizard: '#60a0ff', elementalist: '#ff8030', enchanter: '#ff70e0', druid: '#9ad060', cleric: '#fff0a0' }[cls];
  if (cls === 'necromancer') { if (w.userData.orb) w.userData.orb.visible = false; const s = new THREE.Group(); tip.add(s); s.position.y = 0.03; const b = bone(); add(s, sph(0.07, 12, 10), b).scale.set(0.95, 1, 1.05); add(s, boxG(0.08, 0.035, 0.06), b, 0, -0.05, 0.02);
    for (const x of [-0.024, 0.024]) { add(s, sph(0.017, 8, 6), GL('#050505'), x, 0.005, 0.058); add(s, sph(0.008, 6, 4), GL('#6aff5a'), x, 0.005, 0.068); } s.rotation.y = Math.PI / 2; return; }
  if (col && w.userData.orb) w.userData.orb.traverse(o => { if (o.isMesh && o.material) { o.material = o.material.clone(); if (o.material.color) o.material.color.set(col); if (o.material.emissive) o.material.emissive.set(col); } });
}
// a little life every frame: the elementalist's orbs circle, the enchanter's runes turn
export function arenaLookTick(ch, dt) { if (ch && ch.arenaSpin) ch.arenaSpin.rotation.y += dt * 1.6; }
