// Goblin Island: the build (Snagglefoot, the sailors' camp and wreck, the gorge drawbridge, the goblin gatehouse on the
// Switchback Road, the Skull Stair gate, tribe camps, work camps, troll lairs, climbing vines), the people and quests,
// the enemies, and the island's progress (who is beaten, which gates are open). Layout and terrain shape: gimap.js.
import * as THREE from 'three';
import { G } from './state.js';
import { world, addBox, addCircle, addSurface } from './world.js';
import { heightAt } from './terrain.js';
import { distToLine } from './util.js';
import { Mob, Villager } from './mobs.js';
import { MOBS, ZONES, NPCS, QUESTS } from './data.js';
import { GI, PEAK, GORGE, GORGE_W, GORGE_RIM, BRIDGE1, TRIBES, LAIRS, CAMP_SPOT, VILLAGE_GI, RAMP1, RAMP2, rampPoint, rampNear, WORKS, WRECK, CLIMBS, FANGS } from './gimap.js';

const R = (a, b) => a + Math.random() * (b - a);
// the zone names shown under the minimap
if (GI) { const N = { coast: ['Wreck Shore', '1-3'], meadow: ['The South Valley', '1-4'], wood: ['Grimtusk Wilds', '1-7'], highlands: ['Grimtusk Peak', '7-10'], north: ['The North Cliffs', '5-8'] };
  for (const z of ZONES) if (N[z.id]) { z.name = N[z.id][0]; z.lv = N[z.id][1]; } }

