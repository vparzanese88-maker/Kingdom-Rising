// Kingdom Rising 3D — a new hero's homecoming, like riding in on the cart at the start of Skyrim:
// you stand on the deck of a cog sailing into your capital's harbour on a bright morning, free to look
// around but not to move. The first mate talks about the true king and his last voyage home, tips appear
// at the side, gulls wheel over the quay where a greeting party waits under tall flags. At the pier the
// dockhand welcomes you back, the camera draws back to show you in your sailor's clothes, you step off
// onto the dock, and the king's steward says the king must see you at once. Esc or "Skip" ends it.
import { THREE, K3, PX, TS, TILE } from './core.js';
import { geo } from './geo.js';
import { view, eyeHeight } from './camera.js';
import { buildShip } from './ships.js';
import { makeHumanoid, animateHumanoid } from './chars.js';

const KR = window.KR, G = KR.G, W = KR.W, D = KR.D, A = KR.A, S = KR.S;
const cam = K3.camera;
const T_SAIL = 27, T_DOCK = 1.2, T_PULL = 4, T_STEP = 3, T_AIDE = 4.5;

const MATE = { crown: 'First Mate Brann', sylvan: 'First Mate Tamsin' };
const STEWARD = { crown: ['Sir Aldous', "King Aldric's steward"], sylvan: ['Lady Maren', "King Theron's steward"] };
function lines(c) {
  const F = D.FACTIONS[c.faction], other = D.FACTIONS[c.faction === 'crown' ? 'sylvan' : 'crown'], m = MATE[c.faction] || 'First Mate';
  const crown = c.faction === 'crown';
  return [
    [1.0, 6, m, `Land ho! There she is: ${F.city}. Three months at sea, and I never thought I'd be this glad to see those walls.`],
    [7.2, 6.5, m, crown ? `Mark me, ${c.name}: King Aldric is the true king. Firstborn of Edric, crowned by the old law, same as every Valen before him.` : `Mark me, ${c.name}: King Theron is the true king. The people crowned him under the great trees, and they knew what they were doing.`],
    [13.8, 6.5, m, crown ? `And it was Theron who poured that wine. Fled to the elves the very night the old king died. Innocent men don't run.` : `And it was Aldric who poisoned his father. Burned the feast-hall records the next morning. Innocent men don't burn records.`],
    [20.4, 6, m, `This is my last supply run, friend. I can't be away from the family this long. My little ones won't know my face.`],
    [T_SAIL + 0.4, 4.2, 'Dockhand', `Welcome back, sailor! A lot has changed since you've been gone.`],
    [T_SAIL + T_DOCK + T_PULL + T_STEP + 0.2, T_AIDE, `${STEWARD[c.faction][0]}, ${STEWARD[c.faction][1]}`, `Welcome back, ${D.CLASSES[c.cls].name}. The king must see you at once.`],
  ];
}
const TIPS = [
  ['Moving', 'W and S walk forward and back, A and D turn. Hold the right mouse button to look around; the wheel zooms out to third person. H walks or runs, X sits.'],
  ['Talking', 'Walk up to anyone and press E. A gold ! above someone means they have work for you; a ? means you can finish their task.'],
  ['Your gear', 'I opens your bags and gear. Hover your hero to see your stats. Right-click an item to use or equip it.'],
  ['Finding your way', 'M opens the map, J your quest journal. The king waits in the great hall at the top of the city.'],
  ['Gathering', 'Put an axe, a pick or a skinning knife in their slots, then press E at trees, ore veins and fresh carcasses. Better tools reach better wood, ore and hides.'],
  ['Camping', 'Outfitters sell Campsite Kits: pitch one in the wilds to bind there, and sleep in it to wake Well Rested (+10% experience for an hour).'],
  ['Chat', 'Enter to talk, /help for commands (/g for your group, /gen for everyone). Right-click a chat tab to choose what it shows.'],
  ['Your kingdom', 'Timber, stone and deeds raise your city from hamlet to capital. Grow it, raise an army, and march on the enemy capital.'],
];

