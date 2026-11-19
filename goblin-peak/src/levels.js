// The story, the people, and the three stages of the mountain. Each stage is a list of trail sections, bottom to top.
import * as M from './models.js';

const path = (len, rise, o) => ({ t: 'path', len, rise, ...o });
const gap = (n, g, size, style, o) => ({ t: 'gap', n, g, size, style, len: 13.2 + n * size + (n + 1) * g, rise: 0, ...o });
const stairs = (n, g, size, step, o) => ({ t: 'gap', n, g, size, style: 'rising', len: 13.2 + n * size + (n + 1) * g, rise: (n + 1) * step, ...o });
const climb = (rise, o) => ({ t: 'climb', len: 12, rise, ...o });
const cliff = (rise, o) => ({ t: 'cliff', len: 12, rise, ...o });
const beam = (n, L, o) => ({ t: 'beam', n, L, len: 13.2 + n * L + (n - 1) * 3, rise: 0, ...o });
const swing = (n, o) => ({ t: 'swing', n, len: 13.2 + 10.5 + (n - 1) * 11, rise: 0, ...o });
const crawl = o => ({ t: 'crawl', len: 16, rise: 0, ...o });
const chasm = (span, o) => ({ t: 'chasm', len: 13.2 + span, rise: 0, ...o });
const glide = (span, o) => ({ t: 'glide', len: 21.2 + span, rise: 0, depth: 12, ...o });
const camp = o => ({ t: 'camp', len: 28, rise: 0, w: 8, ...o });
const ramp = (len, rise, o) => ({ t: 'ramp', len, rise, w: 6, ...o });
const traps = (kind, n, o) => ({ t: 'traps', kind, n, len: 12 + n * 7, rise: 1, coins: 0, ...o });

const hilda = () => M.biped({ shirt: 0x9aa0aa, pants: 0x5a5f6a, hair: 0xb5332a, helm: 0x9aa0aa, cape: 0x3b6fb5 });
const nib = () => M.goblin({ hat: 0xe2b33a, shirt: 0x3b6fb5 });
const say = (who, ...texts) => texts.map(text => ({ who, text }));
const H = 'Dame Hilda', N = 'Nib', C = 'Chieftain Grizzlegut', PR = 'Princess Wrenna', LETTER = 'A letter, folded into a paper bird';
const shopKeeper = lines => ({ name: N, model: nib, stall: 1, lines, after: g => g.ui.shop() });

export const ITEMS = {
  whip: { name: 'The Old Bullwhip', text: 'LEFT CLICK cracks it at goblins. Look at a GOLDEN RING and LEFT CLICK to swing from it; SPACE lets go.' },
  boots: { name: 'Spring-Heeled Boots', text: 'You can now TRIPLE JUMP. Press SPACE a third time in the air for the biggest jump of all.' },
  hook: { name: 'The Grappling Hook', text: 'Look at a BLUE RING and RIGHT CLICK (or Q). The hook pulls you straight to it.' },
  glider: { name: 'The Leaf Glider', text: 'HOLD SPACE while falling to glide. White columns of rising air will carry you higher.' },
  cannon: { name: 'The Grapple Hand Cannon', text: 'RIGHT CLICK (or Q) now fires a hook at ANYTHING you can see, twice as far: cliffs, walls, pillars. It also bonks goblins it lands near.' },
};
export const SHOP = [
  { id: 'spring', name: 'Springier Soles', text: 'Every jump goes a little higher.', cost: [40, 90, 160] },
  { id: 'whip', name: 'Longer Lash', text: 'The whip reaches further, for rings and goblins.', cost: [50, 110] },
  { id: 'magnet', name: 'Lucky Lodestone', text: 'Coins fly to you from further away.', cost: [35, 80] },
  { id: 'silk', name: 'Spider-silk Sail', text: 'The glider falls more slowly.', cost: [70, 140], needs: 'glider' },
  { id: 'purse', name: 'Buttoned Purse', text: 'You drop fewer coins when something knocks you about.', cost: [60] },
];

