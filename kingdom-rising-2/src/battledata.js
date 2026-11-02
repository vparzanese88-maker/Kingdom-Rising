// Kingdom Battles: troop rosters, town styles, costs and balance numbers.

export const TEAM_COLORS = ['#2f6ae0', '#d0302a', '#2fa84a', '#e0a820'];
export const TEAM_NAMES = ['Blue', 'Red', 'Green', 'Gold'];
export const DIFFS = {
  easy: { name: 'Easy', income: 0.6, wave: 7, think: 3.0, upgradeAt: 480, reserve: 0.5 },
  normal: { name: 'Normal', income: 1.0, wave: 10, think: 2.0, upgradeAt: 300, reserve: 0.35 },
  hard: { name: 'Hard', income: 1.3, wave: 12, think: 1.2, upgradeAt: 200, reserve: 0.25 },
  insane: { name: 'Insane', income: 1.75, wave: 14, think: 0.8, upgradeAt: 140, reserve: 0.15 },
};
export const TOWN_NAMES = {
  human: ['Ashford', 'Kingsbridge', 'Westmarch', 'Eldham'],
  orc: ['Gor\'Thak', 'Skullmaw', 'Bloodrock', 'Krag\'Zul'],
  highelf: ['Silverspire', 'Aelindor', 'Sunreach', 'Lunathiel'],
  woodelf: ['Thornwood', 'Glimmerglade', 'Mossheart', 'Ellowyn'],
  dwarf: ['Ironhold', 'Khaz Durim', 'Stonebeard Deep', 'Grimforge'],
};
export const BATTLE_RACES = ['human', 'orc', 'highelf', 'woodelf', 'dwarf'];

