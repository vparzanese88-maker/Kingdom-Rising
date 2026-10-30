// Player-supplied models (made with Meshy, converted by assets/models/*.py|cjs):
//  - the barbarian hero: a textured mesh auto-rigged to a 15-bone skeleton whose bones double as the
//    animation "parts" (hips, upper, head, armR/L, legR/L) that anim.js already drives
//  - the double-bladed great axe
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const BASE = './assets/models/';
const A = { hero: null, axe: null, sword: null };
export const swordReady = () => !!A.sword;
export const meshyReady = () => !!A.hero;
export const axeReady = () => !!A.axe;

function typed(buf, start, blk) {
  const C = { float32: Float32Array, int8: Int8Array, uint8: Uint8Array, uint16: Uint16Array, uint32: Uint32Array }[blk.dtype];
  return new C(buf, start + blk.offset, blk.bytes / C.BYTES_PER_ELEMENT);
}

async function loadHero() {
  const buf = await (await fetch(BASE + 'hero.bin')).arrayBuffer();
  const dv = new DataView(buf);
  if (new TextDecoder().decode(new Uint8Array(buf, 0, 4)) !== 'HRO1') throw new Error('hero.bin');
  const ml = dv.getUint32(4, true);
  const meta = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, ml)));
  const start = 8 + ml;
  const B = Object.fromEntries(meta.blocks.map(b => [b.name, typed(buf, start, b)]));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(B.position, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(B.normal, 3, true));
  g.setAttribute('uv', new THREE.BufferAttribute(B.uv, 2));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(B.skinIndex, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(B.skinWeight, 4, true));
  g.setIndex(new THREE.BufferAttribute(B.index, 1));
  g.computeBoundingSphere();
  const tl = new THREE.TextureLoader();
  const [map, mr] = await Promise.all([tl.loadAsync(BASE + 'hero.jpg'), tl.loadAsync(BASE + 'hero-mr.jpg')]);
  for (const t of [map, mr]) { t.flipY = false; t.anisotropy = 8; }
  map.colorSpace = THREE.SRGBColorSpace;
  A.hero = { g, meta, map, mr };
}

async function loadAxe() {
  const buf = await (await fetch(BASE + 'greataxe.bin')).arrayBuffer();
  const dv = new DataView(buf);
  const nv = dv.getUint32(4, true), ni = dv.getUint32(8, true), isz = dv.getUint32(12, true);
  let o = 16;
  const pos = new Float32Array(buf, o, nv * 3); o += nv * 12;
  const nor = new Int8Array(buf, o, nv * 4); o += nv * 4;
  const col = new Uint8Array(buf, o, nv * 4); o += nv * 4;
  const idx = isz === 2 ? new Uint16Array(buf, o, ni) : new Uint32Array(buf, o, ni);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 4, true));
  g.setAttribute('color', new THREE.BufferAttribute(col, 4, true));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  // model space: haft along y (-0.95..0.95), blades along x. Grip at the lower wrap, blades facing forward.
  const s = 0.8;
  g.scale(s, s, s);
  g.rotateY(Math.PI / 2);
  g.translate(0, 0.5, 0);
  g.computeBoundingSphere();
  A.axe = { g, mats: {} };
}

// the gothic greatsword: textured, with metal/roughness and normal maps
async function loadSword() {
  const gl = await new GLTFLoader().loadAsync(BASE + 'greatsword.glb');
  let src = null;
  gl.scene.traverse(o => { if (o.isMesh && !src) src = o; });
  const g = src.geometry.clone();
  // model space: hilt up, blade down along -y, grip around y = 0.33. Make the blade point +y from a grip at the origin.
  g.rotateZ(Math.PI);
  g.translate(0, 0.33, 0);
  g.scale(1.05, 1.05, 1.05);
  g.computeBoundingSphere();
  const m = src.material;
  for (const t of [m.map, m.normalMap, m.metalnessMap]) if (t) t.anisotropy = 8;
  A.sword = { g, base: m, mats: {} };
}

// load everything; never throws (the game falls back to the built-in models)
export async function loadMeshy() {
  await Promise.all([loadHero().catch(e => console.warn('hero model', e)), loadAxe().catch(e => console.warn('axe model', e)), loadSword().catch(e => console.warn('sword model', e))]);
}

