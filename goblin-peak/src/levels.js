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
const logs = (n, o) => ({ t: 'logs', n, len: 12 + n * 6, rise: 1, ...o });
const rockfall = (n, o) => ({ t: 'rockfall', n, len: 13 + n * 2.7, rise: 1, ...o });
const bridge = (span, o) => { const n = Math.floor(span / 1.8); return { t: 'gap', n, g: 0.25, size: 1.55, style: 'bridge', len: 13.2 + n * 1.55 + (n + 1) * 0.25, rise: 0, depth: 11, ...o }; };
const traverse = (span, o) => ({ t: 'traverse', len: 13.2 + span, rise: 0, depth: 12, ...o });
const zip = (span, o) => ({ t: 'zip', len: 13.2 + span, rise: 0, depth: 13, ...o });
const ambush = (foes, o) => ({ t: 'ambush', foes, len: 46, rise: 1, w: 7, ...o });
const chase = (len, o) => ({ t: 'chase', len, rise: -len * 0.1, w: 5.5, ...o });
const collapse = (span, o) => { const n = Math.floor(span / 1.95); return { t: 'gap', n, g: 0.15, size: 1.8, style: 'collapse', len: 13.2 + n * 1.8 + (n + 1) * 0.15, rise: 0, depth: 11, ...o }; };
const traps = (kind, n, o) => ({ t: 'traps', kind, n, len: 12 + n * 7, rise: 1, coins: 0, ...o });

const hilda = () => M.biped({ shirt: 0x9aa0aa, pants: 0x5a5f6a, hair: 0xb5332a, helm: 0x9aa0aa, cape: 0x3b6fb5 });
const nib = () => M.goblin({ hat: 0xe2b33a, shirt: 0x3b6fb5 });
const say = (who, ...texts) => texts.map(text => ({ who, text }));
const H = 'Dame Hilda', N = 'Nib', C = 'Chieftain Grizzlegut', PR = 'Princess Wrenna', LETTER = 'A letter, folded into a paper bird';
const shopKeeper = lines => ({ name: N, model: nib, stall: 1, lines, after: g => g.ui.shop() });

export const ITEMS = {
  whip: { name: 'The Old Bullwhip', text: 'LEFT CLICK cracks it at goblins. It wraps round anything a whip can grip: look at a BRANCH, a tree or a log and LEFT CLICK to swing from it; SPACE lets go.' },
  boots: { name: 'Spring-Heeled Boots', text: 'You can now TRIPLE JUMP. Press SPACE a third time in the air for the biggest jump of all.' },
  hook: { name: 'The Grappling Hook', text: 'RIGHT CLICK (or Q) throws it. It catches on rock, cliff edges, branches, logs and posts, and pulls you there. It will not hold in grass or snow.' },
  glider: { name: 'The Leaf Glider', text: 'HOLD SPACE while falling to glide. White columns of rising air will carry you higher.' },
  cannon: { name: 'The Grapple Hand Cannon', text: 'RIGHT CLICK (or Q) now fires a steel spike that sticks into ANYTHING you can see, twice as far, and hauls you to it. It also bonks goblins it lands near.' },
};
// Hidden relics: three on each trail. Each one unlocks a permanent upgrade that cannot be bought.
export const RELICS = {
  l1: [{ id: 'swift', name: 'Hare-Foot Anklet', text: 'You sprint faster.' }, { id: 'reach', name: 'Climber\'s Chalk', text: 'You can catch ledges from much further below.' }, { id: 'dash', name: 'Gale Feather', text: 'NEW MOVE: press X in mid-air to dash forward. Once per jump.' }],
  l2: [{ id: 'rope', name: 'Spider-Silk Line', text: 'Your hook, cannon and whip all reach further.' }, { id: 'hawk', name: 'Hawk Pinion', text: 'The glider flies faster and sinks more slowly.' }, { id: 'iron', name: 'Ironroot Charm', text: 'Shoves, boulders and blasts throw you a quarter less far.' }],
  l3: [{ id: 'thunder', name: 'Thunderclap Knot', text: 'Every whip crack now also bonks any goblin close around you.' }, { id: 'midas', name: 'Goblin Tax Ledger', text: 'Goblins drop twice as many coins.' }, { id: 'fourth', name: 'Cloudstep Boots', text: 'You gain one more jump in the air.' }],
};
export const SHOP = [
  { id: 'spring', name: 'Springier Soles', text: 'Every jump goes a little higher.', cost: [40, 90, 160] },
  { id: 'whip', name: 'Longer Lash', text: 'The whip reaches further, for branches and goblins.', cost: [50, 110] },
  { id: 'magnet', name: 'Lucky Lodestone', text: 'Coins fly to you from further away.', cost: [35, 80] },
  { id: 'silk', name: 'Spider-silk Sail', text: 'The glider falls more slowly.', cost: [70, 140], needs: 'glider' },
  { id: 'purse', name: 'Buttoned Purse', text: 'You drop fewer coins when something knocks you about.', cost: [60] },
  { id: 'hide', name: 'Padded Jerkin', text: 'Shoves, boulders and bombs throw you less far.', cost: [70, 140, 230] },
  { id: 'grip', name: 'Climbing Claws', text: 'Climb vines and walls much faster.', cost: [50, 110] },
  { id: 'heavy', name: 'Weighted Lash', text: 'The whip hits twice as hard.', cost: [160], needs: 'whip' },
  { id: 'cloak', name: 'Wind Cloak', text: 'Gusts no longer push you about.', cost: [120] },
  { id: 'bombs', name: 'Bag of Squibs (3)', text: 'Three throwing bombs. Press G to lob one: it flattens every goblin near where it lands, shields and all.', cost: [35], stock: 1 },
];

