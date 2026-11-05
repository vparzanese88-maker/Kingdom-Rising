// Kingdom Rising 2: all game data (races, classes, weapons, abilities, items, recipes, mobs, zones, quests)

export let LEVEL_CAP = 20;
// Kingdom Battles runs a shorter climb: level 10 is the top, and every level is worth about two campaign levels
export let LEVEL_GROWTH = 1;
export function battleLevels() {
  LEVEL_CAP = 10; RANK2_LEVEL = 6; LEVEL_GROWTH = 2;
  for (const t of TIERS) t.lvl = Math.max(1, Math.ceil(t.lvl / 2));
}
export const xpForLevel = (lv) => Math.round(80 * Math.pow(lv, 1.6));
// The world is designed for 20 levels. The campaign stretches that climb to 50: every designed level shows as
// about 2.6 campaign levels (monsters, gear, quests, recipes), and each campaign level is worth 0.39 designed levels.
export let LV_K = 1;
export const shownLv = (lv) => Math.max(1, Math.round(1 + (lv - 1) * LV_K)); // designed level -> level shown in this mode
export const designLv = (lv) => 1 + (lv - 1) / LV_K;                          // shown level -> designed level
export const levelGap = (a, b) => (a - b) / LV_K;                             // a level difference, in designed levels
// LV_K stays 1 on the island (levels 1-20, the world's own design); a later continent can stretch it
export function campaignLevels(cap = 20) {
  LEVEL_CAP = cap; LV_K = (cap - 1) / 19; LEVEL_GROWTH = 19 / (cap - 1); RANK2_LEVEL = shownLv(15);
  for (const t of TIERS) t.lvl = shownLv(t.lvl);
  for (const q of QUESTS) q.lvl = shownLv(q.lvl || 1);
  for (const r of RECIPES) if (r.lvl) r.lvl = shownLv(r.lvl);
  for (const z of ZONES) if (typeof z.lv === 'string') z.lv = z.lv.split('-').map(n => shownLv(+n)).join('-');
}
// XP for each campaign level: the designed curve spread over 50 levels, slightly longer overall
export const campaignXp = (lv) => Math.round(xpForLevel(designLv(lv)) / LV_K * 1.15);

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
  human: { name: 'Human', playable: true, desc: 'Hardy, ambitious and adaptable, the kingdoms of men build with timber and stone. Balanced in every attribute.', height: 1.0, width: 1.0, hp: 10, stats: { str: 12, dex: 12, int: 12, sta: 12 }, skins: ['#f1c7a5', '#e0ac85', '#c68863'], hairs: ['#2b1d12', '#5a3a1e', '#a0662c'] },
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
  quarterstaff: { name: 'Quarterstaff', hands: 'two', reach: 3.2, area: 5, speed: 0.95, block: 0.6, dmg: 1.05, kind: 'melee', parts: ['quarterstaff'], areaName: 'Staff Sweep' },
  warhammer: { name: 'Warhammer', hands: 'two', reach: 3.0, area: 7, speed: 0.58, block: 0.55, dmg: 1.55, kind: 'melee', parts: ['warhammer'], areaName: 'Quake Spin' },
  spear: { name: 'Spear', hands: 'two', reach: 4.0, area: 5.5, speed: 0.95, block: 0.55, dmg: 1.12, kind: 'melee', parts: ['spear'], areaName: 'Sweeping Arc' },
  dagger: { name: 'Dagger', hands: 'one', reach: 2.1, area: 3.5, speed: 1.35, block: 0.4, dmg: 0.8, kind: 'melee', parts: ['dagger'], areaName: 'Triple Stab' },
  daggers: { name: 'Twin Daggers', hands: 'dual', reach: 2.1, area: 3.5, speed: 1.9, block: 0.4, dmg: 0.75, kind: 'melee', parts: ['dagger', 'dagger'], areaName: 'Twin Fury' },
  fists: { name: 'Fist Wraps', hands: 'dual', reach: 2.1, area: 3.5, speed: 1.5, block: 0.4, dmg: 0.82, kind: 'melee', parts: ['fistwrap', 'fistwrap'], areaName: 'Flurry of Fists' },
  axe: { name: 'Hand Axe', hands: 'one', reach: 2.3, area: 4, speed: 1.1, block: 0.45, dmg: 0.95, kind: 'melee', parts: ['handaxe'], areaName: 'Cleave' },
  handaxes: { name: 'Hand Axes', hands: 'dual', reach: 2.3, area: 4, speed: 1.25, block: 0.45, dmg: 0.88, kind: 'melee', parts: ['handaxe', 'handaxe'], areaName: 'Twin Fury' },
  bow: { name: 'Longbow', hands: 'bow', reach: 60, area: 6, speed: 1.0, block: 0.35, dmg: 1.05, kind: 'bow', parts: ['bow'], areaName: 'Rain of Arrows' },
  firestaff: { name: 'Fire Staff', hands: 'staff', reach: 60, area: 9, speed: 1.0, block: 0.4, dmg: 1.1, kind: 'staff', element: 'fire', parts: ['staff'], areaName: 'Meteor' },
  froststaff: { name: 'Frost Staff', hands: 'staff', reach: 55, area: 7, speed: 1.05, block: 0.4, dmg: 0.95, kind: 'staff', element: 'frost', parts: ['staff'], areaName: 'Blizzard' },
  arcanestaff: { name: 'Arcane Staff', hands: 'staff', reach: 60, area: 6.5, speed: 1.15, block: 0.4, dmg: 0.95, kind: 'staff', element: 'arcane', parts: ['staff'], areaName: 'Arcane Nova' },
  musket: { name: 'Musket', hands: 'two', reach: 70, area: 6, speed: 0.85, block: 0.3, dmg: 1.55, kind: 'gun', parts: ['musket'], areaName: 'Piercing Shot' },
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
  musketeer: { hp: [100, 13], mana: [0, 0], end: [105, 6], uses: 'end' },
  shaman: { hp: [105, 13], mana: [100, 8], end: [95, 4], uses: 'mana' },
};
export function poolsAt(cls, level) { const P = CLASS_POOLS[cls]; const L = (level - 1) * LEVEL_GROWTH; return { hp: P.hp[0] + P.hp[1] * L, mana: P.mana[0] + P.mana[1] * L, end: P.end[0] + P.end[1] * L }; }
// which stat a weapon type scales with
// weapon ability (right click) cooldowns in seconds, by weapon kind
export const AREA_CD = { melee: 7, bow: 9, staff: 10, dual: 8, gun: 6 };

