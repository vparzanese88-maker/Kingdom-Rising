// Aeternum Wilds: weapon swing trails.
// Each frame of a swing records where the blade's tip and base are; the trail is a ribbon through the recent
// samples, smoothed with Catmull-Rom so even a fast swing at low frame rate draws a clean arc. It is brightest
// at the cutting edge and newest end and fades with age, with faint wind streaks along it. Heavy swings are
// wider, hotter and longer-lived; elemental buffs tint it and shed matching particles.
import * as THREE from 'three';
import { G } from '../../state.js';
import { emit } from './particles.js';
import { FX } from './presets.js';

const MAXS = 40;   // recorded samples
const SUB = 4;     // smoothing subdivisions between samples
const COLS = 96;   // ribbon columns
const smp = new Float32Array(MAXS * 7); // tip xyz, base xyz, time
let ns = 0;
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COLS * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
geo.setAttribute('aUV', new THREE.BufferAttribute(new Float32Array(COLS * 2 * 2), 2).setUsage(THREE.DynamicDrawUsage));
{ const idx = []; for (let i = 0; i < COLS - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } geo.setIndex(idx); }
geo.setDrawRange(0, 0);
const mat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, side: THREE.DoubleSide,
  blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  uniforms: { uCol: { value: new THREE.Vector3(1, 1, 1) }, uEdge: { value: new THREE.Vector3(1, 1, 1) }, uA: { value: 1 }, uCover: { value: 0.25 }, uT: { value: 0 } },
  vertexShader: `attribute vec2 aUV; varying vec2 vUV; void main(){ vUV = aUV; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform vec3 uCol, uEdge; uniform float uA, uCover, uT; varying vec2 vUV;
    void main(){
      float u = vUV.x, v = vUV.y;
      float age = pow(clamp(1.0 - u, 0.0, 1.0), 1.5);
      float body = smoothstep(0.0, 1.0, v) * smoothstep(1.02, 0.9, v);
      float edge = smoothstep(0.82, 0.97, v) * smoothstep(1.02, 0.97, v);
      float streak = 0.72 + 0.28 * sin(v * 46.0 + u * 7.0 - uT * 3.0) * sin(v * 17.0 + 1.3);
      float a = uA * age * (body * streak * 0.75 + edge);
      vec3 col = mix(uCol, uEdge, edge * (1.0 - u * 0.6));
      if (a < 0.003) discard;
      gl_FragColor = vec4(col * a, a * uCover * (1.0 - edge * 0.5));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});
const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 15;
let added = false;

// style: set by swingFx at the start of a swing; read every frame
const style = { kind: 'light', col: new THREE.Color(0xfff4e0), edge: new THREE.Color(0xffffff), hdr: 1.6, maxAge: 0.13, width: 1, emit: null, tint: -1, until: 0 };
const lin = (hex, k, out) => { out.setHex(hex); out.multiplyScalar(k); return out; };
export function trailStyle(kind, color = -1, emitPreset = null) {
  const heavy = kind === 'heavy' || kind === 'ability';
  style.kind = kind;
  style.hdr = heavy ? 2.6 : 1.7;
  style.maxAge = heavy ? 0.2 : 0.13;
  lin(color >= 0 ? color : heavy ? 0xffcf80 : 0xfff2dc, 1, style.col);
  lin(color >= 0 ? 0xffffff : heavy ? 0xfff2c8 : 0xffffff, 1, style.edge);
  style.emit = emitPreset; style.tint = color;
}

// where the business end of the weapon is, in its own space (grip at the origin). Found once per weapon from its
// geometry, so it keeps working if models change; a weapon may also say so itself with userData.tip / tipBase.
const BASE_K = { sword: 0.3, cutlass: 0.3, greataxe: 0.55, hammer: 0.62, staff: 0.72, club: 0.5, greatsword: 0.3 };
const tips = new WeakMap();
const _m = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _p = new THREE.Vector3(), _bb = new THREE.Box3();
function weaponTip(w, wt) {
  let t = tips.get(w);
  if (t) return t;
  w.updateMatrixWorld(true);
  _inv.copy(w.matrixWorld).invert();
  const lo = [0, 0, 0], hi = [0, 0, 0];
  w.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    _bb.copy(o.geometry.boundingBox); _m.multiplyMatrices(_inv, o.matrixWorld);
    for (let c = 0; c < 8; c++) {
      _p.set(c & 1 ? _bb.max.x : _bb.min.x, c & 2 ? _bb.max.y : _bb.min.y, c & 4 ? _bb.max.z : _bb.min.z).applyMatrix4(_m);
      for (let k = 0; k < 3; k++) { const v = _p.getComponent(k); if (v < lo[k]) lo[k] = v; if (v > hi[k]) hi[k] = v; }
    }
  });
  let ax = 1, best = 0, sgn = 1;
  for (let k = 0; k < 3; k++) { if (hi[k] > best) { best = hi[k]; ax = k; sgn = 1; } if (-lo[k] > best) { best = -lo[k]; ax = k; sgn = -1; } }
  const tip = new THREE.Vector3(); tip.setComponent(ax, best * sgn * 0.98);
  if (w.userData.tip) tip.copy(w.userData.tip);
  const base = w.userData.tipBase ? w.userData.tipBase.clone() : tip.clone().multiplyScalar(BASE_K[wt] ?? 0.4);
  t = { tip, base };
  tips.set(w, t);
  return t;
}

// is the weapon cutting the air right now? (only the fast part of the swing, not the wind-up or follow-through)
function swinging(P) {
  if (!P || !P.wR) return false;
  if (P.whirl) return true;
  if (P.state === 'attack' && P.atk && P.atk.wt !== 'bow') {
    const k = P.atk.t / P.atk.dur, h = P.atk.spec?.hit ?? 0.5;
    return k > Math.max(0.05, h - 0.32) && k < h + 0.22;
  }
  if (P.state === 'ability' && P.ability && P.ability.pose !== 'cast' && P.ability.pose !== 'shoot' && P.ability.pose !== 'block') {
    const k = P.ability.t / P.ability.dur; return k > 0.1 && k < 0.85;
  }
  return false;
}

const vTip = new THREE.Vector3(), vBase = new THREE.Vector3();
let simT = 0, emitAcc = 0, lastStyleKind = '';
// call once per frame (dt real seconds; hit-stop and pause freeze the trail so a big hit hangs in the air)
export function updateTrail(dt, thirdPerson = true) {
  if (!added && G.scene) { G.scene.add(mesh); added = true; }
  const P = G.player;
  const sdt = G.paused ? 0 : (G.hitstop > 0 ? dt * 0.08 : dt);
  simT += sdt;
  mat.uniforms.uT.value = simT;
  const on = thirdPerson && swinging(P);
  if (on) {
    if (!P.atk && !P.whirl && style.kind !== 'ability') trailStyle('ability', style.tint, style.emit);
    if (P.whirl && lastStyleKind !== 'whirl') { trailStyle('heavy', P.whirl.col ?? -1, null); lastStyleKind = 'whirl'; }
    const wt = P.atk?.wt || G.p?.equip?.[G.p.activeW ? 'w2' : 'w1']?.wtype;
    const T = weaponTip(P.wR, wt);
    P.wR.updateMatrixWorld(true);
    vTip.copy(T.tip); P.wR.localToWorld(vTip);
    vBase.copy(T.base); P.wR.localToWorld(vBase);
    // skip if the blade barely moved (no stacking samples while frozen)
    const moved = ns === 0 || Math.hypot(smp[0] - vTip.x, smp[1] - vTip.y, smp[2] - vTip.z) > 0.004;
    if (moved) {
      if (ns < MAXS) ns++;
      smp.copyWithin(7, 0, (ns - 1) * 7);
      smp[0] = vTip.x; smp[1] = vTip.y; smp[2] = vTip.z; smp[3] = vBase.x; smp[4] = vBase.y; smp[5] = vBase.z; smp[6] = simT;
    }
    // shed particles from the edge (element buffs, heavy swings)
    if (style.emit && sdt > 0) {
      emitAcc += sdt * 70;
      while (emitAcc >= 1) { emitAcc--; const k = Math.random(); emit(style.emit, 1, vBase.x + (vTip.x - vBase.x) * (0.5 + k * 0.5), vBase.y + (vTip.y - vBase.y) * (0.5 + k * 0.5), vBase.z + (vTip.z - vBase.z) * (0.5 + k * 0.5), 0, 1, 0, 0.8, style.tint); }
    }
  } else lastStyleKind = '';
  // drop samples older than the trail lifetime
  while (ns > 0 && simT - smp[(ns - 1) * 7 + 6] > style.maxAge) ns--;
  build();
}

const _a = [0, 0, 0], _b = [0, 0, 0];
function cr(i, j, t, out) { // Catmull-Rom on component j of point i..i+1 (tip j=0..2, base j=3..5)
  const p0 = Math.max(0, i - 1), p1 = i, p2 = Math.min(ns - 1, i + 1), p3 = Math.min(ns - 1, i + 2);
  for (let c = 0; c < 3; c++) {
    const a = smp[p0 * 7 + j + c], b = smp[p1 * 7 + j + c], d = smp[p2 * 7 + j + c], e = smp[p3 * 7 + j + c];
    const t2 = t * t, t3 = t2 * t;
    out[c] = 0.5 * ((2 * b) + (-a + d) * t + (2 * a - 5 * b + 4 * d - e) * t2 + (-a + 3 * b - 3 * d + e) * t3);
  }
}
function build() {
  if (ns < 2) { geo.setDrawRange(0, 0); return; }
  const pos = geo.attributes.position.array, uv = geo.attributes.aUV.array;
  const t0 = smp[6], span = style.maxAge;
  let col = 0;
  for (let i = 0; i < ns - 1 && col < COLS; i++) {
    for (let s = 0; s < SUB && col < COLS; s++) {
      const t = s / SUB;
      cr(i, 0, t, _a); cr(i, 3, t, _b);
      const age = (t0 - (smp[i * 7 + 6] + (smp[(i + 1) * 7 + 6] - smp[i * 7 + 6]) * t)) / span;
      const o = col * 6;
      pos[o] = _b[0]; pos[o + 1] = _b[1]; pos[o + 2] = _b[2];
      pos[o + 3] = _a[0]; pos[o + 4] = _a[1]; pos[o + 5] = _a[2];
      uv[col * 4] = age; uv[col * 4 + 1] = 0; uv[col * 4 + 2] = age; uv[col * 4 + 3] = 1;
      col++;
    }
  }
  if (col < COLS) { // the last sample exactly
    const o = col * 6, j = (ns - 1) * 7;
    pos[o] = smp[j + 3]; pos[o + 1] = smp[j + 4]; pos[o + 2] = smp[j + 5]; pos[o + 3] = smp[j]; pos[o + 4] = smp[j + 1]; pos[o + 5] = smp[j + 2];
    const age = (t0 - smp[j + 6]) / span; uv[col * 4] = age; uv[col * 4 + 1] = 0; uv[col * 4 + 2] = age; uv[col * 4 + 3] = 1;
    col++;
  }
  geo.attributes.position.needsUpdate = true; geo.attributes.aUV.needsUpdate = true;
  geo.setDrawRange(0, Math.max(0, (col - 1) * 6));
  const u = mat.uniforms;
  u.uCol.value.set(style.col.r * style.hdr, style.col.g * style.hdr, style.col.b * style.hdr);
  u.uEdge.value.set(style.edge.r * style.hdr * 1.4, style.edge.g * style.hdr * 1.4, style.edge.b * style.hdr * 1.4);
  u.uA.value = style.kind === 'light' ? 0.8 : 1;
  u.uCover.value = style.kind === 'light' ? 0.18 : 0.28;
}
export function clearTrail() { ns = 0; geo.setDrawRange(0, 0); }
