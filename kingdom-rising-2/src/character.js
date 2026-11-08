// Procedural characters: smooth humanoids with race features, class outfits, weapons, and a procedural animator.
import { NEW_CLASSES } from './classes2.js';
import * as THREE from 'three';
import { RACES, CLASSES, WEAPON_TYPES, TIERS, RARITY, isElf } from './data.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { heroHead, heroHand, deltoids, veins, stitching, addDangle, addJiggle, tickSecondary, styleUndo, styleApply } from './herodetail.js';
export { addDangle, addJiggle } from './herodetail.js';

const V2 = (x, y) => new THREE.Vector2(x, y);
const geoCache = new Map();
function cached(key, fn) { let g = geoCache.get(key); if (!g) { g = fn(); geoCache.set(key, g); } return g; }

export function limbGeo(r1, r2, len, seg = 12) {
  return cached(`limb${r1.toFixed(3)}_${r2.toFixed(3)}_${len.toFixed(3)}_${seg}`, () => {
    const pts = [], n = 5;
    for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (i / n) * Math.PI / 2; pts.push(V2(Math.max(0.0001, Math.cos(a) * r2), -len + Math.sin(a) * r2)); }
    for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI / 2; pts.push(V2(Math.max(0.0001, Math.cos(a) * r1), Math.sin(a) * r1)); }
    pts[0].x = 0; pts[pts.length - 1].x = 0;
    return new THREE.LatheGeometry(pts, seg);
  });
}
// a sculpted limb: a radius profile down its length ([t 0..1, radius]) with rounded ends (shoulder caps, knuckles of the
// joints), so arms and legs have deltoids, biceps, forearm muscle, thighs and calves instead of being plain tubes
export function shapeLimb(key, prof, len, seg = 14) {
  return cached('shp' + key + len.toFixed(3), () => { const pts = [], r0 = prof[0][1], r1 = prof[prof.length - 1][1], n = 4;
    for (let i = n; i >= 1; i--) { const a = (i / n) * Math.PI / 2; pts.push(V2(Math.max(0.0001, Math.cos(a) * r1), -len - Math.sin(a) * r1 * 0.6)); }
    for (let i = prof.length - 1; i >= 0; i--) pts.push(V2(prof[i][1], -prof[i][0] * len));
    for (let i = 1; i <= n; i++) { const a = (i / n) * Math.PI / 2; pts.push(V2(Math.max(0.0001, Math.cos(a) * r0), Math.sin(a) * r0 * 0.7)); }
    pts[0].x = 0.0001; pts[pts.length - 1].x = 0.0001; return new THREE.LatheGeometry(pts, seg); });
}
// body types for the arena heroes: each class its own build and size, like the heroes of Smite or Marvel Rivals
export const BODY = {
  brute: { sw: 1.38, thick: 1.42, armL: 1.08, legL: 1.0, torsoH: 1.12, head: 0.8, mus: 1.5, h: 1.09 },
  knight: { sw: 1.26, thick: 1.22, armL: 1.04, legL: 1.04, torsoH: 1.06, head: 0.82, mus: 1.2, h: 1.05 },
  heavy: { sw: 1.28, thick: 1.34, armL: 1.02, legL: 0.9, torsoH: 1.04, head: 0.86, mus: 1.15, h: 0.98 },
  athlete: { sw: 1.12, thick: 1.0, armL: 1.03, legL: 1.08, torsoH: 1.02, head: 0.84, mus: 1.08, h: 1.02 },
  lean: { sw: 1.02, thick: 0.9, armL: 1.04, legL: 1.1, torsoH: 1.06, head: 0.84, mus: 0.9, h: 1.05 },
  sturdy: { sw: 1.12, thick: 1.08, armL: 1.02, legL: 1.02, torsoH: 1.04, head: 0.85, mus: 1.05, h: 1.0 },
};
function latheGeo(key, prof, seg = 18) { return cached(key, () => new THREE.LatheGeometry(prof.map(p => V2(Math.max(0.0001, p[0]), p[1])), seg)); }
const sphereGeo = (r, w = 16, h = 12) => cached(`sph${r}_${w}_${h}`, () => new THREE.SphereGeometry(r, w, h));
function mat(col, rough = 0.75, metal = 0, extra = {}) { return new THREE.MeshStandardMaterial(Object.assign({ color: col, roughness: rough, metalness: metal }, extra)); }
function mesh(g, m, parent, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = false; if (parent) parent.add(o); return o; }
function pivot(parent, x = 0, y = 0, z = 0, name) { const o = new THREE.Object3D(); o.position.set(x, y, z); if (name) o.name = name; parent.add(o); return o; }

// ---------- Outfits ----------
// palette & features for classes and NPCs
function outfitSpec(app) {
  if (app.spec) return app.spec;
  { const nc = NEW_CLASSES[app.outfit || app.cls]; if (nc) return outfitSpec(Object.assign({}, app, { outfit: nc.outfit, cls: app.cls || app.outfit })); }
  const c = app.cls ? CLASSES[app.cls].colors : null;
  switch (app.outfit || app.cls) {
    case 'berserker': return { shirt: '#8a5a3a', vest: '#5a3a22', pants: '#3a2a1e', boots: '#3a2416', belt: '#2a1a10', bracers: '#5a3a22', bareArms: true, shawl: '#8a7a6a', sash: c.main };
    case 'warrior': return { shirt: '#5b5f66', mail: c.metal, tabard: c.main, trim: c.trim, pants: '#3a2f28', boots: '#2b211a', pauldrons: true, belt: '#3a2a1a', bracers: c.metal };
    case 'ranger': return { shirt: '#5a3f26', vest: '#6b4a2a', pants: '#3c4a2a', boots: '#4a3220', hood: c.main, cloak: c.main, quiver: true, belt: '#3a2a1a', bracers: '#5a3a22' };
    case 'shaman': return { shirt: '#5a3a22', vest: c.main, trim: c.trim, pants: '#3a2a1e', boots: '#4a3220', belt: '#6b4a2a', shawl: '#7a5a3a', sash: c.trim, bracers: '#5a3a22', hood: null };
    case 'musketeer': return { shirt: '#e8e0c8', vest: c.main, trim: c.trim, pants: '#2a2a34', boots: '#1e1a16', hat: 'cap', hatCol: '#1a1a20', belt: '#3a2a1a', cloak: c.main, bracers: '#3a2a1a' };
    case 'wizard': return { shirt: c.main, robe: c.main, trim: c.trim, pants: '#2a2a40', boots: '#3a2a1a', hat: 'pointy', hatCol: c.main, sash: c.trim, sleeves: true };
    case 'elder': return { shirt: '#6b5a48', robe: '#5a4a3a', trim: '#b49a5a', pants: '#3a3028', boots: '#3a2a1a', shawl: '#8a6a4a', sash: '#8a6a4a' };
    case 'worker': return { shirt: '#9a7a5a', pants: '#4a4038', boots: '#3a2a1a', belt: '#3a2a1a', apron: null };
    case 'smith': return { shirt: '#6a5040', pants: '#3a3028', boots: '#2a2018', apron: '#4a3020', belt: '#2a1a10', bareArms: true };
    case 'weaver': return { shirt: '#b07a8a', robe: '#8a5a6a', trim: '#e0c890', pants: '#3a3028', boots: '#4a3020', sash: '#e0c890' };
    case 'hunter': return { shirt: '#4a3a28', vest: '#6a5034', pants: '#3c4030', boots: '#4a3220', hood: '#4a5a34', cloak: '#4a5a34', quiver: true, belt: '#3a2a1a' };
    case 'fisher': return { shirt: '#4a6a8a', pants: '#5a5040', boots: '#2a2a2a', hat: 'straw', hatCol: '#d8c27a', belt: '#3a2a1a' };
    case 'merchant': return { shirt: '#8a2a3a', vest: '#c9a048', pants: '#2a2a3a', boots: '#2a1a10', hat: 'cap', hatCol: '#5a2a3a', belt: '#3a2a1a' };
    case 'goblin': return { shirt: '#5a4a32', vest: '#4a3a24', pants: '#3a2e20', boots: null, belt: '#2a1e12', bracers: '#4a3a24', torn: true };
    case 'bandit': return { shirt: '#3a3028', vest: '#4a3a2a', pants: '#2a2622', boots: '#1e1a16', hood: '#2a2420', mask: '#7a1e1e', belt: '#1a1410', bracers: '#3a2a1a' };
    case 'rags': default: return { shirt: '#b8a888', pants: '#6a5a48', boots: null, belt: '#4a3a2a', torn: true };
  }
}

// ---------- Weapons ----------
const metalMats = new Map();
function metalMat(tier, rarity = 0) {
  const key = tier + '_' + rarity;
  if (!metalMats.has(key)) {
    const col = new THREE.Color(TIERS[tier].col);
    const em = rarity >= 3 ? new THREE.Color(RARITY[rarity].col).multiplyScalar(0.25) : new THREE.Color(0);
    metalMats.set(key, mat(col, tier === 0 ? 0.8 : 0.32, tier === 0 ? 0.3 : 0.9, { emissive: em }));
  }
  return metalMats.get(key);
}
const woodMat = mat('#6b4a2c', 0.8), darkWood = mat('#3e2a1a', 0.85), leatherMat = mat('#3a2616', 0.9), goldMat = mat('#d8b04a', 0.35, 0.9);
function bladeGeo(len, w, th, tip = 0.25) {
  return cached(`blade${len}_${w}_${th}`, () => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0); s.lineTo(-w / 2, len * (1 - tip)); s.lineTo(0, len); s.lineTo(w / 2, len * (1 - tip)); s.lineTo(w / 2, 0); s.lineTo(-w / 2, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: th, bevelEnabled: true, bevelThickness: th * 0.4, bevelSize: w * 0.18, bevelSegments: 1 });
    g.translate(0, 0, -th / 2); g.computeVertexNormals(); return g;
  });
}
function axeHeadGeo(size) {
  return cached('axe' + size, () => {
    const s = new THREE.Shape();
    s.moveTo(0, -0.05 * size); s.lineTo(0.08 * size, -0.07 * size);
    s.quadraticCurveTo(0.22 * size, -0.2 * size, 0.28 * size, -0.22 * size);
    s.quadraticCurveTo(0.34 * size, 0, 0.28 * size, 0.22 * size);
    s.quadraticCurveTo(0.22 * size, 0.2 * size, 0.08 * size, 0.07 * size); s.lineTo(0, 0.05 * size); s.lineTo(0, -0.05 * size);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.03 * size, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1 });
    g.translate(0, 0, -0.015 * size); return g;
  });
}
// the detailed musket model (models/musket.glb: muzzle toward -x, butt +x, sights +y), loaded once and re-laid into the
// weapon frame used here: the wrist of the stock at the origin, the barrel up +y (muzzle at y 1.11, butt plate at y -0.4), sights +z, lock +x
let _musketTpl = null, _musketP = null; const _musketWait = [];
export function loadMusket() { if (!_musketP) _musketP = import('three/addons/loaders/GLTFLoader.js').then(({ GLTFLoader }) => new Promise((res) => new GLTFLoader().load('models/musket.glb', (gl) => {
  let src = null; gl.scene.traverse(o => { if (o.isMesh && !src) src = o; }); if (!src) return res(null);
  const geo = src.geometry.clone(), s = 1.51 / 1.9; geo.translate(-0.45, -0.02, -0.027); /* (the wrist of the stock to the origin) */
  geo.applyMatrix4(new THREE.Matrix4().set(0, 0, -1, 0, -1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1)); geo.scale(s, s, s); geo.computeBoundingSphere(); geo.computeBoundingBox();
  const ca = geo.attributes.color; if (ca) { const n = ca.count, cf = new Float32Array(n * 3), c = new THREE.Color(); for (let i = 0; i < n; i++) { c.setRGB(ca.getX(i), ca.getY(i), ca.getZ(i), THREE.SRGBColorSpace); cf[i * 3] = c.r; cf[i * 3 + 1] = c.g; cf[i * 3 + 2] = c.b; } geo.setAttribute('color', new THREE.BufferAttribute(cf, 3)); } /* (the file's paint is sRGB: walnut, iron, brass) */
  const cf = geo.attributes.color, isWood = (v) => cf && cf.getX(v) > cf.getZ(v) * 3 && cf.getX(v) < 0.3; /* (walnut: red well over blue, and dark; brass is bright, iron is grey) */
  const ix = geo.index ? geo.index.array : null, wd = [], mt = []; if (ix) for (let i = 0; i < ix.length; i += 3) (isWood(ix[i]) ? wd : mt).push(ix[i], ix[i + 1], ix[i + 2]); /* (two parts: oiled walnut, and polished iron and brass) */
  const tpl = new THREE.Group(); tpl.name = 'musketGLB';
  for (const [idx, mm] of [[wd, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0 })], [mt, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.7 })]]) { if (ix && !idx.length) continue; const g2 = geo.clone(); if (ix) g2.setIndex(idx); g2.computeBoundingSphere(); const o = new THREE.Mesh(g2, mm); o.userData.keep = true; o.castShadow = true; tpl.add(o); if (!ix) break; }
  tpl.userData.keep = true; _musketTpl = tpl; res(tpl); for (const f of _musketWait.splice(0)) f(tpl);
}, undefined, () => res(null)))); return _musketP; }
// swap a weapon group's code-built meshes for the detailed musket (now if it is loaded, or as soon as it is)
export function musketize(g) { const put = (tpl) => { if (!tpl || g.userData.glb) return; const cs = g.children.filter(c => c.isMesh); const shadow = cs.length ? cs[0].castShadow : true, cull = cs.length ? cs[0].frustumCulled : true, lay = cs.length ? cs[0].layers.mask : 1; for (const c of cs) g.remove(c);
  const o = tpl.clone(); o.traverse(c => { if (c.isMesh) { c.castShadow = shadow; c.frustumCulled = cull; c.layers.mask = lay; } }); g.add(o); g.userData.glb = o; };
  if (_musketTpl) put(_musketTpl); else { _musketWait.push(put); loadMusket(); } return g; }
