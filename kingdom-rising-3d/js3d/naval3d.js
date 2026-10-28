// Kingdom Rising 3D — the navy (js/warmarch.js, War.naval): the shipyard on its plot in town (registered into the
// realm buildings, realm3d.js), the harbour guns on their stone towers, and the warships of the Encircling Sea:
// Valenmoor's galleons with a row of cannon down each side, Aelindor's longships with great bolt throwers on deck.
// Ships ride the swell at the waterline, lean into their turns, flash and smoke when they fire, and settle by the
// stern when they sink. K3.navalModel(e) is called by actors.js for any entity with e.navalKind.
import { THREE, K3, PX, TS } from './core.js';
import { geo } from './geo.js';
import { MB } from './mb.js';
import { fx } from './fx.js';
import { buildShip } from './ships.js';
import { siegeModel } from './siege3d.js';
import { _realmTest } from './realm3d.js'; // (loaded first: the shipyard registers itself in its building table)

const KR = window.KR, D = KR.D, G = KR.G;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const banner = (f) => ((D.FACTIONS[f] || {}).banner || '#7a1e1e');
const trimOf = (f) => ((D.FACTIONS[f] || {}).trim || '#e0c060');
const waterY = (x, y) => { const w = geo.waterAt(x, y); return Number.isFinite(w) ? w : geo.floorAt(x, y); };

