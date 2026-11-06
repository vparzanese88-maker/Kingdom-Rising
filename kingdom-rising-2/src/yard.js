// The Training Yard: a plain field with practice dummies, every class at the top level and every weapon.
// Y opens the yard panel: pick a class, pick a weapon, reset cooldowns, unlimited mana and endurance.
import * as THREE from 'three';
import { G } from './state.js';
import { Mob } from './mobs.js';
import { CLASSES, WEAPON_TYPES, ABILITIES, LEVEL_CAP } from './data.js';
import { heightAt } from './terrain.js';
import * as Game from './game.js';
import * as Icons from './icons.js';
import { S } from './audio.js';
import { arenaHero, perksFor, recomputePK, kitOf, rmbOf, ultOf, roleOf, summonDemon } from './arena.js';
import { classPortrait } from './portraits.js';
import { buildHumanoid, equipWeapon, animateHumanoid } from './character.js';
import { arenaSpec, arenaBody, arenaDecor, arenaWeaponDecor, addOutline } from './arenalooks.js';

export const YD = { infinite: false, dmg: [], startGame: null };
const dummies = [];
// single dummies near, mid and far; a pack of five for area attacks; one that walks a line for aiming practice
const SPOTS = [[0, 12, 'Training Dummy'], [-8, 20, 'Training Dummy'], [8, 20, 'Training Dummy'], [0, 38, 'Far Dummy'],
  ...[0, 1, 2, 3, 4].map(i => [-26 + Math.cos(i * 1.256) * 3, 18 + Math.sin(i * 1.256) * 3, 'Pack Dummy']), [24, 22, 'Moving Dummy']];
export function spawnDummies() {
  G.hooks.arenaDemon = summonDemon; // (the necromancer's demon ultimate works here too)
  for (const [x, z, name] of SPOTS) {
    const m = new Mob('bandit', 10, x, z); m.dummy = true; m.hostile = false; m.def = Object.assign({}, m.def, { aggro: 0, flee: false, gold: null, loot: {}, gearChance: 0 });
    Object.defineProperty(m, 'name', { value: name, configurable: true }); m.maxHp = m.hp = 1e7; m.lv = LEVEL_CAP; m.yaw = Math.PI; m.home.set(x, heightAt(x, z), z);
    m.walk = name === 'Moving Dummy' ? { a: 0 } : null; m.update = dummyUpdate; m.loot = null;
    const take = m.takeHit.bind(m); m.takeHit = (dmg, src, o) => { const d = take(dmg, src, o); YD.dmg.push([performance.now(), Math.max(0, d || dmg)]); m.lastHit = G.time; if (m.hp < m.maxHp * 0.5) m.hp = m.maxHp; m.dead = false; return d; };
    G.mobs.push(m); dummies.push(m);
  }
}
function dummyUpdate(dt) {
  const m = this; m.dead = false; if (m.held) return; // (in the demon's grip)
  if (m.walk) { m.walk.a += dt * 0.35; m.pos.x = 24 + Math.sin(m.walk.a) * 12; m.yaw = Math.cos(m.walk.a) > 0 ? Math.PI / 2 : -Math.PI / 2; }
  for (const k in m.status) if (typeof m.status[k] === 'number' && m.status[k] > 0 && k !== 'knock') m.status[k] = Math.max(0, m.status[k] - dt);
  if (m.status.knock && m.status.knock.lengthSq && m.status.knock.lengthSq() > 0) { m.status.knock.set(0, 0, 0); m.pos.x = m.walk ? m.pos.x : m.home.x; m.pos.z = m.home.z; }
  if (G.time - (m.lastHit || -99) > 3) m.hp = m.maxHp;
  m.pos.y = heightAt(m.pos.x, m.pos.z); m.root.position.copy(m.pos); m.root.rotation.y = m.yaw;
  m.animate(dt, { speed: m.walk ? 1.5 : 0, action: null, actionT: 0 });
}
// damage per second over the last 8 seconds, and cheats while training
export function updateYard(dt) {
  G.zoneLabel = 'Training Yard<small>The arena classes</small>'; const tr = document.getElementById('tracker'); if (tr && !tr.hidden) tr.hidden = true;
  const now = performance.now(); while (YD.dmg.length && now - YD.dmg[0][0] > 8000) YD.dmg.shift();
  const tot = YD.dmg.reduce((a, b) => a + b[1], 0), span = YD.dmg.length ? Math.max(1, (now - YD.dmg[0][0]) / 1000) : 1;
  let e = document.getElementById('yardhud'); if (!e) { e = document.createElement('div'); e.id = 'yardhud'; document.getElementById('hud').appendChild(e); }
  const h = G.save, html = `<b>Training Yard</b><span>${CLASSES[h.cls].name} · level ${h.level}</span><span class="dps">DPS <b>${YD.dmg.length ? Math.round(tot / span) : 0}</b></span><small><kbd>Y</kbd> class & perks · <kbd>I</kbd> what your keys do · <kbd>R</kbd> ultimate</small>`;
  if (e._h !== html) { e.innerHTML = html; e._h = html; }
  if (G.save.arenaUlt) G.save.ultCharge = Math.min(100, (G.save.ultCharge || 0) + dt * 25); // (the yard: the ultimate is back in 4 seconds)
  const P = G.player; if (P && YD.infinite) { P.mana = P.maxMana; P.end = P.maxEnd; }
}
export function resetCooldowns() { const P = G.player; if (P) for (const k in P.cd) P.cd[k] = 0; }

