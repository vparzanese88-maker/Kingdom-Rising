// Aeternum Wilds — environment graphics: state shared by every module in gfx/env/
// (the renderer and quality preset, uniforms that many materials read, small helpers)
import * as THREE from 'three';

export const ENV = {
  renderer: null, scene: null, camera: null,
  Q: null,           // the active quality preset (main.js QUALITY)
  maxAniso: 1,
  updaters: [],      // per-frame callbacks (dt, t)
};

// uniforms read by water, foliage, flags, sky and terrain
export const U = {
  uTime: { value: 0 },
  uWind: { value: 1 },
  uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.3) },
  uSunCol: { value: new THREE.Color(1, 0.95, 0.85) },
  uSkyCol: { value: new THREE.Color(0.3, 0.55, 0.9) },
  uHorCol: { value: new THREE.Color(0.7, 0.82, 0.92) },
  uNight: { value: 0 },
};

export function initEnv(renderer, scene, camera, Q) {
  ENV.renderer = renderer; ENV.scene = scene; ENV.camera = camera; ENV.Q = Q;
  ENV.maxAniso = renderer.capabilities.getMaxAnisotropy();
}

// ---------- helpers ----------
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export function hash2(x, y, s = 0) { let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function rng(seed) { let a = seed | 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const _c = new THREE.Color(), _w = new THREE.Color(1, 1, 1);
export function col(hex, out) { const c = out || new THREE.Color(); if (hex && hex.isColor) return c.copy(hex); if (typeof hex === 'number') return c.setHex(hex); return c.set(hex || '#808080'); }
// lighten (amt > 0) or darken (amt < 0) a colour
export function shade(hex, amt) { const c = col(hex, new THREE.Color()); if (amt >= 0) c.lerp(_w, amt); else c.multiplyScalar(1 + amt); return c; }
export { _c as tmpColor };
// alpha-tested cards thin out in the smaller mip levels: raise alpha with the mip level so distant leaves and
// grass keep their coverage
export function keepCoverage(sh, size = 256) {
  sh.fragmentShader = sh.fragmentShader.replace('#include <alphatest_fragment>', `{ vec2 cdx = dFdx(vMapUv * ${size}.), cdy = dFdy(vMapUv * ${size}.); float cmip = max(0., .5 * log2(max(dot(cdx, cdx), dot(cdy, cdy)))); diffuseColor.a *= 1. + cmip * .3; }
#include <alphatest_fragment>`);
}
