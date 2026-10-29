// All the numbers and names for Aeternum Wilds live here.

export const MAX_LEVEL = 30;
export const MAX_MASTERY = 20;
export const MAX_TRADE = 40;

export const xpForLevel = lv => Math.round(60 * Math.pow(lv, 1.3) + 60);
export const xpForMastery = lv => Math.round(40 * Math.pow(lv, 1.3) + 40);
export const xpForTrade = lv => 30 + 15 * lv;
export const killXp = lv => 15 + 9 * lv;

export const RARITY = [
  { name: 'Common', color: '#c9c4b8', perks: 0, gs: 0 },
  { name: 'Uncommon', color: '#62d36b', perks: 1, gs: 10 },
  { name: 'Rare', color: '#4ea6ff', perks: 2, gs: 20 },
  { name: 'Epic', color: '#c66dff', perks: 3, gs: 35 },
  { name: 'Legendary', color: '#ff9b30', perks: 4, gs: 50 },
];

export const ATTRS = ['str', 'dex', 'int', 'con'];
export const ATTR_INFO = {
  str: { name: 'Strength', desc: 'Great Axe and War Hammer damage. Half of Sword damage.' },
  dex: { name: 'Dexterity', desc: 'Bow damage. Half of Sword damage. Adds critical chance.' },
  int: { name: 'Intelligence', desc: 'Ability damage and shorter ability cooldowns.' },
  con: { name: 'Constitution', desc: 'Maximum health and a little armor.' },
};

// Weapon types. dmg is light-attack damage at gear score 100.
export const WEAPONS = {
  sword: {
    name: 'Sword & Shield', short: 'Sword', icon: '⚔️', scale: { str: 0.5, dex: 0.5 },
    dmg: 20, block: 1.0, blockCost: 0.5,
    light: { time: 0.42, hit: 0.45, range: 2.7, arc: 110, mult: 1.0, combo: 3 },
    heavy: { time: 0.6, hit: 0.5, range: 3.1, arc: 60, mult: 1.9, kind: 'thrust', lunge: 2.2, stagger: true },
    tiers: ['Iron Sword', 'Starmetal Sword', 'Orichalcum Sword'],
  },
  greataxe: {
    name: 'Great Axe', short: 'Axe', icon: '🪓', scale: { str: 1.0 },
    dmg: 30, block: 0.6, blockCost: 0.8,
    light: { time: 0.62, hit: 0.5, range: 3.2, arc: 150, mult: 1.0, combo: 2 },
    heavy: { time: 0.8, hit: 0.55, range: 3.4, arc: 360, mult: 1.6, kind: 'spin', stagger: true },
    tiers: ['Iron Great Axe', 'Starmetal Great Axe', 'Orichalcum Great Axe'],
  },
  hammer: {
    name: 'War Hammer', short: 'Hammer', icon: '🔨', scale: { str: 1.0 },
    dmg: 37, block: 0.7, blockCost: 0.7,
    light: { time: 0.74, hit: 0.55, range: 3.0, arc: 100, mult: 1.0, combo: 2 },
    heavy: { time: 0.95, hit: 0.6, range: 3.0, arc: 360, mult: 1.9, kind: 'slam', radius: 3.0, fwd: 1.6, stun: 0.7 },
    tiers: ['Iron War Hammer', 'Starmetal War Hammer', 'Orichalcum War Hammer'],
  },
  bow: {
    name: 'Bow', short: 'Bow', icon: '🏹', scale: { dex: 1.0 },
    dmg: 34, block: 0, blockCost: 1,
    draw: 0.8, speed: 42, range: 34,
    tiers: ['Ash Bow', 'Aged Yew Bow', 'Wyrdwood Bow'],
  },
};
export const WEAPON_TYPES = Object.keys(WEAPONS);

