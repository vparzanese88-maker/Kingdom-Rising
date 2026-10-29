// Aeternum Wilds creatures: the one entry point. makeCreature(kind, o) builds an animal or monster in the
// game's beast format { root, body, mats, parts:{torso, head, tail, legs:[4]}, size, beast:true };
// animCreature(model, st) poses it every frame; tintModel(model, hex) flashes it (keeping its own glow).
//
// Kinds: wolf, direwolf, mirehound, spiritwolf, boar, bear, deer, rabbit (four-legged, furred, skinned),
// spider, raven, golem, treant, earth_elemental, ghost, fire_elemental, water_elemental, air_elemental.
import { THREE, clamp, uTime } from './core.js';
import { G } from '../../state.js';
import { QUAD_KINDS, buildQuad, quadInstance, animQuad } from './quad.js';
import { buildSpider, spiderInstance, animSpider, buildRaven, ravenInstance, animRaven, buildBrute, bruteInstance, animBrute, buildSpirit, animSpirit } from './others.js';

export const CREATURE_KINDS = new Set([...QUAD_KINDS, 'spider', 'raven', 'golem', 'treant', 'earth_elemental', 'ghost', 'fire_elemental', 'water_elemental', 'air_elemental']);
const DEFAULT_COL = { wolf: 0x7b7468, direwolf: 0x3b3833, mirehound: 0x4d5f3a, spiritwolf: 0x8ac8ff, boar: 0x5a4030, bear: 0x5a3a22, deer: 0x9a6a3a, rabbit: 0xa89478, spider: 0x2a2420, raven: 0x15151c };

// bodies are built once per kind and colour (the slow part: meshing the smooth body); each creature only
// gets its own bones and materials
const templates = new Map();
function template(kind, color, eyes) {
  const key = kind + '|' + color + '|' + (eyes ?? '');
  let t = templates.get(key);
  if (!t) {
    if (QUAD_KINDS.has(kind)) t = buildQuad(kind, color);
    else if (kind === 'spider') t = buildSpider(color);
    else if (kind === 'raven') t = buildRaven(color, eyes != null ? '#' + new THREE.Color(eyes).getHexString() : null);
    else t = buildBrute(kind);
    templates.set(key, t);
  }
  return t;
}
// build the bodies ahead of time (call during loading) so the first wolf doesn't hitch the game
export function prewarmCreatures(list) { for (const [kind, color] of list) { try { template(kind, color ?? DEFAULT_COL[kind]); } catch (e) { console.warn('creature prewarm', kind, e); } } }

let seedN = 1;
export function makeCreature(kind, o = {}) {
  if (!CREATURE_KINDS.has(kind)) kind = 'wolf';
  const color = o.color ?? DEFAULT_COL[kind] ?? 0x777777;
  let rig;
  if (QUAD_KINDS.has(kind)) rig = quadInstance(template(kind, color));
  else if (kind === 'spider') rig = spiderInstance(template('spider', color));
  else if (kind === 'raven') rig = ravenInstance(template('raven', color, o.eyes));
  else if (kind === 'golem' || kind === 'treant' || kind === 'earth_elemental') rig = bruteInstance(template(kind, 0));
  else rig = buildSpirit(kind, o.color);
  rig.kind = kind; rig.seed = (seedN++ * 2.399) % 6.283;
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body); body.add(rig.mesh);
  const s = o.size || 1; const vary = o.exact ? 1 : 0.95 + Math.random() * 0.1; body.scale.setScalar(s * vary);
  // eye colour for the glowing-eyed (spirit wolves keep their whole body aglow)
  if (kind === 'spiritwolf') { const m = rig.mats[0]; m.transparent = true; m.opacity = 0.78; m.emissive.setHex(0x2a70d0); m.emissiveIntensity = 1; m.userData.baseEmissive = new THREE.Color(0x2a70d0); m.depthWrite = true; }
  const B = rig.bones || {};
  const dummy = () => { const d = new THREE.Group(); body.add(d); return d; };
  const parts = rig.type === 'spirit'
    ? { torso: rig.parts.torso, head: rig.parts.head, tail: dummy(), legs: [rig.parts.armL, rig.parts.armR, dummy(), dummy()] }
    : rig.type === 'quad' ? { torso: B.root, head: B.head, tail: B.tail1, legs: [B.FL1, B.FR1, B.BL1, B.BR1] }
    : rig.type === 'spider' ? { torso: B.root, head: B.head, tail: B.abd, legs: [B.L0l1, B.L0r1, B.L3l1, B.L3r1] }
    : rig.type === 'raven' ? { torso: B.root, head: B.head, tail: B.tail, legs: [B.WL1, B.WR1, B.legL, B.legR] }
    : { torso: B.chest, head: B.head, tail: B.hips, legs: [B.thighL, B.thighR, B.armL, B.armR] };
  for (const m of rig.mats) if (!m.userData.baseEmissive) m.userData.baseEmissive = m.emissive.clone();
  root.userData.creature = kind;
  return { root, body, mats: rig.mats, parts, size: s, beast: true, creature: rig, kind, height: heightOf(rig) * s };
}
function heightOf(rig) {
  if (rig.type === 'quad') return rig.sp.H + rig.sp.br * 1.4 + (rig.sp.neck || 0) * 0.6;
  if (rig.type === 'brute') return 2.6 * rig.S; if (rig.type === 'spider') return 0.8; if (rig.type === 'raven') return 2.0;
  return 2.1;
}
// a hit flash or a glow on top of the creature's own (glowing eyes and bodies stay lit)
const _c = new THREE.Color();
export function tintModel(model, hex) {
  _c.setHex(hex || 0);
  for (const m of model.mats) { if (!m.emissive) continue; let b = m.userData.baseEmissive; if (!b) b = m.userData.baseEmissive = m.emissive.clone(); m.emissive.copy(b).add(_c); }
}

