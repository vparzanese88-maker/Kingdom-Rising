// Ambient life over the Ruins of Aldermere: flocks of birds wheeling high above the walls, butterflies round the plaza,
// pollen drifting in the sun. Purely cosmetic and local to each player (nothing is sent over the network).
// Cost: one instanced mesh of birds (moved on the CPU, wings flapped in the shader) and two Points objects animated from one uniform.
import * as THREE from 'three';

const GROUND = 3;
const time = { value: 0 };
let birds = null, flocks = [], group = null;

// a small seeded random, so every player sees roughly the same sky
let seedV = 4242; const rnd = () => (seedV = (seedV * 16807) % 2147483647) / 2147483647;

// one bird: a slim body and two wing triangles; 'wf' says how far out along the wing a vertex sits (0 at the body, 1 at the tip)
function birdGeometry() {
  const P = [], W = [];
  const tri = (a, b, c, wa, wb, wc) => { P.push(...a, ...b, ...c); W.push(wa, wb, wc); };
  const half = 0.75;
  // body (a thin diamond, top and bottom), nose towards +z
  tri([0, 0.04, 0.42], [-0.07, 0, 0], [0.07, 0, 0], 0, 0, 0); tri([0, 0.04, 0.42], [0.07, 0, 0], [-0.07, 0, 0], 0, 0, 0);
  tri([-0.07, 0, 0], [0, 0.02, -0.36], [0.07, 0, 0], 0, 0, 0);
  tri([0, 0.02, -0.36], [-0.13, 0, -0.52], [0.13, 0, -0.52], 0, 0, 0); // tail fan
  for (const s of [-1, 1]) { // each wing: an inner panel and a swept tip
    tri([0, 0, 0.16], [s * half * 0.55, 0, 0.08], [0, 0, -0.16], 0, 0.55, 0);
    tri([0, 0, -0.16], [s * half * 0.55, 0, 0.08], [s * half * 0.5, 0, -0.14], 0, 0.55, 0.5);
    tri([s * half * 0.55, 0, 0.08], [s * half, 0, -0.2], [s * half * 0.5, 0, -0.14], 0.55, 1, 0.5);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('wf', new THREE.Float32BufferAttribute(W, 1));
  g.computeVertexNormals(); return g;
}

function birdMaterial() {
  const m = new THREE.MeshBasicMaterial({ color: '#241c1a', side: THREE.DoubleSide, fog: true });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.time = time;
    sh.vertexShader = 'uniform float time;\nattribute float wf;\nattribute vec3 aBird;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      { float s = sign(transformed.x); float r = abs(transformed.x);
        // aBird.x = phase, aBird.y = flap strength (0 = gliding), aBird.z = flap rate
        float beat = sin(time * aBird.z + aBird.x);
        float a = mix(0.12, beat * 0.75, aBird.y) + wf * wf * mix(0.05, beat * 0.35, aBird.y); // the tip lags and bends further
        transformed.x = s * r * cos(a); transformed.y += r * sin(a);
        transformed.y -= (1.0 - wf) * beat * 0.04 * aBird.y; }`);
  };
  return m;
}

// soft round points animated in the shader (butterflies and pollen)
function drift(n, x0, z0, R, y0, H, cols, size, flutter, alpha) {
  const pos = new Float32Array(n * 3), ph = new Float32Array(n), col = new Float32Array(n * 3), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const a = rnd() * 6.283, r = Math.sqrt(rnd()) * R; pos[i * 3] = x0 + Math.cos(a) * r; pos[i * 3 + 1] = y0 + rnd() * H; pos[i * 3 + 2] = z0 + Math.sin(a) * r;
    ph[i] = rnd() * 100; c.set(cols[i % cols.length]); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('ph', new THREE.BufferAttribute(ph, 1)); g.setAttribute('col', new THREE.BufferAttribute(col, 3));
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
    uniforms: { time, size: { value: size * 900 }, fl: { value: flutter }, al: { value: alpha } },
    vertexShader: `attribute float ph; attribute vec3 col; uniform float time, size, fl; varying vec3 vC; varying float vA;
      void main(){ vec3 p = position; float t = time * 0.3 + ph;
        p.x += sin(t * 0.9) * 2.2 + sin(t * 2.3) * 0.5; p.z += cos(t * 0.7) * 2.2 + cos(t * 1.9) * 0.5; p.y += sin(t * 1.7) * 0.5 + abs(sin(t * 7.0)) * 0.25 * fl;
        float beat = mix(1.0, 0.35 + 0.65 * abs(sin(time * 14.0 + ph * 3.0)), fl); // butterflies' wings open and shut
        vC = col; vA = 0.7 + 0.3 * sin(t * 3.1);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = size * beat / -mv.z; }`,
    fragmentShader: `uniform float al; varying vec3 vC; varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.15, length(d)); if (a < 0.01) discard; gl_FragColor = vec4(vC, a * vA * al); }` });
  const p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = 2; return p;
}

export function buildAmbientLife(scene, opts = {}) {
  if (group) { group.removeFromParent(); group.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); }
  seedV = opts.seed || 4242; flocks = []; group = new THREE.Group(); group.name = 'ambientLife'; scene.add(group);
  // ---- the flocks ----
  const sizes = opts.flocks || [10, 7, 12, 8], total = sizes.reduce((a, b) => a + b, 0);
  const geo = birdGeometry(), aBird = new THREE.InstancedBufferAttribute(new Float32Array(total * 3), 3); aBird.setUsage(THREE.DynamicDrawUsage); geo.setAttribute('aBird', aBird);
  birds = new THREE.InstancedMesh(geo, birdMaterial(), total); birds.instanceMatrix.setUsage(THREE.DynamicDrawUsage); birds.frustumCulled = false; birds.castShadow = false; birds.receiveShadow = false;
  group.add(birds);
  let idx = 0;
  sizes.forEach((n, f) => {
    const cx = (rnd() - 0.5) * 70, cz = (rnd() - 0.5) * 150, F = {
      cx, cz, ox: cx, oz: cz, // centre of the circling (it wanders slowly)
      R: 14 + rnd() * 22, ang: rnd() * 6.283, w: (0.07 + rnd() * 0.06) * (f & 1 ? -1 : 1), h: GROUND + 25 + rnd() * 18, hw: rnd() * 6.283,
      glide: 0, nextGlide: 3 + rnd() * 8, wander: rnd() * 100, scale: f === 2 ? 0.75 : 1 + rnd() * 0.25, rate: f === 2 ? 15 : 10 + rnd() * 3, birds: [] };
    for (let i = 0; i < n; i++) {
      const b = { i: idx++, slot: new THREE.Vector3((rnd() - 0.5) * 9, (rnd() - 0.5) * 3, -rnd() * 9), pos: new THREE.Vector3(), vel: new THREE.Vector3(),
        flap: 1, phase: rnd() * 6.283, roll: 0, lazy: rnd() * 0.6, size: F.scale * (0.85 + rnd() * 0.3) };
      F.birds.push(b);
    }
    flocks.push(F); placeLeader(F, 0);
    for (const b of F.birds) { b.pos.copy(F.leadPos).add(b.slot); b.vel.copy(F.leadVel); }
  });
  // ---- butterflies round the plaza and in the gardens; pollen drifting in the sunlight ----
  if (opts.butterflies !== false) {
    group.add(drift(26, 0, 0, 22, GROUND + 0.4, 1.6, ['#ffffff', '#ffe27a', '#f0a050', '#c8d8ff', '#f4b0d8'], 0.11, 1, 0.95));
    for (const s of [-1, 1]) group.add(drift(10, 46, s * 42, 12, GROUND + 0.4, 1.4, ['#ffffff', '#ffe27a', '#f4b0d8'], 0.11, 1, 0.95));
  }
  if (opts.pollen !== false) group.add(drift(140, 0, 0, 34, GROUND + 0.5, 9, ['#fff6dc', '#ffeec0'], 0.05, 0, 0.55));
  updateAmbientLife(0);
  return group;
}

const tmpV = new THREE.Vector3(), tmpS = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(0, 0, 0, 'YXZ'), tmpM = new THREE.Matrix4();

// the flock's leader flies a slowly wandering circle; the others keep loose station behind it
function placeLeader(F, t) {
  F.cx = F.ox + Math.sin(t * 0.021 + F.wander) * 22; F.cz = F.oz + Math.cos(t * 0.017 + F.wander * 1.3) * 40;
  F.cx = Math.max(-45, Math.min(45, F.cx)); F.cz = Math.max(-80, Math.min(80, F.cz));
  const R = F.R * (1 + 0.25 * Math.sin(t * 0.05 + F.wander)), y = F.h + Math.sin(t * 0.11 + F.hw) * 4;
  (F.leadPos = F.leadPos || new THREE.Vector3()).set(F.cx + Math.cos(F.ang) * R, y, F.cz + Math.sin(F.ang) * R);
  const sp = Math.abs(F.w) * R; // tangent along the circle
  (F.leadVel = F.leadVel || new THREE.Vector3()).set(-Math.sin(F.ang) * Math.sign(F.w) * sp, Math.cos(t * 0.11 + F.hw) * 0.44, Math.cos(F.ang) * Math.sign(F.w) * sp);
}

export function updateAmbientLife(dt, camPos) {
  if (!birds) return;
  dt = Math.min(dt || 0, 0.1); time.value += dt; const t = time.value, att = birds.geometry.attributes.aBird;
  for (const F of flocks) {
    F.ang += F.w * dt; placeLeader(F, t);
    // now and then the whole flock stops beating its wings and glides
    if (F.glide > 0) { F.glide -= dt; if (F.glide <= 0) F.nextGlide = 4 + rnd() * 9; } else if ((F.nextGlide -= dt) <= 0) F.glide = 2 + rnd() * 4;
    const heading = Math.atan2(F.leadVel.x, F.leadVel.z), ch = Math.cos(heading), sh = Math.sin(heading);
    for (const b of F.birds) {
      // station: the bird's slot, turned with the leader's heading, bobbing a little
      tmpV.set(b.slot.x * ch + b.slot.z * sh, b.slot.y + Math.sin(t * 0.6 + b.phase) * 0.8, -b.slot.x * sh + b.slot.z * ch).add(F.leadPos);
      tmpV.sub(b.pos); const lag = tmpV.length(); // steer towards it (springy seek), keeping clear of flock-mates
      const acc = tmpV.multiplyScalar(0.6);
      for (const o of F.birds) { if (o === b) continue; tmpS.subVectors(b.pos, o.pos); const d2 = tmpS.lengthSq(); if (d2 < 4 && d2 > 1e-4) acc.addScaledVector(tmpS, (4 - d2) * 0.8 / d2); }
      acc.addScaledVector(F.leadVel, 0.5).addScaledVector(b.vel, -0.5);
      const prevYaw = Math.atan2(b.vel.x, b.vel.z);
      b.vel.addScaledVector(acc, dt); const sp = b.vel.length(), max = Math.abs(F.w) * F.R * 1.6 + 3, min = 4;
      if (sp > max) b.vel.multiplyScalar(max / sp); else if (sp < min) b.vel.multiplyScalar(min / Math.max(sp, 1e-3));
      b.pos.addScaledVector(b.vel, dt);
      // orientation: face the way it flies, bank into turns
      const yaw = Math.atan2(b.vel.x, b.vel.z); let dy = yaw - prevYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      const turn = dt > 0 ? dy / dt : 0; b.roll += (Math.max(-0.8, Math.min(0.8, -turn * 1.2)) - b.roll) * Math.min(1, dt * 3);
      const pitch = -Math.asin(Math.max(-1, Math.min(1, b.vel.y / Math.max(b.vel.length(), 1e-3))));
      tmpE.set(pitch, yaw, b.roll); tmpQ.setFromEuler(tmpE); tmpS.setScalar(b.size); tmpM.compose(b.pos, tmpQ, tmpS); birds.setMatrixAt(b.i, tmpM);
      // wings: beat harder when climbing or catching up, glide when the flock glides (some birds a beat late)
      const want = F.glide > b.lazy ? 0 : Math.min(1, 0.65 + Math.max(0, b.vel.y) * 0.3 + Math.max(0, lag - 2) * 0.05);
      b.flap += (want - b.flap) * Math.min(1, dt * 2.5);
      att.setXYZ(b.i, b.phase, b.flap, F.rate);
    }
  }
  birds.instanceMatrix.needsUpdate = true; att.needsUpdate = true;
}
