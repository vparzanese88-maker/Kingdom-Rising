// Combat helpers: projectiles (with gravity), area damage, telegraphs, aiming rays, lightning bolts.
import * as THREE from 'three';
import { G } from './state.js';
import { V } from './vfx.js';
import { S } from './audio.js';
import { heightAt } from './terrain.js';
import { solidAt } from './world.js';
const ARENA_MODE = /[?&]mode=arena/.test(location.search);
import { angDiff, rand } from './util.js';

const tmp = new THREE.Vector3();
// ---- aiming: march a ray from the camera; returns {point, mob}
export function aimRay(maxD = 120) {
  const cam = G.camera; cam.updateMatrixWorld(); const o = cam.getWorldPosition(new THREE.Vector3()), d = cam.getWorldDirection(new THREE.Vector3());
  let best = null, bestT = maxD;
  for (const m of G.mobs) {
    if (m.dead || !foe(m)) continue;
    const c = tmp.copy(m.pos); c.y += m.height * 0.5;
    const oc = c.clone().sub(o), t = oc.dot(d); if (t < 0 || t > bestT) continue;
    const r = Math.max(m.radius, m.height * 0.45) * 1.05;
    if (oc.lengthSq() - t * t < r * r) { bestT = t; best = m; }
  }
  // aim assist: a mob within a few degrees of the crosshair counts as aimed at
  if (!best && !G.battleFx) {
    let bestA = 0.075;
    for (const m of G.mobs) {
      if (m.dead || !foe(m)) continue;
      const c = tmp.copy(m.pos); c.y += m.height * 0.5;
      const oc = c.clone().sub(o), t = oc.length(); if (t > maxD || t < 1) continue;
      const ang = Math.acos(Math.min(1, oc.dot(d) / t)) - Math.atan2(Math.max(m.radius, m.height * 0.5), t);
      if (ang < bestA) { bestA = ang; best = m; bestT = t; }
    }
    if (best) { const c = best.pos.clone(); c.y += best.height * 0.5; return { point: c, mob: best, dist: bestT, origin: o, dir: c.clone().sub(o).normalize() }; }
  }
  // terrain march
  let tt = 0, step = 0.5, hitT = bestT;
  for (; tt < bestT; tt += step) { const x = o.x + d.x * tt, y = o.y + d.y * tt, z = o.z + d.z * tt; if (y < heightAt(x, z)) { hitT = tt; best = null; break; } step = Math.min(3, step * 1.08); }
  return { point: o.clone().addScaledVector(d, Math.min(hitT, bestT)), mob: hitT < bestT ? null : best, dist: Math.min(hitT, bestT), origin: o, dir: d };
}
export function groundPoint(maxD = 40) {
  const a = aimRay(maxD + 30);
  const p = a.point.clone(); const pl = G.player.pos;
  const dx = p.x - pl.x, dz = p.z - pl.z, l = Math.hypot(dx, dz);
  if (l > maxD) { p.x = pl.x + dx / l * maxD; p.z = pl.z + dz / l * maxD; }
  p.y = heightAt(p.x, p.z); return p;
}

// ---- damage helpers (player -> mobs)
export const foe = (m) => m.team == null || m.team !== G.myTeam;
export function mobsInRadius(p, r) { return G.mobs.filter(m => !m.dead && foe(m) && Math.hypot(m.pos.x - p.x, m.pos.z - p.z) < r + m.radius && Math.abs(m.pos.y - p.y) < 6 + m.height); }
export function mobsInCone(p, yaw, range, half) {
  return G.mobs.filter(m => { if (m.dead || !foe(m)) return false; const dx = m.pos.x - p.x, dz = m.pos.z - p.z, d = Math.hypot(dx, dz); if (d > range + m.radius || Math.abs(m.pos.y - p.y) > 3 + m.height) return false; if (d < m.radius + 0.6) return true; return Math.abs(angDiff(yaw, Math.atan2(dx, dz))) < half + Math.atan2(m.radius, d); });
}
export function areaDamage(p, r, dmg, opts = {}) {
  let n = 0;
  for (const m of mobsInRadius(p, r)) {
    const k = opts.falloff ? 1 - 0.4 * Math.min(1, Math.hypot(m.pos.x - p.x, m.pos.z - p.z) / r) : 1;
    const kn = opts.knock ? m.pos.clone().sub(p).setY(0).normalize().multiplyScalar(opts.knock) : null;
    G.player.dealDamage(m, dmg * k, Object.assign({}, opts, { knock: kn }));
    n++;
  }
  return n;
}

