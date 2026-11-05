// Campaign weapon skills, the EverQuest way: every hit with a kind of weapon has a chance to raise its skill,
// a skill can never be higher than your level allows, and each point makes that kind of weapon hit a little harder.
// Dual Wield (a chance of an off-hand swing) and Double Attack (a chance of a second main-hand swing) rise the same way.
import { G } from './state.js';

export const SKILLS = {
  slash1: '1H Slashing', slash2: '2H Slashing', blunt1: '1H Blunt', blunt2: '2H Blunt', pierce: '1H Piercing', pierce2: '2H Piercing', h2h: 'Hand to Hand',
  archery: 'Archery', firearms: 'Firearms', dual: 'Dual Wield', double: 'Double Attack', triple: 'Triple Attack', casting: 'Casting',
};
const OF = { sword: 'slash1', axe: 'slash1', handaxes: 'slash1', swordshield: 'slash1', swordmace: 'slash1', greatsword: 'slash2', greataxe: 'slash2',
  mace: 'blunt1', maceshield: 'blunt1', warhammer: 'blunt2', dagger: 'pierce', daggers: 'pierce', spear: 'pierce2', fists: 'h2h',
  bow: 'archery', musket: 'firearms', firestaff: 'blunt2', froststaff: 'blunt2', arcanestaff: 'blunt2' }; // staffs are two-handed blunt weapons
export const skillOf = (wt) => OF[wt] || null;
// three kinds of class: pure melee (no spells), hybrids (fight and cast), casters
export const MELEE_CLASSES = new Set(['warrior', 'berserker', 'rogue', 'monk', 'musketeer']);
export const HYBRID_CLASSES = new Set(['paladin', 'darkknight', 'ranger', 'beastmaster', 'shaman', 'bard']);
export const CASTER_CLASSES = new Set(['wizard', 'cleric', 'druid', 'necromancer', 'elementalist', 'enchanter']);
// Double Attack: melee and hybrids, from level 10. Triple Attack: pure melee only, from level 15. Both rise at most 5 points a level:
// by level 20 Double Attack tops out at 55 and Triple Attack at 30.
export const DOUBLE_CLASSES = new Set([...MELEE_CLASSES, ...HYBRID_CLASSES]);
export const TRIPLE_CLASSES = MELEE_CLASSES;
export const DUAL_CLASSES = new Set(['warrior', 'berserker', 'rogue', 'monk', 'ranger', 'bard', 'beastmaster']);
export const ONE_HANDERS = new Set(['sword', 'mace', 'dagger', 'axe']);
export const MAX_SKILL = 105;
export function skillCapOf(h, id) {
  const L = h.level || 1;
  if (id === 'double') return DOUBLE_CLASSES.has(h.cls) && L >= 10 ? (L - 9) * 5 : 0;
  if (id === 'triple') return TRIPLE_CLASSES.has(h.cls) && L >= 15 ? (L - 14) * 5 : 0;
  if (id === 'casting') return CASTER_CLASSES.has(h.cls) || HYBRID_CLASSES.has(h.cls) ? L * 5 + 5 : 0;
  return L * 5 + 5;
}
export const skillCap = (h) => (h.level || 1) * 5 + 5;
const STARTS_AT_ZERO = new Set(['double', 'triple', 'casting', 'dual']);
export function skill(h, id) { if (h.yard) return skillCapOf(h, id); const v = h.skills && h.skills[id]; return Math.min(v != null ? v : (STARTS_AT_ZERO.has(id) ? 0 : 1), skillCapOf(h, id)); }
// a use of the skill: a chance to get better at it (likelier when the skill is low for what your level allows)
export function practise(h, id) {
  if (!id || h.yard) return; h.skills = h.skills || {}; const cap = skillCapOf(h, id); if (cap <= 0) return;
  const cur = skill(h, id); if (cur >= cap) return;
  const p = 0.04 + 0.22 * (1 - cur / cap);
  if (Math.random() < p) { h.skills[id] = cur + 1; G.hooks.skillUp && G.hooks.skillUp(SKILLS[id], cur + 1); }
}
// each skill point: +0.2% damage with that kind of weapon (100 skill = +20%)
export const skillDamage = (h, wt) => { const id = skillOf(wt); return id ? 1 + (Math.max(1, skill(h, id)) - 1) * 0.002 : 1; };
export function canDual(h) { const a = h.equip && h.equip.w1, b = h.equip && h.equip.w2; return !!(a && b && DUAL_CLASSES.has(h.cls) && ONE_HANDERS.has(a.wt) && ONE_HANDERS.has(b.wt)); }
// chances per swing: the higher the skill, the likelier it happens (a little more with the matching stat)
export const dualChance = (h, dex) => Math.min(0.65, 0.1 + 0.5 * skill(h, 'dual') / MAX_SKILL + (dex || 0) * 0.001);
export const doubleChance = (h, str) => { const v = skill(h, 'double'); return v > 0 ? Math.min(0.4, 0.35 * v / 55 + (str || 0) * 0.0005) : 0; };
export const tripleChance = (h, str) => { const v = skill(h, 'triple'); return v > 0 ? Math.min(0.22, 0.2 * v / 30 + (str || 0) * 0.0003) : 0; };
// Casting: casters cast up to 50% faster at skill 105, hybrids up to 25%
export const castK = (h) => { const m = CASTER_CLASSES.has(h.cls) ? 0.5 : HYBRID_CLASSES.has(h.cls) ? 0.25 : 0; return 1 - m * Math.min(1, skill(h, 'casting') / MAX_SKILL); };