export const HUB_STORY = {
  barnaby: g => g.save.won ? say('Old Barnaby', 'You did it! The Princess is back, the goblins are sulking, and the Chieftain is still rolling, last I heard.', 'The mountain is yours to wander now. There are still relics hidden up there, I reckon: old things that teach you new tricks.')
    : !g.save.done.l1 ? say('Old Barnaby', 'There you are! Terrible news. Chieftain Grizzlegut has carried Princess Wrenna to the very top of Goblin Peak.', 'Three trails, one after the other: Greenfoot Slopes to the west, then Thunder Gorge, then the Frostfang Stair.', 'You cannot die up there, the mountain is too stubborn for that. But if you fall, you fall. And then you walk back up.', 'Light every campfire you find. Each one drops a rope net down the cliff, so the walk back is shorter.', 'Press M for the map. Now go on. West gate. She is probably furious.')
      : !g.save.done.l2 ? say('Old Barnaby', 'Greenfoot is behind you! The north gate is open: Thunder Gorge. Mind the river. It does not stop to chat.')
        : say('Old Barnaby', 'Only the Frostfang Stair is left, through the east gate. Wrap up warm. And bring that girl home.'),
  nib: g => say(N, g.save.seen.nib ? 'Back again! Coins for goods, goods for coins. No refunds, no biting.' : 'Psst. Yes, I am a goblin. A FREELANCE goblin. The Chieftain pays in turnips.', ...(g.save.seen.nib ? [] : ['You bring gold coins, I sell you things that make falling off mountains less likely. Everybody wins. Except the Chieftain.'])),
  hildaHub: g => g.save.won ? say(H, 'I would like it noted that I was nearly at the top when you finished.') : say(H, 'Dame Hilda, knight of the realm. I set out to rescue the Princess this morning.', 'I got quite high. Then a goblin sneezed on me and I fell all the way back here.', 'I shall try again shortly. You go ahead. I will catch up. Probably.'),
  pip: g => say('Pip', ['Did you know you can jump on a goblin\'s head? They go POOF.', 'My dad says if you tap C while you are running fast you do a big slide. I do it down the hill all day.', 'There are glowing relics hidden on the mountain. Three on every trail. Each one teaches you a trick you cannot buy. My dad found one and now he can jump over our house.', 'Press V and you can see yourself from behind! I like your cape.'][Math.floor(g.time / 7) % 4]),
};

