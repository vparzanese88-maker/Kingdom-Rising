// Kingdom Rising 3D — ships for the harbours, built like real ones: a lofted clinker hull of overlapping
// planks (tarred below the waterline), keel, stem and stern posts, ribs and thwarts inside, a planked deck,
// masts, yards and a striped square sail bellied by the wind, standing rigging, and for each kind its own
// gear: the rowboat's oars, the longship's dragon prow, shield row and oars, the cog's timber castles and
// stern rudder, the carrack's two masts and high sterncastle.
// Local frame: bow toward +z, the waterline at y = 0.
import { THREE, K3 } from './core.js';
import { MB, PRIM } from './mb.js';

// L length, B beam, D keel depth below the waterline, G gunwale height at midships, sheer rise at the ends,
// shape: 'double' (pointed at both ends, Norse) or 'cog' (bluff, straight posts); p: fullness of the section
const SIZES = {
  rowboat: { L: 4.4, B: 1.45, D: 0.32, G: 0.45, sheer: 0.28, shape: 'double', p: 0.55, strakes: 5, masts: [] },
  sloop: { L: 15, B: 3.4, D: 0.7, G: 0.95, sheer: 0.7, shape: 'double', p: 0.6, strakes: 8, longship: true, masts: [{ z: 0.4, h: 10.5, sail: [6.8, 5.6] }] },
  cog: { L: 14, B: 5, D: 1.2, G: 1.55, sheer: 0.55, shape: 'cog', p: 0.38, strakes: 9, castles: { fore: 3.68, aft: 3.13 }, masts: [{ z: 0.3, h: 13, sail: [6.4, 6.0] }] },
  galleon: { L: 22, B: 6.6, D: 1.7, G: 2.1, sheer: 0.9, shape: 'cog', p: 0.38, strakes: 11, castles: { fore: 4.6, aft: 4.9, aft2: 6.9 }, masts: [{ z: 2.2, h: 19, sail: [8.6, 7.4], top: [5.6, 3.6] }, { z: -5.4, h: 13, sail: [5.4, 4.4] }], bowsprit: true },
};
const PAL = [['#a8261e', '#ece2c8'], ['#1e3a6a', '#ece2c8'], ['#2e5a3a', '#e8dcc0'], ['#7a1e1e', '#d8b048'], ['#3a2a4a', '#e8dcc0'], ['#8a5a1e', '#ece2c8']];
const WOOD = ['#5a3c24', '#634428', '#4e3620', '#6a4a2c'];
const _c = new THREE.Color();
// a ship matches the kingdom whose harbour she belongs to: Valenmoor's are dark oak carracks in the Crown's blue and
// gold with heraldic sails; Aelindor's are pale, sweeping elven ships with a swan's neck at the prow, a curling tail,
// gilded rails and a crescent sail (the kingdom's own banner and trim colours, so a new kingdom brings its own)
function styleOf(f) {
  const F = f && window.KR && KR.D && KR.D.FACTIONS[f]; if (!F) return null;
  const elven = f === 'sylvan' || F.shipStyle === 'elven';
  return elven ? { elven: true, wood: '#c9b994', band: F.banner, cloth: '#f6f1e0', trim: F.trim || '#e7d48a' } : { wood: '#4a3220', band: F.banner, cloth: '#efe6cc', trim: F.trim || '#d8b048' };
}
// an elven hull: long, narrow, rising in a sweep to both ends
const elvenize = (S) => Object.assign({}, S, { B: S.B * 0.82, L: S.L * 1.08, sheer: S.sheer * 2.4 + 0.6, shape: 'double', p: 0.5, castles: null, elven: true, bowsprit: false });

