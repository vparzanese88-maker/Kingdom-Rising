// Ambient life: birds and gulls, butterflies, pollen, fireflies, embers and spores, wildlife, villagers,
// chimney and campfire smoke. The particles, birds and smoke are each one instanced draw call.
import * as THREE from 'three';
import { G } from './state.js';
import { heightAt, zoneAt, walkable, collide } from './world.js';
import { makeHumanoid, makeBeast, box, mat } from './models.js';
import { animHumanoid, animBeast } from './anim.js';
import { angDiff } from './util.js';
import { U } from './gfx/env/shared.js';
import { cardTex } from './gfx/env/tex.js';
import { SMOKE_SOURCES } from './gfx/env/town.js';
import { SMOKE_EXTRA } from './gfx/env/pois.js';

let birds = null, critters = [], villagers = [], motes = null, smoke = null, flutter = null;
const R = Math.random;

// ---------- floating particles around the player (fireflies, pollen, embers, spores, dust motes) ----------
const MOTE_N = 320;
function makeMotes() {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(MOTE_N * 3), col = new Float32Array(MOTE_N * 3), siz = new Float32Array(MOTE_N);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(siz, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    uniforms: { tMap: { value: cardTex('spark') }, uScale: { value: 300 } },
    vertexShader: 'attribute float size; varying vec3 vC; uniform float uScale; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(size * uScale / -mv.z, 1., 40.); }',
    fragmentShader: 'uniform sampler2D tMap; varying vec3 vC; void main(){ float a = texture2D(tMap, gl_PointCoord).a; gl_FragColor = vec4(vC * a, a); }',
  });
  motes = new THREE.Points(geo, m);
  motes.frustumCulled = false; motes.renderOrder = 5;
  motes.userData.p = Array.from({ length: MOTE_N }, () => ({ x: 0, y: -100, z: 0, ph: R() * 6.28, sp: 0.5 + R(), kind: 0, base: 0 }));
  G.scene.add(motes);
}
function updateMotes(dt, t) {
  const P = G.player, night = G.night || 0;
  const zn = zoneAt(P.pos.x, P.pos.z);
  const pos = motes.geometry.attributes.position.array, col = motes.geometry.attributes.color.array, siz = motes.geometry.attributes.size.array;
  motes.material.uniforms.uScale.value = G.renderer.domElement.height * 0.5;
  for (let i = 0; i < MOTE_N; i++) {
    const m = motes.userData.p[i];
    const dx = m.x - P.pos.x, dz = m.z - P.pos.z;
    if (dx * dx + dz * dz > 34 * 34 || m.y < -50) {
      const a = R() * 6.28, r = 3 + R() * 30;
      m.x = P.pos.x + Math.cos(a) * r; m.z = P.pos.z + Math.sin(a) * r;
      const h = heightAt(m.x, m.z);
      m.base = h; m.y = h + 0.3 + R() * 3;
      m.kind = zn === 'ruins' ? 2 : zn === 'mire' ? (night > 0.5 && R() < 0.5 ? 1 : 3) : night > 0.5 ? 1 : (zn === 'meadow' || zn === 'town' || zn === 'coast') && R() < 0.5 ? 4 : 0;
      if (h < 0 && m.kind !== 2) m.y = -100;
    }
    m.ph += dt * m.sp;
    let r = 1, g = 1, b = 1, s = 0.05;
    if (m.kind === 1) { // fireflies blinking in the dark
      m.x += Math.sin(m.ph * 1.3) * dt * 0.6; m.z += Math.cos(m.ph) * dt * 0.6; m.y = m.base + 0.5 + Math.sin(m.ph * 0.7) * 0.7;
      const on = Math.pow(Math.max(0, Math.sin(m.ph * 2.2 + i)), 3); r = 1.6 * on; g = 2.0 * on; b = 0.4 * on; s = 0.12;
    } else if (m.kind === 2) { // embers rising from the ash
      m.y += dt * (0.7 + m.sp * 0.6); m.x += Math.sin(m.ph * 1.7) * dt * 0.4; m.z += Math.cos(m.ph) * dt * 0.3;
      if (m.y > m.base + 7) m.y = -100;
      const k = Math.max(0, 1 - (m.y - m.base) / 7); r = 3.0 * k; g = 0.9 * k; b = 0.15 * k; s = 0.07;
    } else if (m.kind === 3) { // spores drifting over the bog
      m.x += Math.sin(m.ph * 0.4) * dt * 0.25; m.y = m.base + 0.6 + Math.sin(m.ph * 0.3) * 1.0;
      r = 0.45; g = 0.75; b = 0.35; s = 0.09;
    } else if (m.kind === 4) { // pollen and seed fluff floating on the breeze
      m.x += (0.5 + Math.sin(m.ph * 0.9) * 0.3) * dt; m.z += Math.cos(m.ph * 0.6) * dt * 0.4; m.y = m.base + 0.8 + Math.sin(m.ph * 0.5) * 0.9 + (i % 5) * 0.3;
      const k = 0.55 * (1 - night); r = k; g = k * 0.95; b = k * 0.7; s = 0.05;
    } else { // dust drifting in the sunlight
      m.x += dt * 0.3; m.y += Math.sin(m.ph) * dt * 0.1;
      const k = 0.3 * (1 - night); r = k; g = k * 0.95; b = k * 0.8; s = 0.035;
    }
    pos[i * 3] = m.x; pos[i * 3 + 1] = m.y; pos[i * 3 + 2] = m.z;
    col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = b; siz[i] = s;
  }
  motes.geometry.attributes.position.needsUpdate = true;
  motes.geometry.attributes.color.needsUpdate = true;
  motes.geometry.attributes.size.needsUpdate = true;
}

