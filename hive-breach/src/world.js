// The map: rolling ground, chasms crossed by bridges, ridges the track tunnels through, the hive, the hub and scenery.
// Every game builds the same map from the same numbers, so heights match for the host and friends.
import * as THREE from 'three';
import * as M from './models.js';
import { MAPS, PATH_W, BOUNDS, TURRETS, mapDef } from './data.js';

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
    const base = this.hs[i - 1] + (this.hs[i] - this.hs[i - 1]) * e, n = this.hs.length - 1;
    // near the hub and the hive the ground is levelled flat; the track settles onto it the same way
    const kh = sstep(HUB_R + 4, HUB_R + 12, this.len - s), kv = sstep(38, 48, s); let y = this.hs[n] + (base - this.hs[n]) * kh; y = this.hs[0] + (y - this.hs[0]) * kv; return y;
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
export const FLOOR = -8, LIQUID = -6.8, ROOF_GAP = 4.6, HUB_R = 24, WALL_T = 1.2, WALL_H = 4.5, RAMP_W = 3.2;

// The shape of the land, for every game and the simulation.
export function makeTerrain(D, path, hubP, hiveP) {
  const T = {};
  const hills = (x, z) => 2.6 + 3.4 * Math.sin(x * 0.034 + 1.3) * Math.cos(z * 0.029 - 0.4) + 1.8 * Math.sin(x * 0.063 + z * 0.052 + 2) + 0.9 * Math.cos(x * 0.12 - z * 0.105) + 0.35 * Math.sin(x * 0.29 + z * 0.24) + 0.18 * Math.cos(x * 0.61 - z * 0.53);
  const CR = rng(D.name.length * 131 + 7), craters = [...(D.craters || [])];
  for (let i = 0; i < 46; i++) { const x = (CR() * 2 - 1) * (BOUNDS - 12), z = (CR() * 2 - 1) * (BOUNDS - 12); if (Math.hypot(x - hubP.x, z - hubP.z) < HUB_R + 16 || Math.hypot(x - hiveP.x, z - hiveP.z) < 26) continue; craters.push({ x, z, r: 3 + CR() * 9, d: 1 + CR() * 2.6, small: 1 }); }
  T.craters = craters;
  const feats = (x, z) => { let h = 0; for (const c of craters) { const u = Math.hypot(x - c.x, z - c.z) / c.r; if (u < 1) h -= c.d * (1 - u * u); else if (u < 1.35) h += c.d * 0.4 * Math.sin((u - 1) / 0.35 * Math.PI); }
    for (const m of D.mesas || []) { const u = Math.hypot(x - m.x, z - m.z) / m.r, top = m.h * sstep(1.3, 0.92, u) * (0.92 + 0.08 * Math.sin(x * 0.4 + z * 0.3));
      const a = Math.atan2(-m.z, -m.x), dx = x - m.x, dz = z - m.z, along = dx * Math.cos(a) + dz * Math.sin(a), side = Math.abs(-dx * Math.sin(a) + dz * Math.cos(a)), L = m.h * 2.8, r0 = m.r * 0.85;
      const ramp = along > r0 && along < r0 + L && side < 4.5 ? m.h * 0.92 * (1 - (along - r0) / L) * sstep(4.5, 3, side) : 0; h += Math.max(top, ramp); }
    for (const q of D.hills || []) { const u = lineDist(q.pts, x, z) / (q.w / 2); if (u < 1) h += q.h * (Math.cos(u * Math.PI) + 1) / 2; }
    return h; };
  const ridge = (x, z) => { let r = 0; for (const q of D.ridges || []) { const u = lineDist(q.pts, x, z) / (q.w / 2); if (u < 1) r = Math.max(r, q.h * (Math.cos(u * Math.PI) + 1) / 2); } return r; };
  const chasm = (x, z) => { let k = 1; for (const q of D.chasms || []) k = Math.min(k, sstep(q.w / 2, q.w / 2 + 1.4, lineDist(q.pts, x, z))); return k; };
  T.hills = hills; T.ridge = ridge; T.chasm = chasm;
  const hubY = path.y(path.len), hiveY = path.y(0);
  // ground without bridges and tunnel roofs
  T.raw = (x, z, noPath) => {
    const out = Math.max(Math.abs(x), Math.abs(z)) - (BOUNDS - 2);
    let h = hills(x, z) + ridge(x, z) + feats(x, z) + (out > 0 ? out * 1.8 + Math.max(0, Math.sin(x * 0.05) * Math.cos(z * 0.06)) * out * 0.8 : 0);
    const n = path.near(x, z), py = path.y(n.s), R = ridge(n.x, n.z), bw = 15 - 13.6 * Math.min(1, R / 3);     // a narrow cut where the track goes under a ridge
    for (const [p, y, a, b] of [[hubP, hubY, HUB_R + 4, HUB_R + 12], [hiveP, hiveY, 27, 36]]) { const g = sstep(a, b, Math.hypot(x - p.x, z - p.z)); h = y + (h - y) * g; }   // level the ground round the bases first,
    const f = noPath ? 1 : sstep(PATH_W / 2 + 0.3, PATH_W / 2 + 0.3 + bw, n.d); h = py - 0.02 + (h - py + 0.02) * f;                                                          // then lay the track on top
    const k = chasm(x, z); h = FLOOR + (h - FLOOR) * k;
    return h;
  };
  // where the track is a bridge or a tunnel
  T.bridges = []; T.tunnels = [];
  let cur = null, curT = null;
  for (let s = 0; s <= path.len; s += 0.5) {
    const p = path.at(s), hw = PATH_W / 2 + 1.2, br = chasm(p.x, p.z) < 0.995 || chasm(p.x + p.tz * hw, p.z - p.tx * hw) < 0.995 || chasm(p.x - p.tz * hw, p.z + p.tx * hw) < 0.995, tu = ridge(p.x, p.z) > 2.2;   /* a bridge wherever the chasm reaches any part of the deck's width, so a slanted edge leaves no gap at one corner */
    if (br) { if (!cur) T.bridges.push(cur = { s0: s, s1: s }); cur.s1 = s; } else cur = null;
    if (tu) { if (!curT) T.tunnels.push(curT = { s0: s, s1: s }); curT.s1 = s; } else curT = null;
  }
  for (const b of T.bridges) { b.s0 -= 2.5; b.s1 += 2.5; }   /* each end rests well onto the dirt */
  for (const t of T.tunnels) { let top = 0; for (let s = t.s0; s <= t.s1; s += 0.5) { const p = path.at(s); top = Math.max(top, hills(p.x, p.z) + ridge(p.x, p.z)); } t.bottom = Math.max(path.y(t.s0), path.y(t.s1)) + ROOF_GAP; t.top = Math.max(top, t.bottom + 2); }
  T.bridgeAt = s => T.bridges.find(b => s >= b.s0 && s <= b.s1);
  T.tunnelAt = (s, pad = 0) => T.tunnels.find(t => s >= t.s0 - pad && s <= t.s1 + pad);
  { const q = path.at(path.len - HUB_R - 2); T.hub = { x: hubP.x, z: hubP.z, y: hubY, ga: Math.atan2(q.z - hubP.z, q.x - hubP.x), gh: (PATH_W / 2 + 2.6) / HUB_R }; T.hub.ramps = [T.hub.ga + Math.PI - 1.15, T.hub.ga + Math.PI + 0.6].map(a0 => ({ a0, a1: a0 + 0.55 })); }
  const ad = (a, b) => { let d = a - b; while (d > Math.PI) d -= 6.2832; while (d < -Math.PI) d += 6.2832; return d; };
  // inside the wall ring, on the wall, or on a ramp (with its height)
  T.hubAt = (x, z) => { const H = T.hub, r = Math.hypot(x - H.x, z - H.z); if (r > HUB_R + WALL_T) return null; const a = Math.atan2(z - H.z, x - H.x);
    if (r > HUB_R - WALL_T && Math.abs(ad(a, H.ga)) > H.gh) return { wall: 1, h: H.y + WALL_H };
    if (r > HUB_R - WALL_T - RAMP_W && r <= HUB_R - WALL_T) for (const p of H.ramps) { const f = ad(a, p.a0) / (p.a1 - p.a0); if (f >= 0 && f <= 1) return { ramp: 1, h: H.y + WALL_H * f }; }
    return r < HUB_R - WALL_T ? { yard: 1 } : null; };
  T.plats = []; T.stairs = [];
  const onStructs = (x, z, y) => { let best = -1e9; for (const p of T.plats) if (Math.abs(x - p.x) < p.hw && Math.abs(z - p.z) < p.hw && y >= p.y - 1.6) best = Math.max(best, p.y);
    for (const st of T.stairs) { const dx = x - st.x, dz = z - st.z, u = dx * st.cx + dz * st.cz, v = -dx * st.cz + dz * st.cx; if (u >= 0 && u <= st.len && Math.abs(v) < st.hw) { const hh = st.y0 + (st.y1 - st.y0) * u / st.len; if (y >= hh - 1.3) best = Math.max(best, hh); } } return best; };
  T.onStructs = onStructs;
  // walking height at (x, z) for something now at height y (so you can be on a bridge or under it, on a tunnel roof or inside)
  T.ground = (x, z, y = 1e9) => {
    const h = T.raw(x, z), n = path.near(x, z);
    if (n.d < PATH_W / 2 + 1.6) {
      const b = n.d < PATH_W / 2 + 1.0 && T.bridgeAt(n.s); if (b) {   /* the whole width of the steel deck holds you, out to the rails */ const deck = path.y(n.s); if (y >= deck - 1.3) return deck; }
      const t = T.tunnelAt(n.s); if (t && n.d < PATH_W / 2 + 1.6 && y >= t.top - 1.6) return t.top;
    }
    const hb = T.hubAt(x, z); if (hb && hb.h !== undefined && y >= hb.h - (hb.wall ? 1.6 : 1.3)) return Math.max(h, hb.h);
    if (T.plats.length) { const sh = onStructs(x, z, y); if (sh > h) return sh; }
    return h;
  };
  T.top = (x, z) => T.ground(x, z, 1e9);
  // is this point inside rock or a roof?
  T.solid = (x, y, z) => {
    const n = path.near(x, z);
    if (n.d < PATH_W / 2 + 1.6) { const t = T.tunnelAt(n.s); if (t && y > t.bottom && y < t.top) return true; }
    const hb = T.hubAt(x, z); if (hb && hb.h !== undefined && y > T.hub.y - 1 && y < hb.h - (hb.ramp ? 0.25 : 0)) return true;
    return y < T.ground(x, z, y);
  };
  T.ceiling = (x, z, y) => { const n = path.near(x, z); if (n.d < PATH_W / 2 + 1.6) { const t = T.tunnelAt(n.s); if (t && y < t.bottom) return t.bottom; } return 1e9; };
  // distance along a ray before it hits the land, or Infinity
  T.ray = (o, d, max) => { for (let t = 0.6; t < max; t += 0.6) { const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t; if (T.solid(x, y, z) || (T.block && T.block(x, y, z))) return t; } return Infinity; };
  return T;
}

