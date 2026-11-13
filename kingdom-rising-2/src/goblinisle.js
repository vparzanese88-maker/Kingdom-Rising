// Goblin Island: the build (gorge, drawbridges, the Crown Ridge and its cuts, tribe villages, troll lairs, the sailors'
// camp), the enemies, and the island's progress (who is beaten, which gates are open) with the objective list.
// The layout and terrain shape live in gimap.js.
import * as THREE from 'three';
import { G } from './state.js';
import { world, addBox, addCircle, addSurface } from './world.js';
import { heightAt } from './terrain.js';
import { distToLine } from './util.js';
import { Mob } from './mobs.js';
import { MOBS, ZONES } from './data.js';
import { GI, CROWN, TUNNEL, GATE, GORGE, GORGE_W, GORGE_RIM, BRIDGE1, TRIBES, LAIRS, CAMP_SPOT, cutCoords, cutPoint } from './gimap.js';

const R = (a, b) => a + Math.random() * (b - a);
// the zone names shown under the minimap
if (GI) { const N = { coast: ['Wreck Shore', '1-3'], meadow: ['Bloodfang Jungle', '1-4'], wood: ['Grimtusk Wilds', '1-7'], highlands: ['The Crown Ridge', '7-10'], north: ['The Crown Ridge', '7-10'] };
  for (const z of ZONES) if (N[z.id]) { z.name = N[z.id][0]; z.lv = N[z.id][1]; } }
let H = null; // the world's building helpers (materials, boxes, tents...)
const parts = { gap1: [], gap2: [], tunnelGate: [], rail1: [], rail2: [] };
const live = { bridge1: null, bridge2: null, portcullis: null, totems: {}, anims: [] };

// trees and rocks keep off the gorge, the ridge cuts and the moat
export function giAvoid(x, z, pad = 0) {
  if (distToLine(x, z, GORGE).d < GORGE_RIM + 6 + pad) return true;
  for (const cut of [TUNNEL, GATE]) { const c = cutCoords(cut, x, z); if (c.along > cut.a0 - 8 && c.along < cut.a1 + 18 && c.lat < cut.half + 7 + pad) return true; }
  if (Math.hypot(x - CROWN.x, z - CROWN.z) < CROWN.rIn - 4) return true; // (the city plateau: built in its own step)
  return false;
}