// ---------- Individual weapons: each has its own mastery, tree and two abilities (F and C) ----------
export const FAMILIES = {
  sword: { name: 'Sword', kind: 'melee', skills: ['whirlwind', 'lunge'] },
  mace: { name: 'Mace', kind: 'melee', skills: ['skullcrack', 'shockwave'] },
  axe: { name: 'Hand Axe', kind: 'melee', skills: ['hatchet', 'rend'] },
  dagger: { name: 'Dagger', kind: 'melee', skills: ['twinfury', 'fan'] },
  fistwrap: { name: 'Fist Wraps', kind: 'melee', skills: ['twinfury', 'fan'] },
  shield: { name: 'Shield', kind: 'melee', skills: ['shieldcharge', 'shieldbash'] },
  greatsword: { name: 'Greatsword', kind: 'melee', skills: ['greatcleave', 'execute'] },
  greataxe: { name: 'Great Axe', kind: 'melee', skills: ['reaping', 'earthcleaver'] },
  quarterstaff: { name: 'Quarterstaff', kind: 'melee', skills: ['quake', 'sweep'] },
  warhammer: { name: 'Warhammer', kind: 'melee', skills: ['quake', 'hammerfall'] },
  spear: { name: 'Spear', kind: 'melee', skills: ['sweep', 'javelin'] },
  bow: { name: 'Bow', kind: 'bow', skills: ['rain', 'multishot'] },
  firestaff: { name: 'Fire Staff', kind: 'staff', skills: ['meteor', 'flamewave'] },
  froststaff: { name: 'Frost Staff', kind: 'staff', skills: ['blizzard', 'icelance'] },
  arcanestaff: { name: 'Arcane Staff', kind: 'staff', skills: ['nova', 'missiles'] },
  musket: { name: 'Musket', kind: 'gun', skills: ['doubleshot', 'doubleshot'] },
};
export const WSKILLS = {
  fan8: { name: 'Arrow Fan', cd: 7, icon: 'rain', desc: 'Loose eight arrows at once in a wide horizontal fan.' },
  wheel: { name: 'Wheel Strike', cd: 7, icon: 'area', desc: 'A spinning sword strike that hits everything around you and slows them.' },
  backstabw: { name: 'Backstab', cd: 7, icon: 'dagger', desc: 'Drive both daggers into the enemy in front of you. From behind it does triple damage and always lands a critical hit.' },
  tripstab: { name: 'Triple Stab', cd: 7, icon: 'twinfury', desc: 'Three lightning-fast stabs into the enemy in front of you; the third drives deep and makes it bleed. From behind every stab hits half again as hard.' },
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
  doubleshot: { name: 'Piercing Shot', cd: 6, icon: 'dash', desc: 'One heavy ball that punches straight through every enemy in its path, then you leap backwards out of harm.' },
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
// ---- class skill trees: three per class, points from levels, abilities unlocked inside the trees ----
// node: id, name, t ('ab' an ability, 'pas' a passive, 'ult' the tree's capstone), ab (ability id for 'ab'),
// row/col on the tree grid (3 columns), req (the node above it you need first), free (owned from the start)
export const CLASS_TREES = {
  warrior: [
    { id: 'vanguard', name: 'Vanguard', tag: 'Brute force and momentum', col: '#e2533a', icon: 'cleavestrike', nodes: [
      { id: 'n_cleave', t: 'ab', ab: 'cleavestrike', row: 0, col: 1, free: true },
      { id: 'n_charge', t: 'ab', ab: 'charge', row: 1, col: 1, req: 'n_cleave' },
      { id: 'keen', t: 'pas', name: 'Keen Edge', icon: 'crit', row: 1, col: 0, req: 'n_cleave', desc: '+8% chance to land critical hits with any weapon.' },
      { id: 'a_cleavestrike', t: 'pas', name: 'Sweeping Blows', icon: 'cleavestrike', row: 2, col: 0, req: 'keen', desc: 'Cleave hits 50% harder and reaches further.' },
      { id: 'a_charge', t: 'pas', name: 'Bull Rush', icon: 'charge', row: 2, col: 2, req: 'n_charge', desc: 'Charge hits 50% harder and carries you further.' },
      { id: 'n_execute', t: 'ab', ab: 'execute', row: 3, col: 1, req: 'n_charge' },
      { id: 'bloodlust', t: 'pas', name: 'Bloodlust', icon: 'heart', row: 3, col: 0, req: 'a_cleavestrike', desc: 'Every kill makes you regenerate 5% of your health over 4 s.' },
      { id: 'a_execute', t: 'pas', name: 'Headsman', icon: 'execute', row: 4, col: 1, req: 'n_execute', desc: 'Execute hits 50% harder.' },
      { id: 'momentum', t: 'pas', name: 'Momentum', icon: 'dash', row: 4, col: 2, req: 'a_charge', desc: 'Killing an enemy makes Charge ready again.' },
      { id: 'cap', t: 'ult', name: 'Unstoppable', icon: 'crown', row: 5, col: 1, desc: 'Deal 20% more damage while below half health, and 10% more at all times.' },
    ] },
    { id: 'bulwark', name: 'Bulwark', tag: 'Hold the line, take every blow', col: '#6aa8ff', icon: 'shieldwall', nodes: [
      { id: 'n_wall', t: 'ab', ab: 'shieldwall', row: 0, col: 1 },
      { id: 'hp', t: 'pas', name: 'Toughness', icon: 'heart', row: 1, col: 0, req: 'n_wall', desc: '+10% maximum health.' },
      { id: 'armor', t: 'pas', name: 'Iron Skin', icon: 'shield', row: 1, col: 2, req: 'n_wall', desc: '+15% armour.' },
      { id: 'shieldwall', t: 'pas', name: 'Shield Discipline', icon: 'shield', row: 2, col: 0, req: 'hp', desc: 'Blocking no longer slows you down.' },
      { id: 'a_shieldwall', t: 'pas', name: 'Iron Wall', icon: 'shieldwall', row: 2, col: 2, req: 'armor', desc: 'Shield Wall lasts 50% longer.' },
      { id: 'n_stone', t: 'ab', ab: 'stonebanner', row: 2, col: 1, req: 'n_wall' },
      { id: 'unbreak', t: 'pas', name: 'Unbreakable Guard', icon: 'shield', row: 3, col: 0, req: 'shieldwall', desc: 'Your block can never be broken, however hard you are hit.' },
      { id: 'n_stand', t: 'ab', ab: 'laststand', row: 3, col: 1, req: 'n_stone' },
      { id: 'thorns', t: 'pas', name: 'Spiked Plate', icon: 'shield', row: 4, col: 2, req: 'a_shieldwall', desc: 'Enemies that hit you in melee take 15% of the damage back.' },
      { id: 'immov', t: 'ult', name: 'Immovable', icon: 'crown', row: 5, col: 1, desc: 'Take 10% less damage from everything, and nothing can knock you down or stun you while you block.' },
    ] },
    { id: 'warlord', name: 'Warlord', tag: 'Banners, boots and battlefield control', col: '#f0c040', icon: 'warbanner', nodes: [
      { id: 'n_kick', t: 'ab', ab: 'kick', row: 0, col: 1 },
      { id: 'n_war', t: 'ab', ab: 'warbanner', row: 1, col: 1, req: 'n_kick' },
      { id: 'a_kick', t: 'pas', name: 'Mule Kick', icon: 'kick', row: 1, col: 0, req: 'n_kick', desc: 'Kick hits 50% harder and sends them even further.' },
      { id: 'n_ham', t: 'ab', ab: 'hamstring', row: 2, col: 0, req: 'a_kick' },
      { id: 'drum', t: 'pas', name: 'War Drums', icon: 'warbanner', row: 2, col: 2, req: 'n_war', desc: 'While you stand by any of your banners you swing and move 10% faster.' },
      { id: 'n_vigor', t: 'ab', ab: 'vigorbanner', row: 3, col: 1, req: 'n_war' },
      { id: 'a_hamstring', t: 'pas', name: 'Crippling Cut', icon: 'hamstring', row: 3, col: 0, req: 'n_ham', desc: 'Hamstring bleeds 50% harder.' },
      { id: 'a_warbanner', t: 'pas', name: 'Standard Bearer', icon: 'warbanner', row: 4, col: 1, req: 'n_vigor', desc: 'All your banners last 50% longer and reach 25 m instead of 15 m.' },
      { id: 'rallying', t: 'pas', name: 'Rallying Cry', icon: 'battlecry', row: 4, col: 2, req: 'drum', desc: 'Planting a banner makes you regenerate 10% of your health over 6 s.' },
      { id: 'cmd', t: 'ult', name: "Warlord's Command", icon: 'crown', row: 5, col: 1, desc: 'Every banner effect is 50% stronger: War Banner +30% damage, Banner of Vigor 4.5% health a second, Banner of Stone 45% less damage taken.' },
    ] },
  ],
};
export const ULT_PTS = 10; // points in a tree before its capstone opens
export const CLASS_TREE = {
  musketeer: [],
  shaman: [],
  warrior: [], // filled from CLASS_TREES below
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
    { id: 'a_barkskin', row: 2, name: "Ironbark", icon: 'barkskin', max: 1, desc: "Hunter's Hide absorbs 50% more." },
    { id: 'a_snaretrap', row: 2, name: "Steel Jaws", icon: 'snaretrap', max: 1, desc: "Snare Trap roots longer and hurts more." },
    { id: 'a_vanish', row: 3, name: "Shadow Walk", icon: 'vanish', max: 1, desc: "Camouflage lasts 50% longer." },
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
export const MASTERY_CAP = 9999; // weapon skill has no top: it keeps growing (+1% damage a point)
export const masteryXpFor = (lv) => 60 + lv * 45;
export function weaponStat(wt) { const W = WEAPON_TYPES[wt]; if (W.kind === 'staff') return 'int'; if (W.kind === 'bow' || W.kind === 'gun' || wt === 'daggers' || wt === 'dagger' || wt === 'fists' || wt === 'handaxes' || wt === 'spear') return 'dex'; return 'str'; }

// How each melee weapon attacks (left click steps through the chain). m = damage multiplier, d = relative swing time.
// cleave: hits everything in a wide arc; stun/shock: stun and an area shockwave; bleed; aoe: hit all around; line: pierce a line.
// right-click special attack for each weapon (dual-wield sets have their own)
export const RMB_SPECIAL = { fists: 'shadowflurry', musket: 'doubleshot', sword: 'wheel', swordshield: 'wheel', mace: 'skullcrack', maceshield: 'skullcrack', swordmace: 'twinfury', daggers: 'backstabw', dagger: 'tripstab', handaxes: 'whirlaxes', greatsword: 'greatcleave', greataxe: 'reaping', warhammer: 'hammerfall', spear: 'javelin', bow: 'fan8', firestaff: 'meteor', froststaff: 'blizzard', arcanestaff: 'nova' };
export const COMBOS = {
  sword: { trait: 'Swords: +10% critical chance', chain: [{ a: 'swing1', m: 1.0 }, { a: 'swing2', m: 1.05 }, { a: 'swing3', m: 2.0, d: 1.7 }] },
  mace: { trait: 'Maces ignore armour', chain: [{ a: 'swing1', m: 1.15 }, { a: 'smash', m: 2.3, d: 1.7, stun: 1.2, shock: 3.2 }] },
  swordshield: { trait: 'Swords: +10% critical chance', chain: [{ a: 'swing1', m: 1.0 }, { a: 'swing2', m: 1.05 }, { a: 'swing3', m: 2.0, d: 1.7 }] },
  maceshield: { trait: 'Maces ignore armour', chain: [{ a: 'swing1', m: 1.15 }, { a: 'smash', m: 2.3, d: 1.7, stun: 1.2, shock: 3.2 }] },
  swordmace: { trait: 'Sword crits, mace ignores armour', chain: [{ a: 'swing1', m: 1.0 }, { a: 'off1', m: 1.15, blunt: true }, { a: 'swing3', m: 1.8, d: 1.4, shock: 3, blunt: true }] },
  fists: { trait: 'Bare knuckles: jab, cross, jab, then an uppercut that staggers', chain: [{ a: 'stabR', m: 0.75, d: 0.5 }, { a: 'stabL', m: 0.75, d: 0.5 }, { a: 'stabR', m: 0.8, d: 0.5 }, { a: 'smash', m: 1.9, d: 1.1, stun: 0.6, knock: 6 }] },
  dagger: { trait: 'A single dagger: a quick stab. Dagger skill brings a chance of lightning-fast double, triple and quadruple attacks', chain: [{ a: 'stabR', m: 0.95, d: 0.6 }] },
  daggers: { trait: 'Twin daggers: left, right, left, right. Double the chance of lightning-fast flurries', chain: [{ a: 'stabR', m: 0.62, d: 0.5 }, { a: 'stabL', m: 0.62, d: 0.5 }] },
  axe: { trait: 'Axes make enemies bleed', chain: [{ a: 'swing1', m: 1.0, bleed: true }, { a: 'swing2', m: 1.0, bleed: true }, { a: 'swing3', m: 1.4, bleed: true }] },
  handaxes: { trait: 'Axes make enemies bleed', chain: [{ a: 'swing1', m: 0.95, bleed: true }, { a: 'off1', m: 0.95, bleed: true }, { a: 'swing3', m: 1.7, d: 1.3, bleed: true }] },
  greatsword: { trait: 'Greatswords cleave through every enemy in front of you', chain: [{ a: 'swing1', m: 1.1, cleave: true }, { a: 'swing2', m: 1.15, cleave: true }, { a: 'smash', m: 2.2, d: 1.5, cleave: true }] },
  greataxe: { trait: 'Great axes cleave and leave deep bleeding wounds', chain: [{ a: 'swing1', m: 1.35, cleave: true, bleed: true }, { a: 'smash', m: 2.7, d: 1.6, cleave: true, bleed: true }] },
  quarterstaff: { trait: 'A plain wooden staff: quick blunt blows that ignore some armour', chain: [{ a: 'swing1', m: 1.0, blunt: true }, { a: 'swing2', m: 1.0, blunt: true }] },
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
  musketeer: { name: 'Musketeer', battleOnly: true, desc: 'A sharpshooter in a long coat. Slow to reload, but every shot hits like a hammer, and a steady aim can drop a foe from across the field.',
    weapons: ['musket'], armor: 'leather', hp: 105, mana: 0,
    colors: { main: '#1e3a6a', trim: '#d8b04a', metal: '#4a4a50' } },
  shaman: { name: 'Shaman', battleOnly: true, desc: 'A spirit-caller who fights with a spear and the old powers: mends allies, curses foes, calls storms and runs with a spirit wolf.',
    weapons: ['spear', 'sword', 'mace', 'handaxes'], armor: 'leather', hp: 105, mana: 100,
    colors: { main: '#2a6a6a', trim: '#c89a4a', metal: '#8a7a5a' } },
};

// Class abilities on keys 1 2 3, unlocked by level. Rank II at level 15.
export const ABILITIES = {
  warrior: [
    { id: 'cleavestrike', cost: 25, name: "Cleave", key: '', level: 1, cd: 6, icon: '', desc: "A huge sweeping blow that cuts through every enemy in front of you and knocks them back." },
    { id: 'charge', cost: 30, name: "Charge", key: '', level: 2, cd: 8, icon: '', desc: "Charge forward 12 m, knocking aside and stunning everything in your path." },
    { id: 'kick', cost: 20, name: "Kick", key: '', level: 3, cd: 7, icon: '', desc: "A brutal front kick: sends the enemy flying back several metres and leaves them reeling for 1.5 s." },
    { id: 'shieldwall', cost: 40, name: "Shield Wall", key: '', level: 4, cd: 20, icon: '', desc: "Brace yourself: take 60% less damage from every direction for 6 s." },
    { id: 'warbanner', cost: 35, name: "War Banner", key: '', level: 6, cd: 24, icon: '', desc: "Plant a red war banner for 15 s. While you fight within 15 m of it you hit 20% harder." },
    { id: 'hamstring', cost: 20, name: "Hamstring", key: '', level: 8, cd: 6, icon: '', desc: "A low, vicious cut to the legs: the target bleeds heavily and is crippled to half speed for 6 s." },
    { id: 'vigorbanner', cost: 35, name: "Banner of Vigor", key: '', level: 10, cd: 30, icon: '', desc: "Plant a green banner for 15 s. While you stand within 15 m of it you heal 3% of your health every second." },
    { id: 'execute', cost: 35, name: "Execute", key: '', level: 12, cd: 10, icon: '', desc: "Raise your weapon high and bring it down with everything you have. Triple damage to enemies below 35% health." },
    { id: 'stonebanner', cost: 35, name: "Banner of Stone", key: '', level: 14, cd: 30, icon: '', desc: "Plant a steel-blue banner for 15 s. While you stand within 15 m of it you take 30% less damage." },
    { id: 'laststand', cost: 35, name: "Last Stand", key: '', level: 16, cd: 40, icon: '', desc: "Refuse to fall: regenerate 30% of your health over 10 s and take 25% less damage for 10 s." },
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
    { id: 'barkskin', cost: 30, name: "Hunter's Hide", key: '', level: 8, cd: 20, icon: '', desc: "Your skin toughens like old leather: absorb damage equal to 20% of your health for 10 s." },
    { id: 'snaretrap', cost: 25, name: "Snare Trap", key: '', level: 10, cd: 12, icon: '', desc: "Set a trap at your feet. The first enemy to step on it is rooted in place and hurt." },
    { id: 'vanish', cost: 35, name: "Camouflage", key: '', level: 12, cd: 25, icon: '', desc: "Blend into the wilds for 5 s. Enemies lose track of you and your next hit deals double damage." },
    { id: 'explotrap', cost: 35, name: "Explosive Trap", key: '', level: 14, cd: 14, icon: '', desc: "Set a fire trap that explodes when an enemy steps on it, burning everything nearby." },
    { id: 'pinning', cost: 25, name: "Pinning Shot", key: '', level: 16, cd: 9, icon: '', desc: "An arrow that pins the target to the ground: stunned for 2.5 s." },
    { id: 'barrage', cost: 45, name: "Barrage", key: '', level: 18, cd: 16, icon: '', desc: "Loose 10 arrows in quick succession at whatever you are aiming at." },
  ],
  musketeer: [
    { id: 'grapeshot', cost: 30, name: "Grapeshot", key: '', level: 1, cd: 8, icon: '', desc: "Load a handful of shot and blast a wide cone 10 m in front of you, knocking enemies back." },
    { id: 'smokebomb', cost: 25, name: "Smoke Bomb", key: '', level: 2, cd: 16, icon: '', desc: "Vanish in a cloud of powder smoke: enemies lose you for 4 s and your next shot is a guaranteed critical hit." },
    { id: 'powderkeg', cost: 35, name: "Powder Keg", key: '', level: 4, cd: 12, icon: '', desc: "Toss a lit keg where you aim. It explodes after a moment, blasting everything within 6 m." },
    { id: 'quickreload', cost: 20, name: "Quick Reload", key: '', level: 6, cd: 18, icon: '', desc: "For 8 s you reload in half the time and every shot deals 30% more damage." },
    { id: 'bayonet', cost: 30, name: "Bayonet Charge", key: '', level: 8, cd: 10, icon: '', desc: "Lunge 10 m forward behind your bayonet, running through everything in your path." },
    { id: 'eagleeye', cost: 25, name: "Eagle Eye", key: '', level: 10, cd: 22, icon: '', desc: "For 10 s your aim is perfect: +40% critical chance and shots fly faster and flatter." },
    { id: 'volleyfire', cost: 40, name: "Volley Fire", key: '', level: 12, cd: 16, icon: '', desc: "Empty your bandolier: five rapid shots at your target, each hitting hard." },
    { id: 'incendiary', cost: 30, name: "Incendiary Round", key: '', level: 14, cd: 10, icon: '', desc: "A blazing round that bursts on impact, setting everything within 4 m on fire." },
    { id: 'caltrops', cost: 20, name: "Caltrops", key: '', level: 16, cd: 14, icon: '', desc: "Scatter iron spikes in a 6 m circle around you: enemies inside are slowed and cut." },
    { id: 'cannonade', cost: 55, name: "Cannonade", key: '', level: 18, cd: 30, icon: '', desc: "Signal the town's cannons: three shells crash down around the spot you aim at." },
  ],
  shaman: [
    { id: 'healingwave', cost: 25, name: "Healing Wave", key: '', level: 1, cd: 10, icon: '', desc: "A wave of spirit water: heals you and every ally within 10 m (troops and players) for 15% of their health." },
    { id: 'earthshock', cost: 20, name: "Earth Shock", key: '', level: 2, cd: 6, icon: '', desc: "Hurl a shard of living stone where you aim: it hits hard and slows the target for 3 s." },
    { id: 'spiritwolf', cost: 40, name: "Spirit Wolf", key: '', level: 4, cd: 40, icon: '', desc: "Call a spirit wolf to run with you for 45 s. It bites only lightly, but everyone near it runs faster. The wolf, its aura and the speed grow as you level." },
    { id: 'ancestralward', cost: 30, name: "Ancestral Ward", key: '', level: 6, cd: 20, icon: '', desc: "The ancestors stand guard: you and allies within 9 m take 40% less damage for 8 s." },
    { id: 'hex', cost: 25, name: "Hex", key: '', level: 8, cd: 12, icon: '', desc: "Curse the enemy you aim at: it is slowed, stunned for a moment and its strength drains away for 6 s." },
    { id: 'chainheal', cost: 35, name: "Chain Heal", key: '', level: 10, cd: 12, icon: '', desc: "A healing spirit leaps from ally to ally, healing each one less than the last. More jumps as you level." },
    { id: 'wartotem', cost: 30, name: "War Totem", key: '', level: 12, cd: 22, icon: '', desc: "Plant a war totem: you and allies within 10 m attack faster for 8 s." },
    { id: 'stormcall', cost: 40, name: "Storm Call", key: '', level: 14, cd: 16, icon: '', desc: "Call lightning down on the enemies where you aim. More bolts as you level." },
    { id: 'earthbind', cost: 25, name: "Earthbind", key: '', level: 16, cd: 18, icon: '', desc: "Roots burst from the ground: every enemy within 7 m is held in place and badly slowed for 4 s." },
    { id: 'spiritlink', cost: 50, name: "Spirit Link", key: '', level: 18, cd: 40, icon: '', desc: "Bind your side together: you and allies within 12 m heal 30% over 6 s." },
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
export let RANK2_LEVEL = 15;

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
// Rare, epic and legendary weapons carry one proc: a small chance on each weapon hit (more with Dexterity) to unleash an extra effect
export const PROCS = {
  flame: { name: 'Flametongue', col: '#ff8a3a', desc: 'bursts into flame: fire damage and a burn' },
  frost: { name: 'Frostbite', col: '#8ad8ff', desc: 'frost damage that slows the target' },
  storm: { name: 'Thunderclap', col: '#c8d8ff', desc: 'lightning that leaps to the nearest foes' },
  venom: { name: 'Venom', col: '#8fe05a', desc: 'a deep poison that bleeds the target' },
  crush: { name: 'Concussion', col: '#ffe28a', desc: 'a crushing blow that stuns for a moment' },
  shadow: { name: 'Shadowstrike', col: '#c080ff', desc: 'shadow damage that ignores armour' },
};
export function procChance(rarity, dex) { const b = [0, 0, 0.03, 0.05, 0.07][rarity] || 0; return b ? Math.min(0.25, b + (dex || 0) * (0.002 + (rarity - 2) * 0.0007)) : 0; }
export const PROC_DEX = (rarity) => (0.2 + (rarity - 2) * 0.07).toFixed(2);
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
  gold_ore: { name: 'Gold Ore', icon: '◆', col: '#ffd040', desc: 'Pure gold.', value: 5 },
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
  pup_pelt: { name: 'Wolf Pup Pelt', icon: '🐺', desc: 'A soft grey pelt. Proof the litter is thinning.', value: 2 },
  cub_pelt: { name: 'Bear Cub Fur', icon: '🐻', desc: 'Thick brown fur from a bear cub.', value: 2 },
  bear_claw: { name: 'Bear Claw', icon: '🐾', desc: 'A claw as long as your finger.', value: 6 },
  tiger_pelt: { name: 'Tiger Pelt', icon: '🐯', desc: 'A striped pelt from the jungle.', value: 7 },
  goblin_sling: { name: 'Goblin Sling', icon: '🪢', desc: 'A greasy leather sling. Goblin slingers carry them.', value: 2 },
  brute_tooth: { name: 'Brute Tooth', icon: '🦷', desc: 'A tusk-like tooth from a goblin brute.', value: 5 },
  goblin_ear: { name: 'Goblin Ear', icon: '👂', desc: 'Pointy, green and smelly. Proof of a goblin slain.', value: 3 },
  bandit_badge: { name: 'Bandit Badge', icon: '⛉', desc: 'Proof of a bandit slain.', value: 3 },
  // consumables
  potion_heal: { name: 'Healing Potion', icon: '🧪', col: '#ff5050', desc: 'Restores 40% health. Press R.', value: 8, use: { heal: 0.4 } },
  potion_heal2: { name: 'Greater Healing Potion', icon: '🧪', col: '#ff2070', desc: 'Restores 70% health. Press R.', value: 25, use: { heal: 0.7 } },
  dwarf_ale: { name: 'Dwarven Ale', icon: '🍺', desc: 'Drink.', value: 5, use: {} },
  berry_juice: { name: 'Berry Juice', icon: '🧃', desc: 'Drink.', value: 3, use: {} },
  mint_tea: { name: 'Mint Tea', icon: '🍵', desc: 'Drink.', value: 3, use: {} },
  honey_mead: { name: 'Honey Mead', icon: '🍯', desc: 'Drink.', value: 6, use: {} },
  fire_whisky: { name: 'Fire Whisky', icon: '🥃', desc: 'Drink.', value: 14, use: {} },
  crab_cake: { name: 'Crab Cake', icon: '🍘', desc: 'Restores 25% health over 10 s.', value: 4, use: { regen: 0.25 } },
  roast_meat: { name: 'Roast Meat', icon: '🍖', desc: 'Restores 35% health over 10 s.', value: 5, use: { regen: 0.35 } },
  herb_roast: { name: 'Herb-Roasted Meat', icon: '🍖', desc: 'Restores 40% health over 10 s.', value: 8, use: { regen: 0.4 } },
  hunter_stew: { name: "Hunter's Stew", icon: '🍲', desc: "Restores 45% health over 10 s.", value: 12, use: { regen: 0.45 } },
  ember_skewer: { name: 'Ember Skewer', icon: '🍢', desc: 'Restores 40% health over 10 s.', value: 16, use: { regen: 0.4 } },
  bandage: { name: 'Linen Bandage', icon: '🩹', desc: 'Restores 20% health over 6 s.', value: 3, use: { regen: 0.2, time: 6 } },
};

// Food buffs: only one at a time, eating another replaces it
// food: small buffs that last a long time. drinks: a bit stronger, shorter. One of each at a time.
// food and drink: small, steady boosts while something sits in your food or drink slot (you eat one when the last wears off).
// One lasts 24 minutes, so a stack of 20 lasts 8 hours of play. Rarer recipes give a bit more.
export const FOOD_BUFFS = {
  roast_meat: { rarity: 0, name: 'Hearty', desc: '+3% maximum health', hp: 0.03 },
  crab_cake: { rarity: 0, name: 'Sea Legs', desc: '+3% move speed', speed: 0.03 },
  herb_roast: { rarity: 1, name: 'Vigour', desc: '+10% health and endurance regeneration', regen: 0.1 },
  hunter_stew: { rarity: 2, name: "Hunter's Strength", desc: '+4% damage', dmg: 0.04 },
  ember_skewer: { rarity: 3, name: 'Fire Belly', desc: '+4% critical chance', crit: 0.04 },
  berry_juice: { rarity: 0, drink: true, name: 'Quickstep', desc: '+3% move speed', speed: 0.03 },
  dwarf_ale: { rarity: 1, drink: true, name: 'Stout', desc: '+5% maximum health', hp: 0.05 },
  mint_tea: { rarity: 1, drink: true, name: 'Second Wind', desc: '+15% health and endurance regeneration', regen: 0.15 },
  honey_mead: { rarity: 2, drink: true, name: 'Courage', desc: '+5% damage', dmg: 0.05 },
  fire_whisky: { rarity: 3, drink: true, name: 'Firewater', desc: '+6% critical chance', crit: 0.06 },
};
export const FOOD_TIME = 1440, DRINK_TIME = 1440;
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
  gold_ore: { name: 'Gold Vein', verb: 'Mine', tool: 'pickaxe', tier: 1, item: 'gold_ore', amt: [3, 5], time: 2.4, respawn: 70 },
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

const ARMOR_SLOTS = { head: 'Head', chest: 'Chest', arms: 'Arms', hands: 'Hands', waist: 'Waist', legs: 'Legs', feet: 'Feet' };
export const ARMOR_NAMES = {
  cloth: { head: 'Hat', chest: 'Robe', arms: 'Sleeves', hands: 'Gloves', waist: 'Sash', legs: 'Leggings', feet: 'Slippers' },
  leather: { head: 'Hood', chest: 'Jerkin', arms: 'Bracers', hands: 'Gloves', waist: 'Belt', legs: 'Breeches', feet: 'Boots' },
  mail: { head: 'Helm', chest: 'Hauberk', arms: 'Vambraces', hands: 'Gauntlets', waist: 'Girdle', legs: 'Greaves', feet: 'Sabatons' },
};
export const ARMOR_TIER_NAMES = {
  cloth: ['Ragged', 'Linen', 'Woven', 'Silk', 'Starweave', 'Archmage'],
  leather: ['Worn', 'Hide', 'Tanned', 'Hardened', 'Shadowhide', 'Wildlord'],
  mail: ['Rusty', 'Copper', 'Iron', 'Steel', 'Mithril', 'Starmetal'],
};
export const ARMOR_SLOT_LIST = Object.keys(ARMOR_SLOTS);
export const SLOT_LABEL = Object.assign({ back: 'Back', w1: 'Main Hand', w2: 'Off Hand', w3: 'Main Hand', w4: 'Off Hand', ranged: 'Set 2', food: 'Food', drink: 'Drink', neck: 'Neck (no longer worn)', ring: 'Ring (no longer worn)', ring1: 'Ring', ring2: 'Ring', trinket: 'Charm (no longer worn)', shoulders: 'Shoulders (no longer worn)', wrists: 'Arms' }, ARMOR_SLOTS);
// accessories: neck (amulet), back (cloak), ring, trinket (charm)
export const ACC = {
  neck: { names: ['', 'Copper Amulet', 'Iron Pendant', 'Steel Torc', 'Mithril Amulet', 'Starmetal Medallion'] },
  back: { names: ['', 'Linen Cloak', 'Woolen Cloak', 'Silk Cape', 'Mithril-Thread Cloak', 'Starweave Mantle'] },
  ring: { names: ['', 'Copper Ring', 'Iron Band', 'Steel Signet', 'Mithril Ring', 'Starmetal Ring'] },
  trinket: { names: ['', 'Lucky Wolf Fang', 'Carved Bone Charm', 'Troll-Tusk Talisman', 'Ember Heart', 'Star Shard'] },
};

export function weaponBaseDmg(tier) { return 9 + tier * 9; }
export function armorBase(tier, slot) { const m = { head: 0.7, chest: 1.3, arms: 0.7, hands: 0.45, waist: 0.4, legs: 1.0, feet: 0.6 }[slot]; return Math.max(1, Math.round((3 + tier * 5) * m)); }

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
  R({ id: 'mint_tea', out: 'mint_tea', n: 2, station: 'campfire', need: { healroot: 1 }, cat: 'Consumables', lvl: 1 });
  R({ id: 'fire_whisky', out: 'fire_whisky', n: 1, station: 'campfire', need: { ember_core: 1, healroot: 1 }, cat: 'Consumables', lvl: 14 });
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
        const n = slot === 'chest' ? 4 : slot === 'legs' ? 3 : slot === 'arms' || slot === 'waist' ? 1 : 2;
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
    R({ id: 'acc_back_' + t, acc: 'back', tier: t, station: 'loom', need: { [t >= 3 ? 'silk_cloth' : 'linen']: 3 + t, leather: 1, ...(t >= 4 ? { [metal]: 1 } : {}) }, cat: 'Armor', lvl: TIERS[t].lvl });
  }
})();

