// The map: rolling ground, chasms crossed by bridges, ridges the track tunnels through, the hive, the hub and scenery.
// Every game builds the same map from the same numbers, so heights match for the host and friends.
import * as THREE from 'three';
import * as M from './models.js';
import { MAPS, PATH_W, BOUNDS, TURRETS } from './data.js';

export class Path {
  constructor(pts, hs) {
    this.pts = pts.map(p => ({ x: p[0], z: p[1] })); this.hs = hs || pts.map(() => 0); this.cum = [0];
    for (let i = 1; i < this.pts.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(this.pts[i].x - this.pts[i - 1].x, this.pts[i].z - this.pts[i - 1].z));
    this.len = this.cum[this.cum.length - 1];
  }
  seg(s) { let i = 1; while (i < this.cum.length - 1 && this.cum[i] < s) i++; return i; }
  // point at distance s along the track, with its direction and height
  at(s) {
    s = Math.max(0, Math.min(this.len, s)); const i = this.seg(s);
    const a = this.pts[i - 1], b = this.pts[i], L = this.cum[i] - this.cum[i - 1], f = L ? (s - this.cum[i - 1]) / L : 0;
    return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, tx: (b.x - a.x) / (L || 1), tz: (b.z - a.z) / (L || 1), y: this.y(s) };
  }
  // height of the track: eased between the heights given at each bend
  y(s) {
    s = Math.max(0, Math.min(this.len, s)); const i = this.seg(s), L = this.cum[i] - this.cum[i - 1], f = L ? (s - this.cum[i - 1]) / L : 0, e = f * f * (3 - 2 * f);
    return this.hs[i - 1] + (this.hs[i] - this.hs[i - 1]) * e;
  }
  near(x, z) {
    let best = { d: 1e9, s: 0, tx: 1, tz: 0, x, z };
    for (let i = 1; i < this.pts.length; i++) {
      const a = this.pts[i - 1], b = this.pts[i], dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz, L = Math.sqrt(L2);
      const f = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L2)), px = a.x + dx * f, pz = a.z + dz * f, d = Math.hypot(x - px, z - pz);
      if (d < best.d) best = { d, s: this.cum[i - 1] + L * f, tx: dx / L, tz: dz / L, x: px, z: pz };
    }
    return best;
  }
}

export function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function lineDist(pts, x, z) { let best = 1e9; for (let i = 1; i < pts.length; i++) { const [ax, az] = pts[i - 1], [bx, bz] = pts[i], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz, f = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)); best = Math.min(best, Math.hypot(x - ax - dx * f, z - az - dz * f)); } return best; }
export const FLOOR = -8, LIQUID = -6.8, ROOF_GAP = 4.6;

