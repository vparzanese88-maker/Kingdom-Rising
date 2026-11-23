// Meshy-made models: marines (rigged, with gun animations), weapons and turrets. Everything loads in the background on the title screen;
// until a model arrives (or if it fails), models.js keeps drawing its own simple version, so the game never waits on this.
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js';
import * as SU from '../vendor/jsm/utils/SkeletonUtils.js';

const BASE = './assets/m/', loader = new GLTFLoader();
export const A = {};
const CLS = ['assault', 'engineer', 'heavy', 'gunner', 'sniper', 'medic'];
// weapon: file, length in metres (muzzle to stock)
export const WEAP = {
  assault: ['w_rifle', 0.95], engineer: ['w_shotgun', 1.0], heavy: ['w_rocket', 1.2], gunner: ['w_minigun', 1.3], sniper: ['w_sniper', 1.35], medic: ['w_carbine', 0.8],
  pistol: ['w_pistol', 0.32], torch: ['w_plasma', 0.6], welder: ['w_welder', 0.55], frag: ['w_frag', 0.15],
};
export const TURRET_GLB = { pulse: 2.1, shotgunT: 2.0, missile: 2.1, minigun: 2.1, railgun: 3.6, mortar: 2.0 };   // kinds with Meshy models, and their height at level 1
export const MANIFEST = [...CLS.filter(c => c !== 'assault').map(c => 'marine_' + c), 'marine_anims', ...new Set(Object.values(WEAP).map(w => w[0])), ...Object.keys(TURRET_GLB).flatMap(k => [1, 2, 3].map(l => `t_${k}_${l}`))];
let done = false;
export const PROG = { total: 1, got: 0 };   // loading progress, for the cover screen's bar
export const ready = () => done;
// where the camera is, set by the game each frame: far-away models animate less often
export const CAM = new THREE.Vector3(); const _wp = new THREE.Vector3();
const BS = new WeakMap();   // a roomy bound per skinned geometry (clones share the geometry)
const fixBounds = root => root.traverse(o => { const b = o.isSkinnedMesh && BS.get(o.geometry); if (b) { o.boundingSphere = b.clone(); o.frustumCulled = true; } });
export function loadAll(extra = []) {
  const list = [...MANIFEST, ...STRUCT_FILES, ...PROP_FILES, ...ALIEN_FILES, ...SCENE_FILES, ...extra]; PROG.total = list.length; PROG.got = 0;
  return Promise.all(list.map(n => loader.loadAsync(BASE + n + '.glb').then(g => { prep(g); A[n] = g; if (n === 'marine_anims') A.marine_assault = g; }).catch(() => { /* missing: keep the simple model */ }).finally(() => { PROG.got++; }))).then(() => { done = true; });
}
function prep(g) {
  g.scene.traverse(o => {
    if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = true; o.frustumCulled = true;
    if (o.isSkinnedMesh) { o.geometry.computeBoundingSphere(); const b = o.geometry.boundingSphere.clone(); b.radius *= 1.6; BS.set(o.geometry, b); }   // a roomy fixed bound, so animated models are still skipped when off screen
    for (const m of [].concat(o.material)) if (m && m.isMeshStandardMaterial) {  m.metalness = Math.min(m.metalness, 0.25); m.roughness = Math.max(m.roughness, 0.45); }   // no environment map in the game, so full metal reads black
  });
}

