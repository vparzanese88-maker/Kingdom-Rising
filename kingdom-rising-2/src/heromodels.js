// Hero models: real 3D characters (made in Meshy, rigged and animated) that replace the shape-built body for a class.
// The built body keeps running underneath, invisible, so weapons, hit boxes and effects work as before; the model is
// placed on the same spot, plays idle / walk / run by speed, and the class's hand items move onto its real hands.
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const MODELS = {
  necromancer: { bright: 1.35, base: 'models/necro_rig.fbx', clips: { walk: 'models/anim/necro_walk.json', run: 'models/anim/necro_run.json' }, height: 1.95, walkSpeed: 1.6, runSpeed: 5.5, runRate: 0.85 },
  musketeer: { base: 'models/musk_rig.fbx', clips: { walk: 'models/anim/musk_walk.json', run: 'models/anim/musk_run.json' }, height: 1.45, walkSpeed: 1.5, runSpeed: 5.0 },
  blunderbuss: { base: 'models/bb_rig.fbx', clips: { walk: 'models/anim/bb_walk.json', run: 'models/anim/bb_run.json' }, height: 2.0, walkSpeed: 1.5, runSpeed: 5.0, runRate: 1.7 }, // (only a walk was made: running plays it faster)
  warrior: { base: 'models/warr_rig.fbx', clips: { walk: 'models/anim/warr_walk.json', run: 'models/anim/warr_run.json' }, height: 2.05, walkSpeed: 1.6, runSpeed: 5.5 }, // (borrows the monk's walk and run, retargeted)
  bard: { base: 'models/bard_rig.fbx', clips: { walk: 'models/anim/bard_walk.json', run: 'models/anim/bard_run.json' }, height: 1.85, walkSpeed: 1.6, runSpeed: 5.5 }, // (borrows the monk's walk and run, retargeted)
  beastmaster: { base: 'models/beast_rig.fbx', clips: { walk: 'models/anim/beast_walk.json', run: 'models/anim/beast_run.json' }, height: 2.05, walkSpeed: 1.6, runSpeed: 5.5 }, // (borrows the monk's walk and run, retargeted)
  cleric: { base: 'models/cleric_rig.fbx', clips: { walk: 'models/anim/cleric_walk.json', run: 'models/anim/cleric_run.json' }, height: 1.85, walkSpeed: 1.6, runSpeed: 5.5 }, // (borrows the monk's walk and run, retargeted)
  druid: { base: 'models/druid_rig.fbx', clips: { walk: 'models/anim/druid_walk.json', run: 'models/anim/druid_run.json' }, height: 1.85, walkSpeed: 1.6, runSpeed: 5.5 }, // (borrows the monk's walk and run, retargeted)
  elementalist: { base: 'models/ele_rig.fbx', clips: { walk: 'models/anim/ele_walk.json', run: 'models/anim/ele_run.json' }, height: 1.95, walkSpeed: 1.6, runSpeed: 5.5 }, // (borrows the monk's walk and run, retargeted)
  enchanter: { base: 'models/ench_rig.fbx', clips: { walk: 'models/anim/ench_walk.json', run: 'models/anim/ench_run.json' }, height: 1.85, walkSpeed: 1.6, runSpeed: 5.5 }, // (borrows the monk's walk and run, retargeted)
  bombardier: { base: 'models/bomb_rig.fbx', clips: { walk: 'models/anim/bomb_walk.json', run: 'models/anim/bomb_run.json' }, height: 1.5, walkSpeed: 1.6, runSpeed: 5.5 }, // (borrows the monk's walk and run, retargeted)
  berserker: { base: 'models/bers_rig.fbx', clips: { walk: 'models/anim/bers_walk.json', run: 'models/anim/bers_run.json' }, height: 2.1, walkSpeed: 1.6, runSpeed: 5.5 }, // (borrows the monk's walk and run, retargeted)
  monk: { base: 'models/monk_rig.fbx', clips: Object.fromEntries(['walk', 'run', 'punch1', 'punch2', 'kick', 'sweep', 'risekick', 'roundhouse', 'jumppunch', 'lungeround', 'spinkick', 'doublekick', 'flykick', 'flystrike', 'back'].map(k => [k, 'models/anim/monk_' + k + '.json'])), height: 2.05, walkSpeed: 1.6, runSpeed: 5.5,
    // slices of the recorded moves: [clip, start s, end s, the moment the blow lands, whole-body move, fixed play time, loops]
    moves: { jab: ['punch1', 0.15, 0.62, 0.4], cross: ['punch1', 0.6, 1.25, 1.0], upper: ['punch1', 1.2, 1.9, 1.42], spin: ['spinkick', 0.55, 1.6, 1.2], lunge: ['lungeround', 1.85, 3.0, 2.25],
      fury: ['punch2', 1.8, 2.6, 0, 0, 0, true], kick: ['doublekick', 0.7, 1.75, 1.0], flykick: ['risekick', 0.05, 1.05, 0, true, 0.75], superman: ['jumppunch', 0.45, 1.6, 0, true, 0.7], flip: ['sweep', 1.62, 2.8, 0, true] },
    combo: ['jab', 'cross', 'jab', 'spin', 'cross'], finisher: ['upper', 'lunge'], noGrip: true, fpHand: 1.0 },
};
export const hasHeroModel = (cls) => !!MODELS[cls] && !/[?&]nomodels/.test(location.search);