// Ability kinds: dash, leap, aoe, cone, buff, proj, evade
export const ABILITIES = {
  // Sword
  whirl: { name: 'Whirling Blade', icon: '🌀', cd: 10, kind: 'dash', dist: 6.5, radius: 2.4, dmg: 1.4, desc: 'Spin forward, slicing everything in your path.' },
  shieldRush: { name: 'Shield Rush', icon: '🛡️', cd: 14, kind: 'dash', dist: 7.5, radius: 2, dmg: 0.8, stun: 1.6, desc: 'Charge with your shield up, stunning enemies you hit.' },
  defiant: { name: 'Defiant Stance', icon: '🏰', cd: 22, kind: 'buff', dur: 6, buff: { dr: 0.5 }, desc: 'Take 50% less damage for 6 seconds.' },
  leap: { name: 'Leaping Strike', icon: '⤴️', cd: 12, kind: 'leap', max: 10, radius: 3.2, dmg: 1.6, desc: 'Leap at the cursor and crash down on the enemies there.' },
  // Great Axe
  charge: { name: 'Charge', icon: '🐂', cd: 12, kind: 'dash', dist: 9, radius: 2.2, dmg: 1.1, knock: 4, desc: 'Barrel forward, knocking enemies aside.' },
  gravity: { name: 'Gravity Well', icon: '🌑', cd: 16, kind: 'aoe', at: 'cursor', max: 9, delay: 0.8, radius: 5, dmg: 1.3, pull: true, desc: 'A vortex at the cursor drags enemies together, then bursts.' },
  reap: { name: 'Reap', icon: '🌾', cd: 12, kind: 'cone', range: 7, arc: 100, dmg: 1.2, pullIn: true, heal: 0.25, desc: 'Hook enemies in front of you toward you. Heals for 25% of damage dealt.' },
  berserk: { name: 'Berserk', icon: '😡', cd: 25, kind: 'buff', dur: 9, buff: { dmg: 0.3, atkSpeed: 0.2 }, heal: 0.15, desc: 'Heal 15%, then deal 30% more damage and attack 20% faster for 9 seconds.' },
  // War Hammer
  shockwave: { name: 'Shockwave', icon: '💥', cd: 14, kind: 'aoe', at: 'self', delay: 0.15, radius: 4.8, dmg: 1.0, stun: 1.8, desc: 'Pound the ground, stunning everything around you.' },
  destiny: { name: 'Path of Destiny', icon: '⚡', cd: 15, kind: 'line', range: 11, width: 2.4, dmg: 1.7, knock: 3, desc: 'A long ground-splitting strike that throws enemies back.' },
  wrecking: { name: 'Wrecking Ball', icon: '🔴', cd: 10, kind: 'aoe', at: 'front', fwd: 2.6, delay: 0.25, radius: 3, dmg: 2.2, desc: 'A huge overhead blow in front of you.' },
  clearMind: { name: 'Clear Mind', icon: '🧘', cd: 24, kind: 'buff', dur: 6, buff: { dr: 0.35, stamRegen: 1.0 }, heal: 0.2, cleanse: true, desc: 'Remove slows and poison, heal 20%, take 35% less damage for 6 seconds.' },
  // Bow
  rain: { name: 'Rain of Arrows', icon: '🌧️', cd: 14, kind: 'aoe', at: 'cursor', max: 18, delay: 0.7, radius: 4.2, dmg: 1.5, slow: 3, desc: 'Arrows fall on the cursor, slowing what survives.' },
  evade: { name: 'Evade Shot', icon: '↩️', cd: 10, kind: 'evade', dist: 6, dmg: 1.2, desc: 'Leap backward and loose an arrow.' },
  poison: { name: 'Poison Shot', icon: '🐍', cd: 12, kind: 'proj', dmg: 0.7, dot: 1.8, dotDur: 6, desc: 'An arrow that poisons for heavy damage over 6 seconds.' },
  pierce: { name: 'Penetrating Shot', icon: '➶', cd: 16, kind: 'proj', dmg: 2.2, pierce: true, speed: 70, desc: 'A powerful arrow that passes through every enemy in a line.' },
};