// ---- Zones ----
export const ZONES = [
  { id: 'coast', name: 'Driftwood Coast', lv: '1-4', col: '#f0d890' },
  { id: 'meadow', name: 'Sunmeadow', lv: '1-6', col: '#9ad66a' },
  { id: 'wood', name: 'Tanglewood Jungle', lv: '5-12', col: '#3f8a3a' },
  { id: 'highlands', name: 'Mount Kelda', lv: '12-20', col: '#a8b8a0' },
  { id: 'north', name: 'Saltmere Fields', lv: '9-15', col: '#c8d890' },
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
  goblin_chief: { armor: 0.3, name: 'Gorgrak the Goblin King', shape: 'human', variant: 'goblin', elite: true, boss: true, hpM: 7, dmgM: 1.7, aggro: 22, speed: 5, size: 2.0, loot: { goblin_ear: [3, 5, 1], iron_ore: [2, 4, 1] }, gold: [90, 160], skin: false, col: '#4a6a28', gearChance: 1 },
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
  // the south: beaches and Sunmeadow (levels 1-6)
  ['crab', 70, 440, 60, 8, 1, 1], ['crab', -80, 442, 60, 6, 1, 2], ['crab', 260, 400, 60, 6, 1, 2], ['crab', -280, 390, 60, 6, 1, 2], ['rabbit', 120, 300, 60, 5, 1, 1], ['rabbit', -150, 260, 60, 5, 1, 1],
  ['wolf', 40, 260, 110, 9, 1, 3], ['bear', -60, 280, 70, 4, 2, 4], ['tiger', 120, 250, 70, 4, 2, 4], ['wolf', -150, 330, 60, 6, 1, 2], ['bear', 170, 340, 60, 3, 2, 3], ['tiger', -120, 200, 60, 3, 3, 4],
  ['wolfpup', 120, 290, 60, 6, 1, 2], ['wolfpup', -120, 300, 60, 5, 1, 3], ['bearcub', 80, 200, 70, 5, 2, 3], ['bearcub', -60, 190, 70, 5, 2, 4], ['deer', 230, 260, 70, 5, 1, 2], ['deer', -240, 240, 70, 5, 1, 2],
  // Tanglewood Jungle, east and west (levels 5-12)
  ['wolf', 90, 90, 80, 7, 4, 6], ['wolf', -140, 80, 70, 6, 5, 6], ['boar', 160, 40, 70, 6, 5, 7], ['boar', -60, 130, 60, 4, 4, 5],
  ['tiger', -260, 60, 70, 4, 6, 8], ['tiger', 300, 90, 70, 4, 6, 8], ['tiger', -330, -60, 60, 3, 8, 10], ['tiger', 360, -40, 60, 3, 8, 10],
  ['boar', -360, 140, 60, 5, 6, 7], ['boar', 380, 180, 60, 5, 6, 7], ['bear', -390, -120, 60, 3, 9, 11], ['bear', 400, -110, 60, 3, 9, 11], ['wolf', 330, 0, 60, 5, 8, 9], ['wolf', -320, 10, 60, 5, 8, 9],
  // Saltmere Fields, the north (levels 9-15)
  ['wolf', -180, -330, 70, 6, 10, 12], ['wolf', 220, -330, 70, 6, 10, 12], ['boar', -100, -300, 60, 5, 9, 11], ['bear', 150, -300, 60, 3, 12, 13], ['tiger', -260, -270, 60, 3, 12, 14], ['crab', 20, -470, 70, 6, 9, 10],
  // Mount Kelda (levels 12-20)
  ['bear', -60, -40, 70, 4, 13, 15], ['bear', 110, -10, 70, 4, 13, 15], ['tiger', -90, -130, 60, 3, 15, 17], ['tiger', 140, -130, 60, 3, 15, 17], ['wolf', 0, 30, 70, 6, 12, 14], ['bear', 30, -110, 50, 3, 17, 19],
  ['goblin_chief', 40, -178, 3, 1, 20, 20],
];
// goblin camps: [x, z, level min, level max]
export const GOBLIN_CAMPS = [[160, 300, 2, 3], [-165, 230, 3, 4], [-95, 290, 2, 3], [120, 170, 4, 5], [70, 40, 5, 6], [-115, -5, 6, 8], [-280, 150, 6, 8], [330, 220, 6, 8], [-330, -230, 11, 13], [320, -280, 12, 14], [-120, -200, 14, 16], [150, -200, 15, 17], [-20, -150, 17, 19], [100, -150, 18, 19]];
// Mob special abilities (see mobs.js): bite (bleed), charge, maul, pounce, web, poison, pound, nova, frenzy, bash, regen
export const MOB_ABILITIES = {
  wolfpup: ['bite'], wolf: ['bite'], frostwolf: ['bite', 'frostbite'], ashhound: ['bite', 'firebite'],
  bearcub: ['maul'], bear: ['charge', 'maul'], boar: ['charge'], tiger: ['pounce', 'maul', 'bite'], snowtiger: ['pounce', 'maul', 'bite'],
  spider: ['web', 'poison'], bandit: ['bash'], bandit_boss: ['bash', 'charge'], skeleton: ['bash'],
  troll: ['pound', 'regen'], troll_king: ['pound', 'regen', 'charge'], golem: ['pound'], imp: ['nova'], goblin: ['frenzy'], goblin_slinger: [], goblin_brute: ['charge', 'pound'], goblin_chief: ['charge', 'pound', 'frenzy'], rat: ['bite'], boarlet: ['charge'],
};
export const mobHp = (lv, M) => Math.round((34 + lv * 26 + lv * lv * 1.2) * M.hpM);
export const mobDmg = (lv, M) => (4 + lv * 2.6) * M.dmgM;
export const mobXp = (lv, M) => Math.round((12 + lv * 9) * (M.elite ? 4 : 1) * (M.boss ? 3 : 1) * Math.max(0.6, Math.min(1.6, M.hpM)));