const cache = {}; const loader = new FBXLoader();
// Meshy meshes can carry zero-length normals; in the shader those become invalid pixels that the glow pass smears into a black screen
export function fixNormals(geo) { const n = geo && geo.attributes.normal; if (!n) return; const a = n.array; for (let i = 0; i < a.length; i += 3) { const l = a[i] * a[i] + a[i + 1] * a[i + 1] + a[i + 2] * a[i + 2]; if (!(l > 1e-8)) { a[i] = 0; a[i + 1] = 1; a[i + 2] = 0; } } n.needsUpdate = true; }
const loadFbx = (url) => new Promise((res, rej) => loader.load(url, res, undefined, rej));
// one load per class: the rigged character and its animation clips (root motion stripped so it runs on the spot)
function loadClass(cls) {
  if (cache[cls]) return cache[cls]; const D = MODELS[cls];
  cache[cls] = (async () => {
    const base = await loadFbx(D.base); const clips = {};
    await Promise.all(Object.entries(D.clips).map(async ([k, url]) => { const J = url.endsWith('.json') ? await (await fetch(url)).json() : null, c = J ? THREE.AnimationClip.parse(J) : (await loadFbx(url)).animations[0]; if (!c) return; if (J && J.rest) retarget(c, J, base); // (moves are stored as small motion-only files, not whole characters)
      c.tracks = c.tracks.filter(t => !/\.position$/.test(t.name) || (/^Hips\.position$/.test(t.name) && (keepHipY(t), true))); /* (bones keep this model's own lengths: only the hips' bob comes from the clip) */ clips[k] = c; }));
    base.traverse(o => { if (o.isMesh) { fixNormals(o.geometry); o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; const m = o.material; if (m && m.map) { m.map.colorSpace = THREE.SRGBColorSpace; m.map.anisotropy = 4; } if (m) { m.color && m.color.set('#ffffff'); m.shininess = 6; m.side = THREE.DoubleSide; } /* (both sides drawn: no seeing through thin cloth and sleeves) */ } });
    return { base, clips };
  })();
  return cache[cls];
}
// a move recorded on an older version of the model: turn each bone's keys from that model's rest pose to this one's
function retarget(clip, J, base) {
  // world-space retarget: each bone keeps the same turn away from its rest pose, measured in the world, so parents and children agree
  const T = {}, order = []; base.traverse(o => { if (o.isBone) { T[o.name] = o; order.push(o); } });
  const qt = {}; let N = 0; for (const tr of clip.tracks) { const [bn, prop] = tr.name.split('.'); if (prop === 'quaternion' && T[bn]) { qt[bn] = tr; N = Math.max(N, tr.times.length); } }
  for (const bn in qt) if (qt[bn].times.length !== N) return; // (keys out of step: leave the clip alone rather than guess)
  const par = (b) => (b.parent && b.parent.isBone ? b.parent.name : null), Q = () => new THREE.Quaternion();
  const sRestW = {}, tRestW = {}; for (const b of order) { const p = par(b), sl = J.rest[b.name] ? Q().fromArray(J.rest[b.name]) : b.quaternion.clone(); sRestW[b.name] = p ? sRestW[p].clone().multiply(sl) : sl; tRestW[b.name] = p ? tRestW[p].clone().multiply(b.quaternion) : b.quaternion.clone(); }
  const out = {}; for (const bn in qt) out[bn] = new Float32Array(qt[bn].values.length);
  const sW = {}, tW = {}, tmp = Q();
  for (let f = 0; f < N; f++) {
    for (const b of order) { const n = b.name, p = par(n && T[n]), tr = qt[n]; const sl = tr ? Q().fromArray(tr.values, f * 4) : (J.rest[n] ? Q().fromArray(J.rest[n]) : b.quaternion.clone());
      sW[n] = p ? sW[p].clone().multiply(sl) : sl;
      tW[n] = sW[n].clone().multiply(tmp.copy(sRestW[n]).invert()).multiply(tRestW[n]);
      if (tr) { const loc = p ? tmp.copy(tW[p]).invert().multiply(tW[n]) : tW[n].clone(); loc.toArray(out[n], f * 4); } } }
  for (const bn in qt) qt[bn].values = out[bn];
  for (const tr of clip.tracks) { const [bn, prop] = tr.name.split('.'); const tb = T[bn]; if (prop === 'position' && bn === 'Hips' && tb && J.restPos && J.restPos.Hips) { const v = tr.values, s0 = J.restPos.Hips, k = tb.position.y / (s0[1] || 1); for (let i = 0; i < v.length; i += 3) { v[i] = tb.position.x; v[i + 1] *= k; v[i + 2] = tb.position.z; } } }
}
// keep the hips bobbing up and down but not travelling forward or sideways
function keepHipY(track) { const v = track.values; if (!v || v.length < 3) return; const x0 = v[0], z0 = v[2]; for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; } }

