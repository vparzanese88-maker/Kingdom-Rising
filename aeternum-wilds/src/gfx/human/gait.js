// Legs that stand on the ground: a walk and run cycle whose feet stay planted while the body passes over them
// (no sliding), forwards, backwards and sideways, steps that follow slopes, and a two-bone IK used for arms too.
// Ported from Kingdom Rising 3D (js3d/gait.js). Bones have identity rotations in the rest pose; joint pivots are in
// rig.rest (mesh space, metres, feet at y = 0, facing +z).
import * as THREE from 'three';

const V = THREE.Vector3, Q = THREE.Quaternion;
const _q2 = new Q(), _qi = new Q();
const _a = new V(), _b = new V(), _c = new V(), _d = new V(), _k = new V(), _pole = new V();
const X = new V(1, 0, 0), Y = new V(0, 1, 0), Z = new V(0, 0, 1);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// where a joint is, and how it is turned, in the body's own space
export function meshPos(b, out = new V()) { out.copy(b.position); let p = b.parent; while (p && p.isBone) { out.applyQuaternion(p.quaternion).add(p.position); p = p.parent; } return out; }
export function meshQ(b, out = new Q()) { out.copy(b.quaternion); let p = b.parent; while (p && p.isBone) { out.premultiply(p.quaternion); p = p.parent; } return out; }

// leg and arm measurements, taken once from the rest pose
export function dims(rig) {
  if (rig.dims) return rig.dims;
  const r = rig.rest, v = (n) => new V(...r[n]);
  const d = {};
  for (const S of ['L', 'R']) {
    const th = v('thigh' + S), sh = v('shin' + S), ft = v('foot' + S);
    d['leg' + S] = { up: sh.clone().sub(th), lo: ft.clone().sub(sh), Lu: sh.distanceTo(th), Ll: ft.distanceTo(sh), hip: th.clone().sub(v('hips')), foot: ft };
    const ar = v('arm' + S), fo = v('fore' + S), ha = v('hand' + S);
    d['arm' + S] = { up: fo.clone().sub(ar), lo: ha.clone().sub(fo), Lu: fo.distanceTo(ar), Ll: ha.distanceTo(fo) };
  }
  d.leg = d.legL.Lu + d.legL.Ll;
  d.hipY = r.hips[1]; d.ankle = r.footL[1];
  d.scale = d.leg / 0.86;
  d.toe = 0.13 * d.scale;
  return (rig.dims = d);
}

// two-bone IK: turn upper and lower so the end lands on target, the middle joint bending toward pole.
// root: the upper joint's position (mesh space); parentQ: the upper bone's parent orientation (mesh space)
export function ik2(upper, lower, D, root, target, pole, parentQ, out = new Q()) {
  const Lu = D.Lu, Ll = D.Ll;
  _a.subVectors(target, root); let dist = _a.length();
  dist = clamp(dist, Math.abs(Lu - Ll) + 1e-3, (Lu + Ll) * 0.9995); _a.normalize();
  const along = (Lu * Lu - Ll * Ll + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, Lu * Lu - along * along));
  _pole.copy(pole).addScaledVector(_a, -pole.dot(_a)); if (_pole.lengthSq() < 1e-8) _pole.set(0, 0, 1); _pole.normalize();
  _k.copy(root).addScaledVector(_a, along).addScaledVector(_pole, h);
  const end = _c.copy(root).addScaledVector(_a, dist);
  _qi.copy(parentQ).invert(); _b.subVectors(_k, root).normalize().applyQuaternion(_qi);
  upper.quaternion.setFromUnitVectors(_d.copy(D.up).normalize(), _b);
  const q1 = _q2.copy(parentQ).multiply(upper.quaternion);
  _qi.copy(q1).invert(); _b.subVectors(end, _k).normalize().applyQuaternion(_qi);
  lower.quaternion.setFromUnitVectors(_d.copy(D.lo).normalize(), _b);
  return out.copy(q1).multiply(lower.quaternion);
}
const _fq = new Q(), _fq2 = new Q(), _hp = new V(), _tg = new V(), _pl = new V();
function setFoot(foot, parentQ, pitch, yaw, roll) {
  _fq.setFromAxisAngle(Y, yaw); _fq2.setFromAxisAngle(Z, roll); _fq.multiply(_fq2); _fq2.setFromAxisAngle(X, pitch); _fq.multiply(_fq2);
  foot.quaternion.copy(parentQ).invert().multiply(_fq);
}
const _lq = new Q();

