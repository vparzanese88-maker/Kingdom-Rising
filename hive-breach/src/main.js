// Hive Breach: first-person tower defense. Marines hold the hub against waves of aliens marching down the track.
import * as THREE from 'three';
import * as M from './models.js';
import { SIDEARM, SPECIALS, MISSILE, CLASSES, TURRETS, MAX_TURRETS, UPGRADES, UPG_PRICES, ALIENS, WAVES, MAPS, BOUNDS, ALLIES, DROP_EVERY, DROP_COST, SQUAD, SQUAD_COST } from './data.js';
import { buildWorld, placeError, LIQUID } from './world.js';
import { Sim, upgradeCost, tStat } from './sim.js';
import { Net, VER } from './net.js';
import { Audio } from './audio.js';
import { Music } from './music.js';
import { icon } from './icons.js';
import { Explore, buildFOB, cinematic, victoryScene, vtol as vtolModel, rover as roverModel } from './explore.js';

const $ = id => document.getElementById(id);
const canvas = $('game'), renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(1.5, devicePixelRatio)); renderer.shadowMap.enabled = true; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(75, 1, 0.05, 1500); scene.add(camera);
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
const audio = new Audio(), music = new Music(audio); window.hbMusic = music;
addEventListener('pointerdown', () => { audio.unlock(); music.start(); const h = document.getElementById('soundHint'); if (h) h.hidden = true; });
addEventListener('keydown', () => { audio.unlock(); music.start(); });

// ---------------------------------------------------------------- input
const keys = {}, hits = {}; let mouseL = false, mouseR = false, clickL = false, clickR = false;
addEventListener('keydown', e => { if (e.target.tagName === 'INPUT') return; if (!keys[e.code]) hits[e.code] = 1; keys[e.code] = 1; if (['Tab', 'Space'].includes(e.code)) e.preventDefault(); });
addEventListener('keyup', e => { keys[e.code] = 0; });
addEventListener('blur', () => { for (const k in keys) keys[k] = 0; mouseL = mouseR = false; });
const locked = () => document.pointerLockElement === canvas;
canvas.addEventListener('mousedown', e => { audio.unlock(); if (!locked()) { if (G.on && !G.shop && !G.mmap && !G.settings) canvas.requestPointerLock(); return; } if (e.button === 0) { mouseL = clickL = true; } if (e.button === 2) { mouseR = clickR = true; } });
addEventListener('mouseup', e => { if (e.button === 0) mouseL = false; if (e.button === 2) mouseR = false; });
addEventListener('contextmenu', e => e.preventDefault());
let sens = +(localStorage.getItem('hb-sens') || 1);
addEventListener('mousemove', e => { if (!locked() || !G.on) return; const k = 0.0022 * sens * (G.me && G.me.scope ? 0.3 * SET.zoomSens : G.me && G.me.ads ? 0.65 * SET.zoomSens : 1); G.me.yaw -= e.movementX * k; G.me.pitch = Math.max(-1.5, Math.min(1.5, G.me.pitch - e.movementY * k * (SET.invert ? -1 : 1))); });
document.addEventListener('pointerlockchange', () => { if (!locked()) mouseL = mouseR = false; });

// ---------------------------------------------------------------- game state
// key bindings (changeable in Settings) and other settings, saved in this browser
const KB_DEFAULT = { w1: 'Digit1', w2: 'Digit2', w3: 'Digit3', w4: 'Digit4', w5: 'Digit5', w6: 'Digit6', third: 'KeyV', grenade: 'KeyG', use: 'KeyE', forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', sprint: 'ShiftLeft', kneel: 'KeyC', prone: 'KeyZ', reload: 'KeyR', sentry: 'KeyT', defense: 'KeyF', special: 'KeyX', upgrade: 'KeyU', sell: 'KeyY', armory: 'KeyB', map: 'KeyM', kit: 'KeyH', music: 'KeyN', scores: 'Tab', info: 'KeyK' };
const KB_NAMES = { w1: 'Main weapon', w2: 'Side arm', w3: 'Welding torch', w4: 'Grenade / class item', info: 'Gear guide: what everything does', w5: 'Field dressing', w6: 'Heal beam (Medic)', third: 'Build: third structure', grenade: 'Quick-throw grenade / item', use: 'Use: pick up turret, salvage, vehicles', forward: 'Move forward', back: 'Move back', left: 'Move left', right: 'Move right', jump: 'Jump', sprint: 'Sprint', kneel: 'Kneel (hold)', prone: 'Go prone', reload: 'Reload', sentry: 'Build: turret', defense: 'Build: device', special: 'Use special',  upgrade: 'Upgrade turret', sell: 'Sell turret', armory: 'Recruitment (at the comms console)', map: 'Live map', kit: 'Class card', music: 'Music on/off', scores: 'Scores (hold)' };
const KB = Object.assign({}, KB_DEFAULT); try { Object.assign(KB, JSON.parse(localStorage.getItem('hb-keys4') || '{}')); } catch (e) { }
const SET = { quality: 'medium', fov: 75, fps: false, invert: false, zoomSens: 1, master: 1 }; try { Object.assign(SET, JSON.parse(localStorage.getItem('hb-set') || '{}')); } catch (e) { }
function saveSettings() { try { localStorage.setItem('hb-set', JSON.stringify(SET)); localStorage.setItem('hb-keys4', JSON.stringify(KB)); } catch (e) { } }
function applyQuality() { const q = SET.quality; renderer.setPixelRatio(Math.min(q === 'low' ? 0.75 : q === 'high' ? 1.75 : 1.25, devicePixelRatio)); resize(); if (G.W) G.W.sun.castShadow = q !== 'low'; G.maxParts = q === 'low' ? 120 : q === 'high' ? 320 : 220; }
const G = { pings: [], on: false, mode: 'solo', myId: 'me', name: 'Marine', cls: 'assault', map: 'mars', W: null, sim: null, net: null, snap: null, out: [], time: 0, shop: false, me: null };
window.G = G; G.scene = scene;
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } };

// The current battle as plain lists, the same shape whether this game runs it or receives it.
function state() {
  if (G.sim) { const s = G.sim; return { w: s.wave, ph: s.phase, tm: s.timer, hub: s.hub, en: s.endless, n: s.players.size, left: s.aliens.filter(a => !ALIENS[a.type].static).length, lt: Math.ceil(s.lvlT || 0), wx: s.stormI || 0, wa: s.windA || 0, L: s.allies, C: s.cmd, open: s.hiveOpen(), el: Math.floor(s.el || 0), A: s.aliens, T: s.turrets, P: [...s.players.values()], O: s.pods, I: s.items, SC: s.scrap, M: s.ammo.map(c => ({ id: c.id, x: c.x, z: c.z, life: c.life })), Z: s.spores, K: s.pools, D: s.drones.map(d => ({ id: d.id, x: d.x + Math.cos(d.a) * 8, y: d.y + 14, z: d.z + Math.sin(d.a) * 8, tg: d.tg })), Q: s.medz, S2: s.domes }; }
  return G.snap;
}
function decode(m) {
  return {
    w: m.w, ph: m.ph, tm: m.tm, hub: m.hub, en: m.en, left: m.left, lt: m.lt, wx: m.wx, wa: m.wa || 0, n: m.n, C: m.C, open: m.open,
    L: m.L.map(a => ({ id: a[0], type: a[1], x: a[2], y: a[3], z: a[4], hp: a[5], mhp: a[6], ry: a[7], tg: a[8] })),
    A: m.A.map(a => ({ id: a[0], type: a[1], x: a[2], y: a[3], z: a[4], hp: a[5], mhp: a[6], ry: a[7], stun: a[8], tg: a[9], rv: a[10] })),
    T: m.T.map(t => ({ id: t[0], kind: t[1], owner: t[2], x: t[3], z: t[4], ry: t[5], lvl: t[6], hp: t[7], mhp: t[8], tg: t[9], y: t[10], b: t[11], bt: t[12], fresh: t[13], ch: t[14], carry: t[15], up: t[16], s: t[1] === 'barricade' ? G.W.path.near(t[3], t[4]).s : 0 })),
    P: m.P.map(p => ({ id: p[0], name: p[1], cls: p[2], x: p[3], y: p[4], z: p[5], yaw: p[6], hp: p[7], mhp: p[8], gold: p[9], ups: p[10], dead: p[11], kills: p[12], sp: p[13], rt: p[14], kn: p[15], special: p[16], acd: p[17], adrT: p[18], stimT: p[19], rv: p[20], cold: p[21], toxic: p[22], veh: p[23], items: p[24], kits: p[25], pw: p[26], dr: p[27], scrap: p[28], buf: p[29] || {} })),
    O: m.O.map(o => ({ id: o[0], x: o[1], z: o[2], life: o[3], land: o[4] })), el: m.el, I: (m.I || []).map(i => ({ id: i[0], kind: i[1], x: i[2], z: i[3] })), SC: (m.SC || []).map(c => ({ id: c[0], x: c[1], z: c[2] })),
    M: (m.M || []).map(c => ({ id: c[0], x: c[1], z: c[2], life: c[3] })), Z: (m.Z || []).map(c => ({ x: c[0], z: c[1], r: c[2] })), K: (m.K || []).map(q => ({ x: q[0], y: q[1], z: q[2], r: q[3], fire: q[4] })), D: (m.D || []).map(d => ({ id: d[0], x: d[1], y: d[2], z: d[3], tg: d[4] })), Q: (m.Q || []).map(q => ({ id: q[0], x: q[1], y: q[2], z: q[3], r: q[4], t: q[5] })), S2: (m.S2 || []).map(d => ({ x: d[0], y: d[1], z: d[2], r: d[3] })),
  };
}
const mine = S => S && S.P.find(p => p.id === G.myId);
function req(r) { if (G.mode === 'client') G.net.send({ t: 'req', r }); else G.sim.request(G.myId, r); }
// Something happened that everyone should see or hear.
function emit(e) { fx(e); if (G.mode === 'host') G.out.push(e); }

// ---------------------------------------------------------------- effects
const FX = { parts: [], tracers: [], booms: [], proj: [], bolts: [] };
const partGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14), trGeo = new THREE.BoxGeometry(1, 1, 1);
function burst(x, y, z, color, n, sp, life, size = 1) {
  const m = M.mat(color, { e: color, ei: 0.6 });
  for (let i = 0; i < n; i++) {
    let p = FX.parts.find(q => !q.alive); if (!p) { if (FX.parts.length > (G.maxParts || 220)) return; p = { mesh: new THREE.Mesh(partGeo, m) }; scene.add(p.mesh); FX.parts.push(p); }
    p.alive = true; p.casing = 0; p.mesh.visible = true; p.mesh.material = m; p.mesh.position.set(x, y, z); p.mesh.scale.setScalar(size * (0.6 + Math.random() * 0.8));
    p.gy = G.W ? G.W.ground(x, z, y + 0.5) + 0.07 : 0.07; p.vx = (Math.random() - 0.5) * sp * 2; p.vy = Math.random() * sp * 1.4; p.vz = (Math.random() - 0.5) * sp * 2; p.life = life * (0.6 + Math.random() * 0.6);
  }
}
const trMats = {}; const trMat = c => trMats[c] || (trMats[c] = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
function tracer(a, b, color = 0xffe080, life = 0.05, w = 0.04) {
  let t = FX.tracers.find(q => !q.alive); if (!t) { if (FX.tracers.length > 120) return; t = { mesh: new THREE.Mesh(trGeo, trMat(color)) }; t.mesh.castShadow = false; scene.add(t.mesh); FX.tracers.push(t); }
  const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); t.alive = true; t.life = life; t.mesh.visible = true; t.mesh.material = trMat(color);
  t.mesh.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); t.mesh.scale.set(w, w, d); t.mesh.lookAt(b[0], b[1], b[2]);
}
const lights = []; for (let i = 0; i < 3; i++) { const L = new THREE.PointLight(0xffa040, 0, 26); scene.add(L); lights.push({ L, t: 0 }); }
function flashLight(x, y, z, power, life = 0.12) { const l = lights.reduce((a, b) => a.t < b.t ? a : b); l.L.position.set(x, y, z); l.L.intensity = power; l.t = life; l.life = life; l.p = power; }
function boomFx(x, y, z, r, small) {
  r = r || 3; const m = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffb050, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.position.set(x, y, z); scene.add(m); FX.booms.push({ mesh: m, t: 0, r });
  const gy = G.W.ground(x, z, y + 1), ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 32), new THREE.MeshBasicMaterial({ color: 0xffd0a0, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.set(x, gy + 0.2, z); scene.add(ring); FX.booms.push({ mesh: ring, t: 0, r: r * 2.2, ring: 1 });
  burst(x, y + 0.3, z, 0xff8020, small ? 6 : 22, 8, 0.6); burst(x, y + 0.3, z, 0xffe080, small ? 3 : 10, 11, 0.35, 0.7); smoke(x, y + 0.5, z, small ? 4 : 12, r);
  burst(x, y + 0.3, z, 0x3a2a20, small ? 3 : 10, 6, 1.4, 1.4);
  flashLight(x, y + 2, z, small ? 40 : 160, 0.18);
  const d = dist(x, z); audio.gun('boom', (small ? 0.5 : 1) * vol(d * 0.7), 1, Math.min(1, d / 60)); if (d < r + 10) G.shake = Math.max(G.shake, small ? 0.25 : 0.7 * (1 - d / (r + 10)) + 0.2);
}
// smoke drifts up and shrinks away
function smoke(x, y, z, n, r) { const m = M.mat(0x4a4440, { r: 1 }); for (let i = 0; i < n; i++) { let p = FX.parts.find(q => !q.alive); if (!p) { if (FX.parts.length > (G.maxParts || 220)) return; p = { mesh: new THREE.Mesh(partGeo, m) }; scene.add(p.mesh); FX.parts.push(p); } p.alive = true; p.mesh.visible = true; p.mesh.material = m; p.mesh.position.set(x + (Math.random() - 0.5) * r, y + Math.random(), z + (Math.random() - 0.5) * r); p.s0 = 4 + Math.random() * 5; p.mesh.scale.setScalar(p.s0); p.vx = (Math.random() - 0.5) * 1.5; p.vy = 1.5 + Math.random() * 2; p.vz = (Math.random() - 0.5) * 1.5; p.life = p.l0 = 1.6 + Math.random() * 1.4; p.smoke = true; p.gy = -99; } }
// a muzzle flash anywhere in the world (friends, turrets, reinforcements)
const flashTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,230,1)'); gr.addColorStop(0.25, 'rgba(255,200,90,.9)'); gr.addColorStop(1, 'rgba(255,120,20,0)'); g.fillStyle = gr; g.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283, rr = i % 2 ? 12 : 32; g.lineTo(32 + Math.cos(a) * rr, 32 + Math.sin(a) * rr); } g.fill(); return new THREE.CanvasTexture(cv); })();
const flashes = []; for (let i = 0; i < 24; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); sp.visible = false; scene.add(sp); flashes.push({ sp, t: 0 }); }
function flashAt(p, size = 1) { const f = flashes.find(q => q.t <= 0) || flashes[0]; f.t = 0.05; f.sp.visible = true; f.sp.position.set(p[0], p[1], p[2]); f.sp.scale.setScalar(size * (0.8 + Math.random() * 0.6)); f.sp.material.rotation = Math.random() * 6; }
function updateFlashes(dt) { for (const f of flashes) if (f.t > 0) { f.t -= dt; if (f.t <= 0) f.sp.visible = false; } for (const l of lights) if (l.t > 0) { l.t -= dt; l.L.intensity = Math.max(0, l.p * l.t / l.life); } }
function bolt(pts) {
  const v = []; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; let p = a; for (let k = 1; k <= 5; k++) { const f = k / 5, q = k === 5 ? b : [a[0] + (b[0] - a[0]) * f + (Math.random() - 0.5) * 0.8, a[1] + (b[1] - a[1]) * f + (Math.random() - 0.5) * 0.8, a[2] + (b[2] - a[2]) * f + (Math.random() - 0.5) * 0.8]; v.push(...p, ...q); p = q; } }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  const l = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x9fe0ff, transparent: true, blending: THREE.AdditiveBlending })); scene.add(l); FX.bolts.push({ mesh: l, t: 0.16 });
  for (let i = 1; i < pts.length; i++) burst(pts[i][0], pts[i][1], pts[i][2], 0x80d0ff, 3, 3, 0.25);
}
// something that flies from a to b in t seconds (spit globs, missiles, friends' rockets)
function flyer(kind, a, b, t, tgId) {
  const m = new THREE.Group();
  if (kind === 'spit') M.S(m, 0.25, 0x90ff30, 0, 0, 0, 1, 1, 1, { e: 0x60c000 });
  else if (kind === 'gspit') M.S(m, 0.35, 0xff3060, 0, 0, 0, 1, 1, 1, { e: 0xff1040 });
  else if (kind === 'qspit') M.S(m, 0.45, 0xff40ff, 0, 0, 0, 1, 1, 1, { e: 0xc000c0 });
  else { M.C(m, 0.1, 0.1, 0.7, 0xdddddd, 0, 0, 0).rotation.x = Math.PI / 2; M.S(m, 0.14, 0xffa040, 0, 0, 0.4, 1, 1, 1, { e: 0xff6000 }); }
  m.position.set(...a); scene.add(m); FX.proj.push({ mesh: m, kind, a, b, t0: t, t: 0, tg: tgId });
}
function updateFx(dt) {
  for (const p of FX.parts) if (p.alive) { p.life -= dt; if (p.life <= 0) { p.alive = false; p.smoke = false; p.mesh.visible = false; continue; } if (p.smoke) { p.vx *= 0.98; p.vz *= 0.98; p.mesh.scale.setScalar(p.s0 * (0.3 + 0.7 * p.life / p.l0)); p.mesh.position.x += p.vx * dt; p.mesh.position.y += p.vy * dt; p.mesh.position.z += p.vz * dt; continue; } p.vy -= 18 * dt; p.mesh.position.x += p.vx * dt; p.mesh.position.y += p.vy * dt; p.mesh.position.z += p.vz * dt; if (p.mesh.position.y < p.gy) { if (p.casing === 1) { p.casing = 2; if (dist(p.mesh.position.x, p.mesh.position.z) < 6) audio.sfx('tink', 0.5); } p.mesh.position.y = p.gy; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; } }
  for (const t of FX.tracers) if (t.alive) { t.life -= dt; if (t.life <= 0) { t.alive = false; t.mesh.visible = false; } }
  for (const b of FX.booms) { b.t += dt; const f = b.t / (b.ring ? 0.45 : 0.35); if (b.ring) b.mesh.scale.set(b.r * f, b.r * f, 1); else b.mesh.scale.setScalar(b.r * (0.3 + f)); if (!b.ring) b.mesh.material.color.setHSL(0.08 - f * 0.06, 1, 0.6 - f * 0.3); b.mesh.material.opacity = Math.max(0, 0.9 * (1 - f)); if (f >= 1) { scene.remove(b.mesh); b.mesh.geometry.dispose(); b.mesh.material.dispose(); b.dead = true; } }
  FX.booms = FX.booms.filter(b => !b.dead);
  for (const b of FX.bolts) { b.t -= dt; if (b.t <= 0) { scene.remove(b.mesh); b.mesh.geometry.dispose(); b.mesh.material.dispose(); b.dead = true; } }
  FX.bolts = FX.bolts.filter(b => !b.dead);
  for (const p of FX.proj) {
    if (p.met) continue; p.t += dt; const v = p.tg && view.aliens.get(p.tg); if (v) p.b = [v.x, v.y + 0.6, v.z];
    const f = Math.min(1, p.t / p.t0), arc = p.kind === 'msl' ? Math.sin(f * Math.PI) * 4 : p.kind.includes('spit') ? Math.sin(f * Math.PI) * 1.5 : 0;
    const x = p.a[0] + (p.b[0] - p.a[0]) * f, y = p.a[1] + (p.b[1] - p.a[1]) * f + arc, z = p.a[2] + (p.b[2] - p.a[2]) * f; p.mesh.lookAt(x, y, z); p.mesh.position.set(x, y, z); p.mesh.rotateY(Math.PI);
    if (p.kind !== 'spit' && p.kind !== 'qspit' && Math.random() < 0.7) burst(x, y, z, 0x707070, 1, 0.5, 0.5);
    if (f >= 1) { scene.remove(p.mesh); p.dead = true; if (p.kind.includes('spit')) burst(x, y, z, p.kind === 'qspit' ? 0xff40ff : 0x90ff30, 6, 3, 0.4); }
  }
  FX.proj = FX.proj.filter(p => !p.dead);
}
const dist = (x, z) => G.me ? Math.hypot(x - G.me.x, z - G.me.z) : 0;
const vol = d => Math.max(0, 1 - d / 70);