const L1 = [
  path(44, 2, { name: 'Greenfoot Trailhead', npcs: [{ name: H, model: hilda, a: 14, lines: say(H, 'Oh good, it is you. I am just catching my breath. For the third time.', 'The trail winds round and round the mountain. Fall off the edge and you land on the loop below. Ask me how I know.', 'SHIFT to sprint, SPACE to jump, SPACE again in the air to jump again. Off you go!') }], tip: 'WASD to move, mouse to look, SHIFT to sprint. SPACE jumps, and SPACE again in the air is a double jump.' }),
  gap(3, 2.4, 3.6, 'stone', { tip: 'A ravine. Hop across the rock pinnacles. If you fall in, the near wall is hung with vines: walk into them and hold W to climb out.' }),
  path(34, 3, { mobs: [['grunt', 0.5], ['grunt', 0.8]], tip: 'Goblins! LEFT CLICK shoves them back, and jumping on their heads bonks them. They cannot hurt you, but they will happily shove you off the mountain.' }),
  climb(7, { tip: 'Vines. Walk into them and hold W to climb. SPACE springs you off the wall.' }),
  path(30, 2, { chest: 'whip', bark: [C, '(a horn blares from far above) OI! HERO! THE PRINCESS IS MINE. TURN ROUND, OR I WILL... ROLL THINGS AT YOU. BIG ROUND THINGS.'] }),
  swing(2, { tip: 'Look at a branch of the old tree over the ravine and LEFT CLICK: the whip wraps round it and you swing. LEFT CLICK the next branch mid-swing, or SPACE to let go.' }),
  ambush(['grunt', 'grunt', 'grunt'], { tip: 'LEFT CLICK near a goblin cracks the whip at it.' }),
  camp({ name: 'Mossy Rest', npcs: [shopKeeper(g => say(N, 'Nib\'s Travelling Emporium! I got up here by the goblin lift. No, you cannot use it. Union rules.'))] }),
  ramp(50, 9, { tip: 'Boulders! Step aside, or jump clean over them. Bonk the goblin at the top to stop them.', bark: [C, 'ROLL THE ROCKS! NO, NOT AT ME, GRUBB. DOWN. DOWNHILL. THE OTHER DOWN.'] }),
  logs(4, { tip: 'Fallen trees. Jump the low ones; crawl (hold C) or slide under the high ones.' }),
  traverse(14, { tip: 'No way across but the vines. Climb onto the wall on your left and work your way sideways (A and D, or look along the wall and hold W).' }),
  path(36, 3, { rain: 0.7, mobs: [['boar', 0.6]], tip: 'Falling rocks! Watch for the shadows on the ground and keep moving.', bark: [LETTER, 'Dear Hero. The food up here is turnips. Every meal. Please hurry. Yours impatiently, Princess Wrenna.'] }),
  traps('spikes', 3, { tip: 'Spikes pop up in a rhythm. Wait for them to drop, then go.' }),
  crawl({ tip: 'Hold C to crouch and crawl through. Tap C while sprinting to slide.' }),
  chase(70, { tip: 'This stretch runs downhill. That is never a good sign.' }),
  climb(11),
  bridge(17, { mobs: [['bat', 0.5]], tip: 'A goblin rope bridge. The dark planks are rotten: do not stand on them for long.' }),
  path(30, 2, { chest: 'boots', mobs: [['slinger', 0.8, -3]], npcs: [{ name: H, model: hilda, a: 8, lines: say(H, 'You again! I took a shortcut. It was not shorter.', 'There is a chest just there. I could not open it. It is stuck. Or locked. Or I was pulling the hinge side.') }] }),
  stairs(4, 3.4, 2.6, 2.3, { tip: 'Tall rock steps. A triple jump makes short work of them.' }),
  camp({ name: 'Halfway Stump', npcs: [shopKeeper(g => say(N, 'Halfway! Technically. Vertically. Do not think about the spiral.'))] }),
  zip(34, { tip: 'A goblin zip line. Press E at the post and hold on.' }),
  ramp(54, 10, { mobs: [['grunt', 0.3], ['grunt', 0.55]], every: 3, rain: 1.2 }),
  rockfall(4, { tip: 'A rockslide. Scramble over it: jump at a rock just below its top and you will pull yourself up.' }),
  swing(3, { mobs: [['bat', 0.5]], jewel: { a: 22, lat: 6.5, up: 7, abs: 1, plat: 1 } }),
  ambush(['grunt', 'slinger', 'brute', 'grunt'], { bark: [C, 'WHO LEFT ALL THESE VINES EVERYWHERE? THE HERO KEEPS CLIMBING THEM! ...WHAT DO YOU MEAN, "THEY GROW THERE"?'] }),
  traps('logs', 3, { tip: 'Swinging logs. Run through just after one passes.' }),
  collapse(18, { tip: 'This ledge is coming apart. Do not stop running.' }),
  climb(12),
  path(40, 3, { rollers: 2, mobs: [['boar', 0.4], ['grunt', 0.7]], jewel: { a: 22, lat: 14, up: 3.5, abs: 1, plat: 1, steps: 2 } }),
  gap(3, 6, 2.6, 'bounce', { tip: 'Bouncy mushrooms! Drop onto one and it flings you up.' }),
  camp({ name: 'Last Green Ledge', npcs: [shopKeeper(g => say(N, 'Nearly at the top of the green bit. After this it gets rocky. Then it gets cold. I sell neither coats nor rocks.'))] }),
  traps('darts', 4),
  chase(80, { rain: 1.4 }),
  traverse(18, { mobs: [['bat', 0.5]], jewel: { a: 16, lat: 0 } }),
  ramp(56, 10, { every: 2.8, mobs: [['boar', 0.25]] }),
  ambush(['brute', 'grunt', 'grunt', 'slinger', 'grunt'], { bark: [C, 'HE IS AT THE GATE ALREADY? WHO IS GUARDING THE GATE? ...KEVIN? WE HAVE A KEVIN?'] }),
  { t: 'goal', len: 30, rise: 0, w: 8 },
];