// Where things may be built. Returns '' when fine, or the reason it is not.
export function placeError(kind, x, z, path, turrets, hubP, hiveP, T) {
  const K = TURRETS[kind], n = path.near(x, z);
  if (Math.abs(x) > BOUNDS - 3 || Math.abs(z) > BOUNDS - 3) return 'Too close to the edge';
  if (Math.hypot(x - hubP.x, z - hubP.z) < 11) return 'Too close to the hub core';
  if (T) { const hb = T.hubAt(x, z); if (hb && hb.ramp) return 'Not on a ramp'; }
  if (Math.hypot(x - hiveP.x, z - hiveP.z) < 11) return 'Too close to the hive';
  if (K.onPath) {
    if (n.d > PATH_W / 2) return `${K.name} goes on the alien track`; if (n.s < 14 || n.s > path.len - 14) return 'Too close to the end of the track';
    if (T && T.tunnelAt(n.s, 2)) return 'Not inside a tunnel';
    for (const t of turrets) if (t.kind === kind && Math.abs(t.s - n.s) < 6) return `Another ${K.name} is too close`; return '';
  }
  if (!K.anyPlace && n.d < PATH_W / 2 + 1.2) return 'Not on the alien track';
  if (T) {
    if (T.chasm(x, z) < 0.9) return 'Not in the chasm';
    if (n.d < PATH_W / 2 + 2 && T.tunnelAt(n.s, 1)) return 'Not on a tunnel roof';
    const hb = T.hubAt(x, z), h = T.top(x, z); if (!(hb && hb.wall)) for (const [dx, dz] of [[1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2]]) if (Math.abs(T.top(x + dx, z + dz) - h) > 1.3) return 'Too steep here';
  }
  for (const t of turrets) if (!TURRETS[t.kind].onPath && Math.hypot(t.x - x, t.z - z) < 2.6) return 'Too close to another turret';
  return '';
}

