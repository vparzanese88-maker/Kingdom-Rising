// Aeternum Wilds: what makes the undead and corrupted humanoids (and some summons) distinctive, laid over
// whatever human body the characters code builds. Uses only the humanoid's `parts` groups
// (head, upper, hips, armL/armR, handL/handR, legL/legR, hair): the body is measured in its rest pose, each
// piece is built in body space at that size and then hung on the part it should move with.
//
//   dressHumanoid(model, look)   look: 'lost' | 'lostArcher' | 'withered' | 'spitter' | 'corrupted' | 'brute' |
//                                'corruptArcher' | 'grimsby' | 'hag' | 'warden' | 'skeleton' | 'flaming_skeleton' |
//                                'zombie' | 'imp'
//   updateAccessories(model, t, st)  animates capes, wings, tails, glowing cores and flames (st: { move, dead })
import { THREE, Q, makeFlames, uTime } from './core.js';

const V3 = THREE.Vector3;
const _m = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _b = new THREE.Box3(), _v = new V3();

// ---------- measuring the body (in the body group's own, unscaled space) ----------
function relMatrix(body, o, out = new THREE.Matrix4()) { _inv.copy(body.matrixWorld).invert(); return out.multiplyMatrices(_inv, o.matrixWorld); }
function partBox(body, part, partSet) {
  const box = new THREE.Box3(); let any = false;
  const visit = (o) => {
    for (const c of o.children) {
      if (partSet.has(c) || c.userData.acc) continue;
      if (c.isMesh && c.geometry && c.visible !== false && !c.isInstancedMesh) {
        if (!c.geometry.boundingBox) c.geometry.computeBoundingBox();
        _b.copy(c.geometry.boundingBox).applyMatrix4(relMatrix(body, c, _m)); box.union(_b); any = true;
      }
      visit(c);
    }
  };
  visit(part);
  return any ? box : null;
}
const posOf = (body, o) => new V3().setFromMatrixPosition(relMatrix(body, o, _m));
export function measure(model) {
  const P = model.parts, body = model.body; model.root.updateMatrixWorld(true);
  const partSet = new Set(Object.values(P).filter(Boolean));
  const L = {};
  const sh = { L: posOf(body, P.armL), R: posOf(body, P.armR) }; L.sh = sh;
  const shW = Math.max(0.3, Math.abs(sh.L.x - sh.R.x));
  L.hand = { L: posOf(body, P.handL || P.armL), R: posOf(body, P.handR || P.armR) };
  L.hips = posOf(body, P.hips || P.upper);
  L.legs = { L: posOf(body, P.legL), R: posOf(body, P.legR) };
  // head: its own meshes without the hair, or a guess from the shoulders
  const hb = partBox(body, P.head, new Set([...partSet].filter((p) => p !== P.head)));
  const hp = posOf(body, P.head);
  if (hb) { L.headC = hb.getCenter(new V3()); const s = hb.getSize(new V3()); L.headR = Math.max(s.x, s.y, s.z) * 0.5; L.headFront = hb.max.z; L.headTop = hb.max.y; L.headBot = hb.min.y; }
  else { L.headR = shW * 0.28; L.headC = hp.clone().add(new V3(0, L.headR * 0.2, 0)); L.headFront = L.headC.z + L.headR; L.headTop = L.headC.y + L.headR; L.headBot = L.headC.y - L.headR; }
  L.headR = Math.min(Math.max(L.headR, 0.14), 0.3);
  // torso: the upper body's own meshes (not head or arms)
  const ub = partBox(body, P.upper, partSet);
  if (ub) { L.chestTop = Math.min(ub.max.y, L.headBot); L.waist = ub.min.y; L.chestW = (ub.max.x - ub.min.x) * 0.5; L.chestD = (ub.max.z - ub.min.z) * 0.5; L.chestZ = (ub.max.z + ub.min.z) * 0.5; L.chestFront = ub.max.z; L.chestBack = ub.min.z; }
  else { L.chestTop = (sh.L.y + sh.R.y) / 2 + 0.05; L.waist = L.hips.y + 0.05; L.chestW = shW * 0.42; L.chestD = shW * 0.22; L.chestZ = 0; L.chestFront = L.chestD; L.chestBack = -L.chestD; }
  L.chestW = Math.min(L.chestW, shW * 0.7);
  const lb = partBox(body, P.legL, partSet); L.foot = lb ? lb.min.y : 0;
  L.armLen = Math.max(0.3, sh.L.distanceTo(L.hand.L));
  L.shW = shW;
  return L;
}

