// Kingdom Rising — how people move: damped springs on the body's big motions (leaning into a start,
// settling after a stop, banking into turns, a cape that trails), three-beat melee swings (wind-up with a
// short hold, a fast strike, an overshooting follow-through), flinches and staggers when struck, and spell
// casting in two styles: a looping gesture by school while the bar fills, or a quick hand charge, both ending
// in a release thrust. Poses here are offsets added onto the stance set by chars.js (rotations in radians).
import { K3 } from './core.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeIn3 = (t) => t * t * t;
const easeOut2 = (t) => 1 - (1 - t) * (1 - t);

// a damped spring: hz how quickly it follows, zeta below 1 overshoots (0.4 springy, 1 none)
export function spring(rig, key, target, hz, zeta, dt) {
  const S = rig.spr || (rig.spr = {}); let s = S[key];
  if (!s) s = S[key] = { x: target, v: 0 };
  const w = 2 * Math.PI * hz; let left = Math.min(dt, 0.25);
  while (left > 1e-6) { const h = Math.min(left, 1 / 90); s.v += (w * w * (target - s.x) - 2 * zeta * w * s.v) * h; s.x += s.v * h; left -= h; }
  return s.x;
}

// add a pose (bone -> [x, y, z]) times a weight onto the bones
function add(B, pose, k) {
  if (!k) return;
  for (const b in pose) { const r = B[b]; if (!r) continue; const p = pose[b]; r.rotation.x += p[0] * k; r.rotation.y += p[1] * k; r.rotation.z += p[2] * k; }
}

// ---------------------------------------------------------------- leaning, banking, settling
// st.acc: forward acceleration (m/s²), st.yawRate (rad/s), speed from the gait. Leans into a start, leans
// back on a stop and springs past upright, banks into turns. Runs before the legs are solved.
export function bodyLean(rig, B, st, dt) {
  const sp = rig.gv || 0;
  const leanT = clamp((st.acc || 0) * 0.022, -0.2, 0.2);
  const lean = spring(rig, 'lean', leanT, 3.2, 0.42, dt); // underdamped: a stop rocks past upright and settles
  const bankT = clamp(sp * (st.yawRate || 0) * 0.035, -0.24, 0.24);
  const bank = spring(rig, 'bank', bankT, 4, 0.7, dt);
  B.spine.rotation.x += lean * 0.55; B.chest.rotation.x += lean * 0.35; B.hips.rotation.x += lean * 0.12;
  B.neck.rotation.x -= lean * 0.4; // the eyes stay level
  B.hips.rotation.z -= bank * 0.35; B.spine.rotation.z -= bank * 0.45; B.neck.rotation.z += bank * 0.5;
  // breathing quickens after running, and the weight shifts from foot to foot while standing
  rig.exert = clamp((rig.exert || 0) + (sp > 3 ? dt * 0.25 : -dt * 0.06), 0, 1);
  rig.brT = (rig.brT || 0) + dt * (1.6 + 2.2 * rig.exert);
  const br = Math.sin(rig.brT) * (0.018 + 0.03 * rig.exert);
  B.chest.rotation.x -= br; B.spine.rotation.x += br * 0.3; B.neck.rotation.x += br * 0.5;
  const idle = 1 - clamp(sp / 0.6, 0, 1);
  if (idle > 0.01) { const sh = Math.sin(rig.t * 0.42 + (rig.seed || 0)) * idle; B.hips.rotation.z += sh * 0.03; B.spine.rotation.z -= sh * 0.035; }
}