// unit stat lines. lvl = town level needed. range 0 = melee. spec = clothing. wt = weapon model.
// hp/dmg are at town level 0; every town level adds 12%.
const U = (o) => Object.assign({ range: 0, speed: 4.3, armor: 0.1, cd: 1.3, size: 1, time: 4, cost: { gold: 60 }, pop: 1 }, o);
export const ROSTERS = {
  human: {
    worker: U({ id: 'worker', name: 'Peasant', role: 'worker', hp: 110, dmg: 5, cost: { gold: 50 }, spec: 'worker', tool: 'hatchet', time: 3 }),
    units: [
      U({ id: 'footman', name: 'Footman', role: 'melee', lvl: 0, hp: 270, dmg: 17, armor: 0.25, wt: 'swordshield', tier: 1, spec: 'soldier', cost: { gold: 65 } }),
      U({ id: 'archer', name: 'Archer', role: 'ranged', lvl: 0, hp: 160, dmg: 15, cd: 1.6, range: 22, proj: 'arrow', wt: 'bow', spec: 'archer', cost: { gold: 70, wood: 15 } }),
      U({ id: 'musketeer', name: 'Musketeer', role: 'ranged', lvl: 1, hp: 200, dmg: 46, cd: 3.8, range: 27, proj: 'bullet', wt: 'musket', spec: 'musket', cost: { gold: 115, wood: 20 }, time: 6 }),
      U({ id: 'knight', name: 'Knight', role: 'melee', lvl: 2, hp: 680, dmg: 32, armor: 0.45, cd: 1.4, speed: 4.6, wt: 'swordshield', tier: 3, spec: 'knight', size: 1.12, cost: { gold: 190, wood: 15 }, time: 8, pop: 2 }),
      U({ id: 'priest', name: 'War Priest', role: 'healer', lvl: 3, hp: 240, dmg: 12, cd: 2.2, range: 18, proj: 'holy', wt: 'arcanestaff', spec: 'priest', heal: 38, cost: { gold: 160, wood: 10 }, time: 7 }),
    ],
  },
  orc: {
    worker: U({ id: 'worker', name: 'Peon', role: 'worker', hp: 120, dmg: 6, cost: { gold: 50 }, spec: 'peon', tool: 'hatchet', time: 3 }),
    units: [
      U({ id: 'brute', name: 'Axe Brute', role: 'melee', lvl: 0, hp: 300, dmg: 21, armor: 0.12, cd: 1.5, wt: 'greataxe', tier: 1, spec: 'orcbrute', size: 1.05, cost: { gold: 70 } }),
      U({ id: 'xbow', name: 'Crossbowman', role: 'ranged', lvl: 0, hp: 175, dmg: 19, cd: 2.0, range: 21, proj: 'bolt', wt: 'crossbow', spec: 'orcxbow', cost: { gold: 75, wood: 15 } }),
      U({ id: 'shaman', name: 'Fire Shaman', role: 'ranged', lvl: 1, hp: 190, dmg: 30, cd: 2.6, range: 20, proj: 'fire', splash: 3, wt: 'firestaff', spec: 'shaman', cost: { gold: 120, wood: 15 }, time: 6 }),
      U({ id: 'warlord', name: 'Warlord', role: 'melee', lvl: 2, hp: 760, dmg: 40, armor: 0.3, cd: 1.6, wt: 'greataxe', tier: 3, spec: 'warlord', size: 1.22, cost: { gold: 200, wood: 15 }, time: 8, pop: 2 }),
      U({ id: 'wolfrider', name: 'Raider', role: 'melee', lvl: 3, hp: 420, dmg: 26, cd: 1.0, speed: 6.2, wt: 'handaxes', tier: 2, spec: 'orcbrute', cost: { gold: 150, wood: 10 }, time: 6 }),
    ],
  },
  highelf: {
    worker: U({ id: 'worker', name: 'Labourer', role: 'worker', hp: 100, dmg: 5, cost: { gold: 50 }, spec: 'elfworker', tool: 'hatchet', time: 3 }),
    units: [
      U({ id: 'spearman', name: 'Spearguard', role: 'melee', lvl: 0, hp: 240, dmg: 19, armor: 0.2, cd: 1.2, wt: 'spear', tier: 2, spec: 'elfguard', cost: { gold: 65 } }),
      U({ id: 'longbow', name: 'Longbowman', role: 'ranged', lvl: 0, hp: 150, dmg: 16, cd: 1.5, range: 26, proj: 'arrow', wt: 'bow', spec: 'elfarcher', cost: { gold: 75, wood: 15 } }),
      U({ id: 'battlemage', name: 'Battle Mage', role: 'ranged', lvl: 1, hp: 180, dmg: 34, cd: 2.6, range: 22, proj: 'arcane', splash: 2.5, wt: 'arcanestaff', spec: 'mage', cost: { gold: 125, wood: 10 }, time: 6 }),
      U({ id: 'blademaster', name: 'Blademaster', role: 'melee', lvl: 2, hp: 620, dmg: 38, armor: 0.35, cd: 1.1, speed: 5, wt: 'greatsword', tier: 4, spec: 'elfknight', size: 1.08, cost: { gold: 200, wood: 10 }, time: 8, pop: 2 }),
      U({ id: 'sunpriest', name: 'Sun Priestess', role: 'healer', lvl: 3, hp: 230, dmg: 14, cd: 2.0, range: 20, proj: 'holy', wt: 'arcanestaff', spec: 'priest', heal: 42, cost: { gold: 165, wood: 10 }, time: 7 }),
    ],
  },
  woodelf: {
    worker: U({ id: 'worker', name: 'Gatherer', role: 'worker', hp: 100, dmg: 5, cost: { gold: 50 }, spec: 'elfworker', tool: 'hatchet', time: 3 }),
    units: [
      U({ id: 'warden', name: 'Glade Warden', role: 'melee', lvl: 0, hp: 230, dmg: 18, cd: 0.9, speed: 4.8, wt: 'daggers', tier: 1, spec: 'warden', cost: { gold: 65 } }),
      U({ id: 'sharpshooter', name: 'Sharpshooter', role: 'ranged', lvl: 0, hp: 150, dmg: 18, cd: 1.7, range: 28, proj: 'arrow', wt: 'bow', spec: 'hunter', cost: { gold: 75, wood: 15 } }),
      U({ id: 'druid', name: 'Druid', role: 'ranged', lvl: 1, hp: 200, dmg: 24, cd: 2.4, range: 20, proj: 'frost', slow: 2, wt: 'froststaff', spec: 'druid', cost: { gold: 115, wood: 15 }, time: 6 }),
      U({ id: 'ancient', name: 'Ancient Guardian', role: 'melee', lvl: 2, hp: 1100, dmg: 42, armor: 0.3, cd: 2.0, speed: 3.6, kind: 'troll', skin: '#5a7a3a', wt: 'warhammer', size: 1.3, cost: { gold: 230, wood: 60 }, time: 10, pop: 3 }),
      U({ id: 'moonpriest', name: 'Moon Priestess', role: 'healer', lvl: 3, hp: 220, dmg: 14, cd: 2.0, range: 20, proj: 'holy', wt: 'froststaff', spec: 'druid', heal: 40, cost: { gold: 160, wood: 15 }, time: 7 }),
    ],
  },
  dwarf: {
    worker: U({ id: 'worker', name: 'Miner', role: 'worker', hp: 130, dmg: 6, cost: { gold: 50 }, spec: 'miner', tool: 'pickaxe', time: 3 }),
    units: [
      U({ id: 'ironshield', name: 'Ironshield', role: 'melee', lvl: 0, hp: 320, dmg: 16, armor: 0.35, cd: 1.3, speed: 3.9, wt: 'maceshield', tier: 2, spec: 'dwarfguard', cost: { gold: 70 } }),
      U({ id: 'thunderer', name: 'Thunderer', role: 'ranged', lvl: 0, hp: 190, dmg: 34, cd: 3.2, range: 24, proj: 'bullet', wt: 'musket', spec: 'thunderer', speed: 3.9, cost: { gold: 85, wood: 15 } }),
      U({ id: 'ironbreaker', name: 'Ironbreaker', role: 'melee', lvl: 1, hp: 520, dmg: 30, armor: 0.45, cd: 1.7, speed: 3.8, wt: 'warhammer', tier: 3, spec: 'dwarfguard', cost: { gold: 140, wood: 10 }, time: 6, pop: 2 }),
      U({ id: 'runepriest', name: 'Rune Priest', role: 'healer', lvl: 2, hp: 260, dmg: 16, cd: 2.0, range: 18, proj: 'holy', wt: 'arcanestaff', spec: 'runepriest', heal: 40, cost: { gold: 150, wood: 10 }, time: 7 }),
      U({ id: 'cannon', name: 'Slayer', role: 'melee', lvl: 3, hp: 600, dmg: 48, armor: 0.2, cd: 1.2, speed: 4.6, wt: 'greataxe', tier: 4, spec: 'slayer', cost: { gold: 190, wood: 10 }, time: 8, pop: 2 }),
    ],
  },
};
// mercenaries anyone can hire
export const MERCS = [
  U({ id: 'sellsword', name: 'Sellsword', role: 'melee', lvl: 0, hp: 220, dmg: 15, wt: 'swordshield', tier: 1, spec: 'bandit', cost: { gold: 55 }, merc: true }),
  U({ id: 'troll', name: 'Giant Troll', role: 'melee', lvl: 2, hp: 1500, dmg: 58, armor: 0.25, cd: 2.3, speed: 3.6, kind: 'troll', wt: 'warhammer', size: 1.45, cost: { gold: 320, wood: 40 }, time: 12, pop: 4, merc: true, slam: 4 }),
];
export function rosterOf(race) { const R = ROSTERS[race] || ROSTERS.human; return [...R.units, ...MERCS]; }
export function unitDef(race, id) { const R = ROSTERS[race] || ROSTERS.human; if (id === 'worker') return R.worker; return R.units.find(u => u.id === id) || MERCS.find(u => u.id === id); }

