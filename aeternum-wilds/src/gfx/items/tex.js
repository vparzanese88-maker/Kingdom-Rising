// Aeternum Wilds — procedural textures for weapons, armour and item icons.
// Painted once on 2D canvases from tileable value noise (no image files): wood grain, pebbled leather, brushed
// steel, woven cloth, fur and rock. Each comes as a greyscale albedo (tinted by vertex colour) plus a normal map
// built from the same height field, and for metal a roughness map.
import * as THREE from 'three';

// ---------- tileable value noise ----------
function hash(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function vnoise(x, y, P, s, Py = P) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const m = (a) => ((a % P) + P) % P, my = (a) => ((a % Py) + Py) % Py;
  const a = hash(m(xi), my(yi), s), b = hash(m(xi + 1), my(yi), s), c = hash(m(xi), my(yi + 1), s), d = hash(m(xi + 1), my(yi + 1), s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// fractal noise over the unit square (u, v in 0..1), periodic so it tiles
function fbm(u, v, P, oct, s = 1, Py = P) { let sum = 0, amp = 0.5, norm = 0, px = P, py = Py; for (let i = 0; i < oct; i++) { sum += amp * vnoise(u * px, v * py, px, s + i * 17, py); norm += amp; amp *= 0.5; px *= 2; py *= 2; } return sum / norm; }
// anisotropic noise: Pu cells across, Pv cells along (Pv small = long streaks along v)
const streaks = (u, v, Pu, Pv, oct, s) => fbm(u, v, Pu, oct, s, Pv);

// ---------- canvas helpers ----------
const N = 256;
function field(fn, n = N) { const h = new Float32Array(n * n); for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) h[y * n + x] = fn(x / n, y / n); return h; }
function toCanvas(n, px) { const c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d'); const im = g.createImageData(n, n); px(im.data); g.putImageData(im, 0, 0); return c; }
function greyTex(h, n, lo, hi, tint = [1, 1, 1]) {
  return toCanvas(n, (d) => { for (let i = 0; i < n * n; i++) { const k = lo + (hi - lo) * h[i]; d[i * 4] = Math.min(255, k * 255 * tint[0]); d[i * 4 + 1] = Math.min(255, k * 255 * tint[1]); d[i * 4 + 2] = Math.min(255, k * 255 * tint[2]); d[i * 4 + 3] = 255; } });
}
function normalTex(h, n, strength) {
  return toCanvas(n, (d) => {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const l = h[y * n + ((x - 1 + n) % n)], r = h[y * n + ((x + 1) % n)], t = h[((y - 1 + n) % n) * n + x], b = h[((y + 1) % n) * n + x];
      let nx = (l - r) * strength, ny = (b - t) * strength, nz = 1; const L = Math.hypot(nx, ny, nz); nx /= L; ny /= L; nz /= L;
      const i = (y * n + x) * 4; d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
    }
  });
}
function tex(canvas, srgb) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

// ---------- the library ----------
const GEN = {
  // wood: long grain along v (the length of a haft), growth rings drifting across, a few dark knots and pores
  wood() {
    const h = field((u, v) => {
      const warp = fbm(u, v, 2, 3, 3) * 2.2;
      const ring = 0.5 + 0.5 * Math.sin((u * 18 + warp * 3) * Math.PI);
      const fine = streaks(u, v, 64, 4, 2, 5);
      const pore = vnoise(u * 128, v * 8, 128, 9, 8) > 0.82 ? -0.25 : 0;
      return Math.max(0, Math.min(1, 0.35 + ring * 0.35 + fine * 0.3 + pore));
    });
    return { map: tex(greyTex(h, N, 0.55, 1.0), true), normalMap: tex(normalTex(h, N, 2.2)), rough: null };
  },
  // leather: pebbled grain (cellular-ish bumps) with soft creases
  leather() {
    const h = field((u, v) => { const p = vnoise(u * 96, v * 96, 96, 21), q = vnoise(u * 40, v * 40, 40, 22); const crease = Math.abs(fbm(u, v, 6, 3, 23) - 0.5) < 0.02 ? -0.4 : 0; return Math.max(0, Math.min(1, p * 0.55 + q * 0.3 + 0.15 + crease)); });
    return { map: tex(greyTex(h, N, 0.7, 1.0), true), normalMap: tex(normalTex(h, N, 3.0)), rough: null };
  },
  // brushed steel: fine streaks along v, a few scratches across; roughness map in the green channel
  steel() {
    const h = field((u, v) => { const streak = streaks(u, v, 128, 4, 2, 31); const blot = fbm(u, v, 4, 3, 32); return streak * 0.6 + blot * 0.4; });
    // scratches: random short lines
    const n = N; const sc = new Float32Array(n * n); let seed = 7; const R = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 45; k++) { let x = R() * n, y = R() * n; const a = R() * Math.PI, L = 6 + R() * 30; for (let s = 0; s < L; s++) { const xi = ((Math.floor(x) % n) + n) % n, yi = ((Math.floor(y) % n) + n) % n; sc[yi * n + xi] = 1; x += Math.cos(a); y += Math.sin(a); } }
    const map = toCanvas(n, (d) => { for (let i = 0; i < n * n; i++) { const k = (0.88 + h[i] * 0.12 + sc[i] * 0.03) * 255; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = Math.min(255, k); d[i * 4 + 3] = 255; } });
    const rough = toCanvas(n, (d) => { for (let i = 0; i < n * n; i++) { const r = (0.6 + h[i] * 0.7 - sc[i] * 0.12) * 255; d[i * 4] = 0; d[i * 4 + 1] = Math.max(0, Math.min(255, r)); d[i * 4 + 2] = 0; d[i * 4 + 3] = 255; } });
    const hh = new Float32Array(n * n); for (let i = 0; i < n * n; i++) hh[i] = h[i] * 0.3 - sc[i] * 0.15;
    return { map: tex(map, true), normalMap: tex(normalTex(hh, n, 1.2)), rough: tex(rough) };
  },
  // hammered / cast metal for fittings: soft dents
  metal() {
    const h = field((u, v) => fbm(u, v, 8, 4, 41));
    const rough = toCanvas(N, (d) => { for (let i = 0; i < N * N; i++) { d[i * 4] = 0; d[i * 4 + 1] = (0.6 + h[i] * 0.7) * 255; d[i * 4 + 2] = 0; d[i * 4 + 3] = 255; } });
    return { map: tex(greyTex(h, N, 0.88, 1.0), true), normalMap: tex(normalTex(h, N, 1.6)), rough: tex(rough) };
  },
  // woven cloth: a plain weave with slub noise
  cloth() {
    const h = field((u, v) => { const a = Math.sin(u * N * Math.PI / 2), b = Math.sin(v * N * Math.PI / 2); const over = (Math.floor(u * N / 2) + Math.floor(v * N / 2)) % 2 ? a * a : b * b; return 0.4 + over * 0.4 + fbm(u, v, 16, 3, 51) * 0.2; });
    return { map: tex(greyTex(h, N, 0.72, 1.0), true), normalMap: tex(normalTex(h, N, 1.6)), rough: null };
  },
  // fur: dense strands along v
  fur() {
    const h = field((u, v) => { const s = vnoise(u * 160, v * 6, 160, 61, 6); const c = fbm(u, v, 6, 3, 62); return s * 0.7 + c * 0.3; });
    return { map: tex(greyTex(h, N, 0.5, 1.0), true), normalMap: tex(normalTex(h, N, 3.5)), rough: null };
  },
  // rock for ore lumps
  rock() {
    const h = field((u, v) => { const r = fbm(u, v, 6, 5, 71); const cr = Math.abs(fbm(u, v, 5, 3, 72) - 0.5) < 0.025 ? -0.35 : 0; return Math.max(0, r + cr); });
    return { map: tex(greyTex(h, N, 0.55, 1.0), true), normalMap: tex(normalTex(h, N, 4.0)), rough: null };
  },
  // planks: straight grain with saw marks
  planks() {
    const h = field((u, v) => { const g = streaks(u, v, 96, 6, 3, 81); const ring = 0.5 + 0.5 * Math.sin((u * 10 + fbm(u, v, 3, 2, 82) * 2) * Math.PI * 2); return g * 0.6 + ring * 0.25 + 0.15; });
    return { map: tex(greyTex(h, N, 0.6, 1.0), true), normalMap: tex(normalTex(h, N, 2.0)), rough: null };
  },
};
const cache = new Map();
export function itemTex(name) {
  let t = cache.get(name);
  if (!t) { t = GEN[name](); cache.set(name, t); }
  return t;
}
