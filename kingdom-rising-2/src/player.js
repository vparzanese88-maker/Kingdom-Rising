// The player: movement, camera (first <-> third person), first-person view model, combos, heavy attacks,
// weapon abilities, class abilities, blocking, dodging, gathering and interaction.
import { NEW_CLASSES } from './classes2.js';
import * as THREE from 'three';
import { G } from './state.js';
import { S, A, M as Music } from './audio.js';
import { V } from './vfx.js';
import { settings } from './saves.js';
import { WEAPON_TYPES, CLASSES, ABILITIES, AREA_UNLOCK_LEVEL, RANK2_LEVEL, CLASS_POOLS, RARITY, TIERS, WSKILLS, FAMILIES, slotSkills, familiesOf, COMBOS, RMB_SPECIAL } from './data.js';
const dualRank = () => 0;
import { armReach, buildHumanoid, equipWeapon, animateHumanoid, makeWeapon, holdTool, tintGear, bake, backWeapons, sheathe, kitize, classKitFP, cloneLite } from './character.js';
import { heightAt, isWater, waterLevelAt, zoneAt, SEA } from './terrain.js';
import { world, collide, groundAt, surfaceType, nodesNear, hideNode, nodeKinds, solidAt } from './world.js';
import { activeWeapon, swapSets, setIsEmpty, pairedWt, heroDerived, weaponDamage, gatherReward, toolProblem, useItem, count, lootCorpse, hasLoot, addItem, perk, wperk, ensureProc } from './game.js';
import { FOOD_BUFFS, ITEMS, PROCS, procChance, LEVEL_CAP, designLv, isSupport } from './data.js';
import { BATTLE } from './battlemap.js';
import { summonPets } from './pets.js';
import { buildAdsView } from './adsview.js';
import { abilityFx, bodyPoseTick } from './abilityfx.js';
import { attachFpArms, tickFpArms, heroHeight, hasHeroModel, bowRest, ikArm } from './heromodels.js';
import { makeFearSkull } from './combat.js';
import { noteTexture, luteToChest, playNotes, addOutline, arenaSpec, arenaBody, arenaDecor, arenaWeaponDecor, arenaLookTick, makeShrunkenHead, makeClaws, goblinGun, makeBomb, makeBook, palmWorld } from './arenalooks.js';
import { plantBanner } from './banners.js';
import * as Skills from './skills.js';
import * as Game from './game.js';
import { aimRay, groundPoint, mobsInCone, mobsInRadius, areaDamage, spawnProjectile, lightning, foe, poisonBubbles, missileTarget } from './combat.js';
import { angDiff, rand, clamp } from './util.js';
// the two knights' own three-blow combos (they shared one): [action, length and damage (the slower the blow, the harder it lands), when the hit
// lands as a share of the blow (empty: the usual share for that action, and the built swing's weapon reaches the target then)]. The paladin
// crushes: his recorded two-handed overhead smash, a wide sweep, a heavy overhead finisher; the shadow knight slashes: a backhand cut, his
// recorded Charged Slash sweeping across, then a thrust
const PAL3 = [['swing3', 1.35, 0.75], ['swing1', 1.1], ['smash', 1.3]], DK3 = [['swing2', 1.0], ['swing1', 1.25, 0.54], ['stabR', 0.85]];
// the rogue: two quick stabs, then her recorded Double Blade Spin, which cuts everyone around her: [action, length, damage, hit share, radius]
export const WARR = { w3: [['swing1', 1.05, 0.9, 0.42], ['swing2', 1.4, 1.1, 0.5]] }; /* (his recorded Double Combo: the diagonal cut, then the sweep back up; each hit where the blade lands in it. The built swings were [['swing1', 1.1, 1.0, 0.62], ['swing2', 1.1, 1.0, 0.62]]) */ /* (the warrior's swings: [name, length, damage, where the blow lands]) */
const BACK_SPEED = 2.1; /* (every hero's walk backwards, m/s) */
const BERS_CLEAVE = true; /* (the berserker's basic attack: the owner's Weapon Combo 2 (three cleaves, the great axe in both hands); false brings back his two-handed barbarian Attack chop) */
const ROGUE3 = [['stabR', 0.6, 0.95, 0.64, undefined, 'rtA'], ['stabR', 0.6, 0.95, 0.46, undefined, 'rtB']]; /* (the owner: the thrust, then the slash, in turn; no long flailing sweep) */ /* (6th: her recorded blow: the thrust, then the wide slash of the owner's Thrust Slash; the hit lands where the blade does) */
// the monk's seven blows, each the length of its own recording (they were all squeezed into a quarter of a second): [action, length, hit share,
// the model's move]; damage keeps step with length. The spinning kick takes its time, so the kick shows and its hit lands with the foot
const MONK7 = [['stabR', 0.5, 0.4, 'jab'], ['stabL', 0.5, 0.4, 'cross'], ['stabR', 0.6, 0.4, 'hook'], ['stabL', 0.6, 0.4, 'upper'], ['stabR', 1.3, 0.62, 'spin'], ['stabL', 0.5, 0.4, 'jab'], ['stabR', 1.0, 0.6, 'slam']];
const MM_SPEED = 30, MM_DMG = 1.6, MM_RANGE = 70, MM_CONE = 0.6, MM_SPLASH = 3, MM_LANES = [[1, 0.3], [-1, 0.3], [0.55, 0.8], [-0.55, 0.8], [0, 1.1]]; // the wizard's Magic Missiles: speed (m/s), damage against a bolt, how far and how wide round the crosshair they find a target (m, radians), the burst's reach, and the arcs (side, rise) they take in turn
const AIM_T0 = 0.1, AIM_FULL = 1.4, AIM_MAX = 2.5; // the ranger's zoomed charge shot: the draw starts counting after a tenth of a second and reaches full power 1.4 s later, at 2.5x an ordinary arrow
const BOW_CYCLE = 0.7, BOW_REL = 0.4, BOW_DMG = 1.62; /* (the owner: a quicker archer: a shot every 0.7 s, each arrow a little lighter (BOW_DMG: its damage scale), so damage per second rises about 15%) */ // the arena bow: one shot's length before haste (s), and how far into it the arrow is loosed
// Kingdom Battles: a glowing slash crescent that covers the swing's real hit area
const ARC_GEO = new Map();
const ARC_MAT = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
function slashArc(pl, R, H, name, hit, col) {
  return; // (the owner: no reach marker on a swing at all: it read as an area-of-effect ring)
  if (pl.camDist < 0.6) return; // (in first person the crescent lies across your view like a grey sheet: the blade's own trail is enough)
  if (pl.weapon && pl.weapon.wt === 'fists') return; // (bare fists leave no blade crescent: it hung in front of the monk's face as a grey sheet)
  const key = R.toFixed(1) + '_' + H.toFixed(2); let g = ARC_GEO.get(key); if (!g) { g = new THREE.RingGeometry(Math.max(0.5, R * 0.35), R, 28, 1, -H, H * 2); g.rotateX(-Math.PI / 2); ARC_GEO.set(key, g); }
  const m = new THREE.Mesh(g, ARC_MAT.clone()); m.material.color.copy(col || new THREE.Color('#ffffff')); m.material.opacity = hit ? 0.75 : 0.45;
  m.position.copy(pl.pos); m.position.y += name === 'smash' ? 0.4 : 1.05; m.rotation.y = pl.yaw - Math.PI / 2;
  // tilt the plane a little with the swing direction so it reads as a cut
  m.rotation.z = name === 'swing2' || name === 'off1' ? 0.25 : name === 'swing1' ? -0.25 : 0;
  V.temp(m, 0.22, (mm, t) => { m.material.opacity = (hit ? 0.75 : 0.45) * (1 - t); m.scale.setScalar(0.85 + t * 0.25); if (t >= 0.99) m.material.dispose(); });
}
// abilities land almost at once: their follow-up hits come after a third of the old wind-up
// how wide a basic swing reaches, by the size of the weapon (radians either side): small blades narrow, big ones wide
const ARC = { axe: 0.8, dagger: 0.42, daggers: 0.5, fists: 0.45, spear: 0.4, sword: 0.75, mace: 0.75, swordshield: 0.75, maceshield: 0.75, swordmace: 0.85, handaxes: 0.8, greatsword: 1.05, greataxe: 1.1, warhammer: 1.0 };
// cast and action times (seconds): big spells and big heals take a moment to gather; a few hands-on actions
// (setting a trap, lighting a fuse, coating blades, planting a banner) take a beat; strikes and emergency moves stay instant
const CAST_T = {
  pyroblast: 1.6, meteorshower: 2.0, lightstorm: 1.5, inferno: 1.2, firestorm: 1.3, cataclysm: 2.0, starfall: 1.6, hurricane: 1.3, mindstorm: 1.5, judgement: 1.2,
  prayer: 1.6, tranquility: 1.8, chainheal: 1.1, holylight: 1.1, radiantheal: 0.9, healingwave: 0.9, regrowth: 0.8, wildbloom: 1.2, spiritlink: 1.2, mending: 0.8, mendpet: 0.8,
  mesmerize: 1.0, masssleep: 1.5,
};
const ACT_T = { snaretrap: 0.6, explotrap: 0.6, spikepit: 0.6, frosttrap: 0.6, poisontrap: 0.6, snaretrap2: 0.6, envenom: 0.9, powderkeg: 0.5, cannonade: 1.0 };
const GOLDC = '#ffd84a', HEALC = '#7ee07e', REDC = '#ff6a4a', BLUEC = '#8ac8ff';
const SUPPORT = { warbanner: '#ff7a3a', vigorbanner: HEALC, stonebanner: BLUEC, shieldwall: BLUEC, laststand: GOLDC, fortify: GOLDC, rally: GOLDC, battlecry: REDC, bloodrage: REDC, undying: REDC, rampage: REDC, adrenaline: REDC, intimshout: REDC,
  mending: HEALC, healingwave: HEALC, chainheal: HEALC, spiritlink: HEALC, ancestral: BLUEC, wartotem: GOLDC, barkskin: GOLDC, focus: BLUEC, eagleeye: BLUEC, quickreload: GOLDC, icebarrier: BLUEC, manasurge: BLUEC, vanish: '#b080ff', smokebomb: '#b080ff' };
// which particles show for each running buff
const AURA = { wall: ['gold', 0.3], fort: ['gold', 0.3], stand: ['gold', 0.35], undying: ['blood', 0.3], fury: ['blood', 0.28], rage: ['blood', 0.3], rampage: ['blood', 0.3], cry: ['ember', 0.25],
  adren: ['spark', 0.22], swind: ['spark', 0.22], wolfRun: ['spark', 0.22], haste: ['spark', 0.22], focus: ['arcane', 0.24], eagle: ['arcane', 0.24], surge: ['arcane', 0.3], clarity: ['frost', 0.24], ward: ['frost', 0.28],
  poisonW: ['leaf', 0.24], flame: ['fire', 0.3], leech: ['shadow', 0.3], storm: ['spark', 0.3], tq: ['gold', 0.25], reload: ['ember', 0.2], lich: ['shadow', 0.3], bWar: ['ember', 0.28], bVigor: ['heal', 0.3], bStone: ['frost', 0.28] };
// the berserker's thrown axe leaves its own solid blood-red streak (one shader, built once)
const AXE_TRAIL_FS = 'uniform vec3 color; uniform float op; varying float vA; void main(){ gl_FragColor = vec4(color, min(1.0, vA*op*1.6)); }';
function axeTrail() { const tr = V.trail('#d80000'); tr.thin = 0; tr.len = 14; if (tr.mat) { tr.mat.visible = true; tr.mat.blending = THREE.NormalBlending; tr.mat.fragmentShader = AXE_TRAIL_FS; tr.mat.needsUpdate = true; } return tr; }
// Shift dodges: a quick side step, a rolling dodge that goes further, a leaping roll that goes furthest
const DODGES = { old: { dur: 0.6, speed: 10, cost: 16, ifr: 0.42 }, step: { dur: 0.34, speed: 11, cost: 14, ifr: 0.24 }, roll: { dur: 0.8, speed: 8.6, cost: 20, ifr: 0.5 }, leap: { dur: 0.75, speed: 12.5, cost: 26, ifr: 0.55, vy: 5.5 }, flip: { dur: 0.8, speed: 12.5, cost: 26, ifr: 0.6, vy: 6.6 } }; // (flip: the monk's acrobatics, a front flip, a back flip or an aerial the way you go) // slower, weightier dodges you can follow with your eyes
const DODGE_OF = { warrior: 'roll', cleric: 'step', paladin: 'step', darkknight: 'step',
  berserker: 'roll', musketeer: 'roll', wizard: 'roll', druid: 'roll', bard: 'roll', necromancer: 'roll', elementalist: 'roll', enchanter: 'roll', shaman: 'roll',
  monk: 'flip', ranger: 'leap', rogue: 'leap', beastmaster: 'leap', priest: 'roll', bombardier: 'leap' };
const FORMS = { formVoid: { name: 'Void Form', col: '#7a2aff', k: 1.0, mote: 'shadow', el: 'arcane' }, formTime: { name: 'Timeless Form', col: '#ffd060', k: 0.9, mote: 'gold', el: 'arcane' }, formFire: { name: 'Phoenix Form', col: '#ff6a10', k: 0.9, mote: 'fire', el: 'fire' }, formFrost: { name: 'Avatar of Winter', col: '#60c8ff', k: 0.8, mote: 'frost', el: 'frost' }, formArcane: { name: 'Arcane Ascension', col: '#b060ff', k: 0.9, mote: 'arcane', el: 'arcane' }, iceblock: { name: 'Ice Block', col: '#a8e8ff', k: 1.2, mote: 'frost', el: 'frost' } };
const B_AV = (p) => p.buffs.avatar > 0 && p.avatar;
const CASTER_K = {}; // no hidden caster multipliers: the wizard out-damages through its spells
const EL_COL = { fire: '#ff8a3a', frost: '#8ad8ff', arcane: '#c080ff', shadow: '#b070ff', storm: '#e8e8ff', lightning: '#e8e8ff', poison: '#8fe05a', venom: '#8fe05a', nature: '#8fe05a', holy: '#ffe080', light: '#ffe080' };
// creature defence: 4 physical and 4 magical per level; how much it blocks depends on your own level too
export function mobDefense(m, plv, magic) { const d = Math.max(0, m.lv - 1) * 2 * (magic ? (m.def.magicK || 1) : (m.def.physK || 1)); return Math.min(0.75, d / (d + 60 + plv * 10)); }
const BANNERS_AB = new Set(['warbanner', 'vigorbanner', 'stonebanner', 'rally']);
const ABIL_DELAY_K = () => (G.battleFx ? 0.35 : 1);
// [radius, heal fraction, buff kind, buff seconds] for abilities that help allies too
const ALLY_FX = { warbanner: [15, 0, 'rally', 15], vigorbanner: [15, 0.3], stonebanner: [15, 0, 'ward', 15], fielddress: [8, 0.2], battlecry: [10, 0.1, 'rally', 10], rally: [14, 0.3, 'rally', 10], shieldwall: [8, 0, 'ward', 6], icebarrier: [10, 0, 'ward', 12], barkskin: [10, 0, 'ward', 8], quickreload: [14, 0, 'haste', 8], healingwave: [10, 0.15], ancestralward: [9, 0, 'ward', 8], wartotem: [10, 0, 'haste', 8], spiritlink: [12, 0.3] };

const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const easeIn = (t) => t * t * t;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
// a bright crescent where a big swing passes: flat for sweeps, upright for overhead blows
function abilityArc(center, yaw, r, col, span, vertical, width = 0.4) {
  const g = vertical ? new THREE.RingGeometry(r * (1 - width), r, 40, 1, -Math.PI / 3, span) : new THREE.RingGeometry(r * (1 - width), r, 40, 1, yaw - Math.PI / 2 - span / 2, span);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.position.copy(center); if (vertical) m.rotation.y = yaw - Math.PI / 2; else m.rotation.x = -Math.PI / 2;
  V.temp(m, 0.3, (mm, t) => { m.material.opacity = 0.9 * (1 - t) * (1 - t); m.scale.setScalar(0.85 + t * 0.3); if (t >= 0.99) { m.geometry.dispose(); m.material.dispose(); } });
}

// ---------- first-person view model ----------
const P = (x, y, z, rx, ry, rz) => [x, y, z, rx, ry, rz];
const VP = {
  rest: P(0.42, -0.44, -0.55, -0.22, -0.05, -0.2), restL: P(-0.27, -0.22, -0.48, -0.45, -0.1, -0.16), rest2: P(0.36, -0.5, -0.6, -0.1, 0.05, -0.85), hideL: P(-0.4, -0.9, -0.3, 0, 0, 0),
  s1a: P(0.52, -0.05, -0.4, -1.35, -1.1, 0.3), s1b: P(-0.42, -0.3, -0.45, -1.35, 1.35, 0.3),
  s2a: P(-0.38, -0.45, -0.4, -1.75, 1.1, -0.6), s2b: P(0.45, 0.05, -0.5, -1.0, -1.2, -0.6),
  s3a: P(0.2, 0.3, -0.22, 0.5, 0, -0.1), s3b: P(0.05, -0.5, -0.55, -2.2, 0, 0),
  wOhA: P(0.3, 0.32, -0.28, 0.75, -0.15, -0.35), wOhB: P(-0.02, -0.5, -0.62, -2.1, 0.1, 0.1), /* (warrior overhand: the blade raised high over the right shoulder, then cut straight down the middle) */
  wSdA: P(0.62, -0.02, -0.36, -1.4, -1.25, 1.15), wSdB: P(-0.48, -0.26, -0.5, -1.4, 1.4, 1.45), /* (side slash: wide from the right, across and through to the left) */
  wStA: P(0.34, -0.42, -0.22, -1.5, 0.05, -0.15), wStB: P(0.06, -0.2, -1.0, -1.57, 0, 0), /* (stab: drawn back to the hip, then driven straight out at the crosshair) */
  ohA: P(0.2, 0.3, -0.32, 1.25, 0, 0.12), ohB: P(0.04, -0.5, -0.62, -1.55, 0, 0.05),
  ha: P(0.45, 0.25, -0.15, 0.6, -0.5, -0.3), hb: P(0, -0.45, -0.62, -2.1, 0.3, 0),
  spRest: P(0.24, -0.3, -0.3, -1.45, 0.06, 0), thA: P(0.3, -0.25, -0.1, -1.5, 0.05, 0), thB: P(0.12, -0.2, -0.95, -1.56, 0, 0), th3A: P(0.32, 0.05, 0.0, -1.3, 0.1, 0), th3B: P(0.05, -0.25, -1.2, -1.65, 0, 0),
  blockW: P(0.15, -0.12, -0.45, -0.3, 0, 1.45), shieldRest: P(-0.48, -0.6, -0.55, 0.25, 0.5, 0.12), shieldBlock: P(-0.22, -0.31, -0.33, 0.1, 0.42, 0.04), swordLow: P(0.48, -0.5, -0.5, -0.15, 0.1, 0.1),
  bowL: P(-0.3, -0.06, -0.62, 0, 0.1, 0.18), heroBowL: P(0.02, -0.07, -0.56, 0, 0.12, -0.62), /* (a hero ranger: the bow on the right of the view, its top canted right) */ bowR: P(-0.17, -0.15, -0.58, -1.5, 0, 0), bowRdraw: P(-0.13, -0.12, -0.3, -1.5, 0, 0),
  staff: P(0.3, -0.36, -0.8, -0.6, 0.05, -0.2), /* (low on the right, the head tipped forward so you see it ahead of you) */ staffCast: P(0.15, -0.28, -0.5, -1.38, 0.06, -0.08), staffHigh: P(0.2, -0.24, -0.5, -0.2, 0, -0.1), staffSlam: P(0.14, -0.42, -0.72, -1.05, 0, 0),
  castL: P(-0.18, -0.24, -0.62, -1.4, 0, 0), handUpR: P(0.26, 0.06, -0.6, -0.25, 0, -0.25), handUpL: P(-0.26, 0.06, -0.6, -0.25, 0, 0.25), handPushR: P(0.16, -0.12, -0.78, -1.45, 0, -0.1), handPushL: P(-0.16, -0.12, -0.78, -1.45, 0, 0.1), chopA: P(0.38, 0.2, -0.3, 0.3, -0.3, -0.3), chopB: P(0.02, -0.35, -0.65, -1.7, 0.2, 0.2),
  jabA: P(0.26, -0.19, -0.36, -1.25, -0.15, -0.5), jabB: P(0.035, -0.115, -0.6, -1.55, 0, 0.05), /* (the guard up by the chin, knuckles turned in; the jab lands under the crosshair, knuckles flat) */ guardR: P(0.26, -0.19, -0.36, -1.25, -0.15, -0.5), /* (fists: a boxer's guard by the jaw, jabs straight out along the eye line) */ kickDown: P(0.42, -0.85, -0.35, -0.3, 0, -0.3),
  bombR: P(0.22, -0.22, -0.42, 0.15, 1.45, -1.57), bombUp: P(0.32, 0.02, -0.25, 0.9, 1.45, -1.57), bombThrow: P(0.1, -0.12, -0.7, -0.6, 1.45, -1.57), /* (the grenade fist: knuckles forward, thumb up; the throw winds up by the ear and lobs it out ahead) */
  rogR: P(0.24, -0.27, -0.42, -1.25, 0.12, -0.25), rogBack: P(0.3, -0.3, -0.3, -1.0, 0.1, -0.35), rogStab: P(0.07, -0.15, -0.72, -1.5, 0.05, -0.1),
  bookR: P(0.2, -0.3, -0.46, -0.88, -0.15, 0.05), /* (the wizard's book open in his right hand, low and to the right, its pages tipped up toward you) */
  bookCast: P(0.13, -0.17, -0.6, -1.15, -0.1, 0.05),
  beastR: P(0.26, -0.26, -0.46, 0, 1.77, -1.823), beastBack: P(0.32, -0.28, -0.34, 0, 1.6, -1.6), beastStab: P(0.08, -0.2, -0.72, 0, 1.65, -1.75),
  eleR: P(0.2, -0.3, -0.5, 0.2, 0.2, 0.1), /* (the elementalist's open hand, palm up, low on the right under his floating orb) */
  warR: P(0.36, -0.44, -0.55, -0.45, -0.1, -0.2), warShield: P(-0.4, -0.38, -0.48, 0.2, 0.5, 0.12), warBlock: P(-0.15, -0.28, -0.32, 0.1, 0.32, 0.04), /* (warrior: sword lower; shield closer and bigger; block slides it toward the centre, not onto it) */
  necroGap: 0.62, necroScy: P(0.6, 0.2, -0.85, -0.3, 0.35, -0.38), necroScyA: P(0.75, 0.15, -0.6, -0.2, -0.5, -1.1), necroScyB: P(-0.35, -0.1, -0.7, -0.4, -0.3, 1.0), /* (the scythe: right hand high on the shaft, leaning up and right; a swing sweeps right to left, blade leading) */
  bookL: P(-0.26, -0.28, -0.55, -0.55, 0.15, 0.2), necroR: P(0.17, -0.18, -0.27, -0.9, 0.15, -0.35), necroL: P(-0.2, -0.2, -0.32, -0.1, 0.1, 0.08), necroPush: P(0.07, -0.12, -0.74, -1.5, 0, -0.05), /* (close and big in your view; the push throws the spell at the crosshair) */
  gatherR: P(0.12, -0.6, -0.55, -1.2, 0, 0), gatherR2: P(0.08, -0.7, -0.5, -1.4, 0, 0),
};
if (typeof window !== 'undefined') window.KR2_VP = VP; /* (tuning hook: poses can be adjusted live from the console) */
const _wv = new THREE.Vector3(), _wq = new THREE.Quaternion(), _wy = new THREE.Vector3(0, 1, 0);
function mirror(p) { return [-p[0], p[1], p[2], p[3], -p[4], -p[5]]; }
// Flame Blade: the owner's two flame pictures wrapped round the sword: the coloured fire, cut into licking tongues by the
// grey wisp picture, both rising up the blade at different speeds. One strip from guard to past the point, always turned
// to face the camera, glowing (additive), with soft edges
let FIRE = null;
function fireMesh() { if (FIRE) return FIRE; const L = new THREE.TextureLoader(), tx = (u) => { const t = L.load(u); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  const col = tx('models/fx/flame_col.jpg'); col.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.ShaderMaterial({ uniforms: { tCol: { value: col }, tMask: { value: tx('models/fx/flame_mask.jpg') }, uT: { value: 0 }, uA: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tCol, tMask; uniform float uT, uA; varying vec2 vUv;
      void main() { vec2 u = vUv; float m1 = texture2D(tMask, vec2(u.x * 0.55 + 0.1, u.y * 0.9 - uT * 0.55)).r, m2 = texture2D(tMask, vec2(u.x * 0.4 + 0.5 + sin(uT * 1.3) * 0.05, u.y * 0.6 - uT * 0.9)).r;
        float m = m1 * 0.65 + m2 * 0.55; float x = abs(u.x - 0.5) * 2.0; float core = 1.0 - smoothstep(0.0, 1.0, x); float ends = smoothstep(0.0, 0.08, u.y) * (1.0 - smoothstep(0.78, 1.0, u.y));
        float a = smoothstep(0.2, 0.7, m * (0.35 + core * 0.9) * (1.2 - u.y * 0.35)) * ends * uA; vec3 c = texture2D(tCol, vec2(u.x * 0.5 + 0.25, u.y * 0.7 - uT * 0.7)).rgb;
        c *= vec3(1.0, 0.3, 0.1); c = mix(c, vec3(1.0, 0.45, 0.12), smoothstep(0.85, 1.0, core) * 0.25); gl_FragColor = vec4(c * a * 1.2, a); /* (deep red: additive light turned the old mix yellow) */ /* (deep red-orange fire, only a hot orange core) */ }` });
  FIRE = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), m); FIRE.frustumCulled = false; FIRE.renderOrder = 5; FIRE.visible = false; return FIRE; }
setTimeout(() => { try { fireMesh(); } catch (e) { /* no fire textures */ } }, 3000); /* (the flame pictures load early, so the first Flame Blade already burns) */
const _fa = new THREE.Vector3(), _fb = new THREE.Vector3(), _fx = new THREE.Vector3(), _fy = new THREE.Vector3(), _fz = new THREE.Vector3(), _fm = new THREE.Matrix4();
// a model sword has no guard and point markers: find them from its shape (its longest side; the point is the far end
// from the hand, the blade starts about a fifth of the way up from the hilt)
function bladeEnds(w) { if (w.userData.tip && w.userData.base) return true; if (w.userData.noEnds) return false;
  w.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(w.matrixWorld).invert(), bb = new THREE.Box3(), tmp = new THREE.Box3(), M = new THREE.Matrix4(); let any = false;
  w.traverse(o => { if (!o.isMesh || !o.geometry) return; if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); tmp.copy(o.geometry.boundingBox).applyMatrix4(M.multiplyMatrices(inv, o.matrixWorld)); bb.union(tmp); any = true; });
  if (!any) { w.userData.noEnds = true; return false; } const sz = bb.getSize(new THREE.Vector3()), ax = sz.x > sz.y && sz.x > sz.z ? 'x' : sz.y > sz.z ? 'y' : 'z';
  const c = bb.getCenter(new THREE.Vector3()), lo = c.clone(), hi = c.clone(); lo[ax] = bb.min[ax]; hi[ax] = bb.max[ax]; const far = hi.lengthSq() > lo.lengthSq() ? hi : lo, near = far === hi ? lo : hi;
  const tip = new THREE.Object3D(), base = new THREE.Object3D(); tip.position.copy(far); base.position.copy(near).lerp(far, 0.2); w.add(tip); w.add(base); w.userData.tip = tip; w.userData.base = base; return true; }
function bladeFire(p, dt) { const w = p.ch && p.ch.weapons && p.ch.weapons.main, on = p.buffs.flame > 0 && !p.dead && w && p.W && p.W.kind !== 'staff' && p.ch.root.visible && bladeEnds(w);
  if (!on) { if (FIRE) FIRE.visible = false; return; } const F = fireMesh(); if (F.parent !== G.scene) G.scene.add(F);
  w.userData.base.getWorldPosition(_fa); w.userData.tip.getWorldPosition(_fb); _fy.subVectors(_fb, _fa); const len = _fy.length(); if (len < 0.05) { F.visible = false; return; } _fy.divideScalar(len);
  _fz.subVectors(G.camera.position, _fa); _fx.crossVectors(_fy, _fz); if (_fx.lengthSq() < 1e-6) _fx.set(1, 0, 0); _fx.normalize(); _fz.crossVectors(_fx, _fy).normalize(); /* (turned about the blade to face you) */
  _fm.makeBasis(_fx, _fy, _fz); F.quaternion.setFromRotationMatrix(_fm); F.position.copy(_fa).addScaledVector(_fy, -len * 0.05); F.scale.set(0.72, len * 1.4, 1); /* (wide enough to show round the blade, which hides the middle of the strip) */ /* (from just below the guard to well past the point) */
  const ig = p.flameIgniteT != null ? G.time - p.flameIgniteT : 99, flare = Math.max(0, 1 - ig / 0.7); /* (the ignition: the flames roar up big and bright, then settle into a steady burn) */
  if (ig < 0.7 && !p.flameLit) { p.flameLit = true; for (let i = 0; i <= 6; i++) { const q = _fa.clone().lerp(_fb, i / 6); V.burst('fire', q, 7, { speed: 2.6, size: 0.65, size1: 0.08, life: 0.55, vy: 1.6 }); V.burst('ember', q, 4, { speed: 4, life: 0.9 }); } S.cast && S.cast('fire', _fb, 1.1); V.light && V.light(_fb, '#ff4a14', 9, 0.5, 9); }
  if (ig >= 0.7) p.flameLit = false;
  F.scale.x *= 1 + flare * 0.9; F.scale.y *= 1 + flare * 0.25; const u = F.material.uniforms; u.uT.value += dt * (1 + flare * 2); u.uA.value = Math.min(1, p.buffs.flame * 2) * (1 + flare * 0.8); F.visible = true; }
// a proper arrow for a hero archer, laid along -z from the nock at the origin: a slim dark shaft, three fletchings, a nock and a steel broadhead with a little flame on it
function heroArrow() { const ar = new THREE.Group(), wood = new THREE.MeshStandardMaterial({ color: '#4a3220', roughness: 0.7 }), steel = new THREE.MeshStandardMaterial({ color: '#b8bcc0', roughness: 0.3, metalness: 0.9 }), feath = new THREE.MeshStandardMaterial({ color: '#d8d0c0', roughness: 0.9, side: THREE.DoubleSide }), red = new THREE.MeshStandardMaterial({ color: '#8a1a14', roughness: 0.9, side: THREE.DoubleSide });
  const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.82, 6), wood); sh.rotation.x = Math.PI / 2; sh.position.z = -0.41; ar.add(sh);
  const nk = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.005, 0.02, 6), new THREE.MeshStandardMaterial({ color: '#1a1410' })); nk.rotation.x = Math.PI / 2; nk.position.z = -0.008; ar.add(nk);
  const vg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, -0.02), new THREE.Vector3(0, 0.018, -0.045), new THREE.Vector3(0, 0.016, -0.11), new THREE.Vector3(0, 0, -0.13)]); vg.setIndex([0, 1, 2, 0, 2, 3]); vg.computeVertexNormals();
  for (let i = 0; i < 3; i++) { const v = new THREE.Mesh(vg, i === 0 ? red : feath); v.rotation.z = i * Math.PI * 2 / 3; ar.add(v); } /* (cock feather red) */
  const hd = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.055, 4), steel); hd.rotation.x = -Math.PI / 2; hd.position.z = -0.845; hd.scale.set(1, 1, 0.35); ar.add(hd); /* (a flat broadhead) */
  const fl = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffb040', transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false })); fl.position.z = -0.82; fl.scale.set(1, 1.6, 1); fl.userData.flame = true; ar.add(fl); ar.userData.flame = fl;
  ar.traverse(o => { if (o.isMesh) o.castShadow = false; }); return ar; }
const BB_GRIP = { R: new THREE.Vector3(0, -0.085, -0.055), Ry: new THREE.Vector3(0, 0.78, 0.63).normalize(), L: new THREE.Vector3(0, 0.24, -0.035), Ly: new THREE.Vector3(0, 1, 0) }; /* (the blunderbuss's hand places, in the gun's own frame: y along the barrel, z up; Ry/Ly the line each hand closes round) */
const CAM_MIN = 2.2; /* (the closest the camera comes to a hero) */
// a slash streak where a blade lands: a bright curved stroke that flashes, widens and fades in a fifth of a second
// Hunter's Focus on the bow: motes of green-gold light spiral up and down both limbs, a halo throbs at the grip and the string burns
// bright while the buff lasts (third person and first person alike: each bow carries its own little set of motes, its own layer)
let _moteTex = null;
function moteTex() { if (_moteTex) return _moteTex; const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.85)'); g.addColorStop(0.55, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  _moteTex = new THREE.CanvasTexture(c); _moteTex.colorSpace = THREE.SRGBColorSpace; return _moteTex; }
const FOCUS_MOTES = 12, FOCUS_COLS = ['#f4ff9a', '#7dff6a', '#ffe36a'];
function focusBow(bw, on, t, dt, k) { if (!bw || bw.name !== 'weapon_bow') return; let fx = bw.userData.focusFx; const sg = bw.userData.string;
  if (!on) { if (fx && fx.visible) { fx.visible = false; if (sg && sg.userData.c0) sg.material.color.copy(sg.userData.c0); } return; }
  if (!fx) { fx = new THREE.Group(); fx.name = 'focusFx'; let mask = null; bw.traverse(c => { if (mask == null && c.isMesh && c.visible) mask = c.layers.mask; });
    const mk = (col, sz) => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: moteTex(), color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); m.scale.setScalar(sz); if (mask != null) m.layers.mask = mask; m.frustumCulled = false; fx.add(m); return m; };
    fx.userData.motes = Array.from({ length: FOCUS_MOTES }, (_, i) => mk(FOCUS_COLS[i % 3], 0.06)); fx.userData.halo = mk('#b8ff70', 0.3); fx.userData.halo2 = mk('#fff4b0', 0.14);
    bw.add(fx); bw.userData.focusFx = fx; }
  fx.visible = true; const pa = sg && sg.geometry.attributes.position, h = pa ? Math.abs(pa.getY(2)) || 0.6 : 0.6, zt = pa ? pa.getZ(2) : 0.12, M = fx.userData.motes;
  for (let i = 0; i < M.length; i++) { const ph = i / M.length * Math.PI * 2, u = Math.sin(t * 1.7 + ph * 1.3), th = t * 7 + ph * 2, r = 0.05 + 0.02 * Math.sin(t * 3 + ph); /* (each mote runs up and down a limb, circling it) */
    M[i].position.set(Math.cos(th) * r, u * h * 1.02, zt * u * u * 0.8 + Math.sin(th) * r); const tw = 0.6 + 0.4 * Math.sin(t * 11 + ph * 3); M[i].material.opacity = tw * k; M[i].scale.setScalar(0.045 + 0.035 * tw); }
  const pulse = 0.5 + 0.5 * Math.sin(t * 6); fx.userData.halo.material.opacity = (0.35 + 0.35 * pulse) * k; fx.userData.halo.scale.setScalar(0.24 + 0.1 * pulse); fx.userData.halo2.material.opacity = (0.5 + 0.4 * pulse) * k;
  if (sg) { if (!sg.userData.c0) sg.userData.c0 = sg.material.color.clone(); sg.material.color.set('#eaff9a').lerp(new THREE.Color('#ffffff'), pulse * 0.5); } }
// Magic Missiles on the spellbook: violet motes circle the book in a tilted ring and a halo throbs round it while the spell lasts
const BOOK_MOTES = 10;
function bookAura(bk, on, t, k) { if (!bk) return; let fx = bk.userData.mmFx;
  if (!on) { if (fx && fx.visible) fx.visible = false; return; }
  if (!fx) { fx = new THREE.Group(); fx.name = 'mmFx'; let mask = null; bk.traverse(c => { if (mask == null && c.isMesh) mask = c.layers.mask; });
    const mk = (col, sz, norm) => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: moteTex(), color: col, transparent: true, depthWrite: false, blending: norm ? THREE.NormalBlending : THREE.AdditiveBlending })); m.scale.setScalar(sz); if (mask != null) m.layers.mask = mask; m.frustumCulled = false; fx.add(m); return m; };
    fx.userData.m = Array.from({ length: BOOK_MOTES }, (_, i) => mk(i % 2 ? '#c890ff' : '#7a1cff', 0.07, i % 2 === 0)); fx.userData.halo = mk('#8a2cff', 0.42, true); fx.userData.glow = mk('#e0b8ff', 0.22);
    bk.add(fx); bk.userData.mmFx = fx; }
  fx.visible = true; const M = fx.userData.m, s = 1 / Math.max(0.2, bk.getWorldScale(new THREE.Vector3()).x); /* (sized in metres whatever the hand's scale) */
  for (let i = 0; i < M.length; i++) { const a = t * 4 + i / M.length * Math.PI * 2, r = 0.2 * s; M[i].position.set(Math.cos(a) * r, Math.sin(a * 2) * 0.05 * s + 0.05 * s, Math.sin(a) * r); M[i].material.opacity = (0.65 + 0.35 * Math.sin(t * 9 + i)) * k; M[i].scale.setScalar(0.07 * s); }
  const pulse = 0.5 + 0.5 * Math.sin(t * 7); fx.userData.halo.material.opacity = (0.25 + 0.2 * pulse) * k; fx.userData.halo.scale.setScalar((0.36 + 0.08 * pulse) * s); fx.userData.glow.material.opacity = (0.5 + 0.3 * pulse) * k; fx.userData.glow.scale.setScalar(0.2 * s); }
// Blink, the owner's way: a violet rift tears open where the wizard stands and swallows him, void lightning leaps the gap along a stream of
// purple light, and he bursts out of a second rift at the far end in a shower of violet shards, a rune ring flaring on the ground at both
function riftFx(P, d, opening) { const g = new THREE.Group(); g.position.copy(P); g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.clone().setY(0).lengthSq() > 1e-4 ? d.clone().setY(0).normalize() : new THREE.Vector3(0, 0, 1));
  const add = (geo, col, op, norm) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, blending: norm ? THREE.NormalBlending : THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.userData.op = op; m.renderOrder = 5 + g.children.length; g.add(m); return m; };
  const disc = add(new THREE.CircleGeometry(0.74, 40), '#1c0548', 0.88, true), rimN = add(new THREE.RingGeometry(0.64, 0.86, 48), '#7a1cff', 0.95, true), rim = add(new THREE.RingGeometry(0.7, 0.8, 48), '#d0a0ff', 0.9), rim2 = add(new THREE.RingGeometry(0.86, 0.9, 48), '#b070ff', 0.55), swirl = add(new THREE.RingGeometry(0.18, 0.6, 5, 1, 0, Math.PI * 1.4), '#9b4dff', 0.7, true); /* (a dark violet void ringed in saturated purple (drawn normally, so it shows against a bright sky) with a glowing edge and a slow swirl) */
  g.scale.set(0.05, 0.05, 1); G.scene.add(g); let t = 0; const T = 0.62;
  G.timers.push({ update: (dt) => { t += dt; const k = t / T; if (k >= 1) { G.scene.remove(g); g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); return true; }
    const open = k < 0.18 ? 1 - Math.pow(1 - k / 0.18, 3) : k > 0.6 ? Math.max(0, 1 - (k - 0.6) / 0.4) : 1, s = open * (opening ? 1 : 1.12); g.scale.set(Math.max(0.02, s), Math.max(0.02, s * 1.55), 1); /* (a tall oval, as tall as he is) */
    swirl.rotation.z -= dt * 9; rim.rotation.z += dt * 2; for (const m of g.children) m.material.opacity = m.userData.op * (k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1); return false; } }); }
// jagged violet lightning cracking out from p, n bolts up to len long, flickering out in about 0.3 s (the wizard's exploding spells)
function voidArcs(p, n, len) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, d = new THREE.Vector3(Math.cos(a), (Math.random() - 0.65) * 0.9, Math.sin(a)).normalize(), L = len * (0.6 + Math.random() * 0.5), pts = [p.clone()];
    for (let k = 1; k <= 6; k++) { const q = p.clone().addScaledVector(d, L * k / 6); if (k < 6) q.add(new THREE.Vector3((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5)); pts.push(q); }
    const cv = new THREE.CatmullRomCurve3(pts), glowT = new THREE.Mesh(new THREE.TubeGeometry(cv, 18, 0.07, 4), new THREE.MeshBasicMaterial({ color: '#9a30ff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })), core = new THREE.Mesh(new THREE.TubeGeometry(cv, 18, 0.022, 3), new THREE.MeshBasicMaterial({ color: '#f0d8ff', transparent: true, depthWrite: false }));
    const fl = (o, k) => { o.material.opacity = (1 - k) * (0.55 + Math.random() * 0.45); if (k >= 0.99) { o.geometry.dispose(); o.material.dispose(); } }; V.temp(glowT, 0.3, fl); V.temp(core, 0.3, fl); } }
// a burnt, cracked violet rune scar on the ground that glows and fades over about 2 s
let scarTex = null;
function voidScar(p, r) { if (!scarTex) { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), m = 64; const g = x.createRadialGradient(m, m, 4, m, m, m); g.addColorStop(0, 'rgba(20,0,40,0.95)'); g.addColorStop(0.55, 'rgba(40,5,80,0.7)'); g.addColorStop(1, 'rgba(20,0,40,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    x.strokeStyle = 'rgba(200,120,255,0.95)'; x.lineWidth = 2; for (let i = 0; i < 9; i++) { let a = i / 9 * Math.PI * 2 + Math.random() * 0.3, rr = 6; x.beginPath(); x.moveTo(m + Math.cos(a) * rr, m + Math.sin(a) * rr); while (rr < 58) { rr += 6 + Math.random() * 8; a += (Math.random() - 0.5) * 0.5; x.lineTo(m + Math.cos(a) * rr, m + Math.sin(a) * rr); } x.stroke(); }
    scarTex = new THREE.CanvasTexture(c); scarTex.colorSpace = THREE.SRGBColorSpace; }
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: scarTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); mesh.rotation.set(-Math.PI / 2, 0, Math.random() * 6.28); mesh.position.copy(p);
  V.temp(mesh, 2.2, (o, k) => { o.material.opacity = k < 0.1 ? 1 : 1 - (k - 0.1) / 0.9; if (k >= 0.99) { o.geometry.dispose(); o.material.dispose(); } }); }
function blinkFx(from, to) { const A = from.clone().setY(from.y + 1.15), B = to.clone().setY(to.y + 1.15), d = B.clone().sub(A), L = d.length(); if (L > 0.01) d.divideScalar(L); else d.set(0, 0, 1);
  riftFx(A, d, true); riftFx(B, d, false);
  V.burst('void', A, 46, { normal: true, speed: 3.2, size: 0.55, life: 0.7 }); V.burst('arcane', A, 30, { speed: 6, size: 0.3 }); V.ring(from, 2.4, '#8a3cff', 0.5); /* (where he was: violet smoke and light bursting, a small flash, a ring on the ground) */
  { const n = Math.max(12, Math.round(L * 3)); for (let i = 1; i < n; i++) { const q = A.clone().lerp(B, i / n); V.burst('void', q, 1, { normal: true, speed: 0.6, size: 0.45, life: 0.65 }); if (i % 3 === 0) V.burst('arcane', q, 1, { speed: 1.2, size: 0.22, life: 0.45 }); } } /* (the way he went: an unbroken trail of purple, three puffs to the metre) */
  lightning(A, B, '#a45cff'); lightning(A.clone().setY(A.y + 0.35), B.clone().setY(B.y - 0.2), '#7a2cff');
  V.burst('void', B, 70, { normal: true, speed: 5.5, size: 0.6, life: 0.75 }); V.burst('arcane', B, 40, { speed: 8, size: 0.32 }); V.burst('spark', B, 14, { speed: 6, size: 0.12 }); V.light(B, '#8a2cff', 6, 0.4, 12); V.ring(to, 3.3, '#9b4dff', 0.55); V.addShake(0.12); /* (where he lands: a burst of violet smoke and shards, a flash) */
  S.cast('arcane', to, 1.4); S.explode && S.explode(to, 0.22); }
let _slashTex = null;
// a red crescent slash mark swept through the air in front of a hero, level at chest height, flaring and fading fast
const RED_SLASH = { tex: null };
function redSlash(u, range) { if (!RED_SLASH.tex) { const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
    // a tapered crescent (thick in the middle, needle-thin at the tips): the gap between two arcs with offset centres
    const cres = (R, off, blur, col) => { g.save(); g.shadowColor = col; g.shadowBlur = blur; g.fillStyle = col; g.beginPath(); g.arc(256, 262, R, Math.PI * 1.08, Math.PI * 1.92); g.arc(256, 262 + off, R + off * 0.18, Math.PI * 1.9, Math.PI * 1.1, true); g.closePath(); g.fill(); g.restore(); };
    cres(232, 64, 30, 'rgba(150,0,0,0.55)'); cres(228, 48, 14, 'rgba(235,20,10,0.95)'); cres(224, 24, 6, 'rgba(255,120,90,1)'); cres(222, 9, 2, 'rgba(255,235,225,1)');
    RED_SLASH.tex = new THREE.CanvasTexture(c); RED_SLASH.tex.colorSpace = THREE.SRGBColorSpace; }
  /* normal blending (not additive) so it stays blood red over grass, sand or sky */
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.5), new THREE.MeshBasicMaterial({ map: RED_SLASH.tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  m.renderOrder = 5;
  // lying almost level in front of him (the arc's belly forward), its far edge lifted about 35 degrees so the camera behind him sees the whole crescent, and rolled a little for a diagonal cut
  const yw = u.yaw || 0, f = new THREE.Vector3(Math.sin(yw), 0, Math.cos(yw)), up = new THREE.Vector3(0, 1, 0), tilt = 0.6;
  const Y = f.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(up, Math.sin(tilt)), Z = up.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(f, -Math.sin(tilt)), X = new THREE.Vector3().crossVectors(Y, Z);
  m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z)); m.rotateOnWorldAxis(f, 0.22);
  const h = (u.eye || 1.7) * 0.55; m.position.set(u.pos.x + f.x * range * 0.32, u.pos.y + h, u.pos.z + f.z * range * 0.32);
  const w0 = range * 1.1; V.temp(m, 0.32, (o, t) => { const e = 1 - Math.pow(1 - Math.min(1, t * 2.2), 3); o.scale.set(w0 * (0.6 + 0.4 * e), w0 * 0.5 * (0.6 + 0.4 * e), 1); o.material.opacity = t < 0.08 ? t / 0.08 : Math.pow(1 - (t - 0.08) / 0.92, 1.6); if (t >= 0.98) { o.geometry.dispose(); o.material.dispose(); } }); }
function slashImpact(p, name) { if (!_slashTex) { const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d'); g.translate(128, 150); g.lineCap = 'round';
    for (const [w, a, col] of [[26, 0.25, '#ffb040'], [14, 0.6, '#ffe2a0'], [6, 1, '#ffffff']]) { g.strokeStyle = col; g.globalAlpha = a; g.lineWidth = w; g.beginPath(); g.arc(0, 0, 118, Math.PI * 1.18, Math.PI * 1.82); g.stroke(); }
    _slashTex = new THREE.CanvasTexture(c); _slashTex.colorSpace = THREE.SRGBColorSpace; }
  const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: _slashTex, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
  const back = /swing2|off|back/.test(name || ''), over = /swing3|smash|chop|heavy/.test(name || ''); m.material.rotation = over ? -1.25 + (Math.random() - 0.5) * 0.3 : (back ? -0.35 : 0.35) + (Math.random() - 0.5) * 0.4; m.position.copy(p); m.renderOrder = 999; m.scale.set(1.3, 0.65, 1);
  V.temp(m, 0.2, (mm, t) => { const k = 0.8 + t * 0.7; m.scale.set(1.3 * k, 0.65 * k, 1); m.material.opacity = (t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85); if (t >= 0.99) m.material.dispose(); }); }
function plerp(a, b, t) { return a.map((v, i) => v + (b[i] - v) * t); }
function seq(a, b, t, wind = 0.35, rest = VP.rest) { return t < wind ? plerp(rest, a, ease(t / wind)) : t < 0.72 ? plerp(a, b, easeOut((t - wind) / (0.72 - wind))) : plerp(b, rest, ease((t - 0.72) / 0.28)); }

// a detailed gripping hand: palm, four curled fingers, thumb, knuckles, class glove and cuff
// what each class wears on its hands and forearms in first person
const VM_KIND = { warrior: 'plate', paladin: 'plate', darkknight: 'plate', berserker: 'wraps', monk: 'wraps', ranger: 'leather', rogue: 'leather', musketeer: 'leather', blunderbuss: 'leather', beastmaster: 'leather', bard: 'leather', bombardier: 'leather' };
// a closed fist, knuckles forward (local +Y is the punch direction, the back of the hand on +Z), wrapped in cloth
// first person is right under your nose: rebuild every round shape there with far more segments (smooth, high-detail hands and weapons)
// first person with the musket: put each hand's wrist where that hand wraps the gun (the grip points in the musket's own frame: the wrist of the
// stock at the origin, under the barrel at the middle band, 0.56 up it), backed off toward its shoulder so the palm and fingers close on the wood
const GUN_GRIP = { R: [0, -0.015, -0.005, 0.07, 0.012, -0.02], L: [0, 0.56, 0, 0.065, -0.03, -0.035] }; /* [x, y, z on the gun, back off toward the shoulder, side, down] */
function gunHands(vm, F) { const g = vm.gun; g.updateMatrixWorld(true);
  for (const [H, sd] of [[vm.R, 'R'], [vm.L, 'L']]) { const wr = H.children[0] && H.children[0].userData.wrist, sh = F.B[sd === 'R' ? 'RightArm' : 'LeftArm']; if (!wr || !sh) continue; const q = GUN_GRIP[sd];
    const p = g.localToWorld(new THREE.Vector3(q[0], q[1] + (sd === 'L' ? 0.14 * (vm.gunK || 0) : 0), q[2])); /* (aimed, the left hand reaches further out along the barrel) */ vm.g.worldToLocal(p); const s0 = sh.getWorldPosition(new THREE.Vector3()); vm.g.worldToLocal(s0);
    const want = p.clone().addScaledVector(s0.sub(p).normalize(), q[3]); want.x += q[4]; want.y += q[5];
    H.visible = true; H.updateMatrixWorld(true); const cur = wr.getWorldPosition(new THREE.Vector3()); vm.g.worldToLocal(cur); H.position.add(want.sub(cur)); H.updateMatrixWorld(true); } }
function hdify(root) { root.traverse(o => { if (!o.isMesh || o.userData.hd || !o.geometry || !o.geometry.parameters) return; o.userData.hd = true; const g = o.geometry, P = g.parameters, up = (n, mx) => Math.min(mx, Math.max(n, Math.round(n * 2.5)));
  let ng = null; try { if (g.type === 'SphereGeometry') ng = new THREE.SphereGeometry(P.radius, up(P.widthSegments, 48), up(P.heightSegments, 32), P.phiStart, P.phiLength, P.thetaStart, P.thetaLength);
    else if (g.type === 'CylinderGeometry') ng = new THREE.CylinderGeometry(P.radiusTop, P.radiusBottom, P.height, up(P.radialSegments, 40), P.heightSegments, P.openEnded, P.thetaStart, P.thetaLength);
    else if (g.type === 'ConeGeometry') ng = new THREE.ConeGeometry(P.radius, P.height, up(P.radialSegments, 40), P.heightSegments, P.openEnded);
    else if (g.type === 'CapsuleGeometry') ng = new THREE.CapsuleGeometry(P.radius, P.length, up(P.capSegments, 12), up(P.radialSegments, 32));
    else if (g.type === 'TorusGeometry') ng = new THREE.TorusGeometry(P.radius, P.tube, up(P.radialSegments, 24), up(P.tubularSegments, 96), P.arc); } catch (e) { ng = null; }
  if (ng) o.geometry = ng; }); }
let _staffP = null; function loadStaff() { if (!_staffP) _staffP = import('three/addons/loaders/GLTFLoader.js').then(({ GLTFLoader }) => new Promise((res) => new GLTFLoader().load('models/staff_bone.glb', g => res(g.scene), undefined, () => res(null)))); return _staffP; } // (the bone staff model, loaded once)
function makeFist(right, skinCol, wrapCol = '#d8ccb0') { const g = new THREE.Group(), sx = right ? 1 : -1, C = new THREE.Color(skinCol || '#d8a888');
  const skin = new THREE.MeshStandardMaterial({ color: C, roughness: 0.62 }), skinD = new THREE.MeshStandardMaterial({ color: C.clone().multiplyScalar(0.84), roughness: 0.66 }), skinL = new THREE.MeshStandardMaterial({ color: C.clone().lerp(new THREE.Color('#ffd8c0'), 0.18), roughness: 0.5 }), wrap = new THREE.MeshStandardMaterial({ color: wrapCol, roughness: 0.92 }), nail = new THREE.MeshStandardMaterial({ color: C.clone().lerp(new THREE.Color('#f4d4cc'), 0.55), roughness: 0.3 });
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  const seg = (A, B, r, m, r2 = r) => { const d = B.clone().sub(A), L = d.length(), o = new THREE.Mesh(new THREE.CylinderGeometry(r2, r, Math.max(0.001, L), 12, 1, true), m); for (const [Q, rr] of [[A, r], [B, r2]]) { const c = new THREE.Mesh(new THREE.SphereGeometry(rr, 12, 8), m); c.position.copy(Q); g.add(c); } o.position.copy(A).add(B).multiplyScalar(0.5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); g.add(o); return o; }; // (a limb segment with rounded joints at both ends)
  const V = (x, y, z) => new THREE.Vector3(x * sx, y, z);
  // a real closed fist. Local +Y is where the knuckles point (the punch), +Z is the back of the hand, the thumb is on the -X side (mirrored for the left hand)
  const body = add(new THREE.SphereGeometry(0.05, 20, 14), skin, 0, 0.0, 0.0); body.scale.set(0.92, 0.9, 0.5); // (the back of the hand and the palm: broad and flat)
  add(new THREE.SphereGeometry(0.03, 14, 10), skinD, sx * -0.03, -0.022, -0.012).scale.set(0.8, 1.15, 0.85); // (the heel of the thumb)
  add(new THREE.SphereGeometry(0.028, 14, 10), skin, sx * 0.03, -0.026, -0.008).scale.set(0.8, 1.2, 0.8); // (the outer heel of the palm)
  for (let i = 0; i < 4; i++) { // index (thumb side) to little finger
    const x = -0.031 + i * 0.021, r = [0.0118, 0.0122, 0.0114, 0.0098][i], dy = [0, 0.002, 0, -0.006][i];
    const K = V(x, 0.042 + dy, 0.014), P = V(x * 1.02, 0.05 + dy, -0.02), M = V(x * 1.0, 0.022 + dy, -0.034);
    add(new THREE.SphereGeometry(r * 1.18, 12, 10), skinL, K.x, K.y, K.z); // (the knuckle standing up on the back of the hand)
    seg(V(x * 0.7, -0.02, 0.018), K, 0.0034, skinD); // (a tendon running back over the hand)
    seg(K, P, r * 1.08, skin, r); // (the first finger bone: the flat front face you hit with)
    seg(P, M, r * 0.98, skin, r * 0.9); // (the middle bone folded back down into the palm)
    const nl = add(new THREE.BoxGeometry(r * 1.45, r * 1.3, 0.003), nail, M.x, M.y - 0.006, M.z - r * 0.82); nl.rotation.x = 0.15; }
  // the thumb locks across the middle bones of the index and middle fingers
  seg(V(-0.04, -0.03, -0.004), V(-0.043, 0.0, -0.03), 0.015, skin, 0.0135); seg(V(-0.043, 0.0, -0.03), V(-0.014, 0.016, -0.05), 0.0135, skin, 0.012); seg(V(-0.014, 0.016, -0.05), V(0.006, 0.02, -0.05), 0.012, skin, 0.0108);
  { const nl = add(new THREE.BoxGeometry(0.003, 0.014, 0.016), nail, sx * 0.012, 0.022, -0.06); nl.rotation.y = sx * 0.2; }
  // the wrist, then a thin red wrap round the wrist and one over the knuckles' base, like the model's
  seg(V(0, -0.03, -0.002), V(0, -0.1, -0.004), 0.034, skin, 0.037).scale.set(1.12, 1, 0.78);
  for (const [y, h] of [[-0.06, 0.012], [-0.077, 0.01]]) { const b = add(new THREE.CylinderGeometry(0.0395, 0.0395, h, 18, 1, true), wrap, 0, y, -0.003); b.scale.set(1.12, 1, 0.8); b.material = wrap.clone(); b.material.side = THREE.DoubleSide; }
  const wrist = new THREE.Object3D(); wrist.position.set(0, -0.085, 0.0); g.add(wrist); g.userData.wrist = wrist;
  g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } }); return g; }
function makeHand(right, cls, skinCol) {
  const g = new THREE.Group(), sx = right ? 1 : -1;
  const skin = new THREE.MeshStandardMaterial({ color: skinCol, roughness: 0.55 }), skinD = new THREE.MeshStandardMaterial({ color: new THREE.Color(skinCol || '#d8a888').multiplyScalar(0.82), roughness: 0.6 });
  const kind = VM_KIND[cls] || 'cloth', PLATE = kind === 'plate';
  const glove = PLATE ? new THREE.MeshStandardMaterial({ color: cls === 'darkknight' ? '#4a4c56' : cls === 'paladin' ? '#c8ccd4' : '#aab2bc', roughness: 0.28, metalness: 0.9 }) : kind === 'leather' ? new THREE.MeshStandardMaterial({ color: cls === 'musketeer' ? '#2e2620' : '#5a3a20', roughness: 0.75 }) : kind === 'wraps' ? new THREE.MeshStandardMaterial({ color: '#d8ccb0', roughness: 0.9 }) : skin;
  const fingerM = cls === 'ranger' || cls === 'rogue' || kind === 'wraps' ? skin : glove; // rangers and rogues wear fingerless gloves; brawlers wrap their palms
  const nailM = new THREE.MeshStandardMaterial({ color: new THREE.Color(skinCol || '#d8a888').lerp(new THREE.Color('#ffe0e0'), 0.55), roughness: 0.25 });
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  const seg = (A, B, r, m) => { const d = B.clone().sub(A), L = d.length(), o = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, L - r * 0.6), 4, 8), m); o.position.copy(A).add(B).multiplyScalar(0.5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); g.add(o); return o; };
  // the palm: a flattened, rounded block on the handle's side, with the heel of the hand below
  const palm = add(new THREE.SphereGeometry(0.04, 16, 12), glove, sx * 0.033, -0.004, 0.006); palm.scale.set(0.78, 1.3, 1.08);
  add(new THREE.SphereGeometry(0.026, 12, 8), glove, sx * 0.03, -0.042, 0.016).scale.set(0.9, 0.8, 1.0);
  // four fingers wrap the handle (which runs along local Y through the origin): three segments each, knuckles, a nail
  const f0 = right ? Math.PI * 0.05 : Math.PI * 0.7, P = (r, f, y) => new THREE.Vector3(r * Math.cos(f), y, r * Math.sin(f));
  for (let i = 0; i < 4; i++) { const r = 0.028 - i * 0.0012, th = 0.0105 - i * 0.0009, y = 0.034 - i * 0.022, span = Math.PI * (1.22 - i * 0.03);
    const pts = [0, 0.38, 0.7, 1].map(k => P(r, f0 + (right ? 1 : 1) * span * k, y));
    for (let k = 0; k < 3; k++) seg(pts[k], pts[k + 1], th * (1 - k * 0.1), fingerM);
    for (let k = 0; k < 3; k++) { const kn = add(new THREE.SphereGeometry(th * (1.12 - k * 0.1), 8, 6), PLATE && k === 0 ? glove : fingerM, 0, 0, 0); kn.position.copy(pts[k]); kn.position.multiplyScalar(1.04); kn.position.y = y; }
    if (fingerM === skin) { const tip = pts[3], out = tip.clone().setY(0).normalize(); const nl = add(new THREE.BoxGeometry(0.011, 0.0035, 0.013), nailM, 0, 0, 0); nl.position.copy(tip).addScaledVector(out, th * 0.85); nl.position.y = y; nl.lookAt(nl.position.clone().add(out).setY(y)); nl.rotateX(Math.PI / 2); }
    if (PLATE) { const pl = add(new THREE.BoxGeometry(0.026, 0.017, 0.012), glove, 0, 0, 0); pl.position.copy(pts[1]).multiplyScalar(1.25); pl.position.y = y; pl.lookAt(0, y, 0); } }
  // tendons over the back of the hand toward the knuckles
  if (fingerM === skin || kind === 'wraps') for (let i = 0; i < 4; i++) { const y = 0.034 - i * 0.022; seg(new THREE.Vector3(sx * 0.05, y * 0.5 - 0.02, 0.026 - i * 0.002), new THREE.Vector3(sx * 0.033, y, 0.022), 0.0035, skinD); }
  // the thumb: two segments over the fingers, with a nail
  { const a0 = new THREE.Vector3(sx * 0.03, -0.012, -0.026), a1 = new THREE.Vector3(-sx * 0.0, 0.028, -0.036), a2 = new THREE.Vector3(-sx * 0.022, 0.04, -0.03);
    seg(a0, a1, 0.0125, fingerM); seg(a1, a2, 0.011, fingerM); const kn = add(new THREE.SphereGeometry(0.0125, 8, 6), fingerM, a1.x, a1.y, a1.z);
    if (fingerM === skin) { const nl = add(new THREE.BoxGeometry(0.012, 0.004, 0.014), nailM, a2.x - sx * 0.004, a2.y + 0.004, a2.z - 0.008); nl.rotation.set(0.3, 0, sx * 0.6); } }
  // back of the hand plate / glove detail
  if (PLATE) { const plate = add(new THREE.BoxGeometry(0.014, 0.085, 0.062), glove, sx * 0.064, 0, 0.012); for (let k = 0; k < 3; k++) add(new THREE.SphereGeometry(0.004, 6, 4), new THREE.MeshStandardMaterial({ color: '#d8b04a', metalness: 0.9, roughness: 0.3 }), sx * 0.072, -0.03 + k * 0.03, 0.035); }
  if (kind === 'leather') { const st = add(new THREE.BoxGeometry(0.012, 0.012, 0.07), new THREE.MeshStandardMaterial({ color: '#2a1a10', roughness: 0.7 }), sx * 0.06, -0.035, 0.014); }
  if (cls === 'wizard') { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0145, 0.004, 6, 14), new THREE.MeshStandardMaterial({ color: '#e0b040', metalness: 0.9, roughness: 0.3 })); ring.rotation.x = Math.PI / 2; ring.position.set(0, 0.011, 0); g.add(ring); const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.007), new THREE.MeshStandardMaterial({ color: '#8a40ff', emissive: '#6a20ff', emissiveIntensity: 1.2 })); gem.position.set(0, 0.011, -0.04); g.add(gem); }
  // wrist / cuff
  const cuffM = PLATE ? glove : kind !== 'cloth' ? new THREE.MeshStandardMaterial({ color: '#6a4628', roughness: 0.8 }) : null;
  const wrist = new THREE.Object3D(); wrist.position.set(sx * 0.05, -0.05, 0.022); g.add(wrist);
  if (cuffM) { const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.038, 0.07, 20), cuffM); cuff.position.y = -0.012; cuff.scale.z = 0.85; wrist.add(cuff); }
  if (cls === 'ranger') for (const y of [-0.016, 0.016]) { const strap = new THREE.Mesh(new THREE.TorusGeometry(0.043, 0.004, 4, 16), new THREE.MeshStandardMaterial({ color: '#2a1a0e' })); strap.rotation.x = Math.PI / 2; strap.position.y = y; wrist.add(strap); }
  if (cls === 'warrior') { const rim = new THREE.Mesh(new THREE.TorusGeometry(0.043, 0.006, 5, 16), new THREE.MeshStandardMaterial({ color: CLASSES.warrior.colors.trim, metalness: 0.9, roughness: 0.3 })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.022; wrist.add(rim); }
  g.userData.wrist = wrist;
  g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
  return g;
}
// a forearm, wrist (y = 0) to elbow (y = FORE): wrist bones, the muscle swelling below the elbow, a little flatter than round
const FORE = 0.34;
function foreGeo(k = 1) { const pr = [[0.024, -0.03], [0.027, 0.0], [0.03, 0.04], [0.036, 0.1], [0.044, 0.19], [0.046, 0.25], [0.043, FORE], [0.042, FORE + 0.02]].map(([r, y]) => new THREE.Vector2(r * k, y)); const g = new THREE.LatheGeometry(pr, 22); g.scale(1, 1, 0.84); return g; }
class ViewModel {
  constructor(camera, app, cls) {
    this.g = new THREE.Group(); camera.add(this.g);
    this.R = new THREE.Group(); this.L = new THREE.Group(); this.R.rotation.order = this.L.rotation.order = 'YXZ'; this.g.add(this.R, this.L);
    if (cls === 'necromancer') app = Object.assign({}, app, { skin: '#b8ae94' }); // (first person matches the 3D model: bony grey hands, dark worn armour)
    this.cls = cls; this.skinCol = app.skin; this.R.add(makeHand(true, cls, app.skin)); this.L.add(makeHand(false, cls, app.skin));
    const c = CLASSES[cls].colors;
    const vk = VM_KIND[cls] || 'cloth', ROBE = ['wizard', 'necromancer', 'cleric', 'druid', 'enchanter', 'elementalist', 'priest'].includes(cls);
    const sleeve = vk === 'plate' ? new THREE.MeshStandardMaterial({ color: cls === 'darkknight' ? '#3e4048' : '#8a929c', roughness: 0.35, metalness: 0.8 }) : new THREE.MeshStandardMaterial({ color: c.main, roughness: 0.85, side: THREE.DoubleSide });
    const trimM = new THREE.MeshStandardMaterial({ color: c.trim, roughness: 0.45, metalness: cls === 'ranger' ? 0 : 0.6 });
    if (cls === 'necromancer') { sleeve.color.set('#1e1a15'); sleeve.metalness = 0.55; sleeve.roughness = 0.5; trimM.color.set('#c8b890'); }
    const bare = !!((arenaSpec(cls) || {}).bareArms), skinA = new THREE.MeshStandardMaterial({ color: app.skin || '#d8a888', roughness: 0.55 }), veinM = new THREE.MeshStandardMaterial({ color: new THREE.Color(app.skin || '#d8a888').lerp(new THREE.Color('#5a6a8a'), 0.25), roughness: 0.5 });
    this.arms = [this.R, this.L].map((H, side) => {
      const arm = new THREE.Group(); this.g.add(arm); const sx = side ? -1 : 1;
      // the forearm itself: bare skin with veins for brawlers, a vambrace for plate, a fitted sleeve for the rest; casters' bell sleeves hang open over a bare wrist
      const fm = bare || ROBE ? skinA : vk === 'plate' ? sleeve : sleeve; const fore = new THREE.Mesh(foreGeo(vk === 'plate' ? 1.12 : ROBE || bare ? 1 : 1.06), fm); arm.add(fore);
      if (bare) for (let v = 0; v < 3; v++) { const a0 = -0.6 + v * 0.7, pts = []; for (let k = 0; k <= 6; k++) { const y = 0.02 + k * 0.045, rr = 0.0275 + y * 0.055, a = a0 + Math.sin(k * 1.3 + v) * 0.25; pts.push(new THREE.Vector3(Math.sin(a) * rr, y, Math.cos(a) * rr * 0.84)); } const vn = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.0028, 4, false), veinM); arm.add(vn); }
      if (ROBE) { const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.082, 0.26, 20, 3, true), new THREE.MeshStandardMaterial({ color: c.main, roughness: 0.85, side: THREE.DoubleSide })); const bp = bell.geometry.attributes.position; for (let i = 0; i < bp.count; i++) { const x = bp.getX(i), z = bp.getZ(i), y = bp.getY(i), an = Math.atan2(z, x), f = 1 + Math.sin(an * 7) * 0.06 * (0.5 - y / 0.26); bp.setXYZ(i, x * f, y, z * f + (y < 0 ? -0.012 * (-y / 0.13) : 0)); } bell.geometry.computeVertexNormals(); bell.position.y = 0.21; arm.add(bell); bell.userData.t = 0.15; const tr2 = new THREE.Mesh(new THREE.TorusGeometry(0.081, 0.006, 6, 28), trimM); tr2.rotation.x = Math.PI / 2; tr2.position.y = 0.08; arm.add(tr2); }
      if (!bare && !ROBE && vk !== 'plate') for (let k = 0; k < 3; k++) { const fold = new THREE.Mesh(new THREE.TorusGeometry(0.046 + k * 0.002, 0.004, 5, 20), sleeve); fold.rotation.set(Math.PI / 2 + (k - 1) * 0.12, 0, 0); fold.position.y = 0.2 + k * 0.045; arm.add(fold); }
      if (vk === 'plate') { const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.3, 0.012), sleeve); ridge.position.set(0, 0.17, 0.042); arm.add(ridge); const elb = new THREE.Mesh(new THREE.SphereGeometry(0.052, 14, 10), sleeve); elb.position.y = FORE; elb.scale.set(1, 0.8, 1); arm.add(elb); for (let i = 1; i < 4; i++) { const band = new THREE.Mesh(new THREE.TorusGeometry(0.044 + i * 0.003, 0.004, 4, 18), trimM); band.rotation.x = Math.PI / 2; band.position.y = i * 0.07; band.scale.z = 0.84; arm.add(band); } }
      // the rest (upper arm, off toward the elbow below the screen): a sleeve, or skin
      const geo = new THREE.CylinderGeometry(0.044, 0.05, 1, 20, 1, true); const m = new THREE.Mesh(geo, bare ? skinA : ROBE ? new THREE.MeshStandardMaterial({ color: c.main, roughness: 0.85, side: THREE.DoubleSide }) : sleeve); arm.add(m);
      const trim = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.006, 8, 24), trimM); trim.rotation.x = Math.PI / 2; trim.visible = !bare && !ROBE && vk === 'cloth'; arm.add(trim);
      if (vk === 'leather' || vk === 'wraps') { const br = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.044, 0.14, 20, 1, true), new THREE.MeshStandardMaterial({ color: vk === 'wraps' ? '#d8ccb0' : '#5a3a20', roughness: 0.8, side: THREE.DoubleSide })); br.scale.z = 0.86; br.position.y = 0.075; arm.add(br); for (let i = 0; i < 2; i++) { const st = new THREE.Mesh(new THREE.TorusGeometry(0.041 + i * 0.004, 0.004, 6, 20), new THREE.MeshStandardMaterial({ color: '#2a1a10', roughness: 0.7 })); st.rotation.x = Math.PI / 2; st.scale.y = 0.86; st.position.y = 0.035 + i * 0.07; arm.add(st); } }
      arm.traverse(o => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
      return { arm, m, trim, H };
    });
    this.anchor = [new THREE.Vector3(0.32, -0.8, 0.12), new THREE.Vector3(-0.32, -0.8, 0.12)];
    { const vk2 = VM_KIND[cls] || 'cloth', skinM = new THREE.MeshStandardMaterial({ color: app.skin || '#d8a888', roughness: 0.6 }), wrapM = new THREE.MeshStandardMaterial({ color: vk2 === 'wraps' ? '#d8ccb0' : vk2 === 'plate' ? '#9aa2ac' : '#3a2a1c', roughness: vk2 === 'plate' ? 0.35 : 0.85, metalness: vk2 === 'plate' ? 0.8 : 0 }), pantM = new THREE.MeshStandardMaterial({ color: CLASSES[cls].colors.main, roughness: 0.85 });
      // your leg for a flying side kick, built side-on: the sole faces forward (-z), the toes point left (-x), the leg runs back toward you (+z)
      const f = new THREE.Group(), bareF = vk2 === 'wraps', fm = bareF ? skinM : wrapM, nailF = new THREE.MeshStandardMaterial({ color: new THREE.Color(app.skin || '#d8a888').lerp(new THREE.Color('#ffe0e0'), 0.5), roughness: 0.25 }), add2 = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); f.add(o); return o; };
      add2(new THREE.CapsuleGeometry(0.04, 0.17, 6, 12), fm, -0.05, 0, 0.042).rotation.z = Math.PI / 2; // (the foot, sole forward: a full, rounded foot, not a board)
      add2(new THREE.SphereGeometry(0.046, 14, 10), fm, 0.045, 0, 0.034).scale.set(1, 0.95, 0.85); // (the heel: what you strike with)
      add2(new THREE.SphereGeometry(0.046, 14, 10), fm, -0.14, 0, 0.03).scale.set(0.8, 1.02, 0.7); // (the ball of the foot)
      add2(new THREE.SphereGeometry(0.04, 12, 8), fm, -0.05, 0.01, 0.052).scale.set(1.8, 0.9, 0.6); // (the arch and instep)
      if (bareF) for (let k = 0; k < 5; k++) { const yy = -0.034 + k * 0.017, r = k === 0 ? 0.013 : 0.0095 - k * 0.0006, L = k === 0 ? 0.03 : 0.024 - k * 0.002; const t = add2(new THREE.CapsuleGeometry(r, L, 4, 8), skinM, -0.19 - L * 0.4, yy, 0.03); t.rotation.z = Math.PI / 2; const nl = add2(new THREE.BoxGeometry(0.008, r * 1.4, 0.003), nailF, -0.19 - L * 0.85, yy, 0.03 + r * 0.95); } // (five toes, big to little, with nails)
      for (const yy of [-0.04, 0.04]) add2(new THREE.SphereGeometry(0.014, 8, 6), fm, 0.03, yy, 0.085); // (ankle bones)
      const shinG = new THREE.CylinderGeometry(0.046, 0.06, 0.5, 16); shinG.rotateX(Math.PI / 2); add2(shinG, bareF ? skinM : pantM, 0.03, 0, 0.34); // (the shin, running back toward you)
      const calf = add2(new THREE.SphereGeometry(0.06, 12, 10), bareF ? skinM : pantM, 0.03, -0.012, 0.42); calf.scale.set(1.05, 1, 2.1);
      const pantG = new THREE.CylinderGeometry(0.07, 0.085, 0.45, 16, 1, true); pantG.rotateX(Math.PI / 2); add2(pantG, new THREE.MeshStandardMaterial({ color: CLASSES[cls].colors.main, roughness: 0.85, side: THREE.DoubleSide }), 0.03, 0, 0.72); // (the trouser leg)
      for (let i = 0; i < 4; i++) { const b2 = new THREE.Mesh(new THREE.TorusGeometry(0.05 + i * 0.002, 0.007, 5, 16), wrapM); b2.position.set(0.03, 0, 0.11 + i * 0.035); f.add(b2); } // (ankle wraps)
      f.rotation.order = 'YXZ'; f.visible = false; f.traverse(o => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } }); this.g.add(f); this.foot = f; } // (your leg and foot for kicks, wrapped like the hands) // (the elbows: just below and behind the bottom edge of the screen, so a forearm never shows its cut end)
    this.weapons = {}; this.bob = 0; this.sprintK = 0;
  }
  setWeapon(w) {
    for (const k in this.weapons) { const o = this.weapons[k]; o.parent && o.parent.remove(o); }
    this.weapons = {}; this.wt = w ? w.wt : null; if (!w) return;
    const W = WEAPON_TYPES[w.wt];
    const main = makeWeapon(W.parts[0], w.tier, w.rarity, W.element);
    if (W.kind === 'bow') { this.L.add(main); main.scale.setScalar(0.42); this.weapons.bow = main; const ar = this.hero ? heroArrow() : new THREE.Group(); if (!this.hero) { const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.75, 5), new THREE.MeshStandardMaterial({ color: '#8a6a44' })); shaft.rotation.x = Math.PI / 2; shaft.position.z = -0.35; ar.add(shaft); const tip = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.07, 4), new THREE.MeshStandardMaterial({ color: '#999', metalness: 0.8 })); tip.rotation.x = -Math.PI / 2; tip.position.z = -0.74; ar.add(tip); } this.R.add(ar); this.weapons.arrow = ar; if (this.hero) ar.rotation.x = 1.5; } /* (the drawing hand is turned palm-down: the arrow turned with it so it points at the target, not the ground) */
    else if (W.kind === 'gun') { this.g.add(main); this.weapons.main = main; this.gun = main; }
    else { this.R.add(main); this.weapons.main = main; }
    if (W.kind !== 'gun') this.gun = null;
    if (W.kind === 'staff') main.position.y = -0.55;
    if (w.wt === 'spear') main.position.y = -0.55;
    if (W.hands === 'two' && w.wt !== 'spear') main.position.y = -0.1;
    if (W.kind === 'melee' && w.wt !== 'spear') main.rotation.y = this.cls === 'rogue' && this.hero ? 0 : (W.parts[0] === 'sword' || W.parts[0] === 'greatsword' || W.parts[0] === 'dagger') ? 0.45 : W.parts[0] === 'handaxe' || W.parts[0] === 'greataxe' ? Math.PI / 2 : 0; // swords show the blade at an angle; axe edges face forward
    if (W.hands === 'two' && w.wt !== 'spear') main.scale.multiplyScalar(0.8);
    if (W.parts[1]) { const off = makeWeapon(W.parts[1], w.tier, w.rarity); this.L.add(off); this.weapons.off = off; if (W.parts[1] === 'sword' || W.parts[1] === 'dagger') off.rotation.y = -0.45; if (W.parts[1] === 'handaxe') off.rotation.y = Math.PI / 2; if (W.parts[1] === 'shield') { off.rotation.set(0, 0, 0); off.scale.setScalar(0.46); off.position.set(0.06, 0.1, -0.13); } }
    for (const k in this.weapons) this.weapons[k].scale.multiplyScalar(1.5);
    if (W.kind === 'gun') main.scale.setScalar(0.62);
    if (w.wt === 'fists') { for (const k of ['main', 'off']) { const o = this.weapons[k]; if (o) { o.parent && o.parent.remove(o); delete this.weapons[k]; } } // (bare wrapped fists)
      if (!this.fists) { this.fists = true; for (const [H, right] of [[this.R, true], [this.L, false]]) { while (H.children.length) H.remove(H.children[0]); H.add(makeFist(right, this.cls === 'monk' ? '#c48a5e' : this.skinCol, this.cls === 'monk' ? '#8e1c1c' : undefined)); } } }
    if ((this.cls === 'musketeer' || this.cls === 'blunderbuss') && this.hero && this.gun) goblinGun(this.gun, this.cls); // (the goblin's own gun in first person too)
    if (this.hero) classKitFP(this); /* (each class's detailed weapon models in first person: the code-built stand-ins never show) */
    if (this.hero && this.weapons.main && (this.cls === 'paladin' || this.cls === 'cleric')) this.weapons.main.scale.multiplyScalar(this.cls === 'paladin' ? 1.4 : 0.55); /* (the paladin's winged hammer drawn at two-hander length; the cleric's scepter at one-hand size) */ if (this.hero && this.cls === 'priest' && this.weapons.main) { main.parent && main.parent.remove(main); delete this.weapons.main; } /* (the priest carries only his censer) */
    this.eleOrb = null; if (this.cls === 'elementalist' && this.hero && this.weapons.main) { const o = this.weapons.main; this.g.add(o); o.scale.multiplyScalar(0.5); this.eleOrb = o; } /* (the elementalist's orb is not held: it floats over his open palm, half size) */
    if (this.cls === 'paladin' && this.hero && main.name === 'weapon_greatsword' && !main.userData.glb && main.children.some(c => c.isMesh && c.visible)) { for (const c of main.children) if (c.isMesh) c.visible = false; const sg = new THREE.Group(); sg.scale.setScalar(1.2); main.add(sg); kitize(sg, 'warrior_sword', { fp: true }); } /* (a stand-in knight's blade only while the paladin has no detailed weapon of his own in CLASS_KIT) */
    if (this.weapons.heldR && this.cls === 'necromancer') this.weapons.heldR.scale.setScalar(0.8); /* (the scythe a little smaller in first person, so its blade hangs inside the top of the view) */
    if (this.cls === 'bard' && this.hero && main.name === 'weapon_sword') kitize(main, 'bard_lute', { fp: true }); /* (the bard's lute, held by the neck) */
    if (this.gun && w.wt === 'musket') for (const c of this.gun.children) if (c.isMesh && c !== this.gun.userData.glb) c.visible = false; /* (in first person only the detailed musket model shows: never the code-built stand-in) */
    if (this.cls === 'beastmaster' && this.hero) { for (const k of ['main', 'off']) { const o = this.weapons[k]; if (o) { o.parent && o.parent.remove(o); delete this.weapons[k]; } } if (!this.fists) { this.fists = true; for (const [H, right] of [[this.R, true], [this.L, false]]) { while (H.children.length) H.remove(H.children[0]); const f = makeFist(right, this.skinCol, '#3a2a1c'); H.add(f); const c = makeClaws(0.55); c.position.set(0, 0.03, 0.0); if (!right) c.scale.x = -1; H.add(c); kitize(c, 'beast_claw', { fp: true }); } } } // (bear-claw gauntlets on the fists in first person: beside the fist, not in it, so they show over the hero model's own hands)
    if (this.cls === 'wizard' && this.hero && !this.book) { main.parent && main.parent.remove(main); delete this.weapons.main; const bk = makeBook(1.0); bk.position.set(0, 0, 0.03); bk.rotation.set(Math.PI / 2, 0, 0); bk.scale.setScalar(1.04); /* (spine down the palm, the open pages turned toward you: right way up, 30% bigger than before) */ this.R.add(bk); this.book = bk; this.bookR = true; kitize(bk, 'wizard_book', { fp: true }); } // (the wizard carries only his spellbook, open in his right hand: no staff)
    this.rogueOff = false; if (this.cls === 'rogue' && this.hero && !this.weapons.off && W.parts.length === 1 && W.parts[0] === 'dagger') { const off = makeWeapon('dagger', w.tier, w.rarity); off.scale.multiplyScalar(this.hero ? 1.5 : 1); off.rotation.y = 0; /* (straight in the fist, like the right one) */ this.L.add(off); this.weapons.off = off; this.rogueOff = true; kitize(off, 'rogue_dagger', { fp: true }); } // (the rogue carries a second dagger in his left hand, like his model)
    if (this.cls === 'bombardier' && this.hero) { main.parent && main.parent.remove(main); delete this.weapons.main; while (this.R.children.length) this.R.remove(this.R.children[0]); this.R.add(makeFist(true, this.skinCol, '#3a2a1c')); const b = makeBomb(1.0); b.position.set(0, 0.018, -0.012); b.rotation.z = Math.PI / 2; this.R.add(b); /* (a closed fist, hand-sized, the grenade's stick through it and its head out above the thumb) */ this.weapons.bomb = b; this.bomber = true; kitize(b, 'bomb_grenade', { fp: true }); }
    if (this.cls === 'necromancer' && this.hero) { main.parent && main.parent.remove(main); delete this.weapons.main; this.necro = true;
      // left hand: a bone staff held upright (its head is where Soul Rend pours out); right hand: torn open and dripping poison
      // left hand: the fear spell's screaming skull, small, held up in the palm (Soul Rend pours from its mouth)
      const sk = makeFearSkull(true); sk.scale.setScalar(0.26); sk.position.set(0.01, 0.06, 0.0); sk.rotation.set(-0.15, Math.PI * 0.35, 0); /* (turned three-quarters toward you so you see its face) */ sk.traverse(o => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; o.visible = false; } }); /* (not drawn any more: it only marks where Soul Rend pours from) */ this.L.add(sk); this.weapons.skullL = sk;
      const tip = new THREE.Object3D(); tip.position.set(0, -0.17, 0.2); sk.add(tip); this.headMouth = tip;
      const fl = new THREE.Object3D(); fl.position.set(0, 0.03, -0.04); this.R.add(fl); this.weapons.flame = fl; // (where his spells leave the hand: no orb any more)
      /* (no glowing gashes or poison drips on his hand any more: both hands hold the scythe) */ }
    this.g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
    this.W = W;
  }
  setTool(tool, tier) { if (this.tool) { this.tool.parent.remove(this.tool); this.tool = null; } for (const k in this.weapons) this.weapons[k].visible = !tool; if (tool) { this.tool = makeWeapon(tool, tier); this.R.add(this.tool); this.tool.traverse(o => { if (o.isMesh) o.castShadow = false; }); } }
  apply(H, p) { H.position.set(p[0], p[1], p[2]); H.rotation.set(p[3], p[4], p[5]); }
  glueL(d, wrap) { this.twoHold = true; this.R.updateMatrixWorld(true); this.L.position.copy(this.R.localToWorld(new THREE.Vector3(0, -d, 0))); this.g.worldToLocal(this.L.position); this.L.rotation.copy(this.R.rotation); this.L.visible = true; if (wrap) this.wrapL(); } // (the left hand d further down the right hand's handle)
  // a support hand on a two-handed grip wraps the handle from the side its own forearm comes from (the left shoulder), turned round the handle to face it:
  // copying the right hand's angle as it is put the left palm on the far side of the hilt at one end of a swing, the wrist rolled over 180 degrees
  wrapL() { const q = this.L.quaternion, d = _wv.set(-0.3, -0.45, 0.1).sub(this.L.position).applyQuaternion(_wq.copy(q).invert()); /* (the shoulder, in the hand's own frame) */
    if (d.x * d.x + d.z * d.z < 1e-6) return; const th = Math.atan2(d.z, -d.x); q.multiply(_wq.setFromAxisAngle(_wy, th)); this.L.rotation.setFromQuaternion(q, 'YXZ'); } /* (turned about the handle so the palm, on its -x side, faces the shoulder) */
  update(dt, st) {
    const W = this.W, act = st.act;
    this.gunHold = false; this.twoHold = false;
    let r = W ? (W.kind === 'staff' ? VP.staff : this.wt === 'spear' ? VP.spRest : W.hands === 'two' ? VP.rest2 : VP.rest) : VP.rest;
    let l = !W ? VP.hideL : W.hands === 'shield' ? VP.shieldRest : W.hands === 'dual' ? VP.restL : W.kind === 'bow' ? (this.hero ? VP.heroBowL : VP.bowL) : W.kind === 'staff' ? VP.hideL : null;
    if (W && W.kind === 'bow') r = this.hero && st.aim > 0.01 ? plerp(VP.bowR, VP.bowRdraw, ease(Math.min(1, st.aim))) : VP.bowR; /* (aiming a bow draws the string back to the cheek) */
    if (this.hero && this.cls === 'warrior') { if (r === VP.rest) r = VP.warR; if (l === VP.shieldRest) l = VP.warShield; } /* (the warrior: sword upright in his right fist, the shield's back toward you on the left forearm, both clear of each other) */
    if (this.bomber && (r === VP.staff || r === VP.rest)) r = VP.bombR; if (this.eleOrb && r === VP.staff) r = VP.eleR;
    if (this.book && this.bookR) { if (r === VP.staff || r === VP.rest) r = VP.bookR; if (l === VP.hideL) l = null; } else if (this.book && (!l || l === VP.hideL)) l = VP.bookL; /* (the wizard's book rides in the right hand) */
    if (this.wt === 'fists' && !this.necro) { if (r === VP.rest || r === VP.rest2) r = VP.guardR; if (!l || l === VP.restL || l === VP.hideL) l = mirror(VP.guardR); }
    if (this.necro && this.weapons.heldR) { r = VP.necroScy; l = VP.necroL; } /* (both hands on the scythe; any swing or cast is a right-to-left reap) */
    else if (this.necro) { if (r === VP.staff || r === VP.staffCast) r = VP.necroR; if (!l || l === VP.hideL) l = VP.necroL; if (act && /^(cast|castRel|shoot|spell|release)/.test(act.name)) r = seq(VP.necroR, VP.necroPush, act.t, 0.18, VP.necroR); } // (the necromancer: an open spell hand on the right, the shrunken head held out on the left)
    if (this.rogueOff && (!l || l === VP.hideL)) l = VP.restL; /* (the rogue: a dagger in each hand) */
    const t = act ? act.t : 0; let n = act ? act.name : ''; if (this.rogueOff && n === 'stabR') { if (act !== this._altAct) { this._altAct = act; this._alt = !this._alt; } if (this._alt) n = 'stabL'; } /* (his stabs alternate hands) */
    if (this.weapons.main && n !== 'castUp' && !st.sheathed) this.weapons.main.visible = !this.hiddenAll; // the staff comes back after a cast
    if (st.tool) {
      if (n === 'chop' || n === 'mine') r = seq(n === 'chop' ? VP.chopA : VP.s3a, n === 'chop' ? VP.chopB : VP.s3b, t, 0.45);
      else r = plerp(VP.gatherR, VP.gatherR2, 0.5 + 0.5 * Math.sin(t * Math.PI * 4));
      l = W && W.kind === 'bow' ? VP.hideL : l;
      if (W && (W.kind === 'bow' || W.hands === 'dual' || W.kind === 'staff')) l = VP.hideL;
    } else if (W && W.kind === 'gun' && st.block && !act) {
      // blocking with a musket: held level across the body, stock to the left, barrel to the right
      if (this.gun && this.wt === 'musket') { this.gun.scale.setScalar(0.55); this.gun.rotation.order = 'YXZ'; this.gun.position.set(0.2, -0.17, -0.42); this.gun.rotation.set(-0.15, 0, Math.PI / 2 + 0.12); this.gunK = 0; } /* (the musket: stock at the right, barrel across to the left, so neither arm crosses the other) */
      else if (this.gun) { this.gun.position.set(0.05, -0.13, -0.4); this.gun.rotation.set(-0.15, 0, -Math.PI / 2 + 0.08); }
      r = [0.2, -0.2, -0.38, -1.25, 0, 0.6]; l = [-0.2, -0.19, -0.4, -1.25, 0, -0.6];
    } else if (W && W.kind === 'gun' && (!act || n === 'shoot' || n === 'draw' || n === 'release' || n === 'cast' || (this.hero && n === 'castUp'))) { /* (a hero's abilities keep the gun in both hands) */
      // musket at the hip, raised to the eye while aiming, with a kick on every shot
      // the musket sits in camera space: at the hip, or raised under the eye when aiming; the right hand holds the grip
      const k = st.aim || 0, rc = st.recoil || 0, gp = [lerp(0.24, 0.022, k), lerp(-0.27, -0.112, k), lerp(-0.5, -0.66, k) + rc * 0.07]; /* (aimed: the stock low at the shoulder, your eye just above it, looking along the barrel to the sights) */
      if (this.gun && this.wt === 'musket') { /* the detailed musket (camera-space numbers, less the view model's own offset): at the hip pointing in toward the crosshair; aimed, the stock at the cheek and the barrel running straight out from just under your eye, its front sight on the centre of the screen */
        const ke = k * k * (3 - 2 * k), e = lerp(0.12, 0.2017, ke) + rc * 0.2, ox = this.g.position.x, oy = this.g.position.y, oz = this.g.position.z;
        this.gun.rotation.order = 'YXZ'; this.gun.scale.setScalar(0.55); this.gun.position.set(lerp(0.13, 0, ke) - ox, lerp(-0.2, -0.1676, ke) - oy, lerp(-0.3, -0.3, ke) + rc * 0.05 - oz); this.gun.rotation.set(-Math.PI / 2 + e, lerp(0.12, 0, ke), 0); this.gunK = ke;
      } else if (this.gun && this.hero && this.cls === 'blunderbuss') { /* the hand-cannon: at the hip, canted a touch and angled in to the crosshair; aimed, the butt tucked into the shoulder and the bell running out low and right of your eye. Both hands are pinned to the gun after the walk bob (below) */
        const ke = k * k * (3 - 2 * k), ox = this.g.position.x, oy = this.g.position.y, oz = this.g.position.z; this.gun.rotation.order = 'YXZ'; this.gun.scale.setScalar(0.62);
        this.gun.position.set(lerp(0.2, 0.085, ke) - ox, lerp(-0.25, -0.182, ke) + rc * 0.02 - oy, lerp(-0.36, -0.29, ke) + rc * 0.07 - oz);
        this.gun.rotation.set(-Math.PI / 2 + lerp(0.08, 0.012, ke) + rc * 0.32, lerp(0.14, 0.004, ke), lerp(-0.14, 0, ke)); this.gunK = ke; this.gunHold = true;
      } else if (this.gun) { this.gun.position.set(gp[0], gp[1], gp[2]); this.gun.rotation.set(-Math.PI / 2 + rc * 0.22 + (1 - k) * 0.06 + k * 0.105 - (this.hero && this.cls === 'blunderbuss' ? 0.14 * (1 - k) : 0), (1 - k) * 0.05 - k * 0.03, 0); } /* (the blunderbuss at the hip: muzzle level with the crosshair, not tipped up) */
      r = [gp[0] + 0.01 + k * 0.03, gp[1] - 0.05 - k * 0.03, gp[2] + 0.14, -1.2, 0, 0.1]; l = [gp[0] - 0.02, gp[1] - 0.02 - k * 0.04, gp[2] - 0.22, -1.4, 0, -0.2];
    } else if (act) {
      const dual = W && W.hands === 'dual';
      switch (n) {
        case 'swing1': r = this.hero && (this.cls === 'warrior' || this.cls === 'berserker' || this.cls === 'paladin' || this.cls === 'darkknight') ? seq(VP.wSdA, VP.wSdB, t, 0.34) : seq(VP.s1a, VP.s1b, t, 0.3); if (this.hero && ((W && W.hands === 'two' && W.kind === 'melee') || this.cls === 'warrior')) r = [r[0], r[1] - 0.1, r[2] - 0.03, r[3], r[4], r[5]]; break; /* (a two-hander's side sweep passes through the lower third of the view, as in Skyrim, so the arms never wipe across the middle) */
        case 'swing2': r = this.hero && (this.cls === 'warrior' || this.cls === 'berserker' || this.cls === 'darkknight') ? seq(mirror(VP.wSdA), mirror(VP.wSdB), t, 0.34) : seq(VP.s2a, VP.s2b, t, 0.3); if (this.hero && ((W && W.hands === 'two' && W.kind === 'melee') || this.cls === 'warrior')) r = [r[0], r[1] - 0.1, r[2] - 0.03, r[3], r[4], r[5]]; break; /* (the warrior's backhand: the side slash mirrored, from the left across to the right, edge leading) */
        case 'lowcut': r = seq(VP.s2a, VP.s2b, t, 0.3); break;
        case 'sweep': r = seq(VP.s1a, VP.s1b, t, 0.3); break;
        case 'kick': break;
        case 'swing3': r = this.hero && (this.cls === 'warrior' || this.cls === 'berserker' || this.cls === 'paladin' || this.cls === 'darkknight') ? seq(VP.wOhA, VP.wOhB, t, 0.4) : seq(VP.s3a, VP.s3b, t, 0.42); if (dual) l = seq(mirror(VP.s3a), mirror(VP.s3b), t, 0.42, VP.restL); break;
        case 'off1': l = seq(mirror(VP.s1a), mirror(VP.s1b), t, 0.3, VP.restL); break;
        case 'off2': l = seq(mirror(VP.s2a), mirror(VP.s2b), t, 0.3, VP.restL); break;
        case 'charge': if (G.battleFx && SWORDS[this.wt]) { const k = Math.min(1, t); r = plerp(VP.rest, VP.ohA, ease(k)); if (this.wt === 'greatsword') l = null; break; }
        case 'charge': { const k = Math.min(1, t); r = plerp(this.wt === 'spear' ? VP.spRest : VP.rest, this.wt === 'spear' ? VP.th3A : VP.ha, ease(k)); r = r.map((v, i) => v + (i < 3 ? Math.sin(performance.now() * 0.05) * 0.004 * st.charge : 0)); if (dual) l = plerp(VP.restL, mirror(VP.ha), ease(k)); break; }
        case 'smash': r = seq(VP.ha, VP.hb, t, 0.5); if (dual || (W && W.hands === 'two')) l = seq(mirror(VP.ha), mirror(VP.hb), t, 0.5, VP.restL); break;
        case 'stabR': r = this.hero && (this.cls === 'warrior' || this.cls === 'berserker' || this.cls === 'paladin' || this.cls === 'darkknight') ? seq(VP.wStA, VP.wStB, t, 0.36) : seq(VP.thA, VP.thB, t, 0.3, VP.rest); break;
        case 'stabL': l = seq(mirror(VP.thA), mirror(VP.thB), t, 0.3, VP.restL); break;
        case 'spin': { const k = ease(Math.min(1, t / 0.8)); const a2 = lerp(-2.6, 2.6, k); r = [lerp(0.6, -0.6, k), -0.15, -0.42, -1.4, a2 * 0.55, 0.3]; l = [lerp(0.6, -0.6, (k + 0.15) % 1), -0.22, -0.42, -1.4, a2 * 0.55, -0.3]; break; }
        case 'heavy': if (G.battleFx && SWORDS[this.wt]) { r = seq(VP.ohA, VP.ohB, t, 0.12, VP.ohA); break; }
        case 'heavy': r = this.wt === 'spear' ? seq(VP.th3A, VP.th3B, t, 0.15, VP.th3A) : seq(VP.ha, VP.hb, t, 0.12, VP.ha); if (dual) l = seq(mirror(VP.ha), mirror(VP.hb), t, 0.12, mirror(VP.ha)); break;
        case 'thrust1': case 'thrust2': r = seq(VP.thA, VP.thB, t, 0.35, VP.spRest); break;
        case 'thrust3': r = seq(VP.th3A, VP.th3B, t, 0.4, VP.spRest); break;
        case 'area': case 'fury': { const k = n === 'fury' ? (t * 6) % 1 : ease(Math.min(1, t / 0.85)); const a = lerp(-2.4, 2.4, k); r = [lerp(0.6, -0.6, k), -0.2, -0.45, -1.4, a * 0.55, 0.3]; if (dual || n === 'fury') l = n === 'fury' ? [lerp(-0.6, 0.6, (t * 6 + 0.5) % 1), -0.25, -0.45, -1.4, -lerp(-2.4, 2.4, (t * 6 + 0.5) % 1) * 0.55, -0.3] : [lerp(-0.6, 0.6, k), -0.25, -0.45, -1.4, -a * 0.55, -0.3]; break; }
        case 'shoot': r = t < 0.5 ? plerp(VP.bowR, VP.bowRdraw, easeOut(t * 2)) : plerp(VP.bowRdraw, VP.bowR, (t - 0.5) * 2); break;
        case 'draw': r = plerp(VP.bowR, VP.bowRdraw, easeOut(Math.min(1, t))); break;
        case 'release': r = plerp(VP.bowRdraw, VP.bowR, ease(t)); break;
        case 'cast': r = seq(VP.staffCast, VP.staffCast, t, 0.3, VP.staff); if (W && W.kind === 'staff') l = seq(VP.castL, VP.castL, t, 0.3, VP.hideL); else l = seq(VP.castL, VP.castL, t, 0.3, l || VP.hideL); break;
        case 'castUp': if (this.hero && W && W.kind !== 'staff') { const k = Math.sin(Math.min(1, t) * Math.PI) * 0.5; r = plerp(r, VP.handUpR, k * 0.5); if (l) l = plerp(l, VP.handUpL, k * 0.5); break; } /* (a hero with a weapon keeps it in hand through an ability: the hands lift a little, never up past the view) */ r = plerp(VP.rest, VP.handUpR, ease(Math.min(1, t))); l = plerp(VP.restL, VP.handUpL, ease(Math.min(1, t))); if (this.weapons.main) this.weapons.main.visible = t < 0.15; break;
        case 'castRel': r = plerp(VP.handUpR, VP.handPushR, ease(Math.min(1, t * 2))); l = plerp(VP.handUpL, VP.handPushL, ease(Math.min(1, t * 2))); break;
        case 'chargeCast': r = plerp(VP.staff, VP.staffHigh, ease(Math.min(1, t))); l = plerp(VP.hideL, VP.castL, ease(Math.min(1, t))); break;
        case 'castBig': r = seq(VP.staffHigh, VP.staffSlam, t, 0.45, VP.staff); l = seq(VP.castL, VP.castL, t, 0.3, VP.hideL); break;
        case 'spell': l = seq(VP.castL, VP.castL, t, 0.25, l || VP.hideL); if (W && W.kind === 'staff') r = seq(VP.staffCast, VP.staffCast, t, 0.3, VP.staff); break;
      }
    } else if (st.channel && W && W.kind === 'staff') {
      const j = Math.sin(performance.now() * 0.03) * 0.004; r = [0.13 + j, -0.25 + j, -0.42, -1.48, 0.06, -0.1]; l = [-0.15, -0.24, -0.55, -1.4, 0, 0.12];
    } else if (st.block) {
      if (W && W.hands === 'shield') { l = this.hero && this.cls === 'warrior' ? VP.warBlock : VP.shieldBlock; } // just the shield comes up; the sword stays where it was
      else if (W && W.kind === 'staff') r = [0.05, -0.3, -0.5, -0.1, 0, 1.3];
      else if (W && W.kind === 'bow') { l = [0.02, -0.13, -0.44, -0.2, 0.1, 1.5]; r = [0.3, -0.42, -0.4, -0.4, 0, 0.4]; }
      else { r = this.hero && W && W.hands === 'two' ? [0.3, -0.28, -0.5, -0.25, 0.2, 0.7] : VP.blockW; if (W && W.hands === 'dual') l = [-0.12, -0.2, -0.45, -0.3, 0, -1.45]; } /* (a hero's two-hander blocks on the slant, the blade rising to the right, not flat across the view) */
    } else if (st.drawing) { r = plerp(VP.bowR, VP.bowRdraw, easeOut(Math.min(1, st.drawing))); }
    if (this.necro && !this.weapons.heldR && act && /^(cast|castRel|shoot|spell|release|chargeCast)/.test(n)) { // (the necromancer's right hand THRUSTS forward: a short draw back, a hard shove out to the crosshair, a beat at full reach, then back)
      const k = t < 0.1 ? -0.25 * ease(t / 0.1) : t < 0.26 ? -0.25 + 1.25 * easeOut((t - 0.1) / 0.16) : t < 0.45 ? 1 : 1 - ease((t - 0.45) / 0.55); r = plerp(VP.necroR, VP.necroPush, k); l = VP.necroL;
    } else if (this.necro && !this.weapons.heldR && st.channel) { const j = Math.sin(performance.now() * 0.03) * 0.004; r = plerp(VP.necroR, VP.necroPush, 0.85); r = [r[0] + j, r[1] + j, r[2], r[3], r[4], r[5]]; l = VP.necroL; }
    if (this.necro && this.weapons.heldR && !st.tool) { r = VP.necroScy; l = VP.necroL; if (act && /^(scythe|reap|swing|slash|cast|castRel|shoot|spell|release|heavy|smash)/.test(n)) r = seq(VP.necroScyA, VP.necroScyB, t, 0.3, VP.necroScy); } /* (whatever the act, the scythe stays in both hands: every attack is a right-to-left reap) */
    if (this.bomber && !st.tool) { r = VP.bombR; if (act) r = seq(VP.bombUp, VP.bombThrow, t, 0.35, VP.bombR); } /* (the bombardier: the grenade in his fist, an overhand lob on every throw) */
    if ((this.cls === 'rogue' || this.cls === 'beastmaster') && this.hero && !st.tool && W && W.kind === 'melee') { const bm = this.cls === 'beastmaster', R0 = bm ? VP.beastR : VP.rogR, RB = bm ? VP.beastBack : VP.rogBack, RS = bm ? VP.beastStab : VP.rogStab; /* (the beastmaster's claws turned inward and a little down) */ /* (the beastmaster the same with his claws on both fists) */ /* (the rogue: a dagger in each fist, low, blades pointing ahead; his stabs alternate hands) */
      if ((!act || n === 'castUp') && !st.block) { const k = n === 'castUp' ? Math.sin(Math.min(1, t) * Math.PI) * 0.6 : 0; r = plerp(R0, RB, k); l = mirror(r); if (this.weapons.main) this.weapons.main.visible = true; } /* (an ability: both daggers kept in hand, drawn back a little) */
      else if (act && /^(stab|swing|off|thrust|lowcut|sweep|heavy|smash)/.test(n)) { if (!(t >= (this._rgT || 0))) this._rgS = !this._rgS; this._rgT = t; const S2 = seq(RB, RS, t, 0.25, R0); r = R0; l = mirror(R0); if (n === 'sweep' && !bm) { r = S2; l = mirror(S2); } else if (this._rgS) l = mirror(S2); else r = S2; } } /* (the rogue's finishing spin: both blades at once) */
    if (this.book && this.bookR && !st.tool && act && /^(cast|spell|chargeCast|castBig|castRel|shoot|release)/.test(n)) r = seq(VP.bookCast, VP.bookCast, t, 0.25, VP.bookR); /* (casting: the open book pushed out toward the target) */
    this.punchR = this.punchL = 0;
    if (this.wt === 'fists' && act && !st.kick) { // (fists jab straight out instead of swinging like a blade)
      if (n === 'fury' || n === 'area' || n === 'spin') { const q = (t * 7) % 1, side = Math.floor(t * 7) % 2; const kq = q < 0.35 ? easeOut(q / 0.35) : 1 - ease((q - 0.35) / 0.65), J = plerp(VP.jabA, VP.jabB, kq); if (side) { l = mirror(J); r = VP.guardR; this.punchL = kq; } else { r = J; l = mirror(VP.guardR); this.punchR = kq; } }
      else if (/^(swing|off|heavy|stab|smash|lowcut|sweep|charge|thrust)/.test(n)) { // a real punch: snap straight out to the crosshair, the fist turning over, a beat at full reach, back to the guard; the other hand stays up
        const left = n.startsWith('off') || n === 'stabL' || n === 'swing2', k = t < 0.28 ? easeOut(t / 0.28) : t < 0.42 ? 1 : 1 - ease((t - 0.42) / 0.58), J = plerp(VP.jabA, VP.jabB, k), G2 = plerp(VP.guardR, [0.24, -0.2, -0.26, -1.2, -0.2, -0.6], k * 0.6);
        if (left) { l = mirror(J); r = G2; this.punchL = k; } else { r = J; l = mirror(G2); this.punchR = k; } this.punchK = k; } }
    if (st.superman) { const sk = Math.sin(Math.min(1, st.superman * 1.4) * Math.PI * 0.5); r = plerp(r, [0.04, -0.14, -1.0, -1.57, 0, 0], sk); if (l) l = plerp(l, [-0.3, -0.45, -0.3, -0.6, 0, 0.3], sk); }
    if (st.kick) { const kk = Math.sin(Math.min(1, st.kick * 1.3) * Math.PI * 0.5); r = plerp(r, VP.kickDown, kk); if (l) l = plerp(l, mirror(VP.kickDown), kk); }
    if (this.foot) { const kk = st.kick ? Math.sin(Math.min(1, st.kick * 1.25) * Math.PI * 0.5) * (st.kick > 0.85 ? (1 - st.kick) / 0.15 : 1) : 0; this.foot.visible = kk > 0.02; if (this.foot.visible) { const ch = Math.min(1, kk / 0.45), ex = Math.max(0, (kk - 0.35) / 0.65), e2 = ex * ex * (3 - 2 * ex); this.foot.position.set(0.22 - 0.16 * e2, -0.62 + 0.18 * ch + 0.3 * e2, -0.3 - 0.52 * e2); this.foot.rotation.set(0.95 - 0.6 * e2, 0.45 - 0.2 * e2, 0); } } // (a flying side kick: the knee chambers up, then the heel drives straight out at the crosshair, sole first)
    // sprinting: lower the weapon and pump the arms
    this.sprintK += ((st.sprint && !act && !st.block && !st.tool ? 1 : 0) - this.sprintK) * Math.min(1, dt * 8);
    if (this.sprintK > 0.01) {
      const k = this.sprintK, dip = (p) => p && [p[0], p[1] - 0.05 * k, p[2] + 0.02 * k, p[3] - 0.1 * k, p[4], p[5]]; /* (sprinting: the weapons dip a little and tip forward, the same grip, never turned sideways) */
      r = dip(r); if (l) l = dip(l);
    }
    if (act && this.hero && this.cls === 'warrior' && l && W && W.hands === 'shield' && /^(swing|stab)/.test(n)) { const k = Math.sin(Math.min(1, Math.max(0, t)) * Math.PI); l = plerp(l, [-0.68, -0.64, -0.36, 0.25, 0.95, 0.4], k * 0.9); } /* (the shield arm swings down and out to the left, clear of the blade, then comes back) */
    { const k = 1 - Math.exp(-Math.min(0.1, dt) * 30), sm = (o, p) => !o || !p ? p : p.map((v, i) => { const d = v - o[i]; return Math.abs(d) > 2.5 ? v : o[i] + d * k; }); r = this._sr = sm(this._sr, r); if (l) l = this._sl = sm(this._sl, l); else this._sl = null; } /* (a short smoothing on both hands: a pose that changes in a single frame, between chained swings or as an ability starts, glides instead of popping through the view) */
    // two-handers: left hand on the grip below the right
    this.apply(this.R, r);
    if (this.necro && this.weapons.heldR && !st.tool) { this.R.updateMatrixWorld(true); this.L.position.copy(this.R.localToWorld(new THREE.Vector3(0, -VP.necroGap, 0))); this.g.worldToLocal(this.L.position); this.L.rotation.copy(this.R.rotation); this.L.visible = true; } /* (the necromancer's left hand low on the scythe's shaft, near the bottom of the view) */
    else if (W && W.hands === 'two' && W.kind !== 'gun' && !st.tool) this.glueL(this.wt === 'greataxe' && this.hero ? 0.27 : 0.14, true);
    else if (l) { this.apply(this.L, l); this.L.visible = true; } else this.L.visible = false;
    // bob & sway: arms swing with each stride, harder and faster when sprinting
    this.bob += dt * (3.2 + Math.min(st.speed, 8) * 0.75); /* (a steady stride: quicker when sprinting, never frantic) */
    const run = Math.min(1, st.speed / 5) * (act ? 0.35 : 1), amp = run * (0.016 + this.sprintK * 0.008); /* (running and sprinting: a smooth front-and-back roll, the two hands alternating, never thrashing) */
    const ph = this.bob;
    const spread = run * 0.05;
    this.R.position.x += spread; this.R.position.y -= spread * 0.6; this.R.rotation.z -= spread * 1.2;
    if (this.L.visible && !(W && W.hands === 'two')) { this.L.position.x -= spread; this.L.position.y -= spread * 0.6; this.L.rotation.z += spread * 1.2; }
    this.R.position.y += Math.sin(ph) * amp; this.R.position.x += Math.cos(ph * 0.5) * amp * 0.6; this.R.position.z += Math.cos(ph) * amp * 1.6; this.R.rotation.z += Math.sin(ph) * amp * 0.3; this.R.rotation.x += Math.cos(ph) * amp * 1.2;
    if (this.L.visible && !(W && W.hands === 'two')) { this.L.position.y += Math.sin(ph + Math.PI) * amp; this.L.position.x += Math.cos(ph * 0.5) * amp * 0.6; this.L.position.z += Math.cos(ph + Math.PI) * amp * 1.6; this.L.rotation.x += Math.cos(ph + Math.PI) * amp * 1.2; }
    if (this.necro && this.weapons.heldR && !st.tool) this.glueL(VP.necroGap); else if (W && W.hands === 'two' && W.kind !== 'gun' && !st.tool) this.glueL(this.wt === 'greataxe' && this.hero ? 0.27 : 0.14, true); /* (a hand on the same shaft rides with the other through the bob: the grip never slides off the handle) */
    if (this.gunHold && this.gun) { const gn = this.gun; gn.position.x += spread * 0.6; gn.position.y += Math.sin(ph) * amp - spread * 0.4; gn.position.z += Math.cos(ph) * amp * 1.6; gn.rotation.x += Math.cos(ph) * amp * 0.8; gn.updateMatrix(); /* (the walk bob moves the gun, and the hands go with it) */
      for (const [H, gp2, dir] of [[this.R, BB_GRIP.R, BB_GRIP.Ry], [this.L, BB_GRIP.L, BB_GRIP.Ly]]) { H.position.copy(gp2).applyMatrix4(gn.matrix); H.quaternion.copy(gn.quaternion).multiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)); H.visible = true; } } /* (right hand round the pistol grip, left cupped under the fore-end: fingers wrap the wood, wrists straight) */
    const bob = settings.headBob ? Math.abs(Math.sin(this.bob)) * 0.01 * run : 0;
    this.g.position.set(st.swayX + (this.hero ? 0.035 : 0), -0.04 - (this.hero ? 0.03 : 0) - bob - 0.004 * Math.sin(performance.now() * 0.0015) + st.swayY, -0.16);
    if (this.eleOrb) { const o = this.eleOrb, gl = o.userData.glb; if (gl && !o.userData.c0) { o.updateMatrixWorld(true); const bx = new THREE.Box3().setFromObject(gl), c = bx.getCenter(new THREE.Vector3()); o.userData.c0 = o.worldToLocal(c); }
      const c0 = o.userData.c0 || new THREE.Vector3(0, 0.5, 0), tm = performance.now() * 0.001; o.rotation.set(0, tm * 0.8, 0); o.updateMatrix(); const off = c0.clone().multiply(o.scale).applyEuler(o.rotation);
      o.position.set(this.R.position.x - 0.045, this.R.position.y + 0.2 + Math.sin(tm * 2.4) * 0.012, this.R.position.z - 0.03).sub(off); } /* (hovering a hand's width above the palm with a gentle bob, turning slowly) */
    this.hdT = (this.hdT || 0) - dt; if (this.hdT <= 0) { this.hdT = 1; hdify(this.g); } // (anything new in view gets the high-detail treatment)
    if (this.drips && this.R.visible) { this.dripT = (this.dripT || 0) - dt; const hp = this.R.getWorldPosition(new THREE.Vector3()); this.g.worldToLocal(hp);
      if (this.dripT <= 0) { this.dripT = 0.9 + Math.random() * 1.1; const d = this.drips.find(q => q.life <= 0); if (d) { d.life = 0.9; d.m.visible = true; d.m.position.copy(hp).add(new THREE.Vector3((Math.random() - 0.5) * 0.03, -0.03, 0.01)); d.v.set((Math.random() - 0.5) * 0.04, -0.05, 0); d.m.material.opacity = 0.75; } }
      for (const d of this.drips) { if (d.life <= 0) continue; d.life -= dt; d.v.y -= 1.6 * dt; d.m.position.addScaledVector(d.v, dt); d.m.material.opacity = Math.max(0, d.life / 0.9) * 0.9; if (d.life <= 0) d.m.visible = false; } } // (poison running off the hand and falling away)
    if (this.weapons.head) { const dg = this.weapons.head, sw = dg.userData.sw; this.L.updateMatrix(); const qL = this.L.quaternion.clone().invert(); const tx = Math.sin(this.bob) * 0.18 * Math.min(1, st.speed / 5) + (act ? 0.25 : 0), tz = Math.cos(this.bob * 0.5) * 0.12 * Math.min(1, st.speed / 5);
      sw.vx += (tx - sw.ax) * 60 * dt; sw.vz += (tz - sw.az) * 60 * dt; const dmp = Math.exp(-4 * dt); sw.vx *= dmp; sw.vz *= dmp; sw.ax += sw.vx * dt; sw.az += sw.vz * dt; dg.quaternion.copy(qL.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(sw.ax - 0.15, 0.85, sw.az)))); /* (face toward the enemy, away from you) */
      sw.lk = (sw.lk || 0) + ((st.rendAt ? 1 : 0) - (sw.lk || 0)) * Math.min(1, dt * 6); if (sw.lk > 0.01 && (st.rendAt || sw.lastAt)) { if (st.rendAt) sw.lastAt = st.rendAt.clone(); const cam = this.g.parent; cam.updateMatrixWorld(true); const tc = sw.lastAt.clone().applyMatrix4(cam.matrixWorldInverse), hp = new THREE.Vector3(); dg.getWorldPosition(hp); hp.applyMatrix4(cam.matrixWorldInverse); const dir = tc.sub(hp).normalize(); const qT = qL.clone().multiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir)); dg.quaternion.slerp(qT, sw.lk); } /* (Soul Rend: it turns its face to the victim) */
      if (this.weapons.flame) { const f = 1 + Math.sin(performance.now() * 0.02) * 0.15; this.weapons.flame.scale.setScalar(f); if (this.weapons.flame2) this.weapons.flame2.scale.setScalar(f * (1.1 + Math.sin(performance.now() * 0.013) * 0.1)); } }
    // bow string pull
    if (this.weapons.bow) { const s = this.weapons.bow.userData.string; const pull = Math.max(st.drawing ? Math.min(1, st.drawing) : n === 'shoot' && t < 0.5 ? easeOut(t * 2) : 0, this.hero && !act ? Math.max(0.25, Math.min(1, st.aim || 0)) : 0); const a = s.geometry.attributes.position; a.setZ(1, (this.weapons.bow.userData.stringZ || 0.02) + pull * (this.hero ? 0 : 0.42)); this._bowPull = pull; /* (a hero ranger always holds the string part-drawn, back toward the cheek in full when aiming) */ a.needsUpdate = true; { const fl = this.weapons.arrow.userData.flame; if (fl) { const tm = performance.now() * 0.001, f = 0.85 + 0.15 * Math.sin(tm * 23) + 0.1 * Math.sin(tm * 37); fl.scale.set(f, 1.5 + 0.4 * Math.sin(tm * 29), f); fl.material.opacity = 0.6 + 0.2 * Math.sin(tm * 31); } } /* (the tip's flame flickers) */ this.weapons.arrow.visible = this.hero ? !(n === 'shoot' && t > 0.5 && t < 0.8) : pull > 0.05 || st.drawing > 0; } /* (a hero always has an arrow nocked, so the drawing hand always holds it: no open palm popping in after a shot) */
    // a hero archer: the drawing hand sits on the string's nocking point (drawn back with it), the arrow laid from the fingers to the riser
    if (this.hero && this.weapons.bow && this.weapons.arrow && this.L.visible && !st.tool) { const bw = this.weapons.bow, sg = bw.userData.string; if (sg) { const pa = sg.geometry.attributes.position; this.g.updateMatrixWorld(true);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.L.quaternion), rest = this.L.position.clone().addScaledVector(up, 0.045); /* (the arrow rest: just above the bow hand, on the riser) */
      const pl = this._bowPull || 0, arc = Math.sin(Math.min(1, pl) * Math.PI) * (pl > 0.3 ? 1 : pl / 0.3), rq = n === 'shoot' && t > 0.42 && t < 0.88 ? Math.sin((t - 0.42) / 0.46 * Math.PI) : 0, nock = rest.clone().add(new THREE.Vector3(0.05 + pl * 0.07 + arc * 0.07 + rq * 0.16, -0.065 + pl * 0.03 - arc * 0.07 - rq * 0.3, 0.26 + pl * 0.5 + rq * 0.2)); /* (after the loose the empty hand dips down to the right, out of the view, for the next arrow, then comes back to nock it) */ /* (mid-draw the hand travels low and out to the right, so the forearm stays at the edge of the view until the string reaches the cheek) */ this.bowDraw = Math.max(0, (pl - 0.3) / 0.7); /* (full draw: the nock comes back past your cheek, so the hand leaves the view and only the arrow and string run off the bottom right, as in Skyrim) */ /* (the nock: straight back toward your cheek, further when drawn) */
      pa.setXYZ(1, ...sg.worldToLocal(this.g.localToWorld(nock.clone())).toArray()); pa.needsUpdate = true; /* (the string bends back to meet the fingers) */
      const dir = rest.clone().sub(nock); if (dir.lengthSq() > 1e-6) { dir.normalize(); this.R.position.copy(nock); const qA = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
        const Y = up.clone().addScaledVector(dir, -up.dot(dir)).normalize(), X = dir.clone().negate(), Z = new THREE.Vector3().crossVectors(X, Y).normalize(); X.crossVectors(Y, Z); const qH = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z)); /* (the drawing hand closes round the string, not the shaft: its grip line runs along the string, fingers hooked forward toward the bow) */
        this.R.quaternion.copy(qH); this.weapons.arrow.quaternion.copy(qH.clone().invert().multiply(qA)); this.R.visible = true; } } }
    // forearms follow from the wrist down toward the elbow (off screen)
    for (let i = 0; i < 2; i++) {
      const { arm, m, trim, H } = this.arms[i]; arm.visible = false;
      if (this.noCodeArms) { if (H.children[0] && H.children[0].userData.wrist) H.children[0].visible = false; continue; } /* (a class with a 3D model never shows the old code-built arms, not even while its own arms load) */
      if (!H.visible) continue; arm.visible = true;
      const wr = H.children[0].userData.wrist;
      const w = new THREE.Vector3(); wr.getWorldPosition(w); this.g.worldToLocal(w);
      const a = this.anchor[i], d = a.clone().sub(w), len = d.length(); d.normalize();
      arm.position.copy(w); arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
      const rest = Math.max(0.01, len - FORE); m.scale.set(1, rest, 1); m.position.set(0, FORE + rest / 2 - 0.01, 0); /* (the forearm keeps its shape; only the sleeve beyond the elbow stretches) */
      trim.position.set(0, 0.035, 0);
    }
    const F = this.fpArms && this.fpArms !== 'loading' ? this.fpArms : null, mk = F && this.gun && this.wt === 'musket' && this.gun.visible !== false && !st.tool; if (F) { F.reach = mk ? 1.65 + 0.2 * (this.gunK || 0) : 1.35; if (!F.wrap0) F.wrap0 = F.wrap.position.clone(); F.wrap.position.copy(F.wrap0); if (mk) F.wrap.position.z -= 0.14; } /* (a musket is long: the arms a little longer and the shoulders forward, out of sight below the view, so both hands reach it) */
    if (mk) gunHands(this, F); /* (both hands on the musket: right round the wrist of the stock at the trigger, left cradling the fore-end) */
    if (this.fpArms) tickFpArms(this); // (a class with a 3D model: its own arms in first person)
    if (mk) for (const nm of ['LeftHand', 'RightHand']) if (F.B[nm] && !(F.code && F.code[nm === 'LeftHand' ? 'Left' : 'Right'])) F.B[nm].scale.setScalar((F.D.fpHand || 1.15) * 1.35 / F.reach * (nm === 'RightHand' ? 1 - 0.75 * (this.gunK || 0) : 1)); /* (aimed, the trigger hand tucks away under the stock so it never blocks the sights) */ /* (the hands stay their own size) */
  }
}

// ---------- Player ----------
const SWORDS = { sword: 1, swordshield: 1, swordmace: 1, greatsword: 1 };
const HEAL_K = { cleric: 1, druid: 1, shaman: 1, bard: 1, monk: 1, priest: 1, bombardier: 0.4, warrior: 0.8, berserker: 0.8, rogue: 0.5, enchanter: 0.6, paladin: 0.6, ranger: 0.35, beastmaster: 0.35, darkknight: 0.4, necromancer: 0.8 }; // shadow knights and necromancers heal only by draining: the knight a little, the necromancer a lot
// bard songs: a colour per kind of song (healing is green)
const SONG_COL = { war: '#ff5a4a', travel: '#6ae8ff', heal: '#6aff8a', ward: '#ffd86a', flame: '#ff9a2a', mana: '#7a7aff', power: '#d070ff', endure: '#ffe07a', mward: '#a0b8ff', snare: '#8aa0a0', weaken: '#9a60c0' };
const NOTE_TEX = {};
function noteTex(col, ch) { const k = col + ch; if (NOTE_TEX[k]) return NOTE_TEX[k]; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.font = 'bold 50px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = col; g.shadowBlur = 14; g.fillStyle = col; g.fillText(ch, 32, 34); g.shadowBlur = 0; g.fillStyle = '#ffffff'; g.globalAlpha = 0.5; g.fillText(ch, 32, 34);
  const t = new THREE.CanvasTexture(c); NOTE_TEX[k] = t; return t; }
// Kingdom Battles class tuning, from the class balance test (damage per second x toughness, levels 1, 5 and 10)
const CLASS_TUNE = { warrior: { dmg: 1.05, hp: 1 }, berserker: { dmg: 0.88, hp: 1 }, ranger: { dmg: 1.1, hp: 1.08 }, wizard: { dmg: (L) => 0.8 * (1 + 0.35 * (LEVEL_CAP - L) / (LEVEL_CAP - 1)), hp: 1.12 }, musketeer: { dmg: 1, hp: 1.05 }, shaman: { dmg: 0.59, hp: 0.74 }, ...Object.fromEntries(Object.entries(NEW_CLASSES).map(([id, c]) => [id, c.tune || { dmg: 1, hp: 1 }])), none: { dmg: 1, hp: 1 } };
// campaign balance (from the balance model: every class within about 15% of the others' solo strength, each by its role)
const CAMP_TUNE = {}; // no hidden class multipliers in the campaign: classes balance through their abilities
export const campTune = (cls) => (G.newFx && CAMP_TUNE[cls]) || { dmg: 1, hp: 1 };
export class Player {
  constructor(hero) {
    this.h = hero;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.yaw = 0; this.pitch = 0; this.bodyYaw = 0;
    this.radius = 0.4; this.onGround = true; this.swim = false; this.dead = false;
    this.camDist = 3.2; this.camDistT = 3.2;
    this.cd = { w0: 0, w1: 0, a1: 0, a2: 0, a3: 0, dodge: 0 }; this.useCd = 0;
    this.atk = null; this.queued = null; this.combo = 0; this.comboT = 0; this.press = null; this.block = false;
    this.dodge = null; this.iframes = 0; this.stealth = 0; this.buffs = { cry: 0, fury: 0, nextCrit: false }; this.regen = null;
    this.gathering = null; this.hurtT = 0; this.stepAcc = 0; this.lastSurf = 'grass'; this.endUseT = 0; this.manaUseT = 0;
    this.fb = {}; this.swayX = 0; this.swayY = 0; this.fovKick = 0; this.landDip = 0; this.lookDX = 0; this.lookDY = 0;
    const app = Object.assign({ race: hero.race, sex: hero.sex, cls: hero.cls }, hero.app);
    this.app = app;
    this.vm = new ViewModel(G.vmCam, app, hero.cls); this.vm.hero = !!hero.arena; if (hero.arena) { attachFpArms(this.vm, hero.cls); if (hasHeroModel(hero.cls)) { this.vm.noCodeArms = true; for (const H of [this.vm.R, this.vm.L]) if (H.children[0]) H.children[0].visible = false; if (this.vm.arms) for (const a of this.vm.arms) a.arm.visible = false; } } /* (the old code-built arms and hands never show, not even while the model's own arms load) */ // (the arena: the weapon sits lower and further right, out of the way)
    this.trail = V.trail('#ffffff'); this.trailL = V.trail('#ffffff'); for (const t of [this.trail, this.trailL]) if (t && t.mat) t.mat.visible = false; /* (the owner: no weapon trails) */
    this.refreshGear(true);
    this.eye = this.h.arena && hasHeroModel(this.h.cls) ? heroHeight(this.h.cls) * 0.92 : this.ch.height * 0.9; /* (first person sees from the hero model's own eye height, not the hidden built body's) */
    const D = heroDerived(hero); this.hp = this.maxHp; this.mana = this.maxMana; this.end = this.maxEnd;
  }
  get level() { return this.h.level; }
  pk(id) { return perk(this.h, id); }
  wp() { return 0; }
  skills() { const w = this.weapon; return w ? slotSkills(w.wt, this.h.wsel || {}) : []; }
  get weapon() { return activeWeapon(this.h); }
  get W() { const w = this.weapon; return w ? WEAPON_TYPES[w.wt] : null; }
  hpK() { return campTune(this.h.cls).hp * Game.arenaHpK(this.h); } // no per-class health scaling in either mode: classes are balanced through their abilities
  refreshStatsOnly() { const D = heroDerived(this.h); this.D = D; this.maxHp = Math.round(D.maxHp * this.hpK()); this.hp = Math.min(this.hp, this.maxHp); this.maxMana = D.maxMana; this.maxEnd = D.maxEnd; }
  refreshGear(first) {
    this.sheathed = false;
    { const aw = activeWeapon(this.h); if (aw && Game.seeWeapon(this.h, aw.wt) && !first) G.hooks.newWeapon && G.hooks.newWeapon(aw.wt); }
    const D = heroDerived(this.h); this.D = D;
    const oldMax = this.maxHp || D.maxHp;
    this.maxHp = Math.round(D.maxHp * this.hpK()); this.maxMana = D.maxMana; this.maxEnd = D.maxEnd;
    if (!first) { this.hp = Math.min(this.maxHp, this.hp * (this.maxHp / oldMax)); this.mana = Math.min(this.mana, this.maxMana); this.end = Math.min(this.end, this.maxEnd); }
    const w = this.weapon;
    // rebuild the body so armour colours and the weapon bake into few meshes
    const old = this.ch; const vis = old ? old.root.visible : true;
    if (old) G.scene.remove(old.root);
    const arenaLook = this.h.arena && !this.lichForm; // Kingdom Arena: one signature look per class, no gear
    this.ch = buildHumanoid(this.lichForm ? Object.assign({}, this.app, { kind: 'skeleton' }) : arenaLook ? Object.assign({}, this.app, { cls: this.h.cls, outfit: this.h.cls, spec: arenaSpec(this.h.cls), body: arenaBody(this.h.cls) }) : this.app);
    if (arenaLook) arenaDecor(this.ch, this.h.cls);
    equipWeapon(this.ch, w ? w.wt : null, arenaLook ? 3 : w ? w.tier : 0, arenaLook ? 0 : w ? w.rarity : 0); if (arenaLook) arenaWeaponDecor(this.ch, this.h.cls);
    if (this.lichForm) { // burning green eyes and a long, dark, flowing cape
      const eyeM = new THREE.MeshBasicMaterial({ color: '#5aff6a' }); for (const x of [-0.045, 0.045]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), eyeM); e.position.set(x, 0.06, 0.1); this.ch.head.add(e); }
      const glow = new THREE.PointLight('#40ff60', 1.4, 4); glow.position.set(0, 0.06, 0.2); this.ch.head.add(glow);
      const capeG = new THREE.PlaneGeometry(0.4, 1.5, 6, 10); capeG.translate(0, -0.75, 0); const pos = capeG.attributes.position; for (let i = 0; i < pos.count; i++) { const y = pos.getY(i), x = pos.getX(i); pos.setX(i, x * (1 - y * 0.5)); pos.setZ(i, -Math.cos(x * 6) * 0.06 - y * 0.05); } capeG.computeVertexNormals();
      const cape = new THREE.Mesh(capeG, new THREE.MeshStandardMaterial({ color: '#2a1a3a', roughness: 0.75, side: THREE.DoubleSide, emissive: '#0c2a14', emissiveIntensity: 0.3 }));
      const pivot = new THREE.Group(); pivot.position.set(0, 0.2, -0.14); pivot.add(cape); this.ch.chest.add(pivot); this.ch.lichCape = pivot;
    }
    if (!arenaLook) tintGear(this.ch, this.h.equip);
    if (G.newFx && Skills.canDual(this.h)) { const w2 = this.h.equip.w2, P2 = WEAPON_TYPES[w2.wt].parts[0], off = makeWeapon(P2, arenaLook ? 3 : w2.tier, arenaLook ? 0 : w2.rarity); this.ch.arms.L.grip.add(off); off.rotation.y = Math.PI / 2; this.ch.weapons.off = off; }
    backWeapons(this.ch, [this.h.equip.w3, this.h.equip.w4]);
    bake(this.ch.root); if (arenaLook) addOutline(this.ch.root); this.ch.root.visible = vis; G.scene.add(this.ch.root);
    if (old) { this.ch.anim = old.anim; this.ch.root.position.copy(old.root.position); this.ch.root.rotation.copy(old.root.rotation); }
    this.vm.setWeapon(w && this.h.arena ? Object.assign({}, w, { tier: 3, rarity: 0 }) : w);
    if (G.newFx && Skills.canDual(this.h)) { const w2 = this.h.equip.w2, P2 = WEAPON_TYPES[w2.wt].parts[0], off = makeWeapon(P2, w2.tier, w2.rarity); this.vm.L.add(off); off.rotation.y = -0.45; this.vm.weapons.off = off; }
    const col = w ? (w.rarity >= 2 ? RARITY[w.rarity].col : WEAPON_TYPES[w.wt].element === 'fire' ? '#ff9050' : '#ffffff') : '#fff';
    this.trail.mat.uniforms.color.value.set(col); this.trailL.mat.uniforms.color.value.set(col);
  }
  place(x, z, yaw) { this.pos.set(x, groundAt(x, z).h, z); /* stand on piers and bridges, not the ground under them */ this.yaw = yaw; this.bodyYaw = yaw; this.vel.set(0, 0, 0); }

  // ---------- input ----------
  isFrozen() { return !!(this.db && this.db.freeze && this.db.freeze.t > 0); } // (frozen: no moving, jumping, attacking, dodging or abilities)
  onKey(code, down) {
    if (!down) return;
    if (this.dead) return;
    if (this.isFrozen()) return;
    switch (code) {
      case 'Space': this.jump(); break;
      case 'ShiftLeft': case 'ShiftRight': this.shiftT = G.time; break;
      case 'KeyQ': if (G.battleFx) this.hotbar(7); break; // Q is the third damage key (Z swaps weapons)
      case 'KeyF': if (G.battleFx) this.hotbar(5); break;
      case 'KeyC': if (G.battleFx) this.hotbar(6); break;
      case 'Digit1': this.hotbar(0); break;
      case 'Digit2': this.hotbar(1); break;
      case 'Digit3': this.hotbar(2); break;
      case 'Digit4': this.hotbar(3); break;
      case 'Digit5': this.hotbar(4); break;
      case 'KeyE': this.interact(); break;
      case 'KeyR': if (this.h.arenaUlt) this.ultimate(); else this.quaff(); break; // (the arena: R is your ultimate)
      case 'KeyV': break; /* (heroes have no first-person view to switch to) */
      case 'KeyX': if (this.sheathed) this.drawWeapons(); else this.xHoldT = G.time; break; // hold X to put your weapons away, tap X to draw them
    }
  }
  // Kingdom Battles: double-tap W, A, S or D to roll that way
  tapRoll(code) {
    return; // both modes: dodging is on Shift (tap), sprinting is holding Shift
    if (!G.battleFx || !{ KeyW: 1, KeyA: 1, KeyS: 1, KeyD: 1 }[code]) return;
    const now = performance.now(), last = this.lastTap;
    this.lastTap = { code, t: now };
    if (!last || last.code !== code || now - last.t > 280) return;
    this.lastTap = null;
    const f = this.fwd(), r = this.right();
    const dir = code === 'KeyW' ? f : code === 'KeyS' ? f.multiplyScalar(-1) : code === 'KeyA' ? r.multiplyScalar(-1) : r;
    this.tryDodge(dir.normalize());
  }
  onKeyUp(code) { if (code === 'KeyX') this.xHoldT = null; if ((code === 'ShiftLeft' || code === 'ShiftRight') && this.shiftT != null) { if (G.time - this.shiftT < 0.22 && !G.uiOpen) this.tryDodge(); this.shiftT = null; } }
  onMouse(btn, down) {
    if (down && this.isFrozen()) return;
    if (down && this.fearT > 0) return; // fleeing in terror: no attacks
    if (btn === 0) this.lmbDown = down;
    if (down && this.sheathed && !this.dead && !G.uiOpen && (btn === 0 || btn === 2)) { this.drawWeapons(); if (btn === 0) { this.lmbDown = false; return; } }
    if (this.dead || G.uiOpen) return;
    if (down && btn === 2 && this.h.arena && this.h.arenaRmb === 'ar_wraps' && !this.dead && !G.uiOpen) { const k = ABILITIES[this.h.cls].findIndex(a => a.id === 'ar_wraps'); if (k >= 0) this.ability(k); return; } // (Tighten the Wraps works even while stunned: it is how the monk breaks free)
    if (down && this.db && this.db.stun && this.db.stun.t > 0) return;
    if (btn === 0 && this.h.arena && this.W) { this.lmbHeld = down && !this.dead; if (this.dead) return; if (down ? this.aimShotOn() : this.press && this.press.aimShot) { if (down) { this.cancelGather(); this.press = { t: 0, aimShot: true, charging: false }; } else { const pr = this.press; this.press = null; this.aimShotRelease(pr); } return; } /* (the owner: the ranger zoomed in holds left click to draw a strong shot, a bar under the crosshair rising to full power, and lets go to loose it) */ if (down) { this.cancelGather(); this.press = null; this.light(); } return; } // the arena: hold to keep firing // the arena: one click, one attack (no holding) // the arena: no heavy attacks; press or hold to keep attacking (bows and guns too) // the arena: press or hold to keep attacking
    // Kingdom Battles bows: hold left click to draw, release to shoot (a longer draw is stronger and straighter)
    if (btn === 0 && G.battleFx && this.W && (this.W.kind === 'bow' || this.W.kind === 'gun')) {
      if (down) { this.cancelGather(); if (!this.atk && !this.dodge && !this.block) this.press = { t: 0, charging: false }; }
      else if (this.press) { const pr = this.press; this.press = null; if (pr.charging) this.releaseHeavy(pr); else this.light(); }
      return;
    }
    // Kingdom Arena: right click blocks only with a shield; a bow or gun aims down the barrel; everyone else casts a fourth ability
    if (btn === 2 && this.h.arenaRmb !== undefined && (!(this.W && this.W.hands === 'shield') || /^ar_(mend|totem)/.test(this.h.arenaRmb || ''))) { // (healers' right click heals even with a shield in hand)
      this.rmbHeld = false;
      if (this.h.arenaRmb === 'aim' || (this.W && (this.W.kind === 'bow' || this.W.kind === 'gun'))) { this.adsHeld = down; return; }
      if (down && this.h.arenaRmb) { const k = ABILITIES[this.h.cls].findIndex(a => a.id === this.h.arenaRmb); if (k >= 0) { const cd0 = this.cd['a' + (k + 1)] || 0; this.ability(k); const ra = ABILITIES[this.h.cls][k]; /* (third person only for ultimates, for now) */ } } // (a defensive stance: seen from behind, like Paladins)
      return;
    }
    if (btn === 2) this.rmbHeld = down; // Kingdom Battles: hold right click to block (F fires the weapon special)
    if (btn === 0 && G.battleFx && this.W && this.W.kind === 'staff') { if (down) { this.cancelGather(); if (this.channel && this.channel.snd) this.channel.snd.stop(); this.channel = Game.canHold(this.h, this.weapon.wt) ? { t: 0, on: false, tick: 0, snd: null } : null; this.light(); } else { if (this.channel && this.channel.snd) this.channel.snd.stop(); this.channel = null; } return; }
    if (btn === 0 && G.battleFx && this.W && this.W.kind === 'melee') {
      if (down) { this.cancelGather(); if (!this.dodge && !this.block) this.press = { t: 0, charging: false, melee: true }; }
      else if (this.press) { const pr = this.press; this.press = null; if (pr.charging) this.releaseHeavy(pr); else if (pr.again) {} else if (pr.t > 0.22 && this.atk) this.queued = 'heavy'; else this.light(); }
      return;
    }
    if (btn === 0) { if (down) { this.cancelGather(); this.light(); } }
    else if (btn === 2 && down && !G.battleFx) this.specialAttack();
  }
  onWheel(dy) { this.camDistT = clamp(this.camDistT + dy * 0.004, 0, 9); if (this.camDistT < 0.7 && dy < 0) this.camDistT = 0; else if (this.camDistT > 0 && this.camDistT < 1.6 && dy > 0) this.camDistT = 2.2; }
  look(dx, dy) { const s = 0.0032 * settings.sens; if (this.h.arena) { this.lagX = (this.lagX || 0) + dx * s; this.lagY = (this.lagY || 0) + dy * s * (settings.invertY ? -1 : 1); return; } this.yaw -= dx * s; this.pitch = clamp(this.pitch - dy * s * (settings.invertY ? -1 : 1), -1.45, 1.45); }
  // the arena's view follows the mouse a hair behind (about 40 ms), so turning looks smooth instead of twitchy
  lookLag(dt) { if (!this.lagX && !this.lagY) return; const k = Math.min(1, dt * ((this.adsK || 0) > 0.5 ? 16 : 24)), ax = this.lagX * k, ay = this.lagY * k; this.yaw -= ax; this.pitch = clamp(this.pitch - ay, -1.45, 1.45); this.lagX -= ax; this.lagY -= ay; if (Math.abs(this.lagX) < 1e-5) this.lagX = 0; if (Math.abs(this.lagY) < 1e-5) this.lagY = 0; }

  // ---------- helpers ----------
  fwd() { return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  right() { return new THREE.Vector3(-Math.cos(this.yaw), 0, Math.sin(this.yaw)); }
  busy() { return !!(this.atk || this.dodge || this.gathering || this.dead); }
  spend(cost, res) {
    if (this.h.arena) return true; // Kingdom Arena: no mana, abilities run on cooldowns alone
    cost = Math.round(cost * (this.h.cls === 'wizard' && this.pk('cap') ? 0.75 : 1) * (this.buffs.surge > 0 ? 0 : 1));
    const uses = res === 'mana' && this.maxMana > 0 ? 'mana' : res === 'end' ? 'end' : CLASS_POOLS[this.h.cls].uses; // campaign: spells cost mana, physical attacks endurance
    const cur = uses === 'mana' ? this.mana : this.end;
    if (cur < cost) { G.hooks.toast && G.hooks.toast(uses === 'mana' ? 'Not enough mana' : 'Not enough endurance', '⚠', 'bad'); S.error(); return false; }
    if (uses === 'mana') { this.mana -= cost; this.manaUseT = 1.2; } else { this.end -= cost; this.endUseT = 1.2; }
    return true;
  }
  handPos(left) {
    if (this.camDist < 0.6) { const o = G.camera.position.clone(); return o.add(new THREE.Vector3(left ? -0.25 : 0.25, -0.22, -0.7).applyQuaternion(G.camera.quaternion)); }
    const p = this.pos.clone(); p.y += this.eye * 0.8; return p.addScaledVector(this.fwd(), 0.5).addScaledVector(this.right(), left ? -0.3 : 0.3);
  }
  // where a spell leaves you: between your raised hands (campaign), not the staff
  spellFrom() { if (!G.newFx) return this.handPos(); if (this.camDist < 0.6) { const o = G.camera.position.clone(); return o.add(new THREE.Vector3(0, 0.05, -0.75).applyQuaternion(G.camera.quaternion)); } return this.pos.clone().setY(this.pos.y + this.eye + 0.35).addScaledVector(this.fwd(), 0.55); }
  aimDir(from) { const a = aimRay(120); return a.point.clone().sub(from).normalize(); }
  arcaneRound() { // one round of the musketeer's Arcane Barrage
    const from = this.camDist < 0.6 ? G.camera.position.clone().add(new THREE.Vector3(0.1, -0.1, -0.9).applyQuaternion(G.camera.quaternion)) : this.handPos(); const dir = this.aimDir(from); dir.x += (Math.random() - 0.5) * 0.02; dir.y += (Math.random() - 0.5) * 0.02; dir.normalize();
    const base = weaponDamage(this.h, this.weapon) * 0.32;
    spawnProjectile({ wpn: true, pos: from, vel: dir.multiplyScalar(85), grav: 0, radius: 0.18, dmg: base, owner: 'player', kind: 'bullet', life: 1.6 });
    this.recoil = Math.min(1, (this.recoil || 0) + 0.35); V.burst('arcane', from, 6, { speed: 3 }); V.light(from, '#b8a0ff', 3, 0.06, 6); S.gunshot && S.gunshot(this.pos, 0.45); this.fovKick = Math.min(4, (this.fovKick || 0) + 0.6); }
  // the campaign: a weapon you have only just picked up is clumsy in your hand; skill makes it quicker
  wSpeedK() { if (!this.weapon) return 1; const sz = Math.pow(1 / (this.weapon.size || 1), 0.95); return Game.speedOf(this.h, this.weapon.wt) * sz; } // skill, and the weapon's size (light = quick, heavy = slow)
  speedMul() { let m = ((this.fireFormT || 0) > G.time ? 2 : 1) /* (Fire Form: attacks twice as fast) */ * this.wSpeedK() * (this.h.arena ? Game.arenaHaste(this.h) : 1) * (1 + this.sbSum('haste') / 100) * (this.buffs.avatar > 0 && this.avatar && this.avatar.haste ? this.avatar.haste : 1); if (this.h.arena && this.h.cls === 'warrior') m *= 0.8; /* (the warrior's sword swings slower and heavier: a clear, full slash) */ if (this.buffs.rampage > 0) m *= 1.4; if (this.buffs.focus > 0) m *= this.h.cls === 'ranger' ? 2 : 1.35; if (this.buffs.missiles > 0) m *= 2; if (this.buffs.warsong > 0) m *= 1.3; /* (War Song: attack 30% faster) */ if (this.transcendT > 0) m *= 1.5; /* (Arcane Ascension: casts half again as fast) */ /* (the owner: Magic Missiles cast twice as fast) */ /* (the owner: the ranger's Hunter's Focus, twice as fast, and no extra crits) */ if (this.W && this.W.hands === 'dual' && dualRank(this.h.dualKills) >= 2) m *= 1.08; if (this.buffs.fury > 0) m *= 1.5; if (this.buffs.shout > 0) m *= 1.35; /* (Battle Shout) */ if (this.pk('drum') && (this.buffs.bWar > 0 || this.buffs.bVigor > 0 || this.buffs.bStone > 0)) m *= 1.1; return m; }

  // what a swing sounds like: maces and hammers whoosh low, axes chop, spears swish, daggers flick, swords ring
  swingKind(name) {
    const wt = this.weapon ? this.weapon.wt : '';
    if (wt === 'maceshield' || wt === 'warhammer' || wt === 'quarterstaff') return 'blunt';
    if (wt === 'swordmace') return name === 'off1' ? 'blunt' : 'blade';
    if (wt === 'greataxe' || wt === 'handaxes') return 'axe';
    if (wt === 'spear') return 'spear';
    if (wt === 'daggers' || wt === 'dagger') return 'light';
    if (wt === 'fists') return 'fist';
    if (this.W && this.W.kind === 'staff') return 'staff';
    return 'blade';
  }
  // ---------- attacks ----------
  light() { if (this.held || this.axeOut || this.axeThrow || (this.iceFormOn && this.buffs.iceblock > 0)) return; /* (Ice Form: frozen, no attacks) */ /* (no axe in hand while it is thrown) */ /* (no swinging while held) */
    if (this.dodge || this.gathering || this.swim) return;
    const W = this.W; if (!W) return;
    if (this.block) return;
    if (this.atk) { if (this.atk.t > 0.35 && !this.atk.noQueue) this.queued = 'light'; return; }
    if (G.newFx && (W.kind === 'gun' || W.kind === 'bow' || W.kind === 'staff') && Math.random() < 0.6) Skills.practise(this.h, Skills.skillOf(this.weapon.wt));
    if (this.h.arena && this.h.cls === 'bard') return this.startAtk('strum', 0.6 / this.speedMul(), { charge: 0, hitK: 0.3 }); // (the owner: the bard strums: no sword swing, the lute stays at his chest and the right hand sweeps the strings)
    if (W.kind === 'gun') return this.startAtk('shoot', (this.buffs.reload > 0 ? 0.45 : 0.9) / this.speedMul(), { charge: 0 });
    if (W.kind === 'bow') { const q = (1 + this.wp('combo') * 0.12) * (1 + this.pk('quickdraw') * 0.3) * this.speedMul(); if (this.h.arena) { this.bowT = G.time; return this.startAtk('shoot', BOW_CYCLE / q, { charge: 0, hitK: BOW_REL, dmgK: BOW_DMG }); } return this.startAtk('shoot', 0.5 / q, { charge: 0 }); } /* (the arena and yard: a deliberate archer, about one arrow a second held (it was nearly two), each arrow hitting as much harder as it is slower, so damage per second stays level; the loose comes after a real draw) */
    if (W.kind === 'staff' && this.h.arena && this.h.cls === 'necromancer') { this.startAtk('reap', ((G.hooks.reap && G.hooks.reap.dur) || 0.66) / this.speedMul(), { charge: 0 }); this.atk.swingSnd = { reap: true }; this.atk.hitK = 0.5; /* (the owner: the hit lands as the blade sweeps through, halfway into the swing) */ return; } // (the necromancer reaps with his scythe: a.name 'reap' plays the first-person reap)
    if (W.kind === 'staff') { // campaign: a magical staff runs on mana, bolts included (a stronger staff costs more)
      if (G.newFx && !this.h.arena) { const cost = Math.round(3 + (this.weapon.dmg || 9) * 0.12); if (this.mana < cost) { S.error(); V.number(this.pos.clone().setY(this.pos.y + this.eye + 0.3), 'Out of mana', 'miss'); return; } this.mana -= cost; this.manaUseT = 1; }
      return this.startAtk('cast', 0.55 / W.speed / (1 + this.wp('combo') * 0.12) / this.speedMul(), { charge: 0 }); }
    const C = COMBOS[this.weapon.wt]; if (!C) return;
    if (this.comboT <= 0) this.combo = 0;
    const L = Game.comboLen(this.h, this.weapon.wt); // the campaign: strikes unlock as the weapon's mastery grows
    const i = this.combo % L; this.combo = i + 1;
    let st = C.chain[i];
    if (G.newFx) { this.swingN = (this.swingN || 0) + 1; const pick = C.chain[this.swingN % Math.min(2, C.chain.length)]; st = Object.assign({}, C.chain[0], { a: pick.a, m: 1.0 }); } // single swings, alternating left and right
    if (G.newFx && this.h.arena && this.h.cls === 'berserker' && this.weapon.wt === 'greataxe') { if (G.time - (this.warLast || -9) > 2.2) this.warN = 0; this.warLast = G.time; const BW = BERS_CLEAVE ? [['swing1', 1.0, 1.0, 0.63], ['swing2', 0.75, 0.75, 0.76], ['swing3', 1.1, 1.1, 0.41]] : [['swing1', 1.275, 1.28, 0.75], ['swing2', 0.72, 0.66, 0.32]], q = BW[(this.warN = (this.warN || 0)) % BW.length]; this.warN++; st = Object.assign({}, C.chain[0], { a: q[0], m: q[2], d: q[1], hitK: q[3] }); } /* (BERS_CLEAVE: the owner's Weapon Combo 2, three cleaves swung in both hands (the model's cvA-cvC), each hit where the axe head comes down through chest height in front of him: 63%, 76% and 41% of the way in; each blow as long as its stretch of the recording at one pace, damage in step with length so damage per second stays level) */ /* (the owner's barbarian Attack in two blows: the overhead chop (1 to 1.3 s by the axe's weight, the axe landing three quarters of the way in) and the rip back up across him into his guard (0.55 to 0.7 s); each hit lands where the axe strikes in the recording) */ /* (the berserker: wide sweeps, right to left then left to right) */
    else if (G.newFx && this.h.arena && (this.h.cls === 'paladin' || this.h.cls === 'darkknight') && W.hands === 'two' && W.kind === 'melee') { /* (the paladin's hammer and the shadow knight's greatsword: each knight his own heavy three-blow combo) */ if (this.comboT <= 0) this.warN = 0; const q = (this.h.cls === 'paladin' ? PAL3 : DK3)[(this.warN = (this.warN || 0)) % 3]; this.warN++; st = Object.assign({}, C.chain[0], { a: q[0], m: q[1], d: q[1], hitK: q[2] }); }
    else if (G.newFx && this.h.arena && this.h.cls === 'rogue' && W.kind === 'melee' && /^daggers?$/.test(this.weapon.wt)) { if (G.time - (this.warLast || -9) > 1.6) this.warN = 0; this.warLast = G.time; const q = ROGUE3[(this.warN = (this.warN || 0)) % ROGUE3.length]; this.warN++; st = Object.assign({}, C.chain[0], { a: q[0], d: q[1], m: q[2], hitK: q[3], aoe: q[4], mv: q[5] }); } /* (the combo starts over after a real pause) */
    else if (G.newFx && this.h.arena && this.h.cls === 'monk' && this.weapon.wt === 'fists') { if (G.time - (this.warLast || -9) > 1.3) this.warN = 0; this.warLast = G.time; const q = MONK7[(this.warN = (this.warN || 0)) % 7]; this.warN++; st = Object.assign({}, C.chain[0], { a: q[0], d: q[1], m: C.chain[0].m * q[1] / (C.chain[0].d || 0.5), hitK: q[2], mv: q[3] }); } /* (the monk: each blow its own length, the model told which one it is) */
    if (G.newFx && this.h.arena && this.h.cls === 'warrior' && W.hands === 'shield') { if (G.time - (this.warLast || -9) > 2.2) this.warN = 0; this.warLast = G.time; /* (the combo only starts over after a real pause, so clicking at your own pace still alternates the two swings) */ const W3 = WARR.w3, q = W3[(this.warN = (this.warN || 0)) % W3.length]; this.warN++; st = Object.assign({}, C.chain[0], { a: q[0], m: q[2], d: q[1], hitK: q[3] }); /* (the owner's Double Combo Attack: the blow lands 42% / 50% of the way in, as it does on screen) */ /* (two-hit combo, same slow pace as the single slash: 0.7 s of recording over 1.0 s, then 0.55 s over 0.8 s; damage per second kept level) */ /* (slowed again so you can follow the blade; m keeps damage per second roughly level) */ /* (slower, weightier blows: about a third slower, each hitting a third harder) */ } /* (the warrior: one standard slash, the owner's Right Hand Sword Slash, every time) */
    const dur = 0.52 * (st.d || 1) / (W.speed * this.speedMul());
    this.startAtk(st.a, dur, { combo: i, step: st, last: G.newFx ? false : i === L - 1, hitK: st.hitK, mv: st.mv });
  }
  releaseHeavy(p) {
    const W = this.W; if (!W) return;
    // campaign: a heavy blow (or a full draw / aimed shot) costs endurance, more with a stronger weapon; too tired = a normal attack
    if (G.newFx && W.kind !== 'staff') { const cost = Math.round(8 + (this.weapon.dmg || 9) * 0.12);
      if (this.end < cost) { V.number(this.pos.clone().setY(this.pos.y + this.eye + 0.3), 'Too tired', 'miss'); S.error(); return this.light(); }
      this.end -= cost; this.endUseT = 1; }
    const charge = clamp((p.t - (W.kind === 'melee' && p.t0 != null ? p.t0 : 0.22)) / (G.battleFx && W.kind === 'bow' ? 1.8 : G.battleFx && W.kind === 'gun' ? 1.4 : W.kind === 'melee' ? 0.5 : 0.8) * (1 + this.wp('heavy') * 0.3 + this.pk('heavyhit') * 0.4 + (W.kind === 'bow' ? this.pk('quickdraw') * 0.3 : 0)), 0, 1);
    if (W.kind === 'bow' || W.kind === 'gun') return this.startAtk('release', W.kind === 'gun' ? 0.35 : 0.3, { charge, fire: true });
    if (W.kind === 'staff') { if (G.newFx && !this.h.arena) { const cost = Math.round(8 + (this.weapon.dmg || 9) * 0.35); if (this.mana < cost) { V.number(this.pos.clone().setY(this.pos.y + this.eye + 0.3), 'Out of mana', 'miss'); S.error(); return; } this.mana -= cost; this.manaUseT = 1; } return this.startAtk('cast', 0.45, { charge, big: true }); } // a charged staff blast costs more
    this.startAtk('heavy', 0.7 / W.speed / Math.sqrt(this.speedMul()), { charge, last: true, held: true }); this.lungeT = 0.16; this.lungeDir = this.fwd(); this.fovKick = Math.max(this.fovKick, 4 + charge * 3);
  }
  startAtk(name, dur, o = {}) {
    this.atk = Object.assign({ name, t: 0, dur, hit: false }, o);
    const W = this.W;
    if (W && W.kind === 'melee' && !['charge'].includes(name)) { const big = name === 'swing3' || name === 'heavy' || name === 'smash' || name === 'thrust3' || name === 'spin'; this.atk.swingSnd = { k: this.swingKind(name), v: big ? 1.6 : W.hands === 'two' ? 1.3 : this.h.arena && this.h.cls === 'warrior' ? 0.95 : 0.9 }; /* (the owner: the warrior's slashes were a little loud) */ } /* (the warrior's sword swings: a fuller whoosh, the light swish was easy to miss) */
  }
  aimShotOn() { return false && !!(this.h.arena && this.h.cls === 'ranger' && this.W && this.W.kind === 'bow' && this.ads && !this.dead); }
  aimCharge() { const p = this.press; return p && p.aimShot && p.charging ? clamp((p.t - AIM_T0) / AIM_FULL, 0, 1) : 0; }
  aimShotRelease(pr) { if (!pr || this.dead || !this.W || this.W.kind !== 'bow') return; const c = pr.charging ? clamp((pr.t - AIM_T0) / AIM_FULL, 0, 1) : 0;
    if (c < 0.06) { /* (the owner: a tap while zoomed looses an ordinary arrow at once, no draw: as fast as the bow's normal rate allows) */
      const q = (1 + this.wp('combo') * 0.12) * (1 + this.pk('quickdraw') * 0.3) * this.speedMul(); if (G.time - (this.bowT || -9) < BOW_CYCLE / q * 0.9) return;
      this.atk = null; this.bowT = G.time; this.startAtk('release', 0.28, { charge: 0.25, fire: true, aimed: true, hitK: 0.02, dmgK: BOW_DMG }); this.recoil = Math.max(this.recoil || 0, 0.5); return; }
    const K = G.battleFx ? 2.8 : 1.7, plain = (0.9 + 0.25 * K) * 1.9; this.bowT = G.time; this.startAtk('release', 0.34, { charge: c, fire: true, aimed: true, hitK: 0.03, dmgK: plain * (1 + (AIM_MAX - 1) * c) / (0.9 + K * c) }); /* (dmgK: an ordinary arena arrow's damage (a 'shoot' counts as a quarter draw, times BOW_CYCLE / 0.5), times up to AIM_MAX at a full draw, whatever the bow's own draw formula) */
    this.recoil = Math.max(this.recoil || 0, 0.6 + c); this.fovKick = Math.max(this.fovKick || 0, 1 + c * 3); if (c >= 1) { V.addShake(0.18); S.bowShot(this.pos); } }
  updateAttack(dt) {
    if (this.press && this.press.aimShot && !G.uiOpen) { if (this.dead || !this.W || this.W.kind !== 'bow') this.press = null; else if (!this.atk && !this.dodge) { /* (a shot already in flight finishes first; then the string comes back) */
      if (!this.press.charging) { this.press.charging = true; S.bowDraw(); } this.press.t += dt * (this.buffs.focus > 0 ? 2 : 1); /* (Hunter's Focus draws twice as fast too) */
      if (!this.press.full && this.aimCharge() >= 1) { this.press.full = true; S.bowDraw(); V.number(this.pos.clone().setY(this.pos.y + 2.3), 'Full power', 'crit'); } } }
    // charging heavy (hold left click)
    if (G.battleFx && this.W && (this.W.kind === 'bow' || this.W.kind === 'gun') && this.press && !this.press.aimShot && !G.uiOpen) { /* (not the ranger's zoomed charge shot: it keeps its own clock above) */
      this.press.t += dt;
      const fullAt = this.W.kind === 'gun' ? 1.62 : 2.02;
      if (this.press.charging && !this.press.full && this.press.t >= fullAt) { this.press.full = true; S.bowDraw(); V.number(this.pos.clone().setY(this.pos.y + 2.3), this.W.kind === 'gun' ? 'Steady aim' : 'Full draw', 'crit'); }
      if (this.press.t > 0.22 && !this.press.charging && !this.atk && !this.dodge && !this.block && this.W) {
        this.press.charging = true;
        if (this.W.kind === 'bow') S.bowDraw(); else if (this.W.kind === 'gun') S.click(); else if (this.W.kind === 'staff') S.charge(this.W.element); else S.charge('none');
      }
    }
    if (G.battleFx && this.W && this.W.kind === 'melee' && this.press && this.press.melee && !G.uiOpen) {
      this.press.t += dt;
      if (this.press.t > 0.22 && !this.press.charging && !this.dodge && !this.block && !(this.atk && !this.atk.hold) && Game.canHold(this.h, this.weapon.wt)) { this.press.charging = true; this.atk = { name: 'charge', t: 0, dur: 0.5, hit: true, noQueue: true, hold: true }; this.press.t0 = this.press.t; S.charge('none'); }
      if (this.press.charging && this.atk && this.atk.hold) this.atk.t = Math.min(this.atk.t, 0.98);
      // the wind-up takes half a second; then the heavy swing follows through on its own (letting go earlier swings early).
      // Keep holding and another heavy follows once this one has finished.
      if (this.press && this.press.charging && this.press.t - this.press.t0 >= 0.5) { const pr = this.press; this.press = this.lmbDown ? { t: 0.23, charging: false, melee: true, again: true } : null; this.releaseHeavy(pr); }
    }
    const a = this.atk; if (!a) return;
    a.t += dt / a.dur;
    if (a.hold) { if (this.press && this.press.charging) a.t = Math.min(a.t, 0.98); else if (a.t >= 1) { this.atk = null; return; } } // a held wind-up stays wound up until you let go
    const W = this.W;
    const hitAt = a.hitK != null ? a.hitK : W && W.kind === 'gun' && (a.name === 'shoot' || a.name === 'release') ? 0.02 : a.name === 'smash' ? 0.62 : a.name === 'spin' ? 0.5 : a.name === 'swing3' || a.name === 'thrust3' ? 0.5 : a.name === 'heavy' ? 0.3 : a.name === 'area' ? 0.25 : a.name === 'cast' ? 0.3 : a.name === 'shoot' ? 0.5 : a.name === 'release' ? 0.02 : a.name === 'castBig' ? 0.55 : 0.4;
    if (a.swingSnd && (hitAt - a.t) * a.dur <= 0.13) { if (a.swingSnd.reap) S.reap && S.reap(this.pos, 1); else S.swingW(a.swingSnd.k, a.swingSnd.v, this.pos, this.weapon && this.weapon.wt, this.h.cls); a.swingSnd = null; } // whoosh lands with the blow
    if (!a.hit && a.t >= hitAt) { a.hit = true; this.doHit(a); }
    // fury flurry: several hits
    if (a.name === 'fury') { const k = Math.floor(a.t * a.hits); if (k > (a.done || 0) && k <= a.hits) { a.done = k; this.furyHit(a, k); } }
    // trails
    const tr = this.camDist < 0.6 ? this.vm.weapons.main : this.ch.weapons.main;
    const trActive = !!tr && tr.userData && tr.userData.tip && this.weapon && this.weapon.wt !== 'fists' && W && W.kind === 'melee' && a.t > hitAt - 0.25 && a.t < hitAt + 0.25 && a.name !== 'off1' && a.name !== 'stabL';
    this.trail.active = trActive;
    if (trActive && tr) this.trail.push(tr.userData.base.getWorldPosition(new THREE.Vector3()), tr.userData.tip.getWorldPosition(new THREE.Vector3()));
    const trl = this.camDist < 0.6 ? this.vm.weapons.off : this.ch.weapons.off;
    const offActive = !!trl && trl.userData && trl.userData.tip && this.weapon && this.weapon.wt !== 'fists' && W && W.hands === 'dual' && (a.name === 'off1' || a.name === 'stabL' || a.name === 'spin' || a.name === 'swing3' || a.name === 'fury' || a.name === 'heavy' || a.name === 'smash') && a.t > 0.1 && a.t < 0.8;
    this.trailL.active = offActive;
    if (offActive && trl) this.trailL.push(trl.userData.base.getWorldPosition(new THREE.Vector3()), trl.userData.tip.getWorldPosition(new THREE.Vector3()));
    if (a.t >= 1) {
      this.atk = null; this.trail.active = this.trailL.active = false;
      this.comboT = 0.55;
      if (a.last) this.combo = 0;
      if (this.queued) { const q = this.queued; this.queued = null; if (q === 'light') { this.light(); if (this.atk) this.atk.chained = true; } else if (q === 'heavy') { this.press = { t: 0.23, charging: false, melee: true }; } }
      else if (this.lmbHeld && this.h.arena && !this.held && !this.dead && !G.uiOpen && !(this.press && this.press.aimShot)) { this.light(); if (this.atk) this.atk.chained = true; } /* (holding attack: the next blow starts this very frame, so the combo loops without a hitch) */
    }
  }
  doHit(a) {
    const W = this.W, w = this.weapon; if (!W) return;
    let base = weaponDamage(this.h, w) * Game.perkPow(Game.perkLvl(this.h, 'L'));
    const yaw = this.yaw;
    if (this.h.arena && this.h.cls === 'bard') { this.noteWave(base); return; } // (the owner: the bard strums; a wave of notes flies at the crosshair, the lute never swings)
    if (W.kind === 'melee') {
      if (a.name === 'area') return;
      let st = a.step || { m: 1 }; const wt = this.weapon.wt;
      const blunt = wt === 'maceshield' || wt === 'warhammer' || wt === 'quarterstaff' || wt === 'fists' || !!st.blunt; // (fists land like a club: a thud, no slash, no bleeding)
      const swordHit = (wt === 'swordshield' || wt === 'swordmace') && !st.blunt;
      let reach = W.reach * (a.name === 'smash' ? 1.1 : 1), half = st.cleave ? 1.3 : wt === 'spear' ? 0.35 : 0.85;
      let targets;
      const swordFam = wt === 'sword' || wt === 'swordshield' || wt === 'swordmace' || wt === 'greatsword';
      if (G.battleFx && a.name === 'heavy') st = swordFam ? { m: 2.1 + (a.charge || 0) * 1.7, stun: 0.6, knock: 5, crit: 0.15 } : { m: 1.5 + (a.charge || 0) * 1.3, knock: 7, cleave: true };
      if (G.battleFx && a.name === 'heavy' && swordFam) targets = mobsInCone(this.pos, yaw, reach * 1.15, 0.35).sort((x, y) => x.dist2(this.pos) - y.dist2(this.pos)).slice(0, 1);
      else if (st.aoe) targets = mobsInRadius(this.pos, st.aoe);
      else if (st.line) targets = mobsInCone(this.pos, yaw, reach * 1.7, 0.22);
      else if (this.pk('cleave') && a.last) targets = mobsInRadius(this.pos, reach);
      else if (G.battleFx) { half = (ARC[wt] || 0.8) * Math.sqrt(this.weapon.size || 1); half *= 0.85 + 0.3 * Math.min(1, (Game.masteryOf(this.h, wt) - 1) / 19); reach *= 1.12; targets = mobsInCone(this.pos, yaw, reach, half); }
      else { targets = mobsInCone(this.pos, yaw, reach, half); if (!st.cleave) targets = targets.sort((x, y) => x.dist2(this.pos) - y.dist2(this.pos)).slice(0, 2); }
      // Kingdom Battles: show the swing as a slash crescent exactly as wide and long as what it hits
      if (G.battleFx) { const R = st.aoe || (st.line ? reach * 1.7 : reach), H = st.aoe ? Math.PI : st.line ? 0.22 : half; slashArc(this, R, H, a.name, targets.length > 0, this.trail.mat.uniforms.color.value); }
      const big = !!a.last;
      if (a.held && targets.length) { G.hitstop = Math.max(G.hitstop || 0, 0.07 + (a.charge || 0) * 0.04); V.addShake(0.25 + (a.charge || 0) * 0.2); this.fovKick = Math.max(this.fovKick, 6); for (const m of targets) { V.burst('spark', m.pos.clone().setY(m.pos.y + 1.1), 14, { speed: 6 }); V.sphereFlash(m.pos.clone().setY(m.pos.y + 1.1), 0.9, '#fff0c0', 0.15); } S.executeHit && S.executeHit(targets[0].pos, false); }
      else if (a.held) V.addShake(0.08);
      if (big && this.pk('heavyhit')) st = Object.assign({}, st, { m: st.m * 1.25 });
      for (const m of targets) {
        const kn = m.pos.clone().sub(this.pos).setY(0).normalize().multiplyScalar(st.knock || (big ? 6 : 1.5));
        if (this.h.arena && this.h.cls === 'bard') { playNotes(G.scene, m, ['#ffd860', '#ff9ae0', '#9ae0ff'][(Math.random() * 3) | 0], 3); S.cast && S.cast('holy', m.pos, 0.35); } /* (a strum: the notes strike, not the lute) */
        this.dealDamage(m, base * st.m, { basic: true, knock: kn, big, offhand: a.name === 'off1' || a.name === 'stabL', melee: true, blunt: blunt && !this.h.arena, critBonus: this.h.arena ? 0 : (swordHit ? 0.1 : 0) + (st.crit || 0), /* (the owner: none of the old weapon-type rules in the arena or the new campaign classes) */ bleed: st.bleed && wt !== 'fists' && !this.h.arena ? base * 0.09 : 0, /* (the owner: no weapon bleed in the arena or the new campaign classes) */ stun: this.h.arena ? 0 : st.stun || 0 });
        if (W && W.kind === 'melee' && this.weapon && this.weapon.wt !== 'fists') slashImpact(m.pos.clone().setY(m.pos.y + (m.height || 1.8) * 0.6).lerp(this.pos.clone().setY(m.pos.y + 1.1), 0.18), a.name); /* (a bright slash streak where the blow lands) */
        if (S.meleeImpact && S.meleeImpact(wt, this.h.cls, m.pos, big)) { /* big weapons: a deep slam or a heavy cleave */ } else if (blunt) wt === 'fists' ? S.punch(m.pos, big) : S.blunt(m.pos);
      }
      if (targets.length) { this.wpnXp(1); if (G.newFx && !a.extra) this.meleeExtras(a, targets[0], base, st); }
      if (false && targets.length && (wt === 'dagger' || wt === 'daggers') && a.name !== 'heavy' && !a.extraHit) { // (no random double/triple attacks)
        const lv = G.newFx ? 0 : Game.masteryOf(this.h, wt), k = wt === 'daggers' ? 2 : 1; // campaign: no random dagger flurries, the rogue's abilities carry the damage
        const n = lv >= 9 && Math.random() < (0.02 + lv * 0.002) * k ? 3 : lv >= 5 && Math.random() < (0.04 + lv * 0.003) * k ? 2 : lv >= 2 && Math.random() < (0.08 + lv * 0.006) * k ? 1 : 0;
        if (n) { const t0 = targets[0]; V.number(t0.pos.clone().setY(t0.pos.y + (t0.height || 1.6) + 0.8), ['', 'Double attack!', 'Triple attack!', 'Quad attack!'][n], 'crit');
          for (let q = 1; q <= n; q++) setTimeout(() => { if (this.dead || t0.dead) return; this.dealDamage(t0, base * st.m * 0.9, { melee: true, offhand: q % 2 === 1 }); S.swingW('light', 0.8, this.pos); this.atk = { name: q % 2 ? 'stabL' : 'stabR', t: 0, dur: 0.12, hit: true, noQueue: true, extraHit: true }; }, q * 85); }
      }
      if (targets.length) { G.hitstop = (big ? 0.09 : 0.04) * (G.battleFx ? 1.5 : 1); V.addShake((big ? 0.3 : 0.08) * (G.battleFx ? 1.6 : 1)); if (G.battleFx) for (const m of targets) { const hp = m.pos.clone(); hp.y += (m.height || 1.5) * 0.6; V.burst('spark', hp, big ? 22 : 12, { speed: big ? 9 : 6 }); if (big) V.light(hp, '#ffd8a0', 5, 0.12); } }
      const fp = this.pos.clone().addScaledVector(this.fwd(), reach * 0.8); fp.y = heightAt(fp.x, fp.z);
      if (st.shock) { for (const m of mobsInRadius(fp, st.shock)) if (!targets.includes(m)) this.dealDamage(m, base * st.m * 0.5, { melee: true, blunt, slow: 2, knock: m.pos.clone().sub(fp).setY(0).normalize().multiplyScalar(6) }); if (this.camDist >= 0.6) V.ring(fp.clone().setY(this.pos.y), st.shock, '#ffe0a0', 0.45); V.burst('stone', fp, 26, { speed: 7, size: 0.3, grav: 14 }); V.burst('dust', fp, 20, { speed: 4, size: 1, life: 1.2 }); S.hit('stone', fp); S.rumble(fp, 0.5); V.addShake(0.35); }
      if (a.name === 'spin') { V.ring(this.pos, st.aoe || 3, '#e0e8ff', 0.35); V.burst('spark', this.pos.clone().setY(this.pos.y + 1), 30, { speed: 7 }); S.swingW('light', 1.6, this.pos); }
      if (st.line) { V.burst('spark', fp, 14, { speed: 5 }); }
      if (big && !st.shock && W.hands === 'two') V.burst('dust', fp, 12, { speed: 3, size: 0.45 });
    } else if (W.kind === 'bow') {
      const from = (this.adsK || 0) > 0.6 && this.camDist < 0.6 ? G.camera.position.clone().add(new THREE.Vector3(0, -0.02, -0.75).applyQuaternion(G.camera.quaternion)) : (this.camDist >= 0.6 && bowRest(this.ch)) || this.handPos(true), dir = this.aimDir(from); /* (third person: the arrow leaves the hero's own bow, where it lay on the rest, and flies to the crosshair; it used to start inside his chest) */
      const charge = a.name === 'release' ? a.charge : 0.25;
      // a long draw (hold left click up to ~2 s in Kingdom Battles) hits much harder, flies faster and stays straight far longer
      const sight = (this.adsK || 0) > 0.7, speed = (G.battleFx ? 40 + charge * 46 : 27 + charge * 34) + (sight ? 12 : 0); /* (the owner: arena arrows fly about 60% faster) */ /* (about a quarter slower than before, so you can follow each arrow from the bow to the target) */ /* sighted: faster, flatter, a little harder */
      spawnProjectile({ wpn: true, flat: (G.battleFx ? 0.45 + charge * 0.9 : 0) + (sight ? 0.5 : 0), pos: from, vel: dir.multiplyScalar(speed), grav: (9 - charge * (G.battleFx ? 6 : 4)) * (G.battleFx ? 0.75 : 1) * (sight ? 0.7 : 1), radius: 0.15, dmg: base * (0.9 + charge * (G.battleFx ? 2.8 : 1.7)) * (a.dmgK || 1) * (a.name === 'release' ? 1 + this.wp('heavy') * 0.15 : 1) * (sight ? 1.15 : 1), owner: 'player', kind: 'arrow', life: 4, charged: charge > 0.7, pierce: charge > 0.95, focus: this.buffs.focus > 0, aimed: a.aimed ? charge : 0, scale: a.aimed ? 1 + charge * 0.5 : 1 }); /* (focus: Hunter's Focus marks every arrow with a long glowing streak; aimed: the zoomed charge shot, bigger and brighter the longer it was drawn) */
      S.bowShot(this.pos);
    } else if (W.kind === 'gun') { const sight = (this.adsK || 0) > 0.7; this.fireGun(a.name === 'release' ? a.charge : 0, a.name === 'release' || sight, sight ? 1.15 : 1); if (sight) this.recoil = Math.max(this.recoil, 1.6);
    } else if (W.kind === 'staff' && a.name === 'reap') { this.reap(a, base);
    } else if (W.kind === 'staff') {
      const from = this.camDist < 0.6 ? (this.vmWorld(this.vm.weapons.flame) || G.camera.position.clone().add(new THREE.Vector3(0.12, -0.12, -0.9).applyQuaternion(G.camera.quaternion))) : (((o) => { let r = o; while (r && r.parent) r = r.parent; return o && r === G.scene ? o.getWorldPosition(new THREE.Vector3()) : null; })(this.ch.weapons.main?.userData.flame || this.ch.weapons.main?.userData.orb) || this.handPos()); /* (only a staff head that is really on him: a removed one sits at the middle of the map) */
      const dir = this.aimDir(from), el = W.element, big = a.big && a.charge > 0.2, ch = a.charge || 0;
      const invCrit = this.phaseInvis && this.stealth > 0; if (invCrit) { this.stealth = 0; this.phaseInvis = false; } // (the first cast out of Phase Shift crits, and ends it)
      if (this.h.arena && this.h.cls === 'bombardier' && G.hooks.bombThrow) { // the goblin throws the bomb from his fist: it bounces, then goes off (bomber.js)
        G.hooks.bombThrow(this, from, dir, base); S.swing && S.swing(); V.burst('spark', from, 6, { speed: 2 }); return; }
      if (this.h.arena && this.h.cls === 'priest') { // a bolt of dawn light: every hit on an enemy heals the most hurt ally near you (atonement)
        { const al = G.hooks.aimAlly ? G.hooks.aimAlly(this, 40) : null; if (al && al !== this && G.hooks.priestHealBolt) { G.hooks.priestHealBolt(this, al, from, 0.06); S.cast('holy', from, 0.7); V.burst('gold', from, 8, { speed: 2 }); return; } } /* (the owner: aimed at an ally, the bolt heals them) */
        spawnProjectile({ wpn: true, pos: from, vel: dir.multiplyScalar(48), grav: 0.5, radius: 0.24, dmg: base * 0.85, owner: 'player', kind: 'dawn', life: 3, home: true, onHit: (p, m, pos) => { if (m) { this.dealDamage(m, p.dmg, { el: 'arcane' }); G.hooks.atone && G.hooks.atone(this, 0.045); } V.burst('gold', pos, 18, { speed: 4 }); V.light(pos, '#ffe080', 3, 0.2); S.cast('holy', pos, 0.5); } });
        S.cast('holy', from, 0.7); V.burst('gold', from, 8, { speed: 2 }); return; }
      if (G.newFx && !a.big) base *= 0.7; // campaign: plain bolts hit softer; spells and the held stream carry the damage
      if (this.h.arena && this.h.cls === 'wizard' && this.buffs.missiles > 0) { { const mp = this.magicMissile(from, dir, base); if (mp) mp.forceCrit = invCrit; } S.cast('arcane', from, 0.5); V.burst('arcane', from, 7, { speed: 2.5 }); V.light(from, '#b060ff', 2.2, 0.12, 8); return; } /* (Magic Missiles: each cast a seeking missile) */
      const sc = big ? 1 + ch * 1.4 : 1;
      if (el === 'fire') spawnProjectile({ wpn: true, pos: from, vel: dir.multiplyScalar(34 - ch * 6), grav: 3.5 + ch * 3, radius: 0.25 * sc, dmg: base * (1 + ch * 1.6), owner: 'player', kind: 'fireball', scale: sc, life: 4, onHit: (p, m, pos) => this.fireBurst(pos, (big ? 2.6 : 1.6) * sc * 0.8, p.dmg, m) });
      else if (el === 'frost') spawnProjectile({ wpn: true, pos: from, vel: dir.multiplyScalar(46), grav: 2.5, radius: 0.22 * sc, dmg: base * (1 + ch * 1.4), owner: 'player', kind: 'frost', scale: sc, life: 3, pierce: big, onHit: (p, m, pos) => { if (m) this.dealDamage(m, p.dmg, { slow: 3, freeze: big && ch > 0.8 ? 2 : 0, el: 'frost' }); V.burst('frost', pos, 14 * sc, { speed: 4 }); S.cast('frost', pos); } });
      else spawnProjectile({ wpn: true, pos: from, vel: dir.multiplyScalar(52), grav: 1.5, radius: 0.22 * sc, dmg: base * ((this.h.arena && this.h.cls === 'wizard' ? 1.0 : 0.95) + ch * 1.5), owner: 'player', kind: 'arcane', scale: sc, life: 3, home: true, /* (the arena wizard's plain bolt: a touch harder than other arcane staffs, so his damage stays where it was with fire) */ onHit: (p, m, pos) => { if (m) this.dealDamage(m, p.dmg, { el: 'arcane', forceCrit: invCrit }); if (this.transcendT > 0) this.ascBlast(pos, p.dmg, m); V.burst('arcane', pos, 16 * sc, { speed: 4 }); V.light(pos, '#a050ff', 3, 0.2); S.cast('arcane', pos, 0.6); } });
      if (this.pk('echo') && !a.echoed && Math.random() < 0.15) { setTimeout(() => { if (!this.dead) this.doHit(Object.assign({}, a, { echoed: true })); }, 140 * ABIL_DELAY_K()); }
      S.cast(el, from, big ? 1.4 : 0.8);
      V.burst(el === 'fire' ? 'fire' : el, from, 8, { speed: 2 }); V.light(from, el === 'fire' ? '#ff7020' : el === 'frost' ? '#60c0ff' : '#b060ff', 2, 0.15, 8);
    }
  }
  // Magic Missiles: a missile that seeks the enemy nearest the crosshair (within MM_CONE of it), sweeping out to one side and curving in to
  // it, lane after lane (right, left, high right, high left, over the top), so a stream of them fans out and closes on the target. With no
  // target it flies straight down the crosshair. It bursts on whatever it touches first: the target, another fighter, a wall, a tree
  magicMissile(from, dir, base) { const cam = G.camera, f = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion), tgt = missileTarget(cam.position, f, MM_RANGE, MM_CONE);
    const n = (this.mmN = (this.mmN || 0) + 1), lane = MM_LANES[n % MM_LANES.length], side = new THREE.Vector3(-dir.z, 0, dir.x); if (side.lengthSq() < 1e-4) side.set(1, 0, 0); side.normalize().multiplyScalar(lane[0]);
    const p = spawnProjectile({ wpn: true, pos: from.clone(), vel: dir.clone().multiplyScalar(tgt ? MM_SPEED : MM_SPEED * 1.3), grav: 0, radius: 0.18, dmg: base * MM_DMG, owner: 'player', kind: 'missile', el: 'arcane', life: 3.2, block: true, onHit: (pr, m, pos) => this.missileBurst(pr, m, pos) });
    if (tgt) p.seek = { tgt, S: from.clone(), dir: dir.clone(), side, up: lane[1], u: 0, speed: MM_SPEED }; return p; }
  // the bard's left click: a strum, and a bright wave of music notes flies straight at the crosshair, hitting the first enemy in its way
  noteWave(base) { const from = this.camDist < 0.6 ? G.camera.position.clone().add(new THREE.Vector3(0.1, -0.2, -0.9).applyQuaternion(G.camera.quaternion)) : this.pos.clone().setY(this.pos.y + 1.25).addScaledVector(this.fwd(), 0.5), dir = this.aimDir(from);
    const grp = new THREE.Group(), cols = ['#ffd860', '#ff9ae0', '#9ae0ff'], chs = ['♪', '♫', '♬'];
    for (let i = 0; i < 3; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: noteTexture(cols[i], chs[i]), transparent: true, depthWrite: false })); sp.scale.setScalar(0.42); sp.userData.ph = i * 2.1; grp.add(sp); }
    G.scene.add(grp); grp.position.copy(from);
    const pr = spawnProjectile({ wpn: true, pos: from.clone(), vel: dir.clone().multiplyScalar(42), grav: 0, radius: 0.3, dmg: base * 0.95, owner: 'player', kind: 'dawn', scale: 0.5, life: 1.2, onHit: (p2, m, pos) => { if (m) this.dealDamage(m, p2.dmg, { ranged: true, basic: true, el: 'arcane' }); V.burst('gold', pos, 14, { speed: 3 }); if (m) playNotes(G.scene, m, cols[(Math.random() * 3) | 0], 2); S.cast && S.cast('holy', pos, 0.3); } });
    let t = 0; G.timers.push({ update: (dt) => { t += dt; const live = pr && pr.pos && t < 1.25 && !(pr.life <= 0) && !pr.hitDone; if (pr && pr.pos) grp.position.copy(pr.pos); grp.children.forEach((sp, i) => { sp.position.set(Math.cos(t * 14 + sp.userData.ph) * 0.28, Math.sin(t * 14 + sp.userData.ph) * 0.28, 0); });
      if (!live || t > 1.25 || (pr && pr.dead)) { G.scene.remove(grp); grp.children.forEach(sp => sp.material.dispose()); return true; } return false; } });
    S.swingW && S.swingW('light', 0.4, this.pos); S.cast && S.cast('holy', this.pos, 0.25); }
  // Arcane Ascension: while he hovers every bolt explodes, a violet blast that hurts everyone round where it lands (m, who it hit, already took the bolt)
  ascBlast(pos, dmg, m) { const R = 3.2; for (const o of mobsInRadius(pos, R)) if (o !== m) this.dealDamage(o, dmg * 0.7, { ranged: true, el: 'arcane' });
    // (the owner: menacing, not an orb) a black-violet blast tears outward, jagged violet lightning cracks out from it, dark smoke boils up,
    // embers fly and a burnt, cracked rune scar is left on the ground under it
    V.burst('shadow', pos, 34, { speed: 8, size: 0.75, life: 0.6, a0: 0.9 }); V.burst('void', pos, 46, { normal: true, speed: 10, size: 0.55, life: 0.55 }); V.burst('arcane', pos, 20, { speed: 12, size: 0.22, life: 0.35 });
    voidArcs(pos, 7, R * 1.05); setTimeout(() => voidArcs(pos, 4, R * 0.8), 90);
    V.burst('vsmoke', pos, 14, { normal: true, speed: 1.6, up: 1.2, size: 1.1, size1: 2.8, life: 1.7, radius: 1.2, grav: -1.4, a0: 0.55 }); V.burst('shadow', pos, 10, { speed: 1.2, up: 1.4, size: 1.2, size1: 2.4, life: 1.4, radius: 1, grav: -1.2, a0: 0.6 });
    V.burst('spark', pos, 16, { speed: 9, size: 0.1, grav: 14, life: 0.9 });
    { const gy = heightAt(pos.x, pos.z); if (pos.y - gy < 2.6) voidScar(new THREE.Vector3(pos.x, gy + 0.04, pos.z), R * 0.75); }
    V.light(pos, '#6a10ff', 7, 0.35, 11); S.explode(pos, 0.9, 'arcane'); S.rumble && S.rumble(pos, 0.5); V.addShake(0.14); G.hitstop = Math.max(G.hitstop || 0, 0.03); }
  missileBurst(pr, m, pos) { if (m) this.dealDamage(m, pr.dmg, { ranged: true, el: 'arcane', basic: true, forceCrit: pr.forceCrit }); if (this.transcendT > 0) this.ascBlast(pos, pr.dmg, m); for (const o of mobsInRadius(pos, MM_SPLASH)) if (o !== m) this.dealDamage(o, pr.dmg * 0.6, { ranged: true, el: 'arcane' }); /* (a small burst: a little damage to anyone close by) */
    V.burst('void', pos, 40, { normal: true, speed: 6, size: 0.6, life: 0.6 }); V.burst('arcane', pos, 34, { speed: 9, size: 0.34 }); V.burst('spark', pos, 12, { speed: 7, size: 0.12 }); V.burst('vsmoke', pos, 8, { normal: true, speed: 1.5, size: 0.9, size1: 1.8, life: 1.2, grav: -0.3, a0: 0.6 }); voidArcs(pos, 4, MM_SPLASH * 0.8); V.light(pos, '#8a2cff', 6, 0.25, 10); S.explode(pos, 0.45, 'arcane'); V.addShake(0.05); /* (the owner: each missile goes off in a violet explosion) */ if (!m) S.hit && S.hit('stone', pos, 0.5); }
  // a point in the first-person view (its own camera) as a world point on the same line of sight: spells leave the hand you see
  vmWorld(obj) { if (!obj || !G.vmCam) return null; const p = obj.getWorldPosition(new THREE.Vector3()), d = p.distanceTo(G.vmCam.position), n = p.clone().project(G.vmCam); const dir = new THREE.Vector3(n.x, n.y, 0.5).unproject(G.camera).sub(G.camera.position).normalize(); return G.camera.position.clone().addScaledVector(dir, Math.max(1.1, d)); }
  fireBurst(pos, r, dmg, direct) {
    if (direct) this.dealDamage(direct, dmg, { el: 'fire', burn: dmg * 0.08 });
    for (const m of mobsInRadius(pos, r)) if (m !== direct) this.dealDamage(m, dmg * 0.5, { el: 'fire', burn: dmg * 0.05 });
    V.burst('fire', pos, 18 + r * 6, { speed: 3 + r, size: 0.5 + r * 0.15, life: 0.5 }); V.burst('smoke', pos, 5, { speed: 1.5, size: 0.8, life: 1.2, vy: 1.5 });
    V.light(pos, '#ff6020', 3 + r, 0.25, 6 + r * 3); S.explode(pos, 0.35 + r * 0.15); if (r > 2) V.ring(pos, r, '#ffa040', 0.35);
  }

  // ---------- weapon abilities on F and C ----------
  // how much this class's abilities may heal (Kingdom Battles): potions and food are not affected
  hk() { return (G.battleFx ? (HEAL_K[this.h.cls] || 0) : 1) * (1 + Game.fxCount(this.h, 'heal') * 0.1 + Game.fxCount(this.h, 'u_sup') * 0.25); }
  qty(b, extra) { return G.battleFx ? b + Math.round((this.h.level - 1) / (LEVEL_CAP - 1) * extra) : b; }
  // area of effect grows with level in Kingdom Battles: +4% radius per level (+36% at level 10)
  areaK() { return (G.battleFx ? 1 + (this.h.level - 1) * 0.36 / (LEVEL_CAP - 1) : 1) * (this._extK || 1); }
  specialAttack() { const w = this.weapon; if (!w) return; const id = RMB_SPECIAL[w.wt]; if (!id) return; if (!Game.canSpecial(this.h, w.wt)) { if (!(this.cd.lockF > 0)) { this.cd.lockF = 1.5; G.hooks.toast && G.hooks.toast(`${WSKILLS[id].name} unlocks at ${WEAPON_TYPES[w.wt].name} mastery ${Game.WM_F} (press L)`, '🔒', 'bad'); S.error(); } return; } this.weaponAbility(0, { fam: familiesOf(w.wt)[0], id }); }
  weaponAbility(slot, skOverride) {
    const W = this.W; if (!W || this.swim) return;
    // Kingdom Battles: right click cuts straight through a swing
    if (G.battleFx && this.atk && !this.dodge && !this.gathering && !this.dead && !(this.cd['w' + slot] > 0)) { this.atk = null; this.queued = null; this.press = null; this.trail.active = this.trailL.active = false; }
    if (this.busy()) return;
    const sk = skOverride || this.skills()[slot]; if (!sk) return;
    const key = 'w' + slot;
    if (this.cd[key] > 0) { S.error(); return; }
    const S2 = WSKILLS[sk.id], fam = sk.fam;
    const aR = (1 + this.wp('area', fam) * 0.15) * this.areaK(), aCd = 1 - this.wp('area', fam) * 0.15;
    this.cd[key] = S2.cd * aCd * (this.weapon && this.weapon.size ? this.weapon.size : 1);
    const base = weaponDamage(this.h, this.weapon), f = this.fwd(), p0 = this.pos.clone();
    const spin = (r, mult, extra = {}, sound = 1.6) => {
      this.atk = { name: 'area', t: 0, dur: 0.7, hit: true, noQueue: true };
      S.swingW(this.swingKind('area'), sound, this.pos); S.swingW(this.swingKind('area'), 1.3, this.pos);
      setTimeout(() => { if (this.dead) return; const p = this.pos.clone(); areaDamage(p, r * aR, base * mult, Object.assign({ knock: 7, big: true, melee: true }, extra)); V.ring(p, r * aR, '#fff0c0', 0.45); V.burst('dust', p.clone().setY(p.y + 0.2), 20 + r * 4, { speed: r * 1.2, size: 0.45, up: 0.3, radius: r * 0.6 }); V.addShake(0.25); S.hit('stone', p); }, 200 * ABIL_DELAY_K());
    };
    const front = (reach, half, mult, extra = {}, delay = 260, anim = 'swing3') => {
      this.atk = { name: anim, t: 0, dur: 0.75, hit: true, noQueue: true };
      S.swingW(this.swingKind('swing3'), 1.6, this.pos);
      setTimeout(() => { if (this.dead) return; let hit = false; for (const m of mobsInCone(this.pos, this.yaw, reach * aR, half)) { hit = true; this.dealDamage(m, base * mult * (extra.exec && m.hp < m.maxHp * 0.35 ? 2 : 1), Object.assign({ big: true, melee: true, knock: m.pos.clone().sub(this.pos).setY(0).normalize().multiplyScalar(5) }, extra)); if (this.swingKind('swing3') === 'blunt') S.blunt(m.pos); } if (hit) { G.hitstop = 0.08; V.addShake(0.3); } const p = this.pos.clone().addScaledVector(this.fwd(), reach * 0.7); p.y = heightAt(p.x, p.z); V.burst('dust', p, 14, { speed: 3, size: 0.5 }); }, delay);
    };
    const dash = (dist, mult, extra = {}) => {
      this.dodge = { t: 0, dur: dist / 17, dir: f.clone(), speed: 17, charge: true, hitSet: new Set(), dmg: base * mult, extra }; this.fovKick = 12;
      this.atk = { name: 'thrust3', t: 0.3, dur: 0.5, hit: true, noQueue: true };
    };
    const throwP = (kind, speed, mult, extra = {}, pierce = false, n = 1, spread = 0) => {
      const from = this.handPos(), dir = this.aimDir(from);
      for (let i = 0; i < n; i++) { const d = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), (i - (n - 1) / 2) * spread); spawnProjectile({ pos: from.clone(), vel: d.multiplyScalar(speed), grav: kind === 'arrow' ? 8 : 3, radius: kind === 'wave' ? 1.3 : 0.3, dmg: base * mult, owner: 'player', kind, life: 2.5, pierce, onHit: extra.onHit }); }
      this.atk = { name: W.kind === 'bow' ? 'shoot' : W.kind === 'staff' ? 'cast' : 'swing2', t: 0.3, dur: 0.5, hit: true };
    };
    switch (sk.id) {
      case 'whirlwind': spin(4.5, 1.5); break;
      case 'wheel': spin(4.5, 1.5, { slow: 3 }); break;
      case 'doubleshot': { this.fireGun(0.8, true, 1.5, true); this.dodge = { t: 0, dur: 0.36, dir: f.clone().multiplyScalar(-1), speed: 22 }; this.iframes = 0.45; this.vel.y = 5; this.onGround = false; S.dodge(); V.burst('dust', this.pos.clone(), 14, { speed: 3, size: 0.8 }); break; }
      case 'whirlaxes': spin(4.5, 1.3, { bleed: base * 0.12 }); break;
      case 'backstabw': { // twin daggers: both blades into the back
        this.atk = { name: 'stabR', t: 0, dur: 0.35, hit: true, noQueue: true }; S.swingW('light', 1.3, this.pos);
        setTimeout(() => { if (this.dead) return; let best = null, bd = 1e9; for (const m of mobsInCone(this.pos, this.yaw, this.W.reach + 0.6, 0.6)) { const d = m.pos.distanceTo(this.pos); if (d < bd) { bd = d; best = m; } } if (!best) return;
          const behind = Math.abs(angDiff(best.yaw || 0, Math.atan2(this.pos.x - best.pos.x, this.pos.z - best.pos.z))) > 2.0;
          if (behind) this.buffs.nextCrit = true; this.dealDamage(best, base * (behind ? 3.6 : 1.4), { melee: true, big: true, bleed: base * 0.1 }); V.number(best.pos.clone().setY(best.pos.y + (best.height || 1.6) + 0.9), behind ? 'Backstab!' : 'Stab', behind ? 'crit' : 'dmg'); G.hitstop = 0.07; }, 140);
        break; }
      case 'tripstab': {
        // three quick alternating stabs at the one enemy in front, the last the deepest
        const ms = [1.1, 1.1, 1.7];
        ms.forEach((mult, k) => setTimeout(() => {
          if (this.dead) return;
          this.atk = { name: k % 2 ? 'stabL' : 'stabR', t: 0, dur: 0.22, hit: true, noQueue: true };
          S.swingW('light', 1 + k * 0.15, this.pos);
          let best = null, bd = 1e9; for (const m of mobsInCone(this.pos, this.yaw, this.W.reach + 0.6, 0.7)) { const d = m.pos.distanceTo(this.pos); if (d < bd) { bd = d; best = m; } }
          if (!best) return;
          const behind = Math.abs(angDiff(best.yaw || 0, Math.atan2(this.pos.x - best.pos.x, this.pos.z - best.pos.z))) > 2.0;
          this.dealDamage(best, base * mult * (behind ? 1.5 : 1), { melee: true, offhand: k % 2 === 1, big: k === 2, bleed: k === 2 ? base * 0.15 : 0 });
          if (k === 2) { G.hitstop = 0.06; V.addShake(0.15); }
        }, k * 190));
        break;
      }
      case 'shadowflurry': this.atk = { name: 'fury', t: 0, dur: 1.0, hits: 7, rank: 1, hit: true, noQueue: true, base, bleed: true }; S.swingW('light', 1.2, this.pos); break;
      case 'greatcleave': spin(6.5, 1.7); break;
      case 'sweep': spin(5.5, 1.5); break;
      case 'reaping': spin(6.5, 1.4, { bleed: base * 0.1 }); break;
      case 'quake': spin(7, 1.4, { slow: 3 }); break;
      case 'lunge': dash(8, 2.0); break;
      case 'shieldcharge': dash(11, 1.4, { stun: 1.5 }); S.block(true, this.pos); break;
      case 'skullcrack': front(this.W.reach + 0.5, 0.6, 2.2, { stun: 1.6 }); break;
      case 'execute': front(this.W.reach + 0.5, 0.8, 2.4, { exec: true }, 330, 'heavy'); break;
      case 'rend': front(this.W.reach + 0.4, 0.8, 1.3, { bleed: base * 0.25 }); break;
      case 'shieldbash': { this.atk = { name: 'heavy', t: 0.2, dur: 0.6, hit: true, noQueue: true }; S.block(true, this.pos); setTimeout(() => { if (this.dead) return; const p = this.pos.clone(); areaDamage(p, 5 * aR, base * 1.1, { knock: 11, stun: 2, big: true, melee: true }); V.ring(p, 5 * aR, '#c0d8ff', 0.4); V.burst('dust', p, 30, { speed: 6, size: 0.6, up: 0.3 }); S.blunt(p); S.hit('stone', p); V.addShake(0.35); }, 250 * ABIL_DELAY_K()); break; }
      case 'shockwave': { this.atk = { name: 'heavy', t: 0.2, dur: 0.7, hit: true, noQueue: true }; setTimeout(() => { if (this.dead) return; const p = this.pos.clone(); areaDamage(p, 4.5 * aR, base * 1.4, { slow: 3, knock: 6, big: true, melee: true }); V.ring(p, 4.5 * aR, '#ffe0a0', 0.5); V.burst('stone', p, 30, { speed: 7, size: 0.3, grav: 14 }); S.blunt(p); S.rumble(p, 0.6); V.addShake(0.4); }, 300 * ABIL_DELAY_K()); break; }
      case 'hammerfall': { const tgt = groundPoint(10); this.leap = { t: 0, dur: 0.7, from: this.pos.clone(), to: tgt, dmg: base * 2.4, r: 5 * aR }; this.atk = { name: 'heavy', t: 0, dur: 0.85, hit: true, noQueue: true }; S.jump(); break; }
      case 'hatchet': throwP('axe', 32, 1.8, { onHit: (p, m) => { if (m) this.dealDamage(m, p.dmg, { bleed: base * 0.12, melee: true }); } }); S.swingW('axe', 1.2, this.pos); break;
      case 'javelin': throwP('javelin', 45, 2.2, {}, true); S.swingW('spear', 1.4, this.pos); break;
      case 'earthcleaver': { const from = this.pos.clone(); from.y += 0.6; spawnProjectile({ pos: from, vel: f.clone().multiplyScalar(24), grav: 0, radius: 1.6, dmg: base * 2.0, owner: 'player', kind: 'wave', life: 0.9, pierce: true }); this.atk = { name: 'heavy', t: 0.3, dur: 0.6, hit: true, noQueue: true }; S.rumble(this.pos, 0.6); V.addShake(0.3); break; }
      case 'twinfury': this.atk = { name: 'fury', t: 0, dur: 1.15, hits: 6, rank: 1, hit: true, noQueue: true, base }; S.swing(1.2, this.pos); break;
      case 'fan': { for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; const d = new THREE.Vector3(Math.sin(a), 0, Math.cos(a)); spawnProjectile({ pos: this.pos.clone().setY(this.pos.y + 1.1), vel: d.multiplyScalar(26), grav: 2, radius: 0.35, dmg: base * 0.8, owner: 'player', kind: 'knife', life: 0.5 }); } this.atk = { name: 'area', t: 0.3, dur: 0.5, hit: true, noQueue: true }; S.swingW('light', 1.5, this.pos); break; }
      case 'multishot': throwP('arrow', 55, 0.9, {}, false, 5, 0.09); S.bowShot(this.pos); break;
      case 'fan8': throwP('arrow', 52, 0.85, {}, false, this.qty(5, 6), 0.11); S.bowShot(this.pos); S.bowShot(this.pos); break;
      case 'rain': {
        const tgt = groundPoint(40), r = 6 * aR; this.atk = { name: 'shoot', t: 0, dur: 0.5, hit: true }; S.bowShot(this.pos); V.ring(tgt, r, '#a0ffb0', 2.2, 0.1);
        for (let i = 0; i < 22; i++) setTimeout(() => { const p = tgt.clone().add(new THREE.Vector3(rand(-r, r) * 0.8, 0, rand(-r, r) * 0.8)); spawnProjectile({ pos: p.clone().add(new THREE.Vector3(rand(-3, 3), 26, rand(-3, 3))), vel: new THREE.Vector3(0, -45, 0), grav: 0, radius: 0.5, dmg: base * 0.45, owner: 'player', kind: 'arrow', life: 2 }); }, (0.5 + i * 0.07) * 1000);
        break;
      }
      case 'meteor': {
        const from = this.handPos(); this.atk = { name: 'castBig', t: 0, dur: 0.9, hit: true }; S.cast('fire', from, 2); S.whistle(from, 1.5);
        setTimeout(() => { const f2 = this.camDist < 0.6 ? G.camera.position.clone().add(new THREE.Vector3(0, 0.4, -1.2).applyQuaternion(G.camera.quaternion)) : this.handPos().add(new THREE.Vector3(0, 1.2, 0)); const d2 = this.aimDir(f2); d2.y += 0.32; d2.normalize(); spawnProjectile({ pos: f2, vel: d2.multiplyScalar(27), grav: 17, radius: 1.0, dmg: base * 3.0, owner: 'player', kind: 'meteor', life: 6, onHit: (p, m, pos) => this.meteorImpact(pos, 9 * aR, p.dmg) }); }, 450 * ABIL_DELAY_K());
        break;
      }
      case 'flamewave': { this.atk = { name: 'castBig', t: 0.3, dur: 0.7, hit: true }; S.cast('fire', this.pos, 1.8); for (const m of mobsInCone(this.pos, this.yaw, 9 * aR, 0.6)) this.dealDamage(m, base * 1.6, { el: 'fire', burn: base * 0.12 }); for (let i = 0; i < 70; i++) { const a = this.yaw + (Math.random() - 0.5) * 1.1, d = Math.random() * 9 * aR; V.add.spawn(this.pos.x + Math.sin(a) * d, this.pos.y + 0.5 + Math.random(), this.pos.z + Math.cos(a) * d, Math.sin(a) * 3, 2, Math.cos(a) * 3, 0.7, 0.9, 0.1, new THREE.Color('#ffe08a'), new THREE.Color('#ff3a08'), 1, 0, -1, 1); } V.light(this.pos.clone().addScaledVector(f, 4).setY(this.pos.y + 1), '#ff6020', 5, 0.4); break; }
      case 'blizzard': {
        const tgt = groundPoint(35), r = 7 * aR; this.atk = { name: 'castBig', t: 0, dur: 0.9, hit: true }; S.cast('frost', tgt, 1.5); V.ring(tgt, r, '#a0e0ff', 0.6);
        let ticks = 0; const iv = setInterval(() => { ticks++; for (const m of mobsInRadius(tgt, r)) this.dealDamage(m, base * 0.35, { slow: 2, el: 'frost', silent: ticks % 2 === 0 }); V.burst('frost', tgt.clone().setY(tgt.y + 6), 40, { speed: 2, radius: r * 2, vy: -6, size: 0.3, life: 1.0, grav: 4 }); if (ticks % 3 === 0) S.cast('frost', tgt, 0.6); if (ticks >= 10) clearInterval(iv); }, 400 * ABIL_DELAY_K());
        break;
      }
      case 'icelance': { const from = this.handPos(), dir = this.aimDir(from); spawnProjectile({ pos: from, vel: dir.multiplyScalar(50), grav: 1, radius: 0.5, dmg: base * 2.4, owner: 'player', kind: 'frost', scale: 2.6, life: 2, pierce: true, onHit: (p, m, pos) => { if (m) this.dealDamage(m, p.dmg, { freeze: 1.5, el: 'frost' }); V.burst('frost', pos, 20, { speed: 4 }); } }); this.atk = { name: 'cast', t: 0.3, dur: 0.5, hit: true }; S.cast('frost', from, 1.3); break; }
      case 'nova': {
        const from = this.handPos(); this.atk = { name: 'castBig', t: 0, dur: 0.9, hit: true }; S.cast('arcane', from, 1.5);
        setTimeout(() => { const f2 = this.handPos(); const d2 = this.aimDir(f2); spawnProjectile({ pos: f2, vel: d2.multiplyScalar(22), grav: 6, radius: 0.5, dmg: base * 2.2, owner: 'player', kind: 'orb', scale: 2.5, life: 4, aoe: true, onHit: (p, m, pos) => { const r = 6.5 * aR; for (const mm of mobsInRadius(pos, r)) this.dealDamage(mm, p.dmg, { el: 'arcane', knock: mm.pos.clone().sub(pos).setY(0).normalize().multiplyScalar(-5) }); V.sphereFlash(pos, r, '#b060ff', 0.45); V.burst('arcane', pos, 60, { speed: 8, size: 0.4 }); V.ring(pos, r, '#d090ff', 0.5); V.light(pos, '#a040ff', 6, 0.4, 20); S.explode(pos, 1.3, 'arcane'); V.addShake(0.25); } }); }, 400 * ABIL_DELAY_K());
        break;
      }
      case 'missiles': { for (let i = 0; i < this.qty(3, 4); i++) setTimeout(() => { if (this.dead) return; const from = this.handPos(), dir = this.aimDir(from); dir.x += (Math.random() - 0.5) * 0.3; dir.y += 0.15; spawnProjectile({ pos: from, vel: dir.normalize().multiplyScalar(28), grav: 0, radius: 0.3, dmg: base * 0.9, owner: 'player', kind: 'arcane', life: 2.5, homing: true, onHit: (p, m, pos) => { if (m) this.dealDamage(m, p.dmg, { el: 'arcane' }); V.burst('arcane', pos, 14, { speed: 3 }); } }); S.cast('arcane', from, 0.6); }, i * 130); this.atk = { name: 'cast', t: 0, dur: 0.6, hit: true }; break; }
    }
    G.hooks.toast && false;
  }
  meteorImpact(pos, r, dmg) {
    pos.y = heightAt(pos.x, pos.z);
    for (const m of mobsInRadius(pos, r)) { const d = Math.hypot(m.pos.x - pos.x, m.pos.z - pos.z); this.dealDamage(m, dmg * (1 - 0.45 * d / r), { el: 'fire', burn: dmg * 0.06, knock: m.pos.clone().sub(pos).setY(0).normalize().multiplyScalar(10), big: true, stun: 0.8 }); }
    V.sphereFlash(pos.clone().setY(pos.y + 1), r * 0.9, '#ff8030', 0.5);
    V.burst('fire', pos, 120, { speed: 14, size: 1.3, life: 0.9, up: 1.2 }); V.burst('ember', pos, 60, { speed: 16, size: 0.15, life: 1.8, grav: 6 });
    V.burst('smoke', pos, 30, { speed: 5, size: 2.5, life: 3, vy: 3, radius: 3 }); V.burst('stone', pos, 25, { speed: 10, size: 0.3, life: 1.3, grav: 15 });
    V.ring(pos, r * 1.4, '#ffb050', 0.7); V.ring(pos, r, '#ff4010', 0.45);
    V.light(pos.clone().setY(pos.y + 3), '#ff5010', 12, 0.8, 40); S.explode(pos, 2.4); V.addShake(0.9); G.hitstop = 0.08;
    const d = this.pos.distanceTo(pos); if (d < r * 3) V.addShake(0.3);
  }
  furyHit(a, k) {
    const W = this.W, rank = a.rank;
    const r = rank >= 6 ? W.area * 1.3 : W.reach * 1.3;
    const targets = rank >= 6 ? mobsInRadius(this.pos, r) : mobsInCone(this.pos, this.yaw, r, 1.1);
    for (const m of targets) {
      this.dealDamage(m, a.base * 0.55 * (rank >= 10 ? 1.2 : 1), { offhand: k % 2 === 0, melee: true, silent: false, bleed: a.bleed ? a.base * 0.06 : 0 });
      if (rank >= 8) { const pull = this.pos.clone().sub(m.pos).setY(0).normalize().multiplyScalar(4); m.status.knock.add(pull); }
    }
    S.swingW(this.swingKind(k % 2 ? 'swing1' : 'off1'), 0.8, this.pos);
    if (rank >= 6 && this.camDist >= 0.6) V.ring(this.pos, r, '#e0e8ff', 0.25); // (not round your own feet in first person: it read as a grey sheet in front of you)
    if (k === a.hits && rank >= 4) { // cross slash wave
      const from = this.pos.clone(); from.y += 1; const dir = this.fwd();
      spawnProjectile({ pos: from, vel: dir.multiplyScalar(26), grav: 0, radius: 1.3, dmg: a.base * 1.6, owner: 'player', kind: 'wave', life: 0.8, pierce: true });
      S.cast('arcane', from, 0.6);
    }
  }

  // the arena's ultimate: ready at 100% charge, fires straight away, then charges again
  ultimate() { const h = this.h, id = h.arenaUlt; if (!id || this.dead) return; if (G.time - (this.abLockT || -9) < 0.25) return; if (this.phaseInvis && this.stealth > 0) { this.stealth = 0; this.phaseInvis = false; } if (h.camp && h.level < Game.kitNeed(h, id)) { S.error && S.error(); G.hooks.toast && G.hooks.toast('Your ultimate unlocks at level ' + Game.kitNeed(h, id), '🔒', 'bad'); return; } if ((h.ultCharge || 0) < 100) { S.error(); G.hooks.toast && G.hooks.toast(`Ultimate ${Math.floor(h.ultCharge || 0)}% charged`, '★', 'bad'); return; } V.ultUntil = performance.now() + 7000; /* (an ultimate may draw its big rings) */
    const k = ABILITIES[h.cls].findIndex(a => a.id === id); if (k < 0) return; this.cd['a' + (k + 1)] = 0; this.abCast = null; this.summonCast = null; h.ultRefund = false; this.ability(k); h.ultCharge = h.ultRefund ? 100 : 0; this.abLockT = G.time; if (h.ultRefund) { h.ultRefund = false; return; } if (id === 'ar_assassinate') return; /* (the owner: no animation, no flash: an instant shadow strike) */ this.ultImmT = Math.max(this.ultImmT || 0, 2.2); this.ultPoseT = this.oozeT > 0 || id === 'ar_bertha' || id === 'ar_banner' || id === 'ar_wrath' || id === 'ar_arrowrain' || id === 'ar_miracle' || id === 'ar_meteors' ? 0 : /* (the elementalist: his own arms-out hover) */ /* (the cleric: no pose, she hovers and keeps moving) */ /* (the ranger: no pose at all) */ /* (the paladin: just his slam) */ /* (the warrior: no cast pose for his banner) */ Math.max(this.ultPoseT || 0, 1.5); V.burst(h.cls === 'necromancer' ? 'poison' : 'gold', this.pos.clone().setY(this.pos.y + 1.2), 60, { speed: 6 }); /* (the owner: no generic ring at the start of any ultimate; each has its own look) */ V.addShake(0.3); { const ua = ABILITIES[h.cls][k]; if (id === 'ar_bladestorm') { this.tpT = 5.3; this.tpDist = 5.5; } else { this.tpDist = 0; this.tpT = (id === 'ar_demon' || id === 'ar_wrath' || id === 'ar_fists' || id === 'ar_assassinate' || id === 'ar_arrowrain' || id === 'ar_overgrowth' || id === 'ar_spirittotem' || id === 'ar_miracle' || id === 'ar_bertha') ? 0 : Math.min(4, Math.max(2.2, (ua && ua.dur) || 0)); } } /* (third person while the ultimate plays) */
    V.burst('gold', this.pos.clone().setY(this.pos.y + 1.5), 50, { speed: 6 }); V.addShake(0.35); S.battleCry && S.battleCry(); }
  // where a ground-aimed ultimate lands: on the enemy you aim at (or the one nearest the crosshair's line, within about
  // 13 degrees left or right, when the aim point is near or beyond them), else the ground under the crosshair. Aiming a
  // little high no longer throws it 30 m past the enemy in front of you
  ultPoint(range) { const r = aimRay(range + 10); if (r.mob && foe(r.mob) && Math.hypot(r.mob.pos.x - this.pos.x, r.mob.pos.z - this.pos.z) <= range + 2) return r.mob.pos.clone();
    const gp = groundPoint(range), d = G.camera.getWorldDirection(new THREE.Vector3()), ya = Math.atan2(d.x, d.z), gd = Math.hypot(gp.x - this.pos.x, gp.z - this.pos.z); let best = null, ba = 0.23;
    for (const m of G.mobs) { if (m.dead || !foe(m) || m.pet || m.ally || !m.pos) continue; const dx = m.pos.x - this.pos.x, dz = m.pos.z - this.pos.z, L = Math.hypot(dx, dz); if (L > range + 2 || L < 1.5) continue;
      let da = Math.atan2(dx, dz) - ya; da = Math.abs(Math.atan2(Math.sin(da), Math.cos(da))); if (da < ba && (gd > L - 3 || Math.hypot(gp.x - m.pos.x, gp.z - m.pos.z) < 6)) { ba = da; best = m; } }
    return best ? best.pos.clone() : gp; }
  // the enemy an ultimate is aimed at: the one under the crosshair, else the one nearest the crosshair's line within about
  // 13 degrees left or right (pitch does not matter: aiming a little high or low at someone still counts)
  ultFoe(range) { const t = this.aimFoe(range); if (t) return t; const d = G.camera.getWorldDirection(new THREE.Vector3()), ya = Math.atan2(d.x, d.z); let best = null, ba = 0.23;
    for (const m of G.mobs) { if (m.dead || !foe(m) || m.pet || m.ally || !m.pos) continue; const dx = m.pos.x - this.pos.x, dz = m.pos.z - this.pos.z, L = Math.hypot(dx, dz); if (L > range || L < 0.5) continue; let da = Math.atan2(dx, dz) - ya; da = Math.abs(Math.atan2(Math.sin(da), Math.cos(da))); if (da < ba) { ba = da; best = m; } } return best; }
  // who is under the crosshair: the aim ray, or an enemy within a hair (about 4 degrees) of it, never someone off to the side
  aimFoe(range) { const r = aimRay(range); if (r.mob && foe(r.mob)) return r.mob; const cam = G.camera, o = cam.getWorldPosition(new THREE.Vector3()), d = cam.getWorldDirection(new THREE.Vector3()); let best = null, ba = 0.07;
    for (const m of G.mobs) { if (m.dead || !foe(m)) continue; const v = m.pos.clone().setY(m.pos.y + (m.height || 1.6) * 0.55).sub(o), L = v.length(); if (L > range) continue; const a2 = Math.acos(Math.min(1, v.dot(d) / L)); if (a2 < ba) { ba = a2; best = m; } } return best; }
  // the necromancer's shrunken head (in his left hand): where its mouth is in the world
  headMouth() { const fpM = this.camDist < 0.6 && this.vm && this.vm.headMouth; if (fpM) { this.vm.g.updateMatrixWorld(true); const v = fpM.getWorldPosition(new THREE.Vector3()); return G.camera.localToWorld(G.vmCam.worldToLocal(v)); } const m = this.ch && this.ch.headMouthObj; if (!m) return this.spellFrom(); this.ch.root.updateMatrixWorld(true); return m.getWorldPosition(new THREE.Vector3()); }
  // the necromancer's scythe (the arena): one wide sweep, right to left, cutting every enemy in the arc in front of him
  reap(a, base) { const RP = G.hooks.reap || { k: 1, half: 1.15 }, R = G.hooks.necroReach ? G.hooks.necroReach(this) : 4, H = RP.half, targets = mobsInCone(this.pos, this.yaw, R, H);
    for (const m of targets) { const kn = m.pos.clone().sub(this.pos).setY(0).normalize().multiplyScalar(2.5); this.dealDamage(m, base * RP.k, { basic: true, melee: true, knock: kn, critBonus: 0.05 });
      const hp = m.pos.clone().setY(m.pos.y + (m.height || 1.6) * 0.6); V.burst('blood', hp, 14, { speed: 5 }); V.burst('shadow', hp, 8, { speed: 3, size: 0.4 }); V.sphereFlash(hp, 0.7, '#c080ff', 0.12); }
    if (targets.length) { S.reapHit && S.reapHit(targets[0].pos, targets.length); G.hitstop = Math.max(G.hitstop || 0, 0.05); V.addShake(0.12 + 0.04 * Math.min(3, targets.length)); this.wpnXp && this.wpnXp(1); }
    slashArc(this, R, H, 'swing2', targets.length > 0, new THREE.Color('#9a6aff')); // (the reaping crescent, as wide and long as what it cuts; seen from behind)
    if (this.camDist < 0.6) { const c = G.camera.position.clone().addScaledVector(G.camera.getWorldDirection(new THREE.Vector3()), 2.2); V.burst('shadow', c, 6, { speed: 3, size: 0.3, life: 0.3 }); } }
  // Soul Rend: raise the head; green soul-water flows out of the enemy you aim at into its mouth; you heal, they slow
  soulRend(ab, base, up, key) {
    const t = this.aimFoe(26); if (!t) { this.cd[key] = 0; G.hooks.toast && G.hooks.toast('Aim at an enemy', '☠', 'bad'); S.error(); return; }
    const dmg = base * (ab.dmg || 1.4) * up; this.dealDamage(t, dmg * 0.4, { el: 'arcane', slow: 3, silent: true }); this.heal(dmg * 0.4 * 0.55 * this.hk()); this.headUpT = 2.2; S.demon(this.pos, 1.1); S.heal && S.heal();
    const look = () => t.pos.clone().setY(t.pos.y + (t.height || 1.6) * 0.6), dg = this.ch && this.ch.dangle; this.rendLook = look; let tick = 0.25; // (the head turns to face its victim while it drinks; the stream runs for 2 s and drains as it goes)
    let tt = 0; G.timers.push({ update: (dt) => { tt += dt; if (this.dead || t.dead && tt > 0.3 || tt > 2.0) { this.rendLook = null; if (dg) dg.userData.lookAt = null; return true; } if (dg) dg.userData.lookAt = look(); if ((tick -= dt) <= 0 && !t.dead) { tick = 0.25; this.dealDamage(t, dmg * 0.075, { el: 'arcane', silent: true }); this.heal(dmg * 0.075 * 0.55 * this.hk()); }
      const a = t.pos.clone().setY(t.pos.y + (t.height || 1.6) * 0.6), b = this.headMouth(), mid = a.clone().lerp(b, 0.5).setY(Math.max(a.y, b.y) + 1.2);
      for (let k = 0; k < 7; k++) { const u = ((tt * 1.6 + k / 7) % 1), q = a.clone().multiplyScalar((1 - u) * (1 - u)).add(mid.clone().multiplyScalar(2 * u * (1 - u))).add(b.clone().multiplyScalar(u * u)); V.burst(k % 2 ? 'poison' : 'green', q, 1, { speed: 0.15, size: 0.32 - u * 0.1, size1: 0.08, life: 0.22 }); }
      if (Math.random() < 0.5) V.burst('poison', a, 2, { speed: 1.5, size: 0.25 }); return false; } });
  }
  // Plague Breath: the head roars out a cone of plague for a second: poison and Blight on all it touches
  plagueBreath(ab, base, up) {
    this.headUpT = 2.6; S.demon(this.pos, 1.3); const snd = S.spellLoop ? S.spellLoop('frost') : null; let tt = 0, tick = 0; V.addShake(0.2);
    G.timers.push({ update: (dt) => { tt += dt; tick -= dt; if (this.dead) { if (snd) snd.stop(); return true; } const from = this.headMouth(), dir = this.aimDir(from);
      const fpv = this.camDist < 0.6; /* (first person: the cloud starts a couple of metres out and stays thinner, so it never sits over the crosshair as a glowing blob) */ for (let k = 0; k < (fpv ? 4 : 6); k++) V.burst(k % 3 ? 'poison' : 'green', from.clone().addScaledVector(dir, fpv ? 2.4 : 0.3), 1, { dir, speed: 13 + Math.random() * 7, up: 0.35, size: fpv ? 0.18 : 0.25, size1: fpv ? 0.8 : 1.3, life: 0.6, a0: fpv ? 0.45 : 0.75, grav: 2 });
      if (Math.random() < 0.6) V.burst('shadow', from.clone().addScaledVector(dir, fpv ? 5 : 2.5), 1, { dir, speed: 5, size: 0.8, size1: 2.2, life: 0.8, a0: 0.35 });
      if ((this.pbl = (this.pbl || 0) - dt) <= 0) { this.pbl = 0.1; V.light(from.clone().addScaledVector(dir, 2.5), '#70ff40', 3.5, 0.15, 10); }
      if (tick <= 0) { tick = 0.2; for (const m of mobsInCone(this.pos, this.yaw, 12.75, 0.6)) this.dealDamage(m, base * (ab.dmg || 0.35) * up * 0.3, { el: 'arcane', plague: base * (ab.poisonDot || 0.9) * up * 0.3, blight: ab.blight || 6, silent: true }); } // (50% further reach; every enemy it touches takes poison once a second for 6 s)
      if (tt > 2.4) { if (snd) snd.stop(); return true; } return false; } }); // (twice as long a spray)
  }
  hotbar(i) {
    if (this.fearT > 0) { S.error(); return; }
    const sl = this.h.hotbar && this.h.hotbar[i]; if (!sl) return;
    if (G.campAb && i < 5 && sl.t === 'ab') { if (G.time < (this.gcdT || 0)) { S.error(); return; } } // keys 1-5 share a 1.5 s cooldown (F, C, Q do not)
    if (sl.t === 'ab') { const k = ABILITIES[this.h.cls].findIndex(a => a.id === sl.id); if (k >= 0) { const cd0 = this.cd['a' + (k + 1)] || 0; this.ability(k); if (G.campAb && i < 5 && (this.cd['a' + (k + 1)] || 0) > cd0) this.gcdT = G.time + 1.5; } }
    else if (sl.t === 'item') { if (count(this.h, sl.id) > 0) useItem(this.h, sl.id, this); else S.error(); }
  }
  // ---------- class abilities ----------
  ability(i, fromCast) { if (this.iceFormOn && this.buffs.iceblock > 0) { const ab0 = ABILITIES[this.h.cls] && ABILITIES[this.h.cls][i]; if (ab0 && ab0.t === 'kbiceform') { this.buffs.iceblock = 0; this.iframes = 0; } return; } /* (Ice Form: pressing it again breaks the ice (it explodes); nothing else can be cast while frozen) */
    if (this.held) return; /* (during an ultimate's animation, or in a demon's grip: no casting) */
    if (this.phaseInvis && this.stealth > 0) { this.stealth = 0; this.phaseInvis = false; this.buffs.nextCrit = false; } // (any ability ends the invisibility; only a left click out of it crits)
    if ((this.axeOut || this.axeThrow) && ABILITIES[this.h.cls][i] && ['earthsplitter', 'ar_legsweep'].includes(ABILITIES[this.h.cls][i].id)) { S.error && S.error(); return; } /* (no axe in hand: no axe moves until it is back) */
    const ab = ABILITIES[this.h.cls][i]; if (!ab) return;
    if (this.h.arena && !fromCast && G.time - (this.abLockT || -9) < 0.25) return; // (the owner: a quarter second between abilities, so they cannot all be fired at once)
    if (this.h.camp && this.h.level < Game.kitNeed(this.h, ab.id)) { S.error && S.error(); G.hooks.toast && G.hooks.toast(`${ab.name} unlocks at level ${Game.kitNeed(this.h, ab.id)}`, '🔒', 'bad'); return; } /* (the campaign: abilities unlock as you level) */
    if (this.sheathed) this.drawWeapons();
    if (!Game.abilityKnown(this.h, ab)) { G.hooks.toast && G.hooks.toast(Game.hasTrees(this.h.cls) ? `Unlock ${ab.name} in your skill trees (K)` : `${ab.name} unlocks at level ${ab.level}`, '🔒', 'bad'); S.error(); return; }
    if (G.battleFx && ab.needs && !(this.weapon && (this.weapon.wt === ab.needs || (ab.needs === 'daggers' && this.weapon.wt === 'dagger')))) { G.hooks.toast && G.hooks.toast(`${ab.name} needs ${WEAPON_TYPES[ab.needs].name} in your hands`, '🗡', 'bad'); S.error(); return; }
    if (G.battleFx && ab.song) { G.hooks.toast && G.hooks.toast(`${ab.name} plays by itself while it is on your hotbar`, '♪', 'gold'); return; }
    const key = 'a' + (i + 1);
    if (!fromCast) {
    if (this.cd[key] > 0 || this.dead || this.gathering || this.swim || this.abCast || this.summonCast) { S.error(); return; }
    const isBanner = false; if (isBanner && G.time < (this.bannerT || 0)) { S.error(); G.hooks.toast && G.hooks.toast(`Banners: wait ${Math.ceil(this.bannerT - G.time)} s between plantings`, '⚑', 'bad'); return; }
    if (this.atk) { this.atk = null; this.queued = null; this.trail.active = this.trailL.active = false; } // abilities cut straight through a swing
    if (!this.spend(Math.round(ab.cost * (1 - Game.fxCount(this.h, 'cost') * 0.1)), G.campAb ? ab.res : undefined)) return;
    this._extK = 1; this.cd[key] = ab.cd * Game.perkCd(Game.perkLvl(this.h, ab.id, 'cd')) * (ab.id === 'ar_mendbanner' ? 1 - 0.1 * Game.arenaPassive(this.h, 'bannerSwift') : 1) * Game.arenaCdAll(this.h) * (1 - Game.fxCount(this.h, 'cd') * 0.08 - Game.fxCount(this.h, 'u_sup') * 0.15); this.abLockT = G.time; if (isBanner) this.bannerT = G.time + 2;
    const ct = this.h.arena ? 0 : /* the arena: cooldowns only, no cast times */ G.campAb && !isSupport(ab) ? 0 : (G.campAb && ab.castT) || CAST_T[ab.id] || ACT_T[ab.id] || (BATTLE && ab.id === 'rally' ? 0.8 : 0), /* campaign: F C Q fire at once and are held back by their cooldowns */ isSpell = !!(CAST_T[ab.id] || (G.newFx && ab.castT));
    if (ct) { this.abCast = { t: 0, dur: ct * (G.newFx && isSpell ? Skills.castK(this.h) : 1), i, name: ab.name, spell: isSpell }; if (isSpell) { if (G.newFx) S.castRise(this.abCast.dur, this.castCol()); else S.charge && S.charge(this.W && this.W.element || 'arcane'); } return; }
    }
    const w = this.weapon, base = w ? weaponDamage(this.h, w) : 10 + this.h.level * 3;
    this._abFireId = ab.id; this._abFireT = G.time; /* (it goes off now: the hero model plays this ability's own recording, if it has one) */
    const rk = this.h.level >= RANK2_LEVEL ? 1.5 : 1;
    const up = (G.abilScale ? G.abilScale(this.h.level) : 1) * (this.pk('a_' + ab.id) ? 1.5 : 1) * Game.perkPow(Game.perkLvl(this.h, ab.id)); // (arena perks)
    const f = this.fwd();
    // Kingdom Battles: support abilities also reach allied troops and players nearby
    if (G.hooks.allyFx && ALLY_FX[ab.id]) { const fx = ALLY_FX[ab.id].slice(); fx[1] = (fx[1] || 0) * this.hk(); G.hooks.allyFx(this.pos, fx, up); }
    if (SUPPORT[ab.id]) this.buffFx(ab.name, SUPPORT[ab.id]); // the original classes' buffs and heals announce themselves too
    if (this.h.arena) abilityFx(this, ab, this.aimFoe ? this.aimFoe(8) : null); // (each class's own look for its abilities)
    if (this.h.arena && ab.t === 'wraps') { this.addRegen(0.3, 5); this.buffs.swind = Math.max(this.buffs.swind || 0, 5); this.buffs.focus = Math.max(this.buffs.focus || 0, 5); S.heal && S.heal(); const db = this.db || {}; const freed = ['stun', 'slow', 'root'].some(k => db[k] && db[k].t > 0) || this.ultSlowT > G.time; for (const k of ['stun', 'slow', 'root']) if (db[k]) db[k].t = 0; this.ultSlowT = 0; if (freed) { V.number(this.pos.clone().setY(this.pos.y + this.eye + 0.3), 'BROKE FREE', 'crit'); V.ring(this.pos.clone().setY(this.pos.y + 0.1), 3, '#ffd890', 0.4); V.burst('gold', this.pos.clone().setY(this.pos.y + 1), 30, { speed: 4 }); } return; } // (Tighten the Wraps: heal over time, a burst of speed, and it shakes off stuns and snares) // (Tighten the Wraps: heal over time and a burst of speed)
    if (this.h.arena && ab.t === 'totem' && G.hooks.shamanTotem) { G.hooks.shamanTotem(this, groundPoint(25)); return; } // (a healing totem thrown where you aim)
    if (this.h.arena && ab.t === 'mend' && G.hooks.healerMend) { if (this.h.cls === 'bard') { this.atk = { name: 'strum', t: 0, dur: 0.5, hit: true, noQueue: true }; S.cast && S.cast('holy', this.pos, 0.5); } /* (the bard plays the chord) */ G.hooks.healerMend(this, (G.hooks.aimAlly && G.hooks.aimAlly(this, 45)) || this, ab); return; } // (healers' right click: a direct heal, walls or no walls)
    if (this.h.arena && this.h.cls === 'necromancer' && ab.id === 'drainlife') { this.soulRend(ab, base, up, key); return; }
    if (ab.regen) { this.addRegen(ab.regen[0], ab.regen[1]); V.burst('heal', this.pos.clone().setY(this.pos.y + 1.1), 18, { speed: 2, vy: 2 }); }
    { const ext = 1 + 0.15 * Game.perkLvl(this.h, ab.id, 'ext'); this._extK = ext; } /* (the tree's Reach: wider areas this cast) */
    const abR = this._extK > 1 ? Object.assign({}, ab, ...['dur', 'stun', 'slow', 'root', 'r', 'range', 'aoe'].filter(k => typeof ab[k] === 'number').map(k => ({ [k]: ab[k] * this._extK }))) : ab; /* (and longer effects) */
    if (!(G.battleFx && (ab.kit ? this.runKit(abR, base, up, f) : this.classGear(ab.id, base, up, f)))) switch (ab.id) {
      case 'ar_plaguebreath': this.plagueBreath(ab, base, up); break;
      case 'ar_assassinate': { const tg = this.ultFoe(30); if (!tg || !G.hooks.rogueStrike) { this.h.ultRefund = true; G.hooks.toast && G.hooks.toast('Aim at an enemy to assassinate', '🗡', 'bad'); S.error(); break; } const tier = this.assnUntil > G.time ? (this.assnTier || 0.75) : 0.75; const killed = G.hooks.rogueStrike(this, tg, tier); /* (the owner: each kill recharges the ultimate at the next tier (75%, 50%, 25%) and gives another 4 s to use it) */
        if (killed && tier > 0.26) { this.h.ultRefund = true; this.assnTier = tier - 0.25; this.assnUntil = G.time + 4; G.hooks.toast && G.hooks.toast(`Assassinate ready again: ${Math.round(this.assnTier * 100)}% for 4 s`, '🗡', 'gold'); } else { this.assnTier = 0.75; this.assnUntil = this.h.ultRefund ? this.assnUntil : 0; } break; }
      case 'ar_miracle': { if (!G.hooks.arenaMiracle) break; G.hooks.arenaMiracle(this, (G.hooks.aimAlly && G.hooks.aimAlly(this, 45)) || this); break; } // (the ally you aim at, or yourself)
      case 'ar_banner': case 'ar_grasp': case 'ar_finale': case 'ar_kegs': case 'ar_meteors': case 'ar_charm': case 'ar_pack': case 'ar_salvation': case 'ar_bertha': { const r2 = G.hooks.tableUlt && G.hooks.tableUlt(this, ab, this.ultPoint(32), this.ultFoe(30)); if (r2 === 'noaim') { this.h.ultRefund = true; S.error(); } break; } // (the rest of the ultimates)
      case 'ar_barrage': { if (G.hooks.arenaBarrage) G.hooks.arenaBarrage(this); this.barrageCd = 0.6; break; } // (a magic ball down the barrel: full-auto for 10 s)
      case 'ar_transcend': { if (G.hooks.arenaTranscend) G.hooks.arenaTranscend(this); break; } // (pure energy: faster cooldowns, more damage)
      case 'ar_spirittotem': { if (!G.hooks.arenaSpirit) break; G.hooks.arenaSpirit(this, this.ultPoint(20)); break; }
      case 'ar_overgrowth': { if (!G.hooks.arenaOvergrowth) break; G.hooks.arenaOvergrowth(this); break; }
      case 'ar_arrowrain': { if (!G.hooks.arenaRain) break; G.hooks.arenaRain(this, this.ultPoint(40)); break; } // (the storm comes down where you aim)
      case 'ar_bladestorm': { if (!G.hooks.arenaStorm) break; G.hooks.arenaStorm(this); break; } // (you steer the whirlwind)
      case 'ar_fists': { if (!G.hooks.arenaFists) break; G.hooks.arenaFists(this); break; } // (the whirlwind of fists, centred on you)
      case 'ar_wrath': { if (!G.hooks.arenaWrath) break; { const fw = this.aimDir ? this.aimDir(this.pos.clone().setY(this.pos.y + 1.5)) : null; if (fw && Math.hypot(fw.x, fw.z) > 0.05) this.yaw = Math.atan2(fw.x, fw.z); } G.hooks.arenaWrath(this); break; } // (Dawnbreaker: the fissure tears out the way he faces)
      case 'ar_demon': { if (!G.hooks.arenaDemon) break; const gp = this.ultPoint(24); /* (on the enemy you aim at, not the fence behind them) */ G.hooks.arenaDemon(this, gp); this.headUpT = 1.2; S.demon && S.demon(this.pos, 1.8); break; } // (the owner: the demon ultimate is back: it rises in a ring of green hellfire where you aim)
      case 'ar_mendsong': { // Song of Mending: heals around the bard, notes on everyone it touches, no circles
        this.addRegen(ab.self || 0.3, ab.dur || 6); playNotes(G.scene, this, '#ffd860', 9); if (G.hooks.allyFx) G.hooks.allyFx(this.pos, [ab.r || 10, ab.ally || 0.25, null, 0], 1, 'notes');
        S.cast('holy', this.pos, 0.6); S.heal && S.heal(); this.atk = { name: 'castRel', t: 0.15, dur: 0.5, hit: true, noQueue: true }; break; }
      case 'charge': {
        // a beat to brace, then a hard, accelerating rush that bowls through everything
        const dur = 0.85 * (1 + this.pk('a1up') * 0.2); S.chargeRush(dur); // (a heavy run you can see coming, not a teleport)
        this.dodge = { t: -0.3, dur, dir: f.clone(), speed: 18, charge: true, rush: true, hitSet: new Set(), dmg: base * 1.3 * rk * up }; this.fovKick = 4; this.landDip = Math.max(this.landDip || 0, 0.18);
        this.atk = { name: 'heavy', t: 0.3, dur: 0.5, hit: true, noQueue: true };
        break;
      }
      case 'battlecry': {
        S.battleCry(); this.heal(this.maxHp * (0.2 + this.pk('a2up') * 0.1) * this.hk()); this.buffs.cry = 10 + this.pk('a2up') * 5;
        V.ring(this.pos, 8, '#ff5040', 0.6); V.ring(this.pos, 5, '#ffc040', 0.5); V.burst('ember', this.pos.clone().setY(this.pos.y + 1), 50, { speed: 6 }); V.addShake(0.3);
        for (const m of mobsInRadius(this.pos, 8)) m.status.stun = Math.max(m.status.stun, 1.2 * rk);
        break;
      }
      case 'earthsplitter': {
        const tgt = groundPoint(18), ld = Math.hypot(tgt.x - this.pos.x, tgt.z - this.pos.z), dur = Math.max(0.65, Math.min(1.05, 0.55 + ld * 0.021)); /* (he lands where you aim, up to 18 m (the owner: 14 m came up short, 24 m went too far); a longer leap takes a little longer) */
        this.leap = { t: 0, dur, from: this.pos.clone(), to: tgt, dmg: base * 2.6 * rk * up, r: 7 * (1 + this.pk('a3up') * 0.3), hgt: 3.6 + ld * 0.1 };
        this.atk = { name: 'heavy', t: 0, dur: dur + 0.15, hit: true, noQueue: true };
        S.heavySwing(this.pos); S.jump();
        break;
      }
      case 'spectral': {
        const from = this.handPos(true), dir = this.aimDir(from);
        spawnProjectile({ pos: from, vel: dir.multiplyScalar(85), grav: 0, radius: 0.35, dmg: base * 2.6 * rk * up, owner: 'player', kind: 'spectral', life: 1.4, pierce: true });
        S.bowShot(this.pos); S.cast('holy', this.pos); V.burst('green', from, 20, { speed: 3 });
        this.atk = { name: W2kind(this.W) === 'bow' ? 'shoot' : 'spell', t: 0.4, dur: 0.4, hit: true };
        break;
      }
      case 'smokeroll': {
        this.dodge = { t: 0, dur: 0.45, dir: f.clone().multiplyScalar(-1), speed: 13 }; this.iframes = 0.5; this.stealth = 4 * (rk > 1 ? 1.5 : 1) + this.pk('a2up') * 3; this.buffs.nextCrit = true;
        V.burst('shadow', this.pos.clone().setY(this.pos.y + 1), 50, { speed: 4, size: 1.6, life: 1.6, vy: 1, grav: 0, a0: 0.8 }); S.stealth();
        for (const m of G.mobs) if (!m.dead && m.state === 'chase' && m.pos.distanceTo(this.pos) > 3) { m.state = 'return'; }
        break;
      }
      case 'fury': {
        this.buffs.fury = 10 * rk + this.pk('a3up') * 5; S.growl('wolf', null, 1.4); S.battleCry();
        V.burst('green', this.pos.clone().setY(this.pos.y + 1), 40, { speed: 5 }); V.ring(this.pos, 4, '#60ff90', 0.5);
        break;
      }
      case 'kick': { // a front kick: the leg snaps out (a boot in first person), the enemy goes flying
        this.atk = { name: 'kick', t: 0, dur: 0.5, hit: true, noQueue: true }; this.kickFx(); S.kick(this.pos, false);
        setTimeout(() => { if (this.dead) return; const t = mobsInCone(this.pos, this.yaw, 2.8, 0.7).sort((a2, b2) => a2.dist2(this.pos) - b2.dist2(this.pos))[0]; const fw = this.fwd();
          if (t) { const p = t.pos.clone().setY(t.pos.y + 1); this.dealDamage(t, base * 1.2 * up, { stun: 1.5, knock: fw.clone().multiplyScalar(t.def && t.def.boss ? 6 : 17 * (up > 1 ? 1.3 : 1)).setY(4), big: true, melee: true, blunt: true });
            S.kick(t.pos, true); V.burst('dust', p, 24, { speed: 5, dir: fw, size: 0.8 }); V.burst('spark', p, 10, { speed: 5 }); V.sphereFlash(p, 1, '#fff0d0', 0.18); V.ring(t.pos, 2, '#ffe0b0', 0.3); G.hitstop = 0.06; V.addShake(0.35); this.fovKick = 6; V.number(p.clone().setY(p.y + t.height * 0.6 + 0.4), 'Kicked!', 'crit'); }
          else V.addShake(0.08); }, 150 * ABIL_DELAY_K());
        break;
      }
      case 'bash': {
        this.atk = { name: 'smash', t: 0.35, dur: 0.6, hit: true, noQueue: true }; S.block(true, this.pos);
        setTimeout(() => { if (this.dead) return; let n = 0; for (const m of mobsInCone(this.pos, this.yaw, 3.4, 0.9)) { n++; this.dealDamage(m, base * 1.4, { stun: 2, knock: m.pos.clone().sub(this.pos).setY(0).normalize().multiplyScalar(9), big: true, melee: true, blunt: true }); S.blunt(m.pos); } const p = this.pos.clone().addScaledVector(this.fwd(), 2); V.ring(p, 2.5, '#c8d8ff', 0.35); V.burst('spark', p.setY(p.y + 1), 16, { speed: 5 }); V.addShake(n ? 0.35 : 0.1); }, 140 * ABIL_DELAY_K());
        break;
      }
      case 'shieldwall': { const dur = 6 * up; this.buffs.wall = dur; S.shieldWall(); this.atk = { name: 'smash', t: 0.55, dur: 0.35, hit: true, noQueue: true };
        V.sphereFlash(this.pos.clone().setY(this.pos.y + 1), 2.2, '#a8c8ff', 0.5); V.ring(this.pos, 3.5, '#a8c8ff', 0.6); V.burst('frost', this.pos.clone().setY(this.pos.y + 1), 30, { speed: 4 }); V.addShake(0.2);
        this.domeFx(dur, '#8ab8ff'); G.hooks.toast && G.hooks.toast('Shield Wall: 60% less damage for ' + Math.round(dur) + ' s', '🛡', 'gold'); break; }
      case 'laststand': { this.addRegen(0.3, 10); this.buffs.stand = 10; S.battleCry(); S.heartbeat(); S.heal();
        const p = this.pos.clone(); V.burst('gold', p.clone().setY(p.y + 1), 60, { speed: 5, vy: 4 }); V.burst('blood', p.clone().setY(p.y + 1), 20, { speed: 3 }); V.ring(p, 5, '#ffd080', 0.7); V.ring(p, 3, '#ff6a4a', 0.5); V.sphereFlash(p.clone().setY(p.y + 1), 2.4, '#ffc060', 0.5); V.light(p.clone().setY(p.y + 2), '#ffc060', 8, 0.8); V.addShake(0.3); this.fovKick = 8;
        this.pillarFx('#ffc860'); this.domeFx(10, '#ffb040', 0.07); break; }
      case 'execute': { // weapon raised high and glowing, a beat, then a crushing overhead blow; a kill rings like a bell
        this.atk = { name: 'smash', t: 0, dur: 0.8, hit: true, noQueue: true }; S.executeWind(); this.fovKick = 3;
        { const hp = this.handPos(false); V.light(hp, '#ff4020', 6, 0.5); V.burst('ember', hp, 16, { speed: 1.5, vy: 1 }); }
        setTimeout(() => { if (this.dead) return; const fw = this.fwd(); const t = mobsInCone(this.pos, this.yaw, (this.W ? this.W.reach : 2.5) + 0.8, 0.6).sort((a2, b2) => a2.dist2(this.pos) - b2.dist2(this.pos))[0];
          const at = t ? t.pos.clone() : this.pos.clone().addScaledVector(fw, 2.2); at.y = heightAt(at.x, at.z);
          abilityArc(at.clone().setY(at.y + 1.1).addScaledVector(fw, -0.6), this.yaw, 1.9, '#ff5030', Math.PI, true);
          V.ring(at, 3.2, '#ff3018', 0.5); V.burst('stone', at.clone().setY(at.y + 0.2), 22, { speed: 6, grav: 14, size: 0.28 }); V.burst('dust', at.clone().setY(at.y + 0.2), 26, { speed: 5, size: 1 }); V.addShake(0.6); G.hitstop = 0.12; this.fovKick = 10;
          if (t) { const low = t.hp < t.maxHp * 0.35; this.dealDamage(t, base * 2.6 * up * (low ? 3 : 1), { big: true, melee: true, critBonus: low ? 0.5 : 0, knock: fw.clone().multiplyScalar(6) }); const p = t.pos.clone().setY(t.pos.y + 1.1);
            V.burst('blood', p, low ? 60 : 30, { speed: 6 }); V.sphereFlash(p, low ? 2 : 1.2, '#ff2010', 0.3); V.light(p, '#ff3010', 10, 0.4);
            if (t.dead) { S.executeHit(t.pos, true); V.number(p.clone().setY(p.y + t.height * 0.6 + 0.6), 'EXECUTED', 'crit'); this.buffFx('Executed', '#ff3020'); G.hitstop = 0.2; } else { S.executeHit(t.pos, false); if (low) V.number(p.clone().setY(p.y + t.height * 0.6 + 0.6), 'Execute!', 'crit'); } }
          else S.executeHit(at, false); }, 430 * ABIL_DELAY_K());
        break;
      }
      case 'intimshout': {
        S.battleCry(); S.roar(this.pos); V.ring(this.pos, 9, '#ff6a3a', 0.6); V.ring(this.pos, 6, '#ffb060', 0.5); V.addShake(0.4);
        for (const m of mobsInRadius(this.pos, 9)) { m.status.stun = Math.max(m.status.stun, m.def.boss ? 0.8 : 2.5); V.number(m.pos.clone().setY(m.pos.y + m.height + 0.6), 'Feared!', 'bad'); }
        break;
      }
      case 'bloodrage': { this.buffs.rage = 10; this.buffs.tq = Math.max(this.buffs.tq || 0, 10); S.roar(this.pos); S.battleCry(); V.burst('blood', this.pos.clone().setY(this.pos.y + 1), 50, { speed: 5 }); V.ring(this.pos, 4, '#c01818', 0.5); this.fovKick = 8; break; }
      case 'cleavestrike': { this.atk = { name: 'sweep', t: 0.05, dur: 0.55, hit: true, noQueue: true }; S.cleave(this.pos); S.swingW(this.swingKind('swing3'), 1.6, this.pos);
        setTimeout(() => { if (this.dead) return; const R = 4 * (up > 1 ? 1.3 : 1); abilityArc(this.pos.clone().setY(this.pos.y + 1.05), this.yaw, R, '#fff0c0', Math.PI * 1.15, false); let n = 0;
          for (const m of mobsInCone(this.pos, this.yaw, R, 1.5)) { n++; this.dealDamage(m, base * 1.8 * up, { big: true, melee: true, knock: m.pos.clone().sub(this.pos).setY(0).normalize().multiplyScalar(7) }); V.burst('spark', m.pos.clone().setY(m.pos.y + 1), 12, { speed: 5 }); V.burst('blood', m.pos.clone().setY(m.pos.y + 1), 10, { speed: 4 }); }
          V.addShake(n ? 0.35 : 0.15); if (n) { G.hitstop = 0.05; this.fovKick = 5; } }, 150 * ABIL_DELAY_K()); break; }
      case 'shieldthrow': {
        const from = this.handPos(true), dir = this.aimDir(from), bounces = 2 + (up > 1 ? 2 : 0);
        spawnProjectile({ pos: from, vel: dir.multiplyScalar(34), grav: 2, radius: 0.5, dmg: base * 1.4 * up, owner: 'player', kind: 'axe', life: 1.5, onHit: (p, m, pos) => { if (!m) return; const hit = new Set([m]); let cur = m; this.dealDamage(m, p.dmg, { stun: 1.5, blunt: true }); S.blunt(m.pos); for (let k = 0; k < bounces; k++) { const nx = G.mobs.filter(o => !o.dead && !hit.has(o) && o.pos.distanceTo(cur.pos) < 10).sort((x, y) => x.pos.distanceTo(cur.pos) - y.pos.distanceTo(cur.pos))[0]; if (!nx) break; hit.add(nx); V.burst('spark', nx.pos.clone().setY(nx.pos.y + 1), 10, { speed: 4 }); this.dealDamage(nx, p.dmg * 0.8, { stun: 1.2, blunt: true }); S.blunt(nx.pos); cur = nx; } } });
        S.swingW('blunt', 1.4, this.pos); this.atk = { name: 'swing2', t: 0.3, dur: 0.45, hit: true }; break;
      }
      case 'fortify': { this.buffs.fort = 12 * up; S.block(true, this.pos); V.ring(this.pos, 3, '#c8d8ff', 0.5); V.sphereFlash(this.pos.clone().setY(this.pos.y + 1), 1.6, '#9ab8ff', 0.5); break; }
      case 'hamstring': { // drop low and slash across the back of the legs: a red streak at knee height, blood, then they limp
        this.atk = { name: 'lowcut', t: 0.15, dur: 0.45, hit: true, noQueue: true }; this.landDip = Math.max(this.landDip || 0, 0.35); S.swingW(this.swingKind('swing2'), 1.1, this.pos);
        setTimeout(() => { if (this.dead) return; const t = mobsInCone(this.pos, this.yaw, (this.W ? this.W.reach : 2.5) + 0.6, 0.75).sort((x, y) => x.dist2(this.pos) - y.dist2(this.pos))[0];
          abilityArc(this.pos.clone().setY(this.pos.y + 0.45), this.yaw, 2.6, '#ff3030', Math.PI * 0.8, false, 0.25);
          if (!t) return; S.hamstring(t.pos); const bl = base * 0.3 * (this.pk('a_hamstring') ? 1.5 : 1); this.dealDamage(t, base * 1.3 * up, { slow: 6, bleed: bl, melee: true });
          const knee = t.pos.clone().setY(t.pos.y + 0.5); V.burst('blood', knee, 34, { speed: 5, dir: this.right() }); V.sphereFlash(knee, 0.8, '#ff2020', 0.2); G.hitstop = 0.05; V.addShake(0.2);
          V.number(t.pos.clone().setY(t.pos.y + t.height + 0.6), 'Crippled!', 'bad');
          let k = 0; const iv = setInterval(() => { if (t.dead || ++k > 15) { clearInterval(iv); return; } V.burst('blood', t.pos.clone().setY(t.pos.y + 0.4), 3, { speed: 1 }); V.ring(t.pos, 0.9, '#c01818', 0.35); }, 400);
        }, 120 * ABIL_DELAY_K()); break; }
      case 'warbanner': case 'vigorbanner': case 'stonebanner': { // drive the pole into the ground with a slam; the flag rises and snaps open
        const kind = ab.id === 'warbanner' ? 'war' : ab.id === 'vigorbanner' ? 'vigor' : 'stone', sb = this.pk('a_warbanner');
        this.atk = { name: 'smash', t: 0.55, dur: 0.3, hit: true, noQueue: true };
        { const R = sb ? 25 : 15, at = groundPoint(R); plantBanner(kind, at, this.yaw, 15 * (sb ? 1.5 : 1), R); S.bannerPlant(kind); /* you can plant it as far away as it reaches */
          if (this.pk('rallying')) { this.addRegen(0.1, 6); V.burst('heal', this.pos.clone().setY(this.pos.y + 1), 20, { speed: 2, vy: 2 }); }
          /* Warlord's Command makes every banner's effect 50% stronger (see bWar / bVigor / bStone) */ }
        break; }
      case 'bulwark': { this.atk = { name: 'smash', t: 0.3, dur: 0.6, hit: true, noQueue: true }; setTimeout(() => { if (this.dead) return; const p = this.pos.clone(); areaDamage(p, 6, base * 1.5, { knock: 12, stun: 2, big: true, melee: true, blunt: true }); V.ring(p, 6, '#c8d8ff', 0.5); V.burst('stone', p, 40, { speed: 8, size: 0.3, grav: 14 }); V.burst('dust', p, 30, { speed: 6, size: 1.2 }); S.blunt(p); S.rumble(p, 0.8); V.addShake(0.5); }, 230 * ABIL_DELAY_K()); break; }
      case 'whirlwind': this.atk = { name: 'fury', t: 0, dur: 2 * (up > 1 ? 1.4 : 1), hits: up > 1 ? 12 : 9, rank: 6, hit: true, noQueue: true, base: base * up }; S.swingW(this.swingKind('area'), 1.6, this.pos); break;
      case 'rampage': this.buffs.rampage = 8 * up; S.roar(this.pos); V.burst('ember', this.pos.clone().setY(this.pos.y + 1), 40, { speed: 5 }); break;
      case 'groundslam': { const from = this.pos.clone(); from.y += 0.6; spawnProjectile({ pos: from, vel: f.clone().multiplyScalar(26), grav: 0, radius: 1.8, dmg: base * 2.2 * up, owner: 'player', kind: 'wave', life: 0.85, pierce: true }); this.atk = { name: 'smash', t: 0.4, dur: 0.6, hit: true, noQueue: true }; S.rumble(this.pos, 0.8); V.burst('stone', this.pos, 20, { speed: 6, grav: 14, size: 0.3 }); V.addShake(0.4); break; }
      case 'warstomp': { const p = this.pos.clone(); for (const m of mobsInRadius(p, 5)) { this.dealDamage(m, base * 0.8, { stun: 2, melee: true, blunt: true }); } V.ring(p, 5, '#ffd080', 0.45); V.burst('dust', p, 30, { speed: 5, size: 1.1 }); S.rumble(p, 0.6); S.blunt(p); V.addShake(0.45); break; }
      case 'undying': this.buffs.undying = 6; S.roar(this.pos); S.battleCry(); V.burst('blood', this.pos.clone().setY(this.pos.y + 1), 40, { speed: 4 }); V.sphereFlash(this.pos.clone().setY(this.pos.y + 1), 2, '#ff3020', 0.5); G.hooks.toast && G.hooks.toast('Undying Rage: you cannot fall for 6 s', '🩸', 'gold'); break;
      case 'mending': this.regen = { per: this.maxHp * 0.25 * up * (G.battleFx ? this.hk() * 1.4 : 1) / 6, t: 6 }; S.heal(); V.burst('heal', this.pos.clone().setY(this.pos.y + 1), 40, { speed: 2, vy: 2 }); V.ring(this.pos, 2.5, '#80ff90', 0.6); break;
      case 'disengage': { for (const m of mobsInRadius(this.pos, 5)) m.status.slow = Math.max(m.status.slow, 4); this.dodge = { t: 0, dur: 0.45, dir: f.clone().multiplyScalar(-1), speed: 18 }; this.iframes = 0.5; this.vel.y = 6; this.onGround = false; S.dodge(); V.burst('green', this.pos.clone().setY(this.pos.y + 0.5), 25, { speed: 3 }); break; }
      case 'focus': this.buffs.focus = 8; S.cast('holy', this.pos); V.burst('green', this.pos.clone().setY(this.pos.y + 1), 30, { speed: 3 }); break;
      case 'barkskin': this.buffs.barrier = this.maxHp * 0.2 * up; this.buffs.barrierT = 10; S.chop(this.pos); V.burst('wood', this.pos.clone().setY(this.pos.y + 1), 40, { speed: 3, radius: 1 }); V.sphereFlash(this.pos.clone().setY(this.pos.y + 1), 1.5, '#8a6a3a', 0.5); break;
      case 'vanish': this.stealth = 5 * up; this.buffs.nextCrit = true; S.stealth(); V.burst('shadow', this.pos.clone().setY(this.pos.y + 1), 40, { speed: 3, size: 1.4, life: 1.4, grav: 0, a0: 0.8 }); for (const m of G.mobs) if (!m.dead && m.state === 'chase' && m.pos.distanceTo(this.pos) < 30) m.loseTrack ? m.loseTrack() : (m.state = 'return'); break;
      case 'snaretrap': case 'explotrap': { const fire = ab.id === 'explotrap'; this.placeTrap(this.pos.clone(), fire, base * (fire ? 2.4 : 1.0) * up, up); S.chop(this.pos); break; }
      case 'pinning': { const from = this.handPos(true), dir = this.aimDir(from); spawnProjectile({ pos: from, vel: dir.multiplyScalar(70), grav: 3, radius: 0.3, dmg: base * 1.3, owner: 'player', kind: 'spectral', life: 1.5, onHit: (p, m) => { if (m) { this.dealDamage(m, p.dmg, { stun: 2.5 }); V.number(m.pos.clone().setY(m.pos.y + m.height + 0.6), 'Pinned!', 'bad'); } } }); S.bowShot(this.pos); this.atk = { name: 'shoot', t: 0.4, dur: 0.4, hit: true }; break; }
      case 'barrage': { const n = 10 + (up > 1 ? 5 : 0); for (let k = 0; k < n; k++) setTimeout(() => { if (this.dead) return; const from = this.handPos(true), dir = this.aimDir(from); dir.x += (Math.random() - 0.5) * 0.06; dir.y += (Math.random() - 0.5) * 0.04; spawnProjectile({ pos: from, vel: dir.normalize().multiplyScalar(60), grav: 6, radius: 0.2, dmg: base * 0.6, owner: 'player', kind: 'arrow', life: 3 }); S.bowShot(this.pos); }, k * 90); this.atk = { name: 'shoot', t: 0, dur: n * 0.09, hit: true }; break; }
      case 'firering': { const p0 = this.pos; let k = 0; V.ring(this.pos, 6, '#ff7030', 0.6); S.cast('fire', this.pos, 1.6); const iv = setInterval(() => { k++; if (this.dead || k > 10) { clearInterval(iv); return; } for (const m of mobsInRadius(this.pos, 6)) this.dealDamage(m, base * 0.35 * up, { el: 'fire', burn: base * 0.05, silent: k % 2 === 0 }); for (let j = 0; j < 24; j++) { const a2 = j / 24 * Math.PI * 2; V.emit('fire', new THREE.Vector3(this.pos.x + Math.cos(a2) * 6, this.pos.y + 0.3, this.pos.z + Math.sin(a2) * 6), { speed: 1, vy: 2, size: 0.6, life: 0.6 }); } }, 500 * ABIL_DELAY_K()); break; }
      case 'missiles': { for (let k = 0; k < this.qty(3, 5); k++) setTimeout(() => { if (this.dead) return; const from = this.handPos(), dir = this.aimDir(from); dir.x += (Math.random() - 0.5) * 0.5; dir.y += 0.2; spawnProjectile({ pos: from, vel: dir.normalize().multiplyScalar(26), grav: 0, radius: 0.3, dmg: base * 0.9, owner: 'player', kind: 'arcane', life: 2.5, homing: true, onHit: (p, m, pos) => { if (m) this.dealDamage(m, p.dmg, { el: 'arcane' }); V.burst('arcane', pos, 14, { speed: 3 }); } }); S.cast('arcane', from, 0.6); }, k * 120); this.atk = { name: 'cast', t: 0, dur: 0.7, hit: true }; break; }
      case 'timewarp': { for (const m of mobsInRadius(this.pos, 12)) { m.status.slow = Math.max(m.status.slow, 6); m.atkCd += 2; } V.ring(this.pos, 12, '#c0a0ff', 0.9); V.sphereFlash(this.pos.clone().setY(this.pos.y + 1), 4, '#a080ff', 0.6); S.cast('arcane', this.pos, 2); break; }
      case 'lightstorm': { const c = groundPoint(30), n = G.battleFx ? this.qty(5, 5) : 8 + (up > 1 ? 4 : 0); for (let k = 0; k < n; k++) setTimeout(() => { if (this.dead) return; const near = mobsInRadius(c, 10); const m = near[Math.floor(Math.random() * near.length)]; const p = m ? m.pos.clone() : c.clone().add(new THREE.Vector3((Math.random() - 0.5) * 12, 0, (Math.random() - 0.5) * 12)); p.y = heightAt(p.x, p.z); lightning(p.clone().add(new THREE.Vector3(0, 25, 0)), p.clone().setY(p.y + 0.5)); V.light(p.clone().setY(p.y + 2), '#a0c0ff', 6, 0.2, 18); S.cast('lightning', p, 0.8); for (const mm of mobsInRadius(p, 2.5)) this.dealDamage(mm, base * 1.1, { el: 'lightning', stun: 0.3 }); }, 300 + k * 220); this.atk = { name: 'castBig', t: 0, dur: 0.8, hit: true }; break; }
      // ---- Kingdom Battles abilities ----
      case 'rally': { if (BATTLE) { this.heal(this.maxHp * 0.15 * up * this.hk()); G.hooks.rally && G.hooks.rally(this.pos, 14 * up); S.battleCry(); V.ring(this.pos, 14 * up, '#ffd84a', 0.8); V.burst('gold', this.pos.clone().setY(this.pos.y + 2), 50, { speed: 5, vy: 3 }); V.sphereFlash(this.pos.clone().setY(this.pos.y + 1), 3, '#ffe080', 0.5); this.atk = { name: 'cheer', t: 0, dur: 0.7, hit: true, noQueue: true }; break; }
        { const R = this.pk('a_warbanner') ? 25 : 15, at = groundPoint(R); plantBanner('rally', at, this.yaw, 12, R); S.bannerPlant('war'); this.atk = { name: 'smash', t: 0.55, dur: 0.3, hit: true, noQueue: true }; } this.addRegen(0.15 * up, 8); G.hooks.rally && G.hooks.rally(this.pos, this.pk('a_warbanner') ? 25 : 15); S.battleCry(); V.burst('gold', this.pos.clone().setY(this.pos.y + 2), 30, { speed: 4, vy: 3 }); break; }
      case 'seismic': { const R = 10 * Math.sqrt(up); for (const m of mobsInCone(this.pos, this.yaw, R, 0.75)) this.dealDamage(m, base * 2.4 * up, { slow: 3, blunt: true, knock: m.pos.clone().sub(this.pos).setY(0).normalize().multiplyScalar(9) }); for (let k = 1; k <= 6; k++) { const d = k * R / 6; for (const s2 of [-0.6, -0.3, 0, 0.3, 0.6]) { const q = this.pos.clone(); q.x += Math.sin(this.yaw + s2) * d; q.z += Math.cos(this.yaw + s2) * d; q.y = heightAt(q.x, q.z); setTimeout(() => V.burst('stone', q, 5, { speed: 5, grav: 14, size: 0.35 }), k * 40); } } S.rumble(this.pos, 0.8); S.blunt(this.pos); V.addShake(0.6); G.hitstop = 0.06; this.atk = { name: 'smash', t: 0.35, dur: 0.6, hit: true, noQueue: true }; break; }
      case 'bladestorm': { let k = 0; const R = 4.5 * Math.sqrt(up); S.swingW('blade', 1.5, this.pos); this.buffs.storm = 2.4; const iv = setInterval(() => { k++; if (this.dead || k > 8) { clearInterval(iv); return; } for (const m of mobsInRadius(this.pos, R)) this.dealDamage(m, base * 0.6 * up, { melee: true, silent: k % 2 === 0 }); V.ring(this.pos, R, '#e8f0ff', 0.25); V.burst('spark', this.pos.clone().setY(this.pos.y + 1), 10, { speed: 6 }); S.swingW('blade', 1, this.pos); this.atk = { name: 'spin', t: 0, dur: 0.3, hit: true, noQueue: true }; }, 300); break; }
      case 'hurlaxe': { // a big spinning axe that tears straight through everything in its path, leaving a red streak
        const from = this.handPos(), dir = this.aimDir(from);
        const pr = spawnProjectile({ pos: from, vel: dir.multiplyScalar(40), grav: 1.2, radius: 1.0, dmg: base * 2.2 * up, owner: 'player', kind: 'axe', life: 1.3, pierce: true, onHit: (p, m) => { if (m) { this.dealDamage(m, p.dmg, { bleed: base * 0.12 * up }); V.burst('blood', m.pos.clone().setY(m.pos.y + 1.1), 22, { speed: 5, dir: p.vel.clone().normalize() }); V.burst('spark', m.pos.clone().setY(m.pos.y + 1.1), 10, { speed: 5 }); G.hitstop = Math.max(G.hitstop || 0, 0.04); V.addShake(0.15); S.hit && S.hit('flesh', m.pos, 1.3); } } });
        if (pr && pr.mesh) { pr.mesh.scale.setScalar(2.4); pr.mesh.traverse(o => { if (o.isMesh && o.material && o.material.color && o.material.metalness > 0.5) { o.material = o.material.clone(); o.material.emissive = new THREE.Color('#ff5030'); o.material.emissiveIntensity = 0.5; } }); }
        const tr = V.trail('#ff4a2a'); const iv = setInterval(() => { if (!pr || pr.dead || pr.t > pr.life || !G.projectiles.includes(pr)) { clearInterval(iv); tr.active = false; setTimeout(() => { const i = V.trails.indexOf(tr); if (i >= 0) V.trails.splice(i, 1); if (tr.mesh) { tr.mesh.parent && tr.mesh.parent.remove(tr.mesh); tr.mesh.geometry && tr.mesh.geometry.dispose(); } }, 700); return; } const q = pr.pos.clone(); tr.active = true; tr.push(q.clone().setY(q.y - 0.35), q.clone().setY(q.y + 0.35)); V.emit('ember', q, { speed: 0.6, size: 0.35, life: 0.45 }); }, 16);
        S.swingW('axe', 1.6, this.pos); S.cleave && S.cleave(this.pos); this.atk = { name: 'swing2', t: 0.25, dur: 0.45, hit: true, noQueue: true }; this.fovKick = Math.max(this.fovKick, 4); break; }
      case 'skullsplitter': { for (const m of mobsInCone(this.pos, this.yaw, 4, 0.7)) { const ex = m.hp / m.maxHp < 0.3 ? 2 : 1; this.dealDamage(m, base * 4 * up * ex, { melee: true, big: true, stun: 0.6 }); V.burst('blood', m.pos.clone().setY(m.pos.y + m.height * 0.7), 25, { speed: 5 }); } S.heavySwing(this.pos); V.addShake(0.5); G.hitstop = 0.08; this.atk = { name: 'smash', t: 0.3, dur: 0.6, hit: true, noQueue: true }; break; }
      case 'frenzy': { this.buffs.fury = 8 * up; this.buffs.leech = 8 * up; S.roar(this.pos); V.burst('blood', this.pos.clone().setY(this.pos.y + 1), 50, { speed: 5 }); V.sphereFlash(this.pos.clone().setY(this.pos.y + 1), 2.5, '#ff2a1a', 0.5); break; }
      case 'arrowrain': { const c = groundPoint(32), R = 7 * Math.sqrt(up); V.ring(c, R, '#a0e070', 3); for (let k = 0; k < 6; k++) setTimeout(() => { if (this.dead) return; for (let j = 0; j < 8; j++) { const q = c.clone().add(new THREE.Vector3((Math.random() - 0.5) * R * 1.6, 0, (Math.random() - 0.5) * R * 1.6)); q.y = heightAt(q.x, q.z) + 0.2; V.burst('spark', q, 3, { speed: 2 }); } S.arrowHit(c); for (const m of mobsInRadius(c, R)) this.dealDamage(m, base * 0.5 * up, { silent: true }); }, 200 + k * 500); S.bowShot(this.pos); this.atk = { name: 'shoot', t: 0.2, dur: 0.5, hit: true, noQueue: true }; break; }
      case 'venomshot': { const from = this.handPos(), dir = this.aimDir(from); spawnProjectile({ flat: 0.5, pos: from, vel: dir.multiplyScalar(60), grav: 3, radius: 0.35, dmg: base * 1.6 * up, owner: 'player', kind: 'arrow', life: 2, onHit: (p, m) => { if (m) { this.dealDamage(m, p.dmg, { bleed: base * 0.18 * up }); m.status.bleed = 8; V.burst('green', m.pos.clone().setY(m.pos.y + m.height * 0.6), 20, { speed: 3 }); } } }); S.bowShot(this.pos); this.atk = { name: 'shoot', t: 0.2, dur: 0.5, hit: true, noQueue: true }; break; }
      case 'wolves': { if (G.hooks.summonWolves) G.hooks.summonWolves(this.pos, this.h.level, 30 * up); S.roar(this.pos); V.burst('shadow', this.pos.clone().setY(this.pos.y + 1), 30, { speed: 3 }); break; }
      case 'sentry': { const at = groundPoint(16); G.hooks.sentry && G.hooks.sentry(at.x, at.z, this.h.level); S.click(); V.burst('frost', at.clone().setY(at.y + 1.5), 20, { speed: 2 }); this.atk = { name: 'cast', t: 0.2, dur: 0.4, hit: true, noQueue: true }; break; }
      case 'spiketrap': { const at = this.pos.clone().add(f.clone().multiplyScalar(2.2)); this.battleTrap(at, 'spike', base * 1.6 * up, up); S.chop && S.chop(at); this.atk = { name: 'gather', t: 0.2, dur: 0.45, hit: true, noQueue: true }; break; }
      case 'frosttrap': { const at = this.pos.clone().add(f.clone().multiplyScalar(2.2)); this.battleTrap(at, 'frost', base * 1.1 * up, up); S.cast('frost', at, 0.8); this.atk = { name: 'gather', t: 0.2, dur: 0.45, hit: true, noQueue: true }; break; }
      // ---- Musketeer ----
      case 'grapeshot': { for (const m of mobsInCone(this.pos, this.yaw, 10 * Math.sqrt(up), 0.55)) this.dealDamage(m, base * 2 * up, { knock: m.pos.clone().sub(this.pos).setY(0).normalize().multiplyScalar(10) }); const from = this.handPos(true); for (let k = 0; k < 9; k++) { const q = this.pos.clone(); const a2 = this.yaw + (Math.random() - 0.5) * 1.1, d = 2 + Math.random() * 8; q.x += Math.sin(a2) * d; q.z += Math.cos(a2) * d; q.y = heightAt(q.x, q.z) + 1; setTimeout(() => V.burst('spark', q, 4, { speed: 3 }), k * 15); } V.burst('smoke', from, 30, { speed: 4, size: 1.6, life: 1.8 }); V.burst('fire', from, 18, { speed: 7 }); S.explode(from, 0.9, 'fire'); V.addShake(0.4); this.fovKick += 6; this.atk = { name: 'release', t: 0, dur: 0.4, hit: true, noQueue: true }; break; }
      case 'smokebomb': { this.stealth = 4 * up; this.buffs.nextCrit = true; for (const m of mobsInRadius(this.pos, 6)) { m.status.slow = Math.max(m.status.slow, 3); if (m.target === this) m.target = null; } V.burst('smoke', this.pos.clone().setY(this.pos.y + 1), 60, { speed: 4, size: 2.2, life: 3 }); S.stealth(); S.explode(this.pos, 0.4); break; }
      case 'powderkeg': {
        // throw the keg in an arc at where you aim: it blows up the moment it lands or hits someone
        const tgt = groundPoint(24), r = 6 * Math.sqrt(up), from = this.handPos(true), T = 0.8, gr = 14;
        const vel = new THREE.Vector3((tgt.x - from.x) / T, (tgt.y + 0.3 - from.y + 0.5 * gr * T * T) / T, (tgt.z - from.z) / T);
        V.ring(tgt, r, '#ff5030', T + 0.2);
        const boom = (at) => { areaDamage(at, r, base * (G.battleFx ? 1.5 : 3) * up, { el: 'fire', burn: base * 0.1, falloff: true, knock: 9 }); V.burst('fire', at.clone().setY(at.y + 0.5), 90, { speed: 11, size: 0.95 }); V.burst('smoke', at.clone().setY(at.y + 1), 45, { speed: 4, size: 2.2, life: 2.2 }); V.burst('wood', at.clone().setY(at.y + 0.6), 20, { speed: 8, size: 0.3, grav: 14 }); V.sphereFlash(at.clone().setY(at.y + 1), r * 0.6, '#ff9040', 0.4); V.light(at.clone().setY(at.y + 2), '#ff8030', 12, 0.5, 30); S.explode(at, 1.8, 'fire'); S.gunshot(at, 1.4); V.addShake(0.6); };
        spawnProjectile({ pos: from, vel, grav: gr, radius: 0.35, dmg: 0, owner: 'player', kind: 'keg', life: 3, aoe: true, onHit: (p, m, pos) => boom((pos || (m && m.pos) || p.pos).clone()) });
        S.swing(1, this.pos); this.atk = { name: 'swing2', t: 0.2, dur: 0.4, hit: true, noQueue: true }; break; }
      case 'quickreload': { this.buffs.reload = 8 * up; S.click(); V.burst('gold', this.pos.clone().setY(this.pos.y + 1.3), 25, { speed: 3 }); break; }
      case 'bayonet': { this.dodge = { t: 0, dur: 0.6 * Math.sqrt(up), dir: f.clone(), speed: 17, charge: true, hitSet: new Set(), dmg: base * 1.8 * up }; this.fovKick = 12; S.battleCry(); break; }
      case 'eagleeye': { this.buffs.eagle = 10 * up; this.buffs.focus = Math.max(this.buffs.focus || 0, 10 * up); V.sphereFlash(this.pos.clone().setY(this.pos.y + 1.6), 1.5, '#ffe080', 0.4); S.cast('arcane', this.pos, 0.6); break; }
      case 'volleyfire': { for (let k = 0; k < 5; k++) setTimeout(() => { if (!this.dead) this.fireGun(0.5, true, 0.85 * up); }, k * 180); break; }
      case 'incendiary': { const from = this.handPos(true), dir = this.aimDir(from); spawnProjectile({ pos: from, vel: dir.multiplyScalar(90), grav: 4, flat: 0.8, radius: 0.2, dmg: base * 2.4 * up, owner: 'player', kind: 'fireball', scale: 0.8, life: 3, onHit: (p, m, pos) => { const at = pos || (m && m.pos) || p.pos; areaDamage(at, 4 * Math.sqrt(up), p.dmg * 0.6, { el: 'fire', burn: base * 0.15 }); if (m) this.dealDamage(m, p.dmg * 0.5, { el: 'fire', burn: base * 0.15 }); V.burst('fire', at, 50, { speed: 6 }); S.explode(at, 1, 'fire'); } }); S.explode(from, 0.5, 'fire'); V.burst('smoke', from, 14, { speed: 2, size: 1.2 }); this.fovKick += 4; break; }
      case 'caltrops': { const R = 6 * Math.sqrt(up), c = this.pos.clone(); for (let k = 0; k < 24; k++) { const a2 = Math.random() * 6.28, d = Math.sqrt(Math.random()) * R; V.burst('spark', new THREE.Vector3(c.x + Math.cos(a2) * d, heightAt(c.x + Math.cos(a2) * d, c.z + Math.sin(a2) * d) + 0.1, c.z + Math.sin(a2) * d), 1, { speed: 0.5 }); } V.ring(c, R, '#9aa0a8', 6); let k = 0; const iv = setInterval(() => { k++; if (k > 12) { clearInterval(iv); return; } for (const m of mobsInRadius(c, R)) { if (m.isStruct) continue; m.status.slow = Math.max(m.status.slow, 1.2); this.dealDamage(m, base * 0.25 * up, { silent: true, bleed: base * 0.04 }); } }, 500); S.mine && S.mine(c); break; }
      case 'cannonade': { const c = groundPoint(36); S.rumble(c, 1.5); for (let k = 0; k < this.qty(3, 3); k++) setTimeout(() => { if (this.dead) return; const q = c.clone().add(new THREE.Vector3((Math.random() - 0.5) * 10, 0, (Math.random() - 0.5) * 10)); q.y = heightAt(q.x, q.z); this.meteorImpact(q, 5, base * (G.battleFx ? 1.0 : 2.4) * up); }, 500 + k * 450); break; }
      case 'pyroblast': { // a huge, slow ball of fire that lands like a falling star: the biggest fire spell there is
        const from = this.handPos(), dir = this.aimDir(from), R = 10.5 * Math.sqrt(up) * this.areaK();
        spawnProjectile({ pos: from, vel: dir.multiplyScalar(22), grav: 1, radius: 1.0, dmg: base * 4.2 * up, owner: 'player', kind: 'fireball', scale: 4.2, life: 3, onHit: (p, m, pos) => { const at = (pos || (m && m.pos) || p.pos).clone(); this.meteorImpact(at, R, p.dmg); V.sphereFlash(at.clone().setY(at.y + 1), R * 0.7, '#ff7020', 0.55); V.burst('fire', at, 120, { speed: 12, size: 1.1 }); V.burst('ember', at, 60, { speed: 9, vy: 8 }); V.light(at.clone().setY(at.y + 3), '#ff7030', 16, 0.7, 40); S.explode(at, 2.4, 'fire'); V.addShake(0.8); } });
        S.cast('fire', this.pos, 2.4); V.burst('fire', from, 30, { speed: 3 }); this.atk = { name: 'castBig', t: 0.2, dur: 0.7, hit: true, noQueue: true }; break; }
      case 'glacial': { const from = this.handPos(), dir = this.aimDir(from); spawnProjectile({ pos: from, vel: dir.multiplyScalar(40), grav: 0, radius: 0.45, dmg: base * 2 * up, owner: 'player', kind: 'frost', scale: 1.6, life: 2, onHit: (p, m) => { if (m) { this.dealDamage(m, p.dmg, { el: 'frost', freeze: 3 * Math.sqrt(up) }); V.burst('frost', m.pos.clone().setY(m.pos.y + 1), 30, { speed: 4 }); } } }); S.cast('frost', this.pos, 1.3); this.atk = { name: 'cast', t: 0.2, dur: 0.5, hit: true, noQueue: true }; break; }
      case 'meteorshower': { const c = groundPoint(32); this.atk = { name: 'castBig', t: 0, dur: 0.9, hit: true, noQueue: true }; S.cast('fire', this.pos, 2); for (let k = 0; k < this.qty(4, 5); k++) setTimeout(() => { if (this.dead) return; const q = c.clone().add(new THREE.Vector3((Math.random() - 0.5) * 14 * this.areaK(), 0, (Math.random() - 0.5) * 14 * this.areaK())); q.y = heightAt(q.x, q.z); this.meteorImpact(q, 4.5 * this.areaK(), base * 1.6 * up); }, 250 + k * 380); break; }
      case 'inferno': { const tgt = groundPoint(30), r = 7 * (up > 1 ? 1.3 : 1); this.atk = { name: 'castBig', t: 0, dur: 0.9, hit: true }; S.cast('fire', this.pos, 2); setTimeout(() => { if (!this.dead) this.meteorImpact(tgt, r, base * 3.5 * up); }, 600 * ABIL_DELAY_K()); break; }
      case 'adrenaline': {
        this.buffs.adren = 8; S.battleCry(); S.heal(); this.fovKick = 10; this.end = Math.min(this.maxEnd, this.end + 20);
        V.burst('ember', this.pos.clone().setY(this.pos.y + 1), 40, { speed: 5 }); V.ring(this.pos, 3.5, '#ff6a3a', 0.4); G.hooks.toast && G.hooks.toast('Adrenaline! Faster and stronger for 8 s', '⚡', 'gold');
        break;
      }
      case 'tourniquet': {
        this.buffs.tq = 10; S.skin(this.pos); S.heal();
        V.burst('heal', this.pos.clone().setY(this.pos.y + 1), 30, { speed: 2, vy: 2 }); G.hooks.toast && G.hooks.toast('Tourniquet: double health regeneration for 10 s', '✚', 'gold');
        break;
      }
      case 'secondwind': {
        this.end = Math.min(this.maxEnd, this.end + this.maxEnd * 0.4); this.buffs.swind = 6; S.dodge(); S.heal();
        V.burst('green', this.pos.clone().setY(this.pos.y + 1), 30, { speed: 3 }); V.ring(this.pos, 3, '#90ffb0', 0.4);
        break;
      }
      case 'fielddress': {
        this.regen = { per: this.maxHp * 0.3 / 8, t: 8 }; S.skin(this.pos); S.heal();
        V.burst('heal', this.pos.clone().setY(this.pos.y + 1), 30, { speed: 2, vy: 2 });
        break;
      }
      case 'manasurge': {
        this.buffs.surge = 8; this.mana = Math.min(this.maxMana, this.mana + this.maxMana * 0.15); S.cast('arcane', this.pos, 1.5); S.cast('holy', this.pos);
        V.burst('arcane', this.pos.clone().setY(this.pos.y + 1), 60, { speed: 5 }); V.sphereFlash(this.pos.clone().setY(this.pos.y + 1), 2.5, '#8ac0ff', 0.4);
        this.atk = { name: 'spell', t: 0, dur: 0.45, hit: true };
        break;
      }
      case 'icebarrier': {
        this.buffs.barrier = this.maxHp * 0.3; this.buffs.barrierT = 12; S.cast('frost', this.pos, 1.5);
        V.burst('frost', this.pos.clone().setY(this.pos.y + 1), 60, { speed: 3, radius: 1.5 }); V.sphereFlash(this.pos.clone().setY(this.pos.y + 1), 1.6, '#bfefff', 0.6);
        this.atk = { name: 'spell', t: 0, dur: 0.45, hit: true };
        break;
      }
      case 'frostnova': {
        const r = 7;
        for (const m of mobsInRadius(this.pos, r)) this.dealDamage(m, base * 1.4 * rk * up, { freeze: 3 + this.pk('a1up'), el: 'frost' });
        V.ring(this.pos, r, '#c0f0ff', 0.5); V.ring(this.pos, r * 0.7, '#ffffff', 0.4);
        V.burst('frost', this.pos.clone().setY(this.pos.y + 0.4), 90, { speed: 12, up: 0.15, size: 0.35, life: 0.8 });
        V.light(this.pos.clone().setY(this.pos.y + 1), '#80d0ff', 5, 0.4); S.cast('frost', this.pos, 1.4); S.explode(this.pos, 0.8, 'frost');
        this.atk = { name: 'spell', t: 0, dur: 0.45, hit: true };
        break;
      }
      case 'blink': {
        let dir = this.moveDir && this.moveDir.lengthSq() > 0.01 ? this.moveDir.clone().normalize() : f.clone();
        const from = this.pos.clone(); let to = from.clone();
        for (let s = 0.5; s <= 14 + this.pk('a2up') * 6; s += 0.5) { const p = from.clone().addScaledVector(dir, s); if (isWater(p.x, p.z)) break; const q = p.clone(); if (collide(q, this.radius)) break; if (heightAt(p.x, p.z) - this.pos.y > 4) break; to = p; }
        to.y = groundAt(to.x, to.z, to.y + 2).h;
        this.pos.copy(to); this.vel.set(0, 0, 0); { const yw = Math.atan2(dir.x, dir.z); V.portal(from, yw); V.portal(to, yw); } S.tele ? S.tele(to) : S.cast('arcane', to, 1.3); this.fovKick = 10; /* (the owner: a portal where he leaves and one where he steps out, each shrinking away over 3 s) */ /* (the owner: a far more striking, purple Blink: see blinkFx) */
        break;
      }
      case 'chain': {
        const from = this.handPos(); const a = aimRay(35);
        let tgt = a.mob || mobsInCone(this.pos, this.yaw, 30, 0.45).sort((x, y) => x.dist2(this.pos) - y.dist2(this.pos))[0];
        S.cast('lightning', this.pos, 1);
        this.atk = { name: 'spell', t: 0, dur: 0.45, hit: true };
        if (!tgt) { lightning(from, a.point); break; }
        const hit = new Set(); let prev = from, dmg = base * 1.7 * rk * up;
        for (let j = 0; j < (G.battleFx ? this.qty(3, 4) : 5 + this.pk('a3up') * 2) && tgt; j++) {
          hit.add(tgt); const to = tgt.pos.clone(); to.y += tgt.height * 0.6;
          lightning(prev, to); this.dealDamage(tgt, dmg, { el: 'lightning', stun: 0.4 }); V.light(to, '#a0c0ff', 4, 0.2);
          dmg *= 0.85; prev = to;
          tgt = G.mobs.filter(m => !m.dead && foe(m) && !hit.has(m) && m.pos.distanceTo(tgt.pos) < 11 * this.areaK()).sort((x, y) => x.pos.distanceTo(tgt.pos) - y.pos.distanceTo(tgt.pos))[0];
        }
        break;
      }
    }
    G.hooks.abilityUsed && G.hooks.abilityUsed(i);
  }

  // the musket: a fast ball with smoke and a kick; an aimed shot hits much harder and goes exactly where you point
  fireGun(charge, aimed, mult = 1, pierce = false) {
    const w = this.weapon, base = weaponDamage(this.h, w) * Game.perkPow(Game.perkLvl(this.h, 'L'));
    // the muzzle in the world. In first person the gun model lives in its own view-model scene, so its position there
    // means nothing in the world: work the muzzle out from the camera instead (centred under the eye when aiming)
    let from;
    if (this.camDist < 0.6) { const k = this.aimK || 0; from = G.camera.position.clone().add(new THREE.Vector3(0.22 * (1 - k), -0.2 * (1 - k) - 0.05 * k, -1.1).applyQuaternion(G.camera.quaternion)); }
    else if ((this.adsK || 0) > 0.6 && this.camDist < 0.6) from = G.camera.position.clone().add(new THREE.Vector3(0, -0.03, -1.15).applyQuaternion(G.camera.quaternion)); // sighted: from the muzzle you are looking down
    else { const tip = this.ch.weapons.main; from = tip && tip.userData.tip ? tip.userData.tip.getWorldPosition(new THREE.Vector3()) : this.handPos(true); }
    const dir = this.aimDir(from);
    if (!aimed && !(this.buffs.eagle > 0)) { dir.x += (Math.random() - 0.5) * 0.012; dir.y += (Math.random() - 0.5) * 0.008; dir.z += (Math.random() - 0.5) * 0.012; dir.normalize(); }
    const eagle = this.buffs.eagle > 0, fast = this.buffs.reload > 0;
    if (w && w.wt === 'blunderbuss') { // a spray of shot: eight pellets in a cone, deadly up close, gone by 25 m
      const n = 8, sp = aimed ? 0.06 : 0.11, up3 = new THREE.Vector3(0, 1, 0);
      for (let i = 0; i < n; i++) { const d = dir.clone().applyAxisAngle(up3, (Math.random() - 0.5) * sp * 2); d.y += (Math.random() - 0.5) * sp; d.normalize();
        spawnProjectile({ wpn: mult === 1 && i === 0, pos: from.clone(), vel: d.multiplyScalar(90), grav: 2, radius: 0.16, dmg: base * (G.battleFx ? 0.62 + charge * 1.05 : 1.5 + charge * 2.6) * (fast ? 1.3 : 1) * mult * 0.22, owner: 'player', kind: 'bullet', life: 0.28 }); }
      V.burst('smoke', from, 22, { speed: 3, size: 1.4, life: 1.8 }); V.burst('fire', from, 14, { speed: 6 }); V.light(from, '#ffb040', 8, 0.1);
      S.gunshot(null, 1.3 + charge * 0.35); this.fovKick += 3 + charge * 2; V.addShake(0.1 + charge * 0.1); this.recoil = 1.3; return; }
    spawnProjectile({ wpn: mult === 1, pos: from, vel: dir.multiplyScalar(110 + charge * 70 + (eagle ? 40 : 0)), grav: 3, flat: 1.1 + charge * 1.2 + (eagle ? 0.6 : 0), radius: pierce ? 0.22 : 0.14, dmg: base * (G.battleFx ? 0.62 + charge * 1.05 : 1.5 + charge * 2.6) * (fast ? 1.3 : 1) * mult, owner: 'player', kind: 'bullet', life: 3, pierce, scale: pierce ? 1.8 : 1 });
    V.burst('smoke', from, 12, { speed: 2, size: 1.1, life: 1.6 }); V.burst('fire', from, 6, { speed: 4 }); V.light(from, '#ffc060', 6, 0.08);
    S.gunshot(null, 1 + charge * 0.35); this.fovKick += 2 + charge * 2; V.addShake(0.06 + charge * 0.08); this.recoil = 1;
  }
  // Kingdom Battles: class abilities never depend on the weapon in your hands. Every hero carries their class kit:
  // rangers throwing knives, bolas and a spirit hawk; musketeers a belt pistol, a bayonet knife and fire flasks;
  // warriors fight with shoulder and stance whether or not they hold a shield. Returns true when it handled the ability.
  classGear(id, base, up, f) {
    const hand = () => this.handPos(true), aim = (from) => this.aimDir(from);
    const bullet = (from, dir, dmg, o = {}) => spawnProjectile(Object.assign({ pos: from, vel: dir.multiplyScalar(130), grav: 3, flat: 1.2, radius: 0.14, dmg, owner: 'player', kind: 'bullet', life: 2.5 }, o));
    const pistolFx = (from) => { V.burst('smoke', from, 10, { speed: 2, size: 0.9, life: 1.3 }); V.burst('fire', from, 5, { speed: 4 }); V.light(from, '#ffc060', 5, 0.07); S.gunshot(null, 0.8); this.recoil = 0.6; V.addShake(0.05); };
    switch (id) {
      // ---- Ranger ----
      case 'spectral': { // Spirit Hawk
        const from = this.pos.clone().setY(this.pos.y + 2.2), dir = aim(from);
        spawnProjectile({ pos: from, vel: dir.multiplyScalar(70), grav: 0, radius: 0.45, dmg: base * 2.6 * up, owner: 'player', kind: 'spectral', scale: 1.6, life: 1.6, pierce: true });
        S.growl && S.growl('wolf', this.pos, 1.8); S.cast('holy', this.pos); V.burst('green', from, 30, { speed: 3 }); this.atk = { name: 'cast', t: 0.3, dur: 0.4, hit: true, noQueue: true }; return true;
      }
      case 'pinning': { // Bolas
        const from = hand(), dir = aim(from);
        spawnProjectile({ pos: from, vel: dir.multiplyScalar(42), grav: 6, radius: 0.4, dmg: base * 1.1 * up, owner: 'player', kind: 'axe', scale: 0.6, life: 1.6, onHit: (p, m) => { if (m) { this.dealDamage(m, p.dmg, { stun: 2.5 * Math.sqrt(up), slow: 5 }); V.number(m.pos.clone().setY(m.pos.y + m.height + 0.6), 'Bound!', 'bad'); V.ring(m.pos, 1.2, '#c8a060', 0.5); } } });
        S.swingW('light', 1, this.pos); this.atk = { name: 'swing2', t: 0.25, dur: 0.4, hit: true, noQueue: true }; return true;
      }
      case 'barrage': { // Knife Fan
        const n = this.qty(5, 7);
        for (let k = 0; k < n; k++) setTimeout(() => { if (this.dead) return; const from = hand(), dir = aim(from); dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * 0.35); dir.y += (Math.random() - 0.5) * 0.05; spawnProjectile({ pos: from, vel: dir.normalize().multiplyScalar(48), grav: 4, radius: 0.22, dmg: base * 0.4 * up, owner: 'player', kind: 'knife', life: 1.6, onHit: (p, m) => { if (m) this.dealDamage(m, p.dmg, { bleed: base * 0.05 }); } }); S.swingW('light', 0.7, this.pos); }, k * 70);
        this.atk = { name: 'swing1', t: 0, dur: n * 0.07, hit: true, noQueue: true }; return true;
      }
      // ---- Musketeer ----
      case 'grapeshot': { // Sidearm Blast: the belt pistol, loaded with shot
        const from = hand(); for (const m of mobsInCone(this.pos, this.yaw, 9 * Math.sqrt(up), 0.6)) this.dealDamage(m, base * 1.1 * up, { knock: m.pos.clone().sub(this.pos).setY(0).normalize().multiplyScalar(9) });
        for (let k = 0; k < 9; k++) { const q = this.pos.clone(), a2 = this.yaw + (Math.random() - 0.5) * 1.2, d = 2 + Math.random() * 7; q.x += Math.sin(a2) * d; q.z += Math.cos(a2) * d; q.y = heightAt(q.x, q.z) + 1; setTimeout(() => V.burst('spark', q, 4, { speed: 3 }), k * 15); }
        pistolFx(from); V.burst('smoke', from, 20, { speed: 4, size: 1.4, life: 1.6 }); S.explode(from, 0.6, 'fire'); V.addShake(0.2); this.atk = { name: 'stabR', t: 0.2, dur: 0.35, hit: true, noQueue: true }; return true;
      }
      case 'volleyfire': { // Pistol Fan: a brace of belt pistols, fired one after another
        for (let k = 0; k < this.qty(3, 4); k++) setTimeout(() => { if (this.dead) return; const from = hand(); bullet(from, aim(from), base * 0.55 * up); pistolFx(from); }, k * 150);
        this.atk = { name: 'stabR', t: 0, dur: 0.75, hit: true, noQueue: true }; return true;
      }
      case 'incendiary': { // Fire Flask: lob a flask of lamp oil and powder
        const from = hand(), dir = aim(from); dir.y += 0.18;
        spawnProjectile({ pos: from, vel: dir.normalize().multiplyScalar(30), grav: 14, radius: 0.25, dmg: base * 1.4 * up, owner: 'player', kind: 'fireball', scale: 0.7, life: 3, onHit: (p, m, pos) => { const at = pos || (m && m.pos) || p.pos; areaDamage(at, 4.5 * Math.sqrt(up), p.dmg * 0.7, { el: 'fire', burn: base * 0.15 }); V.burst('fire', at, 60, { speed: 6 }); S.explode(at, 1, 'fire'); V.ring(at, 4.5, '#ff7030', 0.6); } });
        this.atk = { name: 'swing2', t: 0.25, dur: 0.4, hit: true, noQueue: true }; return true;
      }
      case 'quickreload': { // Powder Rush: everything you do, faster
        this.buffs.reload = 8 * up; this.buffs.rampage = Math.max(this.buffs.rampage || 0, 8 * up); S.click(); V.burst('gold', this.pos.clone().setY(this.pos.y + 1.3), 25, { speed: 3 }); return true;
      }
      case 'bayonet': { // Throat Stab: dart in with the bayonet knife and open the throat of whatever is in front of you
        this.dodge = { t: 0, dur: 0.18, dir: f.clone(), speed: 26 }; this.iframes = 0.25; this.fovKick = 8; S.swingW('pierce', 1.4, this.pos);
        this.atk = { name: 'stabR', t: 0, dur: 0.45, hit: true, noQueue: true };
        setTimeout(() => { if (this.dead) return; const t = mobsInCone(this.pos, this.yaw, 3.2, 0.8).sort((a, b) => a.dist2(this.pos) - b.dist2(this.pos))[0]; if (!t) return; this.dealDamage(t, base * 2.6 * up, { bleed: base * 0.2 * up, stun: 1.2, big: true, melee: true, critBonus: 0.3 }); t.status.bleed = Math.max(t.status.bleed || 0, 6); V.number(t.pos.clone().setY(t.pos.y + t.height + 0.6), 'Throat Stab!', 'crit'); V.burst('blood', t.pos.clone().setY(t.pos.y + t.height * 0.85), 24, { speed: 4 }); G.hitstop = 0.08; V.addShake(0.2); }, 190 * ABIL_DELAY_K());
        return true;
      }
      // ---- Shaman ----
      case 'healingwave': { this.heal(this.maxHp * 0.15 * up); S.heal(); V.ring(this.pos, 10 * this.areaK(), '#60e8b8', 0.7); V.burst('heal', this.pos.clone().setY(this.pos.y + 1), 40, { speed: 4, vy: 2 }); this.atk = { name: 'cast', t: 0.2, dur: 0.4, hit: true, noQueue: true }; return true; }
      case 'earthshock': { const from = hand(), dir = aim(from); spawnProjectile({ pos: from, vel: dir.multiplyScalar(38), grav: 3, radius: 0.4, dmg: base * 1.9 * up, owner: 'player', kind: 'rock', scale: 1.3, life: 2, onHit: (p, m, pos) => { if (m) this.dealDamage(m, p.dmg, { slow: 3, blunt: true, knock: m.pos.clone().sub(this.pos).setY(0).normalize().multiplyScalar(4) }); V.burst('stone', pos || p.pos, 18, { speed: 5, grav: 14, size: 0.25 }); S.rockBreak && S.rockBreak(pos || p.pos); } }); S.cast('nature', this.pos, 0.8); this.atk = { name: 'cast', t: 0.2, dur: 0.4, hit: true, noQueue: true }; return true; }
      case 'spiritwolf': { if (G.hooks.spiritWolf) G.hooks.spiritWolf(this.pos.clone().addScaledVector(f, -2), this.h.level, 45); S.growl('wolf', this.pos, 1.4); V.burst('heal', this.pos.clone().setY(this.pos.y + 0.8), 40, { speed: 3 }); V.ring(this.pos, 3, '#80ffd0', 0.6); this.atk = { name: 'cast', t: 0.2, dur: 0.5, hit: true, noQueue: true }; return true; }
      case 'ancestralward': { this.buffs.ward = 8; S.cast('arcane', this.pos, 0.8); V.sphereFlash(this.pos.clone().setY(this.pos.y + 1), 2, '#ffd890', 0.6); V.ring(this.pos, 9 * this.areaK(), '#ffd890', 0.7); return true; }
      case 'hex': { const a = aimRay(30); const t = a.mob || mobsInCone(this.pos, this.yaw, 25, 0.4).sort((x, y) => x.dist2(this.pos) - y.dist2(this.pos))[0]; this.atk = { name: 'cast', t: 0.2, dur: 0.45, hit: true, noQueue: true }; S.cast('arcane', this.pos, 0.7); if (!t) return true;
        t.hexUntil = G.time + 6 * Math.sqrt(up); this.dealDamage(t, base * 0.7 * up, { slow: 6, stun: 0.8 }); V.number(t.pos.clone().setY(t.pos.y + t.height + 0.6), 'Hexed!', 'bad'); V.burst('shadow', t.pos.clone().setY(t.pos.y + t.height * 0.6), 40, { speed: 3, size: 0.8, life: 1.2 }); V.burst('arcane', t.pos.clone().setY(t.pos.y + t.height), 20, { speed: 2 }); return true; }
      case 'chainheal': { this.heal(this.maxHp * 0.18 * up); S.heal(); let prev = this.pos.clone().setY(this.pos.y + 1.2), pct = 0.18 * up; const hit = new Set();
        const near = G.hooks.alliesNear ? G.hooks.alliesNear(this.pos, 14 * this.areaK()) : [];
        for (let j = 0; j < this.qty(2, 4); j++) { const nx = near.filter(o => !hit.has(o)).sort((a2, b2) => a2.pos.distanceTo(prev) - b2.pos.distanceTo(prev))[0]; if (!nx) break; hit.add(nx); pct *= 0.85; const to = nx.pos.clone().setY(nx.pos.y + 1.2);
          for (let k = 0; k < 10; k++) V.burst('heal', prev.clone().lerp(to, k / 10), 1, { speed: 0.4, size: 0.3, life: 0.4 }); if (G.hooks.allyFx) G.hooks.allyFx(nx.pos, [1.5, pct], 1); V.burst('heal', to, 14, { speed: 2, vy: 2 }); prev = to; }
        this.atk = { name: 'cast', t: 0.2, dur: 0.45, hit: true, noQueue: true }; return true; }
      case 'wartotem': { this.buffs.focus = Math.max(this.buffs.focus || 0, 8); const at = this.pos.clone().addScaledVector(f, 1.5); const tm = new THREE.Group(); const wood = new THREE.MeshStandardMaterial({ color: '#6a4424' }), paint = new THREE.MeshStandardMaterial({ color: '#c84a2a', emissive: '#a02a10', emissiveIntensity: 0.4 });
        for (let k = 0; k < 3; k++) { const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.6, 7), k === 1 ? paint : wood); b2.position.y = 0.3 + k * 0.6; tm.add(b2); } tm.position.copy(at); tm.position.y = heightAt(at.x, at.z); G.scene.add(tm); setTimeout(() => G.scene.remove(tm), 8000);
        V.ring(at, 10 * this.areaK(), '#ff7a4a', 0.8); S.battleCry(); this.atk = { name: 'cast', t: 0.2, dur: 0.4, hit: true, noQueue: true }; return true; }
      case 'stormcall': { const c = groundPoint(32), R = 6 * this.areaK(); V.ring(c, R, '#a0c0ff', 1.2); S.cast('lightning', c, 1);
        for (let k = 0; k < this.qty(3, 5); k++) setTimeout(() => { if (this.dead) return; const near = mobsInRadius(c, R); const m = near[Math.floor(Math.random() * near.length)]; const q = m ? m.pos.clone() : c.clone().add(new THREE.Vector3((Math.random() - 0.5) * R, 0, (Math.random() - 0.5) * R)); q.y = heightAt(q.x, q.z); lightning(q.clone().add(new THREE.Vector3(0, 24, 0)), q.clone().setY(q.y + 0.5)); V.light(q.clone().setY(q.y + 2), '#a0c0ff', 6, 0.2, 18); for (const mm of mobsInRadius(q, 2.6)) this.dealDamage(mm, base * 1.15 * up, { el: 'lightning', stun: 0.3 }); }, 250 + k * 260);
        this.atk = { name: 'castBig', t: 0.2, dur: 0.6, hit: true, noQueue: true }; return true; }
      case 'earthbind': { const R = 7 * this.areaK(); for (const m of mobsInRadius(this.pos, R)) { m.status.slow = Math.max(m.status.slow, 4 * Math.sqrt(up)); m.status.stun = Math.max(m.status.stun, 1.5); this.dealDamage(m, base * 0.4 * up, { silent: true }); V.burst('leaf', m.pos.clone().setY(m.pos.y + 0.3), 14, { speed: 2, vy: 3 }); } V.ring(this.pos, R, '#6ab04a', 0.8); V.burst('wood', this.pos, 30, { speed: 5, vy: 4, size: 0.3 }); S.rumble && S.rumble(this.pos, 0.6); this.atk = { name: 'smash', t: 0.3, dur: 0.5, hit: true, noQueue: true }; return true; }
      case 'spiritlink': { this.regen = { per: this.maxHp * 0.3 * up / 6, t: 6 }; S.heal(); V.ring(this.pos, 12 * this.areaK(), '#a0ffe0', 1); V.burst('heal', this.pos.clone().setY(this.pos.y + 1), 60, { speed: 5, vy: 3 }); this.atk = { name: 'castBig', t: 0.2, dur: 0.5, hit: true, noQueue: true }; return true; }
      // ---- Warrior: no shield needed ----
      case 'shieldthrow': { // Throwing Hammer
        const from = hand(), dir = aim(from), bounces = this.qty(2, 4);
        spawnProjectile({ pos: from, vel: dir.multiplyScalar(34), grav: 2, radius: 0.5, dmg: base * 1.4 * up, owner: 'player', kind: 'axe', life: 1.5, onHit: (p, m) => { if (!m) return; const hit = new Set([m]); let cur = m; this.dealDamage(m, p.dmg, { stun: 1.5, blunt: true }); S.blunt(m.pos); for (let k = 0; k < bounces; k++) { const nx = G.mobs.filter(o => !o.dead && !hit.has(o) && foe(o) && o.pos.distanceTo(cur.pos) < 10).sort((x, y) => x.pos.distanceTo(cur.pos) - y.pos.distanceTo(cur.pos))[0]; if (!nx) break; hit.add(nx); V.burst('spark', nx.pos.clone().setY(nx.pos.y + 1), 10, { speed: 4 }); this.dealDamage(nx, p.dmg * 0.8, { stun: 1, blunt: true }); cur = nx; } } });
        S.swingW('blunt', 1.4, this.pos); this.atk = { name: 'swing2', t: 0.3, dur: 0.45, hit: true, noQueue: true }; return true;
      }
    }
    return false;
  }
  // ---- Bard songs: every song on the hotbar plays by itself, pulsing its effect on you and your side ----
  tickSongs(dt) {
    const songs = this.h.hotbar.map(s => s && s.t === 'ab' && ABILITIES[this.h.cls].find(a => a.id === s.id)).filter(a => a && a.song && Game.abilityKnown(this.h, a));
    this.notes = this.notes || [];
    if (songs.length && !this.dead) {
      this.noteT = (this.noteT || 0) - dt;
      if (this.noteT <= 0) { this.noteT = 0.35; const a = songs[Math.floor(Math.random() * songs.length)]; this.spawnNote(SONG_COL[a.song]); }
      // the healing song is a steady regen: a little every second, no big heals
      const regen = songs.find(a => a.song === 'heal');
      if (regen && (this.regenT = (this.regenT || 0) - dt) <= 0) { this.regenT = 1; const up2 = G.abilScale ? G.abilScale(this.h.level) : 1; this.heal(this.maxHp * regen.pct * up2); if (G.hooks.allyFx) G.hooks.allyFx(this.pos, [BATTLE ? (regen.r || 14) * this.areaK() : (Game.fxCount(this.h, 'songreach') ? 25 : 15), regen.pct * up2], 1); }
      this.songT = (this.songT || 0) - dt;
      if (this.songT <= 0) { this.songT = 3;
        const up = G.abilScale ? G.abilScale(this.h.level) : 1, K = this.areaK(), ally = (r, pct, kind) => G.hooks.allyFx && G.hooks.allyFx(this.pos, [r, pct || 0, kind, 3.6], 1);
        for (const a of songs) { const r = Game.fxCount(this.h, 'songreach') ? 25 : 15; // campaign: songs reach 15 m (25 m with Carrying Voice)
          if (a.song === 'war') { this.buffs.cry = Math.max(this.buffs.cry || 0, 3.6); ally(r, 0, 'rally'); }
          else if (a.song === 'travel') { this.buffs.swind = Math.max(this.buffs.swind || 0, 3.6); ally(r, 0, 'haste'); }
          else if (a.song === 'flame') { this.buffs.flame = Math.max(this.buffs.flame || 0, 3.6); ally(r, 0, 'flame'); }
          else if (a.song === 'mana') { this.buffs.clarity = Math.max(this.buffs.clarity || 0, 3.6); ally(r, 0, 'clarity'); }
          else if (a.song === 'power') this.buffs.power = Math.max(this.buffs.power || 0, 3.6);
          else if (a.song === 'endure') this.end = Math.min(this.maxEnd, this.end + this.maxEnd * 0.1 * up);
          else if (a.song === 'mward') this.buffs.mward = Math.max(this.buffs.mward || 0, 3.6);
          else if (a.song === 'snare' || a.song === 'weaken') { for (const m of mobsInRadius(this.pos, r)) { if (a.song === 'snare') m.status.slow = Math.max(m.status.slow || 0, 3.6); else m.hexUntil = Math.max(m.hexUntil || 0, G.time + 3.6); } }
          else if (a.song === 'ward') { this.buffs.barrier = Math.max(this.buffs.barrier || 0, this.maxHp * 0.06 * up); this.buffs.barrierT = 3.6; ally(r, 0, 'ward'); }
          V.ring(this.pos, 2.2, SONG_COL[a.song], 0.6); } // campaign: a small pulse at your feet, not a huge circle
        S.heal && songs.some(a => a.song === 'heal') && 0; }
    }
    // the notes drift up and fade
    for (let i = this.notes.length - 1; i >= 0; i--) { const n = this.notes[i]; n.t += dt; const k = n.t / 2.2; if (k >= 1) { G.scene.remove(n.s); this.notes.splice(i, 1); continue; }
      n.s.position.set(this.pos.x + Math.cos(n.a + n.t * 0.8) * n.r, this.pos.y + n.y + n.t * 0.6, this.pos.z + Math.sin(n.a + n.t * 0.8) * n.r); n.s.material.opacity = Math.min(1, (1 - k) * 2) * Math.min(1, n.t * 4); }
  }
  spawnNote(col) {
    const tex = noteTex(col, Math.random() < 0.5 ? '♪' : '♫'); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    s.scale.setScalar(0.32 + Math.random() * 0.12); G.scene.add(s); this.notes.push({ s, t: 0, a: Math.random() * Math.PI * 2, r: 0.7 + Math.random() * 0.7, y: 0.9 + Math.random() * 1.0 });
  }
  // ---- the new classes' abilities, run from their data in classes2.js ----
  runKit(a, base, up, f) {
    const K = this.areaK(), P = (n) => base * (n || 0) * up;
    const FX = { gold: ['gold', '#ffd870'], shadow: ['shadow', '#9a60c0'], leaf: ['leaf', '#7ac050'], dust: ['dust', '#c8b090'], arcane: ['arcane', '#c080ff'], frost: ['frost', '#9ad8ff'], fire: ['fire', '#ff8030'], smoke: ['smoke', '#8a8a8a'], blood: ['blood', '#c02020'] };
    const [pk, col] = FX[a.fx] || ['spark', '#ffffff'];
    const el = a.kind === 'fireball' || a.fx === 'fire' ? 'fire' : a.kind === 'frost' || a.fx === 'frost' ? 'frost' : a.kind === 'arcane' || a.fx === 'arcane' || a.fx === 'shadow' ? 'arcane' : null;
    const hitO = (m, extra = {}) => Object.assign({ stun: a.stun || 0, slow: a.slow || 0, root: a.root || 0, fear: a.fear || 0, mez: !!a.mez, burn: a.burn ? base * a.burn : 0, bleed: a.bleed ? base * a.bleed : 0, critBonus: a.crit || 0, el: el || undefined, knock: a.knock && m ? m.pos.clone().sub(this.pos).setY(0).normalize().multiplyScalar(a.knock) : undefined }, extra);
    const anim = (n, d = 0.45) => { if (G.newFx && (n === 'cast' || n === 'castBig')) { n = 'castRel'; d = 0.5; } this.atk = { name: n, t: 0.15, dur: d, hit: true, noQueue: true }; };
    const ally = (at, r, pct, kind, dur) => { if (G.hooks.allyFx) G.hooks.allyFx(at, [r, pct || 0, kind, dur], 1); };
    const aimTarget = (range) => { const r = aimRay(range); if (this.h.arena) return this.aimFoe(range); /* the arena: no auto-aim, only what is under the crosshair */ return r.mob && foe(r.mob) ? r.mob : mobsInCone(this.pos, this.yaw, range, 0.45).sort((x, y) => x.dist2(this.pos) - y.dist2(this.pos))[0]; };
    if (G.hooks.kb && G.hooks.kb.has(a.t)) return G.hooks.kb.cast(this, a, { P }); // (kitsb.js: the elementalist's, enchanter's, beastmaster's, priest's and bombardier's reworked moves)
    switch (a.t) {
      case 'axethrow': { if (this.axeOut || this.axeThrow) return false; this.axeThrow = { t: 0, dur: 1.0, dmg: base * 1.4 * up, thrown: false }; this.atk = { name: 'axethrow', t: 0, dur: 1.0, hit: true, noQueue: true }; S.heavySwing && S.heavySwing(this.pos); return true; }
      case 'mendbanner': { if (G.hooks.mendBanner) G.hooks.mendBanner(this); anim('cast'); return true; }
      case 'shbash': { this.atk = { name: 'shieldbash', t: 0, dur: 0.8, hit: true, noQueue: true }; S.block(true, this.pos); setTimeout(() => { if (this.dead) return; const f = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)), p = this.pos.clone().addScaledVector(f, 1.5); areaDamage(p, 1.9, P(a.dmg || 0.8), { knock: 6, stun: a.stun || 1.2, melee: true }); V.burst('dust', p, 18, { speed: 4, size: 0.5 }); S.blunt(p); S.hit('stone', p); V.addShake(0.25); }, 330); return true; } /* (the warrior's right click: a shove with the shield that knocks back and stuns whoever is in front) */
      case 'bolt': case 'drain': {
        const n = a.n ? this.qty(a.n, a.extra || 0) : 1, from = this.spellFrom(), dir0 = this.aimDir(from);
        for (let i = 0; i < n; i++) { const dir = dir0.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), (i - (n - 1) / 2) * (a.spread || 0));
          spawnProjectile({ pos: from.clone(), vel: dir.multiplyScalar(a.speed || 40), grav: a.kind === 'rock' ? 4 : 0.5, radius: a.aoe ? 0.5 : 0.35, dmg: P(a.dmg), owner: 'player', kind: a.t === 'drain' ? 'arcane' : (a.kind || 'arcane'), scale: a.kind === 'orb' ? 1.6 : 1.2, life: 2.5, pierce: !!a.pierce,
            onHit: (p, m, pos) => { const at = (pos || (m && m.pos) || p.pos).clone(); let dealt = 0;
              if (a.aoe) { for (const mm of mobsInRadius(at, a.aoe * K)) { this.dealDamage(mm, p.dmg * 0.8, hitO(mm)); dealt += p.dmg * 0.8; } V.burst(el === 'fire' ? 'fire' : pk === 'spark' ? 'arcane' : pk, at, 30, { speed: 5 }); S.explode(at, 0.7, el || 'fire'); }
              else if (m) { this.dealDamage(m, p.dmg, hitO(m)); dealt = p.dmg; }
              if (a.t === 'drain' && dealt && this.hk()) this.healOrb(at, dealt * a.drain * this.hk()); } }); }
        S.cast(el || 'arcane', this.pos, 0.8); anim('cast'); return true; }
      case 'nova': { const r = (a.r || 5) * K; let dealt = 0;
        if (!a.calm) for (const m of mobsInRadius(this.pos, r)) { this.dealDamage(m, P(a.dmg), hitO(m)); dealt += P(a.dmg); }
        if (a.drainAll && dealt && this.hk()) this.healOrb(this.pos.clone().addScaledVector(f, 3).setY(this.pos.y + 1), dealt * a.drainAll * this.hk());
        if (a.calm) for (const m of mobsInRadius(this.pos, r)) { m.provoked = false; m.loseTrack ? m.loseTrack() : (m.state = 'return'); V.number(m.pos.clone().setY(m.pos.y + (m.height || 1.6) + 0.5), 'Lulled', 'miss'); }
        if (a.vanish) { this.stealth = Math.max(this.stealth || 0, a.vanish); this.buffs.nextCrit = true; for (const m of G.mobs) if (!m.dead && m.state === 'chase' && m.pos.distanceTo(this.pos) < 30) m.loseTrack ? m.loseTrack() : (m.state = 'return'); S.stealth(); }
        V.ring(this.pos, r, col, 0.6); V.burst(pk === 'spark' ? 'dust' : pk, this.pos.clone().setY(this.pos.y + 0.6), 50, { speed: 6, radius: r * 0.4 }); S.cast(el || 'arcane', this.pos, 1); S.rumble && S.rumble(this.pos, 0.5); V.addShake(0.25); anim('smash', 0.5); return true; }
      case 'missiles': { /* (Magic Missiles: for a few seconds every cast is a seeking missile, twice as fast) */ this.buffs.missiles = (a.dur || 6) * (1 + 0.15 * Game.arenaPassive(this.h, 'mmLong')); this.buffFx(a.name, '#b070ff'); V.burst('void', this.pos.clone().setY(this.pos.y + 1.2), 36, { normal: true, speed: 3, size: 0.45, life: 0.6 }); V.burst('arcane', this.pos.clone().setY(this.pos.y + 1.2), 24, { speed: 4.5, size: 0.3 }); V.ring(this.pos, 2.2, '#8a3cff', 0.4); S.cast('arcane', this.pos, 1.3); this.fovKick = Math.max(this.fovKick || 0, 5); anim('cast', 0.35); return true; }
      case 'firearrow': { /* (Blazing Arrow: a huge burning arrow that hits like a ram and stuns; the recoil throws him back in a flip) */
        const from = this.camDist >= 0.6 ? ((bowRest(this.ch)) || this.handPos(true)) : this.handPos(true), dir = this.aimDir(from), dmg = P(a.dmg);
        spawnProjectile({ pos: from, vel: dir.clone().multiplyScalar(62), grav: 1.2, radius: 0.32, dmg, owner: 'player', kind: 'arrow', fireArrow: true, scale: 2.4, life: 2.2, onHit: (pr, m, pos) => { V.burst('fire', pos.clone(), 60, { speed: 7, size: 0.9 }); V.burst('ember', pos.clone(), 30, { speed: 5 }); V.light && V.light(pos, '#ff7a20', 8, 0.35, 9); S.explode && S.explode(pos, 0.7); V.addShake(0.35); if (m) this.dealDamage(m, pr.dmg, hitO(m, { ranged: true, stun: a.stun || 1.5, el: 'fire', burn: pr.dmg * 0.08, big: true })); } });
        const back = dir.clone().setY(0); if (back.lengthSq() < 1e-4) back.copy(f); back.normalize().multiplyScalar(-1); this.vel.x = back.x * 13; this.vel.z = back.z * 13; this.vel.y = Math.max(this.vel.y, 7.5); this.onGround = false; this.iframes = Math.max(this.iframes || 0, 0.35);
        V.burst('fire', from.clone(), 26, { speed: 4, size: 0.6 }); S.bowShot && S.bowShot(this.pos); S.cast && S.cast('fire', this.pos, 0.9); this.recoil = Math.max(this.recoil || 0, 2.4); anim('flip', 0.95); return true; } /* ('flip', not 'shoot': the bow-drawing pose would pin his arms out in front while he goes over) */
      case 'arcshield': { /* (Arcane Shield: a faint violet shell that soaks up a share of his health in damage for a few seconds) */
        this.arcShield = this.maxHp * (a.amount || 0.35) * (this._extK || 1); this.arcShieldT = G.time + (a.dur || 5); G.hooks.arcShieldFx && G.hooks.arcShieldFx(this, () => this.arcShield > 0 && G.time < this.arcShieldT, a.shell); this.atk = { name: 'spell', t: 0, dur: 0.35, hit: true }; break; }
      case 'bonespikes': { /* (the owner: Bone Spikes: a line of bone spears bursts out of the ground toward where you aim) */
        const dir = f.clone().setY(0).normalize(), hitS = new Set(); for (let i = 0; i < 9; i++) setTimeout(() => { if (this.dead) return; const d = 1.6 + i * 1.5, p = this.pos.clone().addScaledVector(dir, d); p.y = heightAt(p.x, p.z);
          for (let k = 0; k < 3; k++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.14 + Math.random() * 0.06, 1.2 + Math.random() * 0.9, 5), new THREE.MeshStandardMaterial({ color: '#e8dcc0', roughness: 0.7 })); sp.position.set(p.x + (Math.random() - 0.5) * 0.9, p.y - 0.9, p.z + (Math.random() - 0.5) * 0.9); sp.rotation.set((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6); G.scene.add(sp); V.temp(sp, 1.4, (o, kk) => { o.position.y = p.y - 0.9 + Math.min(1, kk * 9) * 1.3 - Math.max(0, kk - 0.65) * 4; if (kk >= 0.99) { o.geometry.dispose(); o.material.dispose(); } }); }
          V.burst('bone', p.clone().setY(p.y + 0.3), 8, { speed: 3 }); V.burst('dust', p.clone().setY(p.y + 0.2), 6, { speed: 2 }); S.hit && S.hit('stone', p, 0.5);
          for (const m of mobsInRadius(p, 1.6)) if (!hitS.has(m) && !m.isStruct) { hitS.add(m); this.dealDamage(m, P(a.dmg), hitO(m, { ranged: true, slow: a.slow || 2 })); } }, i * 55);
        S.cast('shadow', this.pos, 0.9); anim('cast', 0.4); return true; }
      case 'bardsong': { /* (the owner: the bard's buffs: Anthem of Swiftness (40% faster) and Ballad of Iron (40% less damage) for you and every ally within 15 m) */
        const d = a.dur || 6, R = (a.r || 15) * K; this.buffs[a.buff] = Math.max(this.buffs[a.buff] || 0, d); if (a.heal) { this.heal(this.maxHp * a.heal * this.hk()); playNotes(G.scene, this, '#7aff8a', 4); } G.hooks.allyFx && G.hooks.allyFx(this.pos, [R, a.heal || 0, a.buff, d], 1, 'notes');
        const col = a.buff === 'ward' ? '#7ac8ff' : a.buff === 'warsong' ? '#ff5a4a' : '#ffd860'; playNotes(G.scene, this, col, 8); this.buffFx(a.name, col); S.cast('holy', this.pos, 0.9); anim('cast', 0.4); return true; }
      case 'thorns': case 'flamewave': { /* (the owner: the druid's Thorn Volley and the elementalist's Flame Wave, instead of pets) */
        const fire = a.t === 'flamewave', R = 11, from = this.handPos();
        for (const m of mobsInCone(this.pos, this.yaw, R, 0.6)) { this.dealDamage(m, P(a.dmg), hitO(m, { ranged: true, el: fire ? 'fire' : undefined, slow: fire ? 0 : (a.slow || 2.5), burn: fire ? P(a.dmg) * (a.burn || 0.3) : 0 })); V.burst(fire ? 'fire' : 'leaf', m.pos.clone().setY(m.pos.y + 1), 14, { speed: 3 }); }
        for (let k = 0; k < 7; k++) setTimeout(() => { const d = 1.5 + k * 1.4, w = 0.5 + k * 0.35; for (let j = -2; j <= 2; j++) { const a2 = this.yaw + j * (w / Math.max(1, d)) * 0.6, q = this.pos.clone(); q.x += Math.sin(a2) * d; q.z += Math.cos(a2) * d; q.y = heightAt(q.x, q.z) + 0.5; V.burst(fire ? 'fire' : 'leaf', q, fire ? 8 : 5, { speed: fire ? 2.5 : 4, size: fire ? 0.8 : 0.35, vy: fire ? 2 : 0.5 }); } if (fire && k % 2 === 0) V.light(this.pos.clone().addScaledVector(f, d).setY(this.pos.y + 1), '#ff7a20', 4, 0.2, 8); }, k * 45);
        if (fire) { S.cast('fire', this.pos, 1.2); } else { S.cast('arcane', this.pos, 0.6); S.swingW && S.swingW('light', 1, this.pos); } anim('cast', 0.4); return true; }
      case 'lightslice': { /* (the owner: the paladin's right click: a hammer swing that hurls a crescent of golden light through everyone in its path) */
        if (!G.hooks.lightSlice) return true; const from = this.pos.clone().setY(this.pos.y + 1.3).addScaledVector(f.clone().setY(0).normalize(), 0.8), dir = this.aimDir(from);
        setTimeout(() => { if (!this.dead) G.hooks.lightSlice(this, this.pos.clone().setY(this.pos.y + 1.3).addScaledVector(dir.clone().setY(0).normalize(), 0.8), dir); }, 180); /* (it leaves the hammer as the swing comes through) */
        this.lungeT = 0.12; this.lungeDir = f.clone(); anim('swing2', 0.5); return true; }
      case 'soulrend': case 'gravegrasp': case 'shadowchains': case 'thornvolley': case 'roots': case 'smite': { /* (kits5.js: the Shadowknight's Soul Rend, Grasp of the Grave and Shadow Chains, the druid's Thorn Volley and Strangling Roots, the cleric's Holy Smite; the same effects computer fighters get) */
        const K5 = G.hooks.k5; if (!K5) return true; const left = a.t === 'shadowchains', from = () => left ? this.handPos(true) : (a.t === 'thornvolley' ? this.spellFrom() : this.handPos()), dir = this.aimDir(from());
        const tg = a.t === 'smite' ? aimTarget(30) : null, at = tg ? tg.pos.clone() : groundPoint(a.t === 'roots' ? 16 : 30);
        const ctx = { dmg: (a.dmg || 1) * up, slow: a.slow, root: a.root, stun: a.stun, from, dir, at, hit: (u, k, o2) => { const h0 = u.hp; this.dealDamage(u, base * k, hitO(u, o2)); return Math.max(0, h0 - (u.hp || 0)); }, heal: (n) => this.heal(n * this.hk()) };
        if (a.t !== 'smite' && a.t !== 'roots') { const fw = dir.clone().setY(0); if (fw.lengthSq() > 0.01) this.yaw = Math.atan2(fw.x, fw.z); }
        ({ soulrend: K5.soulRend, gravegrasp: K5.graveGrasp, shadowchains: K5.shadowChains, thornvolley: K5.thornVolley, roots: K5.strangleRoots, smite: K5.holySmite })[a.t](this, ctx);
        if (a.t === 'soulrend') { this.lungeT = 0.16; this.lungeDir = f.clone(); anim('swing1', 0.7); } else if (a.t === 'gravegrasp') anim('smash', 0.6); else anim('cast', 0.42); return true; }
      case 'chainbolt': { /* (the owner: the shaman's Chain Lightning: a bolt at the enemy you aim at, leaping on to two more nearby) */
        const from = this.handPos(), first = aimTarget(30); const hit = []; let cur = first, src = from.clone(), k = 1;
        while (cur && hit.length < 3) { hit.push(cur); const to = cur.pos.clone().setY(cur.pos.y + (cur.height || 1.6) * 0.6); lightning(src, to, '#cfe8ff'); lightning(src, to, '#9ad0ff'); V.burst('spark', to, 14, { speed: 5 }); V.light(to, '#bfe0ff', 4, 0.2, 10);
          this.dealDamage(cur, P(a.dmg) * k, hitO(cur, { ranged: true, el: 'lightning', slow: a.slow || 2 })); src = to; k *= 0.75; const last = cur; cur = mobsInRadius(last.pos, 9).filter(o => !hit.includes(o) && foe(o) && !o.isStruct).sort((x, y) => x.pos.distanceTo(last.pos) - y.pos.distanceTo(last.pos))[0]; }
        if (!first) { const to = from.clone().addScaledVector(this.aimDir(from), 20); lightning(from, to, '#cfe8ff'); }
        S.cast('lightning', this.pos, 1); anim('cast', 0.4); return true; }
      case 'purify': { if (G.hooks.clericPurify) G.hooks.clericPurify(this, a); anim('cast', 0.45); return true; }
      case 'smiteball': { const from = this.handPos ? this.handPos() : this.pos.clone().setY(this.pos.y + 1.2); if (G.hooks.clericSmite) G.hooks.clericSmite(this, this.aimDir(from), from); anim('swing1', 0.5); return true; }
      case 'lightshields': { const al = G.hooks.aimAlly ? G.hooks.aimAlly(this, 40) : null; if (G.hooks.clericShields) G.hooks.clericShields(this, al && al !== this ? al : null); anim('cast', 0.45); return true; }
      case 'shamanwolf': { if (G.hooks.shamanWolf) G.hooks.shamanWolf(this); anim('cast', 0.45); return true; } /* (the owner: a spirit wolf hunts the enemy nearest your crosshair for 6 s) */
      case 'spearcharge': { /* (the owner: the shaman charges along the ground, spear levelled, and runs it into the first enemy she meets: struck, knocked back and stunned for a moment) */
        this.dodge = { t: -0.12, dur: 0.6, dir: f.clone(), speed: 19, charge: true, rush: true, stop: true, hitSet: new Set(), dmg: P(a.dmg), extra: { stun: a.stun || 0.6, big: false, knock: undefined } }; /* (a short 0.6 s stun, not a knockdown: stun plus knockback is always a 2.7 s knockdown in the arena) */ this.fovKick = 5; S.chargeRush && S.chargeRush(0.6);
        this.atk = { name: 'thrust1', t: 0, dur: 0.75, hit: true, noQueue: true }; V.burst('dust', this.pos.clone().setY(this.pos.y + 0.2), 16, { speed: 3 }); return true; }
      case 'spearleap': { /* (the owner: the shaman leaps straight forward, spear first; everyone where she lands is struck and knocked back) */
        const to = this.pos.clone().addScaledVector(f, 9); to.y = heightAt(to.x, to.z); this.leap = { t: 0, dur: 0.5, from: this.pos.clone(), to, dmg: P(a.dmg), r: 2.8, hgt: 1.8 }; V.burst('dust', this.pos.clone().setY(this.pos.y + 0.2), 16, { speed: 3 }); S.swingW && S.swingW('spear', 1.3, this.pos); anim('leap', 0.55); return true; }
      case 'pounce': { /* (the owner: the beastmaster's Pounce: a leap onto the enemy you aim at; everyone where he lands is knocked down) */
        const tg = aimTarget(14); let to; if (tg) { const d = tg.pos.clone().sub(this.pos).setY(0); const L = d.length(); to = this.pos.clone().addScaledVector(d.normalize(), Math.max(0, L - 1.0)); } else to = this.pos.clone().addScaledVector(f, 10);
        to.y = heightAt(to.x, to.z); this.leap = { t: 0, dur: 0.55, from: this.pos.clone(), to, dmg: P(a.dmg), r: 3, hgt: 2.4 }; S.roar ? S.roar(this.pos) : null; V.burst('dust', this.pos.clone().setY(this.pos.y + 0.2), 16, { speed: 3 }); anim('leap', 0.6); return true; }
      case 'heavyblast': { /* (the owner: Heavy Blast: point-blank, very hard, and the kick throws him back) */
        const tip = this.ch && this.ch.weapons.main, from = tip && tip.userData.tip ? tip.userData.tip.getWorldPosition(new THREE.Vector3()) : this.handPos(true), dir = this.aimDir(from), R = 9;
        for (const m of mobsInCone(this.pos, this.yaw, R, 0.6)) { const d = Math.hypot(m.pos.x - this.pos.x, m.pos.z - this.pos.z), fall = d < 4 ? 1 : Math.max(0.5, 1 - (d - 4) / R); this.dealDamage(m, P(a.dmg) * fall, hitO(m, { ranged: true, knock: m.pos.clone().sub(this.pos).setY(0).normalize().multiplyScalar(10) })); V.burst('blood', m.pos.clone().setY(m.pos.y + 1.1), 10, { speed: 4 }); }
        const back = dir.clone().setY(0); if (back.lengthSq() < 1e-4) back.copy(f); back.normalize().multiplyScalar(-1); this.vel.x = back.x * 16; this.vel.z = back.z * 16; this.vel.y = Math.max(this.vel.y, 6.5); this.onGround = false;
        V.burst('fire', from.clone(), 60, { speed: 12, size: 0.9, dir: dir.clone() }); V.burst('smoke', from.clone(), 40, { speed: 5, size: 2, life: 2, dir: dir.clone() }); V.burst('spark', from.clone(), 30, { speed: 14, dir: dir.clone() }); V.light(from, '#ffa040', 10, 0.25, 12); S.explode(from, 1.3, 'fire'); V.addShake(0.6); this.recoil = Math.max(this.recoil || 0, 3.2); this.fovKick = Math.max(this.fovKick || 0, 10); anim('shoot', 0.5); return true; }
      case 'buttsmack': { /* (the owner: Butt Smack: the gun's stock into the enemy in front of him; they go down) */
        let hit = 0; for (const m of mobsInCone(this.pos, this.yaw, 3.4, 0.9)) { hit++; this.dealDamage(m, P(a.dmg), hitO(m, { melee: true, stun: a.stun || 1.2, knock: m.pos.clone().sub(this.pos).setY(0).normalize().multiplyScalar(6) })); V.burst('spark', m.pos.clone().setY(m.pos.y + 1.2), 12, { speed: 4 }); S.hit && S.hit('blunt', m.pos, 1.2); }
        if (hit) { V.addShake(0.3); G.hitstop = Math.max(G.hitstop || 0, 0.07); } S.swingW && S.swingW('heavy', 1.2, this.pos); this.lungeT = 0.14; this.lungeDir = f.clone(); anim('bash', 0.45); return true; }
      case 'powerload': { /* (the owner: Power Load: a blazing slug of lead; the kick blasts him backwards) */
        const tip = this.ch && this.ch.weapons.main, from = this.camDist < 0.6 ? G.camera.position.clone().add(new THREE.Vector3(0.18, -0.16, -1.1).applyQuaternion(G.camera.quaternion)) : (tip && tip.userData.tip ? tip.userData.tip.getWorldPosition(new THREE.Vector3()) : this.handPos(true)), dir = this.aimDir(from), dmg = P(a.dmg);
        spawnProjectile({ pos: from, vel: dir.clone().multiplyScalar(95), grav: 0.6, radius: 0.28, dmg, owner: 'player', kind: 'fireball', scale: 0.55, life: 2, onHit: (pr, m, pos) => { V.burst('fire', pos.clone(), 50, { speed: 7, size: 0.8 }); V.burst('ember', pos.clone(), 26, { speed: 6 }); V.burst('smoke', pos.clone(), 12, { speed: 2, size: 1.2, life: 1.2 }); V.light(pos, '#ff7a20', 7, 0.3, 9); S.explode(pos, 0.7, 'fire'); V.addShake(0.3);
          if (m) this.dealDamage(m, pr.dmg, hitO(m, { ranged: true, el: 'fire', burn: pr.dmg * 0.3, knock: m.pos.clone().sub(this.pos).setY(0).normalize().multiplyScalar(9) })); for (const o of mobsInRadius(pos, 2.2)) if (o !== m) this.dealDamage(o, pr.dmg * 0.3, { el: 'fire', ranged: true }); } });
        const back = dir.clone().setY(0); if (back.lengthSq() < 1e-4) back.copy(f); back.normalize().multiplyScalar(-1); this.vel.x = back.x * 14; this.vel.z = back.z * 14; this.vel.y = Math.max(this.vel.y, 6); this.onGround = false;
        V.burst('fire', from.clone(), 34, { speed: 6, size: 0.7, dir: dir.clone() }); V.burst('smoke', from.clone(), 26, { speed: 3, size: 1.5, life: 1.6 }); V.light(from, '#ffa040', 8, 0.2, 10); S.explode(from, 0.8, 'fire'); S.gunshot && S.gunshot(from); V.addShake(0.45); this.recoil = Math.max(this.recoil || 0, 3); this.fovKick = Math.max(this.fovKick || 0, 8); anim('shoot', 0.5); return true; }
      case 'beartrap': { /* (the owner: Bear Trap: one trap at a time at his feet; it snaps shut on the first enemy to step in and roots them) */
        if (this.bearTrap) { G.scene.remove(this.bearTrap.g); this.bearTrap.dead = true; }
        const at = this.pos.clone(); at.y = heightAt(at.x, at.z) + 0.03; const g = new THREE.Group(), steel = new THREE.MeshStandardMaterial({ color: '#4a4a4e', metalness: 0.8, roughness: 0.45 }), rust = new THREE.MeshStandardMaterial({ color: '#5a3a24', metalness: 0.4, roughness: 0.8 });
        const ring0 = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 6, 24), rust); ring0.rotation.x = Math.PI / 2; g.add(ring0); const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 14), steel); g.add(plate);
        const jaws = []; for (const sg of [-1, 1]) { const j = new THREE.Group(), arc = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 5, 20, Math.PI), steel); arc.rotation.set(0, sg > 0 ? 0 : Math.PI, 0); j.add(arc); for (let i = 0; i < 7; i++) { const ang = (i + 0.5) / 7 * Math.PI * (sg > 0 ? 1 : -1) + (sg > 0 ? 0 : 0), tooth = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 4), steel); tooth.position.set(Math.cos(ang) * 0.42 * (sg > 0 ? 1 : 1), 0.06, Math.sin(ang) * 0.42 * (sg > 0 ? -1 : -1)); j.add(tooth); } j.rotation.z = sg * 1.25; g.add(j); jaws.push(j); }
        g.position.copy(at); g.rotation.y = this.yaw; G.scene.add(g); S.chop && S.chop(at); V.burst('dust', at.clone().setY(at.y + 0.1), 10, { speed: 1.5, size: 0.4 });
        const T = { g, dead: false }; this.bearTrap = T; let t = 0, sprung = null, sprT = 0; const me = this, root = (a.root || 2.5) * (this._extK || 1), dmg = P(a.dmg || 0.5);
        G.timers.push({ update(dt) { if (T.dead || !g.parent) return true; t += dt;
          if (!sprung) { if (t < 0.5) return false; const m = G.mobs.find(o => !o.dead && !o.isStruct && foe(o) && Math.hypot(o.pos.x - at.x, o.pos.z - at.z) < 0.75 + (o.radius || 0.4)); if (!m) return false;
            sprung = m; sprT = 0; me.dealDamage(m, dmg, { root, bleed: dmg * 0.2, ranged: true }); if (m.status) m.status.root = Math.max(m.status.root || 0, root); V.burst('blood', at.clone().setY(at.y + 0.4), 16, { speed: 3 }); V.burst('spark', at.clone().setY(at.y + 0.2), 10, { speed: 3 }); S.hit && S.hit('metal', at, 1); S.chop && S.chop(at); V.number(at.clone().setY(at.y + 2), 'Trapped!', 'crit'); }
          sprT += dt; for (const j of jaws) j.rotation.z += (0 - j.rotation.z) * Math.min(1, dt * 30); /* (the jaws snap shut) */
          if (sprung && !sprung.dead) { sprung.pos.x += (at.x - sprung.pos.x) * Math.min(1, dt * 8); sprung.pos.z += (at.z - sprung.pos.z) * Math.min(1, dt * 8); g.position.x = at.x; } /* (held fast in the jaws) */
          if (sprT > root + 0.4) { G.scene.remove(g); T.dead = true; if (me.bearTrap === T) me.bearTrap = null; return true; } return false; } });
        anim('gather', 0.4); return true; }
      case 'buckwide': { /* (the owner: Buckshot: one wide blast of shot; everyone in front of him is hit and slowed) */
        const tip = this.ch && this.ch.weapons.main, from = this.camDist < 0.6 ? G.camera.position.clone().add(new THREE.Vector3(0.18, -0.16, -1.1).applyQuaternion(G.camera.quaternion)) : (tip && tip.userData.tip ? tip.userData.tip.getWorldPosition(new THREE.Vector3()) : this.handPos(true)), dir = this.aimDir(from), R = 14 * Math.sqrt(this._extK || 1);
        for (const m of mobsInCone(this.pos, this.yaw, R, 0.75)) { const d = Math.hypot(m.pos.x - this.pos.x, m.pos.z - this.pos.z), fall = d < 5 ? 1 : Math.max(0.45, 1 - (d - 5) / R); this.dealDamage(m, P(a.dmg) * fall, hitO(m, { ranged: true, slow: a.slow || 2.5, knock: m.pos.clone().sub(this.pos).setY(0).normalize().multiplyScalar(4) })); V.burst('blood', m.pos.clone().setY(m.pos.y + 1.1), 8, { speed: 3 }); }
        for (let k = 0; k < 16; k++) { const a2 = this.yaw + (Math.random() - 0.5) * 1.5, d = 3 + Math.random() * (R - 3), q = this.pos.clone(); q.x += Math.sin(a2) * d; q.z += Math.cos(a2) * d; q.y = heightAt(q.x, q.z) + 0.4 + Math.random() * 1.4; setTimeout(() => V.burst('spark', q, 4, { speed: 2.5, size: 0.12 }), 20 + d * 6); }
        V.burst('fire', from.clone(), 30, { speed: 9, size: 0.5, dir: dir.clone() }); V.burst('smoke', from.clone(), 30, { speed: 4, size: 1.6, life: 1.8, dir: dir.clone() }); V.light(from, '#ffb050', 8, 0.2, 10); S.explode(from, 0.9, 'fire'); V.addShake(0.4); this.recoil = Math.max(this.recoil || 0, 2.4); this.fovKick = Math.max(this.fovKick || 0, 6); anim('shoot', 0.45); return true; }
      case 'fanshot': { /* (the owner: the ranger's right click, six arrows loosed at once in a fan 60 degrees wide around where he aims) */
        const from = this.camDist >= 0.6 ? ((bowRest(this.ch)) || this.handPos(true)) : this.handPos(true), dir = this.aimDir(from), n = a.n || 6, wide = 60 * Math.PI / 180;
        for (let i = 0; i < n; i++) { const ang = -wide / 2 + wide * i / (n - 1), d = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), ang).normalize();
          spawnProjectile({ pos: from.clone(), vel: d.multiplyScalar(56), grav: 2.5, radius: 0.22, dmg: P(a.dmg), owner: 'player', kind: 'arrow', life: 1.6, onHit: (pr, m, pos) => { V.burst('leaf', pos.clone(), 8, { speed: 2.5 }); if (m) this.dealDamage(m, pr.dmg, hitO(m, { ranged: true })); } }); }
        S.bowShot && S.bowShot(this.pos); setTimeout(() => S.bowShot && S.bowShot(this.pos), 40); anim('shoot', 0.4); return true; }
      case 'bola': { /* (Bola Shot: two arrows side by side, joined by a cord; the catch slows the target and heals him 10%) */
        const from = this.camDist >= 0.6 ? ((bowRest(this.ch)) || this.handPos(true)) : this.handPos(true), dir = this.aimDir(from), side = new THREE.Vector3(-dir.z, 0, dir.x).normalize(); let caught = false; const pair = [];
        for (const sgn of [-1, 1]) pair.push(spawnProjectile({ pos: from.clone().addScaledVector(side, 0.28 * sgn), vel: dir.clone().multiplyScalar(58).addScaledVector(side, 0.9 * sgn), grav: 2.5, radius: 0.24, dmg: P(a.dmg) * 0.5, owner: 'player', kind: 'arrow', life: 2.5, onHit: (pr, m, pos) => { V.burst('leaf', pos.clone(), 14, { speed: 3 }); if (m) { this.dealDamage(m, pr.dmg, hitO(m, { ranged: true, slow: a.slow || 3 })); if (!caught) { caught = true; this.heal(this.maxHp * 0.1); V.burst('heal', this.pos.clone().setY(this.pos.y + 1.2), 24, { speed: 2, vy: 2 }); S.heal && S.heal(); } } } }));
        { const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 5), new THREE.MeshStandardMaterial({ color: '#6a4a2a', roughness: 0.9 })); G.scene.add(cord); let ct = 0; G.timers.push({ update: (dt) => { ct += dt; const A = pair[0], B = pair[1]; const live = A && B && A.mesh && B.mesh && A.mesh.parent && B.mesh.parent; if (!live || ct > 2.6) { G.scene.remove(cord); cord.geometry.dispose(); return true; } const pa = A.mesh.position, pb = B.mesh.position; cord.position.copy(pa).lerp(pb, 0.5); cord.scale.y = Math.max(0.05, pa.distanceTo(pb)); cord.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pb.clone().sub(pa).normalize()); return false; } }); } /* (the cord between the two arrows in flight) */
        S.bowShot && S.bowShot(this.pos); anim('shoot', 0.4); return true; }
      case 'zslash': { const range = (a.range || 5) * K; /* (the berserker's C: a fast, brutal slash; a red crescent tears through the air in front of him) */
        /* (the owner: a new slash that sweeps low across their legs, the red streak and the sound in time with it and going the same way. His recorded Weapon Combo's low two-handed sweep plays (right to left at thigh height); the axe head itself paints the blood-red streak while it sweeps, and the cut, the blood and the deep slash sound land as the axe crosses in front of him, a whoosh just before) */
        const HM = this.ch && this.ch.heroModel, mv = HM && HM !== 'loading' && HM.M && HM.D.abMoves && HM.M[HM.D.abMoves[a.id]], L = mv ? (mv[5] || 0.6) : 0.42, blow = L * (mv ? (mv[7] || 0.475) : 0.5), dmg = P(a.dmg);
        anim('lowcut', L); const w = this.ch && this.ch.weapons && this.ch.weapons.main, tr = w && w.userData.tip && w.userData.base && mv ? axeTrail() : null, trV = tr ? axeTrail() : null; if (tr) { tr.len = 16; trV.len = 16; } /* (two red streaks: the blade's flat band, and an upright ribbon over the axe head that the camera behind him sees face on) */
        let tt = 0, hit = false, swish = false;
        G.timers.push({ update: (dt) => { tt += dt; if (this.dead && !hit) { if (tr) { tr.active = false; trV.active = false; } hit = true; }
          if (tr) { if (tt > blow - 0.16 && tt < blow + 0.12) { const bp = w.userData.base.getWorldPosition(new THREE.Vector3()), tp = w.userData.tip.getWorldPosition(new THREE.Vector3()); tr.active = true; tr.push(bp.clone().lerp(tp, 0.45), tp.clone().lerp(bp, -0.15)); const hd = tp.clone().lerp(bp, 0.08); trV.active = true; trV.push(hd.clone().setY(hd.y - 0.15), hd.clone().setY(hd.y + 0.6)); } else if (tt >= blow + 0.12) { tr.active = false; trV.active = false; } } /* (the blade's outer half and a little past its edge: a bold red band exactly where the axe went) */
          if (!swish && tt > blow - 0.12) { swish = true; S.swingW && S.swingW('blade', 1.4, this.pos); }
          if (!hit && tt >= blow) { hit = true; for (const m of mobsInCone(this.pos, this.yaw, range, a.ang || 0.9)) { this.dealDamage(m, dmg, hitO(m, { melee: true })); const ip = m.pos.clone().setY(m.pos.y + (m.height || 1.6) * 0.3); V.burst('blood', ip, 18, { speed: 4 }); slashImpact(ip, 'swing2'); } S.zerkSlash && S.zerkSlash(1.3, this.pos); V.addShake(0.25); if (!tr) redSlash(this, range); }
          if (tt > blow + 0.8) { for (const t2 of [tr, trV]) { if (!t2) continue; const i = V.trails.indexOf(t2); if (i >= 0) V.trails.splice(i, 1); if (t2.mesh) { t2.mesh.parent && t2.mesh.parent.remove(t2.mesh); t2.mesh.geometry && t2.mesh.geometry.dispose(); } } return true; }
          return false; } });
        return true; }
      case 'cone': { const range = (a.range || 6) * K;
        for (const m of mobsInCone(this.pos, this.yaw, range, a.ang || 0.6)) this.dealDamage(m, P(a.dmg), hitO(m, { melee: true }));
        for (let i = 0; i < 40; i++) { const an = this.yaw + (Math.random() - 0.5) * (a.ang || 0.6) * 2, d = Math.random() * range; V.burst(pk === 'spark' ? 'dust' : pk, new THREE.Vector3(this.pos.x + Math.sin(an) * d, this.pos.y + 0.6 + Math.random(), this.pos.z + Math.cos(an) * d), 1, { speed: 1.5 }); }
        S.swingW(this.swingKind('swing3'), 1.5, this.pos); if (el) S.cast(el, this.pos, 0.8); V.addShake(0.2); anim(a.anim || 'swing3', a.animDur || 0.5); return true; }
      case 'strike': { anim('heavy', 0.5); S.swingW(this.swingKind('swing3'), 1.4, this.pos);
        setTimeout(() => { if (this.dead) return; const t = mobsInCone(this.pos, this.yaw, (a.reach || 3) + 0.5, 0.7).sort((x, y) => x.dist2(this.pos) - y.dist2(this.pos))[0]; if (!t) return;
          // behind it? (it faces away from you)
          const behind = a.backstab && Math.abs(angDiff(t.yaw || 0, Math.atan2(this.pos.x - t.pos.x, this.pos.z - t.pos.z))) > 2.0;
          if (behind) { V.number(t.pos.clone().setY(t.pos.y + (t.height || 1.6) + 0.9), 'Backstab!', 'crit'); V.burst('blood', t.pos.clone().setY(t.pos.y + 1.1), 30, { speed: 5 }); }
          this.dealDamage(t, P(a.dmg) * (behind ? 2.4 : 1), hitO(t, { melee: true, big: true, critBonus: behind ? 1 : (a.crit || 0) })); V.burst('spark', t.pos.clone().setY(t.pos.y + 1), 16, { speed: 5 }); G.hitstop = 0.07; V.addShake(0.25); }, 160 * ABIL_DELAY_K());
        return true; }
      case 'flurry': { const fast = this.h.cls === 'monk', n = Math.round(this.qty(a.hits || 4, a.extra || 0) * (fast ? 1.5 : 1)), gap = fast ? 50 : 90; anim('fury', Math.max(0.45, n * gap / 1000)); const per = fast ? P(a.dmg) / 1.5 : P(a.dmg); // (the monk's flurry: half again as many blows, nearly twice as fast)
        for (let k = 0; k < n; k++) setTimeout(() => { if (this.dead) return; const t = mobsInCone(this.pos, this.yaw, (a.reach || 3) + 0.5, 0.8).sort((x, y) => x.dist2(this.pos) - y.dist2(this.pos))[0]; S.swingW(this.swingKind('swing1'), 0.8, this.pos); if (t) { this.dealDamage(t, per, hitO(t, { melee: true, silent: k % 2 === 1 })); const hp = t.pos.clone().setY(t.pos.y + 1 + (Math.random() - 0.5) * 0.5); V.burst('spark', hp, fast ? 10 : 5, { speed: fast ? 5 : 3 }); if (fast) { V.sphereFlash(hp, 0.4, '#fff0c0', 0.08); S.blunt && S.blunt(hp); if (k % 4 === 0) V.addShake(0.08); } } }, k * gap);
        return true; }
      case 'dash': { this.dodge = { t: 0, dur: (a.dur || 0.3) * 1.8 * (a.id === 'ar_charge' ? 1 + 0.25 * Game.arenaPassive(this.h, 'chargeFar') : 1), dir: f.clone(), /* (Long Charge: the warrior's charge drives a quarter further per rank) */ speed: (a.speed || 28) / 1.8, charge: true, stop: !!a.stun && !a.plow, hitSet: new Set(), dmg: P(a.dmg), extra: a.knockF ? { stun: a.stun || 1, knock: f.clone().multiplyScalar(a.knockF).setY(0) } : null, land: a.land ? P(a.land) : 0 }; this.iframes = Math.max(this.iframes, a.iframes || 0.2); this.fovKick = 10; S.dodge(); anim('heavy', 0.4); return true; }
      case 'heal': { this.buffFx(a.name, '#7ee07e'); this.heal(this.maxHp * (a.self || 0) * up * this.hk()); if (a.r) ally(this.pos, a.r * K, (a.ally || 0) * up * this.hk()); S.heal(); if (!this.h.arena) V.ring(this.pos, (a.r || 3) * K, col === '#ffffff' ? '#80ffb0' : col, 0.7); else if (a.id !== 'sh_wave') { V.sphereFlash(this.pos.clone().setY(this.pos.y + 1.1), 1.6, '#a0ffc0', 0.35); V.burst('gold', this.pos.clone().setY(this.pos.y + 1.5), 24, { speed: 3, vy: 3 }); } V.burst('heal', this.pos.clone().setY(this.pos.y + 1), 40, { speed: 4, vy: 2 }); anim('cast'); return true; }
      case 'stormwalk': { // a 10 m wide storm that rolls slowly away in the direction you cast, striking everything under it
        const dir = new THREE.Vector3(f.x, 0, f.z).normalize(), c = this.pos.clone().addScaledVector(dir, 4), r = (a.r || 5) * K, speed = (a.travel || 15) / (a.dur || 6); let t = 0, tick = 0, ring = 0;
        G.timers.push({ update: (dt) => { t += dt; c.addScaledVector(dir, speed * dt); c.y = heightAt(c.x, c.z);
          for (let j = 0; j < 3; j++) V.emit('smoke', new THREE.Vector3(c.x + (Math.random() - 0.5) * r * 2, c.y + 9 + Math.random() * 2, c.z + (Math.random() - 0.5) * r * 2), { speed: 0.4, size: 3.2, life: 0.9, grav: 0, a0: 0.55 });
          if (Math.random() < dt * 20) V.emit('arcane', new THREE.Vector3(c.x + (Math.random() - 0.5) * r * 2, c.y + 8, c.z + (Math.random() - 0.5) * r * 2), { speed: 0.5, vy: -6, size: 0.25, life: 1.2 });
          if ((ring -= dt) <= 0) { ring = 0.5; V.ring(c, r, '#a8b8ff', 0.5); }
          if ((tick -= dt) <= 0) { tick = 0.45; const hits = mobsInRadius(c, r).sort(() => Math.random() - 0.5).slice(0, 3);
            const strike = (to) => { if (a.fx === 'fire') { V.burst('fire', to, 30, { speed: 6 }); V.burst('smoke', to, 10, { speed: 3, size: 1.2 }); S.explode(to, 0.7, 'fire'); } else if (a.fx === 'arcane') { V.burst('arcane', to, 30, { speed: 5 }); V.light(to, '#c0a0ff', 5, 0.15); } else lightning(to.clone().setY(c.y + 10), to); };
            if (!hits.length) { const q = c.clone().add(new THREE.Vector3((Math.random() - 0.5) * r * 1.6, 0, (Math.random() - 0.5) * r * 1.6)); strike(q); }
            for (const m of hits) { const to = m.pos.clone().setY(m.pos.y + (m.height || 1.6) * 0.6); strike(to); this.dealDamage(m, P(a.dmg), hitO(m, { el: a.fx === 'fire' ? 'fire' : a.fx === 'arcane' ? 'arcane' : 'lightning' })); }
            S.cast(a.fx === 'fire' ? 'fire' : a.fx === 'arcane' ? 'arcane' : 'lightning', c, 0.8); }
          return t >= (a.dur || 6) || this.dead; } });
        S.cast('lightning', this.pos, 1.4); anim('castBig', 0.6); return true; }
      case 'aura': { // a storm of blades, blood, smoke or souls whirls around you and moves with you
        const r = (a.r || 5) * K, mote = a.fx || 'dust'; let t = 0, tick = 0;
        G.timers.push({ update: (dt) => { t += dt;
          for (let j = 0; j < 5; j++) { const ang = Math.random() * 6.28, rr = Math.random() * r; V.emit(mote, new THREE.Vector3(this.pos.x + Math.cos(ang) * rr, this.pos.y + 0.3 + Math.random() * 2.2, this.pos.z + Math.sin(ang) * rr), { speed: 3, vy: 0.5, size: 0.4, life: 0.6 }); }
          if ((tick -= dt) <= 0) { tick = a.tick || 0.5; V.ring(this.pos, r, a.col || '#ffffff', 0.4); let dealt = 0; for (const m of mobsInRadius(this.pos, r)) { this.dealDamage(m, P(a.dmg), hitO(m, { silent: true })); dealt += P(a.dmg); } if (a.drain && dealt) this.heal(dealt * a.drain * this.hk(), true); }
          return t >= (a.dur || 6) || this.dead; } });
        V.sphereFlash(this.pos.clone().setY(this.pos.y + 1), r * 0.5, a.col || '#ffffff', 0.4); S.roar && S.roar(this.pos); anim('castBig', 0.5); return true; }
      case 'blizzaura': { // a blizzard whirls around you and moves with you
        const r = (a.r || 8) * K; let t = 0, tick = 0;
        G.timers.push({ update: (dt) => { t += dt;
          for (let j = 0; j < 6; j++) { const ang = Math.random() * 6.28, rr = Math.random() * r; V.emit('frost', new THREE.Vector3(this.pos.x + Math.cos(ang) * rr, this.pos.y + 0.3 + Math.random() * 3.5, this.pos.z + Math.sin(ang) * rr), { speed: 2.5, vy: -1, size: 0.45, life: 0.8 }); }
          if ((tick -= dt) <= 0) { tick = 0.5; V.ring(this.pos, r, '#c8ecff', 0.45); for (const m of mobsInRadius(this.pos, r)) this.dealDamage(m, P(a.dmg), hitO(m, { el: 'frost', slow: a.slow || 2, silent: true })); }
          return t >= (a.dur || 10) || this.dead; } });
        V.sphereFlash(this.pos.clone().setY(this.pos.y + 1), r * 0.6, '#c8ecff', 0.5); S.cast('frost', this.pos, 1.5); anim('castBig', 0.6); return true; }
      case 'petstrike': { // command your beasts to strike their targets (or the enemy you aim at)
        const list = G.mobs.filter(m => m.pet && !m.dead); anim('cast');
        if (!list.length) { G.hooks.toast && G.hooks.toast('You have no beast to command', '🐾', 'bad'); return true; }
        const aim = aimTarget(30);
        for (const m of list) { const t = (m.tgt && !m.tgt.dead && m.tgt) || aim; if (!t) continue; m.tgt = t; const dmg = (m.pet.dmg || 10) * (a.mult || 2) * Math.sqrt(up);
          const hits = a.aoe ? mobsInRadius(t.pos, a.aoe) : [t];
          for (const o of hits) { o.takeHit(dmg, this, { pet: true, stun: a.stun || 0 }); o.provoked = true; V.burst('blood', o.pos.clone().setY(o.pos.y + (o.height || 1.5) * 0.6), 16, { speed: 3 }); }
          const back = t.pos.clone().sub(m.pos).setY(0); if (back.length() > 2) m.pos.addScaledVector(back.normalize(), Math.min(4, back.length() - 1.5)); // the beast lunges in
          m.action = 'attack'; m.actionT = 0; m.actionDur = 0.5; if (a.aoe) V.ring(t.pos, a.aoe, '#ff6a4a', 0.5); }
        S.roar && S.roar(this.pos); return true; }
      case 'petbuff': case 'petheal': case 'petward': { // necromancer: strengthen, mend or shield your undead
        const list = G.mobs.filter(m => m.pet && !m.dead && (!a.kinds || a.kinds.includes(m.petKind))); anim('cast');
        if (!list.length) { G.hooks.toast && G.hooks.toast(a.kinds ? `${a.name} needs the right elemental at your side` : 'You have no pet to empower', '🐾', 'bad'); return true; }
        if (a.t === 'petheal' && a.petPct) { for (const m of list) { const add = Math.min(m.maxHp - m.hp, m.maxHp * a.petPct * Math.sqrt(up)); m.hp += add; V.burst('heal', m.pos.clone().setY(m.pos.y + 1), 20, { speed: 2, vy: 2 }); V.number(m.pos.clone().setY(m.pos.y + (m.height || 1.6) + 0.4), '+' + Math.round(add), 'heal'); } S.heal(); }
        else if (a.t === 'petheal') { const give = this.hp * (a.pct || 0.15); if (this.hp - give < 1) return true; this.hp -= give; for (const m of list) { m.hp = Math.min(m.maxHp, m.hp + give * 2 * up); V.burst('heal', m.pos.clone().setY(m.pos.y + 1), 20, { speed: 2, vy: 2 }); V.number(m.pos.clone().setY(m.pos.y + (m.height || 1.6) + 0.4), '+' + Math.round(give * 2 * up), 'heal'); }
          V.burst('blood', this.pos.clone().setY(this.pos.y + 1), 14, { speed: 2 }); S.heal(); }
        else for (const m of list) { if (a.t === 'petbuff') { m.frenzyT = G.time + (a.dur || 12) * Math.sqrt(up); m.frK = { dmg: a.dmgK || 1.4, spd: a.spdK || 1.3 }; m.frChill = !!a.chill; } else { m.wardT = G.time + (a.dur || 10) * Math.sqrt(up); m.wardK = a.wardK || 0.5; }
          V.burst(a.t === 'petbuff' ? 'blood' : 'bone', m.pos.clone().setY(m.pos.y + 1), 26, { speed: 3 }); V.ring(m.pos, 1.6, a.t === 'petbuff' ? '#ff4040' : '#e8e0c8', 0.5); }
        S.cast('arcane', this.pos, 0.8); return true; }
      case 'hot': { this.buffFx(a.name, '#7ee07e'); if (a.notes) { playNotes(G.scene, this, '#7aff8a', 8); if (a.r) G.hooks.allyFx && G.hooks.allyFx(this.pos, [a.r * K, 0, null, 0], 1, 'notes'); } /* (the bard's healing song: green notes round him and every ally it reaches) */ this.regen = { per: this.maxHp * a.pct * up * (this.hk() || this.regenK()) / a.dur, t: a.dur }; /* classes that cannot heal still regenerate themselves */ if (a.r) ally(this.pos, a.r * K, (a.ally || 0) * up * this.hk()); S.heal(); V.burst('heal', this.pos.clone().setY(this.pos.y + 1), 30, { speed: 2, vy: 2 }); V.ring(this.pos, (a.r || 2.5) * K, '#80ffb0', 0.6); anim('cast'); return true; }
      case 'buff': { if (a.eq && G.campAb) { this.eqBuff(a); anim('cast'); return true; }
        const wizPhase = a.buff === 'phase' && this.h.arena && (this.h.cls === 'wizard' || this.h.cls === 'rogue');
        if (a.buff === 'flame') this.flameIgniteT = G.time; else if (a.buff !== 'shout' && !wizPhase) this.buffFx(a.name, a.buff === 'poisonW' ? '#7ae050' : a.buff === 'barrier' ? '#8ac8ff' : '#ffd84a'); /* (Flame Blade: no screen flash or bubble: the sword itself ignites) */ const B2 = this.buffs, d = (a.dur || 8) * Math.sqrt(up);
        if (a.buff === 'barrier') { B2.barrier = this.maxHp * (a.amount || 0.25) * up; B2.barrierT = d; }
        else if (a.buff === 'stand') { this.heal(this.maxHp * (a.heal || 0) * up * this.hk()); B2.stand = d; }
        else if (a.buff === 'avatar') { for (const k in FORMS) B2[k] = 0; B2.avatar = d; this.avatar = Object.assign({ name: a.name }, a.av || {}); if (this.avatar.surge) B2.surge = Math.max(B2.surge || 0, d); this.formOn = null; }
        else if (FORMS[a.buff]) { B2.avatar = 0; for (const k in FORMS) B2[k] = 0; B2[a.buff] = d; if (a.buff === 'formArcane') B2.focus = Math.max(B2.focus || 0, d); }
        else if (a.buff === 'iceblock') { B2.iceblock = a.dur || 3; this.iframes = Math.max(this.iframes, a.dur || 3); this.vel.set(0, 0, 0); V.burst('frost', this.pos.clone().setY(this.pos.y + 1), 50, { speed: 3 }); }
        else if (wizPhase) { this.stealth = d; this.phaseInvis = true; B2.swind = Math.max(B2.swind || 0, d); for (const m of G.mobs) if (!m.dead && m.target === this) m.target = null; if (this.h.cls === 'rogue') { this.buffs.nextCrit = true; for (let i = 0; i < 3; i++) V.burst('shadow', this.pos.clone().setY(this.pos.y + 0.4 + i * 0.6), 14, { speed: 1.4, up: 0.5, vy: 0.3, size: 1.3, size1: 2.6, life: 1.4, radius: 1.0, grav: -0.3, a0: 0.85 }); S.stealth && S.stealth(); } else V.puff(this.pos, 1); } /* (the owner: Phase Shift fades him almost invisible; his first left click from it is a crit, and any attack ends it) */
        else if (a.buff === 'phase') { B2.phase = d; this.iframes = Math.max(this.iframes, d); B2.swind = Math.max(B2.swind || 0, d); V.burst('arcane', this.pos.clone().setY(this.pos.y + 1), 40, { speed: 3 }); }
        else B2[a.buff] = Math.max(B2[a.buff] || 0, d);
        if (a.buff === 'shout') { this.shoutT = 1.0; S.roar ? S.roar(this.pos) : S.battleCry && S.battleCry(); V.addShake(0.35); this.roarStreams(); } /* (the owner: no red burst round him; red streams pour from his mouth) */
        if (a.allyBuff) ally(this.pos, (a.r || 10) * K, 0, a.allyBuff, d);
        if (a.buff !== 'flame' && !wizPhase) { V.sphereFlash(this.pos.clone().setY(this.pos.y + 1), 1.8, col === '#ffffff' ? '#ffd890' : col, 0.5); if (a.r) V.ring(this.pos, a.r * K, col === '#ffffff' ? '#ffd890' : col, 0.6); S.cast('arcane', this.pos, 0.7); } anim('cast'); return true; }
      case 'curse': { const t = aimTarget(a.range || 25); anim('cast'); S.cast('arcane', this.pos, 0.7); if (!t) return true;
        const land = () => { if (t.dead) return;
        if (a.boneCage) { const p = t.pos.clone(); p.y = heightAt(p.x, p.z); const cage = new THREE.Group(), bone = new THREE.MeshStandardMaterial({ color: '#e8dcc0', roughness: 0.75 }); /* (Bone Prison: a cage of ribs bursts up round them) */
          for (let i = 0; i < 9; i++) { const a2 = i / 9 * Math.PI * 2, rib = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.07, 5, 10, Math.PI * 0.9), bone); rib.position.set(Math.cos(a2) * 0.55, 1.0, Math.sin(a2) * 0.55); rib.rotation.set(0, -a2 + Math.PI / 2, Math.PI / 2); cage.add(rib); }
          cage.position.copy(p).setY(p.y - 2.2); G.scene.add(cage); V.burst('bone', p.clone().setY(p.y + 0.4), 24, { speed: 4 }); S.hit && S.hit('stone', p, 1);
          V.temp(cage, (a.root || 1.5) + 0.5, (o, kk) => { const T = (a.root || 1.5) + 0.5, tt = kk * T; o.position.y = p.y - 2.2 + Math.min(1, tt / 0.18) * 2.2 - Math.max(0, tt - T + 0.35) * 6; if (!t.dead) { o.position.x = t.pos.x; o.position.z = t.pos.z; } if (kk >= 0.99) o.traverse(q => { if (q.isMesh) q.geometry.dispose(); }); }); }
        const list = [t, ...(a.spread ? mobsInRadius(t.pos, a.spread * K).filter(m => m !== t) : [])];
        for (const m of list) {
          if (a.pull && m === t) { const to = this.pos.clone().addScaledVector(f, 2); m.pos.x = to.x; m.pos.z = to.z; }
          if (a.dmg || a.stun || a.root || a.slow) this.dealDamage(m, P(a.dmg || 0.05), hitO(m, { freeze: a.freeze ? a.stun : 0 }));
          if (a.hex) m.hexUntil = G.time + a.hex;
          if (a.dot) { let k = 0; m.status.dot = a.dotT; m.status.dotName = a.name; const iv = setInterval(() => { if (m.dead || ++k > a.dotT || this.dead) { clearInterval(iv); if (!m.dead) m.status.dot = 0; return; } m.status.dot = a.dotT - k; this.dealDamage(m, P(a.dot), { silent: k % 2 === 0, el: 'arcane' }); if (Math.random() < 0.7) V.burst(k % 2 ? 'leaf' : 'shadow', m.pos.clone().setY(m.pos.y + (m.height || 1.6) * 0.7), 6, { speed: 0.8, size: 0.5, grav: -0.5 }); }, 1000); }
          V.burst(a.poison ? 'leaf' : 'shadow', m.pos.clone().setY(m.pos.y + (m.height || 1.6) * 0.6), 24, { speed: 2.5, size: 0.7 }); }
        if (a.sap) this.sapFx(a, t);
        V.number(t.pos.clone().setY(t.pos.y + (t.height || 1.6) + 0.6), a.name, 'bad'); };
        if (a.dot) { // push a small, slow cloud of disease at the target
          const from = this.spellFrom(), cl = { p: from.clone(), t: 0 }; S.cast('arcane', this.pos, 0.5);
          const iv = setInterval(() => { if (t.dead || this.dead) { clearInterval(iv); return; } cl.t += 0.03; const to = t.pos.clone().setY(t.pos.y + (t.height || 1.6) * 0.6), d = to.clone().sub(cl.p), l = d.length();
            cl.p.addScaledVector(d.normalize(), Math.min(l, 0.03 * 14)); for (let q = 0; q < 3; q++) V.emit(q ? 'leaf' : 'shadow', cl.p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.7)), { speed: 0.3, size: 0.55, life: 0.7, vy: 0.2 });
            if (l < 0.6 || cl.t > 3) { clearInterval(iv); land(); } }, 30);
        } else if (a.fear) { const from = this.spellFrom(), dir0 = t.pos.clone().setY(t.pos.y + 1.2).sub(from).normalize(); S.cast('arcane', this.pos, 0.9); S.growl && S.growl('wolf', this.pos, 0.5); // a screaming skull flies at them
          const sk = spawnProjectile({ pos: from, vel: dir0.multiplyScalar(20), grav: 0, radius: 1.0, dmg: 0, owner: 'none', kind: 'skull', life: 3, scale: a.bigSkull ? 3 : 1 }); const iv = setInterval(() => { if (t.dead || this.dead || !G.projectiles.includes(sk)) { clearInterval(iv); return; } const to = t.pos.clone().setY(t.pos.y + 1.2), d = to.clone().sub(sk.pos); if (d.length() < 0.8) { clearInterval(iv); sk.life = 0; G.projectiles.splice(G.projectiles.indexOf(sk), 1); G.scene.remove(sk.mesh); V.burst('shadow', to, 30, { speed: 4 }); V.burst('green', to, 20, { speed: 3 }); land(); } else sk.vel.copy(d.normalize().multiplyScalar(24)); }, 30);
        } else land();
        return true; }
      case 'ground': { const c = groundPoint(32), r = (a.r || 6) * K, n = a.ticks || 4; V.ring(c, r, col, n * 0.5 + 0.3);
        for (let k = 0; k < n; k++) setTimeout(() => { if (this.dead) return;
          for (const m of mobsInRadius(c, r)) if (a.dmg || a.stun || a.slow || a.root) this.dealDamage(m, P(a.dmg || 0.02), hitO(m, { silent: k > 0 }));
          if (a.healAllies && this.hk()) { ally(c, r, a.healAllies * up * this.hk()); if (Math.hypot(this.pos.x - c.x, this.pos.z - c.z) < r) this.heal(this.maxHp * a.healAllies * up * this.hk()); }
          for (let j = 0; j < 14; j++) { const q = c.clone().add(new THREE.Vector3((Math.random() - 0.5) * r * 1.6, 0.3 + Math.random() * 2, (Math.random() - 0.5) * r * 1.6)); V.burst(pk === 'spark' ? 'arcane' : pk, q, 1, { speed: 1.5, vy: pk === 'fire' ? 3 : 1 }); }
          if (k % 2 === 0) S.cast(el || 'arcane', c, 0.6); }, 150 + k * 500);
        anim('castBig', 0.6); return true; }
      case 'summon': { // a 3 s cast at the spot you aim at, then they rise there
        const n = this.qty(a.n || 1, a.extra || 0), at = groundPoint(14);
        this.summonCast = { t: 0, dur: this.h.arena ? 0.05 : 3 * (G.newFx ? Skills.castK(this.h) : 1), at, pet: a.pet, n, lv: this.h.level, dur2: a.dur || 30, big: !!a.big, name: a.name, spell: a.id };
        if (G.newFx) S.castRise(this.summonCast.dur, this.castCol());
        V.ring(at, 1.8, a.pet === 'skeleton' ? '#b080ff' : '#ffb060', 3.1); S.cast('arcane', this.pos, 0.7); anim('cast', 0.6); return true; }
      case 'trap': { const at = this.pos.clone().add(f.clone().multiplyScalar(2)); this.battleTrap(at, a.trap || 'spike', P(a.dmg), up); S.chop && S.chop(at); anim('gather', 0.45); return true; }
      case 'stealth': { if (a.step) { V.burst('shadow', this.pos.clone().setY(this.pos.y + 1), 40, { speed: 3, size: 1.2 }); const t = aimTarget(14), to = t ? t.pos.clone().addScaledVector(new THREE.Vector3(Math.sin(t.yaw || 0), 0, Math.cos(t.yaw || 0)), -1.4) : this.pos.clone().addScaledVector(f, a.step); this.pos.x = to.x; this.pos.z = to.z; if (t) this.yaw = Math.atan2(t.pos.x - this.pos.x, t.pos.z - this.pos.z); this.camA = null; V.burst('shadow', this.pos.clone().setY(this.pos.y + 1), 40, { speed: 3, size: 1.2 }); } // Shadow Step: through the shadows, behind them
        this.stealth = (a.dur || 4) * Math.sqrt(up); this.buffs.nextCrit = true; for (const m of G.mobs) if (!m.dead && m.state === 'chase' && m.pos.distanceTo(this.pos) < 30) m.loseTrack ? m.loseTrack() : (m.state = 'return'); S.stealth(); V.burst('shadow', this.pos.clone().setY(this.pos.y + 1), 40, { speed: 3, size: 1.4, life: 1.4, grav: 0, a0: 0.8 }); return true; }
    }
    return false;
  }
  // stolen life comes home: a green light drifts from the victim back to you and heals you when it arrives
  healOrb(from, amount) {
    const o = { p: from.clone(), v: new THREE.Vector3(0, 3, 0), t: 0 };
    const iv = setInterval(() => { if (this.dead) { clearInterval(iv); return; } o.t += 0.03;
      const to = this.pos.clone().setY(this.pos.y + 1.1), d = to.clone().sub(o.p), l = d.length();
      o.v.lerp(d.normalize().multiplyScalar(this.h.arena ? 30 + o.t * 30 : 9 + o.t * 8), this.h.arena ? 0.45 : 0.12); // (in the arena the stolen life rushes back almost at once) o.p.addScaledVector(o.v, 0.03);
      V.emit('heal', o.p.clone(), { speed: 0.2, size: 0.5, life: 0.45 }); if (Math.random() < 0.5) V.emit('heal', o.p.clone(), { speed: 0.6, size: 0.25, life: 0.6 });
      if (l < 0.7 || o.t > 2.5) { clearInterval(iv); this.heal(amount); V.burst('heal', to, 18, { speed: 2.2 }); S.heal && S.heal(); } }, 30);
  }
  // casting (spells) or a short action: slowed while it gathers, a dodge breaks it, then it fires
  tickAbCast(dt) {
    const c = this.abCast; c.t += dt;
    if (this.dead || this.dodge || this.swim) { this.abCast = null; G.hooks.castBar && G.hooks.castBar(null); if (!this.dead) G.hooks.toast && G.hooks.toast(`${c.name} was interrupted`, '✋', 'bad'); return; }
    G.hooks.castBar && G.hooks.castBar(c.name, c.t / c.dur);
    if (c.spell && G.newFx) this.castFx(dt, c.t / c.dur);
    else if (c.spell && Math.random() < dt * 20) V.emit(this.W && this.W.element === 'fire' ? 'fire' : this.W && this.W.element === 'frost' ? 'frost' : 'arcane', this.handPos(), { speed: 0.8, size: 0.25, life: 0.5 });
    if (c.t < c.dur) return;
    this.abCast = null; G.hooks.castBar && G.hooks.castBar(null); if (G.newFx && c.spell) { Skills.practise(this.h, 'casting'); this.castBurst(); } this.ability(c.i, true);
  }
  // buffs and heals you can see: coloured motes around you while each one lasts, green sparkles while you regenerate
  tickAuras(dt) {
    this.auraT = (this.auraT || 0) - dt; if (this.auraT > 0) return; this.auraT = 0.16;
    const at = () => this.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.3 + Math.random() * 1.6, (Math.random() - 0.5) * 1.2));
    if (this.regen && this.regen.t > 0) V.emit('heal', at(), { speed: 0.4, vy: 1.2, size: 0.28, life: 0.8 });
    const B = this.buffs; let n = 0;
    for (const k in AURA) if (B[k] > 0 && n < 3) { n++; const [kind, sz] = AURA[k]; V.emit(kind, at(), { speed: 0.5, vy: 0.8, size: sz, life: 0.7 }); }
    if (B.barrier > 0 && Math.random() < 0.5) V.emit('frost', at(), { speed: 0.3, size: 0.3, life: 0.6 });
  }
  // the moment a buff or heal lands: its name over you and a glow at the edge of the screen in its colour
  // third person: while aiming, the musket's butt sits in the right shoulder and the barrel points where you aim
  gunToShoulder(ch, on, free) {
    const g = ch.weapons && ch.weapons.main; if (!g || !g.parent) return; /* (the owner: the musketeer too carries his rifle in both hands at port arms, steady while he runs, and shoulders it to aim) */
    const ud = g.userData; if (!ud.home) ud.home = { p: g.position.clone(), q: g.quaternion.clone() };
    const bbuss = !!(this.weapon && this.weapon.wt === 'blunderbuss' && ch.heroModel && ch.heroModel.bones), musket = !!(this.weapon && this.weapon.wt === 'musket') || bbuss, port = !on && musket && (free || !!this.dodge) && !this.dead && !this.swim && !this.sheathed && g.visible !== false; /* (the musket at port arms when not aiming: carried across the body, muzzle up to the left, stock low at the right hip) */
    if (ud.handsSet) { ud.handsSet = false; for (const sd of ['R', 'L']) { const hd = ch.arms[sd].hand; if (hd && hd.userData.home) hd.position.copy(hd.userData.home); } } /* (the built hands back on their wrists; set again below while the gun is held) */
    if (!on && !port) { if (ud.aimed) { g.position.copy(ud.home.p); g.quaternion.copy(ud.home.q); ud.aimed = false; } return; }
    ch.root.updateMatrixWorld(true);
    const HB = ch.heroModel && ch.heroModel.bones, mdl = !!(musket && HB && HB.RightArm && HB.LeftArm && HB.RightForeArm && HB.RightHand); /* (a 3D hero model: fit the gun to the model's own shoulders and arm length, which its hands can reach) */
    const wp = (o) => o.getWorldPosition(new THREE.Vector3()), sh = wp(mdl ? HB.RightArm : ch.arms.R.sh), shL = wp(mdl ? HB.LeftArm : ch.arms.L.sh), sc = g.getWorldScale(new THREE.Vector3()).x;
    const L = mdl ? sh.distanceTo(wp(HB.RightForeArm)) + wp(HB.RightForeArm).distanceTo(wp(HB.RightHand)) : sh.distanceTo(wp(ch.arms.R.el)) + wp(ch.arms.R.el).distanceTo(wp(ch.arms.R.hand)); /* (shoulder to wrist) */
    if (!mdl) sh.y -= 0.04;
    let dir, upv, rx, want;
    if (port) { const bq = ch.root.getWorldQuaternion(new THREE.Quaternion()), f = new THREE.Vector3(0, 0, 1).applyQuaternion(bq), up = new THREE.Vector3(0, 1, 0), rt = new THREE.Vector3().crossVectors(f, up), bob = Math.sin(G.time * 1.8) * 0.006;
      dir = up.clone().multiplyScalar(0.78).addScaledVector(rt, -0.56).addScaledVector(f, 0.22).normalize(); /* (barrel up and across to the left shoulder) */
      rx = f.clone().addScaledVector(dir, -f.dot(dir)).normalize(); upv = new THREE.Vector3().crossVectors(rx, dir); /* (the lock faces out, away from the chest) */
      want = sh.clone().addScaledVector(up, -0.62 * L + bob).addScaledVector(f, 0.5 * L).addScaledVector(rt, -0.12 * L); } /* (the wrist of the stock in front of the right hip) */
    else { dir = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch)); // the barrel (model +y) along the aim, sights (+z) up, lock (+x) to the right: no twisting
      upv = new THREE.Vector3(0, 1, 0).addScaledVector(dir, -dir.y).normalize(); rx = new THREE.Vector3().crossVectors(dir, upv);
      want = musket ? sh.clone().addScaledVector(dir, 0.32 * L).addScaledVector(upv, 0.16 * L).addScaledVector(this.right(), -0.28 * L) : sh.clone().addScaledVector(dir, 0.42).addScaledVector(this.right(), -0.06); } /* (the musket's origin is the wrist of the stock: the butt plate tucks into the shoulder behind it, the cheek down on the comb) */
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(rx, dir, upv));
    // both hands on the gun: the right round the wrist of the stock, the left under the forend
    const at = (y, z) => want.clone().addScaledVector(dir, y).addScaledVector(upv, z);
    if (musket) { const back = (p, s0, d) => p.addScaledVector(s0.clone().sub(p).normalize(), d), bk = mdl ? 0.06 : 0.03, ly = port ? 0.56 : 0.34; /* (aimed, the left hand comes back to the rear band: a goblin's arms are short) */
      const tR = back(bbuss ? at(-0.07 * sc, -0.06 * sc) : at(0, -0.02 * sc), sh, bk), tL = back(bbuss ? at((port ? 0.3 : 0.24) * sc, -0.04 * sc) : at(ly * sc, -0.01 * sc), shL, bk); /* (the blunderbuss: right hand round its pistol grip, left under the fore-end) */ if (mdl) { for (const [sd, t] of [['R', tR], ['L', tL]]) { const hd = ch.arms[sd].hand; if (!hd || !hd.parent) continue; if (!hd.userData.home) hd.userData.home = hd.position.clone(); hd.parent.updateWorldMatrix(true, false); hd.position.copy(hd.parent.worldToLocal(t.clone())); } ud.handsSet = true; } /* (the model's hands follow the built body's hands, whose arms are longer: put those hands right where the model's should hold) */
      else { armReach(ch, 'R', tR, 6); armReach(ch, 'L', tL, 6); } } /* (right hand round the wrist of the stock at the trigger, left under the barrel at a band) */
    else { armReach(ch, 'R', at(-0.1, -0.05), 5); armReach(ch, 'L', at(0.42, -0.04), 5); }
    const pq = g.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    if (musket && mdl) { /* (the owner: the model's own hands on the gun: the right fist round the wrist of the stock, the left under the fore-end; the gun is placed after the arms are posed, so the arms reach for it here) */
      const bq = ch.root.getWorldQuaternion(new THREE.Quaternion()), rtv = new THREE.Vector3(-1, 0, 0).applyQuaternion(bq), dn = new THREE.Vector3(0, -1, 0);
      for (const [nm, t, sx] of [['Right', want.clone(), 1], ['Left', null, -1]]) { const A = HB[nm + 'Arm'], F = HB[nm + 'ForeArm'], Hd = HB[nm + 'Hand']; if (!A || !F || !Hd) continue;
        let tg = t; if (!tg) { g.parent.updateWorldMatrix(true, false); g.position.copy(g.parent.worldToLocal(want.clone())); g.quaternion.copy(g.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q)); /* (the hand the gun hangs from was just moved: its turn read now, or the gun the left hand reaches for lies crooked and the hand closes on air) */ g.updateWorldMatrix(true, false); tg = new THREE.Vector3(0, (bbuss ? 0.26 : port ? 0.5 : 0.42), 0).applyMatrix4(g.matrixWorld); const wr = Hd.getWorldPosition(new THREE.Vector3()), fa = wr.clone().sub(F.getWorldPosition(new THREE.Vector3())).normalize(); tg.addScaledVector(fa, -0.35 * Hd.getWorldPosition(new THREE.Vector3()).distanceTo(F.getWorldPosition(new THREE.Vector3())) * 0.3); } /* (the left hand under the fore-stock, where the gun now lies: its wrist placed so the palm, not the wrist, closes on the wood) */
        const so = t && (ch.hmSockets || []).find(k => k.parent === Hd); if (so) { Hd.updateWorldMatrix(true, true); tg.sub(so.getWorldPosition(new THREE.Vector3()).sub(Hd.getWorldPosition(new THREE.Vector3()))); } /* (the fist, not the wrist, at the grip) */
        const s0 = A.getWorldPosition(new THREE.Vector3()); ikArm(null, A, F, Hd, tg, s0.clone().addScaledVector(rtv, sx * L).addScaledVector(dn, L)); Hd.updateWorldMatrix(true, true);
        { g.parent.updateWorldMatrix(true, false); g.position.copy(g.parent.worldToLocal(want.clone())); g.quaternion.copy(g.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q)); g.updateWorldMatrix(true, false); const pw = palmWorld(Hd); if (pw) { const ax = new THREE.Vector3(0, 1, 0).transformDirection(g.matrixWorld), o0 = new THREE.Vector3().setFromMatrixPosition(g.matrixWorld), on = o0.clone().addScaledVector(ax, pw.clone().sub(o0).dot(ax)); const below = new THREE.Vector3(0, 0, -1).transformDirection(g.matrixWorld).multiplyScalar(0.012 * (L / 0.2)); tg.add(on.add(below).sub(pw)); ikArm(null, A, F, Hd, tg, s0.clone().addScaledVector(rtv, sx * L).addScaledVector(dn, L)); Hd.updateWorldMatrix(true, true); } } /* (each closed fist, not its wrist, on the wood: the right round the wrist of the stock, the left round the fore-end; the palm's own middle is moved onto the gun, a touch under it) */ }
      g.parent.updateWorldMatrix(true, false); }
    g.position.copy(g.parent.worldToLocal(want.clone())); g.quaternion.copy(g.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q)); ud.aimed = true;
  }
  // Skyrim-style: weapons away on your back, or back in your hands (any attack, ability, block or hit draws them)
  sheatheWeapons() { return; /* (weapons always stay drawn) */ if (this.sheathed || this.atk || this.dodge || !this.weapon) return; this.sheathed = true; this.press = null; this.block = false; sheathe(this.ch, true); this.vmShow(false); S.swap && S.swap(); this.drawAnimT = 0.35; }
  drawWeapons() { if (!this.sheathed) return false; this.sheathed = false; sheathe(this.ch, false); this.vmShow(true); S.swap && S.swap(); this.drawAnimT = 0.35; this.swapT = 0.3; return true; }
  vmShow(on) { const w = this.vm && this.vm.weapons; if (this.vm) this.vm.hiddenAll = !on; if (w) for (const k in w) if (w[k]) w[k].visible = on; }
  // health regeneration over time (warriors never heal instantly): frac of max health over dur seconds, stacking onto any running regen
  regenK() { return 1 + Game.fxCount(this.h, 'heal') * 0.1 + Game.fxCount(this.h, 'u_sup') * 0.25; } // your own regeneration (not class healing power)
  addRegen(frac, dur) { const per = this.maxHp * frac * this.regenK() / dur; if (this.regen && this.regen.t > 0) { const left = this.regen.per * this.regen.t; this.regen = { per: (left + per * dur) / Math.max(dur, this.regen.t), t: Math.max(dur, this.regen.t) }; } else this.regen = { per, t: dur }; }
  // necromancer siphons: a green stream from the target to you, and what you drink becomes yours
  sapFx(a, t) {
    const from = t.pos.clone().setY(t.pos.y + (t.height || 1.6) * 0.6);
    for (let i = 0; i < 6; i++) setTimeout(() => { if (this.dead) return; const k = i / 6, p = from.clone().lerp(this.pos.clone().setY(this.pos.y + 1.2), k); V.burst(a.sap === 'mana' ? 'arcane' : 'heal', p, 6, { speed: 0.6, size: 0.45 }); }, i * 60);
    V.light(from, '#60ff80', 5, 0.4);
    if (a.sap === 'strength') { t.hexUntil = G.time + 10; this.buffs.cry = Math.max(this.buffs.cry || 0, 10); this.buffFx('Strength siphoned', '#60ff80'); }
    else if (a.sap === 'speed') { t.status.slow = Math.max(t.status.slow || 0, 8); this.buffs.swind = Math.max(this.buffs.swind || 0, 8); this.buffs.focus = Math.max(this.buffs.focus || 0, 6); this.buffFx('Speed siphoned', '#60ff80'); }
    else if (a.sap === 'mana') { const got = Math.round(this.maxMana * 0.25); this.mana = Math.min(this.maxMana, this.mana + got); V.number(this.pos.clone().setY(this.pos.y + this.eye + 0.4), '+' + got + ' mana', 'heal', '#8ac8ff'); this.buffFx('Mana siphoned', '#8ac8ff'); }
    S.cast && S.cast('arcane', this.pos, 0.5);
  }
  // EverQuest-style buffs: real stats (or haste, run speed, mana regen) for 2 minutes; casting it again refreshes it
  eqBuff(a) {
    const h = this.h, L = h.level, v = {}; for (const [k, [b, per]] of Object.entries(a.eq)) v[k] = Math.round(b + per * L);
    const NM = { ac: 'Armour', str: 'Strength', int: 'Intellect', sta: 'Stamina', haste: '% attack speed', run: '% run speed', mregen: ' mana/s' };
    h.sb = h.sb || {}; h.sb[a.id] = Object.assign({ t: a.dur || 120, name: a.name, text: Object.entries(v).map(([k, n]) => k === 'haste' || k === 'run' || k === 'mregen' ? `+${n}${NM[k]}` : `+${n} ${NM[k]}`).join(', ') }, v);
    this.refreshStatsOnly(); this.buffFx(a.name + ' · ' + h.sb[a.id].text, '#ffd84a'); V.sphereFlash(this.pos.clone().setY(this.pos.y + 1), 1.8, '#ffe0a0', 0.5); S.cast('arcane', this.pos, 0.7);
  }
  sbSum(k) { let n = 0; const sb = this.h.sb; if (sb) for (const id in sb) n += sb[id][k] || 0; return n; }
  // regeneration from an avatar transformation
  avatarTick(dt) { if (this.buffs.avatar > 0 && this.avatar && this.avatar.regen && !this.dead) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * this.avatar.regen * dt); }
  // the wizard's forms: the body burns, freezes or crackles in the form's colour while it lasts; Ice Block wraps you in ice
  formTick(dt) {
    if (this.formCh !== this.ch) { this.formCh = this.ch; this.formOn = null; } // new gear rebuilt the body: tint it again
    if (B_AV(this)) FORMS.avatar = { name: this.avatar.name, col: this.avatar.col || '#ffffff', k: 0.8, mote: this.avatar.mote || 'gold', el: 'arcane' };
    const B = this.buffs, f = B.avatar > 0 ? 'avatar' : B.formFire > 0 ? 'formFire' : B.formFrost > 0 ? 'formFrost' : B.formArcane > 0 ? 'formArcane' : B.formVoid > 0 ? 'formVoid' : B.formTime > 0 ? 'formTime' : B.iceblock > 0 ? 'iceblock' : null;
    if (f !== (this.formOn || null)) { this.formOn = f; const F = f && FORMS[f];
      if (this.ch && this.ch.root) this.ch.root.traverse(o => { if (!o.isMesh || !o.material || !o.material.emissive) return; if (!o.userData.em0) o.userData.em0 = [o.material.emissive.getHex(), o.material.emissiveIntensity];
        if (F) { if (!o.userData.formMat) { o.material = o.material.clone(); o.userData.formMat = true; } o.material.emissive.set(F.col); o.material.emissiveIntensity = F.k; } else { o.material.emissive.setHex(o.userData.em0[0]); o.material.emissiveIntensity = o.userData.em0[1]; } });
      if (F) { V.sphereFlash(this.pos.clone().setY(this.pos.y + 1), 2.8, F.col, 0.6); V.burst(F.mote, this.pos.clone().setY(this.pos.y + 1), 60, { speed: 5 }); V.addShake(0.35); S.cast(F.el, this.pos, 1.5); if (f !== 'iceblock') G.hooks.toast && G.hooks.toast(F.name, '✦', 'gold'); } }
    if (f && Math.random() < dt * 24) { const F = FORMS[f]; V.emit(F.mote, this.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.9, 0.2 + Math.random() * 1.8, (Math.random() - 0.5) * 0.9)), { speed: 0.4, vy: f === 'iceblock' ? 0.2 : 1.6, size: 0.35, life: 0.7 }); }
  }
  // Lich Lord: become a skeleton with burning green eyes and a long cape while the buff lasts
  lichTick(dt) {
    const on = (this.buffs.lich || 0) > 0;
    if (on !== !!this.lichForm) { this.lichForm = on; this.refreshGear(); V.sphereFlash(this.pos.clone().setY(this.pos.y + 1), 2.6, '#40ff60', 0.6); V.burst('shadow', this.pos.clone().setY(this.pos.y + 1), 50, { speed: 4 }); V.burst('heal', this.pos.clone().setY(this.pos.y + 1.6), 30, { speed: 3 }); S.roar && S.roar(this.pos); V.addShake(0.4); }
    if (on && this.ch && this.ch.lichCape) { const c = this.ch.lichCape, sp = Math.hypot(this.vel.x, this.vel.z); c.rotation.x = 0.15 + Math.min(0.9, sp * 0.1) + Math.sin(G.time * 3) * 0.06; }
    if (on && Math.random() < dt * 10) V.emit('heal', this.pos.clone().setY(this.pos.y + 0.2 + Math.random() * 1.8), { speed: 0.3, vy: 0.6, size: 0.3, life: 0.8 });
  }
  // EverQuest-style skills: practise the weapon skill, then maybe a Double Attack (main hand) and a Dual Wield swing (off hand)
  meleeExtras(a, t, base, st) {
    const h = this.h, wt = this.weapon && this.weapon.wt; Skills.practise(h, Skills.skillOf(wt));
    if (a.name === 'heavy' || a.held || t.dead) return;
    const swing = (delay, hand, dmg, label) => setTimeout(() => { if (this.dead || t.dead) return; this.dealDamage(t, dmg, { melee: true, offhand: hand === 'off' }); S.swingW('light', 0.9, this.pos); V.number(t.pos.clone().setY(t.pos.y + (t.height || 1.6) + 0.5), label, 'miss'); this.atk = { name: hand === 'off' ? 'off1' : 'swing2', t: 0.25, dur: 0.22, hit: true, noQueue: true, extra: true }; }, delay);
    if (Skills.skillCapOf(h, 'double') > 0) Skills.practise(h, 'double'); // every swing is practice
    if (false && Skills.DOUBLE_CLASSES.has(h.cls) && Math.random() < Skills.doubleChance(h, this.D.stats.str)) { // (no random double/triple attacks: each click is one hit) swing(140, 'main', base * (st.m || 1), 'Double attack');
      if (Skills.TRIPLE_CLASSES.has(h.cls) && Skills.skillCapOf(h, 'triple') > 0 && (Skills.practise(h, 'triple'), Math.random() < Skills.tripleChance(h, this.D.stats.str))) { swing(280, 'main', base * (st.m || 1), 'Triple attack'); } }
    if (Skills.canDual(h)) { const w2 = h.equip.w2; Skills.practise(h, 'dual'); if (Math.random() < Skills.dualChance(h, this.D.stats.dex)) { swing(360, 'off', weaponDamage(h, w2) * 0.75, 'Off hand'); Skills.practise(h, Skills.skillOf(w2.wt)); } }
  }
  // spellcasting look: the colour of your magic, gathering light at both raised hands, motes spiralling up around you, a ring at your feet
  castCol() { const C = { priest: 'holy', bombardier: 'fire', necromancer: 'shadow', cleric: 'holy', paladin: 'holy', druid: 'nature', shaman: 'frost', elementalist: 'fire', enchanter: 'arcane', bard: 'holy', darkknight: 'shadow', ranger: 'nature', beastmaster: 'nature' }; return C[this.h.cls] || (this.W && this.W.element) || 'arcane'; }
  castFx(dt, k) {
    const col = this.castCol(), kind = { shadow: 'shadow', holy: 'gold', nature: 'heal', frost: 'frost', fire: 'fire', arcane: 'arcane' }[col] || 'arcane', hex = { shadow: '#70ff90', holy: '#ffe080', nature: '#80ff90', frost: '#8ad8ff', fire: '#ff9040', arcane: '#c080ff' }[col] || '#c080ff';
    const third = this.camDist >= 0.6, top = this.pos.clone().setY(this.pos.y + this.eye + 0.45);
    if (Math.random() < dt * 40) { for (const hp of third ? [top.clone().addScaledVector(this.right(), 0.28), top.clone().addScaledVector(this.right(), -0.28)] : [this.handPos(), this.handPos(true)]) V.emit(kind, hp, { speed: 0.4, vy: 0.5, size: 0.28 + k * 0.25, life: 0.45 }); }
    if (Math.random() < dt * 25) { const a = G.time * 6 + Math.random() * 6.28, r = 0.9 - k * 0.4; V.emit(kind, this.pos.clone().add(new THREE.Vector3(Math.cos(a) * r, 0.2 + Math.random() * 1.8 * k, Math.sin(a) * r)), { speed: 0.2, vy: 1.4, size: 0.3, life: 0.8 }); }
    this.castRingT = (this.castRingT || 0) - dt; if (this.castRingT <= 0) { this.castRingT = 0.45; V.ring(this.pos, 1.4 + k * 0.6, hex, 0.5); }
    if (Math.random() < dt * 6) V.light(third ? top : this.handPos(), hex, 2 + k * 4, 0.2, 6);
  }
  castBurst() { const col = this.castCol(), hex = { shadow: '#70ff90', holy: '#ffe080', nature: '#80ff90', frost: '#8ad8ff', fire: '#ff9040', arcane: '#c080ff' }[col] || '#c080ff', at = this.spellFrom();
    S.castRelease(col); V.sphereFlash(at, 1.1, hex, 0.3); V.light(at, hex, 8, 0.35); V.burst({ shadow: 'shadow', holy: 'gold', nature: 'heal', frost: 'frost', fire: 'fire', arcane: 'arcane' }[col] || 'arcane', at, 30, { speed: 4 }); this.atk = { name: 'castRel', t: 0, dur: 0.5, hit: true, noQueue: true }; }
  // talents that fire when you kill something
  onKillPerks(mob) {
    if (this.pk('bloodlust')) { this.addRegen(0.05, 4); V.burst('blood', this.pos.clone().setY(this.pos.y + 1), 10, { speed: 2, vy: 1 }); }
    if (this.pk('momentum')) { const i = ABILITIES[this.h.cls].findIndex(a => a.id === 'charge'); if (i >= 0 && this.cd['a' + (i + 1)] > 0) { this.cd['a' + (i + 1)] = 0; V.number(this.pos.clone().setY(this.pos.y + this.eye + 0.4), 'Charge ready!', 'crit'); } }
  }
  // first person: a boot snaps out from below the view and back (third person shows the leg kicking)
  kickFx() {
    const boot = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: '#4a3420', roughness: 0.85 });
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.5), mat); shin.position.z = -0.25; boot.add(shin);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.3), new THREE.MeshStandardMaterial({ color: '#2a1c10', roughness: 0.8 })); foot.position.set(0, -0.02, 0.08); boot.add(foot);
    V.temp(boot, 0.42, (b, t) => { if (this.camDist > 0.6) { b.visible = false; return; } const ext = t < 0.35 ? easeOut(t / 0.35) : 1 - ease((t - 0.35) / 0.65), fw = this.fwd();
      b.position.copy(this.pos).addScaledVector(fw, 0.25 + ext * 0.75).addScaledVector(this.right(), 0.12); b.position.y += 0.75 + ext * 0.35; b.rotation.set(-0.3 + ext * 0.2, this.yaw, 0); if (t >= 0.99) b.traverse(o => o.geometry && o.geometry.dispose()); });
  }
  // a see-through shell around you while a guard buff lasts
  domeFx(dur, col, op = 0.12) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1.25, 28, 18), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    V.temp(m, dur, (mm, t) => { m.position.copy(this.pos); m.position.y += 1; m.visible = this.camDist > 0.6; const pulse = 1 + Math.sin(t * dur * 6) * 0.03; m.scale.set(pulse, 1.25 * pulse, pulse); m.material.opacity = op * (t > 0.85 ? (1 - t) / 0.15 : 1) * (0.8 + 0.2 * Math.sin(t * dur * 4)); if (t >= 0.99) { m.geometry.dispose(); m.material.dispose(); } });
  }
  // a column of light rising out of the ground around you
  pillarFx(col) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 6, 24, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    V.temp(m, 0.9, (mm, t) => { m.position.copy(this.pos); m.position.y += 3 * Math.min(1, t * 3); m.scale.set(1 + t * 0.4, Math.min(1, t * 3), 1 + t * 0.4); m.material.opacity = 0.5 * (1 - t); if (t >= 0.99) { m.geometry.dispose(); m.material.dispose(); } });
  }
  buffFx(name, col) {
    V.number(this.pos.clone().setY(this.pos.y + this.eye + 0.5), name, 'heal');
    let e = document.getElementById('buffflash'); if (!e) { e = document.createElement('div'); e.id = 'buffflash'; document.body.appendChild(e); }
    e.style.setProperty('--c', col); e.classList.remove('on'); void e.offsetWidth; e.classList.add('on');
  }
  // Battle Shout: streams of red pour out of his mouth for the length of the roar, a cone of crimson breath spraying forward and fading
  roarStreams() { const RED = [new THREE.Color('#ff3020'), new THREE.Color('#5a0404')], HOT = [new THREE.Color('#ffd0b0'), new THREE.Color('#d01010')]; let t = 0;
    G.timers.push({ update: (dt) => { t += dt; if (t > 1.0 || this.dead) return true; const HM = this.ch && this.ch.heroModel, hd = HM && HM !== 'loading' && HM.bones && HM.bones.Head;
      const f = hd ? new THREE.Vector3(0, 0, 1).applyQuaternion(HM.wrap.getWorldQuaternion(new THREE.Quaternion())).setY(0).normalize() : this.fwd(), m = hd ? hd.getWorldPosition(new THREE.Vector3()).addScaledVector(f, 0.22).add(new THREE.Vector3(0, -0.06, 0)) : this.pos.clone().setY(this.pos.y + this.eye * 0.92).addScaledVector(f, 0.3);
      const k = 1 - t, n = Math.round(14 * k + 4); for (let i = 0; i < n; i++) { const d = f.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.55, (Math.random() - 0.35) * 0.4, (Math.random() - 0.5) * 0.55)).normalize(), sp = 7 + Math.random() * 6;
        V.norm.spawn(m.x, m.y, m.z, d.x * sp, d.y * sp, d.z * sp, 0.45 + Math.random() * 0.25, 0.22 + Math.random() * 0.12, 0.6, RED[0], RED[1], 0.85 * k + 0.15, 0, 0, 2.5); if (i % 3 === 0) V.add.spawn(m.x, m.y, m.z, d.x * sp * 1.2, d.y * sp * 1.2, d.z * sp * 1.2, 0.3, 0.12, 0.3, HOT[0], HOT[1], 1, 0, 0, 2); }
      return false; } }); }
  // the berserker's axe throw: wind up, hurl (the axe leaves his hand), it spins out cutting everything in its path,
  // whirls back to him cutting again, and he hops to catch it
  tickAxe(dt) {
    if (!this._axeWarm && this.h.cls === 'berserker' && G.renderer && G.camera) { this._axeWarm = true; try { const tr = axeTrail(); G.renderer.compile(tr.mesh, G.camera, G.scene); const i = V.trails.indexOf(tr); if (i >= 0) V.trails.splice(i, 1); tr.mesh.parent && tr.mesh.parent.remove(tr.mesh); this._axeWarmMat = tr.mat; } catch (e) {} } /* (the streak's shader is built now, not in the middle of his first throw) */
    if (this.shoutT > 0) this.shoutT -= dt;
    if (this.axeCatch) { this.axeCatch.t += dt; if (this.axeCatch.t >= this.axeCatch.dur) this.axeCatch = null; }
    const T = this.axeThrow, w = this.ch && this.ch.weapons && this.ch.weapons.main;
    if (T) { T.t += dt; if (!T.thrown && T.t / T.dur >= 0.61) { T.thrown = true; if (w) { w.updateWorldMatrix(true, true); const fly = cloneLite(w), p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(); w.matrixWorld.decompose(p, q, sc); fly.position.copy(p); fly.scale.copy(sc); fly.visible = true; G.scene.add(fly); w.visible = false; /* (a light copy: the full clone copied the whole loaded axe model through JSON every throw, the pause the owner felt) */
          const dir = (() => { const ar = aimRay(60), at = ar.point.clone(); if (!ar.mob) at.y = Math.max(at.y, heightAt(at.x, at.z) + Math.max(1.3, (this.eye || 1.8) * 0.6)); const d = at.sub(p); if (d.lengthSq() < 1) return G.camera.getWorldDirection(new THREE.Vector3()); d.normalize(); d.y = Math.max(-0.4, Math.min(0.45, d.y)); return d.normalize(); })(); /* (it flies at the crosshair: whoever is under it (chest high), or chest high above the ground there (heroes are big: 1.1 m was their knees); the old line ran parallel to the camera from his hand, well below the crosshair, and into the dirt) */
          const flat = new THREE.Vector3(dir.x, 0, dir.z).normalize(); const axis = new THREE.Vector3(0, Math.cos(0.3), 0).addScaledVector(flat, -Math.sin(0.3)); { const hy = new THREE.Vector3(0, Math.sin(0.3), 0).addScaledVector(flat, Math.cos(0.3)); fly.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(hy, axis), hy, axis)); } /* (laid flat like a helicopter blade: haft level (its y), the blades' faces (its z) to the sky, tipped back 17 degrees so the camera behind sees the whirling disc, not a thin line) */
          const tr = axeTrail(); /* (its own solid blood-red streak: the shared trail is mostly white and additive, which washes out over grass) */
          this.axeOut = { fly, dir, pos: p.clone().addScaledVector(flat, 0.6 * sc.y), out: true, gone: 0, hitOut: new Set(), hitBack: new Set(), dmg: T.dmg, life: 0, tr, sc: sc.y, axis, spinA: 0 }; S.swingW && S.swingW('blade', 1.5, this.pos, this.weapon && this.weapon.wt, this.h.cls); } }
      if (T.t >= T.dur) this.axeThrow = null; }
    const A = this.axeOut; if (!A) return; if (w) w.visible = false; /* (every frame: animate() turns the hand weapon back on, so the axe looked to be in his hand and in the air at once) */ A.life += dt; const hand = this.handPos ? this.handPos() : this.pos.clone().setY(this.pos.y + 1.4);
    const endAxe = () => { G.scene.remove(A.fly); if (w) w.visible = true; this.axeOut = null; const tr = A.tr; tr.active = false; setTimeout(() => { const i = V.trails.indexOf(tr); if (i >= 0) V.trails.splice(i, 1); if (tr.mesh) { tr.mesh.parent && tr.mesh.parent.remove(tr.mesh); tr.mesh.geometry && tr.mesh.geometry.dispose(); } }, 600); };
    if (A.out) { const f = Math.min(1, A.gone / 24), st = (42 - 24 * f * f) * dt; A.pos.addScaledVector(A.dir, st); A.gone += st; const gy = heightAt(A.pos.x, A.pos.z); if (A.pos.y < gy + 0.35) { A.pos.y = gy + 0.35; A.out = false; A.backT = 0; V.burst('dust', A.pos.clone(), 14, { speed: 4, size: 0.6 }); S.hit && S.hit('metal', A.pos); } /* (it bites into the ground where you aimed low, and comes back) */ else if (A.gone >= 24 || A.life > 1.3) { A.out = false; A.backT = 0; } } /* (eases out to the turn: out to 24 m at up to 42 m/s, the owner wanted it further and faster) */
    else { A.backT = (A.backT || 0) + dt; const to = hand.clone().sub(A.pos), d = to.length(), sp = 14 + Math.min(1, A.backT / 0.3) * 30; if (!this.axeCatch && d / sp < 0.42 && !this.axeThrow && !(this.atk && this.atk.name === 'axethrow')) this.axeCatch = { t: 0, dur: 0.9 }; /* (the owner: back before his throw has finished, it simply returns to his hand, no hop to catch it) */ if (d < 1.0 || A.life > 4) { endAxe(); S.hit && S.hit('metal', this.pos); return; } A.pos.addScaledVector(to.divideScalar(d), Math.min(d, sp * dt)); } /* (and picks up speed on the way home) */
    A.spinA += dt * 22; A.fly.rotateOnWorldAxis(A.axis, dt * 22); /* (helicopter spin) */
    { const hd = new THREE.Vector3(0, 1, 0).applyQuaternion(A.fly.quaternion); A.fly.position.copy(A.pos).addScaledVector(hd, -0.6 * A.sc); /* (it whirls about its balance point up the haft, not the end of the handle) */
      const tip = A.pos.clone().addScaledVector(hd, 0.7 * A.sc); A.tr.active = true; A.tr.push(tip.clone().addScaledVector(A.axis, -0.12 * A.sc), tip.clone().addScaledVector(A.axis, 0.12 * A.sc)); } /* (a red band traced by the spinning head: it has height, so it shows from behind as a red swirl, not an edge-on sliver) */
    if (!A.sndT || G.time - A.sndT > 0.28) { A.sndT = G.time; S.swingW && S.swingW('blade', 0.7, A.pos, this.weapon && this.weapon.wt, this.h.cls); }
    const hits = A.out ? A.hitOut : A.hitBack; for (const m of mobsInRadius(A.pos, 1.9)) { if (hits.has(m) || m.dead || m === this) continue; hits.add(m); this.dealDamage(m, A.dmg * (A.out ? 1 : 0.7), { ranged: true, stun: A.out ? 1.2 : 0, knock: A.dir.clone().multiplyScalar(A.out ? 1.5 : -1) }); { const ip = m.pos.clone().setY(m.pos.y + (m.height || 1.6) * 0.6); V.sphereFlash && V.sphereFlash(ip, 0.7, '#ff3018', 0.2); V.burst('spark', ip, 18, { speed: 6 }); V.light && V.light(ip, '#ff4020', 5, 0.2, 6); } /* (impact) */ if (A.out) { A.out = false; V.addShake(0.2); S.hit && S.hit('metal', m.pos); } /* (a hit on the way out stuns, and the axe turns straight back) */ V.burst('blood', m.pos.clone().setY(m.pos.y + (m.height || 1.6) * 0.6), 16, { speed: 3 }); }
  }
  // summoning: hold still-ish for 3 s while the spell gathers at the spot, then the pets appear (dodging breaks it)
  tickSummon(dt) {
    const c = this.summonCast; c.t += dt;
    if (this.dead || this.dodge) { this.summonCast = null; G.hooks.castBar && G.hooks.castBar(null); if (!this.dead) G.hooks.toast && G.hooks.toast(`${c.name} was interrupted`, '✋', 'bad'); return; }
    G.hooks.castBar && G.hooks.castBar(c.name, c.t / c.dur); if (G.newFx) this.castFx(dt, c.t / c.dur);
    if (Math.random() < dt * 30) V.emit(c.pet === 'skeleton' ? 'bone' : 'shadow', c.at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.4, 0.1, (Math.random() - 0.5) * 2.4)), { speed: 1, vy: 2, size: 0.3, life: 0.8 });
    if (Math.random() < dt * 12) V.emit('arcane', this.handPos(), { speed: 0.6, size: 0.2, life: 0.5 });
    if (c.t < c.dur) return;
    this.summonCast = null; G.hooks.castBar && G.hooks.castBar(null); if (G.newFx) { Skills.practise(this.h, 'casting'); this.castBurst(); }
    const lv10 = 1 + (c.lv - 1) * 9 / (LEVEL_CAP - 1); // pets are built on the 1-10 scale
    if (BATTLE) { if (G.hooks.summonPet) G.hooks.summonPet(c.pet, c.at, c.lv, c.dur2, c.n, c.big); }
    else { summonPets(c.pet, c.at, lv10, c.dur2, c.n, c.big, c.spell);
      { const k = campTune(this.h.cls).dmg; if (k !== 1) for (const m of G.mobs) if (m.pet && !m.dead && m.spell === c.spell) m.pet = Object.assign({}, m.pet, { dmg: m.pet.dmg * k }); } // campaign balance applies to your pets too
      if (this.h.cls === 'elementalist') { const fx = (k) => c.pet === 'pureel' ? ['flameel', 'frostel', 'stormel'].reduce((t, e) => t + Game.fxCount(this.h, 'el_' + e + '_' + k) * 0.08, 0) : Game.fxCount(this.h, 'el_' + c.pet + '_' + k) * 0.15;
        for (const m of G.mobs) if (m.pet && !m.dead && m.spell === c.spell) { const hk = 1 + fx('hp'), dk = 1 + fx('dmg'); m.maxHp = m.hp = m.maxHp * hk; m.pet = Object.assign({}, m.pet, { dmg: m.pet.dmg * dk }); } } }
    S.cast('arcane', c.at, 1.2); V.burst(c.pet === 'skeleton' ? 'bone' : 'shadow', c.at.clone().setY(c.at.y + 0.5), 50, { speed: 4 }); V.ring(c.at, 2.4, '#d0a0ff', 0.5);
  }
  // Kingdom Battles staffs: hold left click to pour out the staff's element
  // fire: a flamethrower cone that sets enemies burning; frost: an icy cone that slows, then freezes whatever stays in it;
  // arcane: a crackling beam that pierces everything in a line
  tickChannel(dt) {
    const c = this.channel, W = this.W;
    if (!c || !W || W.kind !== 'staff' || this.dead || this.block || this.dodge || G.uiOpen) { if (c) { c.on = false; if (c.snd) { c.snd.stop(); c.snd = null; } } return; }
    c.t += dt; if (c.t < 0.3) return;
    const cost = this.h.arena ? 0 : (G.newFx ? 12 + (this.weapon.dmg || 9) * 0.6 : 16) * dt; if (this.mana < cost) /* campaign: a stronger staff pours out more power and burns more mana (about 17 a second for a driftwood staff, 60 for the best) */ { if (c.on) G.hooks.toast && G.hooks.toast('Out of mana', '💧', 'bad'); if (c.snd) c.snd.stop(); this.channel = null; return; }
    this.mana -= cost; this.manaUseT = 1; c.on = true; this.atk = null;
    const el = this.h.arena && this.h.cls === 'necromancer' ? 'poison' : (W.element || 'fire'), base = weaponDamage(this.h, this.weapon) * Game.perkPow(Game.perkLvl(this.h, 'L')); // (the necromancer's held staff sprays poison)
    const from = this.camDist < 0.6 ? G.camera.position.clone().add(new THREE.Vector3(0.1, -0.13, -1.25).applyQuaternion(G.camera.quaternion)) : (this.ch.weapons.main && this.ch.weapons.main.userData.tip ? this.ch.weapons.main.userData.tip.getWorldPosition(new THREE.Vector3()) : this.handPos());
    const dir = this.aimDir(from);
    if (!c.snd) { c.snd = S.spellLoop(el === 'poison' ? 'frost' : el); }
    const range = el === 'arcane' ? 20 : el === 'frost' ? 9 : el === 'poison' ? 7.5 : 8.5;
    // what it looks like: a dense stream leaving the staff's tip and widening as it goes
    const f0 = from.clone().addScaledVector(dir, 0.5);
    if (el === 'fire') { V.burst('ember', f0, 4, { dir, speed: 13, up: 0.2, size: 0.12, size1: 0.9, life: 0.5, a0: 0.75 }); V.burst('fire', f0.clone().addScaledVector(dir, 1.2), 2, { dir, speed: 12, up: 0.25, size: 0.3, size1: 1.1, life: 0.4, a0: 0.55 }); V.burst('ember', f0, 1, { dir, speed: 10, up: 0.5, size: 0.05, size1: 0.02, life: 0.8 }); if (Math.random() < 0.35) V.burst('smoke', from.clone().addScaledVector(dir, range * 0.8), 1, { speed: 1, size: 1.2, size1: 2.2, life: 1, vy: 1.2, a0: 0.4 }); }
    else if (el === 'poison') { V.burst('poison', f0, 6, { dir, speed: 11, up: 0.25, size: 0.15, size1: 0.9, life: 0.55, a0: 0.7, grav: 3 }); V.burst('leaf', f0, 2, { dir, speed: 9, up: 0.3, size: 0.2, life: 0.5 }); if (Math.random() < 0.5) V.burst('shadow', f0.clone().addScaledVector(dir, 2), 1, { dir, speed: 6, size: 0.6, size1: 1.4, life: 0.6, a0: 0.4 }); }
    else if (el === 'frost') { V.burst('frost', f0, 4, { dir, speed: 12, up: 0.2, size: 0.12, size1: 0.9, life: 0.55, a0: 0.6 }); if (Math.random() < 0.5) V.burst('cotton', from, 2, { dir, speed: 10, up: 0.2, size: 0.06, size1: 0.04, life: 0.8 }); }
    else { for (let k = 0; k < 16; k++) { const q = from.clone().addScaledVector(dir, (k + Math.random()) / 16 * range); V.burst('arcane', q, 1, { speed: 0.4, size: 0.32, size1: 0.05, life: 0.12 }); } V.burst('arcane', from, 3, { speed: 2, size: 0.3, size1: 0.0, life: 0.2 }); }
    if ((c.lt = (c.lt || 0) - dt) <= 0) { c.lt = 0.12; V.light(from.clone().addScaledVector(dir, el === 'arcane' ? 4 : 3), el === 'frost' ? '#9ad8ff' : el === 'arcane' ? '#c080ff' : el === 'poison' ? '#70ff40' : '#ff7a20', 2.2, 0.16, 12); }
    // what it does: damage ticks
    if ((c.tick -= dt) > 0) return; c.tick = 0.15;
    const hits = el === 'arcane'
      ? G.mobs.filter(m => !m.dead && foe(m) && (() => { const v = m.pos.clone().setY(m.pos.y + (m.height || 1.6) * 0.5).sub(from), t = v.dot(dir); return t > 0 && t < range && v.addScaledVector(dir, -t).length() < (m.radius || 0.5) + 0.6; })()).sort((x, y) => x.pos.distanceToSquared(from) - y.pos.distanceToSquared(from)).slice(0, G.newFx ? 1 : 99) // campaign: the arcane beam hits one target, no area
      : mobsInCone(this.pos, this.yaw, range, 0.55);
    for (const m of hits) {
      if (el === 'poison') this.dealDamage(m, base * 0.2, { el: 'arcane', poison: base * 0.3, spread: 2, silent: true });
      else if (el === 'fire') this.dealDamage(m, base * 0.32, { el: 'fire', burn: base * 0.06, silent: true });
      else if (el === 'frost') { m.chill = (m.chill || 0) + 0.15; this.dealDamage(m, base * 0.26, { el: 'frost', slow: 2, freeze: m.chill > 1.5 ? 1.2 : 0, silent: true }); if (m.chill > 1.5) m.chill = 0; }
      else this.dealDamage(m, base * (G.newFx ? 0.48 : 0.36), { el: 'arcane', silent: true }); // single target in the campaign, so a little harder
    }
  }
  // Kingdom Battles ranger traps: spike pits and frost runes, sprung by any enemy (troops too)
  battleTrap(pos, kind, dmg, up) {
    pos.y = heightAt(pos.x, pos.z);
    const g = new THREE.Group();
    if (kind === 'spike') { const board = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.06, 12), new THREE.MeshStandardMaterial({ color: '#4a3420', roughness: 0.9 })); g.add(board); for (let k = 0; k < 10; k++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.32, 4), new THREE.MeshStandardMaterial({ color: '#8a6a44' })); const a2 = k / 10 * Math.PI * 2, r = k % 2 ? 0.55 : 0.3; sp.position.set(Math.cos(a2) * r, 0.16, Math.sin(a2) * r); g.add(sp); } }
    else { const rune = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.9, 6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: kind === 'poison' ? '#6ad04a' : '#8ae0ff', transparent: true, opacity: 0.85, side: THREE.DoubleSide })); rune.position.y = 0.05; g.add(rune); const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), new THREE.MeshStandardMaterial({ color: '#c8f4ff', emissive: '#40b8ff', emissiveIntensity: 1.2 })); c.position.y = 0.35; g.add(c); }
    g.position.copy(pos); g.position.y += 0.03; G.scene.add(g);
    (this.traps = this.traps || []).push(g); if (this.traps.length > 6) G.scene.remove(this.traps.shift());
    let t = 0; const me = this;
    G.timers.push({ update(dt) { t += dt; if (!g.parent) return true; if (t > 90) { G.scene.remove(g); return true; } if (kind === 'frost') g.children[1].rotation.y += dt * 2; if (t < 0.6) return false;
      const m = G.mobs.find(o => !o.dead && !o.isStruct && foe(o) && Math.hypot(o.pos.x - pos.x, o.pos.z - pos.z) < 1.3 + o.radius); if (!m) return false;
      if (kind === 'spike') { const r = 3.5 * Math.sqrt(up); for (const o of mobsInRadius(pos, r)) { if (o.isStruct) continue; me.dealDamage(o, dmg, { bleed: dmg * 0.12, slow: 3 }); o.status.bleed = 6; } V.burst('wood', pos.clone().setY(pos.y + 0.4), 30, { speed: 6, grav: 12, size: 0.3 }); V.burst('blood', pos.clone().setY(pos.y + 0.8), 25, { speed: 5 }); V.ring(pos, r, '#c8a070', 0.4); S.hit('flesh', pos, 1.5); }
      else if (kind === 'poison') { const r = 4 * Math.sqrt(up); for (const o of mobsInRadius(pos, r)) { if (o.isStruct) continue; me.dealDamage(o, dmg, { bleed: dmg * 0.35, slow: 2 }); o.status.bleed = 8; } V.burst('leaf', pos.clone().setY(pos.y + 0.8), 60, { speed: 4, size: 0.7, life: 1.6 }); V.ring(pos, r, '#6ad04a', 0.8); }
      else { const r = 4.5 * Math.sqrt(up); for (const o of mobsInRadius(pos, r)) { if (o.isStruct) continue; me.dealDamage(o, dmg, { el: 'frost', freeze: 1.8, slow: 5 }); } V.burst('frost', pos.clone().setY(pos.y + 0.6), 70, { speed: 7, size: 0.6 }); V.ring(pos, r, '#80d8ff', 0.6); V.sphereFlash(pos.clone().setY(pos.y + 0.8), r * 0.6, '#a8e8ff', 0.4); S.cast('frost', pos, 1.4); }
      V.addShake(0.2); G.scene.remove(g); return true; } });
  }
  placeTrap(pos, fire, dmg, up) {
    pos.y = heightAt(pos.x, pos.z);
    const g = new THREE.Group(); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.06, 6, 16).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#8a8a90', metalness: 0.8, roughness: 0.3 })); g.add(ring);
    for (let k = 0; k < 8; k++) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.18, 4), ring.material); const a2 = k / 8 * Math.PI * 2; t.position.set(Math.cos(a2) * 0.45, 0.08, Math.sin(a2) * 0.45); g.add(t); }
    if (fire) { const keg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 10), new THREE.MeshStandardMaterial({ color: '#7a3a1a', emissive: '#ff3a00', emissiveIntensity: 0.4 })); keg.position.y = 0.15; g.add(keg); }
    g.position.copy(pos); g.position.y += 0.03; G.scene.add(g);
    let t = 0; const me = this;
    G.timers.push({ update(dt) { t += dt; if (t > 60) { G.scene.remove(g); return true; } if (t < 0.6) return false; const m = G.mobs.find(o => !o.dead && foe(o) && Math.hypot(o.pos.x - pos.x, o.pos.z - pos.z) < 1.4 + o.radius); if (!m) return false;
      if (fire) { const r = 4.5 * (up > 1 ? 1.3 : 1); for (const o of mobsInRadius(pos, r)) me.dealDamage(o, dmg, { el: 'fire', burn: dmg * 0.08, knock: o.pos.clone().sub(pos).setY(0).normalize().multiplyScalar(7) }); V.burst('fire', pos, 70, { speed: 9, size: 0.8 }); V.ring(pos, r, '#ff8040', 0.5); S.explode(pos, 1.2); V.addShake(0.3); }
      else { me.dealDamage(m, dmg, { stun: 3 * up }); m.status.slow = 4; V.number(m.pos.clone().setY(m.pos.y + m.height + 0.6), 'Snared!', 'bad'); S.block(false, pos); }
      G.scene.remove(g); return true; } });
    G.hooks.toast && G.hooks.toast(fire ? 'Explosive trap set' : 'Snare trap set', '⚙');
  }
  dealDamage(m, dmg, o = {}) {
    if (m.dead) return;
    if (this.transcendT > 0) dmg *= 1.5; // (Arcane Ascension)
    if (this.bearT > G.time) dmg *= 1.5; // (Bear Form)
    if (this.buffs.warsong > 0) dmg *= 1.25; // (War Song)
    if (this.bannerT > G.time) dmg *= 1.2; // (Warlord's Banner)
    if (this.h.arena) [dmg, o] = Game.arenaOut(this, this.h, m, dmg, o); // (arena perk passives)
    if (G.battleFx && this.stealth > 0 && !o.silent) this.stealth = 0;
    /* (no per-class damage scaling: Kingdom Battles uses the campaign abilities now) */
    dmg *= campTune(this.h.cls).dmg;
    // campaign: every creature has physical and magical defence that grows with its level (spells and elements check magical)
    if (G.newFx && !m.dummy && !m.pet && !m.arenaBot && !m.botPet && m.lv) dmg *= 1 - mobDefense(m, this.h.level, !!o.el); /* (arena fighters use their own armour) */
    if (this.buffs.poisonW > 0 && !o.silent && this.W && this.W.kind !== 'staff' && (o.melee || o.ranged)) { o = Object.assign({}, o, { bleed: (o.bleed || 0) + dmg * 0.18 }); if (Math.random() < 0.5) V.burst('leaf', m.pos.clone().setY(m.pos.y + (m.height || 1.6) * 0.6), 8, { speed: 2 }); }
    if (this.buffs.flame > 0 && !o.silent && !o.proc && (o.melee || o.basic)) { const fb = dmg * 0.25; dmg += fb; o = Object.assign({}, o, { burn: (o.burn || 0) + dmg * 0.4 }); { const hp = m.pos.clone().setY(m.pos.y + (m.height || 1.6) * 0.6); V.burst('fire', hp, 34, { speed: 4.5, size: 0.8, size1: 0.1, life: 0.55 }); V.burst('ember', hp, 22, { speed: 6, life: 0.8 }); V.light && V.light(hp, '#ff3010', 6, 0.25, 6); V.sphereFlash && V.sphereFlash(hp, 0.55, '#ff3010', 0.18); } /* (a hot red flash where the blade bites; the fire damage counts in the hit's own number) */  } /* (Flame Blade: a quarter more damage as fire on the hit, then a burn of 40% more over 4 s) */
    if (this.buffs.leech > 0) this.heal(dmg * 0.06 * this.hk());
    let crit = Math.random() < this.D.crit + (this.pk('keen') ? 0.08 : 0) + Game.fxCount(this.h, 'crit') * 0.05;
    if (this.buffs.nextCrit && !o.silent) { crit = true; this.buffs.nextCrit = false; dmg *= 2; this.stealth = 0; }
    if (this.h.cls === 'ranger' && this.pk('cap') && m.hp >= m.maxHp) crit = true;
    if (o.critBonus && Math.random() < o.critBonus) crit = true;
    if (o.forceCrit) crit = true; // (a cast out of Phase Shift: always a crit)
    if (this.buffs.focus > 0 && this.h.cls !== 'ranger' && Math.random() < 0.1) crit = true;
    if (crit) dmg *= 1.75;
    const arm = m.def.armor || 0; if (arm && !o.el) { if (o.blunt) { if (Math.random() < 0.3) V.number(m.pos.clone().setY(m.pos.y + m.height + 0.7), 'Crush!', 'crit'); } else dmg *= 1 - arm; }
    if (this.wp('exec') && m.hp < m.maxHp * 0.35) dmg *= 1.3;
    if (this.h.cls === 'warrior' && this.pk('cap')) dmg *= this.hp < this.maxHp * 0.5 ? 1.32 : 1.1;
    if (this.buffs.cry > 0) dmg *= 1.3;
    if (this.buffs.bWar > 0) dmg *= this.pk('cmd') ? 1.3 : 1.2;
    if (this.buffs.lich > 0) dmg *= 1.4;
    if (this.buffs.formFire > 0) { dmg *= 1.4; if (!o.silent) o = Object.assign({}, o, { burn: (o.burn || 0) + dmg * 0.15 }); }
    if (this.buffs.formFrost > 0) { dmg *= 1.3; if (!o.silent) o = Object.assign({}, o, { slow: Math.max(o.slow || 0, 2) }); }
    if (this.buffs.formArcane > 0) dmg *= 1.35;
    if (this.buffs.formVoid > 0) { dmg *= 1.4; if (!o.silent) o = Object.assign({}, o, { slow: Math.max(o.slow || 0, 1.5) }); }
    if (this.buffs.formTime > 0) dmg *= 1.3;
    if (this.buffs.avatar > 0 && this.avatar) { if (this.avatar.dmg) dmg *= this.avatar.dmg; if (this.avatar.leech && !o.silent) this.heal(dmg * this.avatar.leech, true); }
    if (this.buffs.power > 0 && (o.el || !(o.melee || o.ranged))) dmg *= 1.25; // Aria of Power: spells
    if (G.newFx && CASTER_K[this.h.cls]) dmg *= CASTER_K[this.h.cls];
    { const n = Game.fxCount(this.h, 'dmg'), u = Game.fxCount(this.h, 'u_dmg'); if (n || u) dmg *= 1 + n * 0.06 + u * 0.12; if (u && crit) dmg *= 1.2; }
    if (this.buffs.fury > 0) dmg *= 1.25;
    if (this.buffs.rage > 0) dmg *= 1.15;
    if (this.h.cls === 'berserker' && this.pk('reckless')) dmg *= 1.1;
    if (this.buffs.adren > 0) dmg *= 1.2;
    if (this.buffs.surge > 0) dmg *= 1.2;
    if (this.h.cls === 'ranger' && this.pk('poison') && !o.silent) o.bleed = Math.max(o.bleed || 0, dmg * 0.06);
    if (o.el === 'fire' && o.burn && this.pk('ignite')) o.burn *= 2;
    if (o.el === 'frost' && this.pk('frostbite')) { if (o.slow) o.slow *= 2; if (o.freeze) o.freeze += 1; }
    const W = this.W, rank = W && W.hands === 'dual' ? dualRank(this.h.dualKills) : 0;
    if (o.offhand && rank >= 3) o.bleed = dmg * 0.08;
    let total = m.takeHit(dmg * rand(0.92, 1.08), this, o);
    if (G.battleFx && !o.proc && !o.silent && (o.melee || o.ranged || o.el) && !m.dead) this.tryProc(m);
    if (o.melee && rank >= 7 && Math.random() < 0.15 && !m.dead) { total += m.takeHit(dmg * 0.6, this, { silent: true }); V.number(m.pos.clone().setY(m.pos.y + m.height + 0.3), 'Double!', 'crit'); }
    if (o.melee && rank >= 5) this.end = Math.min(this.maxEnd, this.end + 3);
    if (this.buffs.fury > 0) this.heal(total * (0.1 + this.pk('a3up') * 0.05) * this.hk(), true);
    if (this.wp('leech')) this.heal(total * 0.04 * this.hk(), true);
    if (this.buffs.rage > 0) this.heal(total * 0.15 * this.hk(), true);
    const np = m.pos.clone(); np.y += m.height + 0.2;
    if (!o.silent || o.el) V.number(np, crit ? total + '!' : total, crit ? 'crit' : o.el === 'fire' ? 'fire' : o.el === 'frost' ? 'frost' : 'dmg', EL_COL[o.tint || o.el]); // elemental hits in their element's colour
    if (crit) { V.burst('spark', np, 12, { speed: 5 }); }
    if (o.melee && W && W.kind === 'melee') { V.burst('spark', np.clone().setY(np.y - m.height * 0.4), 4, { speed: 4, size: 0.12 }); }
    G.inCombat = 6; G.target = m; this.hitT = G.time;
    this.stealth = 0;
    if (this.h.arena && total > 0) { if (this.h.arenaUlt) this.h.ultCharge = Math.min(100, (this.h.ultCharge || 0) + total / 40 * (G.hooks.ultRate ? G.hooks.ultRate(this.h) : 1)); this.hitMarker(m.dead, crit, o.melee); const ls = Game.arenaStat(this.h, 'lifesteal'); if (ls) this.heal(total * 0.03 * ls, true); }
  }
  // the arena: an X flashes on the crosshair whenever you land a hit (red and bigger on a kill), with a crisp tick and,
  // up close, a split-second of hit-stop so every blow connects
  hitMarker(kill, crit, melee) {
    let e = document.getElementById('hitmk'); if (!e) { e = document.createElement('div'); e.id = 'hitmk'; e.innerHTML = '<i></i><i></i><i></i><i></i>'; document.body.appendChild(e); }
    e.className = ''; void e.offsetWidth; e.className = kill ? 'kill' : crit ? 'crit' : 'on';
    if (S.hitTick) S.hitTick(kill, crit); if (melee) G.hitstop = Math.max(G.hitstop || 0, kill ? 0.09 : 0.045);
    if (kill) { V.addShake(0.25); this.fovKick = Math.max(this.fovKick, 3); }
  }
  // rare, epic and legendary weapons: a small chance per weapon hit (better with Dexterity) to set off their proc
  tryProc(m) { if (this.h.arena) return; /* (arena and yard: no weapon procs, only abilities add fire, frost or poison) */
    const w = this.weapon; if (!w || w.rarity < 2) return; ensureProc(w);
    if (G.time < (this.procT || 0) || Math.random() >= procChance(w.rarity, this.D.stats.dex)) return;
    this.procT = G.time + 2;
    const P = PROCS[w.proc], base = weaponDamage(this.h, w) * (w.rarity >= 4 ? 0.75 : w.rarity >= 3 ? 0.65 : 0.55), at = m.pos.clone().setY(m.pos.y + (m.height || 1.6) * 0.6);
    V.number(at.clone().setY(at.y + 1.2), P.name + '!', 'crit', P.col); // the proc's name in its own colour (Frostbite is ice blue)
    switch (w.proc) {
      case 'flame': this.dealDamage(m, base * 0.7, { proc: true, el: 'fire', burn: base * 0.35 }); V.burst('fire', at, 26, { speed: 4, size: 0.6 }); S.cast && S.cast('fire', m.pos, 0.6); break;
      case 'frost': this.dealDamage(m, base * 0.55, { proc: true, el: 'frost', slow: 3 }); V.burst('frost', at, 24, { speed: 3.5, size: 0.5 }); break;
      case 'storm': { const hit = [m]; let from = this.pos.clone().setY(this.pos.y + 1.4), cur = m;
        for (let k = 0; k < 3 && cur; k++) { lightning(from, cur.pos.clone().setY(cur.pos.y + (cur.height || 1.6) * 0.6)); if (!cur.dead) this.dealDamage(cur, base * (k ? 0.4 : 0.55), { proc: true, el: 'arcane', tint: 'storm' }); from = cur.pos.clone().setY(cur.pos.y + 1); cur = mobsInRadius(cur.pos, 7).filter(x => !hit.includes(x)).sort((a, b) => a.pos.distanceTo(cur.pos) - b.pos.distanceTo(cur.pos))[0]; if (cur) hit.push(cur); }
        break; }
      case 'venom': this.dealDamage(m, base * 0.2, { proc: true, bleed: base * 0.12, tint: 'poison' }); V.burst('leaf', at, 18, { speed: 2.5 }); break;
      case 'crush': this.dealDamage(m, base * 0.5, { proc: true, stun: 1.1, blunt: true, big: true }); V.ring(m.pos, 1.6, '#ffe28a', 0.3); S.blunt && S.blunt(m.pos); break;
      case 'shadow': this.dealDamage(m, base * 0.85, { proc: true, el: 'arcane', tint: 'shadow' }); V.burst('shadow', at, 22, { speed: 3, size: 0.8, grav: 0 }); break;
    }
  }
  // the campaign: landing hits with a weapon trains it (see the Weapons tab, L)
  wpnXp(n) { return; if (BATTLE || !this.weapon) return; Game.gainMastery(this.h, familiesOf(this.weapon.wt)[0], n); }
  heal(n, quiet) { if (this.h.arena) n *= Game.arenaHealK(this.h); const before = this.hp; this.hp = Math.min(this.maxHp, this.hp + n); const d = Math.round(this.hp - before); if (d > 0 && !quiet) { V.number(this.pos.clone().setY(this.pos.y + this.eye + 0.4), '+' + d, 'heal'); V.burst('heal', this.pos.clone().setY(this.pos.y + 1), 20, { speed: 2, vy: 2, grav: -1 }); S.heal(); } }
  takeDamage(dmg, src, o = {}) {
    if (this.defBannerT > G.time) dmg *= 0.25; /* (the owner: inside the War Banner's ring you take 75% less damage) */
    if ((this.ultImmT || 0) > 0 && !this.dead) return 0; // (casting an ultimate: untouchable while it plays)
    if (this.bannerT > G.time) dmg *= 0.6; // (War Banner)
    if ((this.guardT || 0) > G.time) dmg *= 1 - (this.guardK || 0.3); // (the cleric's light shields and wings: less damage taken)
    dmg *= Game.arenaTakenK(this.h); if (this.h.arena) { dmg = Game.arenaIn(this, this.h, dmg, o); const th = Game.arenaPassive(this.h, 'thorns'); if (th && o.melee && src && src.arenaBot && !src.dead) { src.hp -= dmg * 0.08 * th; V.burst('spark', src.pos.clone().setY(src.pos.y + 1.1), 6, { speed: 3 }); if (src.hp <= 0) src.die(this); } } // (arena: tanks, toughness and passives)
    if (this.sheathed && !this.dead) this.drawWeapons(); this.hurtT0 = G.time;
    if (src && src.pos && !src.pet && src !== this) { this.lastHitBy = src; this.lastHitAt = G.time; } // (hurtT is a countdown used elsewhere)
    if (this.dead) return;
    if (this.iframes > 0 || (this.dodge && !this.dodge.charge)) { V.number(this.pos.clone().setY(this.pos.y + this.eye + 0.3), 'Dodged', 'miss'); return; }
    const front = src && src.pos ? Math.abs(angDiff(this.yaw, Math.atan2(src.pos.x - this.pos.x, src.pos.z - this.pos.z))) < 1.3 : true;
    // a timed block (raised just before the hit lands) deflects all of it, costs nothing and staggers the attacker
    const clerBlock = this.h.arena && ['cleric', 'warrior'].includes(this.h.cls || this.cls); // (the owner: the cleric's and the warrior's block takes 75% off every hit and costs a third of her endurance per hit; no perfect block)
    if (this.block && front && this.W && !clerBlock && G.time - (this.blockStart || -9) < 0.3) {
      S.block(this.W.hands === 'shield', this.pos); S.hit('metal', this.pos, 1.4); V.burst('spark', this.handPos(true), 30, { speed: 7 }); V.ring(this.pos, 1.6, '#ffe28a', 0.25); V.addShake(0.15); G.hitstop = 0.07;
      V.number(this.pos.clone().setY(this.pos.y + this.eye + 0.3), 'Perfect block!', 'crit');
      if (src && src.status && !src.remote && !src.isStruct) src.status.stun = Math.max(src.status.stun || 0, 0.9);
      return;
    }
    if (this.block && front && this.W) {
      const red = clerBlock ? 0.75 : Math.min(0.95, this.W.block + this.wp('block') * 0.1); const cost = clerBlock ? (this.maxEnd || 100) / 3 : dmg * 0.6 * (1 - this.wp('block') * 0.25);
      if (this.end >= cost * 0.5 || this.pk('unbreak') || this.buffs.fort > 0) { this.end = Math.max(0, this.end - cost); this.endUseT = 1; dmg *= 1 - red; S.block(this.W.hands === 'shield', this.pos); V.burst('spark', this.handPos(true), 14, { speed: 5 }); V.addShake(0.12); if (dmg < 1) return; }
      else { this.block = false; this.stagger = 0.8; V.number(this.pos.clone().setY(this.pos.y + this.eye), 'Guard broken!', 'bad'); S.hit('metal', this.pos); }
    }
    if (src && src.hexUntil > G.time) dmg *= 0.65; // a Shaman's Hex drains their strength
    // armour is measured against how strong the attacker really is
    const lv = src && (src.statLv || src.lv) || designLv(this.h.level);
    if (G.newFx && src && !src.pet && src.lv && src.lv < this.h.level) dmg *= Math.max(0.5, 1 - (this.h.level - src.lv) * 0.06); // creatures below your level hit you softer (6% a level, at most half)
    if (this.buffs.ward > 0) dmg *= 0.6;
    const red = this.D.armor / (this.D.armor + 40 + lv * 12);
    dmg = Math.max(1, Math.round(dmg * (1 - red)));
    if (this.buffs.wall > 0) dmg = Math.max(1, Math.round(dmg * (this.pk('a_shieldwall') ? 0.4 : 0.4)));
    if (this.buffs.fort > 0) dmg = Math.max(1, Math.round(dmg * 0.7));
    if (this.buffs.stand > 0) dmg = Math.max(1, Math.round(dmg * 0.75));
    if (this.buffs.bStone > 0) { dmg = Math.max(1, Math.round(dmg * (this.pk('cmd') ? 0.55 : 0.7))); V.burst('frost', this.pos.clone().setY(this.pos.y + 1.1), 8, { speed: 3 }); }
    if (this.pk('immov')) dmg = Math.max(1, Math.round(dmg * 0.9));
    if (this.buffs.lich > 0) dmg = Math.max(1, Math.round(dmg * 0.75));
    if (this.buffs.formFrost > 0) dmg = Math.max(1, Math.round(dmg * 0.7));
    if (this.buffs.avatar > 0 && this.avatar && this.avatar.taken) dmg = Math.max(1, Math.round(dmg * this.avatar.taken));
    if (this.buffs.mward > 0 && (o.ranged || o.el || o.magic)) dmg = Math.max(1, Math.round(dmg * 0.75)); // Hymn of Warding
    { const n = Game.fxCount(this.h, 'taken'), u = Game.fxCount(this.h, 'u_def'); if (n || u) dmg = Math.max(1, Math.round(dmg * (1 - n * 0.05 - u * 0.12))); }
    if (this.pk('thorns') && src && src.takeHit && !src.dead && !src.isStruct && o.melee !== false && src.pos && src.pos.distanceTo(this.pos) < 4) { const back = Math.max(1, Math.round(dmg * 0.15)); src.takeHit(back, this, { silent: true }); V.burst('spark', src.pos.clone().setY(src.pos.y + 1), 6, { speed: 3 }); }
    if (this.bearT > G.time) dmg *= 0.7; // (Bear Form)
    if (this.arcShield > 0 && G.time < this.arcShieldT) { const ab = Math.min(this.arcShield, dmg); this.arcShield -= ab; dmg -= ab; this.arcHitT = G.time; S.cast && S.cast('arcane', this.pos, 0.35); if (dmg <= 0) { V.number(this.pos.clone().setY(this.pos.y + this.eye + 0.3), 'Absorbed', 'arcane'); return; } } // (Arcane Shield)
    if (this.buffs.barrier > 0) { const ab = Math.min(this.buffs.barrier, dmg); this.buffs.barrier -= ab; dmg -= ab; V.burst('frost', this.pos.clone().setY(this.pos.y + 1), 10, { speed: 3 }); if (this.buffs.barrier <= 0) { this.buffs.barrierT = 0; S.explode(this.pos, 0.4, 'frost'); } if (dmg <= 0) { V.number(this.pos.clone().setY(this.pos.y + this.eye + 0.3), 'Absorbed', 'frost'); return; } }
    this.hp -= dmg; if (this.buffs.undying > 0 && this.hp < 1) this.hp = 1; this.hurtT = 0.4; this.regenDelay = 4;
    V.addShake(Math.min(0.5, 0.1 + dmg / this.maxHp)); S.hurt();
    G.inCombat = 6;
    G.hooks.hurt && G.hooks.hurt(dmg, src);
    this.cancelGather();
    if (this.hp <= 0) { this.hp = 0; this.die(); }
  }
  debuff(type, t, dps = 0) {
    if ((type === 'slow' || type === 'root') && (this.snareImmT || 0) > G.time) return; // (Purifying Light: no slows or snares)
    if (type === 'stun' && this.block && this.pk('immov')) return; // Immovable
    this.db = this.db || {};
    const d = this.db[type] || (this.db[type] = { t: 0, dps: 0 });
    d.t = Math.max(d.t, t); d.dps = Math.max(d.dps, dps); if (type === 'freeze') d.label = null; // (a label, e.g. SCARED STIFF, is set by whoever froze you)
    const label = { bleed: 'Bleeding!', poison: 'Poisoned!', burn: 'Burning!', slow: 'Slowed!', stun: 'Stunned!' }[type];
    V.number(this.pos.clone().setY(this.pos.y + this.eye + 0.2), label, 'bad');
    if (type === 'stun') { this.atk = null; this.press = null; this.cancelGather(); }
  }
  knock(v, stun = 0) { if (this.iframes > 0) return; if (stun > 0.3 && this.ch) this.ch.kdLeft = Math.max(this.ch.kdLeft || 0, Math.min(3.0, Math.max(2.7, stun + 1.4))); /* (knocked down) */ this.vel.x += v.x; this.vel.z += v.z; this.vel.y = Math.max(this.vel.y, 3.5); this.onGround = false; this.knockT = 0.35; if (stun) this.debuff('stun', stun); }
  die() { this.dead = true; this.atk = null; this.press = null; this.lmbHeld = false; this.lmbDown = false; /* (a click held at death does not carry on firing after you come back) */ this.deadT = 0; S.hurt(); G.hooks.died && G.hooks.died(); }

  // ---------- movement ----------
  // swimming: Space next to a low edge (a boat deck, a pier) climbs you out of the water
  climbOut() { let g = null, r = 0; for (const d of [0.6, 1.2, 1.9, 2.6]) { const t = groundAt(this.pos.x + Math.sin(this.yaw) * d, this.pos.z + Math.cos(this.yaw) * d, this.pos.y + 2.8); if (t.surf && t.h - this.pos.y <= 2.8) { g = t; r = d; break; } } if (!g) return false;
    this.pos.x += Math.sin(this.yaw) * r; this.pos.z += Math.cos(this.yaw) * r; this.pos.y = g.h; this.vel.set(0, 0, 0); this.onGround = true; this.swim = false; S.splash(this.pos, 0.6); return true; }
  swimK() { const k = Math.min(1, ((this.h.swimSkill || 1) - 1) / 49); return 0.65 + 0.45 * k; } // swimming skill 1-50: slow at first, quick with practice
  jump() { if (this.swim) { this.climbOut(); return; } if (this.transcendT > 0 || this.hoverH > 0.05 || (this.iceFormOn && this.buffs.iceblock > 0)) return; /* (hovering (Arcane Ascension, the bard's note): no jumping) */ if (this.onGround && !this.dodge && !this.gathering && !this.dead && !this.swim) { this.vel.y = 9.2; /* (you can jump mid-swing, and swing mid-jump) */ this.onGround = false; this.landDip = 0.07; S.jump(); V.burst('dust', this.pos.clone().setY(this.pos.y + 0.1), 8, { speed: 2, size: 0.45, up: 0.3 }); } else if (this.swim) this.vel.y = 3; }
  tryDodge(dirOverride) {
    if (this.dodge || this.dead || this.isFrozen() || (this.iceFormOn && this.buffs.iceblock > 0) || this.gathering || !this.onGround || this.swim || this.transcendT > 0 || this.hoverH > 0.05) return; // (no dodging while hovering)
    if (this.atk && this.atk.t < 0.6 && this.atk.name !== 'cast' && this.h.cls !== 'monk') return; // (the monk can dodge out of any strike)
    if (this.atk && this.h.cls === 'monk') { this.atk = null; this.queued = null; }
    const kind = 'roll', D = DODGES[kind]; /* (the owner: every class rolls for now; the per-class side steps, leaps and flips are set aside) */
    const cost = (this.h.arena ? (this.maxEnd || 100) / 3 - 0.01 : D.cost) /* (the arena: a dodge costs a third of your endurance, so three in a row) */ * (this.W && this.W.hands === 'dual' && dualRank(this.h.dualKills) >= 9 ? 0.6 : 1) * (this.pk('evasive') ? 0.5 : 1);
    if (this.end < cost) { S.error(); V.number(this.pos.clone().setY(this.pos.y + this.eye + 0.3), 'Too tired', 'miss'); return; }
    this.end -= cost; this.endUseT = 1;
    let dir = dirOverride ? dirOverride : this.moveDir && this.moveDir.lengthSq() > 0.01 ? this.moveDir.clone().normalize() : this.fwd().multiplyScalar(-1);
    this.dodge = { t: 0, dur: D.dur, dir, speed: D.speed, kind }; this.iframes = D.ifr; this.atk = null; this.queued = null; this.block = false;
    const feet = this.pos.clone().setY(this.pos.y + 0.1);
    if (kind === 'step') { S.dodge(); this.landDip = Math.max(this.landDip || 0, 0.12); V.burst('dust', feet, 6, { speed: 2, size: 0.35 }); }
    else if (kind === 'roll') { S.dodge(); S.step && S.step('dirt', this.pos, 1.4); this.landDip = Math.max(this.landDip || 0, 0.4); V.burst('dust', feet, 14, { speed: 3, size: 0.5 }); }
    else { S.dodge(); S.jump && S.jump(); this.vel.y = D.vy; this.onGround = false; this.fovKick = Math.max(this.fovKick, 6); V.burst('dust', feet, 20, { speed: 4, size: 0.6 }); }
  }
  swapWeapon() {
    if (this.atk || this.dodge) return;
    if (setIsEmpty(this.h)) { G.hooks.toast && G.hooks.toast('Weapon Set 2 is empty: put weapons in it on the Hero page (I), then Z swaps sets', '⚔', 'bad'); return; }
    swapSets(this.h); this.refreshGear(); S.swap(); this.swapT = 0.35;
    G.hooks.toast && G.hooks.toast(`Weapon Set ${this.h.setNo || 1}: ${this.h.equip.w1 ? this.h.equip.w1.name : 'bare hands'}${this.h.equip.w2 ? ' + ' + this.h.equip.w2.name : ''}`, '⚔');
    G.hooks.gearChanged && G.hooks.gearChanged(true);
  }
  quaff() {
    const order = ['potion_heal2', 'potion_heal', 'hunter_stew', 'herb_roast', 'ember_skewer', 'crab_cake', 'roast_meat', 'bandage'];
    const id = order.find(k => count(this.h, k) > 0);
    if (!id) { G.hooks.toast && G.hooks.toast('No potions or food', '🧪', 'bad'); S.error(); return; }
    useItem(this.h, id, this);
  }

  // ---------- interaction & gathering ----------
  findInteract() {
    let best = null, bestS = 1e9;
    const f = this.fwd();
    const consider = (o, x, z, r, kind, label) => {
      const dx = x - this.pos.x, dz = z - this.pos.z, d = Math.hypot(dx, dz) - r; if (d > 2.6) return;
      const ang = d > 0.4 ? Math.abs(angDiff(this.yaw, Math.atan2(dx, dz))) : 0; if (ang > 1.4) return;
      const s = d + ang * 1.6; if (s < bestS) { bestS = s; best = { o, kind, label }; }
    };
    for (const n of G.npcs) { if (n.def) consider(n, n.pos.x, n.pos.z, 0.4, 'npc', 'Talk to ' + n.name); else if (n.talkable) consider(n, n.pos.x, n.pos.z, 0.4, 'villager', 'Talk to ' + n.vname); }
    if (world.myBoatHome && !BATTLE) consider(world.myBoat, world.myBoatHome.x, clamp(this.pos.z, world.myBoatHome.z - 6, world.myBoatHome.z + 6), 3.2, 'boat', 'Set sail');
    for (const s of world.stations) consider(s, s.x, s.z, 1.0, 'station', 'Use ' + ({ workbench: 'Workbench', forge: 'Forge', loom: 'Loom', tanning: 'Tanning Rack', campfire: 'Campfire', alchemy: 'Alchemy Table' })[s.type]);
    if (!G.noHarvest) for (const m of G.mobs) if (m.dead && m.root.visible) { if (hasLoot(m)) consider(m, m.pos.x, m.pos.z, m.radius, 'loot', 'Loot ' + m.name); else if (m.def.skin && !m.skinned) consider(m, m.pos.x, m.pos.z, m.radius, 'skin', 'Skin ' + m.name); }
    if (!G.noHarvest) for (const n of nodesNear(this.pos.x, this.pos.z)) if (n.alive) consider(n, n.x, n.z, n.type.startsWith('tree') ? 0.5 * n.s : n.type === 'cotton' || n.type === 'healroot' ? 0.2 : 0.8 * n.s, 'node', n.def.verb + ' ' + n.def.name);
    return best;
  }
  interact() {
    if (this.dead || this.gathering) return;
    const t = this.findInteract(); if (!t) return;
    if (t.kind === 'npc') G.hooks.talk && G.hooks.talk(t.o);
    else if (t.kind === 'station') G.hooks.station && G.hooks.station(t.o.type);
    else if (t.kind === 'boat') G.hooks.boat && G.hooks.boat();
    else if (t.kind === 'villager') G.hooks.chatter && G.hooks.chatter(t.o);
    else if (t.kind === 'loot') lootCorpse(this.h, t.o);
    else if (t.kind === 'skin') {
      if (!this.h.tools.knife) { G.hooks.toast && G.hooks.toast('You need a Skinning Knife (Lyra the Huntress has one).', '🔪', 'bad'); S.error(); return; }
      this.startGather({ skin: t.o, def: { time: 1.4, verb: 'Skin', name: t.o.name } }, 'knife', 1, 'skin');
    } else if (t.kind === 'node') {
      const prob = toolProblem(this.h, t.o);
      if (prob) { G.hooks.toast && G.hooks.toast(prob, '⚠', 'bad'); S.error(); return; }
      const tool = t.o.def.tool, anim = tool === 'hatchet' ? 'chop' : tool === 'pickaxe' ? 'mine' : 'gather';
      this.startGather(t.o, tool, tool ? this.h.tools[tool] : 1, anim);
    }
  }
  startGather(node, tool, tier, anim) {
    if (this.atk || this.dodge) return;
    this.gathering = { node, t: 0, dur: node.def.time, anim, tool, hits: 0, cyc: 0 };
    if (tool && tool !== 'knife') { holdTool(this.ch, tool, tier); this.vm.setTool(tool, tier); } else if (tool === 'knife') { holdTool(this.ch, 'knife', 2); this.vm.setTool('knife', 2); }
    const n = node.x != null ? node : node.skin.pos;
    this.yaw = Math.atan2(n.x - this.pos.x, n.z - this.pos.z);
  }
  cancelGather() { if (!this.gathering) return; this.gathering = null; holdTool(this.ch, null); this.vm.setTool(null); G.hooks.progress && G.hooks.progress(null); }
  updateGather(dt) {
    const g = this.gathering; if (!g) return;
    g.t += dt; g.cyc += dt;
    const cycle = g.anim === 'chop' || g.anim === 'mine' ? 0.7 : 0.5;
    if (g.cyc >= cycle) { g.cyc -= cycle; }
    const k = g.cyc / cycle;
    if (k > 0.55 && !g.struck) {
      g.struck = true; const n = g.node; const p = n.x != null ? new THREE.Vector3(n.x, n.y + (g.anim === 'chop' ? 1.2 : 0.6), n.z) : n.skin.pos.clone().setY(n.skin.pos.y + 0.4);
      if (g.anim === 'chop') { S.chop(p); V.burst('wood', p, 8, { speed: 3, size: 0.12 }); V.burst('leaf', p.clone().setY(p.y + 6 * (n.s || 1)), 5, { speed: 1.5, size: 0.18, grav: 1.5, life: 2 }); V.addShake(0.05); }
      else if (g.anim === 'mine') { S.mine(p); V.burst('spark', p, 8, { speed: 4, size: 0.1 }); V.burst('stone', p, 6, { speed: 3, size: 0.14 }); V.addShake(0.05); }
      else if (g.anim === 'skin') { S.skin(p); V.burst('blood', p, 4, { speed: 1, size: 0.08 }); }
      else { S.gather(p); V.burst(n.type === 'cotton' ? 'cotton' : 'green', p.clone().setY(p.y + 0.3), 6, { speed: 1, size: 0.1, grav: 0.5 }); }
    }
    if (k < 0.5) g.struck = false;
    G.hooks.progress && G.hooks.progress(g.t / g.dur, g.node.def.verb + 'ing ' + g.node.def.name);
    if (this.moveDir && this.moveDir.lengthSq() > 0.01) { this.cancelGather(); return; }
    if (g.t >= g.dur) {
      const n = g.node;
      if (g.anim === 'skin') { const mob = n.skin; mob.skinned = true; const k2 = mob.def.size > 1 ? 2 : 1; addItem(this.h, 'raw_hide', k2 + (Math.random() < 0.3 ? 1 : 0) + this.pk('bounty')); if (this.pk('bounty')) addItem(this.h, 'raw_meat', 1); }
      else { gatherReward(this.h, n); n.alive = false; n.respawn = G.time + n.def.respawn; hideNode(n); G.hooks.nodeDone && G.hooks.nodeDone(n, this); }
      this.cancelGather();
    }
  }

  // ---------- update ----------
  update(dt) {
    const h = this.h;
    for (const k in this.cd) this.cd[k] = Math.max(0, this.cd[k] - dt * (this.buffs.formTime > 0 ? 2 : 1) * ((this.cdBoostT || 0) > G.time ? 1.25 : 1)); // (the warrior's Banner of Haste: 25% faster inside its ring) // Timeless Form: abilities recharge twice as fast
    this.useCd = Math.max(0, this.useCd - dt); this.iframes = Math.max(0, this.iframes - dt); this.comboT -= dt; this.stealth = Math.max(0, this.stealth - dt);
    for (const k of ['poisonW', 'flame', 'clarity', 'wolfRun', 'ward', 'anthem', 'warsong', 'reload', 'eagle', 'leech', 'storm', 'cry', 'fury', 'adren', 'tq', 'surge', 'swind', 'barrierT', 'wall', 'stand', 'rage', 'fort', 'rampage', 'focus', 'undying', 'bWar', 'bVigor', 'bStone', 'lich', 'formFire', 'formFrost', 'formArcane', 'formVoid', 'formTime', 'avatar', 'iceblock', 'phase', 'power', 'mward', 'missiles']) this.buffs[k] = Math.max(0, (this.buffs[k] || 0) - dt); /* (missiles: the wizard's Magic Missiles) */ if (this.buffs.barrierT <= 0) this.buffs.barrier = 0; this.stagger = Math.max(0, (this.stagger || 0) - dt);
    this.hurtT = Math.max(0, this.hurtT - dt); this.regenDelay = Math.max(0, (this.regenDelay || 0) - dt); this.swapT = Math.max(0, (this.swapT || 0) - dt); this.landT = Math.max(0, (this.landT || 0) - dt * 3.5);
    if (h.sb) { let gone = false; for (const id in h.sb) { const b = h.sb[id]; b.t -= dt; if (b.mregen && this.maxMana) this.mana = Math.min(this.maxMana, this.mana + b.mregen * dt); if (b.t <= 0) { delete h.sb[id]; gone = true; G.hooks.toast && G.hooks.toast(`${b.name} has worn off`, '✦', 'bad'); } } if (gone) this.refreshStatsOnly(); }
    for (const k of ['food', 'drink']) {
      const b = h[k];
      if (b && b.t > 0) { b.t -= dt; if (b.t <= 0) { h[k] = null; if (!h.equip[k]) G.hooks.toast && G.hooks.toast(`${FOOD_BUFFS[b.id].name} has worn off`, k === 'food' ? '🍖' : '🍺'); this.refreshStatsOnly(); } }
      // the food and drink slots feed you automatically when the buff runs out
      const st = h.equip[k];
      if ((!h[k] || h[k].t <= 0) && st && st.n > 0 && !this.dead) { st.n--; const id = st.id; if (st.n <= 0) h.equip[k] = null; Game.applyConsumable(h, id, true); G.hooks.toast && G.hooks.toast(`${k === 'food' ? 'Ate' : 'Drank'} ${ITEMS[id].name}: ${FOOD_BUFFS[id].desc}`, k === 'food' ? '🍖' : '🍺'); this.refreshStatsOnly(); G.hooks.invChanged && G.hooks.invChanged(); }
    }
    this.fb = Game.consumBuff(h);
    this.knockT = Math.max(0, (this.knockT || 0) - dt);
    if (this.db) for (const k in this.db) { const d = this.db[k]; if (d.t <= 0) continue; d.t -= dt; if (d.dps && !this.dead) { d.acc = (d.acc || 0) + d.dps * dt; if (d.acc >= 1) { const n = Math.floor(d.acc); d.acc -= n; this.hp -= n; if (this.buffs.undying > 0 && this.hp < 1) this.hp = 1; V.number(this.pos.clone().setY(this.pos.y + this.eye), n, 'dot'); if (k === 'burn') V.burst('fire', this.pos.clone().setY(this.pos.y + 1), 3, { speed: 1 }); if (k === 'bleed') V.burst('blood', this.pos.clone().setY(this.pos.y + 1), 2, { speed: 1, size: 0.08 }); if (this.hp <= 0) { this.hp = 0; this.die(); } } } }
    const stunned = (this.db && this.db.stun && this.db.stun.t > 0) || this.isFrozen() || (this.ch && this.ch.kdLeft > 0.35); /* (on the ground or getting up; free again as he finds his feet) */
    if (this.dead) { this.deadT += dt; this.animate(dt, 0); this.updateCamera(dt); return; }
    if (this.held) { this.vel.set(0, 0, 0); this.animate(dt, 0); bladeFire(this, dt); this.updateCamera(dt); return; } // (in a demon's grip: it moves you)
    // regen
    this.endUseT -= dt; this.manaUseT -= dt;
    if (this.endUseT <= 0 && !this.block) this.end = Math.min(this.maxEnd, this.end + dt * (14 + (h.race === 'woodelf' ? 3 : 0)) * (h.arena ? 2 : 1) /* (the arena: endurance comes back twice as fast) */ * (this.buffs.anthem > 0 ? 3 : 1) /* (the owner: Anthem of Swiftness: endurance comes back three times as fast) */ * (1 + (this.fb.regen || 0)) * (1 + (this.h.cls !== 'wizard' ? 0 : 0)));
    if (this.manaUseT <= 0) this.mana = Math.min(this.maxMana, this.mana + dt * (5 + this.D.stats.int * 0.25) * (1 + this.pk('regen') * 0.5) * (1 + (this.fb.regen || 0)));
    if (this.fb.trickle && !this.dead) { const k = this.fb.trickle * dt; this.hp = Math.min(this.maxHp, this.hp + this.maxHp * k); this.mana = Math.min(this.maxMana, this.mana + this.maxMana * k); this.end = Math.min(this.maxEnd, this.end + this.maxEnd * k); } // drinks: a slow trickle even in a fight
    { const r = Game.fxCount(this.h, 'regen') * 0.003 + Game.fxCount(this.h, 'u_def') * 0.005; if (r && !this.dead && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * r * dt); }
    if (this.regen) { this.hp = Math.min(this.maxHp, this.hp + this.regen.per * dt); this.regen.t -= dt; if (this.regen.t <= 0) this.regen = null; }
    const baseRegen = G.inCombat <= 0 && this.regenDelay <= 0 ? 0.02 : this.pk('secondwind') ? 0.008 : 0;
    this.hp = Math.min(this.maxHp, this.hp + this.maxHp * (this.buffs.tq > 0 ? Math.max(0.03, baseRegen * 2) : baseRegen) * (1 + (this.fb.regen || 0)) * dt);
    // input
    const K = G.keys, ui = G.uiOpen;
    let ix = 0, iz = 0;
    if (!ui) { if (K.KeyW) iz += 1; if (K.KeyS) iz -= 1; if (K.KeyA) ix -= 1; if (K.KeyD) ix += 1; }
    const f = this.fwd(), r = this.right();
    const md = new THREE.Vector3().addScaledVector(f, iz).addScaledVector(r, ix); if (md.lengthSq() > 1) md.normalize();
    if (this.fearT > 0 && this.fearFrom && !this.dead) { this.fearT -= dt; md.set(this.pos.x - this.fearFrom.x, 0, this.pos.z - this.fearFrom.z); if (md.lengthSq() < 0.01) md.copy(f); md.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.sin(G.time * 2) * 0.4); this.press = null; this.channel = null; this.adsHeld = false; } // feared: your legs run you away
    this.moveDir = md;
    const wasBlock = this.block;
    this.lichTick(dt); this.formTick(dt); this.avatarTick(dt);
    if (G.newFx && (this.lookCheckT = (this.lookCheckT || 0) - dt) <= 0) { this.lookCheckT = 0.1; const r = aimRay(60); if (r && r.mob) r.mob.lookT = G.time; } // names show when your crosshair passes over
    if (this.xHoldT != null && !ui && K.KeyX && G.time - this.xHoldT > 0.4) { this.xHoldT = null; this.sheatheWeapons(); }
    this.ads = !!this.adsHeld && !ui && !this.dead && !this.sheathed && !this.dodge && !this.swim && !this.gathering && !!this.W && (this.W.kind === 'bow' || this.W.kind === 'gun') && !(this.abCast || this.summonCast);
    this.adsK = (this.adsK || 0) + ((this.ads ? 1 : 0) - (this.adsK || 0)) * Math.min(1, dt * (this.ads ? 12 : 14)); /* (the owner: zoom in faster: about twice as quick as it was) */
    this.block = !this.sheathed && !ui && !!(G.battleFx ? this.rmbHeld : K.KeyF) && !this.atk && !this.dodge && !this.gathering && this.stagger <= 0 && !this.swim && !!this.W;
    if (this.block && !wasBlock) this.blockStart = G.time;
    if (this.summonCast) this.tickSummon(dt);
    if (this.abCast) this.tickAbCast(dt);
    if (!this.dead) this.tickAuras(dt);
    if (G.battleFx) this.tickChannel(dt);
    if (G.battleFx && this.h.cls === 'bard') this.tickSongs(dt);
    if (this.buffs.clarity > 0 && this.maxMana) this.mana = Math.min(this.maxMana, this.mana + this.maxMana * 0.05 * dt);
    if (this.buffs.flame > 0 && this.W && this.W.kind !== 'staff' && Math.random() < dt * 10) { const tip = this.camDist < 0.6 ? null : this.ch.weapons.main; const q = tip && tip.userData.tip ? tip.userData.tip.getWorldPosition(new THREE.Vector3()) : this.handPos(); V.burst('fire', q, 1, { speed: 0.6, size: 0.22, size1: 0.05, life: 0.35, vy: 1 }); const bs = tip && tip.userData.base ? tip.userData.base.getWorldPosition(new THREE.Vector3()) : null; if (bs) for (let i = 0; i < 2; i++) V.burst('fire', bs.clone().lerp(q, Math.random()), 1, { speed: 0.4, size: 0.2, size1: 0.04, life: 0.3, vy: 1.2 }); } /* (the whole blade burns, guard to point) */
    // charge heavy holds the swing
    const charging = this.press && this.press.charging;
    let sprint = !ui && this.shiftT != null && G.time - this.shiftT >= 0.22 && iz > 0 && !this.block && !charging && (!this.atk || this.h.cls === 'monk') && !this.ads; // (the monk keeps running while he strikes)
    // sprinting burns endurance; once empty you must recover a little before sprinting again
    if (this.end <= 1) this.sprintTired = true; else if (this.end > 20) this.sprintTired = false;
    if (sprint && this.sprintTired) sprint = false;
    if (sprint && md.lengthSq() > 0.1 && this.onGround) { this.end = Math.max(0, this.end - 36 * dt); /* (sprinting burns endurance three times as fast) */ this.endUseT = 0.8; }
    const hero = !!this.h.arena; // Kingdom Arena plays like a hero shooter: full speed every way, always facing your aim
    let spd = (hero ? (sprint ? 9 / 8.2 : 6 / 5.2) : 1) * /* (arena and yard heroes: run 6 m/s, sprint 9 m/s) */ (G.newFx && iz < 0 && !hero ? 0.6 : 1) * (this.buffs.iceblock > 0 ? 0 : 1) * ((this.fireFormT || 0) > G.time ? 1.25 : 1) /* (Fire Form: a quarter faster) */ * /* campaign: backing up is slow, so you cannot simply walk out of every swing */ (1 + this.sbSum('run') / 100) * (this.summonCast || (this.abCast && this.abCast.spell) ? 0.35 : this.abCast ? 0.55 : 1) * (this.swim ? 3.2 * this.swimK() : sprint ? 8.2 : 5.2) * (1 + this.pk('speed') * 0.1 + Game.fxCount(this.h, 'speed') * 0.04) * (this.buffs.adren > 0 ? 1.3 : 1) * (this.buffs.swind > 0 ? 1.25 : 1) * (this.buffs.anthem > 0 ? 1.4 : 1) /* (Anthem of Swiftness) */ * (1 + (this.fb.speed || 0)) * (this.buffs.wolfRun > 0 ? 1 + (this.wolfK || 0.12) : 1) * (1 - (this.adsK || 0) * 0.5) * Game.arenaSpeedK(this.h) * (hero && this.h.cls === 'monk' ? 1.15 : 1); /* aiming down the barrel: a slow, steady walk; the monk is the fastest fighter */
    if (iz < 0 && !hero) { spd = 2.2; sprint = false; }
    else if (iz < 0 && hero) { spd = Math.min(spd, BACK_SPEED) * (this.buffs.iceblock > 0 ? 0 : 1); sprint = false; } /* (the owner: every hero backs up at the same walking pace, 2.1 m/s, whatever his class or buffs (no sprinting backwards); each body's walk plays backwards at the rate that keeps its feet on the ground at that pace, so it reads as a normal walk) */
    if (this.block && !(this.pk('shieldwall') && this.W && this.W.hands === 'shield')) spd *= 0.45;
    if (this.gathering || stunned) spd = 0;
    if (this.ringSlowT > G.time) spd *= 0.156; else if (this.ultSlowT > G.time) spd *= this.ultSlowK; else if (this.db && this.db.slow && this.db.slow.t > 0) spd *= 0.55; // (the demon's ring: a deeper slow)
    if (this.stagger > 0) spd *= 0.3;
    if (this.transcendT > 0) spd *= 1.4; // (Arcane Ascension: he glides faster)
    this.sprinting = sprint && md.lengthSq() > 0.1;
    // dodge / charge / leap override
    if (this.leap) {
      const L = this.leap; L.t += dt / L.dur; const k = Math.min(1, L.t);
      this.pos.x = lerp(L.from.x, L.to.x, k); this.pos.z = lerp(L.from.z, L.to.z, k);
      this.pos.y = lerp(L.from.y, L.to.y, k) + Math.sin(k * Math.PI) * (L.hgt || 5);
      if (k >= 1 && L.onLand) { this.leap = null; this.vel.set(0, 0, 0); this.onGround = true; L.onLand(); } /* (a leap with its own landing: the beastmaster's Pounce) */
      else if (k >= 1) {
        this.leap = null; const p = this.pos.clone(); p.y = heightAt(p.x, p.z);
        for (const m of mobsInRadius(p, L.r || 7)) this.dealDamage(m, L.dmg, { stun: 2, knock: m.pos.clone().sub(p).setY(0).normalize().multiplyScalar(8), big: true, melee: true });
        V.ring(p, 7, '#ffd090', 0.5); V.ring(p, 4.5, '#ff8040', 0.4); V.burst('stone', p, 110, { speed: 13, size: 0.45, grav: 16, life: 1.5 }); V.burst('dust', p, 80, { speed: 8, size: 1.7, life: 1.9, radius: 3.5 }); V.burst('spark', p.clone().setY(p.y + 0.4), 40, { speed: 10, size: 0.16 }); V.burst('dust', p.clone().setY(p.y + 0.2), 30, { speed: 3, size: 2.2, life: 2.4, vy: 5 }); /* (the owner: a far heavier landing: more rock and dust, sparks, a column of dust thrown up) */
        V.light(p.clone().setY(p.y + 1), '#ffcf90', 12, 0.35, 16); this.fovKick = Math.max(this.fovKick || 0, 12);
        { const R = L.r || 7; for (let k = 0; k < 3; k++) setTimeout(() => { V.ring(p, R * (0.8 + k * 0.2), k ? '#c8a070' : '#ffe0b0', 0.55 + k * 0.1, 0.12); for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, rr = R * (0.45 + k * 0.25), q = p.clone().add(new THREE.Vector3(Math.cos(a) * rr, 0.1, Math.sin(a) * rr)); q.y = heightAt(q.x, q.z) + 0.1; V.burst('dust', q, 1, { speed: 1.2, size: 0.9, life: 0.8, vy: 1.4 }); } }, k * 130); } /* (the owner: a ripple through the ground: three shockwaves racing out over the area, dust kicked up along each) */
        S.explode(p, 1.8); S.rumble(p, 1.6); V.addShake(1.3); G.hitstop = 0.13; this.vel.set(0, 0, 0); this.onGround = true;
      }
    } else if (this.dodge) {
      const D = this.dodge; D.t += dt / D.dur;
      if (D.rush && D.t < 0) { this.vel.x *= 0.5; this.vel.z *= 0.5; D.t += dt * 2 - dt / D.dur; } // the brace, about 0.15 s
      const s = D.t < 0 ? 0 : D.speed * (D.rush ? Math.min(1, 0.55 + D.t * 2.2) * (D.t > 0.85 ? 0.6 : 1) : D.charge ? 1 : (1 - D.t * 0.75));
      if (D.rush && D.t >= 0) { this.fovKick = Math.max(this.fovKick, 18 * Math.min(1, D.t * 3)); D.step = (D.step || 0) + dt; if (D.step > 0.09) { D.step = 0; V.addShake(0.07); V.burst('dust', this.pos.clone().setY(this.pos.y + 0.1), 6, { speed: 3, size: 0.7 }); } }
      this.vel.x = D.dir.x * s; this.vel.z = D.dir.z * s;
      if (D.charge && D.t >= 0) { for (const m of mobsInRadius(this.pos, 2.4)) if (!D.hitSet.has(m)) { D.hitSet.add(m); if (D.rush) { S.chargeImpact(m.pos); G.hitstop = Math.max(G.hitstop || 0, 0.08); V.addShake(0.35); V.burst('spark', m.pos.clone().setY(m.pos.y + 1), 20, { speed: 6 }); V.burst('dust', m.pos.clone().setY(m.pos.y + 0.3), 18, { speed: 4, size: 0.8 }); } const side = this.right().multiplyScalar(Math.sign(this.right().dot(m.pos.clone().sub(this.pos))) || 1); this.dealDamage(m, D.dmg, Object.assign({ knock: side.multiplyScalar(D.rush ? 7 : 9).add(D.dir.clone().multiplyScalar(D.rush ? 9 : 4)), stun: 1, big: true, melee: true }, D.extra || {})); V.addShake(0.2); if (D.stop) { D.t = Math.max(D.t, 0.97); G.hitstop = Math.max(G.hitstop || 0, 0.07); V.burst('dust', m.pos.clone().setY(m.pos.y + 0.3), 18, { speed: 4, size: 0.8 }); } } /* (a stunning charge smashes into the first enemy and stops there, it does not run on past them) */ if (Math.random() < 0.6) V.burst('dust', this.pos.clone().setY(this.pos.y + 0.1), 3, { speed: 2, size: 0.5 }); }
      if (D.t >= 1) { if (D.land) { const at = this.pos.clone(); for (const m of mobsInRadius(at, 3.2)) this.dealDamage(m, D.land, { stun: 0.5, melee: true, knock: new THREE.Vector3(m.pos.x - at.x, 0, m.pos.z - at.z).normalize().multiplyScalar(6) }); V.ring(at.clone().setY(at.y + 0.1), 6.4, '#ffe0a0', 0.45); V.burst('dust', at.clone().setY(at.y + 0.2), 40, { speed: 6 }); V.burst('gold', at.clone().setY(at.y + 0.4), 24, { speed: 5 }); V.addShake(0.5); S.explode && S.explode(at, 0.5); } /* (the landing slams everyone round you) */ this.dodge = null; this.vel.x *= 0.3; this.vel.z *= 0.3; }
    } else {
      const k = this.knockT > 0 ? Math.min(1, dt * 1.5) : Math.min(1, dt * (this.onGround ? (this.h.arena ? 10 : 12) : 2.5)); // (the arena: a slight Skyrim-like ease into and out of every step and strafe)
      this.vel.x += (md.x * spd - this.vel.x) * k; this.vel.z += (md.z * spd - this.vel.z) * k;
      if (this.lungeT > 0) { this.lungeT -= dt; const ls = 7.5 * Math.max(0, this.lungeT / 0.16); this.vel.x += this.lungeDir.x * ls * Math.min(1, dt * 30); this.vel.z += this.lungeDir.z * ls * Math.min(1, dt * 30); } // a heavy swing carries you a step forward
    }
    // gravity / swim
    const wl = waterLevelAt(this.pos.x, this.pos.z), gh = groundAt(this.pos.x, this.pos.z, this.pos.y);
    const depth = wl - gh.h;
    this.swim = depth > 1.35 && this.pos.y < wl - 0.9 && !gh.surf;
    if (!this.leap) {
      if (this.swim && md.lengthSq() > 0.1) { this.swimT = (this.swimT || 0) + dt; if (this.swimT > 1) { this.swimT = 0; const sk = this.h.swimSkill || 1; if (sk < 50 && Math.random() < 1 / (6 + sk * 1.3)) { this.h.swimSkill = sk + 1; G.hooks.skillUp && G.hooks.skillUp('Swimming', sk + 1); } } }
      if (this.swim) { this.vel.y += ((wl - 1.25) - this.pos.y) * dt * 6 - this.vel.y * dt * 3; if (Math.random() < dt * 4 && md.lengthSq() > 0.1) S.splash(this.pos, 0.3); }
      else this.vel.y -= (this.vel.y > 0 ? 21 : 26) * dt;
      this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt; this.pos.y += this.vel.y * dt;
    }
    { const rd = this.ch && this.ch._rootDelta; if (rd && (rd.x || rd.z)) { this.pos.x += rd.x; this.pos.z += rd.z; rd.set(0, 0, 0); } } /* (a recorded attack that steps forward carries you forward with it) */
    collide(this.pos, this.radius);
    // world bounds
    this.pos.x = clamp(this.pos.x, -590, 590); this.pos.z = clamp(this.pos.z, -590, 590);
    const g2 = groundAt(this.pos.x, this.pos.z, this.pos.y);
    const wasAir = !this.onGround;
    if (this.pos.y <= g2.h && !this.leap) {
      if (wasAir && this.vel.y < -3) { this.landT = Math.min(1, -this.vel.y / 12); }
      if (wasAir && this.vel.y < -7) { S.land(-this.vel.y / 10); this.landDip = Math.min(0.3, -this.vel.y * 0.018); V.burst('dust', this.pos.clone().setY(g2.h + 0.1), 10, { speed: 2.5, size: 0.5, up: 0.25 }); if (this.vel.y < -17) this.takeDamage((-this.vel.y - 17) * 6 * this.maxHp / 100, null); }
      this.pos.y = g2.h; this.vel.y = Math.max(0, this.vel.y); this.onGround = true;
    } else if (this.pos.y > g2.h + 0.15) this.onGround = this.swim;
    // step down slopes smoothly
    if (this.onGround && !this.swim && this.pos.y - g2.h < 0.5 && this.vel.y <= 0) this.pos.y = g2.h;
    if (this.hoverH > 0.005 && !this.leap) { this.pos.y = Math.max(g2.h, wl) + this.hoverH; this.vel.y = 0; this.onGround = true; this.swim = false; } // (Arcane Ascension: he hovers this high over the ground, or the water)
    this.onSurf = g2.surf;
    // lava
    if (world.lavaPools) for (const L of world.lavaPools) if (Math.hypot(this.pos.x - L.x, this.pos.z - L.z) < L.r && this.pos.y < L.y + 0.6) { this.pos.y = Math.max(this.pos.y, L.y - 0.3); this.lavaT = (this.lavaT || 0) + dt; if (this.lavaT > 0.5) { this.lavaT = 0; this.iframes = 0; this.takeDamage(this.maxHp * 0.12, null); V.burst('fire', this.pos, 20, { speed: 3 }); } }
    // footsteps
    const hs = Math.hypot(this.vel.x, this.vel.z);
    this.speed = hs;
    if (this.onGround && hs > 0.5 && !this.dodge && !(this.hoverH > 0.005)) { this.stepAcc += hs * dt; if (this.stepAcc > (this.sprinting ? 2.2 : 1.7)) { this.stepAcc = 0; S.step(this.swim ? 'water' : surfaceType(this.pos.x, this.pos.z, this.onSurf), null, this.sprinting ? 1.2 : 0.9); if (wl - g2.h > 0.1 && wl - g2.h < 1.4) S.step('water'); } }
 // held: the next attack follows straight on
    // attacks
    this.updateAttack(dt);
    this.updateGather(dt);
    // body yaw (third person)
    const combatFace = this.atk || this.block || this.press || this.gathering;
    if (combatFace || this.camDist < 0.6 || this.h.arena) this.bodyYaw += angDiff(this.bodyYaw, this.yaw) * Math.min(1, dt * (this.h.arena ? 18 : 14));
    else if (hs > 0.5) this.bodyYaw += angDiff(this.bodyYaw, Math.atan2(this.vel.x, this.vel.z)) * Math.min(1, dt * 10);
    { const tr = angDiff(this.prevBY ?? this.bodyYaw, this.bodyYaw) / Math.max(dt, 1e-3); this.prevBY = this.bodyYaw; this.turnR = (this.turnR || 0) + (tr - (this.turnR || 0)) * Math.min(1, dt * 8); }
    { const on = this.h.arena && this.h.cls === 'wizard' && this.buffs.missiles > 0 && !this.dead; bookAura(this.ch && this.ch.weapons && this.ch.weapons.main, on, G.time, on ? Math.min(1, this.buffs.missiles * 2) : 0); } /* (Magic Missiles: violet motes round the spellbook while it lasts) */
    { const on = this.h.arena && this.h.cls === 'ranger' && this.buffs.focus > 0 && !this.dead, k = on ? Math.min(1, this.buffs.focus * 2) : 0; focusBow(this.ch && this.ch.weapons && this.ch.weapons.main, on && this.camDist >= 0.6, G.time, dt, k); focusBow(this.vm && this.vm.weapons && this.vm.weapons.main, on && this.camDist < 0.6, G.time, dt, k); /* (Hunter's Focus: the bow lit up, fading out over its last half second) */
      if (on && this.camDist >= 0.6 && Math.random() < dt * 14) { const bw = this.ch.weapons.main; if (bw && bw.name === 'weapon_bow') { const q = bw.localToWorld(new THREE.Vector3((Math.random() - 0.5) * 0.1, (Math.random() * 2 - 1) * 0.6, 0.05)); V.burst('green', q, 1, { speed: 0.5, size: 0.12, life: 0.45, vy: 1.2 }); } } }
    this.animate(dt, this.hoverH > 0.2 ? 0 : hs); /* (hovering: no running legs, he glides) */ bladeFire(this, dt); this.tickAxe(dt); /* (after the arm has moved, so the fire sits on the blade, not a frame behind it) */
    this.updateCamera(dt);
  }
  animate(dt, hs) {
    const ch = this.ch;
    ch.root.position.copy(this.pos);
    if (this.swim) ch.root.position.y += 0.2;
    ch.root.rotation.y = this.bodyYaw;
    const a = this.atk, g = this.gathering;
    let action = null, actionT = 0, mirror = false, spin = 0;
    if (g) { action = g.anim === 'skin' ? 'gather' : g.anim; actionT = (g.cyc / (g.anim === 'chop' || g.anim === 'mine' ? 0.7 : 0.5)); }
    else if (a) {
      actionT = Math.min(1, a.t); action = a.name;
      if (a.name === 'off1') { action = 'swing1'; mirror = true; }
      if (a.name === 'stabR') action = this.weapon && /dagger/.test(this.weapon.wt) ? 'stab' : 'thrust1'; /* (daggers: a real lunging stab; fists keep their punch) */
      if (a.name === 'stabL') { action = this.weapon && /dagger/.test(this.weapon.wt) ? 'stab' : 'thrust1'; mirror = true; }
      if (a.name === 'smash') action = 'heavy';
      if (a.name === 'sweep') { action = 'swing1'; spin = Math.sin(Math.min(1, a.t / 0.75) * Math.PI) * -0.5; } // a wide sideways sweep: the whole body turns into it
      if (a.name === 'reap') { action = 'swing2'; spin = Math.sin(Math.min(1, a.t / 0.75) * Math.PI) * 0.45; } // (the necromancer's scythe: a big two-handed reap, the body turning into it)
      if (a.held && action === 'heavy') actionT = 0.5 + Math.min(a.t, 1) * 0.5; // released from the wind-up: swing straight through, no second wind-up
      if (a.name === 'charge' && a.hold) { action = this.weapon && this.weapon.wt === 'spear' ? 'thrust3' : 'heavy'; actionT = Math.min(a.t, 1) * (action === 'heavy' ? 0.5 : 0.4); }
      if (a.name === 'spin') { action = 'area'; spin = ease(Math.min(1, a.t / 0.8)) * Math.PI * 2; }
      if (a.name === 'fury' && this.weapon && this.weapon.wt === 'fists') { const q = a.t * 7; action = 'thrust1'; actionT = 0.3 + (q % 1) * 0.45; mirror = Math.floor(q) % 2 === 1; } // (fists: straight punches, left and right, no spinning)
      else if (a.name === 'area' || a.name === 'fury') { action = 'area'; spin = (a.name === 'fury' ? a.t * 3 : ease(Math.min(1, a.t / 0.8))) * Math.PI * 2; }
      if (a.name === 'release') action = 'shoot', actionT = 0.6 + a.t * 0.4;
      if (this.W && this.W.kind === 'gun' && (a.name === 'release' || a.name === 'shoot')) { action = 'gunAim'; actionT = a.t; }
      if (a.name === 'spell') action = 'cast';
      if (a.name === 'castRel') action = 'castRel';
      if (this.W && this.W.kind === 'melee' && this.weapon.wt === 'spear' && a.name.startsWith('thrust')) action = a.name;
    } else if (this.press && this.press.charging) { action = this.W.kind === 'bow' ? 'shoot' : this.W.kind === 'gun' ? 'gunAim' : this.W.kind === 'staff' ? 'castBig' : 'heavy'; actionT = this.press.aimShot ? 0.06 + 0.42 * Math.min(1, this.aimCharge() * 1.6) : this.W.kind === 'melee' ? 0.5 : this.W.kind === 'gun' ? 1 : 0.3; } /* (the zoomed charge shot: the string hand comes back to the jaw over the first part of the draw and holds there) */
    // chained swings: between one attack ending and the next starting the body holds the attack's end pose (its guard)
    // for a moment instead of dropping to the idle or run pose for a frame, so a held-click combo flows swing to swing
    let chain = 0; if (a && action && this.W && this.W.kind === 'melee') { if (this.queued && actionT > 0.75 && !(this.h.arena && this.h.cls === 'warrior' && /^swing[12]$/.test(a.name))) actionT = 0.75; /* (another swing is queued: skip the recovery back to guard) */ /* (not the warrior's two swings: they are one loop with no recovery, and holding them at 0.75 made the next one jump) */ if (a.chained) chain = Math.max(0, 1 - a.t / 0.35); } /* (and the next swing grows out of the last one's follow-through: the arms ease over instead of snapping) */
    if (a && action && this.W && this.W.kind === 'melee' && !spin) this._lastAct = { action, mirror, at: G.time }; else if (a) this._lastAct = null;
    if (!action && !g && this._lastAct && G.time - this._lastAct.at < 0.22 && !this.dodge && !this.dead) { action = this._lastAct.action; actionT = 1; mirror = this._lastAct.mirror; }
    if (!action && (this.adsK || 0) > 0.25 && this.W) { if (this.W.kind === 'gun') { action = 'gunAim'; actionT = 1; } else if (this.W.kind === 'bow') { action = 'shoot'; actionT = 0.3; } } // aiming down the barrel: the gun stays up at the shoulder, the bow half drawn
    { const cn = G.newFx && ((this.abCast && this.abCast.spell) ? this.abCast : this.summonCast); if (cn) { action = 'castUp'; actionT = Math.min(1, cn.t / Math.min(0.8, cn.dur * 0.6)); } const mw = ch.weapons && ch.weapons.main; if (mw && G.newFx && !this.sheathed) mw.visible = !cn; }
    const roll = this.dodge && !this.dodge.charge && this.dodge.kind !== 'step' ? Math.min(1, this.dodge.t) : null;
    const rollDir = roll != null && this.dodge.dir ? Math.atan2(this.dodge.dir.x, this.dodge.dir.z) - this.bodyYaw : 0, rollKind = roll != null ? this.dodge.kind : null; // roll the way you dodge
    const aimStaff = action !== 'castUp' && action !== 'castRel' && this.W && this.W.kind === 'staff' && ((this.channel && this.channel.on) || this.summonCast || (this.abCast && this.abCast.spell) || (this.atk && (this.atk.name === 'cast' || this.atk.name === 'castBig')));
    arenaLookTick(ch, dt);
    animateHumanoid(ch, dt, { chain, bowRel: a && a.name === 'shoot' && a.hitK != null ? a.hitK : null, /* (the hero model's bow: when this shot's arrow is loosed) */ charging: !!(this.dodge && this.dodge.charge), turn: this.turnR || 0, rollDir, rollKind, aimStaff, aimPitch: this.pitch, speed: hs, vy: this.vel.y, land: this.landT || 0, airborne: !this.onGround && !this.swim, swim: this.swim, action, actionT, mirror, block: this.block, armed: !this.sheathed, ready: !!(this.atk || this.block || this.press || G.inCombat > 0 || G.time - (this.hitT || -99) < 5 || G.time - (this.hurtT0 || -99) < 5 || (this.abCast) || (this.channel && this.channel.on)), dead: this.dead, deadT: this.deadT, roll, spin, lookPitch: -this.pitch * 0.6, back: this.moveDir && this.moveDir.dot(this.fwd()) < -0.3 });
    { const D = this.dodge; if (roll == null) ch.body.rotation.z = D && D.kind === 'step' ? -Math.sin(Math.min(1, D.t) * Math.PI) * 0.3 * (Math.sign(D.dir.dot(this.right())) || 1) : 0; } // a side step leans into it (never during a roll: wiping the roll's own turn left a side roll floating up off the ground)
    bodyPoseTick(this, ch, dt); // (kicks)
    if (this.ultPoseT > 0) { this.ultPoseT -= dt; const k = Math.min(1, (1.5 - this.ultPoseT) * 5, this.ultPoseT * 4); /* (the ultimate cast: arms flung up and wide, head back, a lift off the ground) */
      for (const [A2, sx] of [[ch.arms.R, 1], [ch.arms.L, -1]]) { A2.sh.rotation.x += (-2.6 - A2.sh.rotation.x) * k; A2.sh.rotation.z += (sx * -0.7 - A2.sh.rotation.z) * k; A2.el.rotation.x += (-0.25 - A2.el.rotation.x) * k; }
      ch.body.position.y += 0.1 * k; /* (no head thrown back) */ if (Math.random() < 0.6) V.emit(this.h.cls === 'necromancer' ? 'poison' : 'gold', this.pos.clone().setY(this.pos.y + 0.3 + Math.random() * 1.8), { speed: 1.5, vy: 2.5, size: 0.3 }); }
    if (this.oozeT > 0) { this.oozeT -= dt; this.oozeE = (this.oozeE || 0) + dt; const k0 = Math.min(1, this.oozeE / 1.8), k = k0 * k0 * (3 - 2 * k0), out = Math.min(1, this.oozeT * 2); /* (the necromancer's ultimate: both hands rise, slowly, dripping green ooze) */
      for (const [A2, sx] of [[ch.arms.R, 1], [ch.arms.L, -1]]) { const kk = k * out; A2.sh.rotation.x += (-2.3 - A2.sh.rotation.x) * kk; A2.sh.rotation.z += (sx * -0.45 - A2.sh.rotation.z) * kk; A2.el.rotation.x += (-0.35 - A2.el.rotation.x) * kk; }
      ch.root.updateMatrixWorld(true); for (const A2 of [ch.arms.R, ch.arms.L]) if (Math.random() < 0.7) { const hp2 = A2.hand.getWorldPosition(new THREE.Vector3()); V.emit('poison', hp2, { speed: 0.25, vy: -2.2, size: 0.13, life: 0.75, radius: 0.08 }); if (Math.random() < 0.3) V.emit('green', hp2, { speed: 0.4, vy: 0.6, size: 0.18, life: 0.5 }); } }
    if (this.headUpT > 0) { this.headUpT -= dt; const A2 = ch.arms.L; A2.sh.rotation.set(-2.0, 0, -0.35); A2.el.rotation.x = -0.5; } // (the necromancer holds the shrunken head up)
    if (this.assnUntil && G.time > this.assnUntil) { this.assnUntil = 0; this.assnTier = 0.75; if (this.h.ultCharge >= 100) this.h.ultCharge = 0; } // (the rogue's chain of kills ran out: the ultimate charges again from nothing)
    if (this.h.arena && !this.dead) { const B3 = this.buffs; if (B3.anthem > 0 && Math.random() < dt * 1.6) playNotes(G.scene, this, '#ffd860', 1); if (B3.ward > 0 && Math.random() < dt * 1.6) playNotes(G.scene, this, '#7ac8ff', 1); if (B3.warsong > 0 && Math.random() < dt * 1.6) playNotes(G.scene, this, '#ff5a4a', 1); } // (the bard's buffs: their coloured notes drift round you while they last)
    if (this.h.arena && this.h.cls === 'bard') { const U = ch.weapons && ch.weapons.main && ch.weapons.main.userData; if (U) { U.calm = 0; const at = this.atk && this.atk.name === 'strum' ? Math.min(1, this.atk.t) : 1; U.stroke = at < 1 ? Math.sin(at * Math.PI) : 0; } luteToChest(ch, !this.dead && !this.dodge, G.time, dt); } // (the owner: the bard always holds the lute against his chest and strums it; he never swings it like a club)
    this.gunToShoulder(ch, this.camDist > 0.6 && this.W && this.W.kind === 'gun' && (this.adsK > 0.3 || (this.press && this.press.charging) || (this.atk && (this.atk.name === 'release' || this.atk.name === 'shoot'))), !action || action === 'gunAim');
    // view model
    const castNow = G.newFx && ((this.abCast && this.abCast.spell) ? this.abCast : this.summonCast);
    const vmAct = castNow ? { name: 'castUp', t: Math.min(1, castNow.t / Math.min(0.8, castNow.dur * 0.6)) } : g ? { name: g.anim, t: actionT } : a ? { name: a.name, t: Math.min(1, a.t) } : this.press && this.press.charging ? { name: this.W.kind === 'bow' ? 'draw' : this.W.kind === 'staff' ? 'chargeCast' : 'charge', t: this.press.aimShot ? Math.min(1, this.aimCharge() * 1.6) : Math.min(1, (this.press.t - 0.22) / 0.6) } : null;
    this.swayX += (-this.lookDX * 0.0004 - this.swayX) * Math.min(1, dt * 8); this.swayY += (this.lookDY * 0.0004 - this.swayY) * Math.min(1, dt * 8); this.lookDX = this.lookDY = 0;
    this.recoil = Math.max(0, (this.recoil || 0) - dt * 5);
    { const aiming = this.W && this.W.kind === 'gun' && this.press && this.press.charging; this.aimK = (this.aimK || 0) + ((aiming ? 1 : 0) - (this.aimK || 0)) * Math.min(1, dt * 9); }
    this.vm.update(dt, { rendAt: this.rendLook ? this.rendLook() : null, channel: !!(this.channel && this.channel.on), aim: Math.max(this.aimK || 0, this.adsK || 0), recoil: this.recoil, act: vmAct, block: this.block, speed: this.onGround ? hs : 0, sprint: this.sprinting && this.onGround, tool: !!g, drawing: this.press && this.press.charging && this.W.kind === 'bow' ? (this.press.t - 0.22) / 0.6 : 0, charge: this.press && this.press.charging ? Math.min(1, (this.press.t - 0.22) / 0.8) : 0, swayX: this.swayX, swayY: this.swayY - (this.swapT || 0) * 0.8, kick: this.kickT > 0 ? 1 - this.kickT / (this.kickDur || 0.55) : 0, superman: this.supermanT > 0 ? 1 - this.supermanT / 0.45 : 0 });
    // charge glow on weapon
    if (this.press && this.press.charging && Math.random() < 0.5) { const tip = this.camDist < 0.6 ? null : this.ch.weapons.main; if (this.camDist < 0.6 || (tip && tip.userData.tip)) { const p = tip ? tip.userData.tip.getWorldPosition(new THREE.Vector3()) : this.handPos(this.W.kind === 'bow'); V.emit(this.W.element || 'spark', p, { speed: 0.6, size: 0.12, life: 0.4 }); } }
    // stealth fade
    ch.root.traverse(o => { if (o.isMesh && o.material) { if (this.stealth > 0) { o.material.transparent = true; o.material.opacity = this.phaseInvis ? 0.05 : 0.35; } else if (o.material.opacity < 1) { o.material.opacity = 1; o.material.transparent = false; } } });
  }
  // the weapon you see while aiming down the barrel: built once per weapon, lifted into view, kicks when it fires
  adsView(ae) {
    const kind = this.W && this.W.kind === 'bow' ? 'bow' : this.weapon && this.weapon.wt === 'blunderbuss' ? 'blunderbuss' : this.W && this.W.kind === 'gun' ? 'musket' : null;
    if (this.adsG && (this.adsG.userData.kind !== kind)) { this.adsG.parent && this.adsG.parent.remove(this.adsG); this.adsG = null; }
    if (!kind || ae < 0.05) { if (this.adsG) this.adsG.visible = false; return; }
    if (kind === 'musket' && this.vm && this.vm.fpArms && this.vm.fpArms !== 'loading' && this.vm.gun) { if (this.adsG) this.adsG.visible = false; this.vm.g.visible = ae > 0.5 && !this.dead; return; } /* (a hero with his own 3D arms: the first-person musket and arms come up, the very same down-the-barrel view) */
    if (!this.adsG) { const ap = this.h.app || {}, cm = this.ch.mats || {}; this.adsG = buildAdsView(kind, { skin: ap.skin, cloth: cm.shirt && cm.shirt.color ? '#' + cm.shirt.color.getHexString() : undefined, goblin: this.h.arena && (this.h.cls === 'musketeer' || this.h.cls === 'blunderbuss') }); this.adsG.userData.kind = kind; G.vmCam.add(this.adsG); }
    const g = this.adsG, e = Math.max(0, (ae - 0.45) / 0.55), r = this.recoil || 0, t = G.time, mv = Math.min(1, (this.speed || 0) / 5);
    g.visible = ae > 0.5;
    g.position.set(Math.sin(t * 1.3) * 0.002 + Math.sin(t * 7) * 0.004 * mv, -(1 - e) * 0.22 + Math.sin(t * 1.1) * 0.0018 + Math.abs(Math.sin(t * 7)) * 0.006 * mv, r * 0.05);
    g.rotation.set((g.userData.base || 0) + r * 0.07 + (1 - e) * 0.35, 0, (1 - e) * -0.25 + Math.sin(t * 0.9) * 0.004);
    if (g.userData.hammer) g.userData.hammer.rotation.x = r > 0.2 ? 0.9 : 0; // the hammer falls when it fires
  }
  updateCamera(dt) {
    const cam = G.camera;
    if (this.cine) { this.ch.root.visible = !this.spectate && !this.dead; this.vm.g.visible = false; if (this.adsG) this.adsG.visible = false; cam.rotation.order = 'YXZ'; this.cine(cam, dt); cam.updateProjectionMatrix(); A.setListener(cam.position.x, cam.position.y, cam.position.z, this.yaw + Math.PI); return; } // (a cinematic shot has the camera)
    this.lookLag(dt);
    // like Paladins: first person, but the camera swings out behind you while an ultimate, a leap or a defensive stance plays, then back in
    this.tpT = Math.max(0, (this.tpT || 0) - dt); this.ultImmT = Math.max(0, (this.ultImmT || 0) - dt); if (this.barrageT > 0) { this.barrageT -= dt; this.barrageCd = (this.barrageCd || 0) - dt; if (this.lmbHeld && this.barrageCd <= 0 && !this.held && !this.isFrozen() && !this.dead) { this.barrageCd = 0.09; this.arcaneRound(); } }
    if (!(this.barrageT > 0) && this.lmbHeld && this.h.arena && this.W && !this.atk && !(this.press && this.press.aimShot) && !this.held && !this.isFrozen() && !this.dead && !G.uiOpen && document.pointerLockElement) this.light(); /* (left click held: auto-fire) */
    this.camDistT = Math.max(CAM_MIN, this.camDistT); if (this.camDist < CAM_MIN * 0.5 && !this.cine) this.camDist = CAM_MIN; /* (the owner: no first-person view: the camera always stays behind the hero) */
    const camWant = this.tpT > 0 && !this.dead ? Math.max(this.tpDist || 3.4, this.camDistT) : this.camDistT; if (this.tpT <= 0) this.tpDist = 0;
    this.camDist += (camWant - this.camDist) * Math.min(1, dt * (camWant > this.camDistT ? 7 : 5));
    const fp = this.camDist < 0.6;
    const tpAim = !fp; /* (the owner: no first-person view at all: aiming is always over the shoulder) */ /* (a hero with his own 3D model aims over the shoulder in third person: he stays in view with his real weapon, no down-the-sights view with the old built arms) */ this.ch.root.visible = (!fp || this.dead) && !this.spectate && !((this.adsK || 0) > 0.5 && !fp && !tpAim); V.fpPos = fp && !this.dead ? this.pos : null;
    this.vm.g.visible = fp && !this.dead;
    for (const t of [this.trail, this.trailL]) { const want = fp ? G.vmScene : G.scene; if (t.mesh.parent !== want) want.add(t.mesh); if (t.mat.uniforms.nearF) t.mat.uniforms.nearF.value.set(fp ? 0.4 : 1.8 + this.camDist * 0.25, fp ? 0.85 : 3.6 + this.camDist * 0.3); } /* (first person: only the bit of streak right on the lens fades; third person: anything nearer than the hero fades out) */
    this.landDip *= Math.max(0, 1 - dt * 6);
    { const HM = this.ch && this.ch.heroModel; if (HM && HM !== 'loading' && HM.bones && HM.bones.Head && this._eyeHM !== HM) { this._eyeHM = HM; HM.m.updateMatrixWorld(true); const hy = HM.bones.Head.getWorldPosition(new THREE.Vector3()).y - this.ch.root.getWorldPosition(new THREE.Vector3()).y, top = heroHeight(this.h.cls); if (hy > 0.3 && hy < top) this.eye = hy + (top - hy) * 0.38; } } /* (your eye sits where the model's own eyes are, measured from its head bone, so a figure of your own class looks you straight in the eye) */
    let eyeY = this.eye - this.landDip + (this.block ? -0.05 : 0);
    if (this.dodge && !this.dodge.charge) eyeY -= Math.sin(Math.min(1, this.dodge.t) * Math.PI) * (fp ? (this.h.arena ? 0.12 : 0.7) : 0.2); // (the arena: barely a dip, no roll) // (the over-the-shoulder camera barely dips: the body does the rolling)
    if (this.dead) eyeY = this.spectate ? 0 : 0.4; // (arena spectators fly free)
    if (this.swim) eyeY = 1.35;
    const eye = this.pos.clone(); eye.y += eyeY;
    if (fp && settings.headBob && !this.h.arena && this.onGround && this.speed > 0.5) eye.y += Math.abs(Math.sin(this.vm.bob)) * 0.04;
    cam.rotation.order = 'YXZ';
    cam.rotation.set(this.pitch, this.yaw + Math.PI, 0);
    if (this.dodge && !this.dodge.charge && fp && !this.h.arena) cam.rotation.z = Math.sin(Math.min(1, this.dodge.t) * Math.PI) * 0.15 * Math.sign(this.dodge.dir.dot(this.right()) || 1);
    if (this.dead && !this.spectate) cam.rotation.z = Math.min(1, this.deadT) * 0.6;
    if (fp) cam.position.copy(eye);
    else {
      const back = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
      // over the right shoulder: the hero sits left of the crosshair
      const ak = this.adsK || 0, ae = ak * ak * (3 - 2 * ak); // aiming down the barrel: the camera slides in behind the stock and looks along the sights
      // framed by the hero's real height (the 3D model, not the hidden built body): the camera sits just above the head,
      // further back and further over the shoulder for a giant (so he never hides what he faces), close and low for a goblin
      const HH = this.h.arena && hasHeroModel(this.h.cls) ? heroHeight(this.h.cls) : this.ch.height, hk = Math.max(0.8, Math.min(2.4, HH / 2.6)), tpk = Math.min(1, this.camDist / 2.5);
      const sh = this.right().multiplyScalar((this.h.arena ? 0.34 * HH + 0.1 : 0.72) * tpk);
      eye.y += this.h.arena ? (HH * 0.94 + 0.2 - this.eye) * tpk : 0.12; // (a lower camera keeps the hero up in the frame, clear of the bars at the bottom)
      let d = this.camDist * (this.h.arena ? hk : 1);
      for (let s = 0.5; s <= d; s += 0.4) { const p = eye.clone().add(sh).addScaledVector(back, -s); if (p.y < heightAt(p.x, p.z) + 0.3 || solidAt(p.x, p.y, p.z) || (G.camOcc && G.camOcc.some(o => { const dx = p.x - o.x, dy = (p.y - o.y) / (o.sy || 1), dz = p.z - o.z; return dx * dx + dy * dy + dz * dz < (o.r - 0.6) * (o.r - 0.6); }))) { d = Math.max(0.5, s - 0.4); break; } } /* (and tree crowns: the camera pulls in rather than sit inside the leaves) */ /* (walls too: a giant's longer camera never ends up inside a building) */
      // the camera follows a smoothed point, so steps, landings and rolls don't jolt it
      if (!this.camA || this.camA.distanceTo(eye) > 6) this.camA = eye.clone();
      const kh = Math.min(1, dt * 18), kv = Math.min(1, dt * 9); this.camA.x += (eye.x - this.camA.x) * kh; this.camA.z += (eye.z - this.camA.z) * kh; this.camA.y += (eye.y - this.camA.y) * kv;
      cam.position.copy(this.camA).add(sh).addScaledVector(back, -d);
      // aiming down the barrel: the eye moves to the cheek weld and a detailed weapon comes up into view (drawn on top, like first person)
      if (ae > 0.001 && !tpAim) { const cw = this.pos.clone().addScaledVector(this.fwd(), 0.08); cw.y += this.eye - 0.02; cam.position.lerp(cw, ae); }
      this.adsView(tpAim ? 0 : ae);
    }
    // shake
    const sk = V.shake * V.shake;
    if (sk > 0) { const t = G.time; cam.position.x += Math.sin(t * 37) * Math.sin(t * 13) * sk * 0.2; cam.position.y += Math.sin(t * 41 + 1) * Math.sin(t * 11) * sk * 0.2; cam.rotation.z += Math.sin(t * 29) * sk * 0.03; } // a smooth rumble, not random jitter
    this.fovKick *= Math.max(0, 1 - dt * 4);
    this.fovS = (this.fovS || 0) + ((this.sprinting ? 7 : 0) - (this.fovS || 0)) * Math.min(1, dt * 6);
    // Kingdom Battles: zoom in a little while drawing the bow (and much more when aiming a musket)
    { const gun = this.W && this.W.kind === 'gun'; const drawing = G.battleFx && this.press && this.press.charging && this.W && (this.W.kind === 'bow' || gun); const want = Math.min(-(this.adsK || 0) * (!gun ? 25 : this.weapon && this.weapon.wt === 'blunderbuss' ? 15 : 50) /* (the owner: the musket zooms in further) */, /* zoom: musket furthest, then bow, then blunderbuss (the owner: each a little deeper, about a quarter more) */ drawing ? (gun ? -Math.min(1, (this.press.t - 0.22) / 1.4) * 22 - 8 : -Math.min(1, (this.press.t - 0.22) / 1.8) * 9 - 3) : 0); this.bowZoom = (this.bowZoom || 0) + (want - (this.bowZoom || 0)) * Math.min(1, dt * (drawing ? 5 : this.ads ? 11 : 12)); }
    cam.fov = settings.fov - (G.fovTrim || 0) + this.fovKick + this.fovS + (this.bowZoom || 0); // (the arena narrows the view a little so fighters look bigger)
    cam.updateProjectionMatrix();
    A.setListener(cam.position.x, cam.position.y, cam.position.z, this.yaw + Math.PI);
  }
}
function W2kind(W) { return W ? W.kind : ''; }