// The shape of the land, for every game and the simulation.
export function makeTerrain(D, path, hubP, hiveP) {
  const T = {};
  const hills = (x, z) => 1.8 + 1.5 * Math.sin(x * 0.071 + 1.3) * Math.cos(z * 0.063 - 0.4) + 0.9 * Math.sin(x * 0.13 + z * 0.11) + 0.5 * Math.cos(x * 0.21 - z * 0.17);
  const ridge = (x, z) => { let r = 0; for (const q of D.ridges || []) { const u = lineDist(q.pts, x, z) / (q.w / 2); if (u < 1) r = Math.max(r, q.h * (Math.cos(u * Math.PI) + 1) / 2); } return r; };
  const chasm = (x, z) => { let k = 1; for (const q of D.chasms || []) k = Math.min(k, sstep(q.w / 2, q.w / 2 + 1.4, lineDist(q.pts, x, z))); return k; };
  T.hills = hills; T.ridge = ridge; T.chasm = chasm;
  const hubY = path.y(path.len), hiveY = path.y(0);
  // ground without bridges and tunnel roofs
  T.raw = (x, z) => {
    const out = Math.max(Math.abs(x), Math.abs(z)) - (BOUNDS - 2);
    let h = hills(x, z) + ridge(x, z) + (out > 0 ? out * 1.6 : 0);
    const n = path.near(x, z), py = path.y(n.s), R = ridge(n.x, n.z), bw = 7 - 5.6 * Math.min(1, R / 3);     // a narrow cut where the track goes under a ridge
    const f = sstep(PATH_W / 2 + 0.3, PATH_W / 2 + 0.3 + bw, n.d); h = py - 0.02 + (h - py + 0.02) * f;
    for (const [p, y] of [[hubP, hubY], [hiveP, hiveY]]) { const g = sstep(10, 16, Math.hypot(x - p.x, z - p.z)); h = y + (h - y) * g; }
    const k = chasm(x, z); h = FLOOR + (h - FLOOR) * k;
    return h;
  };
  // where the track is a bridge or a tunnel
  T.bridges = []; T.tunnels = [];
  let cur = null, curT = null;
  for (let s = 0; s <= path.len; s += 0.5) {
    const p = path.at(s), br = chasm(p.x, p.z) < 0.995, tu = ridge(p.x, p.z) > 2.2;
    if (br) { if (!cur) T.bridges.push(cur = { s0: s, s1: s }); cur.s1 = s; } else cur = null;
    if (tu) { if (!curT) T.tunnels.push(curT = { s0: s, s1: s }); curT.s1 = s; } else curT = null;
  }
  for (const b of T.bridges) { b.s0 -= 1.2; b.s1 += 1.2; }
  for (const t of T.tunnels) { let top = 0; for (let s = t.s0; s <= t.s1; s += 0.5) { const p = path.at(s); top = Math.max(top, hills(p.x, p.z) + ridge(p.x, p.z)); } t.bottom = Math.max(path.y(t.s0), path.y(t.s1)) + ROOF_GAP; t.top = Math.max(top, t.bottom + 2); }
  T.bridgeAt = s => T.bridges.find(b => s >= b.s0 && s <= b.s1);
  T.tunnelAt = (s, pad = 0) => T.tunnels.find(t => s >= t.s0 - pad && s <= t.s1 + pad);
  // walking height at (x, z) for something now at height y (so you can be on a bridge or under it, on a tunnel roof or inside)
  T.ground = (x, z, y = 1e9) => {
    const h = T.raw(x, z), n = path.near(x, z);
    if (n.d < PATH_W / 2 + 0.6) {
      const b = T.bridgeAt(n.s); if (b) { const deck = path.y(n.s); if (y >= deck - 1.3) return deck; }
      const t = T.tunnelAt(n.s); if (t && n.d < PATH_W / 2 + 1.6 && y >= t.top - 1.6) return t.top;
    }
    return h;
  };
  T.top = (x, z) => T.ground(x, z, 1e9);
  // is this point inside rock or a roof?
  T.solid = (x, y, z) => {
    const n = path.near(x, z);
    if (n.d < PATH_W / 2 + 1.6) { const t = T.tunnelAt(n.s); if (t && y > t.bottom && y < t.top) return true; }
    return y < T.ground(x, z, y);
  };
  T.ceiling = (x, z, y) => { const n = path.near(x, z); if (n.d < PATH_W / 2 + 1.6) { const t = T.tunnelAt(n.s); if (t && y < t.bottom) return t.bottom; } return 1e9; };
  // distance along a ray before it hits the land, or Infinity
  T.ray = (o, d, max) => { for (let t = 0.6; t < max; t += 0.6) { if (T.solid(o.x + d.x * t, o.y + d.y * t, o.z + d.z * t)) return t; } return Infinity; };
  return T;
}

