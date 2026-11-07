// The Ultimate Theatre (Training Yard, U): pick any class's ultimate and an enemy of that class appears in front of you
// and uses it on you. You watch from a cinematic camera, in third person, as the victim; you are put back on your feet
// afterwards. The necromancer's demon is the real thing; the others are staged victim sequences of each ultimate.
import * as THREE from 'three';
import { G } from './state.js';
import { CLASSES, ABILITIES } from './data.js';
import { heightAt } from './terrain.js';
import { V } from './vfx.js';
import { S } from './audio.js';
import { buildHumanoid, equipWeapon, animateHumanoid } from './character.js';
import { arenaSpec, arenaBody, arenaDecor, arenaWeaponDecor, addOutline, playNotes } from './arenalooks.js';
import { ultOf } from './arena.js';
import { classPortrait } from './portraits.js';
import { yardUltTest } from './yard.js';

const ORDER = ['warrior', 'paladin', 'darkknight', 'berserker', 'monk', 'rogue', 'ranger', 'musketeer', 'blunderbuss', 'wizard', 'elementalist', 'enchanter', 'necromancer', 'beastmaster', 'shaman', 'druid', 'cleric', 'bard'];
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const ease = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const basic = (c, o = {}) => new THREE.MeshBasicMaterial(Object.assign({ color: c }, o));
const glow = (c, op = 0.6) => basic(c, { transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending });
const std = (c, r = 0.7, m = 0, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: r, metalness: m }, o));
let busy = false;

// ---------- the picker ----------
export function openUltPicker() {
  if (busy || !G.player || document.getElementById('ultpick')) return;
  try { document.exitPointerLock(); } catch (e) { /* not locked */ }
  G.uiOpen = true;
  const w = document.createElement('div'); w.id = 'ultpick';
  w.style.cssText = 'position:fixed;inset:0;z-index:80;background:rgba(8,6,4,.82);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;font-family:inherit;color:#f0e6d0';
  w.innerHTML = '<div style="font-size:26px;font-weight:700;letter-spacing:.04em;margin-bottom:4px">Ultimate Theatre</div><div style="opacity:.75;margin-bottom:14px;text-align:center">Pick an ultimate. An enemy of that class appears and uses it on you, and you watch it from the victim\'s side.</div><div id="ultgrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:10px;width:min(980px,100%);max-height:70vh;overflow:auto;padding:4px"></div><button id="ultclose" style="margin-top:14px;padding:8px 22px;background:#2a2018;color:#f0e6d0;border:1px solid #8a7050;border-radius:6px;cursor:pointer;font:inherit">Close (Esc)</button>';
  document.body.appendChild(w);
  const grid = w.querySelector('#ultgrid');
  for (const cls of ORDER) {
    if (!CLASSES[cls]) continue; const id = ultOf(cls), ab = id && (ABILITIES[cls] || []).find(a => a.id === id); if (!ab) continue;
    const b = document.createElement('button');
    b.style.cssText = 'background:#1c1610;border:1px solid #5a4630;border-radius:8px;padding:6px;cursor:pointer;color:#f0e6d0;font:inherit;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0';
    b.innerHTML = `<img src="${classPortrait(cls)}" alt="" style="width:100%;aspect-ratio:22/28;object-fit:cover;border-radius:5px;background:#000"><b style="font-size:13px">${CLASSES[cls].name}</b><span style="font-size:12px;color:#ffd070;text-align:center">${ab.name}</span>`;
    b.onmouseenter = () => { b.style.borderColor = '#ffd070'; }; b.onmouseleave = () => { b.style.borderColor = '#5a4630'; };
    b.onclick = () => { close(); try { document.getElementById('game').requestPointerLock(); } catch (e) { /* fine */ } play(cls, ab); };
    grid.appendChild(b);
  }
  const key = (e) => { if (e.code === 'Escape' || e.code === 'KeyU') { e.stopPropagation(); close(); } };
  function close() { w.remove(); G.uiOpen = false; window.removeEventListener('keydown', key, true); }
  w.querySelector('#ultclose').onclick = close; window.addEventListener('keydown', key, true);
}