// ---------------------------------------------------------------- melee
// how heavy each kind of swing is: daggers and fists are quick, two-handers slow and committed
const WEIGHT = { thrust: 0.7, punch: 0.6, slash: 1, staff: 1.15, chop: 1.4, claw: 1.05 };
// wind-up (W) and strike-end (S) poses; variants alternate forehand, backhand, overhead
const SWINGS = {
  slash: [
    { W: { armR: [-1.6, 0, -0.9], foreR: [-0.9, 0, 0], chest: [0, 0.55, 0], spine: [0, 0.2, 0], hips: [0, 0.18, 0] }, S: { armR: [-0.55, 0, 0.75], foreR: [-0.2, 0, 0], chest: [0.08, -0.62, 0], spine: [0.05, -0.25, 0], hips: [0, -0.22, 0] } },
    { W: { armR: [-1.45, 0, 0.55], foreR: [-1.5, 0, 0], chest: [0, -0.5, 0], spine: [0, -0.18, 0], hips: [0, -0.15, 0] }, S: { armR: [-0.75, 0, -1.05], foreR: [-0.3, 0, 0], chest: [0.06, 0.6, 0], spine: [0, 0.22, 0], hips: [0, 0.2, 0] } },
    { W: { armR: [-2.7, 0, -0.25], foreR: [-0.95, 0, 0], chest: [-0.22, 0.15, 0], spine: [-0.1, 0, 0] }, S: { armR: [-0.4, 0, 0.12], foreR: [-0.2, 0, 0], chest: [0.36, -0.1, 0], spine: [0.2, 0, 0], neck: [-0.15, 0, 0] } },
  ],
  chop: [
    { W: { armR: [-2.5, 0, -0.3], armL: [-2.4, 0, 0.05], foreR: [-0.8, 0, 0], foreL: [-0.9, 0, 0], chest: [-0.25, 0.35, 0], spine: [-0.12, 0.15, 0] }, S: { armR: [-0.3, 0, 0.22], armL: [-0.38, 0, -0.2], foreR: [-0.3, 0, 0], foreL: [-0.35, 0, 0], chest: [0.48, -0.3, 0], spine: [0.26, -0.1, 0], neck: [-0.25, 0, 0] } },
    { W: { armR: [-1.9, 0, -1.0], armL: [-1.7, 0, -0.5], foreR: [-0.7, 0, 0], foreL: [-1.1, 0, 0], chest: [-0.08, 0.75, 0], spine: [0, 0.3, 0], hips: [0, 0.25, 0] }, S: { armR: [-0.5, 0, 0.8], armL: [-0.6, 0, 0.6], foreR: [-0.25, 0, 0], foreL: [-0.5, 0, 0], chest: [0.25, -0.75, 0], spine: [0.1, -0.3, 0], hips: [0, -0.25, 0] } },
  ],
  thrust: [
    { W: { armR: [-0.35, 0, -0.15], foreR: [-1.95, 0, 0], chest: [0, 0.42, 0], spine: [0, 0.15, 0] }, S: { armR: [-1.55, 0, 0.05], foreR: [-0.05, 0, 0], chest: [0.12, -0.42, 0], spine: [0.08, -0.15, 0], thighL: [-0.3, 0, 0] } },
    { W: { armR: [-1.2, 0, -0.6], foreR: [-1.7, 0, 0], chest: [0, 0.3, 0] }, S: { armR: [-1.3, 0, 0.5], foreR: [-0.15, 0, 0], chest: [0.1, -0.5, 0], thighL: [-0.25, 0, 0] } },
  ],
  punch: [
    { W: { armR: [-0.5, 0, -0.1], foreR: [-2.1, 0, 0], chest: [0, 0.32, 0], hips: [0, 0.15, 0] }, S: { armR: [-1.5, 0, 0.1], foreR: [-0.08, 0, 0], chest: [0.06, -0.48, 0], hips: [0, -0.2, 0] } },
    { W: { armL: [-0.5, 0, 0.1], foreL: [-2.1, 0, 0], chest: [0, -0.32, 0], hips: [0, -0.15, 0] }, S: { armL: [-1.5, 0, -0.1], foreL: [-0.08, 0, 0], chest: [0.06, 0.48, 0], hips: [0, 0.2, 0] } },
  ],
  staff: [
    { W: { armR: [-2.2, 0, -0.5], armL: [-1.2, 0, 0.3], foreR: [-0.7, 0, 0], foreL: [-0.6, 0, 0], chest: [-0.15, 0.4, 0] }, S: { armR: [-0.5, 0, 0.4], armL: [-1.1, 0, -0.2], foreR: [-0.3, 0, 0], foreL: [-0.4, 0, 0], chest: [0.3, -0.4, 0], spine: [0.12, 0, 0] } },
  ],
  claw: [
    { W: { armR: [-2.3, 0, -0.4], armL: [-2.0, 0, 0.3], foreR: [-0.5, 0, 0], foreL: [-0.5, 0, 0], chest: [-0.2, 0, 0] }, S: { armR: [-0.5, 0, 0.4], armL: [-0.6, 0, -0.35], foreR: [-0.1, 0, 0], foreL: [-0.1, 0, 0], chest: [0.4, 0, 0], spine: [0.15, 0, 0] } },
  ],
};
// which bones belong to the body (they lead the swing) and which to the arms (they trail)
const BODY = { hips: 1, spine: 1, chest: 1, neck: 1, thighL: 1, thighR: 1 };
function split(pose) { const b = {}, a = {}; for (const k in pose) (BODY[k] ? b : a)[k] = pose[k]; return [b, a]; }
const SPLIT = {}; for (const k in SWINGS) SPLIT[k] = SWINGS[k].map((v) => ({ W: split(v.W), S: split(v.S) }));

