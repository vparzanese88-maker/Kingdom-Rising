// Kingdom Arena: duels and team fights in the colosseum. Everyone is level 20 and fully geared, with 20 skill points
// to spend during a 60 second countdown. Objectives: Elimination, Rounds, Deathmatch, Capture the Flag, King of the Hill.
// Computer fighters use their class's real abilities from their skill trees: they move, kite, focus targets together,
// heal and buff each other, peel for their healers and play the objective.
import * as THREE from 'three';
import { G } from './state.js';
import * as Game from './game.js';
import { CLASSES, ABILITIES, CLASS_TREES, ARMOR_SLOT_LIST, TIERS, RACES, isSupport, WEAPON_TYPES, LEVEL_CAP } from './data.js';
import { petDef } from './classes2.js';
import { buildHumanoid, equipWeapon, animateHumanoid } from './character.js';
import { Mob } from './mobs.js';
import { V } from './vfx.js';
import { S } from './audio.js';
import { PVP_K, pvpIncoming } from './mp.js';
import { heightAt } from './terrain.js';
import { AR, COLORS, COLOR_NAMES, updateColosseum, cheer } from './arenamap.js';
import { ARENA_KEY } from './battlemap.js';
import { loadBuild, saveBuild } from './builds.js';
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
const RESPAWN_T = 6, PICK_T = 60;
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
  h.level = LEVEL_CAP; h.introDone = true; h.gold = 0; h.arena = true; h.ctree = {};
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
export function initArena(hooks) {
  A.hooks = hooks; A.setup = readArena(); const s = A.setup; G.fovTrim = 10;
  const objective = OBJECTIVES[s.objective] ? s.objective : 'elim';
  if (objective === 'ctf' && isFFA()) s.objective = 'dm';
  A.lives = OBJECTIVES[s.objective].lives === 'one' ? 'one' : (s.lives || OBJECTIVES[s.objective].lives);
  A.target = s.objective === 'dm' ? (isFFA() ? 10 : 15 + 5 * Math.min(2, (FORMATS[s.fmt].size || 1) - 1)) : s.objective === 'ctf' ? 3 : s.objective === 'koth' ? 100 : s.objective === 'rounds' ? 2 : 1;
  const used = new Set();
  s.slots.forEach((sl, i) => { let nm = sl.name; if (!nm) { do nm = BOT_NAMES[(Math.random() * BOT_NAMES.length) | 0]; while (used.has(nm)); } used.add(nm); A.F.push({ i, name: sl.you ? (sl.name || 'You') : nm, cls: sl.cls, race: sl.race, team: sl.team, you: !!sl.you, kills: 0, deaths: 0, dmg: 0, heal: 0, alive: true, respawnT: 0 }); });
  for (const t of teamsOf()) { A.score[t] = 0; A.roundWins[t] = 0; }
  G.myTeam = A.F[0].team;
  // the computer fighters
  for (const f of A.F) if (!f.you) { const h = arenaHero(f, f.name); botSpend(h, A.F.filter(o => o.team === f.team).length > 1); f.bot = new ArenaBot(f, h); }
  // banners above the gates in the teams' colours; CTF flags; the hill
  AR.gates.forEach((g, k) => { const t = teamsOf()[k]; if (g.banner && t != null && !isFFA()) g.banner.material.color.set(teamCol(t)); });
  if (s.objective === 'ctf') for (const t of teamsOf()) A.flags.push(makeFlag(t));
  if (s.objective === 'koth') AR.hill.material.opacity = 0.75;
  const P = G.player; if (P) { P.arenaF = A.F[0]; }
  placeAll(); startPick(PICK_T);
}
export function playerHero() { const s = readArena(), sl = s.slots[0], h = arenaHero(sl, sl.name || 'You'); A.loaded = loadBuild(BUILDS, h, LEVEL_CAP); return h; }
function spawnOf(f) {
  const R = AR.R;
  if (isFFA()) { const n = A.F.length, a = f.i / n * Math.PI * 2; return { x: Math.sin(a) * (R - 5), z: Math.cos(a) * (R - 5), yaw: Math.atan2(-Math.sin(a), -Math.cos(a)) }; }
  const k = teamsOf().indexOf(f.team), g = AR.gates[k % 4], mates = A.F.filter(o => o.team === f.team), j = mates.indexOf(f), side = (j - (mates.length - 1) / 2) * 2.2;
  const a = g.a, px = Math.cos(a), pz = -Math.sin(a); return { x: g.x + px * side - Math.sin(a) * 1.5, z: g.z + pz * side - Math.cos(a) * 1.5, yaw: Math.atan2(-g.x, -g.z) };
}
function placeAll() { for (const f of A.F) revive(f, true); }
function revive(f, place) {
  const sp = spawnOf(f); f.alive = true; f.respawnT = 0;
  if (f.you) { const p = G.player; if (!p) return; p.spectate = false; p.dead = false; p.hp = p.maxHp; p.mana = p.maxMana; p.end = p.maxEnd; p.db = {}; if (place) p.place(sp.x, sp.z, sp.yaw); A.hooks.revived && A.hooks.revived(); }
  else f.bot.revive(sp);
}
function startPick(t) { A.state = 'pick'; A.t = t; AR.gatesOpen = false; if (t >= 30 && !A.loaded) { /* (a saved build is already on your bar: no need to open the trees) */ A.hooks.openBook && setTimeout(() => A.hooks.openBook(), 600); } renderHud(true); }
export function readyUp() { if (A.state === 'pick') A.t = Math.min(A.t, 3.5); }
function autoSpend() { const h = G.save; if (!h || Game.classPoints(h) <= 0) return; const left = Game.classPoints(h); botSpend(h, A.F.filter(o => o.team === A.F[0].team).length > 1); Game.autoFillHotbar(h); G.player.refreshStatsOnly && G.player.refreshStatsOnly(); A.hooks.rebuildBar && A.hooks.rebuildBar(); A.hooks.toast && A.hooks.toast(`${left} unspent skill point${left > 1 ? 's were' : ' was'} spent for you`, '✦', 'gold'); }
function startFight() { if (A.round === 1) autoSpend(); A.state = 'fight'; A.clock = 0; AR.gatesOpen = true; cheer(1.6); S.battleCry && S.battleCry(); A.hooks.closeBook && A.hooks.closeBook(); A.hooks.banner && A.hooks.banner(A.setup.objective === 'rounds' ? `Round ${A.round}` : OBJECTIVES[A.setup.objective].name, 'Fight!'); for (const f of A.F) if (f.bot) f.bot.prebuff(); }

