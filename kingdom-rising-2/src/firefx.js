// Stylised living fire for campfires, fire pits, bonfires, forges, braziers and torches.
// Every fire in world.fires ({ pos, size, light }) is drawn by ONE instanced mesh (one draw call for all fires):
//   - flame tongues: camera-facing quads with a noise-eroded teardrop shader, banded white-hot core -> yellow -> orange -> red tips
//   - a soft round glow around the flames (the bloom pass turns it into a warm halo)
//   - a pool of warm light on the ground (fakes firelight on fires too far for one of the few real point lights)
//   - a bed of glowing, pulsing coals under the logs
// Embers, sparks and smoke are particles in the shared vfx pools (V.add / V.norm), only for fires near the camera.
// The real point lights stay in main.js (only the nearest four fires get one); FireFX.flicker(i, t) gives them the same flicker.
// Quality: 'low' draws fewer tongues and particles.
import * as THREE from 'three';
import { V } from './vfx.js';
import { settings } from './saves.js';

const VERT = `
  attribute vec4 iA; // fire position, seed
  attribute vec4 iB; // width, height, type (0 tongue, 1 glow, 2 ground light, 3 coals), strength
  attribute vec2 iC; // tongue: sideways offset (m) and lean
  uniform float time, fogNear, fogFar; uniform vec3 wind;
  varying vec2 vUv; varying float vSeed, vType, vK, vFog;
  void main(){
    vec3 base = iA.xyz; float seed = iA.w, type = iB.z; vUv = uv; vSeed = seed; vType = type; vK = iB.w;
    vec3 wp; vec2 q = position.xy; // the quad: x -0.5..0.5, y 0..1
    if (type < 1.5) {
      vec3 toCam = cameraPosition - base; float dc = length(toCam);
      vec3 f = toCam / max(dc, 1e-3);
      vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), f + vec3(1e-4, 0.0, 0.0)));
      if (type < 0.5) {
        // a flame tongue stands upright, turned to the camera; it flickers taller and shorter and its tip licks sideways
        vec3 up = vec3(0.0, 1.0, 0.0);
        float fl = 1.0 + 0.16 * sin(time * 9.0 + seed * 13.0) + 0.1 * sin(time * 15.7 + seed * 5.0) + 0.07 * sin(time * 23.0 + seed * 2.0);
        float h = iB.y * fl, y2 = q.y * q.y;
        float sway = (sin(time * 3.1 + seed * 6.0) * 0.07 + sin(time * 6.3 + seed * 3.0) * 0.045) * y2 * h;
        vec3 o = base + right * iC.x + f * 0.03 * (fract(seed * 7.13) - 0.5);
        wp = o + right * (q.x * iB.x * (1.0 - q.y * 0.15) + sway + iC.y * y2 * h) + up * (q.y * h) + wind * y2 * h;
      } else {
        // the glow: a sphere-facing quad centred on the flames, pulled a little toward the camera so the logs don't cut it
        vec3 up = cross(f, right);
        wp = base + f * min(0.6, dc * 0.3) + right * q.x * iB.x + up * (q.y - 0.5) * iB.x;
      }
    } else {
      wp = base + vec3(q.x * iB.x, 0.0, (q.y - 0.5) * iB.x); // flat on the ground
    }
    vec4 mv = viewMatrix * vec4(wp, 1.0); gl_Position = projectionMatrix * mv;
    vFog = 1.0 - smoothstep(fogNear, fogFar, -mv.z);
  }`;
