// Hive Breach: first-person tower defense. Marines hold the hub against waves of aliens marching down the track.
import * as THREE from 'three';
import * as M from './models.js';
import { CLASSES, TURRETS, MAX_TURRETS, UPGRADES, UPG_PRICES, ALIENS, WAVES, MAPS, BOUNDS, ALLIES, DROP_EVERY, DROP_COST, SQUAD, SQUAD_COST } from './data.js';
import { buildWorld, placeError, LIQUID } from './world.js';
import { Sim, upgradeCost, tStat } from './sim.js';
import { Net, VER } from './net.js';
import { Audio } from './audio.js';
import { Music } from './music.js';

const $ = id => document.getElementById(id);
const canvas = $('game'), renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.shadowMap.enabled = true; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(75, 1, 0.05, 400); scene.add(camera);
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
const audio = new Audio(), music = new Music(audio);
addEventListener('pointerdown', () => { audio.unlock(); music.start(); });
addEventListener('keydown', () => { audio.unlock(); music.start(); });

// ---------------------------------------------------------------- input
const keys = {}, hits = {}; let mouseL = false, mouseR = false, clickL = false, clickR = false;
addEventListener('keydown', e => { if (e.target.tagName === 'INPUT') return; if (!keys[e.code]) hits[e.code] = 1; keys[e.code] = 1; if (['Tab', 'Space'].includes(e.code)) e.preventDefault(); });
addEventListener('keyup', e => { keys[e.code] = 0; });
addEventListener('blur', () => { for (const k in keys) keys[k] = 0; mouseL = mouseR = false; });
const locked = () => document.pointerLockElement === canvas;
canvas.addEventListener('mousedown', e => { audio.unlock(); if (!locked()) { if (G.on && !G.shop) canvas.requestPointerLock(); return; } if (e.button === 0) { mouseL = clickL = true; } if (e.button === 2) { mouseR = clickR = true; } });
addEventListener('mouseup', e => { if (e.button === 0) mouseL = false; if (e.button === 2) mouseR = false; });
addEventListener('contextmenu', e => e.preventDefault());
let sens = +(localStorage.getItem('hb-sens') || 1);
addEventListener('mousemove', e => { if (!locked() || !G.on) return; const k = 0.0022 * sens; G.me.yaw -= e.movementX * k; G.me.pitch = Math.max(-1.5, Math.min(1.5, G.me.pitch - e.movementY * k)); });
document.addEventListener('pointerlockchange', () => { if (!locked()) mouseL = mouseR = false; });

// ---------------------------------------------------------------- game state
const G = { pings: [], on: false, mode: 'solo', myId: 'me', name: 'Marine', cls: 'assault', map: 'mars', W: null, sim: null, net: null, snap: null, out: [], time: 0, shop: false, me: null };
window.G = G;
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } };

