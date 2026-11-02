// Kingdom Battles: the map layout (towns, roads, towers, camps) and its terrain shape.
// Built from the match settings the title screen saved before reloading with ?mode=battle.
import { fbm, ridged, smooth, lerp, clamp, distToLine, mulberry32 } from './util.js';

export const BATTLE = /[?&]mode=battle/.test(location.search);
export const SETUP_KEY = 'kr2_battle_setup';

function readSetup() {
  try { const s = JSON.parse(sessionStorage.getItem(SETUP_KEY) || 'null'); if (s && (s.mp || (s.towns && s.towns.length >= 2))) return s; } catch (e) {}
  // fallback so the page still works if opened directly
  return { towns: [{ race: 'human', ai: false, team: 0 }, { race: 'orc', ai: true, diff: 'normal', team: 1 }], seed: 7 };
}
export const SETUP = BATTLE ? readSetup() : null;

export const WALL_R = 40;          // town wall radius
export const TOWER_D = 66;         // towers this far from the town centre, flanking the road
export const TOWER_SIDE = 11;      // ...and this far either side of it
export const JUNCTION_D = 100;     // where a town's road splits toward the other towns

// town layout: towns sit on a ring around the map centre, gates facing the middle
export const LAYOUT = { towns: [], roads: [], camps: [], gold: [], stone: [] };
// built at load for single player, or once the online lobby has decided the towns
export function computeLayout() {
  for (const k in LAYOUT) LAYOUT[k].length = 0;
  const N = SETUP.towns.length, R = N === 2 ? 330 : N === 3 ? 310 : 320;
  const rnd = mulberry32((SETUP.seed || 7) * 7919);
  for (let i = 0; i < N; i++) {
    // town 0 (the host / you) is always in the south
    const a = Math.PI / 2 + i * Math.PI * 2 / N;
    const cx = Math.cos(a) * R, cz = Math.sin(a) * R;
    const dx = -Math.cos(a), dz = -Math.sin(a);           // facing the centre
    const px = -dz, pz = dx;                               // to its right
    const t = {
      i, x: cx, z: cz, dir: [dx, dz], perp: [px, pz], yaw: Math.atan2(dx, dz),
      gate: [cx + dx * WALL_R, cz + dz * WALL_R],
      gateIn: [cx + dx * (WALL_R - 9), cz + dz * (WALL_R - 9)],
      gateOut: [cx + dx * (WALL_R + 9), cz + dz * (WALL_R + 9)],
      junction: [cx + dx * JUNCTION_D, cz + dz * JUNCTION_D],
      towers: [[cx + dx * TOWER_D + px * TOWER_SIDE, cz + dz * TOWER_D + pz * TOWER_SIDE], [cx + dx * TOWER_D - px * TOWER_SIDE, cz + dz * TOWER_D - pz * TOWER_SIDE]],
    };
    LAYOUT.towns.push(t);
  }
  for (const t of LAYOUT.towns) LAYOUT.roads.push({ pts: [[t.x, t.z], t.gate, t.junction], town: t.i });
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
    const A = LAYOUT.towns[i], B = LAYOUT.towns[j];
    // a gentle bend so roads don't look ruled
    const mx = (A.junction[0] + B.junction[0]) / 2, mz = (A.junction[1] + B.junction[1]) / 2;
    const ddx = B.junction[0] - A.junction[0], ddz = B.junction[1] - A.junction[1], l = Math.hypot(ddx, ddz);
    const bend = (rnd() - 0.5) * 0.08 * l;
    LAYOUT.roads.push({ pts: [A.junction, [mx - ddz / l * bend, mz + ddx / l * bend], B.junction], a: i, b: j });
  }
  // neutral camps: off to the side of each road between towns
  for (const r of LAYOUT.roads) {
    if (r.a == null) continue;
    const [A, M, B] = r.pts; const ddx = B[0] - A[0], ddz = B[1] - A[1], l = Math.hypot(ddx, ddz), nx = -ddz / l, nz = ddx / l;
    for (const [f, side, tier] of [[0.3, 1, 0], [0.7, -1, 0], [0.5, 1, 1], [0.5, -1, 1]]) {
      const bx = A[0] + ddx * f, bz = A[1] + ddz * f, off = tier ? 80 : 58;
      LAYOUT.camps.push({ x: bx + nx * off * side, z: bz + nz * off * side, tier });
    }
  }
  // centre camp (the toughest) when roads cross there
  if (N >= 3) LAYOUT.camps.push({ x: 0, z: 0, tier: 2 }); else { LAYOUT.camps.push({ x: 120, z: 0, tier: 2 }); LAYOUT.camps.push({ x: -120, z: 0, tier: 2 }); }
  // resources: every town gets a stone quarry and a gold vein nearby, plus contested ones further out
  for (const t of LAYOUT.towns) {
    const side = (k) => [t.x + t.perp[0] * k[0] + t.dir[0] * k[1], t.z + t.perp[1] * k[0] + t.dir[1] * k[1]];
    LAYOUT.stone.push(side([-72, 10]), side([78, -20]));
  }
  // lots more camps scattered over the wilds: weaker near towns, tougher far out; the farthest are boss lairs
  const roadD = (x, z) => { let d = 1e9; for (const r of LAYOUT.roads) d = Math.min(d, distToLine(x, z, r.pts).d); return d; };
  const townD = (x, z) => Math.min(...LAYOUT.towns.map(t => Math.hypot(x - t.x, z - t.z)));
  const extra = [];
  for (let k = 0; k < 3000 && extra.length < 48 + N * 8; k++) {
    const x = (rnd() - 0.5) * 900, z = (rnd() - 0.5) * 900;
    const td = townD(x, z); if (td < 115 || roadD(x, z) < 30) continue;
    if ([...LAYOUT.camps, ...extra].some(c => Math.hypot(c.x - x, c.z - z) < 50)) continue;
    extra.push({ x, z, tier: td < 190 ? 0 : td < 290 ? 1 : 2, td });
  }
  // boss lairs spread over the map: every 5th of the outer camps, so there is always one within reach
  extra.sort((a, b) => b.td - a.td);
  let nb = 0; for (let k = 0; k < extra.length && nb < 6 + N * 2; k += 4) { if (extra[k].td > 150) { extra[k].tier = 3; nb++; } }
  LAYOUT.camps.push(...extra);
}