let lastHubMsg = 0;
function fx(e) {
  switch (e.k) {
    case 'toast': toast(e.m, e.big ? 5 : 3.5); break;
    case 'say': if (e.to === G.myId) { toast(e.m, 3); audio.sfx('nope'); } break;
    case 'boom': boomFx(e.x, e.y, e.z, e.r, e.small); break;
    case 'die': { if (e.id) died.add(e.id); splat(e.x, e.z, ALIENS[e.t].boss ? 4 : 1.3);
      const A = ALIENS[e.t]; burst(e.x, e.y + A.h * 0.5, e.z, 0x60ff40, A.boss ? 40 : 10, A.boss ? 10 : 5, 0.8, A.boss ? 3 : 1.2); burst(e.x, e.y + A.h * 0.5, e.z, 0x2a1a30, A.boss ? 20 : 5, 4, 1, A.boss ? 3 : 1.5); audio.sfx(A.boss ? 'boom' : 'kill', vol(dist(e.x, e.z)) * 0.6); break; }
    case 'spit': flyer(e.q === 2 ? 'gspit' : e.q ? 'qspit' : 'spit', e.a, e.b, e.q === 2 ? 0.3 : 0.45); audio.sfx('spit', vol(dist(e.a[0], e.a[2])) * 0.7); break;
    case 'rail': tracer(e.a, e.b, 0x80f0ff, 0.2, 0.18); tracer(e.a, e.b, 0xffffff, 0.08, 0.06); flashAt(e.a, 1.5); audio.sfx('rail', vol(dist(e.a[0], e.a[2]))); break;
    case 'zap': bolt(e.p); audio.sfx('zap', vol(dist(e.p[0][0], e.p[0][2])) * 0.7); break;
    case 'msl': flyer('msl', e.a, e.b, e.t, e.tg); audio.sfx('missile', vol(dist(e.a[0], e.a[2])) * 0.7); break;
    case 'tr': if (e.f !== G.myId) { if (Math.random() < 0.4) tracer(e.a, e.b, e.c || 0xffe080, 0.05, 0.04 * (e.p || 1)); flashAt(e.a, 0.8); burst(e.b[0], e.b[1], e.b[2], 0x909090, 1, 1, 0.2); const d = dist(e.a[0], e.a[2]); if (e.s !== '') audio.gun(e.s || 'rifle', vol(d), e.p || 1, Math.min(1, d / 50)); const pv = view.players.get(e.f); if (pv) pv.kick = 1; } break;
    case 'rk': if (e.f !== G.myId) { flyer('rk', e.a, e.b, e.t); flashAt(e.a, 1.4); const d = dist(e.a[0], e.a[2]); audio.gun('rocket', vol(d), 1, Math.min(1, d / 50)); } break;
    case 'gr': if (e.f !== G.myId) grenade(e.a, e.v, false); break;
    case 'wave': if (e.first) { banner('THE SWARM IS COMING', 'They will not stop: hold the hub, break the hive'); audio.sfx('alarm'); } else { banner(`THREAT LEVEL ${e.w}`, e.boss ? `WARNING: ${ALIENS[e.boss].name.toUpperCase()} INBOUND` : 'More and tougher aliens'); audio.sfx(e.boss ? 'alarm' : 'wave'); } break;
    case 'clear': banner(`WAVE ${e.w} CLEARED`, `+${e.b} gold · resupply`); audio.sfx('win'); break;
    case 'roar': audio.sfx('roar'); toast(`The ${ALIENS[e.t].name} has emerged from the hive!`, 4); G.shake = 0.6; break;
    case 'hubhit': G.hubFlash = 0.5; boomFx(e.x, e.y + 1, e.z, 2, 1); if (G.time - lastHubMsg > 6) { lastHubMsg = G.time; toast('The hub is under attack!', 2.5); audio.sfx('alarm', 0.5); } break;
    case 'pod': burst(e.x, G.W.top(e.x, e.z) + 1, e.z, 0xffd040, 14, 5, 0.6); if (e.by === G.myId) { audio.sfx('pickup'); toast(`Supply crate: +${e.g} gold` + (e.sp ? ` and a special: ${SPECIALS[e.sp].name} (press ${keyName(KB.special)})` : ''), 4); G.me.reserve = Math.min(stats().reserve, G.me.reserve + stats().reserve * 0.5); } break;
    case 'drop2': toast(`✈ Supply drop! ${e.n} crates parachuting in: grab them within 60 seconds of landing (yellow on the minimap).`, 5); audio.sfx('wave', 0.6); break;
    case 'podgone': smoke(e.x, G.W.top(e.x, e.z) + 0.5, e.z, 3, 1); break;
    case 'placed': audio.sfx('place', vol(dist(e.x, e.z))); burst(e.x, 0.5, e.z, 0x80c0ff, 8, 3, 0.4); break;
    case 'upg': audio.sfx('buy', 0.6); { const v = view.turrets.get(e.id); if (v) burst(v.mesh.position.x, 2, v.mesh.position.z, 0xffd040, 12, 3, 0.6); } break;
    case 'swapped': if (e.to === G.myId) { G.cls = e.cls; try { localStorage.setItem('hb-cls', e.cls); } catch (x) { } newMe(); G.me.reserve = stats().reserve; G.me.ammo = stats().mag; $('kit').innerHTML = `<h3>${CLASSES[G.cls].name}</h3>` + kitHTML(G.cls) + '<p class="small">H hides this card · K full gear guide</p>'; audio.sfx('buy'); toast(`You are now a ${CLASSES[e.cls].name}` + (e.n ? ` · ${e.n} structure${e.n > 1 ? 's' : ''} sold for ${e.refund} gold` : ''), 4); } break;
    case 'bought': if (e.to === G.myId) audio.sfx('buy'); break;
    case 'bite': audio.sfx('screech', vol(dist(e.x, e.z)) * 0.4); for (const v of view.aliens.values()) if (Math.abs(v.x - e.x) < 0.6 && Math.abs(v.z - e.z) < 0.6) v.lunge = 0.25; break;
    case 'aggro': if (e.to === G.myId) audio.sfx('screech', 0.7); break;
    case 'hitp': if (e.to === G.myId) hitFrom(e.x, e.z); break;
    case 'tatk': G.pings.push({ x: e.x, z: e.z, t: 3 }); { const v = view.turrets.get(e.id); if (v) v.alert = 3; } if (e.o === G.myId) { toast(`⚠ Your ${TURRETS[e.kind].name} is under attack!`, 3); audio.sfx('alarm', 0.35); } break;
    case 'hatch': burst(e.x, 1 + G.W.top(e.x, e.z), e.z, 0x80ff40, 16, 4, 0.6); audio.sfx('roar', vol(dist(e.x, e.z)) * 0.5); if (dist(e.x, e.z) < 45) toast('A nest is hatching crawlers nearby!', 2.5); break;
    case 'meteor': meteor(e); break;
    case 'alarm': audio.sfx('alarm'); break;
    case 'fob': startFob(); break;
    case 'beam': if (!(e.torch && e.f === G.myId)) { tracer(e.a, e.b, e.c, 0.12, e.torch ? 0.08 : 0.12); burst(e.b[0], e.b[1], e.b[2], e.c, 2, 1.5, 0.3); if (e.f === G.myId && Math.random() < 0.3) audio.sfx(e.torch ? 'torch' : 'heal', 0.4); } break;
    case 'dressed': if (e.to === G.myId) { audio.sfx('heal'); toast('Field dressing: +40 health', 2); } break;
    case 'kit': if (e.to === G.myId) toast(`Turret kit picked up (${e.n}/2)`, 1.5); break;
    case 'carry': case 'dropped': audio.sfx('place', vol(dist(e.x ?? G.me.x, e.z ?? G.me.z)) * 0.7); break;
    case 'stowed': if (e.to === G.myId) toast(`${e.n} back in your pack`, 1.5); break;
    case 'scrap': if (e.to === G.myId) { audio.sfx('tink', 0.9); G.scrapFlash = 0.5; } break;
    case 'ammo': if (e.to === G.myId) { refillAmmo(1); audio.sfx('pickup'); toast('Ammo: fully stocked.', 2); } break;
    case 'resup': if (e.to === G.myId) { refillAmmo(e.f); if (!G.resupT || G.time - G.resupT > 6) { G.resupT = G.time; toast('Forward Resupply: restocking slowly…', 2); } } break;
    case 'pickup': if (e.to === G.myId) { audio.sfx('heal'); toast('Health kit: +60 health', 2); } break;
    case 'ability': abilityFx(e); break;
    case 'mortar': flyer('spit', e.a, e.b, e.t); audio.sfx('rocket', vol(dist(e.a[0], e.a[2])) * 0.5); break;
    case 'tmiss': tacMissile(e); break;
    case 'nuke': boomFx(e.x, e.y + 1, e.z, 9); boomFx(e.x + 4, e.y + 2, e.z - 3, 6); boomFx(e.x - 4, e.y + 1, e.z + 3, 6); smoke(e.x, e.y + 2, e.z, 20, 10); G.shake = Math.max(G.shake, 1.2 - Math.min(1, dist(e.x, e.z) / 120)); flashLight(e.x, e.y + 10, e.z, 600, 0.6); break;
    case 'dropship': { const m = M.dropship(); m.position.set(...e.a); scene.add(m); FX.proj.push({ mesh: m, kind: 'ship', met: { t: e.t + 4 }, a: e.a, b: e.b, t0: 1e9, t: 0, ship: { t: 0, T: e.t } }); audio.sfx('alarm', 0.4); break; }
    case 'bomber': { const m = M.jet(); scene.add(m); FX.proj.push({ mesh: m, kind: 'jet', met: { t: e.t + 1.5 }, a: [e.a[0], e.y, e.a[1]], b: [e.b[0], e.y, e.b[1]], t0: 1e9, t: 0, jet: { t: 0, T: e.t } }); audio.gun('artillery', 0.8, 1, 0.3); break; }
    case 'orbital': { const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 400, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xff60ff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); beam.position.set(e.x, e.y + 200, e.z); scene.add(beam); FX.proj.push({ mesh: beam, kind: 'beam', met: { t: e.t }, a: [e.x, e.y, e.z], b: [e.x, e.y, e.z], t0: 1e9, t: 0, orb: 1 }); audio.sfx('zap'); G.shake = Math.max(G.shake, 0.4); break; }
    case 'emp': case 'cryo': { const c = e.k === 'emp' ? 0x60a0ff : 0xc0f0ff, r = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color: c, transparent: true, side: THREE.DoubleSide, depthWrite: false })); r.rotation.x = -Math.PI / 2; r.position.set(e.x, e.y + 0.5, e.z); scene.add(r); FX.booms.push({ mesh: r, t: 0, r: e.k === 'emp' ? 50 : 30, ring: 1 }); burst(e.x, e.y + 1, e.z, c, 40, 10, 0.8); audio.sfx('zap'); flashLight(e.x, e.y + 4, e.z, 200, 0.3); break; }
    case 'usedspecial': if (e.s !== 'missile') toast(`${e.n} used ${SPECIALS[e.s].name}!`, 3); audio.sfx('buy'); break;
    case 'bolt': if (wx) { wx.flash = 0.35; setTimeout(() => audio.sfx('thunder', 0.8), 500); } break;
    case 'upgstart': audio.sfx('place', vol(dist(e.x, e.z))); break;
    case 'built': audio.sfx('buy', vol(dist(e.x, e.z)) * 0.7); burst(e.x, G.W.top(e.x, e.z) + 1, e.z, 0x80c0ff, 12, 3, 0.5); if (e.o === G.myId) toast(`${TURRETS[e.kind].name} is online.`, 2); break;
    case 'drop': break;
    case 'adie': burst(e.x, e.y + 1, e.z, 0xa02020, 8, 3, 0.6); break;
    case 'banner': banner(e.a, e.b); audio.sfx('wave'); break;
    case 'assault': banner('FINAL ASSAULT', 'Go into the cave and kill the Brood Queen'); audio.sfx('alarm'); toast('Wave 20 survived! No more waves: push to the hive and destroy it.', 8); break;
    case 'win': audio.sfx('win'); record(e.el); setTimeout(startFob, 900); break;
    case 'lose': audio.sfx('lose'); record(e.el); break;
  }
}
// which way an attack came from: a red arc around the crosshair
function hitFrom(x, z) { const me = G.me, a = Math.atan2(x - me.x, z - me.z) - Math.atan2(-Math.sin(me.yaw), -Math.cos(me.yaw)); const d = document.createElement('div'); d.className = 'dmgdir'; d.style.transform = `translate(-50%,-50%) rotate(${-a}rad)`; $('dirs').appendChild(d); setTimeout(() => d.remove(), 900); }
// a meteor: a red circle grows on the ground, then a burning rock falls onto it
function meteor(e) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(4.2, 4.5, 40), new THREE.MeshBasicMaterial({ color: 0xff2010, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.set(e.x, e.y + 0.25, e.z); scene.add(ring);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(4.5, 32), new THREE.MeshBasicMaterial({ color: 0xff2010, transparent: true, opacity: 0.15, depthWrite: false })); disc.rotation.x = -Math.PI / 2; disc.position.copy(ring.position); scene.add(disc);
  const rock = new THREE.Group(); M.S(rock, 1.1, 0x3a2010, 0, 0, 0, 1, 1, 1); M.S(rock, 1.3, 0xff6010, 0, 0.3, 0, 1, 1, 1, { e: 0xff4000, op: 0.5 }); rock.visible = false; scene.add(rock);
  FX.proj.push({ mesh: rock, kind: 'meteor', a: [e.x + 20, e.y + 70, e.z - 10], b: [e.x, e.y, e.z], t0: 1e9, t: 0, met: { t: e.t, ring, disc } });
}
function updateMeteors(dt) {
  for (const p of FX.proj) { if (!p.met || p.ship || p.jet || p.orb || p.tm) continue; const m = p.met; m.t -= dt; m.ring.material.opacity = 0.5 + Math.sin(G.time * 14) * 0.3;
    if (m.t < 1) { p.mesh.visible = true; const f = 1 - m.t; p.mesh.position.set(p.a[0] + (p.b[0] - p.a[0]) * f, p.a[1] + (p.b[1] - p.a[1]) * f, p.a[2] + (p.b[2] - p.a[2]) * f); burst(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, 0xff8020, 2, 2, 0.4, 1.5); }
    p.t = 0; if (m.t <= 0) { p.dead = true; scene.remove(p.mesh, m.ring, m.disc); } }
}
const died = new Set(), corpses = [], splats = [];
function updateCorpses(dt) {
  for (const c of corpses) { c.t += dt; const f = Math.min(1, c.t / 0.35); c.m.rotation.z = c.side * f * 1.5; c.m.userData.legs.forEach(l => l.rotation.x = Math.sin(c.t * 30) * 0.4 * (1 - f)); if (c.t > 2) c.m.position.y -= dt * 0.8; if (c.t > 3.5) { scene.remove(c.m); c.dead = true; } }
  if (corpses.some(c => c.dead)) corpses.splice(0, corpses.length, ...corpses.filter(c => !c.dead));
  for (const s of splats) { s.t -= dt; s.m.material.opacity = Math.min(0.75, s.t / 4); if (s.t <= 0) { scene.remove(s.m); s.m.geometry.dispose(); s.m.material.dispose(); s.dead = true; } }
  if (splats.some(s => s.dead)) splats.splice(0, splats.length, ...splats.filter(s => !s.dead));
}
const marks = []; function impactMark(x, y, z) { if (marks.length > 70) { const o = marks.shift(); scene.remove(o); } const m = new THREE.Mesh(new THREE.CircleGeometry(0.18 + Math.random() * 0.12, 6), new THREE.MeshBasicMaterial({ color: 0x1a1612, transparent: true, opacity: 0.7, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(x, G.W.ground(x, z, y + 0.3) + 0.05, z); scene.add(m); marks.push(m); }
function splat(x, z, r) { if (splats.length > 40) { const o = splats.shift(); scene.remove(o.m); } const m = new THREE.Mesh(new THREE.CircleGeometry(r * (0.7 + Math.random() * 0.6), 9), new THREE.MeshBasicMaterial({ color: 0x4ac020, transparent: true, opacity: 0.75, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.rotation.z = Math.random() * 6; m.position.set(x, G.W.top(x, z) + 0.12, z); scene.add(m); splats.push({ m, t: 12 }); }
// class abilities, seen by everyone
function abilityFx(e) {
  const y = e.y || 0;
  if (e.id === 'shockwave') { boomFx(e.x, y + 0.5, e.z, 9, false); G.shake = Math.max(G.shake, 0.5); }
  else if (e.id === 'revive') { const r = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40), new THREE.MeshBasicMaterial({ color: 0x60ff90, transparent: true, side: THREE.DoubleSide, depthWrite: false })); r.rotation.x = -Math.PI / 2; r.position.set(e.x, y + 0.3, e.z); scene.add(r); FX.booms.push({ mesh: r, t: 0, r: 40, ring: 1 }); burst(e.x, y + 1, e.z, 0x60ff90, 30, 6, 0.8); audio.sfx('heal'); }
  else if (e.id === 'overclock') { burst(e.x, y + 1.5, e.z, 0x60c0ff, 30, 8, 0.6); audio.sfx('zap'); }
  else if (e.id === 'adrenaline') { burst(e.x, y + 1.2, e.z, 0xffd040, 16, 4, 0.5); }
  else if (e.id === 'ammo') { audio.sfx('place'); }
  if (e.by === G.myId) toast(`${e.name}!`, 2);
}
// tactical missile: the hub's silo opens, the missile climbs, arcs over and drops on the target; a red ring and countdown mark the spot
function tacMissile(e) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(MISSILE.radius - 0.4, MISSILE.radius, 64), new THREE.MeshBasicMaterial({ color: 0xff2010, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.set(e.b[0], e.b[1] + 0.3, e.b[2]); scene.add(ring);
  const lab = timerLabel(); lab.position.set(e.b[0], e.b[1] + 8, e.b[2]); lab.scale.set(8, 2, 1); scene.add(lab);
  const m = new THREE.Group(); M.C(m, 0.5, 0.5, 4, 0xd0d0d0, 0, 0, 0); M.K(m, 0.5, 1.2, 0xc03020, 0, 2.6, 0); M.S(m, 0.6, 0xffa040, 0, -2.2, 0, 1, 1, 1, { e: 0xff6000 }); m.position.set(...e.a); m.visible = false; scene.add(m);
  FX.proj.push({ mesh: m, kind: 'tm', met: { t: e.l + e.f }, a: e.a, b: e.b, t0: 1e9, t: 0, tm: { l: e.l, f: e.f, t: 0, ring, lab } });
  audio.sfx('alarm'); toast(`${e.n} launched a Tactical Missile: impact in ${(e.l + e.f).toFixed(1)} s`, 4);
}
function updateShips(dt) {
  for (const p of FX.proj) {
    if (p.ship) { const S0 = p.ship; S0.t += dt; const f = Math.min(1, S0.t / S0.T); if (S0.t < S0.T) { const e = 1 - (1 - f) * (1 - f); p.mesh.position.set(p.a[0] + (p.b[0] - p.a[0]) * e, p.a[1] + (p.b[1] + 6 - p.a[1]) * e, p.a[2] + (p.b[2] - p.a[2]) * e); p.mesh.lookAt(p.b[0], p.mesh.position.y, p.b[2]); }
      else { const u = S0.t - S0.T; if (!S0.dropped) { S0.dropped = 1; burst(p.b[0], p.b[1] + 1, p.b[2], 0xc0a060, 20, 5, 0.7); audio.sfx('place'); } p.mesh.position.y = p.b[1] + 6 + u * u * 4; p.mesh.position.x += dt * 20 * Math.min(1, u); }
      if (Math.random() < 0.5) burst(p.mesh.position.x, p.mesh.position.y - 1, p.mesh.position.z, 0x80c0ff, 1, 1, 0.3); }
    if (p.jet) { const J = p.jet; J.t += dt; const f = (J.t / (J.T + 1.5)) * 2 - 0.5; p.mesh.position.set(p.a[0] + (p.b[0] - p.a[0]) * f, p.a[1], p.a[2] + (p.b[2] - p.a[2]) * f); p.mesh.lookAt(p.b[0] * 2 - p.a[0], p.a[1], p.b[2] * 2 - p.a[2]); }
    if (p.orb) { p.mesh.material.opacity = 0.4 + Math.random() * 0.4; p.mesh.scale.x = p.mesh.scale.z = 0.8 + Math.random() * 0.5; if (Math.random() < 0.6) burst(p.a[0] + (Math.random() - 0.5) * 6, p.a[1] + 0.5, p.a[2] + (Math.random() - 0.5) * 6, 0xff80ff, 3, 6, 0.4); }
    if (p.met && (p.ship || p.jet || p.orb)) { p.met.t -= dt; if (p.met.t <= 0) { p.dead = true; scene.remove(p.mesh); } }
  }
}
function updateTacMissiles(dt) { updateShips(dt);
  for (const p of FX.proj) { if (!p.tm) continue; const T = p.tm; T.t += dt; const left = T.l + T.f - T.t; setLabel(T.lab, `IMPACT ${Math.max(0, left).toFixed(1)}s`); T.ring.material.opacity = 0.5 + Math.sin(G.time * 12) * 0.3;
    if (T.t > T.l * 0.6) p.mesh.visible = true;
    if (T.t < T.l) { const f = Math.max(0, (T.t - T.l * 0.6) / (T.l * 0.4)); p.mesh.position.set(p.a[0], p.a[1] + f * 25, p.a[2]); p.mesh.rotation.set(0, 0, 0); smoke(p.a[0], p.a[1] + f * 25 - 3, p.a[2], 1, 1); if (!T.launched && f > 0) { T.launched = 1; audio.gun('rocket', vol(dist(p.a[0], p.a[2])) + 0.3, 1.5, 0); } }
    else { const f = Math.min(1, (T.t - T.l) / T.f), h = 25 + Math.sin(f * Math.PI) * 60 * (1 - f * 0.3), x = p.a[0] + (p.b[0] - p.a[0]) * f, z = p.a[2] + (p.b[2] - p.a[2]) * f, y = (p.a[1] + 25) * (1 - f) + p.b[1] * f + Math.sin(f * Math.PI) * 60;
      const ox = p.mesh.position.x, oy = p.mesh.position.y, oz = p.mesh.position.z; p.mesh.position.set(x, y, z); p.mesh.lookAt(x * 2 - ox, y * 2 - oy, z * 2 - oz); p.mesh.rotateX(Math.PI / 2); burst(x, y, z, 0xff9030, 2, 1, 0.4, 1.5); void h; }
    if (left <= 0) { p.dead = true; scene.remove(p.mesh, T.ring, T.lab); } }
}
// the live map for aiming the tactical missile
function openMissileMap(sp) {
  G.mmap = true; G.mmSp = sp || ''; $('mmap').hidden = false; if (document.pointerLockElement) document.exitPointerLock();
  $('mmapT').textContent = sp ? SPECIALS[sp].name : 'Live map'; $('mmapD').textContent = sp ? 'Click where to call it in. ' + SPECIALS[sp].desc : 'Aliens, turrets, marines, supply crates and points of interest, live. M or Esc closes.'; drawMissileMap();
}
function drawMissileMap() {
  if (!G.mmap) return; const S = state(), cv = $('mmapCv'), g = cv.getContext('2d'), W = cv.width, BB = G.W.size || BOUNDS, k = W / (BB * 2), X = x => (x + BB) * k, Z = z => (z + BB) * k;
  g.drawImage(G.W.miniBg, 0, 0, W, W);
  g.fillStyle = '#60c0ff'; g.beginPath(); g.arc(X(G.W.hubP.x), Z(G.W.hubP.z), 10, 0, 7); g.fill(); g.fillStyle = '#a040ff'; g.beginPath(); g.arc(X(G.W.hiveP.x), Z(G.W.hiveP.z), 10, 0, 7); g.fill();
  g.font = 'bold 13px system-ui'; g.fillStyle = '#fff'; g.fillText('HUB', X(G.W.hubP.x) + 12, Z(G.W.hubP.z) + 4); g.fillText('HIVE', X(G.W.hiveP.x) + 12, Z(G.W.hiveP.z) + 4);
  for (const l of G.W.lore || []) if (!l.silent) { g.fillStyle = '#40ffb0'; g.font = '16px system-ui'; g.fillText({ cave: '⛰', satellite: '🛰', capsule: '🛸', wreck: '✈', rover: '🚙' }[l.kind] || '?', X(l.x) - 8, Z(l.z) + 6); }
  for (const o of S.O) { g.fillStyle = '#ffd040'; g.fillRect(X(o.x) - 4, Z(o.z) - 4, 8, 8); }
  for (const t of S.T) { g.fillStyle = '#80ff90'; g.fillRect(X(t.x) - 3, Z(t.z) - 3, 6, 6); } for (const a of S.A) { if (!revealed(a)) continue; const b = ALIENS[a.type].boss || ALIENS[a.type].static; g.fillStyle = b ? '#ff40ff' : '#ff4040'; g.beginPath(); g.arc(X(a.x), Z(a.z), b ? 6 : 3, 0, 7); g.fill(); }
  for (const m of S.L || []) { g.fillStyle = '#9fe870'; g.fillRect(X(m.x) - 2, Z(m.z) - 2, 4, 4); }
  for (const p of S.P) { g.fillStyle = p.id === G.myId ? '#fff' : '#' + CLASSES[p.cls].color.toString(16).padStart(6, '0'); g.beginPath(); g.arc(X(p.x), Z(p.z), 5, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = '11px system-ui'; g.fillText(p.name, X(p.x) + 7, Z(p.z) - 6); }
  if (G.mmHover && G.mmSp) { const [hx, hz] = G.mmHover, R0 = SPECIALS[G.mmSp].r || 5; g.strokeStyle = '#ff3020'; g.lineWidth = 2; g.beginPath(); g.arc(X(hx), Z(hz), Math.max(5, R0 * k), 0, 7); g.stroke();
    if (G.mmSp === 'missile') { const d = Math.hypot(hx - G.W.hubP.x, hz - G.W.hubP.z), eta = MISSILE.launch + 1.5 + d / MISSILE.speed; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(X(G.W.hubP.x), Z(G.W.hubP.z)); g.lineTo(X(hx), Z(hz)); g.stroke(); g.setLineDash([]); g.fillStyle = '#fff'; g.font = 'bold 16px system-ui'; g.fillText(`Impact in ${eta.toFixed(1)} s`, X(hx) + 14, Z(hz) - 10); } }
  requestAnimationFrame(drawMissileMap);
}
function closeMissileMap() { G.mmap = false; $('mmap').hidden = true; G.mmHover = null; canvas.requestPointerLock(); }
function record(w) { const b = store.get('hb-best2', {}); if ((b[G.map] || 0) < w) { b[G.map] = w; store.set('hb-best2', b); } }

// grenades: anyone may throw one; only the thrower's game asks for the blast
function grenade(a, v, own) {
  const m = new THREE.Group(); M.S(m, 0.14, 0x404a30, 0, 0, 0); M.S(m, 0.05, 0xff3030, 0, 0.12, 0, 1, 1, 1, { e: 0xff0000 }); m.position.set(...a); scene.add(m);
  FX.proj.push({ mesh: m, kind: 'gr', a, b: a, t0: 1e9, t: 0, gr: { x: a[0], y: a[1], z: a[2], vx: v[0], vy: v[1], vz: v[2], t: 1.6, own } });
}
function updateGrenades(dt) {
  for (const p of FX.proj) {
    if (!p.gr) continue; const g = p.gr; g.t -= dt; g.vy -= 20 * dt; g.x += g.vx * dt; g.y += g.vy * dt; g.z += g.vz * dt;
    const gy = G.W.ground(g.x, g.z, g.y + 0.3) + 0.14; if (g.y < gy) { g.y = gy; g.vy = Math.abs(g.vy) * 0.35; g.vx *= 0.6; g.vz *= 0.6; }
    p.a = p.b = [g.x, g.y, g.z]; p.t = 0;
    if (g.t <= 0) { p.dead = true; scene.remove(p.mesh); if (g.own && G.explore && G.ex) G.ex.splash(g.x, g.y, g.z, 5.5, 140); else if (g.own) req({ a: 'boom', x: g.x, y: g.y, z: g.z, r: 5.5, d: 140 * dmgMul() }); else if (G.mode === 'client') { } }
  }
}

// ---------------------------------------------------------------- weather: dust on Mars, snow on Kryos, rain and lightning in the jungle
let wx = null;
function makeWeather() {
  if (wx) { scene.remove(wx.pts); wx = null; } const kind = G.W.def.weather, n = kind === 'rain' ? 2500 : kind === 'snow' ? 2200 : 900, pos = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) pos[i] = (Math.random() - 0.5) * 60; const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: kind === 'rain' ? 0x9ab8d0 : kind === 'snow' ? 0xffffff : 0xd08a5a, size: kind === 'rain' ? 0.09 : kind === 'snow' ? 0.16 : 0.12, transparent: true, opacity: kind === 'dust' ? 0.5 : 0.8, depthWrite: false });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts); wx = { pts, kind, n, fogFar: G.W.def.fogD[1], fogNear: G.W.def.fogD[0], bolt: 8 + Math.random() * 10, flash: 0 };
}
function updateWeather(dt, S) {
  if (!wx) return; const a = wx.pts.geometry.attributes.position.array, c = camera.position, storm = (S && S.wx) || 0, fall = wx.kind === 'rain' ? 26 : wx.kind === 'snow' ? 2.5 + storm * 4 : 0.4, wind = wx.kind === 'snow' ? 1.5 + storm * 13 : wx.kind === 'dust' ? 5 : 2;
  for (let i = 0; i < wx.n; i++) { const o = i * 3, wa = wx.kind === 'snow' ? ((S && S.wa) || 0) : 0; a[o] += Math.cos(wa) * wind * dt; a[o + 2] += Math.sin(wa) * wind * dt; a[o + 1] -= fall * dt * (0.7 + (i % 5) * 0.1); if (wx.kind === 'dust') a[o + 1] += Math.sin(G.time + i) * dt * 0.5;
    if (a[o] - c.x > 30) a[o] -= 60; if (a[o] - c.x < -30) a[o] += 60; if (a[o + 2] - c.z > 30) a[o + 2] -= 60; if (a[o + 2] - c.z < -30) a[o + 2] += 60; if (a[o + 1] < c.y - 15) a[o + 1] += 30; if (a[o + 1] > c.y + 15) a[o + 1] -= 30; }
  wx.pts.geometry.attributes.position.needsUpdate = true;
  // blizzards close the fog right in
  const fa = wx.fogFar + (36 - wx.fogFar) * storm, fn = wx.fogNear + (4 - wx.fogNear) * storm; scene.fog.far += (fa - scene.fog.far) * Math.min(1, dt * 1.5); scene.fog.near += (fn - scene.fog.near) * Math.min(1, dt * 1.5);
  if (wx.kind === 'snow') wx.pts.material.size = 0.16 + storm * 0.08;
  if (wx.kind === 'rain') { wx.flash = Math.max(0, wx.flash - dt); G.W.hemi.intensity = (G.W.def.hemiI || 1.1) + (wx.flash > 0 ? (Math.sin(wx.flash * 60) > 0 ? 3 : 0.5) : 0); }
}

// ---------------------------------------------------------------- view: meshes that follow the battle
const view = { aliens: new Map(), turrets: new Map(), players: new Map(), pods: new Map(), allies: new Map() };
const huntOf = a => a.tg !== undefined ? a.tg : a.mode === 'hunt' ? (a.tk === 'p' ? a.tid : 't') : 0;
const BAR_Y = { broodqueen: 11, royal: 3.2, guardian: 5, hivecore: 9, nest: 3.4, crawler: 1.8, spitter: 2.9, brute: 2.9, flyer: 1.1, ravager: 4.9, queen: 7.8 };
const barGeo = new THREE.PlaneGeometry(1, 0.12), barBg = new THREE.MeshBasicMaterial({ color: 0x200000, depthTest: false, transparent: true, opacity: 0.7 }), barFg = new THREE.MeshBasicMaterial({ color: 0xff4040, depthTest: false });
function colorOf(id, S) { const p = S.P.find(q => q.id === id); return p ? CLASSES[p.cls].color : 0x888888; }
function nameTag(text, color) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const g = cv.getContext('2d'); g.font = 'bold 30px system-ui, sans-serif'; g.textAlign = 'center';
  g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(8, 10, 240, 44); g.fillStyle = '#' + color.toString(16).padStart(6, '0'); g.fillRect(8, 50, 240, 4); g.fillStyle = '#fff'; g.fillText(text.slice(0, 14), 128, 43);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false })); s.scale.set(2.4, 0.6, 1); s.renderOrder = 5; return s;
}
// scaffolding with a progress bar and a countdown, over turrets being built or upgraded
function timerLabel() { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true })); sp.userData.cv = cv; sp.scale.set(2.4, 0.6, 1); sp.renderOrder = 6; return sp; }
function setLabel(sp, text) { const cv = sp.userData.cv, g = cv.getContext('2d'); g.clearRect(0, 0, 256, 64); g.fillStyle = 'rgba(4,14,24,.65)'; g.fillRect(0, 8, 256, 48); g.fillStyle = '#9fe8ff'; g.font = 'bold 30px system-ui,sans-serif'; g.textAlign = 'center'; g.fillText(text, 128, 43); sp.material.map.needsUpdate = true; }
const _tv = new THREE.Vector3();
// a hologram over turrets being built or upgraded: scanning rings, light pillars, a progress bar and a label
function scaffold(w, h) {
  const g = new THREE.Group(), cage = new THREE.Group(), add = (geo, c, o) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); cage.add(m); return m; };
  const R = Math.max(1.5, w * 0.5);
  for (let i = 0; i < 2; i++) { const r = add(new THREE.TorusGeometry(R, 0.03, 6, 48), 0x40b0ff, 0.55); r.rotation.x = Math.PI / 2; r.userData.ring = 1; }
  for (let i = 0; i < 3; i++) { const a = i / 3 * 6.283, p = add(new THREE.CylinderGeometry(0.02, 0.02, h, 6), 0x40b0ff, 0.3); p.position.set(Math.cos(a) * R, h / 2, Math.sin(a) * R); }
  const floor = add(new THREE.RingGeometry(R * 0.2, R, 40), 0x3090ff, 0.18); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.06;
  g.add(cage);
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true })); label.userData.cv = cv; label.scale.set(2.8, 0.7, 1); label.position.y = h + 1.3; label.renderOrder = 6; g.add(label);
  const bg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x0a1a28, depthTest: false })); bg.scale.set(1.9, 0.16, 1); bg.position.y = h + 0.75; bg.renderOrder = 6; g.add(bg);
  const bar = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x60e0ff, depthTest: false })); bar.scale.set(1.8, 0.12, 1); bar.center.set(0.5, 0.5); bar.position.y = h + 0.75; bar.renderOrder = 7; g.add(bar);
  g.userData = { cage, label, bar, h }; return g;
}
let markMat = null;
function markSprite() {
  if (!markMat) { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); g.fillStyle = '#ff3030'; g.beginPath(); g.moveTo(32, 2); g.lineTo(62, 58); g.lineTo(2, 58); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.fillText('!', 32, 52); markMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false }); }
  const s = new THREE.Sprite(markMat); s.scale.set(0.9, 0.9, 1); s.renderOrder = 6; return s;
}
// scrap piles: a heap of plates, pipe and a gear on an orange glowing ring, under a short light shaft; only nearby piles are drawn
const scrapV = new Map(); let scrapK = null;
function scrapMesh() {
  if (!scrapK) { const add = { blending: THREE.AdditiveBlending, transparent: true, depthWrite: false };
    scrapK = { plate: new THREE.BoxGeometry(1.2, 0.12, 0.75), pipe: new THREE.CylinderGeometry(0.11, 0.11, 1.4, 8), gear: new THREE.CylinderGeometry(0.42, 0.42, 0.14, 8), ring: new THREE.RingGeometry(1.0, 1.35, 28), shaft: new THREE.CylinderGeometry(0.07, 0.25, 4, 8, 1, true),
      metal: M.mat(0xb8bcc2, { m: 0.85, r: 0.25 }), rust: M.mat(0xa05a30, { m: 0.4, r: 0.7 }), ringM: new THREE.MeshBasicMaterial({ color: 0xff9020, opacity: 0.75, side: THREE.DoubleSide, ...add }), shaftM: new THREE.MeshBasicMaterial({ color: 0xffa040, opacity: 0.35, side: THREE.DoubleSide, ...add }) }; }
  const K = scrapK, g = new THREE.Group(), m = (geo, mat, x, y, z, rx, ry, rz) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); g.add(o); return o; };
  m(K.plate, K.metal, 0, 0.12, 0, 0.1, 0.3, 0.15); m(K.plate, K.rust, 0.2, 0.3, 0.1, -0.25, 1.4, 0.2); m(K.pipe, K.metal, -0.3, 0.3, 0.2, 0.2, 0, 1.3); m(K.gear, K.rust, 0.25, 0.5, -0.2, 0.6, 0, 0.3);
  const ring = m(K.ring, K.ringM, 0, 0.06, 0, -Math.PI / 2, 0, 0), shaft = m(K.shaft, K.shaftM, 0, 2.1, 0, 0, 0, 0); g.userData = { ring, shaft }; return g;
}
function syncScrap(S) {
  const L = G.explore || G.cine ? [] : S.SC || [], seen = new Set(), me = G.me;
  for (const c of L) { seen.add(c.id); let v = scrapV.get(c.id); if (!v) { v = scrapMesh(); v.position.set(c.x, G.W.top(c.x, c.z), c.z); v.rotation.y = c.id; scene.add(v); scrapV.set(c.id, v); }
    const d = me ? Math.hypot(c.x - me.x, c.z - me.z) : 0; v.visible = d < 75; if (v.visible) { const p = 1 + Math.sin(G.time * 4 + c.id) * 0.12; v.userData.ring.scale.set(p, p, 1); v.userData.shaft.material.opacity = 0.35; } }
  for (const [id, v] of scrapV) if (!seen.has(id)) { scene.remove(v); scrapV.delete(id); }
}
function syncView(S, dt) {
  syncScrap(S);
  const k = G.sim ? 1 : 1 - Math.exp(-dt * 12), seen = new Set();
  for (const a of S.A) {
    seen.add(a.id); let v = view.aliens.get(a.id);
    if (!v) { const mesh = M.alien(a.type); mesh.position.set(a.x, a.y, a.z); mesh.rotation.y = a.ry; scene.add(mesh); const bar = new THREE.Group(); const bg = new THREE.Mesh(barGeo, barBg), fg = new THREE.Mesh(barGeo, barFg); fg.position.z = 0.01; bg.renderOrder = fg.renderOrder = 4; bar.add(bg, fg); scene.add(bar); v = { mesh, bar, fg, x: a.x, y: a.y, z: a.z, t: Math.random() * 9, type: a.type }; view.aliens.set(a.id, v); }
    if (v.hp !== undefined && a.hp < v.hp - 0.5) v.pop = 0.1; v.x += (a.x - v.x) * k; v.y += (a.y - v.y) * k; v.z += (a.z - v.z) * k; v.hp = a.hp; v.mhp = a.mhp; v.id = a.id; v.hunt = huntOf(a);
    v.mesh.position.set(v.x, v.y, v.z); let dr = a.ry - v.mesh.rotation.y; while (dr > Math.PI) dr -= 6.283; while (dr < -Math.PI) dr += 6.283; v.mesh.rotation.y += dr * Math.min(1, k * 1.5);
    v.t += dt * (a.stun ? 0 : 1) * (v.hunt ? 1.5 : 1); M.animAlien(v.mesh, v.t);
    v.pop = Math.max(0, (v.pop || 0) - dt); v.mesh.scale.setScalar((a.type === 'ravager' ? 1.7 : 1) * (1 + v.pop * 1.4));
    v.lunge = Math.max(0, (v.lunge || 0) - dt); if (v.mesh.userData.body) { v.mesh.userData.body.position.z = -Math.sin(v.lunge / 0.25 * Math.PI) * 0.6; v.mesh.userData.body.rotation.x = v.pop * 2; }
    const mineHunt = v.hunt === G.myId, mateHunt = v.hunt && v.hunt !== 't' && !mineHunt; if ((mineHunt || mateHunt) && !v.mark) { v.mark = markSprite(); v.mark.material = v.mark.material.clone(); scene.add(v.mark); } if (v.mark) { v.mark.visible = mineHunt || mateHunt; v.mark.material.color.setHex(mineHunt ? 0xffffff : 0xffa040); v.mark.position.set(v.x, v.y + BAR_Y[a.type] + 0.9 + Math.sin(G.time * 10) * 0.1, v.z); }
    const A = ALIENS[a.type], sc = a.type === 'broodqueen' ? 6 : a.type === 'royal' ? 1.8 : a.type === 'hivecore' ? 6 : a.type === 'guardian' ? 2.5 : A.boss ? (a.type === 'queen' ? 4 : 2.5) : 1.2, f = Math.max(0, a.hp / a.mhp);
    v.bar.visible = f < 0.999; if (v.bar.visible) { v.bar.position.set(v.x, v.y + BAR_Y[a.type], v.z); v.bar.quaternion.copy(camera.quaternion); v.bar.scale.set(sc, sc, 1); v.fg.scale.x = f; v.fg.position.x = -(1 - f) / 2; }
  }
  for (const [id, v] of view.aliens) if (!seen.has(id)) { scene.remove(v.bar); if (v.mark) scene.remove(v.mark); view.aliens.delete(id); if (died.has(id) && v.type !== 'hivecore') { died.delete(id); corpses.push({ m: v.mesh, t: 0, side: Math.random() < 0.5 ? -1 : 1 }); } else scene.remove(v.mesh); }
  seen.clear();
  for (const t of S.T) {
    seen.add(t.id); let v = view.turrets.get(t.id);
    if (!v) { const mesh = M.turret(t.kind, colorOf(t.owner, S)); mesh.position.set(t.x, t.y, t.z); if (TURRETS[t.kind].onPath) mesh.rotation.y = t.ry; else mesh.userData.head.rotation.y = t.ry; scene.add(mesh); v = { mesh, acc: 0, spin: 0, lvl: 0 }; view.turrets.set(t.id, v); }
    const u = v.mesh.userData; v.d = t;
    // turrets can be carried: the one you hold floats in front of you, others glide to where the host says
    { const mine0 = t.carry && t.carry === G.myId, tx = mine0 ? G.me.x - Math.sin(G.me.yaw) * 1.7 : t.x, tz = mine0 ? G.me.z - Math.cos(G.me.yaw) * 1.7 : t.z, ty = mine0 ? G.me.y + 0.3 : t.y, m = v.mesh.position;
      if (mine0 || m.distanceToSquared(_tv.set(tx, ty, tz)) > 900) m.set(tx, ty, tz); else m.lerp(_tv.set(tx, ty, tz), Math.min(1, k * 1.5)); if (TURRETS[t.kind].onPath) v.mesh.rotation.y = t.carry ? (mine0 ? G.me.yaw : t.ry) : t.ry; v.mesh.rotation.z = t.carry ? Math.sin(G.time * 6) * 0.04 : 0; }
    if (!['barricade', 'resupply', 'stasis', 'mines', 'uav', 'claymore', 'medbay'].includes(t.kind)) { let dr = t.ry - u.head.rotation.y; while (dr > Math.PI) dr -= 6.283; while (dr < -Math.PI) dr += 6.283; u.head.rotation.y += dr * Math.min(1, k * 1.5); }
    if (!v.hpb) { v.hpb = new THREE.Group(); const bg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x200000, depthTest: false })); bg.scale.set(2, 0.18, 1); const fg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x40e070, depthTest: false })); fg.center.set(0, 0.5); fg.position.x = -0.95; fg.scale.set(1.9, 0.12, 1); bg.renderOrder = 6; fg.renderOrder = 7; v.hpb.add(bg, fg); v.hpb.userData.fg = fg; scene.add(v.hpb); }
    { const f = Math.max(0, t.hp / t.mhp); v.hpb.visible = f < 0.995 && !TURRETS[t.kind].mine; if (v.hpb.visible) { v.hpb.position.set(v.mesh.position.x, v.mesh.position.y + (t.kind === 'barricade' ? 3 : 4.6) * ([1, 1.28, 1.55][t.lvl - 1] || 1), v.mesh.position.z); v.hpb.userData.fg.scale.x = 1.9 * f + 0.001; v.hpb.userData.fg.material.color.setHex(f < 0.3 ? 0xff4040 : f < 0.6 ? 0xffc040 : 0x40e070); } }
    if (v.lvl !== t.lvl) { if (v.lvl && t.lvl > v.lvl) { v.morph = 1; audio.sfx('upg', vol(dist(t.x, t.z))); flashAt([t.x, t.y + 2, t.z], 4); } if (v.up) { v.mesh.remove(v.up); if (v.up.userData.head.parent) v.up.userData.head.parent.remove(v.up.userData.head); } v.up = M.upgradeParts(t.kind, t.lvl, colorOf(t.owner, S)); v.mesh.add(v.up); (v.mesh.userData.head || v.mesh).add(v.up.userData.head); }
    if (v.lvl !== t.lvl) { v.lvl = t.lvl; if (v.stars) v.mesh.remove(v.stars); v.stars = new THREE.Group(); for (let i = 0; i < t.lvl; i++) M.S(v.stars, 0.12, 0xffd040, (i - (t.lvl - 1) / 2) * 0.35, 0, 0, 1, 1, 1, { e: 0xffa000 }); v.stars.position.y = t.kind === 'barricade' ? 2.3 : 3.3; v.mesh.add(v.stars); }
    if (t.kind === 'resupply' || t.kind === 'uav') u.head.rotation.y += dt * 1.5; if (t.kind === 'uav' && !t.carry) { u.head.position.y = 0.55; if (!t.fresh) { if (!v.ping) { v.ping = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 64), new THREE.MeshBasicMaterial({ color: 0x40c0ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); v.ping.rotation.x = -Math.PI / 2; scene.add(v.ping); } const f = (G.time / 2.5 + t.id * 0.37) % 1, R = TURRETS.uav.range * f; v.ping.position.set(v.mesh.position.x, v.mesh.position.y + 0.3, v.mesh.position.z); v.ping.scale.set(R, R, 1); v.ping.material.opacity = 0.7 * (1 - f); } }
    if (t.kind === 'mines') u.head.children.forEach((c, i) => c.visible = i < (t.ch ?? 3) * 2);
    if (t.kind === 'flamer' && t.tg) { const ry = u.head.rotation.y, s0 = v.mesh.scale.x, mx = t.x - Math.sin(ry) * 1.05 * s0, mz = t.z - Math.cos(ry) * 1.05 * s0; for (let i = 0; i < 3; i++) flame(mx, t.y + 1.25 * s0, mz, -Math.sin(ry + (Math.random() - 0.5) * 0.9) * 11, -Math.cos(ry + (Math.random() - 0.5) * 0.9) * 11); v.facc = (v.facc || 0) + dt; if (v.facc > 0.2) { v.facc = 0; audio.sfx('flame', vol(dist(t.x, t.z)) * 0.8); } }
    if (t.kind === 'stasis') u.head.rotation.y += dt * 2;
    if (t.kind === 'tesla') u.orb.scale.setScalar(1 + Math.sin(G.time * 8) * 0.08);
    // minigun fire is drawn here from the target it reports, so nothing extra is sent
    if ((t.kind === 'minigun' || t.kind === 'pulse') && t.tg) {
      if (u.spin) { v.spin += dt * 30; u.spin.rotation.z = v.spin; } v.acc += dt; const tv = view.aliens.get(t.tg);
      if (tv && v.acc > (t.kind === 'pulse' ? 0.17 : 0.07)) { v.acc = 0; const ry = u.head.rotation.y, s = v.mesh.scale.x, mx = t.x - Math.sin(ry) * 1.5 * s, mz = t.z - Math.cos(ry) * 1.5 * s; tracer([mx, t.y + 1.35 * s, mz], [tv.x + (Math.random() - 0.5) * 0.6, tv.y + ALIENS[tv.type].h * 0.6, tv.z + (Math.random() - 0.5) * 0.6], 0xffd060, 0.05, 0.05); const dd = dist(t.x, t.z); audio.gun('mini', vol(dd) * 0.75, 0.9 + t.lvl * 0.2, Math.min(1, dd / 45)); flashAt([mx, t.y + 1.35 * s, mz], 1 + t.lvl * 0.3); u.head.position.z = 0.08; }
      u.head.position.z *= 0.8;
    }
    const building = t.b > 0 || t.up > 0;
    if (false && building && !v.scaf) { v.scaf = scaffold(t.kind === 'barricade' ? 7 : 2.6, t.kind === 'barricade' ? 2.4 : 3.4); v.scaf.position.set(t.x, t.y, t.z); if (t.kind === 'barricade') v.scaf.rotation.y = t.ry; scene.add(v.scaf); }
    if (v.scaf) { v.scaf.visible = building; if (building) { const f = t.up > 0 ? t.up : 1 - t.b / (t.bt || 1), txt = t.up > 0 ? `WELDING Lv${t.lvl + 1} ${Math.round(t.up * 100)}%` : `BUILDING ${t.b.toFixed(1)}s`; v.scaf.position.copy(v.mesh.position); v.scaf.userData.bar.scale.x = Math.max(0.01, f); v.scaf.userData.bar.position.x = -(1 - f) * 0.9; if (v.scaf.userData.txt !== txt) setLabel(v.scaf.userData.label, txt); v.scaf.userData.txt = txt; v.scaf.userData.cage.rotation.y += dt * 0.6; v.scaf.userData.cage.children.forEach((c, i) => { if (c.userData.ring) c.position.y = ((G.time * 0.7 + i * 0.5) % 1) * v.scaf.userData.h; }); if (Math.random() < dt * 8) burst(t.x + (Math.random() - 0.5) * 1.5, t.y + Math.random() * 2.5, t.z + (Math.random() - 0.5) * 1.5, 0xffd060, 2, 2, 0.3); } }
    const sc0 = [1, 1.28, 1.55][t.lvl - 1] || 1, grow = t.fresh ? 0.15 + 0.85 * (1 - t.b / (t.bt || 1)) : 1; let mk = 1; if (v.morph > 0) { v.morph = Math.max(0, v.morph - dt / 1.3); const m = v.morph; mk = 1 + Math.sin((1 - m) * Math.PI * 4) * 0.18 * m - 0.25 * m * m; if (u.head) u.head.rotation.y += dt * 14 * m; if (v.up) { const e = Math.min(1, (1 - m) * 1.6); v.up.scale.setScalar(e); v.up.userData.head.scale.setScalar(e); } if (Math.random() < dt * 30 * m) burst(v.mesh.position.x + (Math.random() - 0.5) * 2, v.mesh.position.y + Math.random() * 3 * sc0, v.mesh.position.z + (Math.random() - 0.5) * 2, Math.random() < 0.5 ? 0x9fe8ff : 0xffd040, 3, 3, 0.5); }
    v.mesh.scale.set(sc0 * mk, sc0 * grow * mk, sc0 * mk);
    v.alert = Math.max(0, (v.alert || 0) - dt); if (v.alert > 0 && !v.mark) { v.mark = markSprite(); scene.add(v.mark); } if (v.mark) { v.mark.visible = v.alert > 0 && Math.sin(G.time * 12) > -0.3; v.mark.position.set(v.mesh.position.x, v.mesh.position.y + 4.2 * sc0, v.mesh.position.z); }
    if (t.hp < t.mhp * 0.35 && Math.random() < dt * 6) burst(t.x, 1.6, t.z, 0x303030, 1, 1, 1, 2);
  }
  for (const [id, v] of view.turrets) if (!seen.has(id)) { scene.remove(v.mesh); if (v.mark) scene.remove(v.mark); if (v.scaf) scene.remove(v.scaf); if (v.ping) scene.remove(v.ping); if (v.hpb) scene.remove(v.hpb); view.turrets.delete(id); }
  seen.clear();
  for (const p of S.P) {
    if (p.id === G.myId) continue; seen.add(p.id); let v = view.players.get(p.id);
    if (!v || v.cls !== p.cls) { if (v) scene.remove(v.mesh); const mesh = M.marine(CLASSES[p.cls].color, p.cls), tag = nameTag(p.name, CLASSES[p.cls].color); tag.position.y = 2.7; mesh.add(tag); scene.add(mesh); v = { mesh, cls: p.cls, x: p.x, y: p.y, z: p.z, t: 0 }; view.players.set(p.id, v); }
    const kk = 1 - Math.exp(-dt * 14), ox = v.x, oz = v.z; v.x += (p.x - v.x) * kk; v.y += (p.y - v.y) * kk; v.z += (p.z - v.z) * kk; const sp = Math.hypot(v.x - ox, v.z - oz) / Math.max(dt, 1e-4);
    v.t += dt * Math.min(sp, 9) * 1.6; M.animMarine(v.mesh, v.t, sp); v.mesh.position.set(v.x, v.y, v.z); v.mesh.rotation.y = p.yaw; v.mesh.visible = !p.dead && !p.veh && !G.cine;
    if (p.veh && (!v.vm || v.vk !== p.veh)) { if (v.vm) scene.remove(v.vm); v.vk = p.veh; v.vm = p.veh === 1 ? roverModel() : vtolModel(); scene.add(v.vm); } if (v.vm) { v.vm.visible = !!p.veh; v.vm.position.set(v.x, v.y, v.z); v.vm.rotation.y = p.yaw; if (v.vk === 2) for (const r of v.vm.userData.rotors) r.rotation.y += dt * 30; } M.kneel(v.mesh, p.kn); v.kick = Math.max(0, (v.kick || 0) - dt * 8); v.mesh.userData.arms.rotation.x = v.kick * 0.25;
    if (!v.hpb) { v.hpb = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x40e070, depthTest: false })); v.hpb.center.set(0, 0.5); v.hpb.position.set(-0.9, 2.35, 0); v.hpb.renderOrder = 6; v.mesh.add(v.hpb); }
    const hf = Math.max(0, p.hp / p.mhp); v.hpb.scale.set(1.8 * hf + 0.001, 0.12, 1); v.hpb.material.color.setHex(hf < 0.3 ? 0xff4040 : 0x40e070);
  }
  for (const [id, v] of view.players) if (!seen.has(id)) { scene.remove(v.mesh); view.players.delete(id); }
  seen.clear();
  // supply crates float down on parachutes and vanish 60 s after landing; a countdown shows over each
  for (const o of S.O) {
    seen.add(o.id); let m = view.pods.get(o.id);
    if (!m) { m = M.supplyPod(); m.add(M.parachute()); { const bm = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.9, 70, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd040, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); bm.position.y = 35; bm.userData.beam = 1; m.add(bm); const rg = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.8, 36), new THREE.MeshBasicMaterial({ color: 0xffd040, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); rg.rotation.x = -Math.PI / 2; rg.position.y = 0.08; rg.userData.ring = 1; m.add(rg); } m.userData.label = timerLabel(); m.userData.label.position.y = 3.2; m.add(m.userData.label); scene.add(m); view.pods.set(o.id, m); m.gy = G.W.top(o.x, o.z); }
    const land = Math.max(0, o.land), life = Math.ceil(o.life ?? 0);
    m.position.set(o.x + Math.sin(G.time * 1.3 + o.id) * land * 0.15, m.gy + land * 4.5, o.z); m.rotation.y += dt * (land > 0 ? 0.4 : 1);
    m.children.forEach(c => { if (c.userData.chute) { c.visible = land > 0; c.rotation.z = Math.sin(G.time * 2 + o.id) * 0.08; } if (c.userData.beam) c.material.opacity = 0.22 + Math.sin(G.time * 3 + o.id) * 0.1; if (c.userData.ring) { c.visible = land <= 0; const k = 1 + (G.time * 0.8 % 1) * 0.6; c.scale.set(k, k, 1); c.material.opacity = 0.9 * (1 - (G.time * 0.8 % 1)); } });
    if (land <= 0 && Math.random() < dt * 4) smoke(o.x, m.gy + 1.2, o.z, 1, 0.6);
    if (land <= 0 && !m.landed) { m.landed = 1; burst(o.x, m.gy + 0.3, o.z, 0xc0a060, 12, 4, 0.6); smoke(o.x, m.gy + 2.4, o.z, 3, 1); audio.sfx('place', vol(dist(o.x, o.z))); }
    const txt = land > 0 ? 'INCOMING' : `${life}s`; if (m.userData.txt !== txt) { m.userData.txt = txt; setLabel(m.userData.label, txt); }
    m.userData.label.material.opacity = land <= 0 && life <= 10 ? (Math.sin(G.time * 10) > 0 ? 1 : 0.3) : 1;
  }
  for (const [id, m] of view.pods) if (!seen.has(id)) { scene.remove(m); view.pods.delete(id); }
  // reinforcements marching from the hub
  seen.clear();
  for (const m of S.L || []) {
    seen.add(m.id); let v = view.allies.get(m.id); const AL = ALLIES[m.type];
    if (!v) { const mesh = M.marine(AL.color, AL.gun); mesh.scale.setScalar(0.92); scene.add(mesh); v = { mesh, x: m.x, y: m.y, z: m.z, t: 0, acc: Math.random() * 0.3 }; view.allies.set(m.id, v); }
    const kk = 1 - Math.exp(-dt * 10), ox = v.x, oz = v.z; v.x += (m.x - v.x) * kk; v.y += (m.y - v.y) * kk; v.z += (m.z - v.z) * kk; const spd = Math.hypot(v.x - ox, v.z - oz) / Math.max(dt, 1e-4);
    v.t += dt * Math.min(spd, 6) * 1.8; M.animMarine(v.mesh, v.t, spd); v.mesh.position.set(v.x, v.y, v.z); v.mesh.rotation.y = m.ry;
    if (m.tg && !AL.splash) { v.acc += dt; const tv = view.aliens.get(m.tg); if (tv && v.acc > 1 / Math.min(AL.rate, 8)) { v.acc = 0; const mx = v.x - Math.sin(m.ry) * 0.9, mz = v.z - Math.cos(m.ry) * 0.9; tracer([mx, v.y + 1.3, mz], [tv.x, tv.y + ALIENS[tv.type].h * 0.6, tv.z], AL.gun === 'engineer' ? 0x60c0ff : 0xffe080, 0.05); const dd = dist(v.x, v.z); audio.gun(AL.gun === 'engineer' ? 'smg' : 'rifle', vol(dd) * 0.6, 1, Math.min(1, dd / 45)); flashAt([mx, v.y + 1.3, mz], 0.7); } }
  }
  for (const [id, v] of view.allies) if (!seen.has(id)) { scene.remove(v.mesh); view.allies.delete(id); }
  // the Brood Queen's lair
  if (G.W && G.W.cave && !G.explore) { const d = Math.hypot(G.me.x - G.W.cave.x, G.me.z - G.W.cave.z); if (d < 26 && !G.lairWarn) { G.lairWarn = true; const n = S.A.filter(a => a.type === 'royal').length; banner('THE BROOD QUEEN', `${n} Royal Guards defend her. She births more while you fight in here.`); audio.sfx('alarm'); } if (d > 45) G.lairWarn = false; if (G.W.caveLight) G.W.caveLight.intensity = 34 + Math.sin(G.time * 2.2) * 10; }
  // gunners' ammo crates, jungle spore clouds, mortar acid pools
  G.vx = G.vx || { M: new Map(), Z: [], K: [] };
  { const seen2 = new Set(); for (const c of S.M || []) { seen2.add(c.id); let m = G.vx.M.get(c.id); if (!m) { m = M.ammoCrate(); m.position.set(c.x, G.W.top(c.x, c.z), c.z); scene.add(m); G.vx.M.set(c.id, m); } m.rotation.y += dt; } for (const [id, m] of G.vx.M) if (!seen2.has(id)) { scene.remove(m); G.vx.M.delete(id); } }
  (S.Z || []).forEach((c, i) => { let m = G.vx.Z[i]; if (!m) { m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshBasicMaterial({ color: 0x80ff40, transparent: true, opacity: 0.18, depthWrite: false })); scene.add(m); G.vx.Z[i] = m; } m.scale.set(c.r, c.r * 0.45, c.r); m.position.set(c.x, G.W.top(c.x, c.z) + c.r * 0.2, c.z); if (Math.random() < dt * 20) burst(c.x + (Math.random() - 0.5) * c.r * 1.4, G.W.top(c.x, c.z) + Math.random() * 3, c.z + (Math.random() - 0.5) * c.r * 1.4, 0x9fff50, 1, 0.5, 1.2, 2); });
  G.vx.D = G.vx.D || new Map(); { const sn = new Set(); for (const d of S.D || []) { sn.add(d.id); let m = G.vx.D.get(d.id); if (!m) { m = M.drone(); scene.add(m); G.vx.D.set(d.id, m); m.position.set(d.x, d.y, d.z); m.acc = 0; } m.position.x += (d.x - m.position.x) * Math.min(1, dt * 6); m.position.y += (d.y - m.position.y) * Math.min(1, dt * 6); m.position.z += (d.z - m.position.z) * Math.min(1, dt * 6); m.rotation.y += dt * 2; m.acc += dt; const tv = d.tg && view.aliens.get(d.tg); if (tv && m.acc > 0.12) { m.acc = 0; tracer([m.position.x, m.position.y - 0.4, m.position.z], [tv.x, tv.y + 0.6, tv.z], 0xff8060, 0.05, 0.05); audio.gun('smg', vol(dist(m.position.x, m.position.z)) * 0.4, 1, 0.5); } } for (const [id, m] of G.vx.D) if (!sn.has(id)) { scene.remove(m); G.vx.D.delete(id); } }
  G.vx.Q = G.vx.Q || new Map(); { const sn = new Set(); for (const q of S.Q || []) { sn.add(q.id); let m = G.vx.Q.get(q.id); if (!m) { m = M.medCrate(q.r); m.position.set(q.x, G.W.top(q.x, q.z), q.z); scene.add(m); G.vx.Q.set(q.id, m); burst(q.x, G.W.top(q.x, q.z) + 1, q.z, 0x60ff90, 16, 4, 0.6); } m.children[m.children.length - 1].material.opacity = 0.3 + Math.sin(G.time * 4) * 0.15; } for (const [id, m] of G.vx.Q) if (!sn.has(id)) { scene.remove(m); G.vx.Q.delete(id); } }
  G.vx.S = G.vx.S || []; G.vx.S.forEach(m => m.visible = false); (S.S2 || []).forEach((d, i) => { let m = G.vx.S[i]; if (!m) { m = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14, 0, 6.29, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x60c0ff, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })); scene.add(m); G.vx.S[i] = m; } m.visible = true; m.scale.setScalar(d.r); m.position.set(d.x, d.y, d.z); m.material.opacity = 0.14 + Math.sin(G.time * 3) * 0.05; });
  G.vx.I = G.vx.I || new Map(); { const sn = new Set(); for (const it of S.I || []) { sn.add(it.id); let m = G.vx.I.get(it.id); if (!m) { m = it.kind === 'medkit' ? M.medCrate(0.8) : M.ammoCrate(); m.scale.setScalar(0.6); m.position.set(it.x, G.W.top(it.x, it.z), it.z); scene.add(m); G.vx.I.set(it.id, m); } m.rotation.y += dt * 1.5; } for (const [id, m] of G.vx.I) if (!sn.has(id)) { scene.remove(m); G.vx.I.delete(id); } }
  G.vx.K.forEach(m => m.visible = false); (S.K || []).forEach((q, i) => { let m = G.vx.K[i]; if (!m) { m = new THREE.Mesh(new THREE.CircleGeometry(1, 20), new THREE.MeshBasicMaterial({ color: 0x80ff30, transparent: true, opacity: 0.45, depthWrite: false })); m.rotation.x = -Math.PI / 2; scene.add(m); G.vx.K[i] = m; } m.visible = true; m.material.color.setHex(q.fire ? 0xff6010 : 0x80ff30); m.scale.setScalar(q.r); m.position.set(q.x, G.W.top(q.x, q.z) + 0.15, q.z); if (q.fire && Math.random() < dt * 30) flame(q.x + (Math.random() - 0.5) * q.r * 1.4, G.W.top(q.x, q.z) + 0.3, q.z + (Math.random() - 0.5) * q.r * 1.4, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2); });
  // the hub turns, and glows red when it is hit
  if (G.W) { const u = G.W.hub.userData; u.rings.rotation.z += dt * 0.6; u.rings.rotation.y += dt * 0.3; G.hubFlash = Math.max(0, (G.hubFlash || 0) - dt); u.shield.material.emissive.setHex(G.hubFlash > 0 ? 0xa02020 : 0x2060a0); u.core.material.emissiveIntensity = 1.2 + Math.sin(G.time * 3) * 0.4; G.W.hive.rotation.y += dt * 0.05; G.W.healRing.material.opacity = 0.35 + Math.sin(G.time * 3) * 0.2; }
}

