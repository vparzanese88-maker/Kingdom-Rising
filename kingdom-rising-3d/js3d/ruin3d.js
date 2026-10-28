// Kingdom Rising 3D — buildings under attack. Every kingdom building has a body in the world (js/warmarch.js, "war and
// workers": e.bldg) that soldiers and the heroes of the other kingdom can hit. Its model here draws nothing of the
// building itself (realm3d.js and structures.js do that): it adds smoke as the building is damaged, flames that grow as
// it burns, and a smouldering heap of rubble when it falls. The Town Hall burns but never falls.
import { THREE, K3, PX } from './core.js';
import { MB } from './mb.js';
import { fx, rgb } from './fx.js';
import { geo } from './geo.js';

const KR = window.KR, G = KR.G;
const FIRE = [rgb('#ffb040'), rgb('#ff7a20'), rgb('#ffd070')];

function rubble(e) {
  const mb = new MB(); const w = (e.bw || 96) * PX, d = (e.bd || 96) * PX; let s = 7;
  const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const n = Math.round(10 + w * d * 0.9);
  for (let i = 0; i < n; i++) {
    const x = (rnd() - 0.5) * w * 0.9, z = (rnd() - 0.5) * d * 0.9; const r = 0.25 + rnd() * 0.6; const mound = 1 - Math.hypot(x / w, z / d) * 1.4;
    const stone = rnd() < 0.6;
    mb.box(stone ? 'stone' : 'timber', x, Math.max(0, mound) * 1.2 + r * 0.4, z, r * (stone ? 1.2 : 2.6), r * 0.7, r * (stone ? 1 : 0.35), stone ? K3.shade('#8a8278', (rnd() - 0.5) * 0.3) : '#2a1e14', rnd() * 0.6, rnd() * 3, rnd() * 0.6);
  }
  // a few charred beams standing up out of the heap
  for (let i = 0; i < 4; i++) { const x = (rnd() - 0.5) * w * 0.6, z = (rnd() - 0.5) * d * 0.6; mb.box('timber', x, 1.1, z, 0.22, 2.4 + rnd() * 1.5, 0.22, '#1e1610', (rnd() - 0.5) * 0.7, 0, (rnd() - 0.5) * 0.7); }
  return mb.build();
}

export function bldgModel(e) {
  const obj = new THREE.Group(); obj.name = 'bldg';
  const H = Math.max(2, (e.h || 120) * PX);
  const parts = {};
  parts.anim = (av, e2, dt) => {
    // the body sits where the building stands: no turning, no sinking when it falls
    av.obj.rotation.y = 0; if (av.model && av.model.obj) av.model.obj.rotation.y = -av.yaw;
    const cam = K3.camera && K3.camera.position; const x0 = e2.x * PX, z0 = e2.y * PX;
    if (cam && Math.hypot(cam.x - x0, cam.z - z0) > 140) return;
    const y0 = geo.floorAt ? geo.floorAt(e2.x, e2.y) : 0;
    const dmg = e2.dead || e2.razed ? 1 : 1 - Math.max(0, e2.hp) / Math.max(1, e2.hpMax);
    if ((e2.dead || e2.razed) && !e2.hall) {
      if (!parts.heap) { parts.heap = rubble(e2); obj.add(parts.heap); }
      // the heap smoulders for a while, then only a thin smoke now and then
      const age = (G.now - (e2.razedAt || G.now)) / 1000; if (Math.random() > (age < 60 ? 0.6 : 0.08)) return;
      fx.smoke.emit({ x: x0 + (Math.random() - 0.5) * (e2.bw || 96) * PX * 0.6, y: y0 + 0.6, z: z0 + (Math.random() - 0.5) * (e2.bd || 96) * PX * 0.6, vx: 0.3, vy: 1.2 + Math.random(), vz: 0.2, drag: 0.6, life: 3.5, s0: 0.8, s1: 3.2, r: 0.22, g: 0.2, b: 0.19, a: 0.5, kind: 2 });
      if (age < 30 && Math.random() < 0.3) fx.add.emit({ x: x0 + (Math.random() - 0.5) * (e2.bw || 96) * PX * 0.5, y: y0 + 0.4, z: z0 + (Math.random() - 0.5) * (e2.bd || 96) * PX * 0.5, vy: 0.8, life: 0.5, s0: 0.5, s1: 0.1, r: 2.6, g: 0.9, b: 0.2, kind: 0 });
      return;
    }
    if (parts.heap) { obj.remove(parts.heap); parts.heap = null; }
    if (dmg < 0.12) return;
    const W2 = (e2.bw || 96) * PX, D2 = (e2.bd || 96) * PX;
    // smoke from the first blows, flames from a quarter down, a blaze below half
    const smokeN = dmg * 2.2, fireN = Math.max(0, dmg - 0.25) * 9;
    for (let i = 0; i < smokeN; i++) {
      if (Math.random() > 0.5) continue;
      fx.smoke.emit({ x: x0 + (Math.random() - 0.5) * W2 * 0.8, y: y0 + H * (0.55 + Math.random() * 0.4), z: z0 + (Math.random() - 0.5) * D2 * 0.8, vx: 0.4 + Math.random() * 0.4, vy: 1.6 + Math.random() * 1.5 * dmg, vz: 0.2,
        drag: 0.5, life: 3 + dmg * 3, s0: 0.8 + dmg, s1: 3 + dmg * 5, r: 0.16 - dmg * 0.08, g: 0.15 - dmg * 0.08, b: 0.14 - dmg * 0.08, a: 0.35 + dmg * 0.35, kind: 2 });
    }
    for (let i = 0; i < fireN; i++) {
      if (Math.random() > 0.55) continue;
      const c = FIRE[Math.floor(Math.random() * 3)]; const big = dmg > 0.55;
      fx.add.emit({ x: x0 + (Math.random() - 0.5) * W2 * (big ? 0.95 : 0.6), y: y0 + H * (big ? 0.2 + Math.random() * 0.8 : 0.6 + Math.random() * 0.4), z: z0 + (Math.random() - 0.5) * D2 * (big ? 0.95 : 0.6),
        vx: (Math.random() - 0.5) * 0.4, vy: 1.5 + Math.random() * 2.5, vz: (Math.random() - 0.5) * 0.4, life: 0.5 + Math.random() * 0.6, s0: big ? 1.2 + Math.random() : 0.6 + Math.random() * 0.5, s1: 0.15, r: c[0] * 2.4, g: c[1] * 2, b: c[2] * 1.4, kind: 0 });
    }
    if (dmg > 0.5 && Math.random() < dmg * 0.25) fx.add.emit({ x: x0 + (Math.random() - 0.5) * W2, y: y0 + H, z: z0 + (Math.random() - 0.5) * D2, vy: 4 + Math.random() * 3, vx: (Math.random() - 0.5) * 2, vz: (Math.random() - 0.5) * 2, grav: -0.5, life: 1.6, s0: 0.12, s1: 0.05, r: 3, g: 1.6, b: 0.4, kind: 0 }); // embers
  };
  return { obj, parts, height: H };
}
