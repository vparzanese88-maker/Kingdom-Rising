// Kingdom Rising 3D — torches, lamps, braziers and hearths light the world: a small pool of real point
// lights is moved every frame to the fires nearest the camera, flickering like the 2D game's lights
import { THREE, K3, TS, PX } from './core.js';
import { geo } from './geo.js';

const KR = window.KR, W = KR.W, G = KR.G;
const pool = [];
let cands = [];
export const lights = { pool, cands };
function ensurePool() {
  const n = K3.quality.lights;
  while (pool.length < n) { const l = new THREE.PointLight(0xffaa66, 0, 16, 2); l.castShadow = false; K3.scene.add(l); pool.push({ l, c: null, i: 0 }); }
  while (pool.length > n) { const p = pool.pop(); K3.scene.remove(p.l); }
}
K3.onQuality.push(ensurePool);

const HEIGHT = { lamp: 2.5, fire: 0.9, magic: 2.2, ghost: 2.6 };
const KIND_I = { lamp: 14, fire: 22, magic: 12, ghost: 9 };
// build the list of light sources for the realm, snapping each to the nearest flame model
export function buildLights(flames) {
  ensurePool();
  cands = [];
  const fl = flames.filter((f) => f.kind === 0 || f.kind === 1);
  for (const L of W.lights) {
    const k = L.k || 'fire';
    let x = L.x * PX, z = (L.y + (k === 'lamp' ? 36 : k === 'ghost' ? 70 : 8)) * PX;
    const fy = geo.floorAt(x / PX, z / PX);
    let y = fy + (HEIGHT[k] || 1.2);
    // nearest flame within 3 m
    let best = null, bd = 3;
    for (const f of fl) { const d = Math.hypot(f.x - x, f.z - z); if (d < bd) { bd = d; best = f; } }
    if (best) { x = best.x; z = best.z; y = best.y + (best.kind === 0 ? best.h * 0.6 : 0.1); }
    const c = String(L.col || '255,180,100').split(',').map((v) => +v / 255);
    cands.push({ x, y, z, r: Math.max(8, (L.r || 160) * PX * 1.7), col: new THREE.Color(c[0], c[1], c[2]).convertSRGBToLinear(), fl: L.fl || 0.1, base: KIND_I[k] || 16, b: L.b || null, ph: Math.random() * 10, k });
  }
  lights.cands = cands;
}
const _v = new THREE.Vector3();
let tick = 0, chosen = [];
export function updateLights(dt, camPos, ctx) {
  tick -= dt;
  const darkness = K3.sky && Number.isFinite(K3.sky.darkness) ? K3.sky.darkness : 0.5;
  const inside = ctx.inside;
  if (tick <= 0) {
    tick = 0.25;
    // nearest candidates, a little favouring the ones in front of the camera
    const fwd = K3.view ? K3.view.fwd : _v.set(0, 0, -1);
    const sc = [];
    for (const c of cands) {
      const dx = c.x - camPos.x, dy = c.y - camPos.y, dz = c.z - camPos.z; const d = Math.hypot(dx, dy, dz);
      if (d > 70) continue;
      // lights inside a building only matter when you are in it (or right by its door)
      if (c.b && (!inside || inside.id !== c.b) && d > 14) continue;
      if (!c.b && inside && d > 16) continue;
      const front = (dx * fwd.x + dz * fwd.z) / (d || 1);
      sc.push([d * (front > -0.2 ? 1 : 1.6), c]);
    }
    sc.sort((a, b) => a[0] - b[0]);
    chosen = sc.slice(0, pool.length).map((s) => s[1]);
  }
  const t = K3.time;
  for (let i = 0; i < pool.length; i++) {
    const p = pool[i], c = chosen[i];
    if (!c) { p.l.intensity = Math.max(0, p.l.intensity - dt * 40); continue; }
    if (p.c !== c) { p.c = c; p.l.position.set(c.x, c.y, c.z); p.l.color.copy(c.col); p.l.distance = c.r; }
    const fl = 1 + Math.sin(t * 11 + c.ph) * c.fl * 0.6 + Math.sin(t * 23.7 + c.ph * 2) * c.fl * 0.4;
    const d = Math.hypot(c.x - camPos.x, c.z - camPos.z);
    const fade = 1 - K3.smooth(45, 68, d);
    const want = c.base * (0.18 + 0.82 * darkness) * fl * fade * (c.b ? 1 : 1);
    p.l.intensity += (want - p.l.intensity) * Math.min(1, dt * 12);
    if (!Number.isFinite(p.l.intensity)) p.l.intensity = 0;
  }
}
