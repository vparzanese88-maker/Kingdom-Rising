// Aiming down the barrel (Kingdom Arena, right click with a gun or bow): a detailed weapon seen from the cheek weld,
// drawn on top of the world like a first-person view. Civil-war style rifle: walnut stock, blued barrel, brass bands
// and sights, a side-lock hammer and ramrod; the blunderbuss has a short brass barrel with a flared bell; the bow is
// drawn to the cheek with the arrow running out to the target.
import * as THREE from 'three';

const M = (c, metal = 0, rough = 0.7) => new THREE.MeshStandardMaterial({ color: c, metalness: metal, roughness: rough });
const box = (g, m, w, h, d, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g.add(o); return o; };
const cyl = (g, m, r0, r1, len, x, y, z, seg = 12) => { const geo = new THREE.CylinderGeometry(r0, r1, len, seg); geo.rotateX(Math.PI / 2); const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };

// a gloved hand: palm block, curled fingers, thumb
function hand(g, skin, glove, x, y, z, rz = 0, ry = 0) {
  const h = new THREE.Group(); h.position.set(x, y, z); h.rotation.set(0, ry, rz); g.add(h);
  box(h, glove, 0.05, 0.03, 0.085, 0, 0, 0);
  for (let i = 0; i < 4; i++) { const f = box(h, glove, 0.012, 0.022, 0.02, -0.018 + i * 0.012, 0.02, -0.025 + i * 0.002); f.rotation.x = -0.5; }
  const t = box(h, glove, 0.014, 0.014, 0.04, 0.03, 0.012, -0.01); t.rotation.y = -0.5;
  box(h, skin, 0.052, 0.03, 0.03, 0, -0.002, 0.055); // wrist showing above the glove
  return h;
}
function sleeve(g, cloth, x, y, z, len, rx = 0, ry = 0) { const s = cyl(g, cloth, 0.034, 0.04, len, x, y, z, 10); s.rotation.x += rx; s.rotation.y = ry; return s; }

