// Kingdom Rising 3D — a new hero's homecoming: a minute-long film of the last leg of a long voyage. Dawn breaks over
// open sea as the ship runs before the wind; the camera finds the hero at the bow, swings over their shoulder as the
// capital rises out of the haze, soars up for the whole city and its harbour as the sun climbs, then waits on the pier
// as she glides in past the moored ships, the crew brailing up the sail, and eases alongside her berth.
// The ship follows one smooth curve with a steady heading (no pivoting on the spot), heeling gently into her turn;
// the camera blends from shot to shot without a cut. Esc, Space, Enter, a click or Skip goes straight to the dock.
import { THREE, K3, PX, TILE } from './core.js';
import { view } from './camera.js';
import { buildShip } from './ships.js';
import { fx } from './fx.js';

const KR = window.KR, G = KR.G, W = KR.W, A = KR.A, D = KR.D;
const cam = K3.camera;
const T_END = 60, T_FADE = 1.4; // the film runs a minute, then fades to the dock
const BERTH = 9, LANE = 3.5; // the arrival berth: tiles out from the quay's edge (i) and along the shore (s)
const SAIL_END = 56; // she is alongside here; the rest is the hold at the berth

let intro = null;

// ---- the ship's course: a smooth curve from far out at sea into the lane, sampled by distance ----
function course(tile, isSea) {
  // how far the open water reaches straight out from the berth (the lane is clear of piers and moored ships)
  let far = BERTH; while (far < BERTH + 40) { const [x, z] = tile(far + 1, LANE); if (!isSea(x, z)) break; far++; }
  // the long leg: as far out as the sea goes (up to 150 tiles), coming in on a sweeping curve from one side
  const clear = (i, s) => { for (let k = 0; k <= 6; k++) { const [x, z] = tile(K3.lerp(far, i, k / 6), K3.lerp(LANE, s, k / 6)); if (!isSea(x, z)) return false; } return true; };
  let best = null;
  for (const side of [1, -1]) for (let reach = 150; reach >= 40 && !best; reach -= 10) {
    const pts = [[reach, LANE + side * reach * 0.55], [reach * 0.62, LANE + side * reach * 0.36], [reach * 0.32 + far * 0.4, LANE + side * reach * 0.1]];
    if (pts.every(([i, s]) => { const [x, z] = tile(i, s); return isSea(x, z) && clear(i, s); })) best = pts;
  }
  const ctrl = (best || [[far + 30, LANE]]).concat([[far, LANE], [BERTH + (far - BERTH) * 0.45, LANE], [BERTH, LANE]]).map(([i, s]) => tile(i, s));
  // centripetal Catmull-Rom through the points, sampled finely, then re-sampled by distance
  const P = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]]; const raw = [];
  for (let j = 1; j < P.length - 2; j++) {
    const p0 = P[j - 1], p1 = P[j], p2 = P[j + 1], p3 = P[j + 2];
    const tj = (a, b) => Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-3, 0.5);
    const t1 = tj(p0, p1), t2 = t1 + tj(p1, p2), t3 = t2 + tj(p2, p3);
    for (let k = 0; k < 40; k++) {
      const t = t1 + (t2 - t1) * (k / 40); const pt = [0, 0];
      for (let c = 0; c < 2; c++) {
        const A1 = (t1 - t) / t1 * p0[c] + t / t1 * p1[c], A2 = (t2 - t) / (t2 - t1) * p1[c] + (t - t1) / (t2 - t1) * p2[c], A3 = (t3 - t) / (t3 - t2) * p2[c] + (t - t2) / (t3 - t2) * p3[c];
        const B1 = (t2 - t) / t2 * A1 + t / t2 * A2, B2 = (t3 - t) / (t3 - t1) * A2 + (t - t1) / (t3 - t1) * A3;
        pt[c] = (t2 - t) / (t2 - t1) * B1 + (t - t1) / (t2 - t1) * B2;
      }
      raw.push(pt);
    }
  }
  raw.push(ctrl[ctrl.length - 1]);
  const len = [0]; for (let k = 1; k < raw.length; k++) len.push(len[k - 1] + Math.hypot(raw[k][0] - raw[k - 1][0], raw[k][1] - raw[k - 1][1]));
  const L = len[len.length - 1];
  // a point (and the heading) at distance d along the course
  const at = (d, out) => {
    d = Math.max(0, Math.min(L, d)); let lo = 0, hi = len.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (len[m] <= d) lo = m; else hi = m; }
    const u = (d - len[lo]) / ((len[hi] - len[lo]) || 1); out[0] = K3.lerp(raw[lo][0], raw[hi][0], u); out[1] = K3.lerp(raw[lo][1], raw[hi][1], u);
    // the heading looks a little ahead along the curve, so it turns smoothly through each bend
    const ah = Math.min(L, d + 6), bh = Math.max(0, ah - 12); const a = [0, 0], b = [0, 0];
    const pick = (dd, o) => { let l2 = 0, h2 = len.length - 1; while (h2 - l2 > 1) { const m = (l2 + h2) >> 1; if (len[m] <= dd) l2 = m; else h2 = m; } const v = (dd - len[l2]) / ((len[h2] - len[l2]) || 1); o[0] = K3.lerp(raw[l2][0], raw[h2][0], v); o[1] = K3.lerp(raw[l2][1], raw[h2][1], v); };
    pick(ah, a); pick(bh, b); out[2] = Math.atan2(a[0] - b[0], a[1] - b[1]);
    return out;
  };
  return { L, at };
}
// distance sailed at time t: a steady run under sail, then she loses way smoothly and stops at the berth
function sailed(t, L) {
  const tb = 34, te = SAIL_END; // cruising until tb, then slowing to a stop at te
  const v = L / (tb + (te - tb) / 2); // the cruising speed that brings her in exactly at te
  if (t <= tb) return v * t;
  const u = Math.min(1, (t - tb) / (te - tb));
  return v * tb + v * (te - tb) * (u - u * u * u + u * u * u * u / 2); // her speed falls off along a smoothstep
}

