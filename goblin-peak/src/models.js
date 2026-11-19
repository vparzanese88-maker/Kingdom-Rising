// Every shape in the game is built here from simple blocks, cones and cylinders.
import * as THREE from 'three';

const mats = new Map();
export function mat(color, o = {}) {
  const key = color + '|' + (o.e || 0) + '|' + (o.op || 1) + '|' + (o.flat ? 1 : 0);
  let m = mats.get(key);
  if (!m) { m = new THREE.MeshLambertMaterial({ color, emissive: o.e || 0, transparent: !!o.op, opacity: o.op || 1, flatShading: !!o.flat }); mats.set(key, m); }
  return m;
}
const boxG = new THREE.BoxGeometry(1, 1, 1), cylG = new THREE.CylinderGeometry(1, 1, 1, 14), coneG = new THREE.ConeGeometry(1, 1, 10), sphG = new THREE.SphereGeometry(1, 14, 10), icoG = new THREE.IcosahedronGeometry(1, 0), torG = new THREE.TorusGeometry(1, 0.16, 8, 20);
export const GEO = { boxG, cylG, coneG, sphG, icoG, torG };
function part(geo, color, sx, sy, sz, x = 0, y = 0, z = 0, o) { const m = new THREE.Mesh(geo, typeof color === 'object' ? color : mat(color, o)); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = true; return m; }
export const box = (c, sx, sy, sz, x, y, z, o) => part(boxG, c, sx, sy, sz, x, y, z, o);
export const cyl = (c, r, h, x, y, z, o) => part(cylG, c, r, h, r, x, y, z, o);
export const cone = (c, r, h, x, y, z, o) => part(coneG, c, r, h, r, x, y, z, o);
export const ball = (c, r, x, y, z, o) => part(sphG, c, r, r, r, x, y, z, o);
function grp(...kids) { const g = new THREE.Group(); for (const k of kids) g.add(k); return g; }

