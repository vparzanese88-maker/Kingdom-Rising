// Kingdom Battles fog of war: what your side has explored, and what it can see right now.
import { G } from './state.js';
import { HALF } from './terrain.js';

const FN = 150, CELL = (HALF * 2) / FN;
export const fog = {
  on: false, explored: new Uint8Array(FN * FN), visible: new Uint8Array(FN * FN), canvas: null, t: 0,
  sentries: [], pings: [],
};
const cellOf = (x, z) => [Math.floor((x + HALF) / CELL), Math.floor((z + HALF) / CELL)];
export function isVisible(x, z) { if (!fog.on) return true; const [i, j] = cellOf(x, z); if (i < 0 || j < 0 || i >= FN || j >= FN) return false; return fog.visible[j * FN + i] === 1; }
export function isExplored(x, z) { if (!fog.on) return true; const [i, j] = cellOf(x, z); if (i < 0 || j < 0 || i >= FN || j >= FN) return false; return fog.explored[j * FN + i] === 1; }
function reveal(x, z, r) {
  const [ci, cj] = cellOf(x, z), rc = Math.ceil(r / CELL), r2 = (r / CELL) ** 2;
  for (let j = Math.max(0, cj - rc); j <= Math.min(FN - 1, cj + rc); j++) for (let i = Math.max(0, ci - rc); i <= Math.min(FN - 1, ci + rc); i++) {
    if ((i - ci) ** 2 + (j - cj) ** 2 > r2) continue; const k = j * FN + i; fog.visible[k] = 1; fog.explored[k] = 1;
  }
}
// sources: { x, z, r } list supplied by the battle each update
export function updateFog(dt, sources) {
  if (!fog.on) return;
  fog.t -= dt; if (fog.t > 0) return; fog.t = 0.35;
  fog.visible.fill(0);
  for (const s of sources) reveal(s.x, s.z, s.r);
  for (const s of fog.sentries) if (!s.dead) reveal(s.x, s.z, s.r);
  // paint: black where unexplored, dim where explored but not watched, clear where seen
  if (!fog.canvas) { fog.canvas = document.createElement('canvas'); fog.canvas.width = fog.canvas.height = FN; }
  const g = fog.canvas.getContext('2d'), img = g.createImageData(FN, FN), d = img.data;
  for (let k = 0; k < FN * FN; k++) { const a = fog.soft ? (fog.explored[k] ? 0 : 236) : fog.visible[k] ? 0 : fog.explored[k] ? 110 : 238; d[k * 4] = 6; d[k * 4 + 1] = 5; d[k * 4 + 2] = 10; d[k * 4 + 3] = a; }
  g.putImageData(img, 0, 0);
  fog.pings = fog.pings.filter(p => G.time - p.t < 8);
}
export function addPing(x, z) { fog.pings.push({ x, z, t: G.time }); }
export const FOG_N = FN;
// the campaign keeps what you have explored in the save, packed one bit per cell
export function packFog() { const b = new Uint8Array(Math.ceil(FN * FN / 8)); for (let k = 0; k < FN * FN; k++) if (fog.explored[k]) b[k >> 3] |= 1 << (k & 7); let s = ''; for (const c of b) s += String.fromCharCode(c); return btoa(s); }
export function unpackFog(str) { fog.explored.fill(0); if (!str) return; try { const s = atob(str); for (let k = 0; k < FN * FN; k++) if (s.charCodeAt(k >> 3) & (1 << (k & 7))) fog.explored[k] = 1; } catch (e) {} fog.t = 0; }