const L2 = [
  path(40, 2, { name: 'Thunder Gorge', chest: 'hook', npcs: [{ name: H, model: hilda, a: 30, lines: say(H, 'Welcome to Thunder Gorge. It is called that because of the noise I made falling into it.', 'The river here runs straight down the mountain. Fall in and it carries you all the way to the lake at the bottom.', 'If that happens, swim for the bank where the water slows. Or enjoy the ride.') }] }),
  cliff(11, { tip: 'Look at the top edge of the cliff, or the dead branch sticking out above it, and RIGHT CLICK (or Q). The hook hauls you up.' }),
  path(32, 2, { rain: 0.8, mobs: [['grunt', 0.5], ['slinger', 0.8, -3]] }),
  chasm(16, { tip: 'The hook works across gaps too: aim at the far edge or the branch over it.' }),
  logs(5, { mobs: [['bat', 0.5]], tip: 'Gloomwings swoop at anything in the air. A whip crack sorts them out.' }),
  path(34, 3, { geysers: 2, wind: 1, tip: 'Geysers! Stand on one when it blows for a free ride up.', bark: [C, 'WELCOME TO MY GORGE, HERO. I DUG IT MYSELF. WITH A SPOON. IT TOOK AGES.'] }),
  traverse(18, { mobs: [['bat', 0.4]] }),
  ambush(['grunt', 'grunt', 'slinger', 'brute']),
  camp({ name: 'Echo Ledge', npcs: [shopKeeper(g => say(N, 'Mind the echo. I said MIND THE ECHO. See? Terrible for business.'))] }),
  chase(80, { rain: 1.5 }),
  swing(3),
  path(36, 3, { mobs: [['troll', 0.55]], tip: 'A rock troll. When it lifts its club, get ready to jump the shockwave.' }),
  cliff(14),
  traps('mix', 4),
  bridge(22, { mobs: [['bat', 0.5]], wind: 1 }),
  path(32, 2, { chest: 'glider', bark: [LETTER, 'Dear Hero. The Chieftain sings in the bath. He only knows one song and it is about himself. I can see you from the window. You are very small. Climb faster. W.'] }),
  glide(40, { tip: 'Climb the crag, jump, then HOLD SPACE to glide. Steer into the white columns of rising air.' }),
  ramp(52, 10, { every: 3, mobs: [['boar', 0.5]], rain: 1.2 }),
  crawl(),
  stairs(4, 3.6, 2.6, 2.6, { jewel: { a: 14, lat: 0 } }),
  camp({ name: 'Rumbling Shelf', npcs: [shopKeeper(g => say(N, 'I have a silk sail for that glider of yours. Spun by a very reasonable spider.')), { name: H, model: hilda, a: 20, lat: -5, lines: say(H, 'I rode the river down twice today. The second time on purpose. I am telling people it was on purpose.') }] }),
  zip(44),
  collapse(22, { mobs: [['bat', 0.5]] }),
  ambush(['brute', 'slinger', 'grunt', 'grunt', 'slinger']),
  rockfall(5, { high: 3, rain: 1 }),
  path(38, 3, { geysers: 3, wind: 1, mobs: [['troll', 0.6]], jewel: { a: 20, lat: 13, up: 9, abs: 1, plat: 1 } }),
  chasm(20, { mobs: [['bat', 0.5]] }),
  cliff(16),
  traps('logs', 4),
  glide(52, { bark: [C, 'HE HAS A GLIDER NOW? WHO KEEPS LEAVING TREASURE CHESTS ON MY MOUNTAIN? ...I DO? FOR "ATMOSPHERE"? HM.'] }),
  camp({ name: 'Cloudline Camp', npcs: [shopKeeper(g => say(N, 'Above here is the snow. I do not go above here. My ears get cold and they are sixty percent of me.'))] }),
  chase(90, { rain: 1.1 }),
  swing(4, { jewel: { a: 33, lat: 0 } }),
  traverse(22, { mobs: [['bat', 0.3], ['bat', 0.7]] }),
  gap(3, 6, 2.6, 'bounce'),
  traps('darts', 5),
  ramp(56, 10, { every: 2.6, wind: 1 }),
  ambush(['troll', 'brute', 'slinger', 'slinger', 'grunt'], { bark: [C, 'FINE. FINE! HAVE THE GORGE. I NEVER LIKED THE GORGE. THE SUMMIT IS MUCH NICER. AND ICIER. AND FULL OF YETIS.'] }),
  { t: 'goal', len: 30, rise: 0, w: 8 },
];

