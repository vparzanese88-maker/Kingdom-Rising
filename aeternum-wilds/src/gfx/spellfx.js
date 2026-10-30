// The owner's sculpted fireball: the body of every spell bolt (tinted to the spell's element), spun
// along its flight, with a white-hot counter-spinning core; on impact it blooms outward and fades.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let F = null; // { geo, tex }
export const spellModelReady = () => !!F;
export async function loadSpellModel() {
  try {
    const gl = await new GLTFLoader().loadAsync('./assets/models/c/fireball.glb');
    let src = null;
    gl.scene.traverse(o => { if (o.isMesh && !src) src = o; });
    const g = src.geometry.clone();
    const pos = g.getAttribute('position');
    // the ball sits at the centroid; the flame tail is the vertex farthest from it. Turn the tail to -z
    // (behind the direction of travel) and make the ball about 1 unit in radius.
    const c = new THREE.Vector3(), v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) c.add(v.fromBufferAttribute(pos, i));
    c.divideScalar(pos.count);
    let far = 0; const tail = new THREE.Vector3();
    const d = [];
    for (let i = 0; i < pos.count; i++) { const l = v.fromBufferAttribute(pos, i).distanceTo(c); d.push(l); if (l > far) { far = l; tail.copy(v); } }
    d.sort((a, b) => a - b);
    const r = d[Math.floor(d.length * 0.6)] || 1;
    g.translate(-c.x, -c.y, -c.z);
    tail.sub(c).normalize();
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(tail, new THREE.Vector3(0, 0, -1)));
    g.scale(1 / r, 1 / r, 1 / r);
    g.deleteAttribute('normal');
    g.computeBoundingSphere();
    const tex = src.material.map;
    if (tex) tex.colorSpace = THREE.SRGBColorSpace;
    F = { geo: g, tex };
  } catch (e) { console.warn('spell model', e); }
}

const isFireCol = c => { const col = new THREE.Color(c); return col.r > 0.75 && col.g < 0.75 && col.b < 0.45; };
const mats = new Map();
function matFor(color, core) {
  const k = color + (core ? 'c' : '');
  let m = mats.get(k);
  if (!m) {
    const fire = color == null || isFireCol(color);
    m = new THREE.MeshBasicMaterial({
      map: fire ? F.tex : null, alphaMap: fire ? null : F.tex,
      color: core ? new THREE.Color(1.6, 1.5, 1.3) : fire ? new THREE.Color(1.5, 1.15, 0.9) : new THREE.Color(color).multiplyScalar(1.8),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    });
    mats.set(k, m);
  }
  return m;
}

// a spinning fireball group for a projectile of radius `size`
export function spellBall(color, size) {
  const g = new THREE.Group();
  const outer = new THREE.Mesh(F.geo, matFor(color, false)); outer.scale.setScalar(size * 2.2); g.add(outer);
  const core = new THREE.Mesh(F.geo, matFor(color, true)); core.scale.setScalar(size * 1.05); core.rotation.z = 1.7; g.add(core);
  g.userData.spin = [outer, core]; g.userData.base = size;
  return g;
}
export function spinBall(g, dt, t) {
  const [o, c] = g.userData.spin, s = g.userData.base;
  o.rotation.z += dt * 9; c.rotation.z -= dt * 14;
  const p = 1 + Math.sin(t * 31) * 0.06 + Math.sin(t * 17) * 0.05;
  o.scale.setScalar(s * 2.2 * p); c.scale.setScalar(s * 1.05 * (2 - p));
}

// impact: the fireball blooms out to several times its size and burns away
const blooms = [];
export function spellBloom(scene, x, y, z, color, size) {
  if (!F) return;
  for (let k = 0; k < 2; k++) {
    const m = matFor(color, k === 1).clone();
    const mesh = new THREE.Mesh(F.geo, m);
    mesh.position.set(x, y, z);
    mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    scene.add(mesh);
    blooms.push({ mesh, t: 0, dur: k ? 0.22 : 0.45, s0: size * (k ? 1.4 : 2.4), s1: size * (k ? 4 : 7.5), spin: (Math.random() - 0.5) * 8 });
  }
}
export function tickSpellFx(scene, dt) {
  for (let i = blooms.length - 1; i >= 0; i--) {
    const b = blooms[i]; b.t += dt;
    const k = Math.min(1, b.t / b.dur), e = 1 - (1 - k) * (1 - k);
    b.mesh.scale.setScalar(b.s0 + (b.s1 - b.s0) * e);
    b.mesh.rotation.z += b.spin * dt;
    b.mesh.material.opacity = 1 - k * k;
    if (k >= 1) { scene.remove(b.mesh); b.mesh.material.dispose(); blooms.splice(i, 1); }
  }
}

