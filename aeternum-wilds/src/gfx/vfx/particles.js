// Aeternum Wilds: GPU billboard particles.
// One instanced draw for every particle in the world. Sprites come from a generated 4x4 atlas of soft shapes;
// each particle carries its own colour-over-life, size-over-life, gravity, drag, spin and "additivity":
// the material uses premultiplied blending, so a particle can be pure light (sparks, fire, magic: adds, blooms),
// pure matter (smoke, dust, blood, leaves: covers what is behind it) or anything between. Sparks can stretch
// along their screen-space velocity into streaks. State lives in one Float32Array (no per-frame allocation);
// dead particles are swap-removed, and when the pool is full the oldest-looking slot is recycled.
import * as THREE from 'three';
import { G } from '../../state.js';
import { heightAt } from '../../world.js';

// ---------- atlas ----------
export const CELL = { glow: 0, spark: 1, streak: 2, smoke: 3, flame: 4, star: 5, ring: 6, leaf: 7, shard: 8, drop: 9, chunk: 10, wisp: 11, dust: 12, rune: 13, bubble: 14, note: 15 };
let atlasTex = null;
function makeAtlas() {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S * 4;
  const g = c.getContext('2d');
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const cell = (i, fn) => { g.save(); g.translate((i % 4) * S, Math.floor(i / 4) * S); g.beginPath(); g.rect(0, 0, S, S); g.clip(); fn(g); g.restore(); };
  const rad = (x, y, r0, r, stops) => { const gr = g.createRadialGradient(x, y, r0, x, y, r); for (const [k, a] of stops) gr.addColorStop(k, `rgba(255,255,255,${a})`); return gr; };
  // 0 soft glow (falls off like light, no hard rim)
  cell(0, (g) => { g.fillStyle = rad(64, 64, 0, 62, [[0, 1], [0.12, 0.85], [0.35, 0.38], [0.65, 0.1], [1, 0]]); g.fillRect(0, 0, S, S); });
  // 1 hot spark: a pin-point core in a small halo
  cell(1, (g) => { g.fillStyle = rad(64, 64, 0, 60, [[0, 1], [0.1, 1], [0.22, 0.5], [0.5, 0.12], [1, 0]]); g.fillRect(0, 0, S, S); });
  // 2 streak: a long thin bright line with a soft sheath (stretched along velocity)
  cell(2, (g) => {
    for (let y = 0; y < S; y++) { const d = Math.abs(y - 64) / 64; const a = Math.pow(Math.max(0, 1 - d), 6); g.fillStyle = `rgba(255,255,255,${a})`; g.fillRect(0, y, S, 1); }
    g.globalCompositeOperation = 'destination-in';
    const gr = g.createLinearGradient(0, 0, S, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.3, 'rgba(0,0,0,1)'); gr.addColorStop(0.75, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
  });
  // 3 smoke puff: overlapping soft lumps
  cell(3, (g) => {
    for (let k = 0; k < 16; k++) { const a = rnd() * 6.283, r = rnd() * 26, x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r, rr = 22 + rnd() * 18; g.fillStyle = rad(x, y, 0, rr, [[0, 0.32], [0.6, 0.12], [1, 0]]); g.fillRect(0, 0, S, S); }
  });
  // 4 flame tongue
  cell(4, (g) => {
    g.fillStyle = rad(64, 86, 2, 60, [[0, 1], [0.25, 0.9], [0.6, 0.45], [1, 0]]);
    g.beginPath(); g.moveTo(64, 6); g.bezierCurveTo(108, 52, 112, 118, 64, 122); g.bezierCurveTo(16, 118, 20, 52, 64, 6); g.fill();
    g.globalCompositeOperation = 'destination-in'; g.fillStyle = rad(64, 80, 10, 64, [[0, 1], [0.7, 0.8], [1, 0]]); g.fillRect(0, 0, S, S);
  });
  // 5 four-point star (crits, holy glints)
  cell(5, (g) => {
    g.fillStyle = rad(64, 64, 0, 30, [[0, 1], [0.4, 0.4], [1, 0]]); g.fillRect(0, 0, S, S);
    for (const [w, l] of [[5, 62], [3, 44]]) {
      for (let r = 0; r < 2; r++) {
        g.save(); g.translate(64, 64); g.rotate(r * Math.PI / 2 + (l < 50 ? Math.PI / 4 : 0));
        const gr = g.createLinearGradient(-l, 0, l, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.beginPath(); g.moveTo(-l, 0); g.quadraticCurveTo(0, -w, l, 0); g.quadraticCurveTo(0, w, -l, 0); g.fill(); g.restore();
      }
    }
  });
  // 6 soft ring
  cell(6, (g) => { g.fillStyle = rad(64, 64, 30, 62, [[0, 0], [0.45, 0.25], [0.72, 1], [0.86, 0.35], [1, 0]]); g.fillRect(0, 0, S, S); });
  // 7 leaf
  cell(7, (g) => {
    g.translate(64, 64); g.rotate(-0.6);
    g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.moveTo(0, -54); g.bezierCurveTo(36, -30, 34, 30, 0, 54); g.bezierCurveTo(-34, 30, -36, -30, 0, -54); g.fill();
    g.strokeStyle = 'rgba(150,150,150,0.9)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -48); g.lineTo(0, 52); g.stroke();
    g.lineWidth = 2; for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(0, k * 12); g.lineTo(22 - Math.abs(k) * 3, k * 12 - 12); g.moveTo(0, k * 12); g.lineTo(-22 + Math.abs(k) * 3, k * 12 - 12); g.stroke(); }
  });
  // 8 shard (ice, bone, stone chips): a hard-edged crystal with a lit face
  cell(8, (g) => {
    g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.moveTo(64, 8); g.lineTo(92, 50); g.lineTo(78, 118); g.lineTo(44, 104); g.lineTo(36, 44); g.closePath(); g.fill();
    g.fillStyle = 'rgba(170,170,170,1)'; g.beginPath(); g.moveTo(64, 8); g.lineTo(92, 50); g.lineTo(78, 118); g.lineTo(64, 60); g.closePath(); g.fill();
  });
  // 9 droplet (blood, water): a soft round body with a tail
  cell(9, (g) => {
    g.fillStyle = rad(64, 74, 0, 34, [[0, 1], [0.7, 0.95], [1, 0]]); g.beginPath(); g.arc(64, 74, 34, 0, 6.283); g.fill();
    g.beginPath(); g.moveTo(40, 64); g.quadraticCurveTo(64, 0, 88, 64); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(54, 66, 8, 0, 6.283); g.fill();
  });
  // 10 debris chunk: an irregular rock, darker underside
  cell(10, (g) => {
    g.fillStyle = 'rgba(255,255,255,1)'; g.beginPath();
    for (let k = 0; k < 9; k++) { const a = k / 9 * 6.283, r = 34 + rnd() * 22; g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); }
    g.closePath(); g.fill();
    g.globalCompositeOperation = 'source-atop'; const gr = g.createLinearGradient(0, 20, 0, 110); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(110,110,110,1)'); g.fillStyle = gr; g.fillRect(0, 0, S, S);
  });
  // 11 wisp: a curling comma of light (spirits, souls, wind)
  cell(11, (g) => {
    g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 40; k++) { const t = k / 40, a = t * 4.2, r = 10 + t * 40, x = 64 + Math.cos(a) * r * 0.9, y = 64 + Math.sin(a) * r * 0.9, rr = 18 * (1 - t) + 4; g.fillStyle = rad(x, y, 0, rr, [[0, 0.22 * (1 - t * 0.7)], [1, 0]]); g.fillRect(0, 0, S, S); }
  });
  // 12 dust: soft, flat, low-contrast blob
  cell(12, (g) => { for (let k = 0; k < 10; k++) { const x = 40 + rnd() * 48, y = 40 + rnd() * 48, rr = 26 + rnd() * 16; g.fillStyle = rad(x, y, 0, rr, [[0, 0.3], [1, 0]]); g.fillRect(0, 0, S, S); } });
  // 13 rune glyph
  cell(13, (g) => {
    g.strokeStyle = 'rgba(255,255,255,1)'; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(64, 14); g.lineTo(64, 114); g.moveTo(64, 34); g.lineTo(96, 58); g.moveTo(64, 58); g.lineTo(32, 82); g.moveTo(40, 30); g.lineTo(88, 30); g.stroke();
    g.lineWidth = 4; g.beginPath(); g.arc(64, 96, 12, 0, 6.283); g.stroke();
  });
  // 14 bubble
  cell(14, (g) => { g.fillStyle = rad(64, 64, 30, 52, [[0, 0.08], [0.7, 0.5], [0.9, 1], [1, 0]]); g.beginPath(); g.arc(64, 64, 52, 0, 6.283); g.fill(); g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.ellipse(48, 46, 10, 6, -0.7, 0, 6.283); g.fill(); });
  // 15 music note
  cell(15, (g) => {
    g.fillStyle = 'rgba(255,255,255,1)'; g.strokeStyle = 'rgba(255,255,255,1)'; g.lineWidth = 8;
    g.beginPath(); g.ellipse(44, 92, 20, 14, -0.4, 0, 6.283); g.fill(); g.beginPath(); g.ellipse(92, 80, 20, 14, -0.4, 0, 6.283); g.fill();
    g.beginPath(); g.moveTo(62, 90); g.lineTo(62, 22); g.lineTo(110, 12); g.lineTo(110, 78); g.stroke(); g.lineWidth = 12; g.beginPath(); g.moveTo(62, 26); g.lineTo(110, 16); g.stroke();
  });
  const t = new THREE.CanvasTexture(c);
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.colorSpace = THREE.NoColorSpace; // values are coverage, not colour
  return t;
}
export function atlas() { return atlasTex || (atlasTex = makeAtlas()); }

