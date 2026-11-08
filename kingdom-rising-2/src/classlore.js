// Who each class is: a title, a line they live by, where they come from, and how they fight (the campaign on Kelda).
// Each class also has an `arena` entry (added at the bottom of this file): who it is in the Kingdom Arena, the Ashen Trials
// fought in the Ruins of Aldermere. The world behind both is written up in docs/LORE.md.
export const CLASS_STORY = {
  warrior: {
    title: 'The Shield of the Line',
    motto: 'Stand. Hold. Do not let them pass.',
    story: 'Warriors are the soldiers who stayed when everyone else ran. They learn their trade in shield walls and on harbour walls, and they carry the scars of every one of them. In Saltmere they still tell of the six warriors who held the north gate for a whole night while the goblins came over the walls.',
    fight: 'You fight up close and you fight to last. A shield blocks what would kill a lesser fighter, and a perfect block staggers the enemy for your counter. Charge into a pack, bash the leader senseless, plant a banner and dare them to come at you. You are the one the others stand behind.',
  },
  berserker: {
    title: 'The Storm That Walks',
    motto: 'Pain is only the drum. Listen to the rhythm.',
    story: 'Berserkers come from the cold clans who sail in longships and fight bare-chested in the snow. They learn to let a red fury take them in battle, a fury that ignores wounds and fear alike. Most die young. The ones who do not are terrifying.',
    fight: 'Big two-handed weapons and wide, brutal swings. You leap into the middle of a fight, roar to break their nerve and spin through everything around you. The angrier you get, the harder you hit, and some of your rages let you shrug off blows that should have dropped you. Defence is for other people.',
  },
  ranger: {
    title: 'The Watcher in the Green',
    motto: 'See them first. Hear them first. End it first.',
    story: 'Rangers guard the wild places between towns: the roads, the river fords and the edges of the jungle. They live for weeks in the trees, reading tracks the way scholars read books. Scout Kael of the Tanglewood is one of them, and he has not slept under a roof in years.',
    fight: 'You win fights before they start. Hold to draw your bow for a deadly, straight shot and aim for the head. Set traps on the trail, send a spirit hawk ahead of you, and when something gets too close, tumble away and keep shooting. Patience is your sharpest arrow.',
  },
  wizard: {
    title: 'The Keeper of Fire and Frost',
    motto: 'Knowledge is the only power that grows when it is spent.',
    story: 'Wizards spend their youth in dusty towers, learning the words that bend the world. Fire, frost and raw arcane force answer them, but only after years of study and more than a few singed eyebrows. Most of the old towers are ruins now. The wizards who are left are the ones who survived their own experiments.',
    fight: 'You are the artillery. Freeze a charging enemy in place, blink away, then drown the battlefield in fire and lightning. Your staff pours out its element while you hold the button, and your great spells hit harder than anything else on the island. You are fragile, so make sure nothing ever reaches you.',
  },
  musketeer: {
    title: 'The Thunder at Range',
    motto: 'Powder dry, aim true, one shot.',
    story: 'Musketeers were the pride of the old harbour guard: long coats, polished buttons and guns that sound like the sky splitting open. Black powder is scarce on Kelda now, ever since the goblins started hoarding it in kegs around their fires. A musketeer who has powder is worth ten who do not.',
    fight: 'Every shot is slow and every shot is devastating. Hold to aim down the barrel, wait for the moment, and squeeze. When they rush you, blast them with your belt pistol, throw a powder keg and smoke yourself out of sight. Reload, step back, aim again.',
  },
  shaman: {
    title: 'The Voice of the Spirits',
    motto: 'The earth remembers. The storm forgives nothing.',
    story: 'Shamans speak with the spirits of wind, stone and beast, and the spirits sometimes answer. They were the healers and storm-callers of the old island tribes long before Saltmere had walls. A shaman walks with a spirit wolf at heel, and nobody is quite sure which of them is leading.',
    fight: 'A spear in one hand and the old powers in the other. You heal your friends with waves of water, shock and hex your enemies, plant totems to strengthen everyone near you, and call down the storm when it matters most. You are the glue that holds a fight together.',
  },
  cleric: {
    title: 'The Light in the Dark',
    motto: 'No one falls while I still stand.',
    story: 'Clerics serve the Light: the old faith of the lighthouse keepers, who kept a fire burning through every storm so ships could find their way home. They carry that fire into battle as healing and holy wrath. A cleric at your side means you might actually walk home tonight.',
    fight: 'You are the healer. Mend wounds, bless your allies with endurance and shields, and pour light into the ground to burn anything evil that stands on it. When something threatens your people, a mace and holy judgement work just fine.',
  },
  paladin: {
    title: 'The Sworn Blade',
    motto: 'My oath is my armour. My faith is my sword.',
    story: 'Paladins are knights who swore an oath to the Light and meant it. They are warriors first, but the Light rides with them: a paladin can lay hands on a dying friend and pull them back from the edge. Every paladin carries one burden: an oath broken is power lost.',
    fight: 'Heavy armour, a sword and a shield, and holy fire to back them. You charge into the fray, smite the strongest enemy, raise auras that protect everyone near you and heal in a pinch. You are not the best healer or the best fighter, but you are both.',
  },
  darkknight: {
    title: 'The Knight of the Dusk',
    motto: 'I made a bargain with the dark. The dark is still paying.',
    story: 'Shadow Knights were paladins once, or wanted to be. Somewhere along the way they found that the dark gives power more freely than the Light ever did. They walk in black plate, feed on the life of their enemies and raise the fallen to fight beside them. They are feared everywhere, and they like it that way.',
    fight: 'A great two-handed blade and a cloak of shadow. You drain life with every spell, grip enemies and drag them close, curse them with plague and fill them with dread. You cannot truly heal, but you take back a little of every wound you deal.',
  },
  druid: {
    title: 'The Heart of the Wild',
    motto: 'Every root, every leaf, every claw: all one.',
    story: 'Druids are the guardians of growing things. They keep the old groves on Kelda, and they have watched in grief as the goblins burned the high forests. A druid can make a sapling grow in seconds, call a great bear to their side or turn the sky against their enemies.',
    fight: 'A healer who is also a storm. You mend wounds with growing vines, wrap enemies in roots, summon a bear to fight for you and call hurricanes and starfall down on whole packs. Keep your friends alive, and let the wild do the killing.',
  },
  monk: {
    title: 'The Open Hand',
    motto: 'The body is the weapon. Discipline is the edge.',
    story: 'Monks train for years in mountain monasteries until their hands, feet and breath move as one. They need no sword: a monk\'s fists can crack stone. Before the goblins came, there was a monastery near the top of Kelda. Its bells have been silent for twenty years.',
    fight: 'Fast and relentless with bare fists. Fly in with a kick, sweep their legs, strike their pressure points to stun them and unleash a hundred blows in a blur. When things go wrong, harden your body like iron or play dead until the danger passes.',
  },
  bard: {
    title: 'The Song That Wins Wars',
    motto: 'A good song is worth a hundred swords. A great one is worth an army.',
    story: 'Bards are wandering musicians, storytellers and swordsmen in equal measure. Their songs carry real magic: a war song makes soldiers braver, a fire song sets their blades burning and a lullaby puts monsters to sleep. Every tavern on the island loves a bard. Every goblin hates one.',
    fight: 'Your songs play on their own while they are on your hotbar, filling everyone near you with courage, speed, regeneration or burning blades. Meanwhile you fight with a quick blade, lull enemies to sleep and finish the fight with a crescendo that shatters them.',
  },
  rogue: {
    title: 'The Knife in the Dark',
    motto: 'You never see me. That is the point.',
    story: 'Rogues learn their trade in back alleys, smugglers\' coves and thieves\' guilds. They are spies, poisoners and assassins, and they are very, very good at not being caught. Saltmere\'s harbourmaster pretends rogues do not exist. Saltmere\'s harbourmaster employs several.',
    fight: 'Daggers, poison and shadows. Vanish from sight, slip behind your target and backstab them for enormous damage. Lay poison and frost traps, throw smoke to escape, kidney-shot a dangerous foe into helplessness and coat your blades in venom. Fight fair? Why would you?',
  },
  necromancer: {
    title: 'The Lord of Bones',
    motto: 'Death is not an ending. It is a resource.',
    story: 'Necromancers study the one thing everyone fears: death itself. Most people think they are evil. Most necromancers think everyone else is squeamish. They raise skeletons to fight for them, drink the life of their enemies and curse them with rot and plague.',
    fight: 'You never fight alone. Raise a skeleton warrior to hold the line and a skeleton mage to blast from behind it, while you curse, drain and plague everything in sight. Your drains heal you well, so you can stand in the fight longer than any other caster.',
  },
  elementalist: {
    title: 'The Binder of Storms',
    motto: 'Fire, earth, air and water. All of them obey.',
    story: 'Elementalists do not just cast fire and stone: they bind living elementals and command them as servants. It is dangerous work. An elemental that slips its binding does not forgive. The best elementalists are calm, careful people. The rest are scorch marks.',
    fight: 'Summon a fire elemental to burn your enemies and an earth elemental to stand between you and harm. Then throw boulders, lava and lightning, wrap foes in ice and end the fight with a firestorm or a cataclysm. Your servants fight while you build up to the big spells.',
  },
  enchanter: {
    title: 'The Mind Unbound',
    motto: 'Why fight the beast when you can simply make it forget?',
    story: 'Enchanters are masters of the mind. They are the quietest and the most dangerous of all mages, because they do not just hurt their enemies: they confuse them, put them to sleep, send them wandering off and make them see things that are not there. Kings hire enchanters. Kings also fear them.',
    fight: 'Control the battle. Mesmerise the most dangerous enemy, put a whole group to sleep, confuse the rest and blast their minds. Haste your friends, shield yourself with runes and send a phantom copy of yourself to fight. The best fight is the one where the enemy never lands a blow.',
  },
  beastmaster: {
    title: 'The Pack Leader',
    motto: 'Alone, I am a hunter. With them, I am the hunt.',
    story: 'Beastmasters grow up among the animals of the wild: they run with wolves, wrestle tigers and sleep among bears. On Kelda the old beastmaster families have the hardest job of all, because the goblins have driven the beasts mad with fear. A beastmaster is the only one who can calm them.',
    fight: 'You fight side by side with a war tiger, and later call a whole pack of wolves to your aid. Your hand axes rend and bleed, you pounce on fleeing prey and roar to stun the pack, and when you bond with your beasts, all of you fight harder together.',
  },
  blunderbuss: {
    title: 'The Walking Powder Keg',
    motto: 'Closer. Closer. There.',
    story: 'Blunderbusses are goblin bruisers who never learned to aim and never needed to. They carry a bell-mouthed gun stuffed with nails, glass and whatever else was on the floor, and a keg of powder on their backs that everyone else keeps well away from. Gorgrak\'s camps keep a few for breaking down gates.',
    fight: 'Walk straight at them and pull the trigger. Every blast sprays a cone of shot that wrecks anything in front of you, a powder charge throws you into the thick of it and a butt stroke knocks the clever ones flat. You soak the hits so your friends do not have to.',
  },
  priest: {
    title: 'The Voice of the Dawn',
    motto: 'Every night ends. I am the proof.',
    story: 'Priests are the scholars of the Light: they keep the old hymns, the old prayers and the old candles burning. Where a cleric carries the Light into battle with a mace, a priest carries it as a word, and the word is enough. A priest at prayer is surrounded by a halo that turns arrows aside.',
    fight: 'You heal from range and you protect before the blow lands. Wrap allies in shields of light, crown them with a halo that mends everyone near, and bind dangerous enemies in chains of light until your friends can deal with them.',
  },
  bombardier: {
    title: 'The Sky Is Falling (On You)',
    motto: 'If it did not explode, you did not use enough.',
    story: 'Bombardiers are goblin sappers with more courage than sense and more powder than either. They strap rockets to their boots, stuff their pockets with bombs and dive into battle cackling. Most of them have lost an eyebrow. The best of them have lost both, and an ear.',
    fight: 'Lob bombs in high arcs over walls and cover, stick a charge to the enemy who thinks he is safe, and blast off on rocket boots when they come for you. Nobody hides from a bombardier for long.',
  },
};

