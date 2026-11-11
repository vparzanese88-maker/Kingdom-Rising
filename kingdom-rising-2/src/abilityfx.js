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
    const p = u.pos.clone(), col = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.4, 14, 24, 1, true), softGlow('#fff0b0')); col.onBeforeRender = () => { col.material.uniforms.op.value = col.material.opacity; }; col.position.set(p.x, p.y + 7, p.z);
    const disc = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.6, 48), glow('#ffd860', 0.9)); disc.rotation.x = -Math.PI / 2; disc.position.set(p.x, p.y + 0.06, p.z);
    S.cast && S.cast('holy', p, 0.9); V.light(p.clone().setY(p.y + 2), '#ffe8a0', 7, 0.9, 16);
    const colK = fpSelf(u) ? 0 : u === G.player ? 0.2 : 0.4; /* (your own view: no shaft round your eyes; over your shoulder: a soft one that never washes you out) */ if (u === G.player) col.scale.set(2.2, 1.6, 2.2); play(1.3, [col, disc], (k, t) => { col.material.opacity = colK * Math.sin(Math.min(1, k * 1.4) * Math.PI); col.position.set(u.pos.x, u.pos.y + 7 * col.scale.y, u.pos.z); disc.scale.setScalar(1 + ease(k) * 10); disc.material.opacity = 0.9 * (1 - k);
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
// ---------- shared pieces for the signature looks below ----------
const after = (sec, fn) => { let t = 0; G.timers.push({ update: (dt) => { t += dt; if (t >= sec) { fn(); return true; } return false; } }); }; // (on the game clock)
const fpSelf = (u) => u === G.player && (u.camDist || 0) < 0.6; // (your own first-person view: no blinding light round your own eyes)
const tpos = (u, T, d = 7) => (T && T.pos ? T.pos.clone() : u.pos.clone().addScaledVector(fwdOf(u), d));
const chest = (p, h = 1.1) => p.clone().setY(p.y + h);
function gRing(p, r0, r1, col, dur = 0.5, op = 0.8) { if (Math.max(r0, r1) >= 1.8 && !(V.ultUntil > performance.now())) return; const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 64), glow(col, op)); m.rotation.x = -Math.PI / 2; m.position.copy(p).setY(p.y + 0.06); play(dur, [m], (k) => { m.scale.setScalar(r0 + (r1 - r0) * ease(k)); m.material.opacity = op * (1 - k); }); }
function runeCircle(p, r, col, dur = 1.0) { if (r >= 1.8 && !(V.ultUntil > performance.now())) return; const g = new THREE.Group(); g.position.copy(p).setY(p.y + 0.07); for (const rr of [r, r * 0.72]) { const m = new THREE.Mesh(new THREE.RingGeometry(rr - 0.06, rr, 48), glow(col, 0.8)); m.rotation.x = -Math.PI / 2; g.add(m); } for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.06, r * 0.72), glow(col, 0.7)); m.rotation.x = -Math.PI / 2; m.rotation.z = i / 6 * Math.PI; g.add(m); }
  play(dur, [g], (k, t) => { g.rotation.y = t * 1.5; g.scale.setScalar(ease(Math.min(1, k * 4))); g.children.forEach(m => { m.material.opacity = 0.8 * (1 - Math.max(0, (k - 0.6) / 0.4)); }); }); }
// a soft light column: brightest through its middle, fading out toward its silhouette edges and at the top and bottom,
// so it reads as a shaft of light or flame, never a flat hard-edged panel
const SOFT_V = `varying vec3 vN; varying vec3 vV; varying vec2 vU; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vU = uv; gl_Position = projectionMatrix * mv; }`;
const SOFT_F = `uniform vec3 color; uniform float op; varying vec3 vN; varying vec3 vV; varying vec2 vU; void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 1.6); float v = smoothstep(0.0, 0.12, vU.y) * (1.0 - smoothstep(0.55, 1.0, vU.y)); gl_FragColor = vec4(color * (0.75 + 0.5 * f), op * f * v); }`;
function softGlow(col) { const m = new THREE.ShaderMaterial({ uniforms: { color: { value: new THREE.Color(col) }, op: { value: 0 } }, vertexShader: SOFT_V, fragmentShader: SOFT_F, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }); m.opacity = 0; return m; }
function pillar(p, col, r = 0.9, h = 8, dur = 0.7, u) { if (u && fpSelf(u) && p.distanceTo(u.pos) < r + 0.5) { gRing(p, 0.5, r * 3, col, dur, 0.6); return; } const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r, h, 24, 1, true), softGlow(col)); m.onBeforeRender = () => { m.material.uniforms.op.value = m.material.opacity; }; m.position.copy(p).setY(p.y + h / 2); play(dur, [m], (k) => { m.material.opacity = 0.6 * Math.sin(k * Math.PI); m.scale.set(1 - k * 0.4, 1, 1 - k * 0.4); }); }
function beam(from, to, col, dur = 0.35, w = 0.12, core = 0.95) { const d = to.clone().sub(from), L = d.length(), m = new THREE.Mesh(new THREE.CylinderGeometry(w, w, L, 10, 1, true), glow(col, 0.9)), c = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.35, w * 0.35, L, 6, 1, true), glow('#ffffff', core)); for (const o of [m, c]) { o.position.copy(from).lerp(to, 0.5); o.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize()); } play(dur, [m, c], (k) => { m.material.opacity = 0.9 * (1 - k); c.material.opacity = core * (1 - k); m.scale.x = m.scale.z = 1 + k * 1.5; }); }
function slashArc(u, col, tilt = 0, r = 1.6, dur = 0.28, spin = 1) { const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.06, 4, 32, Math.PI * 0.9), glow(col, 0.9)); const f = fwdOf(u); m.position.copy(u.pos).addScaledVector(f, 0.6).setY(u.pos.y + 1.2); m.rotation.set(Math.PI / 2 + tilt, 0, (u.yaw || 0) - Math.PI * 0.95); m.rotation.order = 'YXZ'; m.rotation.y = u.yaw || 0; m.rotation.x = Math.PI / 2 + tilt; play(dur, [m], (k) => { m.rotation.z = -Math.PI * 0.45 + spin * k * 1.2; m.material.opacity = 0.9 * (1 - k); m.scale.setScalar(0.8 + k * 0.4); }); }
function spikes(p, n, r, mat, dur = 1.0, h = 0.9) { const list = []; for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, d = Math.random() * r, c = new THREE.Mesh(new THREE.ConeGeometry(0.12 + Math.random() * 0.08, h * (0.6 + Math.random() * 0.6), 5), mat); c.position.set(p.x + Math.cos(a) * d, p.y, p.z + Math.sin(a) * d); c.rotation.set((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6); c.userData.h = c.geometry.parameters.height; list.push(c); }
  play(dur, list, (k) => { const up = Math.min(1, k * 6), down = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1; list.forEach(c => { c.scale.y = Math.max(0.01, up * down); c.position.y = p.y + c.userData.h * 0.5 * up * down; }); }); }