// The current battle as plain lists, the same shape whether this game runs it or receives it.
function state() {
  if (G.sim) { const s = G.sim; return { w: s.wave, ph: s.phase, tm: s.timer, hub: s.hub, en: s.endless, n: s.players.size, left: s.q.length + s.aliens.filter(a => !ALIENS[a.type].static).length, wx: s.storm > 0 ? 1 : 0, L: s.allies, C: s.cmd, open: s.hiveOpen(), A: s.aliens, T: s.turrets, P: [...s.players.values()], O: s.pods }; }
  return G.snap;
}
function decode(m) {
  return {
    w: m.w, ph: m.ph, tm: m.tm, hub: m.hub, en: m.en, left: m.left, wx: m.wx, n: m.n, C: m.C, open: m.open,
    L: m.L.map(a => ({ id: a[0], type: a[1], x: a[2], y: a[3], z: a[4], hp: a[5], mhp: a[6], ry: a[7], tg: a[8] })),
    A: m.A.map(a => ({ id: a[0], type: a[1], x: a[2], y: a[3], z: a[4], hp: a[5], mhp: a[6], ry: a[7], stun: a[8], tg: a[9] })),
    T: m.T.map(t => ({ id: t[0], kind: t[1], owner: t[2], x: t[3], z: t[4], ry: t[5], lvl: t[6], hp: t[7], mhp: t[8], tg: t[9], y: t[10], b: t[11], bt: t[12], fresh: t[13], s: t[1] === 'barricade' ? G.W.path.near(t[3], t[4]).s : 0 })),
    P: m.P.map(p => ({ id: p[0], name: p[1], cls: p[2], x: p[3], y: p[4], z: p[5], yaw: p[6], hp: p[7], mhp: p[8], gold: p[9], ups: p[10], dead: p[11], kills: p[12], sp: p[13], rt: p[14], kn: p[15] })),
    O: m.O.map(o => ({ id: o[0], x: o[1], z: o[2] })),
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
    let p = FX.parts.find(q => !q.alive); if (!p) { if (FX.parts.length > 400) return; p = { mesh: new THREE.Mesh(partGeo, m) }; scene.add(p.mesh); FX.parts.push(p); }
    p.alive = true; p.mesh.visible = true; p.mesh.material = m; p.mesh.position.set(x, y, z); p.mesh.scale.setScalar(size * (0.6 + Math.random() * 0.8));
    p.gy = G.W ? G.W.ground(x, z, y + 0.5) + 0.07 : 0.07; p.vx = (Math.random() - 0.5) * sp * 2; p.vy = Math.random() * sp * 1.4; p.vz = (Math.random() - 0.5) * sp * 2; p.life = life * (0.6 + Math.random() * 0.6);
  }
}
const trMats = {}; const trMat = c => trMats[c] || (trMats[c] = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
function tracer(a, b, color = 0xffe080, life = 0.05, w = 0.04) {
  let t = FX.tracers.find(q => !q.alive); if (!t) { if (FX.tracers.length > 120) return; t = { mesh: new THREE.Mesh(trGeo, trMat(color)) }; t.mesh.castShadow = false; scene.add(t.mesh); FX.tracers.push(t); }
  const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); t.alive = true; t.life = life; t.mesh.visible = true; t.mesh.material = trMat(color);
  t.mesh.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); t.mesh.scale.set(w, w, d); t.mesh.lookAt(b[0], b[1], b[2]);
}
const lights = []; for (let i = 0; i < 4; i++) { const L = new THREE.PointLight(0xffa040, 0, 26); scene.add(L); lights.push({ L, t: 0 }); }
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
function smoke(x, y, z, n, r) { const m = M.mat(0x4a4440, { r: 1 }); for (let i = 0; i < n; i++) { let p = FX.parts.find(q => !q.alive); if (!p) { if (FX.parts.length > 400) return; p = { mesh: new THREE.Mesh(partGeo, m) }; scene.add(p.mesh); FX.parts.push(p); } p.alive = true; p.mesh.visible = true; p.mesh.material = m; p.mesh.position.set(x + (Math.random() - 0.5) * r, y + Math.random(), z + (Math.random() - 0.5) * r); p.s0 = 4 + Math.random() * 5; p.mesh.scale.setScalar(p.s0); p.vx = (Math.random() - 0.5) * 1.5; p.vy = 1.5 + Math.random() * 2; p.vz = (Math.random() - 0.5) * 1.5; p.life = p.l0 = 1.6 + Math.random() * 1.4; p.smoke = true; p.gy = -99; } }
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
  for (const p of FX.parts) if (p.alive) { p.life -= dt; if (p.life <= 0) { p.alive = false; p.smoke = false; p.mesh.visible = false; continue; } if (p.smoke) { p.vx *= 0.98; p.vz *= 0.98; p.mesh.scale.setScalar(p.s0 * (0.3 + 0.7 * p.life / p.l0)); p.mesh.position.x += p.vx * dt; p.mesh.position.y += p.vy * dt; p.mesh.position.z += p.vz * dt; continue; } p.vy -= 18 * dt; p.mesh.position.x += p.vx * dt; p.mesh.position.y += p.vy * dt; p.mesh.position.z += p.vz * dt; if (p.mesh.position.y < p.gy) { p.mesh.position.y = p.gy; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; } }
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
    case 'zap': bolt(e.p); audio.sfx('zap', vol(dist(e.p[0][0], e.p[0][2])) * 0.7); break;
    case 'msl': flyer('msl', e.a, e.b, e.t, e.tg); audio.sfx('missile', vol(dist(e.a[0], e.a[2])) * 0.7); break;
    case 'tr': if (e.f !== G.myId) { tracer(e.a, e.b, e.c || 0xffe080, 0.05, 0.04 * (e.p || 1)); flashAt(e.a, 0.8); burst(e.b[0], e.b[1], e.b[2], 0x909090, 1, 1, 0.2); const d = dist(e.a[0], e.a[2]); audio.gun(e.s || 'rifle', vol(d), e.p || 1, Math.min(1, d / 50)); const pv = view.players.get(e.f); if (pv) pv.kick = 1; } break;
    case 'rk': if (e.f !== G.myId) { flyer('rk', e.a, e.b, e.t); flashAt(e.a, 1.4); const d = dist(e.a[0], e.a[2]); audio.gun('rocket', vol(d), 1, Math.min(1, d / 50)); } break;
    case 'gr': if (e.f !== G.myId) grenade(e.a, e.v, false); break;
    case 'wave': banner(`WAVE ${e.w}`, e.boss ? `WARNING: ${ALIENS[e.boss].name.toUpperCase()} INBOUND` : 'Aliens inbound'); audio.sfx(e.boss ? 'alarm' : 'wave'); break;
    case 'clear': banner(`WAVE ${e.w} CLEARED`, `+${e.b} gold · resupply`); audio.sfx('win'); break;
    case 'roar': audio.sfx('roar'); toast(`The ${ALIENS[e.t].name} has emerged from the hive!`, 4); G.shake = 0.6; break;
    case 'hubhit': G.hubFlash = 0.5; boomFx(e.x, e.y + 1, e.z, 2, 1); if (G.time - lastHubMsg > 6) { lastHubMsg = G.time; toast('The hub is under attack!', 2.5); audio.sfx('alarm', 0.5); } break;
    case 'pod': burst(e.x, 1, e.z, 0xffd040, 14, 5, 0.6); if (e.by === G.myId) { audio.sfx('pickup'); toast(`Supply pod: +${e.g} gold (your squad gets a share)`, 3); } break;
    case 'placed': audio.sfx('place', vol(dist(e.x, e.z))); burst(e.x, 0.5, e.z, 0x80c0ff, 8, 3, 0.4); break;
    case 'upg': audio.sfx('buy', 0.6); { const v = view.turrets.get(e.id); if (v) burst(v.mesh.position.x, 2, v.mesh.position.z, 0xffd040, 12, 3, 0.6); } break;
    case 'bought': if (e.to === G.myId) audio.sfx('buy'); break;
    case 'bite': audio.sfx('screech', vol(dist(e.x, e.z)) * 0.4); for (const v of view.aliens.values()) if (Math.abs(v.x - e.x) < 0.6 && Math.abs(v.z - e.z) < 0.6) v.lunge = 0.25; break;
    case 'aggro': if (e.to === G.myId) audio.sfx('screech', 0.7); break;
    case 'hitp': if (e.to === G.myId) hitFrom(e.x, e.z); break;
    case 'tatk': G.pings.push({ x: e.x, z: e.z, t: 3 }); { const v = view.turrets.get(e.id); if (v) v.alert = 3; } if (e.o === G.myId) { toast(`⚠ Your ${TURRETS[e.kind].name} is under attack!`, 3); audio.sfx('alarm', 0.35); } break;
    case 'hatch': burst(e.x, 1 + G.W.top(e.x, e.z), e.z, 0x80ff40, 16, 4, 0.6); audio.sfx('roar', vol(dist(e.x, e.z)) * 0.5); if (dist(e.x, e.z) < 45) toast('A nest is hatching crawlers nearby!', 2.5); break;
    case 'meteor': meteor(e); break;
    case 'alarm': audio.sfx('alarm'); break;
    case 'bolt': if (wx) { wx.flash = 0.35; setTimeout(() => audio.sfx('thunder', 0.8), 500); } break;
    case 'upgstart': audio.sfx('place', vol(dist(e.x, e.z))); break;
    case 'built': audio.sfx('buy', vol(dist(e.x, e.z)) * 0.7); burst(e.x, G.W.top(e.x, e.z) + 1, e.z, 0x80c0ff, 12, 3, 0.5); if (e.o === G.myId) toast(`${TURRETS[e.kind].name} is online.`, 2); break;
    case 'drop': toast(`Reinforcements: ${e.n} marine${e.n > 1 ? 's' : ''} heading for the hive.`, 2.5); break;
    case 'adie': burst(e.x, e.y + 1, e.z, 0xa02020, 8, 3, 0.6); break;
    case 'banner': banner(e.a, e.b); audio.sfx('wave'); break;
    case 'assault': banner('FINAL ASSAULT', 'Destroy the Hive Guardians, then the hive'); audio.sfx('alarm'); toast('Wave 20 survived! Push to the hive: its shield drops when both Guardians are destroyed.', 8); break;
    case 'win': audio.sfx('win'); if (G.mode !== 'client' || true) record(e.w); break;
    case 'lose': audio.sfx('lose'); record(e.w); break;
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
  for (const p of FX.proj) { if (!p.met) continue; const m = p.met; m.t -= dt; m.ring.material.opacity = 0.5 + Math.sin(G.time * 14) * 0.3;
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
function splat(x, z, r) { if (splats.length > 40) { const o = splats.shift(); scene.remove(o.m); } const m = new THREE.Mesh(new THREE.CircleGeometry(r * (0.7 + Math.random() * 0.6), 9), new THREE.MeshBasicMaterial({ color: 0x4ac020, transparent: true, opacity: 0.75, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.rotation.z = Math.random() * 6; m.position.set(x, G.W.top(x, z) + 0.12, z); scene.add(m); splats.push({ m, t: 12 }); }
function record(w) { const b = store.get('hb-best', {}); if ((b[G.map] || 0) < w) { b[G.map] = w; store.set('hb-best', b); } }

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
    if (g.t <= 0) { p.dead = true; scene.remove(p.mesh); if (g.own) req({ a: 'boom', x: g.x, y: g.y, z: g.z, r: 5.5, d: 140 * dmgMul() }); else if (G.mode === 'client') { } }
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
  if (!wx) return; const a = wx.pts.geometry.attributes.position.array, c = camera.position, storm = S && S.wx, fall = wx.kind === 'rain' ? 26 : wx.kind === 'snow' ? (storm ? 6 : 2.5) : 0.4, wind = wx.kind === 'snow' ? (storm ? 14 : 1.5) : wx.kind === 'dust' ? 5 : 2;
  for (let i = 0; i < wx.n; i++) { const o = i * 3; a[o] += wind * dt; a[o + 1] -= fall * dt * (0.7 + (i % 5) * 0.1); if (wx.kind === 'dust') a[o + 1] += Math.sin(G.time + i) * dt * 0.5;
    if (a[o] - c.x > 30) a[o] -= 60; if (a[o] - c.x < -30) a[o] += 60; if (a[o + 2] - c.z > 30) a[o + 2] -= 60; if (a[o + 2] - c.z < -30) a[o + 2] += 60; if (a[o + 1] < c.y - 15) a[o + 1] += 30; if (a[o + 1] > c.y + 15) a[o + 1] -= 30; }
  wx.pts.geometry.attributes.position.needsUpdate = true;
  // blizzards close the fog right in
  const fa = storm ? 32 : wx.fogFar, fn = storm ? 4 : wx.fogNear; scene.fog.far += (fa - scene.fog.far) * Math.min(1, dt * 1.5); scene.fog.near += (fn - scene.fog.near) * Math.min(1, dt * 1.5);
  wx.pts.material.size = wx.kind === 'snow' && storm ? 0.22 : wx.kind === 'snow' ? 0.16 : wx.pts.material.size;
  if (wx.kind === 'rain') { wx.flash = Math.max(0, wx.flash - dt); G.W.hemi.intensity = (G.W.def.hemiI || 1.1) + (wx.flash > 0 ? (Math.sin(wx.flash * 60) > 0 ? 3 : 0.5) : 0); }
}

// ---------------------------------------------------------------- view: meshes that follow the battle
const view = { aliens: new Map(), turrets: new Map(), players: new Map(), pods: new Map(), allies: new Map() };
const huntOf = a => a.tg !== undefined ? a.tg : a.mode === 'hunt' ? (a.tk === 'p' ? a.tid : 't') : 0;
const BAR_Y = { guardian: 5, hivecore: 9, nest: 3.4, crawler: 1.4, spitter: 2.5, brute: 3, flyer: 1.1, ravager: 4.8, queen: 6.2 };
const barGeo = new THREE.PlaneGeometry(1, 0.12), barBg = new THREE.MeshBasicMaterial({ color: 0x200000, depthTest: false, transparent: true, opacity: 0.7 }), barFg = new THREE.MeshBasicMaterial({ color: 0xff4040, depthTest: false });
function colorOf(id, S) { const p = S.P.find(q => q.id === id); return p ? CLASSES[p.cls].color : 0x888888; }
function nameTag(text, color) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const g = cv.getContext('2d'); g.font = 'bold 30px system-ui, sans-serif'; g.textAlign = 'center';
  g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(8, 10, 240, 44); g.fillStyle = '#' + color.toString(16).padStart(6, '0'); g.fillRect(8, 50, 240, 4); g.fillStyle = '#fff'; g.fillText(text.slice(0, 14), 128, 43);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false })); s.scale.set(2.4, 0.6, 1); s.renderOrder = 5; return s;
}
// scaffolding with a progress bar and a countdown, over turrets being built or upgraded
function setLabel(sp, text) { const cv = sp.userData.cv, g = cv.getContext('2d'); g.clearRect(0, 0, 256, 64); g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, 8, 256, 48); g.fillStyle = '#ffd040'; g.font = 'bold 30px system-ui,sans-serif'; g.textAlign = 'center'; g.fillText(text, 128, 43); sp.material.map.needsUpdate = true; }
function scaffold(w, h) {
  const g = new THREE.Group(), cage = new THREE.Group(), pole = M.mat(0xffc020, { m: 0.3 });
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, h, 0.08), pole); p.position.set(x * w / 2, h / 2, z * 1.3); cage.add(p); }
  for (const y of [0.1, h / 2, h]) for (const z of [-1, 1]) { const r = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, 0.06), pole); r.position.set(0, y, z * 1.3); cage.add(r); const r2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 2.6), pole); r2.position.set(z * w / 2, y, 0); cage.add(r2); }
  g.add(cage);
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false })); label.userData.cv = cv; label.scale.set(2.8, 0.7, 1); label.position.y = h + 1.3; label.renderOrder = 6; g.add(label);
  const bg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x202020, depthTest: false })); bg.scale.set(1.9, 0.16, 1); bg.position.y = h + 0.75; bg.renderOrder = 6; g.add(bg);
  const bar = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x40ff80, depthTest: false })); bar.scale.set(1.8, 0.12, 1); bar.center.set(0.5, 0.5); bar.position.y = h + 0.75; bar.renderOrder = 7; g.add(bar);
  g.userData = { cage, label, bar }; return g;
}
let markMat = null;
function markSprite() {
  if (!markMat) { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); g.fillStyle = '#ff3030'; g.beginPath(); g.moveTo(32, 2); g.lineTo(62, 58); g.lineTo(2, 58); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.fillText('!', 32, 52); markMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false }); }
  const s = new THREE.Sprite(markMat); s.scale.set(0.9, 0.9, 1); s.renderOrder = 6; return s;
}
function syncView(S, dt) {
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
    const A = ALIENS[a.type], sc = a.type === 'hivecore' ? 6 : a.type === 'guardian' ? 2.5 : A.boss ? (a.type === 'queen' ? 4 : 2.5) : 1.2, f = Math.max(0, a.hp / a.mhp);
    v.bar.visible = f < 0.999; if (v.bar.visible) { v.bar.position.set(v.x, v.y + BAR_Y[a.type], v.z); v.bar.quaternion.copy(camera.quaternion); v.bar.scale.set(sc, sc, 1); v.fg.scale.x = f; v.fg.position.x = -(1 - f) / 2; }
  }
  for (const [id, v] of view.aliens) if (!seen.has(id)) { scene.remove(v.bar); if (v.mark) scene.remove(v.mark); view.aliens.delete(id); if (died.has(id) && v.type !== 'hivecore') { died.delete(id); corpses.push({ m: v.mesh, t: 0, side: Math.random() < 0.5 ? -1 : 1 }); } else scene.remove(v.mesh); }
  seen.clear();
  for (const t of S.T) {
    seen.add(t.id); let v = view.turrets.get(t.id);
    if (!v) { const mesh = M.turret(t.kind, colorOf(t.owner, S)); mesh.position.set(t.x, t.y, t.z); if (t.kind === 'barricade') mesh.rotation.y = t.ry; else mesh.userData.head.rotation.y = t.ry; scene.add(mesh); v = { mesh, acc: 0, spin: 0, lvl: 0 }; view.turrets.set(t.id, v); }
    const u = v.mesh.userData; v.d = t;
    if (t.kind !== 'barricade' && t.kind !== 'repair' && t.kind !== 'stasis') { let dr = t.ry - u.head.rotation.y; while (dr > Math.PI) dr -= 6.283; while (dr < -Math.PI) dr += 6.283; u.head.rotation.y += dr * Math.min(1, k * 1.5); }
    if (v.lvl !== t.lvl) { v.lvl = t.lvl; if (v.stars) v.mesh.remove(v.stars); v.stars = new THREE.Group(); for (let i = 0; i < t.lvl; i++) M.S(v.stars, 0.12, 0xffd040, (i - (t.lvl - 1) / 2) * 0.35, 0, 0, 1, 1, 1, { e: 0xffa000 }); v.stars.position.y = t.kind === 'barricade' ? 2.3 : 3.3; v.mesh.add(v.stars); }
    if (t.kind === 'repair') u.head.rotation.y += dt * 1.5;
    if (t.kind === 'stasis') u.head.rotation.y += dt * 2;
    if (t.kind === 'tesla') u.orb.scale.setScalar(1 + Math.sin(G.time * 8) * 0.08);
    // minigun fire is drawn here from the target it reports, so nothing extra is sent
    if (t.kind === 'minigun' && t.tg) {
      v.spin += dt * 30; u.spin.rotation.z = v.spin; v.acc += dt; const tv = view.aliens.get(t.tg);
      if (tv && v.acc > 0.07) { v.acc = 0; const ry = u.head.rotation.y, s = v.mesh.scale.x, mx = t.x - Math.sin(ry) * 1.5 * s, mz = t.z - Math.cos(ry) * 1.5 * s; tracer([mx, t.y + 1.35 * s, mz], [tv.x + (Math.random() - 0.5) * 0.6, tv.y + ALIENS[tv.type].h * 0.6, tv.z + (Math.random() - 0.5) * 0.6], 0xffd060, 0.05, 0.05); const dd = dist(t.x, t.z); audio.gun('mini', vol(dd) * 0.75, 0.9 + t.lvl * 0.2, Math.min(1, dd / 45)); flashAt([mx, t.y + 1.35 * s, mz], 1 + t.lvl * 0.3); u.head.position.z = 0.08; }
      u.head.position.z *= 0.8;
    }
    const building = t.b > 0;
    if (building && !v.scaf) { v.scaf = scaffold(t.kind === 'barricade' ? 7 : 2.6, t.kind === 'barricade' ? 2.4 : 3.4); v.scaf.position.set(t.x, t.y, t.z); if (t.kind === 'barricade') v.scaf.rotation.y = t.ry; scene.add(v.scaf); }
    if (v.scaf) { v.scaf.visible = building; if (building) { const f = 1 - t.b / (t.bt || 1), txt = `${t.fresh ? 'BUILDING' : 'UPGRADE Lv' + (t.lvl + 1)} ${t.b.toFixed(1)}s`; v.scaf.userData.bar.scale.x = Math.max(0.01, f); v.scaf.userData.bar.position.x = -(1 - f) * 0.9; if (v.scaf.userData.txt !== txt) setLabel(v.scaf.userData.label, txt); v.scaf.userData.txt = txt; v.scaf.userData.cage.rotation.y += dt * 0.6; if (Math.random() < dt * 8) burst(t.x + (Math.random() - 0.5) * 1.5, t.y + Math.random() * 2.5, t.z + (Math.random() - 0.5) * 1.5, 0xffd060, 2, 2, 0.3); } }
    const sc0 = 1 + (t.lvl - 1) * 0.12, grow = t.fresh ? 0.15 + 0.85 * (1 - t.b / (t.bt || 1)) : 1; v.mesh.scale.set(sc0, sc0 * grow, sc0);
    v.alert = Math.max(0, (v.alert || 0) - dt); if (v.alert > 0 && !v.mark) { v.mark = markSprite(); scene.add(v.mark); } if (v.mark) { v.mark.visible = v.alert > 0 && Math.sin(G.time * 12) > -0.3; v.mark.position.set(t.x, t.y + 4.2, t.z); }
    if (t.hp < t.mhp * 0.35 && Math.random() < dt * 6) burst(t.x, 1.6, t.z, 0x303030, 1, 1, 1, 2);
  }
  for (const [id, v] of view.turrets) if (!seen.has(id)) { scene.remove(v.mesh); if (v.mark) scene.remove(v.mark); if (v.scaf) scene.remove(v.scaf); view.turrets.delete(id); }
  seen.clear();
  for (const p of S.P) {
    if (p.id === G.myId) continue; seen.add(p.id); let v = view.players.get(p.id);
    if (!v || v.cls !== p.cls) { if (v) scene.remove(v.mesh); const mesh = M.marine(CLASSES[p.cls].color, p.cls), tag = nameTag(p.name, CLASSES[p.cls].color); tag.position.y = 2.7; mesh.add(tag); scene.add(mesh); v = { mesh, cls: p.cls, x: p.x, y: p.y, z: p.z, t: 0 }; view.players.set(p.id, v); }
    const kk = 1 - Math.exp(-dt * 14), ox = v.x, oz = v.z; v.x += (p.x - v.x) * kk; v.y += (p.y - v.y) * kk; v.z += (p.z - v.z) * kk; const sp = Math.hypot(v.x - ox, v.z - oz) / Math.max(dt, 1e-4);
    v.t += dt * Math.min(sp, 9) * 1.6; M.animMarine(v.mesh, v.t, sp); v.mesh.position.set(v.x, v.y, v.z); v.mesh.rotation.y = p.yaw; v.mesh.visible = !p.dead; M.kneel(v.mesh, p.kn); v.kick = Math.max(0, (v.kick || 0) - dt * 8); v.mesh.userData.arms.rotation.x = v.kick * 0.25;
    if (!v.hpb) { v.hpb = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x40e070, depthTest: false })); v.hpb.center.set(0, 0.5); v.hpb.position.set(-0.9, 2.35, 0); v.hpb.renderOrder = 6; v.mesh.add(v.hpb); }
    const hf = Math.max(0, p.hp / p.mhp); v.hpb.scale.set(1.8 * hf + 0.001, 0.12, 1); v.hpb.material.color.setHex(hf < 0.3 ? 0xff4040 : 0x40e070);
  }
  for (const [id, v] of view.players) if (!seen.has(id)) { scene.remove(v.mesh); view.players.delete(id); }
  seen.clear();
  for (const o of S.O) { seen.add(o.id); let m = view.pods.get(o.id); if (!m) { m = M.supplyPod(); m.position.set(o.x, 40, o.z); scene.add(m); view.pods.set(o.id, m); } if (m.gy === undefined) m.gy = G.W.top(o.x, o.z); m.position.y = Math.max(m.gy, m.position.y - dt * 25); m.rotation.y += dt; if (m.position.y === m.gy && !m.landed) { m.landed = 1; burst(o.x, m.gy + 0.3, o.z, 0xc0a060, 10, 4, 0.6); } }
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
  // the hive's shield is up until the guardians fall in the final assault
  if (G.W) G.W.hiveShield.visible = S.A.some(a => a.type === 'hivecore') && !S.open;
  if (G.W && G.W.hiveShield.visible) G.W.hiveShield.material.opacity = 0.14 + Math.sin(G.time * 2) * 0.05;
  // the hub turns, and glows red when it is hit
  if (G.W) { const u = G.W.hub.userData; u.rings.rotation.z += dt * 0.6; u.rings.rotation.y += dt * 0.3; G.hubFlash = Math.max(0, (G.hubFlash || 0) - dt); u.shield.material.emissive.setHex(G.hubFlash > 0 ? 0xa02020 : 0x2060a0); u.core.material.emissiveIntensity = 1.2 + Math.sin(G.time * 3) * 0.4; G.W.hive.rotation.y += dt * 0.05; G.W.healRing.material.opacity = 0.35 + Math.sin(G.time * 3) * 0.2; }
}

