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
import { armReach, buildHumanoid, equipWeapon, animateHumanoid, makeWeapon, holdTool, tintGear, bake, backWeapons, sheathe } from './character.js';
import { heightAt, isWater, waterLevelAt, zoneAt, SEA } from './terrain.js';
import { world, collide, groundAt, surfaceType, nodesNear, hideNode, nodeKinds } from './world.js';
import { activeWeapon, swapSets, setIsEmpty, pairedWt, heroDerived, weaponDamage, gatherReward, toolProblem, useItem, count, lootCorpse, hasLoot, addItem, perk, wperk, ensureProc } from './game.js';
import { FOOD_BUFFS, ITEMS, PROCS, procChance, LEVEL_CAP, designLv, isSupport } from './data.js';
import { BATTLE } from './battlemap.js';
import { summonPets } from './pets.js';
import { buildAdsView } from './adsview.js';
import { luteToChest, playNotes, addOutline, arenaSpec, arenaBody, arenaDecor, arenaWeaponDecor, arenaLookTick } from './arenalooks.js';
import { plantBanner } from './banners.js';
import * as Skills from './skills.js';
import * as Game from './game.js';
import { aimRay, groundPoint, mobsInCone, mobsInRadius, areaDamage, spawnProjectile, lightning, foe } from './combat.js';
import { angDiff, rand, clamp } from './util.js';
// Kingdom Battles: a glowing slash crescent that covers the swing's real hit area
const ARC_GEO = new Map();
const ARC_MAT = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
function slashArc(pl, R, H, name, hit, col) {
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
// Shift dodges: a quick side step, a rolling dodge that goes further, a leaping roll that goes furthest
const DODGES = { old: { dur: 0.6, speed: 10, cost: 16, ifr: 0.42 }, step: { dur: 0.34, speed: 11, cost: 14, ifr: 0.24 }, roll: { dur: 0.62, speed: 10.5, cost: 20, ifr: 0.42 }, leap: { dur: 0.75, speed: 12.5, cost: 26, ifr: 0.55, vy: 5.5 } }; // slower, weightier dodges you can follow with your eyes
const DODGE_OF = { warrior: 'step', cleric: 'step', paladin: 'step', darkknight: 'step',
  berserker: 'roll', musketeer: 'roll', wizard: 'roll', druid: 'roll', bard: 'roll', necromancer: 'roll', elementalist: 'roll', enchanter: 'roll', shaman: 'roll',
  monk: 'leap', ranger: 'leap', rogue: 'leap', beastmaster: 'leap' };
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
  ohA: P(0.2, 0.3, -0.32, 1.25, 0, 0.12), ohB: P(0.04, -0.5, -0.62, -1.55, 0, 0.05),
  ha: P(0.45, 0.25, -0.15, 0.6, -0.5, -0.3), hb: P(0, -0.45, -0.62, -2.1, 0.3, 0),
  spRest: P(0.24, -0.3, -0.3, -1.45, 0.06, 0), thA: P(0.3, -0.25, -0.1, -1.5, 0.05, 0), thB: P(0.12, -0.2, -0.95, -1.56, 0, 0), th3A: P(0.32, 0.05, 0.0, -1.3, 0.1, 0), th3B: P(0.05, -0.25, -1.2, -1.65, 0, 0),
  blockW: P(0.15, -0.12, -0.45, -0.3, 0, 1.45), shieldRest: P(-0.48, -0.6, -0.55, 0.25, 0.5, 0.12), shieldBlock: P(-0.22, -0.31, -0.33, 0.1, 0.42, 0.04), swordLow: P(0.48, -0.5, -0.5, -0.15, 0.1, 0.1),
  bowL: P(-0.3, -0.06, -0.62, 0, 0.1, 0.18), bowR: P(-0.17, -0.15, -0.58, -1.5, 0, 0), bowRdraw: P(-0.13, -0.12, -0.3, -1.5, 0, 0),
  staff: P(0.32, -0.6, -0.58, -0.15, 0, -0.1), staffCast: P(0.15, -0.28, -0.5, -1.38, 0.06, -0.08), staffHigh: P(0.2, -0.24, -0.5, -0.2, 0, -0.1), staffSlam: P(0.14, -0.42, -0.72, -1.05, 0, 0),
  castL: P(-0.18, -0.24, -0.62, -1.4, 0, 0), handUpR: P(0.26, 0.06, -0.6, -0.25, 0, -0.25), handUpL: P(-0.26, 0.06, -0.6, -0.25, 0, 0.25), handPushR: P(0.16, -0.12, -0.78, -1.45, 0, -0.1), handPushL: P(-0.16, -0.12, -0.78, -1.45, 0, 0.1), chopA: P(0.38, 0.2, -0.3, 0.3, -0.3, -0.3), chopB: P(0.02, -0.35, -0.65, -1.7, 0.2, 0.2),
  gatherR: P(0.12, -0.6, -0.55, -1.2, 0, 0), gatherR2: P(0.08, -0.7, -0.5, -1.4, 0, 0),
};
function mirror(p) { return [-p[0], p[1], p[2], p[3], -p[4], -p[5]]; }
function plerp(a, b, t) { return a.map((v, i) => v + (b[i] - v) * t); }
function seq(a, b, t, wind = 0.35, rest = VP.rest) { return t < wind ? plerp(rest, a, ease(t / wind)) : t < 0.72 ? plerp(a, b, easeOut((t - wind) / (0.72 - wind))) : plerp(b, rest, ease((t - 0.72) / 0.28)); }

