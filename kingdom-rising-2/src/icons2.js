// Kingdom Battles ability icons: a gold-rimmed badge with a themed backdrop and a bold, shaded symbol.
let uid = 0;
const THEMES = {
  steel: ['#9aa8b8', '#2a3240', '#f4f8ff', '#8a96a8'],
  red: ['#e0402a', '#3a0a08', '#fff0e0', '#ffb090'],
  fire: ['#ff9a20', '#4a1204', '#fff6c0', '#ffd060'],
  frost: ['#5ac8ff', '#0a2a4a', '#f0fcff', '#a8e8ff'],
  arcane: ['#b070ff', '#1e0a3a', '#fbefff', '#d8b0ff'],
  nature: ['#6ad04a', '#0e2a0a', '#f4ffe8', '#b8f090'],
  gold: ['#ffd050', '#3a2406', '#fffbe0', '#ffe8a0'],
  shadow: ['#7a6a9a', '#120e1a', '#ece4ff', '#b0a0d0'],
};
// symbols on a 64x64 canvas, centred around (32,32)
const GLYPH = {
  sword: 'M44 12 L52 12 L52 20 L28 44 L24 40 Z M20 36 L28 44 L24 48 L22 46 L16 52 L12 48 L18 42 L16 40 Z',
  swords: 'M14 12 L20 12 L40 32 L36 36 Z M50 12 L44 12 L24 32 L28 36 Z M36 36 L44 44 L48 52 L52 48 L44 40 L40 32 Z M28 36 L20 44 L16 52 L12 48 L20 40 L24 32 Z',
  shield: 'M32 10 L50 16 L50 30 C50 42 42 50 32 54 C22 50 14 42 14 30 L14 16 Z M32 18 L32 46 M22 28 L42 28',
  axe: 'M30 10 L34 10 L34 54 L30 54 Z M34 14 C46 12 54 20 52 32 C46 28 40 28 34 30 Z',
  hammer: 'M30 22 L34 22 L34 56 L30 56 Z M18 10 L46 10 L46 24 L18 24 Z',
  arrow: 'M12 52 L44 20 L40 16 L54 10 L48 24 L44 20 M12 52 L16 44 M12 52 L20 48',
  volley: 'M16 8 L16 40 M10 34 L16 44 L22 34 M32 14 L32 46 M26 40 L32 50 L38 40 M48 8 L48 40 M42 34 L48 44 L54 34',
  fireball: 'M40 24 C48 24 52 32 50 40 C48 48 38 52 32 48 C24 44 24 34 30 28 C22 30 16 26 12 18 C20 20 26 18 32 22 C30 16 32 12 38 10 C36 16 38 20 40 24 Z',
  flame: 'M32 8 C38 18 48 24 46 38 C44 48 38 54 32 54 C24 54 18 48 18 40 C18 32 24 30 26 22 C30 28 30 32 32 34 C34 26 30 18 32 8 Z',
  snow: 'M32 8 L32 56 M11 20 L53 44 M11 44 L53 20 M26 12 L32 18 L38 12 M26 52 L32 46 L38 52 M14 28 L20 26 L18 20 M50 36 L44 38 L46 44 M14 36 L20 38 L18 44 M50 28 L44 26 L46 20',
  bolt: 'M36 8 L18 36 L30 36 L26 56 L46 26 L34 26 Z',
  meteor: 'M40 40 m-10 0 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0 M30 32 L10 12 M34 30 L20 8 M28 36 L8 22',
  skull: 'M32 10 C44 10 52 18 52 30 C52 38 48 42 44 44 L44 52 L20 52 L20 44 C16 42 12 38 12 30 C12 18 20 10 32 10 Z M24 30 a5 5 0 1 0 0.1 0 M40 30 a5 5 0 1 0 0.1 0 M28 46 L28 52 M36 46 L36 52',
  heart: 'M32 52 C18 42 10 34 10 24 C10 16 16 12 22 12 C27 12 30 15 32 18 C34 15 37 12 42 12 C48 12 54 16 54 24 C54 34 46 42 32 52 Z M32 22 L32 40 M23 31 L41 31',
  dash: 'M10 22 L26 22 M6 32 L24 32 M10 42 L26 42 M30 16 L46 32 L30 48 M42 16 L58 32 L42 48',
  wolf: 'M14 14 L24 24 L40 24 L50 14 L50 30 C50 42 42 50 32 54 C22 50 14 42 14 30 Z M24 34 L28 34 M36 34 L40 34 M28 44 L32 48 L36 44',
  banner: 'M18 8 L18 58 M18 10 L48 10 L42 22 L48 34 L18 34 Z',
  whirl: 'M32 32 m-4 0 a4 4 0 1 1 8 0 C40 42 24 44 20 34 C16 24 26 14 38 16 C50 18 54 32 48 42 C42 52 26 56 16 48',
  shout: 'M12 26 L22 26 L32 16 L32 48 L22 38 L12 38 Z M38 24 C42 28 42 36 38 40 M44 18 C52 26 52 38 44 46 M50 12 C62 24 62 40 50 52',
  trap: 'M10 40 L54 40 M12 40 L16 26 L20 40 L24 26 L28 40 L32 26 L36 40 L40 26 L44 40 L48 26 L52 40 M14 46 L50 46',
  eye: 'M6 32 C14 18 50 18 58 32 C50 46 14 46 6 32 Z M32 32 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0',
  slam: 'M22 12 L42 12 L42 28 L22 28 Z M18 28 L46 28 L46 34 L18 34 Z M32 40 L26 50 M32 40 L38 52 M32 40 L32 56 M32 40 L16 46 M32 40 L48 46',
  drop: 'M32 8 C40 22 48 30 48 40 C48 50 40 56 32 56 C24 56 16 50 16 40 C16 30 24 22 32 8 Z',
  burst: 'M32 6 L36 24 L52 12 L42 28 L58 32 L42 36 L52 52 L36 40 L32 58 L28 40 L12 52 L22 36 L6 32 L22 28 L12 12 L28 24 Z',
  hourglass: 'M18 8 L46 8 L46 12 L36 30 L46 52 L46 56 L18 56 L18 52 L28 30 L18 12 Z',
  cloud: 'M18 44 C10 44 8 34 16 32 C14 22 26 18 30 26 C34 16 50 18 48 30 C56 30 56 44 46 44 Z',
  fist: 'M20 22 L44 22 L46 40 C46 48 40 52 32 52 C24 52 18 48 18 40 Z M20 22 L20 14 L28 14 L28 22 M28 14 L36 14 L36 22 M36 14 L44 14 L44 22',
  spiral: 'M32 32 m-12 0 a12 12 0 1 1 24 0 a8 8 0 1 1 -16 0 a4 4 0 1 1 8 0',
  boot: 'M22 8 L36 8 L36 36 L50 40 C56 42 58 50 52 54 L20 54 L20 46 Z M20 46 L54 46',
  leaf: 'M14 50 C14 26 30 12 52 12 C52 34 38 50 14 50 Z M14 50 L40 24',
  aim: 'M32 32 m-15 0 a15 15 0 1 0 30 0 a15 15 0 1 0 -30 0 M32 6 L32 22 M32 42 L32 58 M6 32 L22 32 M42 32 L58 32', // (a crosshair: right click aims down the sights)
  spear: 'M8 53 L11 56 L42 25 L39 22 Z M39 22 L45 11 L56 8 L53 19 L42 25 Z', // (a spear: the shaft and its leaf-shaped head)
};
const STROKE_ONLY = new Set(['arrow', 'volley', 'snow', 'dash', 'whirl', 'trap', 'spiral', 'aim']);
// ability id -> [symbol, theme]
const MAP = {
  ar_shbash: ['shield', 'steel'], ar_charge: ['shield', 'gold'], ar_flameblade: ['sword', 'fire'], ar_legsweep: ['boot', 'steel'], ar_firearrow: ['arrow', 'fire'], ar_missiles: ['burst', 'arcane'], ar_bola: ['arrow', 'nature'], ar_axethrow: ['axe', 'blood'], ar_battleshout: ['fist', 'fire'], ar_mendbanner: ['banner', 'nature'], ar_banner: ['shield', 'gold'],
  charge: ['dash', 'steel'], bash: ['shield', 'steel'], kick: ['boot', 'steel'], warbanner: ['banner', 'red'], vigorbanner: ['banner', 'nature'], stonebanner: ['banner', 'frost'], shieldwall: ['shield', 'gold'], cleavestrike: ['whirl', 'steel'], laststand: ['heart', 'red'], shieldthrow: ['shield', 'frost'], fortify: ['shield', 'gold'], execute: ['skull', 'red'], hamstring: ['sword', 'red'], bulwark: ['shield', 'steel'],
  rally: ['banner', 'gold'], seismic: ['slam', 'steel'], bladestorm: ['whirl', 'steel'],
  earthsplitter: ['slam', 'red'], battlecry: ['shout', 'red'], intimshout: ['shout', 'shadow'], whirlwind: ['whirl', 'red'], adrenaline: ['heart', 'fire'], rampage: ['swords', 'red'], groundslam: ['slam', 'fire'], bloodrage: ['drop', 'red'], warstomp: ['burst', 'steel'], undying: ['skull', 'gold'],
  hurlaxe: ['axe', 'steel'], skullsplitter: ['axe', 'red'], frenzy: ['drop', 'fire'],
  spectral: ['arrow', 'arcane'], mending: ['leaf', 'nature'], disengage: ['dash', 'nature'], focus: ['eye', 'gold'], barkskin: ['leaf', 'gold'], snaretrap: ['trap', 'nature'], vanish: ['cloud', 'shadow'], explotrap: ['trap', 'fire'], pinning: ['arrow', 'steel'], barrage: ['volley', 'steel'],
  arrowrain: ['volley', 'nature'], venomshot: ['arrow', 'nature'], wolves: ['wolf', 'frost'], healingwave: ['heart', 'nature'], earthshock: ['burst', 'gold'], spiritwolf: ['wolf', 'nature'], ancestralward: ['shield', 'gold'], hex: ['spiral', 'shadow'], chainheal: ['heart', 'gold'], wartotem: ['swords', 'red'], stormcall: ['bolt', 'arcane'], earthbind: ['trap', 'nature'], spiritlink: ['heart', 'arcane'], sentry: ['eye', 'frost'], spiketrap: ['trap', 'red'], frosttrap: ['snow', 'frost'],
  frostnova: ['snow', 'frost'], blink: ['dash', 'arcane'], chain: ['bolt', 'frost'], manasurge: ['spiral', 'arcane'], icebarrier: ['shield', 'frost'], firering: ['flame', 'fire'], missiles: ['burst', 'arcane'], timewarp: ['hourglass', 'arcane'], lightstorm: ['bolt', 'gold'], inferno: ['meteor', 'fire'],
  pyroblast: ['fireball', 'fire'], glacial: ['snow', 'frost'], meteorshower: ['meteor', 'red'],
  grapeshot: ['burst', 'fire'], smokebomb: ['cloud', 'shadow'], powderkeg: ['burst', 'red'], quickreload: ['hourglass', 'gold'], bayonet: ['sword', 'steel'], eagleeye: ['eye', 'gold'], volleyfire: ['volley', 'fire'], incendiary: ['fireball', 'fire'], caltrops: ['trap', 'steel'], cannonade: ['meteor', 'steel'], doubleshot: ['dash', 'fire'], dash: ['dash', 'fire'],
  tourniquet: ['heart', 'red'], secondwind: ['leaf', 'gold'], fielddress: ['heart', 'nature'], fist: ['fist', 'steel'],
};
// the new classes' abilities get an icon from what they do
import { NEW_CLASSES } from './classes2.js';
{ const G2 = { bolt: 'fireball', drain: 'heart', nova: 'burst', cone: 'volley', strike: 'sword', flurry: 'swords', dash: 'dash', heal: 'heart', hot: 'leaf', buff: 'shield', curse: 'spiral', ground: 'meteor', summon: 'skull', stealth: 'cloud' };
  const TH = { gold: 'gold', shadow: 'shadow', leaf: 'nature', dust: 'steel', arcane: 'arcane', frost: 'frost', fire: 'fire', smoke: 'shadow', blood: 'red' };
  for (const c of Object.values(NEW_CLASSES)) for (const ab of c.abilities) if (!MAP[ab.id]) {
    let g = G2[ab.t] || 'burst'; if (ab.t === 'bolt') g = ab.kind === 'knife' ? 'volley' : ab.kind === 'rock' ? 'slam' : ab.kind === 'spectral' ? 'arrow' : 'fireball'; if (ab.t === 'summon') g = ab.pet === 'skeleton' ? 'skull' : ab.pet === 'fireel' ? 'flame' : ab.pet === 'earthel' ? 'slam' : ab.pet === 'phantasm' ? 'eye' : 'wolf';
    if (ab.t === 'buff') g = ab.buff === 'ward' || ab.buff === 'fort' || ab.buff === 'barrier' ? 'shield' : ab.buff === 'cry' || ab.buff === 'rage' || ab.buff === 'stand' ? 'banner' : ab.buff === 'undying' ? 'heart' : 'hourglass';
    const th = ab.t === 'heal' || ab.t === 'hot' ? (ab.fx === 'gold' ? 'gold' : 'nature') : TH[ab.fx] || (ab.t === 'curse' || ab.t === 'drain' ? 'shadow' : ab.kind === 'fireball' ? 'fire' : ab.kind === 'arcane' ? 'arcane' : 'steel');
    MAP[ab.id] = ab.song ? ['shout', { war: 'red', travel: 'frost', heal: 'nature', ward: 'gold', flame: 'fire', mana: 'arcane' }[ab.song]] : [g, th]; } }
