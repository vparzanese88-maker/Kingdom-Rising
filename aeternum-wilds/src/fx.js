// Shared effects: ground telegraphs for attacks, particle bursts, shock rings, camera shake and timers.
// Particles are GPU billboards from gfx/vfx/particles.js; burst() keeps its old signature and picks a look
// (sparks, glowing motes, smoke, dust, debris, blood) from the colour and gravity it is given.
import * as THREE from 'three';
import { G } from './state.js';
import { heightAt } from './world.js';
import { emit, preset, CELL, updateParticles, initParticles } from './gfx/vfx/particles.js';
import { FX } from './gfx/vfx/presets.js';
import { decal, wall } from './gfx/vfx/meshfx.js';

// ---------- telegraphs ----------
// A terrain-hugging plane whose shader draws the shape: a soft tinted area, a crisp glowing rim, and a fill
// that sweeps out from the attacker (or along a charge) as the wind-up runs, pulsing faster as it nears the end.
const TEL_FS = `
  uniform vec3 uCol; uniform float uShape, uR, uArc, uW, uLen, uK, uT, uFade;
  varying vec2 vL;
  void main(){
    vec2 p = vL; float sd, fill, along;
    if (uShape < 0.5) { float d = length(p); sd = d - uR; along = d / uR; }
    else if (uShape < 1.5) {
      float d = length(p), th = abs(atan(p.x, p.y)), da = uArc * 0.5 - th;
      float edge = da > 1.5707 ? d : d * sin(max(da, -1.0));
      sd = max(d - uR, -edge); along = d / uR;
    } else { sd = max(abs(p.x) - uW * 0.5, max(-p.y, p.y - uLen)); along = p.y / uLen; }
    if (sd > 0.06) discard;
    float inside = smoothstep(0.06, -0.04, sd);
    float rim = smoothstep(0.16, 0.0, abs(sd + 0.07));
    float k = clamp(uK, 0.0, 1.0);
    float front = smoothstep(k + 0.02, k - 0.02, along);
    float lead = smoothstep(0.07, 0.0, abs(along - k)) * step(0.02, k) * step(k, 0.995);
    float pulse = 0.5 + 0.5 * sin(uT * (6.0 + k * 16.0));
    float grad = 0.55 + 0.45 * smoothstep(0.0, 1.0, along);
    float base = 0.16 * grad;
    float fillA = front * (0.24 + 0.12 * grad);
    float glow = rim * (0.75 + 0.25 * pulse) + lead * 0.9 + front * 0.12 + (k > 0.995 ? 0.6 : 0.0) * inside;
    float cover = (base + fillA) * inside;
    vec3 col = uCol * (cover * 0.9 + glow * 1.6);
    cover *= uFade; col *= uFade;
    gl_FragColor = vec4(col, cover);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
const TEL_VS = `attribute vec2 aL; varying vec2 vL; void main(){ vL = aL; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const TN = 16;
const telPool = [];
const tels = [];
const parts = [];
// soft round sprites: glowing (additive) for bright colours, smoky (normal blend) for dark ones
let glowTex = null;
function softTex() {
  if (glowTex) return glowTex;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const c = cv.getContext('2d'), g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.85)'); g.addColorStop(0.6, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(cv); glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}
const pMats = new Map();
const pmat = c => {
  if (!pMats.has(c)) {
    const col = new THREE.Color(c), lum = col.r * 0.3 + col.g * 0.59 + col.b * 0.11;
    pMats.set(c, new THREE.SpriteMaterial({ map: softTex(), color: c, transparent: true, depthWrite: false, blending: lum > 0.28 ? THREE.AdditiveBlending : THREE.NormalBlending, opacity: lum > 0.28 ? 1 : 0.75 }));
  }
  return pMats.get(c);
};
export const spriteMat = pmat;

function newTel() {
  const g = new THREE.PlaneGeometry(1, 1, TN, TN); g.rotateX(-Math.PI / 2);
  const base = g.attributes.position.array.slice();
  g.setAttribute('aL', new THREE.BufferAttribute(new Float32Array((TN + 1) * (TN + 1) * 2), 2));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    uniforms: { uCol: { value: new THREE.Vector3() }, uShape: { value: 0 }, uR: { value: 1 }, uArc: { value: 1 }, uW: { value: 1 }, uLen: { value: 1 }, uK: { value: 0 }, uT: { value: 0 }, uFade: { value: 1 } },
    vertexShader: TEL_VS, fragmentShader: TEL_FS,
  });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 3;
  return { mesh, base };
}
// shape: circle {r} | sector {r, arc(deg)} | rect {width, len}; angle = facing (rotation.y)
export function telegraph(o) {
  const color = o.color ?? 0xff3020;
  const T = telPool.pop() || newTel();
  const g = T.mesh.geometry, pos = g.attributes.position.array, L = g.attributes.aL.array, b = T.base;
  const ang = o.angle || 0, ca = Math.cos(ang), sa = Math.sin(ang);
  let sx, sz, oz = 0;
  if (o.shape === 'rect') { sx = o.width + 0.4; sz = o.len + 0.4; oz = o.len / 2; } else { sx = sz = o.r * 2 + 0.4; }
  const y0 = heightAt(o.x, o.z);
  for (let i = 0, j = 0; i < pos.length; i += 3, j += 2) {
    const lx = b[i] * sx, lz = b[i + 2] * sz + oz;
    // local +z is the facing direction: rotate by the angle about y
    const wx = lx * ca + lz * sa, wz = -lx * sa + lz * ca;
    pos[i] = wx; pos[i + 2] = wz; pos[i + 1] = Math.max(heightAt(o.x + wx, o.z + wz), -0.3) - y0 + 0.12;
    L[j] = lx; L[j + 1] = lz;
  }
  g.attributes.position.needsUpdate = true; g.attributes.aL.needsUpdate = true;
  const u = T.mesh.material.uniforms, c = new THREE.Color(color);
  u.uCol.value.set(c.r, c.g, c.b);
  u.uShape.value = o.shape === 'circle' ? 0 : o.shape === 'sector' ? 1 : 2;
  u.uR.value = o.r || 1; u.uArc.value = (o.arc || 90) * Math.PI / 180; u.uW.value = o.width || 1; u.uLen.value = o.len || 1; u.uK.value = 0; u.uFade.value = 0;
  T.mesh.position.set(o.x, y0, o.z);
  G.scene.add(T.mesh);
  const t = { T, g: T.mesh, shape: o.shape, t: 0, dur: Math.max(0.05, o.dur || 0.5), done: false, end: 0 };
  tels.push(t);
  return t;
}
export function removeTelegraph(t) { if (t) t.done = true; }

