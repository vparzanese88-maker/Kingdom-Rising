// ultsb.js: the ultimates (R) of the five reworked Kingdom Arena classes (see kitsb.js for their kits). Each one is a single run(caster,
// aimPoint) used both for your own hero (player.js -> tableUlt) and for computer fighters (arena.js resolve / ULTS table), so bots use
// them too. The owner: no domes, bubbles or plain circles as the look; no long cinematic camera; the player keeps control.
//   Elementalist, Elemental Storm: a churning storm cloud tears open over where you aim; lightning forks onto everyone under it and ice
//     spears rain down, then a burning meteor punches through the middle of the cloud and craters the ground.
//   Enchanter, Mass Charm: a giant spectral clock appears over the spot, its pendulum swinging; everyone under it is spellbound, tied to
//     it by threads of light while the hands race to midnight; at the twelfth chime the clock shatters and its glass rains onto them.
//   Beastmaster, Bear Form: he leaps and lands as a huge bear-man (fur mantle, great red claws, burning eyes), the landing tears claw
//     gouges out across the ground and knocks everyone near down; for 10 s he hits harder and shrugs off damage.
//   Priest, Salvation: colossal wings of dawn unfurl and he rises on them; a ray of light falls on every ally nearby (a big heal, then more,
//     and they cannot die for 3 s) while spears of light fall on every enemy.
//   Bombardier, Big Bertha (bomber.js runs the bomb): the dressing here: a bigger keg, a spinning siren, a floating countdown, red-hot
//     shaking at the end, and a mushroom-cloud blast.
import * as THREE from 'three';
import { G } from './state.js';
import { V } from './vfx.js';
import { S } from './audio.js';
import { ultFoes, ultFriends, ultGround, ultHurt, ultHeal, ultSlow, ultImpact } from './arena.js';
import { boltFx } from './abilityfx.js';
import { makeWings } from './arenalooks.js';

// arena.js links its private helpers here at start (buffUnit, feed)
export const UBX = { buff: null, feed: null };
export const UB_TUNE = {
  storm: { r: 7, dur: 3.3, bolt: 0.04, bolts: 4, ice: 0.04, met: 0.28, metEdge: 0.14, metR: 6.5 },
  charm: { r: 8, dur: 3, hurt: 0.22 },
  bear: { dur: 10, heal: 0.2, slamR: 6, slam: 0.1, kd: 0.9, grow: 0.5 },
  salv: { r: 16, dur: 5, heal0: 0.25, hot: 0.35, undying: 3, spear: 0.07, spears: 3 },
};
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const isP = (c) => c === G.player;
const hgt = (u) => isP(u) ? (u.eye || 1.6) + 0.15 : (u.height || 1.8);
const addM = (col, op = 1) => new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
const timer = (fn) => { let t = 0; G.timers.push({ update: (dt) => { t += dt; return fn(t, dt); } }); };
const later = (sec, fn) => timer((t) => { if (t >= sec) { fn(); return true; } return false; });
const ease = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const kill = (o) => { if (!o) return; if (o.parent) o.parent.remove(o); o.traverse && o.traverse(m => { if (m.geometry) m.geometry.dispose(); if (m.material && !m.material.userData.keep) m.material.dispose(); }); };
const near = (list, p, r) => list.filter(u => u && !u.dead && u.pos && Math.hypot(u.pos.x - p.x, u.pos.z - p.z) < r);
const stun = (u, s) => { if (!u || u.dead) return; if (isP(u)) u.debuff && u.debuff('stun', s); else if (u.status) u.status.stun = Math.max(u.status.stun || 0, s); };
const knockDown = (u, s) => { stun(u, s); if (!isP(u) && u.model) u.model.kdLeft = Math.max(u.model.kdLeft || 0, s + 1.2); };
const hitstop = (s) => { G.hitstop = Math.max(G.hitstop || 0, s); };
const camDist = (p) => G.camera ? G.camera.position.distanceTo(p) : 20;
const feed = (c, txt) => { if (UBX.feed) UBX.feed(`<b>${c && c.heroName ? String(c.heroName).replace(/[<>&]/g, '') : 'You'}</b> ${txt}`); };
const rootOf = (c) => isP(c) ? c.ch && c.ch.root : c.model && c.model.root;
function bonesOf(c) { const r = rootOf(c), out = {}; if (!r) return out; r.traverse(o => { if (!o.isBone) return; const n = o.name.replace(/^.*[:_]|^mixamorig/i, '');
  for (const k of ['Head', 'Neck', 'Spine2', 'RightHand', 'LeftHand', 'RightForeArm', 'LeftForeArm']) if (n === k && !out[k]) out[k] = o; }); return out; }
const wpos = (o, v = V3()) => o.getWorldPosition(v);
// a jagged glowing crack drawn on the ground from a to b (the fissure language of the paladin's ultimate)
function crack(a, dir, len, cols, parts, wid = 1) { const side = V3(dir.z, 0, -dir.x); let prev = a.clone(), jag = 0; const N = Math.max(2, Math.round(len / 0.5));
  for (let i = 1; i <= N; i++) { jag = Math.max(-0.45, Math.min(0.45, jag + (Math.random() - 0.5) * 0.5)); const p = a.clone().addScaledVector(dir, i * len / N).addScaledVector(side, jag * Math.min(1, i / 2)); p.y = ultGround(p);
    cols.forEach(([col, w, op, y], j) => { const dx = p.x - prev.x, dz = p.z - prev.z, L = Math.hypot(dx, dz) + 0.1, wk = w * wid * (1 - 0.6 * i / N);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(wk, L), col === 'scorch' ? new THREE.MeshBasicMaterial({ color: '#160a04', transparent: true, opacity: op, depthWrite: false }) : addM(col, op));
      m.rotation.order = 'YXZ'; m.rotation.set(-Math.PI / 2, Math.atan2(dx, dz), 0); m.position.set((p.x + prev.x) / 2, Math.max(p.y, prev.y) + y, (p.z + prev.z) / 2); m.renderOrder = 3; m.userData.op = op; m.userData.add = col !== 'scorch'; m.userData.d = i / N; G.scene.add(m); parts.push(m); });
    prev = p; } return prev; }