// ---------------------------------------------------------------- the marine you play
const view2 = { gun: null };
const curGun = () => (G.me && G.me.slot === 1) ? SIDEARM : CLASSES[G.cls].gun;
function stats() {
  const C = CLASSES[G.cls], g = curGun(), my0 = mine(state()) || {}, u = {};
  return { dmg: g.dmg * dmgMul(), rate: g.rate * (1 + 0.08 * (u.rate || 0)) * (my0.adrT > 0 ? 1.4 : 1), mag: Math.ceil(g.mag * (1 + 0.2 * (u.mag || 0))), reload: g.reload * (1 - 0.08 * (u.mag || 0)), speed: C.speed * (my0.buf && my0.buf.fortify > 0 ? 0.45 : 1) * ((1 - 0.2 * ((state() || {}).wx || 0))) * (my0.adrT > 0 || my0.stimT > 0 ? 1.3 : 1), reserve: Math.ceil(g.reserve * (1 + 0.2 * (u.mag || 0))) };
}
function dmgMul() { return 1; }
function newMe() {
  const s = G.W.spawn; G.me = { x: s.x, y: 0, z: s.z, vy: 0, yaw: Math.atan2(s.x, s.z), pitch: -0.1, spin: 0, scope: false, slot: 0, wpn: [null, { ammo: SIDEARM.mag, reserve: SIDEARM.reserve }], ammo: CLASSES[G.cls].gun.mag, reserve: CLASSES[G.cls].gun.reserve, rel: 0, cd: 0, place: null, gcd: 0, kick: 0, sp: -1, hp: 0, bob: 0, grounded: true, rockets: [] };
  if (view2.gun) camera.remove(view2.gun); view2.gun = M.gunModel(G.cls, CLASSES[G.cls].color); view2.gun.scale.setScalar(0.55); view2.gun.traverse(o => { o.castShadow = false; }); camera.add(view2.gun);
  view2.flash = new THREE.PointLight(0xffc060, 0, 8); view2.flash.position.set(0.05, 0.05, -1.3); view2.gun.add(view2.flash);
  view2.fsp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); view2.fsp.position.set(0.05, 0.03, -1.45); view2.gun.add(view2.fsp);
  for (const k of ['pistol', 'tool', 'healer', 'thr']) { if (view2[k]) camera.remove(view2[k]); view2[k] = null; }
  const mk = (kind, x) => { const m = M.gunModel(kind, CLASSES[G.cls].color); m.scale.setScalar(0.55); m.position.set(x, -0.22, -0.45); m.visible = false; m.traverse(o => { o.castShadow = false; }); camera.add(m); return m; };
  view2.pistol = mk('pistol', 0.2); view2.tool = mk('torch', 0.18); view2.thr = M.throwModel(CLASSES[G.cls].throw.kind); view2.thr.position.set(0.22, -0.24, -0.5); view2.thr.visible = false; camera.add(view2.thr); if (CLASSES[G.cls].heal) view2.healer = mk('medigun', 0.18);
  if (view2.dress) camera.remove(view2.dress); view2.dress = new THREE.Group(); M.C(view2.dress, 0.05, 0.05, 0.07, 0xeeeae0, 0, 0, 0); M.C(view2.dress, 0.02, 0.02, 0.072, 0xb0aca0, 0, 0, 0); M.B(view2.dress, 0.06, 0.004, 0.09, 0xeeeae0, 0.03, -0.03, -0.04); M.B(view2.dress, 0.03, 0.03, 0.002, 0xd03030, 0, 0, 0.036); view2.dress.rotation.set(0.3, 0.4, 1.4); view2.dress.position.set(0.16, -0.2, -0.38); view2.dress.visible = false; camera.add(view2.dress);
  const glove = new THREE.Group(); M.B(glove, 0.12, 0.12, 0.22, 0x2a3036, 0.02, -0.14, 0.05); view2.gun.add(glove);
  if (view2.hand) camera.remove(view2.hand); view2.hand = M.hand(CLASSES[G.cls].color); view2.hand.scale.setScalar(0.55); camera.add(view2.hand); for (const d of view2.drops || []) camera.remove(d.m); view2.drops = [];
}
const ray = { o: new THREE.Vector3(), d: new THREE.Vector3() };
function aimRay(spread = 0) {
  camera.getWorldPosition(ray.o); camera.getWorldDirection(ray.d);
  if (spread) { ray.d.x += (Math.random() - 0.5) * spread * 2; ray.d.y += (Math.random() - 0.5) * spread * 2; ray.d.z += (Math.random() - 0.5) * spread * 2; ray.d.normalize(); }
  return ray;
}
// nearest alien along a ray, using a sphere per alien
const HEAD = { crawler: [1.1, 1.0, 0.32], spitter: [0.62, 2.15, 0.3], brute: [1.3, 1.3, 0.55], flyer: [0.7, 0.05, 0.25], ravager: [1.3, 1.3, 0.55], queen: [1.0, 5.8, 0.7] };
function sphereHit(o, d, cx, cy, cz, r) { const ox = cx - o.x, oy = cy - o.y, oz = cz - o.z, t = ox * d.x + oy * d.y + oz * d.z; if (t < 0) return -1; const d2 = ox * ox + oy * oy + oz * oz - t * t; return d2 > r * r ? -1 : t - Math.sqrt(r * r - d2); }
function hitAliens(o, d, maxD) {
  const out = [];
  for (const v of (G.explore && G.ex ? G.ex.wild : view.aliens.values())) {
    const A = ALIENS[v.type], big = v.type === 'ravager' ? 1.7 : 1, body = sphereHit(o, d, v.x, v.y + (A.fly ? 0 : A.h * 0.6 * big), v.z, A.r * 1.15);
    const hd = HEAD[v.type]; let head = -1; if (hd) { const ry = v.mesh.rotation.y; head = sphereHit(o, d, v.x - Math.sin(ry) * hd[0] * big, v.y + hd[1] * big, v.z - Math.cos(ry) * hd[0] * big, hd[2] * big * 1.1); }
    const hb = body >= 0 && body < maxD, hh = head >= 0 && head < maxD; if (!hb && !hh) continue;
    out.push(hh && (!hb || head <= body + 0.5) ? { v, t: head, head: true } : { v, t: body, head: false });
  }
  return out.sort((x, y) => x.t - y.t);
}
function hitAlien(o, d, maxD) {
  let best = null, bt = maxD;
  for (const v of view.aliens.values()) {
    const A = ALIENS[v.type], big = v.type === 'ravager' ? 1.7 : 1, r = A.r * 1.15, cy = v.y + (A.fly ? 0 : A.h * 0.6 * big);
    const ox = v.x - o.x, oy = cy - o.y, oz = v.z - o.z, t = ox * d.x + oy * d.y + oz * d.z; if (t < 0) continue;
    const d2 = ox * ox + oy * oy + oz * oz - t * t; if (d2 > r * r) continue; const th = t - Math.sqrt(r * r - d2); if (th < bt) { bt = th; best = v; }
  }
  return best ? { v: best, t: bt } : null;
}
function muzzle() { const p = new THREE.Vector3(0.05, 0.02, -0.75); (G.me && G.me.slot === 1 ? view2.pistol : view2.gun).localToWorld(p); return [p.x, p.y, p.z]; }
function shoot(st) {
  const C = CLASSES[G.cls], g = curGun(), me = G.me, myb = (mine(state()) || {}).buf || {}, lv = 0, power = 1; if (!(myb.storm > 0)) me.ammo--; me.cd = 1 / st.rate; me.kick = 1; me.shotN = (me.shotN || 0) + 1;
  if ((g.pellets || G.cls === 'sniper') && me.ammo > 0) me.pumpAt = 0.32;
  audio.gun(g.sound, 1, power, 0);
  // recoil: the view climbs and drifts; kneeling halves it; part of it settles back
  const rk0 = g.recoil * (myb.fortify > 0 ? 0.1 : 1) * (me.prone ? 0.3 : me.kneel ? 0.5 : 1) * (1 + 0.08 * lv) * (0.75 + Math.random() * 0.5); me.pitch = Math.min(1.5, me.pitch + rk0); me.yaw += (Math.random() - 0.5) * rk0 * 0.8; me.rcv = (me.rcv || 0) + rk0 * 0.55;
  me.heat = Math.min(12, (me.heat || 0) + 1); G.punch = Math.min(6, (G.punch || 0) + (g.kind === 'rocket' ? 5 : 0.9 * power)); G.shake = Math.max(G.shake || 0, (g.kind === 'rocket' ? 0.35 : 0.07) * power);
  const mz = muzzle(); G.flash = 0.05; flashLight(mz[0], mz[1], mz[2], 18 * power, 0.05);
  if (g.kind !== 'rocket') { const rx = Math.cos(me.yaw), rz = -Math.sin(me.yaw); casing(mz[0] + Math.sin(me.yaw) * 0.45 + rx * 0.12, mz[1] - 0.05, mz[2] + Math.cos(me.yaw) * 0.45 + rz * 0.12, rx * 2.5, 2.5, rz * 2.5); }
  else smoke(mz[0], mz[1], mz[2], 3, 0.4);
  if (g.kind === 'rocket') {
    const r = aimRay(0); const v = r.d.clone().multiplyScalar(48);
    const rk = { x: r.o.x + r.d.x * 0.8, y: r.o.y + r.d.y * 0.8 - 0.15, z: r.o.z + r.d.z * 0.8, vx: v.x, vy: v.y, vz: v.z, t: g.life, mesh: null, napalm: myb.napalm > 0 };
    // where it will land, so friends can see it fly there
    const sim = { ...rk }; let tt = 0; while (tt < g.life) { if (stepRocket(sim, 0.02)) break; tt += 0.02; }
    send({ k: 'rk', a: mz, b: [sim.x, sim.y, sim.z], t: Math.max(0.05, tt) });
    const m = new THREE.Group(); M.C(m, 0.1, 0.1, 0.7, 0xdddddd, 0, 0, 0).rotation.x = Math.PI / 2; M.S(m, 0.14, 0xffa040, 0, 0, 0.4, 1, 1, 1, { e: 0xff6000 }); m.position.set(...mz); scene.add(m); rk.mesh = m; me.rockets.push(rk);
    return;
  }
  const mx = g.max, spr = (me.scope ? g.scoped : g.spread) * (me.ads ? 0.45 : 1) * (myb.fortify > 0 ? 0.4 : 1) * (me.moving ? 1.6 : 1) * (me.prone ? 0.2 : me.kneel ? 0.4 : 1) * (1 + Math.min(1.5, me.heat * 0.09)) * (me.y > G.W.ground(me.x, me.z, me.y + 0.5) + 0.2 ? 2 : 1);
  const col = G.cls === 'engineer' ? 0xffc070 : G.cls === 'sniper' ? 0x80f0ff : 0xffe080, oc = me.oc && G.cls === 'sniper'; me.oc = false; let hitAny = false, head = false, weak = false;
  for (let k = 0; k < (g.pellets || 1); k++) {
    const r = aimRay(spr), wall = G.W.T.ray(r.o, r.d, mx), list = hitAliens(r.o, r.d, Math.min(mx, wall)), n = g.pierce ? (oc ? 99 : g.pierce) : 1; let end;
    if (list.length) {
      for (const q of list.slice(0, n)) { const fall = q.t <= g.near ? 1 : Math.max(0.3, 1 - 0.7 * (q.t - g.near) / (g.far - g.near)), hm = q.head ? (G.cls === 'sniper' ? 2.5 : 2) : 1, dd = +(st.dmg * fall * hm * (oc ? 4 : 1)).toFixed(1);
        if (q.v.wild) G.ex.hurt(q.v, dd); else req({ a: 'hit', id: q.v.id, d: dd });
        if (me.airN > 0 && k === 0) { const hp0 = [r.o.x + r.d.x * q.t, r.o.y + r.d.y * q.t, r.o.z + r.d.z * q.t]; if (G.explore && G.ex) G.ex.splash(...hp0, 3, 45); else req({ a: 'boom', x: hp0[0], y: hp0[1], z: hp0[2], r: 3, d: 45 }); } const hp = [r.o.x + r.d.x * q.t, r.o.y + r.d.y * q.t, r.o.z + r.d.z * q.t]; burst(hp[0], hp[1], hp[2], 0x70ff40, q.head ? 6 : 3, q.head ? 3 : 2, 0.25); if (q.head) head = true; if (fall < 0.6) weak = true; hitAny = true; }
      const q0 = list[Math.min(list.length, n) - 1]; end = [r.o.x + r.d.x * q0.t, r.o.y + r.d.y * q0.t, r.o.z + r.d.z * q0.t];
    } else { const t = Math.min(mx, wall); end = [r.o.x + r.d.x * t, r.o.y + r.d.y * t, r.o.z + r.d.z * t]; if (t < mx) { burst(end[0], end[1] + 0.1, end[2], G.W.def.ground, 3, 2, 0.35, 1.3); if (k < 2) impactMark(end[0], end[1], end[2]); } }
    if (g.tracers || (G.cls === 'sniper' || g.pellets ? k < 3 : me.shotN % 3 === 0)) tracer(G.cls === 'sniper' && me.scope ? [r.o.x + r.d.x * 0.5, r.o.y - 0.15, r.o.z + r.d.z * 0.5] : mz, end, oc ? 0xffffff : g.tracers ? 0xff7a30 : col, G.cls === 'sniper' ? 0.2 : g.tracers ? 0.07 : 0.05, (G.cls === 'sniper' ? (oc ? 0.2 : 0.09) : g.pellets ? 0.02 : 0.035) * power);
    if (k < 2 && (!g.tracers || me.shotN % 2 === 0)) send({ k: 'tr', a: mz.map(v => +v.toFixed(1)), b: end.map(v => +v.toFixed(1)), c: col, s: k ? '' : g.sound, p: +power.toFixed(2) });
  }
  if (me.airN > 0) me.airN--;
  if (hitAny) { G.hitT = 0.12; G.hitWeak = weak && !head; G.hitHead = head; audio.sfx(head ? 'headshot' : 'hit', head ? 0.9 : 0.5); }
}
function aimPoint(max) { const r = aimRay(0), t = Math.min(max, G.W.T.ray(r.o, r.d, max)); return [r.o.x + r.d.x * t, r.o.z + r.d.z * t]; }
// slot 4: a frag or sticky charge is thrown here; health kits, ammo packs and claymores are placed by the host
function throwItem(my) {
  const T0 = CLASSES[G.cls].throw; if ((my.items || 0) <= 0) { toast(`No ${T0.name.toLowerCase()}s left: restock at the hub or a Forward Resupply.`, 2.5); return; }
  if (T0.kind === 'frag') { const r = aimRay(0), a = [r.o.x + r.d.x * 0.5, r.o.y - 0.2, r.o.z + r.d.z * 0.5], v = [r.d.x * 17, r.d.y * 17 + 5, r.d.z * 17]; grenade(a, v, true); send({ k: 'gr', a: a.map(q => +q.toFixed(2)), v: v.map(q => +q.toFixed(2)) }); req({ a: 'throw' }); audio.sfx('grenade'); return; }
  const [x, z] = aimPoint(12); req({ a: 'throw', x: +x.toFixed(1), z: +z.toFixed(1), ry: +G.me.yaw.toFixed(2) }); audio.sfx('grenade');
}
function frontOf(d) { const me = G.me; return { x: +(me.x - Math.sin(me.yaw) * d).toFixed(2), z: +(me.z - Math.cos(me.yaw) * d).toFixed(2), ry: +me.yaw.toFixed(2) }; }
function dropNew(kind, my) {
  const T = TURRETS[kind]; if (!T) return;
  // pressing the key of the turret in your hands puts it back in your pack
  const held = (state() || { T: [] }).T.find(t => t.carry === G.myId); if (held && held.kind === kind) { req({ a: 'stow' }); G.me.carry = 0; audio.sfx('pouch', 0.8); return; }
  if (held) { req({ a: 'stow' }); my = Object.assign({}, my, { kits: (my.kits ?? 2) + 1, gold: my.gold + (held.spent || 0) }); }
  if ((my.kits ?? 2) < 1) { audio.sfx('nope'); toast('No turret kits left: pick up more in the hub (you carry 2).', 2.5); return; }
  if (my.gold < T.cost) { audio.sfx('nope'); toast(`Need ${T.cost} gold for a ${T.name}.`, 2); return; }
  if (T.ball) { // the sentry ball is thrown, not carried: it arcs out to where you are looking
    const r = aimRay(0), hl = Math.hypot(r.d.x, r.d.z) || 1; let d = G.W.T.ray(r.o, r.d, 26); d = Math.min(isFinite(d) ? d : 18, 26 / hl, 26); const x = r.o.x + r.d.x * d, z = r.o.z + r.d.z * d, y1 = G.W.top(x, z);
    const ball = M.turret('uav', CLASSES[G.cls].color); ball.scale.setScalar(0.8); scene.add(ball); const a = new THREE.Vector3(G.me.x, G.me.y + 1.5, G.me.z), t0 = performance.now(); audio.sfx('grenade', 0.6);
    const fly = () => { const f = Math.min(1, (performance.now() - t0) / 700); ball.position.set(a.x + (x - a.x) * f, a.y + (y1 - a.y) * f + Math.sin(f * Math.PI) * 4, a.z + (z - a.z) * f); ball.rotation.x += 0.3; if (f < 1) requestAnimationFrame(fly); else { scene.remove(ball); req({ a: 'place', kind, x: +x.toFixed(2), z: +z.toFixed(2), ry: 0, thrown: 1 }); audio.sfx('tink', 0.8); } };
    requestAnimationFrame(fly); return; }
  req({ a: 'place', kind, ...frontOf(1.7) }); audio.sfx('place', 0.6); toast(`${T.name} in hand: left click puts it down · press the key again or switch weapons to put it away`, 2.5);
}
function dropCarried() { if (!G.me.carry) return; req({ a: 'drop', ...frontOf(1.9) }); G.me.carry = 0; G.me.holdFire = true; audio.sfx('place', 0.8); }
function setSlot(n) {
  if (G.me.carry) { req({ a: 'stow' }); G.me.carry = 0; audio.sfx('pouch', 0.8); }
  const me = G.me; if (n === 4 && !CLASSES[G.cls].heal) return; if (n === me.slot) return; if (me.slot <= 1) me.wpn[me.slot] = { ammo: me.ammo, reserve: me.reserve };
  me.slot = n; me.rel = 0; me.shells = false; if (n <= 1) { const w = me.wpn[n] || { ammo: CLASSES[G.cls].gun.mag, reserve: CLASSES[G.cls].gun.reserve }; me.ammo = w.ammo; me.reserve = w.reserve; } me.cd = 0.35; audio.sfx('magin', 0.5);
}
addEventListener('wheel', e => { if (!G.on || !locked() || !G.me || G.me.scope) return; const order = CLASSES[G.cls].heal ? [0, 1, 2, 3, 5, 4] : [0, 1, 2, 3, 5], i = order.indexOf(G.me.slot); setSlot(order[(i + (e.deltaY > 0 ? 1 : order.length - 1)) % order.length]); });
// ---------------------------------------------------------------- reloading: the left hand pulls the empty magazine, drops it, takes a fresh one off the vest,
// seats it and works the bolt (the side arm racks its slide; the rocket goes in the muzzle; the shotgun is fed shell by shell, then pumped)
const _hp = new THREE.Vector3(), _hq = new THREE.Vector3(), _he = [0, 0, 0];
const HANDPTS = { // in the gun's own units: where the hand rests, the bolt or slide, the muzzle and the shell port
  assault: { rest: [0, -0.1, -0.42], bolt: [-0.07, 0.08, 0] }, medic: { rest: [0, -0.09, -0.32], bolt: [-0.06, 0.07, 0.05] }, sniper: { rest: [0, -0.08, -0.3], bolt: [0.08, 0.05, 0.12] },
  gunner: { rest: [0, 0.23, 0.05], bolt: [-0.12, 0.06, 0.15] }, heavy: { rest: [0, -0.13, -0.3], muz: [0, 0, -0.74] }, engineer: { rest: [0, -0.12, -0.28], port: [0, -0.1, -0.02], bolt: [0, -0.12, -0.28] },
  pistol: { rest: [-0.05, -0.13, 0.04], bolt: [0, 0.12, 0.02] } };
