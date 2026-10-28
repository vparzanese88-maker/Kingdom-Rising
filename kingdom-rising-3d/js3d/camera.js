// Kingdom Rising 3D — first and third person camera: mouse look that steers the hero (hold right button), free look round the hero (left drag),
// scroll to zoom out to third person and back in to first person, collision with ground, walls and roofs
import { THREE, K3, PX, TS, TILE } from './core.js';
import { geo } from './geo.js';

const KR = window.KR, D = KR.D, W = KR.W, G = KR.G;
const cam = K3.camera;

export const view = {
  yaw: 0, pitch: -0.08, dist: 0, want: 0, // dist 0 = first person; yaw is where the hero faces and walks
  oyaw: 0, // the camera swung round the hero by a left-button drag (EverQuest free look), on top of yaw
  maxDist: 14, look: false, drag: null, bob: 0, shake: 0,
  eye: new THREE.Vector3(), focus: new THREE.Vector3(), fwd: new THREE.Vector3(),
};
K3.view = view;
view.want = K3.lsGet('kr3d_dist', 0); view.dist = view.want;

export function eyeHeight(p) {
  const race = D.RACES[p.c ? p.c.race : p.race] || {}; const sc = race.scale || 1;
  return 1.68 * sc;
}
view.firstPerson = () => view.dist < 0.6;

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
// how far the camera can pull back before hitting something
function clearDist(from, dir, want, inside) {
  if (want <= 0.01) return 0;
  const step = 0.18; let d = 0.25;
  for (; d < want; d += step) {
    const x = from.x + dir.x * d, y = from.y + dir.y * d, z = from.z + dir.z * d;
    if (inside) {
      // stay inside the room: between its walls and under its ceiling
      const b = inside; const x0 = (b.x + 1) * TILE + 0.25, x1 = (b.x + b.w - 1) * TILE - 0.25, z0 = (b.y + 1) * TILE + 0.25, z1 = (b.y + b.h - 1) * TILE - 0.25;
      if (x < x0 || x > x1 || z < z0 || z > z1 || y > (b._ceil3 || b._floor3 + 3.2) - 0.3) return Math.max(0, d - step);
      continue;
    }
    const g = geo.groundXZ(x, z); if (y < g + 0.35) return Math.max(0, d - step);
    if (geo.dungeon && geo.ceilAt && y > geo.ceilAt(x, z) - 0.3) return Math.max(0, d - step);
    const c = geo.solidTileXZ(x, z);
    if (c === 5) { const top = geo.structTop ? geo.structTop(x, z) : g + 6; if (y < top + 0.3) return Math.max(0, d - step); }
    if (geo.dungeon && (c === 1)) return Math.max(0, d - step);
    // trees and big rocks
    { const tx = Math.floor(x / TILE), ty = Math.floor(z / TILE); if (tx >= 0 && ty >= 0 && tx < W.W && ty < W.H && W.block[ty * W.W + tx] && y < g + 7) { const cx = (tx + 0.5) * TILE, cz = (ty + 0.5) * TILE; if (Math.hypot(x - cx, z - cz) < 0.75) return Math.max(0, d - step); } }
    // roofs and walls of buildings
    if (geo.roofAt) { const r = geo.roofAt(x, z); if (r != null && y < r + 0.25) return Math.max(0, d - step); }
  }
  return want;
}

