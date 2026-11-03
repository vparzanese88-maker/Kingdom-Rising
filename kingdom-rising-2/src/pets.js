// Campaign summons: skeletons, bears, war tigers, elementals, phantasms and wolves that fight for you.
// (Kingdom Battles runs its own pets as soldiers of your town.) A pet borrows a monster's model and
// animations, sits on your side (G.myTeam), follows you, and attacks whatever you are fighting.
import * as THREE from 'three';
import { G } from './state.js';
import { Mob } from './mobs.js';
import { petDef } from './classes2.js';
import { heightAt } from './terrain.js';
import { foe } from './combat.js';
import { V } from './vfx.js';
import { S } from './audio.js';

const MODEL = { skeleton: 'skeleton', bear: 'bear', tiger: 'tiger', wolfpack: 'wolf', fireel: 'imp', earthel: 'golem', phantasm: 'skeleton', spirit: 'wolf' };
const GHOST = { phantasm: '#b080ff', spirit: '#8ad0ff' };
let petN = 0;

// lv: the summoner's power on the 1-10 scale petDef uses
export function summonPets(kind, at, lv, dur, n, big) {
  if (!G.myTeam) G.myTeam = 'hero';
  for (let k = 0; k < n; k++) {
    const def = kind === 'spirit' ? Object.assign(petDef('wolfpack', lv, big), { name: 'Spirit Wolf' }) : petDef(kind, lv, big);
    const a = (k / Math.max(1, n)) * Math.PI * 2, r = n > 1 ? 1.8 : 0, x = at.x + Math.cos(a) * r, z = at.z + Math.sin(a) * r;
    const m = new Mob(MODEL[kind] || 'skeleton', 1, x, z);
    m.team = G.myTeam; m.pet = def; m.petKind = kind; Object.defineProperty(m, 'name', { value: def.name, configurable: true }); m.hostile = false; m.lv = G.save ? G.save.level : 1;
    m.maxHp = m.hp = def.hp; m.petT = dur; m.atkCd = 0.5; m.slot = petN++ % 4; m.update = petUpdate; m.takeHit = petHit;
    if (def.size) m.root.scale.multiplyScalar(def.size);
    if (GHOST[kind]) m.root.traverse(o => { if (o.isMesh && o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.6; o.material.emissive = new THREE.Color(GHOST[kind]); o.material.emissiveIntensity = 0.6; } });
    if (m.ring) m.ring.visible = false;
    G.mobs.push(m);
    V.burst(kind === 'skeleton' ? 'bone' : kind === 'fireel' ? 'fire' : 'shadow', new THREE.Vector3(x, heightAt(x, z) + 0.6, z), 40, { speed: 3 });
  }
}
// pets shrug off stray hits: they are here to fight for you, not to die to splash damage
function petHit() { return 0; }
function vanish(m) {
  V.burst('shadow', m.pos.clone().setY(m.pos.y + 0.8), 30, { speed: 2.5 });
  G.scene.remove(m.root); const i = G.mobs.indexOf(m); if (i >= 0) G.mobs.splice(i, 1);
}
function pickTarget(m, P) {
  let best = null, bd = 1e9;
  for (const o of G.mobs) {
    if (o.dead || o.pet || !foe(o) || !o.root.visible) continue;
    const dp = Math.hypot(o.pos.x - P.pos.x, o.pos.z - P.pos.z); if (dp > 22) continue;
    // fight what is fighting you, or what you are fighting
    if (!(o.state === 'chase' || o === G.target || o.provoked)) continue;
    const d = Math.hypot(o.pos.x - m.pos.x, o.pos.z - m.pos.z); if (d < bd) { bd = d; best = o; }
  }
  return best;
}
function petUpdate(dt) {
  const P = G.player, D = this.pet; if (!P) return;
  this.petT -= dt; if (this.petT <= 0 || P.dead) { vanish(this); return; }
  this.atkCd -= dt; this.thinkT = (this.thinkT || 0) - dt;
  if (this.tgt && (this.tgt.dead || Math.hypot(this.tgt.pos.x - P.pos.x, this.tgt.pos.z - P.pos.z) > 28)) this.tgt = null;
  if (this.thinkT <= 0) { this.thinkT = 0.4; if (!this.tgt) this.tgt = pickTarget(this, P); }
  let want = null, speed = 0, act = null;
  const reach = D.range ? D.range : 1.4 + (this.radius || 0.5);
  if (this.tgt) {
    const t = this.tgt, d = Math.hypot(t.pos.x - this.pos.x, t.pos.z - this.pos.z) - (t.radius || 0.5);
    this.faceTo(t.pos, dt, 8);
    if (d > reach) { want = t.pos; speed = D.speed; }
    else if (this.atkCd <= 0) {
      this.atkCd = D.cd || 1.2; this.action = 'attack'; this.actionT = 0; this.actionDur = 0.6;
      const dmg = (D.dmg || 10) * (0.9 + Math.random() * 0.2);
      if (D.proj) { V.burst(D.proj === 'fire' ? 'fire' : 'arcane', t.pos.clone().setY(t.pos.y + (t.height || 1.5) * 0.6), 18, { speed: 3 }); S.cast(D.proj, this.pos, 0.4); }
      t.takeHit(dmg, P, { pet: true }); t.provoked = true; if (t.state !== 'flee') t.state = 'chase';
    }
  } else {
    // follow a few steps behind and to the side, and settle when close
    const side = [-1, 1, -1.6, 1.6][this.slot], back = 2.6 + (this.slot >> 1) * 1.4;
    const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
    const tx = P.pos.x - fx * back + fz * side * 1.6, tz = P.pos.z - fz * back - fx * side * 1.6, d = Math.hypot(tx - this.pos.x, tz - this.pos.z);
    if (d > 40) { this.pos.set(tx, heightAt(tx, tz), tz); }
    else if (d > (this.moving ? 0.6 : 2.2)) { want = new THREE.Vector3(tx, 0, tz); speed = Math.min(D.speed * 1.2, 2 + d * 1.5); this.moving = true; } else this.moving = false;
    if (want) this.faceTo(want, dt, 6);
  }
  if (want && speed) { const dx = want.x - this.pos.x, dz = want.z - this.pos.z, l = Math.hypot(dx, dz); if (l > 0.1) { const mv = Math.min(l, speed * dt); this.pos.x += dx / l * mv; this.pos.z += dz / l * mv; } }
  this.pos.y = heightAt(this.pos.x, this.pos.z);
  if (this.action) { this.actionT += dt / this.actionDur; if (this.actionT >= 1) this.action = null; }
  this.root.position.copy(this.pos); this.root.rotation.y = this.yaw;
  this.animate(dt, { speed: want ? speed : 0, action: this.action, actionT: this.actionT });
}
