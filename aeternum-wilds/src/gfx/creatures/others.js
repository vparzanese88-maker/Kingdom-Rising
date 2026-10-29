// Aeternum Wilds creatures that are not four-legged mammals: giant spiders, ravens, stone golems, treants,
// earth elementals, and the glowing ones (ghosts; fire, water and air elementals).
import { THREE, Q, shade, clamp, ease, decay, hash, glowMaterial, makeFlames, uTime } from './core.js';
import { Rig, instance, addFur } from './rig.js';

// ---------- spider (from Kingdom Rising 3D's bugs) ----------
export function buildSpider(col) {
  const legs = 4, H = 0.36;
  const defs = [['root', null, [0, H, 0]], ['head', 'root', [0, H, 0.28]], ['abd', 'root', [0, H + 0.04, -0.24]]];
  for (let i = 0; i < legs; i++) for (const sd of [1, -1]) { const n = 'L' + i + (sd > 0 ? 'l' : 'r'); const z = 0.12 - i * 0.08; const fz = (legs / 2 - 0.5 - i) * 0.34;
    defs.push([n + '1', 'root', [sd * 0.13, H + 0.02, z]], [n + '2', n + '1', [sd * 0.46, H + 0.5, z + fz * 0.45]], [n + '3', n + '2', [sd * 1.0, 0.02, z + fz]]); }
  const R = new Rig(defs); const r = R.rest; const dark = shade(col, -0.25);
  R.k = 0.03; R.cell = 0.016;
  // two parts joined by a thin waist: a low cephalothorax carrying the legs, and a big round abdomen behind
  R.ell('root', [0, r.root[1] + 0.03, 0.02], [0.2, 0.12, 0.25], col, 'fur'); R.seg('abd', [0, r.root[1] + 0.05, -0.2], [0, r.abd[1] + 0.06, r.abd[2] - 0.08], 0.05, 0.08, dark, 'fur');
  R.ell('abd', [0, r.abd[1] + 0.12, r.abd[2] - 0.24], [0.29, 0.25, 0.36], dark, 'fur', Q(-0.25, 0, 0));
  R.ell('head', [0, r.head[1] + 0.02, r.head[2] + 0.04], [0.12, 0.1, 0.1], col, 'fur');
  R.hard(() => {
    // an hourglass of red on the back, and a cluster of glowing eyes
    for (const [z, s] of [[-0.12, 0.07], [-0.26, 0.05], [-0.38, 0.065]]) R.ell('abd', [0, r.abd[1] + 0.36 + z * 0.12, r.abd[2] + z], [s, 0.02, s * 1.2], '#c8281e', 'skin', Q(-0.25, 0, 0));
    for (let k = 0; k < 8; k++) R.ell('head', [((k % 4) - 1.5) * 0.04, r.head[1] + 0.07 + Math.floor(k / 4) * 0.035, r.head[2] + 0.12 - Math.floor(k / 4) * 0.02], [k < 4 && (k === 1 || k === 2) ? 0.026 : 0.017, 0.02, 0.016], '#ff3a2a', 'glow');
    for (const sd of [-1, 1]) { R.cone('head', [sd * 0.045, r.head[1] - 0.06, r.head[2] + 0.13], 0.025, 0.14, Q(Math.PI + 0.3, 0, 0), '#1a1a1a', 'shell'); R.seg('head', [sd * 0.06, r.head[1] - 0.03, r.head[2] + 0.14], [sd * 0.14, r.head[1] - 0.12, r.head[2] + 0.3], 0.022, 0.012, dark, 'shell'); }
    // legs: thigh, then an arc from the high knee down to the foot, with banded joints
    for (let i = 0; i < legs; i++) for (const sd of [1, -1]) { const n = 'L' + i + (sd > 0 ? 'l' : 'r'); const t0 = 0.032; const a = r[n + '1'], k = r[n + '2'], f = r[n + '3'];
      R.seg(n + '1', a, k, t0, t0 * 0.85, dark, 'shell');
      const m = [k[0] + (f[0] - k[0]) * 0.42 + sd * 0.06, k[1] + (f[1] - k[1]) * 0.32 + 0.04, k[2] + (f[2] - k[2]) * 0.45];
      R.seg(n + '2', k, m, t0 * 0.85, t0 * 0.6, shade(dark, i % 2 ? 0.12 : -0.04), 'shell'); R.seg(n + '2', m, f, t0 * 0.6, t0 * 0.25, shade(dark, i % 2 ? 0.12 : -0.04), 'shell');
      R.ell(n + '2', k, [t0 * 1.2, t0 * 1.2, t0 * 1.2], '#7a2a1e', 'shell'); R.ell(n + '2', m, [t0 * 0.8, t0 * 0.8, t0 * 0.8], '#7a2a1e', 'shell'); }
  });
  const geom = R.geometry();
  return { R, geom, body: R.body, furLen: 0.014, legs, H };
}
export function spiderInstance(tpl) { const inst = instance(tpl.R, tpl.geom); addFur(inst, tpl.body, tpl.furLen); return Object.assign(inst, { type: 'spider', legs: tpl.legs, t: Math.random() * 10, phase: 0 }); }
export function animSpider(rig, st, dt) {
  // alternating tetrapods (L1 R2 L3 R4 against the rest); a swinging leg lifts and reaches, a planted one sweeps back
  const B = rig.bones; const t = (rig.t += dt); rig.phase = ((rig.phase || 0) + (st.dist || 0) / 0.42) % 1;
  rig.mv = (rig.mv || 0) + (((st.dist || 0) > 0.0005 ? 1 : 0) - (rig.mv || 0)) * Math.min(1, dt * 8); const m = rig.mv;
  for (const k in B) B[k].rotation.set(0, 0, 0);
  B.root.position.set(rig.rest.root[0], rig.rest.root[1], rig.rest.root[2]);
  for (let i = 0; i < rig.legs; i++) for (const sd of ['l', 'r']) {
    const n = 'L' + i + sd; const grp = (i + (sd === 'l' ? 0 : 1)) % 2; const u = (rig.phase + grp * 0.5) % 1; const S = sd === 'l' ? 1 : -1;
    let sw, lift; if (u < 0.5) { sw = 1 - 4 * u; lift = 0; } else { const s1 = (u - 0.5) * 2; sw = -1 + 2 * ease(s1); lift = Math.sin(s1 * Math.PI); }
    B[n + '1'].rotation.y = -S * sw * 0.32 * m; B[n + '1'].rotation.z = S * lift * 0.35 * m;
    if (m < 0.5 && Math.sin(t * 0.7 + i * 2.3 + (sd === 'l' ? 0 : 1.7)) > 0.97) B[n + '1'].rotation.z += S * 0.25; // an idle twitch
  }
  B.root.position.y += Math.abs(Math.sin(rig.phase * Math.PI * 4)) * 0.012 * m + Math.sin(t * 2.2) * 0.006;
  B.abd.rotation.x = Math.sin(t * 2) * 0.04 + Math.sin(rig.phase * Math.PI * 4) * 0.03 * m;
  // the attack: rear up showing the fangs and front legs (the wind-up), then lunge down and bite
  const w = ease(st.wind || 0), a = st.atk || 0; const strike = a > 0 && a < 1 ? Math.sin(clamp(a / 0.5, 0, 1) * Math.PI) : 0;
  const rear = Math.max(w, 0) * (1 - strike);
  B.root.rotation.x = -rear * 0.55 + strike * 0.3 + Math.sin(t * 30) * 0.01 * w; B.root.position.z = strike * 0.3 - rear * 0.05; B.root.position.y += rear * 0.08; B.head.rotation.x = strike * 0.4 - rear * 0.2;
  for (const sd of ['l', 'r']) { const S = sd === 'l' ? 1 : -1; B['L0' + sd + '1'].rotation.z += S * rear * 1.0; B['L0' + sd + '1'].rotation.y += -S * strike * 0.6 + S * Math.sin(t * 14) * 0.15 * w; B['L1' + sd + '1'].rotation.z += S * rear * 0.5; }
  if (st.hurt && !st.dead) { const h = st.hurt; const k = Math.sin(Math.min(1, h.t / 0.06) * Math.PI * 0.5) * decay(Math.max(0, h.t - 0.06), 9) * Math.min(1.4, 0.5 + h.mag * 6); B.root.position.x += h.fx * 0.1 * k; B.root.position.z += h.fz * 0.1 * k; B.root.rotation.z -= h.fx * 0.25 * k; B.root.position.y += 0.04 * k; for (const n in B) if (n.endsWith('1') && n[0] === 'L') B[n].rotation.z += (n[2] === 'l' ? 1 : -1) * 0.3 * k; }
  if (st.stun) { B.root.rotation.z = Math.sin(t * 4) * 0.1; }
  if (st.dead) { const d = ease(clamp((st.deadT || 0) / 0.6, 0, 1)); B.root.rotation.z = Math.PI * d * (st.side || 1) * 0.98; B.root.position.y = rig.rest.root[1] * (1 - d) + 0.22 * d; // flips onto its back, legs curl
    for (let i = 0; i < rig.legs; i++) for (const sd of ['l', 'r']) { const n = 'L' + i + sd; const S = sd === 'l' ? 1 : -1; B[n + '1'].rotation.set(0, 0, S * (0.9 + Math.sin((st.deadT || 0) * 14 + i) * 0.15 * Math.max(0, 1 - (st.deadT || 0) / 1.5)) * d); B[n + '2'].rotation.z = S * 1.3 * d; } }
}