function chainsTo(from, toFn, col, dur = 0.6) { const links = []; for (let i = 0; i < 14; i++) { const l = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.02, 4, 10), glow(col, 0.95)); links.push(l); } play(dur, links, (k) => { const to = toFn(); links.forEach((l, i) => { const f = Math.min(1, k * 3) * i / 13; l.position.copy(from).lerp(to, f); l.lookAt(to); l.rotateY(i % 2 ? Math.PI / 2 : 0); l.material.opacity = 0.95 * (1 - Math.max(0, (k - 0.7) / 0.3)); }); }); }
function spiralAt(p, col, dur = 1.2, r = 0.7) { const g = new THREE.Group(); g.position.copy(p); for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.TorusGeometry(r * (0.4 + i * 0.3), 0.025, 4, 32, Math.PI * 1.5), glow(col, 0.85)); m.rotation.x = Math.PI / 2; g.add(m); } play(dur, [g], (k, t) => { g.children.forEach((m, i) => { m.rotation.z = t * (4 + i * 2) * (i % 2 ? -1 : 1); m.material.opacity = 0.85 * (1 - k); }); g.position.y = p.y + Math.sin(t * 3) * 0.05; }); }
function vinesAt(p, n = 6, r = 0.9, col = '#4a8a2a', dur = 1.4, h = 1.6) { const list = []; for (let v = 0; v < n; v++) { const a0 = v / n * Math.PI * 2, pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14, a = a0 + t * 4; pts.push(V3(Math.cos(a) * r * (1 - t * 0.5), t * h, Math.sin(a) * r * (1 - t * 0.5))); } const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.035, 5, false), m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: col, roughness: 0.8 })); m.position.copy(p); m.userData.full = g.index.count; g.setDrawRange(0, 0); list.push(m); }
  play(dur, list, (k) => { const grow = Math.min(1, k * 3), shrink = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1; list.forEach(m => m.geometry.setDrawRange(0, Math.floor(m.userData.full * grow * shrink / 3) * 3)); }); }
