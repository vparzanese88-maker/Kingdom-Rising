// The owner's Meshy weapon models. Each is loaded the first time something needs it (so the game
// only downloads the weapons actually seen) and oriented to the weapon contract used by makeWeapon:
// grip at the origin, business end along +y.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const BASE = './assets/models/w/';
const PI = Math.PI;
// file, rotations applied in order (rz, ry), then the grip offset; tint = [color, emissive]
export const WEAPON_MODELS = {
  gothic: { file: 'gothic', rz: PI, ry: PI / 2, off: [0, 0.33, 0], name: 'Gothic Greatsword' },
  gothicBoss: { file: 'gothic', rz: PI, ry: PI / 2, off: [0, 0.33, 0], name: 'Warden\'s Blade', tint: [0xff9a8a, 0x3a0600] },
  gothic2: { file: 'gothic2', rz: PI, ry: PI / 2, off: [0, 0.33, 0], name: 'Cathedral Blade' },
  longsword: { file: 'longsword', rz: PI, ry: PI / 2, off: [0, 0.33, 0], name: 'Crusader Longsword', tint: [0xfff2d8, 0x0a0800] },
  knightsword: { file: 'knightsword', rz: PI, ry: PI / 2, off: [0, 0.33, 0], name: 'Knight\'s Sword', tint: [0xdce8ff, 0x000408] },
  rapier: { file: 'rapier', rz: PI, ry: PI / 2, off: [0, 0.33, 0], name: 'Duelist\'s Rapier' },
  warhammer: { file: 'warhammer', ry: PI / 2, off: [0, 0.3, 0], name: 'Gothic War Hammer' },
  hatchetBearded: { file: 'hatchet-bearded', ry: PI / 2, off: [0, 0.3, 0], name: 'Bearded Hatchet' },
  hatchetWrapped: { file: 'hatchet-wrapped', ry: PI / 2, off: [0, 0.3, 0], name: 'Wrapped Hatchet' },
  axeGothic: { file: 'axe-gothic', ry: PI / 2, off: [0, 0.3, 0], name: 'Gothic Great Axe' },
  axeDread: { file: 'axe-dread', ry: PI / 2, off: [0, 0.3, 0], name: 'Dread Axe', tint: [0xd8c8d8, 0x12000a] },
  axeBerserk: { file: 'axe-gothic', ry: PI / 2, off: [0, 0.3, 0], name: 'Bloodreaver Great Axe', tint: [0xffc8b8, 0x1a0200] },
  spearWinged: { file: 'spear-winged', ry: PI / 2, off: [0, 0.15, 0], name: 'Winged Spear' },
  spearDragon: { file: 'spear-dragon', ry: PI / 2, off: [0, 0.15, 0], name: 'Dragon Spear' },
  mace: { file: 'mace', off: [0, 0.3, 0], name: 'Flanged Mace' },
  staffBone: { file: 'staff-bone', off: [0, 0.2, 0], name: 'Bone Staff', tint: [0xc8d8c0, 0x041004] },
  staffSpire: { file: 'staff-spire', off: [0, 0.2, 0], name: 'Spire Staff', tint: [0xd0dcff, 0x060a20] },
  staffEmber: { file: 'staff-bone', off: [0, 0.2, 0], name: 'Ember Staff', tint: [0xffb890, 0x281000] },
  staffArcane: { file: 'staff-spire', off: [0, 0.2, 0], name: 'Arcane Staff', tint: [0xe0b8ff, 0x1a0628] },
  bow: { file: 'bow', ry: PI / 2, off: [0, 0, 0], name: 'Recurve Bow' },
  crossbow: { file: 'crossbow', off: [0, 0.15, 0], name: 'Crossbow' },
  blunderbuss: { file: 'blunderbuss', rz: -PI / 2, off: [0.25, 0.3, 0], name: 'Bell-mouth Blunderbuss' },
};
// the model a dropped or crafted weapon gets, per type and tier
export const TIER_MODELS = {
  sword: ['gothic', 'longsword', 'gothic2'],
  greataxe: ['axeGothic', 'axeDread', 'axeBerserk'],
  hatchets: ['hatchetWrapped', 'hatchetBearded', 'hatchetBearded'],
  hammer: ['warhammer', 'warhammer', 'warhammer'],
  spear: ['spearWinged', 'spearWinged', 'spearDragon'],
  club: ['mace', 'mace', 'mace'],
  rapier: ['rapier', 'rapier', 'rapier'],
  staff: ['staffEmber', 'staffSpire', 'staffArcane'],
  bow: ['bow', 'bow', 'bow'],
  crossbow: ['crossbow', 'crossbow', 'crossbow'],
  blunderbuss: ['blunderbuss', 'blunderbuss', 'blunderbuss'],
};
// tier tints on top of the model's own paint: steel, blue starmetal, gold orichalcum
const TIER_TINT = { 1: [0xffffff, 0], 2: [0xc4d8ff, 0x050a18], 3: [0xffdc96, 0x281800] };

const geo = {}, loading = {}, mats = {};
const listeners = new Set();
export const onWeaponModel = fn => listeners.add(fn);
function load(file) {
  if (loading[file]) return;
  loading[file] = new GLTFLoader().loadAsync(BASE + file + '.glb').then(gl => {
    let src = null;
    gl.scene.traverse(o => { if (o.isMesh && !src) src = o; });
    const nrm = src.geometry.getAttribute('normal');
    if (nrm) for (let i = 0; i < nrm.count; i++) {
      const x = nrm.getX(i), y = nrm.getY(i), z = nrm.getZ(i), l = Math.hypot(x, y, z);
      if (!(l > 1e-4)) nrm.setXYZ(i, 0, 1, 0); else if (Math.abs(l - 1) > 1e-3) nrm.setXYZ(i, x / l, y / l, z / l);
    }
    const m = src.material;
    for (const t of [m.map, m.normalMap, m.metalnessMap]) if (t) t.anisotropy = 8;
    geo[file] = { g: src.geometry, mat: m, byKey: {} };
    for (const fn of listeners) fn(file);
  }).catch(e => console.warn('weapon model', file, e));
}
// a mesh for model key at a tier, or null while it is still downloading (it starts the download)
export function weaponModelMesh(key, tier = 1) {
  const M = WEAPON_MODELS[key];
  if (!M) return null;
  const G = geo[M.file];
  if (!G) { load(M.file); return null; }
  let g = G.byKey[key];
  if (!g) {
    g = G.byKey[key] = G.g.clone();
    if (M.rz) g.rotateZ(M.rz);
    if (M.ry) g.rotateY(M.ry);
    g.translate(...M.off);
    g.computeBoundingSphere();
  }
  const mk = key + ':' + tier;
  let m = mats[mk];
  if (!m) {
    m = mats[mk] = G.mat.clone();
    const [c, e] = TIER_TINT[tier] || TIER_TINT[1];
    m.color.setHex(c); m.emissive.setHex(e);
    if (M.tint) { m.color.multiply(new THREE.Color(M.tint[0])); m.emissive.add(new THREE.Color(M.tint[1])); }
  }
  const mesh = new THREE.Mesh(g, m);
  mesh.castShadow = true;
  return mesh;
}
export const modelFor = (type, tier, model) => model === 'builtin' ? null : (model && WEAPON_MODELS[model]) ? model : TIER_MODELS[type]?.[Math.min(3, Math.max(1, tier || 1)) - 1];