// ======================= Elementalist: Elemental Storm =======================
const CLOUD_G = new THREE.SphereGeometry(1, 14, 10);
export function elementalStorm(c, at) {
  const T = Object.assign({}, UB_TUNE.storm, G.stormTune || {}), base = ultGround(at), C = V3(at.x, base, at.z), H = 9.5, me = isP(c) ? c : null;
  if (me) { me.ultPoseT = 1.2; me.ultImmT = Math.max(me.ultImmT || 0, 1); }
  const hand = c.pos.clone().setY(c.pos.y + hgt(c) * 0.9);
  // three streams (fire, frost, lightning) spiral up out of his hands into the sky over the target
  const cols = [['fire', '#ff7020'], ['frost', '#7ad0ff'], ['lightning', '#f0f6ff']];
  S.castRise && S.castRise(0.7, 'fire'); S.cast && S.cast('fire', c.pos, 1.3); S.zap && S.zap(c.pos, 1);
  cols.forEach(([kind, col], i) => { const orb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), addM(col, 0.95)); G.scene.add(orb); const top = C.clone().setY(base + H);
    timer((t) => { const k = Math.min(1, t / 0.65), e = k * k; const p = hand.clone().lerp(top, e); const a = i * 2.09 + t * 11, rr = 1.6 * Math.sin(k * Math.PI); p.x += Math.cos(a) * rr; p.z += Math.sin(a) * rr; p.y += Math.sin(k * Math.PI) * 3;
      orb.position.copy(p); V.emit(kind, p, { speed: 0.6, size: 0.6, life: 0.5 }); V.emit(kind, p, { speed: 0.3, size: 0.35, life: 0.8 }); if (k >= 1) { kill(orb); V.burst(kind, top, 40, { speed: 6 }); return true; } return false; }); });
  // the cloud: a churning dark mass of billows over the target, lit from inside by lightning
  const cloud = new THREE.Group(); cloud.position.set(C.x, base + H, C.z); G.scene.add(cloud);
  const dark = new THREE.MeshBasicMaterial({ color: '#1a1826', transparent: true, opacity: 0, depthWrite: false }), dark2 = new THREE.MeshBasicMaterial({ color: '#2c2a3e', transparent: true, opacity: 0, depthWrite: false }), inner = addM('#9ab8ff', 0);
  const puffs = []; for (let i = 0; i < 22; i++) { const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * T.r * 1.15, m = new THREE.Mesh(CLOUD_G, i % 3 ? dark : dark2); const s = 2.2 + Math.random() * 2.4; m.scale.set(s, s * 0.42, s); m.position.set(Math.cos(a) * d, (Math.random() - 0.5) * 1.4, Math.sin(a) * d); m.userData.a = a; m.userData.d = d; m.userData.y = m.position.y; m.userData.s = s; cloud.add(m); puffs.push(m); }
  const glowIn = new THREE.Mesh(CLOUD_G, inner); glowIn.scale.set(T.r * 1.1, 1.2, T.r * 1.1); glowIn.position.y = -1.2; cloud.add(glowIn);
  const eye = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.5, 8, 28), addM('#ff8a30', 0)); eye.rotation.x = Math.PI / 2; eye.position.y = -1.4; cloud.add(eye);
  S.rumble && S.rumble(C, 3.2); later(0.4, () => S.thunder ? S.thunder(C) : S.explode && S.explode(C.clone().setY(base + H), 0.5));
  // strikes: lightning forks onto the enemies under the cloud, ice spears rain everywhere under it
  const foesIn = () => near(ultFoes(c), C, T.r); const boltN = new Map(); let nb = 0;
  const strike = (q, foe) => { const top = V3(q.x + (Math.random() - 0.5) * 3, base + H - 1.5, q.z + (Math.random() - 0.5) * 3), gq = q.clone().setY((foe ? foe.pos.y : base) + 0.1);
    boltFx(top, gq, '#e8f4ff'); boltFx(top, gq, '#8ab8ff'); V.burst('spark', gq.clone().setY(gq.y + 0.3), 30, { speed: 8 }); V.light(gq.clone().setY(gq.y + 2), '#cfe8ff', 12, 0.18, 18); inner.opacity = 0.35;
    S.zap && S.zap(gq, 1.2); if (nb++ % 2 === 0) S.thunder ? S.thunder(gq) : S.explode && S.explode(gq, 0.35, 'lightning');
    if (foe && !foe.dead) { ultHurt(foe, T.bolt, c, 'lightning'); stun(foe, 0.3); } };
  const SPEAR_G = new THREE.ConeGeometry(0.22, 2.4, 6), SPEAR_M = new THREE.MeshStandardMaterial({ color: '#cfefff', emissive: '#4aa8ff', emissiveIntensity: 0.9, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.92 });
  const iceSpear = (q) => { const sp = new THREE.Mesh(SPEAR_G, SPEAR_M.clone()); sp.rotation.x = Math.PI; const from = V3(q.x + 2, base + H - 1, q.z + 1.2), to = q.clone().setY(base + 0.9); sp.position.copy(from); sp.quaternion.setFromUnitVectors(V3(0, -1, 0), to.clone().sub(from).normalize()); G.scene.add(sp);
    timer((t) => { const k = Math.min(1, t / 0.32); sp.position.lerpVectors(from, to, k * k); if (Math.random() < 0.6) V.emit('frost', sp.position, { speed: 0.3, size: 0.3, life: 0.4 });
      if (k < 1) return false; if (!sp.userData.hit) { sp.userData.hit = true; sp.userData.t = t; V.burst('frost', to, 34, { speed: 6 }); V.burst('water', to, 10, { speed: 4 }); S.cast && S.cast('frost', to, 0.5); for (const u of near(ultFoes(c), to, 2.2)) { ultHurt(u, T.ice, c, 'frost', true); ultSlow(u, 0.45, 2); } }
      const f = Math.max(0, 1 - (t - sp.userData.t) / 1.3); sp.material.opacity = 0.92 * f; if (f <= 0) { kill(sp); return true; } return false; }); };
  let tStrike = 0.95, iceT = 0.8, ended = false;
  timer((t, dt) => { const k = ease(t / 0.7) * (1 - ease((t - T.dur - 0.4) / 1.0));
    dark.opacity = 0.82 * k; dark2.opacity = 0.75 * k; inner.opacity = Math.max(0.05 * k, inner.opacity - dt * 2.5); eye.material.opacity = 0.55 * k * ease((t - 1.6) / 1.4) * (ended ? 0 : 1); eye.rotation.z = t * 3; eye.scale.setScalar(1 + ease((t - 1.6) / 1.6) * 0.6);
    puffs.forEach((m, i) => { const a = m.userData.a + t * (0.35 + 0.15 * (i % 3)), d = m.userData.d * (0.6 + 0.4 * ease(t / 0.8)); m.position.set(Math.cos(a) * d, m.userData.y + Math.sin(t * 1.3 + i) * 0.25, Math.sin(a) * d); });
    if (Math.random() < 0.5 * k) V.emit('smoke', C.clone().add(V3((Math.random() - 0.5) * T.r * 2, H - 1 + Math.random(), (Math.random() - 0.5) * T.r * 2)), { speed: 0.5, size: 3, life: 1.2, grav: 0 });
    if (Math.random() < dt * 4 * k) { const a = Math.random() * 6.28, r = Math.random() * T.r, p = C.clone().add(V3(Math.cos(a) * r, H - 0.5, Math.sin(a) * r)); boltFx(p, p.clone().add(V3((Math.random() - 0.5) * 6, -0.6, (Math.random() - 0.5) * 6)), '#bcd4ff'); inner.opacity = 0.25; } // (sheet lightning inside the cloud)
    if (!ended && t < T.dur - 0.4) {
      tStrike -= dt; if (tStrike <= 0) { tStrike = 0.2 + Math.random() * 0.08; const fs = foesIn().filter(u => (boltN.get(u) || 0) < T.bolts);
        if (fs.length) { const u = fs[Math.floor(Math.random() * fs.length)]; boltN.set(u, (boltN.get(u) || 0) + 1); strike(u.pos, u); } else { const a = Math.random() * 6.28, r = Math.random() * T.r; strike(C.clone().add(V3(Math.cos(a) * r, 0, Math.sin(a) * r)), null); } }
      iceT -= dt; if (iceT <= 0) { iceT = 0.14; const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * T.r; iceSpear(C.clone().add(V3(Math.cos(a) * r, 0, Math.sin(a) * r))); } }
    if (!ended && t >= T.dur - 0.45) { ended = true; meteor(); }
    if (t > T.dur + 1.5) { kill(cloud); dark.dispose(); dark2.dispose(); inner.dispose(); return true; } return false; });
  // the finale: a burning meteor punches down through the eye of the storm
  function meteor() { const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.5, 1), new THREE.MeshStandardMaterial({ color: '#3a1808', emissive: '#ff4a08', emissiveIntensity: 1.4, roughness: 0.7, flatShading: true })), halo = new THREE.Mesh(new THREE.SphereGeometry(2.3, 14, 10), addM('#ff8a30', 0.45)); rock.add(halo); G.scene.add(rock);
    const from = C.clone().setY(base + H + 2), to = C.clone().setY(base + 0.8); S.castRelease && S.castRelease('fire'); S.whistle && S.whistle(C, 0.45); V.light(from, '#ff8030', 14, 0.5, 30);
    timer((t) => { const k = Math.min(1, t / 0.42); rock.position.lerpVectors(from, to, k * k); rock.rotation.x += 0.3; rock.rotation.z += 0.2; for (let i = 0; i < 3; i++) V.emit('fire', rock.position.clone().add(V3(0, 1 + i * 0.8, 0)), { speed: 1.5, size: 1.8, life: 0.55, radius: 1.4 }); V.emit('smoke', rock.position.clone().setY(rock.position.y + 2.5), { speed: 0.6, size: 2.2, life: 1.4 });
      if (k < 1) return false; kill(rock); impact(); return true; }); }
  function impact() { hitstop(0.1); V.addShake(Math.max(0.4, 1.4 - camDist(C) / 40));
    ultImpact(C, { r: T.metR, col: '#ff6a20', colCol: '#ffc060', dust: '#a08060', debris: 'stone', spark: 'ember', flash: '#fff0c0', shake: 0, vol: 0, colH: 16, wallH: 2.4 });
    V.burst('fire', C.clone().setY(base + 0.8), 200, { speed: 14, size: 1.3, life: 0.9 }); V.burst('lava', C.clone().setY(base + 0.5), 70, { speed: 11, grav: 14, life: 1.4 }); V.burst('frost', C.clone().setY(base + 0.6), 60, { speed: 10 }); V.burst('lightning', C.clone().setY(base + 1), 40, { speed: 12 });
    V.burst('smoke', C.clone().setY(base + 1.5), 60, { speed: 5, size: 3, life: 2.6, vy: 2, radius: 3 }); V.light(C.clone().setY(base + 3), '#ff7a30', 22, 0.9, 40);
    S.explode && S.explode(C, 2.2, 'fire'); S.rumble && S.rumble(C, 1.6); S.thunder && S.thunder(C);
    // the crater: a molten core and cracks of fire, frost and lightning splitting out from it
    const parts = []; const core = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4, 0), new THREE.MeshStandardMaterial({ color: '#2a1206', emissive: '#ff3a00', emissiveIntensity: 1.2, flatShading: true, roughness: 0.9 })); core.position.set(C.x, base + 0.15, C.z); core.scale.set(1, 0.35, 1); G.scene.add(core);
    const pal = [['#ff7020', '#ffe0a0'], ['#4ab0ff', '#e8f8ff'], ['#c8d8ff', '#ffffff']]; for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + Math.random() * 0.3, d = V3(Math.cos(a), 0, Math.sin(a)), [c1, c2] = pal[i % 3];
      crack(C.clone().addScaledVector(d, 1.2), d, 3.5 + Math.random() * 2.5, [['scorch', 1.6, 0.8, 0.03], [c1, 0.8, 0.7, 0.05], [c2, 0.26, 1, 0.07]], parts); }
    for (const u of near(ultFoes(c), C, T.metR + 0.5)) { const d = Math.hypot(u.pos.x - C.x, u.pos.z - C.z), f = d < 3 ? T.met : T.met - (T.met - T.metEdge) * Math.min(1, (d - 3) / (T.metR - 3)); ultHurt(u, f, c, 'fire'); if (u.status) u.status.burn = Math.max(u.status.burn || 0, 3);
      const n = V3(u.pos.x - C.x, 0, u.pos.z - C.z); if (n.lengthSq() < 1e-4) n.set(1, 0, 0); n.normalize(); if (isP(u)) { if (u.vel) u.vel.set(n.x * 8, 8, n.z * 8); u.onGround = false; } else { knockDown(u, 0.8); u.pos.addScaledVector(n, 1.6); if (u.root) u.root.position.copy(u.pos); } }
    feed(c, 'calls down the Elemental Storm!');
    timer((t) => { const f = Math.max(0, 1 - Math.max(0, t - 2.5) / 2); for (const m of parts) m.material.opacity = m.userData.op * f * (m.userData.add ? 0.8 + Math.sin(t * 9 + m.userData.d * 7) * 0.2 : 1); core.material.emissiveIntensity = 1.2 * f + 0.1;
      if (Math.random() < 0.4 * f) V.emit('ember', C.clone().add(V3((Math.random() - 0.5) * 6, 0.2, (Math.random() - 0.5) * 6)), { speed: 0.5, vy: 2, size: 0.3 });
      if (t > 4.5) { parts.forEach(kill); kill(core); return true; } return false; }); }
  return true;
}