// st.atk: 0 -> 1 after the blow lands (the game applies damage the moment it starts); st.wind: 0..1 as the
// next auto-attack approaches (from the attack timer), so the wind-up is seen before the hit, not after it.
// st.freeze: hit-stop. Returns true while a swing is shown.
export function melee(rig, B, st, dt) {
  const kind = st.atkKind; if (!SWINGS[kind]) { rig.sw = null; return false; }
  const W = WEIGHT[kind] || 1; const a = st.atk || 0; const sdt = st.freeze ? dt * 0.04 : dt;
  // a new blow: start the strike from wherever the wind-up got to
  if (a > 0 && (rig.prevA == null || rig.prevA === 0 || a < rig.prevA - 0.2)) {
    const n = (rig.swN = (rig.swN || 0) + 1); const vars = SPLIT[kind];
    rig.sw = { t: 0, v: kind === 'punch' ? n % 2 : n % vars.length, from: rig.windK || 0, kind };
  }
  rig.prevA = a;
  // the wind-up builds as the next swing nears (ease-out, then a short hold at the top)
  const want = st.wind != null && !rig.sw ? clamp(st.wind, 0, 1) : 0;
  rig.windK = (rig.windK || 0) + (easeOut2(want) - (rig.windK || 0)) * Math.min(1, sdt * 18);
  const sw = rig.sw;
  if (!sw) {
    // show the wind-up of the swing that comes next (the same variant the strike will use)
    if (rig.windK > 0.01) { const n = (rig.swN || 0) + 1, vars = SPLIT[kind]; const nv = vars[kind === 'punch' ? n % 2 : n % vars.length]; add(B, nv.W[0], rig.windK); add(B, nv.W[1], rig.windK); return true; }
    return false;
  }
  if (sw.kind !== kind) { rig.sw = null; return false; }
  sw.t += sdt;
  const strikeT = 0.075 * W, follow = 0.26 * W, recover = 0.32 * W;
  const P = SPLIT[kind][sw.v] || SPLIT[kind][0];
  // the body leads the arm by a few hundredths of a second, and the arm drags the weapon
  const phase = (t) => {
    const s = easeIn3(clamp(t / strikeT, 0, 1)); // the strike: slow out of the hold, fast into contact
    const f = clamp((t - strikeT) / follow, 0, 1); const over = Math.sin(Math.PI * f) * (1 - f) * 0.35; // carries past the end and settles
    const r = sm(0, 1, (t - strikeT - follow * 0.55) / recover); // back to guard
    return { wind: sw.from * (1 - s), strike: (s + over) * (1 - r) };
  };
  const pb = phase(sw.t + 0.035 * W), pa = phase(sw.t);
  add(B, P.W[0], pb.wind); add(B, P.S[0], pb.strike); add(B, P.W[1], pa.wind); add(B, P.S[1], pa.strike);
  // a small lunge into the blow: the hips push forward and drop a little
  const lunge = Math.sin(Math.PI * clamp(sw.t / (strikeT + follow), 0, 1));
  const sc = rig.dims ? rig.dims.scale : 1; B.hips.position.z += 0.07 * W * lunge * sc; B.hips.position.y -= 0.03 * W * lunge * sc;
  if (sw.t > strikeT + follow + recover) rig.sw = null;
  return true;
}

