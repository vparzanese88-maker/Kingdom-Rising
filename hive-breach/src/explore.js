// After victory: reinforcements land, a VTOL picks the squad up and flies them to Forward Operating Base Valor,
// where they can roam the planet on foot, drive armed rovers and fly the VTOL.
import * as THREE from 'three';
import * as M from './models.js';
import { MAPS, ALIENS, CLASSES } from './data.js';
import { rng } from './world.js';

const B = M.B, C = M.C, S = M.S, mat = M.mat;
// ---------------------------------------------------------------- vehicles and ships
export function vtol() {
  const g = new THREE.Group(), hull = mat(0x4e5a64, { m: 0.5, r: 0.5 }), dark = mat(0x2a3036), glass = mat(0x80c8e8, { op: 0.6, m: 0.8, r: 0.1 }), stripe = mat(0xd09030);
  B(g, 2.6, 2.2, 8, hull, 0, 0, 0); B(g, 2.2, 1.4, 2.6, glass, 0, 0.6, -3.6); B(g, 2.0, 1.0, 1.4, dark, 0, -0.2, -4.6); B(g, 0.8, 1.6, 4.4, hull, 0, 0.6, 5.4); B(g, 4.4, 0.2, 1.4, hull, 0, 1.2, 7.2); B(g, 0.2, 2, 1.4, hull, 0, 2, 7.2);
  B(g, 2.62, 0.3, 3, stripe, 0, 0.9, 0.5); C(g, 0.12, 0.12, 1.6, dark, 0, -1.2, -4.4).rotation.x = Math.PI / 2;
  const rotors = [];
  for (const sd of [-1, 1]) { B(g, 3.4, 0.4, 1.6, hull, sd * 2.8, 0.6, -0.2); const nac = new THREE.Group(); nac.position.set(sd * 4.8, 0.8, -0.2); g.add(nac); C(nac, 0.75, 0.85, 2.6, dark, 0, 0, 0); S(nac, 0.5, 0x80c0ff, 0, -1.4, 0, 1, 0.4, 1, { e: 0x4080ff, ei: 2 });
    const rot = new THREE.Group(); rot.position.y = 1.5; nac.add(rot); for (let i = 0; i < 3; i++) { const bl = B(rot, 0.35, 0.06, 4.2, dark, 0, 0, 0); bl.rotation.y = i * 2.094; bl.position.set(Math.sin(i * 2.094) * 2, 0, Math.cos(i * 2.094) * 2); } rotors.push(rot); }
  for (const [x, z] of [[-1, -2.5], [1, -2.5], [-1, 2.5], [1, 2.5]]) B(g, 0.15, 0.8, 0.15, dark, x, -1.4, z);
  g.userData.rotors = rotors; return g;
}
export function rover() {
  const g = new THREE.Group(), hull = mat(0x5a6448, { m: 0.3, r: 0.7 }), dark = mat(0x22262a), wheel = mat(0x1a1a1a);
  B(g, 2.8, 1.1, 5.2, hull, 0, 1.2, 0); B(g, 2.4, 0.9, 1.8, mat(0x80c0e0, { op: 0.6, m: 0.7 }), 0, 1.9, -1.2); B(g, 2.9, 0.3, 5.4, dark, 0, 0.7, 0);
  const wheels = []; for (const z of [-1.8, 0, 1.8]) for (const sd of [-1, 1]) { const w = C(g, 0.6, 0.6, 0.45, wheel, sd * 1.6, 0.6, z); w.rotation.z = Math.PI / 2; wheels.push(w); }
  const tur = new THREE.Group(); tur.position.set(0, 2.1, 0.8); g.add(tur); C(tur, 0.7, 0.8, 0.3, dark, 0, 0, 0); B(tur, 1.6, 0.9, 0.12, hull, 0, 0.6, -0.5);
  const gun = new THREE.Group(); gun.position.y = 0.7; tur.add(gun); B(gun, 0.35, 0.35, 1.0, dark, 0, 0, 0); C(gun, 0.07, 0.07, 1.6, 0x333333, 0, 0.05, -1.2).rotation.x = Math.PI / 2; C(gun, 0.11, 0.11, 0.3, 0x333333, 0, 0.05, -1.95).rotation.x = Math.PI / 2; B(gun, 0.3, 0.4, 0.4, 0x4a5a3a, 0.35, -0.1, 0.1);
  S(g, 0.15, 0xffffcc, -1, 1.4, -2.65, 1, 1, 0.4, { e: 0xffffaa, ei: 2 }); S(g, 0.15, 0xffffcc, 1, 1.4, -2.65, 1, 1, 0.4, { e: 0xffffaa, ei: 2 });
  g.userData = { tur, gun, wheels }; return g;
}
export function transport() {
  const g = new THREE.Group(), hull = mat(0x5a646e, { m: 0.5, r: 0.5 }), dark = mat(0x2c3238);
  B(g, 14, 8, 36, hull, 0, 0, 0); B(g, 10, 4, 10, hull, 0, 4, -14); B(g, 8, 2.5, 3, mat(0x80c8e8, { op: 0.6 }), 0, 4.5, -19.2);
  for (const [x, z] of [[-9, -10], [9, -10], [-9, 12], [9, 12]]) { C(g, 2.6, 3, 6, dark, x, -1, z); S(g, 2, 0x80c0ff, x, -4.2, z, 1, 0.5, 1, { e: 0x4080ff, ei: 2.5 }); }
  B(g, 14.2, 1.2, 4, mat(0xd09030), 0, 2, 4); for (const [x, z] of [[-5, -12], [5, -12], [-5, 14], [5, 14]]) B(g, 0.8, 4, 0.8, dark, x, -5, z); return g;
}

