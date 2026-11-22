// Everything that sets the numbers: classes, guns, turrets, aliens, maps and waves.

export const CLASSES = {
  assault: {
    name: 'Assault', color: 0x3b7bd6, hp: 120, speed: 7.2,
    gun: { name: 'M9 Pulse Rifle', dmg: 17, rate: 10, mag: 32, reload: 1.7, spread: 0.012, kind: 'hit', sound: 'rifle' },
    sentry: 'minigun', defense: 'barricade',
    blurb: 'Pulse rifle. Deploys the Minigun Turret that mows down the swarm, and Barricades that block the alien track.',
  },
  engineer: {
    name: 'Engineer', color: 0xe0b22e, hp: 100, speed: 7.8,
    gun: { name: 'Arc SMG', dmg: 10, rate: 16, mag: 48, reload: 1.4, spread: 0.022, kind: 'hit', sound: 'smg' },
    sentry: 'tesla', defense: 'repair',
    blurb: 'Fast arc SMG. Deploys Tesla Towers whose lightning jumps alien to alien, and Repair Stations that heal marines and fix turrets.',
  },
  heavy: {
    name: 'Heavy', color: 0xc94a3a, hp: 160, speed: 6.4,
    gun: { name: 'RL-4 Rocket Launcher', dmg: 95, rate: 1.4, mag: 5, reload: 2.4, spread: 0, kind: 'rocket', splash: 4.2, sound: 'rocket' },
    sentry: 'missile', defense: 'stasis',
    blurb: 'Rocket launcher. Deploys long-range Missile Turrets and Stasis Fields that slow every alien inside.',
  },
};

// lvl 1-3. Upgrading a turret costs its price times UPG_COST[lvl].
export const TURRETS = {
  minigun: { name: 'Minigun Turret', cost: 100, hp: 260, range: 17, rate: 12, dmg: 6, key: 'sentry', desc: 'Spins up and shreds anything in range.' },
  tesla: { name: 'Tesla Tower', cost: 140, hp: 220, range: 13, rate: 1.1, dmg: 34, chain: 3, key: 'sentry', desc: 'Lightning that jumps between aliens and stuns them.' },
  missile: { name: 'Missile Turret', cost: 180, hp: 240, range: 28, rate: 0.55, dmg: 70, splash: 4, key: 'sentry', desc: 'Long range missiles that blow up groups.' },
  barricade: { name: 'Barricade', cost: 60, hp: 520, onPath: true, key: 'defense', desc: 'A wall across the track. Aliens must chew through it (flyers go over).' },
  repair: { name: 'Repair Station', cost: 120, hp: 200, range: 9, heal: 9, key: 'defense', desc: 'Heals marines and repairs turrets, walls and the hub nearby.' },
  stasis: { name: 'Stasis Field', cost: 90, hp: 200, range: 7.5, slow: 0.45, anyPlace: true, key: 'defense', desc: 'Aliens inside move at half speed.' },
};
export const UPG_COST = [0, 0.8, 1.3];      // cost to go from lvl 1->2, 2->3
export const MAX_TURRETS = 8;               // per marine, sentries and defenses together

// Marine upgrades bought in the armory (B). Five levels each.
export const UPGRADES = [
  { id: 'dmg', name: 'Weapon damage', text: '+15% damage per level' },
  { id: 'rate', name: 'Fire rate', text: '+10% fire rate per level' },
  { id: 'mag', name: 'Magazine', text: '+20% magazine, faster reload' },
  { id: 'spd', name: 'Move speed', text: '+8% speed per level' },
  { id: 'hp', name: 'Max health', text: '+25 health per level' },
  { id: 'arm', name: 'Armor', text: 'Take 8% less damage per level' },
];
export const UPG_PRICES = [80, 150, 240, 360, 520];