// st.dist: metres moved this frame (body scale), st.dir: [x, z] direction of travel in the body's frame,
// st.ground(x, z): ground height under a point of the body's frame (relative to its feet), st.combat (wider stance),
// st.air (0..1 through a jump), st.stance: { L: [dx, dz], R: [dx, dz] } foot offsets, st.crouch (metres the hips drop)
export function legs(rig, st, dt, m) {
  const B = rig.bones, D = dims(rig);
  const v = dt > 0 ? (st.dist || 0) / dt : 0;
  if (st.air == null) rig.gv = lerp(rig.gv || 0, v, Math.min(1, dt * (v > (rig.gv || 0) ? 16 : 9)));
  const sp = rig.gv;
  const run = sm(2.3, 5.0, sp);
  const cadence = clamp((1.72 + 0.34 * sp) / Math.sqrt(D.scale), 1.5, 3.3);
  const stride = Math.max(0.25, (2 * Math.max(sp, 0.6)) / cadence);
  const duty = lerp(0.62, 0.36, run);
  const reach = duty * stride;
  const FRONT = 0.42;
  if (st.dist > 0 && m > 0.01) rig.gp = ((rig.gp || 0) + st.dist / stride) % 1;
  const gp = rig.gp || 0;
  const dx = st.dir ? st.dir[0] : 0, dz = st.dir ? st.dir[1] : 1;
  const ground = st.ground || null;
  const gAt = (x, z) => (ground ? clamp(ground(x, z), -0.45, 0.45) : 0);
  const hipsQ = B.hips.quaternion;
  const feet = {};
  let lowest = 0;
  const cmb = st.combat || 0;
  for (const S of ['L', 'R']) {
    const L = D['leg' + S], sx = S === 'L' ? 1 : -1;
    // standing: under the hips, staggered in a fighting stance (left foot forward)
    const so = st.stance ? st.stance[S] : null;
    const st0x = L.foot.x * (1 + 0.3 * cmb) + (so ? so[0] : 0), st0z = L.foot.z + (S === 'L' ? 0.1 : -0.08) * D.scale * cmb + (so ? so[1] : 0);
    let fx = st0x, fz = st0z, fy = D.ankle, pitch = 0;
    if (m > 0.01) {
      const u = (gp + (S === 'L' ? 0 : 0.5)) % 1;
      let al, lift = 0, p = 0;
      const toeUp = 0.28 * (1 - run * 0.7), heelMax = 0.42 + run * 0.35;
      if (u < duty) {
        const s = u / duty; al = reach * (FRONT - s);
        p = -toeUp * (1 - sm(0, 0.18, s));
        const hr = sm(0.62, 1, s) * heelMax; p += hr; lift = D.toe * Math.sin(hr);
      } else {
        const s = (u - duty) / (1 - duty); const e = sm(0, 1, s);
        al = reach * (FRONT - 1 + e) + stride * 0.06 * run * Math.sin(Math.PI * s);
        lift = (0.07 + 0.05 * run) * D.scale * Math.sin(Math.PI * Math.min(1, s * 1.15)) + D.toe * Math.sin(heelMax) * (1 - sm(0, 0.35, s));
        lift += run * 0.16 * D.scale * Math.sin(Math.PI * sm(0, 0.7, s)) * (1 - s);
        p = heelMax * (1 - sm(0, 0.45, s)) - toeUp * sm(0.65, 1, s);
      }
      // walking backwards the foot rolls toe to heel instead
      const back = dz < -0.3 ? 1 : 0; if (back) p = -p * 0.6;
      const gx = L.foot.x * (0.82 + 0.1 * run) + (Math.abs(dx) > 0.5 ? sx * 0.03 : 0), gz = L.foot.z;
      fx = lerp(st0x, gx + dx * al, m); fz = lerp(st0z, gz + dz * al, m); fy = D.ankle + lift * m; pitch = p * m;
    }
    const gy = gAt(fx, fz);
    if (ground) { const s2 = (gAt(fx, fz + 0.12) - gAt(fx, fz - 0.08)) / 0.2; pitch -= Math.atan(s2) * (1 - m * 0.5); }
    lowest = Math.min(lowest, gy);
    fy += gy;
    // jumping: knees tuck up at the top of the arc (the leading foot a little higher and further forward)
    if (st.air != null) { const tuck = Math.sin(Math.PI * clamp(st.air, 0, 1)); fy += tuck * (S === 'L' ? 0.3 : 0.2) * D.scale; fz += tuck * (S === 'L' ? 0.1 : -0.05) * D.scale; pitch += tuck * 0.35; }
    feet[S] = { x: fx, y: fy, z: fz, pitch, yaw: sx * 0.08 * (1 - m) * (1 + cmb), roll: 0 };
  }
  // hips: low enough for the longest reach, bobbing with each step
  const half = Math.max(0, reach * FRONT - D.toe * 0.5);
  const legReach = D.leg * 0.985;
  const need = (D.hipY + D.legL.hip.y - D.ankle) - Math.sqrt(Math.max(0.01, legReach * legReach - half * half));
  const drop = m * (Math.min(Math.max(0, need) + 0.01, lerp(0.045, 0.075, run) * D.scale) + run * 0.02 * D.scale);
  const bobPh = Math.cos(Math.PI * 4 * (gp - duty * 0.5));
  const bob = m * bobPh * lerp(0.018, -0.03, run) * D.scale;
  B.hips.position.y += -drop + bob - 0.045 * D.scale * cmb - (st.crouch || 0) + Math.min(0, lowest);
  // solve each leg
  const hp = B.hips.position;
  for (const S of ['L', 'R']) {
    const L = D['leg' + S], f = feet[S], sx = S === 'L' ? 1 : -1;
    _hp.copy(L.hip).applyQuaternion(hipsQ).add(hp);
    _tg.set(f.x, f.y, f.z);
    _pl.set(sx * (0.12 + 0.15 * cmb), 0, 1).normalize();
    ik2(B['thigh' + S], B['shin' + S], L, _hp, _tg, _pl, hipsQ, _lq);
    setFoot(B['foot' + S], _lq, f.pitch, f.yaw, f.roll);
  }
  return { run, sp, gp, duty, cadence };
}

// an arm reaching for a point (mesh space): the elbow bends toward pole; the hand keeps handQ (mesh space) if given
const _r = new V(), _pq = new Q(), _hq = new Q();
export function reach(rig, S, target, pole, handQ) {
  const B = rig.bones, D = dims(rig);
  const up = B['arm' + S];
  meshPos(up, _r); meshQ(up.parent, _pq);
  const fq = ik2(up, B['fore' + S], D['arm' + S], _r, target, pole, _pq, _hq);
  if (handQ) B['hand' + S].quaternion.copy(fq).invert().multiply(handQ);
}