// swap the built body for the class's model. ch: the humanoid from buildHumanoid. Safe to call before it has loaded.
export function attachHeroModel(ch, cls) {
  if (!ch || !hasHeroModel(cls) || ch.heroModel) return; ch.heroModel = 'loading'; const hidden = []; if (ch.body) ch.body.traverse(o => { if ((o.isMesh || o.isLine) && o.visible) { o.visible = false; o.userData.hmHide = true; hidden.push(o); } }); /* (the old built body stays hidden while the model loads, so it never flashes up) */ const D = MODELS[cls];
  loadClass(cls).then(({ base, clips }) => {
    if (!ch.root) return;
    const m = SkeletonUtils.clone(base); m.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3()); const k = (D.height * (ch.scale || 1)) / Math.max(0.01, size.y);
    const wrap = new THREE.Group(); wrap.add(m); m.scale.multiplyScalar(k); m.position.y = -box.min.y * k; ch.root.add(wrap);
    // hide the built body's skin and clothes; its weapons and hand items move onto the model's hands
    const keep = new Set(); const hands = {}; m.traverse(o => { if (o.isBone && /^LeftHand$/.test(o.name)) hands.L = o; if (o.isBone && /^RightHand$/.test(o.name)) hands.R = o; });
    for (const sd of ['L', 'R']) { const g = ch.arms && ch.arms[sd] && ch.arms[sd].grip; if (!g || !hands[sd] || D.noGrip) continue; /* (the monk's model has its own wraps and fists: the old built ones are not carried over) */ const socket = new THREE.Group(); socket.scale.setScalar(1 / k); hands[sd].add(socket); socket.userData.codeHand = ch.arms[sd].hand; socket.userData.gripQ = g.quaternion.clone(); (ch.hmSockets = ch.hmSockets || []).push(socket); for (const c of [...g.children]) { socket.add(c); keep.add(c); } ch.arms[sd].grip = socket; }
    for (const c of keep) if (c.userData && c.userData.flame) { c.position.set(0, 0.09, 0.03); c.rotation.set(0, 0, 0); } // (the necromancer's green flame sits in his open right palm)
    ch.body.traverse(o => { if ((o.isMesh || o.isLine) && !isUnder(o, keep)) { o.visible = false; o.userData.hmHide = true; } }); for (const o of hidden) if (isUnder(o, keep)) { o.visible = true; o.userData.hmHide = false; } /* (the hand items carried over to the model show again) */
    if (D.bright) m.traverse(o => { if (!o.isMesh || !o.material) return; const lift = (x) => { if (!x) return x; const c = x.clone(); if (c.color && c.color.setScalar) c.color.setScalar(D.bright); if (D.emis && c.emissive && c.emissive.setScalar && c.map) { c.emissive.setScalar(D.emis); c.emissiveMap = c.map; } return c; }; o.material = Array.isArray(o.material) ? o.material.map(lift) : lift(o.material); }); /* (lifted so the bone and armour detail reads; his own texture glows a little; any material without a colour is left alone) */
    if (D.eyes) addEyes(m, D.eyes, k);
    const mixer = new THREE.AnimationMixer(m), act = {}; for (const kk in clips) { act[kk] = mixer.clipAction(clips[kk]); act[kk].play(); act[kk].setEffectiveWeight(0); if (kk !== 'walk' && kk !== 'run' && kk !== 'back') act[kk].paused = true; } // (attack clips don't run on their own: the move code sets their time)
    const bones = {}, bind = {}; m.traverse(o => { if (o.isBone) { bones[o.name] = o; bind[o.name] = [o.quaternion.clone(), o.position.clone()]; } });
    ch.heroModel = { m, wrap, mixer, act, D, bones, bind, idle: idlePose(m, bones), w: { idle: 1, walk: 0, run: 0 }, lp: ch.root.position.clone(), v: 0, t: 0 };
  }).catch(e => { console.warn('hero model', cls, e); ch.heroModel = null; for (const o of hidden) { o.visible = true; o.userData.hmHide = false; } });
}
// glowing eyes set into the model's skull, riding on its head bone
function addEyes(m, E, k) { let head = null; m.traverse(o => { if (o.isBone && o.name === 'Head') head = o; }); if (!head) return; m.updateMatrixWorld(true);
  const hp = head.getWorldPosition(new THREE.Vector3()), fw = new THREE.Vector3(0, 0, 1).applyQuaternion(m.getWorldQuaternion(new THREE.Quaternion())), sd = new THREE.Vector3(1, 0, 0).applyQuaternion(m.getWorldQuaternion(new THREE.Quaternion())), s = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3()).y / 1.95; /* (offsets are for a 1.95 m model: scaled to this one's size) */
  const core = new THREE.MeshBasicMaterial({ color: E.col }), halo = new THREE.MeshBasicMaterial({ color: E.col, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const sx of [-1, 1]) { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.SphereGeometry(E.r * s, 10, 8), core)); const h = new THREE.Mesh(new THREE.SphereGeometry(E.r * 2.2 * s, 10, 8), halo); g.add(h);
    g.position.copy(hp).addScaledVector(fw, E.fwd * s).addScaledVector(sd, sx * E.side * s).add(new THREE.Vector3(0, E.up * s, 0)); m.parent ? m.parent.add(g) : m.add(g); head.attach(g); } }
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