export function playUlt(cls) { const id = ultOf(cls), ab = id && (ABILITIES[cls] || []).find(a => a.id === id); if (ab) play(cls, ab); }
export const ULT_ORDER = ORDER;
// ---------- the show ----------
function play(cls, ab) {
  if (['necromancer', 'paladin', 'monk', 'rogue', 'berserker', 'ranger', 'druid', 'shaman'].includes(cls)) { yardUltTest(cls); return; } // (finished ultimates: the real thing, with its own cinematic)
  const P = G.player; if (!P || busy) return; busy = true;
  const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw), cx = P.pos.x + fx * 9, cz = P.pos.z + fz * 9;
  const ch = buildHumanoid({ race: 'human', sex: 'm', cls, outfit: cls, spec: arenaSpec(cls), body: arenaBody(cls) }); arenaDecor(ch, cls);
  try { equipWeapon(ch, CLASSES[cls].weapons[0], 3, 0); arenaWeaponDecor(ch, cls); } catch (e) { /* no weapon model */ }
  addOutline(ch.root, '#8a0c06'); const cp = V3(cx, heightAt(cx, cz), cz); ch.root.position.copy(cp); ch.root.rotation.y = Math.atan2(P.pos.x - cx, P.pos.z - cz); G.scene.add(ch.root);
  V.burst('smoke', cp.clone().setY(cp.y + 1), 30, { speed: 3 }); S.cast && S.cast('arcane', cp, 0.6);
  G.hooks.toast && G.hooks.toast(`An enemy ${CLASSES[cls].name} uses ${ab.name} on you!`, '★', 'bad');
  const home = P.pos.clone(), hp0 = P.hp, temp = [], ev = [], spans = [];
  const C = { P, cls, ch, cp, home, t: 0, pose: 'idle', yawSpin: 0, camFocus: 0.55, camR: null, roll: 0,
    add(o) { G.scene.add(o); temp.push(o); return o; },
    at(t, fn) { ev.push({ t, fn }); },
    span(t0, t1, fn) { spans.push({ t0, t1, fn }); }, // fn(k 0..1, t, dt) every frame between t0 and t1
    every(t0, t1, dt, fn) { for (let t = t0; t <= t1 + 1e-6; t += dt) ev.push({ t, fn }); },
    chest() { return P.pos.clone().setY(P.pos.y + 1.2); },
    hit(n, kind = 'blood') { P.hp = Math.max(Math.ceil((P.maxHp || 500) * 0.05), P.hp - n); V.number(C.chest(), String(Math.round(n)), 'dmg'); V.burst(kind, C.chest(), 18, { speed: 4 }); S.hit && S.hit('flesh', C.chest(), 1); V.addShake(0.25); P.hurtT = 0.3; },
    knock(h, dur, back = 0) { const t0 = C.t, from = P.pos.clone(), dir = V3(P.pos.x - cp.x, 0, P.pos.z - cp.z).normalize(); C.span(t0, t0 + dur, (k) => { P.pos.set(from.x + dir.x * back * ease(k), from.y + Math.sin(k * Math.PI) * h, from.z + dir.z * back * ease(k)); }); },
    moveCaster(to, t0, t1) { let from = null; C.span(t0, t1, (k) => { if (!from) from = ch.root.position.clone(); ch.root.position.lerpVectors(from, to, ease(k)); }); },
  };
  const D = SHOWS[cls] || SHOWS.generic; let dur; try { dur = D(C, ab); } catch (e) { console.warn('ult show', cls, e); for (const o2 of temp) G.scene.remove(o2); G.scene.remove(ch.root); busy = false; return; }
  // you: frozen in place, untouchable, watched from the cinematic camera; the bars come in, the HUD goes
  P.held = true; P.ultImmT = dur + 1; let bars = document.getElementById('cinebars'); if (!bars) { bars = document.createElement('div'); bars.id = 'cinebars'; bars.innerHTML = '<i></i><i></i>'; document.body.appendChild(bars); }
  requestAnimationFrame(() => bars.classList.add('on')); document.body.classList.add('cine');
  const side = Math.random() < 0.5 ? 1 : -1, mid = new THREE.Vector3();
  P.cine = (cam) => { const pc = P.pos.clone().setY(P.pos.y + 1.1), cc = ch.root.position.clone().setY(ch.root.position.y + 1.2); mid.lerpVectors(cc, pc, C.camFocus);
    const d = Math.hypot(pc.x - cc.x, pc.z - cc.z), ang = Math.atan2((pc.z - cc.z) * side, -(pc.x - cc.x) * side) + C.t * 0.12 - 0.3, r = C.camR || Math.max(7, d * 0.55 + 5.5);
    cam.position.set(mid.x + Math.cos(ang) * r, mid.y + 1.6 + Math.sin(C.t * 0.5) * 0.3, mid.z + Math.sin(ang) * r); cam.lookAt(mid); cam.rotation.z += C.roll; cam.fov = 50; };
  ev.sort((a, b) => a.t - b.t);
  G.timers.push({ update: (dt) => { C.t += dt; const t = C.t;
    while (ev.length && ev[0].t <= t) ev.shift().fn(t);
    for (const s of spans) if (t >= s.t0 && t <= s.t1 + dt) s.fn(Math.min(1, (t - s.t0) / Math.max(1e-3, s.t1 - s.t0)), t, dt);
    poseTick(C, dt);
    if (t > dur) { for (const o of temp) G.scene.remove(o); G.scene.remove(ch.root); P.held = false; P.cine = null; P.ultImmT = 0.5; P.pos.copy(home); P.pos.y = heightAt(home.x, home.z); P.vel && P.vel.set(0, 0, 0); P.hp = P.maxHp || hp0; P.dead = false;
      document.body.classList.remove('cine'); bars.classList.remove('on'); busy = false; return true; }
    return false; } });
}