export const HUB_STORY = {
  barnaby: g => g.save.won ? say('Old Barnaby', 'You did it! The Princess is back, the goblins are sulking, and the Chieftain is still rolling, last I heard.', 'The mountain is yours to wander now. There are still jewels up there, I reckon.')
    : !g.save.done.l1 ? say('Old Barnaby', 'There you are! Terrible news. Chieftain Grizzlegut has carried Princess Wrenna to the very top of Goblin Peak.', 'Three trails, one after the other: Greenfoot Slopes to the west, then Thunder Gorge, then the Frostfang Stair.', 'You cannot die up there, the mountain is too stubborn for that. But if you fall, you fall. And then you walk back up.', 'Light every campfire you find. Each one drops a rope net down the cliff, so the walk back is shorter.', 'Press M for the map. Now go on. West gate. She is probably furious.')
      : !g.save.done.l2 ? say('Old Barnaby', 'Greenfoot is behind you! The north gate is open: Thunder Gorge. Mind the river. It does not stop to chat.')
        : say('Old Barnaby', 'Only the Frostfang Stair is left, through the east gate. Wrap up warm. And bring that girl home.'),
  nib: g => say(N, g.save.seen.nib ? 'Back again! Coins for goods, goods for coins. No refunds, no biting.' : 'Psst. Yes, I am a goblin. A FREELANCE goblin. The Chieftain pays in turnips.', ...(g.save.seen.nib ? [] : ['You bring gold coins, I sell you things that make falling off mountains less likely. Everybody wins. Except the Chieftain.'])),
  hildaHub: g => g.save.won ? say(H, 'I would like it noted that I was nearly at the top when you finished.') : say(H, 'Dame Hilda, knight of the realm. I set out to rescue the Princess this morning.', 'I got quite high. Then a goblin sneezed on me and I fell all the way back here.', 'I shall try again shortly. You go ahead. I will catch up. Probably.'),
  pip: g => say('Pip', ['Did you know you can jump on a goblin\'s head? They go POOF.', 'My dad says if you tap C while you are running fast you do a big slide. I do it down the hill all day.', 'There are pink jewels hidden on the mountain. Three on every trail. I counted. From down here. With my eyes shut.', 'Press V and you can see yourself from behind! I like your cape.'][Math.floor(g.time / 7) % 4]),
};

