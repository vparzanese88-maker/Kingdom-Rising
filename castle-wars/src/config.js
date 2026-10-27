// Central tuning values for Castle Wars. Everything balance-related lives here.

export const PLAYER_TEAM = 0;
export const RAIDER_TEAM = 4;

export const TEAM_COLORS = [0x2f62c8, 0xb8322a, 0x2c8a46, 0xd9a521, 0x4a3b2c];
export const TEAM_CSS = ['#3f74e0', '#d0453b', '#38a957', '#e8b52c', '#8a6a4a'];
export const TEAM_NAMES = ['Blue Kingdom', 'Red Kingdom', 'House Elden', 'House Sol', 'Raiders'];
export const LORD_NAMES = ['You', 'Lord Varr', 'Lady Elden', 'Lord Sol'];

export const WORLD = {
  half: 220,        // terrain extends to +-half
  playHalf: 204,    // characters are clamped to +-playHalf
  castleDist: 130,  // distance of each castle from the map centre
  gravity: 22,
  size: 'medium',
};

export const MAP_SIZES = {
  small: { name: 'Small', half: 140, castleDist: 62, desc: 'The castles stare at each other across a narrow field: constant clashes.' },
  medium: { name: 'Medium', half: 190, castleDist: 90, desc: 'A battlefield between two castles, with a ruin in the middle.' },
  large: { name: 'Large', half: 260, castleDist: 130, desc: 'Wide wilds between the castles: long marches, more forest.' },
};

// Switch map size. Must be called before a Game is built.
export function setMapSize(size) {
  const m = MAP_SIZES[size] || MAP_SIZES.medium;
  WORLD.size = MAP_SIZES[size] ? size : 'medium';
  WORLD.half = m.half;
  WORLD.playHalf = m.half - 16;
  WORLD.castleDist = m.castleDist;
}

export const CASTLE = {
  H: 20,          // half-size of the curtain wall square
  wallH: 8,       // wall height
  wallT: 2,       // wall thickness
  gateW: 6,
  gateH: 6,
  towerR: 3.2,
  towerOff: 1.8,  // corner towers sit this far outside the wall corners so the wall walk passes them
  walk: 3.5,      // width of the wooden walkway along the inside of the walls
  towerH: 13,
  keepW: 11,
  keepH: 15,
  baseY: 2,       // terrain is flattened to this height around castles
  wallHp: 900,
  gateHp: 1400,
  keepHp: 3000,
};

export const ROUNDS = {
  firstPrep: 45,      // preparation time before the first wave (buy and upgrade before the match)
  prep: 25,           // seconds between waves
  maxWaveTime: 210,   // a wave is force-ended after this long
  warRound: 2,        // the enemy lord starts assaulting your castle from this round
  survivalBonus: (round) => 80 + round * 25,
};

export const START_GOLD = 500;
export const GIANT_COST = 1600;

export const DIFFICULTY = {
  easy:   { wave: 0.7, enemyStat: 0.85, aiGold: 0.8, aiAggro: 0.7 },
  normal: { wave: 1.0, enemyStat: 1.0,  aiGold: 1.0, aiAggro: 1.0 },
  hard:   { wave: 1.35, enemyStat: 1.15, aiGold: 1.25, aiAggro: 1.3 },
};

// Gold rewards for kills, by victim kind.
export const BOUNTY = {
  raider: 10, raiderArcher: 12, brute: 35, warlord: 250,
  raiderRider: 30, shaman: 30, longbowman: 30, giant: 600, horseman: 50, lancer: 65,
  swordsman: 18, spearman: 20, archer: 20, knight: 45, lord: 120, hero: 120,
  ram: 120, catapult: 180,
  gate: 200,
  keep: 500,
};

// Body styles: [armour colour, metalness, roughness]
export const BODY_STYLES = {
  mail:     [0x8b9098, 0.55, 0.55],
  plate:    [0xc3c7cf, 0.75, 0.35],
  gambeson: [0x9d8862, 0.0, 0.95],
  leather:  [0x6b4a2f, 0.0, 0.85],
  fur:      [0x5a4634, 0.0, 1.0],
  robeWhite:  [0xe8e2d2, 0.0, 0.9],
  robePurple: [0x3d2450, 0.0, 0.9],
  robeBlue:   [0x23347a, 0.0, 0.9],
};