export const ALIENS = {
  crawler: { name: 'Crawler', hp: 42, speed: 6.2, hub: 3, bounty: 7, r: 0.7, h: 0.55, dmg: 9, melee: 1 },
  spitter: { name: 'Spitter', hp: 70, speed: 4, hub: 4, bounty: 12, r: 0.8, h: 1.2, dmg: 9, ranged: 15 },
  brute: { name: 'Brute', hp: 300, speed: 2.6, hub: 10, bounty: 30, r: 1.3, h: 1.4, dmg: 22, melee: 1, armor: 0.25 },
  flyer: { name: 'Stinger', hp: 38, speed: 7, hub: 3, bounty: 10, r: 0.8, h: 4.2, dmg: 7, fly: 1 },
  ravager: { name: 'Ravager', hp: 2600, speed: 2.1, hub: 30, bounty: 220, r: 2.2, h: 2.2, dmg: 35, melee: 1, armor: 0.3, boss: 1 },
  queen: { name: 'Hive Queen', hp: 11000, speed: 1.5, hub: 100, bounty: 1000, r: 3.4, h: 3.3, dmg: 50, melee: 1, armor: 0.35, boss: 1, ranged: 22 },
};

export const WAVES = 20;
// A wave is a list of [type, count, gap seconds].
export function waveList(w) {
  const L = [], n = (a, b) => Math.round(a + b * (w - 1));
  if (w === 20 || (w > 20 && w % 10 === 0)) { L.push(['crawler', n(10, 1), 0.4], ['queen', 1, 4], ['brute', n(2, 0.3), 3], ['flyer', n(4, 0.5), 0.6], ['crawler', n(10, 1), 0.3]); return L; }
  if (w === 10 || w === 15 || (w > 20 && w % 5 === 0)) { L.push(['crawler', n(6, 0.8), 0.5], ['ravager', w >= 15 ? 2 : 1, 6], ['spitter', n(3, 0.4), 1], ['crawler', n(6, 0.8), 0.4]); return L; }
  L.push(['crawler', n(6, 1.1), 0.75]);
  if (w >= 3) L.push(['spitter', n(1, 0.45), 1.6]);
  if (w >= 4) L.push(['crawler', n(3, 0.7), 0.5]);
  if (w >= 5) L.push(['brute', n(0, 0.28), 3.5]);
  if (w >= 6) L.push(['flyer', n(0, 0.5), 0.9]);
  if (w >= 8) L.push(['crawler', n(2, 0.9), 0.35]);
  return L;
}
// health multiplier for a wave and number of marines
export const hpScale = (w, players) => (1 + 0.13 * (w - 1) + (w > 20 ? 0.12 * (w - 20) ** 1.3 : 0)) * (1 + 0.4 * (players - 1));

export const MAPS = {
  mars: {
    name: 'Red Sands Outpost', sub: 'Mars, mining colony 7', ground: 0xa4502e, ground2: 0x7d3a22, path: 0x5a3a2c, sky: 0xd99a6a, fog: 0xc88458, fogD: [40, 150], sun: 0xffe0c0, amb: 0x804030,
    prop: 'rock', pts: [[-58, -42], [-24, -42], [-24, -12], [-50, -12], [-50, 18], [-8, 18], [-8, -30], [30, -30], [30, 8], [52, 8], [52, 40], [10, 40]],
  },
  ice: {
    name: 'Kryos Station', sub: 'Ice moon of Kryos IV', ground: 0xd6e4ee, ground2: 0xa8c0d4, path: 0x6e8aa4, sky: 0x9ab8d8, fog: 0xb8cde0, fogD: [35, 140], sun: 0xe8f2ff, amb: 0x506888,
    prop: 'ice', pts: [[58, -46], [58, -10], [20, -10], [20, -44], [-20, -44], [-20, -8], [-52, -8], [-52, 30], [-14, 30], [-14, 6], [22, 6], [22, 44], [-36, 50]],
  },
  jungle: {
    name: 'Verdant Colony', sub: 'Jungle world Thessa', ground: 0x3f7a32, ground2: 0x2d5a24, path: 0x6a5232, sky: 0x8ac0a0, fog: 0x6a9a78, fogD: [30, 120], sun: 0xfff0c8, amb: 0x305030,
    prop: 'tree', pts: [[-56, 46], [-56, 10], [-26, 10], [-26, 44], [8, 44], [8, -4], [-40, -4], [-40, -40], [0, -40], [0, -20], [40, -20], [40, 30], [56, 30], [56, -48], [24, -48]],
  },
};
export const PATH_W = 6;
export const BOUNDS = 66;
