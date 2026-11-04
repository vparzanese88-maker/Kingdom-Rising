// Town guards: armoured soldiers who walk their rounds and cut down any beast or goblin that comes into town.
// A small village has 2, an outpost 2 or 3, a big town 8. A kill by a guard gives you nothing.
import * as THREE from 'three';
import { G } from './state.js';
import { buildHumanoid, equipWeapon, animateHumanoid, setDetail, bake } from './character.js';
import { heightAt } from './terrain.js';
import { foe } from './combat.js';
import { V } from './vfx.js';
import { S } from './audio.js';

export const guards = [];
const isGuard = { isGuard: true, name: 'Town Guard', pos: new THREE.Vector3() };
// settlements: where they are, how far the guards watch, how many guards, tabard colour
export function spawnGuards(towns) {
  for (const T of towns) for (let i = 0; i < T.n; i++) {
    const a = i / T.n * Math.PI * 2, r = T.r * 0.55;
    const ch = buildHumanoid({ race: 'human', sex: i % 3 === 2 ? 'f' : 'm', cls: 'warrior', outfit: 'warrior', skin: ['#e0ac85', '#c08e68', '#f1c7a5', '#8a6448'][i % 4], hair: ['#2a1a10', '#5a3a1e', '#8a8a8a'][i % 3], hairStyle: 1, beard: i % 2, height: 0.95 + (i % 3) * 0.04, build: 1 });
    ch.root.traverse(o => { if (o.isMesh && o.material && o.material.color && o.name === 'tabard') { o.material = o.material.clone(); o.material.color.set(T.col); } });
    equipWeapon(ch, i % 3 === 1 ? 'spear' : 'swordshield', 2); bake(ch.root); G.scene.add(ch.root);
    const g = { ch, town: T, pos: new THREE.Vector3(T.x + Math.cos(a) * r, 0, T.z + Math.sin(a) * r), yaw: a, post: a, tgt: null, cd: 0, act: null, actT: 0, wait: Math.random() * 4 };
    g.pos.y = heightAt(g.pos.x, g.pos.z); guards.push(g);
  }
}
export function updateGuards(dt, player) {
  for (const g of guards) {
    const T = g.town; g.cd -= dt;
    // anything hostile inside the town (or just outside its edge) is fair game
    if (g.tgt && (g.tgt.dead || Math.hypot(g.tgt.pos.x - T.x, g.tgt.pos.z - T.z) > T.r + 16)) g.tgt = null;
    if (!g.tgt && (g.look = (g.look || 0) - dt) <= 0) { g.look = 0.5; let bd = 1e9;
      for (const m of G.mobs) { if (m.dead || m.pet || m.team != null || !foe(m) || m.def.aggro <= 0 && !m.provoked) continue; const dT = Math.hypot(m.pos.x - T.x, m.pos.z - T.z); if (dT > T.r + 10) continue; const d = Math.hypot(m.pos.x - g.pos.x, m.pos.z - g.pos.z); if (d < bd) { bd = d; g.tgt = m; } } }
    let want = null, speed = 0;
    if (g.tgt) { const t = g.tgt, d = Math.hypot(t.pos.x - g.pos.x, t.pos.z - g.pos.z) - (t.radius || 0.5);
      if (d > 1.6) { want = t.pos; speed = 5.5; }
      else if (g.cd <= 0) { g.cd = 1.0; g.act = 'swing2'; g.actT = 0; S.swing(1.1, g.pos);
        isGuard.pos.copy(g.pos); t.takeHit(Math.max(30, t.maxHp * 0.3), isGuard, { melee: true, knock: t.pos.clone().sub(g.pos).setY(0).normalize().multiplyScalar(4) }); V.burst('spark', t.pos.clone().setY(t.pos.y + 1), 8, { speed: 3 }); }
      g.yaw = Math.atan2(t.pos.x - g.pos.x, t.pos.z - g.pos.z);
    } else { // walk the rounds: from post to post around the town
      const r = T.r * 0.55, px = T.x + Math.cos(g.post) * r, pz = T.z + Math.sin(g.post) * r, d = Math.hypot(px - g.pos.x, pz - g.pos.z);
      if (d > 0.6) { want = new THREE.Vector3(px, 0, pz); speed = 1.5; } else if ((g.wait -= dt) <= 0) { g.post += (Math.PI * 2 / Math.max(3, T.n * 2)) * (g.ch.root.id % 2 ? 1 : -1); g.wait = 3 + Math.random() * 5; }
    }
    if (want) { const dx = want.x - g.pos.x, dz = want.z - g.pos.z, l = Math.hypot(dx, dz); if (l > 0.05) { const mv = Math.min(l, speed * dt); g.pos.x += dx / l * mv; g.pos.z += dz / l * mv; if (!g.tgt) g.yaw = Math.atan2(dx, dz); } }
    g.pos.y = heightAt(g.pos.x, g.pos.z);
    if (g.act) { g.actT += dt / 0.55; if (g.actT >= 1) g.act = null; }
    const dp = player ? g.pos.distanceTo(player.pos) : 0; g.ch.root.visible = dp < 140; setDetail(g.ch, dp < 30);
    if (!g.ch.root.visible) continue;
    g.ch.root.position.copy(g.pos); g.ch.root.rotation.y = g.yaw;
    animateHumanoid(g.ch, dt, { speed: want ? speed : 0, action: g.act, actionT: g.actT, armed: true });
  }
}
