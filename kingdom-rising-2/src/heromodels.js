// Hero models: real 3D characters (made in Meshy, rigged and animated) that replace the shape-built body for a class.
// The built body keeps running underneath, invisible, so weapons, hit boxes and effects work as before; the model is
// placed on the same spot, plays idle / walk / run by speed, and the class's hand items move onto its real hands.
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const MODELS = {
  necromancer: { base: 'models/necro_rig.fbx', clips: { walk: 'models/necro_walk.fbx', run: 'models/necro_run.fbx' }, height: 1.95, walkSpeed: 1.6, runSpeed: 5.5, toeIn: 0.35, footScale: 0.84, legSpread: 0.09, runRate: 0.78 },
  monk: { base: 'models/monk_rig.fbx', clips: { walk: 'models/monk_walk.fbx', run: 'models/monk_run.fbx' }, height: 2.05, walkSpeed: 1.6, runSpeed: 5.5, toeIn: 0.15, footScale: 0.92 },
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
    for (const c of keep) if (c.userData && c.userData.flame) { c.position.set(0, 0.09, 0.03); c.rotation.set(0, 0, 0); } // (the necromancer's green flame sits in his open right palm)
    ch.body.traverse(o => { if ((o.isMesh || o.isLine) && !isUnder(o, keep)) o.visible = false; });
    const mixer = new THREE.AnimationMixer(m), act = {}; for (const kk in clips) { act[kk] = mixer.clipAction(clips[kk]); act[kk].play(); act[kk].setEffectiveWeight(0); }
    const bones = {}, bind = {}; m.traverse(o => { if (o.isBone) { bones[o.name] = o; bind[o.name] = [o.quaternion.clone(), o.position.clone()]; } });
    ch.heroModel = { m, wrap, mixer, act, D, bones, bind, idle: idlePose(m, bones), w: { idle: 1, walk: 0, run: 0 }, lp: ch.root.position.clone(), v: 0, t: 0 };
  }).catch(e => { console.warn('hero model', cls, e); ch.heroModel = null; });
}
// a relaxed standing pose built from the model's own rest pose: arms brought down to the sides, elbows soft
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();
function aimBone(bone, child, worldDir) { bone.updateWorldMatrix(true, false); child.updateWorldMatrix(true, false); const a = bone.getWorldPosition(new THREE.Vector3()), b = child.getWorldPosition(new THREE.Vector3()), cur = b.sub(a).normalize();
  const qw = new THREE.Quaternion().setFromUnitVectors(cur, worldDir.clone().normalize()), bw = bone.getWorldQuaternion(new THREE.Quaternion()), pw = bone.parent.getWorldQuaternion(new THREE.Quaternion());
  return pw.invert().multiply(qw.multiply(bw)); }
function idlePose(m, B) { const out = {}; m.updateMatrixWorld(true); const keep = {}; for (const k in B) keep[k] = B[k].quaternion.clone();
  for (const [sd, sx] of [['Left', 1], ['Right', -1]]) { const arm = B[sd + 'Arm'], fore = B[sd + 'ForeArm'], hand = B[sd + 'Hand']; if (!arm || !fore || !hand) continue;
    const side = new THREE.Vector3(arm.getWorldPosition(new THREE.Vector3()).x - m.getWorldPosition(new THREE.Vector3()).x, 0, 0).normalize();
    out[arm.name] = aimBone(arm, fore, new THREE.Vector3(side.x * 0.2, -1, 0.05)); arm.quaternion.copy(out[arm.name]); arm.updateMatrixWorld(true);
    out[fore.name] = aimBone(fore, hand, new THREE.Vector3(side.x * 0.12, -1, 0.3)); fore.quaternion.copy(out[fore.name]); fore.updateMatrixWorld(true); }
  for (const k in keep) B[k].quaternion.copy(keep[k]); return out; }
