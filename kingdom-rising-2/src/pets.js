// Campaign summons: skeletons, bears, war tigers, elementals, phantasms and wolves that fight for you.
// (Kingdom Battles runs its own pets as soldiers of your town.) A pet borrows a monster's model and
// animations, sits on your side (G.myTeam), follows you, and attacks whatever you are fighting.
import * as THREE from 'three';
import { G } from './state.js';
import { Mob } from './mobs.js';
import { petDef } from './classes2.js';
import { heightAt } from './terrain.js';
import { foe, lightning, spawnProjectile, mobsInRadius } from './combat.js';
import { V } from './vfx.js';
import { S } from './audio.js';

const MODEL = { bonegolem: 'golem', skelmage: 'skeleton', skeleton: 'skeleton', bear: 'bear', tiger: 'tiger', wolfpack: 'wolf', fireel: 'imp', earthel: 'golem', flameel: 'skeleton', frostel: 'skeleton', stormel: 'skeleton', pureel: 'firegiant', phantasm: 'skeleton', spirit: 'wolf' };
const GHOST = { phantasm: '#b080ff', spirit: '#8ad0ff', skelmage: '#7a40d0', flameel: '#ff6a10', frostel: '#70c8ff', stormel: '#a8b8ff', pureel: '#ff5a10' };
const SOLID = new Set(['skelmage', 'pureel']); // glowing but not see-through
const ELEMS = new Set(['flameel', 'frostel', 'stormel', 'pureel']); // an elementalist keeps one elemental at a time
let petN = 0;