let intro = null;
const _v = new THREE.Vector3(), _w = new THREE.Vector3();

function sailorLook(i, gender) {
  const skins = ['#e8c4a0', '#c8946a', '#8a5a3a', '#f0d0b0'], hairs = ['#2a1e14', '#6a4a2a', '#a8642a', '#d8c8a0'];
  return { race: 'human', gender, skin: skins[i % 4], hair: hairs[(i * 3) % 4], hairStyle: i % 3, beardStyle: gender === 'm' ? [3, 2, 1, 4][i % 4] : undefined, armor: { kind: 'cloth', col: ['#efe6d2', '#b8a888', '#8a6a4a', '#d8c8a8'][i % 4], trim: '#3a2a1a' }, pants: ['#2a3a5a', '#4a3a2a', '#3a3a3a'][i % 3], hat: i % 2 ? 'sailor' : null, hatCol: '#1e2a4a', sleeves: 'long' };
}
function personLook(kind, f) {
  const F = D.FACTIONS[f] || {};
  switch (kind) {
    case 'guard': return { race: 'human', gender: 'm', skin: '#d8b090', hair: '#3a2a1a', armor: { kind: 'plate', col: '#a8acb4', trim: F.banner || '#7a1e1e' }, helm: 'plate', helmPlume: F.banner, weapon: 'spear', offhand: 'shield', shieldCol: F.banner, cape: F.banner };
    case 'herald': return { race: 'human', gender: 'm', skin: '#e0b898', hair: '#6a4a2a', armor: { kind: 'cloth', col: F.banner || '#7a1e1e', trim: '#e0c050' }, hat: 'feather', hatCol: F.banner, hatTrim: '#e0c050', weapon: 'staff' };
    case 'steward': return { race: 'human', gender: f === 'sylvan' ? 'f' : 'm', skin: '#e8c8a8', hair: f === 'sylvan' ? '#a8642a' : '#8a8a8a', hairStyle: 1, beardStyle: f === 'sylvan' ? undefined : 2, armor: { kind: 'cloth', col: '#2a2440', trim: '#e0c050' }, robe: true, cape: F.banner, sash: '#e0c050' };
    case 'dockhand': return { race: 'human', gender: 'm', skin: '#c8946a', hair: '#2a1e14', beardStyle: 3, armor: { kind: 'leather', col: '#6a4a2a', trim: '#3a2a1a' }, pants: '#4a3a2a', sleeves: 'short' };
    default: return { race: 'human', gender: Math.random() < 0.5 ? 'm' : 'f', skin: ['#e8c4a0', '#c8946a', '#f0d0b0'][Math.floor(Math.random() * 3)], hair: ['#2a1e14', '#a8642a', '#d8c8a0'][Math.floor(Math.random() * 3)], hairStyle: Math.floor(Math.random() * 4), armor: { kind: 'cloth', col: ['#5a6a3a', '#3a5a6a', '#6a4a3a', '#7a6a4a'][Math.floor(Math.random() * 4)], trim: '#2a1e14' } };
  }
}
function rigOf(look, kind = 'npc') { const r = makeHumanoid(look, kind); r.mesh.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } }); if (r.setLod) r.setLod(0); return r; }