// ---------------- the build ----------------
export function buildGoblinIsle(scene, helpers) {
  if (!GI) return; H = helpers; const { M } = H;
  M.goblinRed = new THREE.MeshStandardMaterial({ color: '#8a2018', roughness: 0.9, side: THREE.DoubleSide });
  M.mud = new THREE.MeshStandardMaterial({ color: '#4a4a24', roughness: 1, side: THREE.DoubleSide });
  M.boneCloth = new THREE.MeshStandardMaterial({ color: '#d8d0b8', roughness: 0.95, side: THREE.DoubleSide });
  M.rockDark = new THREE.MeshStandardMaterial({ color: '#4a4640', roughness: 0.95, flatShading: true });
  M.torch = new THREE.MeshStandardMaterial({ color: '#ffb040', emissive: '#ff8a20', emissiveIntensity: 2.2 });
  buildSailorCamp(scene); buildGorge(scene); buildRidge(scene);
  for (const [id, t] of Object.entries(TRIBES)) buildTribe(scene, id, t);
  for (const l of LAIRS) buildLair(scene, l);
}
function buildSailorCamp(scene) {
  const { M, tent, campfire, placeGroup, barrel, crate, bx, cy } = H, c = CAMP_SPOT;
  tent(scene, c.x - 8, c.z - 6, 0.4, M.cloth, 1.1); tent(scene, c.x + 7, c.z - 9, -0.5, M.cloth); tent(scene, c.x - 12, c.z + 6, 1.8, M.clothBlue, 0.9);
  const fg = new THREE.Group(); campfire(fg, scene, c.x, c.z); placeGroup(fg, c.x, c.z, 0, scene); addCircle(c.x, c.z, 0.9); H.fire(scene, c.x, heightAt(c.x, c.z) + 0.5, c.z, 0.8);
  [[c.x + 5, c.z + 4], [c.x + 6, c.z + 5.2], [c.x - 4, c.z + 9]].forEach(([x, z]) => barrel(scene, x, z));
  [[c.x + 9, c.z + 2, 0.3], [c.x + 9.6, c.z + 3.2, 0.9], [c.x - 9, c.z - 1, 0.2]].forEach(([x, z, r]) => crate(scene, x, z, r));
  // the broken bow of a wrecked ship, half buried in the sand
  { const g = new THREE.Group(); for (let i = 0; i < 7; i++) { const rib = cy(0.12, 0.14, 4.5 - Math.abs(i - 3) * 0.4, M.wood, 0, 1.6, i * 1.1 - 3.3, g, 6); rib.rotation.z = 0.5; const r2 = cy(0.12, 0.14, 4.5 - Math.abs(i - 3) * 0.4, M.wood, 0, 1.6, i * 1.1 - 3.3, g, 6); r2.rotation.z = -0.5; }
    bx(0.3, 0.3, 8, M.beam, 0, 0.2, 0, g); const mast = cy(0.18, 0.22, 7, M.wood, 0.8, 2.4, -1, g, 8); mast.rotation.z = 1.1;
    placeGroup(g, c.x + 26, c.z + 22, 0.9, scene, -0.4); addBox(c.x + 26, c.z + 22, 1.8, 4.2, 0.9); }
}
// the gorge's rims: an unbroken wall of segments down both sides, from sea to sea, but for the bridge gap
function buildGorge(scene) {
  const { M, bx, cy } = H;
  for (const side of [-1, 1]) for (let i = 0; i < GORGE.length - 1; i++) {
    const [ax, az] = GORGE[i], [bx2, bz] = GORGE[i + 1], len = Math.hypot(bx2 - ax, bz - az), ux = (bx2 - ax) / len, uz = (bz - az) / len, nx = -uz * side, nz = ux * side;
    for (let d = 0; d < len; d += 5) { const x = ax + ux * (d + 2.5) + nx * GORGE_RIM, z = az + uz * (d + 2.5) + nz * GORGE_RIM, rot = Math.atan2(ux, uz);
      const c = addBox(x, z, 0.7, 3.4, rot, 'gorge'); if (Math.abs(x - BRIDGE1.x) < 6) parts.gap1.push(c); }
  }
  // rock faces down both walls (one instanced mesh)
  { const pts = []; for (const side of [-1, 1]) for (let i = 0; i < GORGE.length - 1; i++) { const [ax, az] = GORGE[i], [bx2, bz] = GORGE[i + 1], len = Math.hypot(bx2 - ax, bz - az), ux = (bx2 - ax) / len, uz = (bz - az) / len, nx = -uz * side, nz = ux * side;
      for (let d = 0; d < len; d += 5.5) { const x = ax + ux * d + nx * (GORGE_W + 2.5), z = az + uz * d + nz * (GORGE_W + 2.5); if (Math.abs(x - BRIDGE1.x) < 5) continue; const y = heightAt(x, z); if (y < -6) continue; pts.push([x, y, z]); } }
    const geo = new THREE.DodecahedronGeometry(1, 0), im = new THREE.InstancedMesh(geo, M.rockDark, pts.length), o = new THREE.Object3D();
    pts.forEach(([x, y, z], i) => { o.position.set(x, y - 2, z); o.rotation.set(i * 1.3, i * 2.1, i * 0.7); o.scale.set(4.5 + (i % 3), 7 + (i % 4) * 1.5, 4.5 + ((i + 1) % 3)); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
    im.castShadow = im.receiveShadow = true; scene.add(im); }
  // the drawbridge: a winch on the south rim, posts on both, and a deck hinged at the north end (standing up while raised)
  const B = BRIDGE1, yS = heightAt(B.x, B.zS), yN = heightAt(B.x, B.zN), len = B.zS - B.zN;
  for (const [z, y] of [[B.zS, yS], [B.zN, yN]]) for (const sx of [-1, 1]) { const g = new THREE.Group(); cy(0.45, 0.55, 8, M.beam, 0, 4, 0, g, 8); bx(1.2, 0.7, 1.2, M.iron, 0, 8.2, 0, g); g.position.set(B.x + sx * 2.9, y, z); scene.add(g); addCircle(B.x + sx * 2.9, z, 0.4); }
  const deck = new THREE.Group(), pivot = new THREE.Group(); pivot.position.set(B.x, yN + 0.25, B.zN); scene.add(pivot);
  for (let i = 0; i < len / 0.6; i++) { const p = bx(4.4, 0.18, 0.55, M.plank, 0, 0, 0.3 + i * 0.6, deck); p.rotation.y = (Math.sin(i * 7.7) * 0.5) * 0.04; }
  for (const sx of [-1, 1]) { bx(0.25, 0.3, len, M.beam, sx * 2.1, 0.12, len / 2, deck); bx(0.12, 1.0, len, M.beam, sx * 2.25, 0.7, len / 2, deck); }
  pivot.add(deck); live.bridge1 = { pivot, deck, yS, yN, len, open: 0, want: 0 };
  // the chains run from the raised deck's far end to the posts (shown while raised)
  setBridge(live.bridge1, 0);
  // the winch
  { const g = new THREE.Group(); bx(1.6, 0.9, 1.2, M.beam, 0, 0.45, 0, g); const drum = cy(0.45, 0.45, 1.5, M.iron, 0, 1.2, 0, g, 12); drum.rotation.z = Math.PI / 2; const axle = cy(0.06, 0.06, 2.2, M.iron, 0, 1.2, 0, g, 6); axle.rotation.z = Math.PI / 2;
    g.position.set(B.x + 4.6, yS, B.zS + 2.5); scene.add(g); addBox(B.x + 4.6, B.zS + 2.5, 0.8, 0.6, 0);
    const crank = new THREE.Group(); bx(0.08, 0.7, 0.08, M.iron, 0, -0.3, 0, crank); bx(0.08, 0.08, 0.5, M.iron, 0, -0.62, 0.22, crank); crank.position.set(0.95, 1.2, 0); crank.visible = false; g.add(crank); live.crank = crank;
    use(B.x + 4.6, B.zS + 2.5, () => isle().bridge1 ? null : isle().crank ? 'Lower the drawbridge' : 'Winch (the crank handle is missing)', () => winch()); }
}
function setBridge(b, k) { b.pivot.rotation.order = 'YXZ'; const down = -Math.atan2(b.yS - b.yN, b.len), up = -Math.PI / 2 * 0.97; b.pivot.rotation.x = up + (down - up) * k; }

// the Crown Ridge: an unbroken wall along its crest, but for the two cuts; each cut has walls down both sides
function buildRidge(scene) {
  const { M, bx, cy } = H, C = CROWN;
  // walls at the foot of the mountains, outside and in, so nobody climbs them; boulders along the outer foot show where
  const foot = []; for (const [rr, out] of [[C.rOut - 4, true], [C.rIn + 8, false]]) { const n = Math.round(rr * Math.PI * 2 / 5.5);
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, x = C.x + Math.cos(a) * rr, z = C.z + Math.sin(a) * rr;
      if ([TUNNEL, GATE].some(cut => { const c = cutCoords(cut, x, z); return c.along > 0 && c.lat < cut.half + 5; })) continue; addCircle(x, z, 4.2, 'ridge'); if (out) foot.push([x, heightAt(x, z), z]); } }
  { const im = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), M.rockDark, foot.length), o = new THREE.Object3D();
    foot.forEach(([x, y, z], i) => { o.position.set(x, y + 0.6, z); o.rotation.set(i * 1.7, i * 2.3, i * 0.9); o.scale.set(3.2 + (i % 3) * 0.8, 2.6 + (i % 4) * 0.9, 3.2 + ((i + 2) % 3) * 0.8); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
    im.castShadow = im.receiveShadow = true; scene.add(im); }
  for (const cut of [TUNNEL, GATE]) for (const s of [-1, 1]) for (let a = cut.a0 - 6; a < cut.a1 + 2; a += 4) { const p = cutPoint(cut, a + 2, s * (cut.half + 0.9)); addBox(p.x, p.z, 0.6, 2.2, Math.atan2(cut.dx, cut.dz), 'cutwall'); }
  // the Gloomtunnel: timber frames every few metres like a mine, torches, and an iron portcullis at its mouth
  for (let a = TUNNEL.a0 + 6; a < TUNNEL.a1; a += 12) { const p = cutPoint(TUNNEL, a), g = new THREE.Group(), w = TUNNEL.half;
    for (const s of [-1, 1]) cy(0.25, 0.3, 6, M.beam, s * w, 3, 0, g, 7); bx(w * 2 + 1, 0.5, 0.5, M.beam, 0, 6, 0, g);
    if ((a / 12 | 0) % 2) { const t = cy(0.06, 0.06, 0.6, M.beam, w - 0.3, 3.4, 0, g, 5); t.rotation.z = 0.5; const f = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 4), M.torch); f.position.set(w - 0.5, 3.8, 0); g.add(f); }
    g.position.set(p.x, heightAt(p.x, p.z), p.z); g.rotation.y = Math.atan2(TUNNEL.dx, TUNNEL.dz) + Math.PI / 2; scene.add(g); }
  { const p = cutPoint(TUNNEL, TUNNEL.gate), y = heightAt(p.x, p.z), w = TUNNEL.half, frame = new THREE.Group(), gate = new THREE.Group();
    for (const s of [-1, 1]) bx(1.6, 9, 1.8, M.darkStone, s * (w + 0.6), 4.5, 0, frame); bx(w * 2 + 3, 1.6, 1.8, M.darkStone, 0, 9.4, 0, frame);
    for (let i = -w + 0.4; i <= w - 0.4; i += 0.7) cy(0.07, 0.07, 7.6, M.iron, i, 3.8, 0, gate, 5); for (let yy = 0.8; yy < 7.5; yy += 1.1) bx(w * 2, 0.12, 0.12, M.iron, 0, yy, 0, gate);
    for (let i = -w + 0.4; i <= w - 0.4; i += 0.7) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 5), M.iron); sp.position.set(i, -0.1, 0); sp.rotation.x = Math.PI; gate.add(sp); }
    const rot = Math.atan2(TUNNEL.dx, TUNNEL.dz) + Math.PI / 2; frame.position.set(p.x, y, p.z); frame.rotation.y = rot; scene.add(frame); gate.position.set(p.x, y, p.z); gate.rotation.y = rot; scene.add(gate);
    live.portcullis = { gate, y, open: 0, want: 0 };
    parts.tunnelGate.push(addBox(p.x, p.z, w + 0.5, 0.6, Math.atan2(TUNNEL.dx, TUNNEL.dz) + Math.PI / 2, 'tunnelgate'));
    // skulls on spikes either side of the mouth, a warning
    for (const s of [-1, 1]) { const q = cutPoint(TUNNEL, TUNNEL.gate + 6, s * (w + 3)); const g = new THREE.Group(); cy(0.06, 0.08, 3, M.beam, 0, 1.5, 0, g, 5); const sk = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), M.bone); sk.position.y = 3.1; g.add(sk); g.position.set(q.x, heightAt(q.x, q.z), q.z); scene.add(g); } }
  // the Great Gate: two stone towers, the moat, a drawbridge hinged on the city side (standing up: shut), and the lever inside
  { const w = GATE.half, rot = Math.atan2(GATE.dx, GATE.dz);
    for (const s of [-1, 1]) { const p = cutPoint(GATE, GATE.moat0 - 3, s * (w + 3.4)), g = new THREE.Group(); bx(6, 22, 6, M.darkStone, 0, 11, 0, g); for (let k = 0; k < 4; k++) bx(1.4, 1.6, 1.4, M.darkStone, (k % 2 ? 2.3 : -2.3), 22.8, (k < 2 ? 2.3 : -2.3), g); const fl = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 5), M.goblinRed); fl.position.set(0, 17, 3.05); g.add(fl);
      g.position.set(p.x, heightAt(p.x, p.z), p.z); g.rotation.y = rot; scene.add(g); addBox(p.x, p.z, 3, 3, rot); }
    for (const a of [GATE.moat0 - 1, GATE.moat1 + 1]) { const p = cutPoint(GATE, a); parts.gap2.push(addBox(p.x, p.z, w + 0.4, 0.6, rot + Math.PI / 2, 'moat')); }
    const pin = cutPoint(GATE, GATE.moat0 - 1.5), pout = cutPoint(GATE, GATE.moat1 + 1.5), yIn = heightAt(pin.x, pin.z), yOut = heightAt(pout.x, pout.z), len = GATE.moat1 - GATE.moat0 + 3;
    const pivot = new THREE.Group(), deck = new THREE.Group(); pivot.position.set(pin.x, yIn + 0.25, pin.z); pivot.rotation.y = rot; scene.add(pivot);
    for (let i = 0; i < len / 0.6; i++) bx(w * 2 - 0.4, 0.2, 0.55, M.plank, 0, 0, 0.3 + i * 0.6, deck); for (const sx of [-1, 1]) bx(0.3, 0.35, len, M.iron, sx * (w - 0.4), 0.12, len / 2, deck);
    pivot.add(deck); live.bridge2 = { pivot, deck, yS: yOut, yN: yIn, len, open: 0, want: 0 }; setBridge(live.bridge2, 0);
    const lv = cutPoint(GATE, GATE.moat0 - 12, w - 1.6), g = new THREE.Group(); bx(0.6, 1, 0.6, M.darkStone, 0, 0.5, 0, g); const arm = new THREE.Group(); cy(0.06, 0.06, 1.4, M.iron, 0, 0.7, 0, arm, 6); const kn = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), M.goblinRed); kn.position.y = 1.4; arm.add(kn); arm.position.y = 1; arm.rotation.x = 0.6; g.add(arm);
    g.position.set(lv.x, heightAt(lv.x, lv.z), lv.z); g.rotation.y = rot; scene.add(g); live.lever = arm;
    use(lv.x, lv.z, () => isle().gate2 ? null : 'Pull the lever (lower the Great Gate)', () => pullLever()); }
}
function buildTribe(scene, id, t) {
  const { M, tent, campfire, placeGroup, bx, cy, barrel } = H;
  const mat = id === 'bloodfang' ? M.goblinRed : id === 'mudfoot' ? M.mud : M.boneCloth;
  const toward = Math.atan2(-t.z, -t.x); // the gate faces the middle of the island
  const stake = new THREE.CylinderGeometry(0.03, 0.24, 3.8, 6);
  for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2; if (Math.abs(Math.sin((a - toward) / 2)) < 0.09) continue; const x = t.x + Math.cos(a) * t.r, z = t.z + Math.sin(a) * t.r;
    const m = new THREE.Mesh(stake, M.beam); m.castShadow = true; m.position.set(x, heightAt(x, z) + 1.6, z); m.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25); scene.add(m); addCircle(x, z, 0.5); }
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28 + 0.6; tent(scene, t.x + Math.cos(a) * t.r * 0.62, t.z + Math.sin(a) * t.r * 0.62, a + 1.6, i % 2 ? M.hide : mat, 1.15); }
  const fg = new THREE.Group(); campfire(fg, scene, t.x, t.z); placeGroup(fg, t.x, t.z, 0, scene); addCircle(t.x, t.z, 0.9); H.fire(scene, t.x, heightAt(t.x, t.z) + 0.5, t.z, 1);
  for (let i = 0; i < 4; i++) barrel(scene, t.x - t.r * 0.4 + (i % 2) * 0.9, t.z + t.r * 0.35 + (i >> 1) * 0.9);
  // the tribe's war totem: a carved pole in tribe colours with a skull on top (it topples when the chief dies)
  const tp = { x: t.x + Math.cos(toward + Math.PI) * 9, z: t.z + Math.sin(toward + Math.PI) * 9 }, g = new THREE.Group();
  for (let k = 0; k < 4; k++) { const seg = cy(0.55 - k * 0.06, 0.6 - k * 0.06, 1.6, k % 2 ? mat : M.beam, 0, 0.8 + k * 1.6, 0, g, 8); const face = bx(0.7, 0.35, 0.2, M.dark, 0, 1.0 + k * 1.6, 0.52 - k * 0.05, g); }
  for (const s of [-1, 1]) bx(1.6, 0.25, 0.3, mat, s * 0.9, 6.0, 0, g, 0, 0, s * 0.3);
  const sk = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), M.bone); sk.position.y = 7.0; g.add(sk);
  g.position.set(tp.x, heightAt(tp.x, tp.z), tp.z); g.rotation.y = toward + Math.PI; scene.add(g); addCircle(tp.x, tp.z, 0.7);
  live.totems[id] = { g, k: 0, want: 0 };
}
function buildLair(scene, l) {
  const { M, bx, cy } = H;
  // a cave mouth of piled boulders, gnawed bones and a cauldron
  const away = Math.atan2(l.z - CROWN.z, l.x - CROWN.x), g = new THREE.Group();
  for (let i = 0; i < 12; i++) { const a = -1.2 + i / 11 * 2.4, r = 7 + Math.sin(i * 2.1) * 0.8, rk = new THREE.Mesh(new THREE.DodecahedronGeometry(R(2.2, 3.4), 0), M.rockDark); rk.position.set(Math.sin(a) * r, R(1, 2.2) + Math.cos(a) * 3, -Math.cos(a) * r * 0.6 - 3); rk.castShadow = true; g.add(rk); }
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(3.4, 14, 0, Math.PI), new THREE.MeshBasicMaterial({ color: '#050403' })); mouth.position.set(0, 0.05, -4.2); g.add(mouth);
  for (let i = 0; i < 10; i++) { const b = cy(0.06, 0.08, R(0.6, 1.4), M.bone, R(-5, 5), 0.1, R(-1, 5), g, 5); b.rotation.set(Math.PI / 2, R(0, 3), 0); }
  const pot = cy(1.1, 0.8, 1.2, M.iron, 3, 0.6, 2, g, 12);
  g.position.set(l.x, heightAt(l.x, l.z), l.z); g.rotation.y = -away + Math.PI / 2; scene.add(g);
}

