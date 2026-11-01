// Visual effects: GPU point particles, weapon trails, shockwaves, flashes, dynamic lights, floating damage numbers.
import * as THREE from 'three';
import { settings } from './saves.js';

const MAX = 9000;
class Particles {
  constructor(scene, additive) {
    this.n = 0;
    this.pos = new Float32Array(MAX * 3); this.col = new Float32Array(MAX * 4); this.size = new Float32Array(MAX);
    this.vel = new Float32Array(MAX * 3); this.life = new Float32Array(MAX); this.max = new Float32Array(MAX);
    this.s0 = new Float32Array(MAX); this.s1 = new Float32Array(MAX); this.c0 = new Float32Array(MAX * 4); this.c1 = new Float32Array(MAX * 4);
    this.grav = new Float32Array(MAX); this.drag = new Float32Array(MAX);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos); g.setAttribute('color', this.aCol); g.setAttribute('size', this.aSize);
    const mat = new THREE.ShaderMaterial({
      uniforms: { scale: { value: 600 } }, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `attribute float size; attribute vec4 color; varying vec4 vC; uniform float scale;
        void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec4 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); if (r > 0.5) discard; float a = smoothstep(0.5, 0.0, r); gl_FragColor = vec4(vC.rgb, vC.a * a); }`,
    });
    this.mat = mat;
    this.pts = new THREE.Points(g, mat); this.pts.frustumCulled = false; this.pts.renderOrder = additive ? 10 : 9;
    scene.add(this.pts);
  }
  spawn(x, y, z, vx, vy, vz, life, s0, s1, c0, c1, a0 = 1, a1 = 0, grav = 0, drag = 0) {
    if (this.n >= MAX) return;
    const i = this.n++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.max[i] = life; this.s0[i] = s0; this.s1[i] = s1;
    this.c0[i * 4] = c0.r; this.c0[i * 4 + 1] = c0.g; this.c0[i * 4 + 2] = c0.b; this.c0[i * 4 + 3] = a0;
    this.c1[i * 4] = c1.r; this.c1[i * 4 + 1] = c1.g; this.c1[i * 4 + 2] = c1.b; this.c1[i * 4 + 3] = a1;
    this.grav[i] = grav; this.drag[i] = drag;
  }
  update(dt) {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.copy(this.n - 1, i); this.n--; continue; }
      const t = 1 - this.life[i] / this.max[i];
      const dr = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= dr; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * dr - this.grav[i] * dt; this.vel[i * 3 + 2] *= dr;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      for (let k = 0; k < 4; k++) this.col[i * 4 + k] = this.c0[i * 4 + k] + (this.c1[i * 4 + k] - this.c0[i * 4 + k]) * t;
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
      i++;
    }
    this.pts.geometry.setDrawRange(0, this.n);
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = true;
  }
  copy(a, b) {
    for (let k = 0; k < 3; k++) { this.pos[b * 3 + k] = this.pos[a * 3 + k]; this.vel[b * 3 + k] = this.vel[a * 3 + k]; }
    for (let k = 0; k < 4; k++) { this.col[b * 4 + k] = this.col[a * 4 + k]; this.c0[b * 4 + k] = this.c0[a * 4 + k]; this.c1[b * 4 + k] = this.c1[a * 4 + k]; }
    this.life[b] = this.life[a]; this.max[b] = this.max[a]; this.s0[b] = this.s0[a]; this.s1[b] = this.s1[a]; this.size[b] = this.size[a]; this.grav[b] = this.grav[a]; this.drag[b] = this.drag[a];
  }
}