// ---------------- the people and their quests ----------------
const V = VILLAGE_GI, GSKIN = ['#6f9a3c', '#7fa848', '#5f8a34', '#86ac52'];
if (GI) {
  for (const k of Object.keys(NPCS)) delete NPCS[k];
  Object.assign(NPCS, {
    hale: { name: 'Captain Hale', title: 'Shipwrecked Captain', race: 'human', sex: 'm', outfit: 'fisher', x: CAMP_SPOT.x - 4, z: CAMP_SPOT.z - 3, hello: 'Another one washed up, eh? Welcome to Goblin Island. Mind your step: the goblins here have gone mad.' },
    rivet: { name: 'Rivet Nailbiter', title: 'Goblin Shipwright', race: 'goblin', sex: 'm', outfit: 'smith', skin: GSKIN[0], x: WRECK.x - 12, z: WRECK.z - 10, hello: 'Big boat. Big holes. Rivet fix! Rivet always fix.' },
    grubnose: { name: 'Elder Grubnose', title: 'Snagglefoot Elder', race: 'goblin', sex: 'm', outfit: 'elder', skin: GSKIN[2], x: V.x, z: V.z - 6, hello: 'Peace, tall one. We Snagglefoots never knelt to the idol. Sit, sit. We have much to tell.' },
    mags: { name: 'Old Mags', title: 'Snagglefoot Cook', race: 'goblin', sex: 'f', outfit: 'worker', skin: GSKIN[3], x: V.x + 12, z: V.z + 7, hello: 'Hungry? Everyone is hungry. The boars eat our gardens and we eat nothing!' },
    snik: { name: 'Snik', title: 'Snagglefoot Scout', race: 'goblin', sex: 'm', outfit: 'hunter', skin: GSKIN[1], x: V.x + 26, z: V.z - 18, hello: 'Shh! The mad ones walk the road. Snik counts them. Too many, too many.' },
  });
  const Q = (o) => Object.assign({ done: '', gold: 0, lvl: 1 }, o);
  QUESTS.length = 0;
  QUESTS.push(
    Q({ id: 'gi_arrive', main: true, giver: null, turnin: 'hale', title: 'Washed Ashore', xp: 60,
      text: 'Your boat made it to the island, but only just. There are sailors camped on the beach beside a wrecked ship. Find out where you are.',
      obj: [{ t: 'talk', npc: 'hale', label: 'Talk to Captain Hale at the sailors\' camp' }] }),
    Q({ id: 'gi_village', main: true, giver: 'hale', turnin: 'grubnose', req: ['gi_arrive'], title: 'The Friendly Goblins', xp: 80,
      text: 'Hale says not every goblin went mad. A small village, Snagglefoot, never knelt to the idol. Its elder knows the island.',
      obj: [{ t: 'talk', npc: 'grubnose', label: 'Find Elder Grubnose in Snagglefoot' }] }),
    Q({ id: 'gi_crank', main: true, giver: 'grubnose', turnin: 'grubnose', req: ['gi_village'], title: 'The Bloodfang Crank', xp: 300, lvl: 2,
      text: 'The idol sits on top of Grimtusk Peak, in the goblin city. The only way north is the drawbridge over the Great Gorge, and it is raised. The Bloodfang Warchief carries the winch crank.',
      done: 'The bridge is down! Now the road north is open to you. Be careful, tall one.',
      obj: [{ t: 'flag', flag: 'bloodfang', label: 'Kill the Bloodfang Warchief', at: [TRIBES.bloodfang.x, TRIBES.bloodfang.z], r: 30 }, { t: 'flag', flag: 'bridge1', label: 'Lower the drawbridge (the winch at the gorge)', at: [BRIDGE1.x + 4, BRIDGE1.zS + 2], r: 8 }] }),
    Q({ id: 'gi_totems', main: true, giver: 'grubnose', turnin: null, req: ['gi_crank'], title: 'Two War Totems', xp: 600, lvl: 4,
      text: 'The goblin gatehouse at the foot of the Switchback Road only opens for the tribes. Topple the Mudfoot and Skullsplitter war totems by killing their chiefs, and the gate will rise.',
      obj: [{ t: 'flag', flag: 'mudfoot', label: 'Kill the Mudfoot Bog-Chief (west valley)', at: [TRIBES.mudfoot.x, TRIBES.mudfoot.z], r: 30 }, { t: 'flag', flag: 'skull', label: 'Kill the Skullsplitter Headtaker (east valley)', at: [TRIBES.skull.x, TRIBES.skull.z], r: 30 }] }),
    Q({ id: 'gi_shelf', main: true, giver: null, turnin: null, req: ['gi_totems'], title: 'The Switchback Road', xp: 800, lvl: 6,
      text: 'Climb the Switchback Road to the High Shelf halfway up Grimtusk Peak. Grumbak the Gate-Troll holds the key to the Skull Stair, the last way up.',
      obj: [{ t: 'flag', flag: 'shelf', label: 'Reach the High Shelf', at: [rampPoint(RAMP1, 1).x, rampPoint(RAMP1, 1).z], r: 14 }, { t: 'flag', flag: 'lair_gate', label: 'Kill Grumbak the Gate-Troll', at: [LAIRS[2].x, LAIRS[2].z], r: 18 }] }),
    Q({ id: 'gi_summit', main: true, giver: null, turnin: null, req: ['gi_shelf'], title: 'The Summit', xp: 1000, lvl: 8,
      text: 'Climb the Skull Stair to the goblin city on the summit of Grimtusk Peak. The High Chief and his three champions wait there with the idol.',
      obj: [{ t: 'flag', flag: 'summit', label: 'Reach the summit of Grimtusk Peak', at: [PEAK.x, PEAK.z], r: 30 }] }),
    Q({ id: 'gi_ship1', giver: 'rivet', turnin: 'rivet', req: ['gi_arrive'], title: 'Timber for the Hull', xp: 200, lvl: 2,
      text: 'Rivet can mend the wrecked ship, but the hull needs good seasoned timber. The Bloodfang goblins stack it at their lumber camp in the south valley.',
      done: 'Good wood! Rivet patch the big holes now.', obj: [{ t: 'flag', flag: 'timber', label: 'Take seasoned timber from the Bloodfang lumber camp', at: [WORKS[0].x, WORKS[0].z], r: 14 }] }),
    Q({ id: 'gi_ship2', giver: 'rivet', turnin: 'rivet', req: ['gi_ship1', 'gi_crank'], title: 'Sailcloth', xp: 350, lvl: 4,
      text: 'The sails are rags. The Mudfoot goblins weave their hide-cloth on drying racks in their swamp village.',
      done: 'Smelly cloth. Strong cloth. Rivet sew!', obj: [{ t: 'flag', flag: 'cloth', label: 'Take sailcloth from the Mudfoot drying racks', at: [TRIBES.mudfoot.x + 10, TRIBES.mudfoot.z + 10], r: 14 }] }),
    Q({ id: 'gi_ship3', giver: 'rivet', turnin: 'rivet', req: ['gi_ship2'], title: 'Iron and Tar', xp: 500, lvl: 5,
      text: 'Last of all: iron nails from the Skullsplitter forge, and pitch-black tar from the troll Old Gnash\'s cauldron on the High Shelf.',
      done: 'Nails! Tar! The big boat is almost a boat again.', obj: [{ t: 'flag', flag: 'nails', label: 'Take iron nails from the Skullsplitter forge', at: [TRIBES.skull.x - 10, TRIBES.skull.z + 10], r: 14 }, { t: 'flag', flag: 'tar', label: 'Take tar from Old Gnash\'s cauldron (High Shelf)', at: [LAIRS[0].x, LAIRS[0].z], r: 16 }] }),
    Q({ id: 'gi_sail', main: true, giver: 'rivet', turnin: 'rivet', req: ['gi_ship3'], title: 'Set Sail', xp: 400, lvl: 8,
      text: 'The ship is mended, but the idol\'s storms wreck every ship that leaves. Free the island first: kill the High Chief and his champions on the summit.',
      obj: [{ t: 'flag', flag: 'freed', label: 'Free Goblin Island (the summit)' }] }),
    Q({ id: 'gi_boars', giver: 'mags', turnin: 'mags', req: ['gi_village'], title: 'Garden Raiders', xp: 180, lvl: 1,
      text: 'Wild boars dig up Snagglefoot\'s gardens every night. Mags wants five of them gone (and in her pot).', done: 'Boar stew tonight! You are welcome at our fire, tall one.',
      obj: [{ t: 'kill', mob: 'boar', n: 5, label: 'Kill wild boars' }] }),
    Q({ id: 'gi_madgobs', giver: 'snik', turnin: 'snik', req: ['gi_village'], title: 'Too Many Mad Ones', xp: 260, lvl: 2,
      text: 'Idol-mad goblins prowl the roads of the south valley. Snik wants the road to Snagglefoot safe again.', done: 'Snik counts... fewer! Much fewer!',
      obj: [{ t: 'kill', mob: 'goblin', n: 8, label: 'Kill idol-mad goblins' }] }),
    Q({ id: 'gi_trolls', giver: 'snik', turnin: 'snik', req: ['gi_totems'], title: 'Troll Trouble', xp: 500, lvl: 6,
      text: 'Two old trolls lair on the High Shelf: Old Gnash and Mossback. While they live, no Snagglefoot dares climb the mountain.', done: 'Trolls gone? Snik will tell the whole village!',
      obj: [{ t: 'flag', flag: 'lair_gnash', label: 'Kill Old Gnash', at: [LAIRS[0].x, LAIRS[0].z], r: 16 }, { t: 'flag', flag: 'lair_mossback', label: 'Kill Mossback', at: [LAIRS[1].x, LAIRS[1].z], r: 16 }] }),
  );
}

let H = null;
const parts = { gap1: [], gate1: [], gate2: [], rail1: [] };
const live = { bridge1: null, gatehouse: null, stairgate: null, totems: {}, wreck: null };

// trees and rocks keep off the gorge, the ledge paths, the summit and the wreck
export function giAvoid(x, z, pad = 0) {
  if (distToLine(x, z, GORGE).d < GORGE_RIM + 6 + pad) return true;
  for (const Rp of [RAMP1, RAMP2]) if (rampNear(Rp, x, z).d < Rp.half + 4 + pad) return true;
  if (Math.hypot(x - PEAK.x, z - PEAK.z) < PEAK.rSum) return true;
  if (Math.hypot(x - WRECK.x, z - WRECK.z) < 22) return true;
  return false;
}