// clothing for each kind of troop; team colour fills tabards, hoods and sashes
export function unitSpec(spec, team, race) {
  const T = team;
  switch (spec) {
    case 'soldier': return { shirt: '#5b5f66', mail: '#9aa3ad', tabard: T, trim: '#d8c070', pants: '#3a2f28', boots: '#2b211a', belt: '#3a2a1a', bracers: '#9aa3ad' };
    case 'knight': return { shirt: '#5b5f66', mail: '#c0c8d0', tabard: T, trim: '#e8d080', pants: '#5a5f66', boots: '#3a3a40', pauldrons: true, belt: '#3a2a1a', bracers: '#c0c8d0', hood: null };
    case 'archer': return { shirt: '#5a4a36', vest: '#6b4a2a', pants: '#4a4030', boots: '#4a3220', hood: T, quiver: true, belt: '#3a2a1a', bracers: '#5a3a22' };
    case 'musket': return { shirt: '#e0d8c0', vest: T, pants: '#3a3a44', boots: '#1e1a16', hat: 'cap', hatCol: T, belt: '#2a1a10' };
    case 'priest': return { shirt: '#f0ead8', robe: '#f0ead8', trim: T, pants: '#d8d0c0', boots: '#6a5a40', sash: T, sleeves: true };
    case 'worker': return { shirt: '#9a7a5a', pants: '#4a4038', boots: '#3a2a1a', belt: T };
    case 'peon': return { shirt: '#6a5038', pants: '#3a3028', boots: null, belt: T, bareArms: true, torn: true };
    case 'elfworker': return { shirt: '#d8d0b8', pants: '#5a6a4a', boots: '#4a3a2a', belt: T };
    case 'miner': return { shirt: '#6a5a4a', pants: '#3a3028', boots: '#2a2018', apron: '#4a3020', belt: T, hat: 'cap', hatCol: '#8a7a50' };
    case 'orcbrute': return { shirt: '#5a3a22', vest: '#3a2a1a', pants: '#3a2a1e', boots: '#2a1a10', belt: '#2a1a10', bracers: '#5a3a22', bareArms: true, sash: T };
    case 'orcxbow': return { shirt: '#4a3a28', vest: '#5a4030', pants: '#3a3020', boots: '#2a1a10', belt: '#2a1a10', hood: T, quiver: true };
    case 'shaman': return { shirt: '#4a2a1a', robe: '#5a3a22', trim: T, pants: '#3a2a1e', boots: null, shawl: '#8a6a4a', sash: T, bareArms: true };
    case 'warlord': return { shirt: '#3a3030', mail: '#5a5a5e', tabard: T, trim: '#a08040', pants: '#2a2622', boots: '#1e1a16', pauldrons: true, belt: '#1a1410', bracers: '#5a5a5e', bareArms: true };
    case 'elfguard': return { shirt: '#e8e4d8', mail: '#d8dce8', tabard: T, trim: '#e8c860', pants: '#c8c4b8', boots: '#8a7a5a', belt: '#a08a50', bracers: '#d8dce8' };
    case 'elfarcher': return { shirt: '#e8e4d8', vest: '#c8c0a8', pants: '#8a8a7a', boots: '#6a5a40', hood: T, cloak: T, quiver: true, belt: '#a08a50' };
    case 'mage': return { shirt: T, robe: T, trim: '#e8c860', pants: '#3a3a5a', boots: '#4a3a2a', hat: 'pointy', hatCol: T, sash: '#e8c860', sleeves: true };
    case 'elfknight': return { shirt: '#d8dce8', mail: '#e8ecf4', tabard: T, trim: '#f0d070', pants: '#c8ccd8', boots: '#a8acb8', pauldrons: true, belt: '#a08a50', bracers: '#e8ecf4' };
    case 'warden': return { shirt: '#4a5a34', vest: '#5a4a2a', pants: '#3c4a2a', boots: '#4a3220', hood: T, cloak: '#3a5a2a', belt: '#3a2a1a', bracers: '#5a3a22' };
    case 'hunter': return { shirt: '#4a3a28', vest: '#6a5034', pants: '#3c4030', boots: '#4a3220', hood: T, cloak: '#4a5a34', quiver: true, belt: '#3a2a1a' };
    case 'druid': return { shirt: '#5a6a3a', robe: '#4a5a2a', trim: T, pants: '#3a3a28', boots: '#4a3a2a', shawl: '#7a6a4a', sash: T };
    case 'dwarfguard': return { shirt: '#5b5f66', mail: '#7a7e86', tabard: T, trim: '#c8a050', pants: '#3a2f28', boots: '#2b211a', pauldrons: true, belt: '#3a2a1a', bracers: '#7a7e86' };
    case 'thunderer': return { shirt: '#6a5a4a', vest: T, pants: '#3a3028', boots: '#2a2018', hat: 'cap', hatCol: '#5a4a3a', belt: '#2a1a10' };
    case 'runepriest': return { shirt: '#5a4a3a', robe: '#4a3a2a', trim: T, pants: '#3a3028', boots: '#2a2018', sash: T, shawl: '#8a6a4a' };
    case 'slayer': return { shirt: '#c06030', pants: '#3a2a1e', boots: '#2a1a10', belt: '#2a1a10', bareArms: true, sash: T };
    case 'bandit': return { shirt: '#3a3028', vest: '#4a3a2a', pants: '#2a2622', boots: '#1e1a16', hood: T, belt: '#1a1410', bracers: '#3a2a1a' };
    default: return { shirt: '#9a8a6a', pants: '#4a4038', boots: '#3a2a1a', belt: T };
  }
}