// ======================= Enchanter: Mass Charm (the Midnight Clock) =======================
function makeClock(R) { const g = new THREE.Group(), nm = (col, op) => new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide }), gold = nm('#f2b632', 0.95), pink = nm('#d63cc8', 0.9), glass = addM('#a040ff', 0.22); /* (solid colours, not additive: they stay gold and magenta against a bright sky) */
  const face = new THREE.Mesh(new THREE.CircleGeometry(R, 48), glass); g.add(face);
  for (const [r, w, m] of [[R, 0.16, gold], [R * 0.86, 0.05, pink], [R * 1.12, 0.06, pink]]) { const t = new THREE.Mesh(new THREE.TorusGeometry(r, w, 6, 64), m); g.add(t); }
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, big = i % 3 === 0, tk = new THREE.Mesh(new THREE.BoxGeometry(big ? 0.22 : 0.1, big ? 0.7 : 0.4, 0.04), big ? gold : pink); tk.position.set(Math.sin(a) * R * 0.72, Math.cos(a) * R * 0.72, 0.02); tk.rotation.z = -a; g.add(tk);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(big ? 0.2 : 0.12), gold); gem.position.set(Math.sin(a) * R * 1.12, Math.cos(a) * R * 1.12, 0); g.add(gem); }
  const hand = (len, w, m) => { const p = new THREE.Group(), b = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.05), m); b.position.y = len * 0.42; p.add(b); const tip = new THREE.Mesh(new THREE.OctahedronGeometry(w * 1.4), m); tip.position.y = len * 0.86; tip.scale.y = 1.8; p.add(tip); p.position.z = 0.06; g.add(p); return p; };
  g.userData.min = hand(R * 0.82, 0.12, gold); g.userData.hr = hand(R * 0.52, 0.2, pink);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 9), gold); hub.position.z = 0.1; g.add(hub);
  const pend = new THREE.Group(); pend.position.y = -R * 0.95; const rod = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.2, 0.05), gold); rod.position.y = -1.6; pend.add(rod); const bob = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.12, 6, 24), gold); bob.position.y = -3.4; pend.add(bob);
  const bobIn = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20), addM('#ff4af0', 0.6)); bobIn.position.y = -3.4; pend.add(bobIn); g.add(pend); g.userData.pend = pend; g.userData.mats = [gold, pink, glass, bobIn.material]; return g; }
