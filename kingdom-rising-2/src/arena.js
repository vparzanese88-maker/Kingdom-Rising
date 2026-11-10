// Kingdom Arena: duels and team fights in the colosseum. Everyone is level 20 and fully geared, with 20 skill points
// to spend during a 60 second countdown. Objectives: Elimination, Rounds, Deathmatch, Capture the Flag, King of the Hill.
// Computer fighters use their class's real abilities from their skill trees: they move, kite, focus targets together,
// heal and buff each other, peel for their healers and play the objective.
import * as THREE from 'three';
import { G } from './state.js';
import * as Game from './game.js';
import { CLASSES, ABILITIES, CLASS_TREES, ARMOR_SLOT_LIST, TIERS, RACES, isSupport, WEAPON_TYPES, LEVEL_CAP } from './data.js';
import { petDef } from './classes2.js';
import { buildHumanoid, equipWeapon, animateHumanoid, bake, setDetail } from './character.js';
import { Mob } from './mobs.js';
import { V } from './vfx.js';
import { S } from './audio.js'; // (no crowd chatter: it sounded bad)
import { PVP_K, pvpIncoming } from './mp.js';
import { heightAt } from './terrain.js';
import { spawnProjectile, groundPoint, HEADSHOT } from './combat.js';
import * as Icons from './icons.js';
import { glyphBadge } from './icons2.js';
import { classPortrait } from './portraits.js';
import { RUINS, updateRuins } from './ruinsmap.js';
import { collide as worldCollide, groundAt as worldGround, solidAt, lineClear, world } from './world.js';
import { abilityFx, bodyPoseTick, healBeam, boltFx, makeTotem } from './abilityfx.js';
import { makeArrow, makeLightSword, makeGlyph, makeWings, makeDemon, makeHellRing, luteToChest, playNotes, notesTick, addOutline, arenaSpec, arenaBody, arenaDecor, arenaWeaponDecor, arenaLookTick } from './arenalooks.js';
import { loadDemonModel, poseDemonModel, fixNormals } from './heromodels.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { AR, COLORS, COLOR_NAMES, updateColosseum, cheer, ROOM, PILLARS } from './arenamap.js';
import { ARENA_KEY } from './battlemap.js';
import { loadBuild, saveBuild } from './builds.js';
import { AN, send as nsend, lobby as netLobby, RemoteFighter, BotProxy, teamRim } from './arenanet.js';
import { NX, SIPHON, REAP, siphonKey, botSiphon, siphonOn, siphNet } from './necro.js';
import { BOMB, BX, throwBomb, throwSticky, stickyCharges, detonate, plantBomb, bombNet, lobVel, liveBombs, nearestDanger, bombsNear } from './bomber.js';
const AUTH = () => !AN.on || AN.host; // the host (or a single player) runs the match
const BUILDS = 'kr2_arena_builds';

export const COLORS_LIST = COLORS, COLOR_NAMES_LIST = COLOR_NAMES;
export const OBJECTIVES = {
  elim: { name: 'Elimination', icon: '⚔', desc: 'One life each. The last fighter or team standing wins.', lives: 'one' },
  rounds: { name: 'Rounds', icon: '🏆', desc: 'Best of three rounds of Elimination: win two rounds to win the match.', lives: 'one' },
  dm: { name: 'Deathmatch', icon: '💀', desc: 'Score kills. The first fighter or team to reach the kill target wins.', lives: 'respawn' },
  ctf: { name: 'Capture the Flag', icon: '🚩', desc: 'Steal the enemy banner from their gate and carry it to yours while your own is safe. First to 3 captures.', lives: 'respawn', teams: true },
  koth: { name: 'King of the Hill', icon: '👑', desc: 'Hold the golden ring in the centre. Only your side standing in it scores. First to 100 points.', lives: 'respawn' },
};
export const FORMATS = {
  duel: { name: 'Duel', desc: 'One against one', teams: 2, size: 1 },
  ffa: { name: 'Free for all', desc: '3 to 12 fighters, everyone for themselves', ffa: true },
  t2: { name: '2 v 2', teams: 2, size: 2 }, t3: { name: '3 v 3', teams: 2, size: 3 }, t4: { name: '4 v 4', teams: 2, size: 4 }, t6: { name: '6 v 6', teams: 2, size: 6 },
  t333: { name: '4 teams of 3', teams: 4, size: 3 }, t444: { name: '3 teams of 4', teams: 3, size: 4 }, t22: { name: '3 teams of 2', teams: 3, size: 2 },
};
const RESPAWN_T = 6, PICK_T = 60; // (60 s in the holding rooms to pick and buff; Y readies up)
// no skill trees in the arena: every class fights with three abilities on F, C and Q
// (a main attack, a control or mobility move, and a heal or defence), and so do the computer fighters
// every class: F a heal, C a pet (pet classes) or a big hit, Q a snare, root, fear or mesmerize
export const ARENA_KITS = { // F, C, Q. Healers heal; tanks sustain; supports do a bit of everything; damage dealers burst
  warrior: ['ar_flameblade', 'ar_mendbanner', 'ar_charge'], berserker: ['earthsplitter', 'ar_legsweep', 'ar_battleshout'], /* (the owner: Leap Strike on F, a leg sweep on C, a battle shout on Q) */ paladin: ['layonhands', 'smitearc', 'hammerstrike'], darkknight: ['lifetap', 'gravewall', 'deathgrip'],
  cleric: ['radiantheal', 'ar_purify', 'holysmite'], monk: ['flyingkick', 'hundredfists', 'pressure'],
  bard: ['ar_mendsong', 'crescendo', 'mesmerize2'], druid: ['regrowth', 'callbear', 'entangle'], shaman: ['sh_wave', 'sh_wolf', 'sh_hex'],
  ranger: ['ar_firearrow', 'focus', 'ar_bola'], /* (the owner: F a huge fire arrow that hurls him back and stuns, C Hunter's Focus, Q a double-arrow bola that slows and heals him) */ musketeer: ['ar_bandage', 'grapeshot', 'bolas'], blunderbuss: ['powdercharge', 'buckshot', 'buttstroke'], wizard: ['ar_missiles', 'blink', 'ar_arcshield'], /* (the owner: F Magic Missiles, C Blink, Q Temporal Bolt; Disintegrate left the kit) */
  rogue: ['ar_leechstab', 'eviscerate', 'kidney'], necromancer: ['drainlife', 'ar_plaguebreath', 'ar_skullfear'], elementalist: ['lightninglash', 'callflame', 'frostbind'], enchanter: ['mindrot', 'ar_mindlock', 'mesmerize'], beastmaster: ['packfrenzy', 'warbeast', 'feralroar'],
  priest: ['pr_halo', 'pr_word', 'pr_chains'], bombardier: ['bo_rocket', 'bo_smoke', 'bo_stickies'], /* (Q sticky bombs; right click the detonator; the old Cluster and Sticky Bomb are retired) */
};
export const ROLE = { warrior: 'Tank', berserker: 'Tank', paladin: 'Tank', darkknight: 'Tank', blunderbuss: 'Tank', cleric: 'Healer', druid: 'Healer', shaman: 'Healer', bard: 'Healer', priest: 'Healer' }; // everyone else: Damage
// the ultimate on R: charges over time and faster as you deal damage or heal; one big ability per class
export const ARENA_ULT = { warrior: 'stonebanner', berserker: 'ar_bladestorm', paladin: 'ar_wrath', darkknight: 'harbinger', cleric: 'ar_miracle', druid: 'ar_overgrowth', shaman: 'ar_spirittotem', bard: 'cacophony', monk: 'ar_fists',
  ranger: 'ar_arrowrain', musketeer: 'ar_barrage', blunderbuss: 'greatkeg', wizard: 'ar_transcend', rogue: 'ar_assassinate', necromancer: 'ar_demon', elementalist: 'pureel', enchanter: 'mindshatter', beastmaster: 'direbeast' };
export const ultOf = (cls) => { kitRules(); const id = ARENA_ULT[cls]; return (ABILITIES[cls] || []).some(a => a.id === id) ? id : null; };
export const roleOf = (cls) => ROLE[cls] || 'Damage';
// perks: ten for every class, three ranks each, bought with points that come with time (1 every 30 s of fighting)
const SUPPORT_CLS_K = new Set(['cleric', 'druid', 'shaman', 'paladin', 'bard', 'enchanter', 'priest']);
const RANGED_CLS = new Set(['priest', 'bombardier', 'ranger', 'musketeer', 'blunderbuss', 'wizard', 'necromancer', 'elementalist', 'enchanter', 'druid', 'shaman']);
// each class: six perks that sharpen its own abilities and four passives that are its alone
const PASSIVE = {
  bannerLong: ['Lasting Banners', 'Your banners stand 20% longer per rank: the Banner of Mending and the War Banner alike.', '⏳'], bannerSwift: ['Swift Banners', 'Your Banner of Mending comes back 10% sooner and your War Banner charges 15% faster per rank.', '⚑'],
  mendWide: ['Wide Mending', 'Your Banner of Mending and the ring it heals inside grow 20% bigger per rank.', '🚩'], chargeFar: ['Long Charge', 'Your Shield Charge drives 25% further per rank.', '🛡'], /* (the warrior's own perks: the owner asked for them) */
  thorns: ['Thorns', 'Enemies who hit you in melee take 8% of that damage back per rank.', '🌵'], lastStand: ['Last Stand', 'Below 30% health you take 10% less damage per rank.', '⛨'],
  execute: ['Executioner', 'Hit enemies below 35% health 10% harder per rank.', '☠'], rage: ['Blood Rage', 'The more hurt you are, the harder you hit: up to 18% more per rank.', '🔥'],
  ambush: ['Ambush', 'Your hits from stealth do 20% more per rank.', '🗡'], haste: ['Flurry', 'Attack 6% faster per rank.', '⚡'], crit: ['Keen Eye', '5% more chance to crit per rank.', '🎯'],
  burnHit: ['Searing Strikes', 'Your hits can set enemies burning (stronger per rank).', '🔥'], chillHit: ['Frostbite', 'Your hits can chill and slow enemies (longer per rank).', '❄'],
  poisonHit: ['Venom', 'Your hits can poison enemies (stronger per rank).', '☣'], bleedHit: ['Serrated Edge', 'Your hits can make enemies bleed (stronger per rank).', '🩸'],
  shieldHeal: ['Guardian Light', 'Your heals also give a shield worth 15% of the heal per rank.', '✦'], cdAll: ['Focus', 'All your abilities come back 4% sooner per rank.', '⌛'],
  songRegen: ['Song of Vigor', 'You play a song: allies near you regenerate 0.6% health a second per rank.', '♫'], songDef: ['Song of Valour', 'Allies near you take 4% less damage per rank.', '♪'],
  songAtk: ['Song of Battle', 'Allies near you deal 5% more damage per rank.', '♬'], songArea: ['Resounding Voice', 'Your songs reach 20% further per rank.', '📯'],
  auraDef: ['Devotion Aura', 'Allies within 9 m take 4% less damage per rank.', '🛡'], auraRegen: ['Sanctuary', 'Allies within 9 m regenerate 0.5% health a second per rank.', '✚'], auraAtk: ['Totem of Wrath', 'Allies within 9 m deal 5% more damage per rank.', '🗿'],
  wpn: ['Weapon Mastery', 'Your weapon hits (basic attacks and physical blows) do 8% more damage per rank.', '⚔'], spell: ['Arcane Might', 'Your spells (fire, frost, holy, shadow, nature and other magic) do 8% more damage per rank.', '✦'], mres: ['Plate and Parry', 'Take 6% less damage from melee hits per rank.', '⛨'], sres: ['Spellward', 'Take 6% less damage from spells per rank.', '❂'],
  hp: ['Iron Constitution', '8% more health per rank.', '❤'], armor: ['Unbreakable', 'Take 6% less damage per rank.', '🛡'], speed: ['Fleet Foot', 'Move 4% faster per rank.', '➶'], lifesteal: ['Siphoning Strikes', 'Heal for 3% of the damage you deal per rank.', '🩸'], heal: ['Blessed Hands', 'Your healing is 10% stronger per rank.', '✚'],
};
const UNIQUE = { warrior: ['thorns', 'lastStand', 'execute', 'hp'], paladin: ['auraDef', 'thorns', 'shieldHeal', 'armor'], darkknight: ['lifesteal', 'lastStand', 'execute', 'armor'], berserker: ['rage', 'lifesteal', 'execute', 'haste'],
  cleric: ['shieldHeal', 'heal', 'auraRegen', 'cdAll'], monk: ['haste', 'heal', 'lifesteal', 'cdAll'], bard: ['songRegen', 'songDef', 'songAtk', 'songArea'], druid: ['auraRegen', 'poisonHit', 'heal', 'speed'], shaman: ['auraAtk', 'burnHit', 'heal', 'speed'],
  ranger: ['crit', 'bleedHit', 'speed', 'execute'], musketeer: ['crit', 'execute', 'burnHit', 'lifesteal'], blunderbuss: ['armor', 'lastStand', 'burnHit', 'thorns'], wizard: ['crit', 'cdAll', 'chillHit', 'speed'],
  rogue: ['ambush', 'poisonHit', 'execute', 'crit'], necromancer: ['poisonHit', 'lifesteal', 'lastStand', 'cdAll'], elementalist: ['burnHit', 'chillHit', 'crit', 'cdAll'], enchanter: ['chillHit', 'cdAll', 'crit', 'auraDef'], beastmaster: ['rage', 'lifesteal', 'haste', 'bleedHit'],
  priest: ['shieldHeal', 'heal', 'auraRegen', 'cdAll'], bombardier: ['burnHit', 'crit', 'execute', 'speed'] };
const STAT_KIND = new Set(['hp', 'armor', 'speed', 'lifesteal', 'heal', 'wpn', 'spell', 'mres', 'sres']);
// the basic perks every class has (the owner: health, weapon and spell damage, melee and spell defence, speed)
const BASIC_PERKS = ['hp', 'wpn', 'spell', 'mres', 'sres', 'speed'];
export function perksFor(cls) { kitRules(); const A2 = ABILITIES[cls] || [], nm = (id) => (A2.find(a => a.id === id) || {}).name || '?', [f, c, q] = ARENA_KITS[cls] || [];
  const W = (WEAPON_TYPES[(CLASSES[cls].weapons || [])[0]] || {}).name || 'weapon';
  // the owner: only the basic perks for now (more will be added later)
  const list = [];
  for (const k of BASIC_PERKS) { const [n, d, g] = PASSIVE[k]; list.push({ id: k, kind: k, key: k, name: n, desc: d, glyph: g, basic: true }); }
  // the skill tree (the owner): a column for each of F, C, Q and the ultimate, three tiers down each; a tier opens once the one above it has a rank
  const ult = ultOf(cls), cols = [['F', f], ['C', c], ['Q', q], ['U', ult]];
  for (const [slot, id] of cols) { if (!id) continue; const an = nm(id), own = (TREE_OVERRIDE[cls] || {})[slot];
    const tiers = own || ['pow', 'cd', 'ext']; tiers.forEach((t, i) => { if (PASSIVE[t]) { const [n, d, g] = PASSIVE[t]; list.push({ id: t, kind: 'p', key: t, name: n, desc: d, glyph: g, tree: slot, tier: i + 1, ab: id }); return; }
      const T = { pow: ['Power', slot === 'U' ? `${an} hits 12% harder per rank.` : `${an} hits (and heals) 12% harder per rank.`, '⚔'], cd: slot === 'U' ? ['Charge', `Your ultimate charges 15% faster per rank.`, '★'] : ['Haste', `${an} comes back 10% sooner per rank.`, '⌛'], ext: ['Reach', `${an} reaches 15% further and its effects last 15% longer per rank.`, '◎'] }[t];
      list.push({ id: t + slot, kind: t, slot, name: `${T[0]}`, desc: T[1], glyph: T[2], tree: slot, tier: i + 1, ab: id }); }); }
  return list; }
// a class's own perks in its tree (the owner asked for the warrior's): his banner column carries Wide Mending, Swift Banners and Lasting Banners; his charge ends in Long Charge
const TREE_OVERRIDE = { warrior: { C: ['mendWide', 'bannerSwift', 'bannerLong'], Q: ['pow', 'cd', 'chargeFar'] } };
export function treeOpen(h, pk) { if (!pk.tree || pk.tier <= 1) return true; const R2 = h.arenaPerks || {}, up = perksFor(h.cls).find(x => x.tree === pk.tree && x.tier === pk.tier - 1); return !up || (R2[up.id] || 0) > 0; }
export function treeBelowHas(h, pk) { if (!pk.tree) return false; const R2 = h.arenaPerks || {}, dn = perksFor(h.cls).find(x => x.tree === pk.tree && x.tier === pk.tier + 1); return !!dn && (R2[dn.id] || 0) > 0; }
const CLASS_PERKS = {};
// add up what has been bought into h.arenaPK, which the combat code reads
export function recomputePK(h) { const P = { pow: {}, cd: {}, ext: {}, hp: 0, armor: 0, speed: 0, lifesteal: 0, heal: 0, wpn: 0, spell: 0, mres: 0, sres: 0 }; const R2 = h.arenaPerks || {};
  P.p = {}; for (const pk of perksFor(h.cls)) { const n = R2[pk.id] || 0; if (!n) continue; if (pk.kind === 'pow' || pk.kind === 'cd' || pk.kind === 'ext') P[pk.kind][pk.slot] = (P[pk.kind][pk.slot] || 0) + n; else if (pk.kind === 'p') P.p[pk.key] = n; else P[pk.kind] += n; } h.arenaPK = P; h.arenaSongs = !!(P.p.songRegen || P.p.songDef || P.p.songAtk); }
const freePP = () => { const h = G.player && G.player.h; return h && h.camp ? { you: true, pp: Math.min(20, h.level || 1) } : (G.yardPP || (G.yardPP = { you: true, pp: 99 })); }; /* (the campaign: a perk point per level; the yard: all of them) */
G.hooks.ultRate = (h) => ultRate(h); /* (the player's damage-driven charge uses it too) */
G.hooks.perkPts = () => { const f = A.me && A.F && A.F.length ? A.me : freePP(); return perkLeft(f); }; // (the HUD badge beside the abilities)
const perkLeft = (f) => { const h = unitHero(f) || {}, R2 = h.arenaPerks || {}; return (f.pp || 0) - (h.cls ? perksFor(h.cls) : []).reduce((a, pk) => a + (R2[pk.id] || 0), 0); }; /* (every rank bought, in the tree or the basics) */ /* (a class's own perks use points too) */ // (old perks bought before the trim don't use up points)
const unitHero = (f) => f.you ? G.player && G.player.h : f.bot ? f.bot.h : null;
function applyPerkStats(f) { const h = unitHero(f); if (!h) return; recomputePK(h); if (f.you) { const p = G.player, k = p.hp / p.maxHp; p.refreshStatsOnly(); p.hp = p.maxHp * k; } else if (f.bot) { const b = f.bot, k = b.hp / b.maxHp; b.maxHp = Math.round(b.baseHp * Game.arenaHpK(h)); b.hp = b.maxHp * k; } }
// computer fighters buy as soon as they can: tanks toughen up, healers heal harder, the rest go for damage
function botBuy(f) { const h = f.bot.h, list = perksFor(h.cls), want = Game.TANK_CLS.has(h.cls) ? ['mres', 'armor', 'hp', 'powQ', 'cdF', 'powL', 'sres'] : SUPPORT_CLS_K.has(h.cls) ? ['heal', 'powF', 'cdF', 'hp', 'speed', 'powL'] : ['wpn', 'powL', 'powC', 'spell', 'cdC', 'lifesteal', 'powQ'];
  h.arenaPerks = h.arenaPerks || {}; while (perkLeft(f) > 0) { const ok = (p) => p && (h.arenaPerks[p.id] || 0) < Game.PERK_MAX && treeOpen(h, p), pick = want.map(id => list.find(p => p.id === id)).find(ok) || list.find(ok); /* (the tree's locks hold for bots too) */ if (!pick) break; h.arenaPerks[pick.id] = (h.arenaPerks[pick.id] || 0) + 1; } applyPerkStats(f); }
// passive auras and songs: every half second, allies near a bard, paladin, cleric, druid or shaman with those perks
// get their regeneration, defence or attack bonus; songs float notes over everyone they touch
let auraT = 0, noteT = 0;
function auraTick(dt) { if ((auraT -= dt) > 0) return; auraT = 0.5; noteT -= 0.5; const notes = noteT <= 0; if (notes) noteT = 2.5;
  const units = A.F.filter(f => f.alive).map(f => [f, unitOf(f)]).filter(([, u]) => u && !u.dead);
  for (const [, u] of units) u.aura = { atk: 0, def: 0, regen: 0, t: 0.7 };
  for (const [f, u] of units) { const h = unitHero(f), pv = (k) => Game.arenaPassive(h, k); if (!h) continue;
    const song = pv('songRegen') || pv('songDef') || pv('songAtk'), r = (song ? 10 : 9) * (1 + 0.2 * pv('songArea'));
    const atk = 0.05 * (pv('songAtk') + pv('auraAtk')), def = 0.04 * (pv('songDef') + pv('auraDef')), regen = 0.006 * pv('songRegen') + 0.005 * pv('auraRegen'); if (!atk && !def && !regen) continue;
    for (const [g, v] of units) { if (g.team !== f.team || Math.hypot(v.pos.x - u.pos.x, v.pos.z - u.pos.z) > r) continue; v.aura.atk += atk; v.aura.def = Math.min(0.5, v.aura.def + def); v.aura.regen += regen;
      if (song && notes) playNotes(G.scene, v, '#ffd860', v === u ? 3 : 2); } }
  for (const [, u] of units) if (u.aura.regen > 0) { if (u === G.player) u.heal(u.maxHp * u.aura.regen * 0.5, true); else u.healSelf(u.maxHp * u.aura.regen * 0.5); } }
// ultimate charge: 1% a second, more for damage done and healing given; computer fighters fire theirs in a fight
function ultTick(dt) { for (const f of A.F) { const h = unitHero(f); if (!h || !h.arenaUlt || !f.alive) continue; h.ultCharge = Math.min(100, (h.ultCharge || 0) + dt * 1.0 * ultRate(h));
    if (f.bot && h.ultCharge >= 100 && f.bot.target && !f.bot.dead && !f.bot.cast && !(f.bot.status.silence > 0) && (f.bot.cls === 'bombardier' ? bertWant(f.bot, h, dt) : Math.hypot(f.bot.target.pos.x - f.bot.pos.x, f.bot.target.pos.z - f.bot.pos.z) < 12)) { const a = ABILITIES[h.cls].find(x => x.id === h.arenaUlt); if (a) { h.ultCharge = 0; V.ultUntil = performance.now() + 7000; f.bot.act = 'castUp'; f.bot.actT = 0; f.bot.resolve(a, a.t === 'heal' || a.t === 'hot' || a.t === 'buff' ? f.bot : f.bot.target); V.burst('gold', f.bot.pos.clone().setY(f.bot.pos.y + 1.5), 40, { speed: 5 }); feed(`<b>${esc2(f.name)}</b> unleashes ${a.name}!`); } } } }
const esc2 = (t) => String(t).replace(/[<>&]/g, '');
export function ultRate(h) { return (1 + 0.15 * Game.perkLvl(h, h && h.arenaUlt, 'cd')) * (1 + 0.15 * Game.arenaPassive(h, 'bannerSwift')); } /* (the tree's Charge, and the warrior's Swift Banners) */
export function ultGain(h, amt) { if (h && h.arenaUlt) h.ultCharge = Math.min(100, (h.ultCharge || 0) + amt * ultRate(h)); }
function perkTick(dt) { A.perkClock = (A.perkClock || 0) + dt; if (A.perkClock < 30) return; A.perkClock -= 30; /* (one perk point every 30 s) */
  for (const f of A.F) { f.pp = Math.min(30, (f.pp || 0) + 1); if (f.bot) botBuy(f); }
  if (A.me) { S.click(); A.hooks.toast && A.hooks.toast(`Perk point earned · ${perkLeft(A.me)} to spend (P)`, '◆', 'gold'); } }
// right click: a defensive move (a shield blocks instead); the bow and the guns aim down the barrel
export const ARENA_RMB = { warrior: 'ar_shbash', berserker: 'ar_axethrow', ranger: 'aim', musketeer: 'aim', blunderbuss: 'ar_ironhide', shaman: 'ar_totem', wizard: 'phaseshift', cleric: 'ar_mendC', paladin: 'shieldofl',
  /* darkknight: blocks (Bone Guard is on C) */ druid: 'ar_mendD', monk: 'ar_wraps', bard: 'ar_mendB', rogue: 'ar_shadowstep', necromancer: 'bonearmor', elementalist: 'iceshell', enchanter: 'runeshield', beastmaster: 'naturesembrace', priest: 'ar_mendP', bombardier: 'bo_detonate' };
export const rmbOf = (cls) => { kitRules(); const id = ARENA_RMB[cls]; return id === 'aim' || (ABILITIES[cls] || []).some(a => a.id === id) ? id : null; };
export const kitOf = (cls) => (kitRules(), ARENA_KITS[cls] || []).filter(id => (ABILITIES[cls] || []).some(a => a.id === id));
// heals in a three-button kit get a real cooldown (12 s at least), or they could be cast over and over
let kitRulesDone = false;
// the arena's own moves, and cooldowns tuned for a three-key kit (no mana: everything runs on cooldowns)
const ARENA_NEW = {
  bombardier: [{ id: 'bo_stickies', name: 'Sticky Bombs', t: 'stickies', kit: true, charges: 5, cd: 0.5, cost: 0, fx: 'fire', level: 1, desc: 'Throw a sticky bomb where you aim: it sticks to whatever it hits (the ground, a wall, or an enemy, and rides along on them). You carry 5: once all 5 are thrown they come back, one every 0.5 s. Up to 5 can be out at once: throw a sixth and the oldest falls off. They wait for your detonator (right click), then each one goes up in a big 4.5 m blast; one left alone for 20 s goes off by itself, smaller.' },
    { id: 'bo_detonate', name: 'Detonator', t: 'detonate', kit: true, cd: 0.3, cost: 0, fx: 'fire', level: 1, desc: 'Slam the plunger on your belt: every bomb you have out goes off at once. Thrown bombs burst as normal; sticky bombs go up in a much bigger blast. It never sets off Big Bertha.' }],
  priest: [{ id: 'ar_mendP', name: 'Flash of Dawn', t: 'mend', kind: 'dawn', heal: 0.2, cd: 6, cost: 0, fx: 'holy', level: 1, desc: 'A flash of dawn light into the ally under your crosshair, even through walls (or yourself): it heals them and wraps them in a shield of light that soaks damage for 4 s.' }],
  rogue: [{ id: 'ar_assassinate', name: 'Assassinate', t: 'assassinate', cd: 90, cost: 0, fx: 'shadow', level: 1, desc: 'Aim at an enemy: you melt into the shadows and step out right behind them, seize them and drive your blade into their back. Below half health they die; anyone else loses 45% of their health and is silenced for 2 s.' },
    { id: 'ar_leechstab', name: 'Leeching Stab', kit: true, t: 'strike', dmg: 1.3, cd: 10, cost: 0, fx: 'blood', regen: [0.3, 6], level: 1, desc: 'A deep stab that drinks from the wound: you regenerate 30% of your health over 6 s.' },
    { id: 'ar_shadowstep', name: 'Shadow Step', kit: true, t: 'stealth', dur: 3, cd: 18, cost: 0, fx: 'shadow', step: 7, level: 1, desc: 'Step through the shadows 7 m forward (behind the enemy you aim at, if one is close) and vanish for 3 s.' }],
  bard: [{ id: 'ar_mendB', name: 'Mending Chord', t: 'mend', kind: 'song', heal: 0.18, cd: 6, cost: 0, fx: 'gold', level: 1, desc: 'A flowing chord of music into the ally under your crosshair, even through walls (or yourself); allies around them hear it too and heal a little.' },
    { id: 'ar_mendsong', name: 'Song of Mending', t: 'hot', self: 0.3, pct: 0.3, ally: 0.25, r: 10, dur: 6, notes: true, cd: 15, cost: 0, fx: 'gold', level: 1, desc: 'Play a mending song: you heal 30% over 6 s and every ally within 10 m of you heals 25% at once. Notes swirl round everyone it touches.' }],
  musketeer: [{ id: 'ar_bandage', name: 'Field Bandage', kit: true, t: 'heal', self: 0.001, regen: [0.22, 3], cd: 15, cost: 0, fx: 'leaf', level: 1, desc: 'Slap a bandage on and ram the next ball home: you heal 22% of your health over 3 s and your musket is reloaded at once.' },
    { id: 'ar_barrage', name: 'Arcane Barrage', t: 'barrage', cd: 90, cost: 0, fx: 'arcane', level: 1, desc: 'Ram a glowing ball of raw magic down the barrel: for 10 s your rifle crackles with power and fires as fast as you hold the trigger, a stream of arcane rounds (no reloading).' }],
  wizard: [{ id: 'ar_transcend', name: 'Arcane Ascension', t: 'transcend', cd: 90, cost: 0, fx: 'arcane', level: 1, desc: 'Rise off the ground for 10 s and hover on a platform of violet runes: you glide 40% faster and cast 50% faster, every bolt explodes over an area, and everything you cast hits 50% harder. You cannot dodge or jump while you hover.' }],
  cleric: [{ id: 'ar_purify', name: 'Purifying Light', kit: true, t: 'heal', self: 0.1, ally: 0.1, r: 12, cleanse: true, cd: 22, cost: 0, fx: 'gold', level: 1, desc: 'A wave of purifying light: you and every ally within 12 m are cleansed of stuns, roots, slows, fear, silence, mesmerize, poison, bleeding and burning, cannot be controlled for 1 s, and heal 10%.' },
    { id: 'ar_mendC', name: 'Divine Light', t: 'mend', kind: 'holy', heal: 0.32, cd: 6, cost: 0, fx: 'holy', level: 1, desc: 'Pour a beam of holy light into the ally under your crosshair, even through walls (or yourself if you aim at nobody): the strongest single heal in the arena.' },
    { id: 'ar_miracle', name: 'Miracle', t: 'miracle', cd: 90, cost: 0, fx: 'holy', level: 1, desc: 'Call a miracle down on the ally under your crosshair (or yourself): a pillar of light heals them to full and wraps them in a golden shield that makes them untouchable for 3 s, and everyone near them heals by half their health.' }],
  druid: [{ id: 'ar_mendD', name: 'Living Vine', t: 'mend', kind: 'nature', heal: 0.2, cd: 5, cost: 0, fx: 'leaf', level: 1, desc: 'Send a stream of living leaves into the ally under your crosshair, even through walls (or yourself): it heals now and keeps healing for 4 s.' },
    { id: 'ar_overgrowth', name: 'Overgrowth', t: 'overgrowth', cd: 90, cost: 0, fx: 'leaf', level: 1, desc: 'Plant your staff and the wild comes: a forest bursts out of the ground around you and races outward across the whole arena. Every ally it reaches is healed (a third of their health at once and more over time), every enemy it reaches is tangled and slowed, and then the trees slowly wither back into the earth.' }],
  shaman: [{ id: 'ar_totem', name: 'Healing Totem', t: 'totem', cd: 8, cost: 0, fx: 'water', level: 1, desc: 'Throw a healing totem where you aim: it plants itself and pulses healing to every ally within 6 m each second for 6 s (36% of their health in all). One totem at a time.' },
    { id: 'ar_spirittotem', name: 'Spirit of the Storm', t: 'spirittotem', cd: 90, cost: 0, fx: 'lightning', level: 1, desc: 'A giant spirit totem bursts out of the ground where you aim, ancestral spirits circling it. For 7 s it pulses: every ally within 12 m heals 10% of their health, and lightning leaps from it to every enemy within 12 m. Then it cracks and sinks away.' },
    { id: 'ar_mendS', name: 'Healing Stream', t: 'mend', kind: 'water', heal: 0.22, cd: 6, cost: 0, fx: 'water', level: 1, desc: 'A stream of healing water into the ally under your crosshair, even through walls (or yourself); it splashes on to the most hurt ally near them for half as much.' }],
  ranger: [{ id: 'ar_arrowrain', name: 'Rain of Arrows', t: 'arrowrain', cd: 90, cost: 0, fx: 'leaf', level: 1, desc: 'Loose a volley into the sky over where you aim: a shadow spreads over a 7 m circle, then a storm of arrows comes down on it for 3 s. Anyone caught inside is struck again and again (about half their health if they stay); arrows stick in them and in the ground. Get out from under the shadow.' }],
  warrior: [{ id: 'ar_charge', name: 'Shield Charge', kit: true, t: 'dash', dur: 0.275, speed: 30, /* (the owner: half the distance it went (dur 0.55); Long Charge adds a quarter of it back per rank) */ dmg: 1.1, stun: 1.3, knockF: 9, plow: true, cd: 10, cost: 0, fx: 'dust', level: 1, desc: 'Raise your shield and plow forward: every enemy in your path is knocked down and stunned for 1.3 s.' },
    { id: 'ar_bash', name: 'Shield Bash', kit: true, t: 'strike', reach: 3, dmg: 1.5, stun: 1.5, cd: 12, cost: 0, fx: 'spark', level: 1, desc: 'Slam your shield into the enemy in front of you: solid damage and a 1.5 s stun.' }],
  berserker: [{ id: 'ar_bladestorm', name: 'Bladestorm', t: 'bladestorm', cd: 90, cost: 0, fx: 'fire', level: 1, desc: 'Become a whirlwind of steel for 5 s: you spin with both axes held out, carving everything around you, and you can steer the storm through the enemy. Anyone inside is dragged in, slowed and cut again and again (60% of their health if they stay in it the whole time), and the storm ends in a blast that throws them away.' }],
  monk: [{ id: 'ar_wraps', name: 'Tighten the Wraps', t: 'wraps', cd: 24, cost: 0, fx: 'gold', level: 1, desc: 'Pull your hand wraps tight and breathe: you break free of any stun, root or slow (it works even while you are stunned), and for 5 s you regenerate 30% of your health, move 30% faster and attack 35% faster. 24 s cooldown.' },
    { id: 'ar_fists', name: 'Thousand Fists', t: 'fists', cd: 90, cost: 0, fx: 'gold', level: 1, desc: 'Gather your chi into a whirlwind that drags every enemy within 9 m into the air around you, then blur between them with a storm of punches, kicks and knees, and finish with a ground-shaking slam that throws them all away. Each one takes half of their health.' },
    { id: 'ar_chiwave', name: 'Chi Wave', kit: true, t: 'heal', self: 0.15, ally: 0.28, r: 12, cd: 9, cost: 0, fx: 'leaf', level: 1, desc: 'A wave of chi washes out from you: allies within 12 m heal 28% at once, you 15%.' },
    { id: 'ar_revival', name: 'Revival', kit: true, t: 'heal', self: 0.4, ally: 0.5, r: 18, cd: 40, cost: 0, fx: 'gold', level: 1, desc: 'Gather your chi and release it: you and every ally within 18 m heal 40-50% of their health. 40 s cooldown.' }],
  paladin: [{ id: 'ar_wrath', name: 'Avenging Wrath', t: 'wrath', cd: 90, cost: 0, fx: 'holy', level: 1, desc: 'Spread golden wings and call down judgment where you aim: a 12 m glyph of light burns into the ground and slows enemies on it, then a giant sword of light plunges out of the sky. Anyone in its heart is impaled; everyone else on the glyph is hurt badly and thrown up; allies on it are healed. Get off the glyph before it lands.' }],
  enchanter: [{ id: 'ar_mindlock', name: 'Mind Lock', kit: true, t: 'mindlock', kind: 'arcane', speed: 50, dmg: 0.8, aoe: 3, silence: 2, cd: 14, cost: 0, fx: 'arcane', level: 1, desc: 'A bolt of binding thought at where you aim: the enemy it hits, and anyone within 3 m of them, is silenced for 2 s (no abilities or ultimate; they can still move and attack).' }],
  blunderbuss: [{ id: 'ar_ironhide', name: 'Iron Hide', kit: true, t: 'buff', buff: 'barrier', amount: 0.25, dur: 5, ironHide: true, cd: 20, cost: 0, fx: 'spark', level: 1, desc: 'Brace like an anvil: a hide of iron absorbs damage equal to 25% of your health for 5 s, and nothing can knock you back while it holds.' }],
  necromancer: [{ id: 'ar_plaguebreath', name: 'Plague Breath', t: 'cone', dmg: 0.35, poisonDot: 0.9, blight: 6, spread: 1, cd: 12, cost: 0, fx: 'leaf', level: 1, desc: 'The shrunken head vomits a roaring spray of plague: everything in front of you is poisoned and Blighted for 6 s (all poison hurts a Blighted enemy 50% more).' },
    { id: 'ar_demon', name: 'Maw of the Abyss', t: 'demon', cd: 90, cost: 0, fx: 'shadow', level: 1, desc: 'A ring of green hellfire bursts up where you aim and slows every enemy inside it while a skeletal demon claws its way out. Whoever is still in the ring and closest to the centre when it rises is seized, lifted over its head and has their head bitten off. If everyone escapes the ring, it hunts around and sinks back down.' },
    { id: 'ar_skullfear', name: 'Skull of Terror', kit: true, t: 'curse', dmg: 0.5, fear: 3, bigSkull: true, cd: 14, cost: 0, fx: 'shadow', level: 1, desc: 'Hurl a screaming skull at the enemy you aim at: it flees from you in terror for 3 s.' }],
};
const CD_FIX = { heal: 15, drain: 8, pet: 60, cc: 12, def: 20 };
function kitRules() { if (kitRulesDone) return; kitRulesDone = true;
  for (const cls in ARENA_NEW) for (const a of ARENA_NEW[cls]) if (ABILITIES[cls] && !ABILITIES[cls].some(x => x.id === a.id)) ABILITIES[cls].push(a);
  for (const cls in ULTS) { const U2 = ULTS[cls]; if (ABILITIES[cls] && !ABILITIES[cls].some(x => x.id === U2.id)) ABILITIES[cls].push({ id: U2.id, name: U2.name, t: U2.t, cd: 90, cost: 0, fx: 'gold', level: 1, desc: U2.desc }); ARENA_ULT[cls] = U2.id; } // (the table's ultimates)
  { const r = ABILITIES.rogue && ABILITIES.rogue.find(a => a.id === 'eviscerate'); if (r) { r.name = 'Backstab'; r.desc = 'Drive your blade into the enemy in front of you: huge damage and it bleeds; double damage from behind.'; r.backstab = true; } }
  for (const c of ['enchanter', 'bard']) for (const a of ABILITIES[c] || []) if (/^mesmerize/.test(a.id) || a.id === 'lullaby') a.mez = true; // (shown as MESMERIZED over their head)
  { const l = ABILITIES.paladin && ABILITIES.paladin.find(a => a.id === 'layonhands'); if (l) { l.self = 0.3; l.ally = 0.35; l.r = 8; l.desc = 'Lay your hands on the light: you heal 30% of your health and allies within 8 m heal 35%.'; } const so = ABILITIES.paladin && ABILITIES.paladin.find(a => a.id === 'shieldofl'); if (so) { so.amount = 0.18; so.dur = 6; so.desc = 'A shield of light absorbs damage equal to 18% of your health for up to 6 s.'; }
    const lt = ABILITIES.darkknight && ABILITIES.darkknight.find(a => a.id === 'lifetap'); if (lt) { lt.dmg = 1.8; lt.drain = 0.8; lt.desc = 'A bolt of shadow that tears at the life of the enemy you aim at: you drink 80% of the damage it does.'; } } // (the shadow knight sustains by draining, the paladin by healing) // (60% on a 20 s cooldown made the paladin unkillable in duels)
  { const n = ABILITIES.necromancer && ABILITIES.necromancer.find(a => a.id === 'drainlife'); if (n) { n.name = 'Life Siphon'; n.cd = SIPHON.cd; n.desc = `Press to start, press again to stop (${SIPHON.dur} s at most). While it is on, a purple beam drains the life of whoever is under your crosshair (a player or a monster, up to ${SIPHON.range} m away, not through walls), slowing them, and a green orb of it flows back and heals you. Aim away and nothing happens. The ${SIPHON.cd} s cooldown starts when it stops.`; n.slow = SIPHON.slow; } }
  designRules(); // (docs/CLASS_DESIGN.md: the crowd-control budget, mesmerize, roots, the new tools)
  for (const cls in ARENA_KITS) { const [fH, fC, fQ] = ARENA_KITS[cls], A2 = ABILITIES[cls] || [], get = (id) => A2.find(x => x.id === id);
    const h = get(fH); if (h && (h.t === 'drain' || h.drain || h.regen)) h.cd = Math.max(h.cd || 0, CD_FIX.drain); else if (h && (h.t === 'heal' || h.t === 'hot' || (LEG_SELF[h.id] && LEG_SELF[h.id][0] === 'heal'))) h.cd = Math.min(20, Math.max(h.cd || 0, CD_FIX.heal)); else if (h) h.cd = Math.max(h.cd || 0, 8); // (only heals get the heal cooldown)
    const c = get(fC); if (c && c.t === 'summon') { c.cd = CD_FIX.pet; c.desc = (c.desc || '').replace(/\.?\s*$/, '.') + ' 60 s cooldown.'; }
    const q = get(fQ); if (q && !q.charges) q.cd = Math.max(q.cd || 0, CD_FIX.cc); /* (charges: the bombardier's sticky bombs come back one at a time) */
    if (cls === 'wizard') { const ps = get('phaseshift'); if (ps) { ps.dur = 4; ps.desc = 'Fade almost invisible for 4 s and move 25% faster: enemies lose sight of you. Your first left click out of it is a critical hit; any attack or ability ends it.'; } }
    const r = get(ARENA_RMB[cls]); if (r && r.t !== 'mend' && r.t !== 'totem' && r.t !== 'detonate') r.cd = Math.min(Math.max(r.cd || 0, CD_FIX.def), 30); // (healers' direct heals stay quick)
    for (const id of [fH, fC, fQ, ARENA_RMB[cls]]) { const x = get(id); if (x) { x.cost = 0; x.castT = 0; if (x.desc) x.desc = x.desc.replace(/,?\s*[\d.]+ s cast,?/, ''); if (x.desc) x.desc = x.desc.replace(/,? no cooldown\.?/, '.'); } } }
  ccBudget(); }
// the design pass (docs/CLASS_DESIGN.md, top ten list): numbers and descriptions change together, so the setup screen,
// the I / H key list and the hotbar tooltips always say what the ability really does
const abIn = (cls, id) => (ABILITIES[cls] || []).find(a => a.id === id);
const fix = (cls, id, o) => { const a = abIn(cls, id); if (a) Object.assign(a, o); return a; };
function designRules() {
  // 3. the stun pile-up: one area slow instead of an area stun, short mesmerizes, short freezes, a root instead of a stun
  fix('berserker', 'intimshout', { t: 'nova', kit: true, r: 8, dmg: 0.2, stun: 0, slow: 4, weaken: [0.25, 4], cd: 16, fx: 'fire', desc: 'A terrifying war shout: every enemy within 8 m is slowed and deals 25% less damage for 4 s.' });
  fix('bard', 'mesmerize2', { stun: 3, mez: true, cd: 16, desc: 'Hold the enemy you aim at spellbound for up to 3 s. Any damage after the first moment wakes them.' });
  fix('enchanter', 'mesmerize', { stun: 3, mez: true, cd: 12, desc: 'The enemy you aim at stands entranced for up to 3 s. Any damage after the first moment wakes them.' });
  fix('elementalist', 'frostbind', { stun: 1.5, spread: 3, desc: 'Encase the enemy you aim at, and anyone within 3 m of it, in ice for 1.5 s.' });
  fix('druid', 'entangle', { r: 6, stun: 0, root: 1.5, slow: 3.5, desc: 'Vines burst from the ground: enemies within 6 m are rooted in place for 1.5 s, then slowed for 2 s.' });
  fix('beastmaster', 'feralroar', { r: 6, stun: 1, desc: 'A beast\'s roar: every enemy within 6 m is stunned for 1 s.' });
  // 1. roots really root now, so they are short; single-target stuns stay within the 1.6 s budget
  fix('ranger', 'entangle2', { root: 1.8, spread: 4, cd: 13, desc: 'Vines burst up around the enemy you aim at: it and everything within 4 m are rooted in place for 1.8 s (they can still shoot and cast).' });
  fix('musketeer', 'bolas', { root: 1.5, desc: 'Hurl weighted cords at the enemy you aim at: its legs are tied and it is rooted in place for 1.5 s (it can still shoot and cast).' });
  fix('priest', 'pr_chains', { root: 2, desc: 'Golden chains burst out of the ground around the enemy you aim at and hold them in place for 2 s (they can still shoot and cast).' });
  fix('rogue', 'kidney', { stun: 1.5, desc: 'A cruel jab that stuns the enemy for 1.5 s.' });
  fix('shaman', 'sh_hex', { stun: 2.5, poly: true, desc: 'Turn the enemy you aim at into a harmless frog for 2.5 s.' });
  // 5. the shield classes get their defensive back: held block raises it (warrior, paladin); Bone Guard moves to C
  if (!abIn('berserker', 'ar_axethrow')) ABILITIES.berserker.push({ id: 'ar_axethrow', name: 'Axe Throw', t: 'axethrow', kit: true, level: 1, cd: 7, cost: 0, fx: 'blood', desc: 'Hurl your great axe: it spins out up to 24 m and the first enemy it hits is cut and stunned for 1.2 s; then it whirls back to your hand, cutting enemies again. Right click again to call it back early. You can move, but you cannot attack until you catch it.' });
  if (!abIn('ranger', 'ar_firearrow')) ABILITIES.ranger.push({ id: 'ar_firearrow', name: 'Blazing Arrow', t: 'firearrow', kit: true, level: 1, cd: 9, cost: 0, fx: 'fire', dmg: 2.4, stun: 1.5, el: 'fire', desc: 'Loose a huge burning arrow: it hits hard, sets the target alight and stuns it for 1.5 s, and the recoil throws you back in a flip.' });
  if (!abIn('wizard', 'ar_arcshield')) ABILITIES.wizard.push({ id: 'ar_arcshield', name: 'Arcane Shield', t: 'arcshield', kit: true, level: 1, cd: 14, cost: 0, fx: 'arcane', amount: 0.35, dur: 5, desc: 'Wrap yourself in a faint violet shell for 5 s that soaks up damage worth 35% of your health. It fades when the time runs out or once it has taken all it can hold.' });
  if (!abIn('wizard', 'ar_missiles')) ABILITIES.wizard.push({ id: 'ar_missiles', name: 'Magic Missiles', t: 'missiles', kit: true, level: 1, cd: 16, cost: 0, fx: 'arcane', dur: 6, n: 3, dmg: 1.0, el: 'arcane', desc: 'For 6 s your spellbook looses magic missiles instead of bolts, twice as fast. Each one seeks the enemy nearest your crosshair, sweeping out in an arc and curving in to it wherever it runs, and bursts on the first thing it touches on the way: a wall, a tree, another fighter.' }); /* (n: a computer wizard looses a salvo of three) */
  if (!abIn('ranger', 'ar_bola')) ABILITIES.ranger.push({ id: 'ar_bola', name: 'Bola Shot', t: 'bola', kit: true, level: 1, cd: 10, cost: 0, fx: 'leaf', dmg: 0.9, slow: 3, desc: 'Two arrows joined by a weighted cord fly side by side: whatever they catch is tangled and slowed for 3 s, and the hit heals you for 10% of your health.' });
  if (!abIn('berserker', 'ar_legsweep')) ABILITIES.berserker.push({ id: 'ar_legsweep', name: 'Rending Slash', t: 'zslash', range: 5, ang: 0.95, dmg: 1.4, slow: 3, kit: true, level: 1, cd: 8, cost: 0, fx: 'blood', desc: 'A fast, brutal slash that tears a red arc through the air: every enemy in front of you takes heavy damage and is slowed for 3 s.' });
  if (!abIn('berserker', 'ar_battleshout')) ABILITIES.berserker.push({ id: 'ar_battleshout', name: 'Battle Shout', t: 'buff', buff: 'shout', dur: 6.2, kit: true, level: 1, cd: 18, cost: 0, fx: 'fire', desc: 'A savage battle roar: for 8 s you swing your axe 35% faster.' });
  if (!abIn('warrior', 'ar_flameblade')) ABILITIES.warrior.push({ id: 'ar_flameblade', name: 'Flame Blade', t: 'buff', buff: 'flame', dur: 8, kit: true, level: 1, cd: 16, cost: 0, fx: 'fire', desc: 'Set your sword ablaze for 8 s: every blow adds burning fire damage, and the blade burns while it lasts.' });
  if (!abIn('warrior', 'ar_mendbanner')) ABILITIES.warrior.push({ id: 'ar_mendbanner', name: 'Banner of Mending', t: 'mendbanner', kit: true, level: 1, cd: 18, cost: 0, fx: 'leaf', desc: 'Plant a holy banner where you aim (up to 5 m away): for 8 s you and your allies inside its ring (12 m across) slowly regain health.' });
  if (!abIn('warrior', 'ar_shbash')) ABILITIES.warrior.push({ id: 'ar_shbash', name: 'Shield Bash', t: 'shbash', kit: true, level: 1, cd: 6, cost: 0, dmg: 0.8, stun: 1.2, fx: 'frost', desc: 'Drive your shield into whoever is in front of you: a solid hit that knocks them back and stuns them for 1.2 s.' });
  fix('warrior', 'shieldwall', { t: 'buff', buff: 'wall', dur: 3.9, kit: true, cd: 20, cost: 0, fx: 'frost', desc: 'Brace behind your shield: you take 60% less damage from every direction for 5 s. Hold block for 1 s to raise it.' });
  { const so = abIn('paladin', 'shieldofl'); if (so) so.desc = 'A shield of light absorbs damage equal to 18% of your health for up to 6 s. Hold block for 1 s to raise it.'; }
  fix('darkknight', 'gravewall', { amount: 0.25, dur: 6, cd: 18, boneGuard: true, desc: 'A shell of bone and shadow absorbs damage equal to 25% of your health for up to 6 s; enemies who hit you in melee while it holds are slowed for 1 s.' });
  // 4. self-sustain: Second Wind on Execute, Leeching Stab on F (Envenom becomes a passive), Field Bandage, Iron Hide
  { const ex = abIn('warrior', 'execute'); if (ex && !/Second Wind/.test(ex.desc || '')) ex.desc = (ex.desc || '').replace(/\.?\s*$/, '.') + ' Second Wind: the blow heals you 8% of your health, or 25% if it kills.'; }
  fix('rogue', 'ar_leechstab', { desc: 'A deep stab that drinks from the wound: you regenerate 30% of your health over 6 s. Envenom (passive): every third dagger hit also poisons.' });
  // 8. Assassinate with counterplay
  fix('rogue', 'ar_assassinate', { desc: 'Aim at an enemy within 30 m: a shadow mark flares over them for half a second (they hear a whisper and can dodge or blink away to break it), then you step out of the shadows behind them and drive your blade in. Below half health they die; anyone else loses 45% of their health and is silenced for 2 s. You stay invisible for 2 s after.' });
}
// the hard-control budget on every arena key: 1.6 s on one target, 1.0 s from an area wider than 4 m (ultimates may go to 2.5 s)
function ccBudget() {
  for (const cls in ARENA_KITS) for (const id of [...ARENA_KITS[cls], ARENA_RMB[cls]]) { const a = abIn(cls, id); if (!a || !a.stun || a.mez || a.poly) continue;
    const cap = isAreaAb(a) ? CC.area : CC.single; if (a.stun <= cap) continue; const old = a.stun; a.stun = cap; if (a.desc) a.desc = a.desc.split(`${old} s`).join(`${cap} s`); }
}
// arena fights are slower and heavier than in the open world (more like New World): everyone deals 25% less to other fighters, so fights last longer and each hit counts
const PACE = 0.75;
export function defaultArena() { return { fmt: 't3', ffaN: 6, objective: 'elim', lives: 'one', slots: [] }; }
export function readArena() { try { const s = JSON.parse(sessionStorage.getItem(ARENA_KEY) || 'null'); if (s && s.slots && s.slots.length >= 2) return s; } catch (e) { /* fall back */ } const s = defaultArena(); fillSlots(s); return s; }
// lay out the fighters for a format: you in slot 0, then everyone else (random classes unless picked)
export function fillSlots(s, keep = true) {
  const F = FORMATS[s.fmt], n = F.ffa ? Math.max(3, Math.min(12, s.ffaN || 6)) : F.teams * F.size, old = keep ? s.slots || [] : [], cls = Object.keys(CLASSES), races = Object.keys(RACES).filter(r => RACES[r].playable);
  const out = [];
  for (let i = 0; i < n; i++) { const o = old[i] || {}; out.push({ you: i === 0, cls: o.cls || (i === 0 ? 'warrior' : cls[(Math.random() * cls.length) | 0]), race: o.race || (i === 0 ? 'human' : races[(Math.random() * races.length) | 0]), name: o.name || '', team: F.ffa ? i : Math.floor(i / F.size) }); }
  s.slots = out; return s;
}
const BOT_NAMES = ['Aldric', 'Brynja', 'Cassius', 'Dagny', 'Eamon', 'Freya', 'Gorm', 'Hilde', 'Ivo', 'Jorunn', 'Kael', 'Lyra', 'Magnus', 'Nessa', 'Orrin', 'Petra', 'Quill', 'Runa', 'Sten', 'Thora', 'Ulric', 'Vala', 'Wulf', 'Ysolde'];

export const A = { setup: null, F: [], state: 'pick', t: PICK_T, score: {}, round: 1, roundWins: {}, feed: [], flags: [], hillOwner: null, shots: [], zones: [], winner: null, hooks: {} };
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const teamsOf = () => [...new Set(A.F.map(f => f.team))];
const isFFA = () => !!FORMATS[A.setup.fmt].ffa;
const teamName = (t) => isFFA() ? (A.F.find(f => f.team === t) || {}).name : COLOR_NAMES[t] + ' team';
const teamCol = (t) => COLORS[t % COLORS.length];

// ---------------- heroes: level 20, the best gear, skill points ready ----------------
const SKILL_IDS = ['slash1', 'slash2', 'blunt1', 'blunt2', 'pierce', 'pierce2', 'h2h', 'archery', 'firearms', 'dual', 'double', 'triple', 'casting'];
export function arenaHero(slot, name) {
  const GOB = { musketeer: ['woodelf', '#7a9a3a'], blunderbuss: ['dwarf', '#4f6a2a'], bombardier: ['halfling', '#8aa23a'] }[slot.cls]; if (GOB) slot = Object.assign({}, slot, { race: GOB[0] }); // (the gunners are goblins)
  const R = RACES[slot.race] || RACES.human, sex = GOB ? 'm' : Math.random() < 0.4 ? 'f' : 'm';
  const app = { skin: R.skins[(Math.random() * R.skins.length) | 0], hair: R.hairs[(Math.random() * R.hairs.length) | 0], hairStyle: (Math.random() * 3) | 0, beard: sex === 'm' && Math.random() < 0.5 ? 1 + ((Math.random() * 2) | 0) : 0, height: 1, build: 0 };
  if (GOB) { app.skin = GOB[1]; app.beard = 0; app.height = slot.cls === 'blunderbuss' ? 1.2 : slot.cls === 'bombardier' ? 1.0 : 0.82; } // (two goblins: the bruiser a touch taller and much broader than the sharpshooter)
  const h = Game.newHero({ name, race: slot.race, cls: slot.cls, sex, app });
  h.level = LEVEL_CAP; h.introDone = true; h.gold = 0; h.arena = true; h.ctree = {}; kitRules(); h.arenaKit = kitOf(slot.cls); h.arenaRmb = rmbOf(slot.cls); h.arenaUlt = ultOf(slot.cls); h.ultCharge = 0; h.arenaPerks = {}; recomputePK(h);
  const top = TIERS.length - 1, C = CLASSES[slot.cls];
  for (const k of ['w1', 'w2']) { const w = h.equip[k]; if (w) Object.assign(w, Game.makeWeapon(k === 'w1' && slot.cls === 'wizard' ? 'arcanestaff' : w.wt, top, 3), { uid: w.uid }); if (w) delete w.proc; } /* (the owner: no weapon procs in the arena: a legendary sword's random Flametongue set people burning without Flame Blade) */ /* (the owner: the wizard's main attack is arcane, not fire) */
  for (const s of ARMOR_SLOT_LIST) h.equip[s] = Game.makeArmor(C.armor || 'leather', s, top, 3);
  h.skills = {}; for (const id of SKILL_IDS) h.skills[id] = 999; // capped by level inside the skill system
  h.hotbar = null; Game.autoFillHotbar(h);
  return h;
}
// the owner: the campaign plays the new classes too: each class's own kit, right click, ultimate, look and perks. A campaign hero starts at
// level 1 and unlocks F at once, C at level 3, Q at 5 and the ultimate at 7, with a perk point every level up to 20 (the arena is max level)
export function campHero(h) { kitRules(); h.arena = true; h.camp = true; h.arenaKit = kitOf(h.cls); h.arenaRmb = rmbOf(h.cls); h.arenaUlt = ultOf(h.cls); h.arenaPerks = h.arenaPerks || {}; if (h.ultCharge == null) h.ultCharge = 0;
  recomputePK(h); h.skills = h.skills || {}; for (const id of SKILL_IDS) h.skills[id] = Math.max(h.skills[id] || 0, 999); h.hotbar = null; Game.autoFillHotbar(h); return h; }
// a computer fighter spends its 20 points: two full trees, leaning on a healing tree when it has team mates
function botSpend(h, team) {
  const T = CLASS_TREES[h.cls]; if (!T) return;
  const healT = T.findIndex(t => t.nodes.some(n => n.ab && (ABILITIES[h.cls].find(a => a.id === n.ab) || {}).t === 'heal'));
  let pick = [0, 1, 2].sort(() => Math.random() - 0.5).slice(0, 2);
  if (team && healT >= 0 && !pick.includes(healT) && Math.random() < 0.6) pick[1] = healT;
  for (let pass = 0; pass < 14; pass++) for (const i of pick) { const n = T[i].nodes.filter(x => x.t !== 'ult').sort((a, b) => a.row - b.row || a.col - b.col).find(x => Game.nodeState(h, x) === 'open'); if (n) h.ctree[n.id] = 1; }
}

// ---------------- start ----------------
let FINAL = null;
// online: the lobby decides the fighters before the hero is made
export async function prepareArena() { const s = readArena(); FINAL = s.mp ? await netLobby(s, FORMATS, OBJECTIVES, (c) => kitOf(c).map(id => (ABILITIES[c].find(a => a.id === id) || {}).name).join(' · ')) : s; }
const mySlot = () => (FINAL || readArena()).slots.find(x => AN.on ? x.owner === AN.myId : x.you) || (FINAL || readArena()).slots[0];
export function initArena(hooks) {
  G.hooks.mendBanner = mendBanner; G.hooks.arenaDemon = summonDemon; G.hooks.arenaWrath = paladinWrath; G.hooks.arenaFists = monkFists; G.hooks.arenaStorm = berserkerStorm; G.hooks.arenaRain = rangerRain; G.hooks.healerMend = healerMend; G.hooks.atone = atone; G.hooks.aimAlly = aimAlly; G.hooks.arenaMiracle = clericMiracle; G.hooks.arenaOvergrowth = druidOvergrowth; G.hooks.shamanTotem = shamanTotem; G.hooks.arenaTranscend = wizardTranscend; G.hooks.arenaBarrage = musketBarrage; G.hooks.tableUlt = runTableUlt; G.hooks.arenaSpirit = shamanSpirit; G.hooks.arenaAssassinate = rogueAssassinate;   A.hooks = hooks; A.setup = FINAL || readArena(); const s = A.setup; G.fovTrim = 10;
  if ((s.slots || []).some(x => x && x.cls === 'warrior')) preloadBanners(); /* (the warrior's banner models) */
  const objective = OBJECTIVES[s.objective] ? s.objective : 'elim';
  if (objective === 'ctf' && isFFA()) s.objective = 'dm';
  A.lives = OBJECTIVES[s.objective].lives === 'one' ? 'one' : (s.lives || OBJECTIVES[s.objective].lives);
  A.target = s.objective === 'dm' ? (isFFA() ? 10 : 15 + 5 * Math.min(2, (FORMATS[s.fmt].size || 1) - 1)) : s.objective === 'ctf' ? 3 : s.objective === 'koth' ? 100 : s.objective === 'rounds' ? 2 : 1;
  const used = new Set();
  s.slots.forEach((sl, i) => { let nm = sl.name; if (!nm) { do nm = BOT_NAMES[(Math.random() * BOT_NAMES.length) | 0]; while (used.has(nm)); } used.add(nm); const you = AN.on ? sl.owner === AN.myId : !!sl.you; A.F.push({ i, name: sl.owner != null || you ? (sl.name || (you ? 'You' : 'Fighter')) : nm, cls: sl.cls, race: sl.race, team: sl.team, you, owner: sl.owner, kills: 0, deaths: 0, dmg: 0, heal: 0, alive: true, respawnT: 0 }); });
  A.me = A.F.find(f => f.you) || A.me; AN.meIndex = A.me.i; A.perkClock = 0;
  for (const t of teamsOf()) { A.score[t] = 0; A.roundWins[t] = 0; }
  G.myTeam = A.me.team;
  // the computer fighters
  for (const f of A.F) { if (f.you) continue; if (f.owner != null) f.rem = new RemoteFighter(f); else if (AUTH()) { const h = arenaHero(f, f.name); f.bot = new ArenaBot(f, h); } else f.rem = new BotProxy(f); } // other players, and the host's computer fighters
  // capture the flag: every side sends at least one raider, the rest split between raiding and guarding
  for (const t of teamsOf()) A.F.filter(f => f.team === t && f.bot).forEach((f, i) => { f.bot.role = i % 2 === 0 ? 'attack' : 'defend'; });
  A.timeLimit = ['dm', 'ctf', 'koth'].includes(s.objective) ? 480 : Infinity; // 8 minutes, then the leader wins (a tie goes to sudden death)
  document.body.classList.add('arenamode');
  // banners above the gates in the teams' colours; CTF flags; the hill
  AR.gates.forEach((g, k) => { const t = teamsOf()[k]; if (t != null && !isFFA()) { if (g.banner) g.banner.material.color.set(teamCol(t)); if (g.roomBanner) g.roomBanner.material.color.set(teamCol(t)); } });
  if (s.objective === 'ctf') for (const t of teamsOf()) A.flags.push(makeFlag(t));
  if (s.objective === 'koth') AR.hill.material.opacity = 0.75;
  const P = G.player; if (P) { P.arenaF = A.me; }
  if (AN.on) { AN.h.data = onNet; AN.h.left = playerLeft; AN.h.hostLeft = () => { A.hooks.banner && A.hooks.banner('The host left', 'Back to the main screen in a moment'); setTimeout(() => { location.href = location.pathname; }, 4000); }; }
  placeAll(); startPick(PICK_T);
}
export function playerHero() { const sl = mySlot(); return arenaHero(sl, sl.name || 'You'); }
const RUINS_MAP = () => AR.map === 'ruins';
// the necromancer's ultimate: the demon rises in front of the victim, lifts them overhead, bites their head off, sinks away
// ---------- shared pieces for the ultimates (every class's big moment uses these) ----------
// who an ultimate can hurt or help: in the arena by team; in the Training Yard the dummies (if you cast) or you (if an enemy casts)
export function ultFoes(caster) { const inAr = A.F && A.F.length > 0, team = caster === G.player ? G.myTeam : caster.team;
  return (inAr ? A.F.filter(f => f.alive && f.team !== team).map(unitOf).filter(u => u && !u.dead) : caster === G.player ? (G.mobs || []).filter(m => !m.dead && !m.pet && !m.ally && m.pos) : [G.player].filter(u => u && !u.dead)).filter(u => !((u.ultImmT || 0) > 0)); }
export function ultFriends(caster) { const inAr = A.F && A.F.length > 0, team = caster === G.player ? G.myTeam : caster.team;
  return inAr ? A.F.filter(f => f.alive && f.team === team).map(unitOf).filter(u => u && !u.dead) : caster === G.player ? [G.player] : []; }
export const ultGround = (at) => (A.F && A.F.length > 0) ? gy(at.x, at.z, at.y) : heightAt(at.x, at.z);
// hurt a fraction of someone's health (ultimates are measured against the target, not the caster's weapon)
export function ultHurt(u, frac, caster, kind = 'gold', quiet = false) { if (!u || u.dead) return 0; const n = (u.dummy ? 1200 / PVP_K : (u.maxHp || 1000)) * frac, /* (yard dummies: a hero-sized pool on the same scale as weapon hits on them) */ c = u.pos.clone().setY(u.pos.y + 1.2);
  if (u === G.player) { if ((u.ultImmT || 0) > 0) return; u.hp -= n; u.hurtT = 0.3; V.addShake(0.4); if (u.hp <= 0) { u.hp = 0; u.die && u.die(caster); } }
  else if (u.dummy) { u.takeHit && u.takeHit(n, caster, {}); }
  else { if (u.invulnT > G.time) return; u.hp -= n; if (u.flash) u.flash(); if (u.hp <= 0) { u.hp = 0; u.die && u.die(caster); } }
  if (!quiet) V.number(c, String(Math.round(n)), 'dmg'); V.burst(kind, c, 16, { speed: 4 }); return n; }
export function ultKill(u, caster) { if (!u || u.dead) return; if (u === G.player) { u.hp = 0; u.die && u.die(caster); } else if (u.dummy) u.takeHit && u.takeHit(99999, caster, {}); else { u.hp = 0; u.die && u.die(caster); } }
export function ultHeal(u, frac) { if (!u || u.dead) return; const n = (u.maxHp || 1000) * frac; if (u === G.player && u.heal) u.heal(n); else u.hp = Math.min(u.maxHp, u.hp + n); V.burst('heal', u.pos.clone().setY(u.pos.y + 1.2), 20, { speed: 2, vy: 2 }); }
export function ultSlow(u, k, dur) { if (!u || u.dead) return; u.ultSlowT = G.time + dur; u.ultSlowK = k; }
// what an ultimate's camera must never sit in or look through: walls and buildings (solidAt), trunks and pillars (round
// colliders, as columns 5 m tall), tree crowns and other big props (G.camOcc: ellipsoids { x, y, z, r, sy }), and the ground
const camHit = (x, y, z, near) => { if (solidAt(x, y, z)) return true; if (y < heightAt(x, z) + 0.5) return true;
  for (const o of G.camOcc || []) { const dx = x - o.x, dy = (y - o.y) / (o.sy || 1), dz = z - o.z; if (dx * dx + dy * dy + dz * dz < o.r * o.r) return true; }
  for (const c of near) { if (y > c.top) continue; const dx = x - c.x, dz = z - c.z; if (dx * dx + dz * dz < (c.r + 0.35) * (c.r + 0.35)) return true; } return false; };
const camNear = (a, b, pad = 2) => { const x0 = Math.min(a.x, b.x) - pad, x1 = Math.max(a.x, b.x) + pad, z0 = Math.min(a.z, b.z) - pad, z1 = Math.max(a.z, b.z) + pad, out = [];
  for (const c of world.colliders) if (c.on && c.t === 'c' && c.x > x0 - c.r && c.x < x1 + c.r && c.z > z0 - c.r && c.z < z1 + c.r && c.r < 4) out.push({ x: c.x, z: c.z, r: c.r, top: heightAt(c.x, c.z) + 5 }); return out; };
const SIDE_A = 0.75, segDist = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L)); return Math.hypot(px - ax - dx * t, pz - az - dz * t); };
// is the straight line from a to b free for a camera (the end point too)? skip: how far from a to start checking (a is often inside the effect)
export function camClear(a, b, skip = 0) { const near = camNear(a, b), d = a.distanceTo(b), n = Math.max(2, Math.ceil(d / 0.45)); for (let i = 1; i <= n; i++) { const t = i / n; if (t * d < skip) continue; if (camHit(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t, near)) return false; } return true; }
// the caster's camera: flies up and out of their eyes to circle the action, then back. focus() gives the point to watch;
// backAt() the time to fly home (seconds into the ultimate). Returns the camera function (it is set as p.cine).
// It frames the landing AND whoever it caught (opts.frame !== false): the shot widens to hold every enemy near the
// impact, and it picks its side of the action so no wall, tree crown, trunk or pillar sits in the shot or on the way out.
export function ultFlyCam(p, focus, backAt, opts = {}) { const t0 = G.time, P0 = new THREE.Vector3(), L0 = new THREE.Vector3(), Ob = new THREE.Vector3(), tgt = new THREE.Vector3(), look = new THREE.Vector3(), aim = new THREE.Vector3(), M = new THREE.Vector3(), Q = new THREE.Vector3(); let off = null, offS = 0, chk = -9, rS = null, hS = null, rW = 0, hW = 0, fc = null, st0 = null; const EYE = new THREE.Vector3();
  const e = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }, r = opts.r || 13, h = opts.h || 5, a0 = opts.ang != null ? opts.ang : null, UP = new THREE.Vector3(0, 1, 0), lift = opts.lift != null ? opts.lift : 2.5;
  const d0 = opts.delay || 0, inT = opts.inT || 1.1, vr = opts.vr || Math.max(8, r * 0.6), sideA = opts.side != null ? opts.side : opts.look0 ? 0 : SIDE_A; /* (the demon's own shot keeps its framing) */
  const path = (k, out) => { M.copy(P0).lerp(Ob, 0.25); M.y = Math.max(P0.y, Ob.y) + lift; const u = 1 - k; return out.set(u * u * P0.x + 2 * u * k * M.x + k * k * Ob.x, u * u * P0.y + 2 * u * k * M.y + k * k * Ob.y, u * u * P0.z + 2 * u * k * M.z + k * k * Ob.z); }; /* (lift up over your own head first, then glide out: never through your skull) */
  const cam = (c) => { const ct = G.time - t0, k = e((ct - d0) / inT) * (1 - e((ct - backAt()) / 1.0)); /* (opts.delay: stay in your eyes a moment first; opts.inT: how slowly it pulls away) */ if (!st0) { st0 = { off: c.position.clone().sub(p.pos), yaw: p.yaw }; } /* (where the game's own camera was when the ultimate began: first person or over the shoulder, the shot leaves from there and comes home there, never into the back of your head) */ { const dy = p.yaw - st0.yaw, cs = Math.cos(dy), sn = Math.sin(dy), o = st0.off; P0.set(p.pos.x + o.x * cs + o.z * sn, p.pos.y + o.y, p.pos.z - o.x * sn + o.z * cs); } EYE.copy(p.pos); EYE.y += p.eye; L0.copy(P0).add(new THREE.Vector3(Math.sin(p.yaw) * Math.cos(p.pitch), Math.sin(p.pitch), Math.cos(p.yaw) * Math.cos(p.pitch)).multiplyScalar(12)); /* (looking where you look) */ if (opts.look0) L0.copy(opts.look0()); /* (opts.look0: what you look at before the camera leaves your eyes) */
    aim.copy(focus(ct));
    if (G.time - chk > 0.5 || off == null) { chk = G.time; // (every half second: who to hold in the shot, how wide, and from which side)
      let cx = aim.x, cz = aim.z, cy = aim.y, n = 1, spread = 0; if (opts.frame !== false) { const vs = ultFoes(p).filter(u => u && u.pos && u !== p && Math.hypot(u.pos.x - aim.x, u.pos.z - aim.z) < vr); for (const u of vs) { cx += u.pos.x; cz += u.pos.z; cy += u.pos.y + 1.2; n++; } cx /= n; cz /= n; cy /= n; for (const u of vs) spread = Math.max(spread, Math.hypot(u.pos.x - cx, u.pos.z - cz)); spread = Math.max(spread, Math.hypot(aim.x - cx, aim.z - cz)); }
      fc = new THREE.Vector3(aim.x + (cx - aim.x) * 0.6, aim.y + (cy - aim.y) * 0.5, aim.z + (cz - aim.z) * 0.6); rW = Math.max(r, spread * 2.0 + 5); hW = h * rW / r;
      const base0 = a0 != null ? a0 : Math.atan2(p.pos.z - fc.z, p.pos.x - fc.x) + sideA, ang = base0 + ct * 0.12; /* (a three-quarter view from your side: you and the landing both in shot) */ let best = null;
      for (const [rr, hh] of [[rW, hW], [rW * 0.75, hW * 0.9], [rW, hW * 1.6], [rW * 0.6, hW * 1.5]]) { for (let i = 0; i < 13 && best == null; i++) { const a2 = ang + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.48; Q.set(fc.x + Math.cos(a2) * rr, fc.y + hh, fc.z + Math.sin(a2) * rr);
          if (!camClear(fc, Q, 2.5)) continue; if (i < 12 && p.pos && segDist(p.pos.x, p.pos.z, Q.x, Q.z, fc.x, fc.z) < (p.eye || 2) * 0.3 + 0.8 && Math.hypot(p.pos.x - fc.x, p.pos.z - fc.z) > 2.5) continue; /* (your own hero must not stand between the camera and the landing) */ Ob.copy(Q); let ok = true; for (const kk of [0.35, 0.6, 0.85]) { path(kk, M); const pt = M.clone(); if (camHit(pt.x, pt.y, pt.z, camNear(pt, pt, 1))) { ok = false; break; } } if (!ok && i < 12) continue; best = [a2 - ang, rr, hh]; } if (best) break; }
      if (best) { off = best[0]; rW = best[1]; hW = best[2]; } else off = off || 0;
      if (rS == null) { rS = rW; hS = hW; offS = off; } }
    tgt.lerp(fc, tgt.lengthSq() === 0 ? 1 : 0.08); rS += (rW - rS) * 0.05; hS += (hW - hS) * 0.05;
    const base1 = a0 != null ? a0 : Math.atan2(p.pos.z - tgt.z, p.pos.x - tgt.x) + sideA, ang1 = base1 + ct * 0.12; let dO = off - offS; dO = Math.atan2(Math.sin(dO), Math.cos(dO)); offS += dO * 0.06;
    Ob.set(tgt.x + Math.cos(ang1 + offS) * rS, tgt.y + hS, tgt.z + Math.sin(ang1 + offS) * rS);
    if (lift > 0) path(k, c.position); else c.position.lerpVectors(P0, Ob, k);
    look.lerpVectors(L0, aim.clone().lerp(tgt, 0.5), k); c.up.copy(UP); c.lookAt(look);
    if (p.ch && p.ch.root && k < 1 && (p.camDistT || 0) < 0.6) { const dEye = c.position.distanceTo(EYE); if (dEye < 3.2 * (p.ch.scale || 1)) p.ch.root.visible = false; }
    if (ct > backAt() + 1.05 && p.cine === cam && !opts.keep) p.cine = null; }; /* (home again: the shot ends by itself) */ /* (your own body stays hidden until the camera is well clear of your head: big heroes have big heads, so never a view of the inside of your face) */
  p.cine = cam; return cam; }
// the victim's cinematic: letterbox bars, the HUD gone, a slow third-person orbit framing you and the threat, for dur seconds
export function ultVictimCine(p, threat, dur) { if (!p || p.cine) return; let bars = document.getElementById('cinebars'); if (!bars) { bars = document.createElement('div'); bars.id = 'cinebars'; bars.innerHTML = '<i></i><i></i>'; document.body.appendChild(bars); }
  requestAnimationFrame(() => bars.classList.add('on')); document.body.classList.add('cine'); const t0 = G.time, side = Math.random() < 0.5 ? 1 : -1, mid = new THREE.Vector3();
  const cam = (c) => { const ct = G.time - t0, pc = p.pos.clone().setY(p.pos.y + 1), th = threat(ct); mid.lerpVectors(th, pc, 0.55); const ax = pc.x - th.x, az = pc.z - th.z, ang = Math.atan2(az * side, -ax * side) + ct * 0.2, r = Math.max(8, Math.hypot(ax, az) * 0.6 + 6);
    c.position.set(mid.x + Math.cos(ang) * r, mid.y + 2 + ct * 0.3, mid.z + Math.sin(ang) * r); c.lookAt(mid); c.fov = 50;
    if (ct > dur) { if (p.cine === cam) p.cine = null; document.body.classList.remove('cine'); bars.classList.remove('on'); } };
  p.cine = cam; }

// ---------- the paladin's ultimate: Avenging Wrath ----------
// golden wings; a 7 m judgment glyph burns into the ground where he aims and weighs enemies down; a giant sword of light
// plunges from the sky onto it. Its heart (2.5 m) impales and kills; the rest of the glyph hurts badly and throws people
// up; allies on it are healed. Counterplay: get off the glyph before the sword lands.
export const WRATH = { r: 12, core: 3, impact: 2.3, slow: 0.35, hurt: 0.45, heal: 0.3 }; // (tuned with tools/ulttest.cjs)
export function paladinWrath(caster, at) {
  if (at && at.pos) at = at.pos; if (!at) return false; const T = Object.assign({}, WRATH, G.wrathTune || {});
  const base = ultGround(at), C = new THREE.Vector3(at.x, base, at.z), me = caster === G.player ? G.player : null;
  const glyph = makeGlyph(T.r); glyph.position.set(C.x, base + 0.06, C.z); G.scene.add(glyph);
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(T.r * 0.92, T.r * 0.92, 40, 40, 1, true), new THREE.MeshBasicMaterial({ color: '#ffe080', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })); pillar.position.set(C.x, base + 20, C.z); G.scene.add(pillar);
  const sword = makeLightSword(); sword.position.set(C.x, base + 40, C.z); sword.scale.setScalar(0.01); G.scene.add(sword);
  const cross = new THREE.Group(); for (const ry of [0, Math.PI / 2]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(T.r * 2.2, 1.1), new THREE.MeshBasicMaterial({ color: '#fff0b0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); m.rotation.set(-Math.PI / 2, 0, ry); cross.add(m); } cross.position.set(C.x, base + 0.08, C.z); G.scene.add(cross);
  // the caster: wings bloom from the back, sword raised, untouchable; his camera flies out to watch
  const body = caster === G.player ? caster.ch && caster.ch.root : caster.root, chest = caster === G.player ? caster.ch && caster.ch.chest : caster.model && caster.model.chest;
  const wings = makeWings(); if (chest) { wings.position.set(0, 0.15, -0.18); chest.add(wings); } wings.scale.setScalar(0.01);
  if (me) { me.held = true; me.ultImmT = T.impact + 2.6; me.ultPoseT = 3.5; ultFlyCam(me, (ct) => C.clone().setY(base + (ct < T.impact ? 5 : 2)), () => T.impact + 1.6, { r: 15, h: 6 }); }
  else { caster.invulnT = G.time + T.impact + 1; }
  S.cast && S.cast('holy', C, 1.4); V.burst('gold', (body ? body.position : C).clone().setY(base + 1.5), 50, { speed: 5 });
  let t = 0, struck = false, slT = 0, motesT = 0; const e = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }, seg = (x, a, b) => e((x - a) / (b - a));
  const victims = [], impaled = [];
  G.timers.push({ update: (dt) => { t += dt;
    if (struck && impaled.length && t >= T.impact + 0.9) { for (const u of impaled) { u.held = false; ultKill(u, caster); } impaled.length = 0; } // (pinned under the blade a moment, then it is over)
    // wings bloom and beat slowly
    const wk = seg(t, 0, 0.5) * (1 - seg(t, T.impact + 2.0, T.impact + 2.6)); wings.scale.setScalar(Math.max(0.01, wk * 1.15)); for (const [i, w] of wings.userData.sides.entries()) w.rotation.y = (i ? -1 : 1) * (0.35 + Math.sin(t * 3) * 0.15);
    // the glyph burns in, turns, and fades after the strike
    const gk = seg(t, 0, 0.45) * (1 - seg(t, T.impact + 1.4, T.impact + 2.4)); glyph.material.opacity = gk * (0.75 + Math.sin(t * 9) * 0.1); glyph.rotation.z = t * 0.6; glyph.scale.setScalar(0.3 + 0.7 * seg(t, 0, 0.45));
    pillar.material.opacity = 0.06 * seg(t, 0.1, 0.6) * (1 - seg(t, T.impact - 0.2, T.impact + 0.2));
    // enemies on the glyph are weighed down until it lands
    slT -= dt; if (!struck && slT <= 0) { slT = 0.2; for (const u of ultFoes(caster)) if (Math.hypot(u.pos.x - C.x, u.pos.z - C.z) < T.r) { ultSlow(u, T.slow, 0.35); if (Math.random() < 0.4) V.emit('gold', u.pos.clone().setY(u.pos.y + 0.2), { speed: 0.5, vy: -1, size: 0.25 }); } }
    // the sword forms high up, turns slowly, then falls faster and faster
    if (!struck) { const fk = seg(t, 0.3, 0.8); sword.scale.setScalar(Math.max(0.01, fk)); const k = Math.max(0, Math.min(1, (t - 0.8) / (T.impact - 0.8))), drop = k * k * k; sword.position.y = base + 40 - (40 - 12) * drop; sword.rotation.y = t * (0.6 + drop * 3);
      sword.userData.halo.rotation.z = t * 2; motesT -= dt; if (motesT <= 0 && fk > 0.5) { motesT = 0.05; V.emit('gold', sword.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.2, -Math.random() * 12, (Math.random() - 0.5) * 1.2)), { speed: 0.6, size: 0.35, life: 0.8 }); }
      if (k > 0.85) V.addShake(dt * 2); }
    if (!struck && t >= T.impact) { struck = true; sword.position.y = base + 12 - 2.2; sword.rotation.y = 0.3;
      V.burst('gold', C.clone().setY(base + 0.5), 160, { speed: 12 }); V.burst('stone', C.clone().setY(base + 0.3), 70, { speed: 9, grav: 14 }); V.burst('dust', C.clone().setY(base + 0.3), 60, { speed: 7 });
      V.ring(C.clone().setY(base + 0.2), T.r * 2.2, '#fff0a0', 0.8); V.ring(C.clone().setY(base + 0.3), T.r * 1.2, '#ffd060', 0.5); ultImpact(C, { r: T.r * 0.75, col: '#ffd860', colCol: '#fff4c0', dust: '#fff0c8', debris: 'stone', spark: 'gold', flash: '#fff8e0', shake: 1.4, vol: 1.3, colH: 26, wallH: 2.6, scorchCol: '#2a1a04' }); V.light(C.clone().setY(base + 4), '#ffe090', 16, 1.0, 40); /* (the shared ultimate landing: flash, racing shock ring, dust wall, light column, scorch) */ S.cast && S.cast('holy', C, 1.6);
      for (const u of ultFoes(caster)) { const d = Math.hypot(u.pos.x - C.x, u.pos.z - C.z); if (d >= T.r) continue;
        if (d < T.core) { victims.push(u); if (u === G.player) ultVictimCine(u, () => C.clone().setY(base + 3), 2.2); u.held = true; u.pos.x = C.x + (u.pos.x - C.x) * 0.3; u.pos.z = C.z + (u.pos.z - C.z) * 0.3; if (u.root) u.root.position.copy(u.pos); V.burst('blood', u.pos.clone().setY(u.pos.y + 1), 50, { speed: 5 }); impaled.push(u); }
        else { ultHurt(u, T.hurt, caster, 'gold'); if (u === G.player) { ultVictimCine(u, () => C.clone().setY(base + 3), 1.6); if (u.vel) { const dx = u.pos.x - C.x, dz = u.pos.z - C.z, L2 = Math.hypot(dx, dz) || 1; u.vel.set(dx / L2 * 7, 10, dz / L2 * 7); } } else if (u.status) { u.status.stun = Math.max(u.status.stun || 0, 1.2); if (u.knockUp) u.knockUp(1.2); } } }
      for (const u of ultFriends(caster)) if (Math.hypot(u.pos.x - C.x, u.pos.z - C.z) < T.r) ultHeal(u, T.heal);
      feed(`<b>${caster && caster.heroName ? esc2(caster.heroName) : 'You'}</b> calls down Avenging Wrath${victims.length ? `, impaling <b>${victims.map(v => esc2(v.heroName || v.name || 'a fighter')).join(', ')}</b>` : ''}!`); }
    if (struck) { const ak = t - T.impact; cross.children.forEach(m => { m.material.opacity = 0.8 * seg(ak, 0, 0.15) * (1 - seg(ak, 1.2, 2.4)); }); sword.userData.glow.material.opacity = 0.45 + Math.sin(t * 10) * 0.15;
      if (ak > 1.6) { const k = seg(ak, 1.6, 2.6); sword.position.y = base + 9.8 + k * 6; sword.scale.setScalar(Math.max(0.01, 1 - k)); if (Math.random() < 0.5) V.emit('gold', sword.position.clone().setY(base + Math.random() * 8), { speed: 0.4, vy: 3, size: 0.3 }); } }
    if (me && t > T.impact + 2.2 && me.held) { me.held = false; me.ultPoseT = 0; }
    if (t > T.impact + 2.8) { for (const o of [glyph, pillar, sword, cross]) G.scene.remove(o); if (wings.parent) wings.parent.remove(wings); if (me) { me.held = false; if (me.cine && !document.body.classList.contains('cine')) me.cine = null; } return true; }
    return false; } });
  return true;
}

// ---------- the monk's ultimate: Thousand Fists ----------
// chi gathers into a whirlwind that drags every enemy within r into the air around him; he blurs from one to the next
// with punches, kicks, knees and roundhouses for several seconds, then slams the ground and throws them all away.
// Every victim takes exactly `dmg` of their max health in total.
export const FISTS = { r: 9, pullAt: 0.6, pullDur: 0.8, dur: 4.2, dmg: 0.5, flurry: 0.3, hitEvery: 0.2 }; // (flurry: the share dealt by the blows; the slam deals the rest)
export function monkFists(caster) {
  const T = Object.assign({}, FISTS, G.fistsTune || {}), me = caster === G.player ? G.player : null, ch = me ? me.ch : caster.model;
  const C = caster.pos.clone(), base = ultGround(C); C.y = base; const home = caster.pos.clone();
  const vortex = new THREE.Group(); for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.TorusGeometry(T.r * (0.35 + i * 0.3), 0.08, 6, 64), new THREE.MeshBasicMaterial({ color: i % 2 ? '#bfe8ff' : '#ffd890', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); m.rotation.x = Math.PI / 2; vortex.add(m); } vortex.position.set(C.x, base + 0.15, C.z); G.scene.add(vortex);
  const aura = new THREE.Mesh(new THREE.SphereGeometry(1.1, 18, 14), new THREE.MeshBasicMaterial({ color: '#ffe0a0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); G.scene.add(aura);
  const TOT = T.pullAt + T.pullDur + T.dur + 0.6; let cam = null;
  if (me) { me.ultImmT = TOT + 0.9; me.ultPoseT = 0; ultSlow(me, 0.35, TOT); /* (he can still walk, slowly, through the beating) */
    const yaw0 = me.yaw, sp = me.pos.clone(), back = new THREE.Vector3(-Math.sin(yaw0), 0, -Math.cos(yaw0)), side = new THREE.Vector3(back.z, 0, -back.x), t0c = G.time, P0 = new THREE.Vector3(), look = new THREE.Vector3();
    cam = (c) => { const ct = G.time - t0c, k0 = Math.min(1, ct / 0.9), k = k0 * k0 * (3 - 2 * k0) * (1 - Math.max(0, Math.min(1, (ct - TOT + 0.3) / 0.8))); sp.lerp(me.pos, Math.min(1, 0.05)); /* (a steady camera: high behind his shoulder, following him gently, never orbiting) */
      P0.copy(me.pos).setY(me.pos.y + me.eye); const want = sp.clone().addScaledVector(back, 7).addScaledVector(side, 2.2).setY(sp.y + 4.2); c.position.lerpVectors(P0, want, k); look.copy(P0).add(new THREE.Vector3(Math.sin(me.yaw), Math.sin(me.pitch), Math.cos(me.yaw)).multiplyScalar(10)).lerp(sp.clone().setY(sp.y + 1.1), k); c.up.set(0, 1, 0); c.lookAt(look); if (me.ch && me.ch.root && k < 1 && c.position.distanceTo(P0) < 3.2 * (me.ch.scale || 1)) me.ch.root.visible = false; }; /* (his own head stays hidden until the camera is clear of it) */
    me.cine = cam; } else { caster.invulnT = G.time + TOT + 0.9; ultSlow(caster, 0.35, TOT); }
  S.cast && S.cast('holy', C, 1.2); let t = 0, caught = null, slots = [], hitT = 0, idx = 0, nHits = 0, total = 0, finished = false, done = false, emT = 0;
  const e = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  const setPos = (p) => { caster.pos.copy(p); if (!me && caster.root) caster.root.position.copy(p); };
  const face = (to) => { const y = Math.atan2(to.x - caster.pos.x, to.z - caster.pos.z); if (me) { me.yaw = y; me.bodyYaw = y; } else { caster.yaw = y; if (caster.root) caster.root.rotation.y = y; } };
  let pose = null, poseT = 0; const STRIKES = ['punchR', 'punchL', 'elbowR', 'kickR', 'roundL', 'punchL', 'kneeR', 'elbowL', 'flip', 'punchR', 'roundR', 'axe', 'punchL', 'kneeL']; caster.strike = { n: 'stance', t0: G.time, dur: 1 };
  const applyPose = () => { if (!ch || !ch.arms) return; const A2 = ch.arms, Lg = ch.legs || {}; const k = Math.max(0, 1 - poseT / 0.12);
    if (t < T.pullAt + T.pullDur) { A2.R.sh.rotation.set(-0.6, 0, 0.9); A2.L.sh.rotation.set(-0.6, 0, -0.9); A2.R.el.rotation.x = -1.6; A2.L.el.rotation.x = -1.6; if (Lg.R) { Lg.R.thigh.rotation.x = -0.6; Lg.L.thigh.rotation.x = -0.6; Lg.R.knee.rotation.x = 1.0; Lg.L.knee.rotation.x = 1.0; } return; } // (a deep horse stance, hands drawing in the chi)
    if (!pose) return; const s = pose.endsWith('R') ? 'R' : 'L', o = s === 'R' ? 'L' : 'R';
    if (pose.startsWith('punch')) { A2[s].sh.rotation.set(-1.55 * k - 0.3, 0, 0); A2[s].el.rotation.x = -0.1 - (1 - k) * 1.2; A2[o].sh.rotation.set(-0.5, 0, 0); A2[o].el.rotation.x = -1.7; }
    else if (Lg[s]) { const hi = pose.startsWith('round') ? 1.7 : pose.startsWith('knee') ? 1.3 : 1.45; Lg[s].thigh.rotation.x = -hi * k; Lg[s].knee.rotation.x = pose.startsWith('knee') ? 1.6 * k : 0.15; if (pose.startsWith('round')) Lg[s].thigh.rotation.z = (s === 'R' ? -0.6 : 0.6) * k; A2.R.sh.rotation.set(-0.4, 0, 0.6); A2.L.sh.rotation.set(-0.4, 0, -0.6); } };
  const victimCine = new Set();
  G.timers.push({ update: (dt) => { t += dt; poseT += dt;
    C.copy(caster.pos); const gb = ultGround(C); C.y = gb; const vk = Math.min(1, t / 0.5) * (1 - e((t - (T.pullAt + T.pullDur + T.dur)) / 0.6)), pull = Math.min(1, Math.max(0, (t - T.pullAt) / T.pullDur)); vortex.position.set(C.x, gb + 0.15, C.z);
    vortex.children.forEach((m, i) => { const sh = 1 - e(pull); m.material.opacity = i === 0 ? Math.min(1, t / 0.3) * 0.75 * (pull < 1 ? 1 : 0) : 0; m.scale.setScalar(Math.max(0.001, (1 / 0.35) * sh)); m.rotation.z = t * 1.5; }); /* (a ring marks the whole area, then is sucked into the centre and gone) */
    aura.position.copy(caster.pos).setY(caster.pos.y + 1.1); aura.material.opacity = vk * (0.18 + Math.sin(t * 12) * 0.06); aura.scale.setScalar(1 + Math.sin(t * 6) * 0.08);
    emT -= dt; if (emT <= 0 && vk > 0.2) { emT = 0.03; const a = Math.random() * Math.PI * 2, r0 = T.r * (0.3 + Math.random() * 0.7); V.emit(Math.random() < 0.5 ? 'gold' : 'frost', new THREE.Vector3(C.x + Math.cos(a) * r0, base + 0.3 + Math.random() * 2, C.z + Math.sin(a) * r0), { speed: 1.5, size: 0.25, life: 0.6, dir: new THREE.Vector3(-Math.cos(a), 0.2, -Math.sin(a)) }); }
    // the pull: everyone in reach is dragged into a ring in the air around him
    if (!caught && t >= T.pullAt) { caught = ultFoes(caster).filter(u => Math.hypot(u.pos.x - C.x, u.pos.z - C.z) < T.r);
      caught.forEach((u, i) => { const a = (i / Math.max(1, caught.length)) * Math.PI * 2 + Math.atan2(u.pos.x - C.x, u.pos.z - C.z) * 0; slots.push({ u, from: u.pos.clone(), a: Math.atan2(u.pos.x - C.x, u.pos.z - C.z), dealt: 0 }); u.held = true; if (u.status) { u.status.stun = T.pullDur + T.dur + 0.5; u.cast = null; } if (u === G.player) { u.debuff && u.debuff('freeze', T.pullDur + T.dur + 0.3); ultVictimCine(u, () => caster.pos.clone().setY(caster.pos.y + 1), T.pullDur + T.dur + 1.2); } });
      V.ring(C.clone().setY(base + 0.2), T.r * 2, '#ffe8a0', 0.6); V.addShake(0.4); S.cast && S.cast('frost', C, 1.0); }
    if (caught && !done) for (const sl of slots) { const u = sl.u; if (!u.held && t < T.pullAt + T.pullDur + T.dur) continue; const pk = e((t - T.pullAt) / T.pullDur), ring = 1.5, spin = sl.a + (t - T.pullAt) * 0.6;
      const tgt = new THREE.Vector3(C.x + Math.sin(spin) * ring, C.y + 0.5 + Math.sin(t * 3 + sl.a) * 0.15, C.z + Math.cos(spin) * ring), p2 = sl.from.clone().lerp(tgt, pk); p2.x += (sl.jx || 0); p2.z += (sl.jz || 0); sl.jx = (sl.jx || 0) * 0.8; sl.jz = (sl.jz || 0) * 0.8;
      u.pos.copy(p2); if (u.root) { u.root.position.copy(p2); u.root.rotation.z = Math.sin(t * 7 + sl.a) * 0.2 * pk; } if (u === G.player && u.vel) u.vel.set(0, 0, 0); }
    // the flurry: he blurs to each victim in turn and strikes
    const fs = T.pullAt + T.pullDur, fe = fs + T.dur;
    if (caught && caught.length && t >= fs && t < fe) { hitT -= dt; if (hitT <= 0) { hitT = T.hitEvery; const sl = slots[idx % slots.length]; idx++; const u = sl.u; if (!u.dead) {
        const dir = new THREE.Vector3(C.x - u.pos.x, 0, C.z - u.pos.z).normalize(); if (me) { me.bodyYaw = Math.atan2(u.pos.x - me.pos.x, u.pos.z - me.pos.z); } else face(u.pos); /* (no teleporting: they orbit close round him and he turns to each in turn) */
        pose = STRIKES[nHits % STRIKES.length]; poseT = 0; nHits++; caster.strike = { n: pose, t0: G.time, dur: T.hitEvery * 0.95 }; if (pose === 'flip' || pose.startsWith('round')) { V.burst('dust', u.pos.clone().setY(base + 0.1), 10, { speed: 3 }); S.swingW && S.swingW('fist', 1.4, caster.pos); }
        const per = T.flurry / Math.max(1, Math.floor(T.dur / T.hitEvery / slots.length)); const left = T.flurry - sl.dealt, n = Math.min(per, left); if (n > 0) { sl.dealt += n; sl.total = (sl.total || 0) + ultHurt(u, n, caster, 'spark'); }
        const hp = u.pos.clone().setY(u.pos.y + (pose.startsWith('punch') ? 1.4 : 1.0)); V.sphereFlash(hp, 0.6, '#fff4c8', 0.12); V.burst('spark', hp, 8, { speed: 5 }); S.punch ? S.punch(hp, true) : S.blunt(hp); sl.jx = -dir.x * 0.35; sl.jz = -dir.z * 0.35; if (nHits % 6 === 0) V.addShake(0.2); } } }
    if (!pose && t < fs && !caster.strike) caster.strike = { n: 'stance', t0: G.time, dur: 1 };
    // the finish: back to the centre, a slam, and everyone thrown away; anyone short of the full share gets the rest
    if (caught && !finished && t >= fe) { finished = true; pose = 'leapspin'; poseT = 0; caster.strike = { n: 'leapspin', t0: G.time, dur: 0.55 };
      V.ring(C.clone().setY(base + 0.2), T.r * 2.2, '#ffe8a0', 0.7); V.burst('gold', C.clone().setY(base + 0.6), 120, { speed: 10 }); V.burst('dust', C.clone().setY(base + 0.3), 60, { speed: 7 }); V.sphereFlash(C.clone().setY(base + 1), 3.5, '#fff0c0', 0.35); V.light(C.clone().setY(base + 2), '#ffe090', 12, 0.6, 30); V.addShake(1.1); S.explode && S.explode(C, 0.9);
      for (const sl of slots) { const u = sl.u; if (u.dead) continue; const left = T.dmg - sl.dealt; if (left > 0.001) sl.total = (sl.total || 0) + ultHurt(u, left, caster, 'spark', true); sl.dealt = T.dmg; V.number(u.pos.clone().setY(u.pos.y + (u.height || 1.8) + 0.6), String(Math.round(sl.total || 0)), 'crit'); /* (the whole beating in one big number) */ u.held = false; if (u.root) u.root.rotation.z = 0;
        const d = new THREE.Vector3(u.pos.x - C.x, 0, u.pos.z - C.z).normalize(); if (u === G.player && u.vel) u.vel.set(d.x * 9, 8, d.z * 9); else if (u.status) { u.status.stun = Math.max(u.status.stun || 0, 1); if (u.status.knock) u.status.knock.set(d.x * 9, 0, d.z * 9); } }
      feed(`<b>${caster && caster.heroName ? esc2(caster.heroName) : 'You'}</b> unleashes Thousand Fists${slots.length ? ` on <b>${slots.map(s => esc2(s.u.heroName || s.u.name || 'a fighter')).join(', ')}</b>` : ''}!`); }
    if (!caught && false) return true;
    if (t > fe + 0.6 || (caught && !caught.length && t > fs + 0.4)) { done = true; caster.strike = null; const bd = (caster === G.player ? caster.ch : caster.model); if (bd && bd.body) { bd.body.position.set(0, 0, 0); bd.body.rotation.set(0, 0, 0); } G.scene.remove(vortex); G.scene.remove(aura); caster.held = false; for (const sl of slots) { sl.u.held = false; if (sl.u.root) sl.u.root.rotation.z = 0; }
      if (me) { if (me.cine === cam || (me.cine && !document.body.classList.contains('cine'))) me.cine = null; } return true; }
    return false; } });
  return true;
}

// ---------- the rogue's ultimate: Assassinate ----------
// he melts into smoke, steps out of the shadows right behind the enemy, seizes them and drives his blade into their back
export const ASSASSIN = { mark: 0.5, vanish: 0.35, stab: 1.15, kill: 1.3, end: 2.0, below: 0.5, hurt: 0.45, silence: 2, stealth: 2 };
// first a shadow mark flares over the victim for half a second (with a whisper): a dodge, a blink, a dash or an
// untouchable moment breaks it and the rogue gets half the charge back. Then the strike: below half health it kills,
// otherwise it takes 45% of their health and silences them for 2 s. The rogue stays invisible for 2 s after.
export function rogueAssassinate(caster, victim) {
  if (!victim || victim.dead || !victim.pos) return false; const T = ASSASSIN, me = caster === G.player, at0 = victim.pos.clone();
  const mark = new THREE.Group(), mm = new THREE.MeshBasicMaterial({ color: '#7a20c0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 6, 28), mm); ring.rotation.x = Math.PI / 2; mark.add(ring); const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshBasicMaterial({ color: '#ff2040', transparent: true, opacity: 0, depthWrite: false })); mark.add(eye); mark.userData.eye = eye; }
  { const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.25, 7, 10, 1, true), new THREE.MeshBasicMaterial({ color: '#ff2a4a', transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); beam.position.y = 3.5; mark.add(beam); mark.userData.beam = beam; } /* (a red beam rises from the marked victim: you see at a glance who is marked) */
  G.scene.add(mark); caster.held = true; if (me) caster.ultImmT = Math.max(caster.ultImmT || 0, T.mark + 0.1); else caster.invulnT = G.time + T.mark + 0.1;
  V.burst('shadow', caster.pos.clone().setY(caster.pos.y + 1), 30, { speed: 2.5 }); S.cast && S.cast('shadow', caster.pos, 0.6);
  if (victim === G.player) { S.whisper && S.whisper(); G.hooks.toast && G.hooks.toast('A shadow marks you: dodge or blink away!', '🗡', 'bad'); } else if (me) S.whisper && S.whisper();
  const untouchable = (v) => (v.ultImmT || 0) > 0 || v.invulnT > G.time || (v.buffs && (v.buffs.phase > 0 || v.buffs.iceblock > 0)) || (v === G.player && (v.iframes > 0 || !!(v.dodge && !v.dodge.charge)));
  let t = 0;
  G.timers.push({ update: (dt) => { t += dt; const k = Math.min(1, t / T.mark);
    mark.position.copy(victim.pos).setY(victim.pos.y + (victim.height || 1.8) + 0.55); mark.rotation.y = t * 6; mm.opacity = 0.9 * Math.min(1, t * 6); mark.scale.setScalar(1.6 - 0.6 * k); mark.userData.eye.material.opacity = k; if (mark.userData.beam) mark.userData.beam.material.opacity = 0.55 * Math.min(1, t * 5); if (Math.random() < 0.5) V.emit('shadow', mark.position.clone(), { speed: 0.6, size: 0.3, life: 0.4 });
    const broke = victim.dead || caster.dead || untouchable(victim) || Math.hypot(victim.pos.x - at0.x, victim.pos.z - at0.z) > 3;
    if (broke) { G.scene.remove(mark); caster.held = false; if (me) caster.ultImmT = 0; if (!victim.dead) { V.number(headOfU(victim), 'Escaped!', 'miss'); V.burst('shadow', victim.pos.clone().setY(victim.pos.y + 1), 24, { speed: 3 }); } if (caster.h) caster.h.ultCharge = Math.max(caster.h.ultCharge || 0, 50); if (me) G.hooks.toast && G.hooks.toast('They slipped your mark (half your charge back)', '🗡', 'bad'); return true; }
    if (t >= T.mark) { G.scene.remove(mark); caster.held = false; assassinStrike(caster, victim); return true; }
    return false; } });
  return true;
}
function assassinStrike(caster, victim) {
  if (!victim || victim.dead || !victim.pos) return false; const T = ASSASSIN, me = caster === G.player ? G.player : null, ch = me ? me.ch : caster.model;
  const vroot = victim.root || (victim.ch && victim.ch.root);
  caster.held = true; if (me) me.ultImmT = T.end + 0.5; else caster.invulnT = G.time + T.end + 0.5;
  V.burst('shadow', caster.pos.clone().setY(caster.pos.y + 1), 40, { speed: 3 }); V.burst('smoke', caster.pos.clone().setY(caster.pos.y + 1), 30, { speed: 2 }); S.cast && S.cast('shadow', caster.pos, 0.8);
  if (me) ultFlyCam(me, () => victim.pos.clone().setY(victim.pos.y + 1.2), () => T.end - 0.7, { r: 5.5, h: 1.4 });
  // a dark mark over the victim's head
  const mark = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.05, 6, 24), new THREE.MeshBasicMaterial({ color: '#c01010', transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })); G.scene.add(mark);
  let t = 0, appeared = false, stabbed = false, killed = false, cineOn = false; const body = () => (me ? me.ch.root : caster.root);
  G.timers.push({ update: (dt) => { t += dt;
    mark.position.copy(victim.pos).setY(victim.pos.y + (victim.height || 1.8) + 0.5); mark.rotation.x = Math.PI / 2; mark.rotation.z = t * 4; mark.material.opacity = 0.9 * Math.max(0, 1 - Math.max(0, (t - T.kill) / 0.4));
    if (t < T.vanish) { const b = body(); if (b) b.visible = false; }
    if (!appeared && t >= T.vanish) { appeared = true; const vy = victim === G.player ? victim.yaw : (victim.yaw || 0), back = new THREE.Vector3(-Math.sin(vy), 0, -Math.cos(vy)), at = victim.pos.clone().addScaledVector(back, 0.85); { const a0 = caster.pos.clone().setY(caster.pos.y + 1.1), b0 = at.clone().setY(at.y + 1.1), n = Math.ceil(a0.distanceTo(b0) / 0.35); for (let i = 0; i <= n; i++) { const q = a0.clone().lerp(b0, i / n); V.emit('shadow', q, { speed: 0.8, size: 0.9, life: 0.6 }); if (i % 2) V.emit('arcane', q, { speed: 0.4, size: 0.4, life: 0.4 }); } } /* (a streak of shadow along the path she blinked through) */
      caster.pos.copy(at); if (!me && caster.root) caster.root.position.copy(at); const fy = Math.atan2(victim.pos.x - at.x, victim.pos.z - at.z); if (me) { me.yaw = fy; me.bodyYaw = fy; } else { caster.yaw = fy; if (caster.root) caster.root.rotation.y = fy; }
      const b = body(); if (b) b.visible = true; V.burst('shadow', at.clone().setY(at.y + 1), 40, { speed: 3 }); S.cast && S.cast('shadow', at, 1);
      victim.held = true; if (victim.status) { victim.status.stun = T.end; victim.cast = null; } if (victim === G.player) { victim.debuff && victim.debuff('freeze', T.kill + 0.2); ultVictimCine(victim, () => caster.pos.clone().setY(caster.pos.y + 1.2), T.end + 0.4); cineOn = true; } }
    if (appeared && ch && ch.arms) { const A2 = ch.arms, k = Math.min(1, (t - T.vanish) / 0.35), up = t < T.stab ? Math.min(1, (t - T.vanish - 0.25) / 0.45) : 0, dn = t >= T.stab ? Math.min(1, (t - T.stab) / 0.1) : 0;
      A2.L.sh.rotation.set(-1.25 * k, 0, -0.45 * k); A2.L.el.rotation.x = -1.3 * k; // (an arm round them from behind)
      A2.R.sh.rotation.set(-2.9 * Math.max(0, up) * (1 - dn) - 1.0 * dn, 0, 0.25); A2.R.el.rotation.x = -0.5 * (1 - dn) - 0.2; } // (the blade raised high, then driven down)
    if (appeared && !stabbed && victim.held && vroot) { vroot.rotation.x = Math.max(0, (t - T.vanish) / (T.stab - T.vanish)) * -0.15; }
    if (!stabbed && t >= T.stab) { stabbed = true; const p = victim.pos.clone().setY(victim.pos.y + 1.25); V.burst('blood', p, 90, { speed: 6 }); V.burst('shadow', p, 30, { speed: 4 }); V.sphereFlash(p, 1.2, '#ff2020', 0.2); ultImpact(victim.pos, { r: 3.5, col: '#ff2a3a', colCol: '#c040ff', dust: '#300818', debris: 'blood', spark: 'arcane', flash: '#ffc0c0', scorch: false, shake: 0.9, vol: 0.6, colH: 8 }); S.hit && S.hit('flesh', p, 2); G.hitstop = 0.12;
      V.number(p.clone().setY(p.y + 0.8), (victim.hp || 0) / (victim.maxHp || 1) < T.below && !victim.dummy ? 'ASSASSINATED' : 'BACKSTAB', 'crit'); if (vroot) vroot.rotation.x = 0.35; }
    if (!killed && t >= T.kill) { killed = true; victim.held = false; if (vroot) vroot.rotation.x = 0; const low = victim.dummy ? false : (victim.hp || 0) / (victim.maxHp || 1) < T.below; const who = `<b>${caster && caster.heroName ? esc2(caster.heroName) : 'You'}</b>`, vn = `<b>${esc2(victim.heroName || victim.name || 'a fighter')}</b>`;
      if (low) { ultKill(victim, caster); feed(`${who} assassinates ${vn}!`); } else { if (victim === G.player && victim.db && victim.db.freeze) victim.db.freeze.t = 0; ultHurt(victim, T.hurt, caster, 'blood'); silenceUnit(victim, T.silence, caster); feed(`${who} cuts down ${vn} (silenced)`); } }
    if (t > T.end) { G.scene.remove(mark); caster.held = false; caster.stealth = Math.max(caster.stealth || 0, T.stealth); /* (melts back into the shadows) */ const b = body(); if (b) b.visible = true; if (me && me.cine && !document.body.classList.contains('cine')) me.cine = null; return true; }
    return false; } });
  return true;
}

// ---------- the berserker's ultimate: Bladestorm ----------
// he becomes a whirlwind of steel: the whole body spins with both axes held straight out, carving bright arcs, inside a
// roaring funnel of wind, dust and blood. He can be steered (players move; computer berserkers chase). Anyone inside is
// dragged in, slowed and cut every tick; it ends in a blast that throws everyone away.
export const STORM = { dur: 5, r: 3.6, tick: 0.25, dmg: 0.03, pull: 2.2, slow: 0.65 };
const STORM_TRAILS = [];
export function berserkerStorm(caster) {
  const T = Object.assign({}, STORM, G.stormTune || {}), me = caster === G.player ? G.player : null, ch = me ? me.ch : caster.model;
  if (!STORM_TRAILS.length) STORM_TRAILS.push(V.trail('#ffb070'), V.trail('#ffb070'));
  const funnel = new THREE.Group(); const mats = [];
  for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.TorusGeometry(T.r * (0.55 + i * 0.22), 0.05 + i * 0.02, 6, 48, Math.PI * 1.3), new THREE.MeshBasicMaterial({ color: i % 2 ? '#ffe0b8' : '#ff9a60', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); m.rotation.x = Math.PI / 2; m.position.y = 0.6 + i * 0.55; funnel.add(m); mats.push(m.material); } // (bands of wind whipping round him, low and clear of the camera)
  const slashRing = new THREE.Mesh(new THREE.RingGeometry(T.r * 0.55, T.r, 48, 1, 0, Math.PI * 1.2), new THREE.MeshBasicMaterial({ color: '#fff0d0', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })); slashRing.rotation.x = -Math.PI / 2; funnel.add(slashRing);
  G.scene.add(funnel);
  if (me) { me.ultImmT = 0; me.stormT = T.dur; me.tpT = Math.max(me.tpT || 0, T.dur + 0.3); me.tpDist = 5.5; } else { caster.stormT = T.dur; }
  caster.spinT = T.dur; caster.spinA = 0; caster.spinW = Math.PI * 2 * Math.max(1, Math.round(15 * T.dur / (Math.PI * 2))) / T.dur; /* (about 15 rad/s, rounded so the last turn ends facing the way he started: no snap when it stops) */ S.cast && S.cast('fire', caster.pos, 1); V.burst('blood', caster.pos.clone().setY(caster.pos.y + 1), 30, { speed: 4 });
  let t = 0, tickT = 0, sndT = 0, done = false; const hit = new Map(), tipA = new THREE.Vector3(), tipB = new THREE.Vector3(), hA = new THREE.Vector3(), hB = new THREE.Vector3();
  G.timers.push({ update: (dt) => { t += dt; const p = caster.pos;
    // computer berserkers in the yard (no brain of their own) drift at their victim
    if (!me && !caster.arenaBot) { const f = ultFoes(caster)[0]; if (f) { const d = new THREE.Vector3(f.pos.x - p.x, 0, f.pos.z - p.z); const L2 = d.length(); if (L2 > 0.8) { p.addScaledVector(d.normalize(), Math.min(L2, 4.2 * dt)); if (caster.root) caster.root.position.copy(p); } } }
    const k = Math.min(1, t / 0.3) * Math.max(0, 1 - Math.max(0, (t - T.dur + 0.3) / 0.3)); funnel.position.set(p.x, p.y, p.z);
    funnel.children.forEach((m, i) => { if (m === slashRing) return; m.rotation.z = -t * (11 + i * 4); m.material.opacity = k * (0.55 - i * 0.12); }); slashRing.rotation.z = -t * 16; slashRing.material.opacity = k * 0.35;
    if (Math.random() < 0.8 * k) { const a = Math.random() * Math.PI * 2, r0 = T.r * (0.5 + Math.random() * 0.6); V.emit('dust', new THREE.Vector3(p.x + Math.cos(a) * r0, p.y + 0.1 + Math.random() * 0.4, p.z + Math.sin(a) * r0), { speed: 2.5, size: 0.6, life: 0.6, dir: new THREE.Vector3(-Math.sin(a), 0.4, Math.cos(a)) }); }
    if (Math.random() < 0.5 * k) V.emit('spark', p.clone().setY(p.y + 1.2 + (Math.random() - 0.5) * 0.4), { speed: 7, size: 0.18, life: 0.3 });
    // the axes carve bright arcs as he turns
    if (ch && ch.arms && t < T.dur) { ch.root.updateMatrixWorld(true); ch.arms.R.hand.getWorldPosition(hA); ch.arms.L.hand.getWorldPosition(hB); const out = (h) => h.clone().sub(p.clone().setY(h.y)).normalize();
      tipA.copy(hA).addScaledVector(out(hA), 0.9); tipB.copy(hB).addScaledVector(out(hB), 0.9); STORM_TRAILS[0].active = true; STORM_TRAILS[1].active = true; STORM_TRAILS[0].push(hA, tipA); STORM_TRAILS[1].push(hB, tipB); }
    sndT -= dt; if (sndT <= 0 && t < T.dur) { sndT = 0.22; S.swingW && S.swingW('axe', 1.3, p); }
    // the cuts: everyone inside is dragged in, slowed and hit every tick
    tickT -= dt; if (tickT <= 0 && t < T.dur) { tickT = T.tick; for (const u of ultFoes(caster)) { const dx = p.x - u.pos.x, dz = p.z - u.pos.z, d = Math.hypot(dx, dz); if (d > T.r) continue;
        ultHurt(u, T.dmg, caster, 'blood'); hit.set(u, (hit.get(u) || 0) + 1); ultSlow(u, T.slow, T.tick + 0.1); if (d > 0.8) { const pl = Math.min(d - 0.8, T.pull * T.tick); u.pos.x += dx / d * pl; u.pos.z += dz / d * pl; if (u.root) u.root.position.copy(u.pos); }
        V.burst('blood', u.pos.clone().setY(u.pos.y + 1.1), 10, { speed: 4 }); S.hit && S.hit('flesh', u.pos, 0.6); } if (hit.size) V.addShake(0.12); }
    if (!done && t >= T.dur) { done = true; STORM_TRAILS[0].active = false; STORM_TRAILS[1].active = false; caster.spinT = 0; caster.stormT = 0; /* (the spin really stops when the storm ends) */
      V.ring(p.clone().setY(p.y + 0.3), T.r * 2.6, '#ffb070', 0.6); V.burst('dust', p.clone().setY(p.y + 0.5), 70, { speed: 9 }); V.burst('blood', p.clone().setY(p.y + 1), 40, { speed: 7 }); V.addShake(0.8); S.explode && S.explode(p, 0.7);
      for (const u of ultFoes(caster)) { const dx = u.pos.x - p.x, dz = u.pos.z - p.z, d = Math.hypot(dx, dz); if (d > T.r * 1.4) continue; ultHurt(u, 0.06, caster, 'blood'); const n = new THREE.Vector3(dx, 0, dz).normalize(); if (u === G.player && u.vel) u.vel.set(n.x * 10, 7, n.z * 10); else if (u.status) { u.status.stun = Math.max(u.status.stun || 0, 0.8); if (u.status.knock) u.status.knock.set(n.x * 10, 0, n.z * 10); } }
      feed(`<b>${caster && caster.heroName ? esc2(caster.heroName) : 'You'}</b>'s Bladestorm${hit.size ? ` shreds <b>${[...hit.keys()].map(u => esc2(u.heroName || u.name || 'a fighter')).join(', ')}</b>` : ' spins out'}!`); }
    if (t > T.dur + 0.4) { G.scene.remove(funnel); return true; }
    return false; } });
  return true;
}

// banner cloth pictures: a gold-rimmed shield on deep blue (the War Banner), a red cross on white (the Banner of Mending)
const FLAG_T = {}; export function flagTex(kind) { if (FLAG_T[kind]) return FLAG_T[kind]; const W = 512, H = 680, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); const cross = kind === 'cross';
  // the cloth: a swallowtail banner (the notch is cut out with alpha), a soft vertical gradient and a woven texture
  g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); g.lineTo(W, H); g.lineTo(W / 2, H - 120); g.lineTo(0, H); g.closePath(); g.save(); g.clip();
  const gr = g.createLinearGradient(0, 0, W, H); if (cross) { gr.addColorStop(0, '#fbf6e8'); gr.addColorStop(1, '#e2d6b8'); } else { gr.addColorStop(0, '#2a4a8e'); gr.addColorStop(0.55, '#1a3068'); gr.addColorStop(1, '#0e1c44'); } g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.globalAlpha = cross ? 0.05 : 0.08; g.fillStyle = cross ? '#6a5a3a' : '#000'; for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1); for (let x = 0; x < W; x += 4) g.fillRect(x, 0, 1, H); g.globalAlpha = 1;
  // a double gold border with corner flourishes
  const gold = (y0) => { const gg = g.createLinearGradient(0, y0 - 40, 0, y0 + 40); gg.addColorStop(0, '#fff0b0'); gg.addColorStop(0.5, '#d8a838'); gg.addColorStop(1, '#8a6018'); return gg; };
  g.strokeStyle = gold(H / 2); g.lineWidth = 16; g.beginPath(); g.moveTo(16, 16); g.lineTo(W - 16, 16); g.lineTo(W - 16, H - 22); g.lineTo(W / 2, H - 140); g.lineTo(16, H - 22); g.closePath(); g.stroke();
  g.lineWidth = 4; g.beginPath(); g.moveTo(40, 40); g.lineTo(W - 40, 40); g.lineTo(W - 40, H - 60); g.lineTo(W / 2, H - 168); g.lineTo(40, H - 60); g.closePath(); g.stroke();
  const flour = (x, y, sx, sy) => { g.save(); g.translate(x, y); g.scale(sx, sy); g.fillStyle = '#e0b448'; g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(40, 4, 52, 26, 30, 40); g.bezierCurveTo(44, 22, 26, 12, 0, 14); g.closePath(); g.fill(); g.beginPath(); g.arc(34, 30, 6, 0, Math.PI * 2); g.fill(); g.restore(); };
  flour(48, 48, 1, 1); flour(W - 48, 48, -1, 1);
  if (cross) { // a red cross with a gold edge, laurel branches below
    g.fillStyle = '#d8a838'; g.fillRect(200, 110, 112, 340); g.fillRect(110, 216, 292, 112); g.fillStyle = '#b81414'; g.fillRect(212, 122, 88, 316); g.fillRect(122, 228, 268, 88); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(212, 122, 22, 316); g.fillRect(122, 228, 268, 20);
    g.fillStyle = '#5a8a3a'; for (const sd of [-1, 1]) for (let i = 0; i < 6; i++) { g.save(); g.translate(256 + sd * (60 + i * 22), 470 - i * 14); g.rotate(sd * (0.6 + i * 0.12)); g.beginPath(); g.ellipse(0, 0, 9, 22, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
  } else { // a heater shield on crossed swords, stars above
    g.save(); g.translate(256, 280); for (const r of [-0.7, 0.7]) { g.save(); g.rotate(r); g.fillStyle = '#c8ccd4'; g.fillRect(-7, -190, 14, 300); g.fillStyle = '#d8a838'; g.fillRect(-34, 92, 68, 12); g.fillStyle = '#5a3a1a'; g.fillRect(-6, 104, 12, 46); g.fillStyle = '#d8a838'; g.beginPath(); g.arc(0, 156, 11, 0, Math.PI * 2); g.fill(); g.restore(); } g.restore();
    const shield = (sc, col) => { g.beginPath(); g.moveTo(256, 150 - 30 * sc); g.lineTo(256 + 110 * sc, 190 - 14 * sc); g.quadraticCurveTo(256 + 108 * sc, 330 + 10 * sc, 256, 420 + 24 * sc); g.quadraticCurveTo(256 - 108 * sc, 330 + 10 * sc, 256 - 110 * sc, 190 - 14 * sc); g.closePath(); g.fillStyle = col; g.fill(); };
    shield(1.08, '#8a6018'); shield(1.0, '#e0b448'); shield(0.84, '#9a1414'); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(170, 170, 86, 230);
    g.fillStyle = '#e0b448'; g.fillRect(248, 190, 16, 190); g.fillRect(196, 250, 120, 16); g.beginPath(); g.arc(256, 258, 16, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff0b0'; for (const [x, y] of [[150, 110], [256, 92], [362, 110]]) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 6 : 15; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); g.fill(); } }
  g.restore();
  // gold fringe along the swallowtail
  g.strokeStyle = '#d8a838'; g.lineWidth = 3; for (let i = 0; i <= 26; i++) { const k = i / 26, x = k < 0.5 ? k * 2 * (W / 2) : W / 2 + (k - 0.5) * 2 * (W / 2), y = k < 0.5 ? H - 120 * (k * 2) : H - 120 + 120 * ((k - 0.5) * 2); g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x, y); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; FLAG_T[kind] = t; return t; }
// a banner pole's fittings: a gold crossbar over the cloth, an orb and spearhead finial, and two tasselled cords
export function bannerFittings(g, top, w, x0) { const goldM = new THREE.MeshStandardMaterial({ color: '#d8a838', metalness: 0.85, roughness: 0.3 }), cordM = new THREE.MeshStandardMaterial({ color: '#9a1414', roughness: 0.9 });
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.025, w * 0.025, w * 1.12, 8), goldM); bar.rotation.z = Math.PI / 2; bar.position.set(x0, top, 0); g.add(bar); for (const e of [-1, 1]) { const k = new THREE.Mesh(new THREE.SphereGeometry(w * 0.045, 8, 6), goldM); k.position.set(x0 + e * w * 0.58, top, 0); g.add(k); }
  const orb = new THREE.Mesh(new THREE.SphereGeometry(w * 0.07, 12, 10), goldM); orb.position.y = top + w * 0.1; g.add(orb); const tip = new THREE.Mesh(new THREE.ConeGeometry(w * 0.05, w * 0.26, 4), goldM); tip.position.y = top + w * 0.3; g.add(tip);
  for (const e of [-1, 1]) { const cord = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.008, w * 0.008, w * 0.5, 4), cordM); cord.position.set(x0 + e * w * 0.5, top - w * 0.25, w * 0.02); g.add(cord); const tas = new THREE.Mesh(new THREE.ConeGeometry(w * 0.035, w * 0.14, 6), goldM); tas.position.set(x0 + e * w * 0.5, top - w * 0.55, w * 0.02); g.add(tas); } }
// the warrior's Banner of Mending (C): a small banner with a red cross; allies within 5 m slowly heal for 8 s
// the owner's two Meshy banners for the warrior: the blue shield banner (War Banner ultimate) and the green-and-gold
// chalice banner (Mending Banner). Loaded once, the first time a warrior is about; until then the drawn flags stand in
const BANNER_URL = { shield: 'models/props/banner_a.fbx', mend: 'models/props/banner_b.fbx' }, BANNER = {};
export function preloadBanners() { for (const k in BANNER_URL) { if (BANNER[k]) continue; BANNER[k] = 'loading';
    new FBXLoader().load(BANNER_URL[k], (o) => { try { o.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(o), sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
      o.traverse(m => { if (!m.isMesh) return; fixNormals(m.geometry); /* (the warrior's banner model carries 3 zero-length normals: on a real graphics card those pixels come out invalid and the glow pass smeared them over the whole screen, black) */ m.castShadow = true; for (const mt of (Array.isArray(m.material) ? m.material : [m.material])) { if (mt.map) { mt.map.colorSpace = THREE.SRGBColorSpace; mt.map.anisotropy = 4; if (mt.emissive) { mt.emissiveMap = mt.map; mt.emissive.setScalar(0.42); } } if ('shininess' in mt) mt.shininess = 12; /* (a soft glow from its own colours: with the sun behind it the cloth went a dull navy-grey) */ } });
      const g = new THREE.Group(); o.position.set(-c.x, -bb.min.y, -c.z); g.add(o); g.scale.setScalar(1 / Math.max(0.01, sz.y)); /* (one metre tall, standing on its foot, centred on its pole) */ BANNER[k] = g; } catch (e) { BANNER[k] = null; console.warn('banner model', k, e); } }, undefined, (e) => { BANNER[k] = null; console.warn('banner model failed to load', k, e); }); } }
function bannerModel(k, h) { const b = BANNER[k]; if (!b || b === 'loading') { preloadBanners(); return null; } const m = b.clone(); m.scale.multiplyScalar(h); m.rotation.y = Math.PI; /* (its face turned toward the warrior who planted it) */ return m; }
// swap the drawn flag for the model: everything but the glow rings and the dome is hidden
function useBannerModel(g, k, h, keep) { const m = bannerModel(k, h); if (!m) return false; for (const ch of g.children) if (!keep.includes(ch)) ch.visible = false; g.add(m);
  const mats = []; m.traverse(o => { if (!o.isMesh) return; o.material = Array.isArray(o.material) ? o.material.map(x => x.clone()) : o.material.clone(); for (const x of [].concat(o.material)) mats.push(x); }); g.userData.banner = m; g.userData.fadeMats = mats; return true; } /* (its own materials, so it can fade on its own) */
// the camera came right up to (or into) a banner: fade it out instead of filling the screen with the inside of the cloth and pole
function bannerFade(g) { const m = g.userData.banner, mats = g.userData.fadeMats; if (!m || !mats || !G.camera) return; const c = G.camera.position, p = g.position, d = Math.hypot(c.x - p.x, c.z - p.z) / Math.max(0.3, g.scale.x || 1), k = Math.max(0, Math.min(1, (d - 1.4) / 2.2));
  if (k === g.userData.fadeK) return; g.userData.fadeK = k; m.visible = k > 0.02; for (const x of mats) { x.transparent = k < 0.999; x.opacity = k; x.depthWrite = k >= 0.999; } }
// where a banner goes: the spot you aim at (the player), but never further than its aura reaches, and not on your toes
function bannerSpot(caster, reach, ahead) { const p = caster.pos, yw = caster.yaw || 0; let at = null;
  if (caster === G.player) { try { at = groundPoint(reach); } catch (e) { at = null; } }
  if (!at) at = new THREE.Vector3(p.x + Math.sin(yw) * ahead, p.y, p.z + Math.cos(yw) * ahead);
  const dx = at.x - p.x, dz = at.z - p.z, d = Math.hypot(dx, dz); if (d > reach) { at.x = p.x + dx / d * reach; at.z = p.z + dz / d * reach; } else if (d < 1.4) { at.x = p.x + Math.sin(yw) * 1.4; at.z = p.z + Math.cos(yw) * 1.4; }
  return at; }
// a banner driven into the ground: a heavy slam and a puff of dirt round its foot
function bannerSlam(at, big = 1) { S.slam && S.slam(at, big); const p = at.clone ? at.clone() : new THREE.Vector3(at.x, at.y, at.z);
  V.burst('dust', p.clone().setY(p.y + 0.15), Math.round(60 * big), { speed: 3.4 * big, size: 1.1 * big, life: 1.4, vy: 0.9 }); V.burst('dust', p.clone().setY(p.y + 0.4), Math.round(20 * big), { speed: 1.2, size: 1.6 * big, life: 1.8, vy: 0.5 }); V.burst('stone', p.clone().setY(p.y + 0.2), Math.round(12 * big), { speed: 3 * big, grav: 14, size: 0.14 }); V.addShake && V.addShake(0.25 * big); }
export function mendBanner(caster) { const p = caster.pos.clone(), yw = caster.yaw || 0, at = bannerSpot(caster, 5, 1.6), base = ultGround(at); at.y = base; const R = 6 * (1 + 0.2 * Game.arenaPassive(caster.h, 'mendWide')), SZ = (R * 2 / 4) / 2.7; /* (the owner: 3 m tall and 12 m across, the ring showing exactly how far it heals; Wide Mending widens it 20% a rank and the banner grows with it, always a quarter as tall as the ring is wide (built 2.7 m tall, scaled to that)) */
  const g = new THREE.Group(); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.4, 8), new THREE.MeshStandardMaterial({ color: '#4a2e18', roughness: 0.8 })); pole.position.y = 1.2; g.add(pole);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.06, 6, 6), new THREE.MeshStandardMaterial({ map: flagTex('cross'), alphaTest: 0.5, transparent: true, roughness: 0.85, side: THREE.DoubleSide })); cloth.position.set(0.42, 1.83, 0); g.add(cloth); bannerFittings(g, 2.38, 0.8, 0.42);
  const ring = new THREE.Mesh(new THREE.RingGeometry((R - 0.18) / SZ, R / SZ, 64), glowM('#7aff8a', 0)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05 / SZ; g.add(ring); useBannerModel(g, 'mend', 2.7, [ring]);
  g.scale.setScalar(SZ); g.position.copy(at).setY(base + 12); g.rotation.y = yw; G.scene.add(g); const pos0 = cloth.geometry.attributes.position.array.slice(); let regT = 0, landed = false; const DROP = 0.45; /* (it falls out of the sky like the War Banner, smaller) */
  timer((t, dt) => { bannerFade(g); if (t < DROP) { const f = t / DROP; g.position.y = base + 12 * (1 - f * f); ring.material.opacity = 0; V.emit('gold', g.position.clone().setY(g.position.y + 2.6), { speed: 0.4, size: 0.4, life: 0.3 }); return false; }
    if (!landed) { landed = true; g.position.y = base; bannerSlam(at, 0.8 * SZ); S.explode && S.explode(at, 0.45); /* (the War Banner's boom, quieter) */ ultImpact(at, { r: 3 * SZ, col: '#9aff8a', column: false, noFlash: true, scorch: false, sparks: false, shake: 0.45, vol: 0, wallH: 1 }); }
    t -= DROP; const a = cloth.geometry.attributes.position; for (let i = 0; i < a.count; i++) { const x = pos0[i * 3]; a.array[i * 3 + 2] = Math.sin(t * 5 + x * 6) * 0.06 * (x + 0.4); } a.needsUpdate = true; ring.material.opacity = 0.25 + Math.sin(t * 3) * 0.08;
    regT -= dt || 1 / 60; if (regT <= 0) { regT = 0.5; for (const u of nearOf(ultFriends(caster), at, R)) { ultHeal(u, 0.008); if (Math.random() < 0.5) V.emit('green', u.pos.clone().setY(u.pos.y + 1.5), { speed: 0.3, vy: 1, size: 0.25 }); } }
    if (t > 8 * (1 + 0.2 * Game.arenaPassive(caster.h, 'bannerLong'))) { G.scene.remove(g); return true; } return false; }); }
// ---------- the ranger's ultimate: Rain of Arrows ----------
// a volley loosed straight up; a shadow spreads over the target circle; then a real storm of arrows comes down for
// several seconds. Each tick everyone inside is struck (arrows aimed at them, stuck in them); the rest pepper the ground.
export const RAIN = { r: 7, delay: 0.85, dur: 3.2, tick: 0.25, dmg: 0.04, perSec: 45 };
const RAIN_STREAK = { g: new THREE.CylinderGeometry(0.05, 0.005, 3.2, 5), m: new THREE.MeshBasicMaterial({ color: '#fff0c8', transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }) };
export function rangerRain(caster, at) {
  if (at && at.pos) at = at.pos; if (!at) return false; const T = Object.assign({}, RAIN, G.rainTune || {}), me = caster === G.player ? G.player : null, ch = me ? me.ch : caster.model;
  const base = ultGround(at), C = new THREE.Vector3(at.x, base, at.z), end = T.delay + T.dur;
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(T.r, 48), new THREE.MeshBasicMaterial({ color: '#0a0806', transparent: true, opacity: 0, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.set(C.x, base + 0.05, C.z);
  const rim = new THREE.Mesh(new THREE.RingGeometry(T.r - 0.15, T.r, 64), new THREE.MeshBasicMaterial({ color: '#ff3a2a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); rim.rotation.x = -Math.PI / 2; rim.position.set(C.x, base + 0.07, C.z); G.scene.add(shadow, rim);
  caster.held = true; if (me) { me.ultImmT = T.delay + 1.5; me.ultPoseT = 0; ultFlyCam(me, () => C.clone().setY(base + 1), () => T.delay + 0.5, { r: 11, h: 4.6, inT: 0.9 }); } else caster.invulnT = G.time + end + 0.5; /* (the shot pulls back once the volley is up, so the ranger keeps shooting while it rains: the balance tester found the whole storm cost more basic damage than it dealt) */
  const live = []; // arrows in flight or stuck: { m, t, life, from, to, dur, stick: unit|null }
  const spawn = (to, unit) => { const m = makeArrow(); m.scale.setScalar(1.7); const sk2 = new THREE.Mesh(RAIN_STREAK.g, RAIN_STREAK.m); sk2.position.y = 1.9; m.add(sk2); m.userData.streak = sk2; /* (big arrows with a bright streak behind each one: from the camera's seat the storm reads as falling light, not specks) */ const from = to.clone().add(new THREE.Vector3(2.5 + Math.random() * 1.5, 16 + Math.random() * 4, -1.5 + Math.random() * 3)); m.position.copy(from); const dir = to.clone().sub(from).normalize(); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir); G.scene.add(m); live.push({ m, t: 0, dur: 0.32 + Math.random() * 0.08, from, to, unit, landed: false }); };
  let t = 0, volT = 0, rainAcc = 0, tickT = 0, sndT = 0; const struck = new Map(), up = [];
  S.bowShot && S.bowShot(caster.pos);
  G.timers.push({ update: (dt) => { t += dt;
    // the ranger draws and looses upward, again and again, until the storm is in the air
    if (ch && ch.arms && t < T.delay + 0.2) { ch.arms.L.sh.rotation.set(-2.6, 0, -0.2); ch.arms.R.sh.rotation.set(-2.4, 0, 0.15); ch.arms.R.el.rotation.x = -0.9 + Math.sin(t * 18) * 0.3; }
    volT -= dt; if (t < T.delay && volT <= 0) { volT = 0.06; const m = makeArrow(); const p0 = caster.pos.clone().setY(caster.pos.y + 1.7); m.position.copy(p0); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3((Math.random() - 0.5) * 0.3, 1, (Math.random() - 0.5) * 0.3).normalize()); /* (the owner: the volley looked like arrows dropping on his head: an arrow's head is its -y, and they flew up tail first, heads down; now they fly head first into the sky) */ G.scene.add(m); up.push({ m, t: 0, v: new THREE.Vector3((Math.random() - 0.5) * 3, 34, (Math.random() - 0.5) * 3) }); if (Math.random() < 0.4) S.bowShot && S.bowShot(caster.pos); }
    for (let i = up.length - 1; i >= 0; i--) { const a = up[i]; a.t += dt; a.m.position.addScaledVector(a.v, dt); a.m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), a.v.clone().normalize()); if (a.t > 0.8) { G.scene.remove(a.m); up.splice(i, 1); } }
    // the shadow of the storm spreads
    const sk = Math.min(1, t / T.delay) * Math.max(0, 1 - Math.max(0, (t - end) / 0.5)); shadow.material.opacity = 0.5 * sk; shadow.scale.setScalar(0.3 + 0.7 * Math.min(1, t / T.delay)); rim.material.opacity = sk * (0.5 + Math.sin(t * 10) * 0.25);
    // the rain
    if (t >= T.delay && !shadow.userData.hit) { shadow.userData.hit = true; ultImpact(C, { r: T.r, col: '#ffcf80', column: false, debris: 'dust', spark: 'spark', scorch: false, shake: 0.6, vol: 0.6, wallH: 0.8 }); } /* (the first wave hits the ground all at once) */
    if (t >= T.delay && t < end) { rainAcc += dt * T.perSec; while (rainAcc >= 1) { rainAcc--; const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * T.r; spawn(new THREE.Vector3(C.x + Math.cos(a) * rr, base, C.z + Math.sin(a) * rr), null); }
      tickT -= dt; if (tickT <= 0) { tickT = T.tick; for (const u of ultFoes(caster)) { if (Math.hypot(u.pos.x - C.x, u.pos.z - C.z) > T.r) continue; for (let k = 0; k < 2; k++) spawn(u.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.9 + Math.random() * 0.7, (Math.random() - 0.5) * 0.5)), u); struck.set(u, (struck.get(u) || 0) + 1); } } }
    sndT -= dt;
    for (let i = live.length - 1; i >= 0; i--) { const a = live[i]; a.t += dt;
      if (!a.landed) { const k = Math.min(1, a.t / a.dur); a.m.position.lerpVectors(a.from, a.to, k);
        if (k >= 1) { a.landed = true; a.t = 0; if (a.m.userData.streak) { a.m.remove(a.m.userData.streak); a.m.userData.streak = null; } a.m.scale.setScalar(a.unit ? 1.15 : 1.5);
          if (a.unit && !a.unit.dead) { const vr = a.unit.root || (a.unit.ch && a.unit.ch.root); if (vr) { vr.updateMatrixWorld(true); const lp = vr.worldToLocal(a.to.clone()), q = vr.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(a.m.quaternion); G.scene.remove(a.m); vr.add(a.m); a.m.position.copy(lp).addScaledVector(new THREE.Vector3(0, 1, 0).applyQuaternion(q), 0.2); a.m.quaternion.copy(q); a.stuckTo = vr; }
            ultHurt(a.unit, T.dmg / 2, caster, 'blood'); V.burst('blood', a.to, 6, { speed: 2.5 }); if (sndT <= 0) { sndT = 0.08; S.hit && S.hit('flesh', a.to, 0.7); } }
          else { V.burst('dust', a.to.clone().setY(a.to.y + 0.05), 5, { speed: 2.2, size: 0.5 }); if (Math.random() < 0.5) V.emit('spark', a.to.clone().setY(a.to.y + 0.1), { n: 3, speed: 3, size: 0.18, life: 0.25 }); if (sndT <= 0 && Math.random() < 0.3) { sndT = 0.06; S.hit && S.hit('wood', a.to, 0.4); } a.m.position.y = a.to.y + 0.25; } } }
      else if (a.t > (a.stuckTo ? 2.2 : 1.6)) { (a.stuckTo || G.scene).remove(a.m); live.splice(i, 1); } }
    if (me && t > T.delay + 1.3 && me.held) me.held = false;
    if (t > end + 2.3 && !live.length && !up.length) { G.scene.remove(shadow, rim); caster.held = false; if (me && me.cine && !document.body.classList.contains('cine')) me.cine = null;
      return true; }
    if (t > T.delay + 1.3 && caster.held) caster.held = false;
    return false; } });
  return true;
}

// ---------- healers ----------
// the ally under your crosshair (walls don't matter, like Paladins' healers): the one nearest the aim line within range
export function aimAlly(p, range = 45) { const cam = G.camera, o = cam.getWorldPosition(new THREE.Vector3()), d = cam.getWorldDirection(new THREE.Vector3()); let best = null, ba = 0.16;
  for (const u of ultFriends(p)) { if (u === p) continue; const v = u.pos.clone().setY(u.pos.y + 1.1).sub(o), L2 = v.length(); if (L2 > range) continue; const a = Math.acos(Math.min(1, v.dot(d) / L2)); if (a < ba) { ba = a; best = u; } } return best; }
const chestOf = (u) => u.pos.clone().setY(u.pos.y + 1.15);
const handOfU = (u) => { const ch = u === G.player ? u.ch : u.model; const h = ch && ch.arms && ch.arms.R.hand; if (h && !(u === G.player && u.camDist < 0.6)) { ch.root.updateMatrixWorld(true); return h.getWorldPosition(new THREE.Vector3()); } return u === G.player ? G.camera.position.clone().add(new THREE.Vector3(0.15, -0.2, -0.5).applyQuaternion(G.camera.quaternion)) : chestOf(u); };
// the healers' right click: a direct heal into one ally (or yourself), each with its own look and a twist
export function atone(caster, frac = 0.04) { const fr = ultFriends(caster).filter(u => !u.dead && Math.hypot(u.pos.x - caster.pos.x, u.pos.z - caster.pos.z) < 25).sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0]; if (!fr) return; if (fr.hp >= fr.maxHp) return;
  healBeam(chestOf(caster), chestOf(fr), 'holy'); ultHeal(fr, frac); }
export function healerMend(caster, target, a) { target = target || caster; const kind = a.kind || 'holy', from = handOfU(caster), to = chestOf(target);
  if (target === caster) healBeam(to.clone().setY(to.y + 2.2), to, kind === 'dawn' ? 'holy' : kind); else healBeam(from, to, kind === 'dawn' ? 'holy' : kind);
  ultHeal(target, a.heal || 0.2); S.heal && S.heal(); S.cast && S.cast(kind === 'holy' ? 'holy' : kind === 'water' ? 'frost' : kind === 'nature' ? 'nature' : 'holy', target.pos, 0.6);
  if (kind === 'nature') { let n = 0; const tick = () => { if (n++ >= 4 || target.dead) return; ultHeal(target, 0.04); V.burst('leaf', chestOf(target), 6, { speed: 1.5 }); setTimeout(tick, 1000); }; setTimeout(tick, 1000); }
  if (kind === 'water') { const next = ultFriends(caster).filter(u => u !== target && Math.hypot(u.pos.x - target.pos.x, u.pos.z - target.pos.z) < 10).sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0]; if (next) setTimeout(() => { healBeam(chestOf(target), chestOf(next), 'water'); ultHeal(next, (a.heal || 0.2) / 2); }, 220); }
  if (kind === 'song') for (const u of ultFriends(caster)) if (u !== target && Math.hypot(u.pos.x - target.pos.x, u.pos.z - target.pos.z) < 8) { ultHeal(u, 0.07); playNotes(G.scene, u, '#ffb0f0', 2); }
  if (kind === 'song') playNotes(G.scene, target, '#ffb0f0', 4);
  if (kind === 'dawn') { buffUnit(target, 'barrier', 4); V.ring(target.pos.clone().setY(target.pos.y + 0.1), 3, '#ffe9a0', 0.5); V.burst('gold', chestOf(target), 24, { speed: 3, vy: 2 }); }
}
// the cleric's ultimate: Miracle. A pillar of light on one ally: healed to full, untouchable for 3 s in a golden shield,
// and everyone near them heals by half their health
export function clericMiracle(caster, target) { target = target || caster; const me = caster === G.player ? G.player : null, base = ultGround(target.pos), P = () => target.pos;
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, 40, 32, 1, true), new THREE.MeshBasicMaterial({ color: '#fff2b8', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3, 2), new THREE.MeshBasicMaterial({ color: '#ffd870', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })), wire = new THREE.Mesh(new THREE.IcosahedronGeometry(1.33, 1), new THREE.MeshBasicMaterial({ color: '#fff4c0', wireframe: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.04, 8, 32), new THREE.MeshBasicMaterial({ color: '#fff4b0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); halo.rotation.x = Math.PI / 2;
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.7, 48), new THREE.MeshBasicMaterial({ color: '#ffe8a0', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })); ring.rotation.x = -Math.PI / 2;
  G.scene.add(pillar, shell, wire, halo, ring); pillar.scale.set(2, 1, 2); if (me) { me.ultPoseT = 1.6; me.ultImmT = Math.max(me.ultImmT || 0, 1.5); ultFlyCam(me, () => target.pos.clone().setY(base + uH(target) * 0.5), () => 1.9, { r: 9, h: 3.5, inT: 0.6, frame: false }); } /* (the camera steps out to show the miracle land on them) */
  S.cast && S.cast('holy', target.pos, 1.6); let t = 0, landed = false;
  G.timers.push({ update: (dt) => { t += dt; const p = P();
    pillar.position.set(p.x, base + 20, p.z); pillar.material.opacity = (me && me.cine ? 0.3 : me ? 0 : 0.35) * Math.min(1, t / 0.25) * Math.max(0, 1 - Math.max(0, (t - 0.9) / 0.6)); /* (clamped: past 1.5 s the old fade went below zero, and a negative additive opacity subtracts colour: the 'inverted' psychedelic rectangle) */ pillar.scale.set(2 + Math.sin(t * 20) * 0.08, 1, 2 + Math.sin(t * 20) * 0.08);
    if (!landed && t >= 0.3) { landed = true; ultHeal(target, 1); if (target === G.player) target.ultImmT = Math.max(target.ultImmT || 0, 3); else target.invulnT = G.time + 3; if (target.db) for (const k in target.db) if (k !== 'freeze') target.db[k].t = 0; if (target.status) { target.status.stun = 0; target.status.slow = 0; target.status.root = 0; }
      for (const u of ultFriends(caster)) if (u !== target && Math.hypot(u.pos.x - p.x, u.pos.z - p.z) < 8) ultHeal(u, 0.5);
      V.burst('gold', p.clone().setY(p.y + 1.2), 90, { speed: 6 }); V.sphereFlash(p.clone().setY(p.y + 1.2), 3, '#fff4c0', 0.4); V.light(p.clone().setY(p.y + 2.5), '#fff0c0', 12, 1.0, 20); V.addShake(0.3);
      feed(`<b>${caster && caster.heroName ? esc2(caster.heroName) : 'You'}</b> works a Miracle on <b>${target === caster ? 'themself' : esc2(target.heroName || target.name || 'an ally')}</b>!`); }
    const sk = landed ? Math.min(1, (t - 0.3) / 0.2) * Math.max(0, 1 - Math.max(0, (t - 3.0) / 0.3)) : 0;
    for (const m of [shell, wire]) { m.position.set(p.x, p.y + 1.05, p.z); m.scale.setScalar(1 + Math.sin(t * 5) * 0.03); } shell.material.opacity = 0.16 * sk; wire.material.opacity = 0.35 * sk; wire.rotation.y = t * 0.6;
    halo.position.set(p.x, p.y + (target.height || 1.8) + 0.35, p.z); halo.material.opacity = 0.9 * sk;
    ring.position.set(p.x, base + 0.06, p.z); const rk = Math.max(0, Math.min(1, (t - 0.3) / 0.7)); ring.scale.setScalar(1 + rk * 11); ring.material.opacity = landed ? 0.8 * (1 - rk) : 0;
    if (landed && sk > 0.2 && Math.random() < 0.6) { const a = Math.random() * Math.PI * 2; V.emit('gold', p.clone().add(new THREE.Vector3(Math.cos(a) * 0.9, Math.random() * 2, Math.sin(a) * 0.9)), { speed: 0.2, vy: 1.5, size: 0.25, life: 0.8 }); }
    if (t > 3.4) { G.scene.remove(pillar, shell, wire, halo, ring); return true; } return false; } });
  return true;
}
// the druid's ultimate: Overgrowth. A forest bursts out around the druid and races across the whole arena; allies it
// reaches are healed, enemies are tangled and slowed; then the trees slowly wither back into the earth
export const OVERGROWTH = { speed: 22, reach: 90, life: 6.5, wither: 2.4, heal: 0.33, hot: 0.15, slow: 0.5, slowDur: 2.5 };
let TREE_G = null;
function treeParts() { if (TREE_G) return TREE_G; TREE_G = { trunk: new THREE.CylinderGeometry(0.12, 0.22, 2.2, 7), crown: new THREE.IcosahedronGeometry(1.0, 0), bark: new THREE.MeshStandardMaterial({ color: '#5a3a1e', roughness: 0.9 }), leaf: [new THREE.MeshStandardMaterial({ color: '#3f8a2e', roughness: 0.8, flatShading: true }), new THREE.MeshStandardMaterial({ color: '#5aa83a', roughness: 0.8, flatShading: true })], dead: new THREE.MeshStandardMaterial({ color: '#7a6034', roughness: 0.95, flatShading: true }) }; return TREE_G; }
function makeTree() { const P = treeParts(), g = new THREE.Group(); const tr = new THREE.Mesh(P.trunk, P.bark); tr.position.y = 1.1; g.add(tr); const n = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < n; i++) { const c = new THREE.Mesh(P.crown, P.leaf[i % 2]); c.position.set((Math.random() - 0.5) * 0.7, 2.3 + i * 0.55, (Math.random() - 0.5) * 0.7); c.scale.setScalar(0.9 - i * 0.18 + Math.random() * 0.2); g.add(c); } g.userData.crowns = g.children.slice(1); return g; }
export function druidOvergrowth(caster) { const T = Object.assign({}, OVERGROWTH, G.overTune || {}), me = caster === G.player ? G.player : null, C = caster.pos.clone(), base = ultGround(C);
  if (me) { me.ultPoseT = 2.0; me.ultImmT = Math.max(me.ultImmT || 0, 2); ultFlyCam(me, (ct) => C.clone().setY(base + 1), () => 3.2, { r: 22, h: 14 }); me.held = true; setTimeout(() => { me.held = false; }, 4200); } ultImpact(C, { r: 8, col: '#7ae060', colCol: '#c8ffa0', dust: '#6a8a40', debris: 'leaf', spark: 'green', flash: '#e8ffd0', scorch: false, shake: 0.8, vol: 0.6, colH: 16 });
  V.burst('leaf', C.clone().setY(base + 1.5), 80, { speed: 6 }); S.cast && S.cast('nature', C, 1.6); V.ring(C.clone().setY(base + 0.1), 10, '#7ae060', 0.8);
  const trees = [], reached = new Set(); let t = 0, front = 0, spawned = 0; const total = Math.ceil(T.reach / T.speed);
  G.timers.push({ update: (dt) => { t += dt; const prev = front; front = Math.min(T.reach, t * T.speed);
    // new trees along the advancing front (denser near the druid, a living wave across the arena)
    if (front > prev) { const ringArea = Math.PI * (front * front - prev * prev), want = Math.min(28, Math.max(1, Math.round(ringArea / 26))); for (let i = 0; i < want && spawned < 220; i++) { const a = Math.random() * Math.PI * 2, rr = prev + Math.random() * (front - prev); const x = C.x + Math.cos(a) * rr, z = C.z + Math.sin(a) * rr; if (RUINS_MAP() && solidAt && solidAt(x, z, base + 1)) continue; if (Math.hypot(x - caster.pos.x, z - caster.pos.z) < 6 || (G.player && Math.hypot(x - G.player.pos.x, z - G.player.pos.z) < 6)) continue; /* (no tree grows on top of a hero or round your own camera) */
        const tr = makeTree(); tr.position.set(x, ultGround(new THREE.Vector3(x, base, z)), z); tr.rotation.y = Math.random() * 6.28; tr.scale.setScalar(0.01); G.scene.add(tr); trees.push({ m: tr, born: t, size: 0.7 + Math.random() * 0.6 }); spawned++; if (Math.random() < 0.3) V.burst('leaf', tr.position.clone().setY(tr.position.y + 0.5), 6, { speed: 2 }); } }
    // the wave reaches people: allies heal, enemies are tangled
    for (const u of ultFriends(caster)) if (!reached.has(u) && Math.hypot(u.pos.x - C.x, u.pos.z - C.z) <= front) { reached.add(u); ultHeal(u, T.heal); let n = 0; const hot = () => { if (n++ >= 5 || u.dead) return; ultHeal(u, T.hot / 5); V.burst('leaf', u.pos.clone().setY(u.pos.y + 1), 5, { speed: 1.5 }); setTimeout(hot, 1000); }; setTimeout(hot, 1000); V.sphereFlash(u.pos.clone().setY(u.pos.y + 1.1), 1.2, '#9aff7a', 0.3); }
    for (const u of ultFoes(caster)) if (!reached.has(u) && Math.hypot(u.pos.x - C.x, u.pos.z - C.z) <= front) { reached.add(u); ultSlow(u, T.slow, T.slowDur); if (u === G.player) { u.debuff && u.debuff('slow', T.slowDur); } V.burst('leaf', u.pos.clone().setY(u.pos.y + 0.4), 14, { speed: 2 }); V.burst('wood', u.pos.clone().setY(u.pos.y + 0.3), 8, { speed: 1.5 }); }
    // each tree springs up, sways, then withers brown and sinks away
    for (let i = trees.length - 1; i >= 0; i--) { const tr = trees[i], age = t - tr.born, m = tr.m; const grow = Math.min(1, age / 0.6), ease = grow * grow * (3 - 2 * grow);
      const wAt = T.life - (tr.born / (total + 1)) * 0.0, wk = Math.max(0, Math.min(1, (t - wAt - tr.born * 0.15) / T.wither));
      if (wk > 0 && !m.userData.dead) { m.userData.dead = true; for (const c of m.userData.crowns) c.material = treeParts().dead; }
      m.scale.setScalar(Math.max(0.01, tr.size * ease * (1 - wk * 0.6))); m.position.y = ultGround(m.position) - wk * 2.2; m.rotation.z = Math.sin(t * 1.5 + i) * 0.03 * (1 - wk);
      if (wk > 0 && Math.random() < 0.02) V.emit('leaf', m.position.clone().setY(m.position.y + 2.5), { speed: 0.5, vy: -1, size: 0.3, life: 1.2 });
      if (wk >= 1) { G.scene.remove(m); trees.splice(i, 1); } }
    if (t > 2 && !trees.length) return true; return false; } });
  return true;
}

// the shaman's right click: a healing totem thrown where he aims; it pulses healing to allies around it
const TOTEMS = new Map(); // (one per shaman)
export function shamanTotem(caster, at) { if (at && at.pos) at = at.pos; if (!at) return; const old = TOTEMS.get(caster); if (old) old.end = 0;
  const base = ultGround(at), to = new THREE.Vector3(at.x, base, at.z), from = (caster.pos || to).clone().setY((caster.pos ? caster.pos.y : base) + 1.6), m = makeTotem(0.8); m.position.copy(from); G.scene.add(m);
  const ring = new THREE.Mesh(new THREE.RingGeometry(5.7, 6, 48), new THREE.MeshBasicMaterial({ color: '#7ad0ff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.set(to.x, base + 0.06, to.z); G.scene.add(ring);
  const st = { end: 6.6 }; TOTEMS.set(caster, st); let t = 0, landed = false, pulse = 0; S.swingW && S.swingW('staff', 1, from);
  G.timers.push({ update: (dt) => { t += dt;
    if (!landed) { const k = Math.min(1, t / 0.45); m.position.lerpVectors(from, to, k); m.position.y += Math.sin(k * Math.PI) * 2.2; m.rotation.x = (1 - k) * 6; if (k >= 1) { landed = true; m.rotation.x = 0; m.position.copy(to); V.burst('dust', to.clone().setY(base + 0.2), 20, { speed: 3 }); V.burst('water', to.clone().setY(base + 0.5), 20, { speed: 3 }); S.hit && S.hit('wood', to, 1); } }
    else { pulse -= dt; m.userData.band.position.y = 0.05 + ((t * 0.8) % 1) * 2.2; m.userData.glowMat.opacity = 0.5 + Math.sin(t * 6) * 0.3; ring.material.opacity = 0.35 + Math.sin(t * 4) * 0.15;
      if (pulse <= 0 && t < st.end) { pulse = 1; V.ring(to.clone().setY(base + 0.1), 12, '#7ad0ff', 0.6); for (const u of ultFriends(caster)) if (Math.hypot(u.pos.x - to.x, u.pos.z - to.z) < 6) { ultHeal(u, 0.06); healBeam(to.clone().setY(base + 1.6), u.pos.clone().setY(u.pos.y + 1.1), 'water'); } } }
    if (t > st.end) { const k = Math.min(1, (t - st.end) / 0.5); m.scale.setScalar(0.8 * (1 - k) + 0.01); ring.material.opacity = 0.35 * (1 - k); if (k >= 1) { G.scene.remove(m, ring); if (TOTEMS.get(caster) === st) TOTEMS.delete(caster); return true; } }
    return false; } });
}
// the shaman's ultimate: Spirit of the Storm. A giant totem bursts up; ancestral spirits circle it; for 7 s it heals allies
// within 12 m and lightning leaps from its crown to every enemy within 12 m; then it cracks and sinks
export const SPIRIT = { r: 12, dur: 7, heal: 0.1, dmg: 0.06 };
export function shamanSpirit(caster, at) { if (at && at.pos) at = at.pos; at = at || caster.pos; const T = Object.assign({}, SPIRIT, G.spiritTune || {}), me = caster === G.player ? G.player : null, base = ultGround(at), C = new THREE.Vector3(at.x, base, at.z);
  const big = makeTotem(3.2, '#a8e8ff'); big.position.copy(C).setY(base - 6); G.scene.add(big); const crown = () => C.clone().setY(big.position.y + 3.2 * 2.0);
  const ring = new THREE.Mesh(new THREE.RingGeometry(T.r - 0.2, T.r, 72), new THREE.MeshBasicMaterial({ color: '#a8e8ff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.set(C.x, base + 0.07, C.z); G.scene.add(ring);
  const spirits = []; for (let i = 0; i < 3; i++) { const s2 = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshBasicMaterial({ color: ['#a8e8ff', '#d8ffb0', '#ffe0a0'][i], transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })); G.scene.add(s2); spirits.push(s2); }
  if (me) { me.ultPoseT = 1.8; me.ultImmT = Math.max(me.ultImmT || 0, 2.4); me.held = true; ultFlyCam(me, () => C.clone().setY(base + 3), () => 1.6, { r: 16, h: 7 }); setTimeout(() => { me.held = false; }, 2600); }
  V.burst('dust', C.clone().setY(base + 0.5), 70, { speed: 8 }); V.burst('stone', C.clone().setY(base + 0.4), 40, { speed: 7, grav: 14 }); V.addShake(0.7); S.explode && S.explode(C, 0.8); S.cast && S.cast('frost', C, 1.6);
  let t = 0, pulse = 0.6;
  G.timers.push({ update: (dt) => { t += dt;
    const rise = Math.min(1, t / 0.7), sink = Math.max(0, (t - T.dur) / 1.0); big.position.y = base - 6 + 6 * rise * rise * (3 - 2 * rise) - sink * 7; big.rotation.y = Math.sin(t * 0.4) * 0.05; big.userData.band.position.y = 0.05 + ((t * 0.6) % 1) * 2.2; big.userData.glowMat.opacity = 0.5 + Math.sin(t * 5) * 0.3;
    ring.material.opacity = (0.5 + Math.sin(t * 3) * 0.2) * Math.min(1, t / 0.7) * (1 - Math.min(1, sink));
    spirits.forEach((s2, i) => { const a = t * (1.6 + i * 0.3) + i * 2.1, rr = 3 + i * 1.2; s2.position.set(C.x + Math.cos(a) * rr, base + 2 + Math.sin(t * 2 + i) * 1.2 + i, C.z + Math.sin(a) * rr); s2.material.opacity = 0.8 * (1 - Math.min(1, sink)); if (Math.random() < 0.6) V.emit(i === 0 ? 'frost' : i === 1 ? 'leaf' : 'gold', s2.position, { speed: 0.3, size: 0.4, life: 0.6 }); });
    pulse -= dt; if (pulse <= 0 && t < T.dur) { pulse = 1; const cr = crown(); V.ring(C.clone().setY(base + 0.15), T.r * 2, '#a8e8ff', 0.7); S.thunder ? S.thunder(cr) : S.explode && S.explode(cr, 0.3);
      for (const u of ultFriends(caster)) if (Math.hypot(u.pos.x - C.x, u.pos.z - C.z) < T.r) { ultHeal(u, T.heal); healBeam(cr, u.pos.clone().setY(u.pos.y + 1.1), 'water'); }
      for (const u of ultFoes(caster)) if (Math.hypot(u.pos.x - C.x, u.pos.z - C.z) < T.r) { boltFx(cr, u.pos.clone().setY(u.pos.y + 1.1), '#cfe8ff'); ultHurt(u, T.dmg, caster, 'lightning'); ultSlow(u, 0.6, 0.6); } }
    if (t > T.dur + 1.1) { G.scene.remove(big, ring); for (const s2 of spirits) G.scene.remove(s2); return true; } return false; } });
  return true;
}

// the wizard's Arcane Shield: a faint violet oval shell round the body while alive() says it holds; it flares where it is hit
// (u.arcHitT) and shatters into motes when it ends
G.hooks.arcShieldFx = (u, alive) => arcShieldFx(u, alive);
export function arcShieldFx(u, alive) { const mat = new THREE.MeshBasicMaterial({ color: '#8a3cff', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }), rim = new THREE.MeshBasicMaterial({ color: '#7a40e0', transparent: true, opacity: 0, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending, wireframe: true });
  const g = new THREE.SphereGeometry(1, 28, 20), shell = new THREE.Mesh(g, mat), wire = new THREE.Mesh(new THREE.IcosahedronGeometry(1.02, 2), rim); G.scene.add(shell, wire); let t = 0, end = -1;
  V.burst('arcane', u.pos.clone().setY(u.pos.y + 1.1), 40, { speed: 3.5, radius: 1.1 }); S.cast && S.cast('arcane', u.pos, 1.0);
  G.timers.push({ update: (dt) => { t += dt; const on = end < 0 && alive() && !u.dead; if (!on && end < 0) { end = t; V.burst('arcane', u.pos.clone().setY(u.pos.y + 1.1), 46, { speed: 5, radius: 1.0 }); V.burst('void', u.pos.clone().setY(u.pos.y + 1.1), 20, { normal: true, speed: 4, size: 0.4 }); S.cast && S.cast('arcane', u.pos, 0.6); }
    const k = end < 0 ? Math.min(1, t * 5) : Math.max(0, 1 - (t - end) * 5), hit = Math.max(0, 1 - (G.time - (u.arcHitT || -9)) * 4), lift = (u.hoverH || 0) && u !== G.player ? u.hoverH : 0;
    const c = u.pos.clone(); c.y += 1.15 + lift; shell.position.copy(c); wire.position.copy(c); const pul = 1 + Math.sin(t * 5) * 0.025 + hit * 0.06; shell.scale.set(0.85 * pul, 1.4 * pul, 0.85 * pul); wire.scale.copy(shell.scale); wire.rotation.y = t * 0.6;
    mat.opacity = (0.13 + hit * 0.12) * k; rim.opacity = (0.05 + hit * 0.18) * k; const hidden = u === G.player && u.camDist < 0.6; shell.visible = wire.visible = !hidden; /* (first person: you would be inside it; the screen tint shows it instead) */
    if (end >= 0 && t - end > 0.25) { G.scene.remove(shell, wire); g.dispose(); wire.geometry.dispose(); mat.dispose(); rim.dispose(); return true; } return false; } });
}

// the wizard's ultimate: Arcane Ascension. For 10 s he rises about his own height off the ground and hovers on a glowing purple
// platform of runes: he glides (no running), can't dodge or jump, moves and casts faster, and every bolt he throws explodes
const ASC_H = 1.8, ASC_DUR = 10;
let ascTex = null;
function ascRuneTex() { if (ascTex) return ascTex; const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), m = 128;
  const g = x.createRadialGradient(m, m, 10, m, m, m); g.addColorStop(0, 'rgba(230,190,255,0.95)'); g.addColorStop(0.45, 'rgba(150,60,255,0.55)'); g.addColorStop(0.8, 'rgba(110,20,230,0.35)'); g.addColorStop(1, 'rgba(80,0,200,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = 'rgba(245,225,255,0.95)'; x.lineWidth = 5; x.beginPath(); x.arc(m, m, 104, 0, Math.PI * 2); x.stroke(); x.lineWidth = 2.5; x.beginPath(); x.arc(m, m, 86, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.arc(m, m, 46, 0, Math.PI * 2); x.stroke();
  x.lineWidth = 3; x.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 - Math.PI / 2, a2 = a + Math.PI * 2 / 3; x.moveTo(m + Math.cos(a) * 86, m + Math.sin(a) * 86); x.lineTo(m + Math.cos(a2) * 86, m + Math.sin(a2) * 86); } x.stroke(); /* (a six-point star) */
  x.font = 'bold 15px serif'; x.fillStyle = 'rgba(250,235,255,0.95)'; x.textAlign = 'center'; x.textBaseline = 'middle'; const R = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊ'; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; x.save(); x.translate(m + Math.cos(a) * 95, m + Math.sin(a) * 95); x.rotate(a + Math.PI / 2); x.fillText(R[i], 0, 0); x.restore(); }
  ascTex = new THREE.CanvasTexture(c); ascTex.colorSpace = THREE.SRGBColorSpace; return ascTex; }
export function wizardTranscend(caster) { const me = caster === G.player ? G.player : null, dur = ASC_DUR; caster.transcendT = dur; caster.hoverH = 0;
  ultImpact(caster.pos, { r: 5, col: '#9a40ff', colCol: '#e4c8ff', dust: '#b080ff', debris: 'arcane', spark: 'arcane', flash: '#f0e0ff', scorch: false, shake: 0.7, vol: 0.8, colH: 18 }); /* (power floods into him: a burst of violet light round his feet as he lifts) */
  const mk = (r, op) => new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshBasicMaterial({ map: ascRuneTex(), color: '#ffffff', transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  const disc = mk(0.85, 0), halo = mk(1.25, 0), under = new THREE.Mesh(new THREE.CircleGeometry(0.8, 40), new THREE.MeshBasicMaterial({ color: '#6a10e0', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })); /* (a solid violet slab under the runes, so it reads as something he stands on) */
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.2, 1, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#5a14c0', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })); /* (a faint cone of light down to the ground) */
  for (const o of [disc, halo, under]) o.rotation.x = -Math.PI / 2; disc.renderOrder = 3; halo.renderOrder = 2; G.scene.add(under, disc, halo, beam);
  const lt = new THREE.PointLight('#a050ff', 0, 7, 2); G.scene.add(lt);
  const ch = me ? me.ch : caster.model; const glowM = []; if (ch && ch.root) ch.root.traverse(o => { if (o.isMesh && o.material && o.material.emissive && !o.userData.outline) { glowM.push([o.material, o.material.emissive.clone(), o.material.emissiveIntensity]); } });
  if (me) { me.ultPoseT = 1.2; me.ultImmT = Math.max(me.ultImmT || 0, 1.0); me.tpT = Math.max(me.tpT || 0, 1.6); me.tpDist = 4; me.dodge = null; }
  V.burst('void', caster.pos.clone().setY(caster.pos.y + 0.3), 50, { normal: true, speed: 5, size: 0.5, life: 0.7 }); V.burst('arcane', caster.pos.clone().setY(caster.pos.y + 1), 70, { speed: 6 }); V.light(caster.pos.clone().setY(caster.pos.y + 1.5), '#b060ff', 10, 0.8, 20); S.cast && S.cast('arcane', caster.pos, 1.8); V.addShake(0.35);
  let t = 0; G.timers.push({ update: (dt) => { t += dt; caster.transcendT = Math.max(0, dur - t);
    const up = Math.min(1, t / 0.9), down = Math.min(1, Math.max(0, dur - t) / 0.7), ez = (u) => u * u * (3 - 2 * u), k = Math.min(ez(up), ez(down));
    caster.hoverH = ASC_H * k; if (ch) ch.hoverStill = caster.hoverH > 0.15; /* (the player's own physics holds him at this height: player.js; a computer wizard's body is lifted below) */
    const bob = Math.sin(t * 2.2) * 0.07 * k; if (ch && ch.root) ch.root.position.y += bob + (me ? 0 : caster.hoverH);
    const p = caster.pos, fy = me ? p.y + bob : p.y + caster.hoverH + bob, gy = fy - caster.hoverH; /* (his feet, and the ground below them) */
    under.position.set(p.x, fy - 0.03, p.z); disc.position.set(p.x, fy + 0.01, p.z); halo.position.set(p.x, fy - 0.01, p.z);
    disc.rotation.z = t * 0.9; halo.rotation.z = -t * 0.5; const pul = 1 + Math.sin(t * 6) * 0.04; disc.scale.setScalar(pul); halo.scale.setScalar(1 + Math.sin(t * 3.1) * 0.06);
    disc.material.opacity = 0.95 * k; halo.material.opacity = 0.35 * k; under.material.opacity = 0.55 * k;
    const bh = Math.max(0.05, fy - gy); beam.scale.set(1, bh, 1); beam.position.set(p.x, gy + bh / 2, p.z); beam.material.opacity = 0.35 * k;
    lt.position.set(p.x, fy + 0.2, p.z); lt.intensity = 3.5 * k;
    for (const [m] of glowM) { m.emissive.setRGB(0.3 * k, 0.08 * k, 0.55 * k); m.emissiveIntensity = 0.6; }
    if (Math.random() < 0.9 * k) { const a = Math.random() * Math.PI * 2, r = 0.3 + Math.random() * 0.6; V.emit(Math.random() < 0.6 ? 'arcane' : 'void', new THREE.Vector3(p.x + Math.cos(a) * r, fy - 0.05, p.z + Math.sin(a) * r), { speed: 0.3, vy: -1.6, size: 0.16, life: 0.7 }); } /* (motes drip from the platform) */
    if (Math.random() < 0.35 * k) { const a = Math.random() * Math.PI * 2; V.emit('arcane', new THREE.Vector3(p.x + Math.cos(a) * 0.85, fy + 0.05, p.z + Math.sin(a) * 0.85), { speed: 0.2, vy: 1.4, size: 0.12, life: 0.5 }); }
    if (t > dur) { G.scene.remove(under, disc, halo, beam, lt); for (const o of [under, disc, halo, beam]) { o.geometry.dispose(); o.material.dispose(); } for (const [m, e0, ei] of glowM) { m.emissive.copy(e0); m.emissiveIntensity = ei; } caster.transcendT = 0; caster.hoverH = 0; if (ch) ch.hoverStill = false; return true; } return false; } });
  return true;
}

// the musketeer's ultimate: Arcane Barrage. A glowing ball of raw magic rammed down the barrel; for 10 s the rifle crackles
// and fires a stream of arcane rounds as fast as the trigger is held (players hold left click; computer musketeers fire at their target)
export function musketBarrage(caster) { const me = caster === G.player ? G.player : null, dur = 10; caster.barrageT = dur; ultImpact(caster.pos, { r: 5, col: '#a080ff', colCol: '#e0d0ff', dust: '#8060c0', debris: 'arcane', spark: 'arcane', flash: '#f0e8ff', scorch: false, shake: 0.7, vol: 0.7, colH: 14 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), new THREE.MeshBasicMaterial({ color: '#c8b0ff' })), halo = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), new THREE.MeshBasicMaterial({ color: '#9a7aff', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })); ball.add(halo); G.scene.add(ball);
  const muzzle = () => me ? (me.camDist < 0.6 ? G.camera.position.clone().add(new THREE.Vector3(0.12, -0.12, -0.9).applyQuaternion(G.camera.quaternion)) : me.handPos ? me.handPos() : me.pos.clone().setY(me.pos.y + 1.4)) : caster.pos.clone().setY(caster.pos.y + 1.4).addScaledVector(new THREE.Vector3(Math.sin(caster.yaw || 0), 0, Math.cos(caster.yaw || 0)), 0.8);
  S.cast && S.cast('arcane', caster.pos, 1.4); let t = 0;
  G.timers.push({ update: (dt) => { t += dt; const mz = muzzle();
    if (t < 0.6) { const k = t / 0.6; ball.position.copy(mz).add(new THREE.Vector3(0, 0.6 * (1 - k), 0)); ball.scale.setScalar(1 - k * 0.5); halo.material.opacity = 0.5 + Math.sin(t * 30) * 0.2; if (t > 0.55) { V.burst('arcane', mz, 30, { speed: 3 }); V.sphereFlash(mz, 0.6, '#c8b0ff', 0.2); S.hit && S.hit('metal', mz, 0.6); } } // (rammed home)
    else ball.visible = false;
    if (t > 0.6 && Math.random() < 0.5) V.emit(Math.random() < 0.5 ? 'arcane' : 'lightning', mz, { speed: 0.6, size: 0.18, life: 0.25 }); // (the barrel crackles)
    if (t > dur) { G.scene.remove(ball); caster.barrageT = 0; return true; } return false; } });
  return true;
}

// ---------- the rest of the ultimates, in one table: { cls, id, name, t, aim, desc, run(caster, at|target) } ----------
// aim: 'ground' (where you aim), 'self' (around you), 'foe' (the enemy you aim at). Players, computer fighters and the
// Training Yard all go through the same entries.
const uH = (u) => (u === G.player ? (u.eye || 1.6) / 0.9 : u.height || 1.8); // (how tall someone stands: heroes are about twice human height)
const nearOf = (list, p, r) => list.filter(u => Math.hypot(u.pos.x - p.x, u.pos.z - p.z) < r);
const glowM = (c, o = 0.6) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
const timer = (fn) => { let t = 0; G.timers.push({ update: (dt) => { t += dt; return fn(t, dt); } }); };
const later = (sec, fn) => timer((t) => { if (t >= sec) { fn(); return true; } return false; }); // (on the game clock, not the wall clock)
// one big landing for an ultimate, so every ultimate reads from across the map: a white-hot flash, a shock ring racing out
// over the ground, a wall of dust behind it, a short column of light, flying debris, a scorch left behind, a boom, and a
// shake that is strongest near it. o: { r: radius, col, dust, debris (particle kind), column, shake, vol, scorch, base }
const IMP_RING = new THREE.RingGeometry(0.82, 1, 72), IMP_WALL = new THREE.CylinderGeometry(1, 1, 1, 48, 1, true), IMP_COL = new THREE.CylinderGeometry(0.75, 1, 1, 28, 1, true), IMP_DISC = new THREE.CircleGeometry(1, 40);
export function ultImpact(at, o = {}) { const R = o.r || 6, col = o.col || '#ffb040', base = o.base != null ? o.base : ultGround(at), C = new THREE.Vector3(at.x, base, at.z), cam0 = G.camera ? G.camera.position : null, near = cam0 ? Math.max(0, Math.min(1, (Math.hypot(cam0.x - C.x, cam0.z - C.z) - R * 0.35 - 3) / 8)) : 1; /* (near: 0 when the camera is right by it, e.g. an ultimate round your own feet: then no light column or big flash to white out the screen) */
  const ring = new THREE.Mesh(IMP_RING, glowM(col, 0.95)); ring.rotation.x = -Math.PI / 2; ring.position.set(C.x, base + 0.14, C.z); ring.renderOrder = 12;
  V.temp(ring, 0.6, (m, t) => { const e = 1 - Math.pow(1 - t, 3); m.scale.setScalar(0.4 + R * 1.3 * e); m.material.opacity = 0.95 * (1 - t) * (1 - t); if (t >= 0.98) m.material.dispose(); });
  const ring2 = new THREE.Mesh(IMP_RING, glowM('#ffffff', 0.7)); ring2.rotation.x = -Math.PI / 2; ring2.position.set(C.x, base + 0.16, C.z);
  V.temp(ring2, 0.35, (m, t) => { const e = 1 - Math.pow(1 - t, 2); m.scale.setScalar(0.3 + R * 0.7 * e); m.material.opacity = 0.7 * (1 - t); if (t >= 0.98) m.material.dispose(); });
  const wall = new THREE.Mesh(IMP_WALL, glowM(o.dust || '#e8d8b0', 0.4)); wall.position.set(C.x, base, C.z);
  V.temp(wall, 0.8, (m, t) => { const e = 1 - Math.pow(1 - t, 2.4), hh = Math.max(0.05, (o.wallH || 1.6) * (1 - t)); m.scale.set(0.5 + R * 1.1 * e, hh, 0.5 + R * 1.1 * e); m.position.y = base + hh / 2; m.material.opacity = 0.4 * (0.35 + 0.65 * near) * (1 - t); if (t >= 0.98) m.material.dispose(); });
  if (o.column !== false && near > 0.05) { const cm = new THREE.Mesh(IMP_COL, glowM(o.colCol || col, 0.75)); const H = o.colH || 18; cm.position.set(C.x, base + H / 2, C.z);
    V.temp(cm, 0.5, (m, t) => { const w = R * 0.32 * (1 - t * 0.8); m.scale.set(w, H * (0.6 + t * 0.6), w); m.position.y = base + m.scale.y / 2; m.material.opacity = 0.75 * near * (1 - t) * (1 - t); if (t >= 0.98) m.material.dispose(); }); }
  if (!o.noFlash) { if (near > 0.05) V.sphereFlash(C.clone().setY(base + 0.8), R * 0.5 * near, o.flash || '#fff2c8', 0.3); V.light(C.clone().setY(base + 2.5), col, 16, 0.7, R * 6); }
  V.burst(o.debris || 'stone', C.clone().setY(base + 0.3), 55, { speed: 6 + R, grav: 16, size: 0.35 }); V.burst('dust', C.clone().setY(base + 0.4), 70, { speed: R * 1.3, size: 1.2, life: 1.2 }); if (o.sparks !== false) V.burst(o.spark || 'spark', C.clone().setY(base + 0.8), 60, { speed: 12 + R });
  if (o.scorch !== false) { const sc = new THREE.Mesh(IMP_DISC, new THREE.MeshBasicMaterial({ color: o.scorchCol || '#120a04', transparent: true, opacity: 0.75, depthWrite: false })); sc.rotation.x = -Math.PI / 2; sc.position.set(C.x, base + 0.05, C.z); sc.scale.setScalar(R * 0.55);
    V.temp(sc, o.scorchT || 4, (m, t) => { m.material.opacity = 0.75 * Math.min(1, (1 - t) * 3); if (t >= 0.98) m.material.dispose(); }); }
  const cp = G.camera ? G.camera.position : C, d = Math.hypot(cp.x - C.x, cp.z - C.z); V.addShake((o.shake || 1) * Math.max(0.25, 1 - d / 45)); if (o.vol !== 0) S.explode && S.explode(C, o.vol || 1);
  return C; }
const lob = (from, to, mesh, dur, arc, onLand) => { G.scene.add(mesh); timer((t) => { const k = Math.min(1, t / dur); mesh.position.lerpVectors(from, to, k); mesh.position.y += Math.sin(k * Math.PI) * arc; mesh.rotation.x += 0.2; if (k >= 1) { onLand && onLand(); return true; } return false; }); };
export const ULTS = {
  warrior: { id: 'ar_banner', name: 'War Banner of Defense', t: 'banner', aim: 'self', desc: 'Drive a huge war banner bearing a shield into the ground where you aim (up to 10 m away): for 8 s a ring of protection surrounds it, and every ally within 10 m takes 40% less damage.',
    run(c) { const p = c.pos.clone(), yw = c.yaw || 0, C0 = bannerSpot(c, 10, 5.5), /* (where you aim, up to the dome's edge) */ base = ultGround(C0), C = new THREE.Vector3(C0.x, base, C0.z), me = c === G.player ? c : null; const g = new THREE.Group(); /* (planted 5.5 m in front, where you and your camera can see it, not beside your head) */
      if (me) { me.ultPoseT = 0; } /* (the owner: no lock, he keeps moving and fighting while the banner drops) */ /* (the owner: no camera fly-out (it flickered); the camera stays behind you while the banner crashes down ahead, and you are free again as it lands) */ /* (the camera swings out to watch it crash down and the shockwave roll over the enemies) */ const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 6, 10), new THREE.MeshStandardMaterial({ color: '#4a2e18', roughness: 0.8 })); pole.position.y = 3; g.add(pole);
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.6, 8, 8), new THREE.MeshStandardMaterial({ map: flagTex('shield'), alphaTest: 0.5, transparent: true, roughness: 0.8, side: THREE.DoubleSide })); bannerFittings(g, 5.75, 2.0, 1.05); /* (a shield on the flag: this banner is pure defence) */ cloth.position.set(1.05, 4.4, 0); g.add(cloth); const trim = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.12), new THREE.MeshStandardMaterial({ color: '#d8a838', metalness: 0.8, roughness: 0.3 })); trim.position.set(1.05, 5.75, 0); g.add(trim);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.55, 8), trim.material); tip.position.y = 6.25; g.add(tip); const dome = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), glowM('#ffcf70', 0)); let regT = 0; /* (no dome any more: the owner, it made the screen flicker) */ const aura = new THREE.Mesh(new THREE.RingGeometry(9.7, 10, 64), glowM('#ffb040', 0)); aura.rotation.x = -Math.PI / 2; aura.position.y = 0.04; aura.scale.setScalar(1); aura.visible = false; g.add(aura); /* (the owner: no ring round the War Banner; the slam stays) */ useBannerModel(g, 'shield', 5, [aura]); /* (the owner: 5 m tall over a ring 20 m across (10 m round it, as far as it protects): a quarter as tall as the ring is wide) */
      g.position.copy(C).setY(base + 22); g.rotation.y = yw; G.scene.add(g); const pos0 = cloth.geometry.attributes.position.array.slice(); g.scale.setScalar(1.0); /* (half the size it was) */ /* (hero-sized: twice the old banner, its flag flying out to the side, broadside to you) */
      timer((t) => { bannerFade(g); if (t < 0.55) { const f = t / 0.55; g.position.y = base + 22 * (1 - f * f); V.emit('gold', g.position.clone().setY(g.position.y + 6.5), { speed: 0.5, size: 0.6, life: 0.35 }); V.emit('fire', g.position.clone().setY(g.position.y + 1), { speed: 0.6, size: 0.7, life: 0.3 }); return false; } /* (it falls out of the sky like a comet, trailing gold) */
        if (!g.userData.hit) { g.userData.hit = true; g.position.y = base; ultImpact(C, { r: 7, col: '#ffc050', colCol: '#fff0b0', shake: 1.4, vol: 1.2, wallH: 2.2, column: false, noFlash: true }); /* (no flash or light pillar: no flicker) */ later(0.12, () => ultImpact(C, { r: 10, col: '#ff9a30', column: false, scorch: false, sparks: false, shake: 0.5, vol: 0, noFlash: true })); bannerSlam(C, 1.5); S.battleCry && S.battleCry();
          }
        const a = cloth.geometry.attributes.position; for (let i = 0; i < a.count; i++) { const x = pos0[i * 3]; a.array[i * 3 + 2] = Math.sin(t * 5 + x * 3) * 0.15 * (x + 1); } a.needsUpdate = true; aura.material.opacity = 0.45 + Math.sin(t * 3) * 0.15;
         /* (seen from inside or near its skin the dome fills the screen, and its pulse read as a flicker: it fades right down there) */ regT -= 1 / 60; const reg = regT <= 0; if (reg) regT = 0.5;
        for (const u of nearOf(ultFriends(c), C, 10)) { u.defBannerT = G.time + 0.4; if (Math.random() < 0.05) V.emit('gold', u.pos.clone().setY(u.pos.y + 1.8), { speed: 0.3, vy: 1, size: 0.25 }); }
        if (Math.random() < 0.4) V.emit('fire', C.clone().setY(base + 6.3), { speed: 0.4, vy: 1.5, size: 0.4, life: 0.5 });
        const LB = 8.3 * (1 + 0.2 * Game.arenaPassive(c.h, 'bannerLong')); if (t > LB) { const k = Math.min(1, (t - LB) / 0.6); /* (Lasting Banners) */ g.scale.setScalar(1 - k + 0.01); if (k >= 1) { G.scene.remove(g); return true; } } return false; }); } },
  darkknight: { id: 'ar_grasp', name: "Death's Grasp", t: 'grasp', aim: 'ground', desc: 'A pool of shadow tears open where you aim: chains of darkness burst out, seize every enemy within 6 m, drag them to your feet and drain a quarter of their health, which heals you.',
    run(c, at) { const base = ultGround(at), C = new THREE.Vector3(at.x, base, at.z); const pool = new THREE.Mesh(new THREE.CircleGeometry(6, 48), new THREE.MeshBasicMaterial({ color: '#0a0012', transparent: true, opacity: 0, depthWrite: false })); pool.rotation.x = -Math.PI / 2; pool.position.set(C.x, base + 0.05, C.z); G.scene.add(pool);
      const rims = [[5.55, 6, 0.9], [3.6, 3.8, 0.55], [1.6, 1.75, 0.7]].map(([a, b, o]) => { const m = new THREE.Mesh(new THREE.RingGeometry(a, b, 64, 1), glowM('#a848ff', 0)); m.rotation.x = -Math.PI / 2; m.position.set(C.x, base + 0.08, C.z); m.userData.o = o; G.scene.add(m); return m; }); /* (glowing rims and rings, so the pool reads as a gate of shadow, not a dark patch on the grass) */
      ultImpact(C, { r: 6, col: '#9a40ff', colCol: '#c070ff', dust: '#40105a', debris: 'shadow', spark: 'arcane', flash: '#e0b0ff', scorchCol: '#16021f', shake: 1.1, vol: 0.8, colH: 14 });
      if (c === G.player) { c.held = true; ultFlyCam(c, () => C.clone().lerp(c.pos, 0.45).setY(base + 1.4), () => 1.9, { r: 11, h: 4.2, inT: 0.7 }); later(2.2, () => { c.held = false; }); } /* (the camera pulls out to show the pool, the chains and the victims dragged in) */
      const caught = nearOf(ultFoes(c), C, 6); const chains = caught.map(() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1, 8), glowM('#a040ff', 0.95)); m.add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1, 6), glowM('#ffe8ff', 0.9))); G.scene.add(m); return m; }); const from = caught.map(u => u.pos.clone()); caught.forEach(u => { u.held = true; if (u === G.player) { u.debuff && u.debuff('freeze', 1.6); ultVictimCine(u, () => c.pos.clone().setY(c.pos.y + 1.2), 2.2); } else if (u.status) { u.status.stun = 1.8; u.cast = null; } });
      if (c === G.player) { c.ultPoseT = 1.6; c.ultImmT = 2; } S.cast && S.cast('shadow', C, 1.5); V.burst('shadow', C.clone().setY(base + 0.5), 60, { speed: 5 });
      timer((t) => { pool.material.opacity = 0.8 * Math.min(1, t / 0.3) * Math.max(0, 1 - Math.max(0, (t - 2.2) / 0.5)); rims.forEach((m, i) => { m.material.opacity = m.userData.o * Math.min(1, t / 0.25) * Math.max(0, 1 - Math.max(0, (t - 2.2) / 0.5)); m.rotation.z = t * (i % 2 ? -1.6 : 1.1); }); if (t < 1.6 && Math.random() < 0.85) { const a = Math.random() * 6.28, rr = Math.random() * 5.5; V.emit(Math.random() < 0.5 ? 'shadow' : 'arcane', new THREE.Vector3(C.x + Math.cos(a) * rr, base + 0.2, C.z + Math.sin(a) * rr), { speed: 0.6, vy: 5, size: 0.6, life: 0.7 }); } /* (shadow tendrils boil up out of the pool) */ const pull = Math.max(0, Math.min(1, (t - 0.4) / 0.9)), e = pull * pull * (3 - 2 * pull);
        caught.forEach((u, i) => { if (u.dead) return; const tgt = c.pos.clone().addScaledVector(new THREE.Vector3(from[i].x - c.pos.x, 0, from[i].z - c.pos.z).normalize(), 1.4); const p2 = from[i].clone().lerp(tgt, e); u.pos.copy(p2); if (u.root) u.root.position.copy(p2);
          const a = c.pos.clone().setY(c.pos.y + uH(c) * 0.55), b = u.pos.clone().setY(u.pos.y + uH(u) * 0.5), m = chains[i]; /* (hand to chest, whatever their size) */ m.position.copy(a).lerp(b, 0.5); m.scale.y = a.distanceTo(b); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); m.material.opacity = 0.9 * (t < 1.7 ? 1 : 0); if (Math.random() < 0.4) V.emit('shadow', b, { speed: 1, size: 0.3 }); });
        if (t >= 1.4 && !pool.userData.drained) { pool.userData.drained = true; let tot = 0; ultImpact(c.pos, { r: 4.5, col: '#c060ff', dust: '#40105a', debris: 'shadow', spark: 'arcane', column: false, scorch: false, shake: 0.8, vol: 0.7 }); caught.forEach(u => { if (!u.dead) V.burst('blood', u.pos.clone().setY(u.pos.y + 1.2), 30, { speed: 5 }); }); caught.forEach(u => { if (u.dead) return; ultHurt(u, 0.25, c, 'shadow'); tot += 0.25 * (u.maxHp || 1000); healBeam(u.pos.clone().setY(u.pos.y + 1.1), c.pos.clone().setY(c.pos.y + 1.1), 'nature'); }); if (tot) { if (c === G.player) c.heal && c.heal(tot * 0.5); else c.hp = Math.min(c.maxHp, c.hp + tot * 0.5); } }
        if (t > 1.8) caught.forEach(u => { u.held = false; }); if (t > 2.8) { G.scene.remove(pool, ...rims); chains.forEach(m => G.scene.remove(m)); caught.forEach(u => { u.held = false; }); return true; } return false; }); } },
  bard: { id: 'ar_finale', name: 'Grand Finale', t: 'finale', aim: 'self', desc: 'Play a soaring solo under a spotlight for 6 s: every ally within 15 m moves 30% faster and heals 40% of their health over the song, and every enemy within 10 m is mesmerised for the first 2.5 s.',
    run(c) { const p = () => c.pos; const spot = new THREE.Mesh(new THREE.ConeGeometry(2.2, 14, 32, 1, true), glowM('#fff0c0', 0)); G.scene.add(spot); const ring = new THREE.Mesh(new THREE.RingGeometry(14.7, 15, 72), glowM('#ff9ae0', 0)); ring.rotation.x = -Math.PI / 2; G.scene.add(ring);
      for (const u of nearOf(ultFoes(c), p(), 10)) { if (u === G.player) u.debuff && u.debuff('freeze', 2.5); else if (u.status) { u.status.stun = 2.5; u.status.mez = true; u.cast = null; } playNotes(G.scene, u, '#ff9ae0', 6); } if (c === G.player) { c.ultPoseT = 1.2; c.ultImmT = 1.5; } S.cast && S.cast('holy', p(), 1.4);
      let nt = 0; timer((t, dt) => { const k = Math.min(1, t / 0.4) * Math.min(1, (6 - t) / 0.5); spot.position.copy(p()).setY(p().y + 7); spot.material.opacity = 0.12 * k; ring.position.copy(p()).setY(ultGround(p()) + 0.07); ring.material.opacity = 0.5 * k; nt -= dt;
        if (nt <= 0 && t < 6) { nt = 0.5; V.ring(p().clone().setY(p().y + 0.6), 20, '#ffb0f0', 0.8); playNotes(G.scene, c, ['#ffd860', '#ff9ae0', '#9ae0ff'][Math.floor(Math.random() * 3)], 3); for (const u of nearOf(ultFriends(c), p(), 15)) { ultHeal(u, 0.4 / 12); ultSlow(u, 1.3, 0.6); } }
        if (t > 6) { G.scene.remove(spot, ring); return true; } return false; }); } },
  blunderbuss: { id: 'ar_kegs', name: 'Powder Keg Barrage', t: 'kegs', aim: 'ground', desc: 'Lob five huge powder kegs across where you aim: they bounce, fizz, and go up one after another, each blast throwing enemies within 4 m (15% of their health each).',
    run(c, at) { const base = ultGround(at); if (c === G.player) { c.ultPoseT = 0.8; c.ultImmT = Math.max(c.ultImmT || 0, 1.5); ultFlyCam(c, () => new THREE.Vector3(at.x, base + 1.2, at.z), () => 2.9, { r: 12, h: 5, delay: 0.25, inT: 0.8 }); } /* (the camera follows the kegs out and watches them go up) */ for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + 0.3, rr = i === 0 ? 0 : 3.5, to = new THREE.Vector3(at.x + Math.cos(a) * rr, base + 0.4, at.z + Math.sin(a) * rr);
        const keg = new THREE.Group(); keg.add(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.85, 12), new THREE.MeshStandardMaterial({ color: '#7a4a22', roughness: 0.8 }))); for (const y of [-0.28, 0.28]) { const b = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.03, 6, 16), new THREE.MeshStandardMaterial({ color: '#2a2a2a', metalness: 0.8 })); b.rotation.x = Math.PI / 2; b.position.y = y; keg.add(b); } { const fz = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), glowM('#ffd060', 1)); fz.position.y = 0.55; keg.add(fz); } keg.scale.setScalar(1.1); /* (kegs with a burning fuse you can follow through the air) */
        later(i * 0.15, () => lob(c.pos.clone().setY(c.pos.y + uH(c) * 0.75).addScaledVector(new THREE.Vector3(to.x - c.pos.x, 0, to.z - c.pos.z).normalize(), 2.2), to, keg, 0.7, 5 + uH(c) * 0.3, /* (thrown from over his shoulder, out in front: never past the camera's nose) */ () => { V.burst('dust', to, 10, { speed: 2 }); timer((t) => { if (Math.random() < 0.7) V.emit('spark', to.clone().setY(to.y + 0.5), { speed: 2, vy: 2, size: 0.15 }); keg.position.y = to.y + Math.abs(Math.sin(t * 12)) * 0.1; if (t > 0.6 + i * 0.25) {
          G.scene.remove(keg); V.burst('fire', to.clone().setY(to.y + 0.6), 140, { speed: 11, size: 1.1 }); V.burst('smoke', to.clone().setY(to.y + 1), 60, { speed: 4, vy: 3, size: 1.6, life: 1.6 }); ultImpact(to, { r: 4.5, col: '#ff7a20', colCol: '#ffc060', flash: '#fff0b0', debris: 'wood', spark: 'ember', shake: 0.9, vol: 1.2, colH: 9, scorchT: 5 }); /* (a real blast: fireball, flash, shock ring, debris, scorch) */
          for (const u of nearOf(ultFoes(c), to, 4)) { ultHurt(u, 0.15, c, 'fire'); const n = new THREE.Vector3(u.pos.x - to.x, 0, u.pos.z - to.z).normalize(); if (u === G.player) u.vel && u.vel.set(n.x * 9, 8, n.z * 9); else if (u.status) { u.status.stun = Math.max(u.status.stun || 0, 0.6); if (u.status.knock) u.status.knock.set(n.x * 9, 0, n.z * 9); } } return true; } return false; }); })); } } },
  elementalist: { id: 'ar_meteors', name: 'Meteor Storm', t: 'meteors', aim: 'ground', desc: 'Tear five burning meteors out of the sky onto where you aim, one after another over 3 s: each impact burns everyone within 4 m for 18% of their health and leaves the ground scorched.',
    run(c, at) { const base = ultGround(at); if (c === G.player) { c.ultPoseT = 2; c.ultImmT = 1.5; ultFlyCam(c, () => new THREE.Vector3(at.x, base + 1.5, at.z), () => 3.4, { r: 14, h: 6.5, delay: 0.2, inT: 0.9 }); } S.cast && S.cast('fire', c.pos, 1.6); /* (the camera rises to watch the meteors come down) */ for (let i = 0; i < 5; i++) { const a = Math.random() * Math.PI * 2, rr = i ? 3 + Math.random() * 3 : 0, to = new THREE.Vector3(at.x + Math.cos(a) * rr, base + 0.6, at.z + Math.sin(a) * rr), from = to.clone().add(new THREE.Vector3(10, 34, -8));
        const met = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 10), new THREE.MeshStandardMaterial({ color: '#3a1a0a', emissive: '#ff5010', emissiveIntensity: 1.3, roughness: 0.6 })); met.add(new THREE.Mesh(new THREE.SphereGeometry(1.4, 14, 10), glowM('#ff8030', 0.45)));
        const mark = new THREE.Mesh(new THREE.RingGeometry(3.7, 4, 48), glowM('#ff4020', 0)); mark.rotation.x = -Math.PI / 2; mark.position.set(to.x, base + 0.07, to.z); G.scene.add(mark);
        later(0.4 + i * 0.6, () => { G.scene.add(met); timer((t) => { const k = Math.min(1, t / 0.9); met.position.lerpVectors(from, to, k * k); mark.material.opacity = 0.7 * k; V.emit('fire', met.position, { speed: 2, size: 1, life: 0.5, radius: 1 }); if (k >= 1) { G.scene.remove(met, mark);
          V.burst('fire', to, 140, { speed: 12 }); V.burst('lava', to, 40, { speed: 8 }); V.burst('smoke', to, 50, { speed: 5, vy: 2, size: 1.4 }); ultImpact(to, { r: 5, col: '#ff6020', colCol: '#ffb040', flash: '#fff0c0', debris: 'stone', spark: 'ember', shake: 1, vol: 0, colH: 12 }); V.light(to, '#ff7030', 14, 0.7, 30); S.explode && S.explode(to, 1.3);
          const sc = new THREE.Mesh(new THREE.CircleGeometry(3, 32), new THREE.MeshBasicMaterial({ color: '#140804', transparent: true, opacity: 0.8, depthWrite: false })); sc.rotation.x = -Math.PI / 2; sc.position.set(to.x, base + 0.04, to.z); G.scene.add(sc); timer((t2) => { sc.material.opacity = 0.8 * Math.max(0, 1 - t2 / 6); if (Math.random() < 0.3) V.emit('ember', to.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, 0.1, (Math.random() - 0.5) * 4)), { speed: 0.4, vy: 1.5, size: 0.3 }); if (t2 > 6) { G.scene.remove(sc); return true; } return false; });
          for (const u of nearOf(ultFoes(c), to, 4)) { ultHurt(u, 0.18, c, 'fire'); if (u.status) u.status.burn = Math.max(u.status.burn || 0, 3); } return true; } return false; }); }); } } },
  enchanter: { id: 'ar_charm', name: 'Mass Charm', t: 'charm', aim: 'ground', desc: 'Hypnotic spirals bloom across 8 m where you aim: every enemy inside is charmed and helpless for 3 s, then their minds shatter for 20% of their health.',
    run(c, at) { const base = ultGround(at), C = new THREE.Vector3(at.x, base, at.z); const spiral = new THREE.Mesh(new THREE.RingGeometry(0.5, 8, 64, 1), glowM('#e070ff', 0)); spiral.rotation.x = -Math.PI / 2; spiral.position.set(C.x, base + 0.06, C.z); G.scene.add(spiral); if (c === G.player) { c.ultPoseT = 1.4; c.ultImmT = 1.5; }
      if (c === G.player) { c.ultImmT = Math.max(c.ultImmT || 0, 1.5); ultFlyCam(c, () => C.clone().setY(base + 1.4), () => 3.3, { r: 12, h: 5, inT: 0.8 }); } /* (watch them fall under the spell, and their minds break) */ const caught = nearOf(ultFoes(c), C, 8); const halos = caught.map(u => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.05, 6, 24), glowM('#ff90f0', 0.9)); G.scene.add(r); if (u === G.player) u.debuff && u.debuff('freeze', 3); else if (u.status) { u.status.stun = 3; u.status.mez = true; u.cast = null; } return r; }); S.cast && S.cast('arcane', C, 1.6);
      timer((t) => { spiral.material.opacity = 0.35 * Math.min(1, t / 0.3) * Math.max(0, 1 - Math.max(0, (t - 3) / 0.4)); spiral.rotation.z = t * 1.5; caught.forEach((u, i) => { halos[i].position.copy(u.pos).setY(u.pos.y + (u.height || 1.8) + 0.3); halos[i].rotation.set(Math.PI / 2, 0, t * 4); if (Math.random() < 0.3) V.emit('arcane', u.pos.clone().setY(u.pos.y + 1.8), { speed: 0.6, size: 0.2 }); });
        if (t >= 3 && !spiral.userData.shattered) { spiral.userData.shattered = true; ultImpact(C, { r: 7, col: '#e070ff', colCol: '#ffb0ff', dust: '#601a70', debris: 'shadow', spark: 'arcane', flash: '#ffe0ff', scorch: false, shake: 1, vol: 0.9 }); caught.forEach((u, i) => { G.scene.remove(halos[i]); if (u.dead) return; const h = u.pos.clone().setY(u.pos.y + 1.7); V.burst('arcane', h, 60, { speed: 7 }); V.sphereFlash(h, 1.8, '#f0b0ff', 0.25); ultHurt(u, 0.2, c, 'arcane'); }); V.addShake(0.5); }
        if (t > 3.5) { G.scene.remove(spiral); halos.forEach(h => G.scene.remove(h)); return true; } return false; }); } },
  beastmaster: { id: 'ar_pack', name: 'Call of the Wild', t: 'pack', aim: 'self', desc: 'Howl, and three spectral dire wolves burst out of the ground around you and run down the nearest enemies within 18 m, mauling them for 5 s (about 4% of their health a second each).',
    run(c) { if (c === G.player) { c.ultPoseT = 1.2; c.ultImmT = 1.2; } S.growl && S.growl('wolf', c.pos, 1); const wolves = []; for (let i = 0; i < 3; i++) { const w = new THREE.Group(), fur = new THREE.MeshStandardMaterial({ color: '#8ab8ff', emissive: '#2a4a9a', emissiveIntensity: 0.8, transparent: true, opacity: 0.85, roughness: 0.6 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 10), fur); body.scale.set(0.7, 0.65, 1.5); body.position.y = 0.95; w.add(body); const head = new THREE.Mesh(new THREE.SphereGeometry(0.33, 10, 8), fur); head.position.set(0, 1.25, 0.95); w.add(head); const sn = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.38), fur); sn.position.set(0, 1.18, 1.3); w.add(sn);
        for (const x of [-0.12, 0.12]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), new THREE.MeshBasicMaterial({ color: '#ffffff' })); e.position.set(x, 1.32, 1.22); w.add(e); const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 4), fur); ear.position.set(x * 1.3, 1.55, 0.9); w.add(ear); }
        const legs = []; for (const [x, z] of [[-0.25, 0.6], [0.25, 0.6], [-0.25, -0.6], [0.25, -0.6]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.8, 6), fur); l.position.set(x, 0.4, z); w.add(l); legs.push(l); }
        const a = i / 3 * Math.PI * 2; w.position.set(c.pos.x + Math.cos(a) * 1.8, ultGround(c.pos), c.pos.z + Math.sin(a) * 1.8); w.scale.setScalar(0.01); G.scene.add(w); V.burst('frost', w.position.clone().setY(w.position.y + 0.8), 30, { speed: 3 }); wolves.push({ w, legs, tgt: null, bite: 0 }); }
      timer((t, dt) => { for (const wo of wolves) { const w = wo.w; w.scale.setScalar(Math.min(1.4, t * 5)); if (!wo.tgt || wo.tgt.dead) { const foes = nearOf(ultFoes(c), c.pos, 18).sort((x, y) => x.pos.distanceTo(w.position) - y.pos.distanceTo(w.position)); wo.tgt = foes[wolves.indexOf(wo) % Math.max(1, foes.length)] || null; wo.base = null; }
          if (wo.tgt) { const d = new THREE.Vector3(wo.tgt.pos.x - w.position.x, 0, wo.tgt.pos.z - w.position.z), L2 = d.length(); w.rotation.y = Math.atan2(d.x, d.z); const reach = 1.5 + (wo.tgt.radius || 0.4) * 0.5; if (wo.base && L2 > reach + 2.5) wo.base = null; /* (the prey moved off: run after it) */ if (L2 > reach && !wo.base) { w.position.addScaledVector(d.normalize(), Math.min(L2 - reach + 0.1, 14 * dt)); const g = Math.sin(t * 14 + wolves.indexOf(wo)); w.position.y = ultGround(w.position) + Math.abs(g) * 0.35; w.rotation.x = g * 0.08; wo.legs.forEach((l, j) => { l.rotation.x = Math.sin(t * 14 + (j < 2 ? 0 : Math.PI) + (j % 2) * 0.5) * 1.0; }); } /* (a bounding gallop: front and back legs in turn, the body rising and falling) */
            else { if (!wo.base) { wo.base = w.position.clone(); wo.bite = 0; } wo.bite -= dt; if (wo.bite <= 0) { wo.bite = 0.6; wo.lunge = 0; } /* (on arrival, and every 0.6 s after: a leap at the throat) */
              wo.lunge = (wo.lunge == null ? 1 : wo.lunge) + dt / 0.34; const lk = Math.min(1, wo.lunge), arc = Math.sin(lk * Math.PI), fw = d.clone().normalize(); if (wo.lunge - dt / 0.34 < 0.45 && lk >= 0.45) { ultHurt(wo.tgt, 0.02, c, 'blood'); V.burst('blood', wo.tgt.pos.clone().setY(wo.tgt.pos.y + 1.4), 14, { speed: 4 }); V.burst('frost', wo.tgt.pos.clone().setY(wo.tgt.pos.y + 1.4), 10, { speed: 3 }); if (S.growl && Math.random() < 0.5) S.growl('wolf', w.position, 0.6); }
              w.position.copy(wo.base).addScaledVector(fw, arc * 1.0); w.position.y = ultGround(w.position) + arc * 0.9; w.rotation.x = -arc * 0.55; wo.legs.forEach((l, j) => { l.rotation.x = (j < 2 ? -1.1 : 0.9) * arc; }); } }
          if (Math.random() < 0.3) V.emit('frost', w.position.clone().setY(w.position.y + 0.9), { speed: 0.3, size: 0.4, life: 0.4 }); }
        if (t > 5) { wolves.forEach(wo => { V.burst('frost', wo.w.position.clone().setY(wo.w.position.y + 0.8), 30, { speed: 3 }); G.scene.remove(wo.w); }); return true; } return false; }); } },
  priest: { id: 'ar_salvation', name: 'Salvation', t: 'salvation', aim: 'self', desc: 'Rise into the air on wings of dawn and open a 14 m dome of light for 6 s: allies inside heal 60% of their health over the 6 s and cannot fall below 1 health for the first 3 s; enemies inside are slowed and scorched by the light. Step out of the dome to escape it.',
    run(c) { const R = 14, D = 6, base = ultGround(c.pos), C = new THREE.Vector3(c.pos.x, base, c.pos.z), me = c === G.player ? c : null;
      const dome = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), glowM('#ffe7a0', 0)); dome.position.copy(C); G.scene.add(dome);
      const wire = new THREE.Mesh(new THREE.SphereGeometry(R * 1.002, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#fff4c8', wireframe: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); wire.position.copy(C); G.scene.add(wire);
      const rim = new THREE.Mesh(new THREE.RingGeometry(R - 0.35, R, 96), glowM('#fff0b0', 0)); rim.rotation.x = -Math.PI / 2; rim.position.set(C.x, base + 0.07, C.z); G.scene.add(rim);
      const sun = new THREE.Mesh(new THREE.SphereGeometry(0.9, 20, 14), glowM('#fff6d0', 0)); G.scene.add(sun);
      const rays = []; for (let i = 0; i < 12; i++) { const r = new THREE.Mesh(new THREE.PlaneGeometry(0.5, R * 1.1), glowM('#ffe28a', 0)); r.userData.a = i / 12 * Math.PI * 2; G.scene.add(r); rays.push(r); }
      const chest = me ? c.ch && c.ch.chest : c.model && c.model.chest, wings = makeWings(); if (chest) { wings.position.set(0, 0.15, -0.18); chest.add(wings); } wings.scale.setScalar(0.01);
      let cam = null; if (me) { me.ultImmT = 2; me.ultPoseT = 2; cam = ultFlyCam(me, () => C.clone().setY(base + 4), () => 3.2, { r: 20, h: 9 }); } else c.invulnT = G.time + 1.5;
      S.cast && S.cast('holy', C, 1.8); V.light(C.clone().setY(base + 6), '#ffe9a0', 16, 1.2, 40); V.sphereFlash(C.clone().setY(base + 2), 4, '#fff0b0', 0.5);
      for (const u of nearOf(ultFriends(c), C, R)) buffUnit(u, 'undying', 3);
      let tk = 0; timer((t, dt) => { const k = Math.min(1, t / 0.6) * Math.min(1, (D - t) / 0.6), lift = Math.min(1, t / 0.8) * Math.min(1, (D - t) / 0.8);
        dome.material.opacity = 0.11 * k; wire.material.opacity = 0.16 * k; rim.material.opacity = 0.8 * k; wings.scale.setScalar(Math.max(0.01, Math.min(1.2, t * 2) * Math.min(1, (D - t) * 2)));
        const body = me ? c.ch && c.ch.body : c.model && c.model.body; if (body) body.position.y = lift * 1.6 + Math.sin(t * 2.2) * 0.08 * lift;
        sun.position.set(c.pos.x, c.pos.y + 4.6 + lift * 1.6, c.pos.z); const camK = Math.max(0, Math.min(1, (G.camera.position.distanceTo(sun.position) - 3) / 6)); sun.material.opacity = 0.85 * k * camK; wings.visible = !me || !!me.cine || camK > 0.5; /* (back in your own eyes: the sun and the wings round your head don't white out the view) */ sun.scale.setScalar(1 + Math.sin(t * 6) * 0.08);
        rays.forEach((r, i) => { const a = r.userData.a + t * 0.4; r.position.set(C.x + Math.cos(a) * R * 0.45, base + R * 0.55, C.z + Math.sin(a) * R * 0.45); r.lookAt(G.camera.position.x, r.position.y, G.camera.position.z); r.rotation.z = Math.sin(a) * 0.4; r.material.opacity = 0.12 * k * (0.6 + 0.4 * Math.sin(t * 3 + i)); });
        if (Math.random() < 0.8) V.emit('gold', C.clone().add(new THREE.Vector3((Math.random() - 0.5) * R * 1.6, 0.2, (Math.random() - 0.5) * R * 1.6)), { speed: 0.5, vy: 3, size: 0.3, life: 1.2 });
        tk -= dt; if (tk <= 0 && t < D) { tk = 0.5;
          for (const u of nearOf(ultFriends(c), C, R)) { ultHeal(u, 0.05); }
          for (const u of nearOf(ultFoes(c), C, R)) { ultHurt(u, 0.02, c, 'holy', true); ultSlow(u, 0.6, 0.7); V.burst('gold', u.pos.clone().setY(u.pos.y + 1.2), 6, { speed: 2 }); } }
        if (me && t > 4.4 && me.cine === cam) me.cine = null;
        if (t > D) { G.scene.remove(dome, wire, rim, sun, ...rays); wings.parent && wings.parent.remove(wings); const body = me ? c.ch && c.ch.body : c.model && c.model.body; if (body) body.position.y = 0; return true; } return false; }); } },
  bombardier: { id: 'ar_bertha', name: 'Big Bertha', t: 'bertha', aim: 'self', desc: `Kneel and plant the biggest bomb a goblin ever built at your feet (${BOMB.ult.plant} s). It beeps for ${BOMB.ult.fuse} s, faster and faster (everyone hears it, louder the closer they are), then goes off: enemies within ${BOMB.ult.core} m take ${Math.round(BOMB.ult.coreK * 100)}% of their health, and out to ${BOMB.ult.r} m it falls off to ${Math.round(BOMB.ult.edgeK * 100)}%; everyone caught is thrown away. Enemies can run, or defuse it by standing on it for ${BOMB.ult.defuse} s. Your detonator never sets it off.`,
    run(c) { const me = c === G.player ? c : null, at = c.pos.clone(); // (planted, not thrown: a short kneel at your feet, then it starts beeping; no cinematic camera)
      if (c.h) c.h.bertHeld = 0; if (me) { me.held = true; me.ultPoseT = 0; me.tpT = 0; me.atk = { name: 'gather', t: 0, dur: BOMB.ult.plant, hit: true, noQueue: true }; G.hooks.castBar && G.hooks.castBar('Planting Big Bertha', 0); }
      else if (c.arenaBot) { c.act = 'gather'; c.actT = 0; c.actSp = 1 / BOMB.ult.plant; c.aimLock = BOMB.ult.plant + 0.1; c.cast = null; }
      S.cast && S.cast('fire', at, 0.6); let t = 0;
      timer((tt, dt) => { t += dt; if (me) { G.hooks.castBar && G.hooks.castBar('Planting Big Bertha', t / BOMB.ult.plant); me.vel && me.vel.set(0, me.vel.y, 0); } if (Math.random() < 0.5) V.emit('spark', at.clone().setY(at.y + 0.3), { speed: 1.5, size: 0.12 });
        if (t < BOMB.ult.plant) return false; if (me) { me.held = false; G.hooks.castBar && G.hooks.castBar(null); } if (!c.dead) plantBomb(c, me ? me.pos.clone() : c.pos.clone()); return true; }); } },
};
export const ULT_BY_T = {}; for (const cls in ULTS) ULT_BY_T[ULTS[cls].t] = ULTS[cls];
export function runTableUlt(caster, ab, aimAt, aimFoe) { const u = ULT_BY_T[ab.t]; if (!u) return false; if (u.aim === 'foe') { if (!aimFoe) return 'noaim'; u.run(caster, aimFoe); } else u.run(caster, u.aim === 'ground' ? aimAt : caster.pos.clone()); return true; }

export function summonDemon(caster, at) {
  // the necromancer's ultimate, cast on the ground: a ring of green hellfire bursts up, the floor cracks and glows, and a
  // skeletal demon claws its way slowly out of the pit and roars. When it is up it seizes the nearest enemy in reach, lifts
  // them overhead while they struggle, and bites their head off, then sinks back as the fire dies. Nobody in reach: it
  // searches, roars in fury, and sinks back down. Whoever is caught sees it all from a cinematic camera.
  if (at && at.pos) at = at.pos; if (!at) return false; const RR = 5.2, FRZ = G.ringFRZ || 1.5; // (FRZ: the freeze when the ring bursts up; from dead centre only a leap dodge then gets out in time) // (the ring: everyone inside is slowed, and the demon can grab anyone still inside it)
  const inAr = A.F && A.F.length > 0, base = inAr ? gy(at.x, at.z, at.y) : heightAt(at.x, at.z), face = caster && caster.pos ? Math.atan2(caster.pos.x - at.x, caster.pos.z - at.z) : 0;
  const DS = 2.2, D = makeDemon(), g = D.g, ox = at.x, oz = at.z, center = new THREE.Vector3(ox, base, oz); g.scale.multiplyScalar(DS); g.position.set(ox, base - 6.5 * DS, oz); /* (big enough to reach anyone inside the ring) */ g.rotation.order = 'YXZ'; g.rotation.y = face; /* (yaw, then a lean in its own frame) */ G.scene.add(g); addOutline(g);
  // the owner's demon model takes over the look once it has loaded: sized to the built demon, feet at its base, and the built one hidden (its parts still steer the hands and the head)
  let dm = null, over = false; const dH = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3()).y / DS;
  loadDemonModel().then(M2 => { if (over) return; const k = dH / Math.max(0.01, M2.size.y); M2.m.scale.setScalar(k); M2.m.position.set(0, 0, 0); g.traverse(o => { if (o.isMesh) o.visible = false; }); g.add(M2.m); dm = M2; }).catch(e => console.warn('demon model', e)); /* (if it fails to load, the built demon stays) */
  const ring = makeHellRing(RR, 64); ring.position.copy(center); G.scene.add(ring);
  S.rumble && S.rumble(center, 1.6); V.addShake(0.25);
  const team = caster === G.player ? G.myTeam : caster.team, enemies = () => (inAr ? A.F.filter(f => f.alive && f.team !== team).map(unitOf).filter(u => u && !u.dead) : caster === G.player ? (G.mobs || []).filter(m => !m.dead && !m.pet && !m.ally && m.pos) : [G.player].filter(u => u && !u.dead)).filter(u => !((u.ultImmT || 0) > 0)); /* (the Training Yard: its dummies) */
  const e = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }, seg = (t, a, b) => e((t - a) / (b - a)), L = (a, b, k) => a + (b - a) * k;
  let GRAB = 3.0, BITE = 5.8, yawC = face, t = 0, bit = false, victim = null, from = null, missed = false, sinkAt = 7.8, roared = 0, emT = 0, liT = 0;
  const hp = new THREE.Vector3(), hpL = new THREE.Vector3(), mouth = new THREE.Vector3(), headW = new THREE.Vector3(), dripP = new THREE.Vector3(); let emT2 = 0, slT = 0, chomp = false, vroot = null, froze = false;
  const cineOff = () => { const p = G.player; if (p && p.cine) { p.cine = null; } document.body.classList.remove('cine'); const bars = document.getElementById('cinebars'); if (bars) bars.classList.remove('on'); };
  const me = caster === G.player ? G.player : null; let flyCam = null;
  if (me) { me.held = true; me.ultImmT = 10; me.ultPoseT = 0; me.headUpT = 0; me.oozeT = 8.5; /* (a second longer than before: the demon lingers over its kill) */ me.oozeE = 0; me.tpT = 0; startFly(); }
  G.timers.push({ update: (dt) => { t += dt;
    if (me) { me.ultImmT = Math.max(me.ultImmT, 0.5); me.oozeT = Math.max(me.oozeT, t < sinkAt + 1.0 ? 0.6 : 0); if (t > sinkAt + 1.6 && me.held) { me.held = false; me.cine = null; me.oozeT = 0; me.ultImmT = 0.6; } }
    // the fire: sweeps round to a full ring in the first second, roars while the demon is up, gutters out at the end
    const end = sinkAt + 1.8, fk = Math.min(seg(t, 0, 1.1), 1 - seg(t, sinkAt + 1.2, end)); ring.userData.tick(fk, t);
    emT -= dt; if (emT <= 0 && fk > 0.2) { emT = 0.04; for (let i = 0; i < 3; i++) { const a = Math.random() * Math.PI * 2; V.emit('poison', new THREE.Vector3(ox + Math.cos(a) * RR, base + 0.4 + Math.random(), oz + Math.sin(a) * RR), { speed: 1.2, vy: 3.5, size: 0.35, life: 1.1 }); } }
    liT -= dt; if (liT <= 0 && fk > 0.1) { liT = 0.15; V.light(new THREE.Vector3(ox, base + 2.5, oz), '#40ff60', (5 + Math.random() * 2) * fk, 0.2, 18); }
    // the moment the ring bursts up, everyone caught inside it is frozen in place for a second
    if (!froze && t >= 0.25) { froze = true; for (const u of enemies()) if (Math.hypot(u.pos.x - ox, u.pos.z - oz) < RR) { if (u === G.player) { G.player.debuff && G.player.debuff('freeze', FRZ); if (G.player.db && G.player.db.freeze) G.player.db.freeze.label = 'SCARED STIFF'; G.player.ultImmT = Math.max(G.player.ultImmT || 0, FRZ); } else if (u.status) { u.status.frozen = Math.max(u.status.frozen || 0, FRZ); u.cast = null; u.invulnT = G.time + FRZ; } /* (frozen and untouchable for that second) */ V.burst('poison', u.pos.clone().setY(u.pos.y + 1), 20, { speed: 2.5 }); V.sphereFlash(u.pos.clone().setY(u.pos.y + 1), 1.1, '#3aff5a', 0.3); } }
    // everyone inside the fire ring is slowed while the demon rises (escape the circle and you are safe)
    slT -= dt; if (slT <= 0 && !bit && t < (victim ? GRAB : sinkAt)) { slT = 0.25; for (const u of enemies()) if (Math.hypot(u.pos.x - ox, u.pos.z - oz) < RR) { u.ringSlowT = G.time + 0.4; /* (the demon's ring slows far harder than a normal slow: to 15.6% speed) */ } }
    // rising: a slow, heavy climb with a judder, clawing at the edge of the pit; sinking: slow, dragged back down
    const up = t < sinkAt ? seg(t, 1.0, 2.9) : 1 - seg(t, sinkAt, sinkAt + 1.9), jud = (t > 1.0 && t < 2.9) || (t > sinkAt && t < sinkAt + 1.9) ? Math.sin(t * 38) * 0.04 : 0;
    g.position.y = base - 6.5 * DS + up * (6.5 - 0.5 * dH) * DS + jud /* (only its upper half rises out of the pit) */ + Math.sin(t * 1.6) * 0.06 * up; g.rotation.z = Math.sin(t * 1.1) * 0.03; if (t > 1 && t < 2.9 || t > sinkAt && t < sinkAt + 1.9) V.addShake(dt * 0.6);
    const heartS = 1 + Math.sin(t * 7) * 0.12; D.heart.scale.setScalar(heartS);
    { let want = face; if (victim && from) want = Math.atan2(from.x - ox, from.z - oz); else if (missed && t < sinkAt) want = face + e((t - GRAB) / 2.0) * Math.PI * 2 + Math.sin((t - GRAB) * 5) * 0.15; /* (a full slow turn, hunting) */
      let dA = want - yawC; if (!missed) { dA = Math.atan2(Math.sin(dA), Math.cos(dA)); } yawC += dA * Math.min(1, dt * (victim && t < GRAB + 0.5 ? 14 : missed ? 10 : 4)); g.rotation.y = yawC;
      const reachD = victim && from ? Math.hypot(from.x - ox, from.z - oz) : 0, leanK = victim ? seg(t, GRAB, GRAB + 0.4) * (1 - seg(t, GRAB + 0.75, GRAB + 1.4)) : 0;
      g.rotation.x = leanK * Math.min(1.0, 0.3 + reachD * 0.075); } /* (it leans right over to snatch them, then hauls them up as it straightens) */
    emT2 = (emT2 || 0) - dt; if (emT2 <= 0 && up > 0.3) { emT2 = 0.05; for (const H of dm ? [dm.bones.RightHand, dm.bones.LeftHand] : [D.arms.R.hand, D.arms.L.hand]) { H.getWorldPosition(dripP); dripP.y -= 0.5; V.emit('poison', dripP, { speed: 0.3, vy: -3, size: 0.22, life: 0.7, radius: 0.3 }); } } /* (ooze dripping from its hands) */
    const R = D.arms.R, Lf = D.arms.L, rising = t < 2.9;
    // left arm: claws the ground while climbing, then braces and sways
    const reach = rising || (missed && t < sinkAt) || (t < GRAB && !victim); /* (rising and hunting: both arms stretched up out of the pit, claws grasping, feeling for someone to grab) */ Lf.sh.rotation.x = reach ? -2.55 + Math.sin(t * 3.6) * 0.32 : L(-0.5, -0.3, Math.sin(t * 1.3) * 0.5 + 0.5); Lf.sh.rotation.z = reach ? -0.35 + Math.sin(t * 2.3) * 0.15 : -0.15; Lf.el.rotation.x = reach ? -0.35 + Math.sin(t * 4.1) * 0.25 : -0.5 + Math.sin(t * 2) * 0.1;
    // the roar: head back, jaw wide, throat blazing
    const roar = seg(t, 2.35, 2.6) * (1 - seg(t, 3.0, 3.25)), roar2 = missed ? seg(t, 4.0, 4.25) * (1 - seg(t, 4.7, 5.0)) : 0, rr = Math.max(roar, roar2);
    if (rr > 0.5 && roared < (roar2 > 0.5 ? 2 : 1)) { roared++; S.growl && S.growl('wolf', center, 0.4); S.explode && S.explode(center, 0.5); V.addShake(0.8); V.ring(center.clone().setY(base + 0.2), RR * 2, '#3aff5a', 0.7); V.burst('poison', center.clone().setY(base + 4), 50, { speed: 7 }); }
    D.throat.scale.setScalar(1 + rr * 1.2);
    if (t >= GRAB && !victim && (!missed || t < sinkAt - 0.5)) { let best = null, bd = RR; for (const u of enemies()) { const d = Math.hypot(u.pos.x - ox, u.pos.z - oz); if (d < bd) { bd = d; best = u; } }
      if (best && missed) { missed = false; GRAB = t; BITE = t + 2.8; sinkAt = BITE + 2.0; } /* (caught someone mid-search) */
      if (best) { victim = best; vroot = best.root || (best.ch && best.ch.root); from = best.pos.clone(); victim.held = true; if (victim === G.player) { G.player.debuff && G.player.debuff('stun', BITE - GRAB + 0.3); startCine(); } else if (victim.status) { victim.status.stun = BITE - GRAB + 0.3; victim.cast = null; victim.pending = null; } }
      else if (!missed) { missed = true; sinkAt = 6.4; } }
    // right arm: reach, seize, hoist overhead, hold up as they struggle, bring them to the jaws
    let shx = -0.4 + Math.sin(t * 1.4) * 0.08, shz = 0.1, elx = -0.4;
    if (reach) { shx = -2.55 + Math.sin(t * 3.6 + 1.7) * 0.32; shz = 0.35 + Math.sin(t * 2.3 + 1) * 0.15; elx = -0.35 + Math.sin(t * 4.1 + 2) * 0.25; }
    if (victim) { const kR = seg(t, GRAB, GRAB + 0.45), kL = seg(t, GRAB + 0.5, GRAB + 1.4), kM = seg(t, BITE - 0.45, BITE);
      shx = L(L(shx, -1.15, kR), -2.75, kL); elx = L(L(elx, -0.15, kR), -0.35, kL); shz = L(shz, 0.15, kR);
      shx = L(shx, -2.95, kM); shz = L(shz, 0.5, kM); elx = L(elx, -0.25, kM); if (t > GRAB + 1.4 && t < BITE - 0.45) shx += Math.sin(t * 9) * 0.05; }
    /* (searching when nobody is there: handled by reach above) */
    R.sh.rotation.x = shx; R.sh.rotation.z = shz; R.el.rotation.x = elx;
    // head: tracks the victim, tips back to roar, cranes up at the prize, lunges for the bite; searches when nobody is there
    let hx = rising ? 0.35 : 0.05, hy = 0; if (missed && t < sinkAt) hy = Math.sin((t - GRAB) * 3.2) * 0.45; else if (victim && !bit) { g.updateMatrixWorld(true); D.head.getWorldPosition(headW); const lv = victim.pos.clone().sub(headW); hy = 0; hx = L(hx, -Math.atan2(lv.y + 1, Math.hypot(lv.x, lv.z)) * 0.6, 0.7); }
    hx = L(hx, -0.55, rr); if (victim) { hx = L(hx, -0.5, seg(t, GRAB + 1.4, BITE - 0.6)); hx = L(hx, -1.5, seg(t, BITE - 0.6, BITE - 0.15)); hx = L(hx, 0.1, seg(t, BITE + 0.7, BITE + 1.2)); }
    D.head.rotation.x = hx; D.head.rotation.y = hy;
    let jw = rr * 0.75 + Math.max(0, Math.sin(t * 2.2)) * 0.06; if (victim) { jw = Math.max(jw, seg(t, BITE - 1.0, BITE - 0.2) * 0.85 * (1 - seg(t, BITE - 0.05, BITE))); if (t >= BITE) jw = 0.55 + Math.max(0, Math.sin((t - BITE) * 14)) * 0.35 * (1 - seg(t, BITE + 0.9, BITE + 1.3)); }
    D.jaw.rotation.x = jw;
    g.updateMatrixWorld(true); R.hand.getWorldPosition(hp); D.head.localToWorld(mouth.set(0, -0.5, 0.75));
    if (dm) { Lf.hand.getWorldPosition(hpL); const scr = rr > 0.35; /* (the scream pose only for the roars: otherwise its arms follow the reaching built arms) */ poseDemonModel(dm, dt, { screaming: scr, handR: scr ? null : hp.clone(), handL: scr ? null : hpL.clone(), pitch: scr ? 0 : hx, yaw: scr ? 0 : hy }); /* (it screams as it rises and roars (and again when it finds nobody); the rest of the time its head copies the built demon's (searching, craning up, lunging to bite) and its arms reach for the built demon's hands) */
      dm.bones.RightHand.getWorldPosition(hp); if (dm.bones.Head) dm.bones.Head.localToWorld(mouth.copy(dm.mouth || new THREE.Vector3())); } /* (the victim hangs from the model's own fist and goes into its own mouth) */
    if (victim && !bit && victim.held) { const vh = victim.height || 1.75, kR = seg(t, GRAB + 0.35, GRAB + 0.75), flip = seg(t, GRAB + 0.6, GRAB + 1.4), kM = seg(t, BITE - 0.55, BITE - 0.05), kS = seg(t, BITE, BITE + 0.55);
      const hang = hp.clone(); hang.y -= L(1.05, 0.1, flip); /* (upright in its fist, then held by the ankle, hanging head-down) */
      const sh2 = t > GRAB + 1.3 ? new THREE.Vector3(Math.sin(t * 17) * 0.07, 0, Math.cos(t * 13) * 0.07) : new THREE.Vector3(); /* (they kick and struggle) */
      const over = mouth.clone(); over.y += vh * 0.98; const p2 = from.clone().lerp(hang.add(sh2), kR).lerp(over, kM); p2.y -= kS * vh * 1.05; /* (dangled over the jaws, then lowered in, head first) */
      victim.pos.copy(p2); if (vroot) { vroot.position.copy(p2); vroot.rotation.x = Math.PI * flip; vroot.rotation.z = Math.sin(t * 11) * 0.3 * kR * (1 - kS); } if (victim === G.player && G.player.vel) G.player.vel.set(0, 0, 0);
      if (!chomp && t >= BITE) { chomp = true; V.burst('blood', mouth, 90, { speed: 7 }); V.burst('poison', mouth, 50, { speed: 5 }); V.sphereFlash(mouth, 1.6, '#ff3020', 0.25); V.sphereFlash(mouth, 2.4, '#3aff5a', 0.4); S.hit && S.hit('flesh', mouth, 2); S.growl && S.growl('wolf', mouth, 0.7); V.addShake(1.0); }
      if (t > BITE && Math.random() < 0.5) V.emit('blood', mouth, { speed: 3, size: 0.3 }); }
    if (victim && !bit && t >= BITE + 0.55) { bit = true; victim.held = false; if (vroot) { vroot.rotation.z = 0; vroot.rotation.x = 0; } V.burst('blood', mouth, 40, { speed: 5 }); S.growl && S.growl('wolf', mouth, 0.5); /* (swallowed whole) */
      if (victim === G.player) { const p = G.player; if (!p.dead) { p.hp = 0; p.die && p.die(caster); } if (p.ch && p.ch.root) p.ch.root.visible = false; }
      else if (victim.dummy) { victim.takeHit && victim.takeHit(99999, caster, {}); victim.pos.copy(from); if (vroot) vroot.position.copy(from); }
      else if (!victim.dead) { victim.hp = 0; if (vroot) vroot.visible = false; victim.die && victim.die(caster); }
      feed(`<b>${caster && caster.heroName ? esc2(caster.heroName) : 'You'}</b>'s demon devours <b>${esc2(victim.heroName || victim.name || 'a fighter')}</b>!`); }
    if (bit && victim === G.player && t > BITE + 1.8 && G.player.cine && G.player.cine !== flyCam) cineOff(); // (the cinematic ends a moment after the bite)
    if (t > end) { over = true; if (me) { me.held = false; if (me.cine === flyCam) me.cine = null; } G.scene.remove(g); G.scene.remove(ring); if (victim) { victim.held = false; if (vroot) { vroot.rotation.z = 0; vroot.rotation.x = 0; } } if (victim === G.player && !bit) cineOff(); return true; }
    return false; } }); // (a timer is finished when it returns true)
  // walls between the camera and the action: swing round until the line is clear
  function clearAng(mid, ang, r, cy) { for (let k = 0; k < 12; k++) { const a2 = ang + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.5; if (lineClear(mid, new THREE.Vector3(mid.x + Math.cos(a2) * r, cy, mid.z + Math.sin(a2) * r))) return a2 - ang; } return 0; }
  // the caster's view: flies up and out of your eyes to circle the pit, watches the whole thing, then flies back
  function startFly() { const tg = new THREE.Vector3(); flyCam = ultFlyCam(G.player, () => { D.head.getWorldPosition(tg); tg.lerp(center, 0.45); tg.y = Math.max(base + 1.2, tg.y); return tg; }, () => sinkAt + 0.65, { r: 10, h: 5, delay: 1.1, inT: 1.6, lift: 4, look0: () => center }); } /* (first you watch the fire ring burst up, then the camera rises and swings in close to the demon, level with its head: the best seat for the feast) */ // (a second in your own eyes, then up over your head and out to a high aerial view of the fire ring and the demon, Paladins style)
  // the victim's cinematic: letterbox bars, a low camera slowly circling the pit, framing the demon and its catch
  function startCine() { const p = G.player; let bars = document.getElementById('cinebars'); if (!bars) { bars = document.createElement('div'); bars.id = 'cinebars'; bars.innerHTML = '<i></i><i></i>'; document.body.appendChild(bars); } requestAnimationFrame(() => bars.classList.add('on'));
    document.body.classList.add('cine'); let cineA = null, cineChk = -9, cineS = null; const t0 = t, Hd = new THREE.Vector3(), side = Math.random() < 0.5 ? 1 : -1;
    p.cine = (cam) => { const ct = t - t0; D.head.getWorldPosition(Hd); const vp = p.pos.clone(); vp.y += 1; const mid = Hd.clone().lerp(vp, 0.5); mid.y = Math.max(mid.y, base + 2.2);
      const ax = vp.x - Hd.x, az = vp.z - Hd.z, al = Math.hypot(ax, az) || 1, ang = Math.atan2(az * side, -ax * side) + (ct - 1.2) * 0.18; /* (side-on to the demon and its catch, drifting slowly round) */
      const r = L(14, 11, e(ct / 2.5)), hgt = L(-0.6, 1.2, e(ct / 2.5)), cy = Math.max(base + 1.2, mid.y + hgt);
      if (cineA == null || G.time - cineChk > 0.5) { cineChk = G.time; let best = null; for (let k = 0; k < 12 && best == null; k++) { const a2 = ang + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.5, cp = new THREE.Vector3(mid.x + Math.cos(a2) * r, cy, mid.z + Math.sin(a2) * r); if (lineClear(mid, cp)) best = a2 - ang; } cineA = best == null ? 0 : best; } /* (swing round until no wall is in the way) */
      cineS = cineS == null ? cineA : cineS + (cineA - cineS) * 0.08; const a3 = ang + cineS;
      cam.position.set(mid.x + Math.cos(a3) * r, cy, mid.z + Math.sin(a3) * r); cam.lookAt(mid); cam.fov = 48; }; }
  return true;
}
// the height of the floor under a point (stairs, balconies, ramparts on the Ruins; flat sand in the colosseum)
export function gy(x, z, y) { return RUINS_MAP() ? worldGround(x, z, (y == null ? AR.Y : y) + 0.6).h : AR.Y; }
// everyone starts (and comes back) in a holding room behind a gate; teams get their own gate, free-for-all shares them out
function spawnOf(f) {
  if (RUINS_MAP()) { const ffa = isFFA(), k = ffa ? f.i % 4 : teamsOf().indexOf(f.team) % 4, rm = RUINS.rooms[k] || RUINS.rooms[0], mates = ffa ? A.F.filter(o => o.i % 4 === k) : A.F.filter(o => o.team === f.team), j = Math.max(0, mates.indexOf(f));
    const lat = ((j % 3) - 1) * 2.2, back = 1.2 + Math.floor(j / 3) * 2.0; return { x: rm.cx - rm.dir[0] * back + (rm.ax ? 0 : lat), z: rm.cz - rm.dir[1] * back + (rm.ax ? lat : 0), yaw: Math.atan2(rm.dir[0], rm.dir[1]) }; }
  const R = AR.R, ffa = isFFA(), k = ffa ? f.i % 4 : teamsOf().indexOf(f.team) % 4, g = AR.gates[k], mates = ffa ? A.F.filter(o => o.i % 4 === k) : A.F.filter(o => o.team === f.team), j = Math.max(0, mates.indexOf(f));
  const lat = ((j % 3) - 1) * 2.2, along = R + 4.2 + Math.floor(j / 3) * 2.6, a = g.a;
  return { x: Math.sin(a) * along + Math.cos(a) * lat, z: Math.cos(a) * along - Math.sin(a) * lat, yaw: Math.atan2(-Math.sin(a), -Math.cos(a)) };
}
// keep a body on the sand or inside a holding room (the rooms open onto the sand once the gates are up); pillars push you aside
function roomOf(x, z) { if (RUINS_MAP()) { for (const rm of RUINS.rooms) if (Math.abs(x - rm.cx) < rm.hw + 0.3 && Math.abs(z - rm.cz) < rm.hd + 0.3) return { k: rm.k, rm, a: Math.atan2(rm.dir[0], rm.dir[1]) }; return null; } for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, al = x * Math.sin(a) + z * Math.cos(a), lat = x * Math.cos(a) - z * Math.sin(a); if (al > AR.R - 1.5 && Math.abs(lat) < ROOM.half + 0.6) return { k, a, al, lat }; } return null; }
function confine(pos, r0 = 0.9) {
  if (RUINS_MAP()) { const B = RUINS.bounds; pos.x = Math.max(-B.x, Math.min(B.x, pos.x)) ; pos.z = Math.max(-B.z, Math.min(B.z, pos.z)); const rm = roomOf(pos.x, pos.z);
    if (rm && !AR.gatesOpen) { const R2 = rm.rm; pos.x = Math.max(R2.cx - R2.hw + 0.4, Math.min(R2.cx + R2.hw - 0.4, pos.x)); pos.z = Math.max(R2.cz - R2.hd + 0.4, Math.min(R2.cz + R2.hd - 0.4, pos.z)); return 'room'; }
    return rm ? 'room' : 'sand'; }
  const R = AR.R, rm = roomOf(pos.x, pos.z);
  if (rm && (rm.al > R - r0 || !AR.gatesOpen)) { const open = AR.gatesOpen && Math.abs(rm.lat) < 2.4; let al = Math.min(ROOM.far - 0.4 + R, rm.al), lat = Math.max(-ROOM.half + 0.4, Math.min(ROOM.half - 0.4, rm.lat));
    if (!open) al = Math.max(R + ROOM.near, al); else if (al < R + 1.2) lat = Math.max(-2.3, Math.min(2.3, lat)); // (through the gate itself, only between the posts)
    pos.x = Math.sin(rm.a) * al + Math.cos(rm.a) * lat; pos.z = Math.cos(rm.a) * al - Math.sin(rm.a) * lat; return 'room'; }
  const d = Math.hypot(pos.x, pos.z); if (d > R - r0) { pos.x *= (R - r0) / d; pos.z *= (R - r0) / d; }
  for (const P of PILLARS) { const dx = pos.x - P.x, dz = pos.z - P.z, dd = Math.hypot(dx, dz), m = P.r + 0.35; if (dd < m && dd > 1e-3) { pos.x = P.x + dx / dd * m; pos.z = P.z + dz / dd * m; } }
  return 'sand';
}
function placeAll() { for (const f of A.F) revive(f, true); }
function revive(f, place) {
  if (f.you && A.nextCls) applyClass();
  const sp = spawnOf(f); f.alive = true; f.respawnT = 0;
  if (f.you) { const p = G.player; if (!p) return; p.spectate = false; p.dead = false; p.hp = p.maxHp; p.mana = p.maxMana; p.end = p.maxEnd; p.db = {}; if (place) p.place(sp.x, sp.z, sp.yaw); A.hooks.revived && A.hooks.revived(); }
  else if (f.bot) f.bot.revive(sp);
  else if (f.owner != null && AN.host) nsend({ t: 'revive', to: f.owner }); // a player revives on their own machine
}
// ---------- changing class during the match (K) ----------
function applyClass() { const f = A.me; f.cls = A.nextCls; A.nextCls = null; const h = arenaHero(f, f.name); A.hooks.swapHero && A.hooks.swapHero(h); if (G.player) G.player.arenaF = f; if (AN.on) nsend({ t: 'cls', c: f.cls }); }
// ---------- every key the hero has, as cards: left click, right click, F, C, Q, then the ultimate ----------
// (the skills window on P, and K in the Training Yard; I or H lists the same left and right click)
// a key badge: the letter on a key cap, or the mouse with the button that is meant lit up
const KB_MOUSE = (right) => `<svg viewBox="0 0 24 32" aria-hidden="true"><rect x="2" y="2" width="20" height="28" rx="10" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M12 2v11" stroke="currentColor" stroke-width="2.6"/><path d="${right ? 'M13 3.2a9 9 0 0 1 8 8.8h-8z' : 'M11 3.2a9 9 0 0 0-8 8.8h8z'}" class="lit"/></svg>`;
export const keyBadge = (k) => k === 'LMB' || k === 'RMB' ? `<kbd class="kbadge mouse" title="${k === 'LMB' ? 'Left click' : 'Right click'}">${KB_MOUSE(k === 'RMB')}${k}</kbd>` : `<kbd class="kbadge">${k}</kbd>`;
const NO_HOLD = /\s*Hold block for 1 s to raise it\.?/; // (a defensive cast straight from right click, not raised by holding a block)
// left click: the class's basic attack as player.js light() plays it in the arena and the yard. [name, what it does, badge glyph, badge colour]
function lmbAttack(p) {
  const W = p.W, wt = p.weapon && p.weapon.wt, cls = p.h.cls;
  if (!W) return ['Punch', 'Throw a punch at whoever is in front of you.', 'fist', 'steel'];
  if (cls === 'warrior' && W.hands === 'shield' && wt === 'swordshield') return ['Sword Combo', 'Two sword swings, one flowing into the other. Sword blows crit 10% more often.', 'sword', 'steel']; // (the owner's Double Combo Attack)
  if (cls === 'berserker' && wt === 'greataxe') return ['Great Axe Combo', 'Three blows: a wide sweep, a quick backswing, then a slow, heavy blow that hits hardest. Every blow leaves enemies bleeding.', 'axe', 'red'];
  if ((cls === 'paladin' || cls === 'darkknight') && W.kind === 'melee' && W.hands === 'two') return cls === 'paladin' ? ['Hammer Combo', 'Three crushing blows: a two-handed overhead smash, a wide sweep, then a heavy overhead finisher. The slower the blow, the harder it lands.', 'hammer', 'gold'] : ['Greatsword Combo', 'Three slashing blows: a backhand cut, a wide sweep across, then a thrust. The slower the blow, the harder it lands.', 'sword', 'shadow']; // (the paladin's hammer is carried as a greatsword; each knight has his own combo)
  if (cls === 'necromancer' && W.kind === 'staff') return ['Scythe Reap', `A wide sweep of your scythe (about ${Math.round(REAP.half * 360 / Math.PI)} degrees) that cuts every enemy in front of you.`, 'whirl', 'nature'];
  if (cls === 'bombardier' && W.kind === 'staff') return ['Bomb Toss', `Lob a bomb: it bounces two or three times, then goes off (at once if it hits an enemy), hurting everyone within ${BOMB.throw.r} m. Right click sets it off early.`, 'burst', 'fire'];
  if (cls === 'priest' && W.kind === 'staff') return ['Dawn Bolt', 'A bolt of dawn light. Every bolt that hits an enemy heals the most hurt ally near you.', 'fireball', 'gold'];
  if (W.kind === 'bow') return ['Arrow', `Draw and loose an arrow, about one a second.${cls === 'ranger' ? ` Zoomed in (right click), hold left click to draw a strong shot: a bar under the crosshair fills over 1.5 s to 2.5x damage, and a full draw pierces. Headshots hit ${HEADSHOT.rangerQuick}x (a drawn shot ${HEADSHOT.rangerDrawn}x) and heal you ${Math.round(HEADSHOT.rangerHeal * 100)}% of your health.` : ''}`, 'arrow', 'nature'];
  if (wt === 'blunderbuss') return ['Scattershot', 'A blast of eight pellets in a cone: deadly up close, spent by 25 m.', 'volley', 'fire'];
  if (W.kind === 'gun') return ['Musket Shot', `A heavy ball straight where you aim, about one shot a second.${cls === 'musketeer' ? ` Headshots hit ${HEADSHOT.musket}x (${HEADSHOT.musketAds}x aimed down the barrel).` : ''}`, 'burst', 'steel'];
  if (W.kind === 'staff') { const hs = cls === 'wizard' || (cls === 'elementalist' && W.element !== 'fire') ? ` Headshots hit ${HEADSHOT.caster}x.` : ''; // (combat.js headK)
    return W.element === 'fire' ? ['Fire Bolt', 'A ball of fire that bursts where it lands, burning the enemy it hits and scorching those around it.' + hs, 'fireball', 'fire'] : W.element === 'frost' ? ['Frost Bolt', 'An icy bolt that slows the enemy it hits for 3 s.' + hs, 'snow', 'frost'] : ['Arcane Bolt', 'A fast bolt of arcane force, straight where you aim.' + hs, 'fireball', 'arcane']; }
  if (wt === 'fists') return cls === 'monk' ? ['Fist Combo', 'Jab, cross, hook and uppercut, then a spinning kick that lands head high, a jab and a two-fisted slam; you keep running while you strike.', 'fist', 'steel'] : ['Jab and Cross', 'Fast punches, left and right.', 'fist', 'steel'];
  if (wt === 'dagger' || wt === 'daggers') return cls === 'rogue' ? ['Dagger Combo', 'Two quick stabs, then a leaping spin that slashes both blades down on everyone around you.', 'swords', 'shadow'] : ['Dagger Stabs', 'Quick, short-reaching stabs.', 'swords', 'shadow'];
  if (wt === 'spear') return ['Spear Thrust', 'Long-reaching thrusts with your spear.', 'spear', 'steel'];
  if (wt === 'axe' || wt === 'handaxes') return ['Axe Chops', 'Quick chops, left and right, that leave enemies bleeding.', 'axe', 'nature'];
  if (wt === 'maceshield') return ['Mace Blows', 'A swing and a smash with your mace, in turn.', 'hammer', 'gold'];
  if (wt === 'mace' || wt === 'warhammer') return [wt === 'mace' ? 'Mace Blows' : 'Hammer Blows', 'Heavy, blunt blows at whoever is in front of you.', 'hammer', 'steel'];
  if (wt === 'greatsword' || wt === 'greataxe') return [wt === 'greatsword' ? 'Greatsword Swings' : 'Great Axe Swings', 'Wide two-handed swings through everyone in front of you' + (wt === 'greataxe' ? ', leaving them bleeding.' : '.'), wt === 'greatsword' ? 'sword' : 'axe', 'red'];
  if (/sword/.test(wt)) return ['Sword Slashes', 'Quick slashes, one way and then back.' + (wt === 'swordshield' || wt === 'swordmace' ? ' Sword blows crit 10% more often.' : ''), 'sword', 'steel'];
  return [W.name, 'Swing your weapon at whoever is in front of you.', 'sword', 'steel'];
}
// right click, by the arena's own rules (this file's onMouse, then player.js onMouse): a few abilities fire at once; a class with no
// right-click ability blocks; a shield blocks (healers' heals and totems still cast); a bow or a gun aims down the sights; the rest cast
function rmbAction(p) {
  const h = p.h, W = p.W, r = h.arenaRmb, a = r && r !== 'aim' ? (ABILITIES[h.cls] || []).find(x => x.id === r) : null;
  const cast = (x) => ({ name: x.name, meta: x.cd ? `${x.cd} s cooldown` : '', desc: (x.desc || '').replace(NO_HOLD, ''), icon: Icons.abilityIcon(x.id) });
  const block = (d) => ({ name: d ? 'Block · ' + d.name : 'Block', meta: 'hold to block', desc: `Raise your ${W && W.hands === 'shield' ? 'shield' : 'guard'}. Raise it just before a hit for a perfect block.` + (d ? ` Keep it up for 1 s and ${d.name} goes up by itself: ${(d.desc || '').replace(NO_HOLD, '')}` : ''), icon: Icons.abilityIcon(d ? d.id : 'shieldwall') });
  if (r === undefined) return null;
  if (a && RMB_CAST.has(r)) return cast(a);
  if (r === null) return W ? block(null) : null;
  if (W && W.hands === 'shield' && !/^ar_(mend|totem)/.test(r)) return block(SHIELD_DEF.has(r) && a);
  if (r === 'aim' || (W && (W.kind === 'bow' || W.kind === 'gun'))) return W && W.kind === 'bow'
    ? { name: 'Aim', meta: 'hold to aim', desc: 'Zoom in and steady your aim: arrows fly faster and flatter and hit 15% harder, but you walk slowly.', icon: glyphBadge('aim', 'nature') }
    : { name: 'Aim down the barrel', meta: 'hold to aim', desc: 'Zoom in and steady your aim: shots fly true and hit 15% harder, but you walk slowly.', icon: glyphBadge('aim', 'steel') };
  return a ? cast(a) : null;
}
// left and right click as cards: { k, name, meta, desc, icon }
export function mouseKeys(p) {
  const L = lmbAttack(p), W = p.W, R = rmbAction(p);
  const lmb = { k: 'LMB', name: L[0], desc: L[1], icon: glyphBadge(L[2], L[3]), meta: !W ? 'hold to keep punching' : W.kind === 'bow' || W.kind === 'gun' ? 'hold to keep firing' : W.kind === 'staff' ? (p.h.cls === 'bombardier' ? 'hold to keep throwing' : p.h.cls === 'necromancer' ? 'hold to keep reaping' : 'hold to keep casting') : 'hold to keep attacking' };
  return R ? [lmb, Object.assign({ k: 'RMB' }, R)] : [lmb];
}
// the cards themselves, two to a row: left click and right click, F and C, Q and the ultimate
export function abilityCards(p) {
  const h = p.h, cls = h.cls, A2 = ABILITIES[cls] || [], ab = (id) => id && id !== 'aim' ? A2.find(a => a.id === id) : null, kit = h.arenaKit || ARENA_KITS[cls] || [];
  const u = ab(h.arenaUlt || ARENA_ULT[cls]) || (ULTS[cls] ? { id: ARENA_ULT[cls], name: ULTS[cls].name, desc: ULTS[cls].desc } : null); /* (the hero's own ultimate: the berserker's Bladestorm is not in ULTS) */
  const rows = [...mouseKeys(p), ...['F', 'C', 'Q'].map((k, i) => { const a = ab(kit[i]); return a && { k, name: a.name, meta: a.cd ? `${a.cd} s cooldown` : '', desc: a.desc || '', icon: Icons.abilityIcon(a.id) }; }), u && { k: 'R', name: u.name, ult: true, desc: u.desc || '', icon: Icons.abilityIcon(u.id) }];
  const box = elx('div', 'perkgrid abilgrid');
  for (const r of rows) { if (!r) continue; const card = elx('div', 'perkcard has abilcard' + (r.k === 'LMB' || r.k === 'RMB' ? ' mousecard' : ''));
    card.innerHTML = `<div class="kiti">${r.icon}</div><div class="kitt">${r.ult ? `<b><span style="font-size:1.45em;letter-spacing:.02em">${r.name}</span> ${keyBadge('R')}<small class="dim" style="font-size:.72em;font-weight:600;letter-spacing:.12em">ULTIMATE</small></b>` : `<b>${r.name} ${keyBadge(r.k)}${r.meta ? `<span class="dim" style="font-weight:400">${r.meta}</span>` : ''}</b>`}<span>${r.desc}</span></div>`; /* (the ultimate's name reads big, the ULTIMATE tag small) */
    box.appendChild(card); }
  return box;
}
// P: perks. Points come with time; spend them on any of your class's ten perks (three ranks each), whenever you like
export function openPerks(UI) {
  const p = G.player, h = p.h, cls = h.cls, f = A.me || freePP(); h.arenaPerks = h.arenaPerks || {};
  const c = UI.openWin('arenaperks', CLASSES[cls].name + ' · skills & perks', '', 'big');
  const iconOf = (pk) => { const id = pk.slot && pk.slot !== 'L' ? (pk.slot === 'R' ? h.arenaRmb : (h.arenaKit || [])[['F', 'C', 'Q'].indexOf(pk.slot)]) : null; return id && id !== 'aim' ? Icons.abilityIcon(id) : `<span class="perkglyph${pk.passive ? ' pas' : ''}">${pk.glyph || { powL: '⚔' }[pk.id] || '◆'}</span>`; };
  const draw = () => { const left = perkLeft(f); c.innerHTML = '';
    { c.insertAdjacentHTML('beforeend', '<div class="perkhead"><b>Your abilities</b></div>'); const box = abilityCards(p); box.style.marginBottom = '14px'; c.appendChild(box); } /* (the skill menu: every key, left and right click included, and what it does, then the perks below) */
    c.insertAdjacentHTML('beforeend', `<div class="perkhead"><b>${left}</b> perk point${left === 1 ? '' : 's'} to spend</div>`); /* (the owner: players don't need the earning rate or the tank numbers) */
    const all = perksFor(cls), card = (pk) => { const lv = h.arenaPerks[pk.id] || 0, open = treeOpen(h, pk), r = elx('div', 'perkcard' + (lv ? ' has' : '') + (open ? '' : ' locked'));
      r.innerHTML = `<div class="kiti">${pk.tree ? `<span class="perkglyph">${pk.glyph}</span>` : iconOf(pk)}</div><div class="kitt"><b>${pk.name}</b><span>${open ? pk.desc : 'Take a rank in the perk above to open this.'}</span><div class="perkpips">${Array.from({ length: Game.PERK_MAX }, (_, k) => `<i class="${k < lv ? 'on' : ''}"></i>`).join('')}</div></div>`;
      const plus = elx('button', 'btn gold perkb', '+'), minus = elx('button', 'btn perkb', '−'); plus.disabled = !open || lv >= Game.PERK_MAX || left <= 0; minus.disabled = lv <= 0 || (lv === 1 && treeBelowHas(h, pk));
      plus.onclick = () => { h.arenaPerks[pk.id] = lv + 1; applyPerkStats(f); S.click(); draw(); }; minus.onclick = () => { h.arenaPerks[pk.id] = lv - 1; applyPerkStats(f); S.click(); draw(); };
      const bx = elx('div', 'perkbtns'); bx.append(plus, minus); r.appendChild(bx); return r; };
    c.insertAdjacentHTML('beforeend', '<div class="perkhead"><b>Basic perks</b></div>'); const basics = elx('div', 'perkgrid'); for (const pk of all.filter(x => !x.tree)) basics.appendChild(card(pk)); c.appendChild(basics);
    c.insertAdjacentHTML('beforeend', '<div class="perkhead"><b>Skill tree</b> <small>each ability has three tiers; a tier opens once the one above has a rank</small></div>');
    const tree = elx('div', 'perktree'); for (const slot of ['F', 'C', 'Q', 'U']) { const col = all.filter(x => x.tree === slot).sort((a, b) => a.tier - b.tier); if (!col.length) continue; const ab = (ABILITIES[cls] || []).find(a => a.id === col[0].ab);
      const cl = elx('div', 'treecol'); cl.innerHTML = `<div class="treehead"><div class="kiti">${Icons.abilityIcon(col[0].ab)}</div><b>${slot === 'U' ? 'R' : slot}</b><span>${ab ? ab.name : ''}</span></div>`; col.forEach((pk, k) => { if (k) cl.appendChild(elx('div', 'treelink' + ((h.arenaPerks[col[k - 1].id] || 0) ? ' on' : ''))); cl.appendChild(card(pk)); }); tree.appendChild(cl); }
    c.appendChild(tree); };
  draw();
}
// I or H: what every one of your keys does
export function openKitInfo(UI, into) {
  const p = G.player, h = p.h, W = p.W, cls = h.cls, c = into || UI.openWin('arenakit', CLASSES[cls].name + ' · your abilities', '', 'big');
  const icon = (id) => { if (String(id).startsWith('<')) return id; try { return Icons.abilityIcon(id); } catch (e) { return ''; } }; // (an icon may come ready-made: left and right click)
  const row = (key, name, desc, cd, id) => `<div class="kitrow"><div class="kitk">${key}</div>${id ? `<div class="kiti">${icon(id)}</div>` : '<div class="kiti"></div>'}<div class="kitt"><b>${name}</b>${cd ? `<i>${cd} s cooldown</i>` : ''}<span>${desc}</span></div></div>`;
  const ab = (id) => ABILITIES[cls].find(a => a.id === id);
  let html = '';
  for (const m of mouseKeys(p)) html += row(m.k, m.name, m.desc + (m.meta && !/cooldown/.test(m.meta) ? ` <i>(${m.meta})</i>` : ''), m.k === 'RMB' && /cooldown/.test(m.meta) ? parseFloat(m.meta) : 0, m.icon); // (the same left and right click as the skills window)
  ['F', 'C', 'Q'].forEach((k, i) => { const a = ab((h.arenaKit || [])[i]); if (a) html += row(k, a.name, a.desc, a.cd, a.id); });
  { const u = h.arenaUlt && ab(h.arenaUlt); if (u) html += row('R', `<span style="font-size:1.45em;letter-spacing:.02em">${u.name}</span> <small style="font-size:.72em;opacity:.75;font-weight:600">ULTIMATE</small>`, u.desc + ' Charges over time, faster when you deal damage or heal.', 0, u.id); }
  html += row('Shift', 'Sprint / dodge', 'Hold to sprint. Tap (or double-tap a direction) to dodge-roll.', 0, null);
  c.insertAdjacentHTML('beforeend', `<div class="kitlist">${html}</div><p class="dim" style="margin-top:8px">K changes class · Tab shows the scores · hover the bar at the bottom (hold Alt for a cursor) to read any of these again.</p>`);
}
export function openClassPicker(UI) {
  const c = UI.openWin('arenacls', 'Change class', '', 'big yardwin'), now = A.state === 'pick' || !A.me.alive;
  c.appendChild(elx('h3', '', `Pick a class <small>${now ? 'you switch right away' : A.lives === 'one' ? 'you switch when the next round starts' : 'you switch when you next respawn'}</small>`));
  const g = elx('div', 'ygrid');
  for (const k of Object.keys(CLASSES)) { const kit = kitOf(k).map(id => (ABILITIES[k].find(a => a.id === id) || {}).name).join(' · ');
    const b = elx('button', 'ycls pcard' + ((A.nextCls || A.me.cls) === k ? ' on' : ''), `<img src="${classPortrait(k)}" alt=""><b>${CLASSES[k].name}</b><small>${kit}</small>`);
    b.onclick = () => { S.click(); A.nextCls = k === A.me.cls ? null : k; try { const st = JSON.parse(sessionStorage.getItem(ARENA_KEY) || 'null'); if (st && st.slots && st.slots[0]) { st.slots[0].cls = k; sessionStorage.setItem(ARENA_KEY, JSON.stringify(st)); } } catch (e) { /* no storage */ }
      UI.closeWin(); if (A.nextCls && (A.state === 'pick' || !A.me.alive)) { applyClass(); if (A.state === 'pick') { const p = G.player, sp = spawnOf(A.me); p.place(sp.x, sp.z, sp.yaw); } }
      else if (A.nextCls) A.hooks.toast && A.hooks.toast(`You will fight as a ${CLASSES[k].name} ${A.lives === 'one' ? 'next round' : 'when you respawn'}`, '⚔', 'gold'); };
    g.appendChild(b); }
  c.appendChild(g);
}
function elx(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
function startPick(t) { for (const f of A.F) if (f.bot) { f.bot.buffed = false; f.bot.pickT = 0; f.bot.buffAt = null; } A.state = 'pick'; A.t = t; AR.gatesOpen = false; renderHud(true); if (AN.on && AN.host) nsend({ t: 'pick', n: t }); }
export function readyUp() { if (A.state === 'pick' && AUTH()) A.t = Math.min(A.t, 3.5); }
function autoSpend() { const h = G.save; if (!h || Game.classPoints(h) <= 0) return; const left = Game.classPoints(h); botSpend(h, A.F.filter(o => o.team === A.me.team).length > 1); Game.autoFillHotbar(h); G.player.refreshStatsOnly && G.player.refreshStatsOnly(); A.hooks.rebuildBar && A.hooks.rebuildBar(); A.hooks.toast && A.hooks.toast(`${left} unspent skill point${left > 1 ? 's were' : ' was'} spent for you`, '✦', 'gold'); }
function startFight() { if (AN.on && AN.host) nsend({ t: 'fight' }); A.state = 'fight'; A.clock = 0; AR.gatesOpen = true; cheer(1.6); S.battleCry && S.battleCry(); A.hooks.closeBook && A.hooks.closeBook(); A.hooks.banner && A.hooks.banner(A.setup.objective === 'rounds' ? `Round ${A.round}` : OBJECTIVES[A.setup.objective].name, 'Fight!'); for (const f of A.F) if (f.bot) f.bot.prebuff(); }

// ---------------- every frame ----------------
export function updateArena(dt) {
  playerRules(G.player); // (the control rules on your hero: roots, silence, mesmerize, the shield's defensive)
  G.tod = A.setup.tod || 0.335; { const tr = document.getElementById('tracker'); if (tr && !tr.hidden) tr.hidden = true; } G.zoneLabel = 'Kingdom Arena<small>' + OBJECTIVES[A.setup.objective].name + '</small>';
  if (RUINS_MAP()) updateRuins(dt); else updateColosseum(dt);
  notesTick(dt);
  const p = G.player;
  if (A.state === 'pick') { A.t -= dt; if (p && !p.dead && !roomOf(p.pos.x, p.pos.z)) { const sp = spawnOf(A.me); p.place(sp.x, sp.z, p.yaw); } if (A.t <= 0 && AUTH()) startFight(); } // (wander the holding room and buff up until the gate lifts)
  else if (A.state === 'fight') { A.clock += dt; perkTick(dt); auraTick(dt); ultTick(dt); if (AUTH()) { objectives(dt); respawns(dt); } else { paintHill(); if (!A.me.alive) A.me.respawnT = Math.max(0, (A.me.respawnT || 0) - dt); } }
  else if (A.state === 'roundEnd') { A.t -= dt; if (A.t <= 0 && AUTH()) { A.round++; for (const f of A.F) { f.alive = true; } placeAll(); startPick(10); } }
  if (AN.on) { netTick(dt); if (!AN.host) updatePetViews(dt); }
  // dead: fly around and watch (WASD, Space up, C down, Shift faster)
  if (p && p.dead && A.state !== 'over') { if (!p.spectate && (p.deadT || 0) > 1.4) { p.spectate = true; p.pos.y += 2.5; }
    if (p.spectate) { const k = G.keys, sp = (k.ShiftLeft || k.ShiftRight ? 26 : 12) * dt;
      const F = p.fwd(), Rt = p.right(); let mx = 0, mz = 0; if (k.KeyW) { mx += F.x; mz += F.z; } if (k.KeyS) { mx -= F.x; mz -= F.z; } if (k.KeyA) { mx -= Rt.x; mz -= Rt.z; } if (k.KeyD) { mx += Rt.x; mz += Rt.z; }
      const L = Math.hypot(mx, mz); if (L > 0) { p.pos.x += mx / L * sp; p.pos.z += mz / L * sp; }
      if (k.Space) p.pos.y += sp; if (k.KeyC || k.ControlLeft) p.pos.y -= sp; p.pos.y = Math.max(AR.Y + 1.2, Math.min(AR.Y + 45, p.pos.y));
      const d = Math.hypot(p.pos.x, p.pos.z), lim = AR.R + 45; if (d > lim) { p.pos.x *= lim / d; p.pos.z *= lim / d; } } }
  // keep the player inside the sand
  let where = 'sand'; if (p && !p.dead) { p.spectate = false; where = confine(p.pos, 0.9); }
  // the camera never goes behind the arena wall: it slides in along the ring instead
  if (G.camera && p && !p.dead && RUINS_MAP()) { const c = G.camera.position, h = p.pos.clone().setY(p.pos.y + 1.6), d = c.clone().sub(h), L = d.length(); for (let t = 0.15; t <= 1.0001; t += 0.05) { const q = h.clone().addScaledVector(d, t); if (solidAt(q.x, q.y, q.z)) { c.copy(h).addScaledVector(d, Math.max(0, t - 0.08)); break; } } } // (the camera never goes inside a wall)
  else if (G.camera && p && !p.dead) { const c = G.camera.position; if (where === 'room' || roomOf(c.x, c.z)) { const rm = roomOf(c.x, c.z) || roomOf(p.pos.x, p.pos.z); if (rm) { const pr = roomOf(p.pos.x, p.pos.z), al = Math.min(AR.R + ROOM.far, Math.max(pr ? AR.R - 3 : AR.R - 6, rm.al)), lat = Math.max(-ROOM.half + 0.2, Math.min(ROOM.half - 0.2, rm.lat)); c.x = Math.sin(rm.a) * al + Math.cos(rm.a) * lat; c.z = Math.cos(rm.a) * al - Math.sin(rm.a) * lat; c.y = Math.min(c.y, AR.Y + ROOM.H - 0.3); } } else { const d = Math.hypot(c.x, c.z), lim = AR.R - 0.4; if (d > lim) { c.x *= lim / d; c.z *= lim / d; } } }
  updateShots(dt); updateZones(dt); for (const fl of A.flags) { if (AUTH()) updateFlag(fl, dt); else { fl.grp.position.copy(fl.pos); fl.cloth.rotation.y = Math.sin(G.time * 3 + fl.team) * 0.3; } }
  renderHud();
}
function respawns(dt) {
  if (A.lives === 'one') return;
  for (const f of A.F) if (!f.alive && !f.left) { f.respawnT -= dt; if (f.respawnT <= 0) revive(f, true); }
}
export function fighterDied(f, killer) {
  if (!f.alive || A.state !== 'fight' || !AUTH()) return; f.alive = false; f.deaths++; f.respawnT = RESPAWN_T;
  const k = killer && killer.arenaF ? killer.arenaF : killer && killer.owner && killer.owner.arenaF ? killer.owner.arenaF : null;
  if (k && k !== f) { k.kills++; if (A.setup.objective === 'dm') A.score[k.team] = (A.score[k.team] || 0) + (k.team === f.team ? 0 : 1); }
  feed(k ? `<b style="color:${teamCol(k.team)}">${k.name}</b> ⚔ <b style="color:${teamCol(f.team)}">${f.name}</b>` : `<b style="color:${teamCol(f.team)}">${f.name}</b> fell`);
  cheer(0.9); for (const fl of A.flags) if (fl.carrier === f) dropFlag(fl);
  if (f.you) A.hooks.playerDown && A.hooks.playerDown(A.lives === 'one' ? 0 : RESPAWN_T);
  checkWin();
}
export function playerDied() { const p = G.player, k = p && p.lastHitBy && G.time - (p.lastHitAt || 0) < 8 ? p.lastHitBy : null; if (AUTH()) fighterDied(A.me, k); else { A.me.alive = false; A.me.respawnT = RESPAWN_T; nsend({ t: 'died', k: k && k.arenaF ? k.arenaF.i : -1 }); } }
function aliveTeams() { return teamsOf().filter(t => A.F.some(f => f.team === t && f.alive)); }
function checkWin() {
  if (A.state !== 'fight') return;
  const o = A.setup.objective;
  if (A.lives === 'one') { const at = aliveTeams(); if (at.length <= 1) { const w = at[0]; if (o === 'rounds' && w != null) { A.roundWins[w]++; if (A.roundWins[w] < A.target) { A.state = 'roundEnd'; A.t = 4; bannerAll(`${teamName(w)} wins round ${A.round}`, `${Object.entries(A.roundWins).map(([t, n]) => `${teamName(+t)} ${n}`).join(' · ')}`); cheer(1.5); return; } } return finish(w); } }
  if (o === 'dm' || o === 'ctf' || o === 'koth') { for (const t of teamsOf()) if ((A.score[t] || 0) >= A.target) return finish(t);
    if (A.clock >= A.timeLimit) { const sc = teamsOf().map(t => [t, A.score[t] || 0]).sort((a, b) => b[1] - a[1]); if (sc.length < 2 || sc[0][1] > sc[1][1]) return finish(sc[0][0]); if (!A.sudden) { A.sudden = true; bannerAll('Sudden death', 'The next point wins'); cheer(1.2); } } }
}
function finish(w) { if (AN.on && AN.host) nsend({ t: 'over', w }); celebrate(w); if (w != null) for (const f of A.F) if (f.team === w) { const u = unitOf(f), c = u && (u === G.player ? u.ch : u.model); if (c) c.cheerT = 6; } /* (the winners' heroes cheer, if their model has a cheer) */ A.state = 'over'; A.winner = w; AR.gatesOpen = false; cheer(2); A.hooks.over && A.hooks.over(w); renderEnd(); }

// ---------------- objectives ----------------
function objectives(dt) {
  const o = A.setup.objective; if (A.clock >= A.timeLimit) checkWin();
  if (o === 'koth') { const on = new Set(); for (const f of A.F) if (f.alive) { const q = posOf(f); if (Math.hypot(q.x, q.z) < 7) on.add(f.team); }
    A.hillOwner = on.size === 1 ? [...on][0] : on.size > 1 ? 'contested' : null;
    if (A.hillOwner != null && A.hillOwner !== 'contested') { A.hillAcc = (A.hillAcc || 0) + dt; if (A.hillAcc >= 1) { A.hillAcc -= 1; A.score[A.hillOwner] = (A.score[A.hillOwner] || 0) + 1; } }
    paintHill(); checkWin(); }
}
function paintHill() { if (A.setup.objective !== 'koth') return; AR.hill.material.color.set(A.hillOwner == null ? '#ffffff' : A.hillOwner === 'contested' ? '#ff8a30' : teamCol(A.hillOwner)); AR.hill.material.opacity = 0.55 + Math.sin(G.time * 4) * 0.2; }
// capture the flag: a banner on a pole at each team's gate
function makeFlag(t) {
  const k = teamsOf().indexOf(t), g = AR.gates[k % 4], home = RUINS_MAP() ? V3(g.x, g.y || AR.Y, g.z) : V3(g.x * 0.86, AR.Y, g.z * 0.86);
  const grp = new THREE.Group(); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 6), new THREE.MeshStandardMaterial({ color: '#d8b04a', metalness: 0.8, roughness: 0.4 })); pole.position.y = 1.6; grp.add(pole);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.85), new THREE.MeshStandardMaterial({ color: teamCol(t), side: THREE.DoubleSide, emissive: teamCol(t), emissiveIntensity: 0.25 })); cloth.position.set(0.67, 2.7, 0); grp.add(cloth);
  const base = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.8, 40), new THREE.MeshBasicMaterial({ color: teamCol(t), transparent: true, opacity: 0.6, side: THREE.DoubleSide })); base.rotation.x = -Math.PI / 2; base.position.copy(home).setY(AR.Y + 0.07); G.scene.add(base);
  grp.position.copy(home); G.scene.add(grp);
  return { team: t, home, pos: home.clone(), grp, cloth, carrier: null, dropT: 0, atHome: true };
}
function dropFlag(fl) { const q = posOf(fl.carrier); fl.carrier = null; fl.pos.set(q.x, gy(q.x, q.z, q.y), q.z); fl.dropT = 15; fl.atHome = false; feed(`The <b style="color:${teamCol(fl.team)}">${COLOR_NAMES[fl.team]}</b> banner was dropped`); }
function updateFlag(fl, dt) {
  if (A.state !== 'fight') { fl.grp.position.copy(fl.pos); return; }
  if (fl.carrier) { const q = posOf(fl.carrier); fl.pos.set(q.x, (RUINS_MAP() ? q.y : AR.Y) + 1.2, q.z);
    const mine = A.flags.find(x => x.team === fl.carrier.team);
    if (mine && mine.atHome && Math.hypot(q.x - mine.home.x, q.z - mine.home.z) < 2.4) { A.score[fl.carrier.team]++; feed(`<b style="color:${teamCol(fl.carrier.team)}">${fl.carrier.name}</b> captured the <b style="color:${teamCol(fl.team)}">${COLOR_NAMES[fl.team]}</b> banner!`); cheer(2); bannerAll('Banner captured!', `${teamName(fl.carrier.team)}: ${A.score[fl.carrier.team]} of ${A.target}`); fl.carrier = null; fl.pos.copy(fl.home); fl.atHome = true; checkWin(); } }
  else { if (!fl.atHome) { fl.dropT -= dt; if (fl.dropT <= 0) { fl.pos.copy(fl.home); fl.atHome = true; } }
    for (const f of A.F) { if (!f.alive) continue; const q = posOf(f); if (Math.hypot(q.x - fl.pos.x, q.z - fl.pos.z) > 1.6) continue;
      if (f.team === fl.team) { if (!fl.atHome) { fl.pos.copy(fl.home); fl.atHome = true; feed(`<b style="color:${teamCol(f.team)}">${f.name}</b> returned their banner`); } }
      else if (!A.flags.some(x => x.carrier === f)) { fl.carrier = f; fl.atHome = false; feed(`<b style="color:${teamCol(f.team)}">${f.name}</b> took the <b style="color:${teamCol(fl.team)}">${COLOR_NAMES[fl.team]}</b> banner`); cheer(0.8); break; } } }
  fl.grp.position.copy(fl.pos); fl.cloth.rotation.y = Math.sin(G.time * 3 + fl.team) * 0.3;
}

// ---------------- helpers shared by bots and the player ----------------
const unitOf = (f) => f.you ? G.player : (f.bot || f.rem);
const posOf = (f) => unitOf(f).pos;
const hpOf = (f) => { const u = unitOf(f); return u.hp / u.maxHp; };
function bannerAll(a, b) { A.hooks.banner && A.hooks.banner(a, b); if (AN.on && AN.host) nsend({ t: 'banner', a, b }); }
function feed(html, local) { A.feed.unshift({ html, t: G.time }); A.feed.length = Math.min(A.feed.length, 6); if (AN.on && AN.host && !local) nsend({ t: 'feed', h: html }); }
// every hit from a computer fighter on the player goes through the same PvP rules as an online player's hit
// a red arc round the crosshair pointing at whoever hit you
function dmgDir(from) { const p = G.player; let e = document.getElementById('dmgdir'); if (!e) { e = document.createElement('div'); e.id = 'dmgdir'; document.body.appendChild(e); }
  const a = Math.atan2(from.x - p.pos.x, from.z - p.pos.z) - p.yaw, arc = document.createElement('i'); arc.style.transform = `rotate(${-a}rad)`; e.appendChild(arc); setTimeout(() => arc.remove(), 900); }
function hitPlayer(src, raw, o) {
  const p = G.player; if (!p || p.dead) return 0; if (src && src.pos) dmgDir(src.pos); const dodged = isDodging(p); const [d, o2] = pvpIncoming(p, raw * PVP_K * PACE, ccShape(src, o || {})); const hp0 = p.hp; p.takeDamage(d, src, o2);
  if (p.abCast && p.abCast.spell && Math.random() < 0.35) { p.abCast = null; G.hooks.castBar && G.hooks.castBar(null); G.hooks.toast && G.hooks.toast('Your spell was interrupted', '✋', 'bad'); }
  if (!p.dead && o && o.poison && p.debuff) p.debuff('poison', 4, o.poison * PVP_K * PACE / 4);
  if (!p.dead && o && o.fear && src && src.pos) { p.fearT = Math.max(p.fearT || 0, o.fear); p.fearFrom = src.pos.clone(); G.hooks.toast && G.hooks.toast('You are fleeing in terror!', '💀', 'bad'); }
  if (!p.dead && p.debuff) ccPlayer(p, o2, dodged); // (roots root, silences silence: see the crowd-control rules below)
  const dealt = Math.max(0, hp0 - p.hp); if (src && src.arenaF) src.arenaF.dmg += dealt; return dealt;
}
BX.bot = { hit: (src, tgt, raw, o) => hitUnit(src, tgt, raw, o), foes: (src) => enemiesOf(src) };
NX.bot = { hit: (src, tgt, raw, o) => hitUnit(src, tgt, raw, o), heal: (u, n) => u.healSelf && u.healSelf(n) }; // (computer necromancers' Life Siphon hurts and heals through the arena's rules) // (computer fighters' bombs hurt through the arena's rules)
function hitUnit(src, tgt, raw, o) { if (!tgt || tgt.dead) return 0; if (src && src.arenaBot) { [raw, o] = Game.arenaOut(src, src.h, tgt, raw, o || {}); o = ccShape(src, o); } const d = tgt === G.player ? hitPlayer(src, raw, o) : tgt.takeHit ? (tgt.takeHit(raw, src, o) || 0) : 0; const ls = src && src.arenaBot ? Game.arenaStat(src.h, 'lifesteal') : 0; if (ls && d > 0) src.healSelf(d * 0.03 * ls); if (src && src.h && d > 0) ultGain(src.h, d / 40); return d; }
// ---------- crowd control (docs/CLASS_DESIGN.md, roster-wide rules 1-5) ----------
// a root really roots (no walking, jumping or dodging; you can still aim, shoot and cast); a mesmerize breaks on damage
// after a short grace and lasts 3 s at most; a silence stops abilities but not the basic attack; no hard control lasts
// longer than 1.6 s on one target, 1.0 s from an area wider than 4 m, 2.5 s from an ultimate; and when a hard control
// ends, half a second of immunity follows so chained stuns cannot lock anyone down forever
export const CC = { single: 1.6, area: 1.0, areaR: 4, ult: 2.5, mez: 3, poly: 2.5, mezGrace: 0.75, immune: 0.5, cleanseImm: 1.0 };
const abOf = (u, id) => { const h = u && u.h; return id && h && ABILITIES[h.cls] ? ABILITIES[h.cls].find(a => a.id === id) || null : null; };
export const isAreaAb = (a) => !!a && (a.t === 'nova' ? (a.r || 5) > CC.areaR : (a.spread || 0) > CC.areaR || ['ground', 'aura', 'stormwalk', 'blizzaura'].includes(a.t) || (!a.t && ((LEG[a.id] && LEG[a.id][1] > 1) || a.id === 'earthsplitter')));
// the stun a hit may carry, by what it came from (the ability its source used last)
export function ccShape(src, o) {
  if (!o || !(o.stun || o.freeze)) return o;
  const a = src && G.time - (src._abT ?? -9) < 1.6 ? abOf(src, src._abId) : null, ult = !!(a && src.h && src.h.arenaUlt === a.id);
  const cap = o.mez ? CC.mez : a && a.poly ? CC.poly : ult ? CC.ult : isAreaAb(a) ? CC.area : CC.single;
  const fz = typeof o.freeze === 'number' ? o.freeze : 0; if ((o.stun || 0) <= cap && fz <= cap) return o;
  const out = Object.assign({}, o); if (out.stun) out.stun = Math.min(out.stun, cap); if (fz) out.freeze = Math.min(fz, cap); return out;
}
const isDodging = (p) => (p.ultImmT || 0) > 0 || p.iframes > 0 || !!(p.dodge && !p.dodge.charge);
const dbOn = (p, k) => !!(p && p.db && p.db[k] && p.db[k].t > 0);
const setDb = (p, k, t) => { p.db = p.db || {}; const d = p.db[k] || (p.db[k] = { t: 0, dps: 0 }); d.t = Math.max(d.t, t); };
export const isRooted = (u) => u === G.player ? dbOn(u, 'root') : !!(u && u.status && u.status.root > 0);
export const isSilenced = (u) => u === G.player ? dbOn(u, 'silence') : !!(u && u.status && u.status.silence > 0);
const headOfU = (u) => u.pos.clone().setY(u.pos.y + (u === G.player ? (u.eye || 1.7) + 0.35 : (u.height || 1.8) + 0.5));
// a hit landed on the player (from a computer fighter or another player): apply its control effects
function ccPlayer(p, o2, dodged) {
  playerRules(p); if (!p || p.dead || dodged) return; // (a dodge or an untouchable moment slips the control too)
  const imm = (p.ccImmT || 0) > G.time, st = Math.max(o2.stun || 0, typeof o2.freeze === 'number' ? o2.freeze : 0);
  if (imm && (st || o2.root)) V.number(headOfU(p), 'Immune', 'miss');
  else { if (st) { p.debuff('stun', st); if (o2.mez) { p.mezAt = G.time; p.mezUntil = G.time + st; V.number(headOfU(p), 'Mesmerized', 'bad'); } }
    if (o2.root) { setDb(p, 'root', o2.root); p.rootAt = p.pos.clone(); V.number(headOfU(p), 'Rooted!', 'bad'); } }
  if (o2.slow) p.debuff('slow', o2.slow);
  if (o2.silence) { setDb(p, 'silence', o2.silence); p.abCast = null; V.number(headOfU(p), 'Silenced!', 'bad'); S.error && S.error(); }
  if (o2.weaken) weakUnit(p, o2.weaken);
}
const wakeFx = (u) => { V.number(headOfU(u), 'Woke up', 'miss'); V.burst('arcane', headOfU(u), 10, { speed: 2 }); };
// the rules live on the hero object itself (player.js is left as it is): roots, silence, mesmerize, the shield's defensive
export function playerRules(p = G.player) {
  if (!p || p._ccRules) return p; p._ccRules = true;
  const up = p.update, dodge = p.tryDodge, jump = p.jump, ability = p.ability, ult = p.ultimate, take = p.takeDamage, knock = p.knock, mouse = p.onMouse;
  p.update = function (dt) {
    const r = isRooted(this) && !this.held && !this.dead, k0 = this.ultSlowT, k1 = this.ultSlowK;
    if (r) { this.ultSlowT = G.time + 1; this.ultSlowK = 0; if (!this.rootAt) this.rootAt = this.pos.clone(); } // (no walking: speed 0, so the legs stand still too)
    up.call(this, dt);
    if (r) { if (this.ultSlowK === 0) { this.ultSlowT = k0; this.ultSlowK = k1; } if (!this.held && this.rootAt) { this.pos.x = this.rootAt.x; this.pos.z = this.rootAt.z; if (this.vel) { this.vel.x = 0; this.vel.z = 0; } } } // (nor dashing, blinking or being shoved out of it)
    else this.rootAt = null;
    const hard = !this.dead && (dbOn(this, 'stun') || dbOn(this, 'freeze') || isRooted(this) || this.fearT > 0); if (this._hardWas && !hard) this.ccImmT = G.time + CC.immune; this._hardWas = hard;
    if (this.mezUntil && (G.time > this.mezUntil || !dbOn(this, 'stun'))) this.mezUntil = 0;
    blockDefensive(this, dt);
  };
  p.tryDodge = function (d) { if (isRooted(this)) { V.number(headOfU(this), 'Rooted', 'miss'); return; } return dodge.call(this, d); };
  p.jump = function () { if (isRooted(this) && !this.swim) return; return jump.call(this); };
  p.ability = function (i, fromCast) { const a = ABILITIES[this.h.cls][i]; if (a && this.h.arena) { if (isSilenced(this) && !fromCast) { silencedNote(this); return; } this._abId = a.id; this._abT = G.time; if (a.t === 'stickies' || a.t === 'detonate') { this._abFireId = a.id; this._abFireT = G.time; return bomberKey(this, a, i); } if (a.id === 'drainlife' && this.h.cls === 'necromancer') { if (!this.siphon) { this._abFireId = a.id; this._abFireT = G.time; } return siphonKey(this, a, i); } /* (these keys skip ability(): the model still plays their recording) */ /* (Life Siphon: F on, F off) */ } return ability.call(this, i, fromCast); };
  p.ultimate = function () { if (this.h.arena && isSilenced(this)) { silencedNote(this); return; } return ult.call(this); };
  p.takeDamage = function (dmg, src, o = {}) { const r = take.call(this, dmg, src, o);
    if (dmg > 0 && this.mezUntil > G.time && G.time - (this.mezAt || 0) > CC.mezGrace && this.db && this.db.stun) { this.db.stun.t = 0; this.mezUntil = 0; this.ccImmT = G.time + CC.immune; wakeFx(this); } // (damage wakes you from a mesmerize)
    if (o && o.melee && this.boneT > G.time && src && src !== this && !src.dead) slowUnit(src, 1); return r; }; // (Bone Guard: melee attackers are slowed)
  p.knock = function (v, stun = 0) { if (this.ironT > G.time) { if (stun) this.debuff('stun', stun); return; } return knock.call(this, v, stun); }; // (Iron Hide: cannot be knocked back)
  p.onMouse = function (btn, down) { if (btn === 2 && this.h.arena && RMB_CAST.has(this.h.arenaRmb)) { if (down && this.axeOut && this.axeOut.out) { this.axeOut.out = false; return; } /* (right click again: the thrown axe comes back at once) */ if (down && !this.dead && !G.uiOpen && !dbOn(this, 'stun') && !this.isFrozen()) { const k = ABILITIES[this.h.cls].findIndex(a => a.id === this.h.arenaRmb); if (k >= 0) this.ability(k); } return; } if (btn === 2 && this.h.arena && this.h.arenaRmb === null && this.W) { this.rmbHeld = down && !this.dead && !G.uiOpen; return; } return mouse.call(this, btn, down); }; // (a gun class whose right click is an ability, not aiming; a class with no right-click ability blocks with it, e.g. the Shadow Knight)
  return p;
}
const RMB_CAST = new Set(['ar_ironhide', 'ar_shbash', 'ar_axethrow']); /* (right click casts these at once) */
// ---- a computer bombardier: lob bombs at the target, glue sticky bombs on them (or round itself as a trap when nobody is in sight),
// set them off when enemies are in the blast, and plant Big Bertha where they are bunched up
function botBomb(b, T, dmg, sticky) { const from = b.pos.clone().setY(b.pos.y + (b.height || 1.2) * 0.75).addScaledVector(V3(Math.sin(b.yaw), 0, Math.cos(b.yaw)), 0.35);
  const d = Math.hypot(T.pos.x - from.x, T.pos.z - from.z), fl = Math.max(0.4, Math.min(1.2, d / (sticky ? 22 : 17))), tv = T.vel || V3(), aim = T.pos.clone().addScaledVector(V3(tv.x, 0, tv.z), fl * 0.8);
  aim.x += (Math.random() - 0.5) * d * 0.06; aim.z += (Math.random() - 0.5) * d * 0.06; aim.y += sticky ? (T.height || 1.6) * 0.5 : 0.25; /* (stickies at the body, bombs at the feet; a little scatter with range) */
  const v = lobVel(from, aim, fl); b.yaw = Math.atan2(T.pos.x - b.pos.x, T.pos.z - b.pos.z); return sticky ? throwSticky(b, from, v, dmg) : throwBomb(b, from, v, dmg); }
function bomberBot(b, dt) { if ((b.bombT = (b.bombT || 0) - dt) > 0 || b.status.silence > 0 || b.status.stun > 0) return; b.bombT = 0.15;
  const foes = enemiesOf(b), near = bombsNear(b, foes), live = liveBombs(b, 's').length, s = stickyCharges(b.h), T = b.target;
  const det = abOf(b, 'bo_detonate'), stk = abOf(b, 'bo_stickies');
  // the detonator: a thrown bomb next to someone, or enough sticky bombs on or round them (or the last chance before they get away)
  if (det && near.n && (near.st >= 3 || near.n > near.st || s.n <= 0 || (T && T.hp / T.maxHp < 0.3) || Math.random() < 0.08)) { detonate(b); b.act = 'cast'; b.actT = 0; b.gcd = Math.max(b.gcd, 0.3); return; }
  if (!stk || s.n <= 0 || b.cast || b.dashing) return; const up = Game.perkPow(Game.perkLvl(b.h, stk.id)) * b.up * b.dmgMul(), dmg = b.base * BOMB.sticky.k * up;
  if (T && !T.dead) { const dT = Math.hypot(T.pos.x - b.pos.x, T.pos.z - b.pos.z); if (dT < 22 && (b.stkT = (b.stkT || 0) - 0.15) <= 0) { b.stkT = 0.35 + Math.random() * 0.35; if (botBomb(b, T, dmg, true)) { b.act = 'cast'; b.actT = 0; b.actSp = 2.2; } } return; }
  if (live < 3 && Math.random() < 0.04) { const a = b.yaw + (Math.random() - 0.5) * 2, at = b.pos.clone().add(V3(Math.sin(a) * (3 + Math.random() * 5), 0, Math.cos(a) * (3 + Math.random() * 5))); at.y = gy(at.x, at.z, b.pos.y); /* (a trap of sticky bombs round itself) */
    const from = b.pos.clone().setY(b.pos.y + 1); throwSticky(b, from, lobVel(from, at, 0.6), dmg); } }
function bertWant(b, h, dt) { const foes = enemiesOf(b), n = (r) => foes.filter(u => Math.hypot(u.pos.x - b.pos.x, u.pos.z - b.pos.z) < r).length; h.bertHeld = (h.bertHeld || 0) + 0.25 * dt * 4;
  return n(BOMB.ult.core + 4) >= 2 || n(BOMB.ult.r * 0.6) >= 3 || (n(6) >= 1 && h.bertHeld > 20); } // (into a crowd; or, having waited, on whoever is close)
// ---- a computer necromancer: reaps up close with the scythe; Life Siphon on whoever it faces, kept on while it can see them
export const necroReach = (u) => Math.max(3.4, Math.min(5, (u === G.player ? (u.eye || 1.7) : (u.height || 1.8) * 0.93) * REAP.reachK));
G.hooks.necroReach = necroReach;
function reapBot(b, n) { const R = necroReach(b); let k = 0; for (const u of enemiesOf(b)) { const dx = u.pos.x - b.pos.x, dz = u.pos.z - b.pos.z, d = Math.hypot(dx, dz); if (d > R + (u.radius || 0.5)) continue; const off = Math.atan2(Math.sin(Math.atan2(dx, dz) - b.yaw), Math.cos(Math.atan2(dx, dz) - b.yaw)); if (d > 1.2 && Math.abs(off) > REAP.half + 0.2) continue; hitUnit(b, u, n, { melee: true }); k++; V.burst('blood', u.pos.clone().setY(u.pos.y + 1.1), 10, { speed: 4 }); }
  S.reap && S.reap(b.pos, 1); if (k) { S.reapHit && S.reapHit(b.pos, k); } }
function necroBot(b, dt) { if ((b.necT = (b.necT || 0) - dt) > 0 || siphonOn(b) || b.status.silence > 0 || b.status.stun > 0) return; b.necT = 0.2;
  const a = abOf(b, 'drainlife'), T = b.target; if (!a || (b.cd[a.id] || 0) > 0 || !T || T.dead) return; const d = Math.hypot(T.pos.x - b.pos.x, T.pos.z - b.pos.z), hp = b.hp / b.maxHp;
  if (d < SIPHON.range - 3 && (hp < 0.85 || d > 6 || Math.random() < 0.3)) { const off = Math.atan2(Math.sin(Math.atan2(T.pos.x - b.pos.x, T.pos.z - b.pos.z) - b.yaw), Math.cos(Math.atan2(T.pos.x - b.pos.x, T.pos.z - b.pos.z) - b.yaw)); if (Math.abs(off) < 0.3) { botSiphon(b, a); b.act = 'cast'; b.actT = 0; } } } // (aimed at someone: drink from them, sooner when hurt)
// the Goblin Bombardier's Q (a sticky bomb, from 5 charges) and right click (the detonator), for your own hero
function bomberKey(p, a, i) { if (p.dead || p.swim || p.held || G.uiOpen) return; const key = 'a' + (i + 1);
  if (a.t === 'detonate') { if ((p.cd[key] || 0) > 0) return; p.cd[key] = a.cd || 0.3; const n = detonate(p); S.detonator && S.detonator(); V.burst('spark', p.pos.clone().setY(p.pos.y + 0.9), 6, { speed: 2 }); if (!n) V.number(p.pos.clone().setY(p.pos.y + (p.eye || 1.6) + 0.3), 'No bombs out', 'miss'); return; }
  const h = p.h; h.stkK = Game.perkCd(Game.perkLvl(h, a.id, 'cd')) * Game.arenaCdAll(h); const s = stickyCharges(h); if (s.n <= 0) { S.error && S.error(); return; }
  const fp = p.camDist < 0.6, from = fp ? G.camera.position.clone().add(new THREE.Vector3(0.2, -0.16, -0.75).applyQuaternion(G.camera.quaternion)) : p.handPos(), dir = p.aimDir(from);
  const v = dir.multiplyScalar(BOMB.sticky.speed); v.y += BOMB.sticky.up; const up = (G.abilScale ? G.abilScale(h.level) : 1) * Game.perkPow(Game.perkLvl(h, a.id));
  const b = throwSticky(p, from, v, Game.weaponDamage(h, p.weapon) * BOMB.sticky.k * up); if (!b) return;
  if (p.atk) { p.atk = null; p.queued = null; } p.atk = { name: 'castRel', t: 0.15, dur: 0.4, hit: true, noQueue: true }; S.swing && S.swing(0.8, p.pos);
  const s2 = stickyCharges(h); p.cd[key] = s2.n <= 0 ? s2.next : 0; }
// the rule half of a few abilities (called for players and computer fighters alike, as the ability goes off)
const nearU = (list, at, r) => list.filter(u => u && !u.dead && u.pos && Math.hypot(u.pos.x - at.x, u.pos.z - at.z) < r);
function abilityRule(u, a, T) {
  if (!u || !a || !(u === G.player ? u.h && u.h.arena : u.arenaBot)) return;
  if (a.weaken) for (const e of nearU(ultFoes(u), u.pos, (a.r || 8) + 0.4)) weakUnit(e, a.weaken); // (Intimidating Shout)
  if (a.cleanse) for (const f of nearU(ultFriends(u), u.pos, a.r || 12)) cleanseUnit(f); // (Purifying Light)
  if (a.boneGuard) u.boneT = G.time + (a.dur || 6) * (u === G.player ? 1.3 : 1); // (Bone Guard: melee attackers are slowed while it holds)
  if (a.ironHide) u.ironT = G.time + (a.dur || 5) * (u === G.player ? 1.3 : 1); // (Iron Hide: no knockback)
  if (a.id === 'execute' && u.h && u.h.cls === 'warrior') u.swT = G.time + 1.5; // (Second Wind, see Game.arenaOut)
  if (a.t === 'mindlock') mindLock(u, a, T);
}
G.hooks.abilityRule = abilityRule;
// the Enchanter's Mind Lock: a bolt that silences the enemy it hits and anyone within 3 m of them (abilities, not attacks)
function mindLock(u, a, T) {
  const me = u === G.player, r = a.aoe || 3, sil = a.silence || 2;
  const burst = (at, hitFn) => { for (const e of nearU(ultFoes(u), at, r)) hitFn(e); V.burst('arcane', at, 30, { speed: 4 }); V.ring(at.clone().setY(at.y + 0.05), r, '#d090ff', 0.45); S.cast && S.cast('arcane', at, 0.9); };
  if (me) { const base = Game.weaponDamage(u.h, u.weapon || Game.makeWeapon('quarterstaff', 5, 3)) * (G.abilScale ? G.abilScale(u.h.level) : 1) * Game.perkPow(Game.perkLvl(u.h, a.id)), from = u.spellFrom(), dir = u.aimDir(from);
    spawnProjectile({ pos: from, vel: dir.multiplyScalar(a.speed || 50), grav: 0.5, radius: 0.35, dmg: base * (a.dmg || 0.8), owner: 'player', kind: 'arcane', scale: 1.5, life: 2.5,
      onHit: (pr, m, pos) => { const at = (pos || (m && m.pos) || pr.pos).clone(); burst(at, (e) => { if (e.takeHit && e !== u) u.dealDamage(e, pr.dmg * (e === m ? 1 : 0.8), { el: 'arcane', silence: sil }); if (!e.arenaBot && !(e.owner != null)) silenceUnit(e, sil); }); } });
    u.atk = { name: 'castRel', t: 0.15, dur: 0.5, hit: true, noQueue: true }; return; }
  if (!T || T.dead) return; const pkK = Game.perkPow(Game.perkLvl(u.h, a.id)), dmg = pkK * u.base * (a.dmg || 0.8) * u.up * u.dmgMul(); u.act = 'cast'; u.actT = 0;
  shot(u, T, SHOT_COL.arcane, () => burst(T.pos.clone(), (e) => hitUnit(u, e, dmg * (e === T ? 1 : 0.8), { el: 'arcane', silence: sil })), true);
}
AN.shape = ccShape; // (hits sent to other players carry the same capped control)
function silencedNote(p) { S.error && S.error(); if (!(p._silT > G.time)) { p._silT = G.time + 0.6; V.number(headOfU(p), 'Silenced', 'bad'); } }
// shield classes: hold the block for a second and the class's defensive goes up by itself (Shield Wall, Shield of Light)
export const SHIELD_DEF = new Set(['shieldwall', 'shieldofl']);
function blockDefensive(p, dt) {
  const h = p.h; if (!h || !h.arena || !p.W || p.W.hands !== 'shield' || !SHIELD_DEF.has(h.arenaRmb)) return;
  if (!p.block || p.dead) { p.blockHeldT = 0; return; } p.blockHeldT = (p.blockHeldT || 0) + dt; if (p.blockHeldT < 1) return;
  const k = ABILITIES[h.cls].findIndex(a => a.id === h.arenaRmb); if (k < 0 || (p.cd['a' + (k + 1)] || 0) > 0 || isSilenced(p)) return;
  p.blockHeldT = 0; p.ability(k); p.atk = null; // (the shield stays up)
}
function slowUnit(u, t) { if (!u || u.dead) return; if (u === G.player) u.debuff('slow', t); else if (u.status && u.arenaBot) u.status.slow = Math.max(u.status.slow || 0, t); else if (u.debuff) u.debuff('slow', t); }
// weakened: deals less damage for a while (Game.arenaOut reads weakT and weakK)
function weakUnit(u, w) { if (!u || u.dead) return; const [k, t] = Array.isArray(w) ? w : [0.25, w]; u.weakT = Math.max(u.weakT || 0, G.time + t); u.weakK = 1 - k; V.number(headOfU(u), 'Weakened', 'bad'); }
export function silenceUnit(u, t, src) { if (!u || u.dead) return; if (u === G.player) ccPlayer(u, { silence: t }); else if (u.arenaBot) { u.status.silence = Math.max(u.status.silence || 0, t); u.cast = null; u.pending = null; V.number(headOfU(u), 'Silenced!', 'bad'); } else if (u.takeHit && u.owner != null) u.takeHit(0, src || G.player, { silence: t }); else { u.silenceT = G.time + t; V.number(headOfU(u), 'Silenced!', 'bad'); } }
// cleanse: stun, root, slow, fear, silence, mesmerize, poison, bleed and burn come off, and a moment of immunity follows
export function cleanseUnit(u, imm = CC.cleanseImm) { if (!u || u.dead) return;
  if (u === G.player) { const db = u.db || {}; for (const k of ['stun', 'slow', 'root', 'freeze', 'silence', 'poison', 'bleed', 'burn']) if (db[k]) db[k].t = 0; u.fearT = 0; u.mezUntil = 0; u.ultSlowT = 0; u.ccImmT = G.time + imm; }
  else if (u.arenaBot) { const st = u.status; for (const k of ['stun', 'slow', 'root', 'frozen', 'fear', 'silence', 'bleed', 'burn']) st[k] = 0; st.mez = false; u.dots = []; u.ultSlowT = 0; u.ccImmT = G.time + imm; }
  else if (u.owner != null && u.addBuff) { u.addBuff('cleanse', imm); return; } else return;
  V.burst('gold', u.pos.clone().setY(u.pos.y + 1.2), 24, { speed: 3, vy: 2 }); V.ring(u.pos.clone().setY(u.pos.y + 0.1), 1.4, '#fff4c0', 0.4); V.number(headOfU(u), 'Cleansed', 'heal'); }
// heals and buffs on a team mate (computer or player)
function healUnit(u, amt, from) { if (!u || u.dead || amt <= 0) return; { const sh = from && from.h ? Game.arenaPassive(from.h, 'shieldHeal') : 0; if (sh) { const v = amt * 0.15 * sh; if (u === G.player) { u.buffs.barrier = (u.buffs.barrier || 0) + v; u.buffs.barrierT = Math.max(u.buffs.barrierT || 0, 6); } else if (u.buffs) { u.barrier = (u.barrier || 0) + v; u.buffs.barrier = Math.max(u.buffs.barrier || 0, 6); } } } /* (a healer's perk: heals leave a shield) */ if (u === G.player) { u.heal(amt, true); } else u.healSelf(amt); if (from && from.arenaF) from.arenaF.heal += amt; if (from && from.h) ultGain(from.h, amt / 50); V.burst('heal', u.pos.clone().setY(u.pos.y + 1.2), 12, { speed: 2, vy: 2 }); }
function buffUnit(u, kind, dur) { if (!u || u.dead) return; if (kind === 'cleanse') { cleanseUnit(u, dur); return; } if (u === G.player) { u.buffs[kind] = Math.max(u.buffs[kind] || 0, dur); if (kind === 'barrier') { u.buffs.barrier = u.maxHp * 0.2; u.buffs.barrierT = dur; } } else u.addBuff(kind, dur); V.sphereFlash(u.pos.clone().setY(u.pos.y + 1), 1.2, kind === 'ward' || kind === 'barrier' ? '#80d8ff' : '#ffd84a', 0.4); }
// the player's own heals and buffs that reach allies (healing spells with an area, songs, totems...)
export function allyFx(at, [r, heal, kind, dur], up, quiet) {
  const R = r * Math.sqrt(up); if (!quiet) V.ring(at, R, heal ? '#80ff90' : '#80d8ff', 0.7);
  for (const f of A.F) { const u = unitOf(f); if (!f.you && f.alive && f.team === G.myTeam && u && Math.hypot(u.pos.x - at.x, u.pos.z - at.z) < R) { if (quiet === 'notes') playNotes(G.scene, u, '#ffd860', 5); if (heal) healUnit(u, u.maxHp * heal * up, G.player); if (kind) buffUnit(u, kind === 'haste' ? 'swind' : kind, (dur || 8) * up); } }
}

// ---------------- projectiles and lingering areas (bots) ----------------
const SHOT_COL = { fire: '#ff7a20', frost: '#80d8ff', arcane: '#c080ff', shadow: '#9a60c0', holy: '#ffe080', nature: '#80e060', phys: '#e8d8b0' };
// what a shot looks like: an arrow, a musket ball, or a spell (a bright core in a soft halo of its colour)
const SHOT_GEO = {}; const geoOf = (k, f) => SHOT_GEO[k] || (SHOT_GEO[k] = f());
const addMat = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });
function shotMesh(kind, col, big) {
  const g = new THREE.Group(), k = big ? 1.35 : 1;
  if (kind === 'arrow') { const sh = new THREE.Mesh(geoOf('ash', () => new THREE.CylinderGeometry(0.018, 0.018, 0.85, 5).rotateX(Math.PI / 2)), new THREE.MeshStandardMaterial({ color: '#7a5a3a' })); g.add(sh);
    const tip = new THREE.Mesh(geoOf('atip', () => new THREE.ConeGeometry(0.045, 0.14, 6).rotateX(Math.PI / 2).translate(0, 0, 0.48)), new THREE.MeshStandardMaterial({ color: '#c8ccd2', metalness: 0.8, roughness: 0.3 })); g.add(tip);
    const fl = new THREE.Mesh(geoOf('afl', () => new THREE.PlaneGeometry(0.1, 0.18).rotateX(Math.PI / 2).translate(0, 0, -0.38)), new THREE.MeshStandardMaterial({ color: '#e8e0d0', side: THREE.DoubleSide })); g.add(fl); }
  else if (kind === 'bullet') { g.add(new THREE.Mesh(geoOf('bul', () => new THREE.SphereGeometry(0.05, 8, 6)), addMat('#fff4c8', 1))); const st = new THREE.Mesh(geoOf('bst', () => new THREE.CylinderGeometry(0.025, 0.005, 0.7, 6).rotateX(Math.PI / 2).translate(0, 0, -0.35)), addMat('#ffd080', 0.6)); g.add(st); }
  else if (kind === 'bomb') { g.add(new THREE.Mesh(geoOf('bmb', () => new THREE.SphereGeometry(0.2, 12, 10)), new THREE.MeshStandardMaterial({ color: '#26262a', metalness: 0.7, roughness: 0.45 }))); const sp = new THREE.Mesh(geoOf('bsp', () => new THREE.SphereGeometry(0.06, 6, 5)), addMat('#ffd060', 1)); sp.position.y = 0.28; g.add(sp); }
  else if (kind === 'frost') { g.add(new THREE.Mesh(geoOf('fsh', () => new THREE.OctahedronGeometry(0.14, 0).scale(0.7, 0.7, 1.9)), new THREE.MeshStandardMaterial({ color: '#d8f6ff', emissive: '#60c8ff', emissiveIntensity: 1.3, transparent: true, opacity: 0.9 }))); g.add(new THREE.Mesh(geoOf('halo', () => new THREE.SphereGeometry(0.3, 12, 10)), addMat(col, 0.28))); }
  else { g.add(new THREE.Mesh(geoOf('core', () => new THREE.SphereGeometry(0.12, 12, 10)), addMat('#ffffff', 0.95))); g.add(new THREE.Mesh(geoOf('halo', () => new THREE.SphereGeometry(0.3, 12, 10)), addMat(col, 0.45))); g.add(new THREE.Mesh(geoOf('halo2', () => new THREE.SphereGeometry(0.5, 12, 10)), addMat(col, 0.15))); }
  g.scale.setScalar(k); return g;
}
function shot(src, tgt, col, onHit, big, kind) {
  kind = kind || (src.W && src.W.kind === 'bow' && !big ? 'arrow' : src.W && src.W.kind === 'gun' && !big ? 'bullet' : col === SHOT_COL.frost ? 'frost' : 'orb');
  const m = shotMesh(kind, col, big), from = src.pos.clone().setY(src.pos.y + 1.35).addScaledVector(V3(Math.sin(src.yaw), 0, Math.cos(src.yaw)), 0.6);
  m.position.copy(from); G.scene.add(m); A.shots.push({ m, tgt, onHit, col, t: 0, kind, speed: kind === 'bullet' ? 46 : kind === 'arrow' ? 32 : kind === 'bomb' ? 21 : 22, from: from.clone() });
  if (AN.on && AN.host && src.arenaF) nsend({ t: 'shot', f: src.arenaF.i, to: tgt === G.player ? A.me.i : tgt.arenaF ? tgt.arenaF.i : -1, k: kind, c: col, b: big ? 1 : 0 });
}
function updateShots(dt) {
  for (let i = A.shots.length - 1; i >= 0; i--) { const s = A.shots[i]; s.t += dt; if (s.bp) s.m.position.copy(s.bp); const tp = s.tgt.pos.clone().setY(s.tgt.pos.y + 1.1), d = tp.clone().sub(s.m.position), L = d.length();
    if (L < 0.6 || s.t > 2.5 || s.tgt.dead) { G.scene.remove(s.m); A.shots.splice(i, 1); if (!s.tgt.dead && L < 3) { s.onHit(); if (s.kind === 'orb' || s.kind === 'frost') { V.burst(s.col === SHOT_COL.fire ? 'fire' : s.kind === 'frost' ? 'frost' : 'arcane', tp, 18, { speed: 4 }); V.sphereFlash(tp, 0.8, s.col, 0.2); } else V.burst('spark', tp, 6, { speed: 3 }); } continue; }
    d.normalize(); s.m.position.addScaledVector(d, Math.min(L, s.speed * dt)); s.m.lookAt(tp); if (s.kind === 'orb' || s.kind === 'frost') { V.emit(s.col === SHOT_COL.fire ? 'fire' : s.kind === 'frost' ? 'frost' : 'arcane', s.m.position.clone(), { n: 2, speed: 0.4 }); s.m.children[1] && (s.m.children[1].scale.setScalar(1 + Math.sin(s.t * 30) * 0.15)); }
    if (s.kind === 'bomb') { s.bp = s.m.position.clone(); const tot = s.from ? s.from.distanceTo(tp) : 8, k = 1 - Math.min(1, s.m.position.distanceTo(tp) / Math.max(0.1, tot)); s.m.position.y += Math.sin(k * Math.PI) * Math.min(5, tot * 0.3); s.m.rotation.x += s.t * 9; if (Math.random() < 0.5) V.emit('spark', s.m.position.clone().setY(s.m.position.y + 0.3), { speed: 1.5, size: 0.12 }); } } // spells trail their element and pulse; arrows and shot fly fast and point the way they go
}
function zone(src, at, r, dur, tick, fn, col, follow) { const ring = V3(at.x, AR.Y, at.z); A.zones.push({ src, at: ring, r, dur, tick, acc: 0, fn, col, follow }); V.ring(ring, r, col, Math.min(dur, 1.2)); }
function updateZones(dt) {
  for (let i = A.zones.length - 1; i >= 0; i--) { const z = A.zones[i]; z.dur -= dt; z.acc += dt; if (z.follow && !z.src.dead) z.at.set(z.src.pos.x, AR.Y, z.src.pos.z);
    if (z.acc >= z.tick) { z.acc -= z.tick; V.ring(z.at, z.r, z.col, 0.45); for (const u of enemiesOf(z.src)) if (Math.hypot(u.pos.x - z.at.x, u.pos.z - z.at.z) < z.r) z.fn(u); }
    if (z.dur <= 0 || z.src.dead && !z.keep) A.zones.splice(i, 1); }
}
function enemiesOf(src) { const out = []; for (const f of A.F) if (f.alive && f.team !== src.team) out.push(unitOf(f)); for (const m of G.mobs) if ((m.pet || m.bpet) && !m.dead && m.team !== src.team && (m.team != null)) out.push(m); return out.filter(u => u && !u.dead); }
function alliesOf(src, inclSelf) { return A.F.filter(f => f.alive && f.team === src.team && (inclSelf || unitOf(f) !== src)).map(unitOf).filter(u => u && !u.dead); }

// ---------------- computer fighters ----------------
// (multipliers match what each hand-made ability does for a player, see Player.classGear)
const LEG = { cleavestrike: [1.8, 3, 0], charge: [1.3, 1, 0.5], execute: [2.6, 1, 0], kick: [1.2, 1, 0.8], hamstring: [1.3, 1, 0, 3], earthsplitter: [2.6, 2, 1], whirlwind: [1.8, 3, 0], groundslam: [2.2, 3, 1], warstomp: [0.8, 3, 1.5], intimshout: [0.2, 3, 2],
  spectral: [2.6, 1, 0], pinning: [1.1, 1, 2.5], barrage: [1.6, 2, 0], snaretrap: [0.5, 1, 0, 4], explotrap: [1.8, 2, 0.3], grapeshot: [1.1, 2, 0], volleyfire: [1.65, 2, 0], incendiary: [1.4, 2, 0], powderkeg: [3, 3, 0], cannonade: [2, 2, 0], bayonet: [2.6, 1, 0], caltrops: [0.8, 2, 0, 3],
  earthshock: [1.9, 1, 0], hex: [0.7, 1, 2], stormcall: [1.15, 2, 0], earthbind: [0.4, 3, 0, 4], firering: [1.4, 3, 0], inferno: [3.5, 3, 0], frostnova: [1.4, 3, 1.5], chain: [1.7, 2, 0], missiles: [2.7, 1, 0], lightstorm: [2.2, 2, 0], shieldslam: [1.6, 1, 1], groundpound: [1.4, 3, 1] };
const LEG_RANGED = new Set(['spectral', 'pinning', 'barrage', 'grapeshot', 'volleyfire', 'incendiary', 'powderkeg', 'cannonade', 'earthshock', 'hex', 'stormcall', 'chain', 'missiles', 'lightstorm']);
const LEG_SELF = { shieldwall: ['wall', 6], laststand: ['stand', 10, 0.3], barkskin: ['barrier', 10], mending: ['heal', 6, 0.25], disengage: ['dash', 0], focus: ['cry', 8], bloodrage: ['rage', 10], rampage: ['rampage', 8], battlecry: ['cry', 8], adrenaline: ['heal', 1, 0.2], undying: ['undying', 5], vanish: ['stealth', 4], blink: ['dash', 0], manasurge: ['surge', 8], timewarp: ['swind', 6], invis: ['stealth', 5], quickreload: ['focus', 8], eagleeye: ['focus', 10], smokebomb: ['stealth', 3], stonebanner: ['fort', 10], warbanner: ['cry', 10], vigorbanner: ['heal', 10, 0.25] };
const SUPPORT_CLS = new Set(['cleric', 'druid', 'shaman', 'paladin', 'bard', 'enchanter', 'priest']);
const PET_MOB = { skeleton: 'skeleton', skelmage: 'skeleton', bonegolem: 'golem', tiger: 'tiger', bear: 'bear', direwolf: 'wolf', spirit: 'wolf', wolfpack: 'wolf', flameel: 'imp', frostel: 'skeleton', stormel: 'skeleton', pureel: 'firegiant', phantasm: 'skeleton' };
let botId = 70000;
class ArenaBot {
  constructor(f, h) {
    this.arenaBot = true; this.arenaF = f; this.h = h; this.id = botId++; this.team = f.team; this.heroName = f.name; this.cls = h.cls; this.hostile = f.team !== G.myTeam;
    this.pos = V3(0, AR.Y, 0); this.yaw = 0; this.radius = 0.65; /* a little easier to hit than a monster this size */ this.lv = this.level = LEVEL_CAP; this.stealth = 0; this.iframes = 0; this.provoked = true; this.state = 'chase';
    this.status = { frozen: 0, stun: 0, slow: 0, root: 0, bleed: 0, bleedDps: 0, burn: 0, burnDps: 0, knock: V3() };
    this.def = { name: f.name, aggro: 1, boss: false, elite: false, skin: false, loot: null, size: 1, shape: 'human', armor: 0 };
    const w = h.equip.w1, wt = w ? w.wt : CLASSES[h.cls].weapons[0]; this.W = WEAPON_TYPES[wt] || WEAPON_TYPES.sword;
    const ch = buildHumanoid({ race: h.race, sex: h.sex, cls: h.cls, outfit: h.cls, app: h.app, ...(h.app || {}), spec: arenaSpec(h.cls), body: arenaBody(h.cls) }); this.model = ch; this.root = ch.root; this.height = ch.height || 1.8; arenaDecor(ch, h.cls);
    try { equipWeapon(ch, CLASSES[h.cls].weapons.includes('swordshield') && h.equip.w2 ? 'swordshield' : wt, 3, 0); arenaWeaponDecor(ch, h.cls); } catch (e) { /* unknown weapon model */ }
    try { bake(ch.root); this.flashMats = Object.values(ch.bakedMats || {}); } catch (e) { this.flashMats = []; } addOutline(ch.root, f.team !== G.myTeam ? '#8a0c06' : '#0a2a66'); /* (enemies wear a red edge, friends a blue one: readable at any range) */ // (its own materials, so a hit can flash this fighter alone)
    this.ranged = ['bow', 'gun', 'staff'].includes(this.W.kind) && h.cls !== 'necromancer'; this.range = this.ranged ? (this.W.kind === 'gun' ? 16 : 15) : h.cls === 'necromancer' ? necroReach(this) - 0.4 : 2.6; /* (the necromancer reaps with his scythe up close) */
    this.abs = [...(h.arenaKit || []), h.arenaRmb].filter(id => id && id !== 'aim').map(id => ABILITIES[h.cls].find(a => a.id === id)).filter(Boolean); this.cd = {}; for (const a of this.abs) this.cd[a.id] = Math.random() * 3;
    this.healer = this.abs.some(a => a.t === 'heal' && (a.ally || SUPPORT_CLS.has(h.cls)));
    this.buffs = {}; this.hots = []; this.dots = []; this.gcd = 0; this.swingT = 0; this.thinkT = 0; this.strafe = Math.random() < 0.5 ? 1 : -1; this.act = ''; this.actT = 0; this.spd = 0; this.pets = [];
    this.role = Math.random() < 0.5 ? 'attack' : 'defend'; this.recalc(); this.hp = this.maxHp; if (h.cls === 'warrior') preloadBanners();
    G.scene.add(this.root); G.mobs.push(this);
    teamRim(this.flashMats, f.team !== G.myTeam); // red glow for enemies, blue for your side (no circles)
  }
  get name() { return this.heroName; }
  get owner() { return null; }
  // the same hotbar a player has: five support abilities (keys 1-5) and the three best attacks (F, C, Q)
  loadout() {
    const pr = (a) => a.t === 'heal' || a.t === 'hot' ? 0 : a.t === 'summon' ? 1 : (a.t === 'buff' && ['ward', 'fort', 'stand', 'barrier', 'iceblock', 'phase', 'undying'].includes(a.buff)) ? 2 : a.eq ? 4 : 3;
    const sup = this.abs.filter(a => isSupport(a)).sort((x, y) => pr(x) - pr(y)).slice(0, 5);
    const dmg = this.abs.filter(a => !isSupport(a)).sort((x, y) => this.power(y) / Math.max(1.5, y.cd || 6) - this.power(x) / Math.max(1.5, x.cd || 6)).slice(0, 3);
    this.abs = [...sup, ...dmg];
  }
  recalc() { const D = Game.heroDerived(this.h); this.D = D; this.baseHp = D.maxHp; this.maxHp = Math.round(D.maxHp * Game.arenaHpK(this.h)); this.base = Game.weaponDamage(this.h, this.h.equip.w1 || Game.makeWeapon('sword', 5, 3)); this.up = G.abilScale ? G.abilScale(LEVEL_CAP) : 1.675; }
  dist2(p) { const dx = p.x - this.pos.x, dz = p.z - this.pos.z; return dx * dx + dz * dz; }
  revive(sp) { this.dead = false; this.root.visible = true; this.root.rotation.set(0, sp.yaw, 0); this.hp = this.maxHp; this.pos.set(sp.x, gy(sp.x, sp.z, 6), sp.z); this.yaw = sp.yaw; for (const k in this.status) if (typeof this.status[k] === 'number') this.status[k] = 0; this.buffs = {}; this.hots = []; this.dots = []; this.cast = null; this.stealth = 0; this.carry = null; }
  prebuff() { // EverQuest-style stat buffs go up before the gates open, on itself and (support classes) its team
    for (const a of this.abs) if (a.eq) { const v = {}; for (const [k, [b, per]] of Object.entries(a.eq)) v[k] = Math.round(b + per * LEVEL_CAP); this.h.sb = this.h.sb || {}; this.h.sb[a.id] = Object.assign({ t: 999, name: a.name }, v);
      if (SUPPORT_CLS.has(this.cls)) for (const u of alliesOf(this)) { if (u === G.player) { const ph = G.save; ph.sb = ph.sb || {}; ph.sb[a.id + '_' + this.id] = Object.assign({ t: 999, name: a.name + ' (' + this.heroName + ')', text: '' }, v); u.refreshStatsOnly && u.refreshStatsOnly(); } else if (u.h) { u.h.sb = u.h.sb || {}; u.h.sb[a.id + '_' + this.id] = Object.assign({ t: 999 }, v); u.recalc(); } } }
    const k = this.hp / this.maxHp; this.recalc(); this.hp = this.maxHp * k;
  }
  healSelf(n) { if (this.dead) return; this.hp = Math.min(this.maxHp, this.hp + n * Game.arenaHealK(this.h)); }
  heal(n) { this.healSelf(n); }
  addBuff(kind, dur) { this.buffs[kind] = Math.max(this.buffs[kind] || 0, dur); if (kind === 'barrier') this.barrier = this.maxHp * 0.22; }
  dmgMul() { let k = (this.transcendT > 0 ? 1.5 : 1) * (this.bannerT > G.time ? 1.2 : 1); const b = this.buffs; if (b.cry > 0) k *= 1.3; if (b.rage > 0) k *= 1.15; if (b.surge > 0) k *= 1.2; if (b.lich > 0) k *= 1.4; if (b.form > 0) k *= 1.35; if (b.avatar > 0 && this.av && this.av.dmg) k *= this.av.dmg; return k; }
  // ---- being hit (by the player, a team mate's enemy, a pet...) ----
  takeHit(dmg, src, o = {}) {
    if (this.dead || A.state !== 'fight' || this.invulnT > G.time) return 0; const b = this.buffs; if (this.bannerT > G.time || this.defBannerT > G.time) dmg *= 0.6; /* (War Banner) */
    if (b.iceblock > 0 || b.phase > 0) { V.number(this.pos.clone().setY(this.pos.y + this.height + 0.3), 'Immune', 'miss'); return 0; }
    if (src && src.team === this.team) return 0;
    dmg *= PVP_K * PACE * Game.arenaTakenK(this.h); dmg = Game.arenaIn(this, this.h, dmg, o); if (src && src.hexUntil > G.time) dmg *= 0.65;
    { const th = Game.arenaPassive(this.h, 'thorns'); if (th && o.melee && src && !src.dead && src.pos) { const r2 = dmg * 0.08 * th; if (src === G.player) src.takeDamage(r2, this, { silent: true }); else if (src.arenaBot) { src.hp -= r2; if (src.hp <= 0) src.die(this); } } }
    const red = this.D.armor / (this.D.armor + 40 + LEVEL_CAP * 12); dmg *= 1 - red;
    if (b.ward > 0) dmg *= 0.6; if (b.wall > 0) dmg *= 0.4; if (b.fort > 0) dmg *= 0.7; if (b.stand > 0) dmg *= 0.75; if (b.lich > 0) dmg *= 0.75; if (b.avatar > 0 && this.av && this.av.taken) dmg *= this.av.taken;
    if (this.arcShield > 0 && G.time < this.arcShieldT) { const ab = Math.min(this.arcShield, dmg); this.arcShield -= ab; dmg -= ab; this.arcHitT = G.time; if (dmg <= 0) return 0; } /* (Arcane Shield soaks it up) */
    if (this.barrier > 0 && b.barrier > 0) { const ab = Math.min(this.barrier, dmg); this.barrier -= ab; dmg -= ab; }
    dmg = Math.max(1, Math.round(dmg)); const hp0 = this.hp; this.hp -= dmg; this.hurtT = G.time; this.lastHitBy = src; if (b.undying > 0 && this.hp < 1) this.hp = 1;
    // you can see it land: a flinch, a bright flash on the body, and blood or sparks (or the spell's element)
    this.hitT = 0.32; for (const m of this.flashMats) { if (m.emissive) { m.emissive.setRGB(1, 0.92, 0.85); m.emissiveIntensity = 0.65; } }
    { const at = this.pos.clone().setY(this.pos.y + 1.15), kind = o.el === 'fire' ? 'fire' : o.el === 'frost' ? 'frost' : o.el ? 'arcane' : this.D.armor > 120 ? 'spark' : 'blood'; V.burst(kind, at, o.melee || dmg > this.maxHp * 0.08 ? 14 : 7, { speed: 3.5 }); }
    if (src && src.pos && !o.el && !(this.ironT > G.time)) { const d = this.pos.clone().sub(src.pos).setY(0); if (d.lengthSq() > 0.01) this.status.knock.addScaledVector(d.normalize(), o.melee ? 0.9 : 0.4); }
    { const real = Math.min(dmg, Math.max(0, hp0)); if (src && src.arenaF) src.arenaF.dmg += real; else if (src === G.player) A.me.dmg += real; } // (only the health actually taken counts)
    // control effects fall off when chained, like they do on players
    { const st = this.status; if (st.mez && st.stun > 0 && !o.mez && G.time - (this.mezAt ?? G.time) > CC.mezGrace) { st.stun = 0; st.mez = false; this.mezAt = null; this.ccImmT = G.time + CC.immune; wakeFx(this); } } // (damage wakes a mesmerized fighter)
    if (o.melee && this.boneT > G.time && src && src !== this) slowUnit(src, 1); // (Bone Guard)
    o = ccShape(src, o); const imm = (this.ccImmT || 0) > G.time; if (imm && (o.stun || o.freeze || o.root || o.fear)) { V.number(headOfU(this), 'Immune', 'miss'); o = Object.assign({}, o, { stun: 0, freeze: 0, root: 0, fear: 0 }); }
    if (o.silence) { const now = G.time; if (!this.silT || now - this.silT > 10) this.silN = 0; const sf = Math.pow(0.5, this.silN || 0); this.silN = (this.silN || 0) + 1; this.silT = now; this.status.silence = Math.max(this.status.silence || 0, o.silence * sf); this.cast = null; this.pending = null; V.number(headOfU(this), 'Silenced!', 'bad'); }
    if (o.weaken) weakUnit(this, o.weaken);
    if (o.stun || o.freeze || o.slow || o.root || o.fear) { const now = G.time; if (!this.ccT || now - this.ccT > 10) this.ccN = 0; const f = Math.pow(0.5, this.ccN || 0); this.ccN = (this.ccN || 0) + 1; this.ccT = now;
      if (o.stun && o.knock && this.model) { this.model.kdLeft = Math.max(this.model.kdLeft || 0, Math.min(3.0, Math.max(2.7, o.stun * f + 1.4))); this.status.stun = Math.max(this.status.stun || 0, this.model.kdLeft - 0.35); this.cast = null; this.pending = null; } /* (knocked down: the recorded fall plays, and he can neither move nor attack until he is back on his feet (the owner)) */
      if (o.stun || o.freeze) { this.status.stun = Math.max(this.status.stun, (o.stun || o.freeze) * f); this.status.mez = !!o.mez; if (o.mez) this.mezAt = G.time; this.cast = null; this.pending = null; } if (o.fear && src && src.pos) { this.status.fear = Math.max(this.status.fear || 0, o.fear * f); this.fearFrom = src.pos.clone(); this.cast = null; this.pending = null; this.dashing = null; V.number(this.pos.clone().setY(this.pos.y + this.height + 0.5), 'Feared!', 'crit'); } if (o.slow) this.status.slow = Math.max(this.status.slow, o.slow * f); if (o.root) this.status.root = Math.max(this.status.root, o.root * f); }
    if (o.blight) this.blightT = Math.max(this.blightT || 0, o.blight); if (this.blightT > 0 && o.poison) o = Object.assign({}, o, { poison: o.poison * 1.5 }); // (Blight: poison bites harder)
    if (o.poison) { const ex = this.dots.find(x => x.spread != null && x.src === src); if (ex) { ex.t = 4; ex.dps = Math.max(ex.dps, o.poison * PVP_K / 4); } else this.dots.push({ dps: o.poison * PVP_K / 4, t: 4, src, spread: o.spread || 0 }); } // a necromancer's poison: it can creep onto enemies standing close
    if (o.plague) { const ex = this.dots.find(x => x.plague && x.src === src); if (ex) { ex.t = 6; ex.dps = Math.max(ex.dps, o.plague * PVP_K); } else this.dots.push({ dps: o.plague * PVP_K, t: 6, src, plague: true, acc: 0 }); } // (Plague Breath: a sore that bites once a second for 6 s)
    if (o.bleed) this.dots.push({ dps: o.bleed * PVP_K / 4, t: 4, src }); if (o.burn) { const ex = this.dots.find(x => x.fire && x.src === src); if (ex) { ex.t = 4; ex.dps = Math.max(ex.dps, o.burn * PVP_K / 4); } else this.dots.push({ dps: o.burn * PVP_K / 4, t: 4, src, fire: true, acc: 0 }); } /* (one burn per attacker, refreshed by each fiery hit) */
    if (this.cast && Math.random() < 0.35) this.cast = null; // hits can break a spell being cast
    if (this.hp <= 0) this.die(src);
    return dmg;
  }
  takeDamage(dmg, src, o) { return this.takeHit(dmg / PVP_K, src, o); } // (pet and creature hits)
  debuff(type, t) { if (type === 'stun') this.status.stun = Math.max(this.status.stun, t); else if (type === 'slow') this.status.slow = Math.max(this.status.slow, t); }
  knock() {} respawn() {} remove() { G.scene.remove(this.root); }
  die(src) { this.hp = 0; this.dead = true; this.deadT = 0; this.cast = null; for (const pm of this.pets) pm.dead = true; fighterDied(this.arenaF, src); }
  // ---- thinking ----
  update(dt) {
    const st = this.status;
    if (this.dead) { this.deadT += dt; const k = Math.min(1, this.deadT / 0.6); this.root.rotation.x = -k * k * Math.PI / 2; this.root.position.y = AR.Y + 0.12 * k; return; } // the fallen lie where they fell until they get up again
    if (this.held) { this.hitT = 0; return; } // (in a demon's grip: it moves and turns you)
    this.root.rotation.x = 0;
    for (const k in this.buffs) this.buffs[k] = Math.max(0, this.buffs[k] - dt);
    { const hard0 = st.stun > 0 || st.root > 0 || st.frozen > 0 || st.fear > 0; for (const k of ['stun', 'slow', 'root', 'frozen', 'fear', 'silence']) st[k] = Math.max(0, (st[k] || 0) - dt);
      if (hard0 && !(st.stun > 0 || st.root > 0 || st.frozen > 0 || st.fear > 0)) this.ccImmT = G.time + CC.immune; /* (a hard control just ended: a moment of immunity) */ if (st.mez && st.stun > 0) { if (this.mezAt == null) this.mezAt = G.time; } else { st.mez = false; this.mezAt = null; } }
    if (this.hitT > 0) { this.hitT = Math.max(0, this.hitT - dt); const f = this.hitT / 0.32; for (const m of this.flashMats) if (m.emissive) m.emissiveIntensity = 0.65 * f * f; }
    if (this.stealth > 0) { this.stealth = Math.max(0, this.stealth - dt); }
    for (let i = this.hots.length - 1; i >= 0; i--) { const h = this.hots[i]; h.t -= dt; this.healSelf(h.ps * dt); if (h.t <= 0) this.hots.splice(i, 1); }
    for (const d of this.dots) if (d.spread > 0 && Math.random() < dt * 0.9) { d.spread--; const nb = A.F.map(unitOf).find(u => u && u !== this && !u.dead && u.team === this.team && u.takeHit && u.dots && Math.hypot(u.pos.x - this.pos.x, u.pos.z - this.pos.z) < 4.5 && !(u.dots || []).some(x => x.spread != null)); if (nb) { nb.dots.push({ dps: d.dps, t: 4, src: d.src, spread: 0 }); V.burst('green', nb.pos.clone().setY(nb.pos.y + 1), 14, { speed: 2 }); } }
    for (const d of this.dots) if (d.fire) burnFx(this, d, dt);
    this.blightT = Math.max(0, (this.blightT || 0) - dt); for (let i = this.dots.length - 1; i >= 0; i--) { const d = this.dots[i]; d.t -= dt; if (d.plague) { d.acc += dt; if (d.acc >= 1) { d.acc -= 1; const n = d.dps * (this.blightT > 0 ? 1.5 : 1); this.hp -= n; V.number(this.pos.clone().setY(this.pos.y + 2.1), String(Math.round(n / PVP_K)), 'dmg'); V.burst('poison', this.pos.clone().setY(this.pos.y + 1.2), 10, { speed: 1.5 }); } } else this.hp -= d.dps * dt * (d.spread != null && this.blightT > 0 ? 1.5 : 1); if (d.t <= 0) this.dots.splice(i, 1); if (this.hp <= 0) { this.die(d.src); return; } }
    if (this.barrageT > 0) { this.barrageT -= dt; this.barrageCd = (this.barrageCd || 0) - dt; const Tg = this.target; if (Tg && !Tg.dead && this.barrageCd <= 0 && Math.hypot(Tg.pos.x - this.pos.x, Tg.pos.z - this.pos.z) < 30) { this.barrageCd = 0.09; this.yaw = Math.atan2(Tg.pos.x - this.pos.x, Tg.pos.z - this.pos.z); shot(this, Tg, '#b0a0ff', () => hitUnit(this, Tg, this.base * 0.32 * this.up * this.dmgMul(), {}), false, 'bullet'); V.emit('arcane', this.pos.clone().setY(this.pos.y + 1.4).addScaledVector(V3(Math.sin(this.yaw), 0, Math.cos(this.yaw)), 0.9), { speed: 2, size: 0.3, life: 0.2 }); } }
    for (const k in this.cd) this.cd[k] -= dt; this.gcd -= dt; this.swingT -= dt;
    if (this.act) { this.actT += dt * (this.actSp || 1.6); if (this.actT >= 1) { this.act = ''; this.actT = 0; } }
    if (this.pending && (this.pending.t -= dt) <= 0) { const f = this.pending.fn; this.pending = null; if (!(st.stun > 0)) f(); }
    let speed = 0;
    if (this.dashing) { const D = this.dashing, step = Math.min(D.left, 13 * dt * Math.min(1, 0.4 + D.t * 3)); D.t += dt; D.left -= step; this.pos.addScaledVector(D.dir, step); speed = 13; this.yaw = Math.atan2(D.dir.x, D.dir.z); if (Math.random() < 0.3) V.burst('dust', this.pos.clone().setY(this.pos.y + 0.2), 3, { speed: 2 }); if (D.left <= 0.01 || D.t > 1.2) { this.dashing = null; D.onEnd(); } }
    else if (A.state === 'fight' && st.fear > 0 && !(st.stun > 0) && this.fearFrom) { // feared: run blindly away, arms up
      const d = V3(this.pos.x - this.fearFrom.x, 0, this.pos.z - this.fearFrom.z); if (d.lengthSq() < 0.01) d.set(1, 0, 0); d.normalize(); d.applyAxisAngle(V3(0, 1, 0), Math.sin(G.time * 2 + this.arenaF.i) * 0.5);
      const fa = Math.atan2(d.x, d.z); this.yaw += Math.atan2(Math.sin(fa - this.yaw), Math.cos(fa - this.yaw)) * Math.min(1, dt * 6); this.pos.addScaledVector(V3(Math.sin(this.yaw), 0, Math.cos(this.yaw)), 5.2 * dt); speed = 5.2; this.cast = null;
      if (Math.random() < dt * 3) V.emit('shadow', this.pos.clone().setY(this.pos.y + this.height + 0.2), { speed: 0.5, size: 0.3, life: 0.6 }); }
    else if (A.state === 'pick' && !(st.stun > 0)) speed = this.pickTick(dt);
    else if (A.state === 'fight' && !(st.stun > 0) && !(st.frozen > 0)) {
      if ((this.thinkT -= dt) <= 0) { this.thinkT = 0.25 + Math.random() * 0.1; this.think(); }
      if (this.cast) { const c = this.cast; c.t += dt; if (c.wind && c.tgt && c.tgt.pos) { const fa = Math.atan2(c.tgt.pos.x - this.pos.x, c.tgt.pos.z - this.pos.z); this.yaw += Math.atan2(Math.sin(fa - this.yaw), Math.cos(fa - this.yaw)) * Math.min(1, dt * 5); }
        if (c.wind && !c.melee && Math.random() < 0.5) V.emit('spark', this.pos.clone().setY(this.pos.y + 1.5), { n: 1, speed: 0.6 }); // a glow gathers in the caster's hands
        if (c.t >= c.dur) { this.cast = null; if (c.melee) { this.act = 'swing2'; this.actT = 0.42; this.actSp = 1.6; } this.resolve(c.a, c.tgt, c.at); } }
      else { speed = this.move(dt); if (this.cls === 'bombardier') bomberBot(this, dt); if (this.cls === 'necromancer') necroBot(this, dt); this.fight(); }
    }
    // knockback
    if (st.knock && st.knock.lengthSq() > 0.01) { this.pos.addScaledVector(st.knock, dt * 6); st.knock.multiplyScalar(Math.max(0, 1 - dt * 6)); }
    confine(this.pos, 1);
    if (RUINS_MAP()) worldCollide(this.pos, 0.45); this.pos.y = gy(this.pos.x, this.pos.z, this.pos.y); this.root.position.copy(this.pos); this.root.rotation.y = this.yaw;
    const vis = !(this.stealth > 0 && this.team !== G.myTeam); this.root.visible = (vis || Math.hypot(this.pos.x - G.player.pos.x, this.pos.z - G.player.pos.z) < 3) && !(G.camera && G.camera.position.distanceTo(this.pos.clone().setY(this.pos.y + 1)) < 1.15); // (hidden when the camera is inside them)
    this.spd += (speed - this.spd) * Math.min(1, dt * 8);
    { const tr = Math.atan2(Math.sin(this.yaw - (this.prevYaw ?? this.yaw)), Math.cos(this.yaw - (this.prevYaw ?? this.yaw))) / Math.max(dt, 1e-3); this.prevYaw = this.yaw; this.turnR = (this.turnR || 0) + (tr - (this.turnR || 0)) * Math.min(1, dt * 8); }
    arenaLookTick(this.model, dt); if (G.player && this.model) { const near = this.pos.distanceToSquared(G.player.pos) < 900; if (near !== this.model.detailOn) setDetail(this.model, near); } // (close-up detail only within 30 m)
    const c = this.cast; animateHumanoid(this.model, dt, { turn: this.turnR, speed: this.hoverH > 0.15 ? 0 : this.spd, action: (c ? (c.melee ? 'swing2' : 'castUp') : this.act) || null, actionT: c ? (c.melee ? 0.42 * Math.min(1, c.t / c.dur) : Math.min(1, c.t / c.dur)) : this.actT, armed: true, hit: this.hitT > 0.16 ? (this.hitT - 0.16) * 4 : 0 });
    if (this.cls === 'bard') luteToChest(this.model, !!this.h.arenaSongs && !this.cast && !this.act && !this.dead, G.time, dt);
    bodyPoseTick(this, this.model, dt); // (kicks)
  }
  // the holding room before the gates lift: take your place facing the gate, then bless the room (healers shield
  // everyone with them, the others roar a war cry), shuffle and look about like someone waiting to fight
  pickTick(dt) {
    const f = this.arenaF, sp = spawnOf(f), me = this.pos; this.pickT = (this.pickT || 0) + dt; if (this.buffAt == null) this.buffAt = 3 + Math.random() * 9;
    const dx = sp.x - me.x, dz = sp.z - me.z, d = Math.hypot(dx, dz); let speed = 0;
    if (d > 0.35) { const v = Math.min(2.6, d * 2); me.x += dx / d * v * dt; me.z += dz / d * v * dt; speed = v; }
    const face = d > 0.6 ? Math.atan2(dx, dz) : sp.yaw + Math.sin(this.pickT * 0.4 + f.i) * 0.35; this.yaw += Math.atan2(Math.sin(face - this.yaw), Math.cos(face - this.yaw)) * Math.min(1, dt * 3);
    if (!this.buffed && this.pickT > this.buffAt) { this.buffed = true; this.act = 'castUp'; this.actT = 0; this.actSp = 0.9; const rm = roomOf(me.x, me.z), dur = Math.max(1, A.t) + 15;
      if (SUPPORT_CLS.has(this.cls)) { const col = { cleric: '#fff0a0', paladin: '#ffd860', shaman: '#80d8ff', druid: '#90e060', bard: '#ff90d0', enchanter: '#d090ff' }[this.cls] || '#ffffff';
        for (const g of A.F) { const u = unitOf(g); if (!u || u.dead || g.team !== f.team) continue; const ur = roomOf(u.pos.x, u.pos.z); if (rm && ur && ur.k !== rm.k) continue;
          if (u === G.player) { u.buffs.barrier = Math.max(u.buffs.barrier || 0, u.maxHp * 0.12); u.buffs.barrierT = Math.max(u.buffs.barrierT || 0, dur); A.hooks.toast && A.hooks.toast(`${this.heroName} shields you with a blessing`, '✦', 'gold'); }
          else if (u.buffs) { u.buffs.barrier = Math.max(u.buffs.barrier || 0, dur); u.barrier = Math.max(u.barrier || 0, u.maxHp * 0.12); }
          V.sphereFlash(u.pos.clone().setY(u.pos.y + 1.1), 1.1, col, 0.6); V.burst('gold', u.pos.clone().setY(u.pos.y + 1.2), 14, { speed: 2, vy: 2 }); }
        V.ring(me, 4, col, 0.8); S.cast && S.cast('holy', me, 0.8); }
      else { V.burst('ember', me.clone().setY(me.y + 1.4), 26, { speed: 4 }); V.ring(me, 2.4, '#ff8040', 0.5); S.battleCry && S.battleCry(); this.buffs.cry = Math.max(this.buffs.cry || 0, dur * 0.5); } }
    return speed;
  }
  // the Ruins: walk the bot's lane (left rampart, middle street, right garden) toward its target or the centre,
  // unless the target is close and in plain sight, when it fights in the open as usual
  // each computer fighter has its own habits, so a team doesn't move like one machine
  persona() { if (!this.pers) { const r = (a, b) => a + Math.random() * (b - a); this.pers = { teamW: r(0.12, 0.55), stick: Math.random(), off: r(-1.6, 1.6), wait: r(0, 3.2), chase: r(14, 26) }; } return this.pers; }
  laneStep(T) { const me = this.pos, Pp = this.persona(), lane = RUINS.lanes[this.lane != null ? this.lane : (this.lane = this.arenaF.i % 3)];
    if (this.dead) { this.laneT0 = null; } else if (this.laneT0 == null) this.laneT0 = G.time; if (!T && G.time - (this.laneT0 || 0) < Pp.wait) return [me.x, me.z]; // (they don't all leave the gate on the same frame)
    if (T && Math.hypot(T.pos.x - me.x, T.pos.z - me.z) < 13 && lineClear(me.clone().setY(me.y + 1.5), T.pos.clone().setY(T.pos.y + 1.2))) return null;
    let near = 0, nd = 1e9; lane.forEach((w, i) => { const d = Math.hypot(w[0] - me.x, w[1] - me.z); if (d < nd) { nd = d; near = i; } });
    if (this.wpi == null || Math.hypot(lane[this.wpi][0] - me.x, lane[this.wpi][1] - me.z) > 18) this.wpi = near; // (remember the waypoint it is walking to)
    let goalZ = T ? T.pos.z : (this.team === teamsOf()[0] ? 6 : -6);
    if (T) { // the enemy is on another route: go back to the plaza where the routes meet, then take theirs
      let tl = this.lane, td = 1e9; RUINS.lanes.forEach((L2, li) => L2.forEach(w => { const d = Math.hypot(w[0] - T.pos.x, w[1] - T.pos.z); if (d < td) { td = d; tl = li; } }));
      if (tl !== this.lane && td < 12 && (Pp.stick < 0.55 || Math.hypot(T.pos.x - me.x, T.pos.z - me.z) < Pp.chase)) { if (Math.abs(me.z) < 7) { this.lane = tl; this.wpi = null; return this.laneStep(T); } goalZ = 0; } /* (stubborn ones keep pushing their own route unless the enemy is close) */
      else if (Math.hypot(T.pos.x - me.x, T.pos.z - me.z) < 24 && Math.abs(lane[this.wpi][1] - T.pos.z) < 5) return null; } // (same route and level with them: go straight at them)
    const dir = goalZ > lane[this.wpi][1] ? 1 : -1;
    if (Math.hypot(lane[this.wpi][0] + Pp.off - me.x, lane[this.wpi][1] - me.z) < 2.4) this.wpi = Math.max(0, Math.min(lane.length - 1, this.wpi + dir)); /* (measured to the point it actually walks to) */
    { const k = this.stk; if (!k || Math.hypot(me.x - k.x, me.z - k.z) > 0.6) this.stk = { x: me.x, z: me.z, t: G.time }; else if (G.time - k.t > 2.5) { this.wpi = Math.max(0, Math.min(lane.length - 1, this.wpi + dir)); this.side = (Math.random() < 0.5 ? -1 : 1) * 2.5; this.sideT = G.time + 1.2; this.stk = null; } } // (wedged for a while: step to one side and go on to the next point)
    const w = lane[this.wpi], sd = G.time < (this.sideT || 0) ? this.side : 0; return [w[0] + Pp.off + sd, w[1]]; } /* (each walks a little to one side of the line, not in single file) */
  // pick who to fight and what to do: focus the team's target, protect healers, play the objective
  think() {
    const foes = enemiesOf(this).filter(u => (!(u.stealth > 0) || Math.hypot(u.pos.x - this.pos.x, u.pos.z - this.pos.z) < 3) && (!RUINS_MAP() || Math.hypot(u.pos.x - this.pos.x, u.pos.z - this.pos.z) < 4 || lineClear(this.pos.clone().setY(this.pos.y + 1.5), u.pos.clone().setY(u.pos.y + 1.2)) || u === this.target)), me = this.pos;
    const near = (u) => Math.hypot(u.pos.x - me.x, u.pos.z - me.z);
    // the team's focus: the weakest enemy near the team, shared by every bot on the side
    const mates = alliesOf(this, true), cx = mates.reduce((s, u) => s + u.pos.x, 0) / mates.length, cz = mates.reduce((s, u) => s + u.pos.z, 0) / mates.length;
    let best = null, bs = 1e9;
    for (const u of foes) { const dTeam = Math.hypot(u.pos.x - cx, u.pos.z - cz), dMe = near(u), hpk = (u.hp / u.maxHp);
      let s = dMe * 1.0 + dTeam * this.persona().teamW + hpk * 14; if (u.pet || u.bpet) s += 18; if (u === this.lastHitBy && G.time - (this.hurtT || 0) < 3) s -= 6;
      for (const m of mates) if (m !== this && m.lastHitBy === u && m.healer && G.time - (m.hurtT || 0) < 3) s -= 10; // peel for our healers
      if (s < bs) { bs = s; best = u; } }
    { const cur = this.target; if (cur && cur !== best && !cur.dead && foes.includes(cur)) { const dTeam = Math.hypot(cur.pos.x - cx, cur.pos.z - cz), sc = near(cur) + dTeam * 0.4 + (cur.hp / cur.maxHp) * 14 - 7; if (sc <= bs + 0) best = cur; } } // (stick with a target instead of flipping between them)
    this.target = best;
    // a healer looks after whoever is lowest
    this.ward = null; if (this.healer) { let lo = null, lv = 0.85; for (const m of mates) { const k = m.hp / m.maxHp; if (k < lv && near(m) < 22) { lv = k; lo = m; } } this.ward = lo; }
    // the objective
    this.goal = null; const o = A.setup.objective;
    if (o === 'koth') this.goal = { x: Math.sin(this.id) * 3, z: Math.cos(this.id) * 3, r: 4 };
    if (o === 'ctf') { const mine = A.flags.find(f => f.team === this.team), carry = A.flags.find(f => f.carrier === this.arenaF);
      if (carry) this.goal = { x: mine.home.x, z: mine.home.z, r: 0.5, must: true };
      else if (mine && !mine.atHome && !mine.carrier) this.goal = { x: mine.pos.x, z: mine.pos.z, r: 0.5, must: true };
      else if (mine && mine.carrier) { const cu = unitOf(mine.carrier); this.target = cu; }
      else if (this.role === 'attack') { const theirs = A.flags.find(f => f.team !== this.team && !f.carrier); if (theirs) this.goal = { x: theirs.pos.x, z: theirs.pos.z, r: 0.5 }; else { const ally = A.flags.find(f => f.carrier && f.carrier.team === this.team); if (ally) { const cu = unitOf(ally.carrier); this.goal = { x: cu.pos.x, z: cu.pos.z, r: 3 }; } } }
      else if (mine) this.goal = { x: mine.home.x * 0.8, z: mine.home.z * 0.8, r: 6 }; }
  }
  // where to stand: melee close in, ranged keep their distance and kite, healers stay behind their team
  move(dt) {
    const st = this.status; if (st.root > 0) return 0; if ((this.aimLock = (this.aimLock || 0) - dt) > 0) return 0;
    let tx = this.pos.x, tz = this.pos.z; const T = this.target, me = this.pos;
    const dT = T ? Math.hypot(T.pos.x - me.x, T.pos.z - me.z) : 99;
    if (this.goal && (this.goal.must || dT > 9 || !T)) { tx = this.goal.x; tz = this.goal.z; if (Math.hypot(tx - me.x, tz - me.z) < this.goal.r) { tx = me.x; tz = me.z; } }
    else if (this.healer && this.ward && (!T || dT > 6 || this.hp / this.maxHp < 0.5)) { const w = this.ward.pos; const away = T ? V3(w.x - T.pos.x, 0, w.z - T.pos.z).normalize() : V3(); tx = w.x + away.x * 6; tz = w.z + away.z * 6; }
    else if (T) {
      const dir = V3(T.pos.x - me.x, 0, T.pos.z - me.z).normalize(), side = V3(-dir.z, 0, dir.x);
      if (!this.ranged) { if (dT > 2.0) { tx = T.pos.x - dir.x * 1.6; tz = T.pos.z - dir.z * 1.6; } else { tx = me.x + side.x * this.strafe * 0.25; tz = me.z + side.z * this.strafe * 0.25; } }
      else { const melee = T.arenaBot ? !T.ranged : T === G.player ? (G.player.W && !['bow', 'gun', 'staff'].includes(G.player.W.kind)) : true;
        const want = dT < 5 && melee ? 10 : dT > this.range - 2 ? this.range - 4 : dT; // kite melee, close in when out of range
        tx = T.pos.x - dir.x * want + side.x * this.strafe * 1.4; tz = T.pos.z - dir.z * want + side.z * this.strafe * 1.4; if (Math.random() < 0.0015) this.strafe *= -1; }
    } else { const mates = alliesOf(this); if (mates.length) { const m = mates[0]; tx = m.pos.x + Math.sin(this.id) * 3; tz = m.pos.z + Math.cos(this.id) * 3; } else { tx = 0; tz = 0; } }
    // low on health with no healing: fall back toward a team mate who heals
    if (this.hp / this.maxHp < 0.25 && !this.abs.some(a => a.t === 'heal' || a.t === 'hot')) { const hl = alliesOf(this).find(u => u.healer); if (hl) { tx = hl.pos.x; tz = hl.pos.z; } }
    { const rm = roomOf(me.x, me.z); if (rm && AR.gatesOpen) { if (RUINS_MAP()) { tx = rm.rm.gx + rm.rm.dir[0] * 4; tz = rm.rm.gz + rm.rm.dir[1] * 4; } else { tx = Math.sin(rm.a) * (AR.R - 4); tz = Math.cos(rm.a) * (AR.R - 4); } } else if (RUINS_MAP() && !this.goal) { const w = this.laneStep(T); if (w) { tx = w[0]; tz = w[1]; } } } // still in the holding room: out through the gate first
    { const bz = nearestDanger(this); if (bz) { const reach = bz.d / 5.5 + BOMB.ult.defuse + 0.6; if (bz.left > reach && this.hp / this.maxHp > 0.4 && (bz.d < 9 || this.persona().stick > 0.6)) { tx = bz.x; tz = bz.z; } else { const ax = me.x - bz.x, az = me.z - bz.z, al = Math.hypot(ax, az) || 1; tx = bz.x + ax / al * (bz.r + 3); tz = bz.z + az / al * (bz.r + 3); } } } // (an enemy Big Bertha: defuse it if there is time, else run out of its blast)
    // stay apart from everyone else
    let px = 0, pz = 0; for (const f of A.F) { if (!f.alive) continue; const u = unitOf(f); if (u === this) continue; const dx = me.x - u.pos.x, dz = me.z - u.pos.z, d = Math.hypot(dx, dz); if (d < 1.3 && d > 0.01) { px += dx / d * (1.3 - d); pz += dz / d * (1.3 - d); } }
    const mx = tx - me.x + px * 3, mz = tz - me.z + pz * 3, L = Math.hypot(mx, mz);
    const far = !T || dT > 14 || !!roomOf(me.x, me.z); // run between fights, walk-speed footwork inside them (players run 5.2)
    let sp = (far ? 6.4 : 4.6) * Game.arenaSpeedK(this.h) * (this.ringSlowT > G.time ? 0.156 : this.ultSlowT > G.time ? this.ultSlowK : st.slow > 0 ? 0.55 : 1) * (this.buffs.swind > 0 ? 1.3 : 1) * (this.buffs.rampage > 0 ? 1.2 : 1);
    this.vel = this.vel || V3(); const want = L > 0.3 ? V3(mx / L * Math.min(sp, L * 3), 0, mz / L * Math.min(sp, L * 3)) : V3(); this.vel.lerp(want, Math.min(1, dt * 4)); me.x += this.vel.x * dt; me.z += this.vel.z * dt; sp = this.vel.length(); // speed up and slow down, no snapping
    const face = T ? Math.atan2(T.pos.x - me.x, T.pos.z - me.z) : L > 0.3 ? Math.atan2(mx, mz) : this.yaw; this.yaw += Math.atan2(Math.sin(face - this.yaw), Math.cos(face - this.yaw)) * Math.min(1, dt * 6);
    return sp;
  }
  // abilities first (heals, defences, buffs, control, damage), then plain attacks
  fight() {
    const T = this.target, me = this.pos, dT = T ? Math.hypot(T.pos.x - me.x, T.pos.z - me.z) : 99, hp = this.hp / this.maxHp;
    if (this.gcd <= 0) { const a = this.choose(T, dT, hp); if (a) return; }
    if (T && this.swingT <= 0 && dT <= this.range + 0.4) { // a plain attack
      const sw = (this.W.kind === 'gun' ? 1.6 : this.W.kind === 'bow' ? 1.0 : this.W.kind === 'staff' ? 0.9 : 0.75) / (this.W.speed || 1) * (this.buffs.focus > 0 ? (this.h && this.h.cls === 'ranger' ? 0.5 : 0.75) : this.buffs.rampage > 0 ? 0.75 : 1); /* (Pack Frenzy: faster blows too; the ranger's Hunter's Focus twice as fast) */
      this.swingT = sw * 1.25 * Game.ARENA_PACE * (this.cls === 'warrior' ? 1.25 : 1) / (this.buffs.shout > 0 ? 1.35 : 1); const raw = (this.phaseInvis && this.stealth > 0 ? (this.stealth = 0, this.phaseInvis = false, 2) : 1) /* (out of Phase Shift: a crit, and he shows) */ * this.base * 0.95 * this.dmgMul() * Game.ARENA_PACE; /* (slower, heavier blows: same damage per second, each hit lands harder) */
      if (this.ranged) { this.act = this.W.kind === 'staff' ? 'cast' : 'shoot'; this.actT = 0; this.actSp = 1.4; this.aimLock = this.W.kind === 'gun' ? 0.75 : 0.55; /* plant your feet to aim, then fire */ const miss = dT > 10 && Math.random() < 0.12 + (dT - 10) * 0.012;
        this.pending = { t: 0.4, fn: () => { if (T.dead) return; if (this.cls === 'bombardier') { botBomb(this, T, raw * BOMB.throw.k, false); return; } /* (a real bomb, lobbed to land at their feet) */ const bomb = this.cls === 'bombardier', pri = this.cls === 'priest'; shot(this, T, bomb ? SHOT_COL.fire : pri ? SHOT_COL.holy : this.W.kind === 'staff' ? SHOT_COL[this.W.element] || SHOT_COL.arcane : SHOT_COL.phys, () => { if (miss) { V.number(T.pos.clone().setY(T.pos.y + 2), 'Miss', 'miss'); return; } hitUnit(this, T, raw, { ranged: true }); if (pri) atone(this, 0.045); if (bomb) { for (const u of enemiesOf(this)) if (u !== T && !u.dead && Math.hypot(u.pos.x - T.pos.x, u.pos.z - T.pos.z) < 3) hitUnit(this, u, raw * 0.6, { ranged: true }); V.burst('fire', T.pos.clone().setY(T.pos.y + 0.8), 40, { speed: 6 }); V.ring(T.pos.clone().setY(T.pos.y + 0.1), 3, '#ff9030', 0.35); S.explode && S.explode(T.pos, 0.4); } }, false, bomb ? 'bomb' : undefined); } }; }
      else if (this.cls === 'necromancer') { this.act = 'swing2'; this.actT = 0; this.actSp = 1.3; this.aimLock = 0.35; this.pending = { t: 0.3, fn: () => reapBot(this, raw * REAP.k) }; } /* (the scythe: a wide sweep that catches everyone in front of him) */
      else { this.act = Math.random() < 0.5 ? 'swing1' : 'swing2'; this.actT = 0; this.actSp = 1.5; this.aimLock = 0.3; // wind up, then strike: the blow lands as the weapon comes through
        this.pending = { t: 0.36, fn: () => { if (!T.dead && Math.hypot(T.pos.x - this.pos.x, T.pos.z - this.pos.z) < 3.4) { hitUnit(this, T, raw, { melee: true }); S.hit && S.hit('flesh', T.pos, 0.6); } } }; }
    }
  }
  ready(a) { return (this.cd[a.id] || 0) <= 0; }
  choose(T, dT, hp) {
    if (this.status.silence > 0) return null; /* (silenced: basic attacks only) */ const abs = this.abs.filter(a => this.ready(a) && !(a.id === 'drainlife' && this.cls === 'necromancer')); /* (Life Siphon: necroBot runs it) */ if (!abs.length) return null;
    const use = (a, tgt) => { this.cd[a.id] = Math.max(a.cd || 0, a.t === 'heal' || a.t === 'hot' ? 4 : 1.5) * Game.perkCd(Game.perkLvl(this.h, a.id, 'cd')) * Game.arenaCdAll(this.h) * (0.95 + Math.random() * 0.15); this.gcd = 1.5;
      const melee = ['strike', 'flurry', 'dash', 'cone'].includes(a.t) || (!a.t && !LEG_RANGED.has(a.id) && !!LEG[a.id]), wind = !isSupport(a) && a.t !== 'summon' && !(a.t || '').startsWith('pet') ? (melee ? 0.5 : 0.7) : 0;
      const ct = wind * 0.6; // no cast times in the arena: heals and spells go off at once (attacks keep a short, readable swing)
      if (ct) { this.cast = { a, tgt, t: 0, dur: ct, wind: !!wind && !(a.t === 'heal' || a.t === 'hot'), melee, at: tgt && tgt.pos ? tgt.pos.clone() : null }; return true; } this.resolve(a, tgt); return true; };
    // 1. healing: whoever on the team needs it most
    const heals = abs.filter(a => a.t === 'heal' || a.t === 'hot' || (LEG_SELF[a.id] && LEG_SELF[a.id][0] === 'heal'));
    if (heals.length) { const W = this.ward; if (W && W !== this && W.hp / W.maxHp < 0.6 && SUPPORT_CLS.has(this.cls)) return use(heals.sort((x, y) => (y.self || y.pct || 0) - (x.self || x.pct || 0))[0], W); if (hp < 0.55) return use(heals[0], this); }
    // 2. defences when under pressure
    if (hp < 0.6 && G.time - (this.hurtT || 0) < 2) { const d = abs.find(a => (a.t === 'buff' && ['ward', 'fort', 'stand', 'barrier', 'iceblock', 'phase', 'undying', 'lich', 'wall'].includes(a.buff) && !a.eq) || (LEG_SELF[a.id] && ['wall', 'stand', 'barrier', 'undying', 'fort'].includes(LEG_SELF[a.id][0])) || a.t === 'stealth'); if (d) return use(d, this); }
    // 3. protect a team mate who is being beaten on
    if (SUPPORT_CLS.has(this.cls)) { const w = alliesOf(this).find(u => u.hp / u.maxHp < 0.5 && G.time - ((u === G.player ? u.lastHitAt : u.hurtT) || 0) < 2); const d = w && abs.find(a => a.t === 'buff' && ['ward', 'barrier', 'fort'].includes(a.buff) && !a.eq); if (d) { this.cd[d.id] = Math.max(d.cd || 10, 10); this.gcd = 1.1; buffUnit(w, d.buff, d.dur || 8); this.act = 'cast'; this.actT = 0; return true; } }
    if (!T) return null;
    // 4. pets out before the fight is joined
    const sm = abs.find(a => a.t === 'summon' && !this.pets.some(p => !p.dead)); if (sm && dT < 30) return use(sm, this);
    // 5. damage buffs when the fight is on
    if (dT < this.range + 6) { const b = abs.find(a => (a.t === 'buff' && ['cry', 'rage', 'focus', 'surge', 'avatar', 'formVoid', 'formTime', 'formArcane', 'swind', 'rampage'].includes(a.buff) && !a.eq) || (LEG_SELF[a.id] && ['cry', 'rage', 'focus', 'rampage', 'surge'].includes(LEG_SELF[a.id][0])) || a.t === 'petbuff'); if (b && Math.random() < 0.6) return use(b, this); }
    // 6. control: break a cast, stop a melee chasing a caster, finish a runner
    const tCasting = T.cast || (T === G.player && G.player.abCast);
    const cc = abs.filter(a => !isSupport(a) && ((a.stun || 0) >= 0.8 || a.root || (LEG[a.id] && LEG[a.id][2] >= 0.8)) && this.inRange(a, dT));
    if (cc.length && (tCasting || (this.ranged && dT < 6) || Math.random() < 0.35) && !(T.status && T.status.stun > 0)) return use(cc[0], T);
    // 7. the hardest-hitting attack in range
    const dmg = abs.filter(a => !isSupport(a) && this.inRange(a, dT) && a.t !== 'summon' && !['heal', 'hot', 'buff', 'petbuff', 'petheal', 'petward'].includes(a.t)).map(a => [a, this.power(a)]).sort((x, y) => y[1] - x[1]);
    if (dmg.length && dmg[0][1] > 0) return use(dmg[0][0], T);
    // 8. heal pets, ward pets
    const pa = abs.find(a => (a.t === 'petheal' && this.pets.some(p => !p.dead && p.hp < p.maxHp * 0.6)) || (a.t === 'petward' && this.pets.some(p => !p.dead))); if (pa) return use(pa, this);
    return null;
  }
  inRange(a, d) { const t = a.t; if (!t) return d <= (LEG_RANGED.has(a.id) ? 22 : 4.5); if (t === 'strike' || t === 'flurry') return d <= 3.4; if (t === 'dash') return d <= 12; if (t === 'cone') return d <= 6.5; if (t === 'nova') return d <= (a.r || 5) + 0.4; if (t === 'aura' || t === 'stormwalk' || t === 'blizzaura') return d <= 6; if (t === 'petstrike') return this.pets.some(p => !p.dead); if (t === 'trap') return d <= 3; return d <= 24; }
  power(a) { if (!a.t) { const L = LEG[a.id]; return L ? L[0] * (L[1] > 1 ? 1.2 : 1) : 0.8; } const n = a.dmg || 0; switch (a.t) { case 'flurry': return n * (a.hits || 3); case 'ground': return n * (a.ticks || 4) * 0.7; case 'curse': return n + (a.dot || 0) * (a.dotT || 0) * 0.8; case 'aura': case 'stormwalk': case 'blizzaura': return n * 8; case 'petstrike': return 2; case 'bolt': case 'drain': return n * (a.n ? 1.6 : 1); default: return n; } }
  // ---- carrying out an ability ----
  resolve(a, tgt, lockAt) {
    if (this.dead) return; if (this.phaseInvis && this.stealth > 0 && a.id !== 'phaseshift') { this.stealth = 0; this.phaseInvis = false; } this._abId = a.id; this._abT = G.time; this._abFireId = a.id; this._abFireT = G.time; abilityFx(this, a, (tgt && tgt !== this ? tgt : this.target)); /* (the class's own look for the ability) */ const pkK = Game.perkPow(Game.perkLvl(this.h, a.id)); const P = (n) => pkK * this.base * (n || 0) * this.up * this.dmgMul(), me = this.pos, el = a.kind === 'fireball' || a.fx === 'fire' ? 'fire' : a.kind === 'frost' || a.fx === 'frost' ? 'frost' : a.fx === 'shadow' ? 'shadow' : a.fx === 'gold' ? 'holy' : a.fx === 'leaf' ? 'nature' : 'arcane';
    const col = SHOT_COL[el], o = { stun: a.stun || 0, slow: a.slow || 0, root: a.root || 0, fear: a.fear || 0, mez: !!a.mez, el, poison: a.poisonDot ? P(a.poisonDot) : 0, spread: a.spread || 0, blight: a.blight || 0 };
    const T = tgt && tgt !== this ? tgt : this.target;
    const anim = (n) => { this.act = n; this.actT = 0; };
    if (AN.on && AN.host && a.t && !['bolt', 'drain', 'curse'].includes(a.t)) { const at = lockAt || (T && T.pos) || me; nsend({ t: 'bfx', i: this.arenaF.i, k: a.t, c: col, el, x: r2(at.x), z: r2(at.z), r: a.r || 5 }); } // (the others see the effect too)
    const drainBack = (dealt, f) => { if (f && dealt) this.healSelf(dealt * f); }; // (dealt is the health really taken, so the drain is that share of it: it was x6, a full heal from every Shadow Tap)
    if (!a.t) return this.legacy(a, T, P);
    if (a.regen) { this.hots.push({ ps: a.regen[0] * this.maxHp / a.regen[1], t: a.regen[1] }); V.burst('heal', me.clone().setY(me.y + 1.2), 14, { speed: 2, vy: 2 }); }
    switch (a.t) {
      case 'strike': case 'flurry': { if (!T) return; const n = P(a.dmg) * (a.t === 'flurry' ? (a.hits || 3) : 1); if (!T.dead && Math.hypot(T.pos.x - this.pos.x, T.pos.z - this.pos.z) < 4.2) { drainBack(hitUnit(this, T, n, o), a.drain); V.burst(el === 'arcane' ? 'spark' : el, T.pos.clone().setY(T.pos.y + 1.1), 14, { speed: 4 }); } return; }
      case 'dash': { if (!T) return; const d = V3(T.pos.x - me.x, 0, T.pos.z - me.z), L = d.length(); this.dashing = { dir: d.normalize(), left: Math.max(0, L - 1.4), t: 0, onEnd: () => { anim('swing1'); hitUnit(this, T, P(a.dmg), o); } }; V.burst('dust', me.clone().setY(me.y + 0.3), 14, { speed: 3 }); return; }
      case 'cone': case 'zslash': { anim('swing2'); for (const u of enemiesOf(this)) { const dx = u.pos.x - me.x, dz = u.pos.z - me.z, d = Math.hypot(dx, dz); if (d < 6.5 && Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - this.yaw), Math.cos(Math.atan2(dx, dz) - this.yaw))) < 0.9) hitUnit(this, u, P(a.dmg), o); } V.burst(el === 'arcane' ? 'spark' : el, me.clone().setY(me.y + 1).addScaledVector(V3(Math.sin(this.yaw), 0, Math.cos(this.yaw)), 3), 30, { speed: 6 }); return; }
      case 'nova': { anim('slam'); const r = (a.r || 5) + 0.4; let dealt = 0; if (!a.calm) for (const u of enemiesOf(this)) if (Math.hypot(u.pos.x - me.x, u.pos.z - me.z) < r) dealt += hitUnit(this, u, P(a.dmg), o); V.ring(me, r, col, 0.6); V.burst(el === 'arcane' ? 'spark' : el, me.clone().setY(me.y + 1), 30, { speed: 6 }); drainBack(dealt, a.drainAll); return; }
      case 'axethrow': { if (!T) return; anim('swing2'); shot(this, T, '#ff5a40', () => hitUnit(this, T, P(1.4), Object.assign({}, o, { stun: 1.2 })), false); return; } /* (a computer berserker flings his axe at his target) */
      case 'arcshield': { anim('cast'); this.arcShield = this.maxHp * (a.amount || 0.35); this.arcShieldT = G.time + (a.dur || 5); arcShieldFx(this, () => this.arcShield > 0 && G.time < this.arcShieldT); return; }
      case 'bolt': case 'drain': case 'firearrow': case 'bola': case 'missiles': { if (!T) return; anim('cast'); const n = a.n ? Math.min(3, a.n) : 1; for (let k = 0; k < n; k++) setTimeout(() => shot(this, T, col, () => { let dealt = 0; if (a.aoe) { for (const u of enemiesOf(this)) if (Math.hypot(u.pos.x - T.pos.x, u.pos.z - T.pos.z) < a.aoe) dealt += hitUnit(this, u, P(a.dmg) * 0.8, o); V.burst(el === 'arcane' ? 'spark' : el, T.pos.clone().setY(T.pos.y + 1), 25, { speed: 5 }); } else dealt = hitUnit(this, T, P(a.dmg) * (n > 1 ? 0.7 : 1), o); drainBack(dealt, a.drain); }, true), k * 140); return; }
      case 'curse': { if (!T) return; anim('cast'); shot(this, T, col, () => { const dealt = hitUnit(this, T, P(a.dmg), o); if (a.dot) { if (T === G.player) G.player.debuff('poison', a.dotT || 6, P(a.dot) * PVP_K); else if (T.dots) T.dots.push({ dps: P(a.dot) * PVP_K, t: a.dotT || 6, src: this }); } drainBack(dealt, a.drain); }); return; }
      case 'ground': case 'trap': { const at = a.t === 'trap' ? me : (lockAt || (T ? T.pos : me)); anim('cast'); const ticks = a.ticks || (a.t === 'trap' ? 1 : 4); let first = true; zone(this, at, a.t === 'trap' ? 3 : 4.5, ticks + 0.2, 1, (u) => { hitUnit(this, u, P(a.dmg), first ? o : { slow: a.slow || 0, el }); }, col); setTimeout(() => { first = false; }, 1100); return; }
      case 'aura': case 'stormwalk': case 'blizzaura': { anim('castBig'); zone(this, me, a.t === 'aura' ? 6 : 7, a.dur || 8, 0.5, (u) => { const d = hitUnit(this, u, P(a.dmg) * (a.t === 'aura' ? 1 : 0.6), { slow: a.slow || 0, stun: Math.random() < 0.15 ? (a.stun || 0) : 0, el }); drainBack(d, a.drain); }, col, true); return; }
      case 'heal': case 'hot': { const who = tgt || this, amt = (a.self || a.pct || 0.25) * who.maxHp * pkK; anim('castUp'); if (a.t === 'heal') healUnit(who, amt, this); else if (who === this) this.hots.push({ ps: amt / (a.dur || 8), t: a.dur || 8 }); else if (who === G.player) G.player.addRegen ? G.player.addRegen(a.pct || 0.25, a.dur || 8) : healUnit(who, amt, this); else who.hots.push({ ps: amt / (a.dur || 8), t: a.dur || 8 });
        if (a.ally || SUPPORT_CLS.has(this.cls)) for (const u of alliesOf(this)) if (u !== who && Math.hypot(u.pos.x - me.x, u.pos.z - me.z) < (a.r || 10)) { healUnit(u, (a.ally || 0.15) * u.maxHp, this); if (a.notes) playNotes(G.scene, u, '#ffd860', 5); }
        if (a.notes) { playNotes(G.scene, this, '#ffd860', 8); S.cast && S.cast('holy', me, 0.6); } else V.burst('heal', me.clone().setY(me.y + 1.2), 20, { speed: 2, vy: 2 }); return; }
      case 'buff': { anim('cast'); const k = a.buff; if (k === 'phase' && this.cls === 'wizard') { this.stealth = a.dur || 4; this.phaseInvis = true; return; } /* (Phase Shift: almost invisible; his next plain attack crits, any attack ends it) */ if (k === 'avatar') { this.av = a.av || { dmg: 1.3, taken: 0.8 }; this.addBuff('avatar', a.dur || 12); } else if (k && k.startsWith('form')) this.addBuff('form', a.dur || 20); else if (k === 'barrier') { this.addBuff('barrier', a.dur || 12); this.barrier = this.maxHp * (a.amount || 0.25); } else if (k) this.addBuff(k, a.dur || 8);
        if (SUPPORT_CLS.has(this.cls) && ['ward', 'cry', 'fort', 'stand'].includes(k)) for (const u of alliesOf(this)) if (Math.hypot(u.pos.x - me.x, u.pos.z - me.z) < 12) buffUnit(u, k, (a.dur || 8) * 0.8);
        V.sphereFlash(me.clone().setY(me.y + 1), 1.4, k === 'ward' || k === 'barrier' || k === 'fort' ? '#80d8ff' : '#ffd060', 0.45); return; }
      case 'stealth': if (a.step) { const tg = T && Math.hypot(T.pos.x - me.x, T.pos.z - me.z) < 12 ? T : null; V.burst('shadow', me.clone().setY(me.y + 1), 30, { speed: 3 }); if (tg) { const by = tg.yaw || 0; me.set(tg.pos.x - Math.sin(by) * 1.4, me.y, tg.pos.z - Math.cos(by) * 1.4); this.yaw = by; } else me.addScaledVector(V3(Math.sin(this.yaw), 0, Math.cos(this.yaw)), a.step); }
        this.stealth = a.dur || 4; V.burst('smoke', me.clone().setY(me.y + 1), 30, { speed: 3 }); this.target = null; return;
      case 'demon': if (T && !T.dead) summonDemon(this, T.pos.clone()); return;
      case 'wrath': if (T && !T.dead) paladinWrath(this, T.pos.clone()); return;
      case 'fists': monkFists(this); return;
      case 'bladestorm': berserkerStorm(this); return;
      case 'arrowrain': if (T && !T.dead) rangerRain(this, T.pos.clone()); return;
      case 'mend': { const al = alliesOf(this, true).filter(u => Math.hypot(u.pos.x - this.pos.x, u.pos.z - this.pos.z) < 45).sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0] || this; healerMend(this, al, a); return; }
      case 'miracle': { const al = alliesOf(this, true).filter(u => Math.hypot(u.pos.x - this.pos.x, u.pos.z - this.pos.z) < 45).sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0] || this; clericMiracle(this, al); return; }
      case 'overgrowth': druidOvergrowth(this); return;
      case 'transcend': wizardTranscend(this); return;
      case 'barrage': musketBarrage(this); return;
      case 'wraps': this.status.stun = 0; this.status.root = 0; this.status.slow = 0; this.ultSlowT = 0; this.buffs.focus = Math.max(this.buffs.focus || 0, 5); this.hots.push({ ps: 0.3 * this.maxHp / 5, t: 5 }); this.buffs.swind = Math.max(this.buffs.swind || 0, 5); return;
      case 'banner': case 'grasp': case 'finale': case 'kegs': case 'meteors': case 'charm': case 'pack': case 'salvation': case 'bertha': if (ULT_BY_T[a.t]) { const U2 = ULT_BY_T[a.t]; if (U2.aim === 'foe') { if (T) U2.run(this, T); } else U2.run(this, U2.aim === 'ground' ? (T ? T.pos.clone() : this.pos.clone()) : this.pos.clone()); return; }
      case 'totem': { const al = alliesOf(this, true).sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0] || this; shamanTotem(this, al.pos.clone()); return; }
      case 'spirittotem': { const al = alliesOf(this, true); const c = T ? this.pos.clone().lerp(T.pos, 0.5) : this.pos.clone(); shamanSpirit(this, c); return; }
      case 'assassinate': if (T && !T.dead) rogueAssassinate(this, T); return;
      case 'summon': this.summon(a); return;
      case 'petbuff': for (const p of this.pets) p.frenzy = 12; return;
      case 'petheal': for (const p of this.pets) if (!p.dead) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * (a.petPct || 0.35)); return;
      case 'petward': for (const p of this.pets) p.wardT = a.dur || 10; return;
      case 'petstrike': for (const p of this.pets) if (!p.dead && T) { p.atkCd = 0; p.burst = 2.2; } return;
      default: return;
    }
  }
  // the original classes' hand-made abilities
  legacy(a, T, P) {
    const S2 = LEG_SELF[a.id]; if (S2) { const [k, dur, amt] = S2; if (k === 'heal') { healUnit(this, (amt || 0.25) * this.maxHp, this); } else if (k === 'dash') { if (T && this.ranged) { const d = V3(this.pos.x - T.pos.x, 0, this.pos.z - T.pos.z).normalize(); this.pos.addScaledVector(d, 8); V.burst('dust', this.pos.clone(), 20); } }
      else if (k === 'stealth') this.stealth = dur; else { this.addBuff(k, dur); if (amt) this.hots.push({ ps: amt * this.maxHp / dur, t: dur }); } this.act = 'cast'; this.actT = 0; return; }
    const L = LEG[a.id]; if (!L || !T) return; const [m, n, stun, slow] = L, o = { stun: stun || 0, slow: slow || 0 }; if (a.id === 'execute') Object.assign(o, { melee: true, big: true }); /* (Second Wind reads these) */
    if (LEG_RANGED.has(a.id)) { this.act = this.ranged ? 'shoot' : 'cast'; this.actT = 0; shot(this, T, SHOT_COL.phys, () => { for (const u of enemiesOf(this)) if (u === T || (n > 1 && Math.hypot(u.pos.x - T.pos.x, u.pos.z - T.pos.z) < 3.5)) hitUnit(this, u, P(m), o); }, true); }
    else { this.act = 'swing2'; this.actT = 0; for (const u of enemiesOf(this)) { const d = Math.hypot(u.pos.x - this.pos.x, u.pos.z - this.pos.z); if (u === T ? d < 4.5 : n > 1 && d < 5) hitUnit(this, u, P(m), o); } V.burst('dust', this.pos.clone().setY(this.pos.y + 0.5), 20, { speed: 5 }); }
  }
  // the bot's pets: a simple companion that fights at its side
  summon(a) {
    for (const p of this.pets) if (!p.dead) { p.dead = true; G.scene.remove(p.root); } this.pets = this.pets.filter(p => !p.dead);
    const kind = a.pet || 'skeleton', D = petDef(kind === 'spirit' ? 'wolfpack' : kind, 10), n = Math.min(2, a.n || 1);
    for (let k = 0; k < n; k++) { const x = this.pos.x + Math.sin(this.yaw + 1.6 + k) * 2, z = this.pos.z + Math.cos(this.yaw + 1.6 + k) * 2;
      let m; try { m = new Mob(PET_MOB[kind] || 'skeleton', 1, x, z); } catch (e) { m = new Mob('wolf', 1, x, z); }
      Object.defineProperty(m, 'name', { value: `${this.heroName}'s ${D.name || kind}`, configurable: true }); m.team = this.team; m.hostile = this.team !== G.myTeam; m.bpet = D; m.botPet = true; m.owner = this; m.arenaOwner = this.arenaF;
      m.maxHp = m.hp = D.hp; m.lv = LEVEL_CAP; m.level = LEVEL_CAP; m.atkCd = 1; m.stealth = 0; m.update = petTick; m.takeHit = petTakeHit; m.takeDamage = (d, s) => petTakeHit.call(m, d / PVP_K, s); m.debuff = () => {}; m.knock = V3();
      if (m.ring) m.ring.visible = false; G.mobs.push(m); this.pets.push(m); V.burst('shadow', m.pos.clone().setY(m.pos.y + 0.8), 30, { speed: 3 }); }
  }
}
// a burning fighter: flames lick up his body and the burn's damage pops up in orange every half second
export function burnFx(u, d, dt) { const h = u.height || 1.8; for (let i = 0, n = Math.random() < (dt * 40) % 1 ? Math.ceil(dt * 40) : Math.floor(dt * 40); i < n; i++) V.emit('fire', u.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, h * (0.15 + Math.random() * 0.75), (Math.random() - 0.5) * 0.6)), { speed: 0.6, vy: 2.2, size: 0.75, size1: 0.1, life: 0.6 }); /* (real tongues of flame up the body, not a faint glow) */
  d.acc = (d.acc || 0) + dt; if (d.acc >= 0.5) { d.acc -= 0.5; V.number(u.pos.clone().setY(u.pos.y + h + 0.2), String(Math.max(1, Math.round(d.dps * 0.5 / PVP_K))), 'dmg', '#ff8a2a'); } }
// the Training Yard's sparring warrior: a real arena fighter (health, armour, hits, stuns, knockdowns, death) who never
// walks or fights back. He falls when he dies and gets up again where he started a few seconds later
export class SparBot extends ArenaBot {
  constructor(x, z, yaw, cls = 'warrior') { const f = { i: -1, name: 'Sparring ' + CLASSES[cls].name, cls, team: 99, dmg: 0, heal: 0, kills: 0, deaths: 0, alive: true };
    super(f, arenaHero({ cls, race: 'human', team: 99 }, f.name)); this.spar = true; this.home = { x, z, yaw }; this.reset(); }
  reset() { this.revive(this.home); this.pos.y = heightAt(this.pos.x, this.pos.z); this.root.position.copy(this.pos); this.root.rotation.set(0, this.yaw, 0); if (this.model) this.model.kdLeft = 0; this.status.knock.set(0, 0, 0); }
  takeHit(dmg, src, o) { const st0 = A.state, me0 = A.me; A.state = 'fight'; if (!A.me) A.me = { dmg: 0 }; try { return super.takeHit(dmg, src, o); } finally { A.state = st0; A.me = me0; } } // (scored like an arena hit, outside a match)
  die() { this.hp = 0; this.dead = true; this.deadT = 0; this.cast = null; this.dots = []; this.hots = []; }
  update(dt) {
    const st = this.status, ch = this.model;
    if (this.held) { this.hitT = 0; return; } // (in a demon's grip)
    if (this.dead) { this.deadT += dt; if (this.deadT > 6) { this.reset(); V.burst('heal', this.pos.clone().setY(this.pos.y + 1), 18, { speed: 2, vy: 2 }); } // (back on his feet where he started)
      else { this.root.position.copy(this.pos); animateHumanoid(ch, dt, { speed: 0, armed: true, dead: true, deadT: this.deadT }); arenaLookTick(ch, dt); return; } } // (the model's own death fall: it only plays through arenaLookTick)
    for (const k in this.buffs) this.buffs[k] = Math.max(0, this.buffs[k] - dt);
    for (const k of ['stun', 'slow', 'root', 'frozen', 'fear', 'silence']) st[k] = Math.max(0, (st[k] || 0) - dt);
    if (this.hitT > 0) { this.hitT = Math.max(0, this.hitT - dt); const f = this.hitT / 0.32; for (const m of this.flashMats) if (m.emissive) m.emissiveIntensity = 0.65 * f * f; }
    for (let i = this.hots.length - 1; i >= 0; i--) { const h = this.hots[i]; h.t -= dt; this.healSelf(h.ps * dt); if (h.t <= 0) this.hots.splice(i, 1); }
    for (let i = this.dots.length - 1; i >= 0; i--) { const d = this.dots[i]; d.t -= dt; this.hp -= d.dps * dt; if (d.fire) burnFx(this, d, dt); if (d.t <= 0) this.dots.splice(i, 1); }
    if (this.hp <= 0) { this.die(); return; }
    if (G.time - (this.hurtT || -99) > 8) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.25 * dt); // (left alone for a while, he heals back up)
    if (st.knock && st.knock.lengthSq() > 0.01) { this.pos.addScaledVector(st.knock, dt * 6); st.knock.multiplyScalar(Math.max(0, 1 - dt * 6)); } // (shoved by hits and charges, but he never walks)
    this.pos.y = heightAt(this.pos.x, this.pos.z); this.root.position.copy(this.pos); this.root.rotation.y = this.yaw; this.root.visible = true;
    arenaLookTick(ch, dt);
    animateHumanoid(ch, dt, { speed: 0, armed: true, ready: true, hit: this.hitT > 0.16 ? (this.hitT - 0.16) * 4 : 0 });
    bodyPoseTick(this, ch, dt);
  }
}
function petTakeHit(dmg, src) { const m = this; if (m.dead || (src && src.team === m.team)) return 0; dmg = Math.max(1, Math.round(dmg * PVP_K * PACE * (m.wardT > 0 ? 0.5 : 1))); m.hp -= dmg; if (m.hp <= 0) { m.hp = 0; m.dead = true; m.deadT = 0; } return dmg; }
function petTick(dt) {
  const m = this, o = m.owner; m.wardT = Math.max(0, (m.wardT || 0) - dt); m.frenzy = Math.max(0, (m.frenzy || 0) - dt);
  if (m.dead) { m.deadT = (m.deadT || 0) + dt; if (m.deadT > 1.2) { m.root.visible = false; if (G.mobs.includes(m)) G.mobs.splice(G.mobs.indexOf(m), 1); G.scene.remove(m.root); } else m.root.rotation.z = Math.min(1, m.deadT / 0.5) * Math.PI / 2; return; }
  if (!o || o.dead || A.state !== 'fight') { m.animate(dt, { speed: 0 }); return; }
  const T = o.target && !o.target.dead ? o.target : null; let sp = 0;
  const goal = T ? T.pos : V3(o.pos.x + Math.sin(o.yaw + 2.2) * 2, 0, o.pos.z + Math.cos(o.yaw + 2.2) * 2), dx = goal.x - m.pos.x, dz = goal.z - m.pos.z, d = Math.hypot(dx, dz);
  const reach = m.bpet.range || 1.8;
  if (d > reach) { sp = Math.min(d - reach * 0.8, (m.bpet.speed || 6.5) * dt); m.pos.x += dx / d * sp; m.pos.z += dz / d * sp; m.yaw = Math.atan2(dx, dz); sp = sp / dt; }
  m.atkCd -= dt; if (T && d <= reach + 0.4 && m.atkCd <= 0) { m.atkCd = (m.bpet.cd || 1.2) * (m.frenzy > 0 ? 0.7 : 1); const dmg = (m.bpet.dmg || 20) * (1 + (LEVEL_CAP - 1) * 0.035) * (m.burst ? m.burst : 1) * (m.frenzy > 0 ? 1.3 : 1); m.burst = 0; hitUnit(o, T, dmg, { melee: true }); m.action = 'attack'; m.actionT = 0; }
  m.pos.y = gy(m.pos.x, m.pos.z, m.pos.y); if (RUINS_MAP()) worldCollide(m.pos, 0.4); m.root.position.copy(m.pos); m.root.rotation.y = m.yaw; m.actionT = (m.actionT || 0) + dt * 2; m.animate(dt, { speed: sp, action: m.actionT < 1 ? m.action : null, actionT: m.actionT });
}


// ---------------- online: what goes over the wire ----------------
const r2 = (v) => Math.round(v * 100) / 100;
const ACT_NET = { reap: 'swing2', smash: 'heavy', stabR: 'thrust1', stabL: 'thrust1', off1: 'swing1', spell: 'cast', sweep: 'swing1', spin: 'area', fury: 'area', release: 'shoot' };
let psT = 0, bsT = 0, msT = 0;
function netTick(dt) {
  const p = G.player;
  if ((psT -= dt) <= 0 && p) { psT = 1 / 15; const a = p.atk, cn = p.abCast && p.abCast.spell ? p.abCast : p.summonCast;
    nsend({ t: 'ps', i: A.me.i, x: r2(p.pos.x), y: r2(p.pos.y), z: r2(p.pos.z), yaw: r2(p.bodyYaw), hp: Math.round(p.hp), mh: Math.round(p.maxHp), a: a ? (ACT_NET[a.name] || a.name) : '', at: a ? r2(Math.min(1, a.t)) : cn ? r2(Math.min(1, cn.t / Math.max(0.3, cn.dur))) : 0, sp: r2(Math.hypot(p.vel.x, p.vel.z)), r: p.dodge && !p.dodge.charge && p.dodge.kind !== 'step' ? r2(Math.min(1, p.dodge.t)) : null, cu: cn ? 1 : 0, d: p.dead ? 1 : 0, st: p.stealth > 0 ? 1 : 0, c: A.me.cls }); }
  if (!AN.host) return;
  if ((bsT -= dt) <= 0) { bsT = 1 / 12; nsend({ t: 'bs', b: A.F.filter(f => f.bot).map(f => { const b = f.bot; return [f.i, r2(b.pos.x), r2(b.pos.z), r2(b.yaw), Math.round(b.hp), Math.round(b.maxHp), b.act || '', r2(b.actT || 0), b.cast ? (b.cast.melee ? 1 : 2) : 0, r2(b.spd || 0), b.dead ? 1 : 0, b.status.stun > 0 ? 1 : 0, f.cls]; }), p: A.F.filter(f => f.bot).flatMap(f => f.bot.pets.map((m, k) => [f.i, k, m.petKind || 'skeleton', r2(m.pos.x), r2(m.pos.z), r2(m.yaw || 0), m.dead ? 1 : 0])) }); }
  if ((msT -= dt) <= 0) { msT = 0.25; nsend({ t: 'ms', s: A.state, n: r2(A.t), c: r2(A.clock || 0), sc: A.score, rw: A.roundWins, r: A.round, sd: A.sudden ? 1 : 0, ho: A.hillOwner, al: A.F.map(f => f.alive ? 1 : 0), kd: A.F.map(f => [f.kills, f.deaths, Math.round(f.dmg), Math.round(f.heal), f.cls, r2(f.respawnT || 0)]), fl: A.flags.map(fl => [r2(fl.pos.x), r2(fl.pos.y), r2(fl.pos.z), fl.carrier ? fl.carrier.i : -1, fl.atHome ? 1 : 0]) }); }
}
function onNet(from, d) {
  const F = (i) => A.F[i], U = (i) => (i != null && i >= 0 && A.F[i] ? unitOf(A.F[i]) : null);
  switch (d.t) {
    case 'ps': { const f = F(d.i); if (f && f.rem && !f.you) f.rem.net(d); break; }
    case 'bs': if (!AN.host) { for (const b of d.b) { const f = F(b[0]); if (f && f.rem && f.rem.netBot) f.rem.netBot(b.slice(1)); } petViews(d.p || []); } break;
    case 'ms': if (!AN.host) { A.state = d.s; A.t = d.n; A.clock = d.c; A.score = d.sc; A.roundWins = d.rw; A.round = d.r; A.sudden = !!d.sd; A.hillOwner = d.ho;
      d.al.forEach((a, i) => { const f = A.F[i]; if (f && (!f.you || !a)) f.alive = !!a; });
      d.kd.forEach((k, i) => { const f = A.F[i]; if (!f) return; f.kills = k[0]; f.deaths = k[1]; f.dmg = k[2]; f.heal = k[3]; if (!f.you) { f.cls = k[4]; f.respawnT = k[5]; } });
      d.fl.forEach((q, i) => { const fl = A.flags[i]; if (!fl) return; fl.pos.set(q[0], q[1], q[2]); fl.carrier = q[3] >= 0 ? A.F[q[3]] : null; fl.atHome = !!q[4]; });
      AR.gatesOpen = A.state === 'fight'; } break;
    // a hit on my hero, from another player or the host's computer fighter (already scaled for PvP)
    case 'hit': if (d.to === AN.myId) { const p = G.player; if (!p || p.dead) break; const src = U(d.from), dodged = isDodging(p), [dd, o2] = pvpIncoming(p, d.d, ccShape(src, d.o || {})), hp0 = p.hp;
      if (dd > 0) p.takeDamage(dd, src, o2);
      if (dd > 0 && p.abCast && p.abCast.spell && Math.random() < 0.35) { p.abCast = null; G.hooks.castBar && G.hooks.castBar(null); G.hooks.toast && G.hooks.toast('Your spell was interrupted', '✋', 'bad'); }
      if (!p.dead && p.debuff) ccPlayer(p, o2, dodged);
      const dealt = Math.max(0, hp0 - p.hp); if (dealt && d.from >= 0) { if (AN.host) A.F[d.from].dmg += dealt; else nsend({ t: 'dc', i: d.from, n: Math.round(dealt) }); } } break;
    case 'dc': if (AN.host && A.F[d.i]) A.F[d.i].dmg += d.n; break;
    case 'heal': if (d.to === AN.myId && G.player && !G.player.dead) G.player.heal(d.n, true); break;
    case 'buff': if (d.to === AN.myId) buffUnit(G.player, d.kind, d.dur); break;
    case 'bhit': if (AN.host) { const f = F(d.i); if (f && f.bot) f.bot.takeHit(d.dmg, U(d.from), d.o || {}); } break;
    case 'bheal': if (AN.host) { const f = F(d.i); if (f && f.bot) f.bot.healSelf(d.n); } break;
    case 'bbuff': if (AN.host) { const f = F(d.i); if (f && f.bot) f.bot.addBuff(d.kind, d.dur); } break;
    case 'died': if (AN.host) { const f = A.F.find(x => x.owner === from); if (f) fighterDied(f, U(d.k)); } break;
    case 'revive': if (d.to === AN.myId) revive(A.me, true); break;
    case 'cls': if (AN.host) { const f = A.F.find(x => x.owner === from); if (f) f.cls = d.c; } break;
    case 'pick': if (!AN.host) startPick(d.n); break;
    case 'fight': if (!AN.host) startFight(); break;
    case 'banner': if (!AN.host) A.hooks.banner && A.hooks.banner(d.a, d.b); break;
    case 'feed': if (!AN.host) { feed(d.h, true); cheer(0.9); } break;
    case 'over': if (!AN.host) finish(d.w); break;
    case 'restart': if (!AN.host) restartMatch(true); break;
    case 'bfx': if (!AN.host) botFx(U(d.i), d); break;
    case 'siph': siphNet(d, U); break; // (another machine's necromancer is draining someone: draw the beam)
    case 'bomb': bombNet(d, U); break; // (another machine's bombs: thrown, stuck, gone off, Big Bertha)
    case 'shot': if (!AN.host) { const a = U(d.f), b = U(d.to); if (a && b) shot(a, b, d.c, () => {}, !!d.b, d.k); } break;
  }
}
// the host's computer fighters' pets, shown on a joiner's screen
const PV = new Map();
function petViews(list) {
  const seen = new Set();
  for (const [oi, k, kind, x, z, yaw, dead] of list) { const key = oi + ':' + k + ':' + kind; seen.add(key); let v = PV.get(key);
    if (!v) { let m; try { m = new Mob(PET_MOB[kind] || 'skeleton', 1, x, z); } catch (e) { continue; } if (m.ring) m.ring.visible = false; G.scene.add(m.root); v = { m, tgt: new THREE.Vector3(x, AR.Y, z), yaw }; PV.set(key, v); }
    v.tgt.set(x, AR.Y, z); v.yaw = yaw; v.dead = !!dead; }
  for (const [key, v] of PV) if (!seen.has(key)) { G.scene.remove(v.m.root); PV.delete(key); }
}
function updatePetViews(dt) { for (const v of PV.values()) { const m = v.m, d = m.pos.distanceTo(v.tgt); m.pos.lerp(v.tgt, Math.min(1, dt * 10)); m.pos.y = AR.Y; m.yaw = v.yaw; m.root.position.copy(m.pos); m.root.rotation.y = m.yaw; m.root.visible = !v.dead; m.animate(dt, { speed: Math.min(7, d * 12) }); } }
// a computer fighter's ability, drawn on a joiner's screen (the host did the real work)
function botFx(u, d) { if (!u) return; const me = u.pos, at = new THREE.Vector3(d.x, AR.Y, d.z), pk = d.el === 'arcane' ? 'spark' : d.el;
  switch (d.k) { case 'nova': V.ring(me, d.r + 0.4, d.c, 0.6); V.burst(pk, me.clone().setY(me.y + 1), 30, { speed: 6 }); break;
    case 'cone': V.burst(pk, me.clone().setY(me.y + 1).addScaledVector(new THREE.Vector3(Math.sin(u.yaw), 0, Math.cos(u.yaw)), 3), 30, { speed: 6 }); break;
    case 'ground': case 'trap': case 'aura': case 'stormwalk': case 'blizzaura': V.ring(d.k === 'ground' ? at : me, d.k === 'ground' ? 4.5 : 6, d.c, 1.2); V.burst(pk, (d.k === 'ground' ? at : me).clone().setY(AR.Y + 0.5), 24, { speed: 4 }); break;
    case 'strike': case 'flurry': case 'dash': V.burst(pk === 'spark' ? 'spark' : pk, at.clone().setY(AR.Y + 1.1), 14, { speed: 4 }); break;
    case 'heal': case 'hot': V.burst('heal', me.clone().setY(me.y + 1.2), 16, { speed: 2, vy: 2 }); V.ring(me, 3, '#80ff90', 0.6); break;
    case 'buff': V.sphereFlash(me.clone().setY(me.y + 1), 1.4, '#ffd060', 0.45); break;
    case 'summon': V.burst('shadow', me.clone().setY(me.y + 0.8), 30, { speed: 3 }); break; } }
// a player left the game: their fighter leaves the arena
function playerLeft(id) {
  const f = A.F.find(x => x.owner === id); if (!f || f.left) return; f.left = true; f.alive = false;
  if (f.rem) { f.rem.dead = true; f.rem.root.visible = false; const k = G.mobs.indexOf(f.rem); if (k >= 0) G.mobs.splice(k, 1); }
  feed(`<b style="color:${teamCol(f.team)}">${f.name}</b> left the game`, !AN.host); if (AN.host) checkWin();
}

// ---------------- the HUD ----------------
let hudEl = null, endShown = false;
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
function renderHud(force) {
  if (!hudEl) { hudEl = el('div', ''); hudEl.id = 'arenahud'; document.getElementById('hud').appendChild(hudEl); }
  const o = A.setup.objective, Ob = OBJECTIVES[o];
  const teams = teamsOf();
  const sc = (t) => o === 'rounds' ? A.roundWins[t] : o === 'elim' ? A.F.filter(f => f.team === t && f.alive).length : A.score[t] || 0;
  const tgt = o === 'elim' ? '' : ` / ${A.target}`;
  const chips = (isFFA() && teams.length > 6 ? teams.slice().sort((a, b) => sc(b) - sc(a)).slice(0, 6) : teams).map(t => `<span class="arc${t === G.myTeam ? ' me' : ''}" style="--tc:${teamCol(t)}"><i></i>${isFFA() ? teamName(t) : COLOR_NAMES[t]}<b>${sc(t)}</b></span>`).join('');
  const mm = Math.floor((A.clock || 0) / 60), ss = String(Math.floor((A.clock || 0) % 60)).padStart(2, '0');
  let mid = '';
  if (A.state === 'pick') mid = `<div class="arpick"><div class="arcount">${Math.ceil(A.t)}</div><div><b>${A.round > 1 ? 'Next round' : 'The gates open soon'}</b><span>${A.round > 1 ? 'Get ready' : `Buff up · <kbd>P</kbd> perks · <kbd>K</kbd> class · <kbd>Y</kbd> ready`}</span></div><button class="btn" id="arPerks">Perks <kbd>P</kbd></button>${A.t > 4 ? '<button class="btn gold" id="arReady">Ready <kbd>Y</kbd></button>' : ''}</div>`;
  const hill = o === 'koth' && A.state === 'fight' ? `<div class="arhill">${A.hillOwner == null ? 'The hill is empty' : A.hillOwner === 'contested' ? 'The hill is contested!' : `<b style="color:${teamCol(A.hillOwner)}">${teamName(A.hillOwner)}</b> holds the hill`}</div>` : '';
  const me = A.me, dead = !me.alive && A.state === 'fight' ? `<div class="ardead">${A.lives === 'one' ? 'You have fallen. Watch your side finish the fight.' : `Back in the fight in ${Math.ceil(me.respawnT)}`}<small>Fly around to watch: <kbd>W A S D</kbd> move · <kbd>Space</kbd> up · <kbd>C</kbd> down · <kbd>Shift</kbd> faster</small></div>` : '';
  const html = `<div class="arbar"><div class="arobj">${Ob.icon} ${Ob.name}${o === 'rounds' ? ` · Round ${A.round}` : ''}<small>${A.state === 'fight' ? (isFinite(A.timeLimit) ? (A.sudden ? 'sudden death' : (() => { const r = Math.max(0, A.timeLimit - A.clock); return Math.floor(r / 60) + ':' + String(Math.floor(r % 60)).padStart(2, '0') + ' left'; })()) : mm + ':' + ss) : ''}${tgt ? ' · first to ' + A.target : ''}</small></div><div class="archips">${chips}</div></div>${mid}${hill}${dead}<div class="arfeed">${A.feed.filter(f => G.time - f.t < 8).map(f => `<div>${f.html}</div>`).join('')}</div>`;
  if (hudEl._h !== html || force) { hudEl.innerHTML = html; hudEl._h = html; const b = hudEl.querySelector('#arReady'); if (b) b.onclick = () => { S.click(); readyUp(); }; const pb = hudEl.querySelector('#arPerks'); if (pb) pb.onclick = () => { S.click(); A.hooks.perks && A.hooks.perks(); }; }
}
export function scoreTable() {
  const rows = A.F.slice().sort((a, b) => (b.team === a.team ? 0 : a.team - b.team) || b.kills - a.kills);
  return `<table class="artab"><tr><th></th><th>Fighter</th><th>Class</th><th>Kills</th><th>Deaths</th><th>Damage</th><th>Healing</th></tr>${rows.map(f => `<tr class="${f.you ? 'me' : ''}${f.alive ? '' : ' dead'}"><td><i style="background:${teamCol(f.team)}"></i></td><td>${f.name}${f.you && f.name !== 'You' ? ' (you)' : ''}</td><td>${CLASSES[f.cls] ? CLASSES[f.cls].name : f.cls}</td><td>${f.kills}</td><td>${f.deaths}</td><td>${Math.round(f.dmg)}</td><td>${Math.round(f.heal)}</td></tr>`).join('')}</table>`;
}
export function toggleScores(on) { let e = document.getElementById('arscores'); if (!on) { if (e) e.remove(); return; } if (!e) { e = el('div', ''); e.id = 'arscores'; document.body.appendChild(e); } e.innerHTML = `<h3>${OBJECTIVES[A.setup.objective].name}</h3>` + scoreTable(); }
// the crowd showers the sand with gold when the match is won
function celebrate(w) { let n = 0; const col = w != null ? teamCol(w) : '#ffd84a'; const tick = () => { if (n++ > 22) return; for (let k = 0; k < 3; k++) { const a = Math.random() * Math.PI * 2, r = Math.random() * AR.R * 0.9; V.burst(k ? 'gold' : 'spark', new THREE.Vector3(Math.sin(a) * r, AR.Y + 9 + Math.random() * 6, Math.cos(a) * r), 18, { speed: 2, grav: 2.5, life: 2.4 }); } V.light && V.light(new THREE.Vector3(0, AR.Y + 6, 0), col, 3, 0.4, 60); setTimeout(tick, 180); }; tick(); }
// fight again with the same fighters, without reloading the page
export function restartMatch(fromHost) {
  if (AN.on && !AN.host && !fromHost) return; if (AN.on && AN.host) nsend({ t: 'restart' });
  const e = document.getElementById('arenaend'); if (e) e.remove(); endShown = false;
  A.winner = null; A.sudden = false; A.round = 1; A.clock = 0; A.feed.length = 0; A.hillOwner = null; A.hillAcc = 0;
  for (const t of teamsOf()) { A.score[t] = 0; A.roundWins[t] = 0; }
  for (const f of A.F) { f.kills = f.deaths = f.dmg = f.heal = 0; f.alive = true; f.respawnT = 0; if (f.bot) for (const pm of f.bot.pets) { pm.dead = true; G.scene.remove(pm.root); } }
  for (const fl of A.flags) { fl.carrier = null; fl.pos.copy(fl.home); fl.atHome = true; }
  for (const sh of A.shots) G.scene.remove(sh.m); A.shots.length = 0; A.zones.length = 0;
  G.uiOpen = false; placeAll(); startPick(PICK_T); A.hooks.revived && A.hooks.revived();
}
function renderEnd() {
  if (endShown) return; endShown = true; const won = A.winner === G.myTeam;
  const e = el('div', ''); e.id = 'arenaend';
  e.innerHTML = `<div class="arendp"><div class="eyebrow">Kingdom Arena · ${OBJECTIVES[A.setup.objective].name}</div><h1 class="${won ? 'win' : 'lose'}">${A.winner == null ? 'Draw' : won ? 'Victory!' : 'Defeat'}</h1><p>${A.winner == null ? 'Nobody is left standing.' : `<b style="color:${teamCol(A.winner)}">${teamName(A.winner)}</b> ${isFFA() ? 'is the champion of the arena' : 'wins the match'}.`}</p>${scoreTable()}<div class="arbtns"><button class="btn gold big" id="arAgain">Fight again</button><button class="btn" id="arSetup">Change the match</button><button class="btn red" id="arMenu">Main menu</button></div></div>`;
  document.body.appendChild(e); if (document.pointerLockElement) document.exitPointerLock(); G.uiOpen = true;
  e.querySelector('#arAgain').onclick = () => { S.click(); restartMatch(); }; // in place: no reload, so full screen stays on
  if (AN.on && !AN.host) { const b = e.querySelector('#arAgain'); b.disabled = true; b.textContent = 'Waiting for the host…'; }
  if (AN.on) e.querySelector('#arSetup').style.display = 'none';
  e.querySelector('#arSetup').onclick = () => { try { sessionStorage.setItem('kr2_arena_open', '1'); } catch (er) { /* no storage */ } location.href = location.pathname; };
  e.querySelector('#arMenu').onclick = () => { location.href = location.pathname; };
}
