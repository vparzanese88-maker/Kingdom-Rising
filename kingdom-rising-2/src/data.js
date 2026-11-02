// Kingdom Rising 2: all game data (races, classes, weapons, abilities, items, recipes, mobs, zones, quests)

export const LEVEL_CAP = 20;
export const xpForLevel = (lv) => Math.round(80 * Math.pow(lv, 1.6));

export const RACES = {
  highelf: { name: 'High Elf', playable: true, desc: 'Tall, proud and ancient, steeped in magic. Pale skin, long pointed ears. High Intellect.', height: 1.08, width: 0.92, hp: 5, stats: { str: 10, dex: 12, int: 16, sta: 10 },
    skins: ['#f8e6d4', '#f2dcc4', '#ead2b8', '#e4cbb6', '#d8c4b4'], hairs: ['#f4ead0', '#e8e8ec', '#d8b860', '#1a1a1e', '#c0c8d8', '#a8442a', '#f0d890'] },
  woodelf: { name: 'Wood Elf', playable: true, desc: 'Lithe forest-dwellers, quick and keen-eyed. Sun-browned skin, pointed ears. High Dexterity.', height: 1.02, width: 0.9, hp: 5, stats: { str: 10, dex: 16, int: 12, sta: 10 },
    skins: ['#e8c4a0', '#d4a882', '#c08e68', '#a87a58', '#8a6448'], hairs: ['#5a3a1e', '#7a3a1a', '#3a2a14', '#a06a30', '#2a1a10', '#4a5a2a', '#c88a4a'] },
  dwarf: { name: 'Dwarf', playable: true, desc: 'Short, broad and tough as stone. Famous beards. High Strength and Stamina, lower Dexterity and Intellect.', height: 0.74, width: 1.3, hp: 20, stats: { str: 15, dex: 9, int: 9, sta: 15 },
    skins: ['#efc2a0', '#dba07a', '#bf825d', '#94603f', '#d9a98c'], hairs: ['#b5501f', '#6b3a17', '#2a1b10', '#d6a23f', '#8a8a8a', '#e3e3e3', '#4a2a14'] },
  goblin: { name: 'Goblin', height: 0.72, width: 0.9, hp: 0, stats: { str: 8, dex: 12, int: 6, sta: 8 }, skins: ['#6a8a3a', '#7a9a44', '#5a7a32'], hairs: ['#1a1a10'] },
  orc: { name: 'Orc', playable: true, desc: 'Huge, green-skinned and tusked. Born for war. Highest Strength.', height: 1.08, width: 1.15, hp: 15, stats: { str: 17, dex: 10, int: 7, sta: 15 },
    skins: ['#6a8a4a', '#5a7a3e', '#7a9050', '#4e6a3a', '#8a9a5a'], hairs: ['#1a1410', '#2a2018', '#3a2a1a', '#5a4a3a', '#8a8a8a', '#a03a1a', '#d8d0c0'] },
  // villagers only
  human: { name: 'Human', height: 1.0, width: 1.0, hp: 10, stats: { str: 12, dex: 12, int: 12, sta: 12 }, skins: ['#f1c7a5', '#e0ac85', '#c68863'], hairs: ['#2b1d12', '#5a3a1e', '#a0662c'] },
  elf: { name: 'Elf', height: 1.05, width: 0.9, hp: 0, stats: { str: 10, dex: 15, int: 13, sta: 10 }, skins: ['#f6dcc6', '#ead0b5', '#d8b998'], hairs: ['#f2e6b0', '#e8e8e8', '#2a1a10'] },
};
export const isElf = (r) => r === 'elf' || r === 'highelf' || r === 'woodelf';

// Weapon families. reach in metres, area = right-click area radius, speed = attack speed multiplier.
export const WEAPON_TYPES = {
  sword: { name: 'Sword', hands: 'one', reach: 2.7, area: 4.5, speed: 1.05, block: 0.5, dmg: 1.0, kind: 'melee', parts: ['sword'], areaName: 'Whirlwind' },
  mace: { name: 'Mace', hands: 'one', reach: 2.5, area: 4.5, speed: 0.9, block: 0.5, dmg: 1.08, kind: 'melee', parts: ['mace'], areaName: 'Shockwave' },
  shield: { name: 'Shield', hands: 'off', reach: 1.8, area: 4, speed: 1.0, block: 0.85, dmg: 0.3, kind: 'melee', parts: ['shield'], areaName: 'Shield Slam' },
  swordshield: { name: 'Sword & Shield', hands: 'shield', reach: 2.7, area: 4.5, speed: 1.05, block: 0.85, dmg: 1.0, kind: 'melee', parts: ['sword', 'shield'], areaName: 'Shield Spin' },
  maceshield: { name: 'Mace & Shield', hands: 'shield', reach: 2.5, area: 4.5, speed: 0.9, block: 0.85, dmg: 1.08, kind: 'melee', parts: ['mace', 'shield'], areaName: 'Crushing Spin' },
  swordmace: { name: 'Sword & Mace', hands: 'dual', reach: 2.6, area: 4.5, speed: 1.15, block: 0.5, dmg: 0.95, kind: 'melee', parts: ['sword', 'mace'], areaName: 'Twin Fury' },
  greatsword: { name: 'Greatsword', hands: 'two', reach: 3.4, area: 6.5, speed: 0.68, block: 0.6, dmg: 1.4, kind: 'melee', parts: ['greatsword'], areaName: 'Great Cleave' },
  greataxe: { name: 'Great Axe', hands: 'two', reach: 3.2, area: 6.5, speed: 0.62, block: 0.55, dmg: 1.5, kind: 'melee', parts: ['greataxe'], areaName: 'Reaping Whirl' },
  warhammer: { name: 'Warhammer', hands: 'two', reach: 3.0, area: 7, speed: 0.58, block: 0.55, dmg: 1.55, kind: 'melee', parts: ['warhammer'], areaName: 'Quake Spin' },
  spear: { name: 'Spear', hands: 'two', reach: 4.0, area: 5.5, speed: 0.95, block: 0.55, dmg: 1.12, kind: 'melee', parts: ['spear'], areaName: 'Sweeping Arc' },
  daggers: { name: 'Twin Daggers', hands: 'dual', reach: 2.1, area: 3.5, speed: 1.9, block: 0.4, dmg: 0.75, kind: 'melee', parts: ['dagger', 'dagger'], areaName: 'Twin Fury' },
  handaxes: { name: 'Hand Axes', hands: 'dual', reach: 2.3, area: 4, speed: 1.25, block: 0.45, dmg: 0.88, kind: 'melee', parts: ['handaxe', 'handaxe'], areaName: 'Twin Fury' },
  bow: { name: 'Longbow', hands: 'bow', reach: 60, area: 6, speed: 1.0, block: 0.35, dmg: 1.05, kind: 'bow', parts: ['bow'], areaName: 'Rain of Arrows' },
  firestaff: { name: 'Fire Staff', hands: 'staff', reach: 60, area: 9, speed: 1.0, block: 0.4, dmg: 1.1, kind: 'staff', element: 'fire', parts: ['staff'], areaName: 'Meteor' },
  froststaff: { name: 'Frost Staff', hands: 'staff', reach: 55, area: 7, speed: 1.05, block: 0.4, dmg: 0.95, kind: 'staff', element: 'frost', parts: ['staff'], areaName: 'Blizzard' },
  arcanestaff: { name: 'Arcane Staff', hands: 'staff', reach: 60, area: 6.5, speed: 1.15, block: 0.4, dmg: 0.95, kind: 'staff', element: 'arcane', parts: ['staff'], areaName: 'Arcane Nova' },
};

// Stats: STR melee damage, DEX ranged/light-weapon damage, crit chance and endurance, INT mana and spell damage, STA health.
// Races set the starting points; stats only rise through gear. Health, Mana and Endurance also grow each level by class.
export const STAT_NAMES = { str: 'Strength', dex: 'Dexterity', int: 'Intellect', sta: 'Stamina' };
export const STAT_DESC = { str: '+2% melee damage per point (swords, maces, axes, hammers)', dex: '+2% bow, dagger, hand axe and spear damage, +0.4% crit, +2 endurance per point', int: '+2% spell and staff damage, +6 mana per point', sta: '+6 health per point' };
export function derived(stats) { return { meleeMul: 1 + (stats.str - 10) * 0.02, rangedMul: 1 + (stats.dex - 10) * 0.02, spellMul: 1 + (stats.int - 10) * 0.02, crit: 0.05 + stats.dex * 0.004, hp: stats.sta * 6, mana: stats.int * 6, end: stats.dex * 2 }; }
// per-class pools: base and gain per level. Abilities spend mana (wizard) or endurance (warrior, ranger).
export const CLASS_POOLS = {
  warrior: { hp: [120, 16], mana: [0, 0], end: [100, 5], uses: 'end' },
  berserker: { hp: [130, 18], mana: [0, 0], end: [105, 6], uses: 'end' },
  ranger: { hp: [100, 13], mana: [0, 0], end: [110, 6], uses: 'end' },
  wizard: { hp: [85, 10], mana: [110, 9], end: [80, 3], uses: 'mana' },
};
export function poolsAt(cls, level) { const P = CLASS_POOLS[cls]; return { hp: P.hp[0] + P.hp[1] * (level - 1), mana: P.mana[0] + P.mana[1] * (level - 1), end: P.end[0] + P.end[1] * (level - 1) }; }
// which stat a weapon type scales with
// weapon ability (right click) cooldowns in seconds, by weapon kind
export const AREA_CD = { melee: 7, bow: 9, staff: 10, dual: 8 };