const L1 = [
  path(44, 2, { name: 'Greenfoot Trailhead', npcs: [{ name: H, model: hilda, a: 14, lines: say(H, 'Oh good, it is you. I am just catching my breath. For the third time.', 'The trail winds round and round the mountain. Fall off the edge and you land on the loop below. Ask me how I know.', 'SHIFT to sprint, SPACE to jump, SPACE again in the air to jump again. Off you go!') }], tip: 'WASD to move, mouse to look, SHIFT to sprint. SPACE jumps, and SPACE again in the air is a double jump.' }),
  gap(3, 2.6, 3.2, 'stone', { tip: 'Mind the gap. If you fall in, the near wall is covered in vines: walk into them and hold W to climb out.' }),
  path(38, 3, { mobs: [['grunt', 0.65]], tip: 'A goblin! Jump on its head to bonk it. Goblins cannot hurt you, but they will happily shove you off the mountain.' }),
  climb(7, { tip: 'Vines. Walk into them and hold W to climb. SPACE springs you off the wall.' }),
  path(34, 2, { chest: 'whip', bark: [C, '(a horn blares from far above) OI! HERO! THE PRINCESS IS MINE. TURN ROUND, OR I WILL... ROLL THINGS AT YOU. BIG ROUND THINGS.'] }),
  swing(2, { tip: 'Look at a golden ring and LEFT CLICK to whip it and swing. LEFT CLICK the next ring mid-swing, or SPACE to let go.' }),
  path(30, 2, { mobs: [['grunt', 0.4], ['grunt', 0.75]], tip: 'LEFT CLICK with no ring in sight cracks the whip. Goblins hate that.' }),
  beam(1, 12, { tip: 'A log bridge. Go steady. When you start to tip, press A or D to lean back the other way.' }),
  camp({ name: 'Mossy Rest', npcs: [shopKeeper(g => say(N, 'Nib\'s Travelling Emporium! I got up here by the goblin lift. No, you cannot use it. Union rules.'))] }),
  ramp(54, 9, { tip: 'Boulders! Step aside, or jump clean over them.', bark: [C, 'ROLL THE ROCKS! NO, NOT AT ME, GRUBB. DOWN. DOWNHILL. THE OTHER DOWN.'] }),
  crawl({ tip: 'Hold C to crouch and crawl through. Tap C while sprinting to slide.' }),
  gap(4, 3.4, 2.4, 'pillar', { zig: 0.8, jewel: { a: 16, lat: 0 } }),
  path(42, 3, { mobs: [['boar', 0.5]], bark: [LETTER, 'Dear Hero. The food up here is turnips. Every meal. Please hurry. Yours impatiently, Princess Wrenna.'] }),
  traps('spikes', 3, { tip: 'Spikes pop up in a rhythm. Wait for them to drop, then go.' }),
  path(36, 3, { mobs: [['slinger', 0.7, -3]], rollers: 1 }),
  climb(10),
  gap(3, 3, 3, 'moving'),
  path(34, 2, { chest: 'boots', npcs: [{ name: H, model: hilda, a: 8, lines: say(H, 'You again! I took a shortcut. It was not shorter.', 'There is a chest just there. I could not open it. It is stuck. Or locked. Or I was pulling the hinge side.') }] }),
  stairs(4, 3.4, 2.6, 2.3, { tip: 'Tall steps. A triple jump makes short work of them.' }),
  camp({ name: 'Halfway Stump', npcs: [shopKeeper(g => say(N, 'Halfway! Technically. Vertically. Do not think about the spiral.'))] }),
  ramp(58, 10, { mobs: [['grunt', 0.3]], every: 3.2 }),
  beam(2, 10),
  swing(3, { jewel: { a: 22, lat: 6.5, up: 7, abs: 1, plat: 1 } }),
  path(40, 3, { mobs: [['boar', 0.4], ['slinger', 0.8, -3]], bark: [C, 'WHO LEFT ALL THESE VINES EVERYWHERE? THE HERO KEEPS CLIMBING THEM! ...WHAT DO YOU MEAN, "THEY GROW THERE"?'] }),
  traps('logs', 3, { tip: 'Swinging logs. Run through just after one passes.' }),
  gap(4, 3.2, 2.2, 'crumble', { tip: 'These planks do not last. Keep moving.' }),
  climb(12),
  path(44, 3, { rollers: 2, mobs: [['grunt', 0.5], ['grunt', 0.75]], jewel: { a: 22, lat: 14, up: 3.5, abs: 1, plat: 1, steps: 2 } }),
  traps('darts', 4),
  gap(3, 6, 2.6, 'bounce', { tip: 'Bouncy mushrooms! Drop onto one and it flings you up.' }),
  camp({ name: 'Last Green Ledge', npcs: [shopKeeper(g => say(N, 'Nearly at the top of the green bit. After this it gets rocky. Then it gets cold. I sell neither coats nor rocks.'))] }),
  crawl(),
  ramp(60, 10, { every: 2.8, mobs: [['boar', 0.25]] }),
  gap(5, 3.6, 2.4, 'pillar'),
  path(30, 2, { mobs: [['brute', 0.5]], bark: [C, 'HE IS AT THE GATE ALREADY? WHO IS GUARDING THE GATE? ...KEVIN? WE HAVE A KEVIN?'] }),
  { t: 'goal', len: 30, rise: 0, w: 8 },
];