// Mastery trees: 4 rows x 3 nodes. Row r needs r*3 points spent in the tree.
export const MASTERY = {
  sword: [
    { id: 'whirl', row: 0 }, { id: 'sw_edge', row: 0, name: 'Sharpened Edge', icon: '🗡️', desc: '+12% light attack damage', mods: { lightDmg: 0.12 } }, { id: 'shieldRush', row: 0 },
    { id: 'sw_guard', row: 1, name: 'Stalwart Guard', icon: '🛡️', desc: 'Blocking costs 40% less stamina', mods: { blockCost: -0.4 } }, { id: 'defiant', row: 1 }, { id: 'sw_heavy', row: 1, name: 'Pommel Strike', icon: '👊', desc: '+25% heavy attack damage', mods: { heavyDmg: 0.25 } },
    { id: 'sw_wind', row: 2, name: 'Second Wind', icon: '💚', desc: 'Heal 4% of max health on each kill', mods: { killHeal: 0.04 } }, { id: 'leap', row: 2 }, { id: 'sw_crit', row: 2, name: 'Precision', icon: '🎯', desc: '+8% critical chance', mods: { crit: 8 } },
    { id: 'sw_rhythm', row: 3, name: 'Battle Rhythm', icon: '⏱️', desc: '-15% ability cooldowns', mods: { cdr: 0.15 } }, { id: 'sw_champ', row: 3, name: 'Champion', icon: '👑', desc: '+15% damage while above 70% health', mods: { highHpDmg: 0.15 } }, { id: 'sw_iron', row: 3, name: 'Ironhide', icon: '🧱', desc: 'Take 10% less damage', mods: { dr: 0.1 } },
  ],
  greataxe: [
    { id: 'charge', row: 0 }, { id: 'ax_bite', row: 0, name: 'Biting Edge', icon: '🪓', desc: '+12% light attack damage', mods: { lightDmg: 0.12 } }, { id: 'reap', row: 0 },
    { id: 'ax_blood', row: 1, name: 'Bloodlust', icon: '🩸', desc: '3% lifesteal', mods: { lifesteal: 3 } }, { id: 'gravity', row: 1 }, { id: 'ax_spin', row: 1, name: 'Whirlwind', icon: '🌪️', desc: '+30% heavy attack damage', mods: { heavyDmg: 0.3 } },
    { id: 'ax_feral', row: 2, name: 'Feral Rage', icon: '🔥', desc: '+25% damage while below 50% health', mods: { lowHpDmg: 0.25 } }, { id: 'berserk', row: 2 }, { id: 'ax_speed', row: 2, name: 'Momentum', icon: '💨', desc: '+12% attack speed', mods: { atkSpeed: 0.12 } },
    { id: 'ax_exec', row: 3, name: 'Executioner', icon: '💀', desc: '+30% damage to enemies below 30% health', mods: { execDmg: 0.3 } }, { id: 'ax_hunger', row: 3, name: 'Insatiable', icon: '🍖', desc: 'Heal 5% of max health on each kill', mods: { killHeal: 0.05 } }, { id: 'ax_cdr', row: 3, name: 'Relentless', icon: '⏱️', desc: '-15% ability cooldowns', mods: { cdr: 0.15 } },
  ],
  hammer: [
    { id: 'shockwave', row: 0 }, { id: 'hm_weight', row: 0, name: 'Heavy Head', icon: '🔨', desc: '+12% light attack damage', mods: { lightDmg: 0.12 } }, { id: 'wrecking', row: 0 },
    { id: 'hm_stun', row: 1, name: 'Concussion', icon: '💫', desc: 'Stuns last 40% longer', mods: { stunDur: 0.4 } }, { id: 'destiny', row: 1 }, { id: 'hm_slam', row: 1, name: 'Earthbreaker', icon: '🌋', desc: '+30% heavy attack damage', mods: { heavyDmg: 0.3 } },
    { id: 'hm_armor', row: 2, name: 'Plated', icon: '🧱', desc: 'Take 12% less damage', mods: { dr: 0.12 } }, { id: 'clearMind', row: 2 }, { id: 'hm_daze', row: 2, name: 'Opportunist', icon: '🎯', desc: '+30% damage to stunned enemies', mods: { stunnedDmg: 0.3 } },
    { id: 'hm_cdr', row: 3, name: 'Unstoppable', icon: '⏱️', desc: '-15% ability cooldowns', mods: { cdr: 0.15 } }, { id: 'hm_abil', row: 3, name: 'Seismic', icon: '🗻', desc: '+20% ability damage', mods: { abilityDmg: 0.2 } }, { id: 'hm_life', row: 3, name: 'Vigor', icon: '💚', desc: 'Heal 4% of max health on each kill', mods: { killHeal: 0.04 } },
  ],
  bow: [
    { id: 'rain', row: 0 }, { id: 'bw_draw', row: 0, name: 'Quick Draw', icon: '🏹', desc: 'Draw 25% faster', mods: { drawSpeed: 0.25 } }, { id: 'evade', row: 0 },
    { id: 'bw_crit', row: 1, name: 'Eagle Eye', icon: '🦅', desc: '+10% critical chance', mods: { crit: 10 } }, { id: 'poison', row: 1 }, { id: 'bw_far', row: 1, name: 'Long Shot', icon: '📏', desc: '+20% damage to enemies more than 12m away', mods: { farDmg: 0.2 } },
    { id: 'bw_feet', row: 2, name: 'Light Feet', icon: '👣', desc: '+10% move speed, dodges cost 30% less stamina', mods: { moveSpeed: 0.1, dodgeCost: -0.3 } }, { id: 'pierce', row: 2 }, { id: 'bw_full', row: 2, name: 'Heartseeker', icon: '❤️‍🔥', desc: 'Fully drawn shots deal +20%', mods: { fullDraw: 0.2 } },
    { id: 'bw_cdr', row: 3, name: 'Volley Master', icon: '⏱️', desc: '-15% ability cooldowns', mods: { cdr: 0.15 } }, { id: 'bw_abil', row: 3, name: 'Hunter', icon: '🐺', desc: '+20% ability damage', mods: { abilityDmg: 0.2 } }, { id: 'bw_crits', row: 3, name: 'Deadeye', icon: '☠️', desc: 'Critical hits deal +30% more', mods: { critDmg: 0.3 } },
  ],
};

// ---- Gear ----
export const ARMOR_SLOTS = ['head', 'chest', 'hands', 'legs', 'feet'];
export const SLOT_NAMES = { w1: 'Weapon 1', w2: 'Weapon 2', head: 'Head', chest: 'Chest', hands: 'Hands', legs: 'Legs', feet: 'Feet', amulet: 'Amulet' };
export const SLOT_ICONS = { head: '⛑️', chest: '🥋', hands: '🧤', legs: '👖', feet: '🥾', amulet: '📿' };
export const ARMOR_WEIGHT = { head: 0.15, chest: 0.3, hands: 0.15, legs: 0.25, feet: 0.15 };
export const ARMOR_NAMES = {
  head: ['Hide Hood', 'Starmetal Helm', 'Orichalcum Helm'],
  chest: ['Hide Jerkin', 'Starmetal Breastplate', 'Orichalcum Breastplate'],
  hands: ['Hide Gloves', 'Starmetal Gauntlets', 'Orichalcum Gauntlets'],
  legs: ['Hide Leggings', 'Starmetal Greaves', 'Orichalcum Greaves'],
  feet: ['Hide Boots', 'Starmetal Sabatons', 'Orichalcum Sabatons'],
  amulet: ['Copper Amulet', 'Silver Amulet', 'Gold Amulet'],
};