function roarRings(u, col, n = 3) { for (let i = 0; i < n; i++) G.timers.push((() => { let t = 0; return { update: (dt) => { t += dt; if (t > i * 0.12) { gRing(u.pos, 0.5, 9, col, 0.6, 0.7); const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 6, 40), glow(col, 0.6)); m.position.copy(chest(u.pos, 1.5)); m.rotation.y = u.yaw || 0; play(0.5, [m], (k) => { m.scale.setScalar(0.4 + k * 3); m.material.opacity = 0.6 * (1 - k); }); return true; } return false; } }; })()); }
Object.assign(FX, {
  // ---- Warrior ----
  ar_charge(u) { S.chargeRush && S.chargeRush(0.4); play(0.5, [], (k, t) => { V.emit('dust', u.pos.clone().setY(u.pos.y + 0.1), { speed: 2, size: 0.6, life: 0.5 }); if (Math.random() < 0.5) V.emit('spark', chest(u.pos, 0.9).addScaledVector(fwdOf(u), 0.6), { speed: 1, size: 0.15 }); }); gRing(u.pos, 0.3, 2.5, '#e8d8b0', 0.4); },
  execute(u, a, T) { slashArc(u, '#ff3a2a', -0.6, 1.8, 0.32); after(120 / 1000, () => { const p = chest(tpos(u, T, 1.6), 1.2); V.burst('blood', p, 30, { speed: 5 }); V.sphereFlash(p, 1.2, '#ff2a1a', 0.2); V.addShake(0.4); }); },
  ar_bash(u, a, T) { const p = chest(tpos(u, T, 1.4), 1.2); V.sphereFlash(p, 1.4, '#ffffff', 0.15); gRing(tpos(u, T, 1.4), 0.3, 3, '#e8e8ff', 0.35); V.burst('spark', p, 26, { speed: 6 }); const st = []; for (let i = 0; i < 4; i++) st.push(new THREE.Mesh(new THREE.OctahedronGeometry(0.08), glow('#ffe060', 0.95))); play(1.5, st, (k, t) => { const c = T && T.pos ? T.pos : p; st.forEach((m, i) => { const ang = t * 5 + i / 4 * Math.PI * 2; m.position.set(c.x + Math.cos(ang) * 0.35, c.y + 2.05, c.z + Math.sin(ang) * 0.35); m.material.opacity = 0.95 * (1 - k); }); }); }, // (stars circle the stunned head)
  // ---- Berserker ----
  berserker_xs2(u) { slashArc(u, '#ff4a2a', 0.5, 1.7, 0.25, 1); after(110 / 1000, () => slashArc(u, '#ff8a2a', -0.5, 1.7, 0.25, -1)); },
  earthsplitter(u, a, T) { const at = tpos(u, T, 6); after(380 / 1000, () => { gRing(at, 0.5, 5, '#c8a070', 0.5); spikes(at, 14, 3, new THREE.MeshStandardMaterial({ color: '#6a5a48', roughness: 0.95, flatShading: true }), 1.2); V.burst('dust', at.clone().setY(at.y + 0.3), 50, { speed: 6 }); V.burst('stone', at.clone().setY(at.y + 0.3), 20, { speed: 7 }); V.addShake(0.8); }); },
  intimshout(u) { roarRings(u, '#ff3a2a', 3); S.roar && S.roar(u.pos); const sk = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), glow('#ff2a1a', 0.5)); play(1.0, [sk], (k) => { sk.position.copy(chest(u.pos, 2.8 + k)); sk.scale.setScalar(1 + k); sk.material.opacity = 0.5 * (1 - k); }); },
  // ---- Shadow Knight ----
  lifetap(u, a, T) { if (!T || !T.pos) return; const from = chest(T.pos, 1.2), to = chest(u.pos, 1.2); after(260 / 1000, () => { beam(from, to, '#a01020', 0.5, 0.1); for (let i = 0; i < 12; i++) V.emit('blood', from.clone().lerp(to, i / 12), { speed: 0.4, size: 0.25, life: 0.5 }); V.burst('blood', to, 18, { speed: 2 }); }); },
  dkraise(u) { const at = u.pos.clone().addScaledVector(fwdOf(u), 2); runeCircle(at, 1.6, '#9a1020', 1.6); spikes(at, 8, 1.2, new THREE.MeshStandardMaterial({ color: '#e0d8c0', roughness: 0.6 }), 1.4, 0.7); V.burst('shadow', at.clone().setY(at.y + 0.5), 40, { speed: 2, vy: 2 }); },
  deathgrip(u, a, T) { if (!T || !T.pos) return; const from = handOf(u); chainsTo(from, () => chest(T.pos, 1.1), '#7a1a3a', 0.7); V.burst('shadow', chest(T.pos, 1.1), 24, { speed: 3 }); },
  // ---- Blunderbuss ----
  powdercharge(u) { const back = u.pos.clone().addScaledVector(fwdOf(u), -0.6).setY(u.pos.y + 0.8); V.burst('fire', back, 40, { speed: 6 }); V.burst('smoke', back, 20, { speed: 3 }); V.sphereFlash(back, 1.2, '#ffa040', 0.2); S.explode && S.explode(back, 0.4); },
  buckshot(u) { const f = fwdOf(u), m = handOf(u).addScaledVector(f, 0.6); const cone = new THREE.Mesh(new THREE.ConeGeometry(1.8, 6, 24, 1, true), glow('#ffb050', 0.5)); cone.position.copy(m).addScaledVector(f, 3); cone.quaternion.setFromUnitVectors(V3(0, -1, 0), f); play(0.2, [cone], (k) => { cone.material.opacity = 0.5 * (1 - k); }); V.burst('fire', m, 30, { speed: 9, dir: f }); V.burst('smoke', m, 16, { speed: 3 }); },
  buttstroke(u, a, T) { const p = chest(tpos(u, T, 1.4), 1.3); V.sphereFlash(p, 1, '#ffffff', 0.12); V.burst('spark', p, 18, { speed: 5 }); },
  // ---- Cleric ----
  radiantheal(u) { pillar(u.pos, '#fff0a0', 1.2, 10, 0.8, u); runeCircle(u.pos, 2.2, '#ffe080', 1.0); gRing(u.pos, 0.5, 10, '#fff0b0', 0.7); },
  prayer(u) { const n = 8; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; pillar(u.pos.clone().add(V3(Math.cos(a) * 5, 0, Math.sin(a) * 5)), '#fff4c0', 0.5, 9, 1.2); } pillar(u.pos, '#ffffff', 1.4, 14, 1.4, u); gRing(u.pos, 1, 16, '#ffe9a0', 1.0, 0.7); },
  holysmite(u, a, T) { const at = tpos(u, T, 10); after(250 / 1000, () => { pillar(at, '#fff2a0', 0.7, 12, 0.5); const cr = new THREE.Group(); for (const [w, h] of [[0.18, 1.6], [1.0, 0.18]]) cr.add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), glow('#ffffff', 0.9))); cr.position.copy(chest(at, 1.6)); play(0.6, [cr], (k) => { cr.lookAt(G.camera.position); cr.scale.setScalar(1 + k); cr.children.forEach(m => { m.material.opacity = 0.9 * (1 - k); }); }); }); },
  // ---- Bard ----
  crescendo(u) { const cols = ['#ff70c0', '#ffd860', '#70d0ff']; for (let i = 0; i < 4; i++) after(i * 90 / 1000, () => gRing(u.pos, 0.5, 8, cols[i % 3], 0.5, 0.85)); roarRings(u, '#ffb0f0', 2); },
  mesmerize2(u, a, T) { if (!T || !T.pos) return; after(250 / 1000, () => spiralAt(chest(T.pos, 2.1), '#ff90f0', 2.5, 0.6)); },
  // ---- Druid ----
  regrowth(u) { vinesAt(u.pos, 6, 0.8, '#5aa83a', 1.4); V.burst('leaf', chest(u.pos, 1), 30, { speed: 3, vy: 2 }); gRing(u.pos, 0.5, 8, '#9ae070', 0.7); },
  callbear(u) { runeCircle(u.pos.clone().addScaledVector(fwdOf(u), 2), 1.8, '#7ad04a', 1.4); S.growl && S.growl('bear', u.pos, 1); },
  entangle(u, a, T) { const at = tpos(u, T, 9); after(250 / 1000, () => { vinesAt(at, 8, 0.8, '#3a6a20', 2.5, 1.4); V.burst('leaf', chest(at, 0.4), 24, { speed: 3 }); }); },
  // ---- Shaman ----
  sh_wave(u) { const f = fwdOf(u); const w = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.12, 8, 40, Math.PI), glow('#7ad0ff', 0.8)); play(0.7, [w], (k) => { w.position.copy(u.pos).addScaledVector(f, k * 8).setY(u.pos.y + 0.4); w.rotation.y = (u.yaw || 0) + Math.PI / 2; w.scale.setScalar(1 + k * 2.5); w.material.opacity = 0.8 * (1 - k); }); gRing(u.pos, 0.5, 12, '#9ae0ff', 0.7); V.burst('water', chest(u.pos, 0.6), 40, { speed: 4 }); },
  sh_wolf(u) { runeCircle(u.pos.clone().addScaledVector(fwdOf(u), 2), 1.4, '#8ac8ff', 1.2); V.burst('frost', chest(u.pos.clone().addScaledVector(fwdOf(u), 2), 0.6), 40, { speed: 2 }); S.growl && S.growl('wolf', u.pos, 1); },
  sh_hex(u, a, T) { if (!T || !T.pos) return; after(250 / 1000, () => { spiralAt(chest(T.pos, 1.0), '#6aff5a', 1.5, 0.9); V.burst('green', chest(T.pos, 1), 40, { speed: 3 }); V.sphereFlash(chest(T.pos, 1), 1.4, '#6aff5a', 0.3); }); },
  // ---- Ranger ----
  focus(u) { auraFx(u, 8, (g) => { const e = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.02, 4, 24), glow('#9aff7a', 0.8)); e.position.y = 1.85; e.rotation.x = Math.PI / 2; g.add(e); return (k, t) => { e.rotation.z = t * 3; e.material.opacity = 0.8 * k; }; }); },
  spectral(u) { const f = fwdOf(u), from = handOf(u); after(60 / 1000, () => beam(from, from.clone().addScaledVector(f, 30), '#80ffd0', 0.4, 0.06)); },
  entangle2(u, a, T) { const at = tpos(u, T, 12); after(260 / 1000, () => { vinesAt(at, 7, 0.7, '#3a7a2a', 4.0, 1.3); gRing(at, 0.5, 5, '#7ae050', 0.6); }); },
  // ---- Musketeer ----
  quickreload(u) { const m = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.03, 4, 24), glow('#ffd060', 0.9)); play(0.6, [m], (k, t) => { m.position.copy(handOf(u)); m.rotation.set(t * 12, t * 7, 0); m.material.opacity = 0.9 * (1 - k); }); V.burst('spark', handOf(u), 14, { speed: 3 }); },
  grapeshot(u) { FX.buckshot(u); },
  bolas(u, a, T) { if (!T || !T.pos) return; const b = new THREE.Group(); for (let i = 0; i < 3; i++) { const s2 = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshStandardMaterial({ color: '#4a3a2a' })); b.add(s2); } const from = handOf(u); play(0.4, [b], (k, t) => { b.position.copy(from).lerp(chest(T.pos, 0.6), k); b.children.forEach((s2, i) => { const ang = t * 25 + i / 3 * Math.PI * 2; s2.position.set(Math.cos(ang) * 0.4, 0, Math.sin(ang) * 0.4); }); }); after(400 / 1000, () => { if (!T.pos) return; const r = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.03, 4, 20), new THREE.MeshStandardMaterial({ color: '#6a5030' })); play(4, [r], (k) => { r.position.copy(T.pos).setY(T.pos.y + 0.45); r.rotation.x = Math.PI / 2; }); }); },
  // ---- Wizard ----
  blink(u) { if (u === G.player) return; /* (the player's Blink draws its own smoke: player.js) */ V.portal(u.pos, u.yaw || 0); after(150 / 1000, () => V.portal(u.pos, u.yaw || 0)); S.tele && S.tele(u.pos); }, /* (the owner: a shrinking portal where he was and where he lands) */
  disintegrate(u) { const f = fwdOf(u), from0 = handOf(u); after(80 / 1000, () => { const from = fpSelf(u) ? from0.clone().addScaledVector(f, 2.2) : from0; beam(from, from.clone().addScaledVector(f, 35), '#c060ff', 0.5, fpSelf(u) ? 0.12 : 0.22, 0.55); /* (first person: it starts ahead of your hand and is thinner, so it never paints a white sheet over what you aim at) */ V.addShake(0.3); }); },
  temporalbolt(u, a, T) { const at = chest(tpos(u, T, 10), 1.3); after(220 / 1000, () => { const c = new THREE.Group(); const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.62, 40), glow('#ffd860', 0.9)); c.add(ring); for (const [w, h, rz] of [[0.04, 0.45, 0], [0.03, 0.32, 1.2]]) { const hand = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glow('#fff0b0', 0.9)); hand.geometry.translate(0, h / 2, 0); hand.rotation.z = rz; c.add(hand); } c.position.copy(at); play(1.6, [c], (k, t) => { c.lookAt(G.camera.position); c.children[1].rotation.z = -t * 8; c.children[2].rotation.z = -t * 0.8; c.children.forEach(m => { m.material.opacity = 0.9 * (1 - k); }); }); }); }, // (a clock face that winds down over the slowed enemy)
  // ---- Rogue ----
  envenom(u) { auraFx(u, 6, (g) => { return (k) => { if (Math.random() < 0.5 * k) V.emit('poison', handOf(u), { speed: 0.3, vy: -1, size: 0.15, life: 0.5 }); }; }); },
  eviscerate(u, a, T) { slashArc(u, '#c01030', 0.8, 1.3, 0.2, 1); after(90 / 1000, () => slashArc(u, '#ff2050', -0.8, 1.3, 0.2, -1)); after(120 / 1000, () => V.burst('blood', chest(tpos(u, T, 1.3), 1.2), 30, { speed: 5 })); },
  kidney(u, a, T) { FX.ar_bash(u, a, T); },
  // ---- Elementalist ----
  lightninglash(u, a, T) { const to = chest(tpos(u, T, 12), 1.2); boltFx(handOf(u), to, '#b0d8ff'); after(70 / 1000, () => boltFx(handOf(u), to, '#ffffff')); },
  callflame(u) { const at = u.pos.clone().addScaledVector(fwdOf(u), 2); pillar(at, '#ff7020', 1.1, 6, 0.8); for (let i = 0; i < 4; i++) after(i * 0.12, () => V.burst('fire', at.clone().setY(at.y + 0.3 + i * 0.8), 26, { speed: 1.2, vy: 4.5, size: 0.9, life: 0.7, radius: 0.5 })); /* (a rising column of real flame, not a flat panel) */ runeCircle(at, 1.3, '#ff9030', 1.0); V.burst('fire', chest(at, 0.5), 60, { speed: 4, vy: 3 }); },
  frostbind(u, a, T) { if (!T || !T.pos) return; after(250 / 1000, () => { if (!T.pos) return; spikes(T.pos, 12, 0.9, new THREE.MeshStandardMaterial({ color: '#c8f0ff', emissive: '#4aa0e0', emissiveIntensity: 0.6, transparent: true, opacity: 0.85, roughness: 0.1 }), 3.0, 1.8); V.burst('frost', chest(T.pos, 1), 50, { speed: 4 }); }); },
  // ---- Enchanter ----
  mindrot(u, a, T) { if (!T || !T.pos) return; after(250 / 1000, () => { spiralAt(chest(T.pos, 1.9), '#c060ff', 3, 0.5); V.burst('arcane', chest(T.pos, 1.5), 30, { speed: 3 }); }); },
  phantasm(u) { V.sphereFlash(chest(u.pos, 1), 2, '#f0b0ff', 0.3); runeCircle(u.pos, 1.6, '#f0a0ff', 1.0); },
  mesmerize(u, a, T) { FX.mesmerize2(u, a, T); },
  // ---- Beastmaster ----
  packfrenzy(u) { roarRings(u, '#ff8a2a', 2); for (let i = 0; i < 3; i++) after(i * 80 / 1000, () => slashArc(u, '#ff6a2a', -0.4 + i * 0.4, 1.4, 0.2, i % 2 ? -1 : 1)); },
  warbeast(u) { runeCircle(u.pos.clone().addScaledVector(fwdOf(u), 2.5), 2, '#ff9a3a', 1.4); V.burst('dust', chest(u.pos.clone().addScaledVector(fwdOf(u), 2.5), 0.3), 40, { speed: 4 }); S.growl && S.growl('tiger', u.pos, 1); },
  feralroar(u) { roarRings(u, '#e8c070', 3); S.roar && S.roar(u.pos); },
  // ---- Priest ----
  pr_halo(u) { gRing(u.pos, 0.5, 14, '#ffe9a0', 0.8, 0.9); pillar(u.pos, '#fff6d0', 1.0, 9, 0.7, u); const h = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.04, 6, 40), glow('#fff0b0', 0.9)); play(1.0, [h], (k) => { h.position.copy(chest(u.pos, 2.1)); h.rotation.x = Math.PI / 2; h.scale.setScalar(1 + k * 12); h.material.opacity = 0.9 * (1 - k); }); },
  pr_word(u) { runeCircle(u.pos, 2, '#ffe9a0', 1.0); V.sphereFlash(chest(u.pos, 1.1), 2.0, '#fff0c0', 0.3); },
  pr_chains(u, a, T) { if (!T || !T.pos) return; after(250 / 1000, () => { if (!T.pos) return; for (let i = 0; i < 4; i++) { const ang = i / 4 * Math.PI * 2, base = T.pos.clone().add(V3(Math.cos(ang) * 1.4, 0, Math.sin(ang) * 1.4)); chainsTo(base, () => chest(T.pos, 1.0), '#ffd860', 2.2); } runeCircle(T.pos, 1.5, '#ffd860', 2.2); }); },
  // ---- Bombardier ----
  bo_rocket(u) { play(0.6, [], () => { V.emit('fire', u.pos.clone().setY(u.pos.y + 0.2).addScaledVector(fwdOf(u), -0.3), { speed: 2, size: 0.5, life: 0.4 }); V.emit('smoke', u.pos.clone().setY(u.pos.y + 0.3), { speed: 1, size: 0.8, life: 1.0 }); }); V.burst('fire', u.pos.clone().setY(u.pos.y + 0.2), 30, { speed: 5 }); S.explode && S.explode(u.pos, 0.35); },
  bo_cluster(u) { V.burst('spark', handOf(u), 12, { speed: 3 }); },
  bo_sticky(u, a, T) { if (!T || !T.pos) return; after(300 / 1000, () => { if (!T.pos) return; const goo = new THREE.Mesh(new THREE.CircleGeometry(1.4, 24), new THREE.MeshStandardMaterial({ color: '#8a6a1a', roughness: 0.2, transparent: true, opacity: 0.85 })); goo.rotation.x = -Math.PI / 2; const c = T.pos.clone(); play(1.8, [goo], (k) => { goo.position.set(c.x, c.y + 0.05, c.z); goo.scale.setScalar(Math.min(1, k * 8)); goo.material.opacity = 0.85 * (1 - Math.max(0, (k - 0.8) / 0.2)); }); V.burst('fire', chest(c, 0.6), 30, { speed: 4 }); }); },
});
export function abilityFx(u, a, T) { if (a && G.hooks.abilityRule) { try { G.hooks.abilityRule(u, a, T); } catch (e) { console.warn('abilityRule', a.id, e); } } /* (arena.js: the parts of a few abilities that are rules, not looks) */ const f = a && FX[a.id]; if (!f) return; try { f(u, a, T); } catch (e) { console.warn('abilityFx', a.id, e); } }