const L3 = [
  path(40, 2, { name: 'The Frostfang Stair', chest: 'cannon', npcs: [{ name: H, model: hilda, a: 30, lines: say(H, 'Brrr. This is as far as I have ever got. Mostly because of the ice.', 'Ice has no grip at all. Do not try to stop on it. Do not try to do anything on it.', 'There is a chest there with some kind of goblin contraption in it. Points at things. Goes BANG. You will love it.') }] }),
  cliff(22, { tip: 'The hand cannon reaches twice as far and its spike sticks into anything: aim near the top of the cliff and RIGHT CLICK.' }),
  path(36, 2, { ice: 1, rain: 0.8, mobs: [['ram', 0.6]], tip: 'Ice underfoot and icicles overhead. Start turning early and watch the shadows.' }),
  rockfall(5, { high: 3, mobs: [['bat', 0.5]] }),
  path(34, 3, { wind: 1, mobs: [['yeti', 0.75, -3]], tip: 'Yetis lob huge snowballs. Keep moving and they miss.', bark: [C, 'YOU AGAIN! DO YOU KNOW HOW MANY BOULDERS I HAVE GOT THROUGH? WE ARE DOWN TO THE SQUARE ONES.'] }),
  chasm(34, { tip: 'Too far to jump, too far for the old hook. Not too far for the cannon.' }),
  traverse(20, { mobs: [['bat', 0.5]], wind: 1 }),
  traps('mix', 5),
  camp({ name: 'Frozen Toes Camp', npcs: [shopKeeper(g => say(N, 'I said I would not come up here. Then I remembered you have all the coins.'))] }),
  chase(90, { ice: 1, tip: 'A downhill run. On ice. With a boulder. The Chieftain is not playing fair.' }),
  swing(3, { mobs: [['bat', 0.4]] }),
  ambush(['brute', 'brute', 'slinger', 'grunt', 'slinger']),
  glide(56),
  crawl({ rain: 0.9 }),
  stairs(5, 3.6, 2.6, 2.7, { mobs: [['bat', 0.6]], jewel: { a: 17, lat: 0 } }),
  path(36, 3, { ice: 1, wind: 1, mobs: [['ram', 0.3], ['ram', 0.7]], bark: [LETTER, 'Dear Hero. I have nearly finished my tunnel. It is four inches long. I dug it with a spoon. Apparently that is how things are done here. Hurry up. W.'] }),
  zip(50),
  cliff(26),
  camp({ name: 'Windy Gap', npcs: [shopKeeper(g => say(N, 'Last stop before the fortress. Spend it now. You cannot take it with you. Well, you can. But spend it.')), { name: H, model: hilda, a: 20, lat: -5, lines: say(H, 'I MADE IT. Higher than ever! I used the goblin lift. Nib says I owe him forty coins and a formal apology to the union.') }] }),
  bridge(26, { mobs: [['bat', 0.5]], wind: 1 }),
  ramp(58, 11, { every: 2.6, rain: 1, mobs: [['brute', 0.3]] }),
  chasm(44, { jewel: { a: 28, lat: 0 } }),
  collapse(24, { mobs: [['bat', 0.5]] }),
  path(34, 2, { ice: 1, rain: 0.7, mobs: [['yeti', 0.5, -3], ['ram', 0.8]], geysers: 2 }),
  traps('logs', 5),
  logs(6, { mobs: [['bat', 0.5]], wind: 1 }),
  glide(64, { bark: [C, 'STOP FLYING! IT IS NOT FAIR! GOBLINS DO NOT FLY! WE TRIED. ONCE. POOR GRUBB.'] }),
  climb(14),
  ambush(['troll', 'brute', 'slinger', 'slinger', 'brute'], { jewel: { a: 20, lat: 16, up: 5, abs: 1, plat: 1, steps: 2 } }),
  chase(100, { ice: 1, rain: 1.2 }),
  camp({ name: 'The Fortress Door', npcs: [shopKeeper(g => say(N, 'This is it. He is right up there. Three gongs round his throne: he cannot STAND gongs. Ring them all and the big lump comes down to your level.', 'Then whip him. Tell him Nib says hello. Actually do not tell him that.'))] }),
  traps('mix', 6),
  cliff(30),
  traverse(24, { mobs: [['bat', 0.3], ['bat', 0.7]], rain: 1.2 }),
  ramp(56, 10, { every: 3, ice: 1, wind: 1 }),
  gap(3, 6, 2.6, 'bounce', { mobs: [['bat', 0.5]] }),
  stairs(4, 3.6, 2.6, 2.8),
  ambush(['troll', 'yeti', 'brute', 'brute', 'slinger'], { bark: [C, 'RIGHT. THAT IS IT. COME UP HERE AND SAY THAT TO MY FACE. I AM ON A VERY TALL PILLAR.'] }),
  { t: 'arena', len: 30, rise: 0, w: 8 },
];