// Perks; v(gs) gives the rolled value
export const PERKS = {
  str: { text: v => `+${v} Strength`, prefix: 'Mighty', v: gs => Math.round(2 + gs / 70), any: true },
  dex: { text: v => `+${v} Dexterity`, prefix: 'Nimble', v: gs => Math.round(2 + gs / 70), any: true },
  int: { text: v => `+${v} Intelligence`, prefix: 'Arcane', v: gs => Math.round(2 + gs / 70), any: true },
  con: { text: v => `+${v} Constitution`, prefix: 'Stout', v: gs => Math.round(2 + gs / 70), any: true },
  crit: { text: v => `+${v}% Critical Chance`, prefix: 'Keen', v: gs => Math.round(3 + gs / 150), weapon: true, amulet: true },
  lifesteal: { text: v => `${v}% Lifesteal`, prefix: 'Vampiric', v: gs => Math.round(2 + gs / 200), weapon: true },
  heavy: { text: v => `+${v}% Heavy Attack Damage`, prefix: 'Brutal', v: gs => Math.round(8 + gs / 50), weapon: true },
  corrupt: { text: v => `+${v}% Damage vs Corrupted`, prefix: 'Purifying', v: gs => Math.round(8 + gs / 40), weapon: true, amulet: true },
  beast: { text: v => `+${v}% Damage vs Beasts`, prefix: 'Hunting', v: gs => Math.round(8 + gs / 40), weapon: true },
  stamregen: { text: v => `+${v}% Stamina Regen`, prefix: 'Tireless', v: gs => Math.round(8 + gs / 40), armor: true, amulet: true },
  speed: { text: v => `+${v}% Move Speed`, prefix: 'Swift', v: gs => Math.round(2 + gs / 150), feet: true, legs: true },
  armor: { text: v => `+${v}% Armor`, prefix: 'Fortified', v: gs => Math.round(8 + gs / 40), armor: true },
  gather: { text: v => `+${v}% Gathering Speed`, prefix: 'Industrious', v: gs => Math.round(10 + gs / 30), hands: true, amulet: true },
  cdr: { text: v => `-${v}% Ability Cooldowns`, prefix: 'Refreshing', v: gs => Math.round(3 + gs / 120), weapon: true, amulet: true, head: true },
  xp: { text: v => `+${v}% Experience`, prefix: 'Wise', v: gs => Math.round(4 + gs / 80), amulet: true, head: true },
  regen: { text: v => `+${v} Health per second`, prefix: 'Mending', v: gs => Math.round(1 + gs / 80), armor: true, amulet: true },
};

// ---- Materials and consumables (stackable) ----
export const MATS = {
  green_wood: { name: 'Green Wood', icon: '🪵', tier: 1 },
  aged_wood: { name: 'Aged Wood', icon: '🪵', tier: 2 },
  wyrdwood: { name: 'Wyrdwood', icon: '🪵', tier: 3 },
  iron_ore: { name: 'Iron Ore', icon: '🪨', tier: 1 },
  starmetal_ore: { name: 'Starmetal Ore', icon: '💠', tier: 2 },
  orichalcum_ore: { name: 'Orichalcum Ore', icon: '🔶', tier: 3 },
  fibers: { name: 'Fibers', icon: '🌿', tier: 1 },
  silkweed: { name: 'Silkweed', icon: '🌱', tier: 2 },
  herbs: { name: 'Herbs', icon: '🌼', tier: 1 },
  rawhide: { name: 'Rawhide', icon: '🟫', tier: 1 },
  thick_hide: { name: 'Thick Hide', icon: '🟤', tier: 2 },
  raw_meat: { name: 'Raw Meat', icon: '🥩', tier: 1 },
  bone: { name: 'Bone Shards', icon: '🦴', tier: 1 },
  shard: { name: 'Corruption Shard', icon: '🔻', tier: 3 },
  timber: { name: 'Timber', icon: '🟫', tier: 1, refined: true },
  lumber: { name: 'Lumber', icon: '🟫', tier: 2, refined: true },
  wyrd_planks: { name: 'Wyrdwood Planks', icon: '🟫', tier: 3, refined: true },
  iron_ingot: { name: 'Iron Ingot', icon: '🧈', tier: 1, refined: true },
  starmetal_ingot: { name: 'Starmetal Ingot', icon: '🧈', tier: 2, refined: true },
  orichalcum_ingot: { name: 'Orichalcum Ingot', icon: '🧈', tier: 3, refined: true },
  linen: { name: 'Linen', icon: '🧵', tier: 1, refined: true },
  silk: { name: 'Silk', icon: '🧵', tier: 2, refined: true },
  leather: { name: 'Leather', icon: '🧶', tier: 1, refined: true },
  layered_leather: { name: 'Layered Leather', icon: '🧶', tier: 2, refined: true },
  potion: { name: 'Health Potion', icon: '🧪', use: 'potion', desc: 'Restores 40% of your health. Key 3.', price: 12 },
  big_potion: { name: 'Strong Health Potion', icon: '⚗️', use: 'potion', strength: 0.7, desc: 'Restores 70% of your health. Key 3 (used before plain potions).', price: 40 },
  cooked_meat: { name: 'Roast Meat', icon: '🍗', use: 'food', regen: 3, dur: 300, desc: '+3 health per second for 5 minutes. Key 4.', price: 8 },
  stew: { name: 'Hunter\'s Stew', icon: '🍲', use: 'food', regen: 6, con: 5, dur: 600, desc: '+6 health per second and +5 Constitution for 10 minutes. Key 4.', price: 30 },
  feast: { name: 'Warden\'s Feast', icon: '🥘', use: 'food', regen: 10, con: 10, str: 5, dex: 5, dur: 900, desc: '+10 health per second, +10 Constitution, +5 Strength and Dexterity for 15 minutes. Key 4.' },
};