// ---------- body poses that the generic animation can't do (kicks) ----------
// u.kickT counts down; while it runs the legs and body take a flying-kick shape (players and computer fighters)
export function bodyPoseTick(u, ch, dt) { if (ch) ch._u = u; if (ch) ch._strike = !!(u.strike || u.kickT > 0 || u.supermanT > 0 || u.wrapT > 0);
  if (ch && u.wrapT > 0 && ch.arms) { u.wrapT -= dt; const k = Math.sin(Math.min(1, (0.5 - u.wrapT) / 0.5) * Math.PI); ch.arms.R.sh.rotation.set(-1.2 * k, 0, -0.5 * k); ch.arms.L.sh.rotation.set(-1.2 * k, 0, 0.5 * k); ch.arms.R.el.rotation.x = -1.6 * k; ch.arms.L.el.rotation.x = -1.6 * k; } // (crossing the arms to cinch the wraps)
  if (ch && u.supermanT > 0 && ch.legs && ch.arms) { u.supermanT -= dt; const k = 1 - Math.max(0, u.supermanT) / 0.45, e = Math.sin(Math.min(1, k * 1.4) * Math.PI * 0.5) * (k > 0.75 ? 1 - (k - 0.75) / 0.25 * 0.8 : 1); // (Pressure Point: a superman punch)
    if (ch.body) { ch.body.rotation.x = 0.75 * e; ch.body.position.y = Math.sin(Math.min(1, k * 1.2) * Math.PI) * 0.55; } ch.arms.R.sh.rotation.set(-1.65 * e - 0.3 * (1 - e), 0, 0.05); ch.arms.R.el.rotation.x = -0.05 - (1 - e) * 1.6; ch.arms.L.sh.rotation.set(0.6 * e, 0, -0.4); ch.arms.L.el.rotation.x = -1.2;
    ch.legs.L.thigh.rotation.x = 0.9 * e; ch.legs.L.knee.rotation.x = 1.4 * e; ch.legs.R.thigh.rotation.x = -0.3 * e; ch.legs.R.knee.rotation.x = 0.3; return; }
  if (ch && u.strike && ch.legs && ch.arms) { strikePose(u, ch); }
  if (ch && u.spinT > 0) { u.spinT -= dt; u.spinA = (u.spinA || 0) + dt * (u.spinW || 15); ch.root.rotation.y += u.spinA; const A2 = ch.arms; // (Bladestorm: the whole body whirls, arms out, axes level)
    if (A2) { A2.R.sh.rotation.set(-0.15, 0, 1.45); A2.L.sh.rotation.set(-0.15, 0, -1.45); A2.R.el.rotation.x = -0.1; A2.L.el.rotation.x = -0.1; }
    if (ch.legs) { ch.legs.R.thigh.rotation.x = -0.35; ch.legs.L.thigh.rotation.x = 0.25; ch.legs.R.knee.rotation.x = 0.6; ch.legs.L.knee.rotation.x = 0.5; } if (ch.body) ch.body.rotation.x = 0.12; return; }
  if (!ch || !ch.legs || !(u.kickT > 0)) return; u.kickT -= dt; const dur = u.kickDur || 0.55, k = 1 - Math.max(0, u.kickT) / dur;
  // a real flying kick: up into the air, the lead leg shot out straight and level, the back leg tucked under, leaning back
  const ext = Math.sin(Math.min(1, k * 1.5) * Math.PI * 0.5) * (k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1), air = Math.sin(Math.min(1, k) * Math.PI);
  const s = u.kickSide || 'R', o = s === 'R' ? 'L' : 'R', sg = s === 'R' ? 1 : -1, Lg = ch.legs, A2 = ch.arms;
  if (ch.body) { ch.body.position.y = air * 0.95; ch.body.rotation.x = -0.4 * ext; ch.body.rotation.y = sg * 0.35 * ext; }
  Lg[s].thigh.rotation.set(-1.75 * ext, 0, 0); Lg[s].knee.rotation.x = 0.05 + (1 - ext) * 1.6; if (Lg[s].ankle) Lg[s].ankle.rotation.x = -0.3 * ext;
  Lg[o].thigh.rotation.set(-1.0 * ext, 0, 0); Lg[o].knee.rotation.x = 2.2 * ext;
  if (A2) { A2[s].sh.rotation.set(0.9 * ext, 0, sg * 0.7 * ext); A2[s].el.rotation.x = -0.4 * ext; A2[o].sh.rotation.set(-1.3 * ext, 0, -sg * 0.3 * ext); A2[o].el.rotation.x = -1.7 * ext; }
}
FX.flyingkick = (u) => { u.kickT = u.kickDur = 0.55; u.kickSide = Math.random() < 0.5 ? 'R' : 'L'; S.dodge && S.dodge();
  let t = 0; G.timers.push({ update: (dt) => { t += dt; const p = u.pos.clone().setY(u.pos.y + 0.9); V.emit('frost', p, { speed: 0.4, size: 0.35, life: 0.35 }); if (Math.random() < 0.6) V.emit('gold', p, { speed: 0.6, size: 0.2, life: 0.3 }); return t > 0.5; } }); };