// ---------- raven: glossy black feathers, a heavy bill, a wedge tail; flaps, glides, dives ----------
export function buildRaven(col, eye) {
  const Y = 1.7;
  const defs = [['root', null, [0, Y, 0]], ['neck', 'root', [0, Y + 0.05, 0.14]], ['head', 'neck', [0, Y + 0.1, 0.22]], ['tail', 'root', [0, Y, -0.16]],
    ['WL1', 'root', [0.08, Y + 0.05, 0.05]], ['WL2', 'WL1', [0.38, Y + 0.06, 0.02]], ['WR1', 'root', [-0.08, Y + 0.05, 0.05]], ['WR2', 'WR1', [-0.38, Y + 0.06, 0.02]],
    ['legL', 'root', [0.04, Y - 0.07, -0.02]], ['legR', 'root', [-0.04, Y - 0.07, -0.02]]];
  const R = new Rig(defs); const r = R.rest; R.k = 0.025; R.cell = 0.012;
  const c = col, sheen = shade(c, 0.12), hd = r.head;
  R.ell('root', [0, Y, -0.01], [0.1, 0.1, 0.2], c, 'feather', Q(0.12, 0, 0));
  R.ell('root', [0, Y - 0.025, 0.08], [0.085, 0.085, 0.1], sheen, 'feather');
  R.seg('neck', [0, Y + 0.03, 0.12], [0, hd[1] - 0.01, hd[2] - 0.03], 0.06, 0.05, c, 'feather', 'root', 0.3);
  R.ell('head', [0, hd[1], hd[2]], [0.055, 0.058, 0.07], c, 'feather');
  R.ell('neck', [0, hd[1] - 0.06, hd[2] - 0.02], [0.04, 0.05, 0.05], sheen, 'feather'); // shaggy throat hackles
  R.hard(() => {
    R.cone('head', [0, hd[1] - 0.005, hd[2] + 0.11], 0.026, 0.12, Q(Math.PI / 2 + 0.12, 0, 0), '#1a1a20', 'shell'); // the heavy bill
    R.ell('head', [0, hd[1] + 0.012, hd[2] + 0.075], [0.022, 0.02, 0.05], '#202028', 'shell');
    for (const sd of [-1, 1]) R.ell('head', [sd * 0.042, hd[1] + 0.012, hd[2] + 0.03], [0.013, 0.013, 0.01], eye || '#3a2a1a', eye ? 'glow' : 'gem');
    // the wedge tail: a fan of long feathers
    for (let k = -3; k <= 3; k++) { const len = 0.2 - Math.abs(k) * 0.012; const q = Q(-0.05, k * 0.09, 0); const p = new THREE.Vector3(0, 0, -len * 0.5).applyQuaternion(q); R.ell('tail', [k * 0.012 + p.x, Y + 0.005 + Math.abs(k) * 0.002, -0.16 + p.z], [0.03, 0.006, len * 0.5], k % 2 ? c : sheen, 'feather', q); }
    // wings: primaries splayed like fingers at the tip, secondaries along the arm, coverts over their roots
    for (const s of [1, -1]) {
      const n = s > 0 ? 'WL' : 'WR'; const a = r[n + '1'], b = r[n + '2']; const T = [b[0] + s * 0.3, b[1] - 0.01, b[2] - 0.03];
      R.seg(n + '1', a, b, 0.025, 0.018, c, 'feather'); R.seg(n + '2', b, T, 0.018, 0.008, c, 'feather');
      const feather = (bone, root, dir, len, wid, cc) => { const d = new THREE.Vector3(...dir).normalize(); const up = new THREE.Vector3(0, 1, 0); const x = new THREE.Vector3().crossVectors(up, d).normalize(); const y = new THREE.Vector3().crossVectors(d, x).normalize();
        const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, d)); const c0 = new THREE.Vector3(...root).addScaledVector(d, len * 0.5); R.ell(bone, c0.toArray(), [wid, 0.005, len * 0.5], cc, 'feather', q); };
      for (let j = 0; j < 7; j++) { const u = j / 6; const root = [b[0] + (T[0] - b[0]) * u * 0.95, b[1] + (T[1] - b[1]) * u, b[2] + (T[2] - b[2]) * u]; feather(n + '2', root, [s * (0.2 + 0.85 * u ** 1.4), -0.02, -(1 - u ** 1.3) - 0.1], 0.2 + 0.06 * Math.sin(u * 2.6), 0.024, j % 2 ? c : sheen); }
      for (let j = 0; j < 6; j++) { const u = j / 5; const root = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]; feather(u < 0.5 ? n + '1' : n + '2', root, [s * 0.1 * u, -0.02, -1], 0.17, 0.03, j % 2 ? sheen : c); }
      for (let j = 0; j < 7; j++) { const u = j / 6; const root = [a[0] + (T[0] - a[0]) * u * 0.8, a[1] + 0.008, a[2] + (T[2] - a[2]) * u * 0.8 + 0.01]; feather(u < 0.4 ? n + '1' : n + '2', root, [s * 0.2 * u, -0.03, -1], 0.08, 0.03, sheen); }
    }
    for (const sd of [-1, 1]) { const lg = sd > 0 ? 'legL' : 'legR'; const p = r[lg]; R.seg(lg, p, [p[0], p[1] - 0.08, p[2] + 0.01], 0.008, 0.006, '#1a1a1a', 'shell'); for (const k of [-1, 0, 1]) R.cone(lg, [p[0] + k * 0.012, p[1] - 0.085, p[2] + 0.025], 0.004, 0.035, Q(Math.PI / 2 + 0.3, k * 0.4, 0), '#101010', 'shell'); }
  });
  // feathers are hard parts: the body is small and smooth, the rest stays crisp and light
  return { R, geom: R.geometry(), Y };
}
export function ravenInstance(tpl) { const inst = instance(tpl.R, tpl.geom); return Object.assign(inst, { type: 'raven', t: Math.random() * 10, Y: tpl.Y }); }
export function animRaven(rig, st, dt) {
  const B = rig.bones; const t = (rig.t += dt); const sd = rig.seed || 0;
  for (const k in B) B[k].rotation.set(0, 0, 0);
  const glide = Math.sin(t * 0.5 + sd) > 0.55 && !(st.wind > 0) && !st.dead;
  const fast = (st.dist || 0) / Math.max(dt, 1e-3) > 4;
  const f = (t * (fast ? 4.2 : 3.2)) % 1; const beat = glide ? 0.12 + Math.sin(t * 2) * 0.05 : f < 0.45 ? Math.cos(f / 0.45 * Math.PI) : -Math.cos((f - 0.45) / 0.55 * Math.PI);
  B.WL1.rotation.z = beat * 0.95; B.WR1.rotation.z = -beat * 0.95; B.WL2.rotation.z = beat * 0.55 + (beat < 0 ? -0.2 : 0); B.WR2.rotation.z = -B.WL2.rotation.z;
  B.WL2.rotation.y = beat < 0 ? 0.35 * -beat : 0; B.WR2.rotation.y = -B.WL2.rotation.y; // the hand folds on the upstroke
  B.root.position.set(0, rig.Y - beat * 0.05 + Math.sin(t * 1.3 + sd) * 0.08, 0);
  B.root.rotation.x = 0.08 + (fast ? 0.15 : 0); B.root.rotation.z = Math.sin(t * 0.7 + sd) * 0.12;
  B.head.rotation.y = Math.sin(t * 0.9 + sd) * 0.5; B.head.rotation.x = -0.1; B.tail.rotation.x = -beat * 0.12; B.tail.rotation.y = Math.sin(t * 1.1) * 0.15;
  B.legL.rotation.x = B.legR.rotation.x = 1.2; // talons tucked in flight
  // the wind-up: rises, wings high and spread; the strike: a stooping dive with the talons thrown forward
  const w = ease(st.wind || 0), a = st.atk || 0; const dive = a > 0 && a < 1 ? Math.sin(a * Math.PI) : 0;
  B.root.position.y += w * 0.35 - dive * 0.7; B.root.position.z += dive * 0.8 - w * 0.2; B.root.rotation.x += -w * 0.4 + dive * 0.7;
  if (w > 0) { B.WL1.rotation.z = 1.1 * w + B.WL1.rotation.z * (1 - w); B.WR1.rotation.z = -B.WL1.rotation.z; }
  if (dive > 0) { B.legL.rotation.x = B.legR.rotation.x = 1.2 - dive * 2.2; B.WL1.rotation.z = 0.5; B.WR1.rotation.z = -0.5; B.WL1.rotation.y = 0.6 * dive; B.WR1.rotation.y = -0.6 * dive; }
  if (st.hurt && !st.dead) { const h = st.hurt; const k = Math.sin(Math.min(1, h.t / 0.06) * Math.PI * 0.5) * decay(Math.max(0, h.t - 0.06), 7) * Math.min(1.3, 0.5 + h.mag * 6); B.root.rotation.z -= h.fx * 0.9 * k; B.root.position.y -= 0.2 * k; B.root.position.x += h.fx * 0.25 * k; B.root.position.z += h.fz * 0.25 * k; }
  if (st.dead) { const d = ease(clamp((st.deadT || 0) / 0.7, 0, 1)); B.WL1.rotation.z = -0.3 * d + B.WL1.rotation.z * (1 - d); B.WR1.rotation.z = -B.WL1.rotation.z; B.WL1.rotation.y = 1.2 * d; B.WR1.rotation.y = -1.2 * d; B.root.position.y = rig.Y * (1 - d) * (1 - d) + 0.08; B.root.rotation.z = (st.side || 1) * 1.4 * d; B.root.rotation.x = 0; }
}

