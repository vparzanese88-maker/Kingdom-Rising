// Kingdom Rising 3D — a new hero's homecoming: a short aerial shot of your ship sailing straight into your
// capital's marina, down a clear lane between the moored ships, filmed from out ahead of the bow so the sails
// are always behind you, then you stand on the dock and the harbourmaster comes to meet you.
// No talk on the way in, and no skipping: it plays through, then the harbourmaster's scene follows.
import { THREE, K3, PX, TILE } from './core.js';
import { view } from './camera.js';
import { buildShip } from './ships.js';

const KR = window.KR, G = KR.G, W = KR.W, A = KR.A;
const cam = K3.camera;
const T_SAIL = 7, T_HOLD = 0.8; // seconds sailing in, then a moment at the berth

let intro = null;

export function startIntro(c, done) {
  const p = G.player; const cd = W.cityData[c.faction]; const H = cd && cd.harbour;
  if (!p || !H) return false;
  // tiles counted from the quay's edge (i) and along the shore (s), as the harbour lays them out
  const tile = (i, s) => [(H.gx + H.dx * (H.k + 1 + i) + H.px * s + 0.5) * TILE, (H.gy + H.dy * (H.k + 1 + i) + H.py * s + 0.5) * TILE];
  const isSea = (x, z) => { const t = W.tile(Math.floor(x / TILE), Math.floor(z / TILE)); return t === KR.T.WATER || t === KR.T.DEEP; };
  // the inner berth of the east basin is kept free for this ship: come in along that lane, straight from the sea,
  // clear of the piers and of every ship moored along them
  const LANE = 3.5, BERTH = 9;
  let far = BERTH; while (far < BERTH + 40) { const [x, z] = tile(far + 1, LANE); if (!isSea(x, z)) break; far++; }
  const [Sx, Sz] = tile(far, LANE), [Dx, Dz] = tile(BERTH, LANE);
  const yaw = Math.atan2(Dx - Sx, Dz - Sz); // bow toward the city
  const ship = buildShip('cog', 0.45); K3.scene.add(ship);
  // the overlay: letterbox bars
  const ov = document.createElement('div'); ov.className = 'k3-cine k3-intro';
  ov.innerHTML = `<div class="k3c-bar top"></div><div class="k3c-bar bot"></div><button class="btn small ghost k3c-skip">Skip ›</button>`;
  document.body.appendChild(ov);
  const ui = document.getElementById('ui'), hud = document.getElementById('hud3d'); const uiWas = ui ? ui.hidden : true; if (ui) ui.hidden = true; if (hud) hud.style.visibility = 'hidden';
  // the ships moored in the marina: if one ever comes between the camera and the hero, the camera rises over it
  const boats = []; K3.scene.traverse((o) => { if (o.userData && o.userData.anim && o.userData.anim.kind === 'boat') boats.push(o); });
  intro = { uiWas, c, p, t: 0, ship, ov, done, tile, S: [Sx, Sz], Dp: [Dx, Dz], yaw, out: [H.dx, H.dy], lat: [H.px, H.py], update: updateIntro, boats, lift: 0, hidden: [] };
  // the same ship lies moored at the berth once you are ashore (world.js harbour): it stays out of sight while this one sails in
  for (const b of boats) { const a = b.userData.anim; if (a.size && Math.hypot(a.x - Dx, a.z - Dz) < TILE * 3) { b.visible = false; intro.hidden.push(b); } }
  // a fine sunny morning
  G.clock = 9.5 * 60; if (G.weather) { G.weather.type = 'clear'; G.weather.t = Math.max(G.weather.t || 0, 200); }
  p.sit = false; p.moving = false;
  // Esc, Space, Enter, a click or the Skip button cut to the dock; other keys are swallowed until the shot is over
  intro.key = (e) => { e.stopImmediatePropagation(); e.preventDefault(); if (!e.repeat && (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter')) finish(); };
  intro.click = (e) => { e.stopImmediatePropagation(); e.preventDefault(); finish(); };
  addEventListener('keydown', intro.key, true); addEventListener('pointerdown', intro.click, true);
  try { A.play('harbor'); } catch (e) {}
  K3.cine = intro;
  updateIntro(0);
  return true;
}
function finish() {
  const n = intro; if (!n) return; intro = null; K3.cine = null;
  removeEventListener('keydown', n.key, true); removeEventListener('pointerdown', n.click, true);
  const p = n.p; p.introY = null; p.moving = false;
  const ui = document.getElementById('ui'), hud = document.getElementById('hud3d'); if (ui && !n.uiWas) ui.hidden = false; if (hud) hud.style.visibility = '';
  // you stand on the dock at the head of the pier, facing the city
  const [x, z] = n.tile(-1.5, 0.4); p.x = x / PX; p.y = z / PX;
  K3.scene.remove(n.ship); for (const b of n.hidden) b.visible = true;
  n.ov.classList.add('out'); setTimeout(() => n.ov.remove(), 900);
  view.want = view.dist = 0; view.pitch = -0.05; view.yaw = Math.atan2(n.out[0], n.out[1]);
  try { A.play(n.c.faction === 'sylvan' ? 'town_sylvan' : 'town_crown'); } catch (e) {}
  if (n.done) n.done();
  // then the harbourmaster comes to meet you (js/kingstory.js), before you can take a step
  try { if (KR.Story && KR.Story.arrive) KR.Story.arrive(); } catch (e) { console.warn(e); }
}
function updateIntro(dt) {
  const n = intro; if (!n) return; n.t += dt; const t = n.t, p = n.p;
  // the ship runs in on the wind and slows to a stop at the berth, rocking gently on the swell
  const u = Math.min(1, t / T_SAIL), e = 1 - Math.pow(1 - u, 2.2);
  const x = K3.lerp(n.S[0], n.Dp[0], e), z = K3.lerp(n.S[1], n.Dp[1], e);
  const roll = Math.sin(K3.time * 0.9) * 0.03 * (1 - u * 0.6), pitch = Math.sin(K3.time * 1.3 + 1) * 0.018, heave = Math.sin(K3.time * 1.1) * 0.1 * (1 - u * 0.5);
  n.ship.position.set(x, heave, z); n.ship.rotation.set(pitch, n.yaw, roll, 'YXZ'); n.ship.updateMatrixWorld(true);
  // the hero stands at the bow, looking toward home (drawn in third person)
  const bow = new THREE.Vector3(0, 3.68, 4.3).applyMatrix4(n.ship.matrixWorld);
  p.x = bow.x / PX; p.y = bow.z / PX; p.introY = bow.y; p.moving = false;
  view.want = view.dist = 3; view.turning = true; view.yaw = n.yaw + Math.PI;
  K3.vmVisible = false;
  // the camera: out ahead of the bow, high at first and coming down as she sails in, always looking back at the
  // hero standing at the bow, so the sail is behind them and never between you and them
  const fwd = [Math.sin(n.yaw), Math.cos(n.yaw)], side = [Math.cos(n.yaw), -Math.sin(n.yaw)];
  const k = K3.smooth(0, T_SAIL + T_HOLD, t);
  const dist = K3.lerp(24, 7.5, k), height = K3.lerp(21, 5.2, k), sway = K3.lerp(9, 2.5, k);
  const want = new THREE.Vector3(bow.x + fwd[0] * dist + side[0] * sway, bow.y + height + n.lift, bow.z + fwd[1] * dist + side[1] * sway);
  if (!n.cs) n.cs = want.clone(); else n.cs.lerp(want, Math.min(1, dt * 3));
  const look = new THREE.Vector3(K3.lerp(x, bow.x, k), K3.lerp(2.5, bow.y + 1.1, k), K3.lerp(z, bow.z, k));
  // nothing may hide the hero: rise over any moored ship in the way, and as a last resort leave it out of the shot
  if (n.boats.length && (n.chk = (n.chk || 0) + 1) % 3 === 0) {
    const head = new THREE.Vector3(bow.x, bow.y + 1.4, bow.z), to = n.cs.clone().sub(head); const L = to.length(); to.divideScalar(L || 1);
    const rc = n.rc || (n.rc = new THREE.Raycaster()); rc.set(head, to); rc.far = L;
    const hit = rc.intersectObjects(n.boats.filter((b) => b.visible), true)[0];
    if (hit) { if (n.lift < 14) n.lift = Math.min(14, n.lift + 0.6); else { let o = hit.object; while (o && !n.boats.includes(o)) o = o.parent; if (o) { o.visible = false; n.hidden.push(o); } } }
    else n.lift = Math.max(0, n.lift - 0.1);
  }
  cam.position.copy(n.cs);
  cam.lookAt(look);
  if (t >= T_SAIL + T_HOLD) finish();
}
K3.startIntro = startIntro;
