// After victory: reinforcements land, a VTOL picks the squad up and flies them to Forward Operating Base Valor,
// where they can roam the planet on foot, drive armed rovers and fly the VTOL.
import * as THREE from 'three';
import * as M from './models.js';
import { MAPS, ALIENS, CLASSES } from './data.js';
import { rng } from './world.js';

const B = M.B, C = M.C, S = M.S, mat = M.mat;
// ---------------------------------------------------------------- vehicles and ships
export function vtol() {
  { const mg = M.AS.craftGLB('v_vtol', 13, -Math.PI / 2); if (mg) return mg; }   // the Meshy tilt-rotor gunship (nose forward along -z, like the old one)
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
  { const o = M.AS.fitGLB('v_rover', 'w', 6, false); if (o) { const mg = new THREE.Group(); o.rotation.y = -Math.PI / 2; mg.add(o); const tur = new THREE.Group(), gun = new THREE.Group(); tur.add(gun); mg.add(tur); mg.userData = { tur, gun, wheels: [] }; return mg; } }   // the Meshy armoured rover
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
  // leaving the forward base: take everything this put in the world back out
  dispose() { const sc = this.H.scene; for (const v of this.vehs) sc.remove(v.m); for (const n of this.npcs || []) sc.remove(n.m); for (const w of this.wild) sc.remove(w.m); this.vehs = []; this.npcs = []; this.wild = []; this.veh = null; }
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
    const u = !this.veh && this.near(); if (u) H.prompt(`<b>${H.keyName(H.KB.use)}</b> ${u.kind === 'vtol' ? 'Fly the VTOL' : 'Drive the rover (.50 cal turret)'}`);
    if (H.hits[H.KB.use]) { if (this.veh) this.exit(); else if (u) this.enter(u); }
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

// ---------------------------------------------------------------- the ending film, played after the Brood Queen dies. No skip, no player view.
// Act 1, in the hive: the queen's death throes, the VTOL dropping to the cave mouth, the squad running out and climbing aboard one by one,
// the VTOL lifting out of the crater. Act 2, on the surface: a huge forward base being built and filled, cranes, rising buildings, rockets and
// VTOLs landing, troops forming ranks, and the squad stepping off at the start of a greater war.
// Everything moves on the clock (not frame by frame), so it plays the same on slow and fast computers.
const PLANET = { mars: 'Mars', ice: 'Kryos IV', jungle: 'Thessa' };
export function victoryScene(H, squad, swap, done) {
  const { scene, camera } = H, W = H.G.W, P = W.path, objs = [], add = o => { scene.add(o); objs.push(o); return o; }, clear = () => { for (const o of objs.splice(0)) scene.remove(o); };
  const V = (x, y, z) => new THREE.Vector3(x, y, z), sm = f => { f = Math.max(0, Math.min(1, f)); return f * f * (3 - 2 * f); }, L = (a, b, f) => a + (b - a) * f, LV = (a, b, f) => V(L(a.x, b.x, f), L(a.y, b.y, f), L(a.z, b.z, f));
  const planet = PLANET[W.id] || PLANET[H.G.map] || 'the planet', cap = H.caption || ((a, b) => H.banner(a, b));
  const a00 = P.at(0), q0 = W.cave ? { x: W.cave.q.x, z: W.cave.q.z, tx: a00.tx, tz: a00.tz } : a00, qy = W.top(q0.x, q0.z), at = s => { const q = P.at(s); return V(q.x, P.y(s), q.z); }, mouth = at(38), land = at(54), side = V(-q0.tz, 0, q0.tx), fwd = V(q0.tx, 0, q0.tz);
  // the queen, lit for her last moments
  const queen = add(M.alien('broodqueen')); queen.position.set(q0.x, qy, q0.z); queen.rotation.order = 'YXZ'; queen.rotation.y = Math.atan2(-q0.tx, -q0.tz);
  const key = add(new THREE.PointLight(0xffb070, 60, 40)); key.position.set(q0.x + fwd.x * 8 + side.x * 4, qy + 7, q0.z + fwd.z * 8 + side.z * 4);
  const rim = add(new THREE.PointLight(0xa040ff, 50, 40)); rim.position.set(q0.x - fwd.x * 6, qy + 6, q0.z - fwd.z * 6);
  // the squad where they won, between the queen and the way out
  const men = squad.map((sq, i) => { const m = add(M.marine(sq.color, sq.cls)), o = (i - (squad.length - 1) / 2) * 2.2, x = q0.x + fwd.x * 8 + side.x * o, z = q0.z + fwd.z * 8 + side.z * o; m.position.set(x, W.top(x, z), z); m.lookAt(q0.x, m.position.y, q0.z); return { m, a: V(x, W.top(x, z), z) }; });
  const RUN = 7, legs = men.map(g => g.a.distanceTo(mouth) + mouth.distanceTo(land)), tBoard0 = 13.2, starts = men.map((g, i) => tBoard0 + i * 1.3), ends = men.map((g, i) => starts[i] + legs[i] / RUN + 0.5), tLift = Math.max(...ends) + 1.2;
  const heli = add(vtol()), hpA = V(land.x + side.x * 60 + fwd.x * 40, land.y + 80, land.z + side.z * 60 + fwd.z * 40), hpB = V(land.x, land.y + 2.4, land.z); heli.position.copy(hpA);
  let t0 = performance.now(), last = t0, booms = 0, flags = {};
  const once = (k, f) => { if (!flags[k]) { flags[k] = 1; f(); } };
  H.fade(false);
  const act1 = () => {
    const now = performance.now(), t = (now - t0) / 1000, dt = Math.min(0.1, (now - last) / 1000); last = now;
    // the queen
    M.animAlien(queen, t * 1.7);
    if (t < 4.2) { const k = Math.min(1, t / 2); queen.rotation.z = Math.sin(t * 10) * 0.15 * k; queen.rotation.x = Math.sin(t * 6.7) * 0.12 * k - 0.15 * k; queen.position.y = qy + Math.abs(Math.sin(t * 8)) * 0.5 * k; if (Math.random() < 0.6) H.burst(q0.x + (Math.random() - 0.5) * 6, qy + 2 + Math.random() * 6, q0.z + (Math.random() - 0.5) * 6, Math.random() < 0.6 ? 0xb0ff30 : 0xffb040, 5, 5, 0.6); if (Math.random() < dt * 2.5) H.audio.sfx('screech', 0.9); }
    else { const f = sm((t - 4.2) / 1.6); queen.rotation.z = L(queen.rotation.z, 1.5, 0.08 + f * 0.1); queen.rotation.x *= 0.92; queen.position.y = qy - 1.6 * f; if (booms < 7 && t > 4.3 + booms * 0.3) { booms++; H.boomFx(q0.x + (Math.random() - 0.5) * 7, qy + 1 + Math.random() * 5, q0.z + (Math.random() - 0.5) * 7, 4 + Math.random() * 3); H.audio.sfx('boom', 0.9); } }
    key.intensity = 60 + (t > 4.2 && t < 7 ? Math.random() * 120 : 0); rim.intensity = 50 + Math.sin(t * 5) * 15;
    once('r0', () => { H.audio.sfx('roar', 1); cap('MISSION COMPLETE', 'Vance: The queen is dead! Outstanding work, marines. Extraction is inbound.'); });
    if (t > 5.4) once('fl', () => { H.flashAt([q0.x, qy + 4, q0.z], 10); for (let i = 0; i < 5; i++) H.burst(q0.x, qy + 3, q0.z, 0xb0ff30, 30, 10, 1.3); H.audio.sfx('roar', 0.7); cap('', 'The swarm on ' + planet + ' has lost its mother'); });
    // the VTOL
    const hf = sm((t - 8) / 4.5); heli.position.copy(LV(hpA, hpB, 1 - (1 - hf) ** 2)); heli.position.x = L(hpA.x, hpB.x, hf); heli.position.z = L(hpA.z, hpB.z, hf); heli.rotation.y = Math.atan2(-fwd.x, -fwd.z) + Math.PI;
    if (t > 8.2) once('rt', () => { H.audio.sfx('rotor', 1); cap('EXTRACTION', 'Dropship Valkyrie-6 inbound'); });
    // the squad runs out, one at a time, and hops aboard
    men.forEach((g, i) => { const u = t - starts[i]; if (u < 0) return; const d1 = g.a.distanceTo(mouth), dist = Math.min(legs[i], u * RUN), p = g.m.position;
      if (dist < legs[i]) { const tgt = dist < d1 ? LV(g.a, mouth, dist / d1) : LV(mouth, land, (dist - d1) / (legs[i] - d1)), nxt = dist < d1 ? mouth : land; p.set(tgt.x, W.top(tgt.x, tgt.z), tgt.z); g.m.rotation.y = Math.atan2(-(nxt.x - p.x), -(nxt.z - p.z)); M.animMarine(g.m, u * 11, RUN); }
      else { const f = (u - legs[i] / RUN) / 0.5; if (f < 1) { p.y = land.y + Math.sin(f * Math.PI) * 1.5 + f; g.m.scale.setScalar(Math.max(0.05, 1 - f)); } else { if (g.m.visible) H.audio.sfx('step_metal', 0.9); g.m.visible = false; } } });
    if (t > tLift - 1.1) once('ab', () => cap('ALL ABOARD', squad.length > 1 ? 'Every marine is on the VTOL. Dust off!' : 'Dust off!'));
    // lift off and climb out of the crater
    const u = t - tLift; if (u > 0) { const up = sm(u / 2.6) * 24 + Math.max(0, u - 2) ** 2 * 5, go = Math.max(0, u - 1.8) ** 2 * 4; heli.position.set(hpB.x + fwd.x * go, hpB.y + up, hpB.z + fwd.z * go); heli.rotation.x = -Math.min(0.25, Math.max(0, u - 1.8) * 0.15); }
    for (const r of heli.userData.rotors) r.rotation.y += dt * 30;
    // cameras
    let cp, cl;
    if (t < 4.2) { const f = t / 4.2; cp = V(q0.x + fwd.x * L(10.5, 8.5, f) + side.x * L(-1.5, 1.5, f), qy + L(2.2, 3.4, f), q0.z + fwd.z * L(10.5, 8.5, f) + side.z * L(-1.5, 1.5, f)); cl = V(q0.x, qy + 3.4, q0.z); }
    else if (t < 8) { const f = (t - 4.2) / 3.8; cp = V(q0.x + fwd.x * 11 + side.x * L(2, 1, f), qy + L(4.5, 6, f), q0.z + fwd.z * 11 + side.z * L(2, 1, f)); cl = V(q0.x, qy + 1.5, q0.z); }
    else if (t < tBoard0) { const f = (t - 8) / (tBoard0 - 8), c = at(74); cp = V(c.x, c.y + L(1.5, 2.6, f), c.z); cl = V(heli.position.x, heli.position.y + 1, heli.position.z); }
    else if (t < tLift + 1.5) { const f = (t - tBoard0) / (tLift + 1.5 - tBoard0), m = LV(mouth, land, 0.45); const c = at(44); cp = V(c.x + side.x * L(4.5, 3.5, f), c.y + 2.4, c.z + side.z * L(4.5, 3.5, f)); cl = V(L(mouth.x, land.x, 0.25 + f * 0.6), m.y + 1.8, L(mouth.z, land.z, 0.25 + f * 0.6)); }
    else { const c = at(72); cp = V(c.x, c.y + 1.4, c.z); cl = heli.position.clone(); }
    camera.position.copy(cp); camera.lookAt(cl);
    if (u > 4.6) once('fd', () => H.fade(true));
    if (u > 6) { clear(); act2(swap()); return; }
    requestAnimationFrame(act1);
  };
  // ---- act 2: the forward base on the surface
  const act2 = W2 => {
    const T2 = W2.T, gy = (x, z) => T2.raw(x, z), sp = W2.spawn, pads = W2.pads || [[45, -20], [60, 5], [45, 30], [62, 40]];
    const hullM = M.mat(0x5a646e, { m: 0.4, r: 0.6 }), steel = M.mat(0xd0a020, { m: 0.5, r: 0.5 }), conc = M.mat(0x8a9298, { r: 0.9 }), glass = M.mat(0x80c8e8, { e: 0x204060, op: 0.8 });
    // cranes swinging loads over the building site
    const site = V(-30, 0, -40), cranes = [];
    for (let i = 0; i < 3; i++) { const c = new THREE.Group(), x = site.x + i * 34 - 20, z = site.z + (i % 2) * 30 - 10; c.position.set(x, gy(x, z), z); add(c); M.B(c, 1.2, 34, 1.2, steel, 0, 17, 0); const jib = new THREE.Group(); jib.position.y = 34; c.add(jib); M.B(jib, 30, 1, 1, steel, 8, 0, 0); M.B(jib, 6, 3, 3, M.mat(0x3a4048), -9, -1, 0); M.B(jib, 2, 2, 2, M.mat(0x2a3036), 0, 1.5, 0); const cab = M.B(jib, 0.1, 18, 0.1, M.mat(0x222222), 18, -9, 0); const load = M.B(jib, 4, 1.5, 4, conc, 18, -18.5, 0); void cab; void load; cranes.push({ jib, ph: i * 1.7 }); }
    // buildings rising behind scaffolding, sparks flying at the top
    const blds = [];
    for (let i = 0; i < 7; i++) { const x = site.x - 30 + (i % 4) * 22, z = site.z - 25 + Math.floor(i / 4) * 40, w = 10 + (i % 3) * 4, h = 10 + (i * 7) % 16, b = new THREE.Group(); b.position.set(x, gy(x, z), z); add(b); const body = M.B(b, w, h, w * 0.8, i % 2 ? conc : hullM, 0, h / 2, 0); const win = M.B(b, w * 1.01, h * 0.12, w * 0.81, glass, 0, h * 0.7, 0);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) M.B(b, 0.25, h + 2, 0.25, steel, sx * w * 0.55, (h + 2) / 2, sz * w * 0.45); blds.push({ body, win, h, t0: 0.5 + i * 1.6, x, z, top: () => gy(x, z) + h * body.scale.y }); }
    // ships: the squad's VTOL, more VTOLs, and huge transports hovering down far out
    const ships = [{ m: add(vtol()), a: V(-220, 90, 60), b: V(pads[0][0], 4.2, pads[0][1]), t0: 9.5, dur: 7 }];
    for (let i = 1; i < pads.length; i++) ships.push({ m: add(vtol()), a: V(pads[i][0] + 230 * Math.cos(i * 1.9), 110, pads[i][1] + 230 * Math.sin(i * 1.9)), b: V(pads[i][0], 4.2, pads[i][1]), t0: 0.6 + i * 1.8, dur: 7 });
    const big = []; for (let i = 0; i < 3; i++) { const m = add(transport()), a = i * 2.1 + 0.5, r = 170 + i * 40, x = Math.cos(a) * r, z = Math.sin(a) * r; m.position.set(x, 160, z); m.rotation.y = -a; big.push({ m, x, z, y0: 160, y1: gy(x, z) + 12, t0: 1 + i * 3 }); }
    const rockets = []; for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28, r = 55 + (i % 3) * 18, x = sp.x - 40 + Math.cos(a) * r, z = sp.z + Math.sin(a) * r * 0.8; const pod = add(M.supplyPod()); pod.scale.setScalar(1.8); pod.visible = false; rockets.push({ m: pod, x, z, y: gy(x, z), t0: 1.5 + i * 0.9 }); }
    // the muster: ranks of marines running in from the rockets and pads, and soldiers going about the base
    const fx = sp.x - 22, fz = sp.z, troops = [], ranks = 5, files = 10;
    for (let r = 0; r < ranks; r++) for (let c = 0; c < files; c++) { const k = r * files + c, src = rockets[k % rockets.length], m = add(M.marine(0x55704a, ['assault', 'heavy', 'sniper', 'gunner', 'medic'][k % 5])); m.visible = false; const o = V(src.x + (Math.random() - 0.5) * 4, 0, src.z + (Math.random() - 0.5) * 4), tp = V(fx - r * 2.6, 0, fz + (c - (files - 1) / 2) * 2.3); troops.push({ m, o, tp, go: src.t0 + 1.8 + (k % 6) * 0.3, dur: o.distanceTo(tp) / 6.5 }); }
    const walkers = []; for (let i = 0; i < 14; i++) { const m = add(M.marine(0x6a7a5a, 'assault')), a = V(site.x + (Math.random() - 0.5) * 60, 0, site.z + (Math.random() - 0.5) * 50), b = V(site.x + (Math.random() - 0.5) * 60, 0, site.z + (Math.random() - 0.5) * 50); walkers.push({ m, a, b, ph: Math.random() * 10 }); }
    const rovers = []; for (let i = 0; i < 4; i++) { const m = add(rover()), r = 26 + i * 7; rovers.push({ m, r, ph: i * 1.6, cx: sp.x - 50, cz: sp.z - 10 }); }
    const flagA = add(M.flag(Math.random)); flagA.position.set(fx + 8, gy(fx + 8, fz), fz); flagA.scale.setScalar(1.6);
    // the squad steps off their VTOL at the end
    const crew = squad.map((sq, i) => { const m = add(M.marine(sq.color, sq.cls)); m.visible = false; return { m, i }; });
    const sun = add(new THREE.PointLight(0xffd0a0, 0, 200)); sun.position.set(sp.x, 60, sp.z);
    t0 = performance.now(); last = t0; flags = {}; H.fade(false);
    const run = () => {
      const now = performance.now(), t = (now - t0) / 1000, dt = Math.min(0.1, (now - last) / 1000); last = now;
      once('c1', () => { cap('FORWARD BASE VALOR', planet + ': the Marine Corps is coming down in force'); H.audio.sfx('rotor', 0.8); });
      if (t > 7) once('c2', () => cap('', 'One queen is dead. Her sisters still rule the rest of ' + planet + '.'));
      if (t > 13) once('c3', () => { cap('A GREATER WAR BEGINS', 'Your squad is reassigned to the front'); H.audio.sfx('wave', 0.9); });
      if (t > 19) once('c4', () => { cap('NEW MISSION', 'Explore the surface. Rovers to the south, VTOLs on the pads.'); H.audio.sfx('alarm', 0.5); });
      for (const c of cranes) c.jib.rotation.y = Math.sin(t * 0.25 + c.ph) * 1.2;
      for (const b of blds) { const f = sm((t - b.t0) / 9); b.body.scale.y = Math.max(0.03, f); b.body.position.y = b.h * f / 2; b.win.visible = f > 0.75; if (f > 0 && f < 1 && Math.random() < 0.3) H.burst(b.x + (Math.random() - 0.5) * 8, b.top() + 0.3, b.z + (Math.random() - 0.5) * 6, 0xffe080, 2, 3, 0.4); }
      for (const s of ships) { const f = sm((t - s.t0) / s.dur), e = 1 - (1 - f) ** 2; s.m.position.set(L(s.a.x, s.b.x, f), L(s.a.y, s.b.y, e), L(s.a.z, s.b.z, f)); s.m.rotation.y = Math.atan2(-(s.b.x - s.a.x), -(s.b.z - s.a.z)); for (const r of s.m.userData.rotors) r.rotation.y += dt * 30; if (f > 0.85 && f < 1 && Math.random() < 0.5) H.burst(s.b.x + (Math.random() - 0.5) * 10, s.b.y - 2, s.b.z + (Math.random() - 0.5) * 10, 0xb09878, 2, 4, 0.9); }
      for (const b of big) { const f = sm((t - b.t0) / 16); b.m.position.y = L(b.y0, b.y1, f); }
      for (const r of rockets) { const f = (t - r.t0) / 1.8; if (f < 0) continue; r.m.visible = true; if (f < 1) { r.m.position.set(r.x, r.y + 300 * (1 - f) ** 1.6, r.z); H.burst(r.x, r.m.position.y + 3, r.z, Math.random() < 0.5 ? 0xffa040 : 0xffe080, 2, 2, 0.5); } else if (!r.down) { r.down = 1; r.m.position.set(r.x, r.y, r.z); H.boomFx(r.x, r.y + 0.5, r.z, 3, 1); H.audio.sfx('boom', 0.5); } }
      for (const s of troops) { const u = t - s.go; if (u < 0) continue; s.m.visible = true; const f = Math.min(1, u / s.dur), p = LV(s.o, s.tp, f); s.m.position.set(p.x, gy(p.x, p.z), p.z); if (f < 1) { s.m.rotation.y = Math.atan2(-(s.tp.x - s.o.x), -(s.tp.z - s.o.z)); M.animMarine(s.m, u * 11, 6.5); } else { s.m.rotation.y = -Math.PI / 2; M.animMarine(s.m, 0, 0); } }
      for (const w of walkers) { const f = (Math.sin(t * 0.18 + w.ph) + 1) / 2, p = LV(w.a, w.b, f), dir = Math.cos(t * 0.18 + w.ph) > 0 ? 1 : -1; w.m.position.set(p.x, gy(p.x, p.z), p.z); w.m.rotation.y = Math.atan2(-(w.b.x - w.a.x) * dir, -(w.b.z - w.a.z) * dir); M.animMarine(w.m, t * 8 + w.ph, 3); }
      for (const r of rovers) { const a = t * 0.25 + r.ph, x = r.cx + Math.cos(a) * r.r, z = r.cz + Math.sin(a) * r.r; r.m.position.set(x, gy(x, z), z); r.m.rotation.y = -a; }
      // the squad's VTOL touches down and they walk off toward the ranks
      const sh = ships[0], dn = t - (sh.t0 + sh.dur); crew.forEach(c => { if (dn < 0.6 + c.i * 0.7) return; c.m.visible = true; const u = dn - 0.6 - c.i * 0.7, x = sh.b.x - 4 - u * 2.2, z = sh.b.z + (c.i - (crew.length - 1) / 2) * 1.6; c.m.position.set(x, gy(x, z), z); c.m.rotation.y = Math.PI / 2; M.animMarine(c.m, u * 7, 2.5); });
      // cameras
      let cp, cl; const by = gy(sp.x, sp.z);
      if (t < 7) { const f = t / 7, a = 2.4 + f * 0.9; cp = V(site.x + Math.cos(a) * L(150, 110, f), by + L(70, 45, f), site.z + Math.sin(a) * L(150, 110, f)); cl = V(site.x + 10, by + 8, site.z); }
      else if (t < 13) { const f = (t - 7) / 6; cp = V(fx + 14, by + L(4, 5.5, f), fz + L(-20, 20, f)); cl = V(fx - 4, by + 1.6, fz + L(-8, 8, f)); }
      else if (t < 19) { const f = (t - 13) / 6, b = ships[0].b; cp = V(b.x - 22, by + L(3, 5, f), b.z + L(14, 8, f)); cl = V(b.x - 3, b.y - 1, b.z); }
      else { const f = (t - 19) / 6; cp = V(fx + L(10, 80, f), by + L(4, 70, f), fz + L(30, 90, f)); cl = V(L(fx, site.x, f), by + L(2, 10, f), L(fz, site.z, f)); }
      camera.position.copy(cp); camera.lookAt(cl);
      if (t > 24) once('fd', () => H.fade(true));
      if (t > 25.4) { clear(); done(); return; }
      requestAnimationFrame(run);
    };
    requestAnimationFrame(run);
  };
  requestAnimationFrame(act1);
}

