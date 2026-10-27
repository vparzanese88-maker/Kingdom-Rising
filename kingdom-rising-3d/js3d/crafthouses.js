// Kingdom Rising 3D — every crafting house looks like what it is from the street: the smithy has a roaring
// open forge with a chimney, bellows, anvil and quench barrel; the tailor an awning and drying cloth; the
// fletcher an archery butt; the armorer a mannequin in plate; the jeweller a glowing display; and so on.
// Built in front of the street wall (south face) beside the door, from the same block builder as the houses.
import { K3 } from './core.js';

const shade = (c, k) => K3.shade(c, k);
// the yard in front of the house: u runs along the front wall, v away from it (into the street)
function frame(b, X0, X1, Z1, y0, dX0, dX1) {
  const left = dX0 - X0, right = X1 - dX1; const useRight = right >= left;
  const u0 = useRight ? dX1 + 0.35 : X0 + 0.2, u1 = useRight ? X1 - 0.2 : dX0 - 0.35;
  return { u0, u1, uc: (u0 + u1) / 2, w: Math.max(0, u1 - u0), z: Z1, y: y0, side: useRight ? 1 : -1 };
}
function awning(mb, uL, uR, z, y, depth, cols) {
  const n = Math.max(2, Math.round((uR - uL) / 0.5)); const w = (uR - uL) / n;
  for (let k = 0; k < n; k++) mb.box('cloth2', uL + (k + 0.5) * w, y - depth * 0.2, z + depth / 2, w, 0.04, depth + 0.05, cols[k % cols.length], 0, -0.38, 0);
  for (let k = 0; k <= n; k += 2) mb.box('cloth2', uL + (k + 0.25) * w, y - depth * 0.42 - 0.12, z + depth - 0.02, w * 0.5, 0.22, 0.03, cols[k % cols.length]);
  mb.box('timber', (uL + uR) / 2, y + 0.04, z + 0.03, uR - uL + 0.1, 0.08, 0.08, '#4a3220');
}
// how much open ground (metres) lies in front of the house between u0 and u1, up to 3 tiles out
function freeDepth(b, u0, u1) {
  const W = window.KR.W, TL = 1.6; let rows = 0;
  for (let r = 0; r < 3; r++) {
    const ty = b.y + b.h + r; let ok = true;
    for (let tx = Math.floor(u0 / TL); tx <= Math.floor((u1 - 0.01) / TL); tx++) {
      const px = tx * 32 + 16, py = ty * 32 + 16; const ob = W.buildingAt(px, py);
      if ((ob && ob !== b) || (window.KR.SOLID && window.KR.SOLID[W.tile(tx, ty)])) { ok = false; break; }
    }
    if (!ok) break; rows++;
  }
  return rows * TL;
}
export function craftFront(mb, b, st, X0, X1, Z0, Z1, y0, dX0, dX1, top, structs) {
  const f = frame(b, X0, X1, Z1, y0, dX0, dX1); if (f.w < 1.2) return;
  const room = freeDepth(b, f.u0, f.u1); // the street in front can be narrow: everything is fitted to it
  if (room < 0.8) return;
  const D = (v) => Math.min(v, room - 0.25); // clamp a distance from the wall to the free ground
  const g = y0 + 0.02, z = Z1;
  switch (b.type) {
    case 'smithy': case 'forge': {
      // a stone hearth under a lean-to, with a tall chimney, glowing coals and a real fire
      const deep = room >= 2.6; const hw = Math.min(1.7, f.w - 0.2), hx = f.uc, hz = z + Math.min(0.75, D(0.75));
      mb.boxB('stone', hx, g, hz, hw, 0.95, 1.1, '#6a625a');
      mb.boxB('stone', hx, g + 0.95, hz, hw + 0.12, 0.1, 1.22, '#4a443e');
      mb.box('glow', hx, g + 1.0, hz + 0.05, hw - 0.4, 0.06, 0.6, '#ff5a1a'); // coals
      for (let k = 0; k < 7; k++) mb.sph('glow', hx + (Math.random() - 0.5) * (hw - 0.6), g + 1.04, hz + (Math.random() - 0.5) * 0.4, 0.12, 0.07, 0.12, k % 2 ? '#ffb040' : '#ff6a20');
      // hood and chimney
      mb.box('stone', hx, g + 2.05, hz - 0.05, hw + 0.1, 0.9, 1.0, '#5a524a', 0, 0.12, 0);
      mb.boxB('stone', hx, g + 2.4, hz - 0.2, 0.75, top - g - 0.4 + 1.6, 0.75, '#5a524a');
      mb.box('stone', hx, top + 1.6 + 0.05, hz - 0.2, 0.92, 0.16, 0.92, '#3a3430');
      structs.chimneys.push({ x: hx, y: top + 1.75, z: hz - 0.2, b, forge: true });
      // lean-to roof on two posts (when the street is wide enough)
      if (deep) {
        const rx0 = f.u0 - 0.05, rx1 = f.u1 + 0.05, rz = z + D(2.05);
        for (const px of [rx0 + 0.1, rx1 - 0.1]) mb.boxB('timber', px, g, rz, 0.16, 2.55, 0.16, '#4a3220');
        mb.box('planks', (rx0 + rx1) / 2, g + 2.75, z + (rz - z) / 2, rx1 - rx0 + 0.3, 0.07, rz - z + 0.35, '#6a4a2a', 0, 0.3, 0);
      }
      // anvil on a stump, quench barrel, bellows, coal pile, tools on the wall
      const ax = deep ? hx + f.side * -0.2 : hx - f.side * (hw / 2 + 0.55), az = deep ? z + D(1.75) : z + D(0.6);
      mb.cylB('bark', ax, g, az, 0.3, 0.5, '#5a3a20', 10); mb.boxB('metalv', ax, g + 0.5, az, 0.52, 0.18, 0.2, '#2e2e32'); mb.box('metalv', ax + 0.3, g + 0.62, az, 0.18, 0.08, 0.12, '#2e2e32', 0, 0, 0.3);
      if (deep) { mb.cylB('planks', hx - f.side * (hw / 2 + 0.45), g, hz + 0.6, 0.32, 0.75, '#6a4a2a', 12); mb.cyl('water', hx - f.side * (hw / 2 + 0.45), g + 0.7, hz + 0.6, 0.29, 0.02, '#2a4a5a', 12); }
      mb.box('leather', hx + f.side * (hw / 2 + 0.3), g + 0.75, hz + 0.1, 0.55, 0.2, 0.42, '#5a3a22', 0, 0, f.side * 0.25);
      for (let k = 0; k < 6; k++) mb.sph('rock', hx + f.side * (hw / 2 + 0.35) + (Math.random() - 0.5) * 0.4, g + 0.1, z + D(0.9) + Math.random() * 0.2, 0.18, 0.14, 0.18, '#1e1c1a');
      for (let k = 0; k < 3; k++) mb.box('metalv', f.u0 + 0.3 + k * 0.22, g + 1.9, z + 0.06, 0.04, 0.6, 0.03, '#3a3a3e');
      structs.fires.push({ x: hx, y: g + 1.05, z: hz + 0.05, w: 0.7, h: 0.9, big: true });
      break;
    }
    case 'tailor': {
      awning(mb, f.u0 - 0.2, f.u1 + 0.2, z, top - 1.4, Math.min(1.2, room - 0.2), ['#8a3a6a', '#e8dcc0']);
      // a stall of folded bolts in every colour
      mb.boxB('planks', f.uc, g, z + D(0.75), Math.min(1.8, f.w), 0.85, 0.7, '#7a5a3a');
      const cols = ['#b83a3a', '#3a6ab8', '#d8b04a', '#4a8a4a', '#8a4a9a', '#e8e0d0'];
      cols.forEach((c, k) => mb.box('cloth2', f.uc - 0.65 + k * 0.26, g + 0.95, z + D(0.75), 0.22, 0.18 + (k % 2) * 0.06, 0.5, c));
      // a drying line with lengths of cloth
      if (room >= 2.5) { const lz = z + D(2.0); mb.boxB('timber', f.u0, g, lz, 0.1, 2.1, 0.1, '#4a3220'); mb.boxB('timber', f.u1, g, lz, 0.1, 2.1, 0.1, '#4a3220');
      mb.box('leather', f.uc, g + 2.02, lz, f.w, 0.02, 0.02, '#c8b898');
      for (let k = 0; k < 4; k++) mb.box('cloth2', f.u0 + (k + 0.5) * f.w / 4, g + 1.62, lz, f.w / 4 - 0.1, 0.8, 0.02, cols[(k + 2) % cols.length]); }
      break;
    }
    case 'armorer': case 'armory': case 'weaponsmith': {
      awning(mb, f.u0 - 0.2, f.u1 + 0.2, z, top - 1.4, Math.min(1.1, room - 0.2), b.type === 'weaponsmith' ? ['#7a2a2a', '#3a3a3e'] : ['#28457a', '#c8c0b0']);
      if (b.type === 'weaponsmith') {
        // a weapon rack and a grindstone
        mb.boxB('timber', f.uc, g, z + 0.6, Math.min(1.6, f.w), 0.12, 0.35, '#4a3220'); mb.box('timber', f.uc, g + 1.3, z + 0.55, Math.min(1.6, f.w), 0.1, 0.12, '#4a3220');
        for (let k = 0; k < 5; k++) { const x = f.uc - 0.6 + k * 0.3; mb.box('metalv', x, g + 0.9, z + 0.58, 0.06, 1.15, 0.02, '#c8ccd4'); mb.box('gold', x, g + 0.35, z + 0.58, 0.18, 0.04, 0.05, '#c8a040'); }
        const gx = f.u1 - 0.4; if (room >= 2.2) mb.boxB('timber', gx, g, z + D(1.6), 0.6, 0.55, 0.12, '#4a3220'); if (room >= 2.2) mb.cyl('stone', gx, g + 0.75, z + D(1.6), 0.35, 0.14, '#8a8478', 16, null, 0, 0, Math.PI / 2);
      } else {
        // a mannequin in plate and a row of shields on the wall
        const mx = f.uc, mz = z + D(1.0); mb.cylB('timber', mx, g, mz, 0.04, 1.2, '#4a3220', 6); mb.cylB('timber', mx, g, mz, 0.25, 0.05, '#4a3220', 10);
        mb.box('metalv', mx, g + 1.45, mz, 0.46, 0.55, 0.28, '#b8bcc4'); mb.box('metalv', mx, g + 1.15, mz, 0.4, 0.14, 0.26, '#9a9ea6');
        for (const s of [-1, 1]) mb.sph('metalv', mx + s * 0.3, g + 1.68, mz, 0.16, 0.12, 0.16, '#c8ccd4');
        mb.sph('metalv', mx, g + 1.92, mz, 0.15, 0.19, 0.16, '#b8bcc4');
        for (let k = 0; k < 3; k++) { const sx = f.u0 + 0.35 + k * 0.6; if (sx > f.u1) break; mb.box('paint', sx, g + 2.0, z + 0.08, 0.42, 0.5, 0.04, ['#7a2a2a', '#28457a', '#2e6a3c'][k]); mb.box('gold', sx, g + 2.0, z + 0.1, 0.08, 0.36, 0.03, '#d8b048'); }
      }
      break;
    }
    case 'fletcher': case 'bowyer': {
      awning(mb, f.u0 - 0.2, f.u1 + 0.2, z, top - 1.4, Math.min(1.0, room - 0.2), ['#3f6b35', '#d8c8a0']);
      // an archery butt with painted rings and a barrel of arrows
      if (room < 2.2) break; const tx = f.uc, tz = z + D(1.6);
      mb.boxB('timber', tx - 0.3, g, tz + 0.15, 0.08, 1.1, 0.08, '#4a3220'); mb.boxB('timber', tx + 0.3, g, tz + 0.15, 0.08, 1.1, 0.08, '#4a3220');
      mb.cyl('cloth2', tx, g + 1.2, tz, 0.55, 0.25, '#d8c070', 16, null, 0, Math.PI / 2, 0);
      [['#e8e0d0', 0.48], ['#2a2a2a', 0.38], ['#3a6ab8', 0.28], ['#c83a2a', 0.18], ['#e8c040', 0.08]].forEach(([c, r], i) => mb.cyl('paint', tx, g + 1.2, tz + 0.13 + i * 0.004, r, 0.01, c, 20, null, 0, Math.PI / 2, 0));
      for (let k = 0; k < 3; k++) mb.box('timber', tx - 0.1 + k * 0.12, g + 1.25 + k * 0.05, tz + 0.3, 0.015, 0.015, 0.45, '#8a6a3a', 0, 0.1, 0);
      const bx = f.u0 + 0.35; mb.cylB('planks', bx, g, z + D(0.6), 0.25, 0.6, '#6a4a2a', 10); for (let k = 0; k < 7; k++) mb.box('timber', bx + (Math.random() - 0.5) * 0.25, g + 0.85, z + D(0.6) + (Math.random() - 0.5) * 0.25, 0.012, 0.6, 0.012, '#8a6a3a', 0, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3);
      break;
    }
    case 'scribe': {
      awning(mb, f.u0 - 0.2, f.u1 + 0.2, z, top - 1.4, Math.min(0.9, room - 0.2), ['#3a2a5a', '#e0c060']);
      mb.boxB('planks', f.uc, g, z + D(0.6), Math.min(1.4, f.w), 0.9, 0.55, '#6a4a2a');
      for (let k = 0; k < 4; k++) mb.cyl('cloth2', f.uc - 0.45 + k * 0.3, g + 0.96, z + D(0.6), 0.05, 0.4, '#efe6cc', 10, null, 0, 0, Math.PI / 2);
      for (const s of [-1, 1]) { mb.box('metalv', f.uc + s * 0.6, top - 1.5, z + 0.95, 0.03, 0.4, 0.03, '#2a2a2a'); mb.box('glow', f.uc + s * 0.6, top - 1.85, z + 0.95, 0.16, 0.24, 0.16, '#ffcf7a'); structs.fires.push({ x: f.uc + s * 0.6, y: top - 1.85, z: z + 0.95, w: 0.18, h: 0.22, lamp: true }); }
      break;
    }
    case 'jeweler': case 'gemcutter': {
      awning(mb, f.u0 - 0.2, f.u1 + 0.2, z, top - 1.4, Math.min(0.9, room - 0.2), ['#5a2a4a', '#e0c060']);
      const cx = f.uc, cz = z + D(0.65); mb.boxB('timber', cx, g, cz, Math.min(1.3, f.w), 0.85, 0.55, '#3a2418'); mb.boxB('glass', cx, g + 0.85, cz, Math.min(1.3, f.w) - 0.1, 0.35, 0.48, '#c8e0f0');
      ['#ff4a6a', '#4a9aff', '#5adc8a', '#c8a8ff', '#ffd84a'].forEach((c, k) => mb.sph('glow', cx - 0.45 + k * 0.22, g + 0.93, cz, 0.06, 0.06, 0.06, c));
      structs.fires.push({ x: cx, y: g + 1.0, z: cz, w: 0.2, h: 0.2, gem: true });
      break;
    }
    case 'store': {
      awning(mb, f.u0 - 0.2, f.u1 + 0.2, z, top - 1.4, Math.min(1.1, room - 0.2), ['#b8462e', '#e8dcc0']);
      for (let k = 0; k < 3; k++) mb.boxB('planks', f.u0 + 0.4 + k * 0.7, g, z + D(0.7 + (k % 2) * 0.3), 0.6, 0.55, 0.6, '#8a6a3a');
      if (room >= 2) for (let k = 0; k < 2; k++) mb.cylB('planks', f.u1 - 0.35 - k * 0.6, g, z + D(1.5), 0.28, 0.75, '#6a4a2a', 12);
      break;
    }
  }
}