// ---------------------------------------------------------------- Forward Operating Base Valor
const FOB_SIZE = 450;
export function buildFOB(scene, mapId) {
  const D = MAPS[mapId], R = rng(97), W = { def: Object.assign({}, D, { fogD: [140, 620] }), id: 'fob', fob: 1, colliders: [], group: new THREE.Group(), lore: [], shelters: [], hubP: { x: 0, z: 0 }, hiveP: { x: 9999, z: 9999 } };
  const g = W.group; scene.add(g); scene.background = new THREE.Color(D.sky); scene.fog = new THREE.Fog(D.fog, 140, 620);
  const hemi = new THREE.HemisphereLight(mapId === 'jungle' ? 0x506a80 : D.sky, D.amb, D.hemiI || 1.1); g.add(hemi); W.hemi = hemi;
  const sun = new THREE.DirectionalLight(D.sun, D.sunI || 2.2); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 10, far: 260 }); g.add(sun, sun.target); W.sun = sun;
  const sst = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const mesas = []; for (let i = 0; i < 14; i++) { const a = R() * 6.28, d = 160 + R() * 260; mesas.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, r: 14 + R() * 26, h: 10 + R() * 24 }); }
  const raw = (x, z) => { let h = 4 + 8 * Math.sin(x * 0.011 + 1) * Math.cos(z * 0.013) + 4 * Math.sin(x * 0.03 + z * 0.024) + 1.5 * Math.cos(x * 0.07 - z * 0.06) + 0.5 * Math.sin(x * 0.2 + z * 0.17);
    for (const m of mesas) { const u = Math.hypot(x - m.x, z - m.z) / m.r; h += m.h * sst(1.3, 0.9, u); }
    const out = Math.max(Math.abs(x), Math.abs(z)) - FOB_SIZE; if (out > 0) h += out * 1.5;
    return 2 + (h - 2) * sst(95, 140, Math.hypot(x, z)); };
  const T = W.T = { raw, craters: [], plats: [], stairs: [], tunnels: [], bridges: [] };
  T.ground = (x, z) => raw(x, z); T.top = T.ground; T.solid = (x, y, z) => y < raw(x, z); T.ceiling = () => 1e9; T.chasm = () => 1; T.ridge = () => 0; T.tunnelAt = () => null; T.bridgeAt = () => null;
  T.hubAt = (x, z) => Math.hypot(x, z) < 85 ? { yard: 1 } : null;
  T.ray = (o, d, max) => { for (let t = 0.8; t < max; t += 0.8) { const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t; if (y < raw(x, z)) return t; } return Infinity; };
  W.ground = T.ground; W.top = T.top;
  // land
  const SZ = FOB_SIZE * 2 + 200, N = 240, gr = new THREE.PlaneGeometry(SZ, SZ, N, N); gr.rotateX(-Math.PI / 2); const pos = gr.attributes.position, col = [], c1 = new THREE.Color(D.ground), c2 = new THREE.Color(D.ground2), cr = new THREE.Color(D.rock), pad = new THREE.Color(0x5a5e62);
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i), h = raw(x, z); pos.setY(i, h); const c = c1.clone().lerp(c2, 0.5 + 0.5 * Math.sin(x * 0.03 + Math.sin(z * 0.02) * 3)); const sl = Math.abs(raw(x + 2, z) - h) + Math.abs(raw(x, z + 2) - h); if (sl > 2) c.lerp(cr, Math.min(1, (sl - 2) * 0.4)); if (Math.hypot(x, z) < 88) c.lerp(pad, 0.55); col.push(c.r, c.g, c.b); }
  gr.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); gr.computeVertexNormals(); const ground = new THREE.Mesh(gr, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })); ground.receiveShadow = true; g.add(ground);
  // the base
  const wallM = mat(0x6a737c, { m: 0.3 }), dark = mat(0x343b42, { m: 0.4 }), stripe = mat(0xffc020, { e: 0x604000 }), green = mat(0x4a5a3a), blue = mat(0x2a4a8a), lamp = mat(0x80e0ff, { e: 0x40a0ff, ei: 2 });
  const box = (w, h, d, m, x, z, ry = 0, y = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, 2 + y + h / 2, z); b.rotation.y = ry; b.castShadow = b.receiveShadow = true; g.add(b); return b; };
  const block = (x, z, r, h) => W.colliders.push({ x, z, r, h, gy: 2 });
  // perimeter wall with four gates and guard towers
  for (let i = 0; i < 72; i++) { const a = (i + 0.5) / 72 * 6.283; if ([0, 1, 2, 3].some(k => Math.abs(((a - k * Math.PI / 2 + Math.PI) % 6.283 + 6.283) % 6.283 - Math.PI) < 0.1)) continue; box(2, 5, 7.6, wallM, Math.cos(a) * 85, Math.sin(a) * 85, -a); block(Math.cos(a) * 85, Math.sin(a) * 85, 3.4, 5); }
  for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283 + 0.39, x = Math.cos(a) * 88, z = Math.sin(a) * 88; const t = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3, 14, 8), wallM); t.position.set(x, 9, z); t.castShadow = true; g.add(t); const l = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), lamp); l.position.set(x, 16.6, z); g.add(l); block(x, z, 3, 14); }
  // command centre
  box(30, 10, 22, wallM, 0, 0); box(32, 1, 24, dark, 0, 0, 0, 10); box(12, 6, 10, wallM, 0, 0, 0, 11); box(12.4, 1.2, 10.4, stripe, 0, 0, 0, 13); block(0, 0, 14, 17);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 16, 6), dark); ant.position.set(4, 25, 2); g.add(ant); const dish = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 8, 0, 6.29, 0, 1), mat(0xd8dde2, { ds: true })); dish.position.set(-6, 20, -4); dish.rotation.x = 2.2; g.add(dish); W.dish = dish;
  // hangars (north), landing pads (east), motor pool (south), barracks (west)
  for (const x of [-26, 26]) { const h = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 30, 20, 1, true, 0, Math.PI), mat(0x7a848e, { ds: true, m: 0.4 })); h.rotation.set(Math.PI / 2, 0, Math.PI / 2); h.position.set(x, 2, -55); h.castShadow = true; g.add(h); box(24, 0.2, 30, dark, x, -55); block(x - 11, -55, 2, 10); block(x + 11, -55, 2, 10); }
  const pads = [[45, -20], [60, 5], [45, 30], [62, 40]]; W.pads = pads;
  for (const [x, z] of pads) { const p = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 0.3, 28), dark); p.position.set(x, 2.15, z); p.receiveShadow = true; g.add(p); const ring = new THREE.Mesh(new THREE.RingGeometry(7, 7.5, 32), stripe); ring.rotation.x = -Math.PI / 2; ring.position.set(x, 2.32, z); g.add(ring); }
  for (let i = 0; i < 6; i++) { const x = -40 + (i % 3) * 20, z = 45 + Math.floor(i / 3) * 18; box(14, 0.3, 10, dark, x, z); }
  for (let i = 0; i < 6; i++) { const x = -55, z = -30 + i * 14; box(10, 4.5, 11, green, x, z); box(10.6, 0.6, 11.6, dark, x, z, 0, 4.5); block(x, z, 6, 5); }
  // ammo dump, fuel tanks, flags, sandbags, crates
  for (let i = 0; i < 10; i++) box(1.4, 1, 1, green, 20 + (i % 5) * 1.6, 60 + Math.floor(i / 5) * 1.3, 0, (i % 3) * 0); block(23, 61, 5, 2);
  for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 8, 16), mat(0xd8dde2, { m: 0.5 })); t.rotation.z = Math.PI / 2; t.position.set(-30, 5, 70 + i * 7); g.add(t); block(-30, 70 + i * 7, 3.5, 6); }
  for (const [x, z] of [[-12, 16], [12, 16], [-12, -16], [12, -16]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 10, 6), dark); p.position.set(x, 7, z); g.add(p); const f = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.8), mat(0x2a4a8a, { ds: true })); f.position.set(x + 1.5, 11, z); g.add(f); }
  const L1 = new THREE.PointLight(0xc0e0ff, 40, 90); L1.position.set(0, 26, 0); g.add(L1);
  // the planet beyond: boulders, wrecks, rock spires
  for (let i = 0; i < 220; i++) { const a = R() * 6.28, d = 110 + R() * 330, x = Math.cos(a) * d, z = Math.sin(a) * d, y = raw(x, z), k = R(), m = k < 0.6 ? M.prop('boulder', R) : k < 0.8 ? M.prop(D.prop, R) : k < 0.9 ? M.spire(R, D.rock) : M.tank(R); m.position.set(x, y - 0.1, z); m.rotation.y = R() * 6; g.add(m); W.colliders.push({ x, z, r: 2, h: 3, gy: y }); }
  // stand-ins the battle code expects
  W.hub = M.hub(); W.hub.position.set(0, 2, 0); W.hub.visible = false; g.add(W.hub); W.hive = new THREE.Group(); W.healRing = new THREE.Mesh(new THREE.RingGeometry(1, 1.1, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })); W.hiveShield = new THREE.Mesh(new THREE.SphereGeometry(1), new THREE.MeshBasicMaterial({ visible: false })); W.hiveShield.visible = false;
  W.path = { near: () => ({ d: 999, s: 0, x: 0, z: 0, tx: 1, tz: 0 }), at: () => ({ x: 0, z: 0, tx: 1, tz: 0, y: 2 }), y: () => 2, len: 1, pts: [] };
  W.spawn = { x: 38, z: -6 };
  const mc = document.createElement('canvas'); mc.width = mc.height = 170; const mg = mc.getContext('2d'), im = mg.createImageData(170, 170);
  for (let j = 0; j < 170; j++) for (let i = 0; i < 170; i++) { const x = -FOB_SIZE + (i + 0.5) / 170 * FOB_SIZE * 2, z = -FOB_SIZE + (j + 0.5) / 170 * FOB_SIZE * 2, h = raw(x, z), o = (j * 170 + i) * 4, v = Math.max(20, Math.min(120, 40 + h * 3)); im.data[o] = v * 0.8; im.data[o + 1] = v; im.data[o + 2] = v * 1.1; im.data[o + 3] = 200; if (Math.hypot(x, z) < 88) { im.data[o] = 90; im.data[o + 1] = 140; im.data[o + 2] = 200; } }
  mg.putImageData(im, 0, 0); W.miniBg = mc; W.size = FOB_SIZE;
  return W;
}

