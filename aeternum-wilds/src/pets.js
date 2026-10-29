// Summoned allies: follow the player, fight what the player fights, can be hit by enemies.
import * as THREE from 'three';
import { G } from './state.js';
import { makeHumanoid, makeBeast, makeWeapon, box, mat } from './models.js';
import { animHumanoid, animBeast } from './anim.js';
import { heightAt, walkable, collide } from './world.js';
import { burst, shockRing, shake } from './fx.js';
import { impact } from './spellfx.js';
import { stats } from './stats.js';
import { enemiesNear } from './enemies.js';
import { floatText } from './ui.js';
import { sfx } from './audio.js';
import { angDiff } from './util.js';
import { tintModel } from './gfx/creatures/index.js';
import { dressHumanoid, updateAccessories } from './gfx/creatures/accessories.js';

// small additions on top of whatever pose the humanoid animation set (taken off again before the next one)
function addPose(h, armX, armZ = 0, lean = 0) {
  const P = h.parts; const d = (h._poseAdd = { armX, armZ, lean });
  P.armL.rotation.x += d.armX; P.armR.rotation.x += d.armX; P.armL.rotation.z += d.armZ; P.armR.rotation.z -= d.armZ; P.upper.rotation.x += d.lean;
}
function undoPose(h) {
  const d = h._poseAdd; if (!d) return; const P = h.parts;
  P.armL.rotation.x -= d.armX; P.armR.rotation.x -= d.armX; P.armL.rotation.z -= d.armZ; P.armR.rotation.z += d.armZ; P.upper.rotation.x -= d.lean; h._poseAdd = null;
}

// model: 'h' = a human body (with an overlay look from gfx/creatures/accessories.js), otherwise a creature kind
// from gfx/creatures; size is the hit size, ms the model's scale when it differs
const LOOKS = {
  skeleton: { name: 'Skeleton', model: 'h', look: 'skeleton', skin: 0xe8e0c8, shirt: 0xd8d0b8, pants: 0xc8c0a8, eyes: 0x6ad0ff, weapon: 'cutlass', speed: 6 },
  zombie: { name: 'Zombie', model: 'h', look: 'zombie', skin: 0x7a8a5a, shirt: 0x4a4a3a, pants: 0x3a3a2a, eyes: 0xc0ff5a, hunched: true, speed: 4.8 },
  wolf: { name: 'Wolf', model: 'wolf', color: 0x8a8070, speed: 8 },
  bear: { name: 'Bear', model: 'bear', color: 0x5a3a22, size: 1.5, ms: 1, speed: 6.5 },
  spirit: { name: 'Spirit Wolf', model: 'spiritwolf', color: 0x8ac8ff, eyes: 0xffffff, speed: 8.5 },
  spider: { name: 'Spider', model: 'spider', color: 0x2a2420, eyes: 0xff2020, size: 0.8, ms: 1.35, speed: 7.5 },
  elemental_fire: { name: 'Fire Elemental', model: 'fire_elemental', speed: 6, ranged: true, color: 0xff7a2a, fire: true },
  elemental_earth: { name: 'Earth Elemental', model: 'earth_elemental', size: 1.4, ms: 0.95, speed: 5 },
  golem: { name: 'Stone Golem', model: 'golem', size: 1.7, ms: 1.1, speed: 4.8 },
  flaming_skeleton: { name: 'Flaming Skeleton', model: 'h', look: 'flaming_skeleton', skin: 0x2a1a10, shirt: 0x3a2010, pants: 0x2a1a10, eyes: 0xffd060, speed: 11, fire: true },
  imp: { name: 'Imp', model: 'h', look: 'imp', skin: 0xc02a1a, shirt: 0x8a1a10, pants: 0x5a1008, eyes: 0xffff60, size: 0.65, horns: true, speed: 7, ranged: true, color: 0xff5a1a },
  ghost: { name: 'Ghost', model: 'ghost', color: 0xb8d8f0, speed: 6.5, ranged: true },
  raven: { name: 'Raven', model: 'raven', color: 0x15151c, eyes: 0xff4040, size: 0.55, ms: 1, speed: 9 },
  elemental_water: { name: 'Water Elemental', model: 'water_elemental', speed: 5.5, ranged: true, color: 0x6ac8ff },
  elemental_air: { name: 'Air Elemental', model: 'air_elemental', speed: 8, color: 0xd8ecff },
  treant: { name: 'Treant', model: 'treant', size: 1.5, ms: 1.0, speed: 4.5 },
};
const dying = [];

export function petCount() { return G.pets.filter(p => !p.dead).length; }

