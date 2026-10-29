// Aeternum Wilds — renders inventory icons from the real 3D item models (after Kingdom Rising 3D's items3d.js):
// an offscreen WebGL renderer, a photo-studio environment to reflect in, key / rim / fill lights, a framing camera
// and a soft pale halo so dark items read on dark slots.
// The game does not run this: reading pixels back from WebGL stalls (and under software GL it crashed the page), so
// every icon is baked ahead of time to src/gfx/items/icons/<key>.webp by tools/bake-icons.html and the game just
// shows those files (see icons.js). Re-bake after changing a model:  open tools/bake-icons.html and run its bake.
import * as THREE from 'three';
import { buildWeapon } from './weapons.js';
import { buildArmor } from './armor.js';
import { buildMatModel, MAT_MODEL_IDS } from './matmodels.js';
import { gearIconKey, matIconKey } from './icons.js';

export const ICON_SIZE = 128;
let rr = null, scene = null, cam = null, holder = null;

// a photo studio to reflect in: a warm softbox above, a cool one to the side, a soft front light, a dim floor
function studioEnv(renderer) {
  const s = new THREE.Scene();
  const g = new THREE.SphereGeometry(10, 32, 16); const col = []; const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 10; const c = new THREE.Color(0.12, 0.11, 0.1).lerp(new THREE.Color(0.62, 0.58, 0.52), Math.max(0, y) ** 0.7); col.push(c.r, c.g, c.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  s.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const box = (w, h, x, y, z, c, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m); };
  box(8, 4, 2, 8, 4, '#fff1dc', 3); box(3, 6, -8, 2, -2, '#a8c8ff', 2.2); box(5, 3, 5, 2, 7, '#ffd8a8', 1.6); box(7, 2.5, -3, 3.5, 8, '#f4f0ff', 1.3); box(12, 3.2, 1, 0.6, 9, '#fff8ee', 0.9); box(9, 1.6, 0, -2.5, 8, '#ffffff', 0.7);
  const pm = new THREE.PMREMGenerator(renderer); const rt = pm.fromScene(s, 0.035); pm.dispose();
  return rt.texture;
}
function setup() {
  const cv = document.createElement('canvas'); cv.width = cv.height = ICON_SIZE * 2;
  rr = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
  rr.setPixelRatio(1); rr.setSize(ICON_SIZE * 2, ICON_SIZE * 2, false);
  rr.outputColorSpace = THREE.SRGBColorSpace; rr.toneMapping = THREE.ACESFilmicToneMapping; rr.toneMappingExposure = 1.4; rr.setClearColor(0x000000, 0);
  scene = new THREE.Scene(); cam = new THREE.PerspectiveCamera(22, 1, 0.05, 20);
  scene.environment = studioEnv(rr);
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x2a2018, 1.6));
  const key = new THREE.DirectionalLight(0xffeedd, 2.6); key.position.set(1.5, 2.5, 3); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9ac0ff, 2.0); rim.position.set(-2.5, 1.2, -1.5); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffc890, 0.7); fill.position.set(-2, -1, 2); scene.add(fill);
  holder = new THREE.Group(); scene.add(holder);
}

// display poses: [rx, ry, rz] applied to the model (order ZYX), and a framing factor
const POSE = {
  blade: [0.0, 0.42, -Math.PI / 4, 1.04], // swords: flat toward the camera, point up-right
  haft: [0.0, -Math.PI / 2 + 0.3, -Math.PI / 4, 1.06], // axes, hammers: head profile toward the camera
  staff: [0.0, 0.5, -Math.PI / 4, 1.04],
  bow: [0.0, Math.PI / 2 + 0.25, -Math.PI / 4, 1.0],
  shield: [0.12, -0.4, 0, 1.08],
  face: [0.18, -0.42, 0, 1.08],
  stand: [0.42, -0.55, 0, 1.12],
};
const WPOSE = { sword: 'blade', cutlass: 'blade', greatsword: 'blade', greataxe: 'haft', hammer: 'haft', club: 'staff', staff: 'staff', bow: 'bow', shield: 'shield' };