export function massCharm(c, at) {
  const T = Object.assign({}, UB_TUNE.charm, G.charmTune || {}), base = ultGround(at), C = V3(at.x, base, at.z), R = 3.2, me = isP(c) ? c : null;
  if (me) { me.ultPoseT = 1.2; me.ultImmT = Math.max(me.ultImmT || 0, 1.2); }
  const clock = makeClock(R); clock.position.set(C.x, base + 6.4, C.z); clock.rotation.y = Math.atan2(c.pos.x - C.x, c.pos.z - C.z); clock.scale.setScalar(0.01); G.scene.add(clock); const mats = clock.userData.mats, op0 = mats.map(m => m.opacity);
  S.castRise && S.castRise(0.6, 'arcane'); S.cast && S.cast('arcane', C, 1.5); S.smiteFall && S.smiteFall(C);
  V.burst('arcane', clock.position, 80, { speed: 7 }); V.light(clock.position, '#ff80f0', 12, 0.8, 30);
  const caught = near(ultFoes(c), C, T.r); const threads = [], glyphs = [];
  const THR_G = new THREE.CylinderGeometry(0.03, 0.03, 1, 5, 1, true);
  caught.forEach((u) => { if (isP(u)) u.debuff && u.debuff('freeze', T.dur); else if (u.status) { u.status.stun = Math.max(u.status.stun || 0, T.dur); u.status.mez = true; u.cast = null; }
    const th = new THREE.Mesh(THR_G, new THREE.MeshBasicMaterial({ color: '#e040d8', transparent: true, opacity: 0.8, depthWrite: false })); G.scene.add(th); threads.push(th);
    const gl = new THREE.Group(); for (let i = 0; i < 2; i++) { const s = new THREE.Mesh(new THREE.TorusGeometry(0.32 - i * 0.12, 0.035, 6, 24, Math.PI * 1.6), addM(i ? '#ffd27a' : '#ff8af6', 0.9)); gl.add(s); } G.scene.add(gl); glyphs.push(gl);
    V.burst('arcane', u.pos.clone().setY(u.pos.y + 1.6), 30, { speed: 3 }); });
  if (caught.length) feed(c, `spellbinds ${caught.length} under the Midnight Clock!`);
  let tick = 0, chimes = 0, shattered = false;
  timer((t, dt) => { const k = ease(t / 0.5), g = clock; if (!shattered) { g.scale.setScalar(Math.max(0.01, k * (1 + Math.sin(t * 2) * 0.02))); g.position.y = base + 6.4 + Math.sin(t * 1.4) * 0.2; }
    const run = Math.min(1, t / T.dur), sp = run * run; g.userData.min.rotation.z = -(sp * 5) * Math.PI * 2; g.userData.hr.rotation.z = -Math.PI * 2 * (0.75 + 0.25 * ease(run)); // (the minute hand races; the hour hand creeps to twelve)
    g.userData.pend.rotation.z = Math.sin(t * 3.4) * 0.55; // (the pendulum: the pocket watch of his Mesmerize, giant)
    const bobW = g.userData.pend.children[1].getWorldPosition(V3()); if (Math.random() < 0.7) V.emit('arcane', bobW, { speed: 0.4, size: 0.35, life: 0.7 });
    tick -= dt; if (!shattered && tick <= 0) { tick = Math.max(0.12, 0.42 * (1 - run)); S.chainSnap ? S.chainSnap(C.clone().setY(base + 7)) : S.click && S.click(); }
    const hub = g.position.clone().setY(g.position.y - 0.2);
    caught.forEach((u, i) => { const h = u.pos.clone().setY(u.pos.y + hgt(u) + 0.35), th = threads[i], gl = glyphs[i]; if (shattered || u.dead) { th.visible = false; gl.visible = false; return; }
      const mid = h.clone().lerp(hub, 0.5), L = h.distanceTo(hub); th.position.copy(mid); th.scale.set(1, L * k, 1); th.quaternion.setFromUnitVectors(V3(0, 1, 0), hub.clone().sub(h).normalize()); th.material.opacity = 0.45 + 0.35 * Math.sin(t * 8 + i);
      gl.position.copy(h); gl.lookAt(G.camera.position); gl.children.forEach((s, j) => { s.rotation.z = t * (j ? -5 : 4); }); if (Math.random() < 0.2) V.emit('arcane', h, { speed: 0.5, size: 0.2 }); });
    if (!shattered && t >= T.dur - 0.55 && chimes < 3) { const want = Math.floor((t - (T.dur - 0.55)) / 0.18) + 1; while (chimes < Math.min(3, want)) { chimes++; S.smiteHit && S.smiteHit(C.clone().setY(base + 7)); V.light(g.position, '#ffd0ff', 10, 0.15, 26); g.scale.setScalar(1.06); } }
    if (!shattered && t >= T.dur) { shattered = true; shatter(); }
    if (shattered) { const f = Math.max(0, 1 - (t - T.dur) / 0.35); mats.forEach((m, i) => { m.opacity = op0[i] * f; }); g.scale.setScalar(1 + (t - T.dur) * 1.5); }
    if (t > T.dur + 2.2) { kill(clock); threads.forEach(kill); glyphs.forEach(kill); return true; } return false; });
  // midnight: the clock bursts, and its glass rains down onto everyone it held
  function shatter() { const O = clock.position.clone(); hitstop(0.08); V.addShake(Math.max(0.3, 1 - camDist(O) / 40)); S.explode && S.explode(O, 1.2, 'arcane'); S.castRelease && S.castRelease('arcane');
    V.burst('arcane', O, 160, { speed: 12 }); V.burst('gold', O, 60, { speed: 9 }); V.sphereFlash(O, 3.2, '#ffd0ff', 0.3); V.light(O, '#ff9af8', 20, 0.5, 34);
    const SH_G = new THREE.TetrahedronGeometry(0.28); const targets = caught.filter(u => !u.dead); const shards = [];
    for (let i = 0; i < 46; i++) { const m = new THREE.Mesh(SH_G, i % 3 ? new THREE.MeshStandardMaterial({ color: '#f070e8', emissive: '#a020a0', emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.1, transparent: true, opacity: 0.9 }) : addM('#d0a0ff', 0.95)); m.scale.set(1, 2.2, 0.4); m.position.copy(O); G.scene.add(m);
      const u = targets.length && i < targets.length * 9 ? targets[i % targets.length] : null, out = V3(Math.random() - 0.5, Math.random() * 0.8 + 0.2, Math.random() - 0.5).normalize().multiplyScalar(5 + Math.random() * 6);
      shards.push({ m, u, v: out, end: u ? null : C.clone().add(V3((Math.random() - 0.5) * 2 * T.r, 0, (Math.random() - 0.5) * 2 * T.r)), spin: V3(Math.random() * 20, Math.random() * 20, 0), d: 0.15 + Math.random() * 0.25 }); }
    timer((t, dt) => { let live = 0; for (const s of shards) { if (s.done) continue; live++; const p = s.m.position;
        if (t < s.d) { p.addScaledVector(s.v, dt); s.v.multiplyScalar(1 - dt * 3); } // (a burst outward, then they turn and dive)
        else { const goal = s.u ? s.u.pos.clone().setY(s.u.pos.y + hgt(s.u) * 0.6) : s.end, dir = goal.clone().sub(p), L = dir.length(), stp = (22 + t * 20) * dt; if (L <= stp + 0.1) { s.done = true; kill(s.m); V.burst('arcane', goal, 8, { speed: 3 }); continue; } p.addScaledVector(dir.normalize(), stp); }
        s.m.rotation.x += s.spin.x * dt; s.m.rotation.y += s.spin.y * dt; if (Math.random() < 0.3) V.emit('arcane', p, { speed: 0.2, size: 0.2, life: 0.3 }); }
      return live === 0 || t > 3; });
    later(0.42, () => { for (const u of targets) { if (u.dead) continue; const h = u.pos.clone().setY(u.pos.y + hgt(u) * 0.7); ultHurt(u, T.hurt, c, 'arcane'); V.burst('arcane', h, 50, { speed: 7 }); V.burst('frost', h, 20, { speed: 5 }); V.sphereFlash(h, 1.4, '#f0b0ff', 0.2); if (u.status) u.status.mez = false; }
      if (targets.length) { S.chainSnap && S.chainSnap(C); S.hit && S.hit('stone', C, 1); hitstop(0.06); } }); }
  return true;
}