const HROT = { rest: [0.1, -0.35, 2.85], grip: [0.35, -0.45, 3.14], down: [0.6, -0.5, 2.7], below: [0.4, -0.45, 3.0], pouch: [0.8, -0.6, 2.6], bolt: [0, -0.8, 1.75], boltB: [0, -0.8, 1.75], front: [-0.3, -0.4, 1.9], muzzle: [-0.2, -0.4, 1.9], port: [0.2, -0.6, 2.4], portB: [0.4, -0.6, 2.5] };
const RKEYS = {
  mag: [[0, 'rest', 0], [0.12, 'grip', 0], [0.22, 'down', 1], [0.33, 'pouch', 0], [0.4, 'pouch', 2], [0.5, 'below', 2], [0.56, 'grip', 2], [0.64, 'bolt', 0], [0.72, 'boltB', 0], [0.78, 'bolt', 0], [0.94, 'rest', 0], [1.01, 'rest', 0]],
  rocket: [[0, 'rest', 0], [0.2, 'pouch', 0], [0.28, 'pouch', 3], [0.47, 'front', 3], [0.64, 'muzzle', 3], [0.74, 'muzzle', 0], [0.94, 'rest', 0], [1.01, 'rest', 0]],
  shell: [[0, 'pouch', 4], [0.55, 'portB', 4], [0.8, 'port', 0], [1.01, 'pouch', 0]] };
