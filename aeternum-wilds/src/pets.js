// Summoned allies: follow the player, fight what the player fights, can be hit by enemies.
import * as THREE from 'three';
import { G } from './state.js';
import { makeHumanoid, makeBeast, makeWeapon, box, mat } from './models.js';
import { animHumanoid, animBeast } from './anim.js';
import { heightAt, walkable, collide } from './world.js';
import { burst } from './fx.js';
import { stats } from './stats.js';
import { enemiesNear } from './enemies.js';
import { floatText } from './ui.js';
import { sfx } from './audio.js';
import { angDiff } from './util.js';

const LOOKS = {
  skeleton: { name: 'Skeleton', model: 'h', skin: 0xe8e0c8, shirt: 0xd8d0b8, pants: 0xc8c0a8, eyes: 0x6ad0ff, weapon: 'cutlass', speed: 6 },
  zombie: { name: 'Zombie', model: 'h', skin: 0x7a8a5a, shirt: 0x4a4a3a, pants: 0x3a3a2a, eyes: 0xc0ff5a, hunched: true, speed: 4.8 },
  wolf: { name: 'Wolf', model: 'wolf', color: 0x8a8070, speed: 8 },
  bear: { name: 'Bear', model: 'boar', color: 0x5a3a22, size: 1.5, speed: 6.5 },
  spirit: { name: 'Spirit Wolf', model: 'wolf', color: 0x6ab0ff, eyes: 0xffffff, glow: 0x2050a0, speed: 8.5 },
  spider: { name: 'Spider', model: 'wolf', color: 0x1a1a1a, eyes: 0xff2020, size: 0.8, speed: 7.5 },
  elemental_fire: { name: 'Fire Elemental', model: 'h', skin: 0xff6a1a, shirt: 0xd04010, pants: 0xa03010, eyes: 0xffff80, glow: 0x802000, speed: 6, ranged: true, color: 0xff7a2a },
  elemental_earth: { name: 'Earth Elemental', model: 'h', skin: 0x7a6a50, shirt: 0x5a4a38, pants: 0x4a3a2a, eyes: 0xffc040, size: 1.4, speed: 5 },
  golem: { name: 'Stone Golem', model: 'h', skin: 0x8a8a84, shirt: 0x6a6a64, pants: 0x5a5a54, eyes: 0x6ad0ff, size: 1.7, speed: 4.8 },
  treant: { name: 'Treant', model: 'h', skin: 0x5a4028, shirt: 0x4a6a2e, pants: 0x4a3420, eyes: 0xa0ff60, size: 1.5, speed: 4.5 },
};

export function petCount() { return G.pets.filter(p => !p.dead).length; }

export function spawnPet(type, o) {
  const L = LOOKS[type] || LOOKS.skeleton;
  const P = G.player;
  // at most 4 pets at a time: dismiss the oldest
  const alive = G.pets.filter(p => !p.dead);
  if (alive.length >= 4) killPet(alive[0]);
  let model;
  if (L.model === 'h') model = makeHumanoid({ skin: L.skin, shirt: L.shirt, pants: L.pants, eyes: L.eyes, size: L.size || 1, hunched: L.hunched });
  else model = makeBeast(L.model, { color: L.color, size: L.size || 1, eyes: L.eyes });
  if (L.weapon) model.parts.handR.add(makeWeapon(L.weapon));
  if (L.glow) for (const m of model.mats) m.emissive.setHex(L.glow);
  const a = Math.random() * 6.28;
  const x = P.pos.x + Math.cos(a) * 2, z = P.pos.z + Math.sin(a) * 2;
  model.root.position.set(x, heightAt(x, z), z);
  G.scene.add(model.root);
  const s = stats();
  const hp = Math.round(s.maxHp * (o.hp || 0.8) * (1 + (s.mods.petHp || 0)));
  const pet = { type, L, model, pos: { x, z }, y: heightAt(x, z), facing: P.yaw, hp, maxHp: hp, dmgMult: o.dmg || 0.5, ranged: o.ranged || L.ranged,
    until: o.dur ? G.time + o.dur : Infinity, atkCd: 0.5, phase: 0, move: 0, strike: 0, target: null, radius: 0.5 * (L.size || 1), dead: false, src: o.id };
  G.pets.push(pet);
  burst(x, pet.y + 1, z, L.color || L.eyes || 0x9ad0ff, 20, 3, 0.7);
  sfx('magic', 0.6);
  // a small health bar over the pet
  pet.plate = document.createElement('div'); pet.plate.className = 'plate pet';
  pet.plate.innerHTML = `<div class="pn">${L.name}</div><div class="pb"><div></div></div>`;
  document.getElementById('floaters').appendChild(pet.plate);
  return pet;
}

export function hurtPet(pet, dmg) {
  if (pet.dead) return;
  pet.hp -= dmg;
  pet.flash = 0.12;
  floatText({ x: pet.pos.x, z: pet.pos.z, y: pet.y + 2 }, `-${Math.round(dmg)}`, 'hurt');
  if (pet.hp <= 0) killPet(pet);
}
export function killPet(pet) {
  if (pet.dead) return;
  pet.dead = true;
  burst(pet.pos.x, pet.y + 1, pet.pos.z, 0x9a9a9a, 16, 3, 0.6);
  G.scene.remove(pet.model.root);
  pet.plate.remove();
  for (const e of G.enemies) if (e.petTarget === pet) e.petTarget = null;
}
export function clearPets() { for (const p of G.pets) killPet(p); G.pets.length = 0; }

