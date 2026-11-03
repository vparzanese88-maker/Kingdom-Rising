// Kingdom Battles online: snapshots from the host, mirrored on every other player's screen.
import * as THREE from 'three';
import { G } from './state.js';
import { V } from './vfx.js';
import { S } from './audio.js';
import { MOBS } from './data.js';
import { Mob } from './mobs.js';
import { MP, send, RemoteHero } from './mp.js';
import { B, Unit, myTown, bank, allyHeal, allyBuff, sendAttack, recall, setFollow, summonWolves, heroUnitDef, syncTownLevel, startConstructionVisual, shootVisual, questReward } from './battle.js';
import { unitDef } from './battledata.js';
import { heightAt } from './terrain.js';
import { angDiff } from './util.js';

const r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;
let snapT = 0, meT = 0, lastMobs = [];
export const mobList = []; // neutral mobs in the same order on every machine
export const fxQueue = [];

// ---------- host ----------
export function hostTick(dt) {
  snapT -= dt; if (snapT > 0) return; snapT = 0.1;
  const u = [];
  for (const x of B.units) { if (x.gone || x.builder) continue; u.push([x.id, x.town.i, x.hero ? '@' + (x.cls || 'warrior') : x.pet ? '~wolf' : x.udef.id, r1(x.pos.x), r1(x.pos.z), r2(x.yaw), Math.round(x.hp), x.maxHp, x.action || '', x.dead ? 1 : 0, x.carry > 0 ? (x.cjob === 'wood' ? 1 : 2) : 0, x.hero ? x.heroName : 0]); }
  // only mobs that changed since last time
  const m = [];
  mobList.forEach((mb, i) => { const L = lastMobs[i]; const st = [r1(mb.pos.x), r1(mb.pos.z), r2(mb.yaw), Math.round(mb.hp), mb.dead ? 1 : 0, mb.action ? 1 : 0]; if (!L || Math.abs(L[0] - st[0]) > 0.15 || Math.abs(L[1] - st[1]) > 0.15 || L[3] !== st[3] || L[4] !== st[4] || L[5] !== st[5] || Math.abs(L[2] - st[2]) > 0.1) { m.push([i, ...st]); lastMobs[i] = st; } });
  const s = B.structs.map(x => [Math.round(x.hp), x.level, x.dead ? 1 : 0, x.building ? 1 : 0]);
  const tw = B.towns.map(t => [t.level, t.building ? [r1(t.building.t), t.building.dur] : 0, Math.round(t.isMe ? G.save.gold : t.bank.gold), Math.round(t.bank.wood), Math.round(t.bank.stone), t.dead ? 1 : 0, t.up || {}]);
  const p = G.player, h = p ? [r1(p.pos.x), r1(p.pos.y), r1(p.pos.z), r2(p.yaw), Math.round(p.hp), Math.round(p.maxHp), p.dead ? 1 : 0, G.save.level, p.atk ? p.atk.name : '', r1(p.vel ? Math.hypot(p.vel.x, p.vel.z) : 0), p.weapon ? p.weapon.wt : '', backOf(), G.save.kills || 0, G.save.deaths || 0] : null;
  send({ t: 'snap', time: r1(B.time), u, m, s, tw, h, fx: fxQueue.splice(0), over: B.over ? B.result : 0, overTeam: B.winTeam });
}
// ---------- every player ----------
const backOf = () => { const e = G.save && G.save.equip; return e ? [e.w3, e.w4].map(x => x ? x.wt + ':' + (x.tier || 0) + ':' + (x.rarity || 0) : '').join(',') : ''; };
export function meTick(dt) {
  if (MP.host) return; meT -= dt; if (meT > 0) return; meT = 0.066;
  const p = G.player; if (!p) return;
  send({ t: 'me', s: { x: r1(p.pos.x), y: r1(p.pos.y), z: r1(p.pos.z), yaw: r2(p.yaw), hp: Math.round(p.hp), mhp: Math.round(p.maxHp), dead: p.dead ? 1 : 0, lv: G.save.level, act: p.atk ? p.atk.name : '', spd: r1(p.vel ? Math.hypot(p.vel.x, p.vel.z) : 0), wt: p.weapon ? p.weapon.wt : '', bk: backOf(), k: G.save.kills || 0, de: G.save.deaths || 0 } });
}
// which town a player belongs to (friends can share a town)
export const townOf = (id) => B.towns.find(x => (x.members || []).includes(id) || x.owner === id);
function remoteFor(netId) {
  let r = MP.remotes.get(netId); if (r || netId === MP.myId) return r;
  const info = MP.players.get(netId); if (!info) return null;
  const t = townOf(netId); if (!t || !info.cls) return null; // no hero until they have made one
  r = new RemoteHero(netId, info, t); if (!t.isMe && !t.leader) t.leader = r; return r;
}
// ---------- client: apply a snapshot ----------
const unitById = new Map();
function applySnap(d) {
  B.time = d.time;
  // troops
  const seen = new Set();
  for (const e of d.u) {
    const [id, ti, def, x, z, yaw, hp, mhp, act, dead, carry, hname] = e; seen.add(id);
    let u = unitById.get(id);
    if (!u) {
      const t = B.towns[ti]; if (!t) continue;
      const D = def[0] === '@' ? heroUnitDef(def.slice(1)) : def === '~wolf' ? { id: 'wolfpet', name: 'Spirit Wolf', role: 'melee', hp: mhp, dmg: 1, speed: 7, range: 0, size: 1.35, quad: 'wolf', col: '#c8d8f0', pop: 0, cost: { gold: 0 } } : unitDef(t.race, def);
      if (!D) continue;
      u = new Unit(t, D, x, z, { hero: def[0] === '@', app: def[0] === '@' ? { cls: def.slice(1), outfit: def.slice(1), spec: undefined } : undefined, proxyId: id });
      u.proxy = true; u.id = id; if (hname) u.heroName = hname; if (def === '~wolf') u.pet = true;
      u.tpos = new THREE.Vector3(x, 0, z); t.units.push(u); unitById.set(id, u);
    }
    u.tpos.set(x, 0, z); u.tyaw = yaw; u.hp = hp; u.maxHp = mhp; u.carry = carry ? 10 : 0; u.cjob = carry === 1 ? 'wood' : 'stone';
    if (act && act !== u.action) { u.action = act; u.actionT = 0; u.actionDur = 0.7; } if (!act && u.action && u.actionT >= 1) u.action = null;
    if (dead && !u.dead) { u.dead = true; u.deadT = 0; } else if (!dead && u.dead) { u.dead = false; u.root.visible = true; u.root.rotation.set(0, 0, 0); u.pos.copy(u.tpos); u.gone = false; }
  }
  for (const [id, u] of unitById) if (!seen.has(id)) { G.scene.remove(u.root); unitById.delete(id); const i = B.units.indexOf(u); if (i >= 0) B.units.splice(i, 1); const j = G.mobs.indexOf(u); if (j >= 0) G.mobs.splice(j, 1); const k = u.town.units.indexOf(u); if (k >= 0) u.town.units.splice(k, 1); }
  // mobs
  for (const [i, x, z, yaw, hp, dead, act] of d.m) { const mb = mobList[i]; if (!mb) continue; mb.tpos = mb.tpos || new THREE.Vector3(); mb.tpos.set(x, 0, z); mb.tyaw = yaw; mb.hp = hp; if (act && !mb.action) { mb.action = 'attack'; mb.actionT = 0; } if (dead && !mb.dead) { mb.dead = true; mb.deadT = 0; if (mb.ring) mb.ring.visible = false; } else if (!dead && mb.dead) { mb.dead = false; mb.deadT = 0; mb.root.visible = true; mb.pos.set(x, mb.pos.y, z); } }
  // towers and halls
  d.s.forEach(([hp, lvl, dead, bld], i) => { const s = B.structs[i]; if (!s) return; if (lvl !== s.level) s.setLevel(lvl); s.hp = hp; if (dead && !s.dead) s.destroy(null); });
  // towns
  d.tw.forEach(([lvl, bld, gold, wood, stone, dead, up], i) => { const t = B.towns[i]; if (!t) return;
    if (bld && !t.building) startConstructionVisual(t, bld[1], bld[0]); else if (t.building && bld) t.building.t = bld[0];
    if (lvl > t.level) syncTownLevel(t, lvl);
    t.bank.gold = gold; t.bank.wood = wood; t.bank.stone = stone; t.up = up; if (t.isMe && G.save) G.save.gold = gold;
    if (dead && !t.dead) { t.dead = true; G.hooks.banner && G.hooks.banner(`${t.name} has fallen!`, '', 3500); }
  });
  // host hero
  if (d.h) { const r = remoteFor(0); if (r) { const [x, y, z, yaw, hp, mhp, dead, lv, act, spd, wt, bk, k, de] = d.h; r.netState({ x, y, z, yaw, hp, mhp, dead, lv, act, spd, wt, bk, k, de }); } }
  for (const f of d.fx) shootVisual(f);
  { const me = myTown(); if (me.dead && !B.shownEnd) { B.shownEnd = true; G.hooks.matchOver && G.hooks.matchOver('defeat'); }
    if (d.over && !B.over) { B.over = true; const res = d.overTeam != null && d.overTeam === me.team ? 'victory' : 'defeat'; B.result = res; if (!B.shownEnd) { B.shownEnd = true; G.hooks.matchOver && G.hooks.matchOver(res); } } }
}
// interpolate mirrored troops and mobs between snapshots
export function proxyUnitStep(u, dt) {
  if (u.dead) { u.deadT += dt; if (u.deadT < 1.2) { u.root.rotation.x = -Math.min(1, u.deadT / 0.6) * Math.PI / 2; u.root.position.y = u.pos.y + 0.15; } else u.root.visible = false; return; }
  const px = u.pos.x, pz = u.pos.z; u.pos.x += (u.tpos.x - u.pos.x) * Math.min(1, dt * 9); u.pos.z += (u.tpos.z - u.pos.z) * Math.min(1, dt * 9); u.pos.y = heightAt(u.pos.x, u.pos.z);
  u.yaw += angDiff(u.yaw, u.tyaw) * Math.min(1, dt * 10); u.hitFlash = Math.max(0, (u.hitFlash || 0) - dt); for (const m of u.mats) m.emissive.setScalar(u.hitFlash > 0 ? 0.5 : 0);
  if (u.action) { u.actionT += dt / (u.actionDur || 0.7); if (u.actionT >= 1) u.action = null; }
  const sp = Math.hypot(u.pos.x - px, u.pos.z - pz) / Math.max(dt, 1e-4);
  u.root.position.copy(u.pos); u.root.rotation.y = u.yaw; u.sackUpdate && u.sackUpdate();
  if (u.root.visible) u.animateProxy(dt, sp);
}
export function proxyMobStep(m, dt) {
  if (m.dead) { m.deadT = (m.deadT || 0) + dt; m.animate(dt, { dead: true, deadT: m.deadT }); if (m.deadT > 6) m.root.visible = false; return; }
  if (!m.tpos) return; const px = m.pos.x, pz = m.pos.z;
  m.pos.x += (m.tpos.x - m.pos.x) * Math.min(1, dt * 9); m.pos.z += (m.tpos.z - m.pos.z) * Math.min(1, dt * 9); m.pos.y = heightAt(m.pos.x, m.pos.z);
  m.yaw += angDiff(m.yaw, m.tyaw) * Math.min(1, dt * 10); m.hitFlash = Math.max(0, m.hitFlash - dt); for (const mt of m.mats) mt.emissive && mt.emissive.setScalar(m.hitFlash > 0 ? 0.6 : 0);
  if (m.action) { m.actionT += dt / 0.8; if (m.actionT >= 1) m.action = null; }
  const sp = Math.hypot(m.pos.x - px, m.pos.z - pz) / Math.max(dt, 1e-4);
  m.root.position.copy(m.pos); m.root.rotation.y = m.yaw;
  if (m.ring && G.player) { const d = m.pos.distanceTo(G.player.pos); m.ring.visible = d < 45; if (m.ring.visible) m.ring.position.set(m.pos.x, m.pos.y + 0.08, m.pos.z); }
  m.animate(dt, { speed: Math.min(8, sp), action: m.action, actionT: m.actionT });
}