// ---- Gathering nodes ----
// skill, required level, yields
export const NODES = {
  tree: { name: 'Green Wood Tree', skill: 'logging', req: 0, time: 3, xp: 18, yields: [['green_wood', 3, 5]], verb: 'Chop' },
  aged_tree: { name: 'Aged Tree', skill: 'logging', req: 8, time: 3.6, xp: 34, yields: [['aged_wood', 2, 4], ['green_wood', 1, 2]], verb: 'Chop' },
  wyrd_tree: { name: 'Wyrdwood Tree', skill: 'logging', req: 18, time: 4.2, xp: 55, yields: [['wyrdwood', 2, 4], ['aged_wood', 1, 2]], verb: 'Chop' },
  iron: { name: 'Iron Vein', skill: 'mining', req: 0, time: 3, xp: 18, yields: [['iron_ore', 3, 5]], verb: 'Mine' },
  starmetal: { name: 'Starmetal Vein', skill: 'mining', req: 8, time: 3.6, xp: 34, yields: [['starmetal_ore', 2, 4], ['iron_ore', 1, 2]], verb: 'Mine' },
  orichalcum: { name: 'Orichalcum Vein', skill: 'mining', req: 18, time: 4.2, xp: 55, yields: [['orichalcum_ore', 2, 4], ['starmetal_ore', 1, 2]], verb: 'Mine' },
  hemp: { name: 'Hemp', skill: 'harvesting', req: 0, time: 2, xp: 14, yields: [['fibers', 2, 4], ['herbs', 0, 2]], verb: 'Harvest' },
  silkweed: { name: 'Silkweed', skill: 'harvesting', req: 8, time: 2.5, xp: 28, yields: [['silkweed', 2, 3], ['herbs', 1, 2]], verb: 'Harvest' },
};

export const TRADES = {
  logging: { name: 'Logging', icon: '🪓' },
  mining: { name: 'Mining', icon: '⛏️' },
  harvesting: { name: 'Harvesting', icon: '🌾' },
  skinning: { name: 'Skinning', icon: '🔪' },
  smithing: { name: 'Smithing', icon: '⚒️' },
  cooking: { name: 'Cooking', icon: '🍳' },
};

// ---- Recipes ----
// station: refinery | forge | kitchen. out: material id, or {gear: 'weapon'|'armor', ...}
export const RECIPES = [
  // Refinery
  { id: 'r_timber', station: 'refinery', out: 'timber', n: 1, in: { green_wood: 4 }, skill: 'smithing', req: 0, xp: 6 },
  { id: 'r_lumber', station: 'refinery', out: 'lumber', n: 1, in: { aged_wood: 4, timber: 1 }, skill: 'smithing', req: 8, xp: 12 },
  { id: 'r_wyrd', station: 'refinery', out: 'wyrd_planks', n: 1, in: { wyrdwood: 4, lumber: 1 }, skill: 'smithing', req: 18, xp: 20 },
  { id: 'r_iron', station: 'refinery', out: 'iron_ingot', n: 1, in: { iron_ore: 4 }, skill: 'smithing', req: 0, xp: 6 },
  { id: 'r_star', station: 'refinery', out: 'starmetal_ingot', n: 1, in: { starmetal_ore: 4, iron_ingot: 1 }, skill: 'smithing', req: 8, xp: 12 },
  { id: 'r_ori', station: 'refinery', out: 'orichalcum_ingot', n: 1, in: { orichalcum_ore: 4, starmetal_ingot: 1 }, skill: 'smithing', req: 18, xp: 20 },
  { id: 'r_linen', station: 'refinery', out: 'linen', n: 1, in: { fibers: 4 }, skill: 'smithing', req: 0, xp: 5 },
  { id: 'r_silk', station: 'refinery', out: 'silk', n: 1, in: { silkweed: 4, linen: 1 }, skill: 'smithing', req: 8, xp: 10 },
  { id: 'r_leather', station: 'refinery', out: 'leather', n: 1, in: { rawhide: 4 }, skill: 'smithing', req: 0, xp: 5 },
  { id: 'r_layered', station: 'refinery', out: 'layered_leather', n: 1, in: { thick_hide: 4, leather: 1 }, skill: 'smithing', req: 8, xp: 10 },
  // Forge: weapons (tier 1..3) and armor
  ...[1, 2, 3].flatMap(t => {
    const ingot = ['iron_ingot', 'starmetal_ingot', 'orichalcum_ingot'][t - 1];
    const wood = ['timber', 'lumber', 'wyrd_planks'][t - 1];
    const leather = ['leather', 'layered_leather', 'layered_leather'][t - 1];
    const cloth = ['linen', 'silk', 'silk'][t - 1];
    const req = [0, 8, 18][t - 1];
    const extra = t === 3 ? { shard: 3 } : {};
    const n = [1, 1.5, 2][t - 1];
    const q = k => Math.round(k * n);
    const out = [
      { id: `f_sword${t}`, station: 'forge', gear: 'weapon', wtype: 'sword', tier: t, in: { [ingot]: q(4), [wood]: q(1), [leather]: 1, ...extra }, skill: 'smithing', req, xp: 30 * t },
      { id: `f_axe${t}`, station: 'forge', gear: 'weapon', wtype: 'greataxe', tier: t, in: { [ingot]: q(5), [wood]: q(2), ...extra }, skill: 'smithing', req, xp: 30 * t },
      { id: `f_hammer${t}`, station: 'forge', gear: 'weapon', wtype: 'hammer', tier: t, in: { [ingot]: q(6), [wood]: q(2), ...extra }, skill: 'smithing', req, xp: 30 * t },
      { id: `f_bow${t}`, station: 'forge', gear: 'weapon', wtype: 'bow', tier: t, in: { [wood]: q(5), [cloth]: q(2), [leather]: 1, ...extra }, skill: 'smithing', req, xp: 30 * t },
    ];
    for (const s of ARMOR_SLOTS) {
      const big = s === 'chest' || s === 'legs' ? 2 : 1;
      out.push({ id: `f_${s}${t}`, station: 'forge', gear: 'armor', slot: s, tier: t, in: { [leather]: q(2 * big), [cloth]: q(big), [ingot]: q(t > 1 ? 2 * big : 0) || undefined, ...extra }, skill: 'smithing', req, xp: 25 * t });
    }
    out.push({ id: `f_amulet${t}`, station: 'forge', gear: 'armor', slot: 'amulet', tier: t, in: { [ingot]: q(3), [leather]: 1, ...extra }, skill: 'smithing', req, xp: 30 * t });
    return out;
  }),
  // Kitchen
  { id: 'k_meat', station: 'kitchen', out: 'cooked_meat', n: 2, in: { raw_meat: 2 }, skill: 'cooking', req: 0, xp: 10 },
  { id: 'k_potion', station: 'kitchen', out: 'potion', n: 2, in: { herbs: 2, fibers: 1 }, skill: 'cooking', req: 0, xp: 10 },
  { id: 'k_stew', station: 'kitchen', out: 'stew', n: 2, in: { raw_meat: 3, herbs: 2, silkweed: 1 }, skill: 'cooking', req: 8, xp: 22 },
  { id: 'k_bigpotion', station: 'kitchen', out: 'big_potion', n: 2, in: { herbs: 3, silkweed: 2, bone: 2 }, skill: 'cooking', req: 10, xp: 22 },
  { id: 'k_feast', station: 'kitchen', out: 'feast', n: 2, in: { raw_meat: 4, herbs: 4, shard: 1 }, skill: 'cooking', req: 18, xp: 40 },
];
for (const r of RECIPES) for (const k in r.in) if (!r.in[k]) delete r.in[k];