// ---------- the owner's flame column and fire cloud: area spells erupt and explode with them ----------
const FXM = {};
export async function loadFxModels() {
  await Promise.all(['flame', 'blast'].map(async k => {
    try {
      const gl = await new GLTFLoader().loadAsync('./assets/models/c/' + k + '.glb');
      let src = null;
      gl.scene.traverse(o => { if (o.isMesh && !src) src = o; });
      const g = src.geometry.clone();
      g.computeBoundingBox();
      const b = g.boundingBox, h = b.max.y - b.min.y, w = Math.max(b.max.x - b.min.x, b.max.z - b.min.z);
      // base on the ground, centred; 1 unit wide
      g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
      g.scale(1 / w, 1 / w, 1 / w);
      g.deleteAttribute('normal');
      g.computeBoundingSphere();
      const tex = src.material.map;
      if (tex) tex.colorSpace = THREE.SRGBColorSpace;
      FXM[k] = { geo: g, tex, h: h / w };
    } catch (e) { console.warn('fx model', k, e); }
  }));
}
const fxMat = (k, color) => new THREE.MeshBasicMaterial({
  map: color == null ? FXM[k].tex : null, alphaMap: color == null ? null : FXM[k].tex,
  color: color == null ? new THREE.Color(1.5, 1.3, 1.1) : new THREE.Color(color).multiplyScalar(2),
  transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
});
const anims = [];
function addAnim(scene, mesh, dur, fn) { scene.add(mesh); anims.push({ scene, mesh, t: 0, dur, fn }); }
export function tickFxModels(dt) {
  for (let i = anims.length - 1; i >= 0; i--) {
    const a = anims[i]; a.t += dt;
    const k = Math.min(1, a.t / a.dur);
    a.fn(a.mesh, k, dt);
    if (k >= 1) { a.scene.remove(a.mesh); a.mesh.material.dispose(); anims.splice(i, 1); }
  }
}
// a column of flame shoots up out of the ground, twists and dies away (color null = its own blue-violet fire)
export function eruption(scene, x, y, z, r, color = null) {
  if (!FXM.flame) return;
  for (let j = 0; j < 2; j++) {
    const m = new THREE.Mesh(FXM.flame.geo, fxMat('flame', color));
    m.position.set(x, y - 0.1, z); m.rotation.y = Math.random() * 6.28;
    const w = r * (j ? 1.1 : 1.7), up = j ? 1.6 : 1.1, spin = (j ? -1 : 1) * (2 + Math.random() * 2);
    addAnim(scene, m, j ? 0.6 : 0.85, (o, k, dt) => {
      const rise = k < 0.25 ? 1 - Math.pow(1 - k / 0.25, 3) : 1;
      o.scale.set(w * (0.6 + 0.4 * rise), w * up * rise * (1 - 0.25 * k), w * (0.6 + 0.4 * rise));
      o.rotation.y += spin * dt;
      o.material.opacity = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
    });
  }
}
// a rolling cloud of fire and smoke blasts outward (color null = its own fire)
export function blastCloud(scene, x, y, z, r, color = null) {
  if (!FXM.blast) return;
  for (let j = 0; j < 2; j++) {
    const m = new THREE.Mesh(FXM.blast.geo, fxMat('blast', color));
    m.position.set(x, y - 0.15, z); m.rotation.y = Math.random() * 6.28;
    const w0 = r * 0.5, w1 = r * (j ? 1.6 : 2.3), spin = (Math.random() - 0.5) * 1.5;
    addAnim(scene, m, j ? 0.45 : 0.75, (o, k, dt) => {
      const e = 1 - Math.pow(1 - k, 3), w = w0 + (w1 - w0) * e;
      o.scale.set(w, w * (0.8 + 0.5 * e), w);
      o.rotation.y += spin * dt;
      o.material.opacity = 1 - k * k;
    });
  }
}