// ---------------------------------------------------------------- the marine you play
const view2 = { gun: null };
function stats() {
  const C = CLASSES[G.cls], g = C.gun, u = (mine(state()) || {}).ups || {};
  return { dmg: g.dmg * dmgMul(), rate: g.rate * (1 + 0.08 * (u.rate || 0)), mag: Math.ceil(g.mag * (1 + 0.2 * (u.mag || 0))), reload: g.reload * (1 - 0.08 * (u.mag || 0)), speed: C.speed * (1 + 0.08 * (u.spd || 0)) * ((state() || {}).wx ? 0.8 : 1) };
}
function dmgMul() { const u = (mine(state()) || {}).ups || {}; return 1 + 0.1 * (u.dmg || 0); }
function newMe() {
  const s = G.W.spawn; G.me = { x: s.x, y: 0, z: s.z, vy: 0, yaw: Math.atan2(s.x, s.z), pitch: -0.1, ammo: CLASSES[G.cls].gun.mag, rel: 0, cd: 0, place: null, gcd: 0, kick: 0, sp: -1, hp: 0, bob: 0, grounded: true, rockets: [] };
  if (view2.gun) camera.remove(view2.gun); view2.gun = M.gunModel(G.cls, CLASSES[G.cls].color); view2.gun.scale.setScalar(0.55); view2.gun.traverse(o => { o.castShadow = false; }); camera.add(view2.gun);
  view2.flash = new THREE.PointLight(0xffc060, 0, 8); view2.flash.position.set(0.05, 0.05, -1.3); view2.gun.add(view2.flash);
  view2.fsp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); view2.fsp.position.set(0.05, 0.03, -1.45); view2.gun.add(view2.fsp);
  const glove = new THREE.Group(); M.B(glove, 0.12, 0.12, 0.22, 0x2a3036, 0.02, -0.14, 0.05); M.B(glove, 0.13, 0.13, 0.25, CLASSES[G.cls].color, -0.12, -0.1, -0.35); view2.gun.add(glove);
}
const ray = { o: new THREE.Vector3(), d: new THREE.Vector3() };
function aimRay(spread = 0) {
  camera.getWorldPosition(ray.o); camera.getWorldDirection(ray.d);
  if (spread) { ray.d.x += (Math.random() - 0.5) * spread * 2; ray.d.y += (Math.random() - 0.5) * spread * 2; ray.d.z += (Math.random() - 0.5) * spread * 2; ray.d.normalize(); }
  return ray;
}
// nearest alien along a ray, using a sphere per alien
function hitAlien(o, d, maxD) {
  let best = null, bt = maxD;
  for (const v of view.aliens.values()) {
    const A = ALIENS[v.type], big = v.type === 'ravager' ? 1.7 : 1, r = A.r * 1.15, cy = v.y + (A.fly ? 0 : A.h * 0.6 * big);
    const ox = v.x - o.x, oy = cy - o.y, oz = v.z - o.z, t = ox * d.x + oy * d.y + oz * d.z; if (t < 0) continue;
    const d2 = ox * ox + oy * oy + oz * oz - t * t; if (d2 > r * r) continue; const th = t - Math.sqrt(r * r - d2); if (th < bt) { bt = th; best = v; }
  }
  return best ? { v: best, t: bt } : null;
}
function muzzle() { const p = new THREE.Vector3(0.05, 0.02, -0.75); view2.gun.localToWorld(p); return [p.x, p.y, p.z]; }
function shoot(st) {
  const C = CLASSES[G.cls], g = C.gun, me = G.me, lv = ((mine(state()) || {}).ups || {}).dmg || 0, power = 1 + 0.12 * lv; me.ammo--; me.cd = 1 / st.rate; me.kick = 1;
  audio.gun(g.sound, 1, power, 0);
  // recoil: the view climbs and drifts; kneeling halves it; part of it settles back
  const rk0 = g.recoil * (me.kneel ? 0.5 : 1) * (1 + 0.08 * lv) * (0.75 + Math.random() * 0.5); me.pitch = Math.min(1.5, me.pitch + rk0); me.yaw += (Math.random() - 0.5) * rk0 * 0.8; me.rcv = (me.rcv || 0) + rk0 * 0.55;
  me.heat = Math.min(12, (me.heat || 0) + 1); G.punch = Math.min(6, (G.punch || 0) + (g.kind === 'rocket' ? 5 : 0.9 * power)); G.shake = Math.max(G.shake || 0, (g.kind === 'rocket' ? 0.35 : 0.07) * power);
  const mz = muzzle(); G.flash = 0.05; flashLight(mz[0], mz[1], mz[2], 18 * power, 0.05);
  if (g.kind !== 'rocket') { const rx = Math.cos(me.yaw), rz = -Math.sin(me.yaw); casing(mz[0] + Math.sin(me.yaw) * 0.45 + rx * 0.12, mz[1] - 0.05, mz[2] + Math.cos(me.yaw) * 0.45 + rz * 0.12, rx * 2.5, 2.5, rz * 2.5); }
  else smoke(mz[0], mz[1], mz[2], 3, 0.4);
  if (g.kind === 'rocket') {
    const r = aimRay(0); const v = r.d.clone().multiplyScalar(48);
    const rk = { x: r.o.x + r.d.x * 0.8, y: r.o.y + r.d.y * 0.8 - 0.15, z: r.o.z + r.d.z * 0.8, vx: v.x, vy: v.y, vz: v.z, t: g.life, mesh: null };
    // where it will land, so friends can see it fly there
    const sim = { ...rk }; let tt = 0; while (tt < g.life) { if (stepRocket(sim, 0.02)) break; tt += 0.02; }
    send({ k: 'rk', a: mz, b: [sim.x, sim.y, sim.z], t: Math.max(0.05, tt) });
    const m = new THREE.Group(); M.C(m, 0.1, 0.1, 0.7, 0xdddddd, 0, 0, 0).rotation.x = Math.PI / 2; M.S(m, 0.14, 0xffa040, 0, 0, 0.4, 1, 1, 1, { e: 0xff6000 }); m.position.set(...mz); scene.add(m); rk.mesh = m; me.rockets.push(rk);
    return;
  }
  const mx = g.max, r = aimRay(g.spread * (me.moving ? 1.6 : 1) * (me.kneel ? 0.4 : 1) * (1 + Math.min(1.5, me.heat * 0.09)) * (me.y > G.W.ground(me.x, me.z, me.y + 0.5) + 0.2 ? 2 : 1)), wall = G.W.T.ray(r.o, r.d, mx), h = hitAlien(r.o, r.d, Math.min(mx, wall));
  let end; if (h) { end = [r.o.x + r.d.x * h.t, r.o.y + r.d.y * h.t, r.o.z + r.d.z * h.t]; const fall = h.t <= g.near ? 1 : Math.max(0.3, 1 - 0.7 * (h.t - g.near) / (g.far - g.near)); req({ a: 'hit', id: h.v.id, d: st.dmg * fall }); G.hitT = 0.12; G.hitWeak = fall < 0.6; audio.sfx('hit', 0.5 * fall); burst(end[0], end[1], end[2], 0x70ff40, 3, 2, 0.25); }
  else { const t = Math.min(mx, wall); end = [r.o.x + r.d.x * t, r.o.y + r.d.y * t, r.o.z + r.d.z * t]; if (t < mx) burst(end[0], end[1] + 0.1, end[2], 0x909090, 2, 1.5, 0.2); }
  const col = G.cls === 'engineer' ? 0x60c0ff : 0xffe080; tracer(mz, end, col, 0.05, 0.035 * power);
  send({ k: 'tr', a: mz.map(v => +v.toFixed(1)), b: end.map(v => +v.toFixed(1)), c: col, s: g.sound, p: +power.toFixed(2) });
}
// rocket step; true when it bursts
function casing(x, y, z, vx, vy, vz) { const m = M.mat(0xc8a040, { m: 0.8, r: 0.3 }); let p = FX.parts.find(q => !q.alive); if (!p) { if (FX.parts.length > 400) return; p = { mesh: new THREE.Mesh(partGeo, m) }; scene.add(p.mesh); FX.parts.push(p); } p.alive = true; p.smoke = false; p.mesh.visible = true; p.mesh.material = m; p.mesh.position.set(x, y, z); p.mesh.scale.set(0.18, 0.18, 0.4); p.vx = vx + (Math.random() - 0.5); p.vy = vy + Math.random(); p.vz = vz + (Math.random() - 0.5); p.life = 1.2; p.gy = G.W.ground(x, z, y) + 0.03; }
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
  const r = TURRETS[kind].range; if (r && kind !== 'stasis') { ghostRing = new THREE.Mesh(new THREE.RingGeometry(r - 0.15, r, 64), new THREE.MeshBasicMaterial({ color: 0x80ffa0, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })); ghostRing.rotation.x = -Math.PI / 2; ghostRing.position.y = 0.08; scene.add(ghostRing); }
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
  if (clickL) { clickL = false; if (err) audio.sfx('nope'); else { req({ a: 'place', kind: me.place, x: +x.toFixed(2), z: +z.toFixed(2), ry: +ry.toFixed(2) }); me.place = null; } }
  if (clickR || hits.Escape) { me.place = null; clickR = false; }
}
function lookTurret(S) {
  const me = G.me, fx = -Math.sin(me.yaw), fz = -Math.cos(me.yaw); let best = null, bs = 0.9;
  for (const t of S.T) { const dx = t.x - me.x, dz = t.z - me.z, d = Math.hypot(dx, dz); if (d > 9 || d < 0.1) continue; const c = (dx * fx + dz * fz) / d; if (c > bs + (d < 2.5 ? -0.5 : 0)) { bs = c; best = t; } }
  return best;
}