const sm = t => t * t * (3 - 2 * t);
function heldMesh(g, kind) {
  const u = g.userData; u.held ??= {}; if (u.held[kind]) return u.held[kind]; let m;
  if (kind === 'mag' && u.mag) { m = new THREE.Mesh(u.mag.geometry, u.mag.material); m.userData.h = u.mag.geometry.parameters.height; }
  else if (kind === 'rocket') { m = new THREE.Group(); M.S(m, 0.09, 0xd0d0d0, 0, 0, -0.16, 1, 1, 2); M.C(m, 0.05, 0.05, 0.3, 0x40464e, 0, 0, 0.08).rotation.x = Math.PI / 2; m.userData.h = 0.1; }
  else { m = new THREE.Group(); M.C(m, 0.028, 0.028, 0.1, 0xc02020, 0, 0, -0.02).rotation.x = Math.PI / 2; M.C(m, 0.03, 0.03, 0.03, 0xd0a040, 0, 0, 0.045).rotation.x = Math.PI / 2; m.userData.h = 0.04; }
  m.visible = false; view2.hand.add(m); return u.held[kind] = m;
}
function animReload(me, gn, my, dt) {
  const hd = view2.hand; if (!hd) return; me.jolt = Math.max(0, (me.jolt || 0) - dt * 6);
  for (const d of view2.drops) { d.t += dt; d.vy -= 9 * dt; d.m.position.y += d.vy * dt * 0.35; d.m.position.x -= dt * 0.05; d.m.rotation.x += dt * 3; d.m.rotation.z += dt * 2; }
  view2.drops = view2.drops.filter(d => { if (d.t > 1.2) { camera.remove(d.m); return false; } return true; });
  const pistol = me.slot === 1, g = pistol ? view2.pistol : gn; if (!g) return; const u = g.userData;
  for (const k in u.held || {}) u.held[k].visible = false;
  if (!(me.slot <= 1 && g.visible && !my.dead)) { hd.visible = false; return; }
  if (pistol) g.rotation.set(0, 0, 0);
  const cls = pistol ? 'pistol' : G.cls, P = HANDPTS[cls] || HANDPTS.assault, rocket = cls === 'heavy';
  u.magY0 ??= u.mag ? u.mag.position.y : 0; const magH = u.mag ? u.mag.geometry.parameters.height : 0.2;
  const f = me.rel > 0 ? Math.min(1, 1 - me.rel / (me.relT || 1)) : -1, shells = !pistol && me.shells;
  // the gun tips toward you while you work on it, and jolts when the magazine seats or the bolt slams home
  const tl = f >= 0 ? Math.sin(f * Math.PI) : shells ? 0.8 : 0;
  if (rocket) { g.rotation.x -= tl * 0.35; g.rotation.z += tl * 0.3; g.position.y -= tl * 0.04; } else { g.rotation.z += tl * 0.22; g.rotation.x += tl * 0.12; g.rotation.y += tl * 0.1; g.position.x -= tl * 0.09; g.position.y += tl * 0.11; g.position.z -= tl * 0.03; }
  g.position.y += me.jolt * 0.012; g.rotation.x += me.jolt * 0.05;
  g.updateMatrix();
  const pt = (name, out) => { // a named spot, in camera space
    if (name === 'pouch') return out.set(-0.3, -0.62, -0.5);
    let v; const m = u.mag ? [u.mag.position.x, u.magY0 - magH / 2 - 0.03, u.mag.position.z] : [0, -0.2, 0];
    if (name === 'rest') v = cls === 'engineer' && u.pump ? [0, u.pump.position.y - 0.065, u.pump.position.z] : P.rest;
    else if (name === 'grip') v = m; else if (name === 'down') v = [m[0], m[1] - 0.4, m[2] + 0.06]; else if (name === 'below') v = [m[0], m[1] - 0.14, m[2]];
    else if (name === 'bolt') v = P.bolt || P.rest; else if (name === 'boltB') v = [(P.bolt || P.rest)[0], (P.bolt || P.rest)[1], (P.bolt || P.rest)[2] + 0.13];
    else if (name === 'muzzle') v = P.muz || P.rest; else if (name === 'front') v = [P.muz[0], P.muz[1] + 0.06, P.muz[2] - 0.4];
    else if (name === 'port') v = P.port || P.rest; else if (name === 'portB') v = [P.port[0], P.port[1] - 0.09, P.port[2] + 0.09]; else v = P.rest;
    return out.set(v[0], v[1], v[2]).applyMatrix4(g.matrix);
  };
  let a = 'rest', b = 'rest', t = 0, held = 0;
  const K = shells ? RKEYS.shell : f >= 0 ? (rocket ? RKEYS.rocket : RKEYS.mag) : null, ff = shells ? Math.max(0, Math.min(1, 1 - me.shellT / (me.shellP || 0.42))) : f;
  if (K && (u.mag || rocket || shells)) { let i = 0; while (i < K.length - 2 && ff >= K[i + 1][0]) i++; a = K[i][1]; b = K[i + 1][1]; t = sm(Math.max(0, Math.min(1, (ff - K[i][0]) / (K[i + 1][0] - K[i][0])))); held = K[i][2]; }
  else if (me.pumpAnim > 0 && cls === 'sniper') { a = 'bolt'; b = 'boltB'; t = Math.sin((0.3 - me.pumpAnim) / 0.3 * Math.PI); }
  pt(a, _hp); pt(b, _hq); hd.position.lerpVectors(_hp, _hq, t); const ra = HROT[a], rb = HROT[b]; hd.rotation.set(ra[0] + (rb[0] - ra[0]) * t, ra[1] + (rb[1] - ra[1]) * t, ra[2] + (rb[2] - ra[2]) * t); hd.visible = true;
  // what the hand carries; the magazine in the gun hides while it is out
  if (u.mag) { u.mag.position.y = u.magY0; u.mag.visible = !(f >= 0.12 && f < 0.56); }
  if (held) { const m = heldMesh(g, held === 3 ? 'rocket' : held === 4 ? 'shell' : 'mag'); m.visible = true; m.position.set(0, held === 3 ? -0.09 : -(m.userData.h / 2 + 0.03), held === 3 ? 0 : -0.01); m.rotation.set(0, held === 3 ? 0 : 0, 0); }
  // let go of the empty magazine once: it tumbles out of sight
  if (f >= 0.22 && f < 0.5 && !(me.rs & 64) && u.mag) { me.rs |= 64; const m = new THREE.Mesh(u.mag.geometry, u.mag.material); m.scale.setScalar(0.55); hd.updateMatrixWorld(); const w = new THREE.Vector3(0, -(magH / 2 + 0.03), -0.01); hd.localToWorld(w); camera.worldToLocal(w); m.position.copy(w); m.quaternion.copy(hd.quaternion); camera.add(m); view2.drops.push({ m, t: 0, vy: -0.5 }); }
}
function startReload(st, S) { const g = curGun(), me = G.me; if (g.pellets) { me.shells = true; me.shellT = me.shellP = 0.42; return; } me.rel = me.relT = st.reload * reloadMul(S); me.rs = 0; }
function surface(me) {
  const T = G.W.T, W = G.W; if (W.fob) return T.hubAt(me.x, me.z) ? 'concrete' : W.def.weather === 'snow' ? 'snow' : W.def.weather === 'rain' ? 'grass' : 'sand';
  const raw = T.raw(me.x, me.z); if (me.y > raw + 0.4) return 'metal';                       // bridges, walls, towers, roofs
  const hb = T.hubAt(me.x, me.z); if (hb) return 'concrete'; if (W.path.near(me.x, me.z).d < 5) return 'gravel';
  if (W.def.weather === 'snow') return 'snow'; if (W.def.weather === 'rain') return 'grass';
  return Math.abs(T.raw(me.x + 1, me.z) - raw) > 0.7 ? 'rock' : 'sand';
}
const revealed = a => a.rv !== undefined ? !!a.rv : (a.rev > 0 || a.markT > 0);
// top up both guns' spare rounds by a fraction of what they can carry
function refillAmmo(f) { const me = G.me, main = CLASSES[G.cls].gun; for (const n of [0, 1]) { const g = n ? SIDEARM : main; if (me.slot === n) me.reserve = Math.min(g.reserve, me.reserve + g.reserve * f); else { const w = me.wpn[n] || (me.wpn[n] = { ammo: g.mag, reserve: 0 }); w.reserve = Math.min(g.reserve, w.reserve + g.reserve * f); } } }
function vehCode() { const v = G.ex && G.ex.veh; return v ? (v.kind === 'rover' ? 1 : 2) : 0; }
function exploreState(S) { return Object.assign({}, S, { A: [], T: [], O: [], I: [], L: [], M: [], Z: [], K: [], D: [], Q: [], S2: [], ph: 'explore', open: 0 }); }
function updateFootless() { const gn = view2.gun; if (gn) gn.visible = false; if (view2.tool) view2.tool.visible = false; }
// after victory: the cinematic, then the forward base
function startFob() {
  if (G.cine || G.explore) return; G.cine = true; if (document.pointerLockElement) document.exitPointerLock(); document.body.classList.add('cine'); $('end').hidden = true;
  // hide the battle's live pieces; the scene brings its own queen and marines
  for (const c of camera.children) c.visible = false; if (view2.laser) view2.laser.visible = false;
  for (const m of [view.aliens, view.players, view.allies]) for (const v of m.values()) { (v.mesh || v).visible = false; if (v.bar) v.bar.visible = false; }
  const S0 = state(), squad = (S0 && S0.P.length ? S0.P : [{ cls: G.cls }]).map(p => ({ cls: p.cls, color: CLASSES[p.cls].color }));
  const swap = () => { clearWorld(); G.W = buildFOB(scene, G.map); G.explore = true; makeWeather(); applyQuality(); return G.W; };
  victoryScene(H, squad, swap, () => {
    G.cine = false; G.ex = new Explore(H); G.ex.setup(G.W);
    const me = G.me; me.x = G.W.spawn.x; me.z = G.W.spawn.z; me.y = G.W.T.raw(me.x, me.z); me.vy = 0; me.yaw = Math.PI / 2; me.reserve = stats().reserve; document.body.classList.remove('cine'); document.body.classList.add('explore');
    H.fade(false); banner('FOB VALOR', 'The Marine Corps forward base. Explore the planet: rovers to the south, VTOLs on the pads to the east'); music.set('title'); canvas.requestPointerLock();
  });
}
const H = { scene, camera, audio, keys, hits, KB, G, M, toast: (m, t) => toast(m, t), prompt: h => prompt(h), banner: (a, b) => banner(a, b), burst: (...a) => burst(...a), boomFx: (...a) => boomFx(...a), tracer: (...a) => tracer(...a), flashAt: (...a) => flashAt(...a),
  mouseL: () => mouseL && locked(), shake: v => { G.shake = Math.max(G.shake || 0, v); }, hurtFlash: () => { G.hurtT = 0.35; audio.sfx('hurt', 0.6); }, keyName: c => keyName(c), fade: on => { $('fade').style.opacity = on ? 1 : 0; },
  caption: (a, b) => { const c = $('cap'); clearTimeout(c._t); if (a) $('capA').textContent = a; else if (!c.classList.contains('on')) $('capA').textContent = ''; $('capB').textContent = b || ''; c.classList.add('on'); c._t = setTimeout(() => c.classList.remove('on'), 5200); } };