// the render, scaled down (smooth edges), drawn twice: a soft pale silhouette first, then the item on top
let outCv = null;
function haloed(src) {
  if (!outCv) { outCv = document.createElement('canvas'); outCv.width = outCv.height = ICON_SIZE; }
  const g = outCv.getContext('2d'); g.clearRect(0, 0, ICON_SIZE, ICON_SIZE); g.imageSmoothingQuality = 'high';
  g.save(); g.shadowColor = 'rgba(255,236,200,0.7)'; g.shadowBlur = 6; g.drawImage(src, 0, 0, ICON_SIZE, ICON_SIZE); g.shadowBlur = 2; g.shadowColor = 'rgba(255,245,225,0.45)'; g.drawImage(src, 0, 0, ICON_SIZE, ICON_SIZE); g.restore();
  return outCv;
}
// desc: { kind: 'weapon', wtype, tier, rarity } | { kind: 'armor', slot, wclass, tier, rarity } | { kind: 'mat', id }
function model(d) {
  if (d.kind === 'weapon') return { group: buildWeapon(d.wtype, d.tier, { rarity: d.rarity, ctx: 'icon', raw: true }), pose: WPOSE[d.wtype] || 'blade' };
  if (d.kind === 'armor') return { group: buildArmor(d.slot, d.wclass, d.tier, { rarity: d.rarity, ctx: 'icon' }), pose: d.slot === 'feet' ? 'stand' : 'face' };
  const g = buildMatModel(d.id, 'icon'); return g ? { group: g, pose: /potion/.test(d.id) ? 'face' : 'stand' } : null;
}
// render one icon; returns a canvas (ICON_SIZE square) or null
export function renderIcon(d) {
  if (!rr) setup();
  const r = model(d); if (!r || !r.group) return null;
  const { group, pose } = r; const [rx, ry, rz, fit] = POSE[pose] || POSE.face;
  holder.clear(); holder.add(group);
  group.rotation.set(rx, ry, rz, 'ZYX'); group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group, true); const c = box.getCenter(new THREE.Vector3()); const sz = box.getSize(new THREE.Vector3());
  group.position.sub(c);
  const rad = Math.max(sz.x, sz.y) * 0.5 * fit; const dist = rad / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) + sz.z * 0.5;
  cam.position.set(0, 0, dist); cam.lookAt(0, 0, 0); cam.near = Math.max(0.01, dist - sz.z * 2); cam.far = dist + sz.z * 2 + 1; cam.updateProjectionMatrix();
  rr.render(scene, cam);
  holder.clear();
  return haloed(rr.domElement);
}
// every icon the game can ask for, with its file key
export function allIconDescs() {
  const list = [];
  for (const wtype of ['sword', 'greataxe', 'hammer', 'staff', 'bow']) for (let tier = 1; tier <= 3; tier++) for (let rarity = 0; rarity <= 4; rarity++) list.push({ kind: 'weapon', wtype, tier, rarity });
  for (const slot of ['head', 'chest', 'hands', 'legs', 'feet']) for (const wclass of ['light', 'medium', 'heavy']) for (let tier = 1; tier <= 3; tier++) for (let rarity = 0; rarity <= 4; rarity++) list.push({ kind: 'armor', slot, wclass, tier, rarity });
  for (let tier = 1; tier <= 3; tier++) for (let rarity = 0; rarity <= 4; rarity++) list.push({ kind: 'armor', slot: 'amulet', tier, rarity });
  for (const id of MAT_MODEL_IDS) list.push({ kind: 'mat', id });
  return list.map((d) => ({ ...d, key: d.kind === 'mat' ? matIconKey(d.id) : gearIconKey(d) }));
}