// the hero for a class: exactly the arena's version of it (its look, its five keys, its ultimate on R, its perks)
export function yardHero(cls, keep) {
  const h = arenaHero({ cls, race: keep ? keep.race : 'human', you: true }, keep ? keep.name : 'Trainee'); h.yard = true; h.ultCharge = 100;
  if (keep && keep.cls === cls && keep.arenaPerks) { h.arenaPerks = Object.assign({}, keep.arenaPerks); recomputePK(h); }
  return h;
}
// weapons you can pick: everything except a lone shield
const PICK = () => Object.keys(WEAPON_TYPES).filter(w => w !== 'shield' && !['daggers', 'handaxes', 'swordmace'].includes(w)); // no twin weapons
let YF = 'all';
export function openYardPanel(UI) {
  const c = UI.openWin('yard', 'Training Yard', '', 'big yardwin'), h = G.save;
  const render = () => {
    c.innerHTML = ''; const h = G.save;
    c.appendChild(el('h3', '', 'Class <small>the arena classes: the same keys, looks, ultimate and perks</small>'));
    const tabs = el('div', 'artabs'); for (const [k, nm] of [['all', 'All'], ['Tank', 'Tanks'], ['Healer', 'Healers'], ['Damage', 'Damage']]) { const t = el('button', 'artab' + (YF === k ? ' on' : ''), nm); t.onclick = () => { S.click(); YF = k; render(); }; tabs.appendChild(t); } c.appendChild(tabs);
    const cg = el('div', 'pgrid yardgrid');
    for (const k of Object.keys(CLASSES)) { if (YF !== 'all' && roleOf(k) !== YF) continue; const b = el('button', 'pcard' + (h.cls === k ? ' on' : ''), `<img src="${classPortrait(k)}" alt=""><b>${CLASSES[k].name}</b>`); b.onclick = () => { S.click(); const nh = yardHero(k, G.save); UI.closeWin(); YD.startGame(nh); }; cg.appendChild(b); }
    c.appendChild(cg);
    // perks: set any rank you like here, no points needed
    c.appendChild(el('h3', '', `Perks <small>${CLASSES[h.cls].name}: set any rank to try it, no points needed</small>`));
    const pg = el('div', 'perkgrid'); h.arenaPerks = h.arenaPerks || {};
    for (const pk of perksFor(h.cls)) { const lv = h.arenaPerks[pk.id] || 0, r = el('div', 'perkcard' + (lv ? ' has' : ''));
      r.innerHTML = `<div class="kiti"><span class="perkglyph${pk.passive ? ' pas' : ''}">${pk.glyph || '◆'}</span></div><div class="kitt"><b>${pk.name}</b><span>${pk.desc}</span><div class="perkpips">${[0, 1, 2].map(i => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</div></div>`;
      const bx = el('div', 'perkbtns'), plus = el('button', 'btn gold perkb', '+'), minus = el('button', 'btn perkb', '−'); plus.disabled = lv >= 3; minus.disabled = lv <= 0;
      const set = (v) => { h.arenaPerks[pk.id] = v; recomputePK(h); const P = G.player, k2 = P.hp / P.maxHp; P.refreshStatsOnly(); P.hp = P.maxHp * k2; S.click(); render(); };
      plus.onclick = () => set(lv + 1); minus.onclick = () => set(lv - 1); bx.append(plus, minus); r.appendChild(bx); pg.appendChild(r); }
    c.appendChild(pg);
    const row = el('div', 'yrow');
    const t1 = el('button', 'btn', 'Reset cooldowns'); t1.onclick = () => { S.click(); resetCooldowns(); G.save.ultCharge = 100; };
    const t5 = el('button', 'btn', 'Max all perks'); t5.onclick = () => { for (const pk of perksFor(h.cls)) h.arenaPerks[pk.id] = 3; recomputePK(h); G.player.refreshStatsOnly(); G.player.hp = G.player.maxHp; S.click(); render(); };
    const t6 = el('button', 'btn', 'Clear perks'); t6.onclick = () => { h.arenaPerks = {}; recomputePK(h); G.player.refreshStatsOnly(); S.click(); render(); };
    const t3 = el('button', 'btn', 'Clear DPS'); t3.onclick = () => { S.click(); YD.dmg.length = 0; };
    const t4 = el('button', 'btn red', 'Leave the yard'); t4.onclick = () => { location.href = location.pathname; };
    row.append(t1, t5, t6, t3, t4); c.appendChild(row);
  };
  render();
}
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