// ---------- healing beams for the healers' right click (and anything else that pours from one to another) ----------
// kind: 'holy' (golden beam), 'nature' (leaves along a vine), 'water' (a rippling stream), 'song' (notes flowing)
export function healBeam(from, to, kind = 'holy') {
  const col = { holy: '#ffe08a', nature: '#7ae060', water: '#7ad0ff', song: '#ffb0f0' }[kind] || '#ffffff';
  const dir = to.clone().sub(from), L = dir.length(), mid = from.clone().lerp(to, 0.5);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(kind === 'holy' ? 0.14 : 0.07, kind === 'holy' ? 0.14 : 0.07, L, 10, 1, true), glow(col, 0.85)); beam.position.copy(mid); beam.quaternion.setFromUnitVectors(V3(0, 1, 0), dir.clone().normalize());
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, L, 6, 1, true), glow('#ffffff', 0.9)); core.position.copy(mid); core.quaternion.copy(beam.quaternion);
  const pk = kind === 'nature' ? 'leaf' : kind === 'water' ? 'water' : kind === 'song' ? 'arcane' : 'gold';
  play(0.45, kind === 'nature' || kind === 'song' ? [] : [beam, core], (k, t) => { beam.material.opacity = 0.85 * (1 - k); core.material.opacity = 0.9 * (1 - k); beam.scale.x = beam.scale.z = 1 + Math.sin(t * 40) * 0.2;
    const n = kind === 'nature' || kind === 'song' ? 6 : 3; for (let i = 0; i < n; i++) { const f = Math.random(), p = from.clone().lerp(to, f); if (kind !== 'holy') p.y += Math.sin(f * Math.PI) * (kind === 'water' ? 0.6 : 0.9) + Math.sin(t * 20 + f * 9) * 0.15; V.emit(pk, p, { speed: 0.4, size: kind === 'song' ? 0.35 : 0.28, life: 0.5 }); } });
  V.burst(pk, to, 24, { speed: 2.5, vy: 1.5 }); V.sphereFlash(to, 0.9, col, 0.25); V.light(to, col, 4, 0.3, 10);
}