// ---------- building pieces in body space, bucketed by the part they hang on and their material ----------
const geoCache = new Map();
function mergeList(list) {
  let n = 0; for (const [g] of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0; const nm = new THREE.Matrix3();
  for (const [g, m] of list) {
    const pa = g.attributes.position, na = g.attributes.normal; nm.getNormalMatrix(m);
    for (let i = 0; i < pa.count; i++) { _v.fromBufferAttribute(pa, i).applyMatrix4(m); pos[o] = _v.x; pos[o + 1] = _v.y; pos[o + 2] = _v.z; _v.fromBufferAttribute(na, i).applyMatrix3(nm).normalize(); nor[o] = _v.x; nor[o + 1] = _v.y; nor[o + 2] = _v.z; o += 3; }
  }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.computeBoundingSphere(); return out;
}
const PRIM = {};
const prim = (k, f) => PRIM[k] || (PRIM[k] = (() => { const g = f(); const ng = g.index ? g.toNonIndexed() : g; ng.deleteAttribute('uv'); return ng; })());
const G_ = {
  sph: () => prim('sph', () => new THREE.SphereGeometry(1, 14, 10)),
  lsph: () => prim('lsph', () => new THREE.SphereGeometry(1, 8, 6)),
  box: () => prim('box', () => new THREE.BoxGeometry(1, 1, 1)),
  cyl: () => prim('cyl', () => new THREE.CylinderGeometry(1, 1, 1, 10)),
  cone: () => prim('cone', () => new THREE.ConeGeometry(1, 1, 8)),
  ico: () => prim('ico', () => new THREE.IcosahedronGeometry(1, 0)),
  ring: (arc) => prim('ring' + arc, () => new THREE.TorusGeometry(1, 0.08, 5, 18, arc)),
};
class Kit {
  constructor() { this.b = new Map(); }
  put(part, mat, g, m) { const k = part + '|' + mat; if (!this.b.has(k)) this.b.set(k, []); this.b.get(k).push([g, m.clone()]); return this; }
  ell(part, mat, p, s, rot) { return this.put(part, mat, G_.sph(), _m.compose(new V3(...p), rot || new THREE.Quaternion(), new V3(...s))); }
  lo(part, mat, p, s, rot) { return this.put(part, mat, G_.lsph(), _m.compose(new V3(...p), rot || new THREE.Quaternion(), new V3(...s))); }
  box(part, mat, p, s, rot) { return this.put(part, mat, G_.box(), _m.compose(new V3(...p), rot || new THREE.Quaternion(), new V3(...s))); }
  ico(part, mat, p, s, rot) { return this.put(part, mat, G_.ico(), _m.compose(new V3(...p), rot || new THREE.Quaternion(), new V3(...s))); }
  // a rod between two points, tapering r0 -> r1
  rod(part, mat, a, b, r0, r1 = r0) {
    const A = new V3(...a), B = new V3(...b); const L = A.distanceTo(B); if (L < 1e-4) return this;
    const key = 'tc' + (r1 / r0).toFixed(2); const g = prim(key, () => new THREE.CylinderGeometry(r1 / r0, 1, 1, 8));
    const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), B.clone().sub(A).normalize());
    this.put(part, mat, g, _m.compose(A.clone().add(B).multiplyScalar(0.5), q, new V3(r0, L, r0)));
    return this.lo(part, mat, a, [r0, r0, r0]);
  }
  cone(part, mat, base, dir, r, h) { const D = new V3(...dir).normalize(); const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), D); const c = new V3(...base).addScaledVector(D, h / 2); return this.put(part, mat, G_.cone(), _m.compose(c, q, new V3(r, h, r))); }
  // a bent horn: segments along dir, curling by bend each step
  horn(part, mat, p, dir, len, r0, n, bend) { let P = new V3(...p), D = new V3(...dir).normalize(); const Bd = new V3(...bend); for (let k = 0; k < n; k++) { const Q2 = P.clone().addScaledVector(D, len / n); const ra = r0 * (1 - k / n) + 0.004, rb = r0 * (1 - (k + 1) / n) + 0.003; this.rod(part, mat, P.toArray(), Q2.toArray(), ra, rb); P = Q2; D.add(Bd).normalize(); } return this; }
  ring(part, mat, c, R, tube, arc, rot, sy = 1) { return this.put(part, mat, G_.ring(arc.toFixed(2)), _m.compose(new V3(...c), rot || new THREE.Quaternion(), new V3(R, R * sy, tube / 0.08))); }
  // a flat panel (cape, coat tail, wing membrane): two-sided quad strip from points
  panel(part, mat, pts, tris) { const key = null; void key; const g = new THREE.BufferGeometry(); const p = []; for (let i = 0; i < tris.length; i += 3) for (const j of [tris[i], tris[i + 1], tris[i + 2], tris[i], tris[i + 2], tris[i + 1]]) p.push(...pts[j]); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.computeVertexNormals(); return this.put(part, mat, g, new THREE.Matrix4()); }
}

// ---------- materials (each model gets its own, so hit flashes stay its own) ----------
const MAT = {
  bone: { color: 0xe2d8bc, roughness: 0.65 }, oldbone: { color: 0xb8a882, roughness: 0.8 }, char: { color: 0x2a201a, roughness: 0.9 },
  socket: { color: 0x050404, roughness: 1 }, iron: { color: 0x2e2e34, roughness: 0.42, metalness: 0.75 }, steel: { color: 0x6a6a70, roughness: 0.35, metalness: 0.8 },
  gold: { color: 0xc89a3a, roughness: 0.32, metalness: 0.9 }, wood: { color: 0x4a3420, roughness: 0.9 }, seaweed: { color: 0x3a5a2a, roughness: 0.55 },
  barnacle: { color: 0xc8c0b0, roughness: 0.95 }, navy: { color: 0x1a2a48, roughness: 0.85 }, redcloth: { color: 0x7a1a14, roughness: 0.9 }, rag: { color: 0x4a4232, roughness: 0.95 },
  hood: { color: 0x2a3020, roughness: 0.95 }, hoodred: { color: 0x3a0e0e, roughness: 0.95 }, rot: { color: 0x3a3a1e, roughness: 0.8 }, flesh: { color: 0x7a3a34, roughness: 0.55 },
  leather: { color: 0x4a3222, roughness: 0.7 }, wing: { color: 0x5a1a14, roughness: 0.7, side: THREE.DoubleSide }, feather: { color: 0xe8e0d0, roughness: 0.8 },
  cape: { color: 0x2a0606, roughness: 0.9, side: THREE.DoubleSide }, coat: { color: 0x1c2c4c, roughness: 0.85, side: THREE.DoubleSide }, hair: { color: 0x9a9a92, roughness: 0.8 },
  glowTeal: { color: 0x6af0e0, emissive: 0x6af0e0, ei: 2.2 }, glowBlue: { color: 0x7ad8ff, emissive: 0x7ad8ff, ei: 2.4 }, glowGreen: { color: 0xb8ff40, emissive: 0x9aff30, ei: 1.8 },
  glowRed: { color: 0xff4020, emissive: 0xff2a10, ei: 2.2 }, glowFire: { color: 0xffa040, emissive: 0xff8a20, ei: 2.6 }, glowAmber: { color: 0xffd060, emissive: 0xffc040, ei: 2.2 },
  crystal: { color: 0xa01010, emissive: 0xff2010, ei: 1.1, roughness: 0.15, metalness: 0.2 }, core: { color: 0xff5020, emissive: 0xff3010, ei: 3 },
};
function material(key) {
  const d = MAT[key] || MAT.bone;
  const m = new THREE.MeshStandardMaterial({ color: d.color, roughness: d.roughness ?? 0.6, metalness: d.metalness ?? 0, emissive: d.emissive ?? 0x000000, emissiveIntensity: d.ei ?? 1, side: d.side ?? THREE.FrontSide, flatShading: key === 'crystal' || key === 'barnacle' });
  m.userData.baseEmissive = m.emissive.clone();
  return m;
}