export function spawnPet(type, o) {
  const L = LOOKS[type] || LOOKS.skeleton;
  const P = G.player;
  // at most 4 pets at a time: dismiss the oldest
  const alive = G.pets.filter(p => !p.dead);
  if (alive.length >= 4) killPet(alive[0]);
  let model;
  if (L.model === 'h') { model = makeHumanoid({ skin: L.skin, shirt: L.shirt, pants: L.pants, eyes: L.eyes, size: L.size || 1, hunched: L.hunched, horns: L.horns }); dressHumanoid(model, L.look); }
  else model = makeBeast(L.model, { color: L.color, size: L.ms || L.size || 1, eyes: L.eyes });
  if (L.weapon) model.parts.handR.add(makeWeapon(L.weapon));
  const a = Math.random() * 6.28;
  const x = P.pos.x + Math.cos(a) * 2, z = P.pos.z + Math.sin(a) * 2;
  model.root.position.set(x, heightAt(x, z), z);
  G.scene.add(model.root);
  const s = stats();
  const hp = Math.round(s.maxHp * (o.hp || 0.8) * (1 + (s.mods.petHp || 0)));
  const pet = { type, L, model, pos: { x, z }, y: heightAt(x, z), facing: P.yaw, hp, maxHp: hp, dmgMult: o.dmg || 0.5, ranged: (o.ranged || L.ranged) && !o.bomber,
    bomber: !!o.bomber, explode: o.explode || 4, burn: o.burn || 0,
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
  // flinch away from the nearest enemy
  let best = null, bd = 1e9; for (const e of G.enemies) { if (e.dead) continue; const d = Math.hypot(e.pos.x - pet.pos.x, e.pos.z - pet.pos.z); if (d < bd) { bd = d; best = e; } }
  const dx = best ? pet.pos.x - best.pos.x : -Math.sin(pet.facing), dz = best ? pet.pos.z - best.pos.z : -Math.cos(pet.facing);
  pet.hurt = { t: 0, dx, dz, mag: Math.min(0.3, dmg / pet.maxHp + 0.05) };
  floatText({ x: pet.pos.x, z: pet.pos.z, y: pet.y + 2 }, `-${Math.round(dmg)}`, 'hurt');
  if (pet.hp <= 0) killPet(pet);
}
// a pet that dies falls and fades away (one that is dismissed or explodes just vanishes)
export function killPet(pet, instant) {
  if (pet.dead) return;
  pet.dead = true;
  burst(pet.pos.x, pet.y + 1, pet.pos.z, 0x9a9a9a, 16, 3, 0.6);
  pet.plate.remove();
  for (const e of G.enemies) if (e.petTarget === pet) e.petTarget = null;
  if (instant || pet.hp > 0 || G.player.state === 'dead') G.scene.remove(pet.model.root);
  else { pet.deadT = 0; dying.push(pet); }
}
export function clearPets() { for (const p of G.pets) killPet(p, true); G.pets.length = 0; for (const p of dying) G.scene.remove(p.model.root); dying.length = 0; }
function updateDying(dt) {
  for (let i = dying.length - 1; i >= 0; i--) {
    const pet = dying[i]; pet.deadT += dt;
    if (pet.model.beast) animBeast(pet.model, { move: 0, phase: pet.phase, pose: 'dead', t: pet.deadT, hurt: pet.hurt });
    else { animHumanoid(pet.model, { move: 0, phase: pet.phase, pose: 'dead', t: pet.deadT }); updateAccessories(pet.model, G.time, { dead: true, deadT: pet.deadT }); }
    if (pet.deadT > 1.6) pet.model.root.position.y -= dt * 0.9;
    if (pet.deadT > 3.2) { G.scene.remove(pet.model.root); dying.splice(i, 1); }
  }
}

const v3 = new THREE.Vector3();
export function updatePets(dt, spellPowerFn) {
  const P = G.player, s = stats();
  updateDying(dt);
  for (let i = G.pets.length - 1; i >= 0; i--) {
    const pet = G.pets[i];
    if (pet.dead) { G.pets.splice(i, 1); continue; }
    if (G.time > pet.until || P.state === 'dead') { killPet(pet, true); continue; }
    if (pet.hurt) pet.hurt.t += dt;
    pet.atkCd -= dt; pet.strike -= dt; pet.flash -= dt;
    if (pet.L.fire && Math.random() < dt * 40) burst(pet.pos.x + (Math.random() - 0.5) * 0.5, pet.y + 0.4 + Math.random() * 1.6, pet.pos.z + (Math.random() - 0.5) * 0.5, Math.random() < 0.5 ? 0xff7a2a : 0xffd060, 1, 0.6, 0.45, 0.18, -3);
    if (pet.bomber) {
      if (!pet.target || pet.target.dead) {
        let best = 25; pet.target = null;
        for (const e of enemiesNear(pet.pos.x, pet.pos.z, 25)) { if (e.dead) continue; const d = Math.hypot(e.pos.x - pet.pos.x, e.pos.z - pet.pos.z); if (d < best) { best = d; pet.target = e; } }
      }
      if (pet.target && Math.hypot(pet.target.pos.x - pet.pos.x, pet.target.pos.z - pet.pos.z) < pet.target.radius + 0.9) { explodeBomber(pet, spellPowerFn); continue; }
    }
    // pick a target: what the player is fighting, else whatever is attacking the player
    if (!pet.bomber && (!pet.target || pet.target.dead || Math.hypot(pet.target.pos.x - P.pos.x, pet.target.pos.z - P.pos.z) > 30)) {
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
      const sp = pet.L.speed * (pet.target ? 1 : Math.min(1.6, 0.6 + d / 6)) * (pet.bomber && pet.target ? 1.3 : 1);
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
    if (!pet.bomber && pet.target && d <= stop + 0.5 && pet.atkCd <= 0) {
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
    // place and animate: a short wind-up before each blow (the blow itself lands when it always did)
    pet.y = heightAt(pet.pos.x, pet.pos.z) + (pet.L.float && !pet.model.beast ? 0.8 + Math.sin(G.time * 3 + i) * 0.15 : 0);
    pet.model.root.position.set(pet.pos.x, pet.y, pet.pos.z);
    pet.model.root.rotation.y = pet.facing;
    const winding = !pet.bomber && pet.target && d <= stop + 0.5 && pet.atkCd > 0 && pet.atkCd < 0.4 && pet.strike <= 0;
    let pose = pet.strike > 0 ? 'strike' : winding ? 'windup' : null, pt = pet.strike > 0 ? 1 - pet.strike / 0.3 : winding ? 1 - pet.atkCd / 0.4 : 0;
    const hurt = pet.hurt && pet.hurt.t < 0.5 ? pet.hurt : null;
    if (!pose && hurt && hurt.t < 0.3) { pose = 'hit'; pt = hurt.t / 0.3; }
    if (pet.model.beast) animBeast(pet.model, { move: pet.move, phase: pet.phase, pose, t: pt, hurt, charge: pet.bomber && !!pet.target, alert: !!pet.target });
    else {
      undoPose(pet.model);
      animHumanoid(pet.model, { move: pet.bomber && pet.target ? Math.min(1, pet.move * 1.4) : pet.move, phase: pet.phase, pose: pose === 'strike' ? (pet.ranged ? 'cast' : 'slash') : pose === 'windup' ? (pet.ranged ? 'cast' : 'windup') : pose, t: pt });
      if (pet.L.look === 'zombie' && !pose) addPose(pet.model, -1.25, 0.15); // arms out in front, shambling
      if (pet.bomber && pet.target) addPose(pet.model, 0.35, 0, 0.35); // a headlong sprint, leaning in
      updateAccessories(pet.model, G.time, { move: pet.move, wind: pose === 'windup' ? pt : 0 });
    }
    tintModel(pet.model, pet.flash > 0 ? 0x552222 : 0);
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

// a bomber pet reaches its target: area blast that sets everyone on fire
function explodeBomber(pet, spellPowerFn) {
  const s = stats();
  const dmg = spellPowerFn() * pet.dmgMult * (1 + (s.mods.petDmg || 0));
  impact('fire', pet.pos.x, pet.y + 1, pet.pos.z, pet.explode);
  shockRing(pet.pos.x, pet.pos.z, pet.explode, 0xff7a2a, 0.5);
  sfx('explosion'); shake(0.35);
  for (const e of enemiesNear(pet.pos.x, pet.pos.z, pet.explode + 2)) {
    if (e.dead || Math.hypot(e.pos.x - pet.pos.x, e.pos.z - pet.pos.z) > pet.explode + e.radius) continue;
    damageEnemyByPet(e, dmg, null);
    if (pet.burn && !e.dead) { e.st = (e.st || []).filter(x => x.type !== 'burn'); e.st.push({ type: 'burn', dps: spellPowerFn() * pet.burn / 4, until: G.time + 4, tick: 0 }); }
  }
  killPet(pet, true);
}

// set by enemies.js to avoid a circular import at load time
let dmgHook = null;
export function setPetDamageHook(fn) { dmgHook = fn; }
function damageEnemyByPet(e, dmg, pet) { if (dmgHook) dmgHook(e, dmg, pet); }
