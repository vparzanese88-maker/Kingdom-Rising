// Painted SVG icons for items, gear, tools and abilities (no emoji). icon(name, opts) -> <svg> string.
import { ITEMS, TIERS, WEAPON_TYPES, RARITY } from './data.js';

let gid = 0;
const C = {
  steel: ['#f4f8ff', '#9aa6b4', '#4a5260'], gold: ['#fff2b0', '#e0a830', '#7a4a10'], wood: ['#c8935a', '#8a5a30', '#4a2c14'], dark: ['#6a5a50', '#3a2e28', '#1a1410'],
  leather: ['#c08a5a', '#8a5a34', '#4a2e18'], cloth: ['#f4ead4', '#cbb898', '#7a6a50'], red: ['#ff8a7a', '#c0302a', '#5a0e0a'], green: ['#bff5a0', '#4aa83a', '#1a4a14'],
  blue: ['#bfe4ff', '#3a8ad8', '#123a6a'], purple: ['#f0c8ff', '#9a4ad8', '#3a1060'], fire: ['#fff4a0', '#ff8a20', '#a8200a'], frost: ['#ffffff', '#8ae0ff', '#2a7ab0'], bone: ['#fffaf0', '#e0d4b8', '#8a7a5a'],
};
function grad(cs, dir = 'v') {
  const id = 'ig' + (gid++);
  const [x2, y2] = dir === 'v' ? [0, 1] : dir === 'h' ? [1, 0] : [1, 1];
  return { id, def: `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${cs[0]}"/><stop offset=".55" stop-color="${cs[1]}"/><stop offset="1" stop-color="${cs[2]}"/></linearGradient>` };
}
function rad(c1, c2) { const id = 'ir' + (gid++); return { id, def: `<radialGradient id="${id}" cx=".5" cy=".45" r=".6"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>` }; }
function shade(hex, k) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; const f = (v) => Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)))); return '#' + [f(r), f(g), f(b)].map(v => v.toString(16).padStart(2, '0')).join(''); }
const tri = (hex) => [shade(hex, 0.55), hex, shade(hex, -0.55)];
const OUT = 'stroke="#140c06" stroke-width="2" stroke-linejoin="round"';