export const UNIT_TYPES = {
  swordsman: { name: 'Man-at-Arms', hp: 100, dmg: 14, armor: 2, speed: 4.4, range: 1.9, cd: 1.1,
    weapon: 'sword', shield: 'round', helmet: 'kettle', body: 'mail', cost: 40, kind: 'infantry' },
  spearman: { name: 'Spearman', hp: 115, dmg: 16, armor: 3, speed: 4.2, range: 2.7, cd: 1.3,
    weapon: 'spear', shield: 'kite', helmet: 'nasal', body: 'mail', cost: 50, kind: 'infantry', siegeBonus: 2.5 },
  pikeman: { name: 'Pikeman', hp: 120, dmg: 20, armor: 3, speed: 4.0, range: 3.8, cd: 1.5,
    weapon: 'pike', helmet: 'kettle', body: 'gambeson', cost: 55, kind: 'infantry', siegeBonus: 3 },
  archer: { name: 'Bowman', hp: 70, dmg: 13, armor: 1, speed: 4.5, range: 44, cd: 2.2,
    weapon: 'bow', helmet: 'hood', body: 'gambeson', cost: 60, kind: 'archer', ranged: true },
  crossbowman: { name: 'Crossbowman', hp: 85, dmg: 30, armor: 3, speed: 4.2, range: 48, cd: 3.4,
    weapon: 'crossbow', helmet: 'kettle', body: 'mail', cost: 75, kind: 'archer', ranged: true },
  knight: { name: 'Knight', hp: 240, dmg: 26, armor: 7, speed: 4.1, range: 2.1, cd: 1.2,
    weapon: 'sword', shield: 'kite', helmet: 'great', body: 'plate', cost: 130, kind: 'infantry', scale: 1.08 },
  longbowman: { name: 'Longbowman', hp: 95, dmg: 20, armor: 3, speed: 4.5, range: 54, cd: 2.0,
    weapon: 'bow', helmet: 'nasal', body: 'mail', kind: 'archer', ranged: true, promoteOnly: true },
  horseman: { name: 'Cavalry', hp: 260, dmg: 22, armor: 5, speed: 8.6, range: 2.6, cd: 1.4,
    weapon: 'sword', shield: 'kite', helmet: 'nasal', body: 'mail', cost: 160, kind: 'cavalry', mounted: true },
  lancer: { name: 'Lancer', hp: 300, dmg: 30, armor: 7, speed: 9.2, range: 3.4, cd: 2.0,
    weapon: 'lance', shield: 'kite', helmet: 'great', body: 'plate', cost: 220, kind: 'cavalry', mounted: true },
  lord: { name: 'Lord', hp: 340, dmg: 30, armor: 7, speed: 5.0, range: 2.2, cd: 1.0,
    weapon: 'sword', shield: 'kite', helmet: 'crown', body: 'plate', scale: 1.12, cape: true, kind: 'hero', structMult: 1.2 },

  raider: { name: 'Raider', hp: 75, dmg: 10, armor: 1, speed: 4.3, range: 1.9, cd: 1.2,
    weapon: 'axe', shield: 'round', helmet: 'none', body: 'leather', kind: 'infantry' },
  raiderArcher: { name: 'Raider Archer', hp: 55, dmg: 9, armor: 0, speed: 4.4, range: 38, cd: 2.6,
    weapon: 'bow', helmet: 'hood', body: 'leather', kind: 'archer', ranged: true },
  raiderRider: { name: 'Raider Rider', hp: 150, dmg: 15, armor: 2, speed: 8.2, range: 2.5, cd: 1.4,
    weapon: 'axe', shield: 'round', helmet: 'none', body: 'leather', kind: 'cavalry', mounted: true },
  shaman: { name: 'Raider Shaman', hp: 70, dmg: 26, armor: 0, speed: 4.2, range: 34, cd: 3.4,
    weapon: 'staff', helmet: 'hood', body: 'fur', kind: 'archer', ranged: true, spell: 'fireball' },
  giant: { name: 'Giant', hp: 3200, dmg: 90, armor: 6, speed: 3.4, range: 4.4, cd: 2.6,
    weapon: 'club', helmet: 'none', body: 'fur', scale: 3.2, kind: 'giant', giant: true, structMult: 4, siegeBonus: 2.5 },
  brute: { name: 'Brute', hp: 260, dmg: 22, armor: 4, speed: 3.8, range: 2.4, cd: 1.6,
    weapon: 'greataxe', helmet: 'horned', body: 'fur', scale: 1.25, kind: 'infantry', siegeBonus: 1.5, structMult: 1.5 },
  warlord: { name: 'Raider Warlord', hp: 1000, dmg: 36, armor: 8, speed: 4.2, range: 2.6, cd: 1.3,
    weapon: 'greataxe', helmet: 'horned', body: 'plate', scale: 1.4, cape: true, kind: 'hero', boss: true, siegeBonus: 2, structMult: 2.5 },
};