const L2 = [
  path(40, 2, { name: 'Thunder Gorge', chest: 'hook', npcs: [{ name: H, model: hilda, a: 30, lines: say(H, 'Welcome to Thunder Gorge. It is called that because of the noise I made falling into it.', 'The river here runs straight down the mountain. Fall in and it carries you all the way to the lake at the bottom.', 'If that happens, swim for the bank where the water slows. Or enjoy the ride.') }] }),
  cliff(11, { tip: 'Look at a blue ring and RIGHT CLICK (or Q). The hook hauls you up.' }),
  path(34, 2, { mobs: [['grunt', 0.5], ['slinger', 0.8, -3]] }),
  chasm(16, { tip: 'Blue rings work across gaps too.' }),
  gap(4, 3.6, 2.4, 'pillar', { mobs: [['bat', 0.5]], tip: 'Gloomwings swoop at anything in the air. A whip crack sorts them out.' }),
  path(36, 3, { geysers: 2, tip: 'Geysers! Stand on one when it blows for a free ride up.', bark: [C, 'WELCOME TO MY GORGE, HERO. I DUG IT MYSELF. WITH A SPOON. IT TOOK AGES.'] }),
  climb(9),
  beam(2, 11),
  camp({ name: 'Echo Ledge', npcs: [shopKeeper(g => say(N, 'Mind the echo. I said MIND THE ECHO. See? Terrible for business.'))] }),
  ramp(56, 9, { every: 3.2 }),
  swing(3),
  path(38, 3, { mobs: [['troll', 0.55]], tip: 'A rock troll. When it lifts its club, get ready to jump the shockwave.' }),
  cliff(14),
  traps('mix', 4),
  gap(4, 3.2, 3, 'moving', { mobs: [['bat', 0.4], ['bat', 0.7]] }),
  path(34, 2, { chest: 'glider', bark: [LETTER, 'Dear Hero. The Chieftain sings in the bath. He only knows one song and it is about himself. I can see you from the window. You are very small. Climb faster. W.'] }),
  glide(40, { tip: 'Climb the tower, jump, then HOLD SPACE to glide. Steer into the white columns of rising air.' }),
  path(30, 2, { mobs: [['boar', 0.5], ['slinger', 0.3, -3]], rollers: 2 }),
  crawl(),
  stairs(4, 3.6, 2.6, 2.6, { jewel: { a: 14, lat: 0 } }),
  camp({ name: 'Rumbling Shelf', npcs: [shopKeeper(g => say(N, 'I have a silk sail for that glider of yours. Spun by a very reasonable spider.')), { name: H, model: hilda, a: 20, lat: -5, lines: say(H, 'I rode the river down twice today. The second time on purpose. I am telling people it was on purpose.') }] }),
  chasm(20),
  ramp(60, 11, { every: 2.8, mobs: [['grunt', 0.35], ['grunt', 0.6]] }),
  gap(4, 3.4, 2.2, 'crumble', { mobs: [['bat', 0.5]] }),
  path(40, 3, { geysers: 3, mobs: [['troll', 0.6]], jewel: { a: 20, lat: 13, up: 9, abs: 1, plat: 1 } }),
  beam(3, 9),
  cliff(16),
  traps('logs', 4),
  glide(52, { bark: [C, 'HE HAS A GLIDER NOW? WHO KEEPS LEAVING TREASURE CHESTS ON MY MOUNTAIN? ...I DO? FOR "ATMOSPHERE"? HM.'] }),
  camp({ name: 'Cloudline Camp', npcs: [shopKeeper(g => say(N, 'Above here is the snow. I do not go above here. My ears get cold and they are sixty percent of me.'))] }),
  swing(4, { jewel: { a: 33, lat: 0 } }),
  path(36, 3, { mobs: [['brute', 0.4], ['brute', 0.7], ['slinger', 0.9, -3]], rollers: 2 }),
  gap(3, 6, 2.6, 'bounce'),
  traps('darts', 5),
  ramp(56, 10, { every: 2.6 }),
  chasm(21, { mobs: [['bat', 0.5]] }),
  path(28, 2, { mobs: [['troll', 0.5]], bark: [C, 'FINE. FINE! HAVE THE GORGE. I NEVER LIKED THE GORGE. THE SUMMIT IS MUCH NICER. AND ICIER. AND FULL OF YETIS.'] }),
  { t: 'goal', len: 30, rise: 0, w: 8 },
];