// a detailed gripping hand: palm, four curled fingers, thumb, knuckles, class glove and cuff
function makeHand(right, cls, skinCol) {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: skinCol, roughness: 0.6 });
  const glove = cls === 'warrior' ? new THREE.MeshStandardMaterial({ color: '#aab2bc', roughness: 0.3, metalness: 0.85 }) : cls === 'ranger' ? new THREE.MeshStandardMaterial({ color: '#5a3a20', roughness: 0.8 }) : skin;
  const fingerM = cls === 'ranger' ? skin : glove; // rangers wear fingerless gloves
  const sx = right ? 1 : -1;
  // palm wraps the handle (the handle runs along local Y through the origin)
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.036, 14, 10), glove); palm.scale.set(1.15, 1.35, 1.0); palm.position.set(sx * 0.03, 0.0, 0.012); g.add(palm);
  // four fingers curl around the grip
  for (let i = 0; i < 4; i++) {
    const r = 0.026 - i * 0.0015;
    const f = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0115 - i * 0.0008, 7, 12, Math.PI * 1.25), fingerM);
    f.rotation.x = Math.PI / 2; f.rotation.z = right ? Math.PI * 0.05 : Math.PI * 0.7; f.position.y = 0.033 - i * 0.022; g.add(f);
    if (cls === 'warrior') { const k = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.016, 0.02), glove); k.position.set(sx * 0.005, 0.033 - i * 0.022, -0.03); g.add(k); }
    else { const k = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 5), fingerM); k.position.set(sx * 0.0, 0.033 - i * 0.022, -0.033); g.add(k); }
  }
  // thumb over the top of the fingers
  const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.035, 4, 8), fingerM); th.position.set(-sx * 0.012, 0.03, -0.026); th.rotation.z = sx * 1.1; th.rotation.x = 0.4; g.add(th);
  // back of the hand plate / glove detail
  if (cls === 'warrior') { const plate = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.085, 0.06), glove); plate.position.set(sx * 0.07, 0, 0.012); g.add(plate); }
  if (cls === 'wizard') { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0145, 0.004, 6, 14), new THREE.MeshStandardMaterial({ color: '#e0b040', metalness: 0.9, roughness: 0.3 })); ring.rotation.x = Math.PI / 2; ring.position.set(0, 0.011, 0); g.add(ring); const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.007), new THREE.MeshStandardMaterial({ color: '#8a40ff', emissive: '#6a20ff', emissiveIntensity: 1.2 })); gem.position.set(0, 0.011, -0.04); g.add(gem); }
  // wrist / cuff
  const cuffM = cls === 'warrior' ? glove : cls === 'ranger' ? new THREE.MeshStandardMaterial({ color: '#6a4628', roughness: 0.8 }) : new THREE.MeshStandardMaterial({ color: CLASSES.wizard.colors.trim, roughness: 0.4, metalness: 0.6 });
  const wrist = new THREE.Object3D(); wrist.position.set(sx * 0.055, -0.04, 0.03); g.add(wrist);
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.041, 0.24, 14), cuffM); cuff.position.y = -0.09; wrist.add(cuff);
  if (cls === 'ranger') for (const y of [-0.016, 0.016]) { const strap = new THREE.Mesh(new THREE.TorusGeometry(0.043, 0.004, 4, 16), new THREE.MeshStandardMaterial({ color: '#2a1a0e' })); strap.rotation.x = Math.PI / 2; strap.position.y = y; wrist.add(strap); }
  if (cls === 'warrior') { const rim = new THREE.Mesh(new THREE.TorusGeometry(0.043, 0.006, 5, 16), new THREE.MeshStandardMaterial({ color: CLASSES.warrior.colors.trim, metalness: 0.9, roughness: 0.3 })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.03; wrist.add(rim); }
  g.userData.wrist = wrist;
  g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
  return g;
}
class ViewModel {
  constructor(camera, app, cls) {
    this.g = new THREE.Group(); camera.add(this.g);
    this.R = new THREE.Group(); this.L = new THREE.Group(); this.R.rotation.order = this.L.rotation.order = 'YXZ'; this.g.add(this.R, this.L);
    this.R.add(makeHand(true, cls, app.skin)); this.L.add(makeHand(false, cls, app.skin));
    const c = CLASSES[cls].colors;
    const sleeve = cls === 'warrior' ? new THREE.MeshStandardMaterial({ color: '#8a929c', roughness: 0.4, metalness: 0.75 }) : new THREE.MeshStandardMaterial({ color: c.main, roughness: 0.85, side: THREE.DoubleSide });
    const trimM = new THREE.MeshStandardMaterial({ color: c.trim, roughness: 0.45, metalness: cls === 'ranger' ? 0 : 0.6 });
    this.arms = [this.R, this.L].map(H => {
      const arm = new THREE.Group(); this.g.add(arm);
      // forearm: tapered sleeve (wizards get a wide bell sleeve), a trim ring and some cloth folds
      const geo = cls === 'wizard' ? new THREE.CylinderGeometry(0.052, 0.085, 1, 16, 1, true) : new THREE.CylinderGeometry(0.044, 0.058, 1, 16, 1, true);
      const m = new THREE.Mesh(geo, sleeve); arm.add(m);
      const trim = new THREE.Mesh(new THREE.TorusGeometry(cls === 'wizard' ? 0.055 : 0.047, 0.007, 6, 18), trimM); trim.rotation.x = Math.PI / 2; arm.add(trim);
      if (cls === 'warrior') { for (let i = 1; i < 4; i++) { const band = new THREE.Mesh(new THREE.TorusGeometry(0.05 + i * 0.002, 0.004, 4, 16), sleeve); band.rotation.x = Math.PI / 2; band.userData.t = i * 0.12; arm.add(band); } }
      arm.traverse(o => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
      return { arm, m, trim, H };
    });
    this.anchor = [new THREE.Vector3(0.36, -1.15, -0.25), new THREE.Vector3(-0.36, -1.15, -0.25)];
    this.weapons = {}; this.bob = 0; this.sprintK = 0;
  }
  setWeapon(w) {
    for (const k in this.weapons) { const o = this.weapons[k]; o.parent && o.parent.remove(o); }
    this.weapons = {}; this.wt = w ? w.wt : null; if (!w) return;
    const W = WEAPON_TYPES[w.wt];
    const main = makeWeapon(W.parts[0], w.tier, w.rarity, W.element);
    if (W.kind === 'bow') { this.L.add(main); main.scale.setScalar(0.42); this.weapons.bow = main; const ar = new THREE.Group(); const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.75, 5), new THREE.MeshStandardMaterial({ color: '#8a6a44' })); shaft.rotation.x = Math.PI / 2; shaft.position.z = -0.35; ar.add(shaft); const tip = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.07, 4), new THREE.MeshStandardMaterial({ color: '#999', metalness: 0.8 })); tip.rotation.x = -Math.PI / 2; tip.position.z = -0.74; ar.add(tip); this.R.add(ar); this.weapons.arrow = ar; }
    else if (W.kind === 'gun') { this.g.add(main); this.weapons.main = main; this.gun = main; }
    else { this.R.add(main); this.weapons.main = main; }
    if (W.kind !== 'gun') this.gun = null;
    if (W.kind === 'staff') main.position.y = -0.55;
    if (w.wt === 'spear') main.position.y = -0.55;
    if (W.hands === 'two' && w.wt !== 'spear') main.position.y = -0.1;
    if (W.kind === 'melee' && w.wt !== 'spear') main.rotation.y = (W.parts[0] === 'sword' || W.parts[0] === 'greatsword' || W.parts[0] === 'dagger') ? 0.45 : W.parts[0] === 'handaxe' || W.parts[0] === 'greataxe' ? Math.PI / 2 : 0; // swords show the blade at an angle; axe edges face forward
    if (W.hands === 'two' && w.wt !== 'spear') main.scale.multiplyScalar(0.8);
    if (W.parts[1]) { const off = makeWeapon(W.parts[1], w.tier, w.rarity); this.L.add(off); this.weapons.off = off; if (W.parts[1] === 'sword' || W.parts[1] === 'dagger') off.rotation.y = -0.45; if (W.parts[1] === 'handaxe') off.rotation.y = Math.PI / 2; if (W.parts[1] === 'shield') { off.rotation.set(0, 0, 0); off.scale.setScalar(0.46); off.position.set(0.06, 0.1, -0.13); } }
    for (const k in this.weapons) this.weapons[k].scale.multiplyScalar(1.5);
    if (W.kind === 'gun') main.scale.setScalar(0.62);
    this.g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
    this.W = W;
  }
  setTool(tool, tier) { if (this.tool) { this.tool.parent.remove(this.tool); this.tool = null; } for (const k in this.weapons) this.weapons[k].visible = !tool; if (tool) { this.tool = makeWeapon(tool, tier); this.R.add(this.tool); this.tool.traverse(o => { if (o.isMesh) o.castShadow = false; }); } }
  apply(H, p) { H.position.set(p[0], p[1], p[2]); H.rotation.set(p[3], p[4], p[5]); }
  update(dt, st) {
    const W = this.W, act = st.act;
    let r = W ? (W.kind === 'staff' ? VP.staff : this.wt === 'spear' ? VP.spRest : W.hands === 'two' ? VP.rest2 : VP.rest) : VP.rest;
    let l = !W ? VP.hideL : W.hands === 'shield' ? VP.shieldRest : W.hands === 'dual' ? VP.restL : W.kind === 'bow' ? VP.bowL : W.kind === 'staff' ? VP.hideL : null;
    if (W && W.kind === 'bow') r = VP.bowR;
    const t = act ? act.t : 0, n = act ? act.name : '';
    if (this.weapons.main && n !== 'castUp' && !st.sheathed) this.weapons.main.visible = !this.hiddenAll; // the staff comes back after a cast
    if (st.tool) {
      if (n === 'chop' || n === 'mine') r = seq(n === 'chop' ? VP.chopA : VP.s3a, n === 'chop' ? VP.chopB : VP.s3b, t, 0.45);
      else r = plerp(VP.gatherR, VP.gatherR2, 0.5 + 0.5 * Math.sin(t * Math.PI * 4));
      l = W && W.kind === 'bow' ? VP.hideL : l;
      if (W && (W.kind === 'bow' || W.hands === 'dual' || W.kind === 'staff')) l = VP.hideL;
    } else if (W && W.kind === 'gun' && st.block && !act) {
      // blocking with a musket: held level across the body, stock to the left, barrel to the right
      if (this.gun) { this.gun.position.set(0.05, -0.13, -0.4); this.gun.rotation.set(-0.15, 0, -Math.PI / 2 + 0.08); }
      r = [0.2, -0.2, -0.38, -1.25, 0, 0.6]; l = [-0.2, -0.19, -0.4, -1.25, 0, -0.6];
    } else if (W && W.kind === 'gun' && (!act || n === 'shoot' || n === 'draw' || n === 'release' || n === 'cast')) {
      // musket at the hip, raised to the eye while aiming, with a kick on every shot
      // the musket sits in camera space: at the hip, or raised under the eye when aiming; the right hand holds the grip
      const k = st.aim || 0, rc = st.recoil || 0, gp = [lerp(0.24, 0, k), lerp(-0.27, -0.036, k), lerp(-0.5, -0.4, k) + rc * 0.07];
      if (this.gun) { this.gun.position.set(gp[0], gp[1], gp[2]); this.gun.rotation.set(-Math.PI / 2 + rc * 0.22 + (1 - k) * 0.06, (1 - k) * 0.05, 0); }
      r = [gp[0] + 0.01 + k * 0.03, gp[1] - 0.05 - k * 0.03, gp[2] + 0.14, -1.2, 0, 0.1]; l = [gp[0] - 0.02, gp[1] - 0.02 - k * 0.04, gp[2] - 0.22, -1.4, 0, -0.2];
    } else if (act) {
      const dual = W && W.hands === 'dual';
      switch (n) {
        case 'swing1': r = seq(VP.s1a, VP.s1b, t, 0.3); break;
        case 'swing2': r = seq(VP.s2a, VP.s2b, t, 0.3); break;
        case 'lowcut': r = seq(VP.s2a, VP.s2b, t, 0.3); break;
        case 'sweep': r = seq(VP.s1a, VP.s1b, t, 0.3); break;
        case 'kick': break;
        case 'swing3': r = seq(VP.s3a, VP.s3b, t, 0.42); if (dual) l = seq(mirror(VP.s3a), mirror(VP.s3b), t, 0.42, VP.restL); break;
        case 'off1': l = seq(mirror(VP.s1a), mirror(VP.s1b), t, 0.3, VP.restL); break;
        case 'off2': l = seq(mirror(VP.s2a), mirror(VP.s2b), t, 0.3, VP.restL); break;
        case 'charge': if (G.battleFx && SWORDS[this.wt]) { const k = Math.min(1, t); r = plerp(VP.rest, VP.ohA, ease(k)); if (this.wt === 'greatsword') l = null; break; }
        case 'charge': { const k = Math.min(1, t); r = plerp(this.wt === 'spear' ? VP.spRest : VP.rest, this.wt === 'spear' ? VP.th3A : VP.ha, ease(k)); r = r.map((v, i) => v + (i < 3 ? Math.sin(performance.now() * 0.05) * 0.004 * st.charge : 0)); if (dual) l = plerp(VP.restL, mirror(VP.ha), ease(k)); break; }
        case 'smash': r = seq(VP.ha, VP.hb, t, 0.5); if (dual || (W && W.hands === 'two')) l = seq(mirror(VP.ha), mirror(VP.hb), t, 0.5, VP.restL); break;
        case 'stabR': r = seq(VP.thA, VP.thB, t, 0.3, VP.rest); break;
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
        case 'castUp': r = plerp(VP.rest, VP.handUpR, ease(Math.min(1, t))); l = plerp(VP.restL, VP.handUpL, ease(Math.min(1, t))); if (this.weapons.main) this.weapons.main.visible = t < 0.15; break;
        case 'castRel': r = plerp(VP.handUpR, VP.handPushR, ease(Math.min(1, t * 2))); l = plerp(VP.handUpL, VP.handPushL, ease(Math.min(1, t * 2))); break;
        case 'chargeCast': r = plerp(VP.staff, VP.staffHigh, ease(Math.min(1, t))); l = plerp(VP.hideL, VP.castL, ease(Math.min(1, t))); break;
        case 'castBig': r = seq(VP.staffHigh, VP.staffSlam, t, 0.45, VP.staff); l = seq(VP.castL, VP.castL, t, 0.3, VP.hideL); break;
        case 'spell': l = seq(VP.castL, VP.castL, t, 0.25, l || VP.hideL); if (W && W.kind === 'staff') r = seq(VP.staffCast, VP.staffCast, t, 0.3, VP.staff); break;
      }
    } else if (st.channel && W && W.kind === 'staff') {
      const j = Math.sin(performance.now() * 0.03) * 0.004; r = [0.13 + j, -0.25 + j, -0.42, -1.48, 0.06, -0.1]; l = [-0.15, -0.24, -0.55, -1.4, 0, 0.12];
    } else if (st.block) {
      if (W && W.hands === 'shield') { l = VP.shieldBlock; } // just the shield comes up; the sword stays where it was
      else if (W && W.kind === 'staff') r = [0.05, -0.3, -0.5, -0.1, 0, 1.3];
      else if (W && W.kind === 'bow') { l = [0.02, -0.13, -0.44, -0.2, 0.1, 1.5]; r = [0.3, -0.42, -0.4, -0.4, 0, 0.4]; }
      else { r = VP.blockW; if (W && W.hands === 'dual') l = [-0.12, -0.2, -0.45, -0.3, 0, -1.45]; }
    } else if (st.drawing) { r = plerp(VP.bowR, VP.bowRdraw, easeOut(Math.min(1, st.drawing))); }
    // sprinting: lower the weapon and pump the arms
    this.sprintK += ((st.sprint && !act && !st.block && !st.tool ? 1 : 0) - this.sprintK) * Math.min(1, dt * 8);
    if (this.sprintK > 0.01) {
      const sp = W && W.kind === 'bow' ? [0.05, -0.3, -0.5, 0.2, 0.3, 0.9] : W && W.kind === 'staff' ? [0.35, -0.55, -0.45, -0.6, 0.4, -0.7] : [0.36, -0.42, -0.42, -0.25, 0.5, -1.0];
      r = plerp(r, sp, this.sprintK);
      if (l && W && W.kind !== 'bow') l = plerp(l, [-0.36, -0.45, -0.42, -0.2, -0.5, 1.0], this.sprintK);
    }
    // two-handers: left hand on the grip below the right
    this.apply(this.R, r);
    if (W && W.hands === 'two' && W.kind !== 'gun' && !st.tool) { this.L.position.copy(this.R.localToWorld(new THREE.Vector3(0, -0.14, 0))); this.g.worldToLocal(this.L.position); this.L.rotation.copy(this.R.rotation); this.L.visible = true; }
    else if (l) { this.apply(this.L, l); this.L.visible = true; } else this.L.visible = false;
    // bob & sway: arms swing with each stride, harder and faster when sprinting
    this.bob += dt * st.speed * 1.75;
    const run = Math.min(1, st.speed / 5) * (act ? 0.35 : 1), amp = run * (0.022 + this.sprintK * 0.05);
    const ph = this.bob;
    const spread = run * (0.09 + this.sprintK * 0.06);
    this.R.position.x += spread; this.R.position.y -= spread * 0.6; this.R.rotation.z -= spread * 1.2;
    if (this.L.visible && !(W && W.hands === 'two')) { this.L.position.x -= spread; this.L.position.y -= spread * 0.6; this.L.rotation.z += spread * 1.2; }
    this.R.position.y += Math.sin(ph) * amp; this.R.position.x += Math.cos(ph * 0.5) * amp * 0.6; this.R.position.z += Math.cos(ph) * amp * 0.8 * this.sprintK; this.R.rotation.z += Math.sin(ph) * amp * 1.2; this.R.rotation.x += Math.cos(ph) * amp * (1 + this.sprintK * 3);
    if (this.L.visible && !(W && W.hands === 'two')) { this.L.position.y += Math.sin(ph + Math.PI) * amp; this.L.position.x += Math.cos(ph * 0.5) * amp * 0.6; this.L.position.z += Math.cos(ph + Math.PI) * amp * 0.8 * this.sprintK; this.L.rotation.x += Math.cos(ph + Math.PI) * amp * (1 + this.sprintK * 3); }
    const bob = settings.headBob ? Math.abs(Math.sin(this.bob)) * 0.01 * run : 0;
    this.g.position.set(st.swayX, -0.04 - bob - 0.004 * Math.sin(performance.now() * 0.0015) + st.swayY, -0.16);
    // bow string pull
    if (this.weapons.bow) { const s = this.weapons.bow.userData.string; const pull = st.drawing ? Math.min(1, st.drawing) : n === 'shoot' && t < 0.5 ? easeOut(t * 2) : 0; const a = s.geometry.attributes.position; a.setZ(1, (this.weapons.bow.userData.stringZ || 0.02) + pull * 0.42); a.needsUpdate = true; this.weapons.arrow.visible = pull > 0.05 || st.drawing > 0; }
    // forearms follow from the wrist down toward the elbow (off screen)
    for (let i = 0; i < 2; i++) {
      const { arm, m, trim, H } = this.arms[i]; arm.visible = false;
      if (!H.visible) continue;
      const wr = H.children[0].userData.wrist;
      const w = new THREE.Vector3(); wr.getWorldPosition(w); this.g.worldToLocal(w);
      const a = this.anchor[i], d = a.clone().sub(w), len = d.length(); d.normalize();
      arm.position.copy(w); arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
      m.scale.set(1, len, 1); m.position.set(0, len / 2 + 0.03, 0);
      trim.position.set(0, 0.035, 0);
      for (const c of arm.children) if (c.userData.t) c.position.set(0, 0.06 + c.userData.t, 0);
    }
  }
}