// ---------- heavy humanoid brutes: stone golems, earth elementals, treants ----------
function chunkGeo(seed, det = 1) { const g = new THREE.IcosahedronGeometry(1, det); const pa = g.attributes.position; for (let i = 0; i < pa.count; i++) { const k = 0.82 + hash(Math.round(pa.getX(i) * 9 + seed * 50), Math.round(pa.getY(i) * 9 + seed * 31), Math.round(pa.getZ(i) * 9)) * 0.3; pa.setXYZ(i, pa.getX(i) * k, pa.getY(i) * k, pa.getZ(i) * k); } const ng = g.toNonIndexed(); ng.computeVertexNormals(); g.dispose(); return ng; }
export function buildBrute(kind) {
  const golem = kind !== 'treant'; const S = kind === 'treant' ? 1.15 : 1.0;
  const defs = [['hips', null, [0, 1.0 * S, 0]], ['chest', 'hips', [0, 1.45 * S, 0]], ['head', 'chest', [0, 2.15 * S, 0.08]], ['armL', 'chest', [0.6 * S, 1.95 * S, 0]], ['foreL', 'armL', [0.68 * S, 1.32 * S, 0.05]], ['armR', 'chest', [-0.6 * S, 1.95 * S, 0]], ['foreR', 'armR', [-0.68 * S, 1.32 * S, 0.05]], ['thighL', 'hips', [0.28 * S, 0.95 * S, 0]], ['shinL', 'thighL', [0.3 * S, 0.48 * S, 0]], ['thighR', 'hips', [-0.28 * S, 0.95 * S, 0]], ['shinR', 'thighR', [-0.3 * S, 0.48 * S, 0]]];
  const R = new Rig(defs); const r = R.rest;
  if (golem) {
    const earth = kind === 'earth_elemental'; const col = earth ? '#7a6248' : '#8a8a84', dk = shade(col, -0.25), glow = earth ? '#ffa030' : '#6ad8ff', moss = '#5a7a34';
    let sd = 1; const chunk = (bone, p, s, c, rot) => { const g = chunkGeo(sd++); R.geom(bone, g, new THREE.Matrix4().compose(new THREE.Vector3(...p), rot || Q(p[0] * 3, p[1] * 2, p[2]), new THREE.Vector3(...s)), c, 'rock'); g.dispose(); };
    R.hard(() => {
      chunk('chest', [0, 1.72, 0], [0.62, 0.52, 0.44], col); chunk('chest', [0.28, 1.95, -0.05], [0.36, 0.3, 0.34], dk); chunk('chest', [-0.28, 1.95, -0.05], [0.36, 0.3, 0.34], dk); chunk('chest', [0, 1.45, 0.02], [0.45, 0.3, 0.35], col);
      chunk('hips', [0, 1.08, 0], [0.42, 0.28, 0.32], dk); chunk('head', [0, 2.3, 0.08], [0.24, 0.22, 0.24], col); chunk('head', [0, 2.38, 0.12], [0.2, 0.08, 0.2], dk);
      for (const sx of [-1, 1]) R.ell('head', [sx * 0.085, 2.31, 0.3], [0.04, 0.03, 0.02], glow, 'glow');
      R.ell('chest', [0, 1.75, 0.38], [0.12, 0.12, 0.06], glow, 'glow'); // the heart-stone
      for (const [x, y, rz] of [[0.12, 1.88, 0.6], [-0.15, 1.62, -0.5], [0.2, 1.52, 0.2], [-0.05, 1.98, 1.4]]) R.box('chest', [x, y, 0.4], [0.025, 0.2, 0.02], glow, 'glow', Q(0, 0, rz)); // glowing cracks
      if (!earth) for (const [x, y, z] of [[0.3, 2.12, -0.02], [-0.25, 2.14, 0.05], [0.05, 2.0, -0.3]]) R.ell('chest', [x, y, z], [0.18, 0.06, 0.16], moss, 'leaf');
      if (earth) for (const [x, y, z, rx, rz] of [[0.25, 2.15, -0.2, -0.4, -0.5], [-0.2, 2.2, -0.15, -0.3, 0.4], [0, 2.25, -0.3, -0.7, 0], [0.4, 1.9, -0.25, -0.5, -0.9]]) R.cone('chest', [x, y, z], 0.07, 0.4, Q(rx, 0, rz), '#ffc070', 'glow'); // crystals
      for (const s2 of ['L', 'R']) { const sx = s2 === 'L' ? 1 : -1; const a = r['arm' + s2], f = r['fore' + s2];
        chunk('arm' + s2, [a[0] * 1.02, a[1] + 0.02, a[2]], [0.3, 0.26, 0.3], dk); chunk('arm' + s2, [a[0] * 1.05, a[1] - 0.3, a[2]], [0.24, 0.3, 0.24], col);
        chunk('fore' + s2, [f[0], f[1] - 0.25, f[2]], [0.3, 0.38, 0.3], col); chunk('fore' + s2, [f[0] + sx * 0.02, f[1] - 0.72, f[2] + 0.05], [0.32, 0.24, 0.3], dk);
        R.box('fore' + s2, [f[0] + sx * 0.25, f[1] - 0.25, f[2] + 0.1], [0.02, 0.22, 0.02], glow, 'glow', Q(0, 0, sx * 0.3));
        const t2 = r['thigh' + s2], s3 = r['shin' + s2]; chunk('thigh' + s2, [t2[0], t2[1] - 0.22, 0], [0.26, 0.3, 0.26], dk); chunk('shin' + s2, [s3[0], s3[1] - 0.22, 0.02], [0.28, 0.3, 0.3], col); chunk('shin' + s2, [s3[0], 0.1, 0.06], [0.3, 0.12, 0.36], dk); }
    });
  } else {
    // a treant: a bark-covered trunk with a face in it, branch arms ending in twig fingers, root feet, a crown of leaves
    R.k = 0.07; R.cell = 0.035; const bark = '#5a4028', bk2 = '#4a3420', leaf = ['#4f8a3a', '#5f9a44', '#467e34', '#6aa848'];
    R.seg('hips', [0, 0.95, 0], [0, 1.6, 0], 0.36, 0.4, bark, 'wood'); R.seg('chest', [0, 1.6, 0], [0, 2.45, 0.02], 0.42, 0.34, bark, 'wood', 'hips', 0.2);
    R.ell('head', [0, 2.45, 0.08], [0.3, 0.28, 0.26], bk2, 'wood');
    for (const s2 of ['L', 'R']) { const sx = s2 === 'L' ? 1 : -1; const a = r['arm' + s2], f = r['fore' + s2];
      R.seg('arm' + s2, [a[0] * 0.55, a[1] + 0.05, 0], f, 0.15, 0.11, bark, 'wood', 'chest', 0.2); R.seg('fore' + s2, f, [f[0] * 1.05, f[1] - 0.62, 0.12], 0.11, 0.07, bk2, 'wood');
      const t2 = r['thigh' + s2], s3 = r['shin' + s2]; R.seg('thigh' + s2, [t2[0] * 0.6, t2[1] + 0.05, 0], s3, 0.2, 0.15, bark, 'wood', 'hips', 0.2); R.seg('shin' + s2, s3, [s3[0] * 1.1, 0.1, 0.05], 0.15, 0.22, bk2, 'wood'); }
    R.hard(() => {
      for (const sx of [-1, 1]) { R.ell('head', [sx * 0.1, 2.5, 0.3], [0.045, 0.035, 0.02], '#d8ff6a', 'glow'); R.box('head', [sx * 0.1, 2.56, 0.31], [0.09, 0.025, 0.03], bk2, 'wood', Q(0, 0, sx * 0.3)); }
      R.box('head', [0, 2.36, 0.31], [0.12, 0.03, 0.02], '#1a1008', 'wood'); // a knot of a mouth
      for (const s2 of ['L', 'R']) { const sx = s2 === 'L' ? 1 : -1; const f = r['fore' + s2]; const h = [f[0] * 1.05, f[1] - 0.6, 0.12];
        for (let k = 0; k < 4; k++) R.seg('fore' + s2, h, [h[0] + sx * (k - 1.2) * 0.06, h[1] - 0.28, h[2] + 0.08 + (k - 1.5) * 0.05], 0.035, 0.008, bk2, 'wood');
        for (let k = 0; k < 4; k++) { const a2 = k / 4 * Math.PI * 2; R.seg('shin' + s2, [r['shin' + s2][0] * 1.1, 0.15, 0.05], [r['shin' + s2][0] * 1.1 + Math.cos(a2) * 0.3, 0.02, 0.05 + Math.sin(a2) * 0.3], 0.07, 0.02, bk2, 'wood'); }
        R.cone('arm' + s2, [r['arm' + s2][0] * 1.1, r['arm' + s2][1] + 0.25, -0.05], 0.05, 0.5, Q(0, 0, -sx * 0.5), bark, 'wood'); }
      let sd = 3; for (let k = 0; k < 11; k++) { const a = k * 2.399, rr = k < 6 ? 0.45 : 0.25; const g = chunkGeo(sd++); R.geom(k < 3 ? 'head' : 'chest', g, new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * rr, 2.75 + (k % 3) * 0.18 + (k >= 6 ? 0.25 : 0), Math.sin(a) * rr - 0.05), Q(a, a * 2, 0), new THREE.Vector3(0.42, 0.34, 0.4)), leaf[k % 4], 'leaf'); g.dispose(); }
      for (let k = 0; k < 5; k++) { const g = chunkGeo(sd++); const sx = k % 2 ? 1 : -1; R.geom('arm' + (sx > 0 ? 'L' : 'R'), g, new THREE.Matrix4().compose(new THREE.Vector3(sx * (0.75 + k * 0.03), 2.25 + k * 0.04, -0.05), Q(k, k, 0), new THREE.Vector3(0.24, 0.2, 0.24)), leaf[k % 4], 'leaf'); g.dispose(); }
    });
  }
  return { R, geom: R.geometry(), S };
}
export function bruteInstance(tpl) { const inst = instance(tpl.R, tpl.geom); return Object.assign(inst, { type: 'brute', t: Math.random() * 10, phase: 0, S: tpl.S }); }
export function animBrute(rig, st, dt) {
  // a giant's walk: everything slow and heavy, the whole body rolling over each planted foot
  const B = rig.bones; const t = (rig.t += dt); rig.phase = (rig.phase || 0) + (st.dist || 0) / (1.7 * rig.S) * Math.PI;
  rig.mv = (rig.mv || 0) + (((st.dist || 0) > 0.0005 ? 1 : 0) - (rig.mv || 0)) * Math.min(1, dt * 5); const m = rig.mv;
  for (const k in B) B[k].rotation.set(0, 0, 0); B.hips.position.set(rig.rest.hips[0], rig.rest.hips[1], rig.rest.hips[2]);
  const s = Math.sin(rig.phase), c = Math.cos(rig.phase);
  B.thighL.rotation.x = -s * 0.42 * m; B.thighR.rotation.x = s * 0.42 * m; B.shinL.rotation.x = Math.max(0, c) * 0.6 * m; B.shinR.rotation.x = Math.max(0, -c) * 0.6 * m;
  B.armL.rotation.x = s * 0.3 * m + 0.1; B.armR.rotation.x = -s * 0.3 * m + 0.1; B.armL.rotation.z = 0.12; B.armR.rotation.z = -0.12; B.foreL.rotation.x = -0.25; B.foreR.rotation.x = -0.25;
  B.hips.position.y -= Math.abs(c) * 0.09 * m * rig.S; B.hips.rotation.z = s * 0.06 * m; B.chest.rotation.z = -s * 0.08 * m; B.chest.rotation.y = s * 0.12 * m;
  B.chest.rotation.x = 0.14 + Math.sin(t * 0.9 + (rig.seed || 0)) * 0.03; B.head.rotation.x = -0.1 + Math.sin(t * 0.9 + 0.6) * 0.02; B.head.rotation.y = Math.sin(t * 0.3 + (rig.seed || 0)) * 0.3 * (1 - m);
  // a two-armed overhead smash: raised slowly (the wind-up), brought down hard as the blow lands
  const w = ease(st.wind || 0), a = st.atk || 0;
  const down = a > 0 && a < 1 ? (a < 0.15 ? ease(a / 0.15) : 1 - ease(clamp((a - 0.4) / 0.6, 0, 1))) : 0;
  const up = w * (a > 0 ? 0 : 1);
  if (up > 0 || down > 0) {
    B.armL.rotation.x += -2.5 * up + 0.9 * down; B.armR.rotation.x += -2.6 * up + 0.9 * down; B.foreL.rotation.x += -0.3 * up; B.foreR.rotation.x += -0.3 * up;
    B.chest.rotation.x += -0.25 * up + 0.45 * down; B.hips.position.y -= 0.14 * down * rig.S - 0.05 * up; B.head.rotation.x += 0.2 * down;
  }
  if (st.hurt && !st.dead) { const h = st.hurt; const k = Math.sin(Math.min(1, h.t / 0.1) * Math.PI * 0.5) * decay(Math.max(0, h.t - 0.1), 5) * Math.min(1.2, 0.4 + h.mag * 5); B.chest.rotation.x -= 0.22 * k * (h.fz < 0 ? -1 : 1); B.chest.rotation.z -= h.fx * 0.2 * k; B.head.rotation.x -= 0.25 * k; B.hips.position.x += h.fx * 0.08 * k; }
  if (st.stun) { B.head.rotation.z = Math.sin(t * 2) * 0.2; B.chest.rotation.x += 0.2; }
  if (st.dead) { const d = ease(Math.min(1, (st.deadT || 0) / 0.9)); B.thighL.rotation.x = -0.9 * d; B.thighR.rotation.x = -0.7 * d; B.shinL.rotation.x = 1.3 * d; B.shinR.rotation.x = 1.1 * d; B.chest.rotation.x = 0.5 * d; B.armL.rotation.x = 0.4 * d; B.armR.rotation.x = 0.2 * d; B.hips.position.y -= 0.35 * d * rig.S;
    const f = ease(clamp(((st.deadT || 0) - 0.5) / 0.6, 0, 1)); B.hips.rotation.x = 1.35 * f; B.hips.position.y -= 0.3 * f * rig.S; B.hips.position.z += 0.5 * f; }
}

