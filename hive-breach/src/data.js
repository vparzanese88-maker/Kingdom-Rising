// Everything that sets the numbers: classes, guns, turrets, aliens, maps and waves.

// Each class: a main gun at full power, a side arm and a welding torch for everyone, a right-click zoom, a throwable on G,
// a team bonus, and three things to build: a turret (Q), a device (F) and a third structure (C).
// reserve = spare rounds carried; ammo runs short on purpose: refill at the hub (fast) or a Forward Resupply (slow).
export const SIDEARM = { name: 'P-11 Side Arm', dmg: 22, rate: 4, mag: 12, reserve: 48, reload: 1.3, spread: 0.012, kind: 'hit', sound: 'pistol', recoil: 0.02, near: 15, far: 45, max: 70 };
export const CLASSES = {
  assault: {
    name: 'Assault', color: 0x3b7bd6, hp: 130, speed: 8.2, role: 'Front-line rifleman',
    gun: { name: 'M9 Pulse Rifle', dmg: 17, rate: 10, mag: 32, reserve: 256, reload: 1.8, spread: 0.014, kind: 'hit', sound: 'rifle', recoil: 0.016, near: 22, far: 60, max: 90 },
    throw: { kind: 'frag', name: 'Frag grenade', n: 2 },
    team: 'Squad Leader: teammates near you hit harder and reload faster.',
    sentry: 'pulse', defense: 'barricade', third: 'mines',
  },
  engineer: {
    name: 'Engineer', color: 0xe0b22e, hp: 120, speed: 8.4, role: 'Builder, repairer, resupply',
    gun: { name: 'Breacher Auto Shotgun', semi: 1, dmg: 13, pellets: 8, rate: 3.2, mag: 8, reserve: 64, reload: 2.4, spread: 0.07, kind: 'hit', sound: 'shotgun', recoil: 0.05, near: 8, far: 24, max: 34 },
    throw: { kind: 'frag', name: 'Sticky charge', n: 2 },
    team: 'Builder: welds 3x faster with a bigger power cell.',
    sentry: 'flamer', defense: 'resupply', third: 'teleporter',
  },
  heavy: {
    name: 'Heavy', color: 0xc94a3a, hp: 175, speed: 7.0, role: 'Demolitions and protector',
    gun: { name: 'RL-4 Rocket Launcher', dmg: 110, rate: 1.2, mag: 4, reserve: 24, reload: 2.5, spread: 0, kind: 'rocket', splash: 4.6, sound: 'rocket', recoil: 0.07, life: 1.8 },
    throw: { kind: 'frag', name: 'Frag grenade', n: 3 },
    team: 'Bulwark: teammates near you take less damage.',
    sentry: 'missile', defense: 'mines', third: 'barricade',
  },
  gunner: {
    name: 'Gunner', color: 0x6a8a3a, hp: 190, speed: 6.8, role: 'Suppression and ammo carrier',
    gun: { name: 'M-56 Hand Minigun', dmg: 6.5, rate: 36, mag: 360, reserve: 720, reload: 3.6, spread: 0.032, kind: 'hit', sound: 'mini', recoil: 0.0022, tracers: 1, near: 15, far: 50, max: 70, spin: 0.5 },
    throw: { kind: 'ammo', name: 'Ammo pack', n: 3 },
    team: 'Supplier: throws ammo packs; bullets slow aliens.',
    sentry: 'minigun', defense: 'ammocache', third: 'barricade',
  },
  sniper: {
    name: 'Sniper', color: 0x4aa8a0, hp: 100, speed: 8.2, role: 'Long-range spotter',
    gun: { name: 'XR-9 Rail Rifle', dmg: 160, rate: 0.85, mag: 5, reserve: 40, reload: 2.5, spread: 0.035, scoped: 0.0006, kind: 'hit', sound: 'sniper', recoil: 0.09, near: 400, far: 400, max: 260, pierce: 3 },
    throw: { kind: 'claymore', name: 'Claymore', n: 3 },
    team: 'Spotter: aliens you hit show on the minimap and take more damage.',
    sentry: 'railgun', defense: 'uav', third: 'mines',
  },
  medic: {
    name: 'Medic', color: 0xe8e8f0, hp: 120, speed: 8.4, role: 'Healer',
    gun: { name: 'K-7 Carbine', dmg: 12, rate: 8, mag: 36, reserve: 288, reload: 1.6, spread: 0.016, kind: 'hit', sound: 'smg', recoil: 0.011, near: 18, far: 55, max: 80 },
    throw: { kind: 'medkit', name: 'Health kit', n: 3 },
    heal: 1,
    team: 'Healer: heal beam and health kits to throw.',
    sentry: 'mortar', defense: 'medbay', third: 'stasis',
  },
};
// Specials come in supply crates. You hold one at a time (a new one replaces it) and use it with T.
export const SPECIALS = {
  // aimed on the live map (aim: true); w = how often it turns up in crates
  missile: { name: 'Tactical Missile', aim: 1, w: 1, r: 12, desc: 'Click anywhere on the live map: a missile launches from the hub and strikes there.' },
  dropship: { name: 'Marine Dropship', aim: 1, w: 1, r: 6, desc: 'A dropship flies in and drops 6 marines on the track where you point.' },
  drone: { name: 'Drone Strike', w: 3, desc: 'Three gunship drones fly with you for 15 s and shoot nearby aliens.' },
  airstrike: { name: 'Bombing Run', aim: 1, w: 2, r: 20, desc: 'A jet carpet-bombs the alien track where you point.' },
  orbital: { name: 'Orbital Laser', aim: 1, w: 1, r: 6, desc: 'A beam from orbit burns the area for 6 s.' },
  napalm: { name: 'Napalm', aim: 1, w: 2, r: 10, desc: 'Sets the area ablaze for 8 s.' },
  emp: { name: 'EMP Blast', aim: 1, w: 2, r: 25, desc: 'Stuns every alien in a wide area for 5 s.' },
  cryo: { name: 'Cryo Bomb', aim: 1, w: 2, r: 15, desc: 'Freezes aliens in place, then slows them for 10 s.' },
  medkit: { name: 'Med Kit Drop', aim: 1, w: 3, r: 8, desc: 'Drops a medical crate that heals marines and reinforcements nearby for 30 s.' },
  ammodrop: { name: 'Ammo Drop', aim: 1, w: 3, r: 3, desc: 'Drops an ammo crate for your teammates wherever you choose.' },
  sentrydrop: { name: 'Sentry Drop', aim: 1, w: 1, r: 3, desc: 'A free level-3 Minigun Turret lands where you point.' },
  dome: { name: 'Shield Dome', aim: 1, w: 2, r: 10, desc: 'A dome where marines take no damage for 12 s.' },
  overdrive: { name: 'Turret Overdrive', w: 2, desc: 'All your turrets fire twice as fast for 15 s.' },
  stim: { name: 'Combat Stim', w: 3, desc: 'Full health, 50% more damage and 30% more speed for 12 s.' },
  squad: { name: 'Reinforcement Squad', w: 1, desc: 'Four veteran marines deploy where you stand and fight their way to the hive.' },
  hubrepair: { name: 'Hub Repair Kit', w: 1, desc: 'Restores 25% of the hub.' },
};
export const MISSILE = { launch: 2.5, speed: 75, radius: 12, dmg: 1400 };