// which recorded move (if any) the character is doing right now, and how far into it
const LEG_BONES = ['LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'];
const PUNCH = /^(swing|off|heavy|stab|smash|lowcut|sweep|charge|thrust|jab)/, LEFTP = /^(off|stabL|swing2)/;
function pickMove(H, ch, dt) {
  const M = H.D.moves, u = ch._u || {}, st = ch._st || {}, nm = (u.atk && u.atk.name) || ch._act || '';
  // whole moves (flying kick, superman punch) start once and play to the end on their own clock
  const trig = u.kickT > 0 ? 'flykick' : u.supermanT > 0 ? 'superman' : null;
  if (trig && (!H.latch || H.latch.key !== trig) && H.trigPrev !== trig) H.latch = { key: trig, t: 0 }; H.trigPrev = trig;
  let key = null, k = null;
  if (H.latch) { const sl = M[H.latch.key]; H.latch.t += dt; k = H.latch.t / (sl[5] || 0.6); if (k >= 1) H.latch = null; else key = H.latch.key; }
  if (!key) { if (st.rollKind === 'flip' && st.roll != null) { key = 'flip'; k = Math.min(1, Math.max(0, st.roll)); }
    else if (u.strike || /^(fury|area|spin)$/.test(nm)) { key = 'fury'; }
    else if (nm === 'kick') { key = 'kick'; k = st.actionT; }
    else if (PUNCH.test(nm) && st.actionT != null) { k = st.actionT; const fresh = H.pK == null || k < H.pK - 0.25 || !H.inPunch; if (fresh) { H.combo = H.t - (H.lpT || -9) > 1.3 ? 0 : ((H.combo == null ? -1 : H.combo) + 1) % (H.D.combo || [0]).length; } H.lpT = H.t; H.inPunch = true; key = H.D.combo ? H.D.combo[H.combo] : LEFTP.test(nm) ? 'jab' : 'cross'; if (nm === 'smash' && H.D.finisher) { if (fresh) H.fin = ((H.fin || 0) + 1) % H.D.finisher.length; key = H.D.finisher[H.fin || 0]; } } } // (the combo's last, heavy blow is an uppercut or a lunging roundhouse) // (each new swing plays the next move of the combo: jab, cross, uppercut, spin kick...)
  if (!(PUNCH.test(nm) && st.actionT != null) || H.latch) H.inPunch = false; H.pK = st.actionT;
  if (!key || !M[key]) { H.mvKey = null; return null; }
  const sl = M[key]; if (key !== H.mvKey) { H.mvKey = key; H.mvT = 0; } H.mvT += dt;
  let t; if (sl[6]) { const span = sl[2] - sl[1]; t = sl[1] + ((H.mvT * 1.6) % span); }
  else { k = Math.min(1, Math.max(0, k || 0)); t = sl[3] ? (k < 0.3 ? sl[1] + (sl[3] - sl[1]) * (k / 0.3) : sl[3] + (sl[2] - sl[3]) * ((k - 0.3) / 0.7)) : sl[1] + (sl[2] - sl[1]) * k; } // (the blow lands 30% of the way into the attack, when the game's hit does)
  H.lastMove = { slice: sl, t, full: !!sl[4] }; return key;
}
// every frame: pick the animation from how fast the character is moving and blend between them
export function tickHeroModel(ch, dt) {
  const H = ch && ch.heroModel; if (!H || H === 'loading' || dt <= 0) return;
  const p = ch.root.position, dx = p.x - H.lp.x, dz = p.z - H.lp.z, sp = Math.hypot(dx, dz) / dt; H.lp.copy(p); H.v += (Math.min(sp, 12) - H.v) * Math.min(1, dt * 8);
  // which way he is moving compared with where he faces: forward 0, right +90°, back 180°
  if (sp > 0.4) { const fw = new THREE.Vector3(0, 0, 1).applyQuaternion(ch.root.getWorldQuaternion(new THREE.Quaternion())), a = Math.atan2(dx * fw.z - dz * fw.x, dx * fw.x + dz * fw.z); H.mvA = a; }
  const A = sp > 0.4 ? (H.mvA || 0) : 0, back = Math.abs(A) > 1.95; H.backK = (H.backK || 0) + ((back && H.v > 0.25 ? 1 : 0) - (H.backK || 0)) * Math.min(1, dt * 10);
  let legT = back ? A - Math.sign(A) * Math.PI : A; legT = Math.max(-1.15, Math.min(1.15, legT)) * (H.v > 0.25 ? 1 : 0); H.legYaw = (H.legYaw || 0) + (legT - (H.legYaw || 0)) * Math.min(1, dt * 9);
  const walkW = H.v < 0.25 ? 0 : H.v < H.D.runSpeed * 0.6 ? 1 : Math.max(0, 1 - (H.v - H.D.runSpeed * 0.6) / (H.D.runSpeed * 0.4)), runW = H.v < H.D.runSpeed * 0.6 ? 0 : 1 - walkW, idleW = 1 - Math.min(1, H.v / 0.25);
  const lerpW = (k, t) => { H.w[k] += (t - H.w[k]) * Math.min(1, dt * 10); };
  lerpW('walk', walkW * (1 - idleW)); lerpW('run', runW * (1 - idleW)); lerpW('idle', idleW);
  if (H.act.walk) { H.act.walk.setEffectiveWeight(H.w.walk); H.act.walk.timeScale = Math.max(0.6, H.v / H.D.walkSpeed); }
  if (H.act.run) { H.act.run.setEffectiveWeight(H.w.run); H.act.run.timeScale = Math.min(1.25, Math.max(0.75, H.v / H.D.runSpeed)) * (H.D.runRate || 1); }
  if (H.act.walk) H.act.walk.timeScale = Math.min(1.4, H.act.walk.timeScale);
  if (H.act.back) { const bw = H.backK * (H.w.walk + H.w.run); H.act.back.paused = false; H.act.back.setEffectiveWeight(bw); H.act.back.timeScale = Math.min(1.6, Math.max(0.7, H.v / H.D.walkSpeed * 0.8)); if (H.act.walk) H.act.walk.setEffectiveWeight(H.w.walk * (1 - H.backK)); if (H.act.run) H.act.run.setEffectiveWeight(H.w.run * (1 - H.backK)); }
  else if (H.backK > 0.5 && H.act.walk) { H.act.walk.timeScale = -Math.abs(H.act.walk.timeScale); if (H.act.run) H.act.run.timeScale = -Math.abs(H.act.run.timeScale); } // (no backwards clip: the walk plays in reverse)
  if (H.act.walk && H.act.run && H.w.walk > 0.02 && H.w.run > 0.02) { const wc = H.act.walk.getClip().duration, rc = H.act.run.getClip().duration; H.act.walk.time = (H.act.run.time / rc) * wc; } // (walk and run kept in step while blending, so the legs never fight each other)
  const reset = () => { for (const k in H.bind) { const b = H.bones[k]; b.quaternion.copy(H.bind[k][0]); b.position.copy(H.bind[k][1]); b.scale.set(1, 1, 1); } }; // (start every frame from the rest pose, so nothing builds up frame after frame: no spinning)
  reset(); const mvK = H.D.moves ? pickMove(H, ch, dt) : null; for (const k in H.act) if (k !== 'walk' && k !== 'run' && k !== 'back') H.act[k].setEffectiveWeight(0);
  H.mixer.update(dt); H.t += dt; const B = H.bones;
  H.mw = (H.mw || 0) + ((mvK ? 1 : 0) - (H.mw || 0)) * Math.min(1, dt * (mvK ? 30 : 9)); // (snaps into an attack, eases back out of it)
  if (H.mw > 0.01 && H.lastMove) { const [ck, a, b2] = H.lastMove.slice; const A = H.act[ck];
    if (A) { const legs = {}; const moving = Math.min(1, H.v / 1.5) * (H.lastMove.full ? 0 : 1); for (const k of LEG_BONES) if (B[k]) legs[k] = B[k].quaternion.clone(); const hipP = B.Hips ? B.Hips.position.clone() : null;
      reset(); for (const k in H.act) H.act[k].setEffectiveWeight(k === ck ? H.mw : k === 'walk' ? H.w.walk * (1 - H.mw) * (1 - (H.act.back ? H.backK : 0)) : k === 'run' ? H.w.run * (1 - H.mw) * (1 - (H.act.back ? H.backK : 0)) : k === 'back' ? (H.w.walk + H.w.run) * H.backK * (1 - H.mw) : 0); A.time = H.lastMove.t; H.mixer.update(0);
      for (const k of LEG_BONES) if (legs[k] && B[k]) B[k].quaternion.slerp(legs[k], moving); if (hipP && moving > 0) B.Hips.position.lerp(hipP, moving); } }
  // standing still: the rest pose with the arms down at the sides, a slow breath and a little weight shift
  const free = 1 - (H.mw || 0); if (H.w.idle > 0.01 && free > 0.01) { for (const k in H.idle) B[k].quaternion.slerp(H.idle[k], H.w.idle * free); const br = Math.sin(H.t * 1.7) * 0.025 * H.w.idle; if (B.Spine01) B.Spine01.rotateX(br); if (B.neck) B.neck.rotateX(-br * 0.6); if (B.Hips) B.Hips.rotateZ(Math.sin(H.t * 0.6) * 0.02 * H.w.idle); }
  // running: toes turned in a touch; smaller feet
  const mv = H.w.run + H.w.walk * 0.5, ti = (H.D.toeIn || 0) * mv; if (ti) { const up = new THREE.Vector3(0, 1, 0); turnFoot(B.LeftFoot, up, -ti); turnFoot(B.RightFoot, up, ti); } // (only the feet turn in, at the ankle: the legs stay apart)
  const spr = (H.D.legSpread || 0) * mv; if (spr) { const fw = new THREE.Vector3(0, 0, 1).applyQuaternion(H.m.getWorldQuaternion(new THREE.Quaternion())).setY(0).normalize(); spreadLeg(B.LeftUpLeg, fw, spr); spreadLeg(B.RightUpLeg, fw, -spr); } // (feet kept apart so the legs never cross)
  // strafing or running at an angle: hips and legs turn toward where he is going, the chest turns back to face the aim
  if (Math.abs(H.legYaw) > 0.01 && B.Hips) { const up = new THREE.Vector3(0, 1, 0); turnFoot(B.Hips, up, H.legYaw); const sp1 = B.Spine01 || B.Spine; if (sp1) turnFoot(sp1, up, -H.legYaw * 0.6); const sp2 = B.Spine02; if (sp2) turnFoot(sp2, up, -H.legYaw * 0.4); }
  if (H.D.footScale) for (const k of ['LeftFoot', 'RightFoot']) if (B[k]) B[k].scale.setScalar(H.D.footScale);
  // the hidden built body still performs every attack, kick, flip and roll: the model's hands and feet follow it there
  H.wrap.position.copy(ch.body.position); if (H.lastMove && H.lastMove.full && H.mw > 0.5) { H.wrap.quaternion.identity(); H.wrap.position.y = 0; } else H.wrap.quaternion.copy(ch.body.quaternion); H.wrap.updateMatrixWorld(true); // (a recorded flip or jump kick moves the whole body itself: the built body's own flip is not added on top)
  const gunHold = !!(ch.wt && /musket|blunderbuss/.test(ch.wt)), act = !!((ch._act && ch._act !== 'aim' && ch._act !== 'block') || ch._strike || gunHold), /* (a gun is always held in both hands: the model's hands stay on the stock and fore-end) */ /* (holding a staff out to aim is not an attack: the model's arms stay natural) */ kicking = !!(ch._u && ch._u.kickT > 0) || ch._act === 'kick', kickL = kicking && ch.legs && (ch.legs.L.thigh.rotation.x < -0.75), kickR = kicking && ch.legs && (ch.legs.R.thigh.rotation.x < -0.75); /* (only a real kick moves the model's legs: a long running stride must not) */
  H.ikA = (H.ikA || 0) + ((act && !mvK ? 1 : 0) - (H.ikA || 0)) * Math.min(1, dt * 14); // (a recorded move drives the arms itself)
  if (H.ikA > 0.02 && ch.arms) for (const [sd, nm, sx] of [['R', 'Right', -1], ['L', 'Left', 1]]) { const hp = ch.arms[sd].hand; if (!hp) continue; const t = hp.getWorldPosition(new THREE.Vector3()), sh = B[nm + 'Arm']; if (!sh) continue; const s0 = sh.getWorldPosition(new THREE.Vector3()), wq = H.m.getWorldQuaternion(new THREE.Quaternion());
    const pole = s0.clone().add(new THREE.Vector3(sx * 0.4, -0.6, -0.35).applyQuaternion(wq)); const keep = [B[nm + 'Arm'].quaternion.clone(), B[nm + 'ForeArm'].quaternion.clone()]; ikArm(null, B[nm + 'Arm'], B[nm + 'ForeArm'], B[nm + 'Hand'], s0.clone().lerp(t, 1), pole);
    if (H.ikA < 0.99) { B[nm + 'Arm'].quaternion.copy(keep[0].slerp(B[nm + 'Arm'].quaternion.clone(), H.ikA)); B[nm + 'ForeArm'].quaternion.copy(keep[1].slerp(B[nm + 'ForeArm'].quaternion.clone(), H.ikA)); } }
  if (gunHold && ch.hmSockets) for (const so of ch.hmSockets) { const chd = so.userData.codeHand; if (!chd || !so.parent) continue; chd.updateWorldMatrix(true, false); so.parent.updateWorldMatrix(true, false); const wq = chd.getWorldQuaternion(new THREE.Quaternion()).multiply(so.userData.gripQ), pq = so.parent.getWorldQuaternion(new THREE.Quaternion()).invert(); so.quaternion.copy(pq.multiply(wq)); } // (the gun lies the way the proper two-handed grip holds it, not however the model's wrist happens to turn)
  if (ch.legs && !mvK) for (const [sd, nm, on] of [['R', 'Right', kickR], ['L', 'Left', kickL]]) { if (!on) continue; const t = ch.legs[sd].ankle.getWorldPosition(new THREE.Vector3()), hip = B[nm + 'UpLeg']; if (!hip) continue; const h0 = hip.getWorldPosition(new THREE.Vector3()), wq = H.m.getWorldQuaternion(new THREE.Quaternion());
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
    const B = {}, bind = {}; m.traverse(o => { if (o.isBone) { B[o.name] = o; bind[o.name] = o.quaternion.clone(); } if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; const mt = o.material; if (mt && mt.map) { mt.map.anisotropy = 16; mt.map.needsUpdate = true; } if (mt) { o.material = mt.clone(); o.material.flatShading = false; if (D.bright && o.material.color) o.material.color.setScalar(D.bright); if (D.emis && o.material.emissive && o.material.map) { o.material.emissive.setScalar(D.emis); o.material.emissiveMap = o.material.map; } } } }); // (sharpest texture filtering and smooth shading: the hands are right in front of you)
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
// the monk's fist continues straight out of his own forearm: knuckles along the arm, the palm turned in on guard, rolling over palm-down as the punch lands
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _z = new THREE.Vector3(), _x = new THREE.Vector3(), _m = new THREE.Matrix4(), _fq = new THREE.Quaternion(), _hq = new THREE.Quaternion();
function fistOnArm(F, vm, H, fist, fore, hand, side, pk) {
  if (!fore || !hand) return; const S = F.D.fistScale || 1.12; fist.scale.setScalar(S);
  fore.updateWorldMatrix(true, false); hand.updateWorldMatrix(true, false); fore.getWorldPosition(_a); hand.getWorldPosition(_b);
  H.updateWorldMatrix(true, false); H.getWorldQuaternion(_hq).invert();
  _d.copy(_b).sub(_a).normalize().applyQuaternion(_hq); // (the forearm's direction, in the hand's own space)
  const k = Math.min(1, Math.max(0, pk)); vm.g.getWorldQuaternion(_fq);
  _z.set(side * (0.85 - 0.75 * k), 0.45 + 0.6 * k, 0.15).normalize().applyQuaternion(_fq).applyQuaternion(_hq); // (where the back of the hand faces: outward on guard, up at full reach)
  _z.addScaledVector(_d, -_z.dot(_d)).normalize(); _x.crossVectors(_d, _z).normalize();
  _m.makeBasis(_x, _d, _z); fist.quaternion.setFromRotationMatrix(_m);
  const loc = H.worldToLocal(_b.clone()), wl = fist.userData.wrist ? fist.userData.wrist.position.clone().multiplyScalar(S).applyQuaternion(fist.quaternion) : new THREE.Vector3();
  fist.position.copy(loc.sub(wl)).addScaledVector(_d, -0.02 * S);
}
export function tickFpArms(vm) {
  const F = vm && vm.fpArms; if (!F || F === 'loading') return; const B = F.B;
  for (const k in F.bind) B[k].quaternion.copy(F.bind[k]); if (B.Head) B.Head.scale.setScalar(0.001); for (const nm of ['LeftArm', 'RightArm']) if (B[nm]) B[nm].scale.setScalar(F.reach || 1); for (const nm of ['LeftHand', 'RightHand']) if (B[nm]) B[nm].scale.setScalar(F.D.fpFist ? 0.001 : (F.D.fpHand || 1.15)); if (F.D.fpFist) for (const nm of ['LeftForeArm', 'RightForeArm']) if (B[nm]) B[nm].scale.set(1.28, 1, 1.28); // (big hands in your view; the monk's become real fists below)
  for (const nm of ['LeftShoulder', 'RightShoulder', 'neck', 'Spine', 'Spine01', 'Spine02']) if (B[nm] && nm.endsWith('Shoulder')) B[nm].scale.setScalar(0.6); // (shoulder pads shrunk so they never cover the view)
  F.wrap.visible = vm.g.visible !== false && !F.hideTest; F.wrap.updateMatrixWorld(true);
  for (const [H, sd, sx] of [[vm.R, 'Left', -1], [vm.L, 'Right', 1]]) { // (the model faces the way you look, so its left arm is your right side on screen... mirrored below if needed)
    const t = new THREE.Vector3(); const wr = H.children[0] && H.children[0].userData.wrist; if (F.D.fpFist) { H.updateWorldMatrix(true, false); t.copy(H.localToWorld(new THREE.Vector3(0, -0.07 * 1.35, 0).applyEuler(new THREE.Euler(0.55, 0, 0)))); } else (wr || H).getWorldPosition(t); // (aim at where the wrist belongs in the pose, not at the fist, which follows the arm)
    const side = H === vm.R ? 1 : -1, pole = vm.g.localToWorld(new THREE.Vector3(side * 0.7, -0.9, 0.2));
    const arm = side > 0 ? 'Right' : 'Left'; if (H.visible) ikArm(F, B[arm + 'Arm'], B[arm + 'ForeArm'], B[arm + 'Hand'], t, pole);
    else { B[arm + 'Arm'] && B[arm + 'Arm'].rotateX(1.2); }
    if (H.children[0]) { const fist = H.children[0]; fist.visible = !!F.D.fpFist; if (F.D.fpFist) fistOnArm(F, vm, H, fist, B[arm + 'ForeArm'], B[arm + 'Hand'], side, side > 0 ? vm.punchR || 0 : vm.punchL || 0); } }
  if (vm.foot && vm.foot.visible) { const t = vm.foot.getWorldPosition(new THREE.Vector3()), hip = B.RightUpLeg; if (hip) { const h0 = hip.getWorldPosition(new THREE.Vector3()); ikArm(F, B.RightUpLeg, B.RightLeg, B.RightFoot, t, h0.clone().add(vm.g.localToWorld(new THREE.Vector3(0, 0.5, -1)).sub(vm.g.getWorldPosition(new THREE.Vector3())))); } vm.foot.traverse(o => { if (o.isMesh) o.visible = false; }); } // (your own leg kicks into view)
  if (vm.arms) for (const a of vm.arms) a.arm.visible = false; // (the old forearms are gone: your model's own arms are drawn instead)
}

// the necromancer's ultimate demon (a Meshy character): one load, then a fresh copy per summon. It plays its scream when
// the demon roars; the rest of the time it holds the scream's first frame and its arms reach for where the old built
// demon's hands are, so the grab, the lift and the bite all line up with the ultimate's own timing
const DEMON = { base: 'models/demon_rig.fbx', scream: 'models/anim/demon_scream.json', bright: 1.0 }; let demonBase = null;
export function loadDemonModel() {
  if (!demonBase) demonBase = (async () => { const [base, J] = await Promise.all([loadFbx(DEMON.base), (await fetch(DEMON.scream)).json()]); const c = THREE.AnimationClip.parse(J);
    c.tracks = c.tracks.filter(t => !/\.position$/.test(t.name) || (/^Hips\.position$/.test(t.name) && (keepHipY(t), true))); /* (only the hips' bob: bones keep their own lengths) */
    base.traverse(o => { if (o.isMesh) { fixNormals(o.geometry); o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; const mats = Array.isArray(o.material) ? o.material : [o.material];
      o.material = mats.map(m0 => { const m = DEMON.bright !== 1 ? m0.clone() : m0; if (m.map) { m.map.colorSpace = THREE.SRGBColorSpace; m.map.anisotropy = 4; } if (m.color) { m.color.set('#ffffff'); if (DEMON.bright !== 1) m.color.setScalar(DEMON.bright); } m.side = THREE.DoubleSide; return m; }); if (o.material.length === 1) o.material = o.material[0]; } });
    return { base, clip: c }; })().catch(e => { demonBase = null; throw e; });
  return demonBase.then(({ base, clip }) => { const m = SkeletonUtils.clone(base); m.updateMatrixWorld(true); const bones = {}, bind = {}; m.traverse(o => { if (o.isBone) { bones[o.name] = o; bind[o.name] = [o.quaternion.clone(), o.position.clone()]; } });
    const mixer = new THREE.AnimationMixer(m), scream = mixer.clipAction(clip); scream.play(); scream.setEffectiveWeight(1); scream.paused = true; scream.time = 0; mixer.update(0);
    const H = bones.Head, mouth = new THREE.Vector3(); if (H) { m.updateMatrixWorld(true); const h = H.getWorldPosition(new THREE.Vector3()), f = bones.headfront ? bones.headfront.getWorldPosition(new THREE.Vector3()) : h.clone().add(new THREE.Vector3(0, 0, 25)), top = bones.head_end ? bones.head_end.getWorldPosition(new THREE.Vector3()) : h.clone().add(new THREE.Vector3(0, 30, 0)); H.worldToLocal(mouth.copy(f).addScaledVector(top.sub(h), -0.3)); } /* (the mouth: the front of the face, a little below the eyes, riding on the head bone) */
    return { m, bones, bind, mixer, scream, mouth, size: new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3()), on: false }; });
}
// every frame: back to the rest pose, the scream (or its first frame) on top, then each arm reaching for its target point (world space)
export function poseDemonModel(dm, dt, o = {}) {
  if (!dm) return; const B = dm.bones; for (const k in dm.bind) { B[k].quaternion.copy(dm.bind[k][0]); B[k].position.copy(dm.bind[k][1]); }
  const sc = dm.scream; if (o.screaming) { if (!dm.on) { dm.on = true; sc.time = o.screamFrom || 0; } sc.paused = false; sc.setEffectiveWeight(1); dm.mixer.update(dt); } /* (the scream runs from the start each time it roars) */
  else { dm.on = false; sc.paused = true; sc.time = 0; sc.setEffectiveWeight(1); dm.mixer.update(0); } /* (otherwise: the scream's opening stance as its idle) */
  dm.m.updateMatrixWorld(true);
  for (const [sd, sx, tg] of [['Right', -1, o.handR], ['Left', 1, o.handL]]) { if (!tg) continue; const pole = dm.m.localToWorld(new THREE.Vector3(sx * 220, 110, -120)); ikArm(null, B[sd + 'Arm'], B[sd + 'ForeArm'], B[sd + 'Hand'], tg, pole); }
  if ((o.pitch || o.yaw) && B.neck) { B.neck.updateWorldMatrix(true, false); const wq = dm.m.getWorldQuaternion(_q), ax = new THREE.Vector3(1, 0, 0).applyQuaternion(wq); _q2.setFromAxisAngle(ax, o.pitch || 0).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0).applyQuaternion(wq), o.yaw || 0)); /* (the head looks where the built demon's head does: pitch about its side axis, then turn about its up axis) */ const bw = B.neck.getWorldQuaternion(new THREE.Quaternion()), pw = B.neck.parent.getWorldQuaternion(new THREE.Quaternion()); B.neck.quaternion.copy(pw.invert().multiply(_q2.multiply(bw))); }
  dm.m.updateMatrixWorld(true);
}
