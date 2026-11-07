// Kingdom Arena: duels and team fights in the colosseum. Everyone is level 20 and fully geared, with 20 skill points
// to spend during a 60 second countdown. Objectives: Elimination, Rounds, Deathmatch, Capture the Flag, King of the Hill.
// Computer fighters use their class's real abilities from their skill trees: they move, kite, focus targets together,
// heal and buff each other, peel for their healers and play the objective.
import * as THREE from 'three';
import { G } from './state.js';
import * as Game from './game.js';
import { CLASSES, ABILITIES, CLASS_TREES, ARMOR_SLOT_LIST, TIERS, RACES, isSupport, WEAPON_TYPES, LEVEL_CAP } from './data.js';
import { petDef } from './classes2.js';
import { buildHumanoid, equipWeapon, animateHumanoid, bake } from './character.js';
import { Mob } from './mobs.js';
import { V } from './vfx.js';
import { S } from './audio.js'; // (no crowd chatter: it sounded bad)
import { PVP_K, pvpIncoming } from './mp.js';
import { heightAt } from './terrain.js';
import * as Icons from './icons.js';
import { classPortrait } from './portraits.js';
import { RUINS, updateRuins } from './ruinsmap.js';
import { collide as worldCollide, groundAt as worldGround, solidAt, lineClear } from './world.js';
import { makeLightSword, makeGlyph, makeWings, makeDemon, makeHellRing, luteToChest, playNotes, notesTick, addOutline, arenaSpec, arenaBody, arenaDecor, arenaWeaponDecor, arenaLookTick } from './arenalooks.js';
import { AR, COLORS, COLOR_NAMES, updateColosseum, cheer, ROOM, PILLARS } from './arenamap.js';
import { ARENA_KEY } from './battlemap.js';
import { loadBuild, saveBuild } from './builds.js';
import { AN, send as nsend, lobby as netLobby, RemoteFighter, BotProxy, teamRim } from './arenanet.js';
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
  warrior: ['warrior_xs2', 'execute', 'hamstring'], berserker: ['berserker_xs2', 'earthsplitter', 'intimshout'], paladin: ['layonhands', 'smitearc', 'hammerstrike'], darkknight: ['lifetap', 'dkraise', 'deathgrip'],
  cleric: ['radiantheal', 'prayer', 'holysmite'], monk: ['flyingkick', 'hundredfists', 'pressure'],
  bard: ['ar_mendsong', 'crescendo', 'mesmerize2'], druid: ['regrowth', 'callbear', 'entangle'], shaman: ['sh_wave', 'sh_wolf', 'sh_hex'],
  ranger: ['focus', 'spectral', 'entangle2'], musketeer: ['quickreload', 'grapeshot', 'bolas'], blunderbuss: ['powdercharge', 'buckshot', 'buttstroke'], wizard: ['blink', 'disintegrate', 'temporalbolt'],
  rogue: ['envenom', 'eviscerate', 'kidney'], necromancer: ['drainlife', 'ar_plaguebreath', 'ar_skullfear'], elementalist: ['lightninglash', 'callflame', 'frostbind'], enchanter: ['mindrot', 'phantasm', 'mesmerize'], beastmaster: ['packfrenzy', 'warbeast', 'feralroar'],
};
export const ROLE = { warrior: 'Tank', berserker: 'Tank', paladin: 'Tank', darkknight: 'Tank', cleric: 'Healer', druid: 'Healer', shaman: 'Healer', bard: 'Healer' }; // everyone else: Damage
// the ultimate on R: charges over time and faster as you deal damage or heal; one big ability per class
export const ARENA_ULT = { warrior: 'stonebanner', berserker: 'bladestorm', paladin: 'ar_wrath', darkknight: 'harbinger', cleric: 'miracle', druid: 'tranquility', shaman: 'wrathstorm', bard: 'cacophony', monk: 'thousandfists',
  ranger: 'rainofarrows', musketeer: 'deadeye', blunderbuss: 'greatkeg', wizard: 'timestop', rogue: 'shadowdance', necromancer: 'ar_demon', elementalist: 'pureel', enchanter: 'mindshatter', beastmaster: 'direbeast' };
export const ultOf = (cls) => { kitRules(); const id = ARENA_ULT[cls]; return (ABILITIES[cls] || []).some(a => a.id === id) ? id : null; };
export const roleOf = (cls) => ROLE[cls] || 'Damage';
// perks: ten for every class, three ranks each, bought with points that come with time (1 every 10 s of fighting)
const SUPPORT_CLS_K = new Set(['cleric', 'druid', 'shaman', 'paladin', 'bard', 'enchanter']);
const RANGED_CLS = new Set(['ranger', 'musketeer', 'blunderbuss', 'wizard', 'necromancer', 'elementalist', 'enchanter', 'druid', 'shaman']);
// each class: six perks that sharpen its own abilities and four passives that are its alone
const PASSIVE = {
  thorns: ['Thorns', 'Enemies who hit you in melee take 8% of that damage back per rank.', '🌵'], lastStand: ['Last Stand', 'Below 30% health you take 10% less damage per rank.', '⛨'],
  execute: ['Executioner', 'Hit enemies below 35% health 10% harder per rank.', '☠'], rage: ['Blood Rage', 'The more hurt you are, the harder you hit: up to 18% more per rank.', '🔥'],
  ambush: ['Ambush', 'Your hits from stealth do 20% more per rank.', '🗡'], haste: ['Flurry', 'Attack 6% faster per rank.', '⚡'], crit: ['Keen Eye', '5% more chance to crit per rank.', '🎯'],
  burnHit: ['Searing Strikes', 'Your hits can set enemies burning (stronger per rank).', '🔥'], chillHit: ['Frostbite', 'Your hits can chill and slow enemies (longer per rank).', '❄'],
  poisonHit: ['Venom', 'Your hits can poison enemies (stronger per rank).', '☣'], bleedHit: ['Serrated Edge', 'Your hits can make enemies bleed (stronger per rank).', '🩸'],
  shieldHeal: ['Guardian Light', 'Your heals also give a shield worth 15% of the heal per rank.', '✦'], cdAll: ['Focus', 'All your abilities come back 4% sooner per rank.', '⌛'],
  songRegen: ['Song of Vigor', 'You play a song: allies near you regenerate 0.6% health a second per rank.', '♫'], songDef: ['Song of Valour', 'Allies near you take 4% less damage per rank.', '♪'],
  songAtk: ['Song of Battle', 'Allies near you deal 5% more damage per rank.', '♬'], songArea: ['Resounding Voice', 'Your songs reach 20% further per rank.', '📯'],
  auraDef: ['Devotion Aura', 'Allies within 9 m take 4% less damage per rank.', '🛡'], auraRegen: ['Sanctuary', 'Allies within 9 m regenerate 0.5% health a second per rank.', '✚'], auraAtk: ['Totem of Wrath', 'Allies within 9 m deal 5% more damage per rank.', '🗿'],
  hp: ['Iron Constitution', '8% more health per rank.', '❤'], armor: ['Unbreakable', 'Take 6% less damage per rank.', '🛡'], speed: ['Fleet Foot', 'Move 4% faster per rank.', '➶'], lifesteal: ['Siphoning Strikes', 'Heal for 3% of the damage you deal per rank.', '🩸'], heal: ['Blessed Hands', 'Your healing is 10% stronger per rank.', '✚'],
};
const UNIQUE = { warrior: ['thorns', 'lastStand', 'execute', 'hp'], paladin: ['auraDef', 'thorns', 'shieldHeal', 'armor'], darkknight: ['lifesteal', 'lastStand', 'execute', 'armor'], berserker: ['rage', 'lifesteal', 'execute', 'haste'],
  cleric: ['shieldHeal', 'heal', 'auraRegen', 'cdAll'], monk: ['haste', 'heal', 'lifesteal', 'cdAll'], bard: ['songRegen', 'songDef', 'songAtk', 'songArea'], druid: ['auraRegen', 'poisonHit', 'heal', 'speed'], shaman: ['auraAtk', 'burnHit', 'heal', 'speed'],
  ranger: ['crit', 'bleedHit', 'speed', 'execute'], musketeer: ['crit', 'execute', 'burnHit', 'lifesteal'], blunderbuss: ['armor', 'lastStand', 'burnHit', 'thorns'], wizard: ['crit', 'cdAll', 'chillHit', 'speed'],
  rogue: ['ambush', 'poisonHit', 'execute', 'crit'], necromancer: ['poisonHit', 'lifesteal', 'lastStand', 'cdAll'], elementalist: ['burnHit', 'chillHit', 'crit', 'cdAll'], enchanter: ['chillHit', 'cdAll', 'crit', 'auraDef'], beastmaster: ['rage', 'lifesteal', 'haste', 'bleedHit'] };
const STAT_KIND = new Set(['hp', 'armor', 'speed', 'lifesteal', 'heal']);
export function perksFor(cls) { kitRules(); const A2 = ABILITIES[cls] || [], nm = (id) => (A2.find(a => a.id === id) || {}).name || '?', [f, c, q] = ARENA_KITS[cls] || [];
  const W = (WEAPON_TYPES[(CLASSES[cls].weapons || [])[0]] || {}).name || 'weapon';
  const list = [
    { id: 'powL', kind: 'pow', slot: 'L', name: 'Honed ' + W, desc: 'Your basic attack hits 12% harder per rank.' },
    { id: 'powF', kind: 'pow', slot: 'F', name: 'Greater ' + nm(f), desc: `${nm(f)} is 12% stronger per rank.` },
    { id: 'cdF', kind: 'cd', slot: 'F', name: 'Swift ' + nm(f), desc: `${nm(f)} comes back 10% sooner per rank.` },
    { id: 'powC', kind: 'pow', slot: 'C', name: 'Greater ' + nm(c), desc: `${nm(c)} is 12% stronger per rank.` },
    { id: 'cdC', kind: 'cd', slot: 'C', name: 'Swift ' + nm(c), desc: `${nm(c)} comes back 10% sooner per rank.` },
    { id: 'powQ', kind: 'pow', slot: 'Q', name: 'Greater ' + nm(q), desc: `${nm(q)} is 12% stronger per rank.` },
  ];
  for (const k of UNIQUE[cls] || []) { const [n, d, g] = PASSIVE[k]; list.push({ id: k, kind: STAT_KIND.has(k) ? k : 'p', key: k, name: n, desc: d, glyph: g, passive: !STAT_KIND.has(k) }); }
  return list; }
