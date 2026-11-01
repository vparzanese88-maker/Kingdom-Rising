// The player: movement, camera (first <-> third person), first-person view model, combos, heavy attacks,
// weapon abilities, class abilities, blocking, dodging, gathering and interaction.
import * as THREE from 'three';
import { G } from './state.js';
import { S, A, M as Music } from './audio.js';
import { V } from './vfx.js';
import { settings } from './saves.js';
import { WEAPON_TYPES, CLASSES, ABILITIES, AREA_UNLOCK_LEVEL, RANK2_LEVEL, CLASS_POOLS, RARITY, TIERS, WSKILLS, FAMILIES, slotSkills, familiesOf, COMBOS } from './data.js';
const dualRank = () => 0;
import { buildHumanoid, equipWeapon, animateHumanoid, makeWeapon, holdTool, tintGear, bake } from './character.js';
import { heightAt, isWater, waterLevelAt, zoneAt, SEA } from './terrain.js';
import { world, collide, groundAt, surfaceType, nodesNear, hideNode, nodeKinds } from './world.js';
import { activeWeapon, pairedWt, heroDerived, weaponDamage, gatherReward, toolProblem, useItem, count, lootCorpse, hasLoot, addItem, perk, wperk } from './game.js';
import { FOOD_BUFFS } from './data.js';
import { aimRay, groundPoint, mobsInCone, mobsInRadius, areaDamage, spawnProjectile, lightning } from './combat.js';
import { angDiff, rand, clamp } from './util.js';

const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const easeIn = (t) => t * t * t;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

// ---------- first-person view model ----------
const P = (x, y, z, rx, ry, rz) => [x, y, z, rx, ry, rz];
const VP = {
  rest: P(0.27, -0.2, -0.48, -0.45, 0.1, 0.16), restL: P(-0.27, -0.22, -0.48, -0.45, -0.1, -0.16), rest2: P(0.22, -0.24, -0.45, -0.45, 0.15, 0.5), hideL: P(-0.4, -0.9, -0.3, 0, 0, 0),
  s1a: P(0.52, -0.05, -0.4, -1.35, -1.1, 0.3), s1b: P(-0.42, -0.3, -0.45, -1.35, 1.35, 0.3),
  s2a: P(-0.38, -0.45, -0.4, -1.75, 1.1, -0.6), s2b: P(0.45, 0.05, -0.5, -1.0, -1.2, -0.6),
  s3a: P(0.2, 0.3, -0.22, 0.5, 0, -0.1), s3b: P(0.05, -0.5, -0.55, -2.2, 0, 0),
  ha: P(0.45, 0.25, -0.15, 0.6, -0.5, -0.3), hb: P(0, -0.45, -0.62, -2.1, 0.3, 0),
  spRest: P(0.24, -0.3, -0.3, -1.45, 0.06, 0), thA: P(0.3, -0.25, -0.1, -1.5, 0.05, 0), thB: P(0.12, -0.2, -0.95, -1.56, 0, 0), th3A: P(0.32, 0.05, 0.0, -1.3, 0.1, 0), th3B: P(0.05, -0.25, -1.2, -1.65, 0, 0),
  blockW: P(0.15, -0.12, -0.45, -0.3, 0, 1.45), shieldRest: P(-0.38, -0.36, -0.5, 0, 0.6, 0), shieldBlock: P(-0.02, -0.16, -0.36, 0, 0, 0),
  bowL: P(-0.2, -0.14, -0.62, 0, 0, 0.18), bowR: P(-0.17, -0.15, -0.58, -1.5, 0, 0), bowRdraw: P(-0.13, -0.12, -0.3, -1.5, 0, 0),
  staff: P(0.32, -0.6, -0.58, -0.15, 0, -0.1), staffCast: P(0.24, -0.48, -0.85, -0.55, 0, -0.05), staffHigh: P(0.2, -0.15, -0.35, 0.3, 0, -0.1), staffSlam: P(0.12, -0.6, -0.9, -0.9, 0, 0),
  castL: P(-0.18, -0.24, -0.62, -1.4, 0, 0), chopA: P(0.38, 0.2, -0.3, 0.3, -0.3, -0.3), chopB: P(0.02, -0.35, -0.65, -1.7, 0.2, 0.2),
  gatherR: P(0.12, -0.6, -0.55, -1.2, 0, 0), gatherR2: P(0.08, -0.7, -0.5, -1.4, 0, 0),
};
function mirror(p) { return [-p[0], p[1], p[2], p[3], -p[4], -p[5]]; }
function plerp(a, b, t) { return a.map((v, i) => v + (b[i] - v) * t); }
function seq(a, b, t, wind = 0.35, rest = VP.rest) { return t < wind ? plerp(rest, a, ease(t / wind)) : t < 0.72 ? plerp(a, b, easeOut((t - wind) / (0.72 - wind))) : plerp(b, rest, ease((t - 0.72) / 0.28)); }