// turn a leg on its own axis (toes in or out), in world space so it works whatever way the bone was built
function twistLeg(up, low, ang) { if (!up || !low || !ang) return; up.updateWorldMatrix(true, false); low.updateWorldMatrix(true, false); const ax = low.getWorldPosition(_v1).sub(up.getWorldPosition(_v2)).normalize(); _q.setFromAxisAngle(ax, ang); const bw = up.getWorldQuaternion(_q2); const pw = up.parent.getWorldQuaternion(new THREE.Quaternion()); up.quaternion.copy(pw.invert().multiply(_q.multiply(bw))); }
function turnFoot(f, ax, ang) { if (!f) return; f.updateWorldMatrix(true, false); _q.setFromAxisAngle(ax, ang); const bw = f.getWorldQuaternion(_q2); const pw = f.parent.getWorldQuaternion(new THREE.Quaternion()); f.quaternion.copy(pw.invert().multiply(_q.multiply(bw))); }
function spreadLeg(up, fw, ang) { if (!up) return; up.updateWorldMatrix(true, false); _q.setFromAxisAngle(fw, ang); const bw = up.getWorldQuaternion(_q2); const pw = up.parent.getWorldQuaternion(new THREE.Quaternion()); up.quaternion.copy(pw.invert().multiply(_q.multiply(bw))); }
const isUnder = (o, set) => { for (let p = o; p; p = p.parent) if (set.has(p)) return true; return false; };

// every frame: pick the animation from how fast the character is moving and blend between them
export function tickHeroModel(ch, dt) {
  const H = ch && ch.heroModel; if (!H || H === 'loading' || dt <= 0) return;
  const p = ch.root.position, sp = Math.hypot(p.x - H.lp.x, p.z - H.lp.z) / dt; H.lp.copy(p); H.v += (Math.min(sp, 12) - H.v) * Math.min(1, dt * 8);
  const walkW = H.v < 0.25 ? 0 : H.v < H.D.runSpeed * 0.6 ? 1 : Math.max(0, 1 - (H.v - H.D.runSpeed * 0.6) / (H.D.runSpeed * 0.4)), runW = H.v < H.D.runSpeed * 0.6 ? 0 : 1 - walkW, idleW = 1 - Math.min(1, H.v / 0.25);
  const lerpW = (k, t) => { H.w[k] += (t - H.w[k]) * Math.min(1, dt * 10); };
  lerpW('walk', walkW * (1 - idleW)); lerpW('run', runW * (1 - idleW)); lerpW('idle', idleW);
  if (H.act.walk) { H.act.walk.setEffectiveWeight(H.w.walk); H.act.walk.timeScale = Math.max(0.6, H.v / H.D.walkSpeed); }
  if (H.act.run) { H.act.run.setEffectiveWeight(H.w.run); H.act.run.timeScale = Math.max(0.7, H.v / H.D.runSpeed) * (H.D.runRate || 1); }
  for (const k in H.bind) { const b = H.bones[k]; b.quaternion.copy(H.bind[k][0]); b.position.copy(H.bind[k][1]); b.scale.set(1, 1, 1); } // (start every frame from the rest pose, so nothing builds up frame after frame: no spinning)
  H.mixer.update(dt); H.t += dt; const B = H.bones;
  // standing still: the rest pose with the arms down at the sides, a slow breath and a little weight shift
  if (H.w.idle > 0.01) { for (const k in H.idle) B[k].quaternion.slerp(H.idle[k], H.w.idle); const br = Math.sin(H.t * 1.7) * 0.025 * H.w.idle; if (B.Spine01) B.Spine01.rotateX(br); if (B.neck) B.neck.rotateX(-br * 0.6); if (B.Hips) B.Hips.rotateZ(Math.sin(H.t * 0.6) * 0.02 * H.w.idle); }
  // running: toes turned in a touch; smaller feet
  const mv = H.w.run + H.w.walk * 0.5, ti = (H.D.toeIn || 0) * mv; if (ti) { const up = new THREE.Vector3(0, 1, 0); turnFoot(B.LeftFoot, up, -ti); turnFoot(B.RightFoot, up, ti); } // (only the feet turn in, at the ankle: the legs stay apart)
  const spr = (H.D.legSpread || 0) * mv; if (spr) { const fw = new THREE.Vector3(0, 0, 1).applyQuaternion(H.m.getWorldQuaternion(new THREE.Quaternion())).setY(0).normalize(); spreadLeg(B.LeftUpLeg, fw, spr); spreadLeg(B.RightUpLeg, fw, -spr); } // (feet kept apart so the legs never cross)
  if (H.D.footScale) for (const k of ['LeftFoot', 'RightFoot']) if (B[k]) B[k].scale.setScalar(H.D.footScale);
  // the hidden built body still performs every attack, kick, flip and roll: the model's hands and feet follow it there
  H.wrap.position.copy(ch.body.position); H.wrap.quaternion.copy(ch.body.quaternion); H.wrap.updateMatrixWorld(true);
  const act = !!(ch._act || ch._strike), kickL = ch.legs && (ch.legs.L.thigh.rotation.x < -0.75), kickR = ch.legs && (ch.legs.R.thigh.rotation.x < -0.75);
  H.ikA = (H.ikA || 0) + ((act ? 1 : 0) - (H.ikA || 0)) * Math.min(1, dt * 14);
  if (H.ikA > 0.02 && ch.arms) for (const [sd, nm, sx] of [['R', 'Right', -1], ['L', 'Left', 1]]) { const hp = ch.arms[sd].hand; if (!hp) continue; const t = hp.getWorldPosition(new THREE.Vector3()), sh = B[nm + 'Arm']; if (!sh) continue; const s0 = sh.getWorldPosition(new THREE.Vector3()), wq = H.m.getWorldQuaternion(new THREE.Quaternion());
    const pole = s0.clone().add(new THREE.Vector3(sx * 0.4, -0.6, -0.35).applyQuaternion(wq)); const keep = [B[nm + 'Arm'].quaternion.clone(), B[nm + 'ForeArm'].quaternion.clone()]; ikArm(null, B[nm + 'Arm'], B[nm + 'ForeArm'], B[nm + 'Hand'], s0.clone().lerp(t, 1), pole);
    if (H.ikA < 0.99) { B[nm + 'Arm'].quaternion.copy(keep[0].slerp(B[nm + 'Arm'].quaternion.clone(), H.ikA)); B[nm + 'ForeArm'].quaternion.copy(keep[1].slerp(B[nm + 'ForeArm'].quaternion.clone(), H.ikA)); } }
  if (ch.legs) for (const [sd, nm, on] of [['R', 'Right', kickR], ['L', 'Left', kickL]]) { if (!on) continue; const t = ch.legs[sd].ankle.getWorldPosition(new THREE.Vector3()), hip = B[nm + 'UpLeg']; if (!hip) continue; const h0 = hip.getWorldPosition(new THREE.Vector3()), wq = H.m.getWorldQuaternion(new THREE.Quaternion());
    ikArm(null, B[nm + 'UpLeg'], B[nm + 'Leg'], B[nm + 'Foot'], t, h0.clone().add(new THREE.Vector3(0, 0.3, 0.8).applyQuaternion(wq))); } // (kicks: the model's leg goes where the built leg kicks)
}

