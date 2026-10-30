// Aeternum Wilds: pooled mesh effects that particles can't do well.
//  decal()      terrain-hugging ground marks: cracks, scorches, splats, frost, magic circles and shock rings
//  wall()       an expanding vertical shock band (reads on slopes where a flat ring would sink)
//  orb()        fresnel spheres: domes, flashes, shields
//  beam()       columns of light / flame with scrolling streaks
//  bolt()       lightning arcs and curling tendrils as camera-facing ribbons
// Everything uses premultiplied blending (rgb adds light, alpha covers) and is recycled, never re-created.
import * as THREE from 'three';
import { G } from '../../state.js';
import { heightAt } from '../../world.js';

const PREMUL = { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor };
const OUT = `
    #include <tonemapping_fragment>
    #include <colorspace_fragment>`;
const linHex = (hex, k = 1, out = new THREE.Vector3()) => { const c = new THREE.Color(hex); return out.set(c.r * k, c.g * k, c.b * k); };
export const ambient = { value: new THREE.Vector3(1, 1, 1) };

// ---------------- decal atlas (2x2: crack, scorch, circle, splat) ----------------
// alpha = what it covers (dark matter), red = what glows
export const DECAL = { crack: 0, scorch: 1, circle: 2, splat: 3, ring: -1 };
let decalTex = null;
function makeDecalTex() {
  const S = 256, W = S * 2;
  const cov = document.createElement('canvas'); cov.width = cov.height = W;
  const glo = document.createElement('canvas'); glo.width = glo.height = W;
  const gc = cov.getContext('2d'), gg = glo.getContext('2d');
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const at = (g, i, fn) => { g.save(); g.translate((i % 2) * S, Math.floor(i / 2) * S); g.beginPath(); g.rect(0, 0, S, S); g.clip(); fn(g); g.restore(); };
  const rg = (g, x, y, r, stops) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); for (const [k, a] of stops) gr.addColorStop(k, `rgba(255,255,255,${a})`); return gr; };
  // crack: jagged fissures branching out from the centre, with a crater stain
  const cracks = [];
  for (let k = 0; k < 9; k++) {
    let a = k / 9 * 6.283 + rnd() * 0.5, x = 128, y = 128, w = 9;
    const pts = [[x, y]];
    const L = 70 + rnd() * 50;
    for (let s = 0; s < 9; s++) { a += (rnd() - 0.5) * 0.7; x += Math.cos(a) * L / 9; y += Math.sin(a) * L / 9; pts.push([x, y]); }
    cracks.push({ pts, w });
    if (rnd() < 0.7) { const j = 3 + ((rnd() * 4) | 0), [bx, by] = pts[j]; let ba = a + (rnd() < 0.5 ? 0.9 : -0.9), cx = bx, cy = by; const bp = [[bx, by]]; for (let s = 0; s < 5; s++) { ba += (rnd() - 0.5) * 0.8; cx += Math.cos(ba) * 7; cy += Math.sin(ba) * 7; bp.push([cx, cy]); } cracks.push({ pts: bp, w: 4 }); }
  }
  const drawCracks = (g, wk, a) => { g.lineCap = 'round'; g.lineJoin = 'round'; for (const c of cracks) for (let s = 1; s < c.pts.length; s++) { g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = Math.max(1, c.w * wk * (1 - s / c.pts.length * 0.8)); g.beginPath(); g.moveTo(...c.pts[s - 1]); g.lineTo(...c.pts[s]); g.stroke(); } };
  at(gc, 0, (g) => { g.fillStyle = rg(g, 128, 128, 70, [[0, 0.55], [0.6, 0.25], [1, 0]]); g.fillRect(0, 0, S, S); drawCracks(g, 1, 0.95); });
  at(gg, 0, (g) => { g.fillStyle = rg(g, 128, 128, 40, [[0, 0.6], [1, 0]]); g.fillRect(0, 0, S, S); drawCracks(g, 0.45, 1); });
  // scorch: a burnt blotch with ember specks
  at(gc, 1, (g) => { for (let k = 0; k < 14; k++) { const a = rnd() * 6.283, r = rnd() * 50; g.fillStyle = rg(g, 128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 50 + rnd() * 40, [[0, 0.5], [0.7, 0.18], [1, 0]]); g.fillRect(0, 0, S, S); } });
  at(gg, 1, (g) => { for (let k = 0; k < 40; k++) { const a = rnd() * 6.283, r = Math.sqrt(rnd()) * 80; g.fillStyle = rg(g, 128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 2 + rnd() * 5, [[0, 1], [1, 0]]); g.fillRect(0, 0, S, S); } });
  // magic circle: concentric rings, a rune band, a star and ticks (glow only, a faint shadow under it)
  at(gg, 2, (g) => {
    g.translate(128, 128); g.strokeStyle = 'rgba(255,255,255,1)';
    const ring = (r, w) => { g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, 0, 6.283); g.stroke(); };
    ring(122, 3); ring(112, 1.5); ring(84, 2.5); ring(76, 1); ring(34, 2);
    for (let k = 0; k < 48; k++) { const a = k / 48 * 6.283; g.lineWidth = k % 4 ? 1 : 2.5; g.beginPath(); g.moveTo(Math.cos(a) * 112, Math.sin(a) * 112); g.lineTo(Math.cos(a) * (k % 4 ? 117 : 122), Math.sin(a) * (k % 4 ? 117 : 122)); g.stroke(); }
    // rune band: little made-up glyphs between the rings
    g.lineWidth = 2.2; g.lineCap = 'round';
    for (let k = 0; k < 16; k++) {
      g.save(); g.rotate(k / 16 * 6.283); g.translate(0, -98);
      const t = (k * 7) % 5; g.beginPath();
      if (t === 0) { g.moveTo(-5, -7); g.lineTo(0, 7); g.lineTo(5, -7); }
      else if (t === 1) { g.moveTo(0, -8); g.lineTo(0, 8); g.moveTo(-5, -2); g.lineTo(5, 2); }
      else if (t === 2) { g.arc(0, 0, 6, 0.4, 5.6); }
      else if (t === 3) { g.moveTo(-6, 6); g.lineTo(0, -7); g.lineTo(6, 6); g.closePath(); }
      else { g.moveTo(-6, -6); g.lineTo(6, 6); g.moveTo(6, -6); g.lineTo(-6, 6); }
      g.stroke(); g.restore();
    }
    // a six-point star of two triangles
    g.lineWidth = 2;
    for (let s = 0; s < 2; s++) { g.beginPath(); for (let k = 0; k <= 3; k++) { const a = k / 3 * 6.283 + s * Math.PI / 3 - Math.PI / 2; g[k ? 'lineTo' : 'moveTo'](Math.cos(a) * 76, Math.sin(a) * 76); } g.stroke(); }
    g.fillStyle = rg(g, 0, 0, 34, [[0, 0.7], [1, 0]]); g.beginPath(); g.arc(0, 0, 34, 0, 6.283); g.fill();
  });
  at(gc, 2, (g) => { g.fillStyle = rg(g, 128, 128, 126, [[0, 0.12], [0.85, 0.08], [1, 0]]); g.fillRect(0, 0, S, S); });
  // splat: an irregular puddle with droplets around it
  at(gc, 3, (g) => {
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath();
    for (let k = 0; k <= 24; k++) { const a = k / 24 * 6.283, r = 52 + rnd() * 34; g.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); }
    g.closePath(); g.fill();
    for (let k = 0; k < 18; k++) { const a = rnd() * 6.283, r = 92 + rnd() * 30; g.beginPath(); g.arc(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 2 + rnd() * 7, 0, 6.283); g.fill(); }
  });
  at(gg, 3, (g) => { g.fillStyle = rg(g, 128, 128, 60, [[0, 0.25], [1, 0]]); g.fillRect(0, 0, S, S); });
  // merge: glow into red, cover into alpha (green carries the cover too, for shading)
  const cd = gc.getImageData(0, 0, W, W).data, gd = gg.getImageData(0, 0, W, W).data;
  const out = gc.createImageData(W, W), o = out.data;
  for (let i = 0; i < o.length; i += 4) { o[i] = gd[i + 3]; o[i + 1] = cd[i + 3]; o[i + 2] = 0; o[i + 3] = 255; }
  const c = document.createElement('canvas'); c.width = c.height = W; c.getContext('2d').putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

