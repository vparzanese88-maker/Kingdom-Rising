// Kingdom Rising 3D — the small life of the land, around wherever you are: butterflies over the meadows,
// dragonflies darting above rivers and ponds, flocks of birds wheeling overhead (gulls by the sea, crows
// inland), squirrels scampering between trees and up their trunks, and fireflies over the water at night.
// Everything lives in a ring around the camera and is quietly moved when you walk away.
import { THREE, K3, TS, PX, TILE } from './core.js';
import { geo, T } from './geo.js';

const KR = window.KR, W = KR.W, D = KR.D, G = KR.G;
const root = new THREE.Group(); root.name = 'wildlife'; K3.scene.add(root);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const rnd = K3.rng(20251);
const R = () => rnd();

// ---- shapes ----
function wingGeom(w, h, sweep) { // a wing hinged on the x = 0 edge, spreading toward +x
  const g = new THREE.BufferGeometry();
  const p = [0, 0, -h * 0.4, w, 0, -h * 0.5 - sweep, w * 0.85, 0, h * 0.35, 0, 0, h * 0.35];
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals(); return g;
}
const bodyGeom = (l, r) => { const g = new THREE.CapsuleGeometry(r, l, 2, 6); g.rotateX(Math.PI / 2); return g; };
const lam = (o = {}) => new THREE.MeshLambertMaterial(Object.assign({ side: THREE.DoubleSide }, o));

// an instanced swarm: body + left wing + right wing, each its own InstancedMesh with per-instance colour
function swarm(n, body, wing, matBody, matWing) {
  const b = new THREE.InstancedMesh(body, matBody, n), l = new THREE.InstancedMesh(wing, matWing, n), r = new THREE.InstancedMesh(wing, matWing, n);
  for (const m of [b, l, r]) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.count = 0; root.add(m); }
  return { b, l, r, n, list: [] };
}
function place(S, i, x, y, z, yaw, pitch, flap, scale) {
  _q.setFromEuler(_e.set(pitch, yaw, 0, 'YXZ')); _s.setScalar(scale); _m.compose(_p.set(x, y, z), _q, _s); S.b.setMatrixAt(i, _m);
  for (const [mesh, side] of [[S.r, 1], [S.l, -1]]) { _q.setFromEuler(_e.set(pitch, yaw, side * flap, 'YXZ')); _s.set(side * scale, scale, scale); _m.compose(_p.set(x, y, z), _q, _s); mesh.setMatrixAt(i, _m); }
}
function finish(S, n) { for (const m of [S.b, S.l, S.r]) { m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; } }

const BUTTER = swarm(40, bodyGeom(0.05, 0.012), wingGeom(0.07, 0.09, 0.02), lam({ color: 0x2a2018 }), lam({ color: 0xffffff }));
const DRAGON = swarm(18, bodyGeom(0.11, 0.008), wingGeom(0.09, 0.025, 0.01), lam({ color: 0xffffff, emissive: 0x081818 }), lam({ color: 0xd8f0ff, transparent: true, opacity: 0.55 }));
const BIRDS = swarm(36, bodyGeom(0.22, 0.07), wingGeom(0.42, 0.22, 0.12), lam({ color: 0xffffff }), lam({ color: 0xffffff }));
const BUTTER_COLS = ['#ffd84a', '#ff8a2a', '#f0f0ff', '#7ab8ff', '#ff6ab8', '#c8ff7a', '#ffb0e0', '#a070ff'];
const FLIES = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 6, 4), new THREE.MeshBasicMaterial({ color: 0xd8ff7a, toneMapped: false }), 40);
FLIES.instanceMatrix.setUsage(THREE.DynamicDrawUsage); FLIES.frustumCulled = false; FLIES.count = 0; root.add(FLIES);

