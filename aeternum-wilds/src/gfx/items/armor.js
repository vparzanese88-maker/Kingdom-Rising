// Aeternum Wilds — armour item models: helmets, chest pieces, gloves, legs, boots and amulets in three weight
// classes (light cloth, medium leather, heavy plate) and three tiers. Used for inventory icons; the helmet and the
// pauldrons are also sized to be worn (see makeHelmet / makePauldron below).
// Adapted from Kingdom Rising 3D's items3d.js armour, rebuilt with textured cloth, leather and plate.
import * as THREE from 'three';
import { MB, V3, V2, extrude, lathe, tube, shade, hot } from './mb.js';
import { RARITY_COLORS } from './weapons.js';

// ---------- palettes per weight class and tier ----------
export const ARMOR_LOOK = {
  light: [null,
    { key: 'cloth', base: '#d8c8a6', trim: '#7a4e2c', acc: '#a8342a', metal: '#8a7a62' }, // linen
    { key: 'cloth', base: '#3e6cb8', trim: '#d8dce4', acc: '#e8d8a0', metal: '#c8ced8' }, // silk
    { key: 'cloth', base: '#c8441e', trim: '#f2c95a', acc: '#ffd27a', metal: '#eebe50', glow: '#ffb040' }], // phoenixweave
  medium: [null,
    { key: 'leather', base: '#9a6438', trim: '#4a2c18', acc: '#c8a878', metal: '#7a6e60' }, // hide
    { key: 'leather', base: '#5e3c26', trim: '#2a1a10', acc: '#a8b4c4', metal: '#b4bfcc' }, // layered
    { key: 'leather', base: '#2e6a56', trim: '#163a2e', acc: '#f2c95a', metal: '#eebe50', glow: '#7affc8' }], // wyvernhide
  heavy: [null,
    { key: 'metal', base: '#a0a4aa', trim: '#5a3a22', acc: '#8a2a22', metal: '#62666c' }, // iron
    { key: 'metal', base: '#86a2cc', trim: '#26324e', acc: '#d8e6fa', metal: '#c5cfdc' }, // starmetal
    { key: 'metal', base: '#e2aa52', trim: '#6a1c1c', acc: '#fff0b0', metal: '#f2c95a', glow: '#ffcf6a' }], // orichalcum
};
const lookOf = (wc, tier) => ARMOR_LOOK[wc || 'medium'][Math.max(1, Math.min(3, tier | 0 || 1))];

// a rounded torso shell from a lathe profile, squashed front-to-back
function torso(top, bot, depth, flare = 0) {
  const pts = [[0.001, top], [0.1, top - 0.005], [0.19, top - 0.05], [0.215, top - 0.15], [0.19, (top + bot) / 2], [0.18 + flare * 0.5, bot + 0.06], [0.2 + flare, bot]];
  const g = lathe(pts, 28); g.scale(1, 1, depth); return g;
}