// (shared IK helper is defined below)
// ---------- first person: your own model's arms, reaching to where the view model's hands are ----------
// A second copy of the model sits in the view-model space with its eyes at the camera (head shrunk away so it never
// fills the screen); each frame both arms are bent with two-bone IK so the model's hands land on the view-model hands.
export function attachFpArms(vm, cls) {
  if (!vm || !hasHeroModel(cls) || vm.fpArms) return; vm.fpArms = 'loading'; const D = MODELS[cls];
  loadClass(cls).then(({ base }) => {
    const m = SkeletonUtils.clone(base); m.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(m), k = D.height / Math.max(0.01, box.getSize(new THREE.Vector3()).y);
    const inner = new THREE.Group(); inner.add(m); m.scale.multiplyScalar(k); m.position.y = -box.min.y * k; inner.rotation.y = Math.PI; const wrap = new THREE.Group(); wrap.add(inner); vm.g.add(wrap);
    const B = {}, bind = {}; m.traverse(o => { if (o.isBone) { B[o.name] = o; bind[o.name] = o.quaternion.clone(); } if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
    if (B.Head) B.Head.scale.setScalar(0.001); // (no head in your own view)
    wrap.updateMatrixWorld(true); const hp = new THREE.Vector3(); if (B.Head) { B.Head.getWorldPosition(hp); vm.g.worldToLocal(hp); }
    wrap.position.set(-hp.x, -hp.y - 0.1, -hp.z + 0.1); // (the camera sits at his eyes; shoulders just under the view, so arms bend at the guard and straighten on a punch)
    vm.fpArms = { m, wrap, B, bind, D, reach: 1.35 }; // (first-person arms are drawn a little longer than life, like every shooter does, so they can reach the screen)
  }).catch(e => { console.warn('fp arms', cls, e); vm.fpArms = null; });
}
const _S = new THREE.Vector3(), _T = new THREE.Vector3(), _E = new THREE.Vector3(), _P = new THREE.Vector3();
function ikArm(F, up, fore, hand, target, pole) { if (!up || !fore || !hand) return; up.updateWorldMatrix(true, true); up.getWorldPosition(_S); const a = fore.getWorldPosition(new THREE.Vector3()).distanceTo(_S), b = hand.getWorldPosition(new THREE.Vector3()).distanceTo(fore.getWorldPosition(new THREE.Vector3()));
  _T.copy(target); const dv = _T.clone().sub(_S); let d = dv.length(); if (d < 1e-4) return; d = Math.min(d, (a + b) * 0.999); dv.normalize(); const cosA = Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d))), sinA = Math.sqrt(1 - cosA * cosA);
  _P.copy(pole).sub(_S); const n = _P.sub(dv.clone().multiplyScalar(_P.dot(dv))).normalize(); _E.copy(_S).addScaledVector(dv, a * cosA).addScaledVector(n, a * sinA);
  up.quaternion.copy(aimBone(up, fore, _E.clone().sub(_S))); up.updateWorldMatrix(true, true); const tgt = _S.clone().addScaledVector(dv, d); fore.quaternion.copy(aimBone(fore, hand, tgt.sub(_E))); fore.updateWorldMatrix(true, true); }