// ======================= Beastmaster: Bear Form =======================
const FUR_G = new THREE.ConeGeometry(0.09, 0.5, 5), CLAW_G = new THREE.ConeGeometry(0.035, 0.42, 5);
export function bearForm(c) {
  const T = Object.assign({}, UB_TUNE.bear, G.bearTune || {}), ch = isP(c) ? c.ch : c.model, me = isP(c) ? c : null; if (!ch || !ch.root) return false;
  const root = ch.root, s0 = root.scale.x; c.bearT = G.time + T.dur; c.bearOn = true; ultHeal(c, T.heal);
  if (me) { me.ultImmT = Math.max(me.ultImmT || 0, 1.1); later(0, () => { me.tpT = Math.max(me.tpT || 0, 3.2); }); }
  const B = bonesOf(c), fur = new THREE.MeshStandardMaterial({ color: '#4a2e18', roughness: 1 }), furTip = new THREE.MeshStandardMaterial({ color: '#8a6a48', roughness: 1 }), clawM = new THREE.MeshStandardMaterial({ color: '#f0e4d0', emissive: '#ff2a10', emissiveIntensity: 0.6, roughness: 0.3 }), eyeM = addM('#ff3010', 0);
  // the bear-man's parts, held in the world and placed on his bones every frame (no bone-scale surprises)
  const mantle = new THREE.Group(); for (let i = 0; i < 26; i++) { const row = i < 14 ? 0 : 1, n = row ? 12 : 14, j = row ? i - 14 : i, a = (j / n) * Math.PI * 2, m = new THREE.Mesh(FUR_G, row ? furTip : fur);
    const r = row ? 0.13 : 0.2, fr = Math.cos(a) > 0.3 ? 0.45 : 1; /* (shorter at the front, so his face shows) */ m.position.set(Math.sin(a) * r, row ? 0.06 : -0.04, Math.cos(a) * r - 0.05); m.rotation.set(Math.cos(a) * (row ? 0.5 : 0.85), 0, -Math.sin(a) * (row ? 0.5 : 0.85)); m.scale.set(0.8, (row ? 0.55 : 0.75 + Math.random() * 0.3) * fr, 0.8); mantle.add(m); }
  for (let i = 0; i < 7; i++) { const m = new THREE.Mesh(FUR_G, i % 2 ? fur : furTip); m.position.set((Math.random() - 0.5) * 0.12, -0.08 - i * 0.07, -0.16); m.rotation.x = -0.9; m.scale.set(0.9, 0.7, 0.9); mantle.add(m); } // (a ridge of hackles down his back)
  const claws = [0, 1].map(() => { const g = new THREE.Group(); for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(CLAW_G, clawM); m.position.set((i - 1.5) * 0.045, 0.2, 0.02); m.rotation.x = 0.35; g.add(m); } return g; });
  const eyes = [0, 1].map(() => new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), eyeM));
  const parts = [mantle, ...claws, ...eyes]; parts.forEach(p => { p.scale.multiplyScalar(0.01); G.scene.add(p); });
  // the transformation: a roar, red mist, his body swells; then he lands with a slam that tears gouges across the ground
  S.roar ? S.roar(c.pos) : S.battleCry && S.battleCry(); S.growl && S.growl('bear', c.pos, 1.4); V.burst('blood', c.pos.clone().setY(c.pos.y + 1.2), 40, { speed: 5 }); V.burst('leaf', c.pos.clone().setY(c.pos.y + 1), 30, { speed: 6 }); V.addShake(0.4);
  const slamAt = 0.75; let slammed = false, growlT = 2.5, stepT = 0; const tmp = V3(), tmp2 = V3();
  timer((t, dt) => { const left = Math.max(0, c.bearT - G.time), k = ease(t / T.grow) * ease(left / 0.5), sc = 1 + 0.5 * k; root.scale.setScalar(s0 * sc);
    const vis = root.visible !== false && !(me && !me.tpT && !me.cine && camDist(c.pos) < 1.2);
    if (t < T.grow + 0.2 && Math.random() < 0.8) V.emit('blood', c.pos.clone().setY(c.pos.y + 0.6 + Math.random() * 1.6), { speed: 2.5, size: 0.35, life: 0.5 });
    const yaw = isP(c) ? (c.bodyYaw != null ? c.bodyYaw : c.yaw) : (c.yaw || 0);
    const neck = B.Neck || B.Spine2, head = B.Head; root.updateMatrixWorld(true);
    if (neck) { wpos(neck, mantle.position); mantle.position.y -= 0.05 * sc; } else mantle.position.copy(c.pos).setY(c.pos.y + hgt(c) * 0.85 * sc); mantle.rotation.set(0, yaw, 0); mantle.scale.setScalar(Math.max(0.01, k * sc));
    if (head) { wpos(head, tmp); const f = V3(Math.sin(yaw), 0, Math.cos(yaw)), sd = V3(f.z, 0, -f.x); eyes.forEach((e, i) => { e.position.copy(tmp).addScaledVector(f, 0.11 * sc).addScaledVector(sd, (i ? 0.045 : -0.045) * sc).setY(tmp.y + 0.07 * sc); e.scale.setScalar(Math.max(0.01, k * sc)); }); eyeM.opacity = 0.95 * k; } else eyes.forEach(e => e.visible = false);
    [['RightHand', 'RightForeArm'], ['LeftHand', 'LeftForeArm']].forEach(([h, f], i) => { const cl = claws[i]; if (!B[h] || !B[f]) { cl.visible = false; return; } wpos(B[h], tmp); wpos(B[f], tmp2); const d = tmp.clone().sub(tmp2).normalize(); cl.position.copy(tmp).addScaledVector(d, 0.06 * sc); cl.quaternion.setFromUnitVectors(V3(0, 1, 0), d); cl.rotateY(yaw); cl.scale.setScalar(Math.max(0.01, k * sc));
      if (k > 0.5 && Math.random() < 0.35) V.emit('fire', cl.position, { speed: 0.3, size: 0.18, life: 0.3 }); });
    parts.forEach(p => { if (p !== eyes[0] && p !== eyes[1] || head) p.visible = vis; });
    if (!slammed && t >= slamAt) { slammed = true; slam(); }
    stepT -= dt; const mv = me ? Math.hypot(me.vel ? me.vel.x : 0, me.vel ? me.vel.z : 0) : 3; if (slammed && left > 0.5 && stepT <= 0 && mv > 1) { stepT = 0.42; V.burst('dust', c.pos.clone().setY(c.pos.y + 0.1), 8, { speed: 2, size: 0.8 }); if (camDist(c.pos) < 14) V.addShake(0.05); S.step && S.step('dirt', c.pos, 1.6); }
    growlT -= dt; if (growlT <= 0 && left > 1) { growlT = 2.5 + Math.random() * 1.5; S.growl && S.growl('bear', c.pos, 0.9); V.emit('smoke', c.pos.clone().setY(c.pos.y + hgt(c) * sc * 0.95), { speed: 0.4, size: 0.4, life: 0.6 }); }
    if (left <= 0 || c.dead) { root.scale.setScalar(s0); c.bearT = 0; c.bearOn = false; parts.forEach(kill); fur.dispose(); furTip.dispose(); clawM.dispose(); eyeM.dispose();
      if (!c.dead) { V.burst('leaf', c.pos.clone().setY(c.pos.y + 1), 30, { speed: 4 }); V.burst('dust', c.pos.clone().setY(c.pos.y + 0.5), 20, { speed: 3, size: 1 }); S.growl && S.growl('bear', c.pos, 0.5); } return true; }
    return false; });
  function slam() { const O = c.pos.clone(), base = ultGround(O); O.y = base; hitstop(0.09); V.addShake(Math.max(0.5, 1.2 - camDist(O) / 30));
    S.slam ? S.slam(O, 1.6) : S.explode && S.explode(O, 1); S.roar ? S.roar(O) : null; S.rumble && S.rumble(O, 0.8);
    ultImpact(O, { r: T.slamR, col: '#ff4020', colCol: '#ff9060', dust: '#8a6a48', debris: 'stone', spark: 'blood', column: false, noFlash: true, shake: 0, vol: 0, wallH: 1.4, scorch: false });
    V.burst('stone', O.clone().setY(base + 0.3), 50, { speed: 9, grav: 16, size: 0.4 }); V.burst('dust', O.clone().setY(base + 0.3), 50, { speed: 9, size: 1.6, life: 1.2 }); V.burst('blood', O.clone().setY(base + 1), 30, { speed: 6 }); V.light(O.clone().setY(base + 1.5), '#ff4020', 10, 0.4, 16);
    // four great claw rakes tear out across the ground in front, four strokes each, like the swipe of a giant paw
    const yaw = isP(c) ? c.yaw : (c.yaw || 0), parts = []; for (let r = 0; r < 3; r++) { const a = yaw + (r - 1) * 0.75, d = V3(Math.sin(a), 0, Math.cos(a)), sd = V3(d.z, 0, -d.x);
      for (let i = 0; i < 4; i++) crack(O.clone().addScaledVector(d, 0.9).addScaledVector(sd, (i - 1.5) * 0.36), d, T.slamR - 0.8, [['scorch', 0.5, 0.85, 0.03], ['#ff3010', 0.3, 0.75, 0.05], ['#ffc090', 0.09, 1, 0.07]], parts, 1); }
    timer((t) => { const f = Math.max(0, 1 - Math.max(0, t - 1.2) / 1.2); for (const m of parts) m.material.opacity = m.userData.op * f; if (t > 2.5) { parts.forEach(kill); return true; } return false; });
    for (const u of near(ultFoes(c), O, T.slamR)) { ultHurt(u, T.slam, c, 'blood'); const n = V3(u.pos.x - O.x, 0, u.pos.z - O.z); if (n.lengthSq() < 1e-4) n.set(1, 0, 0); n.normalize();
      if (isP(u)) { if (u.vel) u.vel.set(n.x * 7, 6, n.z * 7); u.onGround = false; u.debuff && u.debuff('stun', T.kd * 0.6); } else { knockDown(u, T.kd); u.pos.addScaledVector(n, 1.2); if (u.root) u.root.position.copy(u.pos); } }
    feed(c, 'becomes a great bear!'); }
  return true;
}