// ---------------- every frame ----------------
export function updateArena(dt) {
  if ((A.saveT = (A.saveT || 0) - dt) <= 0) { A.saveT = 1.5; saveBuild(BUILDS, G.save); } // your build is kept for next time
  G.tod = 0.4; { const tr = document.getElementById('tracker'); if (tr && !tr.hidden) tr.hidden = true; } G.zoneLabel = 'Kingdom Arena<small>' + OBJECTIVES[A.setup.objective].name + '</small>';
  updateColosseum(dt);
  const p = G.player;
  if (A.state === 'pick') { A.t -= dt; if (p && !p.dead) { const sp = spawnOf(A.F[0]); if (Math.hypot(p.pos.x - sp.x, p.pos.z - sp.z) > 4) p.place(sp.x, sp.z, p.yaw); } if (A.t <= 0) startFight(); }
  else if (A.state === 'fight') { A.clock += dt; objectives(dt); respawns(dt); }
  else if (A.state === 'roundEnd') { A.t -= dt; if (A.t <= 0) { A.round++; for (const f of A.F) { f.alive = true; } placeAll(); startPick(6); } }
  // dead: fly around and watch (WASD, Space up, C down, Shift faster)
  if (p && p.dead && A.state !== 'over') { if (!p.spectate && (p.deadT || 0) > 1.4) { p.spectate = true; p.pos.y += 2.5; }
    if (p.spectate) { const k = G.keys, sp = (k.ShiftLeft || k.ShiftRight ? 26 : 12) * dt;
      const F = p.fwd(), Rt = p.right(); let mx = 0, mz = 0; if (k.KeyW) { mx += F.x; mz += F.z; } if (k.KeyS) { mx -= F.x; mz -= F.z; } if (k.KeyA) { mx -= Rt.x; mz -= Rt.z; } if (k.KeyD) { mx += Rt.x; mz += Rt.z; }
      const L = Math.hypot(mx, mz); if (L > 0) { p.pos.x += mx / L * sp; p.pos.z += mz / L * sp; }
      if (k.Space) p.pos.y += sp; if (k.KeyC || k.ControlLeft) p.pos.y -= sp; p.pos.y = Math.max(AR.Y + 1.2, Math.min(AR.Y + 45, p.pos.y));
      const d = Math.hypot(p.pos.x, p.pos.z), lim = AR.R + 45; if (d > lim) { p.pos.x *= lim / d; p.pos.z *= lim / d; } } }
  // keep the player inside the sand
  if (p && !p.dead) { p.spectate = false; const d = Math.hypot(p.pos.x, p.pos.z); if (d > AR.R - 0.9) { p.pos.x *= (AR.R - 0.9) / d; p.pos.z *= (AR.R - 0.9) / d; } }
  updateShots(dt); updateZones(dt); for (const fl of A.flags) updateFlag(fl, dt);
  renderHud();
}
function respawns(dt) {
  if (A.lives === 'one') return;
  for (const f of A.F) if (!f.alive) { f.respawnT -= dt; if (f.respawnT <= 0) revive(f, true); }
}
export function fighterDied(f, killer) {
  if (!f.alive || A.state !== 'fight') return; f.alive = false; f.deaths++; f.respawnT = RESPAWN_T;
  const k = killer && killer.arenaF ? killer.arenaF : killer && killer.owner && killer.owner.arenaF ? killer.owner.arenaF : null;
  if (k && k !== f) { k.kills++; if (A.setup.objective === 'dm') A.score[k.team] = (A.score[k.team] || 0) + (k.team === f.team ? 0 : 1); }
  feed(k ? `<b style="color:${teamCol(k.team)}">${k.name}</b> ⚔ <b style="color:${teamCol(f.team)}">${f.name}</b>` : `<b style="color:${teamCol(f.team)}">${f.name}</b> fell`);
  cheer(0.9); for (const fl of A.flags) if (fl.carrier === f) dropFlag(fl);
  if (f.you) A.hooks.playerDown && A.hooks.playerDown(A.lives === 'one' ? 0 : RESPAWN_T);
  checkWin();
}
export function playerDied() { const p = G.player; fighterDied(A.F[0], p && p.lastHitBy && G.time - (p.lastHitAt || 0) < 8 ? p.lastHitBy : null); }
function aliveTeams() { return teamsOf().filter(t => A.F.some(f => f.team === t && f.alive)); }
function checkWin() {
  if (A.state !== 'fight') return;
  const o = A.setup.objective;
  if (A.lives === 'one') { const at = aliveTeams(); if (at.length <= 1) { const w = at[0]; if (o === 'rounds' && w != null) { A.roundWins[w]++; if (A.roundWins[w] < A.target) { A.state = 'roundEnd'; A.t = 4; A.hooks.banner && A.hooks.banner(`${teamName(w)} wins round ${A.round}`, `${Object.entries(A.roundWins).map(([t, n]) => `${teamName(+t)} ${n}`).join(' · ')}`); cheer(1.5); return; } } return finish(w); } }
  if (o === 'dm' || o === 'ctf' || o === 'koth') for (const t of teamsOf()) if ((A.score[t] || 0) >= A.target) return finish(t);
}
function finish(w) { A.state = 'over'; A.winner = w; AR.gatesOpen = false; cheer(2); A.hooks.over && A.hooks.over(w); renderEnd(); }