// ---------------- the build ----------------
export function buildGoblinIsle(scene, helpers) {
  if (!GI) return; H = helpers; const { M } = H;
  M.goblinRed = new THREE.MeshStandardMaterial({ color: '#8a2018', roughness: 0.9, side: THREE.DoubleSide });
  M.mud = new THREE.MeshStandardMaterial({ color: '#4a4a24', roughness: 1, side: THREE.DoubleSide });
  M.boneCloth = new THREE.MeshStandardMaterial({ color: '#d8d0b8', roughness: 0.95, side: THREE.DoubleSide });
  M.snag = new THREE.MeshStandardMaterial({ color: '#2a6aa8', roughness: 0.9, side: THREE.DoubleSide });
  M.snag2 = new THREE.MeshStandardMaterial({ color: '#e8b830', roughness: 0.9, side: THREE.DoubleSide });
  M.rockDark = new THREE.MeshStandardMaterial({ color: '#4a4640', roughness: 0.95, flatShading: true });
  M.vine = new THREE.MeshStandardMaterial({ color: '#2f6a28', roughness: 0.9, side: THREE.DoubleSide });
  buildSailorCamp(scene); buildWreck(scene); buildSnagglefoot(scene); buildGorge(scene);
  live.gatehouse = gateAcross(scene, RAMP1, 0.05, 'wood'); parts.gate1 = live.gatehouse.cols;
  live.stairgate = gateAcross(scene, RAMP2, 0.04, 'stone'); parts.gate2 = live.stairgate.cols;
  for (const [id, t] of Object.entries(TRIBES)) buildTribe(scene, id, t);
  for (const l of LAIRS) buildLair(scene, l);
  for (const w of WORKS) buildWork(scene, w);
  buildClimbs(scene); buildShipParts(scene);
}
function buildSailorCamp(scene) {
  const { M, tent, campfire, placeGroup, barrel, crate } = H, c = CAMP_SPOT;
  tent(scene, c.x - 8, c.z - 6, 0.4, M.cloth, 1.1); tent(scene, c.x + 7, c.z - 9, -0.5, M.cloth); tent(scene, c.x - 12, c.z + 6, 1.8, M.clothBlue, 0.9);
  const fg = new THREE.Group(); campfire(fg, scene, c.x, c.z); placeGroup(fg, c.x, c.z, 0, scene); addCircle(c.x, c.z, 0.9); H.fire(scene, c.x, heightAt(c.x, c.z) + 0.5, c.z, 0.8);
  [[c.x + 5, c.z + 4], [c.x + 6, c.z + 5.2], [c.x - 4, c.z + 9]].forEach(([x, z]) => barrel(scene, x, z));
  [[c.x + 9, c.z + 2, 0.3], [c.x + 9.6, c.z + 3.2, 0.9], [c.x - 9, c.z - 1, 0.2]].forEach(([x, z, r]) => crate(scene, x, z, r));
}
// the wrecked ship on the beach: patched as Rivet's quests are done
function buildWreck(scene) {
  const { M, bx, cy } = H, g = new THREE.Group();
  const hm = M.wood.clone(); hm.side = THREE.DoubleSide; const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), hm); hull.scale.set(4.2, 3, 13); hull.position.y = 2.6; g.add(hull);
  bx(8, 0.3, 24, M.plank, 0, 2.5, 0, g); cy(0.3, 0.38, 14, M.wood, 0, 9, 3, g, 8); cy(0.26, 0.32, 11, M.wood, 0, 7.6, -5, g, 8);
  const holes = []; for (const [x, z] of [[-3.6, 4], [3.8, -2], [-3.5, -6]]) { const hh = new THREE.Mesh(new THREE.CircleGeometry(1.2, 10), new THREE.MeshBasicMaterial({ color: '#0a0806', side: THREE.DoubleSide })); hh.position.set(x, 2.0, z); hh.rotation.y = Math.PI / 2; g.add(hh); holes.push(hh); }
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(7, 6, 4, 4), M.cloth); sail.position.set(0, 10, 3.4); g.add(sail);
  g.position.set(WRECK.x, heightAt(WRECK.x, WRECK.z) - 0.4, WRECK.z); g.rotation.set(0, WRECK.yaw, 0.12); scene.add(g);
  addBox(WRECK.x, WRECK.z, 4.2, 12, WRECK.yaw);
  live.wreck = { g, holes, sail };
}
function setWreck(I) { const W = live.wreck; if (!W) return; W.holes.forEach((h, i) => { h.visible = !(i === 0 ? I.ship1 : I.ship3); }); W.sail.visible = !!I.ship2; W.g.rotation.z = I.ship3 ? 0.02 : 0.12; }
// Snagglefoot: a small friendly goblin village (blue and yellow, never possessed)
function buildSnagglefoot(scene) {
  const { M, tent, campfire, placeGroup, barrel, crate, bx, cy, addHouse } = H;
  for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28 + 0.3, r = 18 + (i % 2) * 5; addHouse(scene, V.x + Math.cos(a) * r, V.z + Math.sin(a) * r, 5.5, 4.5, 3.2, 'thatch', { cx: V.x, cz: V.z }); }
  for (let i = 0; i < 4; i++) { const a = i / 4 * 6.28 + 1.1; tent(scene, V.x + Math.cos(a) * 9, V.z + Math.sin(a) * 9, a, i % 2 ? M.snag : M.snag2, 0.9); }
  const fg = new THREE.Group(); campfire(fg, scene, V.x, V.z + 2); placeGroup(fg, V.x, V.z + 2, 0, scene); addCircle(V.x, V.z + 2, 0.9); H.fire(scene, V.x, heightAt(V.x, V.z + 2) + 0.5, V.z + 2, 1);
  { const g = new THREE.Group(); for (let k = 0; k < 3; k++) cy(0.5, 0.55, 1.5, k % 2 ? M.snag2 : M.snag, 0, 0.75 + k * 1.5, 0, g, 8); const sun = new THREE.Mesh(new THREE.CircleGeometry(0.9, 12), M.snag2); sun.position.set(0, 5.2, 0.05); g.add(sun); placeGroup(g, V.x - 6, V.z - 10, 0, scene); addCircle(V.x - 6, V.z - 10, 0.6); }
  { const g = new THREE.Group(); bx(3, 1, 1.2, M.plank, 0, 0.5, 0, g); for (const sx of [-1, 1]) for (const sz of [-1, 1]) cy(0.07, 0.07, 2.6, M.beam, sx * 1.4, 1.3, sz * 0.6, g, 5); bx(3.4, 0.08, 1.8, M.snag, 0, 2.6, 0, g, 0.15); placeGroup(g, V.x + 10, V.z + 4, 0.6, scene); addBox(V.x + 10, V.z + 4, 1.5, 0.6, 0.6); }
  [[V.x + 4, V.z + 12], [V.x + 5, V.z + 13], [V.x - 11, V.z + 6]].forEach(([x, z]) => barrel(scene, x, z)); [[V.x - 12, V.z + 8, 0.4], [V.x + 13, V.z - 3, 0.1]].forEach(([x, z, r]) => crate(scene, x, z, r));
  for (let i = 0; i < 44; i++) { const a = i / 44 * 6.28; if ([0.15, 2.2, 3.6, -0.9].some(gp => Math.abs(Math.atan2(Math.sin(a - gp), Math.cos(a - gp))) < 0.18)) continue; const x = V.x + Math.cos(a) * V.r, z = V.z + Math.sin(a) * V.r; const g = new THREE.Group(); cy(0.1, 0.12, 1.4, M.beam, 0, 0.7, 0, g, 5); placeGroup(g, x, z, a, scene); }
}
// the gorge: rock faces down both walls, the drawbridge and its winch
function buildGorge(scene) {
  const { M, bx, cy } = H;
  { const pts = []; for (const side of [-1, 1]) for (let i = 0; i < GORGE.length - 1; i++) { const [ax, az] = GORGE[i], [bx2, bz] = GORGE[i + 1], len = Math.hypot(bx2 - ax, bz - az), ux = (bx2 - ax) / len, uz = (bz - az) / len, nx = -uz * side, nz = ux * side;
      for (let d = 0; d < len; d += 5.5) { const x = ax + ux * d + nx * (GORGE_W + 2.5), z = az + uz * d + nz * (GORGE_W + 2.5); if (Math.abs(x - BRIDGE1.x) < 5) continue; const y = heightAt(x, z); if (y < -6) continue; pts.push([x, y, z]); } }
    const im = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), M.rockDark, pts.length), o = new THREE.Object3D();
    pts.forEach(([x, y, z], i) => { o.position.set(x, y - 2, z); o.rotation.set(i * 1.3, i * 2.1, i * 0.7); o.scale.set(4.5 + (i % 3), 7 + (i % 4) * 1.5, 4.5 + ((i + 1) % 3)); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
    im.castShadow = im.receiveShadow = true; scene.add(im); }
  const B = BRIDGE1, yS = heightAt(B.x, B.zS), yN = heightAt(B.x, B.zN), len = B.zS - B.zN;
  for (const [z, y] of [[B.zS, yS], [B.zN, yN]]) for (const sx of [-1, 1]) { const g = new THREE.Group(); cy(0.45, 0.55, 8, M.beam, 0, 4, 0, g, 8); bx(1.2, 0.7, 1.2, M.iron, 0, 8.2, 0, g); g.position.set(B.x + sx * 2.9, y, z); scene.add(g); addCircle(B.x + sx * 2.9, z, 0.4); }
  for (const z of [B.zS - 3, B.zN + 3]) parts.gap1.push(addBox(B.x, z, 2.6, 0.5, 0, 'gap')); // (until it's down, nobody steps off the end)
  const deck = new THREE.Group(), pivot = new THREE.Group(); pivot.position.set(B.x, yN + 0.25, B.zN); scene.add(pivot);
  for (let i = 0; i < len / 0.6; i++) bx(4.4, 0.18, 0.55, M.plank, 0, 0, 0.3 + i * 0.6, deck); for (const sx of [-1, 1]) { bx(0.25, 0.3, len, M.beam, sx * 2.1, 0.12, len / 2, deck); bx(0.12, 1.0, len, M.beam, sx * 2.25, 0.7, len / 2, deck); }
  pivot.add(deck); live.bridge1 = { pivot, yS, yN, len, open: 0, want: 0 }; setBridge(live.bridge1, 0);
  { const g = new THREE.Group(); bx(1.6, 0.9, 1.2, M.beam, 0, 0.45, 0, g); const drum = cy(0.45, 0.45, 1.5, M.iron, 0, 1.2, 0, g, 12); drum.rotation.z = Math.PI / 2;
    g.position.set(B.x + 4.6, yS, B.zS + 2.5); scene.add(g); addBox(B.x + 4.6, B.zS + 2.5, 0.8, 0.6, 0);
    const crank = new THREE.Group(); bx(0.08, 0.7, 0.08, M.iron, 0, -0.3, 0, crank); bx(0.08, 0.08, 0.5, M.iron, 0, -0.62, 0.22, crank); crank.position.set(0.95, 1.2, 0); crank.visible = false; g.add(crank); live.crank = crank;
    use(B.x + 4.6, B.zS + 2.5, () => isle().bridge1 ? null : isle().crank ? 'Lower the drawbridge' : 'Winch (the crank handle is missing)', () => winch()); }
}
function setBridge(b, k) { b.pivot.rotation.order = 'YXZ'; const down = -Math.atan2(b.yS - b.yN, b.len), up = -Math.PI / 2 * 0.97; b.pivot.rotation.x = up + (down - up) * k; }
// a gate across a ledge path: two towers (or rock pillars), a wall, an iron portcullis; palisade down the open side of the path
function gateAcross(scene, Rp, t, kind) {
  const { M, bx, cy } = H, p = rampPoint(Rp, t), p2 = rampPoint(Rp, t + 0.01), dir = Math.atan2(p2.x - p.x, p2.z - p.z), w = Rp.half + 0.4, y = heightAt(p.x, p.z);
  const g = new THREE.Group(), gate = new THREE.Group(), mat = kind === 'stone' ? M.darkStone : M.beam;
  for (const s of [-1, 1]) { bx(3, kind === 'stone' ? 11 : 9, 3, mat, s * (w + 1.5), kind === 'stone' ? 5.5 : 4.5, 0, g); if (kind !== 'stone') for (let k = 0; k < 3; k++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.2, 5), M.beam); sp.position.set(s * (w + 1.5) + (k - 1) * 0.9, 9.6, 0); g.add(sp); } }
  bx(w * 2 + 6, 1.4, 2.6, mat, 0, kind === 'stone' ? 10.3 : 8.3, 0, g);
  if (kind !== 'stone') { const fl = new THREE.Mesh(new THREE.PlaneGeometry(2, 3.2), M.goblinRed); fl.position.set(0, 6.6, 1.35); g.add(fl); }
  for (let i = -w + 0.4; i <= w - 0.4; i += 0.7) cy(0.07, 0.07, 7.4, M.iron, i, 3.7, 0, gate, 5); for (let yy = 0.8; yy < 7.3; yy += 1.1) bx(w * 2, 0.12, 0.12, M.iron, 0, yy, 0, gate);
  for (const o of [g, gate]) { o.position.set(p.x, y, p.z); o.rotation.y = dir + Math.PI / 2; scene.add(o); }
  const cols = [addBox(p.x, p.z, w + 0.3, 0.6, dir + Math.PI / 2, 'gate')];
  for (const s of [-1, 1]) { const q = { x: p.x + Math.cos(dir) * s * (w + 1.5), z: p.z - Math.sin(dir) * s * (w + 1.5) }; addBox(q.x, q.z, 1.5, 1.5, dir + Math.PI / 2); }
  for (let tt = Math.max(0, t - 0.06); tt < t + 0.2; tt += 0.012) { const a = rampPoint(Rp, tt), out = Math.hypot(a.x - PEAK.x, a.z - PEAK.z) + Rp.half + 0.8, ang = Math.atan2(a.z - PEAK.z, a.x - PEAK.x), x = PEAK.x + Math.cos(ang) * out, z = PEAK.z + Math.sin(ang) * out;
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.25, 3.4, 6), M.beam); st.position.set(x, heightAt(x, z) + 1.5, z); st.castShadow = true; scene.add(st); addCircle(x, z, 0.75); }
  return { gate, y, open: 0, want: 0, cols };
}
function buildTribe(scene, id, t) {
  const { M, tent, campfire, placeGroup, bx, cy, barrel } = H;
  const mat = id === 'bloodfang' ? M.goblinRed : id === 'mudfoot' ? M.mud : M.boneCloth;
  const toward = Math.atan2(-t.z, -t.x), stake = new THREE.CylinderGeometry(0.03, 0.24, 3.8, 6);
  for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2; if (Math.abs(Math.sin((a - toward) / 2)) < 0.09) continue; const x = t.x + Math.cos(a) * t.r, z = t.z + Math.sin(a) * t.r;
    const m = new THREE.Mesh(stake, M.beam); m.castShadow = true; m.position.set(x, heightAt(x, z) + 1.6, z); m.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25); scene.add(m); addCircle(x, z, 0.5); }
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28 + 0.6; tent(scene, t.x + Math.cos(a) * t.r * 0.62, t.z + Math.sin(a) * t.r * 0.62, a + 1.6, i % 2 ? M.hide : mat, 1.15); }
  const fg = new THREE.Group(); campfire(fg, scene, t.x, t.z); placeGroup(fg, t.x, t.z, 0, scene); addCircle(t.x, t.z, 0.9); H.fire(scene, t.x, heightAt(t.x, t.z) + 0.5, t.z, 1.3);
  for (let i = 0; i < 4; i++) barrel(scene, t.x - t.r * 0.4 + (i % 2) * 0.9, t.z + t.r * 0.35 + (i >> 1) * 0.9);
  const tp = { x: t.x + Math.cos(toward + Math.PI) * 9, z: t.z + Math.sin(toward + Math.PI) * 9 }, g = new THREE.Group();
  for (let k = 0; k < 4; k++) { cy(0.55 - k * 0.06, 0.6 - k * 0.06, 1.6, k % 2 ? mat : M.beam, 0, 0.8 + k * 1.6, 0, g, 8); bx(0.7, 0.35, 0.2, M.dark, 0, 1.0 + k * 1.6, 0.52 - k * 0.05, g); }
  for (const s of [-1, 1]) bx(1.6, 0.25, 0.3, mat, s * 0.9, 6.0, 0, g, 0, 0, s * 0.3);
  const sk = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), M.bone); sk.position.y = 7.0; g.add(sk);
  g.position.set(tp.x, heightAt(tp.x, tp.z), tp.z); g.rotation.y = toward + Math.PI; scene.add(g); addCircle(tp.x, tp.z, 0.7);
  live.totems[id] = { g, k: 0, want: 0 };
}
function buildLair(scene, l) {
  const { M, cy } = H, away = Math.atan2(l.z - PEAK.z, l.x - PEAK.x), g = new THREE.Group();
  for (let i = 0; i < 12; i++) { const a = -1.2 + i / 11 * 2.4, r = 7 + Math.sin(i * 2.1) * 0.8, rk = new THREE.Mesh(new THREE.DodecahedronGeometry(R(2.2, 3.4), 0), M.rockDark); rk.position.set(Math.sin(a) * r, R(1, 2.2) + Math.cos(a) * 3, -Math.cos(a) * r * 0.6 - 3); rk.castShadow = true; g.add(rk); }
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(3.4, 14, 0, Math.PI), new THREE.MeshBasicMaterial({ color: '#050403' })); mouth.position.set(0, 0.05, -4.2); g.add(mouth);
  for (let i = 0; i < 10; i++) { const b = cy(0.06, 0.08, R(0.6, 1.4), M.bone, R(-5, 5), 0.1, R(-1, 5), g, 5); b.rotation.set(Math.PI / 2, R(0, 3), 0); }
  cy(1.1, 0.8, 1.2, M.iron, 3, 0.6, 2, g, 12);
  g.position.set(l.x, heightAt(l.x, l.z), l.z); g.rotation.y = -away + Math.PI / 2; scene.add(g);
}
// work camps: log piles and stumps (lumber), rock piles (quarry), a half-built tower (building site)
function buildWork(scene, w) {
  const { M, bx, cy, placeGroup, barrel, crate } = H, g = new THREE.Group();
  if (w.kind === 'lumber') { for (let i = 0; i < 9; i++) { const l = cy(0.32, 0.32, 4.5, M.wood, 0, 0.35 + Math.floor(i / 3) * 0.6, (i % 3) * 0.66 - 0.66, g, 8); l.rotation.z = Math.PI / 2; } for (let i = 0; i < 6; i++) cy(0.45, 0.5, 0.6, M.wood, R(-9, 9), 0.3, R(-9, 9), g, 8); }
  else if (w.kind === 'quarry') { for (let i = 0; i < 8; i++) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(R(0.6, 1.3), 0), M.stone); r.position.set(R(-4, 4), 0.5, R(-4, 4)); g.add(r); } bx(2, 1, 1.2, M.plank, 5, 0.5, 0, g); }
  else { for (const sx of [-1, 1]) for (const sz of [-1, 1]) cy(0.2, 0.25, 7, M.beam, sx * 2.4, 3.5, sz * 2.4, g, 6); bx(5.4, 0.25, 5.4, M.plank, 0, 3.5, 0, g); for (let i = 0; i < 4; i++) bx(5, 0.15, 0.3, M.plank, 0, 5.5, -2 + i * 1.3, g); }
  placeGroup(g, w.x, w.z, R(0, 3), scene); addCircle(w.x, w.z, w.kind === 'build' ? 3.4 : 2.6);
  barrel(scene, w.x + 6, w.z - 5); crate(scene, w.x - 6, w.z + 5, 0.3);
}
// climbing vines on the gorge's south wall, so a fall into the river isn't the end
function buildClimbs(scene) {
  const { M } = H;
  for (const x of [-230, -80, 90, 240]) {
    let gz = 160; for (let i = 0; i < GORGE.length - 1; i++) { const [ax, az] = GORGE[i], [bx2, bz] = GORGE[i + 1]; if (x >= ax && x <= bx2) gz = az + (bz - az) * (x - ax) / (bx2 - ax); }
    let z = gz + GORGE_W - 3; while (heightAt(x, z) < 0.5 && z < gz + 40) z += 0.5;
    CLIMBS.push({ x, z, yaw: 0, w: 3.5 }); // yaw 0: facing +z (south), into the wall
  }
  for (const c of CLIMBS) { const g = new THREE.Group(), base = heightAt(c.x, c.z), len = Math.max(4, heightAt(c.x, c.z + 10) - base) + 1.5;
    for (let i = 0; i < 18; i++) { const xx = (i / 17 - 0.5) * c.w * 2, v = new THREE.Mesh(new THREE.BoxGeometry(0.12, len, 0.08), M.vine); v.position.set(xx, len / 2, Math.sin(i) * 0.15); g.add(v);
      for (let k = 0.5; k < len; k += 1.1) { const lf = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.38), M.vine); lf.position.set(xx + Math.sin(k * 3 + i) * 0.25, k, -0.1); lf.rotation.set(0.3, Math.sin(k + i), 0.6); g.add(lf); } }
    g.position.set(c.x, base, c.z + 0.6); g.rotation.x = -0.35; scene.add(g); }
}
// the ship's parts, where Rivet's quests send you
function buildShipParts(scene) {
  const take = (flag, quest, x, z, label) => use(x, z, () => { const I = isle(); return !I[flag] && G.save && G.save.quests && G.save.quests.active[quest] ? label : null; }, () => { isle()[flag] = true; G.hooks.toast && G.hooks.toast(label.replace('Take', 'You take'), '📦', 'gold'); G.hooks.questsChanged && G.hooks.questsChanged(); });
  take('timber', 'gi_ship1', WORKS[0].x + 2, WORKS[0].z, 'Take the seasoned timber');
  take('cloth', 'gi_ship2', TRIBES.mudfoot.x + 10, TRIBES.mudfoot.z + 10, 'Take the sailcloth');
  take('nails', 'gi_ship3', TRIBES.skull.x - 10, TRIBES.skull.z + 10, 'Take the iron nails');
  take('tar', 'gi_ship3', LAIRS[0].x, LAIRS[0].z, 'Take the troll tar');
  const { M, bx } = H;
  { const g = new THREE.Group(); for (const s of [-1, 1]) bx(0.12, 2.2, 0.12, M.beam, s * 1.4, 1.1, 0, g); bx(3, 0.1, 0.1, M.beam, 0, 2.1, 0, g); bx(2.6, 1.4, 0.05, M.hide, 0, 1.3, 0, g); H.placeGroup(g, TRIBES.mudfoot.x + 10, TRIBES.mudfoot.z + 10.8, 0.3, scene); }
  { const g = new THREE.Group(); bx(0.8, 0.7, 0.5, M.iron, 0, 0.35, 0, g); bx(1.1, 0.25, 0.45, M.iron, 0, 0.8, 0, g); H.placeGroup(g, TRIBES.skull.x - 10, TRIBES.skull.z + 10.8, 0, scene); }
}