// town upgrade costs and what each level gives. Level 0 is the starting town.
export const TOWN_LEVELS = [
  { name: 'Village', cap: 30, peasants: 5, cost: null, hall: 7000, wallH: 4.2, houses: 5 },
  { name: 'Town', cap: 40, peasants: 8, cost: { gold: 350, wood: 300, stone: 200 }, hall: 9500, wallH: 5.4, houses: 8, time: 60 },
  { name: 'Stronghold', cap: 50, peasants: 11, cost: { gold: 700, wood: 450, stone: 450 }, hall: 12500, wallH: 6.6, houses: 11, time: 60 },
  { name: 'Citadel', cap: 60, peasants: 14, cost: { gold: 1100, wood: 600, stone: 800 }, hall: 16000, wallH: 7.8, houses: 14, time: 60 },
];
export const TOWER_LEVELS = [
  { name: 'Archer Tower', hp: 3000, dmg: 55, cd: 1.6, range: 26 },
  { name: 'Guard Tower', hp: 4300, dmg: 80, cd: 1.4, range: 28, cost: { gold: 150, wood: 150, stone: 200 }, time: 25 },
  { name: 'Fortress Tower', hp: 6000, dmg: 115, cd: 1.2, range: 30, cost: { gold: 300, wood: 250, stone: 400 }, time: 35 },
];
// Foreman upgrades (peasants). Each has 3 ranks.
export const FOREMAN = [
  { id: 'housing', name: 'Peasant Housing', desc: '+2 peasant limit per rank', icon: '🏠', costs: [{ gold: 60, wood: 60 }, { gold: 140, wood: 120, stone: 60 }, { gold: 260, wood: 200, stone: 160 }] },
  { id: 'tools', name: 'Sharper Tools', desc: 'Peasants chop and mine 20% faster per rank', icon: '🪓', costs: [{ gold: 50, wood: 40, stone: 20 }, { gold: 120, wood: 90, stone: 60 }, { gold: 240, wood: 160, stone: 140 }] },
  { id: 'boots', name: 'Sturdy Boots', desc: 'Peasants walk 15% faster per rank', icon: '👢', costs: [{ gold: 50, wood: 30 }, { gold: 110, wood: 80, stone: 40 }, { gold: 220, wood: 140, stone: 100 }] },
  { id: 'sacks', name: 'Bigger Sacks', desc: 'Peasants carry +5 and you carry +10 per rank', icon: '🎒', costs: [{ gold: 60, wood: 50 }, { gold: 130, wood: 100, stone: 50 }, { gold: 250, wood: 180, stone: 120 }] },
];
export const TOWER_REPAIR = { wood: 40, stone: 60 }; // per 25% repaired

