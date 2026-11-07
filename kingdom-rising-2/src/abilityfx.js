// Ability visuals for the arena classes, shared by players and computer fighters. Each entry dresses an ability
// that already does its job in the game rules (damage, heal, stun...) with its own look. Redone class by class
// (see docs/ULTIMATES.md); classes not listed here keep the generic effects.
import * as THREE from 'three';
import { G } from './state.js';
import { V } from './vfx.js';
import { S } from './audio.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const glow = (c, op = 0.8) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
const ease = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
// run fn(k, t, dt) every frame for dur seconds, then clean up the meshes
function play(dur, meshes, fn) { for (const m of meshes) G.scene.add(m); let t = 0; G.timers.push({ update: (dt) => { t += dt; fn(Math.min(1, t / dur), t, dt); if (t >= dur) { for (const m of meshes) G.scene.remove(m); return true; } return false; } }); }
const fwdOf = (u) => V3(Math.sin(u.yaw || 0), 0, Math.cos(u.yaw || 0));
const handOf = (u) => { const ch = u.ch || u.model; const h = ch && ch.arms && ch.arms.R && ch.arms.R.hand; if (h) { (ch.root || h).updateMatrixWorld(true); return h.getWorldPosition(V3(0, 0, 0)); } return u.pos.clone().setY(u.pos.y + 1.3); };