// ---------- glowing beings: ghosts and elementals ----------
const lathe = (pts, seg = 22) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
export function buildSpirit(kind, colr) {
  const g = new THREE.Group(); const parts = {}; const mats = [];
  const torso = new THREE.Group(); g.add(torso); const head = new THREE.Group(); torso.add(head); const armL = new THREE.Group(), armR = new THREE.Group(); torso.add(armL, armR);
  const eyeMat = (c) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(2.5), toneMapped: false });
  const sph = (r, m) => new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m);
  let hover = 0.3; const extra = {};
  if (kind === 'ghost') {
    const m = glowMaterial(colr || 0xb8d8f0, 0.5, false, 0.1); mats.push(m);
    const pts = []; for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push([0.04 + Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.5) * 0.36 + t * t * 0.18, 1.55 - t * 1.6]); }
    const body = new THREE.Mesh(lathe(pts), m); body.position.y = -0.2; torso.add(body);
    // a ragged hem: long tatters trailing below the robe
    for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; const tt = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.55 + (k % 3) * 0.15, 5, 1, true), m); tt.rotation.x = Math.PI; tt.position.set(Math.cos(a) * 0.48, -0.55 - (k % 3) * 0.06, Math.sin(a) * 0.48); torso.add(tt); }
    head.position.y = 1.38; const hood = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), m); hood.scale.set(1, 1.15, 1.05); head.add(hood);
    const face = sph(0.19, new THREE.MeshBasicMaterial({ color: 0x0a1018 })); face.position.set(0, -0.04, 0.06); face.scale.set(1, 1.1, 0.7); head.add(face);
    for (const sd of [-1, 1]) { const e = sph(0.04, eyeMat(0x7af0ff)); e.position.set(sd * 0.075, 0, 0.19); e.scale.y = 0.6; head.add(e); }
    for (const [arm, sd] of [[armL, 1], [armR, -1]]) { arm.position.set(sd * 0.34, 1.12, 0.05); const sl = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.75, 8, 1, true), m); sl.position.y = -0.3; arm.add(sl); const hand = sph(0.06, m); hand.position.y = -0.7; arm.add(hand); }
    hover = 0.55;
  } else if (kind === 'fire_elemental') {
    // a molten core, a body of fire and flame tongues licking up from the shoulders, head and arms
    const core = new THREE.MeshStandardMaterial({ color: 0x2a1408, emissive: 0xff5a10, emissiveIntensity: 0.9, roughness: 0.9 }); core.userData.baseEmissive = new THREE.Color(0xff5a10);
    core.onBeforeCompile = (sh) => { sh.uniforms.uTime = uTime; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvP = position;'); sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uTime; varying vec3 vP;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n float cr = sin(vP.x * 23. + uTime * 2.) * sin(vP.y * 19. - uTime * 3.) * sin(vP.z * 21.); totalEmissiveRadiance *= .25 + 2.2 * smoothstep(.25, .6, abs(cr));'); };
    core.customProgramCacheKey = () => 'awmagma'; mats.push(core);
    const fire = glowMaterial(0xff6a1a, 0.55, true, 0.12); mats.push(fire);
    const pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push([0.08 + Math.sin(t * Math.PI) * 0.42 * (1 - t * 0.35) + (1 - t) * 0.04, t * 1.9 - 0.2]); }
    const body = new THREE.Mesh(lathe(pts), fire); torso.add(body);
    const chest = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 2), core); chest.position.y = 1.1; chest.scale.set(1, 1.2, 0.85); torso.add(chest);
    const belly = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 1), core); belly.position.y = 0.6; torso.add(belly);
    head.position.y = 1.72; const hd = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 2), core); head.add(hd);
    for (const sd of [-1, 1]) { const e = sph(0.045, eyeMat(0xffffa0)); e.position.set(sd * 0.08, 0.02, 0.17); head.add(e); }
    for (const [arm, sd] of [[armL, 1], [armR, -1]]) { arm.position.set(sd * 0.45, 1.4, 0); for (let k = 0; k < 3; k++) { const rk = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13 - k * 0.015, 1), core); rk.position.set(sd * 0.05 * k, -0.2 - k * 0.24, 0.02 * k); arm.add(rk); } arm.add(makeFlames([[sd * 0.05, -0.15, 0, 0.45], [sd * 0.1, -0.5, 0.05, 0.35], [sd * 0.12, -0.75, 0.05, 0.45]])); }
    torso.add(makeFlames([[0.25, 1.25, -0.05, 0.6], [-0.25, 1.25, -0.05, 0.6], [0, 1.3, -0.15, 0.7], [0.12, 0.9, 0.18, 0.4], [-0.15, 0.7, 0.15, 0.35], [0, 0.2, 0, 0.8, 0.9], [0.2, 0.35, -0.1, 0.5], [-0.2, 0.4, -0.1, 0.5]]));
    head.add(makeFlames([[0, 0.08, -0.03, 0.62, 0.6], [0.1, 0.05, 0.02, 0.4], [-0.1, 0.05, 0.02, 0.4], [0, 0.12, -0.1, 0.5]]));
    // embers of rock orbiting the body
    const orbit = new THREE.Group(); torso.add(orbit); for (let k = 0; k < 5; k++) { const rk = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06 + (k % 2) * 0.03, 0), core); const a = k / 5 * Math.PI * 2; rk.position.set(Math.cos(a) * 0.7, 0.6 + (k % 3) * 0.35, Math.sin(a) * 0.7); orbit.add(rk); } extra.orbit = orbit;
    hover = 0.25; extra.light = 0xff7a2a;
  } else if (kind === 'water_elemental') {
    const m = new THREE.MeshStandardMaterial({ color: 0x2a7ad0, emissive: 0x0a3a7a, emissiveIntensity: 0.6, transparent: true, opacity: 0.72, roughness: 0.08, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide });
    m.userData.baseEmissive = new THREE.Color(0x0a3a7a);
    m.onBeforeCompile = (sh) => { sh.uniforms.uTime = uTime; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; varying vec3 vP;').replace('#include <begin_vertex>', '#include <begin_vertex>\n vP = position; float fw = sin(position.y * 9. - uTime * 5. + position.x * 4.) * .03 + sin(position.y * 4. + uTime * 2. + position.z * 6.) * .03; transformed += normal * fw;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uTime; varying vec3 vP;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n float fl = smoothstep(.75, 1., sin(vP.y * 14. - uTime * 6. + sin(vP.x * 9. + uTime) * 2.)); totalEmissiveRadiance += vec3(.35, .7, 1.) * fl * .8;'); };
    m.customProgramCacheKey = () => 'awwater'; mats.push(m);
    const pts = []; for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push([0.1 + Math.sin(t * Math.PI) * 0.4 * (1 - t * 0.25) + (1 - t) * (1 - t) * 0.35, t * 1.75 - 0.15]); }
    const body = new THREE.Mesh(lathe(pts, 28), m); torso.add(body);
    head.position.y = 1.78; const hd = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 14), m); hd.scale.set(1, 1.1, 1); head.add(hd);
    for (const sd of [-1, 1]) { const e = sph(0.04, eyeMat(0xe0ffff)); e.position.set(sd * 0.085, 0.03, 0.2); head.add(e); }
    for (const [arm, sd] of [[armL, 1], [armR, -1]]) { arm.position.set(sd * 0.42, 1.38, 0.05); const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.55, 6, 12), m); a.position.y = -0.35; arm.add(a); }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 8, 40), m); ring.rotation.x = Math.PI / 2; ring.position.y = 0.05; torso.add(ring); extra.ring = ring;
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.035, 8, 32), m); ring2.rotation.x = Math.PI / 2 + 0.3; ring2.position.y = 0.95; torso.add(ring2); extra.ring2 = ring2;
    hover = 0.2;
  } else { // air elemental: a pale whirlwind with a face in the gust
    const m = glowMaterial(0xd8ecff, 0.32, true, 0.05); mats.push(m);
    const vortex = new THREE.Group(); torso.add(vortex);
    for (let k = 0; k < 7; k++) { const rr = 0.18 + k * 0.08; const tor = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.035 + k * 0.004, 6, 28, Math.PI * 1.4), m); tor.rotation.x = Math.PI / 2; tor.position.y = 0.05 + k * 0.26; tor.userData.spin = (k % 2 ? 1 : -1) * (3 + k * 0.4); vortex.add(tor); }
    const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([0.05 + t * 0.55, t * 1.9]); }
    const cone = new THREE.Mesh(lathe(pts, 20), glowMaterial(0xeaf4ff, 0.14, true, 0.15)); torso.add(cone); mats.push(cone.material);
    head.position.y = 1.9; const hd = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), m); head.add(hd);
    for (const sd of [-1, 1]) { const e = sph(0.04, eyeMat(0xffffff)); e.position.set(sd * 0.08, 0.02, 0.19); head.add(e); }
    for (const [arm, sd] of [[armL, 1], [armR, -1]]) { arm.position.set(sd * 0.55, 1.5, 0); const a = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.04, 6, 18, Math.PI * 1.5), m); a.position.y = -0.25; arm.add(a); a.userData.spin = sd * 6; }
    extra.vortex = vortex; hover = 0.15;
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  parts.torso = torso; parts.head = head; parts.armL = armL; parts.armR = armR;
  return { mesh: g, type: 'spirit', kind, parts, mats, hover, t: Math.random() * 10, ...extra };
}
export function animSpirit(rig, st, dt) {
  const t = (rig.t += dt); const P = rig.parts; const g = rig.mesh;
  let sq = 0; if (st.hurt && !st.dead) { const h = st.hurt; sq = Math.sin(Math.min(1, h.t / 0.06) * Math.PI * 0.5) * decay(Math.max(0, h.t - 0.06), 9) * Math.min(1, 0.4 + h.mag * 5); }
  const fade = st.dead ? Math.max(0.02, 1 - (st.deadT || 0) / 1.0) : 1;
  const m = Math.min(1, (st.dist || 0) / Math.max(dt, 1e-3) / 4);
  g.scale.set((1 + sq * 0.25) * fade, (1 - sq * 0.2) * (st.dead ? 0.6 + 0.4 * fade : 1), (1 + sq * 0.25) * fade);
  P.torso.position.y = rig.hover + Math.sin(t * 2.2) * 0.08; P.torso.rotation.x = 0.12 * m + (st.hurt ? -sq * 0.3 : 0); P.torso.rotation.z = Math.sin(t * 1.3) * 0.04;
  if (st.hurt) { P.torso.position.x = st.hurt.fx * 0.2 * sq; P.torso.position.z = st.hurt.fz * 0.2 * sq; }
  const w = ease(st.wind || 0), a = st.atk || 0; const s1 = a > 0 && a < 1 ? Math.sin(a * Math.PI) : 0;
  P.armL.rotation.x = -0.3 - s1 * 1.4 - w * 1.8 + Math.sin(t * 2) * 0.12; P.armR.rotation.x = -0.3 - s1 * 1.4 - w * 1.8 + Math.sin(t * 2 + 1) * 0.12;
  P.armL.rotation.z = 0.25 + w * 0.4; P.armR.rotation.z = -0.25 - w * 0.4; P.head.rotation.y = Math.sin(t * 0.7) * 0.3; P.torso.position.z = s1 * 0.4;
  if (rig.orbit) rig.orbit.rotation.y = t * 1.6;
  if (rig.ring) { rig.ring.rotation.z = t * 2; rig.ring.scale.setScalar(1 + Math.sin(t * 3) * 0.08); rig.ring2.rotation.z = -t * 2.6; }
  if (rig.vortex) for (const c of rig.vortex.children) c.rotation.z = t * c.userData.spin;
  for (const arm of [P.armL, P.armR]) for (const c of arm.children) if (c.userData.spin) c.rotation.z = t * c.userData.spin;
  if (st.dead) { P.torso.position.y = rig.hover - (1 - fade) * 0.5; g.visible = fade > 0.03; }
}