// ---------- the looks ----------
// a skull around the head: cranium, cheekbones, deep sockets with a glow inside, nasal hole, teeth and jaw
function skull(K, L, mat, glow, opt = {}) {
  const c = L.headC, r = L.headR * 1.06, f = c.z + r * 0.86, hz = c.z;
  K.ell('head', mat, [c.x, c.y + r * 0.12, hz - r * 0.04], [r * 0.95, r * 0.92, r * 1.05]);
  K.ell('head', mat, [c.x, c.y - r * 0.18, hz + r * 0.35], [r * 0.74, r * 0.5, r * 0.62]); // the face
  for (const sx of [-1, 1]) {
    K.ell('head', mat, [c.x + sx * r * 0.52, c.y - r * 0.2, hz + r * 0.55], [r * 0.22, r * 0.16, r * 0.3]); // cheekbones
    K.ell('head', 'socket', [c.x + sx * r * 0.33, c.y + r * 0.02, f - r * 0.06], [r * 0.24, r * 0.22, r * 0.14]);
    if (glow) K.ell('head', glow, [c.x + sx * r * 0.33, c.y + r * 0.0, f + r * 0.02], [r * 0.08, r * 0.08, r * 0.05]);
  }
  K.cone('head', 'socket', [c.x, c.y - r * 0.35, f - r * 0.04], [0, 1, 0.25], r * 0.09, r * 0.22); // nasal hole
  K.ell('head', mat, [c.x, c.y - r * 0.62, hz + r * 0.38], [r * 0.56, r * 0.2, r * 0.48]); // the jaw
  for (let k = -3; k <= 3; k++) K.box('head', 'bone', [c.x + k * r * 0.1, c.y - r * 0.49, f - r * 0.2 - Math.abs(k) * r * 0.04], [r * 0.075, r * 0.12, r * 0.05]);
  if (opt.crack) K.box('head', opt.crack, [c.x + r * 0.25, c.y + r * 0.55, hz + r * 0.6], [r * 0.03, r * 0.4, r * 0.03], Q(0.5, 0, 0.6));
}
// ribs: a sternum and rib arcs around the front (all the way round for a bare skeleton)
function ribcage(K, L, mat, full, part = 'upper') {
  const top = L.chestTop - 0.06, bot = L.chestTop - (L.chestTop - L.waist) * 0.62; const w = L.chestW * (full ? 0.8 : 1.02), d = L.chestD * (full ? 0.8 : 1.05), z = L.chestZ;
  const n = 5;
  for (let k = 0; k < n; k++) { const u = k / (n - 1); const y = top - (top - bot) * u; const ww = w * (0.85 + Math.sin(u * Math.PI) * 0.2);
    K.ring(part, mat, [0, y, z + (full ? 0 : d * 0.1)], ww, 0.022, full ? Math.PI * 1.75 : Math.PI, Q(Math.PI / 2 + 0.3, 0, 0).multiply(Q(0, 0, full ? -Math.PI / 2 + Math.PI * 0.125 : 0)), d / ww); }
  K.box(part, mat, [0, (top + bot) / 2, z + d * (full ? 0.82 : 1.02)], [0.05, top - bot + 0.04, 0.03]); // sternum
}
function spine(K, L, mat, part = 'upper') { const back = L.chestZ - L.chestD * 0.75; for (let y = L.waist; y < L.chestTop; y += 0.06) K.ell(part, mat, [0, y, back], [0.035, 0.026, 0.035]); }
function limbBones(K, L, mat, glow) {
  for (const S of ['L', 'R']) {
    const s = L.sh[S], h = L.hand[S]; const el = s.clone().lerp(h, 0.5).add(new V3(0, 0, -0.02));
    K.rod('arm' + S, mat, s.toArray(), el.toArray(), 0.03, 0.022); K.ell('arm' + S, mat, el.toArray(), [0.035, 0.035, 0.035]);
    K.rod('arm' + S, mat, el.toArray(), h.toArray(), 0.022, 0.018); K.rod('arm' + S, mat, el.clone().add(new V3(0.015, 0, 0.01)).toArray(), h.clone().add(new V3(0.015, 0, 0.01)).toArray(), 0.014, 0.012);
    K.ell('arm' + S, mat, h.toArray(), [0.045, 0.05, 0.035]); for (let k = -1; k <= 2; k++) K.rod('arm' + S, mat, [h.x + k * 0.015, h.y - 0.03, h.z + 0.02], [h.x + k * 0.017, h.y - 0.1, h.z + 0.04], 0.009, 0.006);
    K.ell('arm' + S, mat, s.toArray(), [0.06, 0.05, 0.06]);
    const hip = L.legs[S]; const ft = new V3(hip.x, L.foot + 0.06, hip.z); const kn = hip.clone().lerp(ft, 0.5).add(new V3(0, 0, 0.03));
    K.rod('leg' + S, mat, hip.toArray(), kn.toArray(), 0.04, 0.03); K.ell('leg' + S, mat, kn.toArray(), [0.045, 0.045, 0.05]);
    K.rod('leg' + S, mat, kn.toArray(), ft.toArray(), 0.03, 0.022); K.ell('leg' + S, mat, [ft.x, L.foot + 0.03, ft.z + 0.06], [0.05, 0.03, 0.11]);
  }
  void glow;
}
function pelvis(K, L, mat) { const h = L.hips; K.ring('hips', mat, [h.x, h.y + 0.02, h.z], L.chestW * 0.65, 0.03, Math.PI * 2, Q(Math.PI / 2 + 0.3, 0, 0), 0.6); K.ell('hips', mat, [h.x, h.y + 0.08, h.z - 0.06], [0.06, 0.08, 0.05]); }
function seaweed(K, L, part, from, n, len) { for (let k = 0; k < n; k++) { const a = from[0] + (k - n / 2) * 0.05, z = from[2] + Math.sin(k * 2.1) * 0.05; K.rod(part, 'seaweed', [a, from[1], z], [a + Math.sin(k) * 0.04, from[1] - len * (0.6 + (k % 3) * 0.2), z + 0.03], 0.018, 0.006); } }
function barnacles(K, part, c, n, r) { for (let k = 0; k < n; k++) { const a = k * 2.4; K.ico(part, 'barnacle', [c[0] + Math.cos(a) * r, c[1] + Math.sin(a * 1.7) * r * 0.6, c[2] + Math.sin(a) * r], [0.025 + (k % 3) * 0.008, 0.02, 0.025]); } }
function cracks(K, L, mat, where) {
  // thin glowing veins over arms and torso
  if (where.includes('arms')) for (const S of ['L', 'R']) { const s = L.sh[S], h = L.hand[S]; const sx = S === 'L' ? 1 : -1;
    for (let k = 0; k < 3; k++) { const a = s.clone().lerp(h, 0.15 + k * 0.25); K.box('arm' + S, mat, [a.x + sx * 0.06, a.y, a.z + 0.04], [0.012, 0.13, 0.012], Q(0.2, 0, sx * (0.4 - k * 0.3))); } }
  if (where.includes('chest')) for (let k = 0; k < 4; k++) { const y = L.chestTop - 0.08 - k * 0.09; K.box('upper', mat, [(k % 2 ? 0.08 : -0.06) * (1 + k * 0.2), y, L.chestFront + 0.005], [0.012, 0.12, 0.01], Q(0, 0, (k % 2 ? 0.6 : -0.5))); }
}
function pauldrons(K, L, mat, spikes, big = 1) {
  for (const S of ['L', 'R']) { const s = L.sh[S], sx = S === 'L' ? 1 : -1; const r = L.shW * 0.2 * big;
    K.ell('arm' + S, mat, [s.x + sx * r * 0.2, s.y + r * 0.3, s.z], [r * 1.05, r * 0.75, r * 1.1]);
    K.ell('arm' + S, mat, [s.x + sx * r * 0.35, s.y - r * 0.15, s.z], [r * 0.95, r * 0.5, r * 1.0]);
    if (spikes) for (let k = 0; k < spikes; k++) K.cone('arm' + S, spikes > 2 ? 'iron' : 'steel', [s.x + sx * r * 0.4, s.y + r * 0.6, s.z + (k - (spikes - 1) / 2) * r * 0.6], [sx * 0.5, 1, 0], r * 0.16, r * (0.9 + (k === 1 ? 0.4 : 0)));
  }
}
function crystals(K, part, base, n, s, mat = 'crystal') { for (let k = 0; k < n; k++) { const a = k * 2.2; const d = [Math.cos(a) * 0.5, 1, -0.6 + Math.sin(a) * 0.3]; K.cone(part, mat, [base[0] + Math.cos(a) * s * 0.6, base[1] + (k % 2) * s * 0.3, base[2] + Math.sin(a) * s * 0.4], d, s * (0.22 + (k % 3) * 0.06), s * (0.9 + (k % 3) * 0.45)); } }
function helm(K, L, mat, visor, horns, crest) {
  const c = L.headC, r = L.headR * 1.14;
  K.ell('head', mat, [c.x, c.y + r * 0.08, c.z], [r, r * 1.0, r * 1.02]);
  K.box('head', mat, [c.x, c.y - r * 0.45, c.z + r * 0.55], [r * 1.2, r * 0.6, r * 0.5]); // the jaw guard
  K.box('head', 'socket', [c.x, c.y + r * 0.02, c.z + r * 0.9], [r * 1.1, r * 0.14, r * 0.25]);
  if (visor) K.box('head', visor, [c.x, c.y + r * 0.02, c.z + r * 0.94], [r * 0.9, r * 0.05, r * 0.2]);
  if (crest) for (let k = 0; k < 5; k++) K.cone('head', mat, [c.x, c.y + r * 0.85 - k * r * 0.12, c.z + r * 0.5 - k * r * 0.3], [0, 1, -0.3 - k * 0.1], r * 0.1, r * 0.55 - k * r * 0.05);
  if (horns) for (const sx of [-1, 1]) K.horn('head', 'oldbone', [c.x + sx * r * 0.8, c.y + r * 0.35, c.z], [sx, 0.6, 0.15], r * 1.6 * horns, r * 0.22, 6, [sx * -0.08, 0.12, 0.08]);
}
function hood(K, L, mat, point) {
  const c = L.headC, r = L.headR * 1.22;
  const g = prim('hood', () => new THREE.SphereGeometry(1, 16, 12, -Math.PI * 0.2, Math.PI * 1.4, 0, Math.PI * 0.75));
  K.put('head', mat, g, _m.compose(new V3(c.x, c.y + r * 0.05, c.z - r * 0.08), Q(0, Math.PI * 1.0, 0), new V3(r, r * 1.08, r * 1.08)));
  K.put('head', mat, g, _m.compose(new V3(c.x, c.y + r * 0.04, c.z - r * 0.06), Q(0, Math.PI * 1.0, 0), new V3(r * 0.97, r * 1.05, r * 1.05)));
  if (point) K.cone('head', mat, [c.x, c.y + r * 0.5, c.z - r * 0.65], [0, 0.4, -1], r * 0.35, r * 0.9);
  // the drape over the shoulders
  K.ell('upper', mat, [0, L.chestTop - 0.02, L.chestZ - L.chestD * 0.2], [L.chestW * 1.05, 0.13, L.chestD * 1.25]);
}
function quiver(K, L) { const z = L.chestBack - 0.06; K.rod('upper', 'leather', [0.12, L.waist + 0.1, z], [-0.1, L.chestTop + 0.05, z - 0.04], 0.07, 0.08); for (let k = 0; k < 4; k++) K.rod('upper', 'feather', [-0.08 + k * 0.02, L.chestTop + 0.04, z - 0.04], [-0.12 + k * 0.025, L.chestTop + 0.2, z - 0.07], 0.012, 0.012); }
function cloakBack(K, L, mat, len) { // hangs from the shoulders to near the ground, a little flared
  const y0 = L.chestTop - 0.02, z0 = L.chestBack - 0.03, w = L.chestW * 1.1; const y1 = Math.max(L.foot + 0.1, y0 - len);
  const pts = [[-w, y0, z0], [w, y0, z0], [-w * 1.45, y1, z0 - 0.25], [w * 1.45, y1, z0 - 0.25], [0, y1 - 0.08, z0 - 0.3], [-w * 1.2, (y0 + y1) / 2, z0 - 0.12], [w * 1.2, (y0 + y1) / 2, z0 - 0.12]];
  return K.panel('cape', mat, pts, [0, 1, 6, 0, 6, 5, 5, 6, 3, 5, 3, 4, 5, 4, 2]);
}