// lvl 1-3. Upgrading a turret costs its price times UPG_COST[lvl].
// building a turret costs scrap: a tenth of its old gold price
export const scrapCost = kind => Math.max(4, Math.round((TURRETS[kind].cost || 0) / 10));
export const TURRETS = {
  pulse: { name: 'Pulse Rifle Sentry', cost: 90, hp: 240, range: 22, rate: 6, dmg: 14, key: 'sentry', desc: 'Accurate long-range shots.' },
  minigun: { name: 'Minigun Turret', cost: 100, hp: 260, range: 17, rate: 12, dmg: 7.5, key: 'sentry', desc: 'Spins up and shreds anything close.' },
  tesla: { name: 'Tesla Tower', cost: 140, hp: 220, range: 13, rate: 1.1, dmg: 42, chain: 3, key: 'sentry', desc: 'Lightning that jumps between aliens.' },
  missile: { name: 'Missile Turret', cost: 180, hp: 240, range: 28, rate: 0.55, dmg: 90, splash: 4, key: 'sentry', desc: 'Long-range missiles that blow up groups.' },
  barricade: { name: 'Barricade', cost: 60, hp: 600, onPath: true, key: 'defense', desc: 'A wall across the track. Aliens must stop and break it.' },
  resupply: { name: 'Forward Resupply', cost: 130, hp: 320, range: 6, key: 'defense', desc: 'Slowly refills ammo and items nearby. Aliens hunt it.' },
  mortar: { name: 'Toxin Mortar', cost: 150, hp: 220, range: 30, rate: 0.4, dmg: 40, splash: 5, key: 'sentry', desc: 'Lobs acid shells that leave burning pools.' },
  medbay: { name: 'Med Bay', cost: 110, hp: 220, range: 9, heal: 14, key: 'defense', desc: 'Heals marines and reinforcements nearby.' },
  teleporter: { name: 'Teleporter Pad', cost: 90, hp: 350, key: 'third', desc: 'Press E on it to beam back to the hub.' },
  flamer: { name: 'Flame Turret', cost: 120, hp: 300, range: 9, rate: 10, dmg: 4.5, cone: 0.6, key: 'sentry', desc: 'Sprays fire over everything in front of it.' },
  railgun: { name: 'Railgun Tower', cost: 200, hp: 220, range: 42, rate: 0.35, dmg: 230, key: 'sentry', desc: 'A long beam that pierces every alien in line.' },
  mines: { name: 'Mine Field', cost: 70, hp: 99999, range: 2.6, dmg: 260, splash: 4.5, charges: 3, onPath: true, mine: true, key: 'defense', desc: 'Three charges on the track that blow up walkers.' },
  ammocache: { name: 'Ammo Cache', cost: 80, hp: 200, range: 3, uses: 6, key: 'defense', desc: 'A crate teammates refill ammo from.' },
  claymore: { name: 'Claymore', cost: 0, hp: 99999, range: 5, mine: true, thrown: true, desc: 'A thrown mine that blasts aliens in front of it.' },
  uav: { name: 'Sentry Ball', cost: 90, hp: 140, range: 35, anyPlace: true, ball: 1, key: 'defense', desc: 'Throw it. Aliens within 35 m show on the minimap and take 20% more damage.' },
  stasis: { name: 'Stasis Field', cost: 90, hp: 200, range: 7.5, slow: 0.45, anyPlace: true, key: 'defense', desc: 'Slows every alien inside it.' },
};
export const UPG_COST = [0, 0.8, 1.3];      // cost to go from lvl 1->2, 2->3
export const MAX_TURRETS = 8;               // per marine, sentries and defenses together