// ---- projectiles ----
const geo = { sphere: new THREE.SphereGeometry(1, 14, 10), rock: new THREE.IcosahedronGeometry(1, 1), arrow: (() => { const g = new THREE.CylinderGeometry(0.012, 0.012, 0.8, 5); g.rotateX(Math.PI / 2); return g; })(), shard: (() => { const g = new THREE.OctahedronGeometry(0.2, 0); g.scale(0.6, 0.6, 2.2); return g; })() };
const matCache = {};
function glow(c) { return matCache[c] || (matCache[c] = new THREE.MeshBasicMaterial({ color: c })); }
// a splash of poison: bubbles of slime boil up from where it burst, swell and pop
export function poisonBubbles(pos, n = 14, r = 1.4) { const bm = new THREE.MeshStandardMaterial({ color: '#9aff5a', emissive: '#3aaa20', emissiveIntensity: 0.7, transparent: true, opacity: 0.6, roughness: 0.05 }), list = [];
  for (let i = 0; i < n; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), bm); const a = Math.random() * Math.PI * 2, d = Math.random() * r; b.position.set(pos.x + Math.cos(a) * d, pos.y + Math.random() * 0.4, pos.z + Math.sin(a) * d); b.userData = { t: -Math.random() * 0.5, life: 0.5 + Math.random() * 0.7, s: 0.06 + Math.random() * 0.14, vy: 0.3 + Math.random() * 0.9 }; b.scale.setScalar(0.001); G.scene.add(b); list.push(b); }
  G.timers.push({ update(dt) { let alive = 0; for (const b of list) { const u = b.userData; u.t += dt; if (u.t < 0) { alive++; continue; } if (u.t > u.life) { if (b.parent) { G.scene.remove(b); V.burst('poison', b.position, 4, { speed: 1.2, size: 0.12, life: 0.3 }); } continue; } alive++; const k = u.t / u.life; b.scale.setScalar(u.s * (0.3 + k * 0.9)); b.position.y += u.vy * dt; } if (!alive) { bm.dispose(); return true; } return false; } }); }