const FX = {
  // ---------- Paladin ----------
  layonhands(u) { // a shaft of light pours down on him, his hands blaze gold, a ring of light spreads to the allies it heals
    const p = u.pos.clone(), col = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.4, 14, 24, 1, true), glow('#fff0b0', 0)); col.position.set(p.x, p.y + 7, p.z);
    const disc = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.6, 48), glow('#ffd860', 0.9)); disc.rotation.x = -Math.PI / 2; disc.position.set(p.x, p.y + 0.06, p.z);
    S.cast && S.cast('holy', p, 0.9); V.light(p.clone().setY(p.y + 2), '#ffe8a0', 7, 0.9, 16);
    play(1.3, [col, disc], (k, t) => { col.material.opacity = 0.55 * Math.sin(Math.min(1, k * 1.4) * Math.PI); col.position.set(u.pos.x, u.pos.y + 7, u.pos.z); disc.scale.setScalar(1 + ease(k) * 10); disc.material.opacity = 0.9 * (1 - k);
      if (Math.random() < 0.7) { const a = Math.random() * Math.PI * 2; V.emit('gold', u.pos.clone().add(V3(Math.cos(a) * 0.8, Math.random() * 2, Math.sin(a) * 0.8)), { speed: 0.3, vy: 2.5, size: 0.25, life: 0.8 }); }
      if (t < 0.6 && Math.random() < 0.6) V.emit('gold', handOf(u), { speed: 0.6, size: 0.3, life: 0.4 }); });
  },
  smitearc(u) { // Radiant Sweep: a crescent of holy light rips out across the front of the swing
    const p = u.pos.clone(), f = fwdOf(u), yaw = Math.atan2(f.x, f.z), arc = new THREE.Mesh(new THREE.RingGeometry(1.2, 5.2, 40, 1, -0.65, 1.3), glow('#ffe080', 0.9));
    arc.rotation.x = -Math.PI / 2; const holder = new THREE.Group(); holder.add(arc); holder.position.set(p.x, p.y + 1.0, p.z); holder.rotation.y = yaw - Math.PI / 2; arc.rotation.z = 0;
    const edge = new THREE.Mesh(new THREE.RingGeometry(4.9, 5.4, 40, 1, -0.65, 1.3), glow('#ffffff', 1)); edge.rotation.x = -Math.PI / 2; holder.add(edge);
    S.cast && S.cast('holy', p, 0.6); V.light(p.clone().add(f.clone().multiplyScalar(3)).setY(p.y + 1.2), '#ffe090', 6, 0.3, 14);
    for (let i = 0; i < 18; i++) { const a = yaw + (i / 17 - 0.5) * 1.3, d = 2 + Math.random() * 3; V.emit('gold', p.clone().add(V3(Math.sin(a) * d, 1 + Math.random() * 0.6, Math.cos(a) * d)), { speed: 2, size: 0.3, life: 0.5 }); }
    play(0.45, [holder], (k) => { holder.scale.setScalar(0.5 + ease(k) * 0.6); arc.material.opacity = 0.85 * (1 - k); edge.material.opacity = 1 - k; holder.position.y = p.y + 1.0 - k * 0.4; });
  },
  hammerstrike(u, a, T) { // a spectral golden hammer comes down out of the air onto the target with him
    const f = fwdOf(u), at = T && T.pos ? T.pos.clone() : u.pos.clone().add(f.multiplyScalar(2.6)); const g = new THREE.Group(), gold = new THREE.MeshStandardMaterial({ color: '#ffd060', emissive: '#ffb020', emissiveIntensity: 0.9, metalness: 0.8, roughness: 0.3, transparent: true, opacity: 0.9 });
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.7), gold); head.position.y = 0; g.add(head); const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.0, 8), gold); handle.position.y = 1.2; g.add(handle);
    const aura = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 1.0), glow('#fff0a0', 0.35)); g.add(aura);
    g.position.set(at.x, at.y + 4.5, at.z); g.rotation.y = Math.atan2(f.x, f.z);
    play(0.55, [g], (k, t) => { const d = ease(Math.min(1, t / 0.22)); g.position.y = at.y + 4.5 - d * 3.9; g.rotation.x = -1.2 + d * 1.2; gold.opacity = 0.9 * (t < 0.3 ? 1 : 1 - (t - 0.3) / 0.25); aura.material.opacity = 0.35 * (1 - k);
      if (t >= 0.22 && !g.userData.hit) { g.userData.hit = true; const c = at.clone().setY(at.y + 0.3); V.burst('gold', c, 50, { speed: 7 }); V.burst('stone', c, 20, { speed: 5 }); V.ring(c, 4, '#ffd860', 0.5); V.sphereFlash(c.clone().setY(c.y + 0.8), 1.4, '#fff0b0', 0.25); V.addShake(0.35); S.hit && S.hit('blunt', c, 1.5);
        for (let i = 0; i < 5; i++) { const a2 = i / 5 * Math.PI * 2; V.emit('gold', at.clone().add(V3(Math.cos(a2) * 0.4, 2.1, Math.sin(a2) * 0.4)), { speed: 0.3, size: 0.35, life: 1.0 }); } } });
  },
  shieldofl(u) { // Shield of Light: a dome of golden light settles over him and holds while the shield lasts, then shatters
    const dome = new THREE.Mesh(new THREE.IcosahedronGeometry(1.35, 2), glow('#ffd870', 0.18)), wire = new THREE.Mesh(new THREE.IcosahedronGeometry(1.37, 2), new THREE.MeshBasicMaterial({ color: '#fff0a0', wireframe: true, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
    S.cast && S.cast('holy', u.pos, 0.8); const B = u.buffs || {}, dur = 10;
    play(dur, [dome, wire], (k, t) => { const up = (u.buffs && u.buffs.barrier > 0) || (!u.buffs && t < dur); const s = Math.min(1, t * 5) * (1 + Math.sin(t * 4) * 0.03);
      for (const m of [dome, wire]) { m.position.set(u.pos.x, u.pos.y + 1.0, u.pos.z); m.scale.setScalar(s); } wire.rotation.y = t * 0.5; dome.material.opacity = 0.18 * (1 - k * 0.3);
      if (u === G.player && u.camDist < 0.6) { dome.visible = wire.visible = false; } else { dome.visible = wire.visible = true; }
      if (!up && t > 0.3 && !dome.userData.gone) { dome.userData.gone = true; V.burst('gold', u.pos.clone().setY(u.pos.y + 1), 40, { speed: 5 }); S.hit && S.hit('glass', u.pos, 1); dome.material.opacity = 0; wire.material.opacity = 0; } });
  },
};
export function abilityFx(u, a, T) { const f = a && FX[a.id]; if (!f) return; try { f(u, a, T); } catch (e) { console.warn('abilityFx', a.id, e); } }

// ---------- body poses that the generic animation can't do (kicks) ----------
// u.kickT counts down; while it runs the legs and body take a flying-kick shape (players and computer fighters)
export function bodyPoseTick(u, ch, dt) {
  if (ch && u.spinT > 0) { u.spinT -= dt; u.spinA = (u.spinA || 0) + dt * 15; ch.root.rotation.y += u.spinA; const A2 = ch.arms; // (Bladestorm: the whole body whirls, arms out, axes level)
    if (A2) { A2.R.sh.rotation.set(-0.15, 0, 1.45); A2.L.sh.rotation.set(-0.15, 0, -1.45); A2.R.el.rotation.x = -0.1; A2.L.el.rotation.x = -0.1; }
    if (ch.legs) { ch.legs.R.thigh.rotation.x = -0.35; ch.legs.L.thigh.rotation.x = 0.25; ch.legs.R.knee.rotation.x = 0.6; ch.legs.L.knee.rotation.x = 0.5; } if (ch.body) ch.body.rotation.x = 0.12; return; }
  if (!ch || !ch.legs || !(u.kickT > 0)) return; u.kickT -= dt; const dur = u.kickDur || 0.55, k = 1 - Math.max(0, u.kickT) / dur, ext = Math.sin(Math.min(1, k * 1.25) * Math.PI * 0.5) * (k > 0.85 ? (1 - k) / 0.15 : 1);
  const s = u.kickSide || 'R', o = s === 'R' ? 'L' : 'R', Lg = ch.legs, A2 = ch.arms;
  Lg[s].thigh.rotation.x = -1.55 * ext; Lg[s].knee.rotation.x = 0.1 + (1 - ext) * 1.2; if (Lg[s].ankle) Lg[s].ankle.rotation.x = 0.5 * ext;
  Lg[o].thigh.rotation.x = 0.35 * ext; Lg[o].knee.rotation.x = 1.7 * ext;
  if (A2) { A2.R.sh.rotation.x = 0.7 * ext; A2.L.sh.rotation.x = 0.7 * ext; A2.R.sh.rotation.z = 0.5 * ext; A2.L.sh.rotation.z = -0.5 * ext; A2.R.el.rotation.x = -0.9 * ext; A2.L.el.rotation.x = -0.9 * ext; }
  if (ch.body) ch.body.rotation.x = -0.3 * ext;
}
FX.flyingkick = (u) => { u.kickT = u.kickDur = 0.55; u.kickSide = Math.random() < 0.5 ? 'R' : 'L'; S.dodge && S.dodge();
  let t = 0; G.timers.push({ update: (dt) => { t += dt; const p = u.pos.clone().setY(u.pos.y + 0.9); V.emit('frost', p, { speed: 0.4, size: 0.35, life: 0.35 }); if (Math.random() < 0.6) V.emit('gold', p, { speed: 0.6, size: 0.2, life: 0.3 }); return t > 0.5; } }); };