const DECAL_VS = `varying vec2 vUv; varying float vFogDepth; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vFogDepth = -mv.z; gl_Position = projectionMatrix * mv; }`;
const DECAL_FS = `
  uniform sampler2D tDecal; uniform float uCell, uRot, uAlpha, uGlow, uK, uW; uniform vec3 uCol, uGlowCol, uAmb;
  uniform vec3 fogColor; uniform float fogNear, fogFar;
  varying vec2 vUv; varying float vFogDepth;
  void main(){
    vec2 p = vUv - 0.5;
    float c = cos(uRot), s = sin(uRot); p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
    float cover, glow;
    if (uCell < 0.0) {
      // procedural shock ring: a bright leading edge with a soft wake inside
      float r = length(p) * 2.0;
      float edge = smoothstep(uK - uW, uK, r) * (1.0 - smoothstep(uK, uK + 0.025, r));
      float wake = smoothstep(uK - uW * 3.0, uK, r) * step(r, uK) * 0.35;
      glow = edge + wake; cover = (edge * 0.25 + wake * 0.3);
    } else {
      vec2 uv = p + 0.5;
      if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) discard;
      vec2 cell = vec2(mod(uCell, 2.0), 1.0 - floor(uCell / 2.0)) * 0.5;
      vec4 t = texture2D(tDecal, uv * 0.5 + cell);
      cover = t.g; glow = t.r;
      // reveal: crack and circle grow out from the middle
      float rr = length(p) * 2.0;
      float rv = smoothstep(uK + 0.05, uK - 0.05, rr);
      cover *= rv; glow *= rv;
    }
    float fog = smoothstep(fogNear, fogFar, vFogDepth);
    cover *= uAlpha * (1.0 - fog); glow *= uGlow * (1.0 - fog);
    vec3 col = uCol * uAmb * cover + uGlowCol * glow;
    if (cover + glow < 0.003) discard;
    gl_FragColor = vec4(col, cover);
    ${OUT}
  }`;