function reloadMul(S) { return S.P.some(p => p.id !== G.myId && p.cls === 'assault' && !p.dead && Math.hypot(p.x - G.me.x, p.z - G.me.z) < 14) ? 0.75 : 1; }
// medic heal beam and engineer plasma torch: find what is in the crosshair and tell the host ten times a second
function updateBeam(dt, S) {
  const me = G.me, laser = view2.laser; if (laser) laser.visible = false; $('weld').hidden = true;
  if (!me.beam) { me.beamAcc = 0; return; } const rc = me.slot === 4 ? 'heal' : 'repair', fx = -Math.sin(me.yaw) * Math.cos(me.pitch), fy = Math.sin(me.pitch), fz = -Math.cos(me.yaw) * Math.cos(me.pitch), ey = me.y + 1.7;
  let best = null, bs = 0.95, k = ''; const reach = G.cls === 'engineer' ? 8 : 6;
  const look = (q, kk, range, h = 1.1) => { const dx = q.x - me.x, dy = (q.y || 0) + h - ey, dz = q.z - me.z, d = Math.hypot(dx, dy, dz); if (d > range || d < 0.5) return; const c = (dx * fx + dy * fy + dz * fz) / d; if (c > bs) { bs = c; best = q; k = kk; } };
  if (rc === 'heal') { for (const p of S.P) if (p.id !== G.myId && !p.dead) look(p, 'p', 16); for (const m of S.L || []) look(m, 'a', 16); }
  else { for (const t of S.T) if (!t.carry && t.kind !== 'claymore') look(t, 't', reach + 1.5); if (!best) { bs = 0.93; for (const a of S.A) if (!a.dead) look(a, 'x', reach + ALIENS[a.type].r, ALIENS[a.type].h * 0.6); } }
  const my = mine(S) || {}, pw = my.pw ?? 100, pmax = G.cls === 'engineer' ? 160 : 100;
  if (rc === 'repair') {
    // the torch is a short laser: it ends at what it touches, or a few metres out
    const m = muzzleTool(), end = best ? [best.x, (best.y || 0) + (k === 'x' ? ALIENS[best.type].h * 0.6 : 1.1), best.z] : [ey * 0 + me.x + fx * reach * 0.7, ey + fy * reach * 0.7, me.z + fz * reach * 0.7];
    if (pw > 0) { if (!laser) { view2.laser = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); view2.laser.add(new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 1, 8, 1, true), new THREE.MeshBasicMaterial({ color: k === 'x' ? 0xff6020 : 0x3090ff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }))); scene.add(view2.laser); }
      const L = view2.laser, a = new THREE.Vector3(...m), b = new THREE.Vector3(...end), len = a.distanceTo(b); L.position.copy(a).lerp(b, 0.5); L.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); L.scale.set(0.022 + Math.random() * 0.01, len, 0.022 + Math.random() * 0.01); L.children[0].material.color.setHex(k === 'x' ? 0xff6020 : 0x3090ff); L.material.color.setHex(k === 'x' ? 0xffc090 : 0xbff0ff); L.visible = true;
      if (Math.random() < 0.7) burst(end[0], end[1], end[2], k === 'x' ? 0xff8040 : 0x9fe0ff, 2, 2.2, 0.25); if (Math.random() < dt * 8) audio.sfx('torch', 0.35); }
    // the build bar: repair, or an upgrade climbing to completion
    if (best && k === 't') { const T = TURRETS[best.kind], up = best.hp < best.mhp ? null : best.lvl >= 3 ? 'max' : (best.up || 0); $('weld').hidden = false;
      setT('weldT', up === null ? `REPAIRING ${T.name.toUpperCase()}` : up === 'max' ? `${T.name.toUpperCase()} · MAX LEVEL` : `UPGRADING TO LV ${best.lvl + 1}`); $('weldBar').style.width = (up === null ? best.hp / best.mhp : up === 'max' ? 1 : up) * 100 + '%'; $('weld').classList.toggle('rep', up === null); }
    else if (best && k === 'x') { $('weld').hidden = false; setT('weldT', `BURNING ${ALIENS[best.type].name.toUpperCase()}`); $('weldBar').style.width = Math.max(0, best.hp / best.mhp) * 100 + '%'; $('weld').classList.add('rep'); }
    if (pw <= 0) prompt('<span class="bad">Welder out of power</span> · recharge in the hub, at a Forward Resupply or Ammo Cache, or grab a supply drop'); else if (!best) prompt(`Welding laser · repairs and upgrades turrets, burns aliens up close · power ${Math.round(pw / pmax * 100)}%`);
  }
  me.beamAcc = (me.beamAcc || 0) + dt; if (me.beamAcc < 0.1) return; const d0 = me.beamAcc; me.beamAcc = 0;
  if (rc === 'heal') { req({ a: 'heal', id: best ? best.id : '', k: best ? k : '', dt: +d0.toFixed(2) }); prompt(best ? `Healing ${best.name ? esc(best.name) : ALLIES[best.type].name} · ${Math.ceil(best.hp)}/${best.mhp}` : 'Heal beam: aim at a teammate (healing yourself slowly)'); if (Math.random() < 0.5) burst(...muzzleTool(), 0x60ff90, 2, 1.5, 0.2); }
  else if (pw > 0) req({ a: 'repair', id: best ? best.id : '', k: k === 'x' ? 'a' : 't', dt: +d0.toFixed(2) });
}
// any marine can patch up a damaged turret, wall or mine by holding the repair key close to it
function handRepair(dt, S) {
  const me = G.me; if (me.beam) return; const fx = -Math.sin(me.yaw), fz = -Math.cos(me.yaw); let best = null, bs = 0.7;
  for (const t of S.T) { if (t.hp >= t.mhp) continue; const dx = t.x - me.x, dz = t.z - me.z, d = Math.hypot(dx, dz); if (d > 5 || d < 0.3) continue; const c = (dx * fx + dz * fz) / d; if (c > bs) { bs = c; best = t; } }
  if (!best) return; if (!keys[KB.repair]) { if (!G.lookT || G.lookT !== best) prompt(`<b>${keyName(KB.repair)}</b> hold to repair ${TURRETS[best.kind].name} · ${Math.ceil(best.hp)}/${best.mhp}`); return; }
  me.repAcc = (me.repAcc || 0) + dt; prompt(`Repairing ${TURRETS[best.kind].name} · ${Math.ceil(best.hp)}/${best.mhp}` + (G.cls === 'engineer' ? '' : ' · Engineers repair 3x faster')); if (me.repAcc < 0.1) return; req({ a: 'repair', id: best.id, dt: +me.repAcc.toFixed(2) }); me.repAcc = 0;
}
function muzzleTool() { const p = new THREE.Vector3(0, 0.02, -0.7); ((G.me.slot === 4 ? view2.healer : view2.tool) || view2.gun).localToWorld(p); return [p.x, p.y, p.z]; }
// rocket step; true when it bursts
function flame(x, y, z, vx, vz) { const m = M.mat(Math.random() < 0.5 ? 0xff8020 : 0xffd040, { e: 0xff6000, ei: 1.5 }); let p = FX.parts.find(q => !q.alive); if (!p) { if (FX.parts.length > (G.maxParts || 220)) return; p = { mesh: new THREE.Mesh(partGeo, m) }; scene.add(p.mesh); FX.parts.push(p); } p.alive = true; p.smoke = false; p.mesh.visible = true; p.mesh.material = m; p.mesh.position.set(x, y, z); p.mesh.scale.setScalar(2 + Math.random() * 2); p.vx = vx; p.vy = 1 + Math.random() * 2; p.vz = vz; p.life = 0.45 + Math.random() * 0.25; p.gy = -99; }
function casing(x, y, z, vx, vy, vz) { const m = M.mat(0xc8a040, { m: 0.8, r: 0.3 }); let p = FX.parts.find(q => !q.alive); if (!p) { if (FX.parts.length > (G.maxParts || 220)) return; p = { mesh: new THREE.Mesh(partGeo, m) }; scene.add(p.mesh); FX.parts.push(p); } p.alive = true; p.smoke = false; p.mesh.visible = true; p.mesh.material = m; p.mesh.position.set(x, y, z); p.mesh.scale.set(0.18, 0.18, 0.4); p.vx = vx + (Math.random() - 0.5); p.vy = vy + Math.random(); p.vz = vz + (Math.random() - 0.5); p.life = 1.2; p.casing = 1; p.gy = G.W.ground(x, z, y) + 0.03; }
function stepRocket(r, dt) {
  r.x += r.vx * dt; r.y += r.vy * dt; r.z += r.vz * dt; r.t -= dt;
  if (G.W.T.solid(r.x, r.y, r.z) || r.t <= 0 || Math.abs(r.x) > BOUNDS + 5 || Math.abs(r.z) > BOUNDS + 5) return true;
  for (const c of G.W.colliders) if (Math.hypot(r.x - c.x, r.z - c.z) < c.r && r.y < G.W.top(c.x, c.z) + 5) return true;
  for (const v of view.aliens.values()) { const A = ALIENS[v.type], big = v.type === 'ravager' ? 1.7 : 1; if (Math.hypot(r.x - v.x, r.y - (v.y + (A.fly ? 0 : A.h * 0.6 * big)), r.z - v.z) < A.r * 1.2) return true; }
  return false;
}
// what this player's game tells the others about (shots, rockets, grenades)
function send(e) { if (G.mode === 'client') { e.f = G.myId; G.net.send({ t: 'fx', e }); } else if (G.mode === 'host') { e.f = G.myId; G.out.push(e); } }

let ghost = null, ghostKind = '', ghostRing = null;
const ghostOk = new THREE.MeshBasicMaterial({ color: 0x40ff80, transparent: true, opacity: 0.45, depthWrite: false }), ghostBad = new THREE.MeshBasicMaterial({ color: 0xff4040, transparent: true, opacity: 0.45, depthWrite: false });
function setGhost(kind) {
  if (ghost) { scene.remove(ghost); ghost = null; } if (ghostRing) { scene.remove(ghostRing); ghostRing = null; } ghostKind = kind; if (!kind) return;
  ghost = M.turret(kind, 0xffffff); ghost.traverse(o => { if (o.isMesh) { o.material = ghostOk; o.castShadow = false; } }); scene.add(ghost);
  const r = TURRETS[kind].range; if (r && kind !== 'stasis' && kind !== 'uav' && kind !== 'claymore') { ghostRing = new THREE.Mesh(new THREE.RingGeometry(r - 0.15, r, 64), new THREE.MeshBasicMaterial({ color: 0x80ffa0, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })); ghostRing.rotation.x = -Math.PI / 2; ghostRing.position.y = 0.08; scene.add(ghostRing); }
}
function updatePlace(S) {
  const me = G.me; if (!me.place) { if (ghost) setGhost(''); return; }
  if (ghostKind !== me.place) setGhost(me.place);
  const r = aimRay(0), hl = Math.hypot(r.d.x, r.d.z) || 1; let t = G.W.T.ray(r.o, r.d, 30); t = Math.min(t, 18 / hl); t = Math.max(t, 2.5 / hl);
  let x = r.o.x + r.d.x * t, z = r.o.z + r.d.z * t, ry = me.yaw;
  if (TURRETS[me.place].onPath) { const n = G.W.path.near(x, z); if (n.d < 6) { x = n.x; z = n.z; } ry = Math.atan2(n.tx, n.tz); }
  const T = TURRETS[me.place], my = mine(S); let err = placeError(me.place, x, z, G.W.path, S.T, G.W.hubP, G.W.hiveP, G.W.T); const gy = TURRETS[me.place].onPath ? G.W.path.y(G.W.path.near(x, z).s) : G.W.top(x, z);
  if (!err && my.gold < T.cost) err = `Need ${T.cost} gold`; if (!err && S.T.filter(q => q.owner === G.myId).length >= MAX_TURRETS) err = `Limit ${MAX_TURRETS}: sell one with X`;
  ghost.position.set(x, gy, z); ghost.rotation.y = ry; ghost.traverse(o => { if (o.isMesh) o.material = err ? ghostBad : ghostOk; });
  if (ghostRing) ghostRing.position.set(x, gy + 0.15, z);
  me.placeAt = { x, z, ry, err };
  prompt(err ? `<span class="bad">${err}</span> · Right click cancels` : `<b>Click</b> to build ${T.name} (${T.cost} gold) · <b>Right click</b> cancels`);
  if (clickL) { clickL = false; if (err) audio.sfx('nope'); else { req({ a: 'place', kind: me.place, x: +x.toFixed(2), z: +z.toFixed(2), ry: +ry.toFixed(2) }); me.place = null; me.holdFire = true; } }
  if (clickR || hits.Escape) { me.place = null; clickR = false; me.holdFire = true; }
}
function lookTurret(S) {
  const me = G.me, fx = -Math.sin(me.yaw), fz = -Math.cos(me.yaw); let best = null, bs = 0.9;
  for (const t of S.T) { const dx = t.x - me.x, dz = t.z - me.z, d = Math.hypot(dx, dz); if (d > 9 || d < 0.1) continue; const c = (dx * fx + dz * fz) / d; if (c > bs + (d < 2.5 ? -0.5 : 0)) { bs = c; best = t; } }
  return best;
}

function updateMe(dt, S) {
  const me = G.me, my = mine(S); if (!my || G.cine) return;
  if (G.explore && G.ex && G.ex.veh) { G.ex.drive(dt); updateFootless(); return; }
  if (my.sp !== me.sp) { me.sp = my.sp; me.x = G.W.spawn.x; me.z = G.W.spawn.z; me.y = G.W.top(me.x, me.z); me.vy = 0; me.yaw = Math.atan2(me.x, me.z); me.ammo = stats().mag; me.rel = 0; }
  if (my.hp < me.hp - 0.5 && !my.dead) { G.hurtT = 0.35; audio.sfx('hurt', 0.6); }
  if (my.hp > me.hp + 0.5 && my.hp < my.mhp && Math.random() < 0.2) audio.sfx('heal', 0.4);
  me.hp = my.hp;
  const st = stats(), live = G.on && !my.dead && S.ph !== 'lose', frozen = S.ph === 'build' && !G.explore;   // the opening countdown: look around, but nobody moves
  // walking
  let mx = 0, mz = 0; if (live && locked() && !frozen) { if (keys[KB.forward]) mz -= 1; if (keys[KB.back]) mz += 1; if (keys[KB.left]) mx -= 1; if (keys[KB.right]) mx += 1; }
  if (live && locked() && hits[KB.prone]) me.prone = !me.prone; if (!live || hits[KB.jump] || me.place) me.prone = false;
  me.kneel = me.prone || (live && locked() && keys[KB.kneel] && !me.place); me.kh = (me.kh || 0) + ((me.prone ? 1.6 : me.kneel ? 1 : 0) - (me.kh || 0)) * Math.min(1, dt * 10);
  const l = Math.hypot(mx, mz) || 1, run = me.carry ? 0.8 : keys[KB.sprint] && mz < 0 && !me.kneel ? 1.45 : 1, sp = st.speed * run * (me.prone ? 0.22 : me.kneel ? 0.4 : 1) * (1 - 0.45 * (me.spin || 0)) * (me.scope ? 0.5 : me.ads ? 0.7 : 1), s = Math.sin(me.yaw), c = Math.cos(me.yaw);
  const vx = (mx * c + mz * s) / l * sp, vz = (-mx * s + mz * c) / l * sp; me.moving = mx || mz;
  // step each way on its own so you slide along cliffs instead of sticking
  const T = G.W.T, foot = me.y;
  for (const [ax, az] of [[vx * dt, 0], [0, vz * dt]]) { if (!ax && !az) continue; const nx = me.x + ax, nz = me.z + az, gh = T.ground(nx, nz, foot + 0.6), pr = T.ground(me.x + Math.sign(ax) * 0.5, me.z + Math.sign(az) * 0.5, foot + 0.6); if ((gh > foot + 0.02 && (pr - foot > 1.3 || gh - foot > 0.65)) || T.solid(nx, foot + 1.6, nz)) continue; me.x = nx; me.z = nz; }
  for (const q of G.W.colliders) { const dx = me.x - q.x, dz = me.z - q.z, d = Math.hypot(dx, dz), r = q.r + 0.45; if (d < r && d > 0) { me.x = q.x + dx / d * r; me.z = q.z + dz / d * r; } }
  me.x = Math.max(-BOUNDS + 1.2, Math.min(BOUNDS - 1.2, me.x)); me.z = Math.max(-BOUNDS + 1.2, Math.min(BOUNDS - 1.2, me.z));
  const gh = T.ground(me.x, me.z, me.y + 0.6); let grounded = false;
  if (me.vy <= 0 && me.y - gh < 0.35 && me.y - gh > -0.7) { me.y = gh; me.vy = 0; grounded = true; }
  else { me.vy -= 22 * dt; me.y += me.vy * dt; if (me.y < gh && me.y > gh - 0.7) { me.y = gh; me.vy = 0; } }
  if (live && hits[KB.jump] && grounded) { me.vy = 7.5; me.y += 0.02; }
  const ceil = T.ceiling(me.x, me.z, me.y); if (me.y + 1.9 > ceil) { me.y = Math.min(me.y, ceil - 1.9); me.vy = Math.min(0, me.vy); }
  if (grounded && T.chasm(me.x, me.z) > 0.99) me.safe = { x: me.x, z: me.z, y: me.y };
  if (me.y < LIQUID + 0.5 && live) { const sf = me.safe || { x: G.W.spawn.x, z: G.W.spawn.z, y: T.top(G.W.spawn.x, G.W.spawn.z) }; me.x = sf.x; me.z = sf.z; me.y = sf.y + 0.2; me.vy = 0; req({ a: 'fall' }); toast('You fell into the chasm and climbed back out, hurt.', 3); audio.sfx('hurt'); }
  me.bob += dt * (me.moving && grounded ? sp * 1.4 : 0);
  // footsteps that match the ground underfoot
  if (me.moving && grounded) { const ph = Math.floor(me.bob / Math.PI); if (ph !== me.stepPh) { me.stepPh = ph; audio.sfx('step_' + surface(me), (me.prone ? 0.25 : me.kneel ? 0.45 : run > 1 ? 1 : 0.75)); } }
  // camera
  G.shake = Math.max(0, (G.shake || 0) - dt); const sh = G.shake * 0.15;
  me.heat = Math.max(0, (me.heat || 0) - dt * 7); const rr = (me.rcv || 0) * Math.min(1, dt * 5); me.pitch -= rr; me.rcv = (me.rcv || 0) - rr;
  G.punch = Math.max(0, (G.punch || 0) - dt * 30); const fov = me.scope ? 20 : me.ads ? SET.fov * 0.55 : SET.fov + (run > 1 && me.moving ? 6 : 0) - G.punch * 0.6 - me.kh * 3; if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 14); camera.updateProjectionMatrix(); }
  camera.position.set(me.x + (Math.random() - 0.5) * sh, (my.dead ? 3.5 : 1.7 - me.kh * 0.75) + me.y + Math.sin(me.bob) * 0.05 + (Math.random() - 0.5) * sh, me.z);
  camera.rotation.set(me.pitch, me.yaw, 0, 'YXZ');
  // gun
  me.cd -= dt; me.gcd -= dt; me.kick = Math.max(0, me.kick - dt * 9); G.flash = Math.max(0, (G.flash || 0) - dt); view2.flash.intensity = G.flash > 0 ? 25 : 0; view2.fsp.visible = G.flash > 0; view2.fsp.scale.setScalar((G.cls === 'heavy' ? 1.6 : 0.9) * (0.7 + Math.random() * 0.8) * (1 + 0.08 * ((mine(S) || {}).ups || {}).dmg)); view2.fsp.material.rotation = Math.random() * 6;
  if (me.rel > 0) {
    me.rel -= dt; const g0 = curGun(), f = 1 - me.rel / (me.relT || 1), cue = (bit, at, snd) => { if (f > at && !(me.rs & bit)) { me.rs |= bit; audio.sfx(snd, 0.9); } };
    const jolt = (bit, at, snd, j) => { if (f > at && !(me.rs & bit)) { me.jolt = j; } cue(bit, at, snd); };
    if (g0.kind === 'rocket') { cue(1, 0.04, 'magout'); cue(2, 0.2, 'pouch'); jolt(4, 0.6, 'rocketload', 0.6); jolt(8, 0.8, 'magin', 0.8); }
    else { cue(1, 0.12, 'magout'); cue(16, 0.28, 'pouch'); if (f > 0.36 && !(me.rs & 32)) { me.rs |= 32; audio.sfx('magdrop', 0.55); } jolt(2, 0.55, g0.spin ? 'beltin' : 'magin', 1); jolt(4, 0.72, me.slot === 1 ? 'slide' : 'bolt', 0.8); }
    if (me.rel <= 0) { const take = Math.min(st.mag - me.ammo, me.reserve); me.ammo += take; me.reserve -= take; }
  }
  if (me.shells) { me.shellT -= dt; if (me.shellT <= 0) { if (me.ammo < st.mag && me.reserve >= 1) { me.ammo++; me.reserve--; audio.sfx('shell', 0.9); me.shellT = me.shellP = 0.42 * reloadMul(S); me.jolt = 0.4; } else { me.shells = false; me.pumpAt = 0.05; } } }
  if (me.pumpAt > 0) { me.pumpAt -= dt; if (me.pumpAt <= 0) { audio.sfx(G.cls === 'sniper' ? 'bolt' : 'pump', 0.9); me.pumpAnim = 0.3; } }
  me.pumpAnim = Math.max(0, (me.pumpAnim || 0) - dt);
  if (me.slot <= 1 && me.reserve > st.reserve) me.reserve = st.reserve;
  // refill spare rounds inside the hub walls
  me.resup = me.slot <= 1 && G.W.T.hubAt(me.x, me.z) && me.reserve < st.reserve; if (G.W.T.hubAt(me.x, me.z)) refillAmmo(0.35 * dt);
  if (me.ammo > st.mag) me.ammo = st.mag;
  const gn = view2.gun, rf = 0;
  // right click: aim down the sights on every gun; the Sniper's rail rifle uses its scope
  const rc = me.slot === 0 && G.cls === 'sniper' ? 'scope' : me.slot <= 1 ? 'ads' : '', rmb = mouseR && !me.holdFire && !me.carry && live && locked() && !me.place && !G.shop; me.scope = rc === 'scope' && rmb && me.rel <= 0; me.ads = rc === 'ads' && rmb; $('scope').hidden = !me.scope;
  me.beam = (me.slot === 2 || me.slot === 4) && mouseL && live && locked() && !me.place && !G.shop; for (const [k, n] of [['pistol', 1], ['tool', 2], ['thr', 3], ['healer', 4], ['dress', 5]]) if (view2[k]) view2[k].visible = me.slot === n && !my.dead && !me.place && !me.scope;
  if (gn.userData.spin) gn.userData.spin.rotation.z += dt * me.spin * 40;
  { const u = gn.userData, f = me.rel > 0 ? 1 - me.rel / (me.relT || 1) : 0; 
    if (u.pump) { u.pumpZ0 ??= u.pump.position.z; u.pump.position.z = u.pumpZ0 + ((me.pumpAnim || 0) > 0 ? Math.sin((0.3 - me.pumpAnim) / 0.3 * Math.PI) * 0.18 : 0); }
    if (u.rocket) u.rocket.visible = me.rel > 0 ? f > 0.66 : me.ammo > 0; }
  gn.position.set(0.21 - me.kh * 0.06 + Math.sin(me.bob * 0.5) * 0.01, -0.21 + me.kh * 0.03 + Math.abs(Math.cos(me.bob * 0.5)) * 0.008 - rf * 0.12 + me.kick * 0.012, -0.42 + me.kick * (G.cls === 'heavy' ? 0.14 : 0.07)); gn.rotation.set(me.kick * (G.cls === 'heavy' ? 0.25 : 0.12) - rf * 0.7, (Math.random() - 0.5) * me.kick * 0.03, rf * 0.3 + me.kick * 0.04 - me.kh * 0.08); gn.visible = me.slot === 0 && !my.dead && !me.place && !me.scope; if (me.ads) { gn.position.x = 0.0; gn.position.y = -0.12; gn.position.z -= 0.08; } if (me.ads && view2.pistol) { view2.pistol.position.set(0, -0.15, -0.4); } else if (view2.pistol) view2.pistol.position.set(0.2, -0.22, -0.45);
  animReload(me, gn, my, dt);
  if (!live) { me.place = null; updatePlace(S); return; }
  if (locked() && !G.shop && !frozen) {
    if (hits[KB.reload] && me.rel <= 0 && !me.shells && me.ammo < st.mag && me.reserve >= 1) startReload(st, S);
    [0, 1, 2, 3, 5, 4].forEach((n, i) => { if (hits[KB['w' + (i + 1)]]) setSlot(n); });
    if (hits[KB.special]) { if (!my.special) toast('No special. Supply crates sometimes carry one.', 2); else if (SPECIALS[my.special].aim) openMissileMap(my.special); else req({ a: 'special' }); }
    // T F V drop the class's turrets straight down in front of you (each uses one of the two kits you carry)
    for (const k of ['sentry', 'defense', 'third']) if (hits[KB[k]] && !G.explore) dropNew(CLASSES[G.cls][k], my);
    // carrying a turret: left click or changing weapon puts it down in front of you
    const carried = S.T.find(t => t.carry === G.myId); me.carry = carried ? carried.id : 0;
    if (carried) { prompt(`Carrying <b>${TURRETS[carried.kind].name}</b> · <b>Left click</b> puts it down · its key or a weapon key puts it back in your pack`); if (clickL) { clickL = false; dropCarried(); } }
    if (me.slot === 5) { const n = my.dr ?? 2; if (me.dressT > 0) { me.dressT -= dt; if (view2.dress) view2.dress.position.y = -0.2 - Math.sin(me.dressT * 9) * 0.04; if (me.dressT <= 0) setSlot(0); } else if (clickL && !me.carry) { clickL = false; if (n > 0 && my.hp < my.mhp) { req({ a: 'dress' }); audio.sfx('pouch', 0.9); me.dressT = 0.45; } else audio.sfx('nope'); } else prompt(n < 1 ? '<span class="bad">No field dressings</span> · more in the hub' : my.hp >= my.mhp ? `Field dressing ×${n} · you are not hurt` : `Field dressing ×${n} · <b>click</b> to bandage (+40 health)`); }
    if (me.slot === 3 && clickL && !me.place && me.cd <= 0) { clickL = false; me.cd = 0.8; throwItem(my); }
    if (hits[KB.grenade] && !me.place && (me.gcd || 0) <= 0) { me.gcd = 0.8; throwItem(my); }
    if (!me.place) {
      const g = curGun(); if (me.holdFire && !mouseL && !mouseR) me.holdFire = false; const trig = mouseL && !me.holdFire;
      if (g.spin) { const want = (trig || mouseR) && me.rel <= 0 && !me.holdFire; if (want && me.spin === 0) audio.sfx('spin', 0.8); me.spin = want ? Math.min(1, me.spin + dt / g.spin) : Math.max(0, me.spin - dt * 1.5); }
      if (me.shells && trig && me.ammo > 0) { me.shells = false; me.pumpAt = 0.05; }
      if (me.slot <= 1 && trig && !me.carry && me.cd <= 0 && me.rel <= 0 && !me.shells && (!g.spin || me.spin >= 1)) { if (me.ammo > 0) shoot(st); else if (me.reserve >= 1 && !me.shells) startReload(st, S); else { me.cd = 0.4; audio.sfx('empty'); if (G.time - (G.emptyT || 0) > 3) { G.emptyT = G.time; toast('OUT OF AMMO: get back to the hub, or find a Gunner\'s ammo crate.', 3); } } }
      updateBeam(dt, S);
      const t = me.carry || me.beam ? null : lookTurret(S); G.lookT = t;
      if (t) {
        const T = TURRETS[t.kind], own = S.P.find(p => p.id === t.owner), c = upgradeCost(t);
        prompt(`<b>${T.name}</b> Lv${t.lvl}${own ? ' · ' + esc(own.name) : ''} · ${Math.ceil(t.hp)}/${t.mhp} · ` + (t.b > 0 ? `building: ${t.b.toFixed(1)} s` : t.lvl < 3 ? (t.up ? `welding upgrade ${Math.round(t.up * 100)}%` : `weld it with <b>3</b> to upgrade (${[0, 15, 30][t.lvl]} scrap)`) : 'max level') + (t.carry ? '' : ` · <b>${keyName(KB.use)}</b> pick up`) + (t.owner === G.myId ? ` · <b>${keyName(KB.sell)}</b> sell` : ''));
        if (hits[KB.use] && !t.carry) { hits[KB.use] = false; req({ a: 'carry', id: t.id }); audio.sfx('place', 0.6); } if (hits[KB.sell] && t.owner === G.myId) req({ a: 'sell', id: t.id });
      }
    }
  }
  updatePlace(S);
  { const l = (G.W.lore || []).find(q => !q.silent && Math.hypot(q.x - me.x, q.z - me.z) < 3.5); $('lore').hidden = !l; if (l && G.loreOpen !== l) { G.loreOpen = l; $('loreT').textContent = l.title; $('loreX').textContent = l.text; audio.sfx('pickup', 0.5); G.loreSeen = G.loreSeen || new Set(); if (!G.loreSeen.has(l.title)) { G.loreSeen.add(l.title); toast(`Log found: ${l.title}`, 3); } } if (!l) G.loreOpen = null; }
  // teleporters: an Engineer's pad beams you to the hub; the hub pad sends you out to the newest one
  if (!G.explore && live && !me.carry) { const pads = S.T.filter(t => t.kind === 'teleporter' && !t.carry && !(t.b > 0)), onPad = pads.find(t => Math.hypot(t.x - me.x, t.z - me.z) < 1.8), hp = G.W.hubPad, atHub = hp && Math.hypot(hp.x - me.x, hp.z - me.z) < 1.8;
    const go = (x, z, msg) => { me.x = x; me.z = z; me.y = G.W.top(x, z) + 0.3; me.vy = 0; audio.sfx('rail', 0.7); flashAt([x, me.y + 1, z], 3); burst(x, me.y + 1, z, 0x80e8ff, 30, 4, 0.8); $('hurt').style.opacity = 0; toast(msg, 2); };
    if (onPad) { prompt(`<b>${keyName(KB.use)}</b> teleport back to the hub`); if (hits[KB.use]) { hits[KB.use] = false; go(G.W.spawn.x, G.W.spawn.z, 'Teleported to the hub'); } }
    else if (atHub) { const tp = pads.sort((a, b) => b.id - a.id)[0]; prompt(tp ? `<b>${keyName(KB.use)}</b> teleport out to the Engineer's pad` : 'Hub teleporter · an Engineer has to put down a Teleporter Pad first'); if (tp && hits[KB.use]) { hits[KB.use] = false; go(tp.x + 1.6, tp.z, 'Teleported to the forward pad'); } } }
  // salvage: downed dropships still hold ammunition (each one refills again after 90 s)
  { const L = !G.explore && live ? (G.W.loot || []).find(q => Math.hypot(q.x - me.x, q.z - me.z) < 4.5) : null; if (L && !me.carry) { G.lootCd ??= new Map(); const cd = (G.lootCd.get(L) || 0) - G.time;
    prompt(cd > 0 ? `${L.name}: picked clean · more salvage in ${Math.ceil(cd)} s` : `<b>${keyName(KB.use)}</b> salvage ammunition and power cells from the ${L.name.toLowerCase()}`);
    if (cd <= 0 && hits[KB.use]) { hits[KB.use] = false; G.lootCd.set(L, G.time + 90); refillAmmo(0.6); req({ a: 'salvage' }); audio.sfx('pouch'); setTimeout(() => audio.sfx('magin'), 250); toast('Salvaged: +60% spare rounds, welder power topped up', 2.5); } } }
  for (const r of me.rockets) { if (r.mesh) { const ox = r.x, oy = r.y, oz = r.z; } if (stepRocket(r, dt)) { r.dead = true; scene.remove(r.mesh); if (G.explore && G.ex) G.ex.splash(r.x, r.y, r.z, CLASSES.heavy.gun.splash, st.dmg); else req({ a: 'boom', x: r.x, y: r.y, z: r.z, r: CLASSES.heavy.gun.splash, d: st.dmg, fire: r.napalm ? 1 : 0 }); } else { r.mesh.position.set(r.x, r.y, r.z); r.mesh.lookAt(r.x - r.vx, r.y - r.vy, r.z - r.vz); if (Math.random() < 0.8) burst(r.x, r.y, r.z, 0x808080, 1, 0.4, 0.5); } }
  me.rockets = me.rockets.filter(r => !r.dead);
}

