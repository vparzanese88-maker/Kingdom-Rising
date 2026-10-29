// Aeternum Wilds — playable classes and their talent trees (pure data).
// Each tree: 5 nodes, tiers 0..4 = active, passive, active, passive, active capstone.

export const CLASSES = {
  warrior: {
    name: 'Warrior', icon: '⚔️', role: 'Tank',
    desc: 'A shield-line veteran who plants their feet and dares the wilds to move them. Unmatched at soaking punishment and holding attention.',
    weapon: 'sword', second: 'hammer', armor: 'heavy', gear: ['head', 'chest', 'legs', 'feet'],
    attrs: { str: 3, con: 4, int: -1 }, color: 0x8a6a3a, mana: 0.6,
    trees: [
      { id: 'war_defense', name: 'Defense', icon: '🛡️', desc: 'Hold the line and draw every blade to yourself.', nodes: [
        { id: 'war_challenge', tier: 0, type: 'active', name: 'Challenging Roar', icon: '📣', desc: 'Bellow a challenge, forcing nearby foes to fight you while you brace.', kind: 'taunt', cost: 10, cd: 12, radius: 8, dur: 6, buff: { dr: 0.25 } },
        { id: 'war_ironhide', tier: 1, type: 'passive', name: 'Ironhide', icon: '🪨', max: 3, desc: '+6% armor and +3% max health per rank', mods: { armorPct: 0.06, maxHpPct: 0.03 } },
        { id: 'war_shieldwall', tier: 2, type: 'active', name: 'Shield Wall', icon: '🧱', desc: 'Lock your guard and shrug off most incoming harm.', kind: 'buff', cost: 15, cd: 30, dur: 8, buff: { dr: 0.4 }, color: 0xc0a060 },
        { id: 'war_steadfast', tier: 3, type: 'passive', name: 'Steadfast', icon: '⚓', max: 3, desc: '+3% damage reduction and cheaper blocks per rank', mods: { dr: 0.03, blockCost: -0.08 } },
        { id: 'war_lastbastion', tier: 4, type: 'active', name: 'Last Bastion', icon: '🏰', desc: 'Raise a massive barrier of grit that absorbs a huge amount of damage.', kind: 'shield', cost: 25, cd: 60, heal: 0.5, dur: 12, color: 0xe0c070 },
      ] },
      { id: 'war_mastery', name: 'Weapon Mastery', icon: '🗡️', desc: 'Precise, punishing swordplay.', nodes: [
        { id: 'war_cleave', tier: 0, type: 'active', name: 'Mighty Cleave', icon: '🪓', desc: 'A heavy overhead blow on the foe before you.', kind: 'strike', cost: 10, cd: 6, dmg: 2.0, range: 3.5 },
        { id: 'war_drills', tier: 1, type: 'passive', name: 'Battle Drills', icon: '🎯', max: 3, desc: '+4% light and heavy attack damage per rank', mods: { lightDmg: 0.04, heavyDmg: 0.04 } },
        { id: 'war_charge', tier: 2, type: 'active', name: 'Bull Charge', icon: '🐂', desc: 'Rush ahead, battering and staggering anything in the way.', kind: 'dash', cost: 15, cd: 14, dmg: 1.4, dist: 10, stun: 1.0 },
        { id: 'war_edge', tier: 3, type: 'passive', name: 'Keen Edge', icon: '✨', max: 3, desc: '+2% crit chance and +8% crit damage per rank', mods: { crit: 2, critDmg: 0.08 } },
        { id: 'war_execute', tier: 4, type: 'active', name: 'Executioner', icon: '⚰️', desc: 'A devastating finishing stroke that opens a deep wound.', kind: 'strike', cost: 25, cd: 30, dmg: 4.0, range: 4, stun: 1.0, bleed: 1.5 },
      ] },
      { id: 'war_berserking', name: 'Berserking', icon: '😤', desc: 'Let fury carry you through the fight.', nodes: [
        { id: 'war_warcry', tier: 0, type: 'active', name: 'War Cry', icon: '📢', desc: 'Stir your blood, hitting harder for a short time.', kind: 'buff', cost: 10, cd: 20, dur: 10, buff: { dmg: 0.2 }, color: 0xd04020 },
        { id: 'war_thickblood', tier: 1, type: 'passive', name: 'Thick Blood', icon: '🩸', max: 3, desc: '+1.5 health regen and +4% stamina regen per rank', mods: { regen: 1.5, stamRegen: 0.04 } },
        { id: 'war_whirl', tier: 2, type: 'active', name: 'Whirlwind', icon: '🌪️', desc: 'Spin with blade outstretched, striking everything around you.', kind: 'nova', cost: 18, cd: 12, dmg: 1.4, radius: 4, color: 0xb0b0b0, knock: 3 },
        { id: 'war_bloodied', tier: 3, type: 'passive', name: 'Bloodied Resolve', icon: '❤️', max: 3, desc: '+2% lifesteal and heal 2% max health on kill per rank', mods: { lifesteal: 2, killHeal: 0.02 } },
        { id: 'war_rampage', tier: 4, type: 'active', name: 'Rampage', icon: '🔥', desc: 'Enter an unstoppable battle trance: faster, harder, tougher.', kind: 'buff', cost: 25, cd: 60, dur: 12, buff: { dmg: 0.35, atkSpeed: 0.25, dr: 0.2 }, color: 0xff3010 },
      ] },
    ],
  },

  cleric: {
    name: 'Cleric', icon: '✝️', role: 'Healer',
    desc: 'An armored servant of the dawn whose prayers mend flesh and whose hammer breaks the restless dead.',
    weapon: 'hammer', second: 'staff', armor: 'heavy', gear: ['chest', 'legs', 'feet'],
    attrs: { int: 3, con: 2, str: 1 }, color: 0xe8e0b0, mana: 1.3,
    trees: [
      { id: 'clr_healing', name: 'Healing', icon: '💖', desc: 'Restorative prayers.', nodes: [
        { id: 'clr_mend', tier: 0, type: 'active', name: 'Mending Prayer', icon: '🙏', desc: 'A quick prayer that closes wounds.', kind: 'heal', cost: 15, cd: 6, heal: 0.25, color: 0xfff0a0 },
        { id: 'clr_devotion', tier: 1, type: 'passive', name: 'Devotion', icon: '📿', max: 3, desc: '+6% healing power per rank', mods: { healPower: 0.06 } },
        { id: 'clr_renew', tier: 2, type: 'active', name: 'Renewing Light', icon: '🌅', desc: 'Bathe in a steady glow that heals over time.', kind: 'hot', cost: 20, cd: 15, heal: 0.4, dur: 10, color: 0xfff5c0 },
        { id: 'clr_wellspring', tier: 3, type: 'passive', name: 'Wellspring', icon: '⛲', max: 3, desc: '+0.6 mana regen and +4% max mana per rank', mods: { manaRegen: 0.6, maxManaPct: 0.04 } },
        { id: 'clr_miracle', tier: 4, type: 'active', name: 'Miracle', icon: '🌟', desc: 'Call down a true miracle, restoring half your life at once.', kind: 'heal', cost: 40, cd: 50, heal: 0.5, color: 0xffffff },
      ] },
      { id: 'clr_protection', name: 'Protection', icon: '🛡️', desc: 'Blessed wards and armor.', nodes: [
        { id: 'clr_aegis', tier: 0, type: 'active', name: 'Holy Aegis', icon: '🔆', desc: 'Wrap yourself in a shimmering ward.', kind: 'shield', cost: 15, cd: 12, heal: 0.2, dur: 10, color: 0xf0e080 },
        { id: 'clr_faith', tier: 1, type: 'passive', name: 'Armor of Faith', icon: '⛪', max: 3, desc: '+6% armor and +2% damage reduction per rank', mods: { armorPct: 0.06, dr: 0.02 } },
        { id: 'clr_purify', tier: 2, type: 'active', name: 'Purify', icon: '💧', desc: 'Burn away poisons and hindrances, healing slightly.', kind: 'cleanse', cost: 15, cd: 14, heal: 0.15 },
        { id: 'clr_vigil', tier: 3, type: 'passive', name: 'Vigilance', icon: '👁️', max: 3, desc: '+3% max health and +1 health regen per rank', mods: { maxHpPct: 0.03, regen: 1 } },
        { id: 'clr_sanctuary', tier: 4, type: 'active', name: 'Sanctuary', icon: '🕊️', desc: 'Become a bastion of the divine, greatly reducing damage taken.', kind: 'buff', cost: 30, cd: 55, dur: 10, buff: { dr: 0.4, regen: 8 }, color: 0xfff8d0 },
      ] },
      { id: 'clr_smiting', name: 'Smiting', icon: '☀️', desc: 'Holy fire against the undead.', nodes: [
        { id: 'clr_smite', tier: 0, type: 'active', name: 'Smite', icon: '⚡', desc: 'Hurl a bolt of radiant force.', kind: 'bolt', cost: 12, cd: 4, dmg: 1.1, speed: 40, color: 0xfff080 },
        { id: 'clr_zeal', tier: 1, type: 'passive', name: 'Zeal', icon: '🔥', max: 3, desc: '+5% spell damage per rank', mods: { spellDmg: 0.05 } },
        { id: 'clr_turn', tier: 2, type: 'active', name: 'Turn the Dead', icon: '💥', desc: 'A burst of holy light that scorches and stuns nearby foes.', kind: 'nova', cost: 22, cd: 16, dmg: 1.4, radius: 6, stun: 1.5, color: 0xffe060 },
        { id: 'clr_judgment', tier: 3, type: 'passive', name: 'Judgment', icon: '⚖️', max: 3, desc: '+2% crit chance and +3% all damage per rank', mods: { crit: 2, dmg: 0.03 } },
        { id: 'clr_wrath', tier: 4, type: 'active', name: 'Wrath of Dawn', icon: '🌞', desc: 'Pillars of sunfire crash down upon the target area.', kind: 'rain', cost: 40, cd: 40, dmg: 2.8, radius: 6, delay: 1.0, range: 20, stun: 1.0, color: 0xfff0a0 },
      ] },
    ],
  },

  paladin: {
    name: 'Paladin', icon: '🛡️', role: 'Hybrid',
    desc: 'An oathbound knight who guards the weak with steel and sacred light, healing between blows.',
    weapon: 'sword', second: 'hammer', armor: 'heavy', gear: ['head', 'chest', 'legs', 'feet'],
    attrs: { str: 2, con: 3, int: 1 }, color: 0xd8c070, mana: 1.0,
    trees: [
      { id: 'pal_guard', name: 'Holy Guard', icon: '🏛️', desc: 'Sacred protection.', nodes: [
        { id: 'pal_oath', tier: 0, type: 'active', name: 'Oath of Challenge', icon: '📜', desc: 'Demand foes face you; your oath hardens your skin.', kind: 'taunt', cost: 12, cd: 14, radius: 7, dur: 6, buff: { dr: 0.2 } },
        { id: 'pal_bulwark', tier: 1, type: 'passive', name: 'Consecrated Plate', icon: '🔰', max: 3, desc: '+5% armor and +2% damage reduction per rank', mods: { armorPct: 0.05, dr: 0.02 } },
        { id: 'pal_divineshield', tier: 2, type: 'active', name: 'Divine Shield', icon: '💠', desc: 'Light gathers into an absorbing barrier.', kind: 'shield', cost: 20, cd: 20, heal: 0.3, dur: 10, color: 0xfff0b0 },
        { id: 'pal_resolve', tier: 3, type: 'passive', name: 'Unbroken Resolve', icon: '🗿', max: 3, desc: '+4% max health per rank', mods: { maxHpPct: 0.04 } },
        { id: 'pal_bastion', tier: 4, type: 'active', name: 'Radiant Bastion', icon: '🌄', desc: 'A shockwave of light stuns all around you.', kind: 'nova', cost: 30, cd: 45, dmg: 1.8, radius: 7, stun: 2.5, color: 0xffe890 },
      ] },
      { id: 'pal_strikes', name: 'Righteous Strikes', icon: '⚔️', desc: 'Blessed steel.', nodes: [
        { id: 'pal_crusader', tier: 0, type: 'active', name: 'Crusader Strike', icon: '✴️', desc: 'A light-infused sword blow.', kind: 'strike', cost: 10, cd: 6, dmg: 1.9, range: 3.5 },
        { id: 'pal_valor', tier: 1, type: 'passive', name: 'Valor', icon: '🎖️', max: 3, desc: '+4% all damage per rank', mods: { dmg: 0.04 } },
        { id: 'pal_hammerjust', tier: 2, type: 'active', name: 'Hammer of Justice', icon: '🔨', desc: 'Hurl a spectral hammer that stuns its target.', kind: 'bolt', cost: 18, cd: 15, dmg: 1.2, speed: 35, stun: 2, color: 0xf0d060 },
        { id: 'pal_conviction', tier: 3, type: 'passive', name: 'Conviction', icon: '💫', max: 3, desc: '+2% crit chance and +2% lifesteal per rank', mods: { crit: 2, lifesteal: 2 } },
        { id: 'pal_avenging', tier: 4, type: 'active', name: 'Avenging Light', icon: '👼', desc: 'Become an avatar of retribution for a time.', kind: 'buff', cost: 30, cd: 60, dur: 15, buff: { dmg: 0.3, healPower: 0.3, dr: 0.15 }, color: 0xffd040 },
      ] },
      { id: 'pal_hands', name: 'Lay on Hands', icon: '🤲', desc: 'Healing through faith.', nodes: [
        { id: 'pal_flash', tier: 0, type: 'active', name: 'Flash of Faith', icon: '💛', desc: 'A quick burst of healing light.', kind: 'heal', cost: 15, cd: 8, heal: 0.2, color: 0xfff0a0 },
        { id: 'pal_grace', tier: 1, type: 'passive', name: 'Grace', icon: '🕯️', max: 3, desc: '+6% healing power per rank', mods: { healPower: 0.06 } },
        { id: 'pal_blessing', tier: 2, type: 'active', name: 'Blessing of Mercy', icon: '🌼', desc: 'A gentle blessing that heals over time.', kind: 'hot', cost: 18, cd: 16, heal: 0.35, dur: 10, color: 0xfff6c0 },
        { id: 'pal_martyr', tier: 3, type: 'passive', name: 'Martyr\'s Gift', icon: '🌹', max: 3, desc: 'Heal 2% max health on kill and +0.5 mana regen per rank', mods: { killHeal: 0.02, manaRegen: 0.5 } },
        { id: 'pal_layhands', tier: 4, type: 'active', name: 'Lay on Hands', icon: '✋', desc: 'Pour your whole soul into one tremendous heal.', kind: 'heal', cost: 35, cd: 60, heal: 0.5, color: 0xffffff },
      ] },
    ],
  },

  ranger: {
    name: 'Ranger', icon: '🏹', role: 'Melee',
    desc: 'A keen-eyed wanderer of the deep woods, deadly at range and at home among wolves and thorns.',
    weapon: 'bow', second: 'sword', armor: 'medium', gear: ['chest', 'legs', 'feet'],
    attrs: { dex: 4, str: 1, con: 1 }, color: 0x3a6a2a, mana: 1.0,
    trees: [
      { id: 'rng_archery', name: 'Archery', icon: '🎯', desc: 'Peerless marksmanship.', nodes: [
        { id: 'rng_powershot', tier: 0, type: 'active', name: 'Power Shot', icon: '🏹', desc: 'A drawn-out shot that pierces through foes.', kind: 'bolt', cost: 12, cd: 6, dmg: 1.4, speed: 50, pierce: true, color: 0xc0e0a0 },
        { id: 'rng_steadyaim', tier: 1, type: 'passive', name: 'Steady Aim', icon: '🔭', max: 3, desc: '+2% crit chance and +5% crit damage per rank', mods: { crit: 2, critDmg: 0.05 } },
        { id: 'rng_volley', tier: 2, type: 'active', name: 'Arrow Volley', icon: '🌧️', desc: 'Loose a rain of arrows on the target area.', kind: 'rain', cost: 20, cd: 14, dmg: 1.6, radius: 5, delay: 0.8, range: 20, color: 0xa0c080 },
        { id: 'rng_quickdraw', tier: 3, type: 'passive', name: 'Quick Draw', icon: '⚡', max: 3, desc: '+5% attack speed per rank', mods: { atkSpeed: 0.05 } },
        { id: 'rng_hawkeye', tier: 4, type: 'active', name: 'Hawk\'s Eye', icon: '🦅', desc: 'A perfect, explosive shot that stuns everything it hits.', kind: 'bolt', cost: 30, cd: 35, dmg: 3.0, speed: 50, explode: 4, stun: 1.5, color: 0xffe080 },
      ] },
      { id: 'rng_wilds', name: 'Wilds', icon: '🌲', desc: 'Command thorn and beast.', nodes: [
        { id: 'rng_snare', tier: 0, type: 'active', name: 'Bramble Snare', icon: '🌿', desc: 'Thorny vines grip foes at the target point.', kind: 'root', cost: 12, cd: 12, radius: 4, dur: 3, range: 18, dmg: 0.4 },
        { id: 'rng_kinship', tier: 1, type: 'passive', name: 'Kinship', icon: '🐾', max: 3, desc: '+8% pet damage and +8% pet health per rank', mods: { petDmg: 0.08, petHp: 0.08 } },
        { id: 'rng_wolf', tier: 2, type: 'active', name: 'Call of the Pack', icon: '🐺', desc: 'Summon a loyal wolf companion.', kind: 'pet', cost: 25, cd: 30, pet: { type: 'wolf', hp: 0.7, dmg: 0.5, dur: 90, count: 1 } },
        { id: 'rng_thornskin', tier: 3, type: 'passive', name: 'Thornwise', icon: '🌵', max: 3, desc: '+4% damage-over-time and +3% move speed per rank', mods: { dotDmg: 0.04, moveSpeed: 0.03 } },
        { id: 'rng_stampede', tier: 4, type: 'active', name: 'Stampede', icon: '🐗', desc: 'Summon a howling pack of wolves.', kind: 'pet', cost: 40, cd: 60, pet: { type: 'wolf', hp: 0.6, dmg: 0.6, dur: 45, count: 3 } },
      ] },
      { id: 'rng_survival', name: 'Survival', icon: '🏕️', desc: 'Live off the land.', nodes: [
        { id: 'rng_tumble', tier: 0, type: 'active', name: 'Tumble', icon: '🤸', desc: 'Roll forward, slashing anything in the way.', kind: 'dash', cost: 10, cd: 8, dmg: 0.8, dist: 7 },
        { id: 'rng_hardy', tier: 1, type: 'passive', name: 'Trail Hardened', icon: '🥾', max: 3, desc: '+3% max health and +4% stamina regen per rank', mods: { maxHpPct: 0.03, stamRegen: 0.04 } },
        { id: 'rng_poultice', tier: 2, type: 'active', name: 'Herbal Poultice', icon: '🌱', desc: 'Apply herbs that cure poison and heal a little.', kind: 'cleanse', cost: 15, cd: 15, heal: 0.2 },
        { id: 'rng_forager', tier: 3, type: 'passive', name: 'Forager', icon: '🍄', max: 3, desc: '+1.2 health regen and +2% damage reduction per rank', mods: { regen: 1.2, dr: 0.02 } },
        { id: 'rng_secondwind', tier: 4, type: 'active', name: 'Second Wind', icon: '🍃', desc: 'Catch your breath: heal over time and move faster.', kind: 'buff', cost: 25, cd: 50, dur: 10, buff: { regen: 10, moveSpeed: 0.3, dr: 0.15 }, color: 0x80e080 },
      ] },
    ],
  },

  shadowknight: {
    name: 'Shadow Knight', icon: '🖤', role: 'Tank',
    desc: 'A dread-clad knight who bargained with the grave. Terror and stolen life keep them standing long after others fall.',
    weapon: 'greataxe', second: 'sword', armor: 'heavy', gear: ['head', 'chest', 'legs', 'feet'],
    attrs: { str: 3, con: 2, int: 1 }, color: 0x301830, mana: 1.0,
    trees: [
      { id: 'sk_dread', name: 'Dread', icon: '😱', desc: 'Terrify and command attention.', nodes: [
        { id: 'sk_terror', tier: 0, type: 'active', name: 'Voice of Terror', icon: '👹', desc: 'A chilling howl that forces foes to face you.', kind: 'taunt', cost: 10, cd: 12, radius: 8, dur: 6, buff: { dr: 0.2 } },
        { id: 'sk_darkplate', tier: 1, type: 'passive', name: 'Darkforged Plate', icon: '⛓️', max: 3, desc: '+6% armor and +2% max health per rank', mods: { armorPct: 0.06, maxHpPct: 0.02 } },
        { id: 'sk_fear', tier: 2, type: 'active', name: 'Harrowing Gaze', icon: '👁️', desc: 'Freeze the foes ahead with dread.', kind: 'stun', cost: 18, cd: 16, dmg: 0.8, range: 7, arc: 120, stun: 2 },
        { id: 'sk_grim', tier: 3, type: 'passive', name: 'Grim Resolve', icon: '🗡️', max: 3, desc: '+3% damage reduction per rank', mods: { dr: 0.03 } },
        { id: 'sk_deathknell', tier: 4, type: 'active', name: 'Death Knell', icon: '🔔', desc: 'A tolling shockwave that stuns and hurls back all nearby.', kind: 'nova', cost: 30, cd: 45, dmg: 2.0, radius: 7, stun: 2.5, knock: 5, color: 0x502060 },
      ] },
      { id: 'sk_blood', name: 'Blood', icon: '🩸', desc: 'Steal the life of your enemies.', nodes: [
        { id: 'sk_lifetap', tier: 0, type: 'active', name: 'Lifetap', icon: '💉', desc: 'Rip the vitality from nearby foes into yourself.', kind: 'drain', cost: 15, cd: 8, dmg: 1.0, radius: 5, heal: 0.6, color: 0x901020 },
        { id: 'sk_thirst', tier: 1, type: 'passive', name: 'Crimson Thirst', icon: '🍷', max: 3, desc: '+2% lifesteal per rank', mods: { lifesteal: 2 } },
        { id: 'sk_bloodblade', tier: 2, type: 'active', name: 'Blood Blade', icon: '🔪', desc: 'A brutal axe blow that leaves the target bleeding.', kind: 'strike', cost: 15, cd: 10, dmg: 2.2, range: 4, bleed: 1.2 },
        { id: 'sk_feast', tier: 3, type: 'passive', name: 'Grave Feast', icon: '🦴', max: 3, desc: 'Heal 3% max health on kill per rank', mods: { killHeal: 0.03 } },
        { id: 'sk_harvest', tier: 4, type: 'active', name: 'Sanguine Harvest', icon: '🌑', desc: 'Drain every living thing around you in a wide crimson vortex.', kind: 'drain', cost: 35, cd: 45, dmg: 2.5, radius: 8, heal: 0.9, color: 0xc01030 },
      ] },
      { id: 'sk_necrotic', name: 'Necrotic', icon: '☠️', desc: 'Rot and the risen dead.', nodes: [
        { id: 'sk_decay', tier: 0, type: 'active', name: 'Creeping Decay', icon: '🦠', desc: 'Curse a foe with rotting flesh.', kind: 'dot', cost: 12, cd: 6, dmg: 1.5, dur: 8, color: 0x507030 },
        { id: 'sk_blight', tier: 1, type: 'passive', name: 'Blight', icon: '🥀', max: 3, desc: '+6% damage-over-time per rank', mods: { dotDmg: 0.06 } },
        { id: 'sk_pestilence', tier: 2, type: 'active', name: 'Pestilence', icon: '🪰', desc: 'A plague curse that spreads to nearby foes.', kind: 'dot', cost: 20, cd: 14, dmg: 1.8, dur: 10, spread: true, color: 0x608020 },
        { id: 'sk_gravepact', tier: 3, type: 'passive', name: 'Grave Pact', icon: '⚰️', max: 3, desc: '+8% pet damage and +4% spell damage per rank', mods: { petDmg: 0.08, spellDmg: 0.04 } },
        { id: 'sk_raise', tier: 4, type: 'active', name: 'Raise Champion', icon: '💀', desc: 'Raise a skeletal champion to fight at your side.', kind: 'pet', cost: 35, cd: 60, pet: { type: 'skeleton', hp: 1.0, dmg: 0.8, dur: 0, count: 1 } },
      ] },
    ],
  },

  druid: {
    name: 'Druid', icon: '🌿', role: 'Caster',
    desc: 'A keeper of the old groves who calls storms and roots, mends with sap and sun, and wears the shapes of beasts.',
    weapon: 'staff', second: 'hammer', armor: 'light', gear: ['chest', 'legs', 'feet'],
    attrs: { int: 4, con: 1, dex: 1 }, color: 0x4a7a2a, mana: 1.3,
    trees: [
      { id: 'dru_wrath', name: 'Nature\'s Wrath', icon: '⛈️', desc: 'Storm and thorn.', nodes: [
        { id: 'dru_starfire', tier: 0, type: 'active', name: 'Moonfire', icon: '🌙', desc: 'A lance of silver moonlight.', kind: 'bolt', cost: 12, cd: 4, dmg: 1.1, speed: 38, color: 0xc0d0ff },
        { id: 'dru_fury', tier: 1, type: 'passive', name: 'Gale Fury', icon: '🌬️', max: 3, desc: '+5% spell damage per rank', mods: { spellDmg: 0.05 } },
        { id: 'dru_entangle', tier: 2, type: 'active', name: 'Entangle', icon: '🌾', desc: 'Grasping roots erupt and hold foes in place.', kind: 'root', cost: 18, cd: 14, radius: 5, dur: 4, range: 18, dmg: 0.5 },
        { id: 'dru_storm', tier: 3, type: 'passive', name: 'Stormcaller', icon: '🌩️', max: 3, desc: '+2% crit and +3% cooldown reduction per rank', mods: { crit: 2, cdr: 0.03 } },
        { id: 'dru_tempest', tier: 4, type: 'active', name: 'Wrath of the Wild', icon: '🌪️', desc: 'Call down a ferocious lightning storm on an area.', kind: 'rain', cost: 40, cd: 40, dmg: 3.0, radius: 6, delay: 1.2, range: 20, stun: 1.0, color: 0xa0c0ff },
      ] },
      { id: 'dru_renewal', name: 'Renewal', icon: '🌸', desc: 'The green that heals.', nodes: [
        { id: 'dru_rejuv', tier: 0, type: 'active', name: 'Rejuvenate', icon: '🍀', desc: 'Living sap heals you over time.', kind: 'hot', cost: 14, cd: 10, heal: 0.3, dur: 8, color: 0x80ff80 },
        { id: 'dru_bloom', tier: 1, type: 'passive', name: 'Bloom', icon: '🌺', max: 3, desc: '+6% healing power per rank', mods: { healPower: 0.06 } },
        { id: 'dru_barkskin', tier: 2, type: 'active', name: 'Barkskin', icon: '🪵', desc: 'Your skin hardens into living bark.', kind: 'shield', cost: 18, cd: 18, heal: 0.25, dur: 10, color: 0x806030 },
        { id: 'dru_roots', tier: 3, type: 'passive', name: 'Deep Roots', icon: '🌳', max: 3, desc: '+0.6 mana regen and +1 health regen per rank', mods: { manaRegen: 0.6, regen: 1 } },
        { id: 'dru_tranq', tier: 4, type: 'active', name: 'Tranquility', icon: '🌈', desc: 'The grove\'s full blessing restores you greatly.', kind: 'heal', cost: 40, cd: 50, heal: 0.5, color: 0xa0ffa0 },
      ] },
      { id: 'dru_shape', name: 'Shapeshift', icon: '🐻', desc: 'Wear the shapes of beasts.', nodes: [
        { id: 'dru_wolfform', tier: 0, type: 'active', name: 'Wolf Form', icon: '🐺', desc: 'Take the shape of a wolf: swift and fierce.', kind: 'buff', cost: 15, cd: 20, dur: 12, buff: { moveSpeed: 0.35, atkSpeed: 0.15 }, color: 0x909090 },
        { id: 'dru_feral', tier: 1, type: 'passive', name: 'Feral Instinct', icon: '🐾', max: 3, desc: '+4% all damage and +2% move speed per rank', mods: { dmg: 0.04, moveSpeed: 0.02 } },
        { id: 'dru_pounce', tier: 2, type: 'active', name: 'Pounce', icon: '🐆', desc: 'Leap onto the target point and maul.', kind: 'leap', cost: 18, cd: 12, dmg: 1.5, radius: 3.5, range: 14 },
        { id: 'dru_hide', tier: 3, type: 'passive', name: 'Thick Hide', icon: '🦬', max: 3, desc: '+4% max health and +2% damage reduction per rank', mods: { maxHpPct: 0.04, dr: 0.02 } },
        { id: 'dru_bearform', tier: 4, type: 'active', name: 'Great Bear Form', icon: '🐻', desc: 'Become a towering bear, shrugging off blows and mauling foes.', kind: 'buff', cost: 30, cd: 60, dur: 15, buff: { dr: 0.35, dmg: 0.25, maxHpPct: 0.2 }, color: 0x6a4a2a },
      ] },
    ],
  },

  monk: {
    name: 'Monk', icon: '🥋', role: 'Melee',
    desc: 'A disciplined wanderer whose war staff and bare feet are weapons honed by a lifetime of quiet practice.',
    weapon: 'hammer', second: 'staff', armor: 'light', gear: ['chest', 'legs'],
    attrs: { dex: 3, str: 2, con: 1 }, color: 0xd08030, mana: 0.6,
    trees: [
      { id: 'mnk_martial', name: 'Martial Arts', icon: '👊', desc: 'Strikes with the war staff.', nodes: [
        { id: 'mnk_palm', tier: 0, type: 'active', name: 'Tiger Palm', icon: '🐯', desc: 'A focused palm strike behind a sweep of the war staff.', kind: 'strike', cost: 10, cd: 5, dmg: 1.8, range: 3.5 },
        { id: 'mnk_flow', tier: 1, type: 'passive', name: 'Flowing Form', icon: '🌊', max: 3, desc: '+5% attack speed and +3% light attack damage per rank', mods: { atkSpeed: 0.05, lightDmg: 0.03 } },
        { id: 'mnk_sweep', tier: 2, type: 'active', name: 'Leg Sweep', icon: '🦵', desc: 'Sweep the legs out from everyone in front of you.', kind: 'stun', cost: 15, cd: 14, dmg: 1.0, range: 5, arc: 160, stun: 2 },
        { id: 'mnk_pressure', tier: 3, type: 'passive', name: 'Pressure Points', icon: '📍', max: 3, desc: '+2% crit chance and +8% crit damage per rank', mods: { crit: 2, critDmg: 0.08 } },
        { id: 'mnk_hundred', tier: 4, type: 'active', name: 'Hundred Fists', icon: '💥', desc: 'A blinding flurry that shatters a single foe.', kind: 'strike', cost: 25, cd: 30, dmg: 4.0, range: 4, stun: 1.5 },
      ] },
      { id: 'mnk_calm', name: 'Inner Calm', icon: '☯️', desc: 'Stillness and endurance.', nodes: [
        { id: 'mnk_meditate', tier: 0, type: 'active', name: 'Meditate', icon: '🧘', desc: 'Center yourself and recover health.', kind: 'heal', cost: 10, cd: 14, heal: 0.2, color: 0xffe0a0 },
        { id: 'mnk_balance', tier: 1, type: 'passive', name: 'Balance', icon: '⚖️', max: 3, desc: '+3% damage reduction per rank', mods: { dr: 0.03 } },
        { id: 'mnk_evade', tier: 2, type: 'active', name: 'Mist Step', icon: '🌫️', desc: 'Slip between blows, taking far less damage.', kind: 'buff', cost: 15, cd: 20, dur: 6, buff: { dr: 0.4, moveSpeed: 0.2 }, color: 0xe0e0ff },
        { id: 'mnk_breath', tier: 3, type: 'passive', name: 'Iron Breath', icon: '💨', max: 3, desc: '+6% stamina regen and +1 health regen per rank', mods: { stamRegen: 0.06, regen: 1 } },
        { id: 'mnk_diamond', tier: 4, type: 'active', name: 'Diamond Body', icon: '💎', desc: 'Your body becomes like stone, absorbing a huge amount of damage.', kind: 'shield', cost: 25, cd: 55, heal: 0.45, dur: 12, color: 0xc0e0ff },
      ] },
      { id: 'mnk_kicks', name: 'Flying Kicks', icon: '🦶', desc: 'Aerial acrobatics.', nodes: [
        { id: 'mnk_flykick', tier: 0, type: 'active', name: 'Flying Kick', icon: '🥾', desc: 'Launch forward feet-first, knocking foes aside.', kind: 'dash', cost: 10, cd: 8, dmg: 1.2, dist: 9, knock: 3 },
        { id: 'mnk_light', tier: 1, type: 'passive', name: 'Lightfoot', icon: '🪶', max: 3, desc: '+4% move speed and +3% all damage per rank', mods: { moveSpeed: 0.04, dmg: 0.03 } },
        { id: 'mnk_crane', tier: 2, type: 'active', name: 'Crane Descent', icon: '🕊️', desc: 'Spring to the target point and land with a crushing kick.', kind: 'leap', cost: 18, cd: 12, dmg: 1.6, radius: 4, range: 14 },
        { id: 'mnk_momentum', tier: 3, type: 'passive', name: 'Momentum', icon: '🌀', max: 3, desc: '+3% cooldown reduction and +2% lifesteal per rank', mods: { cdr: 0.03, lifesteal: 2 } },
        { id: 'mnk_dragon', tier: 4, type: 'active', name: 'Dragon\'s Spiral', icon: '🐉', desc: 'A whirling kick that strikes and stuns everything around you.', kind: 'nova', cost: 25, cd: 40, dmg: 2.6, radius: 6, stun: 2, knock: 4, color: 0xffa040 },
      ] },
    ],
  },

  bard: {
    name: 'Bard', icon: '🎵', role: 'Support',
    desc: 'A wandering minstrel whose blade keeps time with their songs, lifting allies and lulling enemies to stillness.',
    weapon: 'sword', second: 'bow', armor: 'medium', gear: ['chest', 'legs', 'feet'],
    attrs: { dex: 2, int: 2, con: 1, str: 1 }, color: 0x6a3a8a, mana: 1.0,
    trees: [
      { id: 'brd_war', name: 'Songs of War', icon: '🥁', desc: 'Marching rhythms.', nodes: [
        { id: 'brd_anthem', tier: 0, type: 'active', name: 'Battle Anthem', icon: '🎺', desc: 'A rousing tune that quickens your blade.', kind: 'buff', cost: 12, cd: 18, dur: 12, buff: { atkSpeed: 0.2 }, color: 0xff8040 },
        { id: 'brd_tempo', tier: 1, type: 'passive', name: 'Tempo', icon: '🎼', max: 3, desc: '+4% attack speed and +2% all damage per rank', mods: { atkSpeed: 0.04, dmg: 0.02 } },
        { id: 'brd_flourish', tier: 2, type: 'active', name: 'Blade Flourish', icon: '🗡️', desc: 'A showy, cutting strike in time with the beat.', kind: 'strike', cost: 15, cd: 8, dmg: 2.0, range: 3.5, bleed: 0.8 },
        { id: 'brd_crescendo', tier: 3, type: 'passive', name: 'Crescendo', icon: '📯', max: 3, desc: '+2% crit chance and +3% move speed per rank', mods: { crit: 2, moveSpeed: 0.03 } },
        { id: 'brd_warsong', tier: 4, type: 'active', name: 'Song of Heroes', icon: '🎶', desc: 'An epic ballad that turns you into a legend for a time.', kind: 'buff', cost: 30, cd: 55, dur: 15, buff: { dmg: 0.3, atkSpeed: 0.25, moveSpeed: 0.2 }, color: 0xffb040 },
      ] },
      { id: 'brd_warding', name: 'Songs of Warding', icon: '🎻', desc: 'Protective melodies.', nodes: [
        { id: 'brd_hymn', tier: 0, type: 'active', name: 'Hymn of Mending', icon: '🎹', desc: 'A soothing hymn that heals over time.', kind: 'hot', cost: 14, cd: 12, heal: 0.3, dur: 10, color: 0x80ffc0 },
        { id: 'brd_harmony', tier: 1, type: 'passive', name: 'Harmony', icon: '🎧', max: 3, desc: '+1.2 health regen and +0.4 mana regen per rank', mods: { regen: 1.2, manaRegen: 0.4 } },
        { id: 'brd_chord', tier: 2, type: 'active', name: 'Warding Chord', icon: '🔊', desc: 'A resonant chord forms a sound barrier around you.', kind: 'shield', cost: 18, cd: 18, heal: 0.25, dur: 10, color: 0xa080ff },
        { id: 'brd_refrain', tier: 3, type: 'passive', name: 'Steady Refrain', icon: '🎙️', max: 3, desc: '+2% damage reduction and +3% max health per rank', mods: { dr: 0.02, maxHpPct: 0.03 } },
        { id: 'brd_lullaby', tier: 4, type: 'active', name: 'Ballad of the Unbroken', icon: '🪕', desc: 'A soaring verse that shields you and steadies your nerve.', kind: 'buff', cost: 30, cd: 55, dur: 12, buff: { dr: 0.35, regen: 8 }, color: 0xc0a0ff },
      ] },
      { id: 'brd_discord', name: 'Discord', icon: '🎸', desc: 'Dissonance as a weapon.', nodes: [
        { id: 'brd_sleep', tier: 0, type: 'active', name: 'Lullaby', icon: '😴', desc: 'A drowsy tune puts foes at the target point to sleep.', kind: 'mez', cost: 15, cd: 14, radius: 5, dur: 6, range: 18 },
        { id: 'brd_dissonance', tier: 1, type: 'passive', name: 'Dissonance', icon: '📻', max: 3, desc: '+5% spell damage per rank', mods: { spellDmg: 0.05 } },
        { id: 'brd_shriek', tier: 2, type: 'active', name: 'Shattering Note', icon: '📣', desc: 'A piercing note bursts around you, staggering foes.', kind: 'nova', cost: 20, cd: 14, dmg: 1.4, radius: 6, stun: 1, color: 0xff60c0 },
        { id: 'brd_requiem', tier: 3, type: 'passive', name: 'Requiem', icon: '🎚️', max: 3, desc: '+3% cooldown reduction and +5% damage-over-time per rank', mods: { cdr: 0.03, dotDmg: 0.05 } },
        { id: 'brd_cacophony', tier: 4, type: 'active', name: 'Cacophony', icon: '🔔', desc: 'A storm of clashing sound crashes down on the target area.', kind: 'rain', cost: 35, cd: 40, dmg: 2.6, radius: 6, delay: 0.8, range: 20, stun: 1.5, color: 0xe040ff },
      ] },
    ],
  },

  rogue: {
    name: 'Rogue', icon: '🗡️', role: 'Melee',
    desc: 'A quick-handed cutthroat who strikes from the shadows, coats every blade in venom and is gone before the body falls.',
    weapon: 'sword', second: 'bow', armor: 'light', gear: ['chest', 'legs', 'feet'],
    attrs: { dex: 5, str: 1 }, color: 0x2a2a2a, mana: 0.6,
    trees: [
      { id: 'rog_assassin', name: 'Assassination', icon: '🎯', desc: 'One perfect cut.', nodes: [
        { id: 'rog_backstab', tier: 0, type: 'active', name: 'Backstab', icon: '🔪', desc: 'Drive your blade into a vital spot.', kind: 'strike', cost: 10, cd: 5, dmg: 2.2, range: 3 },
        { id: 'rog_lethal', tier: 1, type: 'passive', name: 'Lethality', icon: '☠️', max: 3, desc: '+2% crit chance and +10% crit damage per rank', mods: { crit: 2, critDmg: 0.1 } },
        { id: 'rog_garrote', tier: 2, type: 'active', name: 'Garrote', icon: '🧵', desc: 'A choking strike that leaves the target bleeding heavily.', kind: 'strike', cost: 15, cd: 12, dmg: 1.6, range: 3, stun: 1, bleed: 2.0 },
        { id: 'rog_cold', tier: 3, type: 'passive', name: 'Cold Blood', icon: '🧊', max: 3, desc: '+4% light attack damage and +2% heal on kill per rank', mods: { lightDmg: 0.04, killHeal: 0.02 } },
        { id: 'rog_deathmark', tier: 4, type: 'active', name: 'Deathmark', icon: '💀', desc: 'The assassin\'s masterstroke, nearly certain to kill.', kind: 'strike', cost: 25, cd: 35, dmg: 4.0, range: 3.5, stun: 1.5, bleed: 2.5 },
      ] },
      { id: 'rog_shadows', name: 'Shadows', icon: '🌑', desc: 'Never be where they strike.', nodes: [
        { id: 'rog_shadowstep', tier: 0, type: 'active', name: 'Shadowstep', icon: '👣', desc: 'Dart through the shadows, cutting foes in your path.', kind: 'dash', cost: 10, cd: 7, dmg: 1.0, dist: 9 },
        { id: 'rog_nimble', tier: 1, type: 'passive', name: 'Nimble', icon: '🐈', max: 3, desc: '+4% move speed and +5% stamina regen per rank', mods: { moveSpeed: 0.04, stamRegen: 0.05 } },
        { id: 'rog_evasion', tier: 2, type: 'active', name: 'Evasion', icon: '💨', desc: 'Dodge and weave, avoiding most damage.', kind: 'buff', cost: 15, cd: 22, dur: 6, buff: { dr: 0.45, moveSpeed: 0.2 }, color: 0x404060 },
        { id: 'rog_cloak', tier: 3, type: 'passive', name: 'Cloak of Dusk', icon: '🧥', max: 3, desc: '+3% damage reduction and +3% cooldown reduction per rank', mods: { dr: 0.03, cdr: 0.03 } },
        { id: 'rog_blind', tier: 4, type: 'active', name: 'Smoke Bomb', icon: '💣', desc: 'Burst of choking smoke stuns everything around you.', kind: 'nova', cost: 25, cd: 40, dmg: 1.2, radius: 6, stun: 3, color: 0x505050 },
      ] },
      { id: 'rog_poisons', name: 'Poisons', icon: '🧪', desc: 'Venom in every wound.', nodes: [
        { id: 'rog_venom', tier: 0, type: 'active', name: 'Envenom', icon: '🐍', desc: 'Coat a foe in creeping venom.', kind: 'dot', cost: 10, cd: 6, dmg: 1.4, dur: 8, color: 0x40c040 },
        { id: 'rog_toxin', tier: 1, type: 'passive', name: 'Potent Toxins', icon: '⚗️', max: 3, desc: '+6% damage-over-time per rank', mods: { dotDmg: 0.06 } },
        { id: 'rog_crippling', tier: 2, type: 'active', name: 'Crippling Dart', icon: '🎯', desc: 'A poisoned dart that slows its target.', kind: 'bolt', cost: 12, cd: 10, dmg: 1.0, speed: 45, slow: 4, color: 0x60e060 },
        { id: 'rog_virulent', tier: 3, type: 'passive', name: 'Virulence', icon: '🦂', max: 3, desc: '+3% all damage and +2% lifesteal per rank', mods: { dmg: 0.03, lifesteal: 2 } },
        { id: 'rog_plague', tier: 4, type: 'active', name: 'Widow\'s Kiss', icon: '🕷️', desc: 'A lethal venom that leaps to every nearby enemy.', kind: 'dot', cost: 25, cd: 30, dmg: 3.0, dur: 10, spread: true, color: 0x20a020 },
      ] },
    ],
  },

  shaman: {
    name: 'Shaman', icon: '🪶', role: 'Support',
    desc: 'A speaker for the spirits of land and ancestor, who wards friends, hexes foes and calls ghostly wolves to the hunt.',
    weapon: 'staff', second: 'hammer', armor: 'medium', gear: ['chest', 'legs', 'feet'],
    attrs: { int: 3, con: 2, str: 1 }, color: 0x2a6a8a, mana: 1.2,
    trees: [
      { id: 'sha_wards', name: 'Spirit Wards', icon: '🗿', desc: 'Protection of the spirits.', nodes: [
        { id: 'sha_ward', tier: 0, type: 'active', name: 'Spirit Ward', icon: '🧿', desc: 'A ghostly ward absorbs incoming harm.', kind: 'shield', cost: 14, cd: 12, heal: 0.2, dur: 10, color: 0x60c0e0 },
        { id: 'sha_totem', tier: 1, type: 'passive', name: 'Totemic Strength', icon: '🪵', max: 3, desc: '+3% max health and +4% armor per rank', mods: { maxHpPct: 0.03, armorPct: 0.04 } },
        { id: 'sha_rain', tier: 2, type: 'active', name: 'Healing Rain', icon: '🌧️', desc: 'A gentle spirit-rain heals you over time.', kind: 'hot', cost: 18, cd: 15, heal: 0.4, dur: 10, color: 0x80c0ff },
        { id: 'sha_flow', tier: 3, type: 'passive', name: 'Spirit Flow', icon: '💧', max: 3, desc: '+5% healing power and +0.5 mana regen per rank', mods: { healPower: 0.05, manaRegen: 0.5 } },
        { id: 'sha_cleansing', tier: 4, type: 'active', name: 'Ancestral Embrace', icon: '🫂', desc: 'Your ancestors shield you with their own spirits.', kind: 'shield', cost: 35, cd: 50, heal: 0.5, dur: 12, color: 0x90e0ff },
      ] },
      { id: 'sha_hexes', name: 'Hexes', icon: '🪄', desc: 'Curses and frost.', nodes: [
        { id: 'sha_frostbite', tier: 0, type: 'active', name: 'Frost Shock', icon: '❄️', desc: 'A shard of spirit-ice that slows its target.', kind: 'bolt', cost: 12, cd: 5, dmg: 1.0, speed: 38, slow: 3, color: 0xa0e0ff },
        { id: 'sha_malice', tier: 1, type: 'passive', name: 'Malice', icon: '😠', max: 3, desc: '+5% damage-over-time and +3% spell damage per rank', mods: { dotDmg: 0.05, spellDmg: 0.03 } },
        { id: 'sha_hex', tier: 2, type: 'active', name: 'Withering Hex', icon: '🌀', desc: 'A curse that eats away at a foe and nearby allies of it.', kind: 'dot', cost: 18, cd: 12, dmg: 1.8, dur: 10, spread: true, color: 0x80a040 },
        { id: 'sha_torpor', tier: 3, type: 'passive', name: 'Torpor', icon: '🐢', max: 3, desc: '+3% cooldown reduction and +2% damage reduction per rank', mods: { cdr: 0.03, dr: 0.02 } },
        { id: 'sha_earthquake', tier: 4, type: 'active', name: 'Earthshatter', icon: '🌋', desc: 'The ground erupts, crushing and slowing all in the area.', kind: 'rain', cost: 40, cd: 40, dmg: 2.8, radius: 6, delay: 1.0, range: 20, slow: 4, stun: 1, color: 0x8a6a3a },
      ] },
      { id: 'sha_ancestors', name: 'Ancestors', icon: '👻', desc: 'Kin beyond the veil.', nodes: [
        { id: 'sha_wolf', tier: 0, type: 'active', name: 'Spirit Wolf', icon: '🐺', desc: 'Call a spectral wolf to hunt beside you.', kind: 'pet', cost: 20, cd: 25, pet: { type: 'wolf', hp: 0.6, dmg: 0.5, dur: 60, count: 1 } },
        { id: 'sha_bond', tier: 1, type: 'passive', name: 'Spirit Bond', icon: '🔗', max: 3, desc: '+8% pet damage and +8% pet health per rank', mods: { petDmg: 0.08, petHp: 0.08 } },
        { id: 'sha_spirit', tier: 2, type: 'active', name: 'Ancestral Fury', icon: '🔥', desc: 'Your forebears empower your arm.', kind: 'buff', cost: 18, cd: 25, dur: 12, buff: { dmg: 0.2, atkSpeed: 0.15 }, color: 0xff9040 },
        { id: 'sha_wisdom', tier: 3, type: 'passive', name: 'Elder Wisdom', icon: '📖', max: 3, desc: '+4% max mana and +4% spell damage per rank', mods: { maxManaPct: 0.04, spellDmg: 0.04 } },
        { id: 'sha_host', tier: 4, type: 'active', name: 'Ghost Pack', icon: '🌫️', desc: 'Summon a pack of ancestor spirits that hurl spectral bolts.', kind: 'pet', cost: 40, cd: 60, pet: { type: 'spirit', hp: 0.5, dmg: 0.6, dur: 45, count: 3, ranged: true } },
      ] },
    ],
  },

  necromancer: {
    name: 'Necromancer', icon: '💀', role: 'Pet Caster',
    desc: 'A scholar of the grave who drinks the life of the living and commands the bones of the dead to do their bidding.',
    weapon: 'staff', second: 'sword', armor: 'light', gear: ['chest', 'legs', 'feet'],
    attrs: { int: 5, con: 1 }, color: 0x3a1a4a, mana: 1.3,
    trees: [
      { id: 'nec_siphon', name: 'Siphon', icon: '🩸', desc: 'Steal life to sustain your own.', nodes: [
        { id: 'nec_siphonlife', tier: 0, type: 'active', name: 'Siphon Life', icon: '🧛', desc: 'Pull the life from every foe around you into your own veins.', kind: 'drain', cost: 15, cd: 8, dmg: 1.0, radius: 6, heal: 0.6, color: 0x8a1040 },
        { id: 'nec_hunger', tier: 1, type: 'passive', name: 'Deathly Hunger', icon: '🍽️', max: 3, desc: '+2% lifesteal and +3% spell damage per rank', mods: { lifesteal: 2, spellDmg: 0.03 } },
        { id: 'nec_bonearmor', tier: 2, type: 'active', name: 'Bone Armor', icon: '🦴', desc: 'Encase yourself in a cage of whirling bone.', kind: 'shield', cost: 18, cd: 18, heal: 0.25, dur: 12, color: 0xe0d8c0 },
        { id: 'nec_soulharvest', tier: 3, type: 'passive', name: 'Soul Harvest', icon: '👻', max: 3, desc: 'Heal 2% max health on kill and +0.5 mana regen per rank', mods: { killHeal: 0.02, manaRegen: 0.5 } },
        { id: 'nec_vortex', tier: 4, type: 'active', name: 'Grave Vortex', icon: '🌑', desc: 'A churning vortex tears life from everything near you.', kind: 'drain', cost: 40, cd: 45, dmg: 2.6, radius: 8, heal: 0.9, color: 0x600030 },
      ] },
      { id: 'nec_summoning', name: 'Summoning', icon: '⚰️', desc: 'Raise and empower the dead.', nodes: [
        { id: 'nec_skeleton', tier: 0, type: 'active', name: 'Raise Skeleton', icon: '💀', desc: 'A skeleton warrior claws its way up to serve you.', kind: 'pet', cost: 20, cd: 15, pet: { type: 'skeleton', hp: 0.7, dmg: 0.5, dur: 0, count: 1 } },
        { id: 'nec_darkpact', tier: 1, type: 'passive', name: 'Dark Pact', icon: '📕', max: 3, desc: '+10% pet damage per rank', mods: { petDmg: 0.1 } },
        { id: 'nec_zombie', tier: 2, type: 'active', name: 'Animate Corpse', icon: '🧟', desc: 'Raise a hulking zombie that soaks up blows.', kind: 'pet', cost: 25, cd: 25, pet: { type: 'zombie', hp: 1.3, dmg: 0.4, dur: 90, count: 1 } },
        { id: 'nec_sinew', tier: 3, type: 'passive', name: 'Unholy Sinew', icon: '🧬', max: 3, desc: '+10% pet health and +3% cooldown reduction per rank', mods: { petHp: 0.1, cdr: 0.03 } },
        { id: 'nec_legion', tier: 4, type: 'active', name: 'Army of the Dead', icon: '☠️', desc: 'Raise a whole squad of skeletal soldiers at once.', kind: 'pet', cost: 45, cd: 60, pet: { type: 'skeleton', hp: 0.6, dmg: 0.6, dur: 60, count: 3 } },
      ] },
      { id: 'nec_plague', name: 'Plague', icon: '🦠', desc: 'Rot, disease and decay.', nodes: [
        { id: 'nec_rot', tier: 0, type: 'active', name: 'Rotting Curse', icon: '🥀', desc: 'Curse a foe with a wasting rot.', kind: 'dot', cost: 12, cd: 5, dmg: 1.6, dur: 8, color: 0x60803a },
        { id: 'nec_fester', tier: 1, type: 'passive', name: 'Fester', icon: '🪱', max: 3, desc: '+6% damage-over-time per rank', mods: { dotDmg: 0.06 } },
        { id: 'nec_contagion', tier: 2, type: 'active', name: 'Contagion', icon: '🤢', desc: 'A plague that leaps from the target to every enemy nearby.', kind: 'dot', cost: 22, cd: 14, dmg: 2.0, dur: 10, spread: true, color: 0x80a020 },
        { id: 'nec_pestilent', tier: 3, type: 'passive', name: 'Pestilent Mind', icon: '🧠', max: 3, desc: '+4% spell damage and +4% max mana per rank', mods: { spellDmg: 0.04, maxManaPct: 0.04 } },
        { id: 'nec_bloom', tier: 4, type: 'active', name: 'Corpse Bloom', icon: '🍄', desc: 'A cloud of choking spores bursts over the target area.', kind: 'rain', cost: 40, cd: 40, dmg: 2.8, radius: 6, delay: 1.0, range: 20, slow: 4, color: 0x7aa030 },
      ] },
    ],
  },

  wizard: {
    name: 'Wizard', icon: '🧙', role: 'Caster',
    desc: 'A master of raw elemental force who turns study into flame, frost and folded space.',
    weapon: 'staff', second: 'sword', armor: 'light', gear: ['chest', 'legs', 'feet'],
    attrs: { int: 6, con: 1, str: -1 }, color: 0x2a3a9a, mana: 1.4,
    trees: [
      { id: 'wiz_fire', name: 'Fire', icon: '🔥', desc: 'Burn it all.', nodes: [
        { id: 'wiz_fireball', tier: 0, type: 'active', name: 'Fireball', icon: '☄️', desc: 'A roaring ball of flame that bursts on impact.', kind: 'bolt', cost: 14, cd: 4, dmg: 1.3, speed: 35, explode: 3, color: 0xff6020 },
        { id: 'wiz_ignite', tier: 1, type: 'passive', name: 'Ignition', icon: '🕯️', max: 3, desc: '+5% spell damage per rank', mods: { spellDmg: 0.05 } },
        { id: 'wiz_firestorm', tier: 2, type: 'active', name: 'Firestorm', icon: '🌋', desc: 'Flames rain down on the target area.', kind: 'rain', cost: 25, cd: 14, dmg: 1.8, radius: 5, delay: 0.8, range: 20, color: 0xff4010 },
        { id: 'wiz_combust', tier: 3, type: 'passive', name: 'Combustion', icon: '💥', max: 3, desc: '+2% crit chance and +8% crit damage per rank', mods: { crit: 2, critDmg: 0.08 } },
        { id: 'wiz_meteor', tier: 4, type: 'active', name: 'Meteor', icon: '🌠', desc: 'Pull a blazing star down from the sky.', kind: 'rain', cost: 45, cd: 45, dmg: 3.0, radius: 6, delay: 1.5, range: 20, stun: 1.5, color: 0xff3000 },
      ] },
      { id: 'wiz_frost', name: 'Frost', icon: '❄️', desc: 'Slow, freeze, shatter.', nodes: [
        { id: 'wiz_icebolt', tier: 0, type: 'active', name: 'Ice Lance', icon: '🧊', desc: 'A spear of ice that chills its target.', kind: 'bolt', cost: 12, cd: 4, dmg: 1.1, speed: 45, slow: 3, color: 0x80d0ff },
        { id: 'wiz_chill', tier: 1, type: 'passive', name: 'Deep Chill', icon: '🌨️', max: 3, desc: '+3% damage reduction and +2% spell damage per rank', mods: { dr: 0.03, spellDmg: 0.02 } },
        { id: 'wiz_frostnova', tier: 2, type: 'active', name: 'Frost Nova', icon: '💠', desc: 'A ring of frost blasts outward, freezing nearby foes.', kind: 'nova', cost: 20, cd: 14, dmg: 1.2, radius: 6, slow: 4, stun: 1.5, color: 0xa0e8ff },
        { id: 'wiz_permafrost', tier: 3, type: 'passive', name: 'Permafrost', icon: '🏔️', max: 3, desc: '+3% cooldown reduction and +3% max health per rank', mods: { cdr: 0.03, maxHpPct: 0.03 } },
        { id: 'wiz_glacier', tier: 4, type: 'active', name: 'Glacial Prison', icon: '⛄', desc: 'Ice erupts at the target point, freezing and crushing foes in place.', kind: 'root', cost: 35, cd: 40, radius: 6, dur: 5, range: 20, dmg: 2.4 },
      ] },
      { id: 'wiz_arcane', name: 'Arcane', icon: '🔮', desc: 'The folded weave of magic.', nodes: [
        { id: 'wiz_blink', tier: 0, type: 'active', name: 'Blink', icon: '✨', desc: 'Fold space and flicker forward, jolting anything you pass.', kind: 'dash', cost: 12, cd: 8, dmg: 0.6, dist: 12 },
        { id: 'wiz_attune', tier: 1, type: 'passive', name: 'Attunement', icon: '🔋', max: 3, desc: '+6% max mana and +0.6 mana regen per rank', mods: { maxManaPct: 0.06, manaRegen: 0.6 } },
        { id: 'wiz_barrier', tier: 2, type: 'active', name: 'Arcane Barrier', icon: '🛡️', desc: 'A lattice of force absorbs damage.', kind: 'shield', cost: 20, cd: 18, heal: 0.3, dur: 10, color: 0xc080ff },
        { id: 'wiz_focus', tier: 3, type: 'passive', name: 'Arcane Focus', icon: '🧠', max: 3, desc: '+4% spell damage and +3% cooldown reduction per rank', mods: { spellDmg: 0.04, cdr: 0.03 } },
        { id: 'wiz_orb', tier: 4, type: 'active', name: 'Arcane Orb', icon: '🟣', desc: 'A slow, piercing orb of pure force that detonates at the end.', kind: 'bolt', cost: 40, cd: 35, dmg: 2.8, speed: 25, pierce: true, explode: 5, color: 0xb040ff },
      ] },
    ],
  },

  magician: {
    name: 'Magician', icon: '🔥', role: 'Pet Caster',
    desc: 'A conjurer who binds elemental beings to service and shapes raw matter into bolts and barriers.',
    weapon: 'staff', second: 'sword', armor: 'light', gear: ['chest', 'legs', 'feet'],
    attrs: { int: 5, con: 2, str: -1 }, color: 0xa04a1a, mana: 1.3,
    trees: [
      { id: 'mag_elementals', name: 'Elementals', icon: '🌋', desc: 'Bound elemental servants.', nodes: [
        { id: 'mag_fireelem', tier: 0, type: 'active', name: 'Fire Elemental', icon: '🔥', desc: 'Bind a blazing elemental that hurls fire.', kind: 'pet', cost: 22, cd: 20, pet: { type: 'elemental_fire', hp: 0.6, dmg: 0.6, dur: 0, count: 1, ranged: true } },
        { id: 'mag_binding', tier: 1, type: 'passive', name: 'Binding Runes', icon: '🔣', max: 3, desc: '+8% pet damage per rank', mods: { petDmg: 0.08 } },
        { id: 'mag_earthelem', tier: 2, type: 'active', name: 'Earth Elemental', icon: '🪨', desc: 'Raise a stony elemental that holds the line.', kind: 'pet', cost: 25, cd: 25, pet: { type: 'elemental_earth', hp: 1.4, dmg: 0.5, dur: 0, count: 1 } },
        { id: 'mag_essence', tier: 3, type: 'passive', name: 'Elemental Essence', icon: '⚗️', max: 3, desc: '+8% pet health and +3% spell damage per rank', mods: { petHp: 0.08, spellDmg: 0.03 } },
        { id: 'mag_conflux', tier: 4, type: 'active', name: 'Elemental Conflux', icon: '🌀', desc: 'Tear open a rift and pull through a trio of fire elementals.', kind: 'pet', cost: 45, cd: 60, pet: { type: 'elemental_fire', hp: 0.5, dmg: 0.7, dur: 45, count: 3, ranged: true } },
      ] },
      { id: 'mag_conjuration', name: 'Conjuration', icon: '✨', desc: 'Shape magic into matter.', nodes: [
        { id: 'mag_bolt', tier: 0, type: 'active', name: 'Conjured Bolt', icon: '⚡', desc: 'A dart of condensed force.', kind: 'bolt', cost: 10, cd: 4, dmg: 1.0, speed: 45, color: 0xffa040 },
        { id: 'mag_shape', tier: 1, type: 'passive', name: 'Matter Shaping', icon: '💎', max: 3, desc: '+5% spell damage per rank', mods: { spellDmg: 0.05 } },
        { id: 'mag_shieldconj', tier: 2, type: 'active', name: 'Conjured Plate', icon: '🛡️', desc: 'Summon a floating plate barrier around yourself.', kind: 'shield', cost: 18, cd: 18, heal: 0.3, dur: 10, color: 0xffc080 },
        { id: 'mag_focus', tier: 3, type: 'passive', name: 'Conjurer\'s Focus', icon: '🔮', max: 3, desc: '+0.6 mana regen and +3% cooldown reduction per rank', mods: { manaRegen: 0.6, cdr: 0.03 } },
        { id: 'mag_spear', tier: 4, type: 'active', name: 'Spear of Ruin', icon: '🔱', desc: 'A massive conjured spear that pierces and explodes.', kind: 'bolt', cost: 40, cd: 35, dmg: 3.0, speed: 50, pierce: true, explode: 4, color: 0xff7020 },
      ] },
      { id: 'mag_bond', name: 'Summoner\'s Bond', icon: '🔗', desc: 'Share strength with your servants.', nodes: [
        { id: 'mag_empower', tier: 0, type: 'active', name: 'Empower Servants', icon: '💪', desc: 'Pour power into yourself and your summons.', kind: 'buff', cost: 15, cd: 20, dur: 12, buff: { petDmg: 0.3, spellDmg: 0.1 }, color: 0xffb060 },
        { id: 'mag_link', tier: 1, type: 'passive', name: 'Soul Link', icon: '🫀', max: 3, desc: '+10% pet health per rank', mods: { petHp: 0.1 } },
        { id: 'mag_reclaim', tier: 2, type: 'active', name: 'Reclaim Energy', icon: '♻️', desc: 'Draw energy back through your bond to heal yourself.', kind: 'heal', cost: 15, cd: 16, heal: 0.25, color: 0xffe0a0 },
        { id: 'mag_mastery', tier: 3, type: 'passive', name: 'Summoner Mastery', icon: '👑', max: 3, desc: '+8% pet damage and +3% damage reduction per rank', mods: { petDmg: 0.08, dr: 0.03 } },
        { id: 'mag_golem', tier: 4, type: 'active', name: 'Animate Golem', icon: '🗿', desc: 'Forge a towering golem of stone and runes.', kind: 'pet', cost: 45, cd: 60, pet: { type: 'golem', hp: 1.5, dmg: 0.9, dur: 0, count: 1 } },
      ] },
    ],
  },

  enchanter: {
    name: 'Enchanter', icon: '🌀', role: 'Support',
    desc: 'A weaver of glamours who bends minds, lulls monsters into helpless dreams and hides behind shimmering illusions.',
    weapon: 'staff', second: 'sword', armor: 'light', gear: ['chest', 'legs', 'feet'],
    attrs: { int: 5, dex: 1 }, color: 0x8a3a9a, mana: 1.4,
    trees: [
      { id: 'enc_mesmerize', name: 'Mesmerize', icon: '😵', desc: 'Control the battlefield.', nodes: [
        { id: 'enc_mez', tier: 0, type: 'active', name: 'Mesmerize', icon: '💤', desc: 'Lull foes at the target point into a deep trance.', kind: 'mez', cost: 15, cd: 12, radius: 4, dur: 8, range: 20 },
        { id: 'enc_hypnotic', tier: 1, type: 'passive', name: 'Hypnotic Voice', icon: '🗣️', max: 3, desc: '+3% cooldown reduction and +2% damage reduction per rank', mods: { cdr: 0.03, dr: 0.02 } },
        { id: 'enc_dazzle', tier: 2, type: 'active', name: 'Dazzle', icon: '💫', desc: 'A dazzling flash stuns those in front of you.', kind: 'stun', cost: 18, cd: 15, dmg: 0.6, range: 7, arc: 120, stun: 3 },
        { id: 'enc_entrance', tier: 3, type: 'passive', name: 'Entrancement', icon: '🎐', max: 3, desc: '+4% spell damage and +3% move speed per rank', mods: { spellDmg: 0.04, moveSpeed: 0.03 } },
        { id: 'enc_massmez', tier: 4, type: 'active', name: 'Dreamfall', icon: '🌙', desc: 'A vast wave of slumber blankets the area.', kind: 'mez', cost: 35, cd: 50, radius: 8, dur: 12, range: 20 },
      ] },
      { id: 'enc_illusions', name: 'Illusions', icon: '🪞', desc: 'Nothing is as it seems.', nodes: [
        { id: 'enc_rune', tier: 0, type: 'active', name: 'Shimmering Rune', icon: '🔷', desc: 'A rune of illusion absorbs the next blows.', kind: 'shield', cost: 15, cd: 12, heal: 0.25, dur: 12, color: 0xd080ff },
        { id: 'enc_mirror', tier: 1, type: 'passive', name: 'Mirror Skin', icon: '🪩', max: 3, desc: '+3% damage reduction per rank', mods: { dr: 0.03 } },
        { id: 'enc_haste', tier: 2, type: 'active', name: 'Glamour of Speed', icon: '⏩', desc: 'An illusion of speed made real.', kind: 'buff', cost: 18, cd: 22, dur: 12, buff: { moveSpeed: 0.3, atkSpeed: 0.2, cdr: 0.1 }, color: 0xf0a0ff },
        { id: 'enc_phantasm', tier: 3, type: 'passive', name: 'Phantasm', icon: '🎭', max: 3, desc: '+3% max health and +1 health regen per rank', mods: { maxHpPct: 0.03, regen: 1 } },
        { id: 'enc_phantom', tier: 4, type: 'active', name: 'Phantom Double', icon: '👥', desc: 'Conjure illusory doubles that fight alongside you.', kind: 'pet', cost: 40, cd: 60, pet: { type: 'spirit', hp: 0.5, dmg: 0.5, dur: 40, count: 2, ranged: true } },
      ] },
      { id: 'enc_mind', name: 'Mind', icon: '🧠', desc: 'Power of thought.', nodes: [
        { id: 'enc_mindspike', tier: 0, type: 'active', name: 'Mind Spike', icon: '📌', desc: 'A psychic curse that gnaws at a foe\'s mind.', kind: 'dot', cost: 12, cd: 5, dmg: 1.5, dur: 8, color: 0xc060e0 },
        { id: 'enc_clarity', tier: 1, type: 'passive', name: 'Clarity', icon: '💎', max: 3, desc: '+0.8 mana regen and +5% max mana per rank', mods: { manaRegen: 0.8, maxManaPct: 0.05 } },
        { id: 'enc_psywave', tier: 2, type: 'active', name: 'Psychic Wave', icon: '〰️', desc: 'A wave of mental force bursts outward, stunning foes.', kind: 'nova', cost: 22, cd: 14, dmg: 1.4, radius: 6, stun: 1.5, color: 0xe080ff },
        { id: 'enc_brilliance', tier: 3, type: 'passive', name: 'Brilliance', icon: '💡', max: 3, desc: '+5% spell damage and +4% damage-over-time per rank', mods: { spellDmg: 0.05, dotDmg: 0.04 } },
        { id: 'enc_shatter', tier: 4, type: 'active', name: 'Mind Shatter', icon: '🧨', desc: 'Detonate the thoughts of everything in the target area.', kind: 'rain', cost: 40, cd: 40, dmg: 2.8, radius: 6, delay: 0.7, range: 20, stun: 2, color: 0xa020e0 },
      ] },
    ],
  },

  beastlord: {
    name: 'Beastlord', icon: '🐾', role: 'Hybrid',
    desc: 'A wild-hearted fighter bound to a beast companion, sharing its strength, fury and spirit in every fight.',
    weapon: 'greataxe', second: 'hammer', armor: 'medium', gear: ['chest', 'legs', 'feet'],
    attrs: { str: 2, dex: 2, con: 1, int: 1 }, color: 0x7a5a2a, mana: 1.0,
    trees: [
      { id: 'bst_bond', name: 'Beast Bond', icon: '🐺', desc: 'Your loyal companion.', nodes: [
        { id: 'bst_wolf', tier: 0, type: 'active', name: 'Call Warder', icon: '🐕', desc: 'Summon your faithful wolf warder.', kind: 'pet', cost: 20, cd: 15, pet: { type: 'wolf', hp: 0.8, dmg: 0.6, dur: 0, count: 1 } },
        { id: 'bst_packlead', tier: 1, type: 'passive', name: 'Pack Leader', icon: '🦮', max: 3, desc: '+10% pet damage per rank', mods: { petDmg: 0.1 } },
        { id: 'bst_feral', tier: 2, type: 'active', name: 'Feral Spirit', icon: '🕷️', desc: 'Call a brood of venomous spiders from the undergrowth.', kind: 'pet', cost: 22, cd: 25, pet: { type: 'spider', hp: 0.4, dmg: 0.4, dur: 40, count: 2 } },
        { id: 'bst_hide', tier: 3, type: 'passive', name: 'Shared Hide', icon: '🦔', max: 3, desc: '+10% pet health and +2% damage reduction per rank', mods: { petHp: 0.1, dr: 0.02 } },
        { id: 'bst_bear', tier: 4, type: 'active', name: 'Ursine Champion', icon: '🐻', desc: 'Summon a mighty war bear to crush your foes.', kind: 'pet', cost: 40, cd: 60, pet: { type: 'bear', hp: 1.5, dmg: 0.9, dur: 0, count: 1 } },
      ] },
      { id: 'bst_fury', name: 'Primal Fury', icon: '🐅', desc: 'Fight like an animal.', nodes: [
        { id: 'bst_maul', tier: 0, type: 'active', name: 'Maul', icon: '🦁', desc: 'A savage axe blow that rends flesh.', kind: 'strike', cost: 10, cd: 6, dmg: 2.0, range: 3.5, bleed: 0.8 },
        { id: 'bst_instinct', tier: 1, type: 'passive', name: 'Predator Instinct', icon: '🐊', max: 3, desc: '+3% all damage and +2% crit chance per rank', mods: { dmg: 0.03, crit: 2 } },
        { id: 'bst_roar', tier: 2, type: 'active', name: 'Primal Roar', icon: '🗯️', desc: 'Roar with the voice of the wild, quickening your blows.', kind: 'buff', cost: 15, cd: 20, dur: 12, buff: { atkSpeed: 0.2, dmg: 0.15 }, color: 0xc08040 },
        { id: 'bst_ferocity', tier: 3, type: 'passive', name: 'Ferocity', icon: '🐗', max: 3, desc: '+4% heavy attack damage and +2% lifesteal per rank', mods: { heavyDmg: 0.04, lifesteal: 2 } },
        { id: 'bst_rampage', tier: 4, type: 'active', name: 'Savage Pounce', icon: '🐆', desc: 'Leap onto the target point and tear into everything there.', kind: 'leap', cost: 30, cd: 35, dmg: 3.0, radius: 5, range: 16 },
      ] },
      { id: 'bst_spirit', name: 'Spirit Healing', icon: '🌿', desc: 'Wild spirits mend you.', nodes: [
        { id: 'bst_mend', tier: 0, type: 'active', name: 'Spirit Mend', icon: '💚', desc: 'Animal spirits knit your wounds.', kind: 'heal', cost: 15, cd: 10, heal: 0.2, color: 0x80ff80 },
        { id: 'bst_vigor', tier: 1, type: 'passive', name: 'Wild Vigor', icon: '🌱', max: 3, desc: '+5% healing power and +1 health regen per rank', mods: { healPower: 0.05, regen: 1 } },
        { id: 'bst_salve', tier: 2, type: 'active', name: 'Spirit Salve', icon: '🍃', desc: 'Cleanse poisons and slows with spirit-touched herbs.', kind: 'cleanse', cost: 14, cd: 14, heal: 0.15 },
        { id: 'bst_kinship', tier: 3, type: 'passive', name: 'Spirit Kinship', icon: '🌾', max: 3, desc: '+3% max health and +0.5 mana regen per rank', mods: { maxHpPct: 0.03, manaRegen: 0.5 } },
        { id: 'bst_renewal', tier: 4, type: 'active', name: 'Ancestral Renewal', icon: '🌳', desc: 'The great spirit of the wild heals you powerfully over time.', kind: 'hot', cost: 30, cd: 50, heal: 0.5, dur: 10, color: 0x60e060 },
      ] },
    ],
  },

  berserker: {
    name: 'Berserker', icon: '🪓', role: 'Melee',
    desc: 'A frothing northland axe-fighter who grows stronger the more blood is spilled, their own included.',
    weapon: 'greataxe', second: 'sword', armor: 'medium', gear: ['chest', 'legs', 'feet'],
    attrs: { str: 5, con: 2, int: -1 }, color: 0x8a1a1a, mana: 0.6,
    trees: [
      { id: 'ber_rage', name: 'Rage', icon: '😡', desc: 'Let the red mist in.', nodes: [
        { id: 'ber_enrage', tier: 0, type: 'active', name: 'Enrage', icon: '💢', desc: 'Fly into a rage, hitting much harder.', kind: 'buff', cost: 10, cd: 18, dur: 10, buff: { dmg: 0.25 }, color: 0xff2020 },
        { id: 'ber_fury', tier: 1, type: 'passive', name: 'Unbridled Fury', icon: '🔥', max: 3, desc: '+5% heavy attack damage and +2% all damage per rank', mods: { heavyDmg: 0.05, dmg: 0.02 } },
        { id: 'ber_battlecry', tier: 2, type: 'active', name: 'Bloodcurdling Howl', icon: '🐺', desc: 'A terrifying howl stuns the foes before you.', kind: 'stun', cost: 15, cd: 16, dmg: 0.8, range: 6, arc: 140, stun: 2 },
        { id: 'ber_unstoppable', tier: 3, type: 'passive', name: 'Unstoppable', icon: '🦏', max: 3, desc: '+3% damage reduction and +5% stamina regen per rank', mods: { dr: 0.03, stamRegen: 0.05 } },
        { id: 'ber_berserk', tier: 4, type: 'active', name: 'Berserk', icon: '👺', desc: 'Lose yourself completely: enormous damage and speed.', kind: 'buff', cost: 25, cd: 60, dur: 12, buff: { dmg: 0.4, atkSpeed: 0.3, lifesteal: 10 }, color: 0xff0000 },
      ] },
      { id: 'ber_frenzy', name: 'Frenzy', icon: '⚡', desc: 'Relentless assault.', nodes: [
        { id: 'ber_chop', tier: 0, type: 'active', name: 'Rending Chop', icon: '🪓', desc: 'A wild chop that leaves a gaping wound.', kind: 'strike', cost: 10, cd: 6, dmg: 2.0, range: 4, bleed: 1.0 },
        { id: 'ber_reckless', tier: 1, type: 'passive', name: 'Reckless Swings', icon: '🌪️', max: 3, desc: '+5% attack speed and +2% crit chance per rank', mods: { atkSpeed: 0.05, crit: 2 } },
        { id: 'ber_rush', tier: 2, type: 'active', name: 'Frenzied Rush', icon: '🏃', desc: 'Charge forward, knocking enemies aside.', kind: 'dash', cost: 14, cd: 10, dmg: 1.5, dist: 10, knock: 4 },
        { id: 'ber_cleaver', tier: 3, type: 'passive', name: 'Cleaver', icon: '🔪', max: 3, desc: '+8% crit damage and +3% cooldown reduction per rank', mods: { critDmg: 0.08, cdr: 0.03 } },
        { id: 'ber_skullsplit', tier: 4, type: 'active', name: 'Skullsplitter Leap', icon: '💀', desc: 'Leap high and bring the axe down on everything below.', kind: 'leap', cost: 25, cd: 35, dmg: 3.2, radius: 5, range: 16 },
      ] },
      { id: 'ber_bloodlust', name: 'Bloodlust', icon: '🩸', desc: 'Feed on carnage.', nodes: [
        { id: 'ber_feast', tier: 0, type: 'active', name: 'Blood Feast', icon: '🍖', desc: 'Rip life from the foes around you.', kind: 'drain', cost: 12, cd: 10, dmg: 1.0, radius: 5, heal: 0.5, color: 0xa01010 },
        { id: 'ber_thirst', tier: 1, type: 'passive', name: 'Bloodthirst', icon: '🧛', max: 3, desc: '+2% lifesteal per rank', mods: { lifesteal: 2 } },
        { id: 'ber_scar', tier: 2, type: 'active', name: 'Battle Scars', icon: '🩹', desc: 'Grit your teeth and shrug off wounds.', kind: 'heal', cost: 12, cd: 18, heal: 0.25, color: 0xff6060 },
        { id: 'ber_trophy', tier: 3, type: 'passive', name: 'Trophy Taker', icon: '🏆', max: 3, desc: 'Heal 3% max health on kill and +3% max health per rank', mods: { killHeal: 0.03, maxHpPct: 0.03 } },
        { id: 'ber_carnage', tier: 4, type: 'active', name: 'Carnage', icon: '🌋', desc: 'A whirling storm of axe and blood that drains everything around you.', kind: 'drain', cost: 30, cd: 45, dmg: 2.6, radius: 7, heal: 0.8, color: 0xd00000 },
      ] },
    ],
  },
};

export const CLASS_LIST = [
  'warrior', 'cleric', 'paladin', 'ranger', 'shadowknight', 'druid', 'monk', 'bard',
  'rogue', 'shaman', 'necromancer', 'wizard', 'magician', 'enchanter', 'beastlord', 'berserker',
];
