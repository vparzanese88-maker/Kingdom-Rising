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
import { dressMob, dressBeast, dressPerson, propAt, tickDress, loadGI } from './gimodels.js';
import { M } from './audio.js';
import { count as itemCount, addItem } from './game.js';
import { GI, PEAK, GORGE, GORGE_W, GORGE_RIM, BRIDGE1, TRIBES, LAIRS, CAMP_SPOT, VILLAGE_GI, RAMP1, RAMP2, rampPoint, rampNear, WORKS, WRECK, BOATYARD, WASH, CLIMBS, FANGS } from './gimap.js';

const R = (a, b) => a + Math.random() * (b - a);
// the zone names shown under the minimap
if (GI) { const N = { coast: ['Wreck Shore', '1-3'], meadow: ['The South Valley', '1-4'], wood: ['Grimtusk Wilds', '1-7'], highlands: ['Grimtusk Peak', '7-10'], north: ['The North Cliffs', '5-8'] };
  for (const z of ZONES) if (N[z.id]) { z.name = N[z.id][0]; z.lv = N[z.id][1]; } }

// ---------------- the people and their quests ----------------
const V = VILLAGE_GI, GSKIN = ['#6f9a3c', '#7fa848', '#5f8a34', '#86ac52'];
export const TUT_DUMMY = { x: V.x - 14, z: V.z + 12 }; // the village's old training dummy (the first steps)
if (GI) {
  for (const k of Object.keys(NPCS)) delete NPCS[k];
  Object.assign(NPCS, {
    templeton: { name: 'Templeton', title: 'Goblin Shipwright', race: 'goblin', sex: 'm', outfit: 'worker', skin: GSKIN[1], job: 'hammer', x: BOATYARD.x + 2, z: BOATYARD.z - 5, hello: 'You\'re up! Easy, easy, don\'t fall over again. I found you on the beach, all wrapped up in fishnets like the catch of the day.' },
    grubnose: { name: 'Elder Grubnose', title: 'Snagglefoot Elder', race: 'goblin', sex: 'm', outfit: 'elder', skin: GSKIN[2], x: V.x, z: V.z - 6, hello: 'Welcome to Snagglefoot, tall one. We are only a few families, but what we have, we share.' },
    mags: { name: 'Old Mags', title: 'Snagglefoot Cook', race: 'goblin', sex: 'f', outfit: 'worker', skin: GSKIN[3], x: V.x + 12, z: V.z + 7, hello: 'The Warchief\'s collectors took half our grain again. Still, nobody goes hungry at my pot.' },
    snik: { name: 'Snik', title: 'Snagglefoot Scout', race: 'goblin', sex: 'm', outfit: 'hunter', skin: GSKIN[1], x: V.x + 26, z: V.z - 18, hello: 'Shh! The regime\'s goblins walk the road. Snik counts them. Too many, too many.' },
  });
  const Q = (o) => Object.assign({ done: '', gold: 0, lvl: 1 }, o);
  QUESTS.length = 0;
  QUESTS.push(
    Q({ id: 'gi_arrive', main: true, giver: null, turnin: 'templeton', title: 'Back on Your Feet', xp: 40,
      text: 'You wake on a straw mat in a goblin village. You remember nothing: not your name, not how you got here. A small goblin is hammering at a half-built boat nearby.',
      done: 'Name\'s Templeton. I hauled you up from the beach last night, half drowned, all tangled in barrels and nets. This is Snagglefoot, my tribe\'s village. Get your legs back first, then we\'ll talk.',
      obj: [{ t: 'talk', npc: 'templeton', label: 'Talk to the goblin who found you' }] }),
    Q({ id: 'gi_first', main: true, giver: 'templeton', turnin: 'templeton', req: ['gi_arrive'], title: 'First Steps', xp: 80,
      text: 'You are still weak. Templeton wants you to get your strength back before you wander off: hit the old training dummy, and eat something hot from Mags\' cook pot.',
      done: 'Look at you, swinging and eating like a proper goblin! You\'ll do.',
      obj: [{ t: 'flag', flag: 'tut_dummy', label: 'Hit the training dummy 5 times', at: [TUT_DUMMY.x, TUT_DUMMY.z], r: 6 }, { t: 'flag', flag: 'tut_cook', label: 'Cook a meal at Mags\' cook pot', at: [V.x + 15, V.z + 9], r: 5 }] }),
    Q({ id: 'gi_village', main: true, giver: 'templeton', turnin: 'grubnose', req: ['gi_first'], title: 'The Tribe', xp: 80,
      text: 'Elder Grubnose leads Snagglefoot. Templeton says you should hear from him how things stand on Goblos.',
      done: 'We are a few families who would not bow to the Warchief. His regime rules Goblos from its fort on Grimtusk Peak. They tax us until we starve, and take anyone who argues. So we live out here, quietly, and barely get by.',
      obj: [{ t: 'talk', npc: 'grubnose', label: 'Talk to Elder Grubnose' }] }),
    Q({ id: 'gi_boat', main: true, giver: 'grubnose', turnin: 'templeton', req: ['gi_village'], title: 'The Boat', xp: 120,
      text: 'Templeton has dreamed of leaving Goblos all his life. Grubnose says to ask him about the boat.',
      done: 'She\'s a beauty, isn\'t she? Well... she will be. I\'ve got scraps and a bent hammer. The regime keeps all the good timber, cloth, iron and tar. Bring me those, and we sail off this rock together. Gob is only ninety miles west!',
      obj: [{ t: 'talk', npc: 'templeton', label: 'Ask Templeton about his boat' }] }),
    Q({ id: 'gi_ship1', main: true, giver: 'templeton', turnin: 'templeton', req: ['gi_boat'], title: 'Seasoned Timber', xp: 200, lvl: 2,
      text: 'The regime\'s Bloodfang goblins cut and stack the island\'s best timber at their lumber camp in the south valley. Templeton needs it for the hull.',
      done: 'Now that\'s timber! The keel will be strong.', obj: [{ t: 'flag', flag: 'timber', label: 'Take seasoned timber from the Bloodfang lumber camp', at: [WORKS[0].x, WORKS[0].z], r: 14 }] }),
    Q({ id: 'gi_crank', main: true, giver: 'grubnose', turnin: 'grubnose', req: ['gi_village'], title: 'The Bloodfang Crank', xp: 300, lvl: 2,
      text: 'The regime\'s fort sits on top of Grimtusk Peak. The only way north is the drawbridge over the Great Gorge, and it is raised. The Bloodfang Chieftain carries the winch crank.',
      done: 'The bridge is down! Now the road north is open to you. Be careful, tall one.',
      obj: [{ t: 'flag', flag: 'bloodfang', label: 'Kill the Bloodfang Chieftain', at: [TRIBES.bloodfang.x, TRIBES.bloodfang.z], r: 30 }, { t: 'flag', flag: 'bridge1', label: 'Lower the drawbridge (the winch at the gorge)', at: [BRIDGE1.x + 4, BRIDGE1.zS + 2], r: 8 }] }),
    Q({ id: 'gi_totems', main: true, giver: 'grubnose', turnin: null, req: ['gi_crank'], title: 'Two War Totems', xp: 600, lvl: 4,
      text: 'The goblin gatehouse at the foot of the Switchback Road only opens for the tribes. Topple the Mudfoot and Skullsplitter war totems by killing their chiefs, and the gate will rise.',
      obj: [{ t: 'flag', flag: 'mudfoot', label: 'Kill the Mudfoot Bog-Chief (west valley)', at: [TRIBES.mudfoot.x, TRIBES.mudfoot.z], r: 30 }, { t: 'flag', flag: 'skull', label: 'Kill the Skullsplitter Headtaker (east valley)', at: [TRIBES.skull.x, TRIBES.skull.z], r: 30 }] }),
    Q({ id: 'gi_shelf', main: true, giver: null, turnin: null, req: ['gi_totems'], title: 'The Switchback Road', xp: 800, lvl: 6,
      text: 'Climb the Switchback Road to the High Shelf halfway up Grimtusk Peak. Grumbak the Gate-Troll holds the key to the Skull Stair, the last way up.',
      obj: [{ t: 'flag', flag: 'shelf', label: 'Reach the High Shelf', at: [rampPoint(RAMP1, 1).x, rampPoint(RAMP1, 1).z], r: 14 }, { t: 'flag', flag: 'lair_gate', label: 'Kill Grumbak the Gate-Troll', at: [LAIRS[2].x, LAIRS[2].z], r: 18 }] }),
    Q({ id: 'gi_summit', main: true, giver: null, turnin: null, req: ['gi_shelf'], title: 'Storm the Fort', xp: 1000, lvl: 8,
      text: 'Climb the Skull Stair to the regime\'s fort on the summit of Grimtusk Peak. The Warchief and his three champions wait there.',
      obj: [{ t: 'flag', flag: 'summit', label: 'Reach the Warchief\'s fort on the summit', at: [PEAK.x, PEAK.z], r: 30 }] }),
    Q({ id: 'gi_ship2', main: true, giver: 'templeton', turnin: 'templeton', req: ['gi_ship1', 'gi_crank'], title: 'Sailcloth', xp: 350, lvl: 4,
      text: 'Templeton\'s sails are rags. The Mudfoot goblins weave hide-cloth for the regime on drying racks in their swamp village.',
      done: 'Smells like a bog, but it\'ll catch the wind.', obj: [{ t: 'flag', flag: 'cloth', label: 'Take sailcloth from the Mudfoot drying racks', at: [TRIBES.mudfoot.x + 10, TRIBES.mudfoot.z + 10], r: 14 }] }),
    Q({ id: 'gi_ship3', main: true, giver: 'templeton', turnin: 'templeton', req: ['gi_ship2'], title: 'Iron and Tar', xp: 500, lvl: 5,
      text: 'Iron nails from the regime\'s Skullsplitter forge, and tar from the troll Old Gnash\'s cauldron on the High Shelf.',
      done: 'Nails and tar! She\'ll be watertight now.', obj: [{ t: 'flag', flag: 'nails', label: 'Take iron nails from the Skullsplitter forge', at: [TRIBES.skull.x - 10, TRIBES.skull.z + 10], r: 14 }, { t: 'flag', flag: 'tar', label: 'Take tar from Old Gnash\'s cauldron (High Shelf)', at: [LAIRS[0].x, LAIRS[0].z], r: 16 }] }),
    Q({ id: 'gi_warchief', main: true, giver: 'templeton', turnin: 'templeton', req: ['gi_summit'], title: 'The Warchief', xp: 600, lvl: 8,
      text: 'Storm the regime\'s fort on the summit and defeat the Warchief. His fort holds the last things Templeton needs: a ship\'s compass and rudder irons. And whatever else you find there.',
      done: 'The Warchief is gone? Then Goblos is free! And a real compass... we can actually find Gob now!',
      obj: [{ t: 'flag', flag: 'freed', label: 'Defeat the Warchief in his fort' }] }),
    Q({ id: 'gi_sail', main: true, giver: 'templeton', turnin: null, req: ['gi_warchief'], title: 'Setting Sail', xp: 400, lvl: 8,
      text: 'The boat is finished and waiting at the pier. Gob, a busy port city, lies ninety miles to the west. Templeton is coming with you.',
      obj: [{ t: 'flag', flag: 'sailed', label: 'Board the boat at the pier with Templeton' }] }),
    Q({ id: 'gi_boars', giver: 'mags', turnin: 'mags', req: ['gi_village'], title: 'Garden Raiders', xp: 180, lvl: 1,
      text: 'Wild boars dig up Snagglefoot\'s gardens every night. Mags wants five of them gone (and in her pot).', done: 'Boar stew tonight! You are welcome at our fire, tall one.',
      obj: [{ t: 'kill', mob: 'boar', n: 5, label: 'Kill wild boars' }] }),
    Q({ id: 'gi_madgobs', giver: 'snik', turnin: 'snik', req: ['gi_village'], title: 'Too Many Mad Ones', xp: 260, lvl: 2,
      text: 'The regime\'s goblins prowl the roads of the south valley. Snik wants the road to Snagglefoot safe again.', done: 'Snik counts... fewer! Much fewer!',
      obj: [{ t: 'kill', mob: 'goblin', n: 8, label: 'Kill regime goblins' }] }),
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
  if (!GI) return; H = Object.assign({}, helpers); const { M } = H;
  // (the owner: all new models for everything) the small helpers place Meshy props instead of the old shapes
  H.barrel = (sc, x, z) => { propAt('barrel', x, heightAt(x, z), z, R(0, 6.28), 1.0); addCircle(x, z, 0.4); };
  H.crate = (sc, x, z, r = 0, s = 0.8) => { propAt('crate', x, heightAt(x, z), z, r, s * 1.1); addBox(x, z, s * 0.55, s * 0.55, r); };
  H.tent = (sc, x, z, rot, m, s = 1) => { propAt(m === M.cloth || m === M.clothBlue ? 'sail_tent' : 'goblin_tent', x, heightAt(x, z), z, rot, 3.2 * s); addCircle(x, z, 1.7 * s); };
  H.campfire = (g) => { propAt('campfire', 0, 0, 0, R(0, 6.28), 0.9, g); };
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
  // jungle floor: ferns, mossy logs, mushrooms and bushes (Meshy props), clear of towns, camps and paths
  for (let i = 0, n = 0; i < 4000 && n < 260; i++) { const x = R(-440, 440), z = R(-420, 440), h = heightAt(x, z); if (h < 2.5 || giAvoid(x, z, 4) || Math.hypot(x - PEAK.x, z - PEAK.z) < PEAK.rLow + 10) continue;
    if ([CAMP_SPOT, V, ...Object.values(TRIBES), ...WORKS].some(c => Math.hypot(c.x - x, c.z - z) < c.r + 10)) continue; const k = n % 7, name = ['fern_lo', 'fern_lo', 'bush_lo', 'mossy_log', 'mushrooms', 'fern_lo', 'bush_lo'][k];
    propAt(name, x, h, z, R(0, 6.28), name === 'mossy_log' ? 1.0 : name === 'mushrooms' ? 0.7 : R(0.9, 1.5)); if (name === 'mossy_log') addCircle(x, z, 1.0); n++; }
}
function buildSailorCamp(scene) {
  const { M, tent, campfire, placeGroup, barrel, crate } = H, c = CAMP_SPOT;
  tent(scene, c.x - 8, c.z - 6, 0.4, M.cloth, 1.1); tent(scene, c.x + 7, c.z - 9, -0.5, M.cloth); tent(scene, c.x - 12, c.z + 6, 1.8, M.clothBlue, 0.9);
  const fg = new THREE.Group(); campfire(fg, scene, c.x, c.z); placeGroup(fg, c.x, c.z, 0, scene); addCircle(c.x, c.z, 0.9); H.fire(scene, c.x, heightAt(c.x, c.z) + 0.5, c.z, 0.8);
  [[c.x + 5, c.z + 4], [c.x + 6, c.z + 5.2], [c.x - 4, c.z + 9]].forEach(([x, z]) => barrel(scene, x, z));
  [[c.x + 9, c.z + 2, 0.3], [c.x + 9.6, c.z + 3.2, 0.9], [c.x - 9, c.z - 1, 0.2]].forEach(([x, z, r]) => crate(scene, x, z, r));
}
// Templeton's wrecked ship on the beach, and beside it the boat he builds from it and your rowboat
function buildWreck(scene) {
  const { M, bx, cy } = H, g = new THREE.Group();
  const hm = M.wood.clone(); hm.side = THREE.DoubleSide; const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), hm); hull.scale.set(4.2, 3, 13); hull.position.y = 2.6; g.add(hull);
  bx(8, 0.3, 24, M.plank, 0, 2.5, 0, g); cy(0.3, 0.38, 14, M.wood, 0, 9, 3, g, 8); cy(0.26, 0.32, 11, M.wood, 0, 7.6, -5, g, 8);
  const holes = []; for (const [x, z] of [[-3.6, 4], [3.8, -2], [-3.5, -6]]) { const hh = new THREE.Mesh(new THREE.CircleGeometry(1.2, 10), new THREE.MeshBasicMaterial({ color: '#0a0806', side: THREE.DoubleSide })); hh.position.set(x, 2.0, z); hh.rotation.y = Math.PI / 2; g.add(hh); holes.push(hh); }
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(7, 6, 4, 4), M.cloth); sail.position.set(0, 10, 3.4); g.add(sail);
  g.position.set(WRECK.x, heightAt(WRECK.x, WRECK.z) - 0.4, WRECK.z); g.rotation.set(0, WRECK.yaw, 0.12); scene.add(g);
  addBox(WRECK.x, WRECK.z, 4.2, 12, WRECK.yaw);
  live.wreck = { g, holes, sail };
  propAt('shipwreck', WRECK.x, heightAt(WRECK.x, WRECK.z) - 0.6, WRECK.z, WRECK.yaw, 9).then(o => { if (!o) return; live.wreck.meshy = o; g.visible = false; setWreck(isle()); });
  { const P = world.pier, dx = P ? P.x + P.w + 10 : WRECK.x, dz = P ? (P.z0 + P.z1) / 2 + 8 : WRECK.z; // (the finished boat, moored at the pier for the voyage to Gob)
    propAt('rowboat', dx, -0.8, dz, 0.04, 9).then(o => { if (!o) return; live.wreck.fixed = o; o.visible = false; setWreck(isle()); });
    use(dx - 4, dz - 6, () => isle().freed && !isle().sailed ? 'Set sail for Gob with Templeton' : null, () => { const I = isle(); I.sailed = true; G.hooks.banner && G.hooks.banner('Setting sail', 'Templeton at the tiller, Gob ninety miles to the west...', 7000); G.hooks.questsChanged && G.hooks.questsChanged(); }); }
  // where you washed up: barrels, a smashed crate and a tangle of fishnets on the sand
  { const yw = (x, z) => Math.max(0.15, heightAt(x, z));
    for (const [nm, dx, dz, s2, r] of [['barrel', -1.5, 0.6, 1.0, 0.3], ['barrel', 1.8, -0.8, 0.95, 1.2], ['crate', 0.6, 2.2, 0.8, 0.7]]) { const x = WASH.x + dx, z = WASH.z + dz; propAt(nm, x, yw(x, z), z, r, s2).then(o => { if (o && nm === 'barrel' && dx > 0) { o.rotation.z = Math.PI / 2; o.position.y = yw(x, z) + 0.35; } }); }
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c2 = cv.getContext('2d'); c2.strokeStyle = '#4a3a24'; c2.lineWidth = 3; for (let k = 0; k <= 128; k += 16) { c2.beginPath(); c2.moveTo(k, 0); c2.lineTo(k + 8, 128); c2.stroke(); c2.beginPath(); c2.moveTo(0, k); c2.lineTo(128, k + 6); c2.stroke(); }
    const tx = new THREE.CanvasTexture(cv); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(3, 3); tx.colorSpace = THREE.SRGBColorSpace;
    const net = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 3.5, 12, 10), new THREE.MeshStandardMaterial({ map: tx, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 1 }));
    { const p = net.geometry.attributes.position; for (let k = 0; k < p.count; k++) p.setZ(k, Math.sin(p.getX(k) * 2.1) * 0.12 + Math.cos(p.getY(k) * 2.7) * 0.1 + 0.08); net.geometry.computeVertexNormals(); }
    net.rotation.x = -Math.PI / 2; net.rotation.z = 0.4; net.position.set(WASH.x, yw(WASH.x, WASH.z) + 0.02, WASH.z); scene.add(net); live.net = net; }
  // Templeton's boatyard at the edge of Snagglefoot: a bare keel and ribs at first; the hull, timber and stores come with the materials you win back
  const Y = BOATYARD, yh = (x, z) => heightAt(x, z), W = live.wreck, at = (x, z) => [Y.x + Math.cos(Y.yaw) * x + Math.sin(Y.yaw) * z, Y.z - Math.sin(Y.yaw) * x + Math.cos(Y.yaw) * z];
  W.yard = [];
  for (const [nm, x0, z0, s2, r, st] of [['lumber_pile', 6, -6, 2.3, 0.4, 2], ['supply_pile', -4, -8, 2.2, -0.3, 3], ['barrel', 7, 5, 1.1, 0, 4], ['crate', 8.5, 4, 1.0, 0.5, 4], ['crate', 8, 6.2, 1.0, 0.1, 4], ['campfire', -10, -6, 1.4, 0, 0], ['sail_tent', -12, 4, 3.2, 1.2, 0]]) {
    const [x, z] = at(x0, z0), col = addCircle(x, z, nm === 'sail_tent' ? 1.6 : 0.9); col.on = false; propAt(nm, x, yh(x, z), z, Y.yaw + r, s2).then(o => { if (!o) return; o.userData.st = st; o.userData.col = col; W.yard.push(o); setWreck(isle()); }); } // (each prop is solid only while it's there)
  { const g = new THREE.Group(), lm = H.M.wood; for (let i = -2; i <= 2; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 4.2, 8), lm); l.rotation.z = Math.PI / 2; l.position.set(0, 0.28, i * 2.2); g.add(l); }
    const [x, z] = at(0, 0); g.position.set(x, yh(x, z), z); g.rotation.y = Y.yaw; g.userData.st = 0; scene.add(g); W.yard.push(g); addBox(x, z, 2.4, 6, Y.yaw); }
  { const g = new THREE.Group(), lm = H.M.wood; const keel = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 9.5), lm); keel.position.y = 0.75; g.add(keel); // (the bare frame: a keel and curved ribs)
    for (let i = -4; i <= 4; i++) { const w = 1.5 * Math.cos(i / 5.2 * 1.3); for (const sd of [-1, 1]) { const rib = new THREE.Mesh(new THREE.TorusGeometry(w, 0.07, 5, 10, Math.PI / 2), lm); rib.position.set(0, 0.75 + w, i * 1.05); rib.rotation.set(0, Math.PI / 2, sd > 0 ? Math.PI : -Math.PI / 2); g.add(rib); } }
    const [x, z] = at(0, 0); g.position.set(x, yh(x, z) + 0.2, z); g.rotation.y = Y.yaw; g.userData.st = 0; g.userData.until = 2; scene.add(g); W.yard.push(g); }
  { const [x, z] = at(0, 0); propAt('rowboat', x, yh(x, z) + 0.45, z, Y.yaw, 9).then(o => { if (!o) return; W.hull = o; setWreck(isle()); }); }
}
// how far Templeton's boat has got: a step for each victory that brings him materials (the owner's storyline)
const MAIN = ['gi_boat', 'gi_ship1', 'gi_ship2', 'gi_ship3', 'gi_warchief'];
export function rebuildStage() { const Q = G.save && G.save.quests; if (!Q) return 0; return MAIN.filter(id => Q.done.includes(id)).length; }
const STAGE_SAY = [null,
  ['Templeton shows you his boat', '"Scraps and a bent hammer. But she\'s got good bones!"'],
  ['A hull of seasoned timber', '"Real timber! Look at her, she\'s a boat now!"'],
  ['Sails stitched and drying', '"Smells like a bog. Catches wind like a dream."'],
  ['Nailed and tarred', '"Watertight! Now if only we could steer..."'],
  ['The boat is in the water', '"Compass, rudder irons, and a free sea. Meet me at the pier, friend!"']];
