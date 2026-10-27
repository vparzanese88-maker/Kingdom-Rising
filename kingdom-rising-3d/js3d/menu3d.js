// Kingdom Rising 3D — the real world behind the cover page and the menus: the camera glides around the
// capitals at golden hour, over forests and along the river, cutting between shots like a film trailer.
import { THREE, K3, PX, TS, TILE } from './core.js';
import { geo } from './geo.js';
import { updateTerrain } from './terrain.js';
import { updateSky } from './sky.js';
import { world3d } from './world3d.js';
import { grass } from './grass.js';

const KR = window.KR, G = KR.G, W = KR.W, D = KR.D;
const cam = K3.camera;
const ground = (x, z) => geo.floorAt(x / PX, z / PX);
const _p = new THREE.Vector3(), _l = new THREE.Vector3();

// a shot is a function of time (0..1) that places the camera and says where it looks
function shots() {
  const out = [];
  const cities = D.FACTION_IDS.map((f) => W.cityData[f]).filter((c) => c && c.cx != null);
  const MW = W.W * TILE, MH = W.H * TILE;
  const clampX = (x) => K3.clamp(x, 30, MW - 30), clampZ = (z) => K3.clamp(z, 30, MH - 30);
  cities.forEach((cd, i) => {
    const cx = (cd.cx + 0.5) * TILE, cz = (cd.cy + 0.5) * TILE, R = (cd.R + 6) * TILE, gy = ground(cx, cz);
    // a slow, high circle round the walls
    out.push((t) => { const a = i * 2.1 + t * 0.9; _p.set(cx + Math.sin(a) * R * 1.25, gy + 24 + Math.sin(t * 3) * 2, cz + Math.cos(a) * R * 1.25); _l.set(cx, gy + 5, cz); });
    // a low sweep in from the fields, rising over the gate
    out.push((t) => { const a = i * 2.1 + 2.4, d = K3.lerp(R * 3.2, R * 1.2, t); _p.set(clampX(cx + Math.sin(a) * d), 0, clampZ(cz + Math.cos(a) * d)); _p.y = Math.max(ground(_p.x, _p.z) + 6 + t * 14, gy + 4 + t * 16); _l.set(cx, gy + 6, cz); });
  });
  // over the wild lands between the cities: forests, hills and the river
  if (cities.length >= 2) {
    const a = cities[0], b = cities[1];
    const ax = (a.cx + 0.5) * TILE, az = (a.cy + 0.5) * TILE, bx = (b.cx + 0.5) * TILE, bz = (b.cy + 0.5) * TILE;
    out.splice(2, 0, (t) => { const k = 0.3 + t * 0.25, side = 40; const nx = -(bz - az), nz = bx - ax, nl = Math.hypot(nx, nz) || 1;
      _p.set(K3.lerp(ax, bx, k) + nx / nl * side, 0, K3.lerp(az, bz, k) + nz / nl * side); _p.y = ground(_p.x, _p.z) + 18;
      _l.set(K3.lerp(ax, bx, k + 0.12), 0, K3.lerp(az, bz, k + 0.12)); _l.y = ground(_l.x, _l.z) + 4; });
  }
  return out;
}

const menu = { on: false, list: null, i: 0, t: 0, fade: null };
const SHOT = 15; // seconds per shot
let last = 0, lastDraw = 0;
function frame(now) {
  if (!menu.on) return;
  requestAnimationFrame(frame);
  if (KR.Main.isRunning() || !W.tiles) return;
  // the menus are a backdrop: 30 frames a second, and only 8 while a 3D hero is on screen (it gets the time)
  const fps = document.querySelector('canvas.k3-hero') ? 8 : 30;
  if (now - lastDraw < 1000 / fps - 1.5) return;
  lastDraw = now;
  const dt = Math.min(0.15, (now - (last || now)) / 1000); last = now;
  K3.dt = dt; K3.time += dt; K3.frame++; K3.frameTick(dt);
  K3.syncWorld();
  if (!menu.list) { menu.list = shots(); menu.i = 0; menu.t = 0; }
  if (!menu.list.length) return;
  G.clock = 19.45 * 60; // golden hour, always, under a clear sky
  if (G.weather) { G.weather.type = 'clear'; if (G.weather.t < 60) G.weather.t = 60; }
  menu.t += dt / SHOT;
  if (menu.t >= 1) { menu.t = 0; menu.i = (menu.i + 1) % menu.list.length; }
  // dip to black between shots
  const edge = Math.min(menu.t, 1 - menu.t) * SHOT; if (menu.fade) menu.fade.style.opacity = String(1 - K3.smooth(0, 0.8, edge));
  menu.list[menu.i](K3.smooth(0, 1, menu.t) * 0.7 + menu.t * 0.3);
  _p.y = Math.max(_p.y, ground(_p.x, _p.z) + 3);
  cam.position.copy(_p); cam.lookAt(_l);
  K3.vmVisible = false;
  world3d.update(dt, { inside: null, cam: cam.position, budget: 14 });
  updateSky(dt, cam.position, { inside: null, focus: _l });
  updateTerrain(cam.position);
  grass.update(cam.position);
  K3.render();
}
menu.start = function () {
  if (!menu.fade) { menu.fade = document.createElement('div'); menu.fade.className = 'k3-menufade'; document.body.appendChild(menu.fade); }
  menu.fade.hidden = false; document.body.classList.add('k3-menu');
  if (menu.on) return; menu.on = true; menu.list = null; last = 0; requestAnimationFrame(frame);
};
menu.stop = function () { menu.on = false; document.body.classList.remove('k3-menu'); if (menu.fade) menu.fade.hidden = true; };
K3.menu3d = menu;
export { menu };