// ---------------------------------------------------------------- driving, flying and the wild aliens out there
export class Explore {
  constructor(H) { this.H = H; this.vehs = []; this.wild = []; this.veh = null; this.hp = 100; this.nid = 1; this.engT = 0; }
  setup(W) {
    const { scene } = this.H; this.W = W;
    W.pads.forEach(([x, z], i) => { const m = vtol(); m.position.set(x, 2 + 2.2, z); m.rotation.y = -Math.PI / 2; scene.add(m); this.vehs.push({ kind: 'vtol', m, x, y: 2 + 2.2, z, yaw: -Math.PI / 2, vx: 0, vy: 0, vz: 0, id: i }); });
    for (let i = 0; i < 6; i++) { const x = -40 + (i % 3) * 20, z = 45 + Math.floor(i / 3) * 18, m = rover(); m.position.set(x, 2, z); scene.add(m); this.vehs.push({ kind: 'rover', m, x, y: 2, z, yaw: Math.PI, sp: 0, id: 10 + i }); }
    // marines on patrol round the base
    this.npcs = []; for (let i = 0; i < 14; i++) { const cls = Object.keys(CLASSES)[i % 6], m = M.marine(CLASSES[cls].color, cls); scene.add(m); const a = i / 14 * 6.28, r = 30 + (i % 3) * 18; this.npcs.push({ m, a, r, sp: 0.06 + (i % 4) * 0.02, t: Math.random() * 9 }); }
    // packs of wild aliens out on the plain
    const R = rng(55); for (let k = 0; k < 10; k++) { const a = R() * 6.28, d = 170 + R() * 230; for (let i = 0; i < 4 + (R() * 4 | 0); i++) this.spawnWild(R() < 0.2 ? 'brute' : R() < 0.3 ? 'spitter' : 'crawler', Math.cos(a) * d + (R() - 0.5) * 20, Math.sin(a) * d + (R() - 0.5) * 20); }
  }
  spawnWild(type, x, z) { const m = M.alien(type); this.H.scene.add(m); const A = ALIENS[type]; this.wild.push({ id: 'w' + this.nid++, wild: 1, type, mesh: m, x, z, y: this.W.T.raw(x, z), hp: A.hp * 2, mhp: A.hp * 2, home: { x, z }, t: Math.random() * 9, atk: 0 }); }
  hurt(a, d) { if (a.dead) return; a.hp -= d; a.pop = 0.1; if (a.hp <= 0) { a.dead = true; this.H.burst(a.x, a.y + 1, a.z, 0x60ff40, 14, 5, 0.8, 1.2); this.H.audio.sfx('kill', 0.6); this.H.scene.remove(a.mesh); this.kills = (this.kills || 0) + 1; } }
  splash(x, y, z, r, d) { this.H.boomFx(x, y, z, r * 0.7); for (const a of this.wild) if (!a.dead && Math.hypot(a.x - x, a.z - z) < r) this.hurt(a, d * (1 - Math.hypot(a.x - x, a.z - z) / r * 0.5)); }
  near() { const me = this.H.G.me; let best = null, bd = 6; for (const v of this.vehs) { const d = Math.hypot(v.x - me.x, v.z - me.z); if (d < bd && !v.taken) { bd = d; best = v; } } return best; }
  enter(v) { this.veh = v; v.taken = true; this.H.audio.sfx('place'); this.H.toast(v.kind === 'vtol' ? 'VTOL: W/S forward and back, A/D strafe, Space up, C down, mouse steers, click fires the nose cannon. E to get out.' : 'Rover: W/S drive, A/D steer, mouse aims the .50 cal, click fires. E to get out.', 6); }
  exit() { const v = this.veh, me = this.H.G.me; this.veh = null; v.taken = false; me.x = v.x + Math.cos(v.yaw) * 4; me.z = v.z - Math.sin(v.yaw) * 4; me.y = this.W.T.raw(me.x, me.z); me.vy = 0; if (v.kind === 'vtol' && v.y - this.W.T.raw(v.x, v.z) > 6) this.H.toast('You bailed out at height: watch the landing!', 3); }
  // runs every frame while exploring
  update(dt) {
    const H = this.H, me = H.G.me, T = this.W.T;
    for (const n of this.npcs) { n.a += n.sp * dt; n.t += dt * 6; const x = Math.cos(n.a) * n.r, z = Math.sin(n.a) * n.r; n.m.position.set(x, T.raw(x, z), z); n.m.rotation.y = -n.a + Math.PI; M.animMarine(n.m, n.t, 3); }
    if (this.W.dish) this.W.dish.rotation.z += dt * 0.3;
    for (const v of this.vehs) if (v.kind === 'vtol') { const spin = v === this.veh ? 30 : 0.5; for (const r of v.m.userData.rotors) r.rotation.y += dt * spin; }
    for (const a of this.wild) { if (a.dead) continue; const px = me.x, pz = me.z, d = Math.hypot(px - a.x, pz - a.z), A = ALIENS[a.type]; a.t += dt; a.atk -= dt;
      let tx = a.home.x + Math.sin(a.t * 0.2) * 12, tz = a.home.z + Math.cos(a.t * 0.17) * 12, sp = A.speed * 0.4; if (d < 45 && !(this.veh && this.veh.kind === 'vtol' && this.veh.y - T.raw(this.veh.x, this.veh.z) > 8)) { tx = px; tz = pz; sp = A.speed; }
      const dx = tx - a.x, dz = tz - a.z, dd = Math.hypot(dx, dz); if (dd > A.r + 1.2) { a.x += dx / dd * sp * dt; a.z += dz / dd * sp * dt; } else if (d < A.r + 1.6 && a.atk <= 0) { a.atk = 1; if (this.veh) H.audio.sfx('bite', 0.6); else { this.hp -= A.dmg * 0.6; H.hurtFlash(); } }
      a.y = T.raw(a.x, a.z); a.mesh.position.set(a.x, a.y, a.z); a.mesh.rotation.y = Math.atan2(-dx, -dz); a.pop = Math.max(0, (a.pop || 0) - dt); a.mesh.scale.setScalar(1 + a.pop * 1.4); M.animAlien(a.mesh, a.t * (d < 45 ? 1.5 : 0.6)); }
    if (this.wild.some(a => a.dead)) this.wild = this.wild.filter(a => !a.dead);
    if (this.wild.length < 25 && Math.random() < dt * 0.1) { const a = Math.random() * 6.28, d = 220 + Math.random() * 180; for (let i = 0; i < 4; i++) this.spawnWild('crawler', Math.cos(a) * d + i * 3, Math.sin(a) * d); }
    if (T.hubAt(me.x, me.z)) this.hp = Math.min(100, this.hp + 20 * dt); if (this.hp <= 0) { this.hp = 100; if (this.veh) this.exit(); me.x = this.W.spawn.x; me.z = this.W.spawn.z; me.y = 3; H.toast('You were overrun and evacuated back to the base.', 4); }
    const u = !this.veh && this.near(); if (u) H.prompt(`<b>${H.keyName(H.KB.defense)}</b> ${u.kind === 'vtol' ? 'Fly the VTOL' : 'Drive the rover (.50 cal turret)'}`);
    if (H.hits[H.KB.defense]) { if (this.veh) this.exit(); else if (u) this.enter(u); }
    for (const v of this.vehs) { v.m.position.set(v.x, v.y, v.z); v.m.rotation.y = v.yaw; }
  }
  // controls while in a vehicle; sets the camera; returns true so the marine's own walking is skipped
  drive(dt) {
    const H = this.H, me = H.G.me, v = this.veh, k = H.keys, KB = H.KB, T = this.W.T, cam = H.camera; v.cd = (v.cd || 0) - dt;
    if (v.kind === 'rover') {
      const ac = (k[KB.forward] ? 14 : 0) - (k[KB.back] ? 18 : 0); v.sp += ac * dt; v.sp *= Math.pow(0.6, dt); v.sp = Math.max(-8, Math.min(24, v.sp)); const steer = ((k[KB.left] ? 1 : 0) - (k[KB.right] ? 1 : 0)) * Math.min(1, Math.abs(v.sp) / 6) * Math.sign(v.sp || 1);
      v.yaw += steer * 1.4 * dt; const nx = v.x - Math.sin(v.yaw) * v.sp * dt, nz = v.z - Math.cos(v.yaw) * v.sp * dt; let hit = false; for (const c of this.W.colliders) if (Math.hypot(nx - c.x, nz - c.z) < c.r + 2) { hit = true; break; } if (hit) { if (Math.abs(v.sp) > 10) H.audio.sfx('boom', 0.3); v.sp *= -0.3; } else { v.x = nx; v.z = nz; }
      v.y = T.raw(v.x, v.z); const fy = T.raw(v.x - Math.sin(v.yaw) * 2, v.z - Math.cos(v.yaw) * 2) - T.raw(v.x + Math.sin(v.yaw) * 2, v.z + Math.cos(v.yaw) * 2); v.m.rotation.order = 'YXZ'; v.m.rotation.x = Math.atan2(fy, 4);
      for (const w of v.m.userData.wheels) w.rotation.x += v.sp * dt * 1.6; const u = v.m.userData; u.tur.rotation.y = me.yaw - v.yaw; u.gun.rotation.x = Math.max(-0.3, me.pitch * 0.9);
      const ox = Math.sin(me.yaw) * 9, oz = Math.cos(me.yaw) * 9; cam.position.set(v.x + ox, v.y + 5 - me.pitch * 4, v.z + oz); cam.rotation.set(me.pitch * 0.8 - 0.12, me.yaw, 0, 'YXZ');
      if (H.mouseL() && v.cd <= 0) { v.cd = 0.11; this.fire(v, 'cal50'); } this.engine(dt, 0.5 + Math.abs(v.sp) / 24);
    } else {
      const f = (k[KB.forward] ? 1 : 0) - (k[KB.back] ? 1 : 0), st = (k[KB.right] ? 1 : 0) - (k[KB.left] ? 1 : 0), up = (k[KB.jump] ? 1 : 0) - (k[KB.kneel] ? 1 : 0); v.yaw = me.yaw;
      v.vx += (-Math.sin(v.yaw) * f + Math.cos(v.yaw) * st) * 26 * dt; v.vz += (-Math.cos(v.yaw) * f - Math.sin(v.yaw) * st) * 26 * dt; v.vy += up * 16 * dt; const drag = Math.pow(0.45, dt); v.vx *= drag; v.vz *= drag; v.vy *= Math.pow(0.3, dt);
      v.x += v.vx * dt; v.z += v.vz * dt; v.y += v.vy * dt; const gy = T.raw(v.x, v.z) + 2.2; if (v.y < gy) { v.y = gy; v.vy = Math.max(0, v.vy); v.vx *= 0.9; v.vz *= 0.9; } v.y = Math.min(v.y, gy + 220);
      v.x = Math.max(-this.W.size, Math.min(this.W.size, v.x)); v.z = Math.max(-this.W.size, Math.min(this.W.size, v.z)); v.m.rotation.order = 'YXZ'; v.m.rotation.x = -f * 0.18; v.m.rotation.z = -st * 0.25;
      cam.position.set(v.x + Math.sin(v.yaw) * 16, v.y + 5 - me.pitch * 6, v.z + Math.cos(v.yaw) * 16); cam.rotation.set(me.pitch * 0.8 - 0.15, v.yaw, 0, 'YXZ');
      if (H.mouseL() && v.cd <= 0) { v.cd = 0.16; this.fire(v, 'cannon'); } this.engine(dt, 0.8);
      if (Math.random() < 0.3 && v.y - gy < 10) H.burst(v.x + (Math.random() - 0.5) * 10, T.raw(v.x, v.z) + 0.3, v.z + (Math.random() - 0.5) * 10, this.W.def.ground, 2, 4, 0.8, 2);
    }
    me.x = v.x; me.z = v.z; me.y = v.y; return true;
  }
  engine(dt, pitch) { this.engT -= dt; if (this.engT <= 0) { this.engT = this.veh.kind === 'vtol' ? 0.11 : 0.09 / pitch; this.H.audio.sfx(this.veh.kind === 'vtol' ? 'rotor' : 'engine', 0.35); } }
  fire(v, kind) {
    const H = this.H, cam = H.camera, o = new THREE.Vector3(), d = new THREE.Vector3(); cam.getWorldPosition(o); cam.getWorldDirection(d); d.x += (Math.random() - 0.5) * 0.01; d.y += (Math.random() - 0.5) * 0.01; d.normalize();
    const mz = kind === 'cal50' ? [v.x - Math.sin(H.G.me.yaw) * 2.4, v.y + 2.9, v.z - Math.cos(H.G.me.yaw) * 2.4] : [v.x - Math.sin(v.yaw) * 5, v.y - 1.2, v.z - Math.cos(v.yaw) * 5];
    let best = null, bt = this.W.T.ray(o, d, 400); for (const a of this.wild) { const A = ALIENS[a.type], cx = a.x - o.x, cy = a.y + A.h * 0.6 - o.y, cz = a.z - o.z, t = cx * d.x + cy * d.y + cz * d.z; if (t < 0 || t > bt) continue; const d2 = cx * cx + cy * cy + cz * cz - t * t; if (d2 < (A.r * 1.3) ** 2) { bt = t; best = a; } }
    const end = [o.x + d.x * Math.min(bt, 400), o.y + d.y * Math.min(bt, 400), o.z + d.z * Math.min(bt, 400)];
    H.tracer(mz, end, kind === 'cal50' ? 0xffb060 : 0x80d0ff, 0.06, kind === 'cal50' ? 0.09 : 0.14); H.flashAt(mz, 1.6); H.audio.gun(kind === 'cal50' ? 'sniper' : 'rifle', 0.8, 1.6, 0); H.shake(0.15);
    if (kind === 'cannon') { if (bt < 400) this.splash(end[0], end[1], end[2], 5, 120); } else if (best) this.hurt(best, 60); else if (bt < 400) H.burst(end[0], end[1] + 0.2, end[2], this.W.def.ground, 4, 3, 0.4, 1.4);
  }
}

