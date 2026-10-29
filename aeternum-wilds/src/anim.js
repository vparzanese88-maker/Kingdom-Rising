// Procedural animation. Real people (gfx/human: a skinned MakeHuman body) get full-body motion: legs that plant
// their feet (gait.js), a body that leans into starts and turns, breathes and shifts its weight, and attacks in four
// beats (anticipation, strike, follow-through, recovery) whose moment of contact lands on the game's hit time, all
// blended on springs so nothing snaps. A weapon arm is posed by where the weapon is: each key gives the grip's place
// round the body and the way the blade points, and the arm reaches there (two-bone IK) with the fist turned round the
// grip; a two-handed haft takes the other hand too. The old box figures (fallback) keep the simple animation below.
import * as THREE from 'three';
import { G } from './state.js';
import { legs as gaitLegs, reach, ik2, meshPos, meshQ, dims } from './gfx/human/gait.js';

const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const angD = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
const DEG = Math.PI / 180;

// st: { move 0..1, phase, pose, t (0..1), twoHand, draw } plus, for real people (all optional):
// wt (weapon type), hit (0..1: when in t the blow lands), air (0..1 through a jump), ready (0..1 weapon up),
// lookAt {x,y,z} (world), lookPitch (radians, the player's aim), dir {x,z} (dodge direction, world), loop (spin cycles)
export function animHumanoid(h, st) {
  if (h.rig) return animRig(h, st);
  return animBox(h, st);
}

