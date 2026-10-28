// Kingdom Rising 3D — the sewers: the brick outflow pipe under each city wall, the daylight at its far end seen
// from inside, and the tunnel network below the city (brick barrel vaults over a channel of foul water, kerbs and
// walkways, pipes along the walls, chambers with ribbed ceilings, cisterns, and shafts of daylight with ladders)
import { K3, TILE } from './core.js';
import { geo, T } from './geo.js';

const KR = window.KR, W = KR.W;
const Tl = TILE;
const BRICK = '#7a5e4c', BRICK_D = '#5e4838', MOSS = '#3e5226', SLIME = '#4a5a2a', IRON = '#3a3430', RUST = '#6a4a32';

// ---------- the outflow pipe (a decoration in the overworld; its front faces +z, the city wall is behind at z -0.8) ----------
export function outflowPipe(o, d) {
  const r = 1.35, yS = 1.9; // opening: 2.7 m wide, 3.25 m to the crown of the arch
  const z0 = -0.8, z1 = 0.75; // from the wall face out to the lip of the pipe
  const L = z1 - z0, zc = (z0 + z1) / 2;
  const tint = (k) => K3.shade(BRICK, (K3.hash(k, d.tx || 0, 7) - 0.5) * 0.12);
  // the barrel of the pipe sticking out of the wall: straight brick sides, then the arched roof
  for (const sd of [-1, 1]) {
    o.boxB('brick', sd * (r + 0.2), 0, zc, 0.4, yS, L, tint(sd));
    o.boxB('stone', sd * (r + 0.2), -0.6, zc, 0.5, 0.6, L + 0.1, BRICK_D);
  }
  const N = 12;
  for (let k = 0; k <= N; k++) {
    const a = Math.PI * k / N, cx = Math.cos(a) * (r + 0.2), cy = yS + Math.sin(a) * (r + 0.2);
    o.box('brick', cx, cy, zc, 0.42, Math.PI * (r + 0.2) / N * 1.12, L, tint(k), 0, 0, a);
    // a ring of bigger voussoirs at the lip, slightly proud of the barrel
    o.box('stone', Math.cos(a) * (r + 0.28), yS + Math.sin(a) * (r + 0.28), z1 + 0.06, 0.62, Math.PI * (r + 0.3) / N * 1.0, 0.26, K3.shade(BRICK, -0.08 + (k % 2) * 0.05), 0, 0, a);
  }
  o.box('stone', 0, yS + r + 0.58, z1 + 0.08, 0.5, 0.62, 0.32, '#8a7a68'); // keystone
  // the dark inside of the pipe, and its floor: a worn invert with a trickle of filth running out
  o.box('dark', 0, yS * 0.5, z0 + 0.03, r * 2 + 0.05, yS, 0.04, null);
  for (let k = 0; k < 8; k++) { const a = Math.PI * (k + 0.5) / 8; o.box('dark', Math.cos(a) * r * 0.5, yS + Math.sin(a) * r * 0.5 - 0.02, z0 + 0.03, r * 1.02 * Math.abs(Math.cos(a)) + 0.6, r * Math.sin(Math.PI / 8) * 1.2 + 0.25, 0.04, null); }
  o.box('dark', 0, yS + r * 0.55, z0 + 0.03, r * 1.5, r * 0.9, 0.04, null);
  o.box('stone', 0, 0.02, zc, r * 2 + 0.1, 0.1, L, '#5a5048');
  o.box('glow', 0, 0.075, zc + 0.2, 0.9, 0.02, L + 0.4, SLIME).box('glow', 0, 0.06, z1 + 0.7, 1.3, 0.02, 1.2, '#3e4a24');
  // the headwall: brick facing on the city wall around the pipe, with wing walls stepping down either side
  const HW = 2.5, HH = 4.2;
  for (let y = yS + r + 0.4; y < HH; y += 0.5) o.box('brick', 0, y + 0.25, z0 + 0.2, HW * 2, 0.5, 0.4, tint(Math.round(y * 3)));
  for (const sd of [-1, 1]) {
    o.boxB('brick', sd * (r + 0.4 + (HW - r - 0.4) / 2), -0.3, z0 + 0.2, HW - r - 0.4 + 0.02, HH + 0.3, 0.4, tint(sd * 3));
    // wing walls: low retaining walls angled out along the ditch banks
    for (let k = 0; k < 3; k++) o.boxB('stone', sd * (HW - 0.2), -0.3, z0 + 0.65 + k * 0.6, 0.45, 2.4 - k * 0.7, 0.62, tint(k + sd * 5));
    o.box('stone', sd * (HW - 0.2), 2.15, z0 + 0.65, 0.55, 0.12, 0.7, '#8a7a68');
  }
  o.box('stone', 0, HH + 0.06, z0 + 0.22, HW * 2 + 0.2, 0.14, 0.5, '#8a7a68'); // coping
  // the grate, broken open: one leaf hangs off its hinge against the left side, two bent bars still in the arch
  const gx = -r + 0.05, gz = z1 - 0.15, ga = -1.75; // swung round on its hinge
  const gp = (lx, lz) => [gx + Math.cos(ga) * lx - Math.sin(ga) * lz, gz + Math.sin(ga) * lx + Math.cos(ga) * lz];
  for (let k = 0; k < 6; k++) { const [x, z] = gp(0.15 + k * 0.24, 0); o.box('metalv', x, 1.05 + (k === 4 ? -0.15 : 0), z, 0.06, 2.0 - (k > 3 ? 0.35 : 0), 0.06, RUST, 0, k === 5 ? 0.2 : 0); }
  for (const y of [0.25, 1.15, 1.95]) { const [x, z] = gp(0.72, 0); o.box('metalv', x, y, z, 1.35, 0.07, 0.07, RUST, -ga); }
  o.box('metalv', 0.55, 2.55, z1 - 0.12, 0.06, 1.0, 0.06, RUST, 0, 0, 0.5).box('metalv', 0.9, 2.35, z1 - 0.12, 0.06, 1.2, 0.06, RUST, 0, 0, -0.35);
  o.box('metalv', 0, yS + 0.2, z1 - 0.12, 0.9, 0.06, 0.06, RUST, 0, 0, 0.15);
  // moss in the joints and green slime streaks down from the lip
  for (let k = 0; k < 9; k++) {
    const h = K3.hash(k, d.tx || 1, 11), a = Math.PI * (0.1 + h * 0.8);
    o.rock('rock', Math.cos(a) * (r + 0.45), yS + Math.sin(a) * (r + 0.45), z1 + 0.18, 0.4 + h * 0.3, 0.16, 0.18, MOSS, h * 3);
  }
  for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) o.box('paint', sd * (r + 0.42), 0.6 + k * 0.45, z1 + 0.2, 0.18, 0.5 + k * 0.1, 0.03, k ? SLIME : MOSS);
  for (let k = 0; k < 5; k++) o.box('paint', (k - 2) * 0.55, 0.45, z0 + 0.42, 0.22, 0.9, 0.03, MOSS);
  // an earth bank heaped against the wall over the pipe, grassed on top
  for (let k = 0; k < 7; k++) { const sd = k % 2 ? 1 : -1, h = K3.hash(k, 3, d.tx || 2); o.rock('rock', sd * (HW + 0.3 + h * 0.6), 0.2 + h * 0.4, z0 + 0.6 + (k >> 1) * 0.5, 1.1, 0.7 + h * 0.4, 1.0, k > 4 ? '#5a6a3a' : '#6a5a46', h * 6); }
  // drips from the crown and a lantern on an iron bracket by the mouth
  o.out.emitters.push({ kind: 'drip', p: o.w(0.2, yS + r - 0.1, z1 - 0.05) }, { kind: 'drip', p: o.w(-0.6, yS + r * 0.8, z1 + 0.05) });
  o.box('metalv', r + 0.75, 3.1, z1 + 0.1, 0.06, 0.06, 0.6, IRON).box('metalv', r + 0.75, 2.92, z1 + 0.38, 0.05, 0.36, 0.05, IRON);
  o.box('metalv', r + 0.75, 2.6, z1 + 0.38, 0.26, 0.04, 0.26, IRON).box('metalv', r + 0.75, 2.34, z1 + 0.38, 0.28, 0.05, 0.28, IRON);
  o.box('glow', r + 0.75, 2.47, z1 + 0.38, 0.17, 0.2, 0.17, '#ffd890').flame(r + 0.75, 2.42, z1 + 0.38, 0.14, 0.2).glow(r + 0.75, 2.47, z1 + 0.38, 0.9, [2.4, 1.5, 0.6], 0.4);
}