// ---------------- objectives ----------------
function objectives(dt) {
  const o = A.setup.objective;
  if (o === 'koth') { const on = new Set(); for (const f of A.F) if (f.alive) { const q = posOf(f); if (Math.hypot(q.x, q.z) < 7) on.add(f.team); }
    A.hillOwner = on.size === 1 ? [...on][0] : on.size > 1 ? 'contested' : null;
    if (A.hillOwner != null && A.hillOwner !== 'contested') { A.hillAcc = (A.hillAcc || 0) + dt; if (A.hillAcc >= 1) { A.hillAcc -= 1; A.score[A.hillOwner] = (A.score[A.hillOwner] || 0) + 1; } }
    AR.hill.material.color.set(A.hillOwner == null ? '#ffffff' : A.hillOwner === 'contested' ? '#ff8a30' : teamCol(A.hillOwner)); AR.hill.material.opacity = 0.55 + Math.sin(G.time * 4) * 0.2; checkWin(); }
}
// capture the flag: a banner on a pole at each team's gate
function makeFlag(t) {
  const k = teamsOf().indexOf(t), g = AR.gates[k % 4], home = V3(g.x * 0.86, AR.Y, g.z * 0.86);
  const grp = new THREE.Group(); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 6), new THREE.MeshStandardMaterial({ color: '#d8b04a', metalness: 0.8, roughness: 0.4 })); pole.position.y = 1.6; grp.add(pole);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.85), new THREE.MeshStandardMaterial({ color: teamCol(t), side: THREE.DoubleSide, emissive: teamCol(t), emissiveIntensity: 0.25 })); cloth.position.set(0.67, 2.7, 0); grp.add(cloth);
  const base = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.8, 40), new THREE.MeshBasicMaterial({ color: teamCol(t), transparent: true, opacity: 0.6, side: THREE.DoubleSide })); base.rotation.x = -Math.PI / 2; base.position.copy(home).setY(AR.Y + 0.07); G.scene.add(base);
  grp.position.copy(home); G.scene.add(grp);
  return { team: t, home, pos: home.clone(), grp, cloth, carrier: null, dropT: 0, atHome: true };
}
function dropFlag(fl) { const q = posOf(fl.carrier); fl.carrier = null; fl.pos.set(q.x, AR.Y, q.z); fl.dropT = 15; fl.atHome = false; feed(`The <b style="color:${teamCol(fl.team)}">${COLOR_NAMES[fl.team]}</b> banner was dropped`); }
function updateFlag(fl, dt) {
  if (A.state !== 'fight') { fl.grp.position.copy(fl.pos); return; }
  if (fl.carrier) { const q = posOf(fl.carrier); fl.pos.set(q.x, AR.Y + 1.2, q.z);
    const mine = A.flags.find(x => x.team === fl.carrier.team);
    if (mine && mine.atHome && Math.hypot(q.x - mine.home.x, q.z - mine.home.z) < 2.4) { A.score[fl.carrier.team]++; feed(`<b style="color:${teamCol(fl.carrier.team)}">${fl.carrier.name}</b> captured the <b style="color:${teamCol(fl.team)}">${COLOR_NAMES[fl.team]}</b> banner!`); cheer(2); A.hooks.banner && A.hooks.banner('Banner captured!', `${teamName(fl.carrier.team)}: ${A.score[fl.carrier.team]} of ${A.target}`); fl.carrier = null; fl.pos.copy(fl.home); fl.atHome = true; checkWin(); } }
  else { if (!fl.atHome) { fl.dropT -= dt; if (fl.dropT <= 0) { fl.pos.copy(fl.home); fl.atHome = true; } }
    for (const f of A.F) { if (!f.alive) continue; const q = posOf(f); if (Math.hypot(q.x - fl.pos.x, q.z - fl.pos.z) > 1.6) continue;
      if (f.team === fl.team) { if (!fl.atHome) { fl.pos.copy(fl.home); fl.atHome = true; feed(`<b style="color:${teamCol(f.team)}">${f.name}</b> returned their banner`); } }
      else if (!A.flags.some(x => x.carrier === f)) { fl.carrier = f; fl.atHome = false; feed(`<b style="color:${teamCol(f.team)}">${f.name}</b> took the <b style="color:${teamCol(fl.team)}">${COLOR_NAMES[fl.team]}</b> banner`); cheer(0.8); break; } } }
  fl.grp.position.copy(fl.pos); fl.cloth.rotation.y = Math.sin(G.time * 3 + fl.team) * 0.3;
}

// ---------------- helpers shared by bots and the player ----------------
const posOf = (f) => f.you ? G.player.pos : f.bot.pos;
const hpOf = (f) => f.you ? G.player.hp / G.player.maxHp : f.bot.hp / f.bot.maxHp;
const unitOf = (f) => f.you ? G.player : f.bot;
function feed(html) { A.feed.unshift({ html, t: G.time }); A.feed.length = Math.min(A.feed.length, 6); }
// every hit from a computer fighter on the player goes through the same PvP rules as an online player's hit
function hitPlayer(src, raw, o) {
  const p = G.player; if (!p || p.dead) return 0; const [d, o2] = pvpIncoming(p, raw * PVP_K * PACE, o || {}); const hp0 = p.hp; p.takeDamage(d, src, o2);
  if (p.abCast && p.abCast.spell && Math.random() < 0.35) { p.abCast = null; G.hooks.castBar && G.hooks.castBar(null); G.hooks.toast && G.hooks.toast('Your spell was interrupted', '✋', 'bad'); }
  if (!p.dead && p.debuff) { if (o2.stun || o2.freeze) p.debuff('stun', Math.max(o2.stun || 0, o2.freeze || 0)); if (o2.slow || o2.root) p.debuff('slow', Math.max(o2.slow || 0, (o2.root || 0) * 1.3)); }
  const dealt = Math.max(0, hp0 - p.hp); if (src && src.arenaF) src.arenaF.dmg += dealt; return dealt;
}
function hitUnit(src, tgt, raw, o) { if (!tgt || tgt.dead) return 0; if (tgt === G.player) return hitPlayer(src, raw, o); return tgt.takeHit ? (tgt.takeHit(raw, src, o) || 0) : 0; }
// heals and buffs on a team mate (computer or player)
function healUnit(u, amt, from) { if (!u || u.dead || amt <= 0) return; if (u === G.player) { u.heal(amt, true); } else u.healSelf(amt); if (from && from.arenaF) from.arenaF.heal += amt; V.burst('heal', u.pos.clone().setY(u.pos.y + 1.2), 12, { speed: 2, vy: 2 }); }
function buffUnit(u, kind, dur) { if (!u || u.dead) return; if (u === G.player) { u.buffs[kind] = Math.max(u.buffs[kind] || 0, dur); if (kind === 'barrier') { u.buffs.barrier = u.maxHp * 0.2; u.buffs.barrierT = dur; } } else u.addBuff(kind, dur); V.sphereFlash(u.pos.clone().setY(u.pos.y + 1), 1.2, kind === 'ward' || kind === 'barrier' ? '#80d8ff' : '#ffd84a', 0.4); }
// the player's own heals and buffs that reach allies (healing spells with an area, songs, totems...)
export function allyFx(at, [r, heal, kind, dur], up) {
  const R = r * Math.sqrt(up); V.ring(at, R, heal ? '#80ff90' : '#80d8ff', 0.7);
  for (const f of A.F) if (!f.you && f.alive && f.team === G.myTeam && Math.hypot(f.bot.pos.x - at.x, f.bot.pos.z - at.z) < R) { if (heal) healUnit(f.bot, f.bot.maxHp * heal * up, G.player); if (kind) buffUnit(f.bot, kind === 'haste' ? 'swind' : kind, (dur || 8) * up); }
}