// ---------------- the shipyard (a building on its plot; local frame: front toward the street at +z) ----------------
// a hull on the stocks: keel along x, ribs rising and, as the yard grows, planking and a mast
function hullOnStocks(mb, L, B, H, stage, f) {
  for (let i = 0; i < 6; i++) { const x = -L / 2 + (L * (i + 0.5)) / 6; mb.boxB('timber', x, 0, 0, 0.5, 0.55, B * 0.9, '#4e3520'); } // the stocks
  mb.box('timber', 0, 0.75, 0, L, 0.32, 0.36, '#6a4a2c'); // the keel
  mb.beam('timber', V(L / 2, 0.75, 0), V(L / 2 + 0.9, H + 0.6, 0), 0.32, 0.36, '#6a4a2c'); // stem
  mb.beam('timber', V(-L / 2, 0.75, 0), V(-L / 2 - 0.4, H + 0.3, 0), 0.32, 0.36, '#6a4a2c'); // sternpost
  const ribs = 11;
  for (let i = 1; i < ribs; i++) {
    const t = i / ribs, x = -L / 2 + L * t, w = (B / 2) * Math.pow(Math.sin(Math.PI * t), 0.6);
    for (const s of [-1, 1]) {
      const a = V(x, 0.8, 0), b = V(x, 0.8 + H * 0.35, s * w * 0.92), c = V(x, H, s * w);
      mb.beam('timber', a, b, 0.18, 0.2, '#7a5a38'); mb.beam('timber', b, c, 0.18, 0.2, '#7a5a38');
    }
  }
  if (stage >= 2) { // planking up one side and half the other: the yard is busy
    for (let k = 0; k < 6; k++) { const y = 0.9 + k * (H - 0.9) / 6; for (const s of [-1, 1]) { if (s > 0 && k > 3) continue; const w = (B / 2) * (0.8 + 0.2 * k / 6); mb.box('planks', 0, y, s * w, L * (stage >= 3 ? 0.96 : 0.7), (H - 0.9) / 6 + 0.02, 0.1, k % 2 ? '#8a6a44' : '#7a5a38'); } }
  }
  if (stage >= 3) { // decked, with a mast stepped and her colours run up
    mb.box('planks', 0, H - 0.05, 0, L * 0.92, 0.12, B * 0.86, '#9a7a50');
    mb.cylB('timber', L * 0.08, H, 0, 0.22, 9, '#5a3e24', 8); mb.box('timber', L * 0.08, H + 7.2, 0, 0.16, 0.16, B * 1.3, '#5a3e24');
    mb.box('cloth2', L * 0.08 + 0.2, H + 8.6, 0, 0.04, 1.4, 2.2, banner(f));
  }
}
function crane(mb, x, z, h, ry) {
  const c = Math.cos(ry), s = Math.sin(ry); const P = (lx, ly, lz) => V(x + c * lx + s * lz, ly, z - s * lx + c * lz);
  for (const sx of [-0.7, 0.7]) mb.beam('timber', P(sx, 0, 0), P(0, h, 0), 0.24, 0.24, '#5a3e24');
  mb.beam('timber', P(0, h, 0), P(0, h * 0.8, h * 0.6), 0.2, 0.2, '#5a3e24'); mb.rod('rope', P(0, h * 0.8, h * 0.6), P(0, h * 0.25, h * 0.6), 0.03, '#c8b080');
  const q = P(0, h * 0.2, h * 0.6); mb.box('planks', q.x, q.y, q.z, 0.8, 0.5, 0.8, '#8a6a44'); // a load of planks on the hook
}
function timberStack(mb, x, z, n, len, ry = 0) { for (let i = 0; i < n; i++) mb.boxB('planks', x, i * 0.2, z, len, 0.18, 0.5 + (i % 3) * 0.08, i % 2 ? '#a07848' : '#8a6438', ry + (i % 2 ? 0.03 : -0.03)); }
function shipyard(mb, out, f, lv, w, d) {
  const L = Math.min(w * 0.82, 14), B = Math.min(d * 0.55, 5), H = 2.6 + lv * 0.3;
  mb.boxB('planks', 0, 0, 0, w * 0.96, 0.14, d * 0.92, '#6a5034'); // the yard's floor of planks
  hullOnStocks(mb, L, B, H, lv, f);
  if (lv >= 2) { // a great open shed over the slip: posts, tie beams and a long roof
    const sh = H + 2.4 + lv * 0.6, sw = L + 2.4, sd = B + 2.6;
    for (let i = 0; i <= 4; i++) for (const s of [-1, 1]) mb.boxB('timber', -sw / 2 + (sw * i) / 4, 0, s * sd / 2, 0.32, sh, 0.32, '#4e3520');
    for (const s of [-1, 1]) mb.box('timber', 0, sh, s * sd / 2, sw + 0.4, 0.28, 0.28, '#4e3520');
    const rise = sd * 0.35, slope = Math.hypot(sd / 2 + 0.5, rise), ang = Math.atan2(rise, sd / 2 + 0.5);
    for (const s of [-1, 1]) mb.box(lv >= 3 ? 'shingle' : 'planks', 0, sh + rise / 2 + 0.08, s * (sd / 4 + 0.25), sw + 1.0, 0.12, slope, lv >= 3 ? '#6a3a2a' : '#7a5e3a', 0, s * ang, 0);
    mb.box('timber', 0, sh + rise + 0.12, 0, sw + 1.2, 0.24, 0.24, '#4e3520');
    crane(mb, w * 0.42, -d * 0.32, 6 + lv, Math.PI * 0.75);
  }
  if (lv >= 3) { // a stone loft for the sailmakers and riggers at the back, with the kingdom's banner
    mb.boxB('stone', -w * 0.36, 0, -d * 0.36, w * 0.24, 5.2, d * 0.22, '#a8a090');
    mb.box('shingle', -w * 0.36, 5.6, -d * 0.36, w * 0.28, 0.9, d * 0.26, '#5a3a2a');
    for (let i = 0; i < 3; i++) mb.box('dark', -w * 0.36 - w * 0.08 + i * w * 0.08, 3.4, -d * 0.36 + d * 0.11 + 0.02, 0.5, 0.8, 0.04, '#1a1410');
    out.flags.push({ x: -w * 0.36, y: 8.2, z: -d * 0.36, f }); mb.cylB('timber', -w * 0.36, 5.8, -d * 0.36, 0.08, 2.6, '#4e3520', 8);
  }
  timberStack(mb, -w * 0.38, d * 0.36, 4 + lv * 2, 3.4); timberStack(mb, w * 0.34, d * 0.38, 3 + lv, 2.6, Math.PI / 2);
  for (let i = 0; i < lv + 1; i++) mb.cylB('rope', w * 0.1 + i * 0.9, 0, d * 0.42, 0.38, 0.32, '#c8b080', 12); // coils of rope
  mb.cylB('timber', -w * 0.46, 0, -d * 0.44, 0.09, 4.4, '#4e3520', 8); out.flags.push({ x: -w * 0.46, y: 4.2, z: -d * 0.44, f });
  out.work.push({ x: 0.6, z: B / 2 + 0.9, k: 'mine', ry: Math.PI, tool: 'hammer' });
  if (lv >= 2) out.work.push({ x: -L * 0.3, z: -B / 2 - 0.9, k: 'mine', ry: 0, tool: 'hammer' });
  if (lv >= 3) out.work.push({ k: 'carry', a: [-w * 0.38, d * 0.36], b: [L * 0.2, B / 2 + 0.7], load: 'planks' });
  return lv >= 3 ? 10 : lv >= 2 ? 7 : 4;
}
if (_realmTest && _realmTest.BUILD) _realmTest.BUILD.shipyard = shipyard;
K3.navalShipyard = shipyard;