function updateMe(dt, S) {
  const me = G.me, my = mine(S); if (!my) return;
  if (my.sp !== me.sp) { me.sp = my.sp; me.x = G.W.spawn.x; me.z = G.W.spawn.z; me.y = G.W.top(me.x, me.z); me.vy = 0; me.yaw = Math.atan2(me.x, me.z); me.ammo = stats().mag; me.rel = 0; }
  if (my.hp < me.hp - 0.5 && !my.dead) { G.hurtT = 0.35; audio.sfx('hurt', 0.6); }
  if (my.hp > me.hp + 0.5 && my.hp < my.mhp && Math.random() < 0.2) audio.sfx('heal', 0.4);
  me.hp = my.hp;
  const st = stats(), live = G.on && !my.dead && S.ph !== 'lose';
  // walking
  let mx = 0, mz = 0; if (live && locked()) { if (keys.KeyW) mz -= 1; if (keys.KeyS) mz += 1; if (keys.KeyA) mx -= 1; if (keys.KeyD) mx += 1; }
  me.kneel = live && locked() && (keys.KeyC || keys.ControlLeft) && !me.place; me.kh = (me.kh || 0) + ((me.kneel ? 1 : 0) - (me.kh || 0)) * Math.min(1, dt * 12);
  const l = Math.hypot(mx, mz) || 1, run = keys.ShiftLeft && mz < 0 && !me.kneel ? 1.45 : 1, sp = st.speed * run * (me.kneel ? 0.4 : 1), s = Math.sin(me.yaw), c = Math.cos(me.yaw);
  const vx = (mx * c + mz * s) / l * sp, vz = (-mx * s + mz * c) / l * sp; me.moving = mx || mz;
  // step each way on its own so you slide along cliffs instead of sticking
  const T = G.W.T, foot = me.y;
  for (const [ax, az] of [[vx * dt, 0], [0, vz * dt]]) { if (!ax && !az) continue; const nx = me.x + ax, nz = me.z + az, gh = T.ground(nx, nz, foot + 0.6), pr = T.ground(me.x + Math.sign(ax) * 0.5, me.z + Math.sign(az) * 0.5, foot + 0.6); if ((gh > foot + 0.02 && (pr - foot > 1.3 || gh - foot > 0.65)) || T.solid(nx, foot + 1.6, nz)) continue; me.x = nx; me.z = nz; }
  for (const q of G.W.colliders) { const dx = me.x - q.x, dz = me.z - q.z, d = Math.hypot(dx, dz), r = q.r + 0.45; if (d < r && d > 0) { me.x = q.x + dx / d * r; me.z = q.z + dz / d * r; } }
  me.x = Math.max(-BOUNDS + 1.2, Math.min(BOUNDS - 1.2, me.x)); me.z = Math.max(-BOUNDS + 1.2, Math.min(BOUNDS - 1.2, me.z));
  const gh = T.ground(me.x, me.z, me.y + 0.6); let grounded = false;
  if (me.vy <= 0 && me.y - gh < 0.35 && me.y - gh > -0.7) { me.y = gh; me.vy = 0; grounded = true; }
  else { me.vy -= 22 * dt; me.y += me.vy * dt; if (me.y < gh && me.y > gh - 0.7) { me.y = gh; me.vy = 0; } }
  if (live && hits.Space && grounded) { me.vy = 7.5; me.y += 0.02; }
  const ceil = T.ceiling(me.x, me.z, me.y); if (me.y + 1.9 > ceil) { me.y = Math.min(me.y, ceil - 1.9); me.vy = Math.min(0, me.vy); }
  if (grounded && T.chasm(me.x, me.z) > 0.99) me.safe = { x: me.x, z: me.z, y: me.y };
  if (me.y < LIQUID + 0.5 && live) { const sf = me.safe || { x: G.W.spawn.x, z: G.W.spawn.z, y: T.top(G.W.spawn.x, G.W.spawn.z) }; me.x = sf.x; me.z = sf.z; me.y = sf.y + 0.2; me.vy = 0; req({ a: 'fall' }); toast('You fell into the chasm and climbed back out, hurt.', 3); audio.sfx('hurt'); }
  me.bob += dt * (me.moving && grounded ? sp * 1.4 : 0);
  // camera
  G.shake = Math.max(0, (G.shake || 0) - dt); const sh = G.shake * 0.15;
  me.heat = Math.max(0, (me.heat || 0) - dt * 7); const rr = (me.rcv || 0) * Math.min(1, dt * 5); me.pitch -= rr; me.rcv = (me.rcv || 0) - rr;
  G.punch = Math.max(0, (G.punch || 0) - dt * 30); const fov = 75 + (run > 1 && me.moving ? 6 : 0) - G.punch * 0.6 - me.kh * 3; if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 14); camera.updateProjectionMatrix(); }
  camera.position.set(me.x + (Math.random() - 0.5) * sh, (my.dead ? 3.5 : 1.7 - me.kh * 0.75) + me.y + Math.sin(me.bob) * 0.05 + (Math.random() - 0.5) * sh, me.z);
  camera.rotation.set(me.pitch, me.yaw, 0, 'YXZ');
  // gun
  me.cd -= dt; me.gcd -= dt; me.kick = Math.max(0, me.kick - dt * 9); G.flash = Math.max(0, (G.flash || 0) - dt); view2.flash.intensity = G.flash > 0 ? 25 : 0; view2.fsp.visible = G.flash > 0; view2.fsp.scale.setScalar((G.cls === 'heavy' ? 1.6 : 0.9) * (0.7 + Math.random() * 0.8) * (1 + 0.08 * ((mine(S) || {}).ups || {}).dmg)); view2.fsp.material.rotation = Math.random() * 6;
  if (me.rel > 0) { me.rel -= dt; if (me.rel <= 0) me.ammo = st.mag; }
  if (me.ammo > st.mag) me.ammo = st.mag;
  const gn = view2.gun, rf = me.rel > 0 ? Math.sin(Math.min(1, 1 - me.rel / st.reload) * Math.PI) : 0;
  gn.position.set(0.21 - me.kh * 0.06 + Math.sin(me.bob * 0.5) * 0.01, -0.21 + me.kh * 0.03 + Math.abs(Math.cos(me.bob * 0.5)) * 0.008 - rf * 0.12 + me.kick * 0.012, -0.42 + me.kick * (G.cls === 'heavy' ? 0.14 : 0.07)); gn.rotation.set(me.kick * (G.cls === 'heavy' ? 0.25 : 0.12) - rf * 0.7, (Math.random() - 0.5) * me.kick * 0.03, rf * 0.3 + me.kick * 0.04 - me.kh * 0.08); gn.visible = !my.dead && !me.place;
  if (!live) { me.place = null; updatePlace(S); return; }
  if (locked() && !G.shop) {
    if (hits.KeyR && me.rel <= 0 && me.ammo < st.mag) { me.rel = st.reload; audio.sfx('reload'); }
    if (hits.KeyQ) me.place = me.place === CLASSES[G.cls].sentry ? null : CLASSES[G.cls].sentry;
    if (hits.KeyE) me.place = me.place === CLASSES[G.cls].defense ? null : CLASSES[G.cls].defense;
    if (hits.KeyG && me.gcd <= 0) { me.gcd = 10; const r = aimRay(0), a = [r.o.x + r.d.x * 0.5, r.o.y - 0.2, r.o.z + r.d.z * 0.5], v = [r.d.x * 17, r.d.y * 17 + 5, r.d.z * 17]; grenade(a, v, true); send({ k: 'gr', a: a.map(q => +q.toFixed(2)), v: v.map(q => +q.toFixed(2)) }); audio.sfx('grenade'); }
    if (!me.place) {
      if (mouseL && me.cd <= 0 && me.rel <= 0) { if (me.ammo > 0) shoot(st); else { me.rel = st.reload; audio.sfx('reload'); } }
      const t = lookTurret(S); G.lookT = t;
      if (t) {
        const T = TURRETS[t.kind], own = S.P.find(p => p.id === t.owner), c = upgradeCost(t);
        prompt(`<b>${T.name}</b> Lv${t.lvl}${own ? ' · ' + esc(own.name) : ''} · ${Math.ceil(t.hp)}/${t.mhp} · ` + (t.b > 0 ? `${t.fresh ? 'building' : 'upgrading'}: ${t.b.toFixed(1)} s` : t.lvl < 3 ? `<b>U</b> upgrade (${c})` : 'max level') + (t.owner === G.myId ? ` · <b>X</b> sell` : ''));
        if (hits.KeyU) req({ a: 'upg', id: t.id }); if (hits.KeyX && t.owner === G.myId) req({ a: 'sell', id: t.id });
      }
    }
  }
  updatePlace(S);
  for (const r of me.rockets) { if (r.mesh) { const ox = r.x, oy = r.y, oz = r.z; } if (stepRocket(r, dt)) { r.dead = true; scene.remove(r.mesh); req({ a: 'boom', x: r.x, y: r.y, z: r.z, r: CLASSES.heavy.gun.splash, d: st.dmg }); } else { r.mesh.position.set(r.x, r.y, r.z); r.mesh.lookAt(r.x - r.vx, r.y - r.vy, r.z - r.vz); if (Math.random() < 0.8) burst(r.x, r.y, r.z, 0x808080, 1, 0.4, 0.5); } }
  me.rockets = me.rockets.filter(r => !r.dead);
}