// the arena classes' detailed weapons (Meshy models in models/w/: textured, no skeleton, about 95 units tall), loaded once per file the first
// time a hero who carries it appears (never all at start) and re-laid into the frame of the code-built part they replace: grip at the origin,
// the business end up +y, about the code part's length, so every swing, block and cast pose still fits. f: [turn x, y, z, scale to metres, move x, y, z]
const PI = Math.PI, KIT = {
  warrior_sword: { f: [0, 0, PI, 0.012, 0, 0.338, 0], fpf: [0, PI / 2, 0, 1.3] }, /* (first person: the blade turned a quarter about its length, edge forward) */ /* (point-up: guard just above the fist at y 0.1, point at 0.91, like the code sword) */
  warrior_shield: { f: [0, 0, 0, 0.011, 0, -0.06, 0.03], fpf: [0, PI, 0, 1.35] }, /* (first person: lion face turned outward, away from you) */ /* (lion face +z, point down: 0.72 wide and 1.05 tall before the shield group's own 1.15) */
  darkknight_sword: { f: [0, 0, PI, 0.0196, 0, 0.527, 0] }, /* (guard at 0.2, point at 1.46: the code greatsword) */
  bers_axe: { f: [0, 0, 0, 0.016, 0, 0.57, 0] }, /* (the ram-skull heads at y 1.05 like the code great axe, edges out along x) */
  ranger_bow: { f: [0, -PI / 2, 0, 0.017, 0, 0, 0.094], cut: (g) => keepTris(g, (x, y) => !(x > 8.3 && Math.abs(y) < 38)), str: [0.646, 0.252] }, /* (riser at the origin, string toward +z; its own string is cut out so the code string, which draws, takes its place) */
  shaman_spear: { f: [0, 0, 0, 0.0244, 0, 0.76, 0], tip: 1.9 }, /* (butt at -0.4, feathered head at 1.6-1.92: the code spear) */
  shaman_doll: { f: [0, 0, 0, 0.0032, 0, 0.038, 0], tp: [0, 0, 0, -PI / 2, 0, 0], fp: [0.0, 0.02, -0.02, -0.25, 0.3, 0] }, /* (held round the belly, upright, face forward) */
  priest_scepter: { f: [0, 0, 0, 0.0116, 0, 0.674, 0], tip: 1.02 }, /* (fist on the shaft under the cross; the cross where the staff's orb was) */
  priest_censer: { f: [0, 0, 0, 0.0047, 0, -0.202, 0], tp: [0, 0, 0, -PI / 2, 0, 0], fp: [0, 0.0, 0.0, -0.5, 0, 0], dangle: true }, /* (hung from its ring in the fist) */
  cleric_hammer: { f: [0, 0, 0, 0.0095, 0, 0.2375, 0] }, /* (one-handed: the winged head at 0.5-0.69, a little over the code mace) */
  cleric_shield: { f: [0, 0, 0, 0.011, 0, -0.1, 0.03], fpf: [0, PI, 0] }, /* (first person: the cross face outward, toward the enemy) */ /* (cross face +z, point down, like the code kite) */
  druid_staff: { f: [0, 0, 0, 0.0195, 0, 0.526, 0], tip: 1.31 }, /* (foot at -0.4 like the code staff, the glowing seed at the top) */
  ench_staff: { f: [0, 0, 0, 0.0185, 0, 0.479, 0], tip: 1.3 },
  ele_orb: { f: [0, 0, 0, 0.0045, 0, 0.6575, 0], tip: 0.68, fpPos: [0, -0.133, 0] }, /* (no staff: the fire-and-ice orb held up by its crystal pendant, just above the fist) */
  necro_scythe: { f: [0, 0, 0, 0.019, 0, 0.285, 0], tp: [0, 0, 0, 0, PI / 2, 0], /* (third person: the blade toward his knuckles, forward when he stands with it upright) */ tpf: [0, 0, 0, 0, -0.245, 0, 0], /* (third person: the shaft, not the middle of the blade's sweep, runs through his fist) */ fp: [0, 0, 0, 0, 0, 0.05], fpPos: [-0.245, -0.3, 0] }, /* (first person: the blade faces left, the shaft runs through the fist high up, just under the blade) */ /* (a 1.8 m bone scythe, the fist a third of the way up the shaft) */
  rogue_dagger: { f: [0, 0, PI, 0.0055, 0, 0.157, 0] }, /* (guard at 0.09, point at 0.42: the code dagger) */
  bomb_grenade: { f: [0, 0, 0, 0.0036, 0, 0.072, 0] }, /* (gripped by the stick, the head up) */
  bomb_detonator: { f: [0, 0, 0, 0.0027, 0, 0.027, 0], belt: [0.2, 0.9, 0.04, 0, 0, 0] }, /* (the plunger box clipped to his belt on the left hip, button up) */
  bard_lute: { f: [0, 0, PI, 0.0084, 0, 0.235, 0] }, /* (held by the neck near the pegs, the bowl up +y, face +z: the code lute's frame) */
  beast_claw: { f: [PI + 0.637, 0, 0, 0.0038, -0.0076, -0.042, 0.025] }, /* (the code claws' frame: knuckles at the origin, the claws up +y, the fur cuff down the forearm) */
  wizard_book: { f: [PI / 2, 0, 0, 0.0032, 0, 0.1235, 0] }, /* (the code book's frame: lying open, pages up +y, spine at the origin) */
};
// which class carries what: main / off replace that code-built weapon (when it is the one named), L / R are new things held in that fist
const CLASS_KIT = { warrior: { main: ['sword', 'warrior_sword'], off: ['shield', 'warrior_shield'] }, darkknight: { main: ['greatsword', 'darkknight_sword'] }, berserker: { main: ['greataxe', 'bers_axe'] },
  ranger: { main: ['bow', 'ranger_bow'] }, shaman: { main: ['spear', 'shaman_spear'], L: 'shaman_doll' }, priest: { main: ['staff', 'priest_scepter'], L: 'priest_censer' }, cleric: { main: ['mace', 'cleric_hammer'], off: ['shield', 'cleric_shield'] },
  druid: { main: ['staff', 'druid_staff'] }, enchanter: { main: ['staff', 'ench_staff'] }, elementalist: { main: ['staff', 'ele_orb'] }, rogue: { main: ['dagger', 'rogue_dagger'], off: ['dagger', 'rogue_dagger'] },
  necromancer: { R: 'necro_scythe' }, bombardier: { belt: 'bomb_detonator' } }; /* (the wizard's book, the bombardier's grenade, the bard's lute and the beastmaster's claws replace code-built pieces in arenalooks.js / player.js) */
function keepTris(g, ok) { const p = g.attributes.position, n = p.count / 3, keep = []; for (let t = 0; t < n; t++) { let all = true; for (let j = 0; j < 3; j++) if (ok(p.getX(t * 3 + j), p.getY(t * 3 + j))) { all = false; break; } if (!all) keep.push(t); }
  for (const k in g.attributes) { const a = g.attributes[k], s = a.itemSize, out = new Float32Array(keep.length * 3 * s); keep.forEach((t, i) => out.set(a.array.subarray(t * 3 * s, t * 3 * s + 3 * s), i * 3 * s)); g.setAttribute(k, new THREE.BufferAttribute(out, s)); } }
const _kitTpl = {}, _kitP = {}, _kitWait = {}; let _fbxL = null;
export function loadKit(k) { if (!_kitP[k]) _kitP[k] = (_fbxL = _fbxL || import('three/addons/loaders/FBXLoader.js').then(({ FBXLoader }) => new FBXLoader())).then((L) => new Promise((res) => L.load('models/w/' + k + '.fbx', (fb) => {
  let src = null; fb.updateMatrixWorld(true); fb.traverse(o => { if (o.isMesh && !src) src = o; }); if (!src) return res(null); const K = KIT[k], f = K.f;
  let geo = src.geometry.clone(); if (geo.index) geo = geo.toNonIndexed(); geo.applyMatrix4(src.matrixWorld); /* (the file's node turns it upright and scales it x100) */ if (K.cut) K.cut(geo); geo.clearGroups();
  geo.rotateX(f[0]); geo.rotateY(f[1]); geo.rotateZ(f[2]); geo.scale(f[3], f[3], f[3]); geo.translate(f[4], f[5], f[6]);
  const na = geo.attributes.normal; if (na) { const a = na.array; for (let i = 0; i < a.length; i += 3) { const l = a[i] * a[i] + a[i + 1] * a[i + 1] + a[i + 2] * a[i + 2]; if (!(l > 1e-8)) { a[i] = 0; a[i + 1] = 1; a[i + 2] = 0; } else { const s = 1 / Math.sqrt(l); a[i] *= s; a[i + 1] *= s; a[i + 2] *= s; } } } /* (Meshy normals can be zero-length: the glow pass smears those into black) */
  geo.computeBoundingSphere(); geo.computeBoundingBox();
  const mt = Array.isArray(src.material) ? src.material[0] : src.material; if (mt.map) { mt.map.colorSpace = THREE.SRGBColorSpace; mt.map.anisotropy = 8; } if (mt.color) mt.color.set('#ffffff'); if (mt.specular) mt.specular.set('#2a2a2a'); mt.shininess = 24;
  const o = new THREE.Mesh(geo, mt); o.userData.keep = true; o.castShadow = true; const tpl = new THREE.Group(); tpl.name = k + 'Kit'; tpl.add(o); tpl.userData.keep = true; /* (keep: bake() leaves it whole, with its own texture) */
  _kitTpl[k] = tpl; res(tpl); for (const fn of (_kitWait[k] || []).splice(0)) fn(tpl);
}, undefined, () => res(null)))); return _kitP[k]; }
// swap a group's code-built meshes for the detailed model (now if it is loaded, or as soon as it is). o.fp: first person (the code parts hide at once, no shadows)
export function kitize(g, k, o = {}) { if (!g || !KIT[k]) return g; if (o.fp) for (const c of g.children) if (c.isMesh) c.visible = false;
  const put = (tpl) => { if (!tpl || g.userData.glb) return; const cs = g.children.filter(c => c.isMesh); const shadow = o.fp ? false : cs.length ? cs[0].castShadow : true, cull = o.fp ? false : cs.length ? cs[0].frustumCulled : true, lay = cs.length ? cs[0].layers.mask : 1; for (const c of cs) g.remove(c);
    const m = tpl.clone(), K = KIT[k]; m.traverse(c => { if (c.isMesh) { c.castShadow = shadow; c.frustumCulled = cull; c.layers.mask = lay; } }); if (o.fp && K.fpPos) m.position.fromArray(K.fpPos); if (o.fp && K.fpf) { m.rotation.set(K.fpf[0], K.fpf[1], K.fpf[2], 'YXZ'); if (K.fpf[3]) m.scale.multiplyScalar(K.fpf[3]); } /* (fpf: a first-person-only turn of the kit model) */ if (!o.fp && K.tpf) { const T = K.tpf; m.rotation.set(T[0], T[1], T[2], 'YXZ'); if (T[3]) m.scale.setScalar(T[3]); if (T.length > 4) m.position.set(T[4], T[5], T[6]); } /* (third person only: turn, size, move in the hand) */ g.add(m); g.userData.glb = m;
    if (K.tip != null && g.userData.tip) g.userData.tip.position.set(0, K.tip, 0);
    if (K.str && g.userData.string) { const [h, z] = K.str, a = g.userData.string.geometry.attributes.position; a.setXYZ(0, 0, -h, z); a.setXYZ(1, 0, 0, z); a.setXYZ(2, 0, h, z); a.needsUpdate = true; g.userData.string.geometry.computeBoundingSphere(); g.userData.stringZ = z; } };
  if (_kitTpl[k]) put(_kitTpl[k]); else { (_kitWait[k] = _kitWait[k] || []).push(put); loadKit(k); } return g; }
// a new thing held in a fist (no code-built part to replace): a holder in the grip's frame (third person) or the view-model hand's (first person)
function kitHolder(k, fp) { const K = KIT[k], P = fp ? K.fp : K.tp; if (!P) return null; const h = new THREE.Group(); h.name = 'kit_' + k; h.position.set(P[0], P[1], P[2]); h.rotation.set(P[3], P[4], P[5]); kitize(h, k, { fp }); return h; }
// third person: the class's detailed weapons replace the code-built ones in its hands (called from arenaWeaponDecor)
export function classKit(ch, cls) { const C = CLASS_KIT[cls], W = ch.weapons || {}; if (!C || !ch.arms) return;
  for (const s of ['main', 'off']) if (C[s] && W[s] && W[s].name === 'weapon_' + C[s][0]) kitize(W[s], C[s][1]);
  for (const sd of ['L', 'R']) if (C[sd] && ch.arms[sd] && ch.arms[sd].grip) { const h = kitHolder(C[sd]); if (!h) continue; ch.arms[sd].grip.add(h); if (KIT[C[sd]].dangle) { h.rotation.set(0, 0, 0); h.userData.sw = { ax: 0, az: 0, vx: 0, vz: 0, lp: null }; if (!ch.dangle) ch.dangle = h; } }
  if (C.belt) beltKit(ch, C.belt); }
// worn on the belt: rides the hero model's hips once it has loaded (the built body's are hidden), else the root at hip height
function beltKit(ch, k) { const B = KIT[k].belt, h = new THREE.Group(); h.name = 'kit_' + k; kitize(h, k); let n = 0;
  const go = () => { if (!ch.root) return; const hm = ch.heroModel; if (hm === 'loading' && ++n < 600) { setTimeout(go, 100); return; } let s = ch.scale || 1; if (hm && hm.m && ch.height > 0) s *= new THREE.Box3().setFromObject(hm.m).getSize(new THREE.Vector3()).y / ch.height; /* (sized to the model like the hand items) */ h.position.set(B[0] * s, B[1] * s, B[2] * s); h.rotation.set(B[3], B[4], B[5]); h.scale.setScalar(s); ch.root.add(h);
    const hip = hm && hm.bones && hm.bones.Hips; if (hip) { ch.root.updateMatrixWorld(true); hip.attach(h); } };
  go(); }
// first person: the same models in the view model's hands, the code-built stand-ins never shown (the necromancer keeps his own first-person look)
export function classKitFP(vm) { const C = CLASS_KIT[vm.cls], W = vm.weapons || {}; if (!C) return;
  for (const s of ['main', 'off']) if (C[s] && W[s] && W[s].name === 'weapon_' + C[s][0]) kitize(W[s], C[s][1], { fp: true });
  if (C.main && C.main[0] === 'bow' && W.bow && W.bow.name === 'weapon_bow') kitize(W.bow, C.main[1], { fp: true });
  if (C.L) { const h = kitHolder(C.L, true); if (h) { vm.L.add(h); W.held = h; if (!vm.book || /^kit_/.test(vm.book.name)) vm.book = h; } }
  if (C.R) { const h = kitHolder(C.R, true); if (h) { vm.R.add(h); W.heldR = h; } } } /* (a new thing in the right fist: the necromancer's scythe) */