// ---- shapes (each returns {defs, body}) ----
function blade(len, w, metal, rot = -45, cx = 32, cy = 32, hilt = C.gold) {
  const m = grad(metal, 'h'), h = grad(hilt), g = grad(C.leather);
  const top = cy - len / 2, bot = cy + len / 2;
  return { defs: m.def + h.def + g.def, body: `<g transform="rotate(${rot} ${cx} ${cy})"><path d="M${cx - w / 2} ${bot - 12} L${cx - w / 2} ${top + w} L${cx} ${top} L${cx + w / 2} ${top + w} L${cx + w / 2} ${bot - 12} Z" fill="url(#${m.id})" ${OUT}/><path d="M${cx} ${top + 3} L${cx} ${bot - 13}" stroke="rgba(255,255,255,.55)" stroke-width="1.2"/><rect x="${cx - w * 1.6}" y="${bot - 13}" width="${w * 3.2}" height="4" rx="1.5" fill="url(#${h.id})" ${OUT}/><rect x="${cx - 2.2}" y="${bot - 9}" width="4.4" height="8" fill="url(#${g.id})" ${OUT}/><circle cx="${cx}" cy="${bot}" r="2.8" fill="url(#${h.id})" ${OUT}/></g>` };
}
function haft(len, rot, wood = C.wood, cx = 32, cy = 32) { const g = grad(wood, 'h'); return { defs: g.def, body: `<g transform="rotate(${rot} ${cx} ${cy})"><rect x="${cx - 2.2}" y="${cy - len / 2}" width="4.4" height="${len}" rx="2" fill="url(#${g.id})" ${OUT}/></g>` }; }
function cat(...parts) { return { defs: parts.map(p => p.defs).join(''), body: parts.map(p => p.body).join('') }; }
const S = {
  sword: (o) => blade(50, 8, o.metal || C.steel),
  greatsword: (o) => blade(56, 10, o.metal || C.steel, -45),
  dagger: (o) => blade(32, 7, o.metal || C.steel, -45),
  daggers: (o) => cat(blade(34, 7, o.metal || C.steel, -40, 26, 32), blade(34, 7, o.metal || C.steel, 40, 38, 32)),
  mace: (o) => { const m = grad(o.metal || C.steel); return cat(haft(40, -45), { defs: m.def, body: `<g transform="rotate(-45 32 32)"><circle cx="32" cy="14" r="9" fill="url(#${m.id})" ${OUT}/>${[0, 60, 120, 180, 240, 300].map(a => `<path d="M32 14 L${32 + Math.cos(a * Math.PI / 180) * 13} ${14 + Math.sin(a * Math.PI / 180) * 13}" stroke="#140c06" stroke-width="5" stroke-linecap="round"/><path d="M32 14 L${32 + Math.cos(a * Math.PI / 180) * 12} ${14 + Math.sin(a * Math.PI / 180) * 12}" stroke="url(#${m.id})" stroke-width="3" stroke-linecap="round"/>`).join('')}<circle cx="29" cy="11" r="2.5" fill="rgba(255,255,255,.6)"/></g>` }); },
  axe: (o) => { const m = grad(o.metal || C.steel, 'h'); return cat(haft(48, -40), { defs: m.def, body: `<g transform="rotate(-40 32 32)"><path d="M34 10 Q50 8 52 22 Q46 30 34 22 Z" fill="url(#${m.id})" ${OUT}/><path d="M36 12 Q48 11 50 21" stroke="rgba(255,255,255,.6)" stroke-width="1.4" fill="none"/></g>` }); },
  greataxe: (o) => { const m = grad(o.metal || C.steel, 'h'); return cat(haft(54, -40), { defs: m.def, body: `<g transform="rotate(-40 32 32)"><path d="M34 6 Q54 6 56 22 Q48 32 34 24 Z" fill="url(#${m.id})" ${OUT}/><path d="M30 6 Q10 6 8 22 Q16 32 30 24 Z" fill="url(#${m.id})" ${OUT}/></g>` }); },
  hammer: (o) => { const m = grad(o.metal || C.steel); return cat(haft(52, -40), { defs: m.def, body: `<g transform="rotate(-40 32 32)"><rect x="17" y="6" width="30" height="16" rx="3" fill="url(#${m.id})" ${OUT}/><rect x="20" y="9" width="24" height="3" fill="rgba(255,255,255,.45)"/></g>` }); },
  spear: (o) => { const m = grad(o.metal || C.steel, 'h'); return cat(haft(58, -45), { defs: m.def, body: `<g transform="rotate(-45 32 32)"><path d="M32 0 L38 14 L32 20 L26 14 Z" fill="url(#${m.id})" ${OUT}/><rect x="29" y="19" width="6" height="3" fill="#7a4a10" ${OUT}/></g>` }); },
  shield: (o) => { const r = grad(o.col ? tri(o.col) : C.red), m = grad(o.metal || C.steel); return { defs: r.def + m.def, body: `<path d="M32 6 L54 12 Q54 40 32 58 Q10 40 10 12 Z" fill="url(#${r.id})" ${OUT}/><path d="M32 10 L50 15 Q50 38 32 53 Q14 38 14 15 Z" fill="none" stroke="url(#${m.id})" stroke-width="3"/><path d="M32 14 V50 M18 26 H46" stroke="#e8b84a" stroke-width="4"/><circle cx="32" cy="27" r="5" fill="url(#${m.id})" ${OUT}/></g>`.replace('</g>', '') }; },
  swordshield: (o) => cat(S.shield({ col: '#a02a2a' }), blade(46, 7, o.metal || C.steel, 35, 38, 30)),
  swordmace: (o) => cat(blade(46, 7, o.metal || C.steel, -35, 26, 32), (() => { const m = grad(o.metal || C.steel); return { defs: m.def, body: `<g transform="rotate(35 38 32)"><rect x="35.8" y="20" width="4.4" height="34" rx="2" fill="#6a4020" ${OUT}/><circle cx="38" cy="16" r="7" fill="url(#${m.id})" ${OUT}/></g>` }; })()),
  maceshield: (o) => cat(S.shield({ col: '#2a4a8a' }), (() => { const m = grad(o.metal || C.steel); return { defs: m.def, body: `<g transform="rotate(35 40 32)"><rect x="37.8" y="22" width="4.4" height="32" rx="2" fill="#6a4020" ${OUT}/><circle cx="40" cy="18" r="7.5" fill="url(#${m.id})" ${OUT}/></g>` }; })()),
  handaxes: (o) => cat({ defs: '', body: `<g transform="translate(-6 0) scale(.9) translate(3 3)">` }, S.axe(o), { defs: '', body: '</g><g transform="translate(70 0) scale(-.9 .9) translate(3 3)">' }, S.axe(o), { defs: '', body: '</g>' }),
  bow: (o) => { const w = grad(C.wood, 'h'); return { defs: w.def, body: `<path d="M18 6 Q52 32 18 58" fill="none" stroke="#140c06" stroke-width="8" stroke-linecap="round"/><path d="M18 6 Q52 32 18 58" fill="none" stroke="url(#${w.id})" stroke-width="5" stroke-linecap="round"/><path d="M18 6 L18 58" stroke="#efe6d0" stroke-width="1.4"/><path d="M14 32 L56 32" stroke="#6a4a2a" stroke-width="2.4"/><path d="M56 32 L49 28 L49 36 Z" fill="#c8ccd4" ${OUT}/><path d="M16 32 l-4 -4 M16 32 l-4 4" stroke="#c03030" stroke-width="2.4"/>` }; },
  staff: (o) => { const w = grad(C.dark, 'h'), orb = rad('#ffffff', o.orb || '#ff8a20'); return { defs: w.def + orb.def, body: `<g transform="rotate(-35 32 32)"><rect x="29.8" y="16" width="4.4" height="46" rx="2" fill="url(#${w.id})" ${OUT}/><path d="M26 18 Q32 4 38 18" fill="none" stroke="#3a2a1a" stroke-width="3"/><circle cx="32" cy="12" r="8" fill="url(#${orb.id})" stroke="#140c06" stroke-width="1.5"/><circle cx="32" cy="12" r="12" fill="${o.orb || '#ff8a20'}" opacity=".25"/><circle cx="29" cy="9" r="2.4" fill="#fff" opacity=".8"/></g>` }; },
  // armour
  helm: (o) => { const m = grad(o.metal || C.steel); return { defs: m.def, body: `<path d="M12 40 Q12 10 32 8 Q52 10 52 40 L46 44 L46 30 L36 30 L36 50 L28 50 L28 30 L18 30 L18 44 Z" fill="url(#${m.id})" ${OUT}/><path d="M18 18 Q32 10 46 18" stroke="rgba(255,255,255,.5)" stroke-width="2" fill="none"/>` }; },
  hood: (o) => { const g = grad(o.col ? tri(o.col) : C.green); return { defs: g.def, body: `<path d="M32 4 Q52 14 50 44 L44 56 L20 56 L14 44 Q12 14 32 4 Z" fill="url(#${g.id})" ${OUT}/><path d="M22 30 Q32 18 42 30 L42 46 Q32 52 22 46 Z" fill="#1a1410"/>` }; },
  hat: (o) => { const g = grad(o.col ? tri(o.col) : C.blue); return { defs: g.def, body: `<path d="M30 4 Q36 6 44 40 L20 40 Q26 14 30 4 Z" fill="url(#${g.id})" ${OUT}/><ellipse cx="32" cy="44" rx="26" ry="7" fill="url(#${g.id})" ${OUT}/><rect x="20" y="36" width="24" height="5" fill="#e8b84a" ${OUT}/>` }; },
  chest: (o) => { const g = grad(o.col ? tri(o.col) : C.steel); return { defs: g.def, body: `<path d="M18 8 L26 8 Q32 14 38 8 L46 8 L58 18 L52 30 L48 26 L48 58 L16 58 L16 26 L12 30 L6 18 Z" fill="url(#${g.id})" ${OUT}/><path d="M32 16 V56 M16 40 H48" stroke="rgba(0,0,0,.25)" stroke-width="2"/>` }; },
  robe: (o) => { const g = grad(o.col ? tri(o.col) : C.purple); return { defs: g.def, body: `<path d="M20 6 L26 6 Q32 12 38 6 L44 6 L56 20 L50 28 L46 24 L54 60 L10 60 L18 24 L14 28 L8 20 Z" fill="url(#${g.id})" ${OUT}/><path d="M32 12 V60" stroke="#e8b84a" stroke-width="3"/>` }; },
  shoulders: (o) => { const g = grad(o.col ? tri(o.col) : C.steel); return { defs: g.def, body: `<path d="M4 38 Q6 16 26 16 Q30 30 26 42 Z" fill="url(#${g.id})" ${OUT}/><path d="M60 38 Q58 16 38 16 Q34 30 38 42 Z" fill="url(#${g.id})" ${OUT}/><path d="M8 32 Q12 22 22 22 M56 32 Q52 22 42 22" stroke="rgba(255,255,255,.4)" stroke-width="2" fill="none"/>` }; },
  wrists: (o) => { const g = grad(o.col ? tri(o.col) : C.leather, 'h'); return { defs: g.def, body: `<path d="M14 16 L30 12 L32 50 L16 54 Z" fill="url(#${g.id})" ${OUT}/><path d="M34 12 L50 16 L48 54 L32 50 Z" fill="url(#${g.id})" ${OUT}/><path d="M16 24 L31 21 M16 42 L31 39 M34 21 L48 24 M34 39 L48 42" stroke="#e8b84a" stroke-width="2"/>` }; },
  hands: (o) => { const g = grad(o.col ? tri(o.col) : C.leather); return { defs: g.def, body: `<path d="M18 58 L18 30 Q18 26 22 26 L22 12 Q22 8 26 8 Q29 8 29 12 L29 24 L30 8 Q30 4 34 4 Q37 4 37 8 L37 24 L38 10 Q38 6 42 6 Q45 6 45 10 L45 28 L48 22 Q51 18 54 22 L48 40 Q44 48 44 58 Z" fill="url(#${g.id})" ${OUT}/><rect x="18" y="48" width="26" height="6" fill="rgba(0,0,0,.3)"/>` }; },
  waist: (o) => { const g = grad(o.col ? tri(o.col) : C.leather), b = grad(C.gold); return { defs: g.def + b.def, body: `<path d="M4 24 Q32 32 60 24 L60 38 Q32 46 4 38 Z" fill="url(#${g.id})" ${OUT}/><rect x="24" y="24" width="16" height="18" rx="3" fill="url(#${b.id})" ${OUT}/><rect x="29" y="29" width="6" height="8" fill="#140c06"/>` }; },
  legs: (o) => { const g = grad(o.col ? tri(o.col) : C.leather); return { defs: g.def, body: `<path d="M16 6 L48 6 L50 58 L36 58 L32 22 L28 58 L14 58 Z" fill="url(#${g.id})" ${OUT}/><rect x="16" y="6" width="32" height="6" fill="rgba(0,0,0,.3)"/>` }; },
  boots: (o) => { const g = grad(o.col ? tri(o.col) : C.leather); return { defs: g.def, body: `<path d="M16 6 L34 6 L34 38 L52 44 Q58 48 56 56 L12 56 L14 38 Z" fill="url(#${g.id})" ${OUT}/><path d="M12 50 H56" stroke="#140c06" stroke-width="3"/><path d="M16 12 H34" stroke="rgba(255,255,255,.35)" stroke-width="2"/>` }; },
  ring: (o) => { const g = grad(o.metal || C.gold), gem = rad('#ffffff', o.gem || '#e04040'); return { defs: g.def + gem.def, body: `<ellipse cx="32" cy="38" rx="18" ry="16" fill="none" stroke="#140c06" stroke-width="10"/><ellipse cx="32" cy="38" rx="18" ry="16" fill="none" stroke="url(#${g.id})" stroke-width="6"/><path d="M32 8 L42 18 L32 28 L22 18 Z" fill="url(#${gem.id})" ${OUT}/>` }; },
  amulet: (o) => { const g = grad(o.metal || C.gold), gem = rad('#ffffff', o.gem || '#3a8ad8'); return { defs: g.def + gem.def, body: `<path d="M12 6 Q32 34 52 6" fill="none" stroke="#c8a040" stroke-width="2.5"/><circle cx="32" cy="40" r="14" fill="url(#${g.id})" ${OUT}/><circle cx="32" cy="40" r="8" fill="url(#${gem.id})" stroke="#140c06" stroke-width="1.5"/>` }; },
  cloak: (o) => { const g = grad(o.col ? tri(o.col) : C.red); return { defs: g.def, body: `<path d="M22 6 Q32 12 42 6 L54 58 Q32 52 10 58 Z" fill="url(#${g.id})" ${OUT}/><path d="M26 16 L20 54 M38 16 L44 54" stroke="rgba(0,0,0,.25)" stroke-width="2"/><circle cx="32" cy="10" r="4" fill="#e8b84a" ${OUT}/>` }; },
  charm: (o) => { const g = rad('#ffffff', o.gem || '#a050ff'); return { defs: g.def, body: `<path d="M32 4 L32 16" stroke="#8a6a3a" stroke-width="2"/><path d="M32 16 L46 34 L32 60 L18 34 Z" fill="url(#${g.id})" ${OUT}/><path d="M32 16 L32 60 M18 34 H46" stroke="rgba(255,255,255,.4)" stroke-width="1.5"/>` }; },
  // materials
  log: () => { const w = grad(C.wood); return { defs: w.def, body: `<g transform="rotate(-20 32 32)"><rect x="8" y="22" width="44" height="20" rx="4" fill="url(#${w.id})" ${OUT}/><ellipse cx="52" cy="32" rx="6" ry="10" fill="#e0b880" ${OUT}/><ellipse cx="52" cy="32" rx="3" ry="5" fill="none" stroke="#a07a4a"/><path d="M14 28 H40 M18 36 H44" stroke="rgba(0,0,0,.25)" stroke-width="1.5"/></g>` }; },
  planks: () => { const w = grad(['#e8c08a', '#b88a50', '#6a4a24']); return { defs: w.def, body: `<rect x="8" y="12" width="48" height="11" rx="1" fill="url(#${w.id})" ${OUT}/><rect x="8" y="27" width="48" height="11" rx="1" fill="url(#${w.id})" ${OUT}/><rect x="8" y="42" width="48" height="11" rx="1" fill="url(#${w.id})" ${OUT}/>` }; },
  rock: (o) => { const g = grad(o.col ? tri(o.col) : ['#c8c4bc', '#8a847c', '#4a4640'], 'd'); return { defs: g.def, body: `<path d="M10 44 L16 22 L30 12 L48 16 L56 34 L48 52 L22 54 Z" fill="url(#${g.id})" ${OUT}/><path d="M16 22 L30 30 L48 16 M30 30 L22 54" stroke="rgba(0,0,0,.2)" stroke-width="1.5" fill="none"/>` }; },
  ore: (o) => { const g = grad(['#a8a49c', '#6a665e', '#3a3630'], 'd'), c = grad(tri(o.col || '#d0844c')); return { defs: g.def + c.def, body: `<path d="M8 46 L14 24 L30 14 L48 18 L56 36 L46 54 L20 54 Z" fill="url(#${g.id})" ${OUT}/><path d="M22 30 L30 22 L34 34 Z M36 38 L46 32 L44 46 Z M18 42 L26 40 L22 50 Z" fill="url(#${c.id})" stroke="#140c06" stroke-width="1"/>` }; },
  ingot: (o) => { const g = grad(tri(o.col || '#d0844c')); return { defs: g.def, body: `<path d="M6 42 L16 24 L56 24 L58 42 Z" fill="url(#${g.id})" ${OUT}/><path d="M6 42 L58 42 L54 50 L10 50 Z" fill="${shade(o.col || '#d0844c', -0.4)}" ${OUT}/><path d="M18 28 H52" stroke="rgba(255,255,255,.55)" stroke-width="2"/>` }; },
  cotton: () => { const g = rad('#ffffff', '#d8d4cc'); return { defs: g.def, body: `<path d="M32 60 L32 40" stroke="#5a7a3a" stroke-width="3"/>${[[22, 26], [42, 26], [32, 18], [26, 38], [38, 38]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="11" fill="url(#${g.id})" ${OUT}/>`).join('')}` }; },
  cloth: (o) => { const g = grad(tri(o.col || '#e8dfc8')); return { defs: g.def, body: `<rect x="10" y="16" width="40" height="32" rx="16" fill="url(#${g.id})" ${OUT}/><ellipse cx="50" cy="32" rx="6" ry="16" fill="${shade(o.col || '#e8dfc8', 0.3)}" ${OUT}/><ellipse cx="50" cy="32" rx="2" ry="6" fill="${shade(o.col || '#e8dfc8', -0.4)}"/><path d="M14 24 H44 M14 40 H44" stroke="rgba(0,0,0,.15)"/>` }; },
  hide: (o) => { const g = grad(tri(o.col || '#a8784a'), 'd'); return { defs: g.def, body: `<path d="M14 8 Q32 16 50 8 Q56 20 52 30 Q60 40 52 54 Q32 48 12 54 Q4 40 12 30 Q8 20 14 8 Z" fill="url(#${g.id})" ${OUT}/>` }; },
  web: () => ({ defs: '', body: `<circle cx="32" cy="32" r="26" fill="#2a2430" ${OUT}/>${[0, 45, 90, 135].map(a => `<path d="M${32 - Math.cos(a * Math.PI / 180) * 24} ${32 - Math.sin(a * Math.PI / 180) * 24} L${32 + Math.cos(a * Math.PI / 180) * 24} ${32 + Math.sin(a * Math.PI / 180) * 24}" stroke="#f0f0f8" stroke-width="1.3"/>`).join('')}${[8, 14, 20].map(r => `<circle cx="32" cy="32" r="${r}" fill="none" stroke="#f0f0f8" stroke-width="1.3"/>`).join('')}` }),
  herb: () => { const g = grad(C.green); return { defs: g.def, body: `<path d="M32 60 Q30 40 32 24" stroke="#2a5a1a" stroke-width="3" fill="none"/>${[[-1, 34], [1, 30], [-1, 22], [1, 16]].map(([s, y]) => `<path d="M32 ${y} Q${32 + s * 22} ${y - 14} ${32 + s * 20} ${y + 2} Q${32 + s * 10} ${y + 6} 32 ${y}" fill="url(#${g.id})" ${OUT}/>`).join('')}<circle cx="32" cy="12" r="5" fill="#c8ff8a" ${OUT}/>` }; },
  meat: () => { const g = grad(['#ff9a8a', '#c04030', '#6a1a10']); return { defs: g.def, body: `<path d="M10 30 Q12 10 32 10 Q50 12 50 30 Q48 46 30 48 Q12 46 10 30 Z" fill="url(#${g.id})" ${OUT}/><path d="M42 42 L54 54" stroke="#f0e8d8" stroke-width="7" stroke-linecap="round"/><circle cx="56" cy="56" r="4" fill="#f0e8d8" ${OUT}/><path d="M18 24 Q28 18 40 24" stroke="#f0d0c0" stroke-width="2" fill="none"/>` }; },
  roast: () => { const g = grad(['#e8a860', '#a05a20', '#4a2408']); return { defs: g.def, body: `<path d="M10 30 Q12 10 32 10 Q50 12 50 30 Q48 46 30 48 Q12 46 10 30 Z" fill="url(#${g.id})" ${OUT}/><path d="M42 42 L54 54" stroke="#f0e8d8" stroke-width="7" stroke-linecap="round"/><circle cx="56" cy="56" r="4" fill="#f0e8d8" ${OUT}/><path d="M20 14 q-2 -6 2 -10 M30 12 q-2 -6 2 -10" stroke="#ddd" stroke-width="1.5" fill="none" opacity=".7"/>` }; },
  crab: () => { const g = grad(C.red); return { defs: g.def, body: `<ellipse cx="32" cy="38" rx="18" ry="12" fill="url(#${g.id})" ${OUT}/><path d="M14 30 Q6 20 12 12 Q18 16 16 24 M50 30 Q58 20 52 12 Q46 16 48 24" fill="url(#${g.id})" ${OUT}/><path d="M16 44 L6 52 M18 48 L10 58 M48 44 L58 52 M46 48 L54 58" stroke="#140c06" stroke-width="3"/><circle cx="26" cy="30" r="2.5" fill="#140c06"/><circle cx="38" cy="30" r="2.5" fill="#140c06"/>` }; },
  cake: () => { const g = grad(['#f8d890', '#d09040', '#7a4a10']); return { defs: g.def, body: `<ellipse cx="32" cy="40" rx="24" ry="12" fill="url(#${g.id})" ${OUT}/><ellipse cx="32" cy="34" rx="24" ry="12" fill="url(#${g.id})" ${OUT}/><circle cx="26" cy="32" r="2" fill="#c04030"/><circle cx="38" cy="34" r="2" fill="#4a8a3a"/>` }; },
  bandage: () => { const g = grad(C.cloth); return { defs: g.def, body: `<rect x="10" y="22" width="44" height="20" rx="10" fill="url(#${g.id})" ${OUT} transform="rotate(-30 32 32)"/><path d="M26 26 h12 M32 20 v12" stroke="#c03030" stroke-width="4" transform="rotate(-30 32 32)"/>` }; },
  bone: () => { const g = grad(C.bone); return { defs: g.def, body: `<g transform="rotate(-40 32 32)"><rect x="27" y="12" width="10" height="40" fill="url(#${g.id})" ${OUT}/><circle cx="27" cy="12" r="6" fill="url(#${g.id})" ${OUT}/><circle cx="37" cy="12" r="6" fill="url(#${g.id})" ${OUT}/><circle cx="27" cy="52" r="6" fill="url(#${g.id})" ${OUT}/><circle cx="37" cy="52" r="6" fill="url(#${g.id})" ${OUT}/></g>` }; },
  fang: () => { const g = grad(C.bone); return { defs: g.def, body: `<path d="M20 8 Q44 10 44 20 Q40 44 26 58 Q30 36 20 8 Z" fill="url(#${g.id})" ${OUT}/>` }; },
  ember: () => { const g = rad('#fff8c0', '#ff4a00'); return { defs: g.def, body: `<circle cx="32" cy="34" r="22" fill="#ff6a10" opacity=".25"/><path d="M32 6 Q48 22 44 38 Q40 54 32 56 Q24 54 20 38 Q16 22 32 6 Z" fill="url(#${g.id})" ${OUT}/><path d="M32 22 Q38 32 34 44 Q28 40 32 22 Z" fill="#fff4b0"/>` }; },
  badge: () => { const g = grad(C.dark); return { defs: g.def, body: `<path d="M32 6 L54 14 Q54 40 32 58 Q10 40 10 14 Z" fill="url(#${g.id})" ${OUT}/><path d="M22 24 L42 40 M42 24 L22 40" stroke="#c03030" stroke-width="5" stroke-linecap="round"/>` }; },
  potion: (o) => { const g = rad(shade(o.col || '#ff4040', 0.6), o.col || '#ff4040'), gl = grad(['#ffffff', '#cfe4f0', '#7a9aaa']); return { defs: g.def + gl.def, body: `<rect x="26" y="4" width="12" height="6" rx="2" fill="#8a5a30" ${OUT}/><path d="M27 10 L37 10 L37 20 Q52 26 52 42 Q52 58 32 58 Q12 58 12 42 Q12 26 27 20 Z" fill="url(#${gl.id})" opacity=".55" ${OUT}/><path d="M15 38 Q32 32 49 38 Q50 56 32 56 Q14 56 15 38 Z" fill="url(#${g.id})"/><ellipse cx="22" cy="32" rx="3" ry="6" fill="#fff" opacity=".6"/>` }; },
  // tools
  hatchet: (o) => S.axe(o), pickaxe: (o) => { const m = grad(o.metal || C.steel); return cat(haft(50, -40), { defs: m.def, body: `<g transform="rotate(-40 32 32)"><path d="M6 18 Q32 2 58 18 L56 22 Q32 10 8 22 Z" fill="url(#${m.id})" ${OUT}/></g>` }); },
  knife: (o) => blade(34, 8, o.metal || C.steel, -45),
};
// ---- ability art ----
const AB = {
  adrenaline: '<path d="M32 58 Q6 40 8 22 Q10 8 22 8 Q30 8 32 18 Q34 8 42 8 Q54 8 56 22 Q58 40 32 58 Z" fill="#c82828" stroke="#140c06" stroke-width="2"/><path d="M36 12 L22 34 L32 34 L26 52 L44 28 L34 28 Z" fill="#ffe24a" stroke="#140c06" stroke-width="1.5"/>',
  tourniquet: '<rect x="8" y="24" width="48" height="16" rx="6" fill="#efe4cc" stroke="#140c06" stroke-width="2"/><path d="M8 32 H56" stroke="#c03030" stroke-width="3" stroke-dasharray="4 3"/><rect x="26" y="14" width="12" height="36" rx="3" fill="#8a5a30" stroke="#140c06" stroke-width="2"/><path d="M44 10 Q56 8 56 20" stroke="#ff6a6a" stroke-width="3" fill="none"/><path d="M50 8 l6 2 l-2 6" stroke="#ff6a6a" stroke-width="3" fill="none"/>',
  secondwind: '<path d="M6 20 H38 Q48 20 48 12 Q48 6 42 6 M6 32 H52 Q60 32 60 40 Q60 48 52 48 M6 44 H30" stroke="#bfffd0" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="16" cy="54" r="5" fill="#f2cc50" stroke="#140c06" stroke-width="1.5"/>',
  fielddress: '<path d="M32 6 L54 14 Q54 40 32 58 Q10 40 10 14 Z" fill="#3a6a3a" stroke="#140c06" stroke-width="2"/><path d="M32 18 V46 M18 32 H46" stroke="#f4f0e4" stroke-width="8" stroke-linecap="round"/><path d="M32 18 V46 M18 32 H46" stroke="#e03838" stroke-width="4" stroke-linecap="round"/>',
  manasurge: '<circle cx="32" cy="34" r="24" fill="#3f8ad8" opacity=".25"/><path d="M32 4 Q52 30 48 42 Q44 58 32 58 Q20 58 16 42 Q12 30 32 4 Z" fill="#4a9aff" stroke="#140c06" stroke-width="2"/><path d="M30 22 L22 38 L30 38 L26 52 L42 32 L34 32 L38 22 Z" fill="#fff" opacity=".9"/>',
  icebarrier: '<path d="M32 4 L54 12 Q54 40 32 60 Q10 40 10 12 Z" fill="#bfefff" stroke="#2a7ab0" stroke-width="3" opacity=".9"/><path d="M32 12 L32 50 M20 22 L44 42 M44 22 L20 42" stroke="#ffffff" stroke-width="2.5"/><path d="M14 14 L32 8 L50 14" stroke="#ffffff" stroke-width="2" fill="none"/>',
  charge: '<path d="M8 40 L36 40 L36 50 L58 32 L36 14 L36 24 L8 24 Z" fill="#fff4d0" stroke="#140c06" stroke-width="2"/><path d="M4 30 H16 M2 36 H14" stroke="#ffd080" stroke-width="3"/>',
  battlecry: '<path d="M10 40 Q12 26 28 22 L50 12 L54 46 L30 40 Q20 44 18 52 Z" fill="#e8b860" stroke="#140c06" stroke-width="2"/><path d="M50 12 Q60 28 54 46" fill="none" stroke="#140c06" stroke-width="2"/><path d="M56 20 Q62 29 58 38" stroke="#fff" stroke-width="2" fill="none"/>',
  earthsplitter: '<path d="M4 46 L22 42 L28 50 L36 40 L46 48 L60 42 L60 60 L4 60 Z" fill="#7a5a3a" stroke="#140c06" stroke-width="2"/><path d="M30 44 L26 54 L32 58 M36 42 L42 56" stroke="#ff8a20" stroke-width="2.5" fill="none"/><path d="M22 8 L42 8 L44 30 L20 30 Z" fill="#c8ccd4" stroke="#140c06" stroke-width="2"/><path d="M32 30 V40" stroke="#6a4020" stroke-width="4"/>',
  spectral: '<path d="M6 58 L50 14" stroke="#80ffd0" stroke-width="5"/><path d="M50 14 L58 6 L56 20 Z M50 14 L58 6 L44 8 Z" fill="#e0fff4" stroke="#140c06" stroke-width="1.5"/><path d="M10 54 l-6 0 M10 54 l0 6" stroke="#30ffa0" stroke-width="3"/><circle cx="30" cy="34" r="16" fill="#30ffa0" opacity=".15"/>',
  smokeroll: '<circle cx="22" cy="38" r="14" fill="#8a8aa0"/><circle cx="40" cy="34" r="16" fill="#a0a0b8"/><circle cx="32" cy="22" r="12" fill="#c0c0d0"/><circle cx="46" cy="46" r="10" fill="#707088"/>',
  fury: '<path d="M14 54 L24 14 M28 56 L36 12 M42 56 L48 16" stroke="#140c06" stroke-width="7" stroke-linecap="round"/><path d="M14 54 L24 14 M28 56 L36 12 M42 56 L48 16" stroke="#ff5a4a" stroke-width="4" stroke-linecap="round"/>',
  frostnova: '<g stroke="#ffffff" stroke-width="3.5" stroke-linecap="round">' + [0, 60, 120].map(a => `<path transform="rotate(${a} 32 32)" d="M32 6 V58 M26 12 L32 18 L38 12 M26 52 L32 46 L38 52"/>`).join('') + '</g><circle cx="32" cy="32" r="6" fill="#bfefff"/>',
  blink: '<path d="M32 6 L38 26 L58 32 L38 38 L32 58 L26 38 L6 32 L26 26 Z" fill="#e0b0ff" stroke="#140c06" stroke-width="2"/><circle cx="32" cy="32" r="6" fill="#fff"/>',
  chain: '<path d="M38 4 L18 34 L30 34 L22 60 L48 26 L34 26 L44 4 Z" fill="#fff8a0" stroke="#140c06" stroke-width="2"/>',
  area: '<path d="M32 10 A22 22 0 1 1 10 32" fill="none" stroke="#fff" stroke-width="5"/><path d="M10 32 L4 24 L18 24 Z" fill="#fff"/><circle cx="32" cy="32" r="5" fill="#ffd080"/>',
  meteor: '<path d="M6 6 L34 30" stroke="#ff8a20" stroke-width="10" stroke-linecap="round" opacity=".7"/><path d="M14 4 L36 24" stroke="#ffe080" stroke-width="5" stroke-linecap="round"/><circle cx="40" cy="38" r="15" fill="#4a2a1a" stroke="#140c06" stroke-width="2"/><path d="M32 32 L40 40 L48 34 M38 46 L44 42" stroke="#ff6a10" stroke-width="2.5" fill="none"/>',
  rain: '<path d="M6 16 Q16 4 30 10 Q44 2 58 14 Q60 22 48 22 L14 22 Q4 22 6 16 Z" fill="#a0b0c0" stroke="#140c06" stroke-width="1.5"/>' + [14, 24, 34, 44, 54].map((x, i) => `<path d="M${x} ${28 + (i % 2) * 6} V${50 + (i % 2) * 6}" stroke="#e0f0d8" stroke-width="2.5"/><path d="M${x - 3} ${46 + (i % 2) * 6} L${x} ${52 + (i % 2) * 6} L${x + 3} ${46 + (i % 2) * 6}" fill="#e0f0d8"/>`).join(''),
  blizzard: '<path d="M6 18 Q16 6 30 12 Q44 4 58 16 Q60 24 48 24 L14 24 Q4 24 6 18 Z" fill="#d0e8f8" stroke="#140c06" stroke-width="1.5"/>' + [[16, 36], [30, 44], [44, 34], [22, 54], [40, 54]].map(([x, y]) => `<g stroke="#fff" stroke-width="2.4" stroke-linecap="round"><path d="M${x - 5} ${y} H${x + 5} M${x} ${y - 5} V${y + 5} M${x - 3.5} ${y - 3.5} L${x + 3.5} ${y + 3.5} M${x + 3.5} ${y - 3.5} L${x - 3.5} ${y + 3.5}"/></g>`).join(''),
  nova: '<circle cx="32" cy="32" r="24" fill="none" stroke="#d090ff" stroke-width="3"/><circle cx="32" cy="32" r="16" fill="none" stroke="#b060ff" stroke-width="3" opacity=".7"/><circle cx="32" cy="32" r="9" fill="#f4d8ff" stroke="#140c06" stroke-width="2"/>',
  twinfury: '<path d="M10 54 L50 8 M14 8 L54 54" stroke="#140c06" stroke-width="8" stroke-linecap="round"/><path d="M10 54 L50 8 M14 8 L54 54" stroke="#e8eef8" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="31" r="8" fill="#ff6a4a" opacity=".6"/>',
  block: null, swap: '<path d="M12 22 H46 L38 14 M52 42 H18 L26 50" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  crown: '<path d="M8 48 L12 18 L24 32 L32 12 L40 32 L52 18 L56 48 Z" fill="#ffd040" stroke="#140c06" stroke-width="2"/><rect x="8" y="48" width="48" height="8" fill="#e0a020" stroke="#140c06" stroke-width="2"/><circle cx="32" cy="38" r="4" fill="#e03030"/>',
  heart: '<path d="M32 56 Q6 38 8 22 Q10 8 22 8 Q30 8 32 18 Q34 8 42 8 Q54 8 56 22 Q58 38 32 56 Z" fill="#e03838" stroke="#140c06" stroke-width="2"/><path d="M16 20 Q18 14 24 14" stroke="#ffb0b0" stroke-width="3" fill="none"/>',
  bolt: '<path d="M38 4 L14 36 L30 36 L24 60 L50 26 L34 26 Z" fill="#f2cc50" stroke="#140c06" stroke-width="2"/>',
  mana: '<path d="M32 6 Q52 32 48 44 Q44 58 32 58 Q20 58 16 44 Q12 32 32 6 Z" fill="#3f8ad8" stroke="#140c06" stroke-width="2"/><path d="M24 40 Q24 48 30 50" stroke="#bfe4ff" stroke-width="3" fill="none"/>',
  wind: '<path d="M6 22 H40 Q50 22 50 14 Q50 8 44 8 M6 34 H52 Q60 34 60 42 Q60 50 52 50 M6 46 H30" stroke="#e8f4ff" stroke-width="4.5" fill="none" stroke-linecap="round"/>',
  crit: '<circle cx="32" cy="32" r="24" fill="none" stroke="#ff5a4a" stroke-width="4"/><circle cx="32" cy="32" r="13" fill="none" stroke="#ff5a4a" stroke-width="4"/><circle cx="32" cy="32" r="4" fill="#fff"/><path d="M32 2 V14 M32 50 V62 M2 32 H14 M50 32 H62" stroke="#fff" stroke-width="3"/>',
  fist: '<path d="M14 30 Q14 18 24 18 L44 18 Q52 18 52 28 L52 44 Q52 56 38 56 L26 56 Q14 56 14 44 Z" fill="#e0b080" stroke="#140c06" stroke-width="2"/><path d="M24 18 V32 M34 18 V32 M44 18 V32 M14 32 H40" stroke="#140c06" stroke-width="2"/>',
  scroll: '<rect x="14" y="10" width="36" height="44" fill="#f0e0b8" stroke="#140c06" stroke-width="2"/><rect x="10" y="6" width="44" height="8" rx="4" fill="#c8a870" stroke="#140c06" stroke-width="2"/><rect x="10" y="50" width="44" height="8" rx="4" fill="#c8a870" stroke="#140c06" stroke-width="2"/><path d="M20 22 H44 M20 30 H44 M20 38 H38" stroke="#7a5a3a" stroke-width="2"/>',
  skull: '<path d="M32 6 Q54 6 54 28 Q54 38 46 42 L46 54 L18 54 L18 42 Q10 38 10 28 Q10 6 32 6 Z" fill="#f0e8d8" stroke="#140c06" stroke-width="2"/><circle cx="23" cy="28" r="6" fill="#140c06"/><circle cx="41" cy="28" r="6" fill="#140c06"/><path d="M32 34 L28 42 H36 Z M26 54 V46 M32 54 V46 M38 54 V46" fill="#140c06" stroke="#140c06" stroke-width="2"/>',
  combo: '<path d="M10 50 Q20 20 54 12" stroke="#fff" stroke-width="4" fill="none"/><path d="M8 34 Q30 30 54 46" stroke="#ffd080" stroke-width="4" fill="none"/><path d="M30 6 V58" stroke="#ff8a6a" stroke-width="5"/>',
  heavy: '<path d="M32 6 V48" stroke="#fff" stroke-width="6"/><path d="M18 36 L32 56 L46 36 Z" fill="#ffd080" stroke="#140c06" stroke-width="2"/><path d="M10 58 H54" stroke="#a07a4a" stroke-width="4"/>',
  boot: null, sword: null, potionAb: null,
};
export function abilityIcon(name, color) {
  const map = { boot: 'boots', sword: 'sword', shield: 'shield' };
  if (map[name] && S[map[name]]) return svg(S[map[name]]({}));
  const body = AB[name]; if (!body) return svg(S.sword({}));
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
}
function svg(p) { return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><defs>${p.defs}</defs>${p.body}</svg>`; }

