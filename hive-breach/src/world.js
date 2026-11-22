// The map: ground, the alien track, the hive at its start, the hub at its end, and scenery.
import * as THREE from 'three';
import * as M from './models.js';
import { MAPS, PATH_W, BOUNDS, TURRETS } from './data.js';

export class Path {
  constructor(pts) {
    this.pts = pts.map(p => ({ x: p[0], z: p[1] })); this.cum = [0];
    for (let i = 1; i < this.pts.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(this.pts[i].x - this.pts[i - 1].x, this.pts[i].z - this.pts[i - 1].z));
    this.len = this.cum[this.cum.length - 1];
  }
  // point at distance s along the track, with its direction
  at(s) {
    s = Math.max(0, Math.min(this.len, s)); let i = 1; while (i < this.cum.length - 1 && this.cum[i] < s) i++;
    const a = this.pts[i - 1], b = this.pts[i], L = this.cum[i] - this.cum[i - 1], f = L ? (s - this.cum[i - 1]) / L : 0;
    return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, tx: (b.x - a.x) / (L || 1), tz: (b.z - a.z) / (L || 1) };
  }
  // closest point of the track to (x, z)
  near(x, z) {
    let best = { d: 1e9, s: 0, tx: 1, tz: 0 };
    for (let i = 1; i < this.pts.length; i++) {
      const a = this.pts[i - 1], b = this.pts[i], dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz, L = Math.sqrt(L2);
      const f = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L2)), px = a.x + dx * f, pz = a.z + dz * f, d = Math.hypot(x - px, z - pz);
      if (d < best.d) best = { d, s: this.cum[i - 1] + L * f, tx: dx / L, tz: dz / L, x: px, z: pz };
    }
    return best;
  }
}

export function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// Where things may be built. Returns '' when fine, or the reason it is not.
export function placeError(kind, x, z, path, turrets, hubP, hiveP) {
  const T = TURRETS[kind], n = path.near(x, z);
  if (Math.abs(x) > BOUNDS - 3 || Math.abs(z) > BOUNDS - 3) return 'Too close to the edge';
  if (Math.hypot(x - hubP.x, z - hubP.z) < 10) return 'Too close to the hub';
  if (Math.hypot(x - hiveP.x, z - hiveP.z) < 11) return 'Too close to the hive';
  if (T.onPath) { if (n.d > PATH_W / 2) return 'Barricades go across the alien track'; if (n.s < 14 || n.s > path.len - 14) return 'Too close to the end of the track'; for (const t of turrets) if (t.kind === 'barricade' && Math.abs(t.s - n.s) < 6) return 'Another barricade is too close'; return ''; }
  if (!T.anyPlace && n.d < PATH_W / 2 + 1.2) return 'Not on the alien track';
  for (const t of turrets) if (t.kind !== 'barricade' && Math.hypot(t.x - x, t.z - z) < 2.6) return 'Too close to another turret';
  return '';
}