// ---------- Individual weapons: each has its own mastery, tree and two abilities (F and C) ----------
export const FAMILIES = {
  sword: { name: 'Sword', kind: 'melee', skills: ['whirlwind', 'lunge'] },
  mace: { name: 'Mace', kind: 'melee', skills: ['skullcrack', 'shockwave'] },
  axe: { name: 'Hand Axe', kind: 'melee', skills: ['hatchet', 'rend'] },
  dagger: { name: 'Dagger', kind: 'melee', skills: ['twinfury', 'fan'] },
  shield: { name: 'Shield', kind: 'melee', skills: ['shieldcharge', 'shieldbash'] },
  greatsword: { name: 'Greatsword', kind: 'melee', skills: ['greatcleave', 'execute'] },
  greataxe: { name: 'Great Axe', kind: 'melee', skills: ['reaping', 'earthcleaver'] },
  warhammer: { name: 'Warhammer', kind: 'melee', skills: ['quake', 'hammerfall'] },
  spear: { name: 'Spear', kind: 'melee', skills: ['sweep', 'javelin'] },
  bow: { name: 'Bow', kind: 'bow', skills: ['rain', 'multishot'] },
  firestaff: { name: 'Fire Staff', kind: 'staff', skills: ['meteor', 'flamewave'] },
  froststaff: { name: 'Frost Staff', kind: 'staff', skills: ['blizzard', 'icelance'] },
  arcanestaff: { name: 'Arcane Staff', kind: 'staff', skills: ['nova', 'missiles'] },
};
export const WSKILLS = {
  fan8: { name: 'Arrow Fan', cd: 7, icon: 'rain', desc: 'Loose eight arrows at once in a wide horizontal fan.' },
  wheel: { name: 'Wheel Strike', cd: 7, icon: 'area', desc: 'A spinning sword strike that hits everything around you and slows them.' },
  shadowflurry: { name: 'Shadow Flurry', cd: 8, icon: 'twinfury', desc: 'A blur of dagger strikes on everything in front of you; every hit makes them bleed.' },
  whirlaxes: { name: 'Whirling Axes', cd: 8, icon: 'area', desc: 'Spin with both axes, cutting everything around you and leaving them bleeding.' },
  whirlwind: { name: 'Whirlwind', cd: 8, icon: 'area', desc: 'Spin with your blade, hitting everything around you.' },
  lunge: { name: 'Lunging Strike', cd: 7, icon: 'charge', desc: 'Dash forward and run through the first enemy in your way for heavy damage.' },
  skullcrack: { name: 'Skull Crack', cd: 8, icon: 'skullcrack', desc: 'A brutal overhead blow that stuns the target.' },
  shockwave: { name: 'Shockwave', cd: 10, icon: 'shockwave', desc: 'Smash the ground: damage and slow everything around you.' },
  hatchet: { name: 'Hatchet Throw', cd: 6, icon: 'charge', desc: 'Hurl an axe that makes the target bleed.' },
  rend: { name: 'Rending Chop', cd: 8, icon: 'fury', desc: 'A savage chop that leaves a deep bleeding wound.' },
  twinfury: { name: 'Twin Fury', cd: 8, icon: 'twinfury', desc: 'A flurry of six quick strikes on everything in front of you.' },
  fan: { name: 'Fan of Knives', cd: 9, icon: 'blink', desc: 'Throw a ring of knives in every direction.' },
  shieldcharge: { name: 'Shield Charge', cd: 8, icon: 'charge', desc: 'Rush forward behind your shield, bowling over and stunning everything in your path.' },
  shieldbash: { name: 'Shield Slam', cd: 9, icon: 'shield', desc: 'Slam your shield into the ground: knock back and stun every enemy around you.' },
  greatcleave: { name: 'Great Cleave', cd: 8, icon: 'area', desc: 'A huge spinning cleave with a wide reach.' },
  execute: { name: 'Executioner', cd: 10, icon: 'skull', desc: 'A massive downward blow. Double damage to enemies below 35% health.' },
  reaping: { name: 'Reaping Whirl', cd: 9, icon: 'area', desc: 'Spin your axe in a wide circle, making everything bleed.' },
  earthcleaver: { name: 'Earth Cleaver', cd: 10, icon: 'earthsplitter', desc: 'Split the ground: a shockwave rips forward through every enemy in a line.' },
  quake: { name: 'Quake Spin', cd: 9, icon: 'area', desc: 'Spin your hammer, damaging and slowing everything around you.' },
  hammerfall: { name: 'Hammerfall', cd: 12, icon: 'earthsplitter', desc: 'Leap-slam with your hammer: huge damage and a long stun around the impact.' },
  sweep: { name: 'Sweeping Arc', cd: 8, icon: 'area', desc: 'Sweep your spear in a full circle.' },
  javelin: { name: 'Javelin', cd: 7, icon: 'spectral', desc: 'Throw a spear that pierces every enemy in a line.' },
  rain: { name: 'Rain of Arrows', cd: 9, icon: 'rain', desc: 'Arrows rain down on the spot you aim at.' },
  multishot: { name: 'Multishot', cd: 7, icon: 'spectral', desc: 'Fire five arrows in a spread.' },
  meteor: { name: 'Meteor', cd: 10, icon: 'meteor', desc: 'Lob a huge meteor that drops hard: the biggest area of all.' },
  flamewave: { name: 'Flame Wave', cd: 8, icon: 'meteor', desc: 'A wave of fire in front of you that sets enemies alight.' },
  blizzard: { name: 'Blizzard', cd: 10, icon: 'blizzard', desc: 'A storm of ice on a spot that damages and slows.' },
  icelance: { name: 'Ice Lance', cd: 7, icon: 'frostnova', desc: 'A huge piercing shard of ice that freezes what it hits.' },
  nova: { name: 'Arcane Nova', cd: 10, icon: 'nova', desc: 'A heavy orb that bursts in a wide nova.' },
  missiles: { name: 'Arcane Missiles', cd: 7, icon: 'nova', desc: 'Three seeking bolts of arcane force.' },
};
export function partFamily(wt, part) { const W = WEAPON_TYPES[wt]; return part === 'staff' ? W.element + 'staff' : part === 'handaxe' ? 'axe' : part; }
export function familiesOf(wt) { return [...new Set(WEAPON_TYPES[wt].parts.map(p => partFamily(wt, p)))]; }
// the two weapon abilities on F and C for a weapon type
export function slotSkills(wt, sel = {}) {
  const fams = WEAPON_TYPES[wt].parts.map(p => partFamily(wt, p));
  const a = fams[0], b = fams[1];
  if (b && b !== a) return [{ fam: a, id: FAMILIES[a].skills[sel[a] || 0] }, { fam: b, id: FAMILIES[b].skills[sel[b] || 0] }];
  return [{ fam: a, id: FAMILIES[a].skills[0] }, { fam: a, id: FAMILIES[a].skills[1] }];
}
export function classFamilies(cls) { const out = []; for (const wt of CLASSES[cls].weapons) for (const f of familiesOf(wt)) if (!out.includes(f)) out.push(f); return out; }

// ---------- Skill trees ----------
// Class tree: 1 point per level after 1. Rows unlock after spending points in the tree (row r needs 3*r points).
export const TREE_ROW_POINTS = 2;
export const CLASS_TREE = {
  warrior: [
    { id: 'hp', row: 0, name: "Toughness", icon: 'heart', max: 1, desc: "+10% maximum health." },
    { id: 'armor', row: 0, name: "Iron Skin", icon: 'shield', max: 1, desc: "+15% armour." },
    { id: 'shieldwall', row: 0, name: "Shield Discipline", icon: 'shield', max: 1, desc: "Blocking with a shield no longer slows you down." },
    { id: 'unbreak', row: 1, name: "Unbreakable Guard", icon: 'shield', max: 1, desc: "Your block can never be broken, however hard you are hit." },
    { id: 'a_charge', row: 1, name: "Bull Rush", icon: 'charge', max: 1, desc: "Charge hits 50% harder and stuns longer." },
    { id: 'a_bash', row: 1, name: "Concussive Bash", icon: 'bash', max: 1, desc: "Shield Bash hits 50% harder and stuns longer." },
    { id: 'a_shieldwall', row: 2, name: "Iron Wall", icon: 'shieldwall', max: 1, desc: "Shield Wall lasts 50% longer." },
    { id: 'a_cleavestrike', row: 2, name: "Sweeping Blows", icon: 'cleavestrike', max: 1, desc: "Cleaving Strike hits 50% harder and wider." },
    { id: 'bloodlust', row: 2, name: "Bloodlust", icon: 'heart', max: 1, desc: "Every kill restores 5% of your health." },
    { id: 'a_shieldthrow', row: 3, name: "Ricochet", icon: 'shieldthrow', max: 1, desc: "Shield Throw bounces to 2 more enemies and hits harder." },
    { id: 'a_fortify', row: 3, name: "Bastion", icon: 'fortify', max: 1, desc: "Fortify lasts 50% longer." },
    { id: 'a_execute', row: 3, name: "Headsman", icon: 'execute', max: 1, desc: "Execute hits 50% harder." },
    { id: 'cap', row: 4, name: "Unstoppable", icon: 'crown', max: 1, desc: "Deal 20% more damage while below half health." },
  ],
  berserker: [
    { id: 'dmg', row: 0, name: "Brute Force", icon: 'fist', max: 1, desc: "+8% damage with everything." },
    { id: 'hp', row: 0, name: "Thick Hide", icon: 'heart', max: 1, desc: "+10% maximum health." },
    { id: 'reckless', row: 0, name: "Reckless", icon: 'fist', max: 1, desc: "Deal 10% more damage." },
    { id: 'bloodlust', row: 1, name: "Bloodlust", icon: 'heart', max: 1, desc: "Every kill restores 5% of your health." },
    { id: 'a_earthsplitter', row: 1, name: "Meteor Leap", icon: 'earthsplitter', max: 1, desc: "Leap Strike hits 50% harder in a wider area." },
    { id: 'a_battlecry', row: 1, name: "Warlord's Roar", icon: 'battlecry', max: 1, desc: "Battle Cry lasts 50% longer." },
    { id: 'heavyhit', row: 2, name: "Heavy Hitter", icon: 'heavy', max: 1, desc: "Your finishing blows hit 25% harder." },
    { id: 'a_whirlwind', row: 2, name: "Cyclone", icon: 'whirlwind', max: 1, desc: "Whirlwind lasts longer and hits harder." },
    { id: 'a_intimshout', row: 2, name: "Terror", icon: 'intimshout', max: 1, desc: "Intimidating Shout stuns 50% longer." },
    { id: 'a_rampage', row: 3, name: "Frenzy", icon: 'rampage', max: 1, desc: "Rampage lasts 50% longer." },
    { id: 'a_groundslam', row: 3, name: "Fault Line", icon: 'groundslam', max: 1, desc: "Ground Slam hits 50% harder." },
    { id: 'a_bloodrage', row: 3, name: "Blood Frenzy", icon: 'bloodrage', max: 1, desc: "Bloodrage lasts 50% longer." },
    { id: 'cap', row: 4, name: "Unstoppable", icon: 'crown', max: 1, desc: "Deal 20% more damage while below half health." },
  ],
  ranger: [
    { id: 'speed', row: 0, name: "Light Feet", icon: 'boot', max: 1, desc: "Move 10% faster." },
    { id: 'crit', row: 0, name: "Eagle Eye", icon: 'crit', max: 1, desc: "+6% critical chance." },
    { id: 'evasive', row: 0, name: "Evasive", icon: 'wind', max: 1, desc: "Dodge rolls cost half the endurance." },
    { id: 'quickdraw', row: 1, name: "Quick Draw", icon: 'spectral', max: 1, desc: "Shoot your bow 30% faster." },
    { id: 'a_spectral', row: 1, name: "Ghost Arrow", icon: 'spectral', max: 1, desc: "Spectral Arrow hits 50% harder." },
    { id: 'a_mending', row: 1, name: "Nature's Gift", icon: 'mending', max: 1, desc: "Mending heals 50% more." },
    { id: 'poison', row: 2, name: "Poisoned Tips", icon: 'skull', max: 1, desc: "Your hits poison enemies, dealing extra damage over 4 s." },
    { id: 'a_barkskin', row: 2, name: "Ironbark", icon: 'barkskin', max: 1, desc: "Bark Skin absorbs 50% more." },
    { id: 'a_snaretrap', row: 2, name: "Steel Jaws", icon: 'snaretrap', max: 1, desc: "Snare Trap roots longer and hurts more." },
    { id: 'a_vanish', row: 3, name: "Shadow Walk", icon: 'vanish', max: 1, desc: "Vanish lasts 50% longer." },
    { id: 'a_explotrap', row: 3, name: "Black Powder", icon: 'explotrap', max: 1, desc: "Explosive Trap hits 50% harder in a wider blast." },
    { id: 'a_barrage', row: 3, name: "Storm of Arrows", icon: 'barrage', max: 1, desc: "Barrage fires 5 more arrows." },
    { id: 'cap', row: 4, name: "Deadeye", icon: 'crown', max: 1, desc: "Your first hit on an unhurt enemy is always a critical hit." },
  ],
  wizard: [
    { id: 'res', row: 0, name: "Deep Reserves", icon: 'mana', max: 1, desc: "+20% maximum mana." },
    { id: 'regen', row: 0, name: "Mana Flow", icon: 'wind', max: 1, desc: "Mana regenerates 50% faster." },
    { id: 'armor', row: 0, name: "Spell Ward", icon: 'shield', max: 1, desc: "+15% armour." },
    { id: 'ignite', row: 1, name: "Ignite", icon: 'meteor', max: 1, desc: "Fire spells burn their targets twice as hard." },
    { id: 'frostbite', row: 1, name: "Frostbite", icon: 'frostnova', max: 1, desc: "Frost slows last twice as long and freezes 1 s longer." },
    { id: 'a_frostnova', row: 1, name: "Deep Freeze", icon: 'frostnova', max: 1, desc: "Frost Nova hits 50% harder and freezes longer." },
    { id: 'echo', row: 2, name: "Arcane Echo", icon: 'nova', max: 1, desc: "Your basic spells have a 15% chance to cast twice." },
    { id: 'a_chain', row: 2, name: "Storm Lord", icon: 'chain', max: 1, desc: "Chain Lightning hits 50% harder and jumps further." },
    { id: 'a_icebarrier', row: 2, name: "Glacial Armour", icon: 'icebarrier', max: 1, desc: "Ice Barrier absorbs 50% more." },
    { id: 'a_firering', row: 3, name: "Wildfire", icon: 'firering', max: 1, desc: "Ring of Fire burns 50% harder." },
    { id: 'a_lightstorm', row: 3, name: "Thunderhead", icon: 'lightstorm', max: 1, desc: "Lightning Storm calls 4 more strikes." },
    { id: 'a_inferno', row: 3, name: "Cataclysm", icon: 'inferno', max: 1, desc: "Inferno hits 50% harder in a wider blast." },
    { id: 'cap', row: 4, name: "Archmage", icon: 'crown', max: 1, desc: "Abilities cost 25% less and every spell deals 15% more damage." },
  ],
};
// Weapon trees (one per weapon type, points from that weapon's mastery level)
const WT = (kind) => {
  const ranged = kind === 'bow', staff = kind === 'staff';
  return [
    { id: 'wdmg', row: 0, name: staff ? 'Empowered Focus' : ranged ? 'Broadheads' : 'Honed Edge', icon: 'sword', max: 3, desc: '+6% damage with this weapon per rank.' },
    { id: 'heavy', row: 0, name: staff ? 'Quick Channel' : ranged ? 'Steady Draw' : 'Heavy Hands', icon: 'heavy', max: 2, desc: 'Hold-to-charge attacks charge 30% faster and hit 15% harder per rank.' },
    { id: 'combo', row: 1, name: staff ? 'Spell Weaving' : ranged ? 'Rapid Fire' : 'Flowing Strikes', icon: 'combo', max: 2, desc: staff ? 'Basic spells cast 12% faster per rank.' : ranged ? 'Quick shots fire 12% faster per rank.' : 'The 3rd combo hit deals +25% damage per rank.' },
    { id: 'area', row: 1, name: staff ? 'Cataclysm' : ranged ? 'Volley Master' : 'Wide Arc', icon: 'area', max: 2, desc: 'This weapon\'s abilities (F / C): +15% radius and 15% shorter cooldown per rank.' },
    { id: 'crit', row: 2, name: 'Precision', icon: 'crit', max: 2, desc: '+3% critical chance with this weapon per rank.' },
    { id: 'block', row: 2, name: staff ? 'Mana Shield' : ranged ? 'Evasive Stance' : 'Iron Guard', icon: 'shield', max: 2, desc: 'Blocking stops 10% more damage and costs 25% less endurance per rank.' },
    { id: 'leech', row: 3, name: 'Bloodthirst', icon: 'heart', max: 1, desc: 'Heal for 4% of the damage you deal with this weapon.' },
    { id: 'exec', row: 3, name: 'Executioner', icon: 'skull', max: 1, desc: '+30% damage against enemies below 35% health.' },
  ];
};
export const WEAPON_TREE = { melee: WT('melee'), bow: WT('bow'), staff: WT('staff') };
export const familyTree = (fam) => WEAPON_TREE[FAMILIES[fam].kind];
export const MASTERY_CAP = 20;
export const masteryXpFor = (lv) => 60 + lv * 45;
export function weaponStat(wt) { const W = WEAPON_TYPES[wt]; if (W.kind === 'staff') return 'int'; if (W.kind === 'bow' || wt === 'daggers' || wt === 'handaxes' || wt === 'spear') return 'dex'; return 'str'; }

