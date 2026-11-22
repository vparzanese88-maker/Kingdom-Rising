// Everything that sets the numbers: classes, guns, turrets, aliens, maps and waves.

export const CLASSES = {
  assault: {
    name: 'Assault', color: 0x3b7bd6, hp: 120, speed: 7.2,
    gun: { name: 'M9 Pulse Rifle', dmg: 12, rate: 9, mag: 30, reload: 1.8, spread: 0.014, kind: 'hit', sound: 'rifle', recoil: 0.016, near: 18, far: 55, max: 75 },
    sentry: 'minigun', defense: 'barricade',
    blurb: 'Pulse rifle. Deploys the Minigun Turret that mows down the swarm, and Barricades that block the alien track.',
  },
  engineer: {
    name: 'Engineer', color: 0xe0b22e, hp: 100, speed: 7.8,
    gun: { name: 'Arc SMG', dmg: 7, rate: 14, mag: 45, reload: 1.5, spread: 0.026, kind: 'hit', sound: 'smg', recoil: 0.009, near: 12, far: 40, max: 60 },
    sentry: 'tesla', defense: 'repair',
    blurb: 'Fast arc SMG. Deploys Tesla Towers whose lightning jumps alien to alien, and Repair Stations that heal marines and fix turrets.',
  },
  heavy: {
    name: 'Heavy', color: 0xc94a3a, hp: 160, speed: 6.4,
    gun: { name: 'RL-4 Rocket Launcher', dmg: 80, rate: 1.1, mag: 4, reload: 2.6, spread: 0, kind: 'rocket', splash: 4.2, sound: 'rocket', recoil: 0.07, life: 1.4 },
    sentry: 'missile', defense: 'stasis',
    blurb: 'Rocket launcher. Deploys long-range Missile Turrets and Stasis Fields that slow every alien inside.',
  },
  gunner: {
    name: 'Gunner', color: 0x6a8a3a, hp: 190, speed: 6.0,
    gun: { name: 'M-56 Hand Minigun', dmg: 7, rate: 18, mag: 120, reload: 3.4, spread: 0.03, kind: 'hit', sound: 'mini', recoil: 0.0035, near: 14, far: 45, max: 65, spin: 0.5 },
    sentry: 'flamer', defense: 'mines',
    blurb: 'Hand-held minigun: spins up, then shreds. Tough but slow, slower still while firing. Deploys Flame Turrets and Mine Fields.',
  },
  sniper: {
    name: 'Sniper', color: 0x4aa8a0, hp: 90, speed: 7.4,
    gun: { name: 'XR-9 Rail Rifle', dmg: 150, rate: 0.85, mag: 5, reload: 2.5, spread: 0.035, scoped: 0.0006, kind: 'hit', sound: 'sniper', recoil: 0.09, near: 300, far: 300, max: 220, pierce: 3 },
    sentry: 'railgun', defense: 'beacon',
    blurb: 'Rail rifle: right click to scope. Full damage at any range and pierces 3 aliens. Deploys Railgun Towers and Sensor Beacons.',
  },
};