// U in the Training Yard: an enemy necromancer appears in front of you and calls its demon on you, so you can watch the
// ultimate from the victim's side (you come back to life afterwards)
let ultBusy = false;
export function yardUltTest() {
  const P = G.player; if (!P || ultBusy || !G.hooks.arenaDemon) return; ultBusy = true;
  const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw), x = P.pos.x + fx * 10, z = P.pos.z + fz * 10;
  const ch = buildHumanoid({ race: 'human', sex: 'm', cls: 'necromancer', outfit: 'necromancer', spec: arenaSpec('necromancer'), body: arenaBody('necromancer') }); arenaDecor(ch, 'necromancer');
  try { equipWeapon(ch, CLASSES.necromancer.weapons[0], 3, 0); arenaWeaponDecor(ch, 'necromancer'); } catch (e) { /* no weapon model */ }
  addOutline(ch.root, '#8a0c06'); ch.root.position.set(x, heightAt(x, z), z); ch.root.rotation.y = Math.atan2(-fx, -fz); G.scene.add(ch.root);
  const foe = { pos: ch.root.position, team: 99, heroName: 'Training Necromancer', name: 'Training Necromancer' };
  G.hooks.toast && G.hooks.toast('An enemy Necromancer calls its demon on you!', '☠', 'bad');
  let t = 0, cast = false;
  G.timers.push({ update: (dt) => { t += dt; animateHumanoid(ch, dt, { speed: 0, armed: true, ready: true });
    if (t < 1.4) { const k = Math.min(1, t * 3); ch.arms.R.sh.rotation.x = -2.6 * k; ch.arms.L.sh.rotation.x = -2.6 * k; ch.arms.R.sh.rotation.z = 0.7 * k; ch.arms.L.sh.rotation.z = -0.7 * k; }
    if (t > 0.9 && !cast) { cast = true; G.hooks.arenaDemon(foe, P.pos.clone()); }
    if (t > 11) { G.scene.remove(ch.root); ultBusy = false; if (P.dead) { P.dead = false; P.deadT = 0; P.hp = P.maxHp || P.hp; if (P.ch) P.ch.root.visible = true; const dd = document.getElementById('death'); if (dd) dd.hidden = true; } return true; }
    return false; } });
}