// ---------------- interactables ----------------
function use(x, z, label, fn) { (world.giUse || (world.giUse = [])).push({ x, z, label, use: fn }); }
const isle = () => (G.save && G.save.isle) || (G.save ? (G.save.isle = {}) : {});
function winch() {
  const I = isle(); if (I.bridge1) return;
  if (!I.crank) { G.hooks.toast && G.hooks.toast('The crank handle is missing. The Bloodfang Warchief carries it.', '⚙', 'bad'); return; }
  I.bridge1 = true; live.crank.visible = true; live.bridge1.want = 1; G.hooks.banner && G.hooks.banner('The drawbridge comes down', 'The way north across the Great Gorge is open', 3500); objectives();
}
function pullLever() { const I = isle(); if (I.gate2) return; I.gate2 = true; live.bridge2.want = 1; live.lever.rotation.x = -0.6; G.hooks.banner && G.hooks.banner('The Great Gate is down', 'A quick way between the city and the south', 3500); objectives(); }
// open what this hero has already opened (when the game starts)
export function giApply(h) {
  if (!GI || !live.bridge1) return; const I = h.isle || (h.isle = {});
  live.bridge1.want = live.bridge1.open = I.bridge1 ? 1 : 0; setBridge(live.bridge1, live.bridge1.open); live.crank.visible = !!I.bridge1;
  live.bridge2.want = live.bridge2.open = I.gate2 ? 1 : 0; setBridge(live.bridge2, live.bridge2.open); live.lever.rotation.x = I.gate2 ? -0.6 : 0.6;
  const tun = !!(I.mudfoot && I.skull); live.portcullis.want = live.portcullis.open = tun ? 1 : 0;
  for (const id in live.totems) { const T = live.totems[id]; T.want = T.k = I[id] ? 1 : 0; T.g.rotation.z = T.k * 1.45; }
  syncColliders();
  for (const m of G.mobs) if (m.giChief && I[m.giChief]) { m.dead = true; m.hp = 0; m.root.visible = false; m.respawnT = 1e12; }
  for (const m of G.mobs) if (m.giLair && I['lair_' + m.giLair]) { m.dead = true; m.hp = 0; m.root.visible = false; m.respawnT = 1e12; }
  objectives();
}
function syncColliders() { const I = isle();
  if (!live.bridge1) return;
  for (const c of parts.gap1) c.on = !(live.bridge1.open > 0.95); for (const c of parts.gap2) c.on = !(live.bridge2.open > 0.95); for (const c of parts.tunnelGate) c.on = !(live.portcullis.open > 0.9);
  if (live.bridge1.open > 0.95 && !live.bridge1.surf) { live.bridge1.surf = true; const B = BRIDGE1; addSurface(B.x, (B.zS + B.zN) / 2, 2.2, (B.zS - B.zN) / 2, 0, live.bridge1.yN + 0.35, 0, live.bridge1.yS + 0.35); for (const s of [-1, 1]) for (let z = B.zN + 2; z < B.zS - 1; z += 4) parts.rail1.push(addBox(B.x + s * 2.5, z, 0.2, 2.1, 0, 'rail')); }
  if (live.bridge2.open > 0.95 && !live.bridge2.surf) { live.bridge2.surf = true; const pa = cutPoint(GATE, (GATE.moat0 + GATE.moat1) / 2), rot = Math.atan2(GATE.dx, GATE.dz); addSurface(pa.x, pa.z, GATE.half - 0.4, live.bridge2.len / 2, rot, live.bridge2.yN + 0.35, 0, live.bridge2.yS + 0.35); }
}
// the kill hook: chiefs drop what opens the way
export function giKill(m) {
  if (!GI || !G.save) return; const I = isle();
  if (m.giChief && !I[m.giChief]) { I[m.giChief] = true; m.respawnT = 1e12; const T = live.totems[m.giChief]; if (T) T.want = 1;
    const t = TRIBES[m.giChief];
    if (m.giChief === 'bloodfang') { I.crank = true; G.hooks.banner && G.hooks.banner('The Bloodfang Warchief is dead', 'You took his iron crank handle: the drawbridge winch at the Great Gorge', 5000); }
    else { const both = I.mudfoot && I.skull; G.hooks.banner && G.hooks.banner(`The ${t.name} chief is dead`, both ? 'Both war totems have fallen: the Gloomtunnel portcullis is rising' : `Their war totem falls. One more tribe holds the Gloomtunnel shut`, 5000); if (both) live.portcullis.want = 1; }
    objectives(); }
  if (m.giLair && !I['lair_' + m.giLair]) { I['lair_' + m.giLair] = true; m.respawnT = 1e12; G.hooks.toast && G.hooks.toast(`${m.name} is slain`, '🏆', 'gold'); objectives(); }
}
// every frame: bridges swing, the portcullis rises, totems topple
export function giTick(dt) {
  if (!GI || !live.bridge1) return;
  for (const b of [live.bridge1, live.bridge2]) if (b.open !== b.want) { b.open = Math.max(0, Math.min(1, b.open + Math.sign(b.want - b.open) * dt / 4)); const e = b.open < 1 ? Math.pow(b.open, 1.6) : 1; setBridge(b, e); if (b.open === b.want) syncColliders(); }
  const P = live.portcullis; if (P.open !== P.want) { P.open = Math.max(0, Math.min(1, P.open + dt / 5)); if (P.open >= 1) syncColliders(); }
  P.gate.position.y = P.y + P.open * 7.4;
  for (const id in live.totems) { const T = live.totems[id]; if (T.k < T.want) { T.k = Math.min(1, T.k + dt * 0.7); T.g.rotation.z = Math.pow(T.k, 2) * 1.45; } }
  if ((giTick.t = (giTick.t || 0) + dt) > 1) { giTick.t = 0; objectives(); }
}

