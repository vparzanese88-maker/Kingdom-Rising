// Goblin Island (Grimtusk Isle): the campaign's first island, laid out so the goblin city can't be reached by running at it.
//  South: the beach landing (your boat at the pier, a shipwrecked sailors' camp) and the Bloodfang tribe in the jungle.
//  The Great Gorge cuts the island in two from sea to sea; its one crossing is a drawbridge, raised. The Bloodfang
//  Warchief carries the winch crank.
//  The Midlands: the Mudfoot tribe in the western swamp, the Skullsplitter tribe in the eastern hills, troll lairs.
//  The Crown Ridge: a ring of mountains round the goblin city. The Gloomtunnel through its east side is shut by a
//  portcullis until both midland chiefs fall; inside the ring, a lever drops the city's Great Gate drawbridge over the
//  moat, a shortcut back south for later trips.
import { BATTLE, YARD, ARENA } from './battlemap.js';
import { distToLine, smooth } from './util.js';

export const GI = !BATTLE && !YARD && !ARENA;
export const CROWN = { x: 20, z: -215, rIn: 118, crest: 160, rOut: 205, top: 16 };
// the two ways through the ridge: a direction out from the city's middle and how far the cut reaches
export const TUNNEL = { dx: 1, dz: 0, a0: 100, a1: 224, gate: 214, half: 6.5 };
export const GATE = { dx: 0, dz: 1, a0: 100, a1: 238, moat0: 203, moat1: 219, half: 7.5 };
// the gorge, from sea to sea (it runs out past the coast so nobody swims round it)
export const GORGE = [[-660, 150], [-470, 100], [-300, 140], [-150, 104], [-40, 112], [40, 116], [150, 100], [300, 142], [460, 98], [660, 136]];
export const GORGE_W = 13, GORGE_RIM = 16.5;
export const BRIDGE1 = { x: 0, zS: 140, zN: 92 }; // the drawbridge over the gorge, south end (the winch) to north end
// tribes, troll lairs and the beach camp (each a flat clearing)
export const TRIBES = {
  bloodfang: { name: 'Bloodfang', x: -200, z: 255, r: 30, col: '#a02a20', lv: [2, 3], chief: 'Bloodfang Warchief', chiefLv: 4 },
  mudfoot: { name: 'Mudfoot', x: -285, z: -40, r: 32, col: '#5a6a2a', lv: [5, 6], chief: 'Mudfoot Bog-Chief', chiefLv: 7 },
  skull: { name: 'Skullsplitter', x: 300, z: -55, r: 32, col: '#d8d0b8', lv: [5, 6], chief: 'Skullsplitter Headtaker', chiefLv: 7 },
};
export const LAIRS = [
  { id: 'gnash', name: 'Old Gnash', x: 120, z: 40, r: 22, lv: 6, adds: 2 },
  { id: 'mossback', name: 'Mossback', x: -130, z: 30, r: 22, lv: 6, adds: 2 },
  { id: 'tunnel', name: 'Grumbak the Gate-Troll', x: 285, z: -200, r: 18, lv: 8, adds: 1 },
];
export const CAMP_SPOT = { x: 18, z: 352, r: 26 }; // the sailors' camp on the beach
export const ROADS_GI = [
  [[0, 362], [10, 300], [-20, 240], [-10, 190], [0, 150]], // beach to the gorge bridge
  [[-20, 240], [-110, 250], [-170, 255]], // the trail to the Bloodfang village
  [[0, 88], [20, 40], [90, 10], [180, -60], [250, -150], [285, -205], [CROWN.x + TUNNEL.a1 + 4, CROWN.z]], // north of the bridge to the Gloomtunnel
  [[20, 40], [-80, 10], [-200, -20], [-255, -38]], // to the Mudfoot swamp
  [[180, -60], [270, -55]], // to the Skullsplitter hills
  [[CROWN.x, CROWN.z + GATE.a1 + 2], [CROWN.x - 10, CROWN.z + GATE.a1 + 60], [20, 40]], // the Great Gate road
];
export const giCamps = () => [CAMP_SPOT, ...Object.values(TRIBES), ...LAIRS].map(c => ({ x: c.x, z: c.z, r: c.r, h: null }));
// where a point lies along one of the ridge cuts: along the cut, and how far off its centre line
export function cutCoords(cut, x, z) { const dx = x - CROWN.x, dz = z - CROWN.z; return { along: dx * cut.dx + dz * cut.dz, lat: Math.abs(dx * cut.dz - dz * cut.dx) }; }
export const cutPoint = (cut, along, lat = 0) => ({ x: CROWN.x + cut.dx * along + cut.dz * lat, z: CROWN.z + cut.dz * along - cut.dx * lat });
// the island's shape on top of the rolling jungle (h): the gorge, the ridge ring, the city plateau and the two cuts
export function giShape(x, z, h, outside) {
  const dr = Math.hypot(x - CROWN.x, z - CROWN.z);
  // the Crown Ridge: a ring of steep mountains, the city plateau flat inside it
  if (dr < CROWN.rOut + 70) {
    const k = Math.exp(-Math.pow((dr - CROWN.crest) / 34, 2)), n = 0.5 + 0.5 * Math.sin(Math.atan2(z - CROWN.z, x - CROWN.x) * 7 + dr * 0.03) * 0.6;
    h += k * (78 + n * 26);
    h = h + (CROWN.top - h) * (1 - smooth(CROWN.rIn - 6, CROWN.rIn + 18, dr));
    for (const cut of [TUNNEL, GATE]) {
      const c = cutCoords(cut, x, z); if (c.along < cut.a0 - 10 || c.along > cut.a1 + 14) continue;
      const t = Math.max(0, Math.min(1, (c.along - cut.a0) / (cut.a1 - cut.a0))), floor = CROWN.top + (outside(CROWN.x + cut.dx * (cut.a1 + 12), CROWN.z + cut.dz * (cut.a1 + 12)) - CROWN.top) * t;
      const w = cut.half + 1.5, k = (1 - smooth(w, w + 7, c.lat)) * (c.along > cut.a1 ? smooth(cut.a1 + 14, cut.a1, c.along) : 1);
      h += (floor - h) * k;
      if (cut.moat0 && c.along > cut.moat0 && c.along < cut.moat1 && c.lat < cut.half + 5) h = Math.min(h, -7); // the moat in front of the Great Gate
    }
  }
  // the Great Gorge, from sea to sea
  const g = distToLine(x, z, GORGE).d;
  if (g < GORGE_W + 60) { h += 13 * (1 - smooth(GORGE_W + 10, GORGE_W + 60, g)); // high banks: the gorge is a real chasm, not a ditch
    if (g < GORGE_W + 12) h = Math.min(h, -9 + (h + 9) * smooth(GORGE_W - 1, GORGE_W + 7, g)); }
  return h;
}