// ---------------------------------------------------------------------------------------------
// The Kingdom Arena: the Ashen Trials in the Ruins of Aldermere (see docs/LORE.md)
// ---------------------------------------------------------------------------------------------
export const WORLD = {
  name: 'The Ashen Trials',
  place: 'The Ruins of Aldermere',
  text: [
    'Aldermere was the crown city of the Vale, built around the Heartwood, an alder older than any kingdom. For three hundred years the Concord of Nine Banners ruled it together: humans, elves, dwarves, orcs and every free people who signed the Concord.',
    'Thirty years ago Archmagister Velloran Corvane tried to forge the Heartwood\'s light into a crown and rule alone. The rite failed. In one night, the Night of Ash, emberlight burst from the tree and the city burned to its stones.',
    'The Heartwood still glows in the ruined plaza, and in its light the dead do not stay dead: whoever falls there wakes again at the edge of the ruins. No faction can hold Aldermere by war, so by the Accord of Ash they send champions instead. Whoever holds the ruins when the Trial ends holds the claim.',
  ],
};
// the factions who send champions to the Trials (col: a banner colour, sig: their sigil)
export const FACTIONS = {
  lantern: { name: 'The Lantern Order', sig: '✦', col: '#ffd86a', creed: 'Lay the dead of Aldermere to rest.', text: 'The faith of the Light, born in Aldermere\'s Cathedral of the Dawn, whose broken chapel still stands on the garden side of the ruins. They call the Heartwood\'s echo a cruelty and fight to end it.' },
  greenward: { name: 'The Greenward Circle', sig: '❦', col: '#8ee07a', creed: 'The tree was here first.', text: 'Druids, rangers, shamans and beast-callers who tended the Heartwood before there was a city around it. They want the ruins torn down and the tree left in peace.' },
  ashen: { name: 'The Ashen College', sig: '✷', col: '#8ec8ff', creed: 'Understand the light, or it will happen again.', text: 'What is left of Corvane\'s college of magic, blamed by everyone for the Night of Ash. Some of them want to atone. Some want to finish what he started.' },
  dusk: { name: 'The Dusk Covenant', sig: '☾', col: '#c08cff', creed: 'Death is a door. Aldermere left it open.', text: 'Necromancers, shadow knights and the knives who work for them. A place where death does not stick is the greatest prize in the world to them.' },
  banners: { name: 'The Free Banners', sig: '⚔', col: '#ff8a6a', creed: 'Steel for hire. Oaths for free.', text: 'Sellsword companies, northern clans and wandering orders, many of them descended from Aldermere\'s own fallen garrison. They fight for coin, for honour, and for the right to say the city is theirs.' },
  scrapjaw: { name: 'The Scrapjaw Crews', sig: '✹', col: '#d8e05a', creed: 'Finders keepers.', text: 'Goblin salvage crews who crept into the ruins after the fire and found the city\'s old powder vaults. They were never invited to sign the Accord. They came anyway.' },
};
// the roles shown on the hero select (the game itself sorts heroes into Tank, Healer and Damage; Flank is a kind of Damage)
export const ROLES = {
  Tank: { name: 'Tank', col: '#7ab8ff', text: 'Takes the hits and holds the ground.' },
  Damage: { name: 'Damage', col: '#ff7a5a', text: 'Brings the enemy down from range.' },
  Flank: { name: 'Flank', col: '#d898ff', text: 'Slips behind the lines and picks off the weak.' },
  Support: { name: 'Support', col: '#8ee07a', text: 'Keeps the team alive and in the fight.' },
};
// role: the hero select role; chips: what they are good at; diff: how hard to play well (1 to 3)
const ARENA = {
  warrior: { epithet: 'the Ash-Sworn', faction: 'banners', role: 'Tank', chips: ['Frontline', 'Shield', 'Stun'], diff: 1,
    quote: 'They burned the city. They will not burn the line.',
    story: 'On the Night of Ash, the garrison of Aldermere held the Old Gate while the city burned behind them, so that the refugees could reach the road. None of them came home. The warriors of the Free Banners swear their oath on the ash of that gate, and they carry its stone in their shields. In the Trials they do what the garrison did: stand in front, and do not move.' },
  berserker: { epithet: 'the Red Tide', faction: 'banners', role: 'Tank', chips: ['Brawler', 'Leap', 'Fear'], diff: 1,
    quote: 'Let it hurt. It only makes me louder.',
    story: 'The orc clans of the Frostmark signed the Concord with an axe on the table, and Aldermere was the only city that ever kept its word to them. When it fell, the clans swore a blood-debt to whoever had set the fire. Their berserkers still come south every Trial to collect it, one skull at a time. Nobody has had the nerve to tell them Corvane is probably dead.' },
  paladin: { epithet: 'the Dawnshield', faction: 'lantern', role: 'Tank', chips: ['Frontline', 'Self-heal', 'Aura'], diff: 2,
    quote: 'The Light does not flinch. Neither do I.',
    story: 'The paladins of the Lantern Order were Aldermere\'s cathedral guard, and they failed it: they were at prayer when Corvane began his rite. Every paladin since has carried that failure like a second suit of armour. They fight in the Trials to win back the ruins and bless the Heartwood into silence, so that the dead of Aldermere can finally rest.' },
  darkknight: { epithet: 'the Unburied', faction: 'dusk', role: 'Tank', chips: ['Drain', 'Pull', 'Minions'], diff: 2,
    quote: 'I died here once. I liked it.',
    story: 'Shadow Knights are paladins who fell in the Trials, woke in the Heartwood\'s light and came back wrong. Something followed them out of death, and it whispers that the next fall will hurt less. The Dusk Covenant welcomes them in black plate and teaches them to drink the life of those they cut down. They fear nothing in Aldermere, because Aldermere has already killed them.' },
  blunderbuss: { epithet: 'the Gatebreaker', faction: 'scrapjaw', role: 'Tank', chips: ['Close range', 'Burst', 'Knockback'], diff: 1,
    quote: 'Knock knock.',
    story: 'Snagtooth was the first goblin to find Aldermere\'s powder vaults, and he celebrated by blowing a hole in the wall to get in. The Scrapjaw Crews have honoured that tradition ever since. Their blunderbusses are squat, tusked bruisers with scrap-iron plates and a keg on their back, and they solve every problem in the ruins the same way: by walking up to it and pulling the trigger.' },
  ranger: { epithet: 'the Greenwatch', faction: 'greenward', role: 'Damage', chips: ['Long range', 'Headshots', 'Root'], diff: 2,
    quote: 'I have been watching you since you crossed the rampart.',
    story: 'The wood elves planted the Heartwood\'s first grove long before men raised a wall around it, and the Greenwatch never stopped guarding it. When the city burned, rangers carried the children of Aldermere out through the gardens by the light of the burning tree. Now they hold the high rampart in every Trial, because the Circle wants the ruins pulled down and the tree left alone, and an arrow from the watchtower is a very persuasive argument.' },
  musketeer: { epithet: 'the Long Ear', faction: 'scrapjaw', role: 'Damage', chips: ['Sniper', 'Burst', 'Snare'], diff: 3,
    quote: 'Hold still. This won\'t hurt. Much.',
    story: 'Long Ears are the Scrapjaw\'s sharpshooters: lanky goblins with telescopes screwed into their eye sockets and muskets twice their height, made from the barrels of Aldermere\'s old wall guns. They pack their rounds with powder from the city\'s own vaults, so every shot glows like the night the city burned. They are the only goblins the other factions are polite to.' },
  wizard: { epithet: 'the Last Lantern', faction: 'ashen', role: 'Damage', chips: ['Burst', 'Blink', 'Slow'], diff: 3,
    quote: 'Corvane was a genius. That is what frightens me.',
    story: 'Every wizard of the Ashen College is born into a debt they did not run up: their masters\' master burned Aldermere. Some carry it with shame, and fight in the Trials to prove the College can guard the Heartwood\'s light instead of stealing it. Others have read Corvane\'s notes and think he was very, very close. Nobody can tell which kind a wizard is until it is too late.' },
  necromancer: { epithet: 'the Gravecaller', faction: 'dusk', role: 'Damage', chips: ['Drain', 'Poison', 'Fear'], diff: 2,
    quote: 'Ten thousand died here. Not one of them has left.',
    story: 'To a necromancer, Aldermere is not a ruin. It is a library. Beneath the plaza lie the dead of the Night of Ash, and in the Heartwood\'s light they can still be reached, questioned and woken. The Dusk Covenant\'s gravecallers want the ruins for themselves, and they are patient: everyone who falls in the Trials makes their army a little larger.' },
  elementalist: { epithet: 'the Stormbound', faction: 'ashen', role: 'Damage', chips: ['Summons', 'Area', 'Freeze'], diff: 2,
    quote: 'Fire remembers this city. I only have to remind it.',
    story: 'When the Heartwood burst, the emberlight did not just burn Aldermere: it woke the fire, stone and storm that slept in its streets. High elf elementalists of the Ashen College hunt those wild elementals through the ruins and bind them into servants. They say a bound elemental is a lesson in humility. The ones that slip free say otherwise, and loudly.' },
  enchanter: { epithet: 'the Veilweaver', faction: 'ashen', role: 'Damage', chips: ['Control', 'Mesmerise', 'Illusion'], diff: 3,
    quote: 'You are not losing. You only think you are. Wait. No. You are.',
    story: 'Enchanters were the Concord\'s diplomats, and the reason three hundred years of treaties held: no ambassador ever quite remembered why they had been angry. On the Night of Ash, the College\'s enchanters were the only ones who saw Corvane\'s mind clearly, and the only ones who said nothing. In the Trials they fight to make sure that silence is never mentioned.' },
  bombardier: { epithet: 'the Skyburner', faction: 'scrapjaw', role: 'Damage', chips: ['Area', 'Mobility', 'Splash'], diff: 2,
    quote: 'Duck! No, the other way!',
    story: 'Skyburners are Scrapjaw sappers who strapped rockets to their boots and discovered, quite by accident, that they could fly. Mostly. They rain bombs on the ruins from rooftop to rooftop, and they have flattened more of Aldermere in thirty years than the Night of Ash did in one. Every faction would ban them from the Trials if they could catch them.' },
  rogue: { epithet: 'the Ninth Knife', faction: 'dusk', role: 'Flank', chips: ['Stealth', 'Burst', 'Stun'], diff: 3,
    quote: 'Look behind you. No, really.',
    story: 'The Concord had nine banners and one secret: a tenth seat, never spoken of, held by the knives who kept the peace in the dark. When the city burned, the Ninth Knife went to the only people who would still pay for their work: the Dusk Covenant. They know every cellar, sewer and secret stair in Aldermere, because they dug most of them.' },
  monk: { epithet: 'the Still Bell', faction: 'banners', role: 'Flank', chips: ['Mobility', 'Combo', 'Stun'], diff: 3,
    quote: 'The bell is silent. My fists are not.',
    story: 'The monks of the Still Bell rang Aldermere\'s great bell every dawn for three centuries. On the Night of Ash it cracked, and its silence has been their vow ever since: they will not ring it again until the city is whole. They fight in the Trials bare-handed, because they believe a weapon is only a way to blame something else for what you do.' },
  beastmaster: { epithet: 'the Pack-Heart', faction: 'greenward', role: 'Flank', chips: ['Pets', 'Bleed', 'Dive'], diff: 2,
    quote: 'They smell your fear. So do I.',
    story: 'When the Heartwood burned, the beasts of the Vale went mad with its light, and the orc beast-callers of the Greenward were the only ones who could calm them. They ran with the maddened packs for years until the packs ran with them. Now a Pack-Heart walks into the Trials with a war tiger at heel and a dire wolf somewhere in the shadows, and the rest of the Vale has learned to give them a wide road.' },
  cleric: { epithet: 'the Hearthkeeper', faction: 'lantern', role: 'Support', chips: ['Healer', 'Area heal', 'Smite'], diff: 1,
    quote: 'Get up. I am not finished with you.',
    story: 'The dwarf clerics of the Lantern Order keep the Hearth: the one candle that was carried lit out of Aldermere\'s cathedral on the Night of Ash. Every cleric lights their first prayer from its flame. They heal with a warm, plain light that smells of forge-smoke, and they hit with a hammer blessed in the same fire. They have pulled more champions back from the edge than the Heartwood ever has.' },
  druid: { epithet: 'the Rootmother', faction: 'greenward', role: 'Support', chips: ['Healer', 'Root', 'Summon'], diff: 2,
    quote: 'Everything here grew from one seed. Even you.',
    story: 'Druids feel the Heartwood\'s pain the way others feel a burn on their own skin. The Rootmothers of the Greenward Circle believe the tree is still dying, slowly, every time the Trials wake the dead in its light. They fight to win the ruins and end the Trials forever, which is why they fight harder than anyone in them.' },
  shaman: { epithet: 'the Stormspeaker', faction: 'greenward', role: 'Support', chips: ['Healer', 'Totems', 'Hex'], diff: 2,
    quote: 'The spirits of this place are angry. Let me translate.',
    story: 'The orc shamans of the Greenward Circle hear the dead of Aldermere every time they walk its streets: thirty years of voices with nowhere to go. A Stormspeaker carries a spirit-doll with them that the dead can speak through, and a spirit wolf that they cannot. They heal their friends with spirit water and hex their enemies with the curses the dead whisper to them.' },
  bard: { epithet: 'the Last Verse', faction: 'banners', role: 'Support', chips: ['Songs', 'Speed', 'Mesmerise'], diff: 2,
    quote: 'Every Trial needs a song. I like to be in it.',
    story: 'The Minstrels\' Guild kept Aldermere\'s history in song, and the Night of Ash took most of its singers. The high elf bards who are left travel the Free Banners and sing the Lay of Aldermere at every Trial, adding one verse each time. They say that when the Lay is finished, the city will rise again. Nobody knows how many verses are left.' },
  priest: { epithet: 'the Dawncaller', faction: 'lantern', role: 'Support', chips: ['Healer', 'Shields', 'Bind'], diff: 1,
    quote: 'The night is long. The dawn is longer.',
    story: 'Dawncallers are the high priests of the Lantern Order, and they wear the sun on their backs: a disc of light that has burned behind every Dawncaller since the cathedral fell. They sing the Hymn of Ending over the Heartwood at the close of every Trial, hoping that one day it will listen. Until then, they keep their champions alive with shields of light and bind the Covenant\'s monsters in chains.' },
};
// everything about a class in the arena, with sensible blanks for a class not written up yet
export function arenaLore(cls) {
  const a = ARENA[cls] || {}, st = CLASS_STORY[cls] || {};
  return { epithet: a.epithet || st.title || '', faction: a.faction || 'banners', role: a.role || 'Damage', chips: a.chips || [], diff: a.diff || 2, quote: a.quote || st.motto || '', story: a.story || st.story || '' };
}
for (const c in ARENA) if (CLASS_STORY[c]) CLASS_STORY[c].arena = ARENA[c]; // (old fields stay as they were)