// Where things may be built. Returns '' when fine, or the reason it is not.
export function placeError(kind, x, z, path, turrets, hubP, hiveP, T) {
  const K = TURRETS[kind], n = path.near(x, z);
  if (Math.abs(x) > BOUNDS - 3 || Math.abs(z) > BOUNDS - 3) return 'Too close to the edge';
  if (Math.hypot(x - hubP.x, z - hubP.z) < 10) return 'Too close to the hub';
  if (Math.hypot(x - hiveP.x, z - hiveP.z) < 11) return 'Too close to the hive';
  if (K.onPath) {
    if (n.d > PATH_W / 2) return 'Barricades go across the alien track'; if (n.s < 14 || n.s > path.len - 14) return 'Too close to the end of the track';
    if (T && T.tunnelAt(n.s, 2)) return 'Not inside a tunnel';
    for (const t of turrets) if (t.kind === 'barricade' && Math.abs(t.s - n.s) < 6) return 'Another barricade is too close'; return '';
  }
  if (!K.anyPlace && n.d < PATH_W / 2 + 1.2) return 'Not on the alien track';
  if (T) {
    if (T.chasm(x, z) < 0.9) return 'Not in the chasm';
    if (n.d < PATH_W / 2 + 2 && T.tunnelAt(n.s, 1)) return 'Not on a tunnel roof';
    const h = T.top(x, z); for (const [dx, dz] of [[1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2]]) if (Math.abs(T.top(x + dx, z + dz) - h) > 1.3) return 'Too steep here';
  }
  for (const t of turrets) if (t.kind !== 'barricade' && Math.hypot(t.x - x, t.z - z) < 2.6) return 'Too close to another turret';
  return '';
}