function setWreck(I) { const W = live.wreck; if (!W) return; const st = rebuildStage(); if (W.meshy) W.meshy.visible = true; if (W.fixed) W.fixed.visible = st >= 5; if (W.hull) W.hull.visible = st >= 2 && st < 5;
  for (const o of W.yard || []) { o.visible = st >= o.userData.st && (o.userData.until == null || st < o.userData.until) && !(o.userData.st === 0 && o.userData.until == null && st >= 5 && o.children.length === 5); if (o.userData.col) o.userData.col.on = o.visible; }
  if (world.myBoat) world.myBoat.visible = false; W.holes.forEach(h => { h.visible = true; }); W.sail.visible = false; }
// Snagglefoot: a small friendly goblin village (blue and yellow, never possessed)
function buildSnagglefoot(scene) {
  const { M, tent, campfire, placeGroup, barrel, crate, bx, cy, addHouse } = H;
  for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28 + 0.3, r = 18 + (i % 2) * 5, x = V.x + Math.cos(a) * r, z = V.z + Math.sin(a) * r; propAt('goblin_hut', x, heightAt(x, z), z, -a - Math.PI / 2, 4.6); addCircle(x, z, 2.6); }
  { const x = V.x + 15, z = V.z + 9; propAt('cook_pot', x, heightAt(x, z), z, 0, 1.6); addCircle(x, z, 0.9);
    // Mags' cook pot: the first crafting (she hands you meat to cook the first time)
    use(x, z + 1.6, () => { const Q = G.save && G.save.quests; return Q && Q.active.gi_first && !isle().tut_cook ? 'Cook a meal (Mags\' cook pot)' : 'Cook (campfire)'; }, () => { const h = G.save;
      if (h.quests.active.gi_first && !isle().tut_cook && itemCount(h, 'raw_meat') < 1) { addItem(h, 'raw_meat', 1, true); G.hooks.toast && G.hooks.toast('Mags hands you a cut of boar meat', '🥩', 'gold'); }
      G.hooks.station && G.hooks.station('campfire'); }); }
  // the village's old training dummy: a post, a straw-stuffed sack and a crossbar (the first steps)
  { const g = new THREE.Group(), wd = H.M.wood, straw = new THREE.MeshStandardMaterial({ color: '#c8a85a', roughness: 1 }), sack = new THREE.MeshStandardMaterial({ color: '#9a7a4a', roughness: 1 });
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.9, 8), wd); post.position.y = 0.95; g.add(post);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6), wd); bar.rotation.z = Math.PI / 2; bar.position.y = 1.35; g.add(bar);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 0.75, 10), sack); body.position.y = 1.1; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), sack); head.position.y = 1.68; g.add(head);
    for (const sd of [-1, 1]) { const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 5), straw); tuft.position.set(sd * 0.62, 1.35, 0); tuft.rotation.z = sd * Math.PI / 2; g.add(tuft); }
    live.dummyLook = g; }
  for (let i = 0; i < 3; i++) { const a = i / 3 * 6.28 + 1.1, x = V.x + Math.cos(a) * 10, z = V.z + Math.sin(a) * 10; propAt('goblin_tent', x, heightAt(x, z), z, -a, 3.0); addCircle(x, z, 1.6); }
  { const x = V.x - 8, z = V.z - 9; propAt('well', x, heightAt(x, z), z, 0.4, 3.2); addCircle(x, z, 1.3); }
  const fg = new THREE.Group(); campfire(fg, scene, V.x, V.z + 2); placeGroup(fg, V.x, V.z + 2, 0, scene); addCircle(V.x, V.z + 2, 0.9); H.fire(scene, V.x, heightAt(V.x, V.z + 2) + 0.5, V.z + 2, 1);
  { const x = V.x + 10, z = V.z + 4; propAt('market_stall', x, heightAt(x, z), z, -0.6 + Math.PI, 3.0); addBox(x, z, 1.5, 0.8, 0.6); }
  [[V.x + 4, V.z + 12], [V.x + 5, V.z + 13], [V.x - 11, V.z + 6]].forEach(([x, z]) => barrel(scene, x, z)); [[V.x - 12, V.z + 8, 0.4], [V.x + 13, V.z - 3, 0.1]].forEach(([x, z, r]) => crate(scene, x, z, r));
  { const n = Math.round(V.r * 6.28 / 2.6); for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * 6.28; if ([0.15, 2.2, 3.6, -0.9].some(gp => Math.abs(Math.atan2(Math.sin(a - gp), Math.cos(a - gp))) < 0.2)) continue; const x = V.x + Math.cos(a) * V.r, z = V.z + Math.sin(a) * V.r; propAt('fence', x, heightAt(x, z), z, -a - Math.PI / 2, 1.3); addBox(x, z, 1.3, 0.15, -a + Math.PI / 2); } }
}
// the gorge: rock faces down both walls, the drawbridge and its winch
function buildGorge(scene) {
  const { M, bx, cy } = H;
  { const pts = []; for (const side of [-1, 1]) for (let i = 0; i < GORGE.length - 1; i++) { const [ax, az] = GORGE[i], [bx2, bz] = GORGE[i + 1], len = Math.hypot(bx2 - ax, bz - az), ux = (bx2 - ax) / len, uz = (bz - az) / len, nx = -uz * side, nz = ux * side;
      for (let d = 0; d < len; d += 5.5) { const x = ax + ux * d + nx * (GORGE_W + 2.5), z = az + uz * d + nz * (GORGE_W + 2.5); if (Math.abs(x - BRIDGE1.x) < 5) continue; const y = heightAt(x, z); if (y < -6) continue; pts.push([x, y, z]); } }
    loadGI('rock_face').then(gl => { if (!gl) return; let geo = null, mat = null; gl.scene.updateMatrixWorld(true); gl.scene.traverse(o => { if (o.isMesh && !geo) { geo = o.geometry.clone().applyMatrix4(o.matrixWorld); mat = o.material; } }); if (!geo) return;
      geo.computeBoundingBox(); const b = geo.boundingBox, c = b.getCenter(new THREE.Vector3()), hh = b.max.y - b.min.y; geo.translate(-c.x, -b.min.y, -c.z); geo.scale(1 / hh, 1 / hh, 1 / hh);
      const im = new THREE.InstancedMesh(geo, mat, pts.length), o = new THREE.Object3D();
      pts.forEach(([x, y, z], i) => { o.position.set(x, y - 9, z); o.rotation.set(0, i * 2.1, (i % 3 - 1) * 0.08); const hgt = 16 + (i % 4) * 3; o.scale.set(hgt * 0.9, hgt, hgt * 0.9); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
      im.castShadow = im.receiveShadow = true; scene.add(im); }); }
  const B = BRIDGE1, yS = heightAt(B.x, B.zS), yN = heightAt(B.x, B.zN), len = B.zS - B.zN;
  for (const [z, y] of [[B.zS, yS], [B.zN, yN]]) for (const sx of [-1, 1]) { const g = new THREE.Group(); cy(0.45, 0.55, 8, M.beam, 0, 4, 0, g, 8); bx(1.2, 0.7, 1.2, M.iron, 0, 8.2, 0, g); g.position.set(B.x + sx * 2.9, y, z); scene.add(g); addCircle(B.x + sx * 2.9, z, 0.4); }
  for (const z of [B.zS - 3, B.zN + 3]) parts.gap1.push(addBox(B.x, z, 2.6, 0.5, 0, 'gap')); // (until it's down, nobody steps off the end)
  // (the owner: no invisible walls) the barrier you bump into is a rope strung between two posts, with a warning skull
  live.ropes = []; for (const z of [B.zS - 3, B.zN + 3]) { const g = new THREE.Group(), y0 = heightAt(B.x, z);
    for (const sx of [-1, 1]) cy(0.1, 0.12, 1.3, M.beam, sx * 2.6, 0.65, 0, g, 6);
    const rope = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(-2.6, 1.15, 0), new THREE.Vector3(0, 0.75, 0), new THREE.Vector3(2.6, 1.15, 0)), 12, 0.035, 5), new THREE.MeshStandardMaterial({ color: '#8a6a3a', roughness: 1 })); g.add(rope);
    const sk = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshStandardMaterial({ color: '#e8e0c8', roughness: 0.9 })); sk.position.set(0, 0.62, 0); g.add(sk);
    g.position.set(B.x, y0, z); scene.add(g); live.ropes.push(g); }
  const deck = new THREE.Group(), pivot = new THREE.Group(); pivot.position.set(B.x, yN + 0.25, B.zN); scene.add(pivot);
  for (let i = 0; i < len / 0.6; i++) bx(4.4, 0.18, 0.55, M.plank, 0, 0, 0.3 + i * 0.6, deck); for (const sx of [-1, 1]) { bx(0.25, 0.3, len, M.beam, sx * 2.1, 0.12, len / 2, deck); bx(0.12, 1.0, len, M.beam, sx * 2.25, 0.7, len / 2, deck); }
  pivot.add(deck); live.bridge1 = { pivot, yS, yN, len, open: 0, want: 0 }; setBridge(live.bridge1, 0);
  loadGI('drawbridge').then(gl => { if (!gl) return; const o = gl.scene.clone(), sz = gl.box.getSize(new THREE.Vector3()), c = gl.box.getCenter(new THREE.Vector3()), along = sz.x > sz.z ? 'x' : 'z', inner = new THREE.Group();
    o.position.set(-c.x, -gl.box.max.y, -c.z); inner.add(o); if (along === 'x') inner.rotation.y = Math.PI / 2; const wrap = new THREE.Group(); wrap.add(inner); wrap.scale.set(4.6 / Math.min(sz.x, sz.z), 1.2 / Math.max(0.05, sz.y), len / Math.max(sz.x, sz.z)); wrap.position.set(0, 0.15, len / 2); for (const ch of deck.children) ch.visible = false; deck.add(wrap); });
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
  if (kind !== 'stone') propAt('gatehouse', p.x, y, p.z, dir + Math.PI, 12).then(o => { if (o) g.visible = false; });
  else for (const sd of [-1, 1]) { const q = { x: p.x + Math.cos(dir) * sd * (w + 1.5), z: p.z - Math.sin(dir) * sd * (w + 1.5) }; propAt('rock_face', q.x, heightAt(q.x, q.z), q.z, dir, 12).then(o => { if (o) g.visible = false; }); }
  const cols = [addBox(p.x, p.z, w + 0.3, 0.6, dir + Math.PI / 2, 'gate')];
  for (const s of [-1, 1]) { const q = { x: p.x + Math.cos(dir) * s * (w + 1.5), z: p.z - Math.sin(dir) * s * (w + 1.5) }; addBox(q.x, q.z, 1.5, 1.5, dir + Math.PI / 2); }
  for (let tt = Math.max(0, t - 0.06); tt < t + 0.2; tt += 0.012) { const a = rampPoint(Rp, tt), out = Math.hypot(a.x - PEAK.x, a.z - PEAK.z) + Rp.half + 0.8, ang = Math.atan2(a.z - PEAK.z, a.x - PEAK.x), x = PEAK.x + Math.cos(ang) * out, z = PEAK.z + Math.sin(ang) * out;
    propAt('palisade', x, heightAt(x, z), z, -ang - Math.PI / 2, 3.0); addCircle(x, z, 0.75); } // (a palisade section at every collider: no invisible gaps)
  return { gate, y, open: 0, want: 0, cols };
}
function buildTribe(scene, id, t) {
  const { M, tent, campfire, placeGroup, bx, cy, barrel } = H;
  const mat = id === 'bloodfang' ? M.goblinRed : id === 'mudfoot' ? M.mud : M.boneCloth;
  const toward = Math.atan2(-t.z, -t.x), stake = new THREE.CylinderGeometry(0.03, 0.24, 3.8, 6);
  { const n = Math.round(t.r * 6.28 / 4.2); for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * Math.PI * 2; if (Math.abs(Math.sin((a - toward) / 2)) < 0.11) continue; const x = t.x + Math.cos(a) * t.r, z = t.z + Math.sin(a) * t.r; propAt('palisade', x, heightAt(x, z), z, -a - Math.PI / 2, 3.2); addBox(x, z, 2.2, 0.4, -a + Math.PI / 2); } }
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28 + 0.6, x = t.x + Math.cos(a) * t.r * 0.62, z = t.z + Math.sin(a) * t.r * 0.62; propAt('goblin_tent', x, heightAt(x, z), z, -a + Math.PI / 2, 3.4); addCircle(x, z, 1.8); }
  propAt('bonfire', t.x, heightAt(t.x, t.z), t.z, 0, 1.6); addCircle(t.x, t.z, 1.1); H.fire(scene, t.x, heightAt(t.x, t.z) + 0.8, t.z, 1.3);
  { const a = toward + 0.5, x = t.x + Math.cos(a) * (t.r - 3), z = t.z + Math.sin(a) * (t.r - 3); propAt('watchtower', x, heightAt(x, z), z, -a, 8); addCircle(x, z, 2.2); }
  { const x = t.x + 6, z = t.z - 5; propAt('cook_pot', x, heightAt(x, z), z, 0, 1.6); addCircle(x, z, 0.9); const x2 = t.x - 8, z2 = t.z + 8; propAt('supply_pile', x2, heightAt(x2, z2), z2, 1, 1.8); addCircle(x2, z2, 1.4); }
  for (let i = 0; i < 4; i++) barrel(scene, t.x - t.r * 0.4 + (i % 2) * 0.9, t.z + t.r * 0.35 + (i >> 1) * 0.9);
  const tp = { x: t.x + Math.cos(toward + Math.PI) * 9, z: t.z + Math.sin(toward + Math.PI) * 9 }, g = new THREE.Group();
  propAt('war_totem', 0, 0, 0, 0, 7.5, g); // (topples with its chief)
  g.position.set(tp.x, heightAt(tp.x, tp.z), tp.z); g.rotation.y = toward + Math.PI; scene.add(g); addCircle(tp.x, tp.z, 0.7);
  live.totems[id] = { g, k: 0, want: 0 };
}
function buildLair(scene, l) {
  const away = Math.atan2(l.z - PEAK.z, l.x - PEAK.x); propAt('cave_mouth', l.x, heightAt(l.x, l.z), l.z, -away + Math.PI / 2, 7); propAt('cook_pot', l.x + 4, heightAt(l.x + 4, l.z + 3), l.z + 3, 0, 1.8); return;
  const { M, cy } = H, g = new THREE.Group();
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
  const gr = R(0, 3); placeGroup(g, w.x, w.z, gr, scene); if (w.kind === 'build') { for (const sx of [-1, 1]) for (const sz of [-1, 1]) addCircle(w.x + Math.cos(gr) * sx * 2.4 + Math.sin(gr) * sz * 2.4, w.z - Math.sin(gr) * sx * 2.4 + Math.cos(gr) * sz * 2.4, 0.35); } else addCircle(w.x, w.z, 2.6); // (the scaffold: you can walk under it; only its posts block)
  { const x = w.x + 7, z = w.z + 4; propAt(w.kind === 'lumber' ? 'lumber_pile' : 'supply_pile', x, heightAt(x, z), z, R(0, 3), 1.8); addCircle(x, z, 1.5); const x2 = w.x - 5, z2 = w.z - 7; propAt('goblin_cart', x2, heightAt(x2, z2), z2, R(0, 3), 2.2); addCircle(x2, z2, 1.6); }
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
// the supplies Templeton sends you for
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
  if (!I.crank) { G.hooks.toast && G.hooks.toast('The crank handle is missing. The Bloodfang Chieftain carries it.', '⚙', 'bad'); return; }
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
  for (const c of parts.gap1) c.on = !(live.bridge1.open > 0.95); for (const g of live.ropes || []) g.visible = !(live.bridge1.open > 0.95); for (const c of parts.gate1) c.on = !(live.gatehouse.open > 0.9); for (const c of parts.gate2) c.on = !(live.stairgate.open > 0.9);
  if (live.bridge1.open > 0.95 && !live.bridge1.surf) { live.bridge1.surf = true; const B = BRIDGE1; addSurface(B.x, (B.zS + B.zN) / 2, 2.2, (B.zS - B.zN) / 2, 0, live.bridge1.yN + 0.35, 0, live.bridge1.yS + 0.35); for (const s of [-1, 1]) for (let z = B.zN + 2; z < B.zS - 1; z += 4) parts.rail1.push(addBox(B.x + s * 2.5, z, 0.2, 2.1, 0, 'rail'));
    // (the owner: no invisible walls) the rails you lean on are rope railings on posts, the whole length of the bridge
    { const yAt = (z) => live.bridge1.yN + 0.35 + (live.bridge1.yS - live.bridge1.yN) * (z - B.zN) / (B.zS - B.zN), wood = new THREE.MeshStandardMaterial({ color: '#6a4a2a', roughness: 1 }), ropeM = new THREE.MeshStandardMaterial({ color: '#9a7a4a', roughness: 1 }), g = new THREE.Group();
      for (const sd of [-1, 1]) { const pts = []; for (let z = B.zN + 0.5; z <= B.zS - 0.5; z += 2) { const y = yAt(z); const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.15, 6), wood); post.position.set(B.x + sd * 2.5, y + 0.55, z); g.add(post); pts.push(new THREE.Vector3(B.x + sd * 2.5, y + 1.05, z)); }
        if (pts.length > 1) g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 4, 0.03, 5), ropeM)); }
      G.scene.add(g); } }
}
// chiefs and named trolls: what their deaths open
export function giKill(m) {
  if (!GI || !G.save) return; const I = isle(), say = (a, b) => G.hooks.banner && G.hooks.banner(a, b, 5000);
  if (m.giChief && !I[m.giChief]) { I[m.giChief] = true; m.respawnT = 1e12; const T = live.totems[m.giChief]; if (T) T.want = 1; const t = TRIBES[m.giChief];
    if (m.giChief === 'bloodfang') { I.crank = true; say('The Bloodfang Chieftain is dead', 'You took his iron crank: the drawbridge winch at the Great Gorge'); }
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
  tickCarts();
  // the first steps: you can't leave Snagglefoot until they're done (or skipped)
  { const P = G.player, h = G.save; if (P && h && h.tut === 'on') { const dx = P.pos.x - V.x, dz = P.pos.z - V.z, d = Math.hypot(dx, dz), R2 = V.r + 9;
      if (d > R2) { P.pos.x = V.x + dx / d * R2; P.pos.z = V.z + dz / d * R2; if ((G.time || 0) - (giTick.warn || -99) > 6) { giTick.warn = G.time || 0; G.hooks.toast && G.hooks.toast('Templeton: "Not yet! You can barely stand. Finish your first steps." (or skip them)', '🛑', 'bad'); } } } }
  if ((giTick.t = (giTick.t || 0) + dt) < 0.5) return; giTick.t = 0; tickDress();
  const P = G.player; if (!P || !G.save || !G.save.quests) return;
  const r = Math.hypot(P.pos.x - PEAK.x, P.pos.z - PEAK.z);
  if (!I.shelf && r < PEAK.rShelf && P.pos.y > PEAK.shelfH2 - 4) { I.shelf = true; G.hooks.banner && G.hooks.banner('The High Shelf', 'Halfway up Grimtusk Peak', 3500); G.hooks.questsChanged && G.hooks.questsChanged(); }
  if (!I.summit && r < PEAK.rSum + 4 && P.pos.y > PEAK.sumH - 8) { I.summit = true; G.hooks.banner && G.hooks.banner('The summit of Grimtusk Peak', 'The goblin city', 3500); G.hooks.questsChanged && G.hooks.questsChanged(); }
  const dn = (id) => G.save.quests.done.includes(id);
  if (G.save.quests.active.gi_first && !I.tut_cook && itemCount(G.save, 'roast_meat') > 0) { I.tut_cook = true; G.hooks.toast && G.hooks.toast('A hot meal! You feel stronger.', '🍖', 'gold'); G.hooks.questsChanged && G.hooks.questsChanged(); }
  // quests with nobody to give them start by themselves once their way is open
  for (const q of QUESTS) if (q.main && !q.giver && !G.save.quests.active[q.id] && !dn(q.id) && (q.req || []).every(dn)) { G.save.quests.active[q.id] = { p: q.obj.map(() => 0), t: Date.now() }; G.hooks.questsChanged && G.hooks.questsChanged(); }
  if (I.ship1 !== dn('gi_ship1') || I.ship2 !== dn('gi_ship2') || I.ship3 !== dn('gi_ship3')) { I.ship1 = dn('gi_ship1'); I.ship2 = dn('gi_ship2'); I.ship3 = dn('gi_ship3'); setWreck(I); }
  { const st = rebuildStage(); if (I.rebuild == null) I.rebuild = st; if (st !== I.rebuild) { const up = st > I.rebuild; I.rebuild = st; setWreck(I); const s = STAGE_SAY[st]; if (up && s) { G.hooks.banner && G.hooks.banner(s[0], 'Templeton: ' + s[1], 6000); G.hooks.toast && G.hooks.toast('Templeton\'s boat: step ' + st + ' of 7', '🔨', 'gold'); } } }
  for (const qid of Object.keys(G.save.quests.active)) { const q = QUESTS.find(x => x.id === qid); if (q && !q.turnin && q.obj.length && q.obj.every(o => o.t === 'flag' && I[o.flag])) G.hooks.autoTurnIn && G.hooks.autoTurnIn(q); }
}

// ---------------- the people (friendly goblins of Snagglefoot, sailors at the camp) ----------------
export function giPeople() {
  if (!GI) return;
  const OUT = ['worker', 'weaver', 'hunter', 'smith'];
  for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28, r = 6 + (i % 3) * 5, v = new Villager(V.x + Math.cos(a) * r, V.z + Math.sin(a) * r, { race: 'goblin', sex: i % 2 ? 'f' : 'm', outfit: OUT[i % 4], skin: GSKIN[i % 4], hair: '#2a2010', hairStyle: i % 3, beard: 0, height: 0.85 + (i % 4) * 0.08 });
    v.talkable = true; v.vname = ['Pogg', 'Nib', 'Grizzle', 'Tumble', 'Wort', 'Fizzle', 'Squik', 'Moss', 'Bimble'][i]; G.npcs.push(v); dressPerson(v, 'goblin_villager', 1.2 + (i % 4) * 0.08); }
  // chores: two chop wood at the village edge, two mend a hut, two chat by the fire; the rest stroll about
  { const vs = G.npcs.filter(n => n.vname && ['Pogg', 'Nib', 'Grizzle', 'Tumble', 'Wort', 'Fizzle'].includes(n.vname)), T = world.nodes.filter(n => n.type && n.type.startsWith('tree') && Math.hypot(n.x - V.x, n.z - V.z) > V.r && Math.hypot(n.x - V.x, n.z - V.z) < V.r + 25);
    vs.forEach((v, i) => { let spot, face, job;
      if (i < 2 && T[i]) { const n = T[i], a = Math.atan2(V.z - n.z, V.x - n.x); spot = { x: n.x + Math.cos(a) * 1.3, z: n.z + Math.sin(a) * 1.3 }; face = Math.atan2(n.x - spot.x, n.z - spot.z); job = 'chop'; }
      else if (i < 4) { const a = 0.3 + 0.3 * (i - 2), x = V.x + Math.cos(a) * 15.5, z = V.z + Math.sin(a) * 15.5; spot = { x, z }; face = Math.atan2(V.x + Math.cos(a) * 18 - x, V.z + Math.sin(a) * 18 - z); job = 'hammer'; }
      else { const a = i * 1.7; spot = { x: V.x + Math.cos(a) * 3.2, z: V.z + 2 + Math.sin(a) * 3.2 }; face = Math.atan2(V.x - spot.x, V.z + 2 - spot.z); job = 'talk'; }
      v.jobSpot = new THREE.Vector3(spot.x, 0, spot.z); v.jobFace = face; v.job = job; }); }
  for (const n of G.npcs) if (n.def && n.def.race === 'goblin') { if (n.id === 'templeton') { dressPerson(n, 'templeton', 1.05, 'goblin_villager'); continue; } dressPerson(n, n.id === 'grubnose' ? 'goblin_elder' : 'goblin_villager', n.id === 'grubnose' ? 1.3 : 1.35); }
  // (no sailors on the beach: the hero washed up alone)
}