// ---------------- interactables and progress ----------------
function use(x, z, label, fn) { (world.giUse || (world.giUse = [])).push({ x, z, label, use: fn }); }
const isle = () => (G.save ? (G.save.isle || (G.save.isle = {})) : {});
function winch() {
  const I = isle(); if (I.bridge1) return;
  if (!I.crank) { G.hooks.toast && G.hooks.toast('The crank handle is missing. The Bloodfang Warchief carries it.', '⚙', 'bad'); return; }
  I.bridge1 = true; live.crank.visible = true; live.bridge1.want = 1; G.hooks.banner && G.hooks.banner('The drawbridge comes down', 'The way north across the Great Gorge is open', 3500); G.hooks.questsChanged && G.hooks.questsChanged();
}
export function giApply(h) {
  if (!GI || !live.bridge1) return; const I = h.isle || (h.isle = {});
  live.bridge1.want = live.bridge1.open = I.bridge1 ? 1 : 0; setBridge(live.bridge1, live.bridge1.open); live.crank.visible = !!I.bridge1;
  live.gatehouse.want = live.gatehouse.open = I.mudfoot && I.skull ? 1 : 0; live.stairgate.want = live.stairgate.open = I.lair_gate ? 1 : 0;
  for (const id in live.totems) { const T = live.totems[id]; T.want = T.k = I[id] ? 1 : 0; T.g.rotation.z = T.k * 1.45; }
  syncColliders(); setWreck(I);
  for (const m of G.mobs) if ((m.giChief && I[m.giChief]) || (m.giLair && I['lair_' + m.giLair])) { m.dead = true; m.hp = 0; m.root.visible = false; m.respawnT = 1e12; }
  if (h.quests && !h.quests.done.includes('gi_arrive') && !h.quests.active.gi_arrive) h.quests.active.gi_arrive = { p: [0], t: Date.now() }; // (the first quest starts on arrival)
}
function syncColliders() {
  for (const c of parts.gap1) c.on = !(live.bridge1.open > 0.95); for (const c of parts.gate1) c.on = !(live.gatehouse.open > 0.9); for (const c of parts.gate2) c.on = !(live.stairgate.open > 0.9);
  if (live.bridge1.open > 0.95 && !live.bridge1.surf) { live.bridge1.surf = true; const B = BRIDGE1; addSurface(B.x, (B.zS + B.zN) / 2, 2.2, (B.zS - B.zN) / 2, 0, live.bridge1.yN + 0.35, 0, live.bridge1.yS + 0.35); for (const s of [-1, 1]) for (let z = B.zN + 2; z < B.zS - 1; z += 4) parts.rail1.push(addBox(B.x + s * 2.5, z, 0.2, 2.1, 0, 'rail')); }
}
// chiefs and named trolls: what their deaths open
export function giKill(m) {
  if (!GI || !G.save) return; const I = isle(), say = (a, b) => G.hooks.banner && G.hooks.banner(a, b, 5000);
  if (m.giChief && !I[m.giChief]) { I[m.giChief] = true; m.respawnT = 1e12; const T = live.totems[m.giChief]; if (T) T.want = 1; const t = TRIBES[m.giChief];
    if (m.giChief === 'bloodfang') { I.crank = true; say('The Bloodfang Warchief is dead', 'You took his iron crank: the drawbridge winch at the Great Gorge'); }
    else { const both = I.mudfoot && I.skull; say(`The ${t.name} chief is dead`, both ? 'Both war totems have fallen: the gatehouse on the Switchback Road opens' : 'Their war totem falls. One more tribe holds the gatehouse shut'); if (both) live.gatehouse.want = 1; } }
  if (m.giLair && !I['lair_' + m.giLair]) { I['lair_' + m.giLair] = true; m.respawnT = 1e12; if (m.giLair === 'gate') { say('Grumbak is dead', 'His great iron key opens the Skull Stair'); live.stairgate.want = 1; } else G.hooks.toast && G.hooks.toast(`${m.name} is slain`, '🏆', 'gold'); }
  G.hooks.questsChanged && G.hooks.questsChanged();
}
// every frame: bridges swing, gates rise, totems topple, places reached; quests with nobody to hand in to finish by themselves
export function giTick(dt) {
  if (!GI || !live.bridge1) return; const I = isle();
  { const b = live.bridge1; if (b.open !== b.want) { b.open = Math.max(0, Math.min(1, b.open + Math.sign(b.want - b.open) * dt / 4)); setBridge(b, b.open < 1 ? Math.pow(b.open, 1.6) : 1); if (b.open === b.want) syncColliders(); } }
  for (const gt of [live.gatehouse, live.stairgate]) { if (gt.open < gt.want) { gt.open = Math.min(1, gt.open + dt / 5); if (gt.open >= 1) syncColliders(); } gt.gate.position.y = gt.y + gt.open * 7.4; }
  for (const id in live.totems) { const T = live.totems[id]; if (T.k < T.want) { T.k = Math.min(1, T.k + dt * 0.7); T.g.rotation.z = Math.pow(T.k, 2) * 1.45; } }
  if ((giTick.t = (giTick.t || 0) + dt) < 0.5) return; giTick.t = 0;
  const P = G.player; if (!P || !G.save || !G.save.quests) return;
  const r = Math.hypot(P.pos.x - PEAK.x, P.pos.z - PEAK.z);
  if (!I.shelf && r < PEAK.rShelf && P.pos.y > PEAK.shelfH2 - 4) { I.shelf = true; G.hooks.banner && G.hooks.banner('The High Shelf', 'Halfway up Grimtusk Peak', 3500); G.hooks.questsChanged && G.hooks.questsChanged(); }
  if (!I.summit && r < PEAK.rSum + 4 && P.pos.y > PEAK.sumH - 8) { I.summit = true; G.hooks.banner && G.hooks.banner('The summit of Grimtusk Peak', 'The goblin city', 3500); G.hooks.questsChanged && G.hooks.questsChanged(); }
  const dn = (id) => G.save.quests.done.includes(id);
  if (I.ship1 !== dn('gi_ship1') || I.ship2 !== dn('gi_ship2') || I.ship3 !== dn('gi_ship3')) { I.ship1 = dn('gi_ship1'); I.ship2 = dn('gi_ship2'); I.ship3 = dn('gi_ship3'); setWreck(I); }
  for (const qid of Object.keys(G.save.quests.active)) { const q = QUESTS.find(x => x.id === qid); if (q && !q.turnin && q.obj.length && q.obj.every(o => o.t === 'flag' && I[o.flag])) G.hooks.autoTurnIn && G.hooks.autoTurnIn(q); }
}

