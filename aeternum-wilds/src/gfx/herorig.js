// The barbarian hero rigged in Meshy (24-bone skeleton) with the owner's Running and Walking animations.
// Locomotion comes from the animation clips; attacks, blocks, casts and the other combat poses from anim.js
// take over the arms and torso on top of them (anim.js still writes its usual "parts", which here are
// plain proxy objects that this controller reads and converts into bone rotations).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const BASE = './assets/models/';
let R = null; // { scene, clips: { run, walk } }
export const heroRigReady = () => !!R;

export async function loadHeroRig() {
  try {
    const loader = new GLTFLoader();
    const [run, walk] = await Promise.all([loader.loadAsync(BASE + 'hero-run.glb'), loader.loadAsync(BASE + 'hero-walk.glb')]);
    const clean = clip => {
      // drop scale tracks and all position tracks except the hips' height (no drifting in place)
      clip.tracks = clip.tracks.filter(t => !t.name.endsWith('.scale') && (!t.name.endsWith('.position') || t.name.startsWith('Hips.')));
      for (const t of clip.tracks) if (t.name === 'Hips.position') { const v = t.values, x0 = v[0], z0 = v[2]; for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; } }
      return clip;
    };
    R = { scene: run.scene, clips: { run: clean(run.animations[0]), walk: clean(walk.animations[0]) } };
    R.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; const m = o.material; if (m.map) m.map.anisotropy = 8; } });
  } catch (e) { console.warn('hero rig', e); R = null; }
}

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _m = new THREE.Matrix4();

// rotation of an object relative to the character's body group
function bodyQuat(obj, body, out) { body.getWorldQuaternion(_qb).invert(); obj.getWorldQuaternion(out); return out.premultiply(_qb); }
function bodyPos(obj, body, out) { obj.getWorldPosition(out); return body.worldToLocal(out); }
// set a bone so that its rotation relative to the body equals q (blended by w)
function setBodyQuat(bone, body, q, w) {
  bodyQuat(bone.parent, body, _q2).invert();
  const local = _q2.multiply(q);
  if (w >= 1) bone.quaternion.copy(local); else bone.quaternion.slerp(local, w);
}