// Weapons are built with the grip at the origin and the business end pointing +Y.
// userData.tip / userData.base mark the edge for trails.
export function makeWeapon(part, tier = 0, rarity = 0, element) {
  const g = new THREE.Group(); g.name = 'weapon_' + part;
  const M = metalMat(tier, rarity);
  const tip = new THREE.Object3D(), base = new THREE.Object3D();
  const cyl = (r1, r2, h, m, y, seg = 8) => mesh(cached(`cyl${r1}_${r2}_${h}_${seg}`, () => new THREE.CylinderGeometry(r1, r2, h, seg)), m, g, 0, y, 0);
  switch (part) {
    case 'musket': {
      // wooden stock below the grip, a long iron barrel up the +y axis, brass bands and a flintlock
      const stock = mesh(cached('mstock', () => new THREE.BoxGeometry(0.055, 0.42, 0.09)), woodMat, g, 0, -0.16, 0.012); stock.rotation.x = 0.08;
      mesh(cached('mbutt', () => new THREE.BoxGeometry(0.06, 0.1, 0.13)), darkWood, g, 0, -0.39, 0.03);
      mesh(cached('mfore', () => new THREE.BoxGeometry(0.045, 0.62, 0.05)), woodMat, g, 0, 0.36, 0.0);
      cyl(0.017, 0.019, 1.0, M, 0.55, 10);
      for (const y of [0.18, 0.5, 0.82]) mesh(cached('mband', () => new THREE.CylinderGeometry(0.026, 0.026, 0.025, 10)), goldMat, g, 0, y, 0);
      mesh(cached('mlock', () => new THREE.BoxGeometry(0.03, 0.08, 0.05)), M, g, 0.035, 0.08, 0);
      mesh(cached('mhammer', () => new THREE.BoxGeometry(0.015, 0.05, 0.02)), M, g, 0.04, 0.13, -0.02);
      // iron sights on top of the barrel: a brass bead at the muzzle and a notched rear sight
      mesh(cached('mfsight', () => new THREE.BoxGeometry(0.006, 0.014, 0.026)), goldMat, g, 0, 1.0, 0.026);
      for (const sx of [-0.009, 0.009]) mesh(cached('mrsight', () => new THREE.BoxGeometry(0.006, 0.012, 0.022)), M, g, sx, 0.22, 0.026);
      base.position.set(0, 0.6, 0); tip.position.set(0, 1.12, 0); musketize(g); break; /* (the code-built parts above stand in until the detailed model has loaded) */
    }
    case 'blunderbuss': {
      // a short, thick stock, a stubby brass-banded barrel and a wide flared bell at the muzzle
      const stock = mesh(cached('bstock', () => new THREE.BoxGeometry(0.06, 0.38, 0.1)), woodMat, g, 0, -0.14, 0.012); stock.rotation.x = 0.1;
      mesh(cached('bbutt', () => new THREE.BoxGeometry(0.07, 0.11, 0.14)), darkWood, g, 0, -0.36, 0.03);
      mesh(cached('bfore', () => new THREE.BoxGeometry(0.05, 0.4, 0.055)), woodMat, g, 0, 0.26, 0.0);
      cyl(0.024, 0.026, 0.66, M, 0.38, 10);
      mesh(cached('bbell', () => new THREE.CylinderGeometry(0.07, 0.026, 0.16, 12, 1, true)), goldMat, g, 0, 0.78, 0);
      for (const y of [0.14, 0.42]) mesh(cached('bband', () => new THREE.CylinderGeometry(0.032, 0.032, 0.03, 10)), goldMat, g, 0, y, 0);
      mesh(cached('mlock', () => new THREE.BoxGeometry(0.03, 0.08, 0.05)), M, g, 0.035, 0.08, 0);
      mesh(cached('mhammer', () => new THREE.BoxGeometry(0.015, 0.05, 0.02)), M, g, 0.04, 0.13, -0.02);
      mesh(cached('mfsight', () => new THREE.BoxGeometry(0.006, 0.014, 0.026)), goldMat, g, 0, 0.7, 0.03);
      base.position.set(0, 0.45, 0); tip.position.set(0, 0.86, 0); break;
    }
    case 'sword': {
      cyl(0.018, 0.02, 0.18, leatherMat, 0); mesh(sphereGeo(0.03, 8, 6), goldMat, g, 0, -0.1, 0);
      const gd = mesh(cached('guard', () => new THREE.BoxGeometry(0.2, 0.03, 0.04)), M, g, 0, 0.1, 0);
      mesh(bladeGeo(0.78, 0.055, 0.012), M, g, 0, 0.11, 0);
      base.position.set(0, 0.2, 0); tip.position.set(0, 0.88, 0); break;
    }
    case 'greatsword': {
      cyl(0.02, 0.022, 0.38, leatherMat, 0.0); mesh(sphereGeo(0.035, 8, 6), goldMat, g, 0, -0.2, 0);
      mesh(cached('gguard', () => new THREE.BoxGeometry(0.34, 0.04, 0.05)), M, g, 0, 0.2, 0);
      mesh(bladeGeo(1.25, 0.085, 0.016, 0.18), M, g, 0, 0.21, 0);
      base.position.set(0, 0.35, 0); tip.position.set(0, 1.45, 0); break;
    }
    case 'dagger': {
      cyl(0.016, 0.018, 0.11, leatherMat, 0); mesh(cached('dguard', () => new THREE.BoxGeometry(0.1, 0.02, 0.03)), M, g, 0, 0.065, 0);
      mesh(bladeGeo(0.3, 0.04, 0.01, 0.4), M, g, 0, 0.07, 0);
      base.position.set(0, 0.1, 0); tip.position.set(0, 0.37, 0); break;
    }
    case 'mace': {
      cyl(0.02, 0.022, 0.55, darkWood, 0.15); mesh(sphereGeo(0.075, 10, 8), M, g, 0, 0.47, 0);
      for (let i = 0; i < 6; i++) { const f = mesh(cached('flange', () => new THREE.BoxGeometry(0.02, 0.13, 0.07)), M, g, 0, 0.47, 0); f.rotation.y = i * Math.PI / 3; f.position.x = Math.cos(i * Math.PI / 3) * 0.06; f.position.z = -Math.sin(i * Math.PI / 3) * 0.06; }
      base.position.set(0, 0.35, 0); tip.position.set(0, 0.55, 0); break;
    }
    case 'warhammer': {
      cyl(0.024, 0.026, 1.25, darkWood, 0.35); const h = mesh(cached('hhead', () => new THREE.BoxGeometry(0.34, 0.17, 0.17)), M, g, 0, 1.0, 0);
      mesh(cached('hcap', () => new THREE.CylinderGeometry(0.1, 0.1, 0.04, 10)), M, g, 0.18, 1.0, 0).rotation.z = Math.PI / 2;
      mesh(cached('hcap', () => new THREE.CylinderGeometry(0.1, 0.1, 0.04, 10)), M, g, -0.18, 1.0, 0).rotation.z = Math.PI / 2;
      base.position.set(0, 0.8, 0); tip.position.set(0, 1.1, 0); break;
    }
    case 'fistwrap': { // cloth wrapped round the knuckles: the fist itself is the weapon
      const wrap = mat('#e8dcc0', 0.95); mesh(cached('fwrap', () => new THREE.BoxGeometry(0.095, 0.09, 0.1)), wrap, g, 0, 0.02, 0); mesh(cached('fwrap2', () => new THREE.CylinderGeometry(0.045, 0.045, 0.06, 8)), wrap, g, 0, -0.05, 0);
      base.position.set(0, -0.02, 0); tip.position.set(0, 0.1, 0); break; }
    case 'greataxe': case 'handaxe': {
      const big = part === 'greataxe';
      cyl(0.022, 0.024, big ? 1.3 : 0.55, darkWood, big ? 0.38 : 0.15);
      const hy = big ? 1.05 : 0.38, sz = big ? 1.15 : 0.75;
      const h1 = mesh(axeHeadGeo(sz), M, g, 0.02, hy, 0);
      if (big) { const h2 = mesh(axeHeadGeo(sz), M, g, -0.02, hy, 0); h2.rotation.y = Math.PI; }
      base.position.set(0.1 * sz, hy - 0.2 * sz, 0); tip.position.set(0.1 * sz, hy + 0.22 * sz, 0); break;
    }
    case 'spear': {
      cyl(0.02, 0.022, 2.0, woodMat, 0.6); mesh(bladeGeo(0.32, 0.07, 0.014, 0.5), M, g, 0, 1.6, 0);
      mesh(cached('ferrule', () => new THREE.CylinderGeometry(0.026, 0.026, 0.06, 8)), M, g, 0, 1.6, 0);
      base.position.set(0, 1.2, 0); tip.position.set(0, 1.92, 0); break;
    }
    case 'shield': {
      // shield styles: a warrior's heater (tiers 0-1), a tall kite (2-3) and a great tower shield (4-5);
      // the small round 'buckler' style is kept for lighter classes later (e.g. a druid)
      const style = arguments[4] || (tier >= 4 ? 'tower' : tier >= 2 ? 'kite' : 'heater');
      const faceCol = tier >= 4 ? '#24365e' : tier >= 2 ? '#2a4a2a' : '#7a2020';
      const geo = cached('shield_' + style, () => {
        const S2 = new THREE.Shape();
        if (style === 'buckler') { S2.absarc(0, 0, 0.26, 0, Math.PI * 2, false); }
        else if (style === 'heater') { S2.moveTo(-0.34, 0.36); S2.quadraticCurveTo(0, 0.42, 0.34, 0.36); S2.lineTo(0.34, 0.05); S2.quadraticCurveTo(0.3, -0.38, 0, -0.56); S2.quadraticCurveTo(-0.3, -0.38, -0.34, 0.05); S2.lineTo(-0.34, 0.36); }
        else if (style === 'kite') { S2.moveTo(-0.32, 0.42); S2.quadraticCurveTo(0, 0.52, 0.32, 0.42); S2.quadraticCurveTo(0.36, 0.1, 0.2, -0.3); S2.lineTo(0, -0.78); S2.lineTo(-0.2, -0.3); S2.quadraticCurveTo(-0.36, 0.1, -0.32, 0.42); }
        else { S2.moveTo(-0.36, 0.58); S2.quadraticCurveTo(0, 0.64, 0.36, 0.58); S2.lineTo(0.36, -0.5); S2.quadraticCurveTo(0, -0.82, -0.36, -0.5); S2.lineTo(-0.36, 0.58); }
        const g2 = new THREE.ExtrudeGeometry(S2, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.022, bevelSegments: 2, curveSegments: 14 });
        const pa = g2.attributes.position; for (let i = 0; i < pa.count; i++) { const x = pa.getX(i); pa.setZ(i, pa.getZ(i) - x * x * 0.55); } // curved like a real shield
        g2.computeVertexNormals(); return g2;
      });
      const face = mesh(geo, mat(faceCol, 0.7), g, 0, 0, 0);
      const rim = mesh(geo, M, g, 0, 0, -0.012); rim.scale.set(1.07, 1.05, 0.6); // metal rim showing round the edge
      mesh(cached('sboss', () => { const s = new THREE.SphereGeometry(0.08, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2); s.rotateX(Math.PI / 2); return s; }), M, g, 0, style === 'tower' ? 0.05 : 0.08, 0.05);
      if (style !== 'buckler') { mesh(cached('semb', () => new THREE.BoxGeometry(0.06, 0.62, 0.012)), goldMat, g, 0, style === 'kite' ? -0.05 : 0, 0.06); mesh(cached('semb2', () => new THREE.BoxGeometry(0.5, 0.06, 0.012)), goldMat, g, 0, 0.18, 0.06); }
      g.scale.setScalar(1.15); g.userData.isShield = true;
      base.position.set(0, -0.4, 0); tip.position.set(0, 0.4, 0); break;
    }
    case 'bow': {
      // recurve bow: thick riser, tapered limbs that bend toward the archer and flick forward at the tips
      const L = 0.78, zf = (t) => { const u = Math.abs(t), sm = Math.max(0, Math.min(1, (u - 0.7) / 0.3)); return 0.22 * t * t - 0.13 * sm * sm * (3 - 2 * sm); };
      const rf = (t) => { const u = Math.abs(t); return u < 0.16 ? 0.03 : 0.024 - (u - 0.16) * 0.017; };
      const geo = cached('recurve', () => {
        const parts = [], N = 26, up = new THREE.Vector3(0, 1, 0);
        for (let i = 0; i < N; i++) {
          const t0 = -1 + 2 * i / N, t1 = -1 + 2 * (i + 1) / N;
          const p0 = new THREE.Vector3(0, t0 * L, zf(t0)), p1 = new THREE.Vector3(0, t1 * L, zf(t1));
          const d = p1.clone().sub(p0), len = d.length();
          const c = new THREE.CylinderGeometry(rf(t1), rf(t0), len * 1.04, 8); c.scale(1.45, 1, 0.8);
          c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, d.normalize())); c.translate((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, (p0.z + p1.z) / 2);
          parts.push(c.toNonIndexed());
        }
        const m = mergeGeometries(parts); m.computeVertexNormals(); return m;
      });
      const limbM = mat(tier >= 3 ? '#2a1a12' : tier >= 1 ? '#5a3418' : '#7a5230', 0.55);
      mesh(geo, limbM, g);
      mesh(cached('bowgrip', () => new THREE.CylinderGeometry(0.034, 0.034, 0.16, 10)), leatherMat, g, 0, 0, 0);
      for (const y of [-0.085, 0.085]) { const w = mesh(cached('bowwrap', () => new THREE.TorusGeometry(0.035, 0.007, 5, 12)), goldMat, g, 0, y, 0); w.rotation.x = Math.PI / 2; }
      const horn = mat('#e8dcc0', 0.4);
      for (const sgn of [-1, 1]) { const tp = mesh(cached('bowtip', () => new THREE.ConeGeometry(0.014, 0.07, 6)), horn, g, 0, sgn * (L + 0.02), zf(1) - 0.01); if (sgn < 0) tp.rotation.x = Math.PI; }
      const zt = zf(1);
      const sg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -L, zt), new THREE.Vector3(0, 0, zt), new THREE.Vector3(0, L, zt)]);
      const str = new THREE.Line(sg, new THREE.LineBasicMaterial({ color: '#efe8d4' })); g.add(str); g.userData.string = str; g.userData.stringZ = zt;
      base.position.set(0, -0.6, 0.1); tip.position.set(0, 0.6, 0.1); break;
    }
    case 'quarterstaff': { // a plain hardwood staff with iron-shod ends
      cyl(0.026, 0.028, 1.75, darkWood, 0.35, 7);
      for (const y of [-0.5, 1.2]) mesh(cached('qsend', () => new THREE.CylinderGeometry(0.032, 0.032, 0.09, 8)), M, g, 0, y, 0);
      for (let i = 0; i < 2; i++) { const r = mesh(cached('wrap', () => new THREE.TorusGeometry(0.035, 0.01, 5, 10)), leatherMat, g, 0, 0.3 + i * 0.08, 0); r.rotation.x = Math.PI / 2; }
      base.position.set(0, 0.6, 0); tip.position.set(0, 1.2, 0); break;
    }
    case 'staff': {
      const col = { fire: '#ff6a1a', frost: '#7fe0ff', arcane: '#c070ff' }[element] || '#ffd060';
      cyl(0.024, 0.03, 1.7, darkWood, 0.45, 7);
      for (let i = 0; i < 3; i++) { const r = mesh(cached('wrap', () => new THREE.TorusGeometry(0.035, 0.01, 5, 10)), tier >= 2 ? goldMat : leatherMat, g, 0, 1.05 + i * 0.07, 0); r.rotation.x = Math.PI / 2; }
      // claw holding a glowing orb
      for (let i = 0; i < 4; i++) { const c = mesh(cached('claw', () => { const c = new THREE.ConeGeometry(0.018, 0.2, 5); c.translate(0, 0.1, 0); return c; }), darkWood, g, 0, 1.28, 0); c.rotation.z = 0.5; c.rotation.y = i * Math.PI / 2; const p = new THREE.Object3D(); }
      const orbM = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 2.2, roughness: 0.2, transparent: true, opacity: 0.92 });
      const orb = mesh(sphereGeo(0.075, 14, 10), orbM, g, 0, 1.42, 0); orb.castShadow = false; g.userData.orb = orb;
      base.position.set(0, 1.3, 0); tip.position.set(0, 1.5, 0); break;
    }
    case 'hatchet': {
      cyl(0.018, 0.02, 0.5, woodMat, 0.15); mesh(axeHeadGeo(0.7), metalMat(tier === 2 ? 1 : 0), g, 0.02, 0.36, 0);
      base.position.set(0, 0.3, 0); tip.position.set(0.15, 0.4, 0); break;
    }
    case 'pickaxe': {
      cyl(0.018, 0.02, 0.62, woodMat, 0.2);
      const pm = metalMat([0, 0, 1, 2, 4][tier] || 0);
      const head = mesh(cached('pick', () => { const c = new THREE.CylinderGeometry(0.012, 0.03, 0.55, 6); c.rotateZ(Math.PI / 2); return c; }), pm, g, 0, 0.48, 0);
      head.scale.set(1, 1, 1);
      base.position.set(0, 0.4, 0); tip.position.set(0.27, 0.48, 0); break;
    }
    case 'knife': {
      cyl(0.014, 0.016, 0.1, woodMat, 0); mesh(bladeGeo(0.18, 0.03, 0.008, 0.5), metalMat(2), g, 0, 0.05, 0);
      base.position.set(0, 0.08, 0); tip.position.set(0, 0.23, 0); break;
    }
  }
  g.add(tip); g.add(base); g.userData.tip = tip; g.userData.base = base;
  return g;
}