// How each melee weapon attacks (left click steps through the chain). m = damage multiplier, d = relative swing time.
// cleave: hits everything in a wide arc; stun/shock: stun and an area shockwave; bleed; aoe: hit all around; line: pierce a line.
// right-click special attack for each weapon (dual-wield sets have their own)
export const RMB_SPECIAL = { sword: 'wheel', swordshield: 'wheel', mace: 'skullcrack', maceshield: 'skullcrack', swordmace: 'twinfury', daggers: 'shadowflurry', handaxes: 'whirlaxes', greatsword: 'greatcleave', greataxe: 'reaping', warhammer: 'hammerfall', spear: 'javelin', bow: 'fan8', firestaff: 'meteor', froststaff: 'blizzard', arcanestaff: 'nova' };
export const COMBOS = {
  sword: { trait: 'Swords: +10% critical chance', chain: [{ a: 'swing1', m: 1.0 }, { a: 'swing2', m: 1.05 }, { a: 'swing3', m: 2.0, d: 1.7 }] },
  mace: { trait: 'Maces ignore armour', chain: [{ a: 'swing1', m: 1.15 }, { a: 'smash', m: 2.3, d: 1.7, stun: 1.2, shock: 3.2 }] },
  swordshield: { trait: 'Swords: +10% critical chance', chain: [{ a: 'swing1', m: 1.0 }, { a: 'swing2', m: 1.05 }, { a: 'swing3', m: 2.0, d: 1.7 }] },
  maceshield: { trait: 'Maces ignore armour', chain: [{ a: 'swing1', m: 1.15 }, { a: 'smash', m: 2.3, d: 1.7, stun: 1.2, shock: 3.2 }] },
  swordmace: { trait: 'Sword crits, mace ignores armour', chain: [{ a: 'swing1', m: 1.0 }, { a: 'off1', m: 1.15, blunt: true }, { a: 'swing3', m: 1.8, d: 1.4, shock: 3, blunt: true }] },
  daggers: { trait: 'Daggers: lightning fast, the 5th strike is a spinning double slash', chain: [{ a: 'stabR', m: 0.6, d: 0.55 }, { a: 'stabL', m: 0.6, d: 0.55 }, { a: 'stabR', m: 0.65, d: 0.55 }, { a: 'stabL', m: 0.7, d: 0.55 }, { a: 'spin', m: 2.4, d: 1.6, aoe: 3.4, bleed: true, crit: 0.5 }] },
  handaxes: { trait: 'Axes make enemies bleed', chain: [{ a: 'swing1', m: 0.95, bleed: true }, { a: 'off1', m: 0.95, bleed: true }, { a: 'swing3', m: 1.7, d: 1.3, bleed: true }] },
  greatsword: { trait: 'Greatswords cleave through every enemy in front of you', chain: [{ a: 'swing1', m: 1.1, cleave: true }, { a: 'swing2', m: 1.15, cleave: true }, { a: 'smash', m: 2.2, d: 1.5, cleave: true }] },
  greataxe: { trait: 'Great axes cleave and leave deep bleeding wounds', chain: [{ a: 'swing1', m: 1.35, cleave: true, bleed: true }, { a: 'smash', m: 2.7, d: 1.6, cleave: true, bleed: true }] },
  warhammer: { trait: 'Hammers ignore armour; the second blow quakes the ground and stuns', chain: [{ a: 'swing1', m: 1.35, blunt: true }, { a: 'smash', m: 2.8, d: 1.7, blunt: true, stun: 1.8, shock: 5 }] },
  spear: { trait: 'Spears strike from far away; the 4th thrust pierces a whole line', chain: [{ a: 'thrust1', m: 0.85, d: 0.8 }, { a: 'thrust2', m: 0.85, d: 0.8 }, { a: 'thrust1', m: 0.9, d: 0.8 }, { a: 'thrust3', m: 1.9, d: 1.3, line: true, knock: 10 }] },
};
export const CLASSES = {
  warrior: { name: 'Warrior', desc: 'A steel-clad fighter who wades into the thick of battle. High health, heavy weapons and a shield.',
    weapons: ['sword', 'mace', 'shield', 'swordshield', 'maceshield', 'swordmace', 'greatsword', 'greataxe', 'warhammer', 'spear'], armor: 'mail', hp: 130, mana: 0,
    colors: { main: '#8b1e1e', trim: '#d8b04a', metal: '#9aa3ad' } },
  berserker: { name: 'Berserker', desc: 'A wild warrior who fights with huge two-handed weapons, leaping into battle and roaring war shouts. Hits the hardest, wears light armour.',
    weapons: ['greataxe', 'greatsword', 'warhammer', 'handaxes', 'swordmace'], armor: 'leather', hp: 135, mana: 0,
    colors: { main: '#6a2a14', trim: '#c8a060', metal: '#7a7470' } },
  ranger: { name: 'Ranger', desc: 'A hooded hunter of the wilds. Deadly with a bow and hard to pin down.',
    weapons: ['bow', 'daggers', 'handaxes', 'spear'], armor: 'leather', hp: 110, mana: 0,
    colors: { main: '#2f5a2a', trim: '#6b4a2a', metal: '#7a6a55' } },
  wizard: { name: 'Wizard', desc: 'A robed scholar of the arcane. Hurls fire, frost and raw magic from afar.',
    weapons: ['firestaff', 'froststaff', 'arcanestaff'], armor: 'cloth', hp: 95, mana: 100,
    colors: { main: '#2b3a8f', trim: '#e0c25a', metal: '#c9b26a' } },
};