export function buildWorld(scene, mapId, diff = 0) {
  M.AS.setMap(mapId);
  const D = mapDef(mapId, diff), path = new Path(D.pts, D.hs), W = { def: D, id: mapId, diff, path, colliders: [], wrecks: [], group: new THREE.Group() };
  const s0 = path.pts[0], s1 = path.pts[path.pts.length - 1];
  { const a0 = path.at(0); W.hiveP = { x: s0.x + a0.tx * 6, z: s0.z + a0.tz * 6 }; } W.hubP = { x: s1.x, z: s1.z };
  const T = W.T = makeTerrain(D, path, W.hubP, W.hiveP); W.ground = T.ground; W.top = T.top;
  scene.add(W.group); const g = W.group;
  scene.background = new THREE.Color(D.sky); scene.fog = new THREE.Fog(D.fog, D.fogD[0], D.fogD[1]);
  // light with contrast: a cool sky above and warm ground bounce below, so tops and undersides read apart, and a faint cool rim light from opposite the sun to separate shapes
  const hemi = new THREE.HemisphereLight(new THREE.Color(mapId === 'jungle' ? 0x506a80 : D.sky).lerp(new THREE.Color(0xa8c4f0), 0.45), new THREE.Color(D.amb).multiplyScalar(0.8), D.hemiI || 1.1); W.hemi = hemi; g.add(hemi);
  { const rim = new THREE.DirectionalLight(0x9fc0ff, (D.sunI || 2.2) * 0.28); rim.position.set(-40, 30, -25); g.add(rim); W.rim = rim; }
  const sun = new THREE.DirectionalLight(D.sun, D.sunI || 2.2); W.sun = sun; sun.position.set(40, 70, 25); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 10, far: 260 }); g.add(sun, sun.target);

  // the land: a height grid coloured by height and steepness
  const SZ = BOUNDS * 2 + 140, N = 230, gr = new THREE.PlaneGeometry(SZ, SZ, N, N); gr.rotateX(-Math.PI / 2);
  const scorch = new THREE.Color(0x1c1612), pos = gr.attributes.position, col = [], c1 = new THREE.Color(D.ground), c2 = new THREE.Color(D.ground2), cr = new THREE.Color(D.rock), cd = new THREE.Color(0x1a1410), r = rng(7), H = [];
  for (let i = 0; i < pos.count; i++) { const h = T.raw(pos.getX(i), pos.getZ(i)); H.push(h); pos.setY(i, h); }
  for (let i = 0; i < pos.count; i++) {
    const ix = i % (N + 1), iz = (i / (N + 1)) | 0, hx = H[i + (ix < N ? 1 : -1)], hz = H[i + (iz < N ? N + 1 : -(N + 1))], slope = Math.max(Math.abs(hx - H[i]), Math.abs(hz - H[i])) / (SZ / N);
    const px = pos.getX(i), pz = pos.getZ(i), patch = 0.5 + 0.5 * Math.sin(px * 0.09 + Math.sin(pz * 0.07) * 2) * Math.cos(pz * 0.08 - px * 0.03);
    const c = c1.clone().lerp(c2, patch * 0.7 + r() * 0.12 + Math.min(0.3, Math.max(0, H[i] - 6) * 0.03));
    if (slope > 0.6) c.lerp(cr, Math.min(1, (slope - 0.6) * 1.5)); if (H[i] < -1) c.lerp(cd, Math.min(1, (-1 - H[i]) / 5)); for (const cr of T.craters) { const u = Math.hypot(px - cr.x, pz - cr.z) / cr.r; if (u < 1.6) { c.lerp(scorch, Math.min(0.75, (1.6 - u) * 0.6)); break; } }
    if (mapId === 'ice' && H[i] > 7 && slope < 0.8) c.lerp(new THREE.Color(0xffffff), 0.6);
    col.push(c.r, c.g, c.b);
  }
  gr.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); gr.computeVertexNormals();
  // the ground takes a photographic detail texture (dust, pebbles, cracks), sampled at two scales so it never visibly repeats
  const groundM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: false });
  new THREE.TextureLoader().load('./assets/ground.webp', tx => { tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(SZ / 9, SZ / 9); tx.anisotropy = 8; groundM.map = tx;
    groundM.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#ifdef USE_MAP\n float d1 = texture2D(map, vMapUv).r, d2 = texture2D(map, vMapUv * 0.17 + vec2(0.37, 0.11)).r;\n diffuseColor.rgb *= clamp(d1 * d2 * 2.7, 0.35, 1.6);\n#endif'); }; groundM.needsUpdate = true; });
  const ground = new THREE.Mesh(gr, groundM); ground.receiveShadow = true; g.add(ground);
  // beyond the edge of the battlefield: a flat plain running out to the horizon, ringed by huge mesas and spires
  { const plain = new THREE.Mesh(new THREE.RingGeometry(SZ * 0.5, 1100, 64, 1), new THREE.MeshStandardMaterial({ color: new THREE.Color(D.ground).multiplyScalar(0.85), roughness: 1 })); plain.rotation.x = -Math.PI / 2; plain.position.y = -1.6; g.add(plain);
    const names = { mars: ['l_rock_mars2', 'l_rock_mars1'], ice: ['l_rock_ice1', 'l_rock_ice2'], jungle: ['l_rock_jungle1'] }[mapId] || ['l_rock_mars1'], rr = rng(91 + W.diff * 7);
    for (let i = 0; i < 34; i++) { const n = names[i % names.length], a = i / 34 * 6.283 + rr() * 0.12, d = SZ / 2 + 25 + rr() * 90, m = M.AS.fitGLB(n, 'w', 45 + rr() * 70, false); if (!m) break; m.position.set(Math.cos(a) * d, -6 - rr() * 4, Math.sin(a) * d); m.rotation.y = rr() * 6; m.scale.y *= 0.8 + rr() * 0.9; m.traverse(o => { o.castShadow = false; }); g.add(m); } }
  // a sky dome: dusty horizon fading up to a deeper sky, with a glow round the sun
  { const top = new THREE.Color(D.sky).multiplyScalar(mapId === 'mars' ? 0.62 : 0.8), hor = new THREE.Color(D.fog), sd = new THREE.Vector3(40, 70, 25).normalize();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1300, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { top: { value: top }, hor: { value: hor }, sun: { value: new THREE.Color(D.sun) }, sd: { value: sd } },
      vertexShader: 'varying vec3 vd; void main(){ vd = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 top, hor, sun, sd; varying vec3 vd; void main(){ float h = clamp(vd.y, 0.0, 1.0); vec3 c = mix(hor, top, pow(h, 0.55)); float s = max(dot(normalize(vd), sd), 0.0); c += sun * (pow(s, 600.0) * 2.5 + pow(s, 12.0) * 0.25); gl_FragColor = vec4(c, 1.0); }' }));
    dome.renderOrder = -10; dome.frustumCulled = false; g.add(dome); W.dome = dome; }
  // lava, water or icy sea at the bottom of the chasms
  const liq = new THREE.Mesh(new THREE.PlaneGeometry(SZ, SZ), new THREE.MeshStandardMaterial({ color: D.liquid, emissive: mapId === 'mars' ? D.liquid : 0x000000, emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.2 }));
  liq.rotation.x = -Math.PI / 2; liq.position.y = LIQUID; g.add(liq); W.liquid = liq;
  if (mapId === 'mars') for (const q of D.chasms) { const a = q.pts[0], b = q.pts[q.pts.length - 1]; for (let f = 0.25; f < 1; f += 0.5) { const L = new THREE.PointLight(0xff6020, 30, 22); L.position.set(a[0] + (b[0] - a[0]) * f, LIQUID + 2, a[1] + (b[1] - a[1]) * f); g.add(L); } }

  // the track: a ribbon that follows its height, one leg at a time, and a disc at each bend
  const trailC = new THREE.Color(D.ground).lerp(new THREE.Color(D.path), 0.45), trailM = new THREE.MeshStandardMaterial({ color: trailC, roughness: 1, side: THREE.DoubleSide, transparent: true, opacity: 0.75, depthWrite: false }), pm = trailM;
  for (let i = 1; i < path.pts.length; i++) {
    const a = path.pts[i - 1], b = path.pts[i], L = path.cum[i] - path.cum[i - 1], tx = (b.x - a.x) / L, tz = (b.z - a.z) / L, n = Math.ceil(L), v = [], idx = [];
    for (let k = 0; k <= n; k++) { const d = L * k / n, x = a.x + tx * d, z = a.z + tz * d, y = path.y(path.cum[i - 1] + d) + (Math.hypot(x - W.hiveP.x, z - W.hiveP.z) < 31 ? -0.3 : 0.06); /* inside the queen's cavern the slime floor covers the track */ v.push(x - tz * PATH_W / 2, y, z + tx * PATH_W / 2, x + tz * PATH_W / 2, y, z - tx * PATH_W / 2); if (k) { const o = (k - 1) * 2; idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3); } }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, trailM); m.receiveShadow = true; g.add(m);
  }
  path.pts.forEach((p, i) => { const m = new THREE.Mesh(new THREE.CircleGeometry(PATH_W / 2, 16), pm); m.rotation.x = -Math.PI / 2; m.position.set(p.x, path.hs[i] + (Math.hypot(p.x - W.hiveP.x, p.z - W.hiveP.z) < 31 ? -0.3 : 0.055), p.z); m.receiveShadow = true; g.add(m); });

  // bridges over the chasms
  const steel = M.mat(0x5a646e, { m: 0.5, r: 0.5 }), dark = M.mat(0x2c3238, { m: 0.4 }), lamp = M.mat(0xffd070, { e: 0xffb040, ei: 2 });
  for (const b of T.bridges) {
    const pa = path.at(b.s0), pb = path.at(b.s1), L = b.s1 - b.s0, mid = path.at((b.s0 + b.s1) / 2), ang = Math.atan2(pb.x - pa.x, pb.z - pa.z), pitch = Math.atan2(pb.y - pa.y, L);
    const br = new THREE.Group(); br.position.set(mid.x, mid.y, mid.z); br.rotation.y = ang; g.add(br);
    const deck = new THREE.Group(); deck.rotation.x = -pitch; br.add(deck);
    const nT = Math.max(1, Math.round(L / 9)), tile0 = M.AS.stretchGLB('p_bridge', PATH_W + 1.4, L / nT + 0.05, 0.6);
    if (tile0) { for (let k = 0; k < nT; k++) { const tl = k ? M.AS.stretchGLB('p_bridge', PATH_W + 1.4, L / nT + 0.05, 0.6) : tile0; tl.position.set(0, 0.06, -L / 2 + (k + 0.5) * L / nT); deck.add(tl); } }   // the Meshy steel truss bridge, one section per 9 m
    const dk = new THREE.Mesh(new THREE.BoxGeometry(PATH_W + 0.8, 0.5, L), steel); dk.position.y = -0.2; dk.castShadow = dk.receiveShadow = true; deck.add(dk);
    if (!tile0) for (const sd of [-1, 1]) {
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
    if (M.AS.A.p_tunnel) { // one even concrete tube: Meshy tunnel sections laid end to end along the whole length, each at the track's own height, the rock roof resting on top
      const n = Math.max(1, Math.round((L + 2.4) / 7)), seg = (L + 2.4) / n, sm = (t.s0 + t.s1) / 2;
      const py0 = Math.min(path.y(t.s0), path.y(t.s1)), hh = Math.max(t.top - py0 + 0.6, PATH_W * 1.2);   // every section the same size: from the track up to the ridge top
      for (let k = 0; k < n; k++) { const s = t.s0 - 1.2 + (k + 0.5) * seg, py = path.y(s), tl = M.AS.fitGLB('p_tunnel', 'h', hh, false); tl.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(tl), d0 = bb.max.z - bb.min.z || 1;
        tl.scale.z = seg * 1.04 / d0; tl.position.set(0, py - 0.3, s - sm); tn.add(tl); }
      roof.visible = false; }
    if (!M.AS.A.p_tunnel) { const ceil = new THREE.Mesh(new THREE.BoxGeometry(PATH_W + 3.2, 0.3, L), conc); ceil.position.y = t.bottom + 0.1; tn.add(ceil); }
    if (!M.AS.A.p_tunnel) for (let z = -L / 2 + 2; z < L / 2; z += 4) { const lt = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.3), lamp); lt.position.set(0, t.bottom - 0.1, z); tn.add(lt); }
    const L1 = new THREE.PointLight(0xffd090, 14, 14); L1.position.set(0, t.bottom - 0.8, 0); tn.add(L1);
    const portal = M.AS.A.p_tunnel;
    for (const e of [-1, 1]) {
      const z = e * (L / 2 + 0.2), py = path.y(e < 0 ? t.s0 : t.s1);
      if (portal) continue;   // the tube's own end sections are the portals
      for (const sd of [-1, 1]) { const col2 = new THREE.Mesh(new THREE.BoxGeometry(1.0, t.top - py + 0.5, 0.9), conc); col2.position.set(sd * (PATH_W / 2 + 1.1), py + (t.top - py) / 2, z); col2.castShadow = true; tn.add(col2); }
      const lin = new THREE.Mesh(new THREE.BoxGeometry(PATH_W + 3.2, 0.9, 1.0), conc); lin.position.set(0, t.bottom + 0.3, z); tn.add(lin);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(PATH_W + 3.25, 0.25, 1.05), warn); stripe.position.set(0, t.bottom + 0.15, z); tn.add(stripe);
      for (const sd of [-1, 1]) { const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 4), M.mat(0xff3020, { e: 0xff2010, ei: 2 })); bulb.position.set(sd * (PATH_W / 2 + 1.1), t.top + 0.5, z); tn.add(bulb); }
    }
  }

  const hv = M.hive(), a0 = path.at(0); hv.position.set(s0.x - a0.tx * 9, path.y(0), s0.z - a0.tz * 9); hv.scale.set(0.6, 0.45, 0.6); g.add(hv); W.hive = hv; W.hiveShield = new THREE.Group(); W.hiveShield.visible = false; W.hiveShield.material = { opacity: 0 };
  hiveCave(g, W, T, D, path);
  const hb = M.hub(); hb.scale.setScalar(1.25); hb.position.set(s1.x, path.y(path.len), s1.z); g.add(hb); W.hub = hb; W.colliders.push({ x: s1.x, z: s1.z, r: 9.5 });
  buildCompound(g, T.hub, W);
  const ring = new THREE.Mesh(new THREE.RingGeometry(HUB_R - WALL_T - 0.6, HUB_R - WALL_T - 0.2, 96), M.mat(0x40ff80, { e: 0x20c050, op: 0.55, ds: true })); ring.rotation.x = -Math.PI / 2; ring.position.set(s1.x, path.y(path.len) + 0.12, s1.z); g.add(ring); W.healRing = ring;
  W.spawn = { x: s1.x - Math.cos(T.hub.ga) * 14, z: s1.z - Math.sin(T.hub.ga) * 14 };

  // burrow holes all over the open ground: small burrowers pour out of them and run straight for the hub
  W.burrows = []; { const BR = rng(mapId.length * 3301 + 17 + (W.diff || 0) * 1013); for (let k = 0; k < 400 && W.burrows.length < 9; k++) { const x = (BR() * 2 - 1) * (BOUNDS - 20), z = (BR() * 2 - 1) * (BOUNDS - 20);
    if (path.near(x, z).d < 28 || Math.hypot(x - W.hubP.x, z - W.hubP.z) < 75 || Math.hypot(x - W.hiveP.x, z - W.hiveP.z) < 50 || T.chasm(x, z) < 0.99 || T.ridge(x, z) > 1 || W.burrows.some(b => Math.hypot(b.x - x, b.z - z) < 45)) continue;
    const y = T.raw(x, z), hole = new THREE.Group(); hole.position.set(x, y, z); g.add(hole); W.burrows.push({ x, z });
    const pit = new THREE.Mesh(new THREE.CircleGeometry(2.2, 20), M.mat(0x0a0604, { r: 1 })); pit.rotation.x = -Math.PI / 2; pit.position.y = 0.08; hole.add(pit);
    const goo = new THREE.Mesh(new THREE.RingGeometry(2.1, 3.4, 20), M.mat(0x2a3a10, { e: 0x203008, op: 0.7 })); goo.rotation.x = -Math.PI / 2; goo.position.y = 0.06; hole.add(goo);
    for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283 + BR(), r = M.prop('boulder', BR); r.scale.multiplyScalar(0.28 + BR() * 0.15); r.position.set(Math.cos(a) * 2.6, -0.2, Math.sin(a) * 2.6); hole.add(r); } } }
  // resource extractor sites (like Natural Selection): weld one to build a drill rig that feeds the commander resources; aliens tear them down
  W.nodes = []; W.nodeG = []; { const NR = rng(mapId.length * 5179 + 23 + (W.diff || 0) * 1013); for (const f of [0.18, 0.34, 0.5, 0.66, 0.82]) { for (let k = 0; k < 60; k++) { const q = path.at(path.len * f), sd = NR() < 0.5 ? -1 : 1, dd = 22 + NR() * 26, x = q.x - q.tz * sd * dd, z = q.z + q.tx * sd * dd;
      if (Math.abs(x) > BOUNDS - 12 || Math.abs(z) > BOUNDS - 12 || path.near(x, z).d < 16 || T.chasm(x, z) < 0.99 || T.ridge(x, z) > 1 || Math.hypot(x - W.hubP.x, z - W.hubP.z) < HUB_R + 20 || W.burrows.some(b => Math.hypot(b.x - x, b.z - z) < 20)) continue;
      const y = T.raw(x, z), ng = new THREE.Group(); ng.position.set(x, y, z); g.add(ng);
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.8, 0.4, 20), M.mat(0x2a2e34, { m: 0.5 })); pad.position.y = 0.1; ng.add(pad);
      for (let i = 0; i < 5; i++) { const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.35 + NR() * 0.4), M.mat(0x40e0ff, { e: 0x20b0ff, ei: 2.2 })); cr.position.set((NR() - 0.5) * 1.6, 0.5 + NR() * 0.3, (NR() - 0.5) * 1.6); cr.rotation.set(NR() * 3, NR() * 3, NR() * 3); ng.add(cr); }   // the glowing vein
      const L = new THREE.PointLight(0x40c8ff, 6, 12); L.position.y = 1.5; ng.add(L);
      const real = M.AS.fitGLB('l_derrick', 'h', 9, false) || new THREE.Group(); real.visible = false; ng.add(real);
      const holo = M.AS.fitGLB('l_derrick', 'h', 9, false) || new THREE.Group(); holo.traverse(o => { if (o.isMesh) { o.material = new THREE.MeshBasicMaterial({ color: 0x60d8ff, transparent: true, opacity: 0.22, wireframe: true, depthWrite: false }); } }); ng.add(holo);   // the blueprint: weld it to build
      ng.userData = { real, holo }; W.nodeG.push(ng); W.nodes.push({ x, z, y, r: 3.4, box: [x - 3.4, y, z - 3.4, x + 3.4, y + 9, z + 3.4] }); W.colliders.push({ x, z, r: 2.2, h: 9 }); break; } } }
  // hidden lurk spots: a few aliens lie in wait and leap out at a marine walking past
  W.lurks = []; { const LR = rng(mapId.length * 2203 + 31 + (W.diff || 0) * 1013); for (let k = 0; k < 600 && W.lurks.length < 22; k++) { const x = (LR() * 2 - 1) * (BOUNDS - 15), z = (LR() * 2 - 1) * (BOUNDS - 15);
    if (path.near(x, z).d < 10 || Math.hypot(x - W.hubP.x, z - W.hubP.z) < HUB_R + 25 || Math.hypot(x - W.hiveP.x, z - W.hiveP.z) < 50 || T.chasm(x, z) < 0.99 || W.lurks.some(l => Math.hypot(l.x - x, l.z - z) < 30)) continue; W.lurks.push({ x, z, r: 1.5 }); } }
  W.nestP = [];
  if (D.hazard === 'nests') { const NR = rng(41); for (const f of [0.28, 0.5, 0.72]) { for (let k = 0; k < 40; k++) { const s = path.len * (f + (NR() - 0.5) * 0.08), q = path.at(s), side = NR() < 0.5 ? -1 : 1, dd = 13 + NR() * 6, x = q.x - q.tz * side * dd, z = q.z + q.tx * side * dd, n = path.near(x, z);
    if (n.d < 10 || Math.abs(x) > BOUNDS - 6 || Math.abs(z) > BOUNDS - 6 || T.chasm(x, z) < 0.99 || T.ridge(x, z) > 1.5) continue; W.nestP.push({ i: W.nestP.length, x, z, y: T.raw(x, z), s: n.s }); break; } } }
  // scenery, kept off the track and out of the chasms
  const R = rng(mapId.length * 991 + 3 + (W.diff || 0) * 1013);
  for (let i = 0; i < (D.dense ? 700 : 420); i++) {
    const x = (R() * 2 - 1) * (BOUNDS + 40), z = (R() * 2 - 1) * (BOUNDS + 40), n = path.near(x, z), out = Math.abs(x) > BOUNDS - 2 || Math.abs(z) > BOUNDS - 2;
    if (n.d < PATH_W + 4 && !out) continue; if (Math.hypot(x - W.hubP.x, z - W.hubP.z) < HUB_R + 10 || Math.hypot(x - W.hiveP.x, z - W.hiveP.z) < 44) continue;
    if (T.chasm(x, z) < 0.99 || T.ridge(x, z) > 3) continue;
    if (!out && R() < (D.dense ? 0.35 : 0.55)) continue; if (W.nestP.some(n => Math.hypot(n.x - x, n.z - z) < 6)) continue;
    const kind = !out && R() < 0.3 ? (R() < 0.2 ? 'crate' : D.extra[(R() * D.extra.length) | 0]) : R() < 0.3 ? 'boulder' : D.prop, p = M.prop(kind, R); p.position.set(x, T.raw(x, z) - 0.1, z); p.rotation.y = R() * 6; g.add(p); settle(p, T, kind === 'boulder' || kind === 'rock' ? 0.4 : 0.15); { const sv = SALV_PROP[kind]; if (sv) salvage(W, p, sv[0], sv[1]); }   /* man-made props can be welded for scrap too */
    if (!out) W.colliders.push({ x, z, r: { tower: 2.2, crate: 1.1, tree: 0.7, dome: 4, derrick: 1.8, dish: 1.5, spire: 1.2, shroom: 0.8, boulder: 1.8 }[kind] || 1.6, h: { tower: 7, crate: 1.4, tree: 9, dome: 5, derrick: 9, dish: 5, spire: 8, shroom: 5, boulder: 3, rock: 3, ice: 4 }[kind] || 3 });
  }
  const sky = { mars: [[0xd8c0a0, 26, -0.6, 0.35], [0xa09080, 9, 0.9, 0.5]], ice: [[0x6a8ad0, 60, 0.4, 0.3], [0xe0d0c0, 12, -0.9, 0.55]], jungle: [[0xb0a0e0, 45, -0.3, 0.32], [0xf0e0c0, 14, 1.1, 0.6], [0xc0f0d0, 7, 1.6, 0.45]] }[mapId];
  for (const [c, rad, a, el] of sky) { const pl = new THREE.Mesh(new THREE.SphereGeometry(rad, 32, 16), new THREE.MeshBasicMaterial({ color: c, fog: false })); pl.position.set(Math.cos(a) * 650, Math.sin(el) * 650, Math.sin(a) * 650); g.add(pl); if (rad > 20) { const rg = new THREE.Mesh(new THREE.RingGeometry(rad * 1.3, rad * 1.9, 64), new THREE.MeshBasicMaterial({ color: c, fog: false, transparent: true, opacity: 0.35, side: THREE.DoubleSide })); rg.position.copy(pl.position); rg.lookAt(0, 0, 0); rg.rotateX(1.1); g.add(rg); } }
  // the hub teleporter beside the spawn point: it sends marines out to the newest Engineer's Teleporter Pad
  { const hx = W.spawn.x - Math.sin(T.hub.ga) * 4.5, hz = W.spawn.z + Math.cos(T.hub.ga) * 4.5, pad = M.turret('teleporter', 0x3fc0ff); pad.position.set(hx, T.top(hx, hz), hz); g.add(pad); W.hubPad = { x: hx, z: hz }; W.hubPadMesh = pad; }
  placePOIs(g, W, T, D, mapId, path);
  battlefield(g, W, T, D, mapId, path);
  lookouts(g, W, T, D, mapId, path);
  // scrap lies around wreckage: crashed ships, satellites, capsules, debris fields, dead tanks, mechs and turrets
  for (const l of W.lore || []) W.wrecks.push({ x: l.x, z: l.z, r: 4 }); for (const l of W.loot || []) W.wrecks.push({ x: l.x, z: l.z, r: 4 });
  // bullets: big props stop them (a grid of colliders with heights, looked up by cell)
  const cell = 16, grid = new Map(); for (const c of W.colliders) { c.gy = c.gy ?? T.raw(c.x, c.z); c.h = c.h ?? 3; const x0 = Math.floor((c.x - c.r) / cell), x1 = Math.floor((c.x + c.r) / cell), z0 = Math.floor((c.z - c.r) / cell), z1 = Math.floor((c.z + c.r) / cell); for (let a = x0; a <= x1; a++) for (let b = z0; b <= z1; b++) { const k = a + ',' + b; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(c); } }
  const CR = W.caveRoof; T.block = (x, y, z) => { if (CR && y > CR.y && y < CR.y + 7 && (x - CR.x) ** 2 + (z - CR.z) ** 2 < CR.r * CR.r) return true; const l = grid.get(Math.floor(x / cell) + ',' + Math.floor(z / cell)); if (!l) return false; for (const c of l) if (y < c.gy + c.h && y > c.gy - 1 && (x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r) return true; return false; };
  // a picture of the land for the minimap
  const MR = 420, mc = document.createElement('canvas'); mc.width = mc.height = MR; const mg = mc.getContext('2d'), im = mg.createImageData(MR, MR);
  for (let j = 0; j < MR; j++) for (let i = 0; i < MR; i++) { const hb0 = T.hubAt(-BOUNDS + (i + 0.5) / MR * BOUNDS * 2, -BOUNDS + (j + 0.5) / MR * BOUNDS * 2); const x = -BOUNDS + (i + 0.5) / MR * BOUNDS * 2, z = -BOUNDS + (j + 0.5) / MR * BOUNDS * 2, h = T.raw(x, z, true), o = (j * MR + i) * 4, v = h < -1 ? 15 : Math.max(20, Math.min(110, 40 + h * 7)); im.data[o] = h < -1 ? (mapId === 'mars' ? 120 : 20) : v * 0.8; im.data[o + 1] = h < -1 ? 30 : v; im.data[o + 2] = h < -1 ? (mapId === 'mars' ? 10 : 90) : v * 1.1; im.data[o + 3] = 200; if (hb0 && hb0.wall) { im.data[o] = im.data[o + 1] = im.data[o + 2] = 210; } }
  mg.putImageData(im, 0, 0); W.miniBg = mc;
  mergeStatic(g, new Set([ground, liq, W.dome, W.hive, W.hub, W.healRing, W.hiveShield, W.caveLight, hemi, sun, sun.target, ...(W.nodeG || []), ...(W.salvMesh || [])]));
  return W;
}

