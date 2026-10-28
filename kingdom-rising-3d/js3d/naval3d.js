// Kingdom Rising 3D — the navy (js/warmarch.js, War.naval): the shipyard on its plot in town (registered into the
// realm buildings, realm3d.js), the harbour guns on their stone towers, and the warships of the Encircling Sea:
// Valenmoor's galleons with a row of cannon down each side, Aelindor's longships with great bolt throwers on deck.
// Ships ride the swell at the waterline, lean into their turns, flash and smoke when they fire, and settle by the
// stern when they sink. K3.navalModel(e) is called by actors.js for any entity with e.navalKind.
import { THREE, K3, PX, TS } from './core.js';
import { geo } from './geo.js';
import { MB, PRIM } from './mb.js';
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
// The hull comes from ships.js (opts.warship: its own sails, no merged oars); on top of it each warship gets her fittings
// (gratings, capstan, wheel, stern gallery, figurehead, lanterns, ratlines), her guns in two run-out groups, rowing oars
// for the longship, a crew at work, pennants, and damage that grows as she is hurt: shot holes, fires and a broken mast.
// Ships far from the camera show the hull and sails only.
const SHIPS = {
  galleon: { L: 22, B: 6.6, G: 2.1, cog: true, deck: 1.98, aft: 4.9, fore: 4.6, masts: [{ z: 2.2, h: 19 }, { z: -5.4, h: 13 }], drop: 0.12 },
  longship: { L: 15, B: 3.4, G: 0.95, cog: false, deck: 0.4, masts: [{ z: 0.4, h: 10.5 }], drop: 0.55 },
};
// the hull's half beam and gunwale height at a point along her length (the same lines as ships.js)
function hullAt(S, z) {
  const t = Math.max(0, Math.min(1, z / S.L + 0.5));
  const hb = S.cog ? Math.pow(Math.sin(Math.PI * (0.05 + t * 0.9)), 0.42) * (t < 0.5 ? 0.86 + 0.14 * Math.min(1, t / 0.25) : 1) : Math.pow(Math.sin(Math.PI * t), 0.72);
  const e = 2 * t - 1; const sheer = S.cog ? 0.9 : 0.7;
  return { w: (S.B / 2) * hb, gun: S.G + sheer * e * e };
}
K3.shipDims = (kind) => SHIPS[kind] || null;
// a sailor: legs, a smock, a head with a cap, and arms that can move (built once per look, cloned after)
const sailorCache = new Map();
function sailor(shirt, cap) {
  const key = shirt + cap; let c = sailorCache.get(key);
  if (!c) {
    const b = new MB();
    for (const s of [-1, 1]) b.box('cloth', s * 0.11, 0.42, 0, 0.17, 0.84, 0.2, '#3a3028');
    b.box('cloth', 0, 1.12, 0, 0.46, 0.62, 0.28, shirt); b.box('leather', 0, 0.86, 0, 0.48, 0.08, 0.3, '#3a2616');
    b.sph('skin', 0, 1.62, 0, 0.26, 0.3, 0.27, '#c89a78'); b.sph('cloth', 0, 1.74, 0, 0.29, 0.16, 0.29, cap);
    const body = b.build();
    const a = new MB(); a.box('cloth', 0, -0.28, 0, 0.13, 0.56, 0.14, shirt); a.sph('skin', 0, -0.6, 0, 0.12, 0.12, 0.12, '#c89a78');
    const arm = a.build();
    c = { body, arm }; sailorCache.set(key, c);
  }
  const g = new THREE.Group(); g.add(c.body.clone());
  const arms = []; for (const s of [-1, 1]) { const ar = c.arm.clone(); ar.position.set(s * 0.3, 1.38, 0); g.add(ar); arms.push(ar); }
  g.userData.arms = arms; return g;
}
const SHIRTS = ['#c8bca0', '#8a3a2a', '#3a4a6a', '#d8d0bc', '#5a6a3a'];
function shipModel(e) {
  const galleon = e.navalKind === 'galleon'; const S = SHIPS[galleon ? 'galleon' : 'longship'];
  const holder = new THREE.Group(); const inner = new THREE.Group(); holder.add(inner);
  const hull = buildShip(galleon ? 'galleon' : 'sloop', galleon ? 0.15 : 0.35, { warship: true }); inner.add(hull);
  const sails = []; hull.traverse((o) => { if (o.userData && o.userData.sail) sails.push(o); });
  const detail = new THREE.Group(); inner.add(detail); // fittings, crew, rigging: near the camera only
  const m = new MB(); const guns = []; const gunSides = []; const fires = []; const holes = []; const lines = [];
  const ban = banner(e.faction), trim = trimOf(e.faction);
  const crew = []; const addCrew = (x, y, z, ry, job, shirt) => { const s = sailor(shirt || SHIRTS[crew.length % SHIRTS.length], job === 'gun' ? '#2a2a2a' : ['#8a2a2a', '#2a3a5a', '#5a4a2a'][crew.length % 3]); s.position.set(x, y, z); s.rotation.y = ry; s.userData.job = job; s.userData.ph = crew.length * 1.7; detail.add(s); crew.push(s); return s; };
  if (galleon) {
    // the guns, a battery down each side in its own group so it can run out and recoil
    for (const s of [-1, 1]) {
      const gm = new MB();
      for (let i = 0; i < 5; i++) {
        const z = -6 + i * 3; const { w } = hullAt(S, z); const half = w * 0.97;
        m.box('dark', s * (half + 0.02), 1.25, z, 0.05, 0.75, 0.75, '#140e0a');
        m.box('gold', s * (half + 0.06), 1.25, z, 0.04, 0.95, 0.95, trim); // a gilded port frame
        gm.cyl('metalv', s * (half + 0.75), 1.25, z, 0.26, 1.6, '#55565c', 12, 0.2, 0, 0, Math.PI / 2); // the gun run out
        gm.cyl('metalv', s * (half + 1.52), 1.25, z, 0.29, 0.14, '#3a3b40', 12, null, 0, 0, Math.PI / 2); // its muzzle ring
        gm.box('timber', s * (half - 0.7), S.deck + 0.25, z, 1.1, 0.5, 0.8, '#5a3e24'); // the truck carriage inboard
        gm.cyl('metalv', s * (half - 0.35), S.deck + 0.55, z, 0.22, 1.2, '#4a4b50', 10, 0.18, 0, 0, Math.PI / 2);
        guns.push([s * (half + 1.6), 1.25, z]);
        if (i % 2 === 0) addCrew(s * (half - 1.6), S.deck, z + 0.6, s > 0 ? -Math.PI / 2 : Math.PI / 2, 'gun');
      }
      const go = gm.build(); inner.add(go); gunSides.push({ obj: go, s, kick: 0 });
    }
    // gratings, the capstan, the ship's wheel on the quarterdeck
    for (const z of [-1.4, 4.4]) { m.box('timber', 0, S.deck + 0.08, z, 2.0, 0.16, 1.6, '#5a3e24'); for (let k = -3; k <= 3; k++) { m.box('dark', k * 0.26, S.deck + 0.17, z, 0.08, 0.02, 1.4, '#1a120c'); m.box('dark', 0, S.deck + 0.17, z + k * 0.2, 1.8, 0.02, 0.07, '#1a120c'); } }
    m.cylB('timber', 0, S.deck, -2.6, 0.45, 1.0, '#6a4a2c', 12, 0.38); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; m.box('timber', Math.cos(a) * 0.9, S.deck + 0.85, -2.6 + Math.sin(a) * 0.9, 1.6, 0.08, 0.08, '#8a6a44', -a); }
    for (let k = 0; k < 3; k++) addCrew(Math.cos(k * 2.1) * 1.5, S.deck, -2.6 + Math.sin(k * 2.1) * 1.5, -k * 2.1, 'capstan');
    const wz = -8.2, wy = S.aft + 1.25; m.cyl('timber', 0, wy, wz, 0.75, 0.12, '#6a4a2c', 16, null, 0, Math.PI / 2, 0); m.cyl('gold', 0, wy, wz, 0.12, 0.2, trim, 8, null, 0, Math.PI / 2, 0);
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; m.box('timber', Math.cos(a) * 0.55, wy + Math.sin(a) * 0.55, wz, 0.06, 0.06, 0.06, '#8a6a44'); m.beam('timber', V(0, wy, wz), V(Math.cos(a) * 0.95, wy + Math.sin(a) * 0.95, wz), 0.05, 0.05, '#6a4a2c'); }
    m.boxB('timber', 0, S.aft, wz - 0.3, 0.3, 0.9, 0.3, '#4e3520');
    addCrew(0, S.aft, wz - 0.85, 0, 'helm', '#2a3a5a');
    // the stern gallery: gilded windows across the transom, and three stern lanterns
    const sz = -S.L / 2 + 0.25; for (let k = -2; k <= 2; k++) { m.box('dark', k * 0.9, 4.1, sz - 0.05, 0.6, 0.9, 0.06, '#241a10'); m.box('glow', k * 0.9, 4.1, sz - 0.07, 0.5, 0.75, 0.02, '#ffcf80'); m.box('gold', k * 0.9, 4.65, sz - 0.08, 0.75, 0.1, 0.06, trim); }
    m.box('gold', 0, 3.5, sz - 0.08, 5.0, 0.12, 0.08, trim); m.box('paint', 0, 5.4, sz - 0.08, 3.6, 0.8, 0.06, ban); m.box('gold', 0, 5.4, sz - 0.1, 0.9, 0.5, 0.04, trim);
    for (const x of [-1.6, 1.6]) { m.cyl('metalv', x, 7.6, sz - 0.4, 0.22, 0.5, '#2e2e30', 8); m.sph('glow', x, 7.6, sz - 0.4, 0.3, 0.38, 0.3, '#ffcf80'); }
    // the figurehead: a gilded lion leaping from the stem
    const fz = S.L / 2 + 0.55, fy = 3.3;
    m.sph('gold', 0, fy, fz, 0.55, 0.5, 1.2, trim, 0, 12); m.sph('gold', 0, fy + 0.45, fz + 0.85, 0.5, 0.5, 0.5, trim, 0, 12);
    m.add('gold', PRIM.ico, MB.mat(0, fy + 0.45, fz + 0.72, 0.95, 0.95, 0.7), '#c89a30'); m.sph('dark', 0, fy + 0.3, fz + 1.1, 0.18, 0.12, 0.08, '#2a1a0a');
    for (const s of [-1, 1]) m.beam('gold', V(s * 0.25, fy - 0.1, fz + 0.5), V(s * 0.35, fy - 0.7, fz + 1.2), 0.16, 0.16, trim);
    m.cyl('metalv', 0, S.fore + 1.2, S.L / 2 - 1.0, 0.2, 0.4, '#2e2e30', 8); m.sph('glow', 0, S.fore + 1.2, S.L / 2 - 1.0, 0.24, 0.3, 0.24, '#ffcf80');
    // crew on the forecastle and in the waist
    addCrew(0.6, S.fore, S.L / 2 - 2.2, Math.PI, 'look'); addCrew(-1.6, S.deck, 1.0, Math.PI / 2, 'haul'); addCrew(1.7, S.deck, 6.4, -Math.PI / 2, 'haul');
  } else { // two great bolt throwers on turntables, fore and aft
    for (const z of [-4.4, 4.0]) {
      const y0 = S.G + 0.2, y1 = S.G + 1.7;
      m.cylB('timber', 0, y0, z, 0.6, 0.25, '#5a3e24', 12); m.cylB('bark', 0, y0 + 0.25, z, 0.22, y1 - y0 - 0.25, '#6a5a3a', 10);
      m.box('timber', 0, y1 + 0.12, z, 0.36, 0.28, 3.2, '#8a6a3a'); m.box('gold', 0, y1 + 0.3, z, 0.08, 0.05, 3.0, trim);
      for (const sx of [-1, 1]) { m.beam('timber', V(0, y1 + 0.2, z + 1.3), V(sx * 1.2, y1 + 0.35, z + 0.9), 0.14, 0.16, '#6a4a2a'); m.beam('timber', V(sx * 1.2, y1 + 0.35, z + 0.9), V(sx * 2.0, y1 + 0.45, z + 0.2), 0.12, 0.14, '#6a4a2a'); m.rod('rope', V(sx * 2.0, y1 + 0.45, z + 0.2), V(0, y1 + 0.3, z - 1.2), 0.025, '#d8c8a0'); }
      m.sph('metalv', 0, y1 + 0.32, z + 1.7, 0.09, 0.09, 0.32, '#9aa0a6', 0, 8);
      guns.push([0, y1 + 0.2, z]);
      addCrew(0.7, S.deck + 0.3, z - 1.4, 0, 'gun', '#3a5a3a');
    }
    // oars in two banks that row, a rower on each bench, the steersman and his steering oar
    for (const s of [-1, 1]) {
      const om = new MB(); const pivots = [];
      for (let i = 0; i < 7; i++) { const z = -4.4 + i * 1.45; const { w, gun } = hullAt(S, z); pivots.push([s * (w + 0.05), gun - 0.12, z]); }
      const g = new THREE.Group();
      for (const [x, y, z] of pivots) { const o = new MB(); o.cyl('timber', s * 1.7, 0, 0, 0.045, 4.2, '#8a6440', 6, null, 0, 0, Math.PI / 2); o.box('timber', s * 3.7, 0, 0, 0.7, 0.04, 0.24, '#8a6440'); const ob = o.build(); const piv = new THREE.Group(); piv.position.set(x, y, z); piv.add(ob); g.add(piv); }
      inner.add(g); gunSides.push({ oars: g, s });
      for (let i = 0; i < 7; i += 2) { const z = -4.4 + i * 1.45; addCrew(s * 0.55, S.deck + 0.05, z - 0.35, s > 0 ? -Math.PI / 2 : Math.PI / 2, 'row', '#4a5a3a'); }
    }
    const st = hullAt(S, -S.L / 2 + 1.4); m.beam('timber', V(st.w + 0.1, st.gun + 0.6, -S.L / 2 + 1.4), V(st.w + 0.25, -0.9, -S.L / 2 + 0.9), 0.12, 0.12, '#5a3e24'); m.box('timber', st.w + 0.27, -0.6, -S.L / 2 + 0.85, 0.08, 1.1, 0.5, '#5a3e24');
    addCrew(st.w - 0.4, S.deck + 0.2, -S.L / 2 + 1.6, 0, 'helm', '#2e5a3a');
    m.cyl('metalv', 0, S.G + 1.6, -S.L / 2 + 0.8, 0.18, 0.35, '#2e2e30', 8); m.sph('glow', 0, S.G + 1.6, -S.L / 2 + 0.8, 0.2, 0.26, 0.2, '#ffcf80');
  }
  // ratlines: rungs across the shrouds from the rail to the masthead, for climbing aloft
  for (const ms of S.masts) {
    const topY = S.G - S.drop + ms.h - 0.6;
    for (const side of [-1, 1]) {
      const sh = [-1.4, -0.7, 0, 0.7].map((dz) => { const h = hullAt(S, ms.z + dz); return [side * h.w * 1.02, h.gun + 0.05, ms.z + dz]; });
      for (let k = 1; k < 14; k++) { const f = k / 15; const p0 = sh[0], p1 = sh[3]; const y0 = p0[1] + (topY - p0[1]) * f;
        lines.push(p0[0] * (1 - f), y0, p0[2] + (ms.z - p0[2]) * f, p1[0] * (1 - f), p1[1] + (topY - p1[1]) * f, p1[2] + (ms.z - p1[2]) * f); }
    }
  }
  // shot holes in her side and the places she burns, shown as she is hurt
  const hm = new MB(); const hz = galleon ? [-4.5, 1.8, 6.6, -8, 3.6, -1.2] : [-3, 2.2, 4.8, -0.6];
  hz.forEach((z, i) => { const s = i % 2 ? 1 : -1; const { w } = hullAt(S, z); const y = galleon ? 1.9 + (i % 3) * 0.5 : 0.55; hm.sph('dark', s * (w + 0.02), y, z, 0.12, 0.6 + (i % 2) * 0.2, 0.7, '#120a06'); hm.sph('timber', s * (w + 0.04), y, z, 0.08, 0.85, 0.95, '#3a2414'); });
  const holeObj = hm.build(); inner.add(holeObj); holeObj.visible = false;
  for (const z of galleon ? [-6, 0.5, 5.5, -9] : [-3, 1.5, 4.5]) fires.push([((fires.length % 2) - 0.5) * S.B * 0.4, (galleon ? S.deck : S.deck + 0.3) + 0.3, z]);
  // a broken mast: the stump and the topmast fallen across the deck (shown below a quarter of her health)
  const bm = new MB(); const ms0 = S.masts[0]; const by = S.G - S.drop + ms0.h * 0.45;
  bm.cyl('timber', 0, by + 0.25, ms0.z, 0.34, 0.5, '#4a3018', 8, 0.2); bm.beam('timber', V(0.4, S.deck + 0.3, ms0.z - 1), V(S.B * 0.7, S.deck + 1.6, ms0.z - ms0.h * 0.45), 0.3, 0.3, '#5a3a20');
  const broken = bm.build(); inner.add(broken); broken.visible = false;
  // pennants at the mastheads, streaming with the wind
  const pennants = [];
  for (const ms of S.masts) { const pm = new MB(); pm.box('cloth2', 0, 0, -1.4, 0.03, 0.4, 2.8, ban); pm.box('cloth2', 0, 0, -2.85, 0.03, 0.22, 0.4, trim); const po = pm.build(); po.position.set(0, S.G - S.drop + ms.h + 0.35, ms.z); inner.add(po); pennants.push(po); }
  detail.add(m.build());
  if (lines.length) { const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3)); detail.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x2a2018 }))); }
  detail.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const P = { inner, galleon, S, guns, gunSides, sails, crew, detail, holeObj, broken, pennants, fires, lean: 0, lastH: null, fireAt: 0, lastFire: 0 };
  P.anim = (av, ent, dt) => shipAnim(P, av, ent, dt);
  shipParts.set(e.id, P);
  return { obj: holder, parts: P, height: galleon ? 12 : 8 };
}
const shipParts = new Map(); // ship id -> its parts (for the deck height of anyone riding her)
const _cam = new THREE.Vector3();
function shipAnim(P, av, e, dt) {
  P.av = av;
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
  const speed = Math.min(1, (e.vel || 0) / 150);
  // near the camera: the fittings, the crew at work, the oars and the guns
  _cam.copy(K3.camera.position); const cd = _cam.distanceTo(av.obj.position); const near = cd < 150 && av.obj.visible;
  if (P.detail.visible !== near) P.detail.visible = near;
  // sails fill with the wind as she gathers way; pennants stream
  for (let i = 0; i < P.sails.length; i++) { const sl = P.sails[i]; const fill = 0.55 + 0.55 * speed + Math.sin(t * 2.3 + i) * 0.04 * (0.4 + speed); sl.scale.z += (fill - sl.scale.z) * Math.min(1, dt * 2); }
  for (let i = 0; i < P.pennants.length; i++) { const pn = P.pennants[i]; pn.rotation.y = Math.sin(t * 3.1 + i) * 0.18; pn.rotation.x = Math.sin(t * 5.3 + i * 2) * 0.06; }
  // a fresh broadside: the guns on the firing side kick back and run out again
  if ((e.fireAt || 0) !== P.lastFire) { P.lastFire = e.fireAt || 0; const ang = (e.aimAng != null ? e.aimAng : e.heading || 0) - (e.heading || 0); const side = Math.sin(ang) > 0 ? 1 : -1; for (const g of P.gunSides) if (g.obj && g.s === side) g.kick = 1; }
  for (const g of P.gunSides) {
    if (g.obj) { g.kick = Math.max(0, g.kick - dt * 0.5); const k = g.kick > 0.85 ? (1 - g.kick) / 0.15 : g.kick / 0.85; g.obj.position.x = -g.s * 0.7 * k; }
    if (g.oars && near) { const row = speed > 0.05 ? t * 2.2 : 0; let i = 0; for (const piv of g.oars.children) { const ph = row + i * 0.05; piv.rotation.y = g.s * Math.sin(ph) * 0.45 * Math.min(1, speed * 3); piv.rotation.z = g.s * (-0.25 + Math.max(0, Math.cos(ph)) * 0.18 * Math.min(1, speed * 3)); i++; } }
  }
  if (near) for (const c of P.crew) {
    const u = c.userData; const ph = t * 2 + u.ph; const [a0, a1] = u.arms;
    if (u.job === 'capstan') { a0.rotation.x = a1.rotation.x = -1.3; c.position.y = P.S.deck + Math.abs(Math.sin(ph * 2)) * 0.05; }
    else if (u.job === 'row') { const r = Math.sin(t * 2.2) * 0.6 * Math.min(1, speed * 3); a0.rotation.x = a1.rotation.x = -1.1 + r; c.rotation.x = r * 0.3; }
    else if (u.job === 'haul') { a0.rotation.x = -2.4 + Math.sin(ph) * 0.6; a1.rotation.x = -2.4 + Math.sin(ph + Math.PI) * 0.6; }
    else if (u.job === 'gun') { const busy = since < 4; a0.rotation.x = a1.rotation.x = busy ? -1.2 + Math.sin(ph * 3) * 0.4 : -0.2; c.scale.y = busy ? 0.85 : 1; }
    else if (u.job === 'helm') { a0.rotation.x = a1.rotation.x = -1.0 + Math.sin(ph * 0.5) * 0.08; a0.rotation.z = Math.sin(ph * 0.4) * 0.2; }
    else if (u.job === 'look') { a0.rotation.x = -2.2; a0.rotation.z = -0.4; c.rotation.y = Math.PI + Math.sin(t * 0.3 + u.ph) * 0.8; }
  }
  // damage: shot holes from two-thirds of her health, fires from half, the mainmast goes by the board at a quarter
  const hp = e.hpMax ? e.hp / e.hpMax : 1; const sunk = !!e.sinking;
  P.holeObj.visible = hp < 0.66 || sunk; P.broken.visible = hp < 0.25 || sunk; if (P.sails[0]) P.sails[0].visible = !(hp < 0.25 || sunk);
  if ((hp < 0.5 || sunk) && av.obj.visible && cd < 600) {
    const n = hp < 0.25 ? P.fires.length : 2; const ca = Math.cos(e.heading || 0), sa = Math.sin(e.heading || 0);
    for (let i = 0; i < n; i++) { if (Math.random() > dt * 14) continue; const [lx, ly, lz] = P.fires[i];
      const wx = av.obj.position.x + ca * lz - sa * lx, wz = av.obj.position.z + sa * lz + ca * lx, yy = av.obj.position.y + y + ly;
      fx.smoke.emit({ x: wx + (Math.random() - 0.5) * 0.6, y: yy, z: wz + (Math.random() - 0.5) * 0.6, vy: 1.6 + Math.random(), life: 0.6, s0: 0.5, s1: 0.15, r: 1, g: 0.55 + Math.random() * 0.2, b: 0.15, a: 0.9, kind: 1, drag: 0.4 });
      fx.smoke.emit({ x: wx, y: yy + 1.2, z: wz, vy: 1.4, life: 3.2, s0: 0.8, s1: 3.4, r: 0.18, g: 0.16, b: 0.15, a: 0.45, kind: 2, drag: 0.3 }); }
  }
  // her wake, and spray thrown up at the bow when she makes way
  if (e.moving && av.obj.visible && cd < 900) {
    const a = e.heading || 0, ca = Math.cos(a), sa = Math.sin(a);
    if (Math.random() < dt * 8) { const back = P.galleon ? 10 : 7; const bx = av.obj.position.x - ca * back, bz = av.obj.position.z - sa * back;
      fx.smoke.emit({ x: bx + (Math.random() - 0.5) * 2, y: wy + 0.1, z: bz + (Math.random() - 0.5) * 2, vy: 0.05, life: 2.6, s0: 0.8, s1: 2.6, r: 0.92, g: 0.95, b: 0.98, a: 0.35, kind: 2, drag: 0.6 }); }
    if (Math.random() < dt * 14 * speed) { const fwd = P.galleon ? 11.5 : 7.8; const s = Math.random() < 0.5 ? 1 : -1; const bx = av.obj.position.x + ca * fwd - sa * s * 1.1, bz = av.obj.position.z + sa * fwd + ca * s * 1.1;
      fx.smoke.emit({ x: bx, y: wy + 0.2, z: bz, vx: -sa * s * 1.5 + ca * 0.5, vy: 1.6 + Math.random() * 1.4, vz: ca * s * 1.5 + sa * 0.5, grav: 7, life: 0.9, s0: 0.35, s1: 0.9, r: 0.95, g: 0.97, b: 1, a: 0.5, kind: 2, drag: 0.5 }); }
  }
}
// the world height of the deck under someone riding a ship (actors.js floorOf: e.onShip)
K3.shipDeckY = function (e) {
  const s = e.onShip; const P = s && shipParts.get(s.id); if (!P || !P.av) return geo.floorAt(e.x, e.y);
  const lp = e.deckPos || [0, 0]; const S = P.S; let deck = S.deck;
  if (P.galleon) { const z = lp[0] / 20; if (z < -S.L / 2 + 5.7) deck = S.aft; else if (z > S.L / 2 - 4.6) deck = S.fore; }
  return P.av.obj.position.y + P.inner.position.y + deck + Math.sin(P.inner.rotation.z) * (lp[1] / 20) * -1;
};

K3.navalSailor = sailor; // (intro3d.js: the crew of the ship that brings a new hero home)
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
