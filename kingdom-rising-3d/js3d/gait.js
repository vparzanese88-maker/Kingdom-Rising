// Kingdom Rising 3D — legs that stand on the ground: a walk and run cycle whose feet stay planted while the
// body passes over them (no sliding), steps that follow slopes, and a slow cross-legged sit like EverQuest.
// Works on both body types (the MakeHuman body and the classic figures): same bone names, rest pose with
// identity rotations, joint pivots in rig.rest (mesh space, metres, feet at y = 0, facing +z).
import { THREE, K3 } from './core.js';

const V = THREE.Vector3, Q = THREE.Quaternion;
const _q = new Q(), _q2 = new Q(), _qi = new Q(), _e = new THREE.Euler();
const _a = new V(), _b = new V(), _c = new V(), _d = new V(), _k = new V(), _pole = new V();
const X = new V(1, 0, 0), Y = new V(0, 1, 0), Z = new V(0, 0, 1);
const sm = (a, b, x) => K3.smooth(a, b, x);
const lerp = (a, b, t) => a + (b - a) * t;

// where a joint is, and how it is turned, in the body's own space
export function meshPos(b, out = new V()) { out.copy(b.position); let p = b.parent; while (p && p.isBone) { out.applyQuaternion(p.quaternion).add(p.position); p = p.parent; } return out; }
export function meshQ(b, out = new Q()) { out.copy(b.quaternion); let p = b.parent; while (p && p.isBone) { out.premultiply(p.quaternion); p = p.parent; } return out; }

// leg and arm measurements, taken once from the rest pose
function dims(rig) {
  if (rig.dims) return rig.dims;
  const r = rig.rest, v = (n) => new V(...r[n]);
  const d = { };
  for (const S of ['L', 'R']) {
    const th = v('thigh' + S), sh = v('shin' + S), ft = v('foot' + S);
    d['leg' + S] = { up: sh.clone().sub(th), lo: ft.clone().sub(sh), Lu: sh.distanceTo(th), Ll: ft.distanceTo(sh), hip: th.clone().sub(v('hips')), foot: ft };
    const ar = v('arm' + S), fo = v('fore' + S), ha = v('hand' + S);
    d['arm' + S] = { up: fo.clone().sub(ar), lo: ha.clone().sub(fo), Lu: fo.distanceTo(ar), Ll: ha.distanceTo(fo) };
  }
  d.leg = d.legL.Lu + d.legL.Ll; // hip joint to ankle
  d.hipY = r.hips[1]; d.ankle = r.footL[1];
  d.scale = d.leg / 0.86; // 1 for an average human
  d.toe = 0.13 * d.scale; // ankle to the ball of the foot
  return (rig.dims = d);
}

// two-bone IK: turn upper and lower so the end lands on target, the middle joint bending toward pole.
// root: the upper joint's position (mesh space); parentQ: the upper bone's parent orientation (mesh space)
function ik2(upper, lower, D, root, target, pole, parentQ) {
  const Lu = D.Lu, Ll = D.Ll;
  _a.subVectors(target, root); let dist = _a.length();
  dist = K3.clamp(dist, Math.abs(Lu - Ll) + 1e-3, (Lu + Ll) * 0.9995); _a.normalize();
  const along = (Lu * Lu - Ll * Ll + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, Lu * Lu - along * along));
  _pole.copy(pole).addScaledVector(_a, -pole.dot(_a)); if (_pole.lengthSq() < 1e-8) _pole.set(0, 0, 1); _pole.normalize();
  _k.copy(root).addScaledVector(_a, along).addScaledVector(_pole, h); // the knee or elbow
  const end = _c.copy(root).addScaledVector(_a, dist);
  // upper bone
  _qi.copy(parentQ).invert(); _b.subVectors(_k, root).normalize().applyQuaternion(_qi);
  upper.quaternion.setFromUnitVectors(_d.copy(D.up).normalize(), _b);
  const q1 = _q2.copy(parentQ).multiply(upper.quaternion);
  // lower bone
  _qi.copy(q1).invert(); _b.subVectors(end, _k).normalize().applyQuaternion(_qi);
  lower.quaternion.setFromUnitVectors(_d.copy(D.lo).normalize(), _b);
  return q1.multiply(lower.quaternion); // the end bone's parent orientation
}
const _fq = new Q(), _fq2 = new Q(), _pq = new Q(), _hp = new V(), _tg = new V(), _pl = new V(), _knee = { L: new V(), R: new V() };
function setFoot(foot, parentQ, pitch, yaw, roll) {
  _fq.setFromAxisAngle(Y, yaw); _fq2.setFromAxisAngle(Z, roll); _fq.multiply(_fq2); _fq2.setFromAxisAngle(X, pitch); _fq.multiply(_fq2);
  foot.quaternion.copy(parentQ).invert().multiply(_fq);
}