// ---------------- projectiles and lingering areas (bots) ----------------
const SHOT_COL = { fire: '#ff7a20', frost: '#80d8ff', arcane: '#c080ff', shadow: '#9a60c0', holy: '#ffe080', nature: '#80e060', phys: '#e8d8b0' };
function shot(src, tgt, col, onHit, big) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(big ? 0.22 : 0.12, 8, 6), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  const from = src.pos.clone().setY(src.pos.y + 1.35); m.position.copy(from); G.scene.add(m); A.shots.push({ m, tgt, onHit, col, t: 0 });
}
function updateShots(dt) {
  for (let i = A.shots.length - 1; i >= 0; i--) { const s = A.shots[i]; s.t += dt; const tp = s.tgt.pos.clone().setY(s.tgt.pos.y + 1.1), d = tp.clone().sub(s.m.position), L = d.length();
    if (L < 0.6 || s.t > 2.5 || s.tgt.dead) { G.scene.remove(s.m); A.shots.splice(i, 1); if (!s.tgt.dead && L < 3) { s.onHit(); V.burst('spark', tp, 8, { speed: 3 }); } continue; }
    s.m.position.addScaledVector(d.normalize(), Math.min(L, 34 * dt)); if (Math.random() < 0.5) V.emit('spark', s.m.position.clone(), { n: 1, speed: 0.4 }); }
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
    const ch = buildHumanoid({ race: h.race, sex: h.sex, cls: h.cls, outfit: h.cls, app: h.app, ...(h.app || {}) }); this.model = ch; this.root = ch.root; this.height = ch.height || 1.8;
    try { equipWeapon(ch, CLASSES[h.cls].weapons.includes('swordshield') && h.equip.w2 ? 'swordshield' : wt, TIERS.length - 1, 3); } catch (e) { /* unknown weapon model */ }
    this.ranged = ['bow', 'gun', 'staff'].includes(this.W.kind); this.range = this.ranged ? (this.W.kind === 'gun' ? 16 : 15) : 2.6;
    this.abs = ABILITIES[h.cls].filter(a => Game.abilityKnown(h, a)); this.loadout(); this.cd = {}; for (const a of this.abs) this.cd[a.id] = Math.random() * 3;
    this.healer = this.abs.some(a => a.t === 'heal' && (a.ally || SUPPORT_CLS.has(h.cls)));
    this.buffs = {}; this.hots = []; this.dots = []; this.gcd = 0; this.swingT = 0; this.thinkT = 0; this.strafe = Math.random() < 0.5 ? 1 : -1; this.act = ''; this.actT = 0; this.spd = 0; this.pets = [];
    this.role = Math.random() < 0.5 ? 'attack' : 'defend'; this.recalc(); this.hp = this.maxHp;
    G.scene.add(this.root); G.mobs.push(this);
    // a ring under each fighter in its team colour
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 28), new THREE.MeshBasicMaterial({ color: teamCol(f.team), transparent: true, opacity: 0.8, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; this.root.add(ring);
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
  recalc() { const D = Game.heroDerived(this.h); this.D = D; this.maxHp = D.maxHp; this.base = Game.weaponDamage(this.h, this.h.equip.w1 || Game.makeWeapon('sword', 5, 3)); this.up = G.abilScale ? G.abilScale(LEVEL_CAP) : 1.675; }
  dist2(p) { const dx = p.x - this.pos.x, dz = p.z - this.pos.z; return dx * dx + dz * dz; }
  revive(sp) { this.dead = false; this.root.visible = true; this.root.rotation.set(0, sp.yaw, 0); this.hp = this.maxHp; this.pos.set(sp.x, AR.Y, sp.z); this.yaw = sp.yaw; for (const k in this.status) if (typeof this.status[k] === 'number') this.status[k] = 0; this.buffs = {}; this.hots = []; this.dots = []; this.cast = null; this.stealth = 0; this.carry = null; }
  prebuff() { // EverQuest-style stat buffs go up before the gates open, on itself and (support classes) its team
    for (const a of this.abs) if (a.eq) { const v = {}; for (const [k, [b, per]] of Object.entries(a.eq)) v[k] = Math.round(b + per * LEVEL_CAP); this.h.sb = this.h.sb || {}; this.h.sb[a.id] = Object.assign({ t: 999, name: a.name }, v);
      if (SUPPORT_CLS.has(this.cls)) for (const u of alliesOf(this)) { if (u === G.player) { const ph = G.save; ph.sb = ph.sb || {}; ph.sb[a.id + '_' + this.id] = Object.assign({ t: 999, name: a.name + ' (' + this.heroName + ')', text: '' }, v); u.refreshStatsOnly && u.refreshStatsOnly(); } else if (u.h) { u.h.sb = u.h.sb || {}; u.h.sb[a.id + '_' + this.id] = Object.assign({ t: 999 }, v); u.recalc(); } } }
    const k = this.hp / this.maxHp; this.recalc(); this.hp = this.maxHp * k;
  }
  healSelf(n) { if (this.dead) return; this.hp = Math.min(this.maxHp, this.hp + n); }
  heal(n) { this.healSelf(n); }
  addBuff(kind, dur) { this.buffs[kind] = Math.max(this.buffs[kind] || 0, dur); if (kind === 'barrier') this.barrier = this.maxHp * 0.22; }
  dmgMul() { let k = 1; const b = this.buffs; if (b.cry > 0) k *= 1.3; if (b.rage > 0) k *= 1.15; if (b.surge > 0) k *= 1.2; if (b.lich > 0) k *= 1.4; if (b.form > 0) k *= 1.35; if (b.avatar > 0 && this.av && this.av.dmg) k *= this.av.dmg; return k; }
  // ---- being hit (by the player, a team mate's enemy, a pet...) ----
  takeHit(dmg, src, o = {}) {
    if (this.dead || A.state !== 'fight') return 0; const b = this.buffs;
    if (b.iceblock > 0 || b.phase > 0) { V.number(this.pos.clone().setY(this.pos.y + this.height + 0.3), 'Immune', 'miss'); return 0; }
    if (src && src.team === this.team) return 0;
    dmg *= PVP_K * PACE; if (src && src.hexUntil > G.time) dmg *= 0.65;
    const red = this.D.armor / (this.D.armor + 40 + LEVEL_CAP * 12); dmg *= 1 - red;
    if (b.ward > 0) dmg *= 0.6; if (b.wall > 0) dmg *= 0.4; if (b.fort > 0) dmg *= 0.7; if (b.stand > 0) dmg *= 0.75; if (b.lich > 0) dmg *= 0.75; if (b.avatar > 0 && this.av && this.av.taken) dmg *= this.av.taken;
    if (this.barrier > 0 && b.barrier > 0) { const ab = Math.min(this.barrier, dmg); this.barrier -= ab; dmg -= ab; }
    dmg = Math.max(1, Math.round(dmg)); this.hp -= dmg; this.hurtT = G.time; this.lastHitBy = src; if (b.undying > 0 && this.hp < 1) this.hp = 1;
    if (src && src.arenaF) src.arenaF.dmg += dmg; else if (src === G.player) A.F[0].dmg += dmg;
    // control effects fall off when chained, like they do on players
    if (o.stun || o.freeze || o.slow || o.root) { const now = G.time; if (!this.ccT || now - this.ccT > 10) this.ccN = 0; const f = Math.pow(0.5, this.ccN || 0); this.ccN = (this.ccN || 0) + 1; this.ccT = now;
      if (o.stun || o.freeze) { this.status.stun = Math.max(this.status.stun, (o.stun || o.freeze) * f); this.cast = null; } if (o.slow) this.status.slow = Math.max(this.status.slow, o.slow * f); if (o.root) this.status.root = Math.max(this.status.root, o.root * f); }
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
    if (this.dead) { this.deadT += dt; if (this.deadT < 1) this.root.rotation.x = -Math.min(1, this.deadT / 0.6) * Math.PI / 2; else this.root.visible = false; return; }
    this.root.rotation.x = 0;
    for (const k in this.buffs) this.buffs[k] = Math.max(0, this.buffs[k] - dt);
    for (const k of ['stun', 'slow', 'root', 'frozen']) st[k] = Math.max(0, (st[k] || 0) - dt);
    if (this.stealth > 0) { this.stealth = Math.max(0, this.stealth - dt); }
    for (let i = this.hots.length - 1; i >= 0; i--) { const h = this.hots[i]; h.t -= dt; this.healSelf(h.ps * dt); if (h.t <= 0) this.hots.splice(i, 1); }
    for (let i = this.dots.length - 1; i >= 0; i--) { const d = this.dots[i]; d.t -= dt; this.hp -= d.dps * dt; if (d.t <= 0) this.dots.splice(i, 1); if (this.hp <= 0) { this.die(d.src); return; } }
    for (const k in this.cd) this.cd[k] -= dt; this.gcd -= dt; this.swingT -= dt;
    if (this.act) { this.actT += dt * 2.4; if (this.actT >= 1) { this.act = ''; this.actT = 0; } }
    let speed = 0;
    if (A.state === 'fight' && !(st.stun > 0) && !(st.frozen > 0)) {
      if ((this.thinkT -= dt) <= 0) { this.thinkT = 0.25 + Math.random() * 0.1; this.think(); }
      if (this.cast) { this.cast.t += dt; if (this.cast.t >= this.cast.dur) { const c = this.cast; this.cast = null; this.resolve(c.a, c.tgt); } }
      else { speed = this.move(dt); this.fight(); }
    }
    // knockback
    if (st.knock && st.knock.lengthSq() > 0.01) { this.pos.addScaledVector(st.knock, dt * 6); st.knock.multiplyScalar(Math.max(0, 1 - dt * 6)); }
    const d = Math.hypot(this.pos.x, this.pos.z); if (d > AR.R - 1) { this.pos.x *= (AR.R - 1) / d; this.pos.z *= (AR.R - 1) / d; }
    this.pos.y = AR.Y; this.root.position.copy(this.pos); this.root.rotation.y = this.yaw;
    const vis = !(this.stealth > 0 && this.team !== G.myTeam); this.root.visible = vis || Math.hypot(this.pos.x - G.player.pos.x, this.pos.z - G.player.pos.z) < 3;
    this.spd += (speed - this.spd) * Math.min(1, dt * 8);
    animateHumanoid(this.model, dt, { speed: this.spd, action: (this.cast ? (this.cast.a.t === 'heal' || this.cast.a.t === 'hot' ? 'castUp' : 'cast') : this.act) || null, actionT: this.cast ? Math.min(1, this.cast.t / this.cast.dur) : this.actT, armed: true });
  }
  // pick who to fight and what to do: focus the team's target, protect healers, play the objective
  think() {
    const foes = enemiesOf(this).filter(u => !(u.stealth > 0) || Math.hypot(u.pos.x - this.pos.x, u.pos.z - this.pos.z) < 3), me = this.pos;
    const near = (u) => Math.hypot(u.pos.x - me.x, u.pos.z - me.z);
    // the team's focus: the weakest enemy near the team, shared by every bot on the side
    const mates = alliesOf(this, true), cx = mates.reduce((s, u) => s + u.pos.x, 0) / mates.length, cz = mates.reduce((s, u) => s + u.pos.z, 0) / mates.length;
    let best = null, bs = 1e9;
    for (const u of foes) { const dTeam = Math.hypot(u.pos.x - cx, u.pos.z - cz), dMe = near(u), hpk = (u.hp / u.maxHp);
      let s = dMe * 1.0 + dTeam * 0.4 + hpk * 14; if (u.pet || u.bpet) s += 18; if (u === this.lastHitBy && G.time - (this.hurtT || 0) < 3) s -= 6;
      for (const m of mates) if (m !== this && m.lastHitBy === u && m.healer && G.time - (m.hurtT || 0) < 3) s -= 10; // peel for our healers
      if (s < bs) { bs = s; best = u; } }
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
        tx = T.pos.x - dir.x * want + side.x * this.strafe * 1.4; tz = T.pos.z - dir.z * want + side.z * this.strafe * 1.4; if (Math.random() < 0.004) this.strafe *= -1; }
    } else { const mates = alliesOf(this); if (mates.length) { const m = mates[0]; tx = m.pos.x + Math.sin(this.id) * 3; tz = m.pos.z + Math.cos(this.id) * 3; } else { tx = 0; tz = 0; } }
    // low on health with no healing: fall back toward a team mate who heals
    if (this.hp / this.maxHp < 0.25 && !this.abs.some(a => a.t === 'heal' || a.t === 'hot')) { const hl = alliesOf(this).find(u => u.healer); if (hl) { tx = hl.pos.x; tz = hl.pos.z; } }
    // stay apart from everyone else
    let px = 0, pz = 0; for (const f of A.F) { if (!f.alive) continue; const u = unitOf(f); if (u === this) continue; const dx = me.x - u.pos.x, dz = me.z - u.pos.z, d = Math.hypot(dx, dz); if (d < 1.3 && d > 0.01) { px += dx / d * (1.3 - d); pz += dz / d * (1.3 - d); } }
    const mx = tx - me.x + px * 3, mz = tz - me.z + pz * 3, L = Math.hypot(mx, mz);
    const far = !T || dT > 14; // run between fights, walk-speed footwork inside them (players run 5.2)
    let sp = (far ? 6.4 : 4.6) * (st.slow > 0 ? 0.55 : 1) * (this.buffs.swind > 0 ? 1.3 : 1) * (this.buffs.rampage > 0 ? 1.2 : 1);
    if (L > 0.3) { const step = Math.min(L, sp * dt); me.x += mx / L * step; me.z += mz / L * step; } else sp = 0;
    const face = T ? Math.atan2(T.pos.x - me.x, T.pos.z - me.z) : L > 0.3 ? Math.atan2(mx, mz) : this.yaw; this.yaw += Math.atan2(Math.sin(face - this.yaw), Math.cos(face - this.yaw)) * Math.min(1, dt * 10);
    return L > 0.3 ? sp : 0;
  }
  // abilities first (heals, defences, buffs, control, damage), then plain attacks
  fight() {
    const T = this.target, me = this.pos, dT = T ? Math.hypot(T.pos.x - me.x, T.pos.z - me.z) : 99, hp = this.hp / this.maxHp;
    if (this.gcd <= 0) { const a = this.choose(T, dT, hp); if (a) return; }
    if (T && this.swingT <= 0 && dT <= this.range + 0.4) { // a plain attack
      const sw = (this.W.kind === 'gun' ? 1.6 : this.W.kind === 'bow' ? 1.0 : this.W.kind === 'staff' ? 0.9 : 0.75) / (this.W.speed || 1) * (this.buffs.focus > 0 ? 0.75 : 1);
      this.swingT = sw * 1.25; const raw = this.base * 0.95 * this.dmgMul();
      if (this.ranged) { this.act = this.W.kind === 'staff' ? 'cast' : 'shoot'; this.actT = 0; this.aimLock = this.W.kind === 'gun' ? 0.6 : 0.4; /* plant your feet to shoot, like a player */ const miss = dT > 10 && Math.random() < 0.12 + (dT - 10) * 0.012; shot(this, T, this.W.kind === 'staff' ? SHOT_COL[this.W.element] || SHOT_COL.arcane : SHOT_COL.phys, () => { if (miss) { V.number(T.pos.clone().setY(T.pos.y + 2), 'Miss', 'miss'); return; } hitUnit(this, T, raw, { ranged: true }); }); }
      else { this.act = Math.random() < 0.5 ? 'swing1' : 'swing2'; this.actT = 0; setTimeout(() => { if (!this.dead && !T.dead && Math.hypot(T.pos.x - this.pos.x, T.pos.z - this.pos.z) < 3.4) { hitUnit(this, T, raw, { melee: true }); S.hit && S.hit('flesh', T.pos, 0.6); } }, 180); }
    }
  }
  ready(a) { return (this.cd[a.id] || 0) <= 0; }
  choose(T, dT, hp) {
    const abs = this.abs.filter(a => this.ready(a)); if (!abs.length) return null;
    const use = (a, tgt) => { this.cd[a.id] = Math.max(a.cd || 0, a.t === 'heal' || a.t === 'hot' ? 4 : 1.5) * (0.95 + Math.random() * 0.15); this.gcd = 1.5;
      const ct = (a.t === 'heal' || a.t === 'hot') ? (a.castT || 1.5) : a.castT && isSupport(a) ? Math.min(a.castT, 1.5) : 0; if (ct) { this.cast = { a, tgt, t: 0, dur: ct }; return true; } this.resolve(a, tgt); return true; };
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
  resolve(a, tgt) {
    if (this.dead) return; const P = (n) => this.base * (n || 0) * this.up * this.dmgMul(), me = this.pos, el = a.kind === 'fireball' || a.fx === 'fire' ? 'fire' : a.kind === 'frost' || a.fx === 'frost' ? 'frost' : a.fx === 'shadow' ? 'shadow' : a.fx === 'gold' ? 'holy' : a.fx === 'leaf' ? 'nature' : 'arcane';
    const col = SHOT_COL[el], o = { stun: a.stun || 0, slow: a.slow || 0, root: a.root || 0, el };
    const T = tgt && tgt !== this ? tgt : this.target;
    const anim = (n) => { this.act = n; this.actT = 0; };
    const drainBack = (dealt, f) => { if (f && dealt) this.healSelf(dealt * f * 6); }; // (hits are scaled for PvP, so the drain is scaled back up)
    if (!a.t) return this.legacy(a, T, P);
    switch (a.t) {
      case 'strike': case 'flurry': { if (!T) return; anim(a.t === 'flurry' ? 'swing2' : 'swing1'); const n = P(a.dmg) * (a.t === 'flurry' ? (a.hits || 3) : 1); setTimeout(() => { if (!T.dead && Math.hypot(T.pos.x - this.pos.x, T.pos.z - this.pos.z) < 4.2) { drainBack(hitUnit(this, T, n, o), a.drain); V.burst(el === 'arcane' ? 'spark' : el, T.pos.clone().setY(T.pos.y + 1.1), 14, { speed: 4 }); } }, 200); return; }
      case 'dash': { if (!T) return; const d = V3(T.pos.x - me.x, 0, T.pos.z - me.z), L = d.length(); if (L > 1.5) me.addScaledVector(d.normalize(), L - 1.4); V.burst('dust', me.clone().setY(me.y + 0.3), 20, { speed: 4 }); anim('swing1'); hitUnit(this, T, P(a.dmg), o); return; }
      case 'cone': { anim('swing2'); for (const u of enemiesOf(this)) { const dx = u.pos.x - me.x, dz = u.pos.z - me.z, d = Math.hypot(dx, dz); if (d < 6.5 && Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - this.yaw), Math.cos(Math.atan2(dx, dz) - this.yaw))) < 0.9) hitUnit(this, u, P(a.dmg), o); } V.burst(el === 'arcane' ? 'spark' : el, me.clone().setY(me.y + 1).addScaledVector(V3(Math.sin(this.yaw), 0, Math.cos(this.yaw)), 3), 30, { speed: 6 }); return; }
      case 'nova': { anim('slam'); const r = (a.r || 5) + 0.4; let dealt = 0; if (!a.calm) for (const u of enemiesOf(this)) if (Math.hypot(u.pos.x - me.x, u.pos.z - me.z) < r) dealt += hitUnit(this, u, P(a.dmg), o); V.ring(me, r, col, 0.6); V.burst(el === 'arcane' ? 'spark' : el, me.clone().setY(me.y + 1), 30, { speed: 6 }); drainBack(dealt, a.drainAll); return; }
      case 'bolt': case 'drain': { if (!T) return; anim('cast'); const n = a.n ? Math.min(3, a.n) : 1; for (let k = 0; k < n; k++) setTimeout(() => shot(this, T, col, () => { let dealt = 0; if (a.aoe) { for (const u of enemiesOf(this)) if (Math.hypot(u.pos.x - T.pos.x, u.pos.z - T.pos.z) < a.aoe) dealt += hitUnit(this, u, P(a.dmg) * 0.8, o); V.burst(el === 'arcane' ? 'spark' : el, T.pos.clone().setY(T.pos.y + 1), 25, { speed: 5 }); } else dealt = hitUnit(this, T, P(a.dmg) * (n > 1 ? 0.7 : 1), o); drainBack(dealt, a.drain); }, true), k * 140); return; }
      case 'curse': { if (!T) return; anim('cast'); shot(this, T, col, () => { const dealt = hitUnit(this, T, P(a.dmg), o); if (a.dot) { if (T === G.player) G.player.debuff('poison', a.dotT || 6, P(a.dot) * PVP_K); else if (T.dots) T.dots.push({ dps: P(a.dot) * PVP_K, t: a.dotT || 6, src: this }); } drainBack(dealt, a.drain); }); return; }
      case 'ground': case 'trap': { const at = a.t === 'trap' ? me : (T ? T.pos : me); anim('cast'); const ticks = a.ticks || (a.t === 'trap' ? 1 : 4); let first = true; zone(this, at, a.t === 'trap' ? 3 : 4.5, ticks + 0.2, 1, (u) => { hitUnit(this, u, P(a.dmg), first ? o : { slow: a.slow || 0, el }); }, col); setTimeout(() => { first = false; }, 1100); return; }
      case 'aura': case 'stormwalk': case 'blizzaura': { anim('castBig'); zone(this, me, a.t === 'aura' ? 6 : 7, a.dur || 8, 0.5, (u) => { const d = hitUnit(this, u, P(a.dmg) * (a.t === 'aura' ? 1 : 0.6), { slow: a.slow || 0, stun: Math.random() < 0.15 ? (a.stun || 0) : 0, el }); drainBack(d, a.drain); }, col, true); return; }
      case 'heal': case 'hot': { const who = tgt || this, amt = (a.self || a.pct || 0.25) * who.maxHp; anim('castUp'); if (a.t === 'heal') healUnit(who, amt, this); else if (who === this) this.hots.push({ ps: amt / (a.dur || 8), t: a.dur || 8 }); else if (who === G.player) G.player.addRegen ? G.player.addRegen(a.pct || 0.25, a.dur || 8) : healUnit(who, amt, this); else who.hots.push({ ps: amt / (a.dur || 8), t: a.dur || 8 });
        if (a.ally || SUPPORT_CLS.has(this.cls)) for (const u of alliesOf(this)) if (u !== who && Math.hypot(u.pos.x - me.x, u.pos.z - me.z) < (a.r || 10)) healUnit(u, (a.ally || 0.15) * u.maxHp, this); V.ring(me, a.r || 3, '#80ff90', 0.6); return; }
      case 'buff': { anim('cast'); const k = a.buff; if (k === 'avatar') { this.av = a.av || { dmg: 1.3, taken: 0.8 }; this.addBuff('avatar', a.dur || 12); } else if (k && k.startsWith('form')) this.addBuff('form', a.dur || 20); else if (k === 'barrier') { this.addBuff('barrier', a.dur || 12); this.barrier = this.maxHp * (a.amount || 0.25); } else if (k) this.addBuff(k, a.dur || 8);
        if (SUPPORT_CLS.has(this.cls) && ['ward', 'cry', 'fort', 'stand'].includes(k)) for (const u of alliesOf(this)) if (Math.hypot(u.pos.x - me.x, u.pos.z - me.z) < 12) buffUnit(u, k, (a.dur || 8) * 0.8);
        V.sphereFlash(me.clone().setY(me.y + 1), 1.4, k === 'ward' || k === 'barrier' || k === 'fort' ? '#80d8ff' : '#ffd060', 0.45); return; }
      case 'stealth': this.stealth = a.dur || 4; V.burst('smoke', me.clone().setY(me.y + 1), 30, { speed: 3 }); this.target = null; return;
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
  m.pos.y = AR.Y; m.root.position.copy(m.pos); m.root.rotation.y = m.yaw; m.actionT = (m.actionT || 0) + dt * 2; m.animate(dt, { speed: sp, action: m.actionT < 1 ? m.action : null, actionT: m.actionT });
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
  if (A.state === 'pick') mid = `<div class="arpick"><div class="arcount">${Math.ceil(A.t)}</div><div><b>${A.round > 1 ? 'Next round' : 'Choose your abilities'}</b><span>${A.round > 1 ? 'Get ready' : `${A.loaded ? 'Your saved build is loaded · ' : ''}${Game.classPoints(G.save)} skill points left · <kbd>K</kbd> opens and closes the skill trees · <kbd>Y</kbd> ready · ${Ob.desc}`}</span></div>${A.t > 4 ? '<button class="btn gold" id="arReady">Ready <kbd>Y</kbd></button>' : ''}</div>`;
  const hill = o === 'koth' && A.state === 'fight' ? `<div class="arhill">${A.hillOwner == null ? 'The hill is empty' : A.hillOwner === 'contested' ? 'The hill is contested!' : `<b style="color:${teamCol(A.hillOwner)}">${teamName(A.hillOwner)}</b> holds the hill`}</div>` : '';
  const me = A.F[0], dead = !me.alive && A.state === 'fight' ? `<div class="ardead">${A.lives === 'one' ? 'You have fallen. Watch your side finish the fight.' : `Back in the fight in ${Math.ceil(me.respawnT)}`}<small>Fly around to watch: <kbd>W A S D</kbd> move · <kbd>Space</kbd> up · <kbd>C</kbd> down · <kbd>Shift</kbd> faster</small></div>` : '';
  const html = `<div class="arbar"><div class="arobj">${Ob.icon} ${Ob.name}${o === 'rounds' ? ` · Round ${A.round}` : ''}<small>${A.state === 'fight' ? mm + ':' + ss : ''}${tgt ? ' · first to ' + A.target : ''}</small></div><div class="archips">${chips}</div></div>${mid}${hill}${dead}<div class="arfeed">${A.feed.filter(f => G.time - f.t < 8).map(f => `<div>${f.html}</div>`).join('')}</div>`;
  if (hudEl._h !== html || force) { hudEl.innerHTML = html; hudEl._h = html; const b = hudEl.querySelector('#arReady'); if (b) b.onclick = () => { S.click(); readyUp(); }; }
}
export function scoreTable() {
  const rows = A.F.slice().sort((a, b) => (b.team === a.team ? 0 : a.team - b.team) || b.kills - a.kills);
  return `<table class="artab"><tr><th></th><th>Fighter</th><th>Class</th><th>Kills</th><th>Deaths</th><th>Damage</th><th>Healing</th></tr>${rows.map(f => `<tr class="${f.you ? 'me' : ''}${f.alive ? '' : ' dead'}"><td><i style="background:${teamCol(f.team)}"></i></td><td>${f.name}${f.you && f.name !== 'You' ? ' (you)' : ''}</td><td>${CLASSES[f.cls] ? CLASSES[f.cls].name : f.cls}</td><td>${f.kills}</td><td>${f.deaths}</td><td>${Math.round(f.dmg)}</td><td>${Math.round(f.heal)}</td></tr>`).join('')}</table>`;
}
export function toggleScores(on) { let e = document.getElementById('arscores'); if (!on) { if (e) e.remove(); return; } if (!e) { e = el('div', ''); e.id = 'arscores'; document.body.appendChild(e); } e.innerHTML = `<h3>${OBJECTIVES[A.setup.objective].name}</h3>` + scoreTable(); }
function renderEnd() {
  if (endShown) return; endShown = true; const won = A.winner === G.myTeam;
  const e = el('div', ''); e.id = 'arenaend';
  e.innerHTML = `<div class="arendp"><div class="eyebrow">Kingdom Arena · ${OBJECTIVES[A.setup.objective].name}</div><h1 class="${won ? 'win' : 'lose'}">${A.winner == null ? 'Draw' : won ? 'Victory!' : 'Defeat'}</h1><p>${A.winner == null ? 'Nobody is left standing.' : `<b style="color:${teamCol(A.winner)}">${teamName(A.winner)}</b> ${isFFA() ? 'is the champion of the arena' : 'wins the match'}.`}</p>${scoreTable()}<div class="arbtns"><button class="btn gold big" id="arAgain">Fight again</button><button class="btn" id="arSetup">Change the match</button><button class="btn red" id="arMenu">Main menu</button></div></div>`;
  document.body.appendChild(e); if (document.pointerLockElement) document.exitPointerLock(); G.uiOpen = true;
  e.querySelector('#arAgain').onclick = () => location.reload();
  e.querySelector('#arSetup').onclick = () => { try { sessionStorage.setItem('kr2_arena_open', '1'); } catch (er) { /* no storage */ } location.href = location.pathname; };
  e.querySelector('#arMenu').onclick = () => { location.href = location.pathname; };
}
