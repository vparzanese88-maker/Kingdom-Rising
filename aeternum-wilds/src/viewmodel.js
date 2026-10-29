// First-person arms and weapon, drawn on top of the world from their own little scene. With the real body the arms
// are your own (the same skin, sleeves and gloves, cut from the body: fpArms) and reach for where the hands should be
// (two-bone IK), fists round the grip; the simple box arms remain for the fallback figure.
import * as THREE from 'three';
import { G } from './state.js';
import { makeWeapon, box, mat } from './models.js';
import { activeWeapon } from './stats.js';
import { fpArms } from './gfx/human/body.js';
import { weaponArm } from './anim.js';

const scene = new THREE.Scene();
export const vmCam = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.01, 10);
const hemi = new THREE.HemisphereLight(0xdfefff, 0x5a4a32, 1.3); scene.add(hemi);
const key = new THREE.DirectionalLight(0xfff0d8, 1.8); key.position.set(0.6, 1, 0.4); scene.add(key);
addEventListener('resize', () => { vmCam.aspect = innerWidth / innerHeight; vmCam.updateProjectionMatrix(); });

const rig = new THREE.Group(); scene.add(rig);
const handR = new THREE.Group(), handL = new THREE.Group();
rig.add(handR); rig.add(handL);
const holdR = new THREE.Group(); handR.add(holdR); // weapon orientation
const holdL = new THREE.Group(); handL.add(holdL);
let built = null;
const skinM = new THREE.MeshLambertMaterial({ color: 0xe0b48a, flatShading: true });
const sleeveM = new THREE.MeshLambertMaterial({ color: 0x7a6a52, flatShading: true });
const cuffM = new THREE.MeshLambertMaterial({ color: 0x5a4a38, flatShading: true });

function arm(parent) {
  const g = new THREE.Group();
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.06, 0.07), skinM); g.add(hand);
  const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.04), skinM); thumb.position.set(-0.032, 0.02, -0.015); g.add(thumb);
  const fore = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.26), skinM); fore.position.set(0, -0.01, 0.16); g.add(fore);
  const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.075, 0.05), cuffM); cuff.position.set(0, -0.01, 0.27); g.add(cuff);
  const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.36), sleeveM); sleeve.position.set(0, -0.015, 0.46); g.add(sleeve);
  parent.add(g);
  return g;
}
// arms hang between the hand and a shoulder point below the screen
const armR = arm(rig), armL = arm(rig);
const shoulderR = new THREE.Vector3(0.36, -0.75, 0.25), shoulderL = new THREE.Vector3(-0.36, -0.75, 0.25);

// gathering tools
function tool(kind) {
  const g = new THREE.Group();
  const wood = mat(0x7a5a32), iron = mat(0x9aa0a6);
  if (kind === 'knife') { g.add(box(0.04, 0.12, 0.04, wood, 0, 0, 0)); g.add(box(0.03, 0.22, 0.012, iron, 0, 0.17, 0)); return g; }
  g.add(box(0.045, 0.7, 0.045, wood, 0, 0.25, 0));
  if (kind === 'axe') g.add(box(0.03, 0.18, 0.2, iron, 0, 0.52, 0.08));
  if (kind === 'pick') { const h = box(0.04, 0.05, 0.5, iron, 0, 0.56, 0); g.add(h); }
  if (kind === 'sickle') { for (let i = 0; i < 5; i++) { const b = box(0.02, 0.06, 0.12, iron, 0, 0.55 + Math.sin(i / 4 * 2.2) * 0.12, 0.05 + Math.cos(i / 4 * 2.2) * 0.12 - 0.02); b.rotation.x = -i * 0.5; g.add(b); } }
  return g;
}