export function tickFpArms(vm) {
  const F = vm && vm.fpArms; if (!F || F === 'loading') return; const B = F.B;
  for (const k in F.bind) B[k].quaternion.copy(F.bind[k]); if (B.Head) B.Head.scale.setScalar(0.001); for (const nm of ['LeftArm', 'RightArm']) if (B[nm]) B[nm].scale.setScalar(F.reach || 1); for (const nm of ['LeftHand', 'RightHand']) if (B[nm]) B[nm].scale.setScalar(1 / (F.reach || 1)); // (longer arms, normal-sized hands)
  for (const nm of ['LeftShoulder', 'RightShoulder', 'neck', 'Spine', 'Spine01', 'Spine02']) if (B[nm] && nm.endsWith('Shoulder')) B[nm].scale.setScalar(0.6); // (shoulder pads shrunk so they never cover the view)
  F.wrap.visible = vm.g.visible !== false; F.wrap.updateMatrixWorld(true);
  for (const [H, sd, sx] of [[vm.R, 'Left', -1], [vm.L, 'Right', 1]]) { // (the model faces the way you look, so its left arm is your right side on screen... mirrored below if needed)
    const t = new THREE.Vector3(); const wr = H.children[0] && H.children[0].userData.wrist; (wr || H).getWorldPosition(t);
    const side = H === vm.R ? 1 : -1, pole = vm.g.localToWorld(new THREE.Vector3(side * 0.7, -0.9, 0.2));
    const arm = side > 0 ? 'Right' : 'Left'; if (H.visible) ikArm(F, B[arm + 'Arm'], B[arm + 'ForeArm'], B[arm + 'Hand'], t, pole);
    else { B[arm + 'Arm'] && B[arm + 'Arm'].rotateX(1.2); }
    if (H.children[0]) H.children[0].visible = false; }
  if (vm.foot && vm.foot.visible) { const t = vm.foot.getWorldPosition(new THREE.Vector3()), hip = B.RightUpLeg; if (hip) { const h0 = hip.getWorldPosition(new THREE.Vector3()); ikArm(F, B.RightUpLeg, B.RightLeg, B.RightFoot, t, h0.clone().add(vm.g.localToWorld(new THREE.Vector3(0, 0.5, -1)).sub(vm.g.getWorldPosition(new THREE.Vector3())))); } vm.foot.traverse(o => { if (o.isMesh) o.visible = false; }); } // (your own leg kicks into view)
  if (vm.arms) for (const a of vm.arms) a.arm.visible = false; // (the old forearms are gone: your model's own arms are drawn instead)
}