// lvl 1-3. Upgrading a turret costs its price times UPG_COST[lvl].
export const TURRETS = {
  minigun: { name: 'Minigun Turret', cost: 100, hp: 260, range: 17, rate: 12, dmg: 7.5, key: 'sentry', desc: 'Spins up and shreds anything in range.' },
  tesla: { name: 'Tesla Tower', cost: 140, hp: 220, range: 13, rate: 1.1, dmg: 42, chain: 3, key: 'sentry', desc: 'Lightning that jumps between aliens and stuns them.' },
  missile: { name: 'Missile Turret', cost: 180, hp: 240, range: 28, rate: 0.55, dmg: 90, splash: 4, key: 'sentry', desc: 'Long range missiles that blow up groups.' },
  barricade: { name: 'Barricade', cost: 60, hp: 600, onPath: true, key: 'defense', desc: 'An energy wall across the track. Every alien, flyers too, must stop and tear it down.' },
  repair: { name: 'Repair Station', cost: 120, hp: 200, range: 9, heal: 9, key: 'defense', desc: 'Heals marines and repairs turrets, walls and the hub nearby.' },
  flamer: { name: 'Flame Turret', cost: 120, hp: 300, range: 9, rate: 10, dmg: 4.5, cone: 0.6, key: 'sentry', desc: 'Sprays fire over every alien in a cone. Ignores armor.' },
  railgun: { name: 'Railgun Tower', cost: 200, hp: 220, range: 42, rate: 0.35, dmg: 230, key: 'sentry', desc: 'A long-range beam that pierces every alien in its line.' },
  mines: { name: 'Mine Field', cost: 70, hp: 99999, range: 2.6, dmg: 260, splash: 4.5, charges: 3, onPath: true, mine: true, key: 'defense', desc: 'Three proximity charges on the track. Walkers that step on them blow up.' },
  beacon: { name: 'Sensor Beacon', cost: 80, hp: 160, range: 12, mark: 1.25, anyPlace: true, key: 'defense', desc: 'Aliens nearby take 25% more damage, and aliens in tunnels show up for turrets.' },
  stasis: { name: 'Stasis Field', cost: 90, hp: 200, range: 7.5, slow: 0.45, anyPlace: true, key: 'defense', desc: 'Aliens inside move at half speed.' },
};
export const UPG_COST = [0, 0.8, 1.3];      // cost to go from lvl 1->2, 2->3
export const MAX_TURRETS = 8;               // per marine, sentries and defenses together

// Marine upgrades bought in the armory (B). Five levels each.
export const UPGRADES = [
  { id: 'dmg', name: 'Weapon damage', text: '+10% damage per level' },
  { id: 'rate', name: 'Fire rate', text: '+8% fire rate per level' },
  { id: 'mag', name: 'Magazine', text: '+20% magazine, faster reload' },
  { id: 'spd', name: 'Move speed', text: '+8% speed per level' },
  { id: 'hp', name: 'Max health', text: '+25 health per level' },
  { id: 'arm', name: 'Armor', text: 'Take 8% less damage per level' },
];
export const UPG_PRICES = [80, 150, 240, 360, 520];

export const ALIENS = {
  crawler: { name: 'Crawler', hp: 65, speed: 6.4, hub: 3, bounty: 6, r: 0.7, h: 0.55, dmg: 11, melee: 1, hunt: { p: 13, leash: 22, time: 7, cd: 3 } },
  spitter: { name: 'Spitter', hp: 95, speed: 4, hub: 4, bounty: 11, r: 0.8, h: 1.2, dmg: 11, ranged: 18 },
  brute: { name: 'Brute', hp: 400, speed: 2.7, hub: 10, bounty: 28, r: 1.3, h: 1.4, dmg: 26, melee: 1, armor: 0.35, hunt: { t: 12, p: 6, leash: 18, time: 12, cd: 4 } },
  flyer: { name: 'Stinger', hp: 55, speed: 7, hub: 3, bounty: 9, r: 0.8, h: 4.2, dmg: 9, fly: 1, melee: 1, hunt: { p: 15, t: 9, leash: 26, time: 6, cd: 4 } },
  ravager: { name: 'Ravager', hp: 3400, speed: 2.1, hub: 30, bounty: 220, r: 2.2, h: 2.2, dmg: 40, melee: 1, armor: 0.35, boss: 1, hunt: { t: 14, p: 9, leash: 20, time: 10, cd: 5 } },
  queen: { name: 'Hive Queen', hp: 15000, speed: 1.5, hub: 100, bounty: 1000, r: 3.4, h: 3.3, dmg: 55, melee: 1, armor: 0.35, boss: 1, ranged: 24 },
  nest: { name: 'Alien Nest', hp: 600, speed: 0, hub: 0, bounty: 80, r: 2.0, h: 1.0, dmg: 0, nest: 1, static: 1 },
  guardian: { name: 'Hive Guardian', hp: 2600, speed: 0, hub: 0, bounty: 150, r: 1.7, h: 3.2, dmg: 13, static: 1, armor: 0.2, guard: 26 },
  hivecore: { name: 'The Hive', hp: 12000, speed: 0, hub: 0, bounty: 1500, r: 5.5, h: 2.4, dmg: 0, static: 1 },
};