// The hub compound: ring wall with a walkway and battlements, a gate where the track comes in, ramps up to the walkway,
// corner towers, the reactor in the middle, ammo crates, a landing pad and barracks.
const GL = (n, mode, size) => M.AS.fitGLB(n, mode, size, false);
function buildCompound(g, H, W) {
  const C = new THREE.Group(); C.position.set(H.x, H.y, H.z); g.add(C);
  const wallM = M.mat(0x6a737c, { m: 0.3, r: 0.7 }), dark = M.mat(0x343b42, { m: 0.4 }), stripe = M.mat(0xffc020, { e: 0x604000 }), lamp = M.mat(0x80e0ff, { e: 0x40a0ff, ei: 2 }), red = M.mat(0xff3020, { e: 0xff1000, ei: 2 });
  const ad = (a, b) => { let d = a - b; while (d > Math.PI) d -= 6.2832; while (d < -Math.PI) d += 6.2832; return d; };
  const seg = 64;
  for (let i = 0; i < seg; i++) {
    const a = (i + 0.5) / seg * 6.2832; if (Math.abs(ad(a, H.ga)) < H.gh + 0.03) continue; const len = HUB_R * 6.2832 / seg + 0.05;
    { const wp = M.AS.wallPiece(len, WALL_H + 0.45, WALL_T * 2 + 0.5); if (wp) { wp.position.set(Math.cos(a) * HUB_R, 0, Math.sin(a) * HUB_R); wp.rotation.y = -a + Math.PI / 2; C.add(wp); continue; } }   // the Meshy armoured wall (same footprint, walkable top at the same height)
    const w = new THREE.Mesh(new THREE.BoxGeometry(WALL_T * 2, WALL_H, len), wallM); w.position.set(Math.cos(a) * HUB_R, WALL_H / 2, Math.sin(a) * HUB_R); w.rotation.y = -a; w.castShadow = w.receiveShadow = true; C.add(w);
    const walk = new THREE.Mesh(new THREE.BoxGeometry(WALL_T * 2 + 0.1, 0.12, len), dark); walk.position.set(Math.cos(a) * HUB_R, WALL_H + 0.06, Math.sin(a) * HUB_R); walk.rotation.y = -a; walk.receiveShadow = true; C.add(walk);
    if (i % 2 === 0) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.0, len * 0.6), wallM); m.position.set(Math.cos(a) * (HUB_R + WALL_T - 0.2), WALL_H + 0.5, Math.sin(a) * (HUB_R + WALL_T - 0.2)); m.rotation.y = -a; m.castShadow = true; C.add(m); }
    if (i % 4 === 0) { const st = new THREE.Mesh(new THREE.BoxGeometry(WALL_T * 2 + 0.05, 0.3, len), stripe); st.position.set(Math.cos(a) * HUB_R, 1.0, Math.sin(a) * HUB_R); st.rotation.y = -a; C.add(st); }
  }
  // the gate: tall pillars, a lit beam overhead, warning lights
  for (const sd of [-1, 1]) { const a = H.ga + sd * (H.gh + 0.02), gt = GL('h_gatetower', 'h', WALL_H + 5.5); if (gt) { gt.position.set(Math.cos(a) * HUB_R, 0, Math.sin(a) * HUB_R); gt.rotation.y = -a + Math.PI / 2; C.add(gt); continue; } const p = new THREE.Mesh(new THREE.BoxGeometry(2.8, WALL_H + 3.5, 2.8), dark); p.position.set(Math.cos(a) * HUB_R, (WALL_H + 3.5) / 2, Math.sin(a) * HUB_R); p.rotation.y = -a; p.castShadow = true; C.add(p); const b = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), red); b.position.set(Math.cos(a) * HUB_R, WALL_H + 3.9, Math.sin(a) * HUB_R); C.add(b); }
  { const a = H.ga, beam = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 2 * HUB_R * Math.sin(H.gh) + 2.8), dark); beam.position.set(Math.cos(a) * HUB_R, WALL_H + 3.0, Math.sin(a) * HUB_R); beam.rotation.y = -a; C.add(beam); const lt = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.25, 2 * HUB_R * Math.sin(H.gh)), stripe); lt.position.set(Math.cos(a) * HUB_R, WALL_H + 2.45, Math.sin(a) * HUB_R); lt.rotation.y = -a; C.add(lt); }
  // ramps up to the walkway, as steps
  for (const rp of H.ramps) for (let k = 0; k < 12; k++) { const f0 = k / 12, a = rp.a0 + (rp.a1 - rp.a0) * (k + 0.5) / 12, h = WALL_H * (k + 1) / 12, r = HUB_R - WALL_T - RAMP_W / 2, len = r * (rp.a1 - rp.a0) / 12 + 0.05;
    const st = new THREE.Mesh(new THREE.BoxGeometry(RAMP_W, h, len), k % 2 ? wallM : dark); st.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r); st.rotation.y = -a; st.castShadow = st.receiveShadow = true; C.add(st); void f0; }
  // corner towers outside the wall
  for (const da of [0.9, 2.2, -0.9, -2.2]) { const a = H.ga + Math.PI + da, x = Math.cos(a) * (HUB_R + 3.2), z = Math.sin(a) * (HUB_R + 3.2), t = new THREE.Group(); t.position.set(x, 0, z); C.add(t);
    const ctw = GL('h_gatetower', 'h', WALL_H + 7); if (ctw) { ctw.rotation.y = -a + Math.PI / 2; t.add(ctw); W.colliders.push({ x: H.x + x, z: H.z + z, r: 2.6 }); continue; }
    const body = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.6, WALL_H + 5, 8), wallM); body.position.y = (WALL_H + 5) / 2; body.castShadow = true; t.add(body);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.2, 1.2, 8), dark); top.position.y = WALL_H + 5.6; t.add(top); const l = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), lamp); l.position.y = WALL_H + 6.6; t.add(l);
    W.colliders.push({ x: H.x + x, z: H.z + z, r: 2.6 }); }
  // inside: ammo crates by the spawn, a landing pad, barracks
  const back = H.ga + Math.PI, ax = Math.cos(back) * 9, az = Math.sin(back) * 9;
  { const cg = M.AS.propGLB('crate', () => 0.5); if (cg) { cg.position.set(ax - Math.sin(back) * 3, 0, az + Math.cos(back) * 3); C.add(cg); } }
  if (!M.AS.A.l_crates) for (let i = 0; i < 6; i++) { const cr = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.9), M.mat(0x4a5a3a, { r: 0.8 })); cr.position.set(ax + (i % 3 - 1) * 1.3 - Math.sin(back) * 3, 0.45 + (i >= 3 ? 0.9 : 0), az + (i % 3 - 1) * 1.3 * 0 + Math.cos(back) * 3); cr.castShadow = true; C.add(cr); const st2 = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.15, 0.92), stripe); st2.position.copy(cr.position); C.add(st2); }
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 0.2, 24), dark); pad.position.set(Math.cos(back + 1.3) * 15, 0.1, Math.sin(back + 1.3) * 15); C.add(pad);
  const ring = new THREE.Mesh(new THREE.RingGeometry(4, 4.4, 32), M.mat(0xffc020, { e: 0x806000, ds: true })); ring.rotation.x = -Math.PI / 2; ring.position.set(pad.position.x, 0.22, pad.position.z); C.add(ring);
  for (const da of [-1.4, 1.6]) { const a = back + da, x = Math.cos(a) * 15.5, z = Math.sin(a) * 15.5, bk = GL('h_barracks', 'w', 7.4); if (bk) { bk.position.set(x, 0, z); bk.rotation.y = -a + Math.PI / 2; C.add(bk); W.colliders.push({ x: H.x + x, z: H.z + z, r: 3.2 }); continue; } const b = new THREE.Mesh(new THREE.BoxGeometry(7, 3.4, 4.5), wallM); b.position.set(x, 1.7, z); b.rotation.y = -a; b.castShadow = true; C.add(b); const roof = new THREE.Mesh(new THREE.BoxGeometry(7.3, 0.4, 4.8), dark); roof.position.set(x, 3.6, z); roof.rotation.y = -a; C.add(roof); W.colliders.push({ x: H.x + x, z: H.z + z, r: 3.4 }); }
  // the comms building: recruitment console out front
  { const a = back - 0.55, x = Math.cos(a) * 17.5, z = Math.sin(a) * 17.5, hc = GL('h_comms', 'w', 7); if (hc) { hc.position.set(x, 0, z); hc.rotation.y = -a + Math.PI / 2; C.add(hc); } else { const b = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 5), wallM); b.position.set(x, 2, z); b.rotation.y = -a; b.castShadow = true; C.add(b); }
    if (!hc) { const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 9, 6), dark); mast.position.set(x, 8, z); C.add(mast); const dsh = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 6, 0, 6.29, 0, 1), M.mat(0xd8dde2, { ds: true })); dsh.position.set(x + 1.5, 4.8, z); dsh.rotation.x = 2.1; C.add(dsh); }
    const cx = Math.cos(a) * 13.8, cz = Math.sin(a) * 13.8, con = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 0.7), dark); con.position.set(cx, 0.6, cz); con.rotation.y = -a + Math.PI / 2; C.add(con); const scr = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.05), M.mat(0x40c0ff, { e: 0x2080c0, ei: 2 })); scr.position.set(cx, 1.45, cz); scr.rotation.y = -a + Math.PI / 2; C.add(scr);
    W.comms = { x: H.x + cx, z: H.z + cz }; W.colliders.push({ x: H.x + x, z: H.z + z, r: 3.2 }); }
  // floodlights on the walls
  for (let i = 0; i < 2; i++) { const a = H.ga + Math.PI / 2 + i * Math.PI; const L = new THREE.PointLight(0xc0e0ff, 30, 50); L.position.set(Math.cos(a) * (HUB_R - 2), WALL_H + 4, Math.sin(a) * (HUB_R - 2)); C.add(L); const fl = GL('h_floodlight', 'h', 7); if (fl) { fl.position.set(Math.cos(a) * (HUB_R - 1.2), WALL_H, Math.sin(a) * (HUB_R - 1.2)); fl.rotation.y = -a - Math.PI / 2; C.add(fl); } }
}