export function startIntro(c, done) {
  const p = G.player; const cd = W.cityData[c.faction]; const H = cd && cd.harbour;
  if (!p || !H) return false;
  const tile = (i, s) => [(H.gx + H.dx * (H.k + 1 + i) + H.px * s + 0.5) * TILE, (H.gy + H.dy * (H.k + 1 + i) + H.py * s + 0.5) * TILE];
  const isSea = (x, z) => { const tx = Math.floor(x / TILE), tz = Math.floor(z / TILE); if (!W.inb(tx, tz)) return false; const t = W.tile(tx, tz); return t === KR.T.WATER || t === KR.T.DEEP; };
  const C = course(tile, isSea);
  const ship = buildShip('cog', 0.45, { warship: true }); K3.scene.add(ship);
  const sails = []; ship.traverse((o) => { if (o.userData && o.userData.sail) sails.push(o); });
  // her crew: a helmsman aft and two hands at the mast, who haul the sail up to its yard as she comes in
  const crew = [];
  if (K3.navalSailor) for (const [x, z, ry, job, shirt, cap] of [[0, -5.6, 0, 'helm', '#3a4a6a', '#2a3a5a'], [-0.7, 1.1, Math.PI / 2, 'haul', '#c8bca0', '#8a2a2a'], [0.75, -0.2, -Math.PI / 2, 'haul', '#8a3a2a', '#5a4a2a']]) {
    const s = K3.navalSailor(shirt, cap); s.position.set(x, 1.43, z); s.rotation.y = ry; s.userData.job = job; s.userData.ph = crew.length * 1.7; ship.add(s); crew.push(s);
  }
  // the overlay: letterbox bars, the city's name, and a fade at the end
  const fac = D.FACTIONS[c.faction] || {};
  const ov = document.createElement('div'); ov.className = 'k3-cine k3-intro';
  ov.innerHTML = `<div class="k3c-bar top"></div><div class="k3c-bar bot"></div>
    <div class="k3c-cap hero k3i-title"><div class="k3c-k">After a long voyage, home at last</div><h2>${fac.city || 'Home'}</h2><p>${fac.name || ''}</p></div>
    <div class="k3i-fade"></div><button class="btn small ghost k3c-skip">Skip ›</button>`;
  document.body.appendChild(ov);
  const ui = document.getElementById('ui'), hud = document.getElementById('hud3d'); const uiWas = ui ? ui.hidden : true; if (ui) ui.hidden = true; if (hud) hud.style.visibility = 'hidden';
  const boats = []; K3.scene.traverse((o) => { if (o.userData && o.userData.anim && o.userData.anim.kind === 'boat') boats.push(o); });
  const city = [(cd.cx + 0.5) * TILE, (cd.cy + 0.5) * TILE];
  const [pierX, pierZ] = tile(BERTH - 2.5, LANE - 6.5); // where the camera waits for her on the water by the pier
  intro = { uiWas, c, p, t: 0, ship, sails, crew, ov, done, tile, C, city, pier: [pierX, pierZ], out: [H.dx, H.dy], update: updateIntro, boats, lift: 0, hidden: [],
    pos: [0, 0, 0], yaw: null, yawV: 0, heel: 0, cs: null, look: null, v3: new THREE.Vector3(), v4: new THREE.Vector3(), camW: new THREE.Vector3(), lookW: new THREE.Vector3(), rc: new THREE.Raycaster(), chk: 0, titleOn: false, fadeOn: false };
  K3.introOn = true;
  p.sit = false; p.moving = false;
  intro.key = (e) => { e.stopImmediatePropagation(); e.preventDefault(); if (!e.repeat && (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter')) finish(); };
  intro.click = (e) => { e.stopImmediatePropagation(); e.preventDefault(); finish(); };
  addEventListener('keydown', intro.key, true); addEventListener('pointerdown', intro.click, true);
  try { A.play('harbor'); } catch (e) {}
  K3.cine = intro;
  updateIntro(0);
  return true;
}
function finish() {
  const n = intro; if (!n) return; intro = null; K3.cine = null; K3.introOn = false;
  removeEventListener('keydown', n.key, true); removeEventListener('pointerdown', n.click, true);
  const p = n.p; p.introY = null; p.moving = false;
  const ui = document.getElementById('ui'), hud = document.getElementById('hud3d'); if (ui && !n.uiWas) ui.hidden = false; if (hud) hud.style.visibility = '';
  // you stand on the dock at the head of the pier, facing the city, on a bright morning
  const [x, z] = n.tile(-1.5, 0.4); p.x = x / PX; p.y = z / PX;
  G.clock = 8 * 60;
  K3.scene.remove(n.ship); for (const b of n.hidden) b.visible = true;
  n.ov.classList.add('out'); setTimeout(() => n.ov.remove(), 900);
  view.want = view.dist = 0; view.pitch = -0.05; view.yaw = Math.atan2(n.out[0], n.out[1]);
  try { A.play(n.c.faction === 'sylvan' ? 'town_sylvan' : 'town_crown'); } catch (e) {}
  if (n.done) n.done();
  try { if (KR.Story && KR.Story.arrive) KR.Story.arrive(); } catch (e) { console.warn(e); }
}
const ease = (x) => x * x * x * (x * (x * 6 - 15) + 10); // smootherstep
// how much of each shot is in the picture at time t: each fades in over its first 3.5 s while the last fades out
const SHOTS = [0, 11, 23, 39, 49]; const XF = 3.5;
function updateIntro(dt) {
  const n = intro; if (!n) return;
  dt = Math.min(dt, 1 / 24); // a hitch never makes the film jump
  n.t += dt; const t = n.t, p = n.p;
  // the sun comes up as she sails in: first light over the sea, a golden morning by the time she berths
  G.clock = (6.4 + 1.4 * Math.min(1, t / T_END)) * 60; if (G.weather) { G.weather.type = 'clear'; G.weather.t = Math.max(G.weather.t || 0, 200); }
  // ---- the ship ----
  const d = sailed(Math.min(t, SAIL_END), n.C.L); n.C.at(d, n.pos); const [x, z, hd] = n.pos;
  const speed = n.lastD == null ? 0 : (d - n.lastD) / Math.max(dt, 1e-4); n.lastD = d;
  if (n.yaw == null) n.yaw = hd;
  // the heading follows the course through a spring, so she swings through each bend and never snaps round
  let dy = hd - n.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  n.yawV += (dy * 2.2 - n.yawV * 2.4) * dt; n.yaw += n.yawV * dt;
  const way = Math.min(1, speed / 3); // how much way she has on: the swell and heel ease as she slows
  n.heel += ((-n.yawV * 1.6 + 0.045) * way - n.heel) * Math.min(1, dt * 1.5); // she leans out of the turn and a little to the wind
  const roll = n.heel + Math.sin(K3.time * 0.85) * 0.035 * (0.4 + way * 0.6), pitch = Math.sin(K3.time * 1.15 + 1) * 0.022 * (0.4 + way * 0.6);
  const heave = Math.sin(K3.time * 1.05) * 0.14 * (0.4 + way * 0.6);
  n.ship.position.set(x, heave, z); n.ship.rotation.set(pitch, n.yaw, roll, 'YXZ'); n.ship.updateMatrixWorld(true);
  // the sail draws full in the open sea, then the hands brail it up to the yard as she comes in
  const furl = K3.smooth(41, 52, t);
  for (const s of n.sails) { s.scale.y = 1 - furl * 0.82; s.scale.z = 1 + Math.sin(K3.time * 1.7) * 0.05 * (1 - furl); }
  for (const s of n.crew) {
    const u = s.userData, arms = s.userData.arms || []; const ph = K3.time + u.ph;
    if (u.job === 'helm') { s.rotation.z = Math.sin(ph * 0.8) * 0.04; if (arms[0]) { arms[0].rotation.x = -1.1 + Math.sin(ph * 0.6) * 0.15; arms[1].rotation.x = -1.1 - Math.sin(ph * 0.6) * 0.15; } }
    else { const haul = furl > 0.02 && furl < 0.98 ? 1 : 0.15; const k = Math.sin(ph * (haul > 0.5 ? 3.2 : 0.7)); if (arms[0]) { arms[0].rotation.x = -2.2 + k * 0.7 * haul; arms[1].rotation.x = -2.2 - k * 0.7 * haul; } s.rotation.x = haul * (0.15 + k * 0.08); }
  }
  // her wake and the spray at her bow while she has way on
  const fw = [Math.sin(n.yaw), Math.cos(n.yaw)], sd = [Math.cos(n.yaw), -Math.sin(n.yaw)];
  if (way > 0.15 && Math.random() < dt * 16 * way) { const back = -6.5 + Math.random() * 1.5; fx.smoke.emit({ x: x + fw[0] * back + sd[0] * (Math.random() - 0.5) * 3, y: 0.12, z: z + fw[1] * back + sd[1] * (Math.random() - 0.5) * 3, vy: 0.03, life: 3.4, s0: 0.9, s1: 3.2, r: 0.93, g: 0.96, b: 0.99, a: 0.32 * way, kind: 2, drag: 0.6 }); }
  if (way > 0.3 && Math.random() < dt * 12 * way) { const s = Math.random() < 0.5 ? 1 : -1; fx.smoke.emit({ x: x + fw[0] * 7 + sd[0] * s * 1.2, y: 0.3, z: z + fw[1] * 7 + sd[1] * s * 1.2, vx: sd[0] * s * 1.4 + fw[0] * 0.6, vy: 1.3 + Math.random(), vz: sd[1] * s * 1.4 + fw[1] * 0.6, grav: 7, life: 0.9, s0: 0.3, s1: 0.8, r: 0.95, g: 0.97, b: 1, a: 0.45, kind: 2, drag: 0.5 }); }
  // the hero stands at the bow, looking toward home
  const bow = n.v3.set(0, 3.68, 4.3).applyMatrix4(n.ship.matrixWorld);
  p.x = bow.x / PX; p.y = bow.z / PX; p.introY = bow.y; p.moving = false;
  view.want = view.dist = 3; view.turning = true; view.yaw = n.yaw + Math.PI;
  K3.vmVisible = false;
  // ---- the camera: five shots, each blending into the next ----
  const bx = bow.x, by = bow.y, bz = bow.z;
  const shot = (k, o) => { // o: [camX, camY, camZ, lookX, lookY, lookZ]
    const u = K3.smooth(SHOTS[k], (SHOTS[k + 1] || T_END) + XF, t); // progress through the shot, overlap included
    if (k === 0) { // open sea: low over the water off her quarter, drifting forward along her side to the bow
      const a = K3.lerp(-14, 9, u), off = K3.lerp(15, 11, u);
      o[0] = x + fw[0] * a + sd[0] * off; o[1] = K3.lerp(1.6, 3.2, u); o[2] = z + fw[1] * a + sd[1] * off;
      o[3] = x + fw[0] * K3.lerp(-1, 4, u); o[4] = K3.lerp(6, 4.2, u); o[5] = z + fw[1] * K3.lerp(-1, 4, u);
    } else if (k === 1) { // the hero at the bow: from ahead of them, swinging round over their shoulder as land comes up
      const ang = K3.lerp(0.35, Math.PI - 0.5, ease(u)), r = K3.lerp(6.5, 4.2, u);
      const cx = Math.cos(ang), cz = Math.sin(ang); // 0: straight ahead of the bow, PI: behind the hero
      o[0] = bx + fw[0] * r * cx + sd[0] * r * cz; o[1] = by + K3.lerp(1.0, 2.2, u); o[2] = bz + fw[1] * r * cx + sd[1] * r * cz;
      const lk = K3.lerp(0, 60, K3.smooth(0.5, 0.95, u)); o[3] = bx + fw[0] * lk; // their face first, then out past them to the land o[4] = by + K3.lerp(1.3, 1.0, u); o[5] = bz + fw[1] * lk;
    } else if (k === 2) { // the city and its harbour from on high, the camera wheeling round behind the ship as the sun climbs
      const ang = K3.lerp(-0.9, 0.5, u), r = K3.lerp(38, 54, u), h = K3.lerp(14, 34, ease(u));
      const ca = Math.cos(ang), sa = Math.sin(ang);
      o[0] = x - fw[0] * r * ca + sd[0] * r * sa; o[1] = h; o[2] = z - fw[1] * r * ca + sd[1] * r * sa;
      const m = K3.lerp(0.15, 0.45, u); o[3] = K3.lerp(x, n.city[0], m); o[4] = K3.lerp(3, 6, u); o[5] = K3.lerp(z, n.city[1], m);
    } else if (k === 3) { // waiting on the water by the pier as she glides in past the moored ships
      o[0] = n.pier[0] + K3.lerp(0, 2, u); o[1] = K3.lerp(4.2, 3.4, u); o[2] = n.pier[1]; o[3] = x + fw[0] * 2; o[4] = 4.5; o[5] = z + fw[1] * 2;
    } else { // alongside: down from her quarter to the hero at the bow, looking out at the city
      const ang = K3.lerp(2.3, 2.75, u), r = K3.lerp(9, 4.5, ease(u));
      o[0] = bx + fw[0] * r * Math.cos(ang) + sd[0] * r * Math.sin(ang); o[1] = by + K3.lerp(3.2, 1.4, ease(u)); o[2] = bz + fw[1] * r * Math.cos(ang) + sd[1] * r * Math.sin(ang);
      o[3] = bx + fw[0] * 30; o[4] = by + 0.6; o[5] = bz + fw[1] * 30;
    }
    return o;
  };
  const o = n.o || (n.o = [0, 0, 0, 0, 0, 0]), q = n.q || (n.q = [0, 0, 0, 0, 0, 0]);
  let k = 0; while (k < SHOTS.length - 1 && t >= SHOTS[k + 1]) k++;
  shot(k, o);
  const into = k > 0 ? ease(K3.smooth(SHOTS[k], SHOTS[k] + XF, t)) : 1; // still blending in from the shot before
  if (into < 1) { shot(k - 1, q); for (let i = 0; i < 6; i++) o[i] = K3.lerp(q[i], o[i], into); }
  // the camera floats: a light spring smooths every move, and a slow drift keeps it alive
  const bob = Math.sin(K3.time * 0.5) * 0.25;
  if (!n.cs) { n.cs = new THREE.Vector3(o[0], o[1], o[2]); n.look = new THREE.Vector3(o[3], o[4], o[5]); }
  const kk = 1 - Math.exp(-dt * 4);
  n.cs.x += (o[0] - n.cs.x) * kk; n.cs.y += (o[1] + bob + n.lift - n.cs.y) * kk; n.cs.z += (o[2] - n.cs.z) * kk;
  n.look.x += (o[3] - n.look.x) * kk; n.look.y += (o[4] - n.look.y) * kk; n.look.z += (o[5] - n.look.z) * kk;
  // never below the swell, and over any moored ship that would come between the camera and the hero
  n.cs.y = Math.max(n.cs.y, 1.2);
  if (k >= 3 && n.boats.length && (n.chk++ % 6) === 0) {
    const head = n.v4.set(bx, by + 1.4, bz), to = n.camW.copy(n.cs).sub(head); const L = to.length(); to.divideScalar(L || 1);
    n.rc.set(head, to); n.rc.far = L;
    const hit = n.rc.intersectObjects(n.boats.filter((b) => b.visible), true)[0];
    if (hit) { if (n.lift < 10) n.lift = Math.min(10, n.lift + 1.2); else { let ob = hit.object; while (ob && !n.boats.includes(ob)) ob = ob.parent; if (ob) { ob.visible = false; n.hidden.push(ob); } } }
    else n.lift = Math.max(0, n.lift - 0.2);
  }
  cam.position.copy(n.cs);
  cam.lookAt(n.look);
  // the city's name over the wide shot
  const title = t > 26 && t < 34.5; if (title !== n.titleOn) { n.titleOn = title; const el = n.ov.querySelector('.k3i-title'); if (el) el.classList.toggle('in', title); }
  if (t > T_END - T_FADE && !n.fadeOn) { n.fadeOn = true; n.ov.classList.add('fade'); }
  if (t >= T_END) finish();
}
K3.startIntro = startIntro;