export function spawnProjectile(o) {
  // o: {pos, vel, grav, radius, dmg, owner, kind, life, pierce, aoe, el, onHit, scale}
  const p = Object.assign({ grav: 0, radius: 0.3, life: 4, pierce: false, hitSet: new Set(), t: 0 }, o);
  // Kingdom Battles: your arrows fly straight first, then slowly drop
  if (G.battleFx && p.owner === 'player' && (p.kind === 'arrow' || p.kind === 'spectral') && !p.flat) { p.flat = 0.35; p.grav *= 0.6; }
  let m;
  switch (p.kind) {
    case 'fireball': m = new THREE.Group(); m.add(new THREE.Mesh(geo.sphere, glow('#fff0b0'))); m.children[0].scale.setScalar(0.18 * (p.scale || 1)); { const h = new THREE.Mesh(geo.sphere, new THREE.MeshBasicMaterial({ color: '#ff6010', transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })); h.scale.setScalar(0.34 * (p.scale || 1)); m.add(h); } break;
    case 'meteor': { m = new THREE.Group(); const r = new THREE.Mesh(geo.rock, new THREE.MeshStandardMaterial({ color: '#3a2218', emissive: '#ff4010', emissiveIntensity: 0.9, roughness: 0.9, flatShading: true })); r.scale.setScalar(1.1); m.add(r); const h = new THREE.Mesh(geo.sphere, new THREE.MeshBasicMaterial({ color: '#ff7020', transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false })); h.scale.setScalar(1.9); m.add(h); break; }
    case 'frost': m = new THREE.Mesh(geo.shard, new THREE.MeshStandardMaterial({ color: '#c8f4ff', emissive: '#60c8ff', emissiveIntensity: 1.2, transparent: true, opacity: 0.9 })); m.scale.setScalar(p.scale || 1); break;
    case 'arcane': case 'orb': m = new THREE.Group(); m.add(new THREE.Mesh(geo.sphere, glow('#f4d8ff'))); m.children[0].scale.setScalar(0.15 * (p.scale || 1)); { const h = new THREE.Mesh(geo.sphere, new THREE.MeshBasicMaterial({ color: '#a040ff', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })); h.scale.setScalar(0.32 * (p.scale || 1)); m.add(h); } break;
    case 'arrow': case 'spectral': { m = new THREE.Group(); const sh = new THREE.Mesh(geo.arrow, p.kind === 'spectral' ? glow('#80ffd0') : new THREE.MeshStandardMaterial({ color: '#8a6a44' })); m.add(sh); const tip = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 4), p.kind === 'spectral' ? glow('#e0fff4') : new THREE.MeshStandardMaterial({ color: '#888', metalness: 0.8 })); tip.rotation.x = -Math.PI / 2; tip.position.z = -0.45; m.add(tip); if (p.kind === 'spectral') m.scale.setScalar(1.6); break; }
    case 'wave': { m = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.08, 4, 16, Math.PI), new THREE.MeshBasicMaterial({ color: '#c0e0ff', transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending })); break; }
    case 'impfire': m = new THREE.Mesh(geo.sphere, glow('#ff8020')); m.scale.setScalar(0.25); break;
    case 'poison': { m = new THREE.Group(); const sc = p.scale || 1; // a glob of bubbling poison: a glowing heart, a slime skin and bubbles boiling all over it
      const c = new THREE.Mesh(geo.sphere, glow('#e8ff90')); c.scale.setScalar(0.1 * sc); m.add(c);
      const sh = new THREE.Mesh(geo.sphere, new THREE.MeshStandardMaterial({ color: '#4a9a20', emissive: '#2a8a10', emissiveIntensity: 0.8, transparent: true, opacity: 0.7, roughness: 0.15, metalness: 0.1 })); sh.scale.set(0.22, 0.25, 0.22).multiplyScalar(sc); m.add(sh);
      const bm = new THREE.MeshStandardMaterial({ color: '#9aff5a', emissive: '#3aaa20', emissiveIntensity: 0.7, transparent: true, opacity: 0.55, roughness: 0.05 }); m.userData.bub = [];
      for (let i = 0; i < 11; i++) { const bb = new THREE.Mesh(geo.sphere, bm); const v = new THREE.Vector3().randomDirection(); bb.userData = { v, r: (0.03 + Math.random() * 0.05) * sc, ph: Math.random() * 6, sp: 6 + Math.random() * 8 }; m.add(bb); m.userData.bub.push(bb); } break; }
    case 'skull': { m = new THREE.Group(); const bone = new THREE.MeshStandardMaterial({ color: '#d8ceb0', roughness: 0.55 }), boneD = new THREE.MeshStandardMaterial({ color: '#9a8e70', roughness: 0.7 }), dark = new THREE.MeshBasicMaterial({ color: '#050403' }); // a screaming skull: sunken sockets with burning eyes, cracked bone, a jaw that snaps open and shut
      const cr = new THREE.Mesh(geo.sphere, bone); cr.scale.set(0.26, 0.25, 0.3); cr.position.y = 0.04; m.add(cr);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.12), bone); brow.position.set(0, 0.06, 0.2); brow.rotation.x = -0.25; m.add(brow);
      for (const x of [-1, 1]) { const ck = new THREE.Mesh(geo.sphere, bone); ck.scale.set(0.08, 0.06, 0.09); ck.position.set(x * 0.16, -0.06, 0.16); m.add(ck); const tmp2 = new THREE.Mesh(geo.sphere, boneD); tmp2.scale.set(0.05, 0.1, 0.12); tmp2.position.set(x * 0.24, -0.02, 0.0); m.add(tmp2); }
      for (const x of [-0.095, 0.095]) { const e = new THREE.Mesh(geo.sphere, dark); e.scale.set(0.085, 0.075, 0.06); e.position.set(x, -0.005, 0.235); m.add(e); const g2 = new THREE.Mesh(geo.sphere, glow('#a0ff60')); g2.scale.setScalar(0.04); g2.position.set(x, -0.005, 0.27); m.add(g2); const g3 = new THREE.Mesh(geo.sphere, new THREE.MeshBasicMaterial({ color: '#40ff20', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })); g3.scale.setScalar(0.09); g3.position.copy(g2.position); m.add(g3); }
      { const ns = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.08, 3), dark); ns.position.set(0, -0.09, 0.27); ns.rotation.x = Math.PI; m.add(ns); }
      for (let i = 0; i < 8; i++) { const t2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.02), bone); t2.position.set(-0.105 + i * 0.03, -0.15, 0.25 - Math.abs(i - 3.5) * 0.012); m.add(t2); } // (upper teeth)
      const jaw = new THREE.Group(); jaw.position.set(0, -0.13, 0.04); m.add(jaw); const jb = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, 0.24), bone); jb.position.set(0, -0.05, 0.08); jaw.add(jb);
      for (let i = 0; i < 8; i++) { const t2 = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.045, 0.02), bone); t2.position.set(-0.1 + i * 0.0285, 0.0, 0.2 - Math.abs(i - 3.5) * 0.012); jaw.add(t2); } // (lower teeth)
      const mo = new THREE.Mesh(geo.sphere, dark); mo.scale.set(0.11, 0.06, 0.08); mo.position.set(0, -0.17, 0.17); m.add(mo); m.userData.jaw = jaw;
      for (let i = 0; i < 4; i++) { const ck2 = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.09, 0.006), dark); ck2.position.set(-0.05 + i * 0.05, 0.2 - i * 0.02, 0.1 + i * 0.03); ck2.rotation.set(0.6, 0, 0.4 - i * 0.3); m.add(ck2); } // (cracks)
      m.scale.setScalar(p.scale || 1); break; }
    case 'bullet': m = new THREE.Mesh(geo.sphere, glow('#fff0b0')); m.scale.setScalar(0.07); break;
    case 'axe': { m = new THREE.Group(); const h = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 5), new THREE.MeshStandardMaterial({ color: '#6a4020' })); m.add(h); const b = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.03), new THREE.MeshStandardMaterial({ color: '#b0b8c0', metalness: 0.8, roughness: 0.3 })); b.position.y = 0.2; b.position.x = 0.08; m.add(b); break; }
    case 'javelin': { m = new THREE.Group(); const h = new THREE.Mesh(geo.arrow, new THREE.MeshStandardMaterial({ color: '#8a6a44' })); h.scale.set(2, 2, 2.2); m.add(h); break; }
    case 'keg': { // a powder keg with iron bands and a burning fuse
      m = new THREE.Group(); const wood = new THREE.MeshStandardMaterial({ color: '#7a4424', roughness: 0.8 }), iron = new THREE.MeshStandardMaterial({ color: '#2a2a2e', metalness: 0.7, roughness: 0.5 });
      m.add(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.5, 12), wood)); for (const y of [-0.17, 0.17]) { const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.275, 0.275, 0.05, 12), iron); b2.position.y = y; m.add(b2); }
      const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 5), new THREE.MeshStandardMaterial({ color: '#3a2a1a' })); fuse.position.y = 0.32; m.add(fuse);
      const spark = new THREE.Mesh(geo.sphere, glow('#ffd060')); spark.scale.setScalar(0.07); spark.position.y = 0.42; m.add(spark); m.userData.spark = spark; break; }
    case 'bomb': { // a goblin bomb: a round iron shell with rivets, a brass cap and a sputtering fuse
      m = new THREE.Group(); const iron = new THREE.MeshStandardMaterial({ color: '#26262a', metalness: 0.7, roughness: 0.45 }), brass = new THREE.MeshStandardMaterial({ color: '#b08a3a', metalness: 0.8, roughness: 0.4 });
      const sh = new THREE.Mesh(geo.sphere, iron); sh.scale.setScalar(0.2); m.add(sh); const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.07, 8), brass); cap.position.y = 0.2; m.add(cap);
      for (let i = 0; i < 6; i++) { const r = new THREE.Mesh(geo.sphere, brass); r.scale.setScalar(0.02); const a = i / 6 * Math.PI * 2; r.position.set(Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2); m.add(r); }
      const spark = new THREE.Mesh(geo.sphere, glow('#ffd060')); spark.scale.setScalar(0.06); spark.position.y = 0.3; m.add(spark); m.userData.spark = spark; m.scale.setScalar(p.scale || 1); break; }
    case 'dawn': m = new THREE.Group(); m.add(new THREE.Mesh(geo.sphere, glow('#fffbe8'))); m.children[0].scale.setScalar(0.13 * (p.scale || 1)); { const h = new THREE.Mesh(geo.sphere, new THREE.MeshBasicMaterial({ color: '#ffd860', transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false })); h.scale.setScalar(0.32 * (p.scale || 1)); m.add(h); } break;
    case 'knife': { m = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.3, 4), new THREE.MeshStandardMaterial({ color: '#d0d8e0', metalness: 0.9, roughness: 0.2 })); break; }
    case 'web': m = new THREE.Mesh(geo.sphere, new THREE.MeshBasicMaterial({ color: '#f0f0f8', transparent: true, opacity: 0.85 })); m.scale.setScalar(0.22); break;
    case 'rock': m = new THREE.Mesh(geo.rock, new THREE.MeshStandardMaterial({ color: '#7a746a', roughness: 0.9, flatShading: true })); m.scale.setScalar(0.12); break;
  }
  if (m) { m.position.copy(p.pos); G.scene.add(m); }
  p.mesh = m; G.projectiles.push(p); return p;
}
// where a creature's head is right now (people, orcs, trolls, wolves, bears, boars, deer...), or null if it has none
const _hp = new THREE.Vector3(), _hs = new THREE.Vector3(), _hv = new THREE.Vector3(), _hw = new THREE.Vector3();
function headOf(m) {
  if (m.isStruct) return null;
  const md = m.model || m.ch; if (!md) return null;
  if (md.headG) { md.headG.getWorldPosition(_hp); md.headG.getWorldScale(_hs); _hp.y += 0.1 * _hs.y; return { c: _hp, r: 0.15 * _hs.y }; }
  if (md.kind === 'quad' && md.head && md.P) { md.head.getWorldPosition(_hp); md.head.getWorldScale(_hs); return { c: _hp, r: md.P.headR * 1.25 * _hs.x }; }
  return null;
}
// does this arrow or ball pass through the head on its way? (checked along its flight line, not just where it is now)
function headHit(p, m) {
  const h = headOf(m); if (!h) return false;
  _hv.copy(p.vel).normalize(); _hw.copy(h.c).sub(p.pos);
  const t = Math.max(-0.6, Math.min(1.2, _hw.dot(_hv)));
  return _hw.addScaledVector(_hv, -t).length() < h.r + p.radius * 0.6;
}
export function updateProjectiles(dt) {
  const P = G.projectiles;
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i]; p.t += dt; p.life -= dt;
    // 'flat': fly straight for that long, then let gravity ease in over 0.8 s
    p.vel.y -= p.grav * (p.flat ? Math.min(1, Math.max(0, (p.t - p.flat) / 0.8)) : 1) * dt;
    if (p.homing) { let best = null, bd = 25; for (const m of G.mobs) { if (m.dead || !foe(m)) continue; const d = m.pos.distanceTo(p.pos); if (d < bd) { bd = d; best = m; } } if (best) { const tgt = best.pos.clone(); tgt.y += best.height * 0.5; const want = tgt.sub(p.pos).normalize().multiplyScalar(p.vel.length()); p.vel.lerp(want, Math.min(1, dt * 4)); } }
    const step = p.vel.clone().multiplyScalar(dt);
    const sub = Math.max(1, Math.ceil(step.length() / 0.6));
    let dead = false;
    for (let s = 0; s < sub && !dead; s++) {
      p.pos.addScaledVector(step, 1 / sub);
      // hits
      if (p.owner === 'player') {
        for (const m of G.mobs) {
          if (m.dead || p.hitSet.has(m) || !foe(m)) continue;
          const c = tmp.copy(m.pos); c.y += m.height * 0.5;
          const r = Math.max(m.radius, m.height * 0.5) + p.radius * 1.4 + 0.15;
          if (c.distanceToSquared(p.pos) < r * r) {
            p.hitSet.add(m);
            // Kingdom Battles headshots: any arrow or musket ball through anything with a head
            const head = G.battleFx && (p.kind === 'arrow' || p.kind === 'spectral' || p.kind === 'bullet') && headHit(p, m);
            const d0 = p.dmg; if (head) { p.dmg *= 2; V.number(p.pos.clone().setY(m.pos.y + m.height + 0.4), 'Headshot!', 'crit'); S.hit('flesh', m.pos, 1.6); G.hitstop = 0.06; }
            impact(p, m); p.dmg = d0;
            if (!p.pierce) { dead = true; break; }
          }
        }
      } else if (p.owner === 'enemy' && G.remoteHeroes && G.remoteHeroes().some(r => !r.dead && Math.hypot(r.pos.x - p.pos.x, r.pos.y + 1 - p.pos.y, r.pos.z - p.pos.z) < 0.6 + p.radius && (r.takeDamage(p.dmg, p.src, { ranged: true }), true))) { dead = true;
      } else if (p.owner === 'enemy' && !G.player.dead) {
        const c = tmp.copy(G.player.pos); c.y += 1.0;
        if (c.distanceToSquared(p.pos) < (0.6 + p.radius) ** 2) { if (p.kind === 'web') { G.player.takeDamage(p.dmg * 0.4, p.src, { ranged: true }); G.player.debuff('slow', 4); V.burst('cotton', p.pos, 14, { speed: 2, size: 0.15 }); } else G.player.takeDamage(p.dmg, p.src, { ranged: true }); if (p.kind === 'web') {} else if (p.kind === 'rock') { V.burst('stone', p.pos, 8, { speed: 3 }); S.hit('stone', p.pos, 0.6); } else { V.burst('fire', p.pos, 14, { speed: 3 }); S.explode(p.pos, 0.4); } dead = true; }
      }
      const gh = heightAt(p.pos.x, p.pos.z);
      if (!dead && p.pos.y < gh) { p.pos.y = gh; impact(p, null); dead = true; }
      if (!dead && ARENA_MODE && solidAt(p.pos.x, p.pos.y, p.pos.z)) { impact(p, null); dead = true; } // (the arena: shots stop at walls and buildings)
    }
    if (!dead && p.life <= 0) { if (p.aoe) impact(p, null); dead = true; }
    // trails
    if (p.mesh) {
      p.mesh.position.copy(p.pos);
      if (p.kind === 'arrow' || p.kind === 'spectral' || p.kind === 'frost' || p.kind === 'wave' || p.kind === 'javelin') p.mesh.lookAt(p.pos.clone().sub(p.vel));
      if (p.kind === 'axe' || p.kind === 'knife') { p.mesh.rotation.x += dt * 20; }
      if (p.kind === 'bomb') { p.mesh.rotation.x += dt * 9; if (Math.random() < dt * 30) V.emit('spark', p.mesh.localToWorld(new THREE.Vector3(0, 0.3, 0)), { speed: 1.5, size: 0.12 }); }
      if (p.kind === 'dawn' && Math.random() < dt * 40) V.emit('gold', p.pos, { speed: 0.4, size: 0.18, life: 0.4 });
      if (p.kind === 'keg') { p.mesh.rotation.x += dt * 7; p.mesh.rotation.z += dt * 3; if (Math.random() < dt * 40) V.burst('fire', p.mesh.localToWorld(new THREE.Vector3(0, 0.42, 0)), 2, { speed: 1.5, size: 0.25, life: 0.3 }); }
      if (p.kind === 'wave') p.mesh.rotateZ(Math.PI / 2);
      if (p.kind === 'skull') { p.mesh.lookAt(p.pos.clone().add(p.vel)); p.mesh.rotateZ(Math.sin(p.life * 18) * 0.15); const jw = p.mesh.userData.jaw; if (jw) jw.rotation.x = Math.max(0, Math.sin(p.life * 14)) * 0.75; const sc = p.mesh.scale.x; for (let k = 0; k < 3; k++) V.emit('shadow', p.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5 * sc, (Math.random() - 0.3) * 0.5 * sc, (Math.random() - 0.5) * 0.5 * sc)), { speed: 0.6, size: 0.35 * sc, life: 0.7 }); if (Math.random() < dt * 25) V.emit('green', p.pos, { speed: 0.4, size: 0.15 * sc, life: 0.35 }); } // (it chomps as it flies, trailing black smoke)
      if (p.kind === 'poison' && p.mesh.userData.bub) { for (const bb of p.mesh.userData.bub) { const u = bb.userData, k = (p.life * u.sp + u.ph) % 1, rr = u.r * Math.sin(k * Math.PI); bb.scale.setScalar(Math.max(0.001, rr)); bb.position.copy(u.v).multiplyScalar(0.2 * (p.scale || 1) + rr * 0.6); } if (Math.random() < dt * 40) V.emit('poison', p.pos, { speed: 0.6, size: 0.18, life: 0.5 }); }
      if (p.kind === 'poison') { const w = 1 + Math.sin(p.life * 30) * 0.12; p.mesh.children[1].scale.set(0.22 * w, 0.25 / w, 0.22 * w).multiplyScalar(p.scale || 1); }
      if (p.kind === 'meteor' || p.kind === 'rock') { p.mesh.rotation.x += dt * 8; p.mesh.rotation.z += dt * 6; }
    }
    trail(p, dt);
    if (dead) { if (p.mesh) G.scene.remove(p.mesh); P.splice(i, 1); }
  }
}
function trail(p, dt) {
  p.acc = (p.acc || 0) + dt;
  const k = p.kind;
  if (k === 'fireball' || k === 'impfire') { while (p.acc > 0.012) { p.acc -= 0.012; V.add.spawn(p.pos.x + rand(-0.08, 0.08), p.pos.y + rand(-0.08, 0.08), p.pos.z + rand(-0.08, 0.08), rand(-0.4, 0.4), rand(0.2, 0.9), rand(-0.4, 0.4), 0.35, 0.45 * (p.scale || 1), 0.05, PALF[0], PALF[1], 1, 0, -1, 1); } if (Math.random() < 0.3) V.norm.spawn(p.pos.x, p.pos.y, p.pos.z, 0, 0.6, 0, 0.9, 0.2, 0.7, SM[0], SM[1], 0.25, 0, -0.2, 0.3); }
  else if (k === 'meteor') { while (p.acc > 0.006) { p.acc -= 0.006; V.add.spawn(p.pos.x + rand(-0.8, 0.8), p.pos.y + rand(-0.8, 0.8), p.pos.z + rand(-0.8, 0.8), rand(-1, 1), rand(0, 2), rand(-1, 1), 0.6, 1.6, 0.2, PALF[0], PALF[1], 1, 0, -1, 1); V.norm.spawn(p.pos.x, p.pos.y, p.pos.z, rand(-0.5, 0.5), 1, rand(-0.5, 0.5), 1.6, 1.0, 3.0, SM[0], SM[1], 0.45, 0, -0.3, 0.3); } }
  else if (k === 'poison') { while (p.acc > 0.03) { p.acc -= 0.03; V.burst('poison', p.pos.clone(), 1, { speed: 0.3, size: 0.22, size1: 0.05, life: 0.6, grav: 9, vy: -0.5 }); if (Math.random() < 0.4) V.burst('leaf', p.pos.clone(), 1, { speed: 0.6, size: 0.18, life: 0.5 }); } } // it drips as it flies
  else if (k === 'skull') { while (p.acc > 0.025) { p.acc -= 0.025; V.burst('shadow', p.pos.clone(), 1, { speed: 0.4, size: 0.5, size1: 0.1, life: 0.5, grav: 0 }); V.burst('green', p.pos.clone(), 1, { speed: 0.5, size: 0.16, life: 0.4 }); } }
  else if (k === 'frost') { while (p.acc > 0.02) { p.acc -= 0.02; V.add.spawn(p.pos.x, p.pos.y, p.pos.z, rand(-0.5, 0.5), rand(-0.5, 0.5), rand(-0.5, 0.5), 0.4, 0.25, 0.02, FR[0], FR[1], 1, 0, 1, 1); } }
  else if (k === 'arcane' || k === 'orb') { while (p.acc > 0.015) { p.acc -= 0.015; V.add.spawn(p.pos.x, p.pos.y, p.pos.z, rand(-0.8, 0.8), rand(-0.8, 0.8), rand(-0.8, 0.8), 0.45, 0.3 * (p.scale || 1), 0.02, AR[0], AR[1], 1, 0, 0, 1); } }
  else if (k === 'spectral') { while (p.acc > 0.008) { p.acc -= 0.008; V.add.spawn(p.pos.x, p.pos.y, p.pos.z, 0, 0, 0, 0.5, 0.35, 0.02, SP[0], SP[1], 1, 0, 0, 0); } }
  else if (k === 'arrow' && p.charged) { while (p.acc > 0.02) { p.acc -= 0.02; V.add.spawn(p.pos.x, p.pos.y, p.pos.z, 0, 0, 0, 0.3, 0.12, 0.02, SP[0], SP[1], 0.6, 0, 0, 0); } }
  else if (k === 'wave') { while (p.acc > 0.02) { p.acc -= 0.02; V.add.spawn(p.pos.x + rand(-1, 1), p.pos.y, p.pos.z + rand(-1, 1), 0, 0.5, 0, 0.3, 0.3, 0.02, LI[0], LI[1], 0.8, 0, 0, 0); } }
}
const C = (h) => new THREE.Color(h);
const PALF = [C('#ffe08a'), C('#ff3a08')], SM = [C('#4a4440'), C('#222')], FR = [C('#ffffff'), C('#50b8ff')], AR = [C('#ffd8ff'), C('#7a20ff')], SP = [C('#e0fff4'), C('#30ffa0')], LI = [C('#ffffff'), C('#80b0ff')];
function impact(p, mob) {
  const pos = p.pos.clone();
  if (p.onHit) p.onHit(p, mob, pos);
  else if (mob) G.player.dealDamage(mob, p.dmg, { ranged: true, el: p.el });
  if (mob && mob.arenaBot && p.owner === 'player') { // the arena: every hit lands with a flash and a thump you can feel
    const col = { fireball: '#ffb050', frost: '#a8e4ff', arcane: '#d8a0ff', poison: '#90ff50', spectral: '#a0ffe0', bullet: '#fff0c0', arrow: '#fff0d0', skull: '#90ff70' }[p.kind] || '#fff0d0';
    V.sphereFlash(pos, p.kind === 'bullet' || p.kind === 'arrow' ? 0.45 : 0.8, col, 0.14); V.light(pos, col, 3.5, 0.12, 7); S.hit('flesh', pos, p.kind === 'bullet' || p.kind === 'arrow' ? 0.8 : 1.1); }
  if (mob && p.wpn && p.owner === 'player' && G.player.wpnXp) G.player.wpnXp(1);
  if (p.kind === 'arrow' || p.kind === 'spectral') { S.arrowHit(pos); if (!mob) V.burst('dust', pos, 5, { speed: 1.5, size: 0.1 }); else if (p.kind === 'arrow' && !p.pierce) { /* stick arrow into mob briefly */ } }
}

