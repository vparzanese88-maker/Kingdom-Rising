// Kingdom Rising 3D — billboard effects: fixed flames and glows on torches and fires, and a particle
// system for smoke, sparks, embers, spell effects, fountains and the like
import { THREE, K3 } from './core.js';
import './texgen.js';

// one atlas with four soft sprites: 0 flame, 1 glow, 2 smoke, 3 spark/star
let atlas = null;
function getAtlas() {
  if (atlas) return atlas;
  atlas = K3.canvasTex(256, 256, (g) => {
    const cell = (cx, cy, fn) => { g.save(); g.translate(cx * 128, cy * 128); fn(g); g.restore(); };
    cell(0, 0, (g) => { // flame
      const grd = g.createRadialGradient(64, 92, 2, 64, 76, 70); grd.addColorStop(0, 'rgba(255,255,240,1)'); grd.addColorStop(0.18, 'rgba(255,230,150,1)'); grd.addColorStop(0.45, 'rgba(255,140,40,0.75)'); grd.addColorStop(1, 'rgba(160,30,0,0)');
      g.fillStyle = grd; g.beginPath(); g.moveTo(64, 4); g.bezierCurveTo(118, 58, 112, 124, 64, 124); g.bezierCurveTo(16, 124, 10, 58, 64, 4); g.fill();
    });
    cell(1, 0, (g) => { const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,255,255,0.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grd; g.fillRect(0, 0, 128, 128); });
    cell(0, 1, (g) => { // smoke puff
      for (let k = 0; k < 9; k++) { const x = 64 + Math.cos(k * 2.4) * 22 * (k % 3) * 0.6, y = 64 + Math.sin(k * 2.4) * 22 * (k % 3) * 0.6; const grd = g.createRadialGradient(x, y, 0, x, y, 44); grd.addColorStop(0, 'rgba(255,255,255,0.32)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grd; g.fillRect(0, 0, 128, 128); }
    });
    cell(1, 1, (g) => { // four-point star spark
      const grd = g.createRadialGradient(64, 64, 0, 64, 64, 30); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.moveTo(64, 4); g.lineTo(70, 58); g.lineTo(124, 64); g.lineTo(70, 70); g.lineTo(64, 124); g.lineTo(58, 70); g.lineTo(4, 64); g.lineTo(58, 58); g.closePath(); g.fill();
    });
  });
  atlas.generateMipmaps = true;
  return atlas;
}

const VS = `
  attribute vec3 iPos; attribute vec2 iSize; attribute vec4 iCol; attribute vec2 iMisc; // misc: phase, kind
  uniform float uTime; uniform float uFlick;
  varying vec2 vUv; varying vec4 vCol; varying float vKind;
  #include <fog_pars_vertex>
  void main(){
    float kind = iMisc.y; vKind = kind; vCol = iCol;
    vec2 cellOff = kind < .5 ? vec2(0., .5) : kind < 1.5 ? vec2(.5, .5) : kind < 2.5 ? vec2(0., 0.) : vec2(.5, 0.);
    vUv = uv * .5 + cellOff;
    vec2 sz = iSize;
    if (kind < .5) { float f = sin(uTime * 13. + iMisc.x * 17.) * .5 + sin(uTime * 7.3 + iMisc.x * 5.) * .5; sz *= vec2(1. + f * .08 * uFlick, 1. + f * .16 * uFlick); }
    vec3 camR = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 camU = kind < .5 ? vec3(0., 1., 0.) : vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    if (kind < .5) camR = normalize(vec3(camR.x, 0., camR.z));
    vec3 wp = iPos + camR * position.x * sz.x + camU * (position.y + (kind < .5 ? .5 : 0.)) * sz.y;
    vec4 mvPosition = viewMatrix * vec4(wp, 1.);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const FS = `
  uniform sampler2D tAtlas; varying vec2 vUv; varying vec4 vCol; varying float vKind;
  #include <fog_pars_fragment>
  void main(){
    vec4 t = texture2D(tAtlas, vUv);
    vec4 c = vec4(vCol.rgb * t.rgb, t.a * vCol.a);
    if (c.a < .004) discard;
    gl_FragColor = c;
    #include <fog_fragment>
  }`;
function makeMat(additive) {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { tAtlas: { value: null }, uFlick: { value: 1 } }]),
    vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, fog: true,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}
const matAdd = makeMat(true), matNorm = makeMat(false);
function finalize(m) { m.uniforms.tAtlas.value = getAtlas(); m.uniforms.uTime = K3.shared.uTime; }

// fixed billboards (flames on torches, glowing lamps)
export function staticBillboards(list, additive = true) {
  if (!list.length) return null;
  const quad = new THREE.PlaneGeometry(1, 1);
  const g = new THREE.InstancedBufferGeometry(); g.index = quad.index; g.attributes.position = quad.attributes.position; g.attributes.uv = quad.attributes.uv;
  const n = list.length; const pos = new Float32Array(n * 3), size = new Float32Array(n * 2), col = new Float32Array(n * 4), misc = new Float32Array(n * 2);
  list.forEach((b, i) => { pos.set([b.x, b.y, b.z], i * 3); size.set([b.w, b.h], i * 2); col.set([b.r, b.g, b.b, b.a == null ? 1 : b.a], i * 4); misc.set([b.phase || Math.random() * 10, b.kind || 0], i * 2); });
  g.setAttribute('iPos', new THREE.InstancedBufferAttribute(pos, 3)); g.setAttribute('iSize', new THREE.InstancedBufferAttribute(size, 2)); g.setAttribute('iCol', new THREE.InstancedBufferAttribute(col, 4)); g.setAttribute('iMisc', new THREE.InstancedBufferAttribute(misc, 2));
  g.instanceCount = n;
  const m = additive ? matAdd : matNorm; finalize(m);
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 6; mesh.name = 'billboards';
  return mesh;
}

// ---------- particles ----------
class Pool {
  constructor(cap, additive) {
    this.cap = cap; this.n = 0; this.p = [];
    const quad = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry(); g.index = quad.index; g.attributes.position = quad.attributes.position; g.attributes.uv = quad.attributes.uv;
    this.pos = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.size = new THREE.InstancedBufferAttribute(new Float32Array(cap * 2), 2).setUsage(THREE.DynamicDrawUsage);
    this.col = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.misc = new THREE.InstancedBufferAttribute(new Float32Array(cap * 2), 2).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', this.pos); g.setAttribute('iSize', this.size); g.setAttribute('iCol', this.col); g.setAttribute('iMisc', this.misc);
    g.instanceCount = 0; this.g = g;
    const m = additive ? matAdd.clone() : matNorm.clone(); finalize(m); m.uniforms.uFlick.value = 0;
    this.mesh = new THREE.Mesh(g, m); this.mesh.frustumCulled = false; this.mesh.renderOrder = additive ? 8 : 7;
  }
  emit(o) { if (this.p.length >= this.cap) this.p.shift(); this.p.push(Object.assign({ t: 0, life: 1, vx: 0, vy: 0, vz: 0, s0: 0.3, s1: 0.6, r: 1, g: 1, b: 1, a: 1, kind: 1, drag: 0, grav: 0, fade: 1, ph: Math.random() * 10, sy: 1 }, o)); }
  update(dt) {
    const P = this.p; let j = 0;
    for (let i = 0; i < P.length; i++) {
      const q = P[i]; q.t += dt; if (q.t >= q.life) continue;
      const k = q.t / q.life;
      q.vy -= q.grav * dt; const dr = Math.exp(-q.drag * dt); q.vx *= dr; q.vy *= dr; q.vz *= dr;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      if (q.follow) { q.x = q.follow.x + q.ox; q.y = q.follow.y + q.oy; q.z = q.follow.z + q.oz; }
      P[j++] = q;
      const idx = j - 1; if (idx >= this.cap) continue;
      const s = q.s0 + (q.s1 - q.s0) * k; const a = q.a * (q.fade ? (k < 0.15 ? k / 0.15 : 1 - Math.pow((k - 0.15) / 0.85, 1.5)) : 1);
      this.pos.array[idx * 3] = q.x; this.pos.array[idx * 3 + 1] = q.y; this.pos.array[idx * 3 + 2] = q.z;
      this.size.array[idx * 2] = s; this.size.array[idx * 2 + 1] = s * q.sy;
      this.col.array[idx * 4] = q.r; this.col.array[idx * 4 + 1] = q.g; this.col.array[idx * 4 + 2] = q.b; this.col.array[idx * 4 + 3] = a;
      this.misc.array[idx * 2] = q.ph; this.misc.array[idx * 2 + 1] = q.kind;
    }
    P.length = j;
    this.g.instanceCount = Math.min(j, this.cap);
    for (const at of [this.pos, this.size, this.col, this.misc]) { at.needsUpdate = true; at.clearUpdateRanges && at.clearUpdateRanges(); at.addUpdateRange && at.addUpdateRange(0, Math.max(1, Math.min(j, this.cap)) * at.itemSize); }
  }
  clear() { this.p.length = 0; this.g.instanceCount = 0; }
}
export const fx = {
  add: new Pool(4000, true),
  smoke: new Pool(1800, false),
  init() { K3.scene.add(this.add.mesh); K3.scene.add(this.smoke.mesh); },
  update(dt) { this.add.update(dt); this.smoke.update(dt); },
  clear() { this.add.clear(); this.smoke.clear(); },
  // helpers
  burst(x, y, z, n, col, o = {}) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, e = (Math.random() - 0.3) * 1.5, sp = (o.speed || 2.5) * (0.4 + Math.random() * 0.8); this.add.emit({ x, y, z, vx: Math.cos(a) * Math.cos(e) * sp, vy: Math.sin(e) * sp + (o.up || 0), vz: Math.sin(a) * Math.cos(e) * sp, life: (o.life || 0.6) * (0.6 + Math.random() * 0.6), s0: o.s0 || 0.18, s1: o.s1 || 0.02, r: col[0], g: col[1], b: col[2], a: o.a || 1, kind: o.kind != null ? o.kind : 3, drag: o.drag || 2, grav: o.grav || 0 }); } },
};
K3.fx = fx;
export function rgb(str, mul = 1) { if (Array.isArray(str)) return str.map((v) => v * mul); if (!str) return [mul, mul, mul]; if (str[0] === '#') { const c = K3.col(str); return [c.r * mul, c.g * mul, c.b * mul]; } const m = String(str).split(',').map(Number); return [m[0] / 255 * mul, m[1] / 255 * mul, m[2] / 255 * mul]; }