// ---------------------------------------------------------------- Station Olympus: after the Hard hive falls, the squad's VTOL docks at the orbital station,
// and General Hale sends them on to the next planet. No skip; about 13 seconds, then the next planet's Easy hive begins.
export function stationScene(H, nextMap, done) {
  const { scene, camera } = H, objs = [], add = o => { scene.add(o); objs.push(o); return o; }, D = MAPS[nextMap], PN = { mars: 'Mars', ice: 'Kryos IV', jungle: 'Thessa' };
  const bg0 = scene.background, fog0 = scene.fog; scene.background = new THREE.Color(0x02030a); scene.fog = null;
  const n = 1800, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, a = Math.random() * 6.283, r = 1500; pos[i * 3] = Math.sqrt(1 - u * u) * Math.cos(a) * r; pos[i * 3 + 1] = u * r; pos[i * 3 + 2] = Math.sqrt(1 - u * u) * Math.sin(a) * r; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false })));
  const sun = add(new THREE.DirectionalLight(0xfff0e0, 2.4)); sun.position.set(300, 200, 100); add(new THREE.AmbientLight(0x304060, 0.7));
  // the next planet, huge below the station
  const planet = add(new THREE.Mesh(new THREE.SphereGeometry(600, 64, 32), M.mat(D.ground, { r: 0.9, flat: false }))); planet.position.set(0, -720, -200);
  const atmo = add(new THREE.Mesh(new THREE.SphereGeometry(618, 64, 32), new THREE.MeshBasicMaterial({ color: D.sky, transparent: true, opacity: 0.25, side: THREE.BackSide })));  atmo.position.copy(planet.position);
  // the station: a turning ring on spokes around a central spindle, with lit windows and a docking bay
  const st = add(new THREE.Group()), hull = M.mat(0xc8ccd2, { m: 0.6, r: 0.35 }), dark = M.mat(0x3a424a, { m: 0.5 }), lights = M.mat(0x9fe0ff, { e: 0x60c0ff, ei: 2.5 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(60, 6, 16, 72), hull); ring.rotation.x = Math.PI / 2; st.add(ring); const win = new THREE.Mesh(new THREE.TorusGeometry(60, 6.2, 4, 72, 6.283), new THREE.MeshBasicMaterial({ color: 0xffe0a0, wireframe: true, transparent: true, opacity: 0.35 })); win.rotation.x = Math.PI / 2; st.add(win);
  for (let i = 0; i < 4; i++) { const sp = M.B(st, 2.5, 2.5, 120, dark, 0, 0, 0); sp.rotation.y = i * Math.PI / 4 * 2 / 2; }
  M.C(st, 9, 9, 70, hull, 0, 0, 0); M.C(st, 12, 12, 8, dark, 0, 20, 0); M.C(st, 12, 12, 8, dark, 0, -20, 0); const bay = M.B(st, 14, 8, 10, lights, 0, -36, 0); void bay;
  for (let i = 0; i < 24; i++) { const a = i / 24 * 6.283; M.S(st, 0.8, i % 2 ? 0xff4040 : 0x40ff80, Math.cos(a) * 66, 0, Math.sin(a) * 66, 1, 1, 1, { e: i % 2 ? 0xff2020 : 0x20ff60, ei: 3 }); }
  st.position.set(0, 0, 0);
  const heli = add(vtol()); heli.scale.setScalar(1.4); const A = new THREE.Vector3(-260, -160, 220), B = new THREE.Vector3(0, -44, 6);
  const t0 = performance.now(); let last = t0, said = {}; H.fade(false);
  H.caption('STATION OLYMPUS', 'High orbit · Marine Corps command');
  const step = () => {
    const now = performance.now(), t = (now - t0) / 1000, dt = Math.min(0.1, (now - last) / 1000); last = now; st.rotation.y += dt * 0.08; planet.rotation.y += dt * 0.01;
    const f = Math.min(1, t / 8), e = 1 - (1 - f) ** 3; heli.position.lerpVectors(A, B, e); heli.lookAt(B.x, heli.position.y, B.z); for (const r of heli.userData.rotors) r.rotation.y += dt * 30;
    if (t > 4 && !said.a) { said.a = 1; H.caption('', 'General Hale: Welcome aboard, marines. That planet will remember you.'); }
    if (t > 8.5 && !said.b) { said.b = 1; H.caption('NEXT PLANET: ' + PN[nextMap].toUpperCase(), 'Hale: The swarm holds ' + PN[nextMap] + '. Drop in, find the queen, burn the hive.'); }
    const a = 0.5 + t * 0.06, r = 150 - f * 40; camera.position.set(Math.cos(a) * r, 30 - f * 50, Math.sin(a) * r); camera.lookAt(heli.position.x * (1 - f * 0.5), heli.position.y * 0.6, heli.position.z * (1 - f * 0.5));
    if (t > 12 && !said.c) { said.c = 1; H.fade(true); }
    if (t > 13.4) { for (const o of objs) scene.remove(o); scene.background = bg0; scene.fog = fog0; done(); return; }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ---------------------------------------------------------------- the drop: how every new planet begins. No skip.
// Inside the drop pod with the commander and a few marines (windows onto space), the pod ejects from Station Olympus, falls into orbit and
// burns through the atmosphere, then retro-fires down onto a landing pad beside the hub. The marines get out first and start the hike to the hive,
// the commander walks into the hub, and the game starts from the player's own eyes.
function dropPod(color) {
  const g = new THREE.Group(), hull = mat(0x4a525a, { m: 0.6, r: 0.4 }), dark = mat(0x23282e, { m: 0.5 }), stripe = mat(color || 0xd09030), glass = mat(0x0a1420, { e: 0x203040, op: 0.5 });
  C(g, 1.9, 2.2, 3.4, hull, 0, 1.9, 0, null, 12); const nose = new THREE.Mesh(new THREE.ConeGeometry(1.9, 1.6, 12), hull); nose.position.y = 4.4; g.add(nose); C(g, 2.3, 2.5, 0.6, dark, 0, 0.3, 0, null, 12);
  B(g, 0.2, 0.5, 4.0, stripe, 0, 2.4, 0); for (let i = 0; i < 4; i++) { const a = i / 4 * 6.283 + 0.4; B(g, 0.15, 1.2, 0.5, dark, Math.cos(a) * 2.25, 0.4, Math.sin(a) * 2.25).rotation.y = -a; }
  for (const a of [0.9, 2.2, 4.0, 5.3]) { const w = B(g, 0.06, 0.5, 0.7, glass, Math.cos(a) * 1.95, 2.9, Math.sin(a) * 1.95); w.rotation.y = -a; }
  const door = new THREE.Group(); door.position.set(0, 0.6, -2.05); g.add(door); B(door, 1.6, 2.6, 0.12, hull, 0, 1.3, 0); B(door, 1.2, 0.12, 0.14, stripe, 0, 2.2, 0); g.userData.door = door;
  const flame = new THREE.Mesh(new THREE.ConeGeometry(1.4, 5, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); flame.rotation.x = Math.PI; flame.position.y = -2.4; g.add(flame); g.userData.flame = flame;
  const heat = new THREE.Mesh(new THREE.SphereGeometry(3.4, 20, 12, 0, 6.29, Math.PI * 0.45, Math.PI * 0.55), new THREE.MeshBasicMaterial({ color: 0xff6020, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); heat.position.y = 2; g.add(heat); g.userData.heat = heat;
  { const pm = M.AS.fitGLB('p_pod2', 'w', 5.6, false); if (pm) { for (const c of [...g.children]) if (c !== flame && c !== g.userData.heat && c !== door) g.remove(c); for (const c of [...door.children]) door.remove(c); pm.rotation.y = Math.PI; g.add(pm); } }   // the Meshy drop pod hull: a squat armoured capsule on four legs, its hatch (facing the cabin door) dropped open as a ramp, wide enough to hold the cabin
  return g;
}
function podInterior() { // a dim cabin: six seats, big windows on both sides, a porthole in the door and a skylight overhead
  const g = new THREE.Group(), doorG = new THREE.Group(), wall = mat(0x2a3036, { m: 0.5, r: 0.6 }), seat = mat(0x3a4048), trim = mat(0xd0a020, { e: 0x604000 }), pipe = mat(0x55606a, { m: 0.7, r: 0.3 });
  const glass = new THREE.MeshBasicMaterial({ color: 0x9fc8ff, transparent: true, opacity: 0.07, depthWrite: false }), strobe = mat(0x400001, { e: 0xff2010, ei: 3 });
  g.add(doorG); const WIN = [15, 0, 1, 7, 8, 9], DOOR = [11, 12, 13];
  const panel = (par, a, h, y) => { const p = B(par, 0.74, h, 0.1, wall, Math.cos(a) * 1.8, y, Math.sin(a) * 1.8); p.rotation.y = -a + Math.PI / 2; return p; };
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * 6.283, par = DOOR.includes(i) ? doorG : g;
    if (WIN.includes(i) || i === 12) { const lo = i === 12 ? 1.3 : 1.05, hi = i === 12 ? 2.65 : 2.45; panel(par, a, lo - 0.25, (lo + 0.25) / 2); panel(par, a, 3.95 - hi, (hi + 3.95) / 2);
      for (const y of [lo, hi]) { const t = B(par, 0.76, 0.05, 0.14, trim, Math.cos(a) * 1.76, y, Math.sin(a) * 1.76); t.rotation.y = -a + Math.PI / 2; }
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(0.74, hi - lo), glass); gl.position.set(Math.cos(a) * 1.82, (lo + hi) / 2, Math.sin(a) * 1.82); gl.rotation.y = -a + Math.PI / 2; par.add(gl); }
    else panel(par, a, 3.6, 2.1);
    if (i % 2) { const b = S(par, 0.06, strobe, Math.cos(a) * 1.7, 3.75, Math.sin(a) * 1.7); void b; }
    if (i === 3 || i === 5 || i === 10 || i === 14) C(g, 0.04, 0.04, 3.4, pipe, Math.cos(a + 0.2) * 1.68, 2.1, Math.sin(a + 0.2) * 1.68);
  }
  C(g, 1.85, 1.85, 0.1, wall, 0, 0.3, 0, null, 16);
  const ceil = new THREE.Mesh(new THREE.RingGeometry(0.7, 1.9, 16), mat(0x2a3036, { m: 0.5, r: 0.6, ds: true })); ceil.rotation.x = Math.PI / 2; ceil.position.y = 3.95; g.add(ceil);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.05, 6, 24), trim); rim.rotation.x = Math.PI / 2; rim.position.y = 3.92; g.add(rim);
  const sky = new THREE.Mesh(new THREE.CircleGeometry(0.7, 24), glass); sky.rotation.x = Math.PI / 2; sky.position.y = 3.96; g.add(sky);
  // standing harnesses on the wall: a padded backboard and headrest, shoulder straps and a chest belt, a grab bar overhead and a foot plate
  const pad = mat(0x3a4048, { r: 0.8 }), strap = mat(0xe07020, { r: 0.7 });
  for (const i of [2, 4, 6, 10, 14]) { const a = i / 16 * 6.283, h = new THREE.Group(); h.position.set(Math.cos(a) * 1.66, 0.35, Math.sin(a) * 1.66); h.lookAt(0, 0.35, 0); g.add(h);
    B(h, 0.6, 1.75, 0.12, pad, 0, 1.08, 0); B(h, 0.36, 0.32, 0.14, pad, 0, 2.12, 0.02); B(h, 0.66, 0.08, 0.14, pipe, 0, 0.18, 0.02);
    for (const sd of [-1, 1]) { B(h, 0.07, 0.05, 0.42, strap, sd * 0.15, 1.92, 0.2); B(h, 0.07, 0.6, 0.03, strap, sd * 0.14, 1.6, 0.42); C(h, 0.03, 0.03, 1.8, pipe, sd * 0.36, 1.1, 0.04); }
    B(h, 0.52, 0.07, 0.03, strap, 0, 1.28, 0.42); B(h, 0.08, 0.08, 0.04, trim, 0, 1.28, 0.44);
    const bar = C(h, 0.025, 0.025, 0.62, pipe, 0, 2.42, 0.32); bar.rotation.z = Math.PI / 2; for (const sd of [-1, 1]) C(h, 0.02, 0.02, 0.3, pipe, sd * 0.3, 2.42, 0.17).rotation.x = Math.PI / 2;
    B(h, 0.62, 0.05, 0.36, pipe, 0, 0.03, 0.2); }
  const L = new THREE.PointLight(0xff3020, 6, 6); L.position.set(0, 3.5, 0); g.add(L); const L2 = new THREE.PointLight(0x80c0ff, 2, 5); L2.position.set(0, 1.5, 0); g.add(L2);
  g.userData = { doorG, strobe, red: L, blue: L2 };
  return g;
}
export function dropIntro(H, squad, done) {
  // First person, strapped into a seat: one unbroken fall from the station to the pad. Look around the cabin and out the windows with the mouse.
  const { scene, camera } = H, G = H.G, W = G.W, P = W.path, objs = [], add = o => { scene.add(o); objs.push(o); return o; }, V = (x, y, z) => new THREE.Vector3(x, y, z);
  const L = (a, b, f) => a + (b - a) * f, cl = f => Math.max(0, Math.min(1, f)), PN = { mars: 'Mars', ice: 'Kryos IV', jungle: 'Thessa' }[W.id] || 'the planet', cap = H.caption, A = H.audio, MU = G.music && G.music();
  const bg0 = scene.background, fog0 = scene.fog, cBg0 = bg0 && bg0.isColor ? bg0.clone() : new THREE.Color(W.def.sky); W.group.visible = false; G.cineFog = true;   /* fog stays a Fog all the way down (never none), so shaders don't need rebuilding when it changes */
  scene.background = new THREE.Color(0x02030a); scene.fog = new THREE.Fog(0x02030a, 1e5, 2e5); document.body.classList.add('pov');
  const heat = document.createElement('div'); heat.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:18;opacity:0;background:radial-gradient(ellipse at center,rgba(255,140,40,0) 35%,rgba(255,90,20,.55) 80%,rgba(255,40,0,.85))'; document.body.appendChild(heat);
  const hud = document.createElement('div'); hud.style.cssText = 'position:fixed;left:3vw;top:4vh;z-index:21;pointer-events:none;font:600 15px "Chakra Petch",monospace;color:#9fe8ff;text-shadow:0 0 6px #08f;line-height:1.5;letter-spacing:1px'; document.body.appendChild(hud);
  // ---- the landing pad beside the hub; the whole fall is straight down onto it
  const sL = P.len - 24, q = P.at(sL), side = V(-q.tz, 0, q.tx), padX = q.x + side.x * 11, padZ = q.z + side.z * 11, padY = W.top(padX, padZ);
  const pad = add(new THREE.Group()); pad.position.set(padX, padY + 0.05, padZ); C(pad, 5, 5.2, 0.3, 0x3a3f45, 0, 0.15, 0); const rg = new THREE.Mesh(new THREE.RingGeometry(3.6, 4.1, 36), mat(0xffc020, { e: 0x806000 })); rg.rotation.x = -Math.PI / 2; rg.position.y = 0.32; pad.add(rg);
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; S(pad, 0.15, 0x40ff80, Math.cos(a) * 4.6, 0.35, Math.sin(a) * 4.6, 1, 1, 1, { e: 0x20ff60, ei: 3 }); }
  const hubC = V(W.hubP.x, W.top(W.hubP.x, W.hubP.z), W.hubP.z), doorYaw = Math.atan2(-(q.x - q.tx * 20 - padX), -(q.z - q.tz * 20 - padZ));   // the door faces up the track toward the hive
  const rot = (x, z) => V(x * Math.cos(doorYaw) + z * Math.sin(doorYaw), 0, -x * Math.sin(doorYaw) + z * Math.cos(doorYaw));
  // ---- space straight above the pad: stars and the planet (they sink with you as you fall, so the planet swells), the station fixed overhead
  const SY = 2400, space = add(new THREE.Group()); space.position.set(padX, SY, padZ);
  const n = 1800, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, a = Math.random() * 6.283, r = 1200; pos[i * 3] = Math.sqrt(1 - u * u) * Math.cos(a) * r; pos[i * 3 + 1] = u * r; pos[i * 3 + 2] = Math.sqrt(1 - u * u) * Math.sin(a) * r; }
  const sgeo = new THREE.BufferGeometry(); sgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); space.add(new THREE.Points(sgeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false })));
  const sunL = new THREE.DirectionalLight(0xfff0e0, 2.4); sunL.position.set(300, 120, 100); space.add(sunL); space.add(new THREE.AmbientLight(0x304060, 0.8));
  const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(30, 16, 10), new THREE.MeshBasicMaterial({ color: 0xfff4d0, fog: false })); sunDisc.position.set(900, 300, 300); space.add(sunDisc);
  const ptex = (() => { const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512; const g2 = cv.getContext('2d'), base = new THREE.Color(W.def.ground), hex = (c, k) => '#' + c.clone().multiplyScalar(k).getHexString();
    g2.fillStyle = hex(base, 1); g2.fillRect(0, 0, 1024, 512); let sd = 3; const r = () => { sd = (sd * 9301 + 49297) % 233280; return sd / 233280; };
    for (let i = 0; i < 420; i++) { const x = r() * 1024, y = r() * 512, s = 10 + r() ** 3 * 160; g2.fillStyle = hex(base, 0.55 + r() * 0.8); g2.globalAlpha = 0.18 + r() * 0.25; g2.beginPath(); g2.ellipse(x, y, s * (1 + r()), s, r() * 3, 0, 6.283); g2.fill(); }
    g2.globalAlpha = 0.6; for (let i = 0; i < 160; i++) { const x = r() * 1024, y = 60 + r() * 392, s = 2 + r() ** 2 * 18; g2.strokeStyle = hex(base, 0.45); g2.lineWidth = 1 + s * 0.15; g2.beginPath(); g2.arc(x, y, s, 0, 6.283); g2.stroke(); g2.fillStyle = hex(base, 1.25); g2.beginPath(); g2.arc(x - s * 0.2, y - s * 0.2, s * 0.7, 0, 6.283); g2.fill(); }
    g2.globalAlpha = 0.85; g2.fillStyle = W.id === 'ice' ? '#e8f4ff' : '#f0e8e0'; g2.fillRect(0, 0, 1024, 22); g2.fillRect(0, 490, 1024, 22); const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; return tx; })();
  const planet = new THREE.Mesh(new THREE.SphereGeometry(900, 72, 36), new THREE.MeshStandardMaterial({ map: ptex, roughness: 0.95 })); planet.position.set(0, -1300, 0); space.add(planet);
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(960, 64, 32), new THREE.MeshBasicMaterial({ color: W.def.sky, transparent: true, opacity: 0.32, side: THREE.BackSide, depthWrite: false })); atmo.position.copy(planet.position); space.add(atmo);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(930, 64, 32), new THREE.MeshBasicMaterial({ color: W.def.sky, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })); glow.position.copy(planet.position); space.add(glow);
  const hullM = mat(0xc8ccd2, { m: 0.6, r: 0.35 }), darkM = mat(0x3a424a, { m: 0.5 }), st = add(new THREE.Group()); st.position.set(padX, SY + 26, padZ);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(70, 7, 16, 72), hullM); ring.rotation.x = Math.PI / 2; st.add(ring); C(st, 10, 10, 60, hullM, 0, 0, 0); B(st, 46, 8, 46, darkM, 0, -8, 0); for (let i = 0; i < 4; i++) { const sp = B(st, 2.5, 2.5, 140, darkM, 0, 0, 0); sp.rotation.y = i * Math.PI / 4; }
  for (let i = 0; i < 20; i++) { const a = i / 20 * 6.283; S(st, 0.9, i % 2 ? 0xff4040 : 0x40ff80, Math.cos(a) * 77, 0, Math.sin(a) * 77, 1, 1, 1, { e: i % 2 ? 0xff2020 : 0x20ff60, ei: 3 }); }
  for (let i = 0; i < 24; i++) { const a = i / 24 * 6.283; S(st, 0.5, 0xffe0a0, Math.cos(a) * 21, -12.2, Math.sin(a) * 21, 1, 1, 1, { e: 0xffc060, ei: 3 }); }
  { const sm = M.AS.fitGLB('p_station', 'w', 230, true); if (sm) { const k1 = new THREE.DirectionalLight(0xbfd4ff, 1.6); k1.position.set(-200, 80, -150); st.add(k1); const k2 = new THREE.PointLight(0xffc080, 3, 120, 1); k2.position.set(0, -25, 0); st.add(k2); for (const c of [...st.children]) if (!(c.isMesh && c.geometry.type === 'SphereGeometry' && c.position.y < -10)) st.remove(c); sm.position.y = 4; st.add(sm); } }   // the Meshy station: Station Olympus
  // ---- inside Station Olympus: the drop hangar (VTOLs, missile racks, a weapons rack, drop pods with marines running to them, a big window onto space).
  // It sits low in the station's orbit so the window looks out over the planet's curve; it only shows during its own shots (no lights of its own, so no shader rebuilds).
  const hg = add(new THREE.Group()); hg.position.set(padX - 400, SY - 330, padZ);   /* the window (+x) faces the planet's centre */ hg.visible = false;
  const hgL = []; for (const z of [-14, 12]) { const hl = add(new THREE.PointLight(0xd8e4f0, 260, 70, 1.6)); hgL.push(hl); hl.position.set(hg.position.x, hg.position.y + 10.5, hg.position.z + z); }   /* the hangar's lights live in the scene, always on (the light count never changes), and only reach the hangar */
  { const floorM = mat(0x3a4048, { m: 0.5, r: 0.55, e: 0x14181c }), wallM2 = mat(0x4e5862, { m: 0.5, r: 0.55, e: 0x10141a }), trimM = mat(0xffc020, { e: 0x604000 }), stripM = mat(0x80d8ff, { e: 0x60c0ff, ei: 2.5 }), glassM = new THREE.MeshBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.06, depthWrite: false });
    B(hg, 28, 0.4, 64, floorM, 0, -0.2, 0); B(hg, 28, 0.4, 64, wallM2, 0, 12.2, 0); B(hg, 0.4, 12, 64, wallM2, -14, 6, 0); B(hg, 28, 12, 0.4, wallM2, 0, 6, -32); B(hg, 28, 12, 0.4, wallM2, 0, 6, 32);
    // the window wall (+x): solid either side and below/above a big pane
    B(hg, 0.4, 12, 22, wallM2, 14, 6, -21); B(hg, 0.4, 12, 18, wallM2, 14, 6, 23); B(hg, 0.4, 2, 24, wallM2, 14, 1, 2); B(hg, 0.4, 1.6, 24, wallM2, 14, 11.2, 2); B(hg, 0.05, 8.4, 24, glassM, 14, 6.2, 2);
    for (const z of [-10, -4, 2, 8, 14]) B(hg, 0.5, 8.4, 0.35, darkM, 14, 6.2, z);   /* window mullions */
    for (let z = -30; z <= 30; z += 6) { B(hg, 27, 0.15, 0.3, stripM, 0, 11.9, z); B(hg, 0.6, 0.05, 2.4, trimM, -6, 0.03, z); B(hg, 0.6, 0.05, 2.4, trimM, 6, 0.03, z); }   /* ceiling light strips, deck markings */
    // two VTOLs parked down the bay
    for (const z of [-22, -8]) { const v = vtol(); v.position.set(-6, 2.6, z); v.rotation.y = Math.PI; hg.add(v); }
    // missile racks: rows of missiles with red tips
    for (let r = 0; r < 3; r++) for (let k = 0; k < 6; k++) { const ms = C(hg, 0.32, 0.32, 3.2, mat(0xd8dde2, { m: 0.5 }), -12.4 + r * 0.9, 0.6 + r * 0.9, -28 + k * 2.2, null, 10); ms.rotation.x = Math.PI / 2; const tip = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.7, 10), mat(0xc02020)); tip.rotation.x = Math.PI / 2; tip.position.set(-12.4 + r * 0.9, 0.6 + r * 0.9, -28 + k * 2.2 + 1.95); hg.add(tip); }
    B(hg, 3.4, 0.2, 14, darkM, -12, 0.3, -22.5); B(hg, 3.4, 0.2, 14, darkM, -11.5, 1.2, -22.5);
    // the weapons rack on the wall: every class's gun
    B(hg, 0.3, 4, 14, darkM, -13.7, 2.4, 14); Object.keys(CLASSES).forEach((k, i) => { const g = M.gunModel(k, CLASSES[k].color); g.scale.setScalar(2.2); g.position.set(-13.2, 3.4 - (i % 2) * 1.5, 10 + (i >> 1) * 3.4); g.rotation.y = -Math.PI / 2; hg.add(g); });
    // drop pods in a row by the window, hatches open, marines running to them
    hg.userData.pods = []; for (let i = 0; i < 4; i++) { const pm = dropPod(0xd09030); pm.position.set(8, 0, 6 + i * 6.5); pm.rotation.y = -Math.PI / 2; pm.scale.setScalar(0.9); hg.add(pm); hg.userData.pods.push(pm); }
    hg.userData.run = []; for (let i = 0; i < 7; i++) { const cls = Object.keys(CLASSES)[i % 6], m = M.marine(CLASSES[cls].color, cls), pd = hg.userData.pods[i % 4].position; m.traverse(o => { o.frustumCulled = false; }); m.position.set(-2 + (i % 3) * 1.6, 0, -14 - i * 1.6); hg.add(m); hg.userData.run.push({ m, to: V(pd.x - 3, 0, pd.z), ph: i * 0.7, sp: 5.2 + (i % 3) * 0.5 }); } }
  // ---- your pod (you only see its cabin from inside) and four more pods dropping beside you, in view of the windows
  const pod = add(dropPod(0xd09030)), cabin = podInterior(); pod.add(cabin); const { red, blue, strobe, doorG } = cabin.userData, fl = pod.userData.flame;
  const shell = pod.children.filter(o => o !== cabin && o !== fl && o !== pod.userData.heat); for (const o of shell) o.visible = false;
  const hinge = new THREE.Group(); hinge.position.set(0, 0.3, -1.82); cabin.add(hinge);   // the door's bottom hinge
  const orange = new THREE.PointLight(0xff7020, 0, 7); orange.position.set(0, 2.4, 0); cabin.add(orange); const day = new THREE.PointLight(0xfff0d0, 0, 10); day.position.set(0, 1.8, -1.6); cabin.add(day);
  // sit a posed marine down: move it so its hips rest on the cushion of the seat at angle a (cushion top is 1.06 up, 1.35 out)
  // stand a marine with his back in the harness at angle a, leaning back a little (idle pose, frozen)
  const standAt = (m, a) => { m.scale.setScalar(0.88); if (m.userData.glb) { M.AS.setPose(m, 'idle', 0); m.userData.mixer.update(0.01); m.userData.sit = 1; if (m.userData.gun) m.userData.gun.visible = false; } m.position.set(Math.cos(a) * 1.36, 0.35, Math.sin(a) * 1.36); m.lookAt(0, 0.35, 0); m.rotateY(Math.PI); m.rotateX(-0.06); };
  const seatOn = (m, a) => { cabin.updateMatrixWorld(true); const hp = m.userData.root.getObjectByName('Hips'); if (!hp) return; const w = cabin.worldToLocal(hp.getWorldPosition(new THREE.Vector3())); m.position.x += Math.cos(a) * 1.3 - w.x; m.position.z += Math.sin(a) * 1.3 - w.z; m.position.y += (M.AS.A.p_seat ? 1.02 : 1.2) - w.y; };
  const crew = [], seatsA = [10, 14].map(i => i / 16 * 6.283);   /* across from you by the door, windows clear */   /* beside you and by the door, so the windows stay clear */
  // the squad: up to 4 marines share this pod, each in their own seat (every player's game seats everyone the same way, by id)
  const order = (squad && squad.length ? squad : [{ id: G.myId, cls: G.cls }]).slice().sort((p, q) => String(p.id).localeCompare(String(q.id))).slice(0, 4), PS = [4, 2, 6, 14].map(i => i / 16 * 6.283);
  const myK = Math.max(0, order.findIndex(p => p.id === G.myId)), myA = PS[myK], mates = [];
  order.forEach((p, k) => { if (k === myK) return; const m = M.marine(0, p.cls); if (!m.userData.glb) return; const a = PS[k]; standAt(m, a); cabin.add(m); mates.push(m); });
  [{ cls: 'assault', color: 0xd8d8d8, cmd: 1 }, ...(order.length < 4 ? [{ cls: 'gunner', color: 0x5a7a4a }] : [])].forEach((r, i) => { const m = M.marine(r.color, r.cls), a = seatsA[i]; standAt(m, a); cabin.add(m); crew.push({ m, a, cmd: r.cmd }); });   /* lookAt points the back at the middle, so turn them round to face in */
  // you: strapped into your own seat, in your class's armour (head hidden, since you're looking out of it)
  const eyeL = V(0, 1.62, 1.22);   // your eyes, in the pod's space (moved to your seated body's head below)
  const meBody = M.marine(0, G.cls || 'assault'); if (meBody.userData.glb) { const a = myA; standAt(meBody, a); const hd = meBody.userData.root.getObjectByName('Head'); if (hd) hd.scale.setScalar(0.001); cabin.add(meBody); cabin.updateMatrixWorld(true); const hb = meBody.userData.root.getObjectByName('Head'); if (hb) { eyeL.copy(cabin.worldToLocal(hb.getWorldPosition(new THREE.Vector3()))); eyeL.y += 0.08; eyeL.x -= Math.cos(myA) * 0.06; eyeL.z -= Math.sin(myA) * 0.06; } }
  for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2, b = B(st, 1.2, 14, 1.2, darkM, 0, -19, 0), o = rot(Math.cos(a) * 2.7, Math.sin(a) * 2.7); b.position.set(o.x, -19, o.z); }   /* clamps on the diagonals, clear of the windows */
  const wing = [[-13, -4, 0.35], [14, 3, 0.6], [-15, 9, 0.9], [12, -10, 1.2]].map(([x, z, dl], i) => { const m = add(dropPod([0x30a0d0, 0xd04030, 0x80c040, 0xc0c0c0][i])); const o = rot(x, z); m.rotation.y = doorYaw + i; return { m, o, dl, sx: Math.sign(x) }; });
  for (const w of wing) for (const o of [-1, 1]) { const b = B(st, 1.2, 14, 1.2, darkM, 0, -19, 0); b.position.set(w.o.x + o * 2.4, -19, w.o.z); }
  // streaks of burning air that rip up past the windows, and cloud banks you fall through
  const streakM = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), streaks = [];
  for (let i = 0; i < 46; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.07, 3 + Math.random() * 4, 0.07), streakM); const a = Math.random() * 6.283, r = 2.3 + Math.random() * 2.2; m.position.set(Math.cos(a) * r, Math.random() * 14 - 5, Math.sin(a) * r); pod.add(m); streaks.push(m); }
  const cloudM = new THREE.MeshLambertMaterial({ color: 0xe8ecf2, transparent: true, opacity: 0.6, depthWrite: false }), cloudG = new THREE.IcosahedronGeometry(1, 1), clouds = [];
  const fogC = new THREE.Color(0xdde3ea), cloudFog = new THREE.Fog(fogC.clone(), 0.5, 16);
  const yAt = t => t < 7 ? SY + 2 : t < 13 ? SY + 2 - ((t - 7) / 6) ** 2 * 160 - (t - 7) / 6 * 10 : t < 22 ? L(SY - 168, 900, (t - 13) / 9) : t < 29 ? padY + 0.6 + (900 - padY - 0.6) * (1 - (t - 22) / 7) ** 2.6 : padY + 0.6;
  pod.rotation.y = doorYaw; pod.position.set(padX, SY + 2, padZ); G.me.yaw = Math.atan2(Math.cos(myA), Math.sin(myA)); G.me.pitch = -0.05;   /* your look is relative to the pod: 0 faces the door */
  // compile every shader and upload every texture the ride will need now, behind the opening fade, instead of in the middle of it
  pod.traverse(o => { if (o.isMesh) o.frustumCulled = false; });   // the strapped-in marines are skinned: never let a wrong bounding box blink them out while the pod shakes
  // Build every shader and upload every texture the ride will need now, behind the opening fade: once for space, once for the battlefield below
  // (the world's lights switch on at the cloud layer, which otherwise rebuilds every shader mid-fall: that was the stutter)
  if (H.renderer) { const R = H.renderer, cc = new THREE.Mesh(cloudG, cloudM), f0 = scene.fog, rt = new THREE.WebGLRenderTarget(8, 8);
    // a hidden warm-up render: draw everything once into a tiny invisible image, nothing culled, so every mesh, texture and effect is on the graphics card before the ride
    const warm = () => { const cull = []; scene.traverse(o => { if (o.isMesh || o.isPoints || o.isSprite || o.isLine) { cull.push([o, o.frustumCulled]); o.frustumCulled = false; } }); const camKids = camera.children.map(c => [c, c.visible]); for (const [c] of camKids) c.visible = true; const prev = R.getRenderTarget(); R.setRenderTarget(rt); R.render(scene, camera); R.setRenderTarget(prev); for (const [o, f] of cull) o.frustumCulled = f; for (const [c, v] of camKids) c.visible = v; };
    try { H.boomFx(padX, padY - 400, padZ, 6); H.burst(padX, padY - 400, padZ, 0xb09878, 4, 2, 0.2); H.burst(padX, padY - 400, padZ, 0xffa040, 4, 2, 0.2); H.burst(padX, padY - 400, padZ, 0xff7020, 4, 2, 0.2); H.tracer([padX, padY - 400, padZ], [padX, padY - 399, padZ], 0xffc070, 0.02, 0.1); } catch (er) { }   // the dust, fire and blast effects the landing uses
    try {
    hg.visible = true; for (const o of shell) o.visible = true; R.compile(scene, camera); warm(); cabin.visible = false; R.compile(scene, camera); warm(); cabin.visible = true;
    W.group.visible = true; space.visible = false; st.visible = false; cc.position.copy(pod.position); scene.add(cc); scene.fog = cloudFog;
    const seen = new Set(); scene.traverse(o => { if (!o.material) return; for (const mm of [].concat(o.material)) for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'alphaMap']) { const tx = mm[k]; if (tx && !seen.has(tx)) { seen.add(tx); R.initTexture(tx); } } });
    R.compile(scene, camera); warm();
  } catch (err) { } hg.visible = false; rt.dispose(); scene.remove(cc); scene.fog = f0; W.group.visible = false; space.visible = true; st.visible = true; }
  const T0 = 18;   // seconds of the opening: inside the station's hangar (6 s), then the station from outside, down to your pod
  const ORB = 1.5;   // the eject, the fall through space and the burning entry last 1.5x longer
  const DOCK = 5.2;   // extra seconds docked in the bay, so the eject comes exactly 30 s after Vance's "thirty seconds" at the start of the opening (-17.8 + 30 = 7 + DOCK)
  if (MU && MU.dropScore) MU.dropScore(T0);
  const t0 = performance.now(); let last = t0, said = {}, shakeK = 0, prevAlt = 0, spd = 0, flyDoor = 0, handed = false, podOut = false, crewParked = false; H.fade(false);
  const once = (k, f) => { if (!said[k]) { said[k] = 1; f(); } };
  // the landing is over: keep the pod (walls, seats, the crew) as a real place on the pad, give you control at your seat, and walk the others out
  const handoff = () => {
    for (const o of [space, st, hg, ...hgL, ...wing.map(w => w.m)]) scene.remove(o); for (const s of streaks) pod.remove(s); for (const c of clouds) scene.remove(c);
    pod.position.set(padX, padY - 0.3, padZ); pod.rotation.set(0, doorYaw, 0); W.group.attach(pod); W.group.attach(pad); for (const o of shell) o.visible = false;   /* the outer hull clips into the cabin: it only shows while you're outside */ fl.material.opacity = 0; pod.userData.heat.material.opacity = 0;
    if (meBody.parent) meBody.parent.remove(meBody); for (const m of mates) cabin.remove(m);
    red.intensity = 3; blue.intensity = 1.2; strobe.emissiveIntensity = 1.5;   // emergency lighting stays on in the landed pod
    // the pod's wall: a ring of small posts you can't walk through, open where the door was (straight ahead of your seat)
    pod.updateMatrixWorld(true); for (let k = 0; k < 16; k++) { const a = k / 16 * 6.283, rel = Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2)); if (Math.abs(rel) < 0.55) continue; const p = pod.localToWorld(V(Math.cos(a) * 1.95, 0, Math.sin(a) * 1.95)); W.colliders.push({ x: p.x, z: p.z, r: 0.42, h: 4.5, gy: padY }); }
    W.group.visible = true; scene.background = bg0; scene.fog = fog0; G.cineFog = false; heat.remove(); hud.remove(); document.body.classList.remove('pov'); A.rumble(0); if (A.roar) A.roar(0); if (MU && MU.endScore) MU.endScore();
    const me = pod.localToWorld(V(Math.cos(myA) * 0.75, 0, Math.sin(myA) * 0.75)), door = pod.localToWorld(V(0, 0, -3.4));
    done({ marines: crew.filter(c => !c.cmd).length, x: me.x, z: me.z, yaw: G.me.yaw + doorYaw, ax: door.x, az: door.z, allyDelay: 2.2 });
  };
  const step = () => {
    const now = performance.now(), tr = (now - t0) / 1000 * (G.filmRate || 1) - T0, u = tr - DOCK, t = tr < 7 ? tr : tr < 7 + DOCK ? 6.999 : u < 7 + 15 * ORB ? 7 + (u - 7) / ORB : u - 15 * (ORB - 1),   /* docked for the full countdown; then the fall through orbit and the burn (ride 7-22 s) run ORB times slower; clouds and landing at normal speed */   /* the pod waits docked for the full countdown, then the ride runs on its own clock */ dt = Math.min(0.1, (now - last) / 1000) * (G.filmRate || 1); last = now; ring.rotation.z += dt * 0.03;
    let shake = 0, rum = 0.06, ror = 0, streakO = 0, temp = 21; const y = handed ? padY - 0.3 : yAt(t);   /* once landed, the pod sits on the pad with its floor at ground level */ pod.position.set(padX, y, padZ);
    // the other pods fall the same way, a beat behind, and peel away in the clouds
    for (const w of wing) { const tt = t - w.dl, wy = yAt(Math.max(0, tt)), spread = 1 + cl((tt - 13) / 9) * 2.5; w.m.position.set(padX + w.o.x * spread, (tt < 22 ? wy : yAt(22) - (tt - 22) * 260), padZ + w.o.z * spread); w.m.rotation.z = Math.sin(t * 7 + w.dl * 5) * 0.03 * cl(tt - 13);
      w.m.userData.flame.material.opacity = tt > 7 && tt < 13 ? 0.6 : 0; w.m.userData.heat.material.opacity = tt > 13 && tt < 22 ? Math.min(0.9, (tt - 13) / 7) : 0; if (tt > 24) w.m.visible = false; }
    if (t < 0) { // the opening shot: Station Olympus in high orbit, the drop pods hanging in its bay, then down to yours
      once('o1', () => { cap('STATION OLYMPUS', `High orbit over ${PN} · 7th Orbital Drop Wing`); for (const o of shell) o.visible = true; cabin.traverse(o => { if (!o.isLight && o !== cabin && o.isMesh && o.visible) { o.visible = false; (cabin.userData.hid = cabin.userData.hid || []).push(o); } }); hud.style.display = 'none';   /* hide the cabin's meshes but keep its lights on: a light count change rebuilds every shader */ document.body.classList.remove('pov'); });   /* letterboxed, like a film, until you're in your seat */
      if (t > -17.8) once('b', () => cap('', 'Commander Vance: Listen up! Thirty seconds to drop. Hands off the straps until we\'re down.'));   /* right away: the eject comes exactly 30 s later */
      if (t > -12.4) once('o2', () => cap('', 'General Hale: Drop teams, this is Olympus. The swarm holds the planet. Go down there and take it back.'));   /* after Vance (5 s) */
      if (t > -3.4) once('b1', () => cap('', 'General Hale: Godspeed, marines. Bring that queen down.'));
      if (t > -0.6) once('o4', () => H.fade(true));
      if (t < -8) { // inside the hangar: roaming shots, marines sprinting to the pods
        hg.visible = true; const H0 = hg.position, P3 = (x, y, z) => V(H0.x + x, H0.y + y, H0.z + z), e = f => f * f * (3 - 2 * f); let cp, cl;
        for (const r of hg.userData.run) { const m = r.m, d = V(r.to.x - m.position.x, 0, r.to.z - m.position.z), dl = d.length(); if (t < -15.5 + r.ph * 0.15) { M.animMarine(m, 0, 0); continue; } if (dl > 0.4) { const st2 = Math.min(dl, r.sp * dt); m.position.addScaledVector(d.normalize(), st2); m.rotation.y = Math.atan2(-d.x, -d.z); r.ph += dt * r.sp * 1.6; M.animMarine(m, r.ph, r.sp); } else { m.visible = false; } }   /* in through the hatch */
        if (t < -14.5) { const f = e((t + 18) / 3.5); cp = P3(2.5, 2.2 + f, L(-29, -12, f)); cl = P3(-6, 2.4, L(-24, -6, f)); }   /* down the bay past the VTOLs and the missile racks */
        else if (t < -12) { const f = e((t + 14.5) / 2.5); cp = P3(-10.6, 2.8, L(8, 18.5, f)); cl = P3(-13.5, 2.7, L(10, 20, f)); }   /* along the weapons rack */
        else if (t < -10) { const f = e((t + 12) / 2); cp = P3(L(-4, -1, f), 3.2, L(-6, 0, f)); cl = P3(7, 2, L(8, 18, f)); }   /* marines sprinting for the pods */
        else { const f = e((t + 10) / 2); cp = P3(L(9, 11.6, f), 7, L(-1, 1, f)); cl = P3(60, L(-30, -40, f), 2); }   /* out the window: the stars and the planet's curve */
        camera.position.copy(cp); camera.lookAt(cl); A.rumble(0.03); requestAnimationFrame(step); return;
      }
      hg.visible = false; const ts = -12 + (t + 8) * 1.5;   /* the old 12 s station flyby, now in 8 s */
      const sp = st.position, pp = pod.position; let cp, cl;
      if (ts < -6) { const f = (ts + 12) / 6, a = 0.6 + f * 1.1, r = 230 - f * 50; cp = V(sp.x + Math.cos(a) * r, sp.y + 70 - f * 40, sp.z + Math.sin(a) * r); cl = V(sp.x, sp.y - 10, sp.z); }
      else if (ts < -2) { const f = (ts + 6) / 4, e2 = f * f * (3 - 2 * f), a = 1.7; const A0 = V(sp.x + Math.cos(a) * 180, sp.y - 70, sp.z + Math.sin(a) * 180), A1 = V(pp.x + 34, pp.y - 6, pp.z + 22); cp = A0.lerp(A1, e2); cl = V(L(sp.x, pp.x, e2), L(sp.y - 10, pp.y + 2, e2), L(sp.z, pp.z, e2)); }
      else { const f = (ts + 2) / 2; cp = V(pp.x + L(34, 6, f), pp.y + L(-6, 2.4, f), pp.z + L(22, 4, f)); cl = V(pp.x, pp.y + 2.4, pp.z); }
      camera.position.copy(cp); camera.lookAt(cl); A.rumble(0.04); requestAnimationFrame(step); return;
    }
    once('o5', () => { for (const o of shell) o.visible = false; for (const o of cabin.userData.hid || []) o.visible = true; cabin.userData.hid = null; hud.style.display = ''; document.body.classList.add('pov'); H.fade(false); });
    if (t < 7) { // docked: alarms, red strobes, the commander's countdown
      once('a', () => A.sfx('alarm', 0.5));
      // the countdown is real: "thirty seconds" (said as the station shot opens) comes exactly 30 s before the clamps blow (eject at tr = 7 + DOCK)
      const EJ = 7 + DOCK;
      if (tr > EJ - 20) once('b2', () => A.sfx('alarm', 0.55));
      if (tr > EJ - 10) once('b3', () => { A.sfx('alarm', 0.6); cap('', 'Commander Vance: Pod sealed. Harnesses locked. Ten seconds.'); });
      if (tr > EJ - 5) once('c', () => { A.sfx('alarm', 0.7); cap('', 'Vance: Here we go. Hold on to something!'); });
      { const pu = 0.5 + 0.5 * Math.sin(tr * 2.6); red.intensity = 4 + 4 * pu; strobe.emissiveIntensity = 0.6 + 2.6 * pu; }   /* a slow alarm pulse, no hard flashing */ shake = 0.04; if (tr > EJ - 10) shake = 0.08; if (tr > EJ - 5) shake = 0.12;
    } else if (t < 13) { // EJECT: the clamps blow, every pod drops away from the station, thrusters lit
      once('d', () => { cap('', 'EJECT! EJECT! EJECT!'); A.sfx('boom', 0.4); shakeK = 1.5; if (MU && MU.eject) MU.eject(); });
      if (t > 8.6) once('e', () => cap('', 'Vance: Clean drop. Planet dead ahead. Brace for the burn!'));
      fl.material.opacity = 0.6; rum = 0.45; ror = 0.3 * cl((t - 7) / 2); shake = 0.25; red.intensity = 3; strobe.emissiveIntensity = 0.6 + 2.6 * (0.5 + 0.5 * Math.sin(t * 2.6));
      if (Math.random() < dt * 4) { const w = pod.localToWorld(V((Math.random() - 0.5) * 8, 6, (Math.random() - 0.5) * 8)); H.burst(w.x, w.y, w.z, 0xfff0c0, 2, 5, 0.4); }
    } else if (t < 22) { // atmospheric entry: the planet swells below, the air catches fire, everything shakes
      const f = (t - 13) / 9; space.position.y = L(SY, 1240, f);
      once('f', () => A.sfx('alarm', 0.8));
      if (t > 17) once('g', () => cap('', 'Vance: Hold together, you old bucket!'));
      pod.rotation.z = Math.sin(t * 31) * 0.025 * f; pod.rotation.x = Math.sin(t * 23) * 0.015 * f; fl.material.opacity = 0; pod.userData.heat.material.opacity = Math.min(0.9, f * 1.3);
      rum = 0.45 + f * 0.55; ror = 0.45 + f * 0.55; shake = 0.3 + f * 1.1; orange.intensity = 2 + f * 10 + Math.random() * 3; heat.style.opacity = (0.12 + f * 0.5 + Math.random() * 0.1).toFixed(2); streakO = cl(f * 1.6) * (0.55 + Math.random() * 0.3); temp = 200 + f * 1500;
      strobe.emissiveIntensity = 0.6 + 2.6 * (0.5 + 0.5 * Math.sin(t * 2.6));
      for (let k = 0; k < 1; k++) { const a = Math.random() * 6.283, w = pod.localToWorld(V(Math.cos(a) * 2.6, 1 + Math.random() * 3, Math.sin(a) * 2.6)); H.burst(w.x, w.y, w.z, Math.random() < 0.5 ? 0xff7020 : 0xffd060, 2, 6, 0.35); }
      if (Math.random() < dt * 0.8) A.sfx('thunder', 0.15 + f * 0.15);
      // the burning sky: black space turns to fire, then to the white of the cloud tops
      scene.background.setRGB(L(0.01, 0.35, cl(f * 1.4)), L(0.01, 0.1, cl(f * 1.4)), L(0.04, 0.03, cl(f * 1.4)));
      if (t > 20.5) { const k = cl((t - 20.5) / 1.5); scene.background.lerp(fogC, k); }
    } else if (t < 29) { // through the clouds, out the bottom over the battlefield, retro-rockets fighting the fall onto the pad
      const f = (t - 22) / 7;
      once('h', () => { W.group.visible = true; space.visible = false; st.visible = false; scene.fog = cloudFog; scene.background = fogC.clone(); pod.userData.heat.material.opacity = 0; orange.intensity = 1; pod.rotation.x = 0; });
      if (t > 26.6) once('brace', () => { if (MU && MU.brace) MU.brace(); });
      if (t > 23.6) once('h2', () => { cap('', 'Vance: Retros firing. Landing zone in sight. Brace, brace, brace!'); A.sfx('rotor', 0.9); A.sfx('boom', 0.5); shakeK = 1; });
      // the cloud bank: dense, then it tears open and the ground is right there
      const fo = fog0 || { near: 30, far: 220, color: cBg0 }, k1 = cl((t - 22) / 1.8), k2 = cl((t - 23.8) / 0.9), k3 = cl((t - 24.7) / 3);
      cloudFog.near = L(0.5, fo.near, k2); cloudFog.far = k2 < 1 ? L(L(14, 40, k1), 1200, k2 * k2) : L(1200, fo.far, k3); cloudFog.color.copy(fogC).lerp(fo.color, k2); scene.background.copy(fogC).lerp(cBg0, k2);
      if (t < 24.2) for (let k = 0; k < 2 && clouds.length < 60; k++) { const c = new THREE.Mesh(cloudG, cloudM), a = Math.random() * 6.283, r = 5 + Math.random() * 40; c.position.set(padX + Math.cos(a) * r, y - 30 - Math.random() * 60, padZ + Math.sin(a) * r); c.scale.set(4 + Math.random() * 10, 2 + Math.random() * 5, 4 + Math.random() * 10); add(c); clouds.push(c); }
      for (let i = clouds.length - 1; i >= 0; i--) if (clouds[i].position.y > y + 30) { scene.remove(clouds[i]); clouds.splice(i, 1); }
      heat.style.opacity = Math.max(0, 0.3 - f).toFixed(2); streakO = t < 23 ? 0.3 * (23 - t) : 0;
      const burn = t > 23.6; pod.rotation.z = Math.sin(t * 20) * 0.012; fl.material.opacity = burn ? 0.85 : 0; fl.scale.set(1, 0.7 + (1 - f) * 1.4 + Math.random() * 0.3, 1);
      rum = burn ? 0.6 + (1 - f) * 0.35 : 0.8; ror = Math.max(0.15, 0.85 - f * 0.8); shake = burn ? 0.45 + (1 - f) * 0.5 : 0.9; { const pu = 0.5 + 0.5 * Math.sin(t * 2.6); red.intensity = 3 + 4 * pu; strobe.emissiveIntensity = 0.6 + 2.6 * pu; } temp = L(600, 60, f);
      if (burn && Math.random() < 0.6) H.burst(padX + (Math.random() - 0.5) * 3, y - 2.5, padZ + (Math.random() - 0.5) * 3, 0xffa040, 3, 4, 0.4);
      if (burn && y - padY < 40 && Math.random() < 0.7) H.burst(padX + (Math.random() - 0.5) * 16, padY + 0.3, padZ + (Math.random() - 0.5) * 16, 0xb09878, 2, 6, 1);
    } else { // impact, then the door blows off and the squad pours out
      const u = t - 29;
      once('i', () => { fl.material.opacity = 0; A.sfx('boom', 0.45); H.boomFx(padX, padY + 0.5, padZ, 5, 1); shakeK = 2.8; red.intensity = 0; blue.intensity = 0; strobe.emissiveIntensity = 0; for (let k = 0; k < 30; k++) H.burst(padX + (Math.random() - 0.5) * 12, padY + 0.3, padZ + (Math.random() - 0.5) * 12, 0xb09878, 2, 5, 1.2); 0; if (MU && MU.land) MU.land();   /* touchdown: guitars */ for (const c of clouds) scene.remove(c); clouds.length = 0; scene.fog = fog0; scene.background = bg0; G.cineFog = false; });
      if (u > 1.4) once('j', () => { A.sfx('boom', 0.5); A.sfx('place', 1); flyDoor = 1; hinge.attach(doorG); day.intensity = 8; heat.style.opacity = 0; for (let k = 0; k < 14; k++) { const w = pod.localToWorld(V(0, 1.4, -2.6)); H.burst(w.x, w.y, w.z, 0xd0c0a0, 3, 4, 1); } });
      if (flyDoor) { const k = Math.min(1, (u - 1.4) / 0.55); hinge.rotation.x = -1.48 * k * k + (k >= 1 ? Math.sin(Math.min(1, (u - 1.95) / 0.4) * Math.PI) * 0.06 : 0); }   // the door falls open outward and lands as a ramp
      rum = Math.max(0, 0.3 - u * 0.15); shake = u < 1 ? 0.5 : 0.02;
      crew.forEach((c, i) => { const k = u - 2.2 - (c.cmd ? 2.6 : i * 0.6); const m = c.m; if (k < 0) return;
        if (!c.out) { m.userData.legL.rotation.x = m.userData.legR.rotation.x = 0; m.userData.sit = 0; m.position.y = 0.3; const f = Math.min(1, k / 0.8), sx = Math.cos(c.a) * 1.25, sz = Math.sin(c.a) * 1.25; m.position.x = L(sx, 0, f); m.position.z = L(sz, -1.7, f); m.rotation.y = Math.atan2(-(0 - sx), -(-1.7 - sz)); M.animMarine(m, k * 10, 5); if (f >= 1) { c.out = true; const w = pod.localToWorld(V(0, 0, -2.4)); cabin.remove(m); m.scale.setScalar(1); add(m); m.position.set(w.x, padY, w.z); c.k0 = k; if (!c.cmd) { scene.remove(m); c.gone = true; } } }
        else { const kk = k - c.k0; if (c.cmd) { const f = Math.min(1, kk / 6), x = L(padX, hubC.x, f), z = L(padZ, hubC.z, f); m.position.set(x, W.top(x, z), z); m.rotation.y = Math.atan2(-(hubC.x - padX), -(hubC.z - padZ)); if (f < 1) M.animMarine(m, kk * 7, 2.5); }
          else { const s = Math.max(0, sL - 2 - kk * 6.5), qq = P.at(s), lat = (i - 2) * 1.6, x = kk < 1.2 ? L(m.position.x, qq.x, 0.08) : qq.x - qq.tz * lat, z = kk < 1.2 ? L(m.position.z, qq.z, 0.08) : qq.z + qq.tx * lat; m.position.set(x, W.top(x, z), z); m.rotation.y = Math.atan2(qq.tx, qq.tz); M.animMarine(m, kk * 11, 6.5); } } });
      // the door's gone: you're in control from here, standing in the pod; walk out yourself
      if (u > 1.7 && !handed) { handed = true; handoff(); }
    }
    if (handed) { if (G.W !== W) return; const din = Math.hypot(G.me.x - padX, G.me.z - padZ), out = din > 3.3; if (out !== podOut) { podOut = out; for (const o of shell) o.visible = out; if (out) { cabin.userData.out = []; cabin.traverse(o => { if (o.isMesh && o.visible && !o.isLight) { o.visible = false; cabin.userData.out.push(o); } }); } else { for (const o of cabin.userData.out || []) o.visible = true; cabin.userData.out = null; } }   /* from outside you see only the hull; the cabin's meshes hide (its lights stay on, so no shader rebuild) */ if (out && !said.bgm) { said.bgm = 1; setTimeout(() => { if (MU && MU.background) MU.background(true); }, 5000); }   /* 5 s after you step out, the music eases down to a background level */ if (t - 29 > 16 && !crewParked) { crewParked = true; for (const c of crew) if (c.cmd && c.m.parent) W.group.attach(c.m); } requestAnimationFrame(step); return; }   // after the hand-off: walk the commander in, and swap the pod's hull on and off as you leave or step back inside   // after the hand-off this loop only walks the commander to the hub
    streakM.opacity = streakO; if (streakO > 0) for (const s of streaks) { s.position.y += dt * 45; if (s.position.y > 9) s.position.y -= 15; }
    // helmet readout
    const alt = y < 900 ? (y - padY) * 8 : 7200 + (y - 900) * 75; spd = L(spd, Math.abs(prevAlt - alt) / Math.max(dt, 0.001), 0.1); prevAlt = alt;
    hud.innerHTML = t > 29 ? '' : `ALT&nbsp; ${Math.max(0, Math.round(alt)).toLocaleString()} m<br>VEL&nbsp; ${t < 7 ? 0 : Math.round(spd).toLocaleString()} m/s<br>HULL ${Math.round(temp)}°C${temp > 900 && Math.sin(t * 10) > 0 ? ' <span style="color:#ff5040">⚠</span>' : ''}`;
    // first-person camera in your seat: mouse look, plus the pod's violence
    shakeK = Math.max(0, shakeK - dt * 2.2); const sh = shake + shakeK; A.rumble(rum); if (A.roar) A.roar(ror);
    pod.updateMatrixWorld(); const eye = pod.localToWorld(eyeL.clone());   /* your head, in your seat */ G.me.pitch = Math.max(-1.2, Math.min(1.2, G.me.pitch));
    camera.position.set(eye.x + (Math.random() - 0.5) * sh * 0.07, eye.y + (Math.random() - 0.5) * sh * 0.07, eye.z + (Math.random() - 0.5) * sh * 0.07);
    camera.rotation.set(G.me.pitch + (Math.random() - 0.5) * sh * 0.02 + pod.rotation.x, G.me.yaw + doorYaw + (Math.random() - 0.5) * sh * 0.02, (Math.random() - 0.5) * sh * 0.03 + pod.rotation.z, 'YXZ');
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