// add up what has been bought into h.arenaPK, which the combat code reads
export function recomputePK(h) { const P = { pow: {}, cd: {}, hp: 0, armor: 0, speed: 0, lifesteal: 0, heal: 0 }; const R2 = h.arenaPerks || {};
  P.p = {}; for (const pk of perksFor(h.cls)) { const n = R2[pk.id] || 0; if (!n) continue; if (pk.kind === 'pow' || pk.kind === 'cd') P[pk.kind][pk.slot] = (P[pk.kind][pk.slot] || 0) + n; else if (pk.kind === 'p') P.p[pk.key] = n; else P[pk.kind] += n; } h.arenaPK = P; h.arenaSongs = !!(P.p.songRegen || P.p.songDef || P.p.songAtk); }
const perkLeft = (f) => (f.pp || 0) - Object.values((unitHero(f) || {}).arenaPerks || {}).reduce((a, b) => a + b, 0);
const unitHero = (f) => f.you ? G.player && G.player.h : f.bot ? f.bot.h : null;
function applyPerkStats(f) { const h = unitHero(f); if (!h) return; recomputePK(h); if (f.you) { const p = G.player, k = p.hp / p.maxHp; p.refreshStatsOnly(); p.hp = p.maxHp * k; } else if (f.bot) { const b = f.bot, k = b.hp / b.maxHp; b.maxHp = Math.round(b.baseHp * Game.arenaHpK(h)); b.hp = b.maxHp * k; } }
// computer fighters buy as soon as they can: tanks toughen up, healers heal harder, the rest go for damage
function botBuy(f) { const h = f.bot.h, list = perksFor(h.cls), want = Game.TANK_CLS.has(h.cls) ? ['armor', 'hp', 'powQ', 'cdF', 'powL'] : SUPPORT_CLS_K.has(h.cls) ? ['heal', 'powF', 'cdF', 'speed', 'powL'] : ['powL', 'powC', 'cdC', 'lifesteal', 'powQ'];
  h.arenaPerks = h.arenaPerks || {}; while (perkLeft(f) > 0) { const pick = want.map(id => list.find(p => p.id === id)).find(p => p && (h.arenaPerks[p.id] || 0) < Game.PERK_MAX) || list.find(p => (h.arenaPerks[p.id] || 0) < Game.PERK_MAX); if (!pick) break; h.arenaPerks[pick.id] = (h.arenaPerks[pick.id] || 0) + 1; } applyPerkStats(f); }
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
function ultTick(dt) { for (const f of A.F) { const h = unitHero(f); if (!h || !h.arenaUlt || !f.alive) continue; h.ultCharge = Math.min(100, (h.ultCharge || 0) + dt * 1.0);
    if (f.bot && h.ultCharge >= 100 && f.bot.target && !f.bot.dead && !f.bot.cast && Math.hypot(f.bot.target.pos.x - f.bot.pos.x, f.bot.target.pos.z - f.bot.pos.z) < 12) { const a = ABILITIES[h.cls].find(x => x.id === h.arenaUlt); if (a) { h.ultCharge = 0; f.bot.act = 'castUp'; f.bot.actT = 0; f.bot.resolve(a, a.t === 'heal' || a.t === 'hot' || a.t === 'buff' ? f.bot : f.bot.target); V.burst('gold', f.bot.pos.clone().setY(f.bot.pos.y + 1.5), 40, { speed: 5 }); feed(`<b>${esc2(f.name)}</b> unleashes ${a.name}!`); } } } }
const esc2 = (t) => String(t).replace(/[<>&]/g, '');
export function ultGain(h, amt) { if (h && h.arenaUlt) h.ultCharge = Math.min(100, (h.ultCharge || 0) + amt); }
function perkTick(dt) { A.perkClock = (A.perkClock || 0) + dt; if (A.perkClock < 10) return; A.perkClock -= 10;
  for (const f of A.F) { f.pp = Math.min(30, (f.pp || 0) + 1); if (f.bot) botBuy(f); }
  if (A.me) { S.click(); A.hooks.toast && A.hooks.toast(`Perk point earned · ${perkLeft(A.me)} to spend (P)`, '◆', 'gold'); } }
// right click: a defensive move (a shield blocks instead); the bow and the guns aim down the barrel
export const ARENA_RMB = { warrior: 'shieldwall', berserker: 'undying', ranger: 'aim', musketeer: 'aim', blunderbuss: 'aim', shaman: 'sh_lshield', wizard: 'phaseshift', cleric: 'divineaegis', paladin: 'shieldofl',
  darkknight: 'gravewall', druid: 'barkward', monk: 'innerpeace', bard: 'lullaby', rogue: 'ar_shadowstep', necromancer: 'bonearmor', elementalist: 'iceshell', enchanter: 'runeshield', beastmaster: 'naturesembrace' };
export const rmbOf = (cls) => { kitRules(); const id = ARENA_RMB[cls]; return id === 'aim' || (ABILITIES[cls] || []).some(a => a.id === id) ? id : null; };
export const kitOf = (cls) => (kitRules(), ARENA_KITS[cls] || []).filter(id => (ABILITIES[cls] || []).some(a => a.id === id));
// heals in a three-button kit get a real cooldown (12 s at least), or they could be cast over and over
let kitRulesDone = false;
// the arena's own moves, and cooldowns tuned for a three-key kit (no mana: everything runs on cooldowns)
const ARENA_NEW = {
  rogue: [{ id: 'ar_leechstab', name: 'Leeching Stab', kit: true, t: 'strike', dmg: 1.3, cd: 10, cost: 0, fx: 'blood', regen: [0.3, 6], level: 1, desc: 'A deep stab that drinks from the wound: you regenerate 30% of your health over 6 s.' },
    { id: 'ar_shadowstep', name: 'Shadow Step', kit: true, t: 'stealth', dur: 3, cd: 18, cost: 0, fx: 'shadow', step: 7, level: 1, desc: 'Step through the shadows 7 m forward (behind the enemy you aim at, if one is close) and vanish for 3 s.' }],
  bard: [{ id: 'ar_mendsong', name: 'Song of Mending', t: 'hot', self: 0.3, pct: 0.3, ally: 0.25, r: 10, dur: 6, notes: true, cd: 15, cost: 0, fx: 'gold', level: 1, desc: 'Play a mending song: you heal 30% over 6 s and every ally within 10 m of you heals 25% at once. Notes swirl round everyone it touches.' }],
  monk: [{ id: 'ar_chiwave', name: 'Chi Wave', kit: true, t: 'heal', self: 0.15, ally: 0.28, r: 12, cd: 9, cost: 0, fx: 'leaf', level: 1, desc: 'A wave of chi washes out from you: allies within 12 m heal 28% at once, you 15%.' },
    { id: 'ar_revival', name: 'Revival', kit: true, t: 'heal', self: 0.4, ally: 0.5, r: 18, cd: 40, cost: 0, fx: 'gold', level: 1, desc: 'Gather your chi and release it: you and every ally within 18 m heal 40-50% of their health. 40 s cooldown.' }],
  paladin: [{ id: 'ar_wrath', name: 'Avenging Wrath', t: 'wrath', cd: 90, cost: 0, fx: 'holy', level: 1, desc: 'Spread golden wings and call down judgment where you aim: a 12 m glyph of light burns into the ground and slows enemies on it, then a giant sword of light plunges out of the sky. Anyone in its heart is impaled; everyone else on the glyph is hurt badly and thrown up; allies on it are healed. Get off the glyph before it lands.' }],
  necromancer: [{ id: 'ar_plaguebreath', name: 'Plague Breath', t: 'cone', dmg: 0.35, poisonDot: 0.9, blight: 6, spread: 1, cd: 12, cost: 0, fx: 'leaf', level: 1, desc: 'The shrunken head vomits a roaring spray of plague: everything in front of you is poisoned and Blighted for 6 s (all poison hurts a Blighted enemy 50% more).' },
    { id: 'ar_demon', name: 'Maw of the Abyss', t: 'demon', cd: 90, cost: 0, fx: 'shadow', level: 1, desc: 'A ring of green hellfire bursts up where you aim and slows every enemy inside it while a skeletal demon claws its way out. Whoever is still in the ring and closest to the centre when it rises is seized, lifted over its head and has their head bitten off. If everyone escapes the ring, it hunts around and sinks back down.' },
    { id: 'ar_skullfear', name: 'Skull of Terror', kit: true, t: 'curse', dmg: 0.5, fear: 3, bigSkull: true, cd: 14, cost: 0, fx: 'shadow', level: 1, desc: 'Hurl a screaming skull at the enemy you aim at: it flees from you in terror for 3 s.' }],
};
const CD_FIX = { heal: 15, drain: 8, pet: 60, cc: 12, def: 20 };
function kitRules() { if (kitRulesDone) return; kitRulesDone = true;
  for (const cls in ARENA_NEW) for (const a of ARENA_NEW[cls]) if (ABILITIES[cls] && !ABILITIES[cls].some(x => x.id === a.id)) ABILITIES[cls].push(a);
  { const r = ABILITIES.rogue && ABILITIES.rogue.find(a => a.id === 'eviscerate'); if (r) { r.name = 'Backstab'; r.desc = 'Drive your blade into the enemy in front of you: huge damage and it bleeds; double damage from behind.'; r.backstab = true; } }
  for (const c of ['enchanter', 'bard']) for (const a of ABILITIES[c] || []) if (/^mesmerize/.test(a.id) || a.id === 'lullaby') a.mez = true; // (shown as MESMERIZED over their head)
  { const n = ABILITIES.necromancer && ABILITIES.necromancer.find(a => a.id === 'drainlife'); if (n) { n.desc = 'Raise the shrunken head: a stream of green soul-water pours out of the enemy you aim at into it, healing you and slowing them.'; n.slow = 2.5; } }
  for (const cls in ARENA_KITS) { const [fH, fC, fQ] = ARENA_KITS[cls], A2 = ABILITIES[cls] || [], get = (id) => A2.find(x => x.id === id);
    const h = get(fH); if (h && (h.t === 'drain' || h.drain || h.regen)) h.cd = Math.max(h.cd || 0, CD_FIX.drain); else if (h && (h.t === 'heal' || h.t === 'hot' || (LEG_SELF[h.id] && LEG_SELF[h.id][0] === 'heal'))) h.cd = Math.min(20, Math.max(h.cd || 0, CD_FIX.heal)); else if (h) h.cd = Math.max(h.cd || 0, 8); // (only heals get the heal cooldown)
    const c = get(fC); if (c && c.t === 'summon') { c.cd = CD_FIX.pet; c.desc = (c.desc || '').replace(/\.?\s*$/, '.') + ' 60 s cooldown.'; }
    const q = get(fQ); if (q) q.cd = Math.max(q.cd || 0, CD_FIX.cc);
    const r = get(ARENA_RMB[cls]); if (r) r.cd = Math.min(Math.max(r.cd || 0, CD_FIX.def), 30);
    for (const id of [fH, fC, fQ, ARENA_RMB[cls]]) { const x = get(id); if (x) { x.cost = 0; x.castT = 0; if (x.desc) x.desc = x.desc.replace(/,?\s*[\d.]+ s cast,?/, ''); if (x.desc) x.desc = x.desc.replace(/,? no cooldown\.?/, '.'); } } } }
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
  const R = RACES[slot.race] || RACES.human, sex = Math.random() < 0.4 ? 'f' : 'm';
  const app = { skin: R.skins[(Math.random() * R.skins.length) | 0], hair: R.hairs[(Math.random() * R.hairs.length) | 0], hairStyle: (Math.random() * 3) | 0, beard: sex === 'm' && Math.random() < 0.5 ? 1 + ((Math.random() * 2) | 0) : 0, height: 1, build: 0 };
  const h = Game.newHero({ name, race: slot.race, cls: slot.cls, sex, app });
  h.level = LEVEL_CAP; h.introDone = true; h.gold = 0; h.arena = true; h.ctree = {}; kitRules(); h.arenaKit = kitOf(slot.cls); h.arenaRmb = rmbOf(slot.cls); h.arenaUlt = ultOf(slot.cls); h.ultCharge = 0; h.arenaPerks = {}; recomputePK(h);
  const top = TIERS.length - 1, C = CLASSES[slot.cls];
  for (const k of ['w1', 'w2']) { const w = h.equip[k]; if (w) Object.assign(w, Game.makeWeapon(w.wt, top, 3), { uid: w.uid }); }
  for (const s of ARMOR_SLOT_LIST) h.equip[s] = Game.makeArmor(C.armor || 'leather', s, top, 3);
  h.skills = {}; for (const id of SKILL_IDS) h.skills[id] = 999; // capped by level inside the skill system
  h.hotbar = null; Game.autoFillHotbar(h);
  return h;
}
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
  G.hooks.arenaDemon = summonDemon; G.hooks.arenaWrath = paladinWrath;   A.hooks = hooks; A.setup = FINAL || readArena(); const s = A.setup; G.fovTrim = 10;
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
export function ultHurt(u, frac, caster, kind = 'gold') { if (!u || u.dead) return; const n = (u.maxHp || 1000) * frac, c = u.pos.clone().setY(u.pos.y + 1.2);
  if (u === G.player) { if ((u.ultImmT || 0) > 0) return; u.hp -= n; u.hurtT = 0.3; V.addShake(0.4); if (u.hp <= 0) { u.hp = 0; u.die && u.die(caster); } }
  else if (u.dummy) { u.takeHit && u.takeHit(n, caster, {}); }
  else { if (u.invulnT > G.time) return; u.hp -= n; if (u.flash) u.flash(); if (u.hp <= 0) { u.hp = 0; u.die && u.die(caster); } }
  V.number(c, String(Math.round(n)), 'dmg'); V.burst(kind, c, 16, { speed: 4 }); }
