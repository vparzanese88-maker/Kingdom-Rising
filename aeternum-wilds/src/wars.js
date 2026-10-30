// Kingdom Wars: blue town against red town at either end of a straight road. Each town sends waves of soldiers
// marching down the road (a little slower than you run); they fight whatever they meet. You fight beside your own
// army, recruit more soldiers with war gold (B), order them to advance or hold the gate (G), and win by killing
// the Red King in his town. Lose your own king and the war is lost.
import * as THREE from 'three';
import { G } from './state.js';
import { ZONES } from './data.js';
import { TOWNS, townPt, heightAt, walkable, collide } from './world.js';
import { makeHumanoid, makeWeapon } from './models.js';
import { animHumanoid } from './anim.js';
import { spawnEnemy, slayEnemy } from './enemies.js';
import { TOWN_SPAWN } from './player.js';
import { burst } from './fx.js';
import { floatText, toast } from './ui.js';
import { sfx } from './audio.js';
import { angDiff } from './util.js';

const BLUE = TOWNS[0], RED = TOWNS[1];
const SPEED = 5.3;            // soldiers march a little slower than the player runs (6.2)
const SIGHT = 14;             // how far a soldier notices an enemy
const WAVE_EVERY = 30, MAX_SIDE = 28, RECRUIT_COST = 40;
const KING_AT = [0, 18];      // the king stands in the square in front of the campfire, facing the gate

let allies = [], redKing = null, blueKing = null;
let waveT = 6, wave = 0, gold = 50, goldT = 0, scanT = 0, hudT = 0, over = false, orders = 'advance', hud = null;

const lv = () => G.p.level;
const hpMult = l => 1.6 + 0.3 * (l - 1), dmgMult = l => 1.4 + 0.24 * (l - 1);
const dist = (a, b) => Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);

// a marching route from town A to the enemy king in town B; o: the soldier's place across the double-wide road
function route(A, B, o) {
  return [townPt(A, o, 30), townPt(A, o, 50), townPt(B, -o, 50), townPt(B, -o * 0.5, 30), townPt(B, KING_AT[0], KING_AT[1])];
}
function holdRoute(A, o) { return [townPt(A, o, 30), townPt(A, o * 1.6, 62)]; }
// next step along a route, or null at the end
function steer(u, m) {
  while (m.i < m.path.length) {
    const [x, z] = m.path[m.i], dx = x - u.pos.x, dz = z - u.pos.z, d = Math.hypot(dx, dz);
    if (d < (m.i === m.path.length - 1 ? 1.5 : 3)) { m.i++; continue; }
    return [dx / d, dz / d];
  }
  return null;
}