// a detailed gripping hand: palm, four curled fingers, thumb, knuckles, class glove and cuff
function makeHand(right, cls, skinCol) {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: skinCol, roughness: 0.6 });
  const glove = cls === 'warrior' ? new THREE.MeshStandardMaterial({ color: '#aab2bc', roughness: 0.3, metalness: 0.85 }) : cls === 'ranger' ? new THREE.MeshStandardMaterial({ color: '#5a3a20', roughness: 0.8 }) : skin;
  const fingerM = cls === 'ranger' ? skin : glove; // rangers wear fingerless gloves
  const sx = right ? 1 : -1;
  // palm wraps the handle (the handle runs along local Y through the origin)
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.036, 14, 10), glove); palm.scale.set(1.15, 1.35, 1.0); palm.position.set(sx * 0.03, 0.0, 0.012); g.add(palm);
  // four fingers curl around the grip
  for (let i = 0; i < 4; i++) {
    const r = 0.026 - i * 0.0015;
    const f = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0115 - i * 0.0008, 7, 12, Math.PI * 1.25), fingerM);
    f.rotation.x = Math.PI / 2; f.rotation.z = right ? Math.PI * 0.05 : Math.PI * 0.7; f.position.y = 0.033 - i * 0.022; g.add(f);
    if (cls === 'warrior') { const k = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.016, 0.02), glove); k.position.set(sx * 0.005, 0.033 - i * 0.022, -0.03); g.add(k); }
    else { const k = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 5), fingerM); k.position.set(sx * 0.0, 0.033 - i * 0.022, -0.033); g.add(k); }
  }
  // thumb over the top of the fingers
  const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.035, 4, 8), fingerM); th.position.set(-sx * 0.012, 0.03, -0.026); th.rotation.z = sx * 1.1; th.rotation.x = 0.4; g.add(th);
  // back of the hand plate / glove detail
  if (cls === 'warrior') { const plate = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.085, 0.06), glove); plate.position.set(sx * 0.07, 0, 0.012); g.add(plate); }
  if (cls === 'wizard') { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0145, 0.004, 6, 14), new THREE.MeshStandardMaterial({ color: '#e0b040', metalness: 0.9, roughness: 0.3 })); ring.rotation.x = Math.PI / 2; ring.position.set(0, 0.011, 0); g.add(ring); const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.007), new THREE.MeshStandardMaterial({ color: '#8a40ff', emissive: '#6a20ff', emissiveIntensity: 1.2 })); gem.position.set(0, 0.011, -0.04); g.add(gem); }
  // wrist / cuff
  const cuffM = cls === 'warrior' ? glove : cls === 'ranger' ? new THREE.MeshStandardMaterial({ color: '#6a4628', roughness: 0.8 }) : new THREE.MeshStandardMaterial({ color: CLASSES.wizard.colors.trim, roughness: 0.4, metalness: 0.6 });
  const wrist = new THREE.Object3D(); wrist.position.set(sx * 0.055, -0.04, 0.03); g.add(wrist);
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.041, 0.24, 14), cuffM); cuff.position.y = -0.09; wrist.add(cuff);
  if (cls === 'ranger') for (const y of [-0.016, 0.016]) { const strap = new THREE.Mesh(new THREE.TorusGeometry(0.043, 0.004, 4, 16), new THREE.MeshStandardMaterial({ color: '#2a1a0e' })); strap.rotation.x = Math.PI / 2; strap.position.y = y; wrist.add(strap); }
  if (cls === 'warrior') { const rim = new THREE.Mesh(new THREE.TorusGeometry(0.043, 0.006, 5, 16), new THREE.MeshStandardMaterial({ color: CLASSES.warrior.colors.trim, metalness: 0.9, roughness: 0.3 })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.03; wrist.add(rim); }
  g.userData.wrist = wrist;
  g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
  return g;
}
class ViewModel {
  constructor(camera, app, cls) {
    this.g = new THREE.Group(); camera.add(this.g);
    this.R = new THREE.Group(); this.L = new THREE.Group(); this.R.rotation.order = this.L.rotation.order = 'YXZ'; this.g.add(this.R, this.L);
    this.R.add(makeHand(true, cls, app.skin)); this.L.add(makeHand(false, cls, app.skin));
    const c = CLASSES[cls].colors;
    const sleeve = cls === 'warrior' ? new THREE.MeshStandardMaterial({ color: '#8a929c', roughness: 0.4, metalness: 0.75 }) : new THREE.MeshStandardMaterial({ color: c.main, roughness: 0.85, side: THREE.DoubleSide });
    const trimM = new THREE.MeshStandardMaterial({ color: c.trim, roughness: 0.45, metalness: cls === 'ranger' ? 0 : 0.6 });
    this.arms = [this.R, this.L].map(H => {
      const arm = new THREE.Group(); this.g.add(arm);
      // forearm: tapered sleeve (wizards get a wide bell sleeve), a trim ring and some cloth folds
      const geo = cls === 'wizard' ? new THREE.CylinderGeometry(0.052, 0.085, 1, 16, 1, true) : new THREE.CylinderGeometry(0.044, 0.058, 1, 16, 1, true);
      const m = new THREE.Mesh(geo, sleeve); arm.add(m);
      const trim = new THREE.Mesh(new THREE.TorusGeometry(cls === 'wizard' ? 0.055 : 0.047, 0.007, 6, 18), trimM); trim.rotation.x = Math.PI / 2; arm.add(trim);
      if (cls === 'warrior') { for (let i = 1; i < 4; i++) { const band = new THREE.Mesh(new THREE.TorusGeometry(0.05 + i * 0.002, 0.004, 4, 16), sleeve); band.rotation.x = Math.PI / 2; band.userData.t = i * 0.12; arm.add(band); } }
      arm.traverse(o => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
      return { arm, m, trim, H };
    });
    this.anchor = [new THREE.Vector3(0.36, -1.15, -0.25), new THREE.Vector3(-0.36, -1.15, -0.25)];
    this.weapons = {}; this.bob = 0; this.sprintK = 0;
  }
  setWeapon(w) {
    for (const k in this.weapons) { const o = this.weapons[k]; o.parent && o.parent.remove(o); }
    this.weapons = {}; this.wt = w ? w.wt : null; if (!w) return;
    const W = WEAPON_TYPES[w.wt];
    const main = makeWeapon(W.parts[0], w.tier, w.rarity, W.element);
    if (W.kind === 'bow') { this.L.add(main); main.scale.setScalar(0.6); this.weapons.bow = main; const ar = new THREE.Group(); const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.75, 5), new THREE.MeshStandardMaterial({ color: '#8a6a44' })); shaft.rotation.x = Math.PI / 2; shaft.position.z = -0.35; ar.add(shaft); const tip = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.07, 4), new THREE.MeshStandardMaterial({ color: '#999', metalness: 0.8 })); tip.rotation.x = -Math.PI / 2; tip.position.z = -0.74; ar.add(tip); this.R.add(ar); this.weapons.arrow = ar; }
    else { this.R.add(main); this.weapons.main = main; }
    if (W.kind === 'staff') main.position.y = -0.55;
    if (w.wt === 'spear') main.position.y = -0.55;
    if (W.hands === 'two' && w.wt !== 'spear') main.position.y = -0.1;
    if (W.kind === 'melee' && w.wt !== 'spear') main.rotation.y = 0.45; // show the blade at an angle, like Skyrim
    if (W.parts[1]) { const off = makeWeapon(W.parts[1], w.tier, w.rarity); this.L.add(off); this.weapons.off = off; if (W.parts[1] !== 'shield') off.rotation.y = -0.45; if (W.parts[1] === 'shield') { off.rotation.set(0, 0, 0); off.scale.setScalar(0.66); off.position.set(0.04, 0.12, -0.03); } }
    for (const k in this.weapons) this.weapons[k].scale.multiplyScalar(1.25);
    this.g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
    this.W = W;
  }
  setTool(tool, tier) { if (this.tool) { this.tool.parent.remove(this.tool); this.tool = null; } for (const k in this.weapons) this.weapons[k].visible = !tool; if (tool) { this.tool = makeWeapon(tool, tier); this.R.add(this.tool); this.tool.traverse(o => { if (o.isMesh) o.castShadow = false; }); } }
  apply(H, p) { H.position.set(p[0], p[1], p[2]); H.rotation.set(p[3], p[4], p[5]); }
  update(dt, st) {
    const W = this.W, act = st.act;
    let r = W ? (W.kind === 'staff' ? VP.staff : this.wt === 'spear' ? VP.spRest : W.hands === 'two' ? VP.rest2 : VP.rest) : VP.rest;
    let l = !W ? VP.hideL : W.hands === 'shield' ? VP.shieldRest : W.hands === 'dual' ? VP.restL : W.kind === 'bow' ? VP.bowL : W.kind === 'staff' ? VP.hideL : null;
    if (W && W.kind === 'bow') r = VP.bowR;
    const t = act ? act.t : 0, n = act ? act.name : '';
    if (st.tool) {
      if (n === 'chop' || n === 'mine') r = seq(n === 'chop' ? VP.chopA : VP.s3a, n === 'chop' ? VP.chopB : VP.s3b, t, 0.45);
      else r = plerp(VP.gatherR, VP.gatherR2, 0.5 + 0.5 * Math.sin(t * Math.PI * 4));
      l = W && W.kind === 'bow' ? VP.hideL : l;
      if (W && (W.kind === 'bow' || W.hands === 'dual' || W.kind === 'staff')) l = VP.hideL;
    } else if (act) {
      const dual = W && W.hands === 'dual';
      switch (n) {
        case 'swing1': r = seq(VP.s1a, VP.s1b, t, 0.3); break;
        case 'swing2': r = seq(VP.s2a, VP.s2b, t, 0.3); break;
        case 'swing3': r = seq(VP.s3a, VP.s3b, t, 0.42); if (dual) l = seq(mirror(VP.s3a), mirror(VP.s3b), t, 0.42, VP.restL); break;
        case 'off1': l = seq(mirror(VP.s1a), mirror(VP.s1b), t, 0.3, VP.restL); break;
        case 'off2': l = seq(mirror(VP.s2a), mirror(VP.s2b), t, 0.3, VP.restL); break;
        case 'charge': { const k = Math.min(1, t); r = plerp(this.wt === 'spear' ? VP.spRest : VP.rest, this.wt === 'spear' ? VP.th3A : VP.ha, ease(k)); r = r.map((v, i) => v + (i < 3 ? Math.sin(performance.now() * 0.05) * 0.004 * st.charge : 0)); if (dual) l = plerp(VP.restL, mirror(VP.ha), ease(k)); break; }
        case 'smash': r = seq(VP.ha, VP.hb, t, 0.5); if (dual || (W && W.hands === 'two')) l = seq(mirror(VP.ha), mirror(VP.hb), t, 0.5, VP.restL); break;
        case 'stabR': r = seq(VP.thA, VP.thB, t, 0.3, VP.rest); break;
        case 'stabL': l = seq(mirror(VP.thA), mirror(VP.thB), t, 0.3, VP.restL); break;
        case 'spin': { const k = ease(Math.min(1, t / 0.8)); const a2 = lerp(-2.6, 2.6, k); r = [lerp(0.6, -0.6, k), -0.15, -0.42, -1.4, a2 * 0.55, 0.3]; l = [lerp(0.6, -0.6, (k + 0.15) % 1), -0.22, -0.42, -1.4, a2 * 0.55, -0.3]; break; }
        case 'heavy': r = this.wt === 'spear' ? seq(VP.th3A, VP.th3B, t, 0.15, VP.th3A) : seq(VP.ha, VP.hb, t, 0.12, VP.ha); if (dual) l = seq(mirror(VP.ha), mirror(VP.hb), t, 0.12, mirror(VP.ha)); break;
        case 'thrust1': case 'thrust2': r = seq(VP.thA, VP.thB, t, 0.35, VP.spRest); break;
        case 'thrust3': r = seq(VP.th3A, VP.th3B, t, 0.4, VP.spRest); break;
        case 'area': case 'fury': { const k = n === 'fury' ? (t * 6) % 1 : ease(Math.min(1, t / 0.85)); const a = lerp(-2.4, 2.4, k); r = [lerp(0.6, -0.6, k), -0.2, -0.45, -1.4, a * 0.55, 0.3]; if (dual || n === 'fury') l = n === 'fury' ? [lerp(-0.6, 0.6, (t * 6 + 0.5) % 1), -0.25, -0.45, -1.4, -lerp(-2.4, 2.4, (t * 6 + 0.5) % 1) * 0.55, -0.3] : [lerp(-0.6, 0.6, k), -0.25, -0.45, -1.4, -a * 0.55, -0.3]; break; }
        case 'shoot': r = t < 0.5 ? plerp(VP.bowR, VP.bowRdraw, easeOut(t * 2)) : plerp(VP.bowRdraw, VP.bowR, (t - 0.5) * 2); break;
        case 'draw': r = plerp(VP.bowR, VP.bowRdraw, easeOut(Math.min(1, t))); break;
        case 'release': r = plerp(VP.bowRdraw, VP.bowR, ease(t)); break;
        case 'cast': r = seq(VP.staffCast, VP.staffCast, t, 0.3, VP.staff); if (W && W.kind === 'staff') l = seq(VP.castL, VP.castL, t, 0.3, VP.hideL); else l = seq(VP.castL, VP.castL, t, 0.3, l || VP.hideL); break;
        case 'chargeCast': r = plerp(VP.staff, VP.staffHigh, ease(Math.min(1, t))); l = plerp(VP.hideL, VP.castL, ease(Math.min(1, t))); break;
        case 'castBig': r = seq(VP.staffHigh, VP.staffSlam, t, 0.45, VP.staff); l = seq(VP.castL, VP.castL, t, 0.3, VP.hideL); break;
        case 'spell': l = seq(VP.castL, VP.castL, t, 0.25, l || VP.hideL); if (W && W.kind === 'staff') r = seq(VP.staffCast, VP.staffCast, t, 0.3, VP.staff); break;
      }
    } else if (st.block) {
      if (W && W.hands === 'shield') { l = VP.shieldBlock; r = plerp(VP.rest, VP.blockW, 0.3); }
      else if (W && W.kind === 'staff') r = [0.05, -0.3, -0.5, -0.1, 0, 1.3];
      else { r = VP.blockW; if (W && W.hands === 'dual') l = [-0.12, -0.2, -0.45, -0.3, 0, -1.45]; }
    } else if (st.drawing) { r = plerp(VP.bowR, VP.bowRdraw, easeOut(Math.min(1, st.drawing))); }
    // sprinting: lower the weapon and pump the arms
    this.sprintK += ((st.sprint && !act && !st.block && !st.tool ? 1 : 0) - this.sprintK) * Math.min(1, dt * 8);
    if (this.sprintK > 0.01) {
      const sp = W && W.kind === 'bow' ? [0.05, -0.3, -0.5, 0.2, 0.3, 0.9] : W && W.kind === 'staff' ? [0.35, -0.55, -0.45, -0.6, 0.4, -0.7] : [0.36, -0.42, -0.42, -0.25, 0.5, -1.0];
      r = plerp(r, sp, this.sprintK);
      if (l && W && W.kind !== 'bow') l = plerp(l, [-0.36, -0.45, -0.42, -0.2, -0.5, 1.0], this.sprintK);
    }
    // two-handers: left hand on the grip below the right
    this.apply(this.R, r);
    if (W && W.hands === 'two' && !st.tool) { this.L.position.copy(this.R.localToWorld(new THREE.Vector3(0, -0.14, 0))); this.g.worldToLocal(this.L.position); this.L.rotation.copy(this.R.rotation); this.L.visible = true; }
    else if (l) { this.apply(this.L, l); this.L.visible = true; } else this.L.visible = false;
    // bob & sway: arms swing with each stride, harder and faster when sprinting
    this.bob += dt * st.speed * 1.75;
    const run = Math.min(1, st.speed / 5) * (act ? 0.35 : 1), amp = run * (0.022 + this.sprintK * 0.05);
    const ph = this.bob;
    const spread = run * (0.09 + this.sprintK * 0.06);
    this.R.position.x += spread; this.R.position.y -= spread * 0.6; this.R.rotation.z -= spread * 1.2;
    if (this.L.visible && !(W && W.hands === 'two')) { this.L.position.x -= spread; this.L.position.y -= spread * 0.6; this.L.rotation.z += spread * 1.2; }
    this.R.position.y += Math.sin(ph) * amp; this.R.position.x += Math.cos(ph * 0.5) * amp * 0.6; this.R.position.z += Math.cos(ph) * amp * 0.8 * this.sprintK; this.R.rotation.z += Math.sin(ph) * amp * 1.2; this.R.rotation.x += Math.cos(ph) * amp * (1 + this.sprintK * 3);
    if (this.L.visible && !(W && W.hands === 'two')) { this.L.position.y += Math.sin(ph + Math.PI) * amp; this.L.position.x += Math.cos(ph * 0.5) * amp * 0.6; this.L.position.z += Math.cos(ph + Math.PI) * amp * 0.8 * this.sprintK; this.L.rotation.x += Math.cos(ph + Math.PI) * amp * (1 + this.sprintK * 3); }
    const bob = settings.headBob ? Math.abs(Math.sin(this.bob)) * 0.01 * run : 0;
    this.g.position.set(st.swayX, -0.04 - bob - 0.004 * Math.sin(performance.now() * 0.0015) + st.swayY, -0.16);
    // bow string pull
    if (this.weapons.bow) { const s = this.weapons.bow.userData.string; const pull = st.drawing ? Math.min(1, st.drawing) : n === 'shoot' && t < 0.5 ? easeOut(t * 2) : 0; const a = s.geometry.attributes.position; a.setZ(1, 0.02 + pull * 0.5); a.needsUpdate = true; this.weapons.arrow.visible = pull > 0.05 || st.drawing > 0; }
    // forearms follow from the wrist down toward the elbow (off screen)
    for (let i = 0; i < 2; i++) {
      const { arm, m, trim, H } = this.arms[i]; arm.visible = false;
      if (!H.visible) continue;
      const wr = H.children[0].userData.wrist;
      const w = new THREE.Vector3(); wr.getWorldPosition(w); this.g.worldToLocal(w);
      const a = this.anchor[i], d = a.clone().sub(w), len = d.length(); d.normalize();
      arm.position.copy(w); arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
      m.scale.set(1, len, 1); m.position.set(0, len / 2 + 0.03, 0);
      trim.position.set(0, 0.035, 0);
      for (const c of arm.children) if (c.userData.t) c.position.set(0, 0.06 + c.userData.t, 0);
    }
  }
}

// ---------- Player ----------
export class Player {
  constructor(hero) {
    this.h = hero;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.yaw = 0; this.pitch = 0; this.bodyYaw = 0;
    this.radius = 0.4; this.onGround = true; this.swim = false; this.dead = false;
    this.camDist = 0; this.camDistT = 0;
    this.cd = { w0: 0, w1: 0, a1: 0, a2: 0, a3: 0, dodge: 0 }; this.useCd = 0;
    this.atk = null; this.queued = null; this.combo = 0; this.comboT = 0; this.press = null; this.block = false;
    this.dodge = null; this.iframes = 0; this.stealth = 0; this.buffs = { cry: 0, fury: 0, nextCrit: false }; this.regen = null;
    this.gathering = null; this.hurtT = 0; this.stepAcc = 0; this.lastSurf = 'grass'; this.endUseT = 0; this.manaUseT = 0;
    this.fb = {}; this.swayX = 0; this.swayY = 0; this.fovKick = 0; this.landDip = 0; this.lookDX = 0; this.lookDY = 0;
    const app = Object.assign({ race: hero.race, sex: hero.sex, cls: hero.cls }, hero.app);
    this.app = app;
    this.vm = new ViewModel(G.vmCam, app, hero.cls);
    this.trail = V.trail('#ffffff'); this.trailL = V.trail('#ffffff');
    this.refreshGear(true);
    this.eye = this.ch.height * 0.9;
    const D = heroDerived(hero); this.hp = this.maxHp; this.mana = this.maxMana; this.end = this.maxEnd;
  }
  get level() { return this.h.level; }
  pk(id) { return perk(this.h, id); }
  wp() { return 0; }
  skills() { const w = this.weapon; return w ? slotSkills(w.wt, this.h.wsel || {}) : []; }
  get weapon() { return activeWeapon(this.h); }
  get W() { const w = this.weapon; return w ? WEAPON_TYPES[w.wt] : null; }
  refreshStatsOnly() { const D = heroDerived(this.h); this.D = D; this.maxHp = D.maxHp; this.hp = Math.min(this.hp, this.maxHp); this.maxMana = D.maxMana; this.maxEnd = D.maxEnd; }
  refreshGear(first) {
    const D = heroDerived(this.h); this.D = D;
    const oldMax = this.maxHp || D.maxHp;
    this.maxHp = D.maxHp; this.maxMana = D.maxMana; this.maxEnd = D.maxEnd;
    if (!first) { this.hp = Math.min(this.maxHp, this.hp * (this.maxHp / oldMax)); this.mana = Math.min(this.mana, this.maxMana); this.end = Math.min(this.end, this.maxEnd); }
    const w = this.weapon;
    // rebuild the body so armour colours and the weapon bake into few meshes
    const old = this.ch; const vis = old ? old.root.visible : true;
    if (old) G.scene.remove(old.root);
    this.ch = buildHumanoid(this.app);
    equipWeapon(this.ch, w ? w.wt : null, w ? w.tier : 0, w ? w.rarity : 0);
    tintGear(this.ch, this.h.equip);
    bake(this.ch.root); this.ch.root.visible = vis; G.scene.add(this.ch.root);
    if (old) { this.ch.anim = old.anim; this.ch.root.position.copy(old.root.position); this.ch.root.rotation.copy(old.root.rotation); }
    this.vm.setWeapon(w);
    const col = w ? (w.rarity >= 2 ? RARITY[w.rarity].col : WEAPON_TYPES[w.wt].element === 'fire' ? '#ff9050' : '#ffffff') : '#fff';
    this.trail.mat.uniforms.color.value.set(col); this.trailL.mat.uniforms.color.value.set(col);
  }
  place(x, z, yaw) { this.pos.set(x, heightAt(x, z), z); this.yaw = yaw; this.bodyYaw = yaw; this.vel.set(0, 0, 0); }