// ---------------------------------------------------------------- springs and helpers
function spring(an, key, target, hz, zeta, dt) {
  let s = an.spr[key]; if (!s) s = an.spr[key] = { x: target, v: 0 };
  const w = 2 * Math.PI * hz; let left = Math.min(dt, 0.1);
  while (left > 1e-6) { const hh = Math.min(left, 1 / 90); s.v += (w * w * (target - s.x) - 2 * zeta * w * s.v) * hh; s.x += s.v * hh; left -= hh; }
  return s.x;
}
const BONES = ['hips', 'spine', 'chest', 'neck', 'head', 'shL', 'shR', 'armL', 'armR', 'foreL', 'foreR', 'handL', 'handR'];
const ARM = { armL: 1, armR: 1, foreL: 1, foreR: 1, handL: 1, handR: 1 };
const LEGB = ['thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];
const newT = () => { const T = {}; for (const b of BONES) T[b] = [0, 0, 0]; return T; };
const addP = (T, P, k) => { if (!P || !k) return; for (const b in P) { const t = T[b], p = P[b]; if (!t || !p) continue; t[0] += p[0] * k; t[1] += p[1] * k; t[2] += p[2] * k; } };
const setP = (T, P, k) => { if (!P || !k) return; for (const b in P) { const t = T[b], p = P[b]; if (!t || !p) continue; t[0] = lerp(t[0], p[0], k); t[1] = lerp(t[1], p[1], k); t[2] = lerp(t[2], p[2], k); } };
const lerpA = (a, b, f) => a.map((x, i) => lerp(x, b[i], f));
// keyframes [[u, key, easing], ...]; key: { b: body bones (added), a: arm bones (set), W: weapon [gripAz°, r, y, bladeAz°, bladeEl°],
// L: left-hand place on a two-handed haft (metres along it), hp: hips offset, st: stance (lunge), op: open hands }.
// Missing values hold the stance (base).
function keys(K, u, base) {
  let i = 0; while (i < K.length - 2 && u > K[i + 1][0]) i++;
  const [u0, A, ea] = K[i], [u1, Bk] = K[i + 1];
  let f = clamp((u - u0) / Math.max(1e-4, u1 - u0), 0, 1);
  f = ea === 'in' ? f * f * f : ea === 'out' ? 1 - (1 - f) ** 3 : ea === 'lin' ? f : ea === 'in2' ? f * f : f * f * (3 - 2 * f);
  const o = { b: {}, a: {}, W: null, L: null, hp: [0, 0, 0], st: 0, op: 0 };
  const zb = [0, 0, 0];
  for (const n of new Set([...Object.keys(A.b || {}), ...Object.keys(Bk.b || {})])) o.b[n] = lerpA((A.b || {})[n] || zb, (Bk.b || {})[n] || zb, f);
  for (const n of new Set([...Object.keys(A.a || {}), ...Object.keys(Bk.a || {})])) o.a[n] = lerpA((A.a || {})[n] || base.T[n], (Bk.a || {})[n] || base.T[n], f);
  if (base.W || A.W || Bk.W) o.W = lerpA(A.W || base.W, Bk.W || base.W, f);
  o.L = lerp(A.L ?? base.L, Bk.L ?? base.L, f);
  o.hp = lerpA(A.hp || zb, Bk.hp || zb, f); o.st = lerp(A.st || 0, Bk.st || 0, f); o.op = lerp(A.op || 0, Bk.op || 0, f);
  return o;
}
// attack time to the authored timeline: contact (the game's hit) always at u = 0.5
const toU = (t, hit) => (hit == null ? 0.42 + 0.58 * t : t < hit ? 0.5 * t / hit : 0.5 + 0.5 * (t - hit) / Math.max(0.05, 1 - hit));

// ---------------------------------------------------------------- stances: how each weapon is carried
const RELAX = { armL: [0.03, 0, 0.06], armR: [0.03, 0, -0.06], foreL: [-0.16, 0, 0], foreR: [-0.16, 0, 0], handL: [0, 0, -0.1], handR: [0, 0, 0.1] };
// the weapon hand when carrying: [relaxed, ready] grip and blade; L: where the left hand sits on a two-handed haft
const CARRY = {
  '1h': { rest: [-14, 0.24, 0.93, 2, -42], ready: [-34, 0.4, 1.1, 8, 40] },
  '2h': { rest: [-38, 0.3, 1.0, 30, 58], ready: [-30, 0.36, 1.08, 38, 62], L: 0.34 },
  staff: { rest: [-28, 0.3, 1.0, 0, 84], ready: [-30, 0.36, 1.1, 2, 82] },
};
const SHIELD = { armL: [-0.32, -0.75, 0.42], foreL: [-1.35, 0.15, 0], handL: [0.1, 0, -0.25] };
const BOWCARRY = { armL: [-0.1, 0, 0.12], foreL: [-0.5, 0, 0], handL: [1.15, 0, -0.1] };
const IDLES = {
  cross: { armL: [-0.45, -0.6, -0.1], foreL: [-1.9, 0, 0], armR: [-0.45, 0.6, 0.1], foreR: [-1.85, 0, 0], handL: [0, 0, 0.2], handR: [0, 0, -0.2] },
  hips: { armL: [0.15, 0.7, 0.55], foreL: [-1.5, 0, 0], armR: [0.15, -0.7, -0.55], foreR: [-1.5, 0, 0], handL: [0.3, 0, -0.5], handR: [0.3, 0, 0.5] },
  behind: { armL: [0.35, 0.2, 0.05], foreL: [-0.6, 0, 0], armR: [0.35, -0.2, -0.05], foreR: [-0.6, 0, 0], handL: [0, 0, 0.3], handR: [0, 0, -0.3] },
};

// ---------------------------------------------------------------- the moves (u: 0.3 anticipation, 0.5 contact, 0.66 follow-through)
const SW = {
  // one-handed forehand: cocked over the right shoulder, swept flat across the front, carried round to the left
  slash: [[0, {}], [0.3, { b: { hips: [0, -0.24, 0], spine: [0, -0.2, 0.03], chest: [-0.05, -0.4, 0.06], neck: [0, 0.32, 0] }, W: [-100, 0.3, 1.72, -150, 32], hp: [-0.04, -0.03, -0.04] }, 'in'],
    [0.5, { b: { hips: [0, 0.06, 0], spine: [0.05, 0.06, 0], chest: [0.1, 0.12, -0.03], neck: [0, -0.1, 0] }, W: [-30, 0.58, 1.36, 22, -2], hp: [0.02, -0.06, 0.12] }, 'out'],
    [0.66, { b: { hips: [0, 0.26, 0], spine: [0.06, 0.26, 0], chest: [0.12, 0.42, -0.05], neck: [0, -0.32, 0] }, W: [48, 0.5, 1.2, 112, -14], hp: [0.04, -0.06, 0.14] }],
    [1, {}]],
  // backhand: from over the left shoulder back across to the right
  slash2: [[0, {}], [0.3, { b: { hips: [0, 0.2, 0], spine: [0, 0.2, -0.03], chest: [-0.04, 0.42, -0.06], neck: [0, -0.32, 0] }, W: [35, 0.28, 1.66, 165, 30], hp: [0.04, -0.03, -0.03] }, 'in'],
    [0.5, { b: { hips: [0, -0.05, 0], spine: [0.04, -0.06, 0], chest: [0.08, -0.12, 0.03], neck: [0, 0.1, 0] }, W: [-8, 0.58, 1.34, -24, -2], hp: [-0.02, -0.06, 0.12] }, 'out'],
    [0.66, { b: { hips: [0, -0.24, 0], spine: [0.05, -0.24, 0], chest: [0.1, -0.42, 0.04], neck: [0, 0.32, 0] }, W: [-72, 0.5, 1.2, -118, -14], hp: [-0.04, -0.06, 0.14] }],
    [1, {}]],
  // the point drawn back to the hip, then driven straight out with a long step in behind it
  thrust: [[0, {}], [0.3, { b: { hips: [0, -0.28, 0], spine: [-0.02, -0.2, 0], chest: [-0.05, -0.38, 0], neck: [0, 0.4, 0] }, W: [-75, 0.3, 1.18, -2, 6], hp: [-0.02, -0.04, -0.08] }, 'in'],
    [0.5, { b: { hips: [0, 0.18, 0], spine: [0.06, 0.12, 0], chest: [0.1, 0.25, 0], neck: [0, -0.3, 0] }, W: [-6, 0.82, 1.36, 0, 0], hp: [0, -0.12, 0.26], st: 1 }, 'out'],
    [0.72, { b: { hips: [0, 0.18, 0], spine: [0.06, 0.12, 0], chest: [0.1, 0.24, 0], neck: [0, -0.28, 0] }, W: [-8, 0.78, 1.33, -2, -3], hp: [0, -0.12, 0.24], st: 1 }],
    [1, {}]],
  // two-handed: the whole body turns into it, hips first, and it carries far round
  slash2h: [[0, {}], [0.3, { b: { hips: [0, -0.42, 0], spine: [-0.02, -0.32, 0.04], chest: [-0.08, -0.55, 0.08], neck: [0, 0.55, 0] }, W: [-112, 0.32, 1.6, -165, 30], L: -0.26, hp: [-0.06, -0.05, -0.05] }, 'in'],
    [0.5, { b: { hips: [0, 0.08, 0], spine: [0.05, 0.1, 0], chest: [0.12, 0.15, -0.04], neck: [0, -0.15, 0] }, W: [-18, 0.56, 1.22, 25, -6], L: -0.26, hp: [0.03, -0.09, 0.12] }, 'out'],
    [0.7, { b: { hips: [0, 0.42, 0], spine: [0.06, 0.38, 0], chest: [0.14, 0.55, -0.06], neck: [0, -0.5, 0] }, W: [70, 0.45, 1.1, 135, -12], L: -0.26, hp: [0.06, -0.08, 0.14] }],
    [1, {}]],
  slash2h2: [[0, {}], [0.3, { b: { hips: [0, 0.36, 0], spine: [0, 0.3, -0.04], chest: [-0.06, 0.52, -0.06], neck: [0, -0.5, 0] }, W: [55, 0.3, 1.6, 160, 32], L: -0.26, hp: [0.06, -0.05, -0.04] }, 'in'],
    [0.5, { b: { hips: [0, -0.06, 0], spine: [0.05, -0.08, 0], chest: [0.1, -0.15, 0.04], neck: [0, 0.15, 0] }, W: [-5, 0.56, 1.22, -22, -6], L: -0.26, hp: [-0.03, -0.09, 0.12] }, 'out'],
    [0.7, { b: { hips: [0, -0.4, 0], spine: [0.06, -0.36, 0], chest: [0.12, -0.55, 0.06], neck: [0, 0.5, 0] }, W: [-85, 0.45, 1.1, -130, -12], L: -0.26, hp: [-0.06, -0.08, 0.14] }],
    [1, {}]],
  // overhead: up behind the head with the back arched, then everything comes down into the blow
  overhead: [[0, {}], [0.32, { b: { spine: [-0.12, -0.05, 0], chest: [-0.22, -0.08, 0], neck: [0.22, 0, 0] }, W: [-10, 0.12, 2.0, 178, 35], L: -0.24, hp: [0, 0.02, -0.07] }, 'in'],
    [0.5, { b: { spine: [0.26, 0, 0], chest: [0.4, 0.04, 0], neck: [-0.4, 0, 0] }, W: [-4, 0.6, 1.24, 0, -14], L: -0.24, hp: [0, -0.15, 0.15], st: 0.7 }, 'out'],
    [0.68, { b: { spine: [0.32, 0, 0], chest: [0.48, 0.04, 0], neck: [-0.48, 0, 0] }, W: [-4, 0.56, 1.05, 0, -30], L: -0.24, hp: [0, -0.18, 0.17], st: 0.7 }],
    [1, {}]],
  // the hammer slam: up on the toes with the hammer high behind, then a deep drop that drives it into the ground
  slam: [[0, {}], [0.3, { b: { spine: [-0.16, 0, 0], chest: [-0.28, -0.06, 0], neck: [0.28, 0, 0] }, W: [-6, 0.1, 2.08, 180, 52], L: -0.26, hp: [0, 0.08, -0.05] }, 'in'],
    [0.5, { b: { spine: [0.45, 0, 0], chest: [0.52, 0, 0], neck: [-0.55, 0, 0] }, W: [-3, 0.6, 1.0, 0, -22], L: -0.26, hp: [0, -0.34, 0.12], st: 1 }, 'out'],
    [0.78, { b: { spine: [0.45, 0, 0], chest: [0.5, 0, 0], neck: [-0.52, 0, 0] }, W: [-3, 0.6, 0.98, 0, -24], L: -0.26, hp: [0, -0.32, 0.12], st: 1 }],
    [1, {}]],
  // the greataxe spin: coiled to the right, the whole body turns a full circle with the axe at arm's length
  spin: [[0, {}], [0.25, { b: { hips: [0, -0.35, 0], spine: [0.05, -0.3, 0], chest: [0.05, -0.5, 0], neck: [0, 0.5, 0] }, W: [-140, 0.42, 1.28, -175, 8], L: -0.26, hp: [0, -0.1, 0] }, 'in'],
    [0.45, { b: { hips: [0, 0.05, 0], spine: [0.08, 0.05, 0], chest: [0.08, 0.1, 0] }, W: [-55, 0.62, 1.22, -85, -4], L: -0.26, hp: [0, -0.15, 0] }],
    [0.8, { b: { hips: [0, 0.05, 0], spine: [0.08, 0.05, 0], chest: [0.08, 0.1, 0] }, W: [-50, 0.6, 1.2, -78, -4], L: -0.26, hp: [0, -0.12, 0] }],
    [1, {}]],
  // staff: a jab of the staff head toward the target as the bolt flies, the free hand thrown out too
  jab: [[0, {}], [0.3, { b: { chest: [-0.05, -0.3, 0], neck: [0, 0.28, 0] }, W: [-55, 0.28, 1.22, -10, 72], a: { armL: [-0.7, 0, 0.3], foreL: [-1.2, 0, 0], handL: [0, 0, -0.3] }, hp: [0, -0.02, -0.05] }, 'in'],
    [0.5, { b: { chest: [0.08, 0.22, 0], neck: [0, -0.2, 0] }, W: [-14, 0.66, 1.42, 0, 32], a: { armL: [-1.3, 0, 0.25], foreL: [-0.4, 0, 0], handL: [-0.5, 0, -0.3] }, hp: [0, -0.05, 0.1], op: 1 }, 'out'],
    [0.7, { b: { chest: [0.08, 0.2, 0], neck: [0, -0.18, 0] }, W: [-16, 0.62, 1.38, 0, 38], a: { armL: [-1.2, 0, 0.25], foreL: [-0.5, 0, 0], handL: [-0.4, 0, -0.3] }, hp: [0, -0.05, 0.08], op: 1 }],
    [1, {}]],
};
function moveFor(pose, ctx) {
  const two = ctx.carry === '2h';
  if (pose === 'slash') return two ? SW.slash2h : ctx.carry === 'staff' ? SW.jab : SW.slash;
  if (pose === 'slash2') return two ? SW.slash2h2 : SW.slash2;
  if (pose === 'thrust') return ctx.carry === 'staff' ? SW.jab : SW.thrust;
  if (pose === 'overhead') return SW.overhead;
  if (pose === 'slam') return SW.slam;
  if (pose === 'spin') return SW.spin;
  return null;
}
const ATTACKS = { slash: 1, slash2: 1, thrust: 1, overhead: 1, slam: 1, spin: 1 };

// everything else: returns { b, a, W, L, hp, st, op, legFK, legs, spin, roll, fall, air, bowIK }
function action(h, st, ctx, base, an) {
  const pose = st.pose; const t = st.t || 0;
  const mv = moveFor(pose, ctx);
  if (mv) {
    let u = pose === 'spin' && st.loop ? 0.62 : toU(t, st.hit);
    // a heavy blow that was wound up while the button was held starts from that wind-up
    if (st.wound > 0 && u < 0.3) { const a0 = (pose === 'spin' ? 0.25 : 0.3); u = lerp(a0 * st.wound, a0, u / 0.3); }
    const o = keys(mv, u, base);
    if (pose === 'spin') o.spin = st.loop ? t * Math.PI * 2 : Math.PI * 2 * sm(0.3, 0.8, u);
    if (!ctx.W) o.W = null;
    return o;
  }
  const o = { b: {}, a: {}, W: null, L: base.L, hp: [0, 0, 0], st: 0, op: 0 };
  switch (pose) {
    case 'windup': { // a heavy blow being charged (or an enemy's telegraph): the anticipation of what is coming, straining
      const k = sm(0, 1, Math.min(1, t * 1.15));
      const which = ctx.wt === 'greataxe' ? SW.spin : ctx.wt === 'hammer' ? SW.slam : ctx.wt === 'sword' ? SW.thrust : ctx.carry === 'staff' ? null : ctx.carry === '2h' ? SW.overhead : SW.slash;
      if (!which) { o.a = { armL: [-1.1, 0, 0.35], foreL: [-0.9, 0, 0], handL: [0, 0, -0.5] }; o.b = { chest: [-0.06, -0.15, 0] }; o.W = ctx.W ? lerpA(base.W, [-40, 0.42, 1.25, 0, 75], k) : null; o.op = 1; o.shake = k; if (!ctx.W) o.a = { ...o.a, armR: [-1.1, 0, -0.35], foreR: [-0.9, 0, 0] }; return o; }
      const P = keys(which, (which === SW.spin ? 0.25 : 0.3) * k, base);
      if (!ctx.W) { P.W = null; P.a = { armR: [-2.4 * k, 0, -0.3 * k], foreR: [-0.9 * k, 0, 0], ...P.a }; }
      P.shake = k * k;
      return P;
    }
    case 'block': {
      if (ctx.shield) { o.a = { armL: [-0.95, -1.25, 0.12], foreL: [-1.7, 0.25, 0], handL: [0.1, 0, -0.3] }; o.W = ctx.W ? [-42, 0.32, 1.2, 12, 52] : null; o.b = { spine: [0.08, -0.12, 0], chest: [0.06, -0.15, 0], neck: [-0.05, 0.25, 0] }; }
      else if (ctx.carry === '2h') { o.W = [-38, 0.42, 1.48, 88, 14]; o.L = 0.42; o.b = { spine: [0.08, 0, 0], chest: [0.06, 0.12, 0] }; }
      else { o.W = ctx.W ? [-25, 0.4, 1.45, 85, 30] : null; o.a = { armL: [-0.8, -0.3, 0.2], foreL: [-1.6, 0, 0] }; o.b = { spine: [0.08, 0, 0] }; }
      o.hp = [0, -0.07, -0.02]; o.st = 0.6;
      return o;
    }
    case 'draw': case 'aim': case 'shoot': { // the bow: side-on, the bow arm straight at the target, the string drawn to the cheek
      const d = pose === 'draw' ? clamp(st.draw ?? 0, 0, 1) : pose === 'aim' ? clamp(t, 0, 1) : 0;
      const rel = pose === 'shoot' ? (t < 0.15 ? t / 0.15 : Math.exp(-(t - 0.15) * 6)) : 0;
      // side-on, left shoulder to the target: the bow fist straight out in front, the riser upright, canted a touch
      o.WL = [6 + 4 * rel, 0.66 - 0.03 * rel, 1.44 + 0.02 * rel, -8, 78];
      o.a = { armR: [-1.45 - 0.1 * d, -0.1, 0.55 - 0.15 * d], foreR: [-1.0 - 1.3 * d, 0.5, 0], handR: [0, 0, 0.3] };
      if (rel) { o.a.armR = [-1.25, -0.3, -0.45]; o.a.foreR = [-1.5, 0.4, 0]; o.a.handR = [0, 0, -0.4]; }
      o.b = { hips: [0, -0.28, 0], spine: [0, -0.24, 0], chest: [-0.03, -0.36 - 0.05 * d, 0.02], neck: [0, 0.45, 0], head: [0.04, 0.32, -0.04] };
      o.bowIK = pose !== 'shoot' || t < 0.1; o.st = 0.8; o.op = rel > 0.3 ? 1 : 0;
      return o;
    }
    case 'cast': { // both hands thrown forward and up, palms open; looping when held (recall)
      const loop = t === 0;
      const w = loop ? Math.sin(an.t * 4) : 0;
      const k = loop ? 1 : (t < 0.35 ? sm(0, 0.35, t) : 1 - sm(0.75, 1, t) * 0.6);
      o.a = { armL: [-1.6 - 0.5 * k - w * 0.1, 0, 0.35], foreL: [-0.5, 0, 0], handL: [-0.6, 0, -0.3] };
      if (ctx.W) o.W = [-20, 0.5 + 0.1 * k, 1.35 + 0.25 * k, 0, 55 + 20 * k]; else o.a = { ...o.a, armR: [-1.6 - 0.5 * k + w * 0.1, 0, -0.35], foreR: [-0.5, 0, 0], handR: [-0.6, 0, 0.3] };
      o.b = { spine: [-0.06 * k, 0, 0], chest: [-0.12 * k, 0, 0], neck: [-0.15 * k, 0, 0] }; o.op = 1; o.hp = [0, -0.02, 0];
      return o;
    }
    case 'gather': { // an axe or pick swung down into the work, again and again
      const c = (t / 0.9) % 1; const up = sm(0, 0.55, c), hit = sm(0.55, 0.68, c), back = sm(0.7, 1, c);
      const r = up * (1 - hit), s = hit * (1 - back);
      o.a = { armR: [-0.6 - 2.1 * r - 0.5 * s, 0, -0.1], foreR: [-0.5 - 0.7 * r, 0, 0], handR: [0.2, 0, 0], armL: [-0.7 - 1.9 * r - 0.5 * s, 0, 0.15], foreL: [-0.9 - 0.4 * r, 0, 0], handL: [0, 0, -0.4] };
      o.b = { chest: [-0.2 * r + 0.4 * s, 0.25 * r - 0.1 * s, 0], spine: [0.1 + 0.25 * s, 0, 0], neck: [0.15 * s, 0, 0] }; o.hp = [0, -0.06 - 0.06 * s, 0]; o.st = 0.7; o.noW = 1;
      return o;
    }
    case 'harvest': { // down on one knee, working with the hands
      const saw = Math.sin(t * 9);
      o.a = { armR: [-1.0 + saw * 0.25, 0, -0.1], foreR: [-0.6 - saw * 0.2, 0, 0], armL: [-0.8, 0, 0.2], foreL: [-0.7, 0, 0] };
      o.b = { spine: [0.35, 0, 0], chest: [0.25, 0.1 * saw, 0], neck: [0.3, 0, 0] }; o.hp = [0, -0.48, 0]; o.legFK = 1; o.noW = 1;
      o.legs = { thighL: [-1.4, 0, 0.1], shinL: [1.5, 0, 0], footL: [0, 0, 0], thighR: [-0.15, 0, -0.1], shinR: [1.9, 0, 0], footR: [0.9, 0, 0] };
      return o;
    }
    case 'swap': { // over the shoulder for the other weapon
      const k = Math.sin(t * Math.PI);
      o.a = { armR: [-2.4 * k, 0.4 * k, -0.5 * k], foreR: [-1.7 * k, 0, 0] }; o.b = { chest: [0, -0.3 * k, 0], neck: [0, 0.2 * k, 0] }; o.noW = k;
      return o;
    }
    case 'dodge': { // a roll the way the body is going, tucked up tight
      const e = sm(0, 1, t); const tuck = Math.sin(Math.PI * clamp(t * 1.1, 0, 1));
      o.roll = { a: e * Math.PI * 2, dir: an.rollDir };
      o.a = { armL: [-1.4 * tuck, 0, 0.2 * tuck], foreL: [-1.6 * tuck, 0, 0] };
      if (ctx.W) o.W = lerpA(base.W, [-20, 0.25, 1.1, 0, 60], tuck); else o.a = { ...o.a, armR: [-1.4 * tuck, 0, -0.2 * tuck], foreR: [-1.6 * tuck, 0, 0] };
      o.b = { spine: [0.5 * tuck, 0, 0], chest: [0.4 * tuck, 0, 0], neck: [0.5 * tuck, 0, 0] };
      o.hp = [0, -0.5 * tuck, 0]; o.legFK = sm(0, 0.15, t) * (1 - sm(0.85, 1, t));
      o.legs = { thighL: [-2.1, 0, 0.1], shinL: [2.3, 0, 0], footL: [0.5, 0, 0], thighR: [-1.9, 0, -0.1], shinR: [2.3, 0, 0], footR: [0.5, 0, 0] };
      return o;
    }
    case 'hop': { // a quick sidestep in heavy armour
      const k = Math.sin(Math.PI * t);
      o.hp = [an.rollDir[0] * 0.05 * k, 0.1 * k, an.rollDir[1] * 0.04 * k]; o.air = t;
      o.b = { spine: [0.1 * k, 0, -an.rollDir[0] * 0.15 * k], chest: [0.05 * k, 0, 0] };
      return o;
    }
    case 'stun': { // reeling: hunched, head lolling, arms loose
      const w = an.t * 3;
      o.a = { armL: [0.1, 0, 0.3], foreL: [-0.3, 0, 0] };
      if (!ctx.W) o.a = { ...o.a, armR: [0.1, 0, -0.3], foreR: [-0.3, 0, 0] }; else o.W = lerpA(base.W, CARRY[ctx.carry].rest, 1);
      o.b = { spine: [0.3, 0, Math.sin(w) * 0.08], chest: [0.2, 0, 0], neck: [0.3, 0, Math.sin(w + 1) * 0.25], head: [0.1, Math.sin(w * 0.7) * 0.3, 0] };
      o.hp = [Math.sin(w) * 0.03, -0.12, 0]; o.st = 0.5;
      return o;
    }
    case 'dead': { // knees give, then the body falls back and goes slack (t: seconds)
      const buckle = sm(0, 0.3, t), fall = sm(0.15, 0.85, t), slack = sm(0.6, 1.3, t);
      const s = an.deadSide;
      o.fall = fall; o.legFK = sm(0, 0.25, t); o.noW = 1;
      o.legs = { thighL: [-0.9 * buckle + 0.75 * fall, 0, 0.12 + 0.1 * s], shinL: [1.4 * buckle - 1.1 * fall, 0, 0], footL: [0.4 * fall, 0, 0], thighR: [-1.0 * buckle + 0.55 * fall, 0, -0.08], shinR: [1.5 * buckle - 0.9 * fall, 0, 0], footR: [0.5 * fall, 0, 0] };
      o.a = { armL: [-0.4 * buckle - 1.2 * fall * (0.5 + s * 0.3), 0, 0.3 + 1.0 * slack], foreL: [-0.6 * buckle + 0.3 * fall, 0, 0], armR: [-0.5 * buckle - 1.2 * fall * (0.5 - s * 0.3), 0, -0.3 - 1.1 * slack], foreR: [-0.7 * buckle + 0.2 * fall, 0, 0], handL: [0, 0, 0.3], handR: [0, 0, -0.3] };
      o.b = { spine: [0.35 * buckle - 0.3 * fall, 0, 0.1 * s * slack], chest: [0.25 * buckle - 0.2 * fall, 0, 0], neck: [0.3 * buckle - 0.5 * fall, 0.5 * s * slack, 0], head: [0, 0.4 * s * slack, 0.2 * s * slack] };
      o.hp = [0, -0.35 * buckle, -0.1 * buckle]; o.dead = true;
      return o;
    }
  }
  return null;
}

// ---------------------------------------------------------------- the weapon arm: reach the grip, turn the fist round it
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _m = new THREE.Matrix4();
const _gp = new THREE.Vector3(), _bd = new THREE.Vector3(), _f = new THREE.Vector3(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _sh = new THREE.Vector3(), _el = new THREE.Vector3(), _wr = new THREE.Vector3(), _ax = new THREE.Vector3(), _pole = new THREE.Vector3();
const _hq = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _fq = new THREE.Quaternion();
const _fk = { L: [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()], R: [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()] };
// W [gripAz°, r, y, bladeAz°, bladeEl°] -> grip position and blade direction (mesh space)
function wPlace(W, hp, gp, bd) {
  const a = W[0] * DEG; gp.set(Math.sin(a) * W[1] + hp[0], W[2] + hp[1], Math.cos(a) * W[1] + hp[2]);
  const ba = W[3] * DEG, be = W[4] * DEG; bd.set(Math.cos(be) * Math.sin(ba), Math.sin(be), Math.cos(be) * Math.cos(ba));
}
// the fist's orientation (mesh space) for a grip whose haft runs along bd with the forearm along f; returns the tilt of
// the weapon in the fist (how far the blade leans toward the fingers)
function fist(f, bd, out) {
  const c = bd.dot(f); let tilt = Math.asin(clamp(c, -1, 1));
  _z.copy(bd).addScaledVector(f, -c);
  if (_z.lengthSq() < 0.02) { _z.set(0, 1, 0).addScaledVector(f, -f.y); if (_z.lengthSq() < 0.02) _z.set(0, 0, 1).addScaledVector(f, -f.z); }
  _z.normalize(); _y.copy(f).negate(); _x.crossVectors(_y, _z);
  _m.makeBasis(_x, _y, _z); out.setFromRotationMatrix(_m);
  return clamp(tilt, -0.6, 1.45);
}
// place the arm S so its grip sits at gp with the haft along bd (also used by the first-person arms)
export function weaponArm(rig, S, gp, bd, pole, gripG, w = 1) {
  const B = rig.bones, D = dims(rig);
  const up = B['arm' + S], fo = B['fore' + S], ha = B['hand' + S];
  const f0 = _fk[S]; f0[0].copy(up.quaternion); f0[1].copy(fo.quaternion); f0[2].copy(ha.quaternion);
  meshPos(up, _sh); meshQ(up.parent, _pq);
  const go = rig.hands[S].grip;
  // first guess: the wrist a hand's length back from the grip toward the shoulder
  _wr.copy(gp).sub(_sh).normalize().multiplyScalar(-0.07).add(gp);
  let tilt = 0;
  for (let it = 0; it < 2; it++) {
    const qf = ik2(up, fo, D['arm' + S], _sh, _wr, pole, _pq, _fq);
    // forearm direction from the solved elbow to the wrist
    _el.copy(D['arm' + S].up).applyQuaternion(_q3.copy(_pq).multiply(up.quaternion)).add(_sh);
    _f.copy(_wr).sub(_el).normalize();
    tilt = fist(_f, bd, _hq);
    // the wrist so that the grip point (inside the fist, tilted with the weapon) lands on gp
    _v.set(go[0], go[1], go[2]).applyQuaternion(_hq);
    _wr.copy(gp).sub(_v);
    if (it === 1) {
      ha.quaternion.copy(qf).invert().multiply(_hq);
      // share the roll of the fist with the forearm so the wrist does not wring
      _ax.copy(D['arm' + S].lo).normalize();
      const q = ha.quaternion; const proj = q.x * _ax.x + q.y * _ax.y + q.z * _ax.z;
      _q2.set(_ax.x * proj, _ax.y * proj, _ax.z * proj, q.w); if (_q2.lengthSq() > 1e-8) { _q2.normalize(); let ang = 2 * Math.acos(clamp(_q2.w, -1, 1)); if (ang > Math.PI) ang -= Math.PI * 2; const sgn = Math.sign(proj) || 1; const share = clamp(ang * sgn * 0.55, -1.3, 1.3);
        _q3.setFromAxisAngle(_ax, share); fo.quaternion.multiply(_q3); ha.quaternion.premultiply(_q3.invert()); }
    }
  }
  if (gripG) { _e.set(tilt, 0, 0); _q.setFromEuler(_e); gripG.quaternion.copy(_q); }
  if (w < 0.999) { up.quaternion.slerpQuaternions(f0[0], _q.copy(up.quaternion), w); fo.quaternion.slerpQuaternions(f0[1], _q.copy(fo.quaternion), w); ha.quaternion.slerpQuaternions(f0[2], _q.copy(ha.quaternion), w); }
}

// ---------------------------------------------------------------- per-person state
function initAn(h) {
  const p = h.root.position;
  return { t: Math.random() * 10, at: null, px: p.x, pz: p.z, yaw: h.root.rotation.y, sp: 0, spPrev: 0, acc: 0, yawRate: 0, spr: {}, aw: 0, last: null, lastPose: null, fl: null, flT: 9, lookY: 0, lookP: 0, ready: 0, curlL: 0.3, curlR: 0.3, ikL: 0, ikR: 0, wW: 0, idleK: 0, idleKind: null, idleT: 4 + Math.random() * 6, glanceT: 2 + Math.random() * 5, glance: 0, rollDir: [0, -1], deadSide: Math.random() < 0.5 ? -1 : 1, first: true, skip: 0, dir: [0, 1], prevPose: null, breath: Math.random() * 6, W: null, L: 0.3, hp: [0, 0, 0] };
}

// a flinch from a blow: fx, fz the push direction in world space, mag 0..1
export function flinch(h, fx = 0, fz = 0, mag = 0.5) {
  if (!h || !h.rig) return;
  const an = h.an || (h.an = initAn(h));
  const yaw = h.root.rotation.y, c = Math.cos(yaw), s = Math.sin(yaw);
  const bx = fx * c - fz * s, bz = fx * s + fz * c; const l = Math.hypot(bx, bz);
  an.fl = { x: l > 0.01 ? bx / l : 0, z: l > 0.01 ? bz / l : -1, mag: clamp(mag, 0.15, 1) }; an.flT = 0;
}

const ATTACK_RATE = 30, BASE_RATE = 13;
function animRig(h, st) {
  const rig = h.rig, B = rig.bones; const an = h.an || (h.an = initAn(h));
  const now = st.now ?? (G.mode === 'game' ? G.time : performance.now() / 1000);
  let dt = st.dt ?? (an.at == null ? 1 / 60 : now - an.at);
  if (an.at != null && dt <= 0 && st.dt == null) return; // paused, or a second call this frame
  an.at = now; dt = clamp(dt, 0, 0.1);
  // level of detail: lighter meshes and less work further from the camera
  const rp = h.root.position, cam = G.camera;
  const d = cam ? Math.hypot(cam.position.x - rp.x, cam.position.y - rp.y, cam.position.z - rp.z) : 5;
  rig.setLod(d);
  // root motion: how far and which way the body moved since the last frame, in its own frame
  const yaw = h.root.rotation.y, scl = h.body.scale.x || 1;
  let mdx = rp.x - an.px, mdz = rp.z - an.pz; an.px = rp.x; an.pz = rp.z;
  if (an.first || mdx * mdx + mdz * mdz > 9) { mdx = 0; mdz = 0; }
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const bx = (mdx * cy - mdz * sy) / scl, bz = (mdx * sy + mdz * cy) / scl;
  let dist = Math.hypot(bx, bz);
  const dyaw = an.first ? 0 : angD(an.yaw, yaw); an.yaw = yaw;
  an.yawRate = lerp(an.yawRate, dyaw / Math.max(dt, 1e-3), Math.min(1, dt * 8));
  if (dist > 1e-4) an.dir = [bx / dist, bz / dist];
  if (!h.root.visible && !st.force) { an.first = false; return; }
  // far away people animate less often
  if (d > 45 && !an.first) { an.skip += dt; an.skipD = (an.skipD || 0) + dist; if (an.skip < 0.1) return; dt = Math.min(0.15, an.skip); dist = an.skipD; an.skip = 0; an.skipD = 0; }
  an.t += dt;
  const v = dt > 0 ? dist / dt : 0;
  an.sp = lerp(an.sp, v, Math.min(1, dt * (v > an.sp ? 12 : 8)));
  const acc = (an.sp - an.spPrev) / Math.max(dt, 1e-3); an.spPrev = an.sp; an.acc = lerp(an.acc, acc, Math.min(1, dt * 10));
  // turning on the spot: the feet shuffle round instead of skating
  let gdist = dist, gdir = an.dir;
  if (v < 0.4 && Math.abs(dyaw) > 0.002) { gdist += Math.abs(dyaw) * 0.22; gdir = [0, 1]; }
  const m = sm(0.08, 0.9, an.sp);

  // ---- what they hold, and how ready they are ----
  const P = h.parts;
  const hasR = P.handR.children.length > 0, hasL = P.handL.children.length > 0;
  const shield = P.foreL && P.foreL.children.length > 0;
  // a bow is gripped by its riser: its limbs (+y) run through the fist like any haft
  if (hasL) { const bw = P.handL.children[0]; if (bw.userData.string && !bw.userData.gripFix) { bw.userData.gripFix = true; if (Math.abs(bw.rotation.x) < 1e-3) bw.rotation.x = Math.PI / 2; } }
  const wt = st.wt;
  const carry = wt === 'greataxe' || wt === 'hammer' || (hasR && st.twoHand) ? '2h' : wt === 'bow' || (!hasR && hasL) ? 'bow' : wt === 'staff' ? 'staff' : hasR ? '1h' : 'none';
  const readyT = st.ready ?? (carry === 'none' ? 0 : 0.7);
  an.ready = lerp(an.ready, readyT, Math.min(1, dt * 5));
  const CW = CARRY[carry];
  const ctx = { wt, carry, shield, hasR, hasL, W: !!CW && hasR };
  const pose = st.pose === 'hit' ? null : st.pose;
  if (st.pose === 'hit' && an.prevPose !== 'hit') flinch(h, -Math.sin(yaw), -Math.cos(yaw), 0.6);
  an.prevPose = st.pose;
  if ((pose === 'dodge' || pose === 'hop') && an.lastPose !== pose) { const dd = st.dir ? [st.dir.x * cy - st.dir.z * sy, st.dir.x * sy + st.dir.z * cy] : dist > 1e-4 ? an.dir : [0, -1]; const l = Math.hypot(dd[0], dd[1]) || 1; an.rollDir = [dd[0] / l, dd[1] / l]; }
  if (pose === 'dead' && an.lastPose !== 'dead') an.deadSide = Math.random() < 0.5 ? -1 : 1;

  // ---- moving sideways or backwards: the legs and hips turn toward the way they go, the chest keeps facing ahead ----
  let ta = Math.atan2(an.dir[0], an.dir[1]); if (Math.abs(ta) > Math.PI / 2 + 0.15) ta -= Math.PI * Math.sign(ta);
  const legBusy = pose && (ATTACKS[pose] || pose === 'dodge' || pose === 'dead' || pose === 'harvest' || pose === 'hop');
  const legYaw = spring(an, 'legYaw', legBusy ? 0 : clamp(ta, -0.95, 0.95) * m, 2.6, 0.9, dt);
  { const c2 = Math.cos(legYaw), s2 = Math.sin(legYaw); gdir = [gdir[0] * c2 - gdir[1] * s2, gdir[0] * s2 + gdir[1] * c2]; }

  // ---- the stance ----
  const T = newT(); const hp = [0, 0, 0];
  T.spine[1] -= legYaw * 0.45; T.chest[1] -= legYaw * 0.4; T.neck[1] -= legYaw * 0.15;
  setP(T, RELAX, 1);
  let W = ctx.W ? lerpA(CW.rest, CW.ready, an.ready) : null;
  let Lh = CW && CW.L != null ? CW.L : -0.26;
  if (shield) setP(T, SHIELD, sm(0, 1, an.ready + 0.3));
  if (carry === 'bow') setP(T, BOWCARRY, 1);
  if (h.hunched) { T.spine[0] += 0.32; T.chest[0] += 0.28; T.neck[0] -= 0.38; T.head[0] -= 0.12; T.armL[0] -= 0.2; T.armR[0] -= 0.2; T.foreL[0] -= 0.3; T.foreR[0] -= 0.3; if (W) W[2] -= 0.12; }
  const still = m < 0.05 && !pose;
  if (carry === 'none' && !st.noIdle) {
    an.idleT -= dt;
    if (an.idleT <= 0) { an.idleT = 6 + Math.random() * 9; const r = Math.random(); an.idleKind = h.hunched ? null : r < 0.3 ? 'cross' : r < 0.5 ? 'hips' : r < 0.65 ? 'behind' : null; }
    an.idleK = lerp(an.idleK, still && an.idleKind ? 1 : 0, Math.min(1, dt * 2.5));
    if (an.idleK > 0.01 && an.idleKind) setP(T, IDLES[an.idleKind], sm(0, 1, an.idleK));
  }
  // ---- walking and running: arms swing against the legs, the pelvis turns with the step, the shoulders counter it ----
  const run = sm(2.3, 5.0, an.sp);
  const ph = (rig.gp || 0) * Math.PI * 2, c = Math.cos(ph);
  const fwd = gdir[1];
  if (m > 0.02) {
    const A = (0.3 + 0.32 * run) * m * Math.max(0.25, Math.abs(fwd));
    const freeL = carry === 'none' || carry === 'staff' || (carry === '1h' && !shield);
    const freeR = carry === 'none' || carry === 'bow';
    if (freeL) { T.armL[0] += c * A; T.foreL[0] -= (0.1 + 1.0 * run) * m + Math.max(0, -c) * 0.25 * m; T.armL[2] += 0.06 * run * m; }
    else T.armL[0] += c * A * 0.25;
    if (freeR) { T.armR[0] -= c * A; T.foreR[0] -= (0.1 + 1.0 * run) * m + Math.max(0, c) * 0.25 * m; T.armR[2] -= 0.06 * run * m; }
    if (W) { W[0] -= c * 9 * A; W[2] += Math.abs(Math.sin(ph)) * 0.025 * m - 0.02 * run; W[4] -= 8 * run * m; }
    T.hips[1] -= c * (0.08 + 0.05 * run) * m; T.chest[1] += c * (0.1 + 0.08 * run) * m;
    T.spine[0] += (0.04 + 0.16 * run) * m * fwd; T.hips[2] -= Math.sin(ph * 2) * 0.03 * m * (1 - run);
    T.neck[1] -= c * (0.1 + 0.08 * run) * m * 0.85; T.neck[0] -= (0.03 + 0.1 * run) * m * Math.max(0, fwd);
  }
  // ---- leaning into starts and stops, banking into turns, breathing ----
  const lean = spring(an, 'lean', clamp(an.acc * 0.02, -0.18, 0.18), 3.2, 0.42, dt);
  const bank = spring(an, 'bank', clamp(an.sp * an.yawRate * 0.03, -0.22, 0.22), 4, 0.7, dt);
  T.spine[0] += lean * 0.55 * fwd; T.chest[0] += lean * 0.3 * fwd; T.neck[0] -= lean * 0.4 * fwd;
  T.hips[2] -= bank * 0.35; T.spine[2] -= bank * 0.45; T.neck[2] += bank * 0.5;
  an.exert = clamp((an.exert || 0) + (an.sp > 3 ? dt * 0.25 : -dt * 0.06), 0, 1);
  an.breath += dt * (1.7 + 2.2 * an.exert);
  const br = Math.sin(an.breath) * (0.018 + 0.03 * an.exert);
  T.chest[0] -= br; T.spine[0] += br * 0.3; T.neck[0] += br * 0.5; T.shL[2] += br * 0.3; T.shR[2] -= br * 0.3;
  if (W) W[2] += br * 0.15;
  const idle = 1 - clamp(an.sp / 0.6, 0, 1);
  if (idle > 0.01) { const sh = Math.sin(an.t * 0.42 + (h.seed || 0) * 6) * idle; T.hips[2] += sh * 0.035; T.spine[2] -= sh * 0.04; hp[0] += sh * 0.015; }

  // ---- the move being made, blended in and out ----
  const base = { T, W, L: Lh };
  let A = pose ? action(h, st, ctx, base, an) : null;
  if (A) { an.last = A; an.lastPose = pose; an.aw = lerp(an.aw, 1, Math.min(1, dt * (ATTACKS[pose] ? 40 : 14))); }
  else { an.lastPose = pose; an.aw = lerp(an.aw, 0, Math.min(1, dt * 7)); if (an.aw < 0.01) an.last = null; A = an.last; }
  const aw = A ? an.aw : 0;
  let noW = 0;
  if (A && aw > 0) {
    setP(T, A.a, aw); addP(T, A.b, aw);
    hp[0] += A.hp[0] * aw; hp[1] += A.hp[1] * aw; hp[2] += A.hp[2] * aw;
    if (W && A.W) W = lerpA(W, A.W, aw);
    if (A.L != null) Lh = lerp(Lh, A.L, aw);
    if (A.shake) { const s = A.shake * 0.012; T.chest[1] += Math.sin(an.t * 37) * s; if (W) { W[0] += Math.sin(an.t * 41) * A.shake * 1.2; W[2] += Math.sin(an.t * 33) * A.shake * 0.006; } }
    noW = (A.noW || 0) * aw;
  }
  if (W && legYaw) { W[0] -= legYaw / DEG; W[3] -= legYaw / DEG; }
  // ---- struck: a flinch that snaps in and springs back ----
  an.flT += dt;
  if (an.fl && an.flT < 0.9) {
    const f = an.fl, tt = an.flT; const big = f.mag > 0.55;
    const env = tt < 0.05 ? tt / 0.05 : Math.exp(-(tt - 0.05) * (big ? 5 : 8)) * Math.cos((tt - 0.05) * (big ? 7 : 10));
    const k = env * f.mag * 1.4;
    T.chest[0] += f.z * 0.28 * k; T.spine[0] += f.z * 0.14 * k; T.neck[0] += f.z * 0.3 * k + 0.1 * Math.abs(k); T.head[0] -= 0.12 * Math.abs(k);
    T.chest[2] -= f.x * 0.25 * k; T.spine[2] -= f.x * 0.12 * k; T.chest[1] += f.x * 0.15 * k;
    T.armL[2] += 0.18 * Math.abs(k); T.armR[2] -= 0.18 * Math.abs(k); T.armL[0] -= 0.15 * Math.abs(k); T.armR[0] -= 0.1 * Math.abs(k);
    if (W) { W[2] += 0.06 * Math.abs(k); W[1] -= 0.05 * Math.abs(k); }
    hp[2] += f.z * 0.05 * k; hp[0] += f.x * 0.04 * k; hp[1] -= 0.04 * Math.abs(k);
  }
  // ---- looking: at a target, or where the player aims ----
  let ly = 0, lp = 0;
  if (st.lookAt) {
    const dx = st.lookAt.x - rp.x, dz = st.lookAt.z - rp.z;
    const lx = dx * cy - dz * sy, lz = dx * sy + dz * cy; let a = Math.atan2(lx, lz);
    if (Math.abs(a) > 1.9) a = 0; ly = clamp(a, -1.2, 1.2);
    const hd = Math.hypot(dx, dz); lp = clamp(-Math.atan2((st.lookAt.y ?? rp.y + 1.6) - (rp.y + 1.6 * (h.size || 1)), hd), -0.5, 0.5);
  } else if (st.lookPitch != null) lp = clamp(-st.lookPitch, -0.9, 0.9);
  else if (carry === 'none' || !pose) {
    an.glanceT -= dt; if (an.glanceT <= 0) { an.glanceT = 3 + Math.random() * 6; an.glance = Math.random() < 0.6 ? (Math.random() - 0.5) * 1.4 : 0; }
    ly = an.glance * (still ? 1 : 0);
  }
  an.lookY = spring(an, 'ly', ly, 2.2, 0.9, dt); an.lookP = spring(an, 'lp', lp, 2.5, 0.9, dt);
  T.head[1] += an.lookY * 0.5; T.neck[1] += an.lookY * 0.4; if (Math.abs(an.lookY) > 0.8) T.chest[1] += (an.lookY - Math.sign(an.lookY) * 0.8) * 0.4;
  T.head[0] += an.lookP * 0.45; T.neck[0] += an.lookP * 0.3;
  if (st.lookPitch != null && (carry === 'bow' || carry === 'staff') && pose) T.chest[0] += an.lookP * 0.35;

  // ---- onto the bones, on springs (an attack, once blended in, is shown exactly: lag would put the blade late) ----
  const fast = pose && (ATTACKS[pose] || pose === 'dodge' || pose === 'shoot' || pose === 'hop');
  const rate = an.first ? 1e9 : fast ? (ATTACKS[pose] ? lerp(ATTACK_RATE, 400, sm(0.6, 0.95, an.aw)) : ATTACK_RATE) : pose === 'dead' ? 9 : BASE_RATE;
  const k = 1 - Math.exp(-rate * dt);
  // (the hips keep their own smoothed turn: rolls and falls are put on top of it each frame, never accumulated)
  if (!an.hipsQ) an.hipsQ = new THREE.Quaternion();
  for (const b of BONES) { const r = T[b]; _e.set(r[0], r[1], r[2]); _q.setFromEuler(_e); const q = b === 'hips' ? an.hipsQ : B[b].quaternion; if (an.first) q.copy(_q); else q.slerp(_q, k); }
  B.hips.quaternion.copy(an.hipsQ);
  if (W) { if (!an.W || an.first) an.W = W.slice(); else for (let i = 0; i < 5; i++) an.W[i] = lerp(an.W[i], W[i], k); }
  an.L = an.first ? Lh : lerp(an.L, Lh, k);
  // rolls turn the whole body about the hips
  if (A && A.roll && aw > 0.01) { const rd = A.roll.dir; _ax.set(rd[1], 0, -rd[0]).normalize(); _q.setFromAxisAngle(_ax, A.roll.a * aw); B.hips.quaternion.premultiply(_q); }
  const hk = 1 - Math.exp(-(fast ? 26 : 12) * dt);
  for (let i = 0; i < 3; i++) an.hp[i] = an.first ? hp[i] : lerp(an.hp[i], hp[i], hk);
  const rest = rig.rest.hips; const D = dims(rig);
  B.hips.position.set(rest[0] + an.hp[0], rest[1] + an.hp[1], rest[2] + an.hp[2]);
  // a death fall: the whole body tips back from the feet
  if (A && A.fall) { const f = A.fall * aw; _q.setFromAxisAngle(_ax.set(1, 0, 0), -1.42 * f); B.hips.quaternion.premultiply(_q); B.hips.position.y = lerp(B.hips.position.y, 0.16 * D.scale, f); B.hips.position.z -= 0.5 * f * D.scale; }
  // the greataxe spin turns the whole figure (feet and all)
  h.body.rotation.y = (A && A.spin && pose ? A.spin : 0) + legYaw;

  // ---- legs: planted feet (gait), or posed (rolls, kneeling, falling) ----
  const legFK = A ? (A.legFK || 0) * aw : 0;
  const stance = A ? (A.st || 0) * aw : 0;
  if (d < 70 || an.first) {
    const air = st.air != null ? st.air : A && A.air != null ? A.air : null;
    if (legFK < 0.999) gaitLegs(rig, { dist: pose === 'dodge' ? 0 : gdist, dir: gdir, combat: clamp(an.ready * 0.6 + stance * 0.6, 0, 1), air, stance: stance > 0.01 ? { L: [0, 0.24 * stance * D.scale], R: [0, -0.14 * stance * D.scale] } : null }, dt, pose === 'dodge' ? 0 : m);
    if (legFK > 0.001 && A.legs) for (const b of LEGB) { const r = A.legs[b] || [0, 0, 0]; _e.set(r[0], r[1], r[2]); _q.setFromEuler(_e); B[b].quaternion.slerp(_q, legFK >= 0.999 ? (an.first ? 1 : 1 - Math.exp(-20 * dt)) : legFK); }
  }

  // ---- the weapon arm (and the other hand on a two-handed haft) ----
  an.wW = lerp(an.wW, ctx.W ? 1 - noW : 0, an.first ? 1 : Math.min(1, dt * 10));
  // the bow arm held out at the target while drawing
  if (A && A.WL && aw > 0.01 && hasL) {
    const wl = A.WL.slice(); wl[0] -= legYaw / DEG; wl[3] -= legYaw / DEG;
    if (!an.WL || an.wlK < 0.02) an.WL = wl; else for (let i = 0; i < 5; i++) an.WL[i] = lerp(an.WL[i], wl[i], k);
    an.wlK = aw; wPlace(an.WL, an.hp, _gp, _bd);
    weaponArm(rig, 'L', _gp, _bd, _pole.set(0.6, -0.6, -0.4).normalize(), P.handL, sm(0, 1, aw));
  } else an.wlK = 0;
  if (an.wW > 0.01 && an.W) {
    wPlace(an.W, an.hp, _gp, _bd);
    _pole.set(-0.55, -0.75, -0.35);
    if (_gp.y > 1.75) _pole.set(-0.9, 0.1, -0.4); // arms overhead: the elbow goes out to the side
    weaponArm(rig, 'R', _gp, _bd, _pole.normalize(), P.handR, an.wW);
    if (carry === '2h') {
      const wsc = P.handR.children[0] ? P.handR.children[0].scale.y || 1 : 1;
      _v3.copy(_gp).addScaledVector(_bd, an.L * wsc / 1.45);
      weaponArm(rig, 'L', _v3, _bd, _v2.set(0.55, -0.75, -0.35).normalize(), null, an.wW);
    }
  } else { P.handR.quaternion.slerp(_q.identity(), Math.min(1, dt * 10)); }

  // ---- fingers: fists round what they hold; the string drawn by the right hand ----
  const near = d < 30;
  if (near || an.first) {
    const holdR = hasR && noW < 0.5, holdL = (hasL && carry === 'bow') || (carry === '2h' && an.wW > 0.5);
    const open = A && A.op > 0.5 && aw > 0.5;
    const wantR = open && !holdR ? 0.08 : holdR ? 1.35 : 0.35 + Math.sin(an.t * 0.7) * 0.03;
    const wantL = open && !holdL ? 0.08 : holdL ? 1.35 : shield ? 1.1 : 0.35 + Math.sin(an.t * 0.7 + 1) * 0.03;
    an.curlR = lerp(an.curlR, wantR, Math.min(1, dt * 12)); an.curlL = lerp(an.curlL, wantL, Math.min(1, dt * 12));
    for (const S of ['L', 'R']) { const cc = S === 'L' ? an.curlL : an.curlR; const hh = rig.hands[S]; for (let f = 1; f <= 4; f++) { const sp = (f - 2.5) * 0.05; B['f' + f + S + '1'].quaternion.setFromAxisAngle(hh.axis, cc * (0.95 + sp)); B['f' + f + S + '2'].quaternion.setFromAxisAngle(hh.axis, cc * (1.05 + sp)); } B['th' + S + '1'].quaternion.setFromAxisAngle(hh.tax, cc * 0.35); B['th' + S + '2'].quaternion.setFromAxisAngle(hh.tax, cc * 0.55); }
    const wantIKR = carry === 'bow' && hasL && A && A.bowIK && aw > 0.3 ? 1 : 0;
    an.ikR = lerp(an.ikR, wantIKR, Math.min(1, dt * 16));
    if (an.ikR > 0.01) {
      h.root.updateMatrixWorld(true);
      _m.copy(rig.mesh.matrixWorld).invert();
      const bow = P.handL.children[0]; const sz = bow.userData.string ? bow.userData.string.position.z : -0.24;
      _v.set(0, 0, sz); bow.localToWorld(_v); _v.applyMatrix4(_m);
      meshQ(B.handR, _q2); _v2.set(...rig.hands.R.grip).applyQuaternion(_q2); _v.sub(_v2);
      const f = _fk.R; f[0].copy(B.armR.quaternion); f[1].copy(B.foreR.quaternion); f[2].copy(B.handR.quaternion);
      reach(rig, 'R', _v, _v3.set(-0.45, 0.1, -1).normalize(), null);
      if (an.ikR < 0.999) { B.armR.quaternion.slerpQuaternions(f[0], _q.copy(B.armR.quaternion), an.ikR); B.foreR.quaternion.slerpQuaternions(f[1], _q.copy(B.foreR.quaternion), an.ikR); }
    }
  }
  an.first = false;
}

// ---------------------------------------------------------------- the simple box figures (fallback)
// st: { move 0..1, phase, pose, t (0..1), twoHand, block, draw }
function animBox(h, st) {
  const P = h.parts;
  const mv = st.move || 0;
  const sw = Math.sin(st.phase || 0);
  P.legL.rotation.x = sw * 0.75 * mv;
  P.legR.rotation.x = -sw * 0.75 * mv;
  P.armL.rotation.set(-sw * 0.5 * mv, 0, 0);
  P.armR.rotation.set(sw * 0.5 * mv, 0, 0);
  P.upper.rotation.set(h.hunched ? 0.35 : 0, 0, 0);
  P.head.rotation.set(0, 0, 0);
  h.body.rotation.set(0, 0, 0);
  h.body.position.y = Math.abs(Math.cos(st.phase || 0)) * 0.06 * mv;
  const t = st.t || 0;
  switch (st.pose) {
    case 'slash': case 'slash2': {
      const dir = st.pose === 'slash' ? 1 : -1;
      const k = t < 0.35 ? t / 0.35 * 0.2 : 0.2 + ease((t - 0.35) / 0.65) * 0.8;
      P.upper.rotation.y = lerp(1.0, -1.2, k) * dir;
      P.armR.rotation.x = -1.5; P.armR.rotation.z = lerp(-0.4, 0.3, k) * dir;
      if (st.twoHand) { P.armL.rotation.x = -1.4; P.armL.rotation.z = -0.6; }
      else P.armL.rotation.x = -0.6;
      break;
    }
    case 'thrust': {
      const k = t < 0.4 ? -t / 0.4 : -1 + ease(Math.min(1, (t - 0.4) / 0.3)) * 2;
      P.armR.rotation.x = -1.5 + k * 0.1; P.upper.rotation.y = -k * 0.4;
      P.armL.rotation.x = -1.2;
      h.body.position.z = Math.max(0, k) * 0.3;
      break;
    }
    case 'overhead': case 'slam': {
      const k = t < 0.5 ? ease(t / 0.5) : 1 - ease(Math.min(1, (t - 0.5) / 0.2));
      const x = t < 0.5 ? lerp(-0.4, -2.9, k) : lerp(-0.4, -2.9, k);
      P.armR.rotation.x = x; P.armL.rotation.x = st.twoHand ? x : -0.5;
      if (st.twoHand) { P.armR.rotation.z = 0.2; P.armL.rotation.z = -0.2; }
      P.upper.rotation.x += t < 0.5 ? -0.2 * k : 0.35 * (1 - k);
      break;
    }
    case 'spin': {
      h.body.rotation.y = ease(t) * Math.PI * 2;
      P.armR.rotation.x = -1.5; P.armL.rotation.x = -1.5;
      P.armR.rotation.z = -0.3; P.armL.rotation.z = 0.3;
      break;
    }
    case 'draw': {
      const d = st.draw || 0;
      P.armL.rotation.x = -1.55; P.armL.rotation.z = -0.15;
      P.armR.rotation.x = -1.55 + d * 0.15; P.armR.rotation.z = 0.5 + d * 0.5;
      P.upper.rotation.y = 0.35;
      break;
    }
    case 'shoot': {
      P.armL.rotation.x = -1.55; P.armR.rotation.x = -1.3; P.armR.rotation.z = 0.4 * (1 - t);
      P.upper.rotation.y = 0.35 * (1 - t);
      break;
    }
    case 'block': {
      P.armL.rotation.x = -1.35; P.armL.rotation.z = -0.5;
      P.armR.rotation.x = -0.7;
      break;
    }
    case 'dodge': {
      const a = ease(t) * Math.PI * 2;
      h.body.rotation.x = a;
      h.body.position.y = (1 - Math.cos(a)) * 0.9 * h.size * 0.55;
      break;
    }
    case 'hop': {
      h.body.position.y = Math.sin(t * Math.PI) * 0.22;
      P.upper.rotation.x += Math.sin(t * Math.PI) * 0.35;
      P.legL.rotation.x = -0.6 * Math.sin(t * Math.PI); P.legR.rotation.x = 0.4 * Math.sin(t * Math.PI);
      break;
    }
    case 'swap': {
      const k = Math.sin(t * Math.PI);
      P.armR.rotation.x = -2.8 * k; P.armR.rotation.z = 0.4 * k;
      P.upper.rotation.y = -0.3 * k;
      break;
    }
    case 'gather': {
      const k = (Math.sin(t * Math.PI * 2 * 1.5) + 1) / 2;
      P.armR.rotation.x = lerp(-0.3, -2.4, k); P.armL.rotation.x = lerp(-0.3, -2.4, k);
      P.upper.rotation.x += 0.2;
      break;
    }
    case 'harvest': {
      P.upper.rotation.x += 0.7; P.armR.rotation.x = -0.9 + Math.sin(t * 20) * 0.3; P.armL.rotation.x = -0.9;
      break;
    }
    case 'cast': {
      P.armR.rotation.x = -2.6; P.armL.rotation.x = -2.6;
      P.armR.rotation.z = 0.4; P.armL.rotation.z = -0.4;
      break;
    }
    case 'windup': {
      P.armR.rotation.x = lerp(-0.5, -2.6, Math.min(1, t * 1.5)); P.armL.rotation.x = st.twoHand ? P.armR.rotation.x : -0.6;
      P.upper.rotation.y = 0.5 * Math.min(1, t * 2);
      break;
    }
    case 'aim': {
      P.armL.rotation.x = -1.55; P.armR.rotation.x = -1.55; P.armR.rotation.z = 0.4 + t * 0.6; P.upper.rotation.y = 0.35;
      break;
    }
    case 'stun': {
      P.head.rotation.z = Math.sin((st.phase || 0) * 3) * 0.3;
      P.armR.rotation.x = 0.2; P.armL.rotation.x = 0.2;
      break;
    }
    case 'dead': {
      h.body.rotation.x = -Math.PI / 2 * Math.min(1, t * 2); h.body.position.y = 0.2;
      break;
    }
  }
}

export function animBeast(b, st) {
  const P = b.parts;
  const mv = st.move || 0, ph = st.phase || 0;
  P.legs.forEach((l, i) => { l.rotation.x = Math.sin(ph + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.8 * mv; });
  P.torso.rotation.set(0, 0, 0);
  P.torso.position.z = 0;
  P.head.rotation.set(0, 0, 0);
  P.tail.rotation.y = Math.sin(ph * 0.7) * 0.4;
  b.body.rotation.set(0, 0, 0);
  const t = st.t || 0;
  if (st.pose === 'windup') { P.torso.rotation.x = 0.15 * Math.min(1, t * 2); P.torso.position.z = -0.2 * Math.min(1, t * 2); P.head.rotation.x = -0.3; }
  else if (st.pose === 'strike') { P.torso.position.z = Math.sin(t * Math.PI) * 0.6; P.head.rotation.x = Math.sin(t * Math.PI) * 0.5; }
  else if (st.pose === 'stun') { P.head.rotation.z = Math.sin(ph * 3) * 0.3; }
  else if (st.pose === 'dead') { b.body.rotation.z = Math.PI / 2 * Math.min(1, t * 2); }
}