// Class abilities on keys 1 2 3, unlocked by level. Rank II at level 15.
export const ABILITIES = {
  warrior: [
    { id: 'charge', cost: 30, name: "Charge", key: '', level: 1, cd: 6, icon: '', desc: "Rush forward 12 m behind your shield, knocking aside and stunning everything in your path." },
    { id: 'bash', cost: 25, name: "Shield Bash", key: '', level: 2, cd: 6, icon: '', desc: "Slam your shield into the enemies in front of you: damage, knock back and stun them for 2 s." },
    { id: 'shieldwall', cost: 40, name: "Shield Wall", key: '', level: 4, cd: 20, icon: '', desc: "Brace yourself: take 60% less damage from every direction for 6 s." },
    { id: 'cleavestrike', cost: 30, name: "Cleaving Strike", key: '', level: 6, cd: 7, icon: '', desc: "A wide sweeping blow that hits every enemy in front of you." },
    { id: 'laststand', cost: 35, name: "Last Stand", key: '', level: 8, cd: 40, icon: '', desc: "Refuse to fall: heal 30% of your health and take 25% less damage for 10 s." },
    { id: 'shieldthrow', cost: 30, name: "Shield Throw", key: '', level: 10, cd: 9, icon: '', desc: "Hurl your shield: it stuns the first enemy and bounces to two more." },
    { id: 'fortify', cost: 35, name: "Fortify", key: '', level: 12, cd: 25, icon: '', desc: "+50% armour and your guard cannot be broken for 12 s." },
    { id: 'execute', cost: 35, name: "Execute", key: '', level: 14, cd: 10, icon: '', desc: "A massive overhead strike. Deals double damage to enemies below 35% health." },
    { id: 'hamstring', cost: 20, name: "Hamstring", key: '', level: 16, cd: 6, icon: '', desc: "A crippling cut: the target bleeds and is slowed for 6 s." },
    { id: 'bulwark', cost: 50, name: "Bulwark Slam", key: '', level: 18, cd: 18, icon: '', desc: "Slam your shield into the ground: knock back and stun every enemy within 6 m." },
  ],
  berserker: [
    { id: 'earthsplitter', cost: 40, name: "Leap Strike", key: '', level: 1, cd: 7, icon: '', desc: "Leap toward your aim and crash down, shattering the ground and stunning everything around you." },
    { id: 'battlecry', cost: 40, name: "Battle Cry", key: '', level: 2, cd: 20, icon: '', desc: "A furious roar: heal 20% health and deal 30% more damage for 10 s." },
    { id: 'intimshout', cost: 35, name: "Intimidating Shout", key: '', level: 4, cd: 18, icon: '', desc: "A terrifying shout: every enemy within 9 m is stunned with fear for 2.5 s." },
    { id: 'whirlwind', cost: 35, name: "Whirlwind", key: '', level: 6, cd: 10, icon: '', desc: "Spin like a storm for 2 s, cutting everything around you again and again." },
    { id: 'adrenaline', cost: 30, name: "Adrenaline Dump", key: '', level: 8, cd: 20, icon: '', desc: "For 8 s run and sprint 30% faster and deal 20% more damage." },
    { id: 'rampage', cost: 30, name: "Rampage", key: '', level: 10, cd: 22, icon: '', desc: "Swing 40% faster for 8 s." },
    { id: 'groundslam', cost: 40, name: "Ground Slam", key: '', level: 12, cd: 12, icon: '', desc: "Smash a shockwave through the ground that rips through every enemy in a line in front of you." },
    { id: 'bloodrage', cost: 40, name: "Bloodrage", key: '', level: 14, cd: 35, icon: '', desc: "Lose yourself to rage for 10 s: +15% damage, heal 15% of all damage you deal, and regenerate health twice as fast." },
    { id: 'warstomp', cost: 30, name: "War Stomp", key: '', level: 16, cd: 14, icon: '', desc: "Stomp so hard every enemy within 5 m is stunned for 2 s." },
    { id: 'undying', cost: 50, name: "Undying Rage", key: '', level: 18, cd: 60, icon: '', desc: "For 6 s nothing can bring you below 1 health." },
  ],
  ranger: [
    { id: 'spectral', cost: 20, name: "Spectral Arrow", key: '', level: 1, cd: 4, icon: '', desc: "A glowing arrow that pierces every enemy in a line for heavy damage." },
    { id: 'mending', cost: 25, name: "Mending", key: '', level: 2, cd: 15, icon: '', desc: "Light healing magic: restore 25% of your health over 6 s." },
    { id: 'disengage', cost: 20, name: "Disengage", key: '', level: 4, cd: 8, icon: '', desc: "Leap backwards out of danger and slow every enemy near where you stood." },
    { id: 'focus', cost: 30, name: "Hunter's Focus", key: '', level: 6, cd: 20, icon: '', desc: "Attack 35% faster and crit 10% more often for 8 s." },
    { id: 'barkskin', cost: 30, name: "Bark Skin", key: '', level: 8, cd: 20, icon: '', desc: "Your skin hardens like bark: absorb damage equal to 20% of your health for 10 s." },
    { id: 'snaretrap', cost: 25, name: "Snare Trap", key: '', level: 10, cd: 12, icon: '', desc: "Set a trap at your feet. The first enemy to step on it is rooted in place and hurt." },
    { id: 'vanish', cost: 35, name: "Vanish", key: '', level: 12, cd: 25, icon: '', desc: "Turn invisible for 5 s. Enemies lose track of you and your next hit deals double damage." },
    { id: 'explotrap', cost: 35, name: "Explosive Trap", key: '', level: 14, cd: 14, icon: '', desc: "Set a fire trap that explodes when an enemy steps on it, burning everything nearby." },
    { id: 'pinning', cost: 25, name: "Pinning Shot", key: '', level: 16, cd: 9, icon: '', desc: "An arrow that pins the target to the ground: stunned for 2.5 s." },
    { id: 'barrage', cost: 45, name: "Barrage", key: '', level: 18, cd: 16, icon: '', desc: "Loose 10 arrows in quick succession at whatever you are aiming at." },
  ],
  wizard: [
    { id: 'frostnova', cost: 30, name: "Frost Nova", key: '', level: 1, cd: 8, icon: '', desc: "Blast of ice around you: damages and freezes nearby enemies for 3 s." },
    { id: 'blink', cost: 25, name: "Blink", key: '', level: 2, cd: 6, icon: '', desc: "Teleport 14 m in the direction you are moving (or facing)." },
    { id: 'chain', cost: 30, name: "Chain Lightning", key: '', level: 4, cd: 5, icon: '', desc: "A bolt of lightning that leaps between up to 5 enemies." },
    { id: 'manasurge', cost: 0, name: "Mana Surge", key: '', level: 6, cd: 30, icon: '', desc: "For 8 s your spells and abilities cost nothing and deal 20% more damage." },
    { id: 'icebarrier', cost: 40, name: "Ice Barrier", key: '', level: 8, cd: 20, icon: '', desc: "Wrap yourself in ice that absorbs damage equal to 30% of your health for 12 s." },
    { id: 'firering', cost: 35, name: "Ring of Fire", key: '', level: 10, cd: 14, icon: '', desc: "A ring of flame bursts around you, burning every enemy within 6 m for 5 s." },
    { id: 'missiles', cost: 30, name: "Arcane Missiles", key: '', level: 12, cd: 6, icon: '', desc: "Five seeking bolts of arcane force." },
    { id: 'timewarp', cost: 40, name: "Time Warp", key: '', level: 14, cd: 24, icon: '', desc: "Bend time: every enemy within 12 m moves and attacks at half speed for 6 s." },
    { id: 'lightstorm', cost: 50, name: "Lightning Storm", key: '', level: 16, cd: 18, icon: '', desc: "Call down 8 lightning strikes on enemies around your aim." },
    { id: 'inferno', cost: 60, name: "Inferno", key: '', level: 18, cd: 25, icon: '', desc: "A colossal explosion of fire where you aim, setting everything ablaze." },
  ],
};
export const AREA_UNLOCK_LEVEL = 1;
export const RANK2_LEVEL = 15;

// Dual Wield Mastery: ranks earned by kills while dual wielding. Each rank unlocks something.
export const DUAL_MASTERY = [
  { rank: 1, kills: 0, name: 'Twin Fury', desc: 'Right click: a flurry of six alternating strikes on everything in front of you.' },
  { rank: 2, kills: 10, name: 'Quick Hands', desc: 'Attacks 8% faster while dual wielding.' },
  { rank: 3, kills: 25, name: 'Bleeding Edges', desc: 'Off-hand hits cause bleeding: damage over 4 s.' },
  { rank: 4, kills: 45, name: 'Cross Slash', desc: 'Twin Fury ends with a crossing slash that sends a blade wave forward.' },
  { rank: 5, kills: 70, name: 'Flowing Steel', desc: 'Each hit restores a little stamina.' },
  { rank: 6, kills: 100, name: 'Whirling Blades', desc: 'Twin Fury becomes a spinning storm that hits all around you, wider radius.' },
  { rank: 7, kills: 140, name: 'Double Strike', desc: '15% chance for any hit to strike twice.' },
  { rank: 8, kills: 190, name: 'Bladestorm', desc: 'Twin Fury lasts longer and pulls enemies toward you.' },
  { rank: 9, kills: 250, name: 'Dancer', desc: 'Dodging costs 40% less stamina while dual wielding.' },
  { rank: 10, kills: 330, name: 'Master of Twin Blades', desc: 'Twin Fury cooldown halved and +20% dual wield damage.' },
];
export function dualRank(kills) { let r = 1; for (const m of DUAL_MASTERY) if (kills >= m.kills) r = m.rank; return r; }

export const TIERS = [
  { name: 'Driftwood', metal: 'Rusty', col: '#7d6f62', lvl: 1 },
  { name: 'Copper', metal: 'Copper', col: '#c27a45', lvl: 1, ingot: 'copper_ingot' },
  { name: 'Iron', metal: 'Iron', col: '#9aa1a8', lvl: 5, ingot: 'iron_ingot' },
  { name: 'Steel', metal: 'Steel', col: '#c8d0d8', lvl: 9, ingot: 'steel_ingot' },
  { name: 'Mithril', metal: 'Mithril', col: '#9fd6ff', lvl: 13, ingot: 'mithril_ingot' },
  { name: 'Starmetal', metal: 'Starmetal', col: '#c6a0ff', lvl: 17, ingot: 'starmetal_ingot' },
];
export const RARITY = [
  { name: 'Common', col: '#e8e8e8', mult: 1 },
  { name: 'Uncommon', col: '#5fd35f', mult: 1.12 },
  { name: 'Rare', col: '#4fa3ff', mult: 1.25 },
  { name: 'Epic', col: '#c06bff', mult: 1.42 },
  { name: 'Legendary', col: '#ff9a2a', mult: 1.65 },
];

// Stackable items
export const ITEMS = {
  wood: { name: 'Wood', icon: '🪵', desc: 'Logs from a felled tree.', value: 1 },
  planks: { name: 'Planks', icon: '▤', desc: 'Sawn timber for crafting.', value: 3 },
  stone: { name: 'Stone', icon: '🪨', desc: 'Rough stone.', value: 1 },
  copper_ore: { name: 'Copper Ore', icon: '◆', col: '#d0844c', desc: 'Smelt at a forge.', value: 2 },
  copper_ingot: { name: 'Copper Ingot', icon: '▬', col: '#d0844c', desc: 'Used for copper gear.', value: 6 },
  iron_ore: { name: 'Iron Ore', icon: '◆', col: '#a8a8b0', desc: 'Smelt at a forge. Needs a Copper Pickaxe or better.', value: 4 },
  iron_ingot: { name: 'Iron Ingot', icon: '▬', col: '#a8a8b0', desc: 'Used for iron gear.', value: 12 },
  steel_ingot: { name: 'Steel Ingot', icon: '▬', col: '#d8e0e8', desc: 'Iron folded with charcoal.', value: 20 },
  mithril_ore: { name: 'Mithril Ore', icon: '◆', col: '#8fd0ff', desc: 'Shimmering ore. Needs an Iron Pickaxe.', value: 9 },
  mithril_ingot: { name: 'Mithril Ingot', icon: '▬', col: '#8fd0ff', desc: 'Light as a feather, hard as diamond.', value: 30 },
  starmetal_ore: { name: 'Starmetal Ore', icon: '◆', col: '#c6a0ff', desc: 'Fallen from the sky. Needs a Mithril Pickaxe.', value: 16 },
  starmetal_ingot: { name: 'Starmetal Ingot', icon: '▬', col: '#c6a0ff', desc: 'The finest metal known.', value: 50 },
  cotton: { name: 'Cotton', icon: '☁', desc: 'Soft fibre. Spin into linen at a loom.', value: 1 },
  linen: { name: 'Linen', icon: '▦', col: '#e8dfc8', desc: 'Woven cloth.', value: 4 },
  raw_hide: { name: 'Raw Hide', icon: '🟫', desc: 'Skinned from a beast. Tan it at a tanning rack.', value: 2 },
  leather: { name: 'Leather', icon: '▩', col: '#8a5a32', desc: 'Tanned hide.', value: 6 },
  spider_silk: { name: 'Spider Silk', icon: '🕸', desc: 'Strong, sticky thread.', value: 4 },
  silk_cloth: { name: 'Silk Cloth', icon: '▦', col: '#dcd6ff', desc: 'Fine cloth for mage robes.', value: 12 },
  healroot: { name: 'Healroot', icon: '🌿', desc: 'A healing herb. Brew at an alchemy table.', value: 2 },
  raw_meat: { name: 'Raw Meat', icon: '🥩', desc: 'Cook it at a campfire.', value: 1 },
  crab_meat: { name: 'Crab Meat', icon: '🦀', desc: 'Cook it at a campfire.', value: 1 },
  bone: { name: 'Old Bone', icon: '🦴', desc: 'From restless dead.', value: 2 },
  troll_tusk: { name: 'Troll Tusk', icon: '🦷', desc: 'A trophy.', value: 8 },
  ember_core: { name: 'Ember Core', icon: '🔥', desc: 'Still warm. Burns forever.', value: 10 },
  wolf_fang: { name: 'Wolf Fang', icon: '🦷', desc: 'Sharp.', value: 2 },
  goblin_ear: { name: 'Goblin Ear', icon: '👂', desc: 'Pointy, green and smelly. Proof of a goblin slain.', value: 3 },
  bandit_badge: { name: 'Bandit Badge', icon: '⛉', desc: 'Proof of a bandit slain.', value: 3 },
  // consumables
  potion_heal: { name: 'Healing Potion', icon: '🧪', col: '#ff5050', desc: 'Restores 40% health. Press R.', value: 8, use: { heal: 0.4 } },
  potion_heal2: { name: 'Greater Healing Potion', icon: '🧪', col: '#ff2070', desc: 'Restores 70% health. Press R.', value: 25, use: { heal: 0.7 } },
  crab_cake: { name: 'Crab Cake', icon: '🍘', desc: 'Restores 25% health over 10 s. Food buff Sea Legs: +10% move speed for 5 min.', value: 4, use: { regen: 0.25 } },
  roast_meat: { name: 'Roast Meat', icon: '🍖', desc: 'Restores 35% health over 10 s. Food buff Hearty: +10% maximum health for 5 min.', value: 5, use: { regen: 0.35 } },
  herb_roast: { name: 'Herb-Roasted Meat', icon: '🍖', desc: 'Restores 40% health over 10 s. Food buff Vigour: +25% health and endurance regeneration for 5 min.', value: 8, use: { regen: 0.4 } },
  hunter_stew: { name: "Hunter's Stew", icon: '🍲', desc: "Restores 45% health over 10 s. Food buff Hunter's Strength: +8% damage for 5 min.", value: 12, use: { regen: 0.45 } },
  ember_skewer: { name: 'Ember Skewer', icon: '🍢', desc: 'Restores 40% health over 10 s. Food buff Fire Belly: +6% critical chance for 5 min.', value: 16, use: { regen: 0.4 } },
  bandage: { name: 'Linen Bandage', icon: '🩹', desc: 'Restores 20% health over 6 s.', value: 3, use: { regen: 0.2, time: 6 } },
};