// ======================= Priest: Salvation =======================
const BEAM_G = new THREE.CylinderGeometry(0.55, 0.9, 1, 16, 1, true), SPEAR_LG = new THREE.ConeGeometry(0.28, 4.6, 6);
export function salvation(c) {
  const T = Object.assign({}, UB_TUNE.salv, G.salvTune || {}), me = isP(c) ? c : null, C = c.pos.clone(); C.y = ultGround(C);
  if (me) { me.ultImmT = Math.max(me.ultImmT || 0, 1.2); me.ultPoseT = 1.4; } else c.invulnT = Math.max(c.invulnT || 0, G.time + 1.2);
  const chest = me ? c.ch && c.ch.chest : c.model && c.model.chest, wings = makeWings(); wings.scale.setScalar(0.01); if (wings.userData.mat) { wings.userData.mat = wings.userData.mat; wings.userData.mat.color.set('#ffb830'); wings.userData.mat.opacity = 0.5; } let wingHost = null;
  if (chest) { wings.position.set(0, 0.15, -0.2); chest.add(wings); wingHost = 'chest'; } else { G.scene.add(wings); wingHost = 'world'; }
  // a crown of sun-spikes behind his head
  const crown = new THREE.Group(); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, m = new THREE.Mesh(new THREE.ConeGeometry(0.06, i % 2 ? 0.35 : 0.6, 4), addM(i % 2 ? '#fff4c0' : '#ffd060', 0.9)); m.position.set(Math.sin(a) * 0.42, Math.cos(a) * 0.42, 0); m.rotation.z = -a; crown.add(m); } G.scene.add(crown);
  S.castRise && S.castRise(0.5, 'holy'); S.cast && S.cast('holy', C, 1.8); S.smiteFall && S.smiteFall(C); V.burst('gold', C.clone().setY(C.y + 1), 120, { speed: 8 }); V.light(C.clone().setY(C.y + 3), '#ffe9a0', 16, 0.8, 34);
  later(0.12, () => { V.burst('gold', c.pos.clone().setY(c.pos.y + 1.6), 60, { speed: 12, vy: 2 }); hitstop(0.05); V.addShake(0.4); }); // (the wings snap open)
  // the rays: one falls on each ally (and on him); they heal at once, then over the next seconds, and cannot fall below 1 health for 3 s
  const allies = near(ultFriends(c), C, T.r); if (!allies.includes(c)) allies.push(c);
  const rays = allies.map((u, i) => { const g = new THREE.Group(), outer = new THREE.Mesh(BEAM_G, addM('#ffe08a', 0)), core = new THREE.Mesh(BEAM_G, addM('#fffbe8', 0)); core.scale.set(0.35, 1, 0.35); g.add(outer, core); G.scene.add(g); return { u, g, outer, core, d: 0.1 + i * 0.07, hit: false }; });
  const foes = near(ultFoes(c), C, T.r), spears = []; foes.forEach((u, i) => { for (let s = 0; s < T.spears; s++) spears.push({ u, at: 0.6 + s * 1.4 + i * 0.09 + Math.random() * 0.1 }); });
  if (allies.length > 1 || foes.length) feed(c, 'calls down Salvation!');
  let hotT = 0; const H = 22;
  timer((t, dt) => { const k = ease(t / 0.4) * (1 - ease((t - T.dur) / 0.6)), lift = ease(t / 0.7) * (1 - ease((t - T.dur + 0.2) / 0.6));
    wings.scale.setScalar(Math.max(0.01, (wingHost === 'chest' ? 0.9 : 0.8) * k)); const sides = wings.userData.sides; if (sides) sides.forEach((w, i) => { w.rotation.y = (i ? -1 : 1) * (0.2 + Math.sin(t * 3.2) * 0.28); w.rotation.z = (i ? 1 : -1) * Math.sin(t * 3.2) * 0.12; });
    if (wingHost === 'world') { wings.position.copy(c.pos).setY(c.pos.y + hgt(c) * 0.75); wings.rotation.y = c.yaw || 0; }
    const body = me ? c.ch && c.ch.body : c.model && c.model.body; if (body) body.position.y = lift * 1.4 + Math.sin(t * 3.2) * 0.1 * lift;
    const yaw = me ? (c.bodyYaw != null ? c.bodyYaw : c.yaw) : (c.yaw || 0); crown.position.copy(c.pos).add(V3(-Math.sin(yaw) * 0.25, hgt(c) + 0.15 + lift * 1.4, -Math.cos(yaw) * 0.25)); crown.rotation.set(0, yaw, t * 0.8); crown.scale.setScalar(Math.max(0.01, k * 1.3)); crown.visible = !me || camDist(crown.position) > 1.6;
    wings.visible = !me || !!me.cine || (me.tpT || 0) > 0 || camDist(c.pos.clone().setY(c.pos.y + 1.4)) > 1.5;
    if (Math.random() < 0.6 * k) V.emit('gold', c.pos.clone().add(V3((Math.random() - 0.5) * 3, 1 + lift * 1.4 + Math.random() * 2, (Math.random() - 0.5) * 3)), { speed: 0.3, vy: -0.6, size: 0.3, life: 1.4, grav: 0.4 }); // (feathers of light drifting down)
    for (const r of rays) { const u = r.u, tt = t - r.d; if (tt < 0) continue; const p = u.pos, gy0 = p.y; const drop = Math.min(1, tt / 0.18), fade = 1 - ease((t - T.dur + 0.3) / 0.6);
      const len = H * drop, selfK = u === c ? Math.max(0, 1 - Math.max(0, tt - 0.5) / 0.5) : 1; /* (his own ray only flashes: the camera sits behind him, inside it) */ r.g.position.set(p.x, gy0 + H - len / 2, p.z); r.g.scale.set(1, len, 1); r.outer.material.opacity = 0.28 * fade * selfK * (tt < 0.4 ? 1.8 - tt * 2 : 1); r.core.material.opacity = 0.6 * fade * selfK * (tt < 0.4 ? 1.6 - tt * 1.5 : 0.6 + Math.sin(t * 7) * 0.1);
      if (!r.hit && drop >= 1) { r.hit = true; if (!u.dead) { ultHeal(u, T.heal0); UBX.buff && UBX.buff(u, 'undying', T.undying); } V.burst('gold', p.clone().setY(gy0 + 0.3), 50, { speed: 7, vy: 3 }); V.burst('heal', p.clone().setY(gy0 + 1), 30, { speed: 3, vy: 3 }); V.light(p.clone().setY(gy0 + 2), '#ffe9a0', 10, 0.4, 14); if (isP(u) && S.heal) S.heal(); else S.cast && S.cast('holy', p, 0.7); }
      if (Math.random() < 0.3 * fade) V.emit('gold', p.clone().add(V3((Math.random() - 0.5) * 1.2, Math.random() * 3, (Math.random() - 0.5) * 1.2)), { speed: 0.2, vy: 2.5, size: 0.25, life: 0.8 }); }
    hotT -= dt; if (hotT <= 0 && t < T.dur) { hotT = 0.5; const per = T.hot / (T.dur / 0.5); for (const r of rays) if (!r.u.dead && r.hit) ultHeal(r.u, per); }
    for (const s of spears) { if (s.done || t < s.at) continue; s.done = true; if (!s.u.dead) spear(s.u); }
    if (t > T.dur + 0.7) { kill(crown); rays.forEach(r => kill(r.g)); if (wings.parent) wings.parent.remove(wings); if (body) body.position.y = 0; return true; } return false; });
  function spear(u) { const q = u.pos.clone(), from = q.clone().add(V3((Math.random() - 0.5) * 4, 16, (Math.random() - 0.5) * 4)), m = new THREE.Mesh(SPEAR_LG, addM('#fff2b0', 0.95)), glow2 = new THREE.Mesh(SPEAR_LG, addM('#ffb030', 0.5)); glow2.scale.set(2.2, 1.1, 2.2); m.add(glow2); G.scene.add(m); S.smiteFall && S.smiteFall(q);
    timer((t) => { const goal = u.dead ? q : u.pos.clone().setY(u.pos.y + 0.6), k = Math.min(1, t / 0.28); m.position.lerpVectors(from, goal, k * k); m.quaternion.setFromUnitVectors(V3(0, -1, 0), goal.clone().sub(from).normalize()); V.emit('gold', m.position, { speed: 0.4, size: 0.4, life: 0.35 });
      if (k < 1) return false; kill(m); V.burst('gold', goal, 70, { speed: 9 }); V.burst('spark', goal, 20, { speed: 7 }); V.sphereFlash(goal, 1.2, '#fff0b0', 0.18); V.ring(V3(goal.x, u.pos.y + 0.1, goal.z), 1.6, '#ffd060', 0.3); V.light(goal, '#ffd060', 8, 0.25, 12); S.smiteHit && S.smiteHit(goal); if (!u.dead) { ultHurt(u, T.spear, c, 'gold'); ultSlow(u, 0.6, 1.2); stun(u, 0.15); } return true; }); }
  return true;
}