// A two-legged character facing -Z. Used for the hero, villagers, the princess, goblins, trolls and yetis.
export function biped(o = {}) {
  const g = new THREE.Group(), P = g.userData.parts = {};
  const skin = o.skin || 0xe8b890, shirt = o.shirt || 0x3b6fb5, pants = o.pants || 0x5a4630, w = o.wide || 1;
  g.add(box(shirt, 0.5 * w, 0.6, 0.28 * w, 0, 1.1, 0));
  if (o.belt) g.add(box(o.belt, 0.52 * w, 0.08, 0.3 * w, 0, 0.86, 0));
  const head = P.head = grp(box(skin, 0.36, 0.34, 0.34, 0, 0.17, 0), box(0x1a1410, 0.06, 0.06, 0.02, -0.09, 0.2, -0.175), box(0x1a1410, 0.06, 0.06, 0.02, 0.09, 0.2, -0.175));
  head.position.y = 1.42; g.add(head);
  if (o.hair) { head.add(box(o.hair, 0.4, 0.14, 0.38, 0, 0.36, 0.01)); head.add(box(o.hair, 0.4, o.longHair ? 0.6 : 0.26, 0.1, 0, o.longHair ? 0.08 : 0.24, 0.19)); }
  if (o.ears) { const e1 = cone(skin, 0.07, 0.3, -0.27, 0.2, 0); e1.rotation.z = 1.2; const e2 = cone(skin, 0.07, 0.3, 0.27, 0.2, 0); e2.rotation.z = -1.2; head.add(e1, e2); const n = cone(skin, 0.06, 0.2, 0, 0.12, -0.24); n.rotation.x = -1.57; head.add(n); head.add(box(0xf4f0d8, 0.05, 0.07, 0.03, -0.07, 0.02, -0.175), box(0xf4f0d8, 0.05, 0.07, 0.03, 0.07, 0.02, -0.175)); }
  if (o.crown) { head.add(cyl(0xf2c230, 0.2, 0.1, 0, 0.47, 0, { e: 0x4a3500 })); for (let i = 0; i < 5; i++) head.add(cone(0xf2c230, 0.045, 0.13, Math.cos(i * 1.257) * 0.17, 0.57, Math.sin(i * 1.257) * 0.17, { e: 0x4a3500 })); }
  if (o.hat) head.add(cone(o.hat, 0.26, 0.4, 0, 0.52, 0));
  if (o.helm) head.add(box(o.helm, 0.4, 0.2, 0.38, 0, 0.32, 0), cone(o.helm, 0.05, 0.25, -0.2, 0.5, 0), cone(o.helm, 0.05, 0.25, 0.2, 0.5, 0));
  if (o.beard) head.add(box(o.beard, 0.3, 0.26, 0.08, 0, -0.06, -0.18));
  for (const sd of [-1, 1]) {
    const arm = grp(box(o.sleeve || shirt, 0.15, 0.32, 0.15, 0, -0.16, 0), box(skin, 0.13, 0.3, 0.13, 0, -0.46, 0)); arm.position.set(sd * 0.33 * w, 1.38, 0); g.add(arm); P[sd < 0 ? 'armL' : 'armR'] = arm;
    const leg = grp(box(pants, 0.19, 0.6, 0.2, 0, -0.3, 0), box(o.boots || 0x3a2a1c, 0.2, 0.22, 0.26, 0, -0.69, -0.02)); leg.position.set(sd * 0.13 * w, 0.8, 0); g.add(leg); P[sd < 0 ? 'legL' : 'legR'] = leg;
  }
  if (o.dress) { const d = cone(o.dress, 0.5, 0.95, 0, 0.42, 0); g.add(d); g.add(cyl(o.dress, 0.5, 0.1, 0, -0.02 + 0.02, 0)); }
  if (o.cape) { const c = box(o.cape, 0.46, 0.8, 0.05, 0, 1.0, 0.18); c.rotation.x = 0.12; g.add(c); P.cape = c; }
  if (o.club) { const c = grp(cyl(0x6b4a2a, 0.06, 0.9, 0, -0.75, -0.2), ball(0x54381c, 0.16, 0, -0.75, -0.62)); c.children[0].rotation.x = 1.57; P.armR.add(c); }
  if (o.scale) g.scale.setScalar(o.scale);
  g.userData.h = 1.8 * (o.scale || 1);
  return g;
}
// mode: 'run' | 'idle' | 'air' | 'climb' | 'glide' | 'crouch' | 'swing' | 'swim' | 'cheer'
export function animBiped(g, t, speed, mode) {
  const P = g.userData.parts, sw = Math.sin(t) * Math.min(1, speed / 5) * 0.9;
  let aL = sw, aR = -sw, lL = -sw, lR = sw, az = 0, lean = 0;
  if (mode === 'air') { aL = -2.4; aR = -2.4; lL = 0.5; lR = -0.3; az = 0.4; }
  else if (mode === 'climb') { aL = -2.6 + Math.sin(t) * 0.5; aR = -2.6 - Math.sin(t) * 0.5; lL = -0.6 - Math.sin(t) * 0.4; lR = -0.6 + Math.sin(t) * 0.4; }
  else if (mode === 'glide') { aL = -3.0; aR = -3.0; lL = 0.9; lR = 0.9; az = 0.5; lean = 1.0; }
  else if (mode === 'swing') { aL = -3.0; aR = -3.0; lL = 0.4; lR = 0.2; }
  else if (mode === 'swim') { aL = -2.8 + Math.sin(t) * 0.8; aR = -2.8 - Math.sin(t) * 0.8; lL = 0.9 + Math.sin(t * 2) * 0.3; lR = 0.9 - Math.sin(t * 2) * 0.3; lean = 1.2; }
  else if (mode === 'crouch') { lL = -1.2 + sw * 0.4; lR = -1.2 - sw * 0.4; lean = 0.7; aL = -0.5 + sw; aR = -0.5 - sw; }
  else if (mode === 'cheer') { aL = -2.8 + Math.sin(t * 2) * 0.3; aR = -2.8 - Math.sin(t * 2) * 0.3; }
  else if (mode === 'idle') { aL = Math.sin(t * 0.4) * 0.05; aR = -aL; lL = lR = 0; }
  P.armL.rotation.x = aL; P.armR.rotation.x = aR; P.armL.rotation.z = -az; P.armR.rotation.z = az; P.legL.rotation.x = lL; P.legR.rotation.x = lR;
  g.rotation.x = -lean; g.position.y = mode === 'crouch' ? -0.35 : 0;
}