// ---------- Blue soldiers ----------
const BLUE_LOOKS = {
  soldier: { name: 'Blue Footman', skin: 0xe0ac84, shirt: 0x1e3c8a, pants: 0x2a2a3a, hair: 0x5a3a1e, weapon: 'cutlass', hp: 100, dmg: 12 },
  archer: { name: 'Blue Archer', skin: 0xc68b5e, shirt: 0x2a4a9a, pants: 0x2a2a3a, hair: 0x2a1a10, weapon: 'bow', hp: 65, dmg: 11, ranged: 12 },
  king: { name: 'Your King', skin: 0xf1c9a5, shirt: 0x0a2a6a, pants: 0x1a1a2a, hair: 0x9a9a9a, helm: 0xd8b040, weapon: 'greatsword', hp: 1000, dmg: 20, size: 1.6 },
};
function spawnAlly(kind, x, z, path) {
  const L = BLUE_LOOKS[kind], l = lv();
  const model = makeHumanoid({ skin: L.skin, shirt: L.shirt, pants: L.pants, hair: L.hair, helm: L.helm, size: L.size || 1 });
  const w = makeWeapon(L.weapon);
  if (L.weapon === 'bow') model.parts.handL.add(w); else model.parts.handR.add(w);
  G.scene.add(model.root);
  const hp = Math.round(L.hp * hpMult(l) * (kind === 'king' ? 1.4 : 1));
  const u = { kind, L, model, pos: { x, z }, y: heightAt(x, z), facing: Math.PI / 2, hp, maxHp: hp,
    dmg: L.dmg * dmgMult(l) * 0.85, radius: 0.5 * (L.size || 1), ranged: L.ranged || 0, atkCd: 0.5 + Math.random(), strike: 0, phase: Math.random() * 6, move: 0,
    flash: 0, target: null, dead: false, march: path ? { path, i: 0 } : null, home: { x, z }, lastHurt: -99 };
  u.plate = document.createElement('div'); u.plate.className = 'plate pet' + (kind === 'king' ? ' king' : '');
  u.plate.innerHTML = `<div class="pn">${L.name}</div><div class="pb"><div></div></div>`;
  document.getElementById('floaters').appendChild(u.plate);
  allies.push(u);
  return u;
}
function hitEnemy(e, dmg, u) {
  if (e.dead) return;
  e.hp -= dmg; e.hitFlash = 0.12; e.aggro = true; e.lastHit = G.time;
  if (!e.petTarget || e.petTarget.dead) e.petTarget = u;
  if (Math.hypot(e.pos.x - G.player.pos.x, e.pos.z - G.player.pos.z) < 35) floatText({ x: e.pos.x, z: e.pos.z, y: e.y + 1.6 * e.size }, `${Math.round(dmg)}`, 'pet');
  if (e.hp <= 0) slayEnemy(e);
}
function nearestRed(u, r) {
  let best = null, bd = r;
  for (const e of G.enemies) { if (e.dead || !e.team) continue; const d = dist(u, e); if (d < bd) { bd = d; best = e; } }
  return best;
}
function updateAlly(u, dt) {
  u.atkCd -= dt; u.strike -= dt; u.flash -= dt;
  if (u.target && (u.target.dead || dist(u, u.target) > SIGHT + 6)) u.target = null;
  let mvx = 0, mvz = 0, stop = 0;
  if (u.target) {
    const e = u.target, dx = e.pos.x - u.pos.x, dz = e.pos.z - u.pos.z, d = Math.hypot(dx, dz) || 0.01;
    stop = u.ranged ? u.ranged : 1.2 + e.radius + u.radius;
    if (d > stop) { mvx = dx / d; mvz = dz / d; }
    u.facing += angDiff(u.facing, Math.atan2(dx, dz)) * Math.min(1, dt * 10);
    if (d <= stop + 0.5 && u.atkCd <= 0) {
      u.atkCd = u.ranged ? 1.9 : 1.3; u.strike = 0.3;
      if (u.ranged) for (let k = 1; k < 5; k++) burst(u.pos.x + dx * k / 5, u.y + 1.4, u.pos.z + dz * k / 5, 0xffe0a0, 1, 0.5, 0.25);
      else burst(e.pos.x, e.y + 1, e.pos.z, 0xb02020, 4, 3, 0.3);
      hitEnemy(e, u.dmg, u);
    }
  } else if (u.kind === 'king') {
    const dx = u.home.x - u.pos.x, dz = u.home.z - u.pos.z, d = Math.hypot(dx, dz);
    if (d > 1) { mvx = dx / d; mvz = dz / d; } else u.facing += angDiff(u.facing, Math.PI / 2) * Math.min(1, dt * 3); // watching the road
    if (G.time - u.lastHurt > 8) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.01 * dt);
  } else if (u.march) {
    const m = steer(u, u.march);
    if (m) { [mvx, mvz] = m; }
  }
  let moving = false;
  if (mvx || mvz) {
    for (const o of allies) {
      if (o === u || o.dead) continue;
      const ox = u.pos.x - o.pos.x, oz = u.pos.z - o.pos.z, od = Math.hypot(ox, oz), mm = u.radius + o.radius + 0.4;
      if (od < mm && od > 0.01) { mvx += ox / od * 0.7; mvz += oz / od * 0.7; }
    }
    const ml = Math.hypot(mvx, mvz) || 1;
    const nx = u.pos.x + mvx / ml * SPEED * dt, nz = u.pos.z + mvz / ml * SPEED * dt;
    if (walkable(nx, nz)) [u.pos.x, u.pos.z] = collide(nx, nz, u.radius);
    if (!u.target) u.facing += angDiff(u.facing, Math.atan2(mvx, mvz)) * Math.min(1, dt * 8);
    u.phase += dt * SPEED * 1.6; moving = true;
  }
  u.move += ((moving ? 1 : 0) - u.move) * Math.min(1, dt * 8);
  u.y = heightAt(u.pos.x, u.pos.z);
  u.model.root.position.set(u.pos.x, u.y, u.pos.z);
  u.model.root.rotation.y = u.facing;
  animHumanoid(u.model, { move: u.move, phase: u.phase, pose: u.strike > 0 ? (u.ranged ? 'aim' : 'slash') : null, t: 1 - u.strike / 0.3, twoHand: u.kind === 'king' });
  for (const m of u.model.mats) m.emissive.setHex(u.flash > 0 ? 0x552222 : 0);
  // health plate
  const P = G.player, near = Math.hypot(u.pos.x - P.pos.x, u.pos.z - P.pos.z) < (u.kind === 'king' ? 60 : 30);
  v3.set(u.pos.x, u.y + 2.3 * (u.L.size || 1), u.pos.z).project(G.camera);
  if (v3.z > 1 || !near) u.plate.style.display = 'none';
  else {
    u.plate.style.display = '';
    u.plate.style.transform = `translate(${(v3.x + 1) / 2 * innerWidth}px,${(1 - v3.y) / 2 * innerHeight}px) translate(-50%,-100%)`;
    u.plate.querySelector('.pb div').style.width = `${Math.max(0, u.hp / u.maxHp) * 100}%`;
  }
}
const v3 = new THREE.Vector3();