// ======================= Bombardier: Big Bertha dressing (bomber.js calls these) =======================
function digitTex() { const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128; const tex = new THREE.CanvasTexture(cv); tex.userData = { cv, n: -1 }; return tex; }
function paintDigit(tex, n, hot) { const u = tex.userData; if (u.n === n + (hot ? 100 : 0)) return; u.n = n + (hot ? 100 : 0); const x = u.cv.getContext('2d'); x.clearRect(0, 0, 128, 128);
  x.font = 'bold 104px Impact, Arial Black, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 10; x.strokeStyle = '#200400'; x.strokeText(String(n), 64, 70); x.fillStyle = hot ? '#fff0a0' : '#ff3a1a'; x.fillText(String(n), 64, 70); tex.needsUpdate = true; }
export function berthaDress(b) { const m = b.mesh; if (!m || m.userData.dressed) return; m.userData.dressed = true; m.scale.setScalar(1.45);
  const siren = new THREE.Group(); siren.position.y = 0.66; const cap = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#ff2a10', emissive: '#ff1a00', emissiveIntensity: 0.8, transparent: true, opacity: 0.9 })); siren.add(cap);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.7, 14, 1, true), addM('#ff2a10', 0.18)); beam.geometry.translate(0, -0.85, 0); beam.rotation.z = Math.PI / 2; const piv = new THREE.Group(); piv.add(beam); piv.position.y = 0.05; siren.add(piv); m.add(siren);
  const tex = digitTex(), spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false })); spr.scale.setScalar(0.75); spr.position.y = 1.35; spr.renderOrder = 20; m.add(spr);
  const iron = []; m.traverse(o => { if (o.isMesh && o.material && o.material.isMeshStandardMaterial && o.material.metalness > 0.5 && !o.material.userData.bert) { o.material = o.material.clone(); o.material.userData.bert = true; o.material.emissive = new THREE.Color('#ff2000'); o.material.emissiveIntensity = 0; iron.push(o.material); } });
  m.userData.bert = { piv, beam, tex, spr, iron, cap }; }