// ---------------------------------------------------------------- HUD
const ICON = { pulse: '🎯', ammocache: '📦', resupply: '⛽', uav: '🛰', frag: '💣', claymore: '💥', medkit: '✚', volley: '💣', rally: '📣', airburst: '💥', shieldwall: '🧱', fixall: '🔧', barrage: '🚀', ironskin: '🛡', napalmround: '🔥', storm: '🔥', suppress: '🌀', fortify: '⛰', cloak: '👻', recon: '📡', markall: '🎯', stimshot: '💉', healnade: '✚', nano: '🛡', minigun: '🔫', barricade: '🧱', tesla: '⚡', repair: '🔧', missile: '🚀', stasis: '🌀', flamer: '🔥', mines: '💥', railgun: '🎯', beacon: '📡', mortar: '☣', medbay: '✚', adrenaline: '⚡', overclock: '⚙', shockwave: '💢', ammo: '📦', overcharge: '🎯', revive: '✚', missile_: '🚀', overdrive: '⏩', stim: '💉', squad: '👥', dropship: '🚁', drone: '🛸', airstrike: '✈', orbital: '☄', napalm: '🔥', emp: '⚡', cryo: '❄', medkit: '✚', ammodrop: '📦', sentrydrop: '🔫', dome: '🛡', hubrepair: '🔧' };
ICON.missile_sp = '🚀';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let toastT = 0, bannerT = 0, promptSet = false;
function toast(m, t = 3) { const d = document.createElement('div'); d.textContent = m; $('toasts').prepend(d); setTimeout(() => d.remove(), t * 1000); while ($('toasts').children.length > 3) $('toasts').lastChild.remove(); }
function banner(a, b) { $('bannerA').textContent = a; $('bannerB').textContent = b; $('banner').hidden = false; bannerT = 3; }
function prompt(html) { promptSet = true; const p = $('prompt'); if (p._h !== html) { p.innerHTML = html; p._h = html; } p.hidden = false; }
const setT = (id, v) => { const e = $(id); if (e._v !== v) { e._v = v; e.textContent = v; } };
const setH = (id, v) => { const e = $(id); if (e._v !== v) { e._v = v; e.innerHTML = v; } };
let mapT = 0;
function hud(dt, S) {
  const my = mine(S); if (!my) return; const st = stats(), C = CLASSES[G.cls];
  const hpv = G.explore && G.ex ? G.ex.hp * my.mhp / 100 : my.hp; setT('gold', Math.floor(my.gold)); setT('scrapN', String(my.scrap || 0)); G.scrapFlash = Math.max(0, (G.scrapFlash || 0) - dt); $('scrapBox').classList.toggle('fl', G.scrapFlash > 0); setT('hpTxt', `${Math.ceil(hpv)} / ${my.mhp}`); $('hpBar').style.width = (hpv / my.mhp * 100) + '%';
  const slotNames = [C.gun.name, SIDEARM.name, 'Welding torch' + (G.cls === 'engineer' ? ' (3x)' : ''), C.throw.name + ' (left click throws)', 'Heal beam']; setT('ammo', G.me.slot === 3 ? String(my.items ?? 0) : G.me.slot === 5 ? String(my.dr ?? 0) : G.me.slot === 2 ? Math.round((my.pw ?? 100) / (G.cls === 'engineer' ? 160 : 100) * 100) + '%' : G.me.slot >= 2 ? '∞' : G.me.rel > 0 ? '--' : String(G.me.ammo)); setT('reserve', G.me.slot === 3 ? '/ ' + C.throw.n : G.me.slot === 5 ? '/ 2' : G.me.slot === 2 ? 'PWR' : G.me.slot >= 2 ? '' : '/ ' + Math.floor(G.me.reserve)); setT("gunName", `SLOT ${[1, 2, 3, 4, 6, 5][G.me.slot]}`); const low = G.me.reserve < st.mag && G.me.ammo < st.mag * 0.5; $('ammoWarn').hidden = !(low || G.me.resup); setT('ammoWarn', G.me.resup ? 'RESUPPLYING' : G.me.reserve < 1 && G.me.ammo === 0 ? 'OUT OF AMMO: BACK TO THE HUB' : 'LOW AMMO'); setT('clsName', C.name);
  const mmss = t => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; setT('waveTxt', S.ph === 'build' ? `GET READY ${Math.max(0, Math.ceil(S.tm))}` : `⏱ ${mmss(S.el || 0)}`); $('hubBar').style.width = S.hub + '%'; setT('hubTxt', `HUB ${Math.ceil(S.hub)}%`);
  let info = S.ph === 'build' ? 'Stand by: the swarm is coming' : `${S.left} aliens on the field`; if (G.W.cave && Math.hypot(G.me.x - G.W.cave.x, G.me.z - G.W.cave.z) < 40) info = 'The Brood Queen\'s lair: kill her to win';
  setT('waveInfo', info);
  const mt = S.T.filter(t => t.owner === G.myId).length, sT = TURRETS[C.sentry], dT = TURRETS[C.defense];
  const sp = my.special, TH = C.throw, tT = TURRETS[C.third];
  const pwPct = Math.round((my.pw ?? 100) / (G.cls === 'engineer' ? 160 : 100) * 100), wpn = [[C.gun.name, icon(G.cls), '', 0], [SIDEARM.name, icon('pistol'), '', 1], ['Welding torch', icon('welder'), pwPct + '%', 2], [TH.name, icon(TH.kind), `${my.items ?? 0}`, 3], ['Field dressing', icon('medkit'), `${my.dr ?? 2}`, 5], ...(C.heal ? [['Heal beam', icon('beam'), '', 4]] : [])];
  const bslot = (key, kind) => { const T0 = TURRETS[kind]; return `<div class="slot ${G.me.place === kind ? 'on' : ''} ${my.gold < T0.cost ? 'poor' : ''}"><b>${keyName(KB[key])}</b>${icon(kind)}<i>${T0.cost}</i></div>`; };
  setH('slots', wpn.map(([n, ic, c, sl], i) => `<div class="slot w ${G.me.slot === sl ? 'on' : ''} ${(sl === 3 && !my.items) || (sl === 5 && !my.dr) || (sl === 2 && (my.pw ?? 1) <= 0) ? 'poor' : ''}"><b>${i + 1}</b>${ic}<i>${c}</i></div>`).join('') + `<div class="gap"></div><div class="kits" title="turret kits">${'▮'.repeat(my.kits ?? 2)}${'▯'.repeat(Math.max(0, 2 - (my.kits ?? 2)))}<small>KITS</small></div>` + bslot('sentry', C.sentry) + bslot('defense', C.defense) + bslot('third', C.third) + `<div class="slot ${sp ? 'ready sp' : 'poor'}"><b>${keyName(KB.special)}</b>${sp ? icon(sp) : icon('empty')}</div>`);
  setT('slotName', G.me.place ? TURRETS[G.me.place].name : sp && G.time - (G.spT ?? -9) < 3 ? SPECIALS[sp].name : (wpn.find(w => w[3] === G.me.slot) || wpn[0])[0]); if (sp !== G.lastSp) { G.lastSp = sp; G.spT = G.time; }
  $('roundsBar').style.width = (G.me.slot <= 1 ? Math.min(100, G.me.ammo / st.mag * 100) : 0) + '%';
  setH('status', [my.adrT > 0 ? '<span>⚡ Adrenaline</span>' : '', ...Object.entries(my.buf || {}).filter(([, v]) => v > 0).map(([k]) => `<span>${{ rally: '📣 Rally', iron: '🛡 Iron Skin', nano: '🛡 Nano Shield', storm: '🔥 Bullet Storm', fortify: '⛰ Fortified', cloak: '👻 Cloaked', napalm: '🔥 Napalm ready', airburst: '💥 Airburst' }[k] || k}</span>`), G.me.prone ? '<span>▁ Prone</span>' : G.me.kneel ? '<span>▃ Kneeling</span>' : '', my.stimT > 0 ? '<span>💉 Stim</span>' : '', my.regen || G.me.resup ? '<span class="g">✚ Hub</span>' : '', my.cold ? '<span class="b">❄ Frostbite: get under cover, or crouch behind something on the windward side</span>' : '', my.toxic ? '<span class="t">☣ Spores</span>' : '', S.P.some(p => p.id !== G.myId && p.cls === 'heavy' && !p.dead && Math.hypot(p.x - G.me.x, p.z - G.me.z) < 12) ? '<span>🛡 Bulwark</span>' : '', S.P.some(p => p.id !== G.myId && p.cls === 'assault' && !p.dead && Math.hypot(p.x - G.me.x, p.z - G.me.z) < 14) ? '<span>★ Squad leader</span>' : ''].join(''));
  // a boss bar while a big one is alive
  const nearQ = G.W.cave && Math.hypot(G.me.x - G.W.cave.x, G.me.z - G.W.cave.z) < 34, boss = S.A.find(a => ALIENS[a.type].boss) || (nearQ ? S.A.find(a => a.type === 'broodqueen') : null); $('boss').hidden = !boss; if (boss) { setT('bossName', ALIENS[boss.type].name); $('bossBar').style.width = (boss.hp / boss.mhp * 100) + '%'; }
  const hunters = [...view.aliens.values()].filter(v => v.hunt === G.myId); $('hunt').hidden = !hunters.length || my.dead; if (hunters.length) setT('huntT', `⚠ ${hunters.length} ALIEN${hunters.length > 1 ? 'S' : ''} HUNTING YOU`);
  setH('arrows', hunters.slice(0, 8).map(v => { const a = Math.atan2(v.x - G.me.x, v.z - G.me.z) - Math.atan2(-Math.sin(G.me.yaw), -Math.cos(G.me.yaw)); return `<i style="transform:translate(-50%,-50%) rotate(${(-a).toFixed(2)}rad) translateY(-90px)"></i>`; }).join(''));
  $('hit').classList.toggle('head', !!G.hitHead);
  $('hit').style.borderColor = G.hitWeak ? '#888' : ''; $('hit').classList.toggle('weak', !!G.hitWeak);
  $('hit').style.opacity = G.hitT > 0 ? 1 : 0; G.hitT -= dt; G.hurtT = Math.max(0, (G.hurtT || 0) - dt); $('hurt').style.opacity = Math.min(0.8, G.hurtT * 2.5 + (my.hp / my.mhp < 0.3 ? 0.25 : 0));
  $('dead').hidden = !my.dead || S.ph === 'lose'; if (my.dead) setT("deadT", `Respawning in ${Math.ceil(my.rt)} s`);
  // the last seconds before a wave are counted out loud
  const cd = S.ph === 'build' ? Math.ceil(S.tm) : 0; if (cd !== G.lastCd) { G.lastCd = cd; if (cd >= 1 && cd <= 5) { banner(String(cd), cd === 1 ? 'GO!' : 'The alien bastards know we\'re coming. Get inside the hive and kill the queen! We will extract you as soon as your mission is complete.'); bannerT = 0.9; audio.sfx('tick'); } }
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').hidden = true; }
  if (!promptSet) $('prompt').hidden = true; promptSet = false;
  // end screens
  const end = S.ph === 'lose' && !G.explore && !G.cine; $('end').hidden = !end; $('btnFob').hidden = !(S.ph === 'win' && G.mode !== 'client');
  if (end) { setT('endTitle', S.ph === 'win' ? 'VICTORY' : 'THE HUB HAS FALLEN'); { const t = S.el || 0, ms = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; setT('endText', S.ph === 'win' ? `The hive is destroyed after ${ms}! The colony is safe.` : `Your squad held the hub for ${ms}.`); } setT('endKey', G.mode === 'client' ? 'Waiting for the host to choose…' : ''); $('btnAgain').hidden = G.mode === 'client'; $('btnAgain').textContent = S.ph === 'win' ? 'Keep fighting (endless mode)' : 'Try again'; if (document.pointerLockElement) document.exitPointerLock(); }
  $('pause').hidden = locked() || G.shop || end || G.mmap || G.settings;
  $('board').hidden = !keys[KB.scores]; if (keys[KB.scores]) setH('boardT', '<tr><th>Marine</th><th>Class</th><th>Kills</th><th>Gold</th></tr>' + S.P.map(p => `<tr><td>${esc(p.name)}${p.dead ? ' ✝' : ''}</td><td>${CLASSES[p.cls].name}</td><td>${p.kills}</td><td>${Math.floor(p.gold)}</td></tr>`).join(''));
  if (G.shop) shopDraw(my);
  mapT -= dt; if (mapT <= 0) { mapT = 0.1; minimap(S); }
  if (G.explore) { const v = G.ex && G.ex.veh; setT('waveTxt', 'FOB VALOR'); setT('waveInfo', v ? (v.kind === 'vtol' ? `VTOL · altitude ${Math.round(v.y - G.W.T.raw(v.x, v.z))} m` : `Rover · ${Math.round(Math.abs(v.sp) * 3.6)} km/h`) : `Explore the planet · wild aliens slain: ${G.ex ? G.ex.kills || 0 : 0}`); }
}
function minimap(S) {
  // the small map shows the ground round you (M opens the whole map)
  const BB = G.W.size || BOUNDS, cv = $('mini'), g = cv.getContext('2d'), W = cv.width, R = G.explore ? 110 : 70, k = W / (R * 2), me0 = G.me, X = x => (x - me0.x) * k + W / 2, Z = z => (z - me0.z) * k + W / 2;
  g.fillStyle = '#0a0d12'; g.fillRect(0, 0, W, W); const bg = G.W.miniBg, bs = bg.width / (BB * 2); g.drawImage(bg, (me0.x - R + BB) * bs, (me0.z - R + BB) * bs, R * 2 * bs, R * 2 * bs, 0, 0, W, W);
  // the hub and the hive: shown at the edge, pointing the way, when they are off the small map
  const pin = (x, z, col) => { let px = X(x) - W / 2, py = Z(z) - W / 2; const rr = W / 2 - 14, d = Math.hypot(px, py), out = d > rr; if (out) { px *= rr / d; py *= rr / d; } px += W / 2; py += W / 2; g.fillStyle = col; g.beginPath(); g.arc(px, py, out ? 5 : 7, 0, 7); g.fill(); if (out) { g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); g.arc(px, py, 8, 0, 7); g.stroke(); } };
  pin(G.W.hiveP.x, G.W.hiveP.z, '#a040ff'); pin(G.W.hubP.x, G.W.hubP.z, '#60c0ff');
  for (const t of S.T) { g.fillStyle = t.owner === G.myId ? '#80ff90' : '#d0e0a0'; g.fillRect(X(t.x) - 2.5, Z(t.z) - 2.5, 5, 5); }
  G.pings = G.pings.filter(p => (p.t -= 0.1) > 0); for (const p of G.pings) { g.strokeStyle = `rgba(255,60,40,${Math.min(1, p.t)})`; g.lineWidth = 2; g.beginPath(); g.arc(X(p.x), Z(p.z), 4 + (3 - p.t) * 5 % 10, 0, 7); g.stroke(); }
  g.strokeStyle = 'rgba(80,255,130,.5)'; g.lineWidth = 1; g.beginPath(); g.arc(X(G.W.hubP.x), Z(G.W.hubP.z), 15 * k, 0, 7); g.stroke();
  g.fillStyle = '#d8b860'; for (const c of S.SC || []) { const px = X(c.x), py = Z(c.z); if (px > 0 && py > 0 && px < W && py < W) g.fillRect(px - 2, py - 2, 4, 4); }
  for (const L of G.W.loot || []) { const px = X(L.x), py = Z(L.z); if (px < 0 || py < 0 || px > W || py > W) continue; const cd = G.lootCd && (G.lootCd.get(L) || 0) > G.time; g.strokeStyle = cd ? '#556' : '#c8d8e0'; g.lineWidth = 2; g.strokeRect(px - 4, py - 3, 8, 6); }
  for (const o of S.O) { if (o.got) continue; const on = (o.land ?? 0) > 0 || o.life > 10 || Math.sin(G.time * 10) > 0; let px = X(o.x) - W / 2, py = Z(o.z) - W / 2; const rr = W / 2 - 12, d = Math.hypot(px, py); if (d > rr) { px *= rr / d; py *= rr / d; } px += W / 2; py += W / 2; g.fillStyle = on ? '#ffd040' : '#806020'; g.save(); g.translate(px, py); g.rotate(0.785); g.fillRect(-6, -6, 12, 12); g.restore(); g.strokeStyle = '#000'; g.lineWidth = 1.5; g.strokeRect(px - 3, py - 3, 6, 6); }
  for (const m of S.L || []) { g.fillStyle = '#9fe870'; g.fillRect(X(m.x) - 2, Z(m.z) - 2, 4, 4); }
  for (const a of S.A) { if (!revealed(a)) continue; const b = ALIENS[a.type].boss || a.type === 'broodqueen'; g.fillStyle = b ? '#ff40ff' : '#ff4040'; g.beginPath(); g.arc(X(a.x), Z(a.z), b ? 4 : 2, 0, 7); g.fill(); }
  for (const p of S.P) if (p.id !== G.myId && !p.dead) { g.fillStyle = '#' + CLASSES[p.cls].color.toString(16).padStart(6, '0'); g.beginPath(); g.arc(X(p.x), Z(p.z), 3.5, 0, 7); g.fill(); }
  const me = G.me; g.save(); g.translate(W / 2, W / 2); g.rotate(-me.yaw); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 5); g.lineTo(-5, 5); g.closePath(); g.fill(); g.restore();
}
function shopDraw(my) {
  const inHub = G.W.T.hubAt(G.me.x, G.me.z), sw = `<h2>Change class</h2><p class="small">Swap kits here in the hub. <b>Every turret and barricade you own is sold</b> (60% back) when you swap.</p>` + Object.entries(CLASSES).map(([k, c]) => `<button class="up ${k === G.cls ? 'max' : ''}" data-cls="${k}"${inHub ? '' : ' disabled'}><b style="color:#${c.color.toString(16).padStart(6, '0')}">◆</b><span>${c.name}<small>${c.role} · ${c.gun.name}</small></span><em></em><i>${k === G.cls ? 'CURRENT' : 'SWAP'}</i></button>`).join('');
  let h = `<p>Gold: <b>${Math.floor(my.gold)}</b></p>` + [].map((u, i) => { const lv = my.ups[u.id] || 0, c = UPG_PRICES[lv]; return `<button class="up ${lv >= 5 ? 'max' : my.gold < c ? 'poor' : ''}" data-up="${u.id}"><b>${i + 1}</b><span>${u.name}<small>${u.text}</small></span><em>${'■'.repeat(lv)}${'□'.repeat(5 - lv)}</em><i>${lv >= 5 ? 'MAX' : c + 'g'}</i></button>`; }).join('');
  const C = (state() || {}).C; if (C) {
    const row = (key, w, name, text, lv, max, cost, done) => `<button class="up ${done ? 'max' : my.gold < cost ? 'poor' : ''}" data-cmd="${w}"><b>${key ? '·' : '·'}</b><span>${name}<small>${text}</small></span><em>${max ? '■'.repeat(lv) + '□'.repeat(max - lv) : done ? 'READY' : ''}</em><i>${done ? (max ? 'MAX' : 'OWNED') : cost + 'g'}</i></button>`;
    let c = `<h2>Hub reinforcements</h2><p class="small">Shared by the squad. Marines leave the hub during waves and march toward the hive, fighting everything they meet.</p>`;
    c += row('7', 'rate', 'Faster drops', `Now every ${DROP_EVERY[C.lv]} s` + (C.lv < DROP_EVERY.length - 1 ? ` → ${DROP_EVERY[C.lv + 1]} s` : ''), C.lv, DROP_EVERY.length - 1, DROP_COST[C.lv + 1] || 0, C.lv >= DROP_EVERY.length - 1);
    c += row('8', 'size', 'Bigger squads', `Now ${SQUAD[C.sz]} per drop` + (C.sz < SQUAD.length - 1 ? ` → ${SQUAD[C.sz + 1]}` : ''), C.sz, SQUAD.length - 1, SQUAD_COST[C.sz + 1] || 0, C.sz >= SQUAD.length - 1);
    ['gunner', 'rocketeer', 'medic'].forEach((k, i) => { c += row(['9', '0', '-'][i], k, ALLIES[k].name, ALLIES[k].text, 0, 0, ALLIES[k].unlock, C.un.includes(k)); });
    h += c;
  }
  setH('shopList', h + sw);
}
$('shopList').addEventListener('click', e => { const b = e.target.closest('[data-up]'); if (b) req({ a: 'buy', up: b.dataset.up }); const c = e.target.closest('[data-cmd]'); if (c) req({ a: 'cmd', w: c.dataset.cmd }); const k = e.target.closest('[data-cls]'); if (k && k.dataset.cls !== G.cls) req({ a: 'cls', cls: k.dataset.cls }); });
function openShop(on) { G.shop = on; $('shop').hidden = !on; if (on) { G.me.place = null; if (document.pointerLockElement) document.exitPointerLock(); } else canvas.requestPointerLock(); }