const BOSS = {
  intro: 'SO. THE HERO. YOU CLIMBED ALL THIS WAY TO BE FLATTENED IN PERSON. I AM TOUCHED. BOULDERS!',
  gong: ['AAARGH! NOT THE GONG! WHO PUT GONGS THERE? ...ME? FOR "ATMOSPHERE"?!', 'STOP THAT! MY EARS! THEY ARE SIXTY PERCENT OF ME!', 'NO NO NO NOT THE THIRD ONE... oh. Oh, the floor is very close now. Hello.'],
  fall: 'WAAAAAAGH! I WILL BE BACK! AS SOON AS I HAVE... WALKED... ALL THE WAY... BACK UP...',
  rescue: [...say(PR, 'FINALLY. Do you know how many turnips I have eaten? I counted. It was all of them.', 'You jumped, climbed, swung, glided and crawled up an entire mountain for me. That is the nicest thing anyone has ever done. Thank you, Hero.', 'Now. How do we get down?'), ...say('You', '...The same way we came up.'), ...say(PR, 'Wonderful. Is there a faster way?'), ...say('You', 'Well. There is the river.'), ...say(PR, 'I like you. Race you to the lake.')],
  after: say(PR, 'I am staying up here a while. The view is excellent now that it is not through bars.', 'Go and find the rest of those relics. The goblins never worked out what they do. You will.'),
};