export function berthaTick(b, dt, k) { const m = b.mesh, D = m && m.userData.bert; if (!D) return; const left = Math.max(0, b.fuse - b.t), hot = left < 1.6;
  D.piv.rotation.y += dt * (4 + k * 14); D.beam.material.opacity = (b.flash > 0 ? 0.26 : 0.1) * (0.6 + k); D.cap.material.emissiveIntensity = b.flash > 0 ? 2 : 0.5;
  paintDigit(D.tex, Math.ceil(left), hot); D.spr.scale.setScalar((0.75 + (b.flash > 0 ? 0.15 : 0)) * (hot ? 1.25 : 1)); D.spr.position.y = 1.35 + Math.sin(b.t * 3) * 0.04;
  const heat = Math.max(0, 1 - left / 2.2); D.iron.forEach(mt => { mt.emissiveIntensity = heat * (0.8 + 0.4 * Math.sin(b.t * 30)); });
  const shake = heat * 0.045; m.position.set(b.pos.x + (Math.random() - 0.5) * shake, b.pos.y + Math.abs(Math.sin(b.t * 40)) * shake * 0.6, b.pos.z + (Math.random() - 0.5) * shake); m.scale.setScalar(1.45 * (1 + heat * 0.06 * Math.sin(b.t * 50)) + (b.flash > 0 ? 0.05 : 0));
  if (heat > 0 && Math.random() < dt * 30 * heat) V.emit(Math.random() < 0.5 ? 'spark' : 'smoke', b.pos.clone().add(V3((Math.random() - 0.5) * 0.6, 0.5 + Math.random() * 0.5, (Math.random() - 0.5) * 0.6)), { speed: 2, vy: 2, size: 0.25, life: 0.6 });
  if (b.defuse > 0 && Math.random() < dt * 14) { V.emit('spark', b.pos.clone().setY(b.pos.y + 0.75), { speed: 3, size: 0.12, life: 0.3 }); if (Math.random() < 0.2) S.click && S.click(); } // (wires being cut)
  if (hot && !b.whined) { b.whined = true; S.castRise && S.castRise(1.5, 'fire'); } }
export function berthaBoom(pos, base, R) { // a mushroom cloud: a shock ring across the ground, a pillar of fire, a rolling cap of smoke and fire high above
  hitstop(0.12); ultImpact(V3(pos.x, base, pos.z), { r: R * 0.85, col: '#ff7a20', colCol: '#ffd080', dust: '#b09070', debris: 'stone', spark: 'ember', flash: '#fff4d0', shake: 0, vol: 0, colH: 18, wallH: 3, base, scorch: false }); /* (bomber.js leaves its own crater) */
  S.rumble && S.rumble(pos, 2.2); later(0.25, () => S.explode && S.explode(pos, 1.2));
  const P = V3(pos.x, base, pos.z); timer((t) => { const k = Math.min(1, t / 1.6), top = 2 + 12 * Math.sqrt(k);
    if (t < 1.6) { for (let i = 0; i < 3; i++) V.emit('fire', P.clone().setY(base + Math.random() * top), { speed: 1, size: 2.4 - k, life: 0.6, radius: 1.6 }); V.emit('smoke', P.clone().setY(base + Math.random() * top), { speed: 0.6, size: 2.2, life: 1.6, radius: 1.4, grav: -0.5 });
      const n = 6; for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, r = 1.5 + k * 6 * Math.random(); V.emit(Math.random() < 0.4 ? 'fire' : 'smoke', P.clone().add(V3(Math.cos(a) * r, top + (Math.random() - 0.3) * 1.5, Math.sin(a) * r)), { speed: 1.2, vy: 0.6, size: 2.6 + k * 1.5, life: 1.6 + k, grav: -0.3, radius: 0.8 }); } }
    if (t < 0.6 && Math.random() < 0.6) V.light(P.clone().setY(base + top), '#ff8030', 12, 0.2, 40);
    return t > 2; }); }