// ---------- inside, at the way out: daylight at the end of the pipe (front faces +z, toward the outside) ----------
export function sewerExit(o) {
  const r = 1.6, yS = 1.8;
  o.box('glow', 0, yS * 0.5, 0.75, r * 2, yS, 0.04, '#e8eedc');
  for (let k = 0; k < 8; k++) { const a = Math.PI * (k + 0.5) / 8; o.box('glow', 0, yS + Math.sin(a) * r * 0.5, 0.75, Math.abs(Math.cos(a)) * r * 2 * 0.9 + 0.5, r * 0.45, 0.04, '#dfe8d4'); }
  o.box('glow', 0, yS + r * 0.62, 0.75, r * 1.3, r * 0.75, 0.04, '#d8e4d0');
  o.glow(0, 1.6, 0.6, 4.2, [1.6, 1.8, 1.7], 0.35);
  for (let k = 0; k <= 12; k++) { const a = Math.PI * k / 12; o.box('stone', Math.cos(a) * (r + 0.2), yS + Math.sin(a) * (r + 0.2), 0.6, 0.45, 0.5, 0.4, K3.shade(BRICK, (k % 2) * 0.05 - 0.05), 0, 0, a); }
  for (const sd of [-1, 1]) o.boxB('stone', sd * (r + 0.2), 0, 0.6, 0.45, yS, 0.4, BRICK);
  for (let k = -3; k <= 3; k++) if (k !== 0 && k !== 1) o.box('metalv', k * 0.42, 0.9 + (k === 2 ? 0.3 : 0), 0.55, 0.06, k === 2 ? 1.2 : 1.8, 0.06, RUST, 0, 0, k === -1 ? 0.25 : 0);
  for (let k = 0; k < 5; k++) o.box('paint', (k - 2) * 0.6, yS + r + 0.05 - (k % 2) * 0.3, 0.42, 0.08, 0.6 + (k % 3) * 0.2, 0.03, '#4a6a2a'); // roots and weeds hanging in
}