// ---------------- harbour guns: a round stone tower with the gun (or great ballista) on its top ----------------
function towerModel(e) {
  const holder = new THREE.Group(); const H = 8.6;
  const m = new MB();
  m.cylB('stone', 0, 0, 0, 2.6, H, '#9a9284', 16, 2.3);
  m.cylB('stone', 0, H, 0, 2.8, 0.5, '#8a8274', 16);
  for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; m.boxB('stone', Math.cos(a) * 2.6, H + 0.5, Math.sin(a) * 2.6, 0.7, 0.8, 0.5, '#8a8274', -a); }
  for (const y of [2.2, 5.0]) { const a = 0.4; m.box('dark', Math.cos(a) * 2.5, y, Math.sin(a) * 2.5, 0.12, 0.9, 0.3, '#151210', -a); }
  m.box('cloth2', 0, H - 1.6, 2.45, 1.2, 2.2, 0.04, banner(e.faction)); m.box('gold', 0, H - 1.6, 2.47, 0.5, 0.5, 0.02, trimOf(e.faction));
  holder.add(m.build());
  const gm = siegeModel({ faction: e.faction, big: true, siege: e.faction === 'sylvan' ? 'greatballista' : 'bigcannon' });
  let parts = { anim: () => {} };
  if (gm) { gm.obj.position.y = H + 0.5; gm.obj.scale.multiplyScalar(0.85); holder.add(gm.obj); parts = gm.parts; }
  const P = Object.assign({}, parts, { anim: (av, ent, dt) => { if (parts.anim) parts.anim(av, ent, dt); } });
  return { obj: holder, parts: P, height: H + 2.4 };
}

