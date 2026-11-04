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

export const YD = { infinite: true, dmg: [], startGame: null };
const dummies = [];
// single dummies near, mid and far; a pack of five for area attacks; one that walks a line for aiming practice
const SPOTS = [[0, 12, 'Training Dummy'], [-8, 20, 'Training Dummy'], [8, 20, 'Training Dummy'], [0, 38, 'Far Dummy'],
  ...[0, 1, 2, 3, 4].map(i => [-26 + Math.cos(i * 1.256) * 3, 18 + Math.sin(i * 1.256) * 3, 'Pack Dummy']), [24, 22, 'Moving Dummy']];
export function spawnDummies() {
  for (const [x, z, name] of SPOTS) {
    const m = new Mob('bandit', 10, x, z); m.dummy = true; m.hostile = false; m.def = Object.assign({}, m.def, { aggro: 0, flee: false, gold: null, loot: {}, gearChance: 0 });
    Object.defineProperty(m, 'name', { value: name, configurable: true }); m.maxHp = m.hp = 1e7; m.lv = LEVEL_CAP; m.yaw = Math.PI; m.home.set(x, heightAt(x, z), z);
    m.walk = name === 'Moving Dummy' ? { a: 0 } : null; m.update = dummyUpdate; m.loot = null;
    const take = m.takeHit.bind(m); m.takeHit = (dmg, src, o) => { const d = take(dmg, src, o); YD.dmg.push([performance.now(), Math.max(0, d || dmg)]); m.lastHit = G.time; if (m.hp < m.maxHp * 0.5) m.hp = m.maxHp; m.dead = false; return d; };
    G.mobs.push(m); dummies.push(m);
  }
}
function dummyUpdate(dt) {
  const m = this; m.dead = false;
  if (m.walk) { m.walk.a += dt * 0.35; m.pos.x = 24 + Math.sin(m.walk.a) * 12; m.yaw = Math.cos(m.walk.a) > 0 ? Math.PI / 2 : -Math.PI / 2; }
  for (const k in m.status) if (typeof m.status[k] === 'number' && m.status[k] > 0 && k !== 'knock') m.status[k] = Math.max(0, m.status[k] - dt);
  if (m.status.knock && m.status.knock.lengthSq && m.status.knock.lengthSq() > 0) { m.status.knock.set(0, 0, 0); m.pos.x = m.walk ? m.pos.x : m.home.x; m.pos.z = m.home.z; }
  if (G.time - (m.lastHit || -99) > 3) m.hp = m.maxHp;
  m.pos.y = heightAt(m.pos.x, m.pos.z); m.root.position.copy(m.pos); m.root.rotation.y = m.yaw;
  m.animate(dt, { speed: m.walk ? 1.5 : 0, action: null, actionT: 0 });
}
// damage per second over the last 8 seconds, and cheats while training
export function updateYard(dt) {
  G.zoneLabel = 'Training Yard<small>Every class · every weapon</small>'; const tr = document.getElementById('tracker'); if (tr && !tr.hidden) tr.hidden = true;
  const now = performance.now(); while (YD.dmg.length && now - YD.dmg[0][0] > 8000) YD.dmg.shift();
  const tot = YD.dmg.reduce((a, b) => a + b[1], 0), span = YD.dmg.length ? Math.max(1, (now - YD.dmg[0][0]) / 1000) : 1;
  let e = document.getElementById('yardhud'); if (!e) { e = document.createElement('div'); e.id = 'yardhud'; document.getElementById('hud').appendChild(e); }
  const h = G.save, html = `<b>Training Yard</b><span>${CLASSES[h.cls].name} · level ${h.level}</span><span class="dps">DPS <b>${YD.dmg.length ? Math.round(tot / span) : 0}</b></span><small><kbd>Y</kbd> class & weapon · <kbd>K</kbd> abilities · <kbd>L</kbd> weapon moves</small>`;
  if (e._h !== html) { e.innerHTML = html; e._h = html; }
  const P = G.player; if (P && YD.infinite) { P.mana = P.maxMana; P.end = P.maxEnd; }
}
export function resetCooldowns() { const P = G.player; if (P) for (const k in P.cd) P.cd[k] = 0; }