// Marine upgrades bought in the armory (B). Five levels each.
export const UPGRADES_OLD = [
  { id: 'dmg', name: 'Weapon damage', text: '+10% damage per level' },
  { id: 'rate', name: 'Fire rate', text: '+8% fire rate per level' },
  { id: 'mag', name: 'Magazine', text: '+20% magazine, faster reload' },
  { id: 'spd', name: 'Move speed', text: '+8% speed per level' },
  { id: 'hp', name: 'Max health', text: '+25 health per level' },
  { id: 'arm', name: 'Armor', text: 'Take 8% less damage per level' },
];
export const UPG_PRICES = [80, 150, 240, 360, 520];

export const ALIENS = {
  crawler: { name: 'Stalker', hp: 65, speed: 8.6, hub: 3, bounty: 6, r: 0.8, h: 0.9, dmg: 11, melee: 1, hunt: { p: 13, leash: 22, time: 7, cd: 3 } },
  spitter: { name: 'Spewer', hp: 95, speed: 5.4, hub: 4, bounty: 11, r: 0.8, h: 1.6, dmg: 11, ranged: 18 },
  brute: { name: 'Juggernaut', hp: 400, speed: 3.6, hub: 10, bounty: 28, r: 1.4, h: 1.5, dmg: 26, melee: 1, armor: 0.35, hunt: { t: 12, p: 6, leash: 18, time: 12, cd: 4 } },
  flyer: { name: 'Wraith', hp: 55, speed: 9.5, hub: 3, bounty: 9, r: 0.7, h: 4.2, dmg: 9, fly: 1, melee: 1, hunt: { p: 15, t: 9, leash: 26, time: 6, cd: 4 } },
  ravager: { name: 'Behemoth', hp: 3400, speed: 2.8, hub: 30, bounty: 220, r: 1.4, h: 1.5, dmg: 40, melee: 1, armor: 0.35, boss: 1, hunt: { t: 14, p: 9, leash: 20, time: 10, cd: 5 } },
  queen: { name: 'Hive Tyrant', hp: 15000, speed: 2.0, hub: 100, bounty: 1000, r: 3.4, h: 3.5, dmg: 55, melee: 1, armor: 0.35, boss: 1, ranged: 24 },
  nest: { name: 'Alien Nest', hp: 600, speed: 0, hub: 0, bounty: 80, r: 2.0, h: 1.0, dmg: 0, nest: 1, static: 1 },
  guardian: { name: 'Hive Guardian', hp: 2600, speed: 0, hub: 0, bounty: 150, r: 1.7, h: 3.2, dmg: 13, static: 1, armor: 0.2, guard: 26 },
  // the endgame: the Brood Queen sits in a cave at the start of the track, births the swarm and is guarded by Royal Guards
  broodqueen: { name: 'Brood Queen', hp: 20000, speed: 0, hub: 0, bounty: 2000, r: 3.4, h: 4.2, dmg: 34, static: 1, armor: 0.3, ranged: 24 },
  royal: { name: 'Royal Guard', hp: 950, speed: 6.4, hub: 6, bounty: 45, r: 1.1, h: 1.8, dmg: 30, melee: 1, armor: 0.15 },
  hivecore: { name: 'The Hive', hp: 12000, speed: 0, hub: 0, bounty: 1500, r: 5.5, h: 2.4, dmg: 0, static: 1 },
};