// ---------- shader ----------
const VS = /* glsl */`
  attribute vec3 iPos; attribute vec3 iVel; attribute vec4 iSz; attribute vec4 iCol; attribute float iAdd;
  varying vec2 vUv; varying vec4 vCol; varying float vAdd;
  #include <fog_pars_vertex>
  void main() {
    float cellI = iSz.w;
    vec2 cellOff = vec2(mod(cellI, 4.0), 3.0 - floor(cellI / 4.0)) * 0.25;
    vUv = uv * 0.25 + cellOff;
    vCol = iCol; vAdd = iAdd;
    vec4 mv = viewMatrix * vec4(iPos, 1.0);
    vec2 q = position.xy * iSz.x;
    if (iSz.y > 0.0) {
      // stretch along the screen-space velocity: sparks become streaks
      vec3 vv = (viewMatrix * vec4(iVel, 0.0)).xyz;
      float sp = length(vv.xy);
      vec2 ax = sp > 1e-4 ? vv.xy / sp : vec2(1.0, 0.0);
      vec2 ay = vec2(-ax.y, ax.x);
      float len = iSz.x * (1.0 + iSz.y * sp);
      q = ax * position.x * len + ay * position.y * iSz.x;
    } else {
      float c = cos(iSz.z), s = sin(iSz.z);
      q = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
    }
    mv.xy += q;
    vec4 mvPosition = mv;
    gl_Position = projectionMatrix * mv;
    #include <fog_vertex>
  }`;