// ---------- messages ----------
export function onData(from, d) {
  const p = G.player;
  switch (d.t) {
    case 'snap': if (MP.client) applySnap(d); break;
    case 'me': { const r = remoteFor(from); if (r) r.netState(d.s); break; }
    case 'roster': if (MP.client) buildRoster(d.list); break;
    case 'booted': if (MP.host) { if (mobList.length) sendRoster(from); else pendingRoster.push(from); } break;
    // a player's hit on something the host runs
    case 'hit': if (MP.host) { const src = remoteFor(from) || null; const e = d.k === 'u' ? B.units.find(x => x.id === d.id) : d.k === 's' ? B.structs[d.id] : d.k === 'm' ? mobList[d.id] : null; if (e && !e.dead) { e.takeHit(d.dmg, src, d.o || {}); } } break;
    // a player hit another player
    case 'pvp': if (d.to === MP.myId && p && !p.dead) { const src = remoteFor(from); p.takeDamage(d.dmg, src, d.o || {}); } break;
    case 'dmg': if (d.to === MP.myId && p && !p.dead) { p.takeDamage(d.dmg, d.sx != null ? { pos: new THREE.Vector3(d.sx, p.pos.y, d.sz), lv: d.slv } : null, d.o || {}); } break;
    case 'debuff': if (d.to === MP.myId && p && p.debuff) p.debuff(d.type, d.dur, d.dps); break;
    case 'heal': if (d.to === MP.myId && p && !p.dead) { p.heal(p.maxHp * d.pct); V.burst('heal', p.pos.clone().setY(p.pos.y + 1), 20, { speed: 2, vy: 2 }); G.hooks.toast && G.hooks.toast('An ally healed you', '✚', 'gold'); } break;
    case 'buff': if (d.to === MP.myId && p) { if (d.kind === 'ward') p.buffs.ward = d.dur; else if (d.kind === 'rally') p.buffs.cry = Math.max(p.buffs.cry || 0, d.dur); else if (d.kind === 'haste') p.buffs.focus = Math.max(p.buffs.focus || 0, d.dur); G.hooks.toast && G.hooks.toast(d.kind === 'ward' ? 'An ally shields you' : d.kind === 'rally' ? 'An ally rallies you' : 'An ally hastens you', '✦', 'gold'); } break;
    case 'xp': if (d.to === MP.myId) G.hooks.battleXp && G.hooks.battleXp(d.n); break;
    case 'kill': if (d.to === MP.myId) { const mb = mobList[d.i]; if (mb) { mb.dead = true; G.hooks.onKill && G.hooks.onKill(mb, G.player, true); } } break;
    case 'horn': if (MP.client && G.hooks.warHorn) G.hooks.warHorn(d); break;
    case 'qreward': if (MP.host) { const t = townOf(from); if (t) questReward(t, d.id); } break;
    case 'give': if (d.to === MP.myId && G.hooks.gotItem) G.hooks.gotItem(d, from); break;
    case 'say': if (d.to === MP.myId) G.hooks.cmd && G.hooks.cmd(d.who, d.text, d.kind); break;
    case 'teamsay': if (B.towns.length && myTown().team === d.team && from !== MP.myId) G.hooks.cmd && G.hooks.cmd(d.who, d.text, d.kind); break;
    // a player's economy and orders, handled by the host for their town
    case 'gold': if (MP.host) { const t = townOf(from); if (t) bank(t, 'gold', d.n); } break;
    case 'order': if (MP.host) { const t = townOf(from); if (!t) break; if (d.kind === 'attack') sendAttack(t, d.target, d.frac || 1); else if (d.kind === 'recall') recall(t); else if (d.kind === 'follow') setFollow(t); } break;
    case 'fx': if (MP.host) { const t = townOf(from); if (!t) break; const at = new THREE.Vector3(d.x, 0, d.z); if (d.heal) allyHeal(at, d.r, d.heal, t.team, remoteFor(from)); if (d.kind) allyBuff(at, d.r, d.kind, d.dur, t.team, remoteFor(from)); } break;
    case 'summon': if (MP.host) { const t = townOf(from); if (t) summonWolves(new THREE.Vector3(d.x, 0, d.z), d.lv, d.dur, t); } break;
  }
}
const pendingRoster = [];
function sendRoster(to) { send({ t: 'roster', to, list: mobList.map(m => [m.type, m.lv, r1(m.home.x), r1(m.home.z), m.bossy ? 1 : 0, m.maxHp]) }); }
export function flushRoster() { while (pendingRoster.length) sendRoster(pendingRoster.shift()); }
// the mob list: the host spawns the camps, everyone else builds the same list from it
function buildRoster(list) {
  for (const m of mobList) { G.scene.remove(m.root); if (m.ring) G.scene.remove(m.ring); const i = G.mobs.indexOf(m); if (i >= 0) G.mobs.splice(i, 1); }
  mobList.length = 0;
  list.forEach(([type, lv, x, z, bossy, mhp], i) => { if (!MOBS[type]) return; const m = new Mob(type, lv, x, z); m.netProxy = true; m.netIdx = i; m.maxHp = mhp; m.hp = mhp; if (bossy) m.bossy = true; m.tpos = m.pos.clone(); m.tyaw = m.yaw; G.mobs.push(m); mobList[i] = m; });
  if (G.hooks.decorCamps) G.hooks.decorCamps();
}