// the arena kits' icons (kitinfo.js): f = filled shape (even-odd, so inner shapes cut holes), s = lines drawn over it
const SH = 'M32 10 L50 16 L50 30 C50 42 42 50 32 54 C22 50 14 42 14 30 L14 16 Z', BOOT = 'M22 4 L36 4 L36 30 L50 34 C56 36 58 44 52 46 L20 46 L20 40 Z';
const FIST = 'M20 22 L44 22 L46 40 C46 48 40 52 32 52 C24 52 18 48 18 40 Z M20 22 L20 14 L28 14 L28 22 Z M28 14 L36 14 L36 22 L28 22 Z M36 14 L44 14 L44 22 L36 22 Z';
const SKULL = 'M32 12 C44 12 52 20 52 31 C52 38 48 42 44 44 L44 54 L20 54 L20 44 C16 42 12 38 12 31 C12 20 20 12 32 12 Z M20 30 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 Z M34 30 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 Z M29 42 L32 37 L35 42 Z';
const WINGL = 'M29 30 C22 14 10 10 2 14 C10 18 14 22 16 26 C8 26 4 30 2 36 C10 32 18 34 22 38 C16 40 14 44 14 48 C20 42 25 40 29 40 Z', WINGR = 'M35 30 C42 14 54 10 62 14 C54 18 50 22 48 26 C56 26 60 30 62 36 C54 32 46 34 42 38 C48 40 50 44 50 48 C44 42 39 40 35 40 Z';
const BOMB = 'M12 38 a18 18 0 1 0 36 0 a18 18 0 1 0 -36 0 Z M25 16 L35 16 L35 22 L25 22 Z';
const TOTEM = 'M22 8 L42 8 L44 22 L20 22 Z M20 24 L44 24 L42 38 L22 38 Z M24 40 L40 40 L40 58 L24 58 Z M13 28 L20 26 L20 34 L11 34 Z M51 28 L44 26 L44 34 L53 34 Z M26 13 L30 13 L30 17 L26 17 Z M34 13 L38 13 L38 17 L34 17 Z M27 29 L31 29 L31 33 L27 33 Z M33 29 L37 29 L37 33 L33 33 Z';
const DAGGER = (x) => `M${x} 4 L${x + 5} 12 L${x + 4} 38 L${x - 4} 38 L${x - 5} 12 Z M${x - 12} 38 L${x + 12} 38 L${x + 12} 43 L${x - 12} 43 Z M${x - 3} 43 L${x + 3} 43 L${x + 3} 54 L${x - 3} 54 Z M${x - 5} 54 L${x + 5} 54 L${x + 5} 60 L${x - 5} 60 Z`;
const MUSKET = 'M6 50 L14 42 L18 46 L48 16 L54 10 L58 14 L52 20 L22 50 L18 46 L10 54 Z';
const SPIRAL = (cx, cy) => `M${cx} ${cy} m-2 0 a2 2 0 1 1 4 0 a5 5 0 1 1 -9 0 a8 8 0 1 1 15 0`;
const KIT_GLYPH = {
  flamesword: { f: 'M44 12 L52 12 L52 20 L28 44 L24 40 Z M20 36 L28 44 L24 48 L22 46 L16 52 L12 48 L18 42 L16 40 Z M38 6 C36 12 31 15 34 21 C27 19 28 12 34 8 Z M50 24 C46 25 43 29 46 34 C39 32 40 25 45 21 Z M30 16 C26 19 24 23 27 28 C20 26 21 19 27 15 Z' },
  mendbanner: { f: 'M16 8 L20 8 L20 58 L16 58 Z M20 10 L50 10 L44 22 L50 34 L20 34 Z M31 14 L35 14 L35 19 L40 19 L40 23 L35 23 L35 30 L31 30 L31 23 L26 23 L26 19 L31 19 Z' },
  shieldbanner: { f: 'M16 6 L20 6 L20 60 L16 60 Z M20 8 L54 8 L47 24 L54 40 L20 40 Z M35 13 L45 16 L45 23 C45 29 41 33 35 35 C29 33 25 29 25 23 L25 16 Z' },
  shieldcharge: { f: 'M38 12 L54 17 L54 29 C54 40 47 47 38 50 C29 47 22 40 22 29 L22 17 Z', s: 'M6 22 L16 22 M3 32 L16 32 M6 42 L16 42' },
  shieldbash: { f: 'M26 12 L42 17 L42 29 C42 40 35 47 26 50 C17 47 10 40 10 29 L10 17 Z', s: 'M48 18 L56 12 M50 31 L60 31 M48 44 L56 50' },
  shieldglow: { f: 'M32 14 L46 19 L46 30 C46 40 40 46 32 50 C24 46 18 40 18 30 L18 19 Z', s: 'M32 3 L32 8 M11 11 L15 15 M53 11 L49 15 M5 30 L11 30 M59 30 L53 30' },
  runeshield: { f: SH + ' M30 20 L34 20 L34 26 L40 22 L42 25 L34 30 L34 44 L30 44 L30 30 L22 25 L24 22 L30 26 Z' },
  leafshield: { f: SH, s: 'M23 42 C25 30 31 24 41 20 M28 32 L23 27 M33 27 L32 20' },
  leap: { f: 'M24 6 L40 6 L40 22 L48 22 L32 38 L16 22 L24 22 Z', s: 'M6 50 L58 50 M32 43 L27 50 L34 57 M18 45 L14 50 M46 45 L50 50' },
  claws: { s: 'M14 52 C22 36 34 22 50 12 M22 56 C32 42 44 30 58 22 M8 42 C14 30 24 18 38 8' },
  roar: { f: 'M10 20 C10 12 18 8 26 10 L44 14 C52 16 56 24 54 32 L46 30 L40 36 L48 40 C50 48 44 54 36 52 L18 48 C10 46 8 38 10 32 Z M20 22 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 Z M28 30 L32 38 L36 31 L40 37 L42 31 Z', s: 'M54 14 L60 10 M58 24 L63 23 M56 44 L61 48' },
  axethrow: { f: 'M30 14 L34 14 L34 54 L30 54 Z M34 16 C46 14 54 22 52 34 C46 30 40 30 34 32 Z', s: 'M10 20 C5 30 7 42 15 50 M54 46 C59 36 57 22 48 14' },
  whirlaxes: { f: 'M30 14 L34 14 L34 50 L30 50 Z M34 9 C45 7 51 14 49 23 C45 20 40 20 34 22 Z M30 55 C19 57 13 50 15 41 C19 44 24 44 30 42 Z', s: 'M12 18 C6 28 8 40 14 47 M52 46 C58 36 56 24 50 17' },
  hand: { f: 'M22 58 L22 36 L15 27 C13 23 17 21 20 24 L24 29 L24 12 C24 9 28 9 28 12 L28 27 L29 8 C29 5 33 5 33 8 L33 27 L35 10 C35 7 39 7 39 10 L38 29 L42 17 C43 14 47 15 46 18 L44 36 C44 47 40 53 38 58 Z' },
  sweep: { f: 'M8 46 C14 20 40 8 58 16 C40 18 22 28 18 50 Z', s: 'M40 26 L50 24 M30 34 L38 34 M24 44 L30 46' },
  hammerhit: { f: 'M28 26 L32 26 L32 58 L28 58 Z M14 12 L44 12 L44 28 L14 28 Z', s: 'M50 8 L56 4 M52 20 L60 20 M50 32 L56 36' },
  wingsword: { f: 'M30 6 L34 6 L35 40 L29 40 Z M22 40 L42 40 L42 44 L22 44 Z M30 44 L34 44 L34 58 L30 58 Z M27 22 C20 14 10 14 4 20 C12 20 16 24 18 28 C12 28 8 32 6 36 C14 32 21 32 27 32 Z M37 22 C44 14 54 14 60 20 C52 20 48 24 46 28 C52 28 56 32 58 36 C50 32 43 32 37 32 Z' },
  drain: { f: 'M44 30 C48 36 52 40 52 46 C52 52 48 56 44 56 C40 56 36 52 36 46 C36 40 40 36 44 30 Z', s: 'M8 12 C16 14 18 22 24 24 C30 26 32 18 38 22 M6 22 C12 24 14 30 20 32' },
  ribcage: { s: 'M32 6 L32 58 M32 15 C22 15 16 19 16 25 M32 15 C42 15 48 19 48 25 M32 26 C20 26 14 30 14 36 M32 26 C44 26 50 30 50 36 M32 37 C22 37 18 41 18 47 M32 37 C42 37 46 41 46 47' },
  grasp: { f: 'M20 58 L20 38 L11 23 L17 20 L24 31 L24 9 L29 9 L30 28 L33 5 L38 6 L36 28 L42 9 L47 11 L41 32 L50 25 L54 29 L44 41 C42 49 38 54 36 58 Z' },
  chains: { s: 'M9.6 54.4 A9 4 -45 0 1 22.4 41.6 A9 4 -45 0 1 9.6 54.4 Z M21.6 29.6 A9 4 45 0 1 34.4 42.4 A9 4 45 0 1 21.6 29.6 Z M33.6 30.4 A9 4 -45 0 1 46.4 17.6 A9 4 -45 0 1 33.6 30.4 Z M45.6 5.6 A9 4 45 0 1 58.4 18.4 A9 4 45 0 1 45.6 5.6 Z' },
  sun: { f: 'M20 32 a12 12 0 1 0 24 0 a12 12 0 1 0 -24 0 Z M32 3 L35 14 L29 14 Z M32 61 L29 50 L35 50 Z M3 32 L14 29 L14 35 Z M61 32 L50 35 L50 29 Z M11 11 L20 17 L17 20 Z M53 53 L44 47 L47 44 Z M53 11 L47 20 L44 17 Z M11 53 L17 44 L20 47 Z' },
  suncross: { f: 'M18 32 a14 14 0 1 0 28 0 a14 14 0 1 0 -28 0 Z M32 2 L35 13 L29 13 Z M32 62 L29 51 L35 51 Z M2 32 L13 29 L13 35 Z M62 32 L51 35 L51 29 Z M30 24 L34 24 L34 30 L40 30 L40 34 L34 34 L34 40 L30 40 L30 34 L24 34 L24 30 L30 30 Z' },
  sparkle: { f: 'M28 6 L33 27 L54 32 L33 37 L28 58 L23 37 L2 32 L23 27 Z M50 6 L52 12 L58 14 L52 16 L50 22 L48 16 L42 14 L48 12 Z M50 42 L51.5 46.5 L56 48 L51.5 49.5 L50 54 L48.5 49.5 L44 48 L48.5 46.5 Z' },
  lightdown: { f: 'M28 4 L36 4 L36 30 L44 30 L32 46 L20 30 L28 30 Z', s: 'M12 54 L52 54 M17 47 L22 51 M47 47 L42 51' },
  beam: { f: 'M27 2 L37 2 L44 48 L20 48 Z', s: 'M10 54 C20 60 44 60 54 54 M14 30 L18 32 M50 30 L46 32' },
  angel: { f: WINGL + ' ' + WINGR + ' M32 24 L36 34 L32 50 L28 34 Z', s: 'M18 12 C18 6 46 6 46 12 C46 18 18 18 18 12 Z' },
  wings: { f: WINGL + ' ' + WINGR + ' M32 26 L36 34 L32 48 L28 34 Z' },
  halo: { s: 'M8 38 C8 26 56 26 56 38 C56 50 8 50 8 38 Z M32 6 L32 16 M14 12 L20 20 M50 12 L44 20' },
  kick: { f: BOOT.replace(/(\d+) (\d+)/g, (m, x, y) => `${+x + 6} ${+y + 6}`), s: 'M4 20 L16 20 M2 30 L16 30 M4 40 L16 40' },
  punch: { f: FIST.replace(/(\d+) (\d+)/g, (m, x, y) => `${+x + 8} ${y}`), s: 'M4 24 L18 24 M2 34 L18 34 M4 44 L18 44' },
  fistburst: { f: FIST, s: 'M8 10 L14 16 M4 32 L12 32 M8 54 L14 48 M56 10 L50 16 M60 32 L52 32 M56 54 L50 48' },
  fiststorm: { f: FIST, s: 'M10 18 C4 30 8 46 18 56 M54 46 C60 34 56 18 46 8' },
  wrapfist: { f: FIST + ' M19 30 L46 30 L46 33 L19 33 Z M18 38 L46 38 L46 41 L18 41 Z' },
  notes: { f: 'M22 50 C16 50 12 46 14 42 C16 38 22 38 26 40 L26 12 L50 6 L50 40 C50 44 44 48 40 46 C36 44 38 38 44 36 L46 36 L46 15 L30 19 L30 46 C30 50 26 50 22 50 Z' },
  notewave: { f: 'M16 48 C10 48 8 44 10 41 C12 38 16 38 20 40 L20 12 L24 12 L24 44 C24 47 20 48 16 48 Z', s: 'M32 22 C38 28 38 36 32 42 M40 16 C48 24 48 40 40 48 M48 10 C58 22 58 42 48 54' },
  spiraleye: { s: 'M6 32 C14 18 50 18 58 32 C50 46 14 46 6 32 Z ' + SPIRAL(32, 32) },
  lute: { f: 'M22 58 C10 58 8 44 16 38 C20 35 24 34 26 30 L40 10 L44 5 L51 10 L46 14 L32 34 C32 38 34 42 34 46 C34 54 30 58 22 58 Z M18 48 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 Z' },
  sprout: { f: 'M31 58 L33 58 L33 34 L31 34 Z M32 36 C20 36 12 28 12 16 C24 16 32 24 32 36 Z M32 30 C32 18 40 10 52 10 C52 22 44 30 32 30 Z' },
  paw: { f: 'M32 34 C42 34 48 42 46 50 C44 56 38 54 32 54 C26 54 20 56 18 50 C16 42 22 34 32 34 Z M10 28 a5 6 0 1 0 10 0 a5 6 0 1 0 -10 0 Z M20 16 a5 6 0 1 0 10 0 a5 6 0 1 0 -10 0 Z M34 16 a5 6 0 1 0 10 0 a5 6 0 1 0 -10 0 Z M44 28 a5 6 0 1 0 10 0 a5 6 0 1 0 -10 0 Z' },
  vines: { s: 'M10 58 C14 42 6 32 16 24 C24 18 30 26 24 32 M32 58 C32 42 40 36 36 24 C34 16 26 16 28 24 M54 58 C50 42 58 32 48 24 C40 18 34 26 40 32' },
  tree: { f: 'M29 58 L35 58 L35 40 L29 40 Z M32 6 C42 6 46 12 46 16 C54 16 58 24 54 30 C56 36 50 42 44 40 L20 40 C14 42 8 36 10 30 C6 24 10 16 18 16 C18 12 22 6 32 6 Z' },
  wave: { f: 'M4 40 C12 28 20 20 32 20 C44 20 50 28 46 34 C42 28 34 28 32 34 C30 40 38 44 44 42 C52 40 58 34 60 30 L60 54 L4 54 Z' },
  frog: { f: 'M14 30 C14 22 18 16 24 16 C28 16 30 20 32 22 C34 20 36 16 40 16 C46 16 50 22 50 30 C56 34 56 46 48 50 C40 54 24 54 16 50 C8 46 8 34 14 30 Z M21 26 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 Z M37 26 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 Z M20 40 C28 46 36 46 44 40 L44 42 C36 48 28 48 20 42 Z' },
  totem: { f: TOTEM },
  stormtotem: { f: TOTEM, s: 'M6 10 L12 18 L8 20 L14 28 M58 10 L52 18 L56 20 L50 28' },
  bola: { f: 'M6 46 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 Z M42 18 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 Z', s: 'M19 40 C28 28 34 36 45 24' },
  bandage: { f: 'M12 40 L40 12 C44 8 50 9 53 12 C56 15 56 20 52 24 L24 52 C20 56 14 56 11 53 C8 50 8 44 12 40 Z M28 32 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0 Z M32 28 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0 Z M32 36 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0 Z M36 32 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0 Z' },
  pistol: { f: 'M8 20 L48 20 L48 28 L30 28 L28 32 L24 32 L22 50 L10 50 L14 32 L8 28 Z', s: 'M53 18 L60 13 M55 24 L62 24 M53 30 L60 35' },
  musket: { f: MUSKET, s: 'M56 22 L62 28 M48 4 L50 10 M60 6 L56 10' },
  stock: { f: MUSKET, s: 'M2 40 L8 36 M4 58 L10 52 M14 62 L16 56' },
  blastdash: { f: 'M16 20 L18 28 L26 24 L21 31 L28 32 L21 34 L26 40 L18 37 L16 44 L14 37 L6 40 L11 34 L4 32 L11 31 L6 24 L14 28 Z', s: 'M32 18 L44 32 L32 46 M44 18 L56 32 L44 46' },
  buckshot: { f: 'M40 18 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 Z M48 28 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 Z M50 40 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 Z M40 46 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 Z M34 32 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 Z M42 36 a2.5 2.5 0 1 0 5 0 a2.5 2.5 0 1 0 -5 0 Z', s: 'M6 32 L58 10 M6 32 L58 54' },
  anvil: { f: 'M8 18 L50 18 C56 18 58 22 58 26 L44 26 C40 26 38 30 38 34 L42 40 L46 46 L18 46 L22 40 L26 34 C26 30 22 28 16 28 C10 28 8 24 8 18 Z M14 50 L50 50 L50 56 L14 56 Z' },
  keg: { f: 'M18 12 L46 12 C50 22 50 44 46 56 L18 56 C14 44 14 22 18 12 Z M15 22 L49 22 L49 25 L15 25 Z M15 43 L49 43 L49 46 L15 46 Z', s: 'M32 12 C32 6 38 6 40 2' },
  beartrap: { f: 'M6 40 L58 40 L58 46 L6 46 Z M10 40 L13 30 L16 40 Z M18 40 L21 28 L24 40 Z M26 40 L29 26 L32 40 Z M34 40 L37 26 L40 40 Z M42 40 L45 28 L48 40 Z M50 40 L53 30 L56 40 Z', s: 'M8 30 C8 12 56 12 56 30 M26 46 L26 54 M38 46 L38 54' },
  missiles: { f: 'M52 2 L54.5 9.5 L62 12 L54.5 14.5 L52 22 L49.5 14.5 L42 12 L49.5 9.5 Z', s: 'M8 52 C10 30 28 18 46 14 M8 34 C20 26 32 20 46 14 M26 58 C30 40 38 26 46 14' },
  portal: { f: 'M32 6 C46 6 50 20 50 32 C50 44 46 58 32 58 C18 58 14 44 14 32 C14 20 18 6 32 6 Z M32 13 C42 13 44 24 44 32 C44 40 42 51 32 51 C22 51 20 40 20 32 C20 24 22 13 32 13 Z', s: 'M32 32 C36 30 36 25 31 25 C25 26 25 37 32 39 C40 40 42 28 36 21' },
  ghost: { f: 'M16 56 L16 28 C16 16 22 8 32 8 C42 8 48 16 48 28 L48 56 L42 50 L37 56 L32 50 L27 56 L22 50 Z M23 26 a3 4 0 1 0 6 0 a3 4 0 1 0 -6 0 Z M35 26 a3 4 0 1 0 6 0 a3 4 0 1 0 -6 0 Z' },
  ascend: { f: 'M27 12 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 Z M32 18 L42 42 L22 42 Z', s: 'M12 51 C12 46 52 46 52 51 C52 56 12 56 12 51 Z M7 30 L12 23 L17 30 M47 30 L52 23 L57 30' },
  dagger: { f: DAGGER(32) },
  daggerdrop: { f: DAGGER(24) + ' M48 28 C52 34 55 39 55 44 C55 49 52 52 48 52 C44 52 41 49 41 44 C41 39 44 34 48 28 Z' },
  daggermark: { f: DAGGER(32), s: 'M8 32 a24 24 0 1 0 48 0 a24 24 0 1 0 -48 0' },
  dizzy: { f: 'M18 22 L20 17 L22 22 L27 22 L23 25 L25 30 L20 27 L15 30 L17 25 L13 22 Z M44 18 L45.5 14 L47 18 L51 18 L48 20.5 L49 24 L45.5 22 L42 24 L43 20.5 L40 18 Z ' + FIST.replace(/(\d+) (\d+)/g, (m, x, y) => `${x} ${+y + 8}`), s: 'M8 20 C8 12 56 12 56 20 C56 28 8 28 8 20 Z' },
  footsteps: { f: 'M18 52 C13 52 11 46 13 40 C15 34 21 34 23 40 C25 46 23 52 18 52 Z M15 56 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 Z M42 28 C37 28 35 22 37 16 C39 10 45 10 47 16 C49 22 47 28 42 28 Z M39 32 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 Z', s: 'M52 40 C58 40 60 46 56 50 M8 20 C4 16 8 10 14 12' },
  plague: { f: 'M6 22 C6 14 12 10 18 10 C24 10 28 16 28 22 C28 26 26 28 24 30 L24 34 L12 34 L12 30 C8 28 6 26 6 22 Z M11 20 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 Z M34 42 C28 42 28 34 34 34 C34 28 42 26 44 32 C48 26 58 30 56 36 C62 38 60 48 54 48 L36 48 C30 48 30 42 34 42 Z', s: 'M28 28 L36 32 M26 34 L32 40' },
  skull2: { f: SKULL },
  demon: { f: SKULL + ' M15 22 C8 14 8 8 11 2 C14 10 18 14 23 15 Z M49 22 C56 14 56 8 53 2 C50 10 46 14 41 15 Z' },
  flameface: { f: 'M32 6 C38 16 50 22 48 38 C46 50 40 58 32 58 C22 58 16 50 16 40 C16 30 22 28 24 18 C28 24 30 28 32 30 C34 22 30 16 32 6 Z M24 40 a3 3.5 0 1 0 6 0 a3 3.5 0 1 0 -6 0 Z M34 40 a3 3.5 0 1 0 6 0 a3 3.5 0 1 0 -6 0 Z' },
  crystal: { f: 'M32 4 L46 16 L46 46 L32 60 L18 46 L18 16 Z M32 14 L38 22 L38 42 L32 50 L26 42 L26 22 Z' },
  lock: { f: 'M16 28 L48 28 L48 56 L16 56 Z M22 28 L22 20 C22 6 42 6 42 20 L42 28 L37 28 L37 20 C37 12 27 12 27 20 L27 28 Z M30 37 C30 34 34 34 34 37 C34 39 33 40 33 41 L34 49 L30 49 L31 41 C31 40 30 39 30 37 Z' },
  brain: { f: 'M32 12 C26 8 18 10 16 16 C10 16 6 22 8 28 C4 32 6 40 12 42 C12 48 18 52 24 50 C26 54 30 54 32 52 C34 54 38 54 40 50 C46 52 52 48 52 42 C58 40 60 32 56 28 C58 22 54 16 48 16 C46 10 38 8 32 12 Z M31 14 L33 14 L33 50 L31 50 Z', s: 'M18 26 C22 24 24 28 22 32 M46 26 C42 24 40 28 42 32' },
  heartspiral: { f: 'M32 54 C18 44 8 36 8 24 C8 16 14 10 22 10 C27 10 30 13 32 16 C34 13 37 10 42 10 C50 10 56 16 56 24 C56 36 46 44 32 54 Z', s: SPIRAL(32, 29) },
  bomb: { f: BOMB + ' M50 2 L52 7 L57 8 L52 10 L50 15 L48 10 L43 8 L48 7 Z', s: 'M30 16 C30 10 36 7 40 9 C43 11 45 9 46 7' },
  plunger: { f: 'M14 36 L50 36 L50 56 L14 56 Z M30 14 L34 14 L34 36 L30 36 Z M18 8 L46 8 L46 14 L18 14 Z', s: 'M50 46 C56 46 58 40 61 36 M8 50 L2 54' },
  rocketboot: { f: BOOT + ' M22 48 C20 54 24 56 22 62 C28 58 30 54 28 48 Z M34 48 C32 54 36 56 34 62 C40 58 42 54 40 48 Z M46 48 C44 52 48 54 46 59 C50 56 52 52 50 48 Z' },
};
import { KIT } from './kitinfo.js';
import { GI, GI_GLYPH } from './kiticons.js';
// the arena badge: one look for every ability. A deep themed backdrop lit from above, the drawing in a bright metal gradient with a dark outline and
// shadow, a bevelled gold frame (thicker, with a crown notch and a sunburst behind, for an ultimate)
const GI_TH = { steel: ['#7f8fa3', '#151b24', '#ffffff', '#b8c4d4'], red: ['#c8321e', '#2a0604', '#fff4e6', '#ffb48a'], fire: ['#ff8a1a', '#3a0e02', '#fffbe0', '#ffc040'], frost: ['#3aa8ee', '#06203c', '#f4fdff', '#9fe0ff'],
  arcane: ['#9a52f0', '#170630', '#fdf4ff', '#d4a8ff'], nature: ['#4cb434', '#0a2206', '#f6ffec', '#aef08a'], gold: ['#f0b830', '#2e1a02', '#fffdf0', '#ffe08a'], shadow: ['#5e4e82', '#0c0914', '#f0eaff', '#b4a4dc'] };