// Food buffs: only one at a time, eating another replaces it
export const FOOD_BUFFS = {
  roast_meat: { name: 'Hearty', desc: '+10% maximum health', hp: 0.1 },
  crab_cake: { name: 'Sea Legs', desc: '+10% move speed', speed: 0.1 },
  herb_roast: { name: 'Vigour', desc: '+25% health and endurance regeneration', regen: 0.25 },
  hunter_stew: { name: "Hunter's Strength", desc: '+8% damage', dmg: 0.08 },
  ember_skewer: { name: 'Fire Belly', desc: '+6% critical chance', crit: 0.06 },
};
export const FOOD_TIME = 300;
export const TOOLS = {
  hatchet: { name: 'Hatchet', icon: '🪓', desc: 'For chopping trees.' },
  pickaxe: { name: 'Pickaxe', icon: '⛏', desc: 'For mining stone and ore.' },
  knife: { name: 'Skinning Knife', icon: '🔪', desc: 'For skinning beasts.' },
};
// pickaxe tier needed to mine each node
export const NODE_TYPES = {
  tree_oak: { name: 'Oak Tree', verb: 'Chop', tool: 'hatchet', tier: 1, item: 'wood', amt: [3, 5], time: 2.2, respawn: 90 },
  tree_pine: { name: 'Pine Tree', verb: 'Chop', tool: 'hatchet', tier: 1, item: 'wood', amt: [3, 5], time: 2.2, respawn: 90 },
  tree_birch: { name: 'Birch Tree', verb: 'Chop', tool: 'hatchet', tier: 1, item: 'wood', amt: [2, 4], time: 2.0, respawn: 90 },
  tree_palm: { name: 'Palm Tree', verb: 'Chop', tool: 'hatchet', tier: 1, item: 'wood', amt: [2, 3], time: 1.8, respawn: 90 },
  tree_snow: { name: 'Frost Pine', verb: 'Chop', tool: 'hatchet', tier: 1, item: 'wood', amt: [3, 5], time: 2.4, respawn: 90 },
  tree_dead: { name: 'Charred Tree', verb: 'Chop', tool: 'hatchet', tier: 1, item: 'wood', amt: [2, 4], time: 2.0, respawn: 90 },
  rock: { name: 'Boulder', verb: 'Mine', tool: 'pickaxe', tier: 1, item: 'stone', amt: [2, 4], time: 2.0, respawn: 80 },
  copper: { name: 'Copper Vein', verb: 'Mine', tool: 'pickaxe', tier: 1, item: 'copper_ore', amt: [2, 3], time: 2.4, respawn: 100, extra: 'stone' },
  iron: { name: 'Iron Vein', verb: 'Mine', tool: 'pickaxe', tier: 2, item: 'iron_ore', amt: [2, 3], time: 2.8, respawn: 110, extra: 'stone' },
  mithril: { name: 'Mithril Vein', verb: 'Mine', tool: 'pickaxe', tier: 3, item: 'mithril_ore', amt: [1, 3], time: 3.2, respawn: 130 },
  starmetal: { name: 'Starmetal Vein', verb: 'Mine', tool: 'pickaxe', tier: 4, item: 'starmetal_ore', amt: [1, 2], time: 3.5, respawn: 150 },
  cotton: { name: 'Cotton Plant', verb: 'Gather', tool: null, item: 'cotton', amt: [2, 3], time: 1.2, respawn: 60 },
  healroot: { name: 'Healroot', verb: 'Gather', tool: null, item: 'healroot', amt: [1, 2], time: 1.2, respawn: 70 },
};
export const TOOL_TIER_NAMES = ['', 'Crude', 'Copper', 'Iron', 'Mithril'];

export const STATIONS = {
  workbench: 'Workbench', forge: 'Forge', loom: 'Loom', tanning: 'Tanning Rack', campfire: 'Campfire', alchemy: 'Alchemy Table',
};

const ARMOR_SLOTS = { head: 'Head', shoulders: 'Shoulders', chest: 'Chest', wrists: 'Wrists', hands: 'Hands', waist: 'Waist', legs: 'Legs', feet: 'Feet' };
export const ARMOR_NAMES = {
  cloth: { head: 'Hat', shoulders: 'Mantle', chest: 'Robe', wrists: 'Cuffs', hands: 'Gloves', waist: 'Sash', legs: 'Leggings', feet: 'Slippers' },
  leather: { head: 'Hood', shoulders: 'Spaulders', chest: 'Jerkin', wrists: 'Bracers', hands: 'Gloves', waist: 'Belt', legs: 'Breeches', feet: 'Boots' },
  mail: { head: 'Helm', shoulders: 'Pauldrons', chest: 'Hauberk', wrists: 'Vambraces', hands: 'Gauntlets', waist: 'Girdle', legs: 'Greaves', feet: 'Sabatons' },
};
export const ARMOR_TIER_NAMES = {
  cloth: ['Ragged', 'Linen', 'Woven', 'Silk', 'Starweave', 'Archmage'],
  leather: ['Worn', 'Hide', 'Tanned', 'Hardened', 'Shadowhide', 'Wildlord'],
  mail: ['Rusty', 'Copper', 'Iron', 'Steel', 'Mithril', 'Starmetal'],
};
export const ARMOR_SLOT_LIST = Object.keys(ARMOR_SLOTS);
export const SLOT_LABEL = Object.assign({ neck: 'Neck', back: 'Back', ring1: 'Ring', ring2: 'Ring', trinket: 'Charm', w1: 'Main Weapon', w2: 'Second Weapon' }, ARMOR_SLOTS);
// accessories: neck (amulet), back (cloak), ring, trinket (charm)
export const ACC = {
  neck: { names: ['', 'Copper Amulet', 'Iron Pendant', 'Steel Torc', 'Mithril Amulet', 'Starmetal Medallion'] },
  back: { names: ['', 'Linen Cloak', 'Woolen Cloak', 'Silk Cape', 'Mithril-Thread Cloak', 'Starweave Mantle'] },
  ring: { names: ['', 'Copper Ring', 'Iron Band', 'Steel Signet', 'Mithril Ring', 'Starmetal Ring'] },
  trinket: { names: ['', 'Lucky Wolf Fang', 'Carved Bone Charm', 'Troll-Tusk Talisman', 'Ember Heart', 'Star Shard'] },
};

export function weaponBaseDmg(tier) { return 9 + tier * 9; }
export function armorBase(tier, slot) { const m = { head: 0.7, shoulders: 0.6, chest: 1.3, wrists: 0.35, hands: 0.45, waist: 0.4, legs: 1.0, feet: 0.6 }[slot]; return Math.max(1, Math.round((3 + tier * 5) * m)); }

// Build recipe list
export const RECIPES = [];
(function buildRecipes() {
  const R = (o) => RECIPES.push(o);
  R({ id: 'planks', out: 'planks', n: 1, station: 'workbench', need: { wood: 2 }, cat: 'Refining', lvl: 1 });
  R({ id: 'copper_ingot', out: 'copper_ingot', n: 1, station: 'forge', need: { copper_ore: 2 }, cat: 'Refining', lvl: 1 });
  R({ id: 'iron_ingot', out: 'iron_ingot', n: 1, station: 'forge', need: { iron_ore: 2 }, cat: 'Refining', lvl: 4 });
  R({ id: 'steel_ingot', out: 'steel_ingot', n: 1, station: 'forge', need: { iron_ingot: 2, wood: 2 }, cat: 'Refining', lvl: 8 });
  R({ id: 'mithril_ingot', out: 'mithril_ingot', n: 1, station: 'forge', need: { mithril_ore: 2 }, cat: 'Refining', lvl: 11 });
  R({ id: 'starmetal_ingot', out: 'starmetal_ingot', n: 1, station: 'forge', need: { starmetal_ore: 2, ember_core: 1 }, cat: 'Refining', lvl: 15 });
  R({ id: 'linen', out: 'linen', n: 1, station: 'loom', need: { cotton: 3 }, cat: 'Refining', lvl: 1 });
  R({ id: 'silk_cloth', out: 'silk_cloth', n: 1, station: 'loom', need: { spider_silk: 3 }, cat: 'Refining', lvl: 5 });
  R({ id: 'leather', out: 'leather', n: 1, station: 'tanning', need: { raw_hide: 2 }, cat: 'Refining', lvl: 1 });
  R({ id: 'bandage', out: 'bandage', n: 2, station: 'loom', need: { linen: 1 }, cat: 'Consumables', lvl: 1 });
  R({ id: 'crab_cake', out: 'crab_cake', n: 1, station: 'campfire', need: { crab_meat: 1 }, cat: 'Consumables', lvl: 1 });
  R({ id: 'roast_meat', out: 'roast_meat', n: 1, station: 'campfire', need: { raw_meat: 1 }, cat: 'Consumables', lvl: 1 });
  R({ id: 'herb_roast', out: 'herb_roast', n: 1, station: 'campfire', need: { raw_meat: 1, healroot: 1 }, cat: 'Consumables', lvl: 3 });
  R({ id: 'hunter_stew', out: 'hunter_stew', n: 1, station: 'campfire', need: { raw_meat: 2, healroot: 1 }, cat: 'Consumables', lvl: 6 });
  R({ id: 'ember_skewer', out: 'ember_skewer', n: 1, station: 'campfire', need: { raw_meat: 1, ember_core: 1 }, cat: 'Consumables', lvl: 12 });
  R({ id: 'potion_heal', out: 'potion_heal', n: 1, station: 'alchemy', need: { healroot: 2 }, cat: 'Consumables', lvl: 1 });
  R({ id: 'potion_heal2', out: 'potion_heal2', n: 1, station: 'alchemy', need: { healroot: 3, ember_core: 1 }, cat: 'Consumables', lvl: 12 });
  // tools
  R({ id: 'tool_pick2', tool: 'pickaxe', tier: 2, station: 'forge', need: { copper_ingot: 3, planks: 2 }, cat: 'Tools', lvl: 3 });
  R({ id: 'tool_pick3', tool: 'pickaxe', tier: 3, station: 'forge', need: { iron_ingot: 4, planks: 2 }, cat: 'Tools', lvl: 8 });
  R({ id: 'tool_pick4', tool: 'pickaxe', tier: 4, station: 'forge', need: { mithril_ingot: 4, planks: 2 }, cat: 'Tools', lvl: 13 });
  R({ id: 'tool_hatchet2', tool: 'hatchet', tier: 2, station: 'forge', need: { copper_ingot: 2, planks: 2 }, cat: 'Tools', lvl: 2 });
  // weapons, tiers 1-5
  for (const wt in WEAPON_TYPES) {
    const W = WEAPON_TYPES[wt];
    for (let t = 1; t <= 5; t++) {
      const T = TIERS[t];
      const need = {};
      if (W.kind === 'staff') { need.planks = 2 + t; need[T.ingot] = 1 + Math.floor(t / 2); if (t >= 2) need.linen = 2; if (t >= 4) need.ember_core = t - 3; }
      else if (W.kind === 'bow') { need.planks = 3 + t; need.linen = 2; if (t >= 2) need.leather = 1 + Math.floor(t / 2); need[T.ingot] = Math.max(1, t - 1); }
      else { need[T.ingot] = (W.hands === 'two' ? 4 : W.hands === 'dual' ? 4 : 3) + t - 1; need.planks = 1 + Math.floor(t / 2); if (W.hands === 'shield') need.planks += 2; if (t >= 2) need.leather = 1; }
      const station = W.kind === 'melee' ? 'forge' : 'workbench';
      R({ id: 'w_' + wt + '_' + t, weapon: wt, tier: t, station, need, cat: 'Weapons', lvl: T.lvl });
    }
  }
  // armor
  for (const kind of ['cloth', 'leather', 'mail']) {
    for (const slot of ARMOR_SLOT_LIST) {
      for (let t = 1; t <= 5; t++) {
        const n = slot === 'chest' ? 4 : slot === 'legs' ? 3 : slot === 'wrists' || slot === 'waist' ? 1 : 2;
        const need = {};
        const metal = TIERS[t].ingot;
        if (kind === 'cloth') { need[t >= 3 ? 'silk_cloth' : 'linen'] = n + t - 1; if (t >= 2) need.leather = 1; if (t >= 4) need[metal] = 1; }
        if (kind === 'leather') { need.leather = n + t - 1; need.linen = 1; if (t >= 3) need[metal] = 1 + Math.floor(t / 3); }
        if (kind === 'mail') { need[metal] = n + t - 1; need.leather = 1; if (t === 1) need.linen = 1; }
        const station = kind === 'cloth' ? 'loom' : kind === 'leather' ? 'tanning' : 'forge';
        R({ id: 'a_' + kind + '_' + slot + '_' + t, armor: kind, slot, tier: t, station, need, cat: 'Armor', lvl: TIERS[t].lvl });
      }
    }
  }
  // accessories
  for (let t = 1; t <= 5; t++) {
    const metal = TIERS[t].ingot;
    R({ id: 'acc_ring_' + t, acc: 'ring', tier: t, station: 'forge', need: { [metal]: 2 + t, ...(t >= 3 ? { ember_core: t - 2 } : {}) }, cat: 'Jewelry', lvl: TIERS[t].lvl });
    R({ id: 'acc_neck_' + t, acc: 'neck', tier: t, station: 'forge', need: { [metal]: 3 + t, linen: 1, ...(t >= 3 ? { ember_core: t - 2 } : {}) }, cat: 'Jewelry', lvl: TIERS[t].lvl });
    R({ id: 'acc_back_' + t, acc: 'back', tier: t, station: 'loom', need: { [t >= 3 ? 'silk_cloth' : 'linen']: 3 + t, leather: 1, ...(t >= 4 ? { [metal]: 1 } : {}) }, cat: 'Armor', lvl: TIERS[t].lvl });
  }
})();