export function updateCamera(dt, p) {
  // smooth zoom
  view.dist += (view.want - view.dist) * Math.min(1, dt * 10);
  if (Math.abs(view.dist - view.want) < 0.01) view.dist = view.want;
  view.pitch = K3.clamp(view.pitch, -1.45, 1.35);
  const ex = p.x * PX, ez = p.y * PX; const fy = K3.actorY ? K3.actorY(p) : geo.floorAt(p.x, p.y);
  // eyes lower slowly as the hero sits down cross-legged (the body's own sit animation drives it)
  const rig = K3.playerRig; const sitK = rig && rig.sitK != null ? K3.smooth(0, 1, rig.sitK) : p.sit ? 1 : 0;
  const eh = eyeHeight(p) * (1 - 0.47 * sitK) * (p.dead ? 0.3 : 1);
  // head bob in first person, in step with the feet: down as each foot lands, sway toward the planted foot
  const gp = rig && rig.gp != null ? rig.gp : 0;
  const bobOn = p.moving && view.firstPerson() && K3.settings.headBob ? 1 : 0;
  view.bobK = (view.bobK || 0) + (bobOn - (view.bobK || 0)) * Math.min(1, dt * 6);
  view.bob = gp * Math.PI * 2;
  const run = rig ? K3.smooth(2.3, 5.0, rig.gv || 0) : 0;
  const bob = -Math.cos(view.bob * 2) * (0.018 + 0.02 * run) * view.bobK;
  const sway = Math.cos(view.bob) * 0.012 * view.bobK;
  view.focus.set(ex, fy + eh * 0.92, ez);
  // hold the "look behind" key to glance back without turning
  const yaw = view.yaw + view.oyaw + (K3.keys && K3.keys.held('lookBack') ? Math.PI : 0);
  const fwd = view.fwd.set(-Math.sin(yaw) * Math.cos(view.pitch), Math.sin(view.pitch), -Math.cos(yaw) * Math.cos(view.pitch));
  const inside = W.buildingAt(p.x, p.y);
  if (view.firstPerson()) {
    cam.position.set(ex + Math.cos(yaw) * sway, fy + eh + bob, ez - Math.sin(yaw) * sway);
    // lean the eye slightly forward so you can see your feet without seeing inside your own head
    cam.position.x += -Math.sin(yaw) * 0.12; cam.position.z += -Math.cos(yaw) * 0.12;
  } else {
    const right = _v2.set(Math.cos(yaw), 0, -Math.sin(yaw));
    const pivot = _v.set(ex, fy + eh * 0.95, ez).addScaledVector(right, 0.42 * Math.min(1, view.dist / 4));
    const back = _v2.copy(fwd).multiplyScalar(-1);
    const d = clearDist(pivot, back, view.dist, inside);
    cam.position.copy(pivot).addScaledVector(back, Math.max(0.3, d));
  }
  if (K3.settings.shake === false) view.shake = 0;
  if (view.shake > 0) { cam.position.x += (Math.random() - 0.5) * view.shake * 0.15; cam.position.y += (Math.random() - 0.5) * view.shake * 0.15; view.shake = Math.max(0, view.shake - dt * 2.5); }
  if (G.shake > 0) { view.shake = Math.max(view.shake, G.shake * 1.5); G.shake = Math.max(0, G.shake - dt); }
  // blows landed and taken: a quick sine shake along a direction, dying away (motion.js / actors.js hit-stop)
  if (kicks.length) { for (let i = kicks.length - 1; i >= 0; i--) { const k = kicks[i]; k.t += dt; if (k.t > k.dur || K3.settings.shake === false) { kicks.splice(i, 1); continue; }
    const o = k.amp * Math.exp(-3.2 * k.t / k.dur) * Math.sin(2 * Math.PI * 27 * k.t); cam.position.x += o * k.dx; cam.position.y += o * k.dy; cam.position.z += o * k.dz; } }
  cam.rotation.set(view.pitch, yaw, 0, 'YXZ');
  const fov = K3.settings.fov; if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
  cam.updateMatrixWorld();
  view.eye.copy(cam.position);
}

const kicks = [];
K3.shakeHit = (amp, dur) => { const a = Math.random() * 6.283; kicks.push({ t: 0, amp, dur, dx: Math.cos(a) * 0.8, dy: 0.6, dz: Math.sin(a) * 0.8 }); if (kicks.length > 4) kicks.shift(); };
// player movement input relative to the camera (forward f, strafe s) -> 2D world direction
export function moveInput(f, s) {
  const sy = Math.sin(view.yaw), cy = Math.cos(view.yaw);
  return { mx: f * -sy + s * cy, my: f * -cy + s * -sy };
}

// a ray from the camera through a screen point
const ray = new THREE.Raycaster();
export function screenRay(sx, sy) {
  const ndc = new THREE.Vector2((sx / innerWidth) * 2 - 1, -(sy / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, cam);
  return ray.ray;
}
// where a ray hits the ground (march the height field)
export function rayGround(r, maxD = 160) {
  const o = r.origin, d = r.direction; let prev = 0;
  for (let t = 0.3; t < maxD; t += t < 20 ? 0.25 : 0.6) {
    const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
    const g = geo.floorAt(x / PX, z / PX);
    if (y <= g) { // refine
      let a = prev, b = t; for (let k = 0; k < 8; k++) { const m = (a + b) / 2; const yy = o.y + d.y * m; if (yy <= geo.floorAt((o.x + d.x * m) / PX, (o.z + d.z * m) / PX)) b = m; else a = m; }
      return new THREE.Vector3(o.x + d.x * b, o.y + d.y * b, o.z + d.z * b);
    }
    prev = t;
  }
  return null;
}