// ---- weapons: turned so the muzzle points down -z, the grip at the origin, scaled to its real length
export function weapon(kind) {
  const e = WEAP[kind]; if (!e || !A[e[0]]) return null;
  const inner = A[e[0]].scene.clone(true), g = new THREE.Group(); g.add(inner);
  inner.rotation.y = -Math.PI / 2; inner.updateMatrixWorld(true);
  let b = new THREE.Box3().setFromObject(inner); const s = e[1] / (b.max.z - b.min.z); inner.scale.setScalar(s); inner.updateMatrixWorld(true);
  b = new THREE.Box3().setFromObject(inner); const c = b.getCenter(new THREE.Vector3());
  inner.position.set(-c.x, -c.y, -(b.max.z) + e[1] * (kind === 'gunner' ? 0.1 : 0.32));   /* the minigun is held by its rear grip */
  g.userData.len = e[1]; g.userData.glb = true;
  if (kind === 'gunner') g.userData.spin = splitSpin(inner, e[1]);
  return g;
}
// the minigun's barrels: pull the front of the mesh out into its own piece that can spin about the barrel axis
function splitSpin(inner) {
  let mesh = null; inner.traverse(o => { if (o.isMesh && !mesh) mesh = o; }); if (!mesh) return null;
  const geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone(), pos = geo.attributes.position;
  mesh.updateMatrixWorld(true); const toG = new THREE.Matrix4().copy(inner.matrix).multiply(mesh.matrix), v = new THREE.Vector3();
  let zmin = Infinity, zmax = -Infinity; const zs = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(toG); zs[i] = v.z; zmin = Math.min(zmin, v.z); zmax = Math.max(zmax, v.z); }
  const cut = zmin + (zmax - zmin) * 0.4, front = [], back = [];
  for (let t = 0; t < pos.count; t += 3) (zs[t] < cut && zs[t + 1] < cut && zs[t + 2] < cut ? front : back).push(t);
  if (front.length < 20) return null;
  const pick = list => { const g2 = new THREE.BufferGeometry(); for (const k in geo.attributes) { const a = geo.attributes[k], arr = new a.array.constructor(list.length * 3 * a.itemSize); list.forEach((t, j) => { for (let q = 0; q < 3; q++) for (let c = 0; c < a.itemSize; c++) arr[(j * 3 + q) * a.itemSize + c] = a.array[(t + q) * a.itemSize + c]; }); g2.setAttribute(k, new THREE.BufferAttribute(arr, a.itemSize, a.normalized)); } return g2; };
  const fg = pick(front); mesh.geometry = pick(back);
  // barrel axis: the middle of the front piece, in the mesh's own space
  fg.computeBoundingBox(); const ctr = fg.boundingBox.getCenter(new THREE.Vector3());
  const piv = new THREE.Group(); piv.position.copy(ctr); mesh.add(piv); const fm = new THREE.Mesh(fg, mesh.material); fm.position.copy(ctr).multiplyScalar(-1); piv.add(fm);
  // spin about the gun's -z (the barrel), expressed in the mesh's space
  const axis = new THREE.Vector3(0, 0, 1).applyMatrix4(new THREE.Matrix4().copy(toG).invert().setPosition(0, 0, 0)).normalize();
  const spin = { rotation: { _z: 0, get z() { return this._z; }, set z(a) { this._z = a; piv.quaternion.setFromAxisAngle(axis, a); } } };
  return spin;
}

