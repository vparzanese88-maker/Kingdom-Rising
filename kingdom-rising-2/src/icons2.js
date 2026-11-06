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
};
const STROKE_ONLY = new Set(['arrow', 'volley', 'snow', 'dash', 'whirl', 'trap', 'spiral']);
// ability id -> [symbol, theme]
const MAP = {
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
export function addIcons(m) { for (const k in m) if (m[k] && !MAP[k]) MAP[k] = m[k]; }
export function hasIcon(id) { return !!MAP[id]; }
export function abilityBadge(id) { const [g, th, cap] = MAP[id] || ['burst', 'steel']; return glyphBadge(g, th, cap); }
export function glyphBadge(g, th, cap) {
  const [c1, c2, hi, lo] = THEMES[th] || THEMES.steel; const n = ++uid;
  const path = GLYPH[g], stroke = STROKE_ONLY.has(g);
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
    : `<path d="${path}" fill="url(#gl${n})" stroke="#1a0e04" stroke-width="2.6" stroke-linejoin="round" fill-rule="evenodd"/>`}</g>
<ellipse cx="32" cy="14" rx="22" ry="8" fill="#fff" opacity=".13"/>
<rect x="2" y="2" width="60" height="60" rx="11" fill="none" stroke="url(#rim${n})" stroke-width="${cap ? 4.5 : 3}"/>${cap ? '<path d="M24 2 L32 -3 L40 2 Z" fill="#ffe08a" stroke="#6a4410" stroke-width="1"/>' : ''}
<rect x="5.5" y="5.5" width="53" height="53" rx="8" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="1.2"/></svg>`;
}