// ---------------------------------------------------------------- the main loop
let last = performance.now(), netT = 0, poseT = 0;
function frame(now) {
  G.wdT = (G.wdT || 0) + 1; if (G.wdT > 60) { G.wdT = 0; audio.watchdog(); if (music.a && music.a.ctx && music.a.ctx.state !== 'running') music.a.ctx.resume().catch(() => { }); }
  requestAnimationFrame(frame); const dt = Math.min(0.05, (now - last) / 1000); last = now; G.time += dt;
  if (hits[KB.music]) toast(music.toggle() ? 'Music on (N)' : 'Music off (N)', 2);
  if (hits[KB.map] && G.on && !G.shop) { if (G.mmap) closeMissileMap(); else openMissileMap(''); }
  if (!G.on) { music.set('title'); if (G.W) renderer.render(scene, camera); clearHits(); return; }
  const S0 = state(); if (!S0) { clearHits(); return; } const S = G.explore ? exploreState(S0) : S0;
  // keys that work any time
  const atComms = G.W.comms && Math.hypot(G.me.x - G.W.comms.x, G.me.z - G.W.comms.z) < 5 && !G.explore; if (atComms && !G.shop) prompt(`<b>${keyName(KB.armory)}</b> Recruitment and class change`);
  if (hits[KB.armory]) { if (G.shop) openShop(false); else if (atComms) openShop(true); else toast('Recruitment is at the comms console in the hub.', 2.5); } if (G.shop) { if (hits.Escape) openShop(false); }
  if (hits[KB.kit]) $('kit').hidden = !$('kit').hidden;
  if (hits[KB.info]) { const el = $('info'); el.hidden = !el.hidden; if (!el.hidden) el.innerHTML = infoHTML(G.cls); } if (hits.Escape && !$('info').hidden) $('info').hidden = true;
  if (!G.explore) music.set(S.ph === 'assault' ? 'boss' : S.ph === 'wave' ? (S.A.some(a => ALIENS[a.type].boss) || (G.W.cave && Math.hypot(G.me.x - G.W.cave.x, G.me.z - G.W.cave.z) < 30) ? 'boss' : 'battle') : S.ph === 'lose' ? 'off' : 'calm');
  const paused = G.mode === 'solo' && !locked() && S.ph !== 'lose' && S.ph !== 'win';
  updateMe(paused ? 0 : dt, S);
  if (G.sim) {
    const p = G.sim.players.get(G.myId); if (p) G.sim.pose(G.myId, G.me.x, G.me.y, G.me.z, (G.ex && G.ex.veh) ? G.ex.veh.yaw : G.me.yaw, G.me.prone ? 2 : G.me.kneel ? 1 : 0, vehCode());
    if (!paused && !G.explore) G.sim.update(dt);
    if (G.mode === 'host') { netT += dt; if (netT > 0.1) { netT = 0; G.net.send({ t: 'st', v: VER, map: G.map, ...G.sim.pack(), fx: G.out }); G.out = []; for (const q of [...G.sim.players.values()]) if (q.id !== G.myId && G.time - (q.seen || 0) > 10) G.sim.removePlayer(q.id); } }
  } else { poseT += dt; if (poseT > 0.066) { poseT = 0; G.net.send({ t: 'pose', p: [+G.me.x.toFixed(2), +G.me.y.toFixed(2), +G.me.z.toFixed(2), +((G.ex && G.ex.veh) ? G.ex.veh.yaw : G.me.yaw).toFixed(2), G.me.prone ? 2 : G.me.kneel ? 1 : 0, vehCode()] }); } }
  updateFlashes(dt); updateCorpses(dt); updateTacMissiles(dt); if (G.mmap && hits.Escape) closeMissileMap();
  if (G.W) { G.W.sun.position.set(camera.position.x + 40, 90, camera.position.z + 25); G.W.sun.target.position.set(camera.position.x, 0, camera.position.z); }
  if (S.ph === 'wave' || S.ph === 'assault') { G.artT = (G.artT ?? 8) - dt; if (G.artT <= 0) { G.artT = 5 + Math.random() * 9; audio.gun('artillery', 0.35 + Math.random() * 0.3, 1, 1); } }
  if (!paused) { updateGrenades(dt); updateMeteors(dt); updateFx(dt); updateWeather(dt, S); }
  if (G.explore && G.ex) G.ex.update(dt);
  syncView(S, paused ? 0 : dt);
  hud(dt, S);
  G.fpsN = (G.fpsN || 0) + 1; G.fpsT = (G.fpsT || 0) + dt; if (G.fpsT > 0.5) { $('fps').hidden = !SET.fps; $('fps').textContent = Math.round(G.fpsN / G.fpsT) + ' fps'; G.fpsN = G.fpsT = 0; }
  renderer.render(scene, camera); clearHits();
}
function clearHits() { for (const k in hits) delete hits[k]; clickL = clickR = false; }
requestAnimationFrame(frame);

// ---------------------------------------------------------------- starting a game
function clearWorld() { for (const m of [view.aliens, view.turrets, view.players, view.pods, view.allies]) { for (const v of m.values()) { scene.remove(v.mesh || v); if (v.bar) scene.remove(v.bar); } m.clear(); } if (G.W) scene.remove(G.W.group); }
function begin(mapId) {
  clearWorld(); G.map = mapId; G.W = buildWorld(scene, mapId); newMe(); makeWeather(); applyQuality(); G.on = true; if (G.vx) { for (const m of G.vx.M.values()) scene.remove(m); for (const m of [...G.vx.Z, ...G.vx.K, ...(G.vx.S || [])]) scene.remove(m); for (const mp of [G.vx.D, G.vx.Q]) if (mp) for (const m of mp.values()) scene.remove(m); G.vx = null; }
  $('kit').innerHTML = `<h3>${CLASSES[G.cls].name}</h3>` + kitHTML(G.cls) + '<p class="small">H hides this card.</p>'; $('kit').hidden = false; setTimeout(() => $('kit').hidden = true, 12000);
  $('title').hidden = true; $('hud').hidden = false; canvas.requestPointerLock();
  setT('mapName', MAPS[mapId].name);
  toast(music.on ? 'Music on (N turns it off) · M opens the live map' : 'Music is off: press N to turn it on', 4);
  toast(`${MAPS[mapId].name}: hold the hub. Aliens follow the glowing track from the Brood Queen's cave.`, 6);
  banner('YOUR MISSION', 'The alien bastards know we\'re coming. Get inside the hive and kill the queen! We will extract you as soon as your mission is complete.'); bannerT = 6;
}
function onMsg(m) {
  if (G.mode === 'host') {
    if (m.t === 'hello') { if (m.v !== VER) return; G.sim.addPlayer(m.from, String(m.n || 'Marine').slice(0, 14), CLASSES[m.c] ? m.c : 'assault').seen = G.time; }
    else if (m.t === 'pose') { const p = G.sim.players.get(m.from); if (p) { p.seen = G.time; G.sim.pose(m.from, ...m.p); } else G.net.send({ t: 'who', to: m.from }); }
    else if (m.t === 'req' && m.r && m.r.a !== 'start') G.sim.request(m.from, m.r);
    else if (m.t === 'fx' && m.e && ['tr', 'rk', 'gr'].includes(m.e.k)) { m.e.f = m.from; fx(m.e); G.out.push(m.e); }
    else if (m.t === 'bye') G.sim.removePlayer(m.from);
  } else if (G.mode === 'client') {
    if (m.t === 'st') {
      if (m.v !== VER) { if (!G.warned) { G.warned = 1; status('Your friend has a different version. Both of you reload the page.'); } return; }
      if (!G.W || G.map !== m.map || !G.on) begin(m.map);
      G.snap = decode(m); if (!mine(G.snap)) G.net.send({ t: 'hello', n: G.name, c: G.cls, v: VER });
      for (const e of m.fx || []) if (e.f !== G.myId) fx(e);
    } else if (m.t === 'who' && m.to === G.myId) G.net.send({ t: 'hello', n: G.name, c: G.cls, v: VER });
  }
}
function status(s) { $('netStatus').textContent = s; const h = $('hudCode'); if (G.mode === 'host' && G.net && G.net.code) h.textContent = 'Online code: ' + G.net.code; }
function readTitle() { G.name = ($('name').value.trim() || 'Marine').slice(0, 14); store.set('hb-name', G.name); store.set('hb-cls', G.cls); store.set('hb-map', G.map); audio.unlock(); }
function startLocal(mode) {
  readTitle(); G.mode = mode; G.myId = mode === 'host' ? G.net.id : 'me'; G.sim = null; G.snap = null;
  begin(G.map); G.sim = new Sim(G.W, emit); G.sim.addPlayer(G.myId, G.name, G.cls).seen = 1e9;
}
$('btnSolo').onclick = () => startLocal('solo');
$('btnHost').onclick = () => { readTitle(); G.net = new Net(onMsg, status); G.mode = 'host'; if (!G.net.host()) return; startLocal('host'); status(G.net.loop ? 'Hosting (test). Code: ' + G.net.code : 'Starting online game...'); $('hudCode').textContent = 'Online code: ' + G.net.code; };
$('btnJoin').onclick = () => { const code = $('code').value; if (!code.trim()) { status('Type the code your friend gave you.'); return; } readTitle(); G.net = new Net(onMsg, status); G.mode = 'client'; G.myId = G.net.id; G.sim = null; G.net.join(code, () => { G.net.send({ t: 'hello', n: G.name, c: G.cls, v: VER }); status('Connected. Waiting for the battle...'); }); };
$('code').addEventListener('keydown', e => { if (e.key === 'Enter') $('btnJoin').click(); });
// ---------------------------------------------------------------- settings screen
let setTab = 'video', rebinding = '';
function openSettings() { $('settings').hidden = false; G.settings = true; if (document.pointerLockElement) document.exitPointerLock(); drawSettings(); }
const keyName = c => c.replace('Key', '').replace('Digit', '').replace('Left', ' (left)').replace('Right', ' (right)');
function drawSettings() {
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === setTab));
  const row = (label, ctl) => `<div class="srow"><span>${label}</span>${ctl}</div>`, rng = (id, min, max, step, v) => `<input type="range" data-s="${id}" min="${min}" max="${max}" step="${step}" value="${v}">`;
  let h = '';
  if (setTab === 'video') h = row('Fullscreen', `<button class="kb" data-act="full">${document.fullscreenElement ? 'On' : 'Off'}</button>`) + row('Graphics quality', `<select data-s="quality">${['low', 'medium', 'high'].map(q => `<option value="${q}" ${SET.quality === q ? 'selected' : ''}>${q[0].toUpperCase() + q.slice(1)}</option>`).join('')}</select>`) + row(`Field of view: <b>${SET.fov}</b>`, rng('fov', 60, 100, 1, SET.fov)) + row('Show frame rate', `<button class="kb" data-act="fps">${SET.fps ? 'On' : 'Off'}</button>`) + '<p class="small">Low quality turns off shadows and draws fewer pixels: use it if the game is laggy.</p>';
  if (setTab === 'audio') h = row('Master volume', rng('master', 0, 1, 0.05, SET.master)) + row('Music volume', rng('music', 0, 1, 0.05, music.vol)) + row('Effects volume', rng('sfx', 0, 1, 0.05, audio.vol)) + row('Music', `<button class="kb" data-act="musictoggle">${music.on ? 'On' : 'Off'}</button>`);
  if (setTab === 'controls') h = row('Mouse sensitivity', rng('sens', 0.3, 2.5, 0.1, sens)) + row('Scope and aim sensitivity', rng('zoomSens', 0.3, 2, 0.1, SET.zoomSens)) + row('Invert mouse up/down', `<button class="kb" data-act="invert">${SET.invert ? 'On' : 'Off'}</button>`) + '<p class="small">Click a key, then press the new key. Esc cancels.</p>' + Object.keys(KB_DEFAULT).filter(k => k !== 'upgrade').map(k => row(KB_NAMES[k], `<button class="kb ${rebinding === k ? 'wait' : ''}" data-key="${k}">${rebinding === k ? 'press a key…' : keyName(KB[k])}</button>`)).join('') + row('', '<button class="kb" data-act="resetkeys">Reset keys</button>');
  $('setBody').innerHTML = h;
}
function applyAudio() { if (audio.out) audio.out.gain.value = SET.master; music.mul = SET.master; music.setVol(music.vol); }
$('btnSet').onclick = openSettings; $('btnSet2').onclick = openSettings; $('btnResume').onclick = () => canvas.requestPointerLock();
$('setClose').onclick = () => { $('settings').hidden = true; G.settings = false; rebinding = ''; saveSettings(); };
document.querySelector('.tabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) { setTab = b.dataset.tab; rebinding = ''; drawSettings(); } };
$('setBody').addEventListener('input', e => { const k = e.target.dataset.s; if (!k) return; const v = e.target.value;
  if (k === 'quality') { SET.quality = v; applyQuality(); } else if (k === 'fov') { SET.fov = +v; e.target.parentElement.firstChild.innerHTML = `Field of view: <b>${v}</b>`; } else if (k === 'master') { SET.master = +v; applyAudio(); } else if (k === 'music') { music.setVol(+v); if (!music.on) music.toggle(); } else if (k === 'sfx') { audio.setVol(+v); audio.gun('rifle', 0.8); } else if (k === 'sens') { sens = +v; localStorage.setItem('hb-sens', sens); } else if (k === 'zoomSens') SET.zoomSens = +v;
  saveSettings(); });
$('setBody').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.key) { rebinding = b.dataset.key; drawSettings(); return; }
  const a = b.dataset.act; if (a === 'full') { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => { }); setTimeout(drawSettings, 300); } else if (a === 'fps') SET.fps = !SET.fps; else if (a === 'invert') SET.invert = !SET.invert; else if (a === 'musictoggle') music.toggle(); else if (a === 'resetkeys') Object.assign(KB, KB_DEFAULT);
  saveSettings(); drawSettings(); });
addEventListener('keydown', e => { if (!rebinding) return; e.preventDefault(); e.stopPropagation(); if (e.code !== 'Escape') { for (const k in KB) if (KB[k] === e.code && k !== rebinding) KB[k] = KB[rebinding]; KB[rebinding] = e.code; } rebinding = ''; saveSettings(); drawSettings(); }, true);
applyQuality(); setTimeout(applyAudio, 0);
$('mvol2').value = music.vol; $('mvol2').oninput = e => { music.setVol(+e.target.value); if (!music.on) music.toggle(); };
$('svol2').value = audio.vol; $('svol2').oninput = e => { audio.setVol(+e.target.value); audio.gun('rifle', 0.8); };
$('btnQuit').onclick = () => location.reload();
$('mmapCv').addEventListener('mousemove', e => { const r = e.target.getBoundingClientRect(); G.mmHover = [((e.clientX - r.left) / r.width * 2 - 1) * BOUNDS, ((e.clientY - r.top) / r.height * 2 - 1) * BOUNDS]; });
$('mmapCv').addEventListener('click', e => { if (!G.mmSp) return; const r = e.target.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width * 2 - 1) * BOUNDS, z = ((e.clientY - r.top) / r.height * 2 - 1) * BOUNDS; req({ a: 'special', x: +x.toFixed(1), z: +z.toFixed(1) }); closeMissileMap(); });
$('mmapX').onclick = () => closeMissileMap();
$('btnAgain').onclick = () => { req({ a: 'start' }); canvas.requestPointerLock(); };
$('btnFob').onclick = () => { if (G.mode === 'host') G.out.push({ k: 'fob' }); startFob(); };
$('btnEndQuit').onclick = () => location.reload();

// title screen pickers
G.name = store.get('hb-name', ''); $('name').value = G.name; G.cls = store.get('hb-cls', 'assault'); G.map = store.get('hb-map', 'mars'); if (!CLASSES[G.cls]) G.cls = 'assault'; if (!MAPS[G.map]) G.map = 'mars';
// K: the full gear guide for your class: every weapon, the welder, items and structures, with what they do and their numbers
function infoHTML(k) {
  const c = CLASSES[k], g = c.gun, th = c.throw, row = (key, ico, name, text, stats) => `<div class="gi"><div class="gk">${key}</div>${icon(ico)}<div><b>${name}</b><p>${text}</p>${stats ? `<small>${stats}</small>` : ''}</div></div>`;
  const gunTxt = g.pellets ? 'Shotgun. Deadly up close.' : g.kind === 'rocket' ? 'Rockets that explode and break armour.' : g.spin ? 'Spins up, then fires a stream of bullets.' : g.pierce ? 'Shoots through 3 aliens. Right click to scope.' : 'Your main gun. Right click to aim.';
  const thTxt = { frag: 'Throw it at a pack of aliens.', claymore: 'Throw it down. It blasts aliens that walk in front.', medkit: 'Drop it for a teammate: +60 health.', ammo: 'Drop it for a teammate: refills ammo.' }[th.kind] || 'Your class item.';
  let h = `<h2>${c.name}</h2><p class="sub2">${c.role} · ${c.hp} health · ${c.team}</p><div class="gg">`;
  h += row('1', k, g.name, gunTxt, `${Math.round(g.dmg)}${g.pellets ? '×' + g.pellets : ''} dmg · ${g.mag} mag · ${g.reserve} spare`);
  h += row('2', 'pistol', 'Side arm', 'Backup pistol for when you run dry.', `${SIDEARM.mag} mag · ${SIDEARM.reserve} spare`);
  h += row('3', 'welder', 'Welding laser', 'Repairs turrets, welds on upgrades, burns aliens up close.', `Upgrades cost scrap: 15, then 30${k === 'engineer' ? ' · you weld 3x faster' : ''}`);
  h += row('4·G', th.kind, th.name, thTxt, `${th.n} carried`);
  h += row('5', 'medkit', 'Field dressing', 'Click to bandage yourself.', '+40 health · 2 carried');
  if (c.heal) h += row('6', 'beam', 'Heal beam', 'Hold on a teammate to heal them.', '');
  for (const [key, kind] of [['T', c.sentry], ['F', c.defense], ['V', c.third]]) { const t = TURRETS[kind]; h += row(key, kind, t.name, t.desc, `${t.cost} gold${t.ball ? ' · thrown' : ' · left click places it'}`); }
  h += row('X', 'supply', 'Special', 'Found in supply drops. Air strikes, troops and more.', '');
  h += row('E', 'crate', 'Use', 'Pick up turrets, salvage wrecks, use teleporters.', '');
  return h + '</div><p class="sub2">Refill ammo, turret kits and dressings in the hub · B at the comms console changes class · K closes</p>';
}
function kitHTML(k) {
  const c = CLASSES[k], g = c.gun, bl = (key, kind) => `<p><b>${key}</b> ${TURRETS[kind].name} (${TURRETS[kind].cost}g): ${TURRETS[kind].desc}</p>`;
  return `<p class="role">${c.role} · ${c.hp} health</p><p><b>1</b> ${g.name}${g.pellets ? ' (pellets, deadly up close)' : g.pierce ? ' (pierces 3 aliens)' : g.kind === 'rocket' ? ' (explodes)' : g.spin ? ' (spins up first)' : ''} · <b>2</b> side arm · <b>3</b> welding torch${k === 'engineer' ? ' (3x faster)' : ''} · <b>4</b> or <b>G</b> ${c.throw.name} ×${c.throw.n}${c.heal ? ' · <b>5</b> heal beam' : ''}</p><p><b>Team</b> ${c.team}</p>` + bl(keyName(KB.sentry), c.sentry) + bl(keyName(KB.defense), c.defense) + bl(keyName(KB.third), c.third);
}
function drawPickers() {
  const best = store.get('hb-best2', {}), mmss = t => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  $('classes').innerHTML = Object.entries(CLASSES).map(([k, c]) => `<button class="pick ${k === G.cls ? 'on' : ''}" data-cls="${k}" style="--c:#${c.color.toString(16).padStart(6, '0')}"><h3>${c.name}</h3>${kitHTML(k)}</button>`).join('');
  $('maps').innerHTML = Object.entries(MAPS).map(([k, m]) => `<button class="pick map ${k === G.map ? 'on' : ''}" data-map="${k}" style="--c:#${m.ground.toString(16).padStart(6, '0')}"><h3>${m.name}</h3><p>${m.sub}</p><p class="kit">${best[k] ? 'Longest hold: ' + mmss(best[k]) : 'Not yet played'}</p></button>`).join('');
}
$('classes').onclick = e => { const b = e.target.closest('[data-cls]'); if (b) { G.cls = b.dataset.cls; drawPickers(); } };
$('maps').onclick = e => { const b = e.target.closest('[data-map]'); if (b) { G.map = b.dataset.map; drawPickers(); } };
drawPickers();
// show a map behind the title screen
G.W = buildWorld(scene, G.map); camera.position.set(0, 40, 70); camera.lookAt(0, 0, 0);
(function spin() { if (G.on) return; const t = performance.now() / 9000; camera.position.set(Math.sin(t) * 80, 45, Math.cos(t) * 80); camera.lookAt(0, 0, 0); requestAnimationFrame(spin); })();
$('pause').addEventListener('mousedown', e => { if (e.target.closest('button,input')) return; audio.unlock(); canvas.requestPointerLock(); });