export const STATIONS = {
  refinery: { name: 'Refinery', desc: 'Smelt ore, saw wood, weave cloth and tan leather.' },
  forge: { name: 'Forge', desc: 'Craft weapons, armor and amulets.' },
  kitchen: { name: 'Kitchen', desc: 'Cook food and brew potions.' },
};

// ---- Zones ----
export const ZONES = {
  town: { name: 'Windsward Outpost', lv: [1, 1], fog: 0xb9d3dc, safe: true },
  meadow: { name: 'Greenmeadow', lv: [1, 5], fog: 0xbcd6d8, enemies: ['wolf', 'wolf', 'boar'] },
  coast: { name: 'Wreckers\' Coast', lv: [4, 8], fog: 0xc2d5dc, enemies: ['lost', 'lostArcher', 'lost', 'boar'] },
  thorn: { name: 'Thornwood', lv: [7, 12], fog: 0x8fa58a, enemies: ['direwolf', 'direwolf', 'lost', 'lostArcher'] },
  mire: { name: 'Mirefen', lv: [11, 16], fog: 0x6f8a70, enemies: ['withered', 'mirehound', 'withered', 'spitter'] },
  ruins: { name: 'Ashen Ruins', lv: [16, 22], fog: 0x8a6a62, enemies: ['corrupted', 'brute', 'corruptArcher', 'corrupted'] },
};

// ---- Enemies ----
// attack kinds: melee, charge, proj, aoe (at self/target), cone, summon
export const ATTACKS = {
  bite: { kind: 'melee', windup: 0.45, range: 2.3, arc: 80, dmg: 1.0, cd: 1.5 },
  maul: { kind: 'melee', windup: 0.55, range: 2.6, arc: 90, dmg: 1.3, cd: 2.2 },
  gore: { kind: 'charge', windup: 0.8, dist: 11, width: 1.8, dmg: 1.4, cd: 5, min: 4 },
  lunge: { kind: 'charge', windup: 0.6, dist: 7, width: 1.6, dmg: 1.2, cd: 4.5, min: 4 },
  slash: { kind: 'melee', windup: 0.6, range: 2.6, arc: 100, dmg: 1.0, cd: 1.7 },
  arrow: { kind: 'proj', windup: 0.8, speed: 24, dmg: 1.0, cd: 2.4, range: 18 },
  spit: { kind: 'proj', windup: 0.7, speed: 15, dmg: 0.8, cd: 2.6, range: 15, poison: 3, color: 0x8bd64a },
  claw: { kind: 'melee', windup: 0.5, range: 2.4, arc: 100, dmg: 1.0, cd: 1.6 },
  slam: { kind: 'aoe', at: 'self', windup: 1.1, radius: 3.6, dmg: 1.7, cd: 4.5 },
  overhead: { kind: 'melee', windup: 0.8, range: 3.0, arc: 70, dmg: 1.5, cd: 2.4 },
  // bosses
  cutlass: { kind: 'cone', windup: 0.7, range: 3.6, arc: 130, dmg: 1.2, cd: 1.8 },
  powder: { kind: 'aoe', at: 'target', windup: 1.3, radius: 3.4, dmg: 1.6, cd: 6, color: 0xff7a2a },
  bellow: { kind: 'summon', what: 'lost', n: 2, cd: 20, windup: 1.0 },
  hagPool: { kind: 'aoe', at: 'target', windup: 1.2, radius: 3.2, dmg: 1.3, cd: 3.5, poison: 4, color: 0x7fd04a },
  hagBolt: { kind: 'proj', windup: 0.6, speed: 18, dmg: 1.0, cd: 2, range: 20, color: 0x9cff5a },
  hagSummon: { kind: 'summon', what: 'withered', n: 3, cd: 18, windup: 1.2 },
  wardenSlam: { kind: 'aoe', at: 'self', windup: 1.3, radius: 6.5, dmg: 1.8, cd: 7, color: 0xff3a2a },
  wardenSweep: { kind: 'cone', windup: 0.9, range: 6.5, arc: 160, dmg: 1.3, cd: 3 },
  wardenCharge: { kind: 'charge', windup: 1.0, dist: 18, width: 3.2, dmg: 1.5, cd: 9, min: 6 },
  wardenMeteors: { kind: 'aoe', at: 'target', count: 4, spread: 6, windup: 1.4, radius: 3, dmg: 1.4, cd: 10, color: 0xff3a2a },
  wardenSummon: { kind: 'summon', what: 'corrupted', n: 3, cd: 25, windup: 1.2 },
};

