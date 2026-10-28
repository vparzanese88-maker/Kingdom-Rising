// Kingdom Rising 3D — the opening film for a new hero: the story of the poisoned king told over a flight
// across the real land, down over the walls of your city, a full turn round the hero you just made, and
// then into your hero's own eyes as the game begins. It cannot be skipped.
import { THREE, K3, PX, TS, TILE } from './core.js';
import { geo } from './geo.js';
import { view, eyeHeight } from './camera.js';

const KR = window.KR, G = KR.G, W = KR.W, D = KR.D, A = KR.A;
const cam = K3.camera;
const ground = (x, z) => geo.floorAt(x / PX, z / PX);
const ease = (t) => K3.smooth(0, 1, t);

const LORE = [
  ['The Golden Years', 'For forty years King Edric Valen ruled one kingdom, and elves, dwarves, halflings and men bent the knee to the same crown.'],
  ['The Poisoned Cup', 'At the midwinter feast the old king rose to toast his sons. He drank, and the cup fell from his hand. By morning he was dead.'],
  ['Brother Against Brother', 'Aldric, the firstborn, swore Theron poured the wine. Theron swore Aldric wanted the crown. Each called the other a murderer.'],
  ['A Kingdom Torn in Two', 'Aldric holds Valenmoor with the dwarves and the mountain clans. Theron was crowned under the great trees of Aelindor.'],
];
const FINAL = {
  crown: ['For Valenmoor', '"Raise Valenmoor high, hero, and help me bring my brother to justice."  —  King Aldric'],
  sylvan: ['For Aelindor', '"Build Aelindor into the jewel of this land, and together we will find Father\'s killer."  —  King Theron'],
};
const T_FLY = 32, T_DOWN = 6, T_ORBIT = 9.5, T_MERGE = 2.6;

let cine = null;
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _l = new THREE.Vector3(), _l2 = new THREE.Vector3();

