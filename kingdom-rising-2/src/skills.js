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
// who may dual wield and double attack (like EverQuest: the fighters, rogues, monks and their kin)
export const DUAL_CLASSES = new Set(['warrior', 'berserker', 'rogue', 'monk', 'ranger', 'bard', 'beastmaster']);
export const DOUBLE_CLASSES = new Set(['warrior', 'berserker', 'paladin', 'darkknight', 'monk', 'rogue', 'ranger', 'beastmaster']);
export const ONE_HANDERS = new Set(['sword', 'mace', 'dagger', 'axe']);
export const skillCap = (h) => (h.level || 1) * 5 + 5;
export function skill(h, id) { if (h.yard) return skillCap(h); return (h.skills && h.skills[id]) || 1; }
// a hit with the skill: a chance to get better at it (likelier when the skill is low for your level)
export function practise(h, id) {
  if (!id || h.yard) return; h.skills = h.skills || {}; const cur = h.skills[id] || 1, cap = skillCap(h);
  if (cur >= cap) return;
  const p = 0.04 + 0.22 * (1 - cur / cap);
  if (Math.random() < p) { h.skills[id] = cur + 1; G.hooks.skillUp && G.hooks.skillUp(SKILLS[id], cur + 1); }
}
// each skill point: +0.2% damage with that kind of weapon (100 skill = +20%)
export const skillDamage = (h, wt) => { const id = skillOf(wt); return id ? 1 + (skill(h, id) - 1) * 0.002 : 1; };
export function canDual(h) { const a = h.equip && h.equip.w1, b = h.equip && h.equip.w2; return !!(a && b && DUAL_CLASSES.has(h.cls) && ONE_HANDERS.has(a.wt) && ONE_HANDERS.has(b.wt)); }
// chances per swing
export const dualChance = (h, dex) => Math.min(0.75, 0.15 + skill(h, 'dual') / 260 + (dex || 0) * 0.002);
export const doubleChance = (h, str) => DOUBLE_CLASSES.has(h.cls) ? Math.min(0.45, 0.04 + skill(h, 'double') / 320 + (str || 0) * 0.0015) : 0;
// melee classes also learn Triple Attack (a third swing, only after a Double Attack); casters learn Casting
export const CASTER_CLASSES = new Set(['wizard', 'cleric', 'druid', 'shaman', 'necromancer', 'elementalist', 'enchanter']);
export const tripleChance = (h, str) => DOUBLE_CLASSES.has(h.cls) ? Math.min(0.3, 0.02 + skill(h, 'triple') / 450 + (str || 0) * 0.001) : 0;
// Casting: spells take less time to cast as the skill grows, down to half at the level 20 cap (skill 105)
export const MAX_SKILL = 105;
export const castK = (h) => CASTER_CLASSES.has(h.cls) ? 1 - 0.5 * Math.min(1, skill(h, 'casting') / MAX_SKILL) : 1;