  // ---------- input ----------
  onKey(code, down) {
    if (!down) return;
    if (this.dead) return;
    switch (code) {
      case 'Space': this.jump(); break;
      case 'ShiftLeft': case 'ShiftRight': this.shiftT = G.time; break;
      case 'KeyQ': this.swapWeapon(); break;
      case 'Digit1': this.hotbar(0); break;
      case 'Digit2': this.hotbar(1); break;
      case 'Digit3': this.hotbar(2); break;
      case 'Digit4': this.hotbar(3); break;
      case 'Digit5': this.hotbar(4); break;
      case 'Digit6': this.hotbar(5); break;
      case 'KeyE': this.interact(); break;
      case 'KeyR': this.quaff(); break;
      case 'KeyV': this.camDistT = this.camDistT > 0.5 ? 0 : 3.2; break;
    }
  }
  onKeyUp(code) { if ((code === 'ShiftLeft' || code === 'ShiftRight') && this.shiftT != null) { if (G.time - this.shiftT < 0.22 && !G.uiOpen) this.tryDodge(); this.shiftT = null; } }
  onMouse(btn, down) {
    if (this.dead || G.uiOpen) return;
    if (down && this.db && this.db.stun && this.db.stun.t > 0) return;
    if (btn === 0) { if (down) { this.cancelGather(); this.light(); } }
    else if (btn === 2) this.rmbDown = down;
  }
  onWheel(dy) { this.camDistT = clamp(this.camDistT + dy * 0.004, 0, 9); if (this.camDistT < 0.7 && dy < 0) this.camDistT = 0; else if (this.camDistT > 0 && this.camDistT < 1.6 && dy > 0) this.camDistT = 2.2; }
  look(dx, dy) { const s = 0.0032 * settings.sens; this.yaw -= dx * s; this.pitch = clamp(this.pitch - dy * s * (settings.invertY ? -1 : 1), -1.45, 1.45); }