// ---------------------------------------------------------------- HUD
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let toastT = 0, bannerT = 0, promptSet = false;
function toast(m, t = 3) { const d = document.createElement('div'); d.textContent = m; $('toasts').prepend(d); setTimeout(() => d.remove(), t * 1000); while ($('toasts').children.length > 5) $('toasts').lastChild.remove(); }
function banner(a, b) { $('bannerA').textContent = a; $('bannerB').textContent = b; $('banner').hidden = false; bannerT = 3; }
function prompt(html) { promptSet = true; const p = $('prompt'); if (p._h !== html) { p.innerHTML = html; p._h = html; } p.hidden = false; }
const setT = (id, v) => { const e = $(id); if (e._v !== v) { e._v = v; e.textContent = v; } };
const setH = (id, v) => { const e = $(id); if (e._v !== v) { e._v = v; e.innerHTML = v; } };
let mapT = 0;
function hud(dt, S) {
  const my = mine(S); if (!my) return; const st = stats(), C = CLASSES[G.cls];
  setT('gold', Math.floor(my.gold)); setT('hpTxt', `${Math.ceil(my.hp)} / ${my.mhp}`); $('hpBar').style.width = (my.hp / my.mhp * 100) + '%';
  setT('ammo', G.me.rel > 0 ? 'RELOADING' : `${G.me.ammo} / ${st.mag}`); setT('gunName', C.gun.name);
  setT('waveTxt', S.ph === 'assault' ? 'ASSAULT THE HIVE' : S.w ? `WAVE ${S.w}${S.en || S.w > WAVES ? '' : ' / ' + WAVES}` : 'PREPARE'); $('hubBar').style.width = S.hub + '%'; setT('hubTxt', `HUB ${Math.ceil(S.hub)}%`);
  let info = ''; if (S.ph === 'assault') { const g = S.A.filter(a => a.type === 'guardian').length; info = g ? `FINAL ASSAULT: destroy ${g} Hive Guardian${g > 1 ? 's' : ''}, then the hive` : 'FINAL ASSAULT: the shield is down, destroy the hive!'; } else if (S.ph === 'wave') info = `${S.left} aliens left`; else if (S.ph === 'build') info = (S.w ? `Wave ${S.w + 1}` : 'First wave') + ` in ${Math.max(0, Math.ceil(S.tm))} s · build your defenses` + (G.mode === 'client' ? '' : ' (Enter: send it now)');
  if (S.C && (S.ph === 'wave' || S.ph === 'assault')) info += ` · reinforcements in ${Math.max(0, Math.ceil(S.C.t))} s`;
  if (S.n > 1) info += ` · squad of ${S.n}: aliens x${((1 + 0.5 * (S.n - 1)) * (1 + 0.3 * (S.n - 1))).toFixed(1)}`;
  setT('waveInfo', info);
  const mt = S.T.filter(t => t.owner === G.myId).length, sT = TURRETS[C.sentry], dT = TURRETS[C.defense];
  setH('slots', `<div class="slot ${G.me.place === C.sentry ? 'on' : ''} ${my.gold < sT.cost ? 'poor' : ''}"><b>Q</b>${sT.name}<i>${sT.cost}g</i></div><div class="slot ${G.me.place === C.defense ? 'on' : ''} ${my.gold < dT.cost ? 'poor' : ''}"><b>E</b>${dT.name}<i>${dT.cost}g</i></div><div class="slot ${G.me.gcd > 0 ? 'poor' : ''}"><b>G</b>Grenade<i>${G.me.gcd > 0 ? Math.ceil(G.me.gcd) + 's' : 'ready'}</i></div><div class="slot"><b>B</b>Armory<i>${mt}/${MAX_TURRETS} built</i></div>`);
  // a boss bar while a big one is alive
  const boss = S.A.find(a => ALIENS[a.type].boss) || (S.ph === 'assault' ? (S.A.find(a => a.type === 'guardian') || S.A.find(a => a.type === 'hivecore')) : null); $('boss').hidden = !boss; if (boss) { setT('bossName', ALIENS[boss.type].name); $('bossBar').style.width = (boss.hp / boss.mhp * 100) + '%'; }
  const hunters = [...view.aliens.values()].filter(v => v.hunt === G.myId); $('hunt').hidden = !hunters.length || my.dead; if (hunters.length) setT('huntT', `⚠ ${hunters.length} ALIEN${hunters.length > 1 ? 'S' : ''} HUNTING YOU`);
  setH('arrows', hunters.slice(0, 8).map(v => { const a = Math.atan2(v.x - G.me.x, v.z - G.me.z) - Math.atan2(-Math.sin(G.me.yaw), -Math.cos(G.me.yaw)); return `<i style="transform:translate(-50%,-50%) rotate(${(-a).toFixed(2)}rad) translateY(-90px)"></i>`; }).join(''));
  $('regen').hidden = !(my.regen || (G.sim ? false : (Math.hypot(G.me.x - G.W.hubP.x, G.me.z - G.W.hubP.z) < 15 && my.hp < my.mhp)));
  $('hit').style.borderColor = G.hitWeak ? '#888' : ''; $('hit').classList.toggle('weak', !!G.hitWeak);
  $('hit').style.opacity = G.hitT > 0 ? 1 : 0; G.hitT -= dt; G.hurtT = Math.max(0, (G.hurtT || 0) - dt); $('hurt').style.opacity = Math.min(0.8, G.hurtT * 2.5 + (my.hp / my.mhp < 0.3 ? 0.25 : 0));
  $('dead').hidden = !my.dead || S.ph === 'lose'; if (my.dead) setT('deadT', `Respawning in ${my.rt} s`);
  // the last seconds before a wave are counted out loud
  const cd = S.ph === 'build' ? Math.ceil(S.tm) : 0; if (cd !== G.lastCd) { G.lastCd = cd; if (cd >= 1 && cd <= 5) { banner(String(cd), cd === 1 ? 'GET READY' : `Wave ${S.w + 1} incoming`); bannerT = 0.9; audio.sfx('tick'); } }
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').hidden = true; }
  if (!promptSet) $('prompt').hidden = true; promptSet = false;
  // end screens
  const end = S.ph === 'lose' || S.ph === 'win'; $('end').hidden = !end;
  if (end) { setT('endTitle', S.ph === 'win' ? 'VICTORY' : 'THE HUB HAS FALLEN'); setT('endText', S.ph === 'win' ? 'The hive is destroyed and the colony is safe. Every wave held.' : `Your squad held out until wave ${S.w}.`); setT('endKey', G.mode === 'client' ? 'Waiting for the host…' : S.ph === 'win' ? 'ENTER: keep fighting in endless mode' : 'ENTER: try again'); if (document.pointerLockElement) document.exitPointerLock(); }
  $('pause').hidden = locked() || G.shop || end;
  $('board').hidden = !keys.Tab; if (keys.Tab) setH('boardT', '<tr><th>Marine</th><th>Class</th><th>Kills</th><th>Gold</th></tr>' + S.P.map(p => `<tr><td>${esc(p.name)}${p.dead ? ' ✝' : ''}</td><td>${CLASSES[p.cls].name}</td><td>${p.kills}</td><td>${Math.floor(p.gold)}</td></tr>`).join(''));
  if (G.shop) shopDraw(my);
  mapT -= dt; if (mapT <= 0) { mapT = 0.1; minimap(S); }
}
function minimap(S) {
  const cv = $('mini'), g = cv.getContext('2d'), W = cv.width, k = W / (BOUNDS * 2), X = x => (x + BOUNDS) * k, Z = z => (z + BOUNDS) * k;
  g.clearRect(0, 0, W, W); g.drawImage(G.W.miniBg, 0, 0, W, W);
  g.strokeStyle = 'rgba(255,140,60,.6)'; g.lineWidth = 6 * k * 0.9; g.lineJoin = 'round'; g.beginPath(); G.W.path.pts.forEach((p, i) => i ? g.lineTo(X(p.x), Z(p.z)) : g.moveTo(X(p.x), Z(p.z))); g.stroke();
  const span = (a, b, c) => { g.strokeStyle = c; g.beginPath(); for (let s = a; s <= b; s += 1) { const p = G.W.path.at(s); s === a ? g.moveTo(X(p.x), Z(p.z)) : g.lineTo(X(p.x), Z(p.z)); } g.stroke(); };
  for (const t of G.W.T.tunnels) span(t.s0, t.s1, 'rgba(40,30,30,.95)'); for (const b of G.W.T.bridges) span(b.s0, b.s1, 'rgba(200,210,220,.95)');
  g.fillStyle = '#a040ff'; g.beginPath(); g.arc(X(G.W.hiveP.x), Z(G.W.hiveP.z), 6, 0, 7); g.fill(); g.fillStyle = '#60c0ff'; g.beginPath(); g.arc(X(G.W.hubP.x), Z(G.W.hubP.z), 6, 0, 7); g.fill();
  for (const t of S.T) { g.fillStyle = t.owner === G.myId ? '#80ff90' : '#d0e0a0'; g.fillRect(X(t.x) - 2.5, Z(t.z) - 2.5, 5, 5); }
  G.pings = G.pings.filter(p => (p.t -= 0.1) > 0); for (const p of G.pings) { g.strokeStyle = `rgba(255,60,40,${Math.min(1, p.t)})`; g.lineWidth = 2; g.beginPath(); g.arc(X(p.x), Z(p.z), 4 + (3 - p.t) * 5 % 10, 0, 7); g.stroke(); }
  g.strokeStyle = 'rgba(80,255,130,.5)'; g.lineWidth = 1; g.beginPath(); g.arc(X(G.W.hubP.x), Z(G.W.hubP.z), 15 * k, 0, 7); g.stroke();
  for (const o of S.O) { g.fillStyle = '#ffd040'; g.fillRect(X(o.x) - 3, Z(o.z) - 3, 6, 6); }
  for (const m of S.L || []) { g.fillStyle = '#9fe870'; g.fillRect(X(m.x) - 2, Z(m.z) - 2, 4, 4); }
  for (const a of S.A) { const b = ALIENS[a.type].boss || a.type === 'guardian'; g.fillStyle = b ? '#ff40ff' : '#ff4040'; g.beginPath(); g.arc(X(a.x), Z(a.z), b ? 4 : 2, 0, 7); g.fill(); }
  for (const p of S.P) if (p.id !== G.myId && !p.dead) { g.fillStyle = '#' + CLASSES[p.cls].color.toString(16).padStart(6, '0'); g.beginPath(); g.arc(X(p.x), Z(p.z), 3.5, 0, 7); g.fill(); }
  const me = G.me; g.save(); g.translate(X(me.x), Z(me.z)); g.rotate(-me.yaw); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 5); g.lineTo(-5, 5); g.closePath(); g.fill(); g.restore();
}
function shopDraw(my) {
  let h = `<p>Gold: <b>${Math.floor(my.gold)}</b></p>` + UPGRADES.map((u, i) => { const lv = my.ups[u.id] || 0, c = UPG_PRICES[lv]; return `<button class="up ${lv >= 5 ? 'max' : my.gold < c ? 'poor' : ''}" data-up="${u.id}"><b>${i + 1}</b><span>${u.name}<small>${u.text}</small></span><em>${'■'.repeat(lv)}${'□'.repeat(5 - lv)}</em><i>${lv >= 5 ? 'MAX' : c + 'g'}</i></button>`; }).join('');
  const C = (state() || {}).C; if (C) {
    const row = (key, w, name, text, lv, max, cost, done) => `<button class="up ${done ? 'max' : my.gold < cost ? 'poor' : ''}" data-cmd="${w}"><b>${key}</b><span>${name}<small>${text}</small></span><em>${max ? '■'.repeat(lv) + '□'.repeat(max - lv) : done ? 'READY' : ''}</em><i>${done ? (max ? 'MAX' : 'OWNED') : cost + 'g'}</i></button>`;
    let c = `<h2>Hub reinforcements</h2><p class="small">Shared by the squad. Marines leave the hub during waves and march toward the hive, fighting everything they meet.</p>`;
    c += row('7', 'rate', 'Faster drops', `Now every ${DROP_EVERY[C.lv]} s` + (C.lv < DROP_EVERY.length - 1 ? ` → ${DROP_EVERY[C.lv + 1]} s` : ''), C.lv, DROP_EVERY.length - 1, DROP_COST[C.lv + 1] || 0, C.lv >= DROP_EVERY.length - 1);
    c += row('8', 'size', 'Bigger squads', `Now ${SQUAD[C.sz]} per drop` + (C.sz < SQUAD.length - 1 ? ` → ${SQUAD[C.sz + 1]}` : ''), C.sz, SQUAD.length - 1, SQUAD_COST[C.sz + 1] || 0, C.sz >= SQUAD.length - 1);
    ['gunner', 'rocketeer', 'medic'].forEach((k, i) => { c += row(['9', '0', '-'][i], k, ALLIES[k].name, ALLIES[k].text, 0, 0, ALLIES[k].unlock, C.un.includes(k)); });
    h += c;
  }
  setH('shopList', h);
}
$('shopList').addEventListener('click', e => { const b = e.target.closest('[data-up]'); if (b) req({ a: 'buy', up: b.dataset.up }); const c = e.target.closest('[data-cmd]'); if (c) req({ a: 'cmd', w: c.dataset.cmd }); });
function openShop(on) { G.shop = on; $('shop').hidden = !on; if (on) { G.me.place = null; if (document.pointerLockElement) document.exitPointerLock(); } else canvas.requestPointerLock(); }