// ---------- bursts ----------
// one scratch preset per look; burst() overwrites its speed / life / size / gravity before emitting
const B = {
  spark: preset({ cell: CELL.spark, dir: 'sphere', drag: 1.6, stretch: 0.045, hdr: 3.2, whiten: 0.55, endK: 0.7, fadeIn: 0.01, ground: true }),
  glow: preset({ cell: CELL.glow, dir: 'sphere', drag: 1.8, hdr: 2.4, whiten: 0.3, endK: 0.6, fadeIn: 0.12 }),
  smoke: preset({ cell: CELL.smoke, dir: 'sphere', drag: 2, add: 0, alpha: 0.65, endK: 1.25, spin: 0.8, fadeIn: 0.1 }),
  dust: preset({ cell: CELL.dust, dir: 'sphere', drag: 2.6, add: 0, alpha: 0.55, endK: 1.2, spin: 0.6, fadeIn: 0.08, ground: true }),
  chunk: preset({ cell: CELL.chunk, dir: 'up', drag: 0.5, add: 0, spin: 12, endK: 0.85, fadeIn: 0.01, ground: true }),
  drop: preset({ cell: CELL.drop, dir: 'sphere', drag: 1, add: 0, alpha: 0.95, endK: 0.6, stretch: 0.04, fadeIn: 0.01, ground: true, rot: false }),
};
function setB(p, speed, life, size, grav, sk = 1, lk = 1, zk = 1, grow = 0.4) {
  p.speed[0] = speed * 0.35 * sk; p.speed[1] = speed * 1.15 * sk;
  p.life[0] = life * 0.6 * lk; p.life[1] = life * 1.2 * lk;
  p.size[0] = size * 0.7 * zk; p.size[1] = size * 1.4 * zk; p.grow = grow;
  p.grav = grav; return p;
}
export function burst(x, y, z, color, n = 10, speed = 4, life = 0.6, size = 0.15, grav = 9) {
  if (!G.scene) return;
  const r = ((color >> 16) & 255) / 255, g = ((color >> 8) & 255) / 255, b = (color & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), lum = 0.3 * r + 0.59 * g + 0.11 * b, sat = mx - mn;
  if (n <= 1) { // single trail / status motes: keep them cheap and soft
    if (lum < 0.22) emit(setB(B.smoke, speed, life, size * 3, grav * 0.3, 1, 1.2, 1, 2.2), 1, x, y, z, 0, 1, 0, 1, color);
    else if (r > 0.45 && g < 0.2 && b < 0.25) emit(setB(B.drop, speed, life, size * 1.2, Math.max(grav, 6)), 1, x, y, z, 0, 1, 0, 1, color);
    else emit(setB(B.glow, speed, life, size * 2.2, grav * 0.6, 1, 1, 1, 0.35), 1, x, y, z, 0, 1, 0, 1, color);
    return;
  }
  if (lum < 0.22) {
    // dark: smoke or flung dirt
    emit(setB(B.smoke, speed * 0.5, life * 1.6, size * 3.2, Math.min(grav, 0) * 0.3 - 0.2, 1, 1, 1, 2.4), Math.ceil(n * 0.7), x, y, z, 0, 1, 0, 1, color);
    if (grav > 3) emit(setB(B.chunk, speed, life * 1.3, size * 0.9, 16), Math.ceil(n * 0.4), x, y, z, 0, 1, 0, 1, color);
  } else if (r > 0.45 && g < 0.2 && b < 0.25 && grav > 0) {
    // blood
    emit(setB(B.drop, speed * 1.1, life, size * 0.8, Math.max(10, grav)), n, x, y, z, 0, 1, 0, 1, color);
    emit(setB(B.smoke, speed * 0.3, life * 0.6, size * 2.4, 0, 1, 1, 1, 2), Math.ceil(n * 0.3), x, y, z, 0, 1, 0, 1, color);
  } else if (sat < 0.2 && lum < 0.7 && grav > 0) {
    // earthy grey-browns: dust and stones
    emit(setB(B.dust, speed * 0.7, life * 1.4, size * 3.2, -0.3, 1, 1, 1, 2.2), Math.ceil(n * 0.7), x, y, z, 0, 1, 0, 1, color);
    emit(setB(B.chunk, speed, life * 1.2, size * 0.8, 16), Math.ceil(n * 0.5), x, y, z, 0, 1, 0, 1, color);
  } else if (grav <= 2) {
    // magic, fire, healing: glowing motes that float, with a few sparkles
    emit(setB(B.glow, speed * 0.8, life, size * 1.9, grav * 0.7, 1, 1, 1, 0.35), n, x, y, z, 0, 1, 0, 1, color);
    emit(setB(B.spark, speed, life * 0.8, size * 0.5, grav * 0.5), Math.ceil(n * 0.5), x, y, z, 0, 1, 0, 1, color);
    if (n >= 8) emit(FX.flashSmall, 1, x, y, z, 0, 1, 0, Math.min(2, 0.5 + n * 0.04), color);
  } else {
    // bright with weight: hot sparks plus a soft glow
    emit(setB(B.spark, speed * 1.3, life * 0.8, size * 0.5, grav), n, x, y, z, 0, 1, 0, 1, color);
    emit(setB(B.glow, speed * 0.4, life * 0.5, size * 2.2, 0, 1, 1, 1, 0.6), Math.ceil(n * 0.3), x, y, z, 0, 1, 0, 1, color);
    if (n >= 8) emit(FX.flashSmall, 1, x, y, z, 0, 1, 0, Math.min(2, 0.5 + n * 0.04), color);
  }
}