// a jagged lightning bolt from one point to another (flashes and fades)
export function boltFx(from, to, col = '#cfe4ff') {
  const pts = [from.clone()]; for (let i = 1; i < 9; i++) { const p = from.clone().lerp(to, i / 9); p.x += (Math.random() - 0.5) * 0.8; p.z += (Math.random() - 0.5) * 0.8; p.y += (Math.random() - 0.5) * 0.4; pts.push(p); } pts.push(to.clone());
  const g = new THREE.Group(); for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], len = a.distanceTo(b), m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, len, 5), glow(col, 0.95)); m.position.copy(a).lerp(b, 0.5); m.quaternion.setFromUnitVectors(V3(0, 1, 0), b.clone().sub(a).normalize()); g.add(m); }
  play(0.18, [g], (k) => { g.children.forEach(m => { m.material.opacity = 0.95 * (1 - k); }); }); V.sphereFlash(to, 1.0, col, 0.2); V.light(to, col, 6, 0.2, 14); V.burst('lightning', to, 14, { speed: 4 });
}
// a carved totem pole: stacked faces with glowing rune eyes, spread wings on top. size ~1 = 1.8 m tall
export function makeTotem(size = 1, glowCol = '#7ad0ff') {
  const g = new THREE.Group(), wood = new THREE.MeshStandardMaterial({ color: '#6a4426', roughness: 0.85 }), dark = new THREE.MeshStandardMaterial({ color: '#3a2414', roughness: 0.9 }), paint = new THREE.MeshStandardMaterial({ color: '#b83a2a', roughness: 0.8 }), eyeM = new THREE.MeshBasicMaterial({ color: glowCol }), run = new THREE.MeshBasicMaterial({ color: glowCol, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  const faces = 3; for (let i = 0; i < faces; i++) { const y = 0.3 + i * 0.5; add(new THREE.CylinderGeometry(0.22, 0.24, 0.5, 10), i % 2 ? dark : wood, 0, y, 0); for (const x of [-0.08, 0.08]) add(new THREE.SphereGeometry(0.045, 6, 5), eyeM, x, y + 0.08, 0.2); add(new THREE.BoxGeometry(0.2, 0.05, 0.06), paint, 0, y - 0.1, 0.21); add(new THREE.ConeGeometry(0.05, 0.12, 4), dark, 0, y, 0.25).rotation.x = Math.PI / 2; }
  for (const sx of [-1, 1]) { const w = add(new THREE.BoxGeometry(0.55, 0.12, 0.06), paint, sx * 0.4, 1.7, 0); w.rotation.z = sx * 0.3; add(new THREE.BoxGeometry(0.3, 0.08, 0.05), wood, sx * 0.62, 1.82, 0).rotation.z = sx * 0.55; }
  add(new THREE.ConeGeometry(0.2, 0.35, 8), wood, 0, 1.95, 0); const band = add(new THREE.TorusGeometry(0.25, 0.025, 6, 20), run, 0, 0.05, 0); band.rotation.x = Math.PI / 2;
  g.scale.setScalar(size); g.userData.band = band; g.userData.glowMat = run; return g;
}

// ---------- defensive and buff abilities: a visible effect on the body for as long as it lasts ----------
// build(group) returns tick(k, t, unitPos) ; the group follows the unit; ends after dur, or early when a shield breaks
function auraFx(u, dur, build, barrier) { const g = new THREE.Group(); const tick = build(g); G.scene.add(g); let t = 0;
  G.timers.push({ update: (dt) => { t += dt; const k = Math.min(1, t / 0.25) * Math.min(1, (dur - t) / 0.35); g.position.copy(u.pos);
    const fp = u === G.player && u.camDist < 0.6; g.visible = !fp || !!build.fpOk;
    tick(Math.max(0, k), t, g); const broke = barrier && t > 0.4 && u.buffs && !(u.buffs.barrier > 0);
    if (t >= dur || broke || u.dead) { if (broke) V.burst('spark', u.pos.clone().setY(u.pos.y + 1), 30, { speed: 5 }); G.scene.remove(g); return true; } return false; } }); }
const orbit = (g, n, mk, r, y) => { const a = []; for (let i = 0; i < n; i++) { const m = mk(i); g.add(m); a.push({ m, a: i / n * Math.PI * 2, y: y + (i % 3) * 0.4 }); } return (t, sp = 2) => a.forEach((o, i) => { const ang = o.a + t * sp; o.m.position.set(Math.cos(ang) * r, o.y + Math.sin(t * 2 + i) * 0.1, Math.sin(ang) * r); o.m.rotation.set(t * 2 + i, t * 3, 0); }); };
const bone = () => new THREE.MeshStandardMaterial({ color: '#e8e0c8', roughness: 0.6 });
Object.assign(FX, {
  bonearmor(u, a) { auraFx(u, a.dur || 12, (g) => { const bm = bone(); const spin = orbit(g, 9, (i) => { const m = new THREE.Mesh(i % 2 ? new THREE.ConeGeometry(0.06, 0.32, 5) : new THREE.CapsuleGeometry(0.04, 0.22, 3, 6), bm); return m; }, 0.75, 0.5);
      const aur = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), glow('#d8ffd0', 0)); aur.position.y = 1; g.add(aur); S.hit && S.hit('bone', u.pos, 1); V.burst('bone', u.pos.clone().setY(u.pos.y + 1), 30, { speed: 3 });
      return (k, t) => { spin(t, 2.4); g.children.forEach(c => { if (c !== aur) c.scale.setScalar(k); }); aur.material.opacity = 0.08 * k; }; }, true); },
  shieldwall(u, a) { auraFx(u, a.dur || 8, (g) => { const wall = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.0), glow('#c8d8ff', 0)); wall.position.set(0, 1.0, 0.75); g.add(wall); const rim = new THREE.Mesh(new THREE.RingGeometry(0.85, 0.95, 4, 1), glow('#ffffff', 0)); rim.rotation.z = Math.PI / 4; rim.scale.set(1, 1.25, 1); rim.position.copy(wall.position); g.add(rim); S.block && S.block(true, u.pos);
      return (k, t) => { g.rotation.y = u === G.player ? u.yaw : (u.yaw || 0); wall.material.opacity = 0.22 * k * (1 + Math.sin(t * 6) * 0.15); rim.material.opacity = 0.6 * k; }; }); },
  undying(u, a) { auraFx(u, a.dur || 6, (g) => { const fl = []; for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.ConeGeometry(0.55 - i * 0.12, 1.9 + i * 0.3, 10, 1, true), glow(i ? '#ff5020' : '#c01010', 0)); m.position.y = 1.0; g.add(m); fl.push(m); } S.cast && S.cast('fire', u.pos, 0.9);
      return (k, t) => { fl.forEach((m, i) => { m.material.opacity = (0.22 - i * 0.05) * k; m.scale.set(1 + Math.sin(t * 9 + i) * 0.08, 1 + Math.sin(t * 7 + i) * 0.1, 1); m.rotation.y = t * (2 + i); }); if (Math.random() < 0.6 * k) V.emit('fire', u.pos.clone().setY(u.pos.y + 0.3 + Math.random() * 1.6), { speed: 0.5, vy: 2, size: 0.3, life: 0.5 }); }; }); },
  phaseshift(u, a) { auraFx(u, a.dur || 4, (g) => { const ch = u.ch || u.model; const mats = []; if (ch && ch.root) ch.root.traverse(o => { if (o.isMesh && o.material && !o.userData.outline) mats.push(o.material); }); /* (the owner: no rings, he just fades almost invisible) */
      if (u !== G.player) V.puff(u.pos, 1); S.cast && S.cast('arcane', u.pos, 0.7); let gone = false;
      return (k, t) => { if (gone) return; const on = !('stealth' in u) || u.stealth > 0 || t < 0.1; if (!on || t > (a.dur || 4) - 0.1) { gone = true; for (const m of mats) { m.opacity = 1; m.transparent = false; } if (!on) V.puff(u.pos, 0.6); return; } if (u === G.player) return; /* (the player's own fade is set in player.js) */ for (const m of mats) { m.transparent = true; m.opacity = 1 - 0.88 * k; } }; }); },
  gravewall(u, a) { auraFx(u, Math.min(a.dur || 12, 12), (g) => { const st = []; const stone = new THREE.MeshStandardMaterial({ color: '#6a6a72', roughness: 0.9 }); for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.8, 0.12), stone); const an = i / 6 * Math.PI * 2; m.position.set(Math.cos(an) * 1.1, -0.8, Math.sin(an) * 1.1); m.rotation.y = -an + Math.PI / 2; g.add(m); st.push(m); }
      const aur = new THREE.Mesh(new THREE.SphereGeometry(0.95, 14, 10), glow('#7a4aa0', 0)); aur.position.y = 1; g.add(aur); V.burst('stone', u.pos.clone().setY(u.pos.y + 0.3), 30, { speed: 3 });
      return (k, t) => { st.forEach((m, i) => { m.position.y = -0.8 + Math.min(1, t * 3) * 1.2 - (1 - k) * 1.2; }); aur.material.opacity = 0.1 * k; g.rotation.y = t * 0.3; }; }, true); },
  innerpeace(u, a) { auraFx(u, a.dur || 8, (g) => { const lotus = new THREE.Group(); for (let i = 0; i < 8; i++) { const p = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.6, 4), glow('#ffd8a0', 0.7)); const an = i / 8 * Math.PI * 2; p.position.set(Math.cos(an) * 0.45, 0.08, Math.sin(an) * 0.45); p.rotation.set(Math.PI / 2 - 0.6, 0, -an + Math.PI / 2); p.rotation.order = 'YXZ'; p.rotation.y = -an; lotus.add(p); } g.add(lotus); const aur = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 10), glow('#ffe8b0', 0)); aur.position.y = 1; g.add(aur);
      return (k, t) => { lotus.rotation.y = t * 0.5; lotus.scale.setScalar(k); lotus.children.forEach(c => { c.material.opacity = 0.6 * k; }); aur.material.opacity = 0.1 * k * (1 + Math.sin(t * 2) * 0.3); if (Math.random() < 0.3 * k) V.emit('gold', u.pos.clone().setY(u.pos.y + 0.3 + Math.random() * 1.6), { speed: 0.2, vy: 1, size: 0.2, life: 0.8 }); }; }, true); },
  iceshell(u, a) { auraFx(u, a.dur || 12, (g) => { const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 1), new THREE.MeshStandardMaterial({ color: '#bfe8ff', roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0, flatShading: true })); shell.position.y = 1; g.add(shell); const sh = []; for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5, 5), new THREE.MeshStandardMaterial({ color: '#dff4ff', roughness: 0.1, transparent: true, opacity: 0.8 })); const an = i / 6 * Math.PI * 2; c.position.set(Math.cos(an) * 0.9, 0.1, Math.sin(an) * 0.9); g.add(c); sh.push(c); }
      V.burst('frost', u.pos.clone().setY(u.pos.y + 1), 40, { speed: 3 }); S.cast && S.cast('frost', u.pos, 0.9);
      return (k, t) => { shell.material.opacity = 0.28 * k; shell.rotation.y = t * 0.3; sh.forEach(c => c.scale.setScalar(k)); }; }, true); },
  runeshield(u, a) { auraFx(u, a.dur || 12, (g) => { const rs = []; for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.03, 6, 6), glow(i === 1 ? '#ff90f0' : '#d0a0ff', 0)); r.position.y = 0.4 + i * 0.6; g.add(r); rs.push(r); } S.cast && S.cast('arcane', u.pos, 0.8);
      return (k, t) => { rs.forEach((r, i) => { r.material.opacity = 0.8 * k; r.rotation.set(Math.PI / 2 + Math.sin(t + i) * 0.3, t * (1.5 - i * 0.5), 0); }); if (Math.random() < 0.3 * k) V.emit('arcane', u.pos.clone().setY(u.pos.y + Math.random() * 2), { speed: 0.4, size: 0.18, life: 0.5 }); }; }, true); },
  naturesembrace(u, a) { auraFx(u, a.dur || 15, (g) => { const vm = new THREE.MeshStandardMaterial({ color: '#4a8a2e', roughness: 0.8 }); const vines = []; for (let i = 0; i < 3; i++) { const v = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.035, 5, 24, Math.PI * 1.5), vm); v.position.y = 0.4 + i * 0.55; v.rotation.x = Math.PI / 2; g.add(v); vines.push(v); } V.burst('leaf', u.pos.clone().setY(u.pos.y + 1), 30, { speed: 3 });
      return (k, t) => { vines.forEach((v, i) => { v.rotation.z = t * (1 + i * 0.4) * (i % 2 ? -1 : 1); v.scale.setScalar(k); }); if (Math.random() < 0.5 * k) { const an = Math.random() * 6.28; V.emit('leaf', u.pos.clone().add(new THREE.Vector3(Math.cos(an) * 0.7, Math.random() * 2, Math.sin(an) * 0.7)), { speed: 0.5, size: 0.25, life: 0.7 }); } }; }); },
  ar_shadowstep(u, a) { FX.phaseshift(u, a); }, /* (the owner: Shadow Step is the same fade as Phase Shift; the black puff comes from the caster) */
});