const BUILD = {
  skeleton(K, L) { skull(K, L, 'bone', 'glowBlue'); ribcage(K, L, 'bone', true); spine(K, L, 'bone'); pelvis(K, L, 'bone'); limbBones(K, L, 'bone'); K.rod('head', 'bone', [L.headC.x, L.headBot, L.headC.z - 0.03], [0, L.chestTop - 0.02, L.chestZ - 0.04], 0.03, 0.035); },
  flaming_skeleton(K, L) { skull(K, L, 'char', 'glowFire'); ribcage(K, L, 'char', true); spine(K, L, 'char'); pelvis(K, L, 'char'); limbBones(K, L, 'char'); K.rod('head', 'char', [L.headC.x, L.headBot, L.headC.z - 0.03], [0, L.chestTop - 0.02, L.chestZ - 0.04], 0.03, 0.035);
    K.flames = [['head', [[L.headC.x, L.headTop - 0.06, L.headC.z, 0.55, 0.6], [L.headC.x + 0.08, L.headTop - 0.1, L.headC.z - 0.05, 0.35], [L.headC.x - 0.08, L.headTop - 0.1, L.headC.z - 0.05, 0.35]]],
      ['upper', [[0, L.chestTop - 0.25, L.chestZ, 0.55, 0.7], [L.chestW * 0.6, L.chestTop - 0.05, L.chestZ, 0.35], [-L.chestW * 0.6, L.chestTop - 0.05, L.chestZ, 0.35]]], ['armL', [[L.hand.L.x, L.hand.L.y, L.hand.L.z, 0.3]]], ['armR', [[L.hand.R.x, L.hand.R.y, L.hand.R.z, 0.3]]]]; },
  zombie(K, L) { ribcage(K, L, 'oldbone', false); for (let k = 0; k < 5; k++) K.ell(k < 2 ? 'head' : 'upper', 'rot', k < 2 ? [L.headC.x + (k ? 0.1 : -0.08), L.headC.y + (k ? 0.08 : -0.05), L.headFront - 0.04] : [(k - 3) * 0.12, L.chestTop - 0.15 - k * 0.04, L.chestFront - 0.01], [0.06, 0.05, 0.025]);
    const h = L.hand.L, s = L.sh.L; const el = s.clone().lerp(h, 0.55); K.rod('armL', 'oldbone', [el.x + 0.02, el.y, el.z + 0.05], [h.x + 0.02, h.y + 0.05, h.z + 0.05], 0.022, 0.018); K.ell('armL', 'flesh', [el.x + 0.02, el.y - 0.02, el.z + 0.04], [0.05, 0.08, 0.04]);
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; K.box('hips', 'rag', [Math.cos(a) * L.chestW * 0.95, L.hips.y - 0.18, Math.sin(a) * L.chestD * 1.1], [0.08, 0.28 + (k % 3) * 0.08, 0.02], Q(0, -a + Math.PI / 2, 0.1)); } },
  lost(K, L) { skull(K, L, 'oldbone', 'glowTeal'); ribcage(K, L, 'oldbone', false); seaweed(K, L, 'upper', [L.chestW * 0.7, L.chestTop, L.chestZ], 4, 0.4); seaweed(K, L, 'head', [L.headC.x - 0.05, L.headTop - 0.04, L.headC.z - 0.1], 3, 0.25); barnacles(K, 'armR', [L.sh.R.x - 0.04, L.sh.R.y + 0.02, L.sh.R.z], 7, 0.06);
    const c = L.headC, r = L.headR * 1.1; K.ell('head', 'redcloth', [c.x, c.y + r * 0.45, c.z - r * 0.05], [r * 1.02, r * 0.55, r * 1.05]); K.rod('head', 'redcloth', [c.x - r * 0.3, c.y + r * 0.3, c.z - r * 0.95], [c.x - r * 0.45, c.y - r * 0.4, c.z - r * 1.1], 0.03, 0.02); },
  lostArcher(K, L) { BUILD.lost(K, L); quiver(K, L); },
  withered(K, L) { cracks(K, L, 'glowGreen', 'arms,chest'); for (let k = 0; k < 4; k++) K.cone('upper', 'oldbone', [0, L.chestTop - 0.05 - k * 0.1, L.chestBack + 0.02], [0, 0.4, -1], 0.035, 0.18 + (k % 2) * 0.08);
    for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; K.box('hips', 'rag', [Math.cos(a) * L.chestW, L.hips.y - 0.15, Math.sin(a) * L.chestD * 1.15], [0.09, 0.3 + (k % 3) * 0.1, 0.02], Q(0, -a + Math.PI / 2, 0.08)); }
    K.ell('head', 'glowGreen', [L.headC.x + 0.08, L.headC.y + 0.03, L.headFront + 0.005], [0.022, 0.022, 0.01]); K.ell('head', 'glowGreen', [L.headC.x - 0.08, L.headC.y + 0.03, L.headFront + 0.005], [0.022, 0.022, 0.01]);
    for (let k = 0; k < 6; k++) K.rod('head', 'hair', [L.headC.x + (k - 2.5) * 0.06, L.headTop - 0.02, L.headC.z - 0.05], [L.headC.x + (k - 2.5) * 0.08, L.headC.y - 0.15, L.headC.z - 0.2], 0.012, 0.006); },
  spitter(K, L) { K.ell('upper', 'glowGreen', [0, L.chestTop + 0.02, L.chestFront + 0.02], [L.headR * 0.75, L.headR * 0.6, L.headR * 0.55]); // the bloated throat sac
    for (let k = 0; k < 7; k++) K.ell('upper', k % 2 ? 'glowGreen' : 'rot', [Math.sin(k * 2.3) * L.chestW * 0.7, L.chestTop - 0.05 - (k % 4) * 0.08, L.chestBack - 0.01], [0.05, 0.05, 0.04]);
    cracks(K, L, 'glowGreen', 'arms'); },
  corrupted(K, L) { helm(K, L, 'iron', 'glowRed', 0, true); pauldrons(K, L, 'iron', 2); crystals(K, 'upper', [0, L.chestTop - 0.12, L.chestBack - 0.02], 4, 0.3); cracks(K, L, 'glowRed', 'arms,chest');
    K.box('upper', 'iron', [0, L.chestTop - 0.18, L.chestFront + 0.01], [L.chestW * 1.5, 0.3, 0.05]); },
  brute(K, L) { helm(K, L, 'iron', 'glowRed', 1.1, false); pauldrons(K, L, 'iron', 3, 1.35); crystals(K, 'upper', [0, L.chestTop - 0.1, L.chestBack - 0.02], 6, 0.45); cracks(K, L, 'glowRed', 'arms,chest');
    K.box('upper', 'iron', [0, L.waist + 0.15, L.chestFront + 0.02], [L.chestW * 1.6, 0.22, 0.06]); for (let k = -2; k <= 2; k++) K.cone('upper', 'steel', [k * 0.1, L.waist + 0.15, L.chestFront + 0.05], [0, 0, 1], 0.025, 0.08); },
  corruptArcher(K, L) { hood(K, L, 'hoodred', true); for (const sx of [-1, 1]) K.ell('head', 'glowRed', [L.headC.x + sx * 0.075, L.headC.y + 0.03, L.headFront + 0.01], [0.025, 0.018, 0.01]); crystals(K, 'upper', [0.1, L.chestTop - 0.05, L.chestBack], 3, 0.22); quiver(K, L); cracks(K, L, 'glowRed', 'arms'); },
  grimsby(K, L) {
    // a captain's tricorn: a wide brim cocked up into three corners, gold-edged, with a skull badge and a plume
    const c = L.headC, r = L.headR, ty = L.headTop - r * 0.15;
    K.put('head', 'navy', prim('tric', () => new THREE.CylinderGeometry(1, 0.9, 1, 10)), _m.compose(new V3(c.x, ty + r * 0.3, c.z - r * 0.05), Q(0, 0, 0), new V3(r * 0.95, r * 0.6, r * 1.0)));
    for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + Math.PI; const p = [c.x + Math.sin(a) * r * 1.05, ty + r * 0.25, c.z - r * 0.05 + Math.cos(a) * r * 1.05];
      K.box('head', 'navy', p, [r * 1.9, r * 0.55, 0.03], Q(0, a, 0).multiply(Q(-0.35, 0, 0))); K.box('head', 'gold', [p[0], p[1] + r * 0.28, p[2]], [r * 1.9, 0.025, 0.04], Q(0, a, 0).multiply(Q(-0.35, 0, 0))); }
    K.ell('head', 'bone', [c.x, ty + r * 0.35, c.z + r * 0.95], [r * 0.16, r * 0.17, r * 0.06]); K.ell('head', 'socket', [c.x - r * 0.06, ty + r * 0.38, c.z + r * 0.99], [r * 0.04, r * 0.04, r * 0.02]); K.ell('head', 'socket', [c.x + r * 0.06, ty + r * 0.38, c.z + r * 0.99], [r * 0.04, r * 0.04, r * 0.02]);
    K.horn('head', 'feather', [c.x - r * 0.6, ty + r * 0.5, c.z - r * 0.4], [-0.5, 1, -0.6], r * 1.4, r * 0.12, 4, [0, -0.15, -0.1]);
    seaweed(K, L, 'head', [c.x + r * 0.5, ty + r * 0.1, c.z - r * 0.6], 3, 0.3); barnacles(K, 'head', [c.x - r * 0.7, ty + r * 0.4, c.z + r * 0.3], 5, 0.05);
    // epaulettes with gold fringe, lapels, a heavy belt
    for (const S of ['L', 'R']) { const s = L.sh[S], sx = S === 'L' ? 1 : -1; K.ell('arm' + S, 'gold', [s.x + sx * 0.03, s.y + 0.06, s.z], [0.13, 0.04, 0.12]); for (let k = 0; k < 7; k++) K.rod('arm' + S, 'gold', [s.x + sx * 0.03 + Math.cos(k / 7 * Math.PI * 2) * 0.11, s.y + 0.04, s.z + Math.sin(k / 7 * Math.PI * 2) * 0.1], [s.x + sx * 0.05 + Math.cos(k / 7 * Math.PI * 2) * 0.13, s.y - 0.06, s.z + Math.sin(k / 7 * Math.PI * 2) * 0.12], 0.01, 0.008); }
    for (const sx of [-1, 1]) K.box('upper', 'gold', [sx * L.chestW * 0.3, L.chestTop - 0.2, L.chestFront + 0.01], [0.04, 0.4, 0.02], Q(0, 0, sx * 0.25));
    K.box('upper', 'leather', [0, L.waist + 0.05, L.chestZ], [L.chestW * 2.1, 0.09, L.chestD * 2.15]); K.box('upper', 'gold', [0, L.waist + 0.05, L.chestFront + 0.02], [0.12, 0.1, 0.03]);
    // long coat tails
    const y0 = L.waist + 0.02, y1 = L.foot + 0.25, w = L.chestW * 1.05, z0 = L.chestBack - 0.02;
    K.panel('cape', 'coat', [[-w, y0, z0], [w, y0, z0], [-w * 1.3, y1, z0 - 0.12], [w * 1.3, y1, z0 - 0.12], [0, y1 + 0.05, z0 - 0.1]], [0, 1, 4, 0, 4, 2, 1, 3, 4]);
    ribcage(K, L, 'oldbone', false); },
  hag(K, L) {
    hood(K, L, 'hood', true); cloakBack(K, L, 'cape', (L.chestTop - L.foot) * 0.95);
    const c = L.headC, r = L.headR; K.cone('head', 'rot', [c.x, c.y - r * 0.05, L.headFront - 0.02], [0, -0.35, 1], r * 0.13, r * 0.6); // the crooked nose
    for (const sx of [-1, 1]) K.ell('head', 'glowGreen', [c.x + sx * r * 0.36, c.y + r * 0.12, L.headFront + 0.01], [r * 0.1, r * 0.08, r * 0.05]);
    for (let k = 0; k < 8; k++) K.rod('head', 'hair', [c.x + (k - 3.5) * r * 0.2, c.y + r * 0.4, c.z + r * 0.4], [c.x + (k - 3.5) * r * 0.28, c.y - r * 1.4 - (k % 3) * r * 0.3, c.z + r * 0.5], 0.012, 0.005);
    // charms on the belt: little bones and a skull
    for (let k = 0; k < 5; k++) { const a = -0.8 + k * 0.4; K.rod('hips', 'bone', [Math.sin(a) * L.chestW, L.hips.y + 0.02, Math.cos(a) * L.chestD + L.chestZ], [Math.sin(a) * L.chestW * 1.05, L.hips.y - 0.15, Math.cos(a) * L.chestD * 1.1 + L.chestZ], 0.012, 0.01); }
    K.ell('hips', 'bone', [L.chestW * 0.8, L.hips.y - 0.18, L.chestZ + L.chestD * 0.5], [0.05, 0.055, 0.05]);
    // the staff: a gnarled branch with a green-glowing orb caged in roots at the top
    const h = L.hand.L; const top = [h.x + 0.05, h.y + L.armLen * 1.2, h.z + 0.12], bot = [h.x - 0.02, L.foot + 0.02, h.z + 0.02];
    K.rod('handL', 'wood', bot, [h.x, h.y, h.z + 0.04], 0.025, 0.03); K.rod('handL', 'wood', [h.x, h.y, h.z + 0.04], top, 0.03, 0.035);
    for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2; K.rod('handL', 'wood', top, [top[0] + Math.cos(a) * 0.09, top[1] + 0.2, top[2] + Math.sin(a) * 0.09], 0.02, 0.008); }
    K.ell('handL', 'glowGreen', [top[0], top[1] + 0.12, top[2]], [0.075, 0.075, 0.075]); K.ell('handL', 'bone', [top[0], top[1] - 0.06, top[2] + 0.04], [0.045, 0.05, 0.045]);
    K.orb = ['handL', [top[0], top[1] + 0.12, top[2]]]; },
  warden(K, L) {
    const c = L.headC, r = L.headR;
    helm(K, L, 'iron', 'glowRed', 0, false);
    for (const sx of [-1, 1]) K.horn('head', 'char', [c.x + sx * r * 0.85, c.y + r * 0.45, c.z - r * 0.1], [sx, 0.35, -0.2], r * 3.2, r * 0.32, 8, [sx * -0.06, 0.12, 0.05]);
    for (let k = 0; k < 5; k++) K.cone('head', 'iron', [c.x + (k - 2) * r * 0.3, c.y + r * 0.95 - Math.abs(k - 2) * r * 0.1, c.z - r * 0.1], [(k - 2) * 0.15, 1, 0], r * 0.09, r * (0.6 - Math.abs(k - 2) * 0.12)); // crown of spikes
    pauldrons(K, L, 'iron', 3, 1.5);
    K.ell('upper', 'iron', [0, L.chestTop - 0.2, L.chestFront - 0.06], [L.chestW * 1.08, 0.3, 0.16]); // the breastplate
    K.ring('upper', 'gold', [0, L.chestTop - 0.24, L.chestFront + 0.06], 0.11, 0.02, Math.PI * 2, Q(0, 0, 0));
    K.ell('upper', 'core', [0, L.chestTop - 0.24, L.chestFront + 0.06], [0.085, 0.085, 0.06]); K.core = ['upper', [0, L.chestTop - 0.24, L.chestFront + 0.08]];
    crystals(K, 'upper', [0, L.chestTop - 0.08, L.chestBack - 0.03], 7, 0.5); cracks(K, L, 'glowRed', 'arms,chest');
    for (const S of ['L', 'R']) { const s = L.sh[S], h = L.hand[S]; const fa = s.clone().lerp(h, 0.72); K.put('arm' + S, 'iron', G_.cyl(), _m.compose(fa, Q(0, 0, 0), new V3(0.075, L.armLen * 0.3, 0.075))); }
    for (let k = 0; k < 3; k++) K.ell('hips', 'bone', [(k - 1) * 0.15, L.hips.y + 0.02, L.chestFront - 0.02], [0.045, 0.05, 0.045]); // skulls on the belt
    cloakBack(K, L, 'cape', (L.chestTop - L.foot) * 0.9); },
  imp(K, L) {
    // leathery bat wings on the back, a long tail ending in a spade, glowing eyes
    const z = L.chestBack - 0.02, y = L.chestTop - 0.08;
    for (const sx of [-1, 1]) { const p = (x, yy, zz) => [sx * x, yy, zz]; K.panel(sx > 0 ? 'wingL' : 'wingR', 'wing', [p(0.05, y, z), p(0.55, y + 0.35, z - 0.15), p(0.85, y + 0.1, z - 0.25), p(0.7, y - 0.3, z - 0.2), p(0.45, y - 0.4, z - 0.15), p(0.15, y - 0.3, z - 0.05)], [0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5]);
      K.rod(sx > 0 ? 'wingL' : 'wingR', 'char', p(0.05, y, z), p(0.55, y + 0.35, z - 0.15), 0.018, 0.012); K.rod(sx > 0 ? 'wingL' : 'wingR', 'char', p(0.55, y + 0.35, z - 0.15), p(0.85, y + 0.1, z - 0.25), 0.012, 0.006); }
    K.horn('tail', 'wing', [0, L.hips.y + 0.05, L.chestBack], [0, -0.4, -1], 0.7, 0.03, 6, [0, 0.12, 0.02]);
    for (const sx of [-1, 1]) K.ell('head', 'glowAmber', [L.headC.x + sx * 0.075, L.headC.y + 0.03, L.headFront + 0.005], [0.025, 0.018, 0.01]); },
};
BUILD.flaming_skeleton.hide = true; BUILD.skeleton.hide = true;