// ---------- Humanoid ----------
// app: { race, sex, cls, outfit, skin, hair, beardCol, hairStyle, beard, height(0.9..1.1), build(-1..1) }
// kind (for monsters): 'skeleton','troll','imp','golem','tyrant'
const ARENA_SIZE = { berserker: 1.756, paladin: 1.561, darkknight: 1.463, warrior: 1.341, cleric: 1.268, beastmaster: 1.22, shaman: 1.18, monk: 1.141, wizard: 1.102, necromancer: 1.073, elementalist: 1.044, druid: 1.015, ranger: 0.985, priest: 0.956, bard: 0.927, enchanter: 0.898, rogue: 0.859, blunderbuss: 2, musketeer: 1, bombardier: 1 }; /* (body, camera and reach follow the class's model size: berserker biggest, goblins smallest; goblins already get a small body from their race) */
export function buildHumanoid(app = {}) {
  const race = RACES[app.race || 'human'] || RACES.human;
  const kind = app.kind || 'person';
  const female = app.sex === 'f';
  const build = app.build || 0; // -1 thin .. 1 strong
  const R = { sw: 0.2, hw: 0.1, legL: 0.9, armL: 0.58, thick: 1, head: 1, torsoH: 0.57, neck: 0.07 };
  if (isElf(app.race)) { R.sw = 0.19; R.thick = 0.92; R.legL = 0.96; R.head = 0.96; }
  if (app.race === 'highelf') { R.sw = 0.185; R.thick = 0.88; R.legL = 0.98; R.neck = 0.09; }
  if (app.race === 'woodelf') { R.thick = 0.95; }
  if (app.race === 'dwarf') { R.sw = 0.26; R.hw = 0.13; R.thick = 1.35; R.legL = 0.62; R.armL = 0.5; R.head = 1.22; R.torsoH = 0.6; R.neck = 0.04; }
  if (app.race === 'orc') { R.sw = 0.25; R.hw = 0.12; R.thick = 1.25; R.head = 1.08; R.armL = 0.62; R.neck = 0.05; }
  if (app.race === 'barbarian') { R.sw = 0.25; R.hw = 0.12; R.thick = 1.22; R.armL = 0.6; R.neck = 0.06; }
  if (app.race === 'halfling') { R.sw = 0.2; R.thick = 1.02; R.legL = 0.72; R.armL = 0.56; R.head = 1.16; R.torsoH = 0.56; R.neck = 0.05; }
  if (app.race === 'gnome') { R.sw = 0.18; R.thick = 0.96; R.legL = 0.62; R.armL = 0.52; R.head = 1.32; R.torsoH = 0.52; R.neck = 0.04; }
  if (app.race === 'darkelf') { R.sw = 0.19; R.thick = 0.9; }
  if (app.race === 'goblin') { R.sw = 0.17; R.thick = 0.85; R.legL = 0.62; R.armL = 0.6; R.head = 1.35; R.torsoH = 0.52; R.neck = 0.04; }
  if (female) { R.sw *= 0.88; R.hw *= 1.12; R.thick *= 0.88; }
  R.sw *= 1 + build * 0.13; R.thick *= 1 + build * 0.22;
  const hero = kind === 'person' && app.body && BODY[app.body], mus = hero ? hero.mus : 1; // (arena heroes: a sculpted body in their class's build)
  if (hero) { R.sw *= hero.sw; R.thick *= hero.thick; R.armL *= hero.armL; R.legL *= hero.legL; R.torsoH *= hero.torsoH; R.head *= hero.head; R.hw *= 1 + (hero.thick - 1) * 0.5; }
  if (kind === 'troll') { R.sw = 0.32; R.hw = 0.16; R.legL = 0.75; R.armL = 0.82; R.thick = 1.9; R.head = 1.15; R.torsoH = 0.62; }
  if (kind === 'skeleton') { R.thick = 0.45; }
  if (kind === 'imp') { R.thick = 0.8; R.head = 1.35; R.legL = 0.7; }
  if (kind === 'golem') { R.sw = 0.36; R.hw = 0.16; R.legL = 0.7; R.armL = 0.75; R.thick = 2.4; R.head = 0.9; R.torsoH = 0.65; }
  if (kind === 'tyrant') { R.sw = 0.3; R.hw = 0.14; R.thick = 1.6; R.head = 1.05; R.armL = 0.66; }

  const root = new THREE.Group(); root.name = 'humanoid';
  const scale = (race.height || 1) * (app.height || 1) * (hero ? hero.h : 1) * (app.spec ? 1.953125 * (ARENA_SIZE[app.cls] || 1) : 1); // (the arena classes stand a quarter bigger, then a quarter again; each class its own size)
  const body = new THREE.Group(); body.scale.setScalar(scale); root.add(body);
  const O = kind === 'person' ? outfitSpec(app) : {};

  const skinM = mat(app.skin || race.skins[0], 0.62);
  if (kind === 'skeleton') { skinM.color.set('#e6dcc0'); skinM.roughness = 0.8; }
  if (kind === 'troll') skinM.color.set(app.skin || '#7c8a74');
  if (kind === 'imp') { skinM.color.set('#b8301a'); skinM.emissive = new THREE.Color('#300800'); }
  if (kind === 'golem') { skinM.color.set('#3a302a'); skinM.roughness = 0.95; skinM.flatShading = true; }
  if (kind === 'tyrant') { skinM.color.set('#4a1a12'); skinM.emissive = new THREE.Color('#200400'); }
  const hairM = mat(app.hair || '#3a2a1a', 0.85);
  const beardM = app.beardCol ? mat(app.beardCol, 0.85) : hairM;
  const shirtM = mat(O.shirt || '#888', 0.85), pantsM = mat(O.pants || '#444', 0.9), bootM = mat(O.boots || '#2a2018', 0.8);
  const mats = { skin: skinM, hair: hairM, shirt: shirtM, pants: pantsM, boots: bootM };
  const glowM = new THREE.MeshStandardMaterial({ color: '#ffaa30', emissive: '#ff6a10', emissiveIntensity: 2.5 });

  const T = R.thick;
  const hipH = R.legL + 0.06;
  const hips = pivot(body, 0, hipH, 0, 'hips');
  const pelvis = mesh(latheGeo(`pelvis${R.hw}${T}${female}`, [[0.0, -0.06], [R.hw + 0.06 * T, -0.04], [R.hw + 0.065 * T, 0.04], [0.13 * T + 0.0, 0.14]]), kind === 'person' ? pantsM : skinM, hips);
  pelvis.scale.z = 0.72;
  const spine = pivot(hips, 0, 0.12, 0, 'spine');
  const chest = pivot(spine, 0, 0.08, 0, 'chest');
  const th = R.torsoH - 0.2;
  const sw = R.sw;
  const torsoProf = female
    ? [[0.125 * T, -0.08], [0.12 * T, 0.0], [0.11 * T, 0.06], [0.15 * T, 0.18], [sw * 0.92, th * 0.85], [sw * 0.8, th + 0.02], [0.06, th + 0.06]]
    : [[0.13 * T, -0.08], [0.13 * T, 0.02], [0.15 * T, 0.12], [sw * 0.92, th * 0.8], [sw, th * 0.95], [sw * 0.75, th + 0.04], [0.07, th + 0.07]];
  if (hero && !female) torsoProf.splice(0, torsoProf.length, [0.118 * T, -0.08], [0.12 * T, 0.02], [0.14 * T, 0.1], [sw * 0.9, th * 0.66], [sw * 1.04, th * 0.88], [sw * 0.86, th + 0.02], [0.075 * T, th + 0.075]); // a V: broad chest, narrow waist
  const torso = mesh(latheGeo(`torso${female}${T.toFixed(2)}${sw.toFixed(3)}${th.toFixed(2)}${hero ? 'h' : ''}`, torsoProf, 22), kind === 'person' ? shirtM : skinM, chest);
  if (hero) { if (!female) for (const s2 of [-1, 1]) { const pec = mesh(cached('pecbox', () => { const g = new THREE.BoxGeometry(0.15, 0.09, 0.05, 2, 2, 1); const p3 = g.attributes.position; for (let i = 0; i < p3.count; i++) { const x = p3.getX(i), y = p3.getY(i); p3.setZ(i, p3.getZ(i) - (x * x * 2.2 + y * y * 3)); } g.computeVertexNormals(); return g; }), shirtM, pivot(chest, s2 * sw * 0.4, th * 0.8, 0.095 * T, 'pec')); pec.scale.set(sw / 0.25, 1, Math.min(1.3, mus) * T); pec.rotation.z = s2 * -0.12; /* a flat, square chest plate, not a round bulge */ }
    const trap = mesh(latheGeo(`trap2${sw.toFixed(3)}${T.toFixed(2)}`, [[sw * 0.84, 0], [sw * 0.6, 0.045], [0.12 * T, 0.095], [0.085 * T, 0.13]], 16), shirtM, chest, 0, th - 0.045, -0.012); trap.scale.z = 0.66; // (the trapezius slopes up into the neck)
    const lat = mesh(sphereGeo(0.1 * T, 12, 8), shirtM, chest, 0, th * 0.55, -0.05 * T); lat.scale.set(sw / 0.1 * 0.8, 1.2, 0.55); }
  torso.scale.z = kind === 'troll' || kind === 'golem' ? 0.85 : 0.66;
  if (female && kind === 'person') { for (const s of [-1, 1]) { const b = mesh(sphereGeo(0.065 * T, 10, 8), shirtM, chest, s * 0.065 * T / 0.88, th * 0.62, 0.075 * T); b.scale.set(1, 0.9, 0.8); } }
  if (kind === 'skeleton') { torso.material = skinM; torso.scale.set(0.8, 1, 0.55); for (let i = 0; i < 4; i++) { const rib = mesh(cached('rib', () => new THREE.TorusGeometry(0.11, 0.012, 4, 12, Math.PI * 1.4)), skinM, chest, 0, 0.05 + i * 0.07, 0); rib.rotation.x = Math.PI / 2; rib.rotation.z = -Math.PI * 0.2; rib.scale.set(1, 0.7, 1); } torso.scale.set(0.35, 1, 0.35); }

  const neck = pivot(chest, 0, hero ? th - 0.005 : th + 0.04, 0, 'neck');
  if (hero) { const tk = Math.min(T, 1.5); mesh(limbGeo(0.07 * tk, 0.086 * tk, 0.13), skinM, neck, 0, 0.085, 0.004).scale.z = 0.92; } // (a short, strong neck that sits down into the shoulders, not a stalk)
  else mesh(limbGeo(0.045 * Math.min(T, 1.5), 0.05 * Math.min(T, 1.5), R.neck + 0.06), skinM, neck, 0, R.neck + 0.04, 0);
  const head = pivot(neck, 0, hero ? 0.048 : R.neck + 0.05, hero ? 0.008 : 0, 'head');
  const hs = R.head * (hero ? 1.07 : 1);
  const headG = new THREE.Group(); headG.scale.setScalar(hs); head.add(headG);
  buildHead(headG, app, kind, female, mats, glowM);

  // arms
  const arms = {}; const ch0 = { biceps: [] };
  for (const s of [-1, 1]) { // -1 = right (character's right is -x when facing +z)
    const side = s < 0 ? 'R' : 'L';
    const sh = pivot(chest, s * (sw - 0.02), th * 0.92, 0, 'shoulder' + side);
    const ua = R.armL * 0.52, fa = R.armL * 0.46;
    const uaM = (O.bareArms || kind !== 'person') ? skinM : shirtM;
    if (hero) { const m = mus; mesh(shapeLimb(`ua${T.toFixed(2)}${m}`, [[0, 0.07 * T], [0.12, 0.075 * T * (0.96 + 0.1 * m)], [0.45, 0.062 * T * (0.9 + 0.12 * m)], [0.82, 0.05 * T], [1, 0.047 * T]], ua), uaM, sh).scale.z = 0.92; } else
    mesh(limbGeo(0.066 * T, 0.054 * T, ua), uaM, sh);
    if (hero && mus > 1.05 && kind === 'person') { const bp = pivot(sh, 0, -ua * 0.45, 0.02 * T, 'bicep'); const bi = mesh(sphereGeo(0.05, 12, 8), uaM, bp); bi.scale.set(0.95 * T, 1.9, 0.9 * T * (0.7 + 0.25 * mus)); ch0.biceps.push(bp); }
    const el = pivot(sh, 0, -ua, 0, 'elbow' + side);
    { const faM = (O.sleeves || O.robe) && kind === 'person' && !O.bareArms ? shirtM : skinM; if (hero) mesh(shapeLimb(`fa${T.toFixed(2)}${mus}`, [[0, 0.05 * T], [0.22, 0.056 * T * (0.94 + 0.1 * mus)], [0.6, 0.044 * T], [1, 0.033 * T]], fa), faM, el).scale.z = 0.86; else mesh(limbGeo(0.054 * T, 0.042 * T, fa), faM, el); }
    const hand = pivot(el, 0, -fa, 0, 'hand' + side);
    if (hero) heroHand(hand, s, skinM, Math.min(1.35, 0.92 + T * 0.18), s < 0); // a real hand: palm, jointed fingers with nails, a thumb (the right one closed round the grip)
    else { const hm = mesh(sphereGeo(0.048, 10, 8), skinM, hand, 0, -0.045, 0.005); hm.scale.set(0.85 * Math.min(1.4, T), 1.25, 0.6 * Math.min(1.4, T)); }
    if (kind === 'troll' || kind === 'tyrant' || kind === 'imp') { for (let i = 0; i < 3; i++) { const cl = mesh(cached('claw2', () => new THREE.ConeGeometry(0.012, 0.06, 4)), mat('#2a2a20'), hand, (i - 1) * 0.02, -0.1, 0.02); cl.rotation.x = Math.PI; } }
    const grip = pivot(hand, 0, -0.06, 0.01, 'grip' + side);
    grip.rotation.x = Math.PI / 2; // weapon +Y points forward when arm hangs
    arms[side] = { sh, el, hand, grip };
    if (kind === 'skeleton') sh.children[0].scale.set(0.6, 1, 0.6);
  }
  // legs
  const legs = {};
  for (const s of [-1, 1]) {
    const side = s < 0 ? 'R' : 'L';
    const tl = R.legL * 0.5, sl = R.legL * 0.47;
    const thigh = pivot(hips, s * R.hw, 0, 0, 'thigh' + side);
    if (hero) mesh(shapeLimb(`th${T.toFixed(2)}${mus}`, [[0, 0.092 * T], [0.25, 0.094 * T * (0.97 + 0.05 * mus)], [0.7, 0.074 * T], [1, 0.06 * T]], tl), pantsM, thigh).scale.z = 0.9; else
    mesh(limbGeo(0.088 * T, 0.064 * T, tl), kind === 'person' ? pantsM : skinM, thigh);
    const knee = pivot(thigh, 0, -tl, 0, 'knee' + side);
    if (hero) { const cv = mesh(shapeLimb(`sh${T.toFixed(2)}${mus}`, [[0, 0.06 * T], [0.28, 0.066 * T * (0.95 + 0.1 * mus)], [0.7, 0.048 * T], [1, 0.04 * T]], sl), O.boots ? bootM : pantsM, knee); cv.scale.z = 0.92; } else
    mesh(limbGeo(0.064 * T, 0.048 * T, sl), kind === 'person' ? (O.boots ? bootM : skinM) : skinM, knee);
    const ankle = pivot(knee, 0, -sl, 0, 'ankle' + side);
    const foot = hero ? mesh(cached('hboot', () => new THREE.BoxGeometry(0.085, 0.06, 0.2)), O.boots ? bootM : skinM, ankle, 0, -0.03, 0.045) : mesh(sphereGeo(0.06, 10, 8), kind === 'person' ? (O.boots ? bootM : skinM) : skinM, ankle, 0, -0.025, 0.05);
    if (hero) { foot.scale.set(Math.min(T, 1.4), 1, 1); const toe = mesh(sphereGeo(0.044, 10, 8), O.boots ? bootM : skinM, ankle, 0, -0.035, 0.135); toe.scale.set(1.0 * Math.min(T, 1.4), 0.7, 1.0); const heel = mesh(cached('hheel', () => new THREE.BoxGeometry(0.075, 0.025, 0.06)), mat('#1a120c', 0.9), ankle, 0, -0.058, -0.03); heel.scale.x = Math.min(T, 1.4); }
    else foot.scale.set(0.85 * Math.min(T, 1.5), 0.55, 1.8);
    legs[side] = { thigh, knee, ankle };
    if (kind === 'skeleton') { thigh.children[0].scale.set(0.6, 1, 0.6); knee.children[0].scale.set(0.6, 1, 0.6); }
  }

  const ch = { root, body, hips, spine, chest, neck, head, headG, arms, legs, mats, R, scale, app, kind, height: (hipH + 0.2 + th + R.neck + 0.3 * hs) * scale, weapons: {}, anim: { t: Math.random() * 10, walk: 0, blend: 0 } };
  if (kind === 'person') dressOutfit(ch, O);
  if (hero && kind === 'person') { try {
    deltoids(ch, (O.bareArms) ? skinM : shirtM, mus);
    if (O.bareArms || mus >= 1.4) veins(ch, skinM, { mus });
    stitching(ch, O, mats);
    // cloth that hangs: the tabards swing from the belt, the cloak from the shoulders, a hair tail from the crown
    for (const k2 of ['tabard1', 'tabard-1']) { const tb = ch.outfit[k2]; if (!tb) continue; const pv = pivot(hips, tb.position.x, tb.position.y + 0.31, tb.position.z, 'tabardP'); hips.remove(tb); pv.add(tb); tb.position.set(0, -0.31, 0); ch.outfit[k2] = tb; addDangle(ch, pv, { hang: 0.55, drag: k2 === 'tabard1' ? 0.07 : 0.1, gain: 0.05, max: 0.9 }); }
    if (ch.outfit.cloak) { ch.outfit.cloak.rotation.x = 0.1; addDangle(ch, ch.outfit.cloak, { hang: 0.85, drag: 0.13, gain: 0.06, max: 1.25, k: 40, damp: 5 }); ch.cloakDangle = true; }
    if (headG.userData.hairTail) addDangle(ch, headG.userData.hairTail, { hang: 0.9, drag: 0.08, gain: 0.05, k: 50, damp: 5 });
    chest.traverse(o => { if (o.name === 'pec') addJiggle(ch, o, { amt: 0.0016 * mus }); }); for (const b of ch0.biceps) addJiggle(ch, b, { amt: 0.0012 * mus });
  } catch (e) { console.warn('hero detail', e); } }
  if (kind === 'troll') { const lc = mesh(latheGeo('loin', [[0.2, -0.2], [0.22, 0], [0.2, 0.08]]), mat('#5a4030'), hips); }
  if (kind === 'imp') { // wings + tail
    for (const s of [-1, 1]) { const w = mesh(cached('impwing', () => { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.5, 0.25); sh.lineTo(0.42, -0.05); sh.lineTo(0.3, -0.02); sh.lineTo(0.2, -0.12); sh.lineTo(0, -0.05); return new THREE.ShapeGeometry(sh); }), mat('#5a1208', 0.7, 0, { side: THREE.DoubleSide }), chest, s * 0.05, th * 0.8, -0.1); w.scale.x = s; w.rotation.y = s * 0.4; w.userData.keep = true; ch['wing' + (s < 0 ? 'R' : 'L')] = w; }
    const tail = mesh(limbGeo(0.025, 0.012, 0.5), skinM, hips, 0, 0, -0.08); tail.rotation.x = -2.2;
  }
  if (kind === 'golem' || kind === 'tyrant') {
    // glowing cracks / lava core
    const core = mesh(sphereGeo(0.09, 10, 8), glowM, chest, 0, th * 0.5, 0.12 * T); core.castShadow = false;
    if (kind === 'golem') { for (let i = 0; i < 7; i++) { const r = mesh(cached('golrock' + i, () => new THREE.DodecahedronGeometry(0.12 + Math.random() * 0.08, 0)), skinM, chest, (Math.random() - 0.5) * 0.5, Math.random() * th, (Math.random() - 0.3) * 0.25); } }
    if (kind === 'tyrant') { for (const s of [-1, 1]) { const p = mesh(cached('tyrpaul', () => new THREE.SphereGeometry(0.16, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2)), mat('#1a1a1a', 0.4, 0.8), arms[s < 0 ? 'R' : 'L'].sh, 0, 0.02, 0); for (let k = 0; k < 3; k++) { const sp = mesh(cached('spike', () => new THREE.ConeGeometry(0.03, 0.18, 5)), mat('#111', 0.4, 0.6), p, (k - 1) * 0.07, 0.14, 0); } } }
  }
  root.userData.char = ch;
  ch.details = []; root.traverse(o => { if (o.isMesh && o.userData.detail) ch.details.push(o); });
  ch.detailOn = true;
  return ch;
}
export function setDetail(ch, on) { if (ch.detailOn === on) return; ch.detailOn = on; const hm = ch.heroModel; for (const o of ch.details) o.visible = on && !(hm && o.userData.hmHide); } // (a 3D model replaced the built body: its hidden pieces stay hidden)