// ---- weapon trail ribbon ----
class Trail {
  constructor(scene, color) {
    this.n = 18; this.pts = [];
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.n * 2 * 3); this.alpha = new Float32Array(this.n * 2);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    const idx = []; for (let i = 0; i < this.n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } g.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({ uniforms: { color: { value: new THREE.Color(color) }, op: { value: 1 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: `uniform vec3 color; uniform float op; varying float vA; void main(){ gl_FragColor = vec4(color, vA*op*0.55); }` });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 11; scene.add(this.mesh);
    this.active = false; this.fade = 0;
  }
  push(a, b) {
    this.pts.unshift([a.clone(), b.clone()]); if (this.pts.length > this.n) this.pts.pop();
  }
  update(dt) {
    if (!this.active) { this.fade -= dt * 5; if (this.fade <= 0) { this.pts.length = 0; this.mesh.visible = false; return; } if (this.pts.length > 2) this.pts.pop(); }
    else this.fade = 1;
    this.mesh.visible = this.pts.length > 1;
    const L = this.pts.length;
    for (let i = 0; i < this.n; i++) {
      const p = this.pts[Math.min(i, L - 1)] || [new THREE.Vector3(), new THREE.Vector3()];
      this.pos.set([p[0].x, p[0].y, p[0].z], i * 6); this.pos.set([p[1].x, p[1].y, p[1].z], i * 6 + 3);
      const a = i < L ? (1 - i / L) * this.fade : 0; this.alpha[i * 2] = a * 0.2; this.alpha[i * 2 + 1] = a;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true; this.mesh.geometry.attributes.alpha.needsUpdate = true;
  }
}

const C = (h) => new THREE.Color(h);
const PAL = {
  fire: [C('#ffe08a'), C('#ff4a10')], ember: [C('#ffb040'), C('#ff2000')], smoke: [C('#5a5450'), C('#2a2828')], frost: [C('#e8fbff'), C('#4ab8ff')], arcane: [C('#ffd0ff'), C('#8a30ff')],
  blood: [C('#c01818'), C('#5a0808')], dust: [C('#b8a888'), C('#8a7a60')], spark: [C('#fff8d0'), C('#ffa020')], heal: [C('#d0ffd0'), C('#40ff60')], lightning: [C('#ffffff'), C('#80b0ff')],
  leaf: [C('#6aa040'), C('#4a7030')], wood: [C('#a07a4a'), C('#6a4a2a')], stone: [C('#a09890'), C('#6a6460')], cotton: [C('#ffffff'), C('#e8e8e0')], gold: [C('#fff0a0'), C('#ffb020')],
  shadow: [C('#404050'), C('#101018')], water: [C('#e8f8ff'), C('#80c0e0')], lava: [C('#ffd060'), C('#ff3000')], bone: [C('#f0e8d0'), C('#a8a090')], green: [C('#c8ff8a'), C('#40c040')],
};

export const V = {
  add: null, norm: null, trails: [], rings: [], lights: [], flashes: [], numbers: [], shake: 0, scene: null, camera: null, decals: [], meshes: [],
  init(scene, camera) {
    this.scene = scene; this.camera = camera;
    this.add = new Particles(scene, true); this.norm = new Particles(scene, false);
    for (let i = 0; i < 4; i++) { const l = new THREE.PointLight('#ff8030', 0, 18, 2); l.userData.t = 0; scene.add(l); this.lights.push(l); }
    this.numLayer = document.getElementById('dmgLayer');
    const ringMat = new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    this.ringGeo = new THREE.RingGeometry(0.85, 1, 48).rotateX(-Math.PI / 2);
    this.ringMat = ringMat;
    this.sphereGeo = new THREE.SphereGeometry(1, 20, 14);
  },
  setScale(h) { this.add.mat.uniforms.scale.value = h * 0.9; this.norm.mat.uniforms.scale.value = h * 0.9; },
  trail(color) { const t = new Trail(this.scene, color); this.trails.push(t); return t; },
  burst(kind, p, n = 20, opt = {}) {
    const pal = PAL[kind] || PAL.spark, sp = opt.speed ?? 4, life = opt.life ?? 0.6, sz = opt.size ?? 0.3, up = opt.up ?? 1;
    const sys = opt.normal || kind === 'smoke' || kind === 'dust' || kind === 'blood' || kind === 'wood' || kind === 'stone' || kind === 'leaf' || kind === 'cotton' || kind === 'shadow' || kind === 'bone' ? this.norm : this.add;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.3) * Math.PI;
      const s = sp * (0.3 + Math.random() * 0.7);
      let vx = Math.cos(a) * Math.cos(e) * s, vy = Math.abs(Math.sin(e)) * s * up + (opt.vy || 0), vz = Math.sin(a) * Math.cos(e) * s;
      if (opt.dir) { vx = vx * 0.4 + opt.dir.x * s; vy = vy * 0.4 + opt.dir.y * s; vz = vz * 0.4 + opt.dir.z * s; }
      const r = opt.radius || 0;
      sys.spawn(p.x + (Math.random() - 0.5) * r, p.y + (Math.random() - 0.5) * r * 0.5, p.z + (Math.random() - 0.5) * r, vx, vy, vz, life * (0.6 + Math.random() * 0.6), sz * (0.6 + Math.random() * 0.8), (opt.size1 ?? sz * 0.2), pal[0], pal[1], opt.a0 ?? 1, 0, opt.grav ?? (sys === this.norm ? 9 : 0), opt.drag ?? 1.5);
    }
  },
  emit(kind, p, opt = {}) { this.burst(kind, p, opt.n || 1, opt); },
  ring(p, radius, color = '#ffb060', dur = 0.5, y = 0.15) {
    const m = new THREE.Mesh(this.ringGeo, this.ringMat.clone()); m.material.color.set(color);
    m.position.set(p.x, p.y + y, p.z); m.scale.setScalar(0.1); this.scene.add(m);
    this.rings.push({ m, r: radius, t: 0, dur });
  },
  sphereFlash(p, radius, color, dur = 0.35) {
    const m = new THREE.Mesh(this.sphereGeo, new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.position.copy(p); m.scale.setScalar(radius * 0.3); this.scene.add(m);
    this.flashes.push({ m, r: radius, t: 0, dur });
  },
  light(p, color, intensity = 4, dur = 0.3, range = 18) {
    let best = this.lights[0];
    for (const l of this.lights) if (l.userData.t <= 0) { best = l; break; } else if (l.userData.t < best.userData.t) best = l;
    best.position.copy(p); best.color.set(color); best.userData.i = intensity; best.userData.t = dur; best.userData.dur = dur; best.distance = range; best.intensity = intensity;
  },
  number(p, text, kind = 'dmg') {
    if (!settings.dmgNumbers || !this.numLayer) return;
    const el = document.createElement('div'); el.className = 'dnum ' + kind; el.textContent = text; this.numLayer.appendChild(el);
    this.numbers.push({ el, p: p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6)), t: 0, vx: (Math.random() - 0.5) * 30 });
  },
  addShake(a) { this.shake = Math.min(1.2, this.shake + a); },
  temp(mesh, dur, update) { this.scene.add(mesh); this.meshes.push({ mesh, t: 0, dur, update }); },
  update(dt) {
    this.add.update(dt); this.norm.update(dt);
    for (const t of this.trails) t.update(dt);
    for (let i = this.rings.length - 1; i >= 0; i--) { const r = this.rings[i]; r.t += dt; const k = r.t / r.dur; r.m.scale.setScalar(0.1 + r.r * (1 - Math.pow(1 - k, 3))); r.m.material.opacity = 1 - k; if (k >= 1) { this.scene.remove(r.m); r.m.material.dispose(); this.rings.splice(i, 1); } }
    for (let i = this.flashes.length - 1; i >= 0; i--) { const f = this.flashes[i]; f.t += dt; const k = f.t / f.dur; f.m.scale.setScalar(f.r * (0.3 + 0.7 * Math.sqrt(k))); f.m.material.opacity = (1 - k) * 0.8; if (k >= 1) { this.scene.remove(f.m); f.m.material.dispose(); this.flashes.splice(i, 1); } }
    for (const l of this.lights) if (l.userData.t > 0) { l.userData.t -= dt; l.intensity = Math.max(0, l.userData.i * (l.userData.t / l.userData.dur)); if (l.userData.t <= 0) l.intensity = 0; }
    for (let i = this.meshes.length - 1; i >= 0; i--) { const o = this.meshes[i]; o.t += dt; if (o.update) o.update(o.mesh, o.t / o.dur, dt); if (o.t >= o.dur) { this.scene.remove(o.mesh); this.meshes.splice(i, 1); } }
    this.shake = Math.max(0, this.shake - dt * 2.2);
  },
  updateNumbers(dt, camera, w, h) {
    const v = new THREE.Vector3();
    for (let i = this.numbers.length - 1; i >= 0; i--) {
      const n = this.numbers[i]; n.t += dt;
      if (n.t > 1.1) { n.el.remove(); this.numbers.splice(i, 1); continue; }
      v.copy(n.p); v.y += n.t * 1.6; v.project(camera);
      if (v.z > 1) { n.el.style.display = 'none'; continue; }
      n.el.style.display = '';
      const x = (v.x * 0.5 + 0.5) * w + n.vx * n.t, y = (-v.y * 0.5 + 0.5) * h;
      n.el.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%) scale(${n.t < 0.12 ? 0.6 + n.t * 5 : 1.2 - n.t * 0.3})`;
      n.el.style.opacity = n.t > 0.7 ? (1.1 - n.t) / 0.4 : 1;
    }
  },
  // ambient fire at a spot (campfires, braziers, forge)
  fireTick(f, dt, near) {
    if (!near) return;
    f.acc = (f.acc || 0) + dt * (f.size > 0 ? 28 * f.size : 6);
    while (f.acc > 1) {
      f.acc--;
      const s = f.size || 0.6;
      this.add.spawn(f.pos.x + (Math.random() - 0.5) * 0.4 * s, f.pos.y, f.pos.z + (Math.random() - 0.5) * 0.4 * s, (Math.random() - 0.5) * 0.3, 1.2 + Math.random() * 1.4 * s, (Math.random() - 0.5) * 0.3, 0.5 + Math.random() * 0.4, 0.55 * s + 0.15, 0.08, PAL.fire[0], PAL.fire[1], 1, 0, -0.5, 0.5);
      if (Math.random() < 0.12) this.add.spawn(f.pos.x, f.pos.y + 0.3, f.pos.z, (Math.random() - 0.5) * 1, 2 + Math.random() * 2, (Math.random() - 0.5) * 1, 1.5, 0.06, 0.02, PAL.ember[0], PAL.ember[1], 1, 0, -0.2, 0.3);
      if (Math.random() < 0.15 && f.size > 0) this.norm.spawn(f.pos.x, f.pos.y + 1, f.pos.z, (Math.random() - 0.5) * 0.3, 1.0, (Math.random() - 0.5) * 0.3, 3, 0.4, 1.8, PAL.smoke[0], PAL.smoke[1], 0.25, 0, -0.1, 0.2);
    }
  },
};
export { PAL };