// ---------- the monk's fighting moves (Thousand Fists): one pose per strike, driven by u.strike = { n, t0, dur } ----------
const ss = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
function strikePose(u, ch) { const S2 = u.strike, k = Math.max(0, Math.min(1, (G.time - S2.t0) / (S2.dur || 0.2))), hit = Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5) * (k > 0.8 ? 1 - (k - 0.8) / 0.2 * 0.6 : 1);
  const A = ch.arms, L = ch.legs, body = ch.body, chest = ch.chest || (ch.spine), n = S2.n, side = n.endsWith('L') ? 'L' : 'R', o = side === 'R' ? 'L' : 'R', sg = side === 'R' ? 1 : -1;
  const guard = () => { A.R.sh.rotation.set(-0.9, 0, 0.25); A.L.sh.rotation.set(-0.9, 0, -0.25); A.R.el.rotation.x = -1.9; A.L.el.rotation.x = -1.9; }; // (hands up)
  if (n === 'stance') { guard(); L.R.thigh.rotation.set(-0.5, 0, -0.25); L.L.thigh.rotation.set(-0.5, 0, 0.25); L.R.knee.rotation.x = 0.9; L.L.knee.rotation.x = 0.9; if (body) body.position.y = -0.12; A.R.sh.rotation.set(-0.5, 0, 0.9); A.L.sh.rotation.set(-0.5, 0, -0.9); A.R.el.rotation.x = -1.6; A.L.el.rotation.x = -1.6; return; }
  guard(); if (body) { body.position.set(0, 0, 0); body.rotation.set(0, 0, 0); }
  if (n.startsWith('punch')) { A[side].sh.rotation.set(-1.55 * hit - 0.35 * (1 - hit), 0, sg * 0.1); A[side].el.rotation.x = -1.9 * (1 - hit) - 0.05; if (chest) chest.rotation.y = -sg * 0.55 * hit; L[o].thigh.rotation.x = -0.35; L[o].knee.rotation.x = 0.5; }
  else if (n.startsWith('elbow')) { A[side].sh.rotation.set(-1.25, 0, sg * (0.4 + 0.7 * hit)); A[side].el.rotation.x = -2.3; if (chest) chest.rotation.y = -sg * 1.0 * hit; if (body) body.rotation.y = -sg * 0.5 * hit; }
  else if (n.startsWith('kick')) { L[side].thigh.rotation.set(-1.7 * hit, 0, 0); L[side].knee.rotation.x = 0.15 + (1 - hit) * 1.4; L[o].knee.rotation.x = 0.4; if (body) body.rotation.x = -0.25 * hit; }
  else if (n.startsWith('round')) { if (body) { body.rotation.y = sg * Math.PI * 2 * ss(k); body.rotation.z = -sg * 0.35 * hit; body.position.y = Math.sin(k * Math.PI) * 0.25; } L[side].thigh.rotation.set(-1.15 * hit, 0, -sg * 1.25 * hit); L[side].knee.rotation.x = 0.1; L[o].knee.rotation.x = 0.5; A.R.sh.rotation.set(-0.4, 0, 1.2); A.L.sh.rotation.set(-0.4, 0, -1.2); }
  else if (n.startsWith('knee')) { if (body) { body.position.y = Math.sin(k * Math.PI) * 0.7; body.rotation.x = -0.2 * hit; } L[side].thigh.rotation.set(-2.1 * hit, 0, 0); L[side].knee.rotation.x = 2.3 * hit; L[o].thigh.rotation.x = 0.4 * hit; L[o].knee.rotation.x = 0.9; A.R.sh.rotation.set(-1.6, 0, 0.2); A.L.sh.rotation.set(-1.6, 0, -0.2); A.R.el.rotation.x = -1.2; A.L.el.rotation.x = -1.2; } // (a flying knee, both hands pulling the head down)
  else if (n === 'flip') { if (body) { body.rotation.x = -Math.PI * 2 * ss(k); body.position.y = 0.9 * Math.sin(k * Math.PI) + 0.6 * Math.sin(ss(k) * Math.PI); } L.R.thigh.rotation.x = -2.2 * hit; L.R.knee.rotation.x = 0.1; L.L.thigh.rotation.x = -0.6; L.L.knee.rotation.x = 1.6 * hit; A.R.sh.rotation.set(0.6, 0, 0.9); A.L.sh.rotation.set(0.6, 0, -0.9); } // (a backflip kick)
  else if (n === 'axe') { const up = k < 0.45 ? ss(k / 0.45) : 1 - ss((k - 0.45) / 0.55); L.R.thigh.rotation.set(-2.6 * up - 0.3 * (1 - up), 0, 0); L.R.knee.rotation.x = 0.05; if (body) body.rotation.x = 0.15 * up; } // (an axe kick, the heel coming down from overhead)
  else if (n === 'leapspin') { if (body) { body.rotation.y = Math.PI * 4 * ss(k); body.position.y = Math.sin(k * Math.PI) * 1.4; } L.R.thigh.rotation.set(-1.3, 0, -1.3); L.R.knee.rotation.x = 0.1; L.L.thigh.rotation.x = -0.9; L.L.knee.rotation.x = 1.8; A.R.sh.rotation.set(-0.3, 0, 1.4); A.L.sh.rotation.set(-0.3, 0, -1.4); } // (the finish: a leaping double-spin kick)
}