// ---------- helmets (worn or as icons) ----------
// Built for the humanoid's head group: origin at the head pivot, skull ~0.38 wide centred at y 0.06, face toward +z.
function helmet(mb, wc, tier, rar) {
  const L = lookOf(wc, tier); const g = L.glow;
  if (wc === 'heavy') {
    const steel = L.base;
    if (tier === 1) { // a nasal helm with cheek plates and a mail aventail
      mb.add('metal', lathe([[0.001, 0.33], [0.09, 0.32], [0.17, 0.27], [0.22, 0.18], [0.24, 0.06], [0.245, -0.02]], 24), MB.mat(0, 0, 0), steel);
      mb.cyl('metal', 0, -0.01, 0, 0.25, 0.04, L.metal, 24);
      mb.box('metal', 0, 0.02, 0.245, 0.04, 0.2, 0.025, steel);
      for (const sx of [-1, 1]) mb.box('metal', sx * 0.2, -0.12, 0.1, 0.03, 0.2, 0.14, steel, 0, sx * 0.5, 0);
      for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; mb.sph('metal', Math.cos(a) * 0.25, -0.01, Math.sin(a) * 0.25, 0.018, 0.018, 0.018, L.metal, 8); }
      mb.add('metal', new THREE.CylinderGeometry(0.25, 0.3, 0.16, 24, 1, true, Math.PI * 0.75, Math.PI * 1.5), MB.mat(0, -0.11, 0), shade(L.metal, 0.05));
    } else if (tier === 2) { // a visored bascinet with breaths and a crest ridge
      mb.add('metal', lathe([[0.001, 0.36], [0.07, 0.35], [0.16, 0.3], [0.225, 0.18], [0.25, 0.02], [0.24, -0.16], [0.21, -0.22]], 28), MB.mat(0, 0, 0), steel);
      mb.add('metal', new THREE.SphereGeometry(0.26, 24, 12, -Math.PI * 0.35, Math.PI * 0.7, Math.PI * 0.32, Math.PI * 0.5), MB.mat(0, 0.0, 0.03, 1, 1, 1.2), shade(steel, 0.05)); // visor
      mb.box('dark', 0, 0.07, 0.3, 0.2, 0.022, 0.02, '#050505');
      for (let k = 0; k < 4; k++) mb.box('dark', 0.05 - k * 0.035 + 0.05, -0.04, 0.3, 0.012, 0.05, 0.02, '#050505');
      mb.box('metal', 0, 0.29, 0, 0.035, 0.1, 0.38, L.metal);
      mb.cyl('metal', 0, -0.2, 0, 0.215, 0.03, L.metal, 28);
    } else { // a gilded winged great helm with a plume
      mb.add('metal', lathe([[0.001, 0.38], [0.1, 0.37], [0.2, 0.31], [0.25, 0.18], [0.255, -0.05], [0.24, -0.2], [0.22, -0.24]], 28), MB.mat(0, 0, 0), steel);
      mb.box('dark', 0, 0.09, 0.245, 0.24, 0.026, 0.03, '#050505');
      mb.box('metal', 0, 0.02, 0.255, 0.035, 0.32, 0.03, L.acc);
      for (const sx of [-1, 1]) {
        const w = new THREE.Shape(); w.moveTo(0, 0); w.quadraticCurveTo(0.12, 0.04, 0.2, 0.26); w.quadraticCurveTo(0.12, 0.16, 0.06, 0.14); w.quadraticCurveTo(0.03, 0.08, 0, 0.06); w.closePath();
        mb.geo('metal', extrude(w, 0.02, 0.006, 10), sx * 0.24, 0.12, -0.02, 0, sx > 0 ? -0.35 : Math.PI + 0.35, 0, 1, L.metal);
      }
      for (let k = 0; k < 7; k++) mb.sph('cloth', 0, 0.4 + Math.sin(k / 6 * 2.2) * 0.06, 0.12 - k * 0.055, 0.06, 0.09, 0.07, k % 2 ? '#e8e0d0' : L.trim, 8);
      mb.cyl('metal', 0, -0.23, 0, 0.225, 0.03, L.metal, 28);
      if (g) for (let k = 0; k < 6; k++) { const a = -0.7 + k * 0.28; mb.box('glow', Math.sin(a) * 0.256, 0.2, Math.cos(a) * 0.256, 0.006, 0.024, 0.006, hot(rar >= 2 ? RARITY_COLORS[rar] : g, 2.2), 0, a, 0.5); }
    }
  } else if (wc === 'medium') { // a leather cap with ear flaps, a riveted brow band, and a fur trim on the best
    mb.add('leather', lathe([[0.001, 0.33], [0.1, 0.32], [0.18, 0.27], [0.235, 0.16], [0.25, 0.03]], 24), MB.mat(0, 0, 0), L.base);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; mb.add('leather', new THREE.TorusGeometry(0.2, 0.006, 4, 24, 1.2), MB.mat(0, 0.12, 0, 1, 1, 1, 0, a, 0), L.trim); }
    mb.cyl('leather', 0, 0.03, 0, 0.255, 0.05, L.trim, 24);
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; mb.sph('metal', Math.cos(a) * 0.258, 0.03, Math.sin(a) * 0.258, 0.013, 0.013, 0.013, L.metal, 8); }
    for (const sx of [-1, 1]) mb.box('leather', sx * 0.235, -0.1, 0.0, 0.03, 0.22, 0.16, L.base, 0, 0, sx * -0.12);
    if (tier >= 2) mb.add('leather', new THREE.CylinderGeometry(0.24, 0.27, 0.12, 24, 1, true, Math.PI * 0.75, Math.PI * 1.5), MB.mat(0, -0.06, 0), shade(L.base, -0.05));
    if (tier === 3) { mb.add('fur', new THREE.TorusGeometry(0.255, 0.035, 8, 28), MB.mat(0, 0.05, 0, 1, 1, 1, Math.PI / 2, 0, 0), '#e8e0d0'); mb.sph('gem', 0, 0.2, 0.235, 0.04, 0.05, 0.02, rar >= 1 ? RARITY_COLORS[rar] : '#3affc0', 12); }
  } else { // a deep cloth hood with a shadowed face, trimmed hem and a clasp
    mb.add('cloth', new THREE.SphereGeometry(0.27, 24, 16, Math.PI * 0.32, Math.PI * 1.36, 0, Math.PI * 0.8), MB.mat(0, 0.05, -0.01, 1, 1.08, 1.05, 0, Math.PI / 2, 0), L.base);
    mb.add('cloth', new THREE.ConeGeometry(0.1, 0.22, 12), MB.mat(0, 0.18, -0.24, 1, 1, 1, -1.25, 0, 0), L.base);
    mb.sph('dark', 0, -0.01, 0.05, 0.36, 0.4, 0.3, '#0a0806', 12);
    mb.add('cloth', new THREE.TorusGeometry(0.2, 0.022, 6, 24, Math.PI * 1.1), MB.mat(0, 0.04, 0.2, 1, 1.15, 0.6, 0, 0, -Math.PI * 0.05), L.trim);
    mb.add('cloth', new THREE.CylinderGeometry(0.2, 0.3, 0.14, 24, 1, true), MB.mat(0, -0.22, -0.01), shade(L.base, -0.06));
    mb.cyl('metal', 0, -0.17, 0.25, 0.03, 0.012, L.metal, 12, null, Math.PI / 2, 0, 0);
    if (g) mb.add('glow', new THREE.TorusGeometry(0.2, 0.006, 4, 24, Math.PI * 1.1), MB.mat(0, 0.04, 0.215, 1, 1.15, 0.6, 0, 0, -Math.PI * 0.05), hot(rar >= 2 ? RARITY_COLORS[rar] : g, 2));
  }
}
// ---------- pauldrons (worn or as part of the chest icon) ----------
// side: +1 left shoulder (the humanoid's +x), -1 right. Origin at the shoulder joint; plates curve out along ±x.
function pauldron(mb, side, wc, tier, rar, ox = 0, oy = 0, oz = 0) {
  const L = lookOf(wc, tier);
  const k = L.key === 'cloth' ? 'cloth' : L.key;
  const n = wc === 'heavy' ? 3 : wc === 'medium' ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const r = 0.16 - i * 0.012;
    mb.add(k, new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), MB.mat(ox + side * (0.02 + i * 0.03), oy - i * 0.055, oz, 1.05, 0.75, 1, 0, 0, side * -(0.45 + i * 0.22)), i ? shade(L.base, -0.05 * i) : L.base);
    if (wc !== 'light') mb.add('metal', new THREE.TorusGeometry(r * 0.99, 0.008, 4, 28), MB.mat(ox + side * (0.02 + i * 0.03), oy - i * 0.055 + r * 0.75 * Math.cos(Math.PI * 0.42) * 0.02, oz, 1.05, 1, 1, Math.PI / 2, 0, side * -(0.45 + i * 0.22)), i === 0 ? L.metal : shade(L.metal, -0.1));
  }
  if (wc === 'heavy' && tier >= 2) mb.add('metal', new THREE.ConeGeometry(0.025, 0.08, 8), MB.mat(ox + side * 0.06, oy + 0.11, oz, 1, 1, 1, 0, 0, side * -0.4), L.metal);
  if (wc === 'medium') for (let j = 0; j < 3; j++) mb.sph('metal', ox + side * (0.05 + j * 0.03), oy + 0.08 - j * 0.03, oz + 0.06, 0.012, 0.012, 0.012, L.metal, 8);
  if (wc === 'light') mb.add('cloth', new THREE.TorusGeometry(0.12, 0.012, 4, 24), MB.mat(ox + side * 0.06, oy - 0.03, oz, 1, 1, 1, Math.PI / 2, 0, side * -0.9), L.trim);
}