export const SIEGE_TYPES = {
  ram: { name: 'Battering Ram', hp: 700, speed: 2.6, dmg: 110, cd: 2.6, cost: 400 },
  catapult: { name: 'Catapult', hp: 450, speed: 2.0, dmg: 140, cd: 6.5, cost: 750, range: 62 },
};

export const PLAYER = {
  hp: 220,
  armor: 4,
  speed: 5.2,
  sprint: 8.4,
  jump: 7.5,
  swordDmg: 34,
  bowDmg: 30,
  arrows: 30,
  maxArrows: 60,
  block: 0.75,
  respawnBase: 12,
  respawnPerDeath: 6,
};

export const TROOP_CAP = { start: 12, step: 6, max: 36 };

// Formations for your troops when they follow you or hold a position.
export const FORMATIONS = {
  line: { name: 'Line', cols: 8, sx: 1.7, sz: 1.9 },
  shieldwall: { name: 'Shield Wall', cols: 10, sx: 1.05, sz: 1.3 },
  loose: { name: 'Loose', cols: 6, sx: 3.4, sz: 3.4 },
};

// Troop experience: XP needed for ranks 2..5, and what each rank adds.
export const RANKS = { xp: [0, 30, 80, 160, 300], hp: 0.12, dmg: 0.1, armor: 1, promoteAt: 4 };
export const PROMOTIONS = { swordsman: 'knight', spearman: 'knight', pikeman: 'knight', archer: 'longbowman', crossbowman: 'longbowman', horseman: 'lancer' };

// Skyrim-style spells: they fly straight where you aim and are blocked by walls and hills.
export const SPELLS = {
  fireball: { name: 'Fireball', cost: 30, dmg: 55, radius: 3.6, speed: 38, charge: 0.8, color: 0xff7a1a, price: 350,
    desc: 'Hold to charge, release to hurl a fireball that explodes on impact.' },
  lightning: { name: 'Chain Lightning', cost: 25, dmg: 42, range: 46, chain: 2, chainRange: 9, cd: 0.6, color: 0x9fd8ff, price: 500,
    desc: 'An instant bolt to whatever you aim at that jumps to two more enemies in sight.' },
  ice: { name: 'Ice Spike', cost: 20, dmg: 45, speed: 55, pierce: 3, slow: 3, color: 0xbfe8ff, price: 400,
    desc: 'A fast shard that pierces up to three enemies and slows them.' },
};
export const MANA = { base: 100, perLevel: 25, regen: 7, regenPerLevel: 0.4, delay: 1.4 };