// ---- telegraphed blasts (boss meteors) ----
export function telegraph(p, r, delay, fn) {
  const ring = new THREE.Mesh(new THREE.CircleGeometry(r, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff3010', transparent: true, opacity: 0.25, depthWrite: false }));
  ring.position.set(p.x, heightAt(p.x, p.z) + 0.15, p.z); G.scene.add(ring);
  const edge = new THREE.Mesh(new THREE.RingGeometry(r * 0.94, r, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff6020', transparent: true, opacity: 0.8, depthWrite: false }));
  edge.position.copy(ring.position); edge.position.y += 0.02; G.scene.add(edge);
  // a falling meteor
  const rock = new THREE.Mesh(geo.rock, new THREE.MeshStandardMaterial({ color: '#2a1810', emissive: '#ff4010', emissiveIntensity: 1 })); rock.scale.setScalar(0.8); G.scene.add(rock);
  let t = 0;
  G.timers.push({ update(dt) {
    t += dt; const k = Math.min(1, t / delay);
    ring.scale.setScalar(0.2 + k * 0.8); ring.material.opacity = 0.15 + k * 0.25;
    rock.position.set(p.x + (1 - k) * 12, ring.position.y + (1 - k) * 40, p.z - (1 - k) * 6);
    if (Math.random() < 0.6) V.add.spawn(rock.position.x, rock.position.y, rock.position.z, 0, 1, 0, 0.5, 1.2, 0.2, PALF[0], PALF[1], 1, 0, 0, 0);
    if (t >= delay) { G.scene.remove(ring, edge, rock); fn(); return true; }
    return false;
  } });
  if (Math.random() < 0.5) S.whistle(p, delay);
}
export function enemyBlast(p, r, dmg, src) {
  V.burst('fire', p, 40, { speed: 9, size: 0.9, life: 0.8 }); V.burst('smoke', p, 14, { speed: 3, size: 1.4, life: 1.6, vy: 2 }); V.ring(p, r * 1.2, '#ff8040', 0.5);
  V.light(p.clone().setY(p.y + 2), '#ff6020', 6, 0.5, 22); S.explode(p, 1.2); V.addShake(0.35);
  const pl = G.player; if (Math.hypot(pl.pos.x - p.x, pl.pos.z - p.z) < r + 0.4) pl.takeDamage(dmg, src, { aoe: true });
}
export function enemyProjectile(mob, player) {
  const from = mob.pos.clone(); from.y += mob.height * 0.7;
  const to = player.pos.clone(); to.y += 1.0;
  const rock = mob.def.proj === 'rock';
  const d = to.clone().sub(from); const dist = d.length(); const speed = rock ? 16 : 18, grav = rock ? 9 : 4;
  const t = dist / speed; const v = d.multiplyScalar(1 / t); v.y += 0.5 * grav * t;
  if (rock) S.swingW('light', 1, from); else S.cast('fire', from, 0.6);
  spawnProjectile({ pos: from, vel: v, grav, radius: 0.3, dmg: mob.dmg, owner: 'enemy', kind: rock ? 'rock' : 'impfire', life: 4, src: mob });
}

// ---- lightning bolt visual ----
export function mobShot(mob, player, kind) {
  const from = mob.pos.clone(); from.y += mob.height * 0.6; const to = player.pos.clone(); to.y += 1.0;
  const d = to.clone().sub(from), dist = d.length(), speed = 17, t = dist / speed, v = d.multiplyScalar(1 / t); v.y += 0.5 * 6 * t;
  S.growl('spider', from); spawnProjectile({ pos: from, vel: v, grav: 6, radius: 0.35, dmg: mob.dmg, owner: 'enemy', kind, life: 4, src: mob });
}
export function mobBlast(mob, r, kind) {
  const p = mob.pos.clone();
  if (kind === 'nova') { V.burst('fire', p.clone().setY(p.y + 0.5), 60, { speed: 9, up: 0.3, size: 0.6 }); V.ring(p, r, '#ff7030', 0.5); S.explode(p, 0.9); }
  else { V.burst('stone', p, 30, { speed: 8, size: 0.3, grav: 14 }); V.burst('dust', p, 25, { speed: 5, size: 1.2, life: 1.3 }); V.ring(p, r, '#d8b080', 0.5); S.explode(p, 1.0); S.rumble(p, 0.8); }
  V.addShake(0.35);
}
export function telegraphSelf(mob, r, delay) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.9, r, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff3010', transparent: true, opacity: 0.85, depthWrite: false }));
  const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff3010', transparent: true, opacity: 0.18, depthWrite: false }));
  G.scene.add(ring, disc); let t = 0;
  G.timers.push({ update(dt) { t += dt; const p = mob.pos; ring.position.set(p.x, heightAt(p.x, p.z) + 0.12, p.z); disc.position.copy(ring.position); disc.scale.setScalar(Math.min(1, t / delay)); if (t >= delay || mob.dead) { G.scene.remove(ring, disc); return true; } return false; } });
}
// red warning path on the ground for charges and pounces; the mob commits to this line
export function telegraphLine(mob, player, len, w, delay) {
  const dir = player.pos.clone().sub(mob.pos).setY(0).normalize();
  mob.lockDir = dir.clone(); mob.lockLen = len; mob.yaw = Math.atan2(dir.x, dir.z);
  const mk = (op) => { const g = new THREE.PlaneGeometry(w, len, 1, 16).rotateX(-Math.PI / 2); g.translate(0, 0, len / 2); const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#ff2a10', transparent: true, opacity: op, depthWrite: false })); m.renderOrder = 5; return m; };
  const area = mk(0.22), fill = mk(0.45);
  const start = mob.pos.clone(); const yaw = Math.atan2(dir.x, dir.z);
  for (const m of [area, fill]) { m.position.set(start.x, heightAt(start.x, start.z) + 0.15, start.z); m.rotation.y = yaw; G.scene.add(m); }
  // follow the ground along the path
  for (const m of [area, fill]) { const pa = m.geometry.attributes.position; for (let i = 0; i < pa.count; i++) { const lx = pa.getX(i), lz = pa.getZ(i); const wx = start.x + lx * Math.cos(yaw) + lz * Math.sin(yaw), wz = start.z - lx * Math.sin(yaw) + lz * Math.cos(yaw); pa.setY(i, heightAt(wx, wz) - heightAt(start.x, start.z) + 0.05); } pa.needsUpdate = true; }
  let t = 0;
  G.timers.push({ update(dt) { t += dt; const k = Math.min(1, t / delay); fill.scale.z = Math.max(0.01, k); area.material.opacity = 0.18 + 0.1 * Math.sin(t * 20); if (t >= delay + 0.35 || mob.dead) { G.scene.remove(area, fill); return true; } return false; } });
}
export function telegraphCone(mob, r, delay) {
  const g = new THREE.CircleGeometry(r, 24, -0.75, 1.5).rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#ff2a10', transparent: true, opacity: 0.35, depthWrite: false })); m.renderOrder = 5; G.scene.add(m);
  let t = 0;
  G.timers.push({ update(dt) { t += dt; const p = mob.pos; m.position.set(p.x, heightAt(p.x, p.z) + 0.15, p.z); m.rotation.y = mob.yaw - Math.PI / 2; m.material.opacity = 0.2 + 0.25 * Math.min(1, t / delay); if (t >= delay || mob.dead) { G.scene.remove(m); return true; } return false; } });
}
export function lightning(a, b) {
  if (Math.random() < 0.8) S.zap(b, 0.9);
  const pts = []; const n = 10;
  for (let i = 0; i <= n; i++) { const p = a.clone().lerp(b, i / n); if (i && i < n) p.add(new THREE.Vector3(rand(-0.5, 0.5), rand(-0.5, 0.5), rand(-0.5, 0.5))); pts.push(p); }
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#d8e8ff', transparent: true }));
  const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.06, 4), new THREE.MeshBasicMaterial({ color: '#a8c8ff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  V.temp(l, 0.25, (m, k) => { m.material.opacity = 1 - k; });
  V.temp(tube, 0.25, (m, k) => { m.material.opacity = 1 - k; });
  for (const p of pts) V.add.spawn(p.x, p.y, p.z, rand(-1, 1), rand(-1, 1), rand(-1, 1), 0.3, 0.3, 0.02, LI[0], LI[1], 1, 0, 0, 1);
}