export function ultKill(u, caster) { if (!u || u.dead) return; if (u === G.player) { u.hp = 0; u.die && u.die(caster); } else if (u.dummy) u.takeHit && u.takeHit(99999, caster, {}); else { u.hp = 0; u.die && u.die(caster); } }
export function ultHeal(u, frac) { if (!u || u.dead) return; const n = (u.maxHp || 1000) * frac; if (u === G.player && u.heal) u.heal(n); else u.hp = Math.min(u.maxHp, u.hp + n); V.burst('heal', u.pos.clone().setY(u.pos.y + 1.2), 20, { speed: 2, vy: 2 }); }
export function ultSlow(u, k, dur) { if (!u || u.dead) return; u.ultSlowT = G.time + dur; u.ultSlowK = k; }
// the caster's camera: flies up and out of their eyes to circle the action, then back. focus() gives the point to watch;
// backAt() the time to fly home (seconds into the ultimate). Returns the camera function (it is set as p.cine).
export function ultFlyCam(p, focus, backAt, opts = {}) { const t0 = G.time, Q0 = new THREE.Quaternion(), Qb = new THREE.Quaternion(), M4 = new THREE.Matrix4(), P0 = new THREE.Vector3(), Ob = new THREE.Vector3(), tgt = new THREE.Vector3(); let off = null, offS = 0, chk = -9;
  const e = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }, r = opts.r || 13, h = opts.h || 5, a0 = opts.ang != null ? opts.ang : p.yaw + Math.PI + 0.7;
  const cam = (c) => { const ct = G.time - t0, k = e(ct / 1.0) * (1 - e((ct - backAt()) / 0.95)); P0.copy(p.pos); P0.y += p.eye; Q0.setFromEuler(new THREE.Euler(p.pitch, p.yaw + Math.PI, 0, 'YXZ'));
    tgt.copy(focus(ct)); const ang = a0 + ct * 0.18;
    if (off == null || G.time - chk > 0.5) { chk = G.time; off = 0; for (let i = 0; i < 12; i++) { const a2 = ang + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.5; if (lineClear(tgt, new THREE.Vector3(tgt.x + Math.cos(a2) * r, tgt.y + h, tgt.z + Math.sin(a2) * r))) { off = a2 - ang; break; } } }
    offS += (off - offS) * 0.06; Ob.set(tgt.x + Math.cos(ang + offS) * r, tgt.y + h, tgt.z + Math.sin(ang + offS) * r); M4.lookAt(Ob, tgt, new THREE.Vector3(0, 1, 0)); Qb.setFromRotationMatrix(M4);
    c.position.lerpVectors(P0, Ob, k); c.position.y += Math.sin(k * Math.PI) * 2.5; c.quaternion.slerpQuaternions(Q0, Qb, k); };
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
    pillar.material.opacity = 0.12 * seg(t, 0.1, 0.6) * (1 - seg(t, T.impact - 0.2, T.impact + 0.2));
    // enemies on the glyph are weighed down until it lands
    slT -= dt; if (!struck && slT <= 0) { slT = 0.2; for (const u of ultFoes(caster)) if (Math.hypot(u.pos.x - C.x, u.pos.z - C.z) < T.r) { ultSlow(u, T.slow, 0.35); if (Math.random() < 0.4) V.emit('gold', u.pos.clone().setY(u.pos.y + 0.2), { speed: 0.5, vy: -1, size: 0.25 }); } }
    // the sword forms high up, turns slowly, then falls faster and faster
    if (!struck) { const fk = seg(t, 0.3, 0.8); sword.scale.setScalar(Math.max(0.01, fk)); const k = Math.max(0, Math.min(1, (t - 0.8) / (T.impact - 0.8))), drop = k * k * k; sword.position.y = base + 40 - (40 - 12) * drop; sword.rotation.y = t * (0.6 + drop * 3);
      sword.userData.halo.rotation.z = t * 2; motesT -= dt; if (motesT <= 0 && fk > 0.5) { motesT = 0.05; V.emit('gold', sword.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.2, -Math.random() * 12, (Math.random() - 0.5) * 1.2)), { speed: 0.6, size: 0.35, life: 0.8 }); }
      if (k > 0.85) V.addShake(dt * 2); }
    if (!struck && t >= T.impact) { struck = true; sword.position.y = base + 12 - 2.2; sword.rotation.y = 0.3;
      V.burst('gold', C.clone().setY(base + 0.5), 160, { speed: 12 }); V.burst('stone', C.clone().setY(base + 0.3), 70, { speed: 9, grav: 14 }); V.burst('dust', C.clone().setY(base + 0.3), 60, { speed: 7 });
      V.ring(C.clone().setY(base + 0.2), T.r * 2.2, '#fff0a0', 0.8); V.ring(C.clone().setY(base + 0.3), T.r * 1.2, '#ffd060', 0.5); V.sphereFlash(C.clone().setY(base + 1.5), T.r * 0.9, '#fff4c0', 0.45); V.light(C.clone().setY(base + 4), '#ffe090', 16, 1.0, 40); V.addShake(1.3);
      S.explode && S.explode(C, 1.3); S.cast && S.cast('holy', C, 1.6);
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

export function summonDemon(caster, at) {
  // the necromancer's ultimate, cast on the ground: a ring of green hellfire bursts up, the floor cracks and glows, and a
  // skeletal demon claws its way slowly out of the pit and roars. When it is up it seizes the nearest enemy in reach, lifts
  // them overhead while they struggle, and bites their head off, then sinks back as the fire dies. Nobody in reach: it
  // searches, roars in fury, and sinks back down. Whoever is caught sees it all from a cinematic camera.
  if (at && at.pos) at = at.pos; if (!at) return false; const RR = 10.35, FRZ = G.ringFRZ || 1.5; // (FRZ: the freeze when the ring bursts up; from dead centre only a leap dodge then gets out in time) // (the ring: everyone inside is slowed, and the demon can grab anyone still inside it)
  const inAr = A.F && A.F.length > 0, base = inAr ? gy(at.x, at.z, at.y) : heightAt(at.x, at.z), face = caster && caster.pos ? Math.atan2(caster.pos.x - at.x, caster.pos.z - at.z) : 0;
  const D = makeDemon(), g = D.g, ox = at.x, oz = at.z, center = new THREE.Vector3(ox, base, oz); g.position.set(ox, base - 6.5, oz); g.rotation.order = 'YXZ'; g.rotation.y = face; /* (yaw, then a lean in its own frame) */ G.scene.add(g); addOutline(g);
  const ring = makeHellRing(RR, 64); ring.position.copy(center); G.scene.add(ring);
  S.rumble && S.rumble(center, 1.6); V.addShake(0.25);
  const team = caster === G.player ? G.myTeam : caster.team, enemies = () => (inAr ? A.F.filter(f => f.alive && f.team !== team).map(unitOf).filter(u => u && !u.dead) : caster === G.player ? (G.mobs || []).filter(m => !m.dead && !m.pet && !m.ally && m.pos) : [G.player].filter(u => u && !u.dead)).filter(u => !((u.ultImmT || 0) > 0)); /* (the Training Yard: its dummies) */
  const e = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }, seg = (t, a, b) => e((t - a) / (b - a)), L = (a, b, k) => a + (b - a) * k;
  let GRAB = 3.0, BITE = 5.8, yawC = face, t = 0, bit = false, victim = null, from = null, missed = false, sinkAt = 6.8, roared = 0, emT = 0, liT = 0;
  const hp = new THREE.Vector3(), mouth = new THREE.Vector3(), headW = new THREE.Vector3(), dripP = new THREE.Vector3(); let emT2 = 0, slT = 0, chomp = false, vroot = null, froze = false;
  const cineOff = () => { const p = G.player; if (p && p.cine) { p.cine = null; } document.body.classList.remove('cine'); const bars = document.getElementById('cinebars'); if (bars) bars.classList.remove('on'); };
  const me = caster === G.player ? G.player : null; let flyCam = null;
  if (me) { me.held = true; me.ultImmT = 9; me.ultPoseT = 0; me.headUpT = 0; me.oozeT = 7.5; me.oozeE = 0; me.tpT = 0; startFly(); }
  G.timers.push({ update: (dt) => { t += dt;
    if (me) { me.ultImmT = Math.max(me.ultImmT, 0.5); me.oozeT = Math.max(me.oozeT, t < sinkAt + 1.0 ? 0.6 : 0); if (t > sinkAt + 1.6 && me.held) { me.held = false; me.cine = null; me.oozeT = 0; me.ultImmT = 0.6; } }
    // the fire: sweeps round to a full ring in the first second, roars while the demon is up, gutters out at the end
    const end = sinkAt + 1.8, fk = Math.min(seg(t, 0, 1.1), 1 - seg(t, sinkAt + 1.2, end)); ring.userData.tick(fk, t);
    emT -= dt; if (emT <= 0 && fk > 0.2) { emT = 0.04; for (let i = 0; i < 3; i++) { const a = Math.random() * Math.PI * 2; V.emit('poison', new THREE.Vector3(ox + Math.cos(a) * RR, base + 0.4 + Math.random(), oz + Math.sin(a) * RR), { speed: 1.2, vy: 3.5, size: 0.35, life: 1.1 }); } }
    liT -= dt; if (liT <= 0 && fk > 0.1) { liT = 0.15; V.light(new THREE.Vector3(ox, base + 2.5, oz), '#40ff60', (5 + Math.random() * 2) * fk, 0.2, 18); }
    // the moment the ring bursts up, everyone caught inside it is frozen in place for a second
    if (!froze && t >= 0.25) { froze = true; for (const u of enemies()) if (Math.hypot(u.pos.x - ox, u.pos.z - oz) < RR) { if (u === G.player) { G.player.debuff && G.player.debuff('freeze', FRZ); G.player.ultImmT = Math.max(G.player.ultImmT || 0, FRZ); } else if (u.status) { u.status.frozen = Math.max(u.status.frozen || 0, FRZ); u.cast = null; u.invulnT = G.time + FRZ; } /* (frozen and untouchable for that second) */ V.burst('poison', u.pos.clone().setY(u.pos.y + 1), 20, { speed: 2.5 }); V.sphereFlash(u.pos.clone().setY(u.pos.y + 1), 1.1, '#3aff5a', 0.3); } }
    // everyone inside the fire ring is slowed while the demon rises (escape the circle and you are safe)
    slT -= dt; if (slT <= 0 && !bit && t < (victim ? GRAB : sinkAt)) { slT = 0.25; for (const u of enemies()) if (Math.hypot(u.pos.x - ox, u.pos.z - oz) < RR) { u.ringSlowT = G.time + 0.4; /* (the demon's ring slows far harder than a normal slow: to 15.6% speed) */ } }
    // rising: a slow, heavy climb with a judder, clawing at the edge of the pit; sinking: slow, dragged back down
    const up = t < sinkAt ? seg(t, 1.0, 2.9) : 1 - seg(t, sinkAt, sinkAt + 1.9), jud = (t > 1.0 && t < 2.9) || (t > sinkAt && t < sinkAt + 1.9) ? Math.sin(t * 38) * 0.04 : 0;
    g.position.y = base - 6.5 + up * 6.0 + jud + Math.sin(t * 1.6) * 0.06 * up; g.rotation.z = Math.sin(t * 1.1) * 0.03; if (t > 1 && t < 2.9 || t > sinkAt && t < sinkAt + 1.9) V.addShake(dt * 0.6);
    const heartS = 1 + Math.sin(t * 7) * 0.12; D.heart.scale.setScalar(heartS);
    { let want = face; if (victim && from) want = Math.atan2(from.x - ox, from.z - oz); else if (missed && t < sinkAt) want = face + e((t - GRAB) / 2.0) * Math.PI * 2 + Math.sin((t - GRAB) * 5) * 0.15; /* (a full slow turn, hunting) */
      let dA = want - yawC; if (!missed) { dA = Math.atan2(Math.sin(dA), Math.cos(dA)); } yawC += dA * Math.min(1, dt * (victim && t < GRAB + 0.5 ? 14 : missed ? 10 : 4)); g.rotation.y = yawC;
      const reachD = victim && from ? Math.hypot(from.x - ox, from.z - oz) : 0, leanK = victim ? seg(t, GRAB, GRAB + 0.4) * (1 - seg(t, GRAB + 0.75, GRAB + 1.4)) : 0;
      g.rotation.x = leanK * Math.min(1.0, 0.3 + reachD * 0.075); } /* (it leans right over to snatch them, then hauls them up as it straightens) */
    emT2 = (emT2 || 0) - dt; if (emT2 <= 0 && up > 0.3) { emT2 = 0.05; for (const H of [D.arms.R.hand, D.arms.L.hand]) { H.getWorldPosition(dripP); dripP.y -= 0.5; V.emit('poison', dripP, { speed: 0.3, vy: -3, size: 0.22, life: 0.7, radius: 0.3 }); } } /* (ooze dripping from its hands) */
    const R = D.arms.R, Lf = D.arms.L, rising = t < 2.9;
    // left arm: claws the ground while climbing, then braces and sways
    Lf.sh.rotation.x = rising ? -1.2 + Math.sin(t * 5) * 0.35 : L(-0.5, -0.3, Math.sin(t * 1.3) * 0.5 + 0.5); Lf.sh.rotation.z = rising ? -0.5 : -0.15; Lf.el.rotation.x = rising ? -0.9 : -0.5 + Math.sin(t * 2) * 0.1;
    // the roar: head back, jaw wide, throat blazing
    const roar = seg(t, 2.35, 2.6) * (1 - seg(t, 3.0, 3.25)), roar2 = missed ? seg(t, 4.0, 4.25) * (1 - seg(t, 4.7, 5.0)) : 0, rr = Math.max(roar, roar2);
    if (rr > 0.5 && roared < (roar2 > 0.5 ? 2 : 1)) { roared++; S.growl && S.growl('wolf', center, 0.4); S.explode && S.explode(center, 0.5); V.addShake(0.8); V.ring(center.clone().setY(base + 0.2), RR * 2, '#3aff5a', 0.7); V.burst('poison', center.clone().setY(base + 4), 50, { speed: 7 }); }
    D.throat.scale.setScalar(1 + rr * 1.2);
    if (t >= GRAB && !victim && (!missed || t < sinkAt - 0.5)) { let best = null, bd = RR; for (const u of enemies()) { const d = Math.hypot(u.pos.x - ox, u.pos.z - oz); if (d < bd) { bd = d; best = u; } }
      if (best && missed) { missed = false; GRAB = t; BITE = t + 2.8; sinkAt = BITE + 1.0; } /* (caught someone mid-search) */
      if (best) { victim = best; vroot = best.root || (best.ch && best.ch.root); from = best.pos.clone(); victim.held = true; if (victim === G.player) { G.player.debuff && G.player.debuff('stun', BITE - GRAB + 0.3); startCine(); } else if (victim.status) { victim.status.stun = BITE - GRAB + 0.3; victim.cast = null; victim.pending = null; } }
      else if (!missed) { missed = true; sinkAt = 5.4; } }
    // right arm: reach, seize, hoist overhead, hold up as they struggle, bring them to the jaws
    let shx = -0.4 + Math.sin(t * 1.4) * 0.08, shz = 0.1, elx = -0.4;
    if (rising) { shx = -1.0 + Math.sin(t * 5 + 1.5) * 0.35; shz = 0.45; elx = -0.9; }
    if (victim) { const kR = seg(t, GRAB, GRAB + 0.45), kL = seg(t, GRAB + 0.5, GRAB + 1.4), kM = seg(t, BITE - 0.45, BITE);
      shx = L(L(shx, -1.15, kR), -2.75, kL); elx = L(L(elx, -0.15, kR), -0.35, kL); shz = L(shz, 0.15, kR);
      shx = L(shx, -2.95, kM); shz = L(shz, 0.5, kM); elx = L(elx, -0.25, kM); if (t > GRAB + 1.4 && t < BITE - 0.45) shx += Math.sin(t * 9) * 0.05; }
    else if (missed && t < sinkAt) { shx = -0.9 + Math.sin(t * 3) * 0.3; shz = 0.3; }
    R.sh.rotation.x = shx; R.sh.rotation.z = shz; R.el.rotation.x = elx;
    // head: tracks the victim, tips back to roar, cranes up at the prize, lunges for the bite; searches when nobody is there
    let hx = rising ? 0.35 : 0.05, hy = 0; if (missed && t < sinkAt) hy = Math.sin((t - GRAB) * 3.2) * 0.45; else if (victim && !bit) { g.updateMatrixWorld(true); D.head.getWorldPosition(headW); const lv = victim.pos.clone().sub(headW); hy = 0; hx = L(hx, -Math.atan2(lv.y + 1, Math.hypot(lv.x, lv.z)) * 0.6, 0.7); }
    hx = L(hx, -0.55, rr); if (victim) { hx = L(hx, -0.5, seg(t, GRAB + 1.4, BITE - 0.6)); hx = L(hx, -1.5, seg(t, BITE - 0.6, BITE - 0.15)); hx = L(hx, 0.1, seg(t, BITE + 0.7, BITE + 1.2)); }
    D.head.rotation.x = hx; D.head.rotation.y = hy;
    let jw = rr * 0.75 + Math.max(0, Math.sin(t * 2.2)) * 0.06; if (victim) { jw = Math.max(jw, seg(t, BITE - 1.0, BITE - 0.2) * 0.85 * (1 - seg(t, BITE - 0.05, BITE))); if (t >= BITE) jw = 0.55 + Math.max(0, Math.sin((t - BITE) * 14)) * 0.35 * (1 - seg(t, BITE + 0.9, BITE + 1.3)); }
    D.jaw.rotation.x = jw;
    g.updateMatrixWorld(true); R.hand.getWorldPosition(hp); D.head.localToWorld(mouth.set(0, -0.5, 0.75));
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
    if (t > end) { if (me) { me.held = false; if (me.cine === flyCam) me.cine = null; } G.scene.remove(g); G.scene.remove(ring); if (victim) { victim.held = false; if (vroot) { vroot.rotation.z = 0; vroot.rotation.x = 0; } } if (victim === G.player && !bit) cineOff(); return true; }
    return false; } }); // (a timer is finished when it returns true)
  // walls between the camera and the action: swing round until the line is clear
  function clearAng(mid, ang, r, cy) { for (let k = 0; k < 12; k++) { const a2 = ang + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.5; if (lineClear(mid, new THREE.Vector3(mid.x + Math.cos(a2) * r, cy, mid.z + Math.sin(a2) * r))) return a2 - ang; } return 0; }
  // the caster's view: flies up and out of your eyes to circle the pit, watches the whole thing, then flies back
  function startFly() { const p = G.player, t0 = t, Q0 = new THREE.Quaternion(), Qb = new THREE.Quaternion(), M4 = new THREE.Matrix4(), P0 = new THREE.Vector3(), Ob = new THREE.Vector3(), tgt = new THREE.Vector3(); let off = null, offS = 0, chk = -9;
    flyCam = p.cine = (cam) => { const ct = t - t0, back0 = sinkAt + 0.65, kin = e(ct / 1.0), kout = e((t - back0) / 0.95), k = kin * (1 - kout);
      P0.copy(p.pos); P0.y += p.eye; Q0.setFromEuler(new THREE.Euler(p.pitch, p.yaw + Math.PI, 0, 'YXZ'));
      D.head.getWorldPosition(tgt); tgt.y = Math.max(base + 1.5, tgt.y - 1.2);
      const ang = face + 0.75 + ct * 0.2, r = 12.5, cy = base + 4.2; if (off == null || G.time - chk > 0.5) { chk = G.time; off = clearAng(tgt, ang, r, cy); } offS += (off - offS) * 0.06;
      Ob.set(tgt.x + Math.cos(ang + offS) * r, cy, tgt.z + Math.sin(ang + offS) * r);
      M4.lookAt(Ob, tgt, new THREE.Vector3(0, 1, 0)); Qb.setFromRotationMatrix(M4);
      cam.position.lerpVectors(P0, Ob, k); cam.position.y += Math.sin(k * Math.PI) * 2.5; cam.quaternion.slerpQuaternions(Q0, Qb, k); }; }
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
// P: perks. Points come with time; spend them on any of your class's ten perks (three ranks each), whenever you like
export function openPerks(UI) {
  const p = G.player, h = p.h, cls = h.cls, f = A.me; h.arenaPerks = h.arenaPerks || {};
  const c = UI.openWin('arenaperks', CLASSES[cls].name + ' · perks', '', 'big');
  const iconOf = (pk) => { const id = pk.slot && pk.slot !== 'L' ? (pk.slot === 'R' ? h.arenaRmb : (h.arenaKit || [])[['F', 'C', 'Q'].indexOf(pk.slot)]) : null; return id && id !== 'aim' ? Icons.abilityIcon(id) : `<span class="perkglyph${pk.passive ? ' pas' : ''}">${pk.glyph || { powL: '⚔' }[pk.id] || '◆'}</span>`; };
  const draw = () => { const left = perkLeft(f); c.innerHTML = '';
    c.insertAdjacentHTML('beforeend', `<div class="perkhead"><b>${left}</b> perk point${left === 1 ? '' : 's'} to spend <span class="dim">· you earn 1 every 10 seconds of fighting${Game.TANK_CLS.has(cls) ? ' · <b style="color:#9fd0ff;font-size:13px">Tank</b>: 40% more health, 15% less damage taken' : ''}</span></div>`);
    const list = elx('div', 'perkgrid');
    for (const pk of perksFor(cls)) { const lv = h.arenaPerks[pk.id] || 0, r = elx('div', 'perkcard' + (lv ? ' has' : ''));
      r.innerHTML = `<div class="kiti">${iconOf(pk)}</div><div class="kitt"><b>${pk.name}</b><span>${pk.desc}</span><div class="perkpips">${Array.from({ length: Game.PERK_MAX }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</div></div>`;
      const plus = elx('button', 'btn gold perkb', '+'), minus = elx('button', 'btn perkb', '−'); plus.disabled = lv >= Game.PERK_MAX || left <= 0; minus.disabled = lv <= 0;
      plus.onclick = () => { h.arenaPerks[pk.id] = lv + 1; applyPerkStats(f); S.click(); draw(); }; minus.onclick = () => { h.arenaPerks[pk.id] = lv - 1; applyPerkStats(f); S.click(); draw(); };
      const bx = elx('div', 'perkbtns'); bx.append(plus, minus); r.appendChild(bx); list.appendChild(r); }
    c.appendChild(list); };
  draw();
}
// I or H: what every one of your keys does
export function openKitInfo(UI, into) {
  const p = G.player, h = p.h, W = p.W, cls = h.cls, c = into || UI.openWin('arenakit', CLASSES[cls].name + ' · your abilities', '', 'big');
  const icon = (id) => { try { return Icons.abilityIcon(id); } catch (e) { return ''; } };
  const row = (key, name, desc, cd, id) => `<div class="kitrow"><div class="kitk">${key}</div>${id ? `<div class="kiti">${icon(id)}</div>` : '<div class="kiti"></div>'}<div class="kitt"><b>${name}</b>${cd ? `<i>${cd} s cooldown</i>` : ''}<span>${desc}</span></div></div>`;
  const ab = (id) => ABILITIES[cls].find(a => a.id === id);
  const lmb = W ? (W.kind === 'bow' ? 'Shoot an arrow. Hold to keep shooting.' : W.kind === 'gun' ? 'Fire. Hold to keep firing.' : W.kind === 'staff' ? (cls === 'necromancer' ? 'Spit a dripping ball of poison. Hold to spray poison in a cone; it creeps onto nearby enemies.' : 'Cast a bolt from your staff. Hold to keep casting.') : 'Swing your weapon. Hold to keep swinging.') : 'Punch.';
  let html = row('LMB', W ? WEAPON_TYPES[p.weapon.wt].name : 'Fists', lmb, 0, null);
  const r = h.arenaRmb, shield = W && W.hands === 'shield';
  if (shield) html += row('RMB', 'Block', 'Hold to raise your shield. Raise it just before a hit for a perfect block.', 0, 'shieldwall');
  else if (r === 'aim') html += row('RMB', 'Aim down the barrel', 'Hold to aim: zoom in, steadier and a little harder-hitting shots, but you walk slowly.', 0, null);
  else if (r && ab(r)) { const a = ab(r); html += row('RMB', a.name, a.desc, a.cd, a.id); }
  ['F', 'C', 'Q'].forEach((k, i) => { const a = ab((h.arenaKit || [])[i]); if (a) html += row(k, a.name, a.desc, a.cd, a.id); });
  { const u = h.arenaUlt && ab(h.arenaUlt); if (u) html += row('R', 'Ultimate · ' + u.name, u.desc + ' Charges over time, faster when you deal damage or heal.', 0, u.id); }
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
function finish(w) { if (AN.on && AN.host) nsend({ t: 'over', w }); celebrate(w); A.state = 'over'; A.winner = w; AR.gatesOpen = false; cheer(2); A.hooks.over && A.hooks.over(w); renderEnd(); }

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
  const p = G.player; if (!p || p.dead) return 0; if (src && src.pos) dmgDir(src.pos); const [d, o2] = pvpIncoming(p, raw * PVP_K * PACE, o || {}); const hp0 = p.hp; p.takeDamage(d, src, o2);
  if (p.abCast && p.abCast.spell && Math.random() < 0.35) { p.abCast = null; G.hooks.castBar && G.hooks.castBar(null); G.hooks.toast && G.hooks.toast('Your spell was interrupted', '✋', 'bad'); }
  if (!p.dead && o && o.poison && p.debuff) p.debuff('poison', 4, o.poison * PVP_K * PACE / 4);
  if (!p.dead && o && o.fear && src && src.pos) { p.fearT = Math.max(p.fearT || 0, o.fear); p.fearFrom = src.pos.clone(); G.hooks.toast && G.hooks.toast('You are fleeing in terror!', '💀', 'bad'); }
  if (!p.dead && p.debuff) { if (o2.stun || o2.freeze) p.debuff('stun', Math.max(o2.stun || 0, o2.freeze || 0)); if (o2.slow || o2.root) p.debuff('slow', Math.max(o2.slow || 0, (o2.root || 0) * 1.3)); }
  const dealt = Math.max(0, hp0 - p.hp); if (src && src.arenaF) src.arenaF.dmg += dealt; return dealt;
}
function hitUnit(src, tgt, raw, o) { if (!tgt || tgt.dead) return 0; if (src && src.arenaBot) [raw, o] = Game.arenaOut(src, src.h, tgt, raw, o || {}); const d = tgt === G.player ? hitPlayer(src, raw, o) : tgt.takeHit ? (tgt.takeHit(raw, src, o) || 0) : 0; const ls = src && src.arenaBot ? Game.arenaStat(src.h, 'lifesteal') : 0; if (ls && d > 0) src.healSelf(d * 0.03 * ls); if (src && src.h && d > 0) ultGain(src.h, d / 40); return d; }
// heals and buffs on a team mate (computer or player)
function healUnit(u, amt, from) { if (!u || u.dead || amt <= 0) return; { const sh = from && from.h ? Game.arenaPassive(from.h, 'shieldHeal') : 0; if (sh) { const v = amt * 0.15 * sh; if (u === G.player) { u.buffs.barrier = (u.buffs.barrier || 0) + v; u.buffs.barrierT = Math.max(u.buffs.barrierT || 0, 6); } else if (u.buffs) { u.barrier = (u.barrier || 0) + v; u.buffs.barrier = Math.max(u.buffs.barrier || 0, 6); } } } /* (a healer's perk: heals leave a shield) */ if (u === G.player) { u.heal(amt, true); } else u.healSelf(amt); if (from && from.arenaF) from.arenaF.heal += amt; if (from && from.h) ultGain(from.h, amt / 50); V.burst('heal', u.pos.clone().setY(u.pos.y + 1.2), 12, { speed: 2, vy: 2 }); }
function buffUnit(u, kind, dur) { if (!u || u.dead) return; if (u === G.player) { u.buffs[kind] = Math.max(u.buffs[kind] || 0, dur); if (kind === 'barrier') { u.buffs.barrier = u.maxHp * 0.2; u.buffs.barrierT = dur; } } else u.addBuff(kind, dur); V.sphereFlash(u.pos.clone().setY(u.pos.y + 1), 1.2, kind === 'ward' || kind === 'barrier' ? '#80d8ff' : '#ffd84a', 0.4); }
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
  else if (kind === 'frost') { g.add(new THREE.Mesh(geoOf('fsh', () => new THREE.OctahedronGeometry(0.14, 0).scale(0.7, 0.7, 1.9)), new THREE.MeshStandardMaterial({ color: '#d8f6ff', emissive: '#60c8ff', emissiveIntensity: 1.3, transparent: true, opacity: 0.9 }))); g.add(new THREE.Mesh(geoOf('halo', () => new THREE.SphereGeometry(0.3, 12, 10)), addMat(col, 0.28))); }
  else { g.add(new THREE.Mesh(geoOf('core', () => new THREE.SphereGeometry(0.12, 12, 10)), addMat('#ffffff', 0.95))); g.add(new THREE.Mesh(geoOf('halo', () => new THREE.SphereGeometry(0.3, 12, 10)), addMat(col, 0.45))); g.add(new THREE.Mesh(geoOf('halo2', () => new THREE.SphereGeometry(0.5, 12, 10)), addMat(col, 0.15))); }
  g.scale.setScalar(k); return g;
}
function shot(src, tgt, col, onHit, big, kind) {
  kind = kind || (src.W && src.W.kind === 'bow' && !big ? 'arrow' : src.W && src.W.kind === 'gun' && !big ? 'bullet' : col === SHOT_COL.frost ? 'frost' : 'orb');
  const m = shotMesh(kind, col, big), from = src.pos.clone().setY(src.pos.y + 1.35).addScaledVector(V3(Math.sin(src.yaw), 0, Math.cos(src.yaw)), 0.6);
  m.position.copy(from); G.scene.add(m); A.shots.push({ m, tgt, onHit, col, t: 0, kind, speed: kind === 'bullet' ? 46 : kind === 'arrow' ? 32 : 22 });
  if (AN.on && AN.host && src.arenaF) nsend({ t: 'shot', f: src.arenaF.i, to: tgt === G.player ? A.me.i : tgt.arenaF ? tgt.arenaF.i : -1, k: kind, c: col, b: big ? 1 : 0 });
}
function updateShots(dt) {
  for (let i = A.shots.length - 1; i >= 0; i--) { const s = A.shots[i]; s.t += dt; const tp = s.tgt.pos.clone().setY(s.tgt.pos.y + 1.1), d = tp.clone().sub(s.m.position), L = d.length();
    if (L < 0.6 || s.t > 2.5 || s.tgt.dead) { G.scene.remove(s.m); A.shots.splice(i, 1); if (!s.tgt.dead && L < 3) { s.onHit(); if (s.kind === 'orb' || s.kind === 'frost') { V.burst(s.col === SHOT_COL.fire ? 'fire' : s.kind === 'frost' ? 'frost' : 'arcane', tp, 18, { speed: 4 }); V.sphereFlash(tp, 0.8, s.col, 0.2); } else V.burst('spark', tp, 6, { speed: 3 }); } continue; }
    d.normalize(); s.m.position.addScaledVector(d, Math.min(L, s.speed * dt)); s.m.lookAt(tp); if (s.kind === 'orb' || s.kind === 'frost') { V.emit(s.col === SHOT_COL.fire ? 'fire' : s.kind === 'frost' ? 'frost' : 'arcane', s.m.position.clone(), { n: 2, speed: 0.4 }); s.m.children[1] && (s.m.children[1].scale.setScalar(1 + Math.sin(s.t * 30) * 0.15)); } } // spells trail their element and pulse; arrows and shot fly fast and point the way they go
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
const SUPPORT_CLS = new Set(['cleric', 'druid', 'shaman', 'paladin', 'bard', 'enchanter']);
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
    this.ranged = ['bow', 'gun', 'staff'].includes(this.W.kind); this.range = this.ranged ? (this.W.kind === 'gun' ? 16 : 15) : 2.6;
    this.abs = [...(h.arenaKit || []), h.arenaRmb].filter(id => id && id !== 'aim').map(id => ABILITIES[h.cls].find(a => a.id === id)).filter(Boolean); this.cd = {}; for (const a of this.abs) this.cd[a.id] = Math.random() * 3;
    this.healer = this.abs.some(a => a.t === 'heal' && (a.ally || SUPPORT_CLS.has(h.cls)));
    this.buffs = {}; this.hots = []; this.dots = []; this.gcd = 0; this.swingT = 0; this.thinkT = 0; this.strafe = Math.random() < 0.5 ? 1 : -1; this.act = ''; this.actT = 0; this.spd = 0; this.pets = [];
    this.role = Math.random() < 0.5 ? 'attack' : 'defend'; this.recalc(); this.hp = this.maxHp;
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
  dmgMul() { let k = 1; const b = this.buffs; if (b.cry > 0) k *= 1.3; if (b.rage > 0) k *= 1.15; if (b.surge > 0) k *= 1.2; if (b.lich > 0) k *= 1.4; if (b.form > 0) k *= 1.35; if (b.avatar > 0 && this.av && this.av.dmg) k *= this.av.dmg; return k; }
  // ---- being hit (by the player, a team mate's enemy, a pet...) ----
  takeHit(dmg, src, o = {}) {
    if (this.dead || A.state !== 'fight' || this.invulnT > G.time) return 0; const b = this.buffs;
    if (b.iceblock > 0 || b.phase > 0) { V.number(this.pos.clone().setY(this.pos.y + this.height + 0.3), 'Immune', 'miss'); return 0; }
    if (src && src.team === this.team) return 0;
    dmg *= PVP_K * PACE * Game.arenaTakenK(this.h); dmg = Game.arenaIn(this, this.h, dmg); if (src && src.hexUntil > G.time) dmg *= 0.65;
    { const th = Game.arenaPassive(this.h, 'thorns'); if (th && o.melee && src && !src.dead && src.pos) { const r2 = dmg * 0.08 * th; if (src === G.player) src.takeDamage(r2, this, { silent: true }); else if (src.arenaBot) { src.hp -= r2; if (src.hp <= 0) src.die(this); } } }
    const red = this.D.armor / (this.D.armor + 40 + LEVEL_CAP * 12); dmg *= 1 - red;
    if (b.ward > 0) dmg *= 0.6; if (b.wall > 0) dmg *= 0.4; if (b.fort > 0) dmg *= 0.7; if (b.stand > 0) dmg *= 0.75; if (b.lich > 0) dmg *= 0.75; if (b.avatar > 0 && this.av && this.av.taken) dmg *= this.av.taken;
    if (this.barrier > 0 && b.barrier > 0) { const ab = Math.min(this.barrier, dmg); this.barrier -= ab; dmg -= ab; }
    dmg = Math.max(1, Math.round(dmg)); const hp0 = this.hp; this.hp -= dmg; this.hurtT = G.time; this.lastHitBy = src; if (b.undying > 0 && this.hp < 1) this.hp = 1;
    // you can see it land: a flinch, a bright flash on the body, and blood or sparks (or the spell's element)
    this.hitT = 0.32; for (const m of this.flashMats) { if (m.emissive) { m.emissive.setRGB(1, 0.92, 0.85); m.emissiveIntensity = 0.65; } }
    { const at = this.pos.clone().setY(this.pos.y + 1.15), kind = o.el === 'fire' ? 'fire' : o.el === 'frost' ? 'frost' : o.el ? 'arcane' : this.D.armor > 120 ? 'spark' : 'blood'; V.burst(kind, at, o.melee || dmg > this.maxHp * 0.08 ? 14 : 7, { speed: 3.5 }); }
    if (src && src.pos && !o.el) { const d = this.pos.clone().sub(src.pos).setY(0); if (d.lengthSq() > 0.01) this.status.knock.addScaledVector(d.normalize(), o.melee ? 0.9 : 0.4); }
    { const real = Math.min(dmg, Math.max(0, hp0)); if (src && src.arenaF) src.arenaF.dmg += real; else if (src === G.player) A.me.dmg += real; } // (only the health actually taken counts)
    // control effects fall off when chained, like they do on players
    if (o.stun || o.freeze || o.slow || o.root || o.fear) { const now = G.time; if (!this.ccT || now - this.ccT > 10) this.ccN = 0; const f = Math.pow(0.5, this.ccN || 0); this.ccN = (this.ccN || 0) + 1; this.ccT = now;
      if (o.stun || o.freeze) { this.status.stun = Math.max(this.status.stun, (o.stun || o.freeze) * f); this.status.mez = !!o.mez; this.cast = null; this.pending = null; } if (o.fear && src && src.pos) { this.status.fear = Math.max(this.status.fear || 0, o.fear * f); this.fearFrom = src.pos.clone(); this.cast = null; this.pending = null; this.dashing = null; V.number(this.pos.clone().setY(this.pos.y + this.height + 0.5), 'Feared!', 'crit'); } if (o.slow) this.status.slow = Math.max(this.status.slow, o.slow * f); if (o.root) this.status.root = Math.max(this.status.root, o.root * f); }
    if (o.blight) this.blightT = Math.max(this.blightT || 0, o.blight); if (this.blightT > 0 && o.poison) o = Object.assign({}, o, { poison: o.poison * 1.5 }); // (Blight: poison bites harder)
    if (o.poison) { const ex = this.dots.find(x => x.spread != null && x.src === src); if (ex) { ex.t = 4; ex.dps = Math.max(ex.dps, o.poison * PVP_K / 4); } else this.dots.push({ dps: o.poison * PVP_K / 4, t: 4, src, spread: o.spread || 0 }); } // a necromancer's poison: it can creep onto enemies standing close
    if (o.bleed) this.dots.push({ dps: o.bleed * PVP_K / 4, t: 4, src }); if (o.burn) this.dots.push({ dps: o.burn * PVP_K / 4, t: 4, src });
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
    for (const k of ['stun', 'slow', 'root', 'frozen', 'fear']) st[k] = Math.max(0, (st[k] || 0) - dt);
    if (this.hitT > 0) { this.hitT = Math.max(0, this.hitT - dt); const f = this.hitT / 0.32; for (const m of this.flashMats) if (m.emissive) m.emissiveIntensity = 0.65 * f * f; }
    if (this.stealth > 0) { this.stealth = Math.max(0, this.stealth - dt); }
    for (let i = this.hots.length - 1; i >= 0; i--) { const h = this.hots[i]; h.t -= dt; this.healSelf(h.ps * dt); if (h.t <= 0) this.hots.splice(i, 1); }
    for (const d of this.dots) if (d.spread > 0 && Math.random() < dt * 0.9) { d.spread--; const nb = A.F.map(unitOf).find(u => u && u !== this && !u.dead && u.team === this.team && u.takeHit && u.dots && Math.hypot(u.pos.x - this.pos.x, u.pos.z - this.pos.z) < 4.5 && !(u.dots || []).some(x => x.spread != null)); if (nb) { nb.dots.push({ dps: d.dps, t: 4, src: d.src, spread: 0 }); V.burst('green', nb.pos.clone().setY(nb.pos.y + 1), 14, { speed: 2 }); } }
    this.blightT = Math.max(0, (this.blightT || 0) - dt); for (let i = this.dots.length - 1; i >= 0; i--) { const d = this.dots[i]; d.t -= dt; this.hp -= d.dps * dt * (d.spread != null && this.blightT > 0 ? 1.5 : 1); if (d.t <= 0) this.dots.splice(i, 1); if (this.hp <= 0) { this.die(d.src); return; } }
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
      else { speed = this.move(dt); this.fight(); }
    }
    // knockback
    if (st.knock && st.knock.lengthSq() > 0.01) { this.pos.addScaledVector(st.knock, dt * 6); st.knock.multiplyScalar(Math.max(0, 1 - dt * 6)); }
    confine(this.pos, 1);
    if (RUINS_MAP()) worldCollide(this.pos, 0.45); this.pos.y = gy(this.pos.x, this.pos.z, this.pos.y); this.root.position.copy(this.pos); this.root.rotation.y = this.yaw;
    const vis = !(this.stealth > 0 && this.team !== G.myTeam); this.root.visible = (vis || Math.hypot(this.pos.x - G.player.pos.x, this.pos.z - G.player.pos.z) < 3) && !(G.camera && G.camera.position.distanceTo(this.pos.clone().setY(this.pos.y + 1)) < 1.15); // (hidden when the camera is inside them)
    this.spd += (speed - this.spd) * Math.min(1, dt * 8);
    { const tr = Math.atan2(Math.sin(this.yaw - (this.prevYaw ?? this.yaw)), Math.cos(this.yaw - (this.prevYaw ?? this.yaw))) / Math.max(dt, 1e-3); this.prevYaw = this.yaw; this.turnR = (this.turnR || 0) + (tr - (this.turnR || 0)) * Math.min(1, dt * 8); }
    arenaLookTick(this.model, dt);
    const c = this.cast; animateHumanoid(this.model, dt, { turn: this.turnR, speed: this.spd, action: (c ? (c.melee ? 'swing2' : 'castUp') : this.act) || null, actionT: c ? (c.melee ? 0.42 * Math.min(1, c.t / c.dur) : Math.min(1, c.t / c.dur)) : this.actT, armed: true, hit: this.hitT > 0.16 ? (this.hitT - 0.16) * 4 : 0 });
    if (this.cls === 'bard') luteToChest(this.model, !!this.h.arenaSongs && !this.cast && !this.act && !this.dead, G.time);
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
  laneStep(T) { const me = this.pos, lane = RUINS.lanes[this.lane != null ? this.lane : (this.lane = this.arenaF.i % 3)];
    if (T && Math.hypot(T.pos.x - me.x, T.pos.z - me.z) < 13 && lineClear(me.clone().setY(me.y + 1.5), T.pos.clone().setY(T.pos.y + 1.2))) return null;
    let near = 0, nd = 1e9; lane.forEach((w, i) => { const d = Math.hypot(w[0] - me.x, w[1] - me.z); if (d < nd) { nd = d; near = i; } });
    if (this.wpi == null || Math.hypot(lane[this.wpi][0] - me.x, lane[this.wpi][1] - me.z) > 14) this.wpi = near; // (remember the waypoint it is walking to)
    const goalZ = T ? T.pos.z : (this.team === teamsOf()[0] ? 6 : -6), dir = goalZ > lane[this.wpi][1] ? 1 : -1;
    if (Math.hypot(lane[this.wpi][0] - me.x, lane[this.wpi][1] - me.z) < 2.4) this.wpi = Math.max(0, Math.min(lane.length - 1, this.wpi + dir));
    return lane[this.wpi]; }
  // pick who to fight and what to do: focus the team's target, protect healers, play the objective
  think() {
    const foes = enemiesOf(this).filter(u => (!(u.stealth > 0) || Math.hypot(u.pos.x - this.pos.x, u.pos.z - this.pos.z) < 3) && (!RUINS_MAP() || Math.hypot(u.pos.x - this.pos.x, u.pos.z - this.pos.z) < 4 || lineClear(this.pos.clone().setY(this.pos.y + 1.5), u.pos.clone().setY(u.pos.y + 1.2)) || u === this.target)), me = this.pos;
    const near = (u) => Math.hypot(u.pos.x - me.x, u.pos.z - me.z);
    // the team's focus: the weakest enemy near the team, shared by every bot on the side
    const mates = alliesOf(this, true), cx = mates.reduce((s, u) => s + u.pos.x, 0) / mates.length, cz = mates.reduce((s, u) => s + u.pos.z, 0) / mates.length;
    let best = null, bs = 1e9;
    for (const u of foes) { const dTeam = Math.hypot(u.pos.x - cx, u.pos.z - cz), dMe = near(u), hpk = (u.hp / u.maxHp);
      let s = dMe * 1.0 + dTeam * 0.4 + hpk * 14; if (u.pet || u.bpet) s += 18; if (u === this.lastHitBy && G.time - (this.hurtT || 0) < 3) s -= 6;
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
      const sw = (this.W.kind === 'gun' ? 1.6 : this.W.kind === 'bow' ? 1.0 : this.W.kind === 'staff' ? 0.9 : 0.75) / (this.W.speed || 1) * (this.buffs.focus > 0 ? 0.75 : 1);
      this.swingT = sw * 1.25; const raw = this.base * 0.95 * this.dmgMul();
      if (this.ranged) { this.act = this.W.kind === 'staff' ? 'cast' : 'shoot'; this.actT = 0; this.actSp = 1.4; this.aimLock = this.W.kind === 'gun' ? 0.75 : 0.55; /* plant your feet to aim, then fire */ const miss = dT > 10 && Math.random() < 0.12 + (dT - 10) * 0.012;
        this.pending = { t: 0.4, fn: () => { if (T.dead) return; shot(this, T, this.W.kind === 'staff' ? SHOT_COL[this.W.element] || SHOT_COL.arcane : SHOT_COL.phys, () => { if (miss) { V.number(T.pos.clone().setY(T.pos.y + 2), 'Miss', 'miss'); return; } hitUnit(this, T, raw, { ranged: true }); }); } }; }
      else { this.act = Math.random() < 0.5 ? 'swing1' : 'swing2'; this.actT = 0; this.actSp = 1.5; this.aimLock = 0.3; // wind up, then strike: the blow lands as the weapon comes through
        this.pending = { t: 0.36, fn: () => { if (!T.dead && Math.hypot(T.pos.x - this.pos.x, T.pos.z - this.pos.z) < 3.4) { hitUnit(this, T, raw, { melee: true }); S.hit && S.hit('flesh', T.pos, 0.6); } } }; }
    }
  }
  ready(a) { return (this.cd[a.id] || 0) <= 0; }
  choose(T, dT, hp) {
    const abs = this.abs.filter(a => this.ready(a)); if (!abs.length) return null;
    const use = (a, tgt) => { this.cd[a.id] = Math.max(a.cd || 0, a.t === 'heal' || a.t === 'hot' ? 4 : 1.5) * Game.perkCd(Game.perkLvl(this.h, a.id, 'cd')) * Game.arenaCdAll(this.h) * (0.95 + Math.random() * 0.15); this.gcd = 1.5;
      const melee = ['strike', 'flurry', 'dash', 'cone'].includes(a.t) || (!a.t && !LEG_RANGED.has(a.id) && !!LEG[a.id]), wind = !isSupport(a) && a.t !== 'summon' && !(a.t || '').startsWith('pet') ? (melee ? 0.5 : 0.7) : 0;
      const ct = wind * 0.6; // no cast times in the arena: heals and spells go off at once (attacks keep a short, readable swing)
      if (ct) { this.cast = { a, tgt, t: 0, dur: ct, wind: !!wind && !(a.t === 'heal' || a.t === 'hot'), melee, at: tgt && tgt.pos ? tgt.pos.clone() : null }; return true; } this.resolve(a, tgt); return true; };
    // 1. healing: whoever on the team needs it most
    const heals = abs.filter(a => a.t === 'heal' || a.t === 'hot' || (LEG_SELF[a.id] && LEG_SELF[a.id][0] === 'heal'));
    if (heals.length) { const W = this.ward; if (W && W !== this && W.hp / W.maxHp < 0.6 && SUPPORT_CLS.has(this.cls)) return use(heals.sort((x, y) => (y.self || y.pct || 0) - (x.self || x.pct || 0))[0], W); if (hp < 0.55) return use(heals[0], this); }
    // 2. defences when under pressure
    if (hp < 0.6 && G.time - (this.hurtT || 0) < 2) { const d = abs.find(a => (a.t === 'buff' && ['ward', 'fort', 'stand', 'barrier', 'iceblock', 'phase', 'undying', 'lich'].includes(a.buff) && !a.eq) || (LEG_SELF[a.id] && ['wall', 'stand', 'barrier', 'undying', 'fort'].includes(LEG_SELF[a.id][0])) || a.t === 'stealth'); if (d) return use(d, this); }
    // 3. protect a team mate who is being beaten on
    if (SUPPORT_CLS.has(this.cls)) { const w = alliesOf(this).find(u => u.hp / u.maxHp < 0.5 && G.time - ((u === G.player ? u.lastHitAt : u.hurtT) || 0) < 2); const d = w && abs.find(a => a.t === 'buff' && ['ward', 'barrier', 'fort'].includes(a.buff) && !a.eq); if (d) { this.cd[d.id] = Math.max(d.cd || 10, 10); this.gcd = 1.1; buffUnit(w, d.buff, d.dur || 8); this.act = 'cast'; this.actT = 0; return true; } }
    if (!T) return null;
    // 4. pets out before the fight is joined
    const sm = abs.find(a => a.t === 'summon' && !this.pets.some(p => !p.dead)); if (sm && dT < 30) return use(sm, this);
    // 5. damage buffs when the fight is on
    if (dT < this.range + 6) { const b = abs.find(a => (a.t === 'buff' && ['cry', 'rage', 'focus', 'surge', 'avatar', 'formVoid', 'formTime', 'formArcane', 'swind'].includes(a.buff) && !a.eq) || (LEG_SELF[a.id] && ['cry', 'rage', 'focus', 'rampage', 'surge'].includes(LEG_SELF[a.id][0])) || a.t === 'petbuff'); if (b && Math.random() < 0.6) return use(b, this); }
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
    if (this.dead) return; const pkK = Game.perkPow(Game.perkLvl(this.h, a.id)); const P = (n) => pkK * this.base * (n || 0) * this.up * this.dmgMul(), me = this.pos, el = a.kind === 'fireball' || a.fx === 'fire' ? 'fire' : a.kind === 'frost' || a.fx === 'frost' ? 'frost' : a.fx === 'shadow' ? 'shadow' : a.fx === 'gold' ? 'holy' : a.fx === 'leaf' ? 'nature' : 'arcane';
    const col = SHOT_COL[el], o = { stun: a.stun || 0, slow: a.slow || 0, root: a.root || 0, fear: a.fear || 0, mez: !!a.mez, el, poison: a.poisonDot ? P(a.poisonDot) : 0, spread: a.spread || 0, blight: a.blight || 0 };
    const T = tgt && tgt !== this ? tgt : this.target;
    const anim = (n) => { this.act = n; this.actT = 0; };
    if (AN.on && AN.host && a.t && !['bolt', 'drain', 'curse'].includes(a.t)) { const at = lockAt || (T && T.pos) || me; nsend({ t: 'bfx', i: this.arenaF.i, k: a.t, c: col, el, x: r2(at.x), z: r2(at.z), r: a.r || 5 }); } // (the others see the effect too)
    const drainBack = (dealt, f) => { if (f && dealt) this.healSelf(dealt * f * 6); }; // (hits are scaled for PvP, so the drain is scaled back up)
    if (!a.t) return this.legacy(a, T, P);
    if (a.regen) { this.hots.push({ ps: a.regen[0] * this.maxHp / a.regen[1], t: a.regen[1] }); V.burst('heal', me.clone().setY(me.y + 1.2), 14, { speed: 2, vy: 2 }); }
    switch (a.t) {
      case 'strike': case 'flurry': { if (!T) return; const n = P(a.dmg) * (a.t === 'flurry' ? (a.hits || 3) : 1); if (!T.dead && Math.hypot(T.pos.x - this.pos.x, T.pos.z - this.pos.z) < 4.2) { drainBack(hitUnit(this, T, n, o), a.drain); V.burst(el === 'arcane' ? 'spark' : el, T.pos.clone().setY(T.pos.y + 1.1), 14, { speed: 4 }); } return; }
      case 'dash': { if (!T) return; const d = V3(T.pos.x - me.x, 0, T.pos.z - me.z), L = d.length(); this.dashing = { dir: d.normalize(), left: Math.max(0, L - 1.4), t: 0, onEnd: () => { anim('swing1'); hitUnit(this, T, P(a.dmg), o); } }; V.burst('dust', me.clone().setY(me.y + 0.3), 14, { speed: 3 }); return; }
      case 'cone': { anim('swing2'); for (const u of enemiesOf(this)) { const dx = u.pos.x - me.x, dz = u.pos.z - me.z, d = Math.hypot(dx, dz); if (d < 6.5 && Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - this.yaw), Math.cos(Math.atan2(dx, dz) - this.yaw))) < 0.9) hitUnit(this, u, P(a.dmg), o); } V.burst(el === 'arcane' ? 'spark' : el, me.clone().setY(me.y + 1).addScaledVector(V3(Math.sin(this.yaw), 0, Math.cos(this.yaw)), 3), 30, { speed: 6 }); return; }
      case 'nova': { anim('slam'); const r = (a.r || 5) + 0.4; let dealt = 0; if (!a.calm) for (const u of enemiesOf(this)) if (Math.hypot(u.pos.x - me.x, u.pos.z - me.z) < r) dealt += hitUnit(this, u, P(a.dmg), o); V.ring(me, r, col, 0.6); V.burst(el === 'arcane' ? 'spark' : el, me.clone().setY(me.y + 1), 30, { speed: 6 }); drainBack(dealt, a.drainAll); return; }
      case 'bolt': case 'drain': { if (!T) return; anim('cast'); const n = a.n ? Math.min(3, a.n) : 1; for (let k = 0; k < n; k++) setTimeout(() => shot(this, T, col, () => { let dealt = 0; if (a.aoe) { for (const u of enemiesOf(this)) if (Math.hypot(u.pos.x - T.pos.x, u.pos.z - T.pos.z) < a.aoe) dealt += hitUnit(this, u, P(a.dmg) * 0.8, o); V.burst(el === 'arcane' ? 'spark' : el, T.pos.clone().setY(T.pos.y + 1), 25, { speed: 5 }); } else dealt = hitUnit(this, T, P(a.dmg) * (n > 1 ? 0.7 : 1), o); drainBack(dealt, a.drain); }, true), k * 140); return; }
      case 'curse': { if (!T) return; anim('cast'); shot(this, T, col, () => { const dealt = hitUnit(this, T, P(a.dmg), o); if (a.dot) { if (T === G.player) G.player.debuff('poison', a.dotT || 6, P(a.dot) * PVP_K); else if (T.dots) T.dots.push({ dps: P(a.dot) * PVP_K, t: a.dotT || 6, src: this }); } drainBack(dealt, a.drain); }); return; }
      case 'ground': case 'trap': { const at = a.t === 'trap' ? me : (lockAt || (T ? T.pos : me)); anim('cast'); const ticks = a.ticks || (a.t === 'trap' ? 1 : 4); let first = true; zone(this, at, a.t === 'trap' ? 3 : 4.5, ticks + 0.2, 1, (u) => { hitUnit(this, u, P(a.dmg), first ? o : { slow: a.slow || 0, el }); }, col); setTimeout(() => { first = false; }, 1100); return; }
      case 'aura': case 'stormwalk': case 'blizzaura': { anim('castBig'); zone(this, me, a.t === 'aura' ? 6 : 7, a.dur || 8, 0.5, (u) => { const d = hitUnit(this, u, P(a.dmg) * (a.t === 'aura' ? 1 : 0.6), { slow: a.slow || 0, stun: Math.random() < 0.15 ? (a.stun || 0) : 0, el }); drainBack(d, a.drain); }, col, true); return; }
      case 'heal': case 'hot': { const who = tgt || this, amt = (a.self || a.pct || 0.25) * who.maxHp * pkK; anim('castUp'); if (a.t === 'heal') healUnit(who, amt, this); else if (who === this) this.hots.push({ ps: amt / (a.dur || 8), t: a.dur || 8 }); else if (who === G.player) G.player.addRegen ? G.player.addRegen(a.pct || 0.25, a.dur || 8) : healUnit(who, amt, this); else who.hots.push({ ps: amt / (a.dur || 8), t: a.dur || 8 });
        if (a.ally || SUPPORT_CLS.has(this.cls)) for (const u of alliesOf(this)) if (u !== who && Math.hypot(u.pos.x - me.x, u.pos.z - me.z) < (a.r || 10)) { healUnit(u, (a.ally || 0.15) * u.maxHp, this); if (a.notes) playNotes(G.scene, u, '#ffd860', 5); }
        if (a.notes) { playNotes(G.scene, this, '#ffd860', 8); S.cast && S.cast('holy', me, 0.6); } else V.burst('heal', me.clone().setY(me.y + 1.2), 20, { speed: 2, vy: 2 }); return; }
      case 'buff': { anim('cast'); const k = a.buff; if (k === 'avatar') { this.av = a.av || { dmg: 1.3, taken: 0.8 }; this.addBuff('avatar', a.dur || 12); } else if (k && k.startsWith('form')) this.addBuff('form', a.dur || 20); else if (k === 'barrier') { this.addBuff('barrier', a.dur || 12); this.barrier = this.maxHp * (a.amount || 0.25); } else if (k) this.addBuff(k, a.dur || 8);
        if (SUPPORT_CLS.has(this.cls) && ['ward', 'cry', 'fort', 'stand'].includes(k)) for (const u of alliesOf(this)) if (Math.hypot(u.pos.x - me.x, u.pos.z - me.z) < 12) buffUnit(u, k, (a.dur || 8) * 0.8);
        V.sphereFlash(me.clone().setY(me.y + 1), 1.4, k === 'ward' || k === 'barrier' || k === 'fort' ? '#80d8ff' : '#ffd060', 0.45); return; }
      case 'stealth': if (a.step) { const tg = T && Math.hypot(T.pos.x - me.x, T.pos.z - me.z) < 12 ? T : null; V.burst('shadow', me.clone().setY(me.y + 1), 30, { speed: 3 }); if (tg) { const by = tg.yaw || 0; me.set(tg.pos.x - Math.sin(by) * 1.4, me.y, tg.pos.z - Math.cos(by) * 1.4); this.yaw = by; } else me.addScaledVector(V3(Math.sin(this.yaw), 0, Math.cos(this.yaw)), a.step); }
        this.stealth = a.dur || 4; V.burst('smoke', me.clone().setY(me.y + 1), 30, { speed: 3 }); this.target = null; return;
      case 'demon': if (T && !T.dead) summonDemon(this, T.pos.clone()); return;
      case 'wrath': if (T && !T.dead) paladinWrath(this, T.pos.clone()); return;
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
    const L = LEG[a.id]; if (!L || !T) return; const [m, n, stun, slow] = L, o = { stun: stun || 0, slow: slow || 0 };
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
const ACT_NET = { smash: 'heavy', stabR: 'thrust1', stabL: 'thrust1', off1: 'swing1', spell: 'cast', sweep: 'swing1', spin: 'area', fury: 'area', release: 'shoot' };
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
    case 'hit': if (d.to === AN.myId) { const p = G.player; if (!p || p.dead) break; const src = U(d.from), [dd, o2] = pvpIncoming(p, d.d, d.o || {}), hp0 = p.hp;
      if (dd > 0) p.takeDamage(dd, src, o2);
      if (dd > 0 && p.abCast && p.abCast.spell && Math.random() < 0.35) { p.abCast = null; G.hooks.castBar && G.hooks.castBar(null); G.hooks.toast && G.hooks.toast('Your spell was interrupted', '✋', 'bad'); }
      if (!p.dead && p.debuff) { if (o2.stun || o2.freeze) p.debuff('stun', Math.max(o2.stun || 0, o2.freeze || 0)); if (o2.slow || o2.root) p.debuff('slow', Math.max(o2.slow || 0, (o2.root || 0) * 1.3)); }
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