// expanding shock ring on the ground (landings, slams, novas): a glowing ring that hugs the terrain,
// a vertical band that reads on slopes, and a kick of dust

// one particle with an explicit velocity (flame and smoke trails); grow > 0 makes it swell as it fades
export function puff(x, y, z, color, vx, vy, vz, life, size, grow = 0, drag = 1.5) {
  let p = parts.find(q => !q.alive);
  if (!p) { if (parts.length > 700) return; p = { mesh: new THREE.Sprite(pmat(color)) }; G.scene.add(p.mesh); parts.push(p); }
  p.mesh.material = pmat(color);
  p.alive = true; p.mesh.visible = true;
  p.mesh.position.set(x, y, z);
  p.vx = vx; p.vy = vy; p.vz = vz; p.life = p.max = life; p.size = size; p.grav = 0; p.grow = grow; p.drag = drag;
  p.mesh.scale.setScalar(size);
}

export function shockRing(x, z, r, color = 0xffe0a0, dur = 0.4) {
  if (!G.scene) return;
  const y = heightAt(x, z);
  decal(x, z, { ring: { w: 0.1 }, size: r * 2.3, color: 0x000000, alpha: 0.15, glow: 1.1, glowColor: color, glowHdr: 2.2, life: dur * 1.15 });
  wall(x, y, z, r, color, dur, Math.min(1.6, 0.5 + r * 0.15), 1.8);
  emit(FX.dust, Math.round(6 + r * 3), x, y + 0.15, z, 0, 1, 0, Math.min(1.6, 0.6 + r * 0.12));
}