// ---- NPCs ----
// role: quest giver / merchant / villager
export const NPCS = {
  maren: { name: 'Elder Maren', title: 'Village Elder', race: 'human', sex: 'f', outfit: 'elder', x: 2.2, z: 363.1, hello: 'Ah, the newcomer. The sea gives and the sea takes, and today it gave us you. Mind the goblins: twenty years they have ruled Kelda from the mountain, and every year they come closer.' },
  bram: { name: 'Bram', title: 'Woodcutter', race: 'human', sex: 'm', outfit: 'worker', x: -14.3, z: 355.4, hello: 'Morning, sailor. Good honest work, swinging an axe. Clears the head. You look like you\'ve got a lot to clear.' },
  torvin: { name: 'Torvin Ironhand', title: 'Blacksmith', race: 'dwarf', sex: 'm', outfit: 'smith', x: 16.5, z: 352.1, hello: 'The newcomer, eh? Hands like those have held a blade before. Don\'t tell me where. I don\'t want to know.' },
  elsa: { name: 'Elsa', title: 'Weaver', race: 'elf', sex: 'f', outfit: 'weaver', x: -12.1, z: 369.7, hello: 'Oh, you\'re the sailor everyone\'s whispering about. Where did you sail from? ...No? Fair enough.' },
  lyra: { name: 'Lyra', title: 'Huntress', race: 'elf', sex: 'f', outfit: 'hunter', x: 19.8, z: 370.8, hello: 'Newcomer. You walk like a hunter. Or like someone who\'s been hunted.' },
  pell: { name: 'Old Pell', title: 'Fisherman', race: 'human', sex: 'm', outfit: 'fisher', x: -7, z: 398, hello: 'Saw that boat of yours limp in, sailor. Funny little thing for a long voyage. Not my business, mind.' },
  odo: { name: 'Odo', title: 'Merchant', race: 'human', sex: 'm', outfit: 'merchant', x: 7.7, z: 357.6, merchant: true, hello: 'The newcomer! Gold\'s gold, wherever it was earned. No questions asked at Odo\'s stall.' },
  kael: { name: 'Scout Kael', title: 'Tanglewood Warden', race: 'elf', sex: 'm', outfit: 'hunter', x: -36, z: 58, hello: 'Keep your blade close in these woods.' },
  fen: { name: 'Fen', title: 'Herbalist', race: 'human', sex: 'f', outfit: 'weaver', x: -44, z: 70, hello: 'Healroot grows where the light breaks through the canopy.' },
  hilda: { name: 'Captain Hilda', title: 'Stonewatch Captain', race: 'dwarf', sex: 'f', outfit: 'smith', x: -296, z: -158, hello: 'Stonewatch still stands. Barely. The goblins come down off Kelda every night now.' },
  dorn: { name: 'Dorn', title: 'Miner', race: 'dwarf', sex: 'm', outfit: 'worker', x: -308, z: -144, merchant: true, hello: 'There\'s mithril on Kelda. And goblins sitting on every vein of it.' },
  sael: { name: 'Harbourmaster Sael', title: 'Saltmere Harbour', race: 'elf', sex: 'm', outfit: 'elder', x: 34, z: -432, merchant: true, hello: 'Saltmere is the last free port on this island. We mean to keep it that way.' },
};