// the caster's body language
function poseTick(C, dt) {
  const ch = C.ch, R = ch.arms.R, L = ch.arms.L, t = C.t; animateHumanoid(ch, dt, { speed: C.moving ? 6 : 0, armed: true, ready: true });
  const face = Math.atan2(C.P.pos.x - ch.root.position.x, C.P.pos.z - ch.root.position.z);
  if (C.pose === 'spin') { C.yawSpin += dt * 18; ch.root.rotation.y = C.yawSpin; R.sh.rotation.set(-1.5, 0, 1.2); L.sh.rotation.set(-1.5, 0, -1.2); return; }
  ch.root.rotation.y = face;
  if (C.pose === 'up') { R.sh.rotation.set(-2.6, 0, 0.5); L.sh.rotation.set(-2.6, 0, -0.5); R.el.rotation.x = -0.2; L.el.rotation.x = -0.2; }
  else if (C.pose === 'aim') { R.sh.rotation.set(-1.55, 0, 0.1); L.sh.rotation.set(-1.45, 0, -0.35); R.el.rotation.x = -0.1; L.el.rotation.x = -0.3; }
  else if (C.pose === 'aimUp') { R.sh.rotation.set(-2.3, 0, 0.15); L.sh.rotation.set(-2.2, 0, -0.3); }
  else if (C.pose === 'throw') { const k = Math.min(1, (t - (C.poseT || 0)) * 3); R.sh.rotation.set(-2.8 + k * 2.2, 0, 0.3); }
  else if (C.pose === 'slam') { const k = Math.min(1, (t - (C.poseT || 0)) * 4); R.sh.rotation.set(-2.8 + k * 1.8, 0, 0.2); L.sh.rotation.set(-2.8 + k * 1.8, 0, -0.2); }
  else if (C.pose === 'punch') { const a = Math.sin(t * 40); R.sh.rotation.set(-1.5 + a * 0.4, 0, 0.1); L.sh.rotation.set(-1.5 - a * 0.4, 0, -0.1); R.el.rotation.x = -0.4 - a * 0.4; L.el.rotation.x = -0.4 + a * 0.4; }
  else if (C.pose === 'uppercut') { R.sh.rotation.set(-3.0, 0, 0.1); R.el.rotation.x = -0.1; }
}
const setPose = (C, p) => { C.pose = p; C.poseT = C.t; };

// ---------- small builders ----------
function bolt(C, from, to, col = '#cfe4ff') { // a jagged lightning bolt that flashes and fades
  const pts = [from.clone()]; for (let i = 1; i < 10; i++) { const p = from.clone().lerp(to, i / 10); p.x += (Math.random() - 0.5) * 0.9; p.z += (Math.random() - 0.5) * 0.9; pts.push(p); } pts.push(to.clone());
  const g = new THREE.Group(); for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], len = a.distanceTo(b), m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, len, 5), glow(col, 0.95)); m.position.copy(a).lerp(b, 0.5); m.quaternion.setFromUnitVectors(V3(0, 1, 0), b.clone().sub(a).normalize()); g.add(m); }
  C.add(g); V.light(to, col, 8, 0.25, 22); V.sphereFlash(to, 1.6, col, 0.25); S.thunder ? S.thunder(to) : S.explode && S.explode(to, 0.4); setTimeout(() => G.scene.remove(g), 180);
}
function arrowMesh() { const g = new THREE.Group(); const s = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 5), std('#8a6a44')); g.add(s); const h = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 5), std('#9aa0a8', 0.3, 0.8)); h.position.y = -0.5; h.rotation.x = Math.PI; g.add(h); const f = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.005), std('#c83a2a')); f.position.y = 0.38; g.add(f); return g; }
function fly(C, mesh, from, to, t0, t1, arc = 0, onEnd) { C.add(mesh); mesh.visible = false; C.span(t0, t1, (k) => { mesh.visible = true; mesh.position.lerpVectors(from, to, k); mesh.position.y += Math.sin(k * Math.PI) * arc; }); if (onEnd) C.at(t1, onEnd); }