// ---------- Red soldiers (real enemies: you can fight them with everything you have) ----------
function spawnRed(type, x, z, path) {
  const e = spawnEnemy(type, x, z, lv());
  e.team = 'red'; e.march = { path, i: 0 };
  e.facing = -Math.PI / 2;
  return e;
}
// enemies.js asks this which way a marching red soldier (or the guarding Red King) walks
G.warsMarch = e => {
  if (e.march.home) {
    const dx = e.home.x - e.pos.x, dz = e.home.z - e.pos.z, d = Math.hypot(dx, dz);
    if (d > 1.5) return [dx / d, dz / d];
    e.facing += angDiff(e.facing, -Math.PI / 2) * 0.1;
    return null;
  }
  return steer(e, e.march);
};

// ---------- Waves ----------
const sideCount = blue => blue ? allies.filter(u => !u.dead && u.kind !== 'king').length : G.enemies.filter(e => !e.dead && e.team && e !== redKing).length;
function sendWave() {
  wave++;
  const n = Math.min(6, 3 + Math.floor(wave / 3)), archers = 1 + Math.floor(wave / 4);
  for (let i = 0; i < n + archers; i++) {
    const o = ((i % 4) - 1.5) * 2, back = Math.floor(i / 4) * 2.5, archer = i >= n;
    if (sideCount(true) < MAX_SIDE) { const [x, z] = townPt(BLUE, o, 24 - back); spawnAlly(archer ? 'archer' : 'soldier', x, z, orders === 'hold' ? holdRoute(BLUE, o) : route(BLUE, RED, o)); }
    if (sideCount(false) < MAX_SIDE) { const [x, z] = townPt(RED, o, 24 - back); spawnRed(archer ? 'redArcher' : 'redSoldier', x, z, route(RED, BLUE, o)); }
  }
  toast(`Wave ${wave}: both kings send their soldiers down the road`, 'gold');
  sfx('roar', 0.3);
}
function recruit() {
  if (over) return;
  if (gold < RECRUIT_COST) { toast(`Recruiting costs ${RECRUIT_COST} war gold (you have ${Math.floor(gold)})`, 'warn'); return; }
  if (sideCount(true) >= MAX_SIDE) { toast('Your army is at full strength', 'warn'); return; }
  gold -= RECRUIT_COST;
  for (const o of [-2, 0, 2]) { const [x, z] = townPt(BLUE, o, 26); spawnAlly('soldier', x, z, orders === 'hold' ? holdRoute(BLUE, o) : route(BLUE, RED, o)); }
  toast('Three footmen join your army', 'gold'); sfx('magic', 0.4);
}
function toggleOrders() {
  if (over) return;
  orders = orders === 'advance' ? 'hold' : 'advance';
  for (const u of allies) {
    if (u.dead || u.kind === 'king') continue;
    const o = ((allies.indexOf(u) % 4) - 1.5) * 2;
    const p = orders === 'hold' ? holdRoute(BLUE, o) : route(BLUE, RED, o);
    // pick up the route at the nearest point ahead
    let bi = 0, bd = 1e9; p.forEach(([x, z], i) => { const d = Math.hypot(x - u.pos.x, z - u.pos.z); if (d < bd) { bd = d; bi = i; } });
    u.march = { path: p, i: bi };
  }
  toast(orders === 'hold' ? 'Orders: hold outside our gate' : 'Orders: advance on the Red King', 'gold');
}

// who fights whom: soldiers lock on to the nearest enemy in sight (kings defend their square)
function scan() {
  const P = G.player, pdead = P.state === 'dead';
  for (const u of allies) if (!u.dead && !u.target) u.target = nearestRed(u, u.kind === 'king' ? 11 : SIGHT);
  for (const e of G.enemies) {
    if (e.dead || !e.team || (e.petTarget && !e.petTarget.dead)) continue;
    let best = null, bd = e === redKing ? 11 : SIGHT;
    for (const u of allies) { if (u.dead) continue; const d = dist(u, e); if (d < bd) { bd = d; best = u; } }
    if (!best) continue;
    const pd = Math.hypot(P.pos.x - e.pos.x, P.pos.z - e.pos.z);
    if (e.aggro && !pdead && pd < bd + 2) continue; // already busy with the player, who is closer
    e.petTarget = best; e.aggro = true;
  }
}