// ---- marines: a skinned, animated soldier. The clips (one set, shared by every class) come from marine_anims.
const CLIPKEY = { walk: /walk_forward_while_shooting|walk forward while shooting/i, run: /run_and_shoot|run and shoot/i, sprint: /rifle_charge|rifle charge/i, reload: /reload/i, throw: /throw/i, die: /fall_forward|fall forward/i, sit: /sit/i, idle: /^(armature\|)?idle|\|idle\|/i, hit: /hit_reaction|hit reaction/i, back: /backward/i };
let CLIPS = null;
function clips() {
  if (CLIPS) return CLIPS; const src = A.marine_anims; if (!src) return null; CLIPS = {};
  for (const [k, re] of Object.entries(CLIPKEY)) { const c = src.animations.find(a => re.test(a.name)); if (c) CLIPS[k] = c; }
  if (!CLIPS.idle) { const c = src.animations.find(a => /idle/i.test(a.name)); if (c) CLIPS.idle = c; }
  // the running clips move forward on their own; the game moves the marine, so pin the hips over the feet (keep the bounce)
  for (const c of Object.values(CLIPS)) for (const tr of c.tracks) if (/hips\.position$/i.test(tr.name)) { const v = tr.values, x0 = v[0], z0 = v[2]; for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; } }
  return CLIPS;
}
const H = {};   // height of each marine file, measured once
export function marineGLB(cls, from) {
  const n = from || 'marine_' + cls, src = A[n] || (from ? null : A.marine_assault); if (!src || !clips()) return null;
  const root = SU.clone(src.scene), g = new THREE.Group(), holder = new THREE.Group(); holder.rotation.y = Math.PI; holder.add(root); g.add(holder); fixBounds(root);
  if (!H[n]) { const b = new THREE.Box3().setFromObject(src.scene); H[n] = b.max.y - b.min.y || 1.85; }
  holder.scale.setScalar(2.1 / H[n]);
  const mixer = new THREE.AnimationMixer(root), act = {};
  for (const [k, c] of Object.entries(CLIPS)) { const a = mixer.clipAction(c); if (k === 'die' || k === 'throw' || k === 'reload' || k === 'hit') { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } act[k] = a; }
  const rh = root.getObjectByName('RightHand'), lh = root.getObjectByName('LeftHand');
  const gun = weapon(WEAP[cls] ? cls : 'assault'); if (gun) g.add(gun);
  g.userData = { legL: new THREE.Object3D(), legR: new THREE.Object3D(), arms: new THREE.Group(), glb: true, mixer, act, cur: null, rh, lh, gun, root, cls };
  setPose(g, 'idle'); mixer.update(0.01); aimGun(g);
  return g;
}
export function setPose(m, k, fade = 0.25) {
  const u = m.userData; if (!u.glb) return; if (!u.act[k]) k = u.act.idle ? 'idle' : Object.keys(u.act)[0]; if (u.cur === k) return;
  const next = u.act[k]; next.reset().play(); if (u.cur && u.act[u.cur]) u.act[u.cur].crossFadeTo(next, fade, false); u.cur = k;
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _f = new THREE.Vector3(), _up = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _inv = new THREE.Matrix4();
// the gun sits in the right hand and points through the left (the support hand on the foregrip), so it follows every animation
function aimGun(m) {
  const u = m.userData; if (!u.gun || !u.rh) return;
  m.updateMatrixWorld(true); _inv.copy(m.matrixWorld).invert();
  u.rh.getWorldPosition(_a).applyMatrix4(_inv); u.lh ? u.lh.getWorldPosition(_b).applyMatrix4(_inv) : _b.copy(_a).add(new THREE.Vector3(0, 0, -1));
  _f.subVectors(_b, _a); const d = _f.length();
  // hands apart (not gripping): carry it pointed ahead and a little down
  if (d < 0.12 || d > 0.75 || _f.z > 0.05) _f.set(0.05, -0.35, -1);
  _f.normalize(); _up.set(0, 1, 0); const x = new THREE.Vector3().crossVectors(_up, _f.clone().negate()).normalize(); _up.crossVectors(_f.clone().negate(), x);
  _m.makeBasis(x, _up, _f.clone().negate()); _q.setFromRotationMatrix(_m);
  u.gun.quaternion.copy(_q); u.gun.position.copy(_a).addScaledVector(_up, 0.03);
}
// called every frame for each marine: picks the clip from speed, plays it, keeps the gun in the hands
export function animGLB(m, sp, opt) {
  const u = m.userData, now = performance.now(), dt = Math.min(0.1, (now - (u.lt || now)) / 1000); u.lt = now;
  let k = opt && opt.pose ? opt.pose : sp > 6.5 ? 'sprint' : sp > 3.2 ? 'run' : sp > 0.4 ? 'walk' : (opt && opt.fire ? 'walk' : 'idle');
  const far = m.getWorldPosition(_wp).distanceToSquared(CAM); if (!u.fpArms && far > 4900) { u.acc = (u.acc || 0) + dt; return; } if (far > 900) { u.skip = !u.skip; if (u.skip) { u.acc = (u.acc || 0) + dt; return; } }
  const dtM = Math.min(0.2, dt + (u.acc || 0)); u.acc = 0;
  setPose(m, k); const a = u.act[u.cur];
  if (u.cur === 'walk') a.timeScale = sp > 0.4 ? Math.max(0.7, sp / 2.6) : 0.12; else if (u.cur === 'run' || u.cur === 'sprint') a.timeScale = Math.max(0.8, sp / (u.cur === 'run' ? 5 : 7.5)); else a.timeScale = 1;
  u.mixer.update(dtM); aimGun(m);
}

// ---- turrets: one model per upgrade level. The whole model sits in the "head" so it swings round to aim.
export function turretGLB(kind, lvl = 1) {
  const n = `t_${kind}_${Math.max(1, Math.min(3, lvl || 1))}`; if (!TURRET_GLB[kind] || !A[n]) return null;
  const g = new THREE.Group(), head = new THREE.Group(), inner = A[n].scene.clone(true); g.add(head); head.add(inner);
  inner.rotation.y = -Math.PI / 2; inner.updateMatrixWorld(true);
  let b = new THREE.Box3().setFromObject(inner); const h = TURRET_GLB[kind] * [1, 1.15, 1.3][Math.max(1, Math.min(3, lvl || 1)) - 1]; inner.scale.setScalar(h / (b.max.y - b.min.y)); inner.updateMatrixWorld(true);
  b = new THREE.Box3().setFromObject(inner); const c = b.getCenter(new THREE.Vector3()); inner.position.set(-c.x, -b.min.y, -c.z);
  g.userData = { head, kind, glb: true, lvl, muzzle: new THREE.Vector3(0, h * 0.62, b.min.z - c.z) };
  return g;
}

// ---- class structures: the Meshy body replaces the simple shapes, but the glowing rings, pads and light columns stay
const STRUCT = { rally: ['s_rally', 'h', 3.6], ammopack: ['s_ammopack', 'w', 0.8], medkitT: ['s_medkit', 'w', 0.75], fieldhosp: ['s_fieldhosp', 'w', 4.4], teleporter: ['s_teleporter', 'w', 2.9], resupply: ['s_resupply', 'w', 3.0], uav: ['s_ball', 'w', 0.9] };
export const STRUCT_FILES = Object.values(STRUCT).map(e => e[0]);
export const fitGLB = (name, mode, size, center) => A[name] ? fit(name, mode, size, center) : null;
function fit(name, mode, size, center) {
  const inner = A[name].scene.clone(true), o = new THREE.Group(); o.add(inner); inner.updateMatrixWorld(true);
  let b = new THREE.Box3().setFromObject(inner); const sz = b.getSize(new THREE.Vector3()), d = mode === 'h' ? sz.y : Math.max(sz.x, sz.z); inner.scale.setScalar(size / (d || 1)); inner.updateMatrixWorld(true);
  b = new THREE.Box3().setFromObject(inner); const c = b.getCenter(new THREE.Vector3()); inner.position.set(-c.x, center ? -c.y : -b.min.y, -c.z); return o;
}
export function structGLB(kind, g, head) {
  const e = STRUCT[kind]; if (!e || !A[e[0]]) return false;
  const keep = o => o.geometry && (o.geometry.type === 'RingGeometry' || o.geometry.type === 'CircleGeometry' || (o.material && o.material.transparent));
  for (const par of [g, head]) for (const c of [...par.children]) if (c.isMesh && !keep(c)) par.remove(c);
  const body = fit(e[0], e[1], e[2], kind === 'uav'); (kind === 'resupply' ? g : head).add(body); g.userData.glb = true; return true;
}

// ---- the landscape: wrecks, rocks and plants. A list picks one at random; the size is its width ('w') or height ('h'), with a little variety.
export let mapId = 'mars';
export const setMap = m => { mapId = m; };
const PROP = {
  satellite: [['l_satellite'], 'w', 6], capsule: [['l_capsule'], 'w', 4.5], wreck: [['l_debris'], 'w', 17], debris: [['l_crashship'], 'w', 6], tank: [['l_tank'], 'w', 7.5], mech: [['l_mech'], 'w', 7], deadTurret: [['l_deadturret'], 'h', 2.4],
  crate: [['l_crates'], 'w', 2.8], burntCrate: [['l_crates'], 'w', 2.6], terminal: [['l_terminal'], 'h', 1.7], spireHive: [['l_hive_spire'], 'h', 13],
  rock: [['l_rock_mars1', 'l_rock_mars2'], 'w', 5], ice: [['l_rock_ice2'], 'h', 4.5], spire: [['l_rock_ice2'], 'h', 9], tree: [['l_tree_jungle'], 'h', 8.5], shroom: [['l_plant_jungle1'], 'h', 5],
  boulder: [null, 'w', 4.5],
  dome: [['l_dome'], 'w', 9], derrick: [['l_derrick'], 'h', 11], dish: [['l_dish'], 'h', 6.5], tankTrap: [['l_tanktrap'], 'w', 2.6], flag: [['l_flag'], 'h', 4.2], sniperNest: [['l_snipernest'], 'w', 5.6], eggs: [['l_eggs'], 'w', 3.2],
};
export const PROP_FILES = [...new Set(Object.values(PROP).flatMap(p => p[0] || []).concat(['l_rock_ice1', 'l_rock_jungle1']))];
export function propGLB(kind, rnd = Math.random) {
  const p = PROP[kind]; if (!p) return null; let list = p[0];
  if (kind === 'boulder') list = [{ mars: 'l_rock_mars1', ice: 'l_rock_ice1', jungle: 'l_rock_jungle1' }[mapId] || 'l_rock_mars1'];
  const ok = list.filter(n => A[n]); if (!ok.length) return null;
  const n = ok[(rnd() * ok.length) | 0], o = fit(n, p[1], p[2] * (0.75 + rnd() * 0.5), false); o.children[0].position.y -= 0.15; if (/rock|plant|tree|crate|tanktrap|flag|eggs/.test(n)) o.traverse(q => { q.castShadow = false; }); return o;
}

// ---- what the marine holds on slot 4: the frag, a med kit or an ammo pack
export function item(kind) {
  if (kind === 'frag') return weapon('frag');
  const n = kind === 'medkit' ? 's_medkit' : kind === 'ammo' ? 's_ammopack' : null; if (!n || !A[n]) return null; return fit(n, 'w', 0.3, true);
}

// ---- first-person arms: your own class marine's arms, posed in the aiming clip and fitted onto the gun you hold.
// mode 'two': right hand on the grip, left hand on the foregrip (rifles, shotguns, the minigun, the launcher)
// mode 'one': right hand on the grip only (the side arm, the welders), left arm tucked away out of sight
export const FP_ROLL = { two: -0.7, one: -0.5, hand: 0 };
// mode 'hand': the left forearm and hand alone, fitted to the reload hand's frame (palm at the origin, forearm back along +z), so it can
// follow the hand's reload path: down to the magazine, out, in, and back to the foregrip
export function fpArms(cls, gun, mode = 'two') {
  if (mode !== 'hand' && (!gun || !gun.userData.glb)) return null; const g = marineGLB(cls); if (!g) return null; const u = g.userData;
  if (u.gun) { g.remove(u.gun); u.gun = null; }
  setPose(g, 'walk', 0); const a = u.act.walk; a.time = a.getClip().duration * 0.15; a.timeScale = 0; u.mixer.update(0);
  // keep only the sleeves and gloves: every triangle whose skin mostly follows an arm bone; the chest, head and legs are cut away
  const keepB = mode === 'hand' ? ['LeftForeArm', 'LeftHand'] : mode === 'two' ? ['RightArm', 'RightForeArm', 'RightHand', 'LeftArm', 'LeftForeArm', 'LeftHand'] : ['RightArm', 'RightForeArm', 'RightHand'];
  u.root.traverse(o => {
    if (!o.isSkinnedMesh) return; const bones = o.skeleton.bones, ok = new Set(bones.map((b, i) => keepB.includes(b.name) ? i : -1).filter(i => i >= 0));
    const src = o.geometry, si = src.attributes.skinIndex, sw = src.attributes.skinWeight, dom = i => { let best = 0, bw = -1; for (let c = 0; c < 4; c++) { const w = sw.getComponent(i, c); if (w > bw) { bw = w; best = si.getComponent(i, c); } } return best; };
    const idx = src.index ? src.index.array : null, n = idx ? idx.length : src.attributes.position.count, out = [];
    for (let t = 0; t < n; t += 3) { const a = idx ? idx[t] : t, b = idx ? idx[t + 1] : t + 1, c = idx ? idx[t + 2] : t + 2; if (ok.has(dom(a)) && ok.has(dom(b)) && ok.has(dom(c))) out.push(a, b, c); }
    const geo = src.clone(); geo.setIndex(out); o.geometry = geo;
  });
  g.updateMatrixWorld(true); const P = n => { const o = u.root.getObjectByName(n); return o ? o.getWorldPosition(new THREE.Vector3()) : null; };
  const L = (gun && gun.userData.len) || 0.9, rh = P('RightHand'), lh = P('LeftHand'), rf = P('RightForeArm'), lf = P('LeftForeArm'); if (!rh) return null;
  // where those joints should end up, in the gun's own space (muzzle down -z, grip at the origin)
  let A, B, A2, B2;
  if (mode === 'hand') { if (!lf || !lh) return null; A = lf; B = lh; A2 = new THREE.Vector3(0, -0.01, 0.42); B2 = new THREE.Vector3(0, 0.005, 0.06); }
  else if (mode === 'two' && lh) { A = rh; B = lh; A2 = new THREE.Vector3(0.035, -0.06, 0.2); B2 = new THREE.Vector3(-0.045, -0.055, -L * 0.3); }
  else { A = rf; B = rh; A2 = new THREE.Vector3(0.05, -0.32, 0.3); B2 = new THREE.Vector3(0.01, -0.08, 0.12); }
  const d1 = B.clone().sub(A), d2 = B2.clone().sub(A2), s = d2.length() / d1.length();
  const basis = (d, upHint) => { const z = d.clone().normalize(), x = new THREE.Vector3().crossVectors(upHint, z).normalize(), y = new THREE.Vector3().crossVectors(z, x); return new THREE.Matrix4().makeBasis(x, y, z); };
  const m1 = basis(d1, new THREE.Vector3(0, 1, 0)), m2 = basis(d2, new THREE.Vector3(0, 1, 0)), R = m2.clone().multiply(m1.clone().invert());
  const q = new THREE.Quaternion().setFromRotationMatrix(R); q.premultiply(new THREE.Quaternion().setFromAxisAngle(d2.clone().normalize(), FP_ROLL[mode]));   // swing the elbows and shoulders down, out of view
  g.quaternion.copy(q); g.scale.setScalar(s); g.position.copy(A2).sub(A.clone().multiplyScalar(s).applyQuaternion(q));
  g.traverse(o => { o.castShadow = false; if (o.isMesh) { o.frustumCulled = false; o.material = o.material.clone(); o.material.side = THREE.DoubleSide; } }); g.userData.fpArms = true;   // double-sided so the cut sleeve ends look solid
  return g;
}

// ---- the Mars aliens: Meshy models, rigged as four-legged beasts with leopard moves (run, walk, pounce, roar, idle, die).
// Each one is sized to match the simple model it replaces (same length and the same height off the ground), so hit boxes still fit.
export const ALIEN_GLB = { crawler: 'a_crawler', spitter: 'a_spitter', brute: 'a_brute', ravager: 'a_ravager', queen: 'a_queen', royal: 'a_royal', broodqueen: 'a_broodqueen', flyer: 'a_flyer' };
export const ALIEN_FILES = Object.values(ALIEN_GLB);
export const SCENE_FILES = ['p_station', 'p_droppod', 'p_seat', 'h_reactor', 'h_wall', 'r_synth', 'r_mech', 'v_dropship', 's_scrap', 'l_sandbags', 'v_vtol', 'v_rover', 'p_bridge', 'p_tunnel', 'l_watchtower', 'l_hivemound', 'h_gatetower', 'h_barracks', 'h_comms', 'h_floodlight'];
const BIG = new Set(['brute', 'ravager', 'queen', 'broodqueen']);
const ACLIP = { run: /run/i, walk: /walk/i, pounce: /pounce|skill/i, roar: /roar/i, idle: /idle/i, die: /death|dead/i }, HEAVY = new Set(['brute', 'ravager', 'queen']);
export function alienGLB(type, ref) {
  const n = ALIEN_GLB[type], src = n && A[n]; if (!src) return null;
  const g = new THREE.Group(), body = new THREE.Group(), holder = new THREE.Group(), root = SU.clone(src.scene); g.add(body); body.add(holder); holder.add(root); holder.rotation.y = Math.PI; fixBounds(root);
  if (!BIG.has(type)) root.traverse(o => { o.castShadow = false; });   // the small aliens don't cast shadows: there can be a hundred of them   // Meshy faces +z; the game's aliens face -z
  // size: as long as the simple model, standing where it stood
  if (!src.userData.box) src.userData.box = new THREE.Box3().setFromObject(src.scene);
  const sb = src.userData.box, ss = sb.getSize(new THREE.Vector3()), rs = ref.getSize(new THREE.Vector3());
  const s = Math.max(rs.x, rs.z) / Math.max(ss.x, ss.z, 0.001) * (type === 'flyer' ? 1.1 : 1); holder.scale.setScalar(s); holder.position.y = (type === 'flyer' ? ref.min.y : 0) - sb.min.y * s;
  // own copies of the materials, lit a little from within by their own texture (they read as black silhouettes in the warm light otherwise), so each alien can flash when hit
  const mats = []; root.traverse(o => { if (o.isMesh && o.material) { o.material = o.material.clone(); o.material.emissive = new THREE.Color(0xffffff); o.material.emissiveMap = o.material.map; o.material.emissiveIntensity = 0.5; mats.push(o.material); } });
  const u = { type, body, glb: true, legs: [], arms: [], wings: [], sacs: [], root, mats };
  if (src.animations.length) {
    u.mixer = new THREE.AnimationMixer(root); u.act = {};
    for (const [k, re] of Object.entries(ACLIP)) { const c = src.animations.find(a => re.test(a.name)); if (!c) continue; const a = u.mixer.clipAction(c); if (k === 'die' || k === 'pounce') { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } u.act[k] = a; }
    // pin the root over its feet: the game moves the alien
    for (const a of Object.values(u.act)) for (const tr of a.getClip().tracks) if (/\.position$/.test(tr.name)) { const v = tr.values; if (v.length > 3 && /hips|root|pelvis|spine/i.test(tr.name)) { const x0 = v[0], z0 = v[2]; for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; } } }
    const k0 = type === 'broodqueen' ? 'idle' : HEAVY.has(type) ? 'walk' : 'run'; if (u.act[k0]) { u.act[k0].play(); u.act[k0].time = Math.random() * u.act[k0].getClip().duration; u.cur = k0; } u.mixer.update(0);
  } else if (type === 'flyer') u.flap = splitWings(root);
  // check the size once posed (skinned models can measure wrongly before) and correct it: same length as the simple model, feet on the ground
  g.updateMatrixWorld(true); const b2 = new THREE.Box3().setFromObject(g), s2 = b2.getSize(new THREE.Vector3()), want = Math.max(rs.x, rs.z) * (type === 'flyer' ? 1.1 : 1), have = Math.max(s2.x, s2.z), k = type === 'flyer' ? want / have : Math.min(want / have, rs.y * 1.15 / s2.y);   // fit inside the simple model: no longer and no taller
  if (have > 0.01 && Math.abs(k - 1) > 0.05) { holder.scale.multiplyScalar(k); g.updateMatrixWorld(true); const b3 = new THREE.Box3().setFromObject(g); holder.position.y += (type === 'flyer' ? ref.min.y : 0) - b3.min.y; }
  // its real body for hit tests: length along its facing, width, height and centre, measured from the posed model (the game shoots at this, not at the old simple shape)
  { g.updateMatrixWorld(true); const hb = new THREE.Box3().setFromObject(g), s = hb.getSize(new THREE.Vector3()), c = hb.getCenter(new THREE.Vector3()); u.hb = { len: s.z, wid: s.x, hgt: s.y, cy: c.y, cz: c.z }; }
  g.userData = u; return g;
}
// the wraith's wings: cut the far-left and far-right of the mesh into two pieces that hinge at the body
function splitWings(root) {
  let mesh = null; root.traverse(o => { if (o.isMesh && !mesh) mesh = o; }); if (!mesh) return null;
  const geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone(), pos = geo.attributes.position; geo.computeBoundingBox();
  const bb = geo.boundingBox, cx = (bb.min.x + bb.max.x) / 2, half = (bb.max.x - bb.min.x) / 2, cut = half * 0.28, L = [], R = [], C = [];
  for (let t = 0; t < pos.count; t += 3) { const xs = [0, 1, 2].map(q => pos.getX(t + q) - cx); (xs.every(x => x < -cut) ? L : xs.every(x => x > cut) ? R : C).push(t); }
  if (L.length < 10 || R.length < 10) return null;
  const pick = list => { const g2 = new THREE.BufferGeometry(); for (const k in geo.attributes) { const a = geo.attributes[k], arr = new a.array.constructor(list.length * 3 * a.itemSize); list.forEach((t, j) => { for (let q = 0; q < 3; q++) for (let c = 0; c < a.itemSize; c++) arr[(j * 3 + q) * a.itemSize + c] = a.array[(t + q) * a.itemSize + c]; }); g2.setAttribute(k, new THREE.BufferAttribute(arr, a.itemSize, a.normalized)); } return g2; };
  mesh.geometry = pick(C); const cy = (bb.min.y + bb.max.y) / 2, hinge = [];
  for (const [list, sd] of [[L, -1], [R, 1]]) { const pv = new THREE.Group(); pv.position.set(cx + sd * cut, cy, 0); mesh.add(pv); const w = new THREE.Mesh(pick(list), mesh.material); w.position.set(-(cx + sd * cut), -cy, 0); pv.add(w); hinge.push({ pv, sd }); }
  return hinge;
}
export function animAlienGLB(m, t) {
  const u = m.userData, dt = Math.max(0, Math.min(0.1, t - (u.lt ?? t))); u.lt = t;
  if (u.flap) { for (const h of u.flap) h.pv.rotation.z = Math.sin(t * 14) * 0.55 * h.sd; u.body.position.y = Math.sin(t * 3) * 0.25; return; }
  if (!u.mixer) { u.body.position.y = Math.sin(t * 1.3) * 0.08; u.body.rotation.z = Math.sin(t * 0.9) * 0.04; u.body.scale.setScalar(1 + Math.sin(t * 2.1) * 0.02); return; }   // no rig (the Hive Tyrant): it breathes and sways
  const far = m.getWorldPosition(_wp).distanceToSquared(CAM); if (far > 6400) { u.acc = (u.acc || 0) + dt; return; } if (far > 1225) { u.skip = !u.skip; if (u.skip) { u.acc = (u.acc || 0) + dt; return; } }   // beyond 80 m: frozen; beyond 35 m: every other frame
  const dtA = dt + (u.acc || 0); u.acc = 0;
  let k = u.cur; if (u.type === 'broodqueen') k = Math.sin(t * 0.35) > 0.6 ? 'roar' : 'idle'; else if (dt === 0) k = 'idle'; else k = HEAVY.has(u.type) ? 'walk' : 'run';
  if (u.body.position.z < -0.15 && u.act.pounce) k = 'pounce';   // the game lunges the body forward on a strike
  if (k !== u.cur && u.act[k]) { const nx = u.act[k]; nx.reset().play(); if (u.cur && u.act[u.cur]) u.act[u.cur].crossFadeTo(nx, 0.2, false); u.cur = k; }
  u.mixer.update(dt === 0 ? 1 / 60 : Math.min(0.2, dtA) * (u.type === 'crawler' ? 1.6 : 1.1));
}

