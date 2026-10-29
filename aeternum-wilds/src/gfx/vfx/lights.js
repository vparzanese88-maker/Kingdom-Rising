// Aeternum Wilds: a fixed pool of point lights for flashes (spells, impacts, crits, explosions).
// The count never changes, so materials never recompile; each flash takes the faintest light.
import * as THREE from 'three';
import { G } from '../../state.js';

const N = 4;
const lights = [];
function init() {
  if (lights.length || !G.scene) return;
  for (let i = 0; i < N; i++) {
    const l = new THREE.PointLight(0xffffff, 0, 14, 1.8); l.castShadow = false;
    G.scene.add(l);
    lights.push({ l, t: 1, dur: 1, peak: 0, att: 0.15 });
  }
}
const cur = (s) => (s.t >= s.dur ? 0 : s.peak * env(s));
function env(s) { const k = s.t / s.dur; return k < s.att ? k / s.att : Math.pow(1 - (k - s.att) / (1 - s.att), 2); }
// a light at (x,y,z): power is the peak intensity (candela-ish), dur seconds, range metres. attack: fraction rising
export function flash(x, y, z, color, power = 30, dur = 0.35, range = 14, attack = 0.08) {
  init(); if (!lights.length) return;
  let s = lights[0], best = Infinity;
  for (const L of lights) { const c = cur(L); if (c < best) { best = c; s = L; } }
  s.l.position.set(x, y, z); s.l.color.setHex(color); s.l.distance = range;
  s.t = 0; s.dur = dur; s.peak = power; s.att = attack;
}
export function updateLights(dt) {
  for (const s of lights) {
    if (s.t < s.dur) { s.t += dt; s.l.intensity = cur(s); } else if (s.l.intensity) s.l.intensity = 0;
  }
}
