// The island's story, its places of interest, and what ordinary villagers have to say about them.
// Places show on the map once you have explored them, or once someone has told you where they are.
import { G } from './state.js';
import { CAMPS, PORT, VILLAGE, MOUNT } from './terrain.js';
import { GOBLIN_CAMPS } from './data.js';

export const LORE = {
  title: 'The Island of Kelda',
  text: [
    'Kelda was a quiet island once: fishing villages on the south shore, the free port of Saltmere in the north, and hunters\' lodges on the green slopes of the mountain that gives the island its name.',
    'Twenty years ago a goblin warband came ashore in the night, led by a brute called Gorgrak. Nobody took them seriously. Goblins squabble, goblins run. These ones did not. Gorgrak took the old mountain fort and named himself the Goblin King, and every year his camps spread further down the slopes.',
    'Now the goblins own the mountain and the roads around it. The wolves, bears and tigers they drove out of the high forests prowl the lowlands, hungrier than ever. Seabreak Village barely holds the south shore. Saltmere still trades, behind its walls. And between them lies a long, dangerous road.',
  ],
};

// every place of interest on the island
export function pois() {
  const out = [
    { id: 'village', name: 'Seabreak Village', x: VILLAGE.x, z: VILLAGE.z, icon: '⌂', col: '#fff', town: true },
    { id: 'saltmere', name: 'Saltmere', x: PORT.x, z: PORT.z, icon: '⌂', col: '#fff', town: true, big: true },
    { id: 'outpost', name: 'Ranger Outpost', x: CAMPS[0].x, z: CAMPS[0].z, icon: '⌂', col: '#d8f0c0' },
    { id: 'stonewatch', name: 'Stonewatch', x: CAMPS[1].x, z: CAMPS[1].z, icon: '⌂', col: '#c8dcff' },
    { id: 'warcamp', name: 'Goblin War Camp', x: CAMPS[2].x, z: CAMPS[2].z, icon: '⚔', col: '#ff8a7a' },
    { id: 'raiders', name: 'Goblin Raider Camp', x: CAMPS[3].x, z: CAMPS[3].z, icon: '⚔', col: '#ff8a7a' },
    { id: 'hold', name: "Gorgrak's Hold", x: CAMPS[4].x, z: CAMPS[4].z, icon: '☠', col: '#ff6060' },
  ];
  GOBLIN_CAMPS.forEach((g, i) => out.push({ id: 'gc' + i, name: `Goblin Camp (levels ${g[2]}-${g[3]})`, x: g[0], z: g[1], icon: '⛺', col: '#9cdc5a', camp: true }));
  return out;
}
export function known(h, id) { return (h.known || []).includes(id); }
export function learn(h, id) { h.known = h.known || []; if (h.known.includes(id)) return false; h.known.push(id); return true; }

const dirName = (dx, dz) => { const a = Math.atan2(-dz, dx) * 180 / Math.PI; const D = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east']; return D[Math.round(((a % 360) + 360) % 360 / 45) % 8]; };
const NAMES = ['Tam', 'Wenna', 'Old Hobb', 'Marrit', 'Jory', 'Senna', 'Pike', 'Ellis', 'Brannoc', 'Ysolde', 'Cade', 'Nell', 'Gareth', 'Ottilie', 'Ferris', 'Rook'];
export const villagerName = (i) => NAMES[i % NAMES.length];
const SMALL = [
  'Fish were biting this morning. Goblins weren\'t, for once.',
  'They say Gorgrak eats a bear a day. I say he\'s never seen a bear.',
  'Keep to the roads after dark. The tigers have learned to wait by them.',
  'My grandmother remembers when you could walk to Saltmere in a day without a sword.',
  'Twenty years those goblins have been on the mountain. Twenty years!',
  'If you\'re after copper, the hills north of the village are full of it.',
  'The bears on Kelda were gentle once. The goblins hunt their cubs. Now they charge anything.',
  'Saltmere has walls of stone and a harbour full of ships. We have a well and a pier.',
];
// what a villager says: sometimes small talk, often a tip about a place you have not found yet (and it goes on your map)
export function chatter(h, v) {
  const P = G.player, all = pois().filter(p => !known(h, p.id));
  if (all.length && Math.random() < 0.7) {
    all.sort((a, b) => Math.hypot(a.x - P.pos.x, a.z - P.pos.z) - Math.hypot(b.x - P.pos.x, b.z - P.pos.z));
    const p = all[Math.floor(Math.random() * Math.min(3, all.length))], dir = dirName(p.x - P.pos.x, p.z - P.pos.z), far = Math.hypot(p.x - P.pos.x, p.z - P.pos.z) > 300 ? 'a long way' : 'not far';
    learn(h, p.id);
    const lines = p.camp ? [`Goblins have a camp ${far} ${dir} of here. Smoke from their fire every night.`, `My cousin saw goblins camped ${far} to the ${dir}. Stay clear unless you can fight.`]
      : p.id === 'hold' ? ['Gorgrak sits in his Hold high on the north face of Kelda. Nobody who went up there came back.']
      : p.id === 'saltmere' ? [`Saltmere is ${far} to the ${dir}, on the north shore. If anyone can mend a ship, it's the shipwrights there.`]
      : p.id === 'warcamp' ? [`The goblins gather for their raids at a war camp ${dir} of here, on Kelda's eastern slopes. Powder kegs everywhere, I hear.`]
      : [`There's ${p.name} ${far} to the ${dir}. Worth a look.`];
    return { text: lines[Math.floor(Math.random() * lines.length)], found: p };
  }
  return { text: SMALL[Math.floor(Math.random() * SMALL.length)] };
}