function buildHead(g, app, kind, female, mats, glowM) {
  const sk = mats.skin;
  const n0 = g.children.length;
  try { if (kind === 'person' && app.body && BODY[app.body]) heroHead(g, app, mats, female); else buildHead2(g, app, kind, female, mats, glowM); } finally { g.children.forEach((c, i) => { if (i >= n0 && c.isMesh && c.geometry.boundingSphere == null) c.geometry.computeBoundingSphere(); if (i >= n0 && c.isMesh && c.geometry.boundingSphere.radius < 0.045) { c.userData.detail = true; c.castShadow = false; } }); }
}
function buildHead2(g, app, kind, female, mats, glowM) {
  const sk = mats.skin;
  if (kind === 'skeleton') {
    const skull = mesh(sphereGeo(0.11, 14, 10), sk, g, 0, 0.1, 0); skull.scale.set(0.9, 1, 1);
    const jaw = mesh(cached('skjaw', () => new THREE.BoxGeometry(0.11, 0.05, 0.1)), sk, g, 0, 0.0, 0.03);
    const eyeM = new THREE.MeshBasicMaterial({ color: '#000' });
    for (const s of [-1, 1]) { mesh(sphereGeo(0.024, 8, 6), eyeM, g, s * 0.038, 0.1, 0.085); const e = mesh(sphereGeo(0.01, 6, 4), new THREE.MeshBasicMaterial({ color: '#60c0ff' }), g, s * 0.038, 0.1, 0.095); }
    return;
  }
  const headM = mesh(sphereGeo(0.11, 20, 16), sk, g, 0, 0.1, 0); headM.scale.set(0.9, 1.06, 1.0);
  const jaw = mesh(sphereGeo(0.085, 14, 10), sk, g, 0, 0.05, 0.022); jaw.scale.set(kind === 'troll' ? 1.25 : 0.95, 0.85, 0.95);
  // nose
  const gob = app.race === 'goblin';
  const noseLen = gob ? 0.075 : app.race === 'gnome' ? 0.065 : app.race === 'dwarf' ? 0.05 : kind === 'troll' ? 0.07 : 0.032;
  const nose = mesh(cached('nose' + noseLen, () => { const c = new THREE.ConeGeometry(app.race === 'dwarf' || app.race === 'gnome' || gob ? 0.022 : 0.016, noseLen, 8); c.rotateX(Math.PI / 2); return c; }), sk, g, 0, 0.085, 0.112);
  nose.rotation.x = gob ? 0.25 : -0.35;
  if (app.race === 'dwarf') { const tipn = mesh(sphereGeo(0.02, 8, 6), sk, g, 0, 0.075, 0.13); }
  // eyes
  const eyeWhite = kind === 'imp' || kind === 'tyrant' ? glowM : (kind === 'troll' || gob ? new THREE.MeshStandardMaterial({ color: '#f0e040', emissive: '#a08000', emissiveIntensity: 0.8 }) : mat('#f4f0e8', 0.3));
  const iris = mat(app.eye || (app.race === 'darkelf' ? '#d82a2a' : app.race === 'highelf' ? '#4a6aa8' : isElf(app.race) ? '#3a7a3a' : '#3a2a1a'), 0.3);
  for (const s of [-1, 1]) {
    const e = mesh(sphereGeo(0.017, 10, 8), eyeWhite, g, s * 0.037, 0.115, 0.088); e.scale.set(1.2, isElf(app.race) ? 0.75 : 0.9, 0.6);
    if (kind === 'person' && !gob) { const p = mesh(sphereGeo(0.009, 8, 6), iris, g, s * 0.037, 0.115, 0.098); }
    const brow = mesh(cached('brow', () => new THREE.BoxGeometry(0.04, 0.009, 0.012)), kind === 'person' ? mats.hair : sk, g, s * 0.038, 0.142, 0.094);
    brow.rotation.z = s * (app.race === 'orc' ? 0.3 : isElf(app.race) ? -0.25 : kind === 'troll' || kind === 'tyrant' ? 0.35 : -0.08);
  }
  // mouth
  const mouth = mesh(cached('mouth', () => new THREE.BoxGeometry(0.04, 0.006, 0.01)), mat('#7a3a32', 0.6), g, 0, 0.045, 0.1);
  // ears
  for (const s of [-1, 1]) {
    if (app.race === 'orc') {
      const ear = mesh(cached('orcear', () => { const c = new THREE.ConeGeometry(0.026, 0.09, 5); c.translate(0, 0.045, 0); c.scale(1, 1, 0.4); return c; }), sk, g, s * 0.097, 0.1, -0.005); ear.rotation.z = -s * 1.2;
    } else if (gob) {
      const ear = mesh(cached('gobear', () => { const c = new THREE.ConeGeometry(0.035, 0.2, 5); c.translate(0, 0.1, 0); c.scale(1, 1, 0.35); return c; }), sk, g, s * 0.095, 0.1, -0.01);
      ear.rotation.z = -s * 1.45; ear.rotation.x = -0.15;
    } else if (isElf(app.race)) {
      const hi = app.race === 'highelf';
      const ear = mesh(cached('elfear' + hi, () => { const c = new THREE.ConeGeometry(0.024, hi ? 0.17 : 0.13, 6); c.translate(0, hi ? 0.085 : 0.065, 0); c.scale(1, 1, 0.4); return c; }), sk, g, s * 0.095, 0.1, -0.005);
      ear.rotation.z = -s * (hi ? 0.85 : 1.05); ear.rotation.x = -0.35;
    } else if (app.race === 'halfling' || app.race === 'gnome') { // small, slightly pointed ears
      const ear = mesh(cached('smallear', () => { const c = new THREE.ConeGeometry(0.024, 0.075, 6); c.translate(0, 0.037, 0); c.scale(1, 1, 0.45); return c; }), sk, g, s * 0.096, 0.1, -0.004);
      ear.rotation.z = -s * 1.15; ear.rotation.x = -0.25;
    } else if (kind === 'imp' || kind === 'tyrant' || kind === 'troll') {
      const ear = mesh(cached('impear', () => { const c = new THREE.ConeGeometry(0.03, 0.12, 5); c.translate(0, 0.06, 0); c.scale(1, 1, 0.4); return c; }), sk, g, s * 0.095, 0.1, 0);
      ear.rotation.z = -s * 1.3;
    } else {
      const ear = mesh(sphereGeo(0.024, 8, 6), sk, g, s * 0.098, 0.1, 0); ear.scale.set(0.45, 1, 0.75);
    }
  }
  if (app.race === 'orc') { for (const s of [-1, 1]) { const tk = mesh(cached('orctusk', () => new THREE.ConeGeometry(0.014, 0.075, 5)), mat('#efe6c8', 0.5), g, s * 0.035, 0.045, 0.1); tk.rotation.z = s * 0.15; } }
  if (kind === 'troll') { for (const s of [-1, 1]) { const tk = mesh(cached('tusk', () => new THREE.ConeGeometry(0.012, 0.06, 5)), mat('#efe6c8', 0.5), g, s * 0.04, 0.04, 0.1); tk.rotation.z = s * 0.2; } }
  if (kind === 'imp' || kind === 'tyrant') {
    const big = kind === 'tyrant';
    for (const s of [-1, 1]) { const h = mesh(cached('horn' + big, () => { const c = new THREE.ConeGeometry(big ? 0.035 : 0.022, big ? 0.24 : 0.1, 6); c.translate(0, big ? 0.12 : 0.05, 0); return c; }), mat('#1a1410', 0.5), g, s * 0.06, 0.18, -0.01); h.rotation.z = -s * 0.5; h.rotation.x = -0.4; }
  }
  if (kind !== 'person') return;
  // hair
  const st = app.hairStyle ?? (female ? 1 : 0);
  const hm = mats.hair;
  if (st !== 3) {
    const cap = mesh(cached('haircap', () => new THREE.SphereGeometry(0.118, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55)), hm, g, 0, 0.11, -0.008);
    cap.scale.set(0.95, 1.05, 1.06); cap.rotation.x = -0.25;
    const back = mesh(cached('hairback', () => new THREE.SphereGeometry(0.112, 14, 10, Math.PI * 0.6, Math.PI * 0.8, 0.3, Math.PI * 0.45)), hm, g, 0, 0.09, -0.012);
    back.rotation.y = Math.PI * 0.4 + 0.2; back.scale.set(1.03, 1.08, 1.06);
  }
  if (st === 1) { // long
    const l = mesh(limbGeo(0.09, 0.07, 0.24), hm, g, 0, 0.12, -0.05); l.scale.set(1.1, 1, 0.55);
  } else if (st === 2) { // ponytail
    const p = mesh(limbGeo(0.03, 0.018, 0.25), hm, g, 0, 0.13, -0.11); p.rotation.x = 0.35;
  } else if (st === 4) { // braids
    for (const s of [-1, 1]) { const b = mesh(limbGeo(0.025, 0.018, 0.26), hm, g, s * 0.085, 0.09, -0.02); b.rotation.z = s * 0.1; }
  }
  // beard
  const bd = app.beard ?? (app.race === 'dwarf' && !female ? 3 : 0);
  if (!female && bd > 0) {
    const bm = mesh(cached('beard', () => new THREE.SphereGeometry(0.092, 14, 10, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55)), app.beardCol ? mat(app.beardCol, 0.85) : hm, g, 0, 0.07, 0.022);
    bm.scale.set(1.0, bd === 1 ? 0.7 : 1.1, 1.08);
    if (bd >= 2) { const m = mesh(cached('mous', () => new THREE.BoxGeometry(0.07, 0.014, 0.02)), bm.material, g, 0, 0.058, 0.105); }
    if (bd >= 3) { const lb = mesh(cached('longbeard', () => { const c = new THREE.ConeGeometry(0.07, 0.22, 10); c.rotateX(Math.PI); c.translate(0, -0.11, 0); return c; }), bm.material, g, 0, 0.0, 0.07); lb.scale.z = 0.55; lb.rotation.x = 0.25; }
  }
  g.userData.eyes = true;
}

function dressOutfit(ch, O) {
  const { chest, hips, arms, legs, headG } = ch;
  const th = ch.R.torsoH - 0.2, T = ch.R.thick, sw = ch.R.sw;
  const M = (c, r = 0.85, m = 0) => mat(c, r, m);
  ch.outfit = {};
  if (O.mail) { // chainmail overlay
    const mail = mesh(latheGeo(`mail${T.toFixed(2)}${sw.toFixed(3)}${th.toFixed(2)}`, [[0.15 * T, -0.1], [0.145 * T, 0.02], [0.165 * T, 0.12], [sw * 0.98, th * 0.8], [sw * 1.04, th * 0.95], [sw * 0.78, th + 0.035], [0.08, th + 0.05]]), M(O.mail, 0.45, 0.85), chest);
    mail.scale.z = 0.7; ch.outfit.mail = mail;
    // tabard front & back
    for (const zs of [1, -1]) { const tb = mesh(cached('tabard', () => new THREE.BoxGeometry(0.2, 0.62, 0.012)), M(O.tabard), hips, 0, -0.08, zs * (0.12 * T + 0.0)); tb.scale.x = T * 0.9; ch.outfit['tabard' + zs] = tb; const tr = mesh(cached('tabtrim', () => new THREE.BoxGeometry(0.21, 0.025, 0.016)), M(O.trim, 0.4, 0.8), tb, 0, -0.3, 0); }
    const chestTab = mesh(cached('chesttab', () => new THREE.BoxGeometry(0.22, 0.3, 0.012)), M(O.tabard), chest, 0, th * 0.42, 0.135 * T); chestTab.scale.x = T * 0.9;
    const emb = mesh(cached('emb', () => new THREE.CircleGeometry(0.045, 12)), M(O.trim, 0.4, 0.8), chestTab, 0, 0.03, 0.008);
  }
  if (O.pauldrons) for (const side of ['L', 'R']) { const p = mesh(cached('paul', () => new THREE.SphereGeometry(0.095, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55)), M(O.mail, 0.4, 0.85), arms[side].sh, 0, 0.02, 0); p.scale.set(1.15 * T, 0.8, 1.1 * T); const r = mesh(cached('paulrim', () => new THREE.TorusGeometry(0.095, 0.012, 5, 14)), M(O.trim, 0.35, 0.9), p, 0, 0.0, 0); r.rotation.x = Math.PI / 2; }
  if (O.vest) { const v = mesh(latheGeo(`vest${T.toFixed(2)}${sw.toFixed(3)}${th.toFixed(2)}`, [[0.145 * T, -0.06], [0.15 * T, 0.12], [sw * 0.96, th * 0.8], [sw * 0.9, th * 0.97], [0.09, th + 0.02]]), M(O.vest, 0.8), chest); v.scale.z = 0.7; ch.outfit.vest = v; }
  if (O.belt) { const b = mesh(cached('belt' + T.toFixed(2), () => new THREE.TorusGeometry(0.135 * T, 0.022, 5, 18)), M(O.belt), hips, 0, 0.08, 0); b.rotation.x = Math.PI / 2; b.scale.y = 0.72; mesh(cached('buckle', () => new THREE.BoxGeometry(0.04, 0.035, 0.012)), goldMat, hips, 0, 0.08, 0.135 * T * 0.72 + 0.01); }
  if (O.sash) { const b = mesh(cached('sash' + T.toFixed(2), () => new THREE.TorusGeometry(0.125 * T, 0.03, 5, 18)), M(O.sash, 0.6, 0.3), hips, 0, 0.1, 0); b.rotation.x = Math.PI / 2; b.scale.y = 0.72; }
  if (O.bracers) for (const side of ['L', 'R']) { const b = mesh(limbGeo(0.05 * T, 0.045 * T, 0.13), M(O.bracers, 0.5, O.mail ? 0.8 : 0), arms[side].el, 0, -0.1, 0); }
  if (O.robe) { // long skirt from waist to ankles
    const L = ch.R.legL + 0.02;
    const robe = mesh(latheGeo(`robe${T.toFixed(2)}${L.toFixed(2)}`, [[0.25 * T, -L + 0.04], [0.22 * T, -L * 0.5], [0.16 * T, -0.05], [0.14 * T, 0.12]], 22), M(O.robe, 0.85), hips);
    robe.scale.z = 0.8; ch.outfit.robe = robe; robe.material.side = THREE.DoubleSide; robe.userData.keep = true;
    if (O.trim) { const hem = mesh(cached('hem' + T.toFixed(2), () => new THREE.TorusGeometry(0.25 * T, 0.014, 5, 22)), M(O.trim, 0.4, 0.8), hips, 0, -L + 0.05, 0); hem.rotation.x = Math.PI / 2; hem.scale.y = 0.8; }
    // chest robe overlay & collar
    const top = mesh(latheGeo(`robetop${T.toFixed(2)}${sw.toFixed(3)}${th.toFixed(2)}`, [[0.145 * T, -0.1], [0.15 * T, 0.12], [sw * 0.97, th * 0.85], [sw * 0.8, th + 0.03], [0.07, th + 0.07]]), M(O.robe, 0.85), chest); top.scale.z = 0.68;
    if (O.trim) { const v = mesh(cached('vtrim', () => new THREE.BoxGeometry(0.03, 0.3, 0.01)), M(O.trim, 0.4, 0.8), chest, 0, th * 0.55, 0.12 * T); }
  }
  if (O.sleeves) for (const side of ['L', 'R']) { const s = mesh(latheGeo('sleeve', [[0.09, -0.24], [0.06, -0.1], [0.05, 0.02]], 12), M(O.robe || O.shirt), arms[side].el, 0, 0, 0); s.material.side = THREE.DoubleSide; }
  if (O.apron) { const a = mesh(cached('apron', () => new THREE.BoxGeometry(0.26, 0.7, 0.01)), M(O.apron, 0.9), chest, 0, 0.0, 0.14 * T); }
  if (O.shawl) { const s = mesh(cached('shawl', () => new THREE.TorusGeometry(0.14, 0.05, 6, 16)), M(O.shawl), chest, 0, th - 0.02, 0); s.rotation.x = Math.PI / 2; s.scale.set(sw / 0.15, 0.8, 0.8); }
  if (O.hood) {
    const hood = mesh(cached('hood', () => new THREE.SphereGeometry(0.135, 16, 12, Math.PI * 0.5 + Math.PI * 0.27, Math.PI * 1.46, 0, Math.PI * 0.72)), M(O.hood, 0.9), headG, 0, 0.1, -0.012); hood.material.side = THREE.DoubleSide; hood.scale.set(1, 1.08, 1.1);
    const tipH = mesh(cached('hoodtip', () => { const c = new THREE.ConeGeometry(0.06, 0.16, 8); c.rotateX(-Math.PI / 2 - 0.5); return c; }), hood.material, headG, 0, 0.17, -0.13);
    const cowl = mesh(cached('cowl', () => new THREE.TorusGeometry(0.11, 0.045, 6, 16)), hood.material, ch.neck, 0, 0.0, 0); cowl.rotation.x = Math.PI / 2;
    ch.outfit.hood = hood;
  }
  if (O.cloak) {
    const cl = mesh(cached('cloak', () => { const g = new THREE.PlaneGeometry(0.46, 1.0, 4, 8); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, -Math.abs(x) * 0.25 + (0.5 - y) * -0.12); } g.translate(0, -0.5, 0); g.computeVertexNormals(); return g; }), M(O.cloak, 0.9, 0, { side: THREE.DoubleSide }), chest, 0, th + 0.02, -0.11 * T);
    cl.scale.x = sw / 0.2; ch.outfit.cloak = cl; cl.userData.keep = true;
  }
  if (O.mask) { const m = mesh(cached('mask', () => new THREE.SphereGeometry(0.1, 14, 8, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.3)), M(O.mask), headG, 0, 0.1, 0.012); m.scale.set(0.98, 1.1, 1.08); }
  if (O.quiver) {
    const q = new THREE.Group(); q.position.set(0.06, th * 0.5, -0.17 * T); q.rotation.z = 0.35; q.rotation.x = 0.15; chest.add(q);
    mesh(cached('quiv', () => new THREE.CylinderGeometry(0.045, 0.04, 0.5, 10)), M('#5a3a22'), q);
    for (let i = 0; i < 5; i++) { const a = mesh(cached('fletch', () => new THREE.ConeGeometry(0.018, 0.08, 4)), M(i % 2 ? '#d8d0c0' : '#a02020'), q, (i % 3 - 1) * 0.02, 0.3, ((i * 7) % 3 - 1) * 0.015); }
    ch.outfit.quiver = q;
  }
  if (O.hat === 'pointy') {
    const hat = new THREE.Group(); hat.position.set(0, 0.19, -0.005); headG.add(hat);
    const hm = M(O.hatCol, 0.85);
    mesh(cached('brim', () => new THREE.CylinderGeometry(0.22, 0.23, 0.015, 24)), hm, hat);
    let y = 0.005, r = 0.12, parent = hat;
    for (let i = 0; i < 4; i++) { const h = 0.1; const seg = mesh(cached('hatseg' + i, () => { const c = new THREE.CylinderGeometry(r * 0.72, r, h, 14); c.translate(0, h / 2, 0); return c; }), hm, parent, 0, i === 0 ? y : 0.1, 0); seg.rotation.x = i === 0 ? 0 : -0.18; parent = seg; r *= 0.72; }
    const band = mesh(cached('hatband', () => new THREE.CylinderGeometry(0.122, 0.122, 0.025, 16)), M(O.trim || '#d8b04a', 0.4, 0.8), hat, 0, 0.02, 0);
    ch.outfit.hat = hat;
  } else if (O.hat === 'straw') {
    const hat = mesh(cached('straw', () => new THREE.ConeGeometry(0.26, 0.12, 18)), M(O.hatCol, 0.95), headG, 0, 0.22, 0);
  } else if (O.hat === 'cap') {
    const hat = mesh(cached('cap', () => new THREE.CylinderGeometry(0.115, 0.12, 0.08, 14)), M(O.hatCol), headG, 0, 0.2, -0.01); hat.rotation.x = -0.15;
    mesh(cached('feather', () => new THREE.ConeGeometry(0.012, 0.16, 4)), M('#e8e0c0'), hat, 0.08, 0.06, -0.04).rotation.z = -0.6;
  }
  if (O.torn) { // ragged shirt hem
    for (let i = 0; i < 6; i++) { const r = mesh(cached('rag', () => new THREE.ConeGeometry(0.035, 0.08, 3)), ch.mats.shirt, ch.chest, Math.cos(i) * 0.12, -0.11, Math.sin(i * 2) * 0.08); r.rotation.x = Math.PI; }
  }
}