export const WAVES = 20;
// A wave is a list of [type, count, gap seconds].
export const MIX = { mars: { brute: 1.6, brute0: 3 }, ice: { flyer: 1.7, flyer0: 3 }, jungle: { crawler: 1.3, spitter: 1.5 } };
export function waveList(w, map) {
  const X = MIX[map] || {}, L0 = waveBase(w, X), L = [];
  // the first threat levels come in light, building up to full strength by level 11
  // the swarm thickens with every threat level: light at first, then more and more aliens (strength never changes)
  const ease = Math.min(1, 0.5 + 0.05 * (w - 1)) * (1 + 0.035 * Math.max(0, w - 1));
  for (const [t, c, g] of L0) L.push([t, ALIENS[t].boss ? c : Math.max(1, Math.round(c * (X[t] || 1) * ease)), g]);
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
// no automatic weapon upgrades: damage stays the same all game
export const techMul = () => 1;
// aliens never get stronger over time: only more of them come (more players still means tougher aliens)
export const hpScale = (w, players) => 1 + 0.3 * (squad(players) - 1);
export const bossScale = n => 1 + 0.6 * (squad(n) - 1);

export const MAPS = {
  mars: {
    name: 'Red Sands Outpost', sub: 'Mars, mining colony 7 · meteor showers', ground: 0xa4502e, ground2: 0x7d3a22, path: 0x5a3a2c, sky: 0xd99a6a, fog: 0xc88458, fogD: [96, 412], sun: 0xffe0c0, amb: 0x804030,
    prop: 'rock', extra: ['dome', 'derrick'], hazard: 'meteor', weather: 'dust', liquid: 0xff5a10, rock: 0x5a2a1a,
    craters: [{ x: -130, z: 60, r: 22, d: 7 }, { x: 120, z: -110, r: 26, d: 8 }, { x: -40, z: -120, r: 14, d: 4 }, { x: 40, z: 110, r: 16, d: 5 }], mesas: [{ x: -150, z: -40, r: 16, h: 14 }, { x: 160, z: 20, r: 14, h: 12 }, { x: -60, z: 140, r: 18, h: 13 }],
    hills: [{ pts: [[-170, -90], [-150, 60]], w: 34, h: 12 }, { pts: [[60, 170], [170, 60]], w: 34, h: 11 }],
    hs: [3, 6, 10, 6, 3, 8, 12, 7, 4, 9, 6, 4, 3], chasms: [{ pts: [[-20, -190], [-20, 70]], w: 13 }], ridges: [{ pts: [[40, -115], [40, 0]], w: 26, h: 18 }],
    pts: [[-150, -150], [-90, -145], [-60, -100], [-115, -50], [-105, 15], [-40, 35], [0, -20], [55, -55], [115, -30], [125, 40], [70, 85], [105, 120], [145, 145]],
  },
  ice: {
    name: 'Kryos Station', sub: 'Ice moon of Kryos IV · blizzards', ground: 0xd6e4ee, ground2: 0xa8c0d4, path: 0x6e8aa4, sky: 0x9ab8d8, fog: 0xb8cde0, fogD: [84, 385], sun: 0xe8f2ff, amb: 0x506888,
    prop: 'ice', extra: ['dish', 'spire'], hazard: 'blizzard', weather: 'snow', liquid: 0x3080c0, rock: 0x6a7c90,
    craters: [{ x: 140, z: 60, r: 22, d: 7 }, { x: -140, z: -120, r: 24, d: 8 }, { x: 20, z: 130, r: 16, d: 5 }], mesas: [{ x: 160, z: 120, r: 18, h: 15 }, { x: -30, z: -140, r: 16, h: 12 }, { x: 60, z: 70, r: 12, h: 10 }],
    hills: [{ pts: [[170, -80], [170, 80]], w: 34, h: 13 }, { pts: [[-80, -170], [60, -170]], w: 34, h: 12 }],
    hs: [4, 7, 3, 6, 9, 5, 2, 6, 10, 5, 8, 12, 6, 3], chasms: [{ pts: [[-190, -5], [40, -5]], w: 12 }], ridges: [{ pts: [[-130, 60], [-20, 100]], w: 26, h: 20 }],
    pts: [[150, -150], [100, -140], [60, -90], [110, -40], [90, 20], [30, 10], [-10, -50], [-70, -80], [-120, -30], [-100, 40], [-40, 70], [-60, 120], [-105, 130], [-145, 145]],
  },
  jungle: {
    name: 'Verdant Colony', sub: 'Jungle world Thessa, at night · alien nests', ground: 0x2f5a28, ground2: 0x23441e, path: 0x4a3a28, sky: 0x1c2a34, fog: 0x1e2e30, fogD: [43, 233], sun: 0x8090c0, sunI: 0.7, hemiI: 0.55, amb: 0x102018,
    prop: 'tree', extra: ['shroom', 'tree'], hazard: 'nests', weather: 'rain', dense: 1, liquid: 0x2a7a8a, rock: 0x4a4a3a,
    craters: [{ x: -150, z: -100, r: 22, d: 7 }, { x: 140, z: 90, r: 22, d: 6 }, { x: 0, z: 150, r: 16, d: 5 }], mesas: [{ x: -160, z: 40, r: 15, h: 13 }, { x: 160, z: 20, r: 16, h: 14 }, { x: 40, z: 140, r: 14, h: 12 }],
    hills: [{ pts: [[-170, -60], [-170, -170]], w: 34, h: 12 }, { pts: [[100, 170], [170, 100]], w: 34, h: 12 }],
    hs: [4, 7, 3, 8, 5, 9, 4, 7, 11, 5, 3, 7, 10, 5, 3], chasms: [{ pts: [[-190, -20], [190, -20]], w: 13 }], ridges: [{ pts: [[-60, -90], [40, -90]], w: 26, h: 18 }],
    pts: [[-150, 150], [-100, 145], [-70, 100], [-120, 60], [-90, 0], [-30, 20], [10, 80], [70, 60], [90, 0], [40, -40], [-20, -60], [0, -120], [70, -130], [110, -95], [145, -145]],
  },
};
export const PATH_W = 9;
export const BOUNDS = 180;

// Marines the hub sends down the track toward the hive. Trooper is free; the others are unlocked in the armory.
export const ALLIES = {
  trooper: { name: 'Trooper', hp: 520, dmg: 28, rate: 3, range: 17, speed: 6.0, color: 0x5a7a4a, gun: 'assault', unlock: 0, text: 'Rifleman. Free from the start.' },
  gunner: { name: 'Heavy Gunner', hp: 900, dmg: 13, rate: 11, range: 15, speed: 4.7, color: 0x8a7a3a, gun: 'engineer', unlock: 300, text: 'Slow and tough, with a hail of bullets.' },
  rocketeer: { name: 'Rocketeer', hp: 440, dmg: 200, rate: 0.5, range: 24, speed: 5.5, splash: 3.6, color: 0x8a4a3a, gun: 'heavy', unlock: 450, text: 'Rockets that blow up packs of aliens.' },
  medic: { name: 'Field Medic', hp: 520, dmg: 18, rate: 3, range: 14, speed: 6.0, heal: 26, color: 0xd8d8d8, gun: 'engineer', unlock: 380, text: 'Heals reinforcements and marines nearby.' },
};
// fewer reinforcements, but each one is a hardened veteran
export const DROP_EVERY = [26, 22, 18, 15, 12, 10], DROP_COST = [0, 120, 200, 300, 420, 560];
export const SQUAD = [1, 2, 2, 3], SQUAD_COST = [0, 220, 400, 650];
export const MAX_ALLIES = 18;

export const UPGRADES = [];   // no more marine upgrades: upgrades are for turrets and reinforcements