// ---------------- enemies ----------------
const named = (type, name, extra) => Object.assign({}, MOBS[type], { name }, extra || {});
function mob(type, lv, x, z, name) { const m = new Mob(type, lv, x, z); if (name) m.def = named(type, name); G.mobs.push(m); return m; }
export function giSpawn() {
  if (!GI) return;
  const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  // the tribes: a chief, fighters round the fire, slingers on watch
  for (const [id, t] of Object.entries(TRIBES)) {
    const c = mob('goblin_brute', t.chiefLv, t.x, t.z - 4, t.chief); c.def = named('goblin_brute', t.chief, { elite: true }); c.giChief = id; c.bossy = true; c.maxHp = Math.round(c.maxHp * 2.6); c.hp = c.maxHp;
    const n = id === 'bloodfang' ? 9 : 12;
    for (let i = 0; i < n; i++) { const a = i / n * 6.28, r = R(5, t.r * 0.75), type = i % 4 === 1 ? 'goblin_slinger' : i % 5 === 3 ? 'goblin_brute' : 'goblin'; mob(type, ri(t.lv[0], t.lv[1]), t.x + Math.cos(a) * r, t.z + Math.sin(a) * r, `${t.name} ${MOBS[type].name.replace('Goblin ', '')}`); }
  }
  // troll lairs: a named troll and its kin
  for (const l of LAIRS) { const b = mob('troll_king', l.lv, l.x, l.z, l.name); b.giLair = l.id; b.bossy = true; for (let i = 0; i < l.adds; i++) mob('troll', l.lv - 1, l.x + R(-6, 6), l.z + R(-6, 6)); }
  // the Gloomtunnel: packs down its length
  for (const a of [130, 160, 190]) for (let i = 0; i < 4; i++) { const p = cutPoint(TUNNEL, a + R(-4, 4), R(-3, 3)); mob(i === 0 ? 'goblin_brute' : i === 3 ? 'goblin_slinger' : 'goblin', ri(7, 8), p.x, p.z, 'Gloomtunnel ' + ['Raider', 'Raider', 'Raider', 'Slinger'][i]).giTunnel = true; }
  // roaming packs: weaker in the south, tougher past the gorge, a few beasts and crabs on the shore
  const region = (x, z) => distToLine(x, z, GORGE).d > 0 && z > 120 ? 'south' : 'mid';
  for (let gx = -460; gx <= 460; gx += 70) for (let gz = -440; gz <= 420; gz += 70) {
    const x = gx + R(-25, 25), z = gz + R(-25, 25); if (heightAt(x, z) < 1.4 || giAvoid(x, z, 6)) continue;
    if (Math.hypot(x - CROWN.x, z - CROWN.z) < CROWN.rOut + 30) continue; if (Math.hypot(x - CAMP_SPOT.x, z - CAMP_SPOT.z) < 80) continue;
    if ([...Object.values(TRIBES), ...LAIRS].some(t => Math.hypot(t.x - x, t.z - z) < t.r + 30)) continue;
    const south = z > 130, roll = Math.random();
    if (south) { if (roll < 0.55) for (let i = 0; i < ri(2, 3); i++) mob(i === 2 ? 'goblin_slinger' : 'goblin', ri(1, 3), x + R(-6, 6), z + R(-6, 6), 'Idol-mad Goblin'); else if (roll < 0.8) for (let i = 0; i < 2; i++) mob('boar', ri(1, 2), x + R(-6, 6), z + R(-6, 6)); }
    else { if (roll < 0.6) for (let i = 0; i < ri(3, 4); i++) mob(i === 3 ? 'goblin_brute' : i === 2 ? 'goblin_slinger' : 'goblin', ri(4, 6), x + R(-7, 7), z + R(-7, 7), 'Idol-mad Goblin'); else if (roll < 0.8) for (let i = 0; i < 2; i++) mob('wolf', ri(4, 5), x + R(-6, 6), z + R(-6, 6)); }
  }
  for (let i = 0; i < 10; i++) { const a = 1.0 + i * 0.13, x = Math.cos(a + 0.4) * 470 - 60 + i * 12, z = 400 + Math.sin(i) * 20; if (heightAt(x, z) > 0.2 && heightAt(x, z) < 2) mob('crab', 1, x, z); }
}