export function buildWorld(scene, mapId) {
  const D = MAPS[mapId], path = new Path(D.pts), W = { def: D, id: mapId, path, colliders: [], group: new THREE.Group() };
  scene.add(W.group); const g = W.group;
  scene.background = new THREE.Color(D.sky); scene.fog = new THREE.Fog(D.fog, D.fogD[0], D.fogD[1]);
  const hemi = new THREE.HemisphereLight(D.sky, D.amb, 1.1); g.add(hemi);
  const sun = new THREE.DirectionalLight(D.sun, 2.2); sun.position.set(40, 70, 25); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -75, right: 75, top: 75, bottom: -75, near: 10, far: 200 }); g.add(sun, sun.target);

  // ground, with a checker of two shades so movement reads
  const gr = new THREE.PlaneGeometry(BOUNDS * 2 + 80, BOUNDS * 2 + 80, 40, 40), col = [], c1 = new THREE.Color(D.ground), c2 = new THREE.Color(D.ground2), r = rng(7);
  const pos = gr.attributes.position; for (let i = 0; i < pos.count; i++) { const c = c1.clone().lerp(c2, r() * 0.6); col.push(c.r, c.g, c.b); }
  gr.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const ground = new THREE.Mesh(gr, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; g.add(ground);

  // the track: a flat strip per leg and a disc at each bend, plus glowing edge markers
  const pm = M.mat(D.path, { r: 1 }), em = M.mat(0xff6020, { e: 0xff4010, ei: 1.5 });
  for (let i = 1; i < path.pts.length; i++) {
    const a = path.pts[i - 1], b = path.pts[i], L = Math.hypot(b.x - a.x, b.z - a.z), m = new THREE.Mesh(new THREE.PlaneGeometry(PATH_W, L), pm);
    m.rotation.x = -Math.PI / 2; m.rotation.z = Math.atan2(b.x - a.x, b.z - a.z) + Math.PI; m.position.set((a.x + b.x) / 2, 0.03, (a.z + b.z) / 2); m.receiveShadow = true; g.add(m);
    const tx = (b.x - a.x) / L, tz = (b.z - a.z) / L;
    for (let d = 2; d < L - 1; d += 5) for (const s of [-1, 1]) { const q = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.3), em); q.position.set(a.x + tx * d - tz * s * (PATH_W / 2 + 0.3), 0.06, a.z + tz * d + tx * s * (PATH_W / 2 + 0.3)); g.add(q); }
  }
  for (const p of path.pts) { const m = new THREE.Mesh(new THREE.CircleGeometry(PATH_W / 2, 16), pm); m.rotation.x = -Math.PI / 2; m.position.set(p.x, 0.035, p.z); m.receiveShadow = true; g.add(m); }
  // arrows painted on the track show which way the aliens come
  const am = M.mat(0xffffff, { op: 0.25, e: 0x404040 });
  for (let s = 12; s < path.len - 10; s += 16) { const p = path.at(s), a = new THREE.Mesh(new THREE.CircleGeometry(1.1, 3), am); a.rotation.x = -Math.PI / 2; a.rotation.z = Math.atan2(p.tx, p.tz) - Math.PI / 2; a.position.set(p.x, 0.05, p.z); g.add(a); }

  const s0 = path.pts[0], s1 = path.pts[path.pts.length - 1];
  W.hiveP = { x: s0.x, z: s0.z }; W.hubP = { x: s1.x, z: s1.z };
  const hv = M.hive(); hv.position.set(s0.x, 0, s0.z); g.add(hv); W.hive = hv; W.colliders.push({ x: s0.x, z: s0.z, r: 6 });
  const hb = M.hub(); hb.position.set(s1.x, 0, s1.z); g.add(hb); W.hub = hb; W.colliders.push({ x: s1.x, z: s1.z, r: 7.6 });
  // where marines appear: beside the hub, on the side away from the track
  const pe = path.at(path.len - 1); W.spawn = { x: s1.x + pe.tx * 13, z: s1.z + pe.tz * 13 };
  if (Math.abs(W.spawn.x) > BOUNDS - 4 || Math.abs(W.spawn.z) > BOUNDS - 4) W.spawn = { x: s1.x - pe.tz * 13, z: s1.z + pe.tx * 13 };

  // scenery, kept off the track
  const R = rng(mapId.length * 991 + 3);
  for (let i = 0; i < 70; i++) {
    const x = (R() * 2 - 1) * (BOUNDS + 20), z = (R() * 2 - 1) * (BOUNDS + 20), n = path.near(x, z), out = Math.abs(x) > BOUNDS - 2 || Math.abs(z) > BOUNDS - 2;
    if (n.d < PATH_W + 4 && !out) continue; if (Math.hypot(x - W.hubP.x, z - W.hubP.z) < 14 || Math.hypot(x - W.hiveP.x, z - W.hiveP.z) < 12) continue;
    if (!out && R() < 0.55) continue;       // keep most of the field open for building
    const kind = !out && R() < 0.3 ? (R() < 0.5 ? 'crate' : 'tower') : D.prop, p = M.prop(kind, R); p.position.set(x, 0, z); p.rotation.y = R() * 6; g.add(p);
    if (!out) W.colliders.push({ x, z, r: kind === 'tower' ? 2.2 : kind === 'crate' ? 1.1 : kind === 'tree' ? 0.7 : 1.6 });
  }
  // a low wall around the battlefield
  const wm = M.mat(0x4a525a, { m: 0.3 });
  for (const s of [-1, 1]) { const a = new THREE.Mesh(new THREE.BoxGeometry(BOUNDS * 2, 2, 1), wm); a.position.set(0, 1, s * BOUNDS); g.add(a); const b = new THREE.Mesh(new THREE.BoxGeometry(1, 2, BOUNDS * 2), wm); b.position.set(s * BOUNDS, 1, 0); g.add(b); }
  return W;
}