// sword per tier: dark steel, blue starmetal, gold orichalcum; 'boss' is the Warden's corrupted blade
const SWORD_TINT = { 1: [0xffffff, 0x000000], 2: [0xc4d8ff, 0x050a18], 3: [0xffdc96, 0x281800], boss: [0xff9a8a, 0x3a0600] };
export function swordMesh(tier = 1) {
  const k = SWORD_TINT[tier] ? tier : 1;
  let m = A.sword.mats[k];
  if (!m) { m = A.sword.mats[k] = A.sword.base.clone(); m.color.setHex(SWORD_TINT[k][0]); m.emissive.setHex(SWORD_TINT[k][1]); }
  const mesh = new THREE.Mesh(A.sword.g, m);
  mesh.castShadow = true;
  return mesh;
}

// ---------- the great axe ----------
const AXE_TINT = [0xffffff, 0xbcd4ff, 0xffd98a];
export function axeMesh(tier = 1) {
  const t = Math.min(3, Math.max(1, tier));
  let m = A.axe.mats[t];
  if (!m) m = A.axe.mats[t] = new THREE.MeshStandardMaterial({ vertexColors: true, color: AXE_TINT[t - 1], roughness: 0.42, metalness: 0.55, emissive: t === 3 ? 0x2a1800 : 0x000000 });
  const mesh = new THREE.Mesh(A.axe.g, m);
  mesh.castShadow = true;
  return mesh;
}

// ---------- the barbarian hero ----------
// Returns the same shape as makeHumanoid: { root, body, mats, parts, size, hunched }
export function makeHero(o = {}) {
  const H = A.hero, J = H.meta.joints;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const mat = new THREE.MeshStandardMaterial({ map: H.map, roughnessMap: H.mr, metalnessMap: H.mr, roughness: 1, metalness: 1, side: THREE.DoubleSide });
  // bones at the joints; the arms are bound slightly lowered from the model's A-pose so that when the
  // animation zeroes their rotation they hang naturally at the sides
  const bones = {};
  for (const name of H.meta.bones) { const b = new THREE.Bone(); b.name = name; bones[name] = b; }
  for (const name of H.meta.bones) { const p = H.meta.parents[name]; if (p) bones[p].add(bones[name]); }
  body.add(bones.hips);
  const lower = 0.4;
  bones.armR.rotation.z = -lower; bones.armL.rotation.z = lower;
  const v = new THREE.Vector3();
  for (const name of H.meta.bones) {
    const b = bones[name], p = H.meta.parents[name];
    v.set(...J[name]);
    if (p) { bones[p].updateMatrixWorld(true); body.updateMatrixWorld(true); bones[p].worldToLocal(body.localToWorld(v)); }
    b.position.copy(v);
    b.updateMatrixWorld(true);
  }
  const mesh = new THREE.SkinnedMesh(H.g, mat);
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  body.add(mesh);
  root.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(H.meta.bones.map(n => bones[n])));
  // weapon sockets in the palms, oriented like the built-in humanoid's hands (arm hanging down = identity)
  const mkHand = (bone, side) => { const h = new THREE.Group(); h.position.set(side * 0.01, -0.07, 0.03); bone.add(h); return h; };
  // the hand bones inherit the arm's bind tilt; counter it so weapons point forward when the arm hangs down
  const handR = mkHand(bones.handR, -1), handL = mkHand(bones.handL, 1);
  const hair = new THREE.Group(); bones.head.add(hair);
  const s = (o.size || 1) * (o.height || 1);
  body.scale.set((o.size || 1) * (o.build || 1), s, (o.size || 1) * (o.build || 1));
  // dummy materials stand in for clothes colours (this model keeps its own painted outfit)
  const dummy = () => new THREE.MeshLambertMaterial();
  return {
    root, body, mats: [mat, dummy(), dummy(), dummy(), dummy()],
    parts: { hips: bones.hips, upper: bones.upper, head: bones.head, hair, armR: bones.armR, armL: bones.armL, handR, handL, legR: bones.legR, legL: bones.legL },
    size: s, hunched: false, hero: true,
  };
}