// equip weapons visually on a humanoid (third person). wt: weapon type id
const AXE_ROT = -Math.PI / 2;
export function equipWeapon(ch, wt, tier = 0, rarity = 0) {
  if (ch.sheathG) { ch.sheathG.parent && ch.sheathG.parent.remove(ch.sheathG); ch.sheathG = null; }
  for (const k in ch.weapons) { const w = ch.weapons[k]; w.parent && w.parent.remove(w); }
  ch.weapons = {}; ch.wt = wt;
  if (!wt) return;
  const W = WEAPON_TYPES[wt];
  const parts = W.parts;
  const main = makeWeapon(parts[0], tier, rarity, W.element);
  ch.arms.R.grip.add(main); ch.weapons.main = main;
  if (W.kind === 'bow') { ch.arms.R.grip.remove(main); ch.arms.L.grip.add(main); main.rotation.set(-Math.PI / 2, 0, 0); main.position.set(0, 0, -0.02); }
  if (W.kind === 'staff') { main.position.y = -0.5; }
  // turn blades and axe heads so their edge faces forward instead of sideways
  const AXE = (pt) => pt === 'handaxe' || pt === 'greataxe'; // axe heads sit on their own side of the haft: turn them the other way so the edge leads
  if (W.kind === 'melee') main.rotation.y = AXE(parts[0]) ? AXE_ROT : Math.PI / 2;
  if (wt === 'spear') { main.position.y = -0.7; }
  if (W.hands === 'two' && wt !== 'spear') main.position.y = W.parts[0] === 'greatsword' ? -0.06 : -0.25;
  if (wt === 'musket') { main.position.y = 0; main.scale.setScalar(0.9); } // (the detailed musket: the right hand on the wrist of the stock, a little shorter than its owner)
  if (parts[1]) {
    const off = makeWeapon(parts[1], tier, rarity);
    ch.arms.L.grip.add(off); ch.weapons.off = off; if (parts[1] !== 'shield') off.rotation.y = AXE(parts[1]) ? AXE_ROT : Math.PI / 2;
    if (parts[1] === 'shield') { off.rotation.set(-Math.PI / 2, Math.PI / 2, 0); off.position.set(0.08, 0.0, 0.05); }
  }
}
// put the weapons in your hands away on your back (and draw them again): clones of the held meshes on the chest
export function sheathe(ch, on) {
  if (!ch.weapons || !ch.weapons.main || !ch.chest) return;
  if (on && !ch.sheathG) {
    const g = new THREE.Group(); g.position.set(0, 0.06, -0.16); ch.chest.add(g); ch.sheathG = g;
    const W = WEAPON_TYPES[ch.wt], main = ch.weapons.main.clone(), off = ch.weapons.off && ch.weapons.off.clone(), shield = off && ch.weapons.off.userData.isShield;
    main.scale.copy(ch.weapons.main.scale); main.position.set(0, 0, 0); g.add(main);
    if (W.kind === 'bow') { main.rotation.set(0, 0, -0.75); main.position.set(0.02, 0.05, -0.04); }
    else if (W.kind === 'gun') { main.rotation.set(0, 0, -0.42); main.position.set(0.05, -0.32, -0.05); }
    else if (W.kind === 'staff') { main.rotation.set(0, 0, 0.5); main.position.set(0.1, -0.5, -0.04); }
    else { main.rotation.set(0, Math.PI / 2, Math.PI + 0.55); main.position.set(0.12, 0.24, shield ? -0.12 : -0.03); }
    if (off) { g.add(off); if (shield) { off.rotation.set(0, Math.PI / 2, Math.PI / 2); off.position.set(0, -0.04, -0.06); off.scale.copy(ch.weapons.off.scale); } else { off.rotation.set(0, Math.PI / 2, Math.PI - 0.55); off.position.set(-0.12, 0.24, -0.05); } }
  }
  if (ch.sheathG) ch.sheathG.visible = !!on;
  ch.weapons.main.visible = !on; if (ch.weapons.off) ch.weapons.off.visible = !on;
}
// the weapons you are not holding hang on your back, so everyone can see what you carry. items: [{wt, tier, rarity} | null, ...]
export function backWeapons(ch, items) {
  if (ch.backG) { ch.backG.parent && ch.backG.parent.remove(ch.backG); ch.backG = null; }
  const list = (items || []).filter(Boolean); if (!list.length || !ch.chest) return;
  const g = new THREE.Group(); g.position.set(0, 0.06, -0.15); ch.chest.add(g); ch.backG = g;
  list.forEach((it, i) => {
    const W = WEAPON_TYPES[it.wt]; if (!W) return;
    const part = W.parts[0] === 'shield' || it.wt === 'shield' ? 'shield' : W.parts[0];
    const m = makeWeapon(part, it.tier || 0, it.rarity || 0, W.element); g.add(m);
    if (part === 'shield') { m.rotation.set(0, Math.PI / 2, Math.PI / 2); m.position.set(0, -0.02, -0.07); return; }
    if (W.kind === 'bow') { m.rotation.set(0, 0, -0.75); m.position.set(0.02, 0.05, -0.02); return; }
    if (W.kind === 'gun') { m.rotation.set(0, 0, -0.42); m.position.set(0.05, -0.32, -0.03); return; }
    if (W.kind === 'staff') { m.rotation.set(0, 0, 0.5); m.position.set(0.1, -0.5, -0.02); return; }
    // blades and hafts: the grip over the shoulder, the blade down the back (two of them cross)
    const s = i % 2 ? -1 : 1; m.rotation.set(0, Math.PI / 2, Math.PI + s * 0.55); m.position.set(s * 0.12, 0.24, -0.03 - i * 0.02);
    if (W.hands === 'two') m.position.y = 0.34;
  });
}
export function holdTool(ch, tool, tier = 1) {
  if (ch.toolMesh) { ch.toolMesh.parent && ch.toolMesh.parent.remove(ch.toolMesh); ch.toolMesh = null; }
  for (const k in ch.weapons) ch.weapons[k].visible = !tool;
  if (tool) { ch.toolMesh = makeWeapon(tool, tier); ch.arms.R.grip.add(ch.toolMesh); }
}

// Gear tint: chest/legs colours by equipped armour tier
export function tintGear(ch, gear) {
  if (!ch.outfit) return;
  const chest = gear && gear.chest, legs = gear && gear.legs, head = gear && gear.head;
  if (ch.outfit.mail) ch.outfit.mail.material.color.set(chest ? TIERS[chest.tier].col : CLASSES.warrior.colors.metal);
  if (legs) ch.mats.pants.color.set(new THREE.Color(ch.mats.pants.color).lerp(new THREE.Color(TIERS[legs.tier].col), 0.3));
  // cloak from the back slot
  if (gear && gear.back && ch.outfit) {
    const col = ['#8a2a2a', '#8a2a2a', '#2a5a2a', '#2a3a8a', '#5a2a8a', '#8a6a1a'][gear.back.tier] || '#8a2a2a';
    if (ch.outfit.cloak) ch.outfit.cloak.material.color.set(col);
    else {
      const th = ch.R.torsoH - 0.2, T = ch.R.thick;
      const cl = new THREE.Mesh(cached('cloak', () => { const g = new THREE.PlaneGeometry(0.46, 1.0, 4, 8); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, -Math.abs(x) * 0.25 + (0.5 - y) * -0.12); } g.translate(0, -0.5, 0); g.computeVertexNormals(); return g; }), mat(col, 0.9, 0, { side: THREE.DoubleSide }));
      cl.position.set(0, th + 0.02, -0.11 * T - 0.06); cl.scale.x = ch.R.sw / 0.2; cl.castShadow = true; cl.userData.keep = true; ch.chest.add(cl); ch.outfit.cloak = cl;
    }
  }
  // helmet for warriors with head armour
  if (ch.helm) { ch.helm.parent.remove(ch.helm); ch.helm = null; }
  if (head && ch.app.cls === 'warrior') {
    const h = new THREE.Group();
    const m = mat(TIERS[head.tier].col, 0.35, 0.85);
    const dome = mesh(cached('helm', () => new THREE.SphereGeometry(0.13, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55)), m, h, 0, 0.11, 0); dome.scale.set(0.95, 1.05, 1.08);
    mesh(cached('nasal', () => new THREE.BoxGeometry(0.02, 0.08, 0.015)), m, h, 0, 0.09, 0.13);
    const rim = mesh(cached('helmrim', () => new THREE.TorusGeometry(0.125, 0.015, 5, 18)), m, h, 0, 0.12, 0); rim.rotation.x = Math.PI / 2; rim.scale.y = 1.1;
    ch.headG.add(h); ch.helm = h;
  }
}

// ---------- Animation ----------
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
function setRot(o, x, y, z) { o.rotation.set(x, y, z); }
function damp(o, x, y, z, k) { o.rotation.x += (x - o.rotation.x) * k; o.rotation.y += (y - o.rotation.y) * k; o.rotation.z += (z - o.rotation.z) * k; }