const FRAG = `
  uniform float time, night;
  varying vec2 vUv; varying float vSeed, vType, vK, vFog;
  float hs(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hs(i), hs(i + vec2(1, 0)), f.x), mix(hs(i + vec2(0, 1)), hs(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p){ return vn(p) * 0.55 + vn(p * 2.1 + 7.3) * 0.3 + vn(p * 4.3 + 3.1) * 0.15; }
  void main(){
    vec3 col; float a;
    float fl = 0.85 + 0.1 * sin(time * 11.0 + vSeed * 9.0) + 0.06 * sin(time * 27.0 + vSeed * 3.0);
    if (vType < 0.5) {
      float y = vUv.y;
      // the flame body: noise scrolling upward erodes a teardrop; the top breaks into licks that tear off
      float n = fbm(vec2(vUv.x * 2.3 + vSeed * 17.0, y * 1.7 - time * 2.1 - vSeed * 3.0));
      float n2 = vn(vec2(vUv.x * 5.0 - vSeed * 11.0, y * 3.4 - time * 3.6));
      float x = (vUv.x - 0.5) * 2.0 + (n - 0.5) * 0.65 * y + (n2 - 0.5) * 0.18 * y;
      float hw = sin(3.14159 * pow(clamp(y, 0.0, 1.0), 0.6)) + 0.02;
      float f = (1.0 - abs(x) / hw) * (1.05 - y * 0.75);
      f -= (n * 0.55 + n2 * 0.25) * (0.15 + y * 0.85) - 0.12;
      f *= smoothstep(0.0, 0.06, y);
      // painted bands, soft-edged: red tips, orange body, yellow, a white-hot heart low down
      vec3 red = vec3(0.62, 0.07, 0.015), orange = vec3(1.15, 0.36, 0.05), yellow = vec3(1.45, 0.88, 0.2), white = vec3(1.7, 1.45, 0.9);
      col = mix(red, orange, smoothstep(0.14, 0.2, f));
      col = mix(col, yellow, smoothstep(0.4, 0.45, f));
      col = mix(col, white, smoothstep(0.58, 0.64, f) * (1.0 - y));
      a = smoothstep(0.02, 0.06, f) * (0.55 + 0.45 * smoothstep(0.1, 0.2, f));
      a *= mix(0.92, 1.0, night);
    } else if (vType < 1.5) {
      vec2 d = vUv - 0.5; float r = length(d) * 2.0;
      a = pow(max(0.0, 1.0 - r), 2.2) * 0.22 * fl * mix(0.45, 1.0, night);
      col = vec3(1.5, 0.6, 0.18);
    } else if (vType < 2.5) {
      vec2 d = vUv - 0.5; float r = length(d) * 2.0;
      a = pow(max(0.0, 1.0 - r), 1.8) * fl * mix(0.1, 0.4, night);
      col = vec3(1.0, 0.42, 0.12);
    } else {
      // coals: glowing cracks that breathe brighter and dimmer
      vec2 d = vUv - 0.5; float r = length(d) * 2.0;
      vec2 p = d * 7.0 + vSeed * 13.0;
      float c = vn(p) * 0.6 + vn(p * 2.3) * 0.4;
      float pulse = 0.55 + 0.45 * sin(time * 1.7 + c * 9.0 + vSeed * 4.0);
      float hot = smoothstep(0.45, 0.85, c) * pulse;
      a = (hot * 0.9 + 0.25) * smoothstep(1.0, 0.45, r);
      col = mix(vec3(0.9, 0.12, 0.02), vec3(2.2, 0.9, 0.2), hot);
    }
    a *= vK * vFog;
    if (a < 0.003) discard;
    gl_FragColor = vec4(col * a, vType < 0.5 ? a * 0.75 : 0.0);
  }`;