// Quests. obj types: talk(npc), collect(item,n), kill(mob,n), craft(item|cat,n), equip(slot), reach(x,z,r,label)
export const QUESTS = [
  // Main quest. Chapter 1 stops here for now: the objective stays open until the next part of the story is written.
  { id: 'mq_boat', main: true, giver: null, turnin: null, lvl: 1, title: 'Repairs at Sea\'s End',
    text: 'You made it to Driftwood Coast, but only just. Your little boat limped in with a split plank and a torn sail, and she will not carry you anywhere until someone with real skill puts her right. Somebody in the village must know a shipwright.',
    done: '', obj: [{ t: 'talk', npc: 'maren', label: 'Ask Elder Maren about repairs' }], xp: 40, gold: 0 },
  { id: 'mq_walls', main: true, giver: 'maren', turnin: 'maren', lvl: 1, title: 'Walls for Seabreak',
    text: 'Elder Maren wants Seabreak walled before the goblins come again: a palisade, with a gate on every road. Bring her timber and stone.',
    done: '', obj: [{ t: 'collect', item: 'wood', n: 30, label: 'Gather 30 Wood' }, { t: 'collect', item: 'stone', n: 15, label: 'Gather 15 Stone' }, { t: 'talk', npc: 'maren', label: 'Bring them to Elder Maren' }], take: { wood: 30, stone: 15 }, xp: 260, gold: 20, items: { roast_meat: 3 } },
  { id: 'mq_hides', main: true, giver: 'maren', turnin: 'maren', lvl: 2, title: 'Leather for the Watch',
    text: 'Seabreak\'s watchmen stand guard in rags. Maren wants hides for their armour, and an armoury to keep it in.',
    done: '', obj: [{ t: 'collect', item: 'raw_hide', n: 8, label: 'Gather 8 Raw Hide' }, { t: 'talk', npc: 'maren', label: 'Bring them to Elder Maren' }], take: { raw_hide: 8 }, xp: 260, gold: 20, gear: true, gearRarity: 1 },
  { id: 'mq_towers', main: true, giver: 'maren', turnin: 'maren', lvl: 2, title: 'Watchtowers',
    text: 'A wall without towers is just a fence. Maren will raise watchtowers at the north gate and the pier gate.',
    done: '', obj: [{ t: 'collect', item: 'wood', n: 30, label: 'Gather 30 Wood' }, { t: 'collect', item: 'stone', n: 25, label: 'Gather 25 Stone' }, { t: 'talk', npc: 'maren', label: 'Bring them to Elder Maren' }], take: { wood: 30, stone: 25 }, xp: 360, gold: 30, items: { herb_roast: 2 } },
  { id: 'mq_gold', main: true, giver: 'maren', turnin: 'maren', lvl: 3, title: 'Coin for the Guard',
    text: 'Walls need people on them. Maren will hire more guards, and house them, if you can bring her the coin.',
    done: '', obj: [{ t: 'gold', n: 60, label: 'Bring Elder Maren 60 gold' }, { t: 'talk', npc: 'maren', label: 'Give it to Elder Maren' }], takeGold: 60, xp: 300, gold: 0, gear: true, gearRarity: 1 },
  { id: 'mq_people', main: true, giver: 'maren', turnin: 'maren', lvl: 3, title: 'The People of Seabreak',
    text: 'Maren says a village is its people. Help at least three folk of Seabreak with their troubles, then come back to her.',
    done: '', obj: [{ t: 'sideq', n: 3, label: 'Help 3 people of Seabreak' }, { t: 'talk', npc: 'maren', label: 'Return to Elder Maren' }], xp: 400, gold: 25, items: { potion_heal: 2 } },
  { id: 'mq_pip', main: true, giver: 'maren', turnin: null, lvl: 3, title: 'Into the Goblin Cave',
    text: 'Pip, the apprentice of Saltmere\'s master shipwright, went into the goblin cave west of Seabreak to spy on them and never came back. Find him.',
    done: '', obj: [{ t: 'story', n: 1, label: 'Find the goblin cave west of Seabreak (opening soon)' }], xp: 0, gold: 0 },
  { id: 'q_stranger', giver: 'maren', turnin: 'bram', lvl: 1, title: 'A Stranger from the Sea',
    text: 'You sailed in on a boat held together with rope and hope, wearing little more than rags. If you mean to stay while she is mended, you\'ll need to earn your keep. Bram the woodcutter, by the workbench, can teach you to fell a tree.',
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
    text: 'Those crabs on the beach are fat this year. Fetch me 4 Crab Meat and I\'ll show you something.',
    done: 'Fat ones! Now try cooking it up: put that meat on the campfire and make some Crab Cakes.', obj: [{ t: 'collect', item: 'crab_meat', n: 4, label: 'Collect Crab Meat from Shore Crabs' }], xp: 60, gold: 3 },
  { id: 'q_crabcakes', giver: 'pell', turnin: 'pell', lvl: 1, req: ['q_crabs'], title: 'Crab Cakes',
    text: 'Take that crab meat to the campfire and cook up 4 Crab Cakes. One for you, one for me... well, three for me.',
    done: 'Mmm! Just like my mother made. Here, keep the rest.', obj: [{ t: 'craft', item: 'crab_cake', n: 4, label: 'Cook Crab Cakes at the Campfire' }], take: { crab_cake: 3 }, xp: 70, gold: 4, items: { potion_heal: 1 } },
  { id: 'q_litter', giver: 'lyra', turnin: 'lyra', lvl: 2, req: ['q_hides'], title: 'Thinning the Litter',
    text: 'Too many young wolves and bears near the village, raiding the fish racks. Drive some off: defeat 4 Wolf Pups and 3 Bear Cubs.',
    done: 'The racks will be safe for a while.', obj: [{ t: 'kill', mob: 'wolfpup', n: 4, label: 'Defeat Wolf Pups' }, { t: 'kill', mob: 'bearcub', n: 3, label: 'Defeat Bear Cubs' }], xp: 160, gold: 10, gear: true },
  { id: 'q_goblins', giver: 'maren', turnin: 'maren', lvl: 2, req: ['q_stranger'], title: 'Goblin Trouble',
    text: 'Goblins have pitched their filthy tents in the meadow, east and west of the village. They sit around their fires and send raiders out on patrol. Thin them out: defeat 6 goblins and bring me their ears as proof.',
    done: 'Ugh, put those away! But thank you. The roads are safer already.', obj: [{ t: 'kill', mob: 'goblin', n: 4, label: 'Defeat Goblin Raiders' }, { t: 'kill', mob: 'goblin_slinger', n: 2, label: 'Defeat Goblin Slingers' }, { t: 'collect', item: 'goblin_ear', n: 6, label: 'Collect Goblin Ears' }], take: { goblin_ear: 6 }, xp: 220, gold: 15, gear: true },
  { id: 'q_onward', giver: 'maren', turnin: 'kael', lvl: 4, req: ['q_blade'], title: 'Beyond the Meadow',
    text: 'You\'ve grown strong here. North, past the meadow, lies the Tanglewood. Scout Kael keeps an outpost there. He could use someone like you. Follow the road north.',
    done: 'Maren sent you? Good. We need every blade.', obj: [{ t: 'talk', npc: 'kael', label: 'Find Scout Kael in the Tanglewood' }], xp: 200, gold: 10 },
  { id: 'q_wolves', giver: 'kael', turnin: 'kael', lvl: 4, req: ['q_onward'], title: 'The Grey Pack',
    text: 'Grey wolves hunt the roads. Unlike the pups, these will come for you on sight. Kill 6.',
    done: 'Six fewer fangs in the dark.', obj: [{ t: 'kill', mob: 'wolf', n: 6, label: 'Kill Grey Wolves' }], xp: 300, gold: 14, gear: true },
  { id: 'q_herbs', giver: 'fen', turnin: 'fen', lvl: 4, req: ['q_onward'], title: 'Roots of Healing',
    text: 'Gather Healroot, the glowing green herb on the forest floor, then brew 3 Healing Potions at my alchemy table.',
    done: 'Keep a few for yourself. You\'ll need them.', obj: [{ t: 'collect', item: 'healroot', n: 6, label: 'Gather Healroot' }, { t: 'craft', item: 'potion_heal', n: 3, label: 'Brew Healing Potions' }], xp: 300, gold: 12 },
  { id: 'q_tigers', giver: 'kael', turnin: 'kael', lvl: 6, req: ['q_wolves'], title: 'Stripes in the Jungle',
    text: 'Tigers stalk the Tanglewood now. The goblins drove them down off Kelda when they took the mountain, and they are hungry. Thin them out, east or west of here.',
    done: 'Good hunting. The trails will be safer for it.', obj: [{ t: 'kill', mob: 'tiger', n: 6, label: 'Hunt jungle tigers' }], xp: 260, gold: 14, gear: true },
  { id: 'q_iron', giver: 'kael', turnin: 'kael', lvl: 5, req: ['q_onward'], title: 'Iron in the Hills',
    text: 'Iron veins run through the rocky hills of the Tanglewood. You\'ll need a Copper Pickaxe from a forge to break them. Bring me 6 Iron Ore.',
    done: 'Good iron. Smelt it and arm yourself.', obj: [{ t: 'collect', item: 'iron_ore', n: 6, label: 'Mine Iron Ore' }], xp: 380, gold: 16 },
  { id: 'q_raiders', giver: 'kael', turnin: 'kael', lvl: 7, req: ['q_tigers'], title: 'Raiders in the Hills',
    text: 'There is a goblin raider camp east of the river, at the foot of Kelda. They ambush anyone on the north road. Break it: kill their raiders and the brutes who lead them.',
    done: 'That should keep the road open for a while. You fight like someone who has done this before.', obj: [{ t: 'kill', mob: 'goblin', n: 8, label: 'Kill goblin raiders' }, { t: 'kill', mob: 'goblin_brute', n: 2, label: 'Kill goblin brutes' }], xp: 380, gold: 22, gear: true, gearRarity: 2 },
  { id: 'q_highlands', giver: 'kael', turnin: 'hilda', lvl: 9, req: ['q_raiders'], title: 'To Stonewatch',
    text: 'If you mean to go further, find Captain Hilda at Stonewatch, the old lodge on the western slopes of Kelda. She has held out against the goblins longer than anyone.',
    done: 'Kael sent you? Then you can swing a blade. Good. We need every one.', obj: [{ t: 'talk', npc: 'hilda', label: 'Find Captain Hilda at Stonewatch' }], xp: 120, gold: 5 },
  { id: 'q_bears', giver: 'hilda', turnin: 'hilda', lvl: 10, req: ['q_highlands'], title: 'The Great Bears',
    text: 'The big bears on Kelda\'s slopes have gone mad with the goblins hunting their cubs. They charge anything that moves. Put six of them down.',
    done: 'Grim work, but needed. Here, this was my father\'s.', obj: [{ t: 'kill', mob: 'bear', n: 6, label: 'Kill bears on the slopes of Kelda' }], xp: 480, gold: 26, gear: true, gearRarity: 2 },
  { id: 'q_mithril', giver: 'dorn', turnin: 'dorn', lvl: 10, req: ['q_highlands'], title: 'The Shining Vein',
    text: 'Mithril! Pale blue veins up on the peaks. Ye\'ll need an Iron Pickaxe to break them. Bring me 6 Mithril Ore.',
    done: 'Beautiful. Simply beautiful.', obj: [{ t: 'collect', item: 'mithril_ore', n: 6, label: 'Mine Mithril Ore' }], xp: 900, gold: 40 },
  { id: 'q_warcamp', giver: 'hilda', turnin: 'hilda', lvl: 12, req: ['q_bears'], title: 'The War Camp',
    text: 'The goblins have a war camp on the eastern slopes. That is where the raids on Saltmere and on your little village are planned. Burn their courage out of them.',
    done: 'They will think twice before they march again. Not three times, though. Goblins never think three times.', obj: [{ t: 'kill', mob: 'goblin', n: 10, label: 'Kill goblins at the war camp' }, { t: 'kill', mob: 'goblin_slinger', n: 4, label: 'Kill goblin slingers' }], xp: 640, gold: 34, gear: true, gearRarity: 2 },
  { id: 'q_brutes', giver: 'hilda', turnin: 'hilda', lvl: 14, req: ['q_warcamp'], title: 'Brutes of Kelda',
    text: 'Gorgrak keeps his brutes close to his Hold, high on the north face of Kelda. Every brute you kill is one less at his side when you face him.',
    done: 'His guard is thin now. It is time.', obj: [{ t: 'kill', mob: 'goblin_brute', n: 6, label: 'Kill goblin brutes near the Hold' }], xp: 820, gold: 44, gear: true, gearRarity: 3 },
  { id: 'q_goblinking', giver: 'hilda', turnin: 'hilda', lvl: 18, req: ['q_brutes'], title: 'The Goblin King',
    text: 'Gorgrak the Goblin King. Twenty years ago he came ashore with a handful of goblins and now he rules this island from his Hold on Kelda. Kill him, and the island breathes again.',
    done: 'Gorgrak is dead? Ha! They will sing about this in Saltmere for a hundred years.', obj: [{ t: 'kill', mob: 'goblin_chief', n: 1, label: 'Kill Gorgrak at the Hold on Mount Kelda' }], xp: 1800, gold: 120, gear: true, gearRarity: 4 },
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

// gathering, not slaying: ordinary creatures give trophies (they only drop while a quest wants them);
// only bosses and named creatures are 'Defeat'. Item objectives count what is in your bag.
export const QUEST_DROPS = { wolfpup: 'pup_pelt', bearcub: 'cub_pelt', wolf: 'wolf_fang', bear: 'bear_claw', tiger: 'tiger_pelt', goblin: 'goblin_ear', goblin_slinger: 'goblin_sling', goblin_brute: 'brute_tooth' };
QUESTS.forEach(q => q.obj.forEach((o, i) => {
  if (o.t === 'kill' && QUEST_DROPS[o.mob] && !(MOBS[o.mob].boss || MOBS[o.mob].elite)) { const it = QUEST_DROPS[o.mob]; q.obj[i] = { t: 'collect', item: it, n: o.n, from: o.mob, label: `Gather ${o.n} ${it === 'brute_tooth' ? 'Brute Teeth' : ITEMS[it].name + 's'}`, hint: o.label }; q.take = Object.assign({}, q.take || {}, { [it]: o.n }); }
  else if (o.t === 'kill') o.label = o.label.replace(/^Kill /, 'Defeat ');
  if (q.obj[i].t === 'collect' && ITEMS[q.obj[i].item] && !q.obj[i].from) { const it = ITEMS[q.obj[i].item]; q.obj[i].label = `Gather ${q.obj[i].n > 1 ? q.obj[i].n + ' ' : ''}${it.name}`; }
}));
// one line per item: merge objectives that ask for the same thing
QUESTS.forEach(q => { const seen = {}; q.obj = q.obj.filter(o => { if (o.t !== 'collect') return true; if (seen[o.item]) { seen[o.item].n = Math.max(seen[o.item].n, o.n); seen[o.item].label = seen[o.item].label.replace(/\d+/, seen[o.item].n); return false; } seen[o.item] = o; return true; }); if (q.take) for (const k in q.take) if (seen[k]) q.take[k] = seen[k].n; });
// the people who give you work say what it means for the village
const NEED = {
  q_timber: 'Every plank goes into the palisade. The goblins tested it again last week.', q_planks: 'The stockade needs mending before the next raid.', q_ore: 'Our smith has nothing to forge spearheads from.',
  q_smelt: 'Ingots mean spearheads, and spearheads mean we live through the winter.', q_cotton: 'Bandages, mostly. We go through a lot of bandages these days.', q_hides: 'Leather for the guards\' jerkins. They stand watch in rags.',
  q_crabs: 'Food is short. The goblins burn our fields.', q_litter: 'The wolves get bolder every time the goblins drive them down the mountain.', q_goblins: 'If we do not push them back, Seabreak will not see another summer.',
  q_wolves: 'The road to the village is not safe while the pack runs.', q_herbs: 'The healers have run dry.', q_tigers: 'Woodcutters have stopped going out. Seabreak needs that timber.',
  q_raiders: 'Every raid that leaves that camp ends at a village gate.', q_bears: 'Stonewatch cannot hold if we are fighting bears as well as goblins.', q_warcamp: 'Break the war camp and Seabreak and Saltmere both breathe easier.',
};
QUESTS.forEach(q => { if (NEED[q.id] && !q.text.includes(NEED[q.id])) q.text += ' ' + NEED[q.id]; });
// every quest pays: gold, plus a weapon or armour piece for your class, or food (quests that already give something keep it)
QUESTS.forEach((q, i) => { if (q.main) return;
  q.gold = Math.max(q.gold || 0, 3 + q.lvl * 3);
  if (q.gear || q.items) return;
  if (i % 2) { q.gear = true; q.gearRarity = q.lvl >= 10 ? 2 : 1; }
  else q.items = { [q.lvl < 4 ? 'roast_meat' : q.lvl < 10 ? 'herb_roast' : 'hunter_stew']: 2 };
});
export const MERCHANT_STOCK = ['potion_heal', 'bandage', 'crab_cake', 'roast_meat', 'berry_juice', 'mint_tea', 'honey_mead', 'dwarf_ale', 'linen', 'leather', 'planks', 'copper_ingot', 'iron_ingot'];

// ---- the rest of the classic party (Kingdom Battles only), defined in classes2.js ----
import { NEW_CLASSES } from './classes2.js';
const PAIR_PARTS = { maceshield: ['mace', 'shield'], swordshield: ['sword', 'shield'], swordmace: ['sword', 'mace'] };
for (const [id, c] of Object.entries(NEW_CLASSES)) {
  const weapons = [...new Set(c.weapons.flatMap(w => PAIR_PARTS[w] ? [w, ...PAIR_PARTS[w]] : [w]))];
  CLASSES[id] = { name: c.name, battleOnly: true, desc: c.desc, weapons, armor: c.armor, hp: c.pool.hp[0], mana: c.pool.mana[0], colors: c.colors };
  CLASS_POOLS[id] = c.pool; CLASS_TREE[id] = [];
  ABILITIES[id] = c.abilities.map(a => Object.assign({ key: '', icon: '', kit: true }, a));
}
export const STARTING_PAIR = PAIR_PARTS;

// the classes with skill trees use their tree nodes as their talent list (so perks and saves line up)
for (const [cls, trees] of Object.entries(CLASS_TREES)) { const nodes = []; for (const T of trees) for (const n of T.nodes) { if (n.ab) { const a = ABILITIES[cls].find(x => x.id === n.ab); n.name = a.name; n.icon = a.id; n.desc = a.desc; } n.tree = T.id; n.max = 1; nodes.push(n); } CLASS_TREE[cls] = nodes; }

// ---- the hotbar: keys 1-5 hold buffs, songs and heals; F, C and Q hold the abilities that deal damage ----
export const HOTBAR_KEYS = ['1', '2', '3', '4', '5', 'F', 'C', 'Q'], SUPPORT_SLOTS = 5;
const SUPPORT_AB = new Set(['shieldwall', 'warbanner', 'vigorbanner', 'stonebanner', 'laststand', 'battlecry', 'adrenaline', 'rampage', 'bloodrage', 'undying', 'mending', 'disengage', 'focus', 'barkskin', 'vanish',
  'smokebomb', 'quickreload', 'eagleeye', 'healingwave', 'ancestralward', 'chainheal', 'wartotem', 'spiritlink', 'blink', 'manasurge', 'icebarrier', 'timewarp', 'rally', 'fortify', 'tourniquet', 'secondwind', 'fielddress']);
export const isSupport = (a) => !!(a && (a.song || ['heal', 'hot', 'buff', 'stealth'].includes(a.t) || SUPPORT_AB.has(a.id)));
export const slotFits = (i, a) => (i < SUPPORT_SLOTS) === isSupport(a);

// Kingdom Battles keeps the original warrior kit (the campaign and Training Yard use the new one above)
export const WARRIOR_BATTLE = [
    { id: 'charge', cost: 30, name: "Charge", key: '', level: 1, cd: 6, icon: '', desc: "Charge forward 12 m, knocking aside and stunning everything in your path." },
    { id: 'bash', cost: 25, name: "Shield Bash", key: '', level: 2, cd: 6, icon: '', desc: "Slam your shield into the enemies in front of you: damage, knock back and stun them for 2 s." },
    { id: 'shieldwall', cost: 40, name: "Shield Wall", key: '', level: 4, cd: 20, icon: '', desc: "Brace yourself: take 60% less damage from every direction for 6 s." },
    { id: 'cleavestrike', cost: 30, name: "Cleaving Strike", key: '', level: 6, cd: 7, icon: '', desc: "A wide sweeping blow that hits every enemy in front of you." },
    { id: 'laststand', cost: 35, name: "Last Stand", key: '', level: 8, cd: 40, icon: '', desc: "Refuse to fall: heal 30% of your health and take 25% less damage for 10 s." },
    { id: 'shieldthrow', cost: 30, name: "Shield Throw", key: '', level: 10, cd: 9, icon: '', desc: "Hurl your shield: it stuns the first enemy and bounces to two more." },
    { id: 'fortify', cost: 35, name: "Fortify", key: '', level: 12, cd: 25, icon: '', desc: "+50% armour and your guard cannot be broken for 12 s." },
    { id: 'execute', cost: 35, name: "Execute", key: '', level: 14, cd: 10, icon: '', desc: "A massive overhead strike. Deals double damage to enemies below 35% health." },
    { id: 'hamstring', cost: 20, name: "Hamstring", key: '', level: 16, cd: 6, icon: '', desc: "A crippling cut: the target bleeds and is slowed for 6 s." },
    { id: 'bulwark', cost: 50, name: "Bulwark Slam", key: '', level: 18, cd: 18, icon: '', desc: "Slam your shield into the ground: knock back and stun every enemy within 6 m." },
];

// ---- necromancer: siphons, a bone golem and the lich lord (campaign trees) ----
if (ABILITIES.necromancer) ABILITIES.necromancer.push(
  { id: 'sapstrength', name: 'Sap Strength', level: 5, cd: 14, cost: 25, t: 'curse', range: 30, sap: 'strength', dmg: 0.4, kit: true, key: '', icon: '', campaign: true, desc: 'Drink the strength of the enemy you aim at: for 10 s it hits 35% weaker and you hit 25% harder.' },
  { id: 'sapspeed', name: 'Sap Speed', level: 7, cd: 14, cost: 25, t: 'curse', range: 30, sap: 'speed', dmg: 0.3, kit: true, key: '', icon: '', campaign: true, desc: 'Steal its speed: the enemy you aim at is slowed for 8 s and you move and cast faster.' },
  { id: 'manaleech', name: 'Mana Leech', level: 9, cd: 12, cost: 0, t: 'curse', range: 30, sap: 'mana', dmg: 0.5, kit: true, key: '', icon: '', campaign: true, desc: 'Pull the magic out of the enemy you aim at: damage it and refill 25% of your mana.' },
  { id: 'bonegolem', name: 'Raise Bone Golem', level: 14, cd: 60, cost: 50, t: 'summon', pet: 'bonegolem', n: 1, extra: 0, dur: 600, kit: true, key: '', icon: '', campaign: true, desc: 'A towering golem of fused bones rises where you aim: it soaks up blows and crushes whatever you fight.' },
  { id: 'lichlord', name: 'Lich Lord', level: 18, cd: 90, cost: 50, t: 'buff', buff: 'lich', dur: 20, kit: true, key: '', icon: '', campaign: true, desc: 'Become a Lich Lord for 20 s: a skeleton with burning green eyes and a long flowing cape. Your spells hit 40% harder and you take 25% less damage.' },
);
// ---- skill trees for every other class: three themed trees each, abilities unlocked inside them, generic passives ----
// [tree name, tagline, colour, role (offense | defense | support), ability ids]
const TREE_DEFS = {
  berserker: [['Carnage', 'Spin, smash and cleave through crowds', '#e2533a', 'offense', ['earthsplitter', 'whirlwind', 'groundslam', 'rampage']], ['Bloodrage', 'Pain only makes you stronger', '#c02a2a', 'defense', ['bloodrage', 'adrenaline', 'undying']], ['Warcry', 'Roars that break the enemy', '#f0a030', 'support', ['battlecry', 'intimshout', 'warstomp']]],
  ranger: [['Marksman', 'One perfect arrow at a time', '#e2a23a', 'offense', ['spectral', 'focus', 'pinning', 'barrage']], ['Trapper', 'Snares, spikes and ambushes', '#a08050', 'defense', ['snaretrap', 'disengage', 'explotrap']], ['Wildheart', 'The forest looks after its own', '#6ad04a', 'support', ['mending', 'barkskin', 'vanish']]],
  musketeer: [['Sharpshooter', 'Steady aim, deadly shots', '#e2a23a', 'offense', ['grapeshot', 'eagleeye', 'volleyfire', 'incendiary']], ['Powder', 'Kegs, cannons and fire', '#ff7a3a', 'offense', ['powderkeg', 'cannonade', 'quickreload']], ['Skirmisher', 'Smoke, steel and dirty tricks', '#8a9ab0', 'defense', ['bayonet', 'smokebomb', 'caltrops']]],
  shaman: [['Storm', 'Lightning and the shaking earth', '#5ac8ff', 'offense', ['earthshock', 'stormcall', 'earthbind', 'hex']], ['Ancestors', 'The old ones mend the living', '#6ad04a', 'support', ['healingwave', 'chainheal', 'spiritlink', 'ancestralward']], ['Spirits', 'Wolves and totems at your side', '#c89a4a', 'defense', ['spiritwolf', 'wartotem']]],
  wizard: [['Pyromancy', 'Burn it all', '#ff7a3a', 'offense', ['firering', 'missiles', 'inferno']], ['Frost', 'Slow them, freeze them, shatter them', '#8ad8ff', 'defense', ['frostnova', 'icebarrier', 'timewarp']], ['Arcana', 'Raw power and the folding of space', '#b070ff', 'support', ['chain', 'blink', 'manasurge', 'lightstorm']]],
  cleric: [['Mercy', 'Mend every wound', '#7ee07e', 'support', ['radiantheal', 'renew', 'prayer']], ['Judgement', 'The light burns the wicked', '#ffd050', 'offense', ['holysmite', 'hammeroflight', 'consecrate', 'judgement']], ['Sanctuary', 'Shields of faith', '#8ac8ff', 'defense', ['blessing', 'divineaegis', 'resolve']]],
  paladin: [['Retribution', 'Holy steel, swung hard', '#ffb040', 'offense', ['hammerstrike', 'divinecharge', 'smitearc', 'avenger']], ['Protection', 'The wall that does not fall', '#8ac8ff', 'defense', ['devotion', 'shieldofl', 'consecration']], ['Holy', 'Light that heals', '#fff0a0', 'support', ['layonhands', 'holylight', 'crusade']]],
  darkknight: [['Blood', 'Their life becomes yours', '#c02a2a', 'defense', ['lifetap', 'deathcoil', 'bloodfury']], ['Dread', 'Terror and the reaping blade', '#8a6aff', 'offense', ['cleave2', 'deathgrip', 'dreadroar', 'harvest']], ['Plague', 'Rot, armour of bone, an army of the dead', '#90e040', 'support', ['plague', 'darkarmor', 'armyofdead']]],
  druid: [['Moon', 'Moonfire and falling stars', '#b0a0ff', 'offense', ['moonfire', 'hurricane', 'starfall']], ['Grove', 'Bloom, regrow, restore', '#6ad04a', 'support', ['regrowth', 'barkward', 'wildbloom', 'tranquility']], ['Wild', 'Bears, thorns and grasping roots', '#a07a4a', 'defense', ['entangle', 'callbear', 'thornwall']]],
  monk: [['Tiger', 'A hundred fists, a single strike', '#ff8a3a', 'offense', ['tigerpalm', 'pressure', 'hundredfists', 'dragonstrike']], ['Wind', 'Never where they strike', '#c8f0ff', 'defense', ['flyingkick', 'sweepkick', 'windstep']], ['Lotus', 'Stillness and inner strength', '#f0c0ff', 'support', ['innerpeace', 'feigndeath', 'serenity']]],
  bard: [['Valor', 'Songs that sharpen every blade', '#ffb040', 'support', ['warsong', 'flamesong', 'anthem']], ['Grace', 'Songs that mend and carry you', '#7ee07e', 'support', ['travel', 'soothe', 'clarityhymn']], ['Discord', 'Music as a weapon', '#b070ff', 'offense', ['flourish', 'lullaby', 'crescendo', 'dirge']]],
  rogue: [['Assassin', 'From the shadows, straight to the heart', '#e2533a', 'offense', ['backstab', 'kidney', 'garrote']], ['Venom', 'Poison on every edge', '#90e040', 'offense', ['poisontrap', 'envenom', 'deadlypoison']], ['Shadow', 'Smoke, caltrops and vanishing', '#8a7aa8', 'defense', ['vanish2', 'smokescreen', 'snaretrap2', 'caltrops2']]],
  necromancer: [['Undeath', 'Raise the dead and command them', '#b0c8a0', 'support', ['raiseskel', 'skelmage'], 'bonegolem'], ['Siphon', 'Drink their health, strength, speed and mana', '#90e040', 'offense', ['drainlife', 'corruption', 'sapstrength', 'sapspeed', 'manaleech', 'plague2']], ['Bone', 'Bone armour, bone spears, bone prisons', '#e8e0c8', 'defense', ['bonearmor', 'bonespear', 'deathnova', 'boneprison', 'fear'], 'lichlord']],
  elementalist: [['Flame', 'Sprites, lava and firestorms', '#ff7a3a', 'offense', ['firesprite', 'lavaburst', 'firestorm']], ['Stone', 'Golems and stone skin', '#a09080', 'defense', ['boulder', 'elemshield', 'earthel']], ['Tempest', 'Wind, ice and thunder', '#5ac8ff', 'offense', ['gale', 'frostbind', 'thunder', 'cataclysm']]],
  enchanter: [['Mind', 'Break their thoughts', '#b070ff', 'offense', ['mindblast', 'mindrot', 'mindstorm']], ['Illusion', 'Charm, sleep and confusion', '#f0a0ff', 'defense', ['mesmerize', 'masssleep', 'phantasm', 'confusion']], ['Runes', 'Haste, wards and clarity', '#8ac8ff', 'support', ['hasteall', 'runeshield', 'clarity']]],
  beastmaster: [['Pack', 'Never hunt alone', '#c89a4a', 'support', ['warbeast', 'mendpet', 'packfrenzy', 'packcall']], ['Fang', 'Claw, rend and pounce', '#e2533a', 'offense', ['rendclaw', 'pounce', 'whirlclaw']], ['Wild', 'The roar of the stampede', '#6ad04a', 'defense', ['feralroar', 'stampede', 'primalbond']]],
};
// passives by the tree's role: [effect, name choices, description]
const FX_INFO = {
  dmg: [['Ferocity', 'Killing Edge', 'Wrath', 'Savagery', 'Brutal Force', 'Bloodied Edge'], 'You deal 6% more damage.', 'dmg'],
  crit: [['Keen Eye', 'Precision', 'Weak Spot', 'Deadly Aim', 'Find the Gap'], '+5% chance to land critical hits.', 'crit'],
  cd: [['Quick Hands', 'Momentum', 'Flow', 'Practised', 'Second Nature'], 'Your abilities recharge 8% faster.', 'combo'],
  hp: [['Toughness', 'Thick Hide', 'Iron Will', 'Hardy', 'Stout Heart'], '+8% maximum health.', 'heart'],
  taken: [['Grit', 'Steadfast', 'Thick Skin', 'Endurance', 'Unyielding'], 'You take 5% less damage.', 'shield'],
  regen: [['Second Wind', 'Vigour', 'Recovery', 'Mending Flesh', 'Rally'], 'Regenerate 0.3% of your health every second, even in a fight.', 'heart'],
  armor: [['Plating', 'Warded', 'Hardened', 'Bulwark', 'Guarded'], '+10% armour.', 'shield'],
  heal: [['Compassion', 'Warm Hands', 'Life Bloom', 'Devotion', 'Soothing Touch'], 'Your heals and regeneration are 10% stronger.', 'heart'],
  cost: [['Efficiency', 'Deep Reserves', 'Thrift', 'Clear Mind', 'Focus'], 'Your abilities cost 10% less.', 'mana'],
  speed: [['Fleet Foot', 'Swiftness', 'Light Step', 'Wanderer', 'Tailwind'], 'Move 4% faster.', 'wind'],
};
const ROLE_FX = { offense: ['dmg', 'crit', 'cd', 'dmg', 'crit'], defense: ['hp', 'taken', 'regen', 'armor', 'taken'], support: ['heal', 'cost', 'cd', 'speed', 'heal'] };
const ULT = { offense: ['u_dmg', 'Deal 12% more damage, and your crits hit 20% harder.'], defense: ['u_def', 'Take 12% less damage and regenerate 0.5% of your health every second.'], support: ['u_sup', 'Your heals are 25% stronger and your abilities recharge 15% faster.'] };
let _seed = 0;
for (const [cls, defs] of Object.entries(TREE_DEFS)) {
  if (CLASS_TREES[cls] || !ABILITIES[cls]) continue;
  const A = (id) => ABILITIES[cls].find(a => a.id === id), lowest = ABILITIES[cls].slice().sort((a, b) => a.level - b.level)[0];
  CLASS_TREES[cls] = defs.map(([name, tag, col, role, ids, ultAb], ti) => {
    const abs = ids.map(A).filter(Boolean).sort((a, b) => a.level - b.level), tid = cls + '_' + ti, nodes = [], used = new Set();
    const pas = (k, row, colN, req) => { const fx = ROLE_FX[role][k], F = FX_INFO[fx], nm = F[0][(_seed++ + ti) % F[0].length]; const id = `${tid}_p${k}`; nodes.push({ id, t: 'pas', fx, name: nm, icon: F[2], row, col: colN, req, desc: F[1] }); return id; };
    const ab = (a, row, req) => { const id = `${tid}_${a.id}`; nodes.push({ id, t: 'ab', ab: a.id, row, col: 1, req, free: a === lowest }); return id; };
    const up = (a, row, colN, req) => { const id = 'a_' + a.id; if (used.has(id)) return null; used.add(id); nodes.push({ id, t: 'pas', name: 'Empowered ' + a.name, icon: a.id, row, col: colN, req, desc: `${a.name} is 50% stronger.` }); return id; };
    const n0 = ab(abs[0], 0), n1 = abs[1] ? ab(abs[1], 1, n0) : null, p1 = pas(0, 1, 0, n0), p2 = pas(1, 1, 2, n0);
    const n2 = abs[2] ? ab(abs[2], 2, n1 || n0) : null, u0 = up(abs[0], 2, 0, p1), p3 = pas(2, 2, 2, p2);
    const n3 = abs[3] ? ab(abs[3], 3, n2) : (abs[1] ? up(abs[1], 3, 1, n2 || n1) : null), p4 = pas(3, 3, 0, u0), u1 = abs[1] && abs[3] ? up(abs[1], 3, 2, p3) : pas(4, 3, 2, p3);
    if (abs[2]) up(abs[2], 4, 1, n3 || n2); if (abs[3]) up(abs[3], 4, 2, u1);
    for (const a of abs.slice(4)) ab(a, 9, null); // more abilities: placed by the layout pass below
    if (ultAb && A(ultAb)) nodes.push({ id: tid + '_ult', t: 'ult', ab: ultAb, row: 5, col: 1 }); // this tree's capstone is an ability
    else nodes.push({ id: tid + '_ult', t: 'ult', fx: ULT[role][0], name: name + ' Ascendant', icon: 'crown', row: 5, col: 1, desc: ULT[role][1] });
    return { id: tid, name, tag, col, icon: abs[0].id, nodes };
  });
}
// the bard's Valor tree carries the song-range passive
{ const T = CLASS_TREES.bard && CLASS_TREES.bard[0], n = T && T.nodes.find(x => x.id === 'bard_0_p1'); if (n) Object.assign(n, { fx: 'songreach', name: 'Carrying Voice', icon: 'shout', desc: 'Your songs reach 25 m instead of 15 m.' }); }
for (const [cls, trees] of Object.entries(CLASS_TREES)) { if (cls === 'warrior') continue; const nodes = []; for (const T of trees) for (const n of T.nodes) { if (n.t === 'ab') { const a = ABILITIES[cls].find(x => x.id === n.ab); n.name = a.name; n.icon = a.id; n.desc = a.desc; } n.tree = T.id; n.max = 1; nodes.push(n); } CLASS_TREE[cls] = nodes; }

// ---- make sure any two maxed trees can fill the whole hotbar: every tree gets at least 3 buffs/songs/heals (keys 1-5)
// and at least 2 damage abilities (F C Q). Where a tree is short, it gets new class abilities built from proven effects.
export const GEN_ICONS = { sapstrength: ['fist', 'nature'], sapspeed: ['wind', 'nature'], manaleech: ['drop', 'arcane'], bonegolem: ['skull', 'steel'], lichlord: ['skull', 'nature'] };
const MELEE = new Set(['warrior', 'berserker', 'paladin', 'darkknight', 'monk', 'rogue', 'beastmaster']);
const NO_HEAL = new Set(['warrior', 'berserker', 'rogue', 'monk', 'musketeer', 'wizard', 'elementalist', 'enchanter']);
const SUP_T = [
  (n) => ({ t: 'buff', buff: 'cry', dur: 8, r: 15, allyBuff: 'rally', cd: 22, cost: 30, name: n[0], desc: 'You and allies within 15 m hit 30% harder for 8 s.', ic: ['shout', 'red'] }),
  (n) => ({ t: 'buff', buff: 'ward', dur: 6, r: 15, allyBuff: 'ward', cd: 24, cost: 30, name: n[1], desc: 'A protective ward: you and allies within 15 m take 40% less damage for 6 s.', ic: ['shield', 'frost'] }),
  (n, heal) => heal ? ({ t: 'hot', pct: 0.3, dur: 10, r: 15, ally: 0.2, cd: 20, cost: 30, name: n[2], desc: 'You regenerate 30% of your health over 10 s, and allies within 15 m are healed 20%.', ic: ['heart', 'nature'] })
                    : ({ t: 'hot', pct: 0.25, dur: 10, cd: 22, cost: 25, name: n[2], desc: 'Catch your breath: regenerate 25% of your health over 10 s.', ic: ['heart', 'nature'] }),
  (n) => ({ t: 'buff', buff: 'focus', dur: 8, cd: 25, cost: 30, name: n[3], desc: 'For 8 s you attack and cast 35% faster.', ic: ['bolt', 'gold'] }),
  (n) => ({ t: 'buff', buff: 'stand', heal: 0, dur: 10, cd: 30, cost: 35, name: n[4], desc: 'Dig in: take 25% less damage for 10 s.', ic: ['shield', 'gold'] }),
  (n) => ({ t: 'buff', buff: 'barrier', amount: 0.25, dur: 12, cd: 26, cost: 30, name: n[5], desc: 'A shield that absorbs damage equal to 25% of your health, for up to 12 s.', ic: ['shield', 'arcane'] }),
  (n) => ({ t: 'buff', buff: 'swind', dur: 8, r: 15, allyBuff: 'haste', cd: 24, cost: 25, name: n[6], desc: 'You and allies within 15 m move faster for 8 s.', ic: ['wind', 'frost'] }),
  (n) => ({ t: 'buff', buff: 'surge', dur: 6, cd: 40, cost: 0, name: n[7], desc: 'For 6 s your abilities cost nothing.', ic: ['drop', 'arcane'] }),
];
const SUP_MORE = ['Aegis', 'Tailwind', 'Wellspring'];
const SUP_NAMES = {
  warrior: ['Battle Fervor', 'Iron Will', 'Second Breath', 'Weapon Frenzy', 'Hold the Line'], berserker: ['Blood Frenzy', 'Thick Skull', 'Gasp of Rage', 'Red Mist', 'Unbowed'],
  ranger: ['Hunter\'s Mark', 'Leafward', 'Forest Breath', 'Quickdraw', 'Hide and Wait'], musketeer: ['Steady Volley', 'Cover Fire', 'Field Ration', 'Rapid Reload', 'Entrench'],
  shaman: ['Totem of Fury', 'Stoneward', 'Spirit Breath', 'Storm Haste', 'Earthen Stance'], wizard: ['Arcane Empowerment', 'Mana Ward', 'Restore', 'Haste Spell', 'Stoneskin'],
  cleric: ['Zeal', 'Sanctified Ward', 'Mending Light', 'Swift Prayer', 'Vow of Stone'], paladin: ['Righteous Zeal', 'Aegis', 'Healing Hymn', 'Swift Judgement', 'Bulwark of Faith'],
  darkknight: ['Dark Fervor', 'Unholy Ward', 'Feast of Blood', 'Hastened Doom', 'Grave Stance'], druid: ['Wild Fury', 'Oakward', 'Bloom', 'Wind of the Wilds', 'Rooted'],
  monk: ['Tiger Focus', 'Iron Skin', 'Breath of Life', 'Flowing Strikes', 'Mountain Stance'], bard: ['Rousing Chord', 'Ballad of Shields', 'Healing Refrain', 'Quick Tempo', 'Steady Verse'],
  rogue: ['Killing Mood', 'Shadow Cloak', 'Catch Breath', 'Adrenaline Rush', 'Evasion'], necromancer: ['Unholy Command', 'Grave Ward', 'Death Pact', 'Soul Haste', 'Vampiric Resolve', 'Siphon Shield', 'Cold Wind of the Grave', 'Bone Focus'],
  elementalist: ['Elemental Fury', 'Stone Ward', 'Spring Water', 'Lightning Reflexes', 'Granite Form'], enchanter: ['Empower', 'Mirror Ward', 'Renewal Rune', 'Quicken', 'Rune of Stone'],
  beastmaster: ['Call of the Wild', 'Thick Hide', 'Lick Wounds', 'Hunt\'s Haste', 'Pack Stance'],
};
const DMG_T = (melee, k, cls) => melee
  ? [{ t: 'strike', reach: 3.2, dmg: 1.9, stun: 0.8, cd: 7, cost: 20, ic: ['sword', 'steel'] }, { t: 'nova', r: 5, dmg: 1.4, cd: 10, cost: 25, ic: ['slam', 'steel'] }, { t: 'cone', range: 6, ang: 0.8, dmg: 1.5, cd: 9, cost: 25, ic: ['burst', 'red'] }][k % 3]
  : [{ t: 'bolt', kind: 'arcane', speed: 45, dmg: 1.7, cd: 5, cost: 20, ic: ['bolt', 'arcane'] }, { t: 'nova', r: 6, dmg: 1.4, cd: 10, cost: 25, ic: ['burst', 'arcane'] }, { t: 'bolt', kind: 'arcane', speed: 50, dmg: 2.2, cd: 9, cost: 30, ic: ['meteor', 'fire'] }][k % 3];
const DMG_NAMES = { ranger: ['Piercing Shot', 'Arrow Burst', 'Hunter\'s Bolt'], wizard: ['Arcane Bolt', 'Arcane Burst', 'Fireball'], monk: ['Palm Strike', 'Spinning Kick', 'Rising Fist'], enchanter: ['Psychic Bolt', 'Mind Burst', 'Spirit Lance'], warrior: ['Shield Slam', 'Ground Pound', 'Sunder'], berserker: ['Skull Crack', 'Earthquake', 'Rending Sweep'], cleric: ['Smite', 'Holy Burst', 'Radiant Bolt'], bard: ['Sharp Note', 'Sonic Boom', 'Piercing Aria'],
  paladin: ['Judging Blow', 'Holy Shock', 'Sweep of Light'], shaman: ['Lightning Bolt', 'Thunder Burst', 'Chain Spark'], druid: ['Thorn Bolt', 'Nature\'s Wrath', 'Wrath'], necromancer: ['Shadow Bolt', 'Corpse Blast', 'Soul Spike'] };
const DMG_DESC = { strike: 'A heavy blow at the enemy in front of you: big damage and a short stun.', nova: 'A burst of force that hits every enemy around you.', cone: 'A sweeping attack that hits everything in front of you.', bolt: 'A bolt of energy that flies where you aim.' };
for (const [cls, trees] of Object.entries(CLASS_TREES)) {
  if (!ABILITIES[cls]) continue; let si = 0, di = 0;
  for (const T of trees) {
    const abs = T.nodes.filter(n => n.ab).map(n => ABILITIES[cls].find(a => a.id === n.ab));
    let sup = abs.filter(isSupport).length, dmg = abs.length - sup;
    const add = (def, kind) => {
      const id = `${cls}_x${kind}${kind === 's' ? si : di}`, maxLv = Math.max(...abs.map(a => a.level)), a = Object.assign({ id, key: '', icon: '', kit: true, campaign: true, level: Math.min(20, maxLv + 2) }, def); delete a.ic;
      if (kind === 'd') { const dn = [...(DMG_NAMES[cls] || ['Power Strike', 'Shockwave', 'Force Bolt']), T.name + ' Strike', T.name + ' Burst']; a.name = dn[di % dn.length]; a.desc = DMG_DESC[a.t]; }
      GEN_ICONS[id] = def.ic; ABILITIES[cls].push(a);
      // an empty spot on the tree grid, under whatever sits above it
      const taken = new Set(T.nodes.map(n => n.row + ',' + n.col)); let cell = null;
      for (let r = 1; r <= 5 && !cell; r++) for (const c of [0, 2, 1]) if (!taken.has(r + ',' + c) && !(r === 5 && c === 1)) { cell = [r, c]; break; }
      if (!cell) return; const above = T.nodes.filter(n => n.col === cell[1] && n.row < cell[0] && n.t !== 'ult').sort((x, y) => y.row - x.row)[0] || T.nodes[0];
      T.nodes.push({ id: `${T.id}_${id}`, t: 'ab', ab: id, row: cell[0], col: cell[1], req: above.id, name: a.name, icon: id, desc: a.desc, tree: T.id, max: 1 });
      abs.push(a);
    };
    while (sup < 3) { const tpl = SUP_T[si % SUP_T.length], n0 = SUP_NAMES[cls] || SUP_NAMES.warrior, n = [...n0, ...SUP_MORE.map(w => T.name + ' ' + w)]; add(tpl(n, !NO_HEAL.has(cls)), 's'); si++; sup++; }
    while (dmg < 2) { add(DMG_T(MELEE.has(cls), di, cls), 'd'); di++; dmg++; }
  }
  CLASS_TREE[cls] = trees.flatMap(T => T.nodes.map(n => { if (n.ab && !n.name) { const a = ABILITIES[cls].find(x => x.id === n.ab); n.name = a.name; n.icon = a.id; n.desc = a.desc; } n.tree = T.id; n.max = 1; return n; }));
}

// ---- layout: spread each tree's abilities across the grid (not all down the middle), passives in between,
// every node hanging from the one above it, the capstone at the bottom
const A_SLOTS = [[0, 1], [1, 0], [2, 2], [3, 0], [4, 1], [1, 2], [3, 2], [2, 0], [4, 2], [4, 0], [2, 1], [3, 1], [1, 1]];
const ALL_CELLS = []; for (let r = 1; r <= 4; r++) for (let c = 0; c < 3; c++) ALL_CELLS.push([r, c]); ALL_CELLS.push([5, 0], [5, 2], [0, 0], [0, 2]);
for (const [cls, trees] of Object.entries(CLASS_TREES)) for (const T of trees) {
  const ult = T.nodes.find(n => n.t === 'ult'), abs = T.nodes.filter(n => n.t === 'ab'), pas = T.nodes.filter(n => n.t === 'pas');
  const at = {}, key = (r, c) => r + ',' + c, put = (n, r, c) => { n.row = r; n.col = c; at[key(r, c)] = n; };
  abs.sort((x, y) => (ABILITIES[cls].find(a => a.id === x.ab) || {}).level - (ABILITIES[cls].find(a => a.id === y.ab) || {}).level);
  const freeA = A_SLOTS.filter(([r, c]) => true); let k = 0;
  for (const n of abs) { while (k < freeA.length && at[key(...freeA[k])]) k++; if (k >= freeA.length) break; put(n, ...freeA[k]); k++; }
  const placed = new Set(Object.values(at));
  // an ability's own upgrade goes right under it when there is room
  for (const n of pas) { if (!n.id.startsWith('a_')) continue; const owner = abs.find(x => 'a_' + x.ab === n.id); if (owner && placed.has(owner) && owner.row < 4 && !at[key(owner.row + 1, owner.col)]) { put(n, owner.row + 1, owner.col); placed.add(n); } }
  for (const n of pas) { if (placed.has(n)) continue; const cell = ALL_CELLS.find(([r, c]) => !at[key(r, c)]); if (!cell) continue; put(n, ...cell); placed.add(n); }
  if (ult) { ult.row = 5; ult.col = 1; delete ult.req; placed.add(ult); }
  T.nodes = T.nodes.filter(n => placed.has(n));
  for (const n of T.nodes) { if (n.t === 'ult') continue;
    const own = n.id.startsWith('a_') && abs.find(x => 'a_' + x.ab === n.id); if (own && own !== n) { n.req = own.id; continue; } // an upgrade needs its ability first
    if (n.row === 0) { if (n.col !== 1 && at[key(0, 1)]) n.req = at[key(0, 1)].id; else delete n.req; continue; }
    const up = at[key(n.row - 1, n.col)] || at[key(n.row - 1, 1)] || at[key(n.row - 1, n.col === 0 ? 2 : 0)] || at[key(0, 1)]; n.req = up && up !== n ? up.id : undefined; }
  // root stays free only for the class's starting ability
}
for (const [cls, trees] of Object.entries(CLASS_TREES)) CLASS_TREE[cls] = trees.flatMap(T => T.nodes);

// the campaign has no twin weapons in the main hand: each becomes its single version
export const TWIN_TO_SINGLE = { daggers: 'dagger', handaxes: 'axe', swordmace: 'sword' };