// ---------------- the people (friendly goblins of Snagglefoot, sailors at the camp) ----------------
export function giPeople() {
  if (!GI) return;
  const OUT = ['worker', 'weaver', 'hunter', 'smith'];
  for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28, r = 6 + (i % 3) * 5, v = new Villager(V.x + Math.cos(a) * r, V.z + Math.sin(a) * r, { race: 'goblin', sex: i % 2 ? 'f' : 'm', outfit: OUT[i % 4], skin: GSKIN[i % 4], hair: '#2a2010', hairStyle: i % 3, beard: 0, height: 0.85 + (i % 4) * 0.08 });
    v.talkable = true; v.vname = ['Pogg', 'Nib', 'Grizzle', 'Tumble', 'Wort', 'Fizzle', 'Squik', 'Moss', 'Bimble'][i]; G.npcs.push(v); }
  for (let i = 0; i < 3; i++) { const v = new Villager(CAMP_SPOT.x + R(-8, 8), CAMP_SPOT.z + R(-8, 8), { race: 'human', sex: i === 1 ? 'f' : 'm', outfit: 'fisher', skin: ['#e0ac85', '#c08e68', '#f1c7a5'][i], hair: '#4a3020', hairStyle: i, beard: i === 0 ? 2 : 0, height: 0.95 }); v.talkable = true; v.vname = ['Bosun Crabb', 'Tess', 'Old Rope'][i]; G.npcs.push(v); }
}