const _v = new THREE.Vector3();
// st: { move, phase, pose ('windup'|'strike'|'stun'|'dead'|'hit'|null), t, hurt {t, dx, dz, mag}, charge, side, alert }
export function animCreature(b, st) {
  const rig = b.creature; if (!rig) return;
  const now = G.time || 0; let dt = b._t == null ? 0 : clamp(now - b._t, 0, 0.1); b._t = now;
  uTime.value = now;
  // how far it moved since last frame, in its own body's units: the gaits follow distance, so feet don't slide
  const p = b.root.position; let dist = 0;
  if (b._px != null) { dist = Math.hypot(p.x - b._px, p.z - b._pz) / (b.body.scale.x || 1); if (dist > 2) dist = 0; }
  b._px = p.x; b._pz = p.z;
  // far from the camera: no fur, and the pose is updated less often
  const cam = G.camera; let far = 0;
  if (cam) { _v.setFromMatrixPosition(b.root.matrixWorld); const d = cam.position.distanceTo(p); far = d; if (rig.fur) rig.fur.visible = d < 30; }
  b._acc = (b._acc || 0) + dt; b._accD = (b._accD || 0) + dist;
  const rate = far > 70 ? 8 : far > 40 ? 15 : 0;
  if (rate && b._acc < 1 / rate && st.pose !== 'dead') return;
  dt = b._acc; dist = b._accD; b._acc = 0; b._accD = 0;
  const pose = st.pose; const t = st.t || 0;
  const S = { dist, wind: 0, atk: 0, stun: pose === 'stun', dead: pose === 'dead', deadT: pose === 'dead' ? t : 0, charge: !!st.charge, alert: !!st.alert };
  if (pose === 'windup') S.wind = clamp(t, 0.001, 1);
  else if (pose === 'strike') S.atk = clamp(t, 0.01, 0.99);
  // a blow: the push direction in the creature's own frame
  let h = st.hurt;
  if (!h && pose === 'hit') h = { t: t * 0.3, dx: -Math.sin(b.root.rotation.y), dz: -Math.cos(b.root.rotation.y), mag: 0.1 };
  if (h) {
    const yaw = b.root.rotation.y, cy = Math.cos(yaw), sy = Math.sin(yaw);
    const l = Math.hypot(h.dx || 0, h.dz || 0) || 1; const dx = (h.dx || 0) / l, dz = (h.dz || 0) / l;
    S.hurt = { t: h.t || 0, fx: dx * cy - dz * sy, fz: dx * sy + dz * cy, mag: h.mag || 0.1 };
  }
  if (S.dead) S.side = st.side || b._side || (b._side = S.hurt ? (S.hurt.fx >= 0 ? 1 : -1) : (rig.seed > 3.14 ? 1 : -1));
  else b._side = S.hurt ? (S.hurt.fx >= 0 ? 1 : -1) : b._side;
  switch (rig.type) {
    case 'quad': animQuad(rig, S, dt); break;
    case 'spider': animSpider(rig, S, dt); break;
    case 'raven': animRaven(rig, S, dt); break;
    case 'brute': animBrute(rig, S, dt); break;
    case 'spirit': animSpirit(rig, S, dt); break;
  }
}