// ---------------------------------------------------------------- struck: flinch or stagger
// st.hurt: { t (seconds since the blow, after hit-stop), fx, fz (push direction in the body's frame), mag }
export function hurt(rig, B, st) {
  const h = st.hurt; if (!h) return;
  const t = h.t; if (t < 0 || t > 1.2) return;
  const big = h.mag >= 0.15; const dur = big ? 0.9 : 0.35;
  const env = t < 0.06 ? t / 0.06 : Math.exp(-(t - 0.06) * (big ? 4 : 9)) * Math.cos((t - 0.06) * (big ? 6 : 10)) * (t < dur ? 1 : 1 - sm(dur, dur + 0.3, t));
  const k = env * (big ? 2 : 1);
  B.chest.rotation.x += h.fz * 0.22 * k; B.spine.rotation.x += h.fz * 0.12 * k; B.neck.rotation.x += h.fz * 0.25 * k;
  B.chest.rotation.z -= h.fx * 0.2 * k; B.spine.rotation.z -= h.fx * 0.1 * k;
  B.armL.rotation.z += 0.15 * Math.abs(k); B.armR.rotation.z -= 0.15 * Math.abs(k);
  if (big) { const sc = rig.dims ? rig.dims.scale : 1; B.hips.position.z += h.fz * 0.06 * env * sc; B.hips.position.y -= 0.04 * Math.abs(env) * sc; }
}

// ---------------------------------------------------------------- casting
// gestures by school of magic: each a loop that never stops moving while the bar fills
function gesture(B, school, w, k, p) {
  const s = Math.sin(w), c = Math.cos(w);
  switch (school) {
    case 'Abjuration': // hands rise overhead, palms out
      add(B, { armL: [-2.55 + s * 0.12, 0, 0.35 + c * 0.06], armR: [-2.55 - s * 0.12, 0, -0.35 - c * 0.06], foreL: [-0.3, 0, 0], foreR: [-0.3, 0, 0], chest: [-0.12, 0, 0], neck: [-0.15, 0, 0] }, k); break;
    case 'Alteration': // palms forward, a gentle push and pull
      add(B, { armL: [-1.3, 0, 0.18], armR: [-1.3, 0, -0.18], foreL: [-0.75 + s * 0.4, 0, 0], foreR: [-0.75 + s * 0.4, 0, 0], chest: [-0.04 + s * 0.03, 0, 0] }, k); break;
    case 'Conjuration': // drawing power up from the ground with both hands
      { const u = 0.5 + 0.5 * s; add(B, { armL: [-0.45 - 0.75 * u, 0, 0.3], armR: [-0.45 - 0.75 * u, 0, -0.3], foreL: [-0.9 + 0.3 * u, 0, 0], foreR: [-0.9 + 0.3 * u, 0, 0], chest: [0.22 - 0.3 * u, 0, 0], spine: [0.15 - 0.15 * u, 0, 0] }, k); break; }
    case 'Divination': // one hand to the brow, the other reaching out
      add(B, { armR: [-2.0, 0, -0.1], foreR: [-2.15 + s * 0.06, 0, 0], armL: [-1.35 + s * 0.08, 0, 0.25], foreL: [-0.2, 0, 0], neck: [0.1, 0, 0] }, k); break;
    case 'Song': // the bard's hands work the instrument and the body sways with the tune
      add(B, { armR: [-0.9 + Math.sin(w * 2) * 0.12, 0, -0.2], foreR: [-1.6, 0, 0], armL: [-1.1, 0, 0.35], foreL: [-1.3, 0, 0], spine: [0, 0, s * 0.06], chest: [0, s * 0.08, 0] }, k); break;
    default: // Evocation and the rest: hands circle in front of the chest, opposite each other
      add(B, { armL: [-1.25 + s * 0.22, 0, 0.32 + c * 0.16], armR: [-1.25 - s * 0.22, 0, -0.32 + c * 0.16], foreL: [-1.25 + c * 0.25, 0, 0], foreR: [-1.25 - c * 0.25, 0, 0], chest: [-0.06, s * 0.05, 0] }, k);
  }
}
// a quick hand charge for fast spells: the casting hand pulls back to the shoulder as power builds
function charge(B, p, t, k) {
  const e = easeOut2(clamp(p, 0, 1)); const j = Math.sin(t * 47) * 0.02 * e;
  add(B, { armR: [-1.0 - 0.35 * e + j, 0, -0.35 - 0.25 * e], foreR: [-1.4 - 0.6 * e, 0, 0], armL: [-0.9, 0, 0.3], foreL: [-0.9, 0, 0], chest: [0, 0.25 * e, 0], spine: [0, 0.1 * e, 0] }, k);
}
// st.cast: { p (0..1 of the bar), school, dur } or null; st.rel: seconds since a spell went off; st.fizzle: since a spell broke
export function casting(rig, B, st, dt) {
  const c = st.cast; const on = c ? 1 : 0;
  rig.castK = (rig.castK || 0) + (on - (rig.castK || 0)) * Math.min(1, dt * (on ? 7 : (st.fizzle != null && st.fizzle < 0.3 ? 14 : 5)));
  if (c) { rig.castSchool = c.school; rig.castStyle = c.dur <= 1.25 ? 'charge' : 'loop'; rig.castP = c.p; }
  const k = sm(0, 1, rig.castK);
  if (k > 0.005) {
    const p = rig.castP || 0;
    // the loop runs a little faster near the end of the bar, signalling that the spell is about to go off
    rig.castW = (rig.castW || 0) + dt * (2 * Math.PI / 0.95) * (p > 0.85 ? 1.5 : 1);
    if (rig.castStyle === 'charge') charge(B, p, rig.t, k); else gesture(B, rig.castSchool, rig.castW, k, p);
  }
  // release: a fast thrust toward the target, a lean into it, and a spring back
  const r = st.rel;
  if (r != null && r >= 0 && r < 0.6) {
    const out = r < 0.09 ? easeOut2(r / 0.09) : 1; const back = sm(0.12, 0.6, r); const over = Math.sin(Math.PI * clamp((r - 0.09) / 0.25, 0, 1)) * 0.25 * (1 - back);
    const amt = out * (1 - back) + over;
    const both = rig.castStyle !== 'charge';
    add(B, { armR: [-1.55, 0, 0.05], foreR: [-0.05, 0, 0], chest: [0.09, -0.15, 0], spine: [0.04, -0.08, 0] }, amt);
    if (both) add(B, { armL: [-1.5, 0, -0.05], foreL: [-0.08, 0, 0] }, amt);
  }
}