// Logs the marines can find, one per point of interest on each map
const LORE = {
  mars: {
    cave: ['Mining Shaft 7-C', 'Day 112. The drill broke into a hollow under the red rock and warm air came up. Gonzales swears it was breathing. We sealed the shaft. Something keeps scratching at the seal from below.'],
    satellite: ['Relay satellite ARGUS-4', 'Telemetry, last packet 03:14. Impact detected north of Outpost 7. Before impact: strong signal from beneath the surface. Signal type: organic. Signal count: rising.'],
    capsule: ['Supply capsule IRIS', 'Manifest: 40 crates of rations, 12 pulse rifles, 1 sealed blue crate. Scrawled on the hatch in marker: DO NOT OPEN THE BLUE CRATE.'],
    wreck: ['Dropship Valkyrie-2, flight recorder', '"...they came up out of the sand all at once, hundreds of them. Pull up, pull up, I said PULL UP—" (recording ends)'],
    rover: ['Survey rover SR-11', 'Sample bay: 6 rock cores, 1 egg-shaped object, cracked open. Rover was found 2 km from where it was parked.'],
  },
  ice: {
    cave: ['Ice cave research post', 'Sample K-19 thawed overnight. It moved. Dr. Hale says it is just the ice settling. Dr. Hale has not come back from the lower tunnels.'],
    satellite: ['Kryos weather satellite', 'Storm cell analysis: heat signatures beneath the ice sheet. Thousands. They are moving toward Kryos Station.'],
    capsule: ['Escape pod 3', 'If anyone finds this: the station is gone. Get to the hub. Do not stop in the blizzard. Do not follow the lights in the crevasse.'],
    wreck: ['Cargo hauler Whiteout', '"Engines iced, going down. Tell my wife the turrets were working. It was just never enough turrets."'],
    rover: ['Snowcat 4', 'Tracks circle the crevasse twice, then lead straight into it. Heater still running.'],
  },
  jungle: {
    cave: ['Overgrown temple cave', 'The carvings on these walls show the same hive shape we found at the nests. Someone built this long before the colony, before the jungle. The carvings end with a hive that covers the whole sky.'],
    satellite: ['Colony beacon', 'Beacon still transmitting on loop: "Verdant Colony requests immediate evacuation. Nest count unknown. Repeat, nest count unknown."'],
    capsule: ['Seed vault pod', 'Botanical samples intact. Note: the vines grew through the hull in a single night. They are warm to the touch.'],
    wreck: ['Gunship Thorn', 'Pilot log, final entry: "The nests are spreading faster than we can burn them. If you are reading this, burn them before they hatch."'],
    rover: ['Colony buggy', 'Glovebox: a photo of a family, a half-eaten ration bar, and a map with the hive circled three times.'],
  },
};
// The Brood Queen's lair: a great rock chamber with a roof, open toward the track; the queen sits at the start of the track inside it
function hiveCave(g, W, T, D, path) {
  // a great cavern in the side of a mountain: a 30 m chamber under a high rock roof, a huge mouth facing the track, the queen at the very back
  const R = rng(4242), p0 = path.at(0), cy = path.y(0), cx = W.hiveP.x, cz = W.hiveP.z, open = Math.atan2(p0.tz, p0.tx), RAD = 30, HALF = 0.6, fx = p0.tx, fz = p0.tz;
  const rockM = M.mat(D.rock, { flat: false, r: 1 }), C = new THREE.Group(); C.position.set(cx, 0, cz); g.add(C);
  const rock = (x, z, r, sy, y0, col = true, h = 26) => { const gy = T.raw(cx + x, cz + z), m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 1), rockM); m.position.set(x, (y0 ?? gy) + r * sy * 0.55, z); m.scale.set(1, sy, 1); m.rotation.set(R() * 0.5, R() * 6, R() * 0.5); m.castShadow = true; C.add(m); if (col) W.colliders.push({ x: cx + x, z: cz + z, r: r * 0.9, h, gy }); return m; };
  // the cavern wall: a ring of tall rock, open toward the track
  for (let i = 0; i < 34; i++) { const a = open + HALF + i / 33 * (6.283 - HALF * 2), rr = 6 + R() * 2.5; rock(Math.cos(a) * (RAD + 2), Math.sin(a) * (RAD + 2), rr, 2.6 + R() * 0.8); }
  // the mountain itself, heaped around and over the cavern
  for (let i = 0; i < 22; i++) { const a = open + HALF + 0.25 + R() * (6.283 - HALF * 2 - 0.5), d = RAD + 12 + R() * 18, r = 13 + R() * 9; rock(Math.cos(a) * d, Math.sin(a) * d, r, 1.5 + R() * 0.7, undefined, false); }
  for (let i = 0; i < 9; i++) { const a = open + Math.PI + (R() - 0.5) * 3.6, d = R() * RAD * 0.8, r = 12 + R() * 7; rock(Math.cos(a) * d, Math.sin(a) * d, r, 0.9, cy + 24 + R() * 6, false); }
  // the huge mouth: two great buttresses and a lintel of rock arching over the track
  for (const sd of [-1, 1]) { const a = open + sd * (HALF + 0.05), x = Math.cos(a) * (RAD + 3), z = Math.sin(a) * (RAD + 3); rock(x, z, 9, 3.2); }
  for (let i = -3; i <= 3; i++) { const a = open + i * 0.18, x = Math.cos(a) * (RAD + 3), z = Math.sin(a) * (RAD + 3), m = rock(x, z, 6.5, 0.9, cy + 23 + Math.abs(i) * 1.2, false); m.scale.x = 1.4; }
  const roof = new THREE.Mesh(new THREE.SphereGeometry(RAD + 6, 32, 14, 0, 6.29, 0, 1.3), rockM.clone()); roof.scale.y = 0.72; roof.position.y = cy + 2; roof.material.side = THREE.DoubleSide; C.add(roof);
  for (let i = 0; i < 26; i++) { const a = R() * 6.28, d = 4 + R() * (RAD - 6), st = new THREE.Mesh(new THREE.ConeGeometry(0.7 + R() * 1, 3 + R() * 5, 6), rockM); st.position.set(Math.cos(a) * d, cy + 25 - (d / RAD) ** 2 * 12 - 2, Math.sin(a) * d); st.rotation.x = Math.PI; C.add(st); }
  // inside: a slime floor, egg clusters and a sick purple glow
  const goo = new THREE.Mesh(new THREE.CircleGeometry(RAD - 1, 48), M.mat(0x3a1a40, { e: 0x200828, r: 0.3 })); goo.rotation.x = -Math.PI / 2; goo.position.y = cy + 0.06; C.add(goo);
  const eggM = M.mat(0xc0a060, { e: 0x604010, ei: 0.8, op: 0.9, flat: false }); const eggG = M.AS.A.l_eggs; for (let i = 0; i < (eggG ? 16 : 46); i++) { const a = R() * 6.28, d = 10 + R() * (RAD - 12); if (Math.abs(((a - open + 9.42) % 6.283) - 3.14) < 0.7) continue; if (eggG) { const x = Math.cos(a) * d, z = Math.sin(a) * d, eg = M.AS.propGLB('eggs', R); eg.position.set(x, T.raw(cx + x, cz + z), z); eg.rotation.y = R() * 6; C.add(eg); continue; } const e = new THREE.Mesh(new THREE.SphereGeometry(0.5 + R() * 0.35, 10, 8), eggM); e.scale.y = 1.4; const x = Math.cos(a) * d, z = Math.sin(a) * d; e.position.set(x, T.raw(cx + x, cz + z) + 0.55, z); C.add(e); }
  const L = new THREE.PointLight(0xb040ff, 55, 70); L.position.set(-fx * 14, cy + 9, -fz * 14); C.add(L); W.caveLight = L;
  const q = { x: cx - fx * 20, z: cz - fz * 20 };
  W.caveRoof = { x: cx, z: cz, y: cy + 21, r: RAD + 2 }; W.cave = { x: cx, z: cz, r: RAD, q, y: cy }; (W.shelters = W.shelters || []).push({ x: cx, z: cz, r: RAD - 2 });
  // the hive mound behind the queen
  if (W.hive) { W.hive.position.set(q.x - fx * 7, cy, q.z - fz * 7); W.hive.scale.set(0.9, 0.7, 0.9); }
}
// a wreck the welder can cut scrap out of: remember where it is, how big it really is (for the welding beam) and how much scrap it holds
function salvage(W, m, name, amt) {
  m.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(m); if (b.isEmpty()) return; const c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3());
  (W.salvMesh = W.salvMesh || []).push(m);   // kept as its own object (not merged into the map) so it can shrink as it's cut up and vanish once stripped
  (W.salvage = W.salvage || []).push({ x: c.x, z: c.z, y: b.min.y, r: Math.max(1, Math.min(9, Math.max(sz.x, sz.z) / 2)), amt, name, box: [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z] });
}
const SALV_PROP = { crate: ['supply crate', 12], dome: ['habitat dome', 40], derrick: ['drill derrick', 50], dish: ['radar dish', 35] };
const SALV = { satellite: ['crashed satellite', 60], wreck: ['wrecked ship', 160], capsule: ['supply capsule', 45], rover: ['wrecked rover', 45], debris: ['crashed ship', 55] };
// sit a model on the ground: drop it so the lowest ground under its footprint touches its bottom (no wreck hangs in the air on a slope)
const _sb = new THREE.Box3();
function settle(m, T, sink = 0.15) {
  m.updateMatrixWorld(true); _sb.setFromObject(m); if (_sb.isEmpty()) return; const hx = (_sb.max.x - _sb.min.x) * 0.38, hz = (_sb.max.z - _sb.min.z) * 0.38, cx = (_sb.min.x + _sb.max.x) / 2, cz = (_sb.min.z + _sb.max.z) / 2;
  let lo = T.raw(cx, cz); for (const [dx, dz] of [[hx, 0], [-hx, 0], [0, hz], [0, -hz], [hx, hz], [-hx, -hz], [hx, -hz], [-hx, hz]]) lo = Math.min(lo, T.raw(cx + dx, cz + dz));
  m.position.y += lo - _sb.min.y - sink;
}
function placePOIs(g, W, T, D, mapId, path) {
  const R = rng(mapId.length * 7919 + 11 + (W.diff || 0) * 1013), H = T.hub, hv = W.hiveP; W.lore = []; W.salvage = []; W.salvMesh = []; W.shelters = W.shelters || [];
  const ok = (x, z, clear) => Math.abs(x) < BOUNDS - 12 && Math.abs(z) < BOUNDS - 12 && path.near(x, z).d > clear && Math.hypot(x - H.x, z - H.z) > HUB_R + 18 && Math.hypot(x - hv.x, z - hv.z) > 52 && T.chasm(x, z) > 0.99 && T.ridge(x, z) < 1.5 && !W.lore.some(l => Math.hypot(l.x - x, l.z - z) < 40);
  const spot = clear => { for (let k = 0; k < 400; k++) { const x = (R() * 2 - 1) * BOUNDS, z = (R() * 2 - 1) * BOUNDS; if (ok(x, z, clear)) return [x, z]; } return null; };
  const put = (kind, clear, make, colliders) => { const p = spot(clear); if (!p) return; const [x, z] = p, y = T.raw(x, z), m = make(R); m.position.set(x, y - 0.2, z); m.rotation.y = R() * 6; g.add(m); settle(m, T); { const sv = SALV[kind.replace(/\d+$/, '')]; if (sv) salvage(W, m, sv[0], sv[1]); } for (const c of colliders) W.colliders.push({ x: x + c[0], z: z + c[1], r: c[2], h: c[3], gy: y }); const lo = LORE[mapId][kind]; if (lo) { const t = M.terminal(); const a = R() * 6; t.position.set(x + Math.cos(a) * 4, T.raw(x + Math.cos(a) * 4, z + Math.sin(a) * 4), z + Math.sin(a) * 4); t.rotation.y = -a + Math.PI / 2; g.add(t); W.lore.push({ x: t.position.x, z: t.position.z, kind, title: lo[0], text: lo[1] }); } else W.lore.push({ x, z, kind, silent: 1 }); };
  put('satellite', 18, M.satellite, [[0, 0, 2.2, 3]]); put('wreck', 22, M.wreck, [[-4, 0, 2.6, 4], [4.5, 2, 2.4, 3.5], [-10, 0, 2, 4]]); put('capsule', 16, M.capsule, [[0, 0, 2, 3]]); put('rover', 14, M.rover, [[0, 0, 1.8, 2.5]]);
  for (let i = 0; i < 16; i++) put('debris' + i, 10, M.debris, []);   // crashed ships all over the map, to cut scrap from
  for (let i = 0; i < 45; i++) put('boulder' + i, 7, R => M.prop('boulder', R), [[0, 0, 1.8, 2.5]]);   // more big Meshy boulders across the open ground
  // downed dropships: their cargo holds still have ammunition to salvage (E)
  W.loot = []; { const wr = W.lore.find(l => l.kind === 'wreck'); if (wr) W.loot.push({ x: wr.x, z: wr.z, name: 'Wrecked dropship' }); }
  for (let i = 0; i < 6; i++) { const p = spot(14); if (!p) continue; const [x, z] = p, y = T.raw(x, z), ry = R() * 6, m = M.dropship(); m.position.set(x, y + 0.5, z); m.rotation.set((R() - 0.5) * 0.3, ry, (R() > 0.5 ? 1 : -1) * (0.25 + R() * 0.2)); m.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.multiplyScalar(0.55); } }); g.add(m); salvage(W, m, 'downed dropship', 90);
    const cx = x + Math.cos(ry) * 4, cz = z - Math.sin(ry) * 4, c = M.ammoCrate(); c.position.set(cx, T.raw(cx, cz), cz); c.rotation.y = R() * 6; g.add(c); salvage(W, c, 'ammo crate', 10);
    W.colliders.push({ x, z, r: 3.2, h: 3, gy: y }); W.loot.push({ x: cx, z: cz, name: 'Downed dropship' }); W.lore.push({ x, z, kind: 'dropship' + i, silent: 1 }); }
  // the cave: a ring of great rocks with a rock roof, open on one side, a log terminal inside
  const p = spot(26); if (p) {
    const [cx, cz] = p, cy = T.raw(cx, cz), open = Math.atan2(-cz, -cx), rockM = M.mat(D.rock, { flat: false, r: 1 }), C = new THREE.Group(); C.position.set(cx, cy, cz); g.add(C);
    for (let i = 0; i < 16; i++) { const a = open + 0.5 + i / 16 * (6.28 - 1.0), rr = 2.4 + R() * 1.2, m = new THREE.Mesh(new THREE.DodecahedronGeometry(rr, 1), rockM); m.position.set(Math.cos(a) * 7.5, rr * 0.8, Math.sin(a) * 7.5); m.scale.y = 1.6; m.rotation.set(R(), R() * 6, R()); m.castShadow = true; C.add(m); W.colliders.push({ x: cx + Math.cos(a) * 7.5, z: cz + Math.sin(a) * 7.5, r: rr * 0.95, h: 7, gy: cy }); }
    const roof = new THREE.Mesh(new THREE.SphereGeometry(10, 18, 10, 0, 6.29, 0, 1.25), rockM); roof.scale.y = 0.6; roof.position.y = 2.4; roof.material.side = THREE.DoubleSide; C.add(roof);
    const L = new THREE.PointLight(0x60a0ff, 18, 16); L.position.set(0, 3, 0); C.add(L); for (let i = 0; i < 5; i++) { const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.4 + R() * 0.6), M.mat(0x80d0ff, { e: 0x3080c0, ei: 1.5 })); cr.position.set((R() - 0.5) * 8, 0.4, (R() - 0.5) * 8); C.add(cr); }
    const t = M.terminal(); t.position.set(-Math.cos(open) * 3, 0, -Math.sin(open) * 3); t.rotation.y = -open - Math.PI / 2; C.add(t);
    W.shelters.push({ x: cx, z: cz, r: 7 });
    const lo = LORE[mapId].cave; W.lore.push({ x: cx - Math.cos(open) * 3, z: cz - Math.sin(open) * 3, kind: 'cave', title: lo[0], text: lo[1] });
  }
  // Kryos: heated shelter huts to wait out a blizzard
  if (mapId === 'ice') for (let i = 0; i < 5; i++) { const p2 = spot(16); if (!p2) continue; const [x, z] = p2, y = T.raw(x, z), h = M.hut(); h.position.set(x, y, z); h.rotation.y = Math.atan2(-x, -z); g.add(h); W.shelters.push({ x, z, r: 5 }); W.lore.push({ x, z, kind: 'hut', silent: 1 }); }
  // rock spires round the hive: you have to come close to hit its guardians
  for (let i = 0; i < 18; i++) { const a = i / 18 * 6.28 + R() * 0.2, rr = 48 + R() * 10, x = hv.x + Math.cos(a) * rr, z = hv.z + Math.sin(a) * rr; if (path.near(x, z).d < 8 || Math.abs(x) > BOUNDS - 2 || Math.abs(z) > BOUNDS - 2) continue; const sp = M.spire(R, D.rock); sp.position.set(x, T.raw(x, z), z); g.add(sp); W.colliders.push({ x, z, r: 1.9, h: 12 }); }
}