// ---------------- warships ----------------
function shipModel(e) {
  const galleon = e.navalKind === 'galleon';
  const holder = new THREE.Group(); const inner = new THREE.Group(); holder.add(inner);
  const hull = buildShip(galleon ? 'galleon' : 'sloop', galleon ? 0.15 : 0.35); inner.add(hull);
  const S = galleon ? { L: 22, B: 6.6, G: 2.1 } : { L: 15, B: 3.4, G: 0.95 };
  const m = new MB(); const guns = [];
  if (galleon) { // a row of cannon run out through the ports on each side
    for (const s of [-1, 1]) for (let i = 0; i < 5; i++) {
      const z = -6 + i * 3; const t = 0.5 + z / S.L; const half = (S.B / 2) * Math.pow(Math.sin(Math.PI * Math.max(0.05, Math.min(0.95, t))), 0.42) * 0.97;
      m.box('dark', s * (half + 0.02), 1.25, z, 0.05, 0.75, 0.75, '#140e0a');
      m.box('paint', s * (half + 0.06), 1.25, z, 0.04, 0.95, 0.95, '#c8a040'); // a gilded port frame
      m.cyl('metalv', s * (half + 0.75), 1.25, z, 0.26, 1.6, '#55565c', 12, 0.2, 0, 0, Math.PI / 2); // the gun run out
      m.cyl('metalv', s * (half + 1.52), 1.25, z, 0.29, 0.14, '#3a3b40', 12, null, 0, 0, Math.PI / 2); // its muzzle ring
      guns.push([s * (half + 1.6), 1.25, z]);
    }
    m.box('cloth2', 0, 2.2, -S.L / 2 + 0.6, 2.4, 1.4, 0.05, banner(e.faction));
  } else { // two great bolt throwers on turntables, fore and aft
    for (const z of [-4.4, 4.0]) { // a carved post standing up out of the hull, the long stock on top and the great bow across it
      const y0 = S.G + 0.2, y1 = S.G + 1.7;
      m.cylB('timber', 0, y0, z, 0.6, 0.25, '#5a3e24', 12); m.cylB('bark', 0, y0 + 0.25, z, 0.22, y1 - y0 - 0.25, '#6a5a3a', 10);
      m.box('timber', 0, y1 + 0.12, z, 0.36, 0.28, 3.2, '#8a6a3a'); m.box('gold', 0, y1 + 0.3, z, 0.08, 0.05, 3.0, trimOf(e.faction));
      for (const sx of [-1, 1]) { m.beam('timber', V(0, y1 + 0.2, z + 1.3), V(sx * 1.2, y1 + 0.35, z + 0.9), 0.14, 0.16, '#6a4a2a'); m.beam('timber', V(sx * 1.2, y1 + 0.35, z + 0.9), V(sx * 2.0, y1 + 0.45, z + 0.2), 0.12, 0.14, '#6a4a2a'); m.rod('rope', V(sx * 2.0, y1 + 0.45, z + 0.2), V(0, y1 + 0.3, z - 0.4), 0.025, '#e8dcb8'); }
      m.sph('metalv', 0, y1 + 0.32, z + 1.7, 0.09, 0.09, 0.32, '#9aa0a6', 0, 8); // the bolt's head
      guns.push([0, y1 + 0.2, z]);
    }
  }
  inner.add(m.build());
  const P = { inner, galleon, guns, lean: 0, lastH: null };
  P.anim = (av, ent, dt) => shipAnim(P, av, ent, dt);
  return { obj: holder, parts: P, height: galleon ? 12 : 8 };
}
function shipAnim(P, av, e, dt) {
  // the parent was placed on the sea bed and turned to the way it moved: sit the ship on the water, bow on its heading
  av.obj.rotation.x = 0; av.obj.rotation.z = 0;
  const wy = waterY(e.x, e.y); const t = K3.time + (e.id % 7);
  const want = Math.atan2(Math.cos(e.heading || 0), Math.sin(e.heading || 0));
  P.inner.rotation.y = want - av.obj.rotation.y;
  // lean into a turn, ride the swell
  const dh = P.lastH == null ? 0 : Math.atan2(Math.sin((e.heading || 0) - P.lastH), Math.cos((e.heading || 0) - P.lastH)); P.lastH = e.heading || 0;
  const turn = dt > 0 ? K3.clamp(dh / dt, -0.6, 0.6) : 0; P.lean += (turn * (e.vel || 0) / 160 * 0.12 - P.lean) * Math.min(1, dt * 2);
  let y = wy - av.obj.position.y + Math.sin(t * 1.1) * 0.12, rx = Math.sin(t * 1.3 + 1) * 0.015, rz = Math.sin(t * 0.9) * 0.03 + P.lean;
  // a broadside rocks her
  const since = (G.now - (e.fireAt || -1e9)) / 1000; if (since < 1.5) rz += Math.sin(since * 9) * Math.exp(-since * 3) * 0.05;
  if (e.sinking) { const k = Math.min(1, (e.sinkT || 0) / 9); y -= k * k * 9; rx += k * 0.35; rz += k * 0.25; }
  P.inner.position.y = y; P.inner.rotation.x = rx; P.inner.rotation.z = rz;
  // her wake
  if (e.moving && Math.random() < dt * 8 && av.obj.visible) { const a = e.heading || 0, back = P.galleon ? 10 : 7; const bx = av.obj.position.x - Math.cos(a) * back, bz = av.obj.position.z - Math.sin(a) * back;
    fx.smoke.emit({ x: bx + (Math.random() - 0.5) * 2, y: wy + 0.1, z: bz + (Math.random() - 0.5) * 2, vy: 0.05, life: 2.6, s0: 0.8, s1: 2.6, r: 0.92, g: 0.95, b: 0.98, a: 0.35, kind: 2, drag: 0.6 }); }
}

K3.navalModel = function (e) {
  if (e.navalKind === 'harbourgun') return towerModel(e);
  if (e.navalKind === 'galleon' || e.navalKind === 'longship') return shipModel(e);
  return null;
};