export const ENEMIES = {
  wolf: { name: 'Wolf', model: 'wolf', color: 0x7b7468, hp: 60, dmg: 11, speed: 6.4, attacks: ['bite'], family: 'beast', skin: true, size: 1 },
  boar: { name: 'Wild Boar', model: 'boar', color: 0x5a4030, hp: 95, dmg: 14, speed: 5.4, attacks: ['bite', 'gore'], family: 'beast', skin: true, size: 1, passive: true },
  direwolf: { name: 'Dire Wolf', model: 'wolf', color: 0x3b3833, hp: 90, dmg: 13, speed: 7, attacks: ['bite', 'lunge'], family: 'beast', skin: true, size: 1.3, thick: true },
  lost: { name: 'Lost Sailor', model: 'humanoid', skin: 0x9fb2a5, shirt: 0x3c4f5a, pants: 0x2e2a26, weapon: 'cutlass', hp: 100, dmg: 15, speed: 3.8, attacks: ['slash'], family: 'lost', size: 1, drops: ['bone'] },
  lostArcher: { name: 'Lost Archer', model: 'humanoid', skin: 0x9fb2a5, shirt: 0x5a4a3a, pants: 0x2e2a26, weapon: 'bow', hp: 70, dmg: 14, speed: 3.6, attacks: ['arrow'], ranged: 13, family: 'lost', size: 1, drops: ['bone'] },
  withered: { name: 'Withered', model: 'humanoid', skin: 0x6f7d4a, shirt: 0x3b3a26, pants: 0x2b2a1e, hp: 115, dmg: 16, speed: 4.4, attacks: ['claw'], family: 'corrupted', size: 1.05, hunched: true, drops: ['bone'] },
  mirehound: { name: 'Mire Hound', model: 'wolf', color: 0x4d5f3a, eyes: 0xb6ff4a, hp: 95, dmg: 15, speed: 7.2, attacks: ['bite', 'lunge'], family: 'beast', skin: true, size: 1.2, thick: true },
  spitter: { name: 'Bog Spitter', model: 'humanoid', skin: 0x5b7a3a, shirt: 0x2f3b20, pants: 0x232a18, hp: 80, dmg: 15, speed: 3.4, attacks: ['spit'], ranged: 11, family: 'corrupted', size: 0.95, hunched: true },
  corrupted: { name: 'Corrupted Soldier', model: 'humanoid', skin: 0x3a1a1a, shirt: 0x5a1414, pants: 0x1e1010, eyes: 0xff3a2a, weapon: 'cutlass', hp: 140, dmg: 18, speed: 4.2, attacks: ['slash', 'overhead'], family: 'corrupted', size: 1.05, drops: ['shard'] },
  brute: { name: 'Corrupted Brute', model: 'humanoid', skin: 0x2e1414, shirt: 0x4a0f0f, pants: 0x1a0c0c, eyes: 0xff3a2a, weapon: 'club', hp: 320, dmg: 26, speed: 3.2, attacks: ['overhead', 'slam'], family: 'corrupted', size: 1.7, xpMult: 2, drops: ['shard', 'shard'] },
  corruptArcher: { name: 'Corrupted Archer', model: 'humanoid', skin: 0x3a1a1a, shirt: 0x3a1010, pants: 0x1e1010, eyes: 0xff3a2a, weapon: 'bow', hp: 100, dmg: 17, speed: 3.8, attacks: ['arrow'], ranged: 14, family: 'corrupted', size: 1, drops: ['shard'] },
  // bosses
  grimsby: { name: 'Captain Grimsby', title: 'The Drowned Captain', model: 'humanoid', skin: 0x86a094, shirt: 0x203450, pants: 0x2a2018, weapon: 'cutlass', hat: true, hp: 900, dmg: 18, speed: 4.3, attacks: ['cutlass', 'powder', 'bellow'], family: 'lost', size: 1.5, boss: true, xpMult: 10, drops: ['bone', 'bone', 'bone'] },
  hag: { name: 'The Mire Hag', title: 'Witch of the Fen', model: 'humanoid', skin: 0x5d7a44, shirt: 0x2a3320, pants: 0x1a2014, eyes: 0xc6ff5a, hp: 1000, dmg: 18, speed: 3.6, attacks: ['hagBolt', 'hagPool', 'hagSummon'], ranged: 9, family: 'corrupted', size: 1.6, hunched: true, boss: true, xpMult: 12, drops: ['shard', 'shard', 'silkweed'] },
  warden: { name: 'The Corrupted Warden', title: 'Heart of the Corruption', model: 'humanoid', skin: 0x220c0c, shirt: 0x5a0a0a, pants: 0x140808, eyes: 0xff2a1a, weapon: 'greatsword', horns: true, hp: 1150, dmg: 22, speed: 4.4, attacks: ['wardenSweep', 'wardenSlam', 'wardenCharge', 'wardenMeteors', 'wardenSummon'], family: 'corrupted', size: 2.6, boss: true, xpMult: 25, drops: ['shard', 'shard', 'shard', 'shard', 'shard'] },
};