// ---- a piece of the hub's ring wall, stretched to exactly the size asked for (length along x, height, depth), base on the ground
export function wallPiece(len, h, d) {
  const src = A.h_wall; if (!src) return null; if (!src.userData.box) src.userData.box = new THREE.Box3().setFromObject(src.scene);
  const b = src.userData.box, s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3()), o = new THREE.Group(), inner = src.scene.clone(true); o.add(inner);
  inner.scale.set(len / s.x, h / s.y, d / s.z); inner.position.set(-c.x * len / s.x, -b.min.y * h / s.y, -c.z * d / s.z); return o;
}

// ---- the War Mech: a big Meshy walker; it bobs and sways as it strides (its minigun arm and rocket pod are part of the model)
export function mechGLB() {
  const o = fit('r_mech', 'h', 5.2, false); if (!A.r_mech) return null; o.traverse(q => { if (q.isMesh) { q.material = q.material.clone(); q.material.transparent = false; q.material.opacity = 1; q.material.depthWrite = true; q.castShadow = true; } });
  const g = new THREE.Group(), body = new THREE.Group(); body.add(o); o.rotation.y = Math.PI; g.add(body); g.userData = { legL: new THREE.Object3D(), legR: new THREE.Object3D(), arms: new THREE.Group(), mech: 1, glbMech: true, body }; return g;
}
// ---- vehicles: flying Meshy craft, turned to face +z (the way the game points them at their target)
export function craftGLB(name, len, ry = 0) { if (!A[name]) return null; const o = fit(name, 'w', len, true), g = new THREE.Group(); o.rotation.y = ry; g.add(o); g.userData = { rotors: [] }; return g; }
// ---- the map's sandbag walls: a round Meshy sandbag bunker lying on the ground
export function bagsGLB() { if (!A.l_sandbags) return null; const src = A.l_sandbags.scene.clone(true), o = new THREE.Group(), w = new THREE.Group(); w.add(src); src.rotation.x = -Math.PI / 2; o.add(w); w.updateMatrixWorld(true); let b = new THREE.Box3().setFromObject(w); const s = b.getSize(new THREE.Vector3()), k = 5 / Math.max(s.x, s.z); w.scale.setScalar(k); w.updateMatrixWorld(true); b = new THREE.Box3().setFromObject(w); const c = b.getCenter(new THREE.Vector3()); w.position.set(-c.x, -b.min.y - 0.1, -c.z); return o; }
// ---- a scrap pile
export function scrapGLB() { return A.s_scrap ? fit('s_scrap', 'w', 1.5, true) : null; }
// ---- bake a posed, skinned model into plain still meshes (bodies on the battlefield: they merge into the map like any rock, no bones to update)
export function bake(g) {
  g.updateMatrixWorld(true); const out = new THREE.Group(), v = new THREE.Vector3();
  g.traverse(o => {
    if (!o.isMesh || !o.visible || !o.geometry.attributes.position) return; let vis = true; for (let p = o; p; p = p.parent) if (!p.visible) vis = false; if (!vis) return;
    const src = o.geometry, pos = src.attributes.position, n = pos.count, P = new Float32Array(n * 3), geo = new THREE.BufferGeometry();
    for (let i = 0; i < n; i++) { if (o.isSkinnedMesh) o.getVertexPosition(i, v); else v.fromBufferAttribute(pos, i); v.applyMatrix4(o.matrixWorld); P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z; }
    geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
    const uv = src.attributes.uv; if (uv) { const U = new Float32Array(n * 2); for (let i = 0; i < n; i++) { U[i * 2] = uv.getX(i); U[i * 2 + 1] = uv.getY(i); } geo.setAttribute('uv', new THREE.BufferAttribute(U, 2)); }
    if (src.index) geo.setIndex(src.index.clone()); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, o.material); m.castShadow = false; m.receiveShadow = true; out.add(m);
  });
  const b = new THREE.Box3().setFromObject(out), c = b.getCenter(new THREE.Vector3()); for (const m of out.children) m.geometry.translate(-c.x, -b.min.y, -c.z); return out;
}

// ---- stretch a model to an exact footprint: w across (x), l along (z), height scaled with the width; the long side of the model runs along z
export function stretchGLB(name, w, l, hk = 1) {
  if (!A[name]) return null; const inner = A[name].scene.clone(true), turn = new THREE.Group(), o = new THREE.Group(); turn.add(inner); o.add(turn); turn.updateMatrixWorld(true);
  let b = new THREE.Box3().setFromObject(turn); let s = b.getSize(new THREE.Vector3()); if (s.x > s.z) { turn.rotation.y = Math.PI / 2; turn.updateMatrixWorld(true); b = new THREE.Box3().setFromObject(turn); s = b.getSize(new THREE.Vector3()); }
  const kx = w / (s.x || 1), kz = l / (s.z || 1), c = b.getCenter(new THREE.Vector3()); turn.position.set(-c.x, -b.max.y, -c.z); o.scale.set(kx, kx * hk, kz); return o;   // top at y = 0 (a deck surface)
}