export function buildAdsView(kind, look = {}) {
  const g = new THREE.Group(); g.name = 'adsView';
  const skin = M(look.skin || '#d8a888', 0, 0.8), glove = M(look.glove || '#4a3322', 0, 0.85), cloth = M(look.cloth || '#2a3550', 0, 0.9);
  const walnut = M('#5b3418', 0, 0.55), walnutD = M('#3e230f', 0, 0.6), blued = M('#2c3036', 0.85, 0.32), steel = M('#8a9098', 0.9, 0.28), brass = M('#c9a14a', 0.9, 0.3);
  if (kind === 'bow') {
    // the bow, canted a touch, held out in the left hand; the string drawn back to the cheek; the arrow runs to the target
    const bow = new THREE.Group(); bow.position.set(-0.045, -0.015, -0.62); bow.rotation.z = 0.18; g.add(bow);
    const wood = M('#6a4020', 0, 0.6), grip = M('#2a1a10', 0, 0.9);
    box(bow, grip, 0.03, 0.12, 0.03, 0, 0, 0);
    for (const sgn of [1, -1]) { // limbs: three tapering segments that curve away from you
      let y = 0.06 * sgn, z = 0, a = 0;
      for (let i = 0; i < 4; i++) { const L = 0.13, th = 0.022 - i * 0.004; a += 0.16; const seg = box(bow, wood, th, L, th * 0.8, 0, y + Math.cos(a) * L / 2 * sgn, z + Math.sin(a) * L / 2); seg.rotation.x = -a * sgn; y += Math.cos(a) * L * sgn; z += Math.sin(a) * L; }
      bow.userData['tip' + sgn] = new THREE.Vector3(0, y, z);
    }
    const nock = new THREE.Vector3(0.04, -0.01, 0.44); // the drawn string, at your cheek (in the bow's frame)
    const strM = new THREE.LineBasicMaterial({ color: '#e8e0c8' });
    const sg = new THREE.BufferGeometry().setFromPoints([bow.userData.tip1, nock, bow.userData['tip-1']]); bow.add(new THREE.Line(sg, strM));
    // the arrow
    const ar = new THREE.Group(); g.add(ar); const shaft = M('#b08a58', 0, 0.6), fl = M('#c83a2a', 0, 0.8);
    cyl(ar, shaft, 0.0035, 0.0035, 0.62, 0, -0.012, -0.48, 6); const head = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.04, 6), steel); head.rotation.x = -Math.PI / 2; head.position.set(0, -0.012, -0.81); ar.add(head);
    for (let i = 0; i < 3; i++) { const f = box(ar, fl, 0.001, 0.008, 0.035, 0, -0.012, -0.2); f.rotation.z = i * 2.09; }
    hand(g, skin, glove, -0.045, -0.035, -0.62, 1.4, 0); sleeve(g, cloth, -0.085, -0.13, -0.42, 0.34, 0.5, 0.15);
    hand(g, skin, glove, 0.07, -0.085, -0.17, -0.3, 0.2);
    g.userData.base = 0; g.userData.muzzle = new THREE.Vector3(0, -0.012, -0.82);
    return g;
  }
  const blunder = kind === 'blunderbuss', len = blunder ? 0.66 : 1.05, barM = blunder ? brass : blued, bore = -0.05, z0 = -0.3; // z0: the breech
  const zr = z0 - 0.12, zf = z0 - len + 0.04; // rear and front sight positions; their tops line up through your eye
  const yr = bore * 0.25, yf = yr * (zf / zr); // (the front blade sits in the rear notch on one line from the eye)
  const zAt = (t) => z0 - len * t;
  cyl(g, barM, blunder ? 0.015 : 0.011, blunder ? 0.018 : 0.0125, len, 0, bore, z0 - len / 2, 16);
  cyl(g, barM, 0.0125, 0.0125, 0.04, 0, bore, z0 + 0.02, 12); // breech plug
  if (blunder) { const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.016, 0.1, 18, 1, true), brass.clone()); bell.material.side = THREE.DoubleSide; bell.rotation.x = -Math.PI / 2; bell.position.set(0, bore, z0 - len - 0.04); g.add(bell); }
  else cyl(g, steel, 0.008, 0.008, 0.012, 0, bore - 0.016, zAt(0.97), 6); // bayonet lug
  // walnut forend under the barrel, the wrist and the comb
  box(g, walnut, 0.044, 0.036, len * 0.84, 0, bore - 0.027, z0 - len * 0.42);
  box(g, walnut, 0.048, 0.07, 0.22, 0, bore - 0.05, z0 + 0.1);
  const wrist = box(g, walnutD, 0.042, 0.055, 0.2, 0, bore - 0.095, z0 + 0.27); wrist.rotation.x = 0.4;
  // brass bands (iron on the brass blunderbuss), ramrod beneath
  for (const t of blunder ? [0.38, 0.72] : [0.4, 0.66, 0.88]) { const b = cyl(g, blunder ? steel : brass, 0.025, 0.025, 0.016, 0, bore - 0.013, zAt(t), 16); b.scale.set(0.95, 1.3, 1); }
  cyl(g, steel, 0.0035, 0.0035, len * 0.9, 0, bore - 0.047, z0 - len * 0.45, 6);
  // sights: a steel rear ladder with a notch, a brass front blade
  const rh = yr - bore; box(g, steel, 0.005, rh, 0.01, -0.0075, bore + rh / 2, zr); box(g, steel, 0.005, rh, 0.01, 0.0075, bore + rh / 2, zr); box(g, steel, 0.026, rh * 0.45, 0.016, 0, bore + rh * 0.22, zr);
  const fh = yf - bore; box(g, brass, 0.003, fh, 0.016, 0, bore + fh / 2, zf); box(g, steel, 0.012, 0.008, 0.02, 0, bore + 0.01, zf);
  // the side lock: plate, a cocked hammer, the percussion nipple
  box(g, steel, 0.004, 0.022, 0.08, 0.025, bore - 0.03, z0 + 0.02);
  const ham = new THREE.Group(); ham.position.set(0.026, bore - 0.03, z0 + 0.05); g.add(ham); box(ham, steel, 0.006, 0.028, 0.009, 0, 0.012, 0); const spur = box(ham, steel, 0.006, 0.008, 0.02, 0, 0.026, 0.008); spur.rotation.x = 0.4;
  g.userData.hammer = ham;
  cyl(g, steel, 0.003, 0.003, 0.008, 0.018, bore - 0.004, z0 + 0.02, 6);
  const tg = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.004, 6, 12, Math.PI), brass); tg.rotation.set(0, Math.PI / 2, Math.PI); tg.position.set(0, bore - 0.08, z0 + 0.15); g.add(tg);
  // hands: the left cradles the forend out by the middle band, the right grips the wrist
  hand(g, skin, glove, -0.012, bore - 0.055, zAt(0.55), 0.3, 0); sleeve(g, cloth, -0.06, bore - 0.13, zAt(0.55) + 0.17, 0.32, 0.65, 0.3);
  hand(g, skin, glove, 0.02, bore - 0.1, z0 + 0.24, -0.15, 0);
  if (look.goblin) { // goblin-made: rust over the steel, rivets, a patch, wire wraps, a gauge on the side
    const rustM = M('#7a5236', 0, 0.8); g.traverse(o => { if (o.isMesh && o.material && o.material.metalness > 0.5) { o.material = o.material.clone(); o.material.color.lerp(new THREE.Color('#7a5a40'), 0.55); o.material.roughness = 0.7; } });
    for (let i = 0; i < 5; i++) { const r = new THREE.Mesh(new THREE.SphereGeometry(0.004, 5, 4), brass); r.position.set(0.016, bore + 0.004, zAt(0.15 + i * 0.15)); g.add(r); }
    box(g, rustM, 0.03, 0.006, 0.06, 0.012, bore + 0.008, zAt(0.3)); const ga = cyl(g, brass, 0.014, 0.014, 0.006, 0.028, bore - 0.02, z0 - 0.05, 12); ga.rotation.set(0, Math.PI / 2, 0);
    for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0025, 4, 10), M('#3a3a30', 0.6, 0.6)); t.position.set(0, bore, zAt(0.45 + i * 0.03)); g.add(t); } }
  g.rotation.x = Math.atan2(-yr, -zr); // tip the rifle so the sight line runs exactly through the crosshair
  g.userData.base = g.rotation.x;
  g.userData.muzzle = new THREE.Vector3(0, bore, z0 - len - (blunder ? 0.08 : 0.01));
  return g;
}