// ---- Zones ----
export const ZONES = [
  { id: 'coast', name: 'Driftwood Coast', lv: '1-4', col: '#f0d890' },
  { id: 'meadow', name: 'Sunmeadow', lv: '1-4', col: '#9ad66a' },
  { id: 'wood', name: 'Whisperwood', lv: '4-9', col: '#3f8a3a' },
  { id: 'highlands', name: 'Frostpeak Highlands', lv: '9-14', col: '#d8e6f2' },
  { id: 'ashlands', name: 'The Ashlands', lv: '14-20', col: '#c4462a' },
];

// ---- Mobs ----
// shape: quad (wolf/bear/boar/deer/rabbit/hound), crab, spider, humanoid kinds
export const MOBS = {
  crab: { armor: 0.3, name: 'Shore Crab', shape: 'crab', hpM: 0.55, dmgM: 0.5, aggro: 0, speed: 2.2, size: 0.55, loot: { crab_meat: [1, 1, 0.9] }, skin: false, col: '#d0502a' },
  rabbit: { name: 'Meadow Hare', shape: 'quad', variant: 'rabbit', hpM: 0.35, dmgM: 0, aggro: 0, flee: true, speed: 6, size: 1.0, loot: { raw_meat: [1, 1, 0.7] }, skin: true, col: '#b8a184' },
  deer: { name: 'Coast Deer', shape: 'quad', variant: 'deer', hpM: 0.7, dmgM: 0, aggro: 0, flee: true, speed: 7, size: 1.1, loot: { raw_meat: [1, 2, 1] }, skin: true, col: '#a4703e' },
  wolfpup: { name: 'Wolf Pup', shape: 'quad', variant: 'wolf', hpM: 0.6, dmgM: 0.5, aggro: 0, speed: 4.5, size: 0.55, loot: { wolf_fang: [1, 1, 0.5], raw_meat: [1, 1, 0.5] }, skin: true, col: '#8d8579' },
  bearcub: { name: 'Bear Cub', shape: 'quad', variant: 'bear', hpM: 0.8, dmgM: 0.6, aggro: 0, speed: 3.8, size: 0.7, loot: { raw_meat: [1, 2, 0.7] }, skin: true, col: '#6b4a2e' },
  wolf: { name: 'Grey Wolf', shape: 'quad', variant: 'wolf', hpM: 0.9, dmgM: 1, aggro: 14, speed: 6.5, size: 1.0, loot: { wolf_fang: [1, 2, 0.6], raw_meat: [1, 1, 0.5] }, skin: true, col: '#6f6a64' },
  boar: { name: 'Wild Boar', shape: 'quad', variant: 'boar', hpM: 1.1, dmgM: 1.0, aggro: 9, speed: 5.5, size: 0.9, loot: { raw_meat: [1, 2, 0.8] }, skin: true, col: '#4e3a2c' },
  spider: { name: 'Forest Spider', shape: 'spider', hpM: 0.9, dmgM: 1.05, aggro: 13, speed: 5.5, size: 1.0, loot: { spider_silk: [1, 2, 0.75] }, skin: false, col: '#2a2420' },
  goblin: { name: 'Goblin Raider', shape: 'human', variant: 'goblin', hpM: 0.85, dmgM: 0.95, aggro: 13, speed: 5.2, size: 1.0, loot: { goblin_ear: [1, 1, 0.8], copper_ore: [1, 2, 0.2], raw_meat: [1, 1, 0.2] }, gold: [1, 6], skin: false, col: '#6a8a3a' },
  goblin_brute: { armor: 0.2, name: 'Goblin Brute', shape: 'human', variant: 'goblin', hpM: 1.6, dmgM: 1.3, aggro: 13, speed: 4.6, size: 1.35, loot: { goblin_ear: [1, 2, 0.9], iron_ore: [1, 2, 0.3] }, gold: [3, 10], skin: false, col: '#5a7a32' },
  rat: { name: 'Giant Rat', shape: 'quad', variant: 'rabbit', hpM: 0.45, dmgM: 0.6, aggro: 8, speed: 5.5, size: 0.9, loot: { raw_meat: [1, 1, 0.4] }, skin: true, col: '#5a4e44' },
  boarlet: { name: 'Boarlet', shape: 'quad', variant: 'boar', hpM: 0.6, dmgM: 0.5, aggro: 0, speed: 4.5, size: 0.6, loot: { raw_meat: [1, 1, 0.8] }, skin: true, col: '#6a4e38' },
  goblin_slinger: { name: 'Goblin Slinger', shape: 'human', variant: 'goblin', ranged: true, proj: 'rock', hpM: 0.7, dmgM: 0.85, aggro: 17, speed: 5, size: 0.95, loot: { goblin_ear: [1, 1, 0.8], stone: [1, 2, 0.4] }, gold: [1, 6], skin: false, col: '#6a8a3a' },
  bandit: { armor: 0.15, name: 'Bandit', shape: 'human', variant: 'bandit', hpM: 1.0, dmgM: 1.1, aggro: 15, speed: 4.8, size: 1.0, loot: { bandit_badge: [1, 1, 0.8] }, gold: [3, 9], skin: false, col: '#5a4030' },
  bandit_boss: { armor: 0.25, name: 'Garrick the Cutthroat', shape: 'human', variant: 'bandit', elite: true, hpM: 4, dmgM: 1.5, aggro: 18, speed: 5, size: 1.2, loot: { bandit_badge: [2, 3, 1] }, gold: [30, 60], skin: false, col: '#3a1a14', gearChance: 1 },
  tiger: { name: 'Shadow Tiger', shape: 'quad', variant: 'tiger', hpM: 1.15, dmgM: 1.2, aggro: 14, speed: 7.5, size: 1.05, loot: { raw_meat: [1, 2, 0.8] }, skin: true, col: '#d07a2a' },
  snowtiger: { name: 'Snow Tiger', shape: 'quad', variant: 'tiger', hpM: 1.25, dmgM: 1.25, aggro: 15, speed: 7.8, size: 1.15, loot: { raw_meat: [1, 2, 0.8] }, skin: true, col: '#e8e8ec' },
  bear: { armor: 0.1, name: 'Brown Bear', shape: 'quad', variant: 'bear', hpM: 1.5, dmgM: 1.25, aggro: 11, speed: 5.5, size: 1.5, loot: { raw_meat: [2, 3, 1] }, skin: true, col: '#5a3a22' },
  frostwolf: { name: 'Frost Wolf', shape: 'quad', variant: 'wolf', hpM: 1.0, dmgM: 1.1, aggro: 16, speed: 7, size: 1.15, loot: { wolf_fang: [1, 2, 0.7] }, skin: true, col: '#dfe8f0' },
  skeleton: { armor: 0.35, name: 'Skeleton Warrior', shape: 'human', variant: 'skeleton', hpM: 1.0, dmgM: 1.15, aggro: 15, speed: 4.2, size: 1.0, loot: { bone: [1, 3, 0.9] }, gold: [4, 12], skin: false, col: '#e8e0c8' },
  troll: { armor: 0.25, name: 'Mountain Troll', shape: 'human', variant: 'troll', hpM: 2.2, dmgM: 1.5, aggro: 14, speed: 4.5, size: 1.7, loot: { troll_tusk: [1, 1, 0.5] }, gold: [6, 15], skin: true, col: '#7c8a74' },
  troll_king: { armor: 0.35, name: 'Grumbak the Troll King', shape: 'human', variant: 'troll', elite: true, hpM: 6, dmgM: 1.8, aggro: 20, speed: 5, size: 2.4, loot: { troll_tusk: [2, 3, 1] }, gold: [60, 120], skin: true, col: '#5e6e58', gearChance: 1 },
  ashhound: { name: 'Ash Hound', shape: 'quad', variant: 'hound', hpM: 1.0, dmgM: 1.2, aggro: 18, speed: 7.5, size: 1.15, loot: { ember_core: [1, 1, 0.25], raw_meat: [1, 1, 0.4] }, skin: true, col: '#2a2220' },
  imp: { name: 'Fire Imp', shape: 'human', variant: 'imp', ranged: true, hpM: 0.8, dmgM: 1.15, aggro: 20, speed: 5, size: 0.7, loot: { ember_core: [1, 1, 0.6] }, gold: [5, 12], skin: false, col: '#c33a1a' },
  golem: { armor: 0.5, name: 'Magma Golem', shape: 'human', variant: 'golem', hpM: 2.4, dmgM: 1.4, aggro: 12, speed: 3.6, size: 1.9, loot: { ember_core: [1, 2, 0.8], starmetal_ore: [1, 1, 0.3] }, gold: [8, 18], skin: false, col: '#3a302a' },
  tyrant: { armor: 0.4, name: 'Vorgath the Ash Tyrant', shape: 'human', variant: 'tyrant', boss: true, elite: true, hpM: 16, dmgM: 2.0, aggro: 30, speed: 5, size: 3.4, loot: { ember_core: [4, 6, 1], starmetal_ore: [3, 5, 1] }, gold: [300, 500], skin: false, col: '#2a1410', gearChance: 1, gearRarity: 4 },
};

