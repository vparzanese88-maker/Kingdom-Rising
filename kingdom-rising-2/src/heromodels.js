// Hero models: real 3D characters (made in Meshy, rigged and animated) that replace the shape-built body for a class.
// The built body keeps running underneath, invisible, so weapons, hit boxes and effects work as before; the model is
// placed on the same spot, plays idle / walk / run by speed, and the class's hand items move onto its real hands.
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const MODELS = {
  necromancer: { base: 'models/necro_rig.fbx', clips: { walk: 'models/necro_walk.fbx', run: 'models/necro_run.fbx' }, height: 1.95, walkSpeed: 1.6, runSpeed: 5.5 },
};
export const hasHeroModel = (cls) => !!MODELS[cls] && !/[?&]nomodels/.test(location.search);

const cache = {}; const loader = new FBXLoader();
const loadFbx = (url) => new Promise((res, rej) => loader.load(url, res, undefined, rej));
// one load per class: the rigged character and its animation clips (root motion stripped so it runs on the spot)
function loadClass(cls) {
  if (cache[cls]) return cache[cls]; const D = MODELS[cls];
  cache[cls] = (async () => {
    const base = await loadFbx(D.base); const clips = {};
    await Promise.all(Object.entries(D.clips).map(async ([k, url]) => { const o = await loadFbx(url); const c = o.animations[0]; if (!c) return;
      c.tracks = c.tracks.filter(t => !/Hips\.position$/.test(t.name) || (keepHipY(t), true)); clips[k] = c; }));
    base.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; const m = o.material; if (m && m.map) { m.map.colorSpace = THREE.SRGBColorSpace; m.map.anisotropy = 4; } if (m) { m.color && m.color.set('#ffffff'); m.shininess = 6; } } });
    return { base, clips };
  })();
  return cache[cls];
}
// keep the hips bobbing up and down but not travelling forward or sideways
function keepHipY(track) { const v = track.values; if (!v || v.length < 3) return; const x0 = v[0], z0 = v[2]; for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; } }

// swap the built body for the class's model. ch: the humanoid from buildHumanoid. Safe to call before it has loaded.
export function attachHeroModel(ch, cls) {
  if (!ch || !hasHeroModel(cls) || ch.heroModel) return; ch.heroModel = 'loading'; const D = MODELS[cls];
  loadClass(cls).then(({ base, clips }) => {
    if (!ch.root) return;
    const m = SkeletonUtils.clone(base); m.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3()); const k = (D.height * (ch.scale || 1)) / Math.max(0.01, size.y);
    const wrap = new THREE.Group(); wrap.add(m); m.scale.multiplyScalar(k); m.position.y = -box.min.y * k; ch.root.add(wrap);
    // hide the built body's skin and clothes; its weapons and hand items move onto the model's hands
    const keep = new Set(); const hands = {}; m.traverse(o => { if (o.isBone && /^LeftHand$/.test(o.name)) hands.L = o; if (o.isBone && /^RightHand$/.test(o.name)) hands.R = o; });
    for (const sd of ['L', 'R']) { const g = ch.arms && ch.arms[sd] && ch.arms[sd].grip; if (!g || !hands[sd]) continue; const socket = new THREE.Group(); socket.scale.setScalar(1 / k); hands[sd].add(socket); for (const c of [...g.children]) { socket.add(c); keep.add(c); } ch.arms[sd].grip = socket; }
    ch.body.traverse(o => { if ((o.isMesh || o.isLine) && !isUnder(o, keep)) o.visible = false; });
    const mixer = new THREE.AnimationMixer(m), act = {}; for (const kk in clips) { act[kk] = mixer.clipAction(clips[kk]); act[kk].play(); act[kk].setEffectiveWeight(0); }
    ch.heroModel = { m, wrap, mixer, act, D, w: { idle: 1, walk: 0, run: 0 }, lp: ch.root.position.clone(), v: 0 };
  }).catch(e => { console.warn('hero model', cls, e); ch.heroModel = null; });
}
const isUnder = (o, set) => { for (let p = o; p; p = p.parent) if (set.has(p)) return true; return false; };

// every frame: pick the animation from how fast the character is moving and blend between them
export function tickHeroModel(ch, dt) {
  const H = ch && ch.heroModel; if (!H || H === 'loading' || dt <= 0) return;
  const p = ch.root.position, sp = Math.hypot(p.x - H.lp.x, p.z - H.lp.z) / dt; H.lp.copy(p); H.v += (Math.min(sp, 12) - H.v) * Math.min(1, dt * 8);
  const walkW = H.v < 0.25 ? 0 : H.v < H.D.runSpeed * 0.6 ? 1 : Math.max(0, 1 - (H.v - H.D.runSpeed * 0.6) / (H.D.runSpeed * 0.4)), runW = H.v < H.D.runSpeed * 0.6 ? 0 : 1 - walkW, idleW = 1 - Math.min(1, H.v / 0.25);
  const lerpW = (k, t) => { H.w[k] += (t - H.w[k]) * Math.min(1, dt * 10); };
  lerpW('walk', walkW * (1 - idleW)); lerpW('run', runW * (1 - idleW)); lerpW('idle', idleW);
  if (H.act.walk) { H.act.walk.setEffectiveWeight(H.w.walk + H.w.idle); H.act.walk.timeScale = H.w.idle > 0.9 ? 0.0001 : Math.max(0.6, H.v / H.D.walkSpeed); } // (standing still: the walk held on its first frame)
  if (H.act.run) { H.act.run.setEffectiveWeight(H.w.run); H.act.run.timeScale = Math.max(0.7, H.v / H.D.runSpeed); }
  H.mixer.update(dt);
  // the built body's lean and turn follow the model's facing: keep the model upright on the root
  H.wrap.rotation.set(0, ch.body.rotation.y || 0, 0);
}