export function makeRiggedHero(o = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const model = SkeletonUtils.clone(R.scene);
  body.add(model);
  const bones = {};
  let skinMesh = null;
  model.traverse(n => { if (n.isBone) bones[n.name] = n; if (n.isSkinnedMesh) skinMesh = n; });
  // each hero gets its own material so hit flashes don't light up every copy
  skinMesh.material = skinMesh.material.clone();
  const mat = skinMesh.material;
  // a big, heroic frame: taller than the townsfolk; height, weight and muscle sliders shape him
  // a big, heroic frame. Height scales him evenly (gently, so he never looks stretched);
  // weight and muscle reshape the body below the neck only (see the girth pass below)
  const BIG = 1.3;
  const s = (o.size || 1) * BIG * (1 + ((o.height || 1) - 1) * 0.9);
  body.scale.setScalar(s);
  root.updateMatrixWorld(true);

  // ---- bind-pose measurements ----
  const bind = {};
  for (const n in bones) bind[n] = bones[n].quaternion.clone();
  // arms hanging at the sides: rotate each upper arm from its bind direction to straight down (a hair outward)
  const hang = {};
  for (const [side, sx] of [['Left', 1], ['Right', -1]]) {
    const arm = bones[side + 'Arm'], fore = bones[side + 'ForeArm'];
    const a = bodyPos(arm, body, new THREE.Vector3()), f = bodyPos(fore, body, new THREE.Vector3());
    const dir = f.sub(a).normalize();
    const fix = new THREE.Quaternion().setFromUnitVectors(dir, new THREE.Vector3(sx * 0.1, -1, 0.04).normalize());
    hang[side] = fix.multiply(bodyQuat(arm, body, new THREE.Quaternion()));
  }
  // weapon sockets in the palms. They are children of the body (not the hand bone) and follow the hand's
  // position and rotation every frame, so weapons never inherit the arm's girth scaling and stay undistorted.
  const sockets = {}, sockInfo = {};
  for (const side of ['Left', 'Right']) {
    setBodyQuat(bones[side + 'Arm'], body, hang[side], 1);
    model.updateMatrixWorld(true);
    const hand = bones[side + 'Hand'];
    const hq = bodyQuat(hand, body, new THREE.Quaternion());
    const hp = bodyPos(hand, body, new THREE.Vector3());
    // in the hanging pose the socket matches the body's orientation; palm a little below the wrist, slightly forward
    const off = new THREE.Vector3(0, -0.075 / BIG, 0.025 / BIG).applyQuaternion(hq.clone().invert());
    sockInfo[side] = { hand, offQ: hq.clone().invert(), off };
    const sock = new THREE.Group();
    body.add(sock);
    sock.position.copy(hp).add(new THREE.Vector3(0, -0.075 / BIG, 0.025 / BIG));
    sockets[side] = sock;
    bones[side + 'Arm'].quaternion.copy(bind[side + 'Arm']);
  }
  // a socket on the upper back (follows the chest bone) for the weapon not in use
  const chest = bones.Spine02;
  model.updateMatrixWorld(true);
  const backQ0 = bodyQuat(chest, body, new THREE.Quaternion()).invert();
  const backSock = new THREE.Group(); body.add(backSock);
  const _hp = new THREE.Vector3(), _hq = new THREE.Quaternion(), _hs = new THREE.Vector3(), _bq = new THREE.Quaternion();
  function updateSockets() {
    body.updateMatrixWorld(true);
    body.getWorldQuaternion(_bq).invert();
    for (const side of ['Left', 'Right']) {
      const I = sockInfo[side], sock = sockets[side];
      I.hand.matrixWorld.decompose(_hp, _hq, _hs);
      body.worldToLocal(_hp);
      _hq.premultiply(_bq); // hand rotation in body space
      sock.position.copy(I.off).applyQuaternion(_hq).add(_hp);
      sock.quaternion.copy(_hq).multiply(I.offQ);
    }
    chest.matrixWorld.decompose(_hp, _hq, _hs);
    body.worldToLocal(_hp);
    _hq.premultiply(_bq);
    backSock.position.copy(_hp);
    backSock.quaternion.copy(_hq).multiply(backQ0);
  }
  model.updateMatrixWorld(true);

  // girth: each bone is thickened across (never along) its length; children are compensated for their
  // parent so nothing compounds, and the neck, head, hands and feet always keep their natural shape
  {
    const clampK = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const wd = (o.build || 1) - 1, md = (o.muscle || 1) - 1;
    const torso = clampK(1 + wd * 0.45 + md * 0.2, 0.9, 1.18), arm = clampK(1 + md * 0.5 + wd * 0.15, 0.86, 1.2), leg = clampK(1 + wd * 0.25 + md * 0.25, 0.9, 1.15);
    const K = { Hips: clampK(1 + wd * 0.3, 0.92, 1.12), Spine02: torso, Spine01: torso, Spine: torso * 0.97 + 0.03,
      LeftShoulder: arm * 0.5 + 0.5, RightShoulder: arm * 0.5 + 0.5, LeftArm: arm, RightArm: arm, LeftForeArm: arm * 0.85 + 0.15, RightForeArm: arm * 0.85 + 0.15,
      LeftUpLeg: leg, RightUpLeg: leg, LeftLeg: leg * 0.8 + 0.2, RightLeg: leg * 0.8 + 0.2 };
    const want = new Map();
    const crossScale = (b, k) => { const c = b.children.find(x => x.isBone); const d = c ? c.position : new THREE.Vector3(0, 1, 0); const ax = [Math.abs(d.x), Math.abs(d.y), Math.abs(d.z)]; const along = ax.indexOf(Math.max(...ax)); const v = new THREE.Vector3(k, k, k); v.setComponent(along, 1); return v; };
    const visit = (b, parentWant) => {
      const w = crossScale(b, K[b.name] ?? 1);
      want.set(b, w);
      b.scale.set(w.x / parentWant.x, w.y / parentWant.y, w.z / parentWant.z);
      for (const c of b.children) if (c.isBone) visit(c, w);
    };
    if (wd || md) visit(bones.Hips, new THREE.Vector3(1, 1, 1));
  }

  model.updateMatrixWorld(true);
  updateSockets();

  // ---- animation ----
  const mixer = new THREE.AnimationMixer(model);
  const run = mixer.clipAction(R.clips.run), walk = mixer.clipAction(R.clips.walk);
  const idle = mixer.clipAction(R.clips.walk.clone());
  for (const a of [run, walk, idle]) { a.play(); a.setEffectiveWeight(0); }
  idle.time = 0.27; idle.timeScale = 0; idle.setEffectiveWeight(1);

  // proxy "parts" that anim.js writes into
  const P = {};
  for (const k of ['hips', 'upper', 'head', 'armR', 'armL', 'legR', 'legL']) P[k] = new THREE.Object3D();
  const hair = new THREE.Group(); bones.Head.add(hair);

  let last = performance.now(), armW = 1;
  const POSED = new Set(['jump', 'slash', 'slash2', 'thrust', 'overhead', 'slam', 'spin', 'draw', 'shoot', 'block', 'gather', 'harvest', 'cast', 'windup', 'aim', 'swap', 'stun', 'hit', 'rifle', 'recoil', 'reload']);
  function apply(st) {
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
    const air = st.pose === 'jump';
    const mv = air ? 0 : (st.move || 0); // in the air: no running legs, the jump pose drives them
    // locomotion blend: stand, walk, run
    const runW = THREE.MathUtils.smoothstep(mv, 0.55, 0.85);
    const walkW = Math.min(1, mv / 0.25) * (1 - runW);
    const idleW = Math.max(0, 1 - mv / 0.25);
    run.setEffectiveWeight(runW); walk.setEffectiveWeight(walkW); idle.setEffectiveWeight(idleW);
    run.timeScale = 0.75 + 0.35 * mv; walk.timeScale = 0.8 + mv * 1.2;
    mixer.update(st.pose === 'dead' ? 0 : dt);
    model.updateMatrixWorld(true);
    // arms follow the combat pose when there is one, otherwise the run/walk swing
    const posed = POSED.has(st.pose) || mv < 0.12;
    armW += ((posed ? 1 : 0) - armW) * Math.min(1, dt * (posed ? 18 : 6));
    if (armW > 0.01) {
      for (const [side, key] of [['Left', 'armL'], ['Right', 'armR']]) {
        _e.copy(P[key].rotation);
        _q.setFromEuler(_e).multiply(hang[side]);
        setBodyQuat(bones[side + 'Arm'], body, _q, armW);
        bones[side + 'ForeArm'].quaternion.slerp(bind[side + 'ForeArm'], armW);
        bones[side + 'Hand'].quaternion.slerp(bind[side + 'Hand'], armW);
        bones[side + 'Arm'].updateMatrixWorld(true);
      }
    }
    // torso twist/lean and head on top of whatever the clip does
    for (const [proxy, bn] of [['upper', 'Spine02'], ['head', 'Head']]) {
      const r = P[proxy].rotation;
      if (!r.x && !r.y && !r.z) continue;
      _q.setFromEuler(r);
      bodyQuat(bones[bn], body, _q2);
      setBodyQuat(bones[bn], body, _q.multiply(_q2), 1);
      bones[bn].updateMatrixWorld(true);
    }
    updateSockets();
    // standing still: legs from the idle frame, but anim.js's hop/dodge kicks still show
    if (mv < 0.12 && (st.pose === 'hop' || air)) {
      for (const [side, key] of [['Left', 'legL'], ['Right', 'legR']]) { _q.setFromEuler(P[key].rotation); bodyQuat(bones[side + 'UpLeg'], body, _q2); setBodyQuat(bones[side + 'UpLeg'], body, _q.multiply(_q2), 1); }
    }
  }

  return {
    root, body, mats: [mat, new THREE.MeshLambertMaterial(), new THREE.MeshLambertMaterial(), new THREE.MeshLambertMaterial(), new THREE.MeshLambertMaterial()],
    parts: { hips: P.hips, upper: P.upper, head: P.head, hair, armR: P.armR, armL: P.armL, handR: sockets.Right, handL: sockets.Left, back: backSock, legR: P.legR, legL: P.legL },
    size: s, hunched: false, hero: true, rig: { apply, mixer, bones },
  };
}