// ---------------- effects: muzzle fire, splashes, splinters, a ship going down ----------------
function splash(x, z, wy, big) {
  const n = big ? 46 : 30;
  for (let i = 0; i < n; i++) { const a = Math.random() * TAU, r = Math.random() * (big ? 1.4 : 1.0);
    fx.smoke.emit({ x: x + Math.cos(a) * r, y: wy + 0.1, z: z + Math.sin(a) * r, vx: Math.cos(a) * (0.6 + Math.random()), vy: 4 + Math.random() * (big ? 7 : 5), vz: Math.sin(a) * (0.6 + Math.random()), grav: 9, life: 1.3 + Math.random() * 0.5, s0: 0.35, s1: 0.9, r: 0.9, g: 0.95, b: 1, a: 0.75, kind: 2 }); }
  for (let i = 0; i < 10; i++) fx.smoke.emit({ x: x + (Math.random() - 0.5) * 3, y: wy + 0.3, z: z + (Math.random() - 0.5) * 3, vy: 0.4, life: 2.8, s0: 1.2, s1: 3.4, r: 0.9, g: 0.93, b: 0.96, a: 0.3, kind: 2, drag: 0.8 });
}
function splinters(x, y, z) {
  for (let i = 0; i < 26; i++) { const a = Math.random() * TAU; fx.smoke.emit({ x, y, z, vx: Math.cos(a) * (2 + Math.random() * 4), vy: 2 + Math.random() * 5, vz: Math.sin(a) * (2 + Math.random() * 4), grav: 12, life: 1.2, s0: 0.18, s1: 0.12, r: 0.45, g: 0.3, b: 0.18, a: 1, kind: 2 }); }
  for (let i = 0; i < 12; i++) fx.smoke.emit({ x: x + (Math.random() - 0.5), y: y + 0.5, z: z + (Math.random() - 0.5), vy: 0.8 + Math.random(), life: 3, s0: 0.8, s1: 2.8, r: 0.3, g: 0.28, b: 0.26, a: 0.5, kind: 2, drag: 0.5 });
  fx.burst(x, y, z, 16, '#ffb050', { speed: 4, life: 0.3 });
}
function muzzle(ev) {
  const ca = Math.cos(ev.ang || 0), sa = Math.sin(ev.ang || 0);
  const base = ev.ship ? waterY(ev.x, ev.y) + 1.4 : geo.floorAt(ev.x, ev.y) + 9.4;
  const off = ev.ship ? 4.2 : 3.4; const x = ev.x * PX + ca * off, z = ev.y * PX + sa * off;
  if (ev.gun) {
    fx.burst(x, base, z, 34, '#ffb040', { speed: 6, life: 0.25 });
    for (let i = 0; i < 30; i++) fx.smoke.emit({ x: x + (Math.random() - 0.5) * 0.6, y: base + (Math.random() - 0.5) * 0.6, z: z + (Math.random() - 0.5) * 0.6, vx: ca * (2 + Math.random() * 5) + (Math.random() - 0.5), vy: 0.3 + Math.random() * 0.8, vz: sa * (2 + Math.random() * 5) + (Math.random() - 0.5), drag: 1.4, life: 3 + Math.random() * 2, s0: 0.8, s1: 3.8, r: 0.82, g: 0.8, b: 0.76, a: 0.55, kind: 2 });
  } else fx.burst(x, base, z, 8, '#e8d8b0', { speed: 2, life: 0.2 });
}
function drain() {
  const N = KR.War && KR.War.naval; if (!N || !N.events.length) return;
  const evs = N.events.splice(0, N.events.length);
  for (const ev of evs) {
    if (ev.k === 'muzzle') muzzle(ev);
    else if (ev.k === 'splash') splash(ev.x * PX, ev.y * PX, waterY(ev.x, ev.y), ev.big);
    else if (ev.k === 'splinters') splinters(ev.x * PX, waterY(ev.x, ev.y) + 2, ev.y * PX);
    else if (ev.k === 'sink') { splash(ev.x * PX, ev.y * PX, waterY(ev.x, ev.y), true); splinters(ev.x * PX, waterY(ev.x, ev.y) + 3, ev.y * PX); }
  }
}
K3.updaters.push(() => { try { drain(); } catch (er) { if (!drain._w) { drain._w = true; console.warn('naval3d', er); } } });
export const _navalTest = { shipModel, towerModel, shipyard };