// Sprinkle the trickier goblins through each trail so no two stretches fight the same way.
function spice(list, pool) {
  let k = 0; const next = () => pool[k++ % pool.length];
  for (const s of list) {
    if (s.t === 'path' && !s.chest && !s.npcs) { const m = next(); (s.mobs = s.mobs || []).push([m, 0.3 + (k % 3) * 0.18, m === 'tugger' ? 3.4 : m === 'harpy' ? 0 : (k % 2 ? 2 : -2)]); }
    else if (s.t === 'ambush') s.foes = [...s.foes, next()];
    else if ((s.t === 'ramp' || s.t === 'traps' || s.t === 'logs' || s.t === 'rockfall') && k++ % 2 === 0) { const m = pool[(k + 1) % pool.length]; if (m !== 'shield') (s.mobs = s.mobs || []).push([m, 0.75, m === 'tugger' ? 3.4 : -2.5]); }
    else if (['swing', 'traverse', 'zip', 'chasm', 'glide'].includes(s.t) && pool.includes('harpy') && k++ % 2 === 0) (s.mobs = s.mobs || []).push(['harpy', 0.55]);
  }
}
spice(L1, ['shield', 'bomber', 'tugger']); spice(L2, ['bomber', 'shaman', 'harpy', 'tugger', 'shield']); spice(L3, ['harpy', 'shaman', 'bomber', 'shield', 'tugger', 'harpy']);

export const LEVELS = {
  hub: { id: 'hub', name: 'Bramblewick', hub: true, theme: 'meadow', seed: 3, story: HUB_STORY },
  l1: { id: 'l1', name: 'Greenfoot Slopes', theme: 'forest', seed: 11, col: 0x3f8a3a, sections: L1, river: { th: 2.4, loops: 2, styles: ['stones', 'log'] }, blurb: 'Forest foothills. Vines, log bridges, and your first goblins.', goal: 'Reach the gate at the top of the slopes' },
  l2: { id: 'l2', name: 'Thunder Gorge', theme: 'gorge', seed: 23, col: 0xb5652a, sections: L2, river: { th: 4.1, loops: 3, styles: ['planks', 'swing', 'raft'] }, blurb: 'Red canyons and a river in a hurry. Bring something to hook onto.', goal: 'Cross the gorge and reach the high gate' },
  l3: { id: 'l3', name: 'The Frostfang Stair', theme: 'snow', seed: 37, col: 0x54a6d6, sections: L3, river: { th: 1.2, loops: 3, styles: ['hook', 'stones', 'log'] }, story: BOSS, blurb: 'Ice, yetis, and the Chieftain\'s fortress at the summit.', goal: 'Reach the summit, ring the three gongs and free the Princess' },
};
LEVELS.hub.levels = [LEVELS.l1, LEVELS.l2, LEVELS.l3];
export const ORDER = ['l1', 'l2', 'l3'];