// ---------- putting it on ----------
export function dressHumanoid(model, look) {
  const fn = BUILD[look]; if (!fn || !model || !model.parts) return null;
  const P = model.parts, body = model.body;
  const L = measure(model); const K = new Kit(); fn(K, L);
  // bare skeletons: the human body underneath is hidden (the bones take its place)
  if (fn.hide) model.root.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) { o.visible = false; o.userData.hiddenByAcc = true; } });
  if (look === 'lost' || look === 'lostArcher' || fn.hide || look === 'hag' || look === 'warden' || look === 'corrupted' || look === 'brute' || look === 'corruptArcher' || look === 'grimsby') { if (P.hair) P.hair.visible = false; }
  const acc = { look, mats: {}, groups: [], t: Math.random() * 10 };
  const partFor = (name) => name === 'cape' || name === 'wingL' || name === 'wingR' ? P.upper : name === 'tail' ? (P.hips || P.upper) : (P[name] || P.upper);
  const pivots = {};
  const pivotFor = (name) => {
    if (pivots[name]) return pivots[name];
    const part = partFor(name); const rel = relMatrix(body, part); const g = new THREE.Group(); g.userData.acc = true;
    // place the group so body-space geometry lands where it was measured, whatever the part's frame
    rel.invert().decompose(g.position, g.quaternion, g.scale);
    let holder = g;
    if (name === 'cape' || name === 'wingL' || name === 'wingR' || name === 'tail') { // a hinge for things that swing
      const hinge = new THREE.Group(); hinge.userData.acc = true; const at = name === 'tail' ? new V3(0, L.hips.y + 0.05, L.chestBack) : name === 'cape' ? new V3(0, L.chestTop, L.chestBack) : new V3(name === 'wingL' ? 0.05 : -0.05, L.chestTop - 0.08, L.chestBack);
      hinge.position.copy(at); const inner = new THREE.Group(); inner.position.copy(at).multiplyScalar(-1); hinge.add(inner); g.add(hinge); holder = inner; acc[name] = hinge;
    }
    part.add(g); acc.groups.push(g); return (pivots[name] = holder);
  };
  for (const [k, list] of K.b) {
    const [name, mk] = k.split('|');
    const gk = look + '|' + k + '|' + [L.headR, L.chestW, L.chestTop, L.foot, L.armLen].map((v) => v.toFixed(3)).join(',');
    let geo = geoCache.get(gk); if (!geo) { geo = mergeList(list); geoCache.set(gk, geo); }
    if (!acc.mats[mk]) { acc.mats[mk] = material(mk); model.mats.push(acc.mats[mk]); }
    const mesh = new THREE.Mesh(geo, acc.mats[mk]); mesh.castShadow = !/glow|core|socket/.test(mk); mesh.userData.acc = true; mesh.frustumCulled = false;
    pivotFor(name).add(mesh);
  }
  if (K.flames) for (const [name, spots] of K.flames) pivotFor(name).add(makeFlames(spots));
  if (K.core) acc.coreMat = acc.mats.core;
  model.acc = acc;
  return acc;
}
export function updateAccessories(model, t, st = {}) {
  const a = model.acc; if (!a) return;
  uTime.value = t;
  const mv = st.move || 0;
  if (a.cape) { a.cape.rotation.x = -0.12 - mv * 0.35 - Math.sin(t * 2.3 + a.t) * 0.05 * (1 - mv * 0.5) - Math.sin(t * 9) * 0.04 * mv; }
  if (a.wingL) { const f = Math.sin(t * 7 + a.t); a.wingL.rotation.y = -0.4 + f * 0.6; a.wingR.rotation.y = 0.4 - f * 0.6; }
  if (a.tail) { a.tail.rotation.y = Math.sin(t * 2.5 + a.t) * 0.4; a.tail.rotation.x = Math.sin(t * 1.7) * 0.15; }
  if (a.coreMat) { const k = 2.2 + Math.sin(t * 4) * 1.0 + (st.wind || 0) * 4; a.coreMat.emissiveIntensity = k; }
  if (a.mats.glowGreen && a.look === 'hag') a.mats.glowGreen.emissiveIntensity = 1.6 + Math.sin(t * 3) * 0.5 + (st.wind || 0) * 3;
  if (st.dead && a.mats.glowRed) a.mats.glowRed.emissiveIntensity = Math.max(0, 2.2 - (st.deadT || 0) * 1.5);
}