const v3 = new THREE.Vector3();
export function updatePets(dt, spellPowerFn) {
  const P = G.player, s = stats();
  for (let i = G.pets.length - 1; i >= 0; i--) {
    const pet = G.pets[i];
    if (pet.dead) { G.pets.splice(i, 1); continue; }
    if (G.time > pet.until || P.state === 'dead') { killPet(pet); continue; }
    pet.atkCd -= dt; pet.strike -= dt; pet.flash -= dt;
    // pick a target: what the player is fighting, else whatever is attacking the player
    if (!pet.target || pet.target.dead || Math.hypot(pet.target.pos.x - P.pos.x, pet.target.pos.z - P.pos.z) > 30) {
      pet.target = null;
      let best = 1e9;
      for (const e of enemiesNear(P.pos.x, P.pos.z, 22)) {
        if (e.dead || !(e.aggro || G.time - (e.lastHit || -99) < 5)) continue;
        const d = Math.hypot(e.pos.x - pet.pos.x, e.pos.z - pet.pos.z);
        if (d < best) { best = d; pet.target = e; }
      }
    }
    let tx, tz, stop;
    if (pet.target) { tx = pet.target.pos.x; tz = pet.target.pos.z; stop = pet.ranged ? 9 : 1.4 + pet.target.radius + pet.radius; }
    else {
      const k = G.pets.indexOf(pet);
      const side = (k % 2 ? 1 : -1) * (1.6 + Math.floor(k / 2));
      tx = P.pos.x - Math.sin(P.yaw) * 2.2 + Math.cos(P.yaw) * side; tz = P.pos.z - Math.cos(P.yaw) * 2.2 - Math.sin(P.yaw) * side;
      stop = 0.8;
    }
    const dx = tx - pet.pos.x, dz = tz - pet.pos.z, d = Math.hypot(dx, dz);
    let moving = false;
    if (d > stop) {
      const sp = pet.L.speed * (pet.target ? 1 : Math.min(1.6, 0.6 + d / 6));
      const nx = pet.pos.x + dx / d * sp * dt, nz = pet.pos.z + dz / d * sp * dt;
      if (walkable(nx, nz)) [pet.pos.x, pet.pos.z] = collide(nx, nz, pet.radius);
      pet.phase += dt * sp * (pet.model.beast ? 2.2 : 1.6);
      moving = true;
      // teleport back if left far behind
      if (!pet.target && d > 40) { pet.pos.x = P.pos.x; pet.pos.z = P.pos.z; }
    }
    if (d > 0.01) pet.facing += angDiff(pet.facing, Math.atan2(dx, dz)) * Math.min(1, dt * 10);
    pet.move += ((moving ? 1 : 0) - pet.move) * Math.min(1, dt * 8);
    // attack
    if (pet.target && d <= stop + 0.5 && pet.atkCd <= 0) {
      pet.atkCd = pet.ranged ? 1.6 : 1.2;
      pet.strike = 0.3;
      const dmg = spellPowerFn() * pet.dmgMult * (1 + (s.mods.petDmg || 0));
      const e = pet.target;
      if (pet.ranged) {
        burst(e.pos.x, e.y + 1.2, e.pos.z, pet.L.color || 0xff7a2a, 10, 3, 0.4);
        for (let k = 0; k < 4; k++) burst(pet.pos.x + (e.pos.x - pet.pos.x) * k / 4, pet.y + 1.4, pet.pos.z + (e.pos.z - pet.pos.z) * k / 4, pet.L.color || 0xff7a2a, 2, 1, 0.3);
      } else burst(e.pos.x, e.y + 1, e.pos.z, 0xb02020, 5, 3, 0.3);
      damageEnemyByPet(e, dmg, pet);
    }
    // place and animate
    pet.y = heightAt(pet.pos.x, pet.pos.z);
    pet.model.root.position.set(pet.pos.x, pet.y, pet.pos.z);
    pet.model.root.rotation.y = pet.facing;
    if (pet.model.beast) animBeast(pet.model, { move: pet.move, phase: pet.phase, pose: pet.strike > 0 ? 'strike' : null, t: 1 - pet.strike / 0.3 });
    else animHumanoid(pet.model, { move: pet.move, phase: pet.phase, pose: pet.strike > 0 ? (pet.ranged ? 'cast' : 'slash') : null, t: 1 - pet.strike / 0.3 });
    if (pet.flash > 0) for (const m of pet.model.mats) m.emissive.setHex(0x552222);
    else if (pet.L.glow) for (const m of pet.model.mats) m.emissive.setHex(pet.L.glow);
    else for (const m of pet.model.mats) m.emissive.setHex(0);
    // plate
    v3.set(pet.pos.x, pet.y + 2.2 * (pet.L.size || 1), pet.pos.z).project(G.camera);
    if (v3.z > 1 || Math.hypot(pet.pos.x - P.pos.x, pet.pos.z - P.pos.z) > 30) pet.plate.style.display = 'none';
    else {
      pet.plate.style.display = '';
      pet.plate.style.transform = `translate(${(v3.x + 1) / 2 * innerWidth}px,${(1 - v3.y) / 2 * innerHeight}px) translate(-50%,-100%)`;
      pet.plate.querySelector('.pb div').style.width = `${Math.max(0, pet.hp / pet.maxHp) * 100}%`;
    }
  }
}

// set by enemies.js to avoid a circular import at load time
let dmgHook = null;
export function setPetDamageHook(fn) { dmgHook = fn; }
function damageEnemyByPet(e, dmg, pet) { if (dmgHook) dmgHook(e, dmg, pet); }