function chest(mb, wc, tier, rar) {
  const L = lookOf(wc, tier); const k = L.key;
  if (wc === 'light') { // a long tunic with sleeves, a sash and trimmed hems
    mb.add('cloth', torso(0.3, -0.36, 0.62, 0.08), MB.mat(0, 0, 0), L.base);
    for (const sx of [-1, 1]) mb.add('cloth', new THREE.CylinderGeometry(0.075, 0.11, 0.3, 14, 1), MB.mat(sx * 0.27, 0.12, 0, 1, 1, 0.85, 0, 0, sx * 0.8), L.base);
    for (const sx of [-1, 1]) mb.add('cloth', new THREE.TorusGeometry(0.1, 0.014, 6, 18), MB.mat(sx * 0.37, 0.025, 0, 1, 1, 0.85, Math.PI / 2, 0, sx * 0.8), L.trim);
    mb.add('cloth', new THREE.TorusGeometry(0.205, 0.018, 6, 28), MB.mat(0, -0.355, 0, 1, 1, 0.66, Math.PI / 2, 0, 0), L.trim);
    mb.cyl('cloth', 0, -0.06, 0, 0.19, 0.06, L.acc, 28, null, 0, 0, 0); mb.box('cloth', 0.06, -0.14, 0.12, 0.05, 0.16, 0.012, L.acc, 0, 0, 0.15);
    mb.add('cloth', new THREE.TorusGeometry(0.11, 0.018, 6, 20, Math.PI), MB.mat(0, 0.29, 0.03, 1, 1, 0.7, -0.3, 0, Math.PI), L.trim);
    mb.box('cloth', 0, 0.12, 0.125, 0.025, 0.3, 0.01, L.trim);
    if (L.glow) for (let i = 0; i < 6; i++) mb.box('glow', 0, -0.16 - i * 0.03, 0.128, 0.11 - i * 0.012, 0.006, 0.004, hot(rar >= 2 ? RARITY_COLORS[rar] : L.glow, 2));
    pauldron(mb, 1, wc, tier, rar, 0.22, 0.24, 0); pauldron(mb, -1, wc, tier, rar, -0.22, 0.24, 0);
  } else if (wc === 'medium') { // a leather jerkin: laced front, straps and buckles, riveted shoulder guards
    mb.add('leather', torso(0.3, -0.22, 0.64, 0.02), MB.mat(0, 0, 0), L.base);
    for (let i = 0; i < 6; i++) mb.box('leather', 0, 0.22 - i * 0.075, 0.13, 0.08, 0.012, 0.012, L.trim, 0, 0, i % 2 ? 0.5 : -0.5);
    mb.box('leather', 0, 0.02, 0.127, 0.02, 0.44, 0.01, L.trim);
    mb.cyl('leather', 0, -0.15, 0, 0.19, 0.05, L.trim, 28); mb.box('metal', 0.08, -0.15, 0.125, 0.05, 0.05, 0.012, L.metal);
    for (let i = 0; i < 3; i++) mb.cyl('leather', 0, -0.205 - i * 0.02, 0, 0.2 + i * 0.006, 0.02, shade(L.base, -0.04 * i), 28);
    mb.box('leather', 0, 0.06, 0.125, 0.4, 0.035, 0.012, L.trim, 0, 0, 0.6); mb.box('metal', -0.06, 0.1, 0.13, 0.035, 0.035, 0.01, L.metal);
    for (let i = 0; i < 8; i++) mb.sph('metal', -0.14 + (i % 4) * 0.093, i < 4 ? 0.2 : -0.05, 0.125, 0.012, 0.012, 0.008, L.metal, 8);
    if (tier === 3) for (let i = 0; i < 18; i++) mb.sph('leather', -0.13 + (i % 6) * 0.052, -0.02 + Math.floor(i / 6) * 0.05, 0.12, 0.05, 0.035, 0.02, shade(L.base, (i % 2) * 0.06), 8); // wyvern scales
    pauldron(mb, 1, wc, tier, rar, 0.22, 0.24, 0); pauldron(mb, -1, wc, tier, rar, -0.22, 0.24, 0);
  } else { // a plate cuirass: shaped breastplate with a medial ridge, fauld lames, gorget, layered pauldrons
    mb.add('metal', torso(0.3, -0.16, 0.66), MB.mat(0, 0, 0), L.base);
    mb.add('metal', new THREE.SphereGeometry(0.2, 20, 12, -Math.PI * 0.4, Math.PI * 0.8, Math.PI * 0.25, Math.PI * 0.5), MB.mat(0, 0.08, 0.0, 1, 1.15, 0.72), shade(L.base, 0.04));
    mb.box('metal', 0, 0.08, 0.142, 0.016, 0.3, 0.02, shade(L.base, 0.1));
    for (let i = 0; i < 3; i++) mb.add('metal', new THREE.CylinderGeometry(0.2 + i * 0.012, 0.21 + i * 0.012, 0.05, 28, 1, true), MB.mat(0, -0.18 - i * 0.045, 0, 1, 1, 0.68), shade(L.base, -0.04 * i));
    for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) mb.sph('metal', sx * 0.15, -0.18 - i * 0.045, 0.1, 0.012, 0.012, 0.012, L.metal, 8);
    mb.add('metal', new THREE.CylinderGeometry(0.1, 0.13, 0.06, 24, 1, true), MB.mat(0, 0.32, 0, 1, 1, 0.85), shade(L.base, 0.05));
    mb.add('metal', new THREE.TorusGeometry(0.13, 0.01, 6, 28), MB.mat(0, 0.29, 0, 1, 0.85, 1, Math.PI / 2, 0, 0), L.metal);
    if (tier >= 2) { mb.add('metal', new THREE.TorusGeometry(0.05, 0.008, 6, 20), MB.mat(0, 0.12, 0.148), L.acc); mb.sph('gem', 0, 0.12, 0.15, 0.06, 0.06, 0.03, rar >= 1 ? RARITY_COLORS[rar] : '#3a8aff', 12); }
    if (L.glow) for (let i = 0; i < 6; i++) { const a = -0.6 + i * 0.24; mb.box('glow', Math.sin(a) * 0.18, -0.02, Math.cos(a) * 0.115 + 0.012, 0.012, 0.03, 0.004, hot(rar >= 2 ? RARITY_COLORS[rar] : L.glow, 2.2), 0, a, 0); }
    pauldron(mb, 1, wc, tier, rar, 0.23, 0.25, 0); pauldron(mb, -1, wc, tier, rar, -0.23, 0.25, 0);
  }
}
function hands(mb, wc, tier, rar) {
  const L = lookOf(wc, tier); const k = L.key === 'metal' ? 'metal' : L.key;
  for (const sx of [-1, 1]) {
    const x = sx * 0.12;
    // cuff, back of the hand, four fingers, a thumb
    if (wc === 'heavy') {
      mb.cyl('metal', x, -0.09, 0, 0.07, 0.12, L.base, 16, 0.085);
      for (let i = 0; i < 3; i++) mb.add('metal', new THREE.SphereGeometry(0.07, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), MB.mat(x, -0.03 + i * 0.045, 0.0, 0.9, 0.5, 0.75), shade(L.base, -0.03 * i));
      for (let f = 0; f < 4; f++) for (let j = 0; j < 3; j++) mb.box('metal', x - 0.036 + f * 0.024, 0.11 + j * 0.032, 0.012 - j * 0.004, 0.02, 0.03, 0.026, shade(L.base, 0.04 * (j % 2)), 0.1 * j, 0, 0);
      mb.cyl('metal', x, -0.15, 0, 0.074, 0.018, L.metal, 16);
    } else {
      mb.cyl(k, x, -0.07, 0, 0.056, 0.11, L.base, 14, 0.07);
      mb.box(k, x, 0.04, 0.0, 0.1, 0.13, 0.05, L.base);
      for (let f = 0; f < 4; f++) mb.cyl(k, x - 0.036 + f * 0.024, 0.15, 0.0, 0.011, 0.1, L.base, 8);
      if (wc === 'medium') { mb.box('metal', x, 0.05, 0.028, 0.06, 0.04, 0.008, L.metal); mb.cyl('leather', x, -0.115, 0, 0.074, 0.018, L.trim, 14); }
      else mb.cyl('cloth', x, -0.115, 0, 0.074, 0.016, L.acc, 14);
    }
    mb.box(k, x - sx * 0.06, 0.05, 0.015, 0.024, 0.07, 0.026, L.base, 0, 0, sx * 0.6);
    if (L.glow) mb.box('glow', x, 0.0, wc === 'heavy' ? 0.055 : 0.028, 0.05, 0.006, 0.004, hot(rar >= 2 ? RARITY_COLORS[rar] : L.glow, 2));
  }
}
function legs(mb, wc, tier, rar) {
  const L = lookOf(wc, tier); const k = L.key;
  mb.add(k === 'metal' ? 'leather' : k, new THREE.CylinderGeometry(0.19, 0.17, 0.14, 24), MB.mat(0, 0.15, 0, 1, 1, 0.7), k === 'metal' ? '#4a3424' : L.base);
  mb.cyl('leather', 0, 0.21, 0, 0.195, 0.035, k === 'metal' ? '#3a2416' : L.trim, 24, null, 0, 0, 0);
  mb.box('metal', 0, 0.21, 0.14, 0.05, 0.04, 0.012, L.metal);
  for (const sx of [-1, 1]) {
    const x = sx * 0.095;
    mb.add(k === 'metal' ? 'cloth' : k, new THREE.CylinderGeometry(0.088, 0.065, 0.5, 16), MB.mat(x, -0.12, 0, 1, 1, 1, 0, 0, sx * -0.04), k === 'metal' ? '#5a4a3a' : L.base);
    if (wc === 'heavy') {
      mb.add('metal', new THREE.CylinderGeometry(0.092, 0.08, 0.2, 16, 1, true, -Math.PI * 0.6, Math.PI * 1.2), MB.mat(x, 0.0, 0.004), L.base); // cuisse
      mb.add('metal', new THREE.SphereGeometry(0.06, 14, 8), MB.mat(x, -0.12, 0.05, 1, 0.9, 0.8), shade(L.base, 0.06)); // poleyn
      mb.add('metal', new THREE.ConeGeometry(0.03, 0.05, 8), MB.mat(x + sx * 0.05, -0.12, 0.04, 1, 1, 1, 0, 0, sx * -1.4), L.metal);
      mb.add('metal', new THREE.CylinderGeometry(0.075, 0.066, 0.22, 16, 1, true, -Math.PI * 0.6, Math.PI * 1.2), MB.mat(x, -0.26, 0.004), L.base); // greave
    } else if (wc === 'medium') {
      mb.sph('leather', x, -0.12, 0.06, 0.1, 0.09, 0.05, L.trim, 10);
      for (let j = 0; j < 3; j++) mb.cyl('leather', x, 0.05 - j * 0.07, 0, 0.09 - j * 0.003, 0.018, L.trim, 16);
    } else {
      mb.box('cloth', x + sx * 0.06, -0.1, 0.02, 0.012, 0.42, 0.02, L.trim);
      mb.cyl('cloth', x, -0.35, 0, 0.068, 0.03, L.acc, 16);
    }
    if (L.glow) mb.box('glow', x, -0.02, wc === 'heavy' ? 0.095 : 0.09, 0.006, 0.12, 0.004, hot(rar >= 2 ? RARITY_COLORS[rar] : L.glow, 2));
  }
}
function feet(mb, wc, tier, rar) {
  const L = lookOf(wc, tier); const k = L.key;
  for (const sx of [-1, 1]) {
    const x = sx * 0.11, shaft = wc === 'light' ? 0.12 : 0.22;
    mb.add(k, new THREE.CylinderGeometry(0.066, 0.07, shaft, 16), MB.mat(x, -0.05 + shaft / 2, 0), L.base);
    mb.sph(k, x, -0.07, 0.06, 0.14, 0.1, 0.26, shade(L.base, -0.04), 12);
    mb.box('leather', x, -0.115, 0.03, 0.13, 0.025, 0.3, '#2a1c12');
    mb.cyl(k, x, -0.05 + shaft, 0, 0.074, 0.03, wc === 'heavy' ? L.metal : L.trim, 16);
    if (wc === 'heavy') { for (let j = 0; j < 3; j++) mb.add('metal', new THREE.CylinderGeometry(0.07, 0.072, 0.04, 16, 1, true, -Math.PI * 0.6, Math.PI * 1.2), MB.mat(x, -0.06 + j * 0.035, 0.07 + j * 0.0, 0.9, 1, 1.3, -0.5, 0, 0), shade(L.base, -0.03 * j)); mb.sph('metal', x, -0.04, 0.0, 0.09, 0.09, 0.12, L.base, 12); }
    if (wc === 'medium') { mb.cyl('leather', x, 0.06, 0, 0.07, 0.02, L.trim, 16); mb.box('metal', x + sx * 0.07, 0.06, 0, 0.012, 0.03, 0.03, L.metal); }
    if (wc === 'light') { mb.add('cloth', new THREE.TorusGeometry(0.068, 0.01, 4, 18), MB.mat(x, 0.02, 0, 1, 1, 1, Math.PI / 2, 0, 0), L.acc); }
    if (L.glow) mb.box('glow', x, 0.03, 0.072, 0.006, 0.08, 0.004, hot(rar >= 2 ? RARITY_COLORS[rar] : L.glow, 2));
  }
}
function amulet(mb, tier, rar) {
  const band = ['#c8784a', '#d8dee6', '#f2c95a'][Math.max(0, Math.min(2, tier - 1))];
  const gem = rar >= 1 ? RARITY_COLORS[rar] : ['#e04a3a', '#3a8aff', '#c66dff'][Math.max(0, Math.min(2, tier - 1))];
  // a chain of little links on a curve, a bail, and a pendant with a gem
  const pts = []; for (let i = 0; i <= 26; i++) { const a = Math.PI * (i / 26); pts.push(V3(Math.cos(a) * 0.17, 0.08 + Math.sin(a) * 0.17, 0)); }
  for (let i = 0; i < pts.length; i++) mb.add('metal', new THREE.TorusGeometry(0.012, 0.0035, 4, 10), MB.mat(pts[i].x, pts[i].y, 0, 1, 1, 1, i % 2 ? Math.PI / 2 : 0, 0, Math.atan2(pts[i].y - 0.08, pts[i].x) + Math.PI / 2), band);
  mb.add('metal', new THREE.TorusGeometry(0.018, 0.005, 6, 14), MB.mat(0, 0.06, 0, 1, 1, 1, 0, Math.PI / 2, 0), band);
  for (const sx of [-1, 1]) { mb.add('metal', new THREE.TorusGeometry(0.012, 0.0035, 4, 10), MB.mat(sx * 0.17, 0.065, 0, 1, 1, 1, Math.PI / 2, 0, 0), band); mb.add('metal', new THREE.TorusGeometry(0.012, 0.0035, 4, 10), MB.mat(sx * 0.14, 0.045, 0, 1, 1, 1, 0, 0, sx * 0.9), band); }
  if (tier === 1) { mb.cyl('metal', 0, -0.03, 0, 0.065, 0.016, band, 24, null, Math.PI / 2, 0, 0); mb.sph('gem', 0, -0.03, 0.012, 0.06, 0.06, 0.03, gem, 12); }
  else if (tier === 2) { const d = new THREE.Shape([V2(0, 0.07), V2(0.06, 0), V2(0, -0.09), V2(-0.06, 0)]); mb.geo('metal', extrude(d, 0.014, 0.004, 1), 0, -0.04, 0, 0, 0, 0, 1, band); mb.add('gem', new THREE.OctahedronGeometry(0.035, 0), MB.mat(0, -0.045, 0.012, 1, 1.3, 0.6), gem); }
  else { mb.cyl('metal', 0, -0.04, 0, 0.07, 0.018, band, 24, null, Math.PI / 2, 0, 0); for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; mb.add('metal', new THREE.ConeGeometry(0.012, 0.035, 6), MB.mat(Math.cos(a) * 0.085, -0.04 + Math.sin(a) * 0.085, 0, 1, 1, 1, 0, 0, a - Math.PI / 2), band); } mb.sph('gem', 0, -0.04, 0.012, 0.075, 0.075, 0.035, gem, 12); mb.sph('glow', 0, -0.04, 0.03, 0.02, 0.02, 0.01, hot(gem, 2), 8); }
}