export function buildWorld(scene, mapId) {
  const D = MAPS[mapId], path = new Path(D.pts, D.hs), W = { def: D, id: mapId, path, colliders: [], group: new THREE.Group() };
  const s0 = path.pts[0], s1 = path.pts[path.pts.length - 1];
  W.hiveP = { x: s0.x, z: s0.z }; W.hubP = { x: s1.x, z: s1.z };
  const T = W.T = makeTerrain(D, path, W.hubP, W.hiveP); W.ground = T.ground; W.top = T.top;
  scene.add(W.group); const g = W.group;
  scene.background = new THREE.Color(D.sky); scene.fog = new THREE.Fog(D.fog, D.fogD[0], D.fogD[1]);
  const hemi = new THREE.HemisphereLight(mapId === 'jungle' ? 0x506a80 : D.sky, D.amb, D.hemiI || 1.1); W.hemi = hemi; g.add(hemi);
  const sun = new THREE.DirectionalLight(D.sun, D.sunI || 2.2); W.sun = sun; sun.position.set(40, 70, 25); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, near: 10, far: 220 }); g.add(sun, sun.target);

  // the land: a height grid coloured by height and steepness
  const SZ = BOUNDS * 2 + 60, N = 170, gr = new THREE.PlaneGeometry(SZ, SZ, N, N); gr.rotateX(-Math.PI / 2);
  const pos = gr.attributes.position, col = [], c1 = new THREE.Color(D.ground), c2 = new THREE.Color(D.ground2), cr = new THREE.Color(D.rock), cd = new THREE.Color(0x1a1410), r = rng(7), H = [];
  for (let i = 0; i < pos.count; i++) { const h = T.raw(pos.getX(i), pos.getZ(i)); H.push(h); pos.setY(i, h); }
  for (let i = 0; i < pos.count; i++) {
    const ix = i % (N + 1), iz = (i / (N + 1)) | 0, hx = H[i + (ix < N ? 1 : -1)], hz = H[i + (iz < N ? N + 1 : -(N + 1))], slope = Math.max(Math.abs(hx - H[i]), Math.abs(hz - H[i])) / (SZ / N);
    const c = c1.clone().lerp(c2, r() * 0.5 + Math.min(0.4, Math.max(0, H[i] - 3) * 0.05));
    if (slope > 0.6) c.lerp(cr, Math.min(1, (slope - 0.6) * 1.5)); if (H[i] < -1) c.lerp(cd, Math.min(1, (-1 - H[i]) / 5));
    if (mapId === 'ice' && H[i] > 7 && slope < 0.8) c.lerp(new THREE.Color(0xffffff), 0.6);
    col.push(c.r, c.g, c.b);
  }
  gr.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); gr.computeVertexNormals();
  const ground = new THREE.Mesh(gr, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true })); ground.receiveShadow = true; g.add(ground);
  // lava, water or icy sea at the bottom of the chasms
  const liq = new THREE.Mesh(new THREE.PlaneGeometry(SZ, SZ), new THREE.MeshStandardMaterial({ color: D.liquid, emissive: mapId === 'mars' ? D.liquid : 0x000000, emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.2 }));
  liq.rotation.x = -Math.PI / 2; liq.position.y = LIQUID; g.add(liq); W.liquid = liq;
  if (mapId === 'mars') for (const q of D.chasms) { const a = q.pts[0], b = q.pts[q.pts.length - 1]; for (let f = 0.1; f < 1; f += 0.3) { const L = new THREE.PointLight(0xff6020, 30, 22); L.position.set(a[0] + (b[0] - a[0]) * f, LIQUID + 2, a[1] + (b[1] - a[1]) * f); g.add(L); } }

  // the track: a ribbon that follows its height, one leg at a time, and a disc at each bend
  const pm = M.mat(D.path, { r: 1 }), em = M.mat(0xff6020, { e: 0xff4010, ei: 1.5 });
  for (let i = 1; i < path.pts.length; i++) {
    const a = path.pts[i - 1], b = path.pts[i], L = path.cum[i] - path.cum[i - 1], tx = (b.x - a.x) / L, tz = (b.z - a.z) / L, n = Math.ceil(L), v = [], idx = [];
    for (let k = 0; k <= n; k++) { const d = L * k / n, y = path.y(path.cum[i - 1] + d) + 0.06, x = a.x + tx * d, z = a.z + tz * d; v.push(x - tz * PATH_W / 2, y, z + tx * PATH_W / 2, x + tz * PATH_W / 2, y, z - tx * PATH_W / 2); if (k) { const o = (k - 1) * 2; idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3); } }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: D.path, roughness: 1, side: THREE.DoubleSide })); m.receiveShadow = true; g.add(m);
    for (let d = 2; d < L - 1; d += 5) { const s = path.cum[i - 1] + d; if (T.tunnelAt(s)) continue; for (const sd of [-1, 1]) { const q = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.3), em); q.position.set(a.x + tx * d - tz * sd * (PATH_W / 2 + 0.3), path.y(s) + 0.1, a.z + tz * d + tx * sd * (PATH_W / 2 + 0.3)); g.add(q); } }
  }
  path.pts.forEach((p, i) => { const m = new THREE.Mesh(new THREE.CircleGeometry(PATH_W / 2, 16), pm); m.rotation.x = -Math.PI / 2; m.position.set(p.x, path.hs[i] + 0.055, p.z); m.receiveShadow = true; g.add(m); });
  const am = M.mat(0xffffff, { op: 0.25, e: 0x404040 });
  for (let s = 12; s < path.len - 10; s += 16) { const p = path.at(s), a = new THREE.Mesh(new THREE.CircleGeometry(1.1, 3), am); a.rotation.x = -Math.PI / 2; a.rotation.z = Math.atan2(p.tx, p.tz) - Math.PI / 2; a.position.set(p.x, p.y + 0.09, p.z); g.add(a); }

  // bridges over the chasms
  const steel = M.mat(0x5a646e, { m: 0.5, r: 0.5 }), dark = M.mat(0x2c3238, { m: 0.4 }), lamp = M.mat(0xffd070, { e: 0xffb040, ei: 2 });
  for (const b of T.bridges) {
    const pa = path.at(b.s0), pb = path.at(b.s1), L = b.s1 - b.s0, mid = path.at((b.s0 + b.s1) / 2), ang = Math.atan2(pb.x - pa.x, pb.z - pa.z), pitch = Math.atan2(pb.y - pa.y, L);
    const br = new THREE.Group(); br.position.set(mid.x, mid.y, mid.z); br.rotation.y = ang; g.add(br);
    const deck = new THREE.Group(); deck.rotation.x = -pitch; br.add(deck);
    const dk = new THREE.Mesh(new THREE.BoxGeometry(PATH_W + 0.8, 0.5, L), steel); dk.position.y = -0.2; dk.castShadow = dk.receiveShadow = true; deck.add(dk);
    for (const sd of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, L), dark); rail.position.set(sd * (PATH_W / 2 + 0.3), 1.0, 0); deck.add(rail);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, L), dark); beam.position.set(sd * (PATH_W / 2 + 0.2), -0.9, 0); deck.add(beam);
      for (let z = -L / 2; z <= L / 2 + 0.01; z += 2.5) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.0, 0.12), dark); post.position.set(sd * (PATH_W / 2 + 0.3), 0.5, z); deck.add(post); }
      for (const z of [-L / 2, L / 2]) { const lp = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.4, 0.25), dark); lp.position.set(sd * (PATH_W / 2 + 0.3), 1.2, z); deck.add(lp); const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 4), lamp); bulb.position.set(sd * (PATH_W / 2 + 0.3), 2.5, z); deck.add(bulb); }
    }
    for (let z = -L / 2 + 3; z < L / 2 - 2; z += 4.5) for (const sd of [-1, 1]) { const y0 = path.y(b.s0 + z + L / 2) - mid.y, hgt = y0 - FLOOR + mid.y; const pil = new THREE.Mesh(new THREE.BoxGeometry(0.6, hgt, 0.6), steel); pil.position.set(sd * (PATH_W / 2 - 0.5), y0 - hgt / 2 - 0.4, z); pil.castShadow = true; br.add(pil); }
  }
  // tunnels through the ridges: a rock roof over the cut, and a lit concrete portal at each end
  const rockM = M.mat(D.rock, { r: 1 }), conc = M.mat(0x7a828a, { r: 0.9 }), warn = M.mat(0xffc020, { e: 0x604000 });
  for (const t of T.tunnels) {
    const pa = path.at(t.s0), pb = path.at(t.s1), L = t.s1 - t.s0, mid = path.at((t.s0 + t.s1) / 2), ang = Math.atan2(pb.x - pa.x, pb.z - pa.z), th = t.top - t.bottom;
    const tn = new THREE.Group(); tn.position.set(mid.x, 0, mid.z); tn.rotation.y = ang; g.add(tn);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(PATH_W + 3.4, th, L + 0.4), rockM); roof.position.y = t.bottom + th / 2; roof.castShadow = roof.receiveShadow = true; tn.add(roof);
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(PATH_W + 3.2, 0.3, L), conc); ceil.position.y = t.bottom + 0.1; tn.add(ceil);
    for (let z = -L / 2 + 2; z < L / 2; z += 4) { const lt = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.3), lamp); lt.position.set(0, t.bottom - 0.1, z); tn.add(lt); }
    const L1 = new THREE.PointLight(0xffd090, 14, 14); L1.position.set(0, t.bottom - 0.8, 0); tn.add(L1);
    for (const e of [-1, 1]) {
      const z = e * (L / 2 + 0.2), py = path.y(e < 0 ? t.s0 : t.s1);
      for (const sd of [-1, 1]) { const col2 = new THREE.Mesh(new THREE.BoxGeometry(1.0, t.top - py + 0.5, 0.9), conc); col2.position.set(sd * (PATH_W / 2 + 1.1), py + (t.top - py) / 2, z); col2.castShadow = true; tn.add(col2); }
      const lin = new THREE.Mesh(new THREE.BoxGeometry(PATH_W + 3.2, 0.9, 1.0), conc); lin.position.set(0, t.bottom + 0.3, z); tn.add(lin);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(PATH_W + 3.25, 0.25, 1.05), warn); stripe.position.set(0, t.bottom + 0.15, z); tn.add(stripe);
      for (const sd of [-1, 1]) { const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 4), M.mat(0xff3020, { e: 0xff2010, ei: 2 })); bulb.position.set(sd * (PATH_W / 2 + 1.1), t.top + 0.5, z); tn.add(bulb); }
    }
  }

  const hv = M.hive(); hv.position.set(s0.x, path.y(0), s0.z); g.add(hv); W.hive = hv; const hsh = new THREE.Mesh(new THREE.SphereGeometry(8.5, 24, 14), M.mat(0xc040ff, { op: 0.18, e: 0x6020a0, ds: true, flat: false })); hsh.position.set(s0.x, path.y(0), s0.z); g.add(hsh); W.hiveShield = hsh; W.colliders.push({ x: s0.x, z: s0.z, r: 6 });
  const hb = M.hub(); hb.position.set(s1.x, path.y(path.len), s1.z); g.add(hb); W.hub = hb; W.colliders.push({ x: s1.x, z: s1.z, r: 7.6 });
  const ring = new THREE.Mesh(new THREE.RingGeometry(14.6, 15, 64), M.mat(0x40ff80, { e: 0x20c050, op: 0.55, ds: true })); ring.rotation.x = -Math.PI / 2; ring.position.set(s1.x, path.y(path.len) + 0.3, s1.z); g.add(ring); W.healRing = ring;
  const pe = path.at(path.len - 1); W.spawn = { x: s1.x + pe.tx * 13, z: s1.z + pe.tz * 13 };
  if (Math.abs(W.spawn.x) > BOUNDS - 4 || Math.abs(W.spawn.z) > BOUNDS - 4) W.spawn = { x: s1.x - pe.tz * 13, z: s1.z + pe.tx * 13 };

  W.nestP = [];
  if (D.hazard === 'nests') { const NR = rng(41); for (const f of [0.28, 0.5, 0.72]) { for (let k = 0; k < 40; k++) { const s = path.len * (f + (NR() - 0.5) * 0.08), q = path.at(s), side = NR() < 0.5 ? -1 : 1, dd = 13 + NR() * 6, x = q.x - q.tz * side * dd, z = q.z + q.tx * side * dd, n = path.near(x, z);
    if (n.d < 10 || Math.abs(x) > BOUNDS - 6 || Math.abs(z) > BOUNDS - 6 || T.chasm(x, z) < 0.99 || T.ridge(x, z) > 1.5) continue; W.nestP.push({ i: W.nestP.length, x, z, y: T.raw(x, z), s: n.s }); break; } } }
  // scenery, kept off the track and out of the chasms
  const R = rng(mapId.length * 991 + 3);
  for (let i = 0; i < (D.dense ? 160 : 90); i++) {
    const x = (R() * 2 - 1) * (BOUNDS + 22), z = (R() * 2 - 1) * (BOUNDS + 22), n = path.near(x, z), out = Math.abs(x) > BOUNDS - 2 || Math.abs(z) > BOUNDS - 2;
    if (n.d < PATH_W + 4 && !out) continue; if (Math.hypot(x - W.hubP.x, z - W.hubP.z) < 16 || Math.hypot(x - W.hiveP.x, z - W.hiveP.z) < 14) continue;
    if (T.chasm(x, z) < 0.99 || T.ridge(x, z) > 3) continue;
    if (!out && R() < (D.dense ? 0.35 : 0.55)) continue; if (W.nestP.some(n => Math.hypot(n.x - x, n.z - z) < 6)) continue;
    const kind = !out && R() < 0.35 ? (R() < 0.3 ? 'crate' : D.extra[(R() * D.extra.length) | 0]) : D.prop, p = M.prop(kind, R); p.position.set(x, T.raw(x, z) - 0.1, z); p.rotation.y = R() * 6; g.add(p);
    if (!out) W.colliders.push({ x, z, r: { tower: 2.2, crate: 1.1, tree: 0.7, dome: 4, derrick: 1.8, dish: 1.5, spire: 1.2, shroom: 0.8 }[kind] || 1.6 });
  }
  // a picture of the land for the minimap
  const mc = document.createElement('canvas'); mc.width = mc.height = 170; const mg = mc.getContext('2d'), im = mg.createImageData(170, 170);
  for (let j = 0; j < 170; j++) for (let i = 0; i < 170; i++) { const x = -BOUNDS + (i + 0.5) / 170 * BOUNDS * 2, z = -BOUNDS + (j + 0.5) / 170 * BOUNDS * 2, h = T.raw(x, z), o = (j * 170 + i) * 4, v = h < -1 ? 15 : Math.max(20, Math.min(110, 40 + h * 7)); im.data[o] = h < -1 ? (mapId === 'mars' ? 120 : 20) : v * 0.8; im.data[o + 1] = h < -1 ? 30 : v; im.data[o + 2] = h < -1 ? (mapId === 'mars' ? 10 : 90) : v * 1.1; im.data[o + 3] = 200; }
  mg.putImageData(im, 0, 0); W.miniBg = mc;
  return W;
}