// Signs of a long war: fallen marines, dead aliens, wrecked tanks and mechs, sandbag lines, tank traps, dead turrets, burnt crates, flags.
function battlefield(g, W, T, D, mapId, path) {
  const R = rng(mapId.length * 4447 + 5 + (W.diff || 0) * 1013), H = T.hub, hv = W.hiveP;
  const free = (x, z, clear) => Math.abs(x) < BOUNDS - 6 && Math.abs(z) < BOUNDS - 6 && path.near(x, z).d > clear && Math.hypot(x - H.x, z - H.z) > HUB_R + 6 && Math.hypot(x - hv.x, z - hv.z) > 44 && T.chasm(x, z) > 0.99 && T.ridge(x, z) < 2;
  const put = (make, x, z, col) => { const m = make(R); m.position.set(x, T.raw(x, z) - 0.05, z); m.rotation.y = R() * 6; g.add(m); settle(m, T, make === M.corpse || make === M.carcass ? 0.05 : 0.15); if (col) W.colliders.push({ x, z, r: col[0], h: col[1] }); if (make === M.tankTrap || make === M.flag) salvage(W, m, make === M.flag ? 'flag pole' : 'tank trap', make === M.flag ? 6 : 10); if ([M.tank, M.mech, M.deadTurret, M.burntCrate].includes(make)) { W.wrecks.push({ x, z, r: col ? col[0] : 2 }); salvage(W, m, make === M.tank ? 'wrecked tank' : make === M.mech ? 'wrecked mech' : make === M.deadTurret ? 'dead turret' : 'burnt crate', make === M.tank ? 75 : make === M.mech ? 60 : make === M.deadTurret ? 30 : 15); } };
  // battle lines along the track: sandbags, tank traps, bodies and wrecks 12-40 m from it
  for (let s = 30; s < path.len - 40; s += 22) {
    const q = path.at(s);
    for (const sd of [-1, 1]) {
      if (R() < 0.35) continue; const off = 14 + R() * 26, x = q.x - q.tz * sd * off, z = q.z + q.tx * sd * off; if (!free(x, z, 12)) continue; const k = R();
      if (k < 0.3) { const m = M.sandbags(R); m.position.set(x, T.raw(x, z), z); m.rotation.y = Math.atan2(q.tx, q.tz) + (sd > 0 ? Math.PI / 2 : -Math.PI / 2); settle(m, T, 0.2); g.add(m);   /* down onto the lowest ground under the ring: none hover on slopes */ W.colliders.push({ x, z, r: 2.5, h: 1.1 }); (W.bags = W.bags || []).push({ x, z }); }   // the map's own sandbag walls: cover anyone can use
      else if (k < 0.45) put(M.tankTrap, x, z, [1, 1.8]);
      else if (k < 0.62) put(M.corpse, x, z);
      else if (k < 0.8) put(M.carcass, x, z);
      else if (k < 0.88) put(M.deadTurret, x, z, [1.1, 1.5]);
      else if (k < 0.94) put(M.tank, x, z, [3.4, 2.6]);
      else put(M.mech, x, z, [2.4, 3]);
    }
  }
  // scattered all over, and gathered in the craters
  for (let i = 0; i < 160; i++) { const x = (R() * 2 - 1) * (BOUNDS - 8), z = (R() * 2 - 1) * (BOUNDS - 8); if (!free(x, z, 8)) continue; const k = R();
    if (k < 0.3) put(M.corpse, x, z); else if (k < 0.55) put(M.carcass, x, z); else if (k < 0.68) put(M.burntCrate, x, z, [1.6, 1.2]); else if (k < 0.76) put(M.flag, x, z); else if (k < 0.84) put(M.tankTrap, x, z, [1, 1.8]); else if (k < 0.9) put(M.tank, x, z, [3.4, 2.6]); else if (k < 0.95) put(M.mech, x, z, [2.4, 3]); else put(M.deadTurret, x, z, [1.1, 1.5]); }
  for (const c of T.craters) if (!c.small || R() < 0.4) { const x = c.x + (R() - 0.5) * c.r, z = c.z + (R() - 0.5) * c.r; if (free(x, z, 8)) put(R() < 0.5 ? M.carcass : M.debris, x, z); }
}
// Every still piece of scenery is merged into one mesh per material, so the graphics card draws a few dozen things instead of thousands.
// Meshy models store compressed (integer) vertex data; turn it back into plain floats before merging
function deq(geo) { for (const k of ['position', 'normal', 'uv']) { const a = geo.attributes[k]; if (!a || a.array instanceof Float32Array) continue; const f = new Float32Array(a.count * a.itemSize); for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) f[i * a.itemSize + c] = a.getComponent(i, c); geo.setAttribute(k, new THREE.BufferAttribute(f, a.itemSize)); } return geo; }
function mergeStatic(g, keep) {
  g.updateMatrixWorld(true); const by = new Map(), extras = [];
  for (const child of [...g.children]) {
    if (keep.has(child) || child.isLight) continue; let any = false;
    child.traverse(o => { if (o.isLight || o.isSprite || o.isPoints || o.isLineSegments) { extras.push(o); return; } if (!o.isMesh || !o.geometry || o.material.vertexColors) return; any = true; let geo = deq(o.geometry.clone()); geo.applyMatrix4(o.matrixWorld); if (geo.index) geo = geo.toNonIndexed(); if (!geo.attributes.normal) geo.computeVertexNormals(); const k = o.material.uuid; if (!by.has(k)) by.set(k, { mat: o.material, geos: [], shadow: false }); const e = by.get(k); e.geos.push(geo); e.shadow = e.shadow || o.castShadow; });
    if (any || child.children.length || child.isMesh) g.remove(child);
  }
  for (const o of extras) g.attach(o);
  for (const { mat, geos, shadow } of by.values()) {
    let n = 0; for (const q of geos) n += q.attributes.position.count; const hasUV = geos.every(q => q.attributes.uv), P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = hasUV ? new Float32Array(n * 2) : null; let off = 0;
    for (const q of geos) { P.set(q.attributes.position.array, off * 3); N.set(q.attributes.normal.array, off * 3); if (U) U.set(q.attributes.uv.array, off * 2); off += q.attributes.position.count; q.dispose(); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(N, 3)); if (U) geo.setAttribute('uv', new THREE.BufferAttribute(U, 2)); geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; m.receiveShadow = true; g.add(m);
  }
}