// ---- real arms ----
const holder = new THREE.Group(); holder.rotation.y = Math.PI; scene.add(holder); // the body faces +z, the camera looks down -z
const SH = { R: new THREE.Vector3(0.2, -0.29, 0.06), L: new THREE.Vector3(-0.2, -0.29, 0.06) }; // shoulders, camera space
let real = null;
function ensureReal(P) {
  const h = P.h;
  if (!h.rig) { if (real) { holder.remove(real.L.mesh); holder.remove(real.R.mesh); real = null; built = null; } return null; }
  const key = h.rig.B.key + '|' + JSON.stringify(h.rig.kinds);
  if (real && real.key === key) return real;
  if (real) { holder.remove(real.L.mesh); holder.remove(real.R.mesh); }
  const a = fpArms(h);
  for (const S of ['L', 'R']) {
    const arm = a[S]; const sh = SH[S];
    arm.mesh.position.set(-sh.x - arm.restArm[0], sh.y - arm.restArm[1], -sh.z - arm.restArm[2]);
    arm.rig = { bones: arm.B, rest: arm.rest, hands: { [S]: arm.hand } };
    arm.mesh.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
    holder.add(arm.mesh);
  }
  // the shield rides the left forearm, as on the body
  a.L.mount = new THREE.Group(); a.L.B.foreL.add(a.L.mount);
  real = { L: a.L, R: a.R, key };
  built = null;
  return real;
}
// camera space -> an arm's own mesh space
const _p = new THREE.Vector3(), _d = new THREE.Vector3(), _m4 = new THREE.Matrix4(), _q4 = new THREE.Quaternion(), _pole = new THREE.Vector3();
function toArm(arm, v, out) { return out.set(-v.x - arm.mesh.position.x, v.y - arm.mesh.position.y, -v.z - arm.mesh.position.z); }
const arrow = new THREE.Group(); arrow.add(box(0.012, 0.012, 0.62, mat(0xd8c8a0), 0, 0, -0.18)); arrow.add(box(0.024, 0.024, 0.06, mat(0x8a8a90), 0, 0, -0.5)); arrow.add(box(0.03, 0.002, 0.08, mat(0xb83a2a), 0, 0, 0.1)); arrow.visible = false; scene.add(arrow);

function rebuild(key) {
  built = key;
  holdR.clear(); holdL.clear();
  if (real) { real.R.grip.clear(); real.L.grip.clear(); real.L.mount.clear(); }
  const [wt, tier, tk] = key.split(':');
  if (real) {
    // weapons and tools in the real fists (grip at the origin, haft along +y turned to run through the fist)
    if (tk) { const tl = tool(tk); tl.scale.setScalar(0.85); tl.rotation.x = Math.PI / 2; real.R.grip.add(tl); return; }
    if (!wt || wt === 'none') return;
    const w = makeWeapon(wt, +tier);
    w.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
    if (wt === 'bow') { w.scale.setScalar(0.85); real.L.grip.add(w); real.L.held = w; return; }
    w.scale.setScalar(wt === 'staff' ? 0.8 : 0.95); real.R.grip.add(w); real.R.held = w;
    if (wt === 'sword') { const sh = makeWeapon('shield', +tier); sh.traverse(o => { if (o.isMesh) o.frustumCulled = false; }); sh.scale.setScalar(0.8); sh.position.set(0.075, -0.13, 0); sh.rotation.set(0, Math.PI / 2, 0); real.L.mount.add(sh); }
    return;
  }
  if (tk) { const tl = tool(tk); tl.scale.setScalar(0.62); holdR.add(tl); return; }
  if (!wt || wt === 'none') return;
  const w = makeWeapon(wt, +tier);
  w.rotation.set(0, 0, 0);
  w.scale.setScalar(wt === 'bow' ? 0.62 : 0.56);
  if (wt === 'bow') { w.rotation.y = Math.PI / 2; holdL.add(w); holdL.userData.string = w.userData.string; const arrow = new THREE.Group(); arrow.add(box(0.012, 0.012, 0.5, mat(0xd8c8a0), 0, 0, -0.1)); arrow.add(box(0.022, 0.022, 0.05, mat(0x8a8a90), 0, 0, -0.37)); holdR.add(arrow); holdR.userData.arrow = arrow; return; }
  holdR.add(w);
  if (wt === 'sword') { const sh = makeWeapon('shield', +tier); sh.scale.setScalar(0.5); holdL.add(sh); }
}

const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const L = (a, b, t) => a + (b - a) * t;
function setP(o, x, y, z) { o.position.set(x, y, z); }

// pose targets: right hand pos/rot, left hand pos/rot
const R = { p: new THREE.Vector3(), r: new THREE.Euler() }, Lh = { p: new THREE.Vector3(), r: new THREE.Euler() };
let sway = 0, swayY = 0, kick = 0;
export function vmLook(dx, dy) { sway = Math.max(-0.06, Math.min(0.06, sway - dx * 0.00025)); swayY = Math.max(-0.05, Math.min(0.05, swayY + dy * 0.0002)); }
export function vmKick(a) { kick = Math.max(kick, a); }