// ---------------- enemies ----------------
const named = (type, name, extra) => Object.assign({}, MOBS[type], { name }, extra || {});
const SIZE = { goblin: [0.72, 1.18], goblin_slinger: [0.66, 0.95], goblin_brute: [1.15, 1.5], troll: [0.92, 1.15], troll_king: [1.0, 1.1] };
function mob(type, lv, x, z, name, model) { const m = new Mob(type, lv, x, z); m.noWander = true; m.def = named(type, name || MOBS[type].name, { aggro: Math.round(MOBS[type].aggro * 0.6) });
  m.maxHp = Math.round(m.maxHp * 1.8); m.hp = m.maxHp; m.dmg *= 1.4; m.xp = Math.round(m.xp * 1.3);
  const sz = SIZE[type]; if (sz) { const k = sz[0] + Math.random() * (sz[1] - sz[0]); m.root.scale.multiplyScalar(k); m.radius *= k; if (m.height) m.height *= k; m.maxHp = Math.round(m.maxHp * (0.75 + k * 0.25)); m.hp = m.maxHp; }
  dressMob(m, model); if (type === 'boar') dressBeast(m, 'boar', 1.6); else if (type === 'crab') dressBeast(m, 'crab', 0.9); // (the Meshy bodies)
  G.mobs.push(m); return m; }