// ---------- HUD and the end ----------
function bar(u) { return `<i style="width:${u ? Math.max(0, u.hp / u.maxHp) * 100 : 0}%"></i>`; }
function drawHud() {
  if (!hud) return;
  hud.innerHTML = `<div class="wk blue"><b>Your King</b><span class="kb">${bar(blueKing)}</span><small>${sideCount(true)} soldiers</small></div>
    <div class="wmid"><b>Wave ${wave}</b><small>next in ${Math.ceil(waveT)}s</small><small>🪙 ${Math.floor(gold)} war gold</small>
      <small><kbd>B</kbd> Recruit (${RECRUIT_COST}) · <kbd>G</kbd> ${orders === 'advance' ? 'Advancing' : 'Holding the gate'}</small></div>
    <div class="wk red"><b>The Red King</b><span class="kb">${bar(redKing)}</span><small>${sideCount(false)} soldiers</small></div>`;
}
function endWar(won) {
  if (over) return;
  over = true;
  if (won) { G.p.stats.bosses++; }
  window.saveGame?.();
  G.unlock?.(); G.noLockNeeded = true;
  const el = document.createElement('div'); el.id = 'warsend';
  el.innerHTML = `<div class="scroll"><h1>${won ? 'Victory' : 'Defeat'}</h1>
    <p>${won ? 'The Red King has fallen and his soldiers throw down their arms. The road is yours.' : 'Your king has fallen. The red banners fly over your town.'}</p>
    <p class="vstats">${wave} waves · Level ${G.p.level}</p>
    <div class="row"><button id="wagain" class="primary">Fight again</button><button id="wtitle">Back to the title</button></div></div>`;
  document.body.appendChild(el);
  el.querySelector('#wagain').onclick = () => { window.skipSave = true; location.reload(); };
  el.querySelector('#wtitle').onclick = () => { window.skipSave = true; location.href = location.pathname + '?mode=wars'; };
  sfx(won ? 'levelup' : 'death');
}

// ---------- Start and per-frame ----------
export function startWars() {
  Object.assign(ZONES.meadow, { name: 'The King\'s Road', sub: 'Battlefield' }); Object.assign(ZONES.town, { name: 'Walled Town', sub: 'Defend your king' });
  G.wars = { recruit, toggleOrders };
  // you spawn and respawn in your own town, beside your king
  [TOWN_SPAWN.x, TOWN_SPAWN.z] = townPt(BLUE, 5, 14);
  G.player.pos.x = TOWN_SPAWN.x; G.player.pos.z = TOWN_SPAWN.z;
  G.player.yaw = Math.PI / 2; G.player.facing = Math.PI / 2; // looking down the road at the enemy
  blueKing = spawnAlly('king', ...townPt(BLUE, ...KING_AT), null);
  blueKing.facing = Math.PI / 2;
  blueKing.onDeath = () => endWar(false);
  const [rx, rz] = townPt(RED, ...KING_AT);
  redKing = spawnEnemy('redKing', rx, rz, lv() + 2);
  redKing.team = 'red'; redKing.march = { home: true }; redKing.facing = -Math.PI / 2;
  G.onPlayerKill = e => { if (e.def.minion) { gold += 5; } };
  G.warsTarget = () => redKing && !redKing.dead ? { x: redKing.pos.x, z: redKing.pos.z, label: 'The Red King' } : null;
  hud = document.createElement('div'); hud.id = 'warshud';
  document.getElementById('hud').appendChild(hud);
  drawHud();
  setTimeout(() => toast('Kingdom Wars: kill the Red King at the far end of the road, and keep your own king alive. <kbd>B</kbd> recruits soldiers, <kbd>G</kbd> switches between advancing and holding the gate.', 'gold'), 900);
}
export function updateWars(dt) {
  if (over) { for (const u of allies) if (!u.dead) updateAlly(u, 0); return; }
  waveT -= dt; if (waveT <= 0) { waveT = WAVE_EVERY; sendWave(); }
  goldT += dt; if (goldT >= 1.5) { goldT = 0; gold += 1; }
  scanT -= dt; if (scanT <= 0) { scanT = 0.25; scan(); }
  for (const u of allies) if (!u.dead) updateAlly(u, dt);
  allies = allies.filter(u => !u.dead);
  // a red soldier hit: note it so the king can heal only when left alone
  if (blueKing && !blueKing.dead && blueKing.hp < blueKing.lastHp) blueKing.lastHurt = G.time;
  if (blueKing) blueKing.lastHp = blueKing.hp;
  if (redKing.dead) endWar(true);
  hudT -= dt; if (hudT <= 0) { hudT = 0.25; drawHud(); }
}