const L3 = [
  path(40, 2, { name: 'The Frostfang Stair', chest: 'cannon', npcs: [{ name: H, model: hilda, a: 30, lines: say(H, 'Brrr. This is as far as I have ever got. Mostly because of the ice.', 'Ice has no grip at all. Do not try to stop on it. Do not try to do anything on it.', 'There is a chest there with some kind of goblin contraption in it. Points at things. Goes BANG. You will love it.') }] }),
  cliff(22, { tip: 'The hand cannon reaches twice as far, and it will grab any surface: aim at the lip of a cliff and RIGHT CLICK.' }),
  path(38, 2, { ice: 1, mobs: [['ram', 0.6]], tip: 'Ice! You will slide. Start turning early.' }),
  gap(4, 3.6, 2.6, 'pillar', { mobs: [['bat', 0.5]] }),
  path(36, 3, { mobs: [['yeti', 0.75, -3]], tip: 'Yetis lob huge snowballs. Keep moving and they miss.', bark: [C, 'YOU AGAIN! DO YOU KNOW HOW MANY BOULDERS I HAVE GOT THROUGH? WE ARE DOWN TO THE SQUARE ONES.'] }),
  chasm(34, { tip: 'Too far to jump, too far for the old hook. Not too far for the cannon.' }),
  climb(12),
  traps('mix', 5),
  camp({ name: 'Frozen Toes Camp', npcs: [shopKeeper(g => say(N, 'I said I would not come up here. Then I remembered you have all the coins.'))] }),
  ramp(58, 10, { ice: 1, every: 3, tip: 'An icy ramp with boulders on it. The Chieftain is not playing fair.' }),
  swing(3, { mobs: [['bat', 0.4]] }),
  path(34, 2, { mobs: [['brute', 0.4], ['brute', 0.7]], rollers: 2 }),
  glide(56),
  crawl(),
  stairs(5, 3.6, 2.6, 2.7, { mobs: [['bat', 0.6]], jewel: { a: 17, lat: 0 } }),
  path(38, 3, { ice: 1, mobs: [['ram', 0.3], ['ram', 0.7]], bark: [LETTER, 'Dear Hero. I have nearly finished my tunnel. It is four inches long. I dug it with a spoon. Apparently that is how things are done here. Hurry up. W.'] }),
  beam(2, 12, { tip: 'An icy log would be cruel. This one is merely long.' }),
  cliff(26),
  camp({ name: 'Windy Gap', npcs: [shopKeeper(g => say(N, 'Last stop before the fortress. Spend it now. You cannot take it with you. Well, you can. But spend it.')), { name: H, model: hilda, a: 20, lat: -5, lines: say(H, 'I MADE IT. Higher than ever! I used the goblin lift. Nib says I owe him forty coins and a formal apology to the union.') }] }),
  gap(4, 3.4, 3, 'moving', { mobs: [['bat', 0.3], ['bat', 0.7]] }),
  ramp(60, 11, { every: 2.6, mobs: [['brute', 0.3]] }),
  chasm(44, { jewel: { a: 28, lat: 0 } }),
  path(36, 2, { ice: 1, mobs: [['yeti', 0.5, -3], ['ram', 0.8]], geysers: 2 }),
  traps('logs', 5),
  gap(4, 3.2, 2.2, 'crumble', { mobs: [['bat', 0.5]] }),
  glide(64, { bark: [C, 'STOP FLYING! IT IS NOT FAIR! GOBLINS DO NOT FLY! WE TRIED. ONCE. POOR GRUBB.'] }),
  climb(14),
  path(40, 3, { mobs: [['troll', 0.5], ['slinger', 0.85, -3]], rollers: 3, jewel: { a: 20, lat: 15, up: 5, abs: 1, plat: 1, steps: 2 } }),
  swing(4),
  camp({ name: 'The Fortress Door', npcs: [shopKeeper(g => say(N, 'This is it. He is right up there. Three gongs round his throne: he cannot STAND gongs. Ring them all and the big lump comes down to your level.', 'Then whip him. Tell him Nib says hello. Actually do not tell him that.'))] }),
  traps('mix', 6),
  cliff(30),
  ramp(56, 10, { every: 3, ice: 1 }),
  gap(3, 6, 2.6, 'bounce', { mobs: [['bat', 0.5]] }),
  stairs(4, 3.6, 2.6, 2.8),
  path(30, 2, { mobs: [['brute', 0.35], ['brute', 0.65]], bark: [C, 'RIGHT. THAT IS IT. COME UP HERE AND SAY THAT TO MY FACE. I AM ON A VERY TALL PILLAR.'] }),
  { t: 'arena', len: 30, rise: 0, w: 8 },
];