if (BATTLE && !SETUP.mp) computeLayout();
export function roadPolylines() { return LAYOUT.roads.map(r => r.pts); }
export function nearTown(x, z, pad = 0) { for (const t of LAYOUT.towns) if (Math.hypot(x - t.x, z - t.z) < WALL_R + 12 + pad) return t; return null; }

// terrain: rolling meadows with low hills, flat around towns and along roads, mountains at the map edge
export function battleHeight(x, z) {
  let h = 4 + fbm(x * 0.004 + 31, z * 0.004 - 17, 4) * 9 + fbm(x * 0.016 + 3, z * 0.016, 3) * 1.6;
  h += Math.max(0, ridged(x * 0.006 + 5, z * 0.006, 3) - 0.62) * 22; // a few rocky knolls
  let rd = 1e9; for (const r of LAYOUT.roads) { const d = distToLine(x, z, r.pts).d; if (d < rd) rd = d; }
  const base = 4 + fbm(x * 0.002, z * 0.002, 2) * 3;
  h = lerp(h, base + (h - base) * 0.25, 1 - smooth(6, 26, rd));
  for (const t of LAYOUT.towns) { const d = Math.hypot(x - t.x, z - t.z); if (d < 130) { if (t.flat == null) t.flat = 4 + fbm(t.x * 0.002, t.z * 0.002, 2) * 3; h = lerp(h, t.flat, 1 - smooth(WALL_R + 14, 120, d)); } }
  h = Math.max(h, 1.8 + fbm(x * 0.02, z * 0.02, 2) * 0.4);
  const edge = Math.max(Math.abs(x), Math.abs(z));
  h += smooth(470, 585, edge) * (60 + ridged(x * 0.008 + 11, z * 0.008, 4) * 90);
  return h;
}
export function battleRoadDist(x, z) { let rd = 1e9; for (const r of LAYOUT.roads) { const d = distToLine(x, z, r.pts).d; if (d < rd) rd = d; } return rd; }
export const clampMap = (v) => clamp(v, -560, 560);