// ---------- the tunnel network, built a chunk of tiles at a time ----------
const open = (x, y) => { const t = W.tile(x, y); return t != null && t !== T.WALL && t !== T.ROCK; };
export function sewerHalls(mb, x0, y0, x1, y1, torches) {
  if (!geo.dungeon || !geo.dgnId || !geo.dgnId.startsWith('sewer')) return;
  const dd = W.dungeons && W.dungeons[geo.dgnId]; const sw = dd && dd.sewer; if (!sw) return;
  const inChunk = (x, y) => x >= x0 && x < x1 && y >= y0 && y < y1;
  const R = 2.35, yS = 2.15, N = 16, TH = 0.42; // the barrel vault: springs at 2.15 m, crown at 4.5 m
  const tint = (a, b, k) => K3.shade(BRICK, (K3.hash(a, b, k) - 0.5) * 0.14);
  for (const sg of sw.segs) {
    for (let t = sg.a; t <= sg.b; t++) {
      const cx = sg.horiz ? t : sg.c, cy = sg.horiz ? sg.c : t;
      if (!inChunk(cx, cy)) continue;
      // only where the tunnel is exactly three wide (junctions and chambers have their own ceilings)
      const P = (along, perp) => (sg.horiz ? open(t + along, sg.c + perp) : open(sg.c + perp, t + along));
      let wide = false; for (const s of [-2, 2]) if (P(0, s) && (P(-1, s) || P(1, s))) wide = true;
      if (wide || !P(0, 0)) continue;
      const mx = (cx + 0.5) * Tl, mz = (cy + 0.5) * Tl;
      for (let k = 0; k <= N; k++) {
        const a = Math.PI * k / N, off = Math.cos(a) * R, y = yS + Math.sin(a) * R, al = Math.PI * R / N * 1.1;
        if (sg.horiz) mb.box('brick', mx, y, mz + off, Tl + 0.02, TH, al, tint(t, k, 3), 0, Math.PI / 2 - a, 0);
        else mb.box('brick', mx + off, y, mz, al, TH, Tl + 0.02, tint(t, k, 3), 0, 0, a - Math.PI / 2);
      }
      // a heavier rib every third tile
      if (t % 3 === 0) for (let k = 0; k <= N; k++) {
        const a = Math.PI * k / N, off = Math.cos(a) * (R - 0.12), y = yS + Math.sin(a) * (R - 0.12), al = Math.PI * R / N * 1.1;
        if (sg.horiz) mb.box('stone', mx, y, mz + off, 0.5, 0.36, al, BRICK_D, 0, Math.PI / 2 - a, 0);
        else mb.box('stone', mx + off, y, mz, al, 0.36, 0.5, BRICK_D, 0, 0, a - Math.PI / 2);
      }
      // kerbs either side of the channel, and the walls' wet, mossy foot
      const wet = W.tile(cx, cy) === T.WATER;
      for (const s of [-1, 1]) {
        const ko = s * (Tl / 2 + 0.06);
        if (wet) { if (sg.horiz) mb.box('stone', mx, 0.02, mz + ko, Tl + 0.02, 0.22, 0.2, '#6a625a'); else mb.box('stone', mx + ko, 0.02, mz, 0.2, 0.22, Tl + 0.02, '#6a625a'); }
        const wo = s * (Tl * 1.5 - 0.04);
        if (K3.hash(t, s, 19) < 0.55) { if (sg.horiz) mb.box('paint', mx, 0.3, mz + wo, Tl * (0.5 + K3.hash(t, s, 4) * 0.5), 0.6, 0.04, MOSS); else mb.box('paint', mx + wo, 0.3, mz, 0.04, 0.6, Tl * (0.5 + K3.hash(t, s, 4) * 0.5), MOSS); }
        if (K3.hash(t, s, 23) < 0.18) { if (sg.horiz) mb.box('paint', mx, 1.4, mz + wo, 0.25, 1.6, 0.03, SLIME); else mb.box('paint', mx + wo, 1.4, mz, 0.03, 1.6, 0.25, SLIME); }
      }
      // a torch on the wall every few paces, on alternate sides
      if (torches && (t - sg.a) % 8 === 4) { const s = (t + sg.c) % 2 ? 1 : -1, wo = s * (Tl * 1.5 - 0.16); torches.push(sg.horiz ? { x: mx, y: 2.0, z: mz + wo } : { x: mx + wo, y: 2.0, z: mz }); }
      // an old iron pipe along one wall of some tunnels, on brackets
      const pipeSide = (sg.c + sg.a) % 3 === 0 ? 1 : (sg.c + sg.a) % 3 === 1 ? -1 : 0;
      if (pipeSide) {
        const po = pipeSide * (Tl * 1.5 - 0.3);
        if (sg.horiz) mb.cyl('metalv', mx, 1.75, mz + po, 0.17, Tl + 0.02, '#4a4842', 10, null, 0, 0, Math.PI / 2); else mb.cyl('metalv', mx + po, 1.75, mz, 0.17, Tl + 0.02, '#4a4842', 10, null, 0, Math.PI / 2, 0);
        if (t % 2 === 0) { if (sg.horiz) mb.box('metalv', mx, 1.75, mz + po + pipeSide * 0.15, 0.08, 0.42, 0.3, IRON); else mb.box('metalv', mx + po + pipeSide * 0.15, 1.75, mz, 0.3, 0.42, 0.08, IRON); }
      }
    }
  }
  // junctions and chambers: corner piers, ribs across the ceiling, and a grate of daylight in the middle
  const nodes = []; for (const x of sw.cols) for (const y of sw.rows) nodes.push({ x, y, r: 2 });
  const rooms = dd.rooms || [];
  const all = rooms.concat(nodes.filter((n) => !rooms.some((o) => o.x === n.x && o.y === n.y)));
  for (const o of all) {
    if (!inChunk(o.x, o.y) || !open(o.x, o.y)) continue;
    const r = o.r, mx = (o.x + 0.5) * Tl, mz = (o.y + 0.5) * Tl, half = (r + 0.5) * Tl, H = geo.ceilH;
    // piers in the corners (where the floor reaches a corner of the room)
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const tx = o.x + sx * r, ty = o.y + sz * r; if (!open(tx, ty)) continue;
      const px = mx + sx * (half - 0.35), pz = mz + sz * (half - 0.35);
      mb.boxB('stone', px, -0.1, pz, 0.7, H + 0.1, 0.7, BRICK_D).boxB('stone', px, -0.1, pz, 0.9, 0.5, 0.9, '#6a625a').box('stone', px, H - 0.25, pz, 0.95, 0.3, 0.95, '#6a625a');
    }
    // two ribs crossing under the ceiling
    for (const along of [0, 1]) for (let k = -r; k <= r; k++) {
      const x = along ? mx + k * Tl : mx, z = along ? mz : mz + k * Tl; const d = Math.abs(k) / (r + 0.5);
      const y = H - 0.2 - d * d * 0.9;
      mb.box('stone', x, y, z, along ? Tl + 0.04 : 0.45, 0.4, along ? 0.45 : Tl + 0.04, BRICK_D);
    }
    // daylight through a grate above (not in the boss's hall or Vinny's cell)
    const cellR = dd.cell && dd.cell.x === o.x && dd.cell.y === o.y;
    if (!o.hall && !cellR) {
      mb.box('glow', mx, H - 0.02, mz, 1.2, 0.02, 1.2, '#c8d4dc');
      for (let k = -2; k <= 2; k++) { mb.box('metalv', mx + k * 0.26, H - 0.06, mz, 0.06, 0.06, 1.3, IRON); mb.box('metalv', mx, H - 0.07, mz + k * 0.26, 1.3, 0.06, 0.06, IRON); }
      mb.box('stone', mx, H - 0.08, mz, 1.6, 0.1, 1.6, '#4a4440');
    }
    if (cellR) { // Vinny's cell: a barred gate across one side
      for (let k = -r; k <= r; k++) mb.boxB('metalv', mx + k * Tl * 0.5, 0, mz + half - 0.1, 0.06, 2.6, 0.06, IRON);
    }
  }
  // cisterns: a stone parapet round the deep water, a column at each corner up to the ceiling
  for (const [ax, ay, bx, by] of sw.pools) {
    const cx = (ax + bx) / 2, cy = (ay + by) / 2; if (!inChunk(Math.round(cx), Math.round(cy))) continue;
    let dx0 = ax, dy0 = ay, dx1 = bx, dy1 = by; // the deep part
    while (dx0 <= dx1 && W.tile(dx0, Math.round(cy)) !== T.DEEP) dx0++; while (dx1 >= dx0 && W.tile(dx1, Math.round(cy)) !== T.DEEP) dx1--;
    while (dy0 <= dy1 && W.tile(Math.round(cx), dy0) !== T.DEEP) dy0++; while (dy1 >= dy0 && W.tile(Math.round(cx), dy1) !== T.DEEP) dy1--;
    if (dx0 > dx1 || dy0 > dy1) continue;
    const X0 = dx0 * Tl, X1 = (dx1 + 1) * Tl, Z0 = dy0 * Tl, Z1 = (dy1 + 1) * Tl;
    for (const z of [Z0, Z1]) mb.boxB('stone', (X0 + X1) / 2, -0.2, z, X1 - X0 + 0.4, 0.75, 0.4, '#6a625a');
    for (const x of [X0, X1]) mb.boxB('stone', x, -0.2, (Z0 + Z1) / 2, 0.4, 0.75, Z1 - Z0 + 0.4, '#6a625a');
    for (const x of [X0, X1]) for (const z of [Z0, Z1]) mb.cylB('stone', x, -0.2, z, 0.32, geo.ceilH + 0.2, BRICK_D, 12);
    // a pipe pouring into the cistern
    mb.cyl('metalv', (X0 + X1) / 2, 2.6, Z0 - 0.1, 0.26, 0.8, '#4a4842', 12, null, 0, Math.PI / 2, 0);
  }
  // side passages: a ladder up the end wall to a grate of daylight
  for (const sp of sw.spurs) {
    if (!inChunk(sp.x, sp.y)) continue;
    const [dx, dy] = sp.dir; const mx = (sp.x + 0.5) * Tl + dx * (Tl / 2 - 0.12), mz = (sp.y + 0.5) * Tl + dy * (Tl / 2 - 0.12), H = geo.ceilH;
    const px = -dy, pz = dx; // across the passage
    for (const s of [-0.32, 0.32]) mb.boxB('metalv', mx + px * s, 0, mz + pz * s, 0.06, H, 0.06, RUST);
    for (let y = 0.3; y < H - 0.1; y += 0.35) mb.box('metalv', mx, y, mz, px ? 0.7 : 0.05, 0.05, pz ? 0.7 : 0.05, RUST);
    const gx = (sp.x + 0.5) * Tl, gz = (sp.y + 0.5) * Tl;
    mb.box('glow', gx, H - 0.02, gz, 1.0, 0.02, 1.0, '#d4dee6');
    for (let k = -1; k <= 1; k++) mb.box('metalv', gx + px * k * 0.3, H - 0.06, gz + pz * k * 0.3, px ? 0.06 : 1.1, 0.06, pz ? 0.06 : 1.1, IRON);
    // the narrow passage's own low lintels
    for (let k = 0; k < sp.len; k++) { const tx = sp.x - dx * k, ty = sp.y - dy * k; if (k % 2) continue; mb.box('stone', (tx + 0.5) * Tl, 3.3, (ty + 0.5) * Tl, dx ? 0.4 : Tl + 0.04, 0.4, dy ? 0.4 : Tl + 0.04, BRICK_D); }
  }
}