// ---------------------------------------------------------------- the gait
// st.dist: metres walked this frame (body scale), st.dir: [x, z] direction of travel in the body's frame,
// st.ground(x, z): ground height under a point of the body's frame (relative to its feet), st.combat
export function legs(rig, st, dt, m) {
  const B = rig.bones, D = dims(rig);
  if (!B.thighL || !B.footR) return;
  // speed and the step it calls for: cadence rises with speed, long legs take slower, longer steps
  const v = dt > 0 ? (st.dist || 0) / dt : 0;
  rig.gv = lerp(rig.gv || 0, v, Math.min(1, dt * (v > (rig.gv || 0) ? 5 : 3)));
  const sp = rig.gv;
  const run = sm(2.3, 5.0, sp); // a light jog at 3 m/s, a full run only when much faster
  const cadence = K3.clamp((1.72 + 0.34 * sp) / Math.sqrt(D.scale), 1.5, 3.3); // steps per second
  const stride = Math.max(0.25, (2 * Math.max(sp, 0.6)) / cadence) * 1; // two steps
  const duty = lerp(0.62, 0.36, run); // share of the cycle each foot is on the ground
  const reach = duty * stride; // how far a planted foot travels under the body
  const FRONT = 0.42; // the foot lands a little ahead of the hip and leaves further behind it, on its toes
  if (st.dist > 0 && m > 0.01) rig.gp = ((rig.gp || 0) + st.dist / stride) % 1;
  const gp = rig.gp || 0;
  // which way we travel (backwards and sideways steps work too)
  const dx = st.dir ? st.dir[0] : 0, dz = st.dir ? st.dir[1] : 1;
  const ground = st.ground || null;
  const gAt = (x, z) => (ground ? K3.clamp(ground(x, z), -0.45, 0.45) : 0);
  // sitting cross-legged blends in slowly; standing up a little faster
  const sitWant = st.sit ? 1 : 0;
  rig.sitK = rig.sitK == null ? sitWant : rig.sitK + K3.clamp(sitWant - rig.sitK, -dt / 0.75, dt / 1.25);
  const sk = rig.sitK, seat = sm(0, 1, sk), cross = sm(0.35, 1, sk);
  const hipsQ = B.hips.quaternion;
  // ---- feet ----
  const feet = {};
  let lowest = 0;
  for (const S of ['L', 'R']) {
    const L = D['leg' + S], sx = S === 'L' ? 1 : -1;
    // standing: under the hips, staggered a little in a fighting stance
    const st0x = L.foot.x * (st.combat ? 1.25 : 1), st0z = L.foot.z + (st.combat ? (S === 'L' ? 0.11 : -0.09) * D.scale : 0);
    let fx = st0x, fz = st0z, fy = D.ankle, pitch = 0;
    if (m > 0.01) {
      const u = (gp + (S === 'L' ? 0 : 0.5)) % 1;
      let al, lift = 0, p = 0;
      const toeUp = 0.28 * (1 - run * 0.7), heelMax = 0.42 + run * 0.35;
      if (u < duty) { // planted: rolls heel to toe while the body passes over it
        const s = u / duty; al = reach * (FRONT - s);
        p = -toeUp * (1 - sm(0, 0.18, s));
        const hr = sm(0.62, 1, s) * heelMax; p += hr; lift = D.toe * Math.sin(hr);
      } else { // swinging through
        const s = (u - duty) / (1 - duty); const e = sm(0, 1, s);
        al = reach * (FRONT - 1 + e) + stride * 0.06 * run * Math.sin(Math.PI * s);
        lift = (0.07 + 0.05 * run) * D.scale * Math.sin(Math.PI * Math.min(1, s * 1.15)) + D.toe * Math.sin(heelMax) * (1 - sm(0, 0.35, s));
        lift += run * 0.16 * D.scale * Math.sin(Math.PI * sm(0, 0.7, s)) * (1 - s); // heel tucks up when running
        p = heelMax * (1 - sm(0, 0.45, s)) - toeUp * sm(0.65, 1, s);
      }
      const gx = L.foot.x * (0.82 + 0.1 * run), gz = L.foot.z;
      fx = lerp(st0x, gx + dx * al, m); fz = lerp(st0z, gz + dz * al, m); fy = D.ankle + lift * m; pitch = p * m;
    }
    // follow the ground: height under the foot, and its slope along the foot
    const gy = gAt(fx, fz);
    if (ground) { const s2 = (gAt(fx, fz + 0.12) - gAt(fx, fz - 0.08)) / 0.2; pitch -= Math.atan(s2) * (1 - m * 0.5); }
    lowest = Math.min(lowest, gy);
    // cross-legged: each ankle tucked under the other knee, resting on its outer edge
    if (cross > 0) {
      const cx = -sx * 0.07 * D.scale, cz = (S === 'L' ? 0.19 : 0.28) * D.scale, cy = (S === 'L' ? 0.06 : 0.11) * D.scale;
      fx = lerp(fx, cx, cross); fz = lerp(fz, cz, cross); fy = lerp(fy + gy, cy, cross);
      pitch = lerp(pitch, 0.15, cross);
    } else fy += gy;
    feet[S] = { x: fx, y: fy, z: fz, pitch, yaw: -sx * 1.25 * cross, roll: -sx * 0.85 * cross };
  }
  // ---- hips: low enough for the longest reach, bobbing with each step, down on the ground to sit ----
  // as low as the front of the step needs, but never a crouch: the heel and toe roll make up the rest
  const half = Math.max(0, reach * FRONT - D.toe * 0.5);
  const legReach = D.leg * 0.985;
  const need = (D.hipY + D.legL.hip.y - D.ankle) - Math.sqrt(Math.max(0.01, legReach * legReach - half * half));
  const drop = m * (Math.min(Math.max(0, need) + 0.01, lerp(0.045, 0.075, run) * D.scale) + run * 0.02 * D.scale);
  const bobPh = Math.cos(Math.PI * 4 * (gp - duty * 0.5));
  const bob = m * bobPh * lerp(0.018, -0.03, run) * D.scale;
  const standY = D.hipY - drop + bob - (st.combat ? 0.05 * D.scale : 0) + Math.min(0, lowest);
  const seatY = 0.12 * D.scale - D.legL.hip.y; // thigh joints about 12 cm off the ground
  B.hips.position.y = lerp(standY, seatY, seat) + (B.hips.position.y - D.hipY); // keep any extra offsets
  if (seat > 0) { B.hips.rotation.x -= 0.18 * seat; B.spine.rotation.x += 0.2 * seat; B.chest.rotation.x += 0.08 * seat; B.neck.rotation.x += 0.12 * seat; }
  // ---- solve each leg ----
  const hp = B.hips.position;
  for (const S of ['L', 'R']) {
    const L = D['leg' + S], f = feet[S], sx = S === 'L' ? 1 : -1;
    _hp.copy(L.hip).applyQuaternion(hipsQ).add(hp);
    _tg.set(f.x, f.y, f.z);
    // knees bend forward; sitting, they fall open to the sides
    _pl.set(sx * (0.12 + 1.6 * cross), 0.35 * cross, 1).normalize();
    const fq = ik2(B['thigh' + S], B['shin' + S], L, _hp, _tg, _pl, hipsQ);
    _knee[S].copy(_k);
    setFoot(B['foot' + S], fq, f.pitch, f.yaw, f.roll);
  }
  rig.sitHands = seat > 0.02 ? seat : 0;
  return { run, sp, gp, duty, cadence };
}

// while sitting, rest the hands on the knees (after the arm animation, so it wins)
export function handsOnKnees(rig) {
  const k = rig.sitHands; if (!k) return;
  const B = rig.bones, D = dims(rig);
  for (const S of ['L', 'R']) {
    const A = D['arm' + S], sx = S === 'L' ? 1 : -1, up = B['arm' + S];
    if (!up || !B['fore' + S]) continue;
    const root = meshPos(up, new V()); const pq = meshQ(up.parent, _pq);
    // where the hand would be now, so the pose blends in as the hero sits down
    const kn = _knee[S];
    _tg.set(kn.x - sx * 0.02 * D.scale, kn.y + 0.07 * D.scale, kn.z - 0.04 * D.scale);
    const cur = meshPos(B['hand' + S], new V());
    _tg.lerp(cur, 1 - sm(0.3, 1, k));
    _pl.set(sx * 0.9, -0.25, -0.6).normalize();
    ik2(up, B['fore' + S], A, root, _tg, _pl, pq);
  }
}