  // ---------- helpers ----------
  fwd() { return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  right() { return new THREE.Vector3(-Math.cos(this.yaw), 0, Math.sin(this.yaw)); }
  busy() { return !!(this.atk || this.dodge || this.gathering || this.dead); }
  spend(cost) {
    cost = Math.round(cost * (this.h.cls === 'wizard' && this.pk('cap') ? 0.75 : 1) * (this.buffs.surge > 0 ? 0 : 1));
    const uses = CLASS_POOLS[this.h.cls].uses;
    const cur = uses === 'mana' ? this.mana : this.end;
    if (cur < cost) { G.hooks.toast && G.hooks.toast(uses === 'mana' ? 'Not enough mana' : 'Not enough endurance', '⚠', 'bad'); S.error(); return false; }
    if (uses === 'mana') { this.mana -= cost; this.manaUseT = 1.2; } else { this.end -= cost; this.endUseT = 1.2; }
    return true;
  }
  handPos(left) {
    if (this.camDist < 0.6) { const o = G.camera.position.clone(); return o.add(new THREE.Vector3(left ? -0.25 : 0.25, -0.22, -0.7).applyQuaternion(G.camera.quaternion)); }
    const p = this.pos.clone(); p.y += this.eye * 0.8; return p.addScaledVector(this.fwd(), 0.5).addScaledVector(this.right(), left ? -0.3 : 0.3);
  }
  aimDir(from) { const a = aimRay(120); return a.point.clone().sub(from).normalize(); }
  speedMul() { let m = 1; if (this.W && this.W.hands === 'dual' && dualRank(this.h.dualKills) >= 2) m *= 1.08; if (this.buffs.fury > 0) m *= 1.5; return m; }

  // what a swing sounds like: maces and hammers whoosh low, axes chop, spears swish, daggers flick, swords ring
  swingKind(name) {
    const wt = this.weapon ? this.weapon.wt : '';
    if (wt === 'maceshield' || wt === 'warhammer') return 'blunt';
    if (wt === 'swordmace') return name === 'off1' ? 'blunt' : 'blade';
    if (wt === 'greataxe' || wt === 'handaxes') return 'axe';
    if (wt === 'spear') return 'spear';
    if (wt === 'daggers') return 'light';
    if (this.W && this.W.kind === 'staff') return 'staff';
    return 'blade';
  }
  // ---------- attacks ----------
  light() {
    if (this.dodge || this.gathering || this.swim) return;
    const W = this.W; if (!W) return;
    if (this.block) return;
    if (this.atk) { if (this.atk.t > 0.35 && !this.atk.noQueue) this.queued = 'light'; return; }
    if (W.kind === 'bow') return this.startAtk('shoot', 0.5 / (1 + this.wp('combo') * 0.12) / (1 + this.pk('quickdraw') * 0.3) / this.speedMul(), { charge: 0 });
    if (W.kind === 'staff') return this.startAtk('cast', 0.55 / W.speed / (1 + this.wp('combo') * 0.12) / this.speedMul(), { charge: 0 });
    const C = COMBOS[this.weapon.wt]; if (!C) return;
    if (this.comboT <= 0) this.combo = 0;
    const i = this.combo % C.chain.length; this.combo = i + 1;
    const st = C.chain[i];
    const dur = 0.52 * (st.d || 1) / (W.speed * this.speedMul());
    this.startAtk(st.a, dur, { combo: i, step: st, last: i === C.chain.length - 1 });
  }
  releaseHeavy(p) {
    const W = this.W; if (!W) return;
    const charge = clamp((p.t - 0.22) / 0.8 * (1 + this.wp('heavy') * 0.3 + this.pk('heavyhit') * 0.4 + (W.kind === 'bow' ? this.pk('quickdraw') * 0.3 : 0)), 0, 1);
    if (W.kind === 'bow') return this.startAtk('release', 0.3, { charge, fire: true });
    if (W.kind === 'staff') return this.startAtk('cast', 0.45, { charge, big: true });
    this.startAtk('heavy', 0.75 / W.speed, { charge });
  }
  startAtk(name, dur, o = {}) {
    this.atk = Object.assign({ name, t: 0, dur, hit: false }, o);
    const W = this.W;
    if (W && W.kind === 'melee' && !['charge'].includes(name)) { const big = name === 'swing3' || name === 'heavy' || name === 'thrust3'; S.swingW(this.swingKind(name), big ? 1.5 : W.hands === 'two' ? 1.25 : 0.9, this.pos); if (name === 'heavy') S.swingW(this.swingKind(name), 1.8, this.pos); }
  }
  updateAttack(dt) {
    // charging heavy (hold left click)
    if (false && this.press && !G.uiOpen) {
      this.press.t += dt;
      if (this.press.t > 0.22 && !this.press.charging && !this.atk && !this.dodge && !this.block && this.W) {
        this.press.charging = true;
        if (this.W.kind === 'bow') S.bowDraw(); else if (this.W.kind === 'staff') S.charge(this.W.element); else S.charge('none');
      }
    }
    const a = this.atk; if (!a) return;
    a.t += dt / a.dur;
    const W = this.W;
    const hitAt = a.name === 'smash' ? 0.62 : a.name === 'spin' ? 0.5 : a.name === 'swing3' || a.name === 'thrust3' ? 0.5 : a.name === 'heavy' ? 0.3 : a.name === 'area' ? 0.25 : a.name === 'cast' ? 0.3 : a.name === 'shoot' ? 0.5 : a.name === 'release' ? 0.02 : a.name === 'castBig' ? 0.55 : 0.4;
    if (!a.hit && a.t >= hitAt) { a.hit = true; this.doHit(a); }
    // fury flurry: several hits
    if (a.name === 'fury') { const k = Math.floor(a.t * a.hits); if (k > (a.done || 0) && k <= a.hits) { a.done = k; this.furyHit(a, k); } }
    // trails
    const tr = this.camDist < 0.6 ? this.vm.weapons.main : this.ch.weapons.main;
    const trActive = W && W.kind === 'melee' && a.t > hitAt - 0.25 && a.t < hitAt + 0.25 && a.name !== 'off1' && a.name !== 'stabL';
    this.trail.active = trActive;
    if (trActive && tr) this.trail.push(tr.userData.base.getWorldPosition(new THREE.Vector3()), tr.userData.tip.getWorldPosition(new THREE.Vector3()));
    const trl = this.camDist < 0.6 ? this.vm.weapons.off : this.ch.weapons.off;
    const offActive = W && W.hands === 'dual' && (a.name === 'off1' || a.name === 'stabL' || a.name === 'spin' || a.name === 'swing3' || a.name === 'fury' || a.name === 'heavy' || a.name === 'smash') && a.t > 0.1 && a.t < 0.8;
    this.trailL.active = offActive;
    if (offActive && trl) this.trailL.push(trl.userData.base.getWorldPosition(new THREE.Vector3()), trl.userData.tip.getWorldPosition(new THREE.Vector3()));
    if (a.t >= 1) {
      this.atk = null; this.trail.active = this.trailL.active = false;
      this.comboT = 0.55;
      if (a.last) this.combo = 0;
      if (this.queued) { const q = this.queued; this.queued = null; if (q === 'light') this.light(); }
    }
  }
  doHit(a) {
    const W = this.W, w = this.weapon; if (!W) return;
    const base = weaponDamage(this.h, w);
    const yaw = this.yaw;
    if (W.kind === 'melee') {
      if (a.name === 'area') return;
      const st = a.step || { m: 1 }, wt = this.weapon.wt;
      const blunt = wt === 'maceshield' || wt === 'warhammer' || !!st.blunt;
      const swordHit = (wt === 'swordshield' || wt === 'swordmace') && !st.blunt;
      let reach = W.reach * (a.name === 'smash' ? 1.1 : 1), half = st.cleave ? 1.3 : wt === 'spear' ? 0.35 : 0.85;
      let targets;
      if (st.aoe) targets = mobsInRadius(this.pos, st.aoe);
      else if (st.line) targets = mobsInCone(this.pos, yaw, reach * 1.7, 0.22);
      else if (this.pk('cleave') && a.last) targets = mobsInRadius(this.pos, reach);
      else { targets = mobsInCone(this.pos, yaw, reach, half); if (!st.cleave) targets = targets.sort((x, y) => x.dist2(this.pos) - y.dist2(this.pos)).slice(0, 2); }
      const big = !!a.last;
      for (const m of targets) {
        const kn = m.pos.clone().sub(this.pos).setY(0).normalize().multiplyScalar(st.knock || (big ? 6 : 1.5));
        this.dealDamage(m, base * st.m, { knock: kn, big, offhand: a.name === 'off1' || a.name === 'stabL', melee: true, blunt, critBonus: (swordHit ? 0.1 : 0) + (st.crit || 0), bleed: st.bleed ? base * 0.09 : 0, stun: st.stun || 0 });
        if (blunt) S.blunt(m.pos);
      }
      if (targets.length) { G.hitstop = big ? 0.09 : 0.04; V.addShake(big ? 0.3 : 0.08); }
      const fp = this.pos.clone().addScaledVector(this.fwd(), reach * 0.8); fp.y = heightAt(fp.x, fp.z);
      if (st.shock) { for (const m of mobsInRadius(fp, st.shock)) if (!targets.includes(m)) this.dealDamage(m, base * st.m * 0.5, { melee: true, blunt, slow: 2, knock: m.pos.clone().sub(fp).setY(0).normalize().multiplyScalar(6) }); V.ring(fp, st.shock, '#ffe0a0', 0.45); V.burst('stone', fp, 26, { speed: 7, size: 0.3, grav: 14 }); V.burst('dust', fp, 20, { speed: 4, size: 1, life: 1.2 }); S.hit('stone', fp); S.rumble(fp, 0.5); V.addShake(0.35); }
      if (a.name === 'spin') { V.ring(this.pos, st.aoe || 3, '#e0e8ff', 0.35); V.burst('spark', this.pos.clone().setY(this.pos.y + 1), 30, { speed: 7 }); S.swingW('light', 1.6, this.pos); }
      if (st.line) { V.burst('spark', fp, 14, { speed: 5 }); }
      if (big && !st.shock && W.hands === 'two') V.burst('dust', fp, 12, { speed: 3, size: 0.45 });
    } else if (W.kind === 'bow') {
      const from = this.handPos(true), dir = this.aimDir(from);
      const charge = a.name === 'release' ? a.charge : 0.25;
      const speed = 38 + charge * 40;
      spawnProjectile({ pos: from, vel: dir.multiplyScalar(speed), grav: 9 - charge * 4, radius: 0.15, dmg: base * (0.9 + charge * 1.7) * (a.name === 'release' ? 1 + this.wp('heavy') * 0.15 : 1), owner: 'player', kind: 'arrow', life: 4, charged: charge > 0.7, pierce: charge > 0.95 });
      S.bowShot(this.pos);
    } else if (W.kind === 'staff') {
      const from = this.camDist < 0.6 ? G.camera.position.clone().add(new THREE.Vector3(0.12, -0.12, -0.9).applyQuaternion(G.camera.quaternion)) : (this.ch.weapons.main?.userData.orb?.getWorldPosition(new THREE.Vector3()) || this.handPos());
      const dir = this.aimDir(from), el = W.element, big = a.big && a.charge > 0.2, ch = a.charge || 0;
      const sc = big ? 1 + ch * 1.4 : 1;
      if (el === 'fire') spawnProjectile({ pos: from, vel: dir.multiplyScalar(34 - ch * 6), grav: 3.5 + ch * 3, radius: 0.25 * sc, dmg: base * (1 + ch * 1.6), owner: 'player', kind: 'fireball', scale: sc, life: 4, onHit: (p, m, pos) => this.fireBurst(pos, (big ? 2.6 : 1.6) * sc * 0.8, p.dmg, m) });
      else if (el === 'frost') spawnProjectile({ pos: from, vel: dir.multiplyScalar(46), grav: 2.5, radius: 0.22 * sc, dmg: base * (1 + ch * 1.4), owner: 'player', kind: 'frost', scale: sc, life: 3, pierce: big, onHit: (p, m, pos) => { if (m) this.dealDamage(m, p.dmg, { slow: 3, freeze: big && ch > 0.8 ? 2 : 0, el: 'frost' }); V.burst('frost', pos, 14 * sc, { speed: 4 }); S.cast('frost', pos); } });
      else spawnProjectile({ pos: from, vel: dir.multiplyScalar(52), grav: 1.5, radius: 0.22 * sc, dmg: base * (0.95 + ch * 1.5), owner: 'player', kind: 'arcane', scale: sc, life: 3, home: true, onHit: (p, m, pos) => { if (m) this.dealDamage(m, p.dmg, { el: 'arcane' }); V.burst('arcane', pos, 16 * sc, { speed: 4 }); V.light(pos, '#a050ff', 3, 0.2); S.cast('arcane', pos, 0.6); } });
      if (this.pk('echo') && !a.echoed && Math.random() < 0.15) { setTimeout(() => { if (!this.dead) this.doHit(Object.assign({}, a, { echoed: true })); }, 140); }
      S.cast(el, from, big ? 1.4 : 0.8);
      V.burst(el === 'fire' ? 'fire' : el, from, 8, { speed: 2 }); V.light(from, el === 'fire' ? '#ff7020' : el === 'frost' ? '#60c0ff' : '#b060ff', 2, 0.15, 8);
    }
  }
  fireBurst(pos, r, dmg, direct) {
    if (direct) this.dealDamage(direct, dmg, { el: 'fire', burn: dmg * 0.08 });
    for (const m of mobsInRadius(pos, r)) if (m !== direct) this.dealDamage(m, dmg * 0.5, { el: 'fire', burn: dmg * 0.05 });
    V.burst('fire', pos, 18 + r * 6, { speed: 3 + r, size: 0.5 + r * 0.15, life: 0.5 }); V.burst('smoke', pos, 5, { speed: 1.5, size: 0.8, life: 1.2, vy: 1.5 });
    V.light(pos, '#ff6020', 3 + r, 0.25, 6 + r * 3); S.explode(pos, 0.35 + r * 0.15); if (r > 2) V.ring(pos, r, '#ffa040', 0.35);
  }

  // ---------- weapon abilities on F and C ----------
  weaponAbility(slot) {
    const W = this.W; if (!W || this.busy() || this.swim) return;
    const sk = this.skills()[slot]; if (!sk) return;
    const key = 'w' + slot;
    if (this.cd[key] > 0) { S.error(); return; }
    const S2 = WSKILLS[sk.id], fam = sk.fam;
    const aR = 1 + this.wp('area', fam) * 0.15, aCd = 1 - this.wp('area', fam) * 0.15;
    this.cd[key] = S2.cd * aCd;
    const base = weaponDamage(this.h, this.weapon), f = this.fwd(), p0 = this.pos.clone();
    const spin = (r, mult, extra = {}, sound = 1.6) => {
      this.atk = { name: 'area', t: 0, dur: 0.7, hit: true, noQueue: true };
      S.swingW(this.swingKind('area'), sound, this.pos); S.swingW(this.swingKind('area'), 1.3, this.pos);
      setTimeout(() => { if (this.dead) return; const p = this.pos.clone(); areaDamage(p, r * aR, base * mult, Object.assign({ knock: 7, big: true, melee: true }, extra)); V.ring(p, r * aR, '#fff0c0', 0.45); V.burst('dust', p.clone().setY(p.y + 0.2), 20 + r * 4, { speed: r * 1.2, size: 0.45, up: 0.3, radius: r * 0.6 }); V.addShake(0.25); S.hit('stone', p); }, 200);
    };
    const front = (reach, half, mult, extra = {}, delay = 260, anim = 'swing3') => {
      this.atk = { name: anim, t: 0, dur: 0.75, hit: true, noQueue: true };
      S.swingW(this.swingKind('swing3'), 1.6, this.pos);
      setTimeout(() => { if (this.dead) return; let hit = false; for (const m of mobsInCone(this.pos, this.yaw, reach * aR, half)) { hit = true; this.dealDamage(m, base * mult * (extra.exec && m.hp < m.maxHp * 0.35 ? 2 : 1), Object.assign({ big: true, melee: true, knock: m.pos.clone().sub(this.pos).setY(0).normalize().multiplyScalar(5) }, extra)); if (this.swingKind('swing3') === 'blunt') S.blunt(m.pos); } if (hit) { G.hitstop = 0.08; V.addShake(0.3); } const p = this.pos.clone().addScaledVector(this.fwd(), reach * 0.7); p.y = heightAt(p.x, p.z); V.burst('dust', p, 14, { speed: 3, size: 0.5 }); }, delay);
    };
    const dash = (dist, mult, extra = {}) => {
      this.dodge = { t: 0, dur: dist / 30, dir: f.clone(), speed: 30, charge: true, hitSet: new Set(), dmg: base * mult, extra }; this.fovKick = 12;
      this.atk = { name: 'thrust3', t: 0.3, dur: 0.5, hit: true, noQueue: true };
    };
    const throwP = (kind, speed, mult, extra = {}, pierce = false, n = 1, spread = 0) => {
      const from = this.handPos(), dir = this.aimDir(from);
      for (let i = 0; i < n; i++) { const d = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), (i - (n - 1) / 2) * spread); spawnProjectile({ pos: from.clone(), vel: d.multiplyScalar(speed), grav: kind === 'arrow' ? 8 : 3, radius: kind === 'wave' ? 1.3 : 0.3, dmg: base * mult, owner: 'player', kind, life: 2.5, pierce, onHit: extra.onHit }); }
      this.atk = { name: W.kind === 'bow' ? 'shoot' : W.kind === 'staff' ? 'cast' : 'swing2', t: 0.3, dur: 0.5, hit: true };
    };
    switch (sk.id) {
      case 'whirlwind': spin(4.5, 1.5); break;
      case 'greatcleave': spin(6.5, 1.7); break;
      case 'sweep': spin(5.5, 1.5); break;
      case 'reaping': spin(6.5, 1.4, { bleed: base * 0.1 }); break;
      case 'quake': spin(7, 1.4, { slow: 3 }); break;
      case 'lunge': dash(8, 2.0); break;
      case 'shieldcharge': dash(11, 1.4, { stun: 1.5 }); S.block(true, this.pos); break;
      case 'skullcrack': front(this.W.reach + 0.5, 0.6, 2.2, { stun: 1.6 }); break;
      case 'execute': front(this.W.reach + 0.5, 0.8, 2.4, { exec: true }, 330, 'heavy'); break;
      case 'rend': front(this.W.reach + 0.4, 0.8, 1.3, { bleed: base * 0.25 }); break;
      case 'shieldbash': { this.atk = { name: 'heavy', t: 0.2, dur: 0.6, hit: true, noQueue: true }; S.block(true, this.pos); setTimeout(() => { if (this.dead) return; const p = this.pos.clone(); areaDamage(p, 5 * aR, base * 1.1, { knock: 11, stun: 2, big: true, melee: true }); V.ring(p, 5 * aR, '#c0d8ff', 0.4); V.burst('dust', p, 30, { speed: 6, size: 0.6, up: 0.3 }); S.blunt(p); S.hit('stone', p); V.addShake(0.35); }, 250); break; }
      case 'shockwave': { this.atk = { name: 'heavy', t: 0.2, dur: 0.7, hit: true, noQueue: true }; setTimeout(() => { if (this.dead) return; const p = this.pos.clone(); areaDamage(p, 4.5 * aR, base * 1.4, { slow: 3, knock: 6, big: true, melee: true }); V.ring(p, 4.5 * aR, '#ffe0a0', 0.5); V.burst('stone', p, 30, { speed: 7, size: 0.3, grav: 14 }); S.blunt(p); S.rumble(p, 0.6); V.addShake(0.4); }, 300); break; }
      case 'hammerfall': { const tgt = groundPoint(10); this.leap = { t: 0, dur: 0.7, from: this.pos.clone(), to: tgt, dmg: base * 2.4, r: 5 * aR }; this.atk = { name: 'heavy', t: 0, dur: 0.85, hit: true, noQueue: true }; S.jump(); break; }
      case 'hatchet': throwP('axe', 32, 1.8, { onHit: (p, m) => { if (m) this.dealDamage(m, p.dmg, { bleed: base * 0.12, melee: true }); } }); S.swingW('axe', 1.2, this.pos); break;
      case 'javelin': throwP('javelin', 45, 2.2, {}, true); S.swingW('spear', 1.4, this.pos); break;
      case 'earthcleaver': { const from = this.pos.clone(); from.y += 0.6; spawnProjectile({ pos: from, vel: f.clone().multiplyScalar(24), grav: 0, radius: 1.6, dmg: base * 2.0, owner: 'player', kind: 'wave', life: 0.9, pierce: true }); this.atk = { name: 'heavy', t: 0.3, dur: 0.6, hit: true, noQueue: true }; S.rumble(this.pos, 0.6); V.addShake(0.3); break; }
      case 'twinfury': this.atk = { name: 'fury', t: 0, dur: 1.15, hits: 6, rank: 1, hit: true, noQueue: true, base }; S.swing(1.2, this.pos); break;
      case 'fan': { for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; const d = new THREE.Vector3(Math.sin(a), 0, Math.cos(a)); spawnProjectile({ pos: this.pos.clone().setY(this.pos.y + 1.1), vel: d.multiplyScalar(26), grav: 2, radius: 0.35, dmg: base * 0.8, owner: 'player', kind: 'knife', life: 0.5 }); } this.atk = { name: 'area', t: 0.3, dur: 0.5, hit: true, noQueue: true }; S.swingW('light', 1.5, this.pos); break; }
      case 'multishot': throwP('arrow', 55, 0.9, {}, false, 5, 0.09); S.bowShot(this.pos); break;
      case 'rain': {
        const tgt = groundPoint(40), r = 6 * aR; this.atk = { name: 'shoot', t: 0, dur: 0.5, hit: true }; S.bowShot(this.pos); V.ring(tgt, r, '#a0ffb0', 2.2, 0.1);
        for (let i = 0; i < 22; i++) setTimeout(() => { const p = tgt.clone().add(new THREE.Vector3(rand(-r, r) * 0.8, 0, rand(-r, r) * 0.8)); spawnProjectile({ pos: p.clone().add(new THREE.Vector3(rand(-3, 3), 26, rand(-3, 3))), vel: new THREE.Vector3(0, -45, 0), grav: 0, radius: 0.5, dmg: base * 0.45, owner: 'player', kind: 'arrow', life: 2 }); }, (0.5 + i * 0.07) * 1000);
        break;
      }
      case 'meteor': {
        const from = this.handPos(); this.atk = { name: 'castBig', t: 0, dur: 0.9, hit: true }; S.cast('fire', from, 2); S.whistle(from, 1.5);
        setTimeout(() => { const f2 = this.camDist < 0.6 ? G.camera.position.clone().add(new THREE.Vector3(0, 0.4, -1.2).applyQuaternion(G.camera.quaternion)) : this.handPos().add(new THREE.Vector3(0, 1.2, 0)); const d2 = this.aimDir(f2); d2.y += 0.32; d2.normalize(); spawnProjectile({ pos: f2, vel: d2.multiplyScalar(27), grav: 17, radius: 1.0, dmg: base * 3.0, owner: 'player', kind: 'meteor', life: 6, onHit: (p, m, pos) => this.meteorImpact(pos, 9 * aR, p.dmg) }); }, 450);
        break;
      }
      case 'flamewave': { this.atk = { name: 'castBig', t: 0.3, dur: 0.7, hit: true }; S.cast('fire', this.pos, 1.8); for (const m of mobsInCone(this.pos, this.yaw, 9 * aR, 0.6)) this.dealDamage(m, base * 1.6, { el: 'fire', burn: base * 0.12 }); for (let i = 0; i < 70; i++) { const a = this.yaw + (Math.random() - 0.5) * 1.1, d = Math.random() * 9 * aR; V.add.spawn(this.pos.x + Math.sin(a) * d, this.pos.y + 0.5 + Math.random(), this.pos.z + Math.cos(a) * d, Math.sin(a) * 3, 2, Math.cos(a) * 3, 0.7, 0.9, 0.1, new THREE.Color('#ffe08a'), new THREE.Color('#ff3a08'), 1, 0, -1, 1); } V.light(this.pos.clone().addScaledVector(f, 4).setY(this.pos.y + 1), '#ff6020', 5, 0.4); break; }
      case 'blizzard': {
        const tgt = groundPoint(35), r = 7 * aR; this.atk = { name: 'castBig', t: 0, dur: 0.9, hit: true }; S.cast('frost', tgt, 1.5); V.ring(tgt, r, '#a0e0ff', 0.6);
        let ticks = 0; const iv = setInterval(() => { ticks++; for (const m of mobsInRadius(tgt, r)) this.dealDamage(m, base * 0.35, { slow: 2, el: 'frost', silent: ticks % 2 === 0 }); V.burst('frost', tgt.clone().setY(tgt.y + 6), 40, { speed: 2, radius: r * 2, vy: -6, size: 0.3, life: 1.0, grav: 4 }); if (ticks % 3 === 0) S.cast('frost', tgt, 0.6); if (ticks >= 10) clearInterval(iv); }, 400);
        break;
      }
      case 'icelance': { const from = this.handPos(), dir = this.aimDir(from); spawnProjectile({ pos: from, vel: dir.multiplyScalar(50), grav: 1, radius: 0.5, dmg: base * 2.4, owner: 'player', kind: 'frost', scale: 2.6, life: 2, pierce: true, onHit: (p, m, pos) => { if (m) this.dealDamage(m, p.dmg, { freeze: 1.5, el: 'frost' }); V.burst('frost', pos, 20, { speed: 4 }); } }); this.atk = { name: 'cast', t: 0.3, dur: 0.5, hit: true }; S.cast('frost', from, 1.3); break; }
      case 'nova': {
        const from = this.handPos(); this.atk = { name: 'castBig', t: 0, dur: 0.9, hit: true }; S.cast('arcane', from, 1.5);
        setTimeout(() => { const f2 = this.handPos(); const d2 = this.aimDir(f2); spawnProjectile({ pos: f2, vel: d2.multiplyScalar(22), grav: 6, radius: 0.5, dmg: base * 2.2, owner: 'player', kind: 'orb', scale: 2.5, life: 4, aoe: true, onHit: (p, m, pos) => { const r = 6.5 * aR; for (const mm of mobsInRadius(pos, r)) this.dealDamage(mm, p.dmg, { el: 'arcane', knock: mm.pos.clone().sub(pos).setY(0).normalize().multiplyScalar(-5) }); V.sphereFlash(pos, r, '#b060ff', 0.45); V.burst('arcane', pos, 60, { speed: 8, size: 0.4 }); V.ring(pos, r, '#d090ff', 0.5); V.light(pos, '#a040ff', 6, 0.4, 20); S.explode(pos, 1.3, 'arcane'); V.addShake(0.25); } }); }, 400);
        break;
      }
      case 'missiles': { for (let i = 0; i < 3; i++) setTimeout(() => { if (this.dead) return; const from = this.handPos(), dir = this.aimDir(from); dir.x += (Math.random() - 0.5) * 0.3; dir.y += 0.15; spawnProjectile({ pos: from, vel: dir.normalize().multiplyScalar(28), grav: 0, radius: 0.3, dmg: base * 0.9, owner: 'player', kind: 'arcane', life: 2.5, homing: true, onHit: (p, m, pos) => { if (m) this.dealDamage(m, p.dmg, { el: 'arcane' }); V.burst('arcane', pos, 14, { speed: 3 }); } }); S.cast('arcane', from, 0.6); }, i * 130); this.atk = { name: 'cast', t: 0, dur: 0.6, hit: true }; break; }
    }
    G.hooks.toast && false;
  }
  meteorImpact(pos, r, dmg) {
    pos.y = heightAt(pos.x, pos.z);
    for (const m of mobsInRadius(pos, r)) { const d = Math.hypot(m.pos.x - pos.x, m.pos.z - pos.z); this.dealDamage(m, dmg * (1 - 0.45 * d / r), { el: 'fire', burn: dmg * 0.06, knock: m.pos.clone().sub(pos).setY(0).normalize().multiplyScalar(10), big: true, stun: 0.8 }); }
    V.sphereFlash(pos.clone().setY(pos.y + 1), r * 0.9, '#ff8030', 0.5);
    V.burst('fire', pos, 120, { speed: 14, size: 1.3, life: 0.9, up: 1.2 }); V.burst('ember', pos, 60, { speed: 16, size: 0.15, life: 1.8, grav: 6 });
    V.burst('smoke', pos, 30, { speed: 5, size: 2.5, life: 3, vy: 3, radius: 3 }); V.burst('stone', pos, 25, { speed: 10, size: 0.3, life: 1.3, grav: 15 });
    V.ring(pos, r * 1.4, '#ffb050', 0.7); V.ring(pos, r, '#ff4010', 0.45);
    V.light(pos.clone().setY(pos.y + 3), '#ff5010', 12, 0.8, 40); S.explode(pos, 2.4); V.addShake(0.9); G.hitstop = 0.08;
    const d = this.pos.distanceTo(pos); if (d < r * 3) V.addShake(0.3);
  }
  furyHit(a, k) {
    const W = this.W, rank = a.rank;
    const r = rank >= 6 ? W.area * 1.3 : W.reach * 1.3;
    const targets = rank >= 6 ? mobsInRadius(this.pos, r) : mobsInCone(this.pos, this.yaw, r, 1.1);
    for (const m of targets) {
      this.dealDamage(m, a.base * 0.55 * (rank >= 10 ? 1.2 : 1), { offhand: k % 2 === 0, melee: true, silent: false });
      if (rank >= 8) { const pull = this.pos.clone().sub(m.pos).setY(0).normalize().multiplyScalar(4); m.status.knock.add(pull); }
    }
    S.swingW(this.swingKind(k % 2 ? 'swing1' : 'off1'), 0.8, this.pos);
    if (rank >= 6) V.ring(this.pos, r, '#e0e8ff', 0.25);
    if (k === a.hits && rank >= 4) { // cross slash wave
      const from = this.pos.clone(); from.y += 1; const dir = this.fwd();
      spawnProjectile({ pos: from, vel: dir.multiplyScalar(26), grav: 0, radius: 1.3, dmg: a.base * 1.6, owner: 'player', kind: 'wave', life: 0.8, pierce: true });
      S.cast('arcane', from, 0.6);
    }
  }

  hotbar(i) {
    const sl = this.h.hotbar && this.h.hotbar[i]; if (!sl) return;
    if (sl.t === 'ab') { const k = ABILITIES[this.h.cls].findIndex(a => a.id === sl.id); if (k >= 0) this.ability(k); }
    else if (sl.t === 'item') { if (count(this.h, sl.id) > 0) useItem(this.h, sl.id, this); else S.error(); }
  }
  // ---------- class abilities ----------
  ability(i) {
    const ab = ABILITIES[this.h.cls][i]; if (!ab) return;
    if (this.h.level < ab.level) { G.hooks.toast && G.hooks.toast(`${ab.name} unlocks at level ${ab.level}`, '🔒', 'bad'); S.error(); return; }
    const key = 'a' + (i + 1);
    if (this.cd[key] > 0 || this.dead || this.gathering || this.swim) { S.error(); return; }
    if (this.atk && this.atk.name !== 'swing1' && this.atk.name !== 'off1') return;
    if (!this.spend(ab.cost)) return;
    this.cd[key] = ab.cd;
    const w = this.weapon, base = w ? weaponDamage(this.h, w) : 10 + this.h.level * 3;
    const rk = this.h.level >= RANK2_LEVEL ? 1.5 : 1;
    const up = [1 + this.pk('a1up') * 0.5, 1, 1 + this.pk('a3up') * 0.5, 1, 1][i];
    const f = this.fwd();
    switch (ab.id) {
      case 'charge': {
        S.battleCry(); this.dodge = { t: 0, dur: 0.38 * (1 + this.pk('a1up') * 0.2), dir: f.clone(), speed: 32, charge: true, hitSet: new Set(), dmg: base * 1.3 * rk * up }; this.fovKick = 14;
        this.atk = { name: 'heavy', t: 0.3, dur: 0.5, hit: true, noQueue: true };
        break;
      }
      case 'battlecry': {
        S.battleCry(); this.heal(this.maxHp * (0.2 + this.pk('a2up') * 0.1)); this.buffs.cry = 10 + this.pk('a2up') * 5;
        V.ring(this.pos, 8, '#ff5040', 0.6); V.ring(this.pos, 5, '#ffc040', 0.5); V.burst('ember', this.pos.clone().setY(this.pos.y + 1), 50, { speed: 6 }); V.addShake(0.3);
        for (const m of mobsInRadius(this.pos, 8)) m.status.stun = Math.max(m.status.stun, 1.2 * rk);
        break;
      }
      case 'earthsplitter': {
        const tgt = groundPoint(14);
        this.leap = { t: 0, dur: 0.75, from: this.pos.clone(), to: tgt, dmg: base * 2.6 * rk * up, r: 7 * (1 + this.pk('a3up') * 0.3) };
        this.atk = { name: 'heavy', t: 0, dur: 0.9, hit: true, noQueue: true };
        S.heavySwing(this.pos); S.jump();
        break;
      }
      case 'spectral': {
        const from = this.handPos(true), dir = this.aimDir(from);
        spawnProjectile({ pos: from, vel: dir.multiplyScalar(85), grav: 0, radius: 0.35, dmg: base * 2.6 * rk * up, owner: 'player', kind: 'spectral', life: 1.4, pierce: true });
        S.bowShot(this.pos); S.cast('holy', this.pos); V.burst('green', from, 20, { speed: 3 });
        this.atk = { name: W2kind(this.W) === 'bow' ? 'shoot' : 'spell', t: 0.4, dur: 0.4, hit: true };
        break;
      }
      case 'smokeroll': {
        this.dodge = { t: 0, dur: 0.45, dir: f.clone().multiplyScalar(-1), speed: 13 }; this.iframes = 0.5; this.stealth = 4 * (rk > 1 ? 1.5 : 1) + this.pk('a2up') * 3; this.buffs.nextCrit = true;
        V.burst('shadow', this.pos.clone().setY(this.pos.y + 1), 50, { speed: 4, size: 1.6, life: 1.6, vy: 1, grav: 0, a0: 0.8 }); S.stealth();
        for (const m of G.mobs) if (!m.dead && m.state === 'chase' && m.pos.distanceTo(this.pos) > 3) { m.state = 'return'; }
        break;
      }
      case 'fury': {
        this.buffs.fury = 10 * rk + this.pk('a3up') * 5; S.growl('wolf', null, 1.4); S.battleCry();
        V.burst('green', this.pos.clone().setY(this.pos.y + 1), 40, { speed: 5 }); V.ring(this.pos, 4, '#60ff90', 0.5);
        break;
      }
      case 'adrenaline': {
        this.buffs.adren = 8; S.battleCry(); S.heal(); this.fovKick = 10; this.end = Math.min(this.maxEnd, this.end + 20);
        V.burst('ember', this.pos.clone().setY(this.pos.y + 1), 40, { speed: 5 }); V.ring(this.pos, 3.5, '#ff6a3a', 0.4); G.hooks.toast && G.hooks.toast('Adrenaline! Faster and stronger for 8 s', '⚡', 'gold');
        break;
      }
      case 'tourniquet': {
        this.buffs.tq = 10; S.skin(this.pos); S.heal();
        V.burst('heal', this.pos.clone().setY(this.pos.y + 1), 30, { speed: 2, vy: 2 }); G.hooks.toast && G.hooks.toast('Tourniquet: double health regeneration for 10 s', '✚', 'gold');
        break;
      }
      case 'secondwind': {
        this.end = Math.min(this.maxEnd, this.end + this.maxEnd * 0.4); this.buffs.swind = 6; S.dodge(); S.heal();
        V.burst('green', this.pos.clone().setY(this.pos.y + 1), 30, { speed: 3 }); V.ring(this.pos, 3, '#90ffb0', 0.4);
        break;
      }
      case 'fielddress': {
        this.regen = { per: this.maxHp * 0.3 / 8, t: 8 }; S.skin(this.pos); S.heal();
        V.burst('heal', this.pos.clone().setY(this.pos.y + 1), 30, { speed: 2, vy: 2 });
        break;
      }
      case 'manasurge': {
        this.buffs.surge = 8; this.mana = Math.min(this.maxMana, this.mana + this.maxMana * 0.15); S.cast('arcane', this.pos, 1.5); S.cast('holy', this.pos);
        V.burst('arcane', this.pos.clone().setY(this.pos.y + 1), 60, { speed: 5 }); V.sphereFlash(this.pos.clone().setY(this.pos.y + 1), 2.5, '#8ac0ff', 0.4);
        this.atk = { name: 'spell', t: 0, dur: 0.45, hit: true };
        break;
      }
      case 'icebarrier': {
        this.buffs.barrier = this.maxHp * 0.3; this.buffs.barrierT = 12; S.cast('frost', this.pos, 1.5);
        V.burst('frost', this.pos.clone().setY(this.pos.y + 1), 60, { speed: 3, radius: 1.5 }); V.sphereFlash(this.pos.clone().setY(this.pos.y + 1), 1.6, '#bfefff', 0.6);
        this.atk = { name: 'spell', t: 0, dur: 0.45, hit: true };
        break;
      }
      case 'frostnova': {
        const r = 7;
        for (const m of mobsInRadius(this.pos, r)) this.dealDamage(m, base * 1.4 * rk * up, { freeze: 3 + this.pk('a1up'), el: 'frost' });
        V.ring(this.pos, r, '#c0f0ff', 0.5); V.ring(this.pos, r * 0.7, '#ffffff', 0.4);
        V.burst('frost', this.pos.clone().setY(this.pos.y + 0.4), 90, { speed: 12, up: 0.15, size: 0.35, life: 0.8 });
        V.light(this.pos.clone().setY(this.pos.y + 1), '#80d0ff', 5, 0.4); S.cast('frost', this.pos, 1.4); S.explode(this.pos, 0.8, 'frost');
        this.atk = { name: 'spell', t: 0, dur: 0.45, hit: true };
        break;
      }
      case 'blink': {
        let dir = this.moveDir && this.moveDir.lengthSq() > 0.01 ? this.moveDir.clone().normalize() : f.clone();
        const from = this.pos.clone(); let to = from.clone();
        for (let s = 0.5; s <= 14 + this.pk('a2up') * 6; s += 0.5) { const p = from.clone().addScaledVector(dir, s); if (isWater(p.x, p.z)) break; const q = p.clone(); if (collide(q, this.radius)) break; if (heightAt(p.x, p.z) - this.pos.y > 4) break; to = p; }
        to.y = groundAt(to.x, to.z, to.y + 2).h;
        V.burst('arcane', from.clone().setY(from.y + 1), 50, { speed: 4, size: 0.4 }); V.sphereFlash(from.clone().setY(from.y + 1), 1.4, '#c080ff', 0.3);
        this.pos.copy(to); this.vel.set(0, 0, 0);
        V.burst('arcane', to.clone().setY(to.y + 1), 50, { speed: 4, size: 0.4 }); V.sphereFlash(to.clone().setY(to.y + 1), 1.4, '#c080ff', 0.3);
        S.cast('arcane', to, 1.2); this.fovKick = 10;
        break;
      }
      case 'chain': {
        const from = this.handPos(); const a = aimRay(35);
        let tgt = a.mob || mobsInCone(this.pos, this.yaw, 30, 0.45).sort((x, y) => x.dist2(this.pos) - y.dist2(this.pos))[0];
        S.cast('lightning', this.pos, 1);
        this.atk = { name: 'spell', t: 0, dur: 0.45, hit: true };
        if (!tgt) { lightning(from, a.point); break; }
        const hit = new Set(); let prev = from, dmg = base * 1.7 * rk * up;
        for (let j = 0; j < 5 + this.pk('a3up') * 2 && tgt; j++) {
          hit.add(tgt); const to = tgt.pos.clone(); to.y += tgt.height * 0.6;
          lightning(prev, to); this.dealDamage(tgt, dmg, { el: 'lightning', stun: 0.4 }); V.light(to, '#a0c0ff', 4, 0.2);
          dmg *= 0.85; prev = to;
          tgt = G.mobs.filter(m => !m.dead && !hit.has(m) && m.pos.distanceTo(tgt.pos) < 11).sort((x, y) => x.pos.distanceTo(tgt.pos) - y.pos.distanceTo(tgt.pos))[0];
        }
        break;
      }
    }
    G.hooks.abilityUsed && G.hooks.abilityUsed(i);
  }

  dealDamage(m, dmg, o = {}) {
    if (m.dead) return;
    let crit = Math.random() < this.D.crit;
    if (this.buffs.nextCrit && !o.silent) { crit = true; this.buffs.nextCrit = false; dmg *= 2; this.stealth = 0; }
    if (this.h.cls === 'ranger' && this.pk('cap') && m.hp >= m.maxHp) crit = true;
    if (o.critBonus && Math.random() < o.critBonus) crit = true;
    if (crit) dmg *= 1.75;
    const arm = m.def.armor || 0; if (arm && !o.el) { if (o.blunt) { if (Math.random() < 0.3) V.number(m.pos.clone().setY(m.pos.y + m.height + 0.7), 'Crush!', 'crit'); } else dmg *= 1 - arm; }
    if (this.wp('exec') && m.hp < m.maxHp * 0.35) dmg *= 1.3;
    if (this.h.cls === 'warrior' && this.pk('cap') && this.hp < this.maxHp * 0.5) dmg *= 1.2;
    if (this.buffs.cry > 0) dmg *= 1.3;
    if (this.buffs.fury > 0) dmg *= 1.25;
    if (this.buffs.adren > 0) dmg *= 1.2;
    if (this.buffs.surge > 0) dmg *= 1.2;
    if (this.h.cls === 'ranger' && this.pk('poison') && !o.silent) o.bleed = Math.max(o.bleed || 0, dmg * 0.06);
    if (o.el === 'fire' && o.burn && this.pk('ignite')) o.burn *= 2;
    if (o.el === 'frost' && this.pk('frostbite')) { if (o.slow) o.slow *= 2; if (o.freeze) o.freeze += 1; }
    const W = this.W, rank = W && W.hands === 'dual' ? dualRank(this.h.dualKills) : 0;
    if (o.offhand && rank >= 3) o.bleed = dmg * 0.08;
    let total = m.takeHit(dmg * rand(0.92, 1.08), this, o);
    if (o.melee && rank >= 7 && Math.random() < 0.15 && !m.dead) { total += m.takeHit(dmg * 0.6, this, { silent: true }); V.number(m.pos.clone().setY(m.pos.y + m.height + 0.3), 'Double!', 'crit'); }
    if (o.melee && rank >= 5) this.end = Math.min(this.maxEnd, this.end + 3);
    if (this.buffs.fury > 0) this.heal(total * (0.1 + this.pk('a3up') * 0.05), true);
    if (this.wp('leech')) this.heal(total * 0.04, true);
    const np = m.pos.clone(); np.y += m.height + 0.2;
    if (!o.silent || o.el) V.number(np, crit ? total + '!' : total, crit ? 'crit' : o.el === 'fire' ? 'fire' : o.el === 'frost' ? 'frost' : 'dmg');
    if (crit) { V.burst('spark', np, 12, { speed: 5 }); }
    if (o.melee && W && W.kind === 'melee') { V.burst('spark', np.clone().setY(np.y - m.height * 0.4), 4, { speed: 4, size: 0.12 }); }
    G.inCombat = 6; G.target = m;
    this.stealth = 0;
  }
  heal(n, quiet) { const before = this.hp; this.hp = Math.min(this.maxHp, this.hp + n); const d = Math.round(this.hp - before); if (d > 0 && !quiet) { V.number(this.pos.clone().setY(this.pos.y + this.eye + 0.4), '+' + d, 'heal'); V.burst('heal', this.pos.clone().setY(this.pos.y + 1), 20, { speed: 2, vy: 2, grav: -1 }); S.heal(); } }
  takeDamage(dmg, src, o = {}) {
    if (this.dead) return;
    if (this.iframes > 0 || (this.dodge && !this.dodge.charge)) { V.number(this.pos.clone().setY(this.pos.y + this.eye + 0.3), 'Dodged', 'miss'); return; }
    const front = src && src.pos ? Math.abs(angDiff(this.yaw, Math.atan2(src.pos.x - this.pos.x, src.pos.z - this.pos.z))) < 1.3 : true;
    if (this.block && front && this.W) {
      const red = Math.min(0.95, this.W.block + this.wp('block') * 0.1); const cost = dmg * 0.6 * (1 - this.wp('block') * 0.25);
      if (this.end >= cost * 0.5 || this.pk('unbreak')) { this.end = Math.max(0, this.end - cost); this.endUseT = 1; dmg *= 1 - red; S.block(this.W.hands === 'shield', this.pos); V.burst('spark', this.handPos(true), 14, { speed: 5 }); V.addShake(0.12); if (dmg < 1) return; }
      else { this.block = false; this.stagger = 0.8; V.number(this.pos.clone().setY(this.pos.y + this.eye), 'Guard broken!', 'bad'); S.hit('metal', this.pos); }
    }
    const lv = src && src.lv || this.h.level;
    const red = this.D.armor / (this.D.armor + 40 + lv * 12);
    dmg = Math.max(1, Math.round(dmg * (1 - red)));
    if (this.buffs.barrier > 0) { const ab = Math.min(this.buffs.barrier, dmg); this.buffs.barrier -= ab; dmg -= ab; V.burst('frost', this.pos.clone().setY(this.pos.y + 1), 10, { speed: 3 }); if (this.buffs.barrier <= 0) { this.buffs.barrierT = 0; S.explode(this.pos, 0.4, 'frost'); } if (dmg <= 0) { V.number(this.pos.clone().setY(this.pos.y + this.eye + 0.3), 'Absorbed', 'frost'); return; } }
    this.hp -= dmg; this.hurtT = 0.4; this.regenDelay = 4;
    V.addShake(Math.min(0.5, 0.1 + dmg / this.maxHp)); S.hurt();
    G.inCombat = 6;
    G.hooks.hurt && G.hooks.hurt(dmg, src);
    this.cancelGather();
    if (this.hp <= 0) { this.hp = 0; this.die(); }
  }
  debuff(type, t, dps = 0) {
    this.db = this.db || {};
    const d = this.db[type] || (this.db[type] = { t: 0, dps: 0 });
    d.t = Math.max(d.t, t); d.dps = Math.max(d.dps, dps);
    const label = { bleed: 'Bleeding!', poison: 'Poisoned!', burn: 'Burning!', slow: 'Slowed!', stun: 'Stunned!' }[type];
    V.number(this.pos.clone().setY(this.pos.y + this.eye + 0.2), label, 'bad');
    if (type === 'stun') { this.atk = null; this.press = null; this.cancelGather(); }
  }
  knock(v, stun = 0) { if (this.iframes > 0) return; this.vel.x += v.x; this.vel.z += v.z; this.vel.y = Math.max(this.vel.y, 3.5); this.onGround = false; this.knockT = 0.35; if (stun) this.debuff('stun', stun); }
  die() { this.dead = true; this.atk = null; this.press = null; this.deadT = 0; S.hurt(); G.hooks.died && G.hooks.died(); }

  // ---------- movement ----------
  jump() { if (this.onGround && !this.busy() && !this.swim) { this.vel.y = 9.2; this.onGround = false; this.landDip = 0.07; S.jump(); V.burst('dust', this.pos.clone().setY(this.pos.y + 0.1), 8, { speed: 2, size: 0.45, up: 0.3 }); } else if (this.swim) this.vel.y = 3; }
  tryDodge() {
    if (this.dodge || this.dead || this.gathering || !this.onGround || this.swim) return;
    if (this.atk && this.atk.t < 0.6 && this.atk.name !== 'cast') return;
    const cost = 16 * (this.W && this.W.hands === 'dual' && dualRank(this.h.dualKills) >= 9 ? 0.6 : 1) * (this.pk('evasive') ? 0.5 : 1);
    if (this.end < cost) { S.error(); return; }
    this.end -= cost; this.endUseT = 1;
    let dir = this.moveDir && this.moveDir.lengthSq() > 0.01 ? this.moveDir.clone().normalize() : this.fwd().multiplyScalar(-1);
    this.dodge = { t: 0, dur: 0.48, dir, speed: 12 }; this.iframes = 0.38; this.atk = null; this.queued = null; this.block = false;
    S.dodge(); V.burst('dust', this.pos.clone().setY(this.pos.y + 0.1), 10, { speed: 2, size: 0.4 });
  }
  swapWeapon() {
    if (pairedWt(this.h)) { G.hooks.toast && G.hooks.toast('Your main and off-hand weapons are used together', '⚔'); return; }
    if (this.atk || this.dodge) return;
    const other = this.h.active === 'w1' ? 'w2' : 'w1';
    if (!this.h.equip[other]) { G.hooks.toast && G.hooks.toast('No second weapon equipped (equip one from your bag)', '⚔', 'bad'); return; }
    this.h.active = other; this.refreshGear(); S.swap(); this.swapT = 0.35;
    G.hooks.gearChanged && G.hooks.gearChanged(true);
  }
  quaff() {
    const order = ['potion_heal2', 'potion_heal', 'hunter_stew', 'herb_roast', 'ember_skewer', 'crab_cake', 'roast_meat', 'bandage'];
    const id = order.find(k => count(this.h, k) > 0);
    if (!id) { G.hooks.toast && G.hooks.toast('No potions or food', '🧪', 'bad'); S.error(); return; }
    useItem(this.h, id, this);
  }

  // ---------- interaction & gathering ----------
  findInteract() {
    let best = null, bestS = 1e9;
    const f = this.fwd();
    const consider = (o, x, z, r, kind, label) => {
      const dx = x - this.pos.x, dz = z - this.pos.z, d = Math.hypot(dx, dz) - r; if (d > 2.6) return;
      const ang = d > 0.4 ? Math.abs(angDiff(this.yaw, Math.atan2(dx, dz))) : 0; if (ang > 1.4) return;
      const s = d + ang * 1.6; if (s < bestS) { bestS = s; best = { o, kind, label }; }
    };
    for (const n of G.npcs) if (n.def) consider(n, n.pos.x, n.pos.z, 0.4, 'npc', 'Talk to ' + n.name);
    for (const s of world.stations) consider(s, s.x, s.z, 1.0, 'station', 'Use ' + ({ workbench: 'Workbench', forge: 'Forge', loom: 'Loom', tanning: 'Tanning Rack', campfire: 'Campfire', alchemy: 'Alchemy Table' })[s.type]);
    for (const m of G.mobs) if (m.dead && m.root.visible) { if (hasLoot(m)) consider(m, m.pos.x, m.pos.z, m.radius, 'loot', 'Loot ' + m.name); else if (m.def.skin && !m.skinned) consider(m, m.pos.x, m.pos.z, m.radius, 'skin', 'Skin ' + m.name); }
    for (const n of nodesNear(this.pos.x, this.pos.z)) if (n.alive) consider(n, n.x, n.z, n.type.startsWith('tree') ? 0.5 * n.s : n.type === 'cotton' || n.type === 'healroot' ? 0.2 : 0.8 * n.s, 'node', n.def.verb + ' ' + n.def.name);
    return best;
  }
  interact() {
    if (this.dead || this.gathering) return;
    const t = this.findInteract(); if (!t) return;
    if (t.kind === 'npc') G.hooks.talk && G.hooks.talk(t.o);
    else if (t.kind === 'station') G.hooks.station && G.hooks.station(t.o.type);
    else if (t.kind === 'loot') lootCorpse(this.h, t.o);
    else if (t.kind === 'skin') {
      if (!this.h.tools.knife) { G.hooks.toast && G.hooks.toast('You need a Skinning Knife (Lyra the Huntress has one).', '🔪', 'bad'); S.error(); return; }
      this.startGather({ skin: t.o, def: { time: 1.4, verb: 'Skin', name: t.o.name } }, 'knife', 1, 'skin');
    } else if (t.kind === 'node') {
      const prob = toolProblem(this.h, t.o);
      if (prob) { G.hooks.toast && G.hooks.toast(prob, '⚠', 'bad'); S.error(); return; }
      const tool = t.o.def.tool, anim = tool === 'hatchet' ? 'chop' : tool === 'pickaxe' ? 'mine' : 'gather';
      this.startGather(t.o, tool, tool ? this.h.tools[tool] : 1, anim);
    }
  }
  startGather(node, tool, tier, anim) {
    if (this.atk || this.dodge) return;
    this.gathering = { node, t: 0, dur: node.def.time, anim, tool, hits: 0, cyc: 0 };
    if (tool && tool !== 'knife') { holdTool(this.ch, tool, tier); this.vm.setTool(tool, tier); } else if (tool === 'knife') { holdTool(this.ch, 'knife', 2); this.vm.setTool('knife', 2); }
    const n = node.x != null ? node : node.skin.pos;
    this.yaw = Math.atan2(n.x - this.pos.x, n.z - this.pos.z);
  }
  cancelGather() { if (!this.gathering) return; this.gathering = null; holdTool(this.ch, null); this.vm.setTool(null); G.hooks.progress && G.hooks.progress(null); }
  updateGather(dt) {
    const g = this.gathering; if (!g) return;
    g.t += dt; g.cyc += dt;
    const cycle = g.anim === 'chop' || g.anim === 'mine' ? 0.7 : 0.5;
    if (g.cyc >= cycle) { g.cyc -= cycle; }
    const k = g.cyc / cycle;
    if (k > 0.55 && !g.struck) {
      g.struck = true; const n = g.node; const p = n.x != null ? new THREE.Vector3(n.x, n.y + (g.anim === 'chop' ? 1.2 : 0.6), n.z) : n.skin.pos.clone().setY(n.skin.pos.y + 0.4);
      if (g.anim === 'chop') { S.chop(p); V.burst('wood', p, 8, { speed: 3, size: 0.12 }); V.burst('leaf', p.clone().setY(p.y + 6 * (n.s || 1)), 5, { speed: 1.5, size: 0.18, grav: 1.5, life: 2 }); V.addShake(0.05); }
      else if (g.anim === 'mine') { S.mine(p); V.burst('spark', p, 8, { speed: 4, size: 0.1 }); V.burst('stone', p, 6, { speed: 3, size: 0.14 }); V.addShake(0.05); }
      else if (g.anim === 'skin') { S.skin(p); V.burst('blood', p, 4, { speed: 1, size: 0.08 }); }
      else { S.gather(p); V.burst(n.type === 'cotton' ? 'cotton' : 'green', p.clone().setY(p.y + 0.3), 6, { speed: 1, size: 0.1, grav: 0.5 }); }
    }
    if (k < 0.5) g.struck = false;
    G.hooks.progress && G.hooks.progress(g.t / g.dur, g.node.def.verb + 'ing ' + g.node.def.name);
    if (this.moveDir && this.moveDir.lengthSq() > 0.01) { this.cancelGather(); return; }
    if (g.t >= g.dur) {
      const n = g.node;
      if (g.anim === 'skin') { const mob = n.skin; mob.skinned = true; const k2 = mob.def.size > 1 ? 2 : 1; addItem(this.h, 'raw_hide', k2 + (Math.random() < 0.3 ? 1 : 0) + this.pk('bounty')); if (this.pk('bounty')) addItem(this.h, 'raw_meat', 1); }
      else { gatherReward(this.h, n); n.alive = false; n.respawn = G.time + n.def.respawn; hideNode(n); G.hooks.nodeDone && G.hooks.nodeDone(n, this); }
      this.cancelGather();
    }
  }

  // ---------- update ----------
  update(dt) {
    const h = this.h;
    for (const k in this.cd) this.cd[k] = Math.max(0, this.cd[k] - dt);
    this.useCd = Math.max(0, this.useCd - dt); this.iframes = Math.max(0, this.iframes - dt); this.comboT -= dt; this.stealth = Math.max(0, this.stealth - dt);
    for (const k of ['cry', 'fury', 'adren', 'tq', 'surge', 'swind', 'barrierT']) this.buffs[k] = Math.max(0, (this.buffs[k] || 0) - dt); if (this.buffs.barrierT <= 0) this.buffs.barrier = 0; this.stagger = Math.max(0, (this.stagger || 0) - dt);
    this.hurtT = Math.max(0, this.hurtT - dt); this.regenDelay = Math.max(0, (this.regenDelay || 0) - dt); this.swapT = Math.max(0, (this.swapT || 0) - dt); this.landT = Math.max(0, (this.landT || 0) - dt * 3.5);
    if (h.food && h.food.t > 0) { h.food.t -= dt; if (h.food.t <= 0) { G.hooks.toast && G.hooks.toast(`${FOOD_BUFFS[h.food.id].name} has worn off`, '🍖'); h.food = null; this.refreshStatsOnly(); } }
    this.fb = h.food && h.food.t > 0 ? FOOD_BUFFS[h.food.id] : {};
    this.knockT = Math.max(0, (this.knockT || 0) - dt);
    if (this.db) for (const k in this.db) { const d = this.db[k]; if (d.t <= 0) continue; d.t -= dt; if (d.dps && !this.dead) { d.acc = (d.acc || 0) + d.dps * dt; if (d.acc >= 1) { const n = Math.floor(d.acc); d.acc -= n; this.hp -= n; V.number(this.pos.clone().setY(this.pos.y + this.eye), n, 'dot'); if (k === 'burn') V.burst('fire', this.pos.clone().setY(this.pos.y + 1), 3, { speed: 1 }); if (k === 'bleed') V.burst('blood', this.pos.clone().setY(this.pos.y + 1), 2, { speed: 1, size: 0.08 }); if (this.hp <= 0) { this.hp = 0; this.die(); } } } }
    const stunned = this.db && this.db.stun && this.db.stun.t > 0;
    if (this.dead) { this.deadT += dt; this.animate(dt, 0); this.updateCamera(dt); return; }
    // regen
    this.endUseT -= dt; this.manaUseT -= dt;
    if (this.endUseT <= 0 && !this.block) this.end = Math.min(this.maxEnd, this.end + dt * (14 + (h.race === 'woodelf' ? 3 : 0)) * (1 + (this.fb.regen || 0)) * (1 + (this.h.cls !== 'wizard' ? 0 : 0)));
    if (this.manaUseT <= 0) this.mana = Math.min(this.maxMana, this.mana + dt * (5 + this.D.stats.int * 0.25) * (1 + this.pk('regen') * 0.5));
    if (this.regen) { this.hp = Math.min(this.maxHp, this.hp + this.regen.per * dt); this.regen.t -= dt; if (this.regen.t <= 0) this.regen = null; }
    const baseRegen = G.inCombat <= 0 && this.regenDelay <= 0 ? 0.02 : this.pk('secondwind') ? 0.008 : 0;
    this.hp = Math.min(this.maxHp, this.hp + this.maxHp * (this.buffs.tq > 0 ? Math.max(0.03, baseRegen * 2) : baseRegen) * (1 + (this.fb.regen || 0)) * dt);
    // input
    const K = G.keys, ui = G.uiOpen;
    let ix = 0, iz = 0;
    if (!ui) { if (K.KeyW) iz += 1; if (K.KeyS) iz -= 1; if (K.KeyA) ix -= 1; if (K.KeyD) ix += 1; }
    const f = this.fwd(), r = this.right();
    const md = new THREE.Vector3().addScaledVector(f, iz).addScaledVector(r, ix); if (md.lengthSq() > 1) md.normalize();
    this.moveDir = md;
    this.block = !ui && !!this.rmbDown && !this.atk && !this.dodge && !this.gathering && this.stagger <= 0 && !this.swim && !!this.W;
    // charge heavy holds the swing
    const charging = this.press && this.press.charging;
    let sprint = !ui && this.shiftT != null && G.time - this.shiftT >= 0.22 && iz > 0 && !this.block && !charging && !this.atk;
    // sprinting burns endurance; once empty you must recover a little before sprinting again
    if (this.end <= 1) this.sprintTired = true; else if (this.end > 20) this.sprintTired = false;
    if (sprint && this.sprintTired) sprint = false;
    if (sprint && md.lengthSq() > 0.1 && this.onGround) { this.end = Math.max(0, this.end - 12 * dt); this.endUseT = 0.8; }
    let spd = (this.swim ? 3.2 : sprint ? 8.2 : 5.2) * (1 + this.pk('speed') * 0.1) * (this.buffs.adren > 0 ? 1.3 : 1) * (this.buffs.swind > 0 ? 1.25 : 1) * (1 + (this.fb.speed || 0));
    if (iz < 0) { spd = 2.2; sprint = false; }
    if (this.block && !(this.pk('shieldwall') && this.W && this.W.hands === 'shield')) spd *= 0.45;
    if (this.gathering || stunned) spd = 0;
    if (this.db && this.db.slow && this.db.slow.t > 0) spd *= 0.55;
    if (this.stagger > 0) spd *= 0.3;
    this.sprinting = sprint && md.lengthSq() > 0.1;
    // dodge / charge / leap override
    if (this.leap) {
      const L = this.leap; L.t += dt / L.dur; const k = Math.min(1, L.t);
      this.pos.x = lerp(L.from.x, L.to.x, k); this.pos.z = lerp(L.from.z, L.to.z, k);
      this.pos.y = lerp(L.from.y, L.to.y, k) + Math.sin(k * Math.PI) * 5;
      if (k >= 1) {
        this.leap = null; const p = this.pos.clone(); p.y = heightAt(p.x, p.z);
        for (const m of mobsInRadius(p, L.r || 7)) this.dealDamage(m, L.dmg, { stun: 2, knock: m.pos.clone().sub(p).setY(0).normalize().multiplyScalar(8), big: true, melee: true });
        V.ring(p, 7, '#ffd090', 0.5); V.ring(p, 4.5, '#ff8040', 0.4); V.burst('stone', p, 50, { speed: 9, size: 0.35, grav: 14, life: 1.2 }); V.burst('dust', p, 40, { speed: 6, size: 1.2, life: 1.5, radius: 3 });
        S.explode(p, 1.4); S.rumble(p, 1.2); V.addShake(0.8); G.hitstop = 0.08; this.vel.set(0, 0, 0); this.onGround = true;
      }
    } else if (this.dodge) {
      const D = this.dodge; D.t += dt / D.dur;
      const s = D.speed * (D.charge ? 1 : (1 - D.t * 0.75));
      this.vel.x = D.dir.x * s; this.vel.z = D.dir.z * s;
      if (D.charge) { for (const m of mobsInRadius(this.pos, 2.4)) if (!D.hitSet.has(m)) { D.hitSet.add(m); const side = this.right().multiplyScalar(Math.sign(this.right().dot(m.pos.clone().sub(this.pos))) || 1); this.dealDamage(m, D.dmg, Object.assign({ knock: side.multiplyScalar(9).add(D.dir.clone().multiplyScalar(4)), stun: 1, big: true, melee: true }, D.extra || {})); V.addShake(0.2); } if (Math.random() < 0.6) V.burst('dust', this.pos.clone().setY(this.pos.y + 0.1), 3, { speed: 2, size: 0.5 }); }
      if (D.t >= 1) { this.dodge = null; this.vel.x *= 0.3; this.vel.z *= 0.3; }
    } else {
      const k = this.knockT > 0 ? Math.min(1, dt * 1.5) : Math.min(1, dt * (this.onGround ? 12 : 2.5));
      this.vel.x += (md.x * spd - this.vel.x) * k; this.vel.z += (md.z * spd - this.vel.z) * k;
    }
    // gravity / swim
    const wl = waterLevelAt(this.pos.x, this.pos.z), gh = groundAt(this.pos.x, this.pos.z, this.pos.y);
    const depth = wl - gh.h;
    this.swim = depth > 1.35 && this.pos.y < wl - 0.9 && !gh.surf;
    if (!this.leap) {
      if (this.swim) { this.vel.y += ((wl - 1.25) - this.pos.y) * dt * 6 - this.vel.y * dt * 3; if (Math.random() < dt * 4 && md.lengthSq() > 0.1) S.splash(this.pos, 0.3); }
      else this.vel.y -= (this.vel.y > 0 ? 21 : 26) * dt;
      this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt; this.pos.y += this.vel.y * dt;
    }
    collide(this.pos, this.radius);
    // world bounds
    this.pos.x = clamp(this.pos.x, -590, 590); this.pos.z = clamp(this.pos.z, -590, 590);
    const g2 = groundAt(this.pos.x, this.pos.z, this.pos.y);
    const wasAir = !this.onGround;
    if (this.pos.y <= g2.h && !this.leap) {
      if (wasAir && this.vel.y < -3) { this.landT = Math.min(1, -this.vel.y / 12); }
      if (wasAir && this.vel.y < -7) { S.land(-this.vel.y / 10); this.landDip = Math.min(0.3, -this.vel.y * 0.018); V.burst('dust', this.pos.clone().setY(g2.h + 0.1), 10, { speed: 2.5, size: 0.5, up: 0.25 }); if (this.vel.y < -17) this.takeDamage((-this.vel.y - 17) * 6 * this.maxHp / 100, null); }
      this.pos.y = g2.h; this.vel.y = Math.max(0, this.vel.y); this.onGround = true;
    } else if (this.pos.y > g2.h + 0.15) this.onGround = this.swim;
    // step down slopes smoothly
    if (this.onGround && !this.swim && this.pos.y - g2.h < 0.5 && this.vel.y <= 0) this.pos.y = g2.h;
    this.onSurf = g2.surf;
    // lava
    if (world.lavaPools) for (const L of world.lavaPools) if (Math.hypot(this.pos.x - L.x, this.pos.z - L.z) < L.r && this.pos.y < L.y + 0.6) { this.pos.y = Math.max(this.pos.y, L.y - 0.3); this.lavaT = (this.lavaT || 0) + dt; if (this.lavaT > 0.5) { this.lavaT = 0; this.iframes = 0; this.takeDamage(this.maxHp * 0.12, null); V.burst('fire', this.pos, 20, { speed: 3 }); } }
    // footsteps
    const hs = Math.hypot(this.vel.x, this.vel.z);
    this.speed = hs;
    if (this.onGround && hs > 0.5 && !this.dodge) { this.stepAcc += hs * dt; if (this.stepAcc > (this.sprinting ? 2.2 : 1.7)) { this.stepAcc = 0; S.step(this.swim ? 'water' : surfaceType(this.pos.x, this.pos.z, this.onSurf), null, this.sprinting ? 1.2 : 0.9); if (wl - g2.h > 0.1 && wl - g2.h < 1.4) S.step('water'); } }
    // attacks
    this.updateAttack(dt);
    this.updateGather(dt);
    // body yaw (third person)
    const combatFace = this.atk || this.block || this.press || this.gathering;
    if (combatFace || this.camDist < 0.6) this.bodyYaw += angDiff(this.bodyYaw, this.yaw) * Math.min(1, dt * 14);
    else if (hs > 0.5) this.bodyYaw += angDiff(this.bodyYaw, Math.atan2(this.vel.x, this.vel.z)) * Math.min(1, dt * 10);
    this.animate(dt, hs);
    this.updateCamera(dt);
  }
  animate(dt, hs) {
    const ch = this.ch;
    ch.root.position.copy(this.pos);
    if (this.swim) ch.root.position.y += 0.2;
    ch.root.rotation.y = this.bodyYaw;
    const a = this.atk, g = this.gathering;
    let action = null, actionT = 0, mirror = false, spin = 0;
    if (g) { action = g.anim === 'skin' ? 'gather' : g.anim; actionT = (g.cyc / (g.anim === 'chop' || g.anim === 'mine' ? 0.7 : 0.5)); }
    else if (a) {
      actionT = Math.min(1, a.t); action = a.name;
      if (a.name === 'off1') { action = 'swing1'; mirror = true; }
      if (a.name === 'stabR') action = 'thrust1';
      if (a.name === 'stabL') { action = 'thrust1'; mirror = true; }
      if (a.name === 'smash') action = 'heavy';
      if (a.name === 'spin') { action = 'area'; spin = ease(Math.min(1, a.t / 0.8)) * Math.PI * 2; }
      if (a.name === 'area' || a.name === 'fury') { action = 'area'; spin = (a.name === 'fury' ? a.t * 3 : ease(Math.min(1, a.t / 0.8))) * Math.PI * 2; }
      if (a.name === 'release') action = 'shoot', actionT = 0.6 + a.t * 0.4;
      if (a.name === 'spell') action = 'cast';
      if (this.W && this.W.kind === 'melee' && this.weapon.wt === 'spear' && a.name.startsWith('thrust')) action = a.name;
    } else if (this.press && this.press.charging) { action = this.W.kind === 'bow' ? 'shoot' : this.W.kind === 'staff' ? 'castBig' : 'heavy'; actionT = this.W.kind === 'bow' ? 0.3 : 0.3; }
    const roll = this.dodge && !this.dodge.charge ? Math.min(1, this.dodge.t) : null;
    animateHumanoid(ch, dt, { speed: hs, vy: this.vel.y, land: this.landT || 0, airborne: !this.onGround && !this.swim, swim: this.swim, action, actionT, mirror, block: this.block, armed: true, dead: this.dead, deadT: this.deadT, roll, spin, lookPitch: -this.pitch * 0.6, back: this.moveDir && this.moveDir.dot(this.fwd()) < -0.3 });
    // view model
    const vmAct = g ? { name: g.anim, t: actionT } : a ? { name: a.name, t: Math.min(1, a.t) } : this.press && this.press.charging ? { name: this.W.kind === 'bow' ? 'draw' : this.W.kind === 'staff' ? 'chargeCast' : 'charge', t: Math.min(1, (this.press.t - 0.22) / 0.6) } : null;
    this.swayX += (-this.lookDX * 0.0004 - this.swayX) * Math.min(1, dt * 8); this.swayY += (this.lookDY * 0.0004 - this.swayY) * Math.min(1, dt * 8); this.lookDX = this.lookDY = 0;
    this.vm.update(dt, { act: vmAct, block: this.block, speed: this.onGround ? hs : 0, sprint: this.sprinting && this.onGround, tool: !!g, drawing: this.press && this.press.charging && this.W.kind === 'bow' ? (this.press.t - 0.22) / 0.6 : 0, charge: this.press && this.press.charging ? Math.min(1, (this.press.t - 0.22) / 0.8) : 0, swayX: this.swayX, swayY: this.swayY - (this.swapT || 0) * 0.8 });
    // charge glow on weapon
    if (this.press && this.press.charging && Math.random() < 0.5) { const tip = (this.camDist < 0.6 ? this.vm.weapons.main || this.vm.weapons.bow : this.ch.weapons.main); if (tip && tip.userData.tip) { const p = tip.userData.tip.getWorldPosition(new THREE.Vector3()); V.emit(this.W.element || 'spark', p, { speed: 0.6, size: 0.12, life: 0.4 }); } }
    // stealth fade
    ch.root.traverse(o => { if (o.isMesh && o.material) { if (this.stealth > 0) { o.material.transparent = true; o.material.opacity = 0.35; } else if (o.material.opacity < 1) { o.material.opacity = 1; o.material.transparent = false; } } });
  }
  updateCamera(dt) {
    const cam = G.camera;
    this.camDist += (this.camDistT - this.camDist) * Math.min(1, dt * 8);
    const fp = this.camDist < 0.6;
    this.ch.root.visible = !fp || this.dead;
    this.vm.g.visible = fp && !this.dead;
    for (const t of [this.trail, this.trailL]) { const want = fp ? G.vmScene : G.scene; if (t.mesh.parent !== want) want.add(t.mesh); }
    this.landDip *= Math.max(0, 1 - dt * 6);
    let eyeY = this.eye - this.landDip + (this.block ? -0.05 : 0);
    if (this.dodge && !this.dodge.charge) eyeY -= Math.sin(Math.min(1, this.dodge.t) * Math.PI) * 0.7;
    if (this.dead) eyeY = 0.4;
    if (this.swim) eyeY = 1.35;
    const eye = this.pos.clone(); eye.y += eyeY;
    if (fp && settings.headBob && this.onGround && this.speed > 0.5) eye.y += Math.abs(Math.sin(this.vm.bob)) * 0.04;
    cam.rotation.order = 'YXZ';
    cam.rotation.set(this.pitch, this.yaw + Math.PI, 0);
    if (this.dodge && !this.dodge.charge && fp) cam.rotation.z = Math.sin(Math.min(1, this.dodge.t) * Math.PI) * 0.15 * Math.sign(this.dodge.dir.dot(this.right()) || 1);
    if (this.dead) cam.rotation.z = Math.min(1, this.deadT) * 0.6;
    if (fp) cam.position.copy(eye);
    else {
      const back = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
      // over the right shoulder: the hero sits left of the crosshair
      const sh = this.right().multiplyScalar(0.8 * Math.min(1, this.camDist / 2.5));
      eye.y += 0.3;
      let d = this.camDist;
      for (let s = 0.5; s <= this.camDist; s += 0.4) { const p = eye.clone().add(sh).addScaledVector(back, -s); if (p.y < heightAt(p.x, p.z) + 0.3) { d = Math.max(0.5, s - 0.4); break; } }
      cam.position.copy(eye).add(sh).addScaledVector(back, -d);
    }
    // shake
    const sk = V.shake * V.shake;
    if (sk > 0) { cam.position.x += (Math.random() - 0.5) * sk * 0.35; cam.position.y += (Math.random() - 0.5) * sk * 0.35; cam.rotation.z += (Math.random() - 0.5) * sk * 0.04; }
    this.fovKick *= Math.max(0, 1 - dt * 4);
    this.fovS = (this.fovS || 0) + ((this.sprinting ? 7 : 0) - (this.fovS || 0)) * Math.min(1, dt * 6);
    cam.fov = settings.fov + this.fovKick + this.fovS;
    cam.updateProjectionMatrix();
    A.setListener(cam.position.x, cam.position.y, cam.position.z, this.yaw + Math.PI);
  }
}
function W2kind(W) { return W ? W.kind : ''; }
