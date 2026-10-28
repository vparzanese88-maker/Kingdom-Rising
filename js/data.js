// Kingdom Rising — game data: factions, races, classes, skills, spells, items, mobs, bosses, quests
(function () {
  const KR = (window.KR = window.KR || {});
  const D = (KR.D = {});
  D.TS = 32; // tile size in px
  // Levels. Heroes see levels 1-20 (monsters up to about 24), but every level stored in the game (c.level, e.level,
  // spell, skill, item and quest levels, mob and region ranges) is an internal power level on the old 1-50 scale,
  // so the combat, stat and reward formulas keep their balance. Show a level to the player with D.shown(level),
  // and turn a level the player sees into the stored one with D.LV(n). Heroes only ever stand on the 20 steps
  // D.LV(1..20) = 1, 4, 6, 9, 11 ... 47, 50, so requirements are kept on those steps too (D.snapLv).
  D.MAX_LEVEL = 50; // internal cap (shown as level 20)
  D.MAX_SHOWN = 20;
  D.LV = (n) => Math.round(1 + (Math.max(1, n) - 1) * 49 / 19);
  D.shown = (lv) => Math.max(1, Math.round(1 + ((lv || 1) - 1) * 19 / 49));
  D.snapLv = (lv) => D.LV(D.shown(lv));
  D.STATS = ['STR', 'STA', 'AGI', 'DEX', 'WIS', 'INT', 'CHA'];
  D.STAT_NAMES = { STR: 'Strength', STA: 'Stamina', AGI: 'Agility', DEX: 'Dexterity', WIS: 'Wisdom', INT: 'Intelligence', CHA: 'Charisma' };
  D.STAT_HELP = {
    STR: 'Melee and ranged damage (attack rating). Also feeds your endurance pool.',
    STA: 'Maximum hit points, plus endurance pool and endurance regeneration.',
    AGI: 'Armor class and avoidance: how often enemies miss you. Also feeds endurance.',
    DEX: 'Your chance to hit with weapons, weapon proc chance, and how fast weapon skills (and Block) improve. Also feeds endurance.',
    WIS: 'Mana pool for Clerics, Druids, Shamans, Paladins, Rangers and Beastlords. Raises the damage of your spells and the power of your heals.',
    INT: 'Mana pool for Wizards, Magicians, Enchanters, Necromancers, Shadow Knights and Bards. Raises the damage of your spells and the power of your heals.',
    CHA: 'Success of mez, charm, fear and lull spells (Enchanters, Bards), and better merchant prices.',
  };
  D.RESISTS = ['fire', 'cold', 'magic', 'poison', 'disease'];
  D.SCHOOLS = ['Evocation', 'Alteration', 'Conjuration', 'Abjuration', 'Divination', 'Song'];
  D.SCHOOL_HELP = {
    Evocation: 'Direct damage: bolts, shocks, storms',
    Alteration: 'Healing, haste, slows, roots, lifetaps',
    Conjuration: 'Damage over time, summoned pets',
    Abjuration: 'Protective wards, runes, damage shields',
    Divination: 'Mesmerize, fear, feign death, travel',
    Song: 'Bard songs and chants',
  };

  // ---------- Factions ----------
  D.FACTIONS = {
    sylvan: {
      id: 'sylvan', name: 'Sylvan Throne', city: 'Aelindor', king: 'King Theron Valen', kingFirst: 'Theron', brother: 'Aldric',
      races: ['human', 'highelf', 'woodelf', 'darkelf', 'gnome', 'halfling', 'dwarf', 'barbarian', 'ogrin'], color: '#8fd16f', banner: '#2e6a3c', trim: '#e7d48a',
      craftPrefix: 'Leafsteel', craftBias: ['AGI', 'WIS'], drink: 'Moonpetal Wine', food: 'honeyed acorn bread',
      blurb: 'The younger brother\'s kingdom. King Theron Valen was crowned in the elven city of Aelindor among the old forests, and every people of the realm has sworn to him there. Free, fierce, and certain the crown belongs to whoever deserves it.',
      enemyMobs: 'Orcs of the Greywood', crop: 'silverleaf berries',
    },
    iron: {
      id: 'iron', name: 'Ironhold Compact', city: 'Khar Duum', king: 'King Brandr Anvilheart',
      races: ['dwarf', 'gnome', 'barbarian'], color: '#e0a35a', banner: '#7a3e1c', trim: '#d9d9d9',
      craftPrefix: 'Runeforged', craftBias: ['STA', 'STR'], drink: 'Deepforge Stout', food: 'mushroom and mutton pie',
      blurb: 'Dwarves and gnomes of the mountain halls. They keep every grudge in a ledger and every ledger in stone.',
      enemyMobs: 'Goblins of Copperdeep', crop: 'cave barley',
    },
    crown: {
      id: 'crown', name: 'Crown of Valen', city: 'Valenmoor', king: 'King Aldric Valen', kingFirst: 'Aldric', brother: 'Theron',
      races: ['human', 'highelf', 'woodelf', 'darkelf', 'gnome', 'halfling', 'dwarf', 'barbarian', 'ogrin'], color: '#7fb0e8', banner: '#28457a', trim: '#f0c75e',
      craftPrefix: 'Valenguard', craftBias: ['DEX', 'CHA'], drink: 'Valen Gold Ale', food: 'roast pheasant',
      blurb: 'The firstborn\'s kingdom. King Aldric Valen holds the old capital of Valenmoor on the western plains, and every people of the realm has sworn to him there too. Proud, disciplined, and certain the crown is his by right.',
      enemyMobs: 'Bandits of Thornfield', crop: 'golden wheat',
    },
  };
  D.FACTION_IDS = ['sylvan', 'crown'];

  // ---------- Races ----------
  D.RACES = {
    highelf: { id: 'highelf', name: 'High Elf', faction: 'sylvan', scale: 1.06, width: 0.92,
      stats: { STR: 55, STA: 70, AGI: 85, DEX: 70, WIS: 95, INT: 92, CHA: 80 },
      classes: ['cleric', 'paladin', 'wizard', 'magician', 'enchanter'], weaponPref: ['1HS', '1HP', '2HB'], adj: 'Silvered',
      desc: 'Tall scholars of Aelindor. The best natural casters in the land.', ears: 'long' },
    woodelf: { id: 'woodelf', name: 'Wood Elf', faction: 'sylvan', scale: 0.98, width: 0.92,
      stats: { STR: 65, STA: 65, AGI: 95, DEX: 80, WIS: 80, INT: 75, CHA: 75 },
      classes: ['warrior', 'ranger', 'druid', 'bard', 'rogue', 'beastlord', 'monk'], weaponPref: ['1HS', '1HP', 'ARC'], adj: 'Woodland',
      desc: 'Quick, sharp-eyed hunters of the canopy.', ears: 'long' },
    dwarf: { id: 'dwarf', name: 'Dwarf', faction: 'crown', scale: 0.8, width: 1.22,
      stats: { STR: 90, STA: 90, AGI: 70, DEX: 90, WIS: 83, INT: 60, CHA: 45 },
      classes: ['warrior', 'cleric', 'paladin', 'rogue', 'berserker', 'shaman'], weaponPref: ['2HS', '1HB', '1HS'], adj: 'Dwarven',
      desc: 'Stout, stubborn and nearly impossible to knock down.', beard: true },
    gnome: { id: 'gnome', name: 'Gnome', faction: 'crown', scale: 0.7, width: 0.95,
      stats: { STR: 60, STA: 70, AGI: 85, DEX: 85, WIS: 67, INT: 98, CHA: 60 },
      classes: ['warrior', 'cleric', 'paladin', 'shadowknight', 'rogue', 'necromancer', 'wizard', 'magician', 'enchanter'], weaponPref: ['1HB', '1HP', '1HS'], adj: 'Gnomish',
      desc: 'Brilliant tinkerers with the sharpest minds under the mountain.', nose: true },
    human: { id: 'human', name: 'Human', faction: 'crown', factions: ['crown', 'sylvan'], scale: 1.0, width: 1.0,
      stats: { STR: 75, STA: 75, AGI: 75, DEX: 75, WIS: 75, INT: 75, CHA: 75 },
      classes: ['warrior', 'cleric', 'paladin', 'ranger', 'shadowknight', 'druid', 'monk', 'bard', 'rogue', 'necromancer', 'wizard', 'magician', 'enchanter', 'berserker'], weaponPref: ['1HS', '2HS', '1HB'], adj: 'Militia',
      desc: 'Adaptable and ambitious. Every path is open to them.' },
    halfling: { id: 'halfling', name: 'Halfling', faction: 'crown', scale: 0.72, width: 1.05,
      stats: { STR: 70, STA: 75, AGI: 95, DEX: 90, WIS: 80, INT: 67, CHA: 50 },
      classes: ['warrior', 'cleric', 'paladin', 'ranger', 'druid', 'rogue', 'shaman'], weaponPref: ['1HP', '1HS', '1HB'], adj: 'Halfling',
      desc: 'Small, nimble, lucky, and always hungry.', barefoot: true },
    halfelf: { id: 'halfelf', name: 'Half Elf', faction: 'sylvan', scale: 1.0, width: 0.96,
      stats: { STR: 70, STA: 70, AGI: 90, DEX: 85, WIS: 60, INT: 75, CHA: 75 },
      classes: ['warrior', 'paladin', 'ranger', 'druid', 'bard', 'rogue', 'monk'], weaponPref: ['1HS', '1HP', 'ARC'], adj: 'Wayfarer',
      desc: 'Children of two peoples, welcome in the forest and on the road. Versatile and quick.', ears: 'half' },
    barbarian: { id: 'barbarian', name: 'Barbarian', faction: 'crown', scale: 1.14, width: 1.18,
      stats: { STR: 103, STA: 95, AGI: 82, DEX: 70, WIS: 70, INT: 60, CHA: 55 },
      classes: ['warrior', 'rogue', 'shaman', 'beastlord', 'berserker'], weaponPref: ['2HS', '2HB', '1HS'], adj: 'Northman',
      desc: 'Towering clansmen of the frozen north who sell their axes to whichever brother earns their respect. The strongest of the humans.', beard: true },
    darkelf: { id: 'darkelf', name: 'Dark Elf', faction: 'sylvan', scale: 0.98, width: 0.9,
      stats: { STR: 60, STA: 65, AGI: 90, DEX: 75, WIS: 83, INT: 99, CHA: 60 },
      classes: ['warrior', 'cleric', 'shadowknight', 'rogue', 'necromancer', 'wizard', 'magician', 'enchanter'], weaponPref: ['1HP', '1HS', '2HB'], adj: 'Shadowed',
      desc: 'Exiles from the deep caverns, back on the surface in a time of war. Cunning, cold, and brilliant with dark magic.', ears: 'long',
      skins: ['#7a7498', '#666088', '#545078', '#423e64', '#33304e'], hairDefault: 4 },
    erudite: { id: 'erudite', name: 'Erudite', faction: 'crown', scale: 1.02, width: 0.95,
      stats: { STR: 60, STA: 70, AGI: 70, DEX: 70, WIS: 83, INT: 107, CHA: 70 },
      classes: ['cleric', 'paladin', 'shadowknight', 'necromancer', 'wizard', 'magician', 'enchanter'], weaponPref: ['1HB', '2HB', '1HP'], adj: 'Scholar\'s',
      desc: 'Scholars of the Valen academies with minds sharper than any blade. The greatest natural intellect.', headR: 7.9 },
    highlander: { id: 'highlander', name: 'Highlander', faction: 'crown', scale: 1.07, width: 1.08,
      stats: { STR: 88, STA: 88, AGI: 80, DEX: 78, WIS: 72, INT: 65, CHA: 72 },
      classes: ['warrior', 'paladin', 'ranger', 'druid', 'bard', 'rogue', 'shaman', 'berserker'], weaponPref: ['2HS', '1HS', 'ARC'], adj: 'Clansman\'s',
      desc: 'Red-haired hill clans of the Valen highlands, sworn to the firstborn since the first king. Tough, proud and fond of a song.', beard: true, hairDefault: 4,
      skins: ['#f6d8c0', '#efc8a8', '#e2b090', '#c89068', '#a87048'] },
    ogrin: { id: 'ogrin', name: 'Ogre', faction: 'crown', scale: 1.22, width: 1.32,
      stats: { STR: 110, STA: 102, AGI: 60, DEX: 60, WIS: 58, INT: 45, CHA: 40 },
      classes: ['warrior', 'shadowknight', 'shaman', 'berserker', 'beastlord'], weaponPref: ['2HB', '2HS', '1HB'], adj: 'Ogre',
      desc: 'Hulking hill ogres who came down from the crags to fight for coin and glory. Huge, slow to anger, and terrible when angered.', tusk: true,
      skins: ['#9aa08a', '#8a9478', '#7a8468', '#9a8a70', '#6a7458'] },
    seaelf: { id: 'seaelf', name: 'Sea Elf', faction: 'sylvan', scale: 1.0, width: 0.9,
      stats: { STR: 60, STA: 68, AGI: 92, DEX: 82, WIS: 88, INT: 84, CHA: 82 },
      classes: ['cleric', 'ranger', 'druid', 'bard', 'rogue', 'monk', 'shaman', 'enchanter'], weaponPref: ['1HP', 'ARC', '1HS'], adj: 'Tidewrought',
      desc: 'Harbour elves of the northern coast who sail Aelindor\'s ships. Graceful, quick and at home on the water.', ears: 'long', hairDefault: 6,
      skins: ['#b8d8d8', '#a0c8cc', '#88b4bc', '#6a9aa8', '#4f7c8c'] },
    firbolg: { id: 'firbolg', name: 'Firbolg', faction: 'sylvan', scale: 1.24, width: 1.24,
      stats: { STR: 100, STA: 98, AGI: 62, DEX: 60, WIS: 96, INT: 60, CHA: 66 },
      classes: ['warrior', 'cleric', 'paladin', 'druid', 'shaman', 'beastlord'], weaponPref: ['2HB', '2HS', '1HB'], adj: 'Grovewarden',
      desc: 'Gentle giants of the deep forest who guard the great trees. Slow to fight, but nothing moves them once they do.', beard: true, ears: 'half',
      skins: ['#9aa6b8', '#8a98ac', '#7a889c', '#a8a0b0', '#6a7890'] },
  };

  // the races a new hero can be. Any of them may pledge to either kingdom; the others only remain for heroes made before
  D.RACE_IDS = ['human', 'highelf', 'woodelf', 'darkelf', 'gnome', 'halfling', 'dwarf', 'barbarian', 'ogrin'];
  for (const id in D.RACES) { D.RACES[id].factions = D.FACTION_IDS.slice(); if (!D.RACE_IDS.includes(id)) D.RACES[id].legacy = true; }

  // ---------- Weapon types ----------
  D.WEAPON_TYPES = {
    '1HS': { name: '1H Slashing', delay: 2.4, mul: 1.0, hands: 1, sfx: 'slash', ranged: false },
    '2HS': { name: '2H Slashing', delay: 3.6, mul: 1.28, hands: 2, sfx: 'slash', ranged: false },
    '1HB': { name: '1H Blunt', delay: 2.6, mul: 1.0, hands: 1, sfx: 'blunt', ranged: false },
    '2HB': { name: '2H Blunt', delay: 3.6, mul: 1.25, hands: 2, sfx: 'blunt', ranged: false },
    '1HP': { name: '1H Piercing', delay: 1.9, mul: 0.98, hands: 1, sfx: 'pierce', ranged: false },
    'H2H': { name: 'Hand to Hand', delay: 1.8, mul: 0.95, hands: 1, sfx: 'punch', ranged: false },
    'ARC': { name: 'Archery', delay: 3.0, mul: 1.1, hands: 2, sfx: 'bow', ranged: true, range: 520 },
    'THR': { name: 'Throwing', delay: 2.2, mul: 0.95, hands: 1, sfx: 'throw', ranged: true, range: 400 },
    'TOME': { name: 'Magic Tome', delay: 2.8, mul: 0.9, hands: 1, sfx: 'magicbolt', ranged: true, range: 460 },
    // black powder (Valenmoor's Arquebusiers): slow to reload, heavy hits, long range
    'GUN': { name: 'Firearms', delay: 3.8, mul: 1.4, hands: 2, sfx: 'heavy', ranged: true, range: 560 },
  };
  D.WEAPON_BASES = {
    '1HS': ['Short Sword', 'Longsword', 'Broadsword', 'Bastard Sword', 'Runeblade', 'Kingsblade'],
    '2HS': ['Battle Axe', 'Greataxe', 'Greatsword', 'Claymore', 'Executioner', 'Dragonslayer'],
    '1HB': ['Club', 'Mace', 'Morning Star', 'Warhammer', 'Flanged Mace', 'Sunhammer'],
    '2HB': ['Quarterstaff', 'Maul', 'Great Hammer', 'Warstaff', 'Titan Maul', 'Starfall Staff'],
    '1HP': ['Dagger', 'Dirk', 'Stiletto', 'Rapier', 'Kris', 'Fang of Shadows'],
    'H2H': ['Hand Wraps', 'Cestus', 'Iron Knuckles', 'Fist Blades', 'Tiger Claws', 'Dragon Fists'],
    'ARC': ['Short Bow', 'Hunting Bow', 'Recurve Bow', 'Longbow', 'Composite Bow', 'Starwood Bow'],
    'THR': ['Throwing Knives', 'Throwing Axes', 'Shuriken', 'Hurlbats', 'Chakrams', 'Starblades'],
    'TOME': ["Apprentice's Tome", 'Codex', 'Grimoire', 'Arcane Folio', 'Tome of Ages', 'Starbound Codex'],
    'GUN': ['Matchlock Arquebus', 'Wheellock Arquebus', 'Long Arquebus', 'Caliver', 'Royal Arquebus', 'Valen Thunderlock'],
  };
  D.ARMOR_KINDS = ['plate', 'chain', 'leather', 'cloth'];
  D.ARMOR_RANK = { cloth: 0, leather: 1, chain: 2, plate: 3 };
  D.ARMOR_SLOTS = ['head', 'chest', 'hands', 'legs', 'feet'];
  D.ARMOR_BASES = {
    plate: { head: 'Helm', chest: 'Breastplate', hands: 'Gauntlets', legs: 'Greaves', feet: 'Sabatons' },
    chain: { head: 'Coif', chest: 'Hauberk', hands: 'Mitts', legs: 'Chain Leggings', feet: 'Chain Boots' },
    leather: { head: 'Cap', chest: 'Tunic', hands: 'Gloves', legs: 'Leather Pants', feet: 'Boots' },
    cloth: { head: 'Hood', chest: 'Robe', hands: 'Silk Gloves', legs: 'Pantaloons', feet: 'Sandals' },
  };
  D.SLOT_AC = { head: 0.8, chest: 1.5, hands: 0.6, legs: 1.1, feet: 0.6, secondary: 1.2 };
  D.KIND_AC = { plate: 1.0, chain: 0.8, leather: 0.62, cloth: 0.42 };
  D.TIER_ADJ = ['Crude', 'Fine', 'Sturdy', 'Masterwork', 'Exalted', 'Mythic'];
  D.EQUIP_SLOTS = ['head', 'neck', 'back', 'chest', 'hands', 'waist', 'legs', 'feet', 'ring', 'primary', 'secondary', 'range'];
  D.SLOT_NAMES = { head: 'Head', neck: 'Neck', back: 'Cape', chest: 'Chest', hands: 'Hands', waist: 'Belt', legs: 'Legs', feet: 'Feet', ring: 'Ring', primary: 'Primary', secondary: 'Secondary', range: 'Range' };

  // ---------- Classes ----------
  // role: melee (no spells), hybrid (25 spells), caster (50 spells)
  D.CLASSES = {
    warrior: { name: 'Warrior', role: 'melee', armor: 'plate', hpMul: 1.38, manaStat: null, weapons: ['1HS', '2HS', '1HB', '2HB', '1HP', 'H2H'], ranged: ['ARC', 'THR'], shield: true, dual: true,
      color: '#a8382c', trim: '#c9ccd1', desc: 'The wall between danger and everyone else. Highest health, best armor, taunts enemies away from allies.',
      skills: [['kick', 1], ['taunt', 1], ['bash', 5], ['doubleattack', 10], ['dualwield', 13], ['disarm', 20], ['defensive', 30], ['tripleattack', 35], ['rampage', 45], ['warcry', 8], ['shieldbreak', 24], ['furyofthelast', 40]] },
    paladin: { name: 'Paladin', role: 'hybrid', armor: 'plate', hpMul: 1.25, manaStat: 'WIS', weapons: ['1HS', '2HS', '1HB', '2HB', '1HP'], ranged: [], shield: true,
      color: '#e9e3cf', trim: '#d4a63a', desc: 'Holy knight. Heals, stuns and smites the undead while wearing heavy plate.',
      skills: [['bash', 1], ['taunt', 1], ['layonhands', 1], ['meditation', 1], ['doubleattack', 20], ['tripleattack', 46]] },
    shadowknight: { name: 'Shadow Knight', role: 'hybrid', armor: 'plate', hpMul: 1.25, manaStat: 'INT', weapons: ['1HS', '2HS', '1HB', '2HB', '1HP'], ranged: [], shield: true,
      color: '#2a2233', trim: '#8b4ab8', desc: 'Dark knight who steals life, raises undead servants and strikes fear.',
      skills: [['bash', 1], ['taunt', 1], ['harmtouch', 1], ['meditation', 1], ['doubleattack', 20], ['tripleattack', 46]] },
    ranger: { name: 'Ranger', role: 'hybrid', armor: 'chain', hpMul: 1.18, manaStat: 'WIS', weapons: ['1HS', '2HS', '1HP', '1HB'], ranged: ['ARC', 'THR'], dual: true,
      color: '#3f6b35', trim: '#8a6a3a', desc: 'Woodland hunter. Deadly with a bow, can root, snare and heal in the wild.',
      skills: [['kick', 1], ['meditation', 1], ['dualwield', 13], ['doubleattack', 20], ['trueshot', 30], ['tripleattack', 46]] },
    bard: { name: 'Bard', role: 'hybrid', armor: 'plate', hpMul: 1.15, manaStat: 'INT', weapons: ['1HS', '1HP', '1HB', 'H2H'], ranged: ['THR', 'ARC'], dual: true,
      color: '#b8462e', trim: '#e3c04a', desc: 'Wandering minstrel. Songs speed allies, restore mana, and lull enemies to sleep.',
      skills: [['kick', 1], ['meditation', 1], ['dualwield', 13], ['doubleattack', 25], ['fading', 30]] },
    beastlord: { name: 'Beastlord', role: 'hybrid', armor: 'leather', hpMul: 1.2, manaStat: 'WIS', weapons: ['H2H', '1HB', '2HB', '1HP'], ranged: ['THR'], dual: true,
      color: '#7a5532', trim: '#c46b2c', desc: 'Fights side by side with a spirit-bound beast companion.',
      skills: [['kick', 1], ['meditation', 1], ['dualwield', 13], ['doubleattack', 20], ['feral', 30], ['tripleattack', 46]] },
    rogue: { name: 'Rogue', role: 'melee', armor: 'chain', hpMul: 1.15, manaStat: null, weapons: ['1HS', '1HP', '1HB', 'H2H'], ranged: ['ARC', 'THR'], dual: true,
      color: '#2d3436', trim: '#7d8a8c', desc: 'Strikes from behind with devastating backstabs and slips away from danger.',
      skills: [['backstab', 1], ['evade', 1], ['hide', 5], ['doubleattack', 12], ['dualwield', 13], ['garrote', 20], ['assassinate', 30], ['tripleattack', 40], ['deadlystrike', 45], ['cripplingstrike', 8], ['poisonblade', 25], ['shadowstep', 38]] },
    monk: { name: 'Monk', role: 'melee', armor: 'leather', hpMul: 1.2, manaStat: null, weapons: ['H2H', '1HB', '2HB'], ranged: ['THR'], dual: true,
      color: '#d9822b', trim: '#3a3a3a', desc: 'Martial artist. Lightning fists, flying kicks and the art of feigning death.',
      skills: [['roundkick', 1], ['mend', 1], ['tigerclaw', 5], ['doubleattack', 10], ['dualwield', 13], ['feigndeath', 17], ['eaglestrike', 20], ['flyingkick', 30], ['tripleattack', 35], ['dragonpunch', 45], ['craneKick', 7], ['innerpeace', 24], ['stonefist', 42]] },
    berserker: { name: 'Berserker', role: 'melee', armor: 'chain', hpMul: 1.3, manaStat: null, weapons: ['2HS', '2HB', '1HS', '1HB'], ranged: ['THR'], dual: true,
      color: '#8c2f1e', trim: '#b88a5a', desc: 'Rage-fueled fighter swinging huge axes, hitting harder the angrier they get.',
      skills: [['frenzy', 1], ['kick', 1], ['doubleattack', 10], ['ragevolley', 12], ['dualwield', 13], ['cleavingrage', 20], ['bloodfrenzy', 30], ['tripleattack', 35], ['bloodlust', 45], ['berserkstomp', 8], ['axethrow', 26], ['unbridledrage', 40]] },
    cleric: { name: 'Cleric', role: 'caster', armor: 'plate', hpMul: 1.0, manaStat: 'WIS', weapons: ['1HB', '2HB'], ranged: ['TOME'], shield: true,
      color: '#f1efe6', trim: '#4f7cc4', desc: 'The finest healer alive. Wards allies, banishes the undead.',
      skills: [['meditation', 1], ['channeling', 10], ['divineaura', 22], ['arcanesurge', 40]] },
    druid: { name: 'Druid', role: 'caster', armor: 'leather', hpMul: 0.95, manaStat: 'WIS', weapons: ['1HS', '1HB', '2HB'], ranged: ['TOME'], shield: true,
      color: '#4e7d2f', trim: '#a37a3a', desc: 'Keeper of nature. Fire and storms, thorny shields, healing and fast travel.',
      skills: [['meditation', 1], ['channeling', 10], ['communion', 22], ['arcanesurge', 40]] },
    shaman: { name: 'Shaman', role: 'caster', armor: 'chain', hpMul: 1.0, manaStat: 'WIS', weapons: ['1HB', '2HB', '1HP', 'H2H'], ranged: ['TOME'], shield: true,
      color: '#2d7b78', trim: '#d8c49a', desc: 'Spirit caller. Slows enemies, poisons them, and empowers allies.',
      skills: [['meditation', 1], ['channeling', 10], ['cannibalize', 15], ['arcanesurge', 40]] },
    necromancer: { name: 'Necromancer', role: 'caster', armor: 'cloth', hpMul: 0.8, manaStat: 'INT', weapons: ['1HP', '2HB'], ranged: ['TOME'],
      color: '#1d1a22', trim: '#79c26b', desc: 'Master of the dead. Rots foes from within and raises skeletal servants.',
      skills: [['meditation', 1], ['channeling', 10], ['darkcommunion', 22], ['arcanesurge', 40]] },
    wizard: { name: 'Wizard', role: 'caster', armor: 'cloth', hpMul: 0.78, manaStat: 'INT', weapons: ['1HP', '2HB'], ranged: ['TOME'],
      color: '#2b4fa3', trim: '#e2c55a', desc: 'Pure destruction. The biggest single hits and the biggest storms.',
      skills: [['meditation', 1], ['channeling', 10], ['harvest', 22], ['arcanesurge', 40]] },
    magician: { name: 'Magician', role: 'caster', armor: 'cloth', hpMul: 0.8, manaStat: 'INT', weapons: ['1HP', '2HB'], ranged: ['TOME'],
      color: '#b03a2e', trim: '#f1a73b', desc: 'Summons elementals to fight for them and hurls fire and blades.',
      skills: [['meditation', 1], ['channeling', 10], ['conversion', 22], ['arcanesurge', 40]] },
    enchanter: { name: 'Enchanter', role: 'caster', armor: 'cloth', hpMul: 0.78, manaStat: 'INT', weapons: ['1HP', '2HB'], ranged: ['TOME'],
      color: '#6a3fa0', trim: '#e0b7ff', desc: 'Mind mage. Mesmerizes, slows, hastes and shields with runes.',
      skills: [['meditation', 1], ['channeling', 10], ['mindovermatter', 22], ['arcanesurge', 40]] },
    // ---- the kingdoms' own classes: only heroes pledged to that kingdom can take them (only: faction) ----
    arquebusier: { name: 'Arquebusier', role: 'melee', armor: 'chain', hpMul: 1.12, manaStat: null, weapons: ['1HS', '1HP'], ranged: ['GUN'], only: 'crown',
      color: '#5a3a24', trim: '#c8a040', desc: 'Valenmoor\'s black-powder marksman. A long matchlock arquebus, a bayonet, powder charges and smoke: every shot hits like a hammer, and each one takes a moment to reload.',
      skills: [] },
    trollcaller: { name: 'Trollcaller', role: 'hybrid', armor: 'leather', hpMul: 1.1, manaStat: 'WIS', weapons: ['2HB', '1HB', '1HP'], ranged: ['THR'], only: 'sylvan',
      color: '#4a6a2a', trim: '#9ac86a', desc: 'An elven shaman-warrior of Aelindor bound to a young forest troll. The troll takes the blows at the front; you lash with thorns, bind with roots and mend with moss.',
      skills: [] },
  };
  D.CLASS_IDS = Object.keys(D.CLASSES);
  // a kingdom's own class, if any (D.CLASSES[cls].only)
  D.SPECIAL_CLASS = { crown: 'arquebusier', sylvan: 'trollcaller' };
  D.classOpen = (cls, faction) => !D.CLASSES[cls].only || D.CLASSES[cls].only === faction;
  // any race may answer its kingdom's own calling
  for (const r in D.RACES) for (const k of ['arquebusier', 'trollcaller']) if (!D.RACES[r].classes.includes(k)) D.RACES[r].classes.push(k);
  D.ARMOR_ALLOWED = (cls) => {
    const k = D.CLASSES[cls].armor;
    return D.ARMOR_KINDS.filter((a) => D.ARMOR_RANK[a] <= D.ARMOR_RANK[k]);
  };

  // ---------- Effects helpers ----------
  // Effects: {t:'hit', amt}, {t:'wdmg', mult}, {t:'rdmg', mult}, {t:'dmg', amt, res}, {t:'dot', amt, dur, res}, {t:'heal', amt}, {t:'hot', amt, dur},
  // {t:'buff', mods, dur}, {t:'debuff', mods, dur}, {t:'stun', dur}, {t:'root', dur}, {t:'snare', pct, dur}, {t:'mez', dur}, {t:'fear', dur}, {t:'rune', amt, dur},
  // {t:'tap', amt, res}, {t:'pet', kind, lv}, {t:'taunt'}, {t:'dropaggro', pct}, {t:'fd'}, {t:'mana', pct}, {t:'gate'}, {t:'lunge'}, {t:'multi', n, mult, ranged}, {t:'execute', mult}
  // target: enemy | self | ally | pbae | tae | pet ; scale: 'lvl' means amounts are multiplied per caster level at use time.

  // ---------- Class skills (non-spell abilities) ----------
  D.SKILLS = {
    kick: { name: 'Kick', icon: '🦶', cd: 6, range: 'melee', target: 'enemy', effects: [{ t: 'hit', amt: [4, 1.7] }], sfx: 'blunt', desc: 'A quick kick that deals extra damage.' },
    taunt: { name: 'Taunt', icon: '📣', cd: 6, range: 'melee', target: 'enemy', effects: [{ t: 'taunt' }], sfx: 'taunt', desc: 'Forces your target to attack you.' },
    bash: { name: 'Bash', icon: '🛡', cd: 12, range: 'melee', target: 'enemy', effects: [{ t: 'hit', amt: [3, 1.2] }, { t: 'stun', dur: 1.2 }], sfx: 'blunt', desc: 'Slam your target, interrupting casts and stunning briefly.' },
    doubleattack: { name: 'Double Attack', icon: '⚔', passive: true, desc: 'Chance to swing twice each round. Chance grows with level.' },
    tripleattack: { name: 'Triple Attack', icon: '⚔', passive: true, desc: 'Chance to swing a third time each round.' },
    dualwield: { name: 'Dual Wield', icon: '🗡', passive: true, desc: 'Lets you attack with a one-handed weapon in your secondary hand.' },
    meditation: { name: 'Meditation', icon: '🧘', passive: true, desc: 'Regain mana faster, much faster while sitting (X).' },
    channeling: { name: 'Channeling', icon: '🌀', passive: true, desc: 'Damage is less likely to interrupt your spell casting.' },
    disarm: { name: 'Disarm', icon: '✋', cd: 25, range: 'melee', target: 'enemy', effects: [{ t: 'debuff', mods: { dmgMul: -0.3 }, dur: 12, name: 'Disarmed' }], sfx: 'blunt', desc: 'Knock the weapon away, reducing its damage by 30% for 12s.' },
    defensive: { name: 'Defensive Stance', icon: '🏰', cd: 120, target: 'self', effects: [{ t: 'buff', mods: { acMul: 0.6, dmgTaken: -0.35 }, dur: 20, name: 'Defensive Stance' }], sfx: 'buff', desc: 'Take 35% less damage for 20 seconds.' },
    rampage: { name: 'Rampage', icon: '🌪', cd: 30, target: 'pbae', radius: 110, effects: [{ t: 'wdmg', mult: 1.3 }], sfx: 'whirl', desc: 'Strike every enemy around you.' },
    backstab: { name: 'Backstab', icon: '🔪', cd: 6, range: 'melee', target: 'enemy', effects: [{ t: 'wdmg', mult: 2.0, backMult: 2.0 }], sfx: 'pierce', desc: 'Huge damage, doubled again when the enemy is not fighting you.' },
    evade: { name: 'Evade', icon: '💨', cd: 12, target: 'self', effects: [{ t: 'dropaggro', pct: 0.5 }], sfx: 'whoosh', desc: 'Lower your hate on your target by half.' },
    hide: { name: 'Hide', icon: '🌑', cd: 60, target: 'self', effects: [{ t: 'dropaggro', pct: 1 }], sfx: 'whoosh', desc: 'Vanish from every enemy hate list. Stops your auto attack so you stay hidden.' },
    garrote: { name: 'Garrote', icon: '🪢', cd: 30, range: 'melee', target: 'enemy', effects: [{ t: 'stun', dur: 3 }, { t: 'dot', amt: [2, 1.2], dur: 9 }], sfx: 'pierce', desc: 'Choke the target, stunning for 3s and bleeding it.' },
    assassinate: { name: 'Assassinate', icon: '☠', cd: 30, range: 'melee', target: 'enemy', effects: [{ t: 'execute', mult: 1.6, below: 0.3, bonus: 2.4 }], sfx: 'pierce', desc: 'Massive damage against wounded targets.' },
    deadlystrike: { name: 'Deadly Strike', icon: '💀', cd: 60, range: 'melee', target: 'enemy', effects: [{ t: 'wdmg', mult: 4.0 }], sfx: 'pierce', desc: 'Your deadliest single blow.' },
    roundkick: { name: 'Round Kick', icon: '🦶', cd: 6, range: 'melee', target: 'enemy', effects: [{ t: 'hit', amt: [5, 2.0] }], sfx: 'punch', desc: 'Spinning kick.' },
    mend: { name: 'Mend', icon: '❤', cd: 120, target: 'self', effects: [{ t: 'healpct', pct: 0.3 }], sfx: 'heal', desc: 'Heal 30% of your health.' },
    tigerclaw: { name: 'Tiger Claw', icon: '🐯', cd: 8, range: 'melee', target: 'enemy', effects: [{ t: 'hit', amt: [6, 2.2] }], sfx: 'slash', desc: 'Raking claw strike.' },
    feigndeath: { name: 'Feign Death', icon: '⚰', cd: 30, target: 'self', effects: [{ t: 'fd' }], sfx: 'death', desc: 'Drop to the ground. Enemies forget you.' },
    eaglestrike: { name: 'Eagle Strike', icon: '🦅', cd: 10, range: 'melee', target: 'enemy', effects: [{ t: 'hit', amt: [8, 2.6] }], sfx: 'punch', desc: 'Precise strike from above.' },
    flyingkick: { name: 'Flying Kick', icon: '🥋', cd: 10, range: 260, target: 'enemy', effects: [{ t: 'lunge' }, { t: 'hit', amt: [10, 3.2] }], sfx: 'punch', desc: 'Leap at a distant enemy feet first.' },
    dragonpunch: { name: 'Dragon Punch', icon: '🐉', cd: 18, range: 'melee', target: 'enemy', effects: [{ t: 'hit', amt: [14, 4.4] }, { t: 'stun', dur: 1.5 }], sfx: 'punch', desc: 'Explosive punch that stuns.' },
    frenzy: { name: 'Frenzy', icon: '😡', cd: 10, range: 'melee', target: 'enemy', effects: [{ t: 'wdmg', mult: 1.6 }], sfx: 'slash', desc: 'A furious overhead swing.' },
    ragevolley: { name: 'Rage Volley', icon: '🪓', cd: 12, range: 380, target: 'enemy', effects: [{ t: 'hit', amt: [6, 2.0], ranged: true }], sfx: 'throw', desc: 'Hurl an axe at range.' },
    cleavingrage: { name: 'Cleaving Rage', icon: '🔥', cd: 60, target: 'self', effects: [{ t: 'buff', mods: { dmgMul: 0.25 }, dur: 18, name: 'Cleaving Rage' }], sfx: 'buff', desc: '+25% damage for 18 seconds.' },
    bloodfrenzy: { name: 'Blood Frenzy', icon: '🩸', cd: 25, range: 'melee', target: 'enemy', effects: [{ t: 'multi', n: 4, mult: 0.85 }], sfx: 'slash', desc: 'Four savage blows.' },
    bloodlust: { name: 'Bloodlust', icon: '💢', cd: 120, target: 'self', effects: [{ t: 'buff', mods: { haste: 0.35, dmgMul: 0.15 }, dur: 30, name: 'Bloodlust' }], sfx: 'buff', desc: '35% faster attacks for 30 seconds.' },
    layonhands: { name: 'Lay on Hands', icon: '✋', cd: 900, target: 'ally', effects: [{ t: 'healpct', pct: 1.0 }], sfx: 'heal', desc: 'Fully heal yourself or a friend. Long cooldown.' },
    harmtouch: { name: 'Harm Touch', icon: '🖐', cd: 900, range: 'melee', target: 'enemy', effects: [{ t: 'dmg', amt: [30, 13], res: 'disease' }], sfx: 'dark', desc: 'Unleash a burst of death energy. Long cooldown.' },
    trueshot: { name: 'Trueshot', icon: '🎯', cd: 120, target: 'self', effects: [{ t: 'buff', mods: { rangedMul: 0.5 }, dur: 25, name: 'Trueshot' }], sfx: 'buff', desc: '+50% ranged damage for 25 seconds.' },
    fading: { name: 'Fading Memories', icon: '🎶', cd: 45, target: 'self', effects: [{ t: 'dropaggro', pct: 1 }], sfx: 'song', desc: 'Enemies forget about you.' },
    feral: { name: 'Feral Swipe', icon: '🐾', cd: 10, range: 'melee', target: 'enemy', effects: [{ t: 'hit', amt: [8, 2.5] }], sfx: 'slash', desc: 'Strike alongside your warder.' },
    divineaura: { name: 'Divine Aura', icon: '✨', cd: 600, target: 'self', effects: [{ t: 'buff', mods: { invuln: 1 }, dur: 8, name: 'Divine Aura' }], sfx: 'heal', desc: 'Become invulnerable for 8 seconds.' },
    harvest: { name: 'Harvest', icon: '💠', cd: 600, target: 'self', effects: [{ t: 'mana', pct: 0.3 }], sfx: 'buff', desc: 'Restore 30% of your mana.' },
    communion: { name: 'Communion', icon: '🍃', cd: 600, target: 'self', effects: [{ t: 'mana', pct: 0.3 }], sfx: 'buff', desc: 'Draw 30% of your mana from the earth.' },
    darkcommunion: { name: 'Dark Communion', icon: '🕯', cd: 600, target: 'self', effects: [{ t: 'mana', pct: 0.3 }], sfx: 'dark', desc: 'Restore 30% of your mana.' },
    conversion: { name: 'Elemental Conversion', icon: '🔮', cd: 600, target: 'self', effects: [{ t: 'mana', pct: 0.3 }], sfx: 'buff', desc: 'Restore 30% of your mana.' },
    mindovermatter: { name: 'Mind over Matter', icon: '🧠', cd: 600, target: 'self', effects: [{ t: 'mana', pct: 0.3 }], sfx: 'buff', desc: 'Restore 30% of your mana.' },
    cannibalize: { name: 'Cannibalize', icon: '🩸', cd: 8, target: 'self', effects: [{ t: 'cannibal' }], sfx: 'dark', desc: 'Turn some health into mana.' },
    arcanesurge: { name: 'Arcane Surge', icon: '⚡', cd: 180, target: 'self', effects: [{ t: 'buff', mods: { spellMul: 0.3 }, dur: 20, name: 'Arcane Surge' }], sfx: 'buff', desc: '+30% spell damage and healing for 20 seconds.' },
    // new melee class abilities
    warcry: { name: 'War Cry', icon: '📯', cd: 60, target: 'self', effects: [{ t: 'buff', mods: { dmgMul: 0.15, ac: 30 }, dur: 30, name: 'War Cry' }], sfx: 'taunt', desc: 'A roar that steels you for battle: +15% damage and armor.' },
    shieldbreak: { name: 'Sundering Blow', icon: '🔨', cd: 18, range: 'melee', target: 'enemy', effects: [{ t: 'wdmg', mult: 1.4 }, { t: 'debuff', mods: { acMul: -0.3 }, dur: 20, name: 'Sundered Armor' }], sfx: 'blunt', desc: 'Smash the enemy\'s armor, lowering it by 30%.' },
    furyofthelast: { name: 'Last Stand', icon: '🏳', cd: 300, target: 'self', effects: [{ t: 'selfhealpct', pct: 0.4 }, { t: 'buff', mods: { dmgTaken: -0.4 }, dur: 12, name: 'Last Stand' }], sfx: 'buff', desc: 'Heal 40% and take 40% less damage for 12 seconds.' },
    tripkick: { name: 'Leg Sweep', icon: '🦵', cd: 16, range: 'melee', target: 'enemy', effects: [{ t: 'hit', amt: [5, 1.6] }, { t: 'stun', dur: 1.5 }], sfx: 'punch', desc: 'Sweep the enemy\'s legs out from under it.' },
    poisonblade: { name: 'Envenom Blades', icon: '🧪', cd: 60, target: 'self', effects: [{ t: 'buff', mods: { dmgMul: 0.2 }, dur: 30, name: 'Envenomed' }], sfx: 'poison', desc: 'Coat your blades in poison: +20% damage for 30 seconds.' },
    shadowstep: { name: 'Shadow Step', icon: '👣', cd: 20, range: 280, target: 'enemy', effects: [{ t: 'lunge' }, { t: 'wdmg', mult: 1.8, backMult: 1.5 }], sfx: 'whoosh', desc: 'Step through shadows to the target and strike.' },
    cripplingstrike: { name: 'Crippling Strike', icon: '🦴', cd: 15, range: 'melee', target: 'enemy', effects: [{ t: 'wdmg', mult: 1.3 }, { t: 'snare', pct: 0.5, dur: 10 }], sfx: 'pierce', desc: 'Slash a tendon, slowing the target.' },
    craneKick: { name: 'Crane Kick', icon: '🦩', cd: 12, range: 'melee', target: 'enemy', effects: [{ t: 'hit', amt: [9, 2.8] }], sfx: 'punch', desc: 'A high, precise kick.' },
    innerpeace: { name: 'Inner Peace', icon: '☯', cd: 180, target: 'self', effects: [{ t: 'healpct', pct: 0.5 }, { t: 'dropaggro', pct: 0.5 }], sfx: 'heal', desc: 'Calm your spirit: heal 50% and shed half your threat.' },
    stonefist: { name: 'Stonefist Stance', icon: '🗿', cd: 90, target: 'self', effects: [{ t: 'buff', mods: { haste: 0.25, ac: 40 }, dur: 25, name: 'Stonefist' }], sfx: 'buff', desc: '25% faster attacks and more armor for 25 seconds.' },
    axethrow: { name: 'Axe Storm', icon: '🪓', cd: 22, range: 380, target: 'enemy', effects: [{ t: 'hit', amt: [6, 1.8], ranged: true }, { t: 'hit', amt: [6, 1.8], ranged: true }, { t: 'hit', amt: [6, 1.8], ranged: true }], sfx: 'throw', desc: 'Hurl three axes at once.' },
    berserkstomp: { name: 'Earthshaking Stomp', icon: '🦶', cd: 25, target: 'pbae', radius: 110, effects: [{ t: 'hit', amt: [8, 2.2] }, { t: 'stun', dur: 1 }], sfx: 'blunt', desc: 'Stomp the ground, stunning everything around you.' },
    unbridledrage: { name: 'Unbridled Rage', icon: '🔥', cd: 240, target: 'self', effects: [{ t: 'buff', mods: { dmgMul: 0.4, dmgTaken: 0.15 }, dur: 20, name: 'Unbridled Rage' }], sfx: 'roar', desc: '+40% damage, but you take 15% more, for 20 seconds.' },
  };
  // ---------- v18: ten hotbar abilities for every class ----------
  const M = 'melee';
  Object.assign(D.SKILLS, {
    cleave: { name: 'Cleave', icon: '🪓', cd: 10, target: 'pbae', radius: 85, effects: [{ t: 'wdmg', mult: 1.1 }], sfx: 'slash', desc: 'A wide swing that hits every enemy in front of and around you.' },
    berserkrage: { name: 'Berserker Rage', icon: '😤', cd: 60, target: 'self', effects: [{ t: 'buff', name: 'Berserker Rage', mods: { haste: 0.35, dmgMul: 0.25 }, dur: 20 }], sfx: 'rage', desc: 'Fly into a rage: attack 35% faster and hit 25% harder for 20 seconds.' },
    holystrike: { name: 'Holy Strike', icon: '✝', cd: 10, range: M, target: 'enemy', effects: [{ t: 'wdmg', mult: 1.3 }, { t: 'dmg', amt: [6, 2.2], res: 'magic', undead: 2 }], sfx: 'blunt', desc: 'A blessed blow that also burns with holy light, twice as hard against undead.' },
    divineshield: { name: 'Divine Shield', icon: '🔆', cd: 90, target: 'self', effects: [{ t: 'buff', name: 'Divine Shield', mods: { dmgTaken: -0.3, ac: 40 }, dur: 15 }], sfx: 'buff', desc: 'Take 30% less damage and gain armor for 15 seconds.' },
    auravalor: { name: 'Aura of Valor', icon: '🦁', cd: 120, target: 'group', effects: [{ t: 'buff', name: 'Aura of Valor', mods: { dmgMul: 0.12, ac: 30 }, dur: 60 }], sfx: 'buff', desc: 'Your group hits 12% harder and gains armor for 1 minute.' },
    righteousfury: { name: 'Righteous Fury', icon: '⚡', cd: 75, target: 'self', effects: [{ t: 'buff', name: 'Righteous Fury', mods: { haste: 0.25, dmgMul: 0.15 }, dur: 20 }], sfx: 'warcry', desc: 'Attack 25% faster and hit 15% harder for 20 seconds.' },
    smite: { name: 'Smite', icon: '🔨', cd: 20, range: M, target: 'enemy', effects: [{ t: 'wdmg', mult: 1.6 }, { t: 'stun', dur: 1.5 }], sfx: 'blunt', desc: 'A crushing holy blow that stuns.' },
    purify: { name: 'Purify', icon: '💧', cd: 120, target: 'self', effects: [{ t: 'selfhealpct', pct: 0.3 }], sfx: 'heal', desc: 'Heal yourself for 30% of your health.' },
    avengingwrath: { name: 'Avenging Wrath', icon: '☀', cd: 60, target: 'pbae', radius: 120, effects: [{ t: 'dmg', amt: [10, 3.4], res: 'magic', undead: 2 }], sfx: 'magic', desc: 'Holy fire bursts out around you, burning every enemy, twice as hard against undead.' },
    lifetap: { name: 'Life Tap Strike', icon: '🩸', cd: 12, range: M, target: 'enemy', effects: [{ t: 'wdmg', mult: 1.3 }, { t: 'tap', amt: [5, 1.8] }], sfx: 'dark', desc: 'Strike and drain the enemy\'s life into yours.' },
    darkshroud: { name: 'Dark Shroud', icon: '🌑', cd: 90, target: 'self', effects: [{ t: 'buff', name: 'Dark Shroud', mods: { dmgTaken: -0.2, ds: 15 }, dur: 20 }], sfx: 'dark', desc: 'Shadows wrap you: take 20% less damage and hurt anyone who strikes you.' },
    deathgrip: { name: 'Death Grip', icon: '🖤', cd: 15, range: 300, target: 'enemy', effects: [{ t: 'taunt' }, { t: 'snare', pct: 0.5, dur: 8 }], sfx: 'dark', desc: 'Seize the enemy\'s attention from afar and slow it.' },
    unholyfrenzy: { name: 'Unholy Frenzy', icon: '💀', cd: 75, target: 'self', effects: [{ t: 'buff', name: 'Unholy Frenzy', mods: { haste: 0.3, dmgMul: 0.15 }, dur: 20 }], sfx: 'rage', desc: 'Attack 30% faster and hit 15% harder for 20 seconds.' },
    soulrend: { name: 'Soul Rend', icon: '🗡', cd: 20, range: M, target: 'enemy', effects: [{ t: 'wdmg', mult: 2.0 }, { t: 'dot', amt: [4, 1.6], dur: 12, res: 'disease' }], sfx: 'slash', desc: 'Tear at the soul: heavy damage plus a rotting curse.' },
    deathcoil: { name: 'Death Coil', icon: '☠', cd: 45, target: 'pbae', radius: 120, effects: [{ t: 'dmg', amt: [9, 3.2], res: 'disease' }], sfx: 'dark', desc: 'A wave of death energy hits every enemy around you.' },
    huntersmark: { name: 'Hunter\'s Mark', icon: '🎯', cd: 20, range: 450, target: 'enemy', effects: [{ t: 'debuff', name: 'Hunter\'s Mark', mods: { acMul: -0.2 }, dur: 30 }], sfx: 'bow', desc: 'Mark your prey: its armor drops 20% for 30 seconds.' },
    twinstrike: { name: 'Twin Strike', icon: '⚔', cd: 8, range: M, target: 'enemy', effects: [{ t: 'multi', n: 2, mult: 0.95 }], sfx: 'slash', desc: 'Strike twice in quick succession.' },
    camouflage: { name: 'Camouflage', icon: '🌿', cd: 30, target: 'self', effects: [{ t: 'dropaggro', pct: 0.6 }], sfx: 'stealth', desc: 'Blend into the land: enemies lose most of their anger toward you.' },
    rapidfire: { name: 'Rapid Fire', icon: '🏹', cd: 75, target: 'self', effects: [{ t: 'buff', name: 'Rapid Fire', mods: { haste: 0.3, rangedMul: 0.2 }, dur: 20 }], sfx: 'buff', desc: 'Shoot and strike 30% faster with 20% stronger ranged attacks for 20 seconds.' },
    entangle: { name: 'Entangling Shot', icon: '🌱', cd: 25, range: 450, target: 'enemy', effects: [{ t: 'hit', amt: [6, 1.8], ranged: true }, { t: 'root', dur: 6 }], sfx: 'bow', desc: 'An arrow that roots the target in place for 6 seconds.' },
    naturesvigor: { name: 'Nature\'s Vigor', icon: '🍃', cd: 120, target: 'self', effects: [{ t: 'selfhealpct', pct: 0.3 }], sfx: 'heal', desc: 'Heal yourself for 30% of your health.' },
    volley: { name: 'Volley', icon: '🌧', cd: 30, range: 450, target: 'enemy', effects: [{ t: 'hit', amt: [5, 1.5], ranged: true }, { t: 'hit', amt: [5, 1.5], ranged: true }, { t: 'hit', amt: [5, 1.5], ranged: true }, { t: 'hit', amt: [5, 1.5], ranged: true }], sfx: 'volley', desc: 'Loose four arrows at once.' },
    eagleaspect: { name: 'Aspect of the Eagle', icon: '🦅', cd: 120, target: 'self', effects: [{ t: 'buff', name: 'Aspect of the Eagle', mods: { dmgMul: 0.2, rangedMul: 0.3 }, dur: 30 }], sfx: 'buff', desc: '+20% damage and +30% ranged damage for 30 seconds.' },
    danceblades: { name: 'Dance of Blades', icon: '💃', cd: 12, range: M, target: 'enemy', effects: [{ t: 'multi', n: 3, mult: 0.7 }], sfx: 'slash', desc: 'Three quick strikes in a flourish.' },
    battlerhythm: { name: 'Battle Rhythm', icon: '🥁', cd: 60, target: 'self', effects: [{ t: 'buff', name: 'Battle Rhythm', mods: { haste: 0.2, dmgMul: 0.1 }, dur: 30 }], sfx: 'warcry', desc: 'Fight to the beat: 20% faster attacks and 10% more damage for 30 seconds.' },
    shrillnote: { name: 'Shrill Note', icon: '📯', cd: 18, range: 300, target: 'enemy', effects: [{ t: 'hit', amt: [5, 1.6] }, { t: 'stun', dur: 1.5 }], sfx: 'stun', desc: 'A piercing note that stuns the target.' },
    inspire: { name: 'Second Wind', icon: '🎐', cd: 180, target: 'self', effects: [{ t: 'mana', pct: 0.25 }], sfx: 'buff', desc: 'Catch your breath: restore 25% of your mana.' },
    tumble: { name: 'Tumble', icon: '🤸', cd: 30, target: 'self', effects: [{ t: 'dropaggro', pct: 0.5 }, { t: 'buff', name: 'Tumble', mods: { dmgTaken: -0.3 }, dur: 5 }], sfx: 'whoosh', desc: 'Roll away: shed half your threat and take 30% less damage for 5 seconds.' },
    crescendo: { name: 'Crescendo', icon: '🎼', cd: 90, target: 'self', effects: [{ t: 'buff', name: 'Crescendo', mods: { dmgMul: 0.25, spellMul: 0.15 }, dur: 15 }], sfx: 'buff', desc: '+25% damage and +15% song power for 15 seconds.' },
    finale: { name: 'Grand Finale', icon: '🎆', cd: 45, target: 'pbae', radius: 120, effects: [{ t: 'hit', amt: [10, 3.0] }], sfx: 'magic', desc: 'A thunderous closing chord that hits every enemy around you.' },
    bestialfury: { name: 'Bestial Fury', icon: '🐺', cd: 60, target: 'self', effects: [{ t: 'buff', name: 'Bestial Fury', mods: { haste: 0.25, dmgMul: 0.15 }, dur: 20 }], sfx: 'rage', desc: 'Attack 25% faster and hit 15% harder for 20 seconds.' },
    rendingclaws: { name: 'Rending Claws', icon: '🐾', cd: 12, range: M, target: 'enemy', effects: [{ t: 'multi', n: 3, mult: 0.75 }], sfx: 'slash', desc: 'Three savage clawing strikes.' },
    empowerpet: { name: 'Empower Pet', icon: '💪', cd: 90, target: 'pet', effects: [{ t: 'buff', name: 'Empowered', mods: { dmgMul: 0.3, haste: 0.2 }, dur: 60 }], sfx: 'buff', desc: 'Your pet hits 30% harder and 20% faster for 1 minute.' },
    savageroar: { name: 'Savage Roar', icon: '🦁', cd: 30, target: 'pbae', radius: 110, effects: [{ t: 'hit', amt: [7, 2.0] }, { t: 'stun', dur: 1 }], sfx: 'warcry', desc: 'A roar that hurts and stuns everything around you.' },
    mendpet: { name: 'Mend Pet', icon: '🩹', cd: 30, target: 'pet', effects: [{ t: 'healpct', pct: 0.35 }], sfx: 'heal', desc: 'Heal your pet for 35% of its health.' },
    primalstrike: { name: 'Primal Strike', icon: '🦴', cd: 20, range: M, target: 'enemy', effects: [{ t: 'wdmg', mult: 2.4 }], sfx: 'heavy', desc: 'A primal blow for heavy damage.' },
    feralfrenzy: { name: 'Feral Frenzy', icon: '🔥', cd: 120, target: 'self', effects: [{ t: 'buff', name: 'Feral Frenzy', mods: { haste: 0.3, dmgMul: 0.3 }, dur: 20 }], sfx: 'rage', desc: '+30% attack speed and damage for 20 seconds.' },
    adrenaline: { name: 'Adrenaline Rush', icon: '💉', cd: 75, target: 'self', effects: [{ t: 'buff', name: 'Adrenaline Rush', mods: { haste: 0.3, dmgMul: 0.1 }, dur: 15 }], sfx: 'rage', desc: 'Attack 30% faster and hit 10% harder for 15 seconds.' },
    focusedmind: { name: 'Focused Mind', icon: '🧘', cd: 120, target: 'self', effects: [{ t: 'buff', name: 'Focused Mind', mods: { manaRegen: 4 }, dur: 30 }], sfx: 'buff', desc: 'Regain 4 extra mana per second for 30 seconds.' },
    manashield: { name: 'Mana Shield', icon: '🔷', cd: 90, target: 'self', effects: [{ t: 'rune', amt: [30, 12], dur: 120 }], sfx: 'buff', desc: 'A magical barrier absorbs damage for 2 minutes.' },
    divineinterv: { name: 'Divine Intervention', icon: '👼', cd: 180, target: 'ally', effects: [{ t: 'healpct', pct: 0.45 }], sfx: 'heal', desc: 'Heal a friend for 45% of their health.' },
    hammerfaith: { name: 'Hammer of Faith', icon: '🔨', cd: 15, range: 380, target: 'enemy', effects: [{ t: 'dmg', amt: [8, 2.8], res: 'magic', undead: 2 }, { t: 'stun', dur: 1 }], sfx: 'magic', desc: 'A hammer of light strikes and stuns, twice as hard against undead.' },
    celestialward: { name: 'Celestial Ward', icon: '🛡', cd: 120, target: 'group', effects: [{ t: 'buff', name: 'Celestial Ward', mods: { dmgTaken: -0.12, ac: 25 }, dur: 60 }], sfx: 'buff', desc: 'Your group takes 12% less damage and gains armor for 1 minute.' },
    prayerrenewal: { name: 'Prayer of Renewal', icon: '🙏', cd: 45, target: 'group', effects: [{ t: 'hot', amt: [4, 2.2], dur: 18 }], sfx: 'heal', desc: 'Your whole group heals over 18 seconds.' },
    turnundead: { name: 'Turn Undead', icon: '☀', cd: 25, range: 380, target: 'enemy', effects: [{ t: 'dmg', amt: [8, 2.4], res: 'magic', undead: 3 }], sfx: 'magic', desc: 'Holy light that sears the undead (three times as hard).' },
    martyrblessing: { name: 'Martyr\'s Blessing', icon: '💛', cd: 240, target: 'group', effects: [{ t: 'healpct', pct: 0.2 }], sfx: 'heal', desc: 'Instantly heal your whole group for 20% of their health.' },
    naturestouch: { name: 'Nature\'s Touch', icon: '🌸', cd: 120, target: 'ally', effects: [{ t: 'healpct', pct: 0.3 }], sfx: 'heal', desc: 'Heal a friend for 30% of their health.' },
    thornburst: { name: 'Thorn Burst', icon: '🌵', cd: 30, target: 'pbae', radius: 110, effects: [{ t: 'dmg', amt: [7, 2.4], res: 'poison' }, { t: 'snare', pct: 0.4, dur: 8 }], sfx: 'poison', desc: 'Thorns erupt around you, hurting and slowing every enemy.' },
    barkskin: { name: 'Barkskin', icon: '🌳', cd: 90, target: 'self', effects: [{ t: 'buff', name: 'Barkskin', mods: { dmgTaken: -0.25, ac: 30 }, dur: 20 }], sfx: 'buff', desc: 'Your skin hardens: 25% less damage taken for 20 seconds.' },
    wildgrowth: { name: 'Wild Growth', icon: '🌿', cd: 45, target: 'group', effects: [{ t: 'hot', amt: [4, 2.0], dur: 18 }], sfx: 'heal', desc: 'Your whole group heals over 18 seconds.' },
    moonfire: { name: 'Moonfire', icon: '🌙', cd: 12, range: 400, target: 'enemy', effects: [{ t: 'dmg', amt: [6, 2.2], res: 'fire' }, { t: 'dot', amt: [3, 1.0], dur: 12, res: 'fire' }], sfx: 'fire', desc: 'Moonlight burns the target, then keeps burning.' },
    windwalk: { name: 'Wind Walk', icon: '💨', cd: 60, target: 'self', effects: [{ t: 'buff', name: 'Wind Walk', mods: { speed: 0.5 }, dur: 20 }], sfx: 'whoosh', desc: 'Run 50% faster for 20 seconds.' },
    entangleroots: { name: 'Entangling Roots', icon: '🌱', cd: 20, range: 400, target: 'enemy', effects: [{ t: 'root', dur: 10, res: 'magic' }], sfx: 'poison', desc: 'Roots hold the target in place for 10 seconds.' },
    spiritmend: { name: 'Spirit Mend', icon: '👻', cd: 120, target: 'ally', effects: [{ t: 'healpct', pct: 0.3 }], sfx: 'heal', desc: 'Ancestral spirits heal a friend for 30% of their health.' },
    ancestralward: { name: 'Ancestral Ward', icon: '🗿', cd: 120, target: 'group', effects: [{ t: 'buff', name: 'Ancestral Ward', mods: { dmgTaken: -0.1, STA: 10 }, dur: 60 }], sfx: 'buff', desc: 'Your group takes 10% less damage and gains Stamina for 1 minute.' },
    totemstrike: { name: 'Totemic Slow', icon: '🐌', cd: 20, range: 400, target: 'enemy', effects: [{ t: 'debuff', name: 'Totemic Slow', mods: { slow: 0.25 }, dur: 30, res: 'magic' }], sfx: 'magic', desc: 'The target attacks 25% slower for 30 seconds.' },
    spiritlink: { name: 'Spirit Link', icon: '🔗', cd: 45, target: 'group', effects: [{ t: 'hot', amt: [4, 2.0], dur: 18 }], sfx: 'heal', desc: 'Your whole group heals over 18 seconds.' },
    frostshock: { name: 'Frost Shock', icon: '❄', cd: 12, range: 400, target: 'enemy', effects: [{ t: 'dmg', amt: [7, 2.4], res: 'cold' }, { t: 'snare', pct: 0.4, dur: 8 }], sfx: 'cold', desc: 'Frost damage that slows the target.' },
    petward: { name: 'Pet Ward', icon: '🛡', cd: 60, target: 'pet', effects: [{ t: 'buff', name: 'Warded', mods: { dmgTaken: -0.25, ac: 40 }, dur: 30 }], sfx: 'buff', desc: 'Your pet takes 25% less damage for 30 seconds.' },
    soulsiphon: { name: 'Soul Siphon', icon: '🩸', cd: 15, range: 400, target: 'enemy', effects: [{ t: 'tap', amt: [7, 2.4] }], sfx: 'dark', desc: 'Drain the target\'s life into yours.' },
    boneshield: { name: 'Bone Shield', icon: '🦴', cd: 90, target: 'self', effects: [{ t: 'rune', amt: [30, 12], dur: 120 }], sfx: 'dark', desc: 'A shield of bone absorbs damage for 2 minutes.' },
    corpseexplode: { name: 'Corpse Explosion', icon: '💥', cd: 40, range: 400, target: 'tae', radius: 120, effects: [{ t: 'dmg', amt: [9, 3.0], res: 'disease' }], sfx: 'dark', desc: 'Death energy bursts around your target, hitting every enemy nearby.' },
    arcanebarrage: { name: 'Arcane Barrage', icon: '✴', cd: 10, range: 420, target: 'enemy', effects: [{ t: 'dmg', amt: [7, 2.6], res: 'magic' }], sfx: 'magic', desc: 'A quick burst of arcane missiles.' },
    frostnova: { name: 'Frost Nova', icon: '❄', cd: 30, target: 'pbae', radius: 120, effects: [{ t: 'dmg', amt: [6, 2.0], res: 'cold' }, { t: 'root', dur: 5 }], sfx: 'cold', desc: 'Freeze everything around you in place for 5 seconds.' },
    blink: { name: 'Blink', icon: '✨', cd: 30, target: 'self', effects: [{ t: 'dropaggro', pct: 0.7 }], sfx: 'stealth', desc: 'Flicker out of sight: enemies lose most of their anger toward you.' },
    iceblock: { name: 'Ice Block', icon: '🧊', cd: 300, target: 'self', effects: [{ t: 'buff', name: 'Ice Block', mods: { invuln: 1 }, dur: 5 }], sfx: 'cold', desc: 'Encase yourself in ice: nothing can harm you for 5 seconds.' },
    meteor: { name: 'Meteor', icon: '☄', cd: 45, range: 420, target: 'tae', radius: 130, effects: [{ t: 'dmg', amt: [12, 3.8], res: 'fire' }], sfx: 'fire', desc: 'Call down a meteor on your target and everything around it.' },
    concussive: { name: 'Concussive Blast', icon: '💫', cd: 20, range: 420, target: 'enemy', effects: [{ t: 'dmg', amt: [5, 1.8], res: 'magic' }, { t: 'stun', dur: 2 }], sfx: 'magic', desc: 'A blast that stuns the target for 2 seconds.' },
    elembolt: { name: 'Elemental Bolt', icon: '🔥', cd: 10, range: 420, target: 'enemy', effects: [{ t: 'dmg', amt: [7, 2.6], res: 'fire' }], sfx: 'fire', desc: 'A quick bolt of elemental fire.' },
    summonedarmor: { name: 'Summoned Armor', icon: '🛡', cd: 120, target: 'self', effects: [{ t: 'buff', name: 'Summoned Armor', mods: { ac: 60, dmgTaken: -0.1 }, dur: 300 }], sfx: 'buff', desc: 'Conjured plates give you +60 armor for 5 minutes.' },
    fireshield: { name: 'Fire Shield', icon: '🔥', cd: 90, target: 'self', effects: [{ t: 'buff', name: 'Fire Shield', mods: { ds: 25 }, dur: 60 }], sfx: 'fire', desc: 'Flames burn anyone who strikes you for 1 minute.' },
    elemstorm: { name: 'Elemental Storm', icon: '🌩', cd: 45, range: 420, target: 'tae', radius: 130, effects: [{ t: 'dmg', amt: [11, 3.6], res: 'magic' }], sfx: 'lightning', desc: 'A storm of elements strikes everything near your target.' },
    mindshatter: { name: 'Mind Shatter', icon: '🧠', cd: 15, range: 420, target: 'enemy', effects: [{ t: 'dmg', amt: [6, 2.2], res: 'magic' }, { t: 'stun', dur: 1.5 }], sfx: 'magic', desc: 'Shatter the target\'s thoughts: damage and a short stun.' },
    mesmergaze: { name: 'Mesmerizing Gaze', icon: '👁', cd: 30, range: 380, target: 'enemy', effects: [{ t: 'mez', dur: 12, res: 'magic' }], sfx: 'charm', desc: 'Your gaze puts the target to sleep for 12 seconds. Damage wakes it.' },
    manafont: { name: 'Mana Font', icon: '⛲', cd: 120, target: 'group', effects: [{ t: 'buff', name: 'Mana Font', mods: { manaRegen: 3 }, dur: 60 }], sfx: 'buff', desc: 'Your group regains 3 extra mana per second for 1 minute.' },
    mirrorimage: { name: 'Mirror Image', icon: '🪞', cd: 90, target: 'self', effects: [{ t: 'rune', amt: [30, 12], dur: 120 }], sfx: 'buff', desc: 'Illusory copies absorb damage for 2 minutes.' },
    languidgaze: { name: 'Languid Gaze', icon: '🐌', cd: 20, range: 400, target: 'enemy', effects: [{ t: 'debuff', name: 'Languid', mods: { slow: 0.3 }, dur: 30, res: 'magic' }], sfx: 'magic', desc: 'The target attacks 30% slower for 30 seconds.' },
  });
  // ---- the Arquebusier (Valenmoor) and the Trollcaller (Aelindor) ----
  Object.assign(D.SKILLS, {
    aq_aimed: { name: 'Aimed Shot', icon: '🎯', cd: 10, range: 560, target: 'enemy', ranged: true, effects: [{ t: 'rdmg', mult: 2.4 }], sfx: 'heavy', desc: 'Brace, sight down the barrel and fire: a heavy ball at long range.' },
    aq_bayonet: { name: 'Bayonet Lunge', icon: '🗡', cd: 12, range: 220, target: 'enemy', effects: [{ t: 'lunge' }, { t: 'wdmg', mult: 1.5 }, { t: 'stun', dur: 1 }], sfx: 'pierce', desc: 'Charge in with the bayonet, striking and staggering the enemy for 1 second.' },
    aq_scatter: { name: 'Scattershot', icon: '🌧', cd: 16, range: 420, target: 'tae', radius: 110, ranged: true, effects: [{ t: 'rdmg', mult: 1.1 }], sfx: 'heavy', desc: 'A charge of shot that hits every enemy around your target.' },
    aq_powder: { name: 'Powder Charge', icon: '💣', cd: 22, range: 380, target: 'tae', radius: 130, effects: [{ t: 'hit', amt: [10, 3.0] }, { t: 'stun', dur: 1.5 }], sfx: 'heavy', desc: 'Hurl a lit powder charge: it blasts and stuns everything around your target.' },
    aq_smoke: { name: 'Smoke Bomb', icon: '💨', cd: 45, target: 'self', effects: [{ t: 'dropaggro', pct: 0.8 }, { t: 'buff', name: 'Smoke Bomb', mods: { dmgTaken: -0.2 }, dur: 6 }], sfx: 'whoosh', desc: 'Vanish in a cloud of powder smoke: enemies lose most of their anger and you take 20% less damage for 6 seconds.' },
    aq_reload: { name: 'Rapid Reload', icon: '⏩', cd: 60, target: 'self', effects: [{ t: 'buff', name: 'Rapid Reload', mods: { haste: 0.4, rangedMul: 0.15 }, dur: 15 }], sfx: 'buff', desc: 'Pre-measured cartridges: reload and shoot 40% faster with 15% stronger shots for 15 seconds.' },
    aq_incendiary: { name: 'Incendiary Round', icon: '🔥', cd: 18, range: 560, target: 'enemy', ranged: true, effects: [{ t: 'rdmg', mult: 1.3 }, { t: 'dot', amt: [6, 2.4], dur: 12, res: 'fire' }], sfx: 'fire', desc: 'A burning ball that sets the target alight for 12 seconds.' },
    aq_volley: { name: 'Volley Command', icon: '📯', cd: 120, target: 'group', effects: [{ t: 'buff', name: 'Volley Command', mods: { rangedMul: 0.3, dmgMul: 0.1 }, dur: 30 }], sfx: 'warcry', desc: '"Present... FIRE!" Your group shoots 30% harder and strikes 10% harder for 30 seconds.' },
    tc_smash: { name: 'Troll Smash', icon: '👊', cd: 12, range: 450, target: 'enemy', effects: [{ t: 'petstrike', mult: 2.2, stun: 1.5 }], sfx: 'heavy', desc: 'Your troll brings both fists down on your target: a huge blow that stuns it for 1.5 seconds.' },
    tc_stoneskin: { name: 'Stoneskin', icon: '🪨', cd: 60, target: 'pet', effects: [{ t: 'buff', name: 'Stoneskin', mods: { dmgTaken: -0.35, ac: 40 }, dur: 20 }], sfx: 'buff', desc: 'Your troll\'s hide turns to stone: it takes 35% less damage for 20 seconds.' },
    tc_roar: { name: 'Primal Roar', icon: '🦍', cd: 20, target: 'self', effects: [{ t: 'pettaunt', radius: 170 }], sfx: 'roar', desc: 'Your troll roars: every enemy near it turns to fight the troll instead.' },
    tc_frenzy: { name: 'Wild Frenzy', icon: '😡', cd: 90, target: 'pet', effects: [{ t: 'buff', name: 'Wild Frenzy', mods: { dmgMul: 0.4, haste: 0.3 }, dur: 20 }], sfx: 'rage', desc: 'Drive your troll into a frenzy: it hits 40% harder and 30% faster for 20 seconds.' },
  });
  // each class: exactly 10 hotbar abilities (unlocking 1, 3, 6, 10, 14, 18, 23, 28, 34, 40) plus its passive skills
  D.ACTIVE_LEVELS = [1, 3, 6, 10, 14, 18, 23, 28, 34, 40];
  D.CLASS_ACTIVES = {
    warrior: ['kick', 'taunt', 'bash', 'warcry', 'shieldbreak', 'defensive', 'cleave', 'rampage', 'disarm', 'furyofthelast'],
    paladin: ['bash', 'taunt', 'layonhands', 'holystrike', 'divineshield', 'auravalor', 'righteousfury', 'smite', 'purify', 'avengingwrath'],
    shadowknight: ['bash', 'taunt', 'harmtouch', 'lifetap', 'darkshroud', 'deathgrip', 'unholyfrenzy', 'soulrend', 'cleave', 'deathcoil'],
    ranger: ['kick', 'huntersmark', 'trueshot', 'twinstrike', 'camouflage', 'rapidfire', 'entangle', 'naturesvigor', 'volley', 'eagleaspect'],
    bard: ['kick', 'fading', 'danceblades', 'battlerhythm', 'shrillnote', 'cleave', 'inspire', 'tumble', 'crescendo', 'finale'],
    beastlord: ['kick', 'feral', 'bestialfury', 'rendingclaws', 'empowerpet', 'savageroar', 'mendpet', 'primalstrike', 'harvest', 'feralfrenzy'],
    rogue: ['backstab', 'evade', 'hide', 'cripplingstrike', 'adrenaline', 'garrote', 'poisonblade', 'assassinate', 'shadowstep', 'deadlystrike'],
    monk: ['roundkick', 'mend', 'tigerclaw', 'craneKick', 'feigndeath', 'eaglestrike', 'innerpeace', 'flyingkick', 'stonefist', 'dragonpunch'],
    berserker: ['frenzy', 'kick', 'berserkrage', 'berserkstomp', 'ragevolley', 'cleave', 'cleavingrage', 'bloodfrenzy', 'unbridledrage', 'bloodlust'],
    cleric: ['hammerfaith', 'focusedmind', 'divineinterv', 'celestialward', 'turnundead', 'prayerrenewal', 'divineaura', 'manashield', 'arcanesurge', 'martyrblessing'],
    druid: ['moonfire', 'focusedmind', 'entangleroots', 'naturestouch', 'barkskin', 'windwalk', 'thornburst', 'wildgrowth', 'communion', 'arcanesurge'],
    shaman: ['frostshock', 'focusedmind', 'cannibalize', 'totemstrike', 'spiritmend', 'empowerpet', 'ancestralward', 'spiritlink', 'manashield', 'arcanesurge'],
    necromancer: ['soulsiphon', 'focusedmind', 'empowerpet', 'mendpet', 'feigndeath', 'boneshield', 'petward', 'corpseexplode', 'darkcommunion', 'arcanesurge'],
    wizard: ['arcanebarrage', 'focusedmind', 'concussive', 'blink', 'manashield', 'frostnova', 'harvest', 'meteor', 'iceblock', 'arcanesurge'],
    magician: ['elembolt', 'focusedmind', 'empowerpet', 'mendpet', 'summonedarmor', 'fireshield', 'petward', 'elemstorm', 'conversion', 'arcanesurge'],
    enchanter: ['mindshatter', 'focusedmind', 'languidgaze', 'mesmergaze', 'mirrorimage', 'manafont', 'blink', 'empowerpet', 'mindovermatter', 'arcanesurge'],
  };
  // pure melee classes get 10 extra class skills (20 in all), unlocking in between the first ten
  D.EXTRA_ACTIVE_LEVELS = [2, 5, 8, 12, 16, 21, 26, 31, 37, 45];
  const XS = {
    // warrior
    hamstrike: { name: 'Hamstring', icon: '🦵', cd: 12, range: 'melee', target: 'enemy', effects: [{ t: 'wdmg', mult: 0.8 }, { t: 'snare', pct: 0.5, dur: 10 }], sfx: 'slash', desc: 'Cut the legs out from under the enemy: it moves 50% slower for 10 seconds.' },
    mockingblow: { name: 'Mocking Blow', icon: '😏', cd: 10, range: 'melee', target: 'enemy', effects: [{ t: 'wdmg', mult: 1.0 }, { t: 'taunt' }], sfx: 'blunt', desc: 'A blow that forces the enemy to fight you.' },
    secondwind: { name: 'Second Wind', icon: '🌬', cd: 90, target: 'self', effects: [{ t: 'selfhealpct', pct: 0.25 }], sfx: 'buff', desc: 'Catch your breath and recover 25% of your health.' },
    wcharge: { name: 'Charge', icon: '🐂', cd: 20, range: 280, target: 'enemy', effects: [{ t: 'lunge' }, { t: 'wdmg', mult: 1.0 }, { t: 'stun', dur: 1 }], sfx: 'charge', desc: 'Rush a distant enemy, striking and stunning it for 1 second.' },
    shieldwallw: { name: 'Iron Will', icon: '🗿', cd: 120, target: 'self', effects: [{ t: 'buff', name: 'Iron Will', mods: { dmgTaken: -0.3 }, dur: 12 }], sfx: 'buff', desc: 'Take 30% less damage for 12 seconds.' },
    whirlwind: { name: 'Whirlwind', icon: '🌀', cd: 16, target: 'pbae', radius: 95, effects: [{ t: 'wdmg', mult: 1.4 }], sfx: 'whirl', desc: 'Spin with your weapon, hitting every enemy around you.' },
    overpower: { name: 'Overpower', icon: '⚡', cd: 12, range: 'melee', target: 'enemy', effects: [{ t: 'execute', below: 0.35, mult: 1.5, bonus: 2.2 }], sfx: 'slash', desc: 'A heavy strike that deals more than double damage to enemies under 35% health.' },
    commandshout: { name: 'Commanding Shout', icon: '📯', cd: 120, target: 'self', effects: [{ t: 'buff', name: 'Commanding Shout', mods: { hpPct: 0.15, regen: 6 }, dur: 60 }], sfx: 'warcry', desc: '+15% max health and faster health regen for 60 seconds.' },
    heroicstrike: { name: 'Heroic Strike', icon: '🗡', cd: 9, range: 'melee', target: 'enemy', effects: [{ t: 'wdmg', mult: 2.4 }], sfx: 'slash', desc: 'A mighty blow for heavy damage.' },
    avatar: { name: 'Avatar of War', icon: '🦁', cd: 180, target: 'self', effects: [{ t: 'buff', name: 'Avatar of War', mods: { dmgMul: 0.3, dmgTaken: -0.15, haste: 0.15 }, dur: 20 }], sfx: 'rage', desc: '+30% damage, 15% faster attacks and 15% less damage taken for 20 seconds.' },
    // monk
    legsweep: { name: 'Leg Sweep', icon: '🦶', cd: 16, range: 'melee', target: 'enemy', effects: [{ t: 'hit', amt: [4, 1.4] }, { t: 'stun', dur: 1 }], sfx: 'punch', desc: 'Sweep the enemy off its feet, stunning it for 1 second.' },
    palmstrike: { name: 'Palm Strike', icon: '✋', cd: 6, range: 'melee', target: 'enemy', effects: [{ t: 'hit', amt: [6, 2.4] }], sfx: 'punch', desc: 'A fast open-palm strike.' },
    chiburst: { name: 'Chi Burst', icon: '☯', cd: 14, target: 'pbae', radius: 95, effects: [{ t: 'hit', amt: [6, 2.0] }], sfx: 'magic', desc: 'Release your chi, hurting every enemy around you.' },
    pressurepoint: { name: 'Pressure Point', icon: '👆', cd: 20, range: 'melee', target: 'enemy', effects: [{ t: 'hit', amt: [4, 1.5] }, { t: 'debuff', name: 'Pressure Point', mods: { slow: 0.2 }, dur: 15 }], sfx: 'punch', desc: 'Strike a nerve: the enemy attacks 20% slower for 15 seconds.' },
    windsteps: { name: 'Wind Steps', icon: '🍃', cd: 45, target: 'self', effects: [{ t: 'buff', name: 'Wind Steps', mods: { haste: 0.2, speed: 0.3 }, dur: 15 }], sfx: 'buff', desc: 'Attack 20% faster and run 30% faster for 15 seconds.' },
    cyclonekick: { name: 'Cyclone Kick', icon: '🌪', cd: 12, range: 'melee', target: 'enemy', effects: [{ t: 'multi', n: 3, mult: 0.75 }], sfx: 'punch', desc: 'Three spinning kicks in a row.' },
    ironskin: { name: 'Iron Skin', icon: '🪨', cd: 75, target: 'self', effects: [{ t: 'buff', name: 'Iron Skin', mods: { dmgTaken: -0.25 }, dur: 15 }], sfx: 'buff', desc: 'Take 25% less damage for 15 seconds.' },
    fistsoffury: { name: 'Fists of Fury', icon: '👊', cd: 20, range: 'melee', target: 'enemy', effects: [{ t: 'multi', n: 5, mult: 0.6 }], sfx: 'punch', desc: 'A blur of five rapid punches.' },
    quiveringpalm: { name: 'Quivering Palm', icon: '💫', cd: 60, range: 'melee', target: 'enemy', effects: [{ t: 'hit', amt: [8, 2.5] }, { t: 'dot', amt: [8, 3.0], dur: 12 }], sfx: 'magic', desc: 'A deadly touch that keeps hurting the enemy for 12 seconds.' },
    zenstrike: { name: 'Zen Strike', icon: '🕉', cd: 15, range: 'melee', target: 'enemy', effects: [{ t: 'execute', below: 0.3, mult: 1.6, bonus: 2.4 }], sfx: 'punch', desc: 'A perfect strike that deals huge damage to enemies under 30% health.' },
    // rogue
    sinister: { name: 'Sinister Strike', icon: '🗡', cd: 4, range: 'melee', target: 'enemy', effects: [{ t: 'wdmg', mult: 1.3 }], sfx: 'pierce', desc: 'A quick, cheap stab you can use often.' },
    gouge: { name: 'Gouge', icon: '👁', cd: 18, range: 'melee', target: 'enemy', effects: [{ t: 'wdmg', mult: 0.6 }, { t: 'stun', dur: 1.5 }], sfx: 'pierce', desc: 'Gouge the enemy, stunning it for 1.5 seconds.' },
    sprint: { name: 'Sprint', icon: '💨', cd: 40, target: 'self', effects: [{ t: 'buff', name: 'Sprint', mods: { speed: 0.5 }, dur: 8 }], sfx: 'buff', desc: 'Run 50% faster for 8 seconds.' },
    eviscerate: { name: 'Eviscerate', icon: '🩸', cd: 12, range: 'melee', target: 'enemy', effects: [{ t: 'wdmg', mult: 2.4 }], sfx: 'pierce', desc: 'A vicious finishing blow for heavy damage.' },
    bladeflurry: { name: 'Blade Flurry', icon: '⚔', cd: 60, target: 'self', effects: [{ t: 'buff', name: 'Blade Flurry', mods: { haste: 0.35 }, dur: 12 }], sfx: 'rage', desc: 'Attack 35% faster for 12 seconds.' },
    fanknives: { name: 'Fan of Knives', icon: '🔪', cd: 14, target: 'pbae', radius: 95, effects: [{ t: 'wdmg', mult: 0.9 }], sfx: 'pierce', desc: 'Throw knives at every enemy around you.' },
    kidneyshot: { name: 'Kidney Shot', icon: '🎯', cd: 30, range: 'melee', target: 'enemy', effects: [{ t: 'wdmg', mult: 0.8 }, { t: 'stun', dur: 2 }], sfx: 'pierce', desc: 'A low blow that stuns the enemy for 2 seconds.' },
    rupture: { name: 'Rupture', icon: '💉', cd: 15, range: 'melee', target: 'enemy', effects: [{ t: 'wdmg', mult: 0.8 }, { t: 'dot', amt: [8, 3.0], dur: 12 }], sfx: 'pierce', desc: 'Open a wound that bleeds for 12 seconds.' },
    ambush: { name: 'Ambush', icon: '🌑', cd: 15, range: 'melee', target: 'enemy', effects: [{ t: 'wdmg', mult: 2.2, backMult: 2.0 }], sfx: 'pierce', desc: 'Strike from the shadows. Double damage when the enemy is not fighting you.' },
    shadowdance: { name: 'Shadow Dance', icon: '🎭', cd: 120, target: 'self', effects: [{ t: 'buff', name: 'Shadow Dance', mods: { dmgMul: 0.3, haste: 0.15 }, dur: 15 }], sfx: 'rage', desc: '+30% damage and 15% faster attacks for 15 seconds.' },
    // berserker
    bloodletter: { name: 'Bloodletter', icon: '🩸', cd: 10, range: 'melee', target: 'enemy', effects: [{ t: 'wdmg', mult: 0.9 }, { t: 'dot', amt: [6, 2.2], dur: 12 }], sfx: 'slash', desc: 'A savage cut that bleeds for 12 seconds.' },
    intimidate: { name: 'Intimidating Shout', icon: '🗯', cd: 30, range: 300, target: 'enemy', effects: [{ t: 'debuff', name: 'Intimidated', mods: { dmgMul: -0.15 }, dur: 15 }], sfx: 'warcry', desc: 'The enemy deals 15% less damage for 15 seconds.' },
    recklessswing: { name: 'Reckless Swing', icon: '🪓', cd: 10, range: 'melee', target: 'enemy', effects: [{ t: 'wdmg', mult: 2.0 }], sfx: 'slash', desc: 'A wild, heavy swing.' },
    skullsplitter: { name: 'Skull Splitter', icon: '💀', cd: 18, range: 'melee', target: 'enemy', effects: [{ t: 'wdmg', mult: 1.6 }, { t: 'stun', dur: 1 }], sfx: 'heavy', desc: 'Crack the enemy\'s skull, stunning it for 1 second.' },
    enragedregen: { name: 'Enraged Regeneration', icon: '❤', cd: 90, target: 'self', effects: [{ t: 'selfhealpct', pct: 0.3 }], sfx: 'rage', desc: 'Your fury mends you: recover 30% of your health.' },
    bwhirl: { name: 'Whirling Axes', icon: '🌀', cd: 14, target: 'pbae', radius: 95, effects: [{ t: 'wdmg', mult: 1.3 }], sfx: 'whirl', desc: 'Spin with your axe, hitting every enemy around you.' },
    savageblows: { name: 'Savage Blows', icon: '💥', cd: 14, range: 'melee', target: 'enemy', effects: [{ t: 'multi', n: 3, mult: 0.9 }], sfx: 'slash', desc: 'Three brutal strikes in a row.' },
    deathwish: { name: 'Death Wish', icon: '☠', cd: 120, target: 'self', effects: [{ t: 'buff', name: 'Death Wish', mods: { dmgMul: 0.35, dmgTaken: 0.15 }, dur: 20 }], sfx: 'rage', desc: '+35% damage for 20 seconds, but you take 15% more damage.' },
    decapitate: { name: 'Decapitate', icon: '⚔', cd: 14, range: 'melee', target: 'enemy', effects: [{ t: 'execute', below: 0.3, mult: 1.8, bonus: 2.5 }], sfx: 'slash', desc: 'Huge damage to enemies under 30% health.' },
    earthshatter: { name: 'Earthshatter', icon: '🌋', cd: 30, target: 'pbae', radius: 110, effects: [{ t: 'wdmg', mult: 1.8 }, { t: 'stun', dur: 1 }], sfx: 'heavy', desc: 'Smash the ground, hitting and stunning every enemy around you.' },
  };
  for (const k in XS) D.SKILLS[k] = Object.assign({ id: k }, D.SKILLS[k] || {}, XS[k]);
  D.CLASS_ACTIVES_EXTRA = {
    warrior: ['hamstrike', 'mockingblow', 'secondwind', 'wcharge', 'shieldwallw', 'whirlwind', 'overpower', 'commandshout', 'heroicstrike', 'avatar'],
    monk: ['legsweep', 'palmstrike', 'chiburst', 'pressurepoint', 'windsteps', 'cyclonekick', 'ironskin', 'fistsoffury', 'quiveringpalm', 'zenstrike'],
    rogue: ['sinister', 'gouge', 'sprint', 'eviscerate', 'bladeflurry', 'fanknives', 'kidneyshot', 'rupture', 'ambush', 'shadowdance'],
    berserker: ['bloodletter', 'intimidate', 'recklessswing', 'skullsplitter', 'enragedregen', 'bwhirl', 'savageblows', 'deathwish', 'decapitate', 'earthshatter'],
  };
  const abLine = (e) => { if (e.t !== 'buff' || !e.mods || e.line) return; const m = e.mods; if (m.haste) e.line = 'ab_haste'; else if (m.dmgMul) e.line = 'ab_dmg'; else if (m.dmgTaken < 0 || m.acMul || m.ac) e.line = 'ab_def'; };
  for (const id in D.SKILLS) (D.SKILLS[id].effects || []).forEach(abLine);
  for (const wt in D.WEAPON_ABILITIES) for (const ab of D.WEAPON_ABILITIES[wt]) (ab.effects || []).forEach(abLine);
  for (const cls in D.CLASS_ACTIVES) {
    const C = D.CLASSES[cls]; if (!C) continue;
    const passives = C.skills.filter(([id]) => D.SKILLS[id] && D.SKILLS[id].passive);
    let passives2 = passives;
    if (cls === 'rogue') passives2 = passives.map(([id, l]) => [id, id === 'dualwield' ? 1 : l]); // rogues fight with two daggers from the start
    C.skills = D.CLASS_ACTIVES[cls].map((id, i) => [id, D.ACTIVE_LEVELS[i]]).concat((D.CLASS_ACTIVES_EXTRA[cls] || []).map((id, i) => [id, D.EXTRA_ACTIVE_LEVELS[i]])).sort((a, b) => a[1] - b[1]).concat(passives2);
  }


  // ---------- Weapon abilities (unlock with weapon skill) ----------
  D.WEAPON_UNLOCKS = [1, 70, 160]; // three techniques per weapon (D.WEAPON_KEEP below): from the start, around level 5 and around 12
  D.WEAPON_ABILITIES = {
    SHIELD: [
      { name: 'Shield Bash', icon: '🛡', cd: 12, desc: 'Slam your shield into the enemy, stunning it.', effects: [{ t: 'hit', amt: [5, 1.3] }, { t: 'stun', dur: 1.5 }] },
      { name: 'Shield Wall', icon: '🧱', cd: 40, target: 'self', desc: 'Brace behind your shield.', effects: [{ t: 'buff', name: 'Shield Wall', mods: { acMul: 0.5, dmgTaken: -0.2 }, dur: 10 }] },
      { name: 'Shield Slam', icon: '💥', cd: 15, desc: 'A crushing blow that draws the enemy\'s anger.', effects: [{ t: 'hit', amt: [9, 2.0] }, { t: 'taunt' }] },
      { name: 'Spiked Bulwark', icon: '🌵', cd: 45, target: 'self', desc: 'Spikes burst from your shield, hurting anyone who strikes you.', effects: [{ t: 'buff', name: 'Spiked Bulwark', mods: { ds: 25, dmgTaken: -0.1 }, dur: 20 }] },
      { name: 'Bulwark of Kings', icon: '👑', cd: 120, target: 'self', desc: 'An unbreakable stance. You shrug off most damage for a short time.', effects: [{ t: 'buff', name: 'Bulwark of Kings', mods: { dmgTaken: -0.4, acMul: 0.3 }, dur: 12 }] },
      { name: 'Shield Charge', icon: '🐂', cd: 25, range: 220, desc: 'Charge into the enemy behind your shield.', effects: [{ t: 'lunge' }, { t: 'hit', amt: [10, 2.4] }, { t: 'stun', dur: 1.5 }] },
      { name: 'Reflective Aegis', icon: '🪞', cd: 90, target: 'self', desc: 'Your shield gleams, turning blows back on attackers.', effects: [{ t: 'buff', name: 'Reflective Aegis', mods: { ds: 45, dmgTaken: -0.25 }, dur: 15 }] },
      { name: 'Rampart', icon: '🏰', cd: 60, target: 'self', desc: 'Plant your feet behind your shield: +60 armor and less damage taken for 30s.', effects: [{ t: 'buff', name: 'Rampart', mods: { ac: 60, dmgTaken: -0.15 }, dur: 30 }] },
      { name: 'Concussive Rim', icon: '💫', cd: 20, desc: 'Strike with the shield\'s edge, stunning the enemy for 2 seconds.', effects: [{ t: 'hit', amt: [12, 2.6] }, { t: 'stun', dur: 2 }] },
      { name: 'Aegis of Valor', icon: '✨', cd: 300, target: 'self', desc: 'For 4 seconds nothing can harm you.', effects: [{ t: 'buff', name: 'Aegis of Valor', mods: { invuln: 1 }, dur: 4 }] },
    ],
    '1HS': [
      { name: 'Rending Slash', icon: '🗡', cd: 8, effects: [{ t: 'wdmg', mult: 1.3 }, { t: 'dot', amt: [2, 0.8], dur: 6 }] },
      { name: 'Flurry', icon: '⚔', cd: 12, effects: [{ t: 'multi', n: 3, mult: 0.62 }] },
      { name: 'Disarming Cut', icon: '✂', cd: 20, effects: [{ t: 'wdmg', mult: 1.0 }, { t: 'stun', dur: 2 }] },
      { name: 'Blade Dance', icon: '🌀', cd: 15, target: 'pbae', radius: 90, effects: [{ t: 'wdmg', mult: 0.95 }] },
      { name: 'Crimson Arc', icon: '🌙', cd: 25, effects: [{ t: 'wdmg', mult: 2.9 }] },
      { name: 'Riposte', icon: '🤺', cd: 14, effects: [{ t: 'wdmg', mult: 1.6 }, { t: 'selfbuff', name: 'Riposte', mods: { acMul: 0.2 }, dur: 6 }] },
      { name: 'Kingsblade Flurry', icon: '👑', cd: 32, effects: [{ t: 'multi', n: 5, mult: 0.72 }] },
      { name: 'Lunging Thrust', icon: '🤺', cd: 18, range: 200, desc: 'Close the distance with a lunge and a deep thrust.', effects: [{ t: 'lunge' }, { t: 'wdmg', mult: 1.6 }] },
      { name: 'Steel Tempest', icon: '🌪', cd: 22, target: 'pbae', radius: 100, desc: 'A storm of blade strikes around you.', effects: [{ t: 'wdmg', mult: 1.2 }] },
      { name: 'Duelist\'s Grace', icon: '🎭', cd: 60, target: 'self', desc: 'Attack 25% faster for 15 seconds.', effects: [{ t: 'buff', name: 'Duelist\'s Grace', mods: { haste: 0.25 }, dur: 15 }] },
    ],
    '2HS': [
      { name: 'Cleave', icon: '🪓', cd: 8, target: 'pbae', radius: 75, effects: [{ t: 'wdmg', mult: 1.15 }] },
      { name: 'Sunder', icon: '💥', cd: 15, effects: [{ t: 'wdmg', mult: 1.0 }, { t: 'debuff', mods: { acMul: -0.25 }, dur: 20, name: 'Sundered' }] },
      { name: 'Whirlwind', icon: '🌪', cd: 18, target: 'pbae', radius: 105, effects: [{ t: 'wdmg', mult: 1.45 }] },
      { name: 'Execute', icon: '⚰', cd: 15, effects: [{ t: 'execute', mult: 1.4, below: 0.25, bonus: 3.0 }] },
      { name: "Titan's Reach", icon: '🗿', cd: 30, effects: [{ t: 'wdmg', mult: 3.0 }, { t: 'stun', dur: 1 }] },
      { name: 'Bloodletter', icon: '🩸', cd: 12, effects: [{ t: 'wdmg', mult: 1.5 }, { t: 'dot', amt: [4, 1.5], dur: 9 }] },
      { name: 'Earthsplitter', icon: '⛰', cd: 36, target: 'pbae', radius: 125, effects: [{ t: 'wdmg', mult: 1.8 }, { t: 'stun', dur: 1 }] },
      { name: 'Overpower', icon: '💢', cd: 20, desc: 'A massive blow that staggers the enemy.', effects: [{ t: 'wdmg', mult: 2.4 }, { t: 'stun', dur: 1 }] },
      { name: 'Wrath of the Fallen', icon: '🔥', cd: 90, target: 'self', desc: '+30% damage for 15 seconds.', effects: [{ t: 'buff', name: 'Wrath of the Fallen', mods: { dmgMul: 0.3 }, dur: 15 }] },
      { name: 'Doomblade', icon: '⚰', cd: 45, desc: 'A finishing strike, devastating on badly wounded enemies.', effects: [{ t: 'execute', mult: 2.0, below: 0.25, bonus: 2.6 }] },
    ],
    '1HB': [
      { name: 'Concuss', icon: '🔨', cd: 12, effects: [{ t: 'wdmg', mult: 1.0 }, { t: 'stun', dur: 1.5 }] },
      { name: 'Crack Armor', icon: '🛡', cd: 15, effects: [{ t: 'wdmg', mult: 1.1 }, { t: 'debuff', mods: { acMul: -0.2 }, dur: 20, name: 'Cracked Armor' }] },
      { name: 'Hammer Toss', icon: '🎯', cd: 12, range: 320, effects: [{ t: 'wdmg', mult: 1.6, ranged: true }] },
      { name: 'Shield Breaker', icon: '💢', cd: 20, effects: [{ t: 'wdmg', mult: 1.8 }, { t: 'debuff', mods: { slow: 0.2 }, dur: 15, name: 'Battered' }] },
      { name: 'Judgment', icon: '⚖', cd: 30, effects: [{ t: 'wdmg', mult: 2.6 }, { t: 'selfhealpct', pct: 0.1 }] },
      { name: 'Skullcracker', icon: '💀', cd: 20, effects: [{ t: 'wdmg', mult: 1.5 }, { t: 'stun', dur: 2 }] },
      { name: 'Hammer of Justice', icon: '⚖', cd: 32, effects: [{ t: 'wdmg', mult: 2.8 }, { t: 'debuff', name: 'Judged', mods: { dmgMul: -0.15 }, dur: 12 }] },
      { name: 'Thunderclap', icon: '⚡', cd: 25, target: 'pbae', radius: 100, desc: 'Strike the ground: damage and a short stun to every enemy near you.', effects: [{ t: 'hit', amt: [8, 2.2] }, { t: 'stun', dur: 1 }] },
      { name: 'Ringing Blow', icon: '🔔', cd: 16, desc: 'Dent the enemy\'s armor, lowering it by 20%.', effects: [{ t: 'wdmg', mult: 1.5 }, { t: 'debuff', name: 'Dented Armor', mods: { acMul: -0.2 }, dur: 15 }] },
      { name: 'Mace of Ages', icon: '🏛', cd: 40, desc: 'A crushing strike of triple weapon damage.', effects: [{ t: 'wdmg', mult: 3.0 }] },
    ],
    '2HB': [
      { name: 'Ground Slam', icon: '🌋', cd: 12, target: 'pbae', radius: 85, effects: [{ t: 'wdmg', mult: 0.9 }, { t: 'stun', dur: 1 }] },
      { name: 'Crushing Blow', icon: '🔨', cd: 10, effects: [{ t: 'wdmg', mult: 1.8 }] },
      { name: 'Earthshaker', icon: '🌍', cd: 20, target: 'pbae', radius: 125, effects: [{ t: 'wdmg', mult: 1.3 }, { t: 'snare', pct: 0.5, dur: 8 }] },
      { name: 'Maul', icon: '💥', cd: 14, effects: [{ t: 'multi', n: 2, mult: 1.2 }] },
      { name: 'Worldbreaker', icon: '☄', cd: 40, target: 'pbae', radius: 145, effects: [{ t: 'wdmg', mult: 2.4 }, { t: 'stun', dur: 2 }] },
      { name: 'Seismic Slam', icon: '🌋', cd: 22, target: 'pbae', radius: 110, effects: [{ t: 'wdmg', mult: 1.4 }, { t: 'snare', pct: 0.4, dur: 8 }] },
      { name: "Titan's Toll", icon: '🔔', cd: 40, effects: [{ t: 'wdmg', mult: 3.2 }, { t: 'stun', dur: 1.5 }] },
      { name: 'Pulverize', icon: '🪨', cd: 18, desc: 'Smash the enemy, stunning it.', effects: [{ t: 'wdmg', mult: 2.2 }, { t: 'stun', dur: 1.5 }] },
      { name: 'Staggering Swing', icon: '🐢', cd: 14, desc: 'A heavy blow that slows the enemy\'s movement by half.', effects: [{ t: 'wdmg', mult: 1.6 }, { t: 'snare', pct: 0.5, dur: 8 }] },
      { name: 'Cataclysm', icon: '🌋', cd: 60, target: 'pbae', radius: 130, desc: 'Shatter the earth around you.', effects: [{ t: 'wdmg', mult: 2.6 }] },
    ],
    '1HP': [
      { name: 'Puncture', icon: '📍', cd: 8, effects: [{ t: 'wdmg', mult: 1.0 }, { t: 'dot', amt: [2, 1.0], dur: 9 }] },
      { name: 'Lunge', icon: '➶', cd: 12, range: 260, effects: [{ t: 'lunge' }, { t: 'wdmg', mult: 1.4 }] },
      { name: 'Cripple', icon: '🦵', cd: 15, effects: [{ t: 'wdmg', mult: 0.9 }, { t: 'snare', pct: 0.5, dur: 10 }] },
      { name: 'Vital Strike', icon: '❣', cd: 16, effects: [{ t: 'wdmg', mult: 2.2, crit: true }] },
      { name: 'Thousand Cuts', icon: '✴', cd: 30, effects: [{ t: 'multi', n: 6, mult: 0.62 }] },
      { name: 'Puncture Artery', icon: '💉', cd: 15, effects: [{ t: 'wdmg', mult: 1.2 }, { t: 'dot', amt: [6, 2.0], dur: 12 }] },
      { name: 'Shadowstrike', icon: '🌘', cd: 30, effects: [{ t: 'wdmg', mult: 2.8, backMult: 1.5 }] },
      { name: 'Kidney Shot', icon: '🎯', cd: 25, desc: 'A precise jab that stuns for 2 seconds.', effects: [{ t: 'wdmg', mult: 1.2 }, { t: 'stun', dur: 2 }] },
      { name: 'Fan of Steel', icon: '✳', cd: 20, target: 'pbae', radius: 90, desc: 'Slash every enemy around you.', effects: [{ t: 'wdmg', mult: 1.0 }] },
      { name: 'Assassin\'s Mark', icon: '☠', cd: 45, desc: 'A lethal strike that also bleeds, far stronger from behind.', effects: [{ t: 'wdmg', mult: 2.6, backMult: 1.8 }, { t: 'dot', amt: [5, 1.8], dur: 12 }] },
    ],
    'H2H': [
      { name: 'Jab Combo', icon: '👊', cd: 6, effects: [{ t: 'multi', n: 2, mult: 0.75 }] },
      { name: 'Palm Strike', icon: '🖐', cd: 10, effects: [{ t: 'wdmg', mult: 1.5 }] },
      { name: 'Leg Sweep', icon: '🦵', cd: 18, effects: [{ t: 'wdmg', mult: 0.8 }, { t: 'stun', dur: 2 }] },
      { name: 'Dragon Fist', icon: '🐲', cd: 16, effects: [{ t: 'wdmg', mult: 2.4 }] },
      { name: 'Hundred Fists', icon: '✊', cd: 35, effects: [{ t: 'multi', n: 8, mult: 0.5 }] },
      { name: 'Tiger Rake', icon: '👊', cd: 25, effects: [{ t: 'multi', n: 6, mult: 0.55 }] },
      { name: 'Thunderous Palm', icon: '🖐', cd: 30, effects: [{ t: 'hit', amt: [12, 4.2] }, { t: 'stun', dur: 2 }] },
      { name: 'Crane Kick', icon: '🦩', cd: 14, desc: 'A high, precise kick.', effects: [{ t: 'hit', amt: [12, 3.2] }] },
      { name: 'Whirling Kick', icon: '🌀', cd: 20, target: 'pbae', radius: 100, desc: 'A spinning kick that strikes all around you.', effects: [{ t: 'hit', amt: [9, 2.5] }] },
      { name: 'Iron Body', icon: '🗿', cd: 75, target: 'self', desc: 'Harden your body: take 25% less damage for 15 seconds.', effects: [{ t: 'buff', name: 'Iron Body', mods: { dmgTaken: -0.25, acMul: 0.3 }, dur: 15 }] },
    ],
    'ARC': [
      { name: 'Aimed Shot', icon: '🏹', cd: 8, ranged: true, effects: [{ t: 'rdmg', mult: 1.6 }] },
      { name: 'Pinning Arrow', icon: '📌', cd: 18, ranged: true, effects: [{ t: 'rdmg', mult: 1.0 }, { t: 'root', dur: 6 }] },
      { name: 'Multishot', icon: '🎯', cd: 14, ranged: true, effects: [{ t: 'rmulti', n: 3, mult: 1.0 }] },
      { name: 'Rain of Arrows', icon: '🌧', cd: 22, ranged: true, target: 'tae', radius: 115, effects: [{ t: 'rdmg', mult: 1.2 }] },
      { name: 'Heartseeker', icon: '💘', cd: 28, ranged: true, effects: [{ t: 'rdmg', mult: 3.2 }] },
      { name: 'Hail of Arrows', icon: '☔', cd: 30, ranged: true, effects: [{ t: 'rmulti', n: 5, mult: 0.85 }] },
      { name: 'Dragonslayer Shot', icon: '🐲', cd: 45, ranged: true, effects: [{ t: 'rdmg', mult: 4.0, crit: true }] },
      { name: 'Snipe', icon: '🎯', cd: 25, ranged: true, desc: 'A carefully aimed long shot for heavy damage.', effects: [{ t: 'rdmg', mult: 2.6 }] },
      { name: 'Volley of Thorns', icon: '🌧', cd: 30, ranged: true, target: 'tae', radius: 120, desc: 'Arrows rain down around your target.', effects: [{ t: 'rdmg', mult: 1.4 }] },
      { name: 'Eagle\'s Eye', icon: '🦅', cd: 90, target: 'self', desc: '+40% ranged damage for 20 seconds.', effects: [{ t: 'buff', name: 'Eagle\'s Eye', mods: { rangedMul: 0.4 }, dur: 20 }] },
    ],
    'GUN': [
      { name: 'Snap Shot', icon: '💥', cd: 8, ranged: true, effects: [{ t: 'rdmg', mult: 1.5 }] },
      { name: 'Hobbling Shot', icon: '🦵', cd: 18, ranged: true, effects: [{ t: 'rdmg', mult: 1.0 }, { t: 'snare', pct: 0.5, dur: 8 }] },
      { name: 'Double Load', icon: '🎯', cd: 16, ranged: true, effects: [{ t: 'rmulti', n: 2, mult: 1.0, same: true }] },
      { name: 'Point Blank', icon: '💥', cd: 20, ranged: true, effects: [{ t: 'rdmg', mult: 2.4 }] },
      { name: 'Grapeshot', icon: '🌧', cd: 24, ranged: true, target: 'tae', radius: 110, effects: [{ t: 'rdmg', mult: 1.2 }] },
      { name: 'Deadeye', icon: '👁', cd: 30, ranged: true, effects: [{ t: 'rdmg', mult: 3.0 }] },
      { name: 'Thunderclap Round', icon: '⚡', cd: 45, ranged: true, effects: [{ t: 'rdmg', mult: 3.6, crit: true }, { t: 'stun', dur: 1.5 }] },
    ],
    'THR': [
      { name: 'Quick Toss', icon: '🔪', cd: 6, ranged: true, effects: [{ t: 'rdmg', mult: 1.4 }] },
      { name: 'Hamstring Throw', icon: '🦵', cd: 14, ranged: true, effects: [{ t: 'rdmg', mult: 0.9 }, { t: 'snare', pct: 0.5, dur: 10 }] },
      { name: 'Ricochet', icon: '↯', cd: 14, ranged: true, effects: [{ t: 'rmulti', n: 3, mult: 0.9 }] },
      { name: 'Fan of Knives', icon: '✳', cd: 20, ranged: true, target: 'pbae', radius: 115, effects: [{ t: 'rdmg', mult: 1.1 }] },
      { name: 'Deathmark', icon: '☠', cd: 26, ranged: true, effects: [{ t: 'rdmg', mult: 2.0 }, { t: 'dot', amt: [4, 1.6], dur: 12 }] },
      { name: 'Whirling Blades', icon: '🌀', cd: 24, ranged: true, effects: [{ t: 'rmulti', n: 4, mult: 0.9 }] },
      { name: "Executioner's Throw", icon: '🪓', cd: 40, ranged: true, effects: [{ t: 'rdmg', mult: 3.0 }, { t: 'stun', dur: 1 }] },
      { name: 'Blade Storm', icon: '🌪', cd: 28, ranged: true, desc: 'Five blades in quick succession.', effects: [{ t: 'rmulti', n: 5, mult: 0.7, same: true }] },
      { name: 'Crippling Toss', icon: '🦵', cd: 14, ranged: true, desc: 'A throw at the legs that halves the target\'s speed.', effects: [{ t: 'rdmg', mult: 1.2 }, { t: 'snare', pct: 0.5, dur: 10 }] },
      { name: 'Throat Shot', icon: '🗡', cd: 30, ranged: true, desc: 'A throw at the throat that stuns briefly.', effects: [{ t: 'rdmg', mult: 1.8 }, { t: 'stun', dur: 1.5 }] },
    ],
    'TOME': [
      { name: 'Arcane Volley', icon: '📘', cd: 8, ranged: true, effects: [{ t: 'rdmg', mult: 1.5 }] },
      { name: 'Mana Siphon', icon: '💧', cd: 20, ranged: true, effects: [{ t: 'rdmg', mult: 1.0 }, { t: 'mana', pct: 0.06 }] },
      { name: 'Runic Ward', icon: '🔷', cd: 45, target: 'self', effects: [{ t: 'rune', amt: [20, 9], dur: 60 }] },
      { name: 'Glyph Burst', icon: '✨', cd: 22, ranged: true, target: 'tae', radius: 110, effects: [{ t: 'rdmg', mult: 1.3 }] },
      { name: 'Astral Barrage', icon: '🌠', cd: 30, ranged: true, effects: [{ t: 'rmulti', n: 5, mult: 0.7, same: true }] },
      { name: 'Sigil of Warding', icon: '🛡', cd: 60, target: 'self', effects: [{ t: 'buff', name: 'Sigil of Warding', mods: { dmgTaken: -0.2, manaRegen: 2 }, dur: 20 }] },
      { name: 'Starfall Codex', icon: '☄', cd: 45, ranged: true, target: 'tae', radius: 130, effects: [{ t: 'rdmg', mult: 2.2 }] },
      { name: 'Mind Lance', icon: '🔱', cd: 18, ranged: true, desc: 'A lance of pure thought.', effects: [{ t: 'rdmg', mult: 2.2 }] },
      { name: 'Ward of Ages', icon: '🔰', cd: 90, target: 'self', desc: 'A runic ward absorbs damage for a minute.', effects: [{ t: 'rune', amt: [40, 14], dur: 60 }] },
      { name: 'Arcane Cataclysm', icon: '☄', cd: 60, ranged: true, target: 'tae', radius: 140, desc: 'Arcane fire engulfs everything near your target.', effects: [{ t: 'rdmg', mult: 2.6 }] },
    ],
  };
  // three techniques per weapon type, kept from the old ten (old hotbars remap through D.WEAPON_KEEP)
  D.WEAPON_KEEP = [0, 3, 6];
  for (const wt in D.WEAPON_ABILITIES) D.WEAPON_ABILITIES[wt] = D.WEAPON_KEEP.map((i) => D.WEAPON_ABILITIES[wt][i]).filter(Boolean);

  // ---------- Spells (generated from class spell lines) ----------
  // line: [type, school, resist, names[], start?]
  const L = (t, s, r, names, start, levels) => ({ t, s, r, names, start, levels });
  const LS = (stat, names, start) => ({ t: 'stat', s: 'Song', r: null, names, start, stat });
  const SPELL_LINES = {
    cleric: [
      L('heal', 'Alteration', null, ['Minor Healing', 'Light Healing', 'Healing', 'Greater Healing', 'Superior Healing', 'Divine Mending', 'Celestial Restoration', 'Complete Healing']),
      L('nuke', 'Evocation', 'magic', ['Strike', 'Holy Smite', 'Wrath of Dawn', 'Retribution', 'Judgment of Light', 'Sound of Divinity']),
      L('buff_ac', 'Abjuration', null, ['Courage', 'Center', 'Bravery', 'Valor', 'Resolution', 'Heroism', 'Aegis of Faith']),
      L('hot', 'Alteration', null, ['Gentle Renewal', 'Renewal', 'Celestial Remedy', 'Ethereal Renewal', 'Pious Elixir']),
      L('undead', 'Evocation', 'magic', ['Ward Undead', 'Expel Undead', 'Exile the Dead', 'Banish the Damned']),
      L('stun', 'Evocation', 'magic', ['Stun', 'Holy Might', 'Sacred Thunder']),
      L('rune', 'Abjuration', null, ['Divine Barrier', 'Shield of Words', 'Bulwark of Faith']),
      L('root', 'Alteration', 'magic', ['Holy Bonds', 'Chains of Light']),
      L('pbae', 'Evocation', 'magic', ['Word of Pain', 'Word of Shadow', 'Word of Spirit', 'Word of Redemption']),
      L('dmgbuff', 'Alteration', null, ['Battle Prayer', 'Zealous Hymn', 'Righteous Fury']),
      L('buff_hp', 'Abjuration', null, ['Symbol of Faith', 'Symbol of Light', 'Symbol of Dawn', 'Symbol of the Exalted']),
      L('gate', 'Divination', null, ['Gate']),
      L('bind', 'Divination', null, ['Bind Affinity']),
      L('heal', 'Alteration', null, ['Remedy', 'Ethereal Light', 'Supernal Remedy', 'Holy Light', 'Divine Light'], 14),
      L('buff_hp', 'Abjuration', null, ['Blessing of Temperance', 'Blessing of Aegolism', 'Hand of Virtue', 'Conviction'], 20),
      L('nuke', 'Evocation', 'magic', ['Smite of the Faithful', 'Order', 'Condemnation', 'Reproach'], 18),
      L('stun', 'Evocation', 'magic', ['Tarnation', 'Sound of Force', 'Shock of Wonder'], 22),
      L('hot', 'Alteration', null, ['Pious Remedy', 'Spiritual Serenity', 'Holy Elixir'], 30),
      L('rune', 'Abjuration', null, ['Armor of the Faithful', 'Shield of the Pious', 'Aura of Devotion'], 26),
      L('undead', 'Evocation', 'magic', ['Destroy Undead', 'Annihilate the Unnatural'], 36),
      L('regen', 'Alteration', null, ['Aura of Renewal', 'Celestial Healing'], 24),
    ],
    druid: [
      L('nuke', 'Evocation', 'fire', ['Burst of Fire', 'Ignite', 'Combust', 'Firestrike', 'Starfire', 'Sunflare', 'Wildfire Blaze']),
      L('heal', 'Alteration', null, ['Minor Mending', 'Light Mending', "Nature's Touch", 'Healing Waters', 'Greater Mending', 'Verdant Surge', "Nature's Renewal"]),
      L('dot', 'Conjuration', 'fire', ['Flame Lick', 'Searing Ember', 'Immolate', 'Sunscorch', 'Vengeance of Flame']),
      L('buff_ac', 'Abjuration', null, ['Skin like Wood', 'Skin like Rock', 'Skin like Steel', 'Skin like Diamond', 'Bark of the Ancients']),
      L('ds', 'Abjuration', null, ['Shield of Thistles', 'Shield of Barbs', 'Shield of Brambles', 'Shield of Spikes', 'Shield of Thorns']),
      L('nuke', 'Evocation', 'cold', ['Frost Nip', "Winter's Bite", 'Glacier Breath', 'Moonfrost'], 6),
      L('root', 'Alteration', 'magic', ['Snare Root', 'Grasping Roots', 'Ensnaring Vines', 'Entangling Earth']),
      L('snare', 'Alteration', 'magic', ['Tangling Weeds', 'Ensnare', 'Mire Bind']),
      L('regen', 'Alteration', null, ['Rejuvenation', 'Regeneration', 'Verdant Regrowth', "Nature's Bloom"]),
      L('tae', 'Evocation', 'magic', ['Hail Storm', 'Lightning Storm', 'Earthquake', 'Tempest of the Wild']),
      L('sow', 'Alteration', null, ['Spirit of Wolf', 'Spirit of the Stag']),
      L('hot', 'Alteration', null, ['Sprouting Vigor', 'Woodland Regrowth']),
      L('gate', 'Divination', null, ['Gate']),
      L('bind', 'Divination', null, ['Bind Affinity']),
      L('nuke', 'Evocation', 'fire', ['Scoriae', 'Firestrike Breath', 'Wildfire', "Summer's Flame"], 20),
      L('dot', 'Conjuration', 'fire', ['Breath of Ro', 'Drifting Death', 'Winged Death', 'Swarm of Pain'], 14),
      L('buff_hp', 'Abjuration', null, ['Protection of the Glades', 'Protection of Wood', 'Protection of Seasons', 'Blessing of Nature'], 12),
      L('heal', 'Alteration', null, ['Superior Mending', 'Chloroblast', "Nature's Infusion"], 28),
      L('ds', 'Abjuration', null, ['Legacy of Spike', 'Legacy of Thorn', 'Legacy of Bracken'], 30),
      L('buff_stat', 'Alteration', null, ['Strength of Earth', 'Strength of Stone', 'Storm Strength'], 10),
      L('tae', 'Evocation', 'cold', ['Avalanche', "Winter's Wrath"], 34),
      L('snare', 'Alteration', 'magic', ['Ensnaring Roots', 'Earthen Embrace'], 24),
      L('regen', 'Alteration', null, ['Pack Regeneration'], 32),
    ],
    shaman: [
      L('nuke', 'Evocation', 'cold', ['Frost Rift', 'Spirit Strike', 'Frost Strike', 'Ice Strike', 'Blizzard Blast', "Winter's Storm"]),
      L('dot', 'Conjuration', 'poison', ['Sicken', 'Tainted Breath', 'Envenomed Breath', 'Venom of the Snake', 'Scourge', 'Bane of Plague']),
      L('heal', 'Alteration', null, ['Minor Healing', 'Light Healing', 'Healing', 'Greater Healing', 'Spiritual Healing', 'Ancestral Mending']),
      L('slow', 'Alteration', 'magic', ['Drowsy', 'Walking Sleep', 'Swarm of Gnats', 'Turgid Torpor', 'Cripple of the Ancestors']),
      L('buff_stat', 'Alteration', null, ['Strengthen', 'Spirit Strength', 'Raging Strength', 'Furious Strength', 'Strength of the Ancients']),
      L('buff_ac', 'Abjuration', null, ['Scale Skin', 'Turtle Skin', 'Shifting Shield', 'Protect', 'Guardian of the Ancients']),
      L('haste', 'Alteration', null, ['Quickness', 'Alacrity', 'Celerity', 'Swift Like the Wind']),
      L('dot', 'Conjuration', 'disease', ['Infectious Cloud', 'Affliction', 'Plague of the Ancestors'], 10),
      L('pet', 'Conjuration', null, ['Spirit Companion', 'Ancestral Wolf', 'Spectral Warder'], 18),
      L('hot', 'Alteration', null, ['Ancestral Breath', 'Spirit Renewal']),
      L('regen', 'Alteration', null, ['Ancestral Regeneration', 'Spirit of the Bear']),
      L('sow', 'Alteration', null, ['Spirit of Wolf']),
      L('root', 'Alteration', 'magic', ['Root of the Earth']),
      L('gate', 'Divination', null, ['Gate']),
      L('bind', 'Divination', null, ['Bind Affinity']),
      L('heal', 'Alteration', null, ['Superior Healing', 'Chloroblast', "Kragg's Mending", 'Spiritual Purity'], 24),
      L('buff_stat', 'Alteration', null, ['Dexterous Aura', 'Rising Dexterity', 'Deftness', 'Agility of the Wrulan'], 10),
      L('buff_hp', 'Abjuration', null, ['Inner Fire', 'Talisman of Tnarg', 'Talisman of Altuna', 'Talisman of Kragg', 'Focus of Spirit'], 5),
      L('nuke', 'Evocation', 'cold', ['Velium Strike', 'Ice Shards of the North', 'Glacier Breath'], 30),
      L('dot', 'Conjuration', 'poison', ['Envenomed Bolt', 'Blood of Saryrn', 'Spear of Torment'], 28),
      L('slow', 'Alteration', 'magic', ["Togor's Insects", 'Balance of the Nihil'], 38),
      L('haste', 'Alteration', null, ['Talisman of Celerity', 'Swift Like the Spirits'], 40),
      L('hot', 'Alteration', null, ['Quiescence'], 36),
      L('pethl', 'Alteration', null, ['Spirit Mend'], 20),
      L('rune', 'Abjuration', null, ['Talisman of the Rhino'], 33),
    ],
    necromancer: [
      L('tap', 'Alteration', 'magic', ['Lifetap', 'Lifespike', 'Life Leech', 'Draining Touch', 'Soul Siphon', 'Vampiric Embrace', 'Touch of Night']),
      L('pet', 'Conjuration', null, ['Cavorting Bones', 'Leering Corpse', 'Bone Walk', 'Convoke Shadow', 'Restless Bones', 'Animate Dead', 'Haunting Corpse', 'Dark Assassin', 'Lost Soul', 'Grave Knight', 'Legion of the Damned'], 1, [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50]),
      L('dot', 'Conjuration', 'poison', ['Poison Bolt', 'Shadow Venom', 'Blood Venom', 'Viper Kiss', 'Venom of the Damned']),
      L('dot', 'Conjuration', 'fire', ['Heat Blood', 'Boil Blood', 'Ignite Blood', 'Pyre of Bones', 'Funeral Pyre'], 6),
      L('dot', 'Conjuration', 'disease', ['Disease Cloud', 'Rotting Flesh', 'Plague', 'Scourge of Ages', 'Grave Pox'], 3),
      L('snare', 'Alteration', 'magic', ['Clinging Darkness', 'Engulfing Darkness', 'Dooming Darkness', 'Cascading Darkness']),
      L('fear', 'Divination', 'magic', ['Fear', 'Spook the Dead', 'Dread Gaze']),
      L('rune', 'Abjuration', null, ['Shield of Bone', 'Bone Armor', 'Arch Shielding']),
      L('clarity', 'Alteration', null, ['Dark Pact', 'Allure of Death', 'Lich Form']),
      L('pethl', 'Alteration', null, ['Mend Bones', 'Renew Bones']),
      L('nuke', 'Evocation', 'poison', ['Shock of Poison', 'Acid Blast'], 8),
      L('fd', 'Divination', null, ['Feign Death']),
      L('gate', 'Divination', null, ['Gate']),
      L('bind', 'Divination', null, ['Bind Affinity']),
      L('tap', 'Alteration', 'magic', ['Spirit Tap', 'Drain Spirit', 'Drain Soul', 'Deflux'], 18),
      L('dot', 'Conjuration', 'magic', ['Splurt', 'Ignite Bones', 'Ancient Curse', 'Torrent of Agony'], 12),
      L('dot', 'Conjuration', 'disease', ['Asystole', 'Scent of Darkness', 'Scent of Terris', 'Scent of Midnight'], 16),
      L('clarity', 'Alteration', null, ['Covenant of Spirit', 'Arch Lich'], 34),
      L('rune', 'Abjuration', null, ['Shadow Ward', 'Shield of the Arcane', 'Shield of Maelin'], 22),
      L('snare', 'Alteration', 'magic', ['Embracing Darkness', 'Devouring Darkness'], 30),
      L('fear', 'Divination', 'magic', ['Invoke Fear', 'Panic the Dead', 'Terror of Death'], 20),
      L('nuke', 'Evocation', 'poison', ['Shock of Venom', 'Venom Bolt', 'Torrent of Poison'], 18),
      L('pethaste', 'Alteration', null, ['Augment Death', 'Intensify Death'], 24),
    ],
    wizard: [
      L('nuke', 'Evocation', 'fire', ['Burst of Flame', 'Flame Shock', 'Fire Bolt', 'Inferno Shock', 'Lava Bolt', 'Sunstrike', 'Ether Flame', 'Draught of Fire']),
      L('nuke', 'Evocation', 'cold', ['Frost Bolt', 'Shock of Frost', 'Ice Spear', 'Frost Shock', 'Ice Comet', "Winter's Roar", 'Glacial Lance'], 2),
      L('nuke', 'Evocation', 'magic', ['Shock of Lightning', 'Lightning Bolt', 'Shock of Spikes', 'Thunderclap', 'Voltaic Draught', 'Sky Fury'], 4),
      L('tae', 'Evocation', 'fire', ['Fire Ring', 'Column of Frost', 'Pillar of Lightning', 'Firestorm', 'Meteor Shower', 'Cataclysm']),
      L('rune', 'Abjuration', null, ['Minor Shielding', 'Arcane Ward', 'Force Shield', 'Mystic Barrier', 'Aegis of Runes']),
      L('root', 'Alteration', 'magic', ['Root', 'Fetter', 'Paralyzing Earth', 'Iron Shackles']),
      L('lure', 'Evocation', 'fire', ['Lure of Flame', 'Lure of Frost', 'Lure of Ice', 'Lure of Thunder']),
      L('snare', 'Alteration', 'cold', ['Numbing Cold', 'Frozen Grasp', 'Chill of Ages']),
      L('stun', 'Evocation', 'magic', ['Concussive Jolt', 'Stunning Bolt', 'Thunder Strike']),
      L('clarity', 'Alteration', null, ['Mind Spark', 'Arcane Focus', 'Clarity of Flame']),
      L('gate', 'Divination', null, ['Gate']),
      L('bind', 'Divination', null, ['Bind Affinity']),
      L('nuke', 'Evocation', 'fire', ['Conflagration', "Garrison's Mighty Mana Shock", "Inferno of Al'Kabor", 'Ethereal Combustion'], 20),
      L('nuke', 'Evocation', 'cold', ['Ice Shock', 'Rime Blast', 'Frozen Harpoon', 'Ice Meteor'], 16),
      L('nuke', 'Evocation', 'magic', ['Force Strike', 'Draught of Jiva', 'Mana Weave', 'Telakemara'], 22),
      L('tae', 'Evocation', 'cold', ['Frost Storm', 'Tears of Prexus', 'Supernova'], 26),
      L('pbae', 'Evocation', 'magic', ['Thunderclap Ring', "Jyll's Static Pulse", 'Circle of Force'], 12),
      L('rune', 'Abjuration', null, ['Shield of the Magi', 'Shield of the Arcane', 'Mana Shield'], 28),
      L('snare', 'Alteration', 'cold', ["Atol's Spectral Shackles"], 36),
      L('stun', 'Evocation', 'magic', ["Tishan's Clash", "Markar's Clash"], 30),
      L('clarity', 'Alteration', null, ['Harvest', 'Shared Harvest'], 40),
    ],
    magician: [
      L('nuke', 'Evocation', 'fire', ['Burst of Flame', 'Shock of Flame', 'Bolt of Flame', 'Flame Arc', 'Scars of Sigil', 'Firebolt Barrage', "Sun's Lance", 'Inferno Bolt']),
      L('pet', 'Conjuration', null, ['Elementalkin: Earth', 'Elementaling: Fire', 'Elemental: Water', 'Minor Conjuration: Air', 'Lesser Conjuration: Earth', 'Conjuration: Fire', 'Greater Conjuration: Water', 'Vocarate: Air', 'Greater Vocation: Earth', 'Ward of Flame', 'Monster Summoning: Water', 'Servant of Storms', 'Summon Elemental Lord'], 1, [1, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48]),
      L('ds', 'Abjuration', null, ['Shield of Fire', 'Shield of Flame', 'Inferno Shield', 'Barrier of Combustion', 'Cadeau of Flame', 'Mantle of Embers']),
      L('nuke', 'Evocation', 'magic', ['Sword of Runes', 'Shock of Swords', 'Shock of Spikes', 'Bolt of Blades', 'Blade Strike'], 5),
      L('tae', 'Evocation', 'fire', ['Rain of Fire', 'Rain of Lava', 'Rain of Swords', 'Meteor Storm']),
      L('pethl', 'Alteration', null, ['Renew Elements', 'Renew Summoning', 'Elemental Mending']),
      L('pethaste', 'Alteration', null, ['Burnout', 'Elemental Fury', 'Elemental Frenzy']),
      L('rune', 'Abjuration', null, ['Minor Shielding', 'Shielding', 'Major Shielding']),
      L('resistdebuff', 'Alteration', 'magic', ['Malaise', 'Elemental Malady', 'Planar Unraveling']),
      L('root', 'Alteration', 'magic', ['Bonds of Force']),
      L('gate', 'Divination', null, ['Gate']),
      L('bind', 'Divination', null, ['Bind Affinity']),
      L('nuke', 'Evocation', 'fire', ['Lava Bolt', 'Char', 'Sun Vortex', 'Burning Sand'], 16),
      L('nuke', 'Evocation', 'magic', ['Spear of Ro', 'Blade of Walnan', 'Shock of Steel', 'Spike of Force'], 20),
      L('ds', 'Abjuration', null, ['Shield of Lava', 'Boon of Immolation', 'Maelstrom of Ro'], 28),
      L('tae', 'Evocation', 'magic', ['Rain of Blades', 'Rain of Spikes', 'Rain of Molten Lava'], 24),
      L('pethaste', 'Alteration', null, ['Elemental Empathy', 'Elemental Rage'], 32),
      L('pethl', 'Alteration', null, ['Planar Renewal', "Transon's Elemental Renewal"], 30),
      L('buff_ac', 'Abjuration', null, ['Elemental Armor', 'Elemental Shield', 'Major Elemental Armor'], 8),
      L('rune', 'Abjuration', null, ['Greater Shielding', 'Arch Shielding'], 26),
      L('resistdebuff', 'Alteration', 'magic', ['Wind of Malosi', 'Malosinia'], 36),
      L('stun', 'Evocation', 'magic', ['Bolt of Force'], 22),
    ],
    enchanter: [
      L('nuke', 'Evocation', 'magic', ['Chaotic Feedback', 'Mind Wipe', 'Chaos Flux', 'Insanity', 'Psychic Lance', 'Mind Shatter']),
      L('mez', 'Divination', 'magic', ['Mesmerize', 'Enthrall', 'Entrance', 'Dazzle', 'Glamour of Dreams', 'Rapture']),
      L('haste', 'Alteration', null, ['Quickness', 'Alacrity', 'Augmentation', 'Celerity', 'Swift Like the Wind', 'Visions of Grandeur']),
      L('rune', 'Abjuration', null, ['Minor Shielding', 'Rune I', 'Rune II', 'Rune III', 'Rune IV', 'Rune of Endless Mind']),
      L('stun', 'Alteration', 'magic', ['Color Flux', 'Color Shift', 'Color Skew', 'Color Slant', 'Spectral Shock']),
      L('slow', 'Alteration', 'magic', ['Languid Pace', 'Tepid Deeds', 'Shiftless Deeds', 'Forlorn Deeds', 'Dreary Deeds']),
      L('clarity', 'Alteration', null, ['Breeze', 'Clarity', 'Clarity II', 'Boon of the Clear Mind', 'Gift of Insight']),
      L('dot', 'Conjuration', 'magic', ['Mind Rot', 'Choke', 'Tormenting Thought', 'Gasping Embrace']),
      L('resistdebuff', 'Alteration', 'magic', ['Feeble Mind', 'Unravel Wards', 'Shatter Resolve']),
      L('pet', 'Conjuration', null, ['Animate Sword', 'Dancing Blade', 'Phantom Blade'], 8, [8, 24, 40]),
      L('root', 'Alteration', 'magic', ['Root', 'Stillness']),
      L('gate', 'Divination', null, ['Gate']),
      L('bind', 'Divination', null, ['Bind Affinity']),
      L('mez', 'Divination', 'magic', ['Fascination', 'Mesmerization', 'Bliss', 'Sleep', 'Apathy'], 10),
      L('nuke', 'Evocation', 'magic', ['Sanity Warp', 'Discordant Mind', 'Dementia', 'Psychic Shatter'], 16),
      L('dot', 'Conjuration', 'magic', ["Tashan's Lash", 'Torment of Argli', 'Thrall of Kuo'], 22),
      L('haste', 'Alteration', null, ['Swift Like the Wind II', 'Speed of the Shissar', 'Speed of Vallon'], 38),
      L('clarity', 'Alteration', null, ["Koadic's Endless Intellect", 'Voice of Clarity', 'Tranquility'], 28),
      L('rune', 'Abjuration', null, ['Rune V', 'Arcane Rune', 'Ethereal Rune'], 32),
      L('stun', 'Alteration', 'magic', ['Color Cloud', 'Color Slant II'], 26),
      L('slow', 'Alteration', 'magic', ['Desolate Deeds', 'Cripple'], 40),
      L('buff_stat', 'Alteration', null, ['Gift of Brilliance', 'Brilliance'], 14),
    ],
    paladin: [
      L('heal', 'Alteration', null, ['Salve', 'Minor Healing', 'Light Healing', 'Healing', 'Greater Healing', 'Holy Light']),
      L('buff_ac', 'Abjuration', null, ['Courage', 'Center', 'Valor', 'Armor of Faith']),
      L('stun', 'Evocation', 'magic', ['Stun', 'Holy Might', 'Force of Light'], 6),
      L('undead', 'Evocation', 'magic', ['Ward Undead', 'Expel Undead', 'Exile the Dead']),
      L('dmgbuff', 'Alteration', null, ['Yaulp', 'Divine Strength', 'Righteous Might']),
      L('hot', 'Alteration', null, ['Gentle Renewal', 'Celestial Remedy']),
      L('nuke', 'Evocation', 'magic', ['Holy Smite', 'Judgment of Light']),
      L('root', 'Alteration', 'magic', ['Holy Bonds']),
      L('rune', 'Abjuration', null, ['Divine Ward']),
      L('heal', 'Alteration', null, ['Superior Healing', 'Healing Wave of Prexus', 'Ethereal Cleansing'], 22),
      L('buff_hp', 'Abjuration', null, ['Symbol of Transal', 'Blessing of Piety', "Brell's Steadfast Aegis"], 12),
      L('stun', 'Evocation', 'magic', ['Force', 'Holy Force'], 30),
      L('undead', 'Evocation', 'magic', ['Expulse Undead', 'Destroy Undead'], 32),
      L('dmgbuff', 'Alteration', null, ['Divine Vigor', 'Valor of Marr'], 38),
      L('hot', 'Alteration', null, ['Pious Light'], 44),
    ],
    shadowknight: [
      L('tap', 'Alteration', 'magic', ['Lifetap', 'Lifespike', 'Life Leech', 'Siphon Life', 'Vampiric Strike']),
      L('dot', 'Conjuration', 'disease', ['Disease Cloud', 'Heat Blood', 'Boil Blood', 'Plague of the Night']),
      L('pet', 'Conjuration', null, ['Cavorting Bones', 'Leering Corpse', 'Restless Bones', 'Animate Dead'], 6),
      L('fear', 'Divination', 'magic', ['Fear', 'Spook the Dead', 'Dread Gaze']),
      L('snare', 'Alteration', 'magic', ['Clinging Darkness', 'Engulfing Darkness', 'Dooming Darkness']),
      L('nuke', 'Evocation', 'disease', ['Shadow Bolt', 'Spear of Disease', 'Torrent of Hate']),
      L('dmgbuff', 'Alteration', null, ['Shroud of Death', 'Shroud of Hate']),
      L('fd', 'Divination', null, ['Feign Death']),
      L('tap', 'Alteration', 'magic', ['Drain Spirit', 'Bond of Death', 'Vexing Mordinia'], 20),
      L('dot', 'Conjuration', 'disease', ['Asystole', 'Scent of Darkness', 'Spear of Plague'], 16),
      L('snare', 'Alteration', 'magic', ['Cascading Darkness'], 34),
      L('fear', 'Divination', 'magic', ['Invoke Fear', 'Terror of Shadows'], 26),
      L('pet', 'Conjuration', null, ['Summon Dead', 'Malignant Dead'], 30),
      L('rune', 'Abjuration', null, ['Shadow Vortex', 'Unholy Aura'], 22),
    ],
    ranger: [
      L('nuke', 'Evocation', 'fire', ['Burst of Fire', 'Ignite', 'Firestrike', 'Sunflare Arrow']),
      L('snare', 'Alteration', 'magic', ['Tangling Weeds', 'Ensnare', 'Snare'], 1),
      L('heal', 'Alteration', null, ['Minor Mending', 'Light Mending', 'Healing Waters']),
      L('nuke', 'Evocation', 'cold', ['Frost Nip', 'Ice Shard', 'Frozen Wind'], 8),
      L('buff_ac', 'Abjuration', null, ['Skin like Wood', 'Skin like Rock', 'Skin like Steel']),
      L('ds', 'Abjuration', null, ['Shield of Thistles', 'Shield of Brambles', 'Shield of Spikes']),
      L('dmgbuff', 'Alteration', null, ['Call of the Predator', 'Eagle Eye', "Hunter's Mark"]),
      L('root', 'Alteration', 'magic', ['Grasping Roots', 'Entangling Vines']),
      L('sow', 'Alteration', null, ['Spirit of Wolf']),
      L('nuke', 'Evocation', 'fire', ['Flaming Arrow', 'Call of Flame', 'Ember Arrow'], 14),
      L('heal', 'Alteration', null, ['Greater Mending', "Nature's Salve"], 24),
      L('buff_ac', 'Abjuration', null, ['Skin like Diamond', 'Strength of Nature'], 30),
      L('dmgbuff', 'Alteration', null, ['Mark of the Predator', 'Eyes of the Owl'], 20),
      L('snare', 'Alteration', 'cold', ['Frost Wind', 'Ensnaring Roots'], 26),
      L('ds', 'Abjuration', null, ['Shield of Thorns'], 38),
      L('regen', 'Alteration', null, ['Regeneration'], 32),
    ],
    bard: [
      L('dot', 'Song', 'fire', ['Chords of Dissonance', 'Chant of Flame', 'Chant of Frost', 'Chant of Venom', 'Discordant Wail'], 1),
      L('haste', 'Song', null, ['Anthem of Arms', 'Verses of Valor', 'Rousing Rondo', 'Battlecry Ballad'], 1),
      L('clarity', 'Song', null, ['Chorus of Clarity', 'Elegy of Insight', 'Hymn of the Clear Mind']),
      L('regen', 'Song', null, ['Hymn of Restoration', 'Cantata of Soothing', 'Psalm of Renewal']),
      L('buff_ac', 'Song', null, ['Psalm of Warmth', 'Psalm of Vitality', 'Psalm of Dragons']),
      L('mez', 'Song', 'magic', ['Lullaby', 'Lullaby of Dreams', 'Song of Slumber']),
      L('slow', 'Song', 'magic', ['Consonant Chain', 'Melodic Binding']),
      L('sow', 'Song', null, ["Selo's Accelerando", "Selo's Song of Travel"]),
      L('dot', 'Song', 'fire', ["Fufil's Curtailing Chant", "Tuyen's Chant of Flame", "Tuyen's Chant of Frost"], 12),
      L('haste', 'Song', null, ["Vilia's Verses of Celerity", 'Melody of Ervaj', "McVaxius' Rousing Rondo"], 10),
      L('dmgbuff', 'Song', null, ["Jonthan's Whistling Warsong", "Jonthan's Provocation"], 16),
      L('clarity', 'Song', null, ["Cassindra's Chorus of Clarity", "Cassindra's Insipid Ditty"], 18),
      L('buff_ac', 'Song', null, ['Guardian Rhythms', 'Psalm of Purity'], 24),
      L('mez', 'Song', 'magic', ["Kelin's Lucid Lullaby"], 26),
      L('dot', 'Song', 'poison', ["Tuyen's Chant of Poison", "Tuyen's Chant of Disease", "Fufil's Diminishing Dirge"], 6),
      L('pbae', 'Song', 'magic', ["Denon's Disruptive Discord", "Denon's Desperate Dirge", "Selo's Chords of Cessation"], 8),
      L('buff_hp', 'Song', null, ['Song of the Hearth', "Niv's Harmonic", 'Psalm of Endurance'], 5),
      L('ds', 'Song', null, ['Psalm of Cooling', 'Psalm of Mystic Shielding', 'Song of the Thorn'], 7),
      L('snare', 'Song', 'magic', ["Largo's Melodic Binding", "Largo's Absonant Binding"], 4),
      L('stun', 'Song', 'magic', ["Brusco's Boastful Bellow", "Brusco's Bombastic Bellow"], 9),
      L('regen', 'Song', null, ['Aria of Asceticism'], 36),
      L('rune', 'Song', null, ['Shield of Songs', 'Aria of the Bulwark'], 20),
      L('fear', 'Song', 'magic', ["Angstlich's Appalling Screech"], 14),
      LS('STR', ['Chant of Strength', 'Anthem of the Mighty'], 3),
      LS('DEX', ["Dirge of Deftness", "Nimble Fingers Reel"], 6),
      LS('AGI', ['Aria of Agility', "Agilmente's Aria of Eagles"], 9),
      LS('STA', ['Hymn of Endurance', 'Ballad of the Unbroken'], 12),
      LS('INT', ['Cantata of the Scholar', 'Ode to the Arcane'], 15),
      LS('WIS', ['Psalm of Wisdom', 'Hymn of the Sages'], 18),
      LS('CHA', ['Serenade of Charm', "Kelin's Golden Voice"], 21),
      L('charm', 'Song', 'magic', ["Solon's Song of the Sirens", "Solon's Bewitching Bravura", 'Voice of the Sirens'], 10),
    ],
    beastlord: [
      L('pet', 'Conjuration', null, ['Spirit of the Lynx', 'Spirit of the Bear', 'Spirit of the Wolf', 'Spirit of the Tiger', 'Spirit of the Wyvern'], 1),
      L('heal', 'Alteration', null, ['Salve', 'Minor Healing', 'Light Healing', 'Healing']),
      L('nuke', 'Evocation', 'cold', ['Blast of Frost', 'Frost Spear', 'Ice Shard Volley']),
      L('dot', 'Conjuration', 'poison', ['Sicken', 'Tainted Breath', 'Envenomed Breath']),
      L('haste', 'Alteration', null, ['Quickness', 'Alacrity', 'Celerity']),
      L('buff_stat', 'Alteration', null, ['Strengthen', 'Spiritual Strength', 'Furious Strength']),
      L('slow', 'Alteration', 'magic', ['Lethargy', 'Languor']),
      L('sow', 'Alteration', null, ['Spirit of Wolf']),
      L('pethl', 'Alteration', null, ['Mend Companion']),
      L('pet', 'Conjuration', null, ['Spirit of Kashek', 'Spirit of Omakin', 'Spirit of Zehkes'], 30),
      L('heal', 'Alteration', null, ['Greater Healing', 'Spiritual Healing'], 24),
      L('nuke', 'Evocation', 'cold', ['Frost Shard', 'Ice Spear'], 20),
      L('dot', 'Conjuration', 'poison', ['Venom of the Snake', 'Bane of Nife'], 28),
      L('buff_stat', 'Alteration', null, ['Spiritual Vigor', 'Furious Strength II'], 18),
      L('pethaste', 'Alteration', null, ["Sha's Ferocity", 'Spiritual Ascendance'], 22),
    ],
    trollcaller: [
      L('pet', 'Conjuration', null, ['Call Young Troll', 'Call Forest Troll', 'Call Elder Troll', 'Call Ancient Troll'], 1),
      L('nuke', 'Evocation', 'poison', ['Thornlash', 'Bramble Lash', 'Briar Scourge', 'Heartwood Scourge']),
      L('root', 'Alteration', 'magic', ['Rootbind', 'Grasping Roots', 'Heartwood Snare']),
      L('heal', 'Alteration', null, ['Mending Moss', 'Healing Moss', 'Elder Moss', 'Mother Moss']),
    ],
  };
  const DEFAULT_START = { nuke: 1, dot: 2, heal: 1, hot: 12, buff_ac: 3, buff_hp: 8, buff_stat: 7, ds: 6, haste: 15, slow: 9, root: 5, snare: 4, stun: 8, mez: 3, fear: 6,
    rune: 3, tap: 1, pet: 4, pbae: 12, tae: 18, regen: 14, clarity: 10, sow: 10, gate: 4, bind: 12, lure: 30, fd: 16, resistdebuff: 12, pethl: 6, pethaste: 20, undead: 5, dmgbuff: 9 };
  const TYPE_ICON = { nuke: '🔥', dot: '☣', heal: '✚', hot: '❋', buff_ac: '🛡', buff_hp: '♥', buff_stat: '💪', ds: '🌵', haste: '⏩', slow: '🐌', root: '🌿', snare: '🕸', stun: '💫',
    mez: '🌙', fear: '😱', rune: '🔷', tap: '🩸', pet: '🐾', pbae: '💥', tae: '☄', regen: '♻', clarity: '💧', sow: '🐺', gate: '🌀', bind: '⚓', lure: '✴', fd: '⚰', resistdebuff: '🔻', pethl: '🩹',
    pethaste: '⚡', undead: '☀', dmgbuff: '⚔', charm: '💞', stat: '✦' };
  const STAT_ICON = { STR: '💪', DEX: '🎯', AGI: '🪶', STA: '❤', INT: '🧠', WIS: '🦉', CHA: '🌹' };
  const RES_ICON = { fire: '🔥', cold: '❄', magic: '⚡', poison: '☠', disease: '🦠' };
  const CLASS_POWER = { wizard: 1.3, magician: 0.8, druid: 0.88, shaman: 1.28, necromancer: 0.55, enchanter: 1.3, cleric: 0.88, paladin: 0.82, shadowknight: 0.55, ranger: 0.85, bard: 0.55, beastlord: 0.95, trollcaller: 1.0 };

  const BUFF_LINES = ['buff_ac', 'buff_hp', 'buff_stat', 'dmgbuff', 'ds', 'haste', 'pethaste', 'regen', 'clarity', 'sow', 'stat'];
  const GROUPABLE = ['buff_ac', 'buff_hp', 'buff_stat', 'ds', 'haste', 'regen', 'clarity', 'sow', 'stat'];
  function spellFromLine(cls, line, rank, n, lineIdx, lvl) {
    const t = line.t;
    const pw = CLASS_POWER[cls] || 1;
    const id = cls + '_' + lineIdx + '_' + rank;
    const name = line.names[rank] || line.names[line.names.length - 1] + ' ' + ['II', 'III', 'IV', 'V'][rank - line.names.length] ;
    const sp = { id, name, cls, level: lvl, type: t, school: line.s, res: line.r, kind: 'spell',
      icon: t === 'nuke' && line.r ? RES_ICON[line.r] : TYPE_ICON[t] || '✦', cast: 2.0, cd: 0, target: 'enemy', range: 420, effects: [] };
    const m = Math.round;
    const mana = (base, per) => m(base + lvl * per);
    switch (t) {
      case 'nuke': sp.effects = [{ t: 'dmg', amt: m((12 + lvl * 8.2) * pw), res: line.r }]; sp.mana = mana(5, 2.4); sp.cast = 1.8 + Math.min(1.2, lvl / 40); sp.cd = 3; break;
      case 'lure': sp.effects = [{ t: 'dmg', amt: m((16 + lvl * 9.5) * pw), res: line.r, lure: true }]; sp.mana = mana(10, 5); sp.cast = 3; sp.cd = 6; break;
      case 'undead': sp.effects = [{ t: 'dmg', amt: m((14 + lvl * 9) * pw), res: 'magic', undead: 2.2 }]; sp.mana = mana(6, 3); sp.cast = 2; sp.cd = 4; break;
      case 'dot': sp.effects = [{ t: 'dot', amt: m((3 + lvl * 2.6) * pw), dur: 18, res: line.r }]; sp.mana = mana(6, 2.1); sp.cast = 2.4; sp.cd = 2; break;
      case 'tap': sp.effects = [{ t: 'tap', amt: m((10 + lvl * 7) * pw), res: 'magic' }]; sp.mana = mana(6, 2.4); sp.cast = 1.6; sp.cd = 1.5; break;
      case 'heal': sp.effects = [{ t: 'heal', amt: m(22 + lvl * 15) }]; sp.mana = mana(8, 3.3); sp.cast = 2.5; sp.target = 'ally'; sp.icon = '✚'; break;
      case 'hot': sp.effects = [{ t: 'hot', amt: m(4 + lvl * 2.8), dur: 18 }]; sp.mana = mana(10, 3.2); sp.cast = 1.5; sp.target = 'ally'; sp.cd = 6; break;
      case 'buff_ac': sp.effects = [{ t: 'buff', mods: { ac: m(4 + lvl * 1.3), hp: m(8 + lvl * 5) }, dur: 1500, name }]; sp.mana = mana(10, 2.5); sp.cast = 3; sp.target = 'ally'; break;
      case 'buff_hp': sp.effects = [{ t: 'buff', mods: { hp: m(20 + lvl * 9) }, dur: 1500, name }]; sp.mana = mana(12, 3); sp.cast = 3; sp.target = 'ally'; break;
      case 'buff_stat': sp.effects = [{ t: 'buff', mods: { STR: m(5 + lvl * 0.9), STA: m(3 + lvl * 0.5) }, dur: 1500, name }]; sp.mana = mana(10, 2); sp.cast = 3; sp.target = 'ally'; break;
      case 'dmgbuff': sp.effects = [{ t: 'buff', mods: { dmgMul: 0.08 + lvl * 0.003 }, dur: 600, name }]; sp.mana = mana(10, 2); sp.cast = 1.5; sp.target = 'self'; break;
      case 'ds': sp.effects = [{ t: 'buff', mods: { ds: m(2 + lvl * 1.3) }, dur: 1200, name }]; sp.mana = mana(10, 2.4); sp.cast = 3; sp.target = 'ally'; break;
      case 'haste': sp.effects = [{ t: 'buff', mods: { haste: Math.min(0.45, 0.12 + lvl * 0.007) }, dur: 900, name }]; sp.mana = mana(14, 2.5); sp.cast = 3; sp.target = 'ally'; break;
      case 'pethaste': sp.effects = [{ t: 'buff', mods: { haste: 0.2 + lvl * 0.005, dmgMul: 0.15 }, dur: 900, name }]; sp.mana = mana(14, 2.5); sp.cast = 3; sp.target = 'pet'; break;
      case 'regen': sp.effects = [{ t: 'buff', mods: { regen: +(0.5 + lvl * 0.2).toFixed(1) }, dur: 900, name }]; sp.mana = mana(12, 2.4); sp.cast = 3; sp.target = 'ally'; break;
      case 'clarity': sp.effects = [{ t: 'buff', mods: { manaRegen: +(0.3 + lvl * 0.05).toFixed(2) }, dur: 1200, name }]; sp.mana = mana(14, 1.8); sp.cast = 3; sp.target = 'ally'; break;
      case 'sow': sp.effects = [{ t: 'buff', mods: { speed: 0.42 + Math.min(0.2, lvl * 0.006) }, dur: 2160, name }]; sp.mana = mana(20, 1); sp.cast = 3.5; sp.target = 'ally'; break;
      case 'rune': sp.effects = [{ t: 'rune', amt: m(20 + lvl * 11), dur: 600 }]; sp.mana = mana(12, 3); sp.cast = 2.5; sp.target = 'ally'; sp.cd = 10; break;
      case 'slow': sp.effects = [{ t: 'debuff', mods: { slow: Math.min(0.6, 0.18 + lvl * 0.009) }, dur: 90, name, res: 'magic' }]; sp.mana = mana(14, 2.5); sp.cast = 2.5; break;
      case 'resistdebuff': sp.effects = [{ t: 'debuff', mods: { resist: -(15 + lvl) }, dur: 120, name, res: 'magic' }]; sp.mana = mana(12, 2); sp.cast = 2; break;
      case 'root': sp.effects = [{ t: 'root', dur: 14 + lvl * 0.4, res: 'magic' }]; sp.mana = mana(10, 1.8); sp.cast = 1.5; sp.cd = 4; break;
      case 'snare': sp.effects = [{ t: 'snare', pct: 0.55, dur: 40, res: line.r || 'magic' }]; sp.mana = mana(10, 1.5); sp.cast = 2; sp.cd = 3; break;
      case 'stun': sp.effects = [{ t: 'dmg', amt: m(4 + lvl * 2.5), res: 'magic' }, { t: 'stun', dur: 2 + lvl / 30 }]; sp.mana = mana(10, 2); sp.cast = 0.6; sp.cd = 10; break;
      case 'mez': sp.effects = [{ t: 'mez', dur: 14 + lvl * 0.5, res: 'magic' }]; sp.mana = mana(10, 2); sp.cast = 1.6; sp.cd = 4; break;
      case 'fear': sp.effects = [{ t: 'fear', dur: 8 + lvl * 0.15, res: 'magic' }]; sp.mana = mana(10, 1.6); sp.cast = 1.5; sp.cd = 8; break;
      case 'pbae': sp.effects = [{ t: 'dmg', amt: m((10 + lvl * 6) * pw), res: line.r || 'magic' }]; sp.target = 'pbae'; sp.radius = 130; sp.mana = mana(12, 3.3); sp.cast = 2.5; sp.cd = 8; break;
      case 'tae': sp.effects = [{ t: 'dmg', amt: m((10 + lvl * 6.2) * pw), res: line.r || 'magic' }]; sp.target = 'tae'; sp.radius = 125; sp.mana = mana(13, 3.6); sp.cast = 3; sp.cd = 10; break;
      case 'pet': sp.effects = [{ t: 'pet', lv: Math.max(1, lvl + 1), petKind: petKindFor(cls, sp.name) }]; sp.mana = mana(20, 4); sp.cast = 5; sp.target = 'self'; break;
      case 'pethl': sp.effects = [{ t: 'heal', amt: m(30 + lvl * 18) }]; sp.mana = mana(10, 2.5); sp.cast = 2; sp.target = 'pet'; break;
      case 'fd': sp.effects = [{ t: 'fd' }]; sp.mana = 20; sp.cast = 0; sp.cd = 20; sp.target = 'self'; break;
      case 'gate': sp.effects = [{ t: 'gate' }]; sp.mana = 40; sp.cast = 5; sp.target = 'self'; sp.cd = 30; break;
      case 'bind': sp.effects = [{ t: 'bind' }]; sp.mana = 30; sp.cast = 6; sp.target = 'self'; sp.cd = 10; break;
      case 'stat': sp.effects = [{ t: 'buff', mods: { [line.stat]: m(6 + lvl * 0.9) }, dur: 1500, name }]; sp.mana = mana(10, 2); sp.cast = 3; sp.target = 'ally'; sp.icon = STAT_ICON[line.stat] || '✦'; sp.stat = line.stat; break;
      case 'charm': sp.effects = [{ t: 'charm', dur: 16 + lvl * 0.35, res: 'magic', over: 2 }]; sp.mana = mana(14, 2); sp.cast = 2.2; sp.cd = 6; sp.target = 'enemy'; break;
    }
    if (line.s === 'Song') { sp.cast = Math.min(sp.cast, 1.2); sp.mana = Math.round(sp.mana * 0.6); if (sp.effects.length && sp.effects.every((e) => e.t === 'buff' || e.t === 'hot' || e.t === 'rune')) { sp.mana = 0; sp.cast = 0; sp.autoSong = true; if (sp.target === 'self') sp.target = 'ally'; } }
    // wizards: the fastest, cheapest damage spells in the game (and spell crits, see game.js)
    if (cls === 'wizard' && ['nuke', 'lure', 'pbae', 'tae', 'stun', 'root', 'snare'].includes(t)) { sp.cast = Math.round(sp.cast * 0.7 * 10) / 10; sp.mana = Math.round(sp.mana * 0.75); if (t === 'nuke') sp.cd = 1.5; }
    sp.price = Math.round(50 + lvl * lvl * 30);
    for (const e of sp.effects) if (e.t === 'buff' && BUFF_LINES.includes(t)) e.line = t === 'stat' ? 'stat_' + line.stat : t;
    if (line.s === 'Song' && sp.target === 'ally') sp.target = 'group';
    else if (GROUPABLE.includes(t) && sp.target === 'ally' && n >= 2 && rank >= Math.ceil(n / 2) && lvl >= 16) { sp.target = 'group'; sp.mana = Math.round(sp.mana * 1.5); sp.cast += 0.5; }
    sp.desc = line.s === 'Song' ? spellDesc(sp) : (sp.target === 'group' ? 'Group: ' : '') + spellDesc(sp) + (sp.target === 'group' ? ' Affects your whole group nearby.' : '');
    if (sp.autoSong) sp.hymn = true;
    return sp;
  }
  function petKindFor(cls, name) {
    if (cls === 'magician') {
      if (/Fire|Lord|Flame/.test(name)) return 'fire_elemental';
      if (/Storm/.test(name)) return 'air_elemental';
      if (/Water/.test(name)) return 'water_elemental';
      if (/Air/.test(name)) return 'air_elemental';
      return 'earth_elemental';
    }
    if (cls === 'beastlord') {
      if (/Bear/.test(name)) return 'bear'; if (/Tiger|Lynx/.test(name)) return 'tiger'; if (/Wyvern/.test(name)) return 'drake'; return 'wolf';
    }
    if (cls === 'shaman') return 'spiritwolf';
    if (cls === 'trollcaller') return 'troll';
    if (cls === 'enchanter') return 'animsword';
    return 'skeleton';
  }
  function spellDesc(sp) {
    const e = sp.effects[0] || {};
    const res = e.res ? ` (${e.res})` : '';
    switch (sp.type) {
      case 'nuke': case 'lure': return `Deals ${e.amt} damage${res}.` + (sp.type === 'lure' ? ' Hard to resist.' : '');
      case 'undead': return `Deals ${e.amt} damage, more than double against undead.`;
      case 'dot': return `Deals ${e.amt} damage every 3 seconds for ${e.dur}s${res}.`;
      case 'tap': return `Steals ${e.amt} health from the target.`;
      case 'heal': return `Heals ${e.amt} health.`;
      case 'pethl': return `Heals your pet for ${e.amt}.`;
      case 'hot': return `Heals ${e.amt} every 3 seconds for ${e.dur}s.`;
      case 'buff_ac': return `+${e.mods.ac} armor and +${e.mods.hp} health for ${Math.round(e.dur / 60)} min.`;
      case 'buff_hp': return `+${e.mods.hp} maximum health for ${Math.round(e.dur / 60)} min.`;
      case 'buff_stat': return `+${e.mods.STR} Strength, +${e.mods.STA} Stamina.`;
      case 'dmgbuff': return `+${Math.round(e.mods.dmgMul * 100)}% melee damage for ${Math.round(e.dur / 60)} min.`;
      case 'ds': return `Attackers take ${e.mods.ds} damage each time they hit.`;
      case 'haste': case 'pethaste': return `Attack ${Math.round(e.mods.haste * 100)}% faster.`;
      case 'regen': return `Regenerate ${e.mods.regen} health per second.`;
      case 'clarity': return `Regenerate ${e.mods.manaRegen} extra mana per second.`;
      case 'sow': return `Run ${Math.round(e.mods.speed * 100)}% faster.`;
      case 'rune': return `Absorbs the next ${e.amt} damage.`;
      case 'slow': return `Target attacks ${Math.round(e.mods.slow * 100)}% slower.`;
      case 'resistdebuff': return `Lowers the target's resistances by ${-e.mods.resist}.`;
      case 'root': return `Roots the target in place for ${Math.round(e.dur)}s.`;
      case 'snare': return `Slows the target's movement by ${Math.round(e.pct * 100)}%.`;
      case 'stun': return `Small damage and stuns for ${sp.effects[1].dur.toFixed(1)}s.`;
      case 'mez': return `Puts the target to sleep for ${Math.round(e.dur)}s. Damage wakes it.`;
      case 'fear': return `Sends the target fleeing in terror.`;
      case 'pbae': return `Deals ${e.amt} damage to every enemy around you.`;
      case 'tae': return `Deals ${e.amt} damage to every enemy near your target.`;
      case 'pet': return `Summons a level ${D.shown(e.lv)} companion to fight for you.`;
      case 'fd': return `Drop to the ground. Enemies forget you.`;
      case 'gate': return `Return to your bind point.`;
      case 'bind': return `Bind your soul to where you stand. Gate and death return you here.`;
      case 'stat': return `+${e.mods[sp.stat]} ${D.STAT_NAMES[sp.stat]}: ${D.STAT_HELP[sp.stat].split('.')[0].toLowerCase()}.`;
      case 'charm': return `Charms a creature up to ${e.over} levels above you into fighting for you. Lasts about ${Math.round(e.dur)}s plus more with higher Charisma, then it turns hostile again. Does not work on named creatures or bosses.`;
    }
    return '';
  }
  // ---------- general passives (each class kit picks its three: see D.KITS) ----------
  D.PASSIVES = {
    fury: { name: 'Combat Fury', icon: '⚔', mods: { dmgMul: 0.06 }, desc: '+6% melee and ability damage.' },
    durability: { name: 'Natural Durability', icon: '❤', mods: { hpPct: 0.06 }, desc: '+6% maximum health.' },
    stability: { name: 'Combat Stability', icon: '🛡', mods: { acMul: 0.06 }, desc: '+6% armor.' },
    defense: { name: 'Innate Defense', icon: '🪨', mods: { dmgTaken: -0.04 }, desc: 'Take 4% less damage from every source.' },
    ambidex: { name: 'Ambidexterity', icon: '🤹', mods: { haste: 0.05 }, desc: 'Attack 5% faster.' },
    stamina: { name: 'Endless Stamina', icon: '🏃', mods: { endPct: 0.08, endRegen: 0.6 }, desc: '+8% endurance and +0.6 endurance regeneration per second.' },
    regen: { name: 'Innate Regeneration', icon: '♻', mods: { regen: 0.4 }, desc: '+0.4 health regeneration per second.' },
    clarity: { name: 'Mental Clarity', icon: '💧', mods: { manaRegen: 0.35 }, desc: '+0.35 mana regeneration per second.' },
    arcane: { name: 'Arcane Mind', icon: '🧠', mods: { manaPct: 0.07 }, desc: '+7% maximum mana.' },
    spellfury: { name: 'Spell Casting Fury', icon: '✨', mods: { spellMul: 0.06 }, desc: '+6% spell damage and healing.' },
    healer: { name: 'Healing Adept', icon: '✚', mods: { healMul: 0.08 }, desc: '+8% healing done.' },
    archery: { name: 'Archery Mastery', icon: '🏹', mods: { rangedMul: 0.1 }, desc: '+10% ranged damage.' },
    threat: { name: 'Taunt Mastery', icon: '📣', mods: { threat: 0.15 }, desc: 'Generate 15% more hate, holding enemies on you.' },
    fleet: { name: 'Fleet of Foot', icon: '🐾', mods: { speed: 0.05 }, desc: 'Run 5% faster.' },
    thorns: { name: 'Divine Thorns', icon: '🌵', mods: { ds: 4 }, desc: 'Attackers take 4 damage each time they hit you.' },
    STR: { name: 'Strength of the Ancients', icon: '💪', mods: { STR: 8 }, desc: '+8 Strength.' },
    STA: { name: 'Hardy Constitution', icon: '🫀', mods: { STA: 8 }, desc: '+8 Stamina.' },
    AGI: { name: 'Agile Reflexes', icon: '🪶', mods: { AGI: 8 }, desc: '+8 Agility.' },
    DEX: { name: 'Keen Dexterity', icon: '🎯', mods: { DEX: 8 }, desc: '+8 Dexterity.' },
    WIS: { name: 'Wisdom of the Ages', icon: '🦉', mods: { WIS: 8 }, desc: '+8 Wisdom.' },
    INT: { name: 'Sharp Intellect', icon: '📘', mods: { INT: 8 }, desc: '+8 Intelligence.' },
    CHA: { name: 'Silver Tongue', icon: '🌹', mods: { CHA: 8 }, desc: '+8 Charisma.' },
    aq_steady: { name: 'Steady Aim', icon: '🎯', mods: { rangedMul: 0.15 }, desc: '+15% ranged damage.' },
    aq_mastery: { name: 'Powder Mastery', icon: '💥', mods: { rangedMul: 0.08, dmgMul: 0.06 }, desc: '+8% ranged and +6% ability damage: finer powder, tighter wadding.' },
    aq_surgeon: { name: 'Field Surgeon', icon: '🩹', mods: { regen: 1.5, hpPct: 0.06 }, desc: '+6% maximum health and faster health regeneration.' },
    tc_bond: { name: 'Troll Bond', icon: '🤝', mods: { petBond: 1 }, desc: 'Your troll has 30% more health and hits 15% harder.' },
    tc_bark: { name: 'Barkskin', icon: '🌳', mods: { acMul: 0.08, dmgTaken: -0.04 }, desc: '+8% armor and 4% less damage from every source.' },
    tc_oldways: { name: 'Old Ways', icon: '🌿', mods: { manaRegen: 0.8, WIS: 6 }, desc: '+6 Wisdom and faster mana regeneration.' },
  };
  const OLD_PASSIVES = {
    warrior: ['STA', 'stability', 'durability', 'fury', 'threat', 'defense', 'ambidex', 'stamina', 'STR', 'durability'],
    paladin: ['WIS', 'durability', 'healer', 'stability', 'threat', 'thorns', 'clarity', 'defense', 'fury', 'healer'],
    shadowknight: ['INT', 'durability', 'fury', 'threat', 'stability', 'regen', 'clarity', 'defense', 'fury', 'spellfury'],
    ranger: ['DEX', 'archery', 'fleet', 'clarity', 'fury', 'AGI', 'archery', 'ambidex', 'stamina', 'spellfury'],
    bard: ['CHA', 'fleet', 'clarity', 'DEX', 'fury', 'ambidex', 'arcane', 'stamina', 'spellfury', 'CHA'],
    beastlord: ['WIS', 'fury', 'regen', 'clarity', 'ambidex', 'durability', 'STA', 'fleet', 'fury', 'spellfury'],
    rogue: ['DEX', 'fury', 'AGI', 'ambidex', 'fleet', 'stamina', 'fury', 'defense', 'ambidex', 'DEX'],
    monk: ['AGI', 'fleet', 'ambidex', 'defense', 'stamina', 'fury', 'regen', 'STA', 'ambidex', 'defense'],
    berserker: ['STR', 'fury', 'stamina', 'ambidex', 'durability', 'fury', 'regen', 'STR', 'ambidex', 'fury'],
    cleric: ['WIS', 'healer', 'clarity', 'arcane', 'durability', 'healer', 'defense', 'spellfury', 'clarity', 'healer'],
    druid: ['WIS', 'spellfury', 'fleet', 'clarity', 'regen', 'healer', 'arcane', 'spellfury', 'clarity', 'durability'],
    shaman: ['WIS', 'healer', 'regen', 'clarity', 'STA', 'spellfury', 'arcane', 'durability', 'clarity', 'healer'],
    necromancer: ['INT', 'spellfury', 'clarity', 'arcane', 'regen', 'spellfury', 'defense', 'clarity', 'arcane', 'spellfury'],
    wizard: ['INT', 'spellfury', 'arcane', 'clarity', 'spellfury', 'fleet', 'arcane', 'defense', 'clarity', 'spellfury'],
    magician: ['INT', 'spellfury', 'clarity', 'arcane', 'durability', 'spellfury', 'arcane', 'clarity', 'defense', 'spellfury'],
    enchanter: ['CHA', 'INT', 'clarity', 'arcane', 'spellfury', 'defense', 'clarity', 'arcane', 'CHA', 'spellfury'],
    arquebusier: ['DEX', 'archery', 'stamina', 'durability', 'fury', 'AGI', 'archery', 'stamina', 'defense', 'DEX'],
    trollcaller: ['WIS', 'durability', 'regen', 'clarity', 'STA', 'healer', 'fury', 'clarity', 'durability', 'spellfury'],
  };
  // the general passives classes used to list one by one now come with the class as quiet training that grows with
  // your level (same bonuses, same old schedule), so heroes are as strong as before with three passives to show
  const OLD_OWN = { ranger: 4, beastlord: 4, trollcaller: 2, cleric: 2, druid: 2, shaman: 2, necromancer: 2, wizard: 2, magician: 2, enchanter: 2 };
  const OLD_PLV = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45];
  const trainCache = {};
  D.classTraining = (cls) => {
    if (trainCache[cls]) return trainCache[cls];
    const list = (OLD_PASSIVES[cls] || []).slice(0, 10 - (OLD_OWN[cls] || 3)).map((k, i) => [k, OLD_PLV[i]]);
    // a general passive that is now one of the kit's three counts once
    for (const p2 of (D.KITS[cls] ? D.KITS[cls].pas : [])) { const id = Array.isArray(p2) ? p2[0] : p2; const at = list.findIndex((x) => x[0] === id); if (at >= 0) list.splice(at, 1); }
    return (trainCache[cls] = list);
  };
  // [{ key, name (with rank), icon, mods, desc, level }]
  const pcacheD = {};
  D.classPassives = (cls) => {
    if (pcacheD[cls]) return pcacheD[cls];
    // the class kit's three passives: its own passive skills (Double Attack, Dual Wield, Meditation...) or general ones
    const kit = D.KITS[cls]; const out = [];
    (kit ? kit.pas : []).forEach((p2, i) => {
      const id = Array.isArray(p2) ? p2[0] : p2, level = Array.isArray(p2) ? p2[1] : D.LV(D.KIT_PAS_SHOWN[i]);
      const S = D.SKILLS[id];
      if (S && S.passive) out.push({ key: id, skill: true, level, name: S.name, icon: S.icon, desc: S.desc, mods: {} });
      else if (D.PASSIVES[id]) out.push(Object.assign({ key: id, level, rank: 1 }, D.PASSIVES[id]));
    });
    return (pcacheD[cls] = out.sort((a, b) => a.level - b.level));
  };
  // ---------- class kits: about 8 actives and 3 passives per class ----------
  // act: class skills by id, or 's:N' for spell line N of the class (SPELL_LINES order); pas: passive skills or
  // general passives (D.PASSIVES), optionally [id, level]
  D.KIT_ACT_SHOWN = [1, 1, 3, 5, 7, 10, 13, 16];
  D.KIT_PAS_SHOWN = [4, 9, 15];
  D.KITS = {
    warrior: { act: ['taunt', 'kick', 'bash', 'wcharge', 'defensive', 'rampage', 'whirlwind', 'furyofthelast'], pas: ['doubleattack', 'dualwield', 'tripleattack'] },
    paladin: { act: ['layonhands', 'taunt', 's:0', 'bash', 's:6', 's:1', 's:2', 'avengingwrath'], pas: ['meditation', 'doubleattack', 'tripleattack'] },
    shadowknight: { act: ['harmtouch', 'taunt', 's:0', 'bash', 's:2', 's:4', 's:3', 'deathcoil'], pas: ['meditation', 'doubleattack', 'tripleattack'] },
    ranger: { act: ['trueshot', 'kick', 's:2', 's:1', 'huntersmark', 's:9', 'rapidfire', 'volley'], pas: ['meditation', 'dualwield', 'doubleattack'] },
    bard: { act: ['kick', 's:0', 's:1', 's:5', 's:3', 's:2', 's:7', 'fading'], pas: ['meditation', 'dualwield', 'doubleattack'] },
    beastlord: { act: ['s:0', 'kick', 's:1', 's:2', 'rendingclaws', 's:4', 'bestialfury', 'feralfrenzy'], pas: ['meditation', 'dualwield', 'doubleattack'] },
    rogue: { act: ['backstab', 'evade', 'sinister', 'hide', 'cripplingstrike', 'kidneyshot', 'poisonblade', 'assassinate'], pas: [['dualwield', 1], 'doubleattack', 'tripleattack'] },
    monk: { act: ['roundkick', 'mend', 'tigerclaw', 'feigndeath', 'flyingkick', 'cyclonekick', 'ironskin', 'dragonpunch'], pas: ['dualwield', 'doubleattack', 'tripleattack'] },
    berserker: { act: ['frenzy', 'kick', 'bloodletter', 'berserkrage', 'ragevolley', 'bwhirl', 'decapitate', 'bloodlust'], pas: ['dualwield', 'doubleattack', 'tripleattack'] },
    cleric: { act: ['s:0', 's:1', 's:2', 's:6', 's:5', 's:3', 's:4', 'divineaura'], pas: ['meditation', 'channeling', 'healer'] },
    druid: { act: ['s:1', 's:0', 's:3', 's:7', 's:2', 's:4', 's:10', 's:9'], pas: ['meditation', 'channeling', 'spellfury'] },
    shaman: { act: ['s:0', 's:2', 's:1', 's:5', 's:3', 'cannibalize', 's:8', 's:6'], pas: ['meditation', 'channeling', 'healer'] },
    necromancer: { act: ['s:0', 's:1', 's:2', 's:4', 's:5', 's:6', 's:3', 's:11'], pas: ['meditation', 'channeling', 'spellfury'] },
    wizard: { act: ['s:0', 's:1', 's:4', 's:5', 's:2', 'blink', 's:3', 's:15'], pas: ['meditation', 'channeling', 'spellfury'] },
    magician: { act: ['s:0', 's:1', 's:7', 's:2', 's:3', 's:5', 's:4', 's:12'], pas: ['meditation', 'channeling', 'spellfury'] },
    enchanter: { act: ['s:0', 's:1', 's:3', 's:5', 's:2', 's:6', 's:9', 's:4'], pas: ['meditation', 'channeling', 'clarity'] },
    arquebusier: { act: ['aq_aimed', 'aq_bayonet', 'aq_scatter', 'aq_powder', 'aq_smoke', 'aq_reload', 'aq_incendiary', 'aq_volley'], pas: ['aq_steady', 'aq_mastery', 'aq_surgeon'] },
    trollcaller: { act: ['s:0', 'tc_smash', 's:1', 'tc_stoneskin', 's:2', 'tc_roar', 's:3', 'tc_frenzy'], pas: ['tc_bond', 'tc_bark', 'tc_oldways'] },
  };
  D.SPELLS = {};
  D.CLASS_SPELLS = {};
  D.SPELL_MAX = 50; // no spells or songs above level 50
  for (const cls of Object.keys(SPELL_LINES)) {
    const target = D.CLASSES[cls].role === 'caster' ? 75 : cls === 'bard' ? 57 : D.CLASSES[cls].only ? 0 : 38; // a kingdom's own class keeps just its own lines
    let lines = SPELL_LINES[cls].map((l) => ({ ...l, names: l.names.slice() }));
    let total = lines.reduce((a, l) => a + l.names.length, 0);
    // trim from the longest lines, pad on the first line with ranked names
    // more than the minimum is fine; only pad classes that come up short
    lines = SPELL_LINES[cls].map((orig) => lines.find((l) => l.t === orig.t && l.s === orig.s && l.r === orig.r && l.names[0] === orig.names[0]));
    let pad = 0;
    while (total < target) { lines[pad % 2].names.push(lines[pad % 2].names[0] + ' ' + ['II', 'III', 'IV', 'V'][Math.floor(pad / 2)]); pad++; total++; }
    // Sort padded names to the end and keep rank names ordered
    const list = [], entries = [];
    lines.forEach((line, li) => {
      const n = line.names.length;
      const start = line.start != null ? line.start : DEFAULT_START[line.t] || 1;
      for (let r = 0; r < n; r++) {
        const lvl0 = line.levels ? Math.min(D.SPELL_MAX, line.levels[r]) : n === 1 ? start : Math.max(1, Math.min(D.SPELL_MAX, Math.round(start + (r * (D.SPELL_MAX - 2 - start)) / (n - 0.6))));
        entries.push({ line, li, r, n, lvl0, fixed: !!line.levels });
      }
    });
    // spread spells out so something new arrives at (almost) every level from 1 to 50
    const free = entries.filter((e) => !e.fixed).sort((a, b) => a.lvl0 - b.lvl0 || a.li - b.li || a.r - b.r);
    free.forEach((e, i) => (e.lvl = Math.min(D.SPELL_MAX, 1 + Math.floor((i * D.SPELL_MAX) / free.length))));
    for (const e of entries) {
      const sp = spellFromLine(cls, e.line, e.r, e.n, e.li, e.fixed ? e.lvl0 : e.lvl);
      D.SPELLS[sp.id] = sp; list.push(sp.id);
    }
    list.sort((a, b) => D.SPELLS[a].level - D.SPELLS[b].level);
    D.CLASS_SPELLS[cls] = list;
    // the class kit keeps a handful of spell lines (see D.KITS below): each kept line has up to three ranks, rebuilt at
    // their new levels so their power still matches the level you learn them at
    const kit = D.KITS[cls];
    if (kit) {
      const keep = [];
      kit.act.forEach((a2, slot) => {
        if (typeof a2 !== 'string' || a2[0] !== 's' || a2[1] !== ':') return;
        const li = +a2.slice(2), line = lines[li]; if (!line) return;
        const n = line.names.length, R = Math.min(3, n), u = D.LV(D.KIT_ACT_SHOWN[slot]);
        for (let j = 0; j < R; j++) {
          const r = R === 1 ? 0 : Math.round((j * (n - 1)) / (R - 1));
          const lv = j === 0 ? u : D.snapLv(u + (j * (48 - u)) / (R - 1));
          const sp = spellFromLine(cls, line, r, n, li, lv); sp.kitSlot = slot; D.SPELLS[sp.id] = sp; keep.push(sp.id);
        }
      });
      keep.sort((a3, b3) => D.SPELLS[a3].level - D.SPELLS[b3].level);
      D.CLASS_SPELLS[cls] = keep;
    }
  }
  // the class skills of each kit: actives unlock at shown levels 1, 1, 3, 5, 7, 10, 13, 16 and passives at 4, 9, 15
  for (const cls in D.KITS) {
    const C = D.CLASSES[cls], kit = D.KITS[cls];
    const sk = [];
    kit.act.forEach((id, slot) => { if (typeof id === 'string' && D.SKILLS[id]) sk.push([id, D.LV(D.KIT_ACT_SHOWN[slot])]); });
    kit.pas.forEach((p2, i) => { const id = Array.isArray(p2) ? p2[0] : p2; const lv = Array.isArray(p2) ? p2[1] : D.LV(D.KIT_PAS_SHOWN[i]); if (D.SKILLS[id] && D.SKILLS[id].passive) sk.push([id, lv]); });
    C.skills = sk.sort((x, y) => x[1] - y[1]);
  }

  // ---------- Progression rules ----------
  D.mobXp = (lv) => 8 + lv * 5;
  D.killsPerLevel = (lv) => 9 + lv * 1.05;
  // experience from one shown level to the next (each spans about 2.6 internal levels): a smooth curve, and the
  // whole climb to 20 is about what reaching 32 used to take
  D.xpNeeded = (lv) => { const n = D.shown(lv); const mid = 1 + (n - 0.5) * 49 / 19; return Math.round(0.297 * (49 / 19) * D.mobXp(mid) * D.killsPerLevel(mid)); };
  D.SLOT_UNLOCK = [1, 1, 1, 1, 1, 10, 10, 10, 10, 10];
  D.HOTBAR = 10;
  D.slotsForLevel = () => 10; // every hotbar slot is open from level 1
  D.STAT_POINTS_PER_LEVEL = 5;
  D.weaponSkillCap = (lv) => Math.min(250, 10 + lv * 5);
  D.schoolSkillCap = (lv) => Math.min(250, 10 + lv * 5);
  D.CITY_THRESHOLDS = [0, 200, 1100, 3300, 8000]; // status needed to reach level 2..5 (index = current level)
  D.statusToNext = (cityLevel) => (cityLevel >= 5 ? Infinity : D.CITY_THRESHOLDS[cityLevel]);
  D.cityRadius = (lvl) => 20 + 6 * (lvl - 1);
  D.CON_COLORS = { gray: '#9a9a9a', green: '#5fd35f', lblue: '#7fd6ff', blue: '#4f8bff', white: '#ffffff', yellow: '#ffd84a', red: '#ff4a3a' };
  D.conOf = (pl, ml) => {
    const d = ml - pl;
    const grayAt = pl < 10 ? -4 : pl < 20 ? -6 : pl < 35 ? -8 : -10;
    if (d <= grayAt) return 'gray';
    if (d <= Math.round(grayAt / 2)) return 'green';
    if (d <= -2) return 'lblue';
    if (d <= -1) return 'blue';
    if (d === 0) return 'white';
    if (d <= 2) return 'yellow';
    return 'red';
  };
  D.conXpMul = { gray: 0.1, green: 0.4, lblue: 0.75, blue: 0.9, white: 1, yellow: 1.15, red: 1.35 };

  // ---------- Crafting ----------
  D.MATERIALS = {
    metal: ['Copper Ore', 'Iron Ore', 'Silver Ore', 'Mithril Ore', 'Adamantite Ore', 'Starmetal Ore'],
    hide: ['Rough Hide', 'Tanned Hide', 'Thick Leather', 'Wyvern Hide', 'Dragonscale', 'Shadowhide'],
    cloth: ['Linen Bolt', 'Silk Bolt', 'Spidersilk', 'Moonweave', 'Starweave', 'Voidcloth'],
    // wood is counted from what you chop (it is not carried in bags): oak everywhere, darkoak in the Greywood, willow in the Dreadmire, frostpine in the peaks
    wood: ['Oak Log', 'Darkoak Log', 'Willow Log', 'Frostpine Log', 'Frostpine Log', 'Frostpine Log'],
    arcane: ['Arcane Dust', 'Arcane Essence', 'Arcane Shard', 'Arcane Crystal', 'Arcane Prism', 'Astral Core'],
  };
  D.MAT_ICON = { metal: '⛏', hide: '🟫', cloth: '🧵', arcane: '💎', wood: '🪵' };
  D.STAT_CAP = 255;
  // player stances (5 second cooldown between switches)
  D.PSTANCES = {
    fighter: { name: 'Fighter Stance', icon: '⚔', mods: { dmgMul: 0.12, haste: 0.08, endRegenPct: 0.4 }, desc: 'Hit harder, swing faster and recover endurance 40% faster.' },
    defensive: { name: 'Defensive Stance', icon: '🛡', mods: { dmgTaken: -0.2, acMul: 0.15, threat: 0.6, regenPct: 0.5 }, desc: 'Take much less damage, hold enemy attention and regenerate health 50% faster.' },
    mage: { name: 'Mage Stance', icon: '✦', mods: { spellMul: 0.15, spellHaste: 0.15, manaRegen: 1.5 }, desc: 'Stronger damage spells, 15% faster casting and better mana regen.' },
    healer: { name: 'Healer Stance', icon: '✚', mods: { healMul: 0.2, manaRegen: 1.2 }, desc: 'Stronger heals and better mana regen.' },
  };
  D.SONG_PULSE = 16; D.SONG_DUR = 20;
  // unique worn haste items (EverQuest style: worn haste does not stack, the best one counts)
  D.UNIQUE_WORN = [
    { id: 'w_racingwind', name: 'Belt of the Racing Wind', slot: 'waist', lvl: 16, haste: 0.12, bias: ['AGI', 'DEX'], fx: 'storm', lore: 'Light as a breeze, it hurries every swing.' },
    { id: 'w_swiftwind', name: 'Swiftwind Cape', slot: 'back', lvl: 24, haste: 0.2, bias: ['AGI', 'STA'], fx: 'storm', lore: 'The cape never stops fluttering, even when the air is still.' },
    { id: 'w_stormgirdle', name: 'Girdle of the Storm', slot: 'waist', lvl: 38, haste: 0.25, bias: ['STR', 'DEX'], fx: 'storm', lore: 'Thunder rumbles faintly when you buckle it on.' },
    { id: 'w_cof', name: 'Cloak of Flames', slot: 'back', lvl: 44, haste: 0.36, bias: ['STR', 'AGI'], fx: 'fire', lore: 'A cloak woven from living flame. Legends speak of the warriors who wore it.' },
    { id: 'w_wyrmmantle', name: 'Mantle of the Wyrm', slot: 'back', lvl: 52, haste: 0.4, bias: ['STR', 'STA'], fx: 'fire', lore: 'Cut from the wing of a great dragon.' },
    { id: 'w_renewal', name: 'Amulet of Renewal', slot: 'neck', lvl: 14, bias: ['STA', 'WIS'], regen: 1.2, fx: 'nature', lore: 'A green stone that pulses like a slow heartbeat. Wounds close faster.' },
    { id: 'w_clarity', name: 'Band of Clarity', slot: 'ring', lvl: 22, bias: ['INT', 'WIS'], manaRegen: 1.4, fx: 'frost', lore: 'Cool to the touch. The mind settles while wearing it.' },
    { id: 'w_tireless', name: 'Shawl of the Tireless', slot: 'back', lvl: 30, bias: ['STA', 'AGI'], endRegen: 2.5, regen: 1, fx: 'storm', lore: 'Woven by marathon runners of the old empire.' },
    { id: 'w_sagering', name: 'Ring of the Sage', slot: 'ring', lvl: 46, bias: ['INT', 'WIS'], manaRegen: 2.6, fx: 'holy', lore: 'Worn by the last archmage of the Spire.' },
    { id: 'w_trollheart', name: 'Trollheart Pendant', slot: 'neck', lvl: 50, bias: ['STA', 'STR'], regen: 3.5, endRegen: 2, fx: 'nature', lore: 'A troll\'s heart, shrunk and set in gold. It still beats.' },
    { id: 'w_titanbelt', name: 'Belt of the Storm Titan', slot: 'waist', lvl: 58, haste: 0.42, bias: ['STR', 'STA'], fx: 'storm', lore: 'Aerathos wore it as a bracelet.' },
  ];
  // ---------- weapon procs (rare and unique weapons) ----------
  D.PROCS = {
    flame: { name: 'Flame Lick', fx: 'fire', icon: '🔥', desc: 'Bursts into flame', effects: [{ t: 'dmg', res: 'fire', amt: [8, 2.4] }] },
    frost: { name: 'Frost Bite', fx: 'frost', icon: '❄', desc: 'Chills and slows', effects: [{ t: 'dmg', res: 'cold', amt: [6, 1.8] }, { t: 'snare', pct: 0.35, dur: 6 }] },
    venom: { name: 'Envenom', fx: 'poison', icon: '🐍', desc: 'Poisons the target', effects: [{ t: 'dot', res: 'poison', amt: [3, 1.0], dur: 12 }] },
    shadow: { name: 'Soul Siphon', fx: 'shadow', icon: '💀', desc: 'Drains life to heal you', effects: [{ t: 'tap', amt: [6, 1.7] }] },
    storm: { name: 'Static Shock', fx: 'storm', icon: '⚡', desc: 'Lightning damage', effects: [{ t: 'dmg', res: 'magic', amt: [7, 2.1] }] },
    holy: { name: 'Smite', fx: 'holy', icon: '✨', desc: 'Holy damage, doubled against undead', effects: [{ t: 'dmg', res: 'magic', amt: [7, 2.0], undead: 2 }] },
    nature: { name: 'Thorn Lash', fx: 'nature', icon: '🌿', desc: 'Bleeding thorns', effects: [{ t: 'dot', res: 'poison', amt: [2.5, 0.85], dur: 9 }, { t: 'snare', pct: 0.2, dur: 6 }] },
    stun: { name: 'Concussive Blow', fx: 'storm', icon: '💫', desc: 'Stuns the target', effects: [{ t: 'stun', dur: 1.5 }, { t: 'hit', amt: [4, 1.0] }] },
    wither: { name: 'Wither', fx: 'shadow', icon: '🥀', desc: 'Weakens the target\'s attacks', effects: [{ t: 'debuff', name: 'Withered', mods: { dmgMul: -0.15, acMul: -0.1 }, dur: 15 }] },
    rage: { name: 'Bloodrage', fx: 'fire', icon: '🩸', desc: 'Fills you with battle fury', effects: [{ t: 'hit', amt: [6, 1.6] }, { t: 'selfbuff', name: 'Bloodrage', mods: { haste: 0.2 }, dur: 8 }] },
  };
  D.FX_NAMES = { fire: 'Burning', frost: 'Frozen', poison: 'Venomous', shadow: 'Shadow-touched', storm: 'Storm-charged', holy: 'Holy', nature: 'Thorned' };
  // ---------- unique class items ----------
  D.UNIQUES = [
    { id: 'u_forgefather', name: 'Ember of the Forgefather', wt: '1HS', lvl: 18, classes: ['warrior', 'paladin'], proc: 'flame', fx: 'fire', bias: ['STR', 'STA'], lore: 'The blade never cools. Its edge still glows from the forge that made it.' },
    { id: 'u_soulreaver', name: 'Soulreaver', wt: '2HS', lvl: 14, classes: ['shadowknight'], proc: 'shadow', fx: 'shadow', bias: ['STR', 'INT'], lore: 'A greatsword that hums with a sickly green light. It thirsts.' },
    { id: 'u_gravesong', name: 'Gravesong', wt: '1HS', lvl: 36, classes: ['shadowknight'], proc: 'wither', fx: 'shadow', bias: ['STR', 'INT'], lore: 'Forged in a crypt. The dead whisper along its edge.' },
    { id: 'u_viperfang', haste: 0.12, name: 'Fang of the Viper', wt: '1HP', lvl: 11, classes: ['rogue'], proc: 'venom', fx: 'poison', bias: ['DEX', 'AGI'], lore: 'Poison weeps from the tip of this dagger without end.' },
    { id: 'u_nightsting', haste: 0.2, name: 'Nightsting', wt: '1HP', lvl: 37, classes: ['rogue', 'bard'], proc: 'venom', fx: 'poison', bias: ['DEX', 'AGI'], lore: 'A thieves\' guild heirloom. Its venom stops a heart in three beats.' },
    { id: 'u_sunmace', name: 'Sunblessed Mace', wt: '1HB', lvl: 24, classes: ['cleric', 'paladin'], proc: 'holy', fx: 'holy', bias: ['WIS', 'STA'], lore: 'Blessed at dawn by the high priests. Undead flinch from its light.' },
    { id: 'u_thornwood', name: 'Thornwood Cudgel', wt: '1HB', lvl: 16, classes: ['druid', 'ranger'], proc: 'nature', fx: 'nature', bias: ['WIS', 'AGI'], lore: 'Cut from a living thornwood. It still grows.' },
    { id: 'u_spirittotem', name: 'Spirit-Totem Club', wt: '1HB', lvl: 21, classes: ['shaman', 'beastlord'], proc: 'frost', fx: 'frost', bias: ['WIS', 'STA'], lore: 'Carved with the faces of frost spirits that bite whatever it strikes.' },
    { id: 'u_bloodrage', haste: 0.18, name: 'Bloodrage Cleaver', wt: '2HS', lvl: 29, classes: ['berserker'], proc: 'rage', fx: 'fire', axe: true, bias: ['STR', 'STA'], lore: 'A great axe that drinks blood and returns it as fury.' },
    { id: 'u_windrunner', haste: 0.15, name: 'Windrunner Longbow', wt: 'ARC', lvl: 27, classes: ['ranger'], proc: 'storm', fx: 'storm', bias: ['DEX', 'STR'], lore: 'Its string sings with the storm. Arrows crackle as they fly.' },
    { id: 'u_tempestfists', haste: 0.21, name: 'Fists of the Tempest', wt: 'H2H', lvl: 26, classes: ['monk', 'beastlord'], proc: 'storm', fx: 'storm', bias: ['STR', 'AGI'], lore: 'Thunder rolls with every blow.' },
    { id: 'u_emberstaff', name: 'Staff of Embers', wt: '2HB', lvl: 19, classes: ['wizard', 'magician'], proc: 'flame', fx: 'fire', bias: ['INT', 'STA'], lore: 'A staff topped with a coal that never dies.' },
    { id: 'u_frostfang', name: 'Frostfang Staff', wt: '2HB', lvl: 41, classes: ['wizard', 'enchanter'], proc: 'frost', fx: 'frost', bias: ['INT', 'STA'], lore: 'Rime creeps up the wood. The air turns cold around it.' },
    { id: 'u_bonecarver', name: 'Bonecarver', wt: '1HP', lvl: 15, classes: ['necromancer'], proc: 'shadow', fx: 'shadow', bias: ['INT', 'STA'], lore: 'A ritual knife carved from a lich\'s finger bone.' },
    { id: 'u_mindspike', name: 'Mindspike', wt: '1HP', lvl: 18, classes: ['enchanter', 'bard'], proc: 'stun', fx: 'storm', bias: ['CHA', 'INT'], lore: 'It does not cut flesh so much as thought.' },
    { id: 'u_valensong', haste: 0.1, name: 'Valen Songblade', wt: '1HS', lvl: 23, classes: ['bard', 'ranger'], proc: 'nature', fx: 'nature', bias: ['CHA', 'DEX'], lore: 'A bard\'s blade that chimes when it is swung.' },
    { id: 'u_dragonfang', name: 'Dragonfang', wt: '2HS', lvl: 47, classes: ['warrior', 'paladin', 'shadowknight', 'berserker'], proc: 'flame', fx: 'fire', bias: ['STR', 'STA'], lore: 'A wyrm\'s tooth set on a hilt. It still breathes fire.' },
    { id: 'u_stormhammer', name: 'Stormcaller Hammer', wt: '2HB', lvl: 33, classes: ['warrior', 'paladin', 'cleric', 'berserker'], proc: 'stun', fx: 'storm', bias: ['STR', 'WIS'], lore: 'Lightning answers when it strikes stone.' },
  ];
  // ---------- class starting kits (EverQuest style) ----------
  D.CLASS_KITS = {
    warrior: { wt: '1HS', name: 'Rusty Short Sword', shield: 'Dented Round Shield' },
    paladin: { wt: '1HS', name: 'Squire\'s Short Sword', shield: 'Dented Round Shield' },
    shadowknight: { wt: '2HS', name: 'Rusty Two-Handed Sword', look: 'sword' },
    ranger: { wt: '1HS', name: 'Rusty Short Sword', range: 'ARC' },
    bard: { wt: '1HS', name: 'Worn Short Sword' },
    rogue: { wt: '1HP', name: 'Rusty Dagger', range: 'THR', off: 'Chipped Dagger' },
    monk: { wt: 'H2H', name: 'Cloth Hand Wraps' },
    berserker: { wt: '2HS', name: 'Rusty Battle Axe', axe: true },
    beastlord: { wt: 'H2H', name: 'Leather Hand Wraps' },
    cleric: { wt: '1HB', name: 'Worn Mace', shield: 'Dented Round Shield' },
    druid: { wt: '1HB', name: 'Oak Club', club: true, shield: 'Wooden Buckler', wood: true },
    shaman: { wt: '1HB', name: 'Bone Club', club: true, shield: 'Wooden Buckler', wood: true },
    necromancer: { wt: '1HP', name: 'Ritual Dagger' },
    wizard: { wt: '1HP', name: 'Worn Dagger' },
    magician: { wt: '1HP', name: 'Summoned Dagger' },
    enchanter: { wt: '1HP', name: 'Ornate Dagger' },
    arquebusier: { wt: '1HS', name: 'Worn Hanger', range: 'GUN', rangeItem: 'Battered Matchlock' },
    trollcaller: { wt: '2HB', name: 'Mossy Troll Staff', wood: true },
  };
  // (crafting is gone: no crafts, refining benches or class sets)
  // ---------- Mobs ----------
  // kind -> sprite family; ranged: archer/caster behavior; heal: heals allies; undead flag
  D.MOBS = {
    rat: { name: 'Giant Rat', kind: 'rat', col: '#7b6656', lv: [1, 4], drop: 'Rat Whisker', mat: 'hide' },
    snake: { name: 'Grass Snake', kind: 'snake', col: '#5f8a3a', lv: [1, 5], drop: 'Snake Scale', mat: 'hide', res: { poison: 30 } },
    beetle: { name: 'Fire Beetle', kind: 'beetle', col: '#9a3a22', lv: [1, 5], drop: 'Glowing Gland', res: { fire: 25 } },
    bat: { name: 'Cave Bat', kind: 'bat', col: '#4a3c4a', lv: [1, 5], drop: 'Bat Wing', fly: true },
    wolf: { name: 'Gray Wolf', kind: 'wolf', col: '#8b8b88', lv: [3, 9], drop: 'Wolf Pelt', mat: 'hide', social: true },
    boar: { name: 'Wild Boar', kind: 'boar', col: '#6b4a34', lv: [2, 8], drop: 'Boar Meat', mat: 'hide' },
    spiderling: { name: 'Spiderling', kind: 'spider', col: '#3a3436', lv: [1, 5], drop: 'Spider Silk', mat: 'cloth', res: { poison: 20 } },
    wisp: { name: 'Glade Wisp', kind: 'wisp', col: '#bff3ff', lv: [3, 8], drop: 'Wisp Essence', mat: 'arcane', ranged: 'caster', res: { magic: 30 }, fly: true },
    scarecrow: { name: 'Animated Scarecrow', kind: 'scarecrow', col: '#c4a25a', lv: [3, 8], drop: 'Straw Bundle', res: { fire: -30 } },
    // Goblins (Iron lands)
    gob_whelp: { name: 'Goblin Whelp', kind: 'goblin', col: '#6aa84f', lv: [2, 7], drop: 'Goblin Ear', social: true, coin: 1.2 },
    gob_scout: { name: 'Goblin Scout', kind: 'goblin', col: '#5d9c45', lv: [5, 10], drop: 'Goblin Ear', social: true, ranged: 'archer', coin: 1.2 },
    gob_warrior: { name: 'Goblin Warrior', kind: 'goblin', col: '#4e8a3a', lv: [9, 16], drop: 'Goblin Totem', social: true, weapon: 'axe', coin: 1.3, mat: 'metal' },
    gob_shaman: { name: 'Goblin Shaman', kind: 'goblin', col: '#5f9a7a', lv: [10, 17], drop: 'Goblin Totem', social: true, ranged: 'caster', heal: true, coin: 1.3, mat: 'arcane' },
    gob_archer: { name: 'Goblin Archer', kind: 'goblin', col: '#6a9a40', lv: [10, 17], drop: 'Goblin Totem', social: true, ranged: 'archer', coin: 1.3 },
    cave_bear: { name: 'Cave Bear', kind: 'bear', col: '#5a4232', lv: [12, 18], drop: 'Bear Claw', mat: 'hide' },
    giant_spider: { name: 'Giant Spider', kind: 'spider', col: '#2a2426', lv: [12, 19], drop: 'Venom Sac', mat: 'cloth', res: { poison: 40 } },
    // Orcs (Sylvan lands)
    orc_pawn: { name: 'Orc Pawn', kind: 'orc', col: '#5f7a43', lv: [3, 9], drop: 'Orc Tooth', social: true, coin: 1.2 },
    orc_grunt: { name: 'Orc Grunt', kind: 'orc', col: '#55703c', lv: [9, 15], drop: 'Orc Warband Badge', social: true, weapon: 'axe', coin: 1.3, mat: 'metal' },
    orc_shaman: { name: 'Orc Shaman', kind: 'orc', col: '#5d7a5a', lv: [10, 16], drop: 'Orc Warband Badge', social: true, ranged: 'caster', heal: true, coin: 1.3, mat: 'arcane' },
    orc_archer: { name: 'Orc Bowman', kind: 'orc', col: '#607a45', lv: [10, 16], drop: 'Orc Warband Badge', social: true, ranged: 'archer', coin: 1.3 },
    orc_centurion: { name: 'Orc Centurion', kind: 'orc', col: '#4c6634', lv: [14, 19], drop: 'Orc Warband Badge', social: true, weapon: 'sword', coin: 1.5, mat: 'metal' },
    dire_wolf: { name: 'Dire Wolf', kind: 'wolf', col: '#5d5852', lv: [11, 22], drop: 'Dire Wolf Pelt', social: true, mat: 'hide' },
    treant: { name: 'Blighted Treant', kind: 'treant', col: '#5c4a2c', lv: [14, 19], drop: 'Heartwood', res: { fire: -40 }, mat: 'arcane' },
    // Bandits (Crown lands)
    cutpurse: { name: 'Rat Tail Cutpurse', kind: 'bandit', col: '#6b4f3a', lv: [3, 9], drop: 'Stolen Coin Purse', social: true, coin: 1.6 },
    thug: { name: 'Bandit Thug', kind: 'bandit', col: '#5a3f30', lv: [9, 15], drop: 'Bandit Bandana', social: true, weapon: 'mace', coin: 1.6, mat: 'metal' },
    bandit_archer: { name: 'Bandit Archer', kind: 'bandit', col: '#4f5a35', lv: [10, 16], drop: 'Bandit Bandana', social: true, ranged: 'archer', coin: 1.6 },
    bandit_mage: { name: 'Renegade Mage', kind: 'bandit', col: '#5a3a6a', lv: [11, 17], drop: 'Bandit Bandana', social: true, ranged: 'caster', coin: 1.7, mat: 'arcane' },
    highwayman: { name: 'Highwayman', kind: 'bandit', col: '#3a3a40', lv: [13, 19], drop: 'Bandit Bandana', social: true, weapon: 'sword', coin: 1.8, mat: 'metal' },
    // Crossroads wilds
    harpy: { name: 'Harpy', kind: 'harpy', col: '#a87e5a', lv: [15, 24], drop: 'Harpy Feather', fly: true, ranged: 'caster', res: { cold: 10 } },
    ogre: { name: 'Hill Ogre', kind: 'ogre', col: '#9a8460', lv: [18, 26], drop: 'Ogre Tusk', weapon: 'club', coin: 1.4, mat: 'hide' },
    griffon: { name: 'Griffon', kind: 'griffon', col: '#c9a35a', lv: [20, 26], drop: 'Griffon Feather', fly: true, mat: 'hide' },
    // Dreadmire swamp
    lizard_warrior: { name: 'Lizardman Warrior', kind: 'lizard', col: '#4f7a5a', lv: [18, 25], drop: 'Lizard Scale', social: true, weapon: 'spear', coin: 1.3, mat: 'hide' },
    lizard_shaman: { name: 'Lizardman Shaman', kind: 'lizard', col: '#5a7a6a', lv: [19, 26], drop: 'Swamp Lily', social: true, ranged: 'caster', heal: true, mat: 'arcane' },
    bog_zombie: { name: 'Bog Zombie', kind: 'zombie', col: '#6a7a5a', lv: [20, 27], drop: 'Rotting Bone', undead: true, res: { disease: 50, poison: 50 } },
    swamp_troll: { name: 'Swamp Troll', kind: 'troll', col: '#5a7050', lv: [22, 28], drop: 'Troll Hide', mat: 'hide', regen: true },
    mosquito: { name: 'Giant Mosquito', kind: 'mosquito', col: '#5a4a3a', lv: [18, 23], drop: 'Proboscis', fly: true },
    croc: { name: 'Mire Crocodile', kind: 'croc', col: '#4a5a3a', lv: [20, 27], drop: 'Croc Tooth', mat: 'hide' },
    // Ashen barrows (undead)
    skel_warrior: { name: 'Skeletal Warrior', kind: 'skeleton', col: '#e6dfc8', lv: [25, 33], drop: 'Bone Chips', undead: true, social: true, weapon: 'sword', res: { cold: 30, poison: 60 }, mat: 'metal' },
    skel_archer: { name: 'Skeletal Archer', kind: 'skeleton', col: '#d8d0b8', lv: [25, 33], drop: 'Bone Chips', undead: true, social: true, ranged: 'archer', res: { cold: 30, poison: 60 } },
    ghoul: { name: 'Ghoul', kind: 'zombie', col: '#7a8a7a', lv: [27, 35], drop: 'Ghoul Claw', undead: true, res: { disease: 60 } },
    wraith: { name: 'Barrow Wraith', kind: 'ghost', col: '#9ab0c8', lv: [28, 36], drop: 'Ectoplasm', undead: true, fly: true, ranged: 'caster', res: { cold: 50, magic: 20 }, mat: 'arcane' },
    cultist: { name: 'Ashen Cultist', kind: 'bandit', col: '#3a1f2a', lv: [27, 35], drop: 'Cult Sigil', ranged: 'caster', coin: 1.8, mat: 'cloth' },
    // Ironspine
    mtn_troll: { name: 'Mountain Troll', kind: 'troll', col: '#6f7a80', lv: [30, 38], drop: 'Troll Hide', mat: 'hide', regen: true },
    hill_giant: { name: 'Hill Giant', kind: 'giant', col: '#a08a6a', lv: [33, 40], drop: 'Giant Toe', weapon: 'club', coin: 1.6, mat: 'metal' },
    stone_golem: { name: 'Stone Golem', kind: 'golem', col: '#8a8a84', lv: [32, 40], drop: 'Golem Core', res: { fire: 30, cold: 30, poison: 90 }, mat: 'metal' },
    wyvern: { name: 'Wyvern', kind: 'drake', col: '#5a7a8a', lv: [34, 41], drop: 'Wyvern Scale', fly: true, mat: 'hide' },
    frost_wolf: { name: 'Frost Wolf', kind: 'wolf', col: '#cfe0ea', lv: [30, 37], drop: 'Frost Pelt', social: true, res: { cold: 60 }, mat: 'hide' },
    // Gloamreach (deep undead)
    death_knight: { name: 'Death Knight', kind: 'deathknight', col: '#2c2a36', lv: [42, 50], drop: 'Cursed Plate Shard', undead: true, weapon: 'sword', res: { cold: 50, disease: 50, poison: 70 }, mat: 'metal', coin: 2 },
    banshee: { name: 'Banshee', kind: 'ghost', col: '#c8d8ff', lv: [41, 49], drop: 'Wailing Essence', undead: true, fly: true, ranged: 'caster', res: { cold: 60, magic: 30 }, mat: 'arcane' },
    lich_acolyte: { name: 'Lich Acolyte', kind: 'lich', col: '#3a2a4a', lv: [43, 50], drop: 'Phylactery Shard', undead: true, ranged: 'caster', res: { cold: 40, magic: 40 }, mat: 'arcane', coin: 2 },
    shadow_wraith: { name: 'Shadow Wraith', kind: 'ghost', col: '#40384f', lv: [40, 48], drop: 'Ectoplasm', undead: true, fly: true, res: { cold: 60 }, mat: 'cloth' },
    // Dragonfall
    drake: { name: 'Ember Drake', kind: 'drake', col: '#b4482a', lv: [42, 50], drop: 'Drake Scale', fly: true, res: { fire: 70, cold: -30 }, mat: 'hide' },
    fire_elem: { name: 'Fire Elemental', kind: 'elemental', col: '#ff7a2a', lv: [43, 50], drop: 'Ember Essence', res: { fire: 95, cold: -40 }, mat: 'arcane' },
    salamander: { name: 'Salamander', kind: 'lizard', col: '#c8582a', lv: [42, 49], drop: 'Ember Essence', res: { fire: 80 }, social: true, mat: 'hide' },
    dragonkin: { name: 'Dragonkin Warrior', kind: 'lizard', col: '#8a3a2a', lv: [45, 50], drop: 'Dragonkin Fang', weapon: 'sword', social: true, res: { fire: 60 }, mat: 'metal', coin: 2 },
    // Gnollrock Warren (cave)
    tunnel_goblin: { name: 'Tunnel Goblin', kind: 'goblin', col: '#7a9a4a', lv: [8, 13], drop: 'Goblin Totem', social: true, weapon: 'dagger', coin: 1.3, mat: 'metal' },
    gob_mystic: { name: 'Goblin Mystic', kind: 'goblin', col: '#6a8aa0', lv: [9, 15], drop: 'Goblin Totem', social: true, ranged: 'caster', heal: true, coin: 1.3, mat: 'arcane' },
    // sewers beneath the two capitals (levels 1-10)
    sewer_rat: { name: 'Sewer Rat', kind: 'rat', col: '#6a5a48', lv: [1, 5], drop: 'Rat Whisker', mat: 'hide', scale: 1.1 },
    ratt_scout: { name: 'Rat Tail Scout', kind: 'bandit', col: '#4e4234', lv: [3, 8], drop: 'Stolen Coin Purse', social: true, ranged: 'archer', coin: 1.6, mat: 'hide' },
    ratt_bruiser: { name: 'Rat Tail Bruiser', kind: 'bandit', col: '#3e3228', lv: [5, 10], drop: 'Stolen Coin Purse', social: true, weapon: 'mace', coin: 1.7, mat: 'metal' },
    ratt_hexer: { name: 'Rat Tail Hedge-Mage', kind: 'bandit', col: '#4a3a5a', lv: [4, 10], drop: 'Stolen Coin Purse', social: true, ranged: 'caster', coin: 1.6, mat: 'arcane' },
    orc_sneak: { name: 'Orc Drain-Sneak', kind: 'orc', col: '#5a7040', lv: [2, 7], drop: 'Orc Tooth', social: true, weapon: 'dagger', coin: 1.2 },
    orc_sewerscout: { name: 'Orc Sewer Scout', kind: 'orc', col: '#56703c', lv: [3, 8], drop: 'Orc Tooth', social: true, ranged: 'archer', coin: 1.2, mat: 'hide' },
    orc_bogshaman: { name: 'Orc Bog-Shaman', kind: 'orc', col: '#4a6a5a', lv: [4, 10], drop: 'Orc Tooth', social: true, ranged: 'caster', heal: true, coin: 1.3, mat: 'arcane' },
    orc_brute: { name: 'Orc Tunnel Brute', kind: 'orc', col: '#4a5e32', lv: [6, 10], drop: 'Orc Tooth', social: true, weapon: 'axe', coin: 1.4, mat: 'metal', scale: 1.15 },
    n_fingers: { name: 'Fingers Fenwick', kind: 'bandit', col: '#6a3a2a', lv: [6, 6], drop: 'Stolen Coin Purse', named: true, weapon: 'dagger', coin: 3, scale: 1.15 },
    n_gnawbone: { name: 'Gnawbone', kind: 'rat', col: '#8a7a6a', lv: [5, 5], drop: 'Rat Whisker', named: true, mat: 'hide', scale: 1.8 },
    n_skulk: { name: 'Skulk the Drowned', kind: 'orc', col: '#3a5a4a', lv: [7, 7], drop: 'Orc Tooth', named: true, weapon: 'axe', coin: 3, scale: 1.25 },
    warren_rat: { name: 'Warren Rat', kind: 'rat', col: '#5a4a40', lv: [8, 12], drop: 'Rat Whisker', mat: 'hide', scale: 1.4 },
    vampire_bat: { name: 'Vampire Bat', kind: 'bat', col: '#5a2a3a', lv: [9, 14], drop: 'Bat Wing', fly: true },
    rock_spider: { name: 'Rock Spider', kind: 'spider', col: '#6a5a4a', lv: [11, 16], drop: 'Venom Sac', mat: 'cloth', res: { poison: 30 } },
    n_grizzlefang: { name: 'Grizzlefang', kind: 'goblin', col: '#a0a040', lv: [14, 14], drop: 'Goblin Totem', named: true, weapon: 'axe', coin: 3, mat: 'metal', scale: 1.3 },
    n_skitterjaw: { name: 'Skitterjaw', kind: 'spider', col: '#8a3a2a', lv: [13, 13], drop: 'Venom Sac', named: true, mat: 'cloth', scale: 1.6 },
    n_mossback: { name: 'Old Mossback', kind: 'bear', col: '#4a6a3a', lv: [15, 15], drop: 'Bear Claw', named: true, mat: 'hide', scale: 1.5 },
    // Crypt of the Forsaken
    crypt_guardian: { name: 'Crypt Guardian', kind: 'deathknight', col: '#6a6470', lv: [29, 35], drop: 'Bone Chips', undead: true, weapon: 'sword', res: { cold: 40, poison: 60 }, mat: 'metal', coin: 1.6 },
    crypt_priest: { name: 'Crypt Priest', kind: 'lich', col: '#5a4a6a', lv: [29, 36], drop: 'Cult Sigil', undead: true, ranged: 'caster', heal: true, res: { cold: 40, magic: 30 }, mat: 'cloth', coin: 1.6 },
    n_rattlebones: { name: 'Sir Rattlebones', kind: 'skeleton', col: '#f0e8c8', lv: [33, 33], drop: 'Bone Chips', named: true, undead: true, weapon: 'sword', mat: 'metal', scale: 1.4 },
    n_widow: { name: 'The Weeping Widow', kind: 'ghost', col: '#d8c8f0', lv: [34, 34], drop: 'Ectoplasm', named: true, undead: true, fly: true, ranged: 'caster', mat: 'arcane', scale: 1.4 },
    n_gravecaller: { name: 'Gravecaller Moth', kind: 'lich', col: '#4a3a2a', lv: [35, 35], drop: 'Phylactery Shard', named: true, undead: true, ranged: 'caster', mat: 'arcane', scale: 1.3 },
    // Frostfang Caverns
    ice_troll: { name: 'Ice Troll', kind: 'troll', col: '#a8c8d8', lv: [36, 43], drop: 'Troll Hide', mat: 'hide', regen: true, res: { cold: 60 } },
    frost_golem: { name: 'Frost Golem', kind: 'golem', col: '#c8e0f0', lv: [38, 45], drop: 'Golem Core', res: { cold: 90, fire: -30 }, mat: 'metal' },
    ice_spider: { name: 'Ice Weaver', kind: 'spider', col: '#9ad0f0', lv: [37, 43], drop: 'Venom Sac', mat: 'cloth', res: { cold: 50 } },
    yeti: { name: 'Frostfang Yeti', kind: 'ogre', col: '#e8f0f4', lv: [38, 45], drop: 'Yeti Fur', mat: 'hide', social: true, res: { cold: 70 } },
    n_whitefang: { name: 'Whitefang', kind: 'wolf', col: '#ffffff', lv: [43, 43], drop: 'Frost Pelt', named: true, mat: 'hide', scale: 1.6 },
    n_glacius: { name: 'Glacius', kind: 'golem', col: '#9ae0ff', lv: [44, 44], drop: 'Golem Core', named: true, mat: 'metal', scale: 1.5 },
    n_frostmaw: { name: 'Frostmaw', kind: 'ogre', col: '#d0e8ff', lv: [45, 45], drop: 'Yeti Fur', named: true, mat: 'hide', scale: 1.5 },
    // Sunscour Desert
    sand_scorpion: { name: 'Sand Scorpion', kind: 'spider', col: '#c8a060', lv: [20, 26], drop: 'Scorpion Stinger', mat: 'hide', res: { poison: 40 } },
    dune_jackal: { name: 'Dune Jackal', kind: 'wolf', col: '#c8a878', lv: [20, 25], drop: 'Jackal Hide', mat: 'hide', social: true },
    nomad_raider: { name: 'Nomad Raider', kind: 'bandit', col: '#c8a868', lv: [22, 28], drop: 'Nomad Scarf', social: true, weapon: 'sword', coin: 1.7, mat: 'metal' },
    sand_golem: { name: 'Sandstone Golem', kind: 'golem', col: '#d8b880', lv: [25, 30], drop: 'Golem Core', res: { fire: 40 }, mat: 'metal' },
    giant_scarab: { name: 'Giant Scarab', kind: 'beetle', col: '#3a6a8a', lv: [21, 27], drop: 'Scarab Shell', scale: 1.6, mat: 'arcane' },
    mummy: { name: 'Desert Mummy', kind: 'zombie', col: '#d8c8a0', lv: [25, 30], drop: 'Ancient Wrappings', undead: true, res: { fire: -30, disease: 60 }, mat: 'cloth' },
    // Isle of Tidesong
    shore_crab: { name: 'Shore Crab', kind: 'beetle', col: '#d0503a', lv: [20, 26], drop: 'Crab Shell', scale: 1.5, mat: 'hide' },
    island_tiger: { name: 'Island Tiger', kind: 'tiger', col: '#e08a3a', lv: [24, 32], drop: 'Tiger Pelt', mat: 'hide' },
    pirate: { name: 'Blackfin Pirate', kind: 'bandit', col: '#3a3a5a', lv: [26, 34], drop: 'Pirate Doubloon', social: true, weapon: 'sword', coin: 2, mat: 'metal' },
    pirate_mage: { name: 'Pirate Hexer', kind: 'bandit', col: '#5a2a5a', lv: [27, 34], drop: 'Pirate Doubloon', social: true, ranged: 'caster', coin: 2, mat: 'arcane' },
    sea_harpy: { name: 'Sea Harpy', kind: 'harpy', col: '#6a9ab0', lv: [28, 36], drop: 'Harpy Feather', fly: true, ranged: 'caster', mat: 'cloth' },
    coral_golem: { name: 'Coral Golem', kind: 'golem', col: '#e07a8a', lv: [32, 40], drop: 'Living Coral', res: { cold: 40 }, mat: 'arcane' },
    reef_croc: { name: 'Reef Crocodile', kind: 'croc', col: '#3a6a5a', lv: [30, 38], drop: 'Croc Tooth', mat: 'hide' },
    // Sunken Temple
    temple_lizard: { name: 'Temple Lizardman', kind: 'lizard', col: '#3a7a7a', lv: [32, 38], drop: 'Lizard Scale', social: true, weapon: 'spear', mat: 'hide', coin: 1.5 },
    tide_priest: { name: 'Tide Priest', kind: 'lizard', col: '#4a6a9a', lv: [33, 39], drop: 'Pearl', social: true, ranged: 'caster', heal: true, mat: 'arcane', coin: 1.6 },
    water_elem: { name: 'Water Elemental', kind: 'water_elemental', col: '#3a8ad8', lv: [34, 40], drop: 'Pearl', res: { cold: 70, fire: 50 }, mat: 'arcane' },
    n_coralback: { name: 'Coralback', kind: 'croc', col: '#e07a6a', lv: [38, 38], drop: 'Croc Tooth', named: true, mat: 'hide', scale: 1.6 },
    n_tidecaller: { name: 'Tidecaller Ssirn', kind: 'lizard', col: '#2a5aaa', lv: [39, 39], drop: 'Pearl', named: true, ranged: 'caster', mat: 'arcane', scale: 1.3 },
    n_deepscale: { name: 'Deepscale', kind: 'lizard', col: '#1a4a4a', lv: [39, 39], drop: 'Lizard Scale', named: true, weapon: 'spear', mat: 'hide', scale: 1.4 },
    // Blackscar Wastes (50-56)
    ravager: { name: 'Blackscar Ravager', kind: 'troll', col: '#3a2a2a', lv: [50, 56], drop: 'Ravager Horn', mat: 'hide', regen: true, coin: 2 },
    ash_fiend: { name: 'Ash Fiend', kind: 'elemental', col: '#8a2a1a', lv: [51, 56], drop: 'Fiend Ember', res: { fire: 90 }, mat: 'arcane', coin: 2 },
    doomguard: { name: 'Doomguard', kind: 'deathknight', col: '#2a1a2a', lv: [52, 59], drop: 'Cursed Plate Shard', undead: true, weapon: 'sword', res: { cold: 60, poison: 80 }, mat: 'metal', coin: 2.5 },
    void_wraith: { name: 'Void Wraith', kind: 'ghost', col: '#5a3a8a', lv: [51, 58], drop: 'Void Essence', undead: true, fly: true, ranged: 'caster', res: { magic: 60 }, mat: 'cloth', coin: 2 },
    // Abyssal Depths
    abyss_fiend: { name: 'Abyssal Fiend', kind: 'fire_elemental', col: '#c0201a', lv: [52, 58], drop: 'Fiend Ember', res: { fire: 95 }, mat: 'arcane', coin: 2.5 },
    abyss_lich: { name: 'Abyssal Lich', kind: 'lich', col: '#2a1a3a', lv: [54, 60], drop: 'Phylactery Shard', undead: true, ranged: 'caster', res: { cold: 60, magic: 60 }, mat: 'arcane', coin: 2.5 },
    n_soulflayer: { name: 'Soulflayer Xiv', kind: 'lich', col: '#6a1a5a', lv: [58, 58], drop: 'Phylactery Shard', named: true, undead: true, ranged: 'caster', mat: 'arcane', scale: 1.4 },
    n_bloodgorger: { name: 'Bloodgorger', kind: 'troll', col: '#6a1a1a', lv: [57, 57], drop: 'Ravager Horn', named: true, mat: 'hide', scale: 1.6 },
    n_umbra: { name: 'Umbra the Unseen', kind: 'ghost', col: '#1a1a2a', lv: [58, 58], drop: 'Void Essence', named: true, undead: true, fly: true, mat: 'cloth', scale: 1.4 },
    // Skyreach Summit (55-60)
    storm_giant: { name: 'Storm Giant', kind: 'giant', col: '#8aa0c8', lv: [54, 60], drop: 'Storm Crystal', weapon: 'club', coin: 2.5, mat: 'metal', res: { magic: 40 } },
    sky_griffon: { name: 'Sky Griffon', kind: 'griffon', col: '#e8e0c8', lv: [52, 58], drop: 'Griffon Feather', fly: true, mat: 'hide' },
    thunder_drake: { name: 'Thunder Drake', kind: 'drake', col: '#4a6aaa', lv: [55, 60], drop: 'Drake Scale', fly: true, mat: 'hide', res: { magic: 50 } },
    cloud_elemental: { name: 'Cloud Elemental', kind: 'air_elemental', col: '#d8e8f8', lv: [53, 59], drop: 'Storm Crystal', ranged: 'caster', mat: 'arcane', res: { magic: 70 } },
    harpy_matriarch: { name: 'Harpy Matriarch', kind: 'harpy', col: '#a87ac8', lv: [52, 57], drop: 'Harpy Feather', fly: true, ranged: 'caster', mat: 'cloth' },
    // City guards & kings
    guard: { name: 'Guard', kind: 'guard', col: '#888', lv: [55, 55], guard: true },
  };  // ---------- monster classes and abilities ----------
  // Monsters learn 1 ability below level 10, 2 by 10, 3 by 22 and 4 by 38. Damage is modest and crowd control on players is capped.
  const SP = (o) => Object.assign({ kind: 'spell', school: 'Evocation', mob: true }, o);
  const AB = (o) => Object.assign({ kind: 'mobab', mob: true }, o);
  D.MOB_ABILITIES = {
    bash: AB({ name: 'Bash', icon: '🛡', cd: 14, range: 'melee', target: 'enemy', effects: [{ t: 'hit', amt: [3, 1.0] }, { t: 'stun', dur: 1 }], sfx: 'bash' }),
    kick: AB({ name: 'Kick', icon: '🦶', cd: 8, range: 'melee', target: 'enemy', effects: [{ t: 'hit', amt: [3, 1.2] }], sfx: 'kick' }),
    enrage: AB({ name: 'Battle Rage', icon: '😡', cd: 40, target: 'self', effects: [{ t: 'buff', name: 'Battle Rage', mods: { dmgMul: 0.2 }, dur: 15 }], sfx: 'rage', when: 'hurt' }),
    cleave: AB({ name: 'Cleave', icon: '🪓', cd: 16, target: 'pbae', radius: 70, effects: [{ t: 'hit', amt: [3, 1.1] }], sfx: 'whirl' }),
    slam: AB({ name: 'Crushing Slam', icon: '💥', cd: 18, range: 'melee', target: 'enemy', effects: [{ t: 'hit', amt: [5, 1.5] }, { t: 'stun', dur: 1 }], sfx: 'heavy' }),
    stomp: AB({ name: 'Stomp', icon: '🦶', cd: 22, target: 'pbae', radius: 90, effects: [{ t: 'hit', amt: [4, 1.2] }, { t: 'snare', pct: 0.4, dur: 5 }], sfx: 'heavy' }),
    backstab: AB({ name: 'Backstab', icon: '🔪', cd: 12, range: 'melee', target: 'enemy', effects: [{ t: 'hit', amt: [5, 1.6] }], sfx: 'stab' }),
    poisonblade: AB({ name: 'Poisoned Blade', icon: '🧪', cd: 18, range: 'melee', target: 'enemy', effects: [{ t: 'dot', amt: [2, 0.6], dur: 12, res: 'poison' }], sfx: 'poison' }),
    trip: AB({ name: 'Trip', icon: '🪢', cd: 20, range: 'melee', target: 'enemy', effects: [{ t: 'snare', pct: 0.5, dur: 5 }], sfx: 'whoosh' }),
    pinshot: AB({ name: 'Pinning Shot', icon: '🏹', cd: 16, range: 360, target: 'enemy', effects: [{ t: 'hit', amt: [3, 1.1], ranged: true }, { t: 'snare', pct: 0.4, dur: 5 }], sfx: 'bow' }),
    volley: AB({ name: 'Volley', icon: '🌧', cd: 20, range: 360, target: 'enemy', effects: [{ t: 'hit', amt: [2, 0.8], ranged: true }, { t: 'hit', amt: [2, 0.8], ranged: true }], sfx: 'volley' }),
    snareshot: AB({ name: 'Ensnaring Arrow', icon: '🌱', cd: 26, range: 360, target: 'enemy', effects: [{ t: 'root', dur: 2.5 }], sfx: 'bow' }),
    frostbolt: SP({ name: 'Frost Bolt', icon: '❄', type: 'nuke', res: 'cold', cd: 10, cast: 1.2, range: 380, target: 'enemy', effects: [{ t: 'dmg', amt: [4, 1.5], res: 'cold' }, { t: 'snare', pct: 0.3, dur: 4 }] }),
    firebolt: SP({ name: 'Fire Bolt', icon: '🔥', type: 'nuke', res: 'fire', cd: 9, cast: 1.2, range: 380, target: 'enemy', effects: [{ t: 'dmg', amt: [5, 1.7], res: 'fire' }] }),
    shock: SP({ name: 'Shock', icon: '⚡', type: 'nuke', res: 'magic', cd: 8, cast: 1, range: 380, target: 'enemy', effects: [{ t: 'dmg', amt: [4, 1.5], res: 'magic' }] }),
    mheal: SP({ name: 'Healing', icon: '✚', type: 'heal', school: 'Alteration', cd: 12, cast: 1.5, range: 320, target: 'ally', effects: [{ t: 'healpct', pct: 0.25 }], when: 'allyhurt' }),
    weaken: SP({ name: 'Weakness', icon: '🔻', type: 'resistdebuff', school: 'Alteration', cd: 30, cast: 1.2, range: 380, target: 'enemy', effects: [{ t: 'debuff', name: 'Weakness', mods: { dmgMul: -0.15 }, dur: 20, res: 'magic' }] }),
    spiritpoison: SP({ name: 'Spirit Poison', icon: '☣', type: 'dot', res: 'poison', school: 'Conjuration', cd: 18, cast: 1.2, range: 380, target: 'enemy', effects: [{ t: 'dot', amt: [2, 0.7], dur: 15, res: 'poison' }] }),
    mroot: SP({ name: 'Root', icon: '🌿', type: 'root', school: 'Alteration', cd: 26, cast: 1, range: 380, target: 'enemy', effects: [{ t: 'root', dur: 3, res: 'magic' }] }),
    frostnova: SP({ name: 'Frost Nova', icon: '❄', type: 'pbae', res: 'cold', cd: 28, cast: 1, target: 'pbae', radius: 110, effects: [{ t: 'dmg', amt: [4, 1.3], res: 'cold' }, { t: 'root', dur: 2 }] }),
    smite: SP({ name: 'Smite', icon: '☀', type: 'nuke', res: 'magic', school: 'Evocation', cd: 10, cast: 1.2, range: 380, target: 'enemy', effects: [{ t: 'dmg', amt: [4, 1.5], res: 'magic' }] }),
    ward: SP({ name: 'Ward', icon: '🔷', type: 'rune', school: 'Abjuration', cd: 45, cast: 1, target: 'self', effects: [{ t: 'rune', amt: [10, 4], dur: 30 }], when: 'fighting' }),
    drain: SP({ name: 'Life Drain', icon: '🩸', type: 'tap', school: 'Alteration', cd: 12, cast: 1.2, range: 360, target: 'enemy', effects: [{ t: 'tap', amt: [4, 1.3] }] }),
    rot: SP({ name: 'Rot', icon: '🦠', type: 'dot', res: 'disease', school: 'Conjuration', cd: 16, cast: 1.2, range: 380, target: 'enemy', effects: [{ t: 'dot', amt: [2, 0.7], dur: 15, res: 'disease' }] }),
    terrify: SP({ name: 'Terrify', icon: '😱', type: 'stun', school: 'Divination', cd: 30, cast: 1, range: 300, target: 'enemy', effects: [{ t: 'stun', dur: 1.5, terror: true }] }),
    chill: SP({ name: 'Grave Chill', icon: '🥶', type: 'nuke', res: 'cold', cd: 11, cast: 1, range: 360, target: 'enemy', effects: [{ t: 'dmg', amt: [4, 1.3], res: 'cold' }, { t: 'snare', pct: 0.35, dur: 5 }] }),
    web: AB({ name: 'Web', icon: '🕸', cd: 18, range: 'melee', target: 'enemy', effects: [{ t: 'snare', pct: 0.5, dur: 6 }], sfx: 'poison' }),
    venom: AB({ name: 'Venomous Bite', icon: '🕷', cd: 14, range: 'melee', target: 'enemy', effects: [{ t: 'dot', amt: [2, 0.7], dur: 12, res: 'poison' }], sfx: 'poison' }),
    entangle: AB({ name: 'Entangling Web', icon: '🕸', cd: 30, range: 'melee', target: 'enemy', effects: [{ t: 'root', dur: 3 }], sfx: 'poison' }),
    spit: AB({ name: 'Venomous Spit', icon: '💧', cd: 12, range: 'melee', target: 'enemy', effects: [{ t: 'hit', amt: [3, 1.1] }, { t: 'dot', amt: [1, 0.4], dur: 9, res: 'poison' }], sfx: 'poison' }),
    hamstring: AB({ name: 'Hamstring', icon: '🐺', cd: 15, range: 'melee', target: 'enemy', effects: [{ t: 'hit', amt: [2, 0.9] }, { t: 'snare', pct: 0.4, dur: 5 }], sfx: 'slash' }),
    howl: AB({ name: 'Howl', icon: '🌕', cd: 40, target: 'self', effects: [{ t: 'buff', name: 'Howl', mods: { haste: 0.25 }, dur: 15 }], sfx: 'warcry' }),
    rend: AB({ name: 'Rend', icon: '🩸', cd: 14, range: 'melee', target: 'enemy', effects: [{ t: 'dot', amt: [2, 0.7], dur: 12 }], sfx: 'slash' }),
    maul: AB({ name: 'Maul', icon: '🐻', cd: 16, range: 'melee', target: 'enemy', effects: [{ t: 'hit', amt: [5, 1.5] }, { t: 'stun', dur: 0.8 }], sfx: 'heavy' }),
    roar: AB({ name: 'Frightening Roar', icon: '🗯', cd: 30, target: 'enemy', range: 'melee', effects: [{ t: 'debuff', name: 'Shaken', mods: { dmgMul: -0.12 }, dur: 12 }], sfx: 'warcry' }),
    constrict: AB({ name: 'Constrict', icon: '🐍', cd: 24, range: 'melee', target: 'enemy', effects: [{ t: 'root', dur: 2 }, { t: 'dot', amt: [2, 0.6], dur: 9 }], sfx: 'poison' }),
    disease: AB({ name: 'Diseased Bite', icon: '🦠', cd: 14, range: 'melee', target: 'enemy', effects: [{ t: 'dot', amt: [1, 0.5], dur: 12, res: 'disease' }], sfx: 'poison' }),
    suck: AB({ name: 'Blood Drain', icon: '🦇', cd: 14, range: 'melee', target: 'enemy', effects: [{ t: 'tap', amt: [3, 1.0] }], sfx: 'dark' }),
    firespit: AB({ name: 'Searing Bite', icon: '🔥', cd: 12, range: 'melee', target: 'enemy', effects: [{ t: 'hit', amt: [3, 1.1] }], sfx: 'fire' }),
    charge: AB({ name: 'Charge', icon: '🐗', cd: 18, range: 260, target: 'enemy', effects: [{ t: 'lunge' }, { t: 'hit', amt: [4, 1.3] }], sfx: 'charge' }),
    screech: AB({ name: 'Screech', icon: '📢', cd: 24, range: 'melee', target: 'enemy', effects: [{ t: 'stun', dur: 1 }], sfx: 'stun' }),
    dive: AB({ name: 'Dive', icon: '🦅', cd: 16, range: 260, target: 'enemy', effects: [{ t: 'lunge' }, { t: 'hit', amt: [4, 1.3] }], sfx: 'charge' }),
    quake: AB({ name: 'Quake', icon: '🌋', cd: 26, target: 'pbae', radius: 100, effects: [{ t: 'hit', amt: [4, 1.2] }, { t: 'snare', pct: 0.4, dur: 4 }], sfx: 'heavy' }),
    flameaura: AB({ name: 'Flame Aura', icon: '🔥', cd: 45, target: 'self', effects: [{ t: 'buff', name: 'Flame Aura', mods: { ds: 6 }, dur: 20 }], sfx: 'fire' }),
    gust: AB({ name: 'Buffeting Wings', icon: '💨', cd: 14, range: 'melee', target: 'enemy', effects: [{ t: 'hit', amt: [3, 1.1] }, { t: 'snare', pct: 0.3, dur: 4 }], sfx: 'whoosh' }),
    breath: AB({ name: 'Fire Breath', icon: '🐉', cd: 22, range: 260, target: 'tae', radius: 90, effects: [{ t: 'dmg', amt: [5, 1.6], res: 'fire' }], sfx: 'fire' }),
    tailswipe: AB({ name: 'Tail Swipe', icon: '🦎', cd: 18, target: 'pbae', radius: 80, effects: [{ t: 'hit', amt: [4, 1.2] }], sfx: 'heavy' }),
    grab: AB({ name: 'Grasping Hands', icon: '🧟', cd: 24, range: 'melee', target: 'enemy', effects: [{ t: 'root', dur: 2 }], sfx: 'dark' }),
    pinch: AB({ name: 'Pinch', icon: '🦀', cd: 12, range: 'melee', target: 'enemy', effects: [{ t: 'hit', amt: [3, 1.1] }], sfx: 'blunt' }),
  };
  for (const k in D.MOB_ABILITIES) D.MOB_ABILITIES[k].id = 'mob:' + k;
  D.MOB_CLASS_KITS = {
    Warrior: ['kick', 'bash', 'enrage', 'cleave'], Brute: ['slam', 'enrage', 'stomp', 'kick'], Rogue: ['backstab', 'poisonblade', 'trip', 'kick'],
    Archer: ['pinshot', 'volley', 'snareshot', 'kick'], Shaman: ['frostbolt', 'mheal', 'spiritpoison', 'weaken'], Wizard: ['firebolt', 'mroot', 'shock', 'frostnova'],
    Cleric: ['smite', 'mheal', 'ward', 'weaken'], Necromancer: ['drain', 'rot', 'terrify', 'ward'], Shade: ['chill', 'drain', 'terrify', 'rot'], 'Death Knight': ['bash', 'drain', 'terrify', 'cleave'],
    Spider: ['web', 'venom', 'entangle', 'spit'], Wolf: ['hamstring', 'rend', 'howl', 'kick'], Bear: ['maul', 'rend', 'roar', 'enrage'], Serpent: ['venom', 'constrict', 'spit', 'rend'],
    Vermin: ['disease', 'suck', 'rend', 'trip'], Beetle: ['firespit', 'pinch', 'venom', 'enrage'], Boar: ['charge', 'rend', 'enrage', 'stomp'], Flyer: ['dive', 'screech', 'rend', 'gust'],
    Golem: ['slam', 'quake', 'stomp', 'enrage'], 'Fire Elemental': ['firebolt', 'flameaura', 'quake', 'shock'], 'Water Elemental': ['frostbolt', 'mroot', 'frostnova', 'quake'], 'Air Elemental': ['gust', 'shock', 'screech', 'frostnova'],
    Dragon: ['breath', 'tailswipe', 'roar', 'enrage'], Ghoul: ['disease', 'grab', 'rend', 'terrify'], Wisp: ['shock', 'ward', 'chill', 'mroot'], Scarecrow: ['terrify', 'kick', 'grab', 'rend'], Crab: ['pinch', 'bash', 'enrage', 'stomp'],
  };
  D.mobClassOf = function (id, M) {
    const n = (id + ' ' + (M.name || '')).toLowerCase();
    if (/shaman|mystic|tidecaller|tide_priest/.test(n)) return 'Shaman';
    if (/mage|wizard/.test(n)) return 'Wizard';
    if (/priest/.test(n)) return 'Cleric';
    if (/cultist|lich|gravecaller|soulflayer/.test(n)) return 'Necromancer';
    if (/archer|scout/.test(n)) return 'Archer';
    if (/cutpurse|highwayman|pirate|nomad|thug|raider/.test(n)) return 'Rogue';
    const K = M.kind;
    return ({ spider: 'Spider', wolf: 'Wolf', bear: 'Bear', tiger: 'Bear', snake: 'Serpent', croc: 'Serpent', lizard: 'Warrior', rat: 'Vermin', bat: 'Vermin', mosquito: 'Vermin', beetle: id.includes('crab') ? 'Crab' : 'Beetle', boar: 'Boar', harpy: 'Flyer', griffon: 'Flyer',
      golem: 'Golem', treant: 'Golem', elemental: id.includes('fire') || id.includes('ash') ? 'Fire Elemental' : 'Golem', fire_elemental: 'Fire Elemental', water_elemental: 'Water Elemental', air_elemental: 'Air Elemental', drake: 'Dragon', dragon: 'Dragon',
      zombie: 'Ghoul', ghost: 'Shade', lich: 'Necromancer', deathknight: 'Death Knight', skeleton: 'Warrior', wisp: 'Wisp', scarecrow: 'Scarecrow', troll: 'Brute', ogre: 'Brute', giant: 'Brute', orc: 'Warrior', goblin: 'Warrior', bandit: 'Warrior', guard: 'Warrior' })[K] || 'Warrior';
  };
  D.mobAbilityCount = (lv, named) => Math.min(4, (lv < 10 ? 1 : lv < 22 ? 2 : lv < 38 ? 3 : 4) + (named ? 1 : 0));


  // ---------- Regions ----------
  // biome: grass|forest|mountain|plains|swamp|ash|snow|gloom|volcanic|city
  D.REGIONS = [
    { id: 'aelindor', name: 'Aelindor', biome: 'cityforest', city: 'sylvan', seeds: [[500, 95]], lv: [0, 0], dark: 0 },
    { id: 'valenmoor', name: 'Valenmoor', biome: 'cityplains', city: 'crown', seeds: [[170, 440]], lv: [0, 0], dark: 0 },
    { id: 'sunleaf', name: 'Sunleaf Glade', biome: 'forest', seeds: [[420, 70], [590, 70], [500, 180], [420, 165]], lv: [1, 9], dark: 0, mobs: ['rat', 'spiderling', 'bat', 'wisp', 'wolf', 'orc_pawn', 'orc_pawn', 'snake'], faction: 'sylvan', music: 'forest' },
    { id: 'greywood', name: 'Greywood', biome: 'darkforest', seeds: [[470, 255], [565, 235], [610, 150]], lv: [9, 18], dark: 0.35, mobs: ['orc_grunt', 'orc_grunt', 'orc_shaman', 'orc_archer', 'orc_centurion', 'dire_wolf', 'treant'], faction: 'sylvan', music: 'forest' },
    { id: 'meadowrun', name: 'Meadowrun Fields', biome: 'plains', seeds: [[105, 390], [245, 420], [95, 495], [215, 505], [170, 365]], lv: [1, 9], dark: 0, mobs: ['rat', 'snake', 'boar', 'scarecrow', 'cutpurse', 'cutpurse', 'beetle', 'wolf'], faction: 'crown', music: 'plains' },
    { id: 'thornfield', name: 'Thornfield', biome: 'plains2', seeds: [[285, 370], [300, 460], [215, 300]], lv: [9, 18], dark: 0.1, mobs: ['thug', 'thug', 'bandit_archer', 'bandit_mage', 'highwayman', 'boar', 'dire_wolf'], faction: 'crown', music: 'plains' },
    { id: 'copperdeep', name: 'Copperdeep Crags', biome: 'mountain', seeds: [[180, 205], [205, 150]], lv: [8, 17], dark: 0.25, mobs: ['gob_whelp', 'gob_scout', 'gob_warrior', 'gob_shaman', 'gob_archer', 'cave_bear', 'giant_spider'], music: 'mountain' },
    { id: 'crossroads', name: 'Kingsroad Wilds', biome: 'grass', seeds: [[330, 230], [345, 160], [270, 225], [385, 300]], lv: [15, 25], dark: 0.05, mobs: ['dire_wolf', 'harpy', 'ogre', 'griffon', 'ogre'], music: 'plains' },
    { id: 'dreadmire', name: 'Dreadmire Swamp', biome: 'swamp', seeds: [[60, 215], [55, 300], [110, 175]], lv: [18, 28], dark: 0.45, mobs: ['lizard_warrior', 'lizard_shaman', 'bog_zombie', 'swamp_troll', 'mosquito', 'croc'], music: 'swamp' },
    { id: 'ashen', name: 'Ashen Barrows', biome: 'ash', seeds: [[440, 335], [400, 405]], lv: [25, 36], dark: 0.7, mobs: ['skel_warrior', 'skel_archer', 'ghoul', 'wraith', 'cultist', 'skel_warrior'], music: 'haunted' },
    { id: 'ironspine', name: 'Ironspine Peaks', biome: 'snow', seeds: [[200, 55], [310, 50], [255, 100]], lv: [30, 41], dark: 0.15, mobs: ['mtn_troll', 'hill_giant', 'stone_golem', 'wyvern', 'frost_wolf'], music: 'mountain' },
    { id: 'gloamreach', name: 'Gloamreach', biome: 'gloom', seeds: [[520, 400], [470, 440]], lv: [40, 50], dark: 0.88, mobs: ['death_knight', 'banshee', 'lich_acolyte', 'shadow_wraith'], music: 'haunted' },
    { id: 'dragonfall', name: 'Dragonfall Crags', biome: 'volcanic', seeds: [[60, 590], [40, 545]], lv: [42, 50], dark: 0.3, mobs: ['drake', 'fire_elem', 'salamander', 'dragonkin'], music: 'epic' },
    { id: 'blackscar', name: 'Blackscar Wastes', biome: 'scar', seeds: [[605, 330], [610, 410]], lv: [50, 56], dark: 0.6, mobs: ['ravager', 'ash_fiend', 'doomguard', 'void_wraith'], music: 'epic' },
    { id: 'desert', name: 'Sunscour Desert', biome: 'desert', seeds: [[190, 600], [290, 585], [355, 535]], lv: [20, 30], dark: 0, mobs: ['sand_scorpion', 'dune_jackal', 'nomad_raider', 'nomad_raider', 'sand_golem', 'giant_scarab', 'mummy'], music: 'desert' },
    { id: 'ocean', name: 'The Shimmering Sea', biome: 'ocean', seeds: [], lv: [0, 0], dark: 0, noRidge: true, music: 'island' },
    { id: 'island', name: 'Isle of Tidesong', biome: 'island', seeds: [], lv: [20, 40], dark: 0, mobs: ['shore_crab', 'island_tiger', 'pirate', 'pirate_mage', 'sea_harpy', 'coral_golem', 'reef_croc'], noRidge: true, music: 'island' },
    { id: 'summit', name: 'Skyreach Summit', biome: 'summit', seeds: [], lv: [52, 60], dark: 0.1, mobs: ['storm_giant', 'sky_griffon', 'thunder_drake', 'cloud_elemental', 'harpy_matriarch'], noRidge: true, music: 'mountain' },
    // dungeons and caves (carved into the world, entered on foot)
    { id: 'sewer_crown', name: 'Valenmoor Sewers', biome: 'sewer', dungeon: true, home: 'crown', seeds: [], lv: [1, 10], dark: 0.8, mobs: ['sewer_rat', 'sewer_rat', 'cutpurse', 'cutpurse', 'ratt_scout', 'ratt_hexer', 'ratt_bruiser'], noRidge: true, music: 'dungeon' },
    { id: 'sewer_sylvan', name: 'Aelindor Sewers', biome: 'sewer', dungeon: true, home: 'sylvan', seeds: [], lv: [1, 10], dark: 0.8, mobs: ['sewer_rat', 'sewer_rat', 'orc_sneak', 'orc_pawn', 'orc_sewerscout', 'orc_bogshaman', 'orc_brute'], noRidge: true, music: 'dungeon' },
    { id: 'gnollrock', name: 'Gnollrock Warren', biome: 'cave', dungeon: true, seeds: [], lv: [8, 16], dark: 0.82, mobs: ['tunnel_goblin', 'tunnel_goblin', 'gob_mystic', 'warren_rat', 'vampire_bat', 'rock_spider'], noRidge: true, music: 'dungeon' },
    { id: 'crypt', name: 'Crypt of the Forsaken', biome: 'crypt', dungeon: true, seeds: [], lv: [27, 36], dark: 0.9, mobs: ['skel_warrior', 'skel_archer', 'ghoul', 'crypt_guardian', 'crypt_priest'], noRidge: true, music: 'dungeon' },
    { id: 'frostfang', name: 'Frostfang Caverns', biome: 'icecave', dungeon: true, seeds: [], lv: [36, 46], dark: 0.75, mobs: ['ice_troll', 'frost_golem', 'ice_spider', 'yeti', 'frost_wolf'], noRidge: true, music: 'dungeon' },
    { id: 'sunken', name: 'Sunken Temple', biome: 'crypt', dungeon: true, seeds: [], lv: [32, 40], dark: 0.85, mobs: ['temple_lizard', 'temple_lizard', 'tide_priest', 'water_elem', 'reef_croc'], noRidge: true, music: 'dungeon' },
    { id: 'abyss', name: 'Abyssal Depths', biome: 'abyss', dungeon: true, seeds: [], lv: [52, 60], dark: 0.92, mobs: ['abyss_fiend', 'abyss_lich', 'doomguard', 'void_wraith'], noRidge: true, music: 'dungeon' },
  ];
  D.REGION_BY_ID = Object.fromEntries(D.REGIONS.map((r, i) => [r.id, i]));
  D.CITY_CENTER = { sylvan: [500, 95], crown: [170, 440] };
  D.CITY_REGION = { sylvan: 'aelindor', crown: 'valenmoor' };
  // ---------- special places ----------
  D.WORLD_SIZE = 640;
  D.OCEAN = { x0: 392, y0: 470 }; // sea fills the south-east corner
  D.ISLAND = { cx: 150, cy: 150, rx: 118, ry: 82 }; // in the Tidesong realm
  // swimming (game.js): the skill rises as you swim, up to 10 + 5 per level; better swimmers go faster and tire less
  D.SWIM = { name: 'Swimming', max: 200, cap: (lv) => Math.min(200, 10 + lv * 5), speed0: 0.42, speed1: 0.78 };
  D.SUMMIT = { cx: 100, cy: 100, r: 84 }; // in the Summit realm
  D.DUNGEONS = [ // each dungeon is its own realm; 'at' is the cave mouth in the parent realm
    { id: 'sewer_crown', type: 'sewer', parent: 'main', near: 'valenmoor', home: 'crown', at: [238, 396], pool: -1, w: 46, h: 34, entry: 's', rooms: 8, named: ['n_fingers', 'n_gnawbone'], bosses: ['squeak_crown', 'rattigan'] },
    { id: 'sewer_sylvan', type: 'sewer', parent: 'main', near: 'aelindor', home: 'sylvan', at: [434, 100], pool: -1, w: 46, h: 34, entry: 's', rooms: 8, named: ['n_skulk', 'n_gnawbone'], bosses: ['squeak_sylvan', 'drainjaw'] },
    { id: 'gnollrock', type: 'cave', parent: 'main', near: 'copperdeep', at: [173, 228], w: 46, h: 34, entry: 'n', rooms: 7, named: ['n_grizzlefang', 'n_skitterjaw', 'n_mossback'], bosses: ['snikkit', 'grubnak'] },
    { id: 'crypt', type: 'crypt', parent: 'main', near: 'ashen', at: [444, 352], w: 48, h: 40, entry: 'n', rooms: 9, named: ['n_rattlebones', 'n_widow', 'n_gravecaller'], bosses: ['vharr', 'cereth'] },
    { id: 'frostfang', type: 'cave', parent: 'main', near: 'ironspine', at: [265, 53], w: 54, h: 36, entry: 's', rooms: 8, named: ['n_whitefang', 'n_glacius', 'n_frostmaw'], bosses: ['korthak', 'rimeclaw'] },
    { id: 'sunken', type: 'crypt', parent: 'tidesong', near: 'island', at: [262, 150], w: 40, h: 30, entry: 'w', rooms: 7, named: ['n_coralback', 'n_tidecaller', 'n_deepscale'], bosses: ['sssarith', 'nalthrae'] },
    { id: 'abyss', type: 'crypt', parent: 'main', near: 'blackscar', at: [585, 386], w: 46, h: 42, entry: 'w', rooms: 9, named: ['n_soulflayer', 'n_bloodgorger', 'n_umbra'], bosses: ['vorgath', 'hollowking'] },
  ];
  // neutral towns and travel points
  D.HUBS = {
    tidesong: { name: 'Port Tidesong', at: [46, 150], region: 'island', realm: 'tidesong' },
    docks: { name: 'Sunscour Docks', at: [376, 548], region: 'desert', realm: 'main' },
    eyrie: { name: 'Eyrie Camp', at: [100, 124], region: 'summit', realm: 'summit' },
    lair: { name: 'Emberwing\'s Roost', at: [92, 572], region: 'dragonfall', realm: 'main' },
  };

  // ---------- Bosses ----------
  // kingQuest: [faction, index]; chamber: needs key from king
  D.BOSSES = [
    { id: 'ugrak', name: 'Ugrak Bonechewer', kind: 'orc', col: '#4a6a30', lv: 10, region: 'sunleaf', at: [430, 185], scale: 1.6, king: ['sylvan', 0], weapon: 'axe', abil: ['slam'] },
    { id: 'drogmar', name: 'Warchief Drogmar', kind: 'orc', col: '#3e5a2a', lv: 20, region: 'greywood', at: [600, 250], scale: 1.8, king: ['sylvan', 1], chamber: true, weapon: 'axe', abil: ['slam', 'enrage', 'adds:orc_grunt'] },
    { id: 'morwen', name: 'Morwen the Blighted', kind: 'ghost', col: '#7a9a8a', lv: 30, region: 'ashen', at: [470, 320], scale: 1.7, king: ['sylvan', 2], undead: true, abil: ['bolt', 'fear', 'adds:skel_warrior'] },
    { id: 'grukk', name: 'Grukk the Mountain', kind: 'giant', col: '#8a7a5a', lv: 40, region: 'ironspine', at: [330, 40], scale: 1.6, king: ['sylvan', 3], weapon: 'club', abil: ['slam', 'enrage'] },
    { id: 'vaelith', name: 'Vaelith the Lich Queen', kind: 'lich', col: '#4a3a6a', lv: 50, region: 'gloamreach', at: [540, 425], scale: 1.8, king: ['sylvan', 4], chamber: true, undead: true, abil: ['bolt', 'aoe', 'adds:shadow_wraith', 'fear'] },
    { id: 'harlow', name: 'Black Jack Harlow', kind: 'bandit', col: '#2a2a30', lv: 10, region: 'meadowrun', at: [250, 455], scale: 1.4, king: ['crown', 0], weapon: 'sword', abil: ['enrage'] },
    { id: 'baron', name: 'The Thornfield Baron', kind: 'bandit', col: '#6a2a2a', lv: 20, region: 'thornfield', at: [305, 470], scale: 1.6, king: ['crown', 1], chamber: true, weapon: 'sword', abil: ['slam', 'adds:thug'] },
    { id: 'ghulgar', name: 'Ghulgar the Bog Troll', kind: 'troll', col: '#4a6040', lv: 30, region: 'dreadmire', at: [50, 320], scale: 1.6, king: ['crown', 2], abil: ['slam', 'enrage'] },
    { id: 'malzareth', name: 'Archlich Malzareth', kind: 'lich', col: '#2a2440', lv: 40, region: 'gloamreach', at: [480, 455], scale: 1.6, king: ['crown', 3], undead: true, abil: ['bolt', 'fear', 'adds:banshee'] },
    { id: 'nythraxis', name: 'Nythraxis the Bone Dragon', kind: 'dragon', col: '#d8d0c0', lv: 50, region: 'gloamreach', at: [505, 380], scale: 1.7, king: ['crown', 4], chamber: true, undead: true, abil: ['breath', 'aoe', 'fear'] },
    // open-world bosses
    { id: 'grimmaw', name: 'Old Grimmaw', kind: 'bear', col: '#4a3226', lv: 16, region: 'crossroads', at: [290, 250], scale: 2.0, abil: ['slam'] },
    { id: 'skyrender', name: 'Skyrender', kind: 'griffon', col: '#e0b860', lv: 25, region: 'crossroads', at: [360, 150], scale: 1.9, abil: ['aoe'] },
    { id: 'broodmother', name: 'Brood Mother Ixa', kind: 'spider', col: '#3a2030', lv: 24, region: 'dreadmire', at: [95, 190], scale: 2.4, abil: ['adds:giant_spider', 'bolt'] },
    { id: 'shepherd', name: 'The Pale Shepherd', kind: 'lich', col: '#c8c8d8', lv: 34, region: 'ashen', at: [395, 420], scale: 1.6, undead: true, abil: ['bolt', 'adds:skel_warrior'] },
    { id: 'frostmane', name: 'Hrothgar Frostmane', kind: 'giant', col: '#bcd0e0', lv: 38, region: 'ironspine', at: [200, 40], scale: 1.7, weapon: 'club', abil: ['slam', 'aoe'] },
    { id: 'cinderjaw', name: 'Cinderjaw', kind: 'drake', col: '#e05a1e', lv: 46, region: 'dragonfall', at: [35, 520], scale: 2.0, abil: ['breath', 'enrage'] },
    { id: 'ignaroth', name: 'Ignaroth the Ember Wyrm', kind: 'dragon', col: '#c0401e', lv: 52, region: 'dragonfall', at: [70, 600], scale: 1.9, abil: ['breath', 'aoe', 'enrage'], flight: true },
    { id: 'sultan', name: 'Ashkar the Sand Sultan', kind: 'bandit', col: '#e0b040', lv: 28, region: 'desert', at: [250, 610], scale: 1.6, weapon: 'sword', abil: ['enrage', 'adds:nomad_raider'] },
    { id: 'scarabking', name: 'The Great Scarab', kind: 'beetle', col: '#2a8a9a', lv: 26, region: 'desert', at: [320, 560], scale: 3.2, abil: ['slam'] },
    { id: 'blackfin', name: 'Captain Blackfin', kind: 'bandit', col: '#1a1a3a', lv: 32, region: 'island', at: [150, 108], realm: 'tidesong', scale: 1.6, weapon: 'sword', abil: ['enrage', 'adds:pirate'] },
    { id: 'tidecrusher', name: 'Tidecrusher', kind: 'croc', col: '#2a5a4a', lv: 36, region: 'island', at: [205, 196], realm: 'tidesong', scale: 2.4, abil: ['slam', 'enrage'] },
    { id: 'ravagerprime', name: 'Ravager Prime', kind: 'troll', col: '#1a0a0a', lv: 55, region: 'blackscar', at: [615, 300], scale: 2.0, abil: ['slam', 'enrage', 'adds:ravager'] },
    { id: 'seraxa', name: 'Queen Seraxa of the Griffons', kind: 'griffon', col: '#f0e0a0', lv: 56, region: 'summit', at: [55, 72], realm: 'summit', scale: 2.4, abil: ['aoe', 'adds:sky_griffon'] },
    { id: 'aerathos', name: 'Aerathos the Storm Titan', kind: 'giant', col: '#6a8ad0', lv: 59, region: 'summit', at: [146, 68], realm: 'summit', scale: 2.3, weapon: 'club', abil: ['slam', 'aoe', 'bolt', 'enrage'] },
    // dungeon bosses (placed inside their dungeons at world generation)
    { id: 'squeak_crown', name: 'Mother Squeak', kind: 'rat', col: '#8a7a6a', lv: 7, region: 'sewer_crown', dungeon: 'sewer_crown', realm: 'sewer_crown', room: -3, scale: 2.6, abil: ['adds:sewer_rat'] },
    { id: 'rattigan', name: 'Rattigan the Gutter King', kind: 'bandit', col: '#3a2a24', lv: 10, region: 'sewer_crown', dungeon: 'sewer_crown', realm: 'sewer_crown', room: -1, scale: 1.55, weapon: 'sword', abil: ['enrage', 'adds:ratt_bruiser'] },
    { id: 'squeak_sylvan', name: 'Mother Squeak', kind: 'rat', col: '#8a7a6a', lv: 7, region: 'sewer_sylvan', dungeon: 'sewer_sylvan', realm: 'sewer_sylvan', room: -3, scale: 2.6, abil: ['adds:sewer_rat'] },
    { id: 'drainjaw', name: 'Gorruk Drainjaw', kind: 'orc', col: '#3e5a2a', lv: 10, region: 'sewer_sylvan', dungeon: 'sewer_sylvan', realm: 'sewer_sylvan', room: -1, scale: 1.7, weapon: 'axe', abil: ['slam', 'adds:orc_sneak'] },
    { id: 'snikkit', name: 'Snikkit Goldtooth', kind: 'goblin', col: '#8ab84a', lv: 13, region: 'gnollrock', dungeon: 'gnollrock', realm: 'gnollrock', room: -2, scale: 1.6, weapon: 'dagger', abil: ['enrage', 'adds:tunnel_goblin'] },
    { id: 'grubnak', name: 'Grubnak the Tunnel King', kind: 'goblin', col: '#4e7a30', lv: 16, region: 'gnollrock', dungeon: 'gnollrock', realm: 'gnollrock', room: -1, scale: 2.0, weapon: 'axe', abil: ['slam', 'adds:tunnel_goblin'] },
    { id: 'vharr', name: 'Bonelord Vharr', kind: 'skeleton', col: '#c8c0a0', lv: 33, region: 'crypt', dungeon: 'crypt', realm: 'crypt', room: -2, scale: 1.8, undead: true, weapon: 'sword', abil: ['slam', 'adds:skel_warrior'] },
    { id: 'cereth', name: 'Lady Cereth the Hollow', kind: 'ghost', col: '#b8a8e8', lv: 37, region: 'crypt', dungeon: 'crypt', realm: 'crypt', room: -1, scale: 1.8, undead: true, abil: ['bolt', 'fear', 'aoe'] },
    { id: 'korthak', name: 'Korthak Stoneheart', kind: 'golem', col: '#7a8a9a', lv: 43, region: 'frostfang', dungeon: 'frostfang', realm: 'frostfang', room: -2, scale: 1.8, abil: ['slam', 'aoe'] },
    { id: 'rimeclaw', name: 'Rimeclaw the Ice Wyrm', kind: 'drake', col: '#bfe8ff', lv: 47, region: 'frostfang', dungeon: 'frostfang', realm: 'frostfang', room: -1, scale: 2.3, abil: ['breath', 'enrage', 'aoe'] },
    { id: 'sssarith', name: 'Sssarith the Tide Tyrant', kind: 'lizard', col: '#3a6a4a', lv: 38, region: 'sunken', dungeon: 'sunken', realm: 'sunken', room: -2, scale: 1.8, weapon: 'spear', abil: ['bolt', 'enrage', 'adds:temple_lizard'] },
    { id: 'nalthrae', name: "High Priestess Nal'thrae", kind: 'lizard', col: '#2a4a9a', lv: 41, region: 'sunken', dungeon: 'sunken', realm: 'sunken', room: -1, scale: 1.7, abil: ['bolt', 'aoe', 'adds:water_elem'] },
    { id: 'vorgath', name: 'Vorgath the Unmaker', kind: 'deathknight', col: '#3a0a1a', lv: 57, region: 'abyss', dungeon: 'abyss', realm: 'abyss', room: -2, scale: 2.0, undead: true, weapon: 'sword', abil: ['slam', 'enrage', 'adds:doomguard'] },
    { id: 'hollowking', name: 'The Hollow King', kind: 'lich', col: '#100818', lv: 60, region: 'abyss', dungeon: 'abyss', realm: 'abyss', room: -1, scale: 2.2, undead: true, abil: ['bolt', 'aoe', 'fear', 'adds:abyss_fiend'] },
  ];
  D.BOSS_BY_ID = Object.fromEntries(D.BOSSES.map((b) => [b.id, b]));
  D.KING_STATUS = [60, 180, 380, 700, 1300];

  // ---------- Names & talk ----------
  D.NAMES = {
    sylvan: { m: ['Aerendil', 'Thalion', 'Faelar', 'Elandor', 'Sylvar', 'Caladrel', 'Ithilion', 'Lorien', 'Merethir', 'Vaelan', 'Galdor', 'Erevan'], f: ['Lirael', 'Saelihn', 'Ilyana', 'Naeris', 'Elowen', 'Miravel', 'Aelith', 'Thaliel', 'Ysolde', 'Faenya', 'Sereth', 'Imryll'], last: ['Starbough', 'Dawnleaf', 'Moonwhisper', 'Silverbranch', 'Greenmantle', 'Brightwater'] },
    iron: { m: ['Thorgrim', 'Borin', 'Durgan', 'Fizzwick', 'Gimble', 'Haldor', 'Kragg', 'Nibbs', 'Orsik', 'Brokk', 'Tobble', 'Dain'], f: ['Helga', 'Brenna', 'Dagna', 'Tinka', 'Wizzle', 'Ingrid', 'Sigrun', 'Pella', 'Gretta', 'Kilda', 'Nissa', 'Brunhild'], last: ['Ironfoot', 'Coppervein', 'Stoutbeard', 'Gearspring', 'Deepdelver', 'Cogsworth'] },
    crown: { m: ['Edric', 'Rowan', 'Tobias', 'Merry', 'Gareth', 'Alden', 'Bram', 'Pip', 'Corwin', 'Wendel', 'Hal', 'Simon'], f: ['Elena', 'Rosie', 'Margery', 'Isolde', 'Bree', 'Clara', 'Daisy', 'Mira', 'Agnes', 'Lily', 'Wren', 'Tess'], last: ['Ashford', 'Brightfield', 'Underhill', 'Thatcher', 'Millbrook', 'Goodbarrel'] },
  };
  D.TALK = {
    weather: {
      clear: ['Not a cloud in the sky. Perfect day for it.', 'Sun feels good on the old bones today.', 'Fine weather. The roads will be busy.'],
      cloudy: ['Clouds rolling in from the peaks.', 'Grey skies. Might turn wet by evening.', "Can't tell if it wants to rain or not."],
      rain: ['Rain again. My boots will never dry.', 'Good rain for the fields, bad rain for my hair.', 'Stay under the eaves, friend. It is pouring.'],
      fog: ["Fog's thick tonight. Stay on the lit roads.", "Can't see my own hand in this mist.", 'Fog like this brings things out of the barrows.'],
    },
    drink: ['Have you tried the {drink}? Best in the realm, they say.', 'One more {drink} and I will sing, I swear it.', 'The {drink} is strong tonight. The barkeep is generous.', 'Nothing warms you like a mug of {drink} after a long patrol.', "Barkeep! Another round of {drink}!"],
    crops: ['The {crop} came in well this season.', 'Something keeps trampling the {crop}. Boars, I reckon.', 'If the rain holds, the {crop} will be the best in years.', 'Farmers say the {crop} grows sweeter near the kingdom walls.'],
    work: ['This blade will not sharpen itself.', 'Stew needs more salt. Always more salt.', 'Another order for the guard. Busy week.', 'My back aches from all this hauling.'],
    tips: ['Press M to unfold your map. Quests you track show up on it.', 'Every weapon type has its own skill. Use it and it will unlock new techniques.', 'New abilities go onto your hotbar by themselves while it has room. Right-click a hotbar ability to have it used automatically in combat.', 'If you change weapons, give yourself a few seconds to remember how to fight with them.', 'Sit down with X to regain mana and health faster.', 'Gray enemies teach you very little. Red ones will teach you a lesson.', 'The bank is shared by everyone in your bloodline. Store gear for your other heroes there.', 'The king needs timber and stone to build. Bring him some and the whole kingdom rises.', 'When the kingdom grows, new merchants arrive with finer materials.', 'Spells get more reliable the more you practice their school.', 'Press R to switch between melee, ranged, or both.', 'You can write macros. Put /attack on a hotbar key if you like.'],
    lore: {
      sylvan: ['Old King Edric loved these woods. He would weep to see his sons at war.', 'Poison in the king\'s cup, and Aldric burned the archives the very next week. Ask yourself why.', 'King Theron came to us with nothing but a horse and a grievance. We gave him a crown.', 'Aldric calls our forest "the rebel woods." Let him come and say it to the trees.', 'They say Aldric was born an hour before Theron, and has never stopped mentioning it.', 'The orcs of the Greywood grow bolder every season. Aldric would rather we fought each other.'],
      ironOld: ['Khar Duum was carved from a single mountain. It took nine hundred years.', 'The elves call us burners. We call them thieves of the high passes.', 'Valen merchants cheat on every scale. Count your coins twice.', 'Goblins in Copperdeep are stealing our ore again.'],
      crown: ['Old King Edric ruled the whole land from this very hall. His firstborn sits the throne now, as it should be.', 'Prince Theron ran off to the elves and put a crown on his own head. A crown he never earned.', 'Someone poisoned the old king at his own feast. Some say it was Theron. I say it was.', 'The bandits of Thornfield were once honest folk. The war between the brothers turned them.', 'One day the whole land will kneel to Valenmoor again. Mark my words.'],
    },
    monsters: ['They say {boss} lurks in {region}. Stay clear unless you are ready.', 'A merchant came through, white as a sheet. Said he saw {boss} near {region}.', 'Hunters avoid {region} after dark.', 'The guards found tracks of {boss} outside {region}.'],
    drunk: ['*hic* You... you are my best friend.', '*hic* Who moved the floor?', 'I could fight a troll. Two trolls! *hic*', '*sings off-key* Ohhh the maiden of the mill...'],
    greet: ['Well met, traveler.', 'Good day to you.', 'Can I help you with something?', 'Mind the guards, they are touchy today.', 'Hail, friend.'],
    child: ['Tag! You are it!', 'I am going to be an adventurer like you!', 'Mama says not to go past the gate.'],
  };
})();