// ---- the hull ----
function halfBeam(S, t) {
  if (S.shape === 'double') return Math.pow(Math.sin(Math.PI * t), 0.72);
  const u = 0.05 + t * 0.9; return Math.pow(Math.sin(Math.PI * u), 0.42) * (t < 0.5 ? 0.86 + 0.14 * Math.min(1, t / 0.25) : 1);
}
function stations(S, t) {
  const e = 2 * t - 1, w = (S.B / 2) * halfBeam(S, t);
  const gun = S.G + S.sheer * e * e + (S.shape === 'double' ? S.sheer * 0.8 * Math.pow(Math.abs(e), 6) : 0);
  const keel = -S.D * (1 - Math.pow(Math.abs(e), S.shape === 'double' ? 5 : 9));
  return { z: e * S.L / 2, w, gun, keel };
}
// clinker planking: each strake is its own band, its lower edge standing proud of the one below
function hullGeom(S, wood, band, inner) {
  const NS = 36, NA = 2, pos = [], col = [], idx = []; const ns = S.strakes;
  for (const side of [-1, 1]) for (let s = 0; s < ns; s++) {
    const base = pos.length / 3;
    const shade = 1 + ((s * 37) % 5 - 2) * 0.035;
    for (let i = 0; i <= NS; i++) {
      const t = i / NS, st = stations(S, t);
      for (let j = 0; j <= NA; j++) {
        const f = j / NA, a = ((s + f) / ns) * Math.PI / 2;
        const lap = inner ? 0.97 : 1 + 0.045 * (1 - f) * Math.min(1, st.w / 0.4);
        const x = side * st.w * Math.pow(Math.sin(a), S.p) * lap, y = st.keel + (st.gun - st.keel) * (1 - Math.cos(a));
        pos.push(x, y, st.z);
        let c = y < 0.04 && !inner ? '#2a2119' : s === ns - 1 && !inner ? band : wood;
        _c.set(c).multiplyScalar(inner ? 0.62 : shade); col.push(_c.r, _c.g, _c.b);
      }
    }
    for (let i = 0; i < NS; i++) for (let j = 0; j < NA; j++) {
      const a = base + i * (NA + 1) + j, b = a + NA + 1;
      if ((side > 0) !== !!inner) idx.push(a, b, a + 1, b, b + 1, a + 1); else idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// a bluff-ended hull (the cog and the galleon) is open at the bow and the stern: close each end with a
// planked board following the hull's cross-section from the keel up to the gunwale
function endCapGeom(S, t, wood) {
  const st = stations(S, t), N = 10, pos = [], col = [], idx = [];
  const cy = (st.keel + st.gun) / 2; pos.push(0, cy, st.z); _c.set(wood).multiplyScalar(0.9); col.push(_c.r, _c.g, _c.b);
  for (const side of [-1, 1]) for (let i = 0; i <= N; i++) {
    const a = ((side < 0 ? N - i : i) / N) * Math.PI / 2;
    const x = side * st.w * Math.pow(Math.sin(a), S.p) * 1.03, y = st.keel + (st.gun - st.keel) * (1 - Math.cos(a));
    pos.push(x, y, st.z); _c.set(y < 0.04 ? '#2a2119' : wood).multiplyScalar(0.9); col.push(_c.r, _c.g, _c.b);
  }
  const n = pos.length / 3 - 1;
  for (let i = 1; i < n; i++) idx.push(0, i, i + 1, 0, i + 1, i); // both faces: it is seen from outside and in
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// a planked floor following the hull at height y (relative to the gunwale) between t0..t1
function deckGeom(S, drop, t0 = 0.04, t1 = 0.96) {
  const NS = 30, pos = [], idx = [], uv = [];
  for (let i = 0; i <= NS; i++) { const t = t0 + (t1 - t0) * (i / NS), st = stations(S, t); const y = S.G + (st.gun - S.G) * 0.35 - drop; const a = Math.acos(Math.max(-1, 1 - (y - st.keel) / Math.max(0.01, st.gun - st.keel))); const b = Math.max(0.02, st.w * Math.pow(Math.sin(Math.min(Math.PI / 2, a)), S.p) * 0.97); pos.push(-b, y, st.z, b, y, st.z); uv.push(-b, st.z, b, st.z); }
  for (let i = 0; i < NS; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// the hull's half-width at height y at a station (where that height meets the planking)
function widthAt(S, st, y) { const a = Math.acos(Math.max(-1, Math.min(1, 1 - (y - st.keel) / Math.max(0.01, st.gun - st.keel)))); return st.w * Math.pow(Math.sin(Math.min(Math.PI / 2, a)), S.p); }
// a solid floor right across the hull at height y, from end to end: the hold's bottom boards at the waterline, so
// looking into the boat you see planks, never the sea inside her
function floorGeom(S, y, t0 = 0, t1 = 1) {
  const NS = 40, pos = [], idx = [], uv = [];
  for (let i = 0; i <= NS; i++) { const t = t0 + (t1 - t0) * (i / NS), st = stations(S, t); const b = y <= st.keel ? 0.01 : Math.max(0.01, widthAt(S, st, y) * 0.995); pos.push(-b, y, st.z, b, y, st.z); uv.push(-b, st.z, b, st.z); }
  for (let i = 0; i < NS; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// a curved bulwark: a planked strip following the hull's flare from y0 up to y1 between t0..t1 (both faces)
function bulwarkGeom(S, t0, t1, y0f, y1f, flare, wood, band) {
  const NS = 16, NV = 4, pos = [], col = [], idx = [];
  for (const side of [-1, 1]) {
    const base = pos.length / 3;
    for (let i = 0; i <= NS; i++) { const t = t0 + (t1 - t0) * (i / NS), st = stations(S, t); const y0 = y0f(st), y1 = y1f(st);
      for (let j = 0; j <= NV; j++) { const v = j / NV, y = y0 + (y1 - y0) * v; const x = side * (st.w * 1.0 + flare * v * v); pos.push(x, y, st.z); _c.set(j === NV - 1 ? band : wood).multiplyScalar(1 + (((i * 7 + j * 3) % 5) - 2) * 0.03); col.push(_c.r, _c.g, _c.b); } }
    for (let i = 0; i < NS; i++) for (let j = 0; j < NV; j++) { const a = base + i * (NV + 1) + j, b = a + NV + 1; idx.push(a, b, a + 1, b, b + 1, a + 1, a, a + 1, b, b, a + 1, b + 1); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// a square sail in vertical cloths, bellied forward; the stripes alternate two colours
function sailGeom(w, h, belly, cols, stripes = 8, crescent = 0) {
  const NX = stripes * 2, NY = 10, pos = [], col = [], idx = [];
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
    const u = i / NX, v = j / NY; const x = (u - 0.5) * w * (1 + v * 0.06), y = -v * h * (1 - crescent * Math.sin(Math.PI * u) * v), z = belly * Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(1, 0.15 + v * 0.95));
    pos.push(x, y, z);
  }
  // duplicate per cloth so the stripes are crisp
  const P = [], C = [];
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const a = j * (NX + 1) + i, b = a + NX + 1; const c = cols[Math.floor(i / 2) % cols.length]; _c.set(c);
    for (const k of [a, b, a + 1, b, b + 1, a + 1]) { P.push(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]); C.push(_c.r, _c.g, _c.b); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.computeVertexNormals();
  return g;
}
const tube = (pts, r, seg = 16) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), seg, r, 6);

const cache = new Map();
let hullDS = null;
const hullMat = (m) => { if (!hullDS) { hullDS = m.clone(); hullDS.side = THREE.DoubleSide; hullDS.name = 'hull'; } return hullDS; };
const lineMat = new THREE.LineBasicMaterial({ color: 0x241a12 });
// opts.warship (naval3d.js): no oars in the merged hull (the warship rows its own) and every sail its own object, so it
// can fill with the wind (tagged userData.sail; its yard at the object's origin)
export function buildShip(size, v = 0, opts = {}) {
  const sty = styleOf(opts.style); let S = SIZES[size] || SIZES.sloop; if (sty && sty.elven && size !== 'rowboat') S = elvenize(S);
  const variant = Math.floor(v * 6) % 6; const key = size + ':' + variant + (opts.warship ? ':w' : '') + ':' + (opts.style || '');
  const sailObjs = [];
  const addSail = (geom, x, y, z, extra) => { if (!opts.warship) { mb.add('cloth2', geom, M(x, y, z), null, 'world'); if (extra) extra((ex, ey, ez, ...r) => M(ex, ey, ez, ...r), mb); return; } const sm = new MB(); sm.add('cloth2', geom, M(0, 0, 0), null, 'world'); if (extra) extra((ex, ey, ez, ...r) => M(ex - x, ey - y, ez - z, ...r), sm); const o = sm.build(); o.position.set(x, y, z); o.userData.sail = true; sailObjs.push(o); };
  let c = cache.get(key); if (c) return c.clone();
  const r = K3.rng(variant * 977 + size.length);
  const mb = new MB(); const M = (x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0) => MB.mat(x, y, z, sx, sy, sz, ry, rx, rz);
  const wood = sty ? sty.wood : WOOD[variant % 4], [band, cloth] = sty ? [sty.band, sty.cloth] : PAL[variant], dark = sty && sty.elven ? '#6a5236' : '#3a2618', gold = sty ? sty.trim : '#c8a040';
  // hull, outside and in
  mb.add('hull', hullGeom(S, wood, band, false), M(0, 0, 0), null, 'world');
  mb.add('hull', hullGeom(S, wood, band, true), M(0, 0, 0), null, 'world');
  if (S.shape === 'cog') for (const t of [0, 1]) mb.add('hull', endCapGeom(S, t, wood), M(0, 0, 0), null, 'world');
  // keel and the two posts
  const bowT = stations(S, 1), sternT = stations(S, 0);
  mb.add('haft', tube([[0, -S.D - 0.05, -S.L * 0.42], [0, -S.D - 0.08, 0], [0, -S.D - 0.05, S.L * 0.42]], 0.1, 8), M(0, 0, 0), dark);
  // gunwale rails along the top strake
  for (const side of [-1, 1]) { const pts = []; for (let i = 1; i < 24; i++) { const st = stations(S, i / 24); pts.push([side * st.w * 1.02, st.gun + 0.03, st.z]); } mb.add('haft', tube(pts, 0.06, 40), M(0, 0, 0), dark); }
  // ribs inside and thwarts across
  for (let i = 3; i < 22; i += 2) { const t = i / 24, st = stations(S, t); const pts = []; for (let a = 0; a <= 6; a++) { const aa = (a / 6) * Math.PI / 2; for (const side of [1]) pts.push([side * st.w * Math.pow(Math.sin(aa), S.p) * 0.95, st.keel + (st.gun - st.keel) * (1 - Math.cos(aa)), st.z]); } const half = pts.slice().reverse().map((p) => [-p[0], p[1], p[2]]); mb.add('haft', tube(half.concat(pts.slice(1)), 0.045, 20), M(0, 0, 0), '#5a3c24'); }
  // decks
  const deckDrop = S.castles ? 0.12 : S.longship ? 0.55 : 0.32;
  mb.add('planks', deckGeom(S, deckDrop, 0.01, 0.99), M(0, 0, 0), '#a07a4e', 'local', 1.2);
  mb.add('planks', floorGeom(S, 0.07), M(0, 0, 0), '#5e4228', 'local', 1.2); // the hold's floor at the waterline: no sea inside her
  if (size === 'rowboat') {
    for (const z of [-0.9, 0.1, 1.0]) { const st = stations(S, z / S.L + 0.5); mb.add('haft', PRIM.box, M(0, S.G - 0.12, z, st.w * 1.85, 0.05, 0.26), '#8a6440'); }
    for (const side of [-1, 1]) { mb.add('haft', tube([[side * 0.6, S.G + 0.05, 0.1], [side * 1.6, 0.0, -0.4], [side * 2.5, -0.15, -0.8]], 0.03, 6), M(0, 0, 0), '#8a6440'); mb.add('haft', PRIM.box, M(side * 2.45, -0.12, -0.78, 0.36, 0.03, 0.14, side * 0.5), '#8a6440'); }
    mb.add('haft', PRIM.box, M(0, S.G + 0.05, -1.6, 0.06, 0.3, 0.4), dark);
  }
  if (S.longship && !S.elven) {
    // the dragon prow and a curling tail at the stern
    const bz = bowT.z, sz = sternT.z, gy = bowT.gun;
    mb.add('haft', tube([[0, -S.D * 0.5, bz - 0.9], [0, gy * 0.4, bz + 0.15], [0, gy + 0.6, bz + 0.45], [0, gy + 1.5, bz + 0.5], [0, gy + 2.1, bz + 0.25]], 0.13, 20), M(0, 0, 0), dark);
    mb.add('haft', PRIM.sph12, M(0, gy + 2.18, bz + 0.45, 0.32, 0.3, 0.62, 0, 0.25), dark);
    mb.add('haft', PRIM.cone8, M(0, gy + 2.08, bz + 0.92, 0.2, 0.5, 0.2, 0, Math.PI / 2 + 0.3), dark);
    for (const sx of [-1, 1]) { mb.add('haft', PRIM.cone8, M(sx * 0.12, gy + 2.5, bz + 0.25, 0.08, 0.42, 0.08, 0, -0.6, sx * 0.3), dark); mb.add('glow', PRIM.sph8, M(sx * 0.15, gy + 2.26, bz + 0.62, 0.05, 0.05, 0.05), '#ff9a3a'); }
    mb.add('haft', tube([[0, -S.D * 0.5, sz + 0.9], [0, gy * 0.4, sz - 0.15], [0, gy + 0.6, sz - 0.45], [0, gy + 1.3, sz - 0.4], [0, gy + 1.5, sz + 0.05], [0, gy + 1.25, sz + 0.25]], 0.12, 20), M(0, 0, 0), dark);
    // shields along the rail and oars out
    const SH = [band, cloth, '#c8a040', '#2a2a2a'];
    for (const side of [-1, 1]) for (let i = 0; i < 13; i++) { const t = 0.2 + i * 0.047, st = stations(S, t); const ry = Math.atan2(stations(S, t + 0.01).w - st.w, 0.15) * side;
      mb.add('paint', PRIM.cyl16, M(side * (st.w + 0.08), st.gun - 0.08, st.z, 0.82, 0.05, 0.82, 0, 0, Math.PI / 2), SH[(i + (side > 0 ? 0 : 1)) % 3]);
      mb.add('metal', PRIM.sph8, M(side * (st.w + 0.12), st.gun - 0.08, st.z, 0.14, 0.14, 0.1), '#8a8a90');
      if (i % 2 === 0 && !opts.warship) mb.add('haft', tube([[side * (st.w - 0.4), st.gun - 0.3, st.z], [side * (st.w + 1.6), 0.3, st.z - 0.5], [side * (st.w + 3.2), -0.12, st.z - 0.9]], 0.045, 4), M(0, 0, 0), '#8a6440'); }
    // a few chests for rowing benches
    for (let i = 0; i < 6; i++) { const z = -4.5 + i * 1.8; mb.add('planks', PRIM.box, M(0, S.G - deckDrop + 0.22, z, 0.5, 0.4, 0.55), '#7a5634', 'local'); }
  }
  if (S.castles) {
    const C = S.castles; const castle = (t0, t1, top, rails, roof) => {
      const z0 = stations(S, t0).z, z1 = stations(S, t1).z, n = 10; const w0 = (t) => stations(S, t).w * 0.98;
      // the platform
      const fl = deckGeom(Object.assign({}, S, { G: top, sheer: 0 }), 0, t0, t1); mb.add('planks', fl, M(0, 0, 0), '#9a7448', 'local', 1.2);
      // the sides: curved planking carried up from the hull to the platform and on as a bulwark, flaring out a little
      mb.add('hull', bulwarkGeom(S, t0, t1, (st) => st.gun - 0.05, () => top + (rails ? 0.75 : 0.05), 0.12, wood, band), M(0, 0, 0), null, 'world');
      if (rails) {
        // turned balusters under a moulded rail, a painted frieze of panels below, carved posts with finials at the corners
        const nb = Math.max(6, Math.round(Math.abs(z1 - z0) / 0.36));
        for (const side of [-1, 1]) for (let i = 0; i <= nb; i++) { const t = t0 + (t1 - t0) * (i / nb), st = stations(S, t), x = side * (st.w + 0.12);
          mb.add('haft', PRIM.cyl8, M(x, top + 0.98, st.z, 0.07, 0.36, 0.07), dark); mb.add('haft', PRIM.sph8, M(x, top + 0.98, st.z, 0.11, 0.08, 0.11), dark);
          if (i < nb) { const t2 = t0 + (t1 - t0) * ((i + 0.5) / nb), s2 = stations(S, t2); mb.add('paint', PRIM.box, M(side * (s2.w + 0.075), top + 0.36, s2.z, 0.03, 0.42, Math.abs(z1 - z0) / nb * 0.7), i % 2 ? band : K3.shade(cloth, -0.12)); } }
        for (const side of [-1, 1]) for (const t of [t0, t1]) { const st = stations(S, t); mb.add('haft', PRIM.cyl8, M(side * (st.w + 0.12), top + 0.7, st.z, 0.16, 1.4, 0.16), dark); mb.add('haft', PRIM.sph8, M(side * (st.w + 0.12), top + 1.48, st.z, 0.22, 0.26, 0.22), K3.shade(band, -0.2)); }
      }
      // the band of colour under the rail and the end board
      const zEnd = t0 < 0.5 ? z0 : z1, wEnd = w0(t0 < 0.5 ? t0 : t1);
      mb.add('hull', PRIM.box, M(0, (top + stations(S, t0 < 0.5 ? t0 : t1).gun) / 2 + 0.2, zEnd + (t0 < 0.5 ? -0.02 : 0.02), wEnd * 2, top - stations(S, t0 < 0.5 ? t0 : t1).gun + 0.6, 0.08), wood);
      if (rails) mb.add('paint', PRIM.box, M(0, top + 0.6, zEnd + (t0 < 0.5 ? -0.08 : 0.08), wEnd * 2, 0.16, 0.04), band);
      if (roof) { const zm = (z0 + z1) / 2; mb.add('planks', PRIM.box, M(0, top - 1.1, zm, w0((t0 + t1) / 2) * 1.8, 0.08, Math.abs(z1 - z0)), '#8a6a44', 'local'); }
    };
    castle(0.0, 0.26, C.aft, true); castle(0.76, 0.97, C.fore, true);
    if (C.aft2) { const t0 = 0.0, t1 = 0.12; const top = C.aft2; castle(t0, t1, top, true); }
    // the stern rudder and its tiller
    const st = stations(S, 0.02); mb.add('haft', PRIM.box, M(0, st.keel * 0.5 + st.gun * 0.4, st.z - 0.35, 0.14, (st.gun - st.keel) * 1.15, 0.9, 0, 0.12), dark);
    // stern lantern
    mb.add('metalv', PRIM.cyl8, M(0, C.aft + 1.4, stations(S, 0.01).z, 0.3, 0.45, 0.3), '#2e2e30'); mb.add('glow', PRIM.sph8, M(0, C.aft + 1.4, stations(S, 0.01).z, 0.2, 0.26, 0.2), '#ffcf80');
    // cargo amidships
    for (let k = 0; k < 5; k++) { const z = -S.L * 0.12 + k * S.L * 0.06, x = (r() - 0.5) * S.B * 0.35; if (k % 2) mb.add('planks', PRIM.cyl12, M(x, S.G + 0.35, z, 0.7, 0.8, 0.7), '#8a5e34', 'local'); else mb.add('planks', PRIM.box, M(x, S.G + 0.3, z, 0.8, 0.6, 0.8), '#9a7344', 'local'); }
    // the stem post rising at the bow
    const bz = bowT.z; mb.add('haft', tube([[0, -S.D * 0.6, bz - 0.6], [0, bowT.gun * 0.5, bz + 0.25], [0, C.fore + 0.9, bz + 0.55]], 0.14, 10), M(0, 0, 0), dark);
  }
  if (S.bowsprit) { const st = stations(S, 0.97); mb.add('haft', PRIM.cyl8, M(0, S.castles.fore + 0.2, st.z + 2.0, 0.2, 5.5, 0.2, 0, Math.PI / 2 - 0.35), dark); }
  // masts, yards, sails and the standing rigging
  const lines = []; const sailCols = S.longship ? [band, cloth] : variant % 2 ? [cloth, cloth] : [cloth, K3.shade(cloth, -0.06)];
  for (const m of S.masts) {
    const base = S.G - deckDrop, topY = base + m.h; const mr = 0.13 + m.h * 0.012;
    mb.add('haft', PRIM.cyl12, M(0, base + m.h / 2, m.z, mr * 2, m.h, mr * 2), '#5a3a20');
    const [sw, sh] = m.sail; const yy = topY - (m.top ? m.top[1] + 1.6 : 0.9);
    mb.add('haft', PRIM.cyl8, M(0, yy, m.z + 0.25, 0.12, sw + 1.0, 0.12, 0, 0, Math.PI / 2), '#5a3a20');
    const emblem = !S.longship && !m.top && (S.castles || S.elven);
    addSail(sailGeom(sw, sh, sw * 0.13, sailCols, S.longship ? 6 : 5, S.elven ? 0.22 : 0), 0, yy - 0.1, m.z + 0.36, emblem && opts.warship ? (MM, into) => { into.add('paint', PRIM.box, MM(0, yy - sh * 0.5, m.z + 0.36 + sw * 0.13 + 0.03, 0.5, sh * 0.7, 0.02), band); into.add('paint', PRIM.box, MM(0, yy - sh * 0.42, m.z + 0.36 + sw * 0.13 + 0.03, sw * 0.6, 0.5, 0.02), band); } : null);
    if (emblem && !opts.warship) { mb.add('paint', PRIM.box, M(0, yy - sh * 0.5, m.z + 0.36 + sw * 0.13 + 0.03, 0.5, sh * 0.7, 0.02), band); mb.add('paint', PRIM.box, M(0, yy - sh * 0.42, m.z + 0.36 + sw * 0.13 + 0.03, sw * 0.6, 0.5, 0.02), band); }
    if (m.top) { const ty = topY - 0.4; mb.add('haft', PRIM.cyl8, M(0, ty, m.z + 0.2, 0.09, m.top[0] + 0.6, 0.09, 0, 0, Math.PI / 2), '#5a3a20'); addSail(sailGeom(m.top[0], m.top[1], m.top[0] * 0.1, sailCols, 4), 0, ty - 0.1, m.z + 0.3); mb.add('planks', PRIM.cyl12, M(0, yy + 1.0, m.z, 1.3, 0.16, 1.3), '#5a3a20', 'local'); mb.add('hull', PRIM.cyl12, M(0, yy + 1.35, m.z, 1.4, 0.55, 1.4), wood); }
    mb.add('cloth2', PRIM.box, M(0, topY + 0.3, m.z - 1.0, 0.03, 0.32, 2.0), band);
    const bowZ = S.bowsprit ? bowT.z + 4.2 : bowT.z, bowY = S.bowsprit ? S.castles.fore + 1.4 : bowT.gun + (S.longship ? 1.2 : 0.4);
    lines.push(0, topY, m.z, 0, bowY, Math.min(bowZ, m.z + S.L * 0.65));
    lines.push(0, topY, m.z, 0, sternT.gun + 0.3, Math.max(sternT.z + 0.4, m.z - S.L * 0.5));
    for (const side of [-1, 1]) for (const dz of [-1.4, -0.7, 0, 0.7]) { const t = Math.min(0.97, Math.max(0.03, (m.z + dz) / S.L + 0.5)), st = stations(S, t); lines.push(0, topY - 0.6, m.z, side * st.w * 1.02, st.gun + 0.05, st.z); }
    // braces and sheets to the yard ends
    for (const side of [-1, 1]) { lines.push(side * (sw / 2 + 0.4), yy, m.z + 0.25, side * stations(S, 0.15).w, sternT.gun + 0.4, stations(S, 0.15).z); lines.push(side * sw / 2, yy - sh, m.z + 0.5, side * stations(S, Math.min(0.9, m.z / S.L + 0.72)).w, S.G + 0.1, m.z + S.L * 0.22); }
  }
  if (S.elven) {
    // the swan: a long white neck rising from the stem and arching forward, a gilded head and beak; at the stern a
    // tail of carved feathers curling up and back over the deck
    const bz = bowT.z, sz = sternT.z, gy = bowT.gun, ivory = '#efe8d6';
    mb.add('haft', tube([[0, -S.D * 0.5, bz - 1.0], [0, gy * 0.5, bz + 0.1], [0, gy + 0.9, bz + 0.5], [0, gy + 2.2, bz + 0.45], [0, gy + 3.0, bz + 0.05], [0, gy + 3.2, bz + 0.55]], 0.16, 32), M(0, 0, 0), ivory);
    mb.add('haft', PRIM.sph12, M(0, gy + 3.25, bz + 0.65, 0.34, 0.32, 0.5), ivory);
    mb.add('metal', PRIM.cone8, M(0, gy + 3.2, bz + 1.05, 0.14, 0.42, 0.12, 0, Math.PI / 2 + 0.15), gold);
    for (const sx of [-1, 1]) mb.add('glow', PRIM.sph8, M(sx * 0.15, gy + 3.33, bz + 0.78, 0.05, 0.05, 0.05), '#7ad8ff');
    for (let k = 0; k < 5; k++) { const a = -0.6 + k * 0.3; mb.add('haft', tube([[0, gy * 0.6, sz + 0.2], [Math.sin(a) * 0.4, gy + 1.0, sz - 0.1], [Math.sin(a) * 0.9, gy + 2.0 - Math.abs(a) * 0.6, sz + 0.25], [Math.sin(a) * 1.1, gy + 2.4 - Math.abs(a) * 0.8, sz + 0.85]], 0.07 - Math.abs(a) * 0.03, 16), M(0, 0, 0), k === 2 ? gold : ivory); }
    // a gilded rail along the whole gunwale on slender posts, leaf finials at every third post
    for (const side of [-1, 1]) { const pts = []; for (let i = 2; i <= 28; i++) { const t = i / 30, st = stations(S, t); pts.push([side * st.w * 1.0, st.gun + 0.7, st.z]); if (i % 2 === 0) { mb.add('haft', PRIM.cyl8, M(side * st.w, st.gun + 0.35, st.z, 0.05, 0.7, 0.05), dark); if (i % 6 === 0) mb.add('metal', PRIM.cone8, M(side * st.w, st.gun + 0.82, st.z, 0.1, 0.26, 0.1), gold); } } mb.add('metal', tube(pts, 0.04, 40), M(0, 0, 0), gold); }
    // a band of green and gold leaves painted along the sheer strake
    for (const side of [-1, 1]) for (let i = 3; i < 28; i++) { const t = i / 30, st = stations(S, t), y = st.gun - 0.32; mb.add('paint', PRIM.sph8, M(side * (widthAt(S, st, y) + 0.03), y, st.z, 0.03, 0.12, 0.34, 0, (i % 2 ? 0.5 : -0.5)), i % 3 ? band : gold); }
    // the deckhouse aft: curved walls, a roof like a furled leaf, round windows glowing, lanterns on swan-neck posts
    if (size !== 'rowboat') { const hz = stations(S, 0.24).z, hw = stations(S, 0.24).w * 0.62, hy = S.G - deckDrop;
      mb.add('hull', PRIM.cyl16, M(0, hy + 0.9, hz, hw * 2, 1.8, 3.2), K3.shade(wood, 0.08));
      mb.add('planks', PRIM.sph12, M(0, hy + 1.8, hz, hw * 2.3, 0.9, 3.7), K3.shade(band, -0.1), 'local');
      for (const sx of [-1, 1]) for (const dz of [-0.8, 0.8]) mb.add('glow', PRIM.cyl12, M(sx * hw, hy + 1.1, hz + dz, 0.04, 0.42, 0.42, 0, 0, Math.PI / 2), '#ffe2a0');
      for (const sx of [-1, 1]) { const st = stations(S, 0.08); mb.add('metal', tube([[sx * st.w * 0.8, st.gun, st.z], [sx * st.w * 0.85, st.gun + 1.5, st.z], [sx * st.w * 0.95, st.gun + 2.0, st.z - 0.4]], 0.04, 10), M(0, 0, 0), gold); mb.add('glow', PRIM.sph8, M(sx * st.w * 0.95, st.gun + 1.75, st.z - 0.45, 0.22, 0.3, 0.22), '#ffd890'); } }
  }
  // ---- the details that make her a ship and not a box ----
  const ROPE = '#3a2c1e', IRON = '#2c2c30';
  // the rigging as real rope (thin tubes with depth), and on each side of every mast a rope ladder (ratlines)
  for (let i = 0; i < lines.length; i += 6) mb.rod('haft', new THREE.Vector3(lines[i], lines[i + 1], lines[i + 2]), new THREE.Vector3(lines[i + 3], lines[i + 4], lines[i + 5]), size === 'galleon' ? 0.035 : 0.026, ROPE, 4);
  if (size !== 'rowboat') for (const m of S.masts) {
    const base = S.G - deckDrop, topY = base + m.h;
    for (const side of [-1, 1]) {
      const sh = [-1.4, -0.7, 0, 0.7].map((dz) => { const t = Math.min(0.97, Math.max(0.03, (m.z + dz) / S.L + 0.5)), st = stations(S, t); return [[side * st.w * 1.02, st.gun + 0.05, st.z], [0, topY - 0.6, m.z]]; });
      // deadeyes where the shrouds meet the rail
      for (const [a] of sh) mb.add('haft', PRIM.sph8, M(a[0], a[1] + 0.12, a[2], 0.13, 0.16, 0.13), '#2a1e14');
      // ratlines: rungs across the shrouds every 0.42 m, two-thirds of the way up
      for (let y = 0.6; y < (topY - 0.6 - S.G) * 0.66; y += 0.42) for (let k = 0; k < sh.length - 1; k++) {
        const P = (sv) => { const [a, b] = sv; const u = y / (b[1] - a[1]); return new THREE.Vector3(a[0] + (b[0] - a[0]) * u, a[1] + y, a[2] + (b[2] - a[2]) * u); };
        mb.rod('haft', P(sh[k]), P(sh[k + 1]), 0.012, ROPE, 3);
      }
    }
    // a round fighting top (crow's nest) high on the mast, with a lookout's rail
    if (S.castles && !m.top) { const ty = topY - 2.2; mb.add('planks', PRIM.cyl12, M(0, ty, m.z, 1.5, 0.14, 1.5), '#5a3e24', 'local'); mb.add('hull', PRIM.cyl12, M(0, ty + 0.42, m.z, 1.55, 0.7, 1.55), K3.shade(wood, 0.05));
      for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; mb.add('paint', PRIM.box, M(Math.cos(a) * 0.79, ty + 0.42, m.z + Math.sin(a) * 0.79, 0.04, 0.5, 0.3, -a), k % 2 ? band : cloth); } }
    // a long streaming pennant from the masthead, tapering to a point
    const pen = []; for (let k = 0; k <= 8; k++) { const u = k / 8; pen.push([Math.sin(u * 5) * 0.25 * u, topY + 0.25 - u * 0.5, m.z - 0.1 - u * 3.4]); }
    for (let k = 0; k < 8; k++) mb.add('cloth2', PRIM.box, M((pen[k][0] + pen[k + 1][0]) / 2, (pen[k][1] + pen[k + 1][1]) / 2, (pen[k][2] + pen[k + 1][2]) / 2, 0.02, 0.36 * (1 - k / 9), 0.44), k % 2 ? band : cloth);
    mb.add('haft', PRIM.sph8, M(0, topY + 0.12, m.z, 0.2, 0.2, 0.2), '#c8a040'); // the truck: a gilded cap on the masthead
  }
  if (S.castles || S.longship) {
    // wales: thick rubbing strakes running the length of the hull, following its sheer
    for (const side of [-1, 1]) for (const dy of S.castles ? [-0.35, -0.95] : [-0.3]) { const pts = []; for (let i = 1; i < 30; i++) { const t = i / 30, st = stations(S, t); const y = st.gun + dy; pts.push([side * (widthAt(S, st, y) + 0.06), y, st.z]); } mb.add('haft', tube(pts, 0.09, 48), M(0, 0, 0), dark); }
  }
  if (S.castles) {
    // the anchor, catted at the bow: shank, stock, two flukes and its ring, with the cable running in at the hawse
    const at = stations(S, 0.9), ax = at.w + 0.35, ay = at.gun - 0.4, az = at.z;
    mb.add('metalv', PRIM.cyl8, M(ax, ay - 0.9, az, 0.12, 1.9, 0.12), IRON);
    mb.add('haft', PRIM.box, M(ax, ay, az, 0.14, 0.14, 1.5), '#4a3420');
    mb.add('metalv', tube([[ax, ay - 1.85, az - 0.75], [ax, ay - 2.1, az], [ax, ay - 1.85, az + 0.75]], 0.07, 8), M(0, 0, 0), IRON);
    for (const sz of [-1, 1]) mb.add('metalv', PRIM.cone8, M(ax, ay - 1.62, az + sz * 0.82, 0.18, 0.42, 0.06, 0, sz * 0.6), IRON);
    mb.add('metalv', tube([[ax, ay + 0.15, az], [ax, ay + 0.35, az + 0.12], [ax, ay + 0.15, az + 0.24]], 0.04, 6), M(0, 0, 0), IRON);
    mb.rod('haft', new THREE.Vector3(ax, ay + 0.3, az), new THREE.Vector3(at.w * 0.6, at.gun - 0.1, az + 0.6), 0.05, ROPE, 4);
    // the rudder's iron pintles and the tiller through the stern
    const rs = stations(S, 0.02); for (const k of [0.15, 0.45, 0.75]) mb.add('metalv', PRIM.box, M(0, rs.keel + (rs.gun - rs.keel) * k, rs.z - 0.3, 0.2, 0.08, 0.95), IRON);
    // windows in the stern under the aftcastle, glowing faintly, with leaded frames
    const sz0 = stations(S, 0.0).z; for (const wx of [-0.9, 0, 0.9]) { mb.add('glow', PRIM.box, M(wx, S.castles.aft - 0.5, sz0 - 0.07, 0.42, 0.5, 0.03), '#ffcf80'); mb.add('haft', PRIM.box, M(wx, S.castles.aft - 0.5, sz0 - 0.09, 0.5, 0.06, 0.04), dark); mb.add('haft', PRIM.box, M(wx, S.castles.aft - 0.5, sz0 - 0.09, 0.06, 0.58, 0.04), dark); }
    // painted shields hung along the forecastle
    for (const side of [-1, 1]) for (let i = 0; i < 3; i++) { const t = 0.8 + i * 0.055, st = stations(S, t); mb.add('paint', PRIM.cyl16, M(side * (st.w + 0.16), S.castles.fore + 0.4, st.z, 0.6, 0.05, 0.6, 0, 0, Math.PI / 2), i % 2 ? band : cloth); mb.add('metal', PRIM.sph8, M(side * (st.w + 0.2), S.castles.fore + 0.4, st.z, 0.12, 0.12, 0.08), '#8a8a90'); }
    // the waist: a hatch with its grating, the capstan with its bars, coils of rope, a ship's bell on its frame
    const dy = S.G - deckDrop + 0.02, hz = S.L * 0.05;
    mb.add('haft', PRIM.box, M(0, dy + 0.12, hz, 1.4, 0.24, 1.6), '#5a3e24');
    for (let k = 0; k < 6; k++) { mb.add('haft', PRIM.box, M(-0.55 + k * 0.22, dy + 0.26, hz, 0.05, 0.05, 1.45), '#3e2a18'); mb.add('haft', PRIM.box, M(0, dy + 0.27, hz - 0.65 + k * 0.26, 1.25, 0.05, 0.05), '#3e2a18'); }
    const cz = -S.L * 0.2; mb.add('haft', PRIM.cyl12, M(0, dy + 0.5, cz, 0.55, 1.0, 0.55), '#6a4a2c'); mb.add('haft', PRIM.cyl12, M(0, dy + 1.02, cz, 0.75, 0.12, 0.75), '#4a3420');
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI; mb.add('haft', PRIM.box, M(0, dy + 0.85, cz, 2.2, 0.08, 0.08, a), '#7a5634'); }
    for (const [x, z] of [[-1.2, -S.L * 0.08], [1.15, S.L * 0.12]]) for (let k = 0; k < 3; k++) mb.add('haft', PRIM.cyl12, M(x, dy + 0.05 + k * 0.07, z, 0.7 - k * 0.14, 0.07, 0.7 - k * 0.14), ROPE);
    const bz2 = stations(S, 0.74).z; for (const sx of [-0.35, 0.35]) mb.add('haft', PRIM.box, M(sx, dy + 0.7, bz2, 0.1, 1.4, 0.1), dark); mb.add('haft', PRIM.box, M(0, dy + 1.38, bz2, 0.8, 0.1, 0.1), dark); mb.add('metal', PRIM.cone12, M(0, dy + 1.12, bz2, 0.3, 0.38, 0.3), '#b8902a');
    // barrels and crates lashed by the mast, under a rope net
    for (let k = 0; k < 4; k++) mb.add('planks', PRIM.cyl12, M(-0.9 + (k % 2) * 0.62, dy + 0.42, S.L * 0.2 + Math.floor(k / 2) * 0.62, 0.58, 0.84, 0.58), '#7a5230', 'local');
  }
  const g = mb.build(); for (const o of sailObjs) g.add(o);
  // the hull is seen from both sides: through the laps between its strakes you never look into the boat
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material && o.material.name === 'hull') o.material = hullMat(o.material); } });
  g.userData.ship = size; g.userData.draft = S.D;
  cache.set(key, g);
  return g.clone();
}
export const SHIP_SIZES = SIZES;
K3.buildShip = buildShip;