// ---------------------------------------------------------------- hero classes
// Every hero (you, other players, the enemy lord) picks one of these before the battle.
// melee.time is the whole swing: small weapons are quick and light, big weapons slow and heavy.
// Each class has a shout on R: a buff for nearby allies, a curse on nearby enemies, or a spell.
export const CLASSES = {
  knight: {
    name: 'Knight', role: 'Two-handed greatsword. Slow, crushing blows that cleave through crowds.',
    hp: 300, armor: 7, speed: 4.9, stats: { hp: 5, dmg: 5, speed: 2, range: 2 },
    melee: { weapon: 'greatsword', dmg: 64, time: 1.0, reach: 2.6, cone: 0.25, targets: 3, stamina: 10, heavy: true },
    block: 0.55,
    look: { weapon: 'greatsword', helmet: 'great', body: 'plate' },
    ai: { dmg: 46, cd: 1.5, range: 2.5 },
    shout: { id: 'rally', name: 'Rallying Cry', cd: 30, radius: 16, dur: 10, color: 0xffb030,
      desc: 'You and every ally within 16 m deal +30% damage for 10 s.' },
  },
  manatarms: {
    name: 'Man-at-Arms', role: 'Arming sword and kite shield. Fast, light cuts and the best block.',
    hp: 250, armor: 5, speed: 5.3, stats: { hp: 4, dmg: 3, speed: 4, range: 2 },
    melee: { weapon: 'sword', dmg: 21, time: 0.42, reach: 2.0, cone: 0.4, targets: 2, stamina: 4 },
    block: 0.85,
    look: { weapon: 'sword', shield: 'kite', helmet: 'nasal', body: 'mail' },
    ai: { dmg: 22, cd: 0.7, range: 2.1 },
    shout: { id: 'shieldwall', name: 'Shield Wall', cd: 28, radius: 14, dur: 8, color: 0x5ab0ff,
      desc: 'You and every ally within 14 m take 35% less damage for 8 s.' },
  },
  pikeman: {
    name: 'Pikeman', role: 'A five-metre pike. Out-reaches everyone and skewers two at once.',
    hp: 230, armor: 4, speed: 5.0, stats: { hp: 4, dmg: 4, speed: 3, range: 4 },
    melee: { weapon: 'pike', dmg: 38, time: 0.85, reach: 4.4, cone: 0.88, targets: 2, stamina: 6, thrust: true },
    block: 0.4,
    look: { weapon: 'pike', helmet: 'kettle', body: 'gambeson' },
    ai: { dmg: 34, cd: 1.3, range: 4.0 },
    shout: { id: 'brace', name: 'Hold the Line', cd: 26, radius: 14, dur: 10, color: 0xc0c8d8,
      desc: 'You and every ally within 14 m gain +5 armour and cannot be knocked back for 10 s.' },
  },
  spearman: {
    name: 'Spearman', role: 'Spear and round shield. Quick thrusts with good reach.',
    hp: 240, armor: 4, speed: 5.4, stats: { hp: 4, dmg: 3, speed: 4, range: 3 },
    melee: { weapon: 'spear', dmg: 27, time: 0.58, reach: 3.1, cone: 0.8, targets: 1, stamina: 4, thrust: true },
    block: 0.72,
    look: { weapon: 'spear', shield: 'round', helmet: 'nasal', body: 'mail' },
    ai: { dmg: 26, cd: 0.9, range: 3.0 },
    shout: { id: 'charge', name: 'Charge!', cd: 24, radius: 16, dur: 8, color: 0xff6040,
      desc: 'You and every ally within 16 m run 35% faster and hit 15% harder for 8 s.' },
  },
  bowman: {
    name: 'Bowman', role: 'Longbow for quick, accurate arrows. A dagger for close work.',
    hp: 180, armor: 2, speed: 5.5, stats: { hp: 2, dmg: 3, speed: 5, range: 5 },
    melee: { weapon: 'dagger', dmg: 12, time: 0.32, reach: 1.8, cone: 0.45, targets: 1, stamina: 3 },
    ranged: { kind: 'bow', dmg: 34, draw: 0.7, ammo: 60 },
    block: 0.3,
    look: { weapon: 'bow', helmet: 'hood', body: 'gambeson' },
    ai: { dmg: 26, cd: 1.6, range: 44 },
    shout: { id: 'volley', name: 'Volley!', cd: 25, radius: 20, dur: 10, color: 0x9be070,
      desc: 'You and every ally within 20 m deal +40% ranged damage for 10 s.' },
  },
  crossbowman: {
    name: 'Crossbowman', role: 'Crossbow bolts hit like a hammer, but reloading takes time.',
    hp: 200, armor: 4, speed: 5.0, stats: { hp: 3, dmg: 5, speed: 3, range: 5 },
    melee: { weapon: 'dagger', dmg: 12, time: 0.32, reach: 1.8, cone: 0.45, targets: 1, stamina: 3 },
    ranged: { kind: 'crossbow', dmg: 78, reload: 1.7, ammo: 40 },
    block: 0.3,
    look: { weapon: 'crossbow', helmet: 'kettle', body: 'mail' },
    ai: { dmg: 48, cd: 2.8, range: 48 },
    shout: { id: 'mark', name: 'Mark Target', cd: 16, radius: 34, dur: 8, color: 0xff3030,
      desc: 'The enemy under your crosshair (or the nearest one) takes +40% damage from everyone for 8 s.' },
  },
  priest: {
    name: 'Priest', role: 'Healer and buffer. Right click heals everyone near you. Swings a mace.',
    hp: 210, armor: 3, speed: 5.3, stats: { hp: 3, dmg: 2, speed: 4, range: 2 },
    melee: { weapon: 'mace', dmg: 22, time: 0.55, reach: 2.0, cone: 0.45, targets: 2, stamina: 4 },
    heal: { amount: 45, radius: 11, mana: 24, cd: 1.2 },
    mana: true, block: 0.4,
    look: { weapon: 'mace', helmet: 'mitre', body: 'robeWhite' },
    ai: { dmg: 22, cd: 0.9, range: 2.1 },
    shout: { id: 'bless', name: 'Blessing', cd: 22, radius: 16, dur: 10, color: 0xfff0a0,
      desc: 'Heals you and every ally within 16 m for 60 and gives them +20% damage for 10 s.' },
  },
  witch: {
    name: 'Witch', role: 'Hex bolts curse enemies so they deal less damage and take more.',
    hp: 180, armor: 2, speed: 5.4, stats: { hp: 2, dmg: 3, speed: 5, range: 4 },
    hex: { dmg: 20, time: 0.55, speed: 36, mana: 10 },
    mana: true, block: 0,
    look: { weapon: 'witchstaff', helmet: 'witchhat', body: 'robePurple' },
    ai: { dmg: 24, cd: 1.4, range: 32 },
    shout: { id: 'curse', name: 'Curse of Weakness', cd: 24, radius: 16, dur: 10, color: 0xb040ff,
      desc: 'Every enemy within 16 m deals 40% less damage and takes 15% more for 10 s.' },
  },
  wizard: {
    name: 'Wizard', role: 'Fireballs, chain lightning and ice. Huge area damage. Only one per battle.',
    hp: 170, armor: 1, speed: 5.2, stats: { hp: 2, dmg: 5, speed: 3, range: 5 }, unique: true,
    spells: ['fireball', 'lightning', 'ice'],
    mana: true, block: 0,
    look: { weapon: 'wizardstaff', helmet: 'wizardhat', body: 'robeBlue' },
    ai: { dmg: 60, cd: 2.6, range: 36 },
    shout: { id: 'meteor', name: 'Meteor', cd: 30, radius: 9, dmg: 170, color: 0xff5a10,
      desc: 'Call a meteor down where you aim: 170 damage in a 9 m blast.' },
  },
};
export const CLASS_IDS = Object.keys(CLASSES);
export const DEFAULT_CLASS = 'manatarms';

// The witch's curse bolt, alongside the wizard's spells.
SPELLS.hex = { name: 'Hex Bolt', cost: 10, dmg: 20, speed: 36, color: 0xb040ff, weak: 0.3, vuln: 0.15, dur: 6, desc: '' };

// Each class also exists as a soldier type, so AI lords and other people's heroes look the part.
for (const [id, c] of Object.entries(CLASSES)) {
  const ranged = !!(c.ranged || c.hex || c.spells);
  UNIT_TYPES['hero_' + id] = {
    name: c.name, hp: Math.round(c.hp * 1.35), dmg: c.ai.dmg, armor: c.armor + 2, speed: 5.0, range: c.ai.range, cd: c.ai.cd,
    weapon: c.look.weapon, shield: c.look.shield, helmet: c.look.helmet, body: c.look.body, scale: 1.1, cape: true,
    kind: 'hero', structMult: 1.2, ranged, spell: c.spells ? 'fireball' : c.hex ? 'hex' : undefined, heroClass: id,
  };
}