// High ground: sandbagged sniper nests along the ridgelines and on the mesas, and climbable watchtowers near the track
function lookouts(g, W, T, D, mapId, path) {
  const R = rng(mapId.length * 6151 + 2 + (W.diff || 0) * 1013), H = T.hub;
  const nest = (x, z) => { const y = T.raw(x, z), n = M.sniperNest(R); n.position.set(x, y, z); n.rotation.y = R() * 6; g.add(n); W.lore.push({ x, z, kind: 'nest', silent: 1 }); };
  for (const q of D.hills || []) { const [a, b] = [q.pts[0], q.pts[q.pts.length - 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let d = 20; d < L - 10; d += 45) { const x = a[0] + (b[0] - a[0]) * d / L, z = a[1] + (b[1] - a[1]) * d / L; if (Math.abs(x) < BOUNDS - 8 && Math.abs(z) < BOUNDS - 8 && path.near(x, z).d > 14) nest(x, z); } }
  for (const m of D.mesas || []) if (Math.abs(m.x) < BOUNDS - 8 && Math.abs(m.z) < BOUNDS - 8) nest(m.x, m.z);
  // watchtowers: a platform 7 m up, reached by a stair
  let made = 0; for (let k = 0; k < 200 && made < 3; k++) {
    const s0 = path.len * (0.2 + 0.6 * R()), q = path.at(s0), sd = R() < 0.5 ? -1 : 1, x = q.x - q.tz * sd * (20 + R() * 10), z = q.z + q.tx * sd * (20 + R() * 10);
    if (Math.abs(x) > BOUNDS - 20 || Math.abs(z) > BOUNDS - 20 || path.near(x, z).d < 16 || T.chasm(x, z) < 0.99 || Math.hypot(x - H.x, z - H.z) < 50 || W.colliders.some(c => Math.hypot(c.x - x, c.z - z) < 10)) continue;
    let flat = true; const y = T.raw(x, z); for (const [dx, dz] of [[5, 0], [-5, 0], [0, 5], [0, -5], [12, 0], [-12, 0], [0, 12], [0, -12]]) if (Math.abs(T.raw(x + dx, z + dz) - y) > 1.5) flat = false; if (!flat) continue;
    const top = y + 7, ang = Math.atan2(q.x - x, q.z - z), dx = Math.sin(ang), dz = Math.cos(ang);     // the stair foot faces the track and climbs toward the tower
    T.plats.push({ x, z, hw: 2.4, y: top }); T.stairs.push({ x: x + dx * 15.6, z: z + dz * 15.6, cx: -dx, cz: -dz, len: 13.2, hw: 0.95, y0: y, y1: top });
    const t = M.watchtower(); t.position.set(x, y, z); t.rotation.y = ang; g.add(t); W.lore.push({ x, z, kind: 'tower', silent: 1 }); made++;
  }
}
