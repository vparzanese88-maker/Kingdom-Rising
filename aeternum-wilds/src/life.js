// Ambient life: birds, butterflies, fireflies, wildlife, villagers, chimney smoke, embers and dust.
import * as THREE from 'three';
import { G } from './state.js';
import { heightAt, zoneAt, walkable, collide } from './world.js';
import { makeHumanoid, makeBeast, box, mat } from './models.js';
import { animHumanoid, animBeast } from './anim.js';
import { angDiff } from './util.js';

let birds = [], critters = [], villagers = [], motes = null, smokeSrc = [], smoke = [];
const R = Math.random;

// ---------- floating particles around the player (fireflies, butterflies, embers, spores, dust) ----------
const MOTE_N = 260;
function makeMotes() {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(MOTE_N * 3), col = new Float32Array(MOTE_N * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  // soft round sprite
  const cv = document.createElement('canvas'); cv.width = cv.height = 32;
  const c = cv.getContext('2d'); const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 32, 32);
  const m = new THREE.PointsMaterial({ size: 0.35, map: new THREE.CanvasTexture(cv), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  motes = new THREE.Points(geo, m);
  motes.frustumCulled = false;
  motes.userData.p = Array.from({ length: MOTE_N }, () => ({ x: 0, y: -100, z: 0, ph: R() * 6.28, sp: 0.5 + R(), kind: 0 }));
  G.scene.add(motes);
}
function updateMotes(dt, t) {
  const P = G.player, night = G.night || 0;
  const zn = zoneAt(P.pos.x, P.pos.z);
  const pos = motes.geometry.attributes.position.array, col = motes.geometry.attributes.color.array;
  for (let i = 0; i < MOTE_N; i++) {
    const m = motes.userData.p[i];
    const dx = m.x - P.pos.x, dz = m.z - P.pos.z;
    if (dx * dx + dz * dz > 34 * 34 || m.y < -50) {
      // respawn around the player with a kind that suits the place and time
      const a = R() * 6.28, r = 4 + R() * 28;
      m.x = P.pos.x + Math.cos(a) * r; m.z = P.pos.z + Math.sin(a) * r;
      const h = heightAt(m.x, m.z);
      m.base = h; m.y = h + 0.4 + R() * 2.5;
      m.kind = zn === 'ruins' ? 2 : zn === 'mire' ? 3 : night > 0.5 ? 1 : (zn === 'meadow' || zn === 'town') && R() < 0.35 ? 4 : 0;
      if (h < 0) m.y = -100;
    }
    m.ph += dt * m.sp;
    let r = 1, g = 1, b = 1, s = 1;
    if (m.kind === 1) { // fireflies
      m.x += Math.sin(m.ph * 1.3) * dt * 0.6; m.z += Math.cos(m.ph) * dt * 0.6; m.y = m.base + 0.6 + Math.sin(m.ph * 0.7) * 0.6;
      const on = Math.max(0, Math.sin(m.ph * 2.5 + i)); r = 0.9 * on; g = 1 * on; b = 0.3 * on;
    } else if (m.kind === 2) { // embers rising from the ash
      m.y += dt * (0.6 + m.sp * 0.5); m.x += Math.sin(m.ph) * dt * 0.3;
      if (m.y > m.base + 6) m.y = -100;
      r = 1; g = 0.45; b = 0.1;
    } else if (m.kind === 3) { // swamp spores
      m.x += Math.sin(m.ph * 0.4) * dt * 0.2; m.y = m.base + 0.5 + Math.sin(m.ph * 0.3) * 0.8;
      r = 0.6; g = 0.9; b = 0.4;
    } else if (m.kind === 4) { // butterflies: bright and fluttery
      m.x += Math.sin(m.ph * 0.9) * dt * 1.2; m.z += Math.cos(m.ph * 0.6) * dt * 1.2; m.y = m.base + 0.6 + Math.abs(Math.sin(m.ph * 6)) * 0.3;
      const k = i % 3; r = k === 0 ? 1 : k === 1 ? 0.6 : 1; g = k === 0 ? 0.85 : k === 1 ? 0.7 : 0.5; b = k === 0 ? 0.2 : k === 1 ? 1 : 0.9;
      r *= 0.6; g *= 0.6; b *= 0.6;
    } else { // dust drifting in the sunlight
      m.x += dt * 0.3; m.y += Math.sin(m.ph) * dt * 0.1;
      const k = 0.18 * (1 - night); r = k; g = k * 0.95; b = k * 0.8;
    }
    pos[i * 3] = m.x; pos[i * 3 + 1] = m.y; pos[i * 3 + 2] = m.z;
    col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = b;
  }
  motes.geometry.attributes.position.needsUpdate = true;
  motes.geometry.attributes.color.needsUpdate = true;
}

// ---------- birds: little flocks circling over the island by day ----------
function makeBird() {
  const g = new THREE.Group();
  const m = mat(0x2a2a30);
  g.add(box(0.12, 0.1, 0.4, m, 0, 0, 0));
  const wl = new THREE.Group(), wr = new THREE.Group();
  wl.add(box(0.5, 0.03, 0.2, m, 0.25, 0, 0)); wr.add(box(0.5, 0.03, 0.2, m, -0.25, 0, 0));
  g.add(wl); g.add(wr);
  g.userData.w = [wl, wr];
  return g;
}
function makeFlocks() {
  for (let f = 0; f < 6; f++) {
    const cx = (R() - 0.5) * 400, cz = (R() - 0.5) * 400, h = 30 + R() * 25, r = 30 + R() * 50, sp = (0.1 + R() * 0.15) * (R() < 0.5 ? 1 : -1);
    for (let i = 0; i < 5 + Math.floor(R() * 5); i++) {
      const b = makeBird(); G.scene.add(b);
      birds.push({ b, cx, cz, h: h + R() * 4, r: r + R() * 6, sp, a: R() * 0.6 + f, ph: R() * 6 });
    }
  }
}
function updateBirds(dt, t) {
  const show = (G.night || 0) < 0.6;
  for (const o of birds) {
    o.b.visible = show;
    if (!show) continue;
    o.a += o.sp * dt;
    const x = o.cx + Math.cos(o.a) * o.r, z = o.cz + Math.sin(o.a) * o.r;
    o.b.position.set(x, o.h + Math.sin(t + o.ph) * 1.5, z);
    o.b.rotation.y = Math.atan2(-Math.sin(o.a) * o.sp, Math.cos(o.a) * o.sp);
    const fl = Math.sin(t * 9 + o.ph) * 0.7;
    o.b.userData.w[0].rotation.z = fl; o.b.userData.w[1].rotation.z = -fl;
  }
}

// ---------- wildlife: deer and rabbits that graze and bolt from the player ----------
function makeRabbit() {
  const g = new THREE.Group();
  const m = mat(0xb8a890), w = mat(0xf0ece0);
  g.add(box(0.25, 0.22, 0.38, m, 0, 0.16, 0));
  g.add(box(0.18, 0.18, 0.18, m, 0, 0.3, 0.2));
  g.add(box(0.05, 0.2, 0.04, m, 0.05, 0.48, 0.18)); g.add(box(0.05, 0.2, 0.04, m, -0.05, 0.48, 0.18));
  g.add(box(0.1, 0.1, 0.1, w, 0, 0.2, -0.22));
  return { root: g, body: g, rabbit: true };
}
function makeCritters() {
  let n = 0, tries = 0;
  while (n < 40 && tries < 2000) {
    tries++;
    const a = R() * 6.28, r = 50 + R() * 220;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const zn = zoneAt(x, z);
    if (zn === 'ruins' || zn === 'mire' || heightAt(x, z) < 0.8) continue;
    const deer = R() < 0.45;
    const m = deer ? makeBeast('wolf', { color: 0x9a6a3a, size: 1.25, eyes: 0x1a1a1a }) : makeRabbit();
    if (deer) { const ant = mat(0x6a5038); for (const s of [1, -1]) { const p = box(0.05, 0.45, 0.05, ant, s * 0.12, 0.45, 0); p.rotation.z = -s * 0.4; m.parts.head.add(p); const q = box(0.04, 0.2, 0.04, ant, s * 0.2, 0.55, 0.05); q.rotation.z = -s * 1.1; m.parts.head.add(q); } m.parts.tail.scale.set(1, 1, 0.3); }
    G.scene.add(m.root);
    critters.push({ m, x, z, hx: x, hz: z, f: R() * 6.28, ph: 0, sp: 0, flee: 0, deer, wait: R() * 4, tx: x, tz: z });
    n++;
  }
}
function updateCritters(dt) {
  const P = G.player;
  for (const c of critters) {
    const pd = Math.hypot(c.x - P.pos.x, c.z - P.pos.z);
    c.m.root.visible = pd < 120;
    if (pd > 120) continue;
    let target = null, speed = 0;
    if (pd < (c.deer ? 14 : 8)) { c.flee = 3; }
    if (c.flee > 0) {
      c.flee -= dt;
      const ax = c.x - P.pos.x, az = c.z - P.pos.z, al = Math.hypot(ax, az) || 1;
      target = [c.x + ax / al * 5, c.z + az / al * 5]; speed = c.deer ? 9 : 7;
    } else {
      c.wait -= dt;
      if (c.wait <= 0) { c.wait = 3 + R() * 6; const a = R() * 6.28, r = R() * 12; c.tx = c.hx + Math.cos(a) * r; c.tz = c.hz + Math.sin(a) * r; }
      if (Math.hypot(c.tx - c.x, c.tz - c.z) > 0.5) { target = [c.tx, c.tz]; speed = c.deer ? 1.4 : 1.8; }
    }
    if (target) {
      const dx = target[0] - c.x, dz = target[1] - c.z, l = Math.hypot(dx, dz) || 1;
      const nx = c.x + dx / l * speed * dt, nz = c.z + dz / l * speed * dt;
      if (walkable(nx, nz) && heightAt(nx, nz) > 0.5) { [c.x, c.z] = collide(nx, nz, 0.4); } else c.wait = 0;
      c.f += angDiff(c.f, Math.atan2(dx, dz)) * Math.min(1, dt * 8);
      c.ph += dt * speed * 2;
    }
    const hop = c.m.rabbit && speed > 0 ? Math.abs(Math.sin(c.ph * 1.5)) * 0.25 : 0;
    c.m.root.position.set(c.x, heightAt(c.x, c.z) + hop, c.z);
    c.m.root.rotation.y = c.f;
    if (!c.m.rabbit) animBeast(c.m, { move: speed ? Math.min(1, speed / 3) : 0, phase: c.ph, pose: speed === 0 && Math.sin(c.wait * 2) > 0.6 ? 'windup' : null, t: 0.4 });
  }
}

// ---------- villagers walking between spots in Windsward ----------
const SPOTS = [[0, 12], [10, 4], [-8, 6], [12, -10], [-12, -10], [-12, 12], [14, 16], [0, -18], [20, 0], [-20, -2], [6, 26], [-6, -28], [0, 30]];
function makeVillagers() {
  const shirts = [0x6a3a2a, 0x2a4a6a, 0x5a6a3a, 0x7a6a4a, 0x8a2a3a, 0x4a3a5a];
  for (let i = 0; i < 9; i++) {
    const fem = i % 2 === 1;
    const h = makeHumanoid({ sex: fem ? 'f' : 'm', skin: [0xf1c9a5, 0xe0ac84, 0xc68b5e, 0x8d5a3b][i % 4], shirt: shirts[i % shirts.length], pants: 0x3a3022, hair: [0x2a1a10, 0x5a3a1e, 0xa8743a, 0x9a9a9a][i % 4], hairStyle: fem ? 5 + (i % 2) : i % 3, facialHair: fem ? 0 : i % 5 });
    const [x, z] = SPOTS[i];
    G.scene.add(h.root);
    villagers.push({ h, x, z, f: 0, ph: 0, wait: R() * 5, tgt: SPOTS[(i + 3) % SPOTS.length] });
  }
}
function updateVillagers(dt) {
  const P = G.player;
  for (const v of villagers) {
    let moving = false;
    const pd = Math.hypot(v.x - P.pos.x, v.z - P.pos.z);
    v.h.root.visible = pd < 90;
    if (v.wait > 0) v.wait -= dt;
    else {
      const dx = v.tgt[0] - v.x, dz = v.tgt[1] - v.z, d = Math.hypot(dx, dz);
      if (d < 0.6) { v.wait = 3 + R() * 8; v.tgt = SPOTS[Math.floor(R() * SPOTS.length)]; }
      else {
        const nx = v.x + dx / d * 1.7 * dt, nz = v.z + dz / d * 1.7 * dt;
        [v.x, v.z] = collide(nx, nz, 0.4);
        if (Math.hypot(v.x - nx, v.z - nz) > 0.05) v.tgt = SPOTS[Math.floor(R() * SPOTS.length)];
        v.f += angDiff(v.f, Math.atan2(dx, dz)) * Math.min(1, dt * 6);
        v.ph += dt * 1.7 * 1.6; moving = true;
      }
    }
    // turn to look at the player when standing close by
    if (!moving && pd < 5) v.f += angDiff(v.f, Math.atan2(P.pos.x - v.x, P.pos.z - v.z)) * Math.min(1, dt * 3);
    v.h.root.position.set(v.x, heightAt(v.x, v.z), v.z);
    v.h.root.rotation.y = v.f;
    animHumanoid(v.h, { move: moving ? 0.6 : 0, phase: v.ph, pose: null });
  }
}

// ---------- chimney smoke ----------
const smokeGeo = new THREE.IcosahedronGeometry(0.5, 0);
function addSmokeSources() {
  for (const [x, z, h] of [[-24 + 2.6, -20 - 0.6, 7.5], [24 + 2.1, -22 - 0.6, 7.5], [-26 + 2.1, 4 - 0.6, 7.5], [26 + 2.6, 20 - 0.6, 7.5], [-20 + 2.1, 26 - 0.6, 7.5], [-14, -12, 6], [14, -12, 6.5]]) smokeSrc.push({ x, z, y: 2.4 + h, t: R() });
}
function updateSmoke(dt) {
  const P = G.player || { pos: G.camera.position };
  for (const s of smokeSrc) {
    s.t -= dt;
    if (s.t <= 0 && Math.hypot(s.x - P.pos.x, s.z - P.pos.z) < 120 && smoke.length < 80) {
      s.t = 0.35 + R() * 0.3;
      const m = new THREE.Mesh(smokeGeo, new THREE.MeshLambertMaterial({ color: 0x8a8a88, transparent: true, opacity: 0.45, depthWrite: false }));
      m.position.set(s.x, s.y, s.z); G.scene.add(m);
      smoke.push({ m, life: 0, max: 4 + R() * 2, vx: 0.4 + R() * 0.3, vz: 0.15 });
    }
  }
  for (let i = smoke.length - 1; i >= 0; i--) {
    const p = smoke[i];
    p.life += dt;
    const k = p.life / p.max;
    p.m.position.x += p.vx * dt; p.m.position.y += dt * 1.1; p.m.position.z += p.vz * dt;
    p.m.scale.setScalar(0.6 + k * 2.4);
    p.m.material.opacity = 0.45 * (1 - k);
    if (k >= 1) { G.scene.remove(p.m); p.m.material.dispose(); smoke.splice(i, 1); }
  }
}

export function buildLife() {
  makeMotes();
  makeFlocks();
  makeCritters();
  makeVillagers();
  addSmokeSources();
}
export function updateLife(dt, t, playing) {
  if (!motes) return;
  updateBirds(dt, t);
  updateSmoke(dt);
  if (!playing) return;
  updateMotes(dt, t);
  updateCritters(dt);
  updateVillagers(dt);
}