// ---------------------------------------------------------------- looking at things
// head turns toward the target within limits, the neck and a little of the spine helping, on a spring
export function look(rig, B, st, dt) {
  let y = st.lookYaw != null ? st.lookYaw : 0;
  if (Math.abs(y) > 1.75) y = 0; // too far behind: let go rather than flip
  y = clamp(y, -1.22, 1.22);
  const v = spring(rig, 'look', y, 2.4, 0.9, dt);
  B.head.rotation.y += v * 0.45; B.neck.rotation.y += v * 0.4; if (Math.abs(v) > 0.87) B.chest.rotation.y += (v - Math.sign(v) * 0.87) * 0.3;
}

// ---------------------------------------------------------------- cape: trails behind, swings on stops and turns
export function cape(rig, B, st, dt, m) {
  if (!B.capeA) return;
  const sp = rig.gv || 0;
  const tA = 0.06 + clamp(sp * 0.11, 0, 0.75) - clamp((st.acc || 0) * 0.02, -0.25, 0.25) + (st.sit ? 0.6 : 0);
  const a = spring(rig, 'capeA', tA, 2.2, 0.35, dt), b = spring(rig, 'capeB', tA * 0.7 + 0.04, 1.8, 0.3, dt);
  const sway = spring(rig, 'capeS', -clamp((st.yawRate || 0) * 0.15, -0.4, 0.4), 2, 0.4, dt);
  const fl = Math.sin(rig.t * 3.1) * 0.03 * (0.4 + m) + Math.sin(rig.t * 7.3) * 0.015 * clamp(sp / 4, 0, 1);
  B.capeA.rotation.x = a + fl; B.capeB.rotation.x = b + fl * 1.6; B.capeA.rotation.z = sway; B.capeB.rotation.z = sway * 1.4;
}