const quad = (() => { const g = new THREE.PlaneGeometry(1, 1, 1, 4); g.translate(0, 0.5, 0); return g; })();
export const FireFX = {
  mesh: null, mat: null, list: null, n: 0, built: -1, tmp: new THREE.Vector3(),
  init(scene) {
    this.scene = scene;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, night: { value: 0 }, wind: { value: new THREE.Vector3(0.05, 0, 0.03) }, fogNear: { value: 150 }, fogFar: { value: 900 } },
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquation: THREE.AddEquation, // (premultiplied: flames partly cover what is behind them so they keep their colour instead of adding up to white; glows add)
    });
  },
  // (re)build the instances when the fire list changes; fires are static once placed
  build(fires0, torches) {
    if (this.mesh) { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh = null; }
    this.built = fires0.length; this.builtT = torches ? torches.length : 0; const low = settings.quality === 'low';
    const fires = torches ? fires0.concat(torches) : fires0;
    const A = [], B = [], Cc = [];
    const push = (p, seed, w, h, type, k, ox = 0, lean = 0) => { A.push(p.x, p.y, p.z, seed); B.push(w, h, type, k); Cc.push(ox, lean); };
    fires.forEach((f, fi) => {
      if (!(f.size > 0)) return; // (lava pools: light only)
      const s = f.size, p = f.pos, s0 = fi * 1.618;
      const ground = p.clone(); ground.y -= 0.42 * Math.min(1.4, s);
      if (!f.bowl && !f.torch) push(ground.clone().setY(ground.y + 0.04), s0 + 0.3, 4.6 * s, 0, 2, 1); // warm light on the ground
      if (!f.torch) push(ground.clone().setY(ground.y + 0.1), s0 + 0.7, (f.bowl ? 1.6 : 1.25) * s, 0, 3, 1); // the coal bed
      // the tongues: a tall one in the middle, a ring of shorter ones that lean out, little licks at the edge (a torch: three)
      const N = f.torch ? 3 : low ? 4 : 7;
      for (let i = 0; i < N; i++) { const t = i / N, mid = i === 0, ring = i > 0 && i < (low ? 4 : 5);
        const ox = mid ? 0 : (ring ? 1 : 1.6) * 0.17 * s * Math.cos(i * 2.4 + s0), base = p.clone(); base.y -= 0.32 * s; base.x += mid ? 0 : Math.sin(i * 2.4 + s0) * 0.12 * s; base.z += mid ? 0 : Math.cos(i * 3.1 + s0) * 0.12 * s;
        const h = (mid ? 1.75 : ring ? 1.1 + 0.3 * Math.sin(i * 7.1) : 0.65) * s, w = (mid ? 0.85 : ring ? 0.62 : 0.38) * s;
        push(base, s0 + i * 3.7 + 0.1, w, h, 0, mid ? 0.8 : 0.6, ox, mid ? 0 : Math.sign(ox) * 0.08); void t; }
      push(p.clone().setY(p.y + 0.15 * s), s0 + 0.5, 3.4 * s, 0, 1, 1);                 // the glow
    });
    this.n = A.length / 4; if (!this.n) return;
    const g = new THREE.InstancedBufferGeometry(); g.index = quad.index; g.attributes.position = quad.attributes.position; g.attributes.uv = quad.attributes.uv;
    g.setAttribute('iA', new THREE.InstancedBufferAttribute(new Float32Array(A), 4)); g.setAttribute('iB', new THREE.InstancedBufferAttribute(new Float32Array(B), 4)); g.setAttribute('iC', new THREE.InstancedBufferAttribute(new Float32Array(Cc), 2));
    g.instanceCount = this.n;
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 8; this.scene.add(this.mesh);
  },
  // the flicker the fire's real light follows (i: which fire)
  flicker(i, t) { return 0.82 + Math.sin(t * 9 + i) * 0.07 + Math.sin(t * 15.7 + i * 2.3) * 0.05 + Math.sin(t * 23 + i * 1.3) * 0.04 + Math.sin(t * 2.3 + i) * 0.05; },
  // fires: world.fires (campfires, fire pits, bonfires, braziers); near: [{ f, d }] of those near the camera, nearest first;
  // torches (optional): wall torches, drawn the same way but smaller, with no coals, ground light or real light
  update(dt, fires, near, time, night, fog, torches, cam) {
    if (!this.mat) return;
    if (fires.length !== this.built || (torches ? torches.length : 0) !== (this.builtT || 0)) this.build(fires, torches);
    const u = this.mat.uniforms; u.time.value = time; u.night.value = night || 0; if (fog) { u.fogNear.value = fog.near; u.fogFar.value = fog.far * 1.1; }
    u.wind.value.set(0.06 + Math.sin(time * 0.37) * 0.05, 0, 0.04 + Math.sin(time * 0.29 + 1) * 0.04);
    // embers, sparks and smoke for the near fires
    const low = settings.quality === 'low', K = low ? 0.5 : 1;
    for (const e of near) { const f = e.f, s = f.size; if (!(s > 0)) continue;
      const lod = e.d < 25 ? 1 : e.d < 50 ? 0.5 : 0.2;
      f.acc = (f.acc || 0) + dt * 7 * s * K * lod;
      while (f.acc > 1) { f.acc--; this.ember(f, s, u.wind.value); }
      f.sacc = (f.sacc || 0) + dt * 3.2 * Math.sqrt(s) * K * lod;
      while (f.sacc > 1) { f.sacc--; this.smoke(f, s, night, u.wind.value); }
      if (e.d < 30 && Math.random() < dt * 0.5 * K) for (let i = 0; i < 10 * s; i++) this.ember(f, s, u.wind.value, 2.2); // a log shifts: a little burst of sparks
    }
    if (torches && cam) for (const f of torches) { if (Math.abs(f.pos.x - cam.x) > 30 || Math.abs(f.pos.z - cam.z) > 30) continue; f.acc = (f.acc || 0) + dt * 2.5 * K; while (f.acc > 1) { f.acc--; this.ember(f, f.size, u.wind.value, 0.7); } }
  },
  ember(f, s, w, kick = 1) {
    const p = f.pos, r = 0.25 * s, a = Math.random() * 6.283, life = 0.7 + Math.random() * 1.3;
    V.add.spawn(p.x + Math.cos(a) * r * Math.random(), p.y - 0.1 * s + Math.random() * 0.4 * s, p.z + Math.sin(a) * r * Math.random(),
      (Math.random() - 0.5) * 0.9 * kick + w.x * 6, (1.6 + Math.random() * 2.2) * Math.sqrt(s) * kick, (Math.random() - 0.5) * 0.9 * kick + w.z * 6,
      life, 0.03 + Math.random() * 0.035, 0.01, EMB0, EMB1, 1, 0, -0.35, 0.55);
  },
  smoke(f, s, night, w) {
    const p = f.pos, d = Math.max(0.25, 1 - (night || 0) * 0.65);
    S0.setRGB(0.62 * d, 0.6 * d, 0.57 * d); S1.setRGB(0.45 * d, 0.44 * d, 0.44 * d);
    V.norm.spawn(p.x + (Math.random() - 0.5) * 0.3 * s, p.y + 1.1 * s, p.z + (Math.random() - 0.5) * 0.3 * s, (Math.random() - 0.5) * 0.25 + w.x * 8, 0.8 + Math.random() * 0.5, (Math.random() - 0.5) * 0.25 + w.z * 8,
      3.5 + Math.random() * 2, 0.5 * s, 3.0 * s, S0, S1, 0.38, 0, -0.08, 0.15);
  },
};
const EMB0 = new THREE.Color(2.2, 1.2, 0.35), EMB1 = new THREE.Color(1.4, 0.2, 0.02), S0 = new THREE.Color(), S1 = new THREE.Color();