// lv: the summoner's power on the 1-10 scale petDef uses
export function dismissPets(spell) { for (const m of G.mobs.filter(o => o.pet && (spell == null || o.spell === spell))) vanish(m); }
export function summonPets(kind, at, lv, dur, n, big, spell = kind) {
  if (!G.myTeam) G.myTeam = 'hero';
  dismissPets(spell); if (ELEMS.has(kind)) for (const o of G.mobs.filter(o => o.pet && ELEMS.has(o.petKind))) vanish(o);
  for (let k = 0; k < n; k++) {
    const def = kind === 'spirit' ? Object.assign(petDef('wolfpack', lv, big), { name: 'Spirit Wolf' }) : petDef(kind, lv, big);
    const a = (k / Math.max(1, n)) * Math.PI * 2, r = n > 1 ? 1.8 : 0, x = at.x + Math.cos(a) * r, z = at.z + Math.sin(a) * r;
    const m = new Mob(MODEL[kind] || 'skeleton', 1, x, z);
    m.team = G.myTeam; m.pet = def; m.petKind = kind; m.spell = spell; Object.defineProperty(m, 'name', { value: def.name, configurable: true }); m.hostile = false; m.lv = G.save ? G.save.level : 1;
    m.maxHp = m.hp = def.hp; m.petT = Infinity; m.atkCd = 0.5; m.slot = petN++ % 4; m.update = petUpdate; m.takeHit = petHit;
    // enemies can fight back: what a monster's attack needs from its target
    m.level = m.lv; m.stealth = 0; m.knock = new THREE.Vector3(); m.debuff = () => {}; m.takeDamage = petHurt;
    if (def.size) m.root.scale.multiplyScalar(def.size);
    if (kind === 'bonegolem') { const bone = new THREE.MeshStandardMaterial({ color: '#e2d8bc', roughness: 0.85 }); m.root.traverse(o => { if (o.isMesh) o.material = bone; }); } // bleached bone
    if (ELEM_LOOK[kind]) elementalBody(m, kind); // a glowing ball of fire, frost or lightning spinning on a tornado
    else if (GHOST[kind]) m.root.traverse(o => { if (o.isMesh && o.material) { o.material = o.material.clone(); if (!SOLID.has(kind)) { o.material.transparent = true; o.material.opacity = 0.6; } if (o.material.emissive) { o.material.emissive.set(GHOST[kind]); o.material.emissiveIntensity = 0.6; } } });
    if (m.ring) m.ring.visible = false;
    if (kind === 'pureel') { // the Fire Giant: charred, rock-hard skin glowing like embers, and the axe burns
      const ice = new THREE.MeshStandardMaterial({ color: '#1e1a18', roughness: 0.95, metalness: 0.05, emissive: '#ff3000', emissiveIntensity: 0.09 });
      const fire = new THREE.MeshStandardMaterial({ color: '#ff8a30', roughness: 0.5, emissive: '#ff4a08', emissiveIntensity: 1.6 });
      const axe = m.model && m.model.weapons && m.model.weapons.main;
      m.root.traverse(o => { if (!o.isMesh) return; let a = o; while (a && a !== axe) a = a.parent; o.material = a ? fire : ice; });
      m.axe = axe; m.fbT = 2; if (axe) axe.scale.multiplyScalar(1.25); // a giant's axe
      const hg = m.model && m.model.headG; if (hg) { const eye = new THREE.MeshBasicMaterial({ color: '#ffd040' }); for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), eye); e.position.set(sx * 0.037, 0.115, 0.095); hg.add(e); } m.headG = hg; } // burning eyes
    }
    { const md = m.model; if (kind === 'skeleton' && md && md.weapons && md.weapons.off) md.weapons.off.visible = (G.save ? G.save.level : 1) >= 10; } /* the shield shows from level 10 */
    G.mobs.push(m);
    V.burst(kind === 'skeleton' ? 'bone' : kind === 'fireel' || kind === 'flameel' ? 'fire' : kind === 'frostel' ? 'frost' : kind === 'stormel' || kind === 'pureel' ? 'arcane' : 'shadow', new THREE.Vector3(x, heightAt(x, z) + 0.6, z), 40, { speed: 3 });
  }
}
// ---- the elementalist's elementals: a glowing ball on a spinning tornado, with arms that lash out of it ----
const ELEM_LOOK = { flameel: ['#ff6a10', '#ffe0a0', 'fire'], frostel: ['#5ac8ff', '#f0fbff', 'frost'], stormel: ['#5a6aff', '#e8ecff', 'arcane'] };
function elementalBody(m, kind) {
  const [col, hot, mote] = ELEM_LOOK[kind], add = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });
  m.root.traverse(o => { if (o.isMesh) o.visible = false; }); // the borrowed body stays hidden
  const g = new THREE.Group(); m.root.add(g);
  const orb = new THREE.Group(); orb.position.y = 1.55; g.add(orb);
  orb.add(new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 16), new THREE.MeshBasicMaterial({ color: hot })));
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 16), add(col, 0.45)); orb.add(halo);
  const halo2 = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 12), add(col, 0.16)); orb.add(halo2);
  const rings = []; for (let i = 0; i < 6; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.46 - i * 0.065, 0.05 + (5 - i) * 0.008, 6, 20), add(col, 0.55 - i * 0.05)); r.rotation.x = Math.PI / 2; r.position.y = 1.15 - i * 0.2; g.add(r); rings.push(r); }
  const arms = []; for (const sx of [-1, 1]) { const a = new THREE.Group(); a.position.set(sx * 0.3, 1.5, 0); const up = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, 0.75, 8), add(col, 0.75)); up.rotation.x = Math.PI / 2; up.position.z = 0.38; a.add(up);
    const claw = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.32, 8), add(hot, 0.9)); claw.rotation.x = Math.PI / 2; claw.position.z = 0.86; a.add(claw); a.rotation.y = sx * 0.6; a.scale.setScalar(0.001); g.add(a); arms.push({ g: a, t: 0, side: sx }); }
  m.elem = { g, orb, halo, halo2, rings, arms, mote, armT: 1 + Math.random() * 2 };
}
function elementalTick(m, dt) {
  const E = m.elem, t = G.time;
  E.orb.position.y = 1.55 + Math.sin(t * 2.2 + m.slot) * 0.08; E.halo.scale.setScalar(1 + Math.sin(t * 7) * 0.08); E.halo2.scale.setScalar(1 + Math.sin(t * 3.3) * 0.1);
  E.rings.forEach((r, i) => { r.rotation.z += dt * (6 + i * 2.5); r.position.x = Math.sin(t * 3 + i * 0.9) * 0.06 * i; r.position.z = Math.cos(t * 2.6 + i * 0.9) * 0.06 * i; });
  if ((E.armT -= dt) <= 0) { E.armT = 1 + Math.random() * 2.5; const a = E.arms[Math.floor(Math.random() * 2)]; if (a.t <= 0) a.t = 0.9; } // an arm whips out now and then
  for (const a of E.arms) { if (a.t > 0) a.t -= dt; const k = a.t <= 0 ? 0 : a.t > 0.7 ? (0.9 - a.t) / 0.2 : a.t < 0.25 ? a.t / 0.25 : 1; a.g.scale.setScalar(Math.max(0.001, k)); a.g.rotation.x = Math.sin(t * 9 + a.side) * 0.25 * k; }
  if (Math.random() < dt * 22) V.emit(E.mote, m.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.9, 0.2 + Math.random() * 1.2, (Math.random() - 0.5) * 0.9)), { speed: 0.6, vy: 1.5, size: 0.35, life: 0.6 });
}
function elementalStrike(m) { if (!m.elem) return; const a = m.elem.arms[Math.random() < 0.5 ? 0 : 1]; a.t = 0.9; } // lash out at the target
// your own splash damage never hurts them; monsters do
function petHit() { return 0; }
function petHurt(dmg, src) {
  if (this.dead) return; if (src && src.pos && !src.pet) { this.lastHitBy = src; this.hurtT = G.time; } // whoever hits the pet becomes fair game
  const lv = G.save ? G.save.level : 1, shield = this.petKind === 'skeleton' && lv >= 10 ? 0.25 : 0; // skeletons raise a shield from level 10
  const d = Math.max(1, Math.round(dmg * (1 - Math.min(0.8, (this.pet.armor || 0) + shield)) * (this.wardT > G.time ? (this.wardK || 0.5) : 1))); // Bone Bulwark halves it
  this.hp -= d; this.hitFlash = 0.15; V.number(this.pos.clone().setY(this.pos.y + (this.height || 1.6) + 0.3), d, 'dmg');
  if (this.hp <= 0) { this.dead = true; G.hooks.toast && G.hooks.toast(`Your ${this.name} has fallen`, '☠', 'bad'); vanish(this); }
}
function vanish(m) {
  V.burst('shadow', m.pos.clone().setY(m.pos.y + 0.8), 30, { speed: 2.5 });
  G.scene.remove(m.root); const i = G.mobs.indexOf(m); if (i >= 0) G.mobs.splice(i, 1);
}
// ---- pet orders (G): tap to send them at your target, hold for the command wheel ----
// modes: guard (default: what you attack, or what attacks you), attack (any hostile near you), follow (never fights), stay (holds its spot)
export const PETS = { mode: 'guard', taunt: true, order: null, stay: null };
export function stopPets() { PETS.order = null; if (PETS.mode === 'attack' || PETS.mode === 'stay') PETS.mode = 'guard'; PETS.stay = null; for (const m of pets()) m.tgt = null; }
export const pets = () => G.mobs.filter(m => m.pet && !m.dead);
export function petCommand(cmd, target) {
  const list = pets(); if (!list.length) return false;
  if (cmd === 'taunt') PETS.taunt = !PETS.taunt;
  else if (cmd === 'attackTarget') { if (!target || target.dead) return false; PETS.order = target; for (const m of list) m.tgt = target; }
  else { PETS.mode = cmd; PETS.order = null; if (cmd === 'stay') PETS.stay = list.map(m => m.pos.clone()); if (cmd === 'follow') for (const m of list) m.tgt = null; if (cmd !== 'stay') PETS.stay = null; }
  return true;
}
const recent = (t) => t && G.time - t < 8;
function pickTarget(m, P) {
  if (PETS.order && !PETS.order.dead) return PETS.order;
  if (PETS.mode === 'follow') return null;
  const at = PETS.mode === 'stay' && m.anchor ? m.anchor : P.pos, R = PETS.mode === 'stay' ? 9 : PETS.mode === 'attack' ? 20 : 24;
  let best = null, bd = 1e9;
  for (const o of G.mobs) {
    if (o.dead || o.pet || !foe(o) || !o.root.visible) continue;
    const dp = Math.hypot(o.pos.x - at.x, o.pos.z - at.z); if (dp > R) continue;
    // guard: what you are fighting, or what is fighting you; attack: anything hostile; stay: anything that comes close
    // only what you are fighting, what hit you, or what hit the pet (an enemy just running at you is not enough)
    const fighting = (o === G.target && recent(P.hitT)) || (o === P.lastHitBy && recent(P.lastHitAt)) || (o === m.lastHitBy && recent(m.hurtT));
    if (PETS.mode === 'guard' && !fighting) continue;
    if (PETS.mode === 'attack' && !(fighting || o.hostile || o.provoked)) continue;
    const d = Math.hypot(o.pos.x - m.pos.x, o.pos.z - m.pos.z) - (o === G.target ? 6 : 0); if (d < bd) { bd = d; best = o; }
  }
  return best;
}
function petUpdate(dt) {
  const P = G.player, D = this.pet; if (!P) return;
  if (P.dead) { vanish(this); return; }
  this.knock.multiplyScalar(0.9);
  if (this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * (this.tgt ? 0.004 : 0.02) * dt); // slow regeneration
  this.atkCd -= dt; this.thinkT = (this.thinkT || 0) - dt;
  if (PETS.order && PETS.order.dead) PETS.order = null;
  if (PETS.mode === 'follow' && !PETS.order) this.tgt = null;
  if (PETS.mode === 'stay' && PETS.stay) { const k = pets().indexOf(this); this.anchor = PETS.stay[k] || this.anchor || this.pos.clone(); } else this.anchor = null;
  if (this.tgt && (this.tgt.dead || Math.hypot(this.tgt.pos.x - P.pos.x, this.tgt.pos.z - P.pos.z) > (this.tgt === PETS.order ? 45 : 28) || (this.anchor && Math.hypot(this.tgt.pos.x - this.anchor.x, this.tgt.pos.z - this.anchor.z) > 14))) this.tgt = null;
  if (this.thinkT <= 0) { this.thinkT = 0.4; if (!this.tgt) this.tgt = pickTarget(this, P); }
  let want = null, speed = 0, act = null;
  const reach = D.range ? D.range : 1.4 + (this.radius || 0.5);
  if (this.elem) elementalTick(this, dt);
  if (D.fireball) { // the Fire Giant: fire streams off its axe, smoke and embers rise off its body
    if (this.axe && Math.random() < dt * 30) V.emit('fire', this.axe.localToWorld(new THREE.Vector3(0, 0.3 + Math.random() * 0.6, 0)), { speed: 0.6, vy: 1.6, size: 0.5, life: 0.5 });
    if (this.headG && Math.random() < dt * 26) V.emit('fire', this.headG.localToWorld(new THREE.Vector3((Math.random() - 0.5) * 0.12, 0.2, (Math.random() - 0.5) * 0.12)), { speed: 0.4, vy: 2.2, size: 0.55, life: 0.45 }); // a crown of fire
    if (Math.random() < dt * 12) V.emit(Math.random() < 0.5 ? 'ember' : 'smoke', this.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, 0.4 + Math.random() * 3, (Math.random() - 0.5) * 2)), { speed: 0.3, vy: 1.2, size: 0.6, life: 1 });
  }
  if (this.tgt) {
    const t = this.tgt, d = Math.hypot(t.pos.x - this.pos.x, t.pos.z - this.pos.z) - (t.radius || 0.5);
    if (D.fireball && (this.fbT = (this.fbT || 0) - dt) <= 0 && d < 30) { // a huge fireball that explodes where it lands
      this.fbT = 6; this.action = 'attack'; this.actionT = 0; this.actionDur = 0.7;
      const from = this.pos.clone().setY(this.pos.y + (this.height || 3) * 0.9), to = t.pos.clone().setY(t.pos.y + (t.height || 1.5) * 0.5), dir = to.sub(from).normalize(), dmg = (D.dmg || 40) * 1.6;
      spawnProjectile({ pos: from, vel: dir.multiplyScalar(30), grav: 0.5, radius: 0.7, dmg: 0, owner: 'player', kind: 'fireball', scale: 2.6, life: 2.5,
        onHit: (p, m0, pos) => { const at = (pos || p.pos).clone(); for (const mm of mobsInRadius(at, 5)) { mm.takeHit(dmg, P, { pet: true }); mm.provoked = true; }
          V.burst('fire', at, 70, { speed: 9, size: 0.9 }); V.burst('smoke', at, 30, { speed: 4, size: 1.4, life: 1.6 }); V.ring(at, 5, '#ff7a20', 0.5); V.light(at, '#ff8a30', 10, 0.25); S.explode(at, 1.2, 'fire'); V.addShake(0.35); } });
      S.cast('fire', this.pos, 1.2);
    }
    this.faceTo(t.pos, dt, 8);
    if (d > reach) { want = t.pos; speed = D.speed; }
    else if (this.atkCd <= 0) {
      const fr = this.frenzyT > G.time, FK = this.frK || { dmg: 1.4, spd: 1.3 }; this.atkCd = (D.cd || 1.2) / (1 + ((G.save ? G.save.level : 1) - 1) * 0.035) / (fr ? FK.spd : 1); this.action = 'attack'; this.actionT = 0; this.actionDur = 0.6; // faster as you level (about 1.7x at 20), 30% faster in an Unholy Frenzy
      const dmg = (D.dmg || 10) * (0.9 + Math.random() * 0.2) * (fr ? FK.dmg : 1);
      elementalStrike(this);
      if (D.chain) { let prev = t, hit = new Set([t]), k = 0.6; for (let j = 0; j < D.chain; j++) { const nx = G.mobs.filter(o => !o.dead && foe(o) && !hit.has(o) && o.pos.distanceTo(prev.pos) < 9).sort((x, y) => x.pos.distanceTo(prev.pos) - y.pos.distanceTo(prev.pos))[0]; if (!nx) break;
          lightning(prev.pos.clone().setY(prev.pos.y + (prev.height || 1.5) * 0.6), nx.pos.clone().setY(nx.pos.y + (nx.height || 1.5) * 0.6)); nx.takeHit(dmg * k, P, { pet: true, stun: 0.2 }); nx.provoked = true; hit.add(nx); prev = nx; k *= 0.8; } } // the storm's bolt jumps on
      if (D.proj === 'storm') lightning(this.pos.clone().setY(this.pos.y + (this.height || 1.6) * 0.8), t.pos.clone().setY(t.pos.y + (t.height || 1.5) * 0.6));
      if ((D.chill || (fr && this.frChill)) && t.status) t.status.slow = Math.max(t.status.slow || 0, fr && this.frChill ? 2 : 1.5); /* frost slows what it strikes */
      if (D.proj) { V.burst(D.proj === 'fire' ? 'fire' : D.proj === 'storm' ? 'arcane' : 'arcane', t.pos.clone().setY(t.pos.y + (t.height || 1.5) * 0.6), 18, { speed: 3 }); S.cast(D.proj, this.pos, 0.4); }
      t.takeHit(dmg, P, { pet: true, burn: D.burns ? dmg * (D.burns === 2 ? 0.15 : 0.08) : 0, slow: D.chill ? 2.5 : 0 }); t.provoked = true; /* the Fire Giant's axe sets them alight */ if (PETS.taunt) t.petFoe = this; else if (t.petFoe === this) t.petFoe = null; if (t.state !== 'flee') t.state = 'chase';
    }
  } else {
    // roam calmly near you on its own: pick a spot a few metres from you, amble there, wait, pick another.
    // Only when you get far away does it trot after you (where you look does not matter).
    const dP = Math.hypot(P.pos.x - this.pos.x, P.pos.z - this.pos.z);
    if (this.anchor) { this.roam = this.anchor; this.roamT = 99; }
    else if (dP > 45) { const a = Math.random() * 6.28; this.pos.set(P.pos.x + Math.cos(a) * 3, 0, P.pos.z + Math.sin(a) * 3); this.roam = null; }
    this.roamT = (this.roamT || 0) - dt;
    const roamOk = this.anchor || (this.roam && Math.hypot(this.roam.x - P.pos.x, this.roam.z - P.pos.z) < (PETS.mode === 'follow' ? 4 : 7));
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