const GN = 12;
const decals = [];
function newDecal() {
  const g = new THREE.PlaneGeometry(1, 1, GN, GN); g.rotateX(-Math.PI / 2);
  const base = g.attributes.position.array.slice();
  const m = new THREE.ShaderMaterial({
    ...PREMUL, depthTest: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    uniforms: {
      tDecal: { value: decalTex || (decalTex = makeDecalTex()) }, uCell: { value: 0 }, uRot: { value: 0 }, uAlpha: { value: 1 }, uGlow: { value: 0 }, uK: { value: 1 }, uW: { value: 0.1 },
      uCol: { value: new THREE.Vector3() }, uGlowCol: { value: new THREE.Vector3() }, uAmb: ambient,
      fogColor: { value: new THREE.Color() }, fogNear: { value: 1e5 }, fogFar: { value: 2e5 },
    },
    vertexShader: DECAL_VS, fragmentShader: DECAL_FS,
  });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 4; mesh.visible = false;
  G.scene.add(mesh);
  const d = { mesh, base, live: false };
  decals.push(d);
  return d;
}
function syncFog(u) { const f = G.scene?.fog; if (f) { u.fogColor.value.copy(f.color); u.fogNear.value = f.near; u.fogFar.value = f.far; } }
// lay the grid onto the terrain at (x,z), size metres across
function conform(d, x, z, size, lift) {
  const pos = d.mesh.geometry.attributes.position, a = pos.array, b = d.base;
  for (let i = 0; i < a.length; i += 3) {
    const lx = b[i] * size, lz = b[i + 2] * size;
    a[i] = lx; a[i + 2] = lz; a[i + 1] = heightAt(x + lx, z + lz) + lift;
  }
  pos.needsUpdate = true;
  d.mesh.position.set(x, 0, z);
}
// o: { cell, size, color, alpha, glow, glowColor, glowHdr, life, fadeIn, grow (reveal time), rot, spin, ring:{w} , lift }
export function decal(x, z, o) {
  if (!G.scene) return null;
  let d = decals.find((q) => !q.live);
  if (!d) { if (decals.length < 28) d = newDecal(); else d = decals.reduce((a, b) => (a.t / a.life > b.t / b.life ? a : b)); }
  conform(d, x, z, o.size, o.lift ?? 0.07);
  const u = d.mesh.material.uniforms;
  u.uCell.value = o.ring ? -1 : (o.cell ?? 0);
  linHex(o.color ?? 0x000000, 1, u.uCol.value);
  linHex(o.glowColor ?? 0xffffff, o.glowHdr ?? 2, u.uGlowCol.value);
  u.uW.value = o.ring?.w ?? 0.1;
  syncFog(u);
  Object.assign(d, { live: true, t: 0, life: o.life ?? 3, fadeIn: o.fadeIn ?? 0.05, grow: o.grow ?? 0, alpha: o.alpha ?? 0.8, glow: o.glow ?? 0, glowFade: o.glowFade ?? 0.35, rot: o.rot ?? Math.random() * 6.283, spin: o.spin ?? 0, ring: !!o.ring, pulse: o.pulse ?? 0 });
  d.mesh.visible = true;
  return d;
}
function updateDecals(dt) {
  for (const d of decals) {
    if (!d.live) continue;
    d.t += dt;
    if (d.t >= d.life) { d.live = false; d.mesh.visible = false; continue; }
    const u = d.mesh.material.uniforms, k = d.t / d.life;
    d.rot += d.spin * dt; u.uRot.value = d.rot;
    if (d.ring) {
      const e = 1 - Math.pow(1 - k, 2.2);
      u.uK.value = 0.06 + e * 0.92; u.uAlpha.value = d.alpha * (1 - k); u.uGlow.value = d.glow * Math.pow(1 - k, 1.4);
    } else {
      u.uK.value = d.grow > 0 ? Math.min(1.1, d.t / d.grow * 1.1) : 1.1;
      const fin = d.fadeIn > 0 ? Math.min(1, d.t / d.fadeIn) : 1, fout = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
      u.uAlpha.value = d.alpha * fin * fout;
      const pulse = d.pulse ? 0.75 + 0.25 * Math.sin(d.t * d.pulse) : 1;
      u.uGlow.value = d.glow * fin * pulse * (d.glowFade < 1 ? Math.max(0, 1 - d.t / (d.life * d.glowFade)) : fout);
    }
  }
}