// ---------- camera shake ----------
let shakeAmt = 0, shakeT = 0;
export function shake(a) { shakeAmt = Math.max(shakeAmt, a); }
const _sh = [0, 0];
export function shakeOffset(dt) {
  shakeAmt = Math.max(0, shakeAmt - dt * (1.6 + shakeAmt * 3));
  shakeT += dt;
  if (shakeAmt <= 0) { _sh[0] = 0; _sh[1] = 0; return _sh; }
  // smooth noise (sums of sines) rather than per-frame random jitter: a heavy jolt, not a buzz
  const t = shakeT, a = shakeAmt;
  _sh[0] = a * (Math.sin(t * 47.3) * 0.55 + Math.sin(t * 29.1 + 1.7) * 0.35 + (Math.random() - 0.5) * 0.2);
  _sh[1] = a * (Math.sin(t * 43.7 + 2.1) * 0.55 + Math.sin(t * 23.9 + 0.4) * 0.35 + (Math.random() - 0.5) * 0.2);
  return _sh;
}

// ---------- timers ----------
const timers = [];
export function later(d, fn) { timers.push({ t: d, fn }); }

export function updateFx(dt) {
  initParticles();
  for (let i = timers.length - 1; i >= 0; i--) { const tm = timers[i]; tm.t -= dt; if (tm.t <= 0) { timers.splice(i, 1); tm.fn(); } }
  for (let i = tels.length - 1; i >= 0; i--) {
    const t = tels[i];
    t.t += dt;
    const u = t.T.mesh.material.uniforms;
    const k = Math.min(1, t.t / t.dur);
    u.uK.value = k; u.uT.value = t.t;
    // fade in quickly; when it fires (or is cancelled) flash and fade out
    if (t.done || t.t >= t.dur + 0.05) t.end += dt;
    u.uFade.value = Math.min(1, t.t / 0.08) * (t.end > 0 ? Math.max(0, 1 - t.end / 0.12) : 1);
    if (t.end >= 0.12) {
      G.scene.remove(t.g);
      telPool.push(t.T);
      tels.splice(i, 1);
    }
  }
  updateParticles(dt);
  for (const p of parts) {
    if (!p.alive) continue;
    p.life -= dt;
    if (p.life <= 0) { p.alive = false; p.mesh.visible = false; continue; }
    p.vy -= p.grav * dt;
    p.mesh.position.x += p.vx * dt; p.mesh.position.y += p.vy * dt; p.mesh.position.z += p.vz * dt;
    const k = p.life / p.max;
    p.mesh.scale.setScalar(p.grow ? p.size * (1 + (1 - k) * p.grow) : p.size * k);
    if (p.drag) { p.vx *= 1 - p.drag * dt; p.vz *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt; }
  }
}

export function clearTelegraphs() { for (const t of tels) t.done = true; timers.length = 0; }