// Spawn regions [type, x, z, radius, count, lvMin, lvMax]
export const SPAWNS = [
  ['crab', 70, 440, 60, 8, 1, 1], ['crab', -80, 442, 60, 6, 1, 2],
  ['wolf', 40, 260, 110, 9, 1, 3], ['bear', -60, 280, 70, 4, 2, 4], ['tiger', 120, 250, 70, 4, 2, 4], ['wolf', -150, 330, 60, 6, 1, 2], ['bear', 170, 340, 60, 3, 2, 3], ['tiger', -120, 200, 60, 3, 3, 4], ['wolf', 100, 330, 50, 5, 1, 2], ['deer', -110, 240, 90, 2, 2, 3], ['deer', 140, 230, 90, 1, 2, 3],
  ['wolfpup', 120, 290, 60, 6, 1, 2], ['wolfpup', -120, 300, 60, 5, 1, 3], ['bearcub', 80, 200, 70, 5, 2, 3], ['bearcub', -60, 190, 70, 5, 2, 4],
  ['wolf', 90, 90, 80, 7, 4, 6], ['wolf', -140, 80, 70, 6, 5, 6], ['boar', 160, 40, 70, 6, 5, 7], ['boar', -60, 130, 60, 4, 4, 5],
  ['tiger', -60, 20, 50, 3, 7, 9], ['tiger', 240, 70, 50, 2, 7, 8], ['snowtiger', -330, -270, 60, 3, 11, 13],
  ['spider', -180, 10, 70, 8, 6, 8], ['spider', 230, 120, 60, 5, 6, 7],
  ['bandit', 200, -60, 40, 7, 7, 9], ['bandit_boss', 205, -68, 3, 1, 9, 9],
  ['bear', -120, -170, 80, 5, 9, 11], ['frostwolf', -260, -230, 90, 8, 10, 12], ['frostwolf', -380, -330, 80, 6, 11, 13],
  ['skeleton', -330, -420, 45, 10, 11, 13], ['troll', -200, -430, 70, 6, 12, 14], ['troll_king', -150, -480, 4, 1, 15, 15],
  ['ashhound', 230, -260, 80, 8, 14, 16], ['imp', 320, -300, 70, 8, 15, 17], ['golem', 280, -400, 80, 7, 16, 18], ['imp', 160, -380, 60, 5, 16, 17],
  ['tyrant', 400, -456, 3, 1, 20, 20],
];
// goblin camps: [x, z, level min, level max]
export const GOBLIN_CAMPS = [[160, 300, 2, 3], [-165, 230, 3, 4], [-95, 290, 2, 3], [120, 170, 4, 5], [70, 40, 5, 6], [-115, -5, 6, 8], [150, -120, 7, 9], [-300, -235, 10, 12], [-80, -260, 11, 13]];
// Mob special abilities (see mobs.js): bite (bleed), charge, maul, pounce, web, poison, pound, nova, frenzy, bash, regen
export const MOB_ABILITIES = {
  wolfpup: ['bite'], wolf: ['bite'], frostwolf: ['bite', 'frostbite'], ashhound: ['bite', 'firebite'],
  bearcub: ['maul'], bear: ['charge', 'maul'], boar: ['charge'], tiger: ['pounce', 'maul', 'bite'], snowtiger: ['pounce', 'maul', 'bite'],
  spider: ['web', 'poison'], bandit: ['bash'], bandit_boss: ['bash', 'charge'], skeleton: ['bash'],
  troll: ['pound', 'regen'], troll_king: ['pound', 'regen', 'charge'], golem: ['pound'], imp: ['nova'], goblin: ['frenzy'], goblin_slinger: [], goblin_brute: ['charge', 'pound'], rat: ['bite'], boarlet: ['charge'],
};
export const mobHp = (lv, M) => Math.round((34 + lv * 26 + lv * lv * 1.2) * M.hpM);
export const mobDmg = (lv, M) => (4 + lv * 2.6) * M.dmgM;
export const mobXp = (lv, M) => Math.round((12 + lv * 9) * (M.elite ? 4 : 1) * (M.boss ? 3 : 1) * Math.max(0.6, Math.min(1.6, M.hpM)));

// ---- NPCs ----
// role: quest giver / merchant / villager
export const NPCS = {
  maren: { name: 'Elder Maren', title: 'Village Elder', race: 'human', sex: 'f', outfit: 'elder', x: 2.2, z: 363.1, hello: 'The sea gives and the sea takes, stranger. Today it seems it gave us you.' },
  bram: { name: 'Bram', title: 'Woodcutter', race: 'human', sex: 'm', outfit: 'worker', x: -14.3, z: 355.4, hello: 'Good honest work, swinging an axe. Clears the head.' },
  torvin: { name: 'Torvin Ironhand', title: 'Blacksmith', race: 'dwarf', sex: 'm', outfit: 'smith', x: 16.5, z: 352.1, hello: 'Mind the sparks, lad. Or lass. Or whatever ye are under all that salt.' },
  elsa: { name: 'Elsa', title: 'Weaver', race: 'elf', sex: 'f', outfit: 'weaver', x: -12.1, z: 369.7, hello: 'Every thread has a story. Yours is still being spun.' },
  lyra: { name: 'Lyra', title: 'Huntress', race: 'elf', sex: 'f', outfit: 'hunter', x: 19.8, z: 370.8, hello: 'Walk soft. The meadow has ears.' },
  pell: { name: 'Old Pell', title: 'Fisherman', race: 'human', sex: 'm', outfit: 'fisher', x: -7, z: 398, hello: 'Fish ain\'t biting. Crabs are, though. Ha!' },
  odo: { name: 'Odo', title: 'Merchant', race: 'human', sex: 'm', outfit: 'merchant', x: 7.7, z: 357.6, merchant: true, hello: 'Buying, selling, a bit of both? Odo has it all. Well. Some of it.' },
  kael: { name: 'Scout Kael', title: 'Whisperwood Warden', race: 'elf', sex: 'm', outfit: 'hunter', x: -36, z: 58, hello: 'Keep your blade close in these woods.' },
  fen: { name: 'Fen', title: 'Herbalist', race: 'human', sex: 'f', outfit: 'weaver', x: -44, z: 70, hello: 'Healroot grows where the light breaks through the canopy.' },
  hilda: { name: 'Captain Hilda', title: 'Stonewatch Captain', race: 'dwarf', sex: 'f', outfit: 'smith', x: -222, z: -296, hello: 'Cold enough to freeze your beard off. If ye had one.' },
  dorn: { name: 'Dorn', title: 'Miner', race: 'dwarf', sex: 'm', outfit: 'worker', x: -234, z: -286, merchant: true, hello: 'There\'s mithril in them peaks. And trolls. Mostly trolls.' },
  sael: { name: 'Warden Sael', title: 'Emberwatch Warden', race: 'elf', sex: 'm', outfit: 'elder', x: 238, z: -326, merchant: true, hello: 'The ash remembers the fire that made it. So should you.' },
};