export function startCine(c, done) {
  const p = G.player; if (!p) { done && done(); return; }
  const cd = W.cityData[c.faction] || {}; const other = W.cityData[c.faction === 'crown' ? 'sylvan' : 'crown'] || {};
  const cx = ((cd.cx != null ? cd.cx : p.x / TS) + 0.5) * TILE, cz = ((cd.cy != null ? cd.cy : p.y / TS) + 0.5) * TILE;
  // fly in from the wild lands on the far side, toward the rival kingdom
  let dx = (other.cx != null ? (other.cx + 0.5) * TILE : cx + 100) - cx, dz = (other.cy != null ? (other.cy + 0.5) * TILE : cz + 60) - cz; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
  const MW = W.W * TILE, MH = W.H * TILE;
  const far = Math.min(dl * 0.75, 190);
  const start = new THREE.Vector3(K3.clamp(cx + dx * far, 20, MW - 20), 0, K3.clamp(cz + dz * far, 20, MH - 20));
  const near = new THREE.Vector3(cx + dx * ((cd.R || 12) + 14) * TILE, 0, cz + dz * ((cd.R || 12) + 14) * TILE);
  const side = new THREE.Vector3(-dz, 0, dx);
  const ov = document.createElement('div'); ov.className = 'k3-cine';
  ov.innerHTML = `<div class="k3c-bar top"></div><div class="k3c-bar bot"></div><div class="k3c-cap"><div class="k3c-k"></div><h2></h2><p></p></div><div class="k3c-flash"></div>`;
  document.body.appendChild(ov);
  const lines = LORE.concat([FINAL[c.faction] || FINAL.crown]);
  cine = { c, p, t: 0, ov, done, start, near, side, cx, cz, lines, line: -1, yS: null, prevWant: view.want };
  view.want = view.dist = 5; // third person, so the hero is there to be seen
  cine.key = (e) => { e.preventDefault(); e.stopImmediatePropagation(); }; // it plays through: no skipping
  addEventListener('keydown', cine.key, true);
  try { A.play('epic'); } catch (e) {}
  if (G.weather) { G.weather.type = 'clear'; G.weather.t = Math.max(G.weather.t || 0, 120); } // the first sight of the land should be a fine one
  K3.cine = cine;
}
function caption(i) {
  const cn = cine; if (cn.line === i) return; cn.line = i;
  const cap = cn.ov.querySelector('.k3c-cap'); cap.classList.remove('in'); void cap.offsetWidth;
  if (i < 0) return;
  const [t, b] = i < cn.lines.length ? cn.lines[i] : [cn.c.name, `${D.RACES[cn.c.race].name} ${D.CLASSES[cn.c.cls].name} of ${D.FACTIONS[cn.c.faction].city}`];
  cap.querySelector('.k3c-k').textContent = i < LORE.length ? `Chapter ${i + 1}` : i < cn.lines.length ? 'Your path' : 'Your story begins';
  cap.querySelector('h2').textContent = t; cap.querySelector('p').textContent = b;
  cap.classList.toggle('hero', i >= cn.lines.length);
  cap.classList.add('in');
}
function end() {
  const cn = cine; if (!cn) return; cine = null; K3.cine = null;
  removeEventListener('keydown', cn.key, true);
  cn.ov.classList.add('out'); setTimeout(() => cn.ov.remove(), 900);
  view.want = view.dist = 0; view.pitch = -0.05;
  if (cn.done) cn.done();
}
// called by the main loop after the normal camera update: takes the camera over
export function updateCine(dt) {
  const cn = cine; if (!cn) return;
  cn.t += dt; const t = cn.t, p = cn.p;
  view.turning = true; // the hero keeps facing the way the game will start
  const hx = p.x * PX, hz = p.y * PX, hy = geo.floorAt(p.x, p.y), eye = eyeHeight(p);
  const yaw = view.yaw; const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  const head = _l2.set(hx, hy + eye * 0.93, hz);
  if (t < T_FLY) {
    // A: the flight across the land, with the story told over it
    const k = t / T_FLY, e = ease(k) * 0.75 + k * 0.25;
    _a.lerpVectors(cn.start, cn.near, e).addScaledVector(cn.side, Math.sin(k * Math.PI) * 26);
    const ty = Math.max(ground(_a.x, _a.z), ground(K3.lerp(_a.x, cn.cx, 0.15), K3.lerp(_a.z, cn.cz, 0.15))) + K3.lerp(42, 26, k);
    cn.yS = cn.yS == null ? ty : cn.yS + (ty - cn.yS) * Math.min(1, dt * 1.2); _a.y = cn.yS;
    _l.set(K3.lerp(_a.x, cn.cx, 0.35 + k * 0.65), 0, K3.lerp(_a.z, cn.cz, 0.35 + k * 0.65)); _l.y = ground(_l.x, _l.z) + K3.lerp(2, 6, k);
    caption(Math.min(cn.lines.length - 1, Math.floor(t / (T_FLY / cn.lines.length))));
    cam.position.copy(_a); cam.lookAt(_l);
    cn.flyEnd = cam.position.clone(); cn.flyLook = _l.clone();
  } else if (t < T_FLY + T_DOWN) {
    // B: down over the walls to the hero, waiting in the square
    const k = ease((t - T_FLY) / T_DOWN);
    const a0 = yaw + Math.PI; _b.set(hx + Math.sin(a0) * 2.8, hy + eye * 0.95, hz + Math.cos(a0) * 2.8);
    _a.lerpVectors(cn.flyEnd, _b, k); _a.y += Math.sin(k * Math.PI) * 10;
    _a.y = Math.max(_a.y, ground(_a.x, _a.z) + 1.2);
    _l.lerpVectors(cn.flyLook, head, K3.smooth(0, 0.7, k));
    caption(-1); if (k > 0.6) caption(cn.lines.length);
    if (!cn.townMusic && k > 0.3) { cn.townMusic = true; try { A.play(cn.c.faction === 'sylvan' ? 'town_sylvan' : 'town_crown'); } catch (e) {} }
    cam.position.copy(_a); cam.lookAt(_l);
  } else if (t < T_FLY + T_DOWN + T_ORBIT) {
    // C: a full turn and a half round the hero, ending behind the shoulders
    const k = (t - T_FLY - T_DOWN) / T_ORBIT, e = ease(k) * 0.35 + k * 0.65;
    const a = yaw + Math.PI + e * Math.PI * 3, r = K3.lerp(2.8, 1.9, k);
    _a.set(hx + Math.sin(a) * r, hy + eye * K3.lerp(0.95, 1.05, k) + Math.sin(k * Math.PI) * 0.25, hz + Math.cos(a) * r);
    head.y -= 0.12 * (1 - k);
    caption(cn.lines.length);
    cam.position.copy(_a); cam.lookAt(head);
    cn.orbEnd = cam.position.clone();
  } else if (t < T_FLY + T_DOWN + T_ORBIT + T_MERGE) {
    // D: into the hero's eyes, and the world opens up
    const k = ease((t - T_FLY - T_DOWN - T_ORBIT) / T_MERGE);
    _b.set(hx + fx * 0.12, hy + eye, hz + fz * 0.12);
    _a.lerpVectors(cn.orbEnd, _b, k);
    _l.lerpVectors(head, _b.clone().add(new THREE.Vector3(fx * 10, -0.5, fz * 10)), k);
    if (k > 0.2) caption(-1);
    cn.ov.querySelector('.k3c-flash').style.opacity = String(Math.sin(K3.smooth(0.55, 1, k) * Math.PI) * 0.85);
    cn.ov.classList.toggle('open', k > 0.5);
    cam.position.copy(_a); cam.lookAt(_l);
    if (k > 0.8) { view.want = view.dist = 0; } // hide the body as the camera enters the head
  } else end();
  if (cine) K3.vmVisible = false;
}
K3.startCine = startCine; K3.updateCine = updateCine;
KR.K3cine = true;