// how far each attack steps into the blow at time t (negative: weight rocks back during the wind-up)
const ACT_WIND = { swing1: 0.3, swing2: 0.3, swing3: 0.42, off1: 0.3, heavy: 0.5, thrust1: 0.35, thrust2: 0.35, thrust3: 0.4, stab: 0.3, cast: 0.17, area: 0.2, slam: 0.55, claw: 0.4, lowcut: 0.3, chop: 0.45, castBig: 0.5 };
function lungeOf(name, t) { const w = ACT_WIND[name]; if (w == null) return 0; if (t < w) return -0.25 * Math.sin((t / w) * Math.PI / 2); if (t < 0.75) { const u = (t - w) / (0.75 - w); return -0.25 + 1.25 * (1 - Math.pow(1 - Math.min(1, u * 1.6), 3)); } return 1 - ease((t - 0.75) / 0.25); }
// Key poses for melee attacks [chestY, shRx, shRy, shRz, elR, shLx, shLz, elL, spineX]
const POSE = {
  ready: [0, -0.5, 0, 0.15, -0.9, -0.4, -0.15, -0.9, 0],
  s1a: [1.0, -2.55, 0.5, 0.9, -1.7, -0.6, -0.45, -1.0, -0.15], s1b: [-0.95, -0.4, -0.9, 0.25, -0.2, -0.2, -0.25, -0.7, 0.3],
  s2a: [-0.9, -2.2, -0.9, -0.3, -1.8, -0.5, -0.4, -0.9, -0.1], s2b: [0.9, -0.45, 0.6, 0.9, -0.2, -0.25, -0.3, -0.6, 0.28],
  s3a: [0.2, -3.0, 0, 0.3, -1.1, -2.9, -0.3, -1.0, -0.25], s3b: [-0.1, -0.7, 0, 0.1, -0.1, -0.7, -0.1, -0.2, 0.4],
  h_a: [0.9, -2.6, 0.3, 0.9, -1.6, -2.4, -0.4, -1.4, -0.3], h_b: [-0.2, -0.5, 0, 0.0, -0.1, -0.45, -0.1, -0.15, 0.55],
  thrA: [0.55, 0.4, 0, 0.2, -0.55, -0.35, -0.4, -1.0, -0.12], thrB: [-0.35, -0.38, 0, 0.08, -0.05, -0.6, 0.1, -0.5, 0.28], // pull the weapon back to the hip, then drive it straight out
  stabA: [0.75, -2.0, 0.35, 0.55, -2.1, -0.9, -0.5, -1.2, -0.12], stabB: [-0.6, -1.45, -0.1, 0.12, -0.05, -0.55, -0.2, -1.3, 0.42], // a dagger stab: blade drawn back by the ear, shoulders turned away, then the whole body drives it out and down
  off1a: [-0.9, -0.3, 0, 0, -0.9, -1.4, -0.6, -1.25, 0], off1b: [0.85, -0.3, 0, 0, -0.8, -1.45, 0.7, -0.2, 0.1],
  block: [0, -1.2, 0, 0.9, -1.7, -1.6, -0.6, -1.4, 0.05],
  bowAim: [0.5, -1.55, 0, -0.1, -2.4, -1.55, -0.05, 0, 0],
  gunAim: [0.45, -1.45, 0, 0.25, -1.1, -1.5, -0.25, -0.25, 0], bowDraw: [0.6, -1.55, 0, -0.2, -2.7, -1.6, -0.05, 0, 0],
  cast: [-0.5, -0.55, 0, 0.3, -1.45, -1.0, -0.55, -2.1, -0.1], castB: [0.38, -0.5, 0, 0.25, -1.25, -1.72, 0.08, -0.04, 0.24], // a spell thrown, not handed over: the free hand gathers it at the shoulder with that side drawn back, then the body turns in and drives the palm out at the target
  staffSlam: [0, -2.4, 0, 0.2, -1.0, -1.0, -0.2, -1.0, -0.25], staffSlamB: [0, -0.9, 0, 0.2, -0.6, -0.9, -0.2, -0.6, 0.35],
  chopA: [0.6, -2.2, 0.3, 1.0, -1.2, -0.3, -0.3, -0.7, -0.1], chopB: [-0.3, -1.2, -0.2, 0.3, -0.3, -0.3, -0.3, -0.7, 0.2],
  mineA: [0, -2.9, 0, 0.2, -1.2, -2.8, -0.2, -1.2, -0.3], mineB: [0, -0.9, 0, 0.1, -0.3, -0.9, -0.1, -0.3, 0.45],
  gatherA: [0, -1.1, 0, 0.2, -0.6, -1.1, -0.2, -0.6, 0.5], gatherB: [0, -0.8, 0, 0.3, -1.2, -0.8, -0.3, -1.2, 0.6],
  cheer: [0, -2.9, 0, 0.5, -0.2, -2.9, -0.5, -0.2, -0.2],
};
function poseLerp(a, b, t) { const o = new Array(9); for (let i = 0; i < 9; i++) o[i] = lerp(a[i], b[i], t); return o; }
// attack pose by action name & progress (0..1). Returns array or null
function attackPose(name, t, mirror) {
  const seq = (a, b, wind = 0.35) => t < wind ? poseLerp(POSE.ready, POSE[a], ease(t / wind)) : t < 0.75 ? poseLerp(POSE[a], POSE[b], ease((t - wind) / (0.75 - wind))) : poseLerp(POSE[b], POSE.ready, ease((t - 0.75) / 0.25));
  switch (name) {
    case 'swing1': return seq('s1a', 's1b', 0.3);
    case 'swing2': return seq('s2a', 's2b', 0.3);
    case 'swing3': return seq('s3a', 's3b', 0.42);
    case 'off1': return seq('off1a', 'off1b', 0.3);
    case 'heavy': return seq('h_a', 'h_b', 0.5);
    case 'thrust1': case 'thrust2': return seq('thrA', 'thrB', 0.35);
    case 'stab': return seq('stabA', 'stabB', 0.3);
    case 'thrust3': return seq('h_a', 'thrB', 0.4);
    case 'area': return seq('s1a', 's1b', 0.2);
    case 'cast': return t < 0.15 ? poseLerp(POSE.ready, POSE.cast, ease(t / 0.15)) : t < 0.34 ? poseLerp(POSE.cast, POSE.castB, ease((t - 0.15) / 0.19)) : t < 0.72 ? POSE.castB : poseLerp(POSE.castB, POSE.ready, ease((t - 0.72) / 0.28)); // (the palm snaps out as the spell leaves, around 30% in, and holds there)
    case 'castBig': return seq('staffSlam', 'staffSlamB', 0.5);
    case 'shoot': return t < 0.45 ? poseLerp(POSE.bowAim, POSE.bowDraw, ease(t / 0.45)) : t < 0.6 ? POSE.bowDraw : poseLerp(POSE.bowDraw, POSE.bowAim, ease((t - 0.6) / 0.4)); // draw the string back, hold, loose
    case 'chop': return seq('chopA', 'chopB', 0.45);
    case 'mine': return seq('mineA', 'mineB', 0.5);
    case 'gather': case 'skin': return t < 0.5 ? poseLerp(POSE.gatherA, POSE.gatherB, ease(t * 2)) : poseLerp(POSE.gatherB, POSE.gatherA, ease((t - 0.5) * 2));
    case 'cheer': return POSE.cheer;
    case 'castUp': { const k = ease(Math.min(1, t)); return [0, -0.9 - 1.9 * k, 0, -0.35 - 0.15 * k, -0.5 * (1 - k) - 0.15, -0.9 - 1.9 * k, -0.35 - 0.15 * k, -0.5 * (1 - k) - 0.15, -0.18 * k]; } // both arms rise slowly to the sky, the head and chest tip back
    case 'castRel': { const k = ease(Math.min(1, t * 2)); return [0, -2.8 + 1.4 * k, 0, -0.5 + 0.3 * k, -0.15, -2.8 + 1.4 * k, -0.5 + 0.3 * k, -0.15, -0.18 + 0.28 * k]; } // and sweep forward to release the spell
    case 'gunAim': { const o = POSE.gunAim.slice(); o[8] = -0.12 * Math.max(0, 1 - t * 4); o[1] -= 0.25 * Math.max(0, 1 - t * 4); return o; } // musket at the shoulder; a kick back on the shot (t = time since firing)
    case 'claw': return seq('s1a', 's1b', 0.4);
    case 'slam': return seq('h_a', 'h_b', 0.55);
    case 'kick': return [0, -0.7, 0, 0.35, -1.4, -0.9, -0.3, -1.4, -0.25 * Math.sin(Math.min(1, t * 1.6) * Math.PI)]; // guard up, lean back as the leg goes out
    case 'lowcut': { const o = seq('s2a', 's2b', 0.3); o[8] = 0.5 * Math.sin(Math.min(1, t * 1.2) * Math.PI); return o; } // a low cut: bend right down into it
  }
  return null;
}