// Quests. obj types: talk(npc), collect(item,n), kill(mob,n), craft(item|cat,n), equip(slot), reach(x,z,r,label)
export const QUESTS = [
  { id: 'q_stranger', giver: 'maren', turnin: 'bram', lvl: 1, title: 'A Stranger from the Sea',
    text: 'You washed up with nothing but salt in your hair. If you mean to stay, you\'ll need to earn your keep. Bram the woodcutter, by the workbench, can teach you to fell a tree.',
    done: 'Maren sent you? Then let\'s get you an axe.', obj: [{ t: 'talk', npc: 'bram', label: 'Speak with Bram the woodcutter' }], xp: 40, gold: 2 },
  { id: 'q_timber', giver: 'bram', turnin: 'bram', lvl: 1, req: ['q_stranger'], title: 'Timber for the Shore',
    text: 'Take this old hatchet. Walk up to any tree, look at it and press E to chop. Bring me 6 Wood and we\'ll see what you\'re made of.',
    give: { tool: ['hatchet', 1] }, done: 'Not bad at all! Your arms will thank you later. Or curse you.',
    obj: [{ t: 'collect', item: 'wood', n: 6, label: 'Chop trees for Wood' }], take: { wood: 0 }, xp: 70, gold: 4, items: { potion_heal: 2 } },
  { id: 'q_planks', giver: 'bram', turnin: 'bram', lvl: 1, req: ['q_timber'], title: 'The Workbench',
    text: 'Logs are no good to anyone as they are. Stand at the workbench beside me, press E, and saw your wood into 3 Planks.',
    done: 'Clean cuts. You\'ve a knack for this.', obj: [{ t: 'craft', item: 'planks', n: 3, label: 'Craft Planks at the Workbench' }], xp: 70, gold: 4 },
  { id: 'q_ore', giver: 'torvin', turnin: 'torvin', lvl: 1, req: ['q_stranger'], title: 'Stone and Copper',
    text: 'So ye want to make something useful. Here, a crude pick. Go mine boulders for Stone and the green-streaked rocks for Copper Ore. Look for them on the hills north of the village.',
    give: { tool: ['pickaxe', 1] }, done: 'Good ore, that. Now we work it.',
    obj: [{ t: 'collect', item: 'stone', n: 4, label: 'Mine Stone from boulders' }, { t: 'collect', item: 'copper_ore', n: 4, label: 'Mine Copper Ore' }], xp: 90, gold: 5 },
  { id: 'q_smelt', giver: 'torvin', turnin: 'torvin', lvl: 1, req: ['q_ore'], title: 'Into the Fire',
    text: 'Ore must be smelted. Use the forge here. Two ore makes one ingot. Make me 2 Copper Ingots.',
    done: 'Look at that shine!', obj: [{ t: 'craft', item: 'copper_ingot', n: 2, label: 'Smelt Copper Ingots at the Forge' }], xp: 90, gold: 5 },
  { id: 'q_blade', giver: 'torvin', turnin: 'torvin', lvl: 2, req: ['q_smelt', 'q_planks'], title: 'Your First Real Weapon',
    text: 'That driftwood toy won\'t last. Craft yourself a Copper weapon. Melee weapons at the forge, bows and staves at the workbench. Then equip it from your bag (I).',
    done: 'Now that\'s a weapon. Try not to lose it in the sea.', obj: [{ t: 'craft', cat: 'Weapons', n: 1, label: 'Craft any Copper weapon' }], xp: 140, gold: 8 },
  { id: 'q_cotton', giver: 'elsa', turnin: 'elsa', lvl: 1, req: ['q_stranger'], title: 'Soft as Cotton',
    text: 'The white bushes in the meadow are cotton. Gather some for me and spin it into Linen on my loom. Three cotton makes one linen.',
    done: 'Lovely. You have patient hands.', obj: [{ t: 'collect', item: 'cotton', n: 6, label: 'Gather Cotton in the meadow' }, { t: 'craft', item: 'linen', n: 2, label: 'Weave Linen at the Loom' }], xp: 100, gold: 5 },
  { id: 'q_hides', giver: 'lyra', turnin: 'lyra', lvl: 1, req: ['q_stranger'], title: 'Hides and Hunting',
    text: 'Here is a skinning knife. Hunt hares, deer, wolf pups or bear cubs in the meadow. They won\'t attack unless you do. When one falls, look at it and press E to skin it. Then tan the hides on my rack.',
    give: { tool: ['knife', 1] }, done: 'Clean work. The meadow provides.',
    obj: [{ t: 'collect', item: 'raw_hide', n: 4, label: 'Skin beasts for Raw Hide' }, { t: 'craft', item: 'leather', n: 2, label: 'Tan Leather at the Tanning Rack' }], xp: 120, gold: 6 },
  { id: 'q_garb', giver: 'elsa', turnin: 'elsa', lvl: 2, req: ['q_cotton', 'q_hides'], title: 'Proper Garb',
    text: 'You\'re still in rags. Craft a piece of armour (cloth at the loom, leather at the rack, mail at the forge) and wear it.',
    done: 'Much better. You almost look like you belong here.', obj: [{ t: 'craft', cat: 'Armor', n: 1, label: 'Craft any piece of armour' }, { t: 'equip', cat: 'armor', label: 'Equip a piece of armour' }], xp: 140, gold: 8 },
  { id: 'q_crabs', giver: 'pell', turnin: 'pell', lvl: 1, title: 'Crab Supper',
    text: 'Those crabs on the beach are fat this year. Fetch me 4 Crab Meat, then cook them into Crab Cakes on the campfire. One for you, one for me... well, three for me.',
    done: 'Mmm! Just like my mother made. Here, keep the rest.', obj: [{ t: 'collect', item: 'crab_meat', n: 4, label: 'Collect Crab Meat from Shore Crabs' }, { t: 'craft', item: 'crab_cake', n: 4, label: 'Cook Crab Cakes at the Campfire' }], take: { crab_cake: 3 }, xp: 110, gold: 6, items: { potion_heal: 1 } },
  { id: 'q_litter', giver: 'lyra', turnin: 'lyra', lvl: 2, req: ['q_hides'], title: 'Thinning the Litter',
    text: 'Too many young wolves and bears near the village, raiding the fish racks. Drive some off: defeat 4 Wolf Pups and 3 Bear Cubs.',
    done: 'The racks will be safe for a while.', obj: [{ t: 'kill', mob: 'wolfpup', n: 4, label: 'Defeat Wolf Pups' }, { t: 'kill', mob: 'bearcub', n: 3, label: 'Defeat Bear Cubs' }], xp: 160, gold: 10, gear: true },
  { id: 'q_goblins', giver: 'maren', turnin: 'maren', lvl: 2, req: ['q_stranger'], title: 'Goblin Trouble',
    text: 'Goblins have pitched their filthy tents in the meadow, east and west of the village. They sit around their fires and send raiders out on patrol. Thin them out: defeat 6 goblins and bring me their ears as proof.',
    done: 'Ugh, put those away! But thank you. The roads are safer already.', obj: [{ t: 'kill', mob: 'goblin', n: 4, label: 'Defeat Goblin Raiders' }, { t: 'kill', mob: 'goblin_slinger', n: 2, label: 'Defeat Goblin Slingers' }, { t: 'collect', item: 'goblin_ear', n: 6, label: 'Collect Goblin Ears' }], take: { goblin_ear: 6 }, xp: 220, gold: 15, gear: true },
  { id: 'q_onward', giver: 'maren', turnin: 'kael', lvl: 4, req: ['q_blade'], title: 'Beyond the Meadow',
    text: 'You\'ve grown strong here. North, past the meadow, lies the Whisperwood. Scout Kael keeps an outpost there. He could use someone like you. Follow the road north.',
    done: 'Maren sent you? Good. We need every blade.', obj: [{ t: 'talk', npc: 'kael', label: 'Find Scout Kael in the Whisperwood' }], xp: 200, gold: 10 },
  { id: 'q_wolves', giver: 'kael', turnin: 'kael', lvl: 4, req: ['q_onward'], title: 'The Grey Pack',
    text: 'Grey wolves hunt the roads. Unlike the pups, these will come for you on sight. Kill 6.',
    done: 'Six fewer fangs in the dark.', obj: [{ t: 'kill', mob: 'wolf', n: 6, label: 'Kill Grey Wolves' }], xp: 300, gold: 14, gear: true },
  { id: 'q_herbs', giver: 'fen', turnin: 'fen', lvl: 4, req: ['q_onward'], title: 'Roots of Healing',
    text: 'Gather Healroot, the glowing green herb on the forest floor, then brew 3 Healing Potions at my alchemy table.',
    done: 'Keep a few for yourself. You\'ll need them.', obj: [{ t: 'collect', item: 'healroot', n: 6, label: 'Gather Healroot' }, { t: 'craft', item: 'potion_heal', n: 3, label: 'Brew Healing Potions' }], xp: 300, gold: 12 },
  { id: 'q_spiders', giver: 'kael', turnin: 'kael', lvl: 6, req: ['q_wolves'], title: 'Webs in the West',
    text: 'Spiders the size of dogs nest west of here. Kill 6 and bring back 4 Spider Silk. Elsa can weave it into fine cloth.',
    done: 'Ugh. Burn those legs from your memory.', obj: [{ t: 'kill', mob: 'spider', n: 6, label: 'Kill Forest Spiders' }, { t: 'collect', item: 'spider_silk', n: 4, label: 'Collect Spider Silk' }], xp: 420, gold: 18, gear: true },
  { id: 'q_iron', giver: 'kael', turnin: 'kael', lvl: 5, req: ['q_onward'], title: 'Iron in the Hills',
    text: 'Iron veins run through the rocky hills of the Whisperwood. You\'ll need a Copper Pickaxe from a forge to break them. Bring me 6 Iron Ore.',
    done: 'Good iron. Smelt it and arm yourself.', obj: [{ t: 'collect', item: 'iron_ore', n: 6, label: 'Mine Iron Ore' }], xp: 380, gold: 16 },
  { id: 'q_bandits', giver: 'kael', turnin: 'kael', lvl: 7, req: ['q_spiders'], title: 'The Cutthroat Camp',
    text: 'Bandits have made camp east of the river crossing. Kill 6 of them and their leader, Garrick the Cutthroat.',
    done: 'Garrick is dead? The roads will sing your name.', obj: [{ t: 'kill', mob: 'bandit', n: 6, label: 'Kill Bandits' }, { t: 'kill', mob: 'bandit_boss', n: 1, label: 'Slay Garrick the Cutthroat' }], xp: 700, gold: 40, gear: true },
  { id: 'q_highlands', giver: 'kael', turnin: 'hilda', lvl: 9, req: ['q_bandits'], title: 'To the Frostpeaks',
    text: 'The dwarves of Stonewatch, in the snowy highlands to the northwest, have sent for help. Follow the road over the bridge and climb.',
    done: 'Ye made the climb! Good. Warm yer hands by the fire.', obj: [{ t: 'talk', npc: 'hilda', label: 'Find Captain Hilda at Stonewatch' }], xp: 600, gold: 20 },
  { id: 'q_frost', giver: 'hilda', turnin: 'hilda', lvl: 10, req: ['q_highlands'], title: 'White Fangs',
    text: 'Frost wolves stalk the passes. Kill 8 and the miners can work in peace.', done: 'That\'ll do.', obj: [{ t: 'kill', mob: 'frostwolf', n: 8, label: 'Kill Frost Wolves' }], xp: 900, gold: 30, gear: true },
  { id: 'q_mithril', giver: 'dorn', turnin: 'dorn', lvl: 10, req: ['q_highlands'], title: 'The Shining Vein',
    text: 'Mithril! Pale blue veins up on the peaks. Ye\'ll need an Iron Pickaxe to break them. Bring me 6 Mithril Ore.',
    done: 'Beautiful. Simply beautiful.', obj: [{ t: 'collect', item: 'mithril_ore', n: 6, label: 'Mine Mithril Ore' }], xp: 900, gold: 40 },
  { id: 'q_ruins', giver: 'hilda', turnin: 'hilda', lvl: 11, req: ['q_frost'], title: 'The Restless Dead',
    text: 'Old ruins up north are crawling with skeletons. Put 10 of them back in the ground.', done: 'Rest easy, dead ones.', obj: [{ t: 'kill', mob: 'skeleton', n: 10, label: 'Destroy Skeleton Warriors' }], xp: 1300, gold: 45, gear: true },
  { id: 'q_troll', giver: 'hilda', turnin: 'hilda', lvl: 13, req: ['q_ruins'], title: 'The Troll King',
    text: 'Grumbak, king of the trolls, sits on his throne of bones high in the north. Kill his trolls and then kill him.',
    done: 'Grumbak... dead? Drinks are on me!', obj: [{ t: 'kill', mob: 'troll', n: 5, label: 'Kill Mountain Trolls' }, { t: 'kill', mob: 'troll_king', n: 1, label: 'Slay Grumbak the Troll King' }], xp: 2200, gold: 100, gear: true, gearRarity: 3 },
  { id: 'q_ember', giver: 'hilda', turnin: 'sael', lvl: 14, req: ['q_troll'], title: 'Into the Ash',
    text: 'East, beyond the river, the land burns. Warden Sael holds Emberwatch there. He asked for our best. That\'s you.',
    done: 'So you are the one they speak of. Welcome to the end of the world.', obj: [{ t: 'talk', npc: 'sael', label: 'Find Warden Sael at Emberwatch' }], xp: 1500, gold: 40 },
  { id: 'q_hounds', giver: 'sael', turnin: 'sael', lvl: 14, req: ['q_ember'], title: 'Hounds of Cinder', text: 'Ash hounds circle our walls. Kill 8.', done: 'Well fought.', obj: [{ t: 'kill', mob: 'ashhound', n: 8, label: 'Kill Ash Hounds' }], xp: 2400, gold: 60, gear: true },
  { id: 'q_imps', giver: 'sael', turnin: 'sael', lvl: 15, req: ['q_hounds'], title: 'Embers of Spite', text: 'Fire imps hurl flame from the rocks. Kill 8 and bring me 5 Ember Cores.', done: 'These cores will fuel our forge.', obj: [{ t: 'kill', mob: 'imp', n: 8, label: 'Kill Fire Imps' }, { t: 'collect', item: 'ember_core', n: 5, label: 'Collect Ember Cores' }], take: { ember_core: 5 }, xp: 3000, gold: 70, gear: true },
  { id: 'q_golems', giver: 'sael', turnin: 'sael', lvl: 16, req: ['q_imps'], title: 'Hearts of Magma', text: 'Magma golems guard the starmetal fields near the volcano. Break 6 of them.', done: 'The path to the crater is open.', obj: [{ t: 'kill', mob: 'golem', n: 6, label: 'Destroy Magma Golems' }], xp: 3600, gold: 80, gear: true, gearRarity: 3 },
  { id: 'q_tyrant', giver: 'sael', turnin: 'sael', lvl: 18, req: ['q_golems'], title: 'The Ash Tyrant', text: 'Vorgath, the Ash Tyrant, wakes in the crater of the volcano. End him, and the land can heal.', done: 'It is done. The fire dies. You are the hero of this land.', obj: [{ t: 'kill', mob: 'tyrant', n: 1, label: 'Slay Vorgath the Ash Tyrant' }], xp: 8000, gold: 500, gear: true, gearRarity: 4 },
];

// Village/outpost stations positions
export const STATION_SPOTS = [
  { type: 'workbench', x: -16.5, z: 358.7, rot: 0.3 }, { type: 'forge', x: 18.7, z: 348.8, rot: -0.2 }, { type: 'loom', x: -15.4, z: 373.0, rot: 0.6 },
  { type: 'tanning', x: 23.1, z: 373.0, rot: -0.5 }, { type: 'campfire', x: 1.1, z: 367.5, rot: 0 },
  { type: 'campfire', x: -40, z: 64, rot: 0 }, { type: 'alchemy', x: -50, z: 74, rot: 0.4 }, { type: 'workbench', x: -30, z: 72, rot: -0.6 },
  { type: 'forge', x: -240, z: -300, rot: 0.2 }, { type: 'campfire', x: -226, z: -306, rot: 0 }, { type: 'workbench', x: -212, z: -290, rot: 0.9 },
  { type: 'tanning', x: -244, z: -282, rot: 1.4 }, { type: 'loom', x: -206, z: -304, rot: 2.2 },
  { type: 'forge', x: 248, z: -318, rot: -0.3 }, { type: 'alchemy', x: 230, z: -340, rot: 0.8 }, { type: 'campfire', x: 236, z: -330, rot: 0 },
  { type: 'workbench', x: 252, z: -336, rot: 2.0 }, { type: 'loom', x: 222, z: -318, rot: 1.0 }, { type: 'tanning', x: 226, z: -308, rot: 0.6 },
];

export const MERCHANT_STOCK = ['potion_heal', 'bandage', 'crab_cake', 'linen', 'leather', 'planks', 'copper_ingot', 'iron_ingot'];