export function giBadge(d, th, cap) {
  const [c1, c2, hi, lo] = GI_TH[th] || GI_TH.steel, n = ++uid;
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><defs>
<radialGradient id="gb${n}" cx="50%" cy="30%" r="80%"><stop offset="0" stop-color="${c1}"/><stop offset=".62" stop-color="${c2}"/><stop offset="1" stop-color="#000"/></radialGradient>
<linearGradient id="gr${n}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff4c4"/><stop offset=".35" stop-color="#e2b04c"/><stop offset=".7" stop-color="#8a5a18"/><stop offset="1" stop-color="#4a2c08"/></linearGradient>
<linearGradient id="gg${n}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset=".55" stop-color="${lo}"/><stop offset="1" stop-color="${c1}"/></linearGradient>
<filter id="gs${n}" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="14" stdDeviation="10" flood-color="#000" flood-opacity=".85"/><feDropShadow dx="0" dy="0" stdDeviation="14" flood-color="${c1}" flood-opacity=".55"/></filter>
<clipPath id="gc${n}"><rect x="3" y="3" width="58" height="58" rx="9"/></clipPath></defs>
<rect x="3" y="3" width="58" height="58" rx="9" fill="url(#gb${n})"/>
<g clip-path="url(#gc${n})">${cap ? `<g opacity=".38">${Array.from({ length: 16 }, (_, i) => { const a = i * Math.PI / 8; return `<path d="M32 32 L${(32 + Math.cos(a - 0.09) * 46).toFixed(1)} ${(32 + Math.sin(a - 0.09) * 46).toFixed(1)} L${(32 + Math.cos(a + 0.09) * 46).toFixed(1)} ${(32 + Math.sin(a + 0.09) * 46).toFixed(1)} Z" fill="#ffe6a0"/>`; }).join('')}</g>` : ''}
<ellipse cx="32" cy="8" rx="34" ry="14" fill="#fff" opacity=".10"/>
<g transform="translate(9 9) scale(0.0898)" filter="url(#gs${n})"><path d="${d}" fill="url(#gg${n})" stroke="#0a0604" stroke-width="22" stroke-linejoin="round" paint-order="stroke"/></g></g>
<rect x="3" y="3" width="58" height="58" rx="9" fill="none" stroke="#000" stroke-opacity=".6" stroke-width="5"/>
<rect x="2" y="2" width="60" height="60" rx="10" fill="none" stroke="url(#gr${n})" stroke-width="${cap ? 4 : 2.6}"/>
<rect x="5.6" y="5.6" width="52.8" height="52.8" rx="7" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="1"/>${cap ? `<path d="M25 2.5 L32 -2.5 L39 2.5 Z M25 61.5 L32 66.5 L39 61.5 Z" fill="#ffe08a" stroke="#5a3a0c" stroke-width="1"/>` : ''}</svg>`;
}
// an arena kit ability's own icon (kitinfo.js), or null when it has none
export function kitIcon(id) { const k = KIT[id]; if (k && GI[id]) return giBadge(GI[id], k[1], !!k[3]); if (!k || !KIT_GLYPH[k[0]] && !GLYPH[k[0]]) return null; return glyphBadge(k[0], k[1], !!k[3]); }
export function addIcons(m) { for (const k in m) if (m[k] && !MAP[k]) MAP[k] = m[k]; }
export function hasIcon(id) { return !!MAP[id]; }
export function abilityBadge(id) { const [g, th, cap] = MAP[id] || ['burst', 'steel']; return glyphBadge(g, th, cap); }
export function glyphBadge(g, th, cap) {
  if (GI_GLYPH[g]) return giBadge(GI_GLYPH[g], th, cap); /* (the arena's left clicks and Aim: the same badge as every ability) */
  const [c1, c2, hi, lo] = THEMES[th] || THEMES.steel; const n = ++uid;
  const kg = KIT_GLYPH[g], path = kg ? (kg.f || kg.s) : GLYPH[g], stroke = kg ? !kg.f : STROKE_ONLY.has(g), over = kg && kg.f && kg.s ? kg.s : null; /* (a kit glyph: a filled shape, lines, or both) */
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><defs>
<radialGradient id="bg${n}" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>
<linearGradient id="rim${n}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2b8"/><stop offset=".45" stop-color="#d8a640"/><stop offset="1" stop-color="#6a4410"/></linearGradient>
<linearGradient id="gl${n}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset="1" stop-color="${lo}"/></linearGradient>
<filter id="sh${n}" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.2" flood-color="#000" flood-opacity=".8"/></filter></defs>
<rect x="2" y="2" width="60" height="60" rx="11" fill="url(#bg${n})"/>
<rect x="2" y="2" width="60" height="60" rx="11" fill="none" stroke="#000" stroke-opacity=".55" stroke-width="6"/>
${cap ? `<g opacity=".55">${Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; return `<path d="M32 32 L${(32 + Math.cos(a - 0.12) * 40).toFixed(1)} ${(32 + Math.sin(a - 0.12) * 40).toFixed(1)} L${(32 + Math.cos(a + 0.12) * 40).toFixed(1)} ${(32 + Math.sin(a + 0.12) * 40).toFixed(1)} Z" fill="#ffe08a"/>`; }).join('')}</g><circle cx="32" cy="32" r="20" fill="none" stroke="#ffe08a" stroke-opacity=".7" stroke-width="1.5"/>` : ''}
<g filter="url(#sh${n})">${stroke
    ? `<path d="${path}" fill="none" stroke="#1a0e04" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="${path}" fill="none" stroke="url(#gl${n})" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>`
    : `<path d="${path}" fill="url(#gl${n})" stroke="#1a0e04" stroke-width="2.6" stroke-linejoin="round" fill-rule="evenodd"/>`}${over ? `<path d="${over}" fill="none" stroke="#1a0e04" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="${over}" fill="none" stroke="url(#gl${n})" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>` : ''}</g>
<ellipse cx="32" cy="14" rx="22" ry="8" fill="#fff" opacity=".13"/>
<rect x="2" y="2" width="60" height="60" rx="11" fill="none" stroke="url(#rim${n})" stroke-width="${cap ? 4.5 : 3}"/>${cap ? '<path d="M24 2 L32 -3 L40 2 Z" fill="#ffe08a" stroke="#6a4410" stroke-width="1"/>' : ''}
<rect x="5.5" y="5.5" width="53" height="53" rx="8" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="1.2"/></svg>`;
}