const FS = /* glsl */`
  uniform sampler2D tAtlas; uniform vec3 uAmb;
  varying vec2 vUv; varying vec4 vCol; varying float vAdd;
  #include <fog_pars_fragment>
  void main() {
    vec4 tx = texture2D(tAtlas, vUv);
    float cov = tx.a;
    vec3 base = tx.rgb;
    float a = cov * vCol.a;
    if (a < 0.003) discard;
    // matter (non-additive) is lit by the sky; light (additive) is not
    vec3 col = vCol.rgb * base * mix(uAmb, vec3(1.0), vAdd);
    #ifdef USE_FOG
      #ifdef FOG_EXP2
        float fogFactor = 1.0 - exp(- fogDensity * fogDensity * vFogDepth * vFogDepth);
      #else
        float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
      #endif
      col = mix(col, fogColor * (1.0 - vAdd), fogFactor);
      a *= 1.0 - fogFactor * vAdd;
    #endif
    // premultiplied: rgb adds light, alpha covers; additive particles cover nothing
    gl_FragColor = vec4(col * a, a * (1.0 - vAdd));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

// ---------- pool ----------
// per-particle state, stride 26:
// 0-2 pos, 3-5 vel, 6 age, 7 life, 8 s0, 9 s1, 10-12 c0, 13-15 c1, 16 alpha, 17 grav, 18 drag,
// 19 rot, 20 spin, 21 cell, 22 stretch, 23 add, 24 ground y (or -1e9), 25 fadeIn
const ST = 26;
export const MAX = { low: 1400, medium: 3200, high: 4500, ultra: 6000 };
let cap = 0, n = 0, D = null;
let geo = null, mesh = null, aPos, aVel, aSz, aCol, aAdd, ATTRS = [];
const uniforms = { tAtlas: { value: null }, uAmb: { value: new THREE.Vector3(1, 1, 1) } };

export function initParticles() {
  if (mesh) { if (mesh.parent !== G.scene && G.scene) G.scene.add(mesh); return; }
  cap = MAX[G.quality] || MAX.medium;
  D = new Float32Array(cap * ST);
  const quad = new THREE.PlaneGeometry(1, 1);
  geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index; geo.setAttribute('position', quad.attributes.position); geo.setAttribute('uv', quad.attributes.uv);
  const ia = (k, sz) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * sz), sz); a.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(k, a); return a; };
  aPos = ia('iPos', 3); aVel = ia('iVel', 3); aSz = ia('iSz', 4); aCol = ia('iCol', 4); aAdd = ia('iAdd', 1);
  ATTRS = [aPos, aVel, aSz, aCol, aAdd];
  geo.instanceCount = 0;
  uniforms.tAtlas.value = atlas();
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]),
    vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, depthTest: true, fog: true,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
  mat.uniforms.tAtlas = uniforms.tAtlas; mat.uniforms.uAmb = uniforms.uAmb;
  mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 20; mesh.name = 'vfx-particles';
  G.scene.add(mesh);
}

// ---------- presets ----------
// A preset describes one kind of particle. Colours are sRGB hex; `hdr` multiplies the start colour (values above 1
// bloom). Speeds in m/s; `dir`: 'sphere' (all round), 'up' (hemisphere), 'cone' (around the given direction),
// 'disc' (flat ring outwards), 'none'. `up` adds a fixed upward velocity, `jit` spreads the spawn points.
const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
export function preset(o) {
  const p = Object.assign({ cell: 0, life: [0.4, 0.7], size: [0.2, 0.3], grow: 0.4, speed: [1, 3], dir: 'sphere', spread: 0.6, up: 0, grav: 0, drag: 1.5,
    col0: 0xffffff, col1: null, hdr: 1, hdr1: null, alpha: 1, add: 1, spin: 0, rot: true, stretch: 0, jit: 0, ground: false, fadeIn: 0.08, whiten: 0, endK: 0.5 }, o);
  p.c0 = lin(p.col0); p.c1 = p.col1 == null ? p.c0.map((v) => v * p.endK) : lin(p.col1);
  if (p.hdr1 == null) p.hdr1 = p.hdr;
  return p;
}
const tintCache = new Map();
function tintLin(hex) { let t = tintCache.get(hex); if (!t) { t = lin(hex); tintCache.set(hex, t); if (tintCache.size > 256) tintCache.delete(tintCache.keys().next().value); } return t; }

const R = Math.random;
// emit n particles of preset p at (x,y,z). (dx,dy,dz) steers 'cone'/'disc' emission (need not be unit),
// scale multiplies size and speed, tint (hex or -1) recolours the preset (keeping its brightness ramp).
export function emit(p, count, x, y, z, dx = 0, dy = 1, dz = 0, scale = 1, tint = -1) {
  if (!D) initParticles();
  if (!D || count <= 0) return;
  let gy = -1e9;
  if (p.ground) gy = heightAt(x, z) + 0.04;
  const dl = Math.hypot(dx, dy, dz) || 1; dx /= dl; dy /= dl; dz /= dl;
  // a basis around the direction for cone emission
  let ux = 0, uy = 1, uz = 0; if (Math.abs(dy) > 0.9) { ux = 1; uy = 0; }
  let bx = dy * uz - dz * uy, by = dz * ux - dx * uz, bz = dx * uy - dy * ux; const bl = Math.hypot(bx, by, bz) || 1; bx /= bl; by /= bl; bz /= bl;
  const cx = by * dz - bz * dy, cy = bz * dx - bx * dz, cz = bx * dy - by * dx;
  const t = tint >= 0 ? tintLin(tint) : null;
  for (let i = 0; i < count; i++) {
    let k;
    if (n < cap) k = n++;
    else k = (R() * cap) | 0; // full: recycle a random slot rather than refuse (keeps fresh hits visible)
    const o = k * ST;
    let vx, vy, vz;
    const sp = (p.speed[0] + R() * (p.speed[1] - p.speed[0])) * scale;
    if (p.dir === 'cone') {
      const a = R() * 6.283, r = Math.sqrt(R()) * p.spread;
      const ca = Math.cos(a) * r, sa = Math.sin(a) * r;
      vx = dx + bx * ca + cx * sa; vy = dy + by * ca + cy * sa; vz = dz + bz * ca + cz * sa;
      const l = Math.hypot(vx, vy, vz) || 1; vx = vx / l * sp; vy = vy / l * sp; vz = vz / l * sp;
    } else if (p.dir === 'disc') {
      const a = R() * 6.283; vx = Math.cos(a) * sp; vz = Math.sin(a) * sp; vy = (R() - 0.3) * sp * p.spread;
    } else if (p.dir === 'none') { vx = vy = vz = 0; }
    else {
      const u = p.dir === 'up' ? R() : R() * 2 - 1, a = R() * 6.283, s = Math.sqrt(1 - u * u);
      vx = Math.cos(a) * s * sp; vy = u * sp; vz = Math.sin(a) * s * sp;
    }
    vy += p.up * scale;
    const j = p.jit * scale;
    D[o] = x + (j ? (R() - 0.5) * 2 * j : 0); D[o + 1] = y + (j ? (R() - 0.5) * j : 0); D[o + 2] = z + (j ? (R() - 0.5) * 2 * j : 0);
    D[o + 3] = vx; D[o + 4] = vy; D[o + 5] = vz;
    D[o + 6] = 0; D[o + 7] = p.life[0] + R() * (p.life[1] - p.life[0]);
    const s0 = (p.size[0] + R() * (p.size[1] - p.size[0])) * scale;
    D[o + 8] = s0; D[o + 9] = s0 * p.grow;
    const c0 = p.c0, c1 = p.c1, h0 = p.hdr, h1 = p.hdr1;
    if (t) {
      const w = p.whiten;
      D[o + 10] = (t[0] + (1 - t[0]) * w) * h0; D[o + 11] = (t[1] + (1 - t[1]) * w) * h0; D[o + 12] = (t[2] + (1 - t[2]) * w) * h0;
      D[o + 13] = t[0] * p.endK * h1; D[o + 14] = t[1] * p.endK * h1; D[o + 15] = t[2] * p.endK * h1;
    } else {
      D[o + 10] = c0[0] * h0; D[o + 11] = c0[1] * h0; D[o + 12] = c0[2] * h0;
      D[o + 13] = c1[0] * h1; D[o + 14] = c1[1] * h1; D[o + 15] = c1[2] * h1;
    }
    D[o + 16] = p.alpha; D[o + 17] = p.grav; D[o + 18] = p.drag;
    D[o + 19] = p.rot ? R() * 6.283 : 0; D[o + 20] = p.spin ? (R() - 0.5) * 2 * p.spin : 0;
    D[o + 21] = p.cell; D[o + 22] = p.stretch; D[o + 23] = p.add; D[o + 24] = gy; D[o + 25] = p.fadeIn;
  }
}
// a single particle with explicit velocity, life and colour (trails, motes)
export function emitOne(p, x, y, z, vx, vy, vz, scale = 1, tint = -1) {
  emit(p, 1, x, y, z, 0, 1, 0, scale, tint);
  if (!D) return;
  const o = (n - 1) * ST; D[o] = x; D[o + 1] = y; D[o + 2] = z; D[o + 3] = vx; D[o + 4] = vy; D[o + 5] = vz;
}
export function particleCount() { return n; }
export function particleCap() { return cap; }
export function clearParticles() { n = 0; if (geo) geo.instanceCount = 0; }

export function updateParticles(dt) {
  if (!D) return;
  // ambient light on smoke and dust follows day and night
  const night = G.night || 0, k = 1 - night * 0.65;
  uniforms.uAmb.value.set(k, k * (1 - night * 0.05), k * (1 + night * 0.1));
  const P = aPos.array, V = aVel.array, SZ = aSz.array, C = aCol.array, A = aAdd.array;
  let i = 0;
  while (i < n) {
    const o = i * ST;
    let age = D[o + 6] + dt; const life = D[o + 7];
    if (age >= life) { // swap-remove
      n--; if (i !== n) D.copyWithin(o, n * ST, n * ST + ST);
      continue;
    }
    D[o + 6] = age;
    const drag = Math.exp(-D[o + 18] * dt);
    let vx = D[o + 3] * drag, vy = D[o + 4] * drag - D[o + 17] * dt, vz = D[o + 5] * drag;
    let x = D[o] + vx * dt, y = D[o + 1] + vy * dt, z = D[o + 2] + vz * dt;
    const gy = D[o + 24];
    if (y < gy) { y = gy; vy = -vy * 0.25; vx *= 0.55; vz *= 0.55; D[o + 20] *= 0.5; }
    D[o] = x; D[o + 1] = y; D[o + 2] = z; D[o + 3] = vx; D[o + 4] = vy; D[o + 5] = vz;
    D[o + 19] += D[o + 20] * dt;
    const t = age / life, fi = D[o + 25];
    const a = D[o + 16] * (t < fi ? t / fi : 1 - Math.pow((t - fi) / (1 - fi), 1.6));
    const j3 = i * 3, j4 = i * 4;
    P[j3] = x; P[j3 + 1] = y; P[j3 + 2] = z;
    V[j3] = vx; V[j3 + 1] = vy; V[j3 + 2] = vz;
    SZ[j4] = D[o + 8] + (D[o + 9] - D[o + 8]) * t; SZ[j4 + 1] = D[o + 22]; SZ[j4 + 2] = D[o + 19]; SZ[j4 + 3] = D[o + 21];
    C[j4] = D[o + 10] + (D[o + 13] - D[o + 10]) * t; C[j4 + 1] = D[o + 11] + (D[o + 14] - D[o + 11]) * t; C[j4 + 2] = D[o + 12] + (D[o + 15] - D[o + 12]) * t; C[j4 + 3] = a;
    A[i] = D[o + 23];
    i++;
  }
  geo.instanceCount = n;
  for (const at of ATTRS) { at.clearUpdateRanges(); at.addUpdateRange(0, Math.max(1, n) * at.itemSize); at.needsUpdate = true; }
}