const BUILD = { head: helmet, chest, hands, legs, feet };
const cache = new Map();
// An armour piece as a THREE.Group (centred near the origin, front toward +z). opts: { rarity, ctx: 'world' | 'icon' }
export function buildArmor(slot, wclass = 'medium', tier = 1, opts = {}) {
  const rar = Math.max(0, Math.min(4, opts.rarity | 0)), ctx = opts.ctx || 'world';
  tier = Math.max(1, Math.min(3, tier | 0 || 1)); wclass = ARMOR_LOOK[wclass] ? wclass : 'medium';
  const key = [slot, wclass, tier, rar, ctx].join('|');
  let t = cache.get(key);
  if (!t) {
    const mb = new MB();
    if (slot === 'amulet') amulet(mb, tier, rar); else (BUILD[slot] || chest)(mb, wclass, tier, rar);
    t = mb.build(ctx); cache.set(key, t);
  }
  const g = new THREE.Group(); g.name = 'armor-' + slot;
  for (const c of t.children) { const m = new THREE.Mesh(c.geometry, c.material); m.castShadow = c.castShadow; m.receiveShadow = true; g.add(m); }
  return g;
}

// ---------- wearable pieces ----------
// makeHelmet(wclass, tier, { rarity }) -> THREE.Group to add to the humanoid's head group (parts.head): origin at
// the head pivot, sized for the 0.38-wide skull at y 0.06, face toward +z. Hide parts.hair while it is worn.
export function makeHelmet(wclass = 'heavy', tier = 1, opts = {}) {
  const g = buildArmor('head', wclass, tier, opts);
  g.position.y = 0.0; g.scale.setScalar(0.92);
  return g;
}
// makePauldron(side, wclass, tier, { rarity }) -> THREE.Group to add to parts.upper at (side * 0.36, 0.78, 0):
// side +1 is the model's left (+x) shoulder, -1 the right.
export function makePauldron(side = 1, wclass = 'heavy', tier = 1, opts = {}) {
  const rar = Math.max(0, Math.min(4, opts.rarity | 0)), ctx = opts.ctx || 'world';
  const key = ['pauldron', side, wclass, tier, rar, ctx].join('|');
  let t = cache.get(key);
  if (!t) { const mb = new MB(); pauldron(mb, side, ARMOR_LOOK[wclass] ? wclass : 'heavy', Math.max(1, Math.min(3, tier | 0 || 1)), rar); t = mb.build(ctx); cache.set(key, t); }
  const g = new THREE.Group(); g.name = 'pauldron';
  for (const c of t.children) { const m = new THREE.Mesh(c.geometry, c.material); m.castShadow = c.castShadow; m.receiveShadow = true; g.add(m); }
  return g;
}