// ---------------------------------------------------------------- the main loop
let last = performance.now(), netT = 0, poseT = 0;
function frame(now) {
  requestAnimationFrame(frame); const dt = Math.min(0.05, (now - last) / 1000); last = now; G.time += dt;
  if (hits.KeyM) toast(music.toggle() ? 'Music on (M)' : 'Music off (M)', 2);
  if (!G.on) { music.set('calm'); if (G.W) renderer.render(scene, camera); clearHits(); return; }
  const S = state(); if (!S) { clearHits(); return; }
  // keys that work any time
  if (hits.Enter && G.mode !== 'client') req({ a: 'start' }); else if (hits.Enter && S.ph === 'build') toast('The host starts the waves.', 2);
  if (hits.KeyB) openShop(!G.shop); if (G.shop) { if (hits.Escape) openShop(false); for (let i = 0; i < 6; i++) if (hits['Digit' + (i + 1)]) req({ a: 'buy', up: UPGRADES[i].id }); for (const [k, w] of [['Digit7', 'rate'], ['Digit8', 'size'], ['Digit9', 'gunner'], ['Digit0', 'rocketeer'], ['Minus', 'medic']]) if (hits[k]) req({ a: 'cmd', w }); }
  music.set(S.ph === 'assault' ? 'boss' : S.ph === 'wave' ? (S.A.some(a => ALIENS[a.type].boss) ? 'boss' : 'battle') : S.ph === 'lose' ? 'off' : 'calm');
  const paused = G.mode === 'solo' && !locked() && S.ph !== 'lose' && S.ph !== 'win';
  updateMe(paused ? 0 : dt, S);
  if (G.sim) {
    const p = G.sim.players.get(G.myId); if (p) G.sim.pose(G.myId, G.me.x, G.me.y, G.me.z, G.me.yaw, G.me.kneel);
    if (!paused) G.sim.update(dt);
    if (G.mode === 'host') { netT += dt; if (netT > 0.1) { netT = 0; G.net.send({ t: 'st', v: VER, map: G.map, ...G.sim.pack(), fx: G.out }); G.out = []; for (const q of [...G.sim.players.values()]) if (q.id !== G.myId && G.time - (q.seen || 0) > 10) G.sim.removePlayer(q.id); } }
  } else { poseT += dt; if (poseT > 0.066) { poseT = 0; G.net.send({ t: 'pose', p: [+G.me.x.toFixed(2), +G.me.y.toFixed(2), +G.me.z.toFixed(2), +G.me.yaw.toFixed(2), G.me.kneel ? 1 : 0] }); } }
  updateFlashes(dt); updateCorpses(dt);
  if (S.ph === 'wave' || S.ph === 'assault') { G.artT = (G.artT ?? 8) - dt; if (G.artT <= 0) { G.artT = 5 + Math.random() * 9; audio.gun('artillery', 0.35 + Math.random() * 0.3, 1, 1); } }
  if (!paused) { updateGrenades(dt); updateMeteors(dt); updateFx(dt); updateWeather(dt, S); }
  syncView(state(), paused ? 0 : dt);
  hud(dt, state());
  renderer.render(scene, camera); clearHits();
}
function clearHits() { for (const k in hits) delete hits[k]; clickL = clickR = false; }
requestAnimationFrame(frame);