// ---- Story ----
// objective kinds: talk, kill {enemy, n, zone?}, gather {mat, n}, refine {n}, craft {n}, boss {enemy}
export const STORY = [
  { title: 'A New Shore', giver: 'thorne', obj: { kind: 'talk' }, text: 'You wake on the sand, the wreck of your ship still burning offshore. A soldier waves you toward the palisade. "Captain Thorne wants a word with every survivor."', done: 'Thorne looks you over. "Alive and armed. Good. This island is cursed with something we call the Corruption, and it is spreading. Take this spare weapon. You will need two."', reward: { xp: 60, coins: 25, secondWeapon: true } },
  { title: 'Wolves at the Gate', giver: 'thorne', obj: { kind: 'kill', enemy: 'wolf', n: 6 }, text: '"The wolves in Greenmeadow have grown bold, attacking anyone who steps outside the walls. Thin the pack. Six should do it."', done: '"Good work. Skin the next ones you kill; hide and meat keep this outpost alive."', reward: { xp: 160, coins: 40, potions: 3 } },
  { title: 'Timber and Iron', giver: 'thorne', obj: { kind: 'gather', items: { green_wood: 8, iron_ore: 6 } }, text: '"We need materials. Chop green wood from the trees outside, and mine iron from the grey veins in the rocks. Press E beside them."', done: '"That will keep the forge burning. Now let us see you use it."', reward: { xp: 200, coins: 40 } },
  { title: 'Tools of War', giver: 'thorne', obj: { kind: 'craft', n: 1 }, text: '"Take ore and wood to the Refinery to make ingots and timber, then craft any weapon or armor at the Forge. Gear you make yourself is often better than what you find."', done: '"Fine work. Gear score is what matters out there. The higher it is, the harder you hit and the less you bleed."', reward: { xp: 260, coins: 60, potions: 3 } },
  { title: 'Wreckers\' Coast', giver: 'thorne', obj: { kind: 'kill', enemy: 'lost', family: 'lost', n: 8, label: 'Lost' }, text: '"South of the meadow lies the coast where your ship went down, and many before it. The drowned do not stay dead here. They call them the Lost. Put eight of them back in the sea."', done: '"The survivors speak of a captain who leads them. Grimsby, they say, went down with his ship a hundred years ago."', reward: { xp: 420, coins: 80, item: { rarity: 2 } } },
  { title: 'The Drowned Captain', giver: 'thorne', obj: { kind: 'boss', enemy: 'grimsby' }, text: '"Captain Grimsby haunts the great wreck on the southern shore. End him and the Lost will scatter. Watch for his powder kegs; when the ground glows, roll out of it."', done: '"Grimsby is gone. You have earned the outpost\'s trust, and your share of the spoils."', reward: { xp: 700, coins: 150, item: { rarity: 3 } } },
  { title: 'Thornwood Hunt', giver: 'thorne', obj: { kind: 'kill', enemy: 'direwolf', n: 8 }, text: '"East lies the Thornwood, older and darker than the meadow. Dire wolves hunt there. Kill eight, and look for Aged Trees and Starmetal while you are out."', done: '"Your skills grow. But the real danger lies north."', reward: { xp: 800, coins: 120, potions: 4 } },
  { title: 'Witch of the Fen', giver: 'thorne', obj: { kind: 'boss', enemy: 'hag' }, text: '"In the Mirefen to the north, a witch feeds the Corruption from her hut. Her poison pools spread fast and her Withered never stop coming. Kill her."', done: '"The fen is quieter already. One task remains, the hardest of all."', reward: { xp: 1300, coins: 220, item: { rarity: 3 } } },
  { title: 'The Ashen Ruins', giver: 'thorne', obj: { kind: 'kill', family: 'corrupted', zone: 'ruins', n: 12, label: 'Corrupted in the Ashen Ruins' }, text: '"West, in the Ashen Ruins, the Corruption is strongest. Its soldiers guard the old shrine. Break their ranks: twelve of them."', done: '"The way to the shrine is open. The Warden waits there. It is the heart of all this."', reward: { xp: 1600, coins: 260, potions: 5 } },
  { title: 'Heart of the Corruption', giver: 'thorne', obj: { kind: 'boss', enemy: 'warden' }, text: '"The Corrupted Warden stands at the western shrine. Bring your best gear, food and potions. Its slam reaches far, and it calls fire from the sky."', done: '"It is over. The Corruption will fade from Aeternum. You came here a castaway; you leave a legend."', reward: { xp: 3000, coins: 600, item: { rarity: 4 } }, final: true },
];

export const NPCS = {
  thorne: { name: 'Captain Thorne', role: 'Outpost Commander', shirt: 0x7a1e1e, pants: 0x3a2e22 },
  board: { name: 'Bounty Board', role: 'Bounties' },
  ilsa: { name: 'Ilsa', role: 'Merchant', shirt: 0x2e5a6a, pants: 0x3a3022 },
};