const BOSS = {
  intro: 'SO. THE HERO. YOU CLIMBED ALL THIS WAY TO BE FLATTENED IN PERSON. I AM TOUCHED. BOULDERS!',
  gong: ['AAARGH! NOT THE GONG! WHO PUT GONGS THERE? ...ME? FOR "ATMOSPHERE"?!', 'STOP THAT! MY EARS! THEY ARE SIXTY PERCENT OF ME!', 'NO NO NO NOT THE THIRD ONE... oh. Oh, the floor is very close now. Hello.'],
  fall: 'WAAAAAAGH! I WILL BE BACK! AS SOON AS I HAVE... WALKED... ALL THE WAY... BACK UP...',
  rescue: [...say(PR, 'FINALLY. Do you know how many turnips I have eaten? I counted. It was all of them.', 'You jumped, climbed, swung, glided and crawled up an entire mountain for me. That is the nicest thing anyone has ever done. Thank you, Hero.', 'Now. How do we get down?'), ...say('You', '...The same way we came up.'), ...say(PR, 'Wonderful. Is there a faster way?'), ...say('You', 'Well. There is the river.'), ...say(PR, 'I like you. Race you to the lake.')],
  after: say(PR, 'I am staying up here a while. The view is excellent now that it is not through bars.', 'Go and find the rest of those jewels. They are mine, by the way. The goblins scattered them.'),
};

export const LEVELS = {
  hub: { id: 'hub', name: 'Bramblewick', hub: true, theme: 'meadow', seed: 3, story: HUB_STORY },
  l1: { id: 'l1', name: 'Greenfoot Slopes', theme: 'forest', seed: 11, col: 0x3f8a3a, sections: L1, river: { th: 2.4, loops: 2, styles: ['stones', 'log'] }, blurb: 'Forest foothills. Vines, log bridges, and your first goblins.', goal: 'Reach the gate at the top of the slopes' },
  l2: { id: 'l2', name: 'Thunder Gorge', theme: 'gorge', seed: 23, col: 0xb5652a, sections: L2, river: { th: 4.1, loops: 3, styles: ['planks', 'swing', 'raft'] }, blurb: 'Red canyons and a river in a hurry. Bring something to hook onto.', goal: 'Cross the gorge and reach the high gate' },
  l3: { id: 'l3', name: 'The Frostfang Stair', theme: 'snow', seed: 37, col: 0x54a6d6, sections: L3, river: { th: 1.2, loops: 3, styles: ['hook', 'stones', 'log'] }, story: BOSS, blurb: 'Ice, yetis, and the Chieftain\'s fortress at the summit.', goal: 'Reach the summit, ring the three gongs and free the Princess' },
};
LEVELS.hub.levels = [LEVELS.l1, LEVELS.l2, LEVELS.l3];
export const ORDER = ['l1', 'l2', 'l3'];
