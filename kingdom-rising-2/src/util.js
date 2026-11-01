import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';

export function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rng = mulberry32(1337);
export const simplex = new SimplexNoise({ random: rng });
export const n2 = (x, y) => simplex.noise(x, y);
export function fbm(x, y, oct = 4) { let s = 0, a = 0.5, f = 1, t = 0; for (let i = 0; i < oct; i++) { s += a * simplex.noise(x * f, y * f); t += a; a *= 0.5; f *= 2.03; } return s / t; }
export function ridged(x, y, oct = 4) { let s = 0, a = 0.5, f = 1, t = 0; for (let i = 0; i < oct; i++) { s += a * (1 - Math.abs(simplex.noise(x * f, y * f))); t += a; a *= 0.5; f *= 2.1; } return Math.pow(s / t, 2); }
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export function smooth(a, b, v) { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
export function hash2(x, z) { let h = (x * 374761393 + z * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function distToSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz;
  let t = l ? ((px - ax) * dx + (pz - az) * dz) / l : 0; t = clamp(t, 0, 1);
  const x = ax + dx * t - px, z = az + dz * t - pz;
  return { d: Math.sqrt(x * x + z * z), t };
}
export function distToLine(px, pz, pts) { let best = 1e9, bi = 0, bt = 0; for (let i = 0; i < pts.length - 1; i++) { const r = distToSeg(px, pz, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]); if (r.d < best) { best = r.d; bi = i; bt = r.t; } } return { d: best, i: bi, t: bt }; }
export const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
export const rand = (a, b) => a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