// ---------- Player ----------
const SWORDS = { sword: 1, swordshield: 1, swordmace: 1, greatsword: 1 };
const HEAL_K = { cleric: 1, druid: 1, shaman: 1, bard: 1, monk: 1, warrior: 0.8, berserker: 0.8, rogue: 0.5, enchanter: 0.6, paladin: 0.6, ranger: 0.35, beastmaster: 0.35, darkknight: 0.4, necromancer: 0.8 }; // shadow knights and necromancers heal only by draining: the knight a little, the necromancer a lot
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
    this.camDist = 0; this.camDistT = 0;
    this.cd = { w0: 0, w1: 0, a1: 0, a2: 0, a3: 0, dodge: 0 }; this.useCd = 0;
    this.atk = null; this.queued = null; this.combo = 0; this.comboT = 0; this.press = null; this.block = false;
    this.dodge = null; this.iframes = 0; this.stealth = 0; this.buffs = { cry: 0, fury: 0, nextCrit: false }; this.regen = null;
    this.gathering = null; this.hurtT = 0; this.stepAcc = 0; this.lastSurf = 'grass'; this.endUseT = 0; this.manaUseT = 0;
    this.fb = {}; this.swayX = 0; this.swayY = 0; this.fovKick = 0; this.landDip = 0; this.lookDX = 0; this.lookDY = 0;
    const app = Object.assign({ race: hero.race, sex: hero.sex, cls: hero.cls }, hero.app);
    this.app = app;
    this.vm = new ViewModel(G.vmCam, app, hero.cls);
    this.trail = V.trail('#ffffff'); this.trailL = V.trail('#ffffff');
    this.refreshGear(true);
    this.eye = this.ch.height * 0.9;
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
  onKey(code, down) {
    if (!down) return;
    if (this.dead) return;
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
      case 'KeyR': this.quaff(); break;
      case 'KeyV': this.camDistT = this.camDistT > 0.5 ? 0 : 3.2; break;
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
    if (down && this.fearT > 0) return; // fleeing in terror: no attacks
    if (btn === 0) this.lmbDown = down;
    if (down && this.sheathed && !this.dead && !G.uiOpen && (btn === 0 || btn === 2)) { this.drawWeapons(); if (btn === 0) { this.lmbDown = false; return; } }
    if (this.dead || G.uiOpen) return;
    if (down && this.db && this.db.stun && this.db.stun.t > 0) return;
    if (btn === 0 && this.h.arena && this.W && !(this.W.kind === 'staff' && this.h.cls === 'necromancer')) { if (down) { this.cancelGather(); this.press = null; this.light(); } return; } // the arena: no heavy attacks; press or hold to keep attacking (bows and guns too) // the arena: press or hold to keep attacking
    // Kingdom Battles bows: hold left click to draw, release to shoot (a longer draw is stronger and straighter)
    if (btn === 0 && G.battleFx && this.W && (this.W.kind === 'bow' || this.W.kind === 'gun')) {
      if (down) { this.cancelGather(); if (!this.atk && !this.dodge && !this.block) this.press = { t: 0, charging: false }; }
      else if (this.press) { const pr = this.press; this.press = null; if (pr.charging) this.releaseHeavy(pr); else this.light(); }
      return;
    }
    // Kingdom Arena: right click blocks only with a shield; a bow or gun aims down the barrel; everyone else casts a fourth ability
    if (btn === 2 && this.h.arenaRmb !== undefined && !(this.W && this.W.hands === 'shield')) {
      this.rmbHeld = false;
      if (this.h.arenaRmb === 'aim' || (this.W && (this.W.kind === 'bow' || this.W.kind === 'gun'))) { this.adsHeld = down; return; }
      if (down && this.h.arenaRmb) { const k = ABILITIES[this.h.cls].findIndex(a => a.id === this.h.arenaRmb); if (k >= 0) this.ability(k); }
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
  // the campaign: a weapon you have only just picked up is clumsy in your hand; skill makes it quicker
  wSpeedK() { if (!this.weapon) return 1; const sz = Math.pow(1 / (this.weapon.size || 1), 0.95); return Game.speedOf(this.h, this.weapon.wt) * sz; } // skill, and the weapon's size (light = quick, heavy = slow)
  speedMul() { let m = this.wSpeedK() * (this.h.arena ? Game.arenaHaste(this.h) : 1) * (1 + this.sbSum('haste') / 100) * (this.buffs.avatar > 0 && this.avatar && this.avatar.haste ? this.avatar.haste : 1); if (this.buffs.rampage > 0) m *= 1.4; if (this.buffs.focus > 0) m *= 1.35; if (this.W && this.W.hands === 'dual' && dualRank(this.h.dualKills) >= 2) m *= 1.08; if (this.buffs.fury > 0) m *= 1.5; if (this.pk('drum') && (this.buffs.bWar > 0 || this.buffs.bVigor > 0 || this.buffs.bStone > 0)) m *= 1.1; return m; }

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
  light() {
    if (this.dodge || this.gathering || this.swim) return;
    const W = this.W; if (!W) return;
    if (this.block) return;
    if (this.atk) { if (this.atk.t > 0.35 && !this.atk.noQueue) this.queued = 'light'; return; }
    if (G.newFx && (W.kind === 'gun' || W.kind === 'bow' || W.kind === 'staff') && Math.random() < 0.6) Skills.practise(this.h, Skills.skillOf(this.weapon.wt));
    if (W.kind === 'gun') return this.startAtk('shoot', (this.buffs.reload > 0 ? 0.45 : 0.9) / this.speedMul(), { charge: 0 });
    if (W.kind === 'bow') return this.startAtk('shoot', 0.5 / (1 + this.wp('combo') * 0.12) / (1 + this.pk('quickdraw') * 0.3) / this.speedMul(), { charge: 0 });
    if (W.kind === 'staff') { // campaign: a magical staff runs on mana, bolts included (a stronger staff costs more)
      if (G.newFx && !this.h.arena) { const cost = Math.round(3 + (this.weapon.dmg || 9) * 0.12); if (this.mana < cost) { S.error(); V.number(this.pos.clone().setY(this.pos.y + this.eye + 0.3), 'Out of mana', 'miss'); return; } this.mana -= cost; this.manaUseT = 1; }
      return this.startAtk('cast', 0.55 / W.speed / (1 + this.wp('combo') * 0.12) / this.speedMul(), { charge: 0 }); }
    const C = COMBOS[this.weapon.wt]; if (!C) return;
    if (this.comboT <= 0) this.combo = 0;
    const L = Game.comboLen(this.h, this.weapon.wt); // the campaign: strikes unlock as the weapon's mastery grows
    const i = this.combo % L; this.combo = i + 1;
    let st = C.chain[i];
    if (G.newFx) { this.swingN = (this.swingN || 0) + 1; const pick = C.chain[this.swingN % Math.min(2, C.chain.length)]; st = Object.assign({}, C.chain[0], { a: pick.a, m: 1.0 }); } // single swings, alternating left and right
    const dur = 0.52 * (st.d || 1) / (W.speed * this.speedMul());
    this.startAtk(st.a, dur, { combo: i, step: st, last: G.newFx ? false : i === L - 1 });
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
    if (W && W.kind === 'melee' && !['charge'].includes(name)) { const big = name === 'swing3' || name === 'heavy' || name === 'smash' || name === 'thrust3' || name === 'spin'; this.atk.swingSnd = { k: this.swingKind(name), v: big ? 1.6 : W.hands === 'two' ? 1.3 : 0.9 }; }
  }
  updateAttack(dt) {
    // charging heavy (hold left click)
    if (G.battleFx && this.W && (this.W.kind === 'bow' || this.W.kind === 'gun') && this.press && !G.uiOpen) {
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
    const hitAt = W && W.kind === 'gun' && (a.name === 'shoot' || a.name === 'release') ? 0.02 : a.name === 'smash' ? 0.62 : a.name === 'spin' ? 0.5 : a.name === 'swing3' || a.name === 'thrust3' ? 0.5 : a.name === 'heavy' ? 0.3 : a.name === 'area' ? 0.25 : a.name === 'cast' ? 0.3 : a.name === 'shoot' ? 0.5 : a.name === 'release' ? 0.02 : a.name === 'castBig' ? 0.55 : 0.4;
    if (a.swingSnd && (hitAt - a.t) * a.dur <= 0.13) { S.swingW(a.swingSnd.k, a.swingSnd.v, this.pos); a.swingSnd = null; } // whoosh lands with the blow
    if (!a.hit && a.t >= hitAt) { a.hit = true; this.doHit(a); }
    // fury flurry: several hits
    if (a.name === 'fury') { const k = Math.floor(a.t * a.hits); if (k > (a.done || 0) && k <= a.hits) { a.done = k; this.furyHit(a, k); } }
    // trails
    const tr = this.camDist < 0.6 ? this.vm.weapons.main : this.ch.weapons.main;
    const trActive = W && W.kind === 'melee' && a.t > hitAt - 0.25 && a.t < hitAt + 0.25 && a.name !== 'off1' && a.name !== 'stabL';
    this.trail.active = trActive;
    if (trActive && tr) this.trail.push(tr.userData.base.getWorldPosition(new THREE.Vector3()), tr.userData.tip.getWorldPosition(new THREE.Vector3()));
    const trl = this.camDist < 0.6 ? this.vm.weapons.off : this.ch.weapons.off;
    const offActive = W && W.hands === 'dual' && (a.name === 'off1' || a.name === 'stabL' || a.name === 'spin' || a.name === 'swing3' || a.name === 'fury' || a.name === 'heavy' || a.name === 'smash') && a.t > 0.1 && a.t < 0.8;
    this.trailL.active = offActive;
    if (offActive && trl) this.trailL.push(trl.userData.base.getWorldPosition(new THREE.Vector3()), trl.userData.tip.getWorldPosition(new THREE.Vector3()));
    if (a.t >= 1) {
      this.atk = null; this.trail.active = this.trailL.active = false;
      this.comboT = 0.55;
      if (a.last) this.combo = 0;
      if (this.queued) { const q = this.queued; this.queued = null; if (q === 'light') this.light(); else if (q === 'heavy') { this.press = { t: 0.23, charging: false, melee: true }; } }
    }
  }
  doHit(a) {
    const W = this.W, w = this.weapon; if (!W) return;
    let base = weaponDamage(this.h, w) * Game.perkPow(Game.perkLvl(this.h, 'L'));
    const yaw = this.yaw;
    if (W.kind === 'melee') {
      if (a.name === 'area') return;
      let st = a.step || { m: 1 }; const wt = this.weapon.wt;
      const blunt = wt === 'maceshield' || wt === 'warhammer' || wt === 'quarterstaff' || !!st.blunt;
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
        this.dealDamage(m, base * st.m, { knock: kn, big, offhand: a.name === 'off1' || a.name === 'stabL', melee: true, blunt, critBonus: (swordHit ? 0.1 : 0) + (st.crit || 0), bleed: st.bleed ? base * 0.09 : 0, stun: st.stun || 0 });
        if (blunt) S.blunt(m.pos);
      }
      if (targets.length) { this.wpnXp(1); if (G.newFx && !a.extra) this.meleeExtras(a, targets[0], base, st); }
      if (targets.length && (wt === 'dagger' || wt === 'daggers') && a.name !== 'heavy' && !a.extraHit) {
        const lv = G.newFx ? 0 : Game.masteryOf(this.h, wt), k = wt === 'daggers' ? 2 : 1; // campaign: no random dagger flurries, the rogue's abilities carry the damage
        const n = lv >= 9 && Math.random() < (0.02 + lv * 0.002) * k ? 3 : lv >= 5 && Math.random() < (0.04 + lv * 0.003) * k ? 2 : lv >= 2 && Math.random() < (0.08 + lv * 0.006) * k ? 1 : 0;
        if (n) { const t0 = targets[0]; V.number(t0.pos.clone().setY(t0.pos.y + (t0.height || 1.6) + 0.8), ['', 'Double attack!', 'Triple attack!', 'Quad attack!'][n], 'crit');
          for (let q = 1; q <= n; q++) setTimeout(() => { if (this.dead || t0.dead) return; this.dealDamage(t0, base * st.m * 0.9, { melee: true, offhand: q % 2 === 1 }); S.swingW('light', 0.8, this.pos); this.atk = { name: q % 2 ? 'stabL' : 'stabR', t: 0, dur: 0.12, hit: true, noQueue: true, extraHit: true }; }, q * 85); }
      }
      if (targets.length) { G.hitstop = (big ? 0.09 : 0.04) * (G.battleFx ? 1.5 : 1); V.addShake((big ? 0.3 : 0.08) * (G.battleFx ? 1.6 : 1)); if (G.battleFx) for (const m of targets) { const hp = m.pos.clone(); hp.y += (m.height || 1.5) * 0.6; V.burst('spark', hp, big ? 22 : 12, { speed: big ? 9 : 6 }); if (big) V.light(hp, '#ffd8a0', 5, 0.12); } }
      const fp = this.pos.clone().addScaledVector(this.fwd(), reach * 0.8); fp.y = heightAt(fp.x, fp.z);
      if (st.shock) { for (const m of mobsInRadius(fp, st.shock)) if (!targets.includes(m)) this.dealDamage(m, base * st.m * 0.5, { melee: true, blunt, slow: 2, knock: m.pos.clone().sub(fp).setY(0).normalize().multiplyScalar(6) }); V.ring(fp, st.shock, '#ffe0a0', 0.45); V.burst('stone', fp, 26, { speed: 7, size: 0.3, grav: 14 }); V.burst('dust', fp, 20, { speed: 4, size: 1, life: 1.2 }); S.hit('stone', fp); S.rumble(fp, 0.5); V.addShake(0.35); }
      if (a.name === 'spin') { V.ring(this.pos, st.aoe || 3, '#e0e8ff', 0.35); V.burst('spark', this.pos.clone().setY(this.pos.y + 1), 30, { speed: 7 }); S.swingW('light', 1.6, this.pos); }
      if (st.line) { V.burst('spark', fp, 14, { speed: 5 }); }
      if (big && !st.shock && W.hands === 'two') V.burst('dust', fp, 12, { speed: 3, size: 0.45 });
    } else if (W.kind === 'bow') {
      const from = (this.adsK || 0) > 0.6 ? G.camera.position.clone().add(new THREE.Vector3(0, -0.02, -0.75).applyQuaternion(G.camera.quaternion)) : this.handPos(true), dir = this.aimDir(from);
      const charge = a.name === 'release' ? a.charge : 0.25;
      // a long draw (hold left click up to ~2 s in Kingdom Battles) hits much harder, flies faster and stays straight far longer
      const sight = (this.adsK || 0) > 0.7, speed = (G.battleFx ? 34 + charge * 36 : 38 + charge * 40) + (sight ? 10 : 0); /* sighted: faster, flatter, a little harder */
      spawnProjectile({ wpn: true, flat: (G.battleFx ? 0.6 + charge * 1.1 : 0) + (sight ? 0.5 : 0), pos: from, vel: dir.multiplyScalar(speed), grav: (9 - charge * (G.battleFx ? 6 : 4)) * (G.battleFx ? 0.6 : 1) * (sight ? 0.7 : 1), radius: 0.15, dmg: base * (0.9 + charge * (G.battleFx ? 2.8 : 1.7)) * (a.name === 'release' ? 1 + this.wp('heavy') * 0.15 : 1) * (sight ? 1.15 : 1), owner: 'player', kind: 'arrow', life: 4, charged: charge > 0.7, pierce: charge > 0.95 });
      S.bowShot(this.pos);
    } else if (W.kind === 'gun') { const sight = (this.adsK || 0) > 0.7; this.fireGun(a.name === 'release' ? a.charge : 0, a.name === 'release' || sight, sight ? 1.15 : 1); if (sight) this.recoil = Math.max(this.recoil, 1.6);
    } else if (W.kind === 'staff') {
      const from = this.camDist < 0.6 ? G.camera.position.clone().add(new THREE.Vector3(0.12, -0.12, -0.9).applyQuaternion(G.camera.quaternion)) : (this.ch.weapons.main?.userData.orb?.getWorldPosition(new THREE.Vector3()) || this.handPos());
      const dir = this.aimDir(from), el = W.element, big = a.big && a.charge > 0.2, ch = a.charge || 0;
      if (this.h.arena && this.h.cls === 'necromancer') { // the necromancer's staff spits a dripping ball of poison
        spawnProjectile({ wpn: true, pos: from, vel: dir.multiplyScalar(30), grav: 4, radius: 0.28, dmg: base * 0.75 * (1 + ch * 1.2), owner: 'player', kind: 'poison', scale: big ? 1.5 : 1, life: 3, onHit: (p, m, pos) => { for (const u of mobsInRadius(pos, big ? 2.6 : 1.6)) this.dealDamage(u, u === m ? p.dmg : p.dmg * 0.4, { el: 'arcane', poison: base * 0.35, spread: 2 }); V.burst('poison', pos, 26, { speed: 3.5, grav: 6 }); V.burst('green', pos, 8, { speed: 2 }); V.burst('leaf', pos, 10, { speed: 2 }); V.light(pos, '#60ff40', 3, 0.2); S.cast('arcane', pos, 0.5); } });
        S.cast('arcane', from, 0.7); V.burst('green', from, 8, { speed: 2 }); return; }
      if (G.newFx && !a.big) base *= 0.7; // campaign: plain bolts hit softer; spells and the held stream carry the damage
      const sc = big ? 1 + ch * 1.4 : 1;
      if (el === 'fire') spawnProjectile({ wpn: true, pos: from, vel: dir.multiplyScalar(34 - ch * 6), grav: 3.5 + ch * 3, radius: 0.25 * sc, dmg: base * (1 + ch * 1.6), owner: 'player', kind: 'fireball', scale: sc, life: 4, onHit: (p, m, pos) => this.fireBurst(pos, (big ? 2.6 : 1.6) * sc * 0.8, p.dmg, m) });
      else if (el === 'frost') spawnProjectile({ wpn: true, pos: from, vel: dir.multiplyScalar(46), grav: 2.5, radius: 0.22 * sc, dmg: base * (1 + ch * 1.4), owner: 'player', kind: 'frost', scale: sc, life: 3, pierce: big, onHit: (p, m, pos) => { if (m) this.dealDamage(m, p.dmg, { slow: 3, freeze: big && ch > 0.8 ? 2 : 0, el: 'frost' }); V.burst('frost', pos, 14 * sc, { speed: 4 }); S.cast('frost', pos); } });
      else spawnProjectile({ wpn: true, pos: from, vel: dir.multiplyScalar(52), grav: 1.5, radius: 0.22 * sc, dmg: base * (0.95 + ch * 1.5), owner: 'player', kind: 'arcane', scale: sc, life: 3, home: true, onHit: (p, m, pos) => { if (m) this.dealDamage(m, p.dmg, { el: 'arcane' }); V.burst('arcane', pos, 16 * sc, { speed: 4 }); V.light(pos, '#a050ff', 3, 0.2); S.cast('arcane', pos, 0.6); } });
      if (this.pk('echo') && !a.echoed && Math.random() < 0.15) { setTimeout(() => { if (!this.dead) this.doHit(Object.assign({}, a, { echoed: true })); }, 140 * ABIL_DELAY_K()); }
      S.cast(el, from, big ? 1.4 : 0.8);
      V.burst(el === 'fire' ? 'fire' : el, from, 8, { speed: 2 }); V.light(from, el === 'fire' ? '#ff7020' : el === 'frost' ? '#60c0ff' : '#b060ff', 2, 0.15, 8);
    }
  }
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
  areaK() { return G.battleFx ? 1 + (this.h.level - 1) * 0.36 / (LEVEL_CAP - 1) : 1; }
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
    if (rank >= 6) V.ring(this.pos, r, '#e0e8ff', 0.25);
    if (k === a.hits && rank >= 4) { // cross slash wave
      const from = this.pos.clone(); from.y += 1; const dir = this.fwd();
      spawnProjectile({ pos: from, vel: dir.multiplyScalar(26), grav: 0, radius: 1.3, dmg: a.base * 1.6, owner: 'player', kind: 'wave', life: 0.8, pierce: true });
      S.cast('arcane', from, 0.6);
    }
  }

  hotbar(i) {
    if (this.fearT > 0) { S.error(); return; }
    const sl = this.h.hotbar && this.h.hotbar[i]; if (!sl) return;
    if (G.campAb && i < 5 && sl.t === 'ab') { if (G.time < (this.gcdT || 0)) { S.error(); return; } } // keys 1-5 share a 1.5 s cooldown (F, C, Q do not)
    if (sl.t === 'ab') { const k = ABILITIES[this.h.cls].findIndex(a => a.id === sl.id); if (k >= 0) { const cd0 = this.cd['a' + (k + 1)] || 0; this.ability(k); if (G.campAb && i < 5 && (this.cd['a' + (k + 1)] || 0) > cd0) this.gcdT = G.time + 1.5; } }
    else if (sl.t === 'item') { if (count(this.h, sl.id) > 0) useItem(this.h, sl.id, this); else S.error(); }
  }
  // ---------- class abilities ----------
  ability(i, fromCast) {
    const ab = ABILITIES[this.h.cls][i]; if (!ab) return;
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
    this.cd[key] = ab.cd * Game.perkCd(Game.perkLvl(this.h, ab.id, 'cd')) * Game.arenaCdAll(this.h) * (1 - Game.fxCount(this.h, 'cd') * 0.08 - Game.fxCount(this.h, 'u_sup') * 0.15); if (isBanner) this.bannerT = G.time + 2;
    const ct = this.h.arena ? 0 : /* the arena: cooldowns only, no cast times */ G.campAb && !isSupport(ab) ? 0 : (G.campAb && ab.castT) || CAST_T[ab.id] || ACT_T[ab.id] || (BATTLE && ab.id === 'rally' ? 0.8 : 0), /* campaign: F C Q fire at once and are held back by their cooldowns */ isSpell = !!(CAST_T[ab.id] || (G.newFx && ab.castT));
    if (ct) { this.abCast = { t: 0, dur: ct * (G.newFx && isSpell ? Skills.castK(this.h) : 1), i, name: ab.name, spell: isSpell }; if (isSpell) { if (G.newFx) S.castRise(this.abCast.dur, this.castCol()); else S.charge && S.charge(this.W && this.W.element || 'arcane'); } return; }
    }
    const w = this.weapon, base = w ? weaponDamage(this.h, w) : 10 + this.h.level * 3;
    const rk = this.h.level >= RANK2_LEVEL ? 1.5 : 1;
    const up = (G.abilScale ? G.abilScale(this.h.level) : 1) * (this.pk('a_' + ab.id) ? 1.5 : 1) * Game.perkPow(Game.perkLvl(this.h, ab.id)); // (arena perks)
    const f = this.fwd();
    // Kingdom Battles: support abilities also reach allied troops and players nearby
    if (G.hooks.allyFx && ALLY_FX[ab.id]) { const fx = ALLY_FX[ab.id].slice(); fx[1] = (fx[1] || 0) * this.hk(); G.hooks.allyFx(this.pos, fx, up); }
    if (SUPPORT[ab.id]) this.buffFx(ab.name, SUPPORT[ab.id]); // the original classes' buffs and heals announce themselves too
    if (ab.regen) { this.addRegen(ab.regen[0], ab.regen[1]); V.burst('heal', this.pos.clone().setY(this.pos.y + 1.1), 18, { speed: 2, vy: 2 }); }
    if (!(G.battleFx && (ab.kit ? this.runKit(ab, base, up, f) : this.classGear(ab.id, base, up, f)))) switch (ab.id) {
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
        const tgt = groundPoint(14);
        this.leap = { t: 0, dur: 0.75, from: this.pos.clone(), to: tgt, dmg: base * 2.6 * rk * up, r: 7 * (1 + this.pk('a3up') * 0.3) };
        this.atk = { name: 'heavy', t: 0, dur: 0.9, hit: true, noQueue: true };
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
        V.burst('arcane', from.clone().setY(from.y + 1), 50, { speed: 4, size: 0.4 }); V.sphereFlash(from.clone().setY(from.y + 1), 1.4, '#c080ff', 0.3);
        this.pos.copy(to); this.vel.set(0, 0, 0);
        V.burst('arcane', to.clone().setY(to.y + 1), 50, { speed: 4, size: 0.4 }); V.sphereFlash(to.clone().setY(to.y + 1), 1.4, '#c080ff', 0.3);
        S.cast('arcane', to, 1.2); this.fovKick = 10;
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
    else if ((this.adsK || 0) > 0.6) from = G.camera.position.clone().add(new THREE.Vector3(0, -0.03, -1.15).applyQuaternion(G.camera.quaternion)); // sighted: from the muzzle you are looking down
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
    const aimTarget = (range) => { const r = aimRay(range); return r.mob && foe(r.mob) ? r.mob : mobsInCone(this.pos, this.yaw, range, 0.45).sort((x, y) => x.dist2(this.pos) - y.dist2(this.pos))[0]; };
    switch (a.t) {
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
      case 'cone': { const range = (a.range || 6) * K;
        for (const m of mobsInCone(this.pos, this.yaw, range, a.ang || 0.6)) this.dealDamage(m, P(a.dmg), hitO(m, { melee: true }));
        for (let i = 0; i < 40; i++) { const an = this.yaw + (Math.random() - 0.5) * (a.ang || 0.6) * 2, d = Math.random() * range; V.burst(pk === 'spark' ? 'dust' : pk, new THREE.Vector3(this.pos.x + Math.sin(an) * d, this.pos.y + 0.6 + Math.random(), this.pos.z + Math.cos(an) * d), 1, { speed: 1.5 }); }
        S.swingW(this.swingKind('swing3'), 1.5, this.pos); if (el) S.cast(el, this.pos, 0.8); V.addShake(0.2); anim('swing3', 0.5); return true; }
      case 'strike': { anim('heavy', 0.5); S.swingW(this.swingKind('swing3'), 1.4, this.pos);
        setTimeout(() => { if (this.dead) return; const t = mobsInCone(this.pos, this.yaw, (a.reach || 3) + 0.5, 0.7).sort((x, y) => x.dist2(this.pos) - y.dist2(this.pos))[0]; if (!t) return;
          // behind it? (it faces away from you)
          const behind = a.backstab && Math.abs(angDiff(t.yaw || 0, Math.atan2(this.pos.x - t.pos.x, this.pos.z - t.pos.z))) > 2.0;
          if (behind) { V.number(t.pos.clone().setY(t.pos.y + (t.height || 1.6) + 0.9), 'Backstab!', 'crit'); V.burst('blood', t.pos.clone().setY(t.pos.y + 1.1), 30, { speed: 5 }); }
          this.dealDamage(t, P(a.dmg) * (behind ? 2.4 : 1), hitO(t, { melee: true, big: true, critBonus: behind ? 1 : (a.crit || 0) })); V.burst('spark', t.pos.clone().setY(t.pos.y + 1), 16, { speed: 5 }); G.hitstop = 0.07; V.addShake(0.25); }, 160 * ABIL_DELAY_K());
        return true; }
      case 'flurry': { const n = this.qty(a.hits || 4, a.extra || 0); anim('fury', Math.max(0.5, n * 0.09));
        for (let k = 0; k < n; k++) setTimeout(() => { if (this.dead) return; const t = mobsInCone(this.pos, this.yaw, (a.reach || 3) + 0.5, 0.8).sort((x, y) => x.dist2(this.pos) - y.dist2(this.pos))[0]; S.swingW(this.swingKind('swing1'), 0.8, this.pos); if (t) { this.dealDamage(t, P(a.dmg), hitO(t, { melee: true, silent: k % 2 === 1 })); V.burst('spark', t.pos.clone().setY(t.pos.y + 1), 5, { speed: 3 }); } }, k * 90);
        return true; }
      case 'dash': { this.dodge = { t: 0, dur: (a.dur || 0.3) * 1.8, dir: f.clone(), speed: (a.speed || 28) / 1.8, charge: true, hitSet: new Set(), dmg: P(a.dmg) }; this.iframes = Math.max(this.iframes, a.iframes || 0.2); this.fovKick = 10; S.dodge(); anim('heavy', 0.4); return true; }
      case 'heal': { this.buffFx(a.name, '#7ee07e'); this.heal(this.maxHp * (a.self || 0) * up * this.hk()); if (a.r) ally(this.pos, a.r * K, (a.ally || 0) * up * this.hk()); S.heal(); if (!this.h.arena) V.ring(this.pos, (a.r || 3) * K, col === '#ffffff' ? '#80ffb0' : col, 0.7); else { V.sphereFlash(this.pos.clone().setY(this.pos.y + 1.1), 1.6, '#a0ffc0', 0.35); V.burst('gold', this.pos.clone().setY(this.pos.y + 1.5), 24, { speed: 3, vy: 3 }); } V.burst('heal', this.pos.clone().setY(this.pos.y + 1), 40, { speed: 4, vy: 2 }); anim('cast'); return true; }
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
      case 'hot': { this.buffFx(a.name, '#7ee07e'); this.regen = { per: this.maxHp * a.pct * up * (this.hk() || this.regenK()) / a.dur, t: a.dur }; /* classes that cannot heal still regenerate themselves */ if (a.r) ally(this.pos, a.r * K, (a.ally || 0) * up * this.hk()); S.heal(); V.burst('heal', this.pos.clone().setY(this.pos.y + 1), 30, { speed: 2, vy: 2 }); V.ring(this.pos, (a.r || 2.5) * K, '#80ffb0', 0.6); anim('cast'); return true; }
      case 'buff': { if (a.eq && G.campAb) { this.eqBuff(a); anim('cast'); return true; }
        this.buffFx(a.name, a.buff === 'poisonW' ? '#7ae050' : a.buff === 'flame' ? '#ff8a3a' : a.buff === 'barrier' ? '#8ac8ff' : '#ffd84a'); const B2 = this.buffs, d = (a.dur || 8) * Math.sqrt(up);
        if (a.buff === 'barrier') { B2.barrier = this.maxHp * (a.amount || 0.25) * up; B2.barrierT = d; }
        else if (a.buff === 'stand') { this.heal(this.maxHp * (a.heal || 0) * up * this.hk()); B2.stand = d; }
        else if (a.buff === 'avatar') { for (const k in FORMS) B2[k] = 0; B2.avatar = d; this.avatar = Object.assign({ name: a.name }, a.av || {}); if (this.avatar.surge) B2.surge = Math.max(B2.surge || 0, d); this.formOn = null; }
        else if (FORMS[a.buff]) { B2.avatar = 0; for (const k in FORMS) B2[k] = 0; B2[a.buff] = d; if (a.buff === 'formArcane') B2.focus = Math.max(B2.focus || 0, d); }
        else if (a.buff === 'iceblock') { B2.iceblock = a.dur || 3; this.iframes = Math.max(this.iframes, a.dur || 3); this.vel.set(0, 0, 0); V.burst('frost', this.pos.clone().setY(this.pos.y + 1), 50, { speed: 3 }); }
        else if (a.buff === 'phase') { B2.phase = d; this.iframes = Math.max(this.iframes, d); B2.swind = Math.max(B2.swind || 0, d); V.burst('arcane', this.pos.clone().setY(this.pos.y + 1), 40, { speed: 3 }); }
        else B2[a.buff] = Math.max(B2[a.buff] || 0, d);
        if (a.allyBuff) ally(this.pos, (a.r || 10) * K, 0, a.allyBuff, d);
        V.sphereFlash(this.pos.clone().setY(this.pos.y + 1), 1.8, col === '#ffffff' ? '#ffd890' : col, 0.5); if (a.r) V.ring(this.pos, a.r * K, col === '#ffffff' ? '#ffd890' : col, 0.6); S.cast('arcane', this.pos, 0.7); anim('cast'); return true; }
      case 'curse': { const t = aimTarget(a.range || 25); anim('cast'); S.cast('arcane', this.pos, 0.7); if (!t) return true;
        const land = () => { if (t.dead) return;
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
          const sk = spawnProjectile({ pos: from, vel: dir0.multiplyScalar(24), grav: 0, radius: 0.4, dmg: 0, owner: 'none', kind: 'skull', life: 3 }); const iv = setInterval(() => { if (t.dead || this.dead || !G.projectiles.includes(sk)) { clearInterval(iv); return; } const to = t.pos.clone().setY(t.pos.y + 1.2), d = to.clone().sub(sk.pos); if (d.length() < 0.8) { clearInterval(iv); sk.life = 0; G.projectiles.splice(G.projectiles.indexOf(sk), 1); G.scene.remove(sk.mesh); V.burst('shadow', to, 30, { speed: 4 }); V.burst('green', to, 20, { speed: 3 }); land(); } else sk.vel.copy(d.normalize().multiplyScalar(24)); }, 30);
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
  gunToShoulder(ch, on) {
    const g = ch.weapons && ch.weapons.main; if (!g || !g.parent) return;
    const ud = g.userData; if (!ud.home) ud.home = { p: g.position.clone(), q: g.quaternion.clone() };
    if (!on) { if (ud.aimed) { g.position.copy(ud.home.p); g.quaternion.copy(ud.home.q); ud.aimed = false; } return; }
    ch.root.updateMatrixWorld(true);
    const sh = ch.arms.R.sh.getWorldPosition(new THREE.Vector3()); sh.y -= 0.04;
    const dir = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch)); // the barrel (model +y) along the aim, sights (+z) up, lock (+x) to the right: no twisting
    const upv = new THREE.Vector3(0, 1, 0).addScaledVector(dir, -dir.y).normalize(), rx = new THREE.Vector3().crossVectors(dir, upv), q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(rx, dir, upv));
    const want = sh.clone().addScaledVector(dir, 0.42).addScaledVector(this.right(), -0.06);
    // both hands on the gun: the right round the wrist of the stock, the left under the forend
    const at = (y, z) => want.clone().addScaledVector(dir, y).addScaledVector(upv, z);
    armReach(ch, 'R', at(-0.1, -0.05), 5); armReach(ch, 'L', at(0.42, -0.04), 5);
    const pq = g.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    g.position.copy(g.parent.worldToLocal(want.clone())); g.quaternion.copy(pq.multiply(q)); ud.aimed = true;
  }
  // Skyrim-style: weapons away on your back, or back in your hands (any attack, ability, block or hit draws them)
  sheatheWeapons() { if (this.sheathed || this.atk || this.dodge || !this.weapon) return; this.sheathed = true; this.press = null; this.block = false; sheathe(this.ch, true); this.vmShow(false); S.swap && S.swap(); this.drawAnimT = 0.35; }
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
    if (Skills.DOUBLE_CLASSES.has(h.cls) && Math.random() < Skills.doubleChance(h, this.D.stats.str)) { swing(140, 'main', base * (st.m || 1), 'Double attack');
      if (Skills.TRIPLE_CLASSES.has(h.cls) && Skills.skillCapOf(h, 'triple') > 0 && (Skills.practise(h, 'triple'), Math.random() < Skills.tripleChance(h, this.D.stats.str))) { swing(280, 'main', base * (st.m || 1), 'Triple attack'); } }
    if (Skills.canDual(h)) { const w2 = h.equip.w2; Skills.practise(h, 'dual'); if (Math.random() < Skills.dualChance(h, this.D.stats.dex)) { swing(360, 'off', weaponDamage(h, w2) * 0.75, 'Off hand'); Skills.practise(h, Skills.skillOf(w2.wt)); } }
  }
  // spellcasting look: the colour of your magic, gathering light at both raised hands, motes spiralling up around you, a ring at your feet
  castCol() { const C = { necromancer: 'shadow', cleric: 'holy', paladin: 'holy', druid: 'nature', shaman: 'frost', elementalist: 'fire', enchanter: 'arcane', bard: 'holy', darkknight: 'shadow', ranger: 'nature', beastmaster: 'nature' }; return C[this.h.cls] || (this.W && this.W.element) || 'arcane'; }
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
    if (this.h.arena) [dmg, o] = Game.arenaOut(this, this.h, m, dmg, o); // (arena perk passives)
    if (G.battleFx && this.stealth > 0 && !o.silent) this.stealth = 0;
    /* (no per-class damage scaling: Kingdom Battles uses the campaign abilities now) */
    dmg *= campTune(this.h.cls).dmg;
    // campaign: every creature has physical and magical defence that grows with its level (spells and elements check magical)
    if (G.newFx && !m.dummy && !m.pet && !m.arenaBot && !m.botPet && m.lv) dmg *= 1 - mobDefense(m, this.h.level, !!o.el); /* (arena fighters use their own armour) */
    if (this.buffs.poisonW > 0 && !o.silent && this.W && this.W.kind !== 'staff' && (o.melee || o.ranged)) { o = Object.assign({}, o, { bleed: (o.bleed || 0) + dmg * 0.18 }); if (Math.random() < 0.5) V.burst('leaf', m.pos.clone().setY(m.pos.y + (m.height || 1.6) * 0.6), 8, { speed: 2 }); }
    if (this.buffs.flame > 0 && !o.silent) { o = Object.assign({}, o, { burn: (o.burn || 0) + dmg * 0.2 }); if (Math.random() < 0.5) V.burst('fire', m.pos.clone().setY(m.pos.y + (m.height || 1.6) * 0.6), 8, { speed: 2.5 }); }
    if (this.buffs.leech > 0) this.heal(dmg * 0.06 * this.hk());
    let crit = Math.random() < this.D.crit + (this.pk('keen') ? 0.08 : 0) + Game.fxCount(this.h, 'crit') * 0.05;
    if (this.buffs.nextCrit && !o.silent) { crit = true; this.buffs.nextCrit = false; dmg *= 2; this.stealth = 0; }
    if (this.h.cls === 'ranger' && this.pk('cap') && m.hp >= m.maxHp) crit = true;
    if (o.critBonus && Math.random() < o.critBonus) crit = true;
    if (this.buffs.focus > 0 && Math.random() < 0.1) crit = true;
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
    if (this.h.arena && total > 0) { this.hitMarker(m.dead, crit, o.melee); const ls = Game.arenaStat(this.h, 'lifesteal'); if (ls) this.heal(total * 0.03 * ls, true); }
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
  tryProc(m) {
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
    dmg *= Game.arenaTakenK(this.h); if (this.h.arena) { dmg = Game.arenaIn(this, this.h, dmg); const th = Game.arenaPassive(this.h, 'thorns'); if (th && o.melee && src && src.arenaBot && !src.dead) { src.hp -= dmg * 0.08 * th; V.burst('spark', src.pos.clone().setY(src.pos.y + 1.1), 6, { speed: 3 }); if (src.hp <= 0) src.die(this); } } // (arena: tanks, toughness and passives)
    if (this.sheathed && !this.dead) this.drawWeapons(); this.hurtT0 = G.time;
    if (src && src.pos && !src.pet && src !== this) { this.lastHitBy = src; this.lastHitAt = G.time; } // (hurtT is a countdown used elsewhere)
    if (this.dead) return;
    if (this.iframes > 0 || (this.dodge && !this.dodge.charge)) { V.number(this.pos.clone().setY(this.pos.y + this.eye + 0.3), 'Dodged', 'miss'); return; }
    const front = src && src.pos ? Math.abs(angDiff(this.yaw, Math.atan2(src.pos.x - this.pos.x, src.pos.z - this.pos.z))) < 1.3 : true;
    // a timed block (raised just before the hit lands) deflects all of it, costs nothing and staggers the attacker
    if (this.block && front && this.W && G.time - (this.blockStart || -9) < 0.3) {
      S.block(this.W.hands === 'shield', this.pos); S.hit('metal', this.pos, 1.4); V.burst('spark', this.handPos(true), 30, { speed: 7 }); V.ring(this.pos, 1.6, '#ffe28a', 0.25); V.addShake(0.15); G.hitstop = 0.07;
      V.number(this.pos.clone().setY(this.pos.y + this.eye + 0.3), 'Perfect block!', 'crit');
      if (src && src.status && !src.remote && !src.isStruct) src.status.stun = Math.max(src.status.stun || 0, 0.9);
      return;
    }
    if (this.block && front && this.W) {
      const red = Math.min(0.95, this.W.block + this.wp('block') * 0.1); const cost = dmg * 0.6 * (1 - this.wp('block') * 0.25);
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
    if (this.buffs.barrier > 0) { const ab = Math.min(this.buffs.barrier, dmg); this.buffs.barrier -= ab; dmg -= ab; V.burst('frost', this.pos.clone().setY(this.pos.y + 1), 10, { speed: 3 }); if (this.buffs.barrier <= 0) { this.buffs.barrierT = 0; S.explode(this.pos, 0.4, 'frost'); } if (dmg <= 0) { V.number(this.pos.clone().setY(this.pos.y + this.eye + 0.3), 'Absorbed', 'frost'); return; } }
    this.hp -= dmg; if (this.buffs.undying > 0 && this.hp < 1) this.hp = 1; this.hurtT = 0.4; this.regenDelay = 4;
    V.addShake(Math.min(0.5, 0.1 + dmg / this.maxHp)); S.hurt();
    G.inCombat = 6;
    G.hooks.hurt && G.hooks.hurt(dmg, src);
    this.cancelGather();
    if (this.hp <= 0) { this.hp = 0; this.die(); }
  }
  debuff(type, t, dps = 0) {
    if (type === 'stun' && this.block && this.pk('immov')) return; // Immovable
    this.db = this.db || {};
    const d = this.db[type] || (this.db[type] = { t: 0, dps: 0 });
    d.t = Math.max(d.t, t); d.dps = Math.max(d.dps, dps);
    const label = { bleed: 'Bleeding!', poison: 'Poisoned!', burn: 'Burning!', slow: 'Slowed!', stun: 'Stunned!' }[type];
    V.number(this.pos.clone().setY(this.pos.y + this.eye + 0.2), label, 'bad');
    if (type === 'stun') { this.atk = null; this.press = null; this.cancelGather(); }
  }
  knock(v, stun = 0) { if (this.iframes > 0) return; this.vel.x += v.x; this.vel.z += v.z; this.vel.y = Math.max(this.vel.y, 3.5); this.onGround = false; this.knockT = 0.35; if (stun) this.debuff('stun', stun); }
  die() { this.dead = true; this.atk = null; this.press = null; this.deadT = 0; S.hurt(); G.hooks.died && G.hooks.died(); }

  // ---------- movement ----------
  // swimming: Space next to a low edge (a boat deck, a pier) climbs you out of the water
  climbOut() { let g = null, r = 0; for (const d of [0.6, 1.2, 1.9, 2.6]) { const t = groundAt(this.pos.x + Math.sin(this.yaw) * d, this.pos.z + Math.cos(this.yaw) * d, this.pos.y + 2.8); if (t.surf && t.h - this.pos.y <= 2.8) { g = t; r = d; break; } } if (!g) return false;
    this.pos.x += Math.sin(this.yaw) * r; this.pos.z += Math.cos(this.yaw) * r; this.pos.y = g.h; this.vel.set(0, 0, 0); this.onGround = true; this.swim = false; S.splash(this.pos, 0.6); return true; }
  swimK() { const k = Math.min(1, ((this.h.swimSkill || 1) - 1) / 49); return 0.65 + 0.45 * k; } // swimming skill 1-50: slow at first, quick with practice
  jump() { if (this.swim) { this.climbOut(); return; } if (this.onGround && !this.busy() && !this.swim) { this.vel.y = 9.2; this.onGround = false; this.landDip = 0.07; S.jump(); V.burst('dust', this.pos.clone().setY(this.pos.y + 0.1), 8, { speed: 2, size: 0.45, up: 0.3 }); } else if (this.swim) this.vel.y = 3; }
  tryDodge(dirOverride) {
    if (this.dodge || this.dead || this.gathering || !this.onGround || this.swim) return;
    if (this.atk && this.atk.t < 0.6 && this.atk.name !== 'cast') return;
    const kind = DODGE_OF[this.h.cls] || 'roll', D = DODGES[kind];
    const cost = D.cost * (this.W && this.W.hands === 'dual' && dualRank(this.h.dualKills) >= 9 ? 0.6 : 1) * (this.pk('evasive') ? 0.5 : 1);
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
    for (const k in this.cd) this.cd[k] = Math.max(0, this.cd[k] - dt * (this.buffs.formTime > 0 ? 2 : 1)); // Timeless Form: abilities recharge twice as fast
    this.useCd = Math.max(0, this.useCd - dt); this.iframes = Math.max(0, this.iframes - dt); this.comboT -= dt; this.stealth = Math.max(0, this.stealth - dt);
    for (const k of ['poisonW', 'flame', 'clarity', 'wolfRun', 'ward', 'reload', 'eagle', 'leech', 'storm', 'cry', 'fury', 'adren', 'tq', 'surge', 'swind', 'barrierT', 'wall', 'stand', 'rage', 'fort', 'rampage', 'focus', 'undying', 'bWar', 'bVigor', 'bStone', 'lich', 'formFire', 'formFrost', 'formArcane', 'formVoid', 'formTime', 'avatar', 'iceblock', 'phase', 'power', 'mward']) this.buffs[k] = Math.max(0, (this.buffs[k] || 0) - dt); if (this.buffs.barrierT <= 0) this.buffs.barrier = 0; this.stagger = Math.max(0, (this.stagger || 0) - dt);
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
    const stunned = this.db && this.db.stun && this.db.stun.t > 0;
    if (this.dead) { this.deadT += dt; this.animate(dt, 0); this.updateCamera(dt); return; }
    // regen
    this.endUseT -= dt; this.manaUseT -= dt;
    if (this.endUseT <= 0 && !this.block) this.end = Math.min(this.maxEnd, this.end + dt * (14 + (h.race === 'woodelf' ? 3 : 0)) * (1 + (this.fb.regen || 0)) * (1 + (this.h.cls !== 'wizard' ? 0 : 0)));
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
    this.adsK = (this.adsK || 0) + ((this.ads ? 1 : 0) - (this.adsK || 0)) * Math.min(1, dt * (this.ads ? 6 : 9));
    this.block = !this.sheathed && !ui && !!(G.battleFx ? this.rmbHeld : K.KeyF) && !this.atk && !this.dodge && !this.gathering && this.stagger <= 0 && !this.swim && !!this.W;
    if (this.block && !wasBlock) this.blockStart = G.time;
    if (this.summonCast) this.tickSummon(dt);
    if (this.abCast) this.tickAbCast(dt);
    if (!this.dead) this.tickAuras(dt);
    if (G.battleFx) this.tickChannel(dt);
    if (G.battleFx && this.h.cls === 'bard') this.tickSongs(dt);
    if (this.buffs.clarity > 0 && this.maxMana) this.mana = Math.min(this.maxMana, this.mana + this.maxMana * 0.05 * dt);
    if (this.buffs.flame > 0 && this.W && this.W.kind !== 'staff' && Math.random() < dt * 14) { const tip = this.camDist < 0.6 ? null : this.ch.weapons.main; const q = tip && tip.userData.tip ? tip.userData.tip.getWorldPosition(new THREE.Vector3()) : this.handPos(); V.burst('fire', q, 1, { speed: 0.6, size: 0.22, size1: 0.05, life: 0.35, vy: 1 }); }
    // charge heavy holds the swing
    const charging = this.press && this.press.charging;
    let sprint = !ui && this.shiftT != null && G.time - this.shiftT >= 0.22 && iz > 0 && !this.block && !charging && !this.atk && !this.ads;
    // sprinting burns endurance; once empty you must recover a little before sprinting again
    if (this.end <= 1) this.sprintTired = true; else if (this.end > 20) this.sprintTired = false;
    if (sprint && this.sprintTired) sprint = false;
    if (sprint && md.lengthSq() > 0.1 && this.onGround) { this.end = Math.max(0, this.end - 12 * dt); this.endUseT = 0.8; }
    const hero = !!this.h.arena; // Kingdom Arena plays like a hero shooter: full speed every way, always facing your aim
    let spd = (hero ? 1.2 : 1) * (G.newFx && iz < 0 && !hero ? 0.6 : 1) * (this.buffs.iceblock > 0 ? 0 : 1) * /* campaign: backing up is slow, so you cannot simply walk out of every swing */ (1 + this.sbSum('run') / 100) * (this.summonCast || (this.abCast && this.abCast.spell) ? 0.35 : this.abCast ? 0.55 : 1) * (this.swim ? 3.2 * this.swimK() : sprint ? 8.2 : 5.2) * (1 + this.pk('speed') * 0.1 + Game.fxCount(this.h, 'speed') * 0.04) * (this.buffs.adren > 0 ? 1.3 : 1) * (this.buffs.swind > 0 ? 1.25 : 1) * (1 + (this.fb.speed || 0)) * (this.buffs.wolfRun > 0 ? 1 + (this.wolfK || 0.12) : 1) * (1 - (this.adsK || 0) * 0.5) * Game.arenaSpeedK(this.h); /* aiming down the barrel: a slow, steady walk */
    if (iz < 0 && !hero) { spd = 2.2; sprint = false; }
    if (this.block && !(this.pk('shieldwall') && this.W && this.W.hands === 'shield')) spd *= 0.45;
    if (this.gathering || stunned) spd = 0;
    if (this.db && this.db.slow && this.db.slow.t > 0) spd *= 0.55;
    if (this.stagger > 0) spd *= 0.3;
    this.sprinting = sprint && md.lengthSq() > 0.1;
    // dodge / charge / leap override
    if (this.leap) {
      const L = this.leap; L.t += dt / L.dur; const k = Math.min(1, L.t);
      this.pos.x = lerp(L.from.x, L.to.x, k); this.pos.z = lerp(L.from.z, L.to.z, k);
      this.pos.y = lerp(L.from.y, L.to.y, k) + Math.sin(k * Math.PI) * 5;
      if (k >= 1) {
        this.leap = null; const p = this.pos.clone(); p.y = heightAt(p.x, p.z);
        for (const m of mobsInRadius(p, L.r || 7)) this.dealDamage(m, L.dmg, { stun: 2, knock: m.pos.clone().sub(p).setY(0).normalize().multiplyScalar(8), big: true, melee: true });
        V.ring(p, 7, '#ffd090', 0.5); V.ring(p, 4.5, '#ff8040', 0.4); V.burst('stone', p, 50, { speed: 9, size: 0.35, grav: 14, life: 1.2 }); V.burst('dust', p, 40, { speed: 6, size: 1.2, life: 1.5, radius: 3 });
        S.explode(p, 1.4); S.rumble(p, 1.2); V.addShake(0.8); G.hitstop = 0.08; this.vel.set(0, 0, 0); this.onGround = true;
      }
    } else if (this.dodge) {
      const D = this.dodge; D.t += dt / D.dur;
      if (D.rush && D.t < 0) { this.vel.x *= 0.5; this.vel.z *= 0.5; D.t += dt * 2 - dt / D.dur; } // the brace, about 0.15 s
      const s = D.t < 0 ? 0 : D.speed * (D.rush ? Math.min(1, 0.55 + D.t * 2.2) * (D.t > 0.85 ? 0.6 : 1) : D.charge ? 1 : (1 - D.t * 0.75));
      if (D.rush && D.t >= 0) { this.fovKick = Math.max(this.fovKick, 18 * Math.min(1, D.t * 3)); D.step = (D.step || 0) + dt; if (D.step > 0.09) { D.step = 0; V.addShake(0.07); V.burst('dust', this.pos.clone().setY(this.pos.y + 0.1), 6, { speed: 3, size: 0.7 }); } }
      this.vel.x = D.dir.x * s; this.vel.z = D.dir.z * s;
      if (D.charge && D.t >= 0) { for (const m of mobsInRadius(this.pos, 2.4)) if (!D.hitSet.has(m)) { D.hitSet.add(m); if (D.rush) { S.chargeImpact(m.pos); G.hitstop = Math.max(G.hitstop || 0, 0.08); V.addShake(0.35); V.burst('spark', m.pos.clone().setY(m.pos.y + 1), 20, { speed: 6 }); V.burst('dust', m.pos.clone().setY(m.pos.y + 0.3), 18, { speed: 4, size: 0.8 }); } const side = this.right().multiplyScalar(Math.sign(this.right().dot(m.pos.clone().sub(this.pos))) || 1); this.dealDamage(m, D.dmg, Object.assign({ knock: side.multiplyScalar(D.rush ? 7 : 9).add(D.dir.clone().multiplyScalar(D.rush ? 9 : 4)), stun: 1, big: true, melee: true }, D.extra || {})); V.addShake(0.2); } if (Math.random() < 0.6) V.burst('dust', this.pos.clone().setY(this.pos.y + 0.1), 3, { speed: 2, size: 0.5 }); }
      if (D.t >= 1) { this.dodge = null; this.vel.x *= 0.3; this.vel.z *= 0.3; }
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
    this.onSurf = g2.surf;
    // lava
    if (world.lavaPools) for (const L of world.lavaPools) if (Math.hypot(this.pos.x - L.x, this.pos.z - L.z) < L.r && this.pos.y < L.y + 0.6) { this.pos.y = Math.max(this.pos.y, L.y - 0.3); this.lavaT = (this.lavaT || 0) + dt; if (this.lavaT > 0.5) { this.lavaT = 0; this.iframes = 0; this.takeDamage(this.maxHp * 0.12, null); V.burst('fire', this.pos, 20, { speed: 3 }); } }
    // footsteps
    const hs = Math.hypot(this.vel.x, this.vel.z);
    this.speed = hs;
    if (this.onGround && hs > 0.5 && !this.dodge) { this.stepAcc += hs * dt; if (this.stepAcc > (this.sprinting ? 2.2 : 1.7)) { this.stepAcc = 0; S.step(this.swim ? 'water' : surfaceType(this.pos.x, this.pos.z, this.onSurf), null, this.sprinting ? 1.2 : 0.9); if (wl - g2.h > 0.1 && wl - g2.h < 1.4) S.step('water'); } }
    if (this.h.arena && this.lmbDown && !ui && this.W && !this.atk && !this.dodge && !this.dead && !(this.fearT > 0) && !(this.W.kind === 'staff' && this.h.cls === 'necromancer')) this.light(); // held: the next attack follows straight on
    // attacks
    this.updateAttack(dt);
    this.updateGather(dt);
    // body yaw (third person)
    const combatFace = this.atk || this.block || this.press || this.gathering;
    if (combatFace || this.camDist < 0.6 || this.h.arena) this.bodyYaw += angDiff(this.bodyYaw, this.yaw) * Math.min(1, dt * (this.h.arena ? 18 : 14));
    else if (hs > 0.5) this.bodyYaw += angDiff(this.bodyYaw, Math.atan2(this.vel.x, this.vel.z)) * Math.min(1, dt * 10);
    { const tr = angDiff(this.prevBY ?? this.bodyYaw, this.bodyYaw) / Math.max(dt, 1e-3); this.prevBY = this.bodyYaw; this.turnR = (this.turnR || 0) + (tr - (this.turnR || 0)) * Math.min(1, dt * 8); }
    this.animate(dt, hs);
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
      if (a.name === 'stabR') action = 'thrust1';
      if (a.name === 'stabL') { action = 'thrust1'; mirror = true; }
      if (a.name === 'smash') action = 'heavy';
      if (a.name === 'sweep') { action = 'swing1'; spin = Math.sin(Math.min(1, a.t / 0.75) * Math.PI) * -0.5; } // a wide sideways sweep: the whole body turns into it
      if (a.held && action === 'heavy') actionT = 0.5 + Math.min(a.t, 1) * 0.5; // released from the wind-up: swing straight through, no second wind-up
      if (a.name === 'charge' && a.hold) { action = this.weapon && this.weapon.wt === 'spear' ? 'thrust3' : 'heavy'; actionT = Math.min(a.t, 1) * (action === 'heavy' ? 0.5 : 0.4); }
      if (a.name === 'spin') { action = 'area'; spin = ease(Math.min(1, a.t / 0.8)) * Math.PI * 2; }
      if (a.name === 'area' || a.name === 'fury') { action = 'area'; spin = (a.name === 'fury' ? a.t * 3 : ease(Math.min(1, a.t / 0.8))) * Math.PI * 2; }
      if (a.name === 'release') action = 'shoot', actionT = 0.6 + a.t * 0.4;
      if (this.W && this.W.kind === 'gun' && (a.name === 'release' || a.name === 'shoot')) { action = 'gunAim'; actionT = a.t; }
      if (a.name === 'spell') action = 'cast';
      if (a.name === 'castRel') action = 'castRel';
      if (this.W && this.W.kind === 'melee' && this.weapon.wt === 'spear' && a.name.startsWith('thrust')) action = a.name;
    } else if (this.press && this.press.charging) { action = this.W.kind === 'bow' ? 'shoot' : this.W.kind === 'gun' ? 'gunAim' : this.W.kind === 'staff' ? 'castBig' : 'heavy'; actionT = this.W.kind === 'melee' ? 0.5 : this.W.kind === 'gun' ? 1 : 0.3; }
    if (!action && (this.adsK || 0) > 0.25 && this.W) { if (this.W.kind === 'gun') { action = 'gunAim'; actionT = 1; } else if (this.W.kind === 'bow') { action = 'shoot'; actionT = 0.3; } } // aiming down the barrel: the gun stays up at the shoulder, the bow half drawn
    { const cn = G.newFx && ((this.abCast && this.abCast.spell) ? this.abCast : this.summonCast); if (cn) { action = 'castUp'; actionT = Math.min(1, cn.t / Math.min(0.8, cn.dur * 0.6)); } const mw = ch.weapons && ch.weapons.main; if (mw && G.newFx && !this.sheathed) mw.visible = !cn; }
    const roll = this.dodge && !this.dodge.charge && this.dodge.kind !== 'step' ? Math.min(1, this.dodge.t) : null;
    const rollDir = roll != null && this.dodge.dir ? Math.atan2(this.dodge.dir.x, this.dodge.dir.z) - this.bodyYaw : 0, rollKind = roll != null ? this.dodge.kind : null; // roll the way you dodge
    const aimStaff = action !== 'castUp' && action !== 'castRel' && this.W && this.W.kind === 'staff' && ((this.channel && this.channel.on) || this.summonCast || (this.abCast && this.abCast.spell) || (this.atk && (this.atk.name === 'cast' || this.atk.name === 'castBig')));
    arenaLookTick(ch, dt);
    animateHumanoid(ch, dt, { turn: this.turnR || 0, rollDir, rollKind, aimStaff, aimPitch: this.pitch, speed: hs, vy: this.vel.y, land: this.landT || 0, airborne: !this.onGround && !this.swim, swim: this.swim, action, actionT, mirror, block: this.block, armed: !this.sheathed, ready: !!(this.atk || this.block || this.press || G.inCombat > 0 || G.time - (this.hitT || -99) < 5 || G.time - (this.hurtT0 || -99) < 5 || (this.abCast) || (this.channel && this.channel.on)), dead: this.dead, deadT: this.deadT, roll, spin, lookPitch: -this.pitch * 0.6, back: this.moveDir && this.moveDir.dot(this.fwd()) < -0.3 });
    { const D = this.dodge; ch.body.rotation.z = D && D.kind === 'step' ? -Math.sin(Math.min(1, D.t) * Math.PI) * 0.3 * (Math.sign(D.dir.dot(this.right())) || 1) : 0; } // a side step leans into it
    if (this.h.arena && this.h.cls === 'bard') luteToChest(ch, !!this.h.arenaSongs && !this.atk && !this.abCast && !this.dead && !this.dodge, G.time); // (the bard plays once he has a song)
    this.gunToShoulder(ch, this.camDist > 0.6 && this.W && this.W.kind === 'gun' && (this.adsK > 0.3 || (this.press && this.press.charging) || (this.atk && (this.atk.name === 'release' || this.atk.name === 'shoot'))));
    // view model
    const castNow = G.newFx && ((this.abCast && this.abCast.spell) ? this.abCast : this.summonCast);
    const vmAct = castNow ? { name: 'castUp', t: Math.min(1, castNow.t / Math.min(0.8, castNow.dur * 0.6)) } : g ? { name: g.anim, t: actionT } : a ? { name: a.name, t: Math.min(1, a.t) } : this.press && this.press.charging ? { name: this.W.kind === 'bow' ? 'draw' : this.W.kind === 'staff' ? 'chargeCast' : 'charge', t: Math.min(1, (this.press.t - 0.22) / 0.6) } : null;
    this.swayX += (-this.lookDX * 0.0004 - this.swayX) * Math.min(1, dt * 8); this.swayY += (this.lookDY * 0.0004 - this.swayY) * Math.min(1, dt * 8); this.lookDX = this.lookDY = 0;
    this.recoil = Math.max(0, (this.recoil || 0) - dt * 5);
    { const aiming = this.W && this.W.kind === 'gun' && this.press && this.press.charging; this.aimK = (this.aimK || 0) + ((aiming ? 1 : 0) - (this.aimK || 0)) * Math.min(1, dt * 9); }
    this.vm.update(dt, { channel: !!(this.channel && this.channel.on), aim: this.aimK, recoil: this.recoil, act: vmAct, block: this.block, speed: this.onGround ? hs : 0, sprint: this.sprinting && this.onGround, tool: !!g, drawing: this.press && this.press.charging && this.W.kind === 'bow' ? (this.press.t - 0.22) / 0.6 : 0, charge: this.press && this.press.charging ? Math.min(1, (this.press.t - 0.22) / 0.8) : 0, swayX: this.swayX, swayY: this.swayY - (this.swapT || 0) * 0.8 });
    // charge glow on weapon
    if (this.press && this.press.charging && Math.random() < 0.5) { const tip = this.camDist < 0.6 ? null : this.ch.weapons.main; if (this.camDist < 0.6 || (tip && tip.userData.tip)) { const p = tip ? tip.userData.tip.getWorldPosition(new THREE.Vector3()) : this.handPos(this.W.kind === 'bow'); V.emit(this.W.element || 'spark', p, { speed: 0.6, size: 0.12, life: 0.4 }); } }
    // stealth fade
    ch.root.traverse(o => { if (o.isMesh && o.material) { if (this.stealth > 0) { o.material.transparent = true; o.material.opacity = 0.35; } else if (o.material.opacity < 1) { o.material.opacity = 1; o.material.transparent = false; } } });
  }
  // the weapon you see while aiming down the barrel: built once per weapon, lifted into view, kicks when it fires
  adsView(ae) {
    const kind = this.W && this.W.kind === 'bow' ? 'bow' : this.weapon && this.weapon.wt === 'blunderbuss' ? 'blunderbuss' : this.W && this.W.kind === 'gun' ? 'musket' : null;
    if (this.adsG && (this.adsG.userData.kind !== kind)) { this.adsG.parent && this.adsG.parent.remove(this.adsG); this.adsG = null; }
    if (!kind || ae < 0.05) { if (this.adsG) this.adsG.visible = false; return; }
    if (!this.adsG) { const ap = this.h.app || {}, cm = this.ch.mats || {}; this.adsG = buildAdsView(kind, { skin: ap.skin, cloth: cm.shirt && cm.shirt.color ? '#' + cm.shirt.color.getHexString() : undefined }); this.adsG.userData.kind = kind; G.vmCam.add(this.adsG); }
    const g = this.adsG, e = Math.max(0, (ae - 0.45) / 0.55), r = this.recoil || 0, t = G.time, mv = Math.min(1, (this.speed || 0) / 5);
    g.visible = ae > 0.5;
    g.position.set(Math.sin(t * 1.3) * 0.002 + Math.sin(t * 7) * 0.004 * mv, -(1 - e) * 0.22 + Math.sin(t * 1.1) * 0.0018 + Math.abs(Math.sin(t * 7)) * 0.006 * mv, r * 0.05);
    g.rotation.set((g.userData.base || 0) + r * 0.07 + (1 - e) * 0.35, 0, (1 - e) * -0.25 + Math.sin(t * 0.9) * 0.004);
    if (g.userData.hammer) g.userData.hammer.rotation.x = r > 0.2 ? 0.9 : 0; // the hammer falls when it fires
  }
  updateCamera(dt) {
    const cam = G.camera;
    this.lookLag(dt);
    this.camDist += (this.camDistT - this.camDist) * Math.min(1, dt * 8);
    const fp = this.camDist < 0.6;
    this.ch.root.visible = (!fp || this.dead) && !this.spectate && !((this.adsK || 0) > 0.5 && !fp);
    this.vm.g.visible = fp && !this.dead;
    for (const t of [this.trail, this.trailL]) { const want = fp ? G.vmScene : G.scene; if (t.mesh.parent !== want) want.add(t.mesh); }
    this.landDip *= Math.max(0, 1 - dt * 6);
    let eyeY = this.eye - this.landDip + (this.block ? -0.05 : 0);
    if (this.dodge && !this.dodge.charge) eyeY -= Math.sin(Math.min(1, this.dodge.t) * Math.PI) * (fp ? 0.7 : 0.2); // (the over-the-shoulder camera barely dips: the body does the rolling)
    if (this.dead) eyeY = this.spectate ? 0 : 0.4; // (arena spectators fly free)
    if (this.swim) eyeY = 1.35;
    const eye = this.pos.clone(); eye.y += eyeY;
    if (fp && settings.headBob && this.onGround && this.speed > 0.5) eye.y += Math.abs(Math.sin(this.vm.bob)) * 0.04;
    cam.rotation.order = 'YXZ';
    cam.rotation.set(this.pitch, this.yaw + Math.PI, 0);
    if (this.dodge && !this.dodge.charge && fp) cam.rotation.z = Math.sin(Math.min(1, this.dodge.t) * Math.PI) * 0.15 * Math.sign(this.dodge.dir.dot(this.right()) || 1);
    if (this.dead && !this.spectate) cam.rotation.z = Math.min(1, this.deadT) * 0.6;
    if (fp) cam.position.copy(eye);
    else {
      const back = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
      // over the right shoulder: the hero sits left of the crosshair
      const ak = this.adsK || 0, ae = ak * ak * (3 - 2 * ak); // aiming down the barrel: the camera slides in behind the stock and looks along the sights
      const sh = this.right().multiplyScalar(0.72 * Math.min(1, this.camDist / 2.5));
      eye.y += 0.12; // (a lower camera keeps the hero up in the frame, clear of the bars at the bottom)
      let d = this.camDist;
      for (let s = 0.5; s <= d; s += 0.4) { const p = eye.clone().add(sh).addScaledVector(back, -s); if (p.y < heightAt(p.x, p.z) + 0.3) { d = Math.max(0.5, s - 0.4); break; } }
      // the camera follows a smoothed point, so steps, landings and rolls don't jolt it
      if (!this.camA || this.camA.distanceTo(eye) > 6) this.camA = eye.clone();
      const kh = Math.min(1, dt * 18), kv = Math.min(1, dt * 9); this.camA.x += (eye.x - this.camA.x) * kh; this.camA.z += (eye.z - this.camA.z) * kh; this.camA.y += (eye.y - this.camA.y) * kv;
      cam.position.copy(this.camA).add(sh).addScaledVector(back, -d);
      // aiming down the barrel: the eye moves to the cheek weld and a detailed weapon comes up into view (drawn on top, like first person)
      if (ae > 0.001) { const cw = this.pos.clone().addScaledVector(this.fwd(), 0.08); cw.y += this.eye - 0.02; cam.position.lerp(cw, ae); }
      this.adsView(ae);
    }
    // shake
    const sk = V.shake * V.shake;
    if (sk > 0) { const t = G.time; cam.position.x += Math.sin(t * 37) * Math.sin(t * 13) * sk * 0.2; cam.position.y += Math.sin(t * 41 + 1) * Math.sin(t * 11) * sk * 0.2; cam.rotation.z += Math.sin(t * 29) * sk * 0.03; } // a smooth rumble, not random jitter
    this.fovKick *= Math.max(0, 1 - dt * 4);
    this.fovS = (this.fovS || 0) + ((this.sprinting ? 7 : 0) - (this.fovS || 0)) * Math.min(1, dt * 6);
    // Kingdom Battles: zoom in a little while drawing the bow (and much more when aiming a musket)
    { const gun = this.W && this.W.kind === 'gun'; const drawing = G.battleFx && this.press && this.press.charging && this.W && (this.W.kind === 'bow' || gun); const want = Math.min(-(this.adsK || 0) * (!gun ? 20 : this.weapon && this.weapon.wt === 'blunderbuss' ? 12 : 30), /* zoom: musket furthest, then bow, then blunderbuss */ drawing ? (gun ? -Math.min(1, (this.press.t - 0.22) / 1.4) * 22 - 8 : -Math.min(1, (this.press.t - 0.22) / 1.8) * 9 - 3) : 0); this.bowZoom = (this.bowZoom || 0) + (want - (this.bowZoom || 0)) * Math.min(1, dt * (drawing || this.ads ? 5 : 9)); }
    cam.fov = settings.fov - (G.fovTrim || 0) + this.fovKick + this.fovS + (this.bowZoom || 0); // (the arena narrows the view a little so fighters look bigger)
    cam.updateProjectionMatrix();
    A.setListener(cam.position.x, cam.position.y, cam.position.z, this.yaw + Math.PI);
  }
}
function W2kind(W) { return W ? W.kind : ''; }