// ---------- butterflies: little flapping pairs of wings over the flowers by day ----------
const FLY_N = 18;
function makeButterflies() {
  const g = new THREE.BufferGeometry();
  const p = [], w = [];
  for (const s of [-1, 1]) { p.push(0, 0, 0.06, s * 0.14, 0, 0.1, s * 0.12, 0, -0.08, 0, 0, 0.06, s * 0.12, 0, -0.08, 0, 0, -0.06); w.push(0, s, s, 0, s, 0); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('aWing', new THREE.Float32BufferAttribute(w, 1)); g.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.7, emissive: 0x222222 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; attribute float aWing;').replace('#include <begin_vertex>', `#include <begin_vertex>
      float ph = uTime * 18. + instanceMatrix[3].x * 3.1 + instanceMatrix[3].z;
      float fl = sin(ph) * 1.1;
      transformed.y += abs(transformed.x) * sin(fl) * 1.3; transformed.x *= cos(fl);`);
  };
  flutter = new THREE.InstancedMesh(g, m, FLY_N); flutter.frustumCulled = false; flutter.castShadow = false;
  flutter.userData.p = Array.from({ length: FLY_N }, (_, i) => ({ x: 0, z: 0, y: -100, ph: R() * 6, cx: 0, cz: 0 }));
  const cols = [0xf2c23a, 0xffffff, 0x6aa8ff, 0xf07a3a, 0xd890f0];
  for (let i = 0; i < FLY_N; i++) flutter.setColorAt(i, new THREE.Color(cols[i % cols.length]));
  G.scene.add(flutter);
}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _up = new THREE.Vector3(0, 1, 0);
function updateButterflies(dt, t) {
  const P = G.player; const day = 1 - (G.night || 0);
  const zn = zoneAt(P.pos.x, P.pos.z); const ok = day > 0.5 && (zn === 'meadow' || zn === 'town' || zn === 'coast');
  flutter.visible = ok; if (!ok) return;
  flutter.userData.p.forEach((b, i) => {
    if (Math.hypot(b.cx - P.pos.x, b.cz - P.pos.z) > 30) { const a = R() * 6.28, r = 5 + R() * 20; b.cx = P.pos.x + Math.cos(a) * r; b.cz = P.pos.z + Math.sin(a) * r; }
    b.ph += dt;
    const x = b.cx + Math.sin(b.ph * 0.7 + i) * 2.2 + Math.sin(b.ph * 1.9) * 0.4, z = b.cz + Math.cos(b.ph * 0.53 + i * 2) * 2.2;
    const y = heightAt(x, z) + 0.6 + Math.abs(Math.sin(b.ph * 1.3)) * 0.8;
    const dx = Math.cos(b.ph * 0.7 + i) * 1.54, dz = -Math.sin(b.ph * 0.53 + i * 2) * 1.17;
    _q.setFromAxisAngle(_up, Math.atan2(dx, dz)); _v.set(x, y, z); flutter.setMatrixAt(i, _m4.compose(_v, _q, _s));
  });
  flutter.instanceMatrix.needsUpdate = true;
}

// ---------- birds: flocks circling over the island by day, gulls over the coast ----------
const BIRD_N = 46;
function makeFlocks() {
  const g = new THREE.BufferGeometry();
  // a body and two wings (aWing: 0 body, +-1 wing tips)
  const p = [0, 0, 0.32, 0.05, 0, -0.1, -0.05, 0, -0.1, 0, 0.04, 0.3, 0.04, 0, -0.32, -0.04, 0, -0.32];
  const w = [0, 0, 0, 0, 0, 0];
  for (const s of [-1, 1]) { p.push(0, 0, 0.12, s * 0.9, 0.02, -0.08, 0, 0, -0.1, s * 0.9, 0.02, -0.08, s * 0.5, 0, 0.05, 0, 0, 0.12); w.push(0, s, 0, s, s * 0.5, 0); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('aWing', new THREE.Float32BufferAttribute(w, 1)); g.computeVertexNormals();
  const m = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; attribute float aWing;').replace('#include <begin_vertex>', `#include <begin_vertex>
      float ph = uTime * 7. + instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.3;
      float glide = smoothstep(.2, .8, sin(uTime * .5 + instanceMatrix[3].x));
      float fl = sin(ph) * .75 * (1. - glide * .85);
      transformed.y += abs(aWing) * sin(fl) * abs(transformed.x) * 1.1;`);
  };
  birds = new THREE.InstancedMesh(g, m, BIRD_N); birds.frustumCulled = false;
  birds.userData.f = [];
  for (let f = 0, n = 0; n < BIRD_N; f++) {
    const gull = f < 3;
    const a0 = R() * 6.28, rr = gull ? 270 + R() * 30 : R() * 220;
    const cx = Math.cos(a0) * rr, cz = Math.sin(a0) * rr, h = gull ? 14 + R() * 10 : 30 + R() * 25, r = gull ? 18 + R() * 20 : 30 + R() * 50, sp = (0.1 + R() * 0.15) * (R() < 0.5 ? 1 : -1);
    for (let i = 0; i < 5 + Math.floor(R() * 5) && n < BIRD_N; i++, n++) {
      birds.userData.f.push({ cx, cz, h: h + R() * 4, r: r + R() * 6, sp, a: R() * 0.6 + f, ph: R() * 6, s: gull ? 1.3 : 0.9 + R() * 0.3 });
      birds.setColorAt(n, new THREE.Color(gull ? 0xf4f4f0 : 0x2a2a30));
    }
  }
  G.scene.add(birds);
}
function updateBirds(dt, t) {
  const show = (G.night || 0) < 0.6;
  birds.visible = show; if (!show) return;
  birds.userData.f.forEach((o, i) => {
    o.a += o.sp * dt;
    const x = o.cx + Math.cos(o.a) * o.r, z = o.cz + Math.sin(o.a) * o.r;
    _q.setFromAxisAngle(_up, Math.atan2(-Math.sin(o.a) * o.sp, Math.cos(o.a) * o.sp));
    _v.set(x, o.h + Math.sin(t * 0.7 + o.ph) * 1.5, z); _s.setScalar(o.s);
    birds.setMatrixAt(i, _m4.compose(_v, _q, _s));
  });
  _s.set(1, 1, 1);
  birds.instanceMatrix.needsUpdate = true;
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

// ---------- smoke from chimneys, forges and campfires: soft billboards, one draw call ----------
const SMOKE_N = 220;
function makeSmoke() {
  const base = new THREE.PlaneGeometry(1, 1);
  const g = new THREE.InstancedBufferGeometry(); g.index = base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv);
  const ip = new Float32Array(SMOKE_N * 4), ic = new Float32Array(SMOKE_N * 4);
  g.setAttribute('iPos', new THREE.InstancedBufferAttribute(ip, 4).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('iCol', new THREE.InstancedBufferAttribute(ic, 4).setUsage(THREE.DynamicDrawUsage));
  g.instanceCount = 0; g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { tMap: { value: cardTex('smoke') }, uLight: { value: new THREE.Color(1, 1, 1) } }]),
    vertexShader: `#include <common>
      #include <fog_pars_vertex>
      attribute vec4 iPos; attribute vec4 iCol; varying vec2 vUv; varying vec4 vCol;
      void main(){ vUv = uv; vCol = iCol;
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        float a = iPos.w * 7.3; vec2 q = mat2(cos(a), -sin(a), sin(a), cos(a)) * position.xy;
        vec3 wp = iPos.xyz + (right * q.x + up * q.y) * (iPos.w);
        vec4 mvPosition = viewMatrix * vec4(wp, 1.); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `#include <common>
      #include <fog_pars_fragment>
      uniform sampler2D tMap; uniform vec3 uLight; varying vec2 vUv; varying vec4 vCol;
      void main(){ vec4 t = texture2D(tMap, vUv); gl_FragColor = vec4(vCol.rgb * uLight, t.a * vCol.a);
        #include <fog_fragment>
      }`,
  });
  smoke = new THREE.Mesh(g, m); smoke.frustumCulled = false; smoke.renderOrder = 4;
  smoke.userData.src = [...SMOKE_SOURCES, ...SMOKE_EXTRA].map((s) => ({ ...s, t: R() }));
  smoke.userData.p = [];
  G.scene.add(smoke);
}
function updateSmoke(dt) {
  const cam = G.camera.position; const ud = smoke.userData; const day = 1 - (G.night || 0);
  smoke.material.uniforms.uLight.value.setRGB(0.25 + 0.75 * day, 0.27 + 0.73 * day, 0.32 + 0.68 * day);
  for (const s of ud.src) {
    s.t -= dt;
    if (s.t <= 0 && Math.hypot(s.x - cam.x, s.z - cam.z) < 160 && ud.p.length < SMOKE_N) {
      s.t = (s.forge ? 0.28 : s.fire ? 0.35 : 0.5) + R() * 0.3;
      ud.p.push({ x: s.x + (R() - 0.5) * 0.2, y: s.y, z: s.z + (R() - 0.5) * 0.2, life: 0, max: (s.forge ? 5 : 6) + R() * 3, vx: 0.35 + R() * 0.25, vz: 0.12 + (R() - 0.5) * 0.1, rot: R(), c: s.green ? [0.55, 0.8, 0.45] : s.forge ? [0.42, 0.4, 0.4] : [0.82, 0.82, 0.84] });
    }
  }
  const ip = smoke.geometry.attributes.iPos.array, ic = smoke.geometry.attributes.iCol.array;
  let n = 0;
  for (let i = ud.p.length - 1; i >= 0; i--) {
    const p = ud.p[i]; p.life += dt; const k = p.life / p.max;
    if (k >= 1) { ud.p.splice(i, 1); continue; }
    p.x += p.vx * dt * (0.4 + k); p.y += dt * (1.2 - k * 0.6); p.z += p.vz * dt;
    const size = 0.5 + k * 2.6;
    ip[n * 4] = p.x; ip[n * 4 + 1] = p.y; ip[n * 4 + 2] = p.z; ip[n * 4 + 3] = size + p.rot * 0.01;
    const a = Math.min(1, p.life * 3) * (1 - k) * 0.42;
    ic[n * 4] = p.c[0]; ic[n * 4 + 1] = p.c[1]; ic[n * 4 + 2] = p.c[2]; ic[n * 4 + 3] = a;
    n++;
  }
  smoke.geometry.instanceCount = n;
  smoke.geometry.attributes.iPos.needsUpdate = true; smoke.geometry.attributes.iCol.needsUpdate = true;
}

export function buildLife() {
  makeMotes();
  makeButterflies();
  makeFlocks();
  makeCritters();
  makeVillagers();
  makeSmoke();
}
export function updateLife(dt, t, playing) {
  if (!motes) return;
  updateBirds(dt, t);
  updateSmoke(dt);
  if (!playing) return;
  updateMotes(dt, t);
  updateButterflies(dt, t);
  updateCritters(dt);
  updateVillagers(dt);
}