// ---------------------------------------------------------------- starting a game
function clearWorld() { for (const m of [view.aliens, view.turrets, view.players, view.pods, view.allies]) { for (const v of m.values()) { scene.remove(v.mesh || v); if (v.bar) scene.remove(v.bar); } m.clear(); } if (G.W) scene.remove(G.W.group); }
function begin(mapId) {
  clearWorld(); G.map = mapId; G.W = buildWorld(scene, mapId); newMe(); makeWeather(); G.on = true;
  $('title').hidden = true; $('hud').hidden = false; canvas.requestPointerLock();
  setT('mapName', MAPS[mapId].name);
  toast(`${MAPS[mapId].name}: hold the hub. Aliens follow the glowing track from the hive.`, 6);
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
$('mvol').value = music.vol; $('mvol').oninput = e => music.setVol(+e.target.value);
$('sens').value = sens; $('sens').oninput = e => { sens = +e.target.value; localStorage.setItem('hb-sens', sens); };
$('btnQuit').onclick = () => location.reload();

// title screen pickers
G.name = store.get('hb-name', ''); $('name').value = G.name; G.cls = store.get('hb-cls', 'assault'); G.map = store.get('hb-map', 'mars'); if (!CLASSES[G.cls]) G.cls = 'assault'; if (!MAPS[G.map]) G.map = 'mars';
function drawPickers() {
  const best = store.get('hb-best', {});
  $('classes').innerHTML = Object.entries(CLASSES).map(([k, c]) => `<button class="pick ${k === G.cls ? 'on' : ''}" data-cls="${k}" style="--c:#${c.color.toString(16).padStart(6, '0')}"><h3>${c.name}</h3><p class="gun">${c.gun.name}</p><p>${c.blurb}</p><p class="kit"><b>Q</b> ${TURRETS[c.sentry].name} · <b>E</b> ${TURRETS[c.defense].name}</p><p class="kit">${c.hp} health</p></button>`).join('');
  $('maps').innerHTML = Object.entries(MAPS).map(([k, m]) => `<button class="pick map ${k === G.map ? 'on' : ''}" data-map="${k}" style="--c:#${m.ground.toString(16).padStart(6, '0')}"><h3>${m.name}</h3><p>${m.sub}</p><p class="kit">${best[k] ? 'Best: wave ' + best[k] : 'Not yet played'}</p></button>`).join('');
}
$('classes').onclick = e => { const b = e.target.closest('[data-cls]'); if (b) { G.cls = b.dataset.cls; drawPickers(); } };
$('maps').onclick = e => { const b = e.target.closest('[data-map]'); if (b) { G.map = b.dataset.map; drawPickers(); } };
drawPickers();
// show a map behind the title screen
G.W = buildWorld(scene, G.map); camera.position.set(0, 40, 70); camera.lookAt(0, 0, 0);
(function spin() { if (G.on) return; const t = performance.now() / 9000; camera.position.set(Math.sin(t) * 80, 45, Math.cos(t) * 80); camera.lookAt(0, 0, 0); requestAnimationFrame(spin); })();
$('pause').addEventListener('mousedown', e => { if (e.target.closest('button,input')) return; audio.unlock(); canvas.requestPointerLock(); });