export const WAVES = 20;
// A wave is a list of [type, count, gap seconds].
export const MIX = { mars: { brute: 1.6, brute0: 3 }, ice: { flyer: 1.7, flyer0: 3 }, jungle: { crawler: 1.3, spitter: 1.5 } };
export function waveList(w, map) {
  const X = MIX[map] || {}, L0 = waveBase(w, X), L = [];
  for (const [t, c, g] of L0) L.push([t, Math.round(c * (X[t] || 1)), g]);
  if (X.brute0 && w >= X.brute0 && w < 5 && w !== 10) L.push(['brute', 1, 3]);
  if (X.flyer0 && w >= X.flyer0 && w < 6 && w !== 10) L.push(['flyer', 2 + w - X.flyer0, 0.8]);
  return L;
}
function waveBase(w) {
  const L = [], n = (a, b) => Math.round(a + b * (w - 1));
  if (w === 20 || (w > 20 && w % 10 === 0)) { L.push(['crawler', n(10, 1), 0.4], ['queen', 1, 4], ['brute', n(2, 0.3), 3], ['flyer', n(4, 0.5), 0.6], ['crawler', n(10, 1), 0.3]); return L; }
  if (w === 10 || w === 15 || (w > 20 && w % 5 === 0)) { L.push(['crawler', n(6, 0.8), 0.5], ['ravager', w >= 15 ? 2 : 1, 6], ['spitter', n(3, 0.4), 1], ['crawler', n(6, 0.8), 0.4]); return L; }
  L.push(['crawler', n(9, 1.4), 0.6]);
  if (w >= 2) L.push(['spitter', n(1, 0.5), 1.4]);
  if (w >= 3) L.push(['crawler', n(4, 0.9), 0.4]);
  if (w >= 5) L.push(['brute', n(0, 0.28), 3.5]);
  if (w >= 6) L.push(['flyer', n(0, 0.5), 0.9]);
  if (w >= 8) L.push(['crawler', n(2, 0.9), 0.35]);
  return L;
}
// health multiplier for a wave and number of marines
// Squad scaling: every extra marine adds 50% more aliens per wave, each with 30% more health (bosses, nests,
// guardians and the hive get 60% more health instead), so 2 marines face about 2x, 3 face 3.2x, 4 face 4.75x.
export const squad = n => Math.max(1, n);
export const countScale = n => 1 + 0.5 * (squad(n) - 1);
export const hpScale = (w, players) => (1 + 0.24 * (w - 1) + (w > 20 ? 0.12 * (w - 20) ** 1.3 : 0)) * (1 + 0.3 * (squad(players) - 1));
export const bossScale = n => 1 + 0.6 * (squad(n) - 1);