const ARMCOL = { cloth: null, leather: '#8a5a34', mail: null };
// item -> svg
export function itemSvg(it) {
  if (!it) return '';
  if (it.kind === 'weapon') {
    const W = WEAPON_TYPES[it.wt], metal = tri(TIERS[it.tier]?.col || '#9aa1a8');
    const shape = { swordshield: 'swordshield', maceshield: 'maceshield', swordmace: 'swordmace', greatsword: 'greatsword', greataxe: 'greataxe', warhammer: 'hammer', spear: 'spear', daggers: 'daggers', handaxes: 'handaxes', bow: 'bow' }[it.wt];
    if (W.kind === 'staff') return svg(S.staff({ orb: { fire: '#ff7a1a', frost: '#7fe0ff', arcane: '#c070ff' }[W.element] }));
    return svg(S[shape]({ metal }));
  }
  if (it.kind === 'armor') {
    const col = it.akind === 'mail' ? TIERS[it.tier].col : it.akind === 'leather' ? ['#9a6a3a', '#8a5a34', '#6a4a2a', '#4a3a2a', '#2a2a3a', '#3a5a2a'][it.tier] : ['#cbb898', '#e8dfc8', '#8a6ac8', '#4a6ad8', '#c070ff', '#ffb040'][it.tier];
    const metal = tri(col);
    const shape = { head: it.akind === 'mail' ? 'helm' : it.akind === 'leather' ? 'hood' : 'hat', shoulders: 'shoulders', chest: it.akind === 'cloth' ? 'robe' : 'chest', wrists: 'wrists', hands: 'hands', waist: 'waist', legs: 'legs', feet: 'boots' }[it.slot];
    return svg(S[shape]({ col, metal }));
  }
  if (it.kind === 'acc') {
    const gem = ['#e04040', '#e04040', '#40c060', '#3a8ad8', '#c070ff', '#ffb040'][it.tier];
    const shape = { neck: 'amulet', back: 'cloak', ring: 'ring', trinket: 'charm' }[it.slot];
    return svg(S[shape]({ gem, col: ['#8a2a2a', '#8a2a2a', '#2a5a2a', '#2a3a8a', '#5a2a8a', '#8a6a1a'][it.tier], metal: tri(TIERS[it.tier].col) }));
  }
  if (it.tool) { const metal = tri(TIERS[[0, 0, 1, 2, 4][it.tier] || 0].col); return svg(S[it.tool]({ metal })); }
  const id = it.id, I = ITEMS[id] || {};
  const m = {
    wood: ['log'], planks: ['planks'], stone: ['rock'], copper_ore: ['ore'], iron_ore: ['ore'], mithril_ore: ['ore'], starmetal_ore: ['ore'],
    copper_ingot: ['ingot'], iron_ingot: ['ingot'], steel_ingot: ['ingot'], mithril_ingot: ['ingot'], starmetal_ingot: ['ingot'],
    cotton: ['cotton'], linen: ['cloth'], silk_cloth: ['cloth'], raw_hide: ['hide', '#a8784a'], leather: ['hide', '#6a4020'], spider_silk: ['web'], healroot: ['herb'],
    raw_meat: ['meat'], crab_meat: ['crab'], roast_meat: ['roast'], crab_cake: ['cake'], bandage: ['bandage'], bone: ['bone'], troll_tusk: ['fang'], wolf_fang: ['fang'], ember_core: ['ember'], bandit_badge: ['badge'],
    potion_heal: ['potion'], potion_heal2: ['potion'],
  }[id] || ['rock'];
  return svg(S[m[0]]({ col: m[1] || I.col }));
}
export function toolSvg(tool, tier) { return itemSvg({ tool, tier }); }
export function rarityCol(it) { return it && it.kind ? RARITY[it.rarity || 0].col : '#c8b890'; }
export function coin() { return `<svg viewBox="0 0 64 64" width="20" height="20" style="vertical-align:-4px"><circle cx="32" cy="32" r="26" fill="#e8b030" stroke="#7a4a10" stroke-width="4"/><circle cx="32" cy="32" r="17" fill="none" stroke="#fff0a0" stroke-width="3"/><path d="M27 22 h10 v20 h-10z" fill="#c08a20"/></svg>`; }