// ---- where things can live ----
const tileAt = (x, z) => W.tile(Math.floor(x / TILE), Math.floor(z / TILE));
const isWater = (t) => t === T.WATER || t === T.DEEP;
const meadow = (t) => t === T.GRASS || t === T.PLAINS || t === T.DGRASS || t === T.FOREST || t === T.FLOWERS;
const regionAt = (x, z) => D.REGIONS[W.regionAt(Math.floor(x / TILE), Math.floor(z / TILE))] || {};
function findSpot(cx, cz, rMin, rMax, ok, tries = 14) {
  for (let k = 0; k < tries; k++) { const a = R() * 6.283, d = rMin + R() * (rMax - rMin); const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; if (ok(tileAt(x, z), x, z)) return [x, z]; }
  return null;
}
const ground = (x, z) => geo.groundT(x / TILE, z / TILE);
const waterY = (x, z) => { const w = geo.waterAt(x / PX, z / PX); return isNaN(w) ? ground(x, z) : w; };

// ---- butterflies: flutter about in the sun over grass and flowers ----
function updButterflies(dt, cam, day) {
  const L = BUTTER.list; const want = day > 0.4 ? 26 : 0;
  while (L.length < want) { const s = findSpot(cam.x, cam.z, 4, 34, (t) => meadow(t)); if (!s) break; L.push({ x: s[0], z: s[1], y: 0, hx: s[0], hz: s[1], a: R() * 6.28, sp: 0.6 + R() * 0.6, ph: R() * 10, col: BUTTER_COLS[Math.floor(R() * BUTTER_COLS.length)], h: 0.5 + R() * 1.2, sc: 1.5 + R() * 0.8 }); }
  if (L.length > want) L.length = want;
  let n = 0;
  for (const b of L) {
    if (Math.hypot(b.x - cam.x, b.z - cam.z) > 46) { const s = findSpot(cam.x, cam.z, 6, 30, (t) => meadow(t)); if (s) { b.x = b.hx = s[0]; b.z = b.hz = s[1]; } }
    b.ph += dt; b.a += (Math.sin(b.ph * 0.9) * 1.6 + (Math.atan2(b.hz - b.z, b.hx - b.x) - b.a) * 0.15) * dt;
    b.x += Math.cos(b.a) * b.sp * dt; b.z += Math.sin(b.a) * b.sp * dt;
    const gy = ground(b.x, b.z); b.y = gy + b.h + Math.sin(b.ph * 2.3) * 0.25;
    const flap = Math.sin(b.ph * 26) * 1.1 + 0.2;
    place(BUTTER, n, b.x, b.y, b.z, -b.a + Math.PI / 2, 0.15, flap, b.sc);
    BUTTER.l.setColorAt(n, _c.set(b.col)); BUTTER.r.setColorAt(n, _c.set(b.col)); n++;
  }
  finish(BUTTER, n);
}
// ---- dragonflies: hover and dart low over water ----
function updDragonflies(dt, cam, day) {
  const L = DRAGON.list; const want = day > 0.3 ? 14 : 0;
  while (L.length < want) { const s = findSpot(cam.x, cam.z, 3, 30, (t, x, z) => isWater(t) && !regionAt(x, z).dungeon && regionAt(x, z).biome !== 'ocean', 24); if (!s) break; L.push({ x: s[0], z: s[1], hx: s[0], hz: s[1], a: R() * 6.28, t: 0, dart: 0, ph: R() * 10, col: ['#3ab8d8', '#4ad86a', '#d84a3a', '#5a6ad8'][Math.floor(R() * 4)] }); }
  if (L.length > want) L.length = want;
  let n = 0;
  for (const d of L) {
    if (Math.hypot(d.x - cam.x, d.z - cam.z) > 44) { L.splice(L.indexOf(d), 1); break; }
    d.ph += dt; d.t -= dt;
    if (d.t <= 0) { d.t = 0.6 + R() * 1.8; d.a = R() * 6.28; d.dart = 2.5 + R() * 3; if (Math.hypot(d.x - d.hx, d.z - d.hz) > 6) d.a = Math.atan2(d.hz - d.z, d.hx - d.x); }
    d.dart *= Math.exp(-dt * 3.5);
    const nx = d.x + Math.cos(d.a) * d.dart * dt, nz = d.z + Math.sin(d.a) * d.dart * dt; if (isWater(tileAt(nx, nz))) { d.x = nx; d.z = nz; } else d.t = 0;
    const y = waterY(d.x, d.z) + 0.45 + Math.sin(d.ph * 3) * 0.08;
    place(DRAGON, n, d.x, y, d.z, -d.a + Math.PI / 2, 0, Math.sin(d.ph * 60) * 0.5, 1.4);
    DRAGON.b.setColorAt(n, _c.set(d.col)); n++;
  }
  finish(DRAGON, n);
}
// ---- birds: flocks wheeling overhead; gulls by the sea, crows and swallows inland ----
const flocks = [];
function updBirds(dt, cam, day) {
  const want = day > 0.25 ? 4 : 0;
  while (flocks.length < want) {
    const a = R() * 6.28, d = 10 + R() * 45; const x = cam.x + Math.cos(a) * d, z = cam.z + Math.sin(a) * d;
    const sea = regionAt(x, z).biome === 'ocean' || (geo.waterAt(x / PX, z / PX) === 0);
    const near = W.cityData && Object.values(W.cityData).some((cd) => cd && cd.cx != null && Math.hypot(x / TILE - cd.cx, z / TILE - cd.cy) < cd.R + 30);
    const kind = sea || (near && R() < 0.5) ? 'gull' : R() < 0.5 ? 'crow' : 'swallow';
    const n = kind === 'gull' ? 3 + Math.floor(R() * 4) : kind === 'swallow' ? 6 + Math.floor(R() * 5) : 4 + Math.floor(R() * 4);
    flocks.push({ cx: x, cz: z, h: 9 + R() * 18, r: 8 + R() * 14, w: (R() < 0.5 ? -1 : 1) * (0.18 + R() * 0.2), t: R() * 10, kind, birds: Array.from({ length: n }, (_, i) => ({ o: i * 0.42 + R() * 0.2, dr: (R() - 0.5) * 6, dh: (R() - 0.5) * 4, ph: R() * 10 })) });
  }
  if (flocks.length > want) flocks.length = want;
  let n = 0;
  for (const F of flocks) {
    if (Math.hypot(F.cx - cam.x, F.cz - cam.z) > 140) { F.cx = cam.x + (R() - 0.5) * 120; F.cz = cam.z + (R() - 0.5) * 120; }
    F.t += dt * F.w; F.cx += Math.cos(F.t * 0.3) * dt * 1.5; F.cz += Math.sin(F.t * 0.27) * dt * 1.5;
    const gy = ground(F.cx, F.cz);
    for (const b of F.birds) {
      if (n >= BIRDS.n) break;
      const a = F.t - b.o * Math.sign(F.w); const r = F.r + b.dr; b.ph += dt;
      const x = F.cx + Math.cos(a) * r, z = F.cz + Math.sin(a) * r, y = Math.max(gy, 0) + F.h + b.dh + Math.sin(b.ph * 0.7) * 1.2;
      const yaw = -a - (F.w > 0 ? 0 : Math.PI); const glide = F.kind === 'gull' ? Math.sin(b.ph * 0.5) > 0.3 : false;
      const flap = glide ? 0.12 : Math.sin(b.ph * (F.kind === 'swallow' ? 22 : F.kind === 'gull' ? 7 : 10)) * 0.75;
      place(BIRDS, n, x, y, z, yaw, F.w > 0 ? 0.08 : -0.08, flap, F.kind === 'gull' ? 1.25 : F.kind === 'swallow' ? 0.6 : 1.0);
      const col = F.kind === 'gull' ? '#f2f2ee' : F.kind === 'crow' ? '#1a1a1e' : '#2a3a5a';
      BIRDS.b.setColorAt(n, _c.set(col)); BIRDS.l.setColorAt(n, _c.set(F.kind === 'gull' ? '#d8dce0' : col)); BIRDS.r.setColorAt(n, _c.set(F.kind === 'gull' ? '#d8dce0' : col)); n++;
    }
  }
  finish(BIRDS, n);
}
// ---- squirrels: dash from tree to tree and scurry up the trunks ----
let squirrelMesh = null;
function makeSquirrel() {
  if (!squirrelMesh) {
    const g = new THREE.Group(); const fur = lam({ color: 0x9a4a22, side: THREE.FrontSide }), belly = lam({ color: 0xe8c8a0, side: THREE.FrontSide });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), fur); body.scale.set(0.8, 0.75, 1.3); body.position.y = 0.1; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), fur); head.position.set(0, 0.16, 0.12); g.add(head);
    for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.04, 4), fur); ear.position.set(s * 0.025, 0.21, 0.11); g.add(ear); }
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), belly); chest.position.set(0, 0.08, 0.08); g.add(chest);
    const tail = new THREE.Group(); tail.position.set(0, 0.12, -0.11); g.add(tail);
    for (let k = 0; k < 5; k++) { const seg = new THREE.Mesh(new THREE.SphereGeometry(0.06 - k * 0.004, 6, 5), fur); seg.position.set(0, k * 0.055, -Math.sin(k * 0.6) * 0.05); seg.scale.set(0.8, 1.2, 0.9); tail.add(seg); }
    g.userData.tail = tail; squirrelMesh = g;
  }
  const m = squirrelMesh.clone(); m.userData.tail = m.children[m.children.length - 1]; root.add(m); return m;
}
const squirrels = [];
let treeT = 0, trees = [];
const TREES = new Set(['oak', 'elmwood', 'darkoak', 'birch', 'willow', 'pine', 'snowpine']);
function nearTrees(cam) {
  const tx = cam.x / TILE, tz = cam.z / TILE; const out = [];
  for (const d of W.decor) { if (!TREES.has(d.kind) || (d.cutUntil && d.cutUntil > G.now)) continue; const dx = d.tx + 0.5 - tx, dz = d.ty + 0.5 - tz; if (dx * dx + dz * dz < 26 * 26) out.push(d); }
  return out;
}
function updSquirrels(dt, cam, day) {
  treeT -= dt; if (treeT <= 0) { treeT = 2; trees = nearTrees(cam); }
  const want = day > 0.3 && trees.length > 3 ? Math.min(6, Math.floor(trees.length / 4)) : 0;
  while (squirrels.length < want) { const d = trees[Math.floor(R() * trees.length)]; const x = (d.tx + 0.5) * TILE + 0.4, z = (d.ty + 0.5) * TILE; squirrels.push({ m: makeSquirrel(), x, z, y: ground(x, z), tree: d, st: 'sit', t: 1 + R() * 2, climb: 0, a: R() * 6.28 }); }
  while (squirrels.length > want) { const s = squirrels.pop(); root.remove(s.m); }
  for (const s of squirrels) {
    s.t -= dt; const p = G.player; const scared = p && Math.hypot(p.x * PX - s.x, p.y * PX - s.z) < 3;
    const tx = (s.tree.tx + 0.5) * TILE, tz = (s.tree.ty + 0.5) * TILE;
    if (s.st === 'sit' && (s.t <= 0 || scared)) {
      if (scared || R() < 0.45) { s.st = 'up'; s.t = 1.2 + R() * 1.5; }
      else { const cand = trees.filter((d) => d !== s.tree && Math.hypot(d.tx - s.tree.tx, d.ty - s.tree.ty) < 9); if (cand.length) { s.tree = cand[Math.floor(R() * cand.length)]; s.st = 'run'; } else s.t = 1; }
    }
    if (s.st === 'run') {
      const gx = (s.tree.tx + 0.5) * TILE + 0.35, gz = (s.tree.ty + 0.5) * TILE; const dx = gx - s.x, dz = gz - s.z, dist = Math.hypot(dx, dz);
      if (dist < 0.15) { s.st = 'sit'; s.t = 1 + R() * 3; } else { const sp = 3.2 * dt; s.x += dx / dist * Math.min(sp, dist); s.z += dz / dist * Math.min(sp, dist); s.a = Math.atan2(dx, dz); }
      s.y = ground(s.x, s.z) + Math.abs(Math.sin(K3.time * 18)) * 0.06; s.climb = 0;
    } else if (s.st === 'up') { s.climb = Math.min(3.2, s.climb + dt * 1.8); s.t -= 0; if (s.climb >= 3.2) { s.st = 'perch'; s.t = 2 + R() * 4; } }
    else if (s.st === 'perch' && s.t <= 0) s.st = 'down';
    else if (s.st === 'down') { s.climb = Math.max(0, s.climb - dt * 1.4); if (s.climb <= 0) { s.st = 'sit'; s.t = 1 + R() * 2; } }
    const m = s.m;
    if (s.climb > 0) { // clinging to the trunk, head up (or down)
      const gx = tx + 0.28, gz = tz; m.position.set(gx, ground(tx, tz) + 0.3 + s.climb, gz); m.rotation.set(s.st === 'down' ? Math.PI / 2 : -Math.PI / 2, -Math.PI / 2, 0);
    } else { m.position.set(s.x, s.y, s.z); m.rotation.set(0, s.a, 0); }
    const tail = m.userData.tail; if (tail) tail.rotation.x = -0.3 + Math.sin(K3.time * (s.st === 'run' ? 12 : 3) + s.a) * 0.25;
  }
}
// ---- fireflies over water and meadows at night ----
const flies = [];
function updFireflies(dt, cam, night) {
  const want = night > 0.5 ? 40 : 0;
  while (flies.length < want) { const s = findSpot(cam.x, cam.z, 3, 24, (t) => isWater(t) || meadow(t)); if (!s) break; flies.push({ x: s[0], z: s[1], ph: R() * 10, h: 0.4 + R() * 1.6 }); }
  if (flies.length > want) flies.length = want;
  let n = 0;
  for (const f of flies) {
    if (Math.hypot(f.x - cam.x, f.z - cam.z) > 34) { const s = findSpot(cam.x, cam.z, 3, 24, (t) => isWater(t) || meadow(t)); if (s) { f.x = s[0]; f.z = s[1]; } }
    f.ph += dt; f.x += Math.sin(f.ph * 0.7) * dt * 0.4; f.z += Math.cos(f.ph * 0.6) * dt * 0.4;
    const glow = Math.max(0, Math.sin(f.ph * 1.7)) ** 3;
    _m.compose(_p.set(f.x, waterY(f.x, f.z) + f.h + Math.sin(f.ph) * 0.2, f.z), _q.identity(), _s.setScalar(0.2 + glow)); FLIES.setMatrixAt(n++, _m);
  }
  FLIES.count = n; FLIES.instanceMatrix.needsUpdate = true;
}
// once a frame (from the main loop's updaters)
K3.updaters.push((dt) => {
  if (!G.player || geo.dungeon || (W.realm && W.realm !== 'main' && W.realm !== 'tidesong')) { root.visible = false; return; }
  if (K3.settings.wildlife === false) { root.visible = false; return; }
  root.visible = true;
  const cam = K3.camera.position; const sky = K3.sky || {}; const night = sky.night || 0, day = 1 - night;
  const inside = W.buildingAt(G.player.x, G.player.y); if (inside) return;
  updButterflies(dt, cam, day); updDragonflies(dt, cam, day); updBirds(dt, cam, day); updSquirrels(dt, cam, day); updFireflies(dt, cam, night);
});
export const wildlife = { root };