// ---------------- the objective list ----------------
export function objectives() {
  if (!GI) return; let e = document.getElementById('giObj'); const h = G.save; if (!h) return;
  if (!e) { e = document.createElement('div'); e.id = 'giObj'; document.getElementById('hud').appendChild(e); }
  const I = h.isle || {}, row = (done, txt) => `<div class="${done ? 'done' : ''}">${done ? '✓' : '◆'} ${txt}</div>`;
  let html = '<b>Goblin Island</b>';
  if (!I.bridge1) html += row(I.bloodfang, 'Kill the Bloodfang Warchief (his village, west of the beach)') + row(false, 'Lower the drawbridge over the Great Gorge');
  else if (!(I.mudfoot && I.skull)) html += row(I.mudfoot, 'Topple the Mudfoot war totem (kill their chief in the western swamp)') + row(I.skull, 'Topple the Skullsplitter war totem (kill their chief in the eastern hills)') + row(false, 'Then the Gloomtunnel portcullis opens (east side of the Crown Ridge)');
  else html += row(false, 'Fight through the Gloomtunnel into the goblin city') + row(I.gate2, 'Pull the lever at the Great Gate (a quick way back south)');
  html += `<small>Troll lairs: ${LAIRS.filter(l => I['lair_' + l.id]).length}/${LAIRS.length}</small>`;
  if (e._h !== html) { e._h = html; e.innerHTML = html; }
}
