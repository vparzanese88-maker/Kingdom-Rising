// Class and race crests for character creation: a metal-rimmed shield badge, a dark field in the class colour
// and a bright, bold emblem that says what the class does.
let n = 0;
// [field colour, glow colour, emblem paths (64x64 space; 'f:' fill, 's:' stroke)]
const C = {
  warrior: ['#7a2018', '#ffd27a', ['f:M32 9 L46 15 L46 30 C46 41 39 48 32 52 C25 48 18 41 18 30 L18 15 Z', 's:M14 46 L50 12 M50 46 L14 12', 'f:M11 48 L16 43 L19 46 L14 51 Z M53 48 L48 43 L45 46 L50 51 Z']],
  berserker: ['#6a0a08', '#ff6a3a', ['f:M31 8 L34 8 L34 56 L31 56 Z', 'f:M34 12 C46 10 54 18 52 30 C46 26 40 26 34 28 Z M31 12 C19 10 11 18 13 30 C19 26 25 26 31 28 Z', 's:M20 40 L26 46 M44 40 L38 46 M32 4 L32 0']],
  ranger: ['#1e4a1a', '#b8f070', ['s:M18 8 C40 18 40 46 18 56', 's:M18 8 L18 56', 's:M10 32 L54 32', 'f:M54 32 L44 26 L46 32 L44 38 Z', 'f:M10 32 L15 27 L13 32 L15 37 Z']],
  musketeer: ['#1e2e5a', '#ffd060', ['s:M10 50 L50 14', 'f:M8 52 L16 44 L19 48 L12 55 Z', 'f:M50 14 m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0', 's:M56 8 L60 4 M58 14 L63 14 M50 6 L50 1 M44 8 L40 4']],
  shaman: ['#1a4a4a', '#8ae0ff', ['f:M32 6 L40 18 L36 18 L36 30 L28 30 L28 18 L24 18 Z', 'f:M22 32 L42 32 L40 40 L24 40 Z', 'f:M26 42 L38 42 L36 56 L28 56 Z', 'f:M44 10 L52 22 L47 22 L54 36 L41 20 L46 20 Z']],
  wizard: ['#2a1060', '#ff9a40', ['f:M32 6 C40 18 50 24 48 38 C46 48 39 54 32 54 C24 54 18 48 18 40 C18 32 24 30 26 22 C30 28 30 32 32 34 C34 26 30 18 32 6 Z', 's:M12 12 L18 18 M52 12 L46 18 M8 34 L14 34 M50 34 L56 34']],
  cleric: ['#5a4a10', '#fff0a0', ['f:M28 8 L36 8 L36 22 L50 22 L50 30 L36 30 L36 56 L28 56 L28 30 L14 30 L14 22 L28 22 Z', 's:M32 4 m-22 22 a22 22 0 1 0 44 0 a22 22 0 1 0 -44 0']],
  paladin: ['#6a4a10', '#ffe080', ['f:M30 6 L34 6 L35 40 L32 46 L29 40 Z', 'f:M22 40 L42 40 L42 44 L22 44 Z M30 44 L34 44 L34 56 L30 56 Z', 'f:M29 16 C18 10 8 14 6 24 C14 20 22 22 29 26 Z M35 16 C46 10 56 14 58 24 C50 20 42 22 35 26 Z']],
  darkknight: ['#200818', '#e0405a', ['f:M32 8 C44 8 52 16 52 28 C52 36 48 40 44 42 L44 50 L20 50 L20 42 C16 40 12 36 12 28 C12 16 20 8 32 8 Z', 'f:M24 26 a5 6 0 1 0 0.1 0 Z M40 26 a5 6 0 1 0 0.1 0 Z', 's:M10 56 L54 8']],
  druid: ['#1a3a10', '#a8f080', ['f:M32 6 C44 14 52 28 46 44 C42 52 36 56 32 58 C28 56 22 52 18 44 C12 28 20 14 32 6 Z', 's:M32 14 L32 56 M32 26 L24 20 M32 34 L42 26 M32 42 L24 36']],
  monk: ['#5a3a10', '#ffd890', ['f:M22 20 L42 20 L44 40 C44 48 38 52 32 52 C26 52 20 48 20 40 Z', 'f:M22 20 L22 12 L28 12 L28 20 M28 12 L34 12 L34 20 M34 12 L40 12 L40 20', 's:M10 56 C20 50 44 50 54 56 M14 48 C22 44 42 44 50 48']],
  bard: ['#4a1a4a', '#ffb0ff', ['f:M24 40 m-10 0 a10 9 0 1 0 20 0 a10 9 0 1 0 -20 0', 's:M30 38 L46 10 M46 10 L52 14', 's:M50 30 C54 34 54 40 50 44 M54 24 C60 32 60 42 54 50']],
  rogue: ['#141418', '#a8a8c0', ['f:M32 6 C46 10 50 22 48 34 L40 30 C38 20 36 16 32 16 C28 16 26 20 24 30 L16 34 C14 22 18 10 32 6 Z', 'f:M30 26 L34 26 L35 48 L32 56 L29 48 Z', 'f:M24 44 L40 44 L40 48 L24 48 Z']],
  necromancer: ['#0a200e', '#5aff6a', ['f:M32 14 C42 14 48 20 48 30 C48 36 45 40 42 41 L42 48 L22 48 L22 41 C19 40 16 36 16 30 C16 20 22 14 32 14 Z', 'f:M25 28 a4 5 0 1 0 0.1 0 Z M39 28 a4 5 0 1 0 0.1 0 Z', 'f:M28 4 C30 8 34 8 36 4 C38 10 36 14 32 14 C28 14 26 10 28 4 Z']],
  elementalist: ['#3a1808', '#ffb060', ['f:M32 6 C36 14 42 16 40 24 C38 30 32 30 30 26 C28 20 30 14 32 6 Z', 'f:M10 38 C18 34 24 38 28 44 C22 48 14 46 10 38 Z', 'f:M54 38 C46 34 40 38 36 44 C42 48 50 46 54 38 Z', 's:M32 32 m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0 M32 40 L32 58']],
  enchanter: ['#2a1050', '#d8a0ff', ['f:M32 6 L44 22 L32 58 L20 22 Z', 's:M20 22 L44 22 M32 6 L28 22 L32 58 M32 6 L36 22', 's:M6 32 C16 20 48 20 58 32 C48 44 16 44 6 32']],
  beastmaster: ['#4a2a10', '#ffc070', ['f:M20 34 C14 34 12 28 16 24 C20 20 26 24 24 30 Z M44 34 C50 34 52 28 48 24 C44 20 38 24 40 30 Z M28 26 C24 24 24 16 28 14 C32 12 34 18 32 24 Z M36 26 C40 24 40 16 36 14 C32 12 30 18 32 24 Z', 'f:M32 32 C42 32 46 44 40 50 C36 54 28 54 24 50 C18 44 22 32 32 32 Z']],
  blunderbuss: ['#3a2410', '#ffb050', ['f:M10 46 L44 20 L48 25 L16 52 Z', 'f:M42 14 L56 8 L58 22 L50 26 Z', 's:M56 4 L62 0 M60 12 L64 12 M50 2 L50 -2', 'f:M8 48 L14 44 L20 52 L12 58 Z']],
  // races
  human: ['#3a2e1e', '#ffe0a0', ['f:M32 8 L46 14 L46 30 C46 42 40 50 32 54 C24 50 18 42 18 30 L18 14 Z', 's:M32 16 L32 46 M24 26 L40 26']],
  highelf: ['#20204a', '#c8d8ff', ['f:M32 6 L36 26 L56 20 L38 32 L56 44 L36 38 L32 58 L28 38 L8 44 L26 32 L8 20 L28 26 Z']],
  woodelf: ['#1a3a14', '#a8f080', ['f:M14 50 C14 26 30 12 52 12 C52 34 38 50 14 50 Z', 's:M14 50 L40 24']],
  dwarf: ['#3a2a14', '#ffc060', ['f:M18 12 L46 12 L46 26 L18 26 Z', 'f:M30 26 L34 26 L34 56 L30 56 Z', 'f:M14 14 L18 12 L18 26 L14 24 Z M50 14 L46 12 L46 26 L50 24 Z']],
  halfling: ['#3a2a10', '#ffd890', ['f:M32 10 C42 10 48 18 48 26 C48 32 44 36 40 38 L40 44 L24 44 L24 38 C20 36 16 32 16 26 C16 18 22 10 32 10 Z', 'f:M20 48 L44 48 L46 56 L18 56 Z', 's:M14 20 C10 14 12 8 18 8 M50 20 C54 14 52 8 46 8']],
  darkelf: ['#1a1030', '#d080ff', ['f:M32 6 L38 24 L56 26 L42 36 L46 56 L32 46 L18 56 L22 36 L8 26 L26 24 Z', 's:M32 18 m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0']],
  gnome: ['#2a1a3a', '#ffb0d0', ['f:M32 4 L44 30 L20 30 Z', 'f:M18 30 L46 30 L46 34 L18 34 Z', 'f:M32 36 C40 36 44 42 42 48 C40 54 24 54 22 48 C20 42 24 36 32 36 Z', 'f:M32 42 L36 50 L28 50 Z']],
  orc: ['#2a3a10', '#c8ff70', ['f:M12 20 C20 12 44 12 52 20 L48 44 C42 52 22 52 16 44 Z', 'f:M22 40 L18 30 L24 36 Z M42 40 L46 30 L40 36 Z', 'f:M24 26 a3 3 0 1 0 0.1 0 Z M40 26 a3 3 0 1 0 0.1 0 Z']],
};
export function crest(id, size = 64) {
  const d = C[id] || C.warrior, [field, glow, paths] = d, k = ++n;
  const body = paths.map(p => p.startsWith('f:') ? `<path d="${p.slice(2)}" fill="url(#cg${k})" stroke="#1a0e04" stroke-width="1.2" stroke-linejoin="round"/>` : `<path d="${p.slice(2)}" fill="none" stroke="url(#cg${k})" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  return `<svg viewBox="-4 -4 72 76" width="${size}" height="${size * 76 / 72}" xmlns="http://www.w3.org/2000/svg"><defs>
    <radialGradient id="cf${k}" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="${field}"/><stop offset="1" stop-color="#05030a"/></radialGradient>
    <linearGradient id="cr${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2c0"/><stop offset=".45" stop-color="#c8963a"/><stop offset="1" stop-color="#5a3a10"/></linearGradient>
    <linearGradient id="cg${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="${glow}"/><stop offset="1" stop-color="${glow}" stop-opacity=".75"/></linearGradient>
    <filter id="cb${k}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <path d="M32 -2 L62 8 L62 32 C62 52 48 64 32 70 C16 64 2 52 2 32 L2 8 Z" fill="url(#cr${k})"/>
    <path d="M32 2 L58 11 L58 32 C58 50 46 60 32 66 C18 60 6 50 6 32 L6 11 Z" fill="url(#cf${k})" stroke="#1a0e04" stroke-width="1"/>
    <path d="M32 5 L55 13 L55 32 C55 48 44 57 32 62 C20 57 9 48 9 32 L9 13 Z" fill="none" stroke="${glow}" stroke-opacity=".25" stroke-width="1"/>
    <g filter="url(#cb${k})" transform="translate(4.5 5) scale(.86)">${body}</g></svg>`;
}