// Pressure Point (monk): a superman punch: he launches forward through the air, body stretched out, rear leg kicked up,
// and drives the fist into the target; a shock of light where it lands
FX.pressure = (u, a, T) => { u.supermanT = 0.55; const f = V3(Math.sin(u.yaw || 0), 0, Math.cos(u.yaw || 0)); if (u !== G.player && T && T.pos) { const d = V3(T.pos.x - u.pos.x, 0, T.pos.z - u.pos.z); if (d.lengthSq() > 0.01) f.copy(d.normalize()); }
  // the Superman punch: a skip off one foot, a flying lunge with the fist out, a sonic-boom cone off the knuckles like a jet breaking the sound barrier
  const fp = u === G.player && u.camDist < 0.6; if (u === G.player) { if (u.vel) u.vel.y = Math.max(u.vel.y || 0, 4.2); u.fovKick = Math.min(20, (u.fovKick || 0) + 14); }
  S.swingW && S.swingW('fist', 1.8, u.pos); S.dodge && S.dodge(); S.whistle && S.whistle(u.pos, 0.35); V.burst('dust', u.pos.clone().setY(u.pos.y + 0.1), 18, { speed: 3 });
  const add2 = (m) => { m.material.transparent = true; m.material.depthWrite = false; m.material.blending = THREE.AdditiveBlending; m.material.side = THREE.DoubleSide; G.scene.add(m); return m; };
  const cone = add2(new THREE.Mesh(new THREE.ConeGeometry(1, 2.4, 32, 1, true), new THREE.MeshBasicMaterial({ color: '#e8f4ff', opacity: 0 }))); // (the vapour cone)
  const rings = [0, 1, 2].map(() => add2(new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 6, 32), new THREE.MeshBasicMaterial({ color: '#ffffff', opacity: 0 }))));
  const fist = fp ? null : add2(new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), new THREE.MeshBasicMaterial({ color: '#ffd870', opacity: 0.55 })));
  const q = new THREE.Quaternion().setFromUnitVectors(V3(0, -1, 0), f); let t = 0, boom = false;
  G.timers.push({ update: (dt) => { t += dt; const hp = u.pos.clone().addScaledVector(f, fp ? 3.2 : 0.9).setY(u.pos.y + (fp ? 1.25 : 1.35)), fly = t < 0.62, k = Math.min(1, t / 0.12);
    if (fist) { fist.position.copy(hp); fist.scale.setScalar(1 + Math.sin(t * 40) * 0.15); fist.material.opacity = fly ? 0.55 : Math.max(0, 0.55 - (t - 0.62) * 3); }
    cone.position.copy(hp).addScaledVector(f, -1.0); cone.quaternion.copy(q); const cs = (0.25 + 0.55 * k) * (fp ? 0.6 : 1); cone.scale.set(cs, 1, cs); cone.material.opacity = (fly ? 0.22 * k : Math.max(0, 0.22 - (t - 0.62) * 1.2)) * (fp ? 0.45 : 1);
    rings.forEach((r, i) => { const ph = ((t * 5 + i / 3) % 1); r.position.copy(hp).addScaledVector(f, -ph * 2.2); r.quaternion.setFromUnitVectors(V3(0, 0, 1), f); r.scale.setScalar((0.15 + ph * 0.9) * (fp ? 0.55 : 1)); r.material.opacity = fly ? (1 - ph) * 0.5 * (fp ? 0.45 : 1) : 0; });
    if (!boom && t > 0.1) { boom = true; if (!fp) { V.sphereFlash(hp, 1.2, '#ffffff', 0.12); V.ring(hp, 2.5, '#e8f4ff', 0.25); } S.gunshot && S.gunshot(u.pos, 1.3); V.addShake(0.3); } // (the crack of the sound barrier)
    V.emit('frost', u.pos.clone().setY(u.pos.y + 1.1), { speed: 0.3, size: 0.5, life: 0.3 }); if (fly) V.emit('gold', hp, { speed: 0.4, size: 0.3, life: 0.2 });
    if (t > 1.0) { for (const m of [cone, ...rings, fist]) if (m) { G.scene.remove(m); m.geometry.dispose(); m.material.dispose(); } return true; } return false; } }); };

// Tighten the Wraps (monk): he cinches his wraps, and ribbons of cloth spiral up his arms and body while it lasts
// a strip of bandage wound round and round a limb (a helix along +Y from y0 to y1), drawn on as it winds
function bandage(r, y0, y1, turns, w = 0.012) { const pts = []; const N = Math.ceil(turns * 18); for (let i = 0; i <= N; i++) { const k = i / N, a = k * turns * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, y0 + (y1 - y0) * k + Math.sin(a * 0.5) * w * 0.3, Math.sin(a) * r)); }
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), N * 2, w, 3, false); g.scale(1, 1, 0.9); const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#ece2c8', roughness: 0.95 })); m.castShadow = false; m.userData.full = g.index.count; g.setDrawRange(0, 0); return m; }
FX.ar_wraps = (u, a) => { u.wrapT = 0.5; const ch = u === G.player ? u.ch : u.model, strips = [];
  if (ch && ch.arms) { const R = ch.R || { armL: 0.58, legL: 0.9, thick: 1 }, fa = R.armL * 0.46, T = R.thick || 1;
    for (const sd of ['L', 'R']) { const b1 = bandage(0.05 * T, -fa, -fa * 0.35, 6, 0.011); ch.arms[sd].el.add(b1); strips.push(b1); const b2 = bandage(0.042 * T, -0.09, 0.0, 3, 0.011); ch.arms[sd].hand.add(b2); strips.push(b2); // (forearm to knuckles)
      const sl = R.legL * 0.47; const b3 = bandage(0.055 * T, -sl, -sl * 0.55, 5, 0.012); ch.legs[sd].knee.add(b3); strips.push(b3); const b4 = bandage(0.05 * T, -0.07, 0.01, 3, 0.012); b4.rotation.x = -0.2; ch.legs[sd].ankle.add(b4); strips.push(b4); } } // (shin to the arch of the foot)
  if (u === G.player && u.vm) for (const H of [u.vm.R, u.vm.L]) { const hand = H.children[0], wr = hand && hand.userData.wrist; if (!wr) continue; const b5 = bandage(0.045, -0.12, 0.05, 6, 0.007); wr.add(b5); strips.push(b5); const b6 = bandage(0.04, -0.02, 0.05, 3, 0.007); b6.position.set(-wr.position.x, 0, -wr.position.z); wr.add(b6); strips.push(b6); } // (first person: you watch your own wrists and hands get wrapped)
  V.burst('gold', u.pos.clone().setY(u.pos.y + 1.1), 30, { speed: 3 }); S.swap && S.swap(); let t = 0;
  G.timers.push({ update: (dt) => { t += dt; const wind = Math.min(1, t / 0.6), un = t > 4.6 ? Math.max(0, 1 - (t - 4.6) / 0.4) : 1; for (const m of strips) m.geometry.setDrawRange(0, Math.floor(m.userData.full * wind * un / 3) * 3);
    if (t < 0.6 && Math.random() < 0.6) { const s2 = strips[(Math.random() * strips.length) | 0]; if (s2) { const p = new THREE.Vector3(); s2.getWorldPosition(p); V.emit('cotton', p, { speed: 0.6, size: 0.12, life: 0.4 }); } }
    if (t > 5 || u.dead) { for (const m of strips) { m.parent && m.parent.remove(m); m.geometry.dispose(); m.material.dispose(); } return true; } return false; } }); };
// (kits5.js) Healing Wave: water geysers burst up under the shaman and every ally it heals; Hundred Fists: phantom chi fists and a
// palm of light; Holy Smite's falling sword of light is drawn by the rule itself, so its old pillar look is retired
FX.sh_wave = (u, a) => { if (G.hooks.k5) G.hooks.k5.healGeysers(u, (a && a.r) || 12); };
FX.hundredfists = (u) => { if (G.hooks.k5) G.hooks.k5.chiFlurry(u, 0.6); };
delete FX.holysmite;