export const hero = () => biped({ skin: 0xe9b98c, shirt: 0x2f8f4e, sleeve: 0xf0e6cf, pants: 0x6a4d2e, hair: 0x6b3d1c, belt: 0x3a2a1c, cape: 0xb5332a, hat: 0x2f8f4e });
export const princess = () => biped({ skin: 0xf0c4a0, shirt: 0xe86aa6, dress: 0xe86aa6, sleeve: 0xf7c6dd, hair: 0xf0c040, longHair: 1, crown: 1 });
export const goblin = (o = {}) => biped({ skin: o.skin || 0x6fae3c, shirt: o.shirt || 0x7a4a2a, pants: 0x4a3524, ears: 1, scale: o.scale || 0.72, hat: o.hat, helm: o.helm, club: o.club, wide: o.wide || 1.05, boots: 0x2a2018 });
export const troll = () => biped({ skin: 0x7d8a72, shirt: 0x5b4a3a, pants: 0x3f3428, ears: 1, scale: 2.1, wide: 1.5, club: 1 });
export const yeti = () => biped({ skin: 0xeef4fa, shirt: 0xdfe8f2, pants: 0xdfe8f2, boots: 0xbfd0e0, scale: 1.7, wide: 1.4, hair: 0xffffff });

export function boar(col = 0x7a5236) {
  const g = new THREE.Group(), P = g.userData.parts = { legs: [] };
  g.add(box(col, 0.7, 0.65, 1.3, 0, 0.75, 0), box(col, 0.5, 0.5, 0.5, 0, 0.75, -0.85), box(0xd9a0a0, 0.26, 0.2, 0.14, 0, 0.66, -1.14));
  const t1 = cone(0xf4f0d8, 0.05, 0.3, -0.2, 0.72, -1.1), t2 = cone(0xf4f0d8, 0.05, 0.3, 0.2, 0.72, -1.1); g.add(t1, t2, box(0x1a1410, 0.06, 0.06, 0.02, -0.14, 0.9, -1.1), box(0x1a1410, 0.06, 0.06, 0.02, 0.14, 0.9, -1.1));
  for (const [x, z] of [[-0.25, -0.45], [0.25, -0.45], [-0.25, 0.45], [0.25, 0.45]]) { const l = grp(box(0x4a3020, 0.16, 0.45, 0.16, 0, -0.22, 0)); l.position.set(x, 0.45, z); g.add(l); P.legs.push(l); }
  g.userData.h = 1.1; return g;
}
export function bat() {
  const g = new THREE.Group(), P = g.userData.parts = {};
  g.add(ball(0x4a3a5e, 0.28, 0, 0, 0), box(0xffd23a, 0.07, 0.07, 0.03, -0.1, 0.06, -0.26, { e: 0x664400 }), box(0xffd23a, 0.07, 0.07, 0.03, 0.1, 0.06, -0.26, { e: 0x664400 }), cone(0x4a3a5e, 0.07, 0.2, -0.14, 0.3, 0), cone(0x4a3a5e, 0.07, 0.2, 0.14, 0.3, 0));
  for (const sd of [-1, 1]) { const wg = grp(box(0x6a557f, 0.8, 0.04, 0.5, sd * 0.4, 0, 0)); wg.position.x = sd * 0.2; g.add(wg); P[sd < 0 ? 'wL' : 'wR'] = wg; }
  g.userData.h = 0.6; return g;
}
export function chest() {
  const g = new THREE.Group(); g.add(box(0x7a4a22, 1.1, 0.6, 0.7, 0, 0.3, 0), box(0xe2b33a, 1.14, 0.1, 0.74, 0, 0.3, 0), box(0xe2b33a, 0.16, 0.2, 0.06, 0, 0.5, -0.37));
  const lid = grp(box(0x8a5628, 1.1, 0.3, 0.7, 0, 0.15, -0.35), box(0xe2b33a, 1.14, 0.08, 0.74, 0, 0.3, -0.35)); lid.position.set(0, 0.6, 0.35); g.add(lid); g.userData.lid = lid; return g;
}
export function campfire() {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) { const l = cyl(0x5a3c22, 0.09, 0.9, 0, 0.12, 0); l.rotation.z = 1.2; l.rotation.y = i * 1.26; g.add(l); g.add(ball(0x77726a, 0.16, Math.cos(i * 1.26) * 0.6, 0.08, Math.sin(i * 1.26) * 0.6)); }
  const f = cone(0xff9a2a, 0.3, 0.9, 0, 0.6, 0, { e: 0xff5a00 }), f2 = cone(0xffe27a, 0.16, 0.5, 0, 0.45, 0, { e: 0xffb000 }); f.visible = f2.visible = false; f.castShadow = f2.castShadow = false; g.add(f, f2); g.userData.flames = [f, f2];
  const flag = grp(cyl(0x6b4a2a, 0.05, 3.2, 0, 1.6, 0), box(0x999999, 0.9, 0.55, 0.04, 0.5, 2.85, 0)); flag.position.set(1.4, 0, 0.6); g.add(flag); g.userData.flag = flag.children[1];
  return g;
}
export function tent(c = 0xc9a25a) { const g = new THREE.Group(), t = new THREE.Mesh(new THREE.ConeGeometry(1.9, 2.4, 4), mat(c, { flat: 1 })); t.position.y = 1.2; t.rotation.y = 0.785; t.castShadow = true; g.add(t, box(0x3a2a1c, 0.7, 1.2, 0.05, 0, 0.6, -1.33)); return g; }
export function sign() { return grp(cyl(0x6b4a2a, 0.07, 1.5, 0, 0.75, 0), box(0xc9a25a, 1.1, 0.6, 0.08, 0, 1.4, 0), box(0x6b4a2a, 0.8, 0.06, 0.1, 0, 1.5, 0), box(0x6b4a2a, 0.6, 0.06, 0.1, 0, 1.32, 0)); }
export function gate(c = 0xb5332a, w = 5) {
  const g = new THREE.Group(); g.add(box(0x8a8378, 1.1, 6, 1.1, -w, 3, 0), box(0x8a8378, 1.1, 6, 1.1, w, 3, 0), box(0x6b4a2a, w * 2 + 2.4, 0.8, 1.3, 0, 6.2, 0), box(c, 2.2, 2.6, 0.08, 0, 4.4, 0), cone(0x8a8378, 0.9, 1.2, -w, 6.6 + 0.6, 0), cone(0x8a8378, 0.9, 1.2, w, 6.6 + 0.6, 0));
  return g;
}
// An old leaning tree with one long branch over the drop; the gold ring hangs from it on a vine.
export function whipPost(h = 7.5, down = 1) {
  const g = new THREE.Group(), tr = cyl(0x5a3c22, 0.34, h + 2.5 + down, -3.1, (h + 2.5 - down) / 2, 0); tr.rotation.z = -0.06; g.add(tr);
  const br = cyl(0x5a3c22, 0.17, 4.2, -1.2, h + 1.25, 0); br.rotation.z = 1.42; g.add(br); const b2 = cyl(0x5a3c22, 0.1, 2, -2.4, h + 2.6, 0.5); b2.rotation.z = 0.8; b2.rotation.x = 0.5; g.add(b2);
  g.add(cone(0x2f7a36, 1.7, 2.6, -3.2, h + 4.2, 0, { flat: 1 }), cone(0x3f9a44, 1.2, 2, -3.2, h + 5.6, 0, { flat: 1 }), ball(0x2f7a36, 0.8, -0.2, h + 1.7, 0, { flat: 1 }), cyl(0x3f8a3a, 0.035, 1.0, 0, h + 0.75, 0));
  g.add(part(torG, 0xe2b33a, 0.3, 0.3, 0.3, 0, h, 0, { e: 0x6a4a00 })); return g;
}
// A fallen tree trunk lying along local X: length len, radius r, with a root plate and a few broken branches.
export function fallenTree(len, r, leafy) {
  const g = new THREE.Group(), t = cyl(0x6b4a2a, r, len, 0, 0, 0); t.rotation.z = Math.PI / 2; g.add(t);
  const rp = cyl(0x4a3020, r * 2.1, 0.3, -len / 2, 0, 0, { flat: 1 }); rp.rotation.z = Math.PI / 2; g.add(rp);
  for (let i = 0; i < 4; i++) { const b = cyl(0x5a3c22, r * 0.25, r * 2.6, -len / 2 + len * (0.25 + i * 0.2), r * 0.9, (i % 2 ? 1 : -1) * r * 0.5); b.rotation.x = (i % 2 ? 1 : -1) * 0.7; b.rotation.z = 0.3 * (i - 1.5); g.add(b); }
  if (leafy) g.add(cone(leafy, r * 3, r * 6, len / 2 + r * 1.5, 0, 0, { flat: 1 })).children[g.children.length - 1].rotation.z = -Math.PI / 2;
  return g;
}
function jitter(geo, seed, side, topCol, rockCol) {
  const p = geo.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color(), h = (x, y, z, k) => { const v = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + k * 4.17 + seed * 9.1) * 43758.5453; return v - Math.floor(v); };
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), top = y > 0.49, q = top ? 0.03 : side, bulge = top ? 1 : 1 + Math.sin((y + 0.5) * 2.6 + seed) * 0.05;
    p.setXYZ(i, x * bulge * (1 + (h(x, y, z, 1) - 0.5) * q * 2), top ? y : y + (h(x, y, z, 3) - 0.5) * 0.02, z * bulge * (1 + (h(x, y, z, 2) - 0.5) * q * 2));
    c.set(y > 0.42 ? topCol : rockCol).multiplyScalar(0.82 + h(x, y, z, 5) * 0.3); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals(); return geo;
}
// Craggy stand-ins for a unit box and a unit pillar: flat mossy (or snowy) tops, rough rock sides.
export function rockGeos(topCol, rockCol) {
  const boxes = [], spires = [];
  for (let k = 0; k < 4; k++) { boxes.push(jitter(new THREE.BoxGeometry(1, 1, 1, 5, 6, 5), k + 1, 0.07, topCol, rockCol)); spires.push(jitter(new THREE.CylinderGeometry(1.04, 1.3 + k * 0.08, 1, 9, 5), k + 11, 0.1, topCol, rockCol)); }
  return { boxes, spires };
}
export function grappleRing() { const g = new THREE.Group(); const r = part(torG, 0x54d6ff, 0.55, 0.55, 0.55, 0, 0, 0, { e: 0x1a7fb0 }); g.add(r, ball(0xffffff, 0.16, 0, 0, 0, { e: 0x9adfff })); return g; }
export function mushroom() { const g = new THREE.Group(); g.add(cyl(0xf0e6cf, 0.45, 0.7, 0, 0.35, 0)); const c = ball(0xd8362c, 1.3, 0, 0.7, 0); c.scale.y = 0.55; g.add(c); for (let i = 0; i < 6; i++) g.add(ball(0xffffff, 0.16, Math.cos(i * 1.05) * 0.8, 1.12, Math.sin(i * 1.05) * 0.8)); return g; }
export function gong() { const g = new THREE.Group(); g.add(cyl(0x6b4a2a, 0.12, 3.4, -1.1, 1.7, 0), cyl(0x6b4a2a, 0.12, 3.4, 1.1, 1.7, 0), box(0x6b4a2a, 2.6, 0.2, 0.2, 0, 3.4, 0)); const d = cyl(0xe2b33a, 0.9, 0.1, 0, 2.1, 0, { e: 0x4a3500 }); d.rotation.x = 1.57; g.add(d); g.userData.disc = d; return g; }
export function cage() { const g = new THREE.Group(); g.add(cyl(0x4a4a52, 1.3, 0.14, 0, 0, 0), cyl(0x4a4a52, 1.3, 0.14, 0, 2.6, 0), cyl(0x4a4a52, 0.05, 6, 0, 5.6, 0)); for (let i = 0; i < 10; i++) g.add(cyl(0x4a4a52, 0.05, 2.6, Math.cos(i * 0.628) * 1.2, 1.3, Math.sin(i * 0.628) * 1.2)); return g; }
export function totem() { const g = new THREE.Group(); g.add(box(0x6b4a2a, 0.8, 2.2, 0.8, 0, 1.1, 0), box(0xb5332a, 0.84, 0.3, 0.84, 0, 1.9, 0), box(0x1a1410, 0.3, 0.3, 0.1, 0, 1.3, -0.4), box(0xffd23a, 0.14, 0.14, 0.05, -0.2, 1.72, -0.41, { e: 0x664400 }), box(0xffd23a, 0.14, 0.14, 0.05, 0.2, 1.72, -0.41, { e: 0x664400 })); return g; }
export function stall() { const g = new THREE.Group(); g.add(box(0x7a4a22, 2.6, 1, 1, 0, 0.5, 0), cyl(0x6b4a2a, 0.07, 2.6, -1.2, 1.3, 0.4), cyl(0x6b4a2a, 0.07, 2.6, 1.2, 1.3, 0.4), box(0xb5332a, 3, 0.12, 1.8, 0, 2.6, 0), box(0xe2b33a, 0.3, 0.3, 0.3, -0.7, 1.15, 0), box(0x54d6ff, 0.25, 0.4, 0.25, 0.1, 1.2, 0), box(0xd8362c, 0.4, 0.2, 0.3, 0.8, 1.1, 0)); return g; }
export function hut(c = 0xb5652a) { const g = new THREE.Group(); g.add(box(0xe6d8b8, 5, 3, 4.4, 0, 1.5, 0), box(0x4a3020, 1, 1.9, 0.1, 0, 0.95, -2.22), box(0x8fd0f0, 0.8, 0.8, 0.1, 1.5, 1.8, -2.22)); const r = new THREE.Mesh(new THREE.ConeGeometry(4.3, 2.4, 4), mat(c, { flat: 1 })); r.position.y = 4.2; r.rotation.y = 0.785; r.castShadow = true; g.add(r); return g; }
export function glider() { const g = new THREE.Group(); const w = new THREE.Mesh(new THREE.ConeGeometry(1.9, 0.5, 3), mat(0xf0e6cf, { flat: 1 })); w.scale.z = 0.7; w.position.y = 2.25; g.add(w, box(0xb5332a, 0.2, 0.06, 1.2, 0, 2.2, 0.1), cyl(0x6b4a2a, 0.03, 0.5, -0.3, 1.95, 0), cyl(0x6b4a2a, 0.03, 0.5, 0.3, 1.95, 0)); return g; }
// First-person hands: whip in the right, hook or hand cannon in the left.
export function viewHands() {
  const g = new THREE.Group();
  const r = grp(box(0xf0e6cf, 0.09, 0.09, 0.4, 0, 0, 0.1), box(0xe9b98c, 0.08, 0.08, 0.12, 0, 0, -0.14), cyl(0x4a2c16, 0.025, 0.2, 0, 0.02, -0.2)); r.position.set(0.32, -0.3, -0.55); r.rotation.set(0.2, -0.25, 0); r.children[2].rotation.x = 1.2;
  const coil = part(torG, 0x4a2c16, 0.07, 0.07, 0.07, 0, -0.08, -0.2); r.add(coil);
  const l = grp(box(0xf0e6cf, 0.09, 0.09, 0.4, 0, 0, 0.1), box(0xe9b98c, 0.08, 0.08, 0.12, 0, 0, -0.14)); l.position.set(-0.32, -0.3, -0.55); l.rotation.set(0.2, 0.25, 0);
  const hook = grp(cyl(0x8a8a92, 0.02, 0.2, 0, 0.02, -0.26), cone(0xc8c8d0, 0.04, 0.1, 0, 0.02, -0.38)); hook.children[0].rotation.x = 1.57; hook.children[1].rotation.x = -1.57;
  const cannon = grp(cyl(0x3a3a44, 0.06, 0.34, 0, 0.03, -0.3), cyl(0xe2b33a, 0.068, 0.04, 0, 0.03, -0.44), cone(0xc8c8d0, 0.04, 0.12, 0, 0.03, -0.52)); cannon.children[0].rotation.x = 1.57; cannon.children[1].rotation.x = 1.57; cannon.children[2].rotation.x = -1.57;
  l.add(hook, cannon); g.add(r, l); g.scale.setScalar(0.62); g.position.set(0, -0.06, -0.12); g.userData = { r, l, hook, cannon }; g.traverse(m => { m.castShadow = false; });
  return g;
}
export function boulderMesh(r, c = 0x8a8378) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat(c, { flat: 1 })); m.castShadow = true; return m; }
