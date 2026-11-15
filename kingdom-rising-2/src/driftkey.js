// Driftwood Key: a small island out at sea, about 600 m south of Goblos, past the edge of the main terrain grid.
// terrain.js heightAt() falls back to driftHeight() outside the grid, so walking, swimming and the boat all just work there.
import { fbm, smooth } from './util.js';

export const DRIFT = { x: 300, z: 1050, r: 86, name: 'Driftwood Key' };
// the shoreline: how far the land reaches from the middle in each direction
export function driftR(x, z) { const a = Math.atan2(z - DRIFT.z, x - DRIFT.x); return DRIFT.r + fbm(Math.cos(a) * 1.3 + 7, Math.sin(a) * 1.3 + 3, 3) * 18 + fbm(Math.cos(a) * 4 + 2, Math.sin(a) * 4, 2) * 5; }
export function driftHeight(x, z) {
  const dx = x - DRIFT.x, dz = z - DRIFT.z; if (dx * dx + dz * dz > 170 * 170) return -10;
  const r = Math.hypot(dx, dz), R = driftR(x, z), s = R - r;
  if (s < 0) { const u = Math.min(1, -s / 55); return 0.2 - 10.2 * (1 - Math.pow(1 - u, 2.2)); } // (the sea floor drops away quickly off the beach, so a boat can come close in)
  return 0.2 + Math.min(s, 14) * 0.12 // the beach
    + smooth(12, 52, s) * (3.4 + fbm(x * 0.03 + 4, z * 0.03, 2) * 2.2) // a low grassy hill in the middle
    + fbm(x * 0.08, z * 0.08, 2) * 0.35 * smooth(8, 22, s);
}
// how far inland a point is (> 0: on the island)
export const driftInland = (x, z) => driftR(x, z) - Math.hypot(x - DRIFT.x, z - DRIFT.z);