// ---------------- vertical shock band ----------------
const WALL_FS = `
  uniform vec3 uCol; uniform float uA; varying vec2 vUv;
  void main(){ float h = vUv.y; float a = uA * pow(1.0 - h, 1.6) * smoothstep(0.0, 0.08, h); gl_FragColor = vec4(uCol * a, a * 0.15); ${OUT} }`;
const walls = [];
let wallGeo = null;
export function wall(x, y, z, r, color, dur = 0.4, height = 1.2, hdr = 2) {
  if (!G.scene) return;
  let w = walls.find((q) => !q.live);
  if (!w) {
    if (walls.length >= 10) w = walls.reduce((a, b) => (a.t / a.dur > b.t / b.dur ? a : b));
    else {
      wallGeo = wallGeo || new THREE.CylinderGeometry(1, 1, 1, 48, 1, true).translate(0, 0.5, 0);
      const m = new THREE.ShaderMaterial({ ...PREMUL, side: THREE.DoubleSide, uniforms: { uCol: { value: new THREE.Vector3() }, uA: { value: 1 } }, vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`, fragmentShader: WALL_FS });
      w = { mesh: new THREE.Mesh(wallGeo, m) }; w.mesh.frustumCulled = false; w.mesh.renderOrder = 9; G.scene.add(w.mesh); walls.push(w);
    }
  }
  linHex(color, hdr, w.mesh.material.uniforms.uCol.value);
  w.mesh.position.set(x, y - 0.2, z);
  Object.assign(w, { live: true, t: 0, dur, r, h: height });
  w.mesh.visible = true;
}
function updateWalls(dt) {
  for (const w of walls) {
    if (!w.live) continue;
    w.t += dt; const k = w.t / w.dur;
    if (k >= 1) { w.live = false; w.mesh.visible = false; continue; }
    const e = 1 - Math.pow(1 - k, 2.5);
    w.mesh.scale.set(0.2 + e * w.r, w.h * (1 - k * 0.6), 0.2 + e * w.r);
    w.mesh.material.uniforms.uA.value = (1 - k) * (k < 0.1 ? k / 0.1 : 1);
  }
}

// ---------------- fresnel orbs (domes, bursts, shields) ----------------
const ORB_VS = `varying vec3 vN; varying vec3 vV; void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`;
const ORB_FS = `
  uniform vec3 uCol, uCore; uniform float uA, uRim, uCover; varying vec3 vN; varying vec3 vV;
  void main(){ float f = 1.0 - abs(dot(normalize(vN), normalize(vV))); float rim = pow(f, uRim); float a = uA * (rim + 0.12);
    vec3 col = mix(uCore, uCol, rim) * a; gl_FragColor = vec4(col, a * uCover); ${OUT} }`;
const orbs = [];
let orbGeo = null;
// o: { color, core, hdr, dur, r0, r1, alpha, rim, cover, y1 (rise) }
export function orb(x, y, z, o) {
  if (!G.scene) return;
  let b = orbs.find((q) => !q.live);
  if (!b) {
    if (orbs.length >= 12) b = orbs.reduce((a, c) => (a.t / a.dur > c.t / c.dur ? a : c));
    else {
      orbGeo = orbGeo || new THREE.SphereGeometry(1, 28, 18);
      const m = new THREE.ShaderMaterial({ ...PREMUL, uniforms: { uCol: { value: new THREE.Vector3() }, uCore: { value: new THREE.Vector3() }, uA: { value: 1 }, uRim: { value: 2 }, uCover: { value: 0 } }, vertexShader: ORB_VS, fragmentShader: ORB_FS });
      b = { mesh: new THREE.Mesh(orbGeo, m) }; b.mesh.frustumCulled = false; b.mesh.renderOrder = 10; G.scene.add(b.mesh); orbs.push(b);
    }
  }
  const u = b.mesh.material.uniforms, hdr = o.hdr ?? 1.5;
  linHex(o.color, hdr, u.uCol.value); linHex(o.core ?? o.color, hdr * 0.4, u.uCore.value);
  u.uRim.value = o.rim ?? 2; u.uCover.value = o.cover ?? 0;
  b.mesh.position.set(x, y, z);
  Object.assign(b, { live: true, t: 0, dur: o.dur ?? 0.45, r0: o.r0 ?? 0.3, r1: o.r1 ?? 2, a: o.alpha ?? 0.8, y0: y, rise: o.rise ?? 0, flat: o.flat ?? 1 });
  b.mesh.visible = true;
}
function updateOrbs(dt) {
  for (const b of orbs) {
    if (!b.live) continue;
    b.t += dt; const k = b.t / b.dur;
    if (k >= 1) { b.live = false; b.mesh.visible = false; continue; }
    const e = 1 - Math.pow(1 - k, 3), r = b.r0 + (b.r1 - b.r0) * e;
    b.mesh.scale.set(r, r * b.flat, r);
    b.mesh.position.y = b.y0 + b.rise * e;
    b.mesh.material.uniforms.uA.value = b.a * (1 - k) * (k < 0.08 ? k / 0.08 : 1);
  }
}

// ---------------- beams (holy pillars, flame columns) ----------------
const BEAM_VS = `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`;
const BEAM_FS = `
  uniform vec3 uCol, uCore; uniform float uA, uT; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
  void main(){
    float facing = abs(dot(normalize(vN), normalize(vV)));
    float core = pow(facing, 2.5);
    float streak = 0.55 + 0.45 * sin(vUv.x * 62.83 + sin(vUv.x * 18.0) * 2.0) * sin(vUv.y * 6.0 - uT * 9.0 + vUv.x * 31.0);
    float h = vUv.y;
    float a = uA * (0.25 + core * 0.9) * streak * smoothstep(1.0, 0.55, h) * smoothstep(0.0, 0.05, h);
    vec3 col = mix(uCol, uCore, core) * a;
    gl_FragColor = vec4(col, 0.0); ${OUT} }`;
const beams = [];
let beamGeo = null;
export function beam(x, y, z, r, height, color, dur = 0.8, core = 0xffffff, hdr = 2.5) {
  if (!G.scene) return;
  let b = beams.find((q) => !q.live);
  if (!b) {
    if (beams.length >= 6) b = beams.reduce((a, c) => (a.t / a.dur > c.t / c.dur ? a : c));
    else {
      beamGeo = beamGeo || new THREE.CylinderGeometry(0.75, 1, 1, 32, 1, true).translate(0, 0.5, 0);
      const m = new THREE.ShaderMaterial({ ...PREMUL, side: THREE.DoubleSide, uniforms: { uCol: { value: new THREE.Vector3() }, uCore: { value: new THREE.Vector3() }, uA: { value: 1 }, uT: { value: 0 } }, vertexShader: BEAM_VS, fragmentShader: BEAM_FS });
      b = { mesh: new THREE.Mesh(beamGeo, m) }; b.mesh.frustumCulled = false; b.mesh.renderOrder = 11; G.scene.add(b.mesh); beams.push(b);
    }
  }
  const u = b.mesh.material.uniforms;
  linHex(color, hdr, u.uCol.value); linHex(core, hdr * 1.3, u.uCore.value);
  b.mesh.position.set(x, y, z);
  Object.assign(b, { live: true, t: 0, dur, r, h: height });
  b.mesh.visible = true;
}
function updateBeams(dt) {
  for (const b of beams) {
    if (!b.live) continue;
    b.t += dt; const k = b.t / b.dur;
    if (k >= 1) { b.live = false; b.mesh.visible = false; continue; }
    const open = k < 0.12 ? k / 0.12 : 1;
    const w = b.r * (k < 0.12 ? 0.35 + open * 0.65 : 1 - (k - 0.12) * 0.75);
    b.mesh.scale.set(w, b.h * (0.6 + open * 0.4), w);
    const u = b.mesh.material.uniforms; u.uT.value = b.t; u.uA.value = open * Math.pow(1 - k, 1.3);
  }
}

// ---------------- bolts and tendrils ----------------
const BOLT_N = 28;
const BOLT_VS = `attribute float aU; attribute float aS; varying float vU; varying float vS; void main(){ vU = aU; vS = aS; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const BOLT_FS = `
  uniform vec3 uCol, uCore; uniform float uA, uGrow, uCover; varying float vU; varying float vS;
  void main(){
    if (vU > uGrow) discard;
    float x = abs(vS);
    float core = pow(1.0 - x, 6.0), body = pow(1.0 - x, 2.0);
    float tip = smoothstep(uGrow, uGrow - 0.15, vU);
    float a = uA * body * tip;
    vec3 col = (uCol * body + uCore * core) * uA * tip;
    gl_FragColor = vec4(col, a * uCover); ${OUT} }`;
const bolts = [];
const _v = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _s = new THREE.Vector3();
function newBolt() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(BOLT_N * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
  const au = new Float32Array(BOLT_N * 2), as = new Float32Array(BOLT_N * 2);
  for (let i = 0; i < BOLT_N; i++) { as[i * 2] = -1; as[i * 2 + 1] = 1; }
  g.setAttribute('aU', new THREE.BufferAttribute(au, 1).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('aS', new THREE.BufferAttribute(as, 1));
  const idx = []; for (let i = 0; i < BOLT_N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } g.setIndex(idx);
  const m = new THREE.ShaderMaterial({ ...PREMUL, side: THREE.DoubleSide, uniforms: { uCol: { value: new THREE.Vector3() }, uCore: { value: new THREE.Vector3() }, uA: { value: 1 }, uGrow: { value: 1 }, uCover: { value: 0 } }, vertexShader: BOLT_VS, fragmentShader: BOLT_FS });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 12; mesh.visible = false; G.scene.add(mesh);
  const b = { mesh, pts: new Float32Array(BOLT_N * 3), n: 0, live: false };
  bolts.push(b);
  return b;
}
// path generation: a jagged bolt from a to b (midpoint displacement), or a curling tendril (smooth spiral)
function genBolt(b, ax, ay, az, bx, by, bz, jag) {
  const n = b.n, P = b.pts, len = Math.hypot(bx - ax, by - ay, bz - az);
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1), j = (i === 0 || i === n - 1) ? 0 : jag * len * 0.09 * Math.sin(k * Math.PI);
    P[i * 3] = ax + (bx - ax) * k + (Math.random() - 0.5) * j * 2;
    P[i * 3 + 1] = ay + (by - ay) * k + (Math.random() - 0.5) * j * 2;
    P[i * 3 + 2] = az + (bz - az) * k + (Math.random() - 0.5) * j * 2;
  }
}
function genTendril(b, x, y, z, h, r, ph, curl) {
  const n = b.n, P = b.pts;
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1), a = ph + k * curl, rr = r * (0.3 + k * 0.9);
    P[i * 3] = x + Math.cos(a) * rr * k; P[i * 3 + 1] = y + k * h; P[i * 3 + 2] = z + Math.sin(a) * rr * k;
  }
}
// rebuild the ribbon facing the camera
function stroke(b) {
  const cam = G.camera; if (!cam) return;
  const pos = b.mesh.geometry.attributes.position.array, au = b.mesh.geometry.attributes.aU.array, P = b.pts, n = b.n;
  for (let i = 0; i < BOLT_N; i++) {
    const j = Math.min(i, n - 1), j0 = Math.max(0, j - 1), j1 = Math.min(n - 1, j + 1);
    _v.set(P[j * 3], P[j * 3 + 1], P[j * 3 + 2]);
    _d.set(P[j1 * 3] - P[j0 * 3], P[j1 * 3 + 1] - P[j0 * 3 + 1], P[j1 * 3 + 2] - P[j0 * 3 + 2]);
    _c.copy(cam.position).sub(_v);
    _s.crossVectors(_d, _c).normalize();
    const k = j / Math.max(1, n - 1), w = b.w * (b.taper ? (1 - k * 0.85) : (0.55 + 0.45 * Math.sin(Math.min(1, k * 1.2) * Math.PI) + 0.25));
    pos[i * 6] = _v.x - _s.x * w; pos[i * 6 + 1] = _v.y - _s.y * w; pos[i * 6 + 2] = _v.z - _s.z * w;
    pos[i * 6 + 3] = _v.x + _s.x * w; pos[i * 6 + 4] = _v.y + _s.y * w; pos[i * 6 + 5] = _v.z + _s.z * w;
    au[i * 2] = au[i * 2 + 1] = k;
  }
  b.mesh.geometry.attributes.position.needsUpdate = true; b.mesh.geometry.attributes.aU.needsUpdate = true;
}
function takeBolt() {
  if (!G.scene) return null;
  let b = bolts.find((q) => !q.live);
  if (!b) { if (bolts.length < 24) b = newBolt(); else b = bolts.reduce((a, c) => (a.t / a.dur > c.t / c.dur ? a : c)); }
  return b;
}
// a lightning arc between two points; flickers (re-jags) a few times during its life
export function bolt(a, bp, color = 0xb8d8ff, o = {}) {
  const b = takeBolt(); if (!b) return;
  const len = Math.hypot(bp.x - a.x, bp.y - a.y, bp.z - a.z);
  b.n = Math.max(6, Math.min(BOLT_N, Math.round(8 + len * 1.5)));
  Object.assign(b, { live: true, t: 0, dur: o.dur ?? 0.22, w: o.width ?? 0.09, taper: false, mode: 'bolt', a: [a.x, a.y, a.z], b: [bp.x, bp.y, bp.z], jag: o.jag ?? 1, flick: 0, grow: 0, growT: o.growT ?? 0.04 });
  genBolt(b, a.x, a.y, a.z, bp.x, bp.y, bp.z, b.jag); stroke(b);
  const u = b.mesh.material.uniforms; linHex(color, o.hdr ?? 3, u.uCol.value); linHex(0xffffff, (o.hdr ?? 3) * 1.4, u.uCore.value); u.uCover.value = 0; u.uGrow.value = 0; u.uA.value = 1;
  b.mesh.visible = true;
}
// a curling tendril rising from the ground (shadow, vines). cover>0 makes it dark matter rather than light
export function tendril(x, y, z, o = {}) {
  const b = takeBolt(); if (!b) return;
  b.n = BOLT_N;
  Object.assign(b, { live: true, t: 0, dur: o.dur ?? 0.9, w: o.width ?? 0.12, taper: true, mode: 'tendril', x, y, z, h: o.height ?? 2.2, r: o.radius ?? 0.8, ph: o.phase ?? Math.random() * 6.283, curl: o.curl ?? 3, grow: 0, growT: o.growT ?? 0.25, sway: Math.random() * 6 });
  genTendril(b, x, y, z, b.h, b.r, b.ph, b.curl); stroke(b);
  const u = b.mesh.material.uniforms; linHex(o.color ?? 0x2a0a40, o.hdr ?? 1, u.uCol.value); linHex(o.core ?? 0x8a3aff, o.coreHdr ?? 2, u.uCore.value); u.uCover.value = o.cover ?? 0.8; u.uGrow.value = 0; u.uA.value = 1;
  b.mesh.visible = true;
}
function updateBolts(dt) {
  for (const b of bolts) {
    if (!b.live) continue;
    b.t += dt; const k = b.t / b.dur;
    if (k >= 1) { b.live = false; b.mesh.visible = false; continue; }
    const u = b.mesh.material.uniforms;
    u.uGrow.value = Math.min(1.15, b.t / b.growT);
    if (b.mode === 'bolt') {
      b.flick += dt;
      if (b.flick > 0.055) { b.flick = 0; const A = b.a, B = b.b; genBolt(b, A[0], A[1], A[2], B[0], B[1], B[2], b.jag); }
      u.uA.value = (1 - k) * (0.65 + Math.random() * 0.35);
    } else {
      genTendril(b, b.x, b.y, b.z, b.h * (1 - Math.max(0, k - 0.6) * 1.5), b.r, b.ph + Math.sin(b.t * 3 + b.sway) * 0.4, b.curl);
      u.uA.value = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
    }
    stroke(b);
  }
}

export function updateMeshFx(dt) {
  const night = G.night || 0, k = 1 - night * 0.65; ambient.value.set(k, k, k * 1.05);
  updateDecals(dt); updateWalls(dt); updateOrbs(dt); updateBeams(dt); updateBolts(dt);
}
export function clearMeshFx() {
  for (const L of [decals, walls, orbs, beams, bolts]) for (const o of L) { o.live = false; o.mesh.visible = false; }
}