export const MAPS = {
  mars: {
    name: 'Red Sands Outpost', sub: 'Mars, mining colony 7 · meteor showers', ground: 0xa4502e, ground2: 0x7d3a22, path: 0x5a3a2c, sky: 0xd99a6a, fog: 0xc88458, fogD: [40, 150], sun: 0xffe0c0, amb: 0x804030,
    prop: 'rock', extra: ['dome', 'derrick'], hazard: 'meteor', weather: 'dust', liquid: 0xff5a10, rock: 0x5a2a1a,
    hs: [2, 4, 6, 3, 1, 5, 8, 4, 2, 6, 3, 1], chasms: [{ pts: [[-37, -70], [-37, 30]], w: 9 }], ridges: [{ pts: [[-20, -4], [44, -4]], w: 15, h: 10 }],
    pts: [[-58, -42], [-24, -42], [-24, -12], [-50, -12], [-50, 18], [-8, 18], [-8, -30], [30, -30], [30, 8], [52, 8], [52, 40], [10, 40]],
  },
  ice: {
    name: 'Kryos Station', sub: 'Ice moon of Kryos IV · blizzards', ground: 0xd6e4ee, ground2: 0xa8c0d4, path: 0x6e8aa4, sky: 0x9ab8d8, fog: 0xb8cde0, fogD: [35, 140], sun: 0xe8f2ff, amb: 0x506888,
    prop: 'ice', extra: ['dish', 'spire'], hazard: 'blizzard', weather: 'snow', liquid: 0x3080c0, rock: 0x6a7c90,
    hs: [3, 5, 2, 4, 1, 3, 6, 2, 4, 7, 3, 5, 2], chasms: [{ pts: [[-36, -26], [70, -26]], w: 8 }], ridges: [{ pts: [[2, -2], [2, 70]], w: 15, h: 11 }],
    pts: [[58, -46], [58, -10], [20, -10], [20, -44], [-20, -44], [-20, -8], [-52, -8], [-52, 30], [-14, 30], [-14, 6], [22, 6], [22, 44], [-36, 50]],
  },
  jungle: {
    name: 'Verdant Colony', sub: 'Jungle world Thessa, at night · alien nests', ground: 0x2f5a28, ground2: 0x23441e, path: 0x4a3a28, sky: 0x1c2a34, fog: 0x1e2e30, fogD: [18, 85], sun: 0x8090c0, sunI: 0.7, hemiI: 0.55, amb: 0x102018,
    prop: 'tree', extra: ['shroom', 'tree'], hazard: 'nests', weather: 'rain', dense: 1, liquid: 0x2a7a8a, rock: 0x4a4a3a,
    hs: [4, 2, 5, 3, 6, 2, 4, 1, 3, 6, 2, 5, 3, 7, 2], chasms: [{ pts: [[-10, -70], [-10, 70]], w: 9 }], ridges: [{ pts: [[26, 8], [70, 8]], w: 15, h: 11 }],
    pts: [[-56, 46], [-56, 10], [-26, 10], [-26, 44], [8, 44], [8, -4], [-40, -4], [-40, -40], [0, -40], [0, -20], [40, -20], [40, 30], [56, 30], [56, -48], [24, -48]],
  },
};
export const PATH_W = 6;
export const BOUNDS = 66;

// Marines the hub sends down the track toward the hive. Trooper is free; the others are unlocked in the armory.
export const ALLIES = {
  trooper: { name: 'Trooper', hp: 130, dmg: 9, rate: 3, range: 17, speed: 4.6, color: 0x5a7a4a, gun: 'assault', unlock: 0, text: 'Rifleman. Free from the start.' },
  gunner: { name: 'Heavy Gunner', hp: 240, dmg: 5, rate: 11, range: 15, speed: 3.6, color: 0x8a7a3a, gun: 'engineer', unlock: 400, text: 'Slow and tough, with a hail of bullets.' },
  rocketeer: { name: 'Rocketeer', hp: 110, dmg: 70, rate: 0.45, range: 24, speed: 4.2, splash: 3.6, color: 0x8a4a3a, gun: 'heavy', unlock: 600, text: 'Rockets that blow up packs of aliens.' },
  medic: { name: 'Field Medic', hp: 140, dmg: 6, rate: 3, range: 14, speed: 4.6, heal: 9, color: 0xd8d8d8, gun: 'engineer', unlock: 500, text: 'Heals reinforcements and marines nearby.' },
};
export const DROP_EVERY = [26, 21, 17, 13, 10, 7], DROP_COST = [0, 150, 250, 380, 550, 750];
export const SQUAD = [1, 2, 3, 4], SQUAD_COST = [0, 300, 550, 850];
export const MAX_ALLIES = 28;