export function renderViewmodel(renderer, dt) {
  const P = G.player;
  if (!P || P.state === 'dead') return;
  const w = activeWeapon();
  const wt = w?.wtype || 'none';
  const tk = P.state === 'gather' ? { logging: 'axe', mining: 'pick', harvesting: 'sickle', skinning: 'knife' }[P.gather.skill] : '';
  const k = `${wt}:${w?.tier || 1}:${tk}`;
  const ra = ensureReal(P);
  if (k !== built) rebuild(k);
  // colors follow the player model
  skinM.color.copy(P.h.mats[0].color);
  sleeveM.color.copy(P.h.mats[1].color);
  cuffM.color.copy(P.h.mats[4].color);

  const two = wt === 'greataxe' || wt === 'hammer';
  // idle
  R.p.set(0.3, -0.34, -0.52); R.r.set(-0.35, 0, -0.05);
  Lh.p.set(-0.3, -0.38, -0.5); Lh.r.set(-0.2, 0, 0.1);
  if (wt === 'sword') { Lh.p.set(-0.36, -0.36, -0.55); Lh.r.set(0, 0.6, 0); }
  if (two) { R.p.set(0.28, -0.42, -0.5); R.r.set(-0.75, 0, -0.35); Lh.p.set(0.14, -0.48, -0.42); Lh.r.set(-0.6, 0, 0.2); }
  if (wt === 'bow') { Lh.p.set(-0.16, -0.22, -0.55); Lh.r.set(0, 0, 0.12); R.p.set(0.14, -0.32, -0.42); R.r.set(-0.1, 0, 0); }
  if (wt === 'none') { R.p.set(0.26, -0.4, -0.45); Lh.p.set(-0.26, -0.4, -0.45); }

  let t = 0, pose = null;
  if (P.state === 'attack') { pose = P.atk.pose; t = P.atk.t / P.atk.dur; }
  else if (P.state === 'ability') { pose = P.ability.pose; t = Math.min(1, P.ability.t / P.ability.dur); }
  else if (P.state === 'draw') pose = 'draw';
  else if (P.state === 'gather') { pose = 'gather'; t = P.gather.t; }
  else if (P.state === 'dodge') { pose = 'dodge'; t = P.dodge.t / P.dodge.dur; }
  else if (P.blocking) pose = 'block';
  else if (P.recall) pose = 'cast';
  else if (P.press && P.press.t > 0.12 && wt !== 'bow') { pose = 'windup'; t = Math.min(1, P.press.t / 0.3); }

  switch (pose) {
    case 'slash': case 'slash2': {
      const d = pose === 'slash' ? 1 : -1;
      const a = t < 0.3 ? ease(t / 0.3) : 1, b = t < 0.3 ? 0 : t < 0.7 ? ease((t - 0.3) / 0.4) : 1;
      const back = t > 0.7 ? ease((t - 0.7) / 0.3) : 0;
      R.p.set(L(L(0.3, 0.5 * d, a), -0.35 * d, b * (1 - back * 0.7)), L(L(-0.34, -0.08, a), -0.46, b * (1 - back * 0.7)), L(-0.52, -0.66, b));
      R.r.set(L(-0.35, -1.25, b), 0, L(L(-0.05, -1.3 * d, a), 1.1 * d, b) * (1 - back));
      if (two) { Lh.p.copy(R.p).add(new THREE.Vector3(-0.08 * d, -0.1, 0.12)); }
      break;
    }
    case 'thrust': {
      const a = t < 0.35 ? ease(t / 0.35) : 1, b = t < 0.35 ? 0 : t < 0.65 ? ease((t - 0.35) / 0.3) : 1 - ease((t - 0.65) / 0.35) * 0.8;
      R.p.set(L(0.3, 0.12, b), L(-0.34, -0.26, b), L(L(-0.52, -0.32, a), -0.95, b));
      R.r.set(L(-0.35, -1.45, Math.max(a, b)), 0, 0);
      if (two) Lh.p.set(R.p.x - 0.05, R.p.y - 0.08, R.p.z + 0.2);
      break;
    }
    case 'overhead': case 'slam': {
      const up = t < 0.45 ? ease(t / 0.45) : 1, down = t < 0.45 ? 0 : t < 0.7 ? ease((t - 0.45) / 0.25) : 1;
      const rec = t > 0.75 ? ease((t - 0.75) / 0.25) : 0;
      R.p.set(L(0.3, 0.12, up), L(L(-0.34, 0.12, up), -0.52, down) + rec * 0.15, L(-0.52, L(-0.4, -0.72, down), up));
      R.r.set(L(L(-0.35, 0.7, up), -1.7, down) * (1 - rec * 0.6), 0, 0);
      if (two || pose === 'slam') Lh.p.set(R.p.x - 0.12, R.p.y - 0.08, R.p.z + 0.12);
      break;
    }
    case 'spin': {
      const a = ease(t);
      R.p.set(L(0.55, -0.55, a), -0.3, L(-0.4, -0.5, Math.sin(a * Math.PI)));
      R.r.set(-1.3, 0, -1.5);
      Lh.p.set(R.p.x - 0.1, -0.34, R.p.z + 0.15);
      break;
    }
    case 'block': {
      if (wt === 'sword') { Lh.p.set(-0.1, -0.22, -0.48); Lh.r.set(0, 0.1, 0); R.p.set(0.34, -0.38, -0.5); }
      else if (two) { R.p.set(0.22, -0.16, -0.48); R.r.set(-0.2, 0, 1.45); Lh.p.set(-0.22, -0.18, -0.46); }
      break;
    }
    case 'draw': {
      const d = P.draw;
      Lh.p.set(-0.08, -0.16, -0.62); Lh.r.set(0, 0, 0.08);
      R.p.set(-0.04, -0.17, L(-0.52, -0.36, d)); R.r.set(0, 0, 0);
      break;
    }
    case 'shoot': { Lh.p.set(-0.08, -0.16, -0.62); R.p.set(0.08, -0.2, -0.42 + t * 0.05); break; }
    case 'gather': {
      const s = (Math.sin(t * Math.PI * 2 * 1.5) + 1) / 2;
      if (tk === 'sickle' || tk === 'knife') { R.p.set(L(0.3, -0.05, s), -0.42, -0.55); R.r.set(-0.9, 0, L(-0.6, 0.8, s)); }
      else { R.p.set(0.2, L(0.05, -0.4, s), L(-0.42, -0.62, s)); R.r.set(L(0.6, -1.4, s), 0, 0); Lh.p.set(R.p.x - 0.1, R.p.y - 0.1, R.p.z + 0.18); }
      break;
    }
    case 'cast': { R.p.set(0.2, -0.12, -0.55); R.r.set(-0.2, 0, 0); Lh.p.set(-0.2, -0.12, -0.55); break; }
    case 'windup': {
      if (two) { R.p.set(0.4, -0.3 + t * 0.06, -0.48); R.r.set(-0.6 + t * 0.6, 0, -0.8); Lh.p.set(R.p.x - 0.1, R.p.y - 0.1, R.p.z + 0.12); }
      else { R.p.set(0.36, -0.3 + t * 0.1, -0.48); R.r.set(-0.35 + t * 0.45, 0, -0.35 * t); }
      break;
    }
    case 'dodge': { R.p.y -= Math.sin(t * Math.PI) * 0.25; Lh.p.y -= Math.sin(t * Math.PI) * 0.25; break; }
  }
  // bob, sway and recoil
  const mv = P.move, ph = P.phase;
  const bx = Math.cos(ph) * 0.014 * mv, by = Math.abs(Math.sin(ph)) * 0.018 * mv;
  sway *= Math.pow(0.002, dt); swayY *= Math.pow(0.002, dt); kick *= Math.pow(0.0005, dt);
  const k2 = Math.min(1, dt * 18);
  const tgtR = R.p.clone().add(new THREE.Vector3(bx + sway, by + swayY - kick * 0.05, kick * 0.06));
  const tgtL = Lh.p.clone().add(new THREE.Vector3(bx + sway, by + swayY, 0));
  const snap = P.state === 'attack' || P.state === 'ability';
  handR.position.lerp(tgtR, snap ? Math.min(1, dt * 40) : k2);
  handL.position.lerp(tgtL, snap ? Math.min(1, dt * 40) : k2);
  handR.rotation.x += (R.r.x - handR.rotation.x) * (snap ? Math.min(1, dt * 40) : k2);
  handR.rotation.y += (R.r.y - handR.rotation.y) * k2;
  handR.rotation.z += (R.r.z - handR.rotation.z) * (snap ? Math.min(1, dt * 40) : k2);
  handL.rotation.x += (Lh.r.x - handL.rotation.x) * k2;
  handL.rotation.y += (Lh.r.y - handL.rotation.y) * k2;
  handL.rotation.z += (Lh.r.z - handL.rotation.z) * k2;
  // weapon orientation inside the hand: blade up and slightly forward
  holdR.rotation.set(wt === 'bow' && !tk ? 0 : -0.55, 0, 0);
  holdR.position.set(0, 0.02, -0.02);
  if (wt === 'bow') {
    holdL.position.set(0, 0, 0);
    if (holdL.userData.string) holdL.userData.string.position.z = -0.24 - (P.state === 'draw' ? P.draw * 0.32 : 0);
    if (holdR.userData.arrow) holdR.userData.arrow.visible = P.state === 'draw';
  }
  if (wt === 'sword') { holdL.position.set(0.02, 0.04, -0.06); holdL.rotation.set(0, 0, 0); }
  armR.position.copy(handR.position); armR.lookAt(shoulderR);
  armL.position.copy(handL.position); armL.lookAt(shoulderL);
  armR.visible = armL.visible = holdR.visible = holdL.visible = !ra;
  if (ra) poseReal(ra, P, wt, tk, two);
  // ---- the real arms reach for where the hands should be ----
function poseReal(ra, P, wt, tk, two) {
  // colours follow the body's clothes
  for (const arm of [ra.L, ra.R]) for (let i = 0; i < 5; i++) arm.roleM[i].color.copy(P.h.mats[1 + i].color);
  rig.updateMatrixWorld(true);
  // the right hand: its grip at holdR, the haft along holdR's +y
  holdR.getWorldPosition(_p); holdR.getWorldQuaternion(_q4); _d.set(0, 1, 0).applyQuaternion(_q4);
  const gR = toArm(ra.R, _p, new THREE.Vector3()), bR = _d.clone().set(-_d.x, _d.y, -_d.z);
  if (wt === 'bow' && !tk) {
    // the bow in the left fist; the right hand on the string
    holdL.getWorldPosition(_p); holdL.getWorldQuaternion(_q4); _d.set(0, 1, 0).applyQuaternion(_q4);
    weaponArm(ra.L.rig, 'L', toArm(ra.L, _p, new THREE.Vector3()), new THREE.Vector3(-_d.x, _d.y, -_d.z), _pole.set(0.6, -0.7, -0.3).normalize(), ra.L.grip);
    const drawK = P.state === 'draw' ? P.draw : 0;
    // the string point (the bow's string sits behind its grip): pull it back toward the cheek
    const bow = ra.L.held; if (bow?.userData.string) bow.userData.string.position.z = -0.24 - drawK * 0.36;
    ra.L.mesh.updateMatrixWorld(true);
    const sp = new THREE.Vector3(0, 0, bow?.userData.string ? bow.userData.string.position.z : -0.24); if (bow) bow.localToWorld(sp);
    // into the right arm's space, the fingers hooked on the string
    holder.worldToLocal(sp); sp.sub(ra.R.mesh.position);
    weaponArm(ra.R.rig, 'R', sp, new THREE.Vector3(0, 1, -0.4).normalize(), _pole.set(-0.7, -0.5, -0.5).normalize(), null);
    ra.R.curl(0.9, 0.4); ra.L.curl(1.35);
    // an arrow on the string while drawing
    arrow.visible = P.state === 'draw';
    if (arrow.visible) { const w = new THREE.Vector3(0, 0, bow.userData.string.position.z); bow.localToWorld(w); arrow.position.copy(w); arrow.lookAt(w.x, w.y, w.z - 1); arrow.rotateY(Math.PI); }
    return;
  }
  arrow.visible = false;
  if (wt !== 'none' || tk) weaponArm(ra.R.rig, 'R', gR, bR, _pole.set(-0.55, -0.75, -0.35).normalize(), ra.R.grip);
  else weaponArm(ra.R.rig, 'R', gR, bR, _pole.set(-0.55, -0.75, -0.35).normalize(), null);
  ra.R.curl(wt !== 'none' || tk ? 1.35 : P.state === 'ability' || P.recall ? 0.1 : 0.9);
  // the left hand: on the haft of a two-handed weapon (or a tool), else where the pose puts it
  if ((two && wt !== 'none') || (tk && tk !== 'knife' && tk !== 'sickle')) {
    const gl = gR.clone().addScaledVector(bR, -0.22);
    weaponArm(ra.L.rig, 'L', gl, bR, _pole.set(0.55, -0.75, -0.35).normalize(), null); ra.L.curl(1.35);
  } else {
    holdL.getWorldPosition(_p); holdL.getWorldQuaternion(_q4); _d.set(0, 1, 0).applyQuaternion(_q4);
    weaponArm(ra.L.rig, 'L', toArm(ra.L, _p, new THREE.Vector3()), new THREE.Vector3(-_d.x, _d.y, -_d.z), _pole.set(0.55, -0.75, -0.35).normalize(), null);
    ra.L.curl(wt === 'sword' ? 1.1 : P.state === 'ability' || P.recall ? 0.1 : 0.8);
  }
}

// light the hands like the world
  hemi.intensity = G.light?.hemi ?? 1.3; key.intensity = (G.light?.sun ?? 1.8) * 0.9;
  key.color.copy(G.light?.sunColor || key.color);
  renderer.autoClear = false;
  renderer.clearDepth();
  renderer.render(scene, vmCam);
  renderer.autoClear = true;
}