// st: { speed, airborne, action, actionT, block, dead, deadT, bowDraw, sit, lie, crouch, swim, spinT, hit }
const _rq = new THREE.Quaternion(), _rax = new THREE.Vector3(), _rp = new THREE.Vector3();
const _sq1 = new THREE.Quaternion(), _sq2 = new THREE.Quaternion(), _sq3 = new THREE.Quaternion(), _se = new THREE.Euler();
// keep a strapped shield upright (point down, face outward) whatever the arm is doing
function uprightShield(ch, st) {
  const sh = ch.weapons && ch.weapons.off; if (!sh || !sh.userData.isShield || !sh.parent) return;
  if (!sh.userData.sized) { sh.userData.sized = true; sh.scale.multiplyScalar(0.55); } // a little smaller on the body than in your first-person view
  ch.root.updateMatrixWorld(true);
  sh.parent.getWorldQuaternion(_sq1); ch.body.getWorldQuaternion(_sq2);
  // blocking: face front; otherwise it rides the forearm, angled out to the front-left
  const bk = sh.userData.bk = (sh.userData.bk || 0) + ((st.block ? 1 : 0) - (sh.userData.bk || 0)) * 0.25;
  const rx = (ch.relaxK || 0) * (1 - bk); _sq3.setFromEuler(_se.set(-0.1 * bk + 0.04 * (1 - bk), 0.12 * bk + 0.5 * (1 - bk), 0)); // turned outward: about 30 degrees when ready, 45 when relaxed
  _sq2.multiply(_sq3);
  sh.quaternion.copy(_sq1.invert().multiply(_sq2));
}
export function animateHumanoid(ch, dt, st) {
  ch._st = st;
  ch._act = st.action || (st.block ? 'block' : null) || (st.aimStaff ? 'aim' : null); // (read by the 3D hero models: their arms follow the built body while it attacks)
  const A = ch.anim; A.t += dt; const S = ch.style || null; if (ch._so) styleUndo(ch);
  const { hips, spine, chest, neck, head, arms, legs, body } = ch;
  const sp = Math.min(st.speed || 0, 9.5); // (a charge or dash moves faster, but the legs never blur)
  const k = Math.min(1, dt * 12);
  // locomotion: a real gait. The cadence rises with speed; the body leans in, dips as a foot passes under it and
  // lifts in the flight phase; the swinging leg folds up under the body while the stance leg stays long
  const runF = clamp01((sp - 1.6) / 4.2), sprF = clamp01((sp - 6.2) / 2.2), walkF = clamp01(sp / 1.4);
  const legK = Math.max(0.6, ch.R.legL / 0.9);
  A.walk += dt * (sp > 0.1 ? (1.7 + runF * 1.0 + sprF * 0.45) * Math.PI * 2 * 0.5 / Math.sqrt(legK) * (S && S.cadence || 1) : 0); // one cycle = two steps
  const ph = A.walk;
  const amp = walkF * (0.4 + runF * 0.32 + sprF * 0.26) * (S && S.stride || 1);
  const gait = (s) => { const th = Math.sin(s) * amp, swing = Math.max(0, Math.cos(s)), stance = Math.max(0, -Math.cos(s));
    const kn = 0.05 + walkF * (0.08 * stance + (0.5 + runF * 0.85 + sprF * 0.45) * Math.pow(swing, 1.4));
    return [th, kn, -kn * 0.32 + 0.12 * stance * walkF]; };
  let [thL, knL, anL] = gait(ph), [thR, knR, anR] = gait(ph + Math.PI);
  let bob = walkF * (1 - Math.abs(Math.sin(ph))) * (0.018 + runF * 0.05 + sprF * 0.02) * (S && S.bob != null ? S.bob : 1);
  let lean = (walkF * 0.04 + runF * 0.13 + sprF * 0.2) * (st.back ? -0.6 : 1);
  const air = st.airborne && !st.swim;
  if (air) { const up = (st.vy || 0) > 0.5; if (up) { thL = 1.15; knL = 1.5; thR = -0.35; knR = 0.75; } else { thL = 0.45; knL = 0.45; thR = 0.15; knR = 0.3; } anL = anR = -0.2; bob = 0; }
  const land = st.land || 0;
  if (land > 0 && !air) { thL += 0.8 * land; thR += 0.8 * land; knL += 1.4 * land; knR += 1.4 * land; bob += 0.2 * land; lean += 0.35 * land; }
  // attacks step into the blow: weight back on the wind-up, a lunge onto the front foot as the strike lands
  { const lg = st.action && !air && !st.roll ? lungeOf(st.action, clamp01(st.actionT || 0)) * (1 - runF * 0.8) : 0;
    if (lg) { thL += 0.5 * lg; knL += 0.6 * Math.max(0, lg); thR -= 0.38 * lg; knR += 0.25 * Math.abs(lg); anL -= 0.2 * Math.max(0, lg); bob += 0.075 * Math.abs(lg); lean += 0.24 * lg; } }
  if (st.swim) { thL = Math.sin(A.t * 3) * 0.4; thR = -thL; knL = 0.4; knR = 0.4; lean = 0.9; }
  const breathe = Math.sin(A.t * 1.8) * 0.028; // (visible breathing: the chest rises and falls)
  hips.position.y = (ch.R.legL + 0.06) - bob + (st.crouch ? -0.2 : 0);
  hips.rotation.y += ((air ? 0 : Math.sin(ph) * amp * 0.22) - hips.rotation.y) * k;
  // weight: the hips sway over the stance foot when moving, and shift slowly from foot to foot when standing
  { const idle = 1 - walkF, sway = air ? 0 : Math.sin(ph) * 0.035 * amp + idle * Math.sin(A.t * 0.7) * 0.014; hips.position.x += (sway - hips.position.x) * k; hips.rotation.z += ((air ? 0 : -Math.sin(ph) * 0.05 * amp + idle * Math.sin(A.t * 0.7) * 0.025) - hips.rotation.z) * k; }
  // legs
  // standing armed: soft knees and feet a little apart (blended in, so it never fights the stride)
  const soft = ch.softK = (ch.softK || 0) + (((st.armed && ch.wt && sp < 0.6 && !st.airborne && !st.action && !st.sit && !st.swim && !st.dead) ? 1 : 0) - (ch.softK || 0)) * Math.min(1, dt * 6), kb = 0.2 * soft;
  damp(legs.L.thigh, -thL - (st.sit ? 1.5 : 0) - kb * 0.5, 0, 0.02 + 0.09 * soft, k); damp(legs.R.thigh, -thR - (st.sit ? 1.5 : 0) - kb * 0.5, 0, -0.02 - 0.09 * soft, k);
  damp(legs.L.knee, knL + (st.sit ? 1.5 : 0) + kb, 0, 0, k); damp(legs.R.knee, knR + (st.sit ? 1.5 : 0) + kb, 0, 0, k);
  damp(legs.L.ankle, anL + (land > 0 ? 0.6 * land : 0) - kb * 0.5, 0, 0, k); damp(legs.R.ankle, anR + (land > 0 ? 0.6 * land : 0) - kb * 0.5, 0, 0, k);
  // a front kick: chamber the knee, snap the leg straight out, put it back down
  if (st.action === 'kick') { const t = clamp01(st.actionT || 0), ch1 = t < 0.25 ? t / 0.25 : 1, ext = t < 0.25 ? 0 : t < 0.45 ? (t - 0.25) / 0.2 : t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3, back = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
    legs.R.thigh.rotation.x = -(0.9 * ch1 + 0.65 * ext) * back; legs.R.knee.rotation.x = (1.6 * ch1 * (1 - ext) + 0.05) * back; legs.R.ankle.rotation.x = -0.5 * ext * back;
    legs.L.knee.rotation.x = 0.25; legs.L.thigh.rotation.x = 0.1; }
  // default arm swing
  let armSwing = Math.sin(ph) * amp * 0.9 * (S && S.swing != null ? S.swing : 1);
  let P = null;
  if (st.action) P = attackPose(st.action, clamp01(st.actionT || 0));
  if (!P && st.block) P = POSE.block;
  if (!P && st.bowDraw) P = POSE.bowDraw;
  let carry = false;
  if (!P && st.armed && ch.wt) {
    // weapon-carry poses that move with the stride: arms pump, elbows bend more as you run, the torso twists
    carry = true; const W = WEAPON_TYPES[ch.wt], sw = armSwing, bend = runF * 0.55;
    const ready = st.ready !== false; ch.relaxK = (ch.relaxK || 0) + ((ready ? 0 : 1) - (ch.relaxK || 0)) * Math.min(1, dt * 5);
    if (!ready && W.kind === 'melee' && W.hands !== 'two') // relaxed: both arms hang loose at your sides, the blade low with its tip toward the ground
      P = W.hands === 'shield' ? [0.06, -0.15 - sw * 0.6, 0, -0.42, -0.45 - bend, -0.25 + sw * 0.25, -0.3, -0.85 - bend * 0.3, 0] // like the reference: sword low at the right hip, shield upright at the left side
        : [0.04, 0.05 - sw * 0.7, 0, -0.42, -0.18 - bend, -0.1 + sw * 0.7, 0.3, -0.35 - bend * 0.5, 0]; // weapon arm straight down beside the hip, out from the body; the free arm out too, not tucked in
    else if (W.hands === 'two' && W.kind === 'melee' && sp > 0.6) // on the move: the big weapon in one hand, swinging with the stride; the free arm pumps (both hands go back on to swing)
      P = [0.2 + sw * 0.15, -0.35 - sw * 1.05 - runF * 0.2, 0.15, -0.25, -0.55 - bend, sw * 1.2 - 0.05, -0.15, -0.35 - bend * 1.2, 0];
    else if (!ready && W.hands === 'two' && W.kind === 'melee') // relaxed two-hander: held low across the body, head down by the left foot
      P = [0.15, -0.3 - sw * 0.2, 0.15, 0.25, -0.55 - runF * 0.3, -0.45 + sw * 0.15, -0.25, -0.75 - runF * 0.3, 0];
    else if (!ready && W.kind === 'staff') // a walking stick: planted beside you, the other arm loose
      P = [0, -0.25 - sw * 0.4, 0, 0.16, -0.75, sw * 0.8 - 0.05, -0.1, -0.3 - bend, 0];
    else if (!ready && W.kind === 'bow') P = [0, -0.1 - sw * 0.7, 0, 0.1, -0.3 - bend, -0.15 + sw * 0.6, -0.1, -0.25 - bend * 0.5, 0];
    else if (W.kind === 'bow') P = [0, -0.3 - sw * 0.7, 0, 0.12, -0.45 - bend, -0.55 + sw * 0.6, -0.12, -0.5 - bend * 0.6, 0];
    else if (W.kind === 'staff') P = [0, -0.4 - sw * 0.75, 0, 0.14, -0.9 - bend * 0.4 + sw * 0.15, sw * 1.15 - 0.1, -0.14, -0.4 - bend * 1.3, 0];
    else if (W.hands === 'two') P = [0.3 + sw * 0.25, -0.8 - sw * 0.25 - runF * 0.25, 0.2, 0.35, -1.25 - runF * 0.2, -0.95 + sw * 0.25 - runF * 0.25, -0.35, -1.25 - runF * 0.2, 0];
    // sword and board: sword arm relaxed low with the blade angled forward, shield arm bent so the shield rides the forearm in front of the hip
    else if (W.hands === 'shield') P = [0.1, -0.25 - sw * 0.8, 0, -0.45, -0.6 - bend * 0.6, -0.38 + sw * 0.3, -0.3, -0.95 - bend * 0.2, 0]; // ready: the same stance, sword a little higher, shield brought up to cover the left side // ready: sword arm out from the body, elbow bent, blade forward; shield arm forward and out
    else P = [0, -0.4 - sw * 1.0, 0, -0.5, -0.85 - bend + sw * 0.2, -0.4 + sw * 1.1, 0.28, -0.85 - bend * 1.2 - sw * 0.2, 0]; // no shield: both arms held out from the body, not tucked into it
  }
  if (P) {
    const mir = st.mirror ? -1 : 1;
    const twist = carry ? Math.sin(ph) * amp * 0.42 : 0; // shoulders counter the hips
    damp(chest, carry ? breathe + Math.abs(Math.sin(ph)) * amp * 0.06 : 0, P[0] * mir * 0.7 + twist, carry ? Math.sin(ph) * amp * 0.09 : 0, k * (carry ? 1.4 : 1.4));
    damp(spine, P[8] + lean * (carry ? 0.85 : 0.5), P[0] * mir * 0.3 - twist * 0.4, 0, k * (carry ? 1 : 1.4));
    const kc = 1 - 0.7 * (st.chain || 0); /* (a chained swing: the arms glide from the last follow-through into the new wind-up) */
    if (st.mirror) { // left hand performs the attack (dual wield off-hand)
      damp(arms.L.sh, P[1], -P[2], -P[3], k * 1.6 * kc); damp(arms.L.el, P[4], 0, 0, k * 1.6 * kc);
      damp(arms.R.sh, P[5], 0, -P[6], k * 1.6 * kc); damp(arms.R.el, P[7], 0, 0, k * 1.6 * kc);
    } else {
      const ka = carry ? k * (0.7 + Math.min(1, sp / 3) * 1.3) : k * 1.35 * kc; // (at rest the arms trail the body slightly; on the move they keep up with the stride)
      damp(arms.R.sh, P[1], P[2], P[3], ka); damp(arms.R.el, P[4], 0, 0, ka);
      damp(arms.L.sh, P[5], 0, P[6], ka); damp(arms.L.el, P[7], 0, 0, ka);
    }
  } else {
    damp(chest, breathe, Math.sin(ph) * amp * 0.12, 0, k);
    damp(spine, lean + (st.sit ? -0.05 : 0), 0, 0, k);
    damp(arms.R.sh, -armSwing * 1.1, 0, 0.1, k); damp(arms.L.sh, armSwing * 1.1, 0, -0.1, k);
    damp(arms.R.el, -0.25 - runF * 1.0 - sprF * 0.3, 0, 0, k); damp(arms.L.el, -0.25 - runF * 1.0 - sprF * 0.3, 0, 0, k);
  }
  if (air && !st.action && !st.block) { const up = (st.vy || 0) > 0.5; damp(arms.L.sh, up ? -1.3 : -0.5, 0, up ? -0.35 : -1.0, k * 1.3); damp(arms.R.sh, up ? -0.4 : -0.5, 0, up ? 0.5 : 1.0, k * 1.3); damp(arms.L.el, -0.5, 0, 0, k); damp(arms.R.el, -0.5, 0, 0, k); }
  if (st.wave) { damp(arms.R.sh, -2.6, 0, 0.3 + Math.sin(A.t * 8) * 0.25, k); damp(arms.R.el, -0.4, 0, 0, k); }
  if (ch.outfit && ch.outfit.robe) { const rb = ch.outfit.robe, fl = air ? 0.35 : Math.abs(Math.sin(ph)) * amp; rb.rotation.x += ((air ? 0.2 : Math.sin(ph) * amp * 0.18 + lean * 0.4) - rb.rotation.x) * k; rb.scale.z += (0.8 * (1 + fl * 0.45) - rb.scale.z) * k; rb.scale.x += ((1 + fl * 0.22) - rb.scale.x) * k; } // a robe flares and swings with the stride
  // lean into turns when running (st.turn: how fast you are turning, radians a second)
  { const tl = Math.max(-0.28, Math.min(0.28, -(st.turn || 0) * 0.07 * runF)); ch.turnL = (ch.turnL || 0) + (tl - (ch.turnL || 0)) * Math.min(1, dt * 6); spine.rotation.z = ch.turnL; }
  // head follows look pitch
  damp(neck, (st.lookPitch || 0) * 0.5 - lean * 0.3, -(chest.rotation.y) * 0.6, 0, k);
  if (ch.outfit && ch.outfit.cloak && !ch.cloakDangle) ch.outfit.cloak.rotation.x = 0.1 + runF * 0.6 + Math.sin(A.t * 2.2) * 0.04;
  if (ch.outfit && ch.outfit.robe) ch.outfit.robe.rotation.z = Math.sin(ph) * 0.04 * amp;
  if (ch.wingL) { const f = Math.sin(A.t * 14) * 0.6; ch.wingL.rotation.y = 0.4 + f; ch.wingR.rotation.y = -0.4 - f; }
  if (S) styleApply(ch, st, S, ph, amp, walkF, runF);
  // spin (area attacks)
  body.rotation.y = st.spin ? st.spin : 0;
  // dodge roll
  if (st.roll != null) {
    const e = clamp01(st.roll), tuck = Math.sin(Math.PI * e), rot = (e < 0.5 ? 2 * e * e : 1 - Math.pow(-2 * e + 2, 2) / 2) * Math.PI * 2;
    const a = st.rollDir || 0, flip = st.rollKind === 'flip', wheel = (st.rollKind === 'leap' || flip) && Math.abs(Math.sin(a)) > 0.6; // (a side leap is an open cartwheel, not a tucked roll)
    const h0 = (ch.R.legL + 0.06) * 0.92, hNow = flip ? h0 + tuck * (wheel ? 0.8 : 0.7) : st.rollKind === 'leap' ? h0 + tuck * (wheel ? 0.55 : 0.15) : h0 - tuck * (h0 - 0.5 * (ch.scale || 1)); // (the monk's flips go high: over-the-head somersaults and aerials)
    _rq.setFromAxisAngle(_rax.set(Math.cos(a), 0, -Math.sin(a)), rot); body.quaternion.copy(_rq);
    _rp.set(0, h0, 0).applyQuaternion(_rq); body.position.set(-_rp.x, hNow - _rp.y, -_rp.z);
    // curl up: knees to the chest, arms wrapped round them, chin down
    const tk = Math.min(1, tuck * 1.6), mix = (o, x, y, z) => { o.rotation.x += (x - o.rotation.x) * tk; o.rotation.y += (y - o.rotation.y) * tk; o.rotation.z += (z - o.rotation.z) * tk; };
    if (wheel && flip) { mix(legs.L.thigh, -0.2, 0, 1.15); mix(legs.R.thigh, 0.2, 0, -1.15); mix(legs.L.knee, 0.05, 0, 0); mix(legs.R.knee, 0.05, 0, 0); mix(arms.L.sh, -0.3, 0, -1.4); mix(arms.R.sh, -0.3, 0, 1.4); mix(arms.L.el, -0.3, 0, 0); mix(arms.R.el, -0.3, 0, 0); mix(spine, 0.1, 0, 0); mix(neck, 0, 0, 0); } // (an aerial: legs split wide, arms out, no hands)
    else if (wheel) { mix(legs.L.thigh, 0, 0, 0.7); mix(legs.R.thigh, 0, 0, -0.7); mix(legs.L.knee, 0.1, 0, 0); mix(legs.R.knee, 0.1, 0, 0); mix(arms.L.sh, 0, 0, -2.7); mix(arms.R.sh, 0, 0, 2.7); mix(arms.L.el, 0, 0, 0); mix(arms.R.el, 0, 0, 0); mix(spine, 0, 0, 0); mix(neck, 0, 0, 0); } else {
    mix(legs.L.thigh, -2.0, 0, 0.08); mix(legs.R.thigh, -2.0, 0, -0.08); mix(legs.L.knee, 2.4, 0, 0); mix(legs.R.knee, 2.4, 0, 0); mix(legs.L.ankle, 0.4, 0, 0); mix(legs.R.ankle, 0.4, 0, 0);
    mix(spine, 0.7, 0, 0); mix(neck, 0.5, 0, 0);
    if (!st.action) { mix(arms.L.sh, -1.2, 0, -0.3); mix(arms.R.sh, -1.2, 0, 0.3); mix(arms.L.el, -1.7, 0, 0); mix(arms.R.el, -1.7, 0, 0); } }
  }
  else if (!st.dead) { body.rotation.x = 0; body.position.set(0, 0, 0); }
  // death
  if (st.dead) {
    const d = clamp01((st.deadT || 0) / 0.8);
    body.rotation.x = -ease(d) * Math.PI / 2; body.position.y = d * 0.15 * ch.scale;
    damp(arms.R.sh, -2.6, 0, 0.6, k); damp(arms.L.sh, -2.6, 0, -0.6, k);
  }
  if (st.lie) { body.rotation.x = -Math.PI / 2; body.position.y = 0.12; }
  // hit flinch
  if (st.hit > 0) { spine.rotation.x -= st.hit * 0.4; }
  // relaxed: tilt a one-handed weapon in the hand so its tip points a little down
  { const m = ch.weapons && ch.weapons.main, W = ch.wt && WEAPON_TYPES[ch.wt];
    if (m && W && W.kind === 'melee' && W.hands !== 'two') { if (m.userData.rx0 == null) m.userData.rx0 = m.rotation.x; const rk = st.action || st.block ? 0 : W.hands === 'shield' ? 0.55 + 0.45 * (ch.relaxK || 0) : (ch.relaxK || 0); m.rotation.x = m.userData.rx0 + rk * 0.75; } }
  // bare fists (the monk): a guard up by the jaw, and every blow a straight punch from the shoulder, not a swing from the waist
  if (ch.wt === 'fists' && !st.dead && st.roll == null && !st.airborne && !(ch.strikeLock > 0)) { const a = st.action, punch = a && /^(swing|thrust|off|stab|heavy|fury)/.test(a);
    const guard = (sd) => { const s2 = sd === 'R' ? 1 : -1; arms[sd].sh.rotation.set(-0.95, 0, s2 * 0.32); arms[sd].el.rotation.set(-1.95, 0, 0); };
    if (punch) { const tt = clamp01(st.actionT || 0), ext = Math.sin(Math.min(1, tt / 0.75) * Math.PI), sd = st.mirror ? 'L' : 'R', od = sd === 'R' ? 'L' : 'R', s2 = sd === 'R' ? 1 : -1;
      arms[sd].sh.rotation.set(-0.95 - 0.62 * ext, s2 * 0.12 * ext, s2 * (0.32 - 0.3 * ext)); arms[sd].el.rotation.set(-1.95 * (1 - ext) - 0.05, 0, 0); guard(od); }
    else if (st.armed && !st.block) { guard('R'); guard('L'); } }
  uprightShield(ch, st);
  // casting with a staff: the arm comes up and the staff points where you are looking
  const grip = arms.R.grip;
  if (grip && grip.userData.rx0 == null) grip.userData.rx0 = grip.rotation.x;
  if (st.aimStaff) { const p = st.aimPitch || 0; damp(arms.R.sh, -1.45 - p, 0.12, 0.08, k * 2.2); damp(arms.R.el, -0.12, 0, 0, k * 2.2); if (grip) grip.rotation.x += ((grip.userData.rx0 - 1.45) - grip.rotation.x) * Math.min(1, dt * 14); }
  else if (grip && grip.userData.rx0 != null) grip.rotation.x += (grip.userData.rx0 - grip.rotation.x) * Math.min(1, dt * 10);
  if (ch.dangles || ch.jiggles) tickSecondary(ch, dt);
}

// ---------- baking: merge each joint's meshes into one vertex-coloured mesh (far fewer draw calls) ----------
const _rel = new THREE.Matrix4();
export function bake(root) {
  const rough = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0 });
  const roughS = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
  const metal = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.85 });
  const flat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
  const mats = { rough, roughS, metal, flat };
  const pivots = []; root.traverse(o => { if (!o.isMesh && !o.isLine && !o.isPoints && !o.isLight) pivots.push(o); });
  for (const pv of pivots) {
    const buckets = {};
    const collect = (node, parentMat) => {
      for (const c of [...node.children]) {
        if (!c.isMesh) continue;
        if (!c.visible) { node.remove(c); continue; } // (hidden parts, like hair under a helmet, are not baked in)
        c.updateMatrix();
        const rel = new THREE.Matrix4().multiplyMatrices(parentMat, c.matrix);
        const m = c.material;
        const special = c.userData.keep || !m.isMeshStandardMaterial || m.transparent || (m.emissive && m.emissive.getHex() !== 0 && m.emissiveIntensity > 0.2);
        if (!special) {
          const key = (m.flatShading ? 'flat' : m.metalness > 0.5 ? 'metal' : m.side === THREE.DoubleSide ? 'roughS' : 'rough') + (c.userData.detail ? 'D' : '') + (c.castShadow ? '' : 'N');
          let g = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone();
          for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
          if (!g.attributes.normal) g.computeVertexNormals();
          g.applyMatrix4(rel);
          const n = g.attributes.position.count, col = new Float32Array(n * 3);
          for (let i = 0; i < n; i++) { col[i * 3] = m.color.r; col[i * 3 + 1] = m.color.g; col[i * 3 + 2] = m.color.b; }
          g.setAttribute('color', new THREE.BufferAttribute(col, 3));
          (buckets[key] = buckets[key] || []).push(g);
          collect(c, rel);
          // re-parent any non-mesh children (pivots/markers) to the pivot so they survive
          for (const k of [...c.children]) if (!k.isMesh) { k.applyMatrix4(c.matrix); pv.add(k); }
          node.remove(c);
        } else collect(c, rel);
      }
    };
    collect(pv, new THREE.Matrix4());
    for (const key in buckets) {
      const geo = mergeGeometries(buckets[key], false); geo.computeBoundingSphere();
      const base = key.replace(/[DN]/g, '');
      const mesh = new THREE.Mesh(geo, mats[base]); mesh.castShadow = !key.includes('N'); mesh.receiveShadow = false;
      if (key.includes('D')) mesh.userData.detail = true;
      pv.add(mesh);
    }
  }
  const ch = root.userData.char;
  if (ch) { ch.details = []; root.traverse(o => { if (o.isMesh && o.userData.detail) ch.details.push(o); }); ch.detailOn = true; ch.bakedMats = mats; }
  return mats;
}

// reach: bend a shoulder (x, y, z) and elbow (x) until the hand's grip sits on a point in the world (a few cheap
// coordinate-descent passes, warm-started from the pose it already has). Used to put both hands on a raised musket.
const _ikV = new THREE.Vector3();
export function armReach(ch, side, target, passes = 4) {
  const A = ch.arms[side]; if (!A) return; const sh = A.sh, el = A.el, g = A.grip;
  const err = () => { sh.updateMatrixWorld(true); return g.getWorldPosition(_ikV).distanceToSquared(target); };
  const P = [[sh.rotation, 'x', -3.2, 1.2], [sh.rotation, 'y', -1.4, 1.4], [sh.rotation, 'z', -1.6, 1.6], [el.rotation, 'x', -2.6, 0]];
  let e = err(), step = 0.25;
  for (let it = 0; it < passes; it++, step *= 0.5) for (const [o, k, lo, hi] of P) { const v = o[k];
    o[k] = Math.min(hi, v + step); const e1 = err(); if (e1 < e) { e = e1; continue; }
    o[k] = Math.max(lo, v - step); const e2 = err(); if (e2 < e) { e = e2; continue; } o[k] = v; }
  sh.updateMatrixWorld(true); return Math.sqrt(e);
}