// ---------- one staged sequence per class (returns its length in seconds) ----------
const SHOWS = {
  warrior(C) { // Stone Banner: he plants a war banner and the ground erupts in a ring of stone spikes around you
    C.at(0.2, () => setPose(C, 'up')); C.at(0.8, () => setPose(C, 'slam'));
    const ban = new THREE.Group(); ban.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 8), std('#5a3a1a'))); const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.4), std('#a01818', 0.8, 0, { side: THREE.DoubleSide })); fl.position.set(0.58, 0.8, 0); ban.add(fl);
    const bp = C.cp.clone().lerp(C.home, 0.12); ban.position.copy(bp).setY(bp.y + 7); C.add(ban); C.span(0.8, 1.0, (k) => { ban.position.y = bp.y + 1.5 + (1 - k) * 5.5; });
    C.at(1.0, () => { V.burst('stone', bp, 40, { speed: 6 }); V.ring(bp, 6, '#c8a060', 0.6); V.addShake(0.6); S.explode && S.explode(bp, 0.5); });
    const spikes = []; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, s = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.4, 6), std('#7a7068', 0.9)); s.position.set(C.home.x + Math.cos(a) * 1.6, C.home.y - 2, C.home.z + Math.sin(a) * 1.6); s.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35); C.add(s); spikes.push(s); }
    C.span(1.3, 1.55, (k) => { for (const s of spikes) s.position.y = C.home.y - 2 + k * 2.9; }); C.at(1.3, () => { V.burst('stone', C.chest(), 50, { speed: 7 }); C.hit(220, 'blood'); C.knock(1.6, 0.9); V.addShake(0.9); });
    C.span(3.0, 3.5, (k) => { for (const s of spikes) s.position.y = C.home.y + 0.9 - k * 3; }); return 3.8; },
  berserker(C) { // Bladestorm: he spins into a whirlwind of steel and tears through you
    C.at(0.3, () => setPose(C, 'spin')); C.at(0.3, () => { C.moving = true; }); const to = C.home.clone().lerp(C.cp, 0.15); C.moveCaster(to, 0.4, 1.0); C.at(1.0, () => { C.moving = false; });
    C.every(0.4, 2.8, 0.08, () => { const h = C.ch.root.position.clone().setY(C.ch.root.position.y + 1.1); V.burst('spark', h, 6, { speed: 6 }); });
    C.every(1.0, 2.6, 0.2, () => C.hit(45, 'blood')); C.at(2.7, () => { C.hit(90, 'blood'); C.knock(1.0, 0.7, 2); }); C.at(2.9, () => setPose(C, 'idle')); C.camFocus = 0.7; return 3.6; },
  paladin(C) { // Avenging Wrath: he rises on golden wings and calls down a pillar of holy fire onto you
    C.at(0.1, () => setPose(C, 'up')); const wings = new THREE.Group(); for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.0), glow('#ffd860', 0.7)); w.position.set(sx * 1.0, 1.5, -0.2); w.rotation.set(0, sx * 0.5, sx * 0.4); w.material.side = THREE.DoubleSide; wings.add(w); } C.ch.root.add(wings);
    C.span(0.2, 1.0, (k) => { C.ch.root.position.y = C.cp.y + ease(k) * 1.6; wings.scale.setScalar(ease(k)); });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 40, 24, 1, true), glow('#ffe890', 0.0)); beam.position.copy(C.home).setY(C.home.y + 20); C.add(beam); const core = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 40, 16, 1, true), glow('#ffffff', 0)); core.position.copy(beam.position); C.add(core);
    C.span(1.2, 1.35, (k) => { beam.material.opacity = 0.55 * k; core.material.opacity = 0.8 * k; beam.scale.set(0.3 + k * 0.7, 1, 0.3 + k * 0.7); });
    C.at(1.3, () => { V.burst('gold', C.chest(), 80, { speed: 8 }); V.ring(C.home, 7, '#ffd860', 0.8); V.sphereFlash(C.chest(), 3, '#fff0a0', 0.4); V.light(C.chest(), '#ffe090', 10, 0.8, 25); C.hit(260, 'gold'); C.knock(0.6, 0.6); V.addShake(0.9); S.cast && S.cast('holy', C.home, 1.4); });
    C.every(1.4, 2.4, 0.1, () => V.burst('gold', C.home.clone().setY(C.home.y + Math.random() * 4), 6, { speed: 3 })); C.span(2.4, 3.0, (k) => { beam.material.opacity = 0.55 * (1 - k); core.material.opacity = 0.8 * (1 - k); });
    C.span(3.0, 3.6, (k) => { C.ch.root.position.y = C.cp.y + (1 - ease(k)) * 1.6; wings.scale.setScalar(1 - ease(k)); }); C.at(3.6, () => C.ch.root.remove(wings)); return 3.9; },
  darkknight(C) { // Harbinger: a pool of shadow opens under you and black tendrils rise to drag the life out of you
    C.at(0.2, () => setPose(C, 'up')); const pool = new THREE.Mesh(new THREE.CircleGeometry(2.4, 32), basic('#0a0010', { transparent: true, opacity: 0 })); pool.rotation.x = -Math.PI / 2; pool.position.copy(C.home).setY(C.home.y + 0.04); C.add(pool); C.span(0.4, 0.8, (k) => { pool.material.opacity = 0.85 * k; pool.scale.setScalar(0.2 + k * 0.8); });
    const ten = []; for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2, m = new THREE.Mesh(new THREE.ConeGeometry(0.16, 2.6, 6), std('#1a0a22', 0.4, 0.2, { emissive: '#4a0a6a', emissiveIntensity: 0.6 })); m.position.set(C.home.x + Math.cos(a) * 0.9, C.home.y - 1.4, C.home.z + Math.sin(a) * 0.9); m.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4); C.add(m); ten.push([m, a]); }
    C.span(0.8, 1.1, (k) => { for (const [m] of ten) m.position.y = C.home.y - 1.4 + k * 2.6; }); C.span(1.1, 2.6, (k, t) => { for (const [m, a] of ten) { m.rotation.x = Math.sin(a) * 0.4 + Math.sin(t * 6 + a) * 0.15; m.rotation.z = -Math.cos(a) * 0.4 + Math.cos(t * 5 + a) * 0.15; } });
    C.every(1.0, 2.5, 0.25, () => { C.hit(40, 'shadow'); const c = C.chest(); V.burst('shadow', c, 10, { speed: 2, dir: C.ch.root.position.clone().sub(c).normalize().multiplyScalar(1.2) }); });
    C.span(2.7, 3.1, (k) => { for (const [m] of ten) m.position.y = C.home.y + 1.2 - k * 2.8; pool.material.opacity = 0.85 * (1 - k); }); return 3.4; },
  cleric(C) { // Miracle: a sun blazes over her and a wave of holy light hurls you back, blinding
    C.at(0.1, () => setPose(C, 'up')); const sun = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), glow('#fff4c0', 0.9)); sun.position.copy(C.cp).setY(C.cp.y + 3); C.add(sun); C.span(0.2, 1.0, (k) => sun.scale.setScalar(0.2 + ease(k) * 2));
    C.at(1.1, () => { V.ring(C.cp, 16, '#fff0a0', 0.8); V.sphereFlash(C.cp.clone().setY(C.cp.y + 2), 9, '#fff8d0', 0.6); V.light(C.cp, '#fff0c0', 12, 0.8, 30); V.addShake(0.6); S.cast && S.cast('holy', C.cp, 1.4); });
    C.at(1.35, () => { C.hit(120, 'gold'); C.knock(0.8, 0.8, 4); V.burst('gold', C.chest(), 60, { speed: 7 }); }); C.span(1.0, 2.6, (k) => { sun.material.opacity = 0.9 * (1 - k); }); return 3.0; },
  druid(C) { // Tranquility: a storm of leaves, and living vines burst out of the ground to bind you fast
    C.at(0.1, () => setPose(C, 'up')); C.every(0.2, 2.6, 0.06, () => { const a = Math.random() * Math.PI * 2; V.emit('leaf', C.home.clone().add(V3(Math.cos(a) * 2.5, 0.5 + Math.random() * 2.5, Math.sin(a) * 2.5)), { speed: 2, size: 0.25, life: 1 }); });
    const vines = []; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, m = new THREE.Mesh(new THREE.TorusGeometry(0.5 + (i % 3) * 0.08, 0.06, 6, 16, Math.PI * 1.6), std('#3a6a24', 0.8)); m.position.set(C.home.x, C.home.y + 0.2 + i * 0.22, C.home.z); m.rotation.set(Math.PI / 2, 0, a); m.scale.setScalar(0.01); C.add(m); vines.push(m); }
    C.span(0.6, 1.3, (k) => vines.forEach((m, i) => m.scale.setScalar(Math.max(0.01, ease(k * 1.6 - i * 0.08))))); C.at(0.8, () => { V.burst('leaf', C.chest(), 40, { speed: 4 }); S.cast && S.cast('nature', C.home, 1); });
    C.every(1.2, 2.6, 0.35, () => C.hit(30, 'leaf')); C.span(2.8, 3.2, (k) => vines.forEach(m => m.scale.setScalar(Math.max(0.01, 1 - k)))); return 3.4; },
  shaman(C) { // Wrathstorm: storm clouds boil up over your head and lightning strikes you again and again
    C.at(0.1, () => setPose(C, 'up')); const cloud = new THREE.Group(); for (let i = 0; i < 9; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(1 + Math.random() * 0.8, 10, 8), std('#3a3c48', 1)); s.position.set((Math.random() - 0.5) * 5, Math.random() * 0.8, (Math.random() - 0.5) * 5); cloud.add(s); } cloud.position.copy(C.home).setY(C.home.y + 9); cloud.scale.setScalar(0.01); C.add(cloud);
    C.span(0.3, 0.9, (k) => cloud.scale.setScalar(Math.max(0.01, ease(k)))); for (const tt of [1.0, 1.35, 1.6, 1.9, 2.15, 2.5]) C.at(tt, () => { bolt(C, C.home.clone().setY(C.home.y + 9), C.chest(), '#cfe4ff'); V.burst('lightning', C.chest(), 25, { speed: 6 }); C.hit(55, 'lightning'); V.addShake(0.4); });
    C.span(2.7, 3.2, (k) => cloud.scale.setScalar(Math.max(0.01, 1 - k))); return 3.4; },
  bard(C) { // Cacophony: a wall-shaking chord; rings of sound hammer you and leave you reeling, seeing stars
    C.at(0.1, () => setPose(C, 'aim')); C.every(0.3, 2.0, 0.22, () => { V.ring(C.ch.root.position.clone().setY(C.cp.y + 0.6), 11, '#ffb0ff', 0.7); S.hit && S.hit('blunt', C.cp, 0.3); });
    C.at(0.6, () => playNotes(G.scene, C.P, '#ff80e0', 12)); C.every(0.7, 2.0, 0.22, () => { C.hit(25, 'arcane'); V.addShake(0.2); }); C.every(1.0, 2.8, 0.08, () => { const a = C.t * 6; V.emit('spark', C.P.pos.clone().add(V3(Math.cos(a) * 0.35, 2.0, Math.sin(a) * 0.35)), { speed: 0.2, size: 0.2, life: 0.4 }); });
    C.span(1.0, 2.8, (k, t) => { C.roll = Math.sin(t * 3) * 0.06 * (1 - k); }); return 3.1; },
  monk(C) { // Thousand Fists: he crosses the gap in a blink and hits you a hundred times, then launches you skyward
    C.at(0.25, () => { V.burst('dust', C.cp, 20, { speed: 3 }); }); const to = C.home.clone().lerp(C.cp, 0.13); C.moveCaster(to, 0.3, 0.5); C.at(0.55, () => setPose(C, 'punch'));
    C.every(0.6, 2.0, 0.06, () => { const c = C.chest(); c.x += (Math.random() - 0.5) * 0.4; c.y += (Math.random() - 0.5) * 0.5; V.burst('spark', c, 4, { speed: 4 }); V.sphereFlash(c, 0.35, '#fff0c0', 0.1); }); C.every(0.6, 2.0, 0.2, () => C.hit(18, 'spark'));
    C.at(2.05, () => { setPose(C, 'uppercut'); C.hit(140, 'blood'); C.knock(3.2, 1.2, 1); V.ring(C.home, 5, '#ffd860', 0.5); V.addShake(1); }); C.camFocus = 0.7; return 3.6; },
  ranger(C) { // Rain of Arrows: she looses into the sky and a storm of arrows comes down all around you
    C.at(0.1, () => setPose(C, 'aimUp')); C.every(0.2, 0.7, 0.12, () => V.burst('spark', C.ch.root.position.clone().setY(C.cp.y + 2.2), 4, { speed: 2 }));
    for (let i = 0; i < 40; i++) { const t0 = 0.8 + Math.random() * 1.6, a = Math.random() * Math.PI * 2, r = Math.random() * 3.2, to = V3(C.home.x + Math.cos(a) * r, C.home.y + 0.3, C.home.z + Math.sin(a) * r), from = to.clone().add(V3(0, 16, 0)), m = arrowMesh();
      fly(C, m, from, to, t0, t0 + 0.32, 0, () => V.burst('dust', to, 4, { speed: 1.5 })); }
    C.every(0.9, 2.4, 0.25, () => C.hit(35, 'blood')); return 3.4; },
  musketeer(C) { // Deadeye: a red sight-line settles on your head... and one perfect shot
    C.at(0.1, () => setPose(C, 'aim')); const las = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 5), glow('#ff2020', 0.9)); C.add(las); las.visible = false;
    C.span(0.3, 1.7, (k, t) => { las.visible = Math.sin(t * 40) > -0.7; const a = C.ch.root.position.clone().setY(C.cp.y + 1.45), b = C.P.pos.clone().setY(C.P.pos.y + 1.65); b.x += Math.sin(t * 5) * 0.3 * (1 - k); b.y += Math.cos(t * 4) * 0.2 * (1 - k); las.position.copy(a).lerp(b, 0.5); las.scale.y = a.distanceTo(b); las.quaternion.setFromUnitVectors(V3(0, 1, 0), b.clone().sub(a).normalize()); });
    C.at(1.75, () => { las.visible = false; const a = C.ch.root.position.clone().setY(C.cp.y + 1.45), b = C.P.pos.clone().setY(C.P.pos.y + 1.65); V.burst('fire', a, 20, { speed: 4 }); V.burst('smoke', a, 25, { speed: 2 }); V.light(a, '#ffb060', 8, 0.2); S.gun ? S.gun(a) : S.explode && S.explode(a, 0.5); bolt(C, a, b, '#ffd890'); V.burst('blood', b, 50, { speed: 7 }); C.hit(380, 'blood'); C.knock(0.5, 0.6, 2.5); V.addShake(1); });
    C.camFocus = 0.45; return 3.0; },
  blunderbuss(C) { // Great Keg: a powder keg sails over, bounces to your feet, fizzes... and goes up
    C.at(0.3, () => setPose(C, 'throw')); const keg = new THREE.Group(); keg.add(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.6, 12), std('#7a4a22'))); for (const y of [-0.2, 0.2]) { const b = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.025, 6, 16), std('#3a3a3a', 0.4, 0.8)); b.rotation.x = Math.PI / 2; b.position.y = y; keg.add(b); }
    const to = C.home.clone().lerp(C.cp, 0.08).setY(C.home.y + 0.32); fly(C, keg, C.cp.clone().setY(C.cp.y + 2), to, 0.45, 1.25, 4); C.span(0.45, 1.25, (k) => { keg.rotation.x = k * 8; }); C.at(1.25, () => { V.burst('dust', to, 15, { speed: 2 }); S.hit && S.hit('wood', to, 1); });
    C.every(1.3, 2.0, 0.05, () => V.emit('spark', to.clone().setY(to.y + 0.4), { speed: 2, vy: 2, size: 0.15 })); C.span(1.3, 2.0, (k, t) => { keg.position.y = to.y + Math.abs(Math.sin(t * 14)) * 0.08; });
    C.at(2.05, () => { keg.visible = false; V.burst('fire', to, 120, { speed: 10 }); V.burst('smoke', to, 60, { speed: 5 }); V.sphereFlash(to, 4, '#ffb040', 0.4); V.ring(to, 8, '#ff8030', 0.6); V.light(to, '#ff9040', 12, 0.6, 25); S.explode && S.explode(to, 1.2); C.hit(330, 'fire'); C.knock(3.5, 1.3, 3); V.addShake(1.2); }); return 3.9; },
  wizard(C) { // Time Stop: a sphere of frozen time swallows you; the clock stands still; then it shatters
    C.at(0.1, () => setPose(C, 'aim')); const sph = new THREE.Mesh(new THREE.SphereGeometry(2.2, 24, 16), glow('#60a8ff', 0.25)); sph.position.copy(C.home).setY(C.home.y + 1); sph.scale.setScalar(0.01); C.add(sph);
    const clock = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.04, 6, 40), glow('#bfe0ff', 0.8)); clock.position.copy(C.home).setY(C.home.y + 2.8); clock.rotation.x = Math.PI / 2; C.add(clock); const hand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.1, 0.02), glow('#ffffff', 0.9)); hand.position.y = 0.55; const hg = new THREE.Group(); hg.add(hand); hg.position.copy(clock.position); hg.rotation.x = -Math.PI / 2; C.add(hg);
    C.span(0.4, 0.9, (k) => sph.scale.setScalar(Math.max(0.01, ease(k)))); C.span(0.4, 1.1, (k, t) => { hg.rotation.z = -t * 6; }); C.at(1.0, () => { V.burst('frost', C.chest(), 40, { speed: 3 }); S.cast && S.cast('frost', C.home, 1); });
    C.every(1.0, 2.5, 0.1, () => V.emit('frost', C.home.clone().add(V3((Math.random() - 0.5) * 3, Math.random() * 2.5, (Math.random() - 0.5) * 3)), { speed: 0, size: 0.18, life: 1.5 }));
    C.at(2.6, () => { sph.visible = false; clock.visible = false; hg.visible = false; V.burst('frost', C.chest(), 90, { speed: 8 }); V.sphereFlash(C.chest(), 3, '#cfe8ff', 0.3); C.hit(240, 'frost'); C.knock(0.4, 0.4); V.addShake(0.6); }); return 3.2; },
  rogue(C) { // Shadow Dance: he vanishes, then strikes from every side at once, a blur of shadows, and ends behind you
    C.at(0.3, () => { V.burst('smoke', C.ch.root.position.clone().setY(C.cp.y + 1), 40, { speed: 3 }); C.ch.root.visible = false; });
    for (let i = 0; i < 6; i++) { const tt = 0.6 + i * 0.3; C.at(tt, () => { const a = Math.random() * Math.PI * 2, p = C.home.clone().add(V3(Math.cos(a) * 1.3, 0, Math.sin(a) * 1.3)); C.ch.root.visible = true; C.ch.root.position.copy(p); V.burst('shadow', p.clone().setY(p.y + 1), 20, { speed: 2 }); C.hit(45, 'blood'); setPose(C, 'slam'); });
      C.at(tt + 0.18, () => { C.ch.root.visible = false; }); }
    C.at(2.5, () => { const b = C.home.clone().add(V3(-Math.sin(C.P.yaw) * 1.1, 0, -Math.cos(C.P.yaw) * 1.1)); C.ch.root.visible = true; C.ch.root.position.copy(b); setPose(C, 'aim'); C.hit(160, 'blood'); V.burst('blood', C.chest(), 50, { speed: 5 }); V.addShake(0.6); }); C.camFocus = 0.75; return 3.3; },
  elementalist(C) { // Pure Element: he tears a burning meteor out of the sky and drops it on you
    C.at(0.1, () => setPose(C, 'up')); const met = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12), std('#3a1a0a', 0.6, 0, { emissive: '#ff5010', emissiveIntensity: 1.2 })); const halo = new THREE.Mesh(new THREE.SphereGeometry(1.7, 16, 12), glow('#ff8030', 0.5)); met.add(halo);
    const from = C.home.clone().add(V3(8, 32, -6)), to = C.home.clone().setY(C.home.y + 0.8); fly(C, met, from, to, 0.6, 1.7); C.every(0.6, 1.7, 0.03, () => { if (met.visible) V.emit('fire', met.position, { speed: 2, size: 0.9, life: 0.6, radius: 1.2 }); });
    C.at(1.7, () => { met.visible = false; V.burst('fire', to, 160, { speed: 12 }); V.burst('lava', to, 50, { speed: 8 }); V.burst('smoke', to, 60, { speed: 5 }); V.sphereFlash(to, 6, '#ffa040', 0.5); V.ring(to, 12, '#ff6020', 0.8); V.light(to, '#ff7030', 14, 0.9, 30); S.explode && S.explode(to, 1.4); C.hit(400, 'fire'); C.knock(4, 1.4, 4); V.addShake(1.2); });
    const scorch = new THREE.Mesh(new THREE.CircleGeometry(3.5, 32), basic('#120804', { transparent: true, opacity: 0 })); scorch.rotation.x = -Math.PI / 2; scorch.position.copy(C.home).setY(C.home.y + 0.04); C.add(scorch); C.span(1.7, 1.9, (k) => { scorch.material.opacity = 0.8 * k; }); return 4.0; },
  enchanter(C) { // Mind Shatter: spirals of violet light wind round your head until your mind cracks like glass
    C.at(0.1, () => setPose(C, 'aim')); const rings = []; for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.5 + i * 0.25, 0.03, 6, 30), glow('#d070ff', 0.8)); C.add(r); rings.push(r); }
    C.span(0.4, 1.9, (k, t) => { rings.forEach((r, i) => { r.position.copy(C.P.pos).setY(C.P.pos.y + 1.75); r.rotation.set(t * (2 + i), t * (3 - i), 0); r.scale.setScalar(1.4 - k * 0.8); }); C.roll = Math.sin(t * 2.5) * 0.08 * k; });
    C.every(0.4, 1.9, 0.08, () => V.emit('arcane', C.P.pos.clone().setY(C.P.pos.y + 1.75), { speed: 1.5, size: 0.2 }));
    C.at(1.95, () => { rings.forEach(r => { r.visible = false; }); V.burst('arcane', C.P.pos.clone().setY(C.P.pos.y + 1.75), 90, { speed: 8 }); V.sphereFlash(C.P.pos.clone().setY(C.P.pos.y + 1.75), 2.2, '#f0b0ff', 0.3); C.hit(260, 'arcane'); C.roll = 0; V.addShake(0.7); }); C.camFocus = 0.75; return 3.0; },
  beastmaster(C) { // Dire Beast: a huge shadow wolf answers his howl, charges and pounces on you
    C.at(0.1, () => setPose(C, 'up')); const w = new THREE.Group(), fur = std('#2a2a30', 0.95), eye = basic('#ff3020');
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.8, 14, 10), fur); body.scale.set(0.8, 0.75, 1.6); body.position.y = 1.3; w.add(body); const head = new THREE.Group(); head.position.set(0, 1.7, 1.25); w.add(head); const hm = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), fur); hm.scale.set(0.9, 0.85, 1.2); head.add(hm); const sn = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.5), fur); sn.position.set(0, -0.08, 0.45); head.add(sn);
    for (const x of [-0.16, 0.16]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), eye); e.position.set(x, 0.1, 0.36); head.add(e); const ear = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 4), fur); ear.position.set(x * 1.4, 0.4, 0); head.add(ear); }
    const legs = []; for (const [x, z] of [[-0.35, 0.8], [0.35, 0.8], [-0.35, -0.8], [0.35, -0.8]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.09, 1.1, 6), fur); l.position.set(x, 0.55, z); w.add(l); legs.push(l); }
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.15, 1.0, 6), fur); tail.position.set(0, 1.5, -1.5); tail.rotation.x = -2.2; w.add(tail);
    const start = C.cp.clone().add(V3(1.6, 0, 0)), stop = C.home.clone().lerp(start, 0.18); w.position.copy(start); w.rotation.y = Math.atan2(C.home.x - start.x, C.home.z - start.z); w.scale.setScalar(0.01); C.add(w); addOutline(w, '#8a0c06');
    C.span(0.3, 0.7, (k) => { w.scale.setScalar(Math.max(0.01, ease(k) * 1.3)); }); C.at(0.3, () => { V.burst('shadow', start.clone().setY(start.y + 1), 40, { speed: 3 }); S.growl && S.growl('wolf', start, 0.8); });
    C.span(0.8, 1.5, (k, t) => { w.position.lerpVectors(start, stop, k); w.position.y = start.y + Math.abs(Math.sin(t * 16)) * 0.25; legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 16 + i * 1.6) * 0.7; }); });
    C.span(1.5, 1.8, (k) => { w.position.y = stop.y + Math.sin(k * Math.PI) * 1.4; w.rotation.x = -0.4 * Math.sin(k * Math.PI); }); C.at(1.75, () => { C.hit(300, 'blood'); C.knock(0.3, 0.5, 1.5); V.burst('blood', C.chest(), 60, { speed: 6 }); S.growl && S.growl('wolf', C.home, 1); V.addShake(0.9); });
    C.span(1.8, 3.0, (k, t) => { head.rotation.x = Math.sin(t * 9) * 0.25; }); C.camFocus = 0.7; return 3.4; },
  generic(C) { C.at(0.2, () => setPose(C, 'up')); C.at(1.0, () => { V.burst('arcane', C.chest(), 60, { speed: 6 }); C.hit(200); C.knock(1, 0.7); }); return 2.4; },
};