// hero gear bought in the Armory (weapon and armour tiers 1..5)
export const ARMORY = { weapon: [0, 120, 260, 450, 700, 1000], armor: [0, 160, 340, 560, 860, 1200] };

// economy
export const ECON = {
  start: { gold: 0, wood: 0, stone: 0 },
  passiveGold: 1.6, passiveGoldPerLevel: 0.6, deliveryGold: 4, passiveXp: 0, aiPassiveXp: 1.5,
  heroCarry: 30, peasantCost: { gold: 40 }, graceTime: 480,
  carry: 15, gatherTime: 3.5,
  levelGold: (lv) => 40 * lv,
  killGold: (u) => Math.round((u.def.cost ? u.def.cost.gold : 60) * 0.4),
  heroKillGold: (lv) => 60 + lv * 12,
  structGold: { tower: 220, hall: 500 },
  xpUnit: (u) => 8 + Math.round((u.def.cost ? u.def.cost.gold : 60) / 7),
  xpHero: (lv) => 40 + lv * 15, xpStruct: { tower: 160, hall: 400 },
  xpNeed: (lv) => 60 * lv + 40,
  respawn: (lv) => 7 + lv * 1.7,
};

// extra class abilities that only exist in Kingdom Battles (3 per class)
const BA = (id, name, level, cost, cd, desc) => ({ id, name, level, cost, cd, desc, key: '', icon: '', battle: true });
export const BATTLE_ABILITIES = {
  warrior: [BA('rally', 'Rallying Banner', 3, 30, 22, 'Plant your banner: you heal 15% and every one of your troops within 14 m heals 30% and hits 25% harder for 10 s.'),
    BA('seismic', 'Seismic Slam', 7, 35, 10, 'Smash the ground: a shockwave rips 10 m forward in a wide cone, dealing heavy damage and slowing everything it hits.'),
    BA('bladestorm', 'Bladestorm', 11, 45, 18, 'Spin like a whirlwind of steel for 2.4 s, cutting everything within 4.5 m again and again.')],
  berserker: [BA('hurlaxe', 'Hurl Axe', 3, 20, 7, 'Throw a spinning axe that hits hard and leaves the target bleeding.'),
    BA('skullsplitter', 'Skull Splitter', 7, 35, 9, 'A savage overhead chop on everything right in front of you: huge damage, doubled on enemies below 30% health.'),
    BA('frenzy', 'Blood Frenzy', 11, 40, 24, 'Go berserk for 8 s: you attack 50% faster and every hit heals you a little.')],
  ranger: [BA('arrowrain', 'Arrow Rain', 3, 30, 12, 'Loose a storm of arrows at the spot you aim at: 6 volleys over 3 s hit everything in 7 m.'),
    BA('venomshot', 'Venom Arrow', 7, 20, 8, 'A poisoned arrow that hits hard and keeps eating away at the target for 8 s.'),
    BA('wolves', 'Call of the Wild', 11, 45, 40, 'Two great wolves come to fight at your side for 30 s.')],
  wizard: [BA('pyroblast', 'Pyroblast', 3, 30, 8, 'Hurl a huge fireball that explodes on impact, burning everything within 4.5 m.'),
    BA('glacial', 'Glacial Spike', 7, 25, 9, 'A spear of ice that hits hard and freezes its target solid for 3 s.'),
    BA('meteorshower', 'Meteor Shower', 11, 60, 28, 'Call down five meteors around the spot you aim at.')],
};