// ---------------------------------------------------------------- the victory cinematic
export function cinematic(H, done) {
  const { scene, camera } = H, W = H.G.W, B0 = W.size || 180, ships = [];
  for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28 + 0.3, x = Math.cos(a) * (B0 + 80), z = Math.sin(a) * (B0 + 80), m = transport(); m.position.set(x, 320 + i * 20, z); m.rotation.y = -a; scene.add(m); ships.push({ m, x, z, t0: 1 + i * 0.6, y0: 320 + i * 20 }); }
  const heli = vtol(); scene.add(heli); const me = H.G.me, hs = { x: me.x + 300, y: me.y + 120, z: me.z - 200 };
  const start = performance.now(), cam0 = camera.position.clone(); H.banner('VICTORY', 'Reinforcements are landing across the planet'); H.audio.sfx('win');
  const step = () => {
    const t = (performance.now() - start) / 1000;
    for (const s of ships) { const f = Math.max(0, Math.min(1, (t - s.t0) / 6)), e = 1 - (1 - f) * (1 - f), gy = W.T.raw ? W.T.raw(Math.max(-B0, Math.min(B0, s.x)), Math.max(-B0, Math.min(B0, s.z))) : 0; s.m.position.y = s.y0 + (gy + 9 - s.y0) * e; if (f > 0 && f < 1 && Math.random() < 0.6) H.burst(s.m.position.x + (Math.random() - 0.5) * 16, s.m.position.y - 6, s.m.position.z + (Math.random() - 0.5) * 30, 0x80c0ff, 2, 3, 0.4, 2); if (f >= 1 && !s.landed) { s.landed = 1; H.burst(s.x, gy + 1, s.z, W.def.ground, 30, 8, 1.2, 3); H.audio.gun('artillery', 0.5, 1, 0.6); } }
    if (t < 5) { const f = t / 5, e = f * f * (3 - 2 * f); camera.position.set(cam0.x + (0 - cam0.x) * e, cam0.y + (150 - cam0.y) * e, cam0.z + (B0 + 60 - cam0.z) * e); camera.lookAt(0, 0, 0); }
    else if (t < 7) camera.lookAt(0, 0, 0);
    // the VTOL comes in to the squad
    const hf = Math.max(0, Math.min(1, (t - 6) / 5)), he = 1 - (1 - hf) ** 3; heli.position.set(hs.x + (me.x - hs.x) * he, hs.y + (me.y + 6 - hs.y) * he, hs.z + (me.z + 6 - hs.z) * he); heli.lookAt(me.x, heli.position.y, me.z); heli.rotateY(Math.PI); for (const r of heli.userData.rotors) r.rotation.y += 0.6;
    if (t >= 7) { const cp = heli.position; camera.position.lerp(new THREE.Vector3(cp.x + 18, cp.y + 8, cp.z + 18), 0.04); camera.lookAt(cp.x, cp.y, cp.z); }
    if (t > 6 && !step.b2) { step.b2 = 1; H.banner('EXTRACTION', 'A VTOL is coming to fly your squad to the new forward base'); }
    if (t > 11.5 && !step.fade) { step.fade = 1; H.fade(true); }
    if (t > 13) { for (const s of ships) scene.remove(s.m); scene.remove(heli); done(); return; }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
