// Goblin Island (Grimtusk Isle): the campaign's first island. The goal is up: the goblin city sits on the summit of
// Grimtusk Peak, a giant mountain in the north, and the way up winds round cliffs, valleys and ledges.
//  The South Valley: the beach landing (the sailors' camp, the wrecked ship), Snagglefoot (a small friendly goblin
//  village) and the Bloodfang tribe. The Great Gorge cuts the island in two from sea to sea; its one crossing is a
//  raised drawbridge, and the Bloodfang Warchief carries the winch crank.
//  The Midlands: valleys between the West Fang, the East Fang and the Peak. The Mudfoot (west) and Skullsplitter
//  (east) tribes each hold a war totem; both toppled, the goblin gatehouse at the foot of the Switchback Road opens.
//  The High Shelf: a ledge round the mountain halfway up (troll lairs). Grumbak the Gate-Troll keeps the key to the
//  Skull Stair, a ledge path carved up the last cliff to the summit.
// Steep rock can't be walked up (player.js), and a long fall kills, so cliffs and drops do the blocking.
import { BATTLE, YARD, ARENA } from './battlemap.js';
import { distToLine, smooth } from './util.js';

export const GI = !BATTLE && !YARD && !ARENA;
export const PEAK = { x: 30, z: -210, rSum: 72, sumH: 150, rUp: 92, shelfH: 64, rShelf: 168, shelfH2: 52, rLow: 183, lowH: 16 };
export const FANGS = [{ x: -320, z: 60, r: 150, h: 125 }, { x: 330, z: 80, r: 150, h: 110 }];
// the gorge, from sea to sea
export const GORGE = [[-660, 190], [-470, 152], [-300, 186], [-150, 150], [-40, 160], [40, 162], [150, 148], [300, 186], [460, 150], [660, 182]];
export const GORGE_W = 13, GORGE_RIM = 16.5;
export const BRIDGE1 = { x: 0, zS: 186, zN: 136 }; // the drawbridge over the gorge, south end (the winch) to north end
// the two ledge paths up the mountain: angle round the peak, distance from it and height, start to end
export const RAMP1 = { a0: 1.3, a1: 0.42, r0: PEAK.rLow + 8, r1: PEAK.rShelf - 10, h0: PEAK.lowH, h1: PEAK.shelfH2 + 2, half: 4.6, name: 'the Switchback Road' };
export const RAMP2 = { a0: -1.25, a1: 1.05, r0: PEAK.rUp + 10, r1: PEAK.rSum - 6, h0: PEAK.shelfH - 1, h1: PEAK.sumH, half: 3.8, name: 'the Skull Stair' };
export const rampPoint = (R, t) => { const a = R.a0 + (R.a1 - R.a0) * t, r = R.r0 + (R.r1 - R.r0) * t; return { x: PEAK.x + Math.cos(a) * r, z: PEAK.z + Math.sin(a) * r, h: R.h0 + (R.h1 - R.h0) * t, a }; };
// tribes, the friendly village, troll lairs and the beach camp (each a flat clearing)
export const TRIBES = {
  bloodfang: { name: 'Bloodfang', x: -270, z: 300, r: 30, col: '#a02a20', lv: [2, 3], chief: 'Bloodfang Warchief', chiefLv: 4 },
  mudfoot: { name: 'Mudfoot', x: -170, z: 30, r: 32, col: '#5a6a2a', lv: [5, 6], chief: 'Mudfoot Bog-Chief', chiefLv: 7 },
  skull: { name: 'Skullsplitter', x: 200, z: 25, r: 32, col: '#d8d0b8', lv: [5, 6], chief: 'Skullsplitter Headtaker', chiefLv: 7 },
};
export const VILLAGE_GI = { x: -95, z: 318, r: 36, name: 'Snagglefoot' }; // the friendly goblins (not possessed)
const shelfAt = (a, r) => ({ x: PEAK.x + Math.cos(a) * r, z: PEAK.z + Math.sin(a) * r });
export const LAIRS = [
  { id: 'gnash', name: 'Old Gnash', ...shelfAt(2.55, 132), r: 18, lv: 7, adds: 2 },
  { id: 'mossback', name: 'Mossback', ...shelfAt(-0.25, 132), r: 18, lv: 7, adds: 2 },
  { id: 'gate', name: 'Grumbak the Gate-Troll', ...shelfAt(-1.25, 120), r: 16, lv: 8, adds: 1 },
];
const gh = rampPoint(RAMP1, 0);
export const GATEHOUSE = { x: gh.x + Math.cos(RAMP1.a0) * 10, z: gh.z + Math.sin(RAMP1.a0) * 10, yaw: 0 };
// work camps the living world runs between (goblins chop, build and haul)
export const WORKS = [
  { id: 'lumber_s', kind: 'lumber', x: -200, z: 225, r: 18, tribe: 'bloodfang' },
  { id: 'lumber_w', kind: 'lumber', x: -60, z: -10, r: 18, tribe: 'mudfoot' },
  { id: 'quarry_e', kind: 'quarry', x: 110, z: 60, r: 18, tribe: 'skull' },
  { id: 'build_g', kind: 'build', x: GATEHOUSE.x - 30, z: GATEHOUSE.z + 26, r: 16, tribe: 'skull' },
];
export const CAMP_SPOT = { x: 18, z: 352, r: 26 }; // the sailors' camp on the beach
export const WRECK = { x: 70, z: 395, yaw: 0.6 }; // Templeton's wrecked ship (it never made the dock)
export const BOATYARD = { x: 40, z: 399, yaw: 1.45 }; // where Templeton builds the new boat from the wreck and your rowboat
export const ROADS_GI = [
  [[0, 362], [-40, 340], [VILLAGE_GI.x, VILLAGE_GI.z]],                                     // beach to Snagglefoot
  [[VILLAGE_GI.x, VILLAGE_GI.z], [-60, 280], [-20, 240], [0, 200], [BRIDGE1.x, BRIDGE1.zS + 2]], // Snagglefoot to the gorge bridge
  [[VILLAGE_GI.x, VILLAGE_GI.z], [-160, 300], [TRIBES.bloodfang.x + 30, TRIBES.bloodfang.z]], // to the Bloodfang village
  [[-160, 300], [-200, 225]],                                                                // the lumber camp
  [[BRIDGE1.x, BRIDGE1.zN - 2], [10, 100], [60, 60], [GATEHOUSE.x, GATEHOUSE.z + 6]],        // north of the bridge to the gatehouse
  [[10, 100], [-60, 60], [TRIBES.mudfoot.x + 30, TRIBES.mudfoot.z]], [[-60, 60], [-60, -10]], // to the Mudfoot swamp
  [[60, 60], [110, 60], [TRIBES.skull.x - 30, TRIBES.skull.z]],                              // to the Skullsplitter hills
];
export const giCamps = () => [CAMP_SPOT, VILLAGE_GI, ...Object.values(TRIBES), ...WORKS].map(c => ({ x: c.x, z: c.z, r: c.r, h: null }));
// climbing spots: vine-covered rock (a short way up, facing yaw = into the wall)
export const CLIMBS = [];
// how far north of the gorge a point is (> 0: north)
export function gorgeZ(x) { for (let i = 0; i < GORGE.length - 1; i++) { const [ax, az] = GORGE[i], [bx, bz] = GORGE[i + 1]; if (x >= ax && x <= bx) return az + (bz - az) * (x - ax) / (bx - ax); } return 160; }
// nearest point on a ledge path: its t, the path's height there and how far off its middle
export function rampNear(R, x, z) {
  let best = 1e9, bt = 0;
  for (let i = 0; i <= 48; i++) { const p = rampPoint(R, i / 48), d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < best) { best = d; bt = i / 48; } }
  for (let k = 0; k < 2; k++) for (const dt of [-1 / 96, 1 / 96]) { const t = Math.max(0, Math.min(1, bt + dt / (k + 1))), p = rampPoint(R, t), d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < best) { best = d; bt = t; } }
  return { t: bt, h: rampPoint(R, bt).h, d: Math.sqrt(best) };
}
const peakProfile = (r) => {
  const P = PEAK;
  if (r < P.rSum) return P.sumH;
  if (r < P.rUp) { const u = (r - P.rSum) / (P.rUp - P.rSum); return P.shelfH + (P.sumH - P.shelfH) * (1 - u); } // the upper cliff
  if (r < P.rShelf) return P.shelfH + (P.shelfH2 - P.shelfH) * (r - P.rUp) / (P.rShelf - P.rUp);           // the High Shelf
  if (r < P.rLow) { const u = (r - P.rShelf) / (P.rLow - P.rShelf); return P.lowH + (P.shelfH2 - P.lowH) * (1 - u); } // the lower cliff: evenly steep, too steep to walk
  return null;
};
// the island's shape on top of the rolling jungle (h)
export function giShape(x, z, h) {
  // the two Fangs: big rocky mountains that split the lowlands into valleys (steep near the top)
  for (const F of FANGS) { const d = Math.hypot(x - F.x, z - F.z); if (d < F.r) { const k = 1 - d / F.r; h += F.h * Math.pow(k, 1.7) + Math.sin(x * 0.05 + z * 0.04) * 6 * k; } }
  // Grimtusk Peak
  const dx = x - PEAK.x, dz = z - PEAK.z, r = Math.hypot(dx, dz);
  if (r < PEAK.rLow + 60) {
    const pr = peakProfile(r), rough = Math.sin(Math.atan2(dz, dx) * 9 + r * 0.05) * 2.2 + Math.sin(Math.atan2(dz, dx) * 23) * 1.2;
    if (pr != null) h = pr + (r > PEAK.rSum && r < PEAK.rUp || r > PEAK.rShelf ? rough : rough * 0.3);
    else h = Math.max(h, PEAK.lowH * (1 - smooth(PEAK.rLow, PEAK.rLow + 60, r)) + h * smooth(PEAK.rLow, PEAK.rLow + 60, r));
    // the ledge paths, carved into the cliffs
    for (const R of [RAMP1, RAMP2]) { const n = rampNear(R, x, z); if (n.d < R.half + 5) { const k = 1 - smooth(R.half, R.half + 4, n.d); h = h + (n.h - h) * k; } }
  }
  // the Great Gorge, from sea to sea, with high banks
  const g = distToLine(x, z, GORGE).d;
  if (g < GORGE_W + 60) { h += 14 * (1 - smooth(GORGE_W + 10, GORGE_W + 60, g));
    if (g < GORGE_W + 12) h = Math.min(h, -9 + (h + 9) * smooth(GORGE_W - 1, GORGE_W + 6, g)); }
  return h;
}
// north of the gorge the coast is sea cliffs (no landing there from the water)
export const northCoast = (x, z) => z < gorgeZ(x) - 20;