export function startIntro(c, done) {
  const p = G.player; const cd = W.cityData[c.faction]; const H = cd && cd.harbour;
  if (!p || !H) return false;
  const tile = (i, s) => [(H.gx + H.dx * (H.k + 1 + i) + H.px * s + 0.5) * TILE, (H.gy + H.dy * (H.k + 1 + i) + H.py * s + 0.5) * TILE];
  const isSea = (x, z) => { const t = W.tile(Math.floor(x / TILE), Math.floor(z / TILE)); return t === KR.T.WATER || t === KR.T.DEEP; };
  const [Dx, Dz] = tile(9, 3.5); const out = [H.dx, H.dy], lat = [H.px, H.py];
  // the approach: in from open water along the coast, curving onto the pier
  let Sx = 0, Sz = 0, Cx = 0, Cz = 0, ok = false;
  for (const side of [1, -1]) for (const reach of [34, 26, 18]) {
    Sx = Dx + (out[0] * reach + lat[0] * 40 * side) * TILE; Sz = Dz + (out[1] * reach + lat[1] * 40 * side) * TILE;
    Cx = Dx + (out[0] * 14 + lat[0] * 6 * side) * TILE; Cz = Dz + (out[1] * 14 + lat[1] * 6 * side) * TILE;
    const inMap = Sx > 3 * TILE && Sz > 3 * TILE && Sx < (W.W - 3) * TILE && Sz < (W.H - 3) * TILE;
    let wet = inMap; for (let u = 0; u <= 1 && wet; u += 0.1) { const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, cc = u * u; if (!isSea(a * Sx + b * Cx + cc * Dx, a * Sz + b * Cz + cc * Dz)) wet = false; }
    if (wet) { ok = true; break; }
  }
  if (!ok) { Sx = Dx + out[0] * 20 * TILE; Sz = Dz + out[1] * 20 * TILE; Cx = (Sx + Dx) / 2; Cz = (Sz + Dz) / 2; }
  const bez = (u) => { const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, cc = u * u; return [a * Sx + b * Cx + cc * Dx, a * Sz + b * Cz + cc * Dz]; };
  const tan = (u) => { const tx = 2 * (1 - u) * (Cx - Sx) + 2 * u * (Dx - Cx), tz = 2 * (1 - u) * (Cz - Sz) + 2 * u * (Dz - Cz); return Math.atan2(tx, tz); };
  // the ship and her crew
  const ship = buildShip('cog', 0.45); K3.scene.add(ship);
  const deck = 1.43; const crew = [];
  const putCrew = (look, x, y, z, ry, role) => { const r = rigOf(look); r.mesh.position.set(x, y, z); r.mesh.rotation.y = ry; ship.add(r.mesh); crew.push({ r, role }); return r; };
  const FC = 3.68; // the forecastle deck, at the bow: the best view of the harbour
  const mate = putCrew(Object.assign(sailorLook(1, c.faction === 'sylvan' ? 'f' : 'm'), { hat: 'sailor' }), -0.7, FC, 4.9, 2.6, 'mate');
  putCrew(sailorLook(0, 'm'), 1.0, deck, 2.0, -2.4, 'rope'); putCrew(sailorLook(2, 'm'), 0, deck + 1.7, -5.3, 0, 'helm'); putCrew(sailorLook(3, 'f'), -0.9, deck, -1.2, 1.2, 'lookout');
  // on the quay: the greeting party under the flags, the dockhand at the berth, the steward on the pier
  const shore = []; const putShore = (kind, i, s, faceTo) => { const look = personLook(kind, c.faction); const r = rigOf(look); const [x, z] = tile(i, s); const y = geo.floorAt(x / PX, z / PX); r.mesh.position.set(x, y, z); r.mesh.rotation.y = Math.atan2(faceTo[0] - x, faceTo[1] - z); K3.scene.add(r.mesh); shore.push({ r, kind }); return r; };
  const berth = tile(9, 1.5);
  putShore('dockhand', 8.2, 1.0, [Dx, Dz]); const steward = putShore('steward', 6.6, 0.1, berth);
  putShore('guard', 5.6, -1.0, berth); putShore('guard', 5.6, 1.2, berth);
  const quay = tile(-1.5, 0); for (const [i, s, k] of [[-1.5, -2.2, 'herald'], [-1.5, 2.4, 'herald'], [-2.2, -4, 'guard'], [-2.2, 4, 'guard'], [-1.6, -6, 'folk'], [-1.8, 6.5, 'folk'], [-2.4, 8, 'folk'], [-2.4, -8, 'folk'], [0.5, -2.8, 'folk']]) putShore(k, i, s, tile(9, 2));
  // the gangplank, laid out when the ship ties up
  const plank = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 2.6), new THREE.MeshStandardMaterial({ color: 0x8a6440, roughness: 0.9 })); plank.visible = false; K3.scene.add(plank);
  // the overlay: letterbox, subtitles and the tips panel
  const ov = document.createElement('div'); ov.className = 'k3-cine k3-intro';
  ov.innerHTML = `<div class="k3c-bar top"></div><div class="k3c-bar bot"></div><div class="k3i-sub"><b></b><span></span></div><div class="k3i-tip"><div class="k3i-tk">Tip</div><h3></h3><p></p></div><div class="k3i-hint">Hold the right mouse button (or drag) to look around</div><button class="btn small ghost k3c-skip">Skip ›</button>`;
  document.body.appendChild(ov);
  const L = lines(c);
  const ui = document.getElementById('ui'), hud = document.getElementById('hud3d'); const uiWas = ui ? ui.hidden : true; if (ui) ui.hidden = true; if (hud) hud.style.visibility = 'hidden';
  intro = { uiWas, c, p, t: 0, ship, crew, shore, mate, steward, plank, ov, done, bez, tan, L, line: -1, tip: -1, look: true, lastShipYaw: tan(0), Dx, Dz, berth, tile, update: updateIntro };
  // a fine sunny morning
  G.clock = 9.5 * 60; if (G.weather) { G.weather.type = 'clear'; G.weather.t = Math.max(G.weather.t || 0, 200); }
  view.want = view.dist = 0; view.pitch = -0.02; view.yaw = tan(0) + Math.PI; intro.lastShipYaw = tan(0); // look toward the bow
  p.introY = deck; p.sit = false;
  const skip = () => finish(true);
  ov.querySelector('.k3c-skip').onclick = (e) => { e.stopPropagation(); skip(); };
  intro.key = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); skip(); } };
  addEventListener('keydown', intro.key, true);
  try { A.play('harbor'); } catch (e) {}
  K3.cine = intro;
  return true;
}
function say(i) {
  const n = intro; if (n.line === i) return; n.line = i; const box = n.ov.querySelector('.k3i-sub');
  box.classList.remove('in'); void box.offsetWidth; if (i < 0) return;
  box.querySelector('b').textContent = n.L[i][2]; box.querySelector('span').textContent = n.L[i][3]; box.classList.add('in');
}
function tip(i) {
  const n = intro; if (n.tip === i) return; n.tip = i; const box = n.ov.querySelector('.k3i-tip');
  box.classList.remove('in'); void box.offsetWidth; if (i < 0 || i >= TIPS.length) return;
  box.querySelector('h3').textContent = TIPS[i][0]; box.querySelector('p').textContent = TIPS[i][1]; box.querySelector('.k3i-tk').textContent = `Tip ${i + 1} of ${TIPS.length}`; box.classList.add('in');
}
function finish(skipped) {
  const n = intro; if (!n) return; intro = null; K3.cine = null;
  removeEventListener('keydown', n.key, true);
  const p = n.p; p.introY = null; p.moving = false;
  const ui = document.getElementById('ui'), hud = document.getElementById('hud3d'); if (ui && !n.uiWas) ui.hidden = false; if (hud) hud.style.visibility = '';
  // stand on the pier, facing the city
  const [x, z] = n.tile(7.6, 0.4); p.x = x / PX; p.y = z / PX;
  K3.scene.remove(n.ship); K3.scene.remove(n.plank); for (const s of n.shore) K3.scene.remove(s.r.mesh);
  n.ov.classList.add('out'); setTimeout(() => n.ov.remove(), 900);
  view.want = view.dist = 0; view.pitch = -0.05; const H = W.cityData[n.c.faction].harbour; view.yaw = Math.atan2(H.dx, H.dy);
  try { A.play(n.c.faction === 'sylvan' ? 'town_sylvan' : 'town_crown'); } catch (e) {}
  if (n.done) n.done();
}
function updateIntro(dt) {
  const n = intro; if (!n) return; n.t += dt; const t = n.t, p = n.p;
  // the ship: sails in and slows to a stop at the berth, rocking on the swell
  const u = Math.min(1, t / T_SAIL), e = 1 - Math.pow(1 - u, 2.6);
  const [x, z] = n.bez(e); const yaw = n.tan(Math.min(0.999, e));
  const roll = Math.sin(K3.time * 0.9) * 0.035 * (1 - u * 0.6), pitch = Math.sin(K3.time * 1.3 + 1) * 0.02, heave = Math.sin(K3.time * 1.1) * 0.12 * (1 - u * 0.5);
  n.ship.position.set(x, heave, z); n.ship.rotation.set(pitch, yaw, roll, 'YXZ'); n.ship.updateMatrixWorld(true);
  // the deck turns under you: your view turns with it
  view.yaw += yaw - n.lastShipYaw; n.lastShipYaw = yaw;
  // where you stand: up on the forecastle while sailing in, then amidships by the rail facing the pier
  const t1 = T_SAIL + T_DOCK, t2 = t1 + T_PULL, t3 = t2 + T_STEP, t4 = t3 + T_AIDE;
  if (n.side == null && t >= t1) { const L0 = new THREE.Vector3(1, 0, 0).applyQuaternion(n.ship.quaternion); n.side = (L0.x * (n.berth[0] - x) + L0.z * (n.berth[1] - z)) > 0 ? 1 : -1; }
  const standL = t < t1 ? new THREE.Vector3(0.45, 3.68, 4.3) : new THREE.Vector3(n.side * 1.15, 1.43, 0.6);
  const standW = standL.clone().applyMatrix4(n.ship.matrixWorld);
  for (const cr of n.crew) { animateHumanoid(cr.r, { move: 0, dist: 0, atk: cr.role === 'rope' ? (Math.sin(K3.time * 2) > 0.6 ? 0.3 : 0) : 0, combat: false, sit: false }, dt); }
  for (const s of n.shore) animateHumanoid(s.r, { move: 0, dist: 0, atk: 0, combat: s.kind === 'guard', sit: false }, dt);
  // the mate turns to talk to you
  { const m = n.mate.mesh; const toP = Math.atan2(standL.x - m.position.x, standL.z - m.position.z); m.rotation.y = K3.dampAngle(m.rotation.y, toP, Math.min(1, dt * 2)); }
  // subtitles and tips
  let cur = -1; for (let i = 0; i < n.L.length; i++) if (t >= n.L[i][0] && t < n.L[i][0] + n.L[i][1]) cur = i; say(cur);
  tip(t > 3 && t < T_SAIL + 1 ? Math.min(TIPS.length - 1, Math.floor((t - 3) / ((T_SAIL - 2) / TIPS.length))) : -1);
  K3.vmVisible = false;
  if (t < t1) {
    // first person on deck: the camera rides the ship, you look where you like
    p.x = standW.x / PX; p.y = standW.z / PX; p.introY = standW.y;
    view.want = view.dist = 0;
    const eye = eyeHeight(p); cam.position.set(standW.x, standW.y + eye, standW.z);
    const fx = -Math.sin(view.yaw) * Math.cos(view.pitch), fy = Math.sin(view.pitch), fz = -Math.cos(view.yaw) * Math.cos(view.pitch);
    cam.lookAt(cam.position.x + fx, cam.position.y + fy, cam.position.z + fz);
    n.ov.querySelector('.k3i-hint').style.opacity = t < 9 ? '1' : '0';
    n.fp = { pos: cam.position.clone(), look: new THREE.Vector3(cam.position.x + fx * 4, cam.position.y + fy * 4, cam.position.z + fz * 4) };
    return;
  }
  // tied up: lay the plank, draw back to see yourself, step off onto the pier, meet the steward
  const [bx, bz] = n.berth; const by = geo.floorAt(bx / PX, bz / PX);
  if (!n.plank.visible) { n.plank.visible = true; n.plank.position.set((standW.x + bx) / 2, (standW.y + by) / 2 + 0.04, (standW.z + bz) / 2); n.plank.lookAt(bx, by + 0.04, bz); }
  view.want = view.dist = 3; view.turning = true; // third person: the hero is drawn and faces where we say
  const [sx, sz] = n.tile(7.6, 0.4); const sy = geo.floorAt(sx / PX, sz / PX);
  let px = standW.x, pz = standW.z, py = standW.y, faceTo = [bx, bz];
  if (t >= t2) {
    const k = Math.min(1, (t - t2) / T_STEP), k1 = Math.min(1, k * 2), k2 = Math.max(0, k * 2 - 1);
    if (k < 0.5) { px = K3.lerp(standW.x, bx, k1); pz = K3.lerp(standW.z, bz, k1); py = K3.lerp(standW.y, by, k1); faceTo = [bx, bz]; } else { px = K3.lerp(bx, sx, k2); pz = K3.lerp(bz, sz, k2); py = K3.lerp(by, sy, k2); faceTo = [sx, sz]; }
    p.moving = k < 1;
    if (k >= 1) faceTo = [n.steward.mesh.position.x, n.steward.mesh.position.z];
  }
  p.x = px / PX; p.y = pz / PX; p.introY = py;
  const want = Math.atan2(-(faceTo[0] - px), -(faceTo[1] - pz)); view.yaw = K3.dampAngle(view.yaw, want, Math.min(1, dt * 5));
  const eye = eyeHeight(p); const fx = -Math.sin(view.yaw), fz = -Math.cos(view.yaw), rx = Math.cos(view.yaw), rz = -Math.sin(view.yaw);
  const chest = new THREE.Vector3(px, py + eye * 0.72, pz);
  let camP, camL;
  if (t < t2) {
    // draw back from your eyes to the pier, looking back up at you: cap, silk shirt, trousers and boots
    const k = K3.smooth(t1, t2, t);
    const ax = bx - px, az = bz - pz, al = Math.hypot(ax, az) || 1; const [lx, lz] = n.tile(4, 0);
    const fr = new THREE.Vector3(bx + ax / al * 1.6 + (lx - bx) * 0.12, by + 1.55, bz + az / al * 1.6 + (lz - bz) * 0.12);
    camP = n.fp.pos.clone().lerp(fr, k); camP.y += Math.sin(k * Math.PI) * 1.2; camL = n.fp.look.clone().lerp(chest, K3.smooth(0, 0.5, k));
  } else if (t < t3) {
    // from the pier, watching you come down the plank
    const mid = new THREE.Vector3((standW.x + sx) / 2, 0, (standW.z + sz) / 2); const dx = sx - standW.x, dz = sz - standW.z, l = Math.hypot(dx, dz) || 1;
    camP = new THREE.Vector3(mid.x - dz / l * 4.2 + dx / l * 1.5, Math.max(py, sy) + 1.9, mid.z + dx / l * 4.2 + dz / l * 1.5); camL = chest;
  } else {
    // over your shoulder to the king's steward
    const st = n.steward.mesh.position; const dx = st.x - px, dz = st.z - pz, l = Math.hypot(dx, dz) || 1;
    camP = new THREE.Vector3(px - dx / l * 2.4 + (-dz / l) * 0.75, py + eye + 0.25, pz - dz / l * 2.4 + (dx / l) * 0.75); camL = new THREE.Vector3(st.x, st.y + 1.55, st.z);
  }
  n.cs = n.cs || camP.clone(); n.cs.lerp(camP, Math.min(1, dt * 4)); cam.position.copy(n.cs); cam.lookAt(camL);
  if (t >= t4) finish(false);
}
K3.startIntro = startIntro;