// ---------------- enemies ----------------
const named = (type, name, extra) => Object.assign({}, MOBS[type], { name }, extra || {});
const SIZE = { goblin: [0.72, 1.18], goblin_slinger: [0.66, 0.95], goblin_brute: [1.15, 1.5], troll: [0.92, 1.15], troll_king: [1.0, 1.1] };
function mob(type, lv, x, z, name) { const m = new Mob(type, lv, x, z); m.def = named(type, name || MOBS[type].name, { aggro: Math.round(MOBS[type].aggro * 0.6) });
  m.maxHp = Math.round(m.maxHp * 1.8); m.hp = m.maxHp; m.dmg *= 1.4; m.xp = Math.round(m.xp * 1.3);
  const sz = SIZE[type]; if (sz) { const k = sz[0] + Math.random() * (sz[1] - sz[0]); m.root.scale.multiplyScalar(k); m.radius *= k; if (m.height) m.height *= k; m.maxHp = Math.round(m.maxHp * (0.75 + k * 0.25)); m.hp = m.maxHp; }
  G.mobs.push(m); return m; }
export function giSpawn() {
  if (!GI) return;
  const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  for (const [id, t] of Object.entries(TRIBES)) {
    const c = mob('goblin_brute', t.chiefLv, t.x, t.z - 4); c.def = named('goblin_brute', t.chief, { elite: true, aggro: 9 }); c.giChief = id; c.bossy = true; c.maxHp = Math.round(c.maxHp * 2.6); c.hp = c.maxHp;
    const n = id === 'bloodfang' ? 9 : 12;
    for (let i = 0; i < n; i++) { const a = i / n * 6.28, r = R(5, t.r * 0.75), type = i % 4 === 1 ? 'goblin_slinger' : i % 5 === 3 ? 'goblin_brute' : 'goblin'; mob(type, ri(t.lv[0], t.lv[1]), t.x + Math.cos(a) * r, t.z + Math.sin(a) * r, `${t.name} ${MOBS[type].name.replace('Goblin ', '')}`); }
  }
  for (const l of LAIRS) { const b = mob('troll_king', l.lv, l.x, l.z, l.name); b.giLair = l.id; b.bossy = true; for (let i = 0; i < l.adds; i++) mob('troll', l.lv - 1, l.x + R(-6, 6), l.z + R(-6, 6)); }
  for (const [Rp, lv] of [[RAMP1, 6], [RAMP2, 8]]) for (let i = 0; i < 4; i++) { const p = rampPoint(Rp, 0), a = Math.atan2(p.z - PEAK.z, p.x - PEAK.x); mob(i === 0 ? 'goblin_brute' : i === 3 ? 'goblin_slinger' : 'goblin', lv, p.x + Math.cos(a) * (6 + i * 2), p.z + Math.sin(a) * (6 + i * 2), 'Gate Guard'); }
  for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28, r = R(10, PEAK.rSum - 12); mob(i % 3 === 2 ? 'goblin_brute' : i % 3 === 1 ? 'goblin_slinger' : 'goblin', ri(9, 10), PEAK.x + Math.cos(a) * r, PEAK.z + Math.sin(a) * r, 'Idol Guard'); }
  for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28 + 0.3, r = R(PEAK.rUp + 15, PEAK.rShelf - 12), x = PEAK.x + Math.cos(a) * r, z = PEAK.z + Math.sin(a) * r; if (LAIRS.some(l => Math.hypot(l.x - x, l.z - z) < 30)) continue; for (let k = 0; k < 3; k++) mob(k === 2 ? 'goblin_slinger' : 'goblin', ri(7, 8), x + R(-5, 5), z + R(-5, 5), 'Idol-mad Goblin'); }
  for (let gx = -460; gx <= 460; gx += 70) for (let gz = -440; gz <= 440; gz += 70) {
    const x = gx + R(-25, 25), z = gz + R(-25, 25); if (heightAt(x, z) < 1.4 || giAvoid(x, z, 6)) continue;
    if (Math.hypot(x - PEAK.x, z - PEAK.z) < PEAK.rLow + 20) continue; if (Math.hypot(x - CAMP_SPOT.x, z - CAMP_SPOT.z) < 80 || Math.hypot(x - V.x, z - V.z) < 85) continue;
    if ([...Object.values(TRIBES), ...WORKS].some(t => Math.hypot(t.x - x, t.z - z) < t.r + 25)) continue;
    if (FANGS.some(F => Math.hypot(F.x - x, F.z - z) < F.r * 0.45)) continue;
    const south = z > 160, roll = Math.random();
    if (south) { if (roll < 0.5) for (let i = 0; i < ri(2, 3); i++) mob(i === 2 ? 'goblin_slinger' : 'goblin', ri(1, 3), x + R(-6, 6), z + R(-6, 6), 'Idol-mad Goblin'); else if (roll < 0.85) for (let i = 0; i < 2; i++) mob('boar', ri(1, 2), x + R(-6, 6), z + R(-6, 6)); }
    else { if (roll < 0.6) for (let i = 0; i < ri(3, 4); i++) mob(i === 3 ? 'goblin_brute' : i === 2 ? 'goblin_slinger' : 'goblin', ri(4, 6), x + R(-7, 7), z + R(-7, 7), 'Idol-mad Goblin'); else if (roll < 0.8) for (let i = 0; i < 2; i++) mob('wolf', ri(4, 5), x + R(-6, 6), z + R(-6, 6)); }
  }
  for (let i = 0; i < 12; i++) { const x = -120 + i * 22, z = 455 + Math.sin(i) * 12; if (heightAt(x, z) > 0.2 && heightAt(x, z) < 2) mob('crab', 1, x, z); }
}
export function objectives() {}
// where you wake after dying: the nearest safe place you have reached (never an enemy camp)
export function giRespawns() {
  const I = isle(), out = [{ x: CAMP_SPOT.x + 3, z: CAMP_SPOT.z + 6 }, { x: V.x + 4, z: V.z + 8 }];
  if (I.bridge1) out.push({ x: BRIDGE1.x - 6, z: BRIDGE1.zN - 8 });
  if (I.shelf) { const p = rampPoint(RAMP1, 1); out.push({ x: p.x, z: p.z }); }
  if (I.lair_gate) { const p = rampPoint(RAMP2, 0); const a = Math.atan2(p.z - PEAK.z, p.x - PEAK.x); out.push({ x: p.x + Math.cos(a) * 5, z: p.z + Math.sin(a) * 5 }); }
  if (I.summit) out.push({ x: PEAK.x, z: PEAK.z + PEAK.rSum - 10 });
  return out;
} // (the quest tracker shows the island's goals now)