export function giSpawn() {
  if (!GI) return;
  // the training dummy in Snagglefoot: takes hits, never fights back or dies; five hits for the first steps
  { const D = TUT_DUMMY, m = new Mob('bandit', 1, D.x, D.z); m.dummy = true; m.hostile = false; m.def = Object.assign({}, m.def, { aggro: 0, flee: false, gold: null, loot: {}, gearChance: 0, name: 'Training Dummy' }); Object.defineProperty(m, 'name', { value: 'Training Dummy', configurable: true });
    m.maxHp = m.hp = 1e6; m.xp = 0; m.loot = null; m.yaw = Math.atan2(V.x - D.x, V.z - D.z);
    for (const c of m.root.children) c.visible = false; if (live.dummyLook) m.root.add(live.dummyLook);
    const take = m.takeHit.bind(m); m.takeHit = (dmg, src, o) => { const d = take(dmg, src, o); m.hp = m.maxHp; m.dead = false; m.wob = 1; const I = isle(); I.dummyHits = (I.dummyHits || 0) + 1; if (I.dummyHits >= 5 && !I.tut_dummy) { I.tut_dummy = true; G.hooks.toast && G.hooks.toast('Good hits! The dummy has had enough.', '🎯', 'gold'); G.hooks.questsChanged && G.hooks.questsChanged(); } return d; };
    m.update = function (dt) { this.dead = false; this.hp = this.maxHp; for (const k in this.status) if (typeof this.status[k] === 'number' && this.status[k] > 0) this.status[k] = 0; this.wob = Math.max(0, (this.wob || 0) - dt * 2.5); this.pos.set(D.x, heightAt(D.x, D.z), D.z); this.root.position.copy(this.pos); this.root.rotation.set(Math.sin(G.time * 30) * 0.12 * this.wob, this.yaw, 0); };
    G.mobs.push(m); live.dummy = m; }
  const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  for (const [id, t] of Object.entries(TRIBES)) {
    const c = mob('goblin_brute', t.chiefLv, t.x, t.z - 4); c.def = named('goblin_brute', t.chief, { elite: true, aggro: 9 }); c.giChief = id; c.bossy = true; c.maxHp = Math.round(c.maxHp * 2.6); c.hp = c.maxHp;
    const n = id === 'bloodfang' ? 9 : 12;
    const fire = new THREE.Vector3(t.x, heightAt(t.x, t.z), t.z);
    for (let i = 0; i < n; i++) { const a = i / n * 6.28, type = i % 4 === 1 ? 'goblin_slinger' : i % 5 === 3 ? 'goblin_brute' : 'goblin', role = i % 3, r = role === 0 ? 3.2 : R(8, t.r * 0.75);
      const m = mob(type, ri(t.lv[0], t.lv[1]), t.x + Math.cos(a) * r, t.z + Math.sin(a) * r, `${t.name} ${MOBS[type].name.replace('Goblin ', '')}`);
      if (role === 0) m.sitAt = fire; // (round the fire)
      else if (role === 1) { const pts = []; for (let j = 0; j < 8; j++) { const b = a + j / 8 * 6.28 * (i % 2 ? 1 : -1); pts.push(new THREE.Vector3(t.x + Math.cos(b) * (t.r - 4), 0, t.z + Math.sin(b) * (t.r - 4))); } m.patrol = { pts, i: 1 }; m.noWander = false; } } // (walking the stakes)
  }
  // the work camps (the owner: goblins cutting trees, building and hauling, a living world)
  for (const w of WORKS) { const t = TRIBES[w.tribe], lv = ri(t.lv[0], t.lv[1]), V3 = (x, z) => new THREE.Vector3(x, 0, z);
    const worker = (kind, x, z, fx, fz, nm) => { const m = mob('goblin', lv, x, z, `${t.name} ${nm}`, 'goblin_villager'); m.job = { kind, spot: V3(x, z), face: V3(fx, fz) }; return m; };
    if (w.kind === 'lumber') { const T = world.nodes.filter(n => n.type && n.type.startsWith('tree') && Math.hypot(n.x - w.x, n.z - w.z) < 30).slice(0, 3);
      T.forEach((n, i) => { const a = Math.atan2(w.z - n.z, w.x - n.x); worker('chop', n.x + Math.cos(a) * 1.3, n.z + Math.sin(a) * 1.3, n.x, n.z, 'Woodcutter'); });
      if (!T.length) for (let i = 0; i < 2; i++) worker('chop', w.x + 6 + i * 3, w.z - 6, w.x + 9 + i * 3, w.z - 9, 'Woodcutter'); }
    else for (let i = 0; i < 3; i++) { const a = i / 3 * 6.28; worker('hammer', w.x + Math.cos(a) * 3.4, w.z + Math.sin(a) * 3.4, w.x, w.z, w.kind === 'quarry' ? 'Stonebreaker' : 'Builder'); }
    // a hauler carries loads from the work camp to the tribe's village and back
    for (let i = 0; i < 2; i++) { const m = mob('goblin', lv, w.x + 3, w.z + 3 + i * 2, `${t.name} Hauler`, 'goblin_villager'); const pts = []; for (let k = 0; k <= 8; k++) { const f = k / 8; pts.push(V3(w.x + (t.x - w.x) * f + Math.sin(f * 3) * 4, w.z + (t.z - w.z) * f)); } m.job = { kind: 'haul', pts, i: 1 + i * 3, dir: 1, wait: 0, loaded: i === 0 }; } }
  // supply carts pulled along the roads
  for (const [a, b, tr] of [[WORKS[0], TRIBES.bloodfang, 'bloodfang'], [WORKS[2], WORKS[3], 'skull']]) { const t = TRIBES[tr], pts = []; for (let k = 0; k <= 12; k++) { const f = k / 12; pts.push(new THREE.Vector3(a.x + (b.x - a.x) * f, 0, a.z + (b.z - a.z) * f)); }
    const m = mob('goblin', ri(t.lv[0], t.lv[1]), a.x, a.z, `${t.name} Carter`, 'goblin_villager'); m.job = { kind: 'cart', pts, i: 1, dir: 1, wait: 0 }; carts.push({ m, o: null }); propAt('goblin_cart', a.x, heightAt(a.x, a.z), a.z, 0, 2.2).then(o => { carts.find(c => c.m === m).o = o; }); }
  for (const l of LAIRS) { const b = mob('troll_king', l.lv, l.x, l.z, l.name); b.giLair = l.id; b.bossy = true; for (let i = 0; i < l.adds; i++) mob('troll', l.lv - 1, l.x + R(-6, 6), l.z + R(-6, 6)); }
  for (const [Rp, lv] of [[RAMP1, 6], [RAMP2, 8]]) for (let i = 0; i < 4; i++) { const p = rampPoint(Rp, 0), a = Math.atan2(p.z - PEAK.z, p.x - PEAK.x); mob(i === 0 ? 'goblin_brute' : i === 3 ? 'goblin_slinger' : 'goblin', lv, p.x + Math.cos(a) * (6 + i * 2), p.z + Math.sin(a) * (6 + i * 2), 'Gate Guard'); }
  for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28, r = R(10, PEAK.rSum - 12); mob(i % 3 === 2 ? 'goblin_brute' : i % 3 === 1 ? 'goblin_slinger' : 'goblin', ri(9, 10), PEAK.x + Math.cos(a) * r, PEAK.z + Math.sin(a) * r, 'Idol Guard'); }
  for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28 + 0.3, r = R(PEAK.rUp + 15, PEAK.rShelf - 12), x = PEAK.x + Math.cos(a) * r, z = PEAK.z + Math.sin(a) * r; if (LAIRS.some(l => Math.hypot(l.x - x, l.z - z) < 30)) continue; for (let k = 0; k < 3; k++) mob(k === 2 ? 'goblin_slinger' : 'goblin', ri(7, 8), x + R(-5, 5), z + R(-5, 5), 'Idol-mad Goblin'); }
  for (let gx = -460; gx <= 460; gx += 70) for (let gz = -440; gz <= 440; gz += 70) {
    const x = gx + R(-25, 25), z = gz + R(-25, 25); if (heightAt(x, z) < 1.4 || giAvoid(x, z, 6)) continue;
    if (Math.hypot(x - PEAK.x, z - PEAK.z) < PEAK.rLow + 20) continue; if (Math.hypot(x - CAMP_SPOT.x, z - CAMP_SPOT.z) < 80 || Math.hypot(x - V.x, z - V.z) < 85) continue;
    if ([...Object.values(TRIBES), ...WORKS].some(t => Math.hypot(t.x - x, t.z - z) < t.r + 25)) continue;
    if (FANGS.some(F => Math.hypot(F.x - x, F.z - z) < F.r * 0.45)) continue;
    const south = z > 160, roll = Math.random(), first = G.mobs.length;
    if (south) { if (roll < 0.5) for (let i = 0; i < ri(2, 3); i++) mob(i === 2 ? 'goblin_slinger' : 'goblin', ri(1, 3), x + R(-6, 6), z + R(-6, 6), 'Idol-mad Goblin'); else if (roll < 0.85) for (let i = 0; i < 2; i++) mob('boar', ri(1, 2), x + R(-6, 6), z + R(-6, 6)); }
    else { if (roll < 0.6) for (let i = 0; i < ri(3, 4); i++) mob(i === 3 ? 'goblin_brute' : i === 2 ? 'goblin_slinger' : 'goblin', ri(4, 6), x + R(-7, 7), z + R(-7, 7), 'Idol-mad Goblin'); else if (roll < 0.8) for (let i = 0; i < 2; i++) mob('wolf', ri(4, 5), x + R(-6, 6), z + R(-6, 6)); }
  }
  for (let i = 0; i < 12; i++) { const x = -120 + i * 22, z = 455 + Math.sin(i) * 12; if (heightAt(x, z) > 0.2 && heightAt(x, z) < 2) mob('crab', 1, x, z); }
  for (const [x, z] of [[-90, 70], [140, 90], [-250, 120], [260, 160], [40, 110]]) { if (heightAt(x, z) < 2) continue; const m = mob('tiger', ri(4, 6), x, z, 'Jungle Panther'); dressBeast(m, 'panther2', 2.2); m.noWander = false; }
  // goblin packs out in the wilds walk a route together (out to a lookout and back), beasts graze where they are
  for (const m of G.mobs) if (!m.job && !m.patrol && !m.sitAt && !m.giChief && !m.giLair && m.def.variant === 'goblin' && !/Gate Guard|Idol Guard/.test(m.def.name)) {
    if (m.def.name !== 'Idol-mad Goblin') continue; const a = Math.random() * 6.28, d = R(30, 60), h = m.home; const pts = [new THREE.Vector3(h.x, 0, h.z), new THREE.Vector3(h.x + Math.cos(a) * d, 0, h.z + Math.sin(a) * d)];
    if (heightAt(pts[1].x, pts[1].z) < 1.5) continue; m.patrol = { pts, i: 1 }; m.noWander = false; }
  for (const m of G.mobs) if (m.type === 'boar' || m.type === 'crab' || m.type === 'wolf') m.noWander = false; // (animals still roam and graze)
}
const carts = [];
export function tickCarts() { for (const c of carts) { if (!c.o) continue; const m = c.m; c.o.visible = !m.dead; if (m.dead) continue; const fx = Math.sin(m.yaw), fz = Math.cos(m.yaw), x = m.pos.x - fx * 2.4, z = m.pos.z - fz * 2.4; c.o.position.set(x, heightAt(x, z), z); c.o.rotation.y = m.yaw; } }
export function objectives() {}
// --- what grows where (world.js giScatter) ---
export function beachMaskGI(x, z) { const dx = x, dz = z + 15, r = Math.hypot(dx, dz); return Math.max(0, Math.min(1, (r - 420) / 50)) * (heightAt(x, z) < 6 ? 1 : 0); }
export function giTerrain(x, z) {
  const r = Math.hypot(x - PEAK.x, z - PEAK.z), near = (c, rr) => Math.hypot(x - c.x, z - c.z) < rr;
  const town = near(V, V.r + 16) || near(CAMP_SPOT, 40) || Object.values(TRIBES).some(t => near(t, t.r + 6)) || WORKS.some(w => near(w, w.r + 4));
  const forestK = town ? 0 : r < PEAK.rShelf ? 0.35 : z > 175 ? 0.7 : 1.1;
  const cliffFoot = r > PEAK.rLow - 2 && r < PEAK.rLow + 25;
  return { forestK, rockK: cliffFoot ? 6 : 1, cliffFoot, dead: LAIRS.some(l => near(l, 35)) };
}
export function giLandmarks() { return [[-40, 90], [120, 110], [-230, 110], [250, 230], [-160, 380], [80, -10]]; }
export function giCliffFoot() { const a = Math.random() * 6.28, rr = PEAK.rLow + 2 + Math.random() * 14, x = PEAK.x + Math.cos(a) * rr, z = PEAK.z + Math.sin(a) * rr; if (Math.random() < 0.4) { const i = Math.floor(Math.random() * (GORGE.length - 1)), f = Math.random(), [ax, az] = GORGE[i], [bx2, bz] = GORGE[i + 1], s = Math.random() < 0.5 ? 1 : -1; return [ax + (bx2 - ax) * f, az + (bz - az) * f + s * (GORGE_RIM + 3 + Math.random() * 6)]; } return [x, z]; }
// the music for where you stand: the village and the sailors' camp, the south valley, the jungle valleys, enemy camps and lairs, the mountain
export function giMusic(p, fight) {
  if (!M.areaMode) M.areaMode = true; const x = p.pos.x, z = p.pos.z, near = (c, r) => Math.hypot(x - c.x, z - c.z) < r;
  M.setTown((near(V, V.r + 20) || near(CAMP_SPOT, 45)) && fight < 1);
  const r = Math.hypot(x - PEAK.x, z - PEAK.z);
  const area = r < PEAK.rUp && p.pos.y > PEAK.shelfH + 10 ? 'peak' : r < PEAK.rShelf + 4 && p.pos.y > PEAK.shelfH2 - 6 ? 'shelf'
    : [...Object.values(TRIBES), ...LAIRS].some(t => near(t, (t.r || 18) + 25)) ? 'camp' : z > 175 ? 'meadow' : 'jungle';
  M.setZone(area);
}
// where you wake after dying: the nearest safe place you have reached (never an enemy camp)
export function giRespawns() {
  const I = isle(), out = [{ x: CAMP_SPOT.x + 3, z: CAMP_SPOT.z + 6 }, { x: V.x + 4, z: V.z + 8 }];
  if (I.bridge1) out.push({ x: BRIDGE1.x - 6, z: BRIDGE1.zN - 8 });
  if (I.shelf) { const p = rampPoint(RAMP1, 1); out.push({ x: p.x, z: p.z }); }
  if (I.lair_gate) { const p = rampPoint(RAMP2, 0); const a = Math.atan2(p.z - PEAK.z, p.x - PEAK.x); out.push({ x: p.x + Math.cos(a) * 5, z: p.z + Math.sin(a) * 5 }); }
  if (I.summit) out.push({ x: PEAK.x, z: PEAK.z + PEAK.rSum - 10 });
  return out;
} // (the quest tracker shows the island's goals now)
