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

const MODEL = { skelmage: 'skeleton', skeleton: 'skeleton', bear: 'bear', tiger: 'tiger', wolfpack: 'wolf', fireel: 'imp', earthel: 'golem', phantasm: 'skeleton', spirit: 'wolf' };
const GHOST = { phantasm: '#b080ff', spirit: '#8ad0ff', skelmage: '#7a40d0' };
let petN = 0;

// lv: the summoner's power on the 1-10 scale petDef uses
export function dismissPets(spell) { for (const m of G.mobs.filter(o => o.pet && (spell == null || o.spell === spell))) vanish(m); }
export function summonPets(kind, at, lv, dur, n, big, spell = kind) {
  if (!G.myTeam) G.myTeam = 'hero';
  dismissPets(spell);
  for (let k = 0; k < n; k++) {
    const def = kind === 'spirit' ? Object.assign(petDef('wolfpack', lv, big), { name: 'Spirit Wolf' }) : petDef(kind, lv, big);
    const a = (k / Math.max(1, n)) * Math.PI * 2, r = n > 1 ? 1.8 : 0, x = at.x + Math.cos(a) * r, z = at.z + Math.sin(a) * r;
    const m = new Mob(MODEL[kind] || 'skeleton', 1, x, z);
    m.team = G.myTeam; m.pet = def; m.petKind = kind; m.spell = spell; Object.defineProperty(m, 'name', { value: def.name, configurable: true }); m.hostile = false; m.lv = G.save ? G.save.level : 1;
    m.maxHp = m.hp = def.hp; m.petT = Infinity; m.atkCd = 0.5; m.slot = petN++ % 4; m.update = petUpdate; m.takeHit = petHit;
    // enemies can fight back: what a monster's attack needs from its target
    m.level = m.lv; m.stealth = 0; m.knock = new THREE.Vector3(); m.debuff = () => {}; m.takeDamage = petHurt;
    if (def.size) m.root.scale.multiplyScalar(def.size);
    if (GHOST[kind]) m.root.traverse(o => { if (o.isMesh && o.material) { o.material = o.material.clone(); if (kind !== 'skelmage') { o.material.transparent = true; o.material.opacity = 0.6; } if (o.material.emissive) { o.material.emissive.set(GHOST[kind]); o.material.emissiveIntensity = 0.6; } } });
    if (m.ring) m.ring.visible = false;
    G.mobs.push(m);
    V.burst(kind === 'skeleton' ? 'bone' : kind === 'fireel' ? 'fire' : 'shadow', new THREE.Vector3(x, heightAt(x, z) + 0.6, z), 40, { speed: 3 });
  }
}
// your own splash damage never hurts them; monsters do
function petHit() { return 0; }
function petHurt(dmg) {
  if (this.dead) return; const d = Math.max(1, Math.round(dmg * (1 - (this.pet.armor || 0))));
  this.hp -= d; this.hitFlash = 0.15; V.number(this.pos.clone().setY(this.pos.y + (this.height || 1.6) + 0.3), d, 'dmg');
  if (this.hp <= 0) { this.dead = true; G.hooks.toast && G.hooks.toast(`Your ${this.name} has fallen`, '☠', 'bad'); vanish(this); }
}
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
  if (P.dead) { vanish(this); return; }
  this.knock.multiplyScalar(0.9);
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
      t.takeHit(dmg, P, { pet: true }); t.provoked = true; t.petFoe = this; if (t.state !== 'flee') t.state = 'chase';
    }
  } else {
    // roam calmly near you on its own: pick a spot a few metres from you, amble there, wait, pick another.
    // Only when you get far away does it trot after you (where you look does not matter).
    const dP = Math.hypot(P.pos.x - this.pos.x, P.pos.z - this.pos.z);
    if (dP > 45) { const a = Math.random() * 6.28; this.pos.set(P.pos.x + Math.cos(a) * 3, 0, P.pos.z + Math.sin(a) * 3); this.roam = null; }
    this.roamT = (this.roamT || 0) - dt;
    const roamOk = this.roam && Math.hypot(this.roam.x - P.pos.x, this.roam.z - P.pos.z) < 7;
    if (!roamOk || (this.roamT <= 0 && dP < 9)) { const a = Math.random() * 6.28, r = 2.5 + Math.random() * 3.5; this.roam = new THREE.Vector3(P.pos.x + Math.cos(a) * r, 0, P.pos.z + Math.sin(a) * r); this.roamT = 4 + Math.random() * 6; }
    const d = Math.hypot(this.roam.x - this.pos.x, this.roam.z - this.pos.z);
    if (d > 0.5) { want = this.roam; speed = dP > 9 ? D.speed : Math.min(D.speed * 0.45, 1.2 + d * 0.5); }
    if (want) this.faceTo(want, dt, 6);
  }
  if (want && speed) { const dx = want.x - this.pos.x, dz = want.z - this.pos.z, l = Math.hypot(dx, dz); if (l > 0.1) { const mv = Math.min(l, speed * dt); this.pos.x += dx / l * mv; this.pos.z += dz / l * mv; } }
  this.pos.y = heightAt(this.pos.x, this.pos.z);
  if (this.action) { this.actionT += dt / this.actionDur; if (this.actionT >= 1) this.action = null; }
  this.root.position.copy(this.pos); this.root.rotation.y = this.yaw;
  this.animate(dt, { speed: want ? speed : 0, action: this.action, actionT: this.actionT });
}