// the hero for a class: top level, the class weapon to start, every ability unlocked
export function yardHero(cls, keep) {
  const h = Game.newHero({ name: keep ? keep.name : 'Trainee', race: keep ? keep.race : 'human', cls, sex: keep ? keep.sex : 'm', app: keep ? keep.app : { skin: '#e0ac85', hair: '#5a3a1e', hairStyle: 1, beard: 0, height: 1, build: 0 } });
  h.level = LEVEL_CAP; h.introDone = true; h.gold = 0; h.yard = true; h.equip.chest = null; h.equip.legs = null;
  const w1 = h.equip.w1; if (w1) Object.assign(w1, Game.makeWeapon(w1.wt, 5, 3), { uid: w1.uid }); if (h.equip.w2) Object.assign(h.equip.w2, Game.makeWeapon(h.equip.w2.wt, 5, 3));
  h.hotbar = null; Game.autoFillHotbar(h);
  return h;
}
// weapons you can pick: everything except a lone shield
const PICK = () => Object.keys(WEAPON_TYPES).filter(w => w !== 'shield');
export function openYardPanel(UI) {
  const c = UI.openWin('yard', 'Training Yard', '', 'big yardwin'), h = G.save;
  const render = () => {
    c.innerHTML = '';
    c.appendChild(el('h3', '', 'Class <small>everyone is level ' + LEVEL_CAP + ' with every ability</small>'));
    const cg = el('div', 'ygrid');
    for (const k of Object.keys(CLASSES)) { const b = el('button', 'ycls' + (G.save.cls === k ? ' on' : ''), `<b>${CLASSES[k].name}</b><small>${ABILITIES[k].length} abilities</small>`); b.onclick = () => { S.click(); const nh = yardHero(k, G.save); UI.closeWin(); YD.startGame(nh); }; cg.appendChild(b); }
    c.appendChild(cg);
    c.appendChild(el('h3', '', 'Weapon <small>any weapon, every attack unlocked</small>'));
    const wg = el('div', 'ygrid w');
    for (const wt of PICK()) { const it = Game.makeWeapon(wt, 5, 3); const act = Game.activeWeapon(G.save); const b = el('button', 'ywpn' + (act && act.wt === wt ? ' on' : ''), `<div class="bi">${Icons.itemSvg(it)}</div><b>${WEAPON_TYPES[wt].name}</b>`);
      b.onclick = () => { S.click(); const hh = G.save; hh.equip.w1 = Object.assign(it, { name: 'Training ' + WEAPON_TYPES[wt].name, size: 1 }); hh.equip.w2 = wt === 'swordshield' || wt === 'maceshield' ? null : null; hh.active = 'w1'; G.player.refreshGear(); render(); };
      wg.appendChild(b); }
    c.appendChild(wg);
    const row = el('div', 'yrow');
    const t1 = el('button', 'btn', 'Reset cooldowns'); t1.onclick = () => { S.click(); resetCooldowns(); };
    const t2 = el('button', 'btn' + (YD.infinite ? ' gold' : ''), YD.infinite ? 'Unlimited mana & endurance: on' : 'Unlimited mana & endurance: off'); t2.onclick = () => { S.click(); YD.infinite = !YD.infinite; render(); };
    const t3 = el('button', 'btn', 'Clear DPS'); t3.onclick = () => { S.click(); YD.dmg.length = 0; };
    const t4 = el('button', 'btn red', 'Leave the yard'); t4.onclick = () => { location.href = location.pathname; };
    row.append(t1, t2, t3, t4); c.appendChild(row);
  };
  render();
}
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
